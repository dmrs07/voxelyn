// Rasterizador voxel isometrico, construido sobre o @voxelyn/core.
//
// Por que existe: o gerador de personagens desenhava em 2D (elipses, linhas,
// retangulos) com duas tonalidades fingindo volume, enquanto a art bible e a
// production spec pedem "modelo voxel pre-renderizado, com volumes facetados e
// leitura tridimensional clara". Alem de nao entregar volume, redesenhar cada
// direcao a mao fazia as quatro divergirem entre si.
//
// Aqui o personagem e um MODELO 3D de caixas de voxels. As quatro direcoes sao
// rotacoes de 90 graus do MESMO modelo, entao nao podem discordar. A projecao,
// a ordem do pintor e a chave de profundidade vem do core (projectIso,
// makeDrawKey, sortDrawCommands) — nao ha matematica isometrica duplicada aqui.
import { makeDrawKey, projectIso, sortDrawCommands } from '@voxelyn/core';
import { grid, set } from './lib.mjs';

/**
 * Rampas de face por material: [topo, esquerda, direita].
 * TODAS as entradas sao nomes da paleta mestra — o validador rejeita qualquer
 * cor fora dela, entao sombrear aqui e escolher rampa, nao multiplicar canal.
 * Key light no topo-esquerda, conforme a art bible.
 */
export const RAMPS = {
  rock: ['rockLight', 'rock', 'rockShadow'],
  rockDeep: ['rock', 'rockShadow', 'dark'],
  // Chao e queimado: rampas proprias porque o piso tem de ficar ao menos dois
  // passos de valor ABAIXO de qualquer coisa viva em cima dele (art bible §6).
  // Reaproveitar `rock` clareava o chao inteiro e apagava a silhueta das
  // criaturas justamente onde elas andam.
  floor: ['rockShadow', 'dark', 'dark'],
  scorch: ['dark', 'dark', 'dark'],
  rust: ['bone', 'rust', 'rockShadow'],
  bone: ['bone', 'rust', 'rockShadow'],
  fungus: ['fungusLight', 'fungus', 'fungusDark'],
  fungusDeep: ['fungus', 'fungusDark', 'dark'],
  biolum: ['biolum', 'fungusLight', 'fungus'],
  acid: ['acid', 'fungusLight', 'fungus'],
  /**
   * Lamina de biofluido: topo ESCURO com as laterais quase pretas.
   *
   * Liquido parado le por profundidade, nao por matiz — uma lamina de verde
   * medio uniforme e indistinguivel de um tapete de fungo, que e exatamente o
   * que a poca parecia. O brilho vem de voxels `biolum` avulsos no mesmo plano,
   * entao a poca e escura com faiscas, e nao verde por igual.
   */
  pool: ['fungusDark', 'dark', 'dark'],
  /**
   * Gas sulfuroso: crosta amarela sobre corpo esverdeado.
   *
   * O gas era `acid` puro — verde-limao — e a paleta nao tem amarelo de enxofre.
   * Combinando `loot` no topo com `acid` na lateral a leitura vira amarelo
   * esverdeado, que e o enxofre, e separa o gas do fungo e da poca de uma vez.
   */
  sulfur: ['loot', 'acid', 'fungusDark'],
  fire: ['loot', 'fire', 'blood'],
  blood: ['blood', 'rust', 'dark'],
  electric: ['electric', 'rockLight', 'rock'],
  loot: ['loot', 'rust', 'rockShadow'],
  player: ['player', 'bone', 'rust'],
};

/**
 * SOMBRA de cada cor da paleta mestra: um passo abaixo, dentro da propria paleta.
 *
 * A oclusao de ambiente nao pode multiplicar canal. A Art Bible fixa dezesseis
 * cores e o validador rejeita qualquer pixel fora delas — escurecer aqui e
 * ESCOLHER a proxima cor da escada, e nao calcular uma. Cada entrada e o vizinho
 * mais escuro plausivel dentro da mesma familia, e a escada termina em `dark`,
 * que e sombra de si mesma.
 *
 * Uma tabela unica em vez de uma escada por material porque a mesma cor aparece
 * em rampas diferentes: `rust` e o meio-tom do latao e tambem a base do fogo.
 * Com uma escada por familia, ela teria dois destinos e a sombra de uma peca
 * dependeria de qual material a citou primeiro.
 */
const SHADOW_OF = {
  player: 'bone',
  bone: 'rust',
  rockLight: 'rock',
  rock: 'rockShadow',
  rockShadow: 'dark',
  rust: 'rockShadow',
  loot: 'rust',
  fire: 'blood',
  blood: 'rust',
  biolum: 'fungusLight',
  fungusLight: 'fungus',
  fungus: 'fungusDark',
  fungusDark: 'dark',
  acid: 'fungus',
  electric: 'rockLight',
  dark: 'dark',
};

/**
 * Cores que EMITEM luz e por isso nao recebem oclusao.
 *
 * Visor, nucleo, brasa e corrente sao fonte, nao superficie: escurece-los no
 * fundo de uma fresta seria apagar justamente os pontos que o jogador usa para
 * localizar a criatura no breu — e a fresta e onde eles costumam estar, porque
 * uma luz encaixada no corpo e o desenho normal deles.
 *
 * `loot` e `player` ficam de fora desta lista de proposito: sao ouro e branco,
 * materiais, e casco ou placa no fundo de uma junta deve escurecer como
 * qualquer outra superficie.
 */
const EMISSIVE = new Set(['biolum', 'electric', 'fire', 'acid']);

/** Caixa de voxels. Eixos: x = leste, y = sul, z = cima; origem entre os pes. */
export const box = (x, y, z, w, d, h, mat) => ({ x, y, z, w, d, h, mat });

// Um voxel na projecao 2:1: 4px de largura, 2px de topo, 2px de lateral.
// tileW/tileH/zStep sao os parametros que projectIso() do core espera.
export const VOX = { tileW: 4, tileH: 2, zStep: 2 };

// makeDrawKey desloca bits, entao exige coordenadas nao-negativas. Os modelos
// sao autorados em torno da origem (pes no centro), logo precisam deste offset.
const KEY_BIAS = 64;

/**
 * Rotacao do modelo para cada direcao isometrica autorada.
 *
 * Os modelos sao escritos com a FRENTE em -y. Na projecao do jogo, os vetores
 * de mundo correspondem a: +x=dr, +y=dl, -y=ur e -x=ul. Uma soma constante de
 * rotacao nao representa essa ordem (ur/ul ficam trocados e outras direcoes
 * apontam para o quadrante vizinho), que fazia os personagens parecerem andar
 * como Curupira.
 *
 * Cada indice continua seguindo o contrato publico de renderVoxels:
 * 0=dr, 1=dl, 2=ur, 3=ul.
 */
const DIRECTION_ROTATION = [1, 2, 0, 3];

/**
 * Indice de direcao cuja rotacao e a identidade.
 *
 * Cenario — bloco de terreno e crosta de chao — nao tem frente, entao passar
 * qualquer direcao "parece" dar no mesmo. Nao da: com rotacao, as coordenadas
 * autoradas deixam de ser as coordenadas projetadas, e qualquer calculo de
 * extensao feito sobre o modelo CRU passa a mentir sobre o frame. Era o que
 * acontecia com o atlas de blocos: `blockBounds()` media sem rotacionar,
 * `buildTerrainFrames()` rasterizava com rotacao de 90 graus, e o bloco saia
 * 2px a direita do que o manifest declarava — recortado na borda do frame e
 * desalinhado do chao. Derivado da tabela, e nao escrito na mao, para continuar
 * valendo se a ordem das direcoes mudar.
 */
export const DIR_UNROTATED = DIRECTION_ROTATION.indexOf(0);

const rot = (x, y, r) => {
  if (r === 1) return [-y, x];
  if (r === 2) return [-x, -y];
  if (r === 3) return [y, -x];
  return [x, y];
};

/** Expande caixas em voxels, descartando os internos (nunca visiveis). */
const shellVoxels = (boxes, r) => {
  const out = [];
  for (const b of boxes) {
    const ramp = RAMPS[b.mat];
    if (!ramp) throw new Error(`material sem rampa: ${b.mat}`);
    for (let dx = 0; dx < b.w; dx++) {
      for (let dy = 0; dy < b.d; dy++) {
        for (let dz = 0; dz < b.h; dz++) {
          const interior =
            dx > 0 && dx < b.w - 1 && dy > 0 && dy < b.d - 1 && dz > 0 && dz < b.h - 1;
          if (interior) continue;
          const [x, y] = rot(b.x + dx, b.y + dy, r);
          out.push({ x, y, z: b.z + dz, ramp, mat: b.mat });
        }
      }
    }
  }
  return out;
};

const occupancyKey = (x, y, z) => `${x},${y},${z}`;

/**
 * Ocupacao do modelo INTEIRO, incluindo os voxels internos que a casca descarta.
 *
 * A casca serve para desenhar; para medir oclusao ela mentiria. O voxel logo
 * atras de uma face de casca costuma ser interno, e um conjunto so de casca o
 * daria como vazio — a face acharia que esta exposta ao ar livre exatamente onde
 * ha materia macica encostada nela.
 */
const solidVoxels = (boxes, r) => {
  const solid = new Set();
  for (const b of boxes) {
    for (let dx = 0; dx < b.w; dx++) {
      for (let dy = 0; dy < b.d; dy++) {
        for (let dz = 0; dz < b.h; dz++) {
          const [x, y] = rot(b.x + dx, b.y + dy, r);
          solid.add(occupancyKey(x, y, b.z + dz));
        }
      }
    }
  }
  return solid;
};

/**
 * As tres faces que a projecao 2:1 mostra, com a normal de cada uma e os dois
 * eixos do plano dela.
 *
 * A correspondencia nao e arbitraria e vale a pena estar escrita: um vizinho em
 * +x projeta em `sx + 2`, ou seja, sobre as duas colunas da DIREITA do cubo;
 * um vizinho em +y projeta em `sx - 2`, sobre as duas da ESQUERDA; e um vizinho
 * em +z projeta duas linhas acima, sobre o topo. Dai `right` ser a face +x,
 * `left` ser a +y e `top` ser a +z — a mesma ordem em que `RAMPS` declara as
 * cores.
 */
const FACES = {
  top: { slot: 0, n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  left: { slot: 1, n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  right: { slot: 2, n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
};

/**
 * Quantos passos de sombra uma face recebe. PURA, e exportada para teste.
 *
 * `isSolid(x, y, z)` diz se ha materia numa celula; `face` e uma das tres que a
 * projecao mostra. A funcao mede quanto a face esta metida numa fresta contando
 * os OITO vizinhos da celula vazia a frente dela — quatro pelas arestas e quatro
 * pelas quinas. So as arestas deixaria a quina interna de dois volumes que se
 * encontram em L exatamente tao clara quanto a face aberta ao lado dela, que e
 * justamente onde a sombra faz falta.
 *
 * Dois niveis, e nao um gradiente: a face lateral de um voxel mede 2x2 pixels e
 * a de topo 4x3. Nao ha area para uma rampa continua, e o que a escala consegue
 * mostrar e a diferenca entre superficie aberta, contato e fundo de fresta.
 *
 * Os cortes saem da geometria, e nao do gosto. Uma face aberta de uma caixa de
 * lados retos conta ZERO: os oito vizinhos da celula a frente dela estao todos
 * fora da caixa, entao um volume isolado nao ganha sombra nenhuma e nada do que
 * ja funcionava escurece. Uma parede subindo encostada ao lado da face ocupa
 * exatamente TRES daqueles oito — e por isso o primeiro corte e tres, e nao
 * quatro: em quatro, a sombra de contato ao pe de toda junta simplesmente nunca
 * acontecia, que foi o resultado da primeira tentativa. Uma quina interna, com
 * parede em dois lados, da cinco; uma fresta com parede dos dois lados da seis,
 * e e ai que entra o segundo passo.
 */
export const ambientOcclusionSteps = (isSolid, x, y, z, face) => {
  const spec = FACES[face];
  if (!spec) throw new Error(`face desconhecida: ${face}`);
  const [nx, ny, nz] = spec.n;
  const [ux, uy, uz] = spec.u;
  const [vx, vy, vz] = spec.v;
  const ax = x + nx;
  const ay = y + ny;
  const az = z + nz;
  let count = 0;
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      if (a === 0 && b === 0) continue;
      if (isSolid(ax + ux * a + vx * b, ay + uy * a + vy * b, az + uz * a + vz * b)) count++;
    }
  }
  return count >= 6 ? 2 : count >= 3 ? 1 : 0;
};

const shadowed = (name, steps) => {
  let out = name;
  for (let i = 0; i < steps; i++) out = SHADOW_OF[out] ?? out;
  return out;
};

/**
 * Rampa de um voxel ja com a oclusao aplicada, face a face.
 *
 * O que isto compra: sem ela, dois volumes que se encontram formam uma junta em
 * que as duas faces tem exatamente a mesma cor, e o olho nao encontra a aresta —
 * o modelo le como caixas empilhadas, e nao como um corpo. A sombra na fresta e
 * o que costura os volumes num objeto so, e e a diferenca de leitura mais barata
 * que este rasterizador consegue: nenhum voxel a mais, nenhuma cor nova.
 */
const occludedRamp = (solid, v) => {
  if (EMISSIVE.has(v.mat)) return v.ramp;
  const isSolid = (x, y, z) => solid.has(occupancyKey(x, y, z));
  let changed = false;
  const out = [v.ramp[0], v.ramp[1], v.ramp[2]];
  for (const [face, spec] of Object.entries(FACES)) {
    const steps = ambientOcclusionSteps(isSolid, v.x, v.y, v.z, face);
    if (steps === 0) continue;
    out[spec.slot] = shadowed(v.ramp[spec.slot], steps);
    changed = true;
  }
  return changed ? out : v.ramp;
};

/** Desenha um cubo isometrico com as tres faces visiveis. */
const cube = (g, sx, sy, ramp) => {
  const [top, left, right] = ramp;
  // topo: losango afunilado, o que da a leitura de faceta
  set(g, sx + 1, sy - 2, top);
  set(g, sx + 2, sy - 2, top);
  for (let i = 0; i < 4; i++) set(g, sx + i, sy - 1, top);
  // laterais
  for (let i = 0; i < VOX.zStep; i++) {
    set(g, sx + 0, sy + i, left);
    set(g, sx + 1, sy + i, left);
    set(g, sx + 2, sy + i, right);
    set(g, sx + 3, sy + i, right);
  }
};

/**
 * Rasteriza um modelo numa grade `w`x`h`.
 * @param dirIndex 0=dr, 1=dl, 2=ur, 3=ul (rotacoes do mesmo modelo)
 */
export const renderVoxels = (boxes, dirIndex, w, h, anchorX, anchorY) => {
  const rotation = DIRECTION_ROTATION[dirIndex];
  if (rotation === undefined) throw new Error(`direcao voxel invalida: ${dirIndex}`);
  const g = grid(w, h);
  const commands = [];
  // A ocupacao e medida no modelo ROTACIONADO. A rotacao e de 90 graus, entao
  // preserva a grade e a vizinhanca continua sendo a dos eixos — mas as faces
  // visiveis sao sempre +x, +y e +z na TELA, e nao no modelo autorado. Medir
  // antes de rotacionar sombrearia a face errada em tres das quatro direcoes.
  const solid = solidVoxels(boxes, rotation);
  for (const v of shellVoxels(boxes, rotation)) {
    const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
    const ramp = occludedRamp(solid, v);
    commands.push({
      key: makeDrawKey(v.x + KEY_BIAS, v.y + KEY_BIAS, v.z, 0),
      draw: () => cube(g, Math.round(anchorX + sx), Math.round(anchorY + sy), ramp),
    });
  }
  sortDrawCommands(commands); // ordem do pintor: fundo -> frente
  for (const c of commands) c.draw();
  return g;
};

/**
 * Hash estavel de uma posicao. Mesma caixa -> mesmo destino, em toda direcao e
 * em toda regeracao do atlas: os destrocos nao podem "tremer" entre as quatro
 * direcoes autoradas nem mudar quando o gerador roda de novo.
 */
const hash3 = (x, y, z) => {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h ^= h >>> 13;
  return h >>> 0;
};

/** Parte uma caixa em pedacos de no maximo `size` voxels por eixo. */
const fragment = (b, size) => {
  const out = [];
  for (let ox = 0; ox < b.w; ox += size) {
    for (let oy = 0; oy < b.d; oy += size) {
      for (let oz = 0; oz < b.h; oz += size) {
        out.push({
          x: b.x + ox,
          y: b.y + oy,
          z: b.z + oz,
          w: Math.min(size, b.w - ox),
          d: Math.min(size, b.d - oy),
          h: Math.min(size, b.h - oz),
          mat: b.mat,
        });
      }
    }
  }
  return out;
};

/**
 * Desmancha um modelo num monte de destrocos, com `t` indo de 0 (corpo intacto)
 * a 1 (so restam cacos assentados no chao).
 *
 * Por que existe: a morte de todo inimigo era `z -= fall`, ou seja, o corpo
 * inteiro afundava no chao com a silhueta intacta — some, mas nao MORRE, e o
 * jogador nao ve o golpe que matou surtir efeito. Aqui o corpo se parte: cada
 * caixa se afasta do eixo, perde altura e assenta, deixando um monte do proprio
 * material da criatura. Em um jogo cujo mundo e feito de celulas, uma criatura
 * tem de virar materia quando morre.
 *
 * O monte CONTRAI em vez de espalhar: os cacos sao puxados para o eixo do corpo
 * e so entao recebem um tremor de 1 voxel. Espalhar para fora era a primeira
 * ideia e estava errada duas vezes — encostava nas bordas do frame (o
 * fitToMargin reescalaria os ultimos quadros e o sprite pularia de tamanho no
 * meio da animacao) e contradizia a propria leitura de desabamento, em que os
 * restos ocupam MENOS espaco que a criatura de pe, nao mais.
 */
export const collapse = (boxes, t) => {
  if (t <= 0) return boxes;
  const k = Math.min(1, t);
  // Sem quebrar as caixas, cada volume so encolhia inteiro e a leitura era de um
  // corpo DERRETENDO, nao desabando: o ultimo frame saia uma laje macica em vez
  // de cacos. Partir em pedacos de 2 voxels da ao monte as falhas e as arestas
  // soltas que fazem ler como entulho.
  const pieces = boxes.flatMap((b) => fragment(b, 2));
  // Extensao do corpo intacto. O tremor e preso dentro dela para o monte nunca
  // ficar MAIOR que a criatura de pe: num modelo estreito a contracao nao
  // recupera espaco suficiente e um unico caco sacudido para fora ja estouraria
  // o frame — que e exatamente o caso que o gerador nao pode reescalar.
  const limit = boxes.reduce(
    (a, b) => ({
      minX: Math.min(a.minX, b.x),
      maxX: Math.max(a.maxX, b.x + b.w - 1),
      minY: Math.min(a.minY, b.y),
      maxY: Math.max(a.maxY, b.y + b.d - 1),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const out = [];
  for (const b of pieces) {
    const h = hash3(b.x, b.y, b.z);
    // Parte do material some conforme desaba, senao o monte final teria o mesmo
    // volume da criatura de pe. Nunca passa de 3/8 para o monte nao evaporar.
    if ((h >>> 4) % 8 < Math.round(k * 3)) continue;
    const jitterX = (h & 1) - ((h >>> 1) & 1); // -1, 0 ou 1
    const jitterY = ((h >>> 2) & 1) - ((h >>> 3) & 1);
    // Contrai o CENTRO da caixa, nao a origem: encolher `b.x` deslocava as
    // caixas largas para o lado em vez de traze-las para o eixo, e o monte
    // acabava mais largo que a criatura de pe justamente onde ela era grossa.
    const halfW = (b.w - 1) / 2;
    const halfD = (b.d - 1) / 2;
    out.push({
      x: clamp(
        Math.round((b.x + halfW) * (1 - k * 0.5) + jitterX * k - halfW),
        limit.minX,
        limit.maxX - b.w + 1
      ),
      y: clamp(
        Math.round((b.y + halfD) * (1 - k * 0.5) + jitterY * k - halfD),
        limit.minY,
        limit.maxY - b.d + 1
      ),
      // assenta: o que estava alto cai mais, entao o monte fica baixo
      z: Math.round(b.z * (1 - k)),
      w: b.w,
      d: b.d,
      // caixas altas viram lascas; nunca menos de 1 voxel, senao o caco some
      h: Math.max(1, Math.round(b.h * (1 - k * 0.7))),
      mat: b.mat,
    });
  }
  return out;
};

/**
 * Extensao projetada do modelo nas quatro direcoes. Serve para conferir que o
 * modelo cabe no frame ANTES de gerar, em vez de descobrir depois que o
 * fitToMargin reescalou o sprite em silencio.
 */
export const projectedBounds = (boxes) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let r = 0; r < 4; r++) {
    for (const v of shellVoxels(boxes, r)) {
      const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx + 3);
      minY = Math.min(minY, sy - 2);
      maxY = Math.max(maxY, sy + VOX.zStep - 1);
    }
  }
  return { w: maxX - minX + 1, h: maxY - minY + 1, minX, maxX, minY, maxY };
};
