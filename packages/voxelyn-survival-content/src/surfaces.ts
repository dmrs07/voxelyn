// Contrato de runtime do atlas de crostas de chao.
//
// Difere do atlas de blocos num eixo so, mas o eixo muda o layout inteiro: a
// superficie ANIMA, e cada tipo anima num numero de quadros diferente. Fogo
// precisa de quatro para lamber; rocha nua nao precisa de nenhum. Um numero
// unico de quadros para todos os tipos multiplicaria por quatro o atlas inteiro
// para atender ao unico tipo que se mexe rapido — daí a contagem por tipo, e daí
// os deslocamentos calculados em vez de uma multiplicacao simples de indices.
export type SurfaceKind = {
  name: string;
  /** Quadros assados da animacao do tipo (1 = estatico). */
  frames: number;
  /** Duracao de cada quadro em ms; 0 para tipo estatico. */
  frameMs: number;
};

export type SurfaceManifest = {
  id: string;
  version: number;
  atlas: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** Pixel do frame onde cai a origem do modelo (voxel 0,0,0). */
  originX: number;
  originY: number;
  kinds: SurfaceKind[];
  variants: number;
  lightLevels: number;
  paletteColors: string[];
};

export type SurfaceRect = { sx: number; sy: number; sw: number; sh: number };

/**
 * Indice do primeiro frame de cada tipo.
 *
 * Calculado uma vez e passado adiante, nao recalculado por celula: o chao chama
 * `resolveSurface` uma vez por tile visivel por frame — na casa dos milhares —
 * e um laco sobre os tipos ali dentro seria trabalho refeito a cada um deles.
 */
export const surfaceOffsets = (manifest: SurfaceManifest): number[] => {
  const offsets: number[] = [];
  let acc = 0;
  for (const kind of manifest.kinds) {
    offsets.push(acc);
    acc += kind.frames * manifest.variants * manifest.lightLevels;
  }
  return offsets;
};

/** Total de frames do atlas, para dimensionar a imagem e conferir o manifest. */
export const surfaceFrameCount = (manifest: SurfaceManifest): number =>
  manifest.kinds.reduce((sum, k) => sum + k.frames * manifest.variants * manifest.lightLevels, 0);

/**
 * Recorte do frame para um tipo, variante, quadro de animacao e nivel de luz.
 *
 * Todo argumento e preso a faixa valida em vez de confiar no chamador: um indice
 * fora do atlas nao daria erro, daria um `drawImage` de uma regiao vizinha — o
 * chao apareceria com a cara de outro material, que e pior do que falhar de
 * forma obvia.
 */
export const resolveSurface = (
  manifest: SurfaceManifest,
  offsets: readonly number[],
  kindIndex: number,
  variant: number,
  frame: number,
  light: number
): SurfaceRect => {
  const k = Math.max(0, Math.min(manifest.kinds.length - 1, kindIndex | 0));
  const kind = manifest.kinds[k];
  const v = ((variant % manifest.variants) + manifest.variants) % manifest.variants;
  const f = ((frame % kind.frames) + kind.frames) % kind.frames;
  const l = Math.max(0, Math.min(manifest.lightLevels - 1, Math.round(light)));
  const index = offsets[k] + (v * kind.frames + f) * manifest.lightLevels + l;
  return {
    sx: (index % manifest.columns) * manifest.frameWidth,
    sy: Math.floor(index / manifest.columns) * manifest.frameHeight,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
  };
};

/**
 * Quadro de animacao de uma celula agora.
 *
 * A defasagem por posicao e o ponto: sem ela, um lago inteiro de biofluido
 * ondula em unissono e le como uma textura piscando, nao como liquido. Com ela,
 * a onda atravessa a poca. E a fase vem da POSICAO, nunca de um sorteio, senao a
 * mesma celula mudaria de fase ao sair e voltar da tela.
 */
export const surfaceFrameAt = (
  manifest: SurfaceManifest,
  kindIndex: number,
  x: number,
  y: number,
  nowMs: number
): number => {
  const k = Math.max(0, Math.min(manifest.kinds.length - 1, kindIndex | 0));
  const kind = manifest.kinds[k];
  if (kind.frames <= 1 || kind.frameMs <= 0) return 0;
  let h = Math.imul(x | 0, 92837111) ^ Math.imul(y | 0, 689287499);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const phase = ((h ^ (h >>> 16)) >>> 0) % kind.frames;
  return (Math.floor(nowMs / kind.frameMs) + phase) % kind.frames;
};
