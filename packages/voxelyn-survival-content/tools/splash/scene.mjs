// A CENA: uma area 96x96 real de Voxelyn Survival, voxelizada para a camera.
//
// Tudo aqui vem de uma das tres fontes, e nada vem de outro lugar:
//   1. a simulacao (`createRun` -> `SurvivalState`), que da o terreno, o piso, a
//      posicao do berco, do Guardiao e da rede de leylines;
//   2. os modelos voxel do jogo (`blockModel`, `surfaceModel`, `guardianModel`,
//      `coreModel`, `prospectorParts`, `propModel`), que sao as MESMAS listas de
//      caixas que produzem os atlases do jogo;
//   3. a encenacao do encontro, declarada em `stageEncounter` e em nenhum outro
//      lugar — para que a fronteira entre "o gerador fez" e "a direcao de arte
//      decidiu" seja um bloco de codigo, e nao uma nota de rodape.
//
// A traducao de material segue as MESMAS tabelas do cliente
// (`client/render.ts`), reproduzidas aqui com a referencia explicita: um id de
// solido vira o mesmo tipo de bloco que o jogador ve em jogo, e a variante sai
// de `variantAt`, o hash de posicao que o cliente usa para a pedra nao cintilar.
import {
  createRun,
  SOLID_NONE,
  SOLID_ROCK,
  SOLID_FRAGILE,
  SOLID_ORE,
  SOLID_CRYSTAL,
  SOLID_FRAGILE_WEAK,
  SOLID_ORE_SPENT,
  SOLID_CRYSTAL_DULL,
  SOLID_ORE_CHIPPED,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SURF_NONE,
  SURF_FUNGAL,
  SURF_BIOFLUID,
  SURF_GAS,
  SURF_FIRE,
  SURF_SCORCHED,
  SURF_SPORES,
  SURF_FUNGAL_HEATED,
  SURF_WATER,
  SURF_EMBER,
  SURF_ICE,
  SURF_RAIL,
  SURF_RAIL_V,
  SURF_SILT,
  SURF_GLASS,
} from '@voxelyn/survival-sim';
import { BLOCK_KINDS, blockModel } from '../terrain.mjs';
import { SURFACE_KINDS, surfaceModel } from '../surfaces.mjs';
import { guardianModel } from '../entities.mjs';
import { coreModel, propModel } from '../props.mjs';
import { prospectorParts } from '../prospector.mjs';
import { variantAt } from './variant.mjs';
import {
  VOXELS_PER_TILE,
  createScene,
  stampBoxes,
  rotateBoxes,
  MATERIAL_INDEX,
} from './geometry.mjs';

/**
 * SOLID_* -> indice em BLOCK_KINDS. Espelha `TERRAIN_KIND_INDEX` de
 * `client/render.ts`; a rocha comum troca de pele por estrato logo abaixo.
 */
const TERRAIN_KIND_INDEX = {
  [SOLID_ROCK]: 0,
  [SOLID_FRAGILE]: 1,
  [SOLID_ORE]: 2,
  [SOLID_CRYSTAL]: 3,
  [SOLID_FRAGILE_WEAK]: 4,
  [SOLID_ORE_SPENT]: 5,
  [SOLID_CRYSTAL_DULL]: 6,
  [SOLID_ORE_CHIPPED]: 7,
  [SOLID_LEYLINE]: 15,
  [SOLID_LEYLINE_NODE]: 16,
};

/** A pele da rocha comum por estrato. Espelha `STRATUM_ROCK_KIND` do cliente. */
const STRATUM_ROCK_KIND = {
  basalt: 0,
  prismatic: 8,
  aquifer: 9,
  sulfur: 10,
  furnace: 11,
  silica: 12,
  glacial: 13,
  ferric: 14,
};

/** SURF_* -> indice em SURFACE_KINDS. Espelha `SURFACE_KIND_INDEX` do cliente. */
const SURFACE_KIND_INDEX = {
  [SURF_NONE]: 0,
  [SURF_FUNGAL]: 1,
  [SURF_BIOFLUID]: 2,
  [SURF_GAS]: 3,
  [SURF_FIRE]: 4,
  [SURF_SCORCHED]: 5,
  [SURF_SPORES]: 6,
  [SURF_FUNGAL_HEATED]: 7,
  [SURF_WATER]: 8,
  [SURF_EMBER]: 9,
  [SURF_ICE]: 10,
  [SURF_RAIL]: 11,
  [SURF_RAIL_V]: 12,
  [SURF_SILT]: 13,
  [SURF_GLASS]: 14,
};

/**
 * Ids de objeto, gravados por voxel ao lado do material.
 *
 * Servem a duas coisas de uma vez: o passe de segmentacao que o briefing pede
 * como saida, e a graduacao seletiva do compositor (o visage do Guardiao e o
 * cristal do nucleo recebem tratamento proprio sem que ninguem precise adivinhar
 * onde eles estao na imagem).
 */
export const OBJ = {
  EMPTY: 0,
  FLOOR: 1,
  WALL: 2,
  VEIN: 3,
  CORE: 4,
  GUARDIAN: 5,
  PROSPECTOR: 6,
  PROP: 7,
  BEDROCK: 8,
};

/** Blocos que a Vein ocupa: o condutor geologico e as juncoes da rede. */
const VEIN_SOLIDS = new Set([SOLID_LEYLINE, SOLID_LEYLINE_NODE]);

const kindIndexFor = (solid, stratum) =>
  solid === SOLID_ROCK ? STRATUM_ROCK_KIND[stratum] : (TERRAIN_KIND_INDEX[solid] ?? 0);

/**
 * A JANELA de voxelizacao: o pedaco da area 96x96 que a camera pode ver.
 *
 * A area inteira em voxels finos seria 1536x1536x~48, ou 113 milhoes de celulas
 * por atributo — desperdicio, porque uma camera com 30 tiles de recuo e um campo
 * de visao cinematografico enxerga um quinto disso. A janela e declarada em
 * tiles e convertida aqui; tudo fora dela simplesmente nao e gravado.
 */
export const makeWindow = (x0, y0, x1, y1, depthTiles = 3) => ({
  x0,
  y0,
  x1,
  y1,
  tilesW: x1 - x0,
  tilesH: y1 - y0,
  width: (x1 - x0) * VOXELS_PER_TILE,
  height: (y1 - y0) * VOXELS_PER_TILE,
  depth: Math.round(depthTiles * VOXELS_PER_TILE),
});

/** Centro de um tile do mundo, em voxels finos da janela. */
export const tileOrigin = (win, tx, ty) => ({
  ox: (tx - win.x0) * VOXELS_PER_TILE + VOXELS_PER_TILE / 2,
  oy: (ty - win.y0) * VOXELS_PER_TILE + VOXELS_PER_TILE / 2,
});

/**
 * Altura, em voxels finos, do plano em que tudo assenta.
 *
 * Os modelos do jogo sao autorados com z=0 no chao do tile e a laje do piso
 * ocupa a primeira unidade autorada acima disso. `GROUND` e essa laje ja em
 * voxels finos: e onde os pes do Prospector, as patas do Guardiao e a base do
 * berco encostam. Abaixo dela existe rocha macica de enchimento (`BEDROCK`), sem
 * a qual uma camera baixa enxergaria por baixo do mundo.
 */
export const BEDROCK_DEPTH = 6;
export const GROUND = BEDROCK_DEPTH + 2;

/**
 * Altura de um bloco de parede, em voxels finos (BLOCK_HEIGHT autorado * escala).
 */
export const BLOCK_STACK = 14;
/**
 * Espacamento entre andares empilhados de rocha.
 *
 * Menor que a altura do bloco de proposito: o topo de um bloco e SERRILHADO
 * (cada coluna desce zero, um ou dois voxels finos, e e essa irregularidade que
 * faz a pedra ler como agregado). Empilhando com o espacamento exato da altura,
 * cada serrilha viraria um vao de ate dois voxels entre um andar e o seguinte, e
 * a massa apareceria costurada por frestas horizontais. Sobrepondo dois voxels,
 * a serrilha de baixo fica enterrada na base de cima e a textura sobrevive
 * inteira.
 */
export const STACK_SPACING = BLOCK_STACK - 2;

/**
 * QUANTOS ANDARES de rocha uma celula solida recebe.
 *
 * A unica transformacao de COMPOSICAO aplicada ao terreno, e por isso ela mora
 * numa funcao propria com o raciocinio inteiro escrito.
 *
 * O bloco de parede do jogo tem sete unidades autoradas de altura — 0,875 tile.
 * Isso e o certo para a isometria fixa: a camera nunca olha por cima de uma
 * parede, entao desenhar mais que a faixa visivel seria pixel jogado fora, e uma
 * parede mais alta esconderia o chao atras dela justamente onde o jogador
 * precisa ver. Mas o mesmo bloco, visto por uma camera livre a trinta tiles, e
 * um meio-fio: mais baixo que o Prospector, que tem quinze unidades.
 *
 * A rocha do jogo NAO tem 0,875 tile de altura — ela bloqueia visao e movimento,
 * e vai da laje ao teto da caverna. Sete unidades e a altura do RECORTE que a
 * projecao mostra, nao a da materia. Continuar a coluna para cima e restaurar o
 * que a projecao corta, e nao inventar geologia.
 *
 * A altura de cada coluna sai de duas medidas do proprio mapa, nunca de gosto:
 *
 *   - a DISTANCIA ate o espaco aberto mais proximo. Uma parede na beira de um
 *     corredor sobe pouco; o miolo de um macico sobe muito. E o que da as
 *     "grandes massas escuras fechando as bordas" com a leitura de erosao — o
 *     espaco foi escavado a partir do vazio, entao a rocha e mais alta onde a
 *     escavacao nao chegou;
 *   - um hash da posicao, para a silhueta nao virar uma escada regular. O mesmo
 *     hash de `variantAt`, deslocado, entao duas rodadas do render dao a mesma
 *     montanha.
 */
export const wallStacks = (openDistance, tx, ty, maxStacks) => {
  let h = Math.imul(tx | 0, 0x27d4eb2d) ^ Math.imul(ty | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  const jitter = ((h ^ (h >>> 16)) >>> 0) % 2;
  // O coeficiente e o teto sao os que mantem a hierarquia de escala do jogo: a
  // rocha tem de fechar o espaco sem passar por cima dos personagens. O Guardiao
  // mede 22 unidades autoradas — 2,75 tiles —, e uma primeira calibragem com
  // coeficiente 1,15 e teto livre produziu paredes de cinco tiles que reduziam o
  // chefe final a um detalhe entre pilares. Um chefe menor que o cenario deixa de
  // ser chefe.
  const stacks = 1 + Math.floor(openDistance * 1.3) + (openDistance >= 2 ? jitter : 0);
  return Math.max(1, Math.min(maxStacks, stacks));
};

/**
 * Distancia de Chebyshev de cada celula solida ate o espaco aberto mais proximo.
 *
 * Chebyshev e nao Manhattan porque a erosao de uma caverna nao respeita eixos: um
 * bolsao aberto na diagonal rebaixa a rocha tanto quanto um ao lado. Calculada
 * por busca em largura a partir de TODAS as celulas abertas de uma vez, que e o
 * jeito de fazer uma transformada de distancia em uma passada.
 */
export const openDistanceField = (state) => {
  const w = state.config.width;
  const h = state.config.height;
  const dist = new Int32Array(w * h).fill(-1);
  const queue = [];
  for (let i = 0; i < w * h; i++) {
    if (state.solid[i] === SOLID_NONE) {
      dist[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % w;
    const cy = (cur / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = dist[cur] + 1;
        queue.push(ni);
      }
    }
  }
  return dist;
};

/**
 * ENCENACAO DO ENCONTRO — a unica parte da cena que nao vem do gerador.
 *
 * O que o gerador entrega: o berco no lugar dele, o Guardiao a tres tiles do
 * berco (medido em 251 setores: ele guarda, nao ronda) e a Vein correndo pelo
 * chao. O que a direcao decide, e declara aqui:
 *
 * - o Guardiao AVANCOU do ponto de nascimento para o meio da arena, entre o
 *   Prospector e o berco. E o movimento que o proprio chefe faz no jogo quando
 *   alguem entra na arena; o que a splash congela e o instante em que ele ja
 *   fechou o caminho. A celula de destino e conferida contra o terreno real
 *   (aberta e alcancavel a pe), entao a encenacao nao inventa chao;
 * - as poses sao quadros REAIS das animacoes assadas — nenhuma anatomia
 *   redesenhada, nenhum membro reposicionado a mao;
 * - a orientacao de cada modelo e uma das quatro rotacoes autoradas.
 *
 * Nada mais e movido. O terreno, o piso, a Vein e o berco ficam onde o worldgen
 * os pos.
 */
export const stageEncounter = (state, options) => {
  const prospector = options.prospector;
  const guardian = options.guardian;
  return {
    prospector: {
      tile: prospector,
      // `idle` quadro 2: o quadro em que o bob esta no alto e o chassi mais
      // aberto. Postura de espera, nao de ataque — o bot chegou e parou.
      pose: { anim: 'idle', frame: 2 },
      // Rotacao autorada 1 = o modelo (frente em -y) olhando para +x, que e a
      // direcao do Guardiao a partir daqui.
      turns: options.prospectorTurns,
    },
    guardian: {
      tile: guardian,
      spawn: { x: state.enemies.find((e) => e.archetype === 'guardian')?.x ?? 0, y: 0 },
      // `idle` quadro 2: o nucleo dilatado no ciclo de respiracao, garras no
      // alto. O chefe esta acordado e virado, e nao no meio de um golpe.
      pose: { anim: 'idle', frame: 2 },
      turns: options.guardianTurns,
    },
  };
};

/**
 * Monta a cena inteira. Devolve a grade densa e o registro do que foi posto
 * onde — o registro alimenta o manifest de assets e o relatorio de autenticidade.
 */
export const buildScene = (state, win, staging) => {
  const scene = createScene(win.width, win.height, win.depth);
  const placements = [];
  const w = state.config.width;

  // ---------------------------------------------------------------------
  // 1. EMBASAMENTO. Rocha macica sob o piso inteiro da janela.
  //
  // Nao e cenario: e a ausencia de um buraco. A projecao isometrica do jogo
  // nunca mostra o que ha sob o chao, entao nenhum modelo do jogo desenha isso;
  // uma camera livre, sim. Uma laje macica do material de chao resolve sem
  // inventar geologia — o que se ve dela e apenas o corte lateral nas bordas do
  // quadro, exatamente como a rocha em volta.
  // ---------------------------------------------------------------------
  const bedrock = MATERIAL_INDEX.rockDeep;
  for (let z = 0; z < BEDROCK_DEPTH; z++) {
    for (let y = 0; y < win.height; y++) {
      const row = (z * win.height + y) * win.width;
      scene.mat.fill(bedrock, row, row + win.width);
      scene.obj.fill(OBJ.BEDROCK, row, row + win.width);
    }
  }
  for (let bz = 0; bz < Math.ceil(BEDROCK_DEPTH / 8); bz++) {
    scene.brick.fill(1, bz * scene.bh * scene.bw, (bz + 1) * scene.bh * scene.bw);
  }

  // ---------------------------------------------------------------------
  // 2. TERRENO. Um modelo voxel por celula da area 96x96 dentro da janela.
  //
  // Celula solida vira `blockModel` do tipo que o cliente escolheria; celula
  // aberta vira `surfaceModel` da crosta que o cliente desenharia. Sao os
  // mesmos modelos que geram `terrain-blocks.png` e `surface-tiles.png`.
  // ---------------------------------------------------------------------
  // Os modelos sao caros de montar (um bloco e uma coluna de voxels por celula
  // da grade fina 16x16, com material sorteado por voxel) e a janela tem
  // milhares de celulas com poucas combinacoes de tipo e variante. Sem o cache,
  // a mesma pedra e reconstruida centenas de vezes.
  const blockCache = new Map();
  const cachedBlock = (kind, variant) => {
    const key = `${kind}:${variant}`;
    let boxes = blockCache.get(key);
    if (!boxes) {
      boxes = blockModel(kind, variant);
      blockCache.set(key, boxes);
    }
    return boxes;
  };

  const openDist = openDistanceField(state);
  /** A pele de rocha comum do estrato: o que preenche a coluna acima do afloramento. */
  const baseRock = BLOCK_KINDS[STRATUM_ROCK_KIND[state.stratum]];
  const maxStacks = Math.max(1, Math.floor((win.depth - BEDROCK_DEPTH - 2) / STACK_SPACING));

  for (let ty = win.y0; ty < win.y1; ty++) {
    for (let tx = win.x0; tx < win.x1; tx++) {
      const cell = ty * w + tx;
      const solid = state.solid[cell];
      const { ox, oy } = tileOrigin(win, tx, ty);
      if (solid === SOLID_NONE) {
        const surf = state.surface[cell];
        const kind = SURFACE_KINDS[SURFACE_KIND_INDEX[surf] ?? 0];
        stampBoxes(
          scene,
          surfaceModel(kind.name, variantAt(tx, ty, 3), 0),
          ox,
          oy,
          BEDROCK_DEPTH,
          OBJ.FLOOR
        );
      } else {
        const kind = BLOCK_KINDS[kindIndexFor(solid, state.stratum)];
        const objId = VEIN_SOLIDS.has(solid) ? OBJ.VEIN : OBJ.WALL;
        // A BORDA DA AREA sobe ate o teto da janela.
        //
        // As duas ultimas fileiras de cada lado sao a parede externa do setor: a
        // rocha que fecha a area 96x96 e continua para fora dela. Pela regra
        // geral elas subiriam pouco (sao finas, entao a distancia ate o espaco
        // aberto e 1) e a camera enxergaria por cima — para o VAZIO, que aparece
        // como um recorte preto no canto do quadro. Levantando-as ao maximo, a
        // borda vira a massa escura que fecha a composicao, que e o papel que ela
        // tem na referencia.
        const atEdge = tx < 2 || ty < 2 || tx >= w - 2 || ty >= state.config.height - 2;
        const stacks = atEdge ? maxStacks : wallStacks(openDist[cell], tx, ty, maxStacks);
        for (let s = 0; s < stacks; s++) {
          // O ANDAR DE BAIXO carrega o tipo real da celula; os de cima sao
          // sempre a rocha comum do estrato.
          //
          // Minerio, cristal e leyline nao sao a materia de uma coluna inteira:
          // sao o que AFLORA na face exposta, na altura em que o jogador
          // encontra. Repetir o tipo para cima transformava cada celula de
          // cristal numa torre luminosa de cinco tiles e cada trecho de leyline
          // num poste — o oposto do que o briefing pede da Vein, que e parecer
          // minerio dentro da geologia e nao um cabo. Com o afloramento so na
          // base, a Vein volta a correr rente ao chao, dentro da rocha.
          const stackKind = s === 0 ? kind : baseRock;
          const variant = variantAt(tx, ty + s * 37, 3);
          stampBoxes(
            scene,
            cachedBlock(stackKind, variant),
            ox,
            oy,
            BEDROCK_DEPTH + s * STACK_SPACING,
            s === 0 ? objId : OBJ.WALL
          );
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // 3. O NUCLEO NO BERCO, na celula que o worldgen escolheu.
  //
  // `coreModel(phase, false)` e o modelo canonico: pedestal de tres degraus,
  // quatro contrafortes e o cristal suspenso entre eles. A fase escolhe o
  // quadro do ciclo de pulsacao — aqui o de maior dilatacao, para o cristal
  // estar no ponto alto do bob e com o anel largo aberto.
  // ---------------------------------------------------------------------
  {
    const { ox, oy } = tileOrigin(win, state.corePos.x, state.corePos.y);
    const boxes = coreModel(0.25, false);
    stampBoxes(scene, boxes, ox, oy, GROUND, OBJ.CORE);
    placements.push({
      id: 'core',
      source: 'tools/props.mjs:coreModel(phase=0.25, taken=false)',
      tile: { x: state.corePos.x, y: state.corePos.y },
      origin: 'worldgen: GeneratedWorld.corePos',
      boxes: boxes.length,
    });
  }

  // ---------------------------------------------------------------------
  // 4. O GUARDIAO DO NUCLEO, avancado para o meio da arena (ver stageEncounter).
  // ---------------------------------------------------------------------
  {
    const g = staging.guardian;
    const { ox, oy } = tileOrigin(win, g.tile.x, g.tile.y);
    const boxes = rotateBoxes(guardianModel(g.pose.anim, g.pose.frame), g.turns);
    stampBoxes(scene, boxes, ox, oy, GROUND, OBJ.GUARDIAN);
    placements.push({
      id: 'guardian',
      source: `tools/entities.mjs:guardianModel('${g.pose.anim}', ${g.pose.frame})`,
      tile: g.tile,
      origin: 'encenacao: avanco a partir de GeneratedWorld.guardianSpawn',
      turns: g.turns,
      boxes: boxes.length,
    });
  }

  // ---------------------------------------------------------------------
  // 5. O PROSPECTOR, na celula aberta ao lado da Vein.
  //
  // O modelo e a soma das tres camadas que o jogo empilha (`lower`, `upper`,
  // `gun`) — a mesma montagem de `prospectorStanding` em entities.mjs.
  // ---------------------------------------------------------------------
  {
    const p = staging.prospector;
    const { ox, oy } = tileOrigin(win, p.tile.x, p.tile.y);
    const parts = prospectorParts({ bob: p.pose.frame % 2 });
    const boxes = rotateBoxes([...parts.lower, ...parts.upper, ...parts.gun], p.turns);
    stampBoxes(scene, boxes, ox, oy, GROUND, OBJ.PROSPECTOR);
    placements.push({
      id: 'prospector',
      source: 'tools/prospector.mjs:prospectorParts({ bob })',
      tile: p.tile,
      origin: 'encenacao: celula aberta na Vein, escolhida por busca em largura',
      turns: p.turns,
      boxes: boxes.length,
    });
  }

  return { scene, placements };
};

/**
 * Props do jogo posicionados em celulas reais.
 *
 * Separado de `buildScene` de proposito: props sao a camada que o briefing
 * chama de "encounter dressing", e mante-los numa funcao propria deixa obvio o
 * que sai se alguem quiser a cena crua. Cada prop e um modelo do atlas
 * `world-props` (`propModel`), nao um objeto desenhado para a splash.
 */
export const dressProps = (scene, win, props) => {
  const placed = [];
  for (const prop of props) {
    const { ox, oy } = tileOrigin(win, prop.tile.x, prop.tile.y);
    const boxes = rotateBoxes(propModel(prop.kind, prop.frame ?? 0), prop.turns ?? 0);
    stampBoxes(scene, boxes, ox, oy, GROUND, OBJ.PROP);
    placed.push({
      id: prop.kind,
      source: `tools/props.mjs:propModel('${prop.kind}', ${prop.frame ?? 0})`,
      tile: prop.tile,
      origin: prop.origin,
      boxes: boxes.length,
    });
  }
  return placed;
};

export { createRun };
