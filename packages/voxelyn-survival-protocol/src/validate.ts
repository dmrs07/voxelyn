import type { PlayerCommand } from '@voxelyn/survival-sim';
import { LIMITS } from './messages';
import type {
  ClientCommand,
  ClientHeartbeat,
  ClientHello,
  ClientMessage,
  ClientResyncRequest,
} from './messages';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Sanitiza um comando de intencao vindo da rede. Coordenadas sao coeridas a faixas seguras. */
export const validatePlayerCommand = (raw: unknown): ValidationResult<PlayerCommand> => {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'command nao e objeto' };
  const c = raw as Record<string, unknown>;

  const move = c.move as Record<string, unknown> | undefined;
  const aim = c.aim as Record<string, unknown> | undefined;
  if (!move || !isFiniteNumber(move.x) || !isFiniteNumber(move.y)) {
    return { ok: false, reason: 'move invalido' };
  }
  if (!aim || !isFiniteNumber(aim.x) || !isFiniteNumber(aim.y)) {
    return { ok: false, reason: 'aim invalido' };
  }
  // intencoes booleanas: qualquer coisa que nao for boolean vira false
  const clampUnit = (n: number): number => (n > 1 ? 1 : n < -1 ? -1 : n);
  // a sim normaliza move/aim, mas limitamos magnitudes absurdas contra overflow
  const clampBig = (n: number): number => (n > 1e6 ? 1e6 : n < -1e6 ? -1e6 : n);

  const choose = c.choose;
  const validChoose = choose === 0 || choose === 1 || choose === null || choose === undefined;

  const value: PlayerCommand = {
    move: { x: clampUnit(move.x as number), y: clampUnit(move.y as number) },
    aim: { x: clampBig(aim.x as number), y: clampBig(aim.y as number) },
    fire: isBool(c.fire) ? c.fire : false,
    ability: isBool(c.ability) ? c.ability : false,
    dodge: isBool(c.dodge) ? c.dodge : false,
    interact: isBool(c.interact) ? c.interact : false,
    consume: isBool(c.consume) ? c.consume : false,
    choose: validChoose ? ((choose ?? null) as 0 | 1 | null) : null,
  };
  return { ok: true, value };
};

export const validateClientMessage = (raw: unknown): ValidationResult<ClientMessage> => {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'mensagem nao e objeto' };
  const m = raw as Record<string, unknown>;

  switch (m.t) {
    case 'hello': {
      const versions = m.versions as Record<string, unknown> | undefined;
      if (
        !versions ||
        !isFiniteNumber(versions.protocolVersion) ||
        !isFiniteNumber(versions.simulationVersion) ||
        !isFiniteNumber(versions.contentVersion)
      ) {
        return { ok: false, reason: 'hello.versions invalido' };
      }
      const hello: ClientHello = {
        t: 'hello',
        versions: {
          protocolVersion: versions.protocolVersion as number,
          simulationVersion: versions.simulationVersion as number,
          contentVersion: versions.contentVersion as number,
        },
        resumeToken: typeof m.resumeToken === 'string' ? m.resumeToken.slice(0, 128) : undefined,
        displayName: typeof m.displayName === 'string' ? m.displayName.slice(0, 32) : undefined,
      };
      return { ok: true, value: hello };
    }
    case 'cmd': {
      if (!isFiniteNumber(m.seq) || !isFiniteNumber(m.clientTick)) {
        return { ok: false, reason: 'cmd.seq/clientTick invalido' };
      }
      if (!Array.isArray(m.commands)) return { ok: false, reason: 'cmd.commands nao e array' };
      if (m.commands.length > LIMITS.maxCommandsPerMessage) {
        return { ok: false, reason: 'cmd.commands excede o limite' };
      }
      const commands: PlayerCommand[] = [];
      for (const rawCmd of m.commands) {
        const res = validatePlayerCommand(rawCmd);
        if (!res.ok) return { ok: false, reason: `cmd invalido: ${res.reason}` };
        commands.push(res.value);
      }
      const cmd: ClientCommand = {
        t: 'cmd',
        seq: Math.floor(m.seq as number),
        clientTick: Math.floor(m.clientTick as number),
        commands,
      };
      return { ok: true, value: cmd };
    }
    case 'ping': {
      if (!isFiniteNumber(m.seq) || !isFiniteNumber(m.clientTimeMs)) {
        return { ok: false, reason: 'ping invalido' };
      }
      const ping: ClientHeartbeat = {
        t: 'ping',
        seq: Math.floor(m.seq as number),
        clientTimeMs: m.clientTimeMs as number,
      };
      return { ok: true, value: ping };
    }
    case 'resync': {
      const resync: ClientResyncRequest = {
        t: 'resync',
        reason: typeof m.reason === 'string' ? m.reason.slice(0, 128) : 'unspecified',
      };
      return { ok: true, value: resync };
    }
    default:
      return { ok: false, reason: `tipo de mensagem desconhecido: ${String(m.t)}` };
  }
};

/**
 * Deduplicacao + ordenacao por sequencia, por cliente. O servidor descarta
 * comandos repetidos ou fora de ordem, mantendo a ultima seq processada.
 */
export class SequenceGate {
  private lastSeq = -1;

  /** Retorna true se a mensagem deve ser processada (nova e em ordem). */
  accept(seq: number): boolean {
    if (seq <= this.lastSeq) return false;
    this.lastSeq = seq;
    return true;
  }

  get ackSeq(): number {
    return this.lastSeq;
  }
}

/** Rate limiter de janela deslizante simples (por conexao). */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly maxPerWindow: number,
    private readonly windowMs: number
  ) {}

  /** Retorna true se permitido; false se estourou o limite. */
  allow(nowMs: number): boolean {
    const cutoff = nowMs - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
    if (this.timestamps.length >= this.maxPerWindow) return false;
    this.timestamps.push(nowMs);
    return true;
  }
}
