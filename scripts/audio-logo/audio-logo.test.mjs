// Testes do logo sonoro. `node --test scripts/audio-logo/`
//
// O que se testa aqui nao e "o som ficou bom" — isso nao e testavel. Testa-se o
// que TEM que ser verdade para a peca servir de marca registrada: que o medidor
// esteja aferido, que a afinacao esteja certa, que o render seja identico entre
// execucoes, que a palavra passe por cima da musica e que nada estoure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buf, SR } from './dsp.mjs';
import { measureLoudness, truePeakDb, voiceMargin } from './loudness.mjs';
import { hz } from './synth.mjs';
import { arrange, master } from './arrangement.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TAKE = join(HERE, 'takes/danitools-en-us.wav');

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

test('o render e deterministico', () => {
  const a = arrange(TAKE, { variant: 'full' });
  const b = arrange(TAKE, { variant: 'full' });
  assert.equal(a.L.length, b.L.length);
  for (let i = 0; i < a.L.length; i++) {
    if (a.L[i] !== b.L[i] || a.R[i] !== b.R[i]) {
      assert.fail(`divergencia na amostra ${i} (${(i / SR).toFixed(3)}s)`);
    }
  }
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
  for (const [variant, target] of [['full', -14], ['short', -14], ['tag', -16]]) {
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
