import { describe, expect, it } from 'vitest';
import {
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_EMIT_INTERVAL_TICKS,
  FLAMETHROWER_RANGE,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_ICE,
  SURF_NONE,
} from '../src/constants';
import { abilityDefinition } from '../src/abilities';
import { MODULE_DEFINITIONS, grantOrRechargeModule } from '../src/modules';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';

// O sopro termico e uma CANALIZACAO: por FLAMETHROWER_CHANNEL_TICKS a simulacao
// emite chama no ritmo do intervalo, sempre lendo a mira persistida daquele
// momento — e, enquanto o canal vive, o bolt esta travado sem consumir nada.

const clearArena = (state: SurvivalState, cx = 40, cy = 40, radius = 14): void => {
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

const withFlamethrower = (seed: number): SurvivalState => {
  const state = createRun({ seed });
  clearArena(state);
  state.playerExtra.ability = 'flamethrower';
  return state;
};

const castCommand = (aim: { x: number; y: number }): PlayerCommand => {
  const command = emptyCommand();
  command.ability = true;
  command.aim = aim;
  return command;
};

const cellAt = (state: SurvivalState, dx: number, dy: number): number =>
  Math.floor(state.player.y + dy) * state.config.width + Math.floor(state.player.x + dx);

const flameCones = (events: SemanticEvent[]): Extract<SemanticEvent, { t: 'flame_cone' }>[] =>
  events.filter((event): event is Extract<SemanticEvent, { t: 'flame_cone' }> => event.t === 'flame_cone');

describe('sopro termico canalizado', () => {
  it('abre um canal com a duracao configurada, cobravel num unico ponto', () => {
    const state = withFlamethrower(0xf10);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    // `stepRun` avanca o tick antes de processar o comando: logo apos o cast, o
    // canal tem exatamente a duracao configurada pela frente.
    expect(state.playerExtra.channelingUntil - state.tick).toBe(FLAMETHROWER_CHANNEL_TICKS);
  });

  it('emite chama continuamente durante o canal, e para quando ele acaba', () => {
    const state = withFlamethrower(0xf11);
    let cones = flameCones(stepRun(state, [castCommand({ x: 1, y: 0 })]).events).length;
    for (let tick = 1; tick < FLAMETHROWER_CHANNEL_TICKS + 20; tick++) {
      cones += flameCones(stepRun(state, [emptyCommand()]).events).length;
    }
    // Uma emissao por intervalo ao longo do canal inteiro, nenhuma depois.
    expect(cones).toBe(FLAMETHROWER_CHANNEL_TICKS / FLAMETHROWER_EMIT_INTERVAL_TICKS);
  });

  it('cada emissao carrega seq e alcances reais para o cliente desenhar o jato', () => {
    const state = withFlamethrower(0xf12);
    const cones = flameCones(stepRun(state, [castCommand({ x: 1, y: 0 })]).events);
    expect(cones).toHaveLength(1);
    expect(cones[0].seq).toBe(FLAMETHROWER_CHANNEL_TICKS);
    expect(cones[0].reach.length).toBeGreaterThan(0);
    for (const reach of cones[0].reach) {
      expect(reach).toBeGreaterThan(0);
      expect(reach).toBeLessThanOrEqual(FLAMETHROWER_RANGE);
    }
  });

  it('mirando para longe de DR, o fogo nasce na direcao da mira', () => {
    const state = withFlamethrower(0xf13);
    stepRun(state, [castCommand({ x: 0, y: 1 })]);
    expect(state.surface[cellAt(state, 0, 2)]).toBe(SURF_FIRE);
    expect(state.surface[cellAt(state, 2, 0)]).toBe(SURF_NONE);
    expect(state.surface[cellAt(state, 0, -2)]).toBe(SURF_NONE);
  });

  it('o jato SEGUE o stick de mira no meio da canalizacao', () => {
    const state = withFlamethrower(0xf14);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    expect(state.surface[cellAt(state, 2, 0)]).toBe(SURF_FIRE);
    expect(state.surface[cellAt(state, 0, 2)]).toBe(SURF_NONE);

    // Gira a mira para o sul no meio do canal: as proximas emissoes obedecem.
    const south = emptyCommand();
    south.aim = { x: 0, y: 1 };
    for (let tick = 0; tick < FLAMETHROWER_EMIT_INTERVAL_TICKS + 1; tick++) {
      stepRun(state, [south]);
    }
    expect(state.surface[cellAt(state, 0, 2)]).toBe(SURF_FIRE);
  });

  it('stick de mira neutro reusa a ultima mira valida, nunca DR', () => {
    const state = withFlamethrower(0xf15);
    stepRun(state, [castCommand({ x: 0, y: -1 })]);
    // Solta o stick: as emissoes seguintes continuam para o norte.
    for (let tick = 0; tick < 10; tick++) stepRun(state, [emptyCommand()]);
    expect(state.surface[cellAt(state, 0, -2)]).toBe(SURF_FIRE);
    // Nada foi soprado para leste (o antigo fallback DR).
    expect(state.surface[cellAt(state, 3, 0)]).toBe(SURF_NONE);
  });

  it('mover numa direcao com o sopro apontado para outra: movimento nao guia a chama', () => {
    const state = withFlamethrower(0xf16);
    stepRun(state, [castCommand({ x: 0, y: 1 })]);
    // Anda para o leste com a mira neutra durante o canal inteiro.
    for (let tick = 0; tick < 16; tick++) {
      const command = emptyCommand();
      command.move = { x: 1, y: 0 };
      stepRun(state, [command]);
    }
    // A mira persistida nunca virou o vetor de movimento.
    expect(state.playerExtra.aim).toEqual({ x: 0, y: 1 });
    // O fogo continua nascendo ao sul da posicao ATUAL do jogador.
    expect(state.surface[cellAt(state, 0, 2)]).toBe(SURF_FIRE);
  });

  it('bloqueia bolts durante o canal sem consumir cooldown, calor ou modulos', () => {
    const state = withFlamethrower(0xf17);
    grantOrRechargeModule(state.playerExtra, 'ricochet', state.tick);
    const fullCharges = MODULE_DEFINITIONS.ricochet.defaultCharges ?? 0;

    const castAndFire = castCommand({ x: 1, y: 0 });
    castAndFire.fire = true;
    // O cast e o disparo chegam no MESMO tick: o canal ja trava esse tiro.
    let events = stepRun(state, [castAndFire]).events;
    expect(state.projectiles).toHaveLength(0);

    const holdFire = emptyCommand();
    holdFire.fire = true;
    for (let tick = 1; tick < FLAMETHROWER_CHANNEL_TICKS; tick++) {
      events = stepRun(state, [holdFire]).events;
      expect(events.some((event) => event.t === 'shot')).toBe(false);
    }

    expect(state.projectiles).toHaveLength(0);
    expect(state.stats.shotsFired).toBe(0);
    // Tentativa barrada nao arma modulo, nao gera calor e nao toca no cooldown.
    expect(state.playerExtra.heat).toBe(0);
    expect(state.playerExtra.nextShotAt).toBe(0);
    const ricochet = state.playerExtra.activeModules.find((module) => module.id === 'ricochet');
    expect(ricochet?.lifetime.kind === 'charges' && ricochet.lifetime.remaining).toBe(fullCharges);
  });

  it('segurar o gatilho durante o canal nao gera rajada retroativa ao final', () => {
    const state = withFlamethrower(0xf18);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    const holdFire = emptyCommand();
    holdFire.fire = true;
    for (let tick = 1; tick < FLAMETHROWER_CHANNEL_TICKS; tick++) stepRun(state, [holdFire]);
    expect(state.stats.shotsFired).toBe(0);

    // Canal terminou: o primeiro tick livre dispara UM bolt, no cooldown normal.
    stepRun(state, [holdFire]);
    expect(state.stats.shotsFired).toBe(1);
    expect(state.projectiles.filter((proj) => proj.kind === 'bolt')).toHaveLength(1);
    stepRun(state, [holdFire]);
    // Tick seguinte ainda esta dentro de BOLT_COOLDOWN_TICKS: nada acumulou.
    expect(state.stats.shotsFired).toBe(1);
  });

  it('cobra o cooldown no FIM do canal, nao no cast', () => {
    const state = withFlamethrower(0xf20);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    // Durante o canal o cooldown ainda nao correu: o preco so comeca quando a
    // chama para de sair.
    expect(state.playerExtra.abilityCooldownUntil).toBeLessThanOrEqual(state.tick);

    const until = state.playerExtra.channelingUntil;
    while (state.playerExtra.channelingUntil !== 0) stepRun(state, [emptyCommand()]);
    expect(state.tick).toBe(until);
    const cooldown = Math.round(
      abilityDefinition('flamethrower').cooldownTicks * state.config.tuning.abilityCooldownScale,
    );
    expect(state.playerExtra.abilityCooldownUntil).toBe(until + cooldown);
  });

  it('canal interrompido cobra o cooldown a partir do instante do cancelamento', () => {
    // Sem isto, ser atordoado no comeco do sopro viraria recast gratis.
    const state = withFlamethrower(0xf21);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    state.player.stunnedUntil = state.tick + 2;
    stepRun(state, [emptyCommand()]);
    expect(state.playerExtra.channelingUntil).toBe(0);
    const cooldown = Math.round(
      abilityDefinition('flamethrower').cooldownTicks * state.config.tuning.abilityCooldownScale,
    );
    expect(state.playerExtra.abilityCooldownUntil).toBe(state.tick + cooldown);
  });

  it('nao permite recomecar a habilidade enquanto o canal vive', () => {
    const state = withFlamethrower(0xf19);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    const until = state.playerExtra.channelingUntil;
    state.playerExtra.abilityCooldownUntil = 0; // forca o unico outro gate
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    expect(state.playerExtra.channelingUntil).toBe(until);
  });

  it('paredes bloqueiam a chama: celulas antes queimam, celulas atras ficam intactas', () => {
    const state = withFlamethrower(0xf1a);
    state.solid[cellAt(state, 2, 0)] = SOLID_ROCK;
    stepRun(state, [castCommand({ x: 1, y: 0 })]);

    expect(state.surface[cellAt(state, 1, 0)]).toBe(SURF_FIRE);
    // Atras da rocha, dentro do alcance nominal do cone: nada.
    expect(state.surface[cellAt(state, 3, 0)]).toBe(SURF_NONE);

    // O evento reporta o recorte: o raio central para na parede.
    const cones = flameCones(stepRun(state, [emptyCommand()]).events);
    expect(cones).toHaveLength(0); // tick impar: proxima emissao no seguinte
    const next = flameCones(stepRun(state, [emptyCommand()]).events);
    expect(next).toHaveLength(1);
    const middle = next[0].reach[(next[0].reach.length - 1) / 2];
    expect(middle).toBeLessThan(FLAMETHROWER_RANGE);
  });

  it('material inflamavel reage pelas regras dele; nao inflamavel e preservado', () => {
    const state = withFlamethrower(0xf1b);
    state.surface[cellAt(state, 1, 0)] = SURF_FUNGAL;
    state.surface[cellAt(state, 2, 0)] = SURF_ICE;
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    // Fungo umido seca (o aviso), nao salta para fogo.
    expect(state.surface[cellAt(state, 1, 0)]).toBe(SURF_FUNGAL_HEATED);
    // Gelo derrete ou resiste conforme `meltIce` — mas nunca vira chama.
    expect(state.surface[cellAt(state, 2, 0)]).not.toBe(SURF_FIRE);
  });

  it('respeita os limites do mapa soprando contra a borda', () => {
    const state = withFlamethrower(0xf1c);
    clearArena(state, 2, 2, 2);
    for (let tick = 0; tick < FLAMETHROWER_CHANNEL_TICKS + 2; tick++) {
      const command = tick === 0 ? castCommand({ x: -1, y: -1 }) : emptyCommand();
      expect(() => stepRun(state, [command])).not.toThrow();
    }
  });

  it('cair atordoado cancela o canal e devolve o gatilho imediatamente', () => {
    const state = withFlamethrower(0xf1d);
    stepRun(state, [castCommand({ x: 1, y: 0 })]);
    state.player.stunnedUntil = state.tick + 2;
    stepRun(state, [emptyCommand()]);
    expect(state.playerExtra.channelingUntil).toBeLessThanOrEqual(state.tick);

    // Stun passou, canal morto: o bolt volta a funcionar bem antes do fim
    // original do canal.
    stepRun(state, [emptyCommand()]);
    const fire = emptyCommand();
    fire.fire = true;
    fire.aim = { x: 1, y: 0 };
    stepRun(state, [fire]);
    expect(state.stats.shotsFired).toBe(1);
  });

  it('e deterministico: mesmos inputs e seed, mesmo hash final', () => {
    const script = (state: SurvivalState): void => {
      clearArena(state);
      state.playerExtra.ability = 'flamethrower';
      stepRun(state, [castCommand({ x: 0, y: 1 })]);
      for (let tick = 1; tick < FLAMETHROWER_CHANNEL_TICKS + 10; tick++) {
        const command = emptyCommand();
        if (tick > 10 && tick < 20) command.aim = { x: 1, y: 0 };
        if (tick % 4 === 0) command.move = { x: 0, y: -1 };
        command.fire = tick % 2 === 0;
        stepRun(state, [command]);
      }
    };
    const a = createRun({ seed: 0xf1e });
    const b = createRun({ seed: 0xf1e });
    script(a);
    script(b);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });

  it('o canal entra no hash autoritativo', () => {
    const a = createRun({ seed: 0xf1f });
    const b = createRun({ seed: 0xf1f });
    b.playerExtra.channelingUntil = b.tick + 10;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });
});
