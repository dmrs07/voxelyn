// A MASSA DE FERRO do Magnetarca: o objeto que a luta inteira pede que se leia.
//
// POR QUE ELE PRECISOU DE ATLAS. O ciclo do ferro nasceu desenhado a mao no
// cliente — um hexagono de cor chapada. Duas coisas davam errado ao mesmo
// tempo, e as duas eram sobre LEITURA e nao sobre beleza:
//
// 1. TAMANHO. A simulacao acerta a massa num raio de 0,7 tile
//    (MAGNETARCH_SHARD_RADIUS) e atropela nesse mesmo raio. O hexagono saia a
//    23% disso. O jogador mirava num cascalho e o tiro passava por cima de uma
//    coisa que ele nao via — e o contra-jogo do encontro e justamente atirar
//    nela.
// 2. MATERIA. Chapado e cinza, num chao de rocha cinza-azulada, ele lia como
//    entulho de cenario. Nada dizia "isto e alvo".
//
// A DECISAO DE COR resolve o item 2 e e a unica coisa aqui que nao e gosto: a
// massa e QUENTE (rampa `ferrite`, em voxel.mjs) sobre um chao que e FRIO (a
// familia `rock`, azul-acinzentada) em todo o Estrato Ferrifero — e quente nas
// TRES faces, que e a razao de a rampa existir. A separacao sobrevive a
// distancia, em escala de cinza e por cima da limalha do campo, porque e de
// matiz E de valor. Um caco de minerio cinza seria exatamente o entulho que ele
// era.
//
// OS DOIS ESTADOS sao anims distintas, e nao uma tinta aplicada por cima:
//
//   - `idle`    = INTEIRA. Faiscas `electric` (azuis, frias) orbitando: e o
//                 campo do chefe segurando o minerio, a mesma cor das costuras
//                 do corpo dele. Diz de quem ela e, sem dizer que esta pronta.
//   - `special` = FRATURADA. A massa se ABRE e a fenda acende em brasa, com
//                 limalha escapando por ela. Quente contra o frio das faiscas:
//                 as duas leituras nao dependem de o jogador lembrar qual azul
//                 era qual.
//
// Fraturar e a decisao cara da luta — tres tiros que custam a janela inteira de
// mira no chefe. Quem ja gastou os tres precisa ver, de relance e do outro lado
// da camara, que nao precisa gastar o quarto.
import { box, DIR_UNROTATED, renderVoxels } from './voxel.mjs';

/**
 * O canvas e a ancora, em pixels de atlas.
 *
 * A ancora e o PONTO DE CHAO: o modelo tem origem em (0,0,0) e o cliente
 * carimba o sprite na projecao de (shard.x, shard.y). Nao ha eixo Z na
 * simulacao — a massa e arrastada rente ao chao —, entao origem e chao sao a
 * mesma coisa e nao ha o que conciliar.
 *
 * O quadro (84x76) e a ancora nao sao numeros redondos: saem da caixa
 * projetada MEDIDA dos oito quadros — 63x62 px, com a limalha da fratura
 * incluida — mais oito pixels de folga de cada lado. FX nao passa por
 * `fitSpriteToMargin` (o enquadramento automatico dos sheets de personagem):
 * o canvas autorado e o canvas final, e um quadro apertado significa conteudo
 * tocando a borda, que e o sprite sendo cortado.
 */
export const SHARD_FRAME_W = 84;
export const SHARD_FRAME_H = 76;
export const SHARD_ANCHOR_X = 40;
export const SHARD_ANCHOR_Y = 53;

/**
 * A meia-extensao do corpo, em unidades de modelo (8 = um tile de mundo).
 *
 * 4,0 e DERIVADO e nao escolhido: o raio autoritativo da massa e 0,7 tile =
 * 5,6 unidades, e um corpo de meia-aresta `a` alcanca `a * raiz(2)` na
 * diagonal. Com 4,0 a diagonal da 5,66 — o contorno encosta no raio que a
 * simulacao cobra, sem passar dele. E o numero que fecha o buraco que este
 * atlas veio consertar: o desenho a mao saia a 23% dele, e o jogador mirava
 * num cascalho enquanto o tiro passava por cima do alvo de verdade.
 *
 * Vale como limite do laco e como raio da orbita das faiscas; os domos abaixo
 * ficam um degrau para dentro, porque a rugosidade os faz transbordar.
 */
const A = 4;

/**
 * Ruido determinístico, de 0 a 1.
 *
 * A massa e IRREGULAR, e irregular sem ruido vira escadinha: a primeira versao
 * empilhava caixas concentricas e saiu um zigurate — leitura de CONSTRUCAO, que
 * e o oposto de pedra arrancada de um veio.
 *
 * O ruido tem de ser o MESMO toda vez que o atlas e assado. `Math.random` daria
 * uma pedra por execucao e um PNG diferente a cada geracao, e o pacote de
 * conteudo inteiro e determinístico por contrato — e o que permite conferir um
 * atlas por hash em vez de por olho.
 */
const noise = (x, y, z) => {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * A massa, como MAPA DE ALTURA e nao como campo 3D.
 *
 * A tentativa anterior testava um elipsoide celula a celula com ruido somado ao
 * raio, e ela falhou de duas maneiras opostas conforme a intensidade do ruido:
 * fraco, a superficie descia em degraus regulares e a pedra lia como terraco;
 * forte, o topo abria em espinhos e vaos e ela lia como coral. As duas vem do
 * mesmo defeito — perto do topo o campo quadratico muda depressa, entao a
 * MESMA perturbacao vale meio degrau no equador e tres degraus no alto.
 *
 * Um mapa de altura nao tem esse problema: a rugosidade e dada em DEGRAUS, que
 * e a unidade em que ela vai ser vista, e vale o mesmo em qualquer parte do
 * corpo. E, por construcao, o solido nao tem vao interno nem lasca solta — as
 * duas coisas que o rasterizador so revela depois de assado.
 *
 * Uma massa arrancada de um veio esta POUSADA no chao, nao suspensa: mapa de
 * altura e a forma certa do objeto, e nao um atalho.
 */
const DOMES = [
  { cx: 0, cy: 0, rx: 3.8, ry: 3.4, h: 7.4 },
  // Duas corcovas na BORDA da principal, e nao em cima dela: dentro do raio
  // maior a altura ja e maior, e a corcova nao apareceria. E das quinas fora do
  // contorno que vem a silhueta que nao se repete em nenhum eixo.
  { cx: 3.2, cy: -0.6, rx: 2.2, ry: 2, h: 3.8 },
  { cx: -2.6, cy: 2.1, rx: 2.3, ry: 1.9, h: 3.2 },
];

/**
 * A altura da massa nesta coluna, em celulas. Negativa = fora do corpo.
 *
 * O expoente 0,5 achata o alto e endireita o flanco: uma esfera pura le como
 * seixo de rio, e o que a camara do Magnetarca tem no chao e minerio quebrado.
 * O ruido entra em DEGRAUS (±0,8 celula), depois do perfil e nao dentro dele.
 *
 * Colunas de menos de meia celula nao entram: a franja de uma celula de altura
 * em volta do corpo nao le como base, le como PES — foi assim que a massa saiu
 * apoiada em quatro tocos na primeira vez que teve uma saia larga.
 */
const columnHeight = (x, y) => {
  let h = -1;
  for (const d of DOMES) {
    const r2 = ((x - d.cx) / d.rx) ** 2 + ((y - d.cy) / d.ry) ** 2;
    if (r2 >= 1) continue;
    h = Math.max(h, d.h * (1 - r2) ** 0.5);
  }
  return h < 0 ? -1 : h + (noise(x, y, 0) - 0.45) * 1.6;
};

/**
 * A FENDA da massa fraturada, como GEOMETRIA e nao como risco pintado.
 *
 * Ela corta o corpo num plano inclinado e para antes do pe: a massa se abre no
 * alto e continua inteira embaixo, que e como uma pedra racha. Uma fenda que
 * atravessasse tudo partiria a massa em duas pedras, e duas pedras seriam duas
 * coisas para atirar.
 *
 * O estado sobrevive a SILHUETA: sem uma cor sequer, uma massa fraturada tem
 * uma greta no alto e uma massa inteira nao tem. Foi a mesma regra dos cofres
 * por classe — a classe tem de ler em escala de cinza.
 */
const inCleft = (x, y, z) => z >= 2 && Math.abs(x - 0.45 * y + 0.6) < 0.7 + (z - 2) * 0.22;

const present = (cracked, x, y, z) => {
  if (z < 0) return false;
  const h = columnHeight(x, y);
  return h >= 0.6 && z <= h && !(cracked && inCleft(x, y, z));
};

const NEIGHBOURS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/**
 * O corpo, celula a celula.
 *
 * MATERIA: o volume inteiro e `ferrite` (a rampa de minerio bruto, ver
 * voxel.mjs, que e onde a escolha de familia esta explicada), sobre um pe de
 * magnetita.
 *
 * A parede da FENDA acende: o miolo da massa exposto. Nao e um decalque na
 * superficie — sao as celulas que fazem fronteira com o vao, entao a luz vem de
 * DENTRO, que e o que a fratura significa.
 */
const massBody = (cracked) => {
  const b = [];
  for (let z = 0; z <= 8; z++) {
    for (let y = -A - 1; y <= A + 1; y++) {
      for (let x = -A - 1; x <= A + 1; x++) {
        if (!present(cracked, x, y, z)) continue;
        let neighbours = 0;
        for (const [dx, dy, dz] of NEIGHBOURS) {
          if (present(cracked, x + dx, y + dy, z + dz)) neighbours++;
        }
        // Celula ENTERRADA nao entra: o rasterizador pagaria por ela em todo
        // quadro sem pintar um pixel.
        if (neighbours === 6) continue;
        // UM MATERIAL SO no corpo, e isso e uma conclusao e nao preguica.
        // Tres tentativas de salpicar magnetita falharam pelo mesmo motivo:
        // mancha ESCURA sobre pedra clara le como BURACO (em faixa, pior — le
        // como andar de predio). O relevo e a oclusao ja dao a textura, e a
        // rampa `ferrite` ja da as tres faces; uma segunda cor no meio disso so
        // compete com o unico contraste que precisa sobreviver, o da fratura.
        //
        // A magnetita fica onde ela NAO vira mancha: o PE. Uma faixa escura na
        // base assenta a massa no chao em vez de deixa-la pousada em cima dele.
        let mat = z === 0 ? 'rockDeep' : 'ferrite';
        // A PAREDE DA FENDA, em `fire` (brasa, chama) e nao em `lamp`.
        //
        // `lamp` topa em `beam`, o branco quente, e as tres cores dela emitem:
        // medido no jogo, a massa fraturada virou uma BOLA DE LUZ e o corpo de
        // pedra sumiu dentro do halo. Uma fratura tem de continuar sendo uma
        // pedra rachada — se o objeto deixa de ser reconhecivel, o estado
        // deixou de ser um estado DELE. Em brasa o miolo acende sem apagar o
        // que acendeu.
        if (cracked && (inCleft(x + 1, y, z) || inCleft(x - 1, y, z) || inCleft(x, y, z + 1))) {
          mat = 'fire';
        }
        b.push(box(x - 0.5, y - 0.5, z, 1, 1, 1, mat));
      }
    }
  }
  return b;
};

/**
 * As faiscas do campo, para a massa INTEIRA.
 *
 * Azuis (`electric`, emissiva) e tres. Elas ORBITAM POR FORA da silhueta: e o
 * unico movimento do quadro parado, e e ele que separa "a massa esta presa no
 * campo do chefe" de "ha uma pedra no chao". O corpo nao balanca junto — pedra
 * que oscila no lugar e pedra que o jogador nao consegue mirar, e o validador
 * cobra a mesma coisa pelo centroide.
 */
const fieldSparks = (f) => {
  const b = [];
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 + (f / 4) * Math.PI * 0.5;
    b.push(
      box(
        Math.cos(a) * (A + 0.4) - 0.5,
        Math.sin(a) * (A - 0.2) - 0.5,
        1.6 + (i % 3) * 2.2,
        1,
        1,
        1,
        'electric',
      ),
    );
  }
  return b;
};

/**
 * A LIMALHA escapando pela fenda. Sobe e esfria de branco quente para brasa: o
 * material se perdendo e o que a fratura significa, e e por ele que o retorno
 * cobra do chefe.
 */
const filings = (f) => {
  const b = [];
  for (let i = 0; i < 5; i++) {
    const t = ((f + i * 1.7) % 4) / 4;
    b.push(
      box(
        -1.6 + i * 0.9 - 0.35,
        -0.4 + (i % 2) * 1.4 - 0.35,
        6.6 + t * 3.4,
        0.7,
        0.7,
        0.7,
        t > 0.55 ? 'fire' : 'lamp',
      ),
    );
  }
  return b;
};

export const magnetShardModel = (anim, f) =>
  anim === 'special' ? [...massBody(true), ...filings(f)] : [...massBody(false), ...fieldSparks(f)];

export const MAGNET_SHARD_SPEC = {
  id: 'fx-magnet-shard',
  version: 1,
  frameWidth: SHARD_FRAME_W,
  frameHeight: SHARD_FRAME_H,
  anchorX: SHARD_ANCHOR_X,
  anchorY: SHARD_ANCHOR_Y,
  // Um rumo so: e um pedaco de minerio, e pedaco de minerio nao tem frente.
  // Autorar quatro seria quadruplicar o atlas para desenhar a mesma pedra.
  directions: 1,
  authoredDirs: ['n'],
  flipPairs: {},
  hitbox: { w: 1.4, h: 1.4 },
  footprint: { w: 1.4, h: 1.4, offsetX: 0, offsetY: 0 },
  animations: {
    idle: { frames: 4, fps: 6, loop: true },
    special: { frames: 4, fps: 8, loop: true },
  },
  // Sem giro de camera: a pedra e a mesma de qualquer lado, e girar o modelo so
  // faria a face iluminada trocar de lugar entre quadros.
  draw: (_dir, anim, f) =>
    renderVoxels(
      magnetShardModel(anim, f),
      DIR_UNROTATED,
      SHARD_FRAME_W,
      SHARD_FRAME_H,
      SHARD_ANCHOR_X,
      SHARD_ANCHOR_Y,
    ),
  prompt:
    'voxel-isometric chunk of ferric ore held in a magnetic field, warm rust-and-brass faceted boulder with dark magnetite veins on a cold base, blue field sparks clinging to it; fractured variant split open with a glowing white-hot fissure and iron filings escaping',
};
