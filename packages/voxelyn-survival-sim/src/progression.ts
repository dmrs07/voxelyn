// A Matriz Geracional Aurix: a arvore de protocolos permanentes.
//
// Este modulo vive na SIMULACAO, e nao no cliente, por um motivo so: o servidor
// precisa derivar exatamente a mesma configuracao que o cliente jogou. Ele emite
// o ticket da run com o tuning congelado, e depois re-simula a run para decidir a
// recompensa. Duas derivacoes — uma no bundle, outra no servidor — divergiriam no
// primeiro ajuste de balanco, e a divergencia apareceria como "sua run foi
// recusada" para um jogador que nao fez nada de errado.
//
// ---------------------------------------------------------------------------
// A POLITICA QUE ESTE ARQUIVO INAUGURA
// ---------------------------------------------------------------------------
// O repositorio afirmava que metaprogressao era variedade — bestiario,
// descobertas, cosmeticos — e NUNCA poder numerico, porque uma seed compartilhada
// tem de significar a mesma coisa para duas pessoas. O argumento estava certo
// sobre o que protegia, e continua valendo: a resposta nao e abrir excecao, e
// separar contextos.
//
//   Expedicao (solo autoritativa) → tuning derivado do perfil
//   Contrato ranqueado            → G-00 de fabrica, para todos
//   Co-op (primeira versao)       → G-00 de fabrica, para todos
//
// A seed continua significando o mesmo desafio onde ela e comparada, e a campanha
// ganha o loop roguelite. Ver docs/superpowers/specs/2026-08-02.
//
// ---------------------------------------------------------------------------
// O QUE A ARVORE NAO PODE OFERECER
// ---------------------------------------------------------------------------
// Nada que proteja o jogador da consequencia central (perder a carga), e nada
// que multiplique ganho economico. Um no que desse mais minerio acelera a
// propria compra, domina todas as outras escolhas e quebra o balanceamento de
// todos os custos futuros — e a proibicao mais importante da lista, e o teste
// `nenhum protocolo toca a economia` existe para que ela nao seja esquecida.

import {
  DODGE_COOLDOWN_TICKS,
  DODGE_IFRAME_TICKS,
  HEAT_DECAY_PER_TICK,
  HEAT_MAX,
  OVERHEAT_LOCK_TICKS,
  OVERHEAT_SELF_DAMAGE,
  PLAYER_HP,
  PLAYER_SPEED,
} from './constants.js';

/**
 * Purgas com que a run comeca. Era o literal `1` dentro de `makeExtra`.
 *
 * Virou constante porque o capstone do Chassi soma a ela: o valor inicial e o
 * incremento tem de morar no mesmo lugar, senao "comeca com +1" vira uma soma
 * feita contra um numero escrito em outro arquivo.
 */
export const BASE_PURGE_CELLS = 1;

export type UpgradeId = string;
export type LoreFragmentId = string;
export type UpgradeBranch = 'chassis' | 'mobility' | 'reactor' | 'survey';
export type ProspectorGeneration = 'G-00' | 'G-01' | 'G-02' | 'G-03' | 'G-04';

/**
 * A configuracao congelada de UM Prospector.
 *
 * A simulacao deixa de ler algumas constantes globais e passa a ler daqui. Nao
 * existe `if (hasUpgrade('RX-01'))` dentro do laco: a arvore e resolvida ANTES
 * da run, e o que atravessa a fronteira e uma tabela de numeros. Isso mantem a
 * simulacao ignorante da metaprogressao, que e o que permite re-simular uma run
 * antiga com o tuning que ela realmente usou.
 */
export type PlayerTuning = {
  maxHp: number;
  moveSpeed: number;

  dodgeCooldownTicks: number;
  dodgeIframeTicks: number;

  heatMax: number;
  heatDecayPerTick: number;

  /** Multiplicador da DURACAO de stun recebido. 1 = sem mudanca. */
  stunDurationScale: number;
  /** Multiplicador de dano AMBIENTAL continuo. Nao afeta ataque de inimigo. */
  environmentalDamageScale: number;
  /** Multiplicador da PENALIDADE de movimento em liquido. */
  liquidSlowScale: number;
  /** 0 = gelo como sempre foi; acima disso, mais autoridade do comando. */
  iceGlide: number;

  abilityCooldownScale: number;
  projectileSpeedScale: number;
  /** Multiplicador de dano com AUTORIA do Prospector (bolt e habilidade). */
  playerDamageScale: number;

  overheatLockTicks: number;
  overheatSelfDamage: number;

  startingPurgeCells: number;

  /**
   * Levantamento: APRESENTACAO PURA.
   *
   * Nenhum campo daqui altera um tick, e e por isso que eles ficam fora do hash
   * autoritativo (ver `hashAuthoritativeState`). A consequencia vale ser dita em
   * voz alta: um quarto da arvore e impossivel de dessincronizar.
   */
  navigation: {
    objectiveBeacon: boolean;
    /** Alcance em tiles do traco de salvage. 0 = desligado. */
    salvageTraceRange: number;
    oreScannerRange: number;
    /** Quantas camadas de parede o veio atravessa ao pulsar. */
    oreScannerOcclusion: number;
    routeMemory: boolean;
    returnVector: boolean;
    contaminationForecast: boolean;
  };
};

/**
 * O Prospector de fabrica: EXATAMENTE os numeros de hoje.
 *
 * Uma run sem configuracao explicita continua sendo esta, byte a byte. E o que
 * mantem todo replay antigo valido e o que faz o modo ranqueado ser o mesmo jogo
 * para todo mundo.
 */
export const DEFAULT_PLAYER_TUNING: PlayerTuning = Object.freeze({
  maxHp: PLAYER_HP,
  moveSpeed: PLAYER_SPEED,
  dodgeCooldownTicks: DODGE_COOLDOWN_TICKS,
  dodgeIframeTicks: DODGE_IFRAME_TICKS,
  heatMax: HEAT_MAX,
  heatDecayPerTick: HEAT_DECAY_PER_TICK,
  stunDurationScale: 1,
  environmentalDamageScale: 1,
  liquidSlowScale: 1,
  iceGlide: 0,
  abilityCooldownScale: 1,
  projectileSpeedScale: 1,
  playerDamageScale: 1,
  overheatLockTicks: OVERHEAT_LOCK_TICKS,
  overheatSelfDamage: OVERHEAT_SELF_DAMAGE,
  startingPurgeCells: BASE_PURGE_CELLS,
  navigation: Object.freeze({
    objectiveBeacon: false,
    salvageTraceRange: 0,
    oreScannerRange: 0,
    oreScannerOcclusion: 0,
    routeMemory: false,
    returnVector: false,
    contaminationForecast: false,
  }),
}) as PlayerTuning;

/** Custo por tier. Igual entre ramificacoes — a escolha e de ROTA, nao de preco. */
export const TIER_ORE_COST: readonly number[] = [35, 55, 85, 130, 200, 300];
export const TIER_CORE_COST: readonly number[] = [1, 1, 1, 2, 2, 3];

/**
 * O que um protocolo faz com o tuning.
 *
 * Uma funcao, e nao uma tabela de deltas, porque nem todo efeito e uma soma:
 * `heatMax` vira 105 e nao "+5", e `iceGlide` e um valor absoluto. Funcoes puras
 * tambem permitem que o teste de teto (§5 da spec) leia o resultado da arvore
 * inteira sem reimplementar a aritmetica.
 */
type TuningPatch = (t: PlayerTuning) => PlayerTuning;

export type UpgradeDefinition = {
  id: UpgradeId;
  branch: UpgradeBranch;
  /** 1..6. O tier tambem escolhe o preco e o ATO narrativo do fragmento. */
  tier: number;
  prerequisite: UpgradeId | null;
  oreCost: number;
  coreCost: number;
  loreFragmentId: LoreFragmentId;
  apply: TuningPatch;
};

/** Milesimos, e nao float livre: o valor entra no hash autoritativo. */
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

const nav = (t: PlayerTuning, patch: Partial<PlayerTuning['navigation']>): PlayerTuning => ({
  ...t,
  navigation: { ...t.navigation, ...patch },
});

/**
 * O catalogo.
 *
 * Custos, efeitos e pre-requisitos sao DADO, e nao regra espalhada: rebalancear
 * a arvore inteira e editar esta tabela. As unicas regras fora dela sao "T(n)
 * exige T(n-1)" e "todo protocolo custa pelo menos um nucleo", e as duas sao
 * cobertas por teste.
 */
const UPGRADE_SPECS: readonly Omit<UpgradeDefinition, 'oreCost' | 'coreCost' | 'prerequisite'>[] = [
  // CHASSI — sobrevivencia. Vida em tres degraus de +4, e um capstone que da
  // margem em vez de poder: mais uma purga e mais uma chance de apagar o chao.
  {
    id: 'CA-01',
    branch: 'chassis',
    tier: 1,
    loreFragmentId: 'AX-PUB-002',
    apply: (t) => ({ ...t, maxHp: t.maxHp + 4 }),
  },
  {
    id: 'CA-02',
    branch: 'chassis',
    tier: 2,
    loreFragmentId: 'AX-ENG-011',
    apply: (t) => ({ ...t, stunDurationScale: 0.9 }),
  },
  {
    id: 'CA-03',
    branch: 'chassis',
    tier: 3,
    loreFragmentId: 'AX-PRC-014',
    apply: (t) => ({ ...t, maxHp: t.maxHp + 4 }),
  },
  {
    id: 'CA-04',
    branch: 'chassis',
    tier: 4,
    loreFragmentId: 'AX-INC-027',
    apply: (t) => ({ ...t, environmentalDamageScale: 0.92 }),
  },
  {
    id: 'CA-05',
    branch: 'chassis',
    tier: 5,
    loreFragmentId: 'AX-EXE-033',
    apply: (t) => ({ ...t, maxHp: t.maxHp + 4 }),
  },
  {
    id: 'CA-X',
    branch: 'chassis',
    tier: 6,
    loreFragmentId: 'AX-UNK-041',
    apply: (t) => ({ ...t, startingPurgeCells: t.startingPurgeCells + 1 }),
  },

  // MOBILIDADE — movimento. Dois degraus de +2%, e um capstone de UM iframe:
  // distancia, velocidade, iframe e cooldown nao sobem juntos.
  {
    id: 'MV-01',
    branch: 'mobility',
    tier: 1,
    loreFragmentId: 'AX-PUB-003',
    apply: (t) => ({ ...t, moveSpeed: round3(t.moveSpeed * 1.02) }),
  },
  {
    id: 'MV-02',
    branch: 'mobility',
    tier: 2,
    loreFragmentId: 'AX-ENG-013',
    apply: (t) => ({ ...t, dodgeCooldownTicks: t.dodgeCooldownTicks - 1 }),
  },
  {
    id: 'MV-03',
    branch: 'mobility',
    tier: 3,
    loreFragmentId: 'AX-PRC-016',
    apply: (t) => ({ ...t, liquidSlowScale: 0.92 }),
  },
  {
    id: 'MV-04',
    branch: 'mobility',
    tier: 4,
    loreFragmentId: 'AX-INC-023',
    apply: (t) => ({ ...t, iceGlide: 0.25 }),
  },
  {
    id: 'MV-05',
    branch: 'mobility',
    tier: 5,
    loreFragmentId: 'AX-EXE-031',
    apply: (t) => ({ ...t, moveSpeed: round3(t.moveSpeed * 1.02) }),
  },
  {
    id: 'MV-X',
    branch: 'mobility',
    tier: 6,
    loreFragmentId: 'AX-UNK-044',
    apply: (t) => ({ ...t, dodgeIframeTicks: t.dodgeIframeTicks + 1 }),
  },

  // REATOR — calor e combate. O UNICO bonus direto de dano da arvore inteira
  // esta no fim deste ramo, e vale 4%.
  {
    id: 'RX-01',
    branch: 'reactor',
    tier: 1,
    loreFragmentId: 'AX-PUB-005',
    apply: (t) => ({ ...t, heatDecayPerTick: round3(t.heatDecayPerTick * 1.05) }),
  },
  {
    id: 'RX-02',
    branch: 'reactor',
    tier: 2,
    loreFragmentId: 'AX-ENG-018',
    apply: (t) => ({ ...t, heatMax: 105 }),
  },
  {
    id: 'RX-03',
    branch: 'reactor',
    tier: 3,
    loreFragmentId: 'AX-PRC-019',
    apply: (t) => ({ ...t, abilityCooldownScale: 0.96 }),
  },
  {
    id: 'RX-04',
    branch: 'reactor',
    tier: 4,
    loreFragmentId: 'AX-INC-029',
    apply: (t) => ({ ...t, projectileSpeedScale: 1.06 }),
  },
  {
    id: 'RX-05',
    branch: 'reactor',
    tier: 5,
    loreFragmentId: 'AX-EXE-036',
    apply: (t) => ({
      ...t,
      overheatLockTicks: t.overheatLockTicks - 4,
      overheatSelfDamage: Math.max(0, t.overheatSelfDamage - 1),
    }),
  },
  {
    id: 'RX-X',
    branch: 'reactor',
    tier: 6,
    loreFragmentId: 'AX-UNK-047',
    apply: (t) => ({ ...t, playerDamageScale: 1.04 }),
  },

  // LEVANTAMENTO — informacao. Nada aqui altera um tick: e a ramificacao que o
  // hash autoritativo pode ignorar com seguranca.
  {
    id: 'SV-01',
    branch: 'survey',
    tier: 1,
    loreFragmentId: 'AX-PUB-007',
    apply: (t) => nav(t, { objectiveBeacon: true }),
  },
  {
    id: 'SV-02',
    branch: 'survey',
    tier: 2,
    loreFragmentId: 'AX-ENG-015',
    apply: (t) => nav(t, { salvageTraceRange: 18 }),
  },
  {
    id: 'SV-03',
    branch: 'survey',
    tier: 3,
    loreFragmentId: 'AX-PRC-021',
    apply: (t) => nav(t, { oreScannerRange: 11, oreScannerOcclusion: 1 }),
  },
  {
    id: 'SV-04',
    branch: 'survey',
    tier: 4,
    loreFragmentId: 'AX-INC-025',
    apply: (t) => nav(t, { routeMemory: true }),
  },
  {
    id: 'SV-05',
    branch: 'survey',
    tier: 5,
    loreFragmentId: 'AX-EXE-038',
    apply: (t) => nav(t, { returnVector: true }),
  },
  {
    id: 'SV-X',
    branch: 'survey',
    tier: 6,
    loreFragmentId: 'AX-UNK-049',
    apply: (t) => nav(t, { contaminationForecast: true }),
  },
];

const BRANCH_ORDER: readonly UpgradeBranch[] = ['chassis', 'mobility', 'reactor', 'survey'];

export const UPGRADES: readonly UpgradeDefinition[] = UPGRADE_SPECS.map((spec) => {
  const previous = UPGRADE_SPECS.find((o) => o.branch === spec.branch && o.tier === spec.tier - 1);
  return {
    ...spec,
    prerequisite: previous?.id ?? null,
    oreCost: TIER_ORE_COST[spec.tier - 1],
    coreCost: TIER_CORE_COST[spec.tier - 1],
  };
});

const BY_ID = new Map<UpgradeId, UpgradeDefinition>(UPGRADES.map((u) => [u.id, u]));

export const findUpgrade = (id: UpgradeId): UpgradeDefinition | undefined => BY_ID.get(id);

export const upgradesOfBranch = (branch: UpgradeBranch): readonly UpgradeDefinition[] =>
  UPGRADES.filter((u) => u.branch === branch);

export const UPGRADE_BRANCHES = BRANCH_ORDER;

export const TOTAL_UPGRADES = UPGRADES.length;

/**
 * Limiares de geracao, por quantidade de protocolos.
 *
 * Derivada, e nunca persistida como segundo valor: um perfil com a lista de
 * protocolos e a geracao gravadas lado a lado tem duas verdades, e uma delas vai
 * ficar velha.
 */
export const GENERATION_THRESHOLDS: readonly { min: number; generation: ProspectorGeneration }[] = [
  { min: 18, generation: 'G-04' },
  { min: 12, generation: 'G-03' },
  { min: 7, generation: 'G-02' },
  { min: 3, generation: 'G-01' },
  { min: 0, generation: 'G-00' },
];

export const deriveGeneration = (purchased: readonly UpgradeId[]): ProspectorGeneration => {
  const owned = normalizeUpgradeIds(purchased).length;
  for (const step of GENERATION_THRESHOLDS) {
    if (owned >= step.min) return step.generation;
  }
  return 'G-00';
};

/** Toda geracao ATE a atual, para o codex saber o que ja deveria estar aberto. */
export const generationsReached = (
  purchased: readonly UpgradeId[],
): readonly ProspectorGeneration[] => {
  const owned = normalizeUpgradeIds(purchased).length;
  return GENERATION_THRESHOLDS.filter((s) => s.min > 0 && owned >= s.min)
    .map((s) => s.generation)
    .reverse();
};

/**
 * Higieniza a lista: descarta desconhecidos e duplicados, e ORDENA pelo catalogo.
 *
 * A ordem do array nunca e fonte de identidade. Dois perfis com os mesmos
 * protocolos comprados em ordens diferentes tem de produzir o mesmo tuning e o
 * mesmo hash — senao a ordem de compra viraria parte da run.
 */
export const normalizeUpgradeIds = (ids: readonly UpgradeId[]): UpgradeId[] => {
  const seen = new Set<UpgradeId>();
  for (const id of ids) {
    if (BY_ID.has(id)) seen.add(id);
  }
  return UPGRADES.filter((u) => seen.has(u.id)).map((u) => u.id);
};

/**
 * A arvore comprada e valida? (todo protocolo com o pre-requisito presente)
 *
 * Existe para o servidor REPARAR um perfil inconsistente em vez de confiar nele:
 * a validacao roda na leitura, e nao so na escrita.
 */
export const isValidUpgradeSet = (ids: readonly UpgradeId[]): boolean => {
  const owned = new Set(normalizeUpgradeIds(ids));
  if (owned.size !== new Set(ids.filter((id) => BY_ID.has(id))).size) return false;
  for (const id of owned) {
    const def = BY_ID.get(id);
    if (def?.prerequisite && !owned.has(def.prerequisite)) return false;
  }
  return true;
};

/** Derivacao pura. Ordem irrelevante, IDs desconhecidos ignorados. */
export const derivePlayerTuning = (purchased: readonly UpgradeId[]): PlayerTuning => {
  let tuning: PlayerTuning = {
    ...DEFAULT_PLAYER_TUNING,
    navigation: { ...DEFAULT_PLAYER_TUNING.navigation },
  };
  for (const id of normalizeUpgradeIds(purchased)) {
    const def = BY_ID.get(id);
    if (def) tuning = def.apply(tuning);
  }
  return tuning;
};

/**
 * A ordem em que o tuning entra no hash autoritativo.
 *
 * Lista EXPLICITA, e nao `Object.keys`: a ordem de chaves de objeto nao e
 * garantida entre engines, e um hash que depende dela quebraria a verificacao
 * entre o navegador e o servidor sem nenhum aviso.
 *
 * `navigation` fica de fora de proposito — nada la altera um tick, e inclui-lo
 * faria duas runs identicas divergirem por causa de um HUD.
 */
export const TUNING_HASH_ORDER: readonly (keyof Omit<PlayerTuning, 'navigation'>)[] = [
  'maxHp',
  'moveSpeed',
  'dodgeCooldownTicks',
  'dodgeIframeTicks',
  'heatMax',
  'heatDecayPerTick',
  'stunDurationScale',
  'environmentalDamageScale',
  'liquidSlowScale',
  'iceGlide',
  'abilityCooldownScale',
  'projectileSpeedScale',
  'playerDamageScale',
  'overheatLockTicks',
  'overheatSelfDamage',
  'startingPurgeCells',
];

/**
 * Digest estavel do tuning que uma run foi autorizada a usar.
 *
 * FNV-1a sobre os mesmos milesimos que entram no hash da run. Nao e
 * criptografico e nao precisa ser: ele nao protege contra um atacante — o ticket
 * fica no servidor —, ele detecta DIVERGENCIA entre o que foi autorizado e o que
 * seria derivado na liquidacao.
 */
export const hashPlayerTuning = (tuning: PlayerTuning): string => {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    const value = Math.round(v * 1000) | 0;
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (value >>> shift) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const key of TUNING_HASH_ORDER) mix(tuning[key]);
  return (h >>> 0).toString(16).padStart(8, '0');
};
