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
    seed: 2,
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
    seed: 11,
    sector: 3,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  sheet_leviathan: {
    label: 'Leviatã do Lençol',
    place: 'Aquífero Negro',
    seed: 5,
    sector: 3,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
  lung_matrix: {
    label: 'Pulmão-Matriz',
    place: 'Fenda Sulfurosa',
    seed: 9,
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
    seed: 22,
    sector: 7,
    generation: 'G-04',
    sectorCount: 7,
    coreSectors: [3, 7],
  },
};

/** Ordem de exibicao no seletor: da entrada mais rasa (G-04 setor 3) a mais funda. */
export const ARENA_BOSS_ORDER: readonly ArenaBossId[] = [
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
