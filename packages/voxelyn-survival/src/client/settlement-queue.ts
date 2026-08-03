// As liquidacoes que ainda nao chegaram.
//
// Isto era um slot unico dentro de `main.ts`, e o slot unico ja produziu dois
// bugs distintos — os dois custando a carga de uma run inteira, os dois so
// visiveis com a rede ruim, e nenhum dos dois testavel onde estava. Por isso
// virou um objeto proprio: a corrida cabe num teste de dez linhas.
//
// ---------------------------------------------------------------------------
// A CORRIDA QUE ELE EXISTE PARA IMPEDIR
// ---------------------------------------------------------------------------
// A liquidacao espera ate 45 s (do outro lado ha uma re-simulacao de ate trinta
// minutos de jogo). O ticket seguinte volta em 6. Entao esta ordem e comum:
//
//   1. run A termina, liquidacao falha, A fica pendente;
//   2. jogador comeca a run B; a retentativa de A sai junto e demora;
//   3. run B termina e tambem falha;
//   4. a retentativa de A finalmente responde OK.
//
// Com um slot unico, o passo 4 limpava o pendente de B — e a carga de B nunca
// mais seria reenviada. Chaveado por `runId`, cada run so mexe na propria linha.
//
// O que NAO esta aqui, de proposito: persistencia. Isto vive em memoria e morre
// com a aba. Guardar em disco seria o "credite esta run depois" que a spec
// proibe — a diferenca e que aqui todo log ja tem um ticket emitido pelo
// servidor, dentro da validade, e o reenvio usa o mesmo `runId`, que a
// liquidacao trata de forma idempotente.

export type PendingSettlement = { runId: string; log: string; url: string };

export class SettlementQueue {
  private readonly pending = new Map<string, { log: string; url: string }>();

  /** Guarda (ou atualiza) a liquidacao de uma run que falhou. */
  hold(entry: PendingSettlement): void {
    this.pending.set(entry.runId, { log: entry.log, url: entry.url });
  }

  /**
   * Marca UMA run como liquidada.
   *
   * So a linha dela sai. E a correcao inteira: o sucesso de A nao pode apagar o
   * pendente de B so por ter chegado depois.
   */
  settled(runId: string): void {
    this.pending.delete(runId);
  }

  /**
   * O que reenviar agora.
   *
   * Devolve uma COPIA: quem chama dispara requisicoes assincronas que voltam a
   * escrever aqui, e iterar sobre a colecao viva enquanto ela muda e exatamente
   * o tipo de bug que so aparece com a rede ruim — que e quando este objeto
   * inteiro entra em uso.
   */
  drain(): PendingSettlement[] {
    return [...this.pending].map(([runId, entry]) => ({ runId, ...entry }));
  }

  has(runId: string): boolean {
    return this.pending.has(runId);
  }

  get size(): number {
    return this.pending.size;
  }
}
