// A arena do chefe com o sotaque do estrato.
//
// A camara do chefe era a ultima sala importante que saia igual em todo bioma —
// a mesma clareira lisa na Catedral, na Cripta e na Fornalha — e e onde o
// jogador passa mais tempo olhando para o chao.
//
// O que estes testes cobram, em ordem de gravidade:
// 1. NADA FICA PRESO. O carimbo roda DEPOIS das provas de alcancabilidade da
//    geracao, entao ele paga a propria: poco e chefe continuam alcancaveis a
//    partir da entrada, em toda linhagem e nos dois setores de chefe.
// 2. O CORPO DO CHEFE CABE. O Guardiao ocupa quase 1,5 tile; a moldura nao
//    pode invadir o 3x3 dele nem o pedestal do poco.
// 3. IDENTIDADE. Cada estrato deixa a propria marca — e o basalto historico
//    continua sem marca nenhuma.
import { describe, expect, it } from 'vitest';
import {
  ARCHCANTOR_CHOIR_LANCE_LENGTH,
  ARCHCANTOR_CHOIR_RADIUS,
  DEFAULT_SECTOR_COUNT,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SURF_EMBER,
  SURF_ICE,
  SURF_WATER,
} from '../src/constants';
import { SOLID_ROCK } from '../src/constants';
import { RUN_SEED_MIX, WORLD_H, WORLD_W } from '../src/constants';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { isBossArchetype } from '../src/bosses';
import { sectorSeed } from '../src/sectors';
import { createTerrainDraft, floodOpen, generateWorld, stampBossArena } from '../src/worldgen';
import { lineageOf, sectorProfile } from '../src/strata';
import type { SurvivalState } from '../src/types';

/**
 * Devolve o laco de eventos ao vitest no meio de uma varredura longa.
 *
 * O worker fala com o processo principal por RPC com 60 s de prazo, e a
 * resposta chega como macrotarefa. Um arquivo de testes sincronos que gera
 * centenas de mundos em sequencia (este passa de um minuto no runner do CI)
 * nunca deixa essa resposta entrar — entre um `it` e o outro so ha
 * microtarefas — e o prazo estoura como "Timeout calling onTaskUpdate", com
 * todos os testes verdes e o processo saindo com erro. Um `setImmediate` a
 * cada punhado de seeds e o unico intervalo que a varredura precisa.
 */
const breathe = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
const BREATHE_EVERY = 8;

const seedWithLineage = (lineage: string): number => {
  for (let seed = 1; seed < 4096; seed++) if (lineageOf(seed) === lineage) return seed;
  throw new Error(`nenhuma seed pequena com linhagem ${lineage}`);
};

const LINEAGES = ['hydric', 'mineral', 'industrial', 'thermal', 'arid', 'cryo'];

// O setor do MEIO: a camara de chefe continua carimbada pela geracao em todo
// setor (e a moldura por estrato vale nela), mas desde bossForBiome so o setor
// FINAL recebe um chefe de verdade — e o primeiro nunca recebe.
const MID_SECTOR = 2;

/** Distancia em passos a partir da entrada, no mundo COMO ELE FICOU. */
const bfsFromEntry = (solid: Uint8Array, entry: { x: number; y: number }): Int32Array => {
  const dist = new Int32Array(WORLD_W * WORLD_H).fill(-1);
  const start = entry.y * WORLD_W + entry.x;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = cell % WORLD_W;
    const y = Math.floor(cell / WORLD_W);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= WORLD_W || ny >= WORLD_H) continue;
      const n = ny * WORLD_W + nx;
      if (dist[n] !== -1 || solid[n] !== SOLID_NONE) continue;
      dist[n] = dist[cell] + 1;
      queue.push(n);
    }
  }
  return dist;
};

/**
 * Onde a CAMARA de chefe daquele setor esta. Vem do worldgen (mesma derivacao
 * de createRun), e nao de uma entidade: desde bossForBiome, so o setor final
 * tem chefe vivo — a camara e a moldura continuam existindo em todos.
 */
// Pela fonte unica: a camara medida e a da run, garantia da descida inclusa.
const chamberOf = (seed: number, sector: number): { x: number; y: number } =>
  generateWorld(
    sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector),
    WORLD_W,
    WORLD_H,
    sectorProfile(seed, sector),
  ).guardianSpawn;

describe('arena do chefe por estrato', () => {
  it('poco e chefe continuam ALCANCAVEIS a partir da entrada', () => {
    // A prova que a moldura tem de pagar. Ela e carimbada depois das
    // validacoes da geracao, entao um pilar num estrangulamento poderia
    // isolar a camara — e o proprio carimbo se desfaz quando isso acontece.
    for (const lineage of LINEAGES) {
      const seed = seedWithLineage(lineage);
      for (const sector of [MID_SECTOR, DEFAULT_SECTOR_COUNT]) {
        const state = createRun({ seed, sector });
        const w = state.config.width;
        const reach = floodOpen(state.solid, w, state.config.height, state.entry.x, state.entry.y);
        const boss = chamberOf(seed, sector);
        expect(
          reach.has(state.corePos.y * w + state.corePos.x),
          `${lineage} s${sector}: poco isolado`,
        ).toBe(true);
        expect(reach.has(boss.y * w + boss.x), `${lineage} s${sector}: camara isolada`).toBe(true);
        // E o setor final tem o chefe DE VERDADE, na camara.
        if (sector === DEFAULT_SECTOR_COUNT) {
          const alive = state.enemies.find((e) => isBossArchetype(e.archetype));
          expect(alive, `${lineage} s${sector}: setor final sem chefe`).toBeDefined();
        }
      }
    }
  });

  it('o corpo do chefe CABE: o 3x3 dele e o pedestal ficam livres', () => {
    for (const lineage of LINEAGES) {
      const seed = seedWithLineage(lineage);
      for (const sector of [MID_SECTOR, DEFAULT_SECTOR_COUNT]) {
        const state = createRun({ seed, sector });
        const w = state.config.width;
        const boss = chamberOf(seed, sector);
        for (const [cx, cy] of [
          [boss.x, boss.y],
          [state.corePos.x, state.corePos.y],
        ]) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              expect(
                state.solid[(cy + dy) * w + cx + dx],
                `${lineage} s${sector}: ${cx + dx},${cy + dy} bloqueado`,
              ).toBe(SOLID_NONE);
            }
          }
        }
      }
    }
  });

  it('cada estrato deixa a PROPRIA marca na camara', () => {
    // Amostra por linhagem: o que a arena daquele bioma deposita em volta do
    // chefe. Conta na janela da camara (raio 7 = o mesmo do cerco).
    const marks: Array<{
      lineage: string;
      sector: number;
      find: (s: SurvivalState, i: number) => boolean;
    }> = [
      // Catedral Prismatica: pilares de cristal.
      { lineage: 'mineral', sector: MID_SECTOR, find: (s, i) => s.solid[i] === SOLID_CRYSTAL },
      // Aquifero Negro: a orla e agua.
      { lineage: 'hydric', sector: MID_SECTOR, find: (s, i) => s.surface[i] === SURF_WATER },
      // Cripta Glacial: a arena escorrega.
      { lineage: 'cryo', sector: DEFAULT_SECTOR_COUNT, find: (s, i) => s.surface[i] === SURF_ICE },
      // Fornalha/Ferrifero: brasa na orla.
      {
        lineage: 'industrial',
        sector: DEFAULT_SECTOR_COUNT,
        find: (s, i) => s.surface[i] === SURF_EMBER,
      },
      // Fenda Sulfurosa: paredes porosas.
      { lineage: 'thermal', sector: MID_SECTOR, find: (s, i) => s.solid[i] === SOLID_FRAGILE },
    ];
    for (const m of marks) {
      const state = createRun({ seed: seedWithLineage(m.lineage), sector: m.sector });
      const w = state.config.width;
      const boss = chamberOf(seedWithLineage(m.lineage), m.sector);
      let found = 0;
      for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          const x = boss.x + dx;
          const y = boss.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
          if (m.find(state, y * w + x)) found++;
        }
      }
      expect(
        found,
        `${m.lineage} s${m.sector}: a camara nao tem a marca do estrato`,
      ).toBeGreaterThan(0);
    }
  });

  it('ninguem nasce DENTRO da moldura', async () => {
    // O defeito que este arquivo quase deixou passar. `openCells` e montado
    // no comeco da geracao e o carimbo roda depois — mas nenhum consumidor
    // daquela lista reconfere `solid`. Sem podar a lista, uma celula virada
    // pilar continua candidata a spawn: na seed 205, setor 3, um cuspidor
    // nascia emparedado num pilar de cristal, invisivel e inalcancavel, e
    // ainda ocupando uma vaga do orcamento do setor.
    //
    // A varredura e ampla de proposito: o caso aparecia em 1 de 13 mil
    // posicoes, entao um punhado de seeds nao teria achado nada.
    //
    // O criterio e "dentro da PEDRA", e nao "alcancavel a pe". A primeira
    // versao usava o flood da entrada e passava por sorte: bolsao fechado e
    // feicao normal de caverna — a broca abre parede, entao um bicho atras de
    // rocha e conteudo, nao defeito. Corpo DENTRO da parede e que e impossivel.
    let checked = 0;
    for (let seed = 1; seed <= 250; seed++) {
      if (seed % BREATHE_EVERY === 0) await breathe();
      for (const sector of [MID_SECTOR, DEFAULT_SECTOR_COUNT]) {
        const state = createRun({ seed, sector });
        const w = state.config.width;
        for (const e of state.enemies) {
          const x = Math.floor(e.x);
          const y = Math.floor(e.y);
          checked++;
          expect(
            state.solid[y * w + x],
            `seed ${seed} s${sector}: ${e.archetype} emparedado em ${x},${y}`,
          ).toBe(SOLID_NONE);
        }
      }
    }
    expect(checked).toBeGreaterThan(5000);
    // Timeout proprio: 500 mundos gerados passam dos 5 s padrao do vitest. A
    // varredura larga E o teste — o caso aparecia em 1 de 13 mil posicoes.
  }, 60_000);

  it('a moldura SE DESFAZ quando fecharia o unico corredor', () => {
    // Nas seeds reais este ramo nunca dispara: as camaras que a geracao abre
    // sao largas demais para um anel esparso de 8 celulas fechar. Uma rede de
    // seguranca que nunca e exercitada nao e uma rede — entao aqui ela e armada
    // a mao, com a camara ligada ao mundo por UM corredor que passa exatamente
    // por uma celula de eixo do anel.
    const W = 40;
    const H = 40;
    const boss = { x: 12, y: 20 };
    const core = { x: 10, y: 20 };
    const entry = { x: 24, y: 20 };

    // O draft de verdade, e nao um par de arrays cru: assim o teste exercita a
    // MESMA barreira de escrita que a geracao usa.
    /** Camara de raio 3 + corredor a leste, com `lanes` faixas de largura. */
    const build = (lanes: number) => {
      const draft = createTerrainDraft(W, H);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          draft.setSolid((boss.y + dy) * W + boss.x + dx, SOLID_NONE);
        }
      }
      for (let lane = 0; lane < lanes; lane++) {
        for (let x = boss.x + 3; x <= entry.x; x++) {
          draft.setSolid((boss.y + lane) * W + x, SOLID_NONE);
        }
      }
      return draft;
    };
    // (16,20) e o eixo leste do anel 4 — e o gargalo por onde o corredor passa.
    const choke = boss.y * W + boss.x + 4;

    // Uma faixa: o pilar de cristal do ramo `radial` tapa o gargalo. O carimbo
    // percebe e some POR INTEIRO.
    const sealed = build(1);
    stampBossArena(sealed, W, H, boss, core, entry, 'radial');
    expect(sealed.solid[choke], 'o gargalo foi tapado: a moldura tinha de ter sumido').toBe(
      SOLID_NONE,
    );
    expect(
      floodOpen(sealed.solid, W, H, entry.x, entry.y).has(boss.y * W + boss.x),
      'chefe isolado apos o carimbo',
    ).toBe(true);
    // E o derivado do draft ja enxerga o mundo desfeito, sem ninguem reparar.
    expect(
      sealed.derived(entry).openCells.includes(boss.y * W + boss.x),
      'o derivado ficou preso no mundo de antes do desfazer',
    ).toBe(true);

    // A Catedral agora escava a rotunda independentemente do gargalo: a arena
    // aberta e parte da mecanica do Arquicantor, nao decoracao opcional.
    const open = build(2);
    // O derivado e pedido ANTES do carimbo: e o caso que o draft existe para
    // resolver — depois do pilar entrar, a leitura seguinte tem de vir refeita.
    const antes = open.derived(entry).openCells.length;
    stampBossArena(open, W, H, boss, core, entry, 'radial');
    expect(open.solid[choke], 'a rotunda radial fechou um eixo do canto').toBe(SOLID_NONE);
    expect(open.derived(entry).openCells.length).toBeGreaterThanOrEqual(antes);

    // E o desfazer tem de levar a SUPERFICIE junto. O `canyon` e o unico ramo
    // que faz as duas coisas — escombro nas diagonais e BRASA na orla — entao e
    // o unico em que dava para desfazer o solido e deixar o hazard de pe.
    // Aqui o gargalo passa pela diagonal (4,4), que e o que o canyon fecha.
    const canyon = createTerrainDraft(W, H);
    const abre = (x: number, y: number): void => {
      canyon.setSolid(y * W + x, SOLID_NONE);
    };
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) abre(boss.x + dx, boss.y + dy);
    abre(boss.x + 4, boss.y + 3); // liga a camara ao gargalo pela ortogonal
    abre(boss.x + 4, boss.y + 4); // O GARGALO: a diagonal que o canyon tapa
    for (let x = boss.x + 4; x <= entry.x; x++) abre(x, boss.y + 4);
    for (let y = boss.y; y <= boss.y + 4; y++) abre(entry.x, y);

    stampBossArena(canyon, W, H, boss, core, entry, 'canyon');
    expect(
      canyon.solid[(boss.y + 4) * W + boss.x + 4],
      'o canyon tapou o gargalo e nao se desfez',
    ).toBe(SOLID_NONE);
    expect(
      canyon.surface.some((s) => s === SURF_EMBER),
      'a moldura sumiu mas a brasa dela ficou',
    ).toBe(false);

    // Controle do controle: num mapa sem gargalo o canyon PINTA mesmo — senao a
    // assercao acima passaria por o ramo nunca ter pintado nada.
    const largo = createTerrainDraft(W, H);
    for (let i = 0; i < W * H; i++) largo.setSolid(i, SOLID_NONE);
    stampBossArena(largo, W, H, boss, core, entry, 'canyon');
    expect(
      largo.surface.some((s) => s === SURF_EMBER),
      'o canyon nao pinta brasa?',
    ).toBe(true);
  });

  it('a decoracao de parede NAO re-sorteia o material da moldura', async () => {
    // O passo 4 da geracao converte rocha adjacente a chao aberto em fragil,
    // minerio ou cristal — e um pilar isolado e parede FINA nos dois eixos, o
    // caso de MAIOR chance de virar fragil. Na Fornalha da seed 7 os quatro
    // escombros saiam [minerio, minerio, fragil, rocha]: como rocha e o unico
    // material que nao cede a tiro nenhum, tres dos quatro pilares iam embora a
    // tiro e levavam junto a cobertura que a arena promete.
    //
    // Os ramos que carimbam ROCHA sao `columns` (basalto) e `canyon`
    // (fornalha/ferrifero) — os unicos expostos, porque a decoracao so olha
    // para SOLID_ROCK e nunca tocou nos pilares de cristal nem nos frageis.
    // A distincao importa: uma rocha COMUM que por acaso caiu na diagonal do
    // anel virar minerio e o comportamento normal da caverna, e cobrar isso da
    // moldura seria cobrar um pilar que nunca foi dela. So `arenaCells` — o que
    // o carimbo de fato escreveu — esta sob julgamento aqui.
    const esperado: Record<string, number> = {
      columns: SOLID_ROCK,
      canyon: SOLID_ROCK,
      radial: SOLID_CRYSTAL,
      lungs: SOLID_FRAGILE,
      terraced: SOLID_FRAGILE,
    };
    // A varredura tem de alcancar o FERRIFERO, que e onde a segunda passada de
    // decoracao (os nos de minerio do passo 4d) morde: a primeira correcao so
    // cobria o passo 4 e a seed 168 s2 continuava entregando um pilar de
    // minerio. Saber quais passadas alcancam a moldura exige cruzar estrato com
    // `halls`, e esse raciocinio quebra quando alguem acrescenta um estrato —
    // por isso a protecao no codigo e uniforme e a amostra aqui e larga.
    let conferidos = 0;
    for (let seed = 1; seed <= 200; seed++) {
      if (seed % BREATHE_EVERY === 0) await breathe();
      for (const sector of [MID_SECTOR, DEFAULT_SECTOR_COUNT]) {
        const profile = sectorProfile(seed, sector);
        const alvo = esperado[profile.halls];
        if (alvo === undefined) continue; // karst e lakes so pintam chao
        // Mesma derivacao de createRun, para olhar o MESMO mundo que a run ve.
        const world = generateWorld(
          sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector),
          WORLD_W,
          WORLD_H,
          profile,
        );
        for (const cell of world.arenaCells) {
          conferidos++;
          expect(
            world.solid[cell],
            `seed ${seed} s${sector} (${profile.halls}): moldura em ` +
              `${cell % WORLD_W},${Math.floor(cell / WORLD_W)} virou ${world.solid[cell]}`,
          ).toBe(alvo);
        }
      }
    }
    expect(
      conferidos,
      'nenhuma celula de moldura na amostra: o teste nao mede nada',
    ).toBeGreaterThan(50);
    // Timeout proprio, como os outros dois varredores deste arquivo. Sem ele a
    // varredura de 200 seeds rodava em ~4,3 s aqui — passando por pouco do
    // padrao de 5 s do vitest — e ESTOURAVA no CI, que e mais lento. Amostra
    // larga precisa de orcamento explicito; encostar no limite e o mesmo que
    // deixar o teste depender da maquina.
  }, 60_000);

  it('o mundo que a moldura deixa e o mundo que a geracao MEDE', async () => {
    // O pedestal do poco e carimbado ANTES do re-flood e do BFS, entao toda
    // estrutura derivada ja o enxerga. A moldura da arena nao tem essa sorte —
    // depende do ponto do chefe, que depende do terreno — e por isso refaz as
    // duas depois de carimbar.
    //
    // Podar so as celulas viradas pilar nao bastava: um pilar tambem CORTA
    // caminho. Sao dois sintomas distintos, e nenhum dos dois aparece olhando
    // a camara do chefe:
    //   - seed 141 s3: chao isolado que continuava em `openCells` sem
    //     pertencer ao flood final (celula 8251);
    //   - seed 210 s2: o site opcional de tier 3 caindo em 135 quando a banda
    //     de 82% do maximo final pedia 136 — escolhido com a distancia de um
    //     mundo que deixou de existir.
    for (let seed = 1; seed <= 220; seed++) {
      if (seed % BREATHE_EVERY === 0) await breathe();
      for (const sector of [MID_SECTOR, DEFAULT_SECTOR_COUNT]) {
        const profile = sectorProfile(seed, sector);
        const world = generateWorld(
          sectorSeed((seed ^ RUN_SEED_MIX) >>> 0, sector),
          WORLD_W,
          WORLD_H,
          profile,
        );
        if (world.arenaCells.length === 0) continue;

        // 1. `openCells` nao guarda orfao: tudo nela pertence ao flood FINAL.
        const reach = floodOpen(world.solid, WORLD_W, WORLD_H, world.entry.x, world.entry.y);
        for (const cell of world.openCells) {
          expect(
            reach.has(cell),
            `seed ${seed} s${sector}: openCells guarda ${cell % WORLD_W},` +
              `${Math.floor(cell / WORLD_W)}, fora do flood final`,
          ).toBe(true);
        }

        // 2. As BANDAS dos sites valem no mundo final. O tier 3 e o alvo: e a
        //    banda mais funda (82%) e a que uma rota alongada desrespeita.
        const dist = bfsFromEntry(world.solid, world.entry);
        const maxPath = dist[world.corePos.y * WORLD_W + world.corePos.x];
        for (const site of world.salvageSites) {
          if (site.tier !== 3) continue;
          const d = dist[site.terminal.y * WORLD_W + site.terminal.x];
          expect(
            d,
            `seed ${seed} s${sector}: site tier 3 a ${d}, raso para a banda de 82% de ${maxPath}`,
          ).toBeGreaterThanOrEqual(Math.ceil(maxPath * 0.82));
        }
      }
    }
  }, 90_000);

  it('a moldura NAO importa materia de outro estrato', () => {
    // O reverso do teste anterior, e o que de fato quebra se alguem copiar um
    // ramo de `stampBossArena` para outro e esquecer de trocar o material: a
    // Fenda ganhando gelo, a Cripta ganhando brasa. Os dois estratos abaixo
    // tem blob de agua/gelo/brasa ZERADO no perfil (fora o proprio gelo da
    // Cripta), entao qualquer aparicao dessas superficies na camara so pode
    // ter vindo do carimbo.
    const foreign: Array<{ lineage: string; sector: number; banned: number[] }> = [
      // Fenda Sulfurosa: `lungs` so abre parede porosa — nao pinta chao nenhum.
      { lineage: 'thermal', sector: MID_SECTOR, banned: [SURF_WATER, SURF_ICE, SURF_EMBER] },
      // Cripta Glacial: gelo e dela; brasa e agua nao.
      { lineage: 'cryo', sector: DEFAULT_SECTOR_COUNT, banned: [SURF_EMBER, SURF_WATER] },
    ];
    for (const f of foreign) {
      const state = createRun({ seed: seedWithLineage(f.lineage), sector: f.sector });
      const w = state.config.width;
      const boss = chamberOf(seedWithLineage(f.lineage), f.sector);
      for (let dy = -7; dy <= 7; dy++) {
        for (let dx = -7; dx <= 7; dx++) {
          const x = boss.x + dx;
          const y = boss.y + dy;
          if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
          expect(
            f.banned.includes(state.surface[y * w + x]),
            `${f.lineage} s${f.sector}: materia estrangeira em ${x},${y}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('arena real do Arquicantor', () => {
  it('nasce como uma rotunda aberta cercada por muitos cristais', () => {
    const state = createRun({
      seed: 11,
      sector: 3,
      depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
    });
    expect(state.sectorBoss.archetype).toBe('archcantor');
    const boss = state.enemies.find((e) => e.id === state.sectorBoss.entityId);
    expect(boss).toBeDefined();
    const w = state.config.width;
    let openCore = 0;
    let crystals = 0;
    for (let y = Math.floor(boss!.y) - 10; y <= Math.floor(boss!.y) + 10; y++) {
      for (let x = Math.floor(boss!.x) - 10; x <= Math.floor(boss!.x) + 10; x++) {
        if (x < 0 || y < 0 || x >= w || y >= state.config.height) continue;
        const d = Math.hypot(x + 0.5 - boss!.x, y + 0.5 - boss!.y);
        const material = state.solid[y * w + x];
        if (d <= 5 && material === SOLID_NONE) openCore++;
        if (d <= 10 && material === SOLID_CRYSTAL) crystals++;
      }
    }
    expect(openCore, 'a danca nasceu dentro de um corredor').toBeGreaterThan(55);
    expect(crystals, 'a Catedral nasceu sem uma rede densa').toBeGreaterThanOrEqual(16);
    state.player.x = boss!.x + 2;
    state.player.y = boss!.y;
    for (let tick = 0; tick < 12; tick++) stepRun(state, [emptyCommand()]);
    expect(
      state.bossRuntime.choir.filter((id) => id !== 0),
      'o Arquicantor real nao chamou o quarteto',
    ).toHaveLength(4);
  });

  it('reserva margem para os quatro bracos do coro ate nas seeds de borda', () => {
    const state = createRun({
      seed: 19,
      sector: 3,
      depth: { generation: 'G-04', sectorCount: 7, coreSectors: [3, 7] },
    });
    const boss = state.enemies.find((e) => e.id === state.sectorBoss.entityId);
    expect(boss).toBeDefined();
    const requiredMargin = Math.ceil(ARCHCANTOR_CHOIR_RADIUS + ARCHCANTOR_CHOIR_LANCE_LENGTH) + 1;
    expect(
      Math.min(boss!.x, boss!.y, state.config.width - boss!.x, state.config.height - boss!.y),
    ).toBeGreaterThanOrEqual(requiredMargin);
  });
});
