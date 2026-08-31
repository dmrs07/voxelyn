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
import { damageEntity, spawnEnemy, stunEntity } from '../src/entities';
import { igniteCell } from '../src/cells';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import {
  DEVOURER_BURROWED_ARMOR,
  DEVOURER_ERUPT_WINDUP_TICKS,
  DEVOURER_LEAP_MAX_RANGE,
  DEVOURER_LEAP_MIN_RANGE,
  DEVOURER_LEAPS_PER_CYCLE,
  DEVOURER_BURROW_MIN_TICKS,
  DEVOURER_REPEAT_MIN_GAP,
  CONDUCTIVE_STUN_TICKS,
  DEVOURER_MAW_BITE_DAMAGE,
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_PULL_CORE,
  DEVOURER_MAW_RADIUS,
  DEVOURER_MAW_SPOOL_TICKS,
  DEVOURER_MAW_TICKS,
  TICK_HZ,
  UNDERTAKER_PULL_TILES,
  SOLID_ROCK,
  DEFAULT_SECTOR_COUNT,
  SOLID_NONE,
  SURF_GLASS,
  SURF_NONE,
  SURF_SILT,
} from '../src/constants';
import {
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_MAW,
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

/**
 * Abre a boca AGORA, num ponto escolhido pelo teste.
 *
 * O caminho natural ate ela e uma rajada inteira de tres arcos, e as rajadas
 * caem onde o chefe mira — nao onde o teste precisa medir. Forcar o humor e a
 * unica forma de isolar o vortice do resto do ciclo: o que se quer observar e a
 * sucao, e nao a pontaria que levou ate ela.
 */
const openMaw = (
  state: SurvivalState,
  worm: SurvivalState['enemies'][number],
  x: number,
  y: number,
  /**
   * Abrir a boca JA ABERTA de todo, pulando a rampa.
   *
   * O relogio da rampa e o tick da run, e uma run recem-criada esta no tick 0:
   * nao existe passado onde ancorar uma boca que ja terminou de abrir. Empurrar
   * o relogio para a frente e o que deixa um teste medir a sucao PLENA sem ter
   * de simular a rajada inteira que levaria ate ela — e sem confundir "a rampa
   * ainda esta subindo" com "a sucao esta fraca".
   */
  spooled = false
) => {
  if (spooled) state.tick += DEVOURER_MAW_SPOOL_TICKS;
  worm.x = x;
  worm.y = y;
  worm.mood = DEVOURER_MAW;
  worm.action = undefined;
  worm.nextActionAt = state.tick + DEVOURER_MAW_TICKS;
  state.bossRuntime.mawOpenedAt = spooled ? state.tick - DEVOURER_MAW_SPOOL_TICKS : state.tick;
};

/** Poe o jogador fora do alcance da boca, para a janela poder correr inteira. */
const keepClearOfMaw = (state: SurvivalState, worm: SurvivalState['enemies'][number]) => {
  if (worm.mood !== DEVOURER_MAW) return;
  state.player.x = worm.x + DEVOURER_MAW_RADIUS + 3;
  state.player.y = worm.y;
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
      if (bossArchetypeForBiome(sectorBiome(seed, DEFAULT_SECTOR_COUNT)) !== 'white_devourer') continue;
      const state = createRun({ seed, sector: DEFAULT_SECTOR_COUNT });
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
      if (mood !== DEVOURER_MAW && worm.mood === DEVOURER_MAW) {
        if (stuckAt < 0) stuckAt = arcs;
        stuckPos = { x: worm.x, y: worm.y };
      }
      if (mood === DEVOURER_MAW && worm.mood === DEVOURER_MAW) {
        // Entalado ele nao sai do lugar e nao cobra nada de quem encosta.
        movedWhileStuck = Math.max(movedWhileStuck, Math.hypot(worm.x - stuckPos.x, worm.y - stuckPos.y));
        contactDamage += Math.max(0, hpBefore - state.player.hp);
      }
      mood = worm.mood;
      // O jogador e mantido DENTRO do disco e fora da garganta: e assim que se
      // cobra a promessa de que a janela continua sendo um convite a aproximar,
      // e nao uma hitbox de contato. Colado nele ja nao serve de sonda — dali
      // para dentro nao ha corpo, ha boca, e o que o teste mediria seria a
      // mordida em vez do contato.
      if (worm.mood === DEVOURER_MAW) {
        state.player.x = worm.x + DEVOURER_MAW_BITE_RADIUS + 0.8;
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

  it('de boca aberta ele nao anda, e chegar perto continua nao custando vida', () => {
    // As duas metades da janela que a boca NAO revogou. Ele continua imovel — a
    // boca espera, o mundo e que anda ate ela — e estar perto dele continua
    // sendo de graca. O que a boca cobra e posicao, e so na garganta ela cobra
    // vida.
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

  it('depois da rajada a BOCA abre, e depois ele volta para baixo', () => {
    const { state, worm } = arena(522);
    let opened = false;
    for (let t = 0; t < 900 && !opened; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_MAW) opened = true;
    }
    expect(opened, 'nunca chegou a abrir a boca').toBe(true);
    expect(state.bossRuntime.mawOpenedAt, 'a boca abriu sem marcar o instante')
      .toBeGreaterThanOrEqual(0);

    let reburrowed = false;
    for (let t = 0; t < 400 && !reburrowed; t++) {
      // Fora do disco: um jogador parado dentro dele e engolido antes de a
      // janela fechar, e a run acaba antes de o teste ver o mergulho.
      keepClearOfMaw(state, worm);
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (worm.mood === DEVOURER_BURROWED) reburrowed = true;
    }
    expect(reburrowed, 'ficou de boca aberta para sempre').toBe(true);
    expect(state.bossRuntime.mawOpenedAt, 'a boca fechou e o instante ficou para tras').toBe(-1);
  });

  it('de boca aberta o tiro entra INTEIRO, como no ar', () => {
    const { state, worm } = arena(523);
    worm.mood = DEVOURER_MAW;
    const hp0 = worm.hp;
    damageEntity(state, worm, 100, [], { kind: 'player_shot' });
    expect(hp0 - worm.hp, 'a janela nao vale o que promete').toBe(100);
  });
});

describe('Devorador Branco — o repouso e a rajada legivel', () => {
  /**
   * O relato de playtest: "logo no comeco da fase ele ja chega em mim, ele fica
   * pulando que nem um louco". Nao era desbalanceamento — era a maquina de
   * estados sem estado de repouso e sem espaco entre os arcos.
   */
  it('longe, ele NAO caca: o chefe tem estado de repouso', () => {
    // Ele saía do portao de aggro comum (tem passo proprio) e por isso nao
    // tinha portao nenhum: cacava desde o tick zero, do outro lado do setor,
    // atravessando parede atras de um jogador que ainda estava descendo.
    const { state, worm } = arena(701);
    worm.x += 24;
    const x0 = worm.x;
    const y0 = worm.y;
    let erupted = false;
    for (let t = 0; t < 300; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') erupted = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(erupted, 'emergiu sem nunca ter notado ninguem').toBe(false);
    expect(Math.hypot(worm.x - x0, worm.y - y0), 'caçou de fora do proprio alcance')
      .toBeLessThan(0.5);
  });

  it('notar nao e atacar: a primeira emergencia fica devendo um mergulho', () => {
    // `nextActionAt` nasce em zero, entao a emergencia saia no proprio tick em
    // que ele notava o jogador — uma cratera na cara de quem nunca tinha visto
    // o rastro. A regra do encontro e que a faixa de areia avise ANTES,
    // inclusive na primeira vez.
    const { state } = arena(702);
    let firstErupt = -1;
    for (let t = 0; t < 300 && firstErupt < 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.action === 'erupt') firstErupt = t;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(firstErupt, 'nunca emergiu: o teste nao mede nada').toBeGreaterThanOrEqual(0);
    expect(firstErupt, 'atacou no tick em que notou o jogador')
      .toBeGreaterThanOrEqual(DEVOURER_BURROW_MIN_TICKS);
  });

  it('as crateras da rajada nao se empilham: tres arcos, tres lugares', () => {
    // A mira sai da posicao PREVISTA do jogador, e um jogador parado tem sempre
    // a mesma posicao prevista: sem distancia minima, os tres arcos caíam quase
    // no mesmo tile e a rajada virava um ataque piscando.
    const { state } = arena(703);
    const landings: Array<{ x: number; y: number }> = [];
    for (let t = 0; t < 900; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'action_start' || ev.action !== 'erupt') continue;
        landings.push({ x: state.bossRuntime.leapToX, y: state.bossRuntime.leapToY });
      }
      state.player.hp = state.player.maxHp;
    }
    expect(landings.length, 'nao houve rajada para medir').toBeGreaterThanOrEqual(2);
    let worst = Infinity;
    for (let k = 1; k < landings.length; k++) {
      worst = Math.min(worst, Math.hypot(landings[k].x - landings[k - 1].x, landings[k].y - landings[k - 1].y));
    }
    expect(worst, `duas crateras seguidas a ${worst.toFixed(1)} tiles`)
      .toBeGreaterThanOrEqual(DEVOURER_REPEAT_MIN_GAP - 1.5);
  });
});

// ---------------------------------------------------------------------------

describe('Devorador Branco — a BOCA', () => {
  /**
   * O que esta secao protege, e por que ela existe.
   *
   * A janela do Devorador era uma TORRE: ele entalava imovel e inofensivo, e
   * usar a abertura nao pedia nada alem de municao. A boca troca isso sem tocar
   * na promessa — ele continua imovel e continua sem couraça — acrescentando a
   * unica coisa que faltava: um preco por ficar la.
   *
   * As tres coisas que nao podem quebrar, em ordem de gravidade:
   *
   * 1. A SUCAO E GRADUAL. Ela nao teleporta, nao abre pronta e nao alcanca o
   *    disco inteiro no tick do pouso. Um vortice instantaneo devolveria o
   *    encontro a uma armadilha sem contra-jogo — pior que a torre que ele
   *    substituiu, porque puniria justamente quem aceita o convite.
   * 2. A SAIDA EXISTE, E E PERICIA. Fora da linha do sem-volta anda-se para
   *    fora; sobre vidro anda-se para fora de qualquer ponto; atras de uma
   *    quina o arrasto para. Nenhuma delas e automatica, e nenhuma delas pode
   *    sumir.
   * 3. A GARGANTA E UMA REGRA. Chegar la custa 200, e custa igual para bicho e
   *    para jogador.
   */

  it('a boca ABRE devagar: o alcance cresce em vez de nascer pronto', () => {
    // A leitura que o playtest exige da janela: o primeiro momento dela ainda e
    // a janela de sempre. Um jogador parado a meio disco nao pode ser tocado no
    // tick em que o chefe pousa.
    const { state, worm, px, py } = arena(701);
    const start = px + 0.5;
    const stand = DEVOURER_MAW_RADIUS - 1.5;
    openMaw(state, worm, start, py + 0.5);
    state.player.x = start + stand;
    state.player.y = py + 0.5;

    stepRun(state, [emptyCommand()]);
    expect(state.player.x - worm.x, 'a boca ja puxava no primeiro tick').toBeCloseTo(stand, 3);

    // E, aberta por inteiro, a MESMA posicao passa a ser puxada.
    openMaw(state, worm, start, py + 0.5, true);
    state.player.x = start + stand;
    state.player.y = py + 0.5;
    stepRun(state, [emptyCommand()]);
    expect(state.player.x - worm.x, 'aberta de todo, a boca nao puxou nada')
      .toBeLessThan(stand - 0.001);
  });

  it('puxa AOS POUCOS: nenhum tick arranca o corpo do lugar', () => {
    // O contraste e com o eletroima do Coveiro, e ele e deliberado. O Coveiro
    // arranca UNDERTAKER_PULL_TILES (5,5) num tick porque o golpe dele e um
    // evento: acontece, resolve, acaba. A boca e um LUGAR, e um lugar que
    // arrancasse o corpo de uma vez nao seria um lugar — seria um teleporte com
    // raio, e nada do que o jogador fizesse entre um tick e o seguinte
    // importaria.
    //
    // O teto e a sucao maxima dividida pela taxa de tick: um terco de tile no
    // pior ponto do disco, dezesseis vezes menos que o puxao do Coveiro.
    const { state, worm, px, py } = arena(702);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    const cap = DEVOURER_MAW_PULL_CORE / TICK_HZ;
    let worst = 0;
    for (let d = DEVOURER_MAW_RADIUS - 0.2; d > DEVOURER_MAW_BITE_RADIUS; d -= 0.25) {
      state.player.x = worm.x + d;
      state.player.y = worm.y;
      const before = state.player.x;
      stepRun(state, [emptyCommand()]);
      worst = Math.max(worst, before - state.player.x);
      state.player.hp = state.player.maxHp;
    }
    expect(worst, `um tick arrancou ${worst.toFixed(2)} tiles`).toBeLessThanOrEqual(cap);
    expect(worst, 'nenhum ponto do disco puxou nada').toBeGreaterThan(0);
    expect(worst * 4, 'a boca puxa como um eletroima').toBeLessThan(UNDERTAKER_PULL_TILES);
  });

  it('atravessar o disco e uma VIAGEM: ha tempo de reagir mesmo parado', () => {
    // A outra metade de "aos poucos", e a que vale para quem joga: um jogador
    // que nao faz NADA, na borda do disco e com a boca ja aberta de todo, ainda
    // leva segundos ate a garganta. Esse tempo e o espaco onde a pericia cabe —
    // andar, esquivar, procurar vidro ou uma quina. Sem ele o golpe seria uma
    // sentenca decidida no instante do pouso.
    const { state, worm, px, py } = arena(712);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS - 0.05;
    state.player.y = worm.y;
    let ticks = 0;
    while (ticks < 400 && Math.hypot(state.player.x - worm.x, state.player.y - worm.y) > DEVOURER_MAW_BITE_RADIUS) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      ticks++;
    }
    expect(ticks, 'a borda cuspiu o jogador na garganta').toBeGreaterThan(TICK_HZ * 1.5);
    // E o teto: a viagem tem de TERMINAR. Uma sucao que nunca fechasse a conta
    // faria da janela um lugar seguro para quem simplesmente ignorasse a boca.
    expect(ticks, 'parado na borda, nunca foi engolido').toBeLessThan(DEVOURER_MAW_TICKS);
  });

  it('a sucao CRESCE para dentro: cada passo em direcao a boca puxa mais', () => {
    // A curva e o que ensina o jogador a ler a distancia. Se a forca fosse
    // plana, "estou perto demais" deixaria de ser uma informacao que o corpo
    // dele entrega, e o disco viraria uma linha binaria.
    const { state, worm, px, py } = arena(703);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    let previous = -1;
    for (let d = DEVOURER_MAW_RADIUS - 0.5; d > DEVOURER_MAW_BITE_RADIUS + 0.5; d -= 0.5) {
      state.player.x = worm.x + d;
      state.player.y = worm.y;
      const before = state.player.x;
      stepRun(state, [emptyCommand()]);
      const drag = before - state.player.x;
      expect(drag, `a ${d.toFixed(1)} tiles a sucao afrouxou`).toBeGreaterThan(previous);
      previous = drag;
      state.player.hp = state.player.maxHp;
    }
  });

  it('fora do disco ninguem e puxado — a boca nao e a camara', () => {
    const { state, worm, px, py } = arena(704);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS + 0.5;
    state.player.y = worm.y;
    const before = state.player.x;
    for (let t = 0; t < 20; t++) stepRun(state, [emptyCommand()]);
    expect(state.player.x, 'puxou de fora do alcance').toBeCloseTo(before, 2);
  });

  it('a GARGANTA devora: quem chega no centro leva a sentenca inteira', () => {
    const { state, worm, px, py } = arena(705);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_BITE_RADIUS - 0.3;
    state.player.y = worm.y;
    const hp0 = state.player.hp;
    stepRun(state, [emptyCommand()]);
    // Vida cheia e 100 e a mordida e 200: o que se mede aqui e que ela nao e um
    // dano a mais, e um desfecho. O jogador cai.
    expect(hp0 - state.player.hp, 'a garganta cobrou menos que a vida inteira').toBe(hp0);
    expect(DEVOURER_MAW_BITE_DAMAGE).toBeGreaterThan(state.player.maxHp);
  });

  it('a garganta so cobra depois de EXISTIR: quem levou a cratera tem tempo', () => {
    // O caso que sem esta regra seria fatal e injusto. A queda do arco e mirada
    // no jogador, entao a janela SEMPRE abre com o corpo dele em cima do centro.
    // Uma garganta valendo desde o primeiro tick mataria, sem sinal e sem tempo
    // de resposta, exatamente quem acabou de levar a cratera.
    const { state, worm, px, py } = arena(713);
    openMaw(state, worm, px + 0.5, py + 0.5);
    state.player.x = worm.x;
    state.player.y = worm.y;
    const hp0 = state.player.hp;
    // Meio segundo em cima do centro, com a boca recem-aberta: nao mata.
    for (let t = 0; t < TICK_HZ / 2; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.x = worm.x;
      state.player.y = worm.y;
    }
    expect(state.player.hp, 'a boca mordeu antes de abrir').toBe(hp0);
    expect(state.player.alive).toBe(true);

    // E o controle: aberta de todo, o mesmo lugar e a sentenca.
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x;
    state.player.y = worm.y;
    stepRun(state, [emptyCommand()]);
    expect(state.player.hp, 'aberta de todo, a garganta perdoou').toBe(0);
  });

  it('ATORDOAR nao desliga a boca: a succao nao e uma decisao dele', () => {
    // Regressao de um defeito real, e o pior tipo: ele devolvia o chefe ao que
    // este encontro inteiro existe para deixar de ser.
    //
    // A boca rodava dentro do fluxo de IA, atras do portao generico de
    // atordoamento (`updateEnemies`). Corrente atordoa por 1,2 s e o Devorador
    // nao esta em `isStoneEnemy` — entao um unico tiro condutivo desligava
    // succao, refeicao de areia e mordida por 24 ticks, enquanto `mawOpenedAt` e
    // `nextActionAt` seguiam correndo em tick absoluto. O jogador ficava com a
    // janela SEM o preco dela, com o vortice ainda desenhado no chao prometendo
    // uma succao que nao acontecia: a TORRE de volta, comprada por um modulo.
    const { state, worm, px, py } = arena(716);
    const w = state.config.width;
    for (let y = py - 8; y <= py + 8; y++) {
      for (let x = px - 8; x <= px + 8; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        state.surface[y * w + x] = SURF_SILT;
        state.surfaceTimer[y * w + x] = 0;
      }
    }
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + 4;
    state.player.y = worm.y;

    stunEntity(state, worm, CONDUCTIVE_STUN_TICKS);
    expect(worm.stunnedUntil, 'o chefe nem chegou a ser atordoado').toBeGreaterThan(state.tick);

    const from = state.player.x;
    const siltBefore = countSurface(state, SURF_SILT, px, py, 8);
    stepRun(state, [emptyCommand()]);
    expect(state.player.x, 'a succao parou no atordoamento').toBeLessThan(from - 0.001);
    expect(countSurface(state, SURF_SILT, px, py, 8), 'a boca parou de comer areia')
      .toBeLessThan(siltBefore);

    // E a garganta continua cobrando: atordoado ele nao vira chao seguro.
    state.player.x = worm.x;
    state.player.y = worm.y;
    state.player.hp = state.player.maxHp;
    stepRun(state, [emptyCommand()]);
    expect(state.player.hp, 'a garganta perdoou porque ele estava atordoado').toBe(0);
  });

  it('ANDAR ainda resolve fora da linha do sem-volta', () => {
    // A prova de que a boca nao e uma sentenca de area. Na borda do disco, um
    // jogador que simplesmente corre para longe SAI — devagar, gastando o tiro
    // que nao deu, mas sai.
    const { state, worm, px, py } = arena(706);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    state.player.x = worm.x + DEVOURER_MAW_RADIUS - 1;
    state.player.y = worm.y;
    const before = state.player.x - worm.x;
    const away = { ...emptyCommand(), move: { x: 1, y: 0 } };
    for (let t = 0; t < 40; t++) {
      stepRun(state, [away]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.player.x - worm.x, 'a borda do disco engoliu quem correu').toBeGreaterThan(before);
  });

  it('a ESQUIVA salva de dentro da linha do sem-volta, e so ela', () => {
    // A promessa central do golpe: dentro da linha, andar deixa de bastar — mas
    // nada ali e irreversivel. A esquiva percorre 2,2 tiles em 0,2 s contra
    // ~1,2 de sucao, e devolve o corpo praticamente sobre a linha, de onde a
    // caminhada volta a funcionar.
    //
    // O teste vale pelo PAR. Sem o controle de quem so anda, um encontro em que
    // ninguem fosse engolido passaria aqui sem provar nada.
    const deep = 2.5; // bem dentro da linha do sem-volta
    const away = { ...emptyCommand(), move: { x: 1, y: 0 } };

    const walked = arena(714);
    openMaw(walked.state, walked.worm, walked.px + 0.5, walked.py + 0.5, true);
    walked.state.player.x = walked.worm.x + deep;
    walked.state.player.y = walked.worm.y;
    for (let t = 0; t < 25; t++) stepRun(walked.state, [away]);
    expect(walked.state.player.alive, 'andar bastou de dentro da linha').toBe(false);

    const dodged = arena(715);
    openMaw(dodged.state, dodged.worm, dodged.px + 0.5, dodged.py + 0.5, true);
    dodged.state.player.x = dodged.worm.x + deep;
    dodged.state.player.y = dodged.worm.y;
    for (let t = 0; t < 25; t++) {
      stepRun(dodged.state, [t === 0 ? { ...away, dodge: true } : away]);
    }
    expect(dodged.state.player.alive, 'a esquiva nao salvou ninguem').toBe(true);
    expect(
      dodged.state.player.x - dodged.worm.x,
      'a esquiva nao devolveu o corpo para fora da linha'
    ).toBeGreaterThan(deep);
  });

  it('o VIDRO segura: sobre ele da para sair andando de qualquer ponto', () => {
    // A terceira alavanca da mesma materia. Calor sobre silica solta ja negava a
    // emergencia e ja esticava o arco; agora tambem da chao onde a boca nao tem
    // o que agarrar. Colado na garganta, onde a areia e uma sentenca, o vidro
    // ainda devolve a caminhada.
    const { state, worm, px, py } = arena(707);
    const w = state.config.width;
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    const startAt = DEVOURER_MAW_BITE_RADIUS + 0.6;

    // Primeiro em AREIA: dali para fora, andar nao basta.
    state.player.x = worm.x + startAt;
    state.player.y = worm.y;
    const away = { ...emptyCommand(), move: { x: 1, y: 0 } };
    for (let t = 0; t < 12; t++) {
      stepRun(state, [away]);
      state.player.hp = state.player.maxHp;
    }
    const onSilt = state.player.x - worm.x;
    expect(onSilt, 'a areia soltou quem estava colado na garganta').toBeLessThan(startAt);

    // Agora a MESMA cena com o chao vitrificado.
    for (let y = py - 12; y <= py + 12; y++) {
      for (let x = px - 12; x <= px + 12; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        state.surface[y * w + x] = SURF_GLASS;
        state.surfaceTimer[y * w + x] = 0;
      }
    }
    state.player.x = worm.x + startAt;
    state.player.y = worm.y;
    state.player.hp = state.player.maxHp;
    for (let t = 0; t < 12; t++) {
      stepRun(state, [away]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.player.x - worm.x, 'o vidro nao segurou nada').toBeGreaterThan(startAt);
  });

  it('a PAREDE para o arrasto: cobertura e a saida que nao gasta esquiva', () => {
    const { state, worm, px, py } = arena(708);
    const w = state.config.width;
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    // Uma parede entre a boca e o jogador, e o jogador do lado de fora dela.
    for (let dy = -6; dy <= 6; dy++) state.solid[(py + dy) * w + px + 4] = SOLID_ROCK;
    state.player.x = px + 5.5;
    state.player.y = py + 0.5;
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.player.x, 'foi arrastado ATRAVES da rocha').toBeGreaterThan(px + 4.9);
  });

  it('engole a AREIA do disco, e nunca o vidro', () => {
    // O vortice de areia e o desenho do raio: a faixa de chao limpo que sobra
    // diz ate onde a sucao chega. E ele COME de verdade — silica engolida nao
    // vitrifica mais, que e a pressao contra adiar o contra-jogo.
    const { state, worm, px, py } = arena(709);
    const w = state.config.width;
    for (let y = py - 10; y <= py + 10; y++) {
      for (let x = px - 10; x <= px + 10; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        state.surface[y * w + x] = SURF_SILT;
        state.surfaceTimer[y * w + x] = 0;
      }
    }
    // Uma placa de vidro dentro do disco: ela tem de sobreviver a refeicao.
    const glass = (py + 2) * w + px + 2;
    state.surface[glass] = SURF_GLASS;
    const siltBefore = countSurface(state, SURF_SILT, px, py, 10);

    openMaw(state, worm, px + 0.5, py + 0.5);
    for (let t = 0; t < DEVOURER_MAW_SPOOL_TICKS; t++) {
      keepClearOfMaw(state, worm);
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }

    const siltAfter = countSurface(state, SURF_SILT, px, py, 10);
    expect(siltAfter, 'a boca nao engoliu areia nenhuma').toBeLessThan(siltBefore);
    expect(state.surface[glass], 'a boca desfez a decisao do jogador').toBe(SURF_GLASS);
    // Fora do raio a areia continua la: a refeicao delimita o disco, nao o mapa.
    expect(countSurface(state, SURF_SILT, px + 9, py + 9, 1), 'comeu fora do alcance')
      .toBeGreaterThan(0);
  });

  it('a areia some DE DENTRO PARA FORA: a borda limpa e o cronometro', () => {
    const { state, worm, px, py } = arena(710);
    const w = state.config.width;
    for (let y = py - 10; y <= py + 10; y++) {
      for (let x = px - 10; x <= px + 10; x++) {
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        state.surface[y * w + x] = SURF_SILT;
        state.surfaceTimer[y * w + x] = 0;
      }
    }
    openMaw(state, worm, px + 0.5, py + 0.5);
    const eaten: number[] = [];
    for (let t = 0; t < DEVOURER_MAW_SPOOL_TICKS; t += 15) {
      for (let k = 0; k < 15; k++) {
        keepClearOfMaw(state, worm);
        stepRun(state, [emptyCommand()]);
        state.player.hp = state.player.maxHp;
      }
      eaten.push(countSurface(state, SURF_NONE, px, py, 10));
    }
    for (let i = 1; i < eaten.length; i++) {
      expect(eaten[i], 'a borda limpa parou de crescer').toBeGreaterThan(eaten[i - 1]);
    }
  });

  it('puxa TUDO: o bicho no disco e arrastado e devorado como qualquer um', () => {
    // A sucao nao pergunta de quem e o corpo, e essa e a jogada que ela abre —
    // quem arrasta um bando para dentro do raio resolve dois problemas de uma
    // vez. Sem isso a janela seria uma armadilha unilateral.
    const { state, worm, px, py } = arena(711);
    openMaw(state, worm, px + 0.5, py + 0.5, true);
    const prey = spawnEnemy(state, 'miner', px + 3.5, py + 0.5, false);
    const from = Math.hypot(prey.x - worm.x, prey.y - worm.y);
    let devoured = false;
    for (let t = 0; t < 60 && !devoured; t++) {
      keepClearOfMaw(state, worm);
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      devoured = !prey.alive;
    }
    expect(Math.hypot(prey.x - worm.x, prey.y - worm.y), 'o bicho nao foi puxado')
      .toBeLessThan(from);
    expect(devoured, 'chegou na garganta e sobreviveu').toBe(true);
  });
});
