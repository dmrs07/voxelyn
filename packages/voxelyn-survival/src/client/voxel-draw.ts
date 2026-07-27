// Primitivo de voxel desenhado em runtime, compartilhado por particulas e
// projeteis.
//
// Por que existe: tanto as particulas quanto os projeteis eram CHAPADOS — um
// retangulo unico e um `ctx.arc`. Num jogo cuja premissa visual e volume
// facetado, um circulo liso voando sobre blocos voxel denuncia o truque na
// hora, e sem faces sombreadas nada disso tem profundidade.
//
// Aqui cada voxel sai com as tres faces que a projecao 2:1 mostra: topo claro,
// lateral esquerda media, lateral direita escura — a mesma rampa que o
// rasterizador do atlas usa, para o que e desenhado em runtime pertencer ao
// mesmo mundo do que e pre-renderizado.
//
// Sao tres fillRect por voxel, nao paths: com centenas de particulas em tela um
// path por face custaria caro em GPU mobile, e a 4-8px de lado o retangulo le
// como cubo do mesmo jeito.

/** Rampa de faces: [topo, esquerda, direita]. */
export type FaceRamp = readonly [string, string, string];

/** Rampa exclusiva dos motes de gas. Esporo usa outra rampa e nao entra aqui. */
const GAS_RAMP: FaceRamp = ['#ffd166', '#a8e63c', '#1f3d33'];

export const isGasRamp = (ramp: FaceRamp): boolean =>
  ramp[0] === GAS_RAMP[0] && ramp[1] === GAS_RAMP[1] && ramp[2] === GAS_RAMP[2];

export type GasPuffLobe = {
  x: number;
  y: number;
  size: number;
  alpha: number;
};

/**
 * Geometria visual de um mote de gas.
 *
 * `VoxelParticles.draw` ja codifica a vida no alpha: 1 quando nasce e 0.35 perto
 * de expirar. Aqui essa vida vira forma: o nucleo abre, dois lobulos se separam
 * e a materia perde opacidade. O item continua contando como UMA particula no
 * budget; apenas a silhueta deixa de ser um cubo amarelo solitario.
 */
export const gasPuffLobes = (
  sx: number,
  sy: number,
  size: number,
  sourceAlpha: number
): GasPuffLobe[] => {
  const life = Math.max(0, Math.min(1, (sourceAlpha - 0.35) / 0.65));
  const age = 1 - life;
  const fadeIn = Math.min(1, 0.25 + age * 5);
  const puffAlpha = fadeIn * Math.pow(life, 0.72);
  const expanded = size * (0.92 + age * 1.15);

  // A orientacao vem da posicao projetada, portanto e deterministica entre
  // clientes, mas varia entre motes vizinhos para nao formar uma fileira.
  const seed = (Math.imul(Math.round(sx), 73856093) ^ Math.imul(Math.round(sy), 19349663)) >>> 0;
  const side = (seed & 1) === 0 ? -1 : 1;
  const spread = expanded * (0.18 + age * 0.34);
  const lift = expanded * (0.18 + age * 0.42);

  return [
    { x: sx, y: sy, size: expanded, alpha: puffAlpha },
    {
      x: sx + side * spread,
      y: sy - lift * 0.55,
      size: expanded * 0.72,
      alpha: puffAlpha * 0.7,
    },
    {
      x: sx - side * spread * 0.72,
      y: sy - lift,
      size: expanded * 0.54,
      alpha: puffAlpha * 0.46,
    },
  ];
};

const drawFacetedVoxel = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  ramp: FaceRamp
): void => {
  const w = Math.max(1, Math.round(size));
  const half = Math.max(1, Math.round(w / 2));
  const side = Math.max(1, Math.round(w / 2));
  const top = Math.max(1, Math.round(w / 4));
  const x = Math.round(sx - half);
  const y = Math.round(sy - side);

  ctx.fillStyle = ramp[1];
  ctx.fillRect(x, y, half, side);
  ctx.fillStyle = ramp[2];
  ctx.fillRect(x + half, y, w - half, side);
  // O topo entra por ultimo e um pouco estreito: e a face que da a leitura de
  // faceta, e precisa vencer as laterais na borda.
  ctx.fillStyle = ramp[0];
  ctx.fillRect(x, y - top, w, top);
};

/**
 * Desenha um voxel com a BASE centrada em (sx, sy).
 *
 * `size` e a largura do voxel em pixels; a proporcao 2:1 do resto do jogo da a
 * altura do topo e das laterais a partir dela.
 */
export const drawVoxel = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  ramp: FaceRamp
): void => {
  if (!isGasRamp(ramp)) {
    drawFacetedVoxel(ctx, sx, sy, size, ramp);
    return;
  }

  const sourceAlpha = ctx.globalAlpha;
  ctx.save();
  for (const lobe of gasPuffLobes(sx, sy, size, sourceAlpha)) {
    ctx.globalAlpha = sourceAlpha * lobe.alpha;
    drawFacetedVoxel(ctx, lobe.x, lobe.y, lobe.size, ramp);
  }
  ctx.restore();
};

/**
 * Sombra achatada no chao.
 *
 * E o que vende a ALTURA: sem ela, subir o projetil na tela e indistinguivel de
 * move-lo para longe, porque em projecao isometrica os dois sao o mesmo pixel.
 */
export const drawGroundShadow = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  radius: number
): void => {
  ctx.fillStyle = 'rgba(11, 14, 20, 0.45)';
  ctx.beginPath();
  ctx.ellipse(sx, sy, Math.max(1, radius), Math.max(1, radius * 0.5), 0, 0, Math.PI * 2);
  ctx.fill();
};
