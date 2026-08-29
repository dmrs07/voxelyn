// O preload da abertura: o que a barra conta, e como ela conta.
//
// A regra que este arquivo existe para cumprir: A BARRA NAO MENTE. Cada ponto
// percentual dela e uma tarefa que terminou de verdade — uma fonte que
// decodificou, um atlas que chegou, uma imagem que o navegador ja tem em
// memoria. Nao ha cronometro, nao ha interpolacao para o proximo marco, nao ha
// "quase la" enquanto a rede pensa. Se a barra parar em 40%, e porque alguma
// coisa de verdade parou em 40%.
//
// A segunda regra, igualmente importante: O PRELOAD NAO BAIXA NADA DUAS VEZES.
// Nenhuma tarefa daqui abre um `fetch` proprio para um arquivo que o jogo ja
// vai pedir sozinho. Elas ESPERAM os mesmos objetos que os consumidores usam
// depois — os `Image` que o `SpriteBank` ja criou, as fontes que o CSS ja
// declarou. O boot e um observador do carregamento que sempre existiu, nao um
// segundo carregador em paralelo.
//
// A terceira: FALHA NAO E SILENCIO E NAO E ETERNIDADE. Toda tarefa liquida —
// com sucesso ou com erro —, o erro e sempre registrado no console, e a
// distincao entre "o jogo nao funciona sem isto" e "isto tem reserva" e
// declarada por tarefa, no campo `critical`. Nada pode deixar a barra parada
// em 87% para sempre.

/**
 * Uma unidade de preparacao da abertura.
 *
 * `run` deve ser IDEMPOTENTE: alem da nova tentativa depois de uma falha
 * critica, que roda a lista de novo, uma tarefa que ja terminou precisa poder
 * ser esperada outra vez sem refazer trabalho. Na pratica todas sao, porque
 * todas apenas aguardam objetos que ja existem.
 */
export type BootTask = {
  /** Identificador estavel — vai para o log de erro e para os testes. */
  id: string;
  /**
   * Peso relativo no progresso.
   *
   * Existe porque as tarefas nao custam a mesma coisa: os atlas de arte sao
   * megabytes e as fontes sao dezenas de kilobytes. Com peso 1 para todas, a
   * barra pularia de 0 a 60% no primeiro instante e depois ficaria parada no
   * unico item que realmente demora — que e a mesma mentira, so que ao
   * contrario. Os pesos nao precisam somar nada em especial: o progresso e uma
   * fracao do total.
   */
  weight: number;
  /**
   * `true` quando a abertura NAO pode terminar sem isto.
   *
   * Ser critico e caro: uma falha aqui para o boot numa tela de erro em vez de
   * entregar o menu. Por isso a lista de criticos e curta e cada entrada
   * precisa justificar por que nao tem reserva (ver `boot-plan.ts`).
   */
  critical: boolean;
  run: () => Promise<unknown>;
};

export type BootTaskOutcome = {
  id: string;
  critical: boolean;
  ok: boolean;
  /** O erro, quando houve. Preservado para o log — nunca engolido. */
  error?: unknown;
};

export type BootReport = {
  outcomes: readonly BootTaskOutcome[];
  /** Alguma tarefa critica falhou? E o que decide `handoff` ou `failed`. */
  criticalFailed: boolean;
  /** Ids das tarefas nao criticas que falharam — o jogo segue, com reserva. */
  degraded: readonly string[];
};

/**
 * A fracao concluida, de 0 a 1, dado o conjunto de tarefas ja liquidadas.
 *
 * Pura e separada do executor porque e ela que os testes cobram: o progresso e
 * uma funcao dos pesos, e nao um contador que alguem incrementa. Lista vazia
 * devolve 1 — uma abertura sem nada a carregar esta, por definicao, pronta.
 */
export const bootProgress = (
  tasks: readonly BootTask[],
  settled: ReadonlySet<string> | readonly string[],
): number => {
  const total = tasks.reduce((sum, task) => sum + Math.max(0, task.weight), 0);
  if (total <= 0) return 1;
  const done = settled instanceof Set ? settled : new Set(settled);
  const carried = tasks.reduce(
    (sum, task) => (done.has(task.id) ? sum + Math.max(0, task.weight) : sum),
    0,
  );
  return Math.max(0, Math.min(1, carried / total));
};

/**
 * A tarefa mais pesada que ainda NAO liquidou — o que a barra esta esperando.
 *
 * E daqui que sai o texto de estado da tela. As tarefas rodam todas em
 * paralelo, entao "a tarefa atual" nao existe; a mais pesada das pendentes e a
 * resposta honesta a "por que isto ainda nao acabou". Empate resolve pela
 * ordem da lista, para o rotulo nao ficar alternando entre dois nomes.
 *
 * `undefined` quando nao ha mais nada pendente.
 */
export const heaviestPending = (
  tasks: readonly BootTask[],
  settled: ReadonlySet<string> | readonly string[],
): string | undefined => {
  const done = settled instanceof Set ? settled : new Set(settled);
  let best: BootTask | undefined;
  for (const task of tasks) {
    if (done.has(task.id)) continue;
    if (!best || task.weight > best.weight) best = task;
  }
  return best?.id;
};

/**
 * Roda a lista inteira e devolve o laudo. NUNCA rejeita.
 *
 * Em paralelo de proposito: as tarefas sao dominadas por rede e decodificacao,
 * e serializa-las multiplicaria o tempo de abertura pelo numero de itens sem
 * economizar um byte. A ordem de conclusao nao importa — o progresso e uma
 * soma, nao uma fila.
 *
 * Uma tarefa que falha NAO derruba as outras: `criticalFailed` e computado no
 * fim, com todo mundo liquidado, para que a tela de erro consiga dizer tudo o
 * que quebrou de uma vez em vez de uma coisa por tentativa.
 *
 * @param onProgress chamado a cada liquidacao, com a fracao ja concluida e o
 *   id do que a barra ainda espera (`undefined` quando nao falta nada).
 */
export const runBootTasks = async (
  tasks: readonly BootTask[],
  onProgress?: (fraction: number, pendingId: string | undefined) => void,
): Promise<BootReport> => {
  const settled = new Set<string>();
  const outcomes = await Promise.all(
    tasks.map(async (task): Promise<BootTaskOutcome> => {
      let outcome: BootTaskOutcome;
      try {
        await task.run();
        outcome = { id: task.id, critical: task.critical, ok: true };
      } catch (error) {
        // Registrado SEMPRE, critico ou nao. Uma reserva que entra sem deixar
        // rastro e um defeito que ninguem vai encontrar depois.
        console.warn(`[boot] tarefa falhou: ${task.id}`, error);
        outcome = { id: task.id, critical: task.critical, ok: false, error };
      }
      settled.add(task.id);
      onProgress?.(bootProgress(tasks, settled), heaviestPending(tasks, settled));
      return outcome;
    }),
  );
  return {
    outcomes,
    criticalFailed: outcomes.some((o) => o.critical && !o.ok),
    degraded: outcomes.filter((o) => !o.critical && !o.ok).map((o) => o.id),
  };
};

/**
 * Um teto por tarefa, para que uma promessa que nunca resolve nao possa
 * prender a abertura.
 *
 * O caso real nao e hipotetico: um `Image` cujo `onload`/`onerror` nunca
 * dispara (aba em segundo plano num momento infeliz, resposta pendurada por um
 * proxy) deixaria a barra parada para sempre — exatamente o "LOADING 87%"
 * eterno que esta feature nao pode produzir. Estourado o prazo, a tarefa conta
 * como FALHA (e nao como sucesso): critica, isso leva a tela de erro com nova
 * tentativa; nao critica, o jogo segue com a reserva e o console registra.
 */
export const withBootTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[boot] tempo esgotado: ${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/** Teto padrao de uma tarefa de boot. Generoso: e rede de 3G, nao de escritorio. */
export const BOOT_TASK_TIMEOUT_MS = 20_000;
