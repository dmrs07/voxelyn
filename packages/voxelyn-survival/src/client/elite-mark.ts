// A MARCA DO ELITE: o corpo queimado, o chao estragado e o calor subindo.
//
// ---------------------------------------------------------------------------
// O QUE HAVIA, E POR QUE SAIU
// ---------------------------------------------------------------------------
//
// 1. UM VEU LARANJA CHAPADO sobre o corpo inteiro, alpha 0.35. O jogo e volume
//    facetado — todo bicho tem topo claro, lateral esquerda media e lateral
//    direita escura — e uma cor so por cima disso apaga exatamente as tres
//    faces que contam o volume: o elite virava a silhueta dele proprio pintada
//    de laranja, MENOS legivel que o bicho comum, nao mais. E laranja e a cor
//    reservada do FOGO (Art Bible §6): um elite ao lado de uma explosao lia
//    como "pegando fogo", e um bicho comum sob o clarao de uma explosao lia
//    como elite.
//
// 2. UMA ELIPSE LISA de 1 px nos pes. Um circulo perfeito, do mesmo laranja,
//    parado — leitura de interface, um marcador de selecao de jogo de
//    estrategia colado embaixo de uma criatura. Marcava a celula e nao dizia
//    mais nada sobre o que estava em pe nela. Pior: o recuo de voxel
//    (`voxel-fallback.ts`) desenhava a MESMA marca tracejada — dois desenhos
//    diferentes para o mesmo estado, conforme o atlas tivesse carregado ou nao.
//
// ---------------------------------------------------------------------------
// O QUE ENTRA
// ---------------------------------------------------------------------------
//
// A premissa: um elite nao e um bicho comum com um adesivo. E um bicho que
// sobreviveu a alguma coisa. A marca conta isso em quatro camadas que dividem UM
// relogio so — a respiracao (`eliteBreath`) —, e e essa unidade que faz as quatro
// lerem como um corpo e nao como quatro efeitos empilhados:
//
// - O CORPO CARBONIZADO. O tint deixa de clarear e passa a ESCURECER: carvao
//   com sangue seco no fundo da respiracao, brasa viva no alto dela. Contra os
//   irmaos da mesma leva, que continuam com a cor de atlas, o elite e o vulto
//   mais escuro e mais quente da tela — e o contraste de valor faz esse
//   trabalho a qualquer distancia, que era o que o veu laranja perdia.
//
// - O CHAO ESTRAGADO. Debaixo dele, uma poca de fuligem que come a luz do piso,
//   e sobre a poca um HEXAGONO queimado: seis riscos de brasa com as quinas
//   abertas, parado, cada lado tremulando no seu proprio tempo. Seis lados retos
//   sao da familia do losango do tile e da faceta do voxel — a elipse lisa de
//   antes era a unica curva perfeita da tela, e por isso lia como interface. O
//   raio e o MESMO do anel antigo: a marca continua medindo a celula que a
//   criatura ocupa, e nao poderia crescer sem mentir sobre isso.
//
// - O CALOR SUBINDO. Brasas soltando do chao em volta dele, morrendo na altura
//   do peito. E o unico movimento vertical da marca, e e ele que separa "isto
//   esta aceso agora" de "isto tem uma textura quente pintada".
//
// - A BARRA MARCADA. Quatro cantoneiras de brasa nas quinas da barra de vida
//   (`drawEliteBarFrame`), na mesma familia das quinas do hexagono: quando o
//   jogador ja esta trocando dano, a barra confirma com quem ele esta lidando
//   sem que nada precise ser escrito na tela.
//
// Tudo deriva do relogio e do ID da criatura. Nada e sorteado por quadro: duas
// maquinas da mesma sala desenham a mesma marca, e a mesma criatura tem sempre
// a mesma fase — sem isso, uma leva de elites respiraria em unissono, que e a
// leitura de engrenagem, o oposto de um bando de bichos.
//
// Este modulo e o UNICO dono da marca: o caminho de sprite e o recuo de voxel
// chamam as mesmas funcoes, e a marca deixa de depender de qual dos dois
// desenhou o corpo.

import { PAL, hexAlpha, mixHex } from './palette';

/** Cor e opacidade de um tint de corpo — o mesmo par que `sprites.ts` consome. */
export type Tint = { color: string; alpha: number };

/**
 * O CARVAO: o fundo da respiracao. Preto do jogo com sangue seco por dentro —
 * quase sem croma, porque a metade escura tem de escurecer, e nao colorir.
 */
const CHAR = mixHex(PAL.dark, PAL.blood, 0.3);
/**
 * A BRASA: o alto da respiracao. Fica ANTES do laranja puro do fogo, de
 * proposito: a cor reservada da explosao continua sendo so da explosao, e o
 * elite mora no vermelho quente logo abaixo dela.
 */
const EMBER = mixHex(PAL.blood, PAL.fire, 0.55);
/** O topo da brasa, so nas faiscas: o unico ponto da marca que chega ao claro. */
const SPARK = mixHex(PAL.fire, PAL.loot, 0.5);

/** Periodo da respiracao, em ms. Lento: um bicho grande respira devagar. */
export const ELITE_BREATH_MS = 2600;
/** Opacidade do tint no fundo da respiracao (carvao) e no alto dela (brasa). */
export const ELITE_TINT_CHAR = 0.34;
export const ELITE_TINT_EMBER = 0.2;

/** Raio da marca, em multiplos do tamanho do corpo. E o do anel antigo. */
export const ELITE_RING_RX = 1.05;
export const ELITE_RING_RY = 0.55;
/** Quantos lados tem a marca no chao. */
export const ELITE_HEX_SIDES = 6;
/** Quanto de cada lado fica ACESO; o resto e a falha nas quinas. */
const HEX_EDGE_FILL = 0.76;
/** Periodo do tremular de um lado, em ms. */
const HEX_FLICKER_MS = 1450;
/** Quantas brasas sobem do chao ao mesmo tempo. */
export const ELITE_EMBERS = 5;
/** Quanto tempo uma brasa leva do chao ate apagar, em ms. */
const EMBER_LIFE_MS = 1750;

const TAU = Math.PI * 2;

/** Ruido determinista em 0..1 a partir de um inteiro. */
const hash01 = (n: number): number => {
  let h = Math.imul(n | 0, 374761393) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A RESPIRACAO, 0..1: 0 e carvao, 1 e brasa viva.
 *
 * Um relogio so para as tres camadas. O corpo esquentando enquanto o chao
 * esfria daria dois bichos no mesmo lugar; batendo juntos, a poca no chao e a
 * luz que ESTE corpo esta soltando.
 *
 * Com movimento reduzido para no meio do caminho: a marca continua contando
 * "elite" pela cor e pela poca, e para de pulsar.
 */
export const eliteBreath = (nowMs: number, seed: number, reducedMotion: boolean): number => {
  if (reducedMotion) return 0.5;
  const phase = hash01(seed) * TAU;
  // Nao e um seno puro: a subida e curta e a descida e longa (o expoente puxa a
  // curva para baixo), que e como brasa acende — um sopro e depois o esfriar.
  const wave = 0.5 + 0.5 * Math.sin((nowMs / ELITE_BREATH_MS) * TAU + phase);
  return Math.pow(wave, 1.6);
};

/**
 * O TINT DO CORPO para a respiracao deste instante.
 *
 * Alpha maior no carvao que na brasa: escurecer um corpo inteiro nao apaga as
 * faces dele (todas descem juntas e a rampa sobrevive), mas clarear apaga —
 * entao a metade quente entra mais fraca de proposito. Ela nao precisa gritar:
 * o anel e as faiscas ja estao gritando no chao.
 */
export const eliteTint = (nowMs: number, seed: number, reducedMotion: boolean): Tint => {
  const breath = eliteBreath(nowMs, seed, reducedMotion);
  return {
    color: mixHex(CHAR, EMBER, breath),
    alpha: ELITE_TINT_CHAR + (ELITE_TINT_EMBER - ELITE_TINT_CHAR) * breath,
  };
};

/** Uma brasa subindo, em px de tela a partir do pe da criatura. */
export type EliteEmber = {
  dx: number;
  dy: number;
  /** Lado do corpo em px de tela — positivo desenha na frente. */
  size: number;
  alpha: number;
  /** Passa na frente do corpo (nasceu na borda de baixo do anel). */
  front: boolean;
};

/**
 * AS BRASAS deste instante.
 *
 * Cada uma tem um lugar fixo no anel e um relogio proprio, defasado das outras:
 * cinco brasas com a mesma fase seriam uma fonte piscando: cinco defasadas sao
 * um corpo soltando calor sem parar. Nenhuma nasce fora do anel — a marca
 * inteira cabe no rastro do pe.
 */
export const eliteEmbers = (
  size: number,
  nowMs: number,
  seed: number,
  reducedMotion: boolean,
): EliteEmber[] => {
  const out: EliteEmber[] = [];
  for (let i = 0; i < ELITE_EMBERS; i++) {
    const r = hash01(seed * 31 + i * 7919);
    const angle = r * TAU;
    // Com movimento reduzido as brasas congelam espalhadas pela vida, em vez de
    // sumirem: o calor continua desenhado, so nao sobe.
    const t = reducedMotion
      ? (i + 0.5) / ELITE_EMBERS
      : (((nowMs / EMBER_LIFE_MS + r) % 1) + 1) % 1;
    const rise = t * size * 2.1;
    const spread = 0.35 + r * 0.55;
    out.push({
      dx: Math.cos(angle) * size * ELITE_RING_RX * spread,
      dy: Math.sin(angle) * size * ELITE_RING_RY * spread - rise,
      // Nasce gorda no chao e afina subindo: e o que faz a brasa APAGAR em vez
      // de sair de cena por cima da borda.
      size: Math.max(1, size * 0.17 * (1 - t * 0.5)),
      // Acende no primeiro quinto e some no resto. Uma brasa que nasce no auge
      // pisca; esta abre.
      alpha: clamp01(t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.95,
      front: Math.sin(angle) > 0,
    });
  }
  return out;
};

/** Um lado do hexagono, em px de tela a partir do pe da criatura. */
export type EliteHexEdge = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** 0..1, quanto ESTE lado esta aceso neste instante. */
  heat: number;
};

/** As seis quinas da marca, em px de tela a partir do pe. */
export const eliteHexCorners = (size: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < ELITE_HEX_SIDES; i++) {
    const a = (i / ELITE_HEX_SIDES) * TAU;
    out.push([Math.cos(a) * size * ELITE_RING_RX, Math.sin(a) * size * ELITE_RING_RY]);
  }
  return out;
};

/**
 * O HEXAGONO QUEIMADO no chao — a marca que diz qual celula e dele.
 *
 * Por que seis lados retos e nao a elipse de antes: um circulo perfeito
 * desenhado a `ctx.ellipse` e a unica curva lisa da tela num jogo em que tudo e
 * faceta e pixel, e por isso lia como interface colada por cima do mundo. Um
 * poligono e da mesma familia do losango do tile e da faceta do voxel — e as
 * seis quinas sao os pontos onde a brasa fica mais viva, que uma curva nao tem.
 *
 * NAO GIRA. Um hexagono girando e runa de magia; parado e alinhado com a grade,
 * ele le como uma coisa QUEIMADA no chao, que e o que a marca conta. O que se
 * move e o calor: cada lado tremula no seu proprio tempo, entao a figura nunca
 * esta acesa por inteiro ao mesmo tempo — e nenhum lado apaga de vez.
 *
 * Cada lado e cortado nas duas pontas: as quinas ficam ABERTAS. Fechado, o
 * hexagono vira um contorno desenhado; aberto, vira seis riscos de brasa que o
 * olho fecha sozinho.
 */
export const eliteHex = (
  size: number,
  nowMs: number,
  seed: number,
  reducedMotion: boolean,
): EliteHexEdge[] => {
  const corners = eliteHexCorners(size);
  const out: EliteHexEdge[] = [];
  for (let i = 0; i < ELITE_HEX_SIDES; i++) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % ELITE_HEX_SIDES];
    const r = hash01(seed + i * 977);
    // A falha de cada lado e um pouco diferente: seis cortes iguais em volta da
    // figura voltam a ser um icone, so que pontilhado.
    const fill = HEX_EDGE_FILL * (0.82 + r * 0.3);
    const edge = (1 - Math.min(0.95, fill)) / 2;
    const phase = r * TAU;
    const flicker = reducedMotion
      ? 0.5 + 0.5 * Math.sin(phase)
      : 0.5 + 0.5 * Math.sin((nowMs / HEX_FLICKER_MS) * TAU + phase);
    out.push({
      x0: ax + (bx - ax) * edge,
      y0: ay + (by - ay) * edge,
      x1: bx - (bx - ax) * edge,
      y1: by - (by - ay) * edge,
      // Nunca chega a zero: um lado apagado abriria um buraco na marca, e a
      // celula deixaria de ser lida.
      heat: 0.45 + flicker * 0.55,
    });
  }
  return out;
};

export type EliteMarkDraw = {
  /** Pe da criatura na tela (a mesma ancora da sombra de contato). */
  sx: number;
  sy: number;
  /** Meia-largura do corpo em px de tela — o mesmo `size` da sombra. */
  size: number;
  /** Zoom da camera, para as espessuras nao afinarem no zoom grande. */
  z: number;
  nowMs: number;
  /** ID da criatura: a fase da respiracao e das brasas sai dele. */
  seed: number;
  reducedMotion: boolean;
};

/**
 * A POCA E O ANEL, no chao, ANTES do corpo.
 *
 * Antes de proposito: a poca e o anel sao chao, e o bicho tem de passar por
 * cima deles. O anel antigo era desenhado depois do corpo e cortava as pernas
 * da criatura em duas — o detalhe que mais denunciava "isto e interface".
 */
export const drawEliteGround = (ctx: CanvasRenderingContext2D, mark: EliteMarkDraw): void => {
  const { sx, sy, size, z, nowMs, seed, reducedMotion } = mark;
  const breath = eliteBreath(nowMs, seed, reducedMotion);

  ctx.save();
  // A poca vive num espaco achatado: circulo virado elipse pela escala, para o
  // gradiente radial sair em elipse tambem — um gradiente em elipse nao existe
  // na API, e a alternativa (varios strokes) custaria caro por criatura.
  ctx.translate(sx, sy);
  ctx.scale(1, 0.5);
  const reach = size * 1.5;
  const pool = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, reach);
  // A FULIGEM: o chao debaixo do elite perde a propria luz. Escurecer o piso e
  // o que faz o corpo escuro dele ainda ler como corpo — a criatura fica dois
  // passos acima do chao (Art Bible §6) porque o chao desceu junto.
  pool.addColorStop(0, hexAlpha(PAL.dark, 0.62));
  pool.addColorStop(0.6, hexAlpha(PAL.dark, 0.34));
  pool.addColorStop(1, hexAlpha(PAL.dark, 0));
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, reach, 0, TAU);
  ctx.fill();
  ctx.restore();

  // A LUZ DA BRASA no chao, por cima da fuligem e ADITIVA: o elite nao e so uma
  // coisa escura, e uma coisa ACESA — numa mina onde luz e recurso, um corpo
  // que ilumina o proprio pe se ve de qualquer distancia, e continua se vendo
  // quando o corpo dele esta atras de uma coluna. A fuligem entra antes para a
  // luz ter sobre o que subir: sem o escuro embaixo, o aditivo so lava o chao.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(sx, sy);
  ctx.scale(1, 0.5);
  const litReach = size * 2.4;
  const lit = ctx.createRadialGradient(0, 0, size * 0.15, 0, 0, litReach);
  const litAlpha = 0.16 + breath * 0.2;
  lit.addColorStop(0, hexAlpha(EMBER, litAlpha));
  lit.addColorStop(0.45, hexAlpha(EMBER, litAlpha * 0.45));
  lit.addColorStop(1, hexAlpha(EMBER, 0));
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.arc(0, 0, litReach, 0, TAU);
  ctx.fill();
  ctx.restore();

  // O HEXAGONO QUEIMADO. Ver `eliteHex`: seis riscos de brasa com as quinas
  // abertas, cada um no seu proprio tremular.
  const glow = 0.46 + breath * 0.5;
  ctx.save();
  ctx.lineCap = 'round';
  for (const edge of eliteHex(size, nowMs, seed, reducedMotion)) {
    // Duas passadas por lado: uma larga e fraca (o derrame da brasa no chao) e o
    // fio aceso por cima. Sem a larga o risco e uma linha; com ela e luz.
    for (const pass of [
      { width: 4 * z, alpha: glow * edge.heat * 0.26, color: EMBER },
      { width: 1.4 * z, alpha: glow * edge.heat, color: mixHex(EMBER, SPARK, breath * 0.6) },
    ]) {
      ctx.lineWidth = pass.width;
      ctx.strokeStyle = hexAlpha(pass.color, pass.alpha);
      ctx.beginPath();
      ctx.moveTo(sx + edge.x0, sy + edge.y0);
      ctx.lineTo(sx + edge.x1, sy + edge.y1);
      ctx.stroke();
    }
  }
  // AS SEIS QUINAS: o ponto de brasa onde dois riscos quase se encontram. E o
  // que faz o olho fechar o hexagono sem que ele esteja desenhado fechado.
  const corner = Math.max(1, Math.round(z * 0.9));
  ctx.fillStyle = hexAlpha(mixHex(EMBER, SPARK, 0.3 + breath * 0.5), 0.5 + breath * 0.4);
  for (const [cx, cy] of eliteHexCorners(size)) {
    ctx.fillRect(
      Math.round(sx + cx - corner / 2),
      Math.round(sy + cy - corner / 2),
      corner,
      corner,
    );
  }
  ctx.restore();

  drawEmbers(ctx, mark, false);
};

/**
 * AS BRASAS QUE PASSAM NA FRENTE, depois do corpo.
 *
 * Sao a metade de baixo do anel: calor que sobe entre a camera e o bicho. Sem
 * elas, todo o calor sairia atras dele e a marca ficaria plana como um decalque
 * no fundo.
 */
export const drawEliteFront = (ctx: CanvasRenderingContext2D, mark: EliteMarkDraw): void => {
  drawEmbers(ctx, mark, true);
};

const drawEmbers = (ctx: CanvasRenderingContext2D, mark: EliteMarkDraw, front: boolean): void => {
  const { sx, sy, size, nowMs, seed, reducedMotion } = mark;
  const breath = eliteBreath(nowMs, seed, reducedMotion);
  ctx.save();
  for (const ember of eliteEmbers(size, nowMs, seed, reducedMotion)) {
    if (ember.front !== front) continue;
    ctx.fillStyle = hexAlpha(mixHex(EMBER, SPARK, 0.35 + breath * 0.45), ember.alpha);
    // Quadrado, nao circulo: e a mesma materia dos motes de particula do jogo,
    // e um disco liso aqui devolveria o vetor que o anel antigo tinha.
    const s = Math.max(1, Math.round(ember.size));
    ctx.fillRect(Math.round(sx + ember.dx - s / 2), Math.round(sy + ember.dy - s / 2), s, s);
  }
  ctx.restore();
};

/**
 * O CONTORNO ACESO: a cor e a forca da brasa que vaza pela borda do corpo.
 */
export const eliteRim = (nowMs: number, seed: number, reducedMotion: boolean): Tint => {
  const breath = eliteBreath(nowMs, seed, reducedMotion);
  return {
    color: mixHex(EMBER, SPARK, 0.15 + breath * 0.45),
    alpha: 0.42 + breath * 0.34,
  };
};

/**
 * A MOLDURA DA BARRA DE VIDA do elite: quatro cantoneiras de brasa.
 *
 * Cantoneiras, e nao uma moldura fechada, por dois motivos. A barra tem cinco
 * pixels de altura no zoom do jogo: um retangulo em volta dela dobraria a
 * espessura da coisa toda e viraria o elemento mais pesado da tela por cima de
 * um bicho. E uma moldura fechada em volta de uma barra ja fechada e ruido —
 * duas bordas contando a mesma borda. As quatro quinas bastam para o olho ler
 * "esta barra e diferente", que e todo o pedido.
 *
 * Sao os mesmos seis pontos de brasa das quinas do hexagono no chao, com quatro
 * em vez de seis: a marca do chao e a da barra ficam sendo a mesma familia.
 *
 * Tudo em pixel inteiro: meia unidade aqui sai borrada e uma cantoneira borrada
 * a cinco pixels de altura vira sujeira.
 */
export const drawEliteBarFrame = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  topY: number,
  size: number,
  z: number,
  nowMs: number,
  seed: number,
  reducedMotion: boolean,
): void => {
  const breath = eliteBreath(nowMs, seed, reducedMotion);
  const thick = Math.max(1, Math.round(z * 0.5));
  const gap = thick;
  const x = Math.round(sx - size) - gap;
  const y = Math.round(topY) - gap;
  const w = Math.round(size * 2) + gap * 2;
  const h = Math.round(2.4 * z) + gap * 2;
  // O braco horizontal e curto e nao ha moldura fechada: as quatro quinas
  // marcadas bastam, e o olho fecha o resto. Uma caixa inteira em volta de uma
  // barra que ja tem borda propria seria a mesma borda desenhada duas vezes.
  const arm = Math.max(3, Math.round(w * 0.14));
  const stub = Math.max(thick, Math.round(h * 0.42));
  ctx.save();
  ctx.fillStyle = hexAlpha(mixHex(EMBER, SPARK, 0.25 + breath * 0.4), 0.45 + breath * 0.35);
  for (const left of [true, false]) {
    for (const top of [true, false]) {
      const cx = left ? x : x + w - arm;
      const cy = top ? y : y + h - thick;
      // O braco deitado e a haste em pe saem da MESMA quina: e o "L" que faz a
      // marca ler como cantoneira de placa, e nao como dois riscos soltos.
      ctx.fillRect(cx, cy, arm, thick);
      ctx.fillRect(left ? x : x + w - thick, top ? y : y + h - stub, thick, stub);
    }
  }
  ctx.restore();
};
