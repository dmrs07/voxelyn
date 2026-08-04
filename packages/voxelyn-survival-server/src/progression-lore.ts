// O Codex corporativo completo: 88 documentos e uma unica derivacao de acesso.
//
// `progression-lore-base.ts` preserva o catalogo anterior byte a byte. Este
// modulo compoe sobre ele os vinte milestones de Persistencia Mnemica, recalcula
// a cronologia editorial e substitui somente as funcoes que dependem do conjunto
// integral. Gatilhos, validacao, mascaramento e tipos continuam vindo da base.

import { UPGRADES, type EnemyArchetype, type LoreFragmentId } from '@voxelyn/survival-sim';
import type { LoreCategory, PublicLoreFragment } from '@voxelyn/survival-protocol';
import * as base from './progression-lore-base.js';
import type { LoreFacts, LoreFragmentDefinition } from './progression-lore-base.js';
import {
  ASSET_MEMORY_CHRONOLOGY,
  ASSET_MEMORY_MILESTONE_LORE,
  ASSET_MEMORY_REDACTION,
  ASSET_MEMORY_RELATED,
} from './progression-lore-asset-memory.js';
import { LORE_TEXT, type LoreLocale, type LoreText } from './progression-lore-text.js';

export * from './progression-lore-base.js';

export const ASSET_MILESTONE_LORE: readonly {
  archetype: EnemyArchetype;
  minKills: number;
  fragmentId: LoreFragmentId;
}[] = [...base.ASSET_MILESTONE_LORE, ...ASSET_MEMORY_MILESTONE_LORE];

const CATEGORY_BY_PREFIX: Record<string, LoreCategory> = {
  PUB: 'public_relations',
  ENG: 'engineering',
  PRC: 'procurement',
  INC: 'incident',
  EXE: 'executive',
  UNK: 'unknown',
  GEN: 'telemetry',
};

const CLEARANCE_BY_PREFIX: Record<string, number> = {
  PUB: 0,
  ENG: 1,
  PRC: 1,
  INC: 2,
  EXE: 3,
  UNK: 4,
  GEN: 2,
};

const prefixOf = (id: LoreFragmentId): string => id.split('-')[1] ?? 'PUB';

/**
 * Insere os novos documentos no fim do ato correspondente, sem depender da
 * ordem em que o jogador os desbloqueou.
 */
const chronologyIds = [...base.LORE_FRAGMENTS]
  .sort((a, b) => a.chronologyIndex - b.chronologyIndex)
  .map((fragment) => fragment.id);

const insertBefore = (
  target: LoreFragmentId,
  ids: readonly LoreFragmentId[],
): void => {
  const index = chronologyIds.indexOf(target);
  if (index < 0) throw new Error(`chronology anchor not found: ${target}`);
  chronologyIds.splice(index, 0, ...ids);
};

insertBefore('AX-PRC-014', ASSET_MEMORY_CHRONOLOGY.engineering);
insertBefore('AX-GEN-G03', ASSET_MEMORY_CHRONOLOGY.incident);
insertBefore('AX-UNK-041', ASSET_MEMORY_CHRONOLOGY.executive);
insertBefore('AX-GEN-G04', ASSET_MEMORY_CHRONOLOGY.unknown);

const CHRONOLOGY_INDEX = new Map(
  chronologyIds.map((id, index) => [id, index] as const),
);

const chronologyIndexFor = (id: LoreFragmentId): number => {
  const index = CHRONOLOGY_INDEX.get(id);
  if (index === undefined) throw new Error(`fragment absent from chronology: ${id}`);
  return index;
};

const baseFragments: LoreFragmentDefinition[] = base.LORE_FRAGMENTS.map(
  (fragment) => ({
    ...fragment,
    chronologyIndex: chronologyIndexFor(fragment.id),
    relatedFragmentIds: ASSET_MEMORY_RELATED[fragment.id] ?? fragment.relatedFragmentIds,
    redactionLevel: ASSET_MEMORY_REDACTION[fragment.id] ?? fragment.redactionLevel,
  }),
);

const memoryFragments: LoreFragmentDefinition[] = ASSET_MEMORY_MILESTONE_LORE.map(
  ({ archetype, minKills, fragmentId }) => {
    const prefix = prefixOf(fragmentId);
    return {
      id: fragmentId,
      trigger: { kind: 'asset', archetype, minKills },
      category: CATEGORY_BY_PREFIX[prefix] ?? 'unknown',
      clearanceLevel: CLEARANCE_BY_PREFIX[prefix] ?? 0,
      documentCode: fragmentId,
      chronologyIndex: chronologyIndexFor(fragmentId),
      relatedFragmentIds: ASSET_MEMORY_RELATED[fragmentId] ?? [],
      redactionLevel: ASSET_MEMORY_REDACTION[fragmentId] ?? 0,
    };
  },
);

export const LORE_FRAGMENTS: readonly LoreFragmentDefinition[] = [
  ...baseFragments,
  ...memoryFragments,
];

const BY_ID = new Map(LORE_FRAGMENTS.map((fragment) => [fragment.id, fragment]));

export const findLoreFragment = (
  id: LoreFragmentId,
): LoreFragmentDefinition | undefined => BY_ID.get(id);

export const TOTAL_LORE_FRAGMENTS = LORE_FRAGMENTS.length;

/** A unica porta de derivacao agora enxerga base e milestones. */
export const unlockedLoreFor = (facts: LoreFacts): LoreFragmentId[] =>
  LORE_FRAGMENTS.filter((fragment) => base.triggerSatisfied(fragment.trigger, facts)).map(
    (fragment) => fragment.id,
  );

const textFor = (id: LoreFragmentId, locale: LoreLocale): LoreText =>
  LORE_TEXT[locale][id] ?? LORE_TEXT.en[id] ?? { title: id, summary: '', body: '', source: '' };

export const toPublicFragment = (
  definition: LoreFragmentDefinition,
  locale: LoreLocale,
  unlocked?: ReadonlySet<LoreFragmentId>,
  read?: ReadonlySet<LoreFragmentId>,
): PublicLoreFragment => {
  const text = textFor(definition.id, locale);
  return {
    id: definition.id,
    trigger: base.publicTrigger(definition.trigger),
    category: definition.category,
    clearanceLevel: definition.clearanceLevel,
    documentCode: definition.documentCode,
    chronologyIndex: definition.chronologyIndex,
    title: text.title,
    summary: text.summary,
    body: text.body,
    source: text.source,
    relatedFragmentIds: unlocked
      ? definition.relatedFragmentIds.map((id) =>
          unlocked.has(id) ? id : base.maskCode(id),
        )
      : definition.relatedFragmentIds,
    redactionLevel: definition.redactionLevel,
    read: read?.has(definition.id) ?? false,
  };
};

/**
 * A invariante de protocolo continua a mesma e agora tambem confirma que o mapa
 * integral nao perdeu nenhum documento de upgrade durante a composicao.
 */
export const loreCoversEveryUpgrade = (): boolean =>
  base.loreCoversEveryUpgrade() &&
  UPGRADES.every((upgrade) => BY_ID.has(upgrade.loreFragmentId));
