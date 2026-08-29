// A CAMERA CINEMATOGRAFICA. Pinhole em perspectiva de verdade — nao a projecao
// isometrica fixa do jogo.
//
// POR QUE UMA CAMERA NOVA, E NAO A DO JOGO
// ----------------------------------------
// Voxelyn Survival desenha em isometria 2:1 dimetrica com camera fixa: um voxel
// tem sempre 4 pixels de largura, esteja ele encostado na tela ou no fim do
// corredor. E a escolha certa para um jogo em que ler a grade e jogar, e a
// errada para uma key art, onde a distancia precisa MEDIR alguma coisa: o
// Prospector no primeiro plano tem de dominar o quadro e o berco ao fundo tem de
// ceder tamanho, senao a imagem vira um diagrama.
//
// Entao a projecao muda e a MATERIA nao. Os modelos, a paleta, as rampas de
// face, o terreno e o worldgen continuam sendo exatamente os do jogo; o que esta
// camera faz de diferente e apenas onde cada voxel cai na tela.
//
// CONVENCAO DE EIXOS: x = leste, y = sul, z = cima — a mesma de `box()` nos
// modelos do jogo. A unidade e o VOXEL FINO; quem raciocina em tiles multiplica
// por VOXELS_PER_TILE.
import { VOXELS_PER_TILE } from './geometry.mjs';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const scale = (v, k) => [v[0] * k, v[1] * k, v[2] * k];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Converte uma posicao em TILES do mundo (com altura em tiles) para o espaco de
 * voxels finos da janela. Camera e alvo sao pensados em tiles porque e assim que
 * a geografia foi lida no mapa; a conversao mora num lugar so.
 */
export const tileToVoxel = (win, x, y, z) => [
  (x - win.x0) * VOXELS_PER_TILE,
  (y - win.y0) * VOXELS_PER_TILE,
  z * VOXELS_PER_TILE,
];

/**
 * Monta a base da camera e os vetores de varredura por pixel.
 *
 * `fovY` e o campo de visao VERTICAL em graus. Uma lente longa (valor baixo)
 * achata a perspectiva e aproxima a leitura isometrica do jogo; uma curta
 * exagera a profundidade e distorce as bordas — o briefing proibe grande
 * angular extremo, e a faixa util fica entre 22 e 34 graus.
 *
 * `roll` gira a camera em torno do proprio eixo optico. Fica em zero por
 * padrao: uma key art com horizonte torto le como erro, nao como intencao.
 *
 * A base e ortonormal e destra: `forward` aponta para o alvo, `right` cresce
 * para a direita da TELA e `up` para cima dela. `right` sai de
 * cross(forward, worldUp) — com worldUp = (0,0,1) e forward apontando para o sul
 * (+y), isso da right = (+1,0,0), leste, que e o que se espera de uma camera
 * olhando para o sul.
 */
export const createCamera = ({
  position,
  target,
  fovY = 27,
  roll = 0,
  width,
  height,
  near = 1,
  far = 4096,
}) => {
  const forward = norm(sub(target, position));
  const worldUp = [0, 0, 1];
  let right = norm(cross(forward, worldUp));
  let up = norm(cross(right, forward));
  if (roll !== 0) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const r = add(scale(right, c), scale(up, s));
    const u = add(scale(up, c), scale(right, -s));
    right = norm(r);
    up = norm(u);
  }
  // Meia-altura do plano de imagem a uma unidade de distancia. A largura sai
  // dela pela razao de aspecto, e nao de um fovX proprio: dois campos de visao
  // independentes sao a forma classica de esticar a imagem sem perceber.
  const halfH = Math.tan((fovY * Math.PI) / 360);
  const halfW = (halfH * width) / height;
  return { position, target, forward, right, up, halfW, halfH, width, height, near, far, fovY, roll };
};

/**
 * Direcao do raio que passa pelo centro do pixel (px, py).
 *
 * `+0.5` centraliza a amostra no pixel: sem isso a imagem inteira escorrega meio
 * pixel para cima e para a esquerda, o que a esta resolucao ninguem nota olhando
 * mas desalinha os passes auxiliares em relacao ao beauty.
 *
 * O resultado NAO e normalizado. Quem percorre a grade prefere um vetor cujo
 * maior componente vale 1 (menos divisoes no DDA), e quem precisa de distancia
 * real multiplica pelo comprimento — que sai de graca aqui.
 */
export const rayDirection = (cam, px, py, out = [0, 0, 0]) => {
  const sx = ((px + 0.5) / cam.width) * 2 - 1;
  const sy = 1 - ((py + 0.5) / cam.height) * 2;
  const dx = cam.forward[0] + cam.right[0] * sx * cam.halfW + cam.up[0] * sy * cam.halfH;
  const dy = cam.forward[1] + cam.right[1] * sx * cam.halfW + cam.up[1] * sy * cam.halfH;
  const dz = cam.forward[2] + cam.right[2] * sx * cam.halfW + cam.up[2] * sy * cam.halfH;
  const len = Math.hypot(dx, dy, dz);
  out[0] = dx / len;
  out[1] = dy / len;
  out[2] = dz / len;
  return out;
};

/**
 * Onde um ponto do mundo cai na tela, em pixels. Serve a duas coisas praticas:
 * conferir o enquadramento sem renderizar, e reservar a area do branding sabendo
 * exatamente onde estao o Prospector, o Guardiao e o berco.
 */
export const projectPoint = (cam, p) => {
  const d = sub(p, cam.position);
  const z = d[0] * cam.forward[0] + d[1] * cam.forward[1] + d[2] * cam.forward[2];
  if (z <= 0) return null;
  const x = d[0] * cam.right[0] + d[1] * cam.right[1] + d[2] * cam.right[2];
  const y = d[0] * cam.up[0] + d[1] * cam.up[1] + d[2] * cam.up[2];
  return {
    x: (x / (z * cam.halfW) + 1) * 0.5 * cam.width,
    y: (1 - y / (z * cam.halfH)) * 0.5 * cam.height,
    depth: z,
  };
};
