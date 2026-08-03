// A corrida que apareceu tres vezes nesta feature. Aqui ela tem nome e teste.

import { describe, expect, it } from 'vitest';
import { LatestQuery } from './latest-query';

describe('a resposta que chega tarde nao vence', () => {
  it('a consulta mais recente e a atual', () => {
    const queries = new LatestQuery<string>();
    const a = queries.begin('servidor-A');
    expect(queries.isCurrent(a, 'servidor-A')).toBe(true);

    const b = queries.begin('servidor-A');
    expect(queries.isCurrent(b, 'servidor-A')).toBe(true);
    // A resolvendo DEPOIS de B nao pode sobrescrever o resultado de B.
    expect(queries.isCurrent(a, 'servidor-A')).toBe(false);
  });

  // O caso que um contador sozinho NAO cobre: o jogador troca o campo de
  // servidor entre uma abertura e outra, sem que nenhuma consulta nova comece.
  it('trocar de alvo invalida o que estava no ar, mesmo sem consulta nova', () => {
    const queries = new LatestQuery<string>();
    const a = queries.begin('servidor-A');
    expect(queries.isCurrent(a, 'servidor-B')).toBe(false);
  });

  it('o alvo e lido na CONFERENCIA, e nao na abertura', () => {
    const queries = new LatestQuery<string>();
    const a = queries.begin('servidor-A');
    // Voltou para A antes de a resposta chegar: ela vale de novo.
    expect(queries.isCurrent(a, 'servidor-B')).toBe(false);
    expect(queries.isCurrent(a, 'servidor-A')).toBe(true);
  });

  it('cancelAll invalida sem abrir nada', () => {
    const queries = new LatestQuery<string>();
    const a = queries.begin('servidor-A');
    queries.cancelAll();
    expect(queries.isCurrent(a, 'servidor-A')).toBe(false);
  });

  // O mecanismo diz "chegou outra DO MESMO TIPO, esta envelheceu". Perguntas
  // diferentes nao se envelhecem: compartilhar um rastreador entre elas fazia
  // abrir o Codex descartar um refresh de perfil em voo — e, pior, deixar uma
  // compra ja debitada com o botao travado para sempre.
  it('rastreadores diferentes nao invalidam um ao outro', () => {
    const perfil = new LatestQuery<string>();
    const codex = new LatestQuery<string>();

    const consultaDePerfil = perfil.begin('servidor-A');
    codex.begin('servidor-A');

    expect(perfil.isCurrent(consultaDePerfil, 'servidor-A')).toBe(true);
  });

  it('serve para qualquer escopo comparavel por igualdade', () => {
    const queries = new LatestQuery<number>();
    const primeiro = queries.begin(1);
    expect(queries.isCurrent(primeiro, 1)).toBe(true);
    expect(queries.isCurrent(primeiro, 2)).toBe(false);
  });
});
