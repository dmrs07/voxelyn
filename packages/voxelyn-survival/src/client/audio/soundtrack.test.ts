import { describe, expect, it } from 'vitest';
import { MUSIC_CEILING } from './music';
import {
  COMPOSED_TRIM,
  COMPOSED_TRIM_MAX,
  COMPOSED_TRIM_MIN,
  SOUNDTRACK_URL,
  composedBaseGain,
  isMusicSource,
  resolveMusicSource,
} from './soundtrack';

describe('contrato da trilha composta', () => {
  it('o asset e lossless (FLAC) e relativo a base do app', () => {
    // O "sem perda" do contrato com o compositor mora nesta extensao: trocar
    // por .mp3/.ogg aqui e regressao de qualidade, nao detalhe de build.
    expect(SOUNDTRACK_URL.endsWith('.flac')).toBe(true);
    expect(SOUNDTRACK_URL.startsWith('/')).toBe(false);
    expect(SOUNDTRACK_URL.startsWith('http')).toBe(false);
  });

  it('o trim declarado vive dentro da faixa sana', () => {
    expect(COMPOSED_TRIM).toBeGreaterThanOrEqual(COMPOSED_TRIM_MIN);
    expect(COMPOSED_TRIM).toBeLessThanOrEqual(COMPOSED_TRIM_MAX);
  });

  it('a trilha respeita o teto da musica: SFX > musica, sempre', () => {
    // Comparar ganho com ganho da procedural seria enganoso: os osciladores
    // procedurais tocam perto de full scale, o master do compositor senta em
    // -17 LUFS — o trim calibrado por loudness (script de preparacao) pode
    // legitimamente passar da soma de LAYER_GAINS. O contrato REAL e com os
    // SFX: no slider maximo, o ganho da trilha fica abaixo do menor telegrafo
    // (0.45) — musica e chao, nunca canal de informacao. A folga percebida e
    // bem maior do que a de ganho: o conteudo do master esta ~17 dB abaixo do
    // proprio full scale, o telegrafo sintetizado nao.
    const composed = composedBaseGain(1);
    expect(composed).toBeLessThan(0.45);
    // E nunca ultrapassa o pior caso declarado do proprio contrato.
    expect(composed).toBeLessThanOrEqual(MUSIC_CEILING * COMPOSED_TRIM_MAX + 1e-9);
  });

  it('composedBaseGain satura o slider em [0,1]', () => {
    expect(composedBaseGain(-1)).toBe(0);
    expect(composedBaseGain(2)).toBe(composedBaseGain(1));
    expect(composedBaseGain(0.5)).toBeCloseTo(composedBaseGain(1) / 2, 10);
  });
});

describe('resolucao de fonte (fallback para o backup procedural)', () => {
  it('preferencia composta so vale com o arquivo pronto', () => {
    expect(resolveMusicSource('composed', true)).toBe('composed');
    // Carregando, 404 ou decode falho: o backup toca — o jogo nunca desce mudo.
    expect(resolveMusicSource('composed', false)).toBe('synth');
  });

  it('preferencia synth ignora a disponibilidade do arquivo', () => {
    expect(resolveMusicSource('synth', true)).toBe('synth');
    expect(resolveMusicSource('synth', false)).toBe('synth');
  });

  it('isMusicSource valida o que vem do storage', () => {
    expect(isMusicSource('composed')).toBe(true);
    expect(isMusicSource('synth')).toBe(true);
    expect(isMusicSource('mp3')).toBe(false);
    expect(isMusicSource(undefined)).toBe(false);
  });
});
