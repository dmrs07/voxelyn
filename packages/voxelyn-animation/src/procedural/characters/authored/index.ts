import type { ProceduralCharacter } from '../../../types.js';
import {
  bomberAuthoredV2,
  bruiserAuthoredV2,
  guardianAuthoredV2,
  heroAuthoredV2,
  spitterAuthoredV2,
  stalkerAuthoredV2,
} from './generated-v2.js';
import type { AuthoredSpriteDef } from './types.js';

type Style = NonNullable<ProceduralCharacter['style']>;

export const AUTHORED_SPRITES: Record<Style, AuthoredSpriteDef> = {
  player: heroAuthoredV2,
  stalker: stalkerAuthoredV2,
  bruiser: bruiserAuthoredV2,
  spitter: spitterAuthoredV2,
  spore_bomber: bomberAuthoredV2,
  guardian: guardianAuthoredV2,
};

export { drawAuthoredFrame, authoredStateLengthMs, authoredStateIsLoop } from './draw.js';
export type { AuthoredClipId, AuthoredSpriteDef, AuthoredFrame, AuthoredState, AuthoredGrid, AuthoredFacingSet } from './types.js';
