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
