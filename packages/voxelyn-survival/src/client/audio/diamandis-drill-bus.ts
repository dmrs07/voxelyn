// O LEITO DA BROCA do Diamandis: a maquina passando dos limites.
//
// A broca nao e um golpe com um som de golpe: e um MOTOR sob carga que ganha
// rotacao, uma carcaca que chacoalha, pes que raspam pedra e uma passagem que
// muda de altura quando cruza o ouvinte. Tudo isso e continuo, e por isso e
// um leito (nos persistentes em ganho zero, como os outros leitos de chefe) e
// nao uma sequencia de vozes. As camadas:
//
//   MOTOR    dente de serra grave e o quinto acima, filtrados: o "churn" sob
//            carga. Ganho e abertura do filtro sobem com o giro.
//   UIVO     a altura que SOBE com a rotacao — de um ronco a um apito —
//            e pulsa mais rapido quanto mais alto. E o mesmo `spin` que
//            move a pose da broca na tela: som e animacao leem a mesma curva.
//   CHOCALHO ruido em banda alta, ceifado numa taxa que cresce com o giro:
//            so aparece na rotacao alta, e e o "instavel" do fim do spool.
//   PES      ruido grave raspando, com o ganho da VELOCIDADE (nao do giro):
//            a corrida se ouve nos pes, o preparo nao.
//   DOPPLER  a passagem: o uivo sobe um pouco quando a maquina vem na direcao
//            do ouvinte e cai quando se afasta, pela velocidade RADIAL.
//   SPIN-DOWN depois do impacto ou da derrapagem, o giro cai com o engasgo
//            de `drillSpinDown` — a maquina nao desliga limpa.
//
// Os transientes (cliques do mancal, trava, arranque, batidas) sao vozes
// separadas, disparadas pelos eventos — ver cues.ts.
import type { Entity, EntityAction, SurvivalState } from '@voxelyn/survival-sim';
import {
  DIAMANDIS_DRILL_PEAK_SPEED,
  DIAMANDIS_DRILL_RECOIL_TICKS,
  DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
  DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
  drillSpeedFractionAt,
  drillSpinAt,
  drillSpinDown,
  drillStepAt,
} from '@voxelyn/survival-sim';

const GAIN_GLIDE = 0.06;
const PARAM_GLIDE = 0.05;
const CEILING = 0.22;

export type DrillBedInput = {
  /** Rotacao da broca, 0..1 — a mesma curva da pose. */
  spin: number;
  /** Velocidade do chassi, 0..1 da maxima. */
  speed: number;
  /** Velocidade RADIAL em relacao ao ouvinte: +1 vindo, -1 indo (fracao da maxima). */
  approach: number;
  /** Atenuacao por distancia, 0..1. */
  presence: number;
};

/** A altura do uivo por rotacao: de um ronco de 90 Hz a um apito de 1,1 kHz. */
export const drillWhineHz = (spin: number): number => {
  const s = Math.max(0, Math.min(1, spin));
  return 90 * Math.pow(1100 / 90, s * s);
};

/** O pulso do uivo (Hz do tremolo): mais rapido quanto mais alto. */
export const drillPulseHz = (spin: number): number => 3 + 22 * Math.max(0, Math.min(1, spin));

/** Quanto do chocalho aparece: so na rotacao alta, e forte no topo. */
export const drillRattleLevel = (spin: number): number => {
  const s = Math.max(0, Math.min(1, spin));
  return s < 0.55 ? 0 : Math.pow((s - 0.55) / 0.45, 2);
};

/** O fator de altura da passagem: alguns por cento por velocidade radial. */
export const drillDopplerFactor = (approach: number): number =>
  1 + 0.07 * Math.max(-1, Math.min(1, approach));

/** A memoria do leito entre quadros: a recuperacao que os eventos anunciam. */
export type DrillBedMemory = {
  /** Recuperacao em curso: de onde o giro cai, desde que tick e por quantos. */
  recovery: { from: number; startTick: number; ticks: number } | null;
  /** Tick em que a broca bateu, para o giro travar mesmo sem `drillImpactAt`. */
  impactTick: number;
};

export const emptyDrillMemory = (): DrillBedMemory => ({ recovery: null, impactTick: -1 });

/**
 * O que o leito deve ler neste quadro, do estado autoritativo e da memoria
 * de eventos. Pura: e o que os testes conferem.
 *
 * `approach` vem da velocidade da corrida projetada no rumo ouvinte-chefe,
 * como fracao da velocidade maxima — e o que faz a passagem soar como
 * passagem sem nenhum relogio proprio.
 */
export const drillBedInput = (
  state: Pick<SurvivalState, 'tick'> & { bossRuntime: { drillImpactAt: number } },
  boss: Pick<Entity, 'x' | 'y' | 'action'>,
  listener: { x: number; y: number },
  memory: DrillBedMemory,
  presence: number,
): DrillBedInput => {
  const action: EntityAction | undefined = boss.action;
  const tick = state.tick;
  if (action && action.kind === 'drill') {
    const localImpact = state.bossRuntime.drillImpactAt;
    const impactAt =
      localImpact >= action.releaseAt
        ? localImpact
        : memory.impactTick >= action.releaseAt
          ? memory.impactTick
          : -1;
    const spin = drillSpinAt(action, tick, impactAt);
    const running = tick >= action.releaseAt && (impactAt < 0 || tick < impactAt);
    const k = tick - action.releaseAt;
    const speed = running ? drillSpeedFractionAt(k) : 0;
    let approach = 0;
    if (running && speed > 0) {
      const toListener = { x: listener.x - boss.x, y: listener.y - boss.y };
      const d = Math.hypot(toListener.x, toListener.y) || 1;
      const along = (action.direction.x * toListener.x + action.direction.y * toListener.y) / d;
      approach = along * speed;
    }
    return { spin, speed, approach, presence };
  }
  const r = memory.recovery;
  if (r) {
    const since = tick - r.startTick;
    if (since >= r.ticks) memory.recovery = null;
    else
      return {
        spin: drillSpinDown(r.from, Math.max(0, since), r.ticks),
        speed: 0,
        approach: 0,
        presence,
      };
  }
  return { spin: 0, speed: 0, approach: 0, presence };
};

/** Um momento da broca visto nos eventos: alimenta a memoria do leito. */
export const noteDrillMoment = (memory: DrillBedMemory, moment: string, tick: number): void => {
  if (moment === 'drill_impact') {
    memory.impactTick = tick;
    memory.recovery = {
      from: 0.15,
      startTick: tick + 1 + DIAMANDIS_DRILL_RECOIL_TICKS,
      ticks: DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
    };
  } else if (moment === 'drill_skid') {
    memory.recovery = {
      from: 0.85,
      startTick: tick + 1,
      ticks: DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
    };
  } else if (moment === 'drill_lock') {
    memory.impactTick = -1;
  }
};

/** Exportado para quem quiser conferir que a corrida tem pico de verdade. */
export const DRILL_PEAK_TILES_PER_SECOND = DIAMANDIS_DRILL_PEAK_SPEED;
export const drillStepForTests = drillStepAt;

export class DiamandisDrillBus {
  private gain: GainNode | null = null;
  private churn: OscillatorNode | null = null;
  private churnB: OscillatorNode | null = null;
  private churnFilter: BiquadFilterNode | null = null;
  private churnGain: GainNode | null = null;
  private whine: OscillatorNode | null = null;
  private whineGain: GainNode | null = null;
  private pulse: OscillatorNode | null = null;
  private pulseDepth: GainNode | null = null;
  private rattleGain: GainNode | null = null;
  private rattleChop: OscillatorNode | null = null;
  private feetGain: GainNode | null = null;
  private started = false;
  private readonly sources: AudioScheduledSourceNode[] = [];

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noise: AudioBuffer,
  ) {}

  /** Cria a cadeia em ganho zero. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { ctx, out, noise } = this;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.connect(out);

    // O MOTOR: dois dentes de serra (fundamental e quinta desafinada) num
    // passa-baixa que abre com a carga.
    const churnFilter = ctx.createBiquadFilter();
    churnFilter.type = 'lowpass';
    churnFilter.frequency.setValueAtTime(220, t0);
    churnFilter.Q.setValueAtTime(3, t0);
    const churnGain = ctx.createGain();
    churnGain.gain.setValueAtTime(0, t0);
    const churn = ctx.createOscillator();
    churn.type = 'sawtooth';
    churn.frequency.setValueAtTime(48, t0);
    const churnB = ctx.createOscillator();
    churnB.type = 'sawtooth';
    churnB.frequency.setValueAtTime(48 * 1.5 * 1.006, t0);
    churn.connect(churnFilter);
    churnB.connect(churnFilter);
    churnFilter.connect(churnGain).connect(gain);
    churn.start(t0);
    churnB.start(t0);
    this.sources.push(churn, churnB);

    // O UIVO: uma onda quadrada suavizada cuja altura sobe com o giro, com um
    // tremolo (pulso) cuja taxa tambem sobe.
    const whine = ctx.createOscillator();
    whine.type = 'triangle';
    whine.frequency.setValueAtTime(drillWhineHz(0), t0);
    const whineGain = ctx.createGain();
    whineGain.gain.setValueAtTime(0, t0);
    const pulse = ctx.createOscillator();
    pulse.type = 'sine';
    pulse.frequency.setValueAtTime(drillPulseHz(0), t0);
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.setValueAtTime(0, t0);
    pulse.connect(pulseDepth).connect(whineGain.gain);
    whine.connect(whineGain).connect(gain);
    whine.start(t0);
    pulse.start(t0);
    this.sources.push(whine, pulse);

    // O CHOCALHO: ruido em banda alta, ceifado por uma quadrada.
    const rattleSrc = ctx.createBufferSource();
    rattleSrc.buffer = noise;
    rattleSrc.loop = true;
    const rattleFilter = ctx.createBiquadFilter();
    rattleFilter.type = 'bandpass';
    rattleFilter.frequency.setValueAtTime(2600, t0);
    rattleFilter.Q.setValueAtTime(4, t0);
    const rattleChopGain = ctx.createGain();
    rattleChopGain.gain.setValueAtTime(0.5, t0);
    const rattleChop = ctx.createOscillator();
    rattleChop.type = 'square';
    rattleChop.frequency.setValueAtTime(11, t0);
    const chopDepth = ctx.createGain();
    chopDepth.gain.setValueAtTime(0.5, t0);
    rattleChop.connect(chopDepth).connect(rattleChopGain.gain);
    const rattleGain = ctx.createGain();
    rattleGain.gain.setValueAtTime(0, t0);
    rattleSrc.connect(rattleFilter).connect(rattleChopGain).connect(rattleGain).connect(gain);
    rattleSrc.start(t0);
    rattleChop.start(t0);
    this.sources.push(rattleSrc, rattleChop);

    // OS PES: ruido grave raspando, ganho pela velocidade.
    const feetSrc = ctx.createBufferSource();
    feetSrc.buffer = noise;
    feetSrc.loop = true;
    feetSrc.playbackRate.value = 0.6;
    const feetFilter = ctx.createBiquadFilter();
    feetFilter.type = 'lowpass';
    feetFilter.frequency.setValueAtTime(420, t0);
    const feetGain = ctx.createGain();
    feetGain.gain.setValueAtTime(0, t0);
    feetSrc.connect(feetFilter).connect(feetGain).connect(gain);
    feetSrc.start(t0);
    this.sources.push(feetSrc);

    this.gain = gain;
    this.churn = churn;
    this.churnB = churnB;
    this.churnFilter = churnFilter;
    this.churnGain = churnGain;
    this.whine = whine;
    this.whineGain = whineGain;
    this.pulse = pulse;
    this.pulseDepth = pulseDepth;
    this.rattleGain = rattleGain;
    this.rattleChop = rattleChop;
    this.feetGain = feetGain;
  }

  /** Poe o leito no regime deste quadro. Chamar uma vez por quadro. */
  set(input: DrillBedInput): void {
    const {
      ctx,
      gain,
      churn,
      churnB,
      churnFilter,
      churnGain,
      whine,
      whineGain,
      pulse,
      pulseDepth,
      rattleGain,
      rattleChop,
      feetGain,
    } = this;
    if (
      !gain ||
      !churn ||
      !churnB ||
      !churnFilter ||
      !churnGain ||
      !whine ||
      !whineGain ||
      !pulse ||
      !pulseDepth ||
      !rattleGain ||
      !rattleChop ||
      !feetGain
    )
      return;
    const now = ctx.currentTime;
    const spin = Math.max(0, Math.min(1, input.spin));
    const speed = Math.max(0, Math.min(1, input.speed));
    const presence = Math.max(0, Math.min(1, input.presence));
    const doppler = drillDopplerFactor(input.approach);
    // Motor: a carga abre o filtro e engrossa; a fundamental sobe pouco.
    const churnHz = (48 + 30 * spin) * doppler;
    churn.frequency.setTargetAtTime(churnHz, now, PARAM_GLIDE);
    churnB.frequency.setTargetAtTime(churnHz * 1.5 * 1.006, now, PARAM_GLIDE);
    churnFilter.frequency.setTargetAtTime(220 + 900 * spin, now, PARAM_GLIDE);
    churnGain.gain.setTargetAtTime(spin > 0.02 ? 0.28 + 0.3 * spin : 0, now, GAIN_GLIDE);
    // Uivo: altura e pulso pelo giro; a passagem desloca a altura.
    whine.frequency.setTargetAtTime(drillWhineHz(spin) * doppler, now, PARAM_GLIDE);
    pulse.frequency.setTargetAtTime(drillPulseHz(spin), now, PARAM_GLIDE);
    const whineLevel = spin > 0.05 ? 0.06 + 0.2 * spin : 0;
    whineGain.gain.setTargetAtTime(whineLevel, now, GAIN_GLIDE);
    pulseDepth.gain.setTargetAtTime(whineLevel * 0.6, now, GAIN_GLIDE);
    // Chocalho: so no alto, cada vez mais rapido.
    rattleGain.gain.setTargetAtTime(0.3 * drillRattleLevel(spin), now, GAIN_GLIDE);
    rattleChop.frequency.setTargetAtTime(8 + 26 * spin, now, PARAM_GLIDE);
    // Pes: pela velocidade.
    feetGain.gain.setTargetAtTime(0.35 * speed, now, GAIN_GLIDE);
    const level = spin > 0.02 || speed > 0 ? CEILING * presence : 0;
    gain.gain.setTargetAtTime(level, now, GAIN_GLIDE);
  }

  /** Cala o leito sem destruir nada. */
  silence(): void {
    if (!this.gain) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, GAIN_GLIDE);
  }

  dispose(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Um no ja parado lanca; parar duas vezes nao e erro nosso.
      }
    }
    this.sources.length = 0;
    this.gain?.disconnect();
    this.gain = null;
    this.started = false;
  }
}
