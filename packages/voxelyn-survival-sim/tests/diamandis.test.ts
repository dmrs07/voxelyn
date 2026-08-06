// DIAMANDIS — o chefe da Cicatriz Aurix.
//
// O que estes testes protegem, em ordem de gravidade:
// 1. ELE NAO E UM ROBO QUE ATIRA. As tres armas dele sao FERRAMENTAS, e cada
//    uma tem de fazer a coisa industrial que a promete: a broca ABRE galeria
//    (e deixa minerio de pe), a demolicao marca o chao ANTES de implodir, e o
//    feixe varre inofensivo antes de queimar.
// 2. TELEGRAFO SEMPRE. Nenhum dano do encontro pode chegar sem sinal — e a
//    marca da demolicao nao pode perseguir, senao sair dela deixa de ser
//    resposta.
// 3. O COLAPSO muda a luta, e nao so os numeros: uma arma DESLIGA.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { damageEntity, spawnEnemy } from '../src/entities';
import { bossArchetypeForBiome } from '../src/bosses';
import { sectorBiome } from '../src/strata';
import {
  DIAMANDIS_BEAM_WINDUP_TICKS,
  DIAMANDIS_DEMOLISH_CHARGES,
  DIAMANDIS_DEMOLISH_WINDUP_TICKS,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  DIAMANDIS_MODULE_COUNT,
  DIAMANDIS_MODULE_EXPOSE_AT,
  DIAMANDIS_MODULE_ORE,
  DIAMANDIS_REACTOR_HP_FRACTION,
  DIAMANDIS_SALVAGE_CREW_CAP,
  PLAYER_SPEED,
  DEFAULT_SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_EMBER,
  SURF_NONE,
} from '../src/constants';
import {
  BOSS_MODULE_DRILL,
  BOSS_MODULE_SCANNER,
  BOSS_MODULE_TOWER,
  BOSS_PHASE_REACTOR,
  DISCOVERY_DIAMANDIS_CORRIDOR,
  type SemanticEvent,
  type SurvivalState,
} from '../src/types';

const clearArena = (state: SurvivalState, radius: number): void => {
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

/** Arena limpa com o Diamandis a `gap` tiles a leste do jogador. */
const duel = (seed: number, gap: number) => {
  const state = createRun({ seed });
  // O jogador vai para o MEIO do mapa antes de tudo: a entrada da run cai onde
  // a seed mandar, e perto da borda as cargas laterais da salva caem fora do
  // mundo — o teste passaria a medir a moldura em vez do golpe.
  state.player.x = Math.floor(state.config.width / 2) + 0.5;
  state.player.y = Math.floor(state.config.height / 2) + 0.5;
  clearArena(state, 24);
  state.enemies = [];
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  const boss = spawnEnemy(state, 'diamandis', px + gap, py, false);
  // ACORDADO. Como o Guardiao, ele dorme ate ser notado (`guardsTheCore`) e
  // so decide alguma coisa depois disso — sem isto, todo teste a mais de 7
  // tiles mediria uma maquina parada.
  state.bossRuntime.awake = true;
  return { state, boss, px, py };
};

/** Roda ate ver `action_start` da acao pedida, e devolve o evento. */
const awaitAction = (
  state: SurvivalState,
  entity: number,
  action: string,
  ticks: number,
): SemanticEvent | null => {
  for (let t = 0; t < ticks; t++) {
    for (const ev of stepRun(state, [emptyCommand()]).events) {
      if (ev.t === 'action_start' && ev.entity === entity && ev.action === action) return ev;
    }
  }
  return null;
};

describe('Diamandis — onde ele mora', () => {
  it('e o chefe do mapa final marcado pela Cicatriz Aurix', () => {
    expect(bossArchetypeForBiome({ stratum: 'ferric', occupation: 'aurix', lineage: 'industrial' }))
      .toBe('diamandis');
    // E aparece de verdade numa run: a linhagem industrial termina em Aurix.
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      if (bossArchetypeForBiome(sectorBiome(seed, DEFAULT_SECTOR_COUNT)) !== 'diamandis') continue;
      const state = createRun({ seed, sector: DEFAULT_SECTOR_COUNT });
      found = state.enemies.some((e) => e.archetype === 'diamandis');
      expect(found, `seed ${seed}: bioma Aurix sem Diamandis na camara`).toBe(true);
    }
    expect(found, 'nenhuma seed da amostra terminou em Cicatriz Aurix').toBe(true);
  });
});

describe('Diamandis — broca de avanco', () => {
  it('telegrafa parado e so entao atravessa', () => {
    const { state, boss } = duel(301, 11);
    const startX = boss.x;
    const ev = awaitAction(state, boss.id, 'drill', 90);
    expect(ev, 'nunca acionou a broca').not.toBeNull();
    if (!ev || ev.t !== 'action_start') return;
    expect(ev.releaseTick - ev.startTick).toBe(DIAMANDIS_DRILL_WINDUP_TICKS);
    expect(Math.abs(boss.x - startX), 'moveu durante o proprio aviso').toBeLessThan(1.5);
  });

  it('ABRE galeria pela rocha — e a pedra nao encerra a acao', () => {
    // O contraste com o Corcel: ele PARA na pedra (ler o telegrafo e por uma
    // parede e o contra-jogo dele). A broca atravessa, e o corredor fica.
    const { state, boss, px, py } = duel(302, 11);
    const w = state.config.width;
    const ev = awaitAction(state, boss.id, 'drill', 90);
    expect(ev).not.toBeNull();

    // Parede cheia entre os dois, levantada depois do telegrafo.
    const wallX = px + 6;
    for (let dy = -5; dy <= 5; dy++) state.solid[(py + dy) * w + wallX] = SOLID_ROCK;
    const before = boss.x;

    for (let t = 0; t < DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS; t++) {
      stepRun(state, [emptyCommand()]);
    }

    let opened = 0;
    for (let dy = -2; dy <= 2; dy++) {
      if (state.solid[(py + dy) * w + wallX] === SOLID_NONE) opened++;
    }
    expect(opened, 'a broca nao abriu vao na parede').toBeGreaterThanOrEqual(3);
    expect(boss.x, 'a broca nao avancou').toBeLessThan(before);
  });

  it('deixa MINERIO de pe: a passagem dele expoe veio, nao o consome', () => {
    const { state, px, py } = duel(303, 11);
    const w = state.config.width;
    const oreX = px + 6;
    for (let dy = -3; dy <= 3; dy++) state.solid[(py + dy) * w + oreX] = SOLID_ORE;
    // Rocha em volta, para haver o que derrubar em torno do veio.
    for (let dy = -3; dy <= 3; dy++) state.solid[(py + dy) * w + oreX + 1] = SOLID_ROCK;

    for (let t = 0; t < 90 + DIAMANDIS_DRILL_TICKS; t++) stepRun(state, [emptyCommand()]);

    let ore = 0;
    for (let dy = -3; dy <= 3; dy++) if (state.solid[(py + dy) * w + oreX] === SOLID_ORE) ore++;
    expect(ore, 'a broca comeu o minerio em vez de expo-lo').toBeGreaterThan(0);
  });

  it('ver a galeria abrir marca a Descoberta do corredor', () => {
    const { state, boss, px, py } = duel(304, 11);
    const w = state.config.width;
    for (let dy = -4; dy <= 4; dy++) state.solid[(py + dy) * w + px + 5] = SOLID_ROCK;
    for (let t = 0; t < 90 + DIAMANDIS_DRILL_TICKS; t++) stepRun(state, [emptyCommand()]);
    expect(state.stats.discoveries & DISCOVERY_DIAMANDIS_CORRIDOR).not.toBe(0);
    expect(boss.alive).toBe(true);
  });
});

describe('Diamandis — salva de demolicao', () => {
  it('marca o chao antes de implodir, e a marca NAO persegue', () => {
    // A resposta inteira do golpe e sair do circulo, e ela so existe porque o
    // circulo fica onde nasceu. Uma marca que seguisse seria dano sem
    // contra-jogo com um telegrafo bonito por cima.
    const { state, boss } = duel(311, 7);
    const markers: Array<{ x: number; y: number; fireTick: number }> = [];
    for (let t = 0; t < 120 && markers.length === 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'blast_marker') markers.push({ x: ev.x, y: ev.y, fireTick: ev.fireTick });
      }
    }
    expect(markers.length, 'nenhuma carga marcada').toBe(DIAMANDIS_DEMOLISH_CHARGES);
    expect(markers[0].fireTick).toBeGreaterThan(state.tick);
    expect(boss.action?.kind).toBe('demolish');

    // O jogador anda; as celulas marcadas continuam onde estavam.
    const frozen = [...state.bossRuntime.blastCells];
    const move = emptyCommand();
    move.move = { x: -1, y: 0 };
    for (let t = 0; t < 8; t++) stepRun(state, [move]);
    expect(state.bossRuntime.blastCells).toEqual(frozen);
  });

  it('a carga explode NA marca, e o telegrafo inteiro corre antes', () => {
    const { state, boss } = duel(312, 7);
    let fireTick = 0;
    for (let t = 0; t < 120 && fireTick === 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'blast_marker') fireTick = ev.fireTick;
      }
    }
    expect(fireTick).toBeGreaterThan(0);
    expect(boss.action?.kind).toBe('demolish');

    let exploded = false;
    for (let t = 0; t < DIAMANDIS_DEMOLISH_WINDUP_TICKS + 12 && !exploded; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'explosion' && ev.owner === boss.id) exploded = true;
      }
    }
    expect(exploded, 'a salva marcou e nunca caiu').toBe(true);
    expect(state.bossRuntime.blastCells, 'as marcas ficaram penduradas').toHaveLength(0);
  });
});

describe('Diamandis — feixe de prospeccao', () => {
  it('a varredura vem ANTES e nao machuca; a potencia vem depois', () => {
    const { state, boss } = duel(321, 3);
    // A 3 tiles ele esta abaixo do minimo da broca (9) e do da demolicao (4):
    // a faixa e do feixe, que e a ferramenta de perto.
    let survey = 0;
    let powered = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 4; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t !== 'beam_line') continue;
        if (ev.powered) powered++;
        else survey++;
      }
      if (powered > 0) break;
    }
    expect(survey, 'o feixe disparou sem varrer antes').toBeGreaterThan(0);
    expect(powered, 'a varredura nunca ganhou potencia').toBeGreaterThan(0);
    expect(boss.alive).toBe(true);
  });

  it('a linha PARA na parede: nao mede nem queima do outro lado', () => {
    const { state, boss, px, py } = duel(322, 3);
    const w = state.config.width;
    for (let dy = -4; dy <= 4; dy++) state.solid[(py + dy) * w + px + 2] = SOLID_ROCK;

    let longest = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 3; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'beam_line') longest = Math.max(longest, ev.length);
      }
    }
    // O chefe esta a 4 tiles e a parede a 2 do jogador: a linha dele para bem
    // antes do comprimento nominal.
    if (longest > 0) expect(longest).toBeLessThan(8);
    expect(boss.alive).toBe(true);
  });
});

describe('Diamandis — colapso do reator', () => {
  it('abaixo da metade o reator vaza brasa, uma unica vez', () => {
    const { state, boss } = duel(331, 8);
    boss.hp = boss.maxHp * (DIAMANDIS_REACTOR_HP_FRACTION - 0.1);
    stepRun(state, [emptyCommand()]);

    expect(state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR).not.toBe(0);
    const w = state.config.width;
    let ember = 0;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const x = Math.floor(boss.x) + dx;
        const y = Math.floor(boss.y) + dy;
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        if (state.surface[y * w + x] === SURF_EMBER) ember++;
      }
    }
    expect(ember, 'o reator nao vazou nada').toBeGreaterThan(8);

    // E nao dispara de novo: e uma fase de UMA vez.
    const before = state.bossRuntime.phasesFired;
    for (let t = 0; t < 20; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.phasesFired).toBe(before);
  });

  it('o feixe DESLIGA no colapso: a segunda fase e outra luta', () => {
    const { state, boss } = duel(332, 3);
    boss.hp = boss.maxHp * (DIAMANDIS_REACTOR_HP_FRACTION - 0.1);
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_REACTOR).not.toBe(0);

    // Conta DECISOES de feixe, e nao emissoes: uma varredura que ja estava em
    // curso quando o reator caiu termina — o que o colapso desliga e a
    // capacidade de comecar outra.
    let started = 0;
    for (let t = 0; t < DIAMANDIS_BEAM_WINDUP_TICKS * 6; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'beam') started++;
      }
      // O jogador nao pode morrer no meio da medicao e falsear o resultado.
      state.player.hp = state.player.maxHp;
    }
    expect(started, 'o scanner continuou operando com o reator em colapso').toBe(0);
  });
});

describe('Diamandis — os Coveiros e a escolha', () => {
  /** Diamandis ferido no ponto pedido, com um Coveiro perto o bastante. */
  const salvageScene = (seed: number, hpFraction: number) => {
    const { state, boss, px, py } = duel(seed, 6);
    boss.hp = boss.maxHp * hpFraction;
    const coveiro = spawnEnemy(state, 'undertaker', px + 9, py, false);
    return { state, boss, coveiro, px, py };
  };

  it('os modulos SOLTAM conforme a vida cai, na ordem ensinavel', () => {
    const { state, boss } = duel(401, 6);
    expect(state.bossRuntime.modulesExposed).toBe(0);

    boss.hp = boss.maxHp * (DIAMANDIS_MODULE_EXPOSE_AT[0] - 0.01);
    stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.modulesExposed & (1 << BOSS_MODULE_DRILL)).not.toBe(0);
    expect(state.bossRuntime.modulesExposed & (1 << BOSS_MODULE_SCANNER)).toBe(0);

    boss.hp = boss.maxHp * (DIAMANDIS_MODULE_EXPOSE_AT[2] - 0.01);
    stepRun(state, [emptyCommand()]);
    for (let m = 0; m < DIAMANDIS_MODULE_COUNT; m++) {
      expect(state.bossRuntime.modulesExposed & (1 << m), `modulo ${m}`).not.toBe(0);
    }
    // Soltar NAO e perder: as armas continuam de pe enquanto ninguem arranca.
    expect(state.bossRuntime.modulesLost).toBe(0);
  });

  it('o Coveiro larga o jogador e vai ARRANCAR a peca', () => {
    const { state, coveiro } = salvageScene(402, DIAMANDIS_MODULE_EXPOSE_AT[0] - 0.05);
    let detached = -1;
    for (let t = 0; t < 400 && detached < 0; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'boss_module' && ev.state === 'detached') detached = ev.module;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(detached, 'o Coveiro nunca arrancou o modulo').toBe(BOSS_MODULE_DRILL);
    expect(state.bossRuntime.modulesLost & (1 << BOSS_MODULE_DRILL)).not.toBe(0);
    expect(coveiro.alive).toBe(true);
  });

  it('arrancado, o chefe PERDE aquela arma', () => {
    const { state, boss } = duel(403, 11);
    // A broca some; o resto da luta continua.
    state.bossRuntime.modulesExposed = 1 << BOSS_MODULE_DRILL;
    state.bossRuntime.modulesLost = 1 << BOSS_MODULE_DRILL;
    let drills = 0;
    for (let t = 0; t < 300; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === boss.id && ev.action === 'drill') drills++;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(drills, 'perfurou sem o modulo da broca').toBe(0);
  });

  it('o carregador que ESCAPA leva a recompensa junto', () => {
    const { state, coveiro } = salvageScene(404, DIAMANDIS_MODULE_EXPOSE_AT[0] - 0.05);
    let lost = false;
    for (let t = 0; t < 2000 && !lost; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'boss_module' && ev.state === 'lost') lost = true;
      }
      state.player.hp = state.player.maxHp;
    }
    expect(lost, 'o Coveiro nunca chegou a borda com a peca').toBe(true);
    expect(coveiro.alive, 'saiu do mapa, entao nao esta mais na luta').toBe(false);
    // E ninguem o abateu: sair do mapa nao pode virar abate no registro.
    expect(state.stats.kills.undertaker).toBe(0);
  });

  it('matar o carregador DERRUBA a peca — e ela ainda e sua', () => {
    const { state, coveiro } = salvageScene(405, DIAMANDIS_MODULE_EXPOSE_AT[0] - 0.05);
    for (let t = 0; t < 400 && state.bossRuntime.modulesLost === 0; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.bossRuntime.modulesLost, 'o modulo nao chegou a ser arrancado').not.toBe(0);

    const oreBefore = state.stats.oreCollected;
    const events: SemanticEvent[] = [];
    damageEntity(state, coveiro, coveiro.maxHp * 2, events, { kind: 'player_shot' });
    expect(events.some((e) => e.t === 'boss_module' && e.state === 'dropped')).toBe(true);
    expect(state.stats.oreCollected).toBe(oreBefore + DIAMANDIS_MODULE_ORE);
  });

  it('o abate paga pelos modulos que NAO foram levados', () => {
    const { state, boss } = duel(406, 6);
    const oreBefore = state.stats.oreCollected;
    damageEntity(state, boss, boss.maxHp * 2, [], { kind: 'player_shot' });
    // Nenhum Coveiro trabalhou: os tres modulos continuam na carcaça.
    expect(state.stats.oreCollected).toBe(oreBefore + DIAMANDIS_MODULE_COUNT * DIAMANDIS_MODULE_ORE);
  });

  it('cada modulo levado embora e uma lasca a menos no abate', () => {
    const { state, boss } = duel(407, 6);
    state.bossRuntime.modulesLost = (1 << BOSS_MODULE_DRILL) | (1 << BOSS_MODULE_TOWER);
    const oreBefore = state.stats.oreCollected;
    damageEntity(state, boss, boss.maxHp * 2, [], { kind: 'player_shot' });
    expect(state.stats.oreCollected).toBe(oreBefore + DIAMANDIS_MODULE_ORE);
  });

  it('dois Coveiros nao disputam a MESMA peca', () => {
    const { state, px, py } = salvageScene(408, DIAMANDIS_MODULE_EXPOSE_AT[1] - 0.05);
    spawnEnemy(state, 'undertaker', px + 10, py + 2, false);
    for (let t = 0; t < 60; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    const claims = state.enemies
      .filter((e) => e.alive && e.archetype === 'undertaker' && (e.mood ?? 0) > 0)
      .map((e) => e.mood);
    expect(new Set(claims).size, 'dois Coveiros no mesmo modulo').toBe(claims.length);
  });
});

describe('Diamandis — a sucata chama, e a salva antecipa', () => {
  it('o modulo solto CHAMA os Coveiros, mesmo longe do Ferrifero', () => {
    // A mecanica de sucata sempre esteve pronta e quase nunca acontecia, e o
    // motivo era geografico: o Coveiro e fauna do Estrato Ferrifero, e o
    // Diamandis nasce onde a Cicatriz Aurix domina. O playtest fechou o
    // encontro inteiro sem ver um Coveiro — a escolha mais interessante da luta
    // (deixar arrancar a peca ou defender o chefe que esta tentando te matar)
    // nunca chegou a existir, porque nao havia quem arrancasse.
    const { state, boss } = duel(801, 9);
    expect(state.enemies.filter((e) => e.archetype === 'undertaker')).toHaveLength(0);
    // Logo abaixo do primeiro limiar de exposicao: um modulo se solta.
    boss.hp = boss.maxHp * (DIAMANDIS_MODULE_EXPOSE_AT[0] - 0.02);
    for (let t = 0; t < 20; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.bossRuntime.modulesExposed, 'nenhum modulo se soltou').not.toBe(0);
    expect(
      state.enemies.filter((e) => e.alive && e.archetype === 'undertaker').length,
      'a peca solta nao chamou ninguem',
    ).toBeGreaterThan(0);
  });

  it('a equipe tem TETO: a camara do chefe nao vira galeria', () => {
    const { state, boss } = duel(802, 9);
    // Os tres limiares de uma vez: mesmo assim a sala nao pode entupir.
    boss.hp = boss.maxHp * 0.05;
    for (let t = 0; t < 60; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(state.enemies.filter((e) => e.alive && e.archetype === 'undertaker').length)
      .toBeLessThanOrEqual(DIAMANDIS_SALVAGE_CREW_CAP);
  });

  it('a Salva de Demolicao cai NA FRENTE de quem corre, e em cima de quem para', () => {
    // O anti-kite, e ele e de controle de arena e nao de velocidade: ele
    // continua sendo uma maquina de 1,5 tile/s. O que mudou e que andar em
    // circulo deixou de derrotar o golpe de graça — as cargas caíam na posicao
    // presente, e um jogador em movimento ja tinha saido de todas antes do fim
    // do telegrafo.
    const w = () => state.config.width;
    const { state, boss, px, py } = duel(803, 7);

    // PARADO: a antecipacao de quem nao se move e o proprio lugar dele.
    state.player.vx = 0;
    state.player.vy = 0;
    expect(awaitAction(state, boss.id, 'demolish', 400), 'nunca demoliu').not.toBeNull();
    const still = state.bossRuntime.blastCells.map((i) => ({ x: i % w(), y: Math.floor(i / w()) }));
    const nearest = Math.min(...still.map((c) => Math.hypot(c.x - px, c.y - py)));
    expect(nearest, 'a salva ignorou um alvo parado').toBeLessThan(4);

    // CORRENDO: as marcas tem de sair na direcao do movimento.
    const moving = duel(804, 7);
    moving.state.player.vx = 0;
    moving.state.player.vy = -PLAYER_SPEED;
    const before = moving.state.player.y;
    expect(awaitAction(moving.state, moving.boss.id, 'demolish', 400)).not.toBeNull();
    const mw = moving.state.config.width;
    const marks = moving.state.bossRuntime.blastCells.map((i) => Math.floor(i / mw));
    // O jogador anda para o NORTE (y decrescente), entao a salva tem de cair
    // em y menor que onde ele estava. Comparado com a posicao dele no instante
    // da marcacao, e nao com a inicial: ele nao parou de andar.
    const aimedAhead = marks.some((y) => y < Math.floor(moving.state.player.y));
    expect(before).toBeGreaterThan(0);
    expect(aimedAhead, 'a salva caiu atras de quem estava correndo').toBe(true);
  });
});
