#!/usr/bin/env node
// Renderiza o kit completo do logo sonoro da DaniTools.
//
//   node scripts/audio-logo/render.mjs [--out docs/audio/danitools] [--no-encode] [--no-stems]
//   node scripts/audio-logo/render.mjs --verify   # confere os mestres contra o manifesto
//
// Escreve os WAV mestres (48 kHz / 24 bits), as versoes comprimidas (se houver
// ffmpeg no PATH), a forma de onda em SVG e o manifesto com todas as medicoes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { encodeWav, readWav, SR, writeWav } from './dsp.mjs';
import { bandEnergy, measureLoudness, samplePeakDb, stereoCorrelation, truePeakDb, voiceMargin } from './loudness.mjs';
import { arrange, ARP, BELLS, BPM, CHORD, master, TIMELINE } from './arrangement.mjs';
import { hz } from './synth.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const round3 = (v) => Math.round(v * 1000) / 1000;
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

const TAKES = {
  'en-us': {
    file: join(HERE, 'takes/danitools-en-us.wav'),
    command: 'espeak-ng -v en-us -s 130 -p 42 -a 200 -w danitools-en-us.wav "DaniTools"',
    phonemes: "d'ani t'u:lz",
  },
  'pt-br': {
    file: join(HERE, 'takes/danitools-pt-br.wav'),
    command: 'espeak-ng -v pt-br -s 130 -p 42 -a 200 -w danitools-pt-br.wav "Dâni Túls"',
    phonemes: "d'&~ni t'uls",
  },
};

const DELIVERABLES = [
  { id: 'danitools-sound-logo', variant: 'full', take: 'en-us', lufs: -14, uso: 'A assinatura. Abertura e encerramento de video, trailer, vitrine de loja.' },
  { id: 'danitools-sound-logo-short', variant: 'short', take: 'en-us', lufs: -14, uso: 'Bumper. Splash de app, vinheta de live, transicao curta.' },
  { id: 'danitools-sound-logo-tag', variant: 'tag', take: 'en-us', lufs: -16, uso: 'So a locucao com a cauda, sem musica. Para deitar sobre trilha que ja existe.' },
  { id: 'danitools-sound-logo-ptbr', variant: 'full', take: 'pt-br', lufs: -14, uso: 'Mesma assinatura com a pronuncia aportuguesada, para peca em pt-BR.' },
];

// -fflags +bitexact nao e enfeite: sem ele o multiplexador Ogg sorteia o numero de
// serie do fluxo a cada execucao (48 bytes divergentes num arquivo de 80 kB), e
// re-renderizar o kit sujava o repositorio sem nenhuma mudanca de audio.
const BITEXACT = ['-fflags', '+bitexact'];
const ENCODERS = {
  mp3: { label: 'MP3 320 kbps CBR', args: ['-codec:a', 'libmp3lame', '-b:a', '320k', ...BITEXACT] },
  ogg: { label: 'Ogg Vorbis q7 (~224 kbps VBR)', args: ['-codec:a', 'libvorbis', '-qscale:a', '7', ...BITEXACT] },
};
const FLAC_ARGS = ['-codec:a', 'flac', '-compression_level', '8', ...BITEXACT];

// ---------------------------------------------------------------------------

function findFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; }
  catch { return null; }
}

/** Envelope min/max por coluna: a prova visual de que a estrutura e a que o texto diz. */
function waveformSvg(wavPath, events) {
  const { channels } = readWav(wavPath);
  const n = channels[0].length;
  const W = 1440, H = 310, PAD = 42;
  const inner = W - PAD * 2, mid = H / 2 + 8, amp = (H - PAD * 2) / 2;
  const per = n / inner;
  const top = [], bot = [];
  for (let x = 0; x < inner; x++) {
    let lo = 0, hi = 0;
    const s = Math.floor(x * per), e = Math.min(n, Math.floor((x + 1) * per));
    for (let i = s; i < e; i++) {
      const v = (channels[0][i] + channels[1][i]) / 2;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    top.push(`${PAD + x},${(mid - hi * amp).toFixed(1)}`);
    bot.push(`${PAD + x},${(mid - lo * amp).toFixed(1)}`);
  }
  const dur = n / SR;
  // Eventos proximos colidiriam num rotulo so: cada um vai para a faixa que
  // estiver livre ha mais tempo, e a largura do texto e estimada em 6,2 px/char.
  const ROWS = 3;
  const freeAt = new Array(ROWS).fill(-Infinity);
  const marks = events.map((ev) => {
    const x = PAD + (ev.atSec / dur) * inner;
    const label = `${ev.name} · ${ev.atSec}s`;
    let row = 0;
    for (let r = 1; r < ROWS; r++) if (freeAt[r] < freeAt[row]) row = r;
    if (freeAt[row] > x) row = freeAt.indexOf(Math.min(...freeAt));
    freeAt[row] = x + label.length * 6.2 + 10;
    const y = PAD - 16 + row * 12;
    return `<line x1="${x.toFixed(1)}" y1="${(y + 3).toFixed(1)}" x2="${x.toFixed(1)}" y2="${H - PAD + 8}" stroke="#f472b6" stroke-width="1" stroke-dasharray="3 4" opacity="0.7"/>`
      + `<text x="${(x + 4).toFixed(1)}" y="${y}" fill="#f9a8d4" font-family="ui-monospace,monospace" font-size="11">${label}</text>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Forma de onda do logo sonoro da DaniTools, com cada evento do arranjo marcado no tempo">
  <defs>
    <linearGradient id="marca" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7c3aed"/><stop offset="0.55" stop-color="#a855f7"/><stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0b0710"/>
  <line x1="${PAD}" y1="${mid}" x2="${W - PAD}" y2="${mid}" stroke="#3b2a4d" stroke-width="1"/>
  <polygon points="${top.join(' ')} ${bot.reverse().join(' ')}" fill="url(#marca)"/>
  ${marks}
  <text x="${PAD}" y="${H - 9}" fill="#8b7a9e" font-family="ui-monospace,monospace" font-size="11">DANITOOLS — logo sonoro · ${dur.toFixed(2)} s · 48 kHz · soma L+R</text>
</svg>
`;
}

/**
 * Confere os mestres WAV contra os hashes do manifesto versionado, sem escrever nada.
 *
 * Existe porque "e reprodutivel" e uma promessa em prosa ate alguem conseguir
 * conferir. Repare no escopo: so os WAV, que saem deste codigo. Os MP3/OGG/FLAC
 * passam pelo ffmpeg e podem mudar entre builds do encoder — os hashes deles ficam
 * no manifesto como integridade, nao como garantia de reproducao.
 */
function runVerify(outDir) {
  const manifestPath = join(outDir, 'sound-logo-manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    console.error(`sem manifesto em ${manifestPath} — rode o render antes.`);
    process.exitCode = 1;
    return;
  }

  let falhas = 0;
  for (const d of DELIVERABLES) {
    const esperado = manifest.entregas
      .find((e) => e.id === d.id)?.arquivos
      .find((f) => f.nome === `${d.id}.wav`)?.sha256;

    const arr = arrange(TAKES[d.take].file, { variant: d.variant, sr: SR });
    const m = master(arr.L, arr.R, {
      targetLufs: d.lufs, ceilingDb: -1.0, measure: (ch) => measureLoudness(ch, SR), sr: SR,
    });
    const obtido = sha256(encodeWav([m.L, m.R], SR, 24));
    const ok = esperado === obtido;
    if (!ok) falhas++;
    console.log(`${ok ? 'ok  ' : 'FALHA'} ${d.id.padEnd(30)} ${obtido.slice(0, 16)}${ok ? '' : `  esperado ${String(esperado).slice(0, 16)}`}`);
  }

  console.log(`\n${DELIVERABLES.length - falhas}/${DELIVERABLES.length} mestres conferem.`);
  if (falhas) {
    console.error(
      'Divergencia. Antes de suspeitar do codigo: a sintese usa Math.sin/cos/exp/tanh e **, '
      + 'que a especificacao do ECMAScript deixa a cargo da implementacao. Uma build de V8 '
      + 'diferente pode render o ultimo bit de forma diferente. Confira a versao do Node '
      + `(esta rodando ${process.version}) antes de regerar os arquivos.`,
    );
    process.exitCode = 1;
  }
}

function main() {
  const args = process.argv.slice(2);
  const flag = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
  const outDir = resolve(ROOT, flag('--out') ?? 'docs/audio/danitools');
  const verify = args.includes('--verify');
  const ffmpeg = verify || args.includes('--no-encode') ? null : findFfmpeg();
  const wantStems = !verify && !args.includes('--no-stems');

  if (verify) return runVerify(outDir);

  mkdirSync(outDir, { recursive: true });
  if (wantStems) mkdirSync(join(outDir, 'stems'), { recursive: true });
  const rendered = [];

  for (const d of DELIVERABLES) {
    const take = TAKES[d.take];
    const arr = arrange(take.file, { variant: d.variant, sr: SR });
    const m = master(arr.L, arr.R, {
      targetLufs: d.lufs,
      ceilingDb: -1.0,
      measure: (ch) => measureLoudness(ch, SR),
      sr: SR,
    });

    const wavName = `${d.id}.wav`;
    const wavPath = join(outDir, wavName);
    const wavBytes = encodeWav([m.L, m.R], SR, 24);
    writeFileSync(wavPath, wavBytes);

    const channels = [m.L, m.R];
    const loud = measureLoudness(channels, SR);
    const files = [{ nome: wavName, formato: 'WAV PCM 48 kHz / 24 bits / estereo', bytes: wavBytes.length, sha256: sha256(wavBytes) }];

    // Stems: so para a assinatura — e a peca que um editor vai querer reequilibrar.
    // Em FLAC porque sao seis arquivos e o formato e sem perda; o mestre continua WAV.
    if (wantStems && d.variant === 'full' && d.take === 'en-us') {
      for (const [name, [sL, sR]] of Object.entries(arr.stems)) {
        const wav = join(outDir, 'stems', `${d.id}-${name}.wav`);
        writeWav(wav, [sL, sR], SR, 24);
        if (ffmpeg) {
          const flac = join(outDir, 'stems', `${d.id}-${name}.flac`);
          execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, ...FLAC_ARGS, flac]);
          rmSync(wav);
          files.push({ nome: `stems/${d.id}-${name}.flac`, formato: 'FLAC 48 kHz / 24 bits / estereo (stem, antes da masterizacao)', bytes: statSync(flac).size, sha256: sha256(readFileSync(flac)) });
        } else {
          files.push({ nome: `stems/${d.id}-${name}.wav`, formato: 'WAV PCM 48 kHz / 24 bits / estereo (stem, antes da masterizacao)', bytes: statSync(wav).size, sha256: sha256(readFileSync(wav)) });
        }
      }
    }

    if (ffmpeg) {
      for (const [ext, enc] of Object.entries(ENCODERS)) {
        const name = `${d.id}.${ext}`;
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wavPath, ...enc.args, join(outDir, name)]);
        files.push({
          nome: name,
          formato: enc.label,
          bytes: statSync(join(outDir, name)).size,
          sha256: sha256(readFileSync(join(outDir, name))),
          comando: `ffmpeg -i ${wavName} ${enc.args.join(' ')} ${name}`,
        });
      }
    }

    rendered.push({
      id: d.id,
      uso: d.uso,
      variante: d.variant,
      tomada: d.take,
      duracaoSec: round3(m.L.length / SR),
      medicao: {
        loudnessIntegradaLufs: loud.integratedLufs,
        loudnessMomentaneaMaximaLufs: loud.momentaryMaxLufs,
        loudnessCurtoPrazoMaximaLufs: loud.shortTermMaxLufs,
        janelasCurtoPrazo: loud.shortTermWindows,
        alvoLufs: d.lufs,
        picoDeAmostraDbfs: samplePeakDb(channels),
        picoInterAmostraEstimadoDbtp: truePeakDb(channels),
        correlacaoEstereo: stereoCorrelation(channels),
        energiaPorBanda: bandEnergy(channels, SR),
        ganhoAplicadoNoMasterDb: m.appliedGainDb,
        reducaoMaximaDoLimitadorDb: m.maxGainReductionDb,
      },
      margemDaVoz: voiceMargin(arr.stems, {
        voiceStart: arr.events.find((e) => e.name === 'voz').atSec,
        voiceEnd: arr.events.find((e) => e.name === 'voz').atSec + arr.voiceLengthSec,
        sr: SR,
      }),
      duckingDb: arr.duckDepthDb,
      eventos: arr.events,
      arquivos: files,
    });

    console.log(
      `${d.id.padEnd(30)} ${String(round3(m.L.length / SR)).padStart(5)}s  `
      + `${String(loud.integratedLufs).padStart(6)} LUFS  `
      + `pico ${String(truePeakDb(channels)[0]).padStart(5)} dBTP  `
      + `corr ${String(stereoCorrelation(channels)).padStart(5)}`,
    );
  }

  writeFileSync(
    join(outDir, 'danitools-sound-logo-waveform.svg'),
    waveformSvg(join(outDir, 'danitools-sound-logo.wav'), rendered[0].eventos),
  );

  const manifest = {
    nome: 'DaniTools — logo sonoro',
    descricao: 'Assinatura sonora do estudio DaniTools. Sintetizada por inteiro: nenhum sample, nenhuma biblioteca de audio, nenhum plugin.',
    geradoPor: 'scripts/audio-logo/render.mjs',
    reprodutibilidade: {
      garantia: 'Os quatro mestres WAV saem byte a byte iguais a cada execucao NA MESMA build do Node/V8. Todo ruido vem de um PRNG semeado (mulberry32) e nao ha estado global nem relogio no caminho.',
      ressalva: 'A garantia nao atravessa versoes de motor. A sintese usa Math.sin, Math.cos, Math.exp, Math.tanh e o operador **, que a especificacao do ECMAScript deixa a cargo da implementacao (ECMA-262, sec. 21.3): uma build de V8 diferente pode divergir no ultimo bit, o que aparece como um punhado de bytes diferentes num WAV de 24 bits. Reproducao exata entre maquinas exige a mesma versao do Node.',
      comprovacao: 'node scripts/audio-logo/render.mjs --verify confere os mestres contra os hashes abaixo sem escrever nada. O teste audio-logo.test.mjs roda a mesma checagem.',
      escopo: 'A garantia forte e dos WAV, que saem deste codigo. MP3, OGG e FLAC saem do ffmpeg com -fflags +bitexact, o que os torna estaveis entre execucoes na mesma build do encoder — sem essa flag o multiplexador Ogg sorteia o numero de serie do fluxo a cada execucao e re-renderizar sujava o repositorio sem nenhuma mudanca de audio. Entre builds diferentes de ffmpeg os bytes ainda podem mudar; os hashes desses tres formatos valem como integridade, nao como garantia de reproducao.',
    },
    dependencias: {
      execucao: 'Node >= 22. Nenhum pacote externo.',
      opcional: 'ffmpeg, so para MP3/OGG. Os WAV mestres saem sem ele (--no-encode).',
      tomadasDeVoz: 'espeak-ng 1.51, usado UMA vez para gerar os WAV em scripts/audio-logo/takes/, que estao versionados. O render nao chama espeak.',
    },
    musica: {
      andamentoBpm: BPM,
      tonalidade: 'Mi maior com nona acrescentada (E add9)',
      afinacao: 'Temperamento igual, A4 = 440 Hz',
      acorde: CHORD.map((n) => ({ nota: n, hz: round3(hz(n)) })),
      arpejo: ARP.map((n) => ({ nota: n, hz: round3(hz(n)) })),
      sinos: BELLS.map((n) => ({ nota: n, hz: round3(hz(n)) })),
      gradeSegundos: TIMELINE,
    },
    traducaoDaMarca: {
      'voxel / pixel': 'pulso chiptune de duty 0,25 preso a grade de 32avos + camada de bitcrush 8 bits / 11 kHz na voz',
      'degrade roxo -> magenta': 'supersaw de 5 vozes por nota desafinadas em 15 cents, com o corte abrindo de 420 Hz a 5,4 kHz — uma cor so, com largura',
      'letreiro de neon': 'sinos aditivos inarmonicos, placa brilhante (damping 0,13) e eco de semicolcheia pontuada',
      'ferramentas (tools)': 'estalo de encaixe em passa-banda, na abertura da peca e no ataque do impacto',
      'a palavra e a marca': 'acorde e sinos abaixam 4,5 dB sob a locucao, e o ducking e devolvido a voz para ela nao se abaixar junto',
    },
    voz: {
      palavra: 'DANITOOLS',
      tomadas: Object.fromEntries(Object.entries(TAKES).map(([k, v]) => [k, { comando: v.command, fonemas: v.phonemes }])),
      espectroDaFonte: {
        medidoEm: 'tomada en-us crua, DFT esparsa por banda, energia relativa ao total',
        bandas: { '60Hz': '-17.0 dB', '120Hz': '-8.5 dB', '250Hz': '-3.1 dB', '500Hz': '-7.1 dB', '1kHz': '-9.4 dB', '2kHz': '-14.5 dB', '4kHz': '-30.8 dB', '8kHz': '-34.9 dB' },
        conclusao: 'A fonte e encaixotada em 250 Hz e praticamente vazia acima de 4 kHz. Por isso a cadeia CORTA 280 Hz e GERA o brilho por transposicao de oitava, em vez de realcar um espectro sem conteudo.',
      },
      camadas: {
        nucleo: 'HP 105 Hz; -4,0 dB em 280 Hz (a caixa medida); -2,0 dB em 720 Hz (nasalidade de formante); +4,5 dB em 2,6 kHz; shelf +5,0 dB em 3,8 kHz para o "-LS" final',
        peso: 'transposicao -12 st (resample + overlap-add, grao 85 ms), LP 600 Hz, ganho 0,52',
        brilho: 'transposicao +12 st (grao 35 ms), HP 2,6 kHz, ganho 0,15 — leva o conteudo de 2-4 kHz para 4-8 kHz',
        pixel: 'bitcrush 8 bits / 11,025 kHz, passa-banda em 1,5 kHz, ganho 0,17',
        cola: 'saturacao tanh (drive 1,45) -> compressor 3,2:1 em -20 dBFS -> chorus de 3 vozes (11-20 ms, 0,42 Hz), 42% de largura sobre o centro seco',
      },
    },
    medicao: {
      norma: 'ITU-R BS.1770-4 com gating duplo (-70 LUFS absoluto, -10 LU relativo); filtros K com os coeficientes normativos de 48 kHz.',
      afericao: 'O medidor foi conferido contra o caso 1 do EBU Tech 3341: seno de 1 kHz estereo a -20 dBFS mede -20,0 LUFS.',
      janelas: 'A EBU R128 define duas janelas que nao sao intercambiaveis: momentary (M) usa 400 ms e short-term (S) usa 3 s. Os campos loudnessMomentaneaMaximaLufs e loudnessCurtoPrazoMaximaLufs dizem qual e qual. Numa peca com menos de 3 s nao cabe uma unica janela short-term: o campo vem null e janelasCurtoPrazo vem 0, em vez de um numero tirado de uma janela curta demais. O gating da integrada continua sobre os blocos de 400 ms, que e o que a BS.1770-4 manda ali.',
      ressalva: 'O pico inter-amostra e ESTIMADO por sobreamostragem 8x com interpolacao de Hermite, nao pelo FIR normativo de 4x. Vale como margem de seguranca, nao como certificado de conformidade.',
      margemDaVoz: 'Energia RMS da voz menos a da soma das outras faixas, por banda, na janela exata da palavra. Nas bandas de 1 a 8 kHz — onde mora a inteligibilidade da fala — a margem TEM que ser positiva. Em banda larga e em 200-800 Hz a margem negativa e o projeto: ali o corpo do acorde e o sub e que mandam, e a voz foi cortada de proposito nessa regiao.',
    },
    entregas: rendered,
  };

  writeFileSync(join(outDir, 'sound-logo-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\nmanifesto + onda em ${outDir.replace(`${ROOT}/`, '')}/`);
  if (!ffmpeg) console.log('ffmpeg ausente: so os WAV foram escritos.');
}

main();
