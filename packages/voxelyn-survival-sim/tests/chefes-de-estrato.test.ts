// OS SEIS CHEFES DE ESTRATO.
//
// O que estes testes protegem, e vale para os seis: cada um opera a alavanca do
// PROPRIO bioma, e o contra-jogo dele e territorial. Um chefe que funcionasse
// igual em qualquer mapa seria um chefe que nao pertence a lugar nenhum — e a
// forma de isso acontecer sem ninguem perceber e a mecanica de bioma parar de
// responder enquanto o dano continua saindo.
import { describe, expect, it } from 'vitest';
import {
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  resolveChainedEvents,
  stepRun,
} from '../src/run';
import {
  ARCHETYPES,
  damageEntity,
  furnaceOverheatingAt,
  furnaceSweepAt,
  spawnEnemy,
  surfaceSpeedMul,
} from '../src/entities';
import {
  breakSolid,
  canRip,
  dischargeAt,
  isConductiveSurface,
  isDeluged,
  setSurface,
} from '../src/cells';
import { generateWorld } from '../src/worldgen';
import { biomeProfile } from '../src/strata';
import { BOSS_OF_STRATUM, IMPLEMENTED_BOSS, bossArchetypeForBiome } from '../src/bosses';
import { BOSS_PHASE_DELUGE, BOSS_PHASE_OVERHEAT, BOSS_PHASE_UNSTABLE } from '../src/types';
import {
  FROST_QUEEN_ICE_THRESHOLD,
  FURNACE_HEART_BROOD_CAP,
  FURNACE_HEART_CYCLONE_CAP,
  FURNACE_HEART_CYCLONE_INTERVAL_TICKS,
  FURNACE_HEART_CYCLONE_TOUCH_TICKS,
  FURNACE_HEART_STALACTITE_INTERVAL_TICKS,
  FURNACE_HEART_STALACTITE_WARNING_TICKS,
  FURNACE_HEART_CYCLE_TICKS,
  FURNACE_HEART_WAVE_RADIUS,
  FURNACE_HEART_WAVE_ARC,
  FURNACE_HEART_WAVE_TURN,
  FURNACE_HEART_WAVE_INTERVAL_TICKS,
  FURNACE_HEART_WAVE_WARNING_WAVES,
  FURNACE_HEART_OVERHEAT_HP,
  SURF_SCORCHED,
  LUNG_MATRIX_CYCLE_TICKS,
  ARCHCANTOR_PULSE_RADIUS,
  ARCHCANTOR_CHOIR_SLOTS,
  ARCHCANTOR_CHOIR_RADIUS,
  ARCHCANTOR_CHOIR_MOVE_SPEED,
  ARCHCANTOR_CHOIR_ATTRACT_RADIUS,
  TICK_HZ,
  DELUGE_HP_FRACTION,
  SOLID_PIPE_W,
  SOLID_PIPE_E,
  PIPE_MOUTH,
  isPipe,
  WORLD_W,
  WORLD_H,
  DELUGE_WINDUP_TICKS,
  ARCHCANTOR_CRYSTAL_BUDGET,
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_CYCLE_TICKS,
  MAGNETARCH_TETHER_RANGE,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_GAS,
  SURF_ICE,
  SURF_EMBER,
  SURF_NONE,
  SURF_WATER,
} from '../src/constants';
import {
  DEVOURER_BURROWED,
  DEVOURER_SURFACED,
  FURNACE_COOLING,
  FURNACE_OVERHEATING,
  LUNG_EXHALING,
  LUNG_INHALING,
  DISCOVERY_CATHEDRAL_SILENCED,
  DISCOVERY_FURNACE_COOLED,
  DISCOVERY_LUNG_IGNITED,
  DISCOVERY_MAGNET_BANDED,
  DISCOVERY_QUEEN_THAWED,
  MAGNET_ATTRACT,
  MAGNET_REPEL,
  RESONANT_CHOIR,
  RESONANT_SOLOIST,
  RESONANT_WILD,
  type EnemyArchetype,
  type SurvivalState,
} from '../src/types';

/** Arena limpa no meio do mapa, com o chefe a `gap` tiles a leste. */
const duel = (seed: number, archetype: EnemyArchetype, gap: number) => {
  const state = createRun({ seed });
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 18; y <= py + 18; y++) {
    for (let x = px - 18; x <= px + 18; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.enemies = [];
  const boss = spawnEnemy(state, archetype, px + gap, py, false);
  state.bossRuntime.awake = true;
  return { state, boss, px, py, w };
};

/**
 * Avanca N ticks e devolve TODOS os eventos, com o jogador imortal.
 *
 * Imortal de proposito: o que estes testes medem e o que o chefe produz, e uma
 * fixture que morre no meio para de medir sem avisar.
 */
const advanceCollecting = (state: SurvivalState, ticks: number): SemanticEvent[] => {
  const out: SemanticEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    out.push(...stepRun(state, [emptyCommand()]).events);
    state.player.hp = state.player.maxHp;
  }
  return out;
};

const paint = (state: SurvivalState, cx: number, cy: number, r: number, kind: number): void => {
  const w = state.config.width;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.surface[y * w + x] = kind;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

/**
 * Anda a simulacao ate `ready()`, com teto e o jogador de pe.
 *
 * As fases destes chefes saem do RELOGIO, entao um teste que quer medir uma
 * delas precisa esperar. Esperar com `while (fase errada) step()` foi o que eu
 * escrevi primeiro, e ele PENDURA: se o jogador morre no caminho, a run
 * termina, `stepRun` para de avancar o tick e a condicao nunca muda. O teto e
 * a rede; restaurar a vida e o que impede a cena de acabar antes da medicao.
 */
const advanceUntil = (state: SurvivalState, ready: () => boolean, limit = 2000): boolean => {
  for (let t = 0; t < limit; t++) {
    if (ready()) return true;
    stepRun(state, [emptyCommand()]);
    state.player.hp = state.player.maxHp;
  }
  return ready();
};

/** Os Ressonantes vivos que o Arquicantor rege neste instante. */
const choirGuards = (state: SurvivalState) =>
  state.bossRuntime.choir
    .map((id) => state.enemies.find((e) => e.id === id && e.alive))
    .filter((guard): guard is NonNullable<typeof guard> => guard !== undefined);

/**
 * Derruba o CORO CARDINAL do Arquicantor.
 *
 * Desde o coro, calar a Catedral tem duas metades: apagar a rede de cristal e
 * desmontar a formacao. Cada guarda vinculado e uma origem de descarga que o
 * chefe rege — uma rede movel — entao um teste que so quebrasse cristal estaria
 * medindo meio contra-jogo e chamando o resultado de silencio.
 */
const breakChoir = (state: SurvivalState): number => {
  let felled = 0;
  for (const guard of state.enemies) {
    if (!guard.alive || guard.archetype !== 'resonant') continue;
    damageEntity(state, guard, guard.maxHp, [], { kind: 'player_shot' });
    felled++;
  }
  return felled;
};

/** Quanto dano ENTRA de fato num golpe de 100. */
const damageTaken = (state: SurvivalState, boss: { hp: number }): number => {
  const before = boss.hp;
  damageEntity(state, boss as never, 100, [], { kind: 'player_shot' });
  return before - boss.hp;
};

describe('a tabela de chefes esta completa', () => {
  it('todo estrato tem um dono com corpo', () => {
    for (const stratum of Object.keys(BOSS_OF_STRATUM) as (keyof typeof BOSS_OF_STRATUM)[]) {
      const id = BOSS_OF_STRATUM[stratum];
      expect(IMPLEMENTED_BOSS[id], `${stratum} -> ${id}`).toBeDefined();
    }
  });

  it('cada bioma limpo entrega o chefe do proprio estrato', () => {
    const expected: Array<
      [Parameters<typeof bossArchetypeForBiome>[0]['stratum'], EnemyArchetype]
    > = [
      ['basalt', 'guardian'],
      ['prismatic', 'archcantor'],
      ['aquifer', 'sheet_leviathan'],
      ['sulfur', 'lung_matrix'],
      ['furnace', 'furnace_heart'],
      ['silica', 'white_devourer'],
      ['glacial', 'frost_queen'],
      ['ferric', 'magnetarch'],
    ];
    for (const [stratum, archetype] of expected) {
      expect(
        bossArchetypeForBiome({ stratum, occupation: 'none', lineage: 'mineral' }),
        stratum,
      ).toBe(archetype);
    }
  });
});

describe('Arquicantor — a Catedral responde', () => {
  it('sem rede E sem coro ele nao canta: a Catedral calada o desarma', () => {
    // A regra nao mudou, a Catedral e que ficou maior: cristal e coro sao as
    // duas metades da rede que responde ao canto. Calar as duas continua sendo
    // o contra-jogo; calar so uma deixou de bastar.
    const { state, boss } = duel(601, 'archcantor', 5);
    // A formacao nasce, e cai ANTES de o primeiro canto sair: acordar poe o
    // coro em campo, nao um golpe (ver o telegrafo de folga no despertar).
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    expect(breakChoir(state), 'a formacao nem chegou a nascer').toBeGreaterThan(0);
    let pulses = 0;
    for (let t = 0; t < 400; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'pulse') pulses++;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(pulses, 'cantou com a Catedral inteira em silencio').toBe(0);
  });

  it('o CORO e rede: com a formacao de pe ele canta numa sala sem um cristal', () => {
    // O defeito que isto protege e o que o coro existe para fechar: o encontro
    // dependia inteiramente de a geracao ter posto cristal por perto. Num mapa
    // pobre de cristal, o chefe do estrato mineral nascia desarmado de graca —
    // sem golpe, sem defesa e sem nada para o jogador entender. A formacao e a
    // parte da Catedral que ele traz consigo.
    const { state, boss } = duel(606, 'archcantor', 5);
    let sang = false;
    let discharged = false;
    for (let t = 0; t < 400 && !(sang && discharged); t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'pulse') sang = true;
        if (ev.t === 'discharge') discharged = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(sang, 'nao cantou com o coro inteiro em orbita').toBe(true);
    expect(discharged, 'o coro nao abriu corredor nenhum').toBe(true);
  });

  it('com cristal por perto ele canta, e a rede descarrega', () => {
    const { state, boss, px, py, w } = duel(602, 'archcantor', 5);
    for (const dy of [-2, 2]) state.solid[(py + dy) * w + px + 5] = SOLID_CRYSTAL;
    let discharged = false;
    for (let t = 0; t < 400 && !discharged; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'discharge') discharged = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(discharged, 'a Catedral nao respondeu ao canto').toBe(true);
    expect(boss.alive).toBe(true);
  });

  it('a sala vazia o deixa mais FRAGIL: a Catedral era a defesa dele', () => {
    const { state, boss, px, py, w } = duel(603, 'archcantor', 5);
    const silent = damageTaken(state, boss);
    for (const dy of [-2, 2]) state.solid[(py + dy) * w + px + 5] = SOLID_CRYSTAL;
    const sung = damageTaken(state, boss);
    expect(silent, 'quebrar a rede nao cobrou nada dele').toBeGreaterThan(sung);
  });

  /**
   * Uma fileira de cristal saindo do chefe e indo MUITO alem do raio do canto.
   * E a cena que separa "o alcance e do chefe" de "o alcance e da Catedral": a
   * ponta so pode acender se o canto tiver sido passado de cristal em cristal.
   */
  const crystalLine = (
    state: SurvivalState,
    px: number,
    py: number,
    from: number,
    to: number,
    skip: readonly number[] = [],
  ): void => {
    const w = state.config.width;
    for (let d = from; d <= to; d += 2) {
      if (skip.includes(d)) continue;
      state.solid[py * w + px + d] = SOLID_CRYSTAL;
    }
  };

  /** O tick em que alguma celula ALEM do raio do canto descarregou, ou -1. */
  const farDischargeTick = (
    state: SurvivalState,
    px: number,
    py: number,
    ticks: number,
  ): number => {
    const w = state.config.width;
    for (let t = 0; t < ticks; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'discharge') continue;
        for (const cell of ev.cells) {
          const d = Math.hypot((cell % w) - px, Math.floor(cell / w) - py);
          if (d > ARCHCANTOR_PULSE_RADIUS + 1) return t;
        }
      }
      state.player.hp = state.player.maxHp;
    }
    return -1;
  };

  it('a CADEIA leva o canto alem do alcance do corpo: a nave inteira responde', () => {
    // O defeito que isto protege: com o canto morrendo no raio do corpo, havia
    // uma faixa em que o jogador matava 620 de vida sem que nada respondesse —
    // o chefe ficava fora da propria mecanica.
    const { state, px, py } = duel(604, 'archcantor', 4);
    crystalLine(state, px, py, 2, ARCHCANTOR_PULSE_RADIUS + 10);
    expect(
      farDischargeTick(state, px, py, 400),
      'a cadeia nao saiu do raio do corpo',
    ).toBeGreaterThan(0);
  });

  it('o ORCAMENTO vale desde a camada zero, e nao so nas cadeias', () => {
    // O teto so aparecia no laco das camadas seguintes: as seeds entravam sem
    // consulta, entao uma Catedral densa armava muito mais que o orcamento ja
    // no release — justamente no caso em que ele existe para proteger, porque
    // cada cristal armado carrega as quatro aberturas coladas nele.
    const { state, px, py, w } = duel(605, 'archcantor', 4);
    // Cristal em toda celula PAR do disco: muito acima do orcamento, e alternado
    // para as aberturas entre eles continuarem existindo.
    let crystals = 0;
    const r = ARCHCANTOR_PULSE_RADIUS;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        if (((dx + dy) & 1) !== 0) continue;
        const x = px + dx;
        const y = py + dy;
        if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;
        state.solid[y * w + x] = SOLID_CRYSTAL;
        crystals++;
      }
    }
    expect(crystals, 'a cena nao tem cristal suficiente para estourar o teto').toBeGreaterThan(
      ARCHCANTOR_CRYSTAL_BUDGET,
    );

    let widest = 0;
    for (let t = 0; t < 400; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'discharge') widest = Math.max(widest, ev.cells.length);
      }
      state.player.hp = state.player.maxHp;
    }
    expect(widest, 'o canto nao chegou a sair').toBeGreaterThan(0);
    // Cada cristal armado carrega no maximo as quatro aberturas coladas nele.
    expect(widest, `um unico passo carregou ${widest} celulas`).toBeLessThanOrEqual(
      ARCHCANTOR_CRYSTAL_BUDGET * 4,
    );
  });

  it('CORTAR a cadeia desliga tudo o que vinha depois do corte', () => {
    // O controle do teste acima, e a razao de o alcance maior nao ser um buff
    // cego: a mesma fileira, com um vao aberto no meio, para de conduzir. O
    // jogador escolhe entre gastar tiro apagando a nave e lutar dentro dela.
    const { state, px, py } = duel(604, 'archcantor', 4);
    const cut = ARCHCANTOR_PULSE_RADIUS + 2;
    crystalLine(state, px, py, 2, ARCHCANTOR_PULSE_RADIUS + 10, [cut, cut + 2, cut + 4]);
    expect(farDischargeTick(state, px, py, 400), 'o canto atravessou o vao').toBe(-1);
  });
});

// O CORO CARDINAL.
//
// O que estes testes protegem e a promessa inteira do rework: o Arquicantor
// deixou de ser um emissor parado no meio da sala e passou a REGER criaturas.
// As tres camadas de contra-jogo que isso cria — romper a orbita para abrir
// angulo, cortar a rede para encurtar o canto, controlar os reforcos — so
// existem enquanto a formacao for feita de bichos de verdade, em posicoes de
// verdade. No dia em que o coro virar um numero de reducao de dano, todos os
// testes daqui continuam passando por acidente, e e por isso que eles medem
// POSICAO e CORPO, nunca "o chefe levou menos".
describe('Arquicantor — o Coro Cardinal', () => {
  /** A cardinal (0=N, 1=L, 2=S, 3=O) que um guarda ocupa em torno do corpo. */
  const cardinalOf = (boss: { x: number; y: number }, guard: { x: number; y: number }): number => {
    const dx = guard.x - boss.x;
    const dy = guard.y - boss.y;
    if (Math.abs(dy) >= Math.abs(dx)) return dy < 0 ? 0 : 2;
    return dx > 0 ? 1 : 3;
  };

  /** Distancia de cada guarda ao corpo do regente. */
  const orbit = (state: SurvivalState, boss: { x: number; y: number }): number[] =>
    choirGuards(state).map((guard) => Math.hypot(guard.x - boss.x, guard.y - boss.y));

  /** Anda ate a formacao ter dado `turns` quartos de volta. */
  const advanceToRotation = (state: SurvivalState, turns: number): boolean =>
    advanceUntil(state, () => state.bossRuntime.choirRotation === turns, 600);

  it('acordar CHAMA quatro Ressonantes, um por cardinal, em orbita do corpo', () => {
    const { state, boss } = duel(620, 'archcantor', 5);
    expect(choirGuards(state), 'a formacao nasceu antes de o encontro comecar').toHaveLength(0);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);

    const guards = choirGuards(state);
    expect(guards, 'o coro nao se formou').toHaveLength(ARCHCANTOR_CHOIR_SLOTS);
    // Ressonantes de VERDADE, e nao um adereço: mesmo arquetipo, mesma vida.
    for (const guard of guards) {
      expect(guard.archetype).toBe('resonant');
      expect(guard.mood).toBe(RESONANT_CHOIR);
      expect(guard.maxHp).toBe(ARCHETYPES.resonant.hp);
    }
    for (const radius of orbit(state, boss)) {
      expect(radius).toBeGreaterThan(ARCHCANTOR_CHOIR_RADIUS - 0.4);
      expect(radius).toBeLessThan(ARCHCANTOR_CHOIR_RADIUS + 0.4);
    }
    // As quatro cardinais, e nao quatro corpos amontoados de um lado.
    expect(new Set(guards.map((guard) => cardinalOf(boss, guard))).size).toBe(4);
  });

  it('a danca avanca no sentido HORARIO, e cada guarda leva o posto seguinte', () => {
    const { state, boss } = duel(621, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const seats = [...state.bossRuntime.choir];
    for (let seat = 0; seat < ARCHCANTOR_CHOIR_SLOTS; seat++) {
      const guard = state.enemies.find((e) => e.id === seats[seat])!;
      expect(cardinalOf(boss, guard), `assento ${seat} nasceu fora do posto`).toBe(seat);
    }

    expect(advanceToRotation(state, 1), 'a formacao nunca girou').toBe(true);
    // A troca de posto e um percurso, nao um instante: da tempo de o guarda
    // chegar antes de medir onde ele esta.
    for (let t = 0; t < 20; t++) stepRun(state, [emptyCommand()]);
    for (let seat = 0; seat < ARCHCANTOR_CHOIR_SLOTS; seat++) {
      const guard = state.enemies.find((e) => e.id === seats[seat])!;
      expect(cardinalOf(boss, guard), `assento ${seat} nao avancou`).toBe(
        (seat + 1) % ARCHCANTOR_CHOIR_SLOTS,
      );
    }
    // O MESMO corpo em cada assento: a danca move os guardas, nao reatribui a
    // formacao. Reatribuir faria um guarda morto abrir buraco no lugar errado.
    expect(state.bossRuntime.choir).toEqual(seats);
  });

  it('a troca de posto e um ARCO: nenhum guarda corta por dentro da formacao', () => {
    // O defeito que isto protege: uma reta de norte a leste e uma corda que
    // passa a 1,77 do centro — quatro cordas simultaneas leem como quatro
    // bichos se cruzando no meio, e durante a travessia a formacao deixa de
    // cobrir o corpo. Pela circunferencia ela continua sendo uma formacao
    // enquanto anda, e e disso que a interceptacao depende.
    const { state, boss } = duel(622, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const before = state.bossRuntime.choirRotation;
    expect(advanceUntil(state, () => state.bossRuntime.choirRotation !== before, 600)).toBe(true);

    let closest = Infinity;
    let widestStep = 0;
    let guards = choirGuards(state).map((guard) => ({ id: guard.id, x: guard.x, y: guard.y }));
    for (let t = 0; t < 24; t++) {
      stepRun(state, [emptyCommand()]);
      for (const guard of choirGuards(state)) {
        closest = Math.min(closest, Math.hypot(guard.x - boss.x, guard.y - boss.y));
        const was = guards.find((g) => g.id === guard.id);
        if (was) widestStep = Math.max(widestStep, Math.hypot(guard.x - was.x, guard.y - was.y));
      }
      guards = choirGuards(state).map((guard) => ({ id: guard.id, x: guard.x, y: guard.y }));
    }
    // A corda de um quarto de volta desceria a 1,77. O arco nao desce.
    expect(closest, 'algum guarda cortou por dentro').toBeGreaterThan(2.2);
    // E nao e teleporte: cada passo cabe na velocidade dele.
    expect(widestStep).toBeLessThan((ARCHCANTOR_CHOIR_MOVE_SPEED / TICK_HZ) * 1.6);
  });

  it('os guardas NAO perseguem: o jogador colado nao desfaz a orbita', () => {
    // Um guarda que perseguisse seria um Ressonante comum com um nome novo, e a
    // formacao — que e a defesa, o aviso e a geometria do encontro — se
    // dissolveria no primeiro tick em que o jogador entrasse no raio de aggro.
    const { state, boss } = duel(623, 'archcantor', 3);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    for (let t = 0; t < 90; t++) {
      state.player.x = boss.x - 1.2;
      state.player.y = boss.y;
      state.player.hp = state.player.maxHp;
      stepRun(state, [emptyCommand()]);
      for (const radius of orbit(state, boss)) {
        expect(radius, 'um guarda largou o posto para caçar').toBeGreaterThan(1.6);
      }
    }
  });

  it('o coro PROTEGE por interceptacao: o tiro para no corpo do guarda', () => {
    // A defesa nao e um numero. Ela e geometrica, e e por isso que perfuracao
    // continua valendo, que o angulo passa a ser uma decisao e que matar uma
    // voz abre uma janela de tiro VISIVEL, sem icone de escudo nenhum.
    const { state, boss } = duel(624, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const west = choirGuards(state).find((guard) => cardinalOf(boss, guard) === 3);
    expect(west, 'nenhum guarda ocupava a cardinal do jogador').toBeDefined();

    const bossHp = boss.hp;
    const guardHp = west!.hp;
    for (let t = 0; t < 30; t++) {
      state.player.y = boss.y;
      stepRun(state, [{ ...emptyCommand(), aim: { x: 1, y: 0 }, fire: true }]);
      state.player.hp = state.player.maxHp;
    }
    expect(guardHp - west!.hp, 'o guarda no caminho nao levou nada').toBeGreaterThan(0);
    expect(boss.hp, 'o tiro atravessou o guarda').toBe(bossHp);
  });

  it('a voz derrubada deixa BURACO permanente: o chefe nao recompoe o acorde', () => {
    // Se o coro se refizesse sozinho, cada guarda abatido viraria tempo perdido
    // e a primeira camada de contra-jogo deixaria de existir. Desmontar a
    // formacao precisa ser progresso.
    const { state } = duel(625, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const victim = choirGuards(state)[0];
    damageEntity(state, victim, victim.maxHp, [], { kind: 'player_shot' });

    for (let t = 0; t < 400; t++) stepRun(state, [emptyCommand()]);
    expect(choirGuards(state), 'o acorde voltou a ficar cheio sozinho').toHaveLength(
      ARCHCANTOR_CHOIR_SLOTS - 1,
    );
    expect(state.bossRuntime.choir.filter((id) => id === 0)).toHaveLength(1);
  });

  it('um Ressonante SOLTO que chega perto ocupa a vaga aberta', () => {
    // A vaga so volta a ser preenchida por um bicho que ja estava na Catedral —
    // um recurso finito, que o jogador tambem pode gastar antes. E o que
    // transforma "matar aquele Ressonante ali" numa decisao de verdade.
    const { state, boss } = duel(626, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const victim = choirGuards(state)[0];
    const seat = state.bossRuntime.choir.indexOf(victim.id);
    damageEntity(state, victim, victim.maxHp, [], { kind: 'player_shot' });

    const recruit = spawnEnemy(
      state,
      'resonant',
      Math.floor(boss.x) + ARCHCANTOR_CHOIR_ATTRACT_RADIUS - 2,
      Math.floor(boss.y),
      false,
    );
    expect(recruit.mood).toBe(RESONANT_WILD);
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.choir[seat], 'a vaga nao foi preenchida').toBe(recruit.id);
    expect(recruit.mood).toBe(RESONANT_CHOIR);
  });

  it('promover um Ressonante cancela o pulso selvagem que estava em voo', () => {
    const { state, boss } = duel(6261, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const victim = choirGuards(state)[0];
    const seat = state.bossRuntime.choir.indexOf(victim.id);
    damageEntity(state, victim, victim.maxHp, [], { kind: 'player_shot' });
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.choir[seat]).toBe(0);

    const recruit = spawnEnemy(
      state,
      'resonant',
      Math.floor(boss.x) + ARCHCANTOR_CHOIR_ATTRACT_RADIUS - 2,
      Math.floor(boss.y),
      false,
    );
    recruit.action = {
      kind: 'pulse',
      phase: 'windup',
      startedAt: state.tick,
      releaseAt: state.tick + 10,
      endsAt: state.tick + 18,
      direction: { x: 1, y: 0 },
    };
    recruit.vx = 3;
    recruit.vy = -2;

    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.choir[seat]).toBe(recruit.id);
    expect(recruit.mood).toBe(RESONANT_CHOIR);
    expect(recruit.action, 'o guarda conservou o pulso da vida selvagem').toBeUndefined();
    expect(recruit.vx).toBe(0);
    expect(recruit.vy).toBe(0);
  });

  it('o papel do Ressonante participa do hash autoritativo', () => {
    const { state, boss } = duel(6262, 'archcantor', 5);
    const extra = spawnEnemy(state, 'resonant', Math.floor(boss.x) + 4, Math.floor(boss.y), false);
    extra.mood = RESONANT_WILD;
    const wild = hashAuthoritativeState(state);
    extra.mood = RESONANT_SOLOIST;
    expect(hashAuthoritativeState(state)).not.toBe(wild);
  });
  it('com o acorde CHEIO, quem chega e cuspido como SOLISTA e anda so na diagonal', () => {
    // O compromisso com a diagonal e o bicho inteiro: um solista que corrigisse
    // o rumo a cada tick seria um perseguidor comum com animacao torta, e a
    // resposta a ele deixaria de ser geometrica.
    const { state, boss } = duel(627, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    expect(choirGuards(state)).toHaveLength(ARCHCANTOR_CHOIR_SLOTS);

    const extra = spawnEnemy(
      state,
      'resonant',
      Math.floor(boss.x) + 4,
      Math.floor(boss.y) + 4,
      false,
    );
    stepRun(state, [emptyCommand()]);
    expect(extra.mood, 'o quinto entrou na orbita').toBe(RESONANT_SOLOIST);
    expect(state.bossRuntime.choir).not.toContain(extra.id);

    let moved = 0;
    for (let t = 0; t < 60; t++) {
      const wasX = extra.x;
      const wasY = extra.y;
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (!extra.alive) break;
      const dx = Math.abs(extra.x - wasX);
      const dy = Math.abs(extra.y - wasY);
      if (dx < 1e-6 && dy < 1e-6) continue;
      moved++;
      // Bispo de xadrez: os dois eixos andam JUNTOS e na mesma medida. Um passo
      // barrado num dos eixos e a excecao legitima — a parede e que decide.
      if (dx > 1e-6 && dy > 1e-6) expect(Math.abs(dx - dy)).toBeLessThan(1e-6);
    }
    expect(moved, 'o solista nunca saiu do lugar').toBeGreaterThan(0);
  });

  it('o canto e um ARPEJO: as quatro vozes respondem uma a uma, na ordem da orbita', () => {
    const { state } = duel(628, 'archcantor', 5);
    const voices: number[] = [];
    for (let t = 0; t < 200 && voices.length < ARCHCANTOR_CHOIR_SLOTS; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'boss_state' && ev.state === 'choir_voice') voices.push(ev.intensity ?? -1);
      }
      state.player.hp = state.player.maxHp;
    }
    expect(voices, 'o coro nao respondeu ao canto').toHaveLength(ARCHCANTOR_CHOIR_SLOTS);
    // N, L, S, O — a nota sai da POSICAO, e nao de quem esta nela.
    expect(voices).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  it('alterna a CRUZ e o X: nenhuma diagonal fica segura para sempre', () => {
    const { state, boss, w } = duel(632, 'archcantor', 5);
    expect(
      state.solid[(Math.floor(boss.y) + 2) * w + Math.floor(boss.x) + 2],
      'a arena nao esta limpa',
    ).toBe(SOLID_NONE);

    let pattern: 'cross' | 'diagonal' | null = null;
    let crossCells = 0;
    let diagonalCells = 0;
    let invalidCross = 0;
    let invalidDiagonal = 0;
    const telegraphs: string[] = [];
    for (let t = 0; t < 400 && telegraphs.length < 3; t++) {
      const events = stepRun(state, [emptyCommand()]).events;
      const bx = Math.floor(boss.x);
      const by = Math.floor(boss.y);
      for (const ev of events) {
        if (ev.t === 'boss_state' && ev.state === 'choir_cross') {
          pattern = 'cross';
          telegraphs.push(ev.state);
        }
        if (ev.t === 'boss_state' && ev.state === 'choir_diagonal') {
          pattern = 'diagonal';
          telegraphs.push(ev.state);
        }
        if (ev.t !== 'discharge') continue;
        for (const cell of ev.cells) {
          const cx = cell % w;
          const cy = (cell - cx) / w;
          if (pattern === 'cross') {
            crossCells++;
            if (cx !== bx && cy !== by) invalidCross++;
          } else if (pattern === 'diagonal') {
            diagonalCells++;
            if (cx === bx || cy === by) invalidDiagonal++;
          }
        }
      }
      state.player.hp = state.player.maxHp;
    }
    expect(telegraphs.slice(0, 3)).toEqual(['choir_cross', 'choir_diagonal', 'choir_cross']);
    expect(crossCells).toBeGreaterThanOrEqual(ARCHCANTOR_CHOIR_SLOTS * 2);
    expect(diagonalCells).toBeGreaterThanOrEqual(ARCHCANTOR_CHOIR_SLOTS * 2);
    expect(invalidCross, 'a cruz vazou para fora dos eixos').toBe(0);
    expect(invalidDiagonal, 'o xis vazou para um eixo cardinal').toBe(0);
  });

  it('o canto vira HALO no chefe e reverbera em cada cristal da cadeia', () => {
    const { state, boss, w } = duel(633, 'archcantor', 5);
    state.solid[Math.floor(boss.y) * w + Math.floor(boss.x) + 4] = SOLID_CRYSTAL;
    const seen = new Set<string>();
    for (let t = 0; t < 200; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'boss_state') seen.add(ev.state);
      }
      state.player.hp = state.player.maxHp;
    }
    expect(seen).toContain('song_halo');
    expect(seen).toContain('resonance_halo');
  });

  it('a voz que falta nao emite: um coro incompleto responde incompleto', () => {
    const { state } = duel(629, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const victim = choirGuards(state)[0];
    const silenced = state.bossRuntime.choir.indexOf(victim.id);
    damageEntity(state, victim, victim.maxHp, [], { kind: 'player_shot' });

    const voices: number[] = [];
    for (let t = 0; t < 300 && voices.length < ARCHCANTOR_CHOIR_SLOTS - 1; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'boss_state' && ev.state === 'choir_voice') voices.push(ev.intensity ?? -1);
      }
      state.player.hp = state.player.maxHp;
    }
    expect(voices.length).toBe(ARCHCANTOR_CHOIR_SLOTS - 1);
    const missing = (silenced + state.bossRuntime.choirRotation) % ARCHCANTOR_CHOIR_SLOTS;
    expect(voices, 'a nota do assento vazio saiu assim mesmo').not.toContain(
      missing / (ARCHCANTOR_CHOIR_SLOTS - 1),
    );
  });

  it('o coro tambem e REDE: com a formacao de pe, a sala vazia nao o deixa fragil', () => {
    // A blindagem inversa continua sendo a dele; o que mudou e quantas coisas
    // precisam cair para ela abrir. Antes, um mapa pobre de cristal entregava
    // um chefe fragil de graca, sem o jogador entender nada.
    const { state, boss } = duel(630, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const guarded = damageTaken(state, boss);
    expect(breakChoir(state)).toBeGreaterThan(0);
    const silent = damageTaken(state, boss);
    expect(silent, 'derrubar o coro nao cobrou nada dele').toBeGreaterThan(guarded);
  });

  it('o regente caindo DISSOLVE a regencia: os guardas voltam a ser bichos da sala', () => {
    // Eles nao morrem junto e nao ficam presos ao papel. Um guarda orbitando um
    // cadaver seria um inimigo inofensivo e eternamente ocupado no meio da
    // arena — o unico jeito de este rework produzir lixo em campo.
    const { state, boss } = duel(631, 'archcantor', 5);
    for (let t = 0; t < 12; t++) stepRun(state, [emptyCommand()]);
    const guards = choirGuards(state);
    expect(guards).toHaveLength(ARCHCANTOR_CHOIR_SLOTS);
    damageEntity(state, boss, boss.maxHp, [], { kind: 'player_shot' });

    expect(state.bossRuntime.choir).toEqual([0, 0, 0, 0]);
    for (const guard of guards) {
      expect(guard.alive, 'o guarda morreu junto com o regente').toBe(true);
      expect(guard.mood).toBe(RESONANT_WILD);
    }
  });
});

describe('Leviata do Lencol — a lamina e o territorio', () => {
  it('nunca rompe chao seco: a lamina TEM de chegar antes', () => {
    // A regra nao mudou e nao pode mudar: sem superficie condutiva sob o ponto,
    // nao ha emergencia. O que mudou e que chao seco deixou de ser permanente —
    // ver a enchente no teste seguinte. Aqui a camara e seca no instante da
    // medicao, entao toda emergencia observada tem de ter agua embaixo.
    const { state, boss } = duel(611, 'sheet_leviathan', 6);
    const w = state.config.width;
    let breachedDry = false;
    for (let t = 0; t < 500; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'action_start' || ev.entity !== boss.id || ev.action !== 'erupt') continue;
        const i = Math.floor(ev.y) * w + Math.floor(ev.x);
        if (!isConductiveSurface(state.surface[i])) breachedDry = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(breachedDry, 'rompeu a lamina onde nao havia lamina').toBe(false);
  });

  it('negada a emergencia, a ENCHENTE avanca: chao seco atrasa, nao elimina', () => {
    // O defeito que isto protege: ele so anda e so emerge por superficie
    // condutiva, entao um jogador de pe em rocha seca nao tinha o que esquivar
    // — ficava atirando num chefe de 800 de vida sem uma unica resposta
    // possivel. "Muito facil de kitar" era literal.
    const { state, boss, px, py } = duel(614, 'sheet_leviathan', 6);
    const w = state.config.width;
    const wet = (): number => {
      let n = 0;
      for (let y = py - 14; y <= py + 14; y++) {
        for (let x = px - 14; x <= px + 14; x++) {
          if (isConductiveSurface(state.surface[y * w + x])) n++;
        }
      }
      return n;
    };
    expect(wet(), 'a camara ja comecou molhada: o teste nao mede nada').toBe(0);
    for (let t = 0; t < 400; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(wet(), 'a lamina nao avancou sobre o chao seco').toBeGreaterThan(0);
    void boss;
  });

  it('a enchente NAO vira gelo com o tempo: ela e lago, e nao degelo', () => {
    // A primeira versao gravava a faixa com timer, e agua COM timer no motor e
    // agua derretida de gelo: `stepCells` a devolve como SURF_ICE quando a
    // contagem acaba. A enchente teria virado gelo permanente no Aquifero — e
    // gelo nao e condutivo, ou seja, a correcao que existe para o Leviata
    // deixar de ser kitavel acabaria desligando o Leviata de novo, um minuto
    // depois e longe da causa.
    const { state, px, py } = duel(615, 'sheet_leviathan', 6);
    const w = state.config.width;
    const count = (kind: number): number => {
      let n = 0;
      for (let y = py - 14; y <= py + 14; y++) {
        for (let x = px - 14; x <= px + 14; x++) {
          if (state.surface[y * w + x] === kind) n++;
        }
      }
      return n;
    };
    // MUITO alem de qualquer prazo que a faixa pudesse ter tido.
    for (let t = 0; t < 2200; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(count(SURF_WATER), 'a lamina sumiu do chao').toBeGreaterThan(0);
    expect(count(SURF_ICE), 'a enchente congelou: o Aquifero virou Cripta').toBe(0);
  });

  it('a enchente NAO atravessa parede: nada alaga atras da rocha', () => {
    // Sem oclusao, a faixa pulava a celula solida e continuava do outro lado.
    // Depois `leviathanBreachSpot` achava aquela agua e o chefe emergia atras
    // de uma barreira que a lamina nunca cruzou — uma emergencia sem aviso, no
    // unico lugar que o jogador tinha escolhido por ser inalcancavel.
    const { state, boss, px, py } = duel(616, 'sheet_leviathan', 6);
    const w = state.config.width;
    // Parede transversal FECHADA entre o chefe (a leste) e o jogador.
    const wallX = px + 3;
    for (let y = py - 16; y <= py + 16; y++) state.solid[y * w + wallX] = SOLID_ROCK;

    let breachedBehind = false;
    for (let t = 0; t < 600; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'erupt') {
          if (Math.floor(ev.x) < wallX) breachedBehind = true;
        }
      }
      state.player.hp = state.player.maxHp;
    }
    let wetBehind = 0;
    for (let y = py - 14; y <= py + 14; y++) {
      for (let x = px - 14; x < wallX; x++) {
        if (isConductiveSurface(state.surface[y * w + x])) wetBehind++;
      }
    }
    expect(wetBehind, 'a agua apareceu do outro lado da rocha').toBe(0);
    expect(breachedBehind, 'emergiu atras de uma parede que a lamina nao cruzou').toBe(false);
  });

  it('com agua sob o alvo ele rompe — e a agua e que faz a diferenca', () => {
    const { state, boss, px, py } = duel(612, 'sheet_leviathan', 6);
    paint(state, px, py, 8, SURF_WATER);
    let breached = false;
    for (let t = 0; t < 500 && !breached; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'erupt')
          breached = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(breached, 'nao rompeu nem com o lago inteiro sob os pes').toBe(true);
  });

  it('submerso a lamina absorve; na superficie o tiro entra inteiro', () => {
    const { state, boss } = duel(613, 'sheet_leviathan', 6);
    boss.mood = DEVOURER_BURROWED;
    const submerged = damageTaken(state, boss);
    boss.mood = DEVOURER_SURFACED;
    const exposed = damageTaken(state, boss);
    expect(exposed).toBe(100);
    expect(exposed, 'a janela nao vale mais que o mergulho').toBeGreaterThan(submerged * 4);
  });
});

describe('Pulmao-Matriz — a respiracao da Fenda', () => {
  it('inspirando LIMPA o gas da camara; expelindo, sopra a coluna', () => {
    const { state, boss, px, py, w } = duel(621, 'lung_matrix', 6);
    paint(state, Math.floor(boss.x), Math.floor(boss.y), 5, SURF_GAS);
    const gasNear = (): number => {
      let n = 0;
      for (let y = Math.floor(boss.y) - 5; y <= Math.floor(boss.y) + 5; y++) {
        for (let x = Math.floor(boss.x) - 5; x <= Math.floor(boss.x) + 5; x++) {
          if (state.surface[y * w + x] === SURF_GAS) n++;
        }
      }
      return n;
    };
    const before = gasNear();
    // A fase sai do relogio: leva a simulacao ate a metade da janela de inspirar.
    expect(advanceUntil(state, () => state.tick % (LUNG_MATRIX_CYCLE_TICKS * 2) === 0)).toBe(true);
    for (let t = 0; t < 60; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(boss.mood).toBe(LUNG_INHALING);
    expect(gasNear(), 'nao inspirou nada').toBeLessThan(before);

    // E na fase seguinte ele devolve gas ao mundo, na direcao do jogador.
    for (let t = 0; t < LUNG_MATRIX_CYCLE_TICKS + 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(boss.mood).toBe(LUNG_EXHALING);
    let gasTowardPlayer = 0;
    for (let x = px; x < Math.floor(boss.x); x++) {
      if (state.surface[py * w + x] === SURF_GAS) gasTowardPlayer++;
    }
    expect(gasTowardPlayer, 'nao soprou coluna nenhuma').toBeGreaterThan(0);
  });

  it('fogo encostado nele durante a expiracao QUEIMA a coluna de volta', () => {
    // A unica janela de dano do jogo que o jogador abre — e ela custa terreno.
    const { state, boss, w } = duel(622, 'lung_matrix', 6);
    expect(
      advanceUntil(state, () => Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2 === 1),
    ).toBe(true);
    expect(boss.mood).toBe(LUNG_EXHALING);
    const hpBefore = boss.hp;
    const mouth = Math.floor(boss.y) * w + Math.floor(boss.x);
    state.surface[mouth] = SURF_FIRE;
    state.surfaceTimer[mouth] = 600;
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.surface[mouth] = SURF_FIRE;
      state.surfaceTimer[mouth] = 600;
    }
    expect(boss.hp, 'acender a expiracao nao cobrou nada dele').toBeLessThan(hpBefore);
  });
});

describe('Coracao da Fornalha — a sala inteira e o chefe', () => {
  it('so abre no RESFRIAMENTO: superaquecido o dano quase nao entra', () => {
    const { state, boss } = duel(631, 'furnace_heart', 6);
    boss.mood = FURNACE_OVERHEATING;
    const hot = damageTaken(state, boss);
    boss.mood = FURNACE_COOLING;
    const cool = damageTaken(state, boss);
    expect(cool).toBe(100);
    expect(cool, 'o ciclo termico nao decide nada').toBeGreaterThan(hot * 3);
  });

  it('superaquecido, acende a arena em setores', () => {
    const { state, boss, w } = duel(632, 'furnace_heart', 6);
    expect(
      advanceUntil(state, () => Math.floor(state.tick / FURNACE_HEART_CYCLE_TICKS) % 2 === 0),
    ).toBe(true);
    expect(boss.mood).toBe(FURNACE_OVERHEATING);
    for (let t = 0; t < 60; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    let burning = 0;
    for (let y = Math.floor(boss.y) - 8; y <= Math.floor(boss.y) + 8; y++) {
      for (let x = Math.floor(boss.x) - 8; x <= Math.floor(boss.x) + 8; x++) {
        if (y < 0 || x < 0 || y >= state.config.height || x >= w) continue;
        if (state.surface[y * w + x] !== SURF_NONE) burning++;
      }
    }
    expect(burning, 'a sala nao esquentou').toBeGreaterThan(8);
  });

  // Os tres testes abaixo cobrem o mesmo defeito por tres angulos: o Coracao
  // era FIXO, so pintava chao num raio de oito e nao tinha resposta nenhuma a
  // distancia. Um jogador parado a doze tiles matava 900 de vida sem risco —
  // nao era uma luta dificil nem facil, nao era uma luta.
  it('a varredura alcanca a SALA, e nao um disco em volta dele', () => {
    const { state, boss } = duel(633, 'furnace_heart', 12);
    expect(FURNACE_HEART_WAVE_RADIUS).toBeGreaterThan(12);
    expect(advanceUntil(state, () => boss.mood === FURNACE_OVERHEATING)).toBe(true);
    // O jogador esta a doze tiles: dentro do alcance do proprio bolt dele, e
    // agora dentro do alcance do chefe tambem.
    let hurt = false;
    for (let t = 0; t < FURNACE_HEART_CYCLE_TICKS && !hurt; t++) {
      const before = state.player.hp;
      stepRun(state, [emptyCommand()]);
      if (state.player.hp < before) hurt = true;
      state.player.hp = state.player.maxHp;
    }
    expect(hurt, 'a doze tiles o chefe nao alcanca ninguem').toBe(true);
  });

  it('o setor cobra de quem esta nele NA PASSAGEM, e nao so da brasa que fica', () => {
    const { state, boss } = duel(634, 'furnace_heart', 6);
    expect(advanceUntil(state, () => boss.mood === FURNACE_OVERHEATING)).toBe(true);
    let direct = 0;
    for (let t = 0; t < FURNACE_HEART_CYCLE_TICKS; t++) {
      const before = state.player.hp;
      // O chao e limpo a cada tick: o que sobrar de dano so pode ter vindo da
      // passagem da onda, e nunca de brasa acumulada sob os pes.
      stepRun(state, [emptyCommand()]);
      const i = Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x);
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
      if (state.player.hp < before) direct++;
      state.player.hp = state.player.maxHp;
    }
    expect(direct, 'a onda passa e nao cobra nada').toBeGreaterThan(0);
  });

  it('manda ESCORIACEOS a cada superaquecimento, com teto', () => {
    const { state, boss } = duel(635, 'furnace_heart', 6);
    const scoriacs = () => state.enemies.filter((e) => e.alive && e.archetype === 'scoriac').length;
    expect(scoriacs()).toBe(0);
    // Duas levas: a sala enche, e o jogador deixa de poder ignorar a distancia.
    for (let t = 0; t < FURNACE_HEART_CYCLE_TICKS * 4; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(boss.alive).toBe(true);
    expect(scoriacs()).toBeGreaterThan(0);
    expect(scoriacs(), 'a ninhada nao pode entupir a sala').toBeLessThanOrEqual(
      FURNACE_HEART_BROOD_CAP,
    );
  });

  it('na fase de LEITURA e um Escoriaceo por vez, nunca dois', () => {
    // O playtest nao passou dos 50% de vida do Coracao, e a razao nao era a
    // barra: com dois por leva e teto cinco, a primeira fase ja tinha quatro
    // corpos blindados em campo, e as duas janelas de vulnerabilidade do chefe
    // eram gastas limpando escolta. A fase que devia ENSINAR onde ficar, como
    // ler a onda e quando bater cobrava o que a luta inteira ia cobrar.
    const { state, boss } = duel(636, 'furnace_heart', 6);
    let worst = 0;
    for (let t = 0; t < FURNACE_HEART_CYCLE_TICKS * 8; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      worst = Math.max(
        worst,
        state.enemies.filter((e) => e.alive && e.archetype === 'scoriac').length,
      );
    }
    expect(
      boss.hp,
      'o chefe cruzou o colapso: isto nao mede mais a fase de leitura',
    ).toBeGreaterThan(boss.maxHp * FURNACE_HEART_OVERHEAT_HP);
    expect(worst, `chegou a ${worst} Escoriaceos antes do colapso`).toBe(1);
  });

  it('a varredura NAO transforma a camara em fogo permanente', () => {
    // O defeito mais grave do conjunto, e ele era estrutural e nao numerico. Na
    // Fornalha cinza e carvao, e `igniteCell` a devolve como fogo de 110 ticks;
    // com o setor voltando por cima da propria cinza, a arena inteira virava
    // fogo permanente. Dai o relato: "nao consigo distinguir aonde esta dando
    // dano no chao e aonde tem chao seguro" — porque nao havia chao seguro.
    const { state, boss } = duel(638, 'furnace_heart', 6);
    const w = state.config.width;
    const bx = Math.floor(boss.x);
    const by = Math.floor(boss.y);
    const r = FURNACE_HEART_WAVE_RADIUS;
    const scan = (kind: number): number => {
      let n = 0;
      for (let y = by - r; y <= by + r; y++) {
        for (let x = bx - r; x <= bx + r; x++) {
          if (Math.hypot(x - bx, y - by) > r) continue;
          if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
          if (state.solid[y * w + x] !== SOLID_NONE) continue;
          if (state.surface[y * w + x] === kind) n++;
        }
      }
      return n;
    };
    let open = 0;
    for (let y = by - r; y <= by + r; y++) {
      for (let x = bx - r; x <= bx + r; x++) {
        if (Math.hypot(x - bx, y - by) > r) continue;
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        if (state.solid[y * w + x] === SOLID_NONE) open++;
      }
    }
    // Muitas voltas completas do setor: se houvesse realimentacao, a esta
    // altura o disco inteiro estaria aceso.
    for (let t = 0; t < 1200; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    const burning = scan(SURF_FIRE);
    expect(burning, 'a varredura parou de acender: a mecanica morreu').toBeGreaterThan(0);
    expect(
      burning / open,
      `${((burning / open) * 100) | 0}% da camara acesa de uma vez`,
    ).toBeLessThan(0.4);
    // E o rastro tem de ser LEGIVEL como rastro: onde ja passou fica cinza, que
    // e a superficie mais escura do jogo.
    expect(scan(SURF_SCORCHED), 'a onda nao deixou chao apagado atras dela').toBeGreaterThan(0);
  });

  it('a cunha de AVISO aponta para onde a varredura VAI estar', () => {
    // O aviso e derivado do tick nas duas pontas (sim e cliente), entao a
    // promessa que ele faz e verificavel aqui: o rumo avisado agora tem de ser
    // o rumo que queima daqui a `WARNING_WAVES` ondas. Se as duas contas
    // divergirem, o jogador foge para dentro do fogo.
    const ahead = FURNACE_HEART_WAVE_WARNING_WAVES * FURNACE_HEART_WAVE_INTERVAL_TICKS;
    for (const tick of [0, 137, 906]) {
      const now = furnaceSweepAt(10, 10, tick);
      const later = furnaceSweepAt(10, 10, tick + ahead);
      expect(now.warnDx, `tick ${tick}`).toBeCloseTo(later.dx, 6);
      expect(now.warnDy, `tick ${tick}`).toBeCloseTo(later.dy, 6);
    }
    // E o aviso tem de chegar ANTES: um telegrafo que nao precede nao e um
    // telegrafo. (O setor gira menos que a propria abertura por onda, entao a
    // borda anda em vez de teleportar — e o que torna a sequencia aprendivel.)
    expect(FURNACE_HEART_WAVE_TURN).toBeLessThan(FURNACE_HEART_WAVE_ARC);
    expect(ahead).toBeGreaterThan(20);
  });

  it('o aviso SOME quando a onda anunciada nao vai acontecer', () => {
    // O aviso olha `tick + 3 ondas`. No fim do superaquecimento esse instante
    // ja cai no resfriamento, e ali o Coracao nao produz varredura nenhuma: a
    // cunha prometeria fogo que nunca vem. Um aviso que some sem se cumprir
    // ensina informacao falsa — que e exatamente o defeito que esta cunha
    // existe para corrigir.
    const ahead = FURNACE_HEART_WAVE_WARNING_WAVES * FURNACE_HEART_WAVE_INTERVAL_TICKS;
    // Comeco da fase quente: o aviso vale, e o instante anunciado ainda queima.
    expect(furnaceSweepAt(0, 0, 0).warnFires, 'o aviso sumiu no comeco da fase').toBe(true);
    expect(furnaceOverheatingAt(0 + ahead)).toBe(true);
    // Ultimo tick da fase quente: o instante anunciado ja e resfriamento.
    const last = FURNACE_HEART_CYCLE_TICKS - 1;
    expect(furnaceOverheatingAt(last), 'a cena nao esta na fase quente').toBe(true);
    expect(furnaceOverheatingAt(last + ahead), 'o instante anunciado ainda queima').toBe(false);
    expect(furnaceSweepAt(0, 0, last).warnFires, 'prometeu uma onda que nao vem').toBe(false);
  });

  // O COLAPSO TERMICO: a escada de fim de luta. Ate aqui o encontro tinha uma
  // ameaca so (a varredura vindo do chao), e um jogador que aprendesse a ler o
  // setor girando tinha resolvido o Coracao. As duas fases mudam de onde vem o
  // perigo — primeiro de cima, depois de todo lado.
  it('cruzar 45% acende o COLAPSO, e ele nao volta atras', () => {
    const { state, boss } = duel(637, 'furnace_heart', 6);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_OVERHEAT).toBe(0);

    boss.hp = boss.maxHp * 0.44;
    const events = advanceCollecting(state, FURNACE_HEART_CYCLE_TICKS);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_OVERHEAT).not.toBe(0);
    const phase = events.find((e) => e.t === 'boss_phase');
    expect(phase).toBeDefined();
    if (phase?.t === 'boss_phase') expect(phase.archetype).toBe('furnace_heart');

    // Curar o chefe NAO desfaz a fase: uma escada que desce nao e uma escada.
    boss.hp = boss.maxHp;
    advanceCollecting(state, 60);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_OVERHEAT).not.toBe(0);
  });

  it('o colapso derruba ESTALACTITES, avisadas antes de cobrarem', () => {
    const { state, boss } = duel(638, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.4;
    const events = advanceCollecting(state, FURNACE_HEART_STALACTITE_INTERVAL_TICKS * 2 + 4);

    const marks = events.filter((e) => e.t === 'stalactite');
    expect(marks.length).toBeGreaterThan(0);
    // O AVISO vem antes da queda — o invariante que este jogo nao quebra.
    for (const mark of marks) {
      if (mark.t !== 'stalactite') continue;
      expect(mark.fireTick).toBeGreaterThan(0);
      expect(mark.radius).toBeGreaterThan(0);
    }
    // E elas chegam a cair: a marca sai da fila.
    const before = state.bossRuntime.collapseCells.length;
    advanceCollecting(state, FURNACE_HEART_STALACTITE_WARNING_TICKS + 2);
    expect(state.bossRuntime.collapseCells.length).toBeLessThanOrEqual(before + 4);
  });

  it('a estalactite cobra de quem esta embaixo dela', () => {
    const { state, boss } = duel(639, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.4;
    let hurt = false;
    for (let t = 0; t < FURNACE_HEART_STALACTITE_INTERVAL_TICKS * 3; t++) {
      // O jogador vai ate a primeira marca em vez de fugir dela: e o unico
      // jeito de provar que a queda cobra, sem depender de sorte de posicao.
      const pending = state.bossRuntime.collapseCells[0];
      if (pending) {
        state.player.x = (pending.idx % state.config.width) + 0.5;
        state.player.y = Math.floor(pending.idx / state.config.width) + 0.5;
      }
      const before = state.player.hp;
      stepRun(state, [emptyCommand()]);
      // Zera a crosta sob os pes: o que sobrar so pode ter vindo da queda.
      const i = Math.floor(state.player.y) * state.config.width + Math.floor(state.player.x);
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
      if (state.player.hp < before) hurt = true;
      state.player.hp = state.player.maxHp;
    }
    expect(hurt, 'o teto cai e nao cobra nada').toBe(true);
  });

  it('cruzar 10% acende a INSTABILIDADE e a sala ganha ciclones', () => {
    const { state, boss } = duel(640, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.08;
    advanceCollecting(state, FURNACE_HEART_CYCLONE_INTERVAL_TICKS * 2 + 4);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_UNSTABLE).not.toBe(0);
    const cyclones = state.projectiles.filter((p) => p.kind === 'cyclone');
    expect(cyclones.length).toBeGreaterThan(0);
    expect(cyclones.length).toBeLessThanOrEqual(FURNACE_HEART_CYCLONE_CAP);
  });

  it('o ciclone ACENDE o que atravessa — o rastro e o perigo', () => {
    const { state, boss, w } = duel(641, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.08;
    advanceCollecting(state, FURNACE_HEART_CYCLONE_INTERVAL_TICKS + 40);
    let burning = 0;
    for (let y = Math.floor(boss.y) - 10; y <= Math.floor(boss.y) + 10; y++) {
      for (let x = Math.floor(boss.x) - 10; x <= Math.floor(boss.x) + 10; x++) {
        if (y < 0 || x < 0 || y >= state.config.height || x >= w) continue;
        if (state.surface[y * w + x] !== SURF_NONE) burning++;
      }
    }
    expect(burning, 'o ciclone passou e nao deixou nada').toBeGreaterThan(0);
  });

  it('o ciclone cobra por TEMPO, e nao a cada tick de contato', () => {
    const { state, boss } = duel(642, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.08;
    advanceCollecting(state, FURNACE_HEART_CYCLONE_INTERVAL_TICKS + 2);
    const cyclone = state.projectiles.find((p) => p.kind === 'cyclone');
    expect(cyclone).toBeDefined();
    if (!cyclone) return;

    let hits = 0;
    for (let t = 0; t < FURNACE_HEART_CYCLONE_TOUCH_TICKS; t++) {
      // O jogador fica DENTRO do ciclone o tempo todo. Sem o intervalo, isto
      // seriam vinte cobrancas e a morte certa de quem encostou uma vez.
      const live = state.projectiles.find((p) => p.id === cyclone.id);
      if (!live) break;
      state.player.x = live.x;
      state.player.y = live.y;
      const before = state.player.hp;
      stepRun(state, [emptyCommand()]);
      if (state.player.hp < before) hits++;
      state.player.hp = state.player.maxHp;
    }
    expect(hits).toBeLessThanOrEqual(1);
  });

  it('o ABATE esfria a sala: fogo apagado, ciclones dissolvidos, marcas canceladas', () => {
    const { state, boss, w } = duel(643, 'furnace_heart', 6);
    boss.hp = boss.maxHp * 0.08;
    advanceCollecting(state, FURNACE_HEART_CYCLONE_INTERVAL_TICKS + 30);
    expect(state.projectiles.some((p) => p.kind === 'cyclone')).toBe(true);

    const events: SemanticEvent[] = [];
    // Folga de 10x: no superaquecimento a blindagem corta o dano a um quinto,
    // e um golpe calculado em cima da vida exata sobreviveria a ela.
    damageEntity(state, boss, boss.maxHp * 10, events, { kind: 'player_shot' });

    expect(boss.alive).toBe(false);
    expect(events.some((e) => e.t === 'furnace_cooled')).toBe(true);
    expect(events.some((e) => e.t === 'message' && e.key === 'sim.furnaceCooled')).toBe(true);
    expect(state.projectiles.some((p) => p.kind === 'cyclone')).toBe(false);
    expect(state.bossRuntime.collapseCells).toHaveLength(0);
    let hot = 0;
    for (let y = Math.floor(boss.y) - 10; y <= Math.floor(boss.y) + 10; y++) {
      for (let x = Math.floor(boss.x) - 10; x <= Math.floor(boss.x) + 10; x++) {
        if (y < 0 || x < 0 || y >= state.config.height || x >= w) continue;
        const surf = state.surface[y * w + x];
        if (surf === SURF_EMBER || surf === SURF_FIRE) hot++;
      }
    }
    expect(hot, 'a sala continuou quente depois do abate').toBe(0);
  });

  it('o colapso NAO consome a RNG da run', () => {
    // Estalactites caem dezenas de vezes por encontro. Se cada uma sorteasse,
    // a sequencia da run inteira andaria conforme o jogador demorasse mais ou
    // menos para matar o chefe — e duas partidas com a mesma seed passariam a
    // divergir em tudo o que vem depois.
    const drive = (collapse: boolean): number => {
      const { state, boss } = duel(644, 'furnace_heart', 6);
      if (collapse) boss.hp = boss.maxHp * 0.4;
      state.rng.nextFloat01();
      advanceCollecting(state, FURNACE_HEART_STALACTITE_INTERVAL_TICKS * 3);
      return state.rng.nextFloat01();
    };
    expect(drive(true)).toBe(drive(false));
  });

  it('a ninhada e DETERMINISTICA: mesma seed, mesmas posicoes', () => {
    // Ela sai de geometria e do relogio, nunca de `state.rng` — duas maquinas
    // de co-op com a mesma seed tem de montar a mesma sala.
    const positions = (seed: number): string => {
      const { state } = duel(seed, 'furnace_heart', 6);
      for (let t = 0; t < FURNACE_HEART_CYCLE_TICKS * 3; t++) {
        stepRun(state, [emptyCommand()]);
        state.player.hp = state.player.maxHp;
      }
      return state.enemies
        .filter((e) => e.archetype === 'scoriac')
        .map((e) => `${e.x.toFixed(3)},${e.y.toFixed(3)}`)
        .join('|');
    };
    expect(positions(636)).toBe(positions(636));
  });
});

describe('Rainha da Geada — a couraça e o estrato', () => {
  it('cercada de gelo ela quase nao toma dano; derretido o lago, toma', () => {
    const { state, boss, px, py } = duel(641, 'frost_queen', 5);
    paint(state, Math.floor(boss.x), Math.floor(boss.y), 4, SURF_ICE);
    const frozen = damageTaken(state, boss);
    paint(state, Math.floor(boss.x), Math.floor(boss.y), 6, SURF_NONE);
    const thawed = damageTaken(state, boss);
    expect(thawed).toBe(100);
    expect(thawed, 'derreter o lago nao a expos').toBeGreaterThan(frozen * 3);
    expect(px).toBeGreaterThan(0);
    expect(py).toBeGreaterThan(0);
  });

  it('o congelamento refaz o lago e solta os Espectros DELE', () => {
    const { state, boss } = duel(642, 'frost_queen', 5);
    let froze = false;
    for (let t = 0; t < 300 && !froze; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'freeze')
          froze = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(froze, 'nunca congelou').toBe(true);
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    const w = state.config.width;
    let ice = 0;
    for (let y = Math.floor(boss.y) - 6; y <= Math.floor(boss.y) + 6; y++) {
      for (let x = Math.floor(boss.x) - 6; x <= Math.floor(boss.x) + 6; x++) {
        if (state.surface[y * w + x] === SURF_ICE) ice++;
      }
    }
    expect(ice, 'o lago nao voltou').toBeGreaterThanOrEqual(FROST_QUEEN_ICE_THRESHOLD);
    expect(state.enemies.some((e) => e.archetype === 'frost_wraith' && e.alive)).toBe(true);
  });
});

describe('Magnetarca — a faixa troca de lado', () => {
  it('a polaridade alterna sozinha, pelo relogio', () => {
    const { state, boss } = duel(651, 'magnetarch', 6);
    const seen = new Set<number>();
    for (let t = 0; t < MAGNETARCH_CYCLE_TICKS * 3; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      seen.add(boss.mood ?? -1);
    }
    expect(seen.has(MAGNET_ATTRACT)).toBe(true);
    expect(seen.has(MAGNET_REPEL)).toBe(true);
  });

  it('atraindo ele PUXA; repelindo, empurra', () => {
    const { state, boss } = duel(652, 'magnetarch', 8);
    boss.mood = MAGNET_ATTRACT;
    // Congela a fase para medir uma coisa de cada vez: o ciclo sai do relogio,
    // entao o teste anda a simulacao ate a janela que quer.
    expect(
      advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0),
    ).toBe(true);
    const startPull = Math.abs(state.player.x - boss.x);
    for (let t = 0; t < 30; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(Math.abs(state.player.x - boss.x), 'atraindo, nao puxou').toBeLessThan(startPull);

    expect(
      advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 1),
    ).toBe(true);
    const startPush = Math.abs(state.player.x - boss.x);
    for (let t = 0; t < 30; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(Math.abs(state.player.x - boss.x), 'repelindo, nao empurrou').toBeGreaterThan(startPush);
  });

  it('perto machuca numa polaridade, longe machuca na outra', () => {
    const near = duel(653, 'magnetarch', 2);
    near.boss.mood = MAGNET_ATTRACT;
    expect(
      advanceUntil(
        near.state,
        () => Math.floor(near.state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0,
      ),
    ).toBe(true);
    near.state.player.x = near.boss.x - MAGNETARCH_CRUSH_RANGE + 1;
    const nearHp = near.state.player.hp;
    for (let t = 0; t < 40; t++) stepRun(near.state, [emptyCommand()]);
    expect(near.state.player.hp, 'atraindo, a proximidade nao cobrou').toBeLessThan(nearHp);

    const far = duel(654, 'magnetarch', 2);
    expect(
      advanceUntil(far.state, () => Math.floor(far.state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 1),
    ).toBe(true);
    far.state.player.x = far.boss.x - MAGNETARCH_TETHER_RANGE - 1;
    const farHp = far.state.player.hp;
    for (let t = 0; t < 40; t++) stepRun(far.state, [emptyCommand()]);
    expect(far.state.player.hp, 'repelindo, a distancia nao cobrou').toBeLessThan(farHp);
  });
});

// As DESCOBERTAS: o instante em que o jogador entende a alavanca de cada bioma.
//
// Elas destravam o miolo do arco documental de cada chefe, e por isso o que
// cada uma exige e a coisa CERTA — nao "matou de novo". Um bit que acendesse
// por proximidade, ou por dano qualquer, entregaria a revelacao a quem nunca
// entendeu nada.
describe('as Descobertas de estrato exigem o entendimento, e nao o abate', () => {
  it('Arquicantor: so acende batendo nele com a Catedral em SILENCIO', () => {
    const { state, boss, px, py, w } = duel(661, 'archcantor', 5);
    for (const dy of [-2, 2]) state.solid[(py + dy) * w + px + 5] = SOLID_CRYSTAL;
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_CATHEDRAL_SILENCED, 'acendeu com a rede de pe').toBe(
      0,
    );

    for (const dy of [-2, 2]) state.solid[(py + dy) * w + px + 5] = SOLID_NONE;
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_CATHEDRAL_SILENCED).not.toBe(0);
  });

  it('Coracao: so acende no RESFRIAMENTO, nunca com a couraça fechada', () => {
    const { state, boss } = duel(662, 'furnace_heart', 5);
    boss.mood = FURNACE_OVERHEATING;
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_FURNACE_COOLED, 'acendeu na fase quente').toBe(0);

    boss.mood = FURNACE_COOLING;
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_FURNACE_COOLED).not.toBe(0);
  });

  it('Rainha: so acende com o lago DERRETIDO', () => {
    const { state, boss } = duel(663, 'frost_queen', 5);
    paint(state, Math.floor(boss.x), Math.floor(boss.y), 4, SURF_ICE);
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_QUEEN_THAWED, 'acendeu com ela blindada').toBe(0);

    paint(state, Math.floor(boss.x), Math.floor(boss.y), 6, SURF_NONE);
    damageEntity(state, boss, 10, [], { kind: 'player_shot' });
    expect(state.stats.discoveries & DISCOVERY_QUEEN_THAWED).not.toBe(0);
  });

  it('Pulmao: so acende quando a coluna acesa cobra dele', () => {
    const { state, boss, w } = duel(664, 'lung_matrix', 6);
    expect(
      advanceUntil(state, () => Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2 === 1),
    ).toBe(true);
    expect(state.stats.discoveries & DISCOVERY_LUNG_IGNITED, 'acendeu so por ele expelir').toBe(0);

    const mouth = Math.floor(boss.y) * w + Math.floor(boss.x);
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      state.surface[mouth] = SURF_FIRE;
      state.surfaceTimer[mouth] = 600;
    }
    expect(state.stats.discoveries & DISCOVERY_LUNG_IGNITED).not.toBe(0);
  });

  it('Magnetarca: acende ao ficar na FAIXA, e nao em nenhuma das bordas', () => {
    const { state, boss } = duel(665, 'magnetarch', 6);
    expect(
      advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0),
    ).toBe(true);
    // Dentro do campo, fora do esmagamento: a faixa.
    state.player.x = boss.x - (MAGNETARCH_CRUSH_RANGE + MAGNETARCH_TETHER_RANGE) / 2;
    state.player.y = boss.y;
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.stats.discoveries & DISCOVERY_MAGNET_BANDED).not.toBe(0);
  });
});

describe('Leviata do Lencol — o DILUVIO', () => {
  /** Poe o chefe sob pressao e roda ate a lamina ter subido `ticks`. */
  const flood = (seed: number, ticks: number) => {
    const scene = duel(seed, 'sheet_leviathan', 6);
    // Um tick para ele notar o jogador (o portao de repouso), e so entao a
    // pressao: a carta e uma resposta a um encontro em curso.
    stepRun(scene.state, [emptyCommand()]);
    scene.boss.hp = scene.boss.maxHp * (DELUGE_HP_FRACTION - 0.05);
    for (let t = 0; t < ticks; t++) {
      stepRun(scene.state, [emptyCommand()]);
      scene.state.player.hp = scene.state.player.maxHp;
    }
    return scene;
  };

  it('acima do limiar ele NAO levanta o lencol', () => {
    const { state, boss } = duel(620, 'sheet_leviathan', 6);
    boss.hp = boss.maxHp;
    for (let t = 0; t < 300; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.bossRuntime.delugeAt, 'inundou com o chefe inteiro').toBeLessThan(0);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_DELUGE).toBe(0);
  });

  it('sob pressao ele sobe UMA vez, e nao volta atras', () => {
    const { state, boss } = flood(621, DELUGE_WINDUP_TICKS + 20);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_DELUGE, 'a carta nao saiu').not.toBe(0);
    const at = state.bossRuntime.delugeAt;
    expect(at, 'a subida nao foi agendada').toBeGreaterThanOrEqual(0);
    // Curado de volta ao topo: uma fase de uma vez nao desfaz.
    boss.hp = boss.maxHp;
    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.bossRuntime.delugeAt, 'a carta foi relancada').toBe(at);
  });

  it('a lamina VIAJA: perto submerge antes de longe', () => {
    const { state } = flood(622, DELUGE_WINDUP_TICKS + 5);
    const w = state.config.width;
    const cx = Math.floor(state.bossRuntime.delugeX);
    const cy = Math.floor(state.bossRuntime.delugeY);
    const near = cy * w + cx + 1;
    const far = cy * w + cx + 12;
    expect(isDeluged(state, near), 'nem o proprio pe dele submergiu').toBe(true);
    expect(isDeluged(state, far), 'o outro lado da camara submergiu junto').toBe(false);
    for (let t = 0; t < 60; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(isDeluged(state, far), 'a frente nunca chegou la').toBe(true);
  });

  it('rocha NAO submerge: a lamina sobe pelos vaos', () => {
    // E o que impede o Diluvio de virar um condutor que atravessa parede: o
    // espaco submerso e o mesmo espaco aberto por onde a corrente ja andava.
    const { state, px, py } = flood(623, DELUGE_WINDUP_TICKS + 120);
    const w = state.config.width;
    const rock = py * w + px + 2;
    state.solid[rock] = SOLID_ROCK;
    expect(isDeluged(state, rock), 'a agua entrou no macico').toBe(false);
    expect(isDeluged(state, py * w + px + 3), 'o vao ao lado ficou seco').toBe(true);
  });

  it('depois do Diluvio ele emerge onde ANTES era chao seco', () => {
    // A virada do encontro numa frase: a camara comeca seca, e a carta unica
    // dele apaga a unica coisa que o segurava.
    const { state, boss, px, py } = duel(624, 'sheet_leviathan', 6);
    const w = state.config.width;
    expect(isConductiveSurface(state.surface[py * w + px]), 'a camara ja comecou molhada').toBe(
      false,
    );
    stepRun(state, [emptyCommand()]);
    boss.hp = boss.maxHp * (DELUGE_HP_FRACTION - 0.05);
    let breached = false;
    for (let t = 0; t < 600 && !breached; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'erupt')
          breached = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(breached, 'o lencol subiu e ele continuou sem poder emergir').toBe(true);
  });

  it('a lamina APAGA o fogo que atravessa', () => {
    // O Diluvio nao grava superficie — o material de baixo continua inteiro —,
    // mas fogo debaixo d'agua e uma promessa que a materia nao sustenta. E o
    // custo real da carta para o jogador: quem estava usando fogo perde o fogo.
    const { state, px, py } = duel(625, 'sheet_leviathan', 6);
    const w = state.config.width;
    stepRun(state, [emptyCommand()]);
    state.enemies[0].hp = state.enemies[0].maxHp * (DELUGE_HP_FRACTION - 0.05);
    const burning = py * w + px + 1;
    for (let t = 0; t < DELUGE_WINDUP_TICKS + 120 && !isDeluged(state, burning); t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(isDeluged(state, burning), 'a lamina nunca chegou a celula').toBe(true);
    // Acende DEBAIXO do lencol, pelo caminho normal (a fila de reacao), e da
    // tempo de `stepCells` visitar a celula: a regra nao e "a frente apagou ao
    // passar", e "submerso nao queima" — fogo novo tambem nao pega.
    setSurface(state, burning, SURF_FIRE, 400);
    for (let t = 0; t < 12; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.surface[burning], 'a chama sobreviveu debaixo do lencol').not.toBe(SURF_FIRE);
  });

  it('NAO retarda o jogador: a arena vira dele por alcance, nao por atrito', () => {
    // Decisao de desenho, e ela merece uma trava. Um retardo permanente no setor
    // inteiro pesaria em cada esquiva pelo resto do encontro, e nao ha mais chao
    // seco para onde sair e recuperar a mobilidade.
    const { state, px, py } = flood(626, DELUGE_WINDUP_TICKS + 120);
    const w = state.config.width;
    const cell = py * w + px;
    expect(isDeluged(state, cell), 'o jogador nem chegou a submergir').toBe(true);
    // Limpa a superficie REAL debaixo dele: a enchente incremental pinta agua
    // de verdade, e agua de verdade retarda. O que esta sob teste e o Diluvio,
    // que nao e uma superficie e nao pode retardar ninguem.
    state.surface[cell] = SURF_NONE;
    state.surfaceTimer[cell] = 0;
    expect(isDeluged(state, cell), 'limpar a superficie desfez o Diluvio').toBe(true);
    expect(surfaceSpeedMul(state, state.player), 'o Diluvio esta arrastando o jogador').toBe(1);
  });

  it('a CORRENTE atenua com a distancia: perto cobra mais que longe', () => {
    // A outra metade da carta. Quem alaga o setor inteiro entrega um condutor do
    // tamanho do setor inteiro — e sem atenuacao isso seria um botao de vitoria
    // nos dois sentidos, com uma descarga solta em qualquer canto cobrando
    // integral de tudo o que estivesse na lamina.
    const hurt = (gap: number): number => {
      const { state, px, py } = flood(627 + gap, DELUGE_WINDUP_TICKS + 200);
      state.player.x = px + 0.5;
      state.player.y = py + 0.5;
      expect(isDeluged(state, py * state.config.width + px)).toBe(true);
      const events: SemanticEvent[] = [];
      dischargeAt(state, px + gap, py, events, { source: 'environment' });
      const before = state.player.hp;
      resolveChainedEvents(state, events);
      return before - state.player.hp;
    };
    const close = hurt(1);
    const far = hurt(9);
    expect(close, 'a descarga nao chegou nem de perto').toBeGreaterThan(0);
    expect(far, 'a corrente nao alcancou longe: ela deve alcancar, e nao machucar').toBeGreaterThan(
      0,
    );
    expect(far, `perto ${close.toFixed(1)} vs longe ${far.toFixed(1)}`).toBeLessThan(close * 0.5);
  });
});

describe('Os DUTOS do Aquifero — as fontes do Diluvio', () => {
  it('so o Aquifero tem cano, e ele nasce virado para o VAO', () => {
    // Eles sao infraestrutura de um lugar que bombeava agua e perdeu a briga.
    // Num estrato que nunca teve bomba, um duto na parede seria cenario mentindo.
    const aquifer = generateWorld(
      404,
      WORLD_W,
      WORLD_H,
      biomeProfile({ stratum: 'aquifer', occupation: 'none', lineage: 'hydric' }, 3),
    );
    expect(aquifer, 'a geracao falhou').not.toBeNull();
    const pipes: number[] = [];
    for (let i = 0; i < aquifer!.solid.length; i++) if (isPipe(aquifer!.solid[i])) pipes.push(i);
    expect(pipes.length, 'o Aquifero nasceu sem duto nenhum').toBeGreaterThan(0);
    for (const i of pipes) {
      const [dx, dy] = PIPE_MOUTH[aquifer!.solid[i]];
      const mouth = (Math.floor(i / WORLD_W) + dy) * WORLD_W + ((i % WORLD_W) + dx);
      expect(aquifer!.solid[mouth], `duto ${i} despeja contra rocha`).toBe(SOLID_NONE);
    }

    const basalt = generateWorld(
      404,
      WORLD_W,
      WORLD_H,
      biomeProfile({ stratum: 'basalt', occupation: 'none', lineage: 'basaltic' }, 3),
    );
    expect(
      basalt!.solid.some((v) => isPipe(v)),
      'o basalto ganhou encanamento',
    ).toBe(false);
  });

  it('o duto nao cede: nem quebra nem e arrancado', () => {
    // Um tubo de aco de dois metros nao cai a um bolt de plasma. Isto tambem
    // garante que ele nunca vira uma parede que o jogador precise aprender a
    // furar: ate o Diluvio ele e cenario.
    const { state, px, py } = duel(640, 'sheet_leviathan', 6);
    const w = state.config.width;
    const cell = py * w + px + 4;
    state.solid[cell] = SOLID_PIPE_W;
    expect(breakSolid(state, px + 4, py, []), 'o duto quebrou').toBe(false);
    expect(canRip(state, px + 4, py), 'o duto foi arrancado').toBe(false);
    expect(state.solid[cell]).toBe(SOLID_PIPE_W);
  });

  it('a agua entra pelas BOCAS, e nao do corpo do chefe', () => {
    // A leitura inteira do Diluvio depende disto: "os dutos estao enchendo a
    // sala" so acontece se as fontes forem os dutos. Com o chefe como unica
    // fonte, a inundacao voltaria a ser um circulo crescendo no meio da camara.
    const { state, boss, px, py } = duel(641, 'sheet_leviathan', 6);
    const w = state.config.width;
    // Um duto na borda oeste da arena, longe do chefe (que esta a leste).
    const pipeX = px - 14;
    state.solid[py * w + pipeX] = SOLID_PIPE_E;
    stepRun(state, [emptyCommand()]);
    boss.hp = boss.maxHp * (DELUGE_HP_FRACTION - 0.05);
    for (let t = 0; t < DELUGE_WINDUP_TICKS + 4; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    // A boca do duto ja molhou, mesmo estando a vinte tiles do chefe.
    expect(isDeluged(state, py * w + pipeX + 1), 'a boca do duto ficou seca').toBe(true);
  });

  it('parede DELIMITA o canal: sala selada nao enche', () => {
    // "O Diluvio so se aplica ao solo, e paredes delimitam canais." Um circulo
    // diria que uma sala selada do outro lado da rocha enche junto porque esta
    // perto; a agua andando pelos vaos diz que ela enche quando encontra o
    // caminho, ou nunca.
    const { state, boss, px, py } = duel(642, 'sheet_leviathan', 6);
    const w = state.config.width;
    // Uma caixa fechada de rocha, com uma celula oca dentro, ao lado do chefe.
    const roomX = px - 6;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        state.solid[(py + dy) * w + roomX + dx] = SOLID_ROCK;
      }
    }
    const sealed = py * w + roomX;
    state.solid[sealed] = SOLID_NONE;
    stepRun(state, [emptyCommand()]);
    boss.hp = boss.maxHp * (DELUGE_HP_FRACTION - 0.05);
    for (let t = 0; t < DELUGE_WINDUP_TICKS + 400; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    // O lado de fora, colado na caixa, submergiu ha muito tempo.
    expect(isDeluged(state, py * w + roomX + 2), 'nem o lado de fora encheu').toBe(true);
    expect(isDeluged(state, sealed), 'a agua atravessou a rocha').toBe(false);
  });
});
