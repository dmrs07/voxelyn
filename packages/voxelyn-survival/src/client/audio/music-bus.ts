// A musica, do lado do browser.
//
// Mesmo contrato do ambience-bus: nos persistentes criados uma vez, ganho
// movido so por setTargetAtTime (atribuir `.value` num no vivo e um clique).
// A diferenca e que alem das camadas continuas (drone, pad, tensao) existe um
// SCHEDULER: o riff de baixo e feito de osciladores efemeros agendados com
// antecedencia curta — o "tale of two clocks" classico, com uma torcao:
//
//   - a IDENTIDADE musical (que compasso e, que notas ele tem) vem do relogio
//     da simulacao, via music.ts — igual em toda maquina;
//   - o AGENDAMENTO (quando a amostra sai do alto-falante) usa o relogio do
//     proprio AudioContext — local por natureza.
//
// update(simTimeSec) traduz um no outro: uma nota na posicao P da timeline da
// sim toca em `ctx.currentTime + (P - simTimeSec)`.

import type { OccupationId, StratumId } from '@voxelyn/survival-sim';
import {
  LAYER_GAINS,
  MUSIC_CEILING,
  MUSIC_DUCK_FACTOR,
  MUSIC_THEMES,
  OCCUPATION_VARIATIONS,
  barDurationSec,
  degreeHz,
  layersForIntensity,
  notesForBar,
  type MusicLayers,
  type MusicTheme,
  type OccupationVariation,
} from './music';

/**
 * Janela de agendamento, em segundos. So entra no WebAudio o que toca dentro
 * dela: curta o bastante para uma troca de tema nao deixar meio compasso do
 * tema velho ja agendado, longa o bastante para sobreviver a um quadro perdido.
 */
const LOOKAHEAD_SECONDS = 0.4;

/**
 * Atraso apos suspensao/stall alem do qual o scheduler NAO tenta repor as
 * notas perdidas. Voltar de uma aba suspensa despejando oito notas atrasadas
 * de uma vez e o pior som que este barramento pode fazer; ele pula para o
 * proximo compasso valido e segue.
 */
const MAX_CATCHUP_BARS = 1;

/** Rampas do crossfade de tema, em segundos (constantes de tempo). */
const FADE_DOWN_TAU = 0.5; // desce em ~1.5 s
const FADE_UP_TAU = 1.0; // volta em ~3 s
/** Piso do drone durante a troca: fracao do ganho base. NUNCA zero. */
const CROSSFADE_FLOOR = 0.2;
/** Quando (apos o inicio da troca) o retune acontece, no vale da curva. */
const RETUNE_AT_SEC = 1.2;

/** Ducking: ataque e recuperacao. O fator vem de music.ts (os dois buses compartilham). */
const DUCK_ATTACK_TAU = 0.015; // ~40 ms
const DUCK_RELEASE_TAU = 0.25; // ~0.8 s
const DUCK_HOLD_SEC = 0.12;

/** Rampas de entrada/saida de camada (limiar de intensidade nao e degrau). */
const LAYER_RISE_TAU = 0.6; // ~1.5-2 s
const LAYER_FALL_TAU = 0.8;

/** Sub-mixagem das vozes do drone (somam ~1 dentro de LAYER_GAINS.drone). */
const DRONE_MAIN = 0.55;
const DRONE_SECONDARY = 0.3;
const DRONE_ADDED = 0.22;

/**
 * Cancela a automacao futura de um parametro ANCORANDO o valor atual.
 *
 * `cancelScheduledValues` sozinho faz o parametro saltar para o ultimo valor
 * escrito, que num ganho em movimento e um degrau audivel. `cancelAndHoldAtTime`
 * resolve exatamente isso, mas nem todo browser o tem; o fallback le `.value`
 * (o valor instantaneo) e o re-escreve como ponto de partida.
 */
const cancelAndHold = (param: AudioParam, t: number): void => {
  const holdable = param as AudioParam & { cancelAndHoldAtTime?: (when: number) => AudioParam };
  if (typeof holdable.cancelAndHoldAtTime === 'function') {
    holdable.cancelAndHoldAtTime(t);
  } else {
    const current = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(current, t);
  }
};

export class MusicBus {
  private started = false;
  private silenced = true;

  private theme: MusicTheme | null = null;
  private variation: OccupationVariation = OCCUPATION_VARIATIONS.none;
  private stratum: StratumId | null = null;
  private occupation: OccupationId | null = null;
  /** Pedido de tema chegado antes de start(): aplicado ao iniciar. */
  private pending: { stratum: StratumId; occupation: OccupationId } | null = null;

  private layers: MusicLayers = layersForIntensity(0);
  private musicVolume = 0.7;

  // Cursor do scheduler, na timeline da simulacao (segundos/compassos/notas).
  private cursorBar = -1;
  private cursorNotes: ReturnType<typeof notesForBar> = [];
  private cursorNoteIdx = 0;
  /** Riff calado ate este ponto da timeline da sim (durante crossfade). */
  private riffMuteUntilSim = 0;

  // Nos persistentes. Cadeia: camadas -> duck -> bus -> out.
  private busGain: GainNode | null = null;
  private duckGain: GainNode | null = null;
  private droneMain: OscillatorNode | null = null;
  private droneMainGain: GainNode | null = null;
  private droneSecondary: OscillatorNode | null = null;
  private droneSecondaryGain: GainNode | null = null;
  private droneAdded: OscillatorNode | null = null;
  private droneAddedGain: GainNode | null = null;
  private droneLayerGain: GainNode | null = null;
  private padOsc: OscillatorNode | null = null;
  private padTrem: GainNode | null = null;
  private padTremLfo: OscillatorNode | null = null;
  private padTremDepth: GainNode | null = null;
  private padLayerGain: GainNode | null = null;
  private tensionOsc: OscillatorNode | null = null;
  private tensionLayerGain: GainNode | null = null;
  private bassLayerGain: GainNode | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  /** Cria os nos persistentes em ganho zero. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { ctx, out } = this;
    const t0 = ctx.currentTime;

    this.busGain = ctx.createGain();
    this.busGain.gain.value = 0;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.duckGain.connect(this.busGain).connect(out);

    const layer = (value: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = value;
      g.connect(this.duckGain as GainNode);
      return g;
    };

    // Drone: fundamental + copia detunavel + voz adicionada da ocupacao. As
    // tres nascem tocando (osciladores persistentes nunca param); quem decide
    // o que se ouve e a arvore de ganhos.
    this.droneLayerGain = layer(LAYER_GAINS.drone);
    const drone = (sub: number): { osc: OscillatorNode; gain: GainNode } => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 55;
      const gain = ctx.createGain();
      gain.gain.value = sub;
      osc.connect(gain).connect(this.droneLayerGain as GainNode);
      osc.start(t0);
      return { osc, gain };
    };
    ({ osc: this.droneMain, gain: this.droneMainGain } = drone(DRONE_MAIN));
    ({ osc: this.droneSecondary, gain: this.droneSecondaryGain } = drone(0));
    ({ osc: this.droneAdded, gain: this.droneAddedGain } = drone(0));

    // Pad: um oscilador uma-oitava-e-um-intervalo acima do drone, com um
    // portao de tremolo que so a Aurix usa (profundidade zero fora dela).
    this.padLayerGain = layer(0);
    this.padOsc = ctx.createOscillator();
    this.padOsc.type = 'triangle';
    this.padOsc.frequency.value = 110;
    this.padTrem = ctx.createGain();
    this.padTrem.gain.value = 1;
    this.padOsc.connect(this.padTrem).connect(this.padLayerGain);
    this.padOsc.start(t0);
    this.padTremLfo = ctx.createOscillator();
    this.padTremLfo.type = 'sine';
    this.padTremLfo.frequency.value = 1;
    this.padTremDepth = ctx.createGain();
    this.padTremDepth.gain.value = 0;
    this.padTremLfo.connect(this.padTremDepth).connect(this.padTrem.gain);
    this.padTremLfo.start(t0);

    // Tensao: o tritono baixo da Aurix (ou o que a variacao mandar). So toca
    // no fundo da descida, e so quando a ocupacao declara o intervalo.
    this.tensionLayerGain = layer(0);
    this.tensionOsc = ctx.createOscillator();
    this.tensionOsc.type = 'sine';
    this.tensionOsc.frequency.value = 78;
    this.tensionOsc.connect(this.tensionLayerGain);
    this.tensionOsc.start(t0);

    // As notas efemeras do riff entram por aqui (ver scheduleNote).
    this.bassLayerGain = layer(0);

    if (this.pending) {
      const { stratum, occupation } = this.pending;
      this.pending = null;
      this.setTheme(stratum, occupation);
    }
  }

  /**
   * Troca o tema. UNICO gatilho de crossfade: intensidade nunca passa por
   * aqui. Inocuo antes de start() (o pedido fica guardado) e quando o par
   * (estrato, ocupacao) nao mudou.
   */
  setTheme(stratum: StratumId, occupation: OccupationId): void {
    if (!this.started || !this.busGain) {
      this.pending = { stratum, occupation };
      return;
    }
    if (stratum === this.stratum && occupation === this.occupation) return;

    const first = this.theme === null;
    this.stratum = stratum;
    this.occupation = occupation;
    this.theme = MUSIC_THEMES[stratum];
    this.variation = OCCUPATION_VARIATIONS[occupation];

    const t = this.ctx.currentTime;
    const base = this.baseGain();
    this.silenced = false;

    if (first) {
      // Primeira vez nao tem de onde cair: afina ja e nasce devagar.
      this.retune(t);
      cancelAndHold(this.busGain.gain, t);
      this.busGain.gain.setTargetAtTime(base, t, FADE_UP_TAU);
    } else {
      // O drone desce ate o piso — nunca ate zero: um buraco de 1,5 s soa
      // como o audio desligando, nao como o lugar mudando. O retune acontece
      // no vale, onde a mudanca de afinacao e textura e nao glissando.
      cancelAndHold(this.busGain.gain, t);
      this.busGain.gain.setTargetAtTime(base * CROSSFADE_FLOOR, t, FADE_DOWN_TAU);
      this.busGain.gain.setTargetAtTime(base, t + RETUNE_AT_SEC, FADE_UP_TAU);
      this.retune(t + RETUNE_AT_SEC);
    }

    // O riff cala durante a descida e volta afinado no compasso seguinte ao
    // vale. O cursor e invalidado: o tema novo pode ter outro compasso.
    this.riffMuteUntilSim = this.lastSimTime + (first ? 0 : RETUNE_AT_SEC);
    this.cursorBar = -1;
    this.applyLayers();
  }

  /**
   * Profundidade da descida (0..1). So automatiza ganhos de camada — nunca
   * reinicia o scheduler, nunca mexe em compasso, nunca dispara crossfade.
   */
  setIntensity(intensity: number): void {
    const next = layersForIntensity(intensity);
    if (
      next.bass === this.layers.bass &&
      next.pad === this.layers.pad &&
      next.tension === this.layers.tension
    ) {
      return;
    }
    this.layers = next;
    this.applyLayers();
  }

  /** Volume do usuario (0..1). MULTIPLICA o teto: 1.0 = MUSIC_CEILING. */
  setVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (!this.busGain || this.silenced) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(this.baseGain(), t, 0.1);
  }

  /**
   * Abaixa a musica sob um som que precisa do canal (telegrafo, pancada em
   * mim). Chamadas em rajada nao empilham: cada uma re-ancora e re-agenda.
   */
  duck(): void {
    if (!this.duckGain || this.silenced) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.duckGain.gain, t);
    this.duckGain.gain.setTargetAtTime(MUSIC_DUCK_FACTOR, t, DUCK_ATTACK_TAU);
    this.duckGain.gain.setTargetAtTime(1, t + DUCK_HOLD_SEC, DUCK_RELEASE_TAU);
  }

  /** Fade rapido a zero. Nao destroi nada; setTheme/wake religam. */
  silence(): void {
    if (this.silenced) return;
    this.silenced = true;
    if (!this.busGain) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(0, t, 0.25);
  }

  /**
   * Religa apos um silence() cujo motivo passou (desmute com o mesmo tema).
   * Idempotente e barato: o AudioDirector pode chamar todo quadro de run.
   */
  wake(): void {
    if (!this.silenced || !this.theme || !this.busGain) return;
    this.silenced = false;
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(this.baseGain(), t, FADE_UP_TAU);
    this.cursorBar = -1;
  }

  private lastSimTime = 0;

  /**
   * A bomba do scheduler. Chamar todo quadro com o tempo da SIMULACAO em
   * segundos (`state.tick / TICK_HZ`).
   */
  update(simTimeSec: number): void {
    this.lastSimTime = simTimeSec;
    const theme = this.theme;
    if (!this.started || !theme || this.silenced) return;
    if (!this.layers.bass || simTimeSec < this.riffMuteUntilSim) return;

    const barDur = barDurationSec(theme);
    const beatDur = 60 / theme.bpm;

    // (Re)posiciona o cursor: no primeiro quadro, apos troca de tema, ou
    // quando a sim saltou mais que MAX_CATCHUP_BARS (aba suspensa, stall).
    // Nunca ha reposicao retroativa — nota perdida e nota perdida.
    const currentBar = Math.floor(simTimeSec / barDur);
    if (this.cursorBar < 0 || currentBar - this.cursorBar > MAX_CATCHUP_BARS) {
      this.loadBar(currentBar);
    }

    for (;;) {
      if (this.cursorNoteIdx >= this.cursorNotes.length) {
        this.loadBar(this.cursorBar + 1);
        if (this.cursorBar * barDur > simTimeSec + LOOKAHEAD_SECONDS) return;
        continue;
      }
      const note = this.cursorNotes[this.cursorNoteIdx];
      const noteSimTime = this.cursorBar * barDur + note.beat * beatDur;
      if (noteSimTime > simTimeSec + LOOKAHEAD_SECONDS) return;
      this.cursorNoteIdx++;
      if (noteSimTime < simTimeSec) continue; // atrasada: pula, nao repoe
      this.scheduleNote(note.hz, note.lenBeats * beatDur, noteSimTime - simTimeSec, theme);
    }
  }

  dispose(): void {
    if (!this.started) return;
    for (const osc of [
      this.droneMain,
      this.droneSecondary,
      this.droneAdded,
      this.padOsc,
      this.padTremLfo,
      this.tensionOsc,
    ]) {
      try {
        osc?.stop();
        osc?.disconnect();
      } catch {
        // ja parado; nada a fazer
      }
    }
    this.busGain?.disconnect();
    this.started = false;
  }

  private baseGain(): number {
    return MUSIC_CEILING * this.musicVolume;
  }

  private loadBar(bar: number): void {
    const theme = this.theme;
    this.cursorBar = bar;
    this.cursorNoteIdx = 0;
    this.cursorNotes = theme ? notesForBar(theme, bar, this.layers) : [];
  }

  /** Afina todos os nos persistentes para o tema/variacao atuais, em `at`. */
  private retune(at: number): void {
    const theme = this.theme;
    if (!theme) return;
    const v = this.variation;
    const tc = 0.3;

    this.droneMain?.frequency.setTargetAtTime(theme.rootHz, at, tc);

    // A copia detunada: chorus/batimento lento. Cents -> razao.
    const detuned = theme.rootHz * Math.pow(2, v.secondaryDetuneCents / 1200);
    this.droneSecondary?.frequency.setTargetAtTime(detuned, at, tc);
    this.droneSecondaryGain?.gain.setTargetAtTime(
      v.secondaryDetuneCents > 0 ? DRONE_SECONDARY : 0,
      at,
      tc,
    );

    const added = v.droneAddedInterval;
    if (added !== undefined) {
      this.droneAdded?.frequency.setTargetAtTime(theme.rootHz * Math.pow(2, added / 12), at, tc);
    }
    this.droneAddedGain?.gain.setTargetAtTime(added !== undefined ? DRONE_ADDED : 0, at, tc);

    // Pad uma oitava acima do drone, no intervalo do tema.
    this.padOsc?.frequency.setTargetAtTime(
      theme.rootHz * Math.pow(2, (theme.padInterval + 12) / 12),
      at,
      tc,
    );
    const tremDepth = v.padTremoloHz !== undefined ? 0.4 : 0;
    this.padTremLfo?.frequency.setTargetAtTime(v.padTremoloHz ?? 1, at, tc);
    this.padTremDepth?.gain.setTargetAtTime(tremDepth, at, tc);
    this.padTrem?.gain.setTargetAtTime(1 - tremDepth, at, tc);

    const tension = v.tensionInterval;
    if (tension !== undefined) {
      this.tensionOsc?.frequency.setTargetAtTime(theme.rootHz * Math.pow(2, tension / 12), at, tc);
    }
    this.applyLayers();
  }

  /**
   * Leva os ganhos de camada aos alvos. Os limiares de layersForIntensity
   * descrevem DESEJO; a rampa daqui e o que impede um oscilador de nascer
   * seco quando a intensidade cruza 0.69 -> 0.70.
   */
  private applyLayers(): void {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const theme = this.theme;
    const ramp = (g: GainNode | null, on: boolean, value: number, riseTau?: number): void => {
      if (!g) return;
      g.gain.setTargetAtTime(on ? value : 0, t, on ? (riseTau ?? LAYER_RISE_TAU) : LAYER_FALL_TAU);
    };
    ramp(this.droneLayerGain, this.theme !== null, LAYER_GAINS.drone);
    ramp(this.bassLayerGain, this.layers.bass, LAYER_GAINS.bass);
    // O pad respira no tempo do proprio tema: padAttack e a rampa de entrada.
    ramp(
      this.padLayerGain,
      this.layers.pad,
      LAYER_GAINS.pad,
      theme ? theme.padAttack / 3 : undefined,
    );
    ramp(
      this.tensionLayerGain,
      this.layers.tension && this.variation.tensionInterval !== undefined,
      LAYER_GAINS.tension,
    );
  }

  /** Um golpe do riff: oscilador efemero com envelope, morre sozinho. */
  private scheduleNote(hz: number, lenSec: number, aheadSec: number, theme: MusicTheme): void {
    const ctx = this.ctx;
    const bass = this.bassLayerGain;
    if (!bass) return;
    const t0 = ctx.currentTime + Math.max(0.005, aheadSec);

    const osc = ctx.createOscillator();
    osc.type = theme.bassWave;
    osc.frequency.value = hz;

    // Dente-de-serra e quadrada precisam de um lowpass para caber num leito
    // grave — sem ele os harmonicos altos disputam com os SFX, que e
    // exatamente o que a musica prometeu nao fazer.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(1, t0 + 0.025);
    env.gain.setTargetAtTime(0, t0 + lenSec, theme.noteDecay / 3);

    osc.connect(lp).connect(env).connect(bass);
    osc.start(t0);
    // Tres constantes de tempo apos o inicio da cauda o envelope esta a -26 dB
    // do pico; o stop mata o no antes de virar acumulo.
    osc.stop(t0 + lenSec + theme.noteDecay * 1.5 + 0.1);
  }
}
