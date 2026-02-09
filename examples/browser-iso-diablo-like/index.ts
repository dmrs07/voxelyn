import { createSurface2D, fillRect, packRGBA, projectIso, forEachIsoOrder, blitColorkey } from "../../packages/voxelyn-core/src/index.js";
import { presentToCanvas } from "../../packages/voxelyn-core/src/adapters/canvas2d.js";
import { createAnimationPlayer, createProceduralCharacter, stepAnimation } from "../../packages/voxelyn-animation/src/index.js";

const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const surface = createSurface2D(canvas.width, canvas.height);

// ============================================================================
// CONFIG & CORES (ultra-compact)
// ============================================================================
const TW = 32, TH = 16, WH = 48, ZS = 4, MAP = 10;
const rgb = (r: number, g: number, b: number) => packRGBA(r, g, b, 255);
const C = {
  bg: rgb(8, 8, 10), floor: rgb(50, 45, 55), floorEdge: rgb(30, 25, 35),
  wallL: rgb(70, 60, 50), wallR: rgb(50, 40, 30), mortar: rgb(20, 15, 10),
  wood: rgb(85, 60, 35), woodDark: rgb(50, 30, 15), iron: rgb(50, 50, 60),
  void: rgb(5, 5, 8), armor: rgb(90, 90, 100), armorDark: rgb(60, 60, 70),
  shadow: rgb(20, 10, 25), eyes: rgb(220, 50, 50), portal: rgb(80, 40, 180),
};
const KEY = packRGBA(0, 0, 0, 0);
const noise = (x: number, y: number) => Math.sin(x * 12.9898 + y * 78.233) * 43758.5453 % 1;

type Facing = 'dr' | 'dl' | 'ur' | 'ul';
type RoomType = 'dungeon' | 'crypt' | 'cave';
type Portal = { x: number; y: number; side: 'top' | 'left' };

// ============================================================================
// GERADOR DE TEXTURAS (simplificado)
// ============================================================================
const makeWall = (inc: number, hasPortal: boolean) => {
  const w = TW / 2, h = WH;
  const px = new Uint32Array(w * h);
  const base = inc > 0 ? C.wallL : C.wallR;
  const archR = w * 0.35;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const shift = inc > 0 ? x / 2 : (w - x) / 2;
      const isoY = y - shift;
      const row = Math.floor(isoY / 10);
      const mortar = Math.abs(isoY % 10) < 1.5 || (x + (row % 2) * 8) % 16 < 1.5;
      let col = mortar ? C.mortar : base;
      
      if (hasPortal) {
        const dx = x - w / 2, archTop = h * 0.28;
        const inArch = y >= archTop && (
          y >= archTop + archR ? Math.abs(dx) < archR :
          dx * dx + (y - archTop - archR) ** 2 < archR * archR
        );
        if (inArch) col = C.void;
      }
      px[y * w + x] = col;
    }
  }
  return { width: w, height: h, pixels: px };
};

const makeFloor = (seed: number) => {
  const px = new Uint32Array(TW * TH);
  const hw = TW / 2, hh = TH / 2;
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      const dx = Math.abs(x - hw) / hw, dy = Math.abs(y - hh) / hh;
      if (dx + dy <= 1) {
        const n = noise(x + seed, y + seed);
        px[y * TW + x] = dx + dy > 0.9 ? C.floorEdge : 
          n > 0.85 ? rgb(35 + (n * 20 | 0), 30, 40) : C.floor;
      } else px[y * TW + x] = KEY;
    }
  }
  return { width: TW, height: TH, pixels: px };
};

// ============================================================================
// SISTEMA DE QUADRANTES/SALAS
// ============================================================================
type Room = {
  seed: number;
  type: RoomType;
  portals: Portal[];
  floor: ReturnType<typeof makeFloor>;
  wallsL: ReturnType<typeof makeWall>[];
  wallsR: ReturnType<typeof makeWall>[];
};

let roomCount = 0;
const rng = (seed: number) => {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
};

const generateRoom = (seed?: number): Room => {
  const s = seed ?? (Date.now() + roomCount++ * 1337);
  const rand = rng(s);
  const type: RoomType = ['dungeon', 'crypt', 'cave'][rand() * 3 | 0] as RoomType;
  
  // Gera 1-3 portais aleatórios
  const portalCount = 1 + (rand() * 3 | 0);
  const portals: Portal[] = [];
  for (let i = 0; i < portalCount; i++) {
    const side = rand() > 0.5 ? 'top' : 'left';
    const pos = 2 + (rand() * (MAP - 4) | 0);
    if (!portals.some(p => p.side === side && Math.abs(p.x - pos) < 2 && Math.abs(p.y - pos) < 2)) {
      portals.push({ x: side === 'top' ? pos : 0, y: side === 'left' ? pos : 0, side });
    }
  }
  
  // Gera texturas de parede com portais
  const wallsL: ReturnType<typeof makeWall>[] = [];
  const wallsR: ReturnType<typeof makeWall>[] = [];
  for (let i = 0; i < MAP; i++) {
    wallsL.push(makeWall(-1, portals.some(p => p.side === 'left' && p.y === i)));
    wallsR.push(makeWall(1, portals.some(p => p.side === 'top' && p.x === i)));
  }
  
  return { seed: s, type, portals, floor: makeFloor(s), wallsL, wallsR };
};

let currentRoom = generateRoom();

// ============================================================================
// JOGADOR
// ============================================================================
const player = { x: 5, y: 5, z: 0, facing: 'dr' as Facing };
const keys: Record<string, boolean> = {};
const SPEED = 0.08;

const checkPortalCollision = (): Portal | null => {
  for (const p of currentRoom.portals) {
    if (p.side === 'top' && player.y < 1.5 && Math.abs(player.x - p.x) < 1.5) return p;
    if (p.side === 'left' && player.x < 1.5 && Math.abs(player.y - p.y) < 1.5) return p;
  }
  return null;
};

const teleportToNewRoom = () => {
  currentRoom = generateRoom();
  // Spawn no centro da sala
  player.x = 5;
  player.y = 5;
};

const updatePlayer = () => {
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  
  if (dx && dy) { dx *= 0.707; dy *= 0.707; }
  
  if (dx || dy) {
    const nx = player.x + dx * SPEED;
    const ny = player.y + dy * SPEED;
    
    // Verifica se está perto de um portal
    const nearPortal = checkPortalCollision();
    
    // Limites normais
    let minX = 1, minY = 1;
    
    // Se perto de um portal, permite passar pela borda correspondente
    if (nearPortal) {
      if (nearPortal.side === 'left') minX = -1;
      if (nearPortal.side === 'top') minY = -1;
    }
    
    // Aplica movimento
    if (nx >= minX && nx < MAP - 1) player.x = nx;
    if (ny >= minY && ny < MAP - 1) player.y = ny;
    
    // Atualiza direção
    if (dx !== 0 || dy !== 0) {
      player.facing = dx > 0 ? (dy >= 0 ? 'dr' : 'ur') : (dy > 0 ? 'dl' : 'ul');
    }
    
    // Teleporte ao sair da sala
    if (player.x < 0 || player.y < 0) {
      teleportToNewRoom();
    }
  }
};

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if ('wasd'.includes(e.key.toLowerCase()) || e.key.startsWith('Arrow')) e.preventDefault();
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// ============================================================================
// SPRITE/ANIMACAO PROCEDURAL DO GUERREIRO
// ============================================================================
const proceduralWarrior = createProceduralCharacter({
  id: 'demo-warrior',
  style: 'player',
  width: 16,
  height: 22,
});
const warriorAnimation = createAnimationPlayer({
  set: proceduralWarrior.clips,
  width: proceduralWarrior.width,
  height: proceduralWarrior.height,
  seed: 1337,
});
let lastAnimationTick = 0;

// ============================================================================
// TEXTURAS PRÉ-GERADAS
// ============================================================================
const texWallTop = makeFloor(0);
// ============================================================================
// RENDERIZAÇÃO
// ============================================================================
const drawPillar = (sx: number, sy: number, type: 'corner' | 'left' | 'back', wallIdx: number) => {
  const topY = sy - WH;
  if (type === 'back' || type === 'corner') {
    const wall = currentRoom.wallsR[wallIdx];
    if (wall) blitColorkey(surface, wall, sx - TW / 4, topY + TH / 2, { colorkey: KEY });
  }
  if (type === 'left' || type === 'corner') {
    const wall = currentRoom.wallsL[wallIdx];
    if (wall) blitColorkey(surface, wall, sx, topY + TH / 2, { colorkey: KEY });
  }
  blitColorkey(surface, texWallTop, sx - TW / 2, topY, { colorkey: KEY });
};

const drawWarrior = (x: number, y: number, z: number, facing: Facing, frame: number) => {
  const iso = projectIso(x - MAP / 2, y - MAP / 2, z, TW, TH, ZS);
  const sx = (surface.width / 2 + iso.sx) | 0;
  const sy = (145 + iso.sy) | 0;
  const dtMs = Math.max(1, (frame - lastAnimationTick) * 16);
  lastAnimationTick = frame;
  const moving = Boolean(
    keys['w'] || keys['a'] || keys['s'] || keys['d'] ||
    keys['arrowup'] || keys['arrowleft'] || keys['arrowdown'] || keys['arrowright']
  );
  const anim = stepAnimation(warriorAnimation, dtMs, moving ? 'move' : 'idle', facing);
  const sprite = anim.sprite;
  blitColorkey(surface, sprite, sx - 8, sy - 20, { colorkey: KEY });
};

// HUD minimalista
const drawHUD = () => {
  const portalGlow = Math.sin(frame * 0.1) * 20 + 60;
  fillRect(surface, 4, 4, 100, 12, rgb(20, 20, 25));
  fillRect(surface, 6, 6, 96, 8, rgb(40, 30, 50));
  
  // Indicador de portais
  for (let i = 0; i < currentRoom.portals.length; i++) {
    fillRect(surface, 110 + i * 10, 6, 6, 6, rgb(portalGlow | 0, 30, 120));
  }
};

let frame = 0;
const render = () => {
  frame++;
  fillRect(surface, 0, 0, surface.width, surface.height, C.bg);
  updatePlayer();
  player.z = Math.abs(Math.sin(frame * 0.05) * 0.1);

  forEachIsoOrder(MAP, MAP, (x, y) => {
    const lx = x - MAP / 2, ly = y - MAP / 2;
    const iso = projectIso(lx, ly, 0, TW, TH, ZS);
    const sx = (surface.width / 2 + iso.sx) | 0;
    const sy = (145 + iso.sy) | 0;

    const isBack = y === 0, isLeft = x === 0;

    if (isBack && isLeft) drawPillar(sx, sy, 'corner', 0);
    else if (isLeft) drawPillar(sx, sy, 'left', y);
    else if (isBack) drawPillar(sx, sy, 'back', x);
    else {
      blitColorkey(surface, currentRoom.floor, sx - TW / 2, sy - TH / 2, { colorkey: KEY });
      
      // Portal glow no chão
      for (const p of currentRoom.portals) {
        if ((p.side === 'top' && p.x === x && y === 1) || (p.side === 'left' && p.y === y && x === 1)) {
          const glow = (Math.sin(frame * 0.15) * 30 + 50) | 0;
          fillRect(surface, sx - 4, sy - 2, 8, 4, rgb(glow, 20, glow * 2));
        }
      }

      // Desenha jogador
      if (Math.round(player.x) === x && Math.round(player.y) === y) {
        drawWarrior(player.x, player.y, player.z, player.facing, frame);
      }
    }
  });

  drawHUD();
  presentToCanvas(ctx, surface);
  requestAnimationFrame(render);
};

render();
