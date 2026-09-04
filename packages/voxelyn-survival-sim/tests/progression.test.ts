import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAYER_TUNING,
  TIER_CORE_COST,
  TIER_ORE_COST,
  TOTAL_UPGRADES,
  TUNING_HASH_ORDER,
  UPGRADES,
  UPGRADE_BRANCHES,
  deriveGeneration,
  derivePlayerTuning,
  findUpgrade,
  generationsReached,
  hashPlayerTuning,
  iceGlideFor,
  isValidUpgradeSet,
  normalizeUpgradeIds,
  upgradesOfBranch,
  type PlayerTuning,
  type UpgradeId,
} from '../src/progression';
import { ICE_GLIDE_STABILISED, PLAYER_SPEED, TICK_HZ } from '../src/constants';
import { PLAYER_HP, PLAYER_SPEED } from '../src/constants';

const ALL: UpgradeId[] = UPGRADES.map((u) => u.id);

describe('catalogo da Matriz Geracional', () => {
  it('tem cinco ramificacoes de seis tiers', () => {
    expect(TOTAL_UPGRADES).toBe(30);
    for (const branch of UPGRADE_BRANCHES) {
      const tiers = upgradesOfBranch(branch).map((u) => u.tier);
      expect(tiers).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('nao tem IDs duplicados', () => {
    expect(new Set(ALL).size).toBe(ALL.length);
  });

  it('encadeia o pre-requisito dentro do proprio ramo, e so nele', () => {
    for (const upgrade of UPGRADES) {
      if (upgrade.tier === 1) {
        expect(upgrade.prerequisite).toBeNull();
        continue;
      }
      const previous = findUpgrade(upgrade.prerequisite ?? '');
      expect(previous?.branch).toBe(upgrade.branch);
      expect(previous?.tier).toBe(upgrade.tier - 1);
    }
  });

  // A regra economica que sustenta a decisao de extracao: minerio sozinho nao
  // compra NADA. Quem so extrai acumula uma reserva que fica esperando a coragem
  // de buscar o nucleo.
  it('todo protocolo custa minerio E pelo menos um nucleo', () => {
    for (const upgrade of UPGRADES) {
      expect(upgrade.oreCost).toBe(TIER_ORE_COST[upgrade.tier - 1]);
      expect(upgrade.coreCost).toBe(TIER_CORE_COST[upgrade.tier - 1]);
      expect(upgrade.coreCost).toBeGreaterThanOrEqual(1);
      expect(upgrade.oreCost).toBeGreaterThan(0);
    }
  });

  it('a arvore inteira custa 4025 minerio e 50 nucleos', () => {
    const ore = UPGRADES.reduce((sum, u) => sum + u.oreCost, 0);
    const cores = UPGRADES.reduce((sum, u) => sum + u.coreCost, 0);
    expect(ore).toBe(4025);
    expect(cores).toBe(50);
  });

  it('cada protocolo aponta para um fragmento de lore proprio', () => {
    const fragments = UPGRADES.map((u) => u.loreFragmentId);
    expect(new Set(fragments).size).toBe(fragments.length);
  });
});

describe('derivePlayerTuning', () => {
  it('perfil vazio produz EXATAMENTE o Prospector de fabrica', () => {
    expect(derivePlayerTuning([])).toEqual(DEFAULT_PLAYER_TUNING);
  });

  it('ignora IDs desconhecidos em vez de lancar', () => {
    expect(derivePlayerTuning(['NAO-EXISTE', 'CA-01'])).toEqual(derivePlayerTuning(['CA-01']));
  });

  // A ordem de compra nao pode virar parte da run: dois perfis com os mesmos
  // protocolos tem de produzir o mesmo Prospector.
  it('independe da ordem da lista', () => {
    const forward = derivePlayerTuning(ALL);
    const backward = derivePlayerTuning([...ALL].reverse());
    expect(backward).toEqual(forward);
    expect(hashPlayerTuning(backward)).toBe(hashPlayerTuning(forward));
  });

  it('duplicatas nao acumulam efeito', () => {
    expect(derivePlayerTuning(['CA-01', 'CA-01', 'CA-01'])).toEqual(derivePlayerTuning(['CA-01']));
  });

  it('nao muta o default congelado', () => {
    derivePlayerTuning(ALL);
    expect(DEFAULT_PLAYER_TUNING.maxHp).toBe(PLAYER_HP);
    expect(DEFAULT_PLAYER_TUNING.navigation.objectiveBeacon).toBe(false);
    expect(DEFAULT_PLAYER_TUNING.combat.autoAcquire).toBe(false);
  });

  it('cada protocolo altera SOMENTE os campos que promete', () => {
    const changed = (ids: UpgradeId[]): string[] => {
      const base = DEFAULT_PLAYER_TUNING;
      const next = derivePlayerTuning(ids);
      const keys: string[] = [];
      for (const key of Object.keys(base) as (keyof PlayerTuning)[]) {
        if (key === 'navigation') {
          for (const navKey of Object.keys(base.navigation)) {
            const a = base.navigation[navKey as keyof PlayerTuning['navigation']];
            const b = next.navigation[navKey as keyof PlayerTuning['navigation']];
            if (a !== b) keys.push(`navigation.${navKey}`);
          }
          continue;
        }
        if (key === 'combat') {
          for (const cmbKey of Object.keys(base.combat)) {
            const a = base.combat[cmbKey as keyof PlayerTuning['combat']];
            const b = next.combat[cmbKey as keyof PlayerTuning['combat']];
            if (a !== b) keys.push(`combat.${cmbKey}`);
          }
          continue;
        }
        if (base[key] !== next[key]) keys.push(key);
      }
      return keys.sort();
    };

    expect(changed(['CA-01'])).toEqual(['maxHp']);
    expect(changed(['CA-01', 'CA-02'])).toEqual(['maxHp', 'stunDurationScale']);
    expect(changed(['MV-01'])).toEqual(['moveSpeed']);
    expect(changed(['MV-01', 'MV-02'])).toEqual(['dodgeCooldownTicks', 'moveSpeed']);
    expect(changed(['RX-01'])).toEqual(['heatDecayPerTick']);
    expect(changed(['RX-01', 'RX-02'])).toEqual(['heatDecayPerTick', 'heatMax']);
    expect(changed(['SV-01'])).toEqual(['navigation.objectiveBeacon']);
    expect(changed(['SV-01', 'SV-02', 'SV-03'])).toEqual([
      'navigation.objectiveBeacon',
      'navigation.oreScannerOcclusion',
      'navigation.oreScannerRange',
      'navigation.salvageTraceRange',
    ]);
    expect(changed(['IA-01'])).toEqual(['combat.threatBrackets']);
    expect(changed(['IA-01', 'IA-02', 'IA-03'])).toEqual([
      'combat.intentTelegraph',
      'combat.interceptMarker',
      'combat.threatBrackets',
    ]);
  });

  it('acumula os degraus de vida e de velocidade', () => {
    const chassis = derivePlayerTuning(['CA-01', 'CA-03', 'CA-05']);
    expect(chassis.maxHp).toBe(PLAYER_HP + 12);
    const mobility = derivePlayerTuning(['MV-01', 'MV-05']);
    expect(mobility.moveSpeed).toBeCloseTo(PLAYER_SPEED * 1.02 * 1.02, 3);
  });
});

// Estes numeros sao o CONTRATO de balanceamento da spec (secao 5). Se um ajuste
// os estourar, o teste falha e a decisao volta a ser consciente em vez de virar
// inflacao silenciosa de poder.
describe('teto de poder da arvore completa', () => {
  const full = derivePlayerTuning(ALL);

  it('vida sobe no maximo 12%', () => {
    expect(full.maxHp / PLAYER_HP).toBeLessThanOrEqual(1.12 + 1e-9);
    expect(full.maxHp).toBe(PLAYER_HP + 12);
  });

  it('velocidade sobe no maximo 5%', () => {
    expect(full.moveSpeed / PLAYER_SPEED).toBeLessThanOrEqual(1.05);
    expect(full.moveSpeed / PLAYER_SPEED).toBeGreaterThan(1.03);
  });

  it('dano direto sobe no maximo 4%', () => {
    expect(full.playerDamageScale).toBeLessThanOrEqual(1.04);
  });

  it('reducao ambiental fica em no maximo 8%', () => {
    expect(full.environmentalDamageScale).toBeGreaterThanOrEqual(0.92);
  });

  it('esquiva ganha no maximo 1 iframe e 1 tick de cooldown', () => {
    expect(full.dodgeIframeTicks - DEFAULT_PLAYER_TUNING.dodgeIframeTicks).toBe(1);
    expect(DEFAULT_PLAYER_TUNING.dodgeCooldownTicks - full.dodgeCooldownTicks).toBe(1);
  });

  it('calor sobe ~5% e dissipacao ~5%', () => {
    expect(full.heatMax / DEFAULT_PLAYER_TUNING.heatMax).toBeLessThanOrEqual(1.05);
    expect(full.heatDecayPerTick / DEFAULT_PLAYER_TUNING.heatDecayPerTick).toBeLessThanOrEqual(1.1);
  });

  it('o slow de liquido e o overheat continuam existindo', () => {
    expect(full.liquidSlowScale).toBeGreaterThan(0);
    expect(full.overheatLockTicks).toBeGreaterThan(0);
    expect(full.overheatSelfDamage).toBeGreaterThan(0);
  });

  it('o gelo continua escorregando: MV-04 estabiliza, nao seca a lamina', () => {
    // O teto se mede na INERCIA resolvida, e nao no campo do tuning: `iceGlide`
    // e um cursor de instalacao (0..1) e MV-04 o instala inteiro. Ler o campo
    // aqui verificaria a aritmetica da tabela, e nao a promessa de design —
    // que e "o gelo continua sendo gelo".
    const stabilised = iceGlideFor(full);
    expect(stabilised).toBeGreaterThan(0);
    expect(stabilised).toBeLessThan(1);
    expect(stabilised).toBe(ICE_GLIDE_STABILISED);
    // E continua escorregando de verdade: pelo menos meio tile de frenagem
    // depois de soltar o comando. A distancia da serie geometrica do embalo.
    const braking = (PLAYER_SPEED / TICK_HZ) * (stabilised / (1 - stabilised));
    expect(braking).toBeGreaterThan(0.5);
  });
});

// A proibicao mais importante da spec: nenhuma habilidade pode aumentar ganho
// economico. Uma delas aceleraria a propria compra e tornaria todas as outras
// escolhas erradas.
describe('nenhum protocolo toca a economia', () => {
  // Lista LITERAL, e nao heuristica sobre o nome: a superficie do tuning e o
  // unico caminho pelo qual um protocolo poderia mexer na economia, e um campo
  // novo aqui tem de ser uma decisao consciente. `oreScannerRange` mostra por que
  // uma regex nao serve — ele contem "ore" e nao rende uma lasca sequer.
  it('a superficie do tuning e exatamente esta, e nenhum campo rende recurso', () => {
    expect(Object.keys(DEFAULT_PLAYER_TUNING).sort()).toEqual([
      'abilityCooldownScale',
      'combat',
      'dodgeCooldownTicks',
      'dodgeIframeTicks',
      'environmentalDamageScale',
      'heatDecayPerTick',
      'heatMax',
      'iceGlide',
      'liquidSlowScale',
      'maxHp',
      'moveSpeed',
      'navigation',
      'overheatLockTicks',
      'overheatSelfDamage',
      'playerDamageScale',
      'projectileSpeedScale',
      'startingPurgeCells',
      'stunDurationScale',
    ]);
    expect(Object.keys(DEFAULT_PLAYER_TUNING.navigation).sort()).toEqual([
      'contaminationForecast',
      'objectiveBeacon',
      'oreScannerOcclusion',
      'oreScannerRange',
      'returnVector',
      'routeMemory',
      'salvageTraceRange',
    ]);
    expect(Object.keys(DEFAULT_PLAYER_TUNING.combat).sort()).toEqual([
      'aimAssistConeDegrees',
      'autoAcquire',
      'intentTelegraph',
      'interceptMarker',
      'targetMemoryTicks',
      'threatBrackets',
    ]);
  });

  it('o conjunto de campos do tuning e fechado e conhecido', () => {
    expect(Object.keys(DEFAULT_PLAYER_TUNING).sort()).toEqual(
      [...TUNING_HASH_ORDER.map(String), 'navigation', 'combat'].sort(),
    );
  });

  // A trilha de IA interpreta e executa; nunca soma dano. O unico bonus direto
  // da arvore continua sendo o RX-X, e este teste e o que impede um IA futuro
  // de virar a segunda trilha de dano que a proposta rejeitou.
  it('a trilha de IA nao toca nenhum campo autoritativo', () => {
    const intelligence = derivePlayerTuning(['IA-01', 'IA-02', 'IA-03', 'IA-04', 'IA-05', 'IA-X']);
    for (const key of TUNING_HASH_ORDER) {
      expect(intelligence[key], String(key)).toBe(DEFAULT_PLAYER_TUNING[key]);
    }
    expect(intelligence.playerDamageScale).toBe(1);
  });
});

describe('geracao derivada', () => {
  const withCount = (n: number): UpgradeId[] => ALL.slice(0, n);

  it('respeita os limiares', () => {
    expect(deriveGeneration([])).toBe('G-00');
    expect(deriveGeneration(withCount(2))).toBe('G-00');
    expect(deriveGeneration(withCount(3))).toBe('G-01');
    expect(deriveGeneration(withCount(6))).toBe('G-01');
    expect(deriveGeneration(withCount(7))).toBe('G-02');
    expect(deriveGeneration(withCount(11))).toBe('G-02');
    expect(deriveGeneration(withCount(12))).toBe('G-03');
    expect(deriveGeneration(withCount(17))).toBe('G-03');
    expect(deriveGeneration(withCount(18))).toBe('G-04');
    expect(deriveGeneration(ALL)).toBe('G-04');
  });

  it('ignora IDs desconhecidos na contagem', () => {
    expect(deriveGeneration(['a', 'b', 'c', 'd'])).toBe('G-00');
  });

  it('generationsReached lista todos os marcos ate a geracao atual', () => {
    expect(generationsReached(withCount(2))).toEqual([]);
    expect(generationsReached(withCount(3))).toEqual(['G-01']);
    expect(generationsReached(withCount(12))).toEqual(['G-01', 'G-02', 'G-03']);
    expect(generationsReached(ALL)).toEqual(['G-01', 'G-02', 'G-03', 'G-04']);
  });
});

describe('normalizacao e validacao da arvore', () => {
  it('normaliza descartando desconhecidos, duplicados, e ordenando pelo catalogo', () => {
    expect(normalizeUpgradeIds(['RX-01', 'CA-01', 'RX-01', 'zzz'])).toEqual(['CA-01', 'RX-01']);
  });

  it('recusa uma arvore sem pre-requisito', () => {
    expect(isValidUpgradeSet(['CA-02'])).toBe(false);
    expect(isValidUpgradeSet(['CA-01', 'CA-02'])).toBe(true);
    expect(isValidUpgradeSet(['CA-01', 'CA-03'])).toBe(false);
  });

  it('a arvore completa e valida, e a vazia tambem', () => {
    expect(isValidUpgradeSet(ALL)).toBe(true);
    expect(isValidUpgradeSet([])).toBe(true);
  });
});

describe('hashPlayerTuning', () => {
  it('e estavel para o mesmo tuning e diferente para tunings distintos', () => {
    expect(hashPlayerTuning(derivePlayerTuning([]))).toBe(hashPlayerTuning(DEFAULT_PLAYER_TUNING));
    expect(hashPlayerTuning(derivePlayerTuning(['CA-01']))).not.toBe(
      hashPlayerTuning(DEFAULT_PLAYER_TUNING),
    );
  });

  // Levantamento e apresentacao pura: incluir a navegacao no hash faria duas
  // runs identicas divergirem por causa de um HUD.
  it('a ramificacao de Levantamento NAO muda o hash', () => {
    const survey = derivePlayerTuning(['SV-01', 'SV-02', 'SV-03', 'SV-04', 'SV-05', 'SV-X']);
    expect(hashPlayerTuning(survey)).toBe(hashPlayerTuning(DEFAULT_PLAYER_TUNING));
    expect(survey.navigation.contaminationForecast).toBe(true);
  });

  // A IA resolve-se em COMANDO antes de a simulacao ver qualquer coisa: o que
  // o servidor re-simula e um `aim` comum. Inclui-la no hash invalidaria todo
  // ticket emitido antes do deploy sem proteger nada.
  it('a trilha de IA NAO muda o hash', () => {
    const intelligence = derivePlayerTuning(['IA-01', 'IA-02', 'IA-03', 'IA-04', 'IA-05', 'IA-X']);
    expect(hashPlayerTuning(intelligence)).toBe(hashPlayerTuning(DEFAULT_PLAYER_TUNING));
    expect(intelligence.combat.autoAcquire).toBe(true);
  });
});
