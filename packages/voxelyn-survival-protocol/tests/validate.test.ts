import { describe, expect, it } from 'vitest';
import {
  RateLimiter,
  SequenceGate,
  checkProtocolVersion,
  CURRENT_VERSIONS,
  decodeMessage,
  decodeClientMessage,
  encodeMessage,
  LIMITS,
  validateClientMessage,
  validatePlayerCommand,
} from '../src/index';

describe('versionamento', () => {
  it('aceita versoes atuais e rejeita divergencia com o campo culpado', () => {
    expect(checkProtocolVersion(CURRENT_VERSIONS)).toEqual({ ok: true });
    const bad = checkProtocolVersion({ ...CURRENT_VERSIONS, protocolVersion: 999 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.field).toBe('protocolVersion');
  });
});

describe('validacao de comando (cliente nao pode afirmar fatos)', () => {
  it('sanitiza intencoes e coage magnitudes de movimento', () => {
    const res = validatePlayerCommand({
      move: { x: 5, y: -9 },
      aim: { x: 0.3, y: 0.7 },
      fire: true,
      // campos maliciosos extras sao ignorados: cliente nao decide hp/dano
      hp: 9999,
      damage: 9999,
      killed: [1, 2, 3],
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.move.x).toBe(1); // coerido para [-1,1]
      expect(res.value.move.y).toBe(-1);
      expect(res.value.fire).toBe(true);
      expect(res.value.ability).toBe(false);
      // nenhuma propriedade fora de PlayerCommand sobrevive
      expect(Object.keys(res.value).sort()).toEqual(
        ['ability', 'aim', 'choose', 'dodge', 'fire', 'interact', 'move', 'purge'].sort()
      );
    }
  });

  it('rejeita comando com numeros nao finitos', () => {
    expect(validatePlayerCommand({ move: { x: NaN, y: 0 }, aim: { x: 1, y: 0 } }).ok).toBe(false);
    expect(validatePlayerCommand({ move: { x: 0, y: 0 }, aim: { x: Infinity, y: 0 } }).ok).toBe(false);
    expect(validatePlayerCommand(null).ok).toBe(false);
    expect(validatePlayerCommand('mover para 5,5').ok).toBe(false);
  });

  it('valida mensagens cmd e limita a quantidade de comandos por mensagem', () => {
    const good = validateClientMessage({
      t: 'cmd',
      seq: 3,
      clientTick: 60,
      commands: [{ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 } }],
    });
    expect(good.ok).toBe(true);

    const flood = validateClientMessage({
      t: 'cmd',
      seq: 4,
      clientTick: 61,
      commands: new Array(50).fill({ move: { x: 0, y: 0 }, aim: { x: 1, y: 0 } }),
    });
    expect(flood.ok).toBe(false);
  });

  it('decodeMessage nunca lanca em entrada invalida', () => {
    expect(decodeMessage('{lixo')).toBeNull();
    expect(decodeMessage('42')).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'ping', seq: 1, clientTimeMs: 10 }))).not.toBeNull();
  });
});

describe('deduplicacao e rate limit', () => {
  it('SequenceGate aceita apenas sequencias novas e crescentes', () => {
    const gate = new SequenceGate();
    expect(gate.accept(1)).toBe(true);
    expect(gate.accept(2)).toBe(true);
    expect(gate.accept(2)).toBe(false); // duplicata
    expect(gate.accept(1)).toBe(false); // fora de ordem
    expect(gate.accept(5)).toBe(true);
    expect(gate.ackSeq).toBe(5);
  });

  it('RateLimiter bloqueia rajadas acima do limite na janela', () => {
    const rl = new RateLimiter(3, 1000);
    expect(rl.allow(0)).toBe(true);
    expect(rl.allow(100)).toBe(true);
    expect(rl.allow(200)).toBe(true);
    expect(rl.allow(300)).toBe(false); // 4a na mesma janela
    expect(rl.allow(1300)).toBe(true); // janela deslizou
  });
});

describe('limites de payload: ingresso vs egresso', () => {
  it('o limite de comando NAO pode descartar um full_resync', () => {
    // full_resync leva o grid inteiro: ~290 KB num mundo 96x96
    const big = encodeMessage({
      t: 'full_resync',
      serverTick: 10,
      seed: 1,
      chunkDiffs: Array.from({ length: 36 }, (_, i) => ({
        chunk: i,
        version: 1,
        solid: Array.from({ length: 256 }, () => 1),
        surface: Array.from({ length: 256 }, () => 0),
      })),
      entities: [],
      projectiles: [],
      you: { slot: 0, heat: 0, purgeCells: 1, activeModules: [], pendingModuleChoice: null, hasCore: false, downed: false, aimX: 1, aimY: 0, overheated: false },
      world: { salvageSites: [], coreTaken: false, bossAwake: false },
      authHash: 'deadbeef',
    } as never);
    expect(big.length).toBeGreaterThan(LIMITS.maxClientMessageBytes);

    // cliente aceita frames do servidor (antes: descartava TODO resync)
    expect(decodeMessage(big)).not.toBeNull();
    // servidor segue apertado contra entrada nao confiavel
    expect(decodeClientMessage(big)).toBeNull();
  });

  it('o teto de egresso ainda existe (peer hostil nao e ilimitado)', () => {
    const absurd = `{"t":"snapshot","pad":"${'x'.repeat(LIMITS.maxServerMessageBytes)}"}`;
    expect(decodeMessage(absurd)).toBeNull();
  });
});
