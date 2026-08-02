// A gramatica ambiental do Veio: ESTRATO x OCUPACAO x linhagem.
//
// Por que existe: a descida tinha tres setores e UMA gramatica visual e
// mecanica — rocha, paredes frageis, minerio, cristal, manchas de fungo e
// biofluido. As seeds mudavam o desenho, nunca o modo de atravessar o espaco.
// O Veio nao precisa de "mapas tematicos" transplantados de outro jogo; ele
// precisa de estratos geologicos, infestacoes e cicatrizes industriais que se
// COMBINAM.
//
// A decisao estrutural: um setor nao "e um bioma". Ele e um ESTRATO (a
// formacao geologica dominante) mais uma OCUPACAO (o que tomou conta dele).
// Uma Catedral Prismatica pode estar limpa, tomada pelo micelio ou cortada
// pela cicatriz Aurix — e cada combinacao sai das MESMAS pecas de simulacao.
// Isso multiplica variedade sem multiplicar sistemas: tres estratos e duas
// ocupacoes ja produzem sete setores distintos na primeira leva.
//
// A segunda decisao: uma run nao sorteia tres biomas soltos. Ela segue uma
// LINHAGEM geologica — hidrica, mineral ou industrial — em que os tres setores
// contam uma historia ambiental continua (a agua sobe, o cristal domina, a
// natureza da lugar aos restos da operacao Aurix). Tres sorteios independentes
// fariam a descida parecer um seletor de fases.
//
// Tudo aqui e FUNCAO PURA da seed da run. Nada consome `state.rng`: o bioma do
// setor N precisa ser conhecivel por um cliente que reconecta no meio da run e
// reconstroi o mundo com `createRun({ sector: N })`, antes de qualquer tick.

import { MINER_PER_SECTOR, SECTOR_COUNT } from './constants.js';
import type { EnemyArchetype } from './types.js';
import type { WorldgenProfile } from './worldgen.js';

/**
 * Os estratos da primeira leva.
 *
 * - `basalt`: Galerias de Basalto — o cenario atual formalizado como
 *   bioma-base. E a referencia contra a qual os outros sao lidos; a identidade
 *   e a RUPTURA (paredes frageis, atalhos, blocos como municao).
 * - `prismatic`: Catedral Prismatica — o material cristalino promovido a
 *   arquitetura. A identidade e a RESSONANCIA: cristal e ferramenta, perigo e
 *   iluminacao ao mesmo tempo.
 * - `aquifer`: Aquifero Negro — o flooded reinterpretado sem simulacao de
 *   fluidos: agua ESTATICA e condutiva dividindo o chao em ilhas secas e
 *   areas rasas. A identidade e a CONDUCAO TERRITORIAL.
 *
 * Segunda leva (interpretacoes subterraneas dos biomas de referencia):
 *
 * - `sulfur`: Fenda Sulfurosa — o toxic com parte da linguagem do volcanic.
 *   Corredores comprimidos ligando camaras cheias de gas ("pulmoes"); a
 *   identidade e a VENTILACAO: as fontes ligam e desligam em ciclos.
 * - `furnace`: Fornalha Abissal — o volcanic. Fissuras incandescentes seguram
 *   o calor da arma (pressao territorial, nunca punicao passiva) e o chao
 *   queimado e CARVAO que acende em fogo persistente.
 * - `silica`: Sumidouros de Silica — o desert reinterpretado: rocha
 *   esbranquicada que cede, quase tudo fragil, pouco a segurar o teto.
 * - `glacial`: Cripta Glacial — gelo que derrete em agua condutiva e
 *   recongela, e (desde SIMULATION_VERSION 16) com INERCIA: sobre a lamina o
 *   Prospector desliza (ICE_GLIDE em run.ts).
 */
export type StratumId =
  | 'basalt'
  | 'prismatic'
  | 'aquifer'
  | 'sulfur'
  | 'furnace'
  | 'silica'
  | 'glacial';

/**
 * O que tomou conta do estrato.
 *
 * - `mycelial`: a Matriz Micelial. O fungal funciona melhor INVADINDO
 *   geologias do que como geologia propria — e o que ja existia nas cavernas
 *   atuais, agora combinavel com qualquer estrato.
 * - `aurix`: a Cicatriz Aurix. O Veio nao pode parecer intocado: a Aurix
 *   esteve la, fracassou la, e os veios reforcados, o minerio abundante e os
 *   automatos de extracao ainda trabalhando sao o registro disso.
 */
export type OccupationId = 'none' | 'mycelial' | 'aurix';

/** A historia geologica que os tres setores de uma run contam juntos. */
export type LineageId = 'hydric' | 'mineral' | 'industrial' | 'thermal' | 'arid' | 'cryo';

export type SectorBiome = {
  stratum: StratumId;
  occupation: OccupationId;
  lineage: LineageId;
};

/**
 * As linhagens da primeira leva, setor a setor.
 *
 * - hidrica: Galeria Umida -> Aquifero Negro -> Abismo Micelial. A agua
 *   aumenta, as rotas secas desaparecem, a vida domina.
 * - mineral: Galeria de Quartzo -> Catedral Prismatica -> Coracao Ressonante.
 *   O cristal deixa de ser decoracao e passa a determinar a arquitetura
 *   (a densidade cresce com a profundidade via `depth` no perfil).
 * - industrial: Caverna Escavada -> Complexo Aurix -> Instalacao Alagada. A
 *   natureza vai dando lugar aos restos da operacao; o fim e uma estacao de
 *   bombeamento sobre o aquifero que ela nao segurou.
 *
 * Segunda leva:
 *
 * - termica: Basalto Fraturado -> Fenda Sulfurosa -> Fornalha Abissal. A
 *   temperatura, os gases e a instabilidade crescem com a descida.
 * - arida: Basalto -> Sumidouros de Silica -> Fornalha Abissal. A silica
 *   vitrifica rumo ao calor: dois caminhos chegam a Fornalha.
 * - crio: Basalto -> Cripta Glacial -> Cripta profunda. O gelo domina e a
 *   profundidade adensa as pontes e lagos congelados.
 */
const LINEAGES: Record<LineageId, ReadonlyArray<{ stratum: StratumId; occupation: OccupationId }>> = {
  hydric: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'aquifer', occupation: 'none' },
    { stratum: 'aquifer', occupation: 'mycelial' },
  ],
  mineral: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'prismatic', occupation: 'none' },
    { stratum: 'prismatic', occupation: 'none' },
  ],
  industrial: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'basalt', occupation: 'aurix' },
    { stratum: 'aquifer', occupation: 'aurix' },
  ],
  thermal: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'sulfur', occupation: 'none' },
    { stratum: 'furnace', occupation: 'none' },
  ],
  arid: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'silica', occupation: 'none' },
    { stratum: 'furnace', occupation: 'none' },
  ],
  cryo: [
    { stratum: 'basalt', occupation: 'none' },
    { stratum: 'glacial', occupation: 'none' },
    { stratum: 'glacial', occupation: 'none' },
  ],
};

const LINEAGE_ORDER: readonly LineageId[] = [
  'hydric',
  'mineral',
  'industrial',
  'thermal',
  'arid',
  'cryo',
];

/**
 * Hash inteiro puro, no mesmo espirito de `sectorSeed`. NAO usa a RNG da run:
 * o bioma precisa ser derivavel sem consumir estado.
 */
const mix32 = (a: number, b: number): number =>
  (Math.imul(a ^ Math.imul(b, 0x9e3779b9), 0x85ebca6b) ^ ((a ^ b) >>> 13)) >>> 0;

/** Linhagem da run. Funcao pura da seed. */
export const lineageOf = (runSeed: number): LineageId =>
  LINEAGE_ORDER[mix32(runSeed >>> 0, 0x11d3a6e5) % LINEAGE_ORDER.length];

/**
 * Bioma do setor N da run.
 *
 * Alem da tabela da linhagem, ha INTRUSOES: um setor sem ocupacao a partir do
 * segundo pode ganhar uma colonia micelial ou uma instalacao Aurix. E o que
 * impede a linhagem mineral de ser sempre a mesma catedral limpa — e e
 * deterministico por (seed, setor), entao as duas maquinas de uma sala de
 * co-op e o replay do leaderboard veem a mesma intrusao.
 */
export const sectorBiome = (runSeed: number, sector: number): SectorBiome => {
  const lineage = lineageOf(runSeed);
  const table = LINEAGES[lineage];
  const clamped = Math.max(1, Math.min(SECTOR_COUNT, sector));
  const base = table[Math.min(clamped, table.length) - 1];

  let occupation = base.occupation;
  if (occupation === 'none' && clamped >= 2) {
    const roll = mix32(runSeed >>> 0, clamped * 0x27d4eb2f) % 100;
    if (roll < 30) occupation = 'mycelial';
    else if (roll < 45) occupation = 'aurix';
  }
  // A Fornalha nao recebe colonia micelial: biomassa umida nao coloniza chao
  // incandescente. A intrusao vira Aurix — os sistemas de refrigeracao
  // abandonados sao exatamente o que a operacao deixaria num estrato assim.
  if (occupation === 'mycelial' && base.stratum === 'furnace') occupation = 'aurix';
  return { stratum: base.stratum, occupation, lineage };
};

/**
 * Perfil de geracao do setor.
 *
 * A profundidade entra como intensidade: o terceiro setor de uma linhagem
 * mineral nao e "outra catedral", e o Coracao Ressonante — mais cristal, menos
 * rocha comum.
 *
 * INVARIANTE: basalto SEM ocupacao e EXATAMENTE o perfil historico, em
 * qualquer linhagem e em qualquer setor. As Galerias de Basalto nao sao "um
 * bioma inspirado no mapa antigo" — elas SAO o mapa antigo, preservado como
 * tipo proprio, com a mesma sequencia de RNG. Nenhum tempero de linhagem pode
 * toca-lo: variacao de basalto e trabalho das OCUPACOES, nunca do estrato
 * limpo. (Houve um "tempero umido" no setor 1 da linhagem hidrica; foi
 * removido de proposito por violar exatamente isto.)
 */
export const biomeProfile = (biome: SectorBiome, sector: number): WorldgenProfile => {
  const depth = Math.max(0, Math.min(SECTOR_COUNT - 1, sector - 1));

  // Base: Galerias de Basalto — os valores historicos do worldgen.
  const profile: WorldgenProfile = {
    fragileThinChance: 0.55,
    oreChance: 0.07,
    crystalChance: 0.03,
    crystalVeins: 0,
    oreSeams: 0,
    fungalBlobs: { count: 26, rMin: 2, rMax: 4 },
    biofluidBlobs: { count: 12, rMin: 1, rMax: 3 },
    waterBlobs: { count: 0, rMin: 0, rMax: 0 },
    iceBlobs: { count: 0, rMin: 0, rMax: 0 },
    emberBlobs: { count: 0, rMin: 0, rMax: 0 },
    coalBlobs: { count: 0, rMin: 0, rMax: 0 },
    ventCount: 6,
    minerCap: MINER_PER_SECTOR,
    halls: 'none',
  };

  // O basalto tambem tem gramatica ESPACIAL propria (anfiteatros, florestas
  // de pilares, fissuras). O que ele preserva do mapa original sao o automato
  // e as MATERIAS — nada de agua, brasa ou gelo nele; a variacao e trabalho
  // das ocupacoes. A identidade sobrevive; os bytes evoluem.
  if (biome.stratum === 'basalt') {
    profile.halls = 'columns';
  } else if (biome.stratum === 'prismatic') {
    // Nervuras atravessam paredes; a mancha organica recua. Salas com longas
    // linhas de tiro vem das nervuras abrindo lâminas, nao de topologia nova.
    profile.crystalChance = 0.1 + depth * 0.04;
    profile.halls = 'radial';
    profile.crystalVeins = 6 + depth * 3;
    profile.oreChance = 0.05;
    profile.fragileThinChance = 0.45;
    profile.fungalBlobs = { count: 8, rMin: 1, rMax: 3 };
    profile.biofluidBlobs = { count: 6, rMin: 1, rMax: 2 };
  } else if (biome.stratum === 'aquifer') {
    // Agua dividindo o chao em ilhas. Minerais azulados (cristal) marcam as
    // margens; o fungo gosta da umidade mesmo sem ocupacao.
    profile.waterBlobs = { count: 12 + depth * 4, rMin: 3, rMax: 6 };
    profile.halls = 'karst';
    profile.biofluidBlobs = { count: 6, rMin: 1, rMax: 2 };
    profile.fungalBlobs = { count: 14, rMin: 2, rMax: 3 };
    profile.crystalChance = 0.05;
    profile.fragileThinChance = 0.45;
  } else if (biome.stratum === 'sulfur') {
    // Pulmoes subterraneos: MUITO mais respiradouros, paredes corroidas de
    // dentro para fora (fragil alto) e quase nada de vida umida. O gas em si
    // continua sendo o SURF_GAS de sempre — o que muda e a densidade de fontes
    // e o ciclo de ventilacao (stepCells).
    profile.ventCount = 14;
    profile.halls = 'lungs';
    profile.fragileThinChance = 0.65;
    profile.oreChance = 0.06;
    profile.crystalChance = 0.02;
    profile.fungalBlobs = { count: 6, rMin: 1, rMax: 2 };
    profile.biofluidBlobs = { count: 4, rMin: 1, rMax: 2 };
  } else if (biome.stratum === 'furnace') {
    // Fissuras incandescentes e campos de carvao. Seco: nada de biofluido, e o
    // fungo nao sobrevive. Menos respiradouros — o perigo daqui e termico.
    profile.emberBlobs = { count: 10 + depth * 3, rMin: 2, rMax: 4 };
    profile.halls = 'canyon';
    profile.coalBlobs = { count: 14, rMin: 2, rMax: 4 };
    profile.ventCount = 4;
    profile.fragileThinChance = 0.5;
    profile.oreChance = 0.08;
    profile.crystalChance = 0.02;
    profile.fungalBlobs = { count: 4, rMin: 1, rMax: 2 };
    profile.biofluidBlobs = { count: 0, rMin: 0, rMax: 0 };
  } else if (biome.stratum === 'silica') {
    // Sumidouros: rocha esbranquicada que cede. Quase toda parede fina e
    // fragil — atravessar abrindo buracos e a identidade, e o risco e abrir o
    // flanco errado. Pobre em tudo o mais.
    profile.fragileThinChance = 0.78;
    profile.halls = 'terraced';
    // O minerio da sedimentar segue a CAMADA: seams horizontais legiveis na
    // parede, em vez de salpico — e a chance pontual cai para compensar.
    profile.oreSeams = 3;
    profile.oreChance = 0.04;
    profile.crystalChance = 0.02;
    profile.ventCount = 4;
    profile.fungalBlobs = { count: 5, rMin: 1, rMax: 2 };
    profile.biofluidBlobs = { count: 2, rMin: 1, rMax: 2 };
  } else if (biome.stratum === 'glacial') {
    // Lagos congelados e cristais de geada. O gelo nao conduz nem retarda; o
    // jogo do estrato e DERRETER a rota certa (agua condutiva) e correr antes
    // do recongelamento.
    profile.iceBlobs = { count: 14 + depth * 3, rMin: 3, rMax: 5 };
    profile.halls = 'lakes';
    profile.crystalChance = 0.07;
    profile.fragileThinChance = 0.4;
    profile.oreChance = 0.06;
    profile.ventCount = 2;
    profile.fungalBlobs = { count: 4, rMin: 1, rMax: 2 };
    profile.biofluidBlobs = { count: 0, rMin: 0, rMax: 0 };
  }

  if (biome.occupation === 'mycelial') {
    // A colonia cobre o estrato sem apagar a geologia dele.
    profile.fungalBlobs = {
      count: profile.fungalBlobs.count + 22,
      rMin: 2,
      rMax: Math.max(4, profile.fungalBlobs.rMax),
    };
    profile.biofluidBlobs = {
      count: profile.biofluidBlobs.count + 6,
      rMin: Math.max(1, profile.biofluidBlobs.rMin),
      rMax: Math.max(3, profile.biofluidBlobs.rMax),
    };
  } else if (biome.occupation === 'aurix') {
    // A cicatriz industrial: veios expostos pela lavra, paredes reforcadas
    // (menos frageis) e mais automatos ainda cumprindo a cota.
    profile.oreChance = profile.oreChance + 0.05;
    profile.fragileThinChance = Math.max(0.3, profile.fragileThinChance - 0.15);
    profile.minerCap = MINER_PER_SECTOR + 2;
  }

  return profile;
};

/**
 * Fauna do setor: afinidades ambientais, nao bestiarios independentes.
 *
 * Os arquetipos sao os MESMOS em todo o Veio; o que o estrato muda e a
 * composicao — e a composicao muda o problema. O prismatico e mineral
 * (bruisers entre pilares, stalkers encurtando distancia); o aquifero e
 * anfibio (spitters territoriais, bombers criando zonas sobre as ilhas); o
 * micelio traz o proprio ecossistema. A profundidade continua endurecendo a
 * mistura, como o SECTOR_MIX historico fazia.
 */
export const biomeMix = (biome: SectorBiome, sector: number): readonly EnemyArchetype[] => {
  const depth = Math.max(1, Math.min(SECTOR_COUNT, sector));

  let mix: EnemyArchetype[];
  if (biome.stratum === 'prismatic') {
    mix =
      depth <= 1
        ? ['stalker', 'bruiser', 'stalker', 'spitter', 'bruiser', 'stalker', 'bomber', 'stalker']
        : ['bruiser', 'stalker', 'bruiser', 'stalker', 'spitter', 'bomber', 'bruiser', 'stalker', 'bomber', 'stalker'];
  } else if (biome.stratum === 'aquifer') {
    mix =
      depth <= 1
        ? ['spitter', 'stalker', 'spitter', 'stalker', 'bomber', 'spitter', 'stalker', 'bomber']
        : ['spitter', 'stalker', 'spitter', 'bomber', 'stalker', 'spitter', 'bomber', 'bruiser', 'spitter', 'stalker'];
  } else if (biome.stratum === 'sulfur') {
    // Afinidade alta de spitter e bomber (a tabela da spec); bruisers bloqueiam
    // as passagens respiraveis.
    mix = ['spitter', 'bomber', 'bruiser', 'spitter', 'stalker', 'bomber', 'bruiser', 'spitter', 'bomber', 'stalker'];
  } else if (biome.stratum === 'furnace') {
    // Corpos minerais e portadores: o que sobrevive ao calor.
    mix = ['bruiser', 'bomber', 'bruiser', 'stalker', 'bomber', 'bruiser', 'bomber', 'bruiser', 'stalker', 'bomber'];
  } else if (biome.stratum === 'silica') {
    // Emboscada: stalkers atras de paredes que qualquer tiro abre.
    mix = ['stalker', 'spitter', 'stalker', 'bruiser', 'stalker', 'spitter', 'bomber', 'stalker'];
  } else if (biome.stratum === 'glacial') {
    // Stalker e bruiser, como a tabela da spec: a cripta e silenciosa e dura.
    mix = ['stalker', 'bruiser', 'stalker', 'bruiser', 'stalker', 'spitter', 'bruiser', 'stalker', 'bruiser', 'stalker'];
  } else {
    // Basalto: a mistura historica por setor, intocada.
    mix =
      depth === 1
        ? ['stalker', 'stalker', 'spitter', 'stalker', 'bomber', 'spitter', 'stalker', 'bomber']
        : depth === 2
          ? ['stalker', 'spitter', 'bruiser', 'stalker', 'bomber', 'spitter', 'bruiser', 'stalker']
          : ['stalker', 'stalker', 'spitter', 'bruiser', 'stalker', 'spitter', 'bomber', 'bruiser', 'bomber', 'stalker'];
  }

  if (biome.occupation === 'mycelial') {
    // O micelio troca musculo por materia organica: cada terceiro lugar da
    // mistura vira spitter/bomber alternado. Troca posicoes, nunca o TAMANHO —
    // densidade e a coisa que menos deveria variar por ocupacao.
    mix = mix.map((arch, i) => (i % 3 === 2 ? (i % 2 === 0 ? 'spitter' : 'bomber') : arch));
  }
  return mix;
};

/**
 * Chance de a vaga de elite ser o Cavalo Fungico, por ocupacao.
 *
 * O micelio quase dobra a chance — o Cavalo E fauna micelial. A leitura da
 * regra continua a mesma de HORSE_SPAWN_CHANCE; quem compara com ela e
 * `populateSector`, sempre com UMA tirada da RNG, entao a ordem dos sorteios
 * da run nao muda com a ocupacao.
 */
export const horseChanceFor = (biome: SectorBiome, base: number): number =>
  biome.occupation === 'mycelial' ? Math.min(1, base * 1.8) : base;
