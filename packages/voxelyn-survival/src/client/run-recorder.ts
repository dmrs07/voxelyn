// Gravacao do que o jogador pressionou, para o leaderboard poder verificar.
//
// A regra que este arquivo existe para respeitar esta em `command-log.ts`: o
// comando gravado tem de ser EXATAMENTE o comando simulado. Por isso o
// recorder nao "observa" o loop de lado — ele fica NO CAMINHO:
//
//     const cmd = recorder.capture(input.snapshot(...));
//     stepRun(state, [cmd]);
//
// `capture` devolve o comando ja quantizado, e e esse que vai para a
// simulacao. Gravar de um lado e simular de outro produziria um log que, ao ser
// re-simulado no servidor, diverge do que o jogador viveu — e a run honesta
// voltaria recusada como fraude. Colocar o recorder no caminho torna esse bug
// impossivel em vez de improvavel.

import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import type { PlayerCommand, PlayerTuning, RunDepthConfig } from '@voxelyn/survival-sim';

/**
 * Teto de ticks gravados. 30 minutos a 20 Hz — o mesmo do servidor.
 *
 * Duplicado de proposito, e nao importado: o cliente nao pode depender de o
 * servidor estar acessivel para saber quando parar de acumular memoria. Se os
 * dois divergirem, o servidor recusa e o cliente perde uma submissao — que e a
 * falha certa, e nao um vazamento de memoria numa aba aberta a horas.
 */
export const MAX_RECORDED_TICKS = 30 * 60 * 20;

export class RunRecorder {
  private commands: PlayerCommand[] = [];
  private seed = 0;
  private overflowed = false;

  /** Comeca a gravar uma run nova. */
  start(seed: number): void {
    this.commands = [];
    this.seed = seed;
    this.overflowed = false;
  }

  /**
   * Grava o comando e devolve a versao que DEVE ser simulada.
   *
   * Depois do teto, continua devolvendo o comando quantizado (o jogo nao pode
   * parar) mas deixa de acumular e marca a gravacao como perdida. Uma run de
   * mais de 30 minutos nao entra no ranking; ela ainda e jogavel.
   */
  capture(cmd: PlayerCommand): PlayerCommand {
    const quantized = quantizeCommand(cmd);
    if (this.commands.length >= MAX_RECORDED_TICKS) {
      this.overflowed = true;
      return quantized;
    }
    this.commands.push(quantized);
    return quantized;
  }

  get tickCount(): number {
    return this.commands.length;
  }

  /** A gravacao pode ser submetida? Falso quando estourou o teto. */
  get submittable(): boolean {
    return !this.overflowed && this.commands.length > 0;
  }

  get recordedSeed(): number {
    return this.seed;
  }

  encode(): string {
    return toBase64(encodeCommandLog(this.commands));
  }
}

export type SubmitOutcome =
  | { ok: true; duplicate: boolean }
  /** `reason` é código de diagnóstico em ASCII — ver `DeathEchoSubmitOutcome`. */
  | { ok: false; reason: string };

/**
 * Envia a gravacao para verificacao.
 *
 * Repare no que NAO e enviado: tempo, estrelas, abates. Nada de resultado. O
 * servidor re-simula e descobre sozinho — ver `replay.ts` no servidor. Isto
 * aqui e literalmente "aqui esta o que eu apertei, me diga o que aconteceu".
 *
 * @param runId O ticket que autorizou esta descida, quando houve um.
 *
 * Ele NAO carrega resultado nenhum — carrega identidade. O servidor le dele com
 * quantos setores e com quais atributos a run foi autorizada a rodar, e e assim
 * que uma descida de sete setores e verificada contra sete setores e entra no
 * livro de sete. Sem ticket (offline, servidor sem progressao) a run e
 * verificada como a descida de fabrica, que e o que ela foi.
 */
export const submitRun = async (
  serverUrl: string,
  recorder: RunRecorder,
  name: string,
  runId?: string | null,
): Promise<SubmitOutcome> => {
  if (!recorder.submittable) return { ok: false, reason: 'run-too-long' };
  // O endpoint e HTTP; a URL de jogo e WebSocket.
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/leaderboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        seed: recorder.recordedSeed,
        log: recorder.encode(),
        name,
        ...(runId ? { runId } : {}),
      }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error ?? `server-${res.status}` };
    }
    const body = (await res.json()) as { duplicate?: boolean };
    return { ok: true, duplicate: body.duplicate === true };
  } catch (err) {
    // Offline e o caso NORMAL aqui: o solo funciona sem rede, e o PWA existe
    // justamente para isso. Falhar em silencio seria pior que dizer que nao
    // deu, mas nao e erro de jogo.
    return { ok: false, reason: err instanceof Error ? err.message : 'network-error' };
  }
};

export type RankEntry = {
  id: number;
  name: string;
  seed: number;
  stars: number;
  ticks: number;
  phase: string;
  mode: string;
  kills: number;
  /** Nucleos extraidos: o primeiro criterio da pontuacao. */
  cores: number;
  /** Setores atravessados: a classe do livro em que a run compete. */
  sectorCount: number;
  /** Ha um replay autoritativo guardado para esta linha? Ver `fetchReplay`. */
  replayAvailable: boolean;
};

/** Um livro do ranking: uma profundidade de descida e quantas runs tem. */
export type RankClass = {
  sectorCount: number;
  entries: number;
};

/**
 * O livro pedido, os livros que existem, e as runs do livro pedido.
 *
 * `classes` vem junto da lista, e nao de uma segunda chamada, porque o seletor
 * e a lista tem de descrever o mesmo instante: buscados em separado, uma aba
 * podia aparecer para um livro que a lista ao lado ja nao enxergava.
 */
export type RankPage = {
  sectorCount: number;
  classes: RankClass[];
  entries: RankEntry[];
  /** A Aurix nao respondeu (offline, fora do ar, erro). Um livro vazio de
   *  verdade vem SEM esta marca — e a tela diz uma coisa ou outra. */
  unreachable?: boolean;
};

/** Offline, ou servidor fora: nenhum livro, nenhuma aba. Nunca um erro na tela. */
const EMPTY_PAGE: RankPage = { sectorCount: 0, classes: [], entries: [], unreachable: true };

export const fetchLeaderboard = async (
  serverUrl: string,
  query: { seed?: number; limit?: number; sectorCount?: number } = {},
): Promise<RankPage> => {
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (query.seed !== undefined) params.set('seed', String(query.seed));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.sectorCount !== undefined) params.set('sectors', String(query.sectorCount));
  try {
    const res = await fetch(`${base}/leaderboard?${params.toString()}`);
    if (!res.ok) return EMPTY_PAGE;
    const body = (await res.json()) as Partial<RankPage>;
    return {
      // O servidor decide qual livro respondeu — inclusive quando o cliente nao
      // pediu nenhum. Assumir aqui o que foi pedido faria a aba ativa mentir na
      // primeira abertura, que e justamente quando o cliente nao pede nada.
      sectorCount: body.sectorCount ?? query.sectorCount ?? 0,
      classes: body.classes ?? [],
      entries: body.entries ?? [],
    };
  } catch {
    return EMPTY_PAGE;
  }
};

/** O que `fetchReplay` devolve: o bastante para re-simular a run e assistir. */
export type ReplayPayload = {
  seed: number;
  log: string;
  tuning?: PlayerTuning;
  depth?: RunDepthConfig;
};

/**
 * Busca o replay de UMA linha do ranking.
 *
 * `null` cobre offline, servidor fora, e a run genuinamente nao ter log
 * (co-op, ou gravada antes de este endpoint existir) — os tres sao "sem
 * replay para mostrar", nao um erro que o jogador precise ler.
 */
export const fetchReplay = async (serverUrl: string, id: number): Promise<ReplayPayload | null> => {
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/leaderboard/${id}/replay`);
    if (!res.ok) return null;
    return (await res.json()) as ReplayPayload;
  } catch {
    return null;
  }
};
