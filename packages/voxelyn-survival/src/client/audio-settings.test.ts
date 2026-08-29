// As configuracoes de audio persistidas: leitura, saneamento e MIGRACAO.
//
// A migracao e o que vale um teste. Este jogo ja esta instalado como PWA na
// maquina de quem joga, com um `localStorage` gravado por uma versao que nao
// conhecia o barramento de efeitos. Ler esse registro antigo tem de devolver
// exatamente a mixagem de antes — 1.0 nos efeitos —, e nao um zero silencioso
// nem um `undefined` que vira `NaN` no ganho do WebAudio.
//
// O modulo guarda os valores em `localStorage`, entao o teste monta um duble
// em vez de pedir um DOM inteiro: o que esta sob teste e a aritmetica de
// leitura, nao o navegador.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from './settings';

const KEY = 'voxelyn.audio';

/** `localStorage` de mentira, com um interruptor para simular storage bloqueado. */
const makeStorage = () => {
  const map = new Map<string, string>();
  let blocked = false;
  return {
    block: (value: boolean) => {
      blocked = value;
    },
    raw: map,
    api: {
      getItem: (k: string) => {
        if (blocked) throw new Error('storage bloqueado');
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (blocked) throw new Error('storage bloqueado');
        map.set(k, v);
      },
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage,
  };
};

let storage: ReturnType<typeof makeStorage>;
beforeEach(() => {
  storage = makeStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage.api,
    configurable: true,
    writable: true,
  });
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('volume dos efeitos', () => {
  it('sem storage, o padrao e a mixagem do jogo (1.0)', () => {
    // 1.0 e nao 0.8: o padrao dos efeitos e "como o jogo sempre soou". Um
    // valor menor rebaixaria em silencio o som de quem nunca tocou no slider.
    expect(loadAudioSettings().sfxVolume).toBe(1);
  });

  it('MIGRACAO: registro gravado antes do barramento cai em 1.0', () => {
    // O registro real de uma instalacao anterior: tem volume, musica e mudo,
    // e nao tem `sfxVolume`.
    storage.raw.set(
      KEY,
      JSON.stringify({ volume: 0.5, musicVolume: 0.3, muted: true, musicSource: 'synth' }),
    );
    const loaded = loadAudioSettings();
    expect(loaded.sfxVolume).toBe(1);
    // E o resto do registro antigo sobrevive intacto — a migracao nao pode
    // custar as preferencias que a pessoa ja tinha.
    expect(loaded.volume).toBe(0.5);
    expect(loaded.musicVolume).toBe(0.3);
    expect(loaded.muted).toBe(true);
    expect(loaded.musicSource).toBe('synth');
  });

  it('le o valor gravado e sobrevive a ida e volta', () => {
    const settings: AudioSettings = {
      volume: 0.8,
      musicVolume: 0.7,
      sfxVolume: 0.42,
      muted: false,
      musicSource: 'composed',
    };
    saveAudioSettings(settings);
    expect(loadAudioSettings()).toEqual(settings);
  });

  it('zero e um valor legitimo, e nao "ausente"', () => {
    // A armadilha classica de `obj.sfxVolume || DEFAULT`: quem silenciou os
    // efeitos de proposito os ouviria de volta no proximo boot.
    storage.raw.set(KEY, JSON.stringify({ sfxVolume: 0 }));
    expect(loadAudioSettings().sfxVolume).toBe(0);
  });

  it('sanea valor fora da faixa e lixo', () => {
    for (const [stored, expected] of [
      [2.5, 1],
      [-1, 0],
      ['alto', 1],
      [Number.NaN, 1],
      [null, 1],
    ] as const) {
      storage.raw.set(KEY, JSON.stringify({ sfxVolume: stored }));
      expect(loadAudioSettings().sfxVolume, `gravado: ${String(stored)}`).toBe(expected);
    }
  });

  it('storage bloqueado (modo privativo) nao impede o jogo de iniciar', () => {
    storage.block(true);
    expect(loadAudioSettings().sfxVolume).toBe(1);
    expect(() =>
      saveAudioSettings({
        volume: 1,
        musicVolume: 1,
        sfxVolume: 1,
        muted: false,
        musicSource: 'composed',
      }),
    ).not.toThrow();
  });

  it('JSON corrompido cai no padrao inteiro', () => {
    storage.raw.set(KEY, '{isto nao e json');
    const loaded = loadAudioSettings();
    expect(loaded.sfxVolume).toBe(1);
    expect(loaded.volume).toBe(0.8);
  });
});
