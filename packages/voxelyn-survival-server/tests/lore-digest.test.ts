import { describe, expect, it } from 'vitest';
import { loreDigestOf } from '../src/progression-store.js';

/**
 * A pergunta que o digest existe para responder: ALGUEM le os 257 fragmentos?
 * Sao 27 mil palavras trancadas num painel, e ate agora nenhum numero dizia se
 * elas chegam a alguem.
 */
describe('loreDigestOf', () => {
  it('sem perfil algum, devolve zeros em vez de NaN', () => {
    const d = loreDigestOf([]);
    expect(d.profiles).toBe(0);
    expect(d.readRate).toBe(0);
    expect(d.medianRead).toBe(0);
    expect(d.fragments).toEqual([]);
  });

  it('conta desbloqueados, lidos e a taxa entre os dois', () => {
    const d = loreDigestOf([
      { unlocked: ['a', 'b', 'c', 'd'], read: ['a'] },
      { unlocked: ['a', 'b'], read: ['a', 'b'] },
    ]);
    expect(d.profiles).toBe(2);
    expect(d.profilesWithUnlocked).toBe(2);
    expect(d.profilesWithAnyRead).toBe(2);
    expect(d.unlockedTotal).toBe(6);
    expect(d.readTotal).toBe(3);
    expect(d.readRate).toBeCloseTo(0.5);
  });

  it('um fragmento lido que saiu do catalogo nao infla a taxa', () => {
    // Ler continua registrado mesmo se o fragmento for removido depois. Contar
    // isso daria taxa acima de 100%, e um painel que mostra 120% perde a
    // credibilidade dos outros numeros junto.
    const d = loreDigestOf([{ unlocked: ['a'], read: ['a', 'fragmento-aposentado'] }]);
    expect(d.readTotal).toBe(1);
    expect(d.readRate).toBe(1);
    expect(d.fragments.map((f) => f.id)).toEqual(['a']);
  });

  it('separa quem nunca abriu de quem abriu so o primeiro', () => {
    // A curva que importa: se todo mundo cai no balde "1", o problema nao e o
    // texto, e o segundo clique.
    const d = loreDigestOf([
      { unlocked: ['a', 'b', 'c'], read: [] },
      { unlocked: ['a', 'b', 'c'], read: ['a'] },
      { unlocked: ['a', 'b', 'c'], read: ['a'] },
      { unlocked: ['a', 'b', 'c'], read: ['a', 'b', 'c'] },
    ]);
    expect(d.profilesWithAnyRead).toBe(3);
    const bucket = (label: string) => d.readBuckets.find((b) => b.bucket === label)?.profiles;
    expect(bucket('0')).toBe(1);
    expect(bucket('1')).toBe(2);
    expect(bucket('2-5')).toBe(1);
    expect(d.medianRead).toBe(1);
  });

  it('aponta o texto que ninguem quis: desbloqueado por todos, lido por ninguem', () => {
    const d = loreDigestOf([
      { unlocked: ['popular', 'ignorado'], read: ['popular'] },
      { unlocked: ['popular', 'ignorado'], read: ['popular'] },
    ]);
    const ignorado = d.fragments.find((f) => f.id === 'ignorado');
    expect(ignorado).toEqual({ id: 'ignorado', unlocked: 2, read: 0 });
  });

  it('perfil sem nada desbloqueado nao entra no denominador', () => {
    // Conta novo nao e leitor que desistiu: incluir isso afundaria a taxa e
    // faria o lore parecer ignorado quando ele nem foi oferecido.
    const d = loreDigestOf([
      { unlocked: [], read: [] },
      { unlocked: ['a'], read: ['a'] },
    ]);
    expect(d.profiles).toBe(2);
    expect(d.profilesWithUnlocked).toBe(1);
    expect(d.readRate).toBe(1);
  });
});
