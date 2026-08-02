// A fauna afinada por bioma, e o que ela cobra.
//
// O que estes testes cobram:
// 1. CHEFE ABATIDO NAO VOLTA: a extracao de retorno regenera o setor, e o
//    repovoamento carimbava o Bispo de volta na camara — o feito mais caro da
//    run desmanchando sozinho.
// 2. BOMBARDEIRO DE ENXOFRE: estoura em GAS, nao em esporo. A diferenca nao e
//    cosmetica — gas pega fogo, esporo nao.
// 3. COVEIRO: o eletroima ARRASTA o alvo (e para na parede, que e o
//    contra-jogo), e a prensa vem com telegrafo proprio.
import { describe, expect, it } from 'vitest';
import {
  BISHOP_SECTOR,
  SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_EMBER,
  SURF_FIRE,
  SURF_GAS,
  SURF_NONE,
  SURF_SPORES,
  UNDERTAKER_PULL_COOLDOWN_TICKS,
  UNDERTAKER_PULL_RANGE,
  UNDERTAKER_PULL_TILES,
  UNDERTAKER_PULL_WINDUP_TICKS,
  UNDERTAKER_SLAM_RANGE,
} from '../src/constants';
import { setSurface } from '../src/cells';
import { damageEntity, spawnEnemy, updateEnemies } from '../src/entities';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { lineageOf } from '../src/strata';
import type { SemanticEvent, SurvivalState } from '../src/types';

const at = (state: SurvivalState, x: number, y: number): number => y * state.config.width + x;

const seedWithLineage = (lineage: string): number => {
  for (let seed = 1; seed < 4096; seed++) if (lineageOf(seed) === lineage) return seed;
  throw new Error(`nenhuma seed pequena com linhagem ${lineage}`);
};

/** Arena limpa: corredor aberto, sem fauna, para a cena ser controlada. */
const arena = (seed: number, sector = 1): SurvivalState => {
  const state = createRun({ seed, sector });
  for (let y = 20; y <= 30; y++) {
    for (let x = 20; x <= 44; x++) {
      state.solid[at(state, x, y)] = SOLID_NONE;
      state.surface[at(state, x, y)] = SURF_NONE;
    }
  }
  state.enemies = [];
  return state;
};

const interactAt = (state: SurvivalState, x: number, y: number): SemanticEvent[] => {
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  const cmd = emptyCommand();
  cmd.interact = true;
  return stepRun(state, [cmd]).events;
};

describe('chefe abatido nao repovoa', () => {
  it('o Bispo morto no setor 2 nao volta quando a subida regenera o mapa', () => {
    const state = createRun({ seed: 7, sector: SECTOR_COUNT });
    // Pega o Nucleo (a subida so existe com ele).
    state.enemies = [];
    state.leftEntryZone = true;
    interactAt(state, state.corePos.x, state.corePos.y);
    expect(state.coreTaken).toBe(true);

    // Sobe para o setor do Bispo: ele esta la, inteiro.
    state.enemies = [];
    interactAt(state, state.entry.x, state.entry.y);
    expect(state.sector).toBe(BISHOP_SECTOR);
    const bishop = state.enemies.find((e) => e.archetype === 'bishop');
    expect(bishop, 'o Bispo deveria estar na camara').toBeDefined();

    // Mata o chefe.
    damageEntity(state, bishop!, bishop!.maxHp * 2, [], { kind: 'player_shot' });
    expect(bishop!.alive).toBe(false);

    // ...e o mundo e regenerado de novo (uma segunda subida a partir daqui
    // usa o mesmo caminho de repovoamento que trazia o chefe de volta).
    state.enemies = [];
    interactAt(state, state.entry.x, state.entry.y);
    expect(state.sector).toBe(1);
    expect(state.enemies.some((e) => e.archetype === 'bishop')).toBe(false);
  });

  it('a memoria e por SETOR, e o bolso micelial continua plantado', () => {
    // Um chefe caido no setor 2 nao pode apagar o Guardiao do setor 3: a marca
    // e da camara daquele setor, nao de "ja matei um chefe".
    const state = createRun({ seed: 7, sector: BISHOP_SECTOR });
    const bishop = state.enemies.find((e) => e.archetype === 'bishop')!;
    damageEntity(state, bishop, bishop.maxHp * 2, [], { kind: 'player_shot' });
    expect(state.bossesDown & (1 << BISHOP_SECTOR)).not.toBe(0);
    expect(state.bossesDown & (1 << SECTOR_COUNT)).toBe(0);
  });
});

describe('Bombardeiro de Enxofre', () => {
  it('estoura em GAS, e nao na nuvem de esporos do micelio', () => {
    const state = arena(11);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 25, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });

    let gas = 0;
    let spores = 0;
    for (let y = 22; y <= 28; y++) {
      for (let x = 29; x <= 35; x++) {
        const surf = state.surface[at(state, x, y)];
        if (surf === SURF_GAS) gas++;
        if (surf === SURF_SPORES) spores++;
      }
    }
    expect(gas, 'nenhuma celula de gas').toBeGreaterThan(0);
    expect(spores, 'esporo nao pertence a este bicho').toBe(0);
  });

  it('morrer perto de BRASA acende a nuvem — a promessa da Fornalha', () => {
    // A interacao que justifica o bicho existir. A explosao roda ANTES de a
    // nuvem ser depositada (ela nasce da morte), e uma fissura de brasa nao
    // propaga fogo sozinha para o gas que apareceu no tick seguinte: sem a
    // ignicao explicita, "matar perto da brasa acende a sala" nao acontecia.
    const state = arena(11);
    setSurface(state, at(state, 29, 25), SURF_EMBER, 600);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 25, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });

    let fire = 0;
    for (let y = 22; y <= 28; y++) {
      for (let x = 28; x <= 36; x++) {
        if (state.surface[at(state, x, y)] === SURF_FIRE) fire++;
      }
    }
    expect(fire, 'a nuvem nao acendeu ao lado da brasa').toBeGreaterThan(0);
  });

  it('longe de qualquer calor a nuvem SO fica: gas nao acende sozinho', () => {
    const state = arena(11);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 25, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });
    let fire = 0;
    let gas = 0;
    for (let y = 22; y <= 28; y++) {
      for (let x = 29; x <= 35; x++) {
        const surf = state.surface[at(state, x, y)];
        if (surf === SURF_FIRE) fire++;
        if (surf === SURF_GAS) gas++;
      }
    }
    expect(gas).toBeGreaterThan(0);
    expect(fire, 'gas pegou fogo sem faisca nenhuma').toBe(0);
  });

  it('parede entre a brasa e a nuvem: acende a bolsa que ENCOSTA no calor', () => {
    // Uma parede pode partir a nuvem em duas bolsas. Acender sempre a primeira
    // celula pintada punha fogo do lado ERRADO da rocha — a bolsa que de fato
    // tocava a brasa ficava intacta, e a propagacao (que so anda por celulas
    // conectadas) nunca a alcancava.
    const state = arena(11);
    for (let x = 28; x <= 36; x++) state.solid[at(state, x, 24)] = SOLID_ROCK;
    setSurface(state, at(state, 32, 28), SURF_EMBER, 600);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 26, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });

    // O fogo tem de nascer ao SUL da parede, onde a brasa esta.
    let fireSouth = 0;
    let fireNorth = 0;
    for (let x = 28; x <= 36; x++) {
      for (let y = 25; y <= 29; y++) if (state.surface[at(state, x, y)] === SURF_FIRE) fireSouth++;
      for (let y = 21; y <= 23; y++) if (state.surface[at(state, x, y)] === SURF_FIRE) fireNorth++;
    }
    expect(fireSouth, 'a bolsa encostada na brasa nao acendeu').toBeGreaterThan(0);
    expect(fireNorth, 'fogo nasceu do lado errado da parede').toBe(0);
  });

  it('nuvem partida com brasa dos DOIS lados: as duas bolsas acendem', () => {
    // Parar na primeira bolsa encontrada deixava a outra metade fria quando
    // cada metade tinha a propria brasa — e o fogo, que so anda por celulas
    // conectadas, nunca atravessaria a parede para corrigir.
    const state = arena(11);
    for (let x = 28; x <= 36; x++) state.solid[at(state, x, 25)] = SOLID_ROCK;
    setSurface(state, at(state, 32, 23), SURF_EMBER, 600);
    setSurface(state, at(state, 32, 27), SURF_EMBER, 600);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 25, false);
    // O bomber morre SOBRE a parede: a nuvem cai nos dois lados dela.
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });

    let north = 0;
    let south = 0;
    for (let x = 29; x <= 35; x++) {
      for (let y = 22; y <= 24; y++) if (state.surface[at(state, x, y)] === SURF_FIRE) north++;
      for (let y = 26; y <= 28; y++) if (state.surface[at(state, x, y)] === SURF_FIRE) south++;
    }
    expect(north, 'a bolsa norte nao acendeu').toBeGreaterThan(0);
    expect(south, 'a bolsa sul ficou fria do outro lado da parede').toBeGreaterThan(0);
  });

  it('brasa que so toca pela DIAGONAL de um canto selado nao acende', () => {
    // A ignicao do bombardeiro nao pode ser a unica excecao a geometria do
    // jogo: o fogo comum anda pelas quatro arestas (ver `stepCells`), entao
    // uma brasa que so encosta no gas pelo canto de duas paredes tambem nao
    // pode acender a nuvem — senao o canto selado, com que o jogador conta,
    // deixaria de proteger justamente contra este bicho.
    const state = arena(11);
    // Canto selado: a brasa em (30,27) toca (31,26) so na diagonal.
    state.solid[at(state, 30, 26)] = SOLID_ROCK;
    state.solid[at(state, 31, 27)] = SOLID_ROCK;
    setSurface(state, at(state, 30, 27), SURF_EMBER, 600);
    const bomber = spawnEnemy(state, 'sulfur_bomber', 32, 25, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });

    let fire = 0;
    for (let y = 23; y <= 27; y++) {
      for (let x = 30; x <= 34; x++) {
        if (state.surface[at(state, x, y)] === SURF_FIRE) fire++;
      }
    }
    expect(fire, 'o fogo atravessou um canto selado').toBe(0);
  });

  it('o Spore Bomber continua deixando esporo: sao bichos diferentes', () => {
    const state = arena(11);
    const bomber = spawnEnemy(state, 'bomber', 32, 25, false);
    damageEntity(state, bomber, bomber.maxHp * 2, [], { kind: 'player_shot' });
    let spores = 0;
    for (let y = 23; y <= 27; y++) {
      for (let x = 30; x <= 34; x++) {
        if (state.surface[at(state, x, y)] === SURF_SPORES) spores++;
      }
    }
    expect(spores).toBeGreaterThan(0);
  });
});

describe('bando de assinatura', () => {
  it('ninguem nasce EMPILHADO: cada membro ganha a propria celula de elemento', () => {
    // Bug que o proprio tamanho do bando criou: `signatureHome` puxa cada
    // espreitador para o elemento mais proximo por uma varredura em anel
    // deterministica, entao dois pontos de spawn vizinhos convergiam para a
    // MESMA agua/gelo — um sprite, uma hitbox, dois bichos atacando. Com pack
    // 1 era impossivel; com bando, virou o caso comum.
    for (const c of [
      { lineage: 'cryo', sector: 3 },
      { lineage: 'cryo', sector: 2 },
      { lineage: 'hydric', sector: 2 },
      { lineage: 'hydric', sector: 3 },
    ]) {
      const state = createRun({ seed: seedWithLineage(c.lineage), sector: c.sector });
      const seen = new Set<string>();
      for (const e of state.enemies) {
        if (e.archetype !== 'frost_wraith' && e.archetype !== 'mud_lamprey') continue;
        const key = `${e.x},${e.y}`;
        expect(seen.has(key), `${c.lineage} s${c.sector}: dois ${e.archetype} em ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('a seed do achado (1171, setor 3) tambem separa os Espectros', () => {
    const state = createRun({ seed: 1171, sector: 3 });
    const wraiths = state.enemies.filter((e) => e.archetype === 'frost_wraith');
    const spots = new Set(wraiths.map((e) => `${e.x},${e.y}`));
    expect(spots.size).toBe(wraiths.length);
  });
});

describe('Minerador Empobrecido', () => {
  it('nasce ENCARANDO o veio que o pos ali — e continua encarando', () => {
    // O lugar dele ja dizia "ainda esta trabalhando o minerio" (ele nasce
    // colado num veio), mas a postura desmentia: com o facing padrao, metade
    // deles picaretava o corredor vazio de costas para a rocha. A animacao de
    // repouso E a batida da picareta; virada para o nada, vira um tique.
    let checked = 0;
    for (const seed of [3, 9, 11, 42, 77]) {
      const state = createRun({ seed });
      const w = state.config.width;
      for (const miner of state.enemies.filter((e) => e.archetype === 'miner')) {
        const fx = Math.round(miner.facing.x);
        const fy = Math.round(miner.facing.y);
        // O facing aponta para um vizinho ORTOGONAL (o veio e adjacente).
        expect(Math.abs(fx) + Math.abs(fy), 'facing nao e ortogonal').toBe(1);
        const tx = Math.floor(miner.x) + fx;
        const ty = Math.floor(miner.y) + fy;
        expect(
          state.solid[ty * w + tx],
          `seed ${seed}: miner em ${miner.x},${miner.y} encara ${tx},${ty} que nao e minerio`,
        ).toBe(SOLID_ORE);
        checked++;
      }
    }
    expect(checked, 'nenhum minerador nas seeds testadas').toBeGreaterThan(0);
  });

  it('a postura sobrevive ao tempo: passivo nao vira de costas sozinho', () => {
    const state = createRun({ seed: 9 });
    const miner = state.enemies.find((e) => e.archetype === 'miner');
    expect(miner, 'seed sem minerador').toBeDefined();
    const before = { ...miner!.facing };
    // Longe do jogador, ele fica no proprio trabalho.
    state.player.x = 4.5;
    state.player.y = 4.5;
    for (let t = 0; t < 200; t++) stepRun(state, [emptyCommand()]);
    expect(miner!.facing.x).toBe(before.x);
    expect(miner!.facing.y).toBe(before.y);
  });
});

describe('Coveiro', () => {
  /** Roda a IA ate o eletroima soltar, devolvendo a distancia final. */
  const runHaul = (state: SurvivalState, ticks: number): void => {
    const events: SemanticEvent[] = [];
    for (let t = 0; t < ticks; t++) {
      updateEnemies(state, events);
      state.tick += 1;
    }
  };

  it('o eletroima ARRASTA o jogador para perto — e telegrafa antes', () => {
    const state = arena(21);
    state.player.x = 38.5;
    state.player.y = 25.5;
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    const before = Math.hypot(state.player.x - undertaker.x, state.player.y - undertaker.y);

    // Durante o windup ninguem se move por causa dele: o aviso e real.
    runHaul(state, 2);
    expect(undertaker.action, 'sem acao iniciada').toBeDefined();
    expect(undertaker.action!.kind).toBe('haul');
    expect(undertaker.action!.phase).toBe('windup');
    expect(Math.hypot(state.player.x - undertaker.x, state.player.y - undertaker.y)).toBeCloseTo(before, 5);

    // Passado o telegrafo, o puxao acontece.
    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 2);
    const after = Math.hypot(state.player.x - undertaker.x, state.player.y - undertaker.y);
    expect(after, 'o jogador deveria ter sido arrastado').toBeLessThan(before - 1);
  });

  it('sem LINHA DE VISAO o eletroima nem carrega: a quina protege', () => {
    // O primeiro contra-jogo, e o mais forte: um pilar entre os dois e o
    // puxao simplesmente nao comeca. Quebrar a linha e a resposta que o
    // corredor estreito do Ferrifero oferece de graca.
    const state = arena(21);
    state.player.x = 38.5;
    state.player.y = 25.5;
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    for (const y of [24, 25, 26]) state.solid[at(state, 35, y)] = SOLID_ROCK;

    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 4);
    expect(undertaker.action?.kind, 'puxou atraves da parede').not.toBe('haul');
    expect(state.player.x, 'o jogador foi arrastado sem linha de visao').toBeCloseTo(38.5, 5);
  });

  it('o arrasto respeita COLISAO: parede que aparece no meio do telegrafo segura', () => {
    // O segundo contra-jogo, e o que prova que o puxao nao teleporta: a acao
    // comeca com o caminho livre e o mundo MUDA durante o windup de 1,1 s —
    // coisa corriqueira num jogo em que a parede e material (um bloco desaba,
    // o Bruiser arranca a cobertura). O arrasto tem de parar no obstaculo.
    const state = arena(21);
    state.player.x = 38.5;
    state.player.y = 25.5;
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);

    runHaul(state, 2); // linha livre: o eletroima engata
    expect(undertaker.action?.kind).toBe('haul');
    for (const y of [24, 25, 26]) state.solid[at(state, 35, y)] = SOLID_ROCK;

    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 4);
    // Puxou (saiu de 38,5) e PAROU na parede, em vez de atravessa-la.
    expect(state.player.x, 'o eletroima nem chegou a puxar').toBeLessThan(38.4);
    expect(state.player.x, 'atravessou o pilar').toBeGreaterThan(35.5);
  });

  it('parede em UM EIXO ja segura o arrasto diagonal', () => {
    // O caso comum, e o que o teste do pilar frontal nao pegava: na diagonal,
    // `moveEntity` avanca o eixo livre quando so o outro trava. Checar "nao
    // saiu do lugar" deixava o jogador RASPANDO na parede ate contornar o
    // obstaculo — a quina deixava de proteger justamente onde ela existe.
    const state = arena(21);
    state.player.x = 37.5;
    state.player.y = 28.5; // diagonal em relacao ao Coveiro
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    runHaul(state, 2);
    expect(undertaker.action?.kind).toBe('haul');
    // Parede vertical entre os dois, depois de o eletroima engatar.
    for (let y = 24; y <= 30; y++) state.solid[at(state, 35, y)] = SOLID_ROCK;
    const beforeY = state.player.y;

    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 4);
    expect(state.player.x, 'atravessou a parede').toBeGreaterThan(35.5);
    // E parou: nao deslizou pelo eixo livre ate contornar o obstaculo.
    expect(Math.abs(state.player.y - beforeY), 'raspou na parede').toBeLessThan(1);
  });

  it('a prensa vem depois do puxao, com telegrafo proprio', () => {
    const state = arena(21);
    state.player.x = 36.5;
    state.player.y = 25.5;
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 2);
    // Logo apos o arrasto, a acao corrente e o golpe pesado — ainda em windup,
    // que e o segundo aviso: da tempo de rolar.
    expect(undertaker.action?.kind).toBe('slam');
    expect(undertaker.action?.phase).toBe('windup');
    // E ela aponta PARA o alvo. O vetor do arrasto vai na direcao contraria
    // (alvo -> Coveiro), e reaproveita-lo aqui fazia o cliente desenhar o
    // braco descendo para o lado oposto de quem acabou de ser puxado.
    const toTargetX = state.player.x - undertaker.x;
    expect(Math.sign(undertaker.action!.direction.x)).toBe(Math.sign(toTargetX));
  });

  it('do alcance MAXIMO, o puxao entrega o alvo dentro da prensa', () => {
    // A conta que amarra os tres numeros: PULL_RANGE - PULL_TILES <= SLAM_RANGE.
    // Sem ela o combo nao fechava no primeiro contato — engate a 8,5 com
    // arrasto de 3,6 deixava o alvo a 4,9 de uma prensa que alcanca 1,5, e o
    // Coveiro gastava os DOIS telegrafos num golpe impossivel contra alguem
    // parado. Como o aggro vale o mesmo que o engate, esse era o encontro
    // normal, e nao um caso de borda.
    expect(UNDERTAKER_PULL_RANGE - UNDERTAKER_PULL_TILES).toBeLessThanOrEqual(UNDERTAKER_SLAM_RANGE);

    const state = arena(21);
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    // Exatamente na borda do engate, e parado.
    state.player.x = undertaker.x + UNDERTAKER_PULL_RANGE - 0.05;
    state.player.y = undertaker.y;
    runHaul(state, UNDERTAKER_PULL_WINDUP_TICKS + 2);
    const after = Math.hypot(state.player.x - undertaker.x, state.player.y - undertaker.y);
    expect(after, 'o puxao nao alcanca a propria prensa').toBeLessThanOrEqual(UNDERTAKER_SLAM_RANGE);
  });

  it('so puxa de novo depois do descanso: nao e um cabo de guerra', () => {
    const state = arena(21);
    state.player.x = 38.5;
    state.player.y = 25.5;
    const undertaker = spawnEnemy(state, 'undertaker', 32, 25, false);
    runHaul(state, 2);
    expect(undertaker.rangedReadyAt).toBeGreaterThan(state.tick);
    expect(undertaker.rangedReadyAt - state.tick).toBeLessThanOrEqual(UNDERTAKER_PULL_COOLDOWN_TICKS);
  });
});
