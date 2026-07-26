// Contrato de runtime do atlas de blocos de terreno.
export type TerrainManifest = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** Pixel do frame onde cai a origem do modelo (voxel 0,0,0). */
  originX: number;
  originY: number;
  kinds: string[];
  variants: number;
  lightLevels: number;
  paletteColors: string[];
};

export type TerrainRect = { sx: number; sy: number; sw: number; sh: number };

/**
 * Escolhe a variante de superficie de um bloco a partir da posicao no mundo.
 *
 * Tem de ser deterministico: sortear por frame faria a pedra cintilar, e sortear
 * por seed da run faria o mesmo bloco mudar de cara ao sair e voltar da tela.
 */
export const variantAt = (x: number, y: number, variants: number): number => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % variants;
};

/** Recorte do frame para um tipo, variante e nivel de luz. */
export const resolveBlock = (
  manifest: TerrainManifest,
  kindIndex: number,
  variant: number,
  light: number
): TerrainRect => {
  const kind = Math.max(0, Math.min(manifest.kinds.length - 1, kindIndex));
  const v = ((variant % manifest.variants) + manifest.variants) % manifest.variants;
  const l = Math.max(0, Math.min(manifest.lightLevels - 1, Math.round(light)));
  const index = (kind * manifest.variants + v) * manifest.lightLevels + l;
  return {
    sx: (index % manifest.columns) * manifest.frameWidth,
    sy: Math.floor(index / manifest.columns) * manifest.frameHeight,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
  };
};

/** Converte brilho continuo [0,1] no nivel assado mais proximo. */
export const lightLevelFor = (manifest: TerrainManifest, brightness: number): number =>
  Math.max(0, Math.min(manifest.lightLevels - 1, Math.round(brightness * (manifest.lightLevels - 1))));
