/**
 * Voxelyn - Diorama de Natureza Interativo
 *
 * Controles:
 * - WASD ou Setas: Mover personagem
 * - Espaço: Pular
 * - Clique esquerdo: Atirar flecha na direção do mouse
 * - Clique direito (segurar): Apagar material
 * - Segurar Shift + Clique: Pintar material selecionado
 * - Teclas 1-9, 0: Selecionar material
 */

import {
  createGrid2D,
  createSurface2D,
  makePalette,
  packRGBA,
  paintRect,
  paintCircle,
  renderToSurfaceShaded,
  stepActiveChunks,
  makeCell,
  getMaterial,
  setXY,
  getXY,
  markChunkActiveByXY,
  markChunkDirtyByXY,
  inBounds,
  multiplyColor,
  lerpColor,
  adjustBrightness
} from "../../src/index.js";
import type { ShaderFn } from "../../src/core/grid2d.js";
import { presentToCanvas } from "../../src/adapters/canvas2d.js";
import { RNG } from "../../src/core/rng.js";

// ============================================================================
// CONFIGURAÇÃO DO MUNDO
// ============================================================================

const W = 384;
const H = 216;
const SCALE = 3;

// ============================================================================
// MATERIAIS - Diorama de Natureza
// ============================================================================

const MAT = {
  EMPTY: 0,
  SAND: 1,
  WATER: 2,
  ROCK: 3,
  DIRT: 4,
  GRASS: 5,
  WOOD: 6,
  LEAF: 7,
  FIRE: 8,
  SMOKE: 9,
  LAVA: 10,
  STEAM: 11,
  SNOW: 12,
  ICE: 13,
  ARROW: 14,
  PLAYER: 15
} as const;

type MaterialType = (typeof MAT)[keyof typeof MAT];

// Propriedades dos materiais
const IS_SOLID: Record<number, boolean> = {
  [MAT.ROCK]: true,
  [MAT.DIRT]: true,
  [MAT.GRASS]: true,
  [MAT.WOOD]: true,
  [MAT.ICE]: true
};

const IS_LIQUID: Record<number, boolean> = {
  [MAT.WATER]: true,
  [MAT.LAVA]: true
};

const IS_GAS: Record<number, boolean> = {
  [MAT.SMOKE]: true,
  [MAT.STEAM]: true
};

// Blocos que caem como unidade (não como pó)
const IS_FALLING_BLOCK: Record<number, boolean> = {
  [MAT.ROCK]: true,
  [MAT.WOOD]: true,
  [MAT.ICE]: true
};

// Materiais que fazem parte de árvore
const IS_TREE_PART: Record<number, boolean> = {
  [MAT.WOOD]: true,
  [MAT.LEAF]: true
};

// Densidade dos materiais (maior = mais pesado)
const DENSITY: Record<number, number> = {
  [MAT.EMPTY]: 0,
  [MAT.SMOKE]: 1,
  [MAT.STEAM]: 2,
  [MAT.FIRE]: 3,
  [MAT.SNOW]: 10,
  [MAT.LEAF]: 15,
  [MAT.WATER]: 50,
  [MAT.SAND]: 80,
  [MAT.DIRT]: 85,
  [MAT.LAVA]: 100,
  [MAT.ICE]: 90,
  [MAT.GRASS]: 70,
  [MAT.WOOD]: 60,
  [MAT.ROCK]: 200
};

// Viscosidade (quanto maior, mais lento o movimento horizontal)
const VISCOSITY: Record<number, number> = {
  [MAT.WATER]: 1,
  [MAT.LAVA]: 8
};

// Inflamabilidade (chance de pegar fogo)
const FLAMMABLE: Record<number, number> = {
  [MAT.WOOD]: 8,
  [MAT.LEAF]: 15,
  [MAT.GRASS]: 12
};

// Cache para verificação de suporte de árvore (evita recálculo)
let treeCheckFrame = 0;
const treeGroundedCache = new Map<number, boolean>();

// ============================================================================
// PALETA DE CORES - Cores naturais e harmoniosas
// ============================================================================

// Cores ajustadas para um look mais natural e menos saturado
const palette = makePalette(256, packRGBA(135, 206, 235, 255), [
  [MAT.EMPTY, packRGBA(135, 206, 235, 255)], // Céu azul claro (Sky Blue)
  // Tons de terra mais naturais
  [MAT.SAND, packRGBA(237, 201, 120, 255)],  // Areia mais pálida
  [MAT.DIRT, packRGBA(120, 80, 50, 255)],    // Terra menos avermelhada
  [MAT.ROCK, packRGBA(100, 100, 110, 255)],  // Pedra com leve tom azulado (frio)
  // Vegetação
  [MAT.GRASS, packRGBA(70, 150, 60, 255)],   // Grama
  [MAT.LEAF, packRGBA(50, 100, 50, 255)],    // Folha de pinheiro escura
  [MAT.WOOD, packRGBA(90, 60, 40, 255)],     // Madeira
  // Elementos vibrantes
  [MAT.WATER, packRGBA(60, 100, 190, 200)],  // Água com leve transparência
  [MAT.LAVA, packRGBA(255, 90, 0, 255)],     // Lava
  [MAT.FIRE, packRGBA(255, 160, 30, 255)],   // Fogo
  // Atmosfera
  [MAT.SNOW, packRGBA(245, 245, 250, 255)],  // Neve (quase branca)
  [MAT.ICE, packRGBA(180, 220, 250, 255)],   // Gelo
  [MAT.STEAM, packRGBA(230, 230, 240, 100)], // Vapor mais transparente
  [MAT.SMOKE, packRGBA(50, 50, 60, 200)],    // Fumaça escura
  // Outros
  [MAT.ARROW, packRGBA(120, 60, 20, 255)],
  [MAT.PLAYER, packRGBA(255, 200, 150, 255)]
]);

// ============================================================================
// ESTADO DO JOGO
// ============================================================================

const grid = createGrid2D(W, H, { chunkSize: 32 });
const surface = createSurface2D(W, H);
const rng = new RNG(Date.now());

// Cache de altura da superfície para shading (recalculado periodicamente)
const surfaceHeightCache = new Uint16Array(W);
let surfaceCacheFrame = 0;

/**
 * Recalcula o cache de altura da superfície.
 * Encontra o primeiro pixel sólido de cima para baixo em cada coluna.
 */
function updateSurfaceHeightCache(): void {
  for (let x = 0; x < W; x++) {
    surfaceHeightCache[x] = H; // Default: fundo
    for (let y = 0; y < H; y++) {
      const mat = getMaterial(getXY(grid, x, y));
      // Considera sólidos e líquidos densos como "superfície"
      if (mat !== MAT.EMPTY && mat !== MAT.SMOKE && mat !== MAT.STEAM && mat !== MAT.FIRE) {
        surfaceHeightCache[x] = y;
        break;
      }
    }
  }
}

/**
 * Shader de profundidade - escurece pixels baseado na distância da superfície.
 * Também adiciona variação de textura com ruído.
 */
const depthShader: ShaderFn = (material, x, y, baseColor, _cell) => {
  // Materiais que não recebem shading
  if (material === MAT.EMPTY || material === MAT.FIRE || material === MAT.LAVA ||
      material === MAT.SMOKE || material === MAT.STEAM || material === MAT.SNOW ||
      material === MAT.WATER) {
    // Água: leve efeito de profundidade
    if (material === MAT.WATER) {
      const waterSurfaceY = surfaceHeightCache[x] ?? H;
      const waterDepth = Math.min(1, (y - waterSurfaceY) / 30);
      return multiplyColor(baseColor, 1 - waterDepth * 0.3);
    }
    return baseColor;
  }

  // Obtém altura da superfície nesta coluna
  const surfaceY = surfaceHeightCache[x] ?? H;
  const depth = y - surfaceY;

  // Sem shading se estiver na superfície ou acima
  if (depth <= 0) {
    // Pixels na superfície: leve highlight
    return adjustBrightness(baseColor, 8);
  }

  // Calcula fator de escurecimento baseado na profundidade
  // Máximo de 50% mais escuro a 60 pixels de profundidade
  const maxDepth = 60;
  const depthFactor = Math.min(1, depth / maxDepth);
  const darkening = 1 - depthFactor * 0.5;

  // Adiciona leve variação de textura (dithering simples)
  const noise = ((x * 7 + y * 13) % 10) / 100; // -0.05 a 0.05
  const finalFactor = darkening + (noise - 0.05);

  return multiplyColor(baseColor, Math.max(0.4, finalFactor));
};

// Jogador
const player = {
  x: W / 2,
  y: H / 2,
  vx: 0,
  vy: 0,
  onGround: false,
  facingRight: true
};

// Flechas ativas
type Arrow = { x: number; y: number; vx: number; vy: number; life: number };
const arrows: Arrow[] = [];

// Mouse state
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;
let rightMouseDown = false;
let shiftDown = false;
let selectedMaterial: MaterialType = MAT.SAND;

// Teclas pressionadas
const keys: Record<string, boolean> = {};

// ============================================================================
// SETUP DO CANVAS
// ============================================================================

const canvas = document.getElementById("c") as HTMLCanvasElement;
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W * SCALE}px`;
canvas.style.height = `${H * SCALE}px`;

const ctx = canvas.getContext("2d")!;
if (!ctx) throw new Error("no ctx");

// ============================================================================
// FUNÇÕES AUXILIARES DE GERAÇÃO
// ============================================================================

/** Gera um ruído mais natural somando várias ondas senoidais */
function fractalNoise(x: number, scale: number, amplitude: number, octaves: number = 3): number {
  let value = 0;
  let currentScale = scale;
  let currentAmp = amplitude;

  for (let i = 0; i < octaves; i++) {
    value += Math.sin(x * currentScale) * currentAmp;
    currentScale *= 2;
    currentAmp *= 0.5;
  }
  return value;
}

/**
 * Escolhe um material baseado na profundidade para simular sombreamento.
 * Quanto mais fundo, maior a chance de usar o material "dark".
 */
function getShadedMaterial(x: number, y: number, groundY: number, mainMat: number, darkMat: number): number {
  const depth = y - groundY;
  // A partir de 10 pixels de profundidade, começa a chance de ficar mais escuro
  if (depth < 10) return mainMat;

  // O ruído ajuda a não ficar um degradê perfeito e chato
  const noise = fractalNoise(x, 0.1, y * 0.1) + fractalNoise(y, 0.1, x * 0.1);
  // Chance aumenta com a profundidade. Máximo de 70% de chance de ser escuro no fundo.
  const darkChance = Math.min(70, (depth - 10) * 1.5 + noise * 20);

  return rng.nextInt(100) < darkChance ? darkMat : mainMat;
}

// ============================================================================
// GERAÇÃO DO TERRENO - Cenário estilo pixel art com SOMBREAMENTO
// ============================================================================

function generateTerrain(): void {
  const groundLevel = H - 40;

  // ========== 1. DUNAS DE AREIA (Com sombreamento de profundidade) ==========
  for (let x = 0; x < 100; x++) {
    const baseH = Math.sin(x * 0.03) * 15;
    const detail = fractalNoise(x, 0.1, 5);
    const height = 25 + baseH + detail;
    const surfaceY = (groundLevel - height) | 0;

    for (let y = surfaceY; y < H; y++) {
      // Usa sombreamento: mistura Terra (mais escura) na Areia com profundidade
      const mat = getShadedMaterial(x, y, surfaceY, MAT.SAND, MAT.DIRT);
      setXY(grid, x, y, makeCell(mat));
      markChunkActiveByXY(grid, x, y);
    }

    // Topo de grama esparsa
    if (x > 10 && x < 40 && rng.nextInt(10) < 4) {
      if (inBounds(grid, x, surfaceY - 1)) {
        setXY(grid, x, surfaceY - 1, makeCell(MAT.GRASS));
        markChunkActiveByXY(grid, x, surfaceY - 1);
      }
    }
  }

  // Grama ALTA na duna
  drawGrassTuft(45, groundLevel - 30);
  drawGrassTuft(75, groundLevel - 18);

  // ========== 2. LAGO (Com fundo sombreado) ==========
  const lakeStart = 90;
  const lakeEnd = 170;

  for (let x = lakeStart; x < lakeEnd; x++) {
    const lakeShape = Math.sin((x - lakeStart) * 0.07) * 25;
    const surfaceY = (groundLevel + 5 + lakeShape) | 0;

    for (let y = 0; y < H; y++) {
      if (y >= surfaceY) {
        // Fundo do lago: mistura Areia e Pedra para profundidade
        const mat = getShadedMaterial(x, y, surfaceY, MAT.SAND, MAT.ROCK);
        setXY(grid, x, y, makeCell(mat));
        markChunkActiveByXY(grid, x, y);
      } else if (y >= groundLevel + 8) {
        // Água
        setXY(grid, x, y, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, x, y);
      }
    }
  }

  // ========== 3. FORMAÇÃO ROCHOSA (Centro) ==========
  drawRockFormation(175, groundLevel, 1.2);

  // ========== 4. VULCÃO (Com canal de lava e sombreamento) ==========
  const volcanoX = 240;

  for (let x = 170; x < 300; x++) {
    const dist = Math.abs(x - volcanoX);
    const height = Math.max(0, 80 * Math.exp(-0.0012 * dist * dist));
    const noise = fractalNoise(x, 0.2, 4);
    const surfaceY = (groundLevel - height + noise) | 0;

    // Largura do canal de lava (mais estreito embaixo)
    const lavaChannelWidth = 6 - Math.min(4, (groundLevel - surfaceY) * 0.05);

    for (let y = surfaceY; y < H; y++) {
      // Se estiver dentro da área do canal de lava, pule
      if (dist < lavaChannelWidth && y < groundLevel) continue;

      // Sombreamento: Mistura Pedra na Terra com profundidade
      const mat = getShadedMaterial(x, y, surfaceY, MAT.DIRT, MAT.ROCK);
      setXY(grid, x, y, makeCell(mat));
      markChunkActiveByXY(grid, x, y);
    }

    // Vegetação na base do vulcão
    if (dist > 30 && dist < 60 && rng.nextInt(10) < 6) {
      if (inBounds(grid, x, surfaceY - 1)) {
        setXY(grid, x, surfaceY - 1, makeCell(MAT.GRASS));
        markChunkActiveByXY(grid, x, surfaceY - 1);
      }
    }
  }

  // Preencher o canal de LAVA
  for (let y = groundLevel - 80; y < groundLevel + 10; y++) {
    // Cratera larga no topo, canal estreito embaixo
    const width = y < groundLevel - 60 ? 6 : (3 + rng.nextInt(2));
    for (let dx = -width; dx <= width; dx++) {
      const absDx = Math.abs(dx);
      // Adiciona pedras nas bordas para "segurar" a lava
      if (absDx === width && rng.nextInt(10) < 7) {
        setXY(grid, volcanoX + dx, y, makeCell(MAT.ROCK));
      } else {
        setXY(grid, volcanoX + dx, y, makeCell(MAT.LAVA));
      }
      markChunkActiveByXY(grid, volcanoX + dx, y);
    }
  }

  // Fogo no topo do vulcão
  for (let i = 0; i < 15; i++) {
    const fx = volcanoX - 4 + rng.nextInt(8);
    const fy = groundLevel - 85 + rng.nextInt(10);
    if (inBounds(grid, fx, fy)) {
      setXY(grid, fx, fy, makeCell(MAT.FIRE));
      markChunkActiveByXY(grid, fx, fy);
    }
  }

  // Pinheiros no vulcão
  drawPineTree(195, groundLevel - 15, 28);
  drawPineTree(280, groundLevel - 25, 24);

  // ========== 5. MONTANHA NEVADA (Com gelo e sombreamento) ==========
  for (let x = 300; x < W; x++) {
    const height = (x - 300) * 1.1 + fractalNoise(x, 0.1, 8);
    const surfaceY = (groundLevel - 30 - height) | 0;

    for (let y = surfaceY; y < H; y++) {
      let mat: number = MAT.ROCK;
      const snowLine = surfaceY + 15 + fractalNoise(x, 0.2, 5);

      if (y < snowLine) {
        // Topo: Neve, com chance de Gelo nas partes mais baixas da neve
        mat = (y > snowLine - 5 && rng.nextInt(10) < 4) ? MAT.ICE : MAT.SNOW;
      } else {
        // Base: Pedra (fica naturalmente escura por ser só pedra)
        mat = MAT.ROCK;
      }

      setXY(grid, x, y, makeCell(mat));
      markChunkActiveByXY(grid, x, y);
    }
  }

  // Pinheiro na neve
  drawPineTree(340, groundLevel - 60, 22);

  // Boneco de neve
  drawSnowman(360, groundLevel - 50);

  // ========== NUVENS ==========
  drawHorizonClouds(40, 180, 90);
  drawSkyCloud(60, 30, 45);
  drawSkyCloud(180, 40, 50);
  drawSkyCloud(300, 25, 60);
}

/** Desenha tufo de grama alta - EXUBERANTE como na referência */
function drawGrassTuft(x: number, y: number): void {
  // Grama muito mais alta e densa
  for (let i = -5; i <= 5; i++) {
    const height = 20 + rng.nextInt(15) - Math.abs(i) * 2;
    for (let j = 0; j < height; j++) {
      const gx = x + i;
      const gy = y - j;
      // Adiciona leve ondulação
      const wave = Math.sin(j * 0.3 + i) * 0.5 | 0;
      if (inBounds(grid, gx + wave, gy)) {
        setXY(grid, gx + wave, gy, makeCell(MAT.GRASS));
        markChunkActiveByXY(grid, gx + wave, gy);
      }
    }
  }
}

/** Desenha nuvem decorativa (usando vapor) */
function drawCloud(cx: number, cy: number, size: number): void {
  for (let i = 0; i < size; i++) {
    const angle = (i / size) * Math.PI * 2;
    const r = size * 0.4 + rng.nextInt(size * 0.2 | 0);
    const x = cx + Math.cos(angle) * r | 0;
    const y = cy + Math.sin(angle) * r * 0.4 | 0;
    if (inBounds(grid, x, y)) {
      paintCircle(grid, x, y, 3 + rng.nextInt(3), makeCell(MAT.STEAM));
    }
  }
}

/** Desenha formação rochosa angular - GRANDE como na referência */
function drawRockFormation(x: number, baseY: number, size: number = 1): void {
  // Múltiplas rochas angulares agrupadas
  const heights = [35, 45, 30, 40].map(h => (h * size) | 0);
  const offsets = [-15, 0, 12, 25].map(o => (o * size) | 0);
  
  for (let rock = 0; rock < 4; rock++) {
    const rx = x + offsets[rock]!;
    const height = heights[rock]!;
    const width = (12 + rng.nextInt(8)) * size | 0;

    for (let dy = 0; dy < height; dy++) {
      // Formato mais angular/irregular
      const taper = 1 - (dy / height) * 0.7;
      const rowWidth = (width * taper) | 0;
      const halfWidth = (rowWidth / 2) | 0;
      
      for (let dx = -halfWidth; dx < halfWidth; dx++) {
        const px = rx + dx;
        const py = baseY - dy;
        if (inBounds(grid, px, py)) {
          // Textura: mistura tons de cinza
          const mat = rng.nextInt(10) < 2 ? MAT.DIRT : MAT.ROCK;
          setXY(grid, px, py, makeCell(mat));
          markChunkActiveByXY(grid, px, py);
        }
      }
    }
  }
}

/** Desenha rio de lava - CURVO com poças como na referência */
function drawLavaRiver(startX: number, startY: number, endY: number, curveDir: number = 1): void {
  let x = startX;
  let width = 4;
  
  for (let y = startY; y < endY; y++) {
    // Curva suave na direção especificada
    x += (rng.nextInt(3) - 1 + curveDir * 0.3) | 0;
    
    // Largura varia (mais larga = poça)
    if (rng.nextInt(100) < 10) {
      width = 6 + rng.nextInt(4); // Poça
    } else if (width > 4) {
      width--; // Volta ao normal
    }
    
    const halfWidth = (width / 2) | 0;
    for (let dx = -halfWidth; dx <= halfWidth; dx++) {
      if (inBounds(grid, x + dx, y)) {
        setXY(grid, x + dx, y, makeCell(MAT.LAVA));
        markChunkActiveByXY(grid, x + dx, y);
      }
    }
  }
  
  // Poça no final
  paintCircle(grid, x, endY, 8 + rng.nextInt(4), makeCell(MAT.LAVA));
}

/** Desenha pinheiro (árvore triangular) - MAIOR como na referência */
function drawPineTree(x: number, baseY: number, height: number): void {
  // Tronco mais grosso
  const trunkHeight = (height * 0.2) | 0;
  const trunkWidth = Math.max(2, (height * 0.08) | 0);
  
  for (let y = 0; y < trunkHeight; y++) {
    for (let dx = -trunkWidth; dx <= trunkWidth; dx++) {
      if (inBounds(grid, x + dx, baseY + y)) {
        setXY(grid, x + dx, baseY + y, makeCell(MAT.WOOD));
        markChunkActiveByXY(grid, x + dx, baseY + y);
      }
    }
  }

  // Copa triangular em 3 camadas sobrepostas
  const foliageStart = baseY - trunkHeight;
  for (let layer = 0; layer < 3; layer++) {
    const layerY = foliageStart - layer * (height * 0.22 | 0);
    const layerHeight = (height * 0.4) | 0;
    const baseWidth = (height * 0.45 - layer * 2) | 0;

    for (let dy = 0; dy < layerHeight; dy++) {
      const progress = dy / layerHeight;
      const rowWidth = (baseWidth * (1 - progress * 0.9)) | 0;
      
      for (let dx = -rowWidth; dx <= rowWidth; dx++) {
        const fx = x + dx;
        const fy = layerY + dy;
        if (inBounds(grid, fx, fy)) {
          // Variação de tom nas folhas
          setXY(grid, fx, fy, makeCell(MAT.LEAF));
          markChunkActiveByXY(grid, fx, fy);
        }
      }
    }
  }
}

/** Desenha boneco de neve */
function drawSnowman(x: number, baseY: number): void {
  // Corpo (3 bolas de neve)
  paintCircle(grid, x, baseY, 8, makeCell(MAT.SNOW)); // Base grande
  paintCircle(grid, x, baseY - 12, 6, makeCell(MAT.SNOW)); // Meio
  paintCircle(grid, x, baseY - 21, 4, makeCell(MAT.SNOW)); // Cabeça

  // Olhos (pedra)
  if (inBounds(grid, x - 2, baseY - 22)) {
    setXY(grid, x - 2, baseY - 22, makeCell(MAT.ROCK));
    markChunkActiveByXY(grid, x - 2, baseY - 22);
  }
  if (inBounds(grid, x + 2, baseY - 22)) {
    setXY(grid, x + 2, baseY - 22, makeCell(MAT.ROCK));
    markChunkActiveByXY(grid, x + 2, baseY - 22);
  }

  // Braços (madeira)
  for (let i = 1; i <= 6; i++) {
    if (inBounds(grid, x - 6 - i, baseY - 12 - i * 0.3 | 0)) {
      setXY(grid, x - 6 - i, baseY - 12 - i * 0.3 | 0, makeCell(MAT.WOOD));
      markChunkActiveByXY(grid, x - 6 - i, baseY - 12 - i * 0.3 | 0);
    }
    if (inBounds(grid, x + 6 + i, baseY - 12 - i * 0.3 | 0)) {
      setXY(grid, x + 6 + i, baseY - 12 - i * 0.3 | 0, makeCell(MAT.WOOD));
      markChunkActiveByXY(grid, x + 6 + i, baseY - 12 - i * 0.3 | 0);
    }
  }
}

/** Desenha nuvem no céu - BRANCA usando SNOW */
function drawSkyCloud(cx: number, cy: number, width: number): void {
  // Nuvem horizontal e achatada (como na referência)
  // Usa SNOW para cor branca
  const puffs = [
    { dx: 0, dy: 0, r: width * 0.2 },
    { dx: -width * 0.25, dy: 1, r: width * 0.18 },
    { dx: width * 0.25, dy: 1, r: width * 0.18 },
    { dx: -width * 0.45, dy: 2, r: width * 0.15 },
    { dx: width * 0.45, dy: 2, r: width * 0.15 },
    { dx: -width * 0.15, dy: -1, r: width * 0.15 },
    { dx: width * 0.15, dy: -1, r: width * 0.15 },
  ];

  for (const puff of puffs) {
    const px = cx + puff.dx | 0;
    const py = cy + puff.dy | 0;
    paintCircle(grid, px, py, puff.r | 0, makeCell(MAT.SNOW));
  }
}

/** Desenha faixa de nuvens no horizonte (como na referência) */
function drawHorizonClouds(startX: number, endX: number, baseY: number): void {
  // Faixa horizontal de nuvens brancas fofas
  for (let x = startX; x < endX; x += 3) {
    const height = 8 + rng.nextInt(6);
    const yOffset = (Math.sin(x * 0.05) * 4) | 0;
    
    for (let dy = 0; dy < height; dy++) {
      const width = height - dy * 0.5;
      const halfWidth = (width / 2) | 0;
      for (let dx = -halfWidth; dx < halfWidth; dx++) {
        const px = x + dx;
        const py = baseY + yOffset + dy;
        if (inBounds(grid, px, py)) {
          // Usa ICE para um tom levemente azulado (como sombra de nuvem)
          const mat = dy < height * 0.6 ? MAT.SNOW : MAT.ICE;
          setXY(grid, px, py, makeCell(mat));
          markChunkActiveByXY(grid, px, py);
        }
      }
    }
  }
}

// Função antiga mantida para compatibilidade
function drawTree(tx: number, ty: number): void {
  drawPineTree(tx, ty, 20);
}

// ============================================================================
// SIMULAÇÃO DE FÍSICA DOS MATERIAIS
// ============================================================================

/**
 * Troca dois pixels de lugar
 */
function swap(x1: number, y1: number, x2: number, y2: number): void {
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  setXY(grid, x2, y2, a);
  setXY(grid, x1, y1, b);
  markChunkActiveByXY(grid, x1, y1);
  markChunkActiveByXY(grid, x2, y2);
  markChunkDirtyByXY(grid, x1, y1);
  markChunkDirtyByXY(grid, x2, y2);
}

/**
 * Tenta mover para posição vazia ou através de gás
 */
function tryMove(x1: number, y1: number, x2: number, y2: number): boolean {
  if (!inBounds(grid, x2, y2)) return false;
  const b = getXY(grid, x2, y2);
  const matB = getMaterial(b);

  if (matB === MAT.EMPTY || IS_GAS[matB]) {
    swap(x1, y1, x2, y2);
    return true;
  }
  return false;
}

/**
 * Tenta mover baseado em densidade (material mais pesado afunda)
 */
function tryMoveByDensity(x1: number, y1: number, x2: number, y2: number): boolean {
  if (!inBounds(grid, x2, y2)) return false;
  const a = getXY(grid, x1, y1);
  const b = getXY(grid, x2, y2);
  const matA = getMaterial(a);
  const matB = getMaterial(b);

  // Não pode mover através de sólidos
  if (IS_SOLID[matB]) return false;

  const densA = DENSITY[matA] ?? 50;
  const densB = DENSITY[matB] ?? 50;

  // Material mais denso afunda
  if (densA > densB) {
    swap(x1, y1, x2, y2);
    return true;
  }
  return false;
}

/**
 * Tenta movimento horizontal de líquido considerando viscosidade
 */
function tryLiquidSpread(x1: number, y1: number, x2: number, y2: number, mat: number): boolean {
  if (!inBounds(grid, x2, y2)) return false;
  const b = getXY(grid, x2, y2);
  const matB = getMaterial(b);

  // Só pode se espalhar para vazio ou gás
  if (matB !== MAT.EMPTY && !IS_GAS[matB]) return false;

  const visc = VISCOSITY[mat] ?? 1;
  // Quanto maior viscosidade, menor chance de movimento
  if (rng.nextInt(visc * 2) > 0) return false;

  swap(x1, y1, x2, y2);
  return true;
}

/**
 * Verifica se uma posição tem suporte sólido (chão ou bloco sólido abaixo)
 */
function hasGroundSupport(x: number, y: number): boolean {
  if (!inBounds(grid, x, y + 1)) return true; // Fundo do mundo = suportado
  const below = getMaterial(getXY(grid, x, y + 1));
  return IS_SOLID[below] === true;
}

/**
 * Verifica se madeira está conectada ao chão através de outros blocos de madeira
 * Usa flood fill com limite para evitar travamento
 */
function isWoodGrounded(startX: number, startY: number): boolean {
  const key = startY * W + startX;
  if (treeGroundedCache.has(key)) {
    return treeGroundedCache.get(key)!;
  }

  const visited = new Set<number>();
  const stack: Array<[number, number]> = [[startX, startY]];
  const maxChecks = 200; // Limite para performance
  let checks = 0;

  while (stack.length > 0 && checks < maxChecks) {
    const pos = stack.pop()!;
    const [cx, cy] = pos;
    const ckey = cy * W + cx;

    if (visited.has(ckey)) continue;
    visited.add(ckey);
    checks++;

    // Verifica se chegou ao chão
    if (!inBounds(grid, cx, cy + 1)) {
      treeGroundedCache.set(key, true);
      return true;
    }

    const below = getMaterial(getXY(grid, cx, cy + 1));
    // Se tem suporte sólido que não é madeira/folha (ex: terra, pedra)
    if (IS_SOLID[below] && !IS_TREE_PART[below]) {
      treeGroundedCache.set(key, true);
      return true;
    }

    // Expande para blocos de madeira adjacentes (incluindo diagonal para baixo)
    const directions: Array<[number, number]> = [
      [0, 1],   // baixo
      [-1, 1],  // diagonal baixo-esquerda
      [1, 1],   // diagonal baixo-direita
      [-1, 0],  // esquerda
      [1, 0],   // direita
      [0, -1],  // cima (para subir tronco)
    ];

    for (const dir of directions) {
      const nx = cx + dir[0];
      const ny = cy + dir[1];
      if (!inBounds(grid, nx, ny)) continue;

      const nkey = ny * W + nx;
      if (visited.has(nkey)) continue;

      const nmat = getMaterial(getXY(grid, nx, ny));
      if (nmat === MAT.WOOD) {
        stack.push([nx, ny]);
      }
    }
  }

  treeGroundedCache.set(key, false);
  return false;
}

/**
 * Verifica se folha está conectada a madeira que está aterrada
 */
function isLeafSupported(x: number, y: number): boolean {
  // Verifica vizinhança para madeira
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;

      const mat = getMaterial(getXY(grid, nx, ny));
      if (mat === MAT.WOOD && isWoodGrounded(nx, ny)) {
        return true;
      }
      // Folha conectada a outra folha que está conectada a madeira
      if (mat === MAT.LEAF) {
        // Verificação simplificada - folha suportada se tiver folha/madeira abaixo
        const belowMat = getMaterial(getXY(grid, x, y + 1));
        if (belowMat === MAT.LEAF || belowMat === MAT.WOOD) {
          return true;
        }
      }
    }
  }

  // Também verifica se tem suporte sólido direto abaixo
  if (inBounds(grid, x, y + 1)) {
    const below = getMaterial(getXY(grid, x, y + 1));
    if (below === MAT.WOOD || below === MAT.LEAF || (IS_SOLID[below] && !IS_TREE_PART[below])) {
      return true;
    }
  }

  return false;
}

function stepSand(x: number, y: number): void {
  // Gravidade direta
  if (tryMoveByDensity(x, y, x, y + 1)) return;

  // Desliza diagonalmente
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (tryMoveByDensity(x, y, x + dir, y + 1)) return;
  if (tryMoveByDensity(x, y, x - dir, y + 1)) return;

  // Areia pode deslocar água lateralmente se "pressionada"
  const below = getMaterial(getXY(grid, x, y + 1));
  if (below === MAT.WATER) {
    // Afunda na água
    swap(x, y, x, y + 1);
  }
}

function stepWater(x: number, y: number): void {
  // 1. Gravidade - água sempre tenta cair
  if (tryMoveByDensity(x, y, x, y + 1)) return;

  // 2. Movimento diagonal para baixo
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (tryMoveByDensity(x, y, x + dir, y + 1)) return;
  if (tryMoveByDensity(x, y, x - dir, y + 1)) return;

  // 3. Simulação de pressão - água "empurra" lateralmente
  // Conta água acima para determinar pressão
  let pressure = 0;
  for (let py = y - 1; py >= Math.max(0, y - 10); py--) {
    if (getMaterial(getXY(grid, x, py)) === MAT.WATER) {
      pressure++;
    } else {
      break;
    }
  }

  // Quanto mais pressão, mais a água se espalha
  const spreadChance = Math.min(90, 30 + pressure * 10);
  if (rng.nextInt(100) < spreadChance) {
    // Tenta espalhar horizontalmente
    const spreadDir = rng.nextInt(2) === 0 ? -1 : 1;

    // Verifica se há espaço para espalhar
    for (let dist = 1; dist <= 2 + (pressure >> 1); dist++) {
      const nx = x + spreadDir * dist;
      if (!inBounds(grid, nx, y)) break;

      const matAt = getMaterial(getXY(grid, nx, y));
      if (matAt === MAT.EMPTY || IS_GAS[matAt]) {
        swap(x, y, nx, y);
        return;
      }
      if (IS_SOLID[matAt]) break;
    }

    // Tenta direção oposta
    for (let dist = 1; dist <= 2 + (pressure >> 1); dist++) {
      const nx = x - spreadDir * dist;
      if (!inBounds(grid, nx, y)) break;

      const matAt = getMaterial(getXY(grid, nx, y));
      if (matAt === MAT.EMPTY || IS_GAS[matAt]) {
        swap(x, y, nx, y);
        return;
      }
      if (IS_SOLID[matAt]) break;
    }
  }

  // 4. Água sob pressão pode subir se tiver caminho
  if (pressure > 5 && rng.nextInt(100) < 10) {
    // Procura saída lateral-superior
    for (const dx of [dir, -dir]) {
      if (inBounds(grid, x + dx, y - 1)) {
        const matSide = getMaterial(getXY(grid, x + dx, y));
        const matUp = getMaterial(getXY(grid, x + dx, y - 1));
        if ((matSide === MAT.EMPTY || IS_GAS[matSide]) &&
            (matUp === MAT.EMPTY || IS_GAS[matUp])) {
          swap(x, y, x + dx, y - 1);
          return;
        }
      }
    }
  }
}

function stepSmoke(x: number, y: number): void {
  // Dissipação gradual (mais rápido quanto mais alto)
  const dissipateChance = 1 + Math.max(0, (50 - y) >> 3);
  if (rng.nextInt(100) < dissipateChance) {
    setXY(grid, x, y, makeCell(MAT.EMPTY));
    markChunkActiveByXY(grid, x, y);
    return;
  }

  // Fumaça sobe com turbulência
  const turbulence = rng.nextInt(3) - 1; // -1, 0, ou 1

  // Movimento principal: subir
  if (tryMove(x, y, x + turbulence, y - 1)) return;
  if (tryMove(x, y, x, y - 1)) return;

  // Movimento lateral com drift
  const drift = rng.nextInt(5) - 2;
  if (drift !== 0 && tryMove(x, y, x + drift, y)) return;

  // Se bloqueado, tenta diagonal
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  tryMove(x, y, x + dir, y - 1);
}

function stepSteam(x: number, y: number): void {
  // 1. REGRA NOVA: Nuvens altas são estáveis (não somem, não viram água)
  if (y < 60) {
    // Apenas movimento suave de vento (drift)
    if (rng.nextInt(100) < 5) {
      const drift = rng.nextInt(3) - 1;
      tryMove(x, y, x + drift, y);
    }
    return;
  }

  // Lógica normal para vapor baixo (gerado por lava/fogo)

  // Dissipa se não estiver muito alto
  if (rng.nextInt(100) < 8) {
    setXY(grid, x, y, makeCell(MAT.EMPTY));
    markChunkActiveByXY(grid, x, y);
    return;
  }

  // Condensação (vira água)
  // Aumenta chance perto de gelo/neve
  let condensationChance = 2;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const nearMat = getMaterial(getXY(grid, x + dx, y + dy));
      if (nearMat === MAT.ICE || nearMat === MAT.SNOW) {
        condensationChance += 15;
      }
    }
  }

  if (rng.nextInt(100) < condensationChance) {
    setXY(grid, x, y, makeCell(MAT.WATER));
    markChunkActiveByXY(grid, x, y);
    return;
  }

  // Movimento ascendente
  if (tryMove(x, y, x, y - 1)) return;

  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (tryMove(x, y, x + dir, y - 1)) return;
  tryMove(x, y, x + dir, y);
}

function stepFire(x: number, y: number): void {
  // Conta combustível adjacente para determinar duração
  let fuelNearby = 0;
  let oxygenNearby = 0;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      if (!inBounds(grid, x + dx, y + dy)) continue;

      const nearMat = getMaterial(getXY(grid, x + dx, y + dy));
      if (FLAMMABLE[nearMat]) fuelNearby++;
      if (nearMat === MAT.EMPTY) oxygenNearby++;
    }
  }

  // Fogo morre sem oxigênio ou combustível
  const deathChance = oxygenNearby < 2 ? 40 : (fuelNearby === 0 ? 15 : 5);
  if (rng.nextInt(100) < deathChance) {
    // Vira fumaça ao morrer
    if (rng.nextInt(100) < 70) {
      setXY(grid, x, y, makeCell(MAT.SMOKE));
    } else {
      setXY(grid, x, y, makeCell(MAT.EMPTY));
    }
    markChunkActiveByXY(grid, x, y);
    return;
  }

  // Propaga fogo para materiais inflamáveis
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;

      const mat = getMaterial(getXY(grid, nx, ny));
      const flammability = FLAMMABLE[mat] ?? 0;

      if (flammability > 0 && rng.nextInt(100) < flammability) {
        setXY(grid, nx, ny, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, nx, ny);
      } else if (mat === MAT.WATER) {
        // Água apaga fogo e vira vapor
        setXY(grid, x, y, makeCell(MAT.STEAM));
        if (rng.nextInt(100) < 50) {
          setXY(grid, nx, ny, makeCell(MAT.STEAM));
          markChunkActiveByXY(grid, nx, ny);
        }
        markChunkActiveByXY(grid, x, y);
        return;
      } else if (mat === MAT.ICE) {
        setXY(grid, nx, ny, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, nx, ny);
      } else if (mat === MAT.SNOW) {
        setXY(grid, nx, ny, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, nx, ny);
      }
    }
  }

  // Fogo sobe naturalmente (convecção)
  // Movimento errático para simular chamas
  const flicker = rng.nextInt(3) - 1;
  if (rng.nextInt(100) < 70) {
    if (tryMove(x, y, x + flicker, y - 1)) return;
  }
  if (tryMove(x, y, x, y - 1)) return;

  // Pode se mover lateralmente
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  tryMove(x, y, x + dir, y - 1);
}

function stepLava(x: number, y: number): void {
  // Interações térmicas com materiais adjacentes
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;

      const mat = getMaterial(getXY(grid, nx, ny));

      if (mat === MAT.WATER) {
        // Água + Lava = Vapor + chance de virar pedra
        setXY(grid, nx, ny, makeCell(MAT.STEAM));
        markChunkActiveByXY(grid, nx, ny);
        // Lava esfria e vira pedra
        if (rng.nextInt(100) < 40) {
          setXY(grid, x, y, makeCell(MAT.ROCK));
          markChunkActiveByXY(grid, x, y);
          return;
        }
      } else if (mat === MAT.ICE) {
        // Derrete gelo instantaneamente
        setXY(grid, nx, ny, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, nx, ny);
      } else if (mat === MAT.SNOW) {
        setXY(grid, nx, ny, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, nx, ny);
      } else if (FLAMMABLE[mat] && rng.nextInt(100) < 25) {
        // Incendeia materiais inflamáveis
        setXY(grid, nx, ny, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, nx, ny);
      }
    }
  }

  // Lava é muito viscosa - move devagar
  // Só processa movimento às vezes
  if (rng.nextInt(VISCOSITY[MAT.LAVA] ?? 8) > 0) return;

  // Gravidade - lava cai
  if (tryMoveByDensity(x, y, x, y + 1)) return;

  // Movimento diagonal lento
  const dir = rng.nextInt(2) === 0 ? -1 : 1;
  if (tryMoveByDensity(x, y, x + dir, y + 1)) return;

  // Espalha lateralmente (muito devagar)
  if (rng.nextInt(100) < 15) {
    if (tryLiquidSpread(x, y, x + dir, y, MAT.LAVA)) return;
    tryLiquidSpread(x, y, x - dir, y, MAT.LAVA);
  }
}

function stepSnow(x: number, y: number): void {
  // NUVENS: Neve no alto do céu (y < 90) fica estática
  if (y < 90) {
    // Apenas leve drift de vento
    if (rng.nextInt(100) < 2) {
      const drift = rng.nextInt(3) - 1;
      tryMove(x, y, x + drift, y);
    }
    return;
  }

  // Verifica calor próximo
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const mat = getMaterial(getXY(grid, x + dx, y + dy));
      if (mat === MAT.FIRE || mat === MAT.LAVA) {
        setXY(grid, x, y, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, x, y);
        return;
      }
    }
  }

  // Neve cai muito devagar (flutua)
  if (rng.nextInt(100) < 30) {
    // Movimento descendente com drift lateral
    const drift = rng.nextInt(3) - 1;
    if (tryMove(x, y, x + drift, y + 1)) return;
    if (tryMove(x, y, x, y + 1)) return;

    // Desliza diagonal
    const dir = rng.nextInt(2) === 0 ? -1 : 1;
    tryMove(x, y, x + dir, y + 1);
  }

  // Neve comprime em gelo sob pressão
  let snowAbove = 0;
  for (let py = y - 1; py >= Math.max(0, y - 8); py--) {
    if (getMaterial(getXY(grid, x, py)) === MAT.SNOW) {
      snowAbove++;
    } else {
      break;
    }
  }

  // Muita neve em cima -> vira gelo
  if (snowAbove >= 6 && rng.nextInt(100) < 5) {
    setXY(grid, x, y, makeCell(MAT.ICE));
    markChunkActiveByXY(grid, x, y);
  }
}

function stepLeaf(x: number, y: number): void {
  // Verifica se está pegando fogo (propagação)
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const mat = getMaterial(getXY(grid, x + dx, y + dy));
      if (mat === MAT.FIRE && rng.nextInt(100) < 12) {
        setXY(grid, x, y, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, x, y);
        return;
      }
    }
  }

  // Verifica se a folha está conectada a uma árvore aterrada
  const supported = isLeafSupported(x, y);

  if (!supported) {
    // Folha sem suporte cai com física de "flutuar"
    if (rng.nextInt(100) < 40) {
      // Movimento descendente com drift lateral (simula vento)
      const drift = rng.nextInt(5) - 2; // -2 a 2
      if (drift !== 0 && tryMove(x, y, x + drift, y + 1)) return;
      if (tryMove(x, y, x, y + 1)) return;

      // Diagonal
      const dir = rng.nextInt(2) === 0 ? -1 : 1;
      if (tryMove(x, y, x + dir, y + 1)) return;

      // Flutua lateralmente às vezes
      if (rng.nextInt(100) < 20) {
        const windDir = rng.nextInt(2) === 0 ? -1 : 1;
        tryMove(x, y, x + windDir, y);
      }
    }
  }
}

function stepWood(x: number, y: number): void {
  // Verifica se está pegando fogo
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const mat = getMaterial(getXY(grid, x + dx, y + dy));
      if (mat === MAT.FIRE && rng.nextInt(100) < 5) {
        setXY(grid, x, y, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, x, y);
        return;
      }
      if (mat === MAT.LAVA && rng.nextInt(100) < 15) {
        setXY(grid, x, y, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, x, y);
        return;
      }
    }
  }

  // Verifica se a madeira está aterrada (conectada ao chão)
  const grounded = isWoodGrounded(x, y);

  if (!grounded) {
    // Madeira sem suporte cai como bloco sólido
    // Cai mais devagar que areia
    if (rng.nextInt(100) < 60) {
      if (tryMove(x, y, x, y + 1)) return;

      // Pode deslizar diagonalmente se bloqueado
      const dir = rng.nextInt(2) === 0 ? -1 : 1;
      if (tryMove(x, y, x + dir, y + 1)) return;
    }
  }
}

function stepRock(x: number, y: number): void {
  // Verifica se tem suporte abaixo
  if (!inBounds(grid, x, y + 1)) return; // Fundo do mundo

  const below = getMaterial(getXY(grid, x, y + 1));

  // Se não tem suporte sólido, a pedra cai
  if (!IS_SOLID[below] && below !== MAT.LAVA) {
    // Pedra cai devagar (é pesada)
    if (rng.nextInt(100) < 40) {
      if (tryMove(x, y, x, y + 1)) return;

      // Pode rolar se bloqueado
      const dir = rng.nextInt(2) === 0 ? -1 : 1;
      if (tryMove(x, y, x + dir, y + 1)) return;
      tryMove(x, y, x - dir, y + 1);
    }
  }
}

function stepIce(x: number, y: number): void {
  // Gelo derrete com calor
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const mat = getMaterial(getXY(grid, x + dx, y + dy));
      if (mat === MAT.FIRE) {
        setXY(grid, x, y, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, x, y);
        return;
      }
      if (mat === MAT.LAVA) {
        setXY(grid, x, y, makeCell(MAT.WATER));
        markChunkActiveByXY(grid, x, y);
        return;
      }
    }
  }
}

function stepGrass(x: number, y: number): void {
  // Grama pode pegar fogo
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!inBounds(grid, x + dx, y + dy)) continue;
      const mat = getMaterial(getXY(grid, x + dx, y + dy));
      if ((mat === MAT.FIRE || mat === MAT.LAVA) && rng.nextInt(100) < 10) {
        setXY(grid, x, y, makeCell(MAT.FIRE));
        markChunkActiveByXY(grid, x, y);
        return;
      }
    }
  }
}

const perCell = (i: number, x: number, y: number): void => {
  const cell = grid.cells[i] ?? 0;
  const mat = getMaterial(cell);

  switch (mat) {
    case MAT.SAND:
    case MAT.DIRT:
      stepSand(x, y);
      break;
    case MAT.WATER:
      stepWater(x, y);
      break;
    case MAT.SMOKE:
      stepSmoke(x, y);
      break;
    case MAT.STEAM:
      stepSteam(x, y);
      break;
    case MAT.FIRE:
      stepFire(x, y);
      break;
    case MAT.LAVA:
      stepLava(x, y);
      break;
    case MAT.SNOW:
      stepSnow(x, y);
      break;
    case MAT.LEAF:
      stepLeaf(x, y);
      break;
    case MAT.WOOD:
      stepWood(x, y);
      break;
    case MAT.ROCK:
      stepRock(x, y);
      break;
    case MAT.ICE:
      stepIce(x, y);
      break;
    case MAT.GRASS:
      stepGrass(x, y);
      break;
  }
};

// ============================================================================
// JOGADOR E FLECHAS
// ============================================================================

function isSolid(x: number, y: number): boolean {
  if (!inBounds(grid, x, y)) return true;
  const mat = getMaterial(getXY(grid, x, y));
  return IS_SOLID[mat] === true;
}

function updatePlayer(): void {
  const speed = 1.5;
  const gravity = 0.3;
  const jumpForce = -5;

  // Input horizontal
  if (keys["ArrowLeft"] || keys["KeyA"]) {
    player.vx = -speed;
    player.facingRight = false;
  } else if (keys["ArrowRight"] || keys["KeyD"]) {
    player.vx = speed;
    player.facingRight = true;
  } else {
    player.vx *= 0.8;
  }

  // Gravidade
  player.vy += gravity;
  if (player.vy > 8) player.vy = 8;

  // Pulo
  if ((keys["ArrowUp"] || keys["KeyW"] || keys["Space"]) && player.onGround) {
    player.vy = jumpForce;
    player.onGround = false;
  }

  // Movimento horizontal com colisão
  const nextX = player.x + player.vx;
  const checkX = nextX + (player.vx > 0 ? 3 : -3);
  if (!isSolid(checkX | 0, player.y | 0) && !isSolid(checkX | 0, (player.y - 4) | 0)) {
    player.x = nextX;
  } else {
    player.vx = 0;
  }

  // Movimento vertical com colisão
  const nextY = player.y + player.vy;
  player.onGround = false;

  if (player.vy > 0) {
    // Caindo
    if (isSolid(player.x | 0, (nextY + 1) | 0)) {
      player.y = nextY | 0;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.y = nextY;
    }
  } else {
    // Subindo
    if (isSolid(player.x | 0, (nextY - 6) | 0)) {
      player.vy = 0;
    } else {
      player.y = nextY;
    }
  }

  // Limites do mundo
  player.x = Math.max(5, Math.min(W - 5, player.x));
  player.y = Math.max(10, Math.min(H - 5, player.y));
}

function shootArrow(): void {
  const dx = mouseX - player.x;
  const dy = mouseY - player.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const speed = 8;
  arrows.push({
    x: player.x,
    y: player.y - 2,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    life: 200
  });
}

function updateArrows(): void {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const arrow = arrows[i]!;
    arrow.vy += 0.15; // Gravidade
    arrow.x += arrow.vx;
    arrow.y += arrow.vy;
    arrow.life--;

    const ax = arrow.x | 0;
    const ay = arrow.y | 0;

    if (!inBounds(grid, ax, ay)) {
      arrows.splice(i, 1);
      continue;
    }

    // Colisão com terreno
    const mat = getMaterial(getXY(grid, ax, ay));

    // Flecha atravessa e destrói folhas/grama
    if (mat === MAT.LEAF || mat === MAT.GRASS) {
      setXY(grid, ax, ay, makeCell(MAT.EMPTY));
      markChunkActiveByXY(grid, ax, ay);
      continue;
    }

    // Flecha ateia fogo em madeira
    if (mat === MAT.WOOD && rng.nextInt(100) < 30) {
      setXY(grid, ax, ay, makeCell(MAT.FIRE));
      markChunkActiveByXY(grid, ax, ay);
      arrows.splice(i, 1);
      continue;
    }

    if (IS_SOLID[mat] || mat === MAT.WATER) {
      arrows.splice(i, 1);
      continue;
    }

    // Remove se tempo esgotado
    if (arrow.life <= 0) {
      arrows.splice(i, 1);
    }
  }
}

function drawPlayer(): void {
  const px = player.x | 0;
  const py = player.y | 0;

  // Corpo
  const skinColor = packRGBA(255, 200, 150, 255);
  const bodyColor = packRGBA(100, 100, 200, 255);

  // Cabeça
  for (let dy = -5; dy <= -3; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const idx = (py + dy) * W + (px + dx);
      if (idx >= 0 && idx < surface.pixels.length) {
        surface.pixels[idx] = skinColor;
      }
    }
  }

  // Corpo
  for (let dy = -2; dy <= 0; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const idx = (py + dy) * W + (px + dx);
      if (idx >= 0 && idx < surface.pixels.length) {
        surface.pixels[idx] = bodyColor;
      }
    }
  }

  // Olho
  const eyeX = px + (player.facingRight ? 1 : -1);
  const eyeIdx = (py - 4) * W + eyeX;
  if (eyeIdx >= 0 && eyeIdx < surface.pixels.length) {
    surface.pixels[eyeIdx] = packRGBA(0, 0, 0, 255);
  }
}

function drawArrows(): void {
  const color = packRGBA(139, 69, 19, 255);
  const tipColor = packRGBA(80, 80, 80, 255);

  for (const arrow of arrows) {
    // Corpo da flecha
    const len = Math.sqrt(arrow.vx * arrow.vx + arrow.vy * arrow.vy);
    const dx = arrow.vx / len;
    const dy = arrow.vy / len;

    for (let t = 0; t < 4; t++) {
      const px = (arrow.x - dx * t) | 0;
      const py = (arrow.y - dy * t) | 0;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        surface.pixels[py * W + px] = t === 0 ? tipColor : color;
      }
    }
  }
}

// ============================================================================
// INPUT
// ============================================================================

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = ((e.clientX - rect.left) / SCALE) | 0;
  mouseY = ((e.clientY - rect.top) / SCALE) | 0;
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    mouseDown = true;
    if (!shiftDown) {
      shootArrow();
    }
  }
  if (e.button === 2) rightMouseDown = true;
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) rightMouseDown = false;
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;

  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    shiftDown = true;
  }

  // Atirar flecha com F
  if (e.code === "KeyF") {
    shootArrow();
  }

  // Trocar material com números
  const matKeys: Record<string, MaterialType> = {
    Digit1: MAT.SAND,
    Digit2: MAT.WATER,
    Digit3: MAT.ROCK,
    Digit4: MAT.DIRT,
    Digit5: MAT.FIRE,
    Digit6: MAT.LAVA,
    Digit7: MAT.SNOW,
    Digit8: MAT.WOOD,
    Digit9: MAT.LEAF,
    Digit0: MAT.EMPTY
  };

  if (matKeys[e.code] !== undefined) {
    selectedMaterial = matKeys[e.code]!;
    updateUI();
  }
});

document.addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    shiftDown = false;
  }
});

// ============================================================================
// UI
// ============================================================================

const materialNames: Record<number, string> = {
  [MAT.EMPTY]: "Apagar (0)",
  [MAT.SAND]: "Areia (1)",
  [MAT.WATER]: "Água (2)",
  [MAT.ROCK]: "Pedra (3)",
  [MAT.DIRT]: "Terra (4)",
  [MAT.FIRE]: "Fogo (5)",
  [MAT.LAVA]: "Lava (6)",
  [MAT.SNOW]: "Neve (7)",
  [MAT.WOOD]: "Madeira (8)",
  [MAT.LEAF]: "Folha (9)"
};

function updateUI(): void {
  const matEl = document.getElementById("mat");
  if (matEl) {
    matEl.textContent = `Material: ${materialNames[selectedMaterial] ?? "?"}`;
  }
}

// ============================================================================
// GAME LOOP
// ============================================================================

let last = performance.now();
let frames = 0;
let acc = 0;
const fpsEl = document.getElementById("fps");

function tick(): void {
  // Limpa cache de árvore a cada frame
  treeCheckFrame++;
  if (treeCheckFrame % 2 === 0) {
    treeGroundedCache.clear();
  }

  // Pintar com mouse (shift + clique esquerdo)
  if (mouseDown && shiftDown) {
    paintCircle(grid, mouseX, mouseY, 3, makeCell(selectedMaterial));
  }

  // Apagar com clique direito
  if (rightMouseDown) {
    paintCircle(grid, mouseX, mouseY, 5, makeCell(MAT.EMPTY));
  }

  // Atualizar física
  stepActiveChunks(grid, "bottom-up", perCell);

  // Atualizar jogador e flechas
  updatePlayer();
  updateArrows();

  // Atualiza cache de superfície a cada 5 frames (performance)
  surfaceCacheFrame++;
  if (surfaceCacheFrame % 5 === 0) {
    updateSurfaceHeightCache();
  }

  // Render com shader de profundidade
  renderToSurfaceShaded(grid, surface, palette, depthShader);
  drawPlayer();
  drawArrows();

  // Crosshair
  if (mouseX >= 0 && mouseX < W && mouseY >= 0 && mouseY < H) {
    const cx = mouseX;
    const cy = mouseY;
    const crossColor = packRGBA(255, 255, 255, 200);
    for (let d = -2; d <= 2; d++) {
      if (cx + d >= 0 && cx + d < W && d !== 0) {
        surface.pixels[cy * W + (cx + d)] = crossColor;
      }
      if (cy + d >= 0 && cy + d < H && d !== 0) {
        surface.pixels[(cy + d) * W + cx] = crossColor;
      }
    }
  }

  presentToCanvas(ctx, surface);

  // FPS
  const now = performance.now();
  frames++;
  acc += now - last;
  last = now;
  if (fpsEl && acc >= 500) {
    const fps = Math.round((frames * 1000) / acc);
    fpsEl.textContent = `FPS: ${fps}`;
    frames = 0;
    acc = 0;
  }

  requestAnimationFrame(tick);
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

generateTerrain();
updateUI();
requestAnimationFrame(tick);
