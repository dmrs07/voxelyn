/**
 * Minimal Unity .meta parser (v0.1).
 * Supports TextureImporter.spriteSheet.sprites with name, rect, pivot, border.
 */

export type UnityRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type UnityPivot = {
  x: number;
  y: number;
};

export type UnityBorder = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type UnitySprite = {
  name: string;
  rect: UnityRect;
  pivot: UnityPivot;
  border: UnityBorder;
};

export type UnitySpriteSheet = {
  sprites: UnitySprite[];
};

const parseNumber = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function parseUnityMeta(text: string): UnitySpriteSheet {
  const lines = text.split(/\r?\n/);
  const sprites: UnitySprite[] = [];

  let inTextureImporter = false;
  let textureIndent = 0;
  let inSpriteSheet = false;
  let spriteSheetIndent = 0;
  let inSprites = false;
  let spritesIndent = 0;
  let current: UnitySprite | null = null;
  let section: 'rect' | 'pivot' | 'border' | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    if (trimmed === 'TextureImporter:') {
      inTextureImporter = true;
      textureIndent = indent;
      inSpriteSheet = false;
      inSprites = false;
      continue;
    }

    if (inTextureImporter && indent <= textureIndent && trimmed !== 'TextureImporter:') {
      inTextureImporter = false;
      inSpriteSheet = false;
      inSprites = false;
    }

    if (inTextureImporter && trimmed === 'spriteSheet:') {
      inSpriteSheet = true;
      spriteSheetIndent = indent;
      inSprites = false;
      continue;
    }

    if (inSpriteSheet && indent <= spriteSheetIndent && trimmed !== 'spriteSheet:') {
      inSpriteSheet = false;
      inSprites = false;
    }

    if (inSpriteSheet && trimmed === 'sprites:') {
      inSprites = true;
      spritesIndent = indent;
      continue;
    }

    if (!inSprites) continue;

    if (indent < spritesIndent) {
      inSprites = false;
      section = null;
      current = null;
      continue;
    }

    const itemMatch = trimmed.match(/^-\s*name:\s*(.+)$/);
    if (itemMatch) {
      if (current) sprites.push(current);
      current = {
        name: itemMatch[1] ?? '',
        rect: { x: 0, y: 0, width: 0, height: 0 },
        pivot: { x: 0, y: 0 },
        border: { x: 0, y: 0, z: 0, w: 0 }
      };
      section = null;
      continue;
    }

    if (!current) continue;

    const keyMatch = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) continue;
    const key = keyMatch[1] ?? '';
    const value = keyMatch[2];

    if (key === 'rect' || key === 'pivot' || key === 'border') {
      section = key as 'rect' | 'pivot' | 'border';
      continue;
    }

    if (section === 'rect') {
      if (key === 'x' || key === 'y' || key === 'width' || key === 'height') {
        current.rect[key] = parseNumber(value);
      }
      continue;
    }

    if (section === 'pivot') {
      if (key === 'x' || key === 'y') {
        current.pivot[key] = parseNumber(value);
      }
      continue;
    }

    if (section === 'border') {
      if (key === 'x' || key === 'y' || key === 'z' || key === 'w') {
        current.border[key] = parseNumber(value);
      }
      continue;
    }

    if (key === 'name' && value) {
      current.name = value;
    }
  }

  if (current) sprites.push(current);

  return { sprites };
}
