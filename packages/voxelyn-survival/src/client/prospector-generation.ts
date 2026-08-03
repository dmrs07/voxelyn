// Os marcos geracionais desenhados sobre o Prospector.
//
// ---------------------------------------------------------------------------
// POR QUE NAO UM ATLAS POR COMBINACAO
// ---------------------------------------------------------------------------
// Vinte e quatro protocolos dao 16 milhoes de combinacoes. Mesmo um atlas por
// protocolo — 24 — significaria 24 conjuntos completos de animacao por direcao,
// e a direcao de arte deste jogo tem um requisito que isso quebra primeiro: a
// SILHUETA. Um Prospector que muda de contorno a cada compra deixa de ser
// reconhecivel de relance no meio de um enxame.
//
// Por isso a leitura e por MARCO, e nao por peca:
//
//   G-00  o Prospector de fabrica, sem nenhum acrescimo
//   G-01  ombreiras leves e antena curta
//   G-02  carapaca frontal e dissipador dorsal
//   G-03  pistoes de perna, sensores e reator ampliado
//   G-04  chassi Aurix de campo completo
//
// Cinco leituras, e cada uma acrescenta ao contorno sem redesenha-lo.
//
// ---------------------------------------------------------------------------
// O QUE ESTE MODULO NAO PODE FAZER
// ---------------------------------------------------------------------------
// Nada aqui toca hitbox, raio, ancora, footprint ou animacao. Sao tracos
// desenhados DEPOIS do sprite, em cima dele, num `save()/restore()`. A colisao
// continua sendo `player.radius`, que a simulacao decide e que este arquivo nem
// importa. Um jogador de G-04 ocupa exatamente o mesmo espaco que um de G-00 —
// senao a arvore estaria vendendo hitbox, que e a pior coisa que ela poderia
// vender.
//
// E um MVP declarado: overlays de runtime, com os atlases finais registrados
// como trabalho futuro na spec. O fallback e nao desenhar nada, que e o
// Prospector de sempre.

import type { ProspectorGeneration } from '@voxelyn/survival-sim';

/** Quanto cada marco acrescenta, em ordem. Indice = numero da geracao. */
const MARK_ORDER: readonly ProspectorGeneration[] = ['G-00', 'G-01', 'G-02', 'G-03', 'G-04'];

export const generationIndex = (generation: ProspectorGeneration): number =>
  Math.max(0, MARK_ORDER.indexOf(generation));

export type GenerationMarks = {
  /** Ombreiras: dois blocos curtos sobre os ombros. */
  pauldrons: boolean;
  /** Antena dorsal curta. */
  antenna: boolean;
  /** Placa frontal no torso. */
  breastplate: boolean;
  /** Aletas de dissipacao nas costas. */
  finStack: boolean;
  /** Pistoes expostos nas pernas. */
  pistons: boolean;
  /** Halo do reator ampliado. */
  reactorRing: boolean;
};

/**
 * O que desenhar para uma geracao. CUMULATIVO por design.
 *
 * G-02 nao substitui as ombreiras de G-01: ele as mantem e acrescenta. A
 * progressao tem de LER como acumulo — o chassi cresce, nao troca —, que e a
 * mesma ideia que a ficcao da Aurix conta sobre as geracoes se depositarem umas
 * sobre as outras.
 */
export const marksFor = (generation: ProspectorGeneration): GenerationMarks => {
  const g = generationIndex(generation);
  return {
    pauldrons: g >= 1,
    antenna: g >= 1,
    breastplate: g >= 2,
    finStack: g >= 2,
    pistons: g >= 3,
    reactorRing: g >= 4,
  };
};

/** A cor do metal acrescentado: liga Aurix, e nao ouro de loot. */
const PLATE = '#8d9bb0';
const PLATE_DARK = '#5d6b80';
const REACTOR = '#59f2c2';

/**
 * Desenha os marcos sobre um Prospector ja desenhado.
 *
 * `sx`/`sy` sao os PES (a mesma ancora do sprite) e `z` o zoom do mundo — os
 * mesmos que a chamada de sprite usou, para os tracos acompanharem a camera sem
 * uma segunda escala que possa divergir.
 *
 * `facingX` decide de que lado a antena e as ombreiras aparecem, porque numa
 * projecao 2:1 desenhar simetrico faz o corpo parecer virado de frente sempre.
 */
export const drawGenerationMarks = (
  ctx: CanvasRenderingContext2D,
  marks: GenerationMarks,
  sx: number,
  sy: number,
  z: number,
  facingX: number,
  nowMs: number,
): void => {
  // Nada a desenhar: G-00 sai por aqui sem custo nenhum de contexto.
  if (!marks.pauldrons && !marks.antenna) return;

  const side = facingX >= 0 ? 1 : -1;
  ctx.save();
  ctx.lineCap = 'butt';

  // Ombreiras: dois blocos curtos na altura dos ombros (~13z acima dos pes).
  if (marks.pauldrons) {
    ctx.fillStyle = PLATE;
    ctx.fillRect(sx - 6.5 * z, sy - 14 * z, 2.6 * z, 1.8 * z);
    ctx.fillRect(sx + 3.9 * z, sy - 14 * z, 2.6 * z, 1.8 * z);
  }

  // Antena: curta, inclinada para tras em relacao ao rumo.
  if (marks.antenna) {
    ctx.strokeStyle = PLATE_DARK;
    ctx.lineWidth = Math.max(1, 0.7 * z);
    ctx.beginPath();
    ctx.moveTo(sx - side * 1.5 * z, sy - 16 * z);
    ctx.lineTo(sx - side * 3.2 * z, sy - 21 * z);
    ctx.stroke();
  }

  // Placa frontal: uma faixa no torso, do lado para onde o corpo olha.
  if (marks.breastplate) {
    ctx.fillStyle = PLATE_DARK;
    ctx.fillRect(sx - 3 * z, sy - 12 * z, 6 * z, 1.6 * z);
  }

  // Dissipador dorsal: tres aletas empilhadas atras do ombro.
  if (marks.finStack) {
    ctx.fillStyle = PLATE;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx - side * 5.4 * z, sy - (15.5 - i * 1.5) * z, 2.2 * z, 1 * z);
    }
  }

  // Pistoes: dois tracos verticais curtos nas pernas.
  if (marks.pistons) {
    ctx.strokeStyle = PLATE;
    ctx.lineWidth = Math.max(1, 0.6 * z);
    for (const dx of [-2.6, 2.0]) {
      ctx.beginPath();
      ctx.moveTo(sx + dx * z, sy - 6.5 * z);
      ctx.lineTo(sx + dx * z, sy - 2.5 * z);
      ctx.stroke();
    }
  }

  // Halo do reator: o unico traco EMISSIVO, e o unico que pulsa.
  //
  // Reservado ao capstone geracional de proposito — se cada marco brilhasse, o
  // brilho pararia de significar "esta unidade e de campo completo" e viraria
  // enfeite. A pulsacao e lenta (~1,4 s) para nao competir com a leitura de
  // calor, que usa o mesmo canal de atencao.
  if (marks.reactorRing) {
    const pulse = 0.55 + 0.25 * Math.sin(nowMs / 220);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = REACTOR;
    ctx.lineWidth = Math.max(1, 0.6 * z);
    ctx.beginPath();
    ctx.ellipse(sx - side * 4.2 * z, sy - 13 * z, 2.4 * z, 1.2 * z, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
};
