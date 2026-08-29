// COMPOSICAO E SAIDA: da radiancia linear ao PNG.
//
// Tudo aqui e aritmetica sobre os passes que o render produziu. Nenhuma etapa
// inventa materia: o bloom sai do passe EMISSIVO (e nao de um limiar de brilho
// sobre a imagem, que acenderia qualquer coisa clara), a graduacao e uma curva
// aplicada por canal, e a vinheta e uma funcao da distancia ao centro. Um humano
// faria as mesmas operacoes num compositor; a diferenca e que aqui elas estao
// escritas e sao repetiveis.
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';

const linearToSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Tonemap ACES aproximado (Narkowicz).
 *
 * Escolhido em vez de Reinhard porque o ponto mais importante da imagem e uma
 * fonte de luz ciano saturada: Reinhard leva um realce saturado direto para o
 * branco, e o cristal do nucleo — o topo da hierarquia luminosa — perderia
 * exatamente a cor que o identifica. A curva ACES segura o matiz muito mais
 * longe no ombro.
 */
const aces = (x) => {
  const a = 2.51;
  const b = 0.03;
  const c = 2.43;
  const d = 0.59;
  const e = 0.14;
  return clamp01((x * (a * x + b)) / (x * (c * x + d) + e));
};

/**
 * Desfoque gaussiano separavel por piramide: reduz pela metade, borra, e
 * acumula na volta.
 *
 * Um gaussiano direto com o raio que o bloom pede (perto de 2% da largura, ou
 * ~70 pixels em 4K) seria um nucleo de 140 amostras por pixel por eixo. A
 * piramide entrega o mesmo alcance em algumas passadas de raio pequeno, que e
 * como todo compositor faz — e o resultado tem o rabo longo e suave que uma luz
 * de verdade produz, em vez do disco duro de um borrao de raio unico.
 */
const downsample = (src, w, h) => {
  const dw = Math.max(1, w >> 1);
  const dh = Math.max(1, h >> 1);
  const out = new Float32Array(dw * dh * 3);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const x0 = Math.min(w - 1, x * 2);
      const x1 = Math.min(w - 1, x * 2 + 1);
      const y0 = Math.min(h - 1, y * 2);
      const y1 = Math.min(h - 1, y * 2 + 1);
      for (let c = 0; c < 3; c++) {
        out[(y * dw + x) * 3 + c] =
          (src[(y0 * w + x0) * 3 + c] +
            src[(y0 * w + x1) * 3 + c] +
            src[(y1 * w + x0) * 3 + c] +
            src[(y1 * w + x1) * 3 + c]) *
          0.25;
      }
    }
  }
  return { data: out, width: dw, height: dh };
};

const blurAxis = (src, w, h, horizontal) => {
  const out = new Float32Array(src.length);
  // Nucleo binomial de cinco toques: [1,4,6,4,1]/16. Separavel, simetrico e sem
  // fase — nao desloca a luz para um lado, que e o defeito de um nucleo de
  // tamanho par.
  const k = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = -2; i <= 2; i++) {
        const sx = horizontal ? Math.min(w - 1, Math.max(0, x + i)) : x;
        const sy = horizontal ? y : Math.min(h - 1, Math.max(0, y + i));
        const si = (sy * w + sx) * 3;
        const kk = k[i + 2];
        r += src[si] * kk;
        g += src[si + 1] * kk;
        b += src[si + 2] * kk;
      }
      const di = (y * w + x) * 3;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
    }
  }
  return out;
};

/** Bloom construido a partir do passe emissivo. */
export const buildBloom = (emissive, width, height, iterations) => {
  const accum = new Float32Array(width * height * 3);
  let level = { data: emissive, width, height };
  for (let i = 0; i < iterations; i++) {
    // Um nivel de um pixel nao tem o que borrar, e continuar reduzindo so
    // repetiria o mesmo pixel nas iteracoes restantes. A imagem de 4K nunca
    // chega la em cinco passadas (2160 -> 1080 -> 540 -> 270 -> 135 -> 67), mas
    // o comando aceita qualquer resolucao, e uma miniatura chega: 36 -> 18 -> 9
    // -> 4 -> 2 -> 1.
    if (level.width <= 1 && level.height <= 1) break;
    level = downsample(level.data, level.width, level.height);
    let blurred = blurAxis(level.data, level.width, level.height, true);
    blurred = blurAxis(blurred, level.width, level.height, false);
    level = { data: blurred, width: level.width, height: level.height };
    // Niveis mais grossos pesam menos: o halo perto da fonte tem de ser mais
    // forte que o veu que ele espalha pela sala inteira.
    upsampleAddFull(accum, width, height, level.data, level.width, level.height, 1 / (i + 1.6));
  }
  return accum;
};

/**
 * Amostragem do nivel grosso para a resolucao cheia, com filtragem bilinear.
 *
 * As coordenadas sao presas em ZERO por baixo, alem do teto por cima. O teto
 * sozinho nao basta e a falha era silenciosa e total: com uma dimensao de um
 * pixel, `sh - 1.001` vale -0,001, o indice truncado vira -1, a leitura devolve
 * `undefined`, e o NaN atravessa o bloom e o compositor inteiro — o PNG final
 * sai preto. So acontecia em resolucoes pequenas o bastante para a piramide
 * chegar a um pixel, entao nenhuma das entregas o exibia.
 */
const upsampleAddFull = (target, tw, th, src, sw, sh, weight) => {
  const fx = sw / tw;
  const fy = sh / th;
  for (let y = 0; y < th; y++) {
    const gy = Math.max(0, Math.min(sh - 1.001, y * fy));
    const y0 = Math.floor(gy);
    const y1 = Math.min(sh - 1, y0 + 1);
    const ty = gy - y0;
    for (let x = 0; x < tw; x++) {
      const gx = Math.max(0, Math.min(sw - 1.001, x * fx));
      const x0 = Math.floor(gx);
      const x1 = Math.min(sw - 1, x0 + 1);
      const tx = gx - x0;
      const i00 = (y0 * sw + x0) * 3;
      const i10 = (y0 * sw + x1) * 3;
      const i01 = (y1 * sw + x0) * 3;
      const i11 = (y1 * sw + x1) * 3;
      const ti = (y * tw + x) * 3;
      for (let c = 0; c < 3; c++) {
        const a = src[i00 + c] * (1 - tx) + src[i10 + c] * tx;
        const b = src[i01 + c] * (1 - tx) + src[i11 + c] * tx;
        target[ti + c] += (a * (1 - ty) + b * ty) * weight;
      }
    }
  }
};

/**
 * Beauty linear + bloom -> RGBA de 8 bits, com exposicao, tonemap, graduacao e
 * vinheta.
 *
 * A ordem importa e e a de um compositor: bloom ANTES do tonemap (uma luz
 * espalha energia, e energia se soma em linear), graduacao DEPOIS do tonemap
 * (matiz e contraste sao decisoes sobre a imagem exibida), vinheta por ultimo.
 */
export const compose = (buffers, post, options = {}) => {
  const { width, height, beauty } = buffers;
  const out = new Uint8Array(width * height * 4);
  const bloom = options.skipBloom
    ? null
    : buildBloom(buffers.emissive, width, height, post.bloom.iterations);
  const g = post.grade;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);

  for (let i = 0; i < width * height; i++) {
    const p = i * 3;
    let r = beauty[p];
    let gg = beauty[p + 1];
    let b = beauty[p + 2];
    if (bloom) {
      r += bloom[p] * post.bloom.strength;
      gg += bloom[p + 1] * post.bloom.strength;
      b += bloom[p + 2] * post.bloom.strength;
    }
    r *= post.exposure;
    gg *= post.exposure;
    b *= post.exposure;

    r = aces(r);
    gg = aces(gg);
    b = aces(b);

    // Graduacao dividida por faixa: as sombras esfriam, os meios-tons esquentam
    // de leve. E o contraste de TEMPERATURA que separa a rocha da luz do nucleo
    // sem recorrer ao teal-and-orange chapado sobre a imagem inteira.
    const luma = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const shadowW = Math.max(0, 1 - luma * 2.2);
    const midW = 1 - shadowW;
    r *= g.shadowTint[0] * shadowW + g.midTint[0] * midW;
    gg *= g.shadowTint[1] * shadowW + g.midTint[1] * midW;
    b *= g.shadowTint[2] * shadowW + g.midTint[2] * midW;

    // Elevacao do preto: o briefing proibe pretos completamente esmagados, e uma
    // caverna sem nenhuma luz ainda tem o azul frio do ar em suspensao.
    r = g.lift + r * (1 - g.lift);
    gg = g.lift + gg * (1 - g.lift);
    b = g.lift + b * (1 - g.lift);

    const l2 = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    r = l2 + (r - l2) * g.saturation;
    gg = l2 + (gg - l2) * g.saturation;
    b = l2 + (b - l2) * g.saturation;

    r = (r - 0.5) * g.contrast + 0.5;
    gg = (gg - 0.5) * g.contrast + 0.5;
    b = (b - 0.5) * g.contrast + 0.5;

    if (post.vignette > 0) {
      const x = i % width;
      const y = (i / width) | 0;
      const d = Math.hypot(x - cx, y - cy) / maxR;
      const v = 1 - post.vignette * d * d;
      r *= v;
      gg *= v;
      b *= v;
    }

    const o = i * 4;
    out[o] = Math.round(clamp01(r) * 255);
    out[o + 1] = Math.round(clamp01(gg) * 255);
    out[o + 2] = Math.round(clamp01(b) * 255);
    out[o + 3] = 255;
  }
  return out;
};

/** Escreve RGBA de 8 bits como PNG. Mesmo caminho de `tools/generate.mjs`. */
export const writePng = (path, rgba, width, height) => {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  writeFileSync(path, PNG.sync.write(png, { colorType: 6, inputColorType: 6 }));
};

/** Passe de canal unico normalizado para cinza visivel (depth, AO, sombra). */
export const grayPass = (data, width, height, transform) => {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const v = Math.round(clamp01(transform(data[i])) * 255);
    const o = i * 4;
    out[o] = v;
    out[o + 1] = v;
    out[o + 2] = v;
    out[o + 3] = 255;
  }
  return out;
};

/** Passe de tres canais linear -> sRGB, sem tonemap (albedo, emissivo). */
export const colorPass = (data, width, height, scale = 1) => {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 3;
    const o = i * 4;
    out[o] = Math.round(clamp01(linearToSrgb(data[p] * scale)) * 255);
    out[o + 1] = Math.round(clamp01(linearToSrgb(data[p + 1] * scale)) * 255);
    out[o + 2] = Math.round(clamp01(linearToSrgb(data[p + 2] * scale)) * 255);
    out[o + 3] = 255;
  }
  return out;
};

/** Normais [-1,1] -> RGB, a convencao de mapa de normais. */
export const normalPass = (data, width, height) => {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * 3;
    const o = i * 4;
    out[o] = Math.round(clamp01(data[p] * 0.5 + 0.5) * 255);
    out[o + 1] = Math.round(clamp01(data[p + 1] * 0.5 + 0.5) * 255);
    out[o + 2] = Math.round(clamp01(data[p + 2] * 0.5 + 0.5) * 255);
    out[o + 3] = 255;
  }
  return out;
};

/**
 * Segmentacao: uma cor estavel por id de objeto.
 *
 * As cores sao fixas e escolhidas para serem distinguiveis a olho, e nao
 * sorteadas por hash: quem abre o passe precisa reconhecer o Guardiao do
 * Prospector sem consultar uma legenda, e um hash mudaria a cor a cada id novo.
 */
export const OBJECT_COLORS = [
  [0, 0, 0],
  [64, 64, 72],
  [110, 96, 84],
  [56, 200, 220],
  [90, 255, 200],
  [255, 120, 60],
  [255, 230, 120],
  [180, 120, 255],
  [30, 34, 44],
];

export const objectPass = (data, width, height) => {
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const c = OBJECT_COLORS[data[i]] ?? [255, 0, 255];
    const o = i * 4;
    out[o] = c[0];
    out[o + 1] = c[1];
    out[o + 2] = c[2];
    out[o + 3] = 255;
  }
  return out;
};
