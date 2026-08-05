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
  /**
   * METAL e OSSO. O intermediario entra no MEIO, e nunca nas pontas.
   *
   * `rust` ia de osso (67) direto para ferrugem (31): 35 pontos de luminancia
   * entre duas faces do MESMO voxel, sem nada no caminho.
   *
   * A primeira correcao trocou as PONTAS pelos meios-tons (brass/rust/rockShadow)
   * e foi um erro caro: os passos ficaram curtos, mas a amplitude do material caiu
   * um terco, e com ela o contraste facetado que e a identidade visual do jogo. O
   * mesmo aconteceu com todos: `player` perdeu 56% de amplitude, `fungus` 33%.
   * Uniforme e sem contraste e pior do que contrastado com salto.
   *
   * Com tres faces so, passo curto e amplitude larga sao objetivos opostos —
   * dividir 53 pontos em dois passos da 26 em cada, e nao ha o que discutir. O
   * que a paleta nova permite e o intermediario cair no MEIO exato desses 53:
   * mesmo topo, mesma base, e o degrau do meio no lugar certo. Os passos caem de
   * 35/17 para 21/32 sem custar um ponto de amplitude.
   *
   * (Os cinco passos por material continuam existindo, mas nas ESCADAS de sombra
   * e realce, que e onde ha resolucao para eles: um voxel de latao pode sair em
   * chalk, bone, brass, rust ou rockShadow conforme a geometria. A rampa tem tres
   * entradas porque o rasterizador desenha tres faces por voxel — isso e
   * estrutural, nao uma escolha de paleta.)
   */
  rust: ['bone', 'brass', 'rockShadow'],
  bone: ['bone', 'brass', 'rockShadow'],
  fungus: ['fungusLight', 'moss', 'fungusDark'],
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
   * Agua do Aquifero Negro: a mesma logica de leitura da poca — liquido parado
   * le por profundidade — mas na familia AZUL da rocha, nunca na verde do
   * fungo. O topo e `rock` (azul-acinzentado) para a lamina se separar do
   * leito escuro; o brilho vem de voxels `electric` avulsos, entao a agua e
   * escura com reflexos frios, e o biofluido continua sendo o unico liquido
   * verde do jogo.
   */
  water: ['rock', 'rockShadow', 'dark'],
  /**
   * Gelo da Cripta Glacial: a lamina mais CLARA do chao, na familia fria.
   * Topo `mist` (o cinza-azulado palido) sobre laterais de rocha — le como
   * placa solida e leitosa, o oposto da agua escura que ele vira ao derreter.
   * Nao emite: gelo nao brilha, ele reflete — os brilhos sao voxels `electric`
   * avulsos no proprio modelo.
   */
  ice: ['mist', 'rockLight', 'rockShadow'],
  /**
   * Silica solta dos Sumidouros: a areia palida que o Devorador revolve.
   *
   * Familia quente neutra, um degrau ACIMA do osso: o rastro dele precisa ser
   * lido de longe e a distancia so a luminancia sobrevive. E o material mais
   * claro do chao — o que e proposital, porque ele so aparece onde alguma coisa
   * passou por baixo.
   */
  silt: ['chalk', 'bone', 'brass'],
  /**
   * Vidro: a silica DEPOIS do calor. Mais claro que o gelo e frio como ele.
   *
   * As duas placas do jogo precisam se separar a distancia porque significam
   * coisas opostas — o gelo derrete e vira agua, o vidro sela o chao e nega a
   * emergencia. O gelo topa em `mist`; o vidro topa no branco azulado do
   * jogador, um degrau acima, e cai mais fundo nas laterais: placa polida
   * reflete forte em cima e escurece rapido de lado, que e o que separa vidro
   * de neve.
   *
   * A base e `rock` e nao `rockLight` por causa do salto: de branco azulado
   * direto para rockLight o primeiro passo comia 66% da rampa, e uma rampa com
   * um degrau so nao e volume, e um decalque claro. Descer ate `rock` poe
   * `mist` no meio da escada E aprofunda as laterais, que era o que a leitura
   * de placa polida pedia de qualquer jeito.
   */
  glass: ['player', 'mist', 'rock'],
  /**
   * Gas sulfuroso: crosta amarela sobre corpo esverdeado.
   *
   * O gas era `acid` puro — verde-limao — e a paleta nao tem amarelo de enxofre.
   * Combinando `loot` no topo com `acid` na lateral a leitura vira amarelo
   * esverdeado, que e o enxofre, e separa o gas do fungo e da poca de uma vez.
   */
  sulfur: ['loot', 'acid', 'fungusDark'],
  // Chama: sem ouro no topo. Ouro e minerio, e o topo de uma chama nao e feito
  // do mesmo material que o chao onde ela queima — alem de o ouro nao emitir, o
  // que deixava a face mais visivel do fogo fora do halo.
  fire: ['amber', 'fire', 'blood'],
  /**
   * FAROL. Lampada acesa: nem ouro, nem chama.
   *
   * Existe porque nao havia material para "luz branca quente" e as duas
   * tentativas de improvisar erraram. Em `loot` o farol era OURO — o material de
   * que sao feitos casco, fivela e minerio —, entao a peca que o bot usa para
   * enxergar no escuro nao emitia e acendia menos que o cascalho no chao. Em
   * `fire` ele emitia, mas passava a ser CHAMA: um farol tatico nao queima, e a
   * mesma cor que desenha incendio no chao nao pode desenhar o equipamento que
   * ilumina o caminho.
   *
   * A rampa sobe pelos degraus novos — branco quente, brasa, chama — e as tres
   * faces emitem, entao a lente acende inteira em qualquer direcao.
   */
  lamp: ['beam', 'amber', 'fire'],
  blood: ['blood', 'char', 'dark'],
  electric: ['electric', 'mist', 'rock'],
  /**
   * Ouro: a rampa de maior amplitude do jogo, e continua sendo.
   *
   * Metal polido reflete o topo com forca e cai rapido nas laterais — e esse
   * contraste que faz ouro parecer ouro em vez de tinta amarela. O intermediario
   * corta o salto de 51 pontos ao meio sem encolher os 69 de amplitude.
   */
  loot: ['loot', 'brass', 'rockShadow'],
  player: ['player', 'bone', 'rust'],
};

/**
 * SOMBRA de cada cor da paleta mestra: um passo abaixo, dentro da propria paleta.
 *
 * A oclusao de ambiente nao pode multiplicar canal: a Art Bible fixa a paleta e
 * o validador rejeita qualquer pixel fora dela. Escurecer aqui e ESCOLHER a
 * proxima cor da escada, e nao calcular uma. Cada entrada e o vizinho
 * mais escuro plausivel dentro da mesma familia, e a escada termina em `dark`,
 * que e sombra de si mesma.
 *
 * Uma tabela unica em vez de uma escada por material porque a mesma cor aparece
 * em rampas diferentes: `rust` e o meio-tom do latao e tambem a base do fogo.
 * Com uma escada por familia, ela teria dois destinos e a sombra de uma peca
 * dependeria de qual material a citou primeiro.
 */
export const SHADOW_OF = {
  // quente/neutra
  player: 'chalk',
  chalk: 'bone',
  bone: 'brass',
  brass: 'rust',
  rust: 'char',
  char: 'dark',
  // fria
  mist: 'rockLight',
  rockLight: 'rock',
  rock: 'rockShadow',
  rockShadow: 'dark',
  // verde
  biolum: 'fungusLight',
  fungusLight: 'moss',
  moss: 'fungus',
  fungus: 'fungusDark',
  fungusDark: 'dark',
  acid: 'fungusLight',
  // quente viva
  beam: 'amber',
  loot: 'bone',
  amber: 'fire',
  fire: 'blood',
  blood: 'char',
  electric: 'mist',
  dark: 'dark',
};

/**
 * LUZ de cada cor: um passo acima, pelo caminho inverso da sombra.
 *
 * Existe pelo mesmo motivo que `SHADOW_OF`, e nao e a inversa dela por acidente
 * — e a inversa dela de proposito. Uma aresta so le como aresta se o claro de um
 * lado e o escuro do outro pertencerem a MESMA escada; misturar familias na
 * subida daria brilho de outra cor, que a esta escala vira sujeira.
 *
 * Com os degraus intermediarios da paleta a subida deixou de ter buracos: de
 * ferrugem a branco sao agora cinco passos curtos (rust, brass, bone, chalk,
 * player) no lugar dos tres saltos que existiam antes.
 */
export const LIGHT_OF = {
  // quente/neutra
  char: 'rust',
  rust: 'brass',
  brass: 'bone',
  bone: 'chalk',
  chalk: 'player',
  // fria
  rockShadow: 'rock',
  rock: 'rockLight',
  rockLight: 'mist',
  mist: 'chalk',
  dark: 'rockShadow',
  // verde
  fungusDark: 'fungus',
  fungus: 'moss',
  moss: 'fungusLight',
  /**
   * TETO da escada. Aqui o realce simplesmente nao acontece.
   *
   * A regra nao e "acabou a paleta" — e que o passo seguinte cruzaria para uma
   * cor EMISSIVA, e uma quina iluminada de metal comum nao pode virar fonte de
   * luz: ela ganharia halo no runtime e prometeria uma mecanica que nao existe.
   * `fungusLight` pararia em biolum, `blood` em fire, `loot` em beam.
   *
   * Os proprios emissivos param por serem emissivos: material emissivo nao
   * recebe nem sombra nem realce, entao estas entradas so existem para a tabela
   * ser total.
   */
  fungusLight: 'fungusLight',
  blood: 'blood',
  loot: 'loot',
  player: 'player',
  acid: 'acid',
  biolum: 'biolum',
  electric: 'electric',
  fire: 'fire',
  amber: 'amber',
  beam: 'beam',
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
export const EMISSIVE = new Set(['biolum', 'electric', 'fire', 'acid', 'amber', 'beam']);

/** Caixa de voxels. Eixos: x = leste, y = sul, z = cima; origem entre os pes. */
export const box = (x, y, z, w, d, h, mat) => ({ x, y, z, w, d, h, mat });

// Um voxel na projecao 2:1: 4px de largura, 2px de topo, 2px de lateral.
// tileW/tileH/zStep sao os parametros que projectIso() do core espera.
//
// 4/2/2 e o MINIMO da grade de pixel isometrica 2:1: o passo horizontal e
// tileW/2 e o vertical e tileH/2, entao qualquer cubo menor projetaria em
// coordenadas fracionarias e o arredondamento abriria furos entre vizinhos.
// Ganhar resolucao nao passa por encolher o cubo — passa por subdividir o
// MODELO (MODEL_SCALE) e dobrar o canvas.
export const VOX = { tileW: 4, tileH: 2, zStep: 2 };

/**
 * Subdivisao da grade: cada unidade AUTORADA vira 2x2x2 voxels finos.
 *
 * Por que existe: o detalhe dos personagens estava travado no voxel de 4px —
 * um tile logico tinha 8 voxels de diagonal e nenhuma superficie tinha textura
 * mais fina que isso. Subdividir o modelo dobra a resolucao de TUDO que o
 * rasterizador calcula por voxel (oclusao, quina acesa, desabamento da morte,
 * malha volumetrica do terreno) sem tocar na projecao nem nos modelos: as
 * caixas continuam autoradas na unidade antiga, e meio-passo (0.5) passa a ser
 * a unidade nova de detalhe fino.
 *
 * O preco e explicito e pago junto: canvas e ancora dos sprites DOBRAM, o
 * atlas quadruplica em area e o cliente desenha tudo com metade do zoom para o
 * mundo continuar do mesmo tamanho na tela (ATLAS_SCALE, no runtime).
 */
export const MODEL_SCALE = 2;
const fine = (v) => Math.round(v * MODEL_SCALE);

// makeDrawKey desloca bits, entao exige coordenadas nao-negativas. Os modelos
// sao autorados em torno da origem (pes no centro), logo precisam deste offset.
// Em unidades FINAS o alcance dobrou, e o bias acompanha.
const KEY_BIAS = 128;

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

/**
 * Expande caixas em voxels FINOS, descartando os internos (nunca visiveis).
 *
 * A subdivisao acontece aqui, e nao nos modelos: uma caixa autorada de 1x1x1
 * vira 2x2x2 voxels finos, cada um com oclusao, quina e ordem do pintor
 * proprias. Coordenadas e tamanhos fracionarios (meio-passo) arredondam para a
 * grade fina — e o meio-passo que da aos modelos a resolucao nova.
 */
const shellVoxels = (boxes, r) => {
  const out = [];
  for (const b of boxes) {
    const ramp = RAMPS[b.mat];
    if (!ramp) throw new Error(`material sem rampa: ${b.mat}`);
    const x0 = fine(b.x);
    const y0 = fine(b.y);
    const z0 = fine(b.z);
    const w = Math.max(1, fine(b.w));
    const d = Math.max(1, fine(b.d));
    const h = Math.max(1, fine(b.h));
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        for (let dz = 0; dz < h; dz++) {
          const interior =
            dx > 0 && dx < w - 1 && dy > 0 && dy < d - 1 && dz > 0 && dz < h - 1;
          if (interior) continue;
          const [x, y] = rot(x0 + dx, y0 + dy, r);
          out.push({ x, y, z: z0 + dz, ramp, mat: b.mat });
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
    const x0 = fine(b.x);
    const y0 = fine(b.y);
    const z0 = fine(b.z);
    const w = Math.max(1, fine(b.w));
    const d = Math.max(1, fine(b.d));
    const h = Math.max(1, fine(b.h));
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < d; dy++) {
        for (let dz = 0; dz < h; dz++) {
          const [x, y] = rot(x0 + dx, y0 + dy, r);
          solid.add(occupancyKey(x, y, z0 + dz));
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

const stepped = (table, name, steps) => {
  let out = name;
  for (let i = 0; i < steps; i++) out = table[out] ?? out;
  return out;
};

/**
 * A face de topo esta na QUINA que a luz principal pega?
 *
 * A key light da Art Bible vem do topo-esquerda. Na projecao, diminuir x ou y
 * sobe na tela — sao essas as duas direcoes viradas para a luz. Uma face de topo
 * sem vizinho em -x E sem vizinho em -y esta na quina exposta desse lado: e a
 * aresta que um bisel de metal usinado devolveria em brilho.
 *
 * Exige as DUAS ausencias, e nao uma. Com uma so, todo voxel da borda de toda
 * superficie plana acende — o resultado nao e bisel, e um contorno claro em
 * volta de cada volume, que le como adesivo recortado e nao como luz. A quina
 * dupla acontece em poucos voxels por peca, que e exatamente o que uma aresta
 * viva deve ser.
 */
export const isLitCorner = (isSolid, x, y, z) =>
  !isSolid(x, y, z + 1) && !isSolid(x - 1, y, z) && !isSolid(x, y - 1, z);

/**
 * Rampa de um voxel com sombra e realce aplicados, face a face.
 *
 * Com as duas, cada material passa a cobrir CINCO passos de valor em vez dos
 * tres tons fixos que a rampa declara: quina acesa, base, contato, fresta e
 * fundo de fresta. Todos escolhidos dentro da paleta mestra — nenhuma cor nova,
 * nenhum canal multiplicado.
 *
 * O que a sombra compra: dois volumes que se encontram formavam uma junta em que
 * as duas faces tinham exatamente a mesma cor, e o olho nao achava a aresta — o
 * modelo lia como caixas empilhadas, e nao como um corpo.
 *
 * O que o realce compra e o oposto e o complemento: sem ele, uma superficie
 * grande e plana continua sendo UM tom chapado do topo ao fim, por mais bem
 * sombreadas que estejam as juntas em volta. A quina acesa devolve a aresta viva
 * que separa uma chapa de metal de um retangulo pintado.
 */
const shadedRamp = (solid, v) => {
  if (EMISSIVE.has(v.mat)) return v.ramp;
  const isSolid = (x, y, z) => solid.has(occupancyKey(x, y, z));
  let changed = false;
  const out = [v.ramp[0], v.ramp[1], v.ramp[2]];
  for (const [face, spec] of Object.entries(FACES)) {
    const steps = ambientOcclusionSteps(isSolid, v.x, v.y, v.z, face);
    if (steps === 0) continue;
    out[spec.slot] = stepped(SHADOW_OF, v.ramp[spec.slot], steps);
    changed = true;
  }
  // O realce vem DEPOIS e so onde a sombra nao chegou: uma quina exposta nunca
  // esta dentro de uma fresta, entao os dois nunca disputam a mesma face — mas
  // deixar a ordem explicita evita que uma mudanca futura nos cortes crie um
  // voxel que escurece e clareia no mesmo passe.
  if (out[0] === v.ramp[0] && isLitCorner(isSolid, v.x, v.y, v.z)) {
    const lit = stepped(LIGHT_OF, v.ramp[0], 1);
    if (lit !== v.ramp[0]) {
      out[0] = lit;
      changed = true;
    }
  }
  return changed ? out : v.ramp;
};

/**
 * Pixels de um cubo isometrico, relativos a origem dele: `[dx, dy, face]`, com
 * a face indexando a rampa em [topo, esquerda, direita].
 *
 * Tabela, e nao codigo solto dentro do desenho, porque a MEDIDA de profundidade
 * entre camadas precisa contar exatamente os pixels que o rasterizador pinta.
 * Duas listas separadas responderiam sobre um cubo que ninguem desenha.
 */
const CUBE_CELLS = (() => {
  // topo: losango afunilado, o que da a leitura de faceta
  const cells = [[1, -2, 0], [2, -2, 0]];
  for (let i = 0; i < 4; i++) cells.push([i, -1, 0]);
  // laterais
  for (let i = 0; i < VOX.zStep; i++) {
    cells.push([0, i, 1], [1, i, 1], [2, i, 2], [3, i, 2]);
  }
  return cells;
})();

/** Desenha um cubo isometrico com as tres faces visiveis. */
const cube = (g, sx, sy, ramp) => {
  for (const [dx, dy, face] of CUBE_CELLS) set(g, sx + dx, sy + dy, ramp[face]);
};

/** Maior chave do pintor que cada pixel recebe de um conjunto de caixas. */
const topKeyByPixel = (boxes, rotation) => {
  const byPixel = new Map();
  for (const v of shellVoxels(boxes, rotation)) {
    const key = makeDrawKey(v.x + KEY_BIAS, v.y + KEY_BIAS, v.z, 0);
    const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
    for (const [dx, dy] of CUBE_CELLS) {
      const pixel = `${Math.round(sx) + dx},${Math.round(sy) + dy}`;
      const seen = byPixel.get(pixel);
      if (seen === undefined || seen < key) byPixel.set(pixel, key);
    }
  }
  return byPixel;
};

/**
 * Disputa de profundidade entre duas partes do MESMO modelo, numa direcao.
 *
 * Existe porque partes que viram atlas separados perdem a ordem do pintor: nela
 * cada voxel se resolve contra os outros, enquanto entre dois atlas so ha a
 * ordem das duas chamadas de desenho. Esta funcao responde qual das duas ordens
 * o modelo pede, contando os pixels em que as partes se sobrepoem — o mesmo
 * criterio que o rasterizador usaria se as desenhasse juntas.
 *
 * `disputed` sozinho ja e informacao: zero significa que as partes nao se tocam
 * na tela e que a ordem entre elas nao importa nessa direcao.
 */
export const layerDepthDispute = (aBoxes, bBoxes, dirIndex) => {
  const rotation = DIRECTION_ROTATION[dirIndex];
  if (rotation === undefined) throw new Error(`direcao voxel invalida: ${dirIndex}`);
  const a = topKeyByPixel(aBoxes, rotation);
  const b = topKeyByPixel(bBoxes, rotation);
  let disputed = 0;
  let aInFront = 0;
  for (const [pixel, aKey] of a) {
    const bKey = b.get(pixel);
    if (bKey === undefined) continue;
    disputed++;
    if (aKey > bKey) aInFront++;
  }
  return { disputed, aInFront };
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
    const ramp = shadedRamp(solid, v);
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
 * Extensao projetada do modelo SEM rotacao, em pixels de atlas (grade fina).
 *
 * Terreno, crostas e props mediam isso cada um por conta propria, projetando a
 * coordenada AUTORADA direto — o que quebrou junto com MODEL_SCALE, porque a
 * unidade autorada passou a projetar o dobro de pixels. Medir sobre
 * shellVoxels garante que a conta ve exatamente os voxels que o rasterizador
 * pinta, na mesma grade.
 */
export const modelBounds = (boxes, acc) => {
  const out = acc ?? { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const v of shellVoxels(boxes, 0)) {
    const { sx, sy } = projectIso(v.x, v.y, v.z, VOX.tileW, VOX.tileH, VOX.zStep);
    out.minX = Math.min(out.minX, sx);
    out.maxX = Math.max(out.maxX, sx + VOX.tileW - 1);
    out.minY = Math.min(out.minY, sy - 2);
    out.maxY = Math.max(out.maxY, sy + VOX.zStep - 1);
  }
  out.w = out.maxX - out.minX + 1;
  out.h = out.maxY - out.minY + 1;
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
