import { describe, expect, it } from 'vitest';
import { newlyUnlocked } from '../client/lore-toast';

/**
 * A liquidacao devolve a lista INTEIRA de desbloqueados e nenhum delta, entao
 * esta funcao e a unica coisa entre "o servidor mandou 12 ids" e "avise UM
 * arquivo novo". Ela erra de duas maneiras caras: anunciar o que ja era velho
 * (confete a cada extracao) e engolir o que era novo (o aviso nunca aparece).
 */
describe('newlyUnlocked', () => {
  it('devolve so o que nao estava na lista anterior', () => {
    expect(newlyUnlocked(['AX-PUB-001'], ['AX-PUB-001', 'AX-ENG-004'])).toEqual(['AX-ENG-004']);
  });

  it('devolve vazio quando nada mudou', () => {
    const ids = ['AX-PUB-001', 'AX-ENG-004'];
    expect(newlyUnlocked(ids, ids)).toEqual([]);
  });

  it('preserva a ordem em que o servidor mandou', () => {
    expect(newlyUnlocked(['a'], ['a', 'b', 'c'])).toEqual(['b', 'c']);
  });

  /**
   * Lista vazia e ausencia de lista sao coisas DIFERENTES.
   *
   * `[]` e um perfil em cache que de fato nao tinha nada (estado que o
   * catalogo atual nem produz, ja que `AX-PUB-001` nasce desbloqueado), e ali
   * tudo e novidade legitima. `null` e "nao sei o que ele tinha", e ali o
   * silencio e a resposta certa. Confundir os dois e o que transformaria a
   * primeira abertura num navegador novo numa chuva de cartoes.
   */
  it('trata lista vazia como novidade e ausencia de lista como silencio', () => {
    expect(newlyUnlocked([], ['a', 'b'])).toEqual(['a', 'b']);
    expect(newlyUnlocked(null, ['a', 'b'])).toEqual([]);
  });

  it('ignora um desbloqueado que sumiu da lista nova', () => {
    // Fragmento aposentado do catalogo: some do "depois" sem virar novidade.
    expect(newlyUnlocked(['a', 'b'], ['a'])).toEqual([]);
  });

  /**
   * SEM PERFIL ANTERIOR NAO HA NOVIDADE.
   *
   * Este e o caso que o jogador realmente vive: primeira abertura do jogo num
   * navegador novo, cache vazio, e o servidor responde com os doze arquivos que
   * a conta ja tinha. Tratar isso como delta encheria a tela de cartoes de
   * coisas que a pessoa desbloqueou semanas atras.
   */
  it('nao anuncia nada quando nao havia perfil em cache', () => {
    expect(newlyUnlocked(null, ['a', 'b'])).toEqual([]);
    expect(newlyUnlocked(undefined, ['a', 'b'])).toEqual([]);
  });

  it('nao anuncia nada quando a lista nova nao veio', () => {
    expect(newlyUnlocked(['a'], null)).toEqual([]);
    expect(newlyUnlocked(['a'], undefined)).toEqual([]);
  });
});
