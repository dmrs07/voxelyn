// Prepara a trilha composta para o jogo, com criterio de engenharia de som.
//
// O que ele faz:
//   1. ANALISA o arquivo do compositor sem tocar no audio: formato, LUFS
//      integrado, true peak, imagem estereo (energia mid/side, largura em
//      banda cheia e abaixo de 120 Hz — as duas camadas de graves), bordas do
//      loop (amostras nao-zero na emenda = clique na volta).
//   2. EMPACOTA sem perda: PCM -> FLAC (compression_level 8). FLAC e
//      compressao SEM PERDA — o PCM decodificado no browser e identico ao do
//      arquivo original. Se a entrada ja for lossy (mp3/aac/ogg), o script
//      avisa em voz alta: FLAC nao devolve o que o encoder lossy jogou fora,
//      e o certo e pedir o master em WAV/FLAC ao compositor.
//   3. CALIBRA o trim: mede o LUFS do arquivo e imprime o COMPOSED_TRIM que
//      poe a trilha no leito da mixagem (SFX > musica, ver
//      src/client/audio/soundtrack.ts) para colar no codigo.
//
// O que ele NUNCA faz por conta propria: normalizar, comprimir, equalizar,
// alargar estereo ou cortar silencio. O master e do compositor; o jogo ajusta
// GANHO (trim) e nada mais. `--trim-silence` existe como opt-in para remover
// silencio DIGITAL (abaixo de -80 dBFS) nas bordas quando o proprio
// compositor pedir uma emenda de loop justa.
//
// Uso:
//   node scripts/prepare-soundtrack.mjs <entrada> [--out <caminho>] [--trim-silence]
//
// Precisa de ffmpeg/ffprobe no PATH (ou FFMPEG/FFPROBE no ambiente).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Espelhos de src/client/audio/soundtrack.ts e music.ts. Duplicados aqui
// porque este script roda em Node puro, sem transpilar TS; se mudar la, mude
// aqui (o teste de contrato do trim pega divergencia grosseira).
const MUSIC_CEILING = 0.13;
const TRIM_MIN = 0.25;
const TRIM_MAX = 2.0;

/**
 * Alvo do leito musical DENTRO do jogo, em LUFS, com o slider no maximo.
 *
 * De onde vem: o leito procedural (drone+baixo+pad sob o teto de 0.13) senta
 * por volta de -30 LUFS, e o contrato da mixagem e a musica ser chao sob os
 * SFX. -30 mantem a trilha composta no mesmo degrau percebido que o backup.
 */
const TARGET_INGAME_LUFS = -30;

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

const die = (msg) => {
  console.error(`erro: ${msg}`);
  process.exit(1);
};

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) die(`${cmd} indisponivel (${r.error.message}). Instale ffmpeg.`);
  return r;
};

const dB = (linear) => 20 * Math.log10(linear);

// --- argumentos --------------------------------------------------------------

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) die('uso: node scripts/prepare-soundtrack.mjs <entrada> [--out <caminho>] [--trim-silence]');
if (!existsSync(input)) die(`entrada nao existe: ${input}`);
const outFlag = argv.indexOf('--out');
const output =
  outFlag >= 0
    ? resolve(argv[outFlag + 1])
    : resolve(__dirname, '../public/audio/voxelyn-survival-theme.flac');
const trimSilence = argv.includes('--trim-silence');

// --- 1. o que o arquivo E ----------------------------------------------------

const probe = run(FFPROBE, [
  '-v', 'error',
  '-select_streams', 'a:0',
  '-show_entries', 'stream=codec_name,sample_rate,channels,bits_per_raw_sample,duration',
  '-of', 'json',
  input,
]);
const stream = JSON.parse(probe.stdout || '{}').streams?.[0];
if (!stream) die('nenhum stream de audio encontrado na entrada');

const LOSSLESS = new Set(['flac', 'alac', 'wav', 'pcm_s16le', 'pcm_s24le', 'pcm_s32le', 'pcm_f32le', 'aiff']);
const isLossless = [...LOSSLESS].some((c) => (stream.codec_name ?? '').startsWith(c.split('_')[0]) || stream.codec_name === c);
const durationSec = Number(stream.duration ?? 0);

console.log('== arquivo do compositor ==');
console.log(`codec: ${stream.codec_name}  sample rate: ${stream.sample_rate} Hz  canais: ${stream.channels}`);
console.log(`duracao: ${durationSec.toFixed(2)} s`);
if (stream.channels !== 2) {
  console.warn('AVISO: a trilha nao e estereo — o contrato do compositor (laterais ocupadas, centro livre) pressupoe 2 canais.');
}
if (!isLossless) {
  console.warn('');
  console.warn('AVISO IMPORTANTE: a entrada e LOSSY. O FLAC gerado preserva o que');
  console.warn('chegou, mas o que o encoder lossy descartou nao volta. Para "sem');
  console.warn('perda" de verdade, peca ao compositor o master em WAV ou FLAC.');
  console.warn('');
}

// --- 2. loudness e picos -----------------------------------------------------

// ebur128 imprime o resumo no stderr; e a medida certa para "quao alto soa",
// que e o que o trim precisa (pico nao diz nada sobre percepcao).
const loud = run(FFMPEG, ['-hide_banner', '-nostats', '-i', input, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
const loudText = loud.stderr;
// O ebur128 loga o I: PROGRESSIVO a cada 100 ms e so o ultimo bloco (Summary)
// tem o valor integrado da faixa inteira: pegar a PRIMEIRA ocorrencia leria o
// fade-in do comeco. Sempre a ultima.
const lastMatch = (re) => {
  const all = [...loudText.matchAll(re)];
  return all.length ? Number(all[all.length - 1][1]) : NaN;
};
const inputLufs = lastMatch(/I:\s*(-?[\d.]+)\s*LUFS/g);
const truePeak = lastMatch(/Peak:\s*(-?[\d.]+)\s*dBFS/g);

console.log('== loudness ==');
console.log(`LUFS integrado: ${Number.isNaN(inputLufs) ? 'nao medido' : inputLufs.toFixed(1)}`);
console.log(`true peak: ${Number.isNaN(truePeak) ? 'nao medido' : truePeak.toFixed(1)} dBTP`);
if (!Number.isNaN(truePeak) && truePeak > -0.3) {
  console.warn('AVISO: true peak acima de -0.3 dBTP — risco de clip intersample no decode. Vale pedir ao compositor 0.5-1 dB de teto no master.');
}

// --- 3. imagem estereo (o contrato das laterais) ----------------------------

/** RMS (dBFS) de uma derivacao mono da mixagem, via pan + astats. */
const rmsOf = (panExpr, extra = '') => {
  const af = `pan=1c|c0=${panExpr}${extra},astats=metadata=1:measure_overall=RMS_level:measure_perchannel=none`;
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', input, '-af', af, '-f', 'null', '-']);
  const m = r.stderr.match(/RMS level dB:\s*(-?[\d.]+|-inf)/);
  return m ? (m[1] === '-inf' ? -120 : Number(m[1])) : NaN;
};

if (stream.channels === 2) {
  const midRms = rmsOf('0.5*c0+0.5*c1');
  const sideRms = rmsOf('0.5*c0+-0.5*c1');
  const midLowRms = rmsOf('0.5*c0+0.5*c1', ',lowpass=f=120');
  const sideLowRms = rmsOf('0.5*c0+-0.5*c1', ',lowpass=f=120');

  console.log('== imagem estereo ==');
  console.log(`mid: ${midRms.toFixed(1)} dBFS  side: ${sideRms.toFixed(1)} dBFS  (side-mid: ${(sideRms - midRms).toFixed(1)} dB)`);
  console.log(`graves <120 Hz — mid: ${midLowRms.toFixed(1)} dBFS  side: ${sideLowRms.toFixed(1)} dBFS`);
  // O compositor mixou a musica nas LATERAIS com o centro livre para os SFX:
  // side proximo ou acima do mid e o esperado. Um side 10+ dB ABAIXO do mid
  // significaria uma trilha quase mono — que brigaria com os SFX no centro.
  if (sideRms - midRms < -10) {
    console.warn('AVISO: energia lateral muito abaixo do centro — a trilha esta quase mono e vai disputar o centro com os SFX. Conversar com o compositor.');
  }
  // Grave em anti-fase pura (side >> mid abaixo de 120 Hz) some em mono
  // (celular com um alto-falante). As DUAS camadas de graves coexistirem em
  // qualquer caixa e promessa do compositor; este numero e o cheque.
  if (sideLowRms - midLowRms > 3) {
    console.warn('AVISO: graves dominados pelo canal side — em playback mono (celular deitado) as camadas de grave podem sumir. Checar com o compositor.');
  }
}

// --- 4. bordas do loop -------------------------------------------------------

// O loop e buffer inteiro (AudioBufferSourceNode loop=true): a ultima amostra
// emenda na primeira. Pico alto nos primeiros/ultimos 10 ms = degrau na volta.
const edgePeak = (trimExpr) => {
  const af = `${trimExpr},astats=metadata=1:measure_overall=Peak_level:measure_perchannel=none`;
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', input, '-af', af, '-f', 'null', '-']);
  const m = r.stderr.match(/Peak level dB:\s*(-?[\d.]+|-inf)/);
  return m ? (m[1] === '-inf' ? -120 : Number(m[1])) : NaN;
};
const headPeak = edgePeak('atrim=end=0.01');
const tailPeak = edgePeak(`atrim=start=${Math.max(0, durationSec - 0.01)}`);
console.log('== emenda do loop ==');
console.log(`pico nos 10 ms iniciais: ${headPeak.toFixed(1)} dBFS  finais: ${tailPeak.toFixed(1)} dBFS`);
if (headPeak > -40 || tailPeak > -40) {
  console.warn('AVISO: as bordas nao chegam perto do silencio — a volta do loop pode estalar. Se a emenda foi desenhada assim (frase que continua), ignore; senao, pedir bordas em zero-crossing ao compositor.');
}

// --- 5. empacotar FLAC (sem perda) ------------------------------------------

mkdirSync(dirname(output), { recursive: true });
const encodeArgs = ['-hide_banner', '-y', '-i', input, '-map_metadata', '-1', '-vn'];
if (trimSilence) {
  // Opt-in: so silencio DIGITAL nas bordas (abaixo de -80 dBFS), nada dentro.
  encodeArgs.push(
    '-af',
    'silenceremove=start_periods=1:start_threshold=-80dB,areverse,silenceremove=start_periods=1:start_threshold=-80dB,areverse',
  );
}
encodeArgs.push('-c:a', 'flac', '-compression_level', '8', output);
const enc = run(FFMPEG, encodeArgs);
if (enc.status !== 0) die(`ffmpeg falhou ao encodar:\n${enc.stderr.slice(-2000)}`);
const outSize = statSync(output).size;
console.log('== saida ==');
console.log(`${output} (${(outSize / 1024 / 1024).toFixed(1)} MB, FLAC lossless)`);

// --- 6. calibrar o trim ------------------------------------------------------

if (!Number.isNaN(inputLufs)) {
  // No jogo: LUFS efetivo = LUFS do arquivo + dB(MUSIC_CEILING * trim).
  const trimDb = TARGET_INGAME_LUFS - inputLufs - dB(MUSIC_CEILING);
  const trim = Math.pow(10, trimDb / 20);
  const clamped = Math.max(TRIM_MIN, Math.min(TRIM_MAX, trim));
  console.log('== calibracao do trim ==');
  console.log(`alvo no jogo: ${TARGET_INGAME_LUFS} LUFS  ->  COMPOSED_TRIM = ${clamped.toFixed(2)}`);
  if (clamped !== trim) {
    console.warn(`(valor bruto ${trim.toFixed(2)} saturado na faixa [${TRIM_MIN}, ${TRIM_MAX}] — se saturou, o master esta muito longe do leito e vale conversar com o compositor em vez de forcar ganho)`);
  }
  console.log('Cole em src/client/audio/soundtrack.ts: export const COMPOSED_TRIM = ' + clamped.toFixed(2) + ';');
}
