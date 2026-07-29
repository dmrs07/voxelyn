import { describe, expect, it } from 'vitest';
import { inviteUrlFrom } from './invite';

describe('link de convite', () => {
  it('aponta para a sala', () => {
    const url = new URL(inviteUrlFrom('https://jogo.exemplo/index.html', 'BCDF'));
    expect(url.searchParams.get('room')).toBe('BCDF');
  });

  // Mandar ?dev=1 para um amigo abriria as ferramentas de desenvolvimento na
  // maquina dele. O convite carrega a SALA, e nada mais da sessao de quem
  // convidou.
  it('nao leva junto o estado da sessao de quem convidou', () => {
    const url = new URL(
      inviteUrlFrom('https://jogo.exemplo/?dev=1&seed=0xABCD&solo=1&online=1', 'GHJK'),
    );
    for (const proibido of ['dev', 'seed', 'solo', 'online']) {
      expect(url.searchParams.has(proibido), `vazou ${proibido}`).toBe(false);
    }
    expect(url.searchParams.get('room')).toBe('GHJK');
  });

  it('troca a sala anterior em vez de acumular', () => {
    const url = new URL(inviteUrlFrom('https://jogo.exemplo/?room=AAAA', 'BCDF'));
    expect(url.searchParams.getAll('room')).toEqual(['BCDF']);
  });

  it('preserva o caminho e parametros alheios ao jogo', () => {
    const url = new URL(inviteUrlFrom('https://jogo.exemplo/alpha/?utm=x', 'MNPQ'));
    expect(url.pathname).toBe('/alpha/');
    expect(url.searchParams.get('utm')).toBe('x');
  });
});
