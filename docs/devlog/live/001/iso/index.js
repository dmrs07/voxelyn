// ../.voxelyn-devlog-work/aab5fba8b278/src/core/surface2d.ts
function createSurface2D(width, height, options = {}) {
  const size = width * height;
  const pixels = options.pixels ?? new Uint32Array(size);
  if (pixels.length < size) {
    throw new Error("pixels length is smaller than width*height");
  }
  return { width, height, pixels };
}
function fillRect(surface2, x, y, width, height, color) {
  const x0 = Math.max(0, x) | 0;
  const y0 = Math.max(0, y) | 0;
  const x1 = Math.min(surface2.width, x + width) | 0;
  const y1 = Math.min(surface2.height, y + height) | 0;
  const w = surface2.width | 0;
  const c = color >>> 0;
  for (let yy = y0; yy < y1; yy++) {
    let row = yy * w + x0;
    for (let xx = x0; xx < x1; xx++) {
      surface2.pixels[row++] = c;
    }
  }
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/core/palette.ts
function packRGBA(r, g, b, a = 255) {
  return ((a & 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | r & 255) >>> 0;
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/extras/iso/iso.ts
function projectIso(x, y, z, tileW, tileH, zStep) {
  const sx = (x - y) * (tileW >> 1);
  const sy = (x + y) * (tileH >> 1) - z * zStep;
  return { sx, sy };
}
function forEachIsoOrder(mapW, mapH, fn) {
  let order = 0;
  const max = mapW + mapH - 2;
  for (let s = 0; s <= max; s++) {
    const xStart = Math.max(0, s - (mapH - 1));
    const xEnd = Math.min(mapW - 1, s);
    for (let x = xStart; x <= xEnd; x++) {
      const y = s - x;
      fn(x, y, order++);
    }
  }
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/extras/sprites/blit.ts
function blitColorkey(dst, sprite2, dx, dy, options = {}) {
  const cw = sprite2.width | 0;
  const ch = sprite2.height | 0;
  const colorkey = (options.colorkey ?? 0) >>> 0;
  const alphaThreshold = (options.alphaThreshold ?? 0) | 0;
  let sx0 = 0;
  let sy0 = 0;
  let sx1 = cw;
  let sy1 = ch;
  if (dx < 0) sx0 = -dx;
  if (dy < 0) sy0 = -dy;
  if (dx + cw > dst.width) sx1 = dst.width - dx;
  if (dy + ch > dst.height) sy1 = dst.height - dy;
  if (sx0 >= sx1 || sy0 >= sy1) return;
  const dp = dst.pixels;
  const sp = sprite2.pixels;
  const dw = dst.width | 0;
  for (let sy = sy0; sy < sy1; sy++) {
    let di = (dy + sy) * dw + (dx + sx0);
    let si = sy * cw + sx0;
    for (let sx = sx0; sx < sx1; sx++) {
      const c = sp[si++];
      if (c !== colorkey) {
        if (alphaThreshold > 0) {
          const a = c >>> 24 & 255;
          if (a <= alphaThreshold) {
            di++;
            continue;
          }
        }
        dp[di++] = c;
      } else {
        di++;
      }
    }
  }
}

// ../.voxelyn-devlog-work/aab5fba8b278/src/adapters/canvas2d.ts
function presentToCanvas(ctx2, surface2) {
  const imageData = ctx2.getImageData(0, 0, surface2.width, surface2.height);
  const bytes = new Uint8ClampedArray(surface2.pixels.buffer);
  if (bytes.byteLength === imageData.data.byteLength) {
    imageData.data.set(bytes);
  } else {
    const min = Math.min(bytes.byteLength, imageData.data.byteLength);
    imageData.data.set(bytes.subarray(0, min));
  }
  ctx2.putImageData(imageData, 0, 0);
}

// ../.voxelyn-devlog-work/aab5fba8b278/examples/browser-iso-diablo-like/index.ts
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");
var surface = createSurface2D(canvas.width, canvas.height);
var TILE_W = 32;
var TILE_H = 16;
var makeDiamond = (w, h, color) => {
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) {
    const t = y < h / 2 ? y : h - 1 - y;
    const span = 1 + t * (w - 2) / (h / 2);
    const x0 = (w - span) / 2 | 0;
    const x1 = x0 + span;
    for (let x = x0; x < x1; x++) {
      pixels[y * w + x] = color;
    }
  }
  return pixels;
};
var grass = makeDiamond(TILE_W, TILE_H, packRGBA(50, 120, 50, 255));
var dirt = makeDiamond(TILE_W, TILE_H, packRGBA(110, 80, 40, 255));
var tilemapW = 10;
var tilemapH = 10;
var sprite = { width: 12, height: 18, pixels: new Uint32Array(12 * 18) };
var key = packRGBA(0, 0, 0, 0);
for (let y = 0; y < sprite.height; y++) {
  for (let x = 0; x < sprite.width; x++) {
    const inside = x > 2 && x < 9 && y > 2 && y < 16;
    sprite.pixels[y * sprite.width + x] = inside ? packRGBA(200, 40, 40, 255) : key;
  }
}
var drawTile = (tx, ty) => {
  const iso = projectIso(tx, ty, 0, TILE_W, TILE_H, 8);
  const sx = iso.sx + canvas.width / 2 - TILE_W / 2 | 0;
  const sy = iso.sy + 40 | 0;
  const src = (tx + ty) % 2 === 0 ? grass : dirt;
  const spriteSurface = { width: TILE_W, height: TILE_H, pixels: src };
  blitColorkey(surface, spriteSurface, sx, sy, { colorkey: key });
};
var drawSprite = (tx, ty) => {
  const iso = projectIso(tx, ty, 1, TILE_W, TILE_H, 8);
  const sx = iso.sx + canvas.width / 2 - sprite.width / 2 | 0;
  const sy = iso.sy + 40 - sprite.height + 2 | 0;
  blitColorkey(surface, sprite, sx, sy, { colorkey: key });
};
var render = () => {
  fillRect(surface, 0, 0, surface.width, surface.height, packRGBA(20, 20, 30, 255));
  forEachIsoOrder(tilemapW, tilemapH, (x, y) => {
    drawTile(x, y);
    if (x === 5 && y === 4) drawSprite(x, y);
  });
  presentToCanvas(ctx, surface);
  requestAnimationFrame(render);
};
render();
