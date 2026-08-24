import {
  BASS_ROOTS,
  MOTIF_UNRESOLVED,
  PATTERNS,
  PROGRESSION,
  SUSPENDED,
  barOf,
  flowNoteAt,
  D2,
  stickyLayers,
  type LayerId,
  type MusicSignals,
} from './theory.js';
import { bass, epiano, felt, kick, purrPad, rim, shaker, pluck, clack } from './voices.js';
import { setTiredness, type Mixer } from './mixer.js';

/**
 * O TRANSPORTE e o GRAFO ADAPTATIVO, juntos porque um so existe para o outro.
 *
 * O padrao e o classico do WebAudio: um setInterval impreciso ACORDA o
 * agendador, e o agendador marca notas com antecedencia no relogio preciso do
 * AudioContext. O ritmo nunca depende do timer da pagina.
 *
 * As camadas (direcao §5) NAO sao stems ligados/desligados: sao decisoes por
 * passo. A troca so acontece em fronteira de compasso — `pending` segura o
 * proximo conjunto ate la — e por isso a musica nunca "reinicia" quando o
 * estado do jogo muda no meio de uma frase.
 */

const BPM = 96;
const STEP_S = 60 / BPM / 4;
const LOOKAHEAD_S = 0.12;
const WAKE_MS = 40;

export type MusicEngine = {
  running: boolean;
  step: number;
  layers: Set<LayerId>;
  /** Ultimo tick de simulacao em que cada camada esteve JUSTIFICADA. */
  lastActive: Partial<Record<LayerId, number>>;
  nextNoteTime: number;
  timer: number;
  pad: { stop: () => void } | null;
  /** Congelado apos a submissao: a demo tem silencio proprio. */
  frozen: boolean;
};

export const createMusic = (): MusicEngine => ({
  running: false,
  step: 0,
  layers: new Set(['bed']),
  lastActive: {},
  nextNoteTime: 0,
  timer: 0,
  pad: null,
  frozen: false,
});

/**
 * Atualiza as camadas pelos sinais. A regra (entrada imediata, saida pegajosa
 * de um compasso, medida em tick de simulacao) vive em `stickyLayers`, na
 * teoria — pura e testada; aqui so o efeito colateral de filtro.
 */
export const setSignals = (m: MusicEngine, mix: Mixer, s: MusicSignals, simTick: number): void => {
  m.layers = stickyLayers(m.lastActive, s, simTick);
  // A exaustao e continua, nao por compasso: e filtro, nao frase.
  setTiredness(mix, s.avgEnergy < 0.5 ? (0.5 - s.avgEnergy) * 2 : 0);
};

const scheduleStep = (m: MusicEngine, mix: Mixer, when: number): void => {
  const bar = barOf(m.step);
  const pos = m.step % 16;
  const L = m.layers;
  const tension = L.has('tension');

  // CAMA: acorde no 1 de cada compasso — suspenso sob tensao, nunca buzina.
  if (pos === 0) {
    const chord = tension ? SUSPENDED : PROGRESSION[bar];
    for (let i = 0; i < chord.length; i++) epiano(mix, chord[i], when + i * 0.012, 0.42);
  }

  if (L.has('work')) {
    if ((PATTERNS.kick as readonly number[]).includes(pos)) kick(mix, when, 0.55);
    // Sob tensao o rim MANCA de proposito: cai um golpe, entra um deslocado.
    const rims: readonly number[] = tension ? [4, 13] : PATTERNS.rim;
    if (rims.includes(pos)) rim(mix, when, 0.5);
    if ((PATTERNS.bass as readonly number[]).includes(pos)) {
      const root = BASS_ROOTS[bar];
      const note = pos === 14 ? root + 2 : root;
      bass(mix, note, when, 0.6);
    }
  }

  if (L.has('flow')) {
    if ((PATTERNS.shaker as readonly number[]).includes(pos)) shaker(mix, when, pos % 4 === 0 ? 0.4 : 0.22);
    // Teclado como percussao: clacks quantizados, bem abaixo da musica.
    if ((PATTERNS.keys as readonly number[]).includes(pos)) clack(mix, when, ((pos % 5) - 2) * 0.25, 2600, 0.5);
    const note = flowNoteAt(m.step);
    if (note !== null && !tension) pluck(mix, note, when, 0.5);
  }

  if (L.has('deadline') && (PATTERNS.deadline as readonly number[]).includes(pos)) {
    rim(mix, when + STEP_S / 2, 0.3);
    if (pos % 8 === 0) bass(mix, BASS_ROOTS[bar] + 12, when, 0.35);
  }

  m.step++;
};

export const startMusic = (m: MusicEngine, mix: Mixer): void => {
  if (m.running) return;
  m.running = true;
  m.frozen = false;
  m.nextNoteTime = mix.ctx.currentTime + 0.06;
  // O ronronar-pad na tonica: a assinatura de meia-noite, sempre presente.
  m.pad = purrPad(mix, D2 + 12);
  m.timer = window.setInterval(() => {
    if (m.frozen) return;
    while (m.nextNoteTime < mix.ctx.currentTime + LOOKAHEAD_S) {
      scheduleStep(m, mix, m.nextNoteTime);
      m.nextNoteTime += STEP_S;
    }
  }, WAKE_MS);
};

export const stopMusic = (m: MusicEngine): void => {
  m.running = false;
  window.clearInterval(m.timer);
  m.pad?.stop();
  m.pad = null;
};

/** O silencio da submissao (§7): a musica congela; o ritual de deploy fala. */
export const freezeMusic = (m: MusicEngine): void => {
  m.frozen = true;
  m.pad?.stop();
  m.pad = null;
};

/**
 * A DERROTA gentil (§3): o motivo sem resolver, num instrumento pequeno.
 * Os gatos perderam um hackathon; o mundo nao acabou.
 */
export const playSoftLoss = (mix: Mixer): void => {
  const t = mix.ctx.currentTime + 0.1;
  MOTIF_UNRESOLVED.forEach((n, i) => felt(mix, n, t + i * 0.42, 0.5));
  felt(mix, MOTIF_UNRESOLVED[0], t + MOTIF_UNRESOLVED.length * 0.42 + 0.5, 0.35);
};
