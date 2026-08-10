// Paleta mestra da Art Bible e helpers determinísticos de rasterização.
//
// DEGRAUS INTERMEDIARIOS
// ----------------------
// As dezesseis cores originais tinham buracos grandes na escala de valor, e o
// rasterizador tropecava neles duas vezes: a rampa de um material saltava 35
// pontos de luminancia entre a face de topo e a lateral (o `loot` saltava 51), e
// a escada de sombra/realce so podia andar nesses mesmos passos — um voxel de
// latao em fresta caia de osso direto para ferrugem, e uma quina iluminada
// pulava de osso para branco azulado, que lia como respingo e nao como aresta.
//
// Os seis degraus abaixo existem so para fechar esses vaos. Nenhum deles
// introduz materia nova no jogo: sao os meios-tons que ja estavam implicitos
// entre cores que a paleta ja tinha, e cada um foi escolhido pela luminancia que
// faltava, nao pelo matiz.
//
// Eles servem para PREENCHER entre as ancoras de uma rampa, nunca para
// substitui-las. A primeira tentativa fez o contrario — trocou o topo e a base
// das rampas pelos meios-tons — e o resultado foi perder de 23% a 56% da
// amplitude de cada material: os personagens ficaram uniformes e sem o contraste
// facetado que e a identidade do jogo. A luminancia de cada degrau abaixo esta
// calculada para cair no MEIO da rampa que ele preenche, e nao perto de uma das
// pontas.
export const COLORS = {
  dark: [11, 14, 20],
  rockShadow: [29, 36, 48],
  rock: [46, 58, 77],
  rockLight: [70, 86, 110],
  /** Entre rockLight (33) e player (94): o cinza-azulado claro que faltava. */
  mist: [123, 139, 163],
  /** Entre dark (5) e rust (31): o marrom carbonizado. Fecha o unico vao que
   *  sobrava na familia quente — sem ele a sombra do latao caia em `rockShadow`,
   *  que e AZUL, e toda fresta de metal esfriava de matiz ao escurecer. */
  char: [61, 42, 34],
  rust: [110, 74, 51],
  /** Entre rust (31) e bone (67): o meio-tom do latao, o vao maior da paleta. */
  brass: [138, 113, 84],
  bone: [184, 169, 143],
  /** Entre bone (67) e player (94): branco quente, sem virar branco azulado. */
  chalk: [213, 205, 186],
  fungusDark: [31, 61, 51],
  fungus: [47, 107, 79],
  /** Entre fungusDark (21) e fungusLight (67). */
  moss: [63, 138, 94],
  fungusLight: [102, 194, 138],
  biolum: [89, 242, 194],
  acid: [168, 230, 60],
  fire: [255, 122, 47],
  /** Entre fire (57) e loot (83): a brasa alaranjada. EMISSIVA. */
  amber: [255, 166, 63],
  /** Acima de amber: o branco quente de uma lampada acesa. EMISSIVA. */
  beam: [255, 233, 184],
  blood: [217, 59, 76],
  electric: [122, 184, 255],
  loot: [255, 209, 102],
  player: [232, 241, 255],
};

const toHex = ([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
export const HEX = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, toHex(v)]));
export const ALLOWED_HEX = new Set(Object.values(HEX));

export const grid = (w, h) => ({ w, h, buf: new Uint8Array(w * h * 4) });

export const set = (g, x, y, name) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const c = COLORS[name];
  if (!c) throw new Error(`cor fora da paleta: ${name}`);
  const i = (y * g.w + x) * 4;
  g.buf[i] = c[0];
  g.buf[i + 1] = c[1];
  g.buf[i + 2] = c[2];
  g.buf[i + 3] = 255;
};

/**
 * Pinta um pixel com RGB CRU, fora da paleta.
 *
 * Existe para UMA coisa: o mapa de faces, que nao e arte — e um dado por pixel
 * (qual face do cubo pintou aqui) que sai como atlas companheiro. `set` recusa
 * cor fora da paleta de proposito, e essa recusa e uma boa regra que nao pode
 * ser afrouxada; a saida e uma porta separada e explicita, usada por um unico
 * chamador, em vez de tres cores falsas plantadas na paleta mestra.
 */
export const setRgb = (g, x, y, rgb) => {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  const i = (y * g.w + x) * 4;
  g.buf[i] = rgb[0];
  g.buf[i + 1] = rgb[1];
  g.buf[i + 2] = rgb[2];
  g.buf[i + 3] = 255;
};

export const clearPx = (g, x, y) => {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.buf[(y * g.w + x) * 4 + 3] = 0;
};

export const filled = (g, x, y) =>
  x >= 0 && y >= 0 && x < g.w && y < g.h && g.buf[(y * g.w + x) * 4 + 3] !== 0;

export const fillRect = (g, x0, y0, w, h, name) => {
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(g, x, y, name);
  }
};

export const fillEllipse = (g, cx, cy, rx, ry, name) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx || 1);
      const dy = (y - cy) / (ry || 1);
      if (dx * dx + dy * dy <= 1) set(g, x, y, name);
    }
  }
};

export const fillDiamond = (g, cx, cy, rx, ry, name) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (Math.abs((x - cx) / (rx || 1)) + Math.abs((y - cy) / (ry || 1)) <= 1) set(g, x, y, name);
    }
  }
};

export const line = (g, x0, y0, x1, y1, name) => {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(g, x, y, name);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
};

export const thickLine = (g, x0, y0, x1, y1, width, name) => {
  const half = Math.max(0, Math.floor(width / 2));
  for (let ox = -half; ox <= half; ox++) {
    for (let oy = -half; oy <= half; oy++) line(g, x0 + ox, y0 + oy, x1 + ox, y1 + oy, name);
  }
};

/** Volume facetado: sombra abaixo-direita, massa e highlight topo-esquerda. */
export const facetEllipse = (g, cx, cy, rx, ry, base, light, shadow) => {
  fillEllipse(g, cx + 1, cy + 1, rx, ry, shadow);
  fillEllipse(g, cx, cy, rx, ry, base);
  fillEllipse(g, cx - Math.max(1, Math.round(rx * 0.28)), cy - Math.max(1, Math.round(ry * 0.28)), Math.max(1, rx * 0.48), Math.max(1, ry * 0.38), light);
};

export const outlineWith = (g, name) => {
  const snapshot = new Uint8Array(g.w * g.h);
  for (let i = 0; i < g.w * g.h; i++) snapshot[i] = g.buf[i * 4 + 3] !== 0 ? 1 : 0;
  const has = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && snapshot[y * g.w + x] === 1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (snapshot[y * g.w + x]) continue;
      if (has(x - 1, y) || has(x + 1, y) || has(x, y - 1) || has(x, y + 1)) set(g, x, y, name);
    }
  }
};

export const colorsUsed = (g) => {
  const seen = new Set();
  for (let i = 0; i < g.w * g.h; i++) {
    if (g.buf[i * 4 + 3] === 0) continue;
    seen.add(toHex([g.buf[i * 4], g.buf[i * 4 + 1], g.buf[i * 4 + 2]]));
  }
  return seen;
};

export const isEmpty = (g) => {
  for (let i = 0; i < g.w * g.h; i++) if (g.buf[i * 4 + 3] !== 0) return false;
  return true;
};

export const boundingBox = (g) => {
  let minX = g.w, minY = g.h, maxX = -1, maxY = -1;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (!filled(g, x, y)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
};

/**
 * Normaliza o conteúdo no canvas canônico sem cortar pixels.
 *
 * O desenho procedural trabalha em coordenadas expressivas e alguns ataques,
 * fragmentos e outlines podem alcançar a borda. Para preservar os 2 px de
 * respiro definidos pela Art Bible, enquadramos a bounding box dentro da área
 * segura usando nearest-neighbor determinístico. Frames que já cabem são apenas
 * reposicionados; frames maiores são reduzidos pelo menor fator necessário.
 * O conteúdo permanece centralizado em X e alinhado à base em Y, preservando a
 * leitura dos pés em relação ao anchor e evitando jitter entre poses.
 */
export const fitToMargin = (src, margin = 2) => {
  const box = boundingBox(src);
  if (!box) return src;

  const safeWidth = src.w - margin * 2;
  const safeHeight = src.h - margin * 2;
  if (safeWidth <= 0 || safeHeight <= 0) throw new Error(`margem ${margin} inválida para ${src.w}x${src.h}`);

  const contentWidth = box.maxX - box.minX + 1;
  const contentHeight = box.maxY - box.minY + 1;
  const scale = Math.min(1, safeWidth / contentWidth, safeHeight / contentHeight);
  const targetWidth = Math.max(1, Math.floor(contentWidth * scale));
  const targetHeight = Math.max(1, Math.floor(contentHeight * scale));
  const offsetX = margin + Math.floor((safeWidth - targetWidth) / 2);
  const offsetY = src.h - margin - targetHeight;
  const out = grid(src.w, src.h);

  for (let y = 0; y < targetHeight; y++) {
    const sourceY = box.minY + Math.min(contentHeight - 1, Math.floor((y * contentHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = box.minX + Math.min(contentWidth - 1, Math.floor((x * contentWidth) / targetWidth));
      const sourceIndex = (sourceY * src.w + sourceX) * 4;
      if (src.buf[sourceIndex + 3] === 0) continue;
      const targetIndex = ((offsetY + y) * out.w + offsetX + x) * 4;
      out.buf.set(src.buf.subarray(sourceIndex, sourceIndex + 4), targetIndex);
    }
  }

  return out;
};

/**
 * Enquadra TODOS os frames de um sprite com UM unico deslocamento comum.
 *
 * Por que nao `fitToMargin` por frame: normalizar cada frame isoladamente
 * recentraliza em X e alinha a base em Y a cada quadro, ou seja, apaga
 * exatamente a informacao que a animacao carrega. Uma pose que agacha voltava
 * de imediato para a linha do chao; o corpo desabando na morte era reerguido
 * frame a frame; a lamina assimetrica do stalker, ao se estender, empurrava a
 * criatura inteira para o lado. Pior: quando uma pose passava da area segura,
 * o frame era REESCALADO em silencio e o personagem mudava de tamanho no meio
 * da animacao. A spec pede ancora estavel e ausencia de jitter — as duas coisas
 * sao impossiveis com normalizacao por frame.
 *
 * Aqui a caixa e a uniao de todos os frames, entao o deslocamento e o mesmo
 * para todos e o movimento autorado sobrevive. Se a uniao nao couber, isto
 * LANCA em vez de reescalar: um modelo grande demais e um bug a corrigir no
 * modelo, nao algo a esconder encolhendo o sprite.
 */
export const fitSpriteToMargin = (frames, margin = 2) => {
  const boxes = frames.map(boundingBox).filter(Boolean);
  if (boxes.length === 0) return frames;
  const union = boxes.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));

  const { w, h } = frames[0];
  const contentWidth = union.maxX - union.minX + 1;
  const contentHeight = union.maxY - union.minY + 1;
  if (contentWidth > w - margin * 2 || contentHeight > h - margin * 2) {
    throw new Error(
      `conteudo ${contentWidth}x${contentHeight} nao cabe em ${w}x${h} com margem ${margin}`
    );
  }

  const dx = margin + Math.floor((w - margin * 2 - contentWidth) / 2) - union.minX;
  const dy = h - margin - contentHeight - union.minY;
  if (dx === 0 && dy === 0) return frames;

  return frames.map((src) => {
    const out = grid(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * w + x) * 4;
        if (src.buf[si + 3] === 0) continue;
        const ty = y + dy;
        const tx = x + dx;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue;
        out.buf.set(src.buf.subarray(si, si + 4), (ty * w + tx) * 4);
      }
    }
    return out;
  });
};

export const blitToAtlas = (atlas, src, col, row = 0) => {
  const ox = col * src.w;
  const oy = row * src.h;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if (src.buf[si + 3] === 0) continue;
      const di = ((oy + y) * atlas.w + ox + x) * 4;
      atlas.buf.set(src.buf.subarray(si, si + 4), di);
    }
  }
};
