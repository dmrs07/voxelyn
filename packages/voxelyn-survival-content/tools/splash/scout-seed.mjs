// Busca deterministica de uma SEED real de Voxelyn Survival para a splash.
//
// A splash nao pode ser uma colagem: o briefing pede uma area 96x96 do Survival
// "escolhida e enquadrada cinematograficamente". Escolher e exatamente isto —
// rodar o gerador do jogo sobre seeds reais e pontuar o resultado pelo que a
// composicao precisa, sem tocar em um unico parametro do gerador.
//
// DUAS COISAS QUE A MEDICAO ENSINOU, E QUE MUDARAM O CRITERIO
// -----------------------------------------------------------
// 1. O Guardiao NAO fica longe do nucleo. Em 251 setores medidos o gerador o
//    poe a 2,8-3,0 tiles do berco, sempre. Ele nao ronda o mapa: ele guarda, e
//    guardar e ficar colado. A separacao que a referencia mostra entre os dois
//    nao vem da geracao — vem da profundidade da camera e do avanco do proprio
//    encontro (ver `stageEncounter` em scene.mjs, onde o deslocamento e
//    declarado como encenacao, nao como worldgen).
//
// 2. O nucleo fica sempre num CANTO. Em 309 setores a margem mediana ate a
//    parede externa e de dois tiles. E consequencia direta de o gerador empurrar
//    o objetivo para o ponto mais distante da entrada, e num quadrado isso e um
//    canto. Entao a camera olha do interior do mapa PARA o canto: a parede
//    externa vira a massa escura que fecha o fundo, e a continuidade mais clara
//    fica no corredor por onde o Prospector veio.
//
// O EIXO DA COMPOSICAO SEGUE A VEIN
// ---------------------------------
// A primeira versao escolhia a posicao do Prospector pelo corredor mais aberto a
// vinte passos do berco, e a Vein por outro criterio. Nas seeds que passavam, as
// duas caiam em lados opostos do nucleo: o veio corria para nordeste e o bot
// ficava a noroeste, e a linha de energia que na referencia LIGA os dois nao
// ligava nada.
//
// Aqui o eixo e um so. O segmento de leyline com uma ponta no berco define a
// direcao; o Prospector vai perto da OUTRA ponta. Isso nao e um truque de
// enquadramento — e a leitura que a tagline afirma: o bot esta onde esta porque
// seguiu o veio ate a coisa que o alimenta.
import {
  generateWorld,
  biomeProfile,
  sectorBiome,
  sectorTitle,
  sectorSeed,
  SOLID_NONE,
  SOLID_ORE,
} from '@voxelyn/survival-sim';

export const W = 96;
export const H = 96;
/** Mesmo mix de `createRun`: a seed do setor e derivada da seed da run. */
export const RUN_SEED_MIX = 0x9e3779b9;

export const isOpen = (world, x, y) =>
  x >= 0 && y >= 0 && x < W && y < H && world.solid[y * W + x] === SOLID_NONE;

export const openRatio = (world, cx, cy, r) => {
  let open = 0;
  let total = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      total++;
      if (isOpen(world, x, y)) open++;
    }
  }
  return open / Math.max(1, total);
};

/**
 * Distancia de caminhada, em tiles, de uma origem a cada celula aberta.
 *
 * Busca em largura sobre as celulas ABERTAS reais, e nao distancia em linha
 * reta: o briefing proibe ponte, abismo e plataforma flutuante, e a garantia
 * mais forte contra isso e so encenar sobre chao que o jogador conseguiria
 * percorrer a pe. Se o caminho nao existe na busca, ele nao existe na imagem.
 */
export const walkField = (world, origin) => {
  const dist = new Int32Array(W * H).fill(-1);
  const start = origin.y * W + origin.x;
  const queue = [start];
  dist[start] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const x = cell % W;
    const y = (cell / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isOpen(world, nx, ny)) continue;
      const ni = ny * W + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cell] + 1;
      queue.push(ni);
    }
  }
  return dist;
};

/**
 * O segmento de leyline que nasce no berco, com as duas pontas medidas.
 *
 * `head` e a celula mais proxima do nucleo — a nascente visual da Vein — e
 * `tail` a mais distante dela dentro do mesmo segmento, que e para onde a linha
 * corre. O par define o eixo inteiro da composicao.
 */
export const veinAxis = (world) => {
  let best = null;
  world.leylines.forEach((seg, index) => {
    let head = null;
    for (const cell of seg.cells) {
      const x = cell % W;
      const y = (cell / W) | 0;
      const d = Math.hypot(x - world.corePos.x, y - world.corePos.y);
      if (!head || d < head.d) head = { x, y, d };
    }
    if (!head) return;
    let tail = null;
    for (const cell of seg.cells) {
      const x = cell % W;
      const y = (cell / W) | 0;
      const d = Math.hypot(x - head.x, y - head.y);
      if (!tail || d > tail.d) tail = { x, y, d };
    }
    const value = seg.cells.length + tail.d * 1.5 - head.d * 2;
    if (!best || value > best.value) {
      best = { index, head, tail, length: seg.cells.length, span: tail.d, value };
    }
  });
  return best;
};

/**
 * Onde o Prospector fica: ao LONGO da Vein, a uma distancia de caminhada util
 * do berco — nunca na ponta dela.
 *
 * A versao anterior procurava perto da ponta distante do segmento e nao achava
 * nada, porque as leylines do jogo sao longas: os segmentos medidos atravessam
 * de 49 a 87 tiles, e a ponta fica de 46 a 128 passos de caminhada do nucleo.
 * Colocar o bot la significaria ele e o berco em cantos opostos do mapa.
 *
 * A referencia, alias, nao mostra o bot na ponta do veio: mostra o veio
 * PASSANDO por ele e seguindo para fora do quadro. Entao a busca e sobre as
 * celulas abertas vizinhas do proprio condutor, e a faixa de 16 a 26 passos e
 * enquadramento — perto demais nao ha profundidade entre o bot e o berco, longe
 * demais os dois nao cabem no mesmo plano com leitura.
 */
export const pickProspector = (world, dist, segment) => {
  let best = null;
  for (const cell of segment.cells) {
    const cx = cell % W;
    const cy = (cell / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = cx + dx;
      const y = cy + dy;
      if (!isOpen(world, x, y)) continue;
      const steps = dist[y * W + x];
      if (steps < 16 || steps > 26) continue;
      const here = openRatio(world, x, y, 3);
      if (here < 0.5) continue;
      // Espaco em volta e o que decide; o desempate favorece o meio da faixa,
      // onde a profundidade entre bot e berco e maior sem estourar o quadro.
      const value = here * 2 - Math.abs(steps - 21) / 20;
      if (!best || value > best.value) best = { x, y, steps, here, value, veinCell: cell };
    }
  }
  return best;
};

export const evaluate = (world) => {
  const vein = veinAxis(world);
  if (!vein) return null;
  if (vein.head.d > 12 || vein.length < 14 || vein.span < 8) return null;

  const arena = openRatio(world, world.corePos.x, world.corePos.y, 6);
  if (arena < 0.58) return null;

  const dist = walkField(world, world.corePos);
  const prospector = pickProspector(world, dist, world.leylines[vein.index]);
  if (!prospector) return null;

  // Meio do caminho: e onde o Guardiao entra no quadro, e onde a camera precisa
  // de chao visivel para a profundidade acontecer.
  const mx = Math.round((prospector.x + world.corePos.x) / 2);
  const my = Math.round((prospector.y + world.corePos.y) / 2);
  const mid = openRatio(world, mx, my, 4);
  if (mid < 0.5) return null;

  let ore = 0;
  for (let i = 0; i < world.solid.length; i++) if (world.solid[i] === SOLID_ORE) ore++;
  if (ore < 50) return null;

  const margin = Math.min(
    world.corePos.x,
    world.corePos.y,
    W - 1 - world.corePos.x,
    H - 1 - world.corePos.y
  );

  return {
    value:
      arena * 2 +
      mid * 2 +
      prospector.here +
      vein.length / 30 +
      vein.span / 20 -
      vein.head.d / 18 -
      ore / 500 +
      Math.min(margin, 12) / 30,
    arena,
    mid,
    vein,
    prospector,
    ore,
    margin,
  };
};

const main = () => {
  const results = [];
  for (let runSeed = 1; runSeed <= 400; runSeed++) {
    for (let sector = 1; sector <= 5; sector++) {
      const biome = sectorBiome(runSeed, sector);
      const profile = biomeProfile(biome, sector);
      if (profile.leylines <= 0) continue;
      const seed = sectorSeed((runSeed ^ RUN_SEED_MIX) >>> 0, sector);
      let world;
      try {
        world = generateWorld(seed, W, H, profile);
      } catch {
        continue;
      }
      if (!world.leylines.length) continue;
      const scored = evaluate(world);
      if (!scored) continue;
      results.push({
        runSeed,
        sector,
        seed,
        stratum: biome.stratum,
        occupation: biome.occupation,
        halls: profile.halls,
        title: sectorTitle(runSeed, sector),
        ...scored,
      });
    }
  }

  results.sort((a, b) => b.value - a.value);
  for (const r of results.slice(0, 15)) {
    console.log(
      `runSeed=${r.runSeed} sector=${r.sector} seed=${r.seed} ${r.stratum}/${r.occupation} halls=${r.halls} ` +
        `veinHead=(${r.vein.head.x},${r.vein.head.y}) tail=(${r.vein.tail.x},${r.vein.tail.y}) ` +
        `prospector=(${r.prospector.x},${r.prospector.y},${r.prospector.steps}p) ` +
        `arena=${r.arena.toFixed(2)} mid=${r.mid.toFixed(2)} vein(len=${r.vein.length},span=${r.vein.span.toFixed(1)},head=${r.vein.head.d.toFixed(1)}) ` +
        `ore=${r.ore} margin=${r.margin} score=${r.value.toFixed(3)} | ${r.title}`
    );
  }
  console.log(`\ncandidatos: ${results.length}`);
};

if (process.argv[1]?.endsWith('scout-seed.mjs')) main();
