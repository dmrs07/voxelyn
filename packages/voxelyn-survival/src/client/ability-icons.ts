import type { AbilityId } from '@voxelyn/survival-sim';

/** A single 32-unit drawing feeds cards, world markers and both control HUDs. */
export const ABILITY_ICON_PATHS: Record<AbilityId, string> = {
  pulse: 'M13 13H19V19H13Z M8 8L5 11V21L8 24 M24 8L27 11V21L24 24 M11 4H21 M11 28H21',
  flamethrower:
    'M5 19L10 14L13 17L8 22Z M13 15L16 7L19 11L24 4L23 13L28 12L25 22L18 27L12 24 M16 22L20 16L20 22',
  seeker:
    'M12 13H20V21H12Z M16 21V27L20 23 M12 13L7 8 M20 13L25 8 M12 20L7 24 M20 20L25 24 M3 6H11V10H3Z M21 6H29V10H21Z M3 22H11V26H3Z M21 22H29V26H21Z',
  arc: 'M2 4H8V10H2Z M24 3H30V9H24Z M23 23H29V29H23Z M8 7L16 11L13 16L24 6 M16 14L20 19L17 23L23 26',
  seismic: 'M3 24H10L13 17L17 28L21 21H29 M5 18L10 13 M27 18L22 13 M12 7H20V13H12Z M16 2V5',
  slipstream: 'M2 9H10 M1 16H7 M3 23H11 M15 6L25 16L15 26 M22 6L31 16L22 26 M11 11L16 16L11 21',
  vent: 'M9 11H23V23H9Z M12 15H20 M12 19H20 M16 3V8 M12 6L16 2L20 6 M4 14L1 17L4 20 M28 14L31 17L28 20 M13 26V30 M19 26V30',
};

export const abilityIconSvg = (id: AbilityId): string =>
  `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="square" aria-hidden="true"><path d="${ABILITY_ICON_PATHS[id]}"/></svg>`;

const paths = new Map<AbilityId, Path2D>();
export const drawAbilityGlyph = (
  ctx: CanvasRenderingContext2D,
  id: AbilityId,
  x: number,
  y: number,
  size: number,
  color: string,
): boolean => {
  if (typeof Path2D === 'undefined') return false;
  let path = paths.get(id);
  if (!path) {
    path = new Path2D(ABILITY_ICON_PATHS[id]);
    paths.set(id, path);
  }
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 32, size / 32);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.stroke(path);
  ctx.restore();
  return true;
};
