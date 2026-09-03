// A musica do jogo: dados e aritmetica, zero WebAudio.
//
// Este arquivo e o espelho musical de ambience.ts — tudo aqui e puro e
// testavel em Node. Quem transforma isto em som e o music-bus, exatamente como
// o ambience-bus transforma niveis em leitos.
//
// O que a musica E aqui: um lugar, nao uma trilha. Cada estrato tem um tema de
// doom/drone lento e grave — fundacao continua (drone), um riff de baixo
// esparso, um pad — que existe para dizer "voce esta em OUTRO estrato" pelo
// mesmo motivo que o veu de cor do render existe: identidade no primeiro
// relance, sem depender de leitura. A mixagem e subordinada por contrato:
// SFX > musica, sempre. O teto do barramento inteiro fica abaixo do ganho de
// qualquer telegrafo.
//
// A decisao estrutural mais importante: a IDENTIDADE do compasso vem do
// relogio autoritativo da simulacao (`state.tick`), nunca do
// `AudioContext.currentTime`. Dois clientes em co-op que deram unlock em
// momentos diferentes — ou que acabaram de voltar de um resync — selecionam o
// MESMO compasso, porque o compasso e funcao do tick. O WebAudio so agenda a
// reproducao localmente. E por isso tambem nao ha `Math.random()` em arquivo
// nenhum de musica: variacao sai de hash de (compasso, indice), que e a mesma
// em toda maquina.

import { TICK_HZ } from '@voxelyn/survival-sim';
import type { OccupationId, StratumId } from '@voxelyn/survival-sim';

/**
 * Menor ganho de telegrafo do jogo (`telegraphRanged` em voices.ts).
 *
 * E a referencia do contrato "SFX > musica": a musica tem que ficar abaixo
 * disto no momento em que um telegrafo fala. Vive aqui, e nao como numero solto
 * em comentario e teste, porque e a fronteira que a mixagem inteira respeita.
 */
export const SMALLEST_TELEGRAPH_GAIN = 0.45;

/**
 * Teto do barramento de musica, em ganho absoluto sob o master.
 *
 * O slider de musica MULTIPLICA este teto (1.0 no slider = 0.366 de ganho),
 * nunca o substitui — implementar o slider como ganho unitario destruiria a
 * mixagem inteira.
 *
 * COMO O CONTRATO E MANTIDO. Ate aqui o teto era 0,13, escolhido para deixar a
 * musica 6 dB abaixo do menor telegrafo EM REPOUSO. Isso punha a trilha em
 * -30 LUFS no jogo com o slider no maximo — baixo demais para ser ouvida como
 * musica, que era a reclamacao. O teto subiu 9 dB, para -21 LUFS, e a protecao
 * dos SFX passou a vir do ducking em vez da margem estatica:
 *
 *   em repouso     0,366 x 1,74 (trim) = 0,637  — acima do telegrafo, de proposito
 *   sob telegrafo  0,637 x 0,35 (duck) = 0,223  — exatamente onde a musica ficava antes
 *
 * A troca e essa, e vale a pena declarar sem rodeio: perdeu-se margem no
 * silencio, que ninguem estava usando, e manteve-se margem no unico instante em
 * que ela existe para valer. Nos 40 ms em que um telegrafo soa, a mixagem e
 * bit a bit a mesma de antes; entre um telegrafo e outro, a musica finalmente
 * soa como musica.
 */
export const MUSIC_CEILING = 0.366;

/**
 * Quanto a musica cede sob uma voz de prioridade >= MUSIC_DUCK_PRIORITY.
 *
 * 0,35 (-9,1 dB) nao e gosto: e o fator que poe a musica ducada de volta em
 * ~0,223 de ganho, o mesmo ponto em que ela tocava em repouso antes do teto
 * subir. Mudou o teto, recalcule este numero junto — sao um par, e o teste
 * `mixagem declarada` cobra a relacao entre eles.
 *
 * Vive aqui, no modulo puro, porque os DOIS barramentos (procedural e trilha
 * composta) precisam do mesmo valor para "a musica ceder o canal igual". Antes
 * era uma copia privada em cada bus, sincronizada so por um comentario.
 */
export const MUSIC_DUCK_FACTOR = 0.35;

/**
 * Fracao do ganho do barramento que cabe a cada camada. Relativas ao teto, nao
 * absolutas: `drone: 0.5` significa metade de MUSIC_CEILING quando o slider
 * esta no maximo.
 */
export const LAYER_GAINS = {
  drone: 0.5,
  bass: 0.42,
  pad: 0.3,
  tension: 0.18,
} as const;

/** Uma nota do riff: offset dentro do compasso, em batidas. */
export type RiffNote = {
  beat: number;
  /** Indice na escala do tema. Alem do tamanho da escala sobe de oitava. */
  degree: number;
  lenBeats: number;
  /** Deslocamento de oitava alem do que o grau ja implica. */
  octave?: number;
};

export type MusicTheme = {
  /** Fundamental do drone, em Hz. Regiao E1..D2 (41..74 Hz): doom e grave. */
  rootHz: number;
  /** Intervalos da escala em semitons a partir da fundamental. */
  scale: readonly number[];
  /** 50..66: lento por identidade. Nunca corrida. */
  bpm: number;
  beatsPerBar: number;
  /** Quantos compassos o riff cobre antes de repetir. */
  riffBars: number;
  riff: readonly RiffNote[];
  /** Intervalo do pad acima da fundamental, em semitons. */
  padInterval: number;
  /** Cor timbrica do baixo. */
  bassWave: OscillatorType;
  /**
   * Os tres parametros expressivos — o que separa um estrato do outro alem de
   * escala e andamento, sem multiplicar renderers:
   * - riffDensity 0..1: fracao das notas do riff que um compasso toca de fato
   *   (glacial quase nao tem baixo; ferric e um pulso de maquina);
   * - noteDecay em segundos: cauda de cada nota (aquifer e swell, silica e
   *   seco);
   * - padAttack em segundos: quanto o pad demora a nascer (glacial respira,
   *   ferric estala).
   */
  riffDensity: number;
  noteDecay: number;
  padAttack: number;
};

/**
 * O que a ocupacao faz com o tema do estrato. Modelagem musical, nao numerica:
 * o detune afeta uma CAMADA DUPLICADA do drone (chorus/batimento), nunca a
 * fundamental inteira — desafinar o tema todo em 8 cents nao cria textura, so
 * poe a musica fora de qualquer referencia tonal futura.
 */
export type OccupationVariation = {
  /** Detune da copia do drone, em cents. Zero = sem copia. */
  secondaryDetuneCents: number;
  /** Voz extra do drone, em semitons acima da fundamental (mycelial: 3a menor). */
  droneAddedInterval?: number;
  /** Portao ritmico do pad, em Hz (aurix: maquina respirando errado). */
  padTremoloHz?: number;
  /** Voz de tensao, em semitons (aurix: tritono baixo). So toca no fundo da descida. */
  tensionInterval?: number;
};

export type MusicLayers = {
  drone: boolean;
  bass: boolean;
  pad: boolean;
  tension: boolean;
};

/** Nota pronta para o scheduler: posicao no compasso + frequencia resolvida. */
export type ScheduledNote = {
  beat: number;
  hz: number;
  lenBeats: number;
};

/**
 * Os oito temas. A tabela de identidades vem do proprio worldgen (strata.ts):
 * RUPTURA (basalt), RESSONANCIA (prismatic), CONDUCAO (aquifer), VENTILACAO
 * (sulfur), calor (furnace), o chao que cede (silica), INERCIA (glacial), o
 * veio industrial (ferric). O basalt e a ancora sem veu no render e e a ancora
 * musical aqui: pentatonica menor, quinta no pad, nada estranho — os outros
 * sete se desviam DELE.
 *
 * Roots escolhidos evitando a banda do leito `dread` (42/42.7 Hz): so o basalt
 * chega perto (E1 41.2), e la o batimento com o dread e consonante por
 * construcao — mesma fundamental pratica. Se o playtest desmentir, o drone do
 * basalt sobe uma oitava e o baixo fica.
 */
export const MUSIC_THEMES: Record<StratumId, MusicTheme> = {
  // GALERIAS DE BASALTO — a referencia. Riff de quatro notas espacado, pad em
  // quinta: o tema que os outros sete contradizem.
  basalt: {
    rootHz: 41.2,
    scale: [0, 3, 5, 7, 10],
    bpm: 60,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 0, lenBeats: 1.5 },
      { beat: 2, degree: 2, lenBeats: 1 },
      { beat: 4, degree: 3, lenBeats: 1.5 },
      { beat: 6, degree: 1, lenBeats: 2 },
    ],
    padInterval: 7,
    bassWave: 'triangle',
    riffDensity: 0.6,
    noteDecay: 0.5,
    padAttack: 1.2,
  },
  // CATEDRAL PRISMATICA — a nave canta. Menor com nona, quase sem baixo; o
  // pad em nona composta e o sino da catedral.
  prismatic: {
    rootHz: 61.7,
    scale: [0, 2, 3, 7, 10],
    bpm: 56,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 0, lenBeats: 2 },
      { beat: 4, degree: 1, lenBeats: 2 },
      { beat: 6, degree: 4, lenBeats: 2 },
    ],
    padInterval: 14,
    bassWave: 'sine',
    riffDensity: 0.35,
    noteDecay: 0.8,
    padAttack: 2.0,
  },
  // AQUIFERO NEGRO — pressao de profundidade. O mais lento; frigio, com a
  // segunda menor no pad (b9 composta): a agua encosta no ouvido.
  aquifer: {
    rootHz: 49.0,
    scale: [0, 1, 3, 5, 7, 8, 10],
    bpm: 52,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 0, lenBeats: 3 },
      { beat: 4, degree: 1, lenBeats: 2 },
      { beat: 6, degree: 0, lenBeats: 2 },
    ],
    padInterval: 13,
    bassWave: 'sine',
    riffDensity: 0.5,
    noteDecay: 1.2,
    padAttack: 2.5,
  },
  // FENDA SULFUROSA — o ciclo liga-desliga dos respiros. Locrio: o trito no
  // riff e o cheiro errado do ar.
  sulfur: {
    rootHz: 55.0,
    scale: [0, 1, 3, 5, 6, 8, 10],
    bpm: 66,
    beatsPerBar: 4,
    riffBars: 1,
    riff: [
      { beat: 0, degree: 0, lenBeats: 1 },
      { beat: 1.5, degree: 4, lenBeats: 0.5 },
      { beat: 2.5, degree: 0, lenBeats: 1 },
      { beat: 3.5, degree: 4, lenBeats: 0.5 },
    ],
    padInterval: 12,
    bassWave: 'triangle',
    riffDensity: 0.7,
    noteDecay: 0.35,
    padAttack: 0.8,
  },
  // FORNALHA ABISSAL — o mais pesado. Pentatonica com b5, sawtooth: o riff
  // arrastado e a divida declarada com Funeralopolis.
  furnace: {
    rootHz: 43.7,
    scale: [0, 3, 5, 6, 7, 10],
    bpm: 58,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 0, lenBeats: 1.5 },
      { beat: 1.5, degree: 3, lenBeats: 0.5 },
      { beat: 2, degree: 2, lenBeats: 2 },
      { beat: 4, degree: 0, lenBeats: 1.5 },
      { beat: 6, degree: 1, lenBeats: 2 },
    ],
    padInterval: 7,
    bassWave: 'sawtooth',
    riffDensity: 0.85,
    noteDecay: 0.6,
    padAttack: 1.0,
  },
  // SUMIDOUROS DE SILICA — o chao que cede. Todo gesto do riff DESCE, a cauda
  // e seca e os silencios sao largos: a nota some como a areia.
  silica: {
    rootHz: 73.4,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bpm: 62,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 4, lenBeats: 1 },
      { beat: 1.5, degree: 2, lenBeats: 1 },
      { beat: 3, degree: 0, lenBeats: 1 },
    ],
    padInterval: 12,
    bassWave: 'triangle',
    riffDensity: 0.4,
    noteDecay: 0.25,
    padAttack: 1.5,
  },
  // CRIPTA GLACIAL — inercia. Quase sem baixo (o pad detunado longo e quem
  // fala — Cherry Waves), ataque de tres segundos: nada aqui tem pressa.
  glacial: {
    rootHz: 58.3,
    scale: [0, 2, 3, 5, 7, 8, 10],
    bpm: 50,
    beatsPerBar: 4,
    riffBars: 2,
    riff: [
      { beat: 0, degree: 0, lenBeats: 4 },
      { beat: 5, degree: 2, lenBeats: 3 },
    ],
    padInterval: 7,
    bassWave: 'sine',
    riffDensity: 0.15,
    noteDecay: 1.4,
    padAttack: 3.0,
  },
  // ESTRATO FERRIFERO — a maquina. Pulso metronomico de duas notas, quarta no
  // pad, cauda curta: o veio conduz e a musica anda no trilho.
  ferric: {
    rootHz: 51.9,
    scale: [0, 1, 3, 5, 7, 8, 10],
    bpm: 64,
    beatsPerBar: 4,
    riffBars: 1,
    riff: [
      { beat: 0, degree: 0, lenBeats: 1 },
      { beat: 2, degree: 4, lenBeats: 1 },
    ],
    padInterval: 5,
    bassWave: 'square',
    riffDensity: 0.9,
    noteDecay: 0.3,
    padAttack: 0.5,
  },
};

export const OCCUPATION_VARIATIONS: Record<OccupationId, OccupationVariation> = {
  none: { secondaryDetuneCents: 0 },
  // MATRIZ MICELIAL — organico e levemente errado: a copia do drone deriva 8
  // cents (batimento lento, quase enjoo) e uma terca menor cresce por baixo.
  mycelial: { secondaryDetuneCents: 8, droneAddedInterval: 3 },
  // CICATRIZ AURIX — maquina errada: o pad respira num portao ritmico e a voz
  // de tensao e um tritono baixo, reservado ao fundo da descida.
  aurix: { secondaryDetuneCents: 4, padTremoloHz: 1.1, tensionInterval: 6 },
};

/**
 * Grau da escala -> frequencia. Grau alem do tamanho da escala sobe de oitava
 * (grau -1 desce), entao um riff pode andar duas oitavas sem tabela extra.
 */
export const degreeHz = (theme: MusicTheme, degree: number, octave = 0): number => {
  const n = theme.scale.length;
  const idx = ((degree % n) + n) % n;
  const oct = octave + Math.floor(degree / n);
  const semis = theme.scale[idx] + 12 * oct;
  return theme.rootHz * Math.pow(2, semis / 12);
};

/**
 * Quais camadas a profundidade normalizada (0..1, de strata.normalizedDepth)
 * DESEJA acesas. Desejo, nao ganho: o music-bus faz rampas de 1-2 s na entrada
 * e na saida de cada camada — um limiar seco em 0.69 -> 0.70 nao pode virar um
 * oscilador nascendo de supetao.
 *
 * O drone e incondicional (a musica nunca some de todo enquanto a run corre);
 * o baixo pede um minimo de descida — no primeiro setor o lugar ainda esta se
 * apresentando; o pad chega no meio; a tensao e so do fundo.
 */
export const layersForIntensity = (intensity: number): MusicLayers => ({
  drone: true,
  bass: intensity >= 0.15,
  pad: intensity >= 0.35,
  tension: intensity >= 0.7,
});

/** Duracao de um compasso, em segundos. */
export const barDurationSec = (theme: MusicTheme): number => (60 / theme.bpm) * theme.beatsPerBar;

/**
 * O compasso em que o tick da simulacao esta. ESTA e a ponte relogio-da-sim ->
 * musica: dois clientes no mesmo tick estao no mesmo compasso por definicao,
 * nao importa quando cada um deu unlock no audio.
 */
export const barIndexForTick = (tick: number, theme: MusicTheme): number =>
  Math.floor(tick / TICK_HZ / barDurationSec(theme));

/**
 * Hash inteiro -> [0,1). Substituto deterministico do Math.random(): a mesma
 * (compasso, indice) da o mesmo numero em toda maquina, entao a rarefacao do
 * riff e identica em co-op e reproducivel em teste.
 */
const noteHash = (barIndex: number, i: number): number => {
  let h = (Math.imul(barIndex, 73856093) ^ Math.imul(i + 1, 19349663)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
};

/**
 * As notas de baixo do compasso `barIndex`. Pura: (tema, compasso, camadas) e
 * nada mais — e e assim que o co-op fica sincronizado de graca.
 *
 * A rarefacao por riffDensity le o hash por nota: compasso impar aperta a
 * densidade (0.7x) para o riff respirar em vez de martelar. A primeira nota do
 * ciclo do riff (beat 0 do compasso par) sempre toca quando a camada esta
 * acesa — um riff que pode passar compassos inteiros calado deixa de ser
 * fundacao e vira acaso.
 */
export const notesForBar = (
  theme: MusicTheme,
  barIndex: number,
  layers: MusicLayers,
): ScheduledNote[] => {
  if (!layers.bass) return [];
  const phase = ((barIndex % theme.riffBars) + theme.riffBars) % theme.riffBars;
  const barStartBeat = phase * theme.beatsPerBar;
  const barEndBeat = barStartBeat + theme.beatsPerBar;
  const cycleIndex = Math.floor(barIndex / theme.riffBars);
  const density = barIndex % 2 === 0 ? theme.riffDensity : theme.riffDensity * 0.7;

  const notes: ScheduledNote[] = [];
  for (let i = 0; i < theme.riff.length; i++) {
    const note = theme.riff[i];
    if (note.beat < barStartBeat || note.beat >= barEndBeat) continue;
    const anchor = note.beat === 0 && phase === 0;
    if (!anchor && noteHash(cycleIndex, i) >= density) continue;
    notes.push({
      beat: note.beat - barStartBeat,
      hz: degreeHz(theme, note.degree, (note.octave ?? 0) + 1),
      lenBeats: note.lenBeats,
    });
  }
  return notes;
};
