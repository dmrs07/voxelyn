import { describe, expect, it } from 'vitest';
import {
  CURRENT_VERSIONS,
  SIMULATION_VERSION,
  buildDeathEchoCapsule,
  deathEchoContract,
  type DeathEchoCapsule,
} from '@voxelyn/survival-protocol';
import { createRun, emptyCommand, stepRun, type PlayerCommand } from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import {
  DEATH_ECHO_MAX_MANIFESTS,
  DEATH_ECHO_MIN_TICKS,
  MemoryDeathEchoStore,
  isDeathEchoEligible,
} from '../src/death-echoes';
import { DEATH_ECHO_ACCEPT_ONE_IN, isDeathEchoSampled } from '../src/death-echoes-http';
import { verifySoloDeath } from '../src/replay';
import { SurvivalServer, type PlayerDeath } from '../src/server';
import { createVerificationBudget } from '../src/http-util';

const capsule = (over: Partial<DeathEchoCapsule> = {}): DeathEchoCapsule => ({
  id: 'pool:abc:1',
  sourceSeed: 42,
  sourceSimulationVersion: SIMULATION_VERSION,
  sourceContentVersion: 7,
  sector: 1,
  sourceWidth: 96,
  sourceHeight: 96,
  sourceX: 30,
  sourceY: 40,
  progressQ: 128,
  openness: 5,
  surface: 0,
  nearOre: false,
  facingX: 1,
  facingY: 0,
  cause: { kind: 'fire' },
  ticks: DEATH_ECHO_MIN_TICKS + 100,
  ...over,
});

describe('pool de ecos em memoria', () => {
  it('deduplica pela run de origem', async () => {
    const store = new MemoryDeathEchoStore();
    expect(await store.record({ capsule: capsule(), origin: 'solo', sourceDigest: 'run-1' })).toBe(true);
    expect(await store.record({ capsule: capsule({ id: 'outro' }), origin: 'solo', sourceDigest: 'run-1' })).toBe(false);
    expect(store.size()).toBe(1);
  });

  it('recusa morte curta demais para contar uma historia', async () => {
    const store = new MemoryDeathEchoStore();
    const short = capsule({ ticks: DEATH_ECHO_MIN_TICKS - 1 });
    expect(isDeathEchoEligible(short)).toBe(false);
    expect(await store.record({ capsule: short, origin: 'solo', sourceDigest: 'curta' })).toBe(false);
    expect(store.size()).toBe(0);
  });

  it('amostra por setor e espalha a exposicao pelo menos manifestado', async () => {
    const store = new MemoryDeathEchoStore();
    for (let i = 0; i < 4; i++) {
      await store.record({
        capsule: capsule({ id: `e${i}`, sector: 1 }),
        origin: 'solo',
        sourceDigest: `d${i}`,
      });
    }
    await store.record({
      capsule: capsule({ id: 'outro-setor', sector: 2 }),
      origin: 'solo',
      sourceDigest: 'd-setor',
    });

    const first = await store.sample({ sector: 1, limit: 2 });
    expect(first.map((e) => e.id)).toEqual(['e0', 'e1']);
    // Os dois primeiros ja foram manifestados: a proxima amostra pega os outros.
    const second = await store.sample({ sector: 1, limit: 2 });
    expect(second.map((e) => e.id)).toEqual(['e2', 'e3']);
    // Setor nao pedido nunca aparece: a projecao e por setor.
    expect((await store.sample({ sector: 2 })).map((e) => e.id)).toEqual(['outro-setor']);
  });

  it('restringe a seed do contrato, que e o que devolve a coordenada real', async () => {
    const store = new MemoryDeathEchoStore();
    await store.record({ capsule: capsule({ id: 'da-seed', sourceSeed: 777 }), origin: 'solo', sourceDigest: 'a' });
    await store.record({ capsule: capsule({ id: 'de-outra', sourceSeed: 888 }), origin: 'solo', sourceDigest: 'b' });
    const sample = await store.sample({ sector: 1, seed: 777 });
    expect(sample.map((e) => e.id)).toEqual(['da-seed']);
  });

  it('expira o eco depois de manifestado algumas vezes', async () => {
    const store = new MemoryDeathEchoStore();
    await store.record({ capsule: capsule({ id: 'gasto' }), origin: 'solo', sourceDigest: 'x' });
    for (let i = 0; i < DEATH_ECHO_MAX_MANIFESTS; i++) {
      expect(await store.sample({ sector: 1 })).toHaveLength(1);
    }
    // Uma carcaça que reaparece para sempre deixa de ser ocorrência e vira mobília.
    expect(await store.sample({ sector: 1 })).toEqual([]);
  });
});

describe('fracao deterministica de aceitacao', () => {
  it('nao e escolha do cliente e aceita uma fracao das mortes', () => {
    let accepted = 0;
    const total = 400;
    for (let i = 0; i < total; i++) {
      if (isDeathEchoSampled(i, `log-${i}`)) accepted += 1;
    }
    // Aproximadamente 1 em DEATH_ECHO_ACCEPT_ONE_IN. A folga e estreita de
    // proposito: e ela que denuncia um hash cujos bits baixos nao espalham, que foi
    // exatamente o defeito que o finalizador do murmur3 existe para corrigir.
    const expected = total / DEATH_ECHO_ACCEPT_ONE_IN;
    expect(accepted).toBeGreaterThan(expected * 0.65);
    expect(accepted).toBeLessThan(expected * 1.35);
  });

  it('e estavel para o mesmo par seed+log', () => {
    expect(isDeathEchoSampled(9, 'AAAA')).toBe(isDeathEchoSampled(9, 'AAAA'));
  });
});

/**
 * Uma run solo que morre de verdade, e o log dela.
 *
 * Sem nenhuma entrada a contaminação sobe até o teto e o Prospector morre — é a
 * morte mais barata de produzir e a única que não depende de balanceamento de
 * inimigo. LANÇA em vez de devolver null: um fixture que falha em silêncio
 * transformaria os testes abaixo em no-ops verdes, que é pior do que não tê-los.
 */
const suicideLog = (seed: number): { seed: number; log: string } => {
  const state = createRun({ seed, playerCount: 1 });
  const commands: PlayerCommand[] = [];
  const buffer: PlayerCommand[] = [emptyCommand()];
  for (let i = 0; i < 30 * 60 * 20 && state.phase === 'running'; i++) {
    const cmd = quantizeCommand(emptyCommand());
    commands.push(cmd);
    buffer[0] = cmd;
    stepRun(state, buffer);
  }
  if (state.phase !== 'dead') {
    throw new Error(`fixture nao morreu: fase ${state.phase}`);
  }
  return { seed, log: toBase64(encodeCommandLog(commands)) };
};

describe('verificacao da morte solo por re-simulacao', () => {
  it('constroi a capsula a partir do log, sem campo para o cliente mentir', () => {
    const fixture = suicideLog(0x51ee0);
    const verdict = verifySoloDeath(fixture.seed, fixture.log);
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(verdict.capsule.sourceSeed).toBe(fixture.seed);
    expect(verdict.capsule.ticks).toBeGreaterThan(0);
    // O id é derivado do digest: anônimo por construção.
    expect(verdict.capsule.id).toBe(`pool:${verdict.digest}:${verdict.capsule.sector}`);
    expect(verdict.capsule.id).not.toContain('anônimo');
    // O rastro sai da re-simulação, e o passo dele é do TICK e não do relógio de
    // quadro do cliente.
    expect(verdict.capsule.finalTrace).toBeDefined();
    expect(verdict.capsule.finalTrace?.stepMs).toBe(100);
    expect(verdict.capsule.finalTrace?.dx.length).toBe(verdict.capsule.finalTrace?.aim.length);
  });

  it('recusa log que nao terminou em morte', () => {
    const verdict = verifySoloDeath(1, toBase64(encodeCommandLog([quantizeCommand(emptyCommand())])));
    expect(verdict.ok).toBe(false);
  });

  it('recusa seed e log invalidos antes de simular', () => {
    expect(verifySoloDeath(-1, 'AAAA').ok).toBe(false);
    expect(verifySoloDeath(1, '!!!nao-base64!!!').ok).toBe(false);
    expect(verifySoloDeath(1, '').ok).toBe(false);
  });
});

describe('captura autoritativa no co-op', () => {
  it('associa causa e posicao por slot no tick da morte', () => {
    const deaths: PlayerDeath[] = [];
    const server = new SurvivalServer({
      maxPlayersPerRoom: 1,
      baseSeed: 4242,
      onPlayerDeath: (_room, death) => deaths.push(death),
    });
    server.addConnection('a', 0);
    server.handleMessage('a', JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS }), 0);
    const room = server.roomForClient('a');
    expect(room).not.toBeNull();

    const player = room!.state.players[0];
    room!.state.playerExtras[0].lastDamage = {
      cause: { kind: 'enemy_contact', archetype: 'bruiser', elite: false },
      tick: room!.state.tick,
    };
    player.hp = 0;
    const before = { x: player.x, y: player.y };
    server.tick();

    expect(deaths).toHaveLength(1);
    // A causa é a do SLOT, não a que encerrou a sala: é exatamente a associação
    // que o cliente não consegue provar sozinho.
    expect(deaths[0].cause).toEqual({
      kind: 'enemy_contact', archetype: 'bruiser', elite: false,
    });
    expect(deaths[0].slot).toBe(0);
    expect(deaths[0].x).toBeCloseTo(before.x, 5);
    expect(deaths[0].sector).toBe(1);

    // A cápsula construída daí projeta como qualquer outra.
    const built = buildDeathEchoCapsule(room!.state, {
      id: `coop:${room!.seed}:1:${deaths[0].tick}:0`,
      x: deaths[0].x,
      y: deaths[0].y,
      facingX: deaths[0].facingX,
      facingY: deaths[0].facingY,
      cause: deaths[0].cause,
      ticks: deaths[0].tick,
    });
    expect(built.sector).toBe(1);
    expect(built.finalTrace).toBeUndefined();
  });

  it('nao captura morte sem causa autoritativa', () => {
    const deaths: PlayerDeath[] = [];
    const server = new SurvivalServer({
      maxPlayersPerRoom: 1,
      baseSeed: 99,
      onPlayerDeath: (_room, death) => deaths.push(death),
    });
    server.addConnection('a', 0);
    server.handleMessage('a', JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS }), 0);
    const room = server.roomForClient('a');
    room!.state.playerExtras[0].lastDamage = null;
    room!.state.players[0].hp = 0;
    server.tick();
    // Ausência é melhor que `unknown`: uma carcaça que não sabe do que morreu não
    // ensina nada e ainda ocupa a única vaga do setor.
    expect(deaths).toEqual([]);
  });
});

describe('orcamento de re-simulacao', () => {
  it('e um contador, nao uma fila, e libera de volta', () => {
    const budget = createVerificationBudget();
    expect(budget.busy()).toBe(false);
    expect(budget.claim()).toBe(true);
    expect(budget.busy()).toBe(true);
    expect(budget.claim()).toBe(false);
    budget.release();
    expect(budget.busy()).toBe(false);
    // `busy` NÃO reserva: é consulta para recusar antes de ler o corpo.
    expect(budget.busy()).toBe(false);
    expect(budget.claim()).toBe(true);
  });
});

describe('endpoint do contrato', () => {
  it('anuncia um contrato deterministico por dia', () => {
    const contract = deathEchoContract(new Date('2026-07-30T10:00:00Z'));
    expect(contract.id).toBe('2026-07-30');
    expect(contract.ranked).toBe(true);
  });
});
