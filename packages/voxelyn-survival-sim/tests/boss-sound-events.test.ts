// OS TRES MOMENTOS DE CADA CHEFE, COMO EVENTOS.
//
// O que estes testes protegem: a assinatura sonora de um chefe nao pode ser
// inferida no cliente, entao a simulacao tem de DIZER — preparacao
// (`boss_windup`), execucao (`boss_attack`), consequencia/presenca
// (`boss_state`) e a janela de dano (`boss_vulnerable`) — com o arquetipo e a
// habilidade discriminados. Um chefe que arme um golpe sem `boss_windup` volta
// a soar como um bruiser generico, e ninguem percebe ate o playtest.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import {
  ARCHCANTOR_IDLE_NOTE_INTERVAL_TICKS,
  ARCHCANTOR_PULSE_RADIUS,
  DEVOURER_BURROW_CUE_INTERVAL_TICKS,
  FROST_QUEEN_FREEZE_RADIUS,
  FROST_QUEEN_ICE_RADIUS,
  FURNACE_HEART_CYCLE_TICKS,
  FURNACE_HEART_WAVE_INTERVAL_TICKS,
  FURNACE_HEART_WAVE_WARNING_WAVES,
  LEVIATHAN_CALL_INTERVAL_TICKS,
  LUNG_MATRIX_BREATH_INTERVAL_TICKS,
  LUNG_MATRIX_CYCLE_TICKS,
  LUNG_MATRIX_HOLD_TICKS,
  MAGNETARCH_CYCLE_TICKS,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_ICE,
  SURF_NONE,
  SURF_WATER,
} from '../src/constants';
import { BOSS_PHASE_REACTOR, BOSS_PHASE_SUMMON, type EnemyArchetype } from '../src/types';
import type { SemanticEvent, SurvivalState } from '../src/types';

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

/** Avanca N ticks e devolve TODOS os eventos, com o jogador imortal. */
const advanceCollecting = (state: SurvivalState, ticks: number): SemanticEvent[] => {
  const out: SemanticEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    out.push(...stepRun(state, [emptyCommand()]).events);
    state.player.hp = state.player.maxHp;
  }
  return out;
};

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

/** Anda ate o Pulmao estar EXPELINDO (fase 1 do ciclo). */
const advanceUntilExhaling = (state: SurvivalState): void => {
  for (let t = 0; t < LUNG_MATRIX_CYCLE_TICKS * 2; t++) {
    if (Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2 === 1) return;
    stepRun(state, [emptyCommand()]);
    state.player.hp = state.player.maxHp;
  }
};

const ofType = <T extends SemanticEvent['t']>(
  events: readonly SemanticEvent[],
  t: T,
): Extract<SemanticEvent, { t: T }>[] =>
  events.filter((ev): ev is Extract<SemanticEvent, { t: T }> => ev.t === t);

describe('preparacao e execucao de chefe sao eventos proprios', () => {
  it('a Rainha arma o congelamento com boss_windup e o solta com boss_attack; os Espectros saem como boss_state', () => {
    const { state } = duel(31, 'frost_queen', 3);
    // Agua em volta: o congelamento tem o que refazer, e o gelo que sobra e a
    // couraça (`frostArmored`) — que a primeira leitura NAO pode anunciar.
    paint(state, Math.floor(state.player.x), Math.floor(state.player.y), 8, SURF_WATER);
    const events = advanceCollecting(state, 240);
    const windups = ofType(events, 'boss_windup').filter((e) => e.ability === 'freeze');
    expect(windups.length).toBeGreaterThan(0);
    expect(windups[0].archetype).toBe('frost_queen');
    // O generico continua saindo (o renderer le a pose por ele), e agora diz
    // QUEM: e por `archetype` que o cliente cala o telegrafo generico.
    const starts = ofType(events, 'action_start').filter((e) => e.action === 'freeze');
    expect(starts[0].archetype).toBe('frost_queen');
    expect(windups[0].releaseTick).toBe(starts[0].releaseTick);
    const attacks = ofType(events, 'boss_attack').filter((e) => e.ability === 'freeze');
    expect(attacks.length).toBeGreaterThan(0);
    expect(ofType(events, 'boss_state').some((e) => e.state === 'wraiths')).toBe(true);
  });

  it('o Arquicantor canta com a intensidade da rede, e cada camada que responde e uma ressonancia', () => {
    const { state, boss, w } = duel(32, 'archcantor', 4);
    // Uma fileira de cristais que COMECA dentro do alcance do canto e segue
    // para fora dele, cada um a um passo de cadeia do anterior: a camada
    // zero e o primeiro, e as seguintes so existem por causa dele.
    const bx = Math.floor(boss.x);
    const by = Math.floor(boss.y);
    for (let k = ARCHCANTOR_PULSE_RADIUS - 1; k <= ARCHCANTOR_PULSE_RADIUS + 9; k += 2) {
      state.solid[by * w + bx + k] = SOLID_CRYSTAL;
    }
    const events = advanceCollecting(state, 200);
    const windup = ofType(events, 'boss_windup').find((e) => e.ability === 'song');
    expect(windup).toBeDefined();
    expect(windup?.intensity).toBeGreaterThan(0);
    expect(windup?.intensity).toBeLessThanOrEqual(1);
    const attack = ofType(events, 'boss_attack').find((e) => e.ability === 'song');
    expect(attack?.archetype).toBe('archcantor');
    const resonance = ofType(events, 'boss_state').filter((e) => e.state === 'resonance');
    expect(resonance.length).toBeGreaterThan(0);
    // A camada de fora e a nota mais fraca.
    expect(resonance[resonance.length - 1].intensity).toBeLessThan(1);
    // E a nota isolada do idle existe enquanto ha rede.
    expect(ofType(events, 'boss_state').some((e) => e.state === 'idle_note')).toBe(true);
  });

  it('a decolagem do Devorador e a rompida do Leviata sao a MESMA acao com habilidades diferentes', () => {
    const devourer = duel(33, 'white_devourer', 6);
    const devEvents = advanceCollecting(devourer.state, 200);
    const erupt = ofType(devEvents, 'boss_windup').find((e) => e.archetype === 'white_devourer');
    expect(erupt?.ability).toBe('erupt');

    const leviathan = duel(34, 'sheet_leviathan', 6);
    paint(
      leviathan.state,
      Math.floor(leviathan.state.player.x),
      Math.floor(leviathan.state.player.y),
      12,
      SURF_WATER,
    );
    const levEvents = advanceCollecting(leviathan.state, 200);
    const breach = ofType(levEvents, 'boss_windup').find((e) => e.archetype === 'sheet_leviathan');
    expect(breach?.ability).toBe('breach');
  });
});

describe('presenca e relogio da luta', () => {
  it('o Pulmao anuncia inspirar, segurar e expirar no proprio ciclo', () => {
    const { state } = duel(35, 'lung_matrix', 5);
    const events = advanceCollecting(state, LUNG_MATRIX_CYCLE_TICKS * 2 + 2);
    const moments = ofType(events, 'boss_state').filter((e) => e.archetype === 'lung_matrix');
    expect(moments.some((e) => e.state === 'exhale')).toBe(true);
    expect(moments.some((e) => e.state === 'inhale')).toBe(true);
    expect(moments.some((e) => e.state === 'hold')).toBe(true);
    // O pulmao cheio vem ANTES da expiracao, por HOLD_TICKS, e uma vez so.
    const order = moments.map((e) => e.state).filter((s) => s !== 'wound');
    expect(order.indexOf('hold')).toBeLessThan(order.indexOf('exhale'));
    expect(LUNG_MATRIX_HOLD_TICKS).toBeLessThan(LUNG_MATRIX_CYCLE_TICKS);
  });

  it('a Fornalha abre e fecha a janela, avisa a cunha com 1,8 s e executa a onda', () => {
    const { state } = duel(36, 'furnace_heart', 6);
    const events = advanceCollecting(state, FURNACE_HEART_CYCLE_TICKS * 2 + 2);
    const windows = ofType(events, 'boss_vulnerable').filter(
      (e) => e.archetype === 'furnace_heart',
    );
    expect(windows.some((e) => e.open)).toBe(true);
    expect(windows.some((e) => !e.open)).toBe(true);
    const warnings = ofType(events, 'boss_windup').filter((e) => e.ability === 'wave');
    expect(warnings.length).toBeGreaterThan(0);
    for (const warn of warnings) {
      expect(warn.dx).toBeDefined();
      expect(warn.dy).toBeDefined();
    }
    const waves = ofType(events, 'boss_attack').filter((e) => e.ability === 'wave');
    expect(waves.length).toBeGreaterThan(0);
    // O aviso promete um instante, e uma onda sai nele.
    const lead = FURNACE_HEART_WAVE_WARNING_WAVES * FURNACE_HEART_WAVE_INTERVAL_TICKS;
    expect(lead).toBe(36);
  });

  it('o Magnetarca diz a polaridade que passou a valer, e os dois golpes sao habilidades distintas', () => {
    const { state } = duel(37, 'magnetarch', 2);
    const events = advanceCollecting(state, MAGNETARCH_CYCLE_TICKS * 2 + 2);
    const flips = ofType(events, 'boss_state').filter((e) => e.archetype === 'magnetarch');
    expect(flips.some((e) => e.state === 'repel')).toBe(true);
    expect(flips.some((e) => e.state === 'attract')).toBe(true);
    const attacks = ofType(events, 'boss_attack').filter((e) => e.archetype === 'magnetarch');
    expect(attacks.some((e) => e.ability === 'crush')).toBe(true);
  });

  it('o Leviata submerso chama, espacado, enquanto nao esta carregando', () => {
    const { state } = duel(38, 'sheet_leviathan', 6);
    paint(state, Math.floor(state.player.x), Math.floor(state.player.y), 12, SURF_WATER);
    const events = advanceCollecting(state, LEVIATHAN_CALL_INTERVAL_TICKS * 3);
    const calls = ofType(events, 'boss_state').filter((e) => e.state === 'call');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it('o Devorador cavando e ouvido a cada passo de rota, com a posicao do corpo', () => {
    const { state } = duel(39, 'white_devourer', 9);
    const events = advanceCollecting(state, DEVOURER_BURROW_CUE_INTERVAL_TICKS * 6);
    const burrows = ofType(events, 'boss_state').filter((e) => e.state === 'burrow');
    expect(burrows.length).toBeGreaterThan(0);
    const xs = new Set(burrows.map((e) => e.x.toFixed(2)));
    expect(xs.size).toBeGreaterThan(1);
  });

  it('o Guardiao pisa enquanto anda e range na fase final, que agora tambem e boss_phase', () => {
    const { state, boss } = duel(40, 'guardian', 8);
    const events = advanceCollecting(state, 60);
    expect(ofType(events, 'boss_state').some((e) => e.state === 'step')).toBe(true);
    boss.hp = Math.floor(boss.maxHp * 0.4);
    const late = advanceCollecting(state, 60);
    expect(ofType(late, 'boss_phase').some((e) => e.phase === BOSS_PHASE_SUMMON)).toBe(true);
    expect(ofType(late, 'boss_state').some((e) => e.state === 'strain')).toBe(true);
  });

  it('a broca do Diamandis anuncia OBSTRUCAO uma vez por passagem, nao por celula', () => {
    const { state, px, py, w } = duel(47, 'diamandis', 12);
    // Uma parede de rocha entre os dois: a broca vai ter de abri-la.
    for (let y = py - 4; y <= py + 4; y++) {
      for (let x = px + 5; x <= px + 6; x++) state.solid[y * w + x] = SOLID_ROCK;
    }
    const events = advanceCollecting(state, 320);
    const drills = ofType(events, 'boss_attack').filter((e) => e.ability === 'drill');
    expect(drills.length).toBeGreaterThan(0);
    const obstructions = ofType(events, 'boss_state').filter((e) => e.state === 'obstruction');
    expect(obstructions.length).toBeGreaterThan(0);
    // Dezenas de celulas abertas, UM anuncio por corrida da broca.
    expect(ofType(events, 'break').length).toBeGreaterThan(obstructions.length);
    expect(obstructions.length).toBeLessThanOrEqual(drills.length);
  });

  it('o colapso do reator do Diamandis e uma fase anunciada', () => {
    const { state, boss } = duel(41, 'diamandis', 12);
    boss.hp = Math.floor(boss.maxHp * 0.4);
    const events = advanceCollecting(state, 2);
    expect(ofType(events, 'boss_phase').some((e) => e.phase === BOSS_PHASE_REACTOR)).toBe(true);
  });
});

describe('a janela de dano como transicao', () => {
  it('a Catedral calando e voltando sao um boss_vulnerable cada, e nunca na primeira leitura', () => {
    const { state, boss, w } = duel(42, 'archcantor', 4);
    const idx = (Math.floor(boss.y) + 2) * w + Math.floor(boss.x) + 2;
    state.solid[idx] = SOLID_CRYSTAL;
    expect(ofType(advanceCollecting(state, 2), 'boss_vulnerable')).toEqual([]);
    // O coro cai primeiro, e com o cristal ainda de pe NADA muda: a rede
    // continua respondendo pela outra metade. E a prova de que a transicao mede
    // a Catedral inteira, e nao um dos dois lados dela.
    expect(breakChoir(state), 'a formacao nem chegou a nascer').toBeGreaterThan(0);
    expect(ofType(advanceCollecting(state, 1), 'boss_vulnerable')).toEqual([]);
    state.solid[idx] = SOLID_NONE;
    const silenced = ofType(advanceCollecting(state, 1), 'boss_vulnerable');
    expect(silenced).toHaveLength(1);
    expect(silenced[0]).toMatchObject({ archetype: 'archcantor', open: true });
    state.solid[idx] = SOLID_CRYSTAL;
    const back = ofType(advanceCollecting(state, 1), 'boss_vulnerable');
    expect(back[0]).toMatchObject({ archetype: 'archcantor', open: false });
    expect(ARCHCANTOR_PULSE_RADIUS).toBeGreaterThan(2);
  });

  it('a nota isolada consulta a rede AGORA: o ultimo cristal caindo no mesmo tick nao deixa a nota sair', () => {
    const { state, boss, w } = duel(50, 'archcantor', 4);
    const idx = (Math.floor(boss.y) + 2) * w + Math.floor(boss.x) + 2;
    state.solid[idx] = SOLID_CRYSTAL;
    // Ate a vespera de um tick de nota (o tick processado e `state.tick + 1`).
    for (let t = 0; t < ARCHCANTOR_IDLE_NOTE_INTERVAL_TICKS * 2; t++) {
      if ((state.tick + 1) % ARCHCANTOR_IDLE_NOTE_INTERVAL_TICKS === 0 && state.tick > 0) break;
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.bossRuntime.archcantorSilent).toBe(false);
    // O coro sai de cena antes, para o cristal ser mesmo o ultimo fio da rede.
    breakChoir(state);
    // O cristal some ANTES do tick da nota, com a memoria ainda dizendo "ha rede".
    state.solid[idx] = SOLID_NONE;
    const events = stepRun(state, [emptyCommand()]).events;
    expect(ofType(events, 'boss_state').some((e) => e.state === 'idle_note')).toBe(false);
    expect(
      ofType(events, 'boss_vulnerable').some((e) => e.archetype === 'archcantor' && e.open),
    ).toBe(true);
  });

  it('a couraça da Rainha caindo e um boss_vulnerable, e o tiro absorvido e um armor_hit', () => {
    const { state, boss } = duel(43, 'frost_queen', 3);
    paint(state, Math.floor(boss.x), Math.floor(boss.y), FROST_QUEEN_ICE_RADIUS, SURF_ICE);
    // Primeira leitura: com couraça, e sem anuncio.
    expect(ofType(advanceCollecting(state, 1), 'boss_vulnerable')).toEqual([]);
    const events: SemanticEvent[] = [];
    damageEntity(state, boss, 10, events, { kind: 'player_shot' });
    expect(ofType(events, 'boss_state').some((e) => e.state === 'armor_hit')).toBe(true);
    // Dano por tick do chao nao tilinta: e pressao, nao um tiro engolido.
    const hazard: SemanticEvent[] = [];
    damageEntity(state, boss, 1, hazard, { kind: 'fire' }, true);
    expect(ofType(hazard, 'boss_state')).toEqual([]);
    // O lago derrete: a couraça cai, e isso e uma transicao.
    paint(state, Math.floor(boss.x), Math.floor(boss.y), FROST_QUEEN_ICE_RADIUS + 1, SURF_NONE);
    const thawed = ofType(advanceCollecting(state, 1), 'boss_vulnerable');
    expect(thawed[0]).toMatchObject({ archetype: 'frost_queen', open: true });
    expect(FROST_QUEEN_FREEZE_RADIUS).toBeGreaterThan(0);
  });

  it('a expiracao acesa abre a janela do Pulmao — mas nao em cima da morte dele', () => {
    // Fogo colado na boca durante a expiracao: a queimada de retorno.
    const arm = (seed: number) => {
      const { state, boss, w } = duel(seed, 'lung_matrix', 4);
      advanceUntilExhaling(state);
      paint(state, Math.floor(boss.x), Math.floor(boss.y), 1, SURF_FIRE);
      state.surfaceTimer[Math.floor(boss.y) * w + Math.floor(boss.x)] = 9999;
      return { state, boss };
    };
    const alive = arm(48);
    const opened = ofType(
      advanceCollecting(alive.state, LUNG_MATRIX_BREATH_INTERVAL_TICKS + 1),
      'boss_vulnerable',
    );
    expect(opened.some((e) => e.archetype === 'lung_matrix' && e.open)).toBe(true);

    // Com a vida no fio, a mesma queimada MATA: sai a morte, e nao a janela.
    const dying = arm(49);
    dying.boss.hp = 1;
    const last = advanceCollecting(dying.state, LUNG_MATRIX_BREATH_INTERVAL_TICKS + 1);
    expect(ofType(last, 'death').some((e) => e.archetype === 'lung_matrix')).toBe(true);
    expect(ofType(last, 'boss_vulnerable').some((e) => e.archetype === 'lung_matrix')).toBe(false);
  });

  it('dano no Guardiao e no Pulmao tem voz de corpo, nunca no dano por tick do chao', () => {
    const guardian = duel(44, 'guardian', 3);
    const g: SemanticEvent[] = [];
    damageEntity(guardian.state, guardian.boss, 5, g, { kind: 'player_shot' });
    expect(ofType(g, 'boss_state').some((e) => e.state === 'chip')).toBe(true);
    const gh: SemanticEvent[] = [];
    damageEntity(guardian.state, guardian.boss, 1, gh, { kind: 'fire' }, true);
    expect(ofType(gh, 'boss_state')).toEqual([]);

    const lung = duel(45, 'lung_matrix', 3);
    const l: SemanticEvent[] = [];
    damageEntity(lung.state, lung.boss, 5, l, { kind: 'player_shot' });
    expect(ofType(l, 'boss_state').some((e) => e.state === 'wound')).toBe(true);
  });

  it('o despertar diz QUAL chefe acordou', () => {
    const { state } = duel(46, 'white_devourer', 6);
    state.bossRuntime.awake = false;
    const events = advanceCollecting(state, 40);
    const awake = ofType(events, 'boss_awake');
    expect(awake.length).toBeGreaterThan(0);
    expect(awake[0].archetype).toBe('white_devourer');
  });
});
