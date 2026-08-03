import { RNG } from '@voxelyn/core';
import {
  CHUNK,
  RAIL_TRACK_MAX,
  RAIL_TRACK_MIN,
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
  SURF_RAIL,
  SURF_RAIL_V,
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
  /**
   * Seams de minerio da sedimentar: caminhadas HORIZONTAIS que convertem
   * rocha comum em veio ao longo de uma faixa. Na Silica o minerio segue a
   * CAMADA — uma linha legivel na parede que recompensa minerar em fileira —
   * em vez do salpico aleatorio da decoracao de parede. Zero fora dela.
   */
  oreSeams: number;
  /**
   * NOS de minerio do Ferrifero: discos densos de veio em volta de bolsoes
   * abertos — a "magnetita" que ancora a leitura do estrato e alimenta a
   * conducao por parede (um no conectado a um seam vira fiacao de sala).
   */
  oreKnots: number;
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
  /**
   * Tramos de TRILHO da armadilha de carrinho (SURF_RAIL). So a operacao os
   * deixou: Aurix e o Ferrifero. Zero em todo estrato intocado.
   */
  railTracks: number;
  /** Teto de Miners do setor; a Cicatriz Aurix sobe isso. */
  minerCap: number;
  /**
   * A GRAMATICA ESPACIAL do estrato, carimbada depois do automato e antes das
   * provas de alcancabilidade — entao toda garantia do gerador continua
   * valendo para ela. A regra de qualidade que rege as gramaticas: trocar a
   * paleta inteira por cinza NAO pode apagar a identidade do estrato — a
   * FORMA dos saloes e corredores tem de dizer onde o jogador esta.
   *
   * - `columns`: anfiteatros com colunas, florestas de pilares e fissuras
   *   (Basalto — o automato historico continua sendo a base)
   * - `radial`: rotunda com raios, geodo de casca cristalina, camara
   *   espelhada e corredores angulares segmentados (Catedral)
   * - `lungs`: camaras bojudas em cadeia, alveolos e gargantas (Fenda)
   * - `canyon`: fissuras compridas com blocos desabados (Fornalha)
   * - `karst`: cupula calcaria, cisternas cheias, colunata e tuneis SINUOSOS
   *   de walker com persistencia direcional (Aquifero)
   * - `terraced`: galerias estratificadas mais largas que altas e corredores
   *   PARALELOS separados por parede fina fragil, alem dos sumidouros
   *   (Silica — o estrato sedimentar)
   * - `lakes`: lagos ovais congelados e tuneis suaves (Cripta)
   * - `none`: nenhuma marca; o labirinto do automato puro
   */
  halls: 'none' | 'columns' | 'radial' | 'lungs' | 'canyon' | 'karst' | 'terraced' | 'lakes';
};

/** O perfil historico: Galerias de Basalto. `generateWorld` sem perfil e ele. */
export const DEFAULT_PROFILE: WorldgenProfile = {
  fragileThinChance: 0.55,
  oreChance: 0.07,
  crystalChance: 0.03,
  crystalVeins: 0,
  oreSeams: 0,
  oreKnots: 0,
  fungalBlobs: { count: 26, rMin: 2, rMax: 4 },
  biofluidBlobs: { count: 12, rMin: 1, rMax: 3 },
  waterBlobs: { count: 0, rMin: 0, rMax: 0 },
  iceBlobs: { count: 0, rMin: 0, rMax: 0 },
  emberBlobs: { count: 0, rMin: 0, rMax: 0 },
  coalBlobs: { count: 0, rMin: 0, rMax: 0 },
  ventCount: 6,
  railTracks: 0,
  minerCap: 3,
  halls: 'none',
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
  /**
   * Celulas que a MOLDURA da arena do chefe transformou em parede (vazio
   * quando o carimbo se desfez ou quando o estrato nao carimba sólido).
   *
   * A simulacao nao le isto — existe para a geracao proteger essas celulas da
   * decoracao de parede e para o teste conseguir distinguir um pilar da arena
   * de uma rocha comum que por acaso caiu na mesma diagonal. Sem a distincao o
   * teste cobraria da moldura um minerio que nunca foi dela.
   */
  arenaCells: number[];
  /** Tramos de trilho da armadilha de carrinho (origem, direcao, tamanho). */
  railTracks: Array<{ x: number; y: number; dx: number; dy: number; len: number }>;
  /**
   * Centros dos SALOES que a gramatica espacial carimbou — o anfiteatro, a
   * rotunda, a cupula. E informacao de APRESENTACAO: a simulacao nao le isto
   * (nao entra no hash nem em snapshot), mas o cliente ancora os landmarks
   * monumentais da decoracao aqui, em vez de sortear um lugar sem significado.
   * Um salao pode ter sido selado pelas provas de alcancabilidade; quem
   * consome a lista confere o terreno antes de usar. Com `halls: 'none'`, vazio.
   */
  hallCenters: Vec2[];
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

/**
 * Carimba a estrutura de salao do estrato sobre o labirinto do automato.
 *
 * Roda ANTES da escolha de entrada e das provas de alcancabilidade: um salao
 * que o flood fill nao alcancar e selado de volta pela mesma regra que fecha
 * qualquer bolsao — a garantia de mapa solucionavel nao ganha caso especial.
 * So ABRE espaco (e converte parede em cristal/fragil); nunca fecha caminho.
 *
 * Devolve as celulas que devem NASCER com o elemento do estrato (agua nas
 * bacias, gelo nos lagos): a geografia e a materia chegam juntas, em vez de a
 * agua ser sorteada longe da bacia que existe para contê-la.
 */
const stampHalls = (
  rng: RNG,
  solid: Uint8Array,
  w: number,
  h: number,
  halls: WorldgenProfile['halls'],
): { fillCells: number[]; fillKind: number; hallCenters: Vec2[] } => {
  const fillCells: number[] = [];
  // Os centros dos saloes GRANDES — so registro do que a gramatica ja
  // calculou, nenhuma tirada de RNG a mais: a sequencia (e o mapa) continuam
  // byte a byte os mesmos de antes deste campo existir.
  const hallCenters: Vec2[] = [];
  let fillKind = SURF_NONE;
  if (halls === 'none') return { fillCells, fillKind, hallCenters };

  const center = (): Vec2 => ({
    x: 12 + rng.nextInt(Math.max(1, w - 24)),
    y: 12 + rng.nextInt(Math.max(1, h - 24)),
  });
  const carveLine = (x0: number, y0: number, angle: number, length: number, r: number): void => {
    let fx = x0 + 0.5;
    let fy = y0 + 0.5;
    for (let step = 0; step < length; step++) {
      fx += Math.cos(angle);
      fy += Math.sin(angle);
      carveBlob(solid, w, h, Math.floor(fx), Math.floor(fy), r);
    }
  };
  /** Poe um pilar SOLIDO dentro de um salao. So dentro da moldura do mapa. */
  const pillar = (x: number, y: number, mat: number): void => {
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2) solid[idx(w, x, y)] = mat;
  };
  /** Elipse aberta; devolve as celulas internas (para encher de elemento). */
  const carveEllipse = (cx: number, cy: number, rx: number, ry: number, collect?: number[]): void => {
    for (let y = Math.max(1, cy - ry); y <= Math.min(h - 2, cy + ry); y++) {
      for (let x = Math.max(1, cx - rx); x <= Math.min(w - 2, cx + rx); x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        solid[idx(w, x, y)] = SOLID_NONE;
        if (collect && nx * nx + ny * ny <= 0.82) collect.push(idx(w, x, y));
      }
    }
  };
  /**
   * Tunel de WALKER com persistencia direcional: o corredor carstico. Mantem o
   * rumo na maior parte dos passos e vira aos poucos quando vira; a espessura
   * respira entre 1 e 2 — o tunel se estreita e volta a abrir, como a agua
   * dissolve.
   */
  const meander = (x0: number, y0: number, length: number): void => {
    let angle = rng.nextFloat01() * Math.PI * 2;
    let fx = x0 + 0.5;
    let fy = y0 + 0.5;
    for (let step = 0; step < length; step++) {
      if (rng.nextFloat01() < 0.25) angle += (rng.nextFloat01() - 0.5) * 1.1;
      fx += Math.cos(angle);
      fy += Math.sin(angle);
      if (fx < 4 || fy < 4 || fx > w - 4 || fy > h - 4) angle += Math.PI / 2;
      carveBlob(solid, w, h, Math.floor(fx), Math.floor(fy), step % 5 < 3 ? 1 : 2);
    }
  };

  if (halls === 'columns') {
    // BASALTO: pesado, tectonico, colunar. O automato continua sendo a base;
    // a gramatica acrescenta os tres saloes da identidade.
    // Anfiteatro: sala circular cercada por colunas — o combate orbita o centro.
    {
      const c = center();
      const r = 6 + rng.nextInt(3);
      carveBlob(solid, w, h, c.x, c.y, r);
      hallCenters.push(c);
      const phase = rng.nextFloat01() * Math.PI * 2;
      for (let k = 0; k < 7; k++) {
        const a = phase + (k * Math.PI * 2) / 7;
        pillar(Math.round(c.x + Math.cos(a) * (r - 2)), Math.round(c.y + Math.sin(a) * (r - 2)), SOLID_ROCK);
      }
    }
    // Floresta de pilares: campo aberto interrompido por ilhas solidas —
    // cobertura, ricochete e rota de perseguicao.
    {
      const c = center();
      carveBlob(solid, w, h, c.x, c.y, 8 + rng.nextInt(2));
      hallCenters.push(c);
      const islands = 6 + rng.nextInt(4);
      for (let k = 0; k < islands; k++) {
        const a = rng.nextFloat01() * Math.PI * 2;
        const d = 2 + rng.nextInt(5);
        pillar(Math.round(c.x + Math.cos(a) * d), Math.round(c.y + Math.sin(a) * d), SOLID_ROCK);
      }
    }
    // Fissura: dois grandes espacos ligados por uma passagem estreita.
    {
      const a = center();
      const angle = rng.nextFloat01() * Math.PI * 2;
      const bx = Math.max(6, Math.min(w - 6, Math.round(a.x + Math.cos(angle) * 12)));
      const by = Math.max(6, Math.min(h - 6, Math.round(a.y + Math.sin(angle) * 12)));
      carveBlob(solid, w, h, a.x, a.y, 4 + rng.nextInt(2));
      carveBlob(solid, w, h, bx, by, 4 + rng.nextInt(2));
      carveLine(a.x, a.y, Math.atan2(by - a.y, bx - a.x), 12, 0);
    }
  } else if (halls === 'radial') {
    // CATEDRAL: angular, luminosa, interconectada.
    // Rotunda central com corredores em leque. Os PILARES sao cristal:
    // cobertura, luz e municao do Ressonante ao mesmo tempo.
    const c = center();
    const radius = 7 + rng.nextInt(3);
    carveBlob(solid, w, h, c.x, c.y, radius);
    hallCenters.push(c);
    const spokes = 5;
    const phase = rng.nextFloat01() * Math.PI * 2;
    for (let k = 0; k < spokes; k++) {
      carveLine(c.x, c.y, phase + (k * Math.PI * 2) / spokes, 12 + rng.nextInt(6), 1);
    }
    for (let k = 0; k < 6; k++) {
      const a = phase + Math.PI / 6 + (k * Math.PI) / 3;
      pillar(
        Math.round(c.x + Math.cos(a) * (radius - 3)),
        Math.round(c.y + Math.sin(a) * (radius - 3)),
        SOLID_CRYSTAL,
      );
    }
    // Geodo: camara circular cuja CASCA e cristal voltado para dentro. Abrir um
    // geodo e entrar numa sala que e inteira feita da regra do bioma.
    {
      const g = center();
      const r = 4 + rng.nextInt(2);
      carveBlob(solid, w, h, g.x, g.y, r);
      hallCenters.push(g);
      for (let y = Math.max(1, g.y - r - 1); y <= Math.min(h - 2, g.y + r + 1); y++) {
        for (let x = Math.max(1, g.x - r - 1); x <= Math.min(w - 2, g.x + r + 1); x++) {
          const d2 = (x - g.x) ** 2 + (y - g.y) ** 2;
          if (d2 > r * r && d2 <= (r + 1.6) * (r + 1.6) && solid[idx(w, x, y)] === SOLID_ROCK) {
            solid[idx(w, x, y)] = SOLID_CRYSTAL;
          }
        }
      }
    }
    // Camara espelhada: o mesmo recorte carimbado duas vezes, em espelho — a
    // quase-simetria que nenhuma erosao produz. E corredores ANGULARES: retas
    // curtas com viradas de 90 graus, a assinatura de algo que cresceu.
    {
      const m = center();
      for (let k = 0; k < 4; k++) {
        const ox = rng.nextInt(6);
        const oy = rng.nextInt(5) - 2;
        const r = 1 + rng.nextInt(2);
        carveBlob(solid, w, h, m.x - 2 - ox, m.y + oy, r);
        carveBlob(solid, w, h, m.x + 2 + ox, m.y + oy, r);
      }
      let px = m.x;
      let py = m.y;
      let horizontal = rng.nextFloat01() < 0.5;
      for (let seg = 0; seg < 4; seg++) {
        const len = 5 + rng.nextInt(5);
        const dir = rng.nextFloat01() < 0.5 ? -1 : 1;
        carveLine(px, py, horizontal ? (dir < 0 ? Math.PI : 0) : (dir < 0 ? -Math.PI / 2 : Math.PI / 2), len, 0);
        if (horizontal) px = Math.max(4, Math.min(w - 4, px + dir * len));
        else py = Math.max(4, Math.min(h - 4, py + dir * len));
        horizontal = !horizontal;
      }
    }
  } else if (halls === 'lungs') {
    // Pulmoes: camaras bojudas em cadeia, ligadas por gargantas de 1 celula.
    // E a topologia que da sentido ao ciclo dos respiradouros — a camara cheia
    // e um LUGAR, e a garganta e a janela.
    const start = center();
    const angle = rng.nextFloat01() * Math.PI * 2;
    let cx = start.x;
    let cy = start.y;
    const chambers = 4 + rng.nextInt(2);
    for (let k = 0; k < chambers; k++) {
      carveBlob(solid, w, h, cx, cy, 3 + rng.nextInt(3));
      hallCenters.push({ x: cx, y: cy });
      const jitter = (rng.nextFloat01() - 0.5) * 1.2;
      const nx = cx + Math.cos(angle + jitter) * 8;
      const ny = cy + Math.sin(angle + jitter) * 8;
      carveLine(cx, cy, Math.atan2(ny - cy, nx - cx), 8, 0);
      cx = Math.max(6, Math.min(w - 6, Math.round(nx)));
      cy = Math.max(6, Math.min(h - 6, Math.round(ny)));
    }
  } else if (halls === 'canyon') {
    // Fissuras compridas: as grandes linhas retas que dividem as salas da
    // Fornalha e criam as pontes naturais entre elas. Blocos DESABADOS pontuam
    // o leito — a camara que ja foi continua e hoje e escombro.
    for (let c = 0; c < 2; c++) {
      const start = center();
      const angle = rng.nextFloat01() * Math.PI * 2;
      const length = 22 + rng.nextInt(10);
      carveLine(start.x, start.y, angle, length, 1);
      // O "salao" de uma fissura e o meio dela — onde as pontes desabadas moram.
      hallCenters.push({
        x: Math.max(2, Math.min(w - 3, Math.round(start.x + Math.cos(angle) * (length / 2)))),
        y: Math.max(2, Math.min(h - 3, Math.round(start.y + Math.sin(angle) * (length / 2)))),
      });
      for (let d = 0; d < 3; d++) {
        const t = 4 + rng.nextInt(Math.max(1, length - 8));
        pillar(
          Math.round(start.x + Math.cos(angle) * t),
          Math.round(start.y + Math.sin(angle) * t),
          SOLID_ROCK,
        );
      }
    }
  } else if (halls === 'karst') {
    // AQUIFERO CARSTICO: esculpido pela agua — arredondado, amplo, sinuoso. O
    // oposto visual da Catedral: nada de quinas, tudo dissolvido.
    // Cupula calcaria: sala grande e arredondada, quase sem obstrucao.
    {
      const c = center();
      carveEllipse(c.x, c.y, 7 + rng.nextInt(3), 6 + rng.nextInt(2));
      hallCenters.push(c);
    }
    // Cisternas: bacias que nascem CHEIAS — a agua mora na geografia que
    // existe para contê-la.
    for (let b = 0; b < 2; b++) {
      const c = center();
      const r = 5 + rng.nextInt(3);
      carveEllipse(c.x, c.y, r, Math.max(3, r - 1), fillCells);
    }
    // Colunata: salao alongado dividido por uma fileira de pilares naturais.
    {
      const c = center();
      const horizontal = rng.nextFloat01() < 0.5;
      const rx = horizontal ? 8 : 4;
      const ry = horizontal ? 4 : 8;
      carveEllipse(c.x, c.y, rx, ry);
      hallCenters.push(c);
      for (let k = -2; k <= 2; k++) {
        pillar(c.x + (horizontal ? k * 3 : 0), c.y + (horizontal ? 0 : k * 3), SOLID_ROCK);
      }
    }
    // Tuneis sinuosos: o corredor carstico e um walker persistente que alarga
    // e estreita — rotas circulares nascem de dois meandros que se cruzam.
    for (let t = 0; t < 3; t++) {
      const s = center();
      meander(s.x, s.y, 24 + rng.nextInt(12));
    }
    fillKind = SURF_WATER;
  } else if (halls === 'terraced') {
    // SILICA SEDIMENTAR: laminada, escavavel, instavel. A gramatica e
    // HORIZONTAL: galerias mais largas que altas, corredores paralelos, e o
    // contorno escalonado vem das proprias camadas.
    // Galerias estratificadas: salas alongadas na horizontal.
    for (let g = 0; g < 2; g++) {
      const c = center();
      carveEllipse(c.x, c.y, 8 + rng.nextInt(4), 3 + rng.nextInt(2));
      hallCenters.push(c);
    }
    // Corredores PARALELOS separados por parede fina: a parede vira atalho
    // destrutivel — o fragil aqui e um seam estrutural legivel, nao ruido.
    {
      const c = center();
      const len = 14 + rng.nextInt(8);
      carveLine(c.x, c.y, 0, len, 1);
      carveLine(c.x, c.y + 4, 0, len, 1);
      for (let x = c.x; x < Math.min(w - 2, c.x + len); x++) {
        const i = idx(w, x, c.y + 2);
        if (solid[i] === SOLID_ROCK) solid[i] = SOLID_FRAGILE;
      }
    }
    // Sumidouros: pocos circulares com a BORDA fragil — a sala cuja parede
    // inteira e uma decisao.
    for (let s = 0; s < 3; s++) {
      const c = center();
      const r = 4 + rng.nextInt(3);
      carveBlob(solid, w, h, c.x, c.y, r);
      for (let y = Math.max(1, c.y - r - 1); y <= Math.min(h - 2, c.y + r + 1); y++) {
        for (let x = Math.max(1, c.x - r - 1); x <= Math.min(w - 2, c.x + r + 1); x++) {
          const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
          if (d2 > r * r && d2 <= (r + 1.5) * (r + 1.5) && solid[idx(w, x, y)] === SOLID_ROCK) {
            solid[idx(w, x, y)] = SOLID_FRAGILE;
          }
        }
      }
    }
  } else if (halls === 'lakes') {
    // CRIPTA: lagos ovais congelados — o territorio do Espectro — ligados por
    // tuneis suaves de walker (gelo e agua tambem esculpem).
    for (let l = 0; l < 2 + rng.nextInt(2); l++) {
      const c = center();
      carveEllipse(c.x, c.y, 6 + rng.nextInt(3), 4 + rng.nextInt(2), fillCells);
      // O lago congelado E o salao da Cripta: o obelisco nasce na margem dele.
      hallCenters.push(c);
    }
    for (let t = 0; t < 2; t++) {
      const s = center();
      meander(s.x, s.y, 18 + rng.nextInt(8));
    }
    fillKind = SURF_ICE;
  }
  return { fillCells, fillKind, hallCenters };
};

/**
 * A SALA FUNCIONAL do poco, com o sotaque do estrato.
 *
 * A FUNCAO nunca muda: o poco mora num disco aberto de raio 4, alcancavel, com
 * o pedestal 3x3 limpo. O que muda e a moldura — colunas basalticas, pilares
 * de cristal na Catedral, um fosso raso no Aquifero, a borda porosa da Fenda,
 * escombros na Fornalha, o anel fragil da Silica, o lago congelado da Cripta.
 * Offsets FIXOS, nenhuma tirada de RNG: o carimbo nao desloca sorteio nenhum,
 * e as provas de alcancabilidade rodam DEPOIS dele — um pedestal que por
 * absurdo selasse o poco reprovaria o mapa e a geracao tentaria outra seed.
 */
const stampCorePedestal = (
  solid: Uint8Array,
  surface: Uint8Array,
  w: number,
  h: number,
  core: Vec2,
  halls: WorldgenProfile['halls'],
): void => {
  const put = (dx: number, dy: number, mat: number): void => {
    const x = core.x + dx;
    const y = core.y + dy;
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2 && solid[idx(w, x, y)] === SOLID_NONE) {
      solid[idx(w, x, y)] = mat;
    }
  };
  const paint = (dx: number, dy: number, surf: number): void => {
    const x = core.x + dx;
    const y = core.y + dy;
    if (x > 1 && y > 1 && x < w - 2 && y < h - 2 && solid[idx(w, x, y)] === SOLID_NONE) {
      surface[idx(w, x, y)] = surf;
    }
  };
  const RING = [
    [3, 0], [-3, 0], [0, 3], [0, -3],
    [2, 2], [2, -2], [-2, 2], [-2, -2],
  ] as const;

  if (halls === 'columns') {
    // Anfiteatro do poco: colunas nas diagonais, corredores nos eixos.
    for (const [dx, dy] of [[2, 2], [2, -2], [-2, 2], [-2, -2]] as const) put(dx, dy, SOLID_ROCK);
  } else if (halls === 'radial') {
    // Pilares de cristal nos eixos: cobertura, luz e municao do objetivo.
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(dx, dy, SOLID_CRYSTAL);
  } else if (halls === 'karst') {
    // Fosso raso: chegar ao poco atravessa a agua — a geografia cobra.
    for (const [dx, dy] of RING) paint(dx, dy, SURF_WATER);
  } else if (halls === 'lungs') {
    // Borda porosa: duas celulas frageis — a camara do poco tambem respira.
    for (const [dx, dy] of [[3, 0], [-3, 0]] as const) put(dx, dy, SOLID_FRAGILE);
  } else if (halls === 'canyon') {
    // Escombros: a camara que desabou em volta do que importava.
    for (const [dx, dy] of [[3, 0], [-2, 2], [0, -3]] as const) put(dx, dy, SOLID_ROCK);
  } else if (halls === 'terraced') {
    // Anel fragil nos eixos: a parede em volta do poco e uma decisao.
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(dx, dy, SOLID_FRAGILE);
  } else if (halls === 'lakes') {
    // O poco no meio do lago congelado: a aproximacao final desliza.
    for (const [dx, dy] of RING) paint(dx, dy, SURF_ICE);
  }
};

/**
 * A ARENA DO CHEFE, com o sotaque do estrato.
 *
 * O poco ja tinha a sua moldura (`stampCorePedestal`); a camara do chefe era a
 * ultima sala importante do jogo que saia igual em todo bioma — a mesma clareira
 * lisa na Catedral, na Cripta e na Fornalha. E ela e a sala onde o jogador passa
 * mais tempo olhando para o chao.
 *
 * A mesma camara serve aos DOIS chefes (o Bispo no setor 2, o Guardiao no
 * final), entao o carimbo tem duas faixas com papeis diferentes:
 *
 * - SOLIDOS no anel 4 (colunas, pilares de cristal, celulas frageis): cobertura.
 *   Ficam fora do 3x3 que o Guardiao precisa para caber e longe do pedestal.
 * - SUPERFICIE nos aneis 5 e 6 (agua, gelo, brasa): a ORLA. Mora fora do bolso
 *   micelial do Bispo (raio 4), entao no setor 2 as duas leituras convivem —
 *   tapete de fungo no miolo, materia do estrato em volta — e no setor final a
 *   arena inteira e do bioma.
 *
 * Nada e sorteado, como no pedestal: offsets fixos nao deslocam a RNG. O que
 * muda em relacao a ele e a ORDEM — a arena e carimbada DEPOIS de o ponto do
 * chefe ser escolhido (ele depende do terreno), entao a prova de alcancabilidade
 * nao vem de graca e e feita aqui: se o carimbo isolar o poco ou o chefe, ele e
 * DESFEITO por inteiro. Um acento de bioma nunca vale uma run impossivel.
 *
 * Exportada para o teste: nas seeds reais o desfazer nunca dispara (as camaras
 * que a geracao abre sao largas demais para um anel esparso fechar), entao a
 * unica maneira de provar que a rede de seguranca funciona e arma-la a mao.
 *
 * DEVOLVE as celulas que deixaram de ser chao (vazio quando o carimbo se
 * desfez). Quem chama TEM de tira-las de `openCells`: aquela lista e montada
 * antes daqui e nenhum consumidor dela reconfere `solid`, entao uma celula
 * virada pilar continuaria candidata a spawn — e um bicho nasceria DENTRO da
 * parede, invisivel e inalcancavel. Foi exatamente o que aconteceu na primeira
 * versao (seed 205, setor 3: um cuspidor emparedado num pilar de cristal).
 */
export const stampBossArena = (
  solid: Uint8Array,
  surface: Uint8Array,
  w: number,
  h: number,
  boss: Vec2,
  core: Vec2,
  entry: Vec2,
  halls: WorldgenProfile['halls'],
): Set<number> => {
  const filled = new Set<number>();
  if (halls === 'none') return filled;

  // As DUAS camadas: o `canyon` levanta escombro E pinta brasa, entao desfazer
  // so o solido deixaria a orla incandescente de pe — justo quando a prova
  // decidiu que a moldura inteira nao podia existir. Meia moldura ja seria
  // ilegivel; meia moldura que ainda QUEIMA e pior.
  const before = new Uint8Array(solid);
  const beforeSurface = new Uint8Array(surface);
  const cheb = (dx: number, dy: number): number => Math.max(Math.abs(dx), Math.abs(dy));
  /** Longe do corpo do chefe e do pedestal: as duas coisas precisam de chao. */
  const free = (x: number, y: number): boolean =>
    cheb(x - boss.x, y - boss.y) > 2 && cheb(x - core.x, y - core.y) > 2;

  const put = (dx: number, dy: number, mat: number): void => {
    const x = boss.x + dx;
    const y = boss.y + dy;
    if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return;
    if (!free(x, y) || solid[idx(w, x, y)] !== SOLID_NONE) return;
    solid[idx(w, x, y)] = mat;
  };
  const paint = (dx: number, dy: number, surf: number): void => {
    const x = boss.x + dx;
    const y = boss.y + dy;
    if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return;
    if (!free(x, y) || solid[idx(w, x, y)] !== SOLID_NONE) return;
    surface[idx(w, x, y)] = surf;
  };

  // Anel 4: as quatro diagonais e os quatro eixos. Cobertura, nunca cerco.
  const PILLARS = [[4, 4], [4, -4], [-4, 4], [-4, -4]] as const;
  const AXES = [[4, 0], [-4, 0], [0, 4], [0, -4]] as const;
  /** Aneis 5 e 6, em passo 2: a orla, esparsa o bastante para ler como orla. */
  const ORLA: Array<readonly [number, number]> = [];
  for (let r = 5; r <= 6; r++) {
    for (let k = -r; k <= r; k += 2) {
      ORLA.push([k, -r], [k, r], [-r, k], [r, k]);
    }
  }

  if (halls === 'columns') {
    // Anfiteatro: colunas nas diagonais. A luta ganha quinas para cortar linha.
    for (const [dx, dy] of PILLARS) put(dx, dy, SOLID_ROCK);
  } else if (halls === 'radial') {
    // Catedral: pilares de CRISTAL. Cobertura que tambem e municao — quebrar um
    // deles no meio da luta descarrega a cadeia que o proprio jogador armou.
    for (const [dx, dy] of PILLARS) put(dx, dy, SOLID_CRYSTAL);
    for (const [dx, dy] of AXES) put(dx, dy, SOLID_CRYSTAL);
  } else if (halls === 'karst') {
    // Aquifero: a orla e agua. Numa arena fechada, agua e o chao que CONDUZ —
    // a descarga que o jogador solta volta para ele se ele estiver na lamina.
    for (const [dx, dy] of ORLA) paint(dx, dy, SURF_WATER);
  } else if (halls === 'lungs') {
    // Fenda: paredes porosas nos eixos. A arena abre com um tiro, e o que era
    // cobertura vira passagem — nos dois sentidos.
    for (const [dx, dy] of AXES) put(dx, dy, SOLID_FRAGILE);
    for (const [dx, dy] of PILLARS) put(dx, dy, SOLID_FRAGILE);
  } else if (halls === 'canyon') {
    // Fornalha/Ferrifero: escombros e BRASA na orla. O calor abre a couraca do
    // Escoriaceo e cobra do jogador a mesma barra que a arma dele ja cobra.
    for (const [dx, dy] of PILLARS) put(dx, dy, SOLID_ROCK);
    for (const [dx, dy] of ORLA) paint(dx, dy, SURF_EMBER);
  } else if (halls === 'terraced') {
    // Silica: anel fragil inteiro. A camada cede em faixa (fratura por camada),
    // entao a cobertura desta arena desaparece mais depressa do que parece.
    for (const [dx, dy] of AXES) put(dx, dy, SOLID_FRAGILE);
  } else if (halls === 'lakes') {
    // Cripta: a arena inteira ESCORREGA. A inercia do gelo transforma esquivar
    // do chefe num problema de embalo, e nao de reflexo.
    for (const [dx, dy] of ORLA) paint(dx, dy, SURF_ICE);
  }

  // A PROVA. Diferente do pedestal, este carimbo roda depois das validacoes de
  // alcancabilidade, entao ele paga a propria: se isolou o poco ou o chefe, some
  // por inteiro. Desfazer tudo (e nao a celula culpada) mantem a arena legivel —
  // meia moldura seria um acento que ninguem sabe ler.
  const reach = floodOpen(solid, w, h, entry.x, entry.y);
  if (!reach.has(idx(w, core.x, core.y)) || !reach.has(idx(w, boss.x, boss.y))) {
    solid.set(before);
    surface.set(beforeSurface);
    return filled;
  }
  for (let i = 0; i < solid.length; i++) if (solid[i] !== before[i]) filled.add(i);
  return filled;
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

  // 2b) a estrutura de salao do estrato, sobre o labirinto do automato. Com
  // `halls: 'none'` (basalto) nada roda e nenhuma tirada de RNG e consumida —
  // o mapa historico continua byte a byte.
  const hallFill = stampHalls(rng, solid, w, h, profile.halls);

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
  // A sala do poco ganha o sotaque do estrato ANTES do re-flood: toda prova
  // de alcancabilidade abaixo ja enxerga a moldura carimbada.
  stampCorePedestal(solid, surface, w, h, corePos, profile.halls);

  const openCells: number[] = [];
  const reOpen = floodOpen(solid, w, h, entry.x, entry.y);
  for (const i of reOpen) openCells.push(i);
  openCells.sort((a, b) => a - b);

  // `let` porque a moldura da arena, que so pode ser carimbada depois de o
  // ponto do chefe existir, refaz este BFS. Ver o rebuild logo abaixo dela.
  let distFromEntry = bfsFarthest(solid, w, h, entry).dist;

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

  // A camara do chefe ganha o sotaque do estrato. Depois do ponto do chefe
  // existir (ele depende do terreno) e antes da decoracao de parede, que so
  // olha para rocha comum e portanto respeita o que a arena carimbou.
  const arenaFilled = stampBossArena(solid, surface, w, h, guardianSpawn, corePos, entry, profile.halls);
  // REFAZ o re-flood e o BFS, como o pedestal do poco ja goza por ser carimbado
  // ANTES deles (linha ~809). A moldura da arena nao tem essa sorte: ela depende
  // do ponto do chefe, que depende do terreno. Entao ela repara o que sujou.
  //
  // Podar so as celulas viradas pilar NAO bastava, e as duas provas disso sao
  // caras de achar a olho: um pilar tambem CORTA caminho. Na seed 141 s3 ele
  // isolava um pedaco de chao que continuava em `openCells` sem pertencer ao
  // flood final; na seed 210 s2 ele alongava a rota e o site opcional de tier 3
  // caia em 135 quando a banda de 82% do novo maximo pedia 136 — a distancia
  // usada para escolher era de um mundo que deixou de existir.
  //
  // `blobSurface`, `pickOpenFar` e `chooseBandCell` consomem estas estruturas
  // sem revalidar terreno. Refazer as duas e mais barato do que auditar cada
  // consumidor — e nao depende de eu adivinhar quais deles se importam, que e
  // o raciocinio que ja falhou duas vezes nesta mesma funcao.
  if (arenaFilled.size > 0) {
    const reFlood = floodOpen(solid, w, h, entry.x, entry.y);
    openCells.length = 0;
    for (const i of reFlood) openCells.push(i);
    openCells.sort((a, b) => a - b);
    distFromEntry = bfsFarthest(solid, w, h, entry).dist;
  }

  /**
   * A moldura da arena escolheu o material dela; NENHUMA passada de decoracao
   * re-sorteia esse material.
   *
   * A protecao e uniforme de proposito, e nao so na passada que hoje alcanca a
   * moldura. Saber quais passadas podem toca-la exige cruzar estrato com
   * `halls` — o Ferrifero carimba rocha e roda nos de minerio, o Prismatico
   * carimba cristal e roda nervuras de cristal — e esse raciocinio quebra
   * silenciosamente quando alguem acrescentar um estrato. Foi assim que os nos
   * do passo 4d escaparam da primeira correcao, que so cobria o passo 4.
   *
   * O que esta em jogo: um pilar isolado e parede FINA nos dois eixos, o caso
   * de MAIOR chance de virar fragil, e rocha e o unico material que nao cede a
   * tiro nenhum. Na Fornalha da seed 7 os quatro escombros saiam [minerio,
   * minerio, fragil, rocha] — tres dos quatro iam embora a tiro, e com eles a
   * cobertura indestrutivel que a arena promete.
   */
  const arenaKeeps = (i: number): boolean => arenaFilled.has(i);

  // 4) decorar paredes adjacentes a areas abertas: minerio, rocha fragil, cristais
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = idx(w, x, y);
      if (solid[i] !== SOLID_ROCK || arenaKeeps(i)) continue;
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
      if (solid[i] === SOLID_ROCK && !arenaKeeps(i)) solid[i] = SOLID_CRYSTAL;
    }
  }

  // 4c) seams de minerio (Silica sedimentar): a partir de uma celula aberta,
  // a caminhada segue a FAIXA — so anda na horizontal — convertendo rocha
  // comum em veio. O resultado e uma linha de minerio que desenha a camada na
  // parede. Com count 0 (todo outro estrato) nada e sorteado.
  for (let seam = 0; seam < profile.oreSeams; seam++) {
    const cell = openCells[rng.nextInt(openCells.length)];
    const y = Math.floor(cell / w);
    const x0 = cell % w;
    const dir = rng.nextFloat01() < 0.5 ? 1 : -1;
    const length = 10 + rng.nextInt(8);
    for (let s = 0; s < length; s++) {
      const x = x0 + dir * s;
      if (x <= 0 || x >= w - 1) break;
      const j = idx(w, x, y);
      if (solid[j] === SOLID_ROCK && !arenaKeeps(j)) solid[j] = SOLID_ORE;
    }
  }

  // 4d) nos de minerio (Ferrifero): discos densos de veio em volta de um
  // bolsao aberto — a magnetita concentrada. Um no tocado por um seam vira
  // fiacao continua de sala em sala. Com count 0, nenhuma tirada.
  for (let knot = 0; knot < profile.oreKnots; knot++) {
    const cell = openCells[rng.nextInt(openCells.length)];
    const kx = cell % w;
    const ky = Math.floor(cell / w);
    const r = 2;
    for (let y = Math.max(1, ky - r); y <= Math.min(h - 2, ky + r); y++) {
      for (let x = Math.max(1, kx - r); x <= Math.min(w - 2, kx + r); x++) {
        if ((x - kx) ** 2 + (y - ky) ** 2 > r * r) continue;
        const j = idx(w, x, y);
        if (solid[j] === SOLID_ROCK && !arenaKeeps(j)) solid[j] = SOLID_ORE;
      }
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
  // O elemento dos SALOES entra primeiro de tudo: bacia nasce cheia d'agua,
  // lago nasce congelado. A geografia e a materia chegam juntas.
  for (const i of hallFill.fillCells) {
    if (solid[i] === SOLID_NONE && surface[i] === SURF_NONE) surface[i] = hallFill.fillKind;
  }

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

  // 5b) TRILHOS da operacao: tramos retos sobre chao nu, longe da entrada e
  // do poco. So marcam superficie (SURF_RAIL) — a topologia nao muda, e com
  // count 0 nenhuma tirada de RNG acontece (todo estrato intocado).
  const railTracks: GeneratedWorld['railTracks'] = [];
  for (let t = 0; t < profile.railTracks; t++) {
    for (let attempt = 0; attempt < 40; attempt++) {
      const cell = openArr[rng.nextInt(openArr.length)];
      const x0 = cell % w;
      const y0 = Math.floor(cell / w);
      const horizontal = rng.nextFloat01() < 0.5;
      const dx = horizontal ? 1 : 0;
      const dy = horizontal ? 0 : 1;
      const fits = (x: number, y: number): boolean =>
        x > 1 && y > 1 && x < w - 2 && y < h - 2 &&
        solid[idx(w, x, y)] === SOLID_NONE &&
        surface[idx(w, x, y)] === SURF_NONE &&
        Math.hypot(x - entry.x, y - entry.y) > 6 &&
        Math.hypot(x - corePos.x, y - corePos.y) > 6;
      let len = 0;
      while (len < RAIL_TRACK_MAX && fits(x0 + dx * len, y0 + dy * len)) len++;
      if (len < RAIL_TRACK_MIN) continue;
      const surf = dx === 1 ? SURF_RAIL : SURF_RAIL_V;
      for (let k = 0; k < len; k++) surface[idx(w, x0 + dx * k, y0 + dy * k)] = surf;
      railTracks.push({ x: x0, y: y0, dx, dy, len });
      break;
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

  return {
    solid,
    surface,
    entry,
    corePos,
    guardianSpawn,
    salvageSites,
    ventPositions,
    enemySpawns,
    openCells,
    arenaCells: [...arenaFilled],
    railTracks,
    hallCenters: hallFill.hallCenters,
  };
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
