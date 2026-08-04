// Marcos narrativos dos Ativos de assinatura: cinco trilhas de memoria do Veio.
//
// Este modulo so contem DADOS. A avaliacao dos gatilhos continua em
// progression-lore.ts, junto da unica porta autoritativa de desbloqueio.
// Separar os vinte documentos evita transformar o catalogo central numa lista
// impossivel de revisar e deixa explicita a regra: nao sao vinte historias
// paralelas, mas cinco maneiras pelas quais o Veio preserva uma intencao.

import type { EnemyArchetype, LoreFragmentId } from '@voxelyn/survival-sim';

export type AssetMemoryMilestone = {
  archetype: EnemyArchetype;
  minKills: number;
  fragmentId: LoreFragmentId;
};

/**
 * 1 abate continua abrindo a ficha corporativa base em ASSET_LORE.
 * Estes sao os quatro passos posteriores de cada arco.
 */
export const ASSET_MEMORY_MILESTONE_LORE = [
  // Ressonante — o pedido coletivo de socorro que aprende a responder.
  { archetype: 'resonant', minKills: 3, fragmentId: 'AX-ENG-019' },
  { archetype: 'resonant', minKills: 6, fragmentId: 'AX-INC-035' },
  { archetype: 'resonant', minKills: 10, fragmentId: 'AX-EXE-044' },
  { archetype: 'resonant', minKills: 15, fragmentId: 'AX-UNK-053' },

  // Lampreia — o gesto de resgate que perdeu a nocao de superficie.
  { archetype: 'mud_lamprey', minKills: 3, fragmentId: 'AX-ENG-024' },
  { archetype: 'mud_lamprey', minKills: 6, fragmentId: 'AX-INC-036' },
  { archetype: 'mud_lamprey', minKills: 10, fragmentId: 'AX-EXE-045' },
  { archetype: 'mud_lamprey', minKills: 15, fragmentId: 'AX-UNK-054' },

  // Fole — continuar ventilando por quem ja nao respira.
  { archetype: 'bellows', minKills: 3, fragmentId: 'AX-ENG-026' },
  { archetype: 'bellows', minKills: 6, fragmentId: 'AX-INC-037' },
  { archetype: 'bellows', minKills: 10, fragmentId: 'AX-EXE-046' },
  { archetype: 'bellows', minKills: 15, fragmentId: 'AX-UNK-055' },

  // Scoriac — uma ordem de contencao que continua sem a porta.
  { archetype: 'scoriac', minKills: 3, fragmentId: 'AX-ENG-027' },
  { archetype: 'scoriac', minKills: 6, fragmentId: 'AX-INC-038' },
  { archetype: 'scoriac', minKills: 10, fragmentId: 'AX-EXE-047' },
  { archetype: 'scoriac', minKills: 15, fragmentId: 'AX-UNK-056' },

  // Espectro Glacial — liderar uma equipe por um mapa que morreu.
  { archetype: 'frost_wraith', minKills: 3, fragmentId: 'AX-ENG-028' },
  { archetype: 'frost_wraith', minKills: 6, fragmentId: 'AX-INC-039' },
  { archetype: 'frost_wraith', minKills: 10, fragmentId: 'AX-EXE-048' },
  { archetype: 'frost_wraith', minKills: 15, fragmentId: 'AX-UNK-057' },
] as const satisfies readonly AssetMemoryMilestone[];

/**
 * Caminhos de investigacao. As chaves que ja existem no catalogo central
 * substituem a relacao antiga preservando-a e acrescentando o primeiro elo do
 * arco. Isso mantem a ficha inicial ligada ao que ela tentou negar.
 */
export const ASSET_MEMORY_RELATED: Record<LoreFragmentId, LoreFragmentId[]> = {
  // Ressonante.
  'AX-ENG-017': ['AX-INC-029', 'AX-ENG-019'],
  'AX-ENG-019': ['AX-ENG-017', 'AX-INC-035'],
  'AX-INC-035': ['AX-ENG-019', 'AX-EXE-044'],
  'AX-EXE-044': ['AX-INC-035', 'AX-UNK-053'],
  'AX-UNK-053': ['AX-EXE-044', 'AX-UNK-047', 'AX-UNK-046', 'AX-GEN-G04'],

  // Lampreia.
  'AX-PRC-018': ['AX-PRC-023', 'AX-ENG-024'],
  'AX-ENG-024': ['AX-PRC-018', 'AX-INC-036'],
  'AX-INC-036': ['AX-ENG-024', 'AX-EXE-045'],
  'AX-EXE-045': ['AX-INC-036', 'AX-UNK-054'],
  'AX-UNK-054': ['AX-EXE-045', 'AX-PRC-016', 'AX-UNK-046', 'AX-UNK-044'],

  // Fole.
  'AX-INC-022': ['AX-INC-030', 'AX-ENG-026'],
  'AX-ENG-026': ['AX-INC-022', 'AX-INC-037'],
  'AX-INC-037': ['AX-ENG-026', 'AX-EXE-046'],
  'AX-EXE-046': ['AX-INC-037', 'AX-UNK-055'],
  'AX-UNK-055': ['AX-EXE-046', 'AX-INC-027', 'AX-UNK-046', 'AX-GEN-G04'],

  // Scoriac.
  'AX-INC-026': ['AX-INC-025', 'AX-ENG-027'],
  'AX-ENG-027': ['AX-INC-026', 'AX-INC-038'],
  'AX-INC-038': ['AX-ENG-027', 'AX-EXE-047'],
  'AX-EXE-047': ['AX-INC-038', 'AX-UNK-056', 'AX-ENG-020'],
  'AX-UNK-056': ['AX-EXE-047', 'AX-EXE-042', 'AX-UNK-046', 'AX-UNK-049'],

  // Espectro Glacial.
  'AX-INC-028': ['AX-ENG-025', 'AX-ENG-028'],
  'AX-ENG-028': ['AX-INC-028', 'AX-INC-039'],
  'AX-INC-039': ['AX-ENG-028', 'AX-EXE-048'],
  'AX-EXE-048': ['AX-INC-039', 'AX-UNK-057'],
  'AX-UNK-057': ['AX-EXE-048', 'AX-UNK-044', 'AX-UNK-046', 'AX-GEN-G04'],

  // O caso do Major vira a porta de entrada para os outros cinco — nao uma
  // resposta, mas a primeira evidencia de que um Ativo pode carregar memoria.
  'AX-UNK-046': [
    'AX-EXE-043',
    'AX-INC-033',
    'AX-UNK-049',
    'AX-UNK-053',
    'AX-UNK-054',
    'AX-UNK-055',
    'AX-UNK-056',
    'AX-UNK-057',
  ],
};

export const ASSET_MEMORY_REDACTION: Record<LoreFragmentId, 0 | 1 | 2 | 3> = {
  'AX-ENG-019': 0,
  'AX-ENG-024': 1,
  'AX-ENG-026': 0,
  'AX-ENG-027': 0,
  'AX-ENG-028': 1,
  'AX-INC-035': 2,
  'AX-INC-036': 2,
  'AX-INC-037': 1,
  'AX-INC-038': 2,
  'AX-INC-039': 2,
  'AX-EXE-044': 2,
  'AX-EXE-045': 2,
  'AX-EXE-046': 2,
  'AX-EXE-047': 2,
  'AX-EXE-048': 2,
  'AX-UNK-053': 3,
  'AX-UNK-054': 3,
  'AX-UNK-055': 3,
  'AX-UNK-056': 3,
  'AX-UNK-057': 3,
};

/**
 * Cada grupo entra no ato do proprio prefixo. A ordem de desbloqueio continua
 * independente; isto e posicao editorial no arquivo corporativo.
 */
export const ASSET_MEMORY_CHRONOLOGY = {
  engineering: ['AX-ENG-019', 'AX-ENG-024', 'AX-ENG-026', 'AX-ENG-027', 'AX-ENG-028'],
  incident: ['AX-INC-035', 'AX-INC-036', 'AX-INC-037', 'AX-INC-038', 'AX-INC-039'],
  executive: ['AX-EXE-044', 'AX-EXE-045', 'AX-EXE-046', 'AX-EXE-047', 'AX-EXE-048'],
  unknown: ['AX-UNK-053', 'AX-UNK-054', 'AX-UNK-055', 'AX-UNK-056', 'AX-UNK-057'],
} as const satisfies Record<string, readonly LoreFragmentId[]>;

export const ASSET_MEMORY_FRAGMENT_IDS: readonly LoreFragmentId[] = [
  ...ASSET_MEMORY_CHRONOLOGY.engineering,
  ...ASSET_MEMORY_CHRONOLOGY.incident,
  ...ASSET_MEMORY_CHRONOLOGY.executive,
  ...ASSET_MEMORY_CHRONOLOGY.unknown,
];
