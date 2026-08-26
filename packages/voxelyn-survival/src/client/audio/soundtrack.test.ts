import { describe, expect, it } from 'vitest';
import { LAYER_GAINS, MUSIC_CEILING } from './music';
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
    // No slider maximo, o ganho da trilha composta nao pode passar do que a
    // mixagem procedural ja se permitia (teto * soma das camadas continuas).
    const composed = composedBaseGain(1);
    const proceduralMax =
      MUSIC_CEILING * (LAYER_GAINS.drone + LAYER_GAINS.bass + LAYER_GAINS.pad + LAYER_GAINS.tension);
    expect(composed).toBeLessThanOrEqual(proceduralMax + 1e-9);
    // E o menor telegrafo (0.45) segue acima do teto inteiro com folga.
    expect(composed).toBeLessThan(0.45);
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
