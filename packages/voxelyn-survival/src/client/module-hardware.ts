// O hardware fisico dos modulos: os cartuchos Aurix da tela de recuperacao.
//
// O glifo abstrato de 22px continua certo para a HUD — num quadrado de 24px um
// desenho de maquina viraria ruido. Mas o momento de descoberta pede OBJETO:
// aqui cada modulo e um cartucho industrial com chassi comum (corpo de aco,
// conector traseiro, placa de identificacao Aurix) e UM componente funcional
// dominante que conta o que ele faz. Mesma camera, mesma escala, silhuetas
// distintas — a linguagem da imagem de referencia, sem copiar nenhum modulo
// que o jogo nao tem.
//
// Tudo e desenhado num grid de unidades inteiras (32×26) escalado pelo tamanho
// pedido e ancorado em pixels inteiros: e pixel-art procedural, nao ilustracao
// suavizada. `lit` permite ao terminal acender o cartucho durante o boot.

import type { ModuleId } from '@voxelyn/survival-sim';

// Cores da art bible (docs/art/voxelyn-survival-art-bible.md), as mesmas do
// PAL do render — duplicadas aqui porque o PAL e privado do render e este
// modulo precisa funcionar sozinho (e ser testavel) sem importar 5k linhas.
const HW = {
  dark: '#0b0e14',
  steelDark: '#1d2430',
  steel: '#2e3a4d',
  steelLight: '#46566e',
  rust: '#6e4a33',
  bone: '#b8a98f',
  amber: '#ffd166',
  cyan: '#59f2c2',
  fire: '#ff7a2f',
  blood: '#d93b4c',
  electric: '#7ab8ff',
  white: '#e8f1ff',
  fungusLight: '#66c28a',
  acid: '#a8e63c',
};

const hexChannel = (hex: string, index: number): number =>
  parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);

/** Mistura linear entre duas cores hex — para apagar acentos quando `lit < 1`. */
export const mixColor = (from: string, to: string, t: number): string => {
  const clamped = Math.max(0, Math.min(1, t));
  const channel = (i: number): number =>
    Math.round(hexChannel(from, i) + (hexChannel(to, i) - hexChannel(from, i)) * clamped);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
};

export type ModuleHardwareOptions = {
  /** 0 = silhueta apagada (boot), 1 = energizado. */
  lit?: number;
  /** Relogio para a pulsacao morna do modulo volatil. */
  nowMs?: number;
  /**
   * Fase de rotacao 0..1 do canhao rotativo. Ignorada pelos demais cartuchos.
   *
   * Entra por parametro e nao por relogio interno porque o mesmo desenho
   * serve ao cartucho PARADO na bancada do terminal e ao cartucho encaixado
   * no bot, cuja rotacao e estado autoritativo da simulacao. Um relogio
   * proprio faria a vitrine girar sozinha e a arma girar fora de fase.
   */
  spin?: number;
  /** Calor 0..1: acende os pontos quentes do canhao rotativo. */
  heat?: number;
};

/** Unidades do grid de desenho. Todo cartucho vive numa prancheta 32×26. */
const GRID_W = 32;
const GRID_H = 26;

type Draw = {
  ctx: CanvasRenderingContext2D;
  u: number;
  x0: number;
  y0: number;
  lit: number;
  nowMs: number;
};

const rect = (d: Draw, x: number, y: number, w: number, h: number, color: string): void => {
  d.ctx.fillStyle = color;
  d.ctx.fillRect(
    Math.round(d.x0 + x * d.u),
    Math.round(d.y0 + y * d.u),
    Math.max(1, Math.round(w * d.u)),
    Math.max(1, Math.round(h * d.u)),
  );
};

const poly = (d: Draw, points: Array<[number, number]>, color: string): void => {
  const { ctx } = d;
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([px, py], i) => {
    const sx = Math.round(d.x0 + px * d.u);
    const sy = Math.round(d.y0 + py * d.u);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  ctx.fill();
};

/** Acento energizavel: apagado vira aco, aceso vira a cor do componente. */
const accent = (d: Draw, color: string): string => mixColor(HW.steelDark, color, d.lit);

/**
 * O chassi comum: corpo de aco em 2.5D raso (face frontal + tampo + lateral),
 * conector traseiro de tres aletas a esquerda, parafusos recartilhados e a
 * placa de identificacao ambar. Os componentes especificos montam EM CIMA.
 */
const drawChassis = (d: Draw): void => {
  // Sombra de apoio.
  rect(d, 4, 21, 24, 2, 'rgba(0,0,0,0.35)');
  // Face frontal.
  rect(d, 4, 11, 24, 10, HW.steel);
  // Tampo (levemente recuado para tras): a luz vem de cima-esquerda.
  poly(d, [[4, 11], [28, 11], [30, 8], [6, 8]], HW.steelLight);
  // Lateral direita, mais escura.
  poly(d, [[28, 11], [30, 8], [30, 18], [28, 21]], HW.steelDark);
  // Costura inferior + desgaste.
  rect(d, 4, 19, 24, 1, HW.steelDark);
  rect(d, 5, 12, 2, 1, HW.rust);
  rect(d, 24, 18, 3, 1, HW.rust);
  // Conector traseiro: tres aletas de encaixe.
  for (let i = 0; i < 3; i++) rect(d, 1, 12 + i * 3, 3, 2, i === 1 ? HW.bone : HW.steelLight);
  // Parafusos.
  rect(d, 5, 12, 1, 1, HW.dark);
  rect(d, 26, 12, 1, 1, HW.dark);
  rect(d, 5, 19, 1, 1, HW.dark);
  rect(d, 26, 19, 1, 1, HW.dark);
  // Placa de identificacao Aurix, com um traco de gravacao.
  rect(d, 20, 15, 6, 3, mixColor(HW.rust, HW.amber, 0.55));
  rect(d, 21, 16, 4, 1, HW.rust);
};

/** LED de estado do cartucho, aceso conforme `lit`. */
const drawStatusLed = (d: Draw, color: string): void => {
  rect(d, 6, 15, 2, 2, accent(d, color));
};

// ---------------------------------------------------------------------------
// Componentes dominantes por modulo
// ---------------------------------------------------------------------------

/** PERFURANTE: emissor longo endurecido com abertura concentrica e foco cyan. */
const drawPiercing = (d: Draw): void => {
  // Placa frontal reforcada onde o canhao monta no chassi.
  rect(d, 7, 3, 4, 8, HW.bone);
  rect(d, 8, 4, 2, 6, HW.steelDark);
  // Corpo do emissor, comprido — a silhueta que diz "atravessa".
  rect(d, 11, 4, 18, 5, HW.steelLight);
  rect(d, 11, 8, 18, 1, HW.steelDark);
  // Aneis de contencao ao longo do cano.
  for (const bx of [14, 19, 24]) rect(d, bx, 3, 2, 7, HW.steel);
  // Abertura concentrica na boca.
  rect(d, 29, 3, 2, 7, HW.bone);
  rect(d, 30, 5, 2, 3, accent(d, HW.cyan));
  drawStatusLed(d, HW.cyan);
};

/** CONDUTIVO: bobina exposta com contatos partidos e arco minusculo. */
const drawConductive = (d: Draw): void => {
  // Nucleo do transformador.
  rect(d, 13, 8, 7, 4, HW.steelDark);
  // Bobina: discos alternados largos/estreitos — cobre enferrujado e aco.
  const discs: Array<[number, number, number, string]> = [
    [11, 6, 11, HW.rust],
    [12, 4, 9, HW.steelLight],
    [11, 2, 11, HW.rust],
    [12, 0, 9, HW.steelLight],
  ];
  for (const [x, y, w, colorName] of discs) rect(d, x, y, w, 2, colorName);
  // Faixas de isolamento amarelas nos pes da bobina.
  rect(d, 11, 8, 2, 3, accent(d, HW.amber));
  rect(d, 20, 8, 2, 3, accent(d, HW.amber));
  // Contatos partidos, com o arco saltando entre eles.
  rect(d, 24, 2, 2, 6, HW.bone);
  rect(d, 28, 2, 2, 6, HW.bone);
  const arc = accent(d, HW.electric);
  rect(d, 26, 3, 1, 1, arc);
  rect(d, 27, 5, 1, 1, arc);
  rect(d, 26, 6, 1, 1, arc);
  drawStatusLed(d, HW.electric);
};

/** EXPLOSIVO: camara de contencao avermelhada, listra de risco, braco de armar. */
const drawExplosive = (d: Draw, heartbeat: number): void => {
  // Corpo de contencao pesado.
  rect(d, 10, 3, 14, 8, HW.steelDark);
  rect(d, 10, 3, 14, 1, HW.steelLight);
  // Camara volatil INTEIRA: o unico vermelho da bancada — vermelho e RISCO,
  // nao tier. Um anel de contencao horizontal a corta, e duas presilhas
  // claras a seguram pelas bordas.
  rect(d, 12, 4, 10, 6, mixColor(HW.rust, HW.blood, d.lit));
  rect(d, 12, 7, 10, 1, HW.dark);
  rect(d, 11, 3, 1, 8, HW.bone);
  rect(d, 22, 3, 1, 8, HW.bone);
  // Carga quente central com batimento morno.
  const glow = mixColor(HW.blood, HW.fire, 0.35 + heartbeat * 0.65);
  rect(d, 16, 5, 2, 2, accent(d, glow));
  rect(d, 16, 8, 2, 2, accent(d, glow));
  // Listra de perigo no flanco.
  for (let i = 0; i < 3; i++) rect(d, 25 + i, 4 + i * 2, 2, 1, accent(d, HW.amber));
  // Componente mecanico de armar.
  rect(d, 26, 8, 4, 2, HW.bone);
  rect(d, 29, 6, 1, 3, HW.rust);
  drawStatusLed(d, HW.fire);
};

/**
 * SIFAO: o DISPARO serpenteante e o componente — uma onda em S de verde
 * vivido saindo do emissor, com a cabeca clara na ponta. A cruz de
 * recuperacao continua como marcacao secundaria na bomba, nunca o icone.
 */
const drawSiphon = (d: Draw): void => {
  // Bomba emissora compacta a esquerda.
  rect(d, 7, 5, 5, 6, HW.steelLight);
  rect(d, 8, 9, 3, 1, HW.rust);
  // Marcacao de recuperacao (cruz pequena, secundaria) na bomba.
  rect(d, 8, 7, 3, 1, accent(d, HW.fungusLight));
  rect(d, 9, 6, 1, 3, accent(d, HW.fungusLight));
  // A serpente: segmentos 2×2 ondulando do emissor ate a cabeca.
  const wave: Array<[number, number]> = [
    [12, 6], [14, 4], [16, 3], [18, 4], [20, 6], [22, 7], [24, 6], [26, 4],
  ];
  wave.forEach(([x, y], i) => {
    rect(d, x, y, 2, 2, accent(d, i % 2 === 0 ? HW.acid : HW.fungusLight));
  });
  // Cabeca, mais viva e com a ponta branca.
  rect(d, 28, 2, 3, 3, accent(d, HW.acid));
  rect(d, 30, 3, 1, 1, accent(d, HW.white));
  drawStatusLed(d, HW.acid);
};

/** RICOCHETE: emissor curto + prisma/espelho articulado a 45°. */
const drawRicochet = (d: Draw): void => {
  // Emissor curto apontando para a direita.
  rect(d, 8, 6, 8, 4, HW.steelLight);
  rect(d, 8, 9, 8, 1, HW.steelDark);
  rect(d, 15, 7, 2, 2, accent(d, HW.cyan));
  // Suporte articulado do espelho.
  rect(d, 24, 8, 2, 4, HW.rust);
  rect(d, 23, 11, 4, 1, HW.bone);
  // A placa refletiva inclinada — a geometria do rebote.
  poly(d, [[21, 8], [27, 2], [29, 4], [23, 10]], HW.bone);
  poly(d, [[22, 8], [27, 3], [28, 4], [23, 9]], accent(d, HW.cyan));
  // O feixe: chega baixo, quica no espelho e sobe.
  const beam = accent(d, HW.cyan);
  rect(d, 18, 8, 2, 1, beam);
  rect(d, 21, 8, 1, 1, beam);
  rect(d, 24, 5, 1, 1, beam);
  rect(d, 25, 2, 1, 1, beam);
  drawStatusLed(d, HW.cyan);
};

/** DISCO DE RETORNO: lancador compacto com o disco de borda luminosa no berco. */
const drawReturnDisc = (d: Draw): void => {
  // Berco/lancador com trilhos magneticos.
  rect(d, 9, 8, 16, 3, HW.steelLight);
  rect(d, 9, 10, 16, 1, HW.steelDark);
  rect(d, 10, 7, 2, 1, HW.rust);
  rect(d, 22, 7, 2, 1, HW.rust);
  // Bracos de retencao.
  rect(d, 9, 3, 2, 5, HW.bone);
  rect(d, 23, 3, 2, 5, HW.bone);
  // O disco em si: aro luminoso, miolo escuro, eixo claro.
  const { ctx } = d;
  const cx = Math.round(d.x0 + 17 * d.u);
  const cy = Math.round(d.y0 + 5 * d.u);
  const radius = 4.5 * d.u;
  ctx.fillStyle = accent(d, HW.cyan);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HW.steelDark;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.68, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HW.bone;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(1, radius * 0.22), 0, Math.PI * 2);
  ctx.fill();
  drawStatusLed(d, HW.cyan);
};

/**
 * UM CARTUCHO da fita: base enferrujada, ogiva ambar, brilho de osso na ponta.
 *
 * Tres pixels que se repetem dezenas de vezes — e a unidade que faz a caixa da
 * Minigun ler como MUNICAO em vez de como grade de radiador.
 */
const drawRound = (d: Draw, x: number, y: number): void => {
  rect(d, x, y, 2, 2, HW.rust);
  rect(d, x, y, 2, 1, accent(d, HW.amber));
  rect(d, x, y, 1, 1, HW.bone);
};

/**
 * MINIGUN: caixa de municao + carcaca de motor + cano curto e grosso.
 *
 * A peca dominante e a MUNICAO, e nao os canos, e essa e a decisao inteira.
 * A fantasia do modulo nao e "gira" — e "trezentas balas". Uma versao anterior
 * punha um pente de quatro canos no lugar de destaque e o resultado era
 * previsivel: contra o PERFURANTE, que tambem e um tubo comprido apontado para
 * a direita, o cartucho nao tinha o que dizer de diferente. Aqui a caixa toma
 * o terco esquerdo, a carcaca do motor toma o meio, e o cano e um toco.
 *
 * A segunda leitura, o motor com aletas, e o que explica o spin-up antes de o
 * jogador senti-lo: ha uma massa girando ali dentro, e massa nao arranca de
 * imediato. A ventoinha da traseira e o unico elemento que se move com a fase.
 *
 * PALETA: tudo em ambar/osso/aco, sem uma gota de ciano. Ciano nesta bancada
 * ja significa perfurante, ricochete e disco de retorno — usa-lo aqui mancharia
 * o codigo de cor dos quatro de uma vez. O acento da Minigun e o ambar do
 * latao, que e literalmente do que ela e feita.
 *
 * `spin` e a fase 0..1 (angulo, nunca velocidade — ver `minigun-view.ts`):
 * rola a fita dentro da caixa e gira a ventoinha. `heat` acende a raiz do cano
 * e o flanco da carcaca.
 */
const drawMinigun = (d: Draw, spin: number, heat: number): void => {
  const phase = spin - Math.floor(spin);

  // --- A CAIXA DE MUNICAO: a peca dominante, no terco esquerdo. -----------
  rect(d, 3, 2, 10, 9, HW.steel);
  rect(d, 3, 2, 10, 1, HW.steelLight);
  rect(d, 4, 3, 8, 7, HW.dark);
  rect(d, 3, 2, 1, 9, HW.bone);
  rect(d, 12, 2, 1, 9, HW.bone);
  // A FITA la dentro, rolando com a fase. Tres fileiras visiveis pela janela:
  // o suficiente para ler como "cheia" sem virar textura de grade.
  const scroll = (phase * 3) % 1;
  for (let row = 0; row < 3; row++) {
    const y = 3 + ((row + scroll) % 3) * 2.3;
    for (let k = 0; k < 3; k++) drawRound(d, 5 + k * 2, y);
  }

  // --- A CARCACA DO MOTOR: aletas de refrigeracao no meio. ----------------
  rect(d, 13, 3, 11, 8, HW.steel);
  rect(d, 13, 3, 11, 1, HW.steelLight);
  rect(d, 13, 10, 11, 1, HW.steelDark);
  for (let i = 0; i < 5; i++) rect(d, 15 + i * 2, 4, 1, 6, HW.steelDark);

  // A VENTOINHA, o unico elemento em movimento. Tres pas em ambar: e ela que
  // diz que a massa la dentro esta girando, mesmo com o cartucho parado numa
  // bancada.
  const { ctx } = d;
  const fx = 16;
  const fy = 6.5;
  ctx.fillStyle = HW.steelDark;
  ctx.beginPath();
  ctx.arc(Math.round(d.x0 + fx * d.u), Math.round(d.y0 + fy * d.u), 2.9 * d.u, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent(d, HW.amber);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + phase * Math.PI * 2;
    ctx.fillRect(
      Math.round(d.x0 + (fx + Math.cos(a) * 1.9) * d.u - d.u / 2),
      Math.round(d.y0 + (fy + Math.sin(a) * 1.9) * d.u - d.u / 2),
      Math.max(1, d.u),
      Math.max(1, d.u),
    );
  }
  rect(d, fx - 0.5, fy - 0.5, 1, 1, HW.bone);

  // --- A FITA SAINDO da caixa para a culatra, em degraus. -----------------
  for (let i = 0; i < 2; i++) drawRound(d, 13 + i * 1.4, 11 - i * 1.3);

  // --- O CANO: curto e GROSSO. Calibre, nao alcance. ----------------------
  rect(d, 24, 4, 7, 5, HW.steelLight);
  rect(d, 24, 8, 7, 1, HW.steelDark);
  rect(d, 26, 3, 1, 7, HW.steel);
  rect(d, 29, 3, 1, 7, HW.steel);
  rect(d, 31, 5, 1, 3, HW.bone);

  // --- PONTOS QUENTES: raiz do cano e flanco da carcaca. ------------------
  if (heat > 0.01) {
    const glow = mixColor(HW.rust, HW.fire, Math.min(1, heat));
    ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, heat);
    rect(d, 22, 4, 2, 6, glow);
    rect(d, 24, 4, 2, 5, glow);
    ctx.globalAlpha = 1;
  }

  drawStatusLed(d, HW.amber);
};

/**
 * Desenha o cartucho de um modulo centrado em (cx, cy), com `size` de largura.
 * Retorna a altura ocupada em pixels (para quem empilha texto embaixo).
 */
export const drawModuleHardware = (
  ctx: CanvasRenderingContext2D,
  id: ModuleId,
  cx: number,
  cy: number,
  size: number,
  options: ModuleHardwareOptions = {},
): number => {
  const lit = Math.max(0, Math.min(1, options.lit ?? 1));
  const nowMs = options.nowMs ?? 0;
  const u = Math.max(1, Math.floor(size / GRID_W));
  const width = GRID_W * u;
  const height = GRID_H * u;
  const d: Draw = {
    ctx,
    u,
    x0: Math.round(cx - width / 2),
    y0: Math.round(cy - height / 2),
    lit,
    nowMs,
  };
  ctx.save();
  drawChassis(d);
  if (id === 'piercing') drawPiercing(d);
  else if (id === 'conductive') drawConductive(d);
  else if (id === 'explosive') {
    // Batimento lento (~1.6 s) e contido: maquina morna, nao alarme.
    const heartbeat = lit * (0.5 + 0.5 * Math.sin((nowMs % 1600) * ((Math.PI * 2) / 1600)));
    drawExplosive(d, heartbeat);
  } else if (id === 'siphon') drawSiphon(d);
  else if (id === 'ricochet') drawRicochet(d);
  else if (id === 'minigun') {
    drawMinigun(d, options.spin ?? 0, Math.max(0, Math.min(1, options.heat ?? 0)) * lit);
  } else drawReturnDisc(d);
  ctx.restore();
  return height;
};
