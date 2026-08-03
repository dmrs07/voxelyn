// "Esta resposta ainda vale?"
//
// Terceira vez que esta pergunta aparece nesta feature, e as tres com o mesmo
// desfecho: uma resposta lenta de um contexto ABANDONADO chegando depois de uma
// rapida do contexto atual, e sobrescrevendo-a.
//
//   1. a descida abandonada publicando o proprio ticket sobre a descida nova;
//   2. a liquidacao da run A apagando o pendente da run B;
//   3. a consulta da Matriz do servidor A substituindo o perfil do servidor B.
//
// As tres eram invisiveis com a rede boa e todas custavam alguma coisa do
// jogador. Por isso a pergunta virou um objeto com nome: quem escrever a proxima
// chamada assincrona encontra o padrao pronto em vez de reinventa-lo — e errar
// de novo.
//
// ---------------------------------------------------------------------------
// POR QUE UM CONTADOR E UM ESCOPO, E NAO SO UM CONTADOR
// ---------------------------------------------------------------------------
// O contador cobre "outra consulta comecou". Nao cobre "o alvo mudou sem que
// ninguem comecasse outra consulta" — que e exatamente o caso da Matriz, onde o
// jogador edita o campo de servidor entre uma abertura e outra. O escopo (uma
// string: a URL, o modo, o que for) e comparado junto, e trata o segundo caso.

export type Query<TScope> = { id: number; scope: TScope };

export class LatestQuery<TScope> {
  private counter = 0;

  /** Abre uma consulta. Guarde o retorno e confira depois do `await`. */
  begin(scope: TScope): Query<TScope> {
    return { id: ++this.counter, scope };
  }

  /**
   * A consulta ainda e a atual, contra o escopo de AGORA?
   *
   * `currentScope` e lido no momento da conferencia, e nao no `begin`: o alvo
   * pode ter mudado enquanto a resposta vinha, e e isso que precisa ser detectado.
   */
  isCurrent(query: Query<TScope>, currentScope: TScope): boolean {
    return query.id === this.counter && query.scope === currentScope;
  }

  /**
   * Invalida tudo o que estiver no ar, sem abrir nada.
   *
   * Para quando o contexto simplesmente acaba — o painel fechou, a run foi
   * abandonada — e nao ha uma proxima consulta para tomar o lugar.
   */
  cancelAll(): void {
    this.counter++;
  }
}
