/**
 * A MESA DE SOM: barramentos independentes com controle proprio (direcao §14)
 * e o "bolso" de ducking (§12) — um evento critico abaixa a musica 4dB por um
 * instante em vez de gritar por cima dela.
 *
 * O layout de barramentos e o mesmo do Survival (a matriz de reuso explica por
 * que o codigo ainda nao e um pacote compartilhado): music, sfx, typing,
 * ambience, vocals. Cada um com ganho proprio persistido, porque "jogar horas
 * sem fadiga auditiva" comeca em poder desligar exatamente o que cansa.
 */

export type BusId = 'music' | 'sfx' | 'typing' | 'ambience' | 'vocals';
export const BUS_IDS: readonly BusId[] = ['music', 'sfx', 'typing', 'ambience', 'vocals'];

/** Hierarquia da mixagem (§12): rotina ABAIXO da musica, feedback acima. */
const BUS_BASE: Record<BusId, number> = {
  music: 0.5,
  sfx: 0.62,
  typing: 0.16,
  ambience: 0.12,
  vocals: 0.5,
};

export type Mixer = {
  ctx: AudioContext;
  master: GainNode;
  buses: Record<BusId, GainNode>;
  /** Filtro global de exaustao: o mundo perde os agudos quando a equipe apaga. */
  tired: BiquadFilterNode;
  prefs: Record<BusId, number>;
};

const PREFS_KEY = 'catathon.audio.v1';

export const loadPrefs = (): Record<BusId, number> => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...defaultPrefs(), ...(JSON.parse(raw) as Record<BusId, number>) };
  } catch {
    // storage bloqueado nao e jogo bloqueado
  }
  return defaultPrefs();
};

export const defaultPrefs = (): Record<BusId, number> => ({ music: 1, sfx: 1, typing: 1, ambience: 1, vocals: 1 });

export const savePrefs = (prefs: Record<BusId, number>): void => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // idem
  }
};

export const createMixer = (ctx: AudioContext, prefs: Record<BusId, number>): Mixer => {
  const master = ctx.createGain();
  master.gain.value = 0.9;

  // A exaustao filtra o MUNDO INTEIRO, nao uma camada: e a sensacao de 4h da
  // manha, e ela pertence a mixagem.
  const tired = ctx.createBiquadFilter();
  tired.type = 'lowpass';
  tired.frequency.value = 16000;
  tired.Q.value = 0.4;
  tired.connect(master);
  master.connect(ctx.destination);

  const buses = {} as Record<BusId, GainNode>;
  for (const id of BUS_IDS) {
    const g = ctx.createGain();
    g.gain.value = BUS_BASE[id] * prefs[id];
    g.connect(tired);
    buses[id] = g;
  }
  return { ctx, master, buses, tired, prefs };
};

export const setBusLevel = (mix: Mixer, id: BusId, level01: number): void => {
  mix.prefs[id] = level01;
  mix.buses[id].gain.setTargetAtTime(BUS_BASE[id] * level01, mix.ctx.currentTime, 0.05);
  savePrefs(mix.prefs);
};

/**
 * O BOLSO: -4dB na musica e ambiencia por ~1.5s. Ducking, nao volume bruto —
 * o aviso ganha espaco porque o resto cede, nao porque ele berra.
 */
export const duck = (mix: Mixer): void => {
  const t = mix.ctx.currentTime;
  for (const id of ['music', 'ambience'] as const) {
    const g = mix.buses[id].gain;
    const base = BUS_BASE[id] * mix.prefs[id];
    g.cancelScheduledValues(t);
    g.setTargetAtTime(base * 0.63, t, 0.04);
    g.setTargetAtTime(base, t + 1.1, 0.35);
  }
};

/** Exaustao: corta os agudos do mundo. `amount` 0..1. */
export const setTiredness = (mix: Mixer, amount: number): void => {
  const cutoff = 16000 * Math.pow(1800 / 16000, Math.min(1, Math.max(0, amount)));
  mix.tired.frequency.setTargetAtTime(cutoff, mix.ctx.currentTime, 0.6);
};

/** Pan por posicao de cena (0..480): o diorama respira em estereo. */
export const panOf = (x: number): number => Math.max(-0.8, Math.min(0.8, (x - 240) / 300));
