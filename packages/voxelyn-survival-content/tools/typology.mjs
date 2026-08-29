// PRANCHA DE TIPOLOGIA DO PROSPECTOR — referência de impressão 3D.
//
// Gera uma imagem topológica das peças do bot a partir do MODELO REAL
// (`prospectorParts`, o mesmo que assa o atlas do jogo) e do rasterizador real
// (`renderVoxels`). Nada aqui é redesenhado à mão: cada peça da prancha é a
// mesma caixa de voxels que o jogador vê em tela, só que isolada, ampliada e
// cotada.
//
//   node tools/typology.mjs [saida.svg]
//
// POR QUE UMA PRANCHA, E NÃO UM SPRITE AMPLIADO
// ---------------------------------------------
// Quem imprime não precisa do sprite: precisa saber QUANTAS peças existem, qual
// encaixa em qual, e qual é a menor feature que a impressora tem de resolver. O
// atlas responde nenhuma das três — ele entrega o bot já montado e já achatado
// na projeção 2:1. Aqui o modelo é quebrado nas peças que o próprio
// `prospector.mjs` nomeia nos comentários, cada uma sai renderizada sozinha, e
// as cotas saem medidas nas CAIXAS, que é onde a dimensão de verdade mora.
//
// ACOPLAMENTO COM O MODELO, e como ele quebra
// -------------------------------------------
// A tabela PIECES abaixo endereça as caixas por ÍNDICE nos arrays que
// `prospectorParts` devolve. Índice é frágil de propósito: qualquer caixa
// inserida, removida ou reordenada no modelo faz a assinatura de material da
// peça divergir, e o gerador aborta com o índice exato em vez de emitir uma
// prancha silenciosamente errada. Consertar é atualizar esta tabela — que é
// justamente a revisão que uma peça nova exige de quem imprime.
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEX, boundingBox, grid } from './lib.mjs';
import { EMISSIVE, MODEL_SCALE, RAMPS, renderVoxels } from './voxel.mjs';
import { prospectorParts } from './prospector.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/* ------------------------------------------------------------------ escala */

/**
 * Altura do modelo em unidades autoradas, medida no próprio modelo.
 *
 * Escrita como medição e não como constante porque é ela que converte voxel em
 * milímetro na tabela de escala: uma peça nova mais alta que a cabeça muda a
 * altura do bot, e a conta tem de acompanhar sozinha.
 */
const modelHeight = (boxes) => Math.max(...boxes.map((b) => b.z + b.h));

/** Altura de ficha do Prospector, em milímetros (1,35 m — Aurix Dynamics PX). */
const CANON_HEIGHT_MM = 1350;

/** Alturas de impressão usuais, para a tabela de conversão. */
const PRINT_HEIGHTS_MM = [54, 75, 100, 150, 200];

/* ------------------------------------------------------------- a tipologia */

// Cada entrada endereça caixas de uma das três camadas de runtime. `idx` são
// índices no array da camada; `mats` é a assinatura de material esperada, na
// ordem, e é ela que detecta um modelo que andou para a frente sem esta tabela.
//
// `explode` é o deslocamento da peça na vista explodida, em unidades autoradas
// [dx, dy, dz]. Peças espelhadas (`mirror`) recebem o dx com sinal trocado na
// instância da direita, para as duas abrirem para fora do eixo do corpo.
const PIECES = [
  // --- LOCOMOÇÃO. A perna esquerda é lower[0..7]; a direita, lower[8..15].
  {
    id: 'pe',
    label: 'Pé + garras',
    layer: 'lower',
    group: 'Locomoção',
    leg: true,
    idx: [0, 1],
    mats: ['rockDeep', 'bone'],
    explode: [-5, -3, -13],
    note: 'Planta longa e chata com garras pálidas à frente. Base de apoio: imprime deitada, sem suporte.',
  },
  {
    id: 'canela',
    label: 'Canela + pistão',
    layer: 'lower',
    group: 'Locomoção',
    leg: true,
    idx: [2, 3],
    mats: ['rockDeep', 'bone'],
    explode: [-5, -1, -9],
    note: 'Sobe PARA TRÁS a partir do pé. O pistão é meio-passo saliente — a menor feature da perna.',
  },
  {
    id: 'jarrete',
    label: 'Jarrete + pino',
    layer: 'lower',
    group: 'Locomoção',
    leg: true,
    idx: [4, 5],
    mats: ['rust', 'loot'],
    explode: [-5, 1, -5],
    note: 'Junta que dobra ao contrário. O pino de meio-passo se projeta da face frontal — não afunde na casca.',
  },
  {
    id: 'coxa',
    label: 'Coxa (2 degraus)',
    layer: 'lower',
    group: 'Locomoção',
    leg: true,
    idx: [6, 7],
    mats: ['rust', 'rust'],
    explode: [-5, 2, -1],
    note: 'Dois degraus: metade de baixo gira com a passada, metade de cima presa ao quadril.',
  },

  // --- ESTRUTURA
  {
    id: 'bacia',
    label: 'Bacia',
    layer: 'upper',
    group: 'Estrutura',
    idx: [0],
    mats: ['rockDeep'],
    explode: [0, 0, -3],
    note: 'Mais larga que o chassi: recebe as duas pernas e esconde a emenda entre as camadas.',
  },
  {
    id: 'chassi',
    label: 'Chassi + chapa de topo',
    layer: 'upper',
    group: 'Estrutura',
    idx: [1, 2],
    mats: ['rust', 'rockDeep'],
    explode: [0, 0, 0],
    note: 'Volume dominante. Latão nas LATERAIS, chapa escura no topo — nenhuma horizontal grande fica em latão.',
  },
  {
    id: 'venezianas',
    label: 'Venezianas de exaustão',
    layer: 'upper',
    group: 'Estrutura',
    idx: [3, 4],
    mats: ['rockDeep', 'rockDeep'],
    explode: [-9, 0, 2],
    note: 'Duas fendas no flanco esquerdo. Applique: saliente meio-passo para FORA da face.',
  },
  {
    id: 'costura',
    label: 'Costura de chapa',
    layer: 'upper',
    group: 'Estrutura',
    idx: [5],
    mats: ['rockDeep'],
    explode: [9, 0, 2],
    note: 'Junta vertical dividindo o flanco direito em dois painéis. Applique de meio-passo.',
  },
  {
    id: 'nucleo',
    label: 'Núcleo de energia',
    layer: 'upper',
    group: 'Estrutura',
    idx: [6, 7, 8],
    mats: ['rockDeep', 'biolum', 'biolum'],
    explode: [0, -11, 1],
    note: 'Nicho escuro embutido com DUAS barras de cyan dentro. Nicho recuado, barras rentes à boca do nicho.',
  },
  {
    id: 'hardpoint',
    label: 'Hardpoint traseiro',
    layer: 'upper',
    group: 'Estrutura',
    idx: [9, 10, 11, 12],
    mats: ['rockDeep', 'rust', 'rust', 'biolum'],
    explode: [0, 11, 2],
    note: 'Módulo das costas com dois trilhos-padrão Aurix e o indicador aceso. Fecha a silhueta por trás.',
  },
  {
    id: 'cabo',
    label: 'Cabo condutivo',
    layer: 'upper',
    group: 'Estrutura',
    idx: [13],
    mats: ['electric'],
    explode: [-6, 8, 0],
    note: 'UM cabo, do módulo pelo flanco. A fiação é assinatura, não textura — não duplique.',
  },
  {
    id: 'ombreira',
    label: 'Ombreira + rebite',
    layer: 'upper',
    group: 'Estrutura',
    pair: [
      [14, 16],
      [15, 17],
    ],
    mats: ['rust', 'bone'],
    explode: [-9, 0, 7],
    note: 'A linha mais larga do corpo. Um rebite pálido por ombro, no canto da frente.',
  },

  // --- MEMBROS
  {
    id: 'braco-extracao',
    label: 'Braço de extração + garra',
    layer: 'upper',
    group: 'Membros',
    idx: [18, 19, 20, 21],
    mats: ['rockDeep', 'bone', 'bone', 'bone'],
    explode: [-13, -2, 2],
    note: 'Membro esquerdo. Termina em DOIS dedos de meio-passo abertos para baixo, com vão entre eles.',
  },
  {
    id: 'braco-arma',
    label: 'Braço da arma',
    layer: 'upper',
    group: 'Membros',
    idx: [22],
    mats: ['rockDeep'],
    explode: [11, -2, 1],
    note: 'Membro direito: curto e recolhido, porque ele sustenta o Cravador.',
  },

  // --- SENSOR
  {
    id: 'cabeca',
    label: 'Cabeça + moldura do visor',
    layer: 'upper',
    group: 'Sensor',
    idx: [23, 24, 25],
    mats: ['rust', 'rockDeep', 'rockDeep'],
    explode: [0, 0, 11],
    note: 'SEM PESCOÇO, estreita (3 sobre um chassi de 5) e inclinada à frente. A moldura isola o cyan do latão.',
  },
  {
    id: 'visor',
    label: 'Visor',
    layer: 'upper',
    group: 'Sensor',
    idx: [26],
    mats: ['biolum'],
    explode: [0, -7, 13],
    note: 'Fresta cyan DENTRO da moldura, nunca colada por cima. Peça emissiva.',
  },
  {
    id: 'farol',
    label: 'Farol tático',
    layer: 'upper',
    group: 'Sensor',
    idx: [27, 28],
    mats: ['rockDeep', 'lamp'],
    explode: [-9, -4, 12],
    note: 'Só na face ESQUERDA. A assimetria é o que torna o rumo do bot legível nas quatro direções.',
  },

  // --- ARMA
  {
    id: 'receptor',
    label: 'Receptor + trilho',
    layer: 'gun',
    group: 'Arma',
    idx: [0, 1],
    mats: ['bone', 'rockDeep'],
    explode: [13, 0, 5],
    note: 'Receptor pálido atravessado contra o chassi escuro; trilho escuro de meio-passo por cima.',
  },
  {
    id: 'camara',
    label: 'Câmara de energia',
    layer: 'gun',
    group: 'Arma',
    idx: [2],
    mats: ['biolum'],
    explode: [13, 2, 8],
    note: 'Um voxel emissivo. Marca a arma como energizada sem engordar a silhueta.',
  },
  {
    id: 'boca',
    label: 'Boca do cano',
    layer: 'gun',
    group: 'Arma',
    idx: [3],
    mats: ['rust'],
    explode: [13, -5, 8],
    note: 'O único voxel que TROCA de material no disparo (rust -> loot). É por ele que o projétil sai.',
  },
];

/** Ordem e cor dos grupos na prancha. */
const GROUPS = [
  { id: 'Locomoção', color: '#7ab8ff' },
  { id: 'Estrutura', color: '#ffa63f' },
  { id: 'Membros', color: '#66c28a' },
  { id: 'Sensor', color: '#59f2c2' },
  { id: 'Arma', color: '#ffd166' },
];

/** Camadas de runtime — o outro eixo da tipologia. */
const LAYERS = {
  lower: { label: 'lower', atlas: 'layer-player-prospector-lower' },
  upper: { label: 'upper', atlas: 'layer-player-prospector-upper' },
  gun: { label: 'gun', atlas: 'layer-player-prospector-gun' },
};

/* ------------------------------------------- extração das peças do modelo */

const LEG_BOXES = 8;

/**
 * Instâncias de uma peça: a lista de caixas de cada cópia física dela.
 *
 * Três formas de endereçamento, e cada uma existe porque o modelo é assim:
 * `leg` são as peças que aparecem uma vez em cada perna (o array `lower` é
 * literalmente duas pernas concatenadas), `pair` são as peças espelhadas cujas
 * caixas ficam intercaladas no `upper` (ombreira e rebite esquerdos vêm antes
 * dos direitos), e `idx` é a peça única.
 */
const instancesOf = (piece, parts) => {
  const layer = parts[piece.layer];
  if (piece.leg) {
    return [0, 1].map((side) => piece.idx.map((i) => layer[side * LEG_BOXES + i]));
  }
  if (piece.pair) return piece.pair.map((idx) => idx.map((i) => layer[i]));
  return [piece.idx.map((i) => layer[i])];
};

/**
 * Confere que a tabela ainda descreve o modelo. Aborta com o índice exato em
 * vez de emitir uma prancha errada — ver o cabeçalho.
 */
const verify = (piece, instances) => {
  for (const boxes of instances) {
    if (boxes.some((b) => b === undefined)) {
      throw new Error(`tipologia: peça "${piece.id}" aponta índice inexistente em ${piece.layer}`);
    }
    const got = boxes.map((b) => b.mat);
    if (got.join(',') !== piece.mats.join(',')) {
      throw new Error(
        `tipologia: peça "${piece.id}" esperava [${piece.mats}] e o modelo tem [${got}] — ` +
          'o modelo mudou; atualize a tabela PIECES.',
      );
    }
  }
};

/** Caixa envolvente de um conjunto de caixas, em unidades autoradas. */
const extent = (boxes) => {
  const lo = (k) => Math.min(...boxes.map((b) => b[k]));
  const hi = (k, s) => Math.max(...boxes.map((b) => b[k] + b[s]));
  return {
    w: +(hi('x', 'w') - lo('x')).toFixed(1),
    d: +(hi('y', 'd') - lo('y')).toFixed(1),
    h: +(hi('z', 'h') - lo('z')).toFixed(1),
    z: lo('z'),
  };
};

/** Menor aresta autorada da peça: é ela que define a feature mínima do print. */
const minFeature = (boxes) => Math.min(...boxes.flatMap((b) => [b.w, b.d, b.h]));

const translate = (boxes, [dx, dy, dz]) =>
  boxes.map((b) => ({ ...b, x: b.x + dx, y: b.y + dy, z: b.z + dz }));

/* ------------------------------------------------------------ rasterização */

/** Canvas de trabalho, folgado: o recorte final sai da bounding box do alfa. */
const PAD = { w: 520, h: 560, ax: 260, ay: 430 };

/** Renderiza caixas isoladas e devolve o recorte justo, com o offset do corte. */
const renderTight = (boxes, dirIndex = 0) => {
  const g = renderVoxels(boxes, dirIndex, PAD.w, PAD.h, PAD.ax, PAD.ay);
  const bb = boundingBox(g);
  if (!bb) throw new Error('tipologia: peça renderizou vazia');
  const w = bb.maxX - bb.minX + 1;
  const h = bb.maxY - bb.minY + 1;
  const out = grid(w, h);
  for (let y = 0; y < h; y++) {
    const src = ((bb.minY + y) * g.w + bb.minX) * 4;
    out.buf.set(g.buf.subarray(src, src + w * 4), y * w * 4);
  }
  return { g: out, offsetX: bb.minX - PAD.ax, offsetY: bb.minY - PAD.ay };
};

/** Amplia por vizinho mais próximo — o pixel do atlas não pode ser suavizado. */
const upscale = (g, s) => {
  const out = grid(g.w * s, g.h * s);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const si = (y * g.w + x) * 4;
      for (let sy = 0; sy < s; sy++) {
        for (let sx = 0; sx < s; sx++) {
          const ti = ((y * s + sy) * out.w + x * s + sx) * 4;
          out.buf.set(g.buf.subarray(si, si + 4), ti);
        }
      }
    }
  }
  return out;
};

const toPngBuffer = (g) => {
  const png = new PNG({ width: g.w, height: g.h });
  png.data.set(g.buf);
  return PNG.sync.write(png);
};

const dataUri = (g) => `data:image/png;base64,${toPngBuffer(g).toString('base64')}`;

/* ------------------------------------------------------------------- saída */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Envelope do bot montado, em unidades autoradas. */
const envelope = (boxes) => ({
  w: Math.max(...boxes.map((b) => b.x + b.w)) - Math.min(...boxes.map((b) => b.x)),
  d: Math.max(...boxes.map((b) => b.y + b.d)) - Math.min(...boxes.map((b) => b.y)),
  h: modelHeight(boxes),
});

/**
 * Resolve a tabela PIECES contra o modelo e devolve as peças já medidas.
 *
 * Exportada, e sem escrever arquivo nenhum, porque a conferência entre tabela e
 * modelo é o que vale a pena rodar no CI: um teste chama isto e falha no dia em
 * que alguém acrescentar uma caixa ao Prospector sem catalogá-la, em vez de a
 * prancha sair errada na próxima vez que alguém for imprimir.
 *
 * `tiles` liga a rasterização das miniaturas, cara e inútil para o teste.
 */
export const buildTypology = ({ tiles = true } = {}) => {
  const parts = prospectorParts({});
  const all = [...parts.lower, ...parts.upper, ...parts.gun];
  const env = envelope(all);

  const pieces = PIECES.map((piece) => {
    const instances = instancesOf(piece, parts);
    verify(piece, instances);
    const boxes = instances[0];
    return {
      ...piece,
      count: instances.length,
      instances,
      boxes,
      extent: extent(boxes),
      minFeature: minFeature(boxes),
      voxels: boxes.length,
      tile: tiles ? upscale(renderTight(boxes).g, 6) : null,
    };
  });

  const covered = pieces.reduce((n, p) => n + p.instances.flat().length, 0);
  if (covered !== all.length) {
    throw new Error(
      `tipologia: a tabela cobre ${covered} caixas e o modelo tem ${all.length} — ` +
        'há peça nova sem entrada em PIECES.',
    );
  }

  return { parts, all, env, pieces };
};

const main = () => {
  const { all, env, pieces } = buildTypology();

  // Vista explodida: cada instância deslocada pelo seu vetor, todas rasterizadas
  // num passe só para a ordem do pintor continuar valendo entre elas.
  const exploded = [];
  const placements = [];
  for (const piece of pieces) {
    piece.instances.forEach((boxes, i) => {
      const [dx, dy, dz] = piece.explode;
      // Peça espelhada: a instância da direita abre para o outro lado.
      const sx = (piece.leg || piece.pair) && i === 1 ? -1 : 1;
      const moved = translate(boxes, [dx * sx, dy, dz]);
      exploded.push(...moved);
      placements.push({ id: piece.id, instance: i, boxes: moved });
    });
  }

  const EX_SCALE = 4;
  const explodedRender = renderTight(exploded);
  const explodedImg = upscale(explodedRender.g, EX_SCALE);
  // Onde cada instância caiu DENTRO da imagem explodida: é isto que ancora as
  // linhas de chamada, em vez de estimá-las a olho sobre o resultado.
  for (const p of placements) {
    const r = renderTight(p.boxes);
    p.box = {
      x: (r.offsetX - explodedRender.offsetX) * EX_SCALE,
      y: (r.offsetY - explodedRender.offsetY) * EX_SCALE,
      w: r.g.w * EX_SCALE,
      h: r.g.h * EX_SCALE,
    };
  }

  const DIRS = ['dr', 'dl', 'ur', 'ul'];
  const assembly = DIRS.map((dir, i) => ({ dir, img: upscale(renderTight(all, i).g, 3) }));

  const outDir = resolve(HERE, '../../../docs/prospector');
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    resolve(outDir, 'prospector-typology.svg'),
    plate({ pieces, placements, explodedImg, assembly, env }),
  );

  writeFileSync(
    resolve(outDir, 'prospector-typology.json'),
    JSON.stringify(
      {
        model: 'player-prospector',
        source: 'packages/voxelyn-survival-content/tools/prospector.mjs',
        generator: 'packages/voxelyn-survival-content/tools/typology.mjs',
        authoredUnits: env,
        modelScale: MODEL_SCALE,
        canonHeightMm: CANON_HEIGHT_MM,
        mmPerAuthoredUnitAtCanon: +(CANON_HEIGHT_MM / env.h).toFixed(2),
        pieceTypes: pieces.length,
        physicalPieces: pieces.reduce((n, p) => n + p.count, 0),
        pieces: pieces.map((p) => ({
          id: p.id,
          label: p.label,
          group: p.group,
          layer: p.layer,
          count: p.count,
          boxes: p.voxels,
          extentUnits: p.extent,
          minFeatureUnits: p.minFeature,
          materials: p.mats,
          note: p.note,
        })),
      },
      null,
      2,
    ) + '\n',
  );

  console.log(
    `docs/prospector/prospector-typology.svg — ${pieces.length} tipos, ` +
      `${pieces.reduce((n, p) => n + p.count, 0)} peças, ${all.length} caixas`,
  );
};

/* --------------------------------------------------------------- a prancha */

/**
 * Distribui rótulos numa coluna vertical sem sobreposição, o mais perto
 * possível da peça que cada um aponta.
 *
 * Empilhar na ordem de chegada não funciona: as peças da vista explodida saem
 * agrupadas em altura, e uma passada só empurra tudo para baixo até o último
 * rótulo cair fora da prancha. A passada de volta devolve a folga para cima.
 */
const laneOut = (items, top, bottom, gap) => {
  const sorted = [...items].sort((a, b) => a.cy - b.cy);
  let y = top;
  for (const it of sorted) {
    y = Math.max(y, it.cy);
    it.ly = y;
    y += gap;
  }
  let overflow = sorted.length ? sorted[sorted.length - 1].ly - bottom : 0;
  if (overflow > 0) {
    for (let i = sorted.length - 1; i >= 0; i--) {
      sorted[i].ly -= overflow;
      if (i > 0) overflow = Math.max(0, sorted[i - 1].ly - (sorted[i].ly - gap));
    }
  }
  return sorted;
};

const plate = ({ pieces, placements, explodedImg, assembly, env }) => {
  const M = 70; // margem interna da prancha
  const LANE_TEXT = 215; // largura reservada aos rótulos de chamada
  const LANE_GAP = 34; // folga entre a arte e a coluna de rótulos
  const COL_W = 372; // passo horizontal do catálogo
  const CARD_W = COL_W - 20;
  const ROW_H = 158;
  const GUTTER = 90;

  const byId = Object.fromEntries(pieces.map((p) => [p.id, p]));
  const colorOf = (id) => GROUPS.find((g) => g.id === byId[id].group).color;
  const mmPerUnit = (h) => h / env.h;

  const exW = explodedImg.w;
  const exH = explodedImg.h;
  const leftW = LANE_TEXT + LANE_GAP + exW + LANE_GAP + LANE_TEXT;
  const rightW = 3 * COL_W - (COL_W - CARD_W);
  const W = M * 2 + leftW + GUTTER + rightW;

  const leftX = M;
  const exX = leftX + LANE_TEXT + LANE_GAP;
  const catX = leftX + leftW + GUTTER;

  const HEAD_H = 210;
  const exY = HEAD_H + 60;

  /* ---- chamadas da vista explodida ---------------------------------- */

  const leaders = placements
    .filter((p) => p.instance === 0)
    .map((p) => ({
      ...p,
      cx: exX + p.box.x + p.box.w / 2,
      cy: exY + p.box.y + p.box.h / 2,
    }))
    .map((p) => ({ ...p, side: p.cx < exX + exW / 2 ? 'L' : 'R' }));

  const laneL = exX - LANE_GAP;
  const laneR = exX + exW + LANE_GAP;
  const laid = [
    ...laneOut(
      leaders.filter((l) => l.side === 'L'),
      exY + 14,
      exY + exH - 14,
      32,
    ),
    ...laneOut(
      leaders.filter((l) => l.side === 'R'),
      exY + 14,
      exY + exH - 14,
      32,
    ),
  ];

  const leaderSvg = laid
    .map((l) => {
      const lx = l.side === 'L' ? laneL : laneR;
      const elbow = l.side === 'L' ? lx + 18 : lx - 18;
      const c = colorOf(l.id);
      const p = byId[l.id];
      return `
    <g>
      <path d="M ${l.cx.toFixed(1)} ${l.cy.toFixed(1)} L ${elbow.toFixed(1)} ${l.ly.toFixed(1)} L ${lx.toFixed(1)} ${l.ly.toFixed(1)}" stroke="${c}" fill="none" stroke-width="1.1" opacity="0.5"/>
      <circle cx="${l.cx.toFixed(1)}" cy="${l.cy.toFixed(1)}" r="2.8" fill="${c}"/>
      <text x="${(lx + (l.side === 'L' ? -8 : 8)).toFixed(1)}" y="${(l.ly + 4).toFixed(1)}" text-anchor="${l.side === 'L' ? 'end' : 'start'}" class="lead">${esc(p.label)}${p.count > 1 ? ` <tspan class="mult">x${p.count}</tspan>` : ''}</text>
    </g>`;
    })
    .join('');

  /* ---- montado, nas quatro direções ---------------------------------- */

  const asmY = exY + exH + 96;
  const asmGap = 26;
  let asmX = 0;
  const asmSvg = assembly
    .map((a) => {
      const x = asmX;
      asmX += a.img.w + asmGap;
      return `
    <g transform="translate(${x} 26)">
      <image x="0" y="0" width="${a.img.w}" height="${a.img.h}" href="${dataUri(a.img)}" style="image-rendering:pixelated"/>
      <text x="${a.img.w / 2}" y="${a.img.h + 22}" text-anchor="middle" class="cardmeta mono">${a.dir}</text>
    </g>`;
    })
    .join('');
  const asmH = 26 + Math.max(...assembly.map((a) => a.img.h)) + 34;

  /* ---- topologia de montagem ----------------------------------------- */

  const tree = [
    ['CHASSI', 0, 'chassi'],
    ['├─ BACIA', 1, 'bacia'],
    ['│   └─ COXA ─ JARRETE ─ CANELA ─ PÉ', 2, 'coxa'],
    ['├─ NÚCLEO DE ENERGIA', 1, 'nucleo'],
    ['├─ VENEZIANAS (esq.) / COSTURA (dir.)', 1, 'venezianas'],
    ['├─ HARDPOINT ─ CABO CONDUTIVO', 1, 'hardpoint'],
    ['├─ OMBREIRA x2', 1, 'ombreira'],
    ['│   ├─ BRAÇO DE EXTRAÇÃO ─ GARRA (esq.)', 2, 'braco-extracao'],
    ['│   └─ BRAÇO DA ARMA ─ RECEPTOR ─ CÂMARA + BOCA (dir.)', 2, 'braco-arma'],
    ['└─ CABEÇA ─ VISOR + FAROL (esq.)', 1, 'cabeca'],
  ];
  const treeY = asmY + asmH + 66;
  const treeSvg = tree
    .map(
      (t, i) =>
        `<text x="${t[1] * 24}" y="${34 + i * 26}" class="tree mono" fill="${colorOf(t[2])}">${esc(t[0])}</text>`,
    )
    .join('');
  const treeBottom = treeY + 34 + tree.length * 26;

  /* ---- materiais e rampas -------------------------------------------- */

  // A rampa é [topo, esquerda, direita]: as três faces que o rasterizador
  // desenha por voxel. Numa peça impressa elas viram as três tintas do
  // material, e é por isso que a legenda mostra as três e não só a cor base.
  const usedMats = [...new Set(pieces.flatMap((p) => p.mats))];
  const matUsers = (m) =>
    pieces
      .filter((p) => p.mats.includes(m))
      .map((p) => p.label.split(' + ')[0])
      .join(', ');
  const matY = treeBottom + 66;
  const matSvg = usedMats
    .map((m, i) => {
      const ramp = RAMPS[m];
      const y = 40 + i * 34;
      const swatches = ramp
        .map(
          (name, k) =>
            `<rect x="${k * 26}" y="${y - 14}" width="22" height="20" rx="2" fill="${HEX[name]}" stroke="#1d2430"><title>${name} ${HEX[name]}</title></rect>`,
        )
        .join('');
      const users = matUsers(m);
      return `${swatches}
      <text x="100" y="${y}" class="td mono ${EMISSIVE.has(m) || m === 'lamp' ? 'dim' : ''}">${m}${EMISSIVE.has(m) || m === 'lamp' ? ' *' : ''}</text>
      <text x="210" y="${y}" class="cardmeta mono">${ramp.map((n) => HEX[n]).join('  ')}</text>
      <text x="500" y="${y}" class="cardmeta">${esc(users.length > 62 ? users.slice(0, 60) + '…' : users)}</text>`;
    })
    .join('');
  const leftBottom = matY + 40 + usedMats.length * 34 + 30;

  /* ---- catálogo -------------------------------------------------------- */

  const catY = HEAD_H + 60;
  let cy = catY;
  const cards = [];
  for (const g of GROUPS) {
    const inGroup = pieces.filter((p) => p.group === g.id);
    cards.push(
      `<text x="${catX}" y="${cy - 16}" class="grouphead" fill="${g.color}">${esc(g.id.toUpperCase())}</text>`,
    );
    let col = 0;
    for (const p of inGroup) {
      const x = catX + col * COL_W;
      const th = Math.min(88, p.tile.h);
      const tw = (p.tile.w * th) / p.tile.h;
      const e = p.extent;
      cards.push(`
    <g transform="translate(${x} ${cy})">
      <rect x="0" y="0" width="${CARD_W}" height="${ROW_H - 22}" rx="6" class="card"/>
      <rect x="0" y="0" width="3" height="${ROW_H - 22}" rx="1.5" fill="${g.color}"/>
      <image x="16" y="${(ROW_H - 22 - th) / 2}" width="${tw.toFixed(1)}" height="${th}" href="${dataUri(p.tile)}" style="image-rendering:pixelated"/>
      <text x="132" y="26" class="cardname">${esc(p.label)}${p.count > 1 ? ` <tspan class="mult">x${p.count}</tspan>` : ''}</text>
      <text x="132" y="48" class="cardmeta mono">${e.w} x ${e.d} x ${e.h} u</text>
      <text x="132" y="68" class="cardmeta">camada <tspan class="mono">${LAYERS[p.layer].label}</tspan> · ${p.voxels} caixa${p.voxels > 1 ? 's' : ''}</text>
      <text x="132" y="88" class="cardmeta">feature mín. <tspan class="mono dim">${p.minFeature} u</tspan></text>
      <g transform="translate(132 100)">${p.mats
        .map(
          (m, i) =>
            `<rect x="${i * 17}" y="0" width="13" height="13" rx="2" fill="${HEX[RAMPS[m][0]]}" stroke="${HEX[RAMPS[m][2]]}"><title>${m}</title></rect>`,
        )
        .join('')}</g>
    </g>`);
      col += 1;
      if (col === 3) {
        col = 0;
        cy += ROW_H;
      }
    }
    cy += (col > 0 ? ROW_H : 0) + 40;
  }

  /* ---- escala de impressão -------------------------------------------- */

  const tblY = cy + 10;
  const rows = PRINT_HEIGHTS_MM.map((h, i) => {
    const u = mmPerUnit(h);
    return `
    <g transform="translate(0 ${i * 28})">
      <text x="0"   y="0" class="td mono">${h} mm</text>
      <text x="110" y="0" class="td mono">1:${Math.round(CANON_HEIGHT_MM / h)}</text>
      <text x="230" y="0" class="td mono">${u.toFixed(2)} mm</text>
      <text x="400" y="0" class="td mono ${u * 0.5 < 1.2 ? 'warn' : 'dim'}">${(u * 0.5).toFixed(2)} mm</text>
      <text x="680" y="0" class="td mono">${(u * env.w).toFixed(0)} x ${(u * env.d).toFixed(0)} mm</text>
    </g>`;
  }).join('');

  /* ---- prancha --------------------------------------------------------- */

  const notes = [
    'O modelo é ortogonal: nenhuma curva, nenhum overhang. Toda face é vertical ou horizontal — dispensa suporte.',
    [
      'O ',
      'meio-passo (0,5 u)',
      ' é a menor feature do bot: pistão, pino da junta, rebites, dedos da garra, trilhos do',
    ],
    '   hardpoint e barras do núcleo. Ele vale exatamente 1 voxel fino (MODEL_SCALE 2) e some antes de todo o resto.',
    'Applique é SALIENTE, nunca rente: venezianas, costura, rebites, trilhos e pino se projetam meio voxel para FORA',
    '   da face que decoram. Rente à casca a peça é enterrada pela geometria vizinha e desaparece na montagem.',
    [
      'Peças ',
      'emissivas',
      ' — visor, duas barras do núcleo, indicador do hardpoint, câmara da arma e lente do farol —',
    ],
    '   pedem filamento translúcido ou pintura à parte: imprima soltas e encaixe depois.',
    'O bot é assimétrico DE PROPÓSITO: farol e braço de extração à esquerda, arma à direita. Só as peças marcadas',
    '   x2 têm par espelhado; as outras dezesseis são únicas.',
    'Pé e bacia são as únicas superfícies de apoio reais. Pernas deitadas na mesa, chassi de pé sobre a base.',
  ];
  const noteSvg = notes
    .map((n, i) => {
      const y = 32 + i * 22;
      const body = Array.isArray(n)
        ? `${esc(n[0])}<tspan class="dim">${esc(n[1])}</tspan>${esc(n[2])}`
        : esc(n);
      const bullet = Array.isArray(n) || !n.startsWith('   ') ? '· ' : '';
      return `<text x="0" y="${y}" class="note">${bullet}${body}</text>`;
    })
    .join('');

  const notesY = tblY + 80 + PRINT_HEIGHTS_MM.length * 28 + 70;
  const rightBottom = notesY + 40 + notes.length * 22;
  const H = Math.max(leftBottom, rightBottom) + M;

  const totalPieces = pieces.reduce((n, p) => n + p.count, 0);
  const mmPerU = (CANON_HEIGHT_MM / env.h).toFixed(0);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <style>
    text { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; fill: #d5cdba; }
    .mono, tspan.mono { font-family: "DejaVu Sans Mono", "Liberation Mono", monospace; }
    .title { font-size: 46px; font-weight: 700; fill: #ffe9b8; letter-spacing: 0.5px; }
    .subtitle { font-size: 17px; fill: #7b8ba3; }
    .kicker { font-size: 13px; fill: #ffa63f; letter-spacing: 3.5px; }
    .sect { font-size: 15px; fill: #7b8ba3; letter-spacing: 3.5px; }
    .grouphead { font-size: 13px; font-weight: 700; letter-spacing: 3.5px; }
    .lead { font-size: 14.5px; fill: #d5cdba; }
    .mult { fill: #ffa63f; font-weight: 700; }
    .card { fill: #12161e; stroke: #1d2430; }
    .cardname { font-size: 15px; fill: #ffe9b8; font-weight: 600; }
    .cardmeta { font-size: 12.5px; fill: #7b8ba3; }
    .th { font-size: 12px; fill: #7b8ba3; letter-spacing: 2px; }
    .td { font-size: 14px; fill: #d5cdba; }
    .note { font-size: 13.5px; fill: #b8a98f; }
    .tree { font-size: 14.5px; }
    .dim { fill: #59f2c2; }
    .warn { fill: #ff7a2f; }
  </style>
  <rect width="100%" height="100%" fill="#0b0e14"/>
  <rect x="${M - 30}" y="${M - 30}" width="${W - (M - 30) * 2}" height="${H - (M - 30) * 2}" fill="none" stroke="#1d2430"/>

  <text x="${leftX}" y="${M + 28}" class="kicker">AURIX DYNAMICS · UNIDADE MODULAR PX</text>
  <text x="${leftX}" y="${M + 82}" class="title">PROSPECTOR — TIPOLOGIA DE PEÇAS</text>
  <text x="${leftX}" y="${M + 112}" class="subtitle">Vista explodida e catálogo, rasterizados do modelo voxel de produção. Referência de impressão 3D.</text>
  <text x="${W - M}" y="${M + 28}" text-anchor="end" class="th">${pieces.length} TIPOS · ${totalPieces} PEÇAS FÍSICAS · ${pieces.reduce((n, p) => n + p.voxels * p.count, 0)} CAIXAS</text>
  <text x="${W - M}" y="${M + 54}" text-anchor="end" class="th mono">prospector.mjs · renderVoxels() · MODEL_SCALE ${MODEL_SCALE}</text>
  <text x="${W - M}" y="${M + 80}" text-anchor="end" class="th">ENVELOPE ${env.w} x ${env.d} x ${env.h} U AUTORADAS</text>
  <text x="${W - M}" y="${M + 106}" text-anchor="end" class="th">1 U = ${mmPerU} MM REAIS · FICHA 1,35 M / 280 KG</text>

  <text x="${exX}" y="${exY - 30}" class="sect">VISTA EXPLODIDA</text>
  <image x="${exX}" y="${exY}" width="${exW}" height="${exH}" href="${dataUri(explodedImg)}" style="image-rendering:pixelated"/>
  ${leaderSvg}

  <g transform="translate(${exX} ${asmY})">
    <text x="0" y="0" class="sect">MONTADO · 4 DIREÇÕES AUTORADAS</text>
    ${asmSvg}
  </g>

  <g transform="translate(${leftX} ${treeY})">
    <text x="0" y="0" class="sect">TOPOLOGIA DE MONTAGEM</text>
    ${treeSvg}
  </g>

  <g transform="translate(${leftX} ${matY})">
    <text x="0" y="0" class="sect">MATERIAIS · RAMPA [TOPO / ESQUERDA / DIREITA]</text>
    ${matSvg}
    <text x="0" y="${40 + usedMats.length * 34 + 6}" class="cardmeta"><tspan class="dim">*</tspan> emissivo — pinte por último, ou imprima em filamento translúcido.</text>
  </g>

  <text x="${catX}" y="${catY - 60}" class="sect">CATÁLOGO DE PEÇAS</text>
  ${cards.join('')}

  <g transform="translate(${catX} ${tblY})">
    <text x="0" y="0" class="sect">ESCALA DE IMPRESSÃO</text>
    <g transform="translate(0 46)">
      <text x="0"   y="0" class="th">ALTURA</text>
      <text x="110" y="0" class="th">ESCALA</text>
      <text x="230" y="0" class="th">1 U AUTORADA</text>
      <text x="400" y="0" class="th">MEIO-PASSO</text>
      <text x="680" y="0" class="th">BASE NECESSÁRIA</text>
      <line x1="0" y1="14" x2="${rightW - 40}" y2="14" stroke="#1d2430"/>
      <g transform="translate(0 44)">${rows}</g>
    </g>
  </g>

  <g transform="translate(${catX} ${notesY})">
    <text x="0" y="0" class="sect">NOTAS DE IMPRESSÃO</text>
    ${noteSvg}
  </g>
</svg>
`;
};

// Só gera quando chamado direto: importar este arquivo (o teste, por exemplo)
// não pode escrever nada em docs/.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
