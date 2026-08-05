import { describe, expect, it } from 'vitest';
import {
  ARC_CHAIN_RANGE,
  FLAMETHROWER_RANGE,
  SEEKER_TURN_RATE,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SURF_BIOFLUID,
  GAS_FLASH_TICKS,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  WELL_OFFER_REACH,
  WELL_OFFER_REVEAL,
} from '../src/constants';
import {
  ABILITY_DEFINITIONS,
  STARTING_ABILITY,
  abilityDefinition,
  emptyResonance,
  resonanceOffers,
} from '../src/abilities';
import { spawnEnemy } from '../src/entities';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import type { AbilityId, SurvivalState } from '../src/types';

/** Arena limpa: sem inimigos herdados do worldgen atrapalhando a contagem. */
const clearArena = (state: SurvivalState): void => {
  state.enemies = [];
  state.projectiles = [];
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 10; y <= py + 10; y++) {
    for (let x = px - 10; x <= px + 10; x++) {
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
    }
  }
};

const cast = (state: SurvivalState, aim = { x: 1, y: 0 }): SurvivalState => {
  const command = emptyCommand();
  command.ability = true;
  command.aim = aim;
  stepRun(state, [command]);
  return state;
};

const atWell = (state: SurvivalState, distance: number): void => {
  state.player.x = state.corePos.x + 0.5 + distance;
  state.player.y = state.corePos.y + 0.5;
};

describe('habilidades', () => {
  it('comeca no pulso, que e o unico que nenhuma ressonancia oferece', () => {
    const state = createRun({ seed: 1 });
    expect(state.playerExtra.ability).toBe(STARTING_ABILITY);
    expect(ABILITY_DEFINITIONS.pulse.resonance).toBeNull();
    // Trocar de volta para o que voce ja tinha nao e uma decisao.
    const tally = emptyResonance();
    tally.kinetic = 99;
    expect(resonanceOffers(tally, 'flamethrower', 1, 1)).not.toContain('pulse');
  });

  it('cobra cooldown maior que o pulso em toda habilidade que mata', () => {
    // O pulso empurra e limpa gas; ele nao mata. As outras matam, e a janela entre
    // usos e o que impede cada uma de virar a arma primaria.
    const base = abilityDefinition('pulse').cooldownTicks;
    for (const id of ['flamethrower', 'seeker', 'arc'] satisfies AbilityId[]) {
      expect(abilityDefinition(id).cooldownTicks).toBeGreaterThan(base);
    }
  });

  it('o lanca-chamas acende o cone a frente e nao o que esta atras', () => {
    const state = createRun({ seed: 2 });
    clearArena(state);
    state.playerExtra.ability = 'flamethrower';
    const behind = spawnEnemy(state, 'stalker', state.player.x - 2, state.player.y, false);
    behind.x = state.player.x - 2;
    behind.y = state.player.y;
    const ahead = spawnEnemy(state, 'stalker', state.player.x + 2, state.player.y, false);
    ahead.x = state.player.x + 2;
    ahead.y = state.player.y;
    const aheadHp = ahead.hp;
    const behindHp = behind.hp;

    cast(state, { x: 1, y: 0 });

    expect(ahead.hp).toBeLessThan(aheadHp);
    expect(behind.hp).toBe(behindHp);

    const w = state.config.width;
    const front = Math.floor(state.player.y) * w + Math.floor(state.player.x + 2);
    const back = Math.floor(state.player.y) * w + Math.floor(state.player.x - 2);
    expect(state.surface[front]).toBe(SURF_FIRE);
    expect(state.surface[back]).toBe(SURF_NONE);
  });

  it('o cone respeita a ignicao por material em vez de escrever fogo direto', () => {
    // Uma habilidade nova que ensina outra fisica para o mesmo material e pior do
    // que uma habilidade que falta: fungo umido tem de passar pelo estado
    // fumegante que AVISA, e gas tem de dar o flash curto e nao o combustivel
    // longo do chao nu.
    const state = createRun({ seed: 0xc0e0 });
    clearArena(state);
    state.playerExtra.ability = 'flamethrower';
    const w = state.config.width;
    const row = Math.floor(state.player.y) * w;
    const fungal = row + Math.floor(state.player.x + 1);
    const gas = row + Math.floor(state.player.x + 2);
    const bare = row + Math.floor(state.player.x + 3);
    state.surface[fungal] = SURF_FUNGAL;
    state.surface[gas] = SURF_GAS;

    cast(state, { x: 1, y: 0 });

    // Fungo umido NAO salta para fogo: ele comeca a secar, e o aviso sobrevive.
    expect(state.surface[fungal]).toBe(SURF_FUNGAL_HEATED);
    // Gas queima com o flash curto do proprio material.
    expect(state.surface[gas]).toBe(SURF_FIRE);
    expect(state.surfaceTimer[gas]).toBeLessThanOrEqual(GAS_FLASH_TICKS);
    // Chao nu continua recebendo a chama do sopro, que e o que a habilidade faz.
    expect(state.surface[bare]).toBe(SURF_FIRE);
    expect(state.surfaceTimer[bare]).toBeGreaterThan(GAS_FLASH_TICKS);
  });

  it('o lanca-chamas nao atravessa alem do alcance', () => {
    const state = createRun({ seed: 3 });
    clearArena(state);
    state.playerExtra.ability = 'flamethrower';
    const far = spawnEnemy(state, 'stalker', state.player.x + FLAMETHROWER_RANGE + 2, state.player.y, false);
    far.x = state.player.x + FLAMETHROWER_RANGE + 2;
    far.y = state.player.y;
    const hp = far.hp;
    cast(state, { x: 1, y: 0 });
    expect(far.hp).toBe(hp);
  });

  it('o arco salta entre inimigos e para no alcance de cadeia', () => {
    const state = createRun({ seed: 4 });
    clearArena(state);
    state.playerExtra.ability = 'arc';
    const near = spawnEnemy(state, 'stalker', state.player.x + 1.5, state.player.y, false);
    near.x = state.player.x + 1.5;
    near.y = state.player.y;
    // Dentro do alcance a partir do PRIMEIRO alvo, mas nao do jogador.
    const chained = spawnEnemy(state, 'stalker', state.player.x + 1.5 + ARC_CHAIN_RANGE - 1, state.player.y, false);
    chained.x = state.player.x + 1.5 + ARC_CHAIN_RANGE - 1;
    chained.y = state.player.y;
    const isolated = spawnEnemy(state, 'stalker', state.player.x, state.player.y + 40, false);
    isolated.x = state.player.x;
    isolated.y = state.player.y + 40;

    const before = [near.hp, chained.hp, isolated.hp];
    cast(state);

    expect(near.hp).toBeLessThan(before[0]);
    // O salto e o que o arco tem de proprio: ele alcanca quem o jogador nao alcanca.
    expect(chained.hp).toBeLessThan(before[1]);
    expect(isolated.hp).toBe(before[2]);
  });

  it('o missil corrige o rumo, mas nao e infalivel', () => {
    const state = createRun({ seed: 5 });
    clearArena(state);
    state.playerExtra.ability = 'seeker';
    const target = spawnEnemy(state, 'stalker', state.player.x + 6, state.player.y + 4, false);
    target.x = state.player.x + 6;
    target.y = state.player.y + 4;
    target.stunnedUntil = Number.MAX_SAFE_INTEGER;

    // Atira reto no eixo X: o alvo esta fora da linha e so e atingido pela curva.
    cast(state, { x: 1, y: 0 });
    const missile = state.projectiles.find((p) => p.kind === 'seeker');
    expect(missile).toBeDefined();
    // Depois de UM tick ele corrigiu no maximo o que a taxa de curva permite: e
    // isso que o impede de ser infalivel contra um alvo que muda de direcao.
    const afterOneTick = Math.abs(Math.atan2(missile!.vy, missile!.vx));
    expect(afterOneTick).toBeGreaterThan(0);
    expect(afterOneTick).toBeLessThanOrEqual(SEEKER_TURN_RATE + 1e-6);

    const hp = target.hp;
    for (let tick = 0; tick < 30 && state.projectiles.length > 0; tick++) {
      stepRun(state, [emptyCommand()]);
    }
    expect(target.hp).toBeLessThan(hp);
  });
});

describe('ressonancia do poco', () => {
  it('nao oferece nada quando o jogador nao provocou reacao nenhuma', () => {
    // Um poco que sempre oferece algo transformaria a oferta em corredor
    // obrigatorio, e nao numa consequencia do que aconteceu no setor. (O SETOR
    // 1 e a excecao, resolvida fora desta funcao: ver o teste do Eco garantido.)
    expect(resonanceOffers(emptyResonance(), 'pulse', 7, 1)).toEqual([]);
  });

  it('o poco do setor 1 nunca fica mudo: sem ressonancia, UM Eco garantido', () => {
    // O setor 1 e onde o jogador aprende que o poco oferece habilidade; um
    // poco calado na primeira descida ensina que ele e so um buraco.
    const reveal = (seed: number): AbilityId[] => {
      const state = createRun({ seed });
      atWell(state, WELL_OFFER_REVEAL - 1);
      stepRun(state, [emptyCommand()]);
      return state.wellOffers.map((offer) => offer.ability);
    };
    const offers = reveal(0x0ffe3);
    expect(offers).toHaveLength(1);
    expect(offers[0]).not.toBe('pulse');
    // Deterministico pela seed: mesmo Eco nas duas maquinas da sala.
    expect(reveal(0x0ffe3)).toEqual(offers);
  });

  it('nos setores fundos a regra historica continua: sem reacao, sem oferta', () => {
    const state = createRun({ seed: 0x0ffe4, sector: 2 });
    atWell(state, WELL_OFFER_REVEAL - 1);
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers).toHaveLength(0);
  });

  it('oferece a habilidade do que o jogador mais provocou', () => {
    const tally = emptyResonance();
    tally.fire = 30;
    tally.current = 4;
    const offers = resonanceOffers(tally, 'pulse', 7, 1);
    expect(offers[0]).toBe('flamethrower');
    expect(offers[1]).toBe('arc');
  });

  it('e deterministica: mesma run, mesmo setor, mesma oferta', () => {
    const tally = emptyResonance();
    tally.fire = 5;
    tally.current = 5;
    tally.blast = 5;
    expect(resonanceOffers(tally, 'pulse', 99, 2)).toEqual(resonanceOffers(tally, 'pulse', 99, 2));
  });

  it('nunca oferece a habilidade que o jogador ja carrega', () => {
    const tally = emptyResonance();
    tally.fire = 50;
    expect(resonanceOffers(tally, 'flamethrower', 7, 1)).not.toContain('flamethrower');
  });

  it('acorda os Ecos quando alguem chega perto do poco, e so uma vez', () => {
    const state = createRun({ seed: 0x0ffe1 });
    state.playerExtra.resonance.fire = 12;
    state.playerExtra.resonance.current = 3;

    atWell(state, WELL_OFFER_REVEAL + 5);
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers).toHaveLength(0);

    atWell(state, WELL_OFFER_REVEAL - 1);
    const result = stepRun(state, [emptyCommand()]);
    expect(state.wellOffers).toHaveLength(2);
    expect(result.events.some((e) => e.t === 'well_offers')).toBe(true);

    // Congelada: a ressonancia continua mudando enquanto o jogador anda, e os dois
    // Ecos nao podem trocar de habilidade entre um passo e outro.
    const frozen = state.wellOffers.map((offer) => offer.ability);
    state.playerExtra.resonance.blast = 999;
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers.map((offer) => offer.ability)).toEqual(frozen);
  });

  it('le a ressonancia de quem esta MAIS PERTO, e nao do ultimo slot', () => {
    // Guardar a ultima ocorrencia fazia o slot de numero mais alto ganhar sempre
    // que os dois estivessem no alcance no mesmo tick: a oferta descrevia o estilo
    // do parceiro que ficou para tras, por causa da ordem do laco.
    const state = createRun({ seed: 0x0ffe6, playerCount: 2 });
    const wellX = state.corePos.x + 0.5;
    const wellY = state.corePos.y + 0.5;

    // Slot 0 chega ao poco tendo incendiado; slot 1 fica longe, tendo detonado.
    state.playerExtras[0].resonance.fire = 30;
    state.playerExtras[1].resonance.blast = 30;
    state.players[0].x = wellX + 1;
    state.players[0].y = wellY;
    state.players[1].x = wellX + WELL_OFFER_REVEAL - 0.5;
    state.players[1].y = wellY;

    stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(state.wellOffers.length).toBeGreaterThan(0);
    expect(state.wellOffers[0].ability).toBe('flamethrower');
  });

  it('nao interrompe o setor final com uma escolha no meio da arena', () => {
    const state = createRun({ seed: 0x0ffe2, sector: 3 });
    state.playerExtra.resonance.fire = 20;
    atWell(state, 1);
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers).toEqual([]);
  });

  it('pegar um Eco troca a habilidade, zera o cooldown e apaga a outra oferta', () => {
    const state = createRun({ seed: 0x0ffe3 });
    state.playerExtra.resonance.fire = 12;
    state.playerExtra.resonance.current = 3;
    atWell(state, WELL_OFFER_REVEAL - 1);
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers).toHaveLength(2);

    const chosen = state.wellOffers[0];
    state.player.x = chosen.x;
    state.player.y = chosen.y;
    state.playerExtra.abilityCooldownUntil = state.tick + 500;

    const command = emptyCommand();
    command.interact = true;
    const result = stepRun(state, [command]);

    expect(state.playerExtra.ability).toBe(chosen.ability);
    // Herdar o cooldown antigo puniria quem usou a habilidade que tinha para
    // chegar vivo ate o poco.
    expect(state.playerExtra.abilityCooldownUntil).toBeLessThanOrEqual(state.tick);
    expect(state.wellOffers.every((offer) => offer.takenBy !== null)).toBe(true);
    expect(result.events.some((e) => e.t === 'ability_taken')).toBe(true);
  });

  it('nao deixa pegar de longe', () => {
    const state = createRun({ seed: 0x0ffe4 });
    state.playerExtra.resonance.fire = 12;
    atWell(state, WELL_OFFER_REVEAL - 1);
    stepRun(state, [emptyCommand()]);
    const offer = state.wellOffers[0];
    state.player.x = offer.x + WELL_OFFER_REACH + 2;
    state.player.y = offer.y;

    const command = emptyCommand();
    command.interact = true;
    stepRun(state, [command]);
    expect(state.playerExtra.ability).toBe(STARTING_ABILITY);
  });

  it('a habilidade equipada entra no hash autoritativo', () => {
    // Duas simulacoes que discordam de qual habilidade o slot carrega divergem no
    // primeiro uso, e o replay tem de acusar isso.
    const a = createRun({ seed: 77 });
    const b = createRun({ seed: 77 });
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    b.playerExtra.ability = 'seeker';
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });

  it('a descida zera a ressonancia e apaga os Ecos do mapa antigo', () => {
    const state = createRun({ seed: 0x0ffe5 });
    state.playerExtra.resonance.fire = 20;
    atWell(state, WELL_OFFER_REVEAL - 1);
    stepRun(state, [emptyCommand()]);
    expect(state.wellOffers.length).toBeGreaterThan(0);

    // Desce: o poco do setor 2 nao pode oferecer o estilo do setor 1.
    state.player.x = state.corePos.x + 0.5;
    state.player.y = state.corePos.y + 0.5;
    const command = emptyCommand();
    command.interact = true;
    for (let i = 0; i < 3 && state.sector === 1; i++) stepRun(state, [command]);

    expect(state.sector).toBe(2);
    expect(state.wellOffers).toEqual([]);
    expect(state.playerExtra.resonance).toEqual(emptyResonance());
  });
});

describe('ressonancia ganhavel com o kit basico', () => {
  it('registra fogo quando o proprio jogador seca fungo com o cone', () => {
    // Se so o lanca-chamas registrasse chama, quem nao tem lanca-chamas jamais
    // acumularia fogo — e o poco nunca ofereceria a habilidade. O credito olha o
    // CHAO mudar de estado, no unico instante em que a autoria ainda existe: o
    // fungo aquecido so vira chama varios ticks depois, em `stepCells`, longe de
    // qualquer coisa que saiba quem atirou.
    const state = createRun({ seed: 0xf1e0 });
    clearArena(state);
    state.playerExtra.ability = 'flamethrower';
    const w = state.config.width;
    for (let dx = 1; dx <= 3; dx++) {
      state.surface[Math.floor(state.player.y) * w + Math.floor(state.player.x + dx)] = SURF_FUNGAL;
    }
    cast(state, { x: 1, y: 0 });
    expect(state.playerExtra.resonance.fire).toBeGreaterThan(0);
  });

  it('registra corrente ao eletrificar poca, mesmo sem inimigo em cima dela', () => {
    // Preso ao atordoamento, o registro so contava quando havia bicho na poca — e
    // quem quebra cristal para abrir caminho nunca acumularia corrente.
    const state = createRun({ seed: 0xf1e1 });
    clearArena(state);
    const w = state.config.width;
    const row = Math.floor(state.player.y) * w;
    state.solid[row + Math.floor(state.player.x + 3)] = SOLID_CRYSTAL;
    state.surface[row + Math.floor(state.player.x + 2)] = SURF_BIOFLUID;
    expect(state.enemies).toHaveLength(0);

    const command = emptyCommand();
    command.fire = true;
    command.aim = { x: 1, y: 0 };
    stepRun(state, [command]);
    for (let i = 0; i < 12 && state.playerExtra.resonance.current === 0; i++) {
      stepRun(state, [emptyCommand()]);
    }
    expect(state.playerExtra.resonance.current).toBeGreaterThan(0);
  });
});
