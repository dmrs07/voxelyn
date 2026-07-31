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
import type { PlayerCommand } from '@voxelyn/survival-sim';

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
 */
export const submitRun = async (
  serverUrl: string,
  recorder: RunRecorder,
  name: string,
): Promise<SubmitOutcome> => {
  if (!recorder.submittable) return { ok: false, reason: 'run-too-long' };
  // O endpoint e HTTP; a URL de jogo e WebSocket.
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/leaderboard`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: recorder.recordedSeed, log: recorder.encode(), name }),
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
};

export const fetchLeaderboard = async (
  serverUrl: string,
  query: { seed?: number; limit?: number } = {},
): Promise<RankEntry[]> => {
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (query.seed !== undefined) params.set('seed', String(query.seed));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  try {
    const res = await fetch(`${base}/leaderboard?${params.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as { entries?: RankEntry[] };
    return body.entries ?? [];
  } catch {
    return [];
  }
};
