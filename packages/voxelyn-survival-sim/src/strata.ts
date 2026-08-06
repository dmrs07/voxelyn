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

import { AQUIFER_PIPE_COUNT, MAX_LINEAGE_SECTORS, MINER_PER_SECTOR } from './constants.js';
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
  | 'glacial'
  /**
   * Estrato Ferrifero: formacao natural de ferro e magnetita — o VEIO
   * PRINCIPAL que justificou a operacao Aurix. Minerio em seams grossos e
   * nos densos, paredes que CONDUZEM (a descarga viaja mais longe pelo veio
   * conectado), e a maior densidade de Miners do Veio.
   */
  | 'ferric';

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
export type LineageId =
  | 'hydric'
  | 'mineral'
  | 'industrial'
  | 'thermal'
  | 'arid'
  | 'cryo'
  /**
   * BASALTICA: o mapa historico como linhagem inteira, do topo ao fundo.
   *
   * Existe por uma razao estrutural, e ela so apareceu quando a tabela de
   * chefes ficou completa: o Guardiao e o dono das Galerias de Basalto, e o
   * basalto era o setor 1 de TODAS as linhagens e o final de nenhuma. Como so
   * o setor final tem chefe, o chefe original do jogo tinha deixado de poder
   * existir.
   *
   * Nao e uma linhagem sem graca por ser um estrato so: as intrusoes de
   * ocupacao continuam sorteando micelio e Aurix nos setores 2 e 3, entao ela
   * termina no Guardiao, no Bispo ou no Diamandis conforme o que tomou conta
   * do fundo. E a unica linhagem em que os TRES chefes de ocupacao e de
   * basalto disputam a mesma camara.
   */
  | 'basaltic';

export type SectorBiome = {
  stratum: StratumId;
  occupation: OccupationId;
  lineage: LineageId;
};

/**
 * As linhagens, setor a setor — SETE posicoes cada uma.
 *
 * A tabela tem sete entradas e nao tres porque o comprimento POTENCIAL da
 * linhagem deixou de ser o mesmo numero que a profundidade acessivel da run.
 * Uma run de G-01 le as posicoes 1-3; uma de G-02, 1-4; G-03, 1-5; G-04, as
 * sete. As posicoes 1-3 sao EXATAMENTE as historicas em toda linhagem: uma
 * seed antiga com autorizacao de tres setores produz o mesmo mapa de sempre.
 *
 * A metade profunda nao e a repeticao da rasa. Cada linhagem ganha uma volta
 * — uma segunda colonia mais fundo, uma camara da Aurix dentro da catedral, um
 * pulmao de gas entre duas fornalhas — porque tres setores iguais ao fim de uma
 * descida de sete leem como mapa faltando conteudo, e nao como profundidade.
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
 * - industrial: Basalto -> Ferrifero (Cicatriz) -> Ferrifero profundo. O
 *   veio principal E a cicatriz: o lugar que justificou a operacao.
 * - arida: Basalto -> Sumidouros de Silica -> Sumidouros profundos. O chao
 *   deixa de segurar o teto, e o fundo e o dono dele (ver LINEAGES).
 * - crio: Basalto -> Cripta Glacial -> Cripta profunda. O gelo domina e a
 *   profundidade adensa as pontes e lagos congelados.
 * - basaltica: Basalto -> Basalto -> Basalto. O mapa historico do comeco ao
 *   fim, e a unica linhagem em que a camara final e das Galerias — ou seja, a
 *   unica em que o Guardiao pode ser o dono dela. As intrusoes de ocupacao
 *   continuam valendo, entao ela tambem termina no Bispo ou no Diamandis
 *   quando alguma delas toma o fundo.
 */
type LineageStep = {
  stratum: StratumId;
  occupation: OccupationId;
  /**
   * O nome editorial da posicao, em pt-BR.
   *
   * Ele nao decide nada da simulacao — o estrato e a ocupacao decidem tudo —
   * mas mora AQUI e nao no cliente porque e a curva da linhagem escrita por
   * extenso, e ela e o unico jeito de ler a tabela e saber se o quinto setor
   * diz alguma coisa nova. Um segundo arquivo de nomes desalinharia na
   * primeira vez que alguem trocasse um estrato.
   */
  title: string;
};

/** Uma linhagem resolve SETE posicoes. Quantas a run visita e outra coisa. */
type LineageTable = readonly [
  LineageStep,
  LineageStep,
  LineageStep,
  LineageStep,
  LineageStep,
  LineageStep,
  LineageStep,
];

const LINEAGES: Record<LineageId, LineageTable> = {
  hydric: [
    { stratum: 'basalt', occupation: 'none', title: 'Galerias Umidas' },
    { stratum: 'aquifer', occupation: 'none', title: 'Aquifero Superior' },
    { stratum: 'aquifer', occupation: 'mycelial', title: 'Reservatorio Negro' },
    { stratum: 'aquifer', occupation: 'none', title: 'Galerias Submersas' },
    { stratum: 'aquifer', occupation: 'none', title: 'Lencol Profundo' },
    // A colonia volta MAIS FUNDO, e nao e a mesma do setor 3: la ela tinha
    // tomado um reservatorio; aqui ela e o proprio lencol. E o unico jeito de
    // a linhagem hidrica ter dois encontros miceliais sem repetir o primeiro.
    { stratum: 'aquifer', occupation: 'mycelial', title: 'Colonia Abissal' },
    { stratum: 'aquifer', occupation: 'none', title: 'Fossa do Aquifero' },
  ],
  mineral: [
    { stratum: 'basalt', occupation: 'none', title: 'Basalto Cristalizado' },
    { stratum: 'prismatic', occupation: 'none', title: 'Galerias Prismaticas' },
    { stratum: 'prismatic', occupation: 'none', title: 'Catedral Prismatica' },
    { stratum: 'prismatic', occupation: 'none', title: 'Nervuras Ressonantes' },
    { stratum: 'prismatic', occupation: 'none', title: 'Coro Mineral' },
    // A Aurix montou uma camara de LEITURA aqui: a ressonancia do estrato era
    // dado, e dado se mede. A cicatriz industrial dentro da catedral e o que
    // impede a metade profunda da linhagem de ser a mesma nave seis vezes.
    { stratum: 'prismatic', occupation: 'aurix', title: 'Camara de Reflexao' },
    { stratum: 'prismatic', occupation: 'none', title: 'Coracao Ressonante' },
  ],
  industrial: [
    { stratum: 'basalt', occupation: 'none', title: 'Escavacao Inicial' },
    { stratum: 'ferric', occupation: 'aurix', title: 'Galerias Ferriferas' },
    { stratum: 'ferric', occupation: 'aurix', title: 'Complexo Aurix' },
    { stratum: 'ferric', occupation: 'aurix', title: 'Linha de Extracao' },
    { stratum: 'ferric', occupation: 'aurix', title: 'Cicatriz Aurix' },
    { stratum: 'ferric', occupation: 'aurix', title: 'Instalacao de Recuperacao' },
    // O fundo da industrial NAO tem ocupacao, e e a unica posicao da linhagem
    // sem ela. O poco leva o nome da maquina que o abriu, mas a operacao parou
    // antes de chegar aqui: o que reina no fim e o VEIO — a formacao que
    // justificou tudo, e o Magnetarca com ela. Sem esta linha a linhagem
    // enfrentaria o Diamandis duas vezes na mesma run de G-04.
    { stratum: 'ferric', occupation: 'none', title: 'Poco Diamandis' },
  ],
  thermal: [
    { stratum: 'basalt', occupation: 'none', title: 'Basalto Fraturado' },
    { stratum: 'sulfur', occupation: 'none', title: 'Fenda Sulfurosa' },
    { stratum: 'furnace', occupation: 'none', title: 'Camara de Ventilacao' },
    { stratum: 'furnace', occupation: 'none', title: 'Galeria Carbonizada' },
    // A Fenda volta MAIS FUNDA no meio da descida: o gas nao acaba porque a
    // rocha esquentou, ele se concentra. E o respiro entre duas fornalhas.
    { stratum: 'sulfur', occupation: 'none', title: 'Pulmao Profundo' },
    { stratum: 'furnace', occupation: 'none', title: 'Mar de Escoria' },
    { stratum: 'furnace', occupation: 'none', title: 'Coracao da Fornalha' },
  ],
  arid: [
    { stratum: 'basalt', occupation: 'none', title: 'Basalto Seco' },
    { stratum: 'silica', occupation: 'none', title: 'Silica Fraturada' },
    // A arida termina NA SILICA, e nao mais na Fornalha.
    //
    // A tabela antiga era basalto -> silica -> fornalha ("a silica vitrifica
    // rumo ao calor: dois caminhos chegam a Fornalha"), e ela tinha uma
    // consequencia que so apareceu quando o Devorador Branco ganhou corpo: o
    // estrato sedimentar NUNCA era o ultimo, e como so o setor final tem
    // chefe, o dono dos Sumidouros nao podia existir. Um chefe que nao spawna
    // nao esta implementado.
    //
    // Terminar no proprio estrato e o que as outras linhagens ja fazem
    // (mineral, industrial e crio dobram o seu no fim), e a Fornalha continua
    // tendo o caminho dela pela termica. O que se perde e o segundo acesso a
    // Fornalha; o que se ganha e o encontro que o estrato sempre prometeu.
    { stratum: 'silica', occupation: 'none', title: 'Sumidouros de Silica' },
    { stratum: 'silica', occupation: 'none', title: 'Galerias Moveis' },
    { stratum: 'silica', occupation: 'none', title: 'Deserto Subterraneo' },
    { stratum: 'silica', occupation: 'none', title: 'Silica Vitrificada' },
    { stratum: 'silica', occupation: 'none', title: 'Ninho do Devorador' },
  ],
  cryo: [
    { stratum: 'basalt', occupation: 'none', title: 'Basalto Frio' },
    { stratum: 'glacial', occupation: 'none', title: 'Galerias de Geada' },
    { stratum: 'glacial', occupation: 'none', title: 'Cripta Glacial' },
    { stratum: 'glacial', occupation: 'none', title: 'Lencol Congelado' },
    { stratum: 'glacial', occupation: 'none', title: 'Camara dos Ecos' },
    { stratum: 'glacial', occupation: 'none', title: 'Palacio de Gelo' },
    { stratum: 'glacial', occupation: 'none', title: 'Trono da Geada' },
  ],
  basaltic: [
    { stratum: 'basalt', occupation: 'none', title: 'Galerias de Basalto' },
    { stratum: 'basalt', occupation: 'none', title: 'Galerias Inferiores' },
    { stratum: 'basalt', occupation: 'none', title: 'Camara do Guardiao' },
    { stratum: 'basalt', occupation: 'none', title: 'Fratura Basaltica' },
    { stratum: 'basalt', occupation: 'none', title: 'Colunata Profunda' },
    { stratum: 'basalt', occupation: 'none', title: 'Anfiteatro Negro' },
    { stratum: 'basalt', occupation: 'none', title: 'Raiz do Veio' },
  ],
};

export const LINEAGE_IDS: readonly LineageId[] = [
  'hydric',
  'mineral',
  'industrial',
  'thermal',
  'arid',
  'cryo',
  'basaltic',
];

/**
 * Hash inteiro puro, no mesmo espirito de `sectorSeed`. NAO usa a RNG da run:
 * o bioma precisa ser derivavel sem consumir estado.
 */
const mix32 = (a: number, b: number): number =>
  (Math.imul(a ^ Math.imul(b, 0x9e3779b9), 0x85ebca6b) ^ ((a ^ b) >>> 13)) >>> 0;

/** Linhagem da run. Funcao pura da seed. */
export const lineageOf = (runSeed: number): LineageId =>
  LINEAGE_IDS[mix32(runSeed >>> 0, 0x11d3a6e5) % LINEAGE_IDS.length];

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
  const clamped = Math.max(1, Math.min(MAX_LINEAGE_SECTORS, sector));
  const base = table[clamped - 1];

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
 * O nome editorial da posicao N da linhagem. Funcao pura, como tudo aqui.
 *
 * Existe para o anuncio de setor poder dizer "Lencol Profundo" em vez de
 * repetir "Aquifero Negro" quatro vezes numa run de sete setores. O cliente
 * traduz o que quiser em cima disto; a simulacao so responde qual posicao e.
 */
export const sectorTitle = (runSeed: number, sector: number): string =>
  LINEAGES[lineageOf(runSeed)][
    Math.max(1, Math.min(MAX_LINEAGE_SECTORS, sector)) - 1
  ].title;

/**
 * A INTENSIDADE de profundidade que os perfis de worldgen leem.
 *
 * Duas exigencias se cruzam aqui e a funcao existe para atende-las juntas.
 *
 * 1. Os tres primeiros setores nao podem mudar. A intensidade e IDENTICA ao
 *    indice cru (`sector - 1`) ate o terceiro, entao uma seed jogada antes da
 *    expansao gera o mesmo mapa depois dela — e a mesma seed em G-01 e em G-04
 *    gera os mesmos tres primeiros setores, que e a promessa da spec.
 * 2. A partir do quarto a inclinacao CAI PELA METADE. Multiplicar densidade
 *    linearmente ate o setimo entregaria uma Catedral com um terco de cristal
 *    no chao e um Aquifero sem chao seco — profundidade lida como caos, e nao
 *    como pressao. O que cresce fundo e a COMPOSICAO (ver `biomeMix`), o chefe
 *    e o Nucleo selado; a densidade acompanha de longe.
 *
 *   setor       1  2  3  4  5  6  7
 *   intensidade 0  1  2  3  3  4  4
 *
 * Inteiro de proposito: os perfis multiplicam contagens de blob por ela, e
 * meio blob nao existe.
 */
export const depthIntensity = (sector: number): number => {
  const index = Math.max(0, Math.min(MAX_LINEAGE_SECTORS - 1, Math.trunc(sector) - 1));
  return index <= 2 ? index : 2 + Math.ceil((index - 2) / 2);
};

/**
 * A profundidade PROPORCIONAL da run, 0 na entrada e 1 no ultimo setor.
 *
 * Ao contrario de `depthIntensity`, esta depende do total acessivel: ela
 * responde "quanto da descida ja foi", que e uma pergunta sobre a RUN e nao
 * sobre o Veio. Serve a apresentacao e a quem precisa de uma escala relativa;
 * nunca ao worldgen, que teria de produzir mapas diferentes para a mesma seed
 * em geracoes diferentes se lesse daqui.
 */
export const normalizedDepth = (sector: number, sectorCount: number): number => {
  if (sectorCount <= 1) return 1;
  const index = Math.max(0, Math.min(sectorCount - 1, sector - 1));
  return index / (sectorCount - 1);
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
  // `depthIntensity` e nao `sector - 1`: ver a funcao. Os tres primeiros
  // setores mantem o valor historico (0, 1, 2) e a inclinacao cai pela metade
  // depois, entao o setimo setor e mais denso que o terceiro sem ser o triplo
  // dele.
  const depth = depthIntensity(sector);

  // Base: Galerias de Basalto — os valores historicos do worldgen.
  const profile: WorldgenProfile = {
    fragileThinChance: 0.55,
    oreChance: 0.07,
    crystalChance: 0.03,
    crystalVeins: 0,
    oreSeams: 0,
    oreKnots: 0,
    fungalBlobs: { count: 26, rMin: 2, rMax: 4 },
    biofluidBlobs: { count: 12, rMin: 1, rMax: 3 },
    waterBlobs: { count: 0, rMin: 0, rMax: 0 },
    iceBlobs: { count: 0, rMin: 0, rMax: 0 },
    emberBlobs: { count: 0, rMin: 0, rMax: 0 },
    coalBlobs: { count: 0, rMin: 0, rMax: 0 },
    ventCount: 6,
    railTracks: 0,
    pipeCount: 0,
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
    // OS DUTOS. Infraestrutura de um lugar que bombeava agua e perdeu a briga:
    // eles so existem aqui, e ficam mudos a run inteira. O unico momento em que
    // fazem alguma coisa e o Diluvio do Leviata, e ai sao eles que despejam —
    // ver `delugeField`. Ate la sao parede com uma historia.
    profile.pipeCount = AQUIFER_PIPE_COUNT;
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
  } else if (biome.stratum === 'ferric') {
    // Ferrifero: o veio principal. Minerio em seams grossos e NOS densos, e a
    // parede conectada conduz (FERRIC_VEIN_SCALE em materials.ts). Fissuras
    // compridas de galeria industrial; quase nada de vida — ferro e trabalho.
    profile.oreChance = 0.12 + depth * 0.02;
    profile.oreSeams = 5;
    profile.oreKnots = 3;
    // Os trilhos que levavam o minerio: a linha morreu, a armadilha ficou.
    profile.railTracks = 3;
    profile.halls = 'canyon';
    profile.crystalChance = 0.02;
    profile.fragileThinChance = 0.45;
    profile.ventCount = 5;
    profile.minerCap = MINER_PER_SECTOR + 3;
    profile.fungalBlobs = { count: 6, rMin: 1, rMax: 2 };
    profile.biofluidBlobs = { count: 4, rMin: 1, rMax: 2 };
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
    // max, nao atribuicao: o Ferrifero ja poe MINER_PER_SECTOR + 3 e a
    // cicatriz nao pode REBAIXAR a densidade do lugar que a justificou.
    profile.minerCap = Math.max(profile.minerCap, MINER_PER_SECTOR + 2);
    // A cicatriz deixou trilhos onde quer que tenha operado.
    profile.railTracks = Math.max(profile.railTracks, 2);
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
  // Mesma escada de `depthIntensity`, deslocada para 1: setores 1, 2 e 3 leem
  // 1, 2 e 3 como sempre leram, e a metade profunda vive no ramo mais duro.
  const depth = depthIntensity(sector) + 1;

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
    // O bombardeiro daqui e o de ENXOFRE, nunca o de esporos: o Spore Bomber e
    // uma coisa micelial, e nao ha micelio nenhum produzindo esporo dentro de
    // uma fenda de gas. Mesma silhueta, quimica do lugar — e o cadaver dele
    // larga a nuvem que a fenda inteira ja ameaca acender.
    mix = ['spitter', 'sulfur_bomber', 'bruiser', 'spitter', 'stalker', 'sulfur_bomber', 'bruiser', 'spitter', 'sulfur_bomber', 'stalker'];
  } else if (biome.stratum === 'furnace') {
    // Corpos minerais e portadores: o que sobrevive ao calor. O bombardeiro,
    // pelo mesmo motivo da Fenda, e o de enxofre — numa caverna de magma a
    // nuvem verde de esporos era o sinal mais fora de lugar do jogo.
    mix = ['bruiser', 'sulfur_bomber', 'bruiser', 'stalker', 'sulfur_bomber', 'bruiser', 'sulfur_bomber', 'bruiser', 'stalker', 'sulfur_bomber'];
  } else if (biome.stratum === 'silica') {
    // Emboscada: stalkers atras de paredes que qualquer tiro abre.
    mix = ['stalker', 'spitter', 'stalker', 'bruiser', 'stalker', 'spitter', 'bomber', 'stalker'];
  } else if (biome.stratum === 'glacial') {
    // Stalker e bruiser, como a tabela da spec: a cripta e silenciosa e dura.
    mix = ['stalker', 'bruiser', 'stalker', 'bruiser', 'stalker', 'spitter', 'bruiser', 'stalker', 'bruiser', 'stalker'];
  } else if (biome.stratum === 'ferric') {
    // O chao de fabrica do Veio: corpos minerais pesados guardando o minerio
    // (a densidade de MINERS vem do minerCap do perfil, nao da mistura).
    mix = ['bruiser', 'stalker', 'bruiser', 'spitter', 'bruiser', 'stalker', 'bomber', 'bruiser', 'stalker', 'bruiser'];
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
  if (sector >= DEEP_SECTOR) {
    // A metade profunda nao ganha MAIS bichos — ganha uma composicao que uma
    // resposta so nao cobre. Trocar uma vaga em cada quatro pelo contraponto do
    // arquetipo (corpo a corpo vira alcance, alcance vira corpo a corpo)
    // significa que nenhuma faixa da arena fica confortavel: recuar encontra
    // quem atira, avancar encontra quem prensa.
    //
    // Mesmo tamanho de lista, mesma ordem de RNG, mesma densidade. E a unica
    // forma de escalar que nao termina em vida inflada.
    mix = mix.map((arch, i) => (i % 4 === 1 ? (DEEP_COUNTERPART[arch] ?? arch) : arch));
  }
  return mix;
};

/** A partir daqui a run deixou de ser uma descida de tres setores. */
const DEEP_SECTOR = 5;

/**
 * O contraponto de cada arquetipo comum: quem responde ao jeito de lutar que o
 * original convida. Fechado nos arquetipos que aparecem em MISTURA — chefes,
 * assinaturas e o Cavalo entram por outros caminhos e nao passam por aqui.
 */
const DEEP_COUNTERPART: Partial<Record<EnemyArchetype, EnemyArchetype>> = {
  stalker: 'bruiser',
  bruiser: 'spitter',
  spitter: 'bomber',
  bomber: 'bruiser',
  sulfur_bomber: 'bruiser',
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
