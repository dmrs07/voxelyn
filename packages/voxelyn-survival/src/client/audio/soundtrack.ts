// A trilha COMPOSTA: contrato e aritmetica, zero WebAudio.
//
// Este arquivo e o espelho de music.ts para a trilha de autor: constantes e
// funcoes puras, testaveis em Node. Quem transforma isto em som e o
// soundtrack-bus.
//
// O que mudou em relacao a musica procedural: em vez de oito temas
// sintetizados por estrato, UMA trilha composta (arquivo de audio) toca em
// loop em todos os estratos. Os temas procedurais NAO foram removidos —
// continuam integros em music.ts/music-bus.ts como backup: sao o fallback
// automatico quando o arquivo nao carrega/decodifica, e uma escolha explicita
// do jogador nas opcoes ("trilha sintetizada").
//
// O contrato de mixagem da trilha composta vem do proprio compositor e o bus
// tem a obrigacao de preserva-lo:
//
// 1) SEM PERDA. O asset e FLAC (lossless); o browser decodifica para PCM.
//    Nenhum transcode com perda em nenhum ponto da cadeia.
// 2) IMAGEM ESTEREO INTACTA. A trilha foi mixada com o centro do estereo
//    (~40% interno do campo) deixado livre para os sons do jogo: a musica
//    acontece nas LATERAIS. Duas camadas de graves coexistem por design.
//    Portanto: nada de soma para mono, nada de panner, nada de filtro ou
//    alargador de estereo no caminho da trilha. Fonte -> trim -> duck -> bus
//    -> master, e so.
// 3) SFX > MUSICA, sempre. O mesmo teto (MUSIC_CEILING) e o mesmo ducking da
//    musica procedural valem aqui: a trilha e chao, nunca disputa o canal de
//    informacao com telegrafo.
// 4) LOOP SEM EMENDA. AudioBufferSourceNode com loop=true e gapless com
//    precisao de amostra; um HTMLAudioElement em loop tem respiro audivel na
//    volta e por isso NAO e usado.

import type { EnemyArchetype } from '@voxelyn/survival-sim';
import { MUSIC_CEILING } from './music';

/**
 * Caminho do asset, relativo a base do app (vite `base: './'`). FLAC por ser
 * o unico container lossless com decode nativo amplo nos browsers atuais;
 * WAV dobraria o peso do precache pelo mesmo PCM.
 */
export const SOUNDTRACK_URL = 'audio/voxelyn-survival-theme.flac';

/**
 * Ajuste de ganho da trilha composta DENTRO do teto da musica, aplicado antes
 * do bus (efetivo = MUSIC_CEILING * COMPOSED_TRIM * slider; sob um telegrafo,
 * MUSIC_DUCK_FACTOR entra por cima disso).
 *
 * Por que existe: os temas procedurais nascem calibrados contra os SFX (LAYER_GAINS
 * soma ~1 sobre osciladores puros); um master de estudio chega proximo de
 * 0 dBFS de pico e, no mesmo teto, soaria acima do leito que a mixagem
 * promete. `scripts/prepare-soundtrack.mjs` mede o LUFS integrado do arquivo
 * e imprime o valor calibrado para colar aqui junto do asset.
 *
 * Calibrado para "TEMA DE EXPLORACAO 3.0" (Clevo): -17.1 LUFS integrado,
 * true peak +0.1 dBTP -> 1.74 poe o leito em -21 LUFS no jogo com o slider
 * no maximo. Trocou o master, rode o script de novo.
 *
 * O valor nao mudou quando o teto subiu 9 dB: o trim normaliza as DUAS faixas
 * entre si, e quem fixa o nivel absoluto e MUSIC_CEILING. A calibragem do
 * compositor continua exatamente onde ele a deixou.
 */
export const COMPOSED_TRIM = 1.74;

/** Faixa sana do trim: fora disto o erro esta no master, nao no jogo. */
export const COMPOSED_TRIM_MIN = 0.25;
export const COMPOSED_TRIM_MAX = 2.0;

/** Rampas de entrada/saida da trilha composta, em constantes de tempo (s). */
export const COMPOSED_FADE_UP_TAU = 1.0; // nasce em ~3 s, como a procedural
export const COMPOSED_FADE_DOWN_TAU = 0.25; // cala rapido para o sting falar

/**
 * Preferencia do jogador. 'composed' = trilha do compositor (padrao);
 * 'synth' = os oito temas procedurais por estrato (o backup, por escolha).
 */
export type MusicSource = 'composed' | 'synth';

export const MUSIC_SOURCES: readonly MusicSource[] = ['composed', 'synth'];

export const isMusicSource = (v: unknown): v is MusicSource => v === 'composed' || v === 'synth';

/**
 * A fonte que deve SOAR agora, dada a preferencia e a disponibilidade do
 * arquivo. A regra inteira do fallback mora aqui, num lugar testavel:
 * preferencia 'composed' sem arquivo pronto (ainda carregando, 404, decode
 * falhou) toca o backup procedural — o jogo nunca desce mudo.
 */
export const resolveMusicSource = (preference: MusicSource, composedReady: boolean): MusicSource =>
  preference === 'composed' && composedReady ? 'composed' : 'synth';

const trackBaseGain = (trim: number, musicVolume: number): number => {
  const vol = Math.max(0, Math.min(1, musicVolume));
  const t = Math.max(COMPOSED_TRIM_MIN, Math.min(COMPOSED_TRIM_MAX, trim));
  return MUSIC_CEILING * t * vol;
};

/** Ganho base da trilha composta sob o slider (contrato do teto preservado). */
export const composedBaseGain = (musicVolume: number): number =>
  trackBaseGain(COMPOSED_TRIM, musicVolume);

// ---------------------------------------------------------------------------
// Trilha de abertura (menu)
// ---------------------------------------------------------------------------

/**
 * Segundo slot do pipeline: a trilha da tela de titulo. Mesmo contrato da
 * trilha da run (FLAC lossless, imagem estereo intacta, loop gapless, teto da
 * musica), com uma diferenca de ciclo de vida: toca enquanto o jogador esta
 * no terminal (menu e overlays de opcoes/ranking), cala sob o veu quando a
 * descida comeca. Sem o arquivo, o menu fica em silencio — que e o
 * comportamento historico, nunca um erro.
 *
 * A preferencia composta/sintetizada NAO se aplica aqui: o backup procedural
 * so existe para a run (oito temas por estrato); o menu nunca teve tema
 * sintetizado para voltar.
 */
export const MENU_SOUNDTRACK_URL = 'audio/voxelyn-survival-menu.flac';

/**
 * Trim da trilha de menu, mesmo papel do COMPOSED_TRIM.
 *
 * Calibrado para o tema de abertura (Clevo): -15,0 LUFS integrado, true peak
 * +0,2 dBTP -> 1.37 poe o leito em -21 LUFS com o slider no maximo. Trocou o
 * master, rode `prepare-soundtrack.mjs --slot menu` de novo.
 */
export const MENU_TRIM = 1.37;

/** Ganho base da trilha de menu sob o slider. */
export const menuBaseGain = (musicVolume: number): number => trackBaseGain(MENU_TRIM, musicVolume);

// ---------------------------------------------------------------------------
// Trilha de ENCONTRO (o Diamandis)
// ---------------------------------------------------------------------------

/**
 * Terceiro slot do pipeline: a trilha do encontro com o Diamandis. Toca em
 * loop enquanto o dono do setor e o Diamandis, ele ja notou o jogador e esta
 * de pe; a trilha da run (composta ou procedural) cala enquanto isso e volta
 * quando ele cai — o sting do desligamento soa sobre o silencio dela, como o
 * `died` soa sobre o silencio da run.
 *
 * O ASSET E LOSSY, e isso e deliberado e documentado, nao um descuido: o
 * master chegou como mp3 a 320 kbps (nao existe WAV/FLAC dele). Reempacotar
 * em FLAC nao devolveria o que o encoder descartou e multiplicaria o precache
 * por dez para nada. `decodeAudioData` entrega o PCM do mp3 do mesmo jeito;
 * o resto do contrato (imagem intacta, teto, ducking, loop gapless) vale
 * igual. Se um master lossless aparecer, `prepare-soundtrack.mjs --slot
 * diamandis` o empacota em FLAC e o teste da extensao passa a cobrar `.flac`.
 */
export const BOSS_SOUNDTRACK_URL = 'audio/voxelyn-survival-diamandis.mp3';

/**
 * Trim da trilha do Diamandis, mesmo papel do COMPOSED_TRIM.
 *
 * Calibrado para o master recebido em 2026-09-02: -5,95 LUFS integrado (um
 * master MUITO quente, true peak 0,0 dBTP, brickwall), 85,6 s, estereo com o
 * lado 13 dB abaixo do centro -> 0.48 poe o leito em -21 LUFS com o slider
 * no maximo. Trocou o master, rode o script de novo.
 */
export const BOSS_TRIM = 0.48;

/** Ganho base da trilha de encontro sob o slider. */
export const bossBaseGain = (musicVolume: number): number => trackBaseGain(BOSS_TRIM, musicVolume);

/**
 * Os chefes que TEM trilha propria. Uma tabela, e nao um `=== 'diamandis'`
 * espalhado: o proximo chefe com musica entra aqui e em mais lugar nenhum.
 */
export const BOSS_SOUNDTRACKS: Partial<Record<EnemyArchetype, string>> = {
  diamandis: BOSS_SOUNDTRACK_URL,
};

/**
 * A trilha de encontro deve SOAR agora? Pura e testavel: o dono do setor tem
 * trilha, ja acordou, esta de pe, e o arquivo decodificou. Sem o arquivo a
 * trilha da run continua — o encontro nunca desce mudo por causa de um 404.
 */
export const bossTrackPlaying = (
  archetype: EnemyArchetype | null,
  awake: boolean,
  alive: boolean,
  ready: boolean,
): boolean =>
  archetype !== null && BOSS_SOUNDTRACKS[archetype] !== undefined && awake && alive && ready;
