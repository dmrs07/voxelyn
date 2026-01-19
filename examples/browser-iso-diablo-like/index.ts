import {
  createSurface2D,
  fillRect,
  packRGBA,
  projectIso,
  forEachIsoOrder,
  blitColorkey,
} from "../../src/index.js";
import type { Surface2D } from "../../src/index.js";
import { presentToCanvas } from "../../src/adapters/canvas2d.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("no ctx");

const surface = createSurface2D(canvas.width, canvas.height);

// ============================================================================
// CONFIGURAÇÕES & PALETA
// ============================================================================
const TILE_W = 32;
const TILE_H = 16;
const WALL_HEIGHT = 48;
const Z_STEP = 4;

const COLORS = {
  bg: packRGBA(8, 8, 10, 255),
  
  // Chão
  floorTop: packRGBA(50, 45, 55, 255),
  floorSide: packRGBA(30, 25, 35, 255),
  floorCrack: packRGBA(35, 30, 40, 255),
  floorMoss: packRGBA(60, 70, 50, 255),
  
  // Paredes
  wallTop: packRGBA(90, 85, 80, 255),
  wallLeftFace: packRGBA(70, 60, 50, 255),
  wallRightFace: packRGBA(50, 40, 30, 255),
  wallMortar: packRGBA(20, 15, 10, 255),
  wallInside: packRGBA(25, 20, 15, 255),

  // Portas/Madeira
  woodLight: packRGBA(100, 70, 40, 255),
  woodDark: packRGBA(70, 45, 25, 255),
  woodMid: packRGBA(85, 60, 35, 255),
  woodFrame: packRGBA(50, 30, 15, 255),
  
  iron: packRGBA(50, 50, 60, 255),
  doorIron: packRGBA(50, 50, 60, 255),
  doorIronLight: packRGBA(80, 80, 90, 255),
  doorWoodDark: packRGBA(60, 40, 20, 255),
  void: packRGBA(5, 5, 8, 255),

  // Props
  crateHighlight: packRGBA(120, 90, 50, 255),
  crystal: packRGBA(100, 220, 255, 255),
  
  // Efeitos
  banner: packRGBA(0, 80, 160, 255),
  bannerLight: packRGBA(40, 120, 220, 255),
  bannerGold: packRGBA(180, 140, 50, 255),
  rune: packRGBA(0, 200, 255, 255),
  particleMagic: packRGBA(150, 240, 255, 255),
};

const key = packRGBA(0, 0, 0, 0);

// ============================================================================
// GERADORES DE TEXTURA
// ============================================================================

// Helper de ruído simples
const noise = (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;

// 1. Textura de Parede (com portas e banners)
const makeWallTexture = (
  w: number, 
  h: number, 
  colorBase: number, 
  inclination: number, // 1 ou -1
  feature: 'none' | 'banner' | 'door_closed' | 'door_open'
) => {
  const pixels = new Uint32Array(w * h);
  const brickH = 10;
  const archW = w * 0.75; 
  const archH = h * 0.72; 
  const archX = w / 2;
  const archTopY = h - archH; 
  const archRadius = archW / 2;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const shift = inclination > 0 ? (x / 2) : ((w - x) / 2);
      const isoY = y - shift;
      const row = Math.floor(isoY / brickH);
      const mortarH = Math.abs(isoY % brickH) < 1.5;
      const rowOffset = (Math.abs(row) % 2) * (w / 2);
      const mortarV = (x + rowOffset) % 16 < 1.5;
      
      let col = (mortarH || mortarV) ? COLORS.wallMortar : colorBase;

      if (y > h - 12 && (x + y) % 2 === 0) col = COLORS.wallMortar;

      if (feature === 'door_closed' || feature === 'door_open') {
        const dx = x - archX;
        const circleCY = archTopY + archRadius;
        let isInsideArch = false;
        let distFromEdge = 0;
        
        if (y >= circleCY) {
          isInsideArch = Math.abs(dx) < archRadius;
          distFromEdge = archRadius - Math.abs(dx);
        } else if (y >= archTopY) {
          const dyCircle = y - circleCY;
          const distSq = dx * dx + dyCircle * dyCircle;
          isInsideArch = distSq < archRadius * archRadius;
          distFromEdge = archRadius - Math.sqrt(distSq);
        }

        if (isInsideArch) {
          // Moldura do arco (Archivolt) - borda de pedra
          const borderSize = 3;
          const isBorder = distFromEdge < borderSize;
          
          if (isBorder) {
            // Pedra da borda do arco com variação
            const stoneVar = ((x + y) % 3 === 0) ? -10 : 0;
            col = packRGBA(85 + stoneVar, 75 + stoneVar, 65 + stoneVar, 255);
          } else {
            if (feature === 'door_open') {
              // PORTA VAZADA (VOID) com profundidade
              // Simular espessura da parede interna
              const thicknessSize = 5;
              let showThickness = false;
              
              if (inclination > 0) {
                // Parede fundo: vemos espessura na esquerda
                showThickness = dx < -archRadius + thicknessSize + borderSize;
              } else {
                // Parede lateral: vemos espessura na direita
                showThickness = dx > archRadius - thicknessSize - borderSize;
              }
              
              if (showThickness) {
                // Parede interna (mais escura que a externa)
                const innerShade = ((x + y) % 2 === 0) ? COLORS.wallInside : COLORS.wallMortar;
                col = innerShade;
              } else {
                col = COLORS.void;
              }

            } else {
              // PORTA FECHADA (MADEIRA COM FERRO)
              const innerX = x - (archX - archRadius + borderSize);
              
              // Tábuas verticais de madeira
              const plankW = 5;
              const plankIdx = Math.floor(innerX / plankW);
              const plankPos = innerX % plankW;
              const isPlankGap = plankPos < 1;
              
              // Feragens horizontais (seguem perspectiva isométrica)
              const ironSpacing = 14;
              const ironThickness = 3;
              const isoYDoor = y - shift * 0.5; // Menos inclinação para as feragens
              const isIron = (isoYDoor % ironSpacing) < ironThickness;
              
              if (isIron) {
                // Faixa de ferro
                const ironHighlight = (isoYDoor % ironSpacing) < 1;
                col = ironHighlight ? COLORS.doorIronLight : COLORS.doorIron;
                
                // Rebites/pregos
                if (innerX % 8 < 2 && (isoYDoor % ironSpacing) > 0.5 && (isoYDoor % ironSpacing) < 2) {
                  col = COLORS.doorIronLight;
                }
              } else {
                // Madeira
                if (isPlankGap) {
                  col = COLORS.doorWoodDark;
                } else {
                  // Variação na cor da madeira por tábua
                  const woodVar = (plankIdx % 2 === 0) ? 0 : 8;
                  col = packRGBA(80 + woodVar, 50 + woodVar, 30 + woodVar, 255);
                  
                  // Veios da madeira (linhas verticais sutis)
                  if ((innerX + y * 0.3) % 4 < 1) {
                    col = COLORS.doorWoodDark;
                  }
                }
              }
            }
          }
        }
      }

      if (feature === 'banner') {
        const bx = x - w / 2;
        const bannerIsoY = isoY;
        if (Math.abs(bx) < 6 && bannerIsoY > 10 && bannerIsoY < h - 14) {
          if (bannerIsoY < 13 || bannerIsoY > h - 18 || Math.abs(bx) >= 5) col = COLORS.bannerGold;
          else {
             col = packRGBA(0, 80 + ((x+Math.floor(bannerIsoY))%3 ? 0:10), 160, 255);
             if (Math.abs(bx) < 2 && bannerIsoY > 22 && bannerIsoY < h - 24) col = COLORS.bannerLight;
          }
        }
      }
      pixels[y * w + x] = col;
    }
  }
  return { width: w, height: h, pixels };
};

const makeFloorTexture = (variant: 'clean' | 'cracked' | 'mossy') => {
  const pixels = new Uint32Array(TILE_W * TILE_H);
  const hw = TILE_W / 2; const hh = TILE_H / 2;
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const dx = Math.abs(x - hw) / hw; const dy = Math.abs(y - hh) / hh;
      if (dx + dy <= 1) {
        let c = COLORS.floorTop;
        const n = noise(x, y);
        if (variant === 'cracked' && n > 0.8 && Math.abs(x - y) < 3) c = COLORS.floorCrack;
        if (variant === 'mossy' && n > 0.6) c = COLORS.floorMoss;
        if (dx + dy > 0.9) c = COLORS.floorSide;
        pixels[y * TILE_W + x] = c;
      } else pixels[y * TILE_W + x] = key;
    }
  }
  return { width: TILE_W, height: TILE_H, pixels };
};

// ============================================================================
// CORREÇÃO: Nova Textura de Caixa (Cubo Sólido)
// ============================================================================
const makeCrateTexture = () => {
  const w = 16;
  const h = 22; // Altura visual da caixa
  const pixels = new Uint32Array(w * h);
  
  // Geometria
  const topH = 8;     // Altura da face do topo
  const wallH = 12;   // Altura das paredes laterais
  const cx = 8;       // Centro X

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let col = key;
      const dx = Math.abs(x - cx);
      const dyTop = Math.abs(y - 4); // Centro do topo em Y=4

      // 1. Face do Topo (Diamante)
      // Equação: dx/8 + dy/4 <= 1
      if (y < topH) {
         if (dx/8 + dyTop/4 <= 1) {
             col = COLORS.woodLight;
             // Moldura do topo
             if (dx/8 + dyTop/4 > 0.7) col = COLORS.woodFrame;
             // Detalhe interno
             if (dx < 1 || dyTop < 1) col = COLORS.woodMid;
         }
      } 
      // 2. Faces Laterais (Extrusão para baixo)
      else {
         // Precisamos verificar se estamos "abaixo" das arestas do topo
         // Aresta esquerda inferior: y = 0.5*x + 4
         // Aresta direita inferior:  y = -0.5*x + 12 (para x >= 8)
         const isLeft = x < cx;
         const topEdgeY = isLeft ? (0.5 * x + 4) : (-0.5 * x + 12);
         const bottomEdgeY = topEdgeY + wallH;

         if (y >= topEdgeY && y < bottomEdgeY) {
             // Esquerda (Sombra) vs Direita (Luz média)
             col = isLeft ? COLORS.woodDark : COLORS.woodMid;
             
             // Coordenada relativa à face
             const relY = y - topEdgeY;
             const relX = isLeft ? x : (w - 1 - x); // Symmetry for pattern

             // Moldura (Bordas externas)
             if (relY < 2 || relY > wallH - 2 || x < 2 || x > 13 || (x > 7 && x < 9)) {
                 col = COLORS.woodFrame;
             } 
             // Cruz ("X") na lateral para parecer caixa de carga
             else if (Math.abs(relY - relX) < 1.5 || Math.abs(relY - (cx - relX)) < 1.5) {
                 col = COLORS.woodFrame;
             }
         }
      }
      pixels[y * w + x] = col;
    }
  }
  return { width: w, height: h, pixels };
};

const makeCrystalTexture = (hoverOffset: number) => {
  const w = 10, h = 18;
  const pixels = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dy = y - (6 + hoverOffset); const dx = x - 5;
    if (Math.abs(dx)/4 + Math.abs(dy)/8 < 1) {
       const b = 1 - Math.abs(dx)/4;
       pixels[y*w+x] = packRGBA(Math.floor(100+b*100), Math.floor(220+b*35), 255, 255);
       if (Math.abs(dx)<1 && Math.abs(dy)<3) pixels[y*w+x] = packRGBA(255,255,255,255);
    }
  }
  return { width: w, height: h, pixels };
};

// Pre-generate crystal animation frames (cache)
const CRYSTAL_FRAMES = 60;
const crystalFrames = Array.from({ length: CRYSTAL_FRAMES }, (_, i) => 
  makeCrystalTexture(Math.sin(i * 0.08) * 2)
);

const makePedestalTexture = () => {
  const w = 12, h = 10;
  const pixels = new Uint32Array(w * h);
  for(let y=0; y<h; y++) for(let x=0; x<w; x++) {
      if(y<4 && Math.abs(x-6)/6 + Math.abs(y-2)/2 <= 1) pixels[y*w+x] = COLORS.wallTop;
      else if(y>=4 && x>=2 && x<10) pixels[y*w+x] = (x<4||x>=8) ? COLORS.wallInside : COLORS.wallMortar;
  }
  return { width: w, height: h, pixels };
};

// ============================================================================
// ASSETS & MAPA
// ============================================================================
const FACE_W = TILE_W / 2;
const wallAssets = {
  left: {
    plain: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallRightFace, -1, 'none'),
    banner: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallRightFace, -1, 'banner'),
    door_open: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallRightFace, -1, 'door_open'),
    door_closed: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallRightFace, -1, 'door_closed'),
  },
  right: {
    plain: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallLeftFace, 1, 'none'),
    banner: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallLeftFace, 1, 'banner'),
    door_open: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallLeftFace, 1, 'door_open'),
    door_closed: makeWallTexture(FACE_W, WALL_HEIGHT, COLORS.wallLeftFace, 1, 'door_closed'),
  }
};
const floors = { clean: makeFloorTexture('clean'), cracked: makeFloorTexture('cracked'), mossy: makeFloorTexture('mossy') };
const texWallTop = makeFloorTexture('clean');
const texCrate = makeCrateTexture();
const texPedestal = makePedestalTexture();

const MAP_SIZE = 12;
const floorMap: ('clean'|'cracked'|'mossy')[][] = [];
for (let y = 0; y < MAP_SIZE; y++) {
  floorMap[y] = [];
  for (let x = 0; x < MAP_SIZE; x++) {
    const r = Math.abs(noise(x * 3.7, y * 2.3));
    const row = floorMap[y];
    if (row) row[x] = r > 0.7 ? 'cracked' : (r > 0.5 ? 'mossy' : 'clean');
  }
}

const walls: Record<string, keyof typeof wallAssets.left> = {
  '2,0': 'door_open', '5,0': 'banner', '9,0': 'door_closed',
  '0,2': 'door_open', '0,5': 'banner', '0,9': 'door_closed'
};

const props = [
  { x: 2, y: 2, type: 'crate' },
  { x: 2, y: 3, type: 'crate' },
  { x: 10, y: 10, type: 'crate' },
  { x: 6, y: 6, type: 'crystal' }
];

const runes = [
  { x: 5, y: 4, c: 'n' }, { x: 7, y: 4, c: 'O' }, { x: 5, y: 5, c: 'O' },
  { x: 7, y: 5, c: 'X' }, { x: 5, y: 7, c: '#' }, { x: 7, y: 7, c: 'O' }, { x: 6, y: 8, c: 'X' }
];

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: number; }
let particles: Particle[] = [];
const spawnParticle = (x: number, y: number, z: number, color: number) => {
  if (particles.length > 100) return;
  particles.push({ x, y, z, vx: (Math.random()-0.5)*0.05, vy: (Math.random()-0.5)*0.05, vz: 0.02+Math.random()*0.03, life: 1.0, color });
};

// ============================================================================
// RENDERIZAÇÃO
// ============================================================================

const drawIsoPillar = (target: Surface2D, sx: number, sy: number, type: 'corner'|'left'|'back', feat: keyof typeof wallAssets.left) => {
  const topY = sy - WALL_HEIGHT;
  if (type === 'back' || type === 'corner') blitColorkey(target, wallAssets.right[feat]??wallAssets.right.plain, sx - FACE_W, topY + TILE_H/2, { colorkey: key });
  if (type === 'left' || type === 'corner') blitColorkey(target, wallAssets.left[feat]??wallAssets.left.plain, sx, topY + TILE_H/2, { colorkey: key });
  blitColorkey(target, texWallTop, sx - TILE_W/2, topY, { colorkey: key });
};

const drawRune = (target: Surface2D, sx: number, sy: number, char: string, frame: number) => {
  const patterns: Record<string, number[]> = { 'X': [1,0,1,0,1,0,1,0,1], 'O': [1,1,1,1,0,1,1,1,1], '#': [1,0,1,1,1,1,1,0,1], 'n': [1,1,1,0,0,0,0,0,0] };
  const pattern = patterns[char] ?? [1,0,1,0,1,0,1,0,1];
  const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;
  for (let i = 0; i < pattern.length; i++) if (pattern[i]) {
      const b = Math.floor(200 * pulse + Math.random() * 55);
      fillRect(target, sx - 4 + (i%3)*3, sy - 2 + Math.floor(i/3)*2, 2, 2, packRGBA(0, b, 255, 255));
  }
};

let frame = 0;
const render = () => {
  frame++;
  fillRect(surface, 0, 0, surface.width, surface.height, COLORS.bg);

  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.z += p.vz; p.life -= 0.015; }
  if (frame % 8 === 0) {
    for (const r of runes) if (Math.random()>0.7) spawnParticle(r.x, r.y, 0.1, COLORS.particleMagic);
    spawnParticle(6, 6, 0.8, COLORS.crystal);
  }

  forEachIsoOrder(MAP_SIZE, MAP_SIZE, (x, y) => {
    const lx = x - MAP_SIZE/2; const ly = y - MAP_SIZE/2;
    const iso = projectIso(lx, ly, 0, TILE_W, TILE_H, Z_STEP);
    const sx = (surface.width/2 + iso.sx)|0; const sy = (145 + iso.sy)|0;
    
    const isBack = y === 0; const isLeft = x === 0;
    const feat = walls[`${x},${y}`] ?? 'plain';

    if (isBack && isLeft) drawIsoPillar(surface, sx, sy, 'corner', feat);
    else if (isLeft) drawIsoPillar(surface, sx, sy, 'left', feat);
    else if (isBack) drawIsoPillar(surface, sx, sy, 'back', feat);
    else {
      blitColorkey(surface, floors[floorMap[y]?.[x]??'clean'], sx - TILE_W/2, sy - TILE_H/2, { colorkey: key });
      const rune = runes.find(r => r.x === x && r.y === y);
      if (rune) drawRune(surface, sx, sy - TILE_H/4, rune.c, frame);

      const prop = props.find(p => p.x === x && p.y === y);
      if (prop) {
        if (prop.type === 'crate') {
            // Ajustado offset Y para a nova altura da caixa
            blitColorkey(surface, texCrate, sx - 8, sy - 20, { colorkey: key });
        } else if (prop.type === 'crystal') {
            blitColorkey(surface, texPedestal, sx - 6, sy - 10, { colorkey: key });
            const crystalSprite = crystalFrames[frame % CRYSTAL_FRAMES];
            if (crystalSprite) blitColorkey(surface, crystalSprite, sx - 5, sy - 28, { colorkey: key });
        }
      }

      for (const p of particles) if (Math.round(p.x)===x && Math.round(p.y)===y) {
          const pIso = projectIso(p.x - MAP_SIZE/2, p.y - MAP_SIZE/2, p.z, TILE_W, TILE_H, Z_STEP);
          const psx = (surface.width/2 + pIso.sx)|0; const psy = (145 + pIso.sy)|0;
          fillRect(surface, psx, psy, 2, 2, p.color);
      }
    }
  });

  presentToCanvas(ctx, surface);
  requestAnimationFrame(render);
};

render();
