// O token de operador entregue por URL.
//
// Estes testes existem por um caso real: o token do Render (`generateValue`)
// nasce em base64, e base64 usa `+`. `URLSearchParams` decodifica `+` como
// ESPACO, entao colar o token na barra do navegador entregava ao servidor uma
// string com espacos, a comparacao falhava e a rota respondia 404 — parecendo
// segredo errado quando era decodificacao.

import { describe, expect, it } from 'vitest';
import { operatorTokenMatches } from '../src/http-util.js';

// Um token com as tres coisas que base64 produz e que a URL maltrata.
const TOKEN = 'aB+cd/ef12345678901234567890=';
const req = (headers: Record<string, string> = {}) => ({ headers });

describe('operatorTokenMatches', () => {
  it('aceita o token colado cru na barra, com o + virando espaco', () => {
    // Isto e exatamente o que o navegador manda: `?token=aB cd/ef...`
    const url = new URL(`http://x/rota?token=${TOKEN}`);
    expect(url.searchParams.get('token')).toContain(' '); // a prova do bug
    expect(operatorTokenMatches(TOKEN, url, req())).toBe(true);
  });

  it('aceita o token corretamente percent-encoded', () => {
    const url = new URL(`http://x/rota?token=${encodeURIComponent(TOKEN)}`);
    expect(operatorTokenMatches(TOKEN, url, req())).toBe(true);
  });

  it('aceita pelo header, para nao passar segredo por URL', () => {
    const url = new URL('http://x/rota');
    expect(operatorTokenMatches(TOKEN, url, req({ authorization: `Bearer ${TOKEN}` }))).toBe(true);
  });

  it('recusa token errado, do mesmo tamanho', () => {
    const url = new URL(`http://x/rota?token=${encodeURIComponent('aB+cd/ef12345678901234567890X')}`);
    expect(operatorTokenMatches(TOKEN, url, req())).toBe(false);
  });

  it('recusa quando nao ha token configurado', () => {
    // Sem segredo no ambiente a rota fica fechada, e nao aberta.
    const url = new URL(`http://x/rota?token=${encodeURIComponent(TOKEN)}`);
    expect(operatorTokenMatches(undefined, url, req())).toBe(false);
    expect(operatorTokenMatches('', url, req())).toBe(false);
  });

  it('recusa requisicao sem token nenhum', () => {
    expect(operatorTokenMatches(TOKEN, new URL('http://x/rota'), req())).toBe(false);
  });

  it('nao confunde token que so difere no tamanho', () => {
    const url = new URL(`http://x/rota?token=${encodeURIComponent(TOKEN + 'a')}`);
    expect(operatorTokenMatches(TOKEN, url, req())).toBe(false);
  });
});
