// Catalogo de arenas de chefe para a ferramenta de playtest isolado.
//
// O desafio nao e desenhar a arena — ela ja existe, e o setor inteiro que o
// chefe ocupa no jogo real, com o mesmo trash que a geracao normal poe la.
// O desafio e ENCONTRAR uma (seed, geracao, setor) cuja resolucao
// deterministica de bioma (`bossForSector`, ver @voxelyn/survival-sim) recaia
// no chefe pedido: quem decide isso e a linhagem da seed, e boa parte dos dez
// chefes so aparece numa geracao especifica (ex.: `lung_matrix` mora no
// ESTRATO sulfuroso, que na linhagem termica so cai no setor 5 — nunca no 3
// nem no 7, que sao os dois unicos slots de chefe de G-04).
//
// Cada entrada aqui foi achada por busca exaustiva OFFLINE sobre as funcoes
// PURAS de bioma/chefe (sem gerar mundo nenhum) e depois CONFIRMADA construindo
// a run de verdade e checando `state.sectorBoss.archetype` — ver o teste
// `arena-catalog.test.ts`. Trocar a tabela de linhagem ou a resolucao de chefe
// pode invalidar uma entrada; o teste e o que avisa.
import type { ProspectorGeneration } from '@voxelyn/survival-sim';

export type ArenaBossId =
  | 'seamstress'
  | 'guardian'
  | 'bishop'
  | 'diamandis'
  | 'white_devourer'
  | 'archcantor'
  | 'sheet_leviathan'
  | 'lung_matrix'
  | 'furnace_heart'
  | 'frost_queen'
  | 'magnetarch';

export type ArenaCatalogEntry = {
  /** Nome exibido no seletor. */
  label: string;
  /** O setor/estrato que a arena habita, para o subtitulo do seletor. */
  place: string;
  seed: number;
  sector: number;
  generation: ProspectorGeneration;
  sectorCount: number;
  coreSectors: readonly number[];
};

export const ARENA_CATALOG: Record<ArenaBossId, ArenaCatalogEntry> = {
  seamstress: {
    label: 'A Cerzideira',
    place: 'Colônia dos Costureiros',
    seed: 36,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  guardian: {
    label: 'Guardião',
    place: 'Galerias de Basalto',
    seed: 3,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  bishop: {
    label: 'Bispo',
    place: 'Contaminação Micelial',
    // Re-varrida na SIMULATION_VERSION 77 (intrusoes balanceadas): a seed 2
    // virou rocha suturada na Fornalha. A 7 e Reservatorio Negro de verdade:
    // aquifero com colonia micelial, a casa do Bispo.
    seed: 7,
    sector: 3,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  diamandis: {
    label: 'Diamandis',
    place: 'Cicatriz Aurix',
    seed: 0,
    sector: 3,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  white_devourer: {
    label: 'Devorador Branco',
    place: 'Sumidouros de Sílica',
    seed: 0,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  archcantor: {
    label: 'Arquicantor',
    place: 'Catedral Prismática',
    // Re-varrida na SIMULATION_VERSION 77: a seed 11 passou a entregar o
    // Bispo no nucleo do setor 3. A 154 e prismatica sem ocupacao — a rotunda
    // aberta e os cristais que o teste da catedral exige.
    seed: 154,
    sector: 3,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  sheet_leviathan: {
    // Seed 112 e nao a 5: com o DILUVIO e os DUTOS, a camara do Leviata deixou
    // de ser intercambiavel. Esta foi escolhida varrendo as seeds de Aquifero e
    // medindo o que sobra DEPOIS do recorte, que e o unico numero honesto —
    // medir numa caixa quadrada antes dele conta duto que a arena vai enterrar.
    //
    // O que ela entrega: 396 celulas de chao, 231 delas ja alagadas, e TRES
    // dutos com a boca despejando dentro da arena. A anterior servia para um
    // chefe que so nadava; nesta da para ver a agua entrar pelas paredes.
    //
    // Com as BACIAS e o Leviata em duas fases (SIMULATION_VERSION 59) ela
    // continua servindo, medida de novo: ~540 celulas de chao num raio de 14
    // do chefe, ~200 de agua rasa, 14 celulas profundas em tres pocas
    // ocupaveis (o carimbo abre cinco; duas caem na moldura do pedestal e
    // ficam so com a margem), chao seco caminhavel entre elas para a Sondagem
    // abrir as outras, e espaco para a cacada da segunda fase.
    label: 'Leviatã do Lençol',
    place: 'Aquífero Negro',
    seed: 112,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  lung_matrix: {
    label: 'Pulmão-Matriz',
    place: 'Fenda Sulfurosa',
    // Re-varrida na SIMULATION_VERSION 77 (intrusoes balanceadas): a seed 9
    // virou rocha suturada no enxofre. A 13 e Fenda Sulfurosa sem ocupacao.
    seed: 13,
    sector: 5,
    generation: 'G-03',
    sectorCount: 5,
    coreSectors: [3, 5],
  },
  furnace_heart: {
    label: 'Coração da Fornalha',
    place: 'Fornalha Abissal',
    seed: 1,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  frost_queen: {
    label: 'Rainha da Geada',
    place: 'Cripta Glacial',
    seed: 6,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  magnetarch: {
    label: 'Magnetarca',
    place: 'Estrato Ferrífero',
    // Re-varrida na SIMULATION_VERSION 77 (intrusoes balanceadas): a seed 22
    // virou rocha suturada no ferrifero. A 44 e o veio sem ocupacao.
    seed: 44,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
};

/** Ordem de exibicao no seletor: da entrada mais rasa (G-04 setor 3) a mais funda. */
export const ARENA_BOSS_ORDER: readonly ArenaBossId[] = [
  'seamstress',
  'guardian',
  'bishop',
  'archcantor',
  'sheet_leviathan',
  'lung_matrix',
  'diamandis',
  'white_devourer',
  'furnace_heart',
  'frost_queen',
  'magnetarch',
];
