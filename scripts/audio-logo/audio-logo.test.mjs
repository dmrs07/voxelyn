// Testes do logo sonoro. `node --test scripts/audio-logo/`
//
// O que se testa aqui nao e "o som ficou bom" — isso nao e testavel. Testa-se o
// que TEM que ser verdade para a peca servir de marca registrada: que o medidor
// esteja aferido, que a afinacao esteja certa, que o render seja identico entre
// execucoes, que a palavra passe por cima da musica e que nada estoure.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buf, encodeWav, SR } from './dsp.mjs';
import { measureLoudness, truePeakDb, voiceMargin } from './loudness.mjs';
import { hz } from './synth.mjs';
import { arrange, master } from './arrangement.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const TAKE = join(HERE, 'takes/danitools-en-us.wav');
const TAKE_PT = join(HERE, 'takes/danitools-pt-br.wav');
const VARIANTES = ['full', 'short', 'tag'];

test('o medidor de loudness esta aferido pelo caso 1 do EBU Tech 3341', () => {
  // Seno de 1 kHz em ambos os canais a -23 dBFS tem que medir -23,0 LUFS.
  const n = SR * 3;
  const L = buf(n), R = buf(n);
  const a = 10 ** (-23 / 20);
  for (let i = 0; i < n; i++) {
    const v = a * Math.sin((2 * Math.PI * 1000 * i) / SR);
    L[i] = v; R[i] = v;
  }
  assert.equal(measureLoudness([L, R]).integratedLufs, -23);
});

test('a afinacao e temperamento igual com A4 = 440 Hz', () => {
  assert.equal(hz('A4'), 440);
  assert.ok(Math.abs(hz('E1') - 41.203) < 0.001);
  assert.ok(Math.abs(hz('E5') - 659.255) < 0.001);
  assert.ok(Math.abs(hz('G#3') - 207.652) < 0.001);
  // uma oitava e exatamente o dobro
  assert.ok(Math.abs(hz('E5') / hz('E4') - 2) < 1e-12);
});

test('o render e deterministico em todas as variantes', () => {
  for (const [take, variant] of [[TAKE, 'full'], [TAKE, 'short'], [TAKE, 'tag'], [TAKE_PT, 'full']]) {
    const a = arrange(take, { variant });
    const b = arrange(take, { variant });
    assert.equal(a.L.length, b.L.length, `${variant}: comprimentos diferentes`);
    for (let i = 0; i < a.L.length; i++) {
      if (a.L[i] !== b.L[i] || a.R[i] !== b.R[i]) {
        assert.fail(`${variant}: divergencia na amostra ${i} (${(i / SR).toFixed(3)}s)`);
      }
    }
  }
});

test('os mestres versionados batem com o que o renderizador produz', () => {
  // Guarda a promessa de reprodutibilidade do README: se alguem mexer na sintese
  // sem regerar os arquivos, isto falha e aponta qual entrega ficou para tras.
  const manifest = JSON.parse(readFileSync(join(ROOT, 'docs/audio/danitools/sound-logo-manifest.json'), 'utf8'));
  for (const entrega of manifest.entregas) {
    const esperado = entrega.arquivos.find((f) => f.nome === `${entrega.id}.wav`);
    assert.ok(esperado?.sha256, `${entrega.id}: manifesto sem sha256 do mestre`);

    const take = entrega.tomada === 'pt-br' ? TAKE_PT : TAKE;
    const a = arrange(take, { variant: entrega.variante });
    const m = master(a.L, a.R, {
      targetLufs: entrega.medicao.alvoLufs,
      ceilingDb: -1.0,
      measure: (ch) => measureLoudness(ch, SR),
      sr: SR,
    });
    const obtido = createHash('sha256').update(encodeWav([m.L, m.R], SR, 24)).digest('hex');
    assert.equal(obtido, esperado.sha256,
      `${entrega.id}: o WAV versionado nao corresponde ao render. Se a sintese mudou de proposito, rode "pnpm audio-logo". `
      + `Se nao mudou, confira a versao do Node: Math.sin/exp/tanh e ** sao implementation-defined no ECMAScript.`);
  }
});

test('momentary e short-term sao metricas diferentes e vem rotuladas', () => {
  // A R128 define 400 ms (M) e 3 s (S). Trocar uma pela outra falseia a proveniencia.
  const longa = arrange(TAKE, { variant: 'full' });
  const mLonga = master(longa.L, longa.R, { targetLufs: -14, ceilingDb: -1.0, measure: (ch) => measureLoudness(ch, SR) });
  const medida = measureLoudness([mLonga.L, mLonga.R]);

  assert.ok(medida.shortTermWindows > 0, 'a assinatura passa de 3 s e tem que ter janela short-term');
  assert.notEqual(medida.momentaryMaxLufs, medida.shortTermMaxLufs, 'as duas janelas nao podem coincidir por acidente');
  // janela mais curta captura o pico; a de 3 s dilui.
  assert.ok(medida.momentaryMaxLufs > medida.shortTermMaxLufs,
    `momentary (${medida.momentaryMaxLufs}) deveria superar short-term (${medida.shortTermMaxLufs})`);

  // Numa peca com menos de 3 s nao cabe uma janela: o campo vem null, nao um numero inventado.
  const curta = arrange(TAKE, { variant: 'tag' });
  const mCurta = master(curta.L, curta.R, { targetLufs: -16, ceilingDb: -1.0, measure: (ch) => measureLoudness(ch, SR) });
  const curtaMedida = measureLoudness([mCurta.L, mCurta.R]);
  assert.ok(curtaMedida.durationSec < 3);
  assert.equal(curtaMedida.shortTermWindows, 0);
  assert.equal(curtaMedida.shortTermMaxLufs, null);
  assert.ok(Number.isFinite(curtaMedida.momentaryMaxLufs), 'momentary continua valendo numa peca curta');
});

test('a palavra passa por cima da musica nas bandas de inteligibilidade', () => {
  const a = arrange(TAKE, { variant: 'full' });
  const voz = a.events.find((e) => e.name === 'voz');
  const m = voiceMargin(a.stems, { voiceStart: voz.atSec, voiceEnd: voz.atSec + a.voiceLengthSec });
  for (const banda of ['1-2kHz', '2-4kHz', '4-8kHz']) {
    assert.ok(m[banda].margemDb > 3, `${banda}: margem de ${m[banda].margemDb} dB — a palavra some na musica`);
  }
});

test('as entregas respeitam o teto de pico e o alvo de loudness', () => {
  for (const [variant, target] of VARIANTES.map((v, i) => [v, [-14, -14, -16][i]])) {
    const a = arrange(TAKE, { variant });
    const m = master(a.L, a.R, { targetLufs: target, ceilingDb: -1.0, measure: (ch) => measureLoudness(ch, SR) });
    const ch = [m.L, m.R];

    const lufs = measureLoudness(ch).integratedLufs;
    assert.ok(Math.abs(lufs - target) <= 0.5, `${variant}: ${lufs} LUFS, alvo ${target}`);

    for (const tp of truePeakDb(ch)) {
      assert.ok(tp <= -1.0, `${variant}: pico inter-amostra em ${tp} dBTP, acima do teto de -1,0`);
    }
    for (const c of ch) {
      for (let i = 0; i < c.length; i++) {
        assert.ok(Number.isFinite(c[i]), `${variant}: amostra nao finita em ${i}`);
        assert.ok(Math.abs(c[i]) < 1, `${variant}: amostra estourada em ${i}`);
      }
    }
  }
});

test('a assinatura comeca sem ar morto e termina em silencio', () => {
  const a = arrange(TAKE, { variant: 'full' });
  const pico = (from, to) => {
    let p = 0;
    for (let i = from; i < to; i++) p = Math.max(p, Math.abs(a.L[i]), Math.abs(a.R[i]));
    return p;
  };
  // som audivel nos primeiros 40 ms
  assert.ok(pico(0, Math.round(0.04 * SR)) > 0.01, 'a peca abre com silencio');
  // e a cauda tem que ter morrido no fim
  assert.ok(pico(a.L.length - Math.round(0.01 * SR), a.L.length) < 0.002, 'a peca corta a cauda no fim');
});

test('a soma mono nao cancela nada (compatibilidade com alto-falante de celular)', () => {
  const a = arrange(TAKE, { variant: 'full' });
  let est = 0, mono = 0;
  for (let i = 0; i < a.L.length; i++) {
    const m = (a.L[i] + a.R[i]) / 2;
    mono += m * m;
    est += (a.L[i] * a.L[i] + a.R[i] * a.R[i]) / 2;
  }
  const perdaDb = 10 * Math.log10(mono / est);
  assert.ok(perdaDb > -1.5, `somar para mono perde ${perdaDb.toFixed(1)} dB — ha cancelamento de fase`);
});
