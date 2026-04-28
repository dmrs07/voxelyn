export type SpriteArchetypeKey =
  | 'player'
  | 'stalker'
  | 'bruiser'
  | 'spitter'
  | 'guardian'
  | 'spore_bomber';

export const SPRITE_BY_ARCHETYPE: Record<SpriteArchetypeKey, string> = {
  player: 'excavator',
  stalker: 'striker',
  bruiser: 'bruiser',
  spitter: 'spitter',
  spore_bomber: 'spore_bomber',
  guardian: 'guardian',
};
