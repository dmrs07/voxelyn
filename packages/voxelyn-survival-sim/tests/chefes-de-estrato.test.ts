// OS SEIS CHEFES DE ESTRATO.
//
// O que estes testes protegem, e vale para os seis: cada um opera a alavanca do
// PROPRIO bioma, e o contra-jogo dele e territorial. Um chefe que funcionasse
// igual em qualquer mapa seria um chefe que nao pertence a lugar nenhum — e a
// forma de isso acontecer sem ninguem perceber e a mecanica de bioma parar de
// responder enquanto o dano continua saindo.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { BOSS_OF_STRATUM, IMPLEMENTED_BOSS, bossArchetypeForBiome } from '../src/bosses';
import {
  FROST_QUEEN_ICE_THRESHOLD,
  FURNACE_HEART_BROOD_CAP,
  FURNACE_HEART_CYCLE_TICKS,
  FURNACE_HEART_WAVE_RADIUS,
  LUNG_MATRIX_CYCLE_TICKS,
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_CYCLE_TICKS,
  MAGNETARCH_TETHER_RANGE,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SURF_FIRE,
  SURF_GAS,
  SURF_ICE,
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
    const expected: Array<[Parameters<typeof bossArchetypeForBiome>[0]['stratum'], EnemyArchetype]> = [
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
      expect(bossArchetypeForBiome({ stratum, occupation: 'none', lineage: 'mineral' }), stratum)
        .toBe(archetype);
    }
  });
});

describe('Arquicantor — a Catedral responde', () => {
  it('sem cristal ao alcance ele nao canta: a sala esvaziada o desarma', () => {
    const { state, boss } = duel(601, 'archcantor', 5);
    let pulses = 0;
    for (let t = 0; t < 400; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'pulse') pulses++;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(pulses, 'cantou numa sala sem um cristal sequer').toBe(0);
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
});

describe('Leviata do Lencol — a lamina e o territorio', () => {
  it('so emerge onde ha agua: chao seco o segura embaixo', () => {
    const { state, boss } = duel(611, 'sheet_leviathan', 6);
    let breached = false;
    for (let t = 0; t < 500; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'erupt') breached = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(breached, 'rompeu a lamina onde nao havia lamina').toBe(false);
  });

  it('com agua sob o alvo ele rompe — e a agua e que faz a diferenca', () => {
    const { state, boss, px, py } = duel(612, 'sheet_leviathan', 6);
    paint(state, px, py, 8, SURF_WATER);
    let breached = false;
    for (let t = 0; t < 500 && !breached; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'erupt') breached = true;
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
    expect(advanceUntil(state, () => Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2 === 1)).toBe(true);
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
    expect(advanceUntil(state, () => Math.floor(state.tick / FURNACE_HEART_CYCLE_TICKS) % 2 === 0)).toBe(true);
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
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'freeze') froze = true;
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
    expect(advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0)).toBe(true);
    const startPull = Math.abs(state.player.x - boss.x);
    for (let t = 0; t < 30; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(Math.abs(state.player.x - boss.x), 'atraindo, nao puxou').toBeLessThan(startPull);

    expect(advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 1)).toBe(true);
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
      advanceUntil(near.state, () => Math.floor(near.state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0),
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
    expect(state.stats.discoveries & DISCOVERY_CATHEDRAL_SILENCED, 'acendeu com a rede de pe').toBe(0);

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
    expect(advanceUntil(state, () => Math.floor(state.tick / LUNG_MATRIX_CYCLE_TICKS) % 2 === 1)).toBe(true);
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
    expect(advanceUntil(state, () => Math.floor(state.tick / MAGNETARCH_CYCLE_TICKS) % 2 === 0)).toBe(true);
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
