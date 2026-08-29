// Voxelizacao: transforma as box-lists CANONICAS do jogo numa grade densa que o
// raytracer em perspectiva sabe percorrer.
//
// POR QUE ESTA CAMADA EXISTE
// --------------------------
// Todo modelo do Voxelyn Survival — o Prospector, o Guardiao, o Nucleo, um bloco
// de parede, uma crosta de chao — e a MESMA coisa: uma lista de `box(x, y, z, w,
// d, h, mat)` em unidades autoradas. O rasterizador isometrico do jogo
// (`voxel.mjs`) consome essa lista projetando cubo a cubo na ordem do pintor,
// que e o certo para um sprite de atlas e o errado para uma camera em
// perspectiva: em perspectiva nao ha ordem do pintor que resolva oclusao entre
// milhoes de voxels, e cada raio precisa de uma consulta O(1) por celula.
//
// Entao aqui as MESMAS listas viram ocupacao densa. Nenhum modelo e redesenhado
// e nenhuma geometria e inventada: `voxelize` e uma mudanca de estrutura de
// dados, nao de conteudo. A prova disso e que a unidade e a mesma que o
// rasterizador usa — MODEL_SCALE voxels finos por unidade autorada — e a
// conversao e o mesmo `Math.round` de `shellVoxels`.
//
// A diferenca de tratamento entre casca e macico tambem se inverte de proposito.
// O rasterizador descarta o interior (nunca visivel na projecao fixa); aqui o
// interior e GRAVADO, porque uma camera livre pode entrar numa fenda aberta pela
// silhueta de outro objeto e um corpo oco apareceria vazado.
import { MODEL_SCALE, RAMPS, EMISSIVE } from '../voxel.mjs';
import { COLORS } from '../lib.mjs';

/** Voxels finos por unidade autorada. Identico ao rasterizador do jogo. */
export const F = MODEL_SCALE;
/** Voxels finos por tile do mundo (8 unidades autoradas * MODEL_SCALE). */
export const VOXELS_PER_TILE = 8 * MODEL_SCALE;

/**
 * Indice numerico de cada MATERIAL do jogo.
 *
 * A lista e `Object.keys(RAMPS)` — as chaves de material do rasterizador, e nao
 * as cores da paleta. A distincao importa e custou um erro para ficar clara: as
 * caixas dos modelos carregam `mat: 'floor'`, `'rockDeep'`, `'rust'`, que sao
 * MATERIAIS; `COLORS` guarda `dark`, `rockShadow`, `bone`, que sao as CORES em
 * que cada material e desenhado, face a face. Indexar a grade por cor perderia a
 * identidade do material (dois materiais diferentes podem partilhar a cor de uma
 * face) e, com ela, a segmentacao e a resposta correta a luz.
 *
 * O id 0 e vazio, e nenhum material o ocupa: um mundo cujo ar e indistinguivel
 * do material mais escuro nao pode ser percorrido pelo tracador.
 */
export const MATERIAL_IDS = ['', ...Object.keys(RAMPS)];
export const MATERIAL_INDEX = Object.fromEntries(MATERIAL_IDS.map((name, i) => [name, i]));

/**
 * ALBEDO de cada material: a MEDIA LINEAR das tres cores da rampa dele.
 *
 * A rampa declara topo, esquerda e direita — o mesmo material nas tres faces que
 * a projecao do jogo mostra, ja sob a key light fixa que vem de cima e da
 * esquerda. Nenhuma das tres e refletancia pura, e a pergunta e como extrair
 * refletancia de tres amostras sombreadas.
 *
 * Duas tentativas anteriores erraram por lados opostos, e as duas ensinaram algo:
 *
 *   - a face de TOPO (a mais clara) empilhava dois ganhos, porque ela ja e o
 *     material sob luz cheia e a equacao a iluminava de novo. A cena saiu
 *     azul-clara e chapada, com o basalto lendo como concreto;
 *   - a face do MEIO corrigiu isso para as paredes, mas quebrou o chao. O
 *     material `floor` tem rampa ['rockShadow', 'dark', 'dark']: a face do meio
 *     dele e quase preta, e o chao — que a camera ve pelo TOPO — ficava sem
 *     albedo nenhum. A luz do nucleo derramada sobre ele nao produzia poca
 *     visivel, porque nao havia o que refletir.
 *
 * A media das tres nao privilegia face nenhuma, e e a estimativa honesta de
 * refletancia media a partir de tres amostras da mesma superficie sob luz
 * conhecida. A media e feita em LINEAR e nao em sRGB: media de valores gama e
 * uma operacao sem significado fisico, e escurece sistematicamente.
 *
 * Emissivos ficam de fora e continuam com a face de topo: ali a rampa nao esta
 * sombreando e sim declarando a cor da fonte (`biolum` tem rampa ['biolum',
 * 'fungusLight', 'fungus'], e so a primeira e o ciano do cristal). Mediar
 * apagaria justamente o que a hierarquia luminosa poe no topo.
 */
const srgbToLinearChannel = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linearToSrgbChannel = (v) =>
  Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055));

export const MATERIAL_RGB = MATERIAL_IDS.map((name) => {
  if (!name) return [0, 0, 0];
  const ramp = RAMPS[name];
  if (EMISSIVE.has(name) || name === 'lamp') return COLORS[ramp[0]];
  const acc = [0, 0, 0];
  for (const faceColor of ramp) {
    const rgb = COLORS[faceColor];
    for (let c = 0; c < 3; c++) acc[c] += srgbToLinearChannel(rgb[c]) / 3;
  }
  return acc.map(linearToSrgbChannel);
});

/**
 * Materiais que EMITEM, por id.
 *
 * A base e o `EMISSIVE` do rasterizador do jogo, importado e nao recopiado: se o
 * jogo passar a tratar um material como fonte, a splash acompanha. `lamp` entra
 * alem dele porque suas TRES faces sao cores emissivas (`['beam','amber','fire']`)
 * — o proprio comentario de `RAMPS` diz que a lente acende inteira em qualquer
 * direcao. Ele nao esta no conjunto do jogo porque la o conjunto serve a outra
 * pergunta: quais materiais nao devem receber oclusao de ambiente.
 */
export const EMISSIVE_BY_ID = MATERIAL_IDS.map((name) =>
  name && (EMISSIVE.has(name) || name === 'lamp') ? 1 : 0
);

/**
 * Cena densa: material e id de objeto por celula, mais uma malha grossa de
 * ocupacao para o raio pular vazio.
 *
 * `brick` existe porque a cena e majoritariamente ar: uma area de 96x96 com
 * paredes de 7 unidades de altura enche menos de um decimo do volume enquadrado,
 * e sem pulo o raio gastaria centenas de passos atravessando nada antes do
 * primeiro contato. Com bricos de 8 o custo de percorrer o vazio cai pela mesma
 * ordem de grandeza.
 */
export const createScene = (width, height, depth) => {
  const bw = Math.ceil(width / 8);
  const bh = Math.ceil(height / 8);
  const bd = Math.ceil(depth / 8);
  return {
    width,
    height,
    depth,
    mat: new Uint8Array(width * height * depth),
    obj: new Uint8Array(width * height * depth),
    brick: new Uint8Array(bw * bh * bd),
    bw,
    bh,
    bd,
  };
};

export const sceneIndex = (s, x, y, z) => (z * s.height + y) * s.width + x;

export const setVoxel = (s, x, y, z, matId, objId) => {
  if (x < 0 || y < 0 || z < 0 || x >= s.width || y >= s.height || z >= s.depth) return;
  const i = (z * s.height + y) * s.width + x;
  s.mat[i] = matId;
  s.obj[i] = objId;
  s.brick[((z >> 3) * s.bh + (y >> 3)) * s.bw + (x >> 3)] = 1;
};

export const getMat = (s, x, y, z) => {
  if (x < 0 || y < 0 || z < 0 || x >= s.width || y >= s.height || z >= s.depth) return 0;
  return s.mat[(z * s.height + y) * s.width + x];
};

/**
 * Grava uma box-list na grade, deslocada para a posicao de mundo.
 *
 * `ox/oy/oz` sao dados em voxels FINOS, e nao em unidade autorada, porque quem
 * posiciona pensa em tiles do worldgen (16 finos cada) e nao na grade em que os
 * modelos foram desenhados. Converter aqui evita que cada chamador repita a
 * multiplicacao — e foi repetir essa multiplicacao que desalinhou o atlas de
 * blocos em 2px, segundo o comentario de `blockBounds`.
 *
 * As caixas sao gravadas MACICAS. Ver o cabecalho: casca serve para desenhar
 * numa projecao fixa, nao para um raio que pode entrar por qualquer lado.
 */
export const stampBoxes = (scene, boxes, ox, oy, oz, objId) => {
  for (const b of boxes) {
    const matId = MATERIAL_INDEX[b.mat];
    if (!matId) throw new Error(`material fora da paleta mestra: ${b.mat}`);
    const x0 = Math.round(b.x * F) + ox;
    const y0 = Math.round(b.y * F) + oy;
    const z0 = Math.round(b.z * F) + oz;
    const w = Math.max(1, Math.round(b.w * F));
    const d = Math.max(1, Math.round(b.d * F));
    const h = Math.max(1, Math.round(b.h * F));
    for (let dz = 0; dz < h; dz++) {
      for (let dy = 0; dy < d; dy++) {
        for (let dx = 0; dx < w; dx++) {
          setVoxel(scene, x0 + dx, y0 + dy, z0 + dz, matId, objId);
        }
      }
    }
  }
};

/**
 * Rotaciona uma box-list em passos de 90 graus em torno de z.
 *
 * As quatro direcoes autoradas do jogo sao a mesma rotacao (`voxel.mjs:rot`), e e
 * de proposito que a conta seja repetida aqui em vez de importada: la ela opera
 * sobre voxels JA expandidos e em unidades finas; aqui opera sobre a caixa
 * inteira, antes da expansao, o que preserva a caixa como caixa. Um modelo
 * rotacionado depois da expansao custaria a expansao inteira por direcao.
 *
 * Modelos sao autorados com a FRENTE em -y; girar e a unica forma honesta de
 * virar um personagem sem redesenhar a anatomia dele.
 */
export const rotateBoxes = (boxes, turns) => {
  const r = ((turns % 4) + 4) % 4;
  if (r === 0) return boxes;
  return boxes.map((b) => {
    // O canto de origem muda de lado quando o eixo inverte: girar `x` sem
    // recolocar a origem espelha a caixa para fora do corpo.
    const x1 = b.x + b.w;
    const y1 = b.y + b.d;
    if (r === 1) return { x: -y1, y: b.x, z: b.z, w: b.d, d: b.w, h: b.h, mat: b.mat };
    if (r === 2) return { x: -x1, y: -y1, z: b.z, w: b.w, d: b.d, h: b.h, mat: b.mat };
    return { x: b.y, y: -x1, z: b.z, w: b.d, d: b.w, h: b.h, mat: b.mat };
  });
};

/** Extensao autorada de uma box-list, para assentar um modelo no chao. */
export const boxesBounds = (boxes) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x + b.w);
    minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y + b.d);
    minZ = Math.min(minZ, b.z); maxZ = Math.max(maxZ, b.z + b.h);
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
};
