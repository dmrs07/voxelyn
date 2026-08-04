// Catalogo textual completo da Aurix Dynamics.
//
// O arquivo-base preserva os 68 documentos existentes byte a byte. Os vinte
// documentos de Persistencia Mnemica entram por composicao, mantendo o corpo
// bloqueado exclusivamente no servidor e evitando uma edicao monolitica do
// arquivo historico.

import type { LoreFragmentId } from '@voxelyn/survival-sim';
import { ASSET_MEMORY_TEXT } from './progression-lore-asset-memory-text.js';
import {
  LORE_LOCALES,
  LORE_TEXT as BASE_LORE_TEXT,
  isLoreLocale,
  type LoreLocale,
  type LoreText,
} from './progression-lore-text-base.js';

export type { LoreLocale, LoreText } from './progression-lore-text-base.js';
export { LORE_LOCALES, isLoreLocale };

export const LORE_TEXT: Record<LoreLocale, Record<LoreFragmentId, LoreText>> = {
  'pt-BR': {
    ...BASE_LORE_TEXT['pt-BR'],
    ...ASSET_MEMORY_TEXT['pt-BR'],
  },
  en: {
    ...BASE_LORE_TEXT.en,
    ...ASSET_MEMORY_TEXT.en,
  },
};
