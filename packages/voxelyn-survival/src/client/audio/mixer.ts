// Quem toca, de onde, e o que fica de fora.
//
// Aritmetica pura: entra uma lista de pedidos e a posicao do ouvinte, sai a
// lista do que efetivamente vai virar som, ja com ganho, paneamento e corte de
// agudos resolvidos. Nenhum no de audio e criado aqui — e por isso que esta
// parte, que e a que decide o que o jogador escuta, pode ser testada sem
// browser.
//
// As tres decisoes que este arquivo toma, em ordem de importancia:
//
// 1. DESCARTE POR DISTANCIA antes de qualquer conta. Uma cadeia de fogo do
//    outro lado do mapa nao pode custar nada.
// 2. ORDEM POR PRIORIDADE, e so entao a trava por voz. A consequencia e a que
//    interessa: entre tres `break` no mesmo quadro, quem fica com a vaga e o
//    MAIS ALTO, ou seja o mais perto — e nao o primeiro do array, que e uma
//    ordem de iteracao de celula sem nenhum significado para o jogador.
// 3. TETO DE VOZES, aplicado por ultimo, sobre a lista ja ordenada. Quando o
//    mundo desaba, o que sobrevive e o telegrafo, nao o entulho.

import type { Cue } from './cues';
import type { VoiceId } from './voices';
import {
  FULL_PAN_DISTANCE,
  MAX_AUDIBLE_DISTANCE,
  MAX_VOICES,
  NEAR_DISTANCE,
  VOICE_SPECS,
} from './voices';

/** Abaixo disto o som nao seria percebido e so custaria um no de audio. */
export const MIN_AUDIBLE_GAIN = 0.02;

/** Corte do filtro passa-baixa junto ao ouvinte e no limite da audicao, em Hz. */
export const NEAR_CUTOFF_HZ = 16000;
export const FAR_CUTOFF_HZ = 700;

export type Listener = { x: number; y: number };

export type PlannedVoice = {
  voice: VoiceId;
  /** Ganho final, 0..~1,3. Ja inclui escala do cue e atenuacao por distancia. */
  gain: number;
  /** -1 (esquerda) a 1 (direita). */
  pan: number;
  /** Corte do passa-baixa em Hz. Distancia abafa. */
  cutoffHz: number;
};

/**
 * Atenuacao por distancia, 0..1.
 *
 * Quadratica e nao linear porque linear soa como um fade de mixagem, nao como
 * distancia: com queda linear, um som a meio caminho do limite chega com 50%
 * do ganho, que o ouvido le como "perto". A curva quadratica entrega ~25% no
 * mesmo ponto, que e o que faz uma explosao a 12 tiles soar como "ali longe"
 * em vez de "ao lado".
 */
export const distanceGain = (distance: number): number => {
  if (distance <= NEAR_DISTANCE) return 1;
  if (distance >= MAX_AUDIBLE_DISTANCE) return 0;
  const t = (distance - NEAR_DISTANCE) / (MAX_AUDIBLE_DISTANCE - NEAR_DISTANCE);
  return (1 - t) * (1 - t);
};

/**
 * Corte de agudos por distancia.
 *
 * Interpolacao EXPONENCIAL, nao linear: frequencia e percebida em oitavas, e
 * uma rampa linear de 16 kHz a 700 Hz passaria quase toda a variacao audivel
 * nos ultimos tiles, com o resto do trajeto soando igual. Este e o parametro
 * que vende "isso esta atras da parede" — mais que o volume.
 */
export const distanceCutoff = (distance: number): number => {
  if (distance <= NEAR_DISTANCE) return NEAR_CUTOFF_HZ;
  if (distance >= MAX_AUDIBLE_DISTANCE) return FAR_CUTOFF_HZ;
  const t = (distance - NEAR_DISTANCE) / (MAX_AUDIBLE_DISTANCE - NEAR_DISTANCE);
  return NEAR_CUTOFF_HZ * Math.pow(FAR_CUTOFF_HZ / NEAR_CUTOFF_HZ, t);
};

/** Paneamento a partir do deslocamento horizontal, saturando em FULL_PAN_DISTANCE. */
export const panFromOffset = (dx: number): number =>
  Math.max(-1, Math.min(1, dx / FULL_PAN_DISTANCE));

type Candidate = PlannedVoice & { priority: number };

export class CueMixer {
  /** Ultimo instante em que cada voz soou, para a trava anti-repeticao. */
  private readonly lastPlayedAt = new Map<VoiceId, number>();

  /** Esquece o historico de travas. Usado ao comecar uma run nova. */
  reset(): void {
    this.lastPlayedAt.clear();
  }

  /**
   * Resolve uma leva de pedidos no que deve soar agora.
   *
   * Chamar isto NAO e de graca do ponto de vista de estado: as travas por voz
   * sao atualizadas aqui. Chamar duas vezes com a mesma leva devolve a segunda
   * vazia, o que e o comportamento correto para um barramento de eventos que
   * so deve ser consumido uma vez.
   */
  plan(cues: readonly Cue[], listener: Listener, nowMs: number): PlannedVoice[] {
    const candidates: Candidate[] = [];

    for (const cue of cues) {
      const spec = VOICE_SPECS[cue.voice];
      if (!spec) continue;

      let gain = spec.gain * cue.scale;
      let pan = 0;
      let cutoffHz = NEAR_CUTOFF_HZ;

      if (spec.spatial) {
        const dx = cue.x - listener.x;
        const dy = cue.y - listener.y;
        const distance = Math.hypot(dx, dy);
        // Descarte barato primeiro: nada alem do alcance chega a ser medido.
        if (distance >= MAX_AUDIBLE_DISTANCE) continue;
        gain *= distanceGain(distance);
        pan = panFromOffset(dx);
        cutoffHz = distanceCutoff(distance);
      }

      if (gain < MIN_AUDIBLE_GAIN) continue;
      candidates.push({ voice: cue.voice, gain, pan, cutoffHz, priority: spec.priority });
    }

    // Prioridade manda; ganho desempata. O desempate por ganho e o que faz a
    // trava por voz guardar a instancia mais PERTO em vez da primeira da fila.
    candidates.sort((a, b) => b.priority - a.priority || b.gain - a.gain);

    const planned: PlannedVoice[] = [];
    for (const candidate of candidates) {
      if (planned.length >= MAX_VOICES) break;
      const spec = VOICE_SPECS[candidate.voice];
      const last = this.lastPlayedAt.get(candidate.voice);
      if (last !== undefined && nowMs - last < spec.minIntervalMs) continue;
      this.lastPlayedAt.set(candidate.voice, nowMs);
      planned.push({
        voice: candidate.voice,
        gain: candidate.gain,
        pan: candidate.pan,
        cutoffHz: candidate.cutoffHz,
      });
    }
    return planned;
  }
}
