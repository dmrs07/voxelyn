// Contrato de runtime do atlas de objetos de mundo.
//
// Difere dos atlas de chao e de bloco por AUSENCIA: nao ha variante nem nivel de
// luz. Sao pecas unicas — existe um Nucleo e uma plataforma por run — entao
// variar por posicao nao significa nada, e escurecer com a luz do ambiente
// esconderia o objetivo justamente no canto escuro onde a geracao costuma
// coloca-lo. O eixo que sobra e o quadro de animacao, com contagem por tipo.
export type PropKind = {
  name: string;
  /** Quadros assados da animacao do tipo (1 = estatico). */
  frames: number;
  /** Duracao de cada quadro em ms; 0 para tipo estatico. */
  frameMs: number;
};

export type PropManifest = {
  id: string;
  version: number;
  atlas: string;
  /**
   * MAPA DE FACES: a normal por pixel, na mesma grade de quadros do atlas.
   *
   * Vermelho topo, verde esquerda (+y do mundo), azul direita (+x). E o que
   * permite a luz do mundo bater no lado certo de um monolito, de uma fumarola
   * ou do pedestal do Nucleo, em vez de banhar a peca inteira por igual.
   */
  normalAtlas?: string;
  /** Divisor de resolucao do mapa de faces. */
  normalScale?: number;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  /** Pixel do frame onde cai a origem do modelo (voxel 0,0,0). */
  originX: number;
  originY: number;
  kinds: PropKind[];
  paletteColors: string[];
};

export type PropRect = { sx: number; sy: number; sw: number; sh: number };

/** Indice do primeiro frame de cada tipo. */
export const propOffsets = (manifest: PropManifest): number[] => {
  const offsets: number[] = [];
  let acc = 0;
  for (const kind of manifest.kinds) {
    offsets.push(acc);
    acc += kind.frames;
  }
  return offsets;
};

export const propFrameCount = (manifest: PropManifest): number =>
  manifest.kinds.reduce((sum, k) => sum + k.frames, 0);

/** Indice de um tipo pelo nome; -1 se nao existir. */
export const propKindIndex = (manifest: PropManifest, name: string): number =>
  manifest.kinds.findIndex((k) => k.name === name);

/**
 * Recorte do frame para um tipo e quadro.
 *
 * Os argumentos sao presos a faixa valida em vez de confiar no chamador: um
 * indice fora do atlas nao daria erro, daria um `drawImage` de uma regiao
 * vizinha — o Nucleo apareceria com a cara de outra peca, que e pior do que
 * falhar de forma obvia.
 */
export const resolveProp = (
  manifest: PropManifest,
  offsets: readonly number[],
  kindIndex: number,
  frame: number
): PropRect => {
  const k = Math.max(0, Math.min(manifest.kinds.length - 1, kindIndex | 0));
  const kind = manifest.kinds[k];
  const f = ((frame % kind.frames) + kind.frames) % kind.frames;
  const index = offsets[k] + f;
  return {
    sx: (index % manifest.columns) * manifest.frameWidth,
    sy: Math.floor(index / manifest.columns) * manifest.frameHeight,
    sw: manifest.frameWidth,
    sh: manifest.frameHeight,
  };
};

/**
 * Quadro atual de um tipo.
 *
 * Sem defasagem por posicao, ao contrario do chao: ha uma peca so de cada, entao
 * nao existe unissono a quebrar — e o pulso do Nucleo deve ser o mesmo para os
 * dois jogadores de uma sala, que e o que um relogio comum garante.
 */
export const propFrameAt = (manifest: PropManifest, kindIndex: number, nowMs: number): number => {
  const k = Math.max(0, Math.min(manifest.kinds.length - 1, kindIndex | 0));
  const kind = manifest.kinds[k];
  if (kind.frames <= 1 || kind.frameMs <= 0) return 0;
  return Math.floor(Math.max(0, nowMs) / kind.frameMs) % kind.frames;
};
