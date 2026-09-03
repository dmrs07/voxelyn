import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MUSIC_CEILING, MUSIC_DUCK_FACTOR, SMALLEST_TELEGRAPH_GAIN } from './music';
import {
  COMPOSED_TRIM,
  COMPOSED_TRIM_MAX,
  COMPOSED_TRIM_MIN,
  BOSS_SOUNDTRACK_URL,
  BOSS_TRIM,
  MENU_SOUNDTRACK_URL,
  MENU_TRIM,
  SOUNDTRACK_URL,
  bossBaseGain,
  bossTrackPlaying,
  composedBaseGain,
  isMusicSource,
  menuBaseGain,
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
    // SFX, e ele e cobrado SOB O DUCK: com o slider no maximo, a trilha ducada
    // fica abaixo do menor telegrafo. Em repouso ela passa desse ganho de
    // proposito — e o que a tirou de -30 para -21 LUFS.
    //
    // A folga percebida continua sendo bem maior do que a de ganho: o conteudo
    // do master esta ~17 dB abaixo do proprio full scale, o telegrafo
    // sintetizado nao.
    expect(composedBaseGain(1) * MUSIC_DUCK_FACTOR).toBeLessThan(SMALLEST_TELEGRAPH_GAIN);
    // E nunca ultrapassa o pior caso declarado do proprio contrato.
    expect(composedBaseGain(1)).toBeLessThanOrEqual(MUSIC_CEILING * COMPOSED_TRIM_MAX + 1e-9);
  });

  it('o script de calibragem nao divergiu do jogo', () => {
    // prepare-soundtrack.mjs roda em Node puro e por isso REPETE o teto do jogo
    // num literal proprio. Uma copia que ninguem confere e uma armadilha: com o
    // teto novo e o alvo velho o script cospe trim 4,91 — fora da faixa sa, e
    // so daria as caras quando alguem fosse trocar o master.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(here, '../../../scripts/prepare-soundtrack.mjs'), 'utf8');
    const num = (nome: string): number => {
      const m = new RegExp(`const ${nome} = (-?[\\d.]+);`).exec(src);
      if (!m) throw new Error(`${nome} nao encontrado em prepare-soundtrack.mjs`);
      return Number(m[1]);
    };

    expect(num('MUSIC_CEILING')).toBe(MUSIC_CEILING);
    expect(num('TRIM_MIN')).toBe(COMPOSED_TRIM_MIN);
    expect(num('TRIM_MAX')).toBe(COMPOSED_TRIM_MAX);

    // E o alvo tem que REPRODUZIR os trims versionados a partir do LUFS medido
    // de cada master (os numeros que estao documentados junto de cada trim).
    const alvo = num('TARGET_INGAME_LUFS');
    const trimPara = (lufsDoArquivo: number): number =>
      10 ** ((alvo - lufsDoArquivo) / 20) / MUSIC_CEILING;
    expect(trimPara(-17.1)).toBeCloseTo(COMPOSED_TRIM, 2);
    expect(trimPara(-15.0)).toBeCloseTo(MENU_TRIM, 2);
    expect(trimPara(-5.95)).toBeCloseTo(BOSS_TRIM, 2);
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

  it('a trilha de menu segue o mesmo contrato: lossless, teto, trim na faixa', () => {
    expect(MENU_SOUNDTRACK_URL.endsWith('.flac')).toBe(true);
    expect(MENU_SOUNDTRACK_URL.startsWith('/')).toBe(false);
    // Slots distintos: menu e run nao podem disputar o mesmo arquivo.
    expect(MENU_SOUNDTRACK_URL).not.toBe(SOUNDTRACK_URL);
    expect(MENU_TRIM).toBeGreaterThanOrEqual(COMPOSED_TRIM_MIN);
    expect(MENU_TRIM).toBeLessThanOrEqual(COMPOSED_TRIM_MAX);
    expect(menuBaseGain(1) * MUSIC_DUCK_FACTOR).toBeLessThan(SMALLEST_TELEGRAPH_GAIN);
    expect(menuBaseGain(-1)).toBe(0);
    expect(menuBaseGain(0.5)).toBeCloseTo(menuBaseGain(1) / 2, 10);
  });

  it('a trilha do Diamandis: slot proprio, teto, trim na faixa — e lossy de proposito', () => {
    // O master so existe em mp3; reempacotar em FLAC nao devolveria nada e
    // multiplicaria o precache por dez. Se um master lossless chegar, este
    // teste passa a cobrar `.flac` como os outros dois slots.
    expect(BOSS_SOUNDTRACK_URL.endsWith('.mp3')).toBe(true);
    expect(BOSS_SOUNDTRACK_URL.startsWith('/')).toBe(false);
    expect(BOSS_SOUNDTRACK_URL).not.toBe(SOUNDTRACK_URL);
    expect(BOSS_SOUNDTRACK_URL).not.toBe(MENU_SOUNDTRACK_URL);
    expect(BOSS_TRIM).toBeGreaterThanOrEqual(COMPOSED_TRIM_MIN);
    expect(BOSS_TRIM).toBeLessThanOrEqual(COMPOSED_TRIM_MAX);
    expect(bossBaseGain(1) * MUSIC_DUCK_FACTOR).toBeLessThan(SMALLEST_TELEGRAPH_GAIN);
    expect(bossBaseGain(-1)).toBe(0);
    expect(bossBaseGain(0.5)).toBeCloseTo(bossBaseGain(1) / 2, 10);
  });

  it('a trilha de encontro so soa com o dono certo, acordado, de pe e decodificado', () => {
    expect(bossTrackPlaying('diamandis', true, true, true)).toBe(true);
    // Dormindo, caido, ou sem o arquivo: a trilha da run continua.
    expect(bossTrackPlaying('diamandis', false, true, true)).toBe(false);
    expect(bossTrackPlaying('diamandis', true, false, true)).toBe(false);
    expect(bossTrackPlaying('diamandis', true, true, false)).toBe(false);
    // Os outros chefes nao tem trilha (ainda): tabela, nao excecao.
    expect(bossTrackPlaying('guardian', true, true, true)).toBe(false);
    expect(bossTrackPlaying(null, true, true, true)).toBe(false);
  });

  it('isMusicSource valida o que vem do storage', () => {
    expect(isMusicSource('composed')).toBe(true);
    expect(isMusicSource('synth')).toBe(true);
    expect(isMusicSource('mp3')).toBe(false);
    expect(isMusicSource(undefined)).toBe(false);
  });
});
