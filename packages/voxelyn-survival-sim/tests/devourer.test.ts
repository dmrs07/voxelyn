// DEVORADOR BRANCO — o chefe dos Sumidouros de Silica.
//
// O que estes testes protegem, em ordem de gravidade:
// 1. O CONTRA-JOGO EXISTE E FUNCIONA. Calor vitrifica silica solta, e sobre
//    vidro ele NAO emerge. Se qualquer metade disso quebrar, o encontro vira um
//    verme que sai onde quer e o jogador nao tem resposta nenhuma.
// 2. O RASTRO E O AVISO. Mergulhado ele deixa silica por onde passa — e essa
//    faixa e ao mesmo tempo o telegrafo e a materia-prima do contra-jogo.
// 3. A JANELA E A JANELA. Submerso ele quase nao toma dano; exposto, toma.
//    Sem isso o ciclo inteiro deixa de significar alguma coisa.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { igniteCell } from '../src/cells';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import {
  DEVOURER_BURROWED_ARMOR,
  DEVOURER_ERUPT_WINDUP_TICKS,
  DEVOURER_LEAP_MAX_RANGE,
  DEVOURER_LEAP_MIN_RANGE,
  DEVOURER_LEAPS_PER_CYCLE,
  SECTOR_COUNT,
  SOLID_NONE,
  SURF_GLASS,
  SURF_NONE,
  SURF_SILT,
} from '../src/constants';
import {
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_STUCK,
  DEVOURER_SURFACED,
  DISCOVERY_SILICA_VITRIFIED,
  type SurvivalState,
} from '../src/types';

const arena = (seed: number) => {
  const state = createRun({ seed });
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - 20; y <= py + 20; y++) {
    for (let x = px - 20; x <= px + 20; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.enemies = [];
  const worm = spawnEnemy(state, 'white_devourer', px + 10, py, false);
  return { state, worm, px, py };
};

const countSurface = (state: SurvivalState, kind: number, cx: number, cy: number, r: number): number => {
  const w = state.config.width;
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
      if (state.surface[y * w + x] === kind) n++;
    }
  }
  return n;
};

describe('Devorador Branco — onde ele mora', () => {
  it('e o chefe do mapa final de Sumidouros de Silica', () => {
    expect(bossArchetypeForBiome({ stratum: 'silica', occupation: 'none', lineage: 'arid' }))
      .toBe('white_devourer');
    // Ocupacao forte continua tendo prioridade sobre o estrato.
    expect(bossArchetypeForBiome({ stratum: 'silica', occupation: 'mycelial', lineage: 'arid' }))
      .toBe('bishop');
  });

  it('quando a linhagem termina em silica, ele esta na camara', () => {
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++) {
      if (bossArchetypeForBiome(sectorBiome(seed, SECTOR_COUNT)) !== 'white_devourer') continue;
      const state = createRun({ seed, sector: SECTOR_COUNT });
      found = state.enemies.some((e) => e.archetype === 'white_devourer');
      expect(found, `seed ${seed}: sumidouro sem Devorador`).toBe(true);
    }
    expect(found, 'nenhuma seed da amostra terminou em Sumidouros de Silica').toBe(true);
  });
});

describe('Devorador Branco — o rastro', () => {
  it('nasce POR BAIXO e deixa faixa de silica por onde anda', () => {
    const { state, worm, px, py } = arena(501);
    expect(worm.mood).toBe(DEVOURER_BURROWED);
    expect(countSurface(state, SURF_SILT, px, py, 18)).toBe(0);

    for (let t = 0; t < 30; t++) stepRun(state, [emptyCommand()]);
    expect(countSurface(state, SURF_SILT, px, py, 18), 'nao deixou rastro nenhum').toBeGreaterThan(4);
  });

  it('atravessa parede: perseguir nao e uma resposta a ele', () => {
    const { state, worm, px, py } = arena(502);
    const w = state.config.width;
    for (let dy = -6; dy <= 6; dy++) state.solid[(py + dy) * w + px + 5] = 1; // rocha
    const before = worm.x;
    for (let t = 0; t < 40; t++) stepRun(state, [emptyCommand()]);
    expect(worm.x, 'a parede segurou quem anda por baixo dela').toBeLessThan(before - 2);
  });
});

describe('Devorador Branco — o contra-jogo', () => {
  it('calor VITRIFICA a silica solta, e isso e uma Descoberta', () => {
    const { state, px, py } = arena(511);
    const w = state.config.width;
    const cell = py * w + px + 3;
    state.surface[cell] = SURF_SILT;
    state.surfaceTimer[cell] = 0;

    igniteCell(state, cell, []);
    expect(state.surface[cell], 'o calor nao virou vidro').toBe(SURF_GLASS);
    expect(state.stats.discoveries & DISCOVERY_SILICA_VITRIFIED).not.toBe(0);
  });

  it('sobre VIDRO ele nao emerge — o chao negado o segura embaixo', () => {
    // O teste que sustenta o encontro inteiro. Com o jogador de pe sobre uma
    // placa de vidro larga, nenhuma emergencia pode acontecer ali dentro.
    const { state, px, py } = arena(512);
    const w = state.config.width;
    const R = 9;
    for (let y = py - R; y <= py + R; y++) {
      for (let x = px - R; x <= px + R; x++) {
        state.surface[y * w + x] = SURF_GLASS;
        state.surfaceTimer[y * w + x] = 0;
      }
    }

    let eruptedInside = false;
    for (let t = 0; t < 600; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'action_start' || ev.action !== 'erupt') continue;
        if (Math.abs(ev.x - (px + 0.5)) <= R && Math.abs(ev.y - (py + 0.5)) <= R) eruptedInside = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(eruptedInside, 'emergiu por dentro do vidro').toBe(false);
  });

  it('em chao solto ele EMERGE — o vidro e que faz diferenca, nao o teste', () => {
    // O controle do teste acima: sem vidro, a mesma cena produz emergencia. Sem
    // este par, um Devorador que nunca emergisse passaria no teste do vidro.
    const { state } = arena(513);
    let erupted = false;
    for (let t = 0; t < 600 && !erupted; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') erupted = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(erupted, 'nunca emergiu nem em areia solta').toBe(true);
  });

  it('a emergencia NAO desfaz o vidro do jogador', () => {
    const { state, worm, px, py } = arena(514);
    const w = state.config.width;
    const glassCell = py * w + px + 2;
    state.surface[glassCell] = SURF_GLASS;
    state.surfaceTimer[glassCell] = 0;
    // Emergencia forcada ao lado da placa.
    worm.x = px + 3.5;
    worm.y = py + 0.5;
    worm.nextActionAt = 0;
    for (let t = 0; t < DEVOURER_ERUPT_WINDUP_TICKS + 30; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.surface[glassCell], 'o chefe apagou a decisao do jogador').toBe(SURF_GLASS);
  });
});

describe('Devorador Branco — o arco', () => {
  // O ciclo completo, observado de fora: onde ele decolou, onde caiu, e o que
  // aconteceu com o jogador entre uma coisa e outra.
  const flyOnce = (seed: number, ticks = 400) => {
    const { state, worm, px, py } = arena(seed);
    let launch: { x: number; y: number } | null = null;
    let landing: { x: number; y: number } | null = null;
    let airborneTicks = 0;
    let longestFlight = 0;
    let midFlightDamage = 0;
    let midFlightSilt = 0;
    for (let t = 0; t < ticks && !landing; t++) {
      const moodBefore = worm.mood;
      const hpBefore = state.player.hp;
      const siltBefore = countSurface(state, SURF_SILT, px, py, 20);
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') launch = { x: ev.x, y: ev.y };
      }
      // ESTRITAMENTE no meio do voo: nem o tick da decolagem (que entra no ar)
      // nem o da queda (que sai dele). E nesses ticks que "passar por baixo do
      // arco nao machuca" tem de valer.
      if (moodBefore === DEVOURER_AIRBORNE && worm.mood === DEVOURER_AIRBORNE) {
        airborneTicks++;
        longestFlight = Math.max(longestFlight, airborneTicks);
        midFlightDamage += Math.max(0, hpBefore - state.player.hp);
        midFlightSilt += countSurface(state, SURF_SILT, px, py, 20) - siltBefore;
      } else {
        airborneTicks = 0;
      }
      if (moodBefore === DEVOURER_AIRBORNE && worm.mood !== DEVOURER_AIRBORNE) {
        landing = { x: worm.x, y: worm.y };
      }
      state.player.hp = state.player.maxHp;
    }
    return { state, worm, launch, landing, longestFlight, midFlightDamage, midFlightSilt };
  };

  it('decola LONGE de onde cai: a emergencia virou trajetoria', () => {
    const { launch, landing } = flyOnce(601);
    expect(launch, 'nunca decolou').not.toBeNull();
    expect(landing, 'nunca caiu').not.toBeNull();
    const span = Math.hypot(launch!.x - landing!.x, launch!.y - landing!.y);
    // O minimo e o que separa um arco de um pulo no lugar; o maximo existe para
    // o voo — que e tempo de dano cheio — nao virar a luta inteira.
    expect(span, `arco de ${span.toFixed(1)} tiles`).toBeGreaterThanOrEqual(DEVOURER_LEAP_MIN_RANGE - 1.5);
    expect(span).toBeLessThanOrEqual(DEVOURER_LEAP_MAX_RANGE + 1.5);
  });

  it('passar POR BAIXO do arco nao machuca, e o voo nao deixa rastro', () => {
    // A queda e mirada no jogador parado, entao o fim do voo passa exatamente
    // por cima dele: se o arco cobrasse contato, este teste veria.
    const { midFlightDamage, midFlightSilt, longestFlight } = flyOnce(602);
    expect(longestFlight, 'nao chegou a voar').toBeGreaterThan(0);
    expect(midFlightDamage, 'o meio do arco cobrou dano').toBe(0);
    // Silica solta e o que ele revira RASPANDO por baixo do chao. No ar nao ha
    // chao raspando, e a faixa que para de crescer e o aviso de que ele saiu.
    expect(midFlightSilt, 'deixou rastro estando no ar').toBe(0);
  });

  it('nunca fica presa no ar: todo arco termina', () => {
    // Regressao de um travamento real. O vao da acao arredondava para BAIXO e
    // expirava um tick antes da chegada; `advanceAction` limpava a acao, o
    // chefe caia no fluxo de IA voando e ficava suspenso a 0,1 tile do alvo,
    // para sempre. Um chefe que trava encerra a run em silencio.
    const { state, worm } = arena(603);
    let airborne = 0;
    let worst = 0;
    for (let t = 0; t < 900; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      airborne = worm.mood === DEVOURER_AIRBORNE ? airborne + 1 : 0;
      worst = Math.max(worst, airborne);
    }
    // O arco mais longo possivel leva ~25 ticks. O dobro disso e folga larga;
    // "para sempre" bate no teto de 900 e nao passa nem perto.
    expect(worst, `ficou ${worst} ticks no ar`).toBeLessThan(60);
  });

  it('deixa cratera nas DUAS pontas: o arco entrega areia em dobro', () => {
    const { state, worm, px, py } = arena(604);
    const before = countSurface(state, SURF_SILT, px, py, 20);
    let craters = 0;
    let mood = worm.mood;
    for (let t = 0; t < 400 && craters < 2; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      // Decolagem e queda sao as duas transicoes de humor do arco.
      if (mood !== DEVOURER_AIRBORNE && worm.mood === DEVOURER_AIRBORNE) craters++;
      if (mood === DEVOURER_AIRBORNE && worm.mood !== DEVOURER_AIRBORNE) craters++;
      mood = worm.mood;
    }
    expect(craters, 'o ciclo nao teve duas pontas').toBe(2);
    expect(countSurface(state, SURF_SILT, px, py, 20)).toBeGreaterThan(before);
  });
});

describe('Devorador Branco — a rajada e a janela', () => {
  /** Percorre o ciclo contando arcos ate a primeira vez que ele entala. */
  const burst = (seed: number) => {
    const { state, worm } = arena(seed);
    let arcs = 0;
    let mood = worm.mood;
    let stuckAt = -1;
    let contactDamage = 0;
    let movedWhileStuck = 0;
    let stuckPos = null;
    let airborne = 0;
    let shortestFlight = Infinity;
    for (let t = 0; t < 1200; t++) {
      const hpBefore = state.player.hp;
      stepRun(state, [emptyCommand()]);
      if (mood !== DEVOURER_AIRBORNE && worm.mood === DEVOURER_AIRBORNE) arcs++;
      if (worm.mood === DEVOURER_AIRBORNE) airborne++;
      else if (airborne > 0) { shortestFlight = Math.min(shortestFlight, airborne); airborne = 0; }
      if (mood !== DEVOURER_STUCK && worm.mood === DEVOURER_STUCK) {
        if (stuckAt < 0) stuckAt = arcs;
        stuckPos = { x: worm.x, y: worm.y };
      }
      if (mood === DEVOURER_STUCK && worm.mood === DEVOURER_STUCK) {
        // Entalado ele nao sai do lugar e nao cobra nada de quem encosta.
        movedWhileStuck = Math.max(movedWhileStuck, Math.hypot(worm.x - stuckPos.x, worm.y - stuckPos.y));
        contactDamage += Math.max(0, hpBefore - state.player.hp);
      }
      mood = worm.mood;
      // O jogador fica COLADO nele: e assim que se cobra a promessa de que a
      // janela e um convite a aproximar, e nao uma armadilha de contato.
      if (worm.mood === DEVOURER_STUCK) {
        state.player.x = worm.x + 0.4;
        state.player.y = worm.y;
      }
      state.player.hp = state.player.maxHp;
    }
    return { arcsBeforeStuck: stuckAt, movedWhileStuck, contactDamage, shortestFlight };
  };

  it('sao TRES arcos antes de a janela abrir', () => {
    // O numero e a mecanica: um arco por ciclo dava pressao constante, e
    // pressao constante nao obriga o jogador a errar. A janela paga tres.
    expect(burst(621).arcsBeforeStuck).toBe(DEVOURER_LEAPS_PER_CYCLE);
  });

  it('nenhum arco da rajada tem comprimento zero', () => {
    // O defeito que o teste acima pegou pela primeira vez: o pouso e mirado no
    // jogador, entao o salto seguinte comecava de cima dele e a direcao de
    // recuo degenerava para (0,0). O arco saia com decolagem e queda no MESMO
    // tick — sem voo, sem janela de dano no ar, e a rajada de tres virava uma.
    expect(burst(623).shortestFlight).toBeGreaterThan(4);
  });

  it('entalado ele nao anda e nao cobra contato de quem chega perto', () => {
    const r = burst(622);
    expect(r.movedWhileStuck, 'saiu do lugar durante a janela').toBeLessThan(0.05);
    expect(r.contactDamage, 'cobrou contato de quem aceitou o convite').toBe(0);
  });
});

describe('Devorador Branco — o vidro nega as DUAS pontas', () => {
  /**
   * Vitrifica um disco em volta do jogador e abre exatamente UMA janela de
   * areia, na distancia pedida. E o unico jeito de separar as duas recusas: com
   * o disco inteiro fechado, a QUEDA e negada primeiro e a decolagem nunca chega
   * a ser consultada.
   */
  const glassDisc = (state: SurvivalState, px: number, py: number, holeAt: number | null) => {
    const w = state.config.width;
    for (let y = py - 14; y <= py + 14; y++) {
      for (let x = px - 14; x <= px + 14; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        const d = Math.hypot(x - px, y - py);
        if (d > 14) continue;
        // A janela de queda: sempre colada no jogador, para a mira dele achar.
        if (d <= 1.5) continue;
        if (holeAt !== null && Math.abs(d - holeAt) <= 1.2) continue;
        state.surface[y * w + x] = SURF_GLASS;
        state.surfaceTimer[y * w + x] = 0;
      }
    }
  };

  const eruptsWithin = (state: SurvivalState, ticks: number): boolean => {
    for (let t = 0; t < ticks; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') return true;
      }
      state.player.hp = state.player.maxHp;
    }
    return false;
  };

  it('sem chao solto para DECOLAR ele nao salta, mesmo podendo cair', () => {
    // A queda tem onde acontecer (a areia colada no jogador), mas toda a faixa
    // de decolagem virou vidro. Antes do arco isto seria uma emergencia normal:
    // o vidro so podia negar a saida. Agora nega tambem o impulso.
    const { state, px, py } = arena(611);
    glassDisc(state, px, py, null);
    expect(eruptsWithin(state, 700), 'decolou de cima do vidro').toBe(false);
  });

  it('abrindo uma faixa de areia na distancia de decolagem, ele volta a saltar', () => {
    // O controle do teste acima, e ele importa: um Devorador que simplesmente
    // nunca saltasse passaria no primeiro sem provar nada.
    const { state, px, py } = arena(611);
    glassDisc(state, px, py, DEVOURER_LEAP_MIN_RANGE + 1);
    expect(eruptsWithin(state, 700), 'a faixa de areia nao bastou').toBe(true);
  });
});

describe('Devorador Branco — a janela de dano', () => {
  it('submerso a areia absorve quase tudo; exposto, o tiro entra inteiro', () => {
    const { state, worm } = arena(521);
    worm.mood = DEVOURER_BURROWED;
    const hp0 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    const buried = hp0 - worm.hp;

    worm.mood = DEVOURER_SURFACED;
    const hp1 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    const exposed = hp1 - worm.hp;

    expect(buried).toBeCloseTo(100 * DEVOURER_BURROWED_ARMOR, 3);
    expect(exposed).toBe(100);
    expect(exposed, 'a janela nao vale mais que o mergulho').toBeGreaterThan(buried * 4);
  });

  it('depois da rajada ele ENTALA, e depois volta para baixo', () => {
    const { state, worm } = arena(522);
    let stuck = false;
    for (let t = 0; t < 900 && !stuck; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_STUCK) stuck = true;
    }
    expect(stuck, 'nunca chegou a entalar').toBe(true);

    let reburrowed = false;
    for (let t = 0; t < 400 && !reburrowed; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_BURROWED) reburrowed = true;
    }
    expect(reburrowed, 'ficou entalado para sempre').toBe(true);
  });

  it('entalado o tiro entra INTEIRO, como no ar', () => {
    const { state, worm } = arena(523);
    worm.mood = DEVOURER_STUCK;
    const hp0 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    expect(hp0 - worm.hp, 'a janela nao vale o que promete').toBe(100);
  });
});
