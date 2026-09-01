// Os logs das SUAS ultimas descidas, guardados neste aparelho.
//
// O ranking guarda o log das runs que EXTRAIRAM, no servidor, porque la ele e
// prova: a linha do livro so existe porque aquele log foi re-simulado. Aqui a
// pergunta e outra e mais simples — "quero rever a descida em que eu morri" —,
// e morte nao sobe para lugar nenhum. Ou o log fica no aparelho, ou aquela run
// nao pode ser revista por ninguem, nunca.
//
// O QUE ISTO NAO E. Nao e homologacao. Nada daqui foi verificado por servidor
// nenhum, e por isso o replay local nunca se anuncia como autoritativo (ver
// `replay.badge.local`): ele e a MESMA simulacao deterministica rodando o log
// que este cliente gravou. Fiel ao que foi jogado, e sem nenhuma autoridade
// sobre o que aconteceu — que e exatamente o que um replay local pode ser.
//
// Guardado FORA de `voxelyn.records`, e nao dentro: aquele objeto e lido e
// reescrito inteiro ao fim de toda run, e enfia-lo com centenas de KB de log
// faria cada morte pagar a serializacao do historico inteiro. Chaves separadas
// tambem deixam o pior caso ser o certo — estourar a cota derruba os replays,
// nunca o historico.

import { SIMULATION_VERSION } from '@voxelyn/survival-protocol';
import type { PlayerTuning, RunDepthConfig } from '@voxelyn/survival-sim';

const KEY = 'voxelyn.replays';

/** Ver `records.ts`: schema desconhecido e DESCARTADO, nunca migrado. */
const SCHEMA = 1;

/**
 * Quantas descidas ficam com log guardado.
 *
 * Oito, que e exatamente quantas o Registro mostra no HISTORICO. Guardar mais
 * do que a tela oferece seria pagar cota por linha que ninguem alcanca; guardar
 * menos deixaria uma linha visivel com um botao que ja sumiu.
 */
export const MAX_LOCAL_REPLAYS = 8;

/**
 * Teto de bytes do conjunto inteiro.
 *
 * `localStorage` da ~5 MB para a ORIGEM TODA, e nesta origem tambem moram os
 * records, as opcoes, o cache de progressao e o pool de ecos. Um megabyte e a
 * fatia que os replays podem ocupar sem ameacar nenhum deles — e como um log
 * de descida longa passa de 100 KB em base64, o teto de bytes cai antes do
 * teto de oito em quem joga sessoes longas. Os dois existem por isso.
 */
export const MAX_LOCAL_REPLAY_BYTES = 1024 * 1024;

export type LocalReplay = {
  /** `runSummaryIdentity` da run: seed, fase e ticks. Ver `records.ts`. */
  identity: string;
  seed: number;
  /** O log gravado, em base64 — o mesmo que o `RunRecorder` submeteria. */
  log: string;
  tuning?: PlayerTuning;
  depth?: RunDepthConfig;
  /**
   * A simulacao que rodou esta run.
   *
   * Mesma regra do servidor (ver `leaderboard.ts`): um log so significa alguma
   * coisa contra a simulacao que o produziu. Depois de um bump, o log antigo
   * nao quebra — ele conta uma descida DIFERENTE, e a tela chamaria isso de
   * replay da sua morte. Guardar a versao e o que permite recusar.
   */
  simulationVersion: number;
  /** Quando foi guardado. So ordena a poda; nao aparece na tela. */
  savedAt: number;
};

type Stored = { schema: number; runs: LocalReplay[] };

const isReplay = (value: unknown): value is LocalReplay => {
  const run = value as Partial<LocalReplay> | null;
  return (
    typeof run === 'object' &&
    run !== null &&
    typeof run.identity === 'string' &&
    typeof run.seed === 'number' &&
    typeof run.log === 'string' &&
    typeof run.simulationVersion === 'number' &&
    typeof run.savedAt === 'number'
  );
};

/** Tudo que esta guardado, do mais novo para o mais velho. Nunca lanca. */
export const loadLocalReplays = (): LocalReplay[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const stored = parsed as Stored | null;
    if (!stored || stored.schema !== SCHEMA || !Array.isArray(stored.runs)) return [];
    return stored.runs.filter(isReplay);
  } catch {
    // JSON corrompido, ou storage bloqueado (aba privativa). Sem replay local e
    // um estado legitimo do jogo; falhar aqui nao e.
    return [];
  }
};

/**
 * Corta a lista ate caber nos dois tetos, sempre sacrificando a mais velha.
 *
 * A run que acabou de terminar e a que o jogador tem mais chance de querer
 * rever, e por isso ela entra na frente e sai por ultimo.
 */
const prune = (runs: LocalReplay[]): LocalReplay[] => {
  const kept = runs.slice(0, MAX_LOCAL_REPLAYS);
  while (
    kept.length > 1 &&
    JSON.stringify({ schema: SCHEMA, runs: kept }).length > MAX_LOCAL_REPLAY_BYTES
  ) {
    kept.pop();
  }
  return kept;
};

/**
 * Escreve cedendo espaco enquanto o escritor recusar. `null` = nem a nova coube.
 *
 * O escritor entra por PARAMETRO, e nao como `localStorage` direto, pelo motivo
 * que `arena-conclusion.ts` ja documenta: o cenario que mais importa provar
 * aqui — a cota estourando no meio — nao pode depender de conseguir fazer o
 * `localStorage` do ambiente de teste recusar uma escrita. Com o escritor
 * injetado, a POLITICA (podar e tentar de novo, sacrificando sempre a mais
 * velha) e testavel sem DOM nenhum.
 */
export const writeWithBudget = (
  runs: readonly LocalReplay[],
  write: (runs: LocalReplay[]) => void,
): LocalReplay[] | null => {
  let attempt = prune([...runs]);
  for (;;) {
    try {
      write(attempt);
      return attempt;
    } catch {
      if (attempt.length <= 1) return null;
      attempt = attempt.slice(0, attempt.length - 1);
    }
  }
};

/**
 * Guarda o log de uma descida terminada. Devolve o que ficou guardado.
 *
 * Falhar aqui e SILENCIOSO de proposito, e o silencio tem limite: se a cota
 * estourar, a lista e podada e a gravacao tentada de novo, ate sobrar so a run
 * nova. Perder replay antigo para guardar o recem-jogado e a troca certa; o que
 * nao pode acontecer e a tela de resultado quebrar porque o storage encheu.
 */
export const saveLocalReplay = (
  entry: Omit<LocalReplay, 'savedAt' | 'simulationVersion'> & { simulationVersion?: number },
): LocalReplay[] => {
  const fresh: LocalReplay = {
    ...entry,
    simulationVersion: entry.simulationVersion ?? SIMULATION_VERSION,
    savedAt: Date.now(),
  };
  // Reenvio da mesma run (a fase terminal persiste e o laco continua desenhando)
  // atualiza no lugar em vez de duplicar.
  const others = loadLocalReplays().filter((run) => run.identity !== fresh.identity);
  const written = writeWithBudget([fresh, ...others], (runs) => {
    localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, runs }));
  });
  // Nem a run nova coube. Deixa o que ja estava guardado em paz e desiste: um
  // replay a menos e o preco, e ele e menor que o de apagar o resto.
  return written ?? loadLocalReplays();
};

/**
 * O replay de uma descida, ou `null` quando nao ha um que ESTA simulacao rode.
 *
 * A comparacao de versao mora aqui e em `replayableIdentities`, que e a mesma
 * conta: a linha oferecer o botao e a pagina de replay achar o log tem de ser a
 * mesma pergunta.
 */
export const findLocalReplay = (identity: string): LocalReplay | null => {
  const found = loadLocalReplays().find((run) => run.identity === identity);
  return found && found.simulationVersion === SIMULATION_VERSION ? found : null;
};

/** As descidas que podem ser revistas agora. Uma leitura so, para a lista toda. */
export const replayableIdentities = (): Set<string> => {
  const ids = new Set<string>();
  for (const run of loadLocalReplays()) {
    if (run.simulationVersion === SIMULATION_VERSION) ids.add(run.identity);
  }
  return ids;
};
