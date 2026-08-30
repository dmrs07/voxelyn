import { describe, expect, it } from 'vitest';
import {
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  MINIGUN_AMMO,
  MINIGUN_DAMAGE,
  MINIGUN_BURST_EVENT_TICKS,
  MINIGUN_HEAT_PER_SHOT,
  MINIGUN_RATE_MAX_MILLI,
  MINIGUN_RATE_MIN_MILLI,
  MINIGUN_SHOT_MILLI,
  MINIGUN_SPIN_DOWN_PER_TICK,
  MINIGUN_SPIN_FIRE_AT,
  MINIGUN_SPIN_MAX,
  MINIGUN_SPIN_UP_PER_TICK,
  SOLID_NONE,
  SURF_NONE,
  TICK_HZ,
} from '../src/constants';
import {
  minigunDrainAccumulator,
  minigunJitter,
  minigunNextSpin,
  minigunPhaseFor,
  minigunRateMilli,
  minigunSpread,
} from '../src/minigun';
import { ARCHETYPES } from '../src/entities';
import {
  MODULE_DEFINITIONS,
  activeWeaponModule,
  grantOrRechargeModule,
  rollModuleChoice,
} from '../src/modules';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';

// A MINIGUN, conferida pelo que ela PROMETE: nenhuma bala antes da rotacao
// operacional, cadencia que nao depende de quadro, exatamente 300 balas, calor
// que forca pausas, e uma expiracao que sai uma vez so.

const clearArena = (state: SurvivalState, cx = 40, cy = 40, radius = 16): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  state.player.x = cx + 0.5;
  state.player.y = cy + 0.5;
  state.player.hp = state.player.maxHp;
  state.playerExtra.heat = 0;
  state.playerExtra.overheatedUntil = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const i = y * state.config.width + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
};

/** Uma run com a Minigun instalada, numa sala vazia, com a mira para a direita. */
const armed = (seed = 4242): SurvivalState => {
  const state = createRun({ seed });
  clearArena(state);
  grantOrRechargeModule(state.playerExtra, 'minigun', state.tick);
  state.playerExtra.aim = { x: 1, y: 0 };
  return state;
};

const fire = (aim = { x: 1, y: 0 }): PlayerCommand => ({
  ...emptyCommand(),
  fire: true,
  aim,
});

const idle = (): PlayerCommand => ({ ...emptyCommand(), aim: { x: 1, y: 0 } });

/**
 * Roda `ticks` e devolve TODOS os eventos, mantendo a sala limpa de projeteis.
 *
 * A limpeza por tick e o que permite contar balas por evento sem que o teto de
 * `MAX_PROJECTILES` interfira: o que esta sob teste e a cadencia, nao a lotacao
 * do mundo. Os testes que precisam do teto o dizem explicitamente.
 */
const run = (
  state: SurvivalState,
  ticks: number,
  cmd: () => PlayerCommand,
  drain = true,
): SemanticEvent[] => {
  const all: SemanticEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const { events } = stepRun(state, [cmd()]);
    all.push(...events);
    if (drain) state.projectiles = state.projectiles.filter((p) => p.kind !== 'flechette');
  }
  return all;
};

const roundsIn = (events: readonly SemanticEvent[]): number =>
  events.reduce((sum, ev) => (ev.t === 'minigun_burst' ? sum + ev.rounds : sum), 0);

describe('minigun — aritmetica da rotacao e da cadencia', () => {
  it('sobe em 14 ticks e desce em 10, sem passar dos limites', () => {
    let spin = 0;
    let ticks = 0;
    while (spin < MINIGUN_SPIN_MAX) {
      spin = minigunNextSpin(spin, true);
      ticks++;
      expect(spin).toBeLessThanOrEqual(MINIGUN_SPIN_MAX);
    }
    // 0,6 a 0,8 s a 20 Hz.
    expect(ticks).toBe(Math.ceil(MINIGUN_SPIN_MAX / MINIGUN_SPIN_UP_PER_TICK));
    expect(ticks / TICK_HZ).toBeGreaterThanOrEqual(0.6);
    expect(ticks / TICK_HZ).toBeLessThanOrEqual(0.8);

    let down = 0;
    while (spin > 0) {
      spin = minigunNextSpin(spin, false);
      down++;
      expect(spin).toBeGreaterThanOrEqual(0);
    }
    expect(down).toBe(Math.ceil(MINIGUN_SPIN_MAX / MINIGUN_SPIN_DOWN_PER_TICK));
  });

  it('a fase e uma funcao TOTAL de rotacao/intencao/travamento', () => {
    expect(minigunPhaseFor(0, false, false)).toBe('idle');
    expect(minigunPhaseFor(0, true, false)).toBe('spinning_up');
    expect(minigunPhaseFor(MINIGUN_SPIN_FIRE_AT - 1, true, false)).toBe('spinning_up');
    expect(minigunPhaseFor(MINIGUN_SPIN_FIRE_AT, true, false)).toBe('firing');
    expect(minigunPhaseFor(500, false, false)).toBe('spinning_down');
    // Superaquecido vence tudo, inclusive rotacao cheia com gatilho apertado.
    expect(minigunPhaseFor(MINIGUN_SPIN_MAX, true, true)).toBe('overheated');
  });

  it('cadencia zero abaixo do limiar e 8..16 tiros/s acima dele', () => {
    expect(minigunRateMilli(MINIGUN_SPIN_FIRE_AT - 1)).toBe(0);
    expect(minigunRateMilli(MINIGUN_SPIN_FIRE_AT)).toBe(MINIGUN_RATE_MIN_MILLI);
    expect(minigunRateMilli(MINIGUN_SPIN_MAX)).toBe(MINIGUN_RATE_MAX_MILLI);
    const shotsPerSecond = (MINIGUN_RATE_MAX_MILLI / MINIGUN_SHOT_MILLI) * TICK_HZ;
    expect(shotsPerSecond).toBeGreaterThanOrEqual(15);
    expect(shotsPerSecond).toBeLessThanOrEqual(20);
  });

  it('o acumulador entrega a cadencia exata, sem perder fracao', () => {
    let accum = 0;
    let shots = 0;
    for (let i = 0; i < TICK_HZ; i++) {
      const drained = minigunDrainAccumulator(accum, MINIGUN_RATE_MAX_MILLI, 4);
      accum = drained.accum;
      shots += drained.shots;
    }
    expect(shots).toBe((MINIGUN_RATE_MAX_MILLI * TICK_HZ) / MINIGUN_SHOT_MILLI);
  });

  it('a dispersao cresce com o calor e o desvio e deterministico', () => {
    expect(minigunSpread(0)).toBeLessThan(minigunSpread(1));
    expect(minigunSpread(-5)).toBe(minigunSpread(0));
    expect(minigunSpread(9)).toBe(minigunSpread(1));
    expect(minigunJitter(120, 0, 0)).toBe(minigunJitter(120, 0, 0));
    expect(minigunJitter(120, 0, 0)).not.toBe(minigunJitter(121, 0, 0));
    for (const t of [0, 7, 33, 4001]) {
      expect(Math.abs(minigunJitter(t, 1, 2))).toBeLessThanOrEqual(1);
    }
  });
});

describe('minigun — maquina de estados na simulacao', () => {
  it('nenhum projetil sai antes de a rotacao cruzar o limiar', () => {
    const state = armed();
    const spinUpTicks = Math.ceil(MINIGUN_SPIN_FIRE_AT / MINIGUN_SPIN_UP_PER_TICK);
    for (let i = 0; i < spinUpTicks - 1; i++) {
      stepRun(state, [fire()]);
      expect(state.projectiles.filter((p) => p.kind === 'flechette')).toHaveLength(0);
      expect(state.playerExtra.minigun.phase).toBe('spinning_up');
    }
    // O tick em que a rotacao chega ao limiar E o tick da primeira bala: o
    // acumulador e semeado para nao haver um tick morto entre os dois.
    stepRun(state, [fire()]);
    expect(state.playerExtra.minigun.phase).toBe('firing');
    expect(state.projectiles.filter((p) => p.kind === 'flechette')).toHaveLength(1);
  });

  it('publica minigun_spin so na TRANSICAO de fase', () => {
    const state = armed();
    const events = run(state, 20, fire);
    const phases = events.filter((ev) => ev.t === 'minigun_spin');
    expect(phases.map((ev) => (ev.t === 'minigun_spin' ? ev.phase : ''))).toEqual([
      'spinning_up',
      'firing',
    ]);
  });

  it('soltar o gatilho interrompe os tiros e inicia o spin-down', () => {
    const state = armed();
    run(state, 20, fire);
    expect(state.playerExtra.minigun.phase).toBe('firing');
    const before = state.playerExtra.minigun.spin;
    const events = run(state, 1, idle);
    expect(state.playerExtra.minigun.phase).toBe('spinning_down');
    expect(state.playerExtra.minigun.spin).toBeLessThan(before);
    expect(roundsIn(events)).toBe(0);
  });

  it('reapertar durante o spin-down volta a atirar mais rapido que do zero', () => {
    const cold = armed(11);
    let coldTicks = 0;
    while (cold.playerExtra.minigun.phase !== 'firing') {
      stepRun(cold, [fire()]);
      coldTicks++;
    }

    const warm = armed(11);
    run(warm, 20, fire); // ja esta na rotacao cheia
    run(warm, 2, idle); // dois ticks de spin-down: sobra rotacao
    expect(warm.playerExtra.minigun.spin).toBeGreaterThan(0);
    let warmTicks = 0;
    while (warm.playerExtra.minigun.phase !== 'firing') {
      stepRun(warm, [fire()]);
      warmTicks++;
    }
    expect(warmTicks).toBeLessThan(coldTicks);
  });

  it('a mesma cadencia sai em qualquer agrupamento de ticks', () => {
    const perTick = armed(77);
    const evA = run(perTick, 40, fire);

    const inBatches = armed(77);
    const evB: SemanticEvent[] = [];
    for (let batch = 0; batch < 5; batch++) {
      for (let i = 0; i < 8; i++) {
        const { events } = stepRun(inBatches, [fire()]);
        evB.push(...events);
        inBatches.projectiles = inBatches.projectiles.filter((p) => p.kind !== 'flechette');
      }
    }
    expect(roundsIn(evB)).toBe(roundsIn(evA));
    expect(hashAuthoritativeState(inBatches)).toBe(hashAuthoritativeState(perTick));
  });

  it('o gatilho batido entre ticks nao inventa nem perde balas', () => {
    // Um tick de fogo e um de solto, alternados: a rotacao oscila em volta do
    // limiar e a arma dispara MENOS que a sustentada — que e exatamente a
    // fraqueza que o design pede para "toques curtos no gatilho".
    const tapped = armed(5);
    let taps = 0;
    for (let i = 0; i < 60; i++) {
      const { events } = stepRun(tapped, [i % 2 === 0 ? fire() : idle()]);
      taps += roundsIn(events);
      tapped.projectiles = tapped.projectiles.filter((p) => p.kind !== 'flechette');
    }
    const held = roundsIn(run(armed(5), 60, fire));
    expect(taps).toBeLessThan(held);
    expect(taps + tapped.playerExtra.minigun.pendingRounds).toBe(MINIGUN_AMMO - remaining(tapped));
  });
});

/** Municao restante do cartucho, ou 0 quando ele ja foi ejetado. */
const remaining = (state: SurvivalState): number => {
  const module = state.playerExtra.activeModules.find((m) => m.id === 'minigun');
  if (!module || module.lifetime.kind !== 'charges') return 0;
  return module.lifetime.remaining;
};

describe('minigun — municao, calor e expiracao', () => {
  it('o cartucho vale exatamente 300 balas', () => {
    expect(MODULE_DEFINITIONS.minigun.defaultCharges).toBe(MINIGUN_AMMO);
    expect(MINIGUN_AMMO).toBe(300);
  });

  it('gasta exatamente 300 municoes e expira UMA vez', () => {
    const state = armed(909);
    const events: SemanticEvent[] = [];
    // Calor desligado: o que esta sob teste e a CONTAGEM, e o travamento so
    // faria o laco levar tres vezes mais ticks para chegar ao mesmo lugar.
    for (let i = 0; i < 4000 && remaining(state) > 0; i++) {
      state.playerExtra.heat = 0;
      state.playerExtra.overheatedUntil = 0;
      const { events: tick } = stepRun(state, [fire()]);
      events.push(...tick);
      state.projectiles = state.projectiles.filter((p) => p.kind !== 'flechette');
    }
    // `pendingRounds` e a janela ainda nao publicada; somada da o total.
    expect(roundsIn(events) + state.playerExtra.minigun.pendingRounds).toBe(MINIGUN_AMMO);

    const expired = events.filter((ev) => ev.t === 'module_expired' && ev.module === 'minigun');
    expect(expired).toHaveLength(1);
    expect(state.playerExtra.activeModules.some((m) => m.id === 'minigun')).toBe(false);

    // Nenhum `module_charge_consumed` da Minigun: a cadencia inteira e muda no
    // wire, e o contador da HUD sai do `ViewerState`.
    expect(
      events.filter((ev) => ev.t === 'module_charge_consumed' && ev.module === 'minigun'),
    ).toHaveLength(0);
  });

  it('nao dispara mais nada depois de expirar', () => {
    const state = armed(31);
    for (let i = 0; i < 4000 && remaining(state) > 0; i++) {
      state.playerExtra.heat = 0;
      state.playerExtra.overheatedUntil = 0;
      stepRun(state, [fire()]);
      state.projectiles = state.projectiles.filter((p) => p.kind !== 'flechette');
    }
    state.projectiles = [];
    const after = run(state, 30, fire);
    expect(roundsIn(after)).toBe(0);
    expect(state.projectiles.filter((p) => p.kind === 'flechette')).toHaveLength(0);
    expect(activeWeaponModule(state.playerExtra, state.tick)).toBeUndefined();
    // Os canos desaceleram ate parar depois da ultima bala.
    expect(state.playerExtra.minigun.spin).toBe(0);
    expect(state.playerExtra.minigun.phase).toBe('idle');
  });

  it('o tiro comum volta no tick seguinte a expiracao', () => {
    const state = armed(58);
    for (let i = 0; i < 4000 && remaining(state) > 0; i++) {
      state.playerExtra.heat = 0;
      state.playerExtra.overheatedUntil = 0;
      stepRun(state, [fire()]);
      state.projectiles = state.projectiles.filter((p) => p.kind !== 'flechette');
    }
    state.projectiles = [];
    state.playerExtra.heat = 0;
    state.playerExtra.overheatedUntil = 0;
    state.playerExtra.nextShotAt = 0;
    run(state, 12, fire, false);
    expect(state.projectiles.some((p) => p.kind === 'bolt')).toBe(true);
  });

  it('o calor forca pausas: as 300 balas nao saem numa sustentada so', () => {
    const state = armed(1234);
    let overheats = 0;
    const events: SemanticEvent[] = [];
    for (let i = 0; i < 4000 && remaining(state) > 0; i++) {
      const { events: tick } = stepRun(state, [fire()]);
      events.push(...tick);
      overheats += tick.filter((ev) => ev.t === 'overheat').length;
      state.projectiles = state.projectiles.filter((p) => p.kind !== 'flechette');
      // Vida infinita: o dano de superaquecimento nao pode matar o teste.
      state.player.hp = state.player.maxHp;
    }
    expect(overheats).toBeGreaterThanOrEqual(2);
    expect(roundsIn(events) + state.playerExtra.minigun.pendingRounds).toBe(MINIGUN_AMMO);
  });

  it('o superaquecimento interrompe a rajada e a recuperacao usa o limiar existente', () => {
    const state = armed(64);
    run(state, 20, fire);
    expect(state.playerExtra.minigun.phase).toBe('firing');
    // Empurra o calor ate a borda: o proximo tiro estoura. Meio ponto abaixo
    // do teto, e nao "um tiro abaixo": o decaimento do tick roda ANTES do
    // disparo, entao o saldo real de uma bala e menor que o calor dela.
    expect(MINIGUN_HEAT_PER_SHOT).toBeGreaterThan(state.config.tuning.heatDecayPerTick);
    state.playerExtra.heat = state.config.tuning.heatMax - 0.5;
    state.player.hp = state.player.maxHp;
    // Ate cinco ticks: a 800 milesimos por tick o acumulador pula um tick a
    // cada cinco, entao "o proximo tick" nao e necessariamente o proximo tiro.
    const locked: SemanticEvent[] = [];
    for (let i = 0; i < 5 && state.tick >= state.playerExtra.overheatedUntil; i++) {
      locked.push(...run(state, 1, fire));
      state.player.hp = state.player.maxHp;
    }
    expect(locked.some((ev) => ev.t === 'overheat')).toBe(true);
    expect(state.playerExtra.minigun.phase).toBe('overheated');
    expect(state.tick).toBeLessThan(state.playerExtra.overheatedUntil);

    // Enquanto travado nao sai bala, por mais que o gatilho fique apertado. A
    // conta e feita na MUNICAO e nao nos eventos: a janela de rajada que ja
    // estava aberta antes do travamento ainda e publicada dentro dele, e ela
    // descreve balas que sairam antes — o `minigun_burst` e um recibo
    // agregado, nunca a autorizacao de um tiro.
    const ammoAtLock = remaining(state);
    run(state, state.playerExtra.overheatedUntil - state.tick, fire);
    expect(remaining(state)).toBe(ammoAtLock);
    // O travamento JOGA FORA a rotacao: sao 36 ticks de trava contra 10 de
    // desaceleracao completa, entao quem sai dele volta abaixo do limiar
    // operacional e paga o spin-up inteiro de novo.
    expect(state.playerExtra.minigun.spin).toBeLessThan(MINIGUN_SPIN_FIRE_AT);

    // Solto o travamento, o ciclo recomeca pelo spin-up — segurar o gatilho
    // durante o travamento nao guarda rotacao nenhuma.
    const after = run(state, 20, fire);
    expect(roundsIn(after)).toBeGreaterThan(0);
  });
});

describe('minigun — projetil, dano acumulado e compatibilidade', () => {
  it('a bala e pequena, rapida e fraca perto do bolt', () => {
    const state = armed(17);
    run(state, 20, fire, false);
    const round = state.projectiles.find((p) => p.kind === 'flechette');
    expect(round).toBeDefined();
    if (!round) return;
    expect(Math.hypot(round.vx, round.vy)).toBeGreaterThan(18);
    expect(round.radius).toBeLessThan(0.2);
    expect(round.damage).toBeLessThan(7);
    // Sem modulos herdados: a matriz de compatibilidade acontece aqui.
    expect(round.modules).toBeUndefined();
  });

  it('nenhum modulo ofensivo viaja na bala, e as cargas deles ficam intactas', () => {
    const state = armed(19);
    for (const id of ['piercing', 'explosive', 'ricochet', 'conductive', 'siphon'] as const) {
      grantOrRechargeModule(state.playerExtra, id, state.tick);
    }
    run(state, 24, fire, false);
    const rounds = state.projectiles.filter((p) => p.kind === 'flechette');
    expect(rounds.length).toBeGreaterThan(0);
    for (const round of rounds) expect(round.modules).toBeUndefined();
    // Nem disco: enquanto a Minigun tem municao, ela E o gatilho.
    expect(state.projectiles.some((p) => p.kind === 'return_disc')).toBe(false);
    for (const id of ['piercing', 'explosive', 'ricochet', 'conductive', 'siphon'] as const) {
      const module = state.playerExtra.activeModules.find((m) => m.id === id);
      expect(module?.lifetime.kind === 'charges' && module.lifetime.remaining).toBe(
        MODULE_DEFINITIONS[id].defaultCharges,
      );
    }
  });

  it('o disco de retorno cede o gatilho para a Minigun e o retoma na expiracao', () => {
    const state = armed(23);
    grantOrRechargeModule(state.playerExtra, 'return_disc', state.tick);
    expect(activeWeaponModule(state.playerExtra, state.tick)).toBe('minigun');
    run(state, 24, fire, false);
    expect(state.projectiles.some((p) => p.kind === 'return_disc')).toBe(false);

    // Cartucho esvaziado a mao: o disco volta a ser a arma.
    state.playerExtra.activeModules = state.playerExtra.activeModules.filter(
      (m) => m.id !== 'minigun',
    );
    state.projectiles = [];
    state.playerExtra.heat = 0;
    state.playerExtra.overheatedUntil = 0;
    state.playerExtra.nextShotAt = 0;
    run(state, 12, fire, false);
    expect(state.projectiles.some((p) => p.kind === 'return_disc')).toBe(true);
  });

  it('uma rajada sustentada acumula muito mais dano que o tiro comum', () => {
    const ticks = 60; // tres segundos
    const minigunState = armed(88);
    const minigunDamage = run(minigunState, ticks, fire, false)
      .filter((ev) => ev.t === 'minigun_burst')
      .reduce((sum, ev) => sum + (ev.t === 'minigun_burst' ? ev.rounds : 0), 0);
    const perRound = minigunState.projectiles.find((p) => p.kind === 'flechette')?.damage ?? 0;

    const boltState = createRun({ seed: 88 });
    clearArena(boltState);
    boltState.playerExtra.aim = { x: 1, y: 0 };
    run(boltState, ticks, fire, false);
    const bolts = boltState.projectiles.filter((p) => p.kind === 'bolt');
    const boltDamage = bolts.length * (bolts[0]?.damage ?? 0);

    expect(perRound).toBeLessThan(bolts[0]?.damage ?? Infinity);
    expect(minigunDamage * perRound).toBeGreaterThan(boltDamage * 1.4);
  });

  it('a rajada e publicada AGREGADA, nao uma por bala', () => {
    const state = armed(41);
    const events = run(state, 40, fire);
    const bursts = events.filter((ev) => ev.t === 'minigun_burst');
    expect(bursts.length).toBeGreaterThan(0);
    // Cinco janelas por segundo, no maximo — nunca dezesseis.
    expect(bursts.length).toBeLessThanOrEqual(Math.ceil(40 / MINIGUN_BURST_EVENT_TICKS));
    expect(roundsIn(events)).toBeGreaterThan(bursts.length);
  });
});

describe('minigun — o cofre pode oferece-la', () => {
  it('aparece no pool de classe III e em nenhum abaixo dele', () => {
    const state = createRun({ seed: 7 });
    const tierOf = (tier: 1 | 2 | 3): Set<string> => {
      const seen = new Set<string>();
      for (let site = 0; site < 60; site++) {
        for (const id of rollModuleChoice(state.config.seed, site, tier, state.playerExtra, 0)) {
          seen.add(id);
        }
      }
      return seen;
    };
    expect(tierOf(3).has('minigun')).toBe(true);
    expect(tierOf(2).has('minigun')).toBe(false);
    expect(tierOf(1).has('minigun')).toBe(false);
    expect(MODULE_DEFINITIONS.minigun.tier).toBe(3);
  });

  it('a oferta continua deterministica com o modulo novo no pool', () => {
    const state = createRun({ seed: 7 });
    for (let site = 0; site < 12; site++) {
      const first = rollModuleChoice(state.config.seed, site, 3, state.playerExtra, 0);
      const again = rollModuleChoice(state.config.seed, site, 3, state.playerExtra, 0);
      expect(again).toEqual(first);
      // Nunca duas vezes o mesmo cartucho: o terminal oferece uma ESCOLHA.
      expect(first[0]).not.toBe(first[1]);
    }
  });
});

describe('minigun — determinismo e transicoes', () => {
  it('duas simulacoes da mesma seed e dos mesmos comandos nao divergem', () => {
    const a = armed(4242);
    const b = armed(4242);
    for (let i = 0; i < 120; i++) {
      const cmd = i % 7 === 3 ? idle() : fire();
      stepRun(a, [cmd]);
      stepRun(b, [cmd]);
      expect(hashAuthoritativeState(a), `divergencia no tick ${i}`).toBe(hashAuthoritativeState(b));
    }
  });

  it('o estado do canhao entra no hash autoritativo', () => {
    const a = armed(4242);
    const b = armed(4242);
    run(a, 6, fire);
    run(b, 6, fire);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.playerExtra.minigun.spin += 1;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });
});

// A GRANULARIDADE, que e a conta de balanceamento que o dano por bala carrega.
//
// O DPS da arma e plano: ela vale ~1,5x o tiro comum contra um chefe de 900 e
// contra um bomber de 18 igualmente. O que NAO e plano e o desperdicio. Uma
// arma de dano alto joga fora a sobra em cada alvo fraco; uma de dano baixo
// nao joga. Quando `MINIGUN_DAMAGE` divide EXATAMENTE a vida do inimigo mais
// fraco do jogo, a vantagem contra ele dobra em relacao a que ela tem contra
// todo o resto — e foi isso que aconteceu com o valor de estreia (6, e
// 18 = 3 x 6, zero desperdicado, 2,7x o tiro comum numa fila de bombers).
//
// Este bloco nao trava o numero 5; ele trava a PROPRIEDADE que faz o numero
// prestar. Qualquer mexida futura em dano ou cadencia passa por aqui.
describe('granularidade contra a vida real dos inimigos', () => {
  const BOLT_PERIOD = BOLT_COOLDOWN_TICKS / TICK_HZ;
  const MINIGUN_PERIOD = 1 / ((MINIGUN_RATE_MAX_MILLI / MINIGUN_SHOT_MILLI) * TICK_HZ);

  /**
   * Tempo para derrubar um alvo de `hp` numa FILA — gatilho ja preso, sem
   * reaquisicao. E a medida em que a granularidade aparece: a alternativa
   * (tempo ate a morte de um alvo isolado) e dominada pelo spin-up e esconde
   * exatamente o efeito que interessa.
   *
   * O calor fica de fora de proposito. Ele encurta os DOIS lados na mesma
   * proporcao — e o que se quer aqui e a razao, nao o valor absoluto.
   */
  const boltTime = (hp: number): number => Math.ceil(hp / BOLT_DAMAGE) * BOLT_PERIOD;
  const minigunTime = (hp: number): number => Math.ceil(hp / MINIGUN_DAMAGE) * MINIGUN_PERIOD;

  const archetypes = Object.entries(ARCHETYPES).filter(([, def]) => def.hp > 0);

  it('a arma vale a pena contra TODO inimigo do jogo', () => {
    // O piso de um tier 3: um modulo que mata mais devagar que a arma padrao
    // nao foi enfraquecido, foi removido — o jogador aprende a nao pega-lo.
    for (const [name, def] of archetypes) {
      const ratio = boltTime(def.hp) / minigunTime(def.hp);
      expect(ratio, `${name} (${def.hp} HP) ficou abaixo do tiro comum`).toBeGreaterThan(1);
    }
  });

  it('nenhum inimigo fraco encaixa redondo demais no dano por bala', () => {
    // O TETO, e o unico numero deste arquivo que veio de medicao e nao de
    // deducao: com dano 6 a fila de bombers dava 2,67x aqui (2,35x medido com
    // calor), contra ~1,5x de todo o resto do bestiario. 2,1 e folgado o
    // bastante para nao brigar com ajuste fino e apertado o bastante para
    // reprovar um encaixe exato na vida do inimigo mais fraco.
    for (const [name, def] of archetypes) {
      const ratio = boltTime(def.hp) / minigunTime(def.hp);
      expect(ratio, `${name} (${def.hp} HP) recebe vantagem desproporcional`).toBeLessThan(2.1);
    }
  });

  it('sobra dano no alvo mais fraco — o encaixe exato e o defeito', () => {
    const weakest = Math.min(...archetypes.map(([, def]) => def.hp));
    expect(weakest % MINIGUN_DAMAGE).not.toBe(0);
  });
});
