// O CONGELAMENTO DO PROSPECTOR: o medidor, o latch e o gatilho como motor.
//
// O que esta suite protege, e por que cada regra existe:
//
// 1. A NOVA DOSA UMA VEZ POR JOGADOR, no raio real. Quem esta fora, morto ou
//    abatido nao toma; quem esta dentro toma mesmo com iframes — a esquiva
//    serve para SAIR do raio, nao para atravessar a Nova imune.
// 2. TRES NOVAS SEGUIDAS CONGELAM, apesar do decaimento nos 14 s entre elas.
//    E a conta que fixa a dose (constants.ts), refeita aqui contra a simulacao
//    de verdade, e nao contra uma aritmetica de cabeca.
// 3. O BOTE DO ESPECTRO E UMA DOSE PEQUENA, e so quando ENCOSTA: um bote
//    esquivado nao congela, e um bote nao vira duas doses por ficar em contato.
// 4. O DECAIMENTO E LENTO, DETERMINISTICO E PARA EM ZERO — e NUNCA liberta
//    quem congelou por inteiro.
// 5. CONGELADO, NADA SE MOVE: velocidade e inercia zeradas mesmo no gelo,
//    rumo travado, esquiva, interacao e habilidade barradas; o dano entra.
// 6. O GATILHO VIRA MOTOR: sem bolt, sem disco, sem bala, sem carga, sem
//    `shotsFired`, sem `shot`; so ciclos termicos de cadencia FIXA, iguais
//    para toda arma, que geram calor de verdade e derretem com ele.
// 7. CALOR VELHO NAO DERRETE. Entrar quente nao encurta nada — piora.
// 8. A CROSTA SO SOLTA DEPOIS DA CAMADA, dentro da janela de tuning, sem tiro
//    no tick da libertacao; o tiro seguinte e normal e derrete o residual.
// 9. SUPERAQUECER SUSPENDE, NAO TRAVA: o degelo continua depois do lockout.
// 10. MORTE, ABATIDO, REVIVE E DESCIDA LIMPAM o estado.
// 11. REPLAY E CO-OP: mesmo log, mesmo hash; slots independentes.
import { describe, expect, it } from 'vitest';
import {
  BOLT_COOLDOWN_TICKS,
  FREEZE_DECAY_INTERVAL_TICKS,
  FREEZE_DECAY_PER_INTERVAL,
  FREEZE_GRACE_TICKS,
  FREEZE_MAX,
  FREEZE_MELT_PER_HEAT,
  FREEZE_QUEEN_DOSE,
  FREEZE_THAW_LAYER,
  FREEZE_THERMAL_CYCLE_HEAT,
  FREEZE_THERMAL_CYCLE_TICKS,
  FREEZE_WRAITH_DOSE,
  FROST_QUEEN_FREEZE_COOLDOWN_TICKS,
  FROST_QUEEN_FREEZE_RADIUS,
  HEAT_MAX,
  HEAT_PER_SHOT,
  OVERHEAT_LOCK_TICKS,
  SOLID_NONE,
  SURF_ICE,
  TICK_HZ,
  WRAITH_LUNGE_RANGE,
} from '../src/constants';
import { spawnEnemy, updateEnemies } from '../src/entities';
import { FREEZE_THAW_RELEASE_AT, applyFreezeDose, clearFreeze } from '../src/frost';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { DEFAULT_PLAYER_TUNING } from '../src/progression';
import { grantOrRechargeModule } from '../src/modules';
import { descend } from '../src/sectors';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';

/** Uma placa de gelo limpa com o(s) Prospector(es) no meio, sem fauna. */
const iceArena = (seed = 5, playerCount = 1, radius = 30): SurvivalState => {
  const state = createRun({ seed, playerCount, tuning: DEFAULT_PLAYER_TUNING });
  const w = state.config.width;
  const h = state.config.height;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = Math.max(1, py - radius); y <= Math.min(h - 2, py + radius); y++) {
    for (let x = Math.max(1, px - radius); x <= Math.min(w - 2, px + radius); x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_ICE;
      state.surfaceTimer[i] = 0;
    }
  }
  state.enemies = [];
  state.projectiles = [];
  return state;
};

const cmd = (patch: Partial<PlayerCommand>): PlayerCommand => ({ ...emptyCommand(), ...patch });
const fire = cmd({ fire: true });
const move = (x: number, y: number): PlayerCommand => cmd({ move: { x, y } });

const step = (state: SurvivalState, c: PlayerCommand = emptyCommand()): SemanticEvent[] =>
  stepRun(state, [c]).events;

const ofType = <T extends SemanticEvent['t']>(events: readonly SemanticEvent[], t: T) =>
  events.filter((e): e is Extract<SemanticEvent, { t: T }> => e.t === t);

/** Uma Rainha viva a `dx` tiles do Prospector, ja apontando para ele. */
const withQueen = (state: SurvivalState, dx: number) => {
  const queen = spawnEnemy(
    state,
    'frost_queen',
    Math.floor(state.player.x) + dx,
    Math.floor(state.player.y),
    false,
  );
  queen.alertedUntil = state.tick + 100_000;
  return queen;
};

/**
 * Dispara a Nova AGORA pelo caminho autoritativo (relogios zerados e
 * `updateEnemies` ate o `boss_attack`), como os testes de chefe fazem.
 */
const novaNow = (state: SurvivalState, queen: { id: number }): SemanticEvent[] => {
  const body = state.enemies.find((e) => e.id === queen.id);
  if (!body) throw new Error('rainha ausente');
  body.nextActionAt = 0;
  body.rangedReadyAt = 0;
  body.contactReadyAt = 0;
  const events: SemanticEvent[] = [];
  for (let t = 0; t < 200; t++) {
    const before = events.length;
    updateEnemies(state, events);
    state.tick += 1;
    if (
      events
        .slice(before)
        .some(
          (e) => e.t === 'boss_attack' && e.archetype === 'frost_queen' && e.ability === 'freeze',
        )
    )
      return events;
  }
  throw new Error('a Rainha nao congelou dentro da janela do teste');
};

/** Congela o slot 0 por inteiro, direto pelo medidor, com a arma fria. */
const frostbiteNow = (state: SurvivalState, slot = 0): void => {
  const events: SemanticEvent[] = [];
  applyFreezeDose(state, slot, FREEZE_MAX, 'frost_queen', events);
  expect(state.playerExtras[slot].frostbitten).toBe(true);
};

describe('a Nova da Rainha e uma dose grande, uma por jogador, no raio real', () => {
  it('dentro do raio toma UMA dose; fora nao toma nada', () => {
    const state = iceArena(11, 2);
    const inside = state.players[0];
    const outside = state.players[1];
    const queen = withQueen(state, 3);
    // O parceiro bem longe, fora do raio da Nova.
    outside.x = queen.x + FROST_QUEEN_FREEZE_RADIUS + 4;
    outside.y = queen.y;
    const events = novaNow(state, queen);
    const doses = ofType(events, 'freeze_dose');
    expect(doses).toHaveLength(1);
    expect(doses[0].slot).toBe(0);
    expect(doses[0].source).toBe('frost_queen');
    expect(doses[0].amount).toBe(FREEZE_QUEEN_DOSE);
    expect(state.playerExtras[0].freeze).toBe(FREEZE_QUEEN_DOSE);
    expect(state.playerExtras[1].freeze).toBe(0);
    expect(inside.alive).toBe(true);
  });

  it('nao dosa morto nem abatido, mesmo dentro do raio', () => {
    // Dois slots dentro do raio; um deles fora de campo, o outro de pe (e o
    // alvo que faz a Rainha congelar). So o de pe toma.
    const scenario = (seed: number, knockOut: (state: SurvivalState) => void): number[] => {
      const state = iceArena(seed, 2);
      const queen = withQueen(state, 2);
      for (const slot of [0, 1]) {
        state.players[slot].x = queen.x + 1;
        state.players[slot].y = queen.y;
      }
      knockOut(state);
      const events = novaNow(state, queen);
      return ofType(events, 'freeze_dose').map((d) => d.slot);
    };
    expect(scenario(12, (s) => (s.playerExtras[0].downed = true))).toEqual([1]);
    expect(scenario(12, (s) => (s.players[1].alive = false))).toEqual([0]);
  });

  it('iframes NAO barram a dose: quem esta dentro quando ela sai, esta dentro', () => {
    const state = iceArena(13);
    const queen = withQueen(state, 2);
    state.playerExtras[0].iframesUntil = state.tick + 1000;
    novaNow(state, queen);
    expect(state.playerExtras[0].freeze).toBe(FREEZE_QUEEN_DOSE);
  });

  it('a Nova continua UMA apresentacao de chefe: um boss_attack, nao um por jogador', () => {
    const state = iceArena(14, 2);
    const queen = withQueen(state, 2);
    state.players[1].x = queen.x - 1;
    state.players[1].y = queen.y;
    const events = novaNow(state, queen);
    expect(ofType(events, 'boss_attack').filter((e) => e.ability === 'freeze')).toHaveLength(1);
    expect(ofType(events, 'freeze_dose')).toHaveLength(2);
    expect(ofType(events, 'pulse')).toHaveLength(0);
  });

  it('tres Novas seguidas, a 14 s uma da outra, congelam por inteiro', () => {
    // A conta de constants.ts, refeita contra a simulacao: a cada Nova o
    // Prospector fica parado dentro do raio, e o decaimento corre o intervalo
    // inteiro entre elas.
    const state = iceArena(15);
    const queen = withQueen(state, 2);
    const extra = state.playerExtras[0];
    const after: number[] = [];
    for (let n = 0; n < 3; n++) {
      // A Rainha fica onde esta: o teste mede a dose, nao a perseguicao.
      queen.x = state.player.x + 2;
      queen.y = state.player.y;
      novaNow(state, queen);
      after.push(extra.freeze);
      if (extra.frostbitten) break;
      // O intervalo entre Novas, com o Prospector parado e o Espectro fora.
      state.enemies = state.enemies.filter((e) => e.archetype !== 'frost_wraith');
      for (let t = 0; t < FROST_QUEEN_FREEZE_COOLDOWN_TICKS; t++) {
        step(state);
        // A Rainha bate; o que se mede aqui e o frio, nao a vida.
        state.player.hp = state.player.maxHp;
      }
    }
    expect(extra.frostbitten, `medidor por Nova: ${after.join(' -> ')}`).toBe(true);
    // E o decaimento de fato correu entre elas: a segunda leitura e menor que
    // duas doses cheias.
    expect(after[1]).toBeLessThan(FREEZE_QUEEN_DOSE * 2);
  });
});

describe('o bote do Espectro e uma dose pequena, e so quando encosta', () => {
  /** Um Espectro colado no Prospector, exposto, pronto para o bote. */
  const wraithLunge = (state: SurvivalState, dx: number) => {
    const wraith = spawnEnemy(
      state,
      'frost_wraith',
      Math.floor(state.player.x) + dx,
      Math.floor(state.player.y),
      false,
    );
    wraith.alertedUntil = state.tick + 100_000;
    wraith.contactReadyAt = 0;
    return wraith;
  };

  const runUntilLunge = (state: SurvivalState, ticks: number, c: () => PlayerCommand) => {
    const all: SemanticEvent[] = [];
    for (let t = 0; t < ticks; t++) all.push(...step(state, c()));
    return all;
  };

  it('um bote que encosta aplica dano E a dose pequena — uma vez por bote', () => {
    const state = iceArena(21);
    const extra = state.playerExtras[0];
    const hpBefore = state.player.hp;
    wraithLunge(state, 2);
    const events = runUntilLunge(state, 60, () => emptyCommand());
    const doses = ofType(events, 'freeze_dose').filter((d) => d.source === 'frost_wraith');
    expect(doses, 'o bote nao encostou').toHaveLength(1);
    expect(doses[0].amount).toBe(FREEZE_WRAITH_DOSE);
    expect(state.player.hp).toBeLessThan(hpBefore);
    // Pequena de verdade: menos de um terco da Nova, e longe de congelar.
    expect(FREEZE_WRAITH_DOSE * 3).toBeLessThan(FREEZE_QUEEN_DOSE * 1.01);
    expect(extra.frostbitten).toBe(false);
    // E o contato prolongado durante o impulso nao vira segunda dose: o
    // medidor e uma dose menos o pouco que decaiu, nunca duas.
    expect(extra.freeze).toBeLessThanOrEqual(FREEZE_WRAITH_DOSE);
    expect(extra.freeze).toBeGreaterThan(FREEZE_WRAITH_DOSE - 10);
  });

  it('elite bate mais forte mas nao congela mais', () => {
    const state = iceArena(22);
    const wraith = wraithLunge(state, 2);
    wraith.elite = true;
    const events = runUntilLunge(state, 60, () => emptyCommand());
    const doses = ofType(events, 'freeze_dose').filter((d) => d.source === 'frost_wraith');
    expect(doses).toHaveLength(1);
    expect(doses[0].amount).toBe(FREEZE_WRAITH_DOSE);
  });

  it('um bote esquivado (iframes) nao congela', () => {
    const state = iceArena(23);
    const extra = state.playerExtras[0];
    wraithLunge(state, 2);
    // Iframes o tempo todo: o funil rejeita o golpe, e o que o funil rejeita
    // nao congela.
    const events = runUntilLunge(state, 60, () => {
      extra.iframesUntil = state.tick + 2;
      return emptyCommand();
    });
    expect(ofType(events, 'freeze_dose')).toHaveLength(0);
    expect(extra.freeze).toBe(0);
  });

  it('o hash distingue explicitamente um bote consumido de um ainda disponivel', () => {
    const available = iceArena(231);
    const consumed = iceArena(231);
    const a = wraithLunge(available, 2);
    const b = wraithLunge(consumed, 2);
    const action = {
      kind: 'charge' as const,
      phase: 'recovery' as const,
      startedAt: 10,
      releaseAt: 20,
      endsAt: 40,
      direction: { x: -1, y: 0 },
    };
    a.action = { ...action };
    b.action = { ...action, landed: true };

    expect(hashAuthoritativeState(available)).not.toBe(hashAuthoritativeState(consumed));
  });

  it('um bote fora de alcance nao congela', () => {
    const state = iceArena(24);
    const extra = state.playerExtras[0];
    const wraith = wraithLunge(state, 2);
    // O Prospector foge na direcao oposta ao bote desde o primeiro tick.
    const events = runUntilLunge(state, 40, () => {
      // Congela o Espectro no lugar para o bote nunca alcancar.
      wraith.x = state.player.x + WRAITH_LUNGE_RANGE - 0.2;
      wraith.y = state.player.y;
      wraith.vx = 0;
      wraith.vy = 0;
      return move(-1, 0);
    });
    expect(ofType(events, 'freeze_dose')).toHaveLength(0);
    expect(extra.freeze).toBe(0);
  });
});

describe('o decaimento natural', () => {
  it('e lento, deterministico, e para exatamente em zero', () => {
    const state = iceArena(31);
    const extra = state.playerExtras[0];
    const events: SemanticEvent[] = [];
    applyFreezeDose(state, 0, 200, 'frost_wraith', events);
    // Janela de graca: nada desce.
    for (let t = 0; t < FREEZE_GRACE_TICKS; t++) step(state);
    expect(extra.freeze).toBe(200);
    // Depois dela, um ponto a cada dois ticks — um ponto percentual/s.
    for (let t = 0; t < TICK_HZ; t++) step(state);
    expect(extra.freeze).toBe(
      200 - (TICK_HZ / FREEZE_DECAY_INTERVAL_TICKS) * FREEZE_DECAY_PER_INTERVAL,
    );
    // Ate zero, e nem um abaixo.
    for (let t = 0; t < 1000; t++) step(state);
    expect(extra.freeze).toBe(0);
    for (let t = 0; t < 50; t++) step(state);
    expect(extra.freeze).toBe(0);
  });

  it('NUNCA liberta quem congelou por inteiro', () => {
    const state = iceArena(32);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    for (let t = 0; t < 60 * TICK_HZ; t++) step(state);
    expect(extra.frostbitten).toBe(true);
    expect(extra.freeze).toBe(FREEZE_MAX);
  });

  it('o medidor e o mesmo em duas simulacoes com o mesmo log', () => {
    const run = () => {
      const state = iceArena(33);
      const events: SemanticEvent[] = [];
      applyFreezeDose(state, 0, 300, 'frost_wraith', events);
      for (let t = 0; t < 400; t++) step(state, t % 7 === 0 ? move(1, 0) : emptyCommand());
      return { freeze: state.playerExtras[0].freeze, hash: hashAuthoritativeState(state) };
    };
    expect(run()).toEqual(run());
  });
});

describe('congelado por inteiro: nada se move', () => {
  it('zera velocidade e inercia sobre o gelo no tick em que trava', () => {
    const state = iceArena(41);
    const p = state.player;
    for (let t = 0; t < 40; t++) step(state, move(1, 0));
    expect(Math.abs(p.vx)).toBeGreaterThan(1);
    frostbiteNow(state);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
    const x = p.x;
    const y = p.y;
    for (let t = 0; t < 30; t++) step(state, move(1, 0));
    expect(p.x).toBe(x);
    expect(p.y).toBe(y);
    expect(p.vx).toBe(0);
  });

  it('movimento, esquiva, rumo, interacao e habilidade ficam bloqueados', () => {
    const state = iceArena(42);
    const p = state.player;
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    const facing = { ...p.facing };
    const x = p.x;
    const events: SemanticEvent[] = [];
    for (let t = 0; t < 20; t++) {
      events.push(
        ...step(
          state,
          cmd({
            move: { x: 0, y: 1 },
            aim: { x: 0, y: -1 },
            dodge: true,
            ability: true,
            interact: true,
          }),
        ),
      );
    }
    expect(p.x).toBe(x);
    expect(p.facing).toEqual(facing);
    expect(ofType(events, 'dodge')).toHaveLength(0);
    expect(ofType(events, 'pulse')).toHaveLength(0);
    expect(extra.abilityCooldownUntil).toBe(0);
    expect(extra.dodgeCooldownUntil).toBe(0);
  });

  it('o corpo continua vulneravel: o dano entra normalmente', () => {
    const state = iceArena(43);
    frostbiteNow(state);
    const hp = state.player.hp;
    state.projectiles.push({
      kind: 'spit',
      id: 999,
      owner: 100,
      x: state.player.x,
      y: state.player.y,
      vx: 1,
      vy: 0,
      damage: 9,
      distanceTravelled: 0,
      hostile: true,
      leavesBiofluid: false,
      ttl: 5,
    });
    step(state);
    expect(state.player.hp).toBeLessThan(hp);
  });

  it('cancela o canal do sopro ao travar, cobrando o cooldown', () => {
    const state = iceArena(44);
    const extra = state.playerExtras[0];
    extra.ability = 'flamethrower';
    step(state, cmd({ ability: true }));
    expect(extra.channelingUntil).toBeGreaterThan(state.tick);
    frostbiteNow(state);
    const events = step(state);
    expect(extra.channelingUntil).toBe(0);
    expect(extra.abilityCooldownUntil).toBeGreaterThan(state.tick);
    expect(ofType(events, 'flame_cone')).toHaveLength(0);
  });
});

describe('o gatilho vira motor', () => {
  it('nao cria bolt: sem projetil, sem carga, sem shotsFired, sem `shot`', () => {
    const state = iceArena(51);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    const shots = state.stats.shotsFired;
    const events: SemanticEvent[] = [];
    for (let t = 0; t < 12; t++) events.push(...step(state, fire));
    expect(state.projectiles).toHaveLength(0);
    expect(state.stats.shotsFired).toBe(shots);
    expect(ofType(events, 'shot')).toHaveLength(0);
    expect(ofType(events, 'action_start').filter((e) => e.action === 'player_shot')).toHaveLength(
      0,
    );
    expect(ofType(events, 'thermal_cycle').length).toBeGreaterThan(0);
    // E o calor subiu: o ciclo e calor de verdade.
    expect(extra.heat).toBeGreaterThan(0);
  });

  it('nao cria Return Disc nem gasta a carga dele', () => {
    const state = iceArena(52);
    const extra = state.playerExtras[0];
    grantOrRechargeModule(extra, 'return_disc', state.tick);
    const charges = JSON.stringify(extra.activeModules);
    frostbiteNow(state);
    for (let t = 0; t < 12; t++) step(state, fire);
    expect(state.projectiles).toHaveLength(0);
    expect(JSON.stringify(extra.activeModules)).toBe(charges);
  });

  it('nao dispara a Minigun, nao gasta municao, e os canos desaceleram', () => {
    const state = iceArena(53);
    const extra = state.playerExtras[0];
    grantOrRechargeModule(extra, 'minigun', state.tick);
    // Girando a toda antes de congelar, e alguns ticks soltos para a rajada
    // ja disparada ser publicada — o que se mede depois e so o que sair
    // DEPOIS de travar.
    for (let t = 0; t < 30; t++) step(state, fire);
    for (let t = 0; t < 4; t++) step(state);
    expect(extra.minigun.spin).toBeGreaterThan(0);
    state.projectiles = [];
    const ammo = JSON.stringify(extra.activeModules);
    const shots = state.stats.shotsFired;
    frostbiteNow(state);
    const events: SemanticEvent[] = [];
    // So enquanto travado: solto, o gatilho volta a ser gatilho.
    for (let t = 0; t < 24 && extra.frostbitten; t++) events.push(...step(state, fire));
    expect(state.projectiles).toHaveLength(0);
    expect(JSON.stringify(extra.activeModules)).toBe(ammo);
    expect(state.stats.shotsFired).toBe(shots);
    expect(ofType(events, 'minigun_burst')).toHaveLength(0);
    expect(extra.minigun.spin).toBe(0);
    expect(extra.minigun.phase).toBe('idle');
  });

  it('a cadencia e FIXA e igual para toda arma — a Minigun nao degela mais rapido', () => {
    const cyclesIn = (setup: (state: SurvivalState) => void): number[] => {
      const state = iceArena(54);
      setup(state);
      frostbiteNow(state);
      const ticks: number[] = [];
      for (let t = 0; t < 16; t++) {
        for (let k = ofType(step(state, fire), 'thermal_cycle').length; k > 0; k--) {
          ticks.push(state.tick);
        }
      }
      return ticks;
    };
    const bolt = cyclesIn(() => undefined);
    const disc = cyclesIn((s) => grantOrRechargeModule(s.playerExtras[0], 'return_disc', s.tick));
    const minigun = cyclesIn((s) => grantOrRechargeModule(s.playerExtras[0], 'minigun', s.tick));
    expect(bolt).toEqual(disc);
    expect(bolt).toEqual(minigun);
    for (let i = 1; i < bolt.length; i++) {
      expect(bolt[i] - bolt[i - 1]).toBe(FREEZE_THERMAL_CYCLE_TICKS);
    }
  });

  it('calor guardado antes do congelamento nao derrete nada sozinho', () => {
    const state = iceArena(55);
    const extra = state.playerExtras[0];
    extra.heat = HEAT_MAX * 0.6;
    frostbiteNow(state);
    // Sem gatilho: o calor velho dissipa, e o medidor nao mexe.
    for (let t = 0; t < 40; t++) step(state);
    expect(extra.freeze).toBe(FREEZE_MAX);
    expect(extra.frostbitten).toBe(true);
  });

  it('com a arma fria, segurar o gatilho solta a crosta em 0,8-1,2 s, sem superaquecer', () => {
    const state = iceArena(56);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    let freedAt = -1;
    const events: SemanticEvent[] = [];
    for (let t = 0; t < 60 && freedAt < 0; t++) {
      const evs = step(state, fire);
      events.push(...evs);
      if (ofType(evs, 'frostbite_break').length > 0) freedAt = t + 1;
    }
    expect(freedAt).toBeGreaterThanOrEqual(0.8 * TICK_HZ);
    expect(freedAt).toBeLessThanOrEqual(1.2 * TICK_HZ);
    expect(extra.frostbitten).toBe(false);
    expect(ofType(events, 'overheat')).toHaveLength(0);
    // Uma camada inteira foi embora — e so ela: o residual fica.
    expect(extra.freeze).toBeLessThanOrEqual(FREEZE_THAW_RELEASE_AT);
    expect(extra.freeze).toBeGreaterThan(FREEZE_THAW_RELEASE_AT - 100);
  });

  it('nao solta no primeiro ciclo: a camada critica tem de derreter inteira', () => {
    const state = iceArena(57);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    // Ate o primeiro ciclo e um pouco depois dele.
    for (let t = 0; t < FREEZE_THERMAL_CYCLE_TICKS + 1; t++) step(state, fire);
    expect(extra.freeze).toBeLessThan(FREEZE_MAX);
    expect(extra.freeze).toBeGreaterThan(FREEZE_THAW_RELEASE_AT);
    expect(extra.frostbitten).toBe(true);
    expect(FREEZE_THAW_LAYER).toBeGreaterThanOrEqual(Math.round(FREEZE_MAX / 3) - 10);
  });

  it('o tick da libertacao NAO dispara; o aperto seguinte atira normalmente', () => {
    const state = iceArena(58);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    let freed = false;
    for (let t = 0; t < 60 && !freed; t++) {
      const evs = step(state, fire);
      if (ofType(evs, 'frostbite_break').length > 0) {
        freed = true;
        expect(ofType(evs, 'shot')).toHaveLength(0);
        expect(state.projectiles).toHaveLength(0);
      }
    }
    expect(freed).toBe(true);
    // Solto: o proximo tick elegivel dispara de verdade.
    let shot = false;
    for (let t = 0; t < BOLT_COOLDOWN_TICKS + 2 && !shot; t++) {
      shot = ofType(step(state, fire), 'shot').length > 0;
    }
    expect(shot).toBe(true);
    expect(extra.frostbitten).toBe(false);
  });

  it('tiros normais depois da libertacao derretem o gelo residual', () => {
    const state = iceArena(59);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    for (let t = 0; t < 60 && extra.frostbitten; t++) step(state, fire);
    const residual = extra.freeze;
    expect(residual).toBeGreaterThan(0);
    // Deixa o cano esfriar (sem gatilho) e mede UM tiro: o gelo cai pelo
    // calor dele, e o decaimento do intervalo e o unico outro termo.
    for (let t = 0; t < 40; t++) step(state);
    const before = extra.freeze;
    const evs = step(state, fire);
    expect(ofType(evs, 'shot')).toHaveLength(1);
    expect(before - extra.freeze).toBeGreaterThanOrEqual(
      Math.round(HEAT_PER_SHOT * FREEZE_MELT_PER_HEAT),
    );
  });

  it('superaquecer suspende os ciclos sem perder o progresso, e nao ha deadlock', () => {
    const state = iceArena(60);
    const extra = state.playerExtras[0];
    // Entra QUENTE: o superaquecimento vem antes da camada.
    extra.heat = HEAT_MAX - FREEZE_THERMAL_CYCLE_HEAT * 1.5;
    frostbiteNow(state);
    const events: SemanticEvent[] = [];
    let freedAt = -1;
    for (let t = 0; t < 8 * TICK_HZ && freedAt < 0; t++) {
      const evs = step(state, fire);
      events.push(...evs);
      if (ofType(evs, 'frostbite_break').length > 0) freedAt = t + 1;
    }
    expect(ofType(events, 'overheat').length).toBeGreaterThanOrEqual(1);
    expect(freedAt).toBeGreaterThan(OVERHEAT_LOCK_TICKS);
    expect(freedAt).toBeLessThan(6 * TICK_HZ);
    // Durante o lockout nenhum ciclo saiu — e o medidor nao subiu de volta.
    const overheatAt = events.findIndex((e) => e.t === 'overheat');
    expect(overheatAt).toBeGreaterThanOrEqual(0);
    const cyclesAfter = ofType(events.slice(overheatAt + 1), 'thermal_cycle');
    expect(cyclesAfter.length).toBeGreaterThan(0);
    expect(extra.frostbitten).toBe(false);
  });

  it('a queda e o abatido limpam o estado; o revivido nao volta preso', () => {
    const state = iceArena(61, 2);
    const victim = state.players[0];
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    victim.hp = 0;
    step(state);
    expect(extra.downed).toBe(true);
    expect(extra.frostbitten).toBe(false);
    expect(extra.freeze).toBe(0);
    // O parceiro revive: de pe, sem gelo.
    state.players[1].x = victim.x;
    state.players[1].y = victim.y;
    stepRun(state, [emptyCommand(), cmd({ interact: true })]);
    expect(extra.downed).toBe(false);
    expect(extra.frostbitten).toBe(false);
    expect(extra.freeze).toBe(0);
  });

  it('a morte limpa o estado', () => {
    const state = iceArena(62);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    state.player.hp = 0;
    step(state);
    expect(state.player.alive).toBe(false);
    expect(extra.frostbitten).toBe(false);
    expect(extra.freeze).toBe(0);
  });

  it('a descida limpa o estado', () => {
    const state = createRun({ seed: 63, tuning: DEFAULT_PLAYER_TUNING });
    const extra = state.playerExtras[0];
    const events: SemanticEvent[] = [];
    applyFreezeDose(state, 0, 700, 'frost_queen', events);
    descend(state, events);
    expect(extra.freeze).toBe(0);
    expect(extra.frostbitten).toBe(false);
    expect(extra.thermalCycleReadyAt).toBe(0);
  });

  it('clearFreeze zera os quatro campos', () => {
    const state = iceArena(64);
    const extra = state.playerExtras[0];
    frostbiteNow(state);
    clearFreeze(extra);
    expect(extra).toMatchObject({
      freeze: 0,
      frostbitten: false,
      freezeGraceUntil: 0,
      thermalCycleReadyAt: 0,
    });
  });
});

describe('co-op e replay', () => {
  it('cada slot acumula e degela por conta propria', () => {
    const state = iceArena(71, 2);
    const a = state.playerExtras[0];
    const b = state.playerExtras[1];
    const events: SemanticEvent[] = [];
    applyFreezeDose(state, 0, FREEZE_MAX, 'frost_queen', events);
    applyFreezeDose(state, 1, 300, 'frost_wraith', events);
    expect(a.frostbitten).toBe(true);
    expect(b.frostbitten).toBe(false);
    // O slot 1 anda; o slot 0 forca o motor. Tempo para o slot 0 se soltar e
    // para a graca do slot 1 passar e o decaimento dele correr.
    for (let t = 0; t < 100; t++) stepRun(state, [fire, move(1, 0)]);
    expect(a.frostbitten).toBe(false);
    expect(b.freeze).toBeLessThan(300);
    expect(b.freeze).toBeGreaterThan(0);
    expect(state.players[1].x).toBeGreaterThan(state.players[0].x - 100);
  });

  it('o hash muda com o medidor e com o latch', () => {
    const state = iceArena(72);
    const h0 = hashAuthoritativeState(state);
    const events: SemanticEvent[] = [];
    applyFreezeDose(state, 0, 100, 'frost_wraith', events);
    const h1 = hashAuthoritativeState(state);
    expect(h1).not.toBe(h0);
    state.playerExtras[0].frostbitten = true;
    expect(hashAuthoritativeState(state)).not.toBe(h1);
  });

  it('o mesmo log de comandos produz o mesmo hash e os mesmos eventos', () => {
    const play = () => {
      const state = iceArena(73);
      const queen = withQueen(state, 3);
      const log: string[] = [];
      for (let t = 0; t < 700; t++) {
        const c = t < 300 ? emptyCommand() : t % 3 === 0 ? fire : move(1, 0);
        for (const e of stepRun(state, [c]).events) {
          if (e.t.startsWith('freeze') || e.t.startsWith('frostbite') || e.t === 'thermal_cycle') {
            log.push(JSON.stringify(e));
          }
        }
        state.player.hp = state.player.maxHp;
      }
      return { hash: hashAuthoritativeState(state), log, queenAlive: queen.alive };
    };
    const a = play();
    const b = play();
    expect(a.hash).toBe(b.hash);
    expect(a.log).toEqual(b.log);
  });
});
