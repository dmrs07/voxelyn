const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rockLight: '#46566e',
  rust: '#6e4a33',
  bone: '#b8a98f',
  fungusDark: '#1f3d33',
  fungus: '#2f6b4f',
  fungusLight: '#66c28a',
  biolum: '#59f2c2',
  acid: '#a8e63c',
  fire: '#ff7a2f',
  blood: '#d93b4c',
  electric: '#7ab8ff',
  player: '#e8f1ff',
};

type VoxelEntityOptions = {
  sx: number;
  sy: number;
  z: number;
  radius: number;
  brightness: number;
  archetype: string;
  elite: boolean;
  nowMs: number;
  allyTint?: boolean;
};

const shade = (hex: string, factor: number): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const g = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `rgb(${r},${g},${b})`;
};

/** Isometric cuboid with the Art Bible's top-left key light. */
const block = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  depth: number,
  height: number,
  color: string,
  light: number
): void => {
  const hw = width / 2;
  const hd = depth / 2;
  const topY = baseY - height;

  ctx.strokeStyle = shade(color, Math.max(0.18, light * 0.28));
  ctx.lineWidth = Math.max(1, width * 0.035);
  ctx.lineJoin = 'miter';

  // Left face: receives more of the global top-left key light.
  ctx.fillStyle = shade(color, light * 0.78);
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x, baseY + hd);
  ctx.lineTo(x - hw, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right face.
  ctx.fillStyle = shade(color, light * 0.55);
  ctx.beginPath();
  ctx.moveTo(x + hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x, baseY + hd);
  ctx.lineTo(x + hw, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top face.
  ctx.fillStyle = shade(color, light);
  ctx.beginPath();
  ctx.moveTo(x, topY - hd);
  ctx.lineTo(x + hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x - hw, topY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const emissive = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.max(2, Math.round(size)), Math.max(2, Math.round(size)));
};

const limb = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  light: number
): void => block(ctx, x, y, width, width * 0.55, height, color, light);

/**
 * Art-bible-aligned fallback for entities without a loaded atlas frame. It uses
 * pixel-snapped isometric blocks, a restricted palette, selective dark outlines
 * and unique silhouettes instead of the previous flat ellipse.
 */
export const drawVoxelEntity = (ctx: CanvasRenderingContext2D, options: VoxelEntityOptions): void => {
  const { sx, sy, z, radius, brightness, archetype, elite, nowMs, allyTint } = options;
  const size = radius * 32 * 0.9 * z;
  const light = Math.max(0.35, Math.min(1.15, 0.5 + brightness * 0.7));
  const bob = Math.round(Math.sin(nowMs * 0.006 + sx * 0.01) * Math.max(1, z * 0.6));
  const baseY = Math.round(sy - bob);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  switch (archetype) {
    case 'prospector': {
      const accent = allyTint ? PAL.biolum : PAL.player;
      limb(ctx, sx - size * 0.24, baseY, size * 0.24, size * 0.55, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.16, baseY, size * 0.24, size * 0.55, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.42, size * 0.92, size * 0.5, size * 0.86, PAL.rock, light);
      block(ctx, sx - size * 0.42, baseY - size * 0.65, size * 0.28, size * 0.24, size * 0.55, PAL.fungusDark, light);
      block(ctx, sx, baseY - size * 1.28, size * 0.72, size * 0.45, size * 0.48, PAL.rockLight, light);
      emissive(ctx, sx + size * 0.24, baseY - size * 1.54, size * 0.16, accent);
      block(ctx, sx + size * 0.52, baseY - size * 0.66, size * 0.55, size * 0.18, size * 0.18, PAL.rockShadow, light);
      break;
    }

    case 'stalker': {
      for (const side of [-1, 1]) {
        for (const lane of [-0.55, 0, 0.55]) {
          limb(ctx, sx + side * size * (0.45 + Math.abs(lane) * 0.15), baseY - size * (0.08 + lane * 0.12), size * 0.16, size * 0.32, PAL.rockShadow, light);
        }
      }
      block(ctx, sx, baseY - size * 0.28, size * 1.25, size * 0.62, size * 0.52, PAL.rock, light);
      block(ctx, sx + size * 0.52, baseY - size * 0.38, size * 0.46, size * 0.35, size * 0.32, PAL.rockLight, light);
      emissive(ctx, sx + size * 0.65, baseY - size * 0.62, size * 0.12, PAL.acid);
      emissive(ctx, sx + size * 0.49, baseY - size * 0.57, size * 0.1, PAL.acid);
      break;
    }

    case 'spitter': {
      for (const side of [-1, 1]) limb(ctx, sx + side * size * 0.34, baseY, size * 0.22, size * 0.32, PAL.fungusDark, light);
      block(ctx, sx, baseY - size * 0.18, size * 1.08, size * 0.7, size * 0.95, PAL.fungusDark, light);
      block(ctx, sx - size * 0.08, baseY - size * 0.83, size * 0.82, size * 0.54, size * 0.58, PAL.acid, light);
      block(ctx, sx + size * 0.54, baseY - size * 0.58, size * 0.48, size * 0.22, size * 0.2, PAL.fungus, light);
      emissive(ctx, sx - size * 0.26, baseY - size * 1.12, size * 0.14, PAL.fungusLight);
      emissive(ctx, sx + size * 0.08, baseY - size * 0.95, size * 0.1, PAL.biolum);
      break;
    }

    case 'bruiser': {
      // Massive mining-beast silhouette: low head, plated shoulders and oversized fists.
      limb(ctx, sx - size * 0.3, baseY, size * 0.34, size * 0.52, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.22, baseY, size * 0.34, size * 0.52, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.45, size * 1.45, size * 0.75, size * 1.05, PAL.rust, light);
      block(ctx, sx - size * 0.78, baseY - size * 0.42, size * 0.62, size * 0.5, size * 0.72, PAL.rock, light);
      block(ctx, sx + size * 0.78, baseY - size * 0.42, size * 0.62, size * 0.5, size * 0.72, PAL.rock, light);
      block(ctx, sx + size * 0.2, baseY - size * 1.12, size * 0.7, size * 0.48, size * 0.46, PAL.rockLight, light);
      emissive(ctx, sx - size * 0.15, baseY - size * 0.92, size * 0.13, PAL.fire);
      emissive(ctx, sx + size * 0.03, baseY - size * 0.72, size * 0.1, PAL.fire);
      break;
    }

    case 'bomber': {
      // Spore pressure vessel: thin legs frame a volatile stacked pod.
      for (const side of [-1, 1]) {
        limb(ctx, sx + side * size * 0.48, baseY, size * 0.18, size * 0.48, PAL.fungusDark, light);
        limb(ctx, sx + side * size * 0.22, baseY - size * 0.05, size * 0.15, size * 0.4, PAL.fungusDark, light);
      }
      block(ctx, sx, baseY - size * 0.3, size * 0.98, size * 0.66, size * 0.88, PAL.fungus, light);
      block(ctx, sx, baseY - size * 1.05, size * 0.78, size * 0.58, size * 0.68, PAL.rust, light);
      const pulse = 0.65 + Math.sin(nowMs * 0.012) * 0.25;
      emissive(ctx, sx - size * 0.22, baseY - size * 1.18, size * 0.2, shade(PAL.fire, pulse));
      emissive(ctx, sx + size * 0.18, baseY - size * 0.88, size * 0.16, shade(PAL.acid, pulse));
      emissive(ctx, sx + size * 0.04, baseY - size * 0.56, size * 0.12, PAL.biolum);
      break;
    }

    case 'guardian': {
      // Final-boss silhouette: ritual mining machine overtaken by the Vein.
      limb(ctx, sx - size * 0.38, baseY, size * 0.42, size * 0.72, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.28, baseY, size * 0.42, size * 0.72, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.62, size * 1.5, size * 0.86, size * 1.42, PAL.rock, light);
      block(ctx, sx - size * 0.88, baseY - size * 1.02, size * 0.55, size * 0.45, size * 1.05, PAL.rust, light);
      block(ctx, sx + size * 0.88, baseY - size * 1.02, size * 0.55, size * 0.45, size * 1.05, PAL.rust, light);
      block(ctx, sx, baseY - size * 1.95, size * 0.86, size * 0.58, size * 0.52, PAL.bone, light);
      block(ctx, sx - size * 0.42, baseY - size * 2.25, size * 0.22, size * 0.2, size * 0.6, PAL.fungusDark, light);
      block(ctx, sx + size * 0.42, baseY - size * 2.25, size * 0.22, size * 0.2, size * 0.6, PAL.fungusDark, light);
      emissive(ctx, sx, baseY - size * 1.25, size * 0.34, PAL.blood);
      emissive(ctx, sx, baseY - size * 1.25, size * 0.14, PAL.player);
      emissive(ctx, sx + size * 0.24, baseY - size * 2.04, size * 0.11, PAL.acid);
      break;
    }

    default: {
      block(ctx, sx, baseY - size * 0.35, size, size * 0.6, size * 1.1, PAL.bone, light);
      emissive(ctx, sx + size * 0.18, baseY - size * 1.05, size * 0.12, PAL.biolum);
    }
  }

  if (elite) {
    ctx.strokeStyle = PAL.fire;
    ctx.lineWidth = Math.max(1.5, z);
    ctx.setLineDash([Math.max(3, z * 2), Math.max(2, z)]);
    ctx.beginPath();
    ctx.ellipse(sx, sy - size * 0.45, size * 1.15, size * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
};
