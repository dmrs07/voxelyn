import type { HackState, Track } from '../../sim/types.js';

/**
 * A TEORIA MUSICAL do Catathon, como funcoes puras.
 *
 * Tudo aqui roda sem AudioContext — e por isso e testavel em vitest, do mesmo
 * jeito que a simulacao. O que decide QUAIS camadas tocam, QUAIS notas saem e
 * QUANDO uma troca acontece mora aqui; o WebAudio so obedece.
 *
 * A direcao: re eletrico quente, lo-fi de madrugada, "gatos produtivos a
 * meia-noite". Tom de RE MAIOR. TUDO que soa — UI, eventos, ate o erro — vive
 * nesta tonalidade: um bug nao ganha buzina de erro, ganha um intervalo
 * suspenso DENTRO da musica.
 */

/** Hz a partir de MIDI. A4 = 69 = 440. */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

// Re maior: D E F# G A B C#. O centro do jogo.
export const D2 = 38;
export const D3 = 50;
export const D4 = 62;

/**
 * O MOTIVO de cinco notas: subida curiosa, hesitacao, resolucao.
 * D — F# — A — G — D. As tres primeiras formam a ideia; a quarta duvida; a
 * quinta volta para casa.
 */
export const MOTIF: readonly number[] = [D4, D4 + 4, D4 + 7, D4 + 5, D4];

/** O motivo SEM resolver: para a derrota gentil e o build que caiu. */
export const MOTIF_UNRESOLVED: readonly number[] = [D4, D4 + 4, D4 + 7, D4 + 5];

/**
 * A progressao do groove, um acorde por COMPASSO, em ciclo de quatro:
 * Dmaj7 — Gmaj7 — Bm7 — A7sus. Lo-fi de estudio: quente, sem drama.
 */
export const PROGRESSION: readonly (readonly number[])[] = [
  [D3, D3 + 4, D3 + 7, D3 + 11],
  [D3 - 7, D3 - 3, D3, D3 + 4],
  [D3 - 3, D3, D3 + 4, D3 + 7],
  [D3 - 5, D3, D3 + 5, D3 + 7],
];

/** A raiz do baixo por compasso, com nota de passagem no 4o tempo. */
export const BASS_ROOTS: readonly number[] = [D2, D2 + 5, D2 + 9, D2 + 7];

/**
 * O acorde SUSPENSO da tensao: sobre a mesma fundamental, a terca vira quarta.
 * E o "algo esta errado" da direcao — nunca um buzzer fora do tom.
 */
export const SUSPENDED: readonly number[] = [D3, D3 + 5, D3 + 7];

/** Timbre de ship por disciplina (direcao §8): registro e voz diferentes. */
export const SHIP_NOTES: Record<Track, { midi: readonly number[]; voice: 'pluck' | 'bass' | 'chime' | 'click' }> = {
  frontend: { midi: [D4 + 12, D4 + 16, D4 + 19], voice: 'pluck' },
  backend: { midi: [D3, D3 + 7], voice: 'bass' },
  design: { midi: [D4 + 4, D4 + 9], voice: 'chime' },
  devops: { midi: [D4, D4 + 7, D4 + 12], voice: 'click' },
};

/**
 * As CAMADAS adaptativas (direcao §5) e quem as liga. Sao decisoes de estado,
 * nunca de animacao: os sinais vem da simulacao.
 */
export type LayerId = 'bed' | 'work' | 'flow' | 'tension' | 'deadline' | 'exhaustion';

export type MusicSignals = {
  workingCount: number;
  /** Bola de pelo ativa, cabo mordido, bug vivo ou build quebrado. */
  blocked: boolean;
  avgEnergy: number;
  /** Fracao do relogio do hackathon ja consumida, 0..1. */
  clock: number;
};

export const signalsOf = (state: HackState): MusicSignals => ({
  workingCount: state.cats.filter((c) => c.mode === 'work').length,
  blocked:
    state.hairball.active ||
    state.cableOut ||
    state.buildBroken ||
    state.bugs.some((b) => !b.fixed),
  avgEnergy: state.cats.reduce((n, c) => n + c.energy, 0) / state.cats.length,
  clock: Math.min(1, state.tick / (30 * 480)),
});

/**
 * Quais camadas devem estar ATIVAS para estes sinais.
 *
 * - bed: sempre — o piano e o pad-ronrom nunca param; silencio total e morte.
 * - work: alguem trabalhando poe o ritmo.
 * - flow: tres ou mais em fluxo poem o shaker e os fragmentos do motivo.
 * - tension: bloqueio poe a harmonia suspensa (e NAO tira as outras — o baixo
 *   segue confiante sob a incerteza, como a direcao pede).
 * - deadline: o ultimo quinto do relogio poe o pulso.
 * - exhaustion: equipe apagando FILTRA o mundo em vez de adicionar camada.
 */
export const activeLayers = (s: MusicSignals): Set<LayerId> => {
  const on = new Set<LayerId>(['bed']);
  if (s.workingCount >= 1) on.add('work');
  if (s.workingCount >= 3) on.add('flow');
  if (s.blocked) on.add('tension');
  if (s.clock >= 0.8) on.add('deadline');
  if (s.avgEnergy < 0.35) on.add('exhaustion');
  return on;
};

/** O compasso (0..3) do ciclo harmonico em que um passo cai. */
export const barOf = (step16: number): number => Math.floor(step16 / 16) % 4;

/** Um compasso, em ticks de SIMULACAO (2.5s de musica a 30Hz de jogo). */
export const BAR_SIM_TICKS = Math.round(((60 / 96 / 4) * 16) * 30);

/**
 * Camadas com ENTRADA imediata e SAIDA pegajosa.
 *
 * Uma camada liga no tick em que o estado a justifica e so desliga depois de
 * um compasso inteiro sem justificativa: um carinho de meio segundo nao
 * derruba o groove. E o cumprimento pratico do "transicoes em fronteira de
 * compasso" da direcao — medido no UNICO relogio que comprovadamente anda
 * junto do jogo, o tick da simulacao. A primeira versao esperava a fronteira
 * no agendador de audio, e numa aba oculta (o headless dos testes, um telefone
 * de tela apagada) setInterval, AudioContext.currentTime e performance.now
 * congelam JUNTOS em rajadas: tres failsafes medidos nesses relogios falharam
 * um atras do outro. As notas ja saem quantizadas por passo de todo modo.
 *
 * Muta `lastActive` (o registro de justificativa) e devolve o conjunto ativo.
 */
export const stickyLayers = (
  lastActive: Partial<Record<LayerId, number>>,
  s: MusicSignals,
  simTick: number
): Set<LayerId> => {
  const justified = activeLayers(s);
  for (const layer of justified) lastActive[layer] = simTick;
  const next = new Set<LayerId>();
  for (const layer of ['bed', 'work', 'flow', 'tension', 'deadline', 'exhaustion'] as const) {
    const last = lastActive[layer];
    if (layer === 'bed' || (last !== undefined && simTick - last <= BAR_SIM_TICKS)) next.add(layer);
  }
  return next;
};

/**
 * PADROES rítmicos por camada, em passos de semicolcheia (16 por compasso).
 * Escritos a mao para soar tocados, nao gerados: o bumbo abafado empurra, o
 * rim responde, o shaker preenche sem lotar.
 */
export const PATTERNS = {
  kick: [0, 7, 10],
  rim: [4, 12],
  shaker: [0, 2, 4, 6, 8, 10, 12, 14],
  /** O "teclado como percussao" da direcao: semicolcheias falhadas. */
  keys: [1, 3, 5, 6, 9, 11, 13],
  /** Pulso do deadline: colcheias retas no rim, urgencia por densidade. */
  deadline: [0, 2, 4, 6, 8, 10, 12, 14],
  bass: [0, 3, 8, 11, 14],
} as const;

/**
 * Fragmento do motivo para a camada de flow: qual nota (ou nenhuma) cai num
 * passo. Determinista no passo GLOBAL para dar variacao sem RNG — a musica
 * do cliente pode ser livre do rng da simulacao, mas nao pode ser aleatoria
 * de verdade, senao dois espectadores do mesmo replay ouvem musicas
 * diferentes por principio.
 */
export const flowNoteAt = (globalStep: number): number | null => {
  const phrase = Math.floor(globalStep / 64) % 3;
  const pos = globalStep % 64;
  if (phrase === 2) return null; // um ciclo de silencio: respiro
  const hits = [0, 12, 24, 36, 48];
  const idx = hits.indexOf(pos);
  if (idx === -1) return null;
  return MOTIF[(idx + phrase) % MOTIF.length];
};
