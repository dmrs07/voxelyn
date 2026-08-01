import { RNG } from '@voxelyn/core';
import {
  CHUNK,
  SOLID_CRYSTAL,
  SOLID_FRAGILE,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_EMBER,
  SURF_FUNGAL,
  SURF_ICE,
  SURF_NONE,
  SURF_SCORCHED,
  SURF_WATER,
  WORLD_W,
} from './constants.js';
import type { Vec2 } from './types.js';

export type GeneratedSalvageSite = { id: number; tier: 1 | 2 | 3; terminal: Vec2; cache: Vec2 };

export type SurfaceBlobSpec = { count: number; rMin: number; rMax: number };

/**
 * O que um ESTRATO muda na geracao. Ver strata.ts para quem constroi isto.
 *
 * O worldgen continua dono da TOPOLOGIA (ruido, automato, alcancabilidade,
 * bandas de salvage): ela e a parte provada do gerador e a que garante mapa
 * solucionavel. O perfil so muda MATERIA — que solido decora as paredes, que
 * superficie cobre o chao — porque materia e o que os estratos da primeira
 * leva realmente variam. Quando um estrato precisar de topologia propria
 * (a organizacao radial da Catedral, os pulmoes da Fenda Sulfurosa), o campo
 * novo entra aqui com um default que preserve o comportamento historico.
 */
export type WorldgenProfile = {
  /** Chance de parede FINA (aberta dos dois lados) virar rocha fragil. */
  fragileThinChance: number;
  /** Chance de parede exposta virar veio de minerio. */
  oreChance: number;
  /** Chance de parede exposta virar cristal (avaliada depois do minerio). */
  crystalChance: number;
  /**
   * Nervuras de cristal: caminhadas retas que atravessam a rocha convertendo
   * celulas solidas em cristal. Sao a arquitetura da Catedral Prismatica —
   * laminas continuas que conduzem ressonancia de uma sala a outra, em vez do
   * cristal pontual que a decoracao de parede produz.
   */
  crystalVeins: number;
  fungalBlobs: SurfaceBlobSpec;
  biofluidBlobs: SurfaceBlobSpec;
  /** Lagos do Aquifero Negro. Zero em todo estrato seco. */
  waterBlobs: SurfaceBlobSpec;
  /** Lagos congelados da Cripta Glacial. */
  iceBlobs: SurfaceBlobSpec;
  /** Fissuras incandescentes da Fornalha Abissal. */
  emberBlobs: SurfaceBlobSpec;
  /** Campos de carvao da Fornalha (SURF_SCORCHED que acende la). */
  coalBlobs: SurfaceBlobSpec;
  /** Quantos respiradouros de gas o setor tenta posicionar. */
  ventCount: number;
  /** Teto de Miners do setor; a Cicatriz Aurix sobe isso. */
  minerCap: number;
};

/** O perfil historico: Galerias de Basalto. `generateWorld` sem perfil e ele. */
export const DEFAULT_PROFILE: WorldgenProfile = {
  fragileThinChance: 0.55,
  oreChance: 0.07,
  crystalChance: 0.03,
  crystalVeins: 0,
  fungalBlobs: { count: 26, rMin: 2, rMax: 4 },
  biofluidBlobs: { count: 12, rMin: 1, rMax: 3 },
  waterBlobs: { count: 0, rMin: 0, rMax: 0 },
  iceBlobs: { count: 0, rMin: 0, rMax: 0 },
  emberBlobs: { count: 0, rMin: 0, rMax: 0 },
  coalBlobs: { count: 0, rMin: 0, rMax: 0 },
  ventCount: 6,
  minerCap: 3,
};

export type GeneratedWorld = {
  solid: Uint8Array;
  surface: Uint8Array;
  entry: Vec2;
  corePos: Vec2;
  guardianSpawn: Vec2;
  salvageSites: GeneratedSalvageSite[];
  ventPositions: Vec2[];
  enemySpawns: Vec2[];
  openCells: number[];
};

const idx = (w: number, x: number, y: number): number => y * w + x;

const countWallNeighbors = (solid: Uint8Array, w: number, h: number, x: number, y: number): number => {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        count++;
      } else if (solid[idx(w, nx, ny)] !== SOLID_NONE) {
        count++;
      }
    }
  }
  return count;
};

/** Flood fill a partir de (sx,sy); retorna indices alcancaveis. */
export const floodOpen = (solid: Uint8Array, w: number, h: number, sx: number, sy: number): Set<number> => {
  const seen = new Set<number>();
  const start = idx(w, sx, sy);
  if (solid[start] !== SOLID_NONE) return seen;
  const stack = [start];
  seen.add(start);
  while (stack.length > 0) {
    const cur = stack.pop() as number;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(w, nx, ny);
      if (seen.has(ni) || solid[ni] !== SOLID_NONE) continue;
      seen.add(ni);
      stack.push(ni);
    }
  }
  return seen;
};

const bfsFarthest = (
  solid: Uint8Array,
  w: number,
  h: number,
  from: Vec2
): { cell: Vec2; dist: Int32Array } => {
  const dist = new Int32Array(w * h).fill(-1);
  const queue: number[] = [idx(w, from.x, from.y)];
  dist[queue[0]] = 0;
  let far = queue[0];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (dist[cur] > dist[far]) far = cur;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
    const valid = [cx > 0, cx < w - 1, cy > 0, cy < h - 1];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      const ni = neighbors[k];
      if (dist[ni] !== -1 || solid[ni] !== SOLID_NONE) continue;
      dist[ni] = dist[cur] + 1;
      queue.push(ni);
    }
  }
  return { cell: { x: far % w, y: Math.floor(far / w) }, dist };
};

const carveBlob = (solid: Uint8Array, w: number, h: number, cx: number, cy: number, r: number): void => {
  for (let y = Math.max(1, cy - r); y <= Math.min(h - 2, cy + r); y++) {
    for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) solid[idx(w, x, y)] = SOLID_NONE;
    }
  }
};

const generateAttempt = (
  seed: number,
  w: number,
  h: number,
  profile: WorldgenProfile
): GeneratedWorld | null => {
  const rng = new RNG(seed >>> 0 || 1);
  const solid = new Uint8Array(w * h).fill(SOLID_ROCK);
  const surface = new Uint8Array(w * h).fill(SURF_NONE);

  // 1) ruido inicial
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (rng.nextFloat01() > 0.44) solid[idx(w, x, y)] = SOLID_NONE;
    }
  }

  // 2) automato celular
  for (let it = 0; it < 4; it++) {
    const next = new Uint8Array(solid);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const walls = countWallNeighbors(solid, w, h, x, y);
        const i = idx(w, x, y);
        if (walls >= 5) next[i] = SOLID_ROCK;
        else if (walls <= 3) next[i] = SOLID_NONE;
      }
    }
    solid.set(next);
  }

  // 3) entrada perto da borda superior-esquerda, nucleo no ponto mais distante
  let entry: Vec2 | null = null;
  outer: for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (solid[idx(w, x, y)] === SOLID_NONE) {
        entry = { x, y };
        break outer;
      }
    }
  }
  if (!entry) return null;
  carveBlob(solid, w, h, entry.x, entry.y, 3);

  const open = floodOpen(solid, w, h, entry.x, entry.y);
  if (open.size < w * h * 0.28) return null;

  // celulas fora da regiao principal viram parede (evita bolsoes inalcancaveis enganosos)
  for (let i = 0; i < solid.length; i++) {
    if (solid[i] === SOLID_NONE && !open.has(i)) solid[i] = SOLID_ROCK;
  }

  const { cell: corePos, dist } = bfsFarthest(solid, w, h, entry);
  if (dist[idx(w, corePos.x, corePos.y)] < Math.floor((w + h) * 0.55)) return null;
  carveBlob(solid, w, h, corePos.x, corePos.y, 4);

  const openCells: number[] = [];
  const reOpen = floodOpen(solid, w, h, entry.x, entry.y);
  for (const i of reOpen) openCells.push(i);
  openCells.sort((a, b) => a - b);

  const distFromEntry = bfsFarthest(solid, w, h, entry).dist;

  const isOpen = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h && solid[idx(w, x, y)] === SOLID_NONE;

  // O Guardian ocupa quase 1,5 tile de diametro. Centro aberto nao basta:
  // os quatro cantos do corpo tambem precisam cair em chao livre. Uma
  // vizinhanca 3x3 aberta e uma garantia simples, deterministica e mais
  // forte que a colisao real de raio 0,68.
  const hasGuardianClearance = (x: number, y: number): boolean => {
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return false;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!isOpen(x + ox, y + oy)) return false;
      }
    }
    return true;
  };
  const guardianOffsets = [
    [3, 0], [-3, 0], [0, 3], [0, -3],
    [2, 2], [-2, 2], [2, -2], [-2, -2],
  ] as const;
  let guardianSpawn: Vec2 | null = null;
  for (const [dx, dy] of guardianOffsets) {
    const x = corePos.x + dx;
    const y = corePos.y + dy;
    if (!hasGuardianClearance(x, y)) continue;
    guardianSpawn = { x, y };
    break;
  }
  // Esta tentativa de mapa nao oferece uma arena fisicamente valida.
  // A geracao limitada tentara outra seed derivada em vez de criar um boss preso.
  if (!guardianSpawn) return null;

  // 4) decorar paredes adjacentes a areas abertas: minerio, rocha fragil, cristais
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(w, x, y);
      if (solid[i] !== SOLID_ROCK) continue;
      const touchesOpen = isOpen(x - 1, y) || isOpen(x + 1, y) || isOpen(x, y - 1) || isOpen(x, y + 1);
      if (!touchesOpen) continue;
      const roll = rng.nextFloat01();
      // parede fina (aberto dos dois lados) tem chance alta de ser fragil
      const thinH = isOpen(x - 1, y) && isOpen(x + 1, y);
      const thinV = isOpen(x, y - 1) && isOpen(x, y + 1);
      if ((thinH || thinV) && roll < profile.fragileThinChance) solid[i] = SOLID_FRAGILE;
      else if (roll < profile.oreChance) solid[i] = SOLID_ORE;
      else if (roll < profile.oreChance + profile.crystalChance) solid[i] = SOLID_CRYSTAL;
    }
  }

  // 4b) nervuras de cristal (Catedral Prismatica): caminhadas retas que
  // atravessam a rocha. Diferem da decoracao pontual em UMA propriedade que
  // importa: sao CONTINUAS, entao a ressonancia (floodFrom sobre cristal)
  // viaja por elas de sala em sala — e a lamina translucida que separa dois
  // corredores e uma parede que o jogador pode escolher transformar em arma.
  // Só rocha comum vira cristal: minerio e fragil ja tem papel proprio.
  for (let vein = 0; vein < profile.crystalVeins; vein++) {
    const cell = openCells[rng.nextInt(openCells.length)];
    const anchor = { x: cell % w, y: Math.floor(cell / w) };
    const angle = (rng.nextInt(8) * Math.PI) / 4;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const length = 8 + rng.nextInt(10);
    let fx = anchor.x + 0.5;
    let fy = anchor.y + 0.5;
    for (let step = 0; step < length; step++) {
      fx += dirX;
      fy += dirY;
      const x = Math.floor(fx);
      const y = Math.floor(fy);
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) break;
      const i = idx(w, x, y);
      if (solid[i] === SOLID_ROCK) solid[i] = SOLID_CRYSTAL;
    }
  }

  // 5) superficies: manchas fungicas e pocas de biofluido
  const openArr = openCells;
  const blobSurface = (surfKind: number, count: number, rMin: number, rMax: number): void => {
    for (let b = 0; b < count; b++) {
      const seedCell = openArr[rng.nextInt(openArr.length)];
      const cx = seedCell % w;
      const cy = Math.floor(seedCell / w);
      const r = rMin + rng.nextInt(rMax - rMin + 1);
      for (let y = Math.max(1, cy - r); y <= Math.min(h - 2, cy + r); y++) {
        for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy > r * r) continue;
          const i = idx(w, x, y);
          if (solid[i] !== SOLID_NONE) continue;
          if (surface[i] === SURF_NONE && rng.nextFloat01() < 0.82) surface[i] = surfKind;
        }
      }
    }
  };
  // Agua antes das outras materias: pintado-primeiro vence (as manchas checam
  // SURF_NONE), e no Aquifero o lago e a geografia — fungo e biofluido crescem
  // nas MARGENS dele, nunca por cima. Com count 0 nada e sorteado, entao o
  // basalto historico consome exatamente a mesma sequencia de RNG de sempre.
  blobSurface(SURF_WATER, profile.waterBlobs.count, profile.waterBlobs.rMin, profile.waterBlobs.rMax);
  blobSurface(SURF_ICE, profile.iceBlobs.count, profile.iceBlobs.rMin, profile.iceBlobs.rMax);
  blobSurface(SURF_EMBER, profile.emberBlobs.count, profile.emberBlobs.rMin, profile.emberBlobs.rMax);
  blobSurface(SURF_SCORCHED, profile.coalBlobs.count, profile.coalBlobs.rMin, profile.coalBlobs.rMax);
  blobSurface(SURF_FUNGAL, profile.fungalBlobs.count, profile.fungalBlobs.rMin, profile.fungalBlobs.rMax);
  blobSurface(SURF_BIOFLUID, profile.biofluidBlobs.count, profile.biofluidBlobs.rMin, profile.biofluidBlobs.rMax);

  // area de entrada limpa (jogador nao nasce em material perigoso)
  for (let y = entry.y - 2; y <= entry.y + 2; y++) {
    for (let x = entry.x - 2; x <= entry.x + 2; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      surface[idx(w, x, y)] = SURF_NONE;
    }
  }
  // pedestal do nucleo limpo
  for (let y = corePos.y - 1; y <= corePos.y + 1; y++) {
    for (let x = corePos.x - 1; x <= corePos.x + 1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      surface[idx(w, x, y)] = SURF_NONE;
    }
  }
  // O boss tambem nao nasce sobre fungo, biofluido ou outro hazard.
  for (let y = guardianSpawn.y - 1; y <= guardianSpawn.y + 1; y++) {
    for (let x = guardianSpawn.x - 1; x <= guardianSpawn.x + 1; x++) {
      surface[idx(w, x, y)] = SURF_NONE;
    }
  }

  // 6) pontos de interesse sobre celulas abertas e distantes da entrada
  const pickOpenFar = (minDist: number, minGap: number, taken: Vec2[]): Vec2 | null => {
    for (let attempts = 0; attempts < 400; attempts++) {
      const cell = openArr[rng.nextInt(openArr.length)];
      const x = cell % w;
      const y = Math.floor(cell / w);
      if (distFromEntry[cell] < minDist) continue;
      let ok = true;
      for (const t of taken) {
        const dx = t.x - x;
        const dy = t.y - y;
        if (dx * dx + dy * dy < minGap * minGap) {
          ok = false;
          break;
        }
      }
      if (ok) return { x, y };
    }
    return null;
  };

  const maxPath = distFromEntry[idx(w, corePos.x, corePos.y)];
  const reserved: Vec2[] = [entry, corePos, guardianSpawn];
  const bands: Array<{ min: number; max: number; tier: 1 | 2 | 3; optional?: boolean }> = [
    { min: 0.20, max: 0.35, tier: 1 },
    { min: 0.40, max: 0.60, tier: 1 },
    { min: 0.65, max: 0.80, tier: 2 },
    { min: 0.82, max: 0.95, tier: 3, optional: true },
  ];

  const chooseBandCell = (minRatio: number, maxRatio: number, taken: Vec2[]): Vec2 | null => {
    const candidates = openArr.filter((cell) => {
      const d = distFromEntry[cell];
      if (d < Math.ceil(maxPath * minRatio) || d > Math.floor(maxPath * maxRatio)) return false;
      const x = cell % w;
      const y = Math.floor(cell / w);
      if (Math.hypot(x - entry.x, y - entry.y) < 7) return false;
      if (Math.hypot(x - corePos.x, y - corePos.y) < 6) return false;
      return taken.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= 9 * 9);
    });
    if (candidates.length === 0) return null;
    const cell = candidates[rng.nextInt(candidates.length)];
    return { x: cell % w, y: Math.floor(cell / w) };
  };

  const chooseCacheForTerminal = (terminal: Vec2, taken: Vec2[]): Vec2 | null => {
    const terminalDist = distFromEntry[idx(w, terminal.x, terminal.y)];
    const candidates = openArr.filter((cell) => {
      const x = cell % w;
      const y = Math.floor(cell / w);
      const path = distFromEntry[cell];
      const euclideanSq = (x - terminal.x) ** 2 + (y - terminal.y) ** 2;
      if (path < terminalDist + 3 || path > terminalDist + Math.max(8, Math.floor(maxPath * 0.12))) return false;
      if (euclideanSq < 5 * 5 || euclideanSq > 15 * 15) return false;
      if (Math.hypot(x - corePos.x, y - corePos.y) < 5) return false;
      return taken.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= 6 * 6);
    });
    if (candidates.length === 0) return null;
    const cell = candidates[rng.nextInt(candidates.length)];
    return { x: cell % w, y: Math.floor(cell / w) };
  };

  const salvageSites: GeneratedSalvageSite[] = [];
  for (let siteId = 0; siteId < bands.length; siteId++) {
    const band = bands[siteId];
    const terminal = chooseBandCell(band.min, band.max, reserved);
    if (!terminal) {
      if (band.optional) continue;
      return null;
    }
    const cache = chooseCacheForTerminal(terminal, [...reserved, terminal]);
    if (!cache) {
      if (band.optional) continue;
      return null;
    }
    salvageSites.push({ id: siteId, tier: band.tier, terminal, cache });
    reserved.push(terminal, cache);
  }
  if (salvageSites.length < 3) return null;

  const ventPositions: Vec2[] = [];
  for (let v = 0; v < profile.ventCount; v++) {
    const p = pickOpenFar(10, 8, [...ventPositions, ...reserved]);
    if (p) ventPositions.push(p);
  }

  const enemySpawns: Vec2[] = [];
  for (let e = 0; e < 22; e++) {
    const p = pickOpenFar(12, 3, [...enemySpawns, ...reserved]);
    if (p) enemySpawns.push(p);
  }
  if (enemySpawns.length < 10) return null;

  return { solid, surface, entry, corePos, guardianSpawn, salvageSites, ventPositions, enemySpawns, openCells };
};

/** Geracao deterministica com retentativas limitadas (seed derivada) ate mapa solucionavel. */
export const generateWorld = (
  seed: number,
  w: number,
  h: number,
  profile: WorldgenProfile = DEFAULT_PROFILE
): GeneratedWorld => {
  for (let attempt = 0; attempt < 16; attempt++) {
    const result = generateAttempt((seed ^ (attempt * 0x85ebca6b)) >>> 0, w, h, profile);
    if (result) return result;
  }
  throw new Error(`generateWorld: nenhum mapa solucionavel para seed ${seed}`);
};

/**
 * Indice do chunk de (x,y). O stride vem da LARGURA REAL do mundo: createRun
 * aceita dimensoes customizadas, e usar a constante do mundo padrao (96 -> 6
 * chunks) faria um mundo de 64 marcar chunks errados a partir da segunda
 * linha — e escrever fora de chunkVersion mais adiante. O ChunkTracker ja
 * calcula ceil(width/CHUNK); isto o mantem em acordo.
 */
export const chunkOf = (x: number, y: number, width: number = WORLD_W): number =>
  Math.floor(y / CHUNK) * Math.ceil(width / CHUNK) + Math.floor(x / CHUNK);

export const cellIdx = (w: number, x: number, y: number): number => y * w + x;
