import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cachedUnlockBaseline } from './progression-cache';

const KEY = 'voxelyn.progression.cache';

/** Um `localStorage` minimo: os testes rodam em ambiente node. */
const installStorage = (): Map<string, string> => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  return store;
};

/**
 * O aviso de arquivo liberado se apoia nesta funcao para saber o que o perfil
 * JA sabia. Ela existe separada de `readCachedProfile` por uma razao so: aquela
 * preenche campos narrativos ausentes com vazio para o desenho nao explodir, e
 * vazio aqui significaria "nunca desbloqueou nada" — a diferenca entre um
 * cartao e doze cartoes de coisas velhas.
 */
describe('cachedUnlockBaseline', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installStorage();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('devolve a lista gravada', () => {
    store.set(
      KEY,
      JSON.stringify({ profile: { unlockedLoreFragmentIds: ['AX-PUB-001', 'AX-ENG-004'] } }),
    );
    expect(cachedUnlockBaseline()).toEqual(['AX-PUB-001', 'AX-ENG-004']);
  });

  it('distingue lista vazia gravada de campo ausente', () => {
    store.set(KEY, JSON.stringify({ profile: { unlockedLoreFragmentIds: [] } }));
    expect(cachedUnlockBaseline()).toEqual([]);
  });

  /**
   * O CASO QUE JUSTIFICA A FUNCAO.
   *
   * Um cache gravado antes de os campos narrativos existirem volta sem
   * `unlockedLoreFragmentIds`. Lido como `[]`, a liquidacao seguinte trataria
   * todo o arquivo do perfil como novidade e despejaria a fila inteira.
   */
  it('devolve null para cache anterior aos campos narrativos', () => {
    store.set(KEY, JSON.stringify({ profile: { profileId: 'p1', wallet: { ore: 3 } } }));
    expect(cachedUnlockBaseline()).toBeNull();
  });

  it('devolve null sem cache, com lixo, ou sem storage', () => {
    expect(cachedUnlockBaseline()).toBeNull();
    store.set(KEY, 'nao e json');
    expect(cachedUnlockBaseline()).toBeNull();
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(cachedUnlockBaseline()).toBeNull();
  });
});
