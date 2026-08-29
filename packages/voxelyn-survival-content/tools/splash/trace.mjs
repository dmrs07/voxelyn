// O TRACADOR. Percorre a grade de voxels com um raio por pixel e devolve um
// G-buffer: material, normal exata, profundidade, oclusao e id de objeto.
//
// POR QUE UM TRACADOR, E NAO O RASTERIZADOR DO JOGO
// -------------------------------------------------
// `tools/voxel.mjs` desenha cubo a cubo na ordem do pintor. Isso funciona porque
// a projecao do jogo e fixa: a chave de profundidade `(x+y, z)` ordena
// corretamente QUALQUER conjunto de voxels naquela unica direcao de visao. Numa
// camera livre essa chave deixa de valer — dois voxels podem trocar de ordem
// conforme o angulo —, e a alternativa (ordenar milhoes de cubos por distancia a
// cada quadro) e mais cara que simplesmente perguntar, por pixel, qual voxel o
// raio encontra primeiro.
//
// O tracado tambem entrega de graca o que a iluminacao precisa e o rasterizador
// nao tem: a distancia exata ate a superficie (profundidade), a face atingida
// (normal), e um caminho pronto para lancar raios de sombra.
//
// A TRAVESSIA e a de Amanatides & Woo: caminhar de fronteira em fronteira de
// celula, sempre avancando pelo eixo cuja proxima fronteira esta mais perto.
// Nenhum passo de tamanho fixo — passo fixo com um cubo de um voxel ou perde
// paredes finas (passo grande) ou gasta o orcamento em nada (passo pequeno).
//
// O PULO DE BRICOS existe porque a cena e majoritariamente ar. Uma area com
// paredes de sete unidades de altura enche menos de um decimo do volume
// enquadrado; sem pular, a maioria dos raios gastaria centenas de passos
// atravessando vazio antes do primeiro contato. A grade grossa de 8x8x8 responde
// "ha alguma coisa neste bloco?" e o raio salta o bloco inteiro quando nao ha.

/** Faces, na mesma ordem dos eixos: 0 = x, 1 = y, 2 = z. Sinal separado. */
export const AXIS_X = 0;
export const AXIS_Y = 1;
export const AXIS_Z = 2;

/**
 * Resultado de um tracado. Objeto reutilizado entre pixels — alocar um por raio
 * poria dezenas de milhoes de objetos no coletor de lixo, e o custo disso supera
 * o do proprio tracado.
 */
export const createHit = () => ({
  hit: false,
  mat: 0,
  obj: 0,
  /** Distancia percorrida ate a face, na unidade da grade (voxel fino). */
  t: 0,
  /** Celula atingida. */
  x: 0,
  y: 0,
  z: 0,
  /** Eixo da face atingida e sinal da normal (-1 ou +1). */
  axis: 0,
  sign: 0,
});

/**
 * Recorta o raio contra a caixa da cena e devolve o t de entrada, ou -1 se o
 * raio nao passa por ela.
 *
 * Sem isto, um raio que sai da camera apontando para o ceu percorreria o
 * orcamento inteiro de passos antes de desistir. Com isto, ele descobre em uma
 * conta que nunca entra na caixa.
 */
export const clipToBounds = (scene, ox, oy, oz, dx, dy, dz) => {
  let tMin = 0;
  let tMax = Infinity;
  const lo = [0, 0, 0];
  const hi = [scene.width, scene.height, scene.depth];
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return -1;
      continue;
    }
    const inv = 1 / d[a];
    let t0 = (lo[a] - o[a]) * inv;
    let t1 = (hi[a] - o[a]) * inv;
    if (t0 > t1) {
      const tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin > tMax) return -1;
  }
  return tMin;
};

/**
 * Lanca um raio e preenche `out` com o primeiro voxel solido encontrado.
 *
 * `maxT` limita o alcance. Para o raio primario ele e a diagonal da cena; para
 * um raio de sombra, uma fracao dela — sombra de contato a poucos voxels custa
 * pouco e entrega quase toda a informacao de volume, enquanto sombra projetada a
 * quinhentos voxels custa o mesmo que um segundo quadro inteiro.
 */
export const trace = (scene, ox, oy, oz, dx, dy, dz, maxT, out) => {
  out.hit = false;
  const entry = clipToBounds(scene, ox, oy, oz, dx, dy, dz);
  if (entry < 0 || entry > maxT) return out;

  // Um epsilon depois da fronteira: exatamente EM cima dela, o arredondamento
  // decide de que lado a celula esta, e o raio pode nascer fora da grade.
  let t = entry + 1e-4;
  let x = Math.floor(ox + dx * t);
  let y = Math.floor(oy + dy * t);
  let z = Math.floor(oz + dz * t);
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (z < 0) z = 0;
  if (x >= scene.width) x = scene.width - 1;
  if (y >= scene.height) y = scene.height - 1;
  if (z >= scene.depth) z = scene.depth - 1;

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const invX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const invY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const invZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;

  // Distancia ate a proxima fronteira em cada eixo.
  let tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 - (ox + dx * t) : ox + dx * t - x) * invX) + t : Infinity;
  let tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 - (oy + dy * t) : oy + dy * t - y) * invY) + t : Infinity;
  let tMaxZ = dz !== 0 ? ((dz > 0 ? z + 1 - (oz + dz * t) : oz + dz * t - z) * invZ) + t : Infinity;

  const { width, height, depth, mat, obj, brick, bw, bh, bd } = scene;
  let axis = AXIS_Z;
  let sign = -stepZ;

  while (t <= maxT) {
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) break;

    // Pulo de brico: se o bloco de 8x8x8 que contem esta celula esta vazio,
    // avanca direto para a saida dele em vez de andar celula a celula.
    if (brick[((z >> 3) * bh + (y >> 3)) * bw + (x >> 3)] === 0) {
      const bx = z >= 0 ? x >> 3 : 0;
      const by = y >> 3;
      const bz = z >> 3;
      // Fronteira de saida do brico em cada eixo, na mesma forma do DDA fino.
      const px = ox + dx * t;
      const py = oy + dy * t;
      const pz = oz + dz * t;
      const nx = dx > 0 ? (bx + 1) * 8 : bx * 8;
      const ny = dy > 0 ? (by + 1) * 8 : by * 8;
      const nz = dz > 0 ? (bz + 1) * 8 : bz * 8;
      const bt = Math.min(
        dx !== 0 ? (nx - px) / dx : Infinity,
        dy !== 0 ? (ny - py) / dy : Infinity,
        dz !== 0 ? (nz - pz) / dz : Infinity
      );
      t += Math.max(bt, 1e-3) + 1e-4;
      if (t > maxT) break;
      x = Math.floor(ox + dx * t);
      y = Math.floor(oy + dy * t);
      z = Math.floor(oz + dz * t);
      if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) break;
      // Refaz as fronteiras finas a partir da nova posicao. Reaproveitar as
      // antigas seria mais barato e daria errado: elas foram medidas para uma
      // celula que o salto deixou para tras.
      const qx = ox + dx * t;
      const qy = oy + dy * t;
      const qz = oz + dz * t;
      tMaxX = dx !== 0 ? ((dx > 0 ? x + 1 - qx : qx - x) * invX) + t : Infinity;
      tMaxY = dy !== 0 ? ((dy > 0 ? y + 1 - qy : qy - y) * invY) + t : Infinity;
      tMaxZ = dz !== 0 ? ((dz > 0 ? z + 1 - qz : qz - z) * invZ) + t : Infinity;
      continue;
    }

    const i = (z * height + y) * width + x;
    const m = mat[i];
    if (m !== 0) {
      out.hit = true;
      out.mat = m;
      out.obj = obj[i];
      out.t = t;
      out.x = x;
      out.y = y;
      out.z = z;
      out.axis = axis;
      out.sign = sign;
      return out;
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        t = tMaxX;
        x += stepX;
        tMaxX += invX;
        axis = AXIS_X;
        sign = -stepX;
      } else {
        t = tMaxZ;
        z += stepZ;
        tMaxZ += invZ;
        axis = AXIS_Z;
        sign = -stepZ;
      }
    } else if (tMaxY < tMaxZ) {
      t = tMaxY;
      y += stepY;
      tMaxY += invY;
      axis = AXIS_Y;
      sign = -stepY;
    } else {
      t = tMaxZ;
      z += stepZ;
      tMaxZ += invZ;
      axis = AXIS_Z;
      sign = -stepZ;
    }
  }
  return out;
};

/**
 * Ha materia entre um ponto e uma luz? Versao enxuta de `trace` que so responde
 * sim ou nao — nao preenche G-buffer, nao guarda material, e para no primeiro
 * contato.
 *
 * Vale a duplicacao: o raio de sombra e lancado uma vez por pixel por luz, e
 * carregar os oito campos do resultado por nada e trabalho que aparece no
 * relogio quando sao dezenas de milhoes de raios.
 */
export const occluded = (scene, ox, oy, oz, dx, dy, dz, maxT) => {
  let t = 1e-3;
  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);
  const { width, height, depth, mat, brick, bw, bh } = scene;
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return false;

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const invX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const invY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const invZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? (dx > 0 ? x + 1 - ox : ox - x) * invX : Infinity;
  let tMaxY = dy !== 0 ? (dy > 0 ? y + 1 - oy : oy - y) * invY : Infinity;
  let tMaxZ = dz !== 0 ? (dz > 0 ? z + 1 - oz : oz - z) * invZ : Infinity;

  while (t <= maxT) {
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) { t = tMaxX; x += stepX; tMaxX += invX; }
      else { t = tMaxZ; z += stepZ; tMaxZ += invZ; }
    } else if (tMaxY < tMaxZ) { t = tMaxY; y += stepY; tMaxY += invY; }
    else { t = tMaxZ; z += stepZ; tMaxZ += invZ; }
    if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) return false;
    if (brick[((z >> 3) * bh + (y >> 3)) * bw + (x >> 3)] === 0) continue;
    if (mat[(z * height + y) * width + x] !== 0) return true;
  }
  return false;
};
