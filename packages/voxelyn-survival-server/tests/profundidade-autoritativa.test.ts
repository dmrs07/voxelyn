// A PROFUNDIDADE como decisao do SERVIDOR.
//
// O que este arquivo protege nao e a tabela de geracoes — isso vive na sim e e
// testado la. E a fronteira: quem resolve a profundidade, quando ela e
// congelada, e quais contextos NAO herdam progressao permanente.
//
// As tres respostas, e cada uma tem um jeito proprio de falhar em silencio:
//
//   expedicao  -> o perfil, no momento de emitir o ticket
//   ranqueado  -> o TICKET emitido para aquela descida; sem ticket, G-00
//   co-op      -> a SALA, congelada na criacao; nunca o perfil de quem entra
//
// A linha do ranqueado mudou quando o placar passou a ter um livro por
// profundidade: enquanto havia um livro so, re-simular tudo em tres setores era
// a politica que mantinha a comparacao justa. Ela cobrava caro — a run de sete
// setores voltava recusada como fraude para quem a jogou honestamente — e o
// livro por classe faz o mesmo trabalho sem cobrar isso.
//
// Ver docs/superpowers/specs/2026-08-05-survival-generation-depth-lineages.md.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_DEPTH,
  DEFAULT_SECTOR_COUNT,
  UPGRADES,
  isValidRunDepth,
  runDepthForGeneration,
} from '@voxelyn/survival-sim';
import { GameRoom } from '../src/room.js';
import { SurvivalServer } from '../src/server.js';
import { depthForProfile, newProfile, rewardFor } from '../src/progression.js';
import { resimulateRun } from '../src/replay.js';
import { MemoryProgressionStore } from '../src/progression-store.js';
import {
  CURRENT_VERSIONS,
  encodeCommandLog,
  quantizeCommand,
  toBase64,
} from '@voxelyn/survival-protocol';
import { createRun, emptyCommand, stepRun, type PlayerCommand } from '@voxelyn/survival-sim';

const profileWith = (upgradeIds: readonly string[]) => ({
  ...newProfile('p1', '2026-08-05T00:00:00.000Z'),
  purchasedUpgradeIds: [...upgradeIds],
});

/** Os N primeiros protocolos numa ordem que respeita pre-requisitos. */
const firstUpgrades = (count: number): string[] => UPGRADES.slice(0, count).map((u) => u.id);

describe('a profundidade da expedicao sai do perfil, no ticket', () => {
  it('perfil novo autoriza tres setores', () => {
    const depth = depthForProfile(newProfile('p1', '2026-08-05T00:00:00.000Z'));
    expect(depth.generation).toBe('G-00');
    expect(depth.sectorCount).toBe(DEFAULT_SECTOR_COUNT);
    expect(depth.coreSectors).toEqual([3]);
  });

  it('a profundidade acompanha a geracao derivada dos protocolos comprados', () => {
    // Os limiares vivem na sim (`GENERATION_THRESHOLDS`); o que este teste
    // prova e que o servidor deriva das MESMAS compras, e nao de um campo
    // gravado ao lado que pode ficar velho.
    expect(depthForProfile(profileWith(firstUpgrades(3))).sectorCount).toBe(3); // G-01
    expect(depthForProfile(profileWith(firstUpgrades(7))).sectorCount).toBe(4); // G-02
    expect(depthForProfile(profileWith(firstUpgrades(12))).sectorCount).toBe(5); // G-03
    expect(depthForProfile(profileWith(firstUpgrades(18))).sectorCount).toBe(7); // G-04
  });

  it('a profundidade derivada e sempre valida', () => {
    for (let owned = 0; owned <= UPGRADES.length; owned++) {
      expect(isValidRunDepth(depthForProfile(profileWith(firstUpgrades(owned))))).toBe(true);
    }
  });
});

describe('a profundidade e do TICKET, nunca do pedido', () => {
  /**
   * Uma run que TERMINA, porque `resimulateRun` recusa um log que nao chega ao
   * fim. O jogador de fixture se debate: e barato e morre.
   */
  const drivenLog = (): string => {
    const state = createRun({ seed: 1234, playerCount: 1 });
    const log: PlayerCommand[] = [];
    for (let t = 0; t < 12_000 && state.phase === 'running'; t++) {
      const cmd = quantizeCommand({
        ...emptyCommand(),
        move: { x: Math.sin(t / 9), y: Math.cos(t / 7) },
        fire: t % 3 === 0,
      });
      log.push(cmd);
      stepRun(state, [cmd]);
    }
    return toBase64(encodeCommandLog(log));
  };

  it('a re-simulacao SEM profundidade cai em tres setores', () => {
    // E o caminho de quem nao tem ticket: run offline, servidor sem
    // progressao, e o pool de Ecos, que nunca passa profundidade nenhuma.
    // Tres setores nao e um teto — e a descida de fabrica, a que o jogo
    // sempre foi para quem nao comprou protocolo nenhum.
    const run = resimulateRun(1234, drivenLog());
    expect(run.ok, run.ok ? '' : run.reason).toBe(true);
    if (!run.ok) return;
    expect(run.state.config.depth).toEqual(DEFAULT_RUN_DEPTH);
  });

  /**
   * O perfil nao alonga run nenhuma; o TICKET alonga.
   *
   * A diferenca importa porque o ranking passou a aceitar descidas de qualquer
   * profundidade, cada uma no seu livro. O que continua valendo — e o que este
   * teste guarda — e que a autorizacao e lida de um ticket que o servidor
   * emitiu, e nunca do perfil no momento da verificacao nem de um campo do
   * corpo: um jogador que chegue a G-04 hoje nao pode realongar a run de tres
   * setores que ele submeteu ontem.
   */
  it('a profundidade sai do ticket, e nao do perfil no momento da conferencia', () => {
    const g04 = depthForProfile(profileWith(UPGRADES.map((u) => u.id)));
    expect(g04.sectorCount).toBe(7);
    const run = resimulateRun(1234, drivenLog());
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.state.config.depth.sectorCount).toBe(DEFAULT_SECTOR_COUNT);
  });

  it('com ticket, a run roda com a profundidade autorizada', () => {
    const run = resimulateRun(1234, drivenLog(), undefined, runDepthForGeneration('G-04'));
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.state.config.depth.sectorCount).toBe(7);
    expect(run.state.config.depth.coreSectors).toEqual([3, 7]);
  });
});

describe('co-op: a autoridade e da SALA', () => {
  it('a sala nasce em tres setores — a politica de fabrica, para todos', () => {
    const room = new GameRoom('r1', 42, 2, 'ABCD');
    expect(room.state.config.depth).toEqual(DEFAULT_RUN_DEPTH);
  });

  it('a profundidade da sala e congelada na criacao e vale para quem entrar', () => {
    // A sala e explicitamente configuravel, e o valor congela: quem entra
    // atrasado joga a MESMA descida, e nao a que o proprio perfil autorizaria.
    const room = new GameRoom('r2', 42, 2, 'BCDF', runDepthForGeneration('G-03'));
    expect(room.state.config.depth.sectorCount).toBe(5);
    expect(room.state.config.depth.coreSectors).toEqual([3, 5]);
  });

  it('o servidor aplica a mesma politica a toda sala que abre', () => {
    const server = new SurvivalServer({ coopDepth: runDepthForGeneration('G-02') });
    server.addConnection('a');
    server.handleMessage(
      'a',
      JSON.stringify({
        t: 'hello',
        versions: CURRENT_VERSIONS,
        roomCode: 'CDFG',
      }),
    );
    const room = server.roomForCode('CDFG');
    expect(room).toBeTruthy();
    expect(room!.state.config.depth.sectorCount).toBe(4);
  });

  it('o handshake entrega a profundidade da sala, e nao a do cliente', () => {
    const server = new SurvivalServer({ coopDepth: runDepthForGeneration('G-03') });
    server.addConnection('a');
    const out = server.handleMessage(
      'a',
      JSON.stringify({
        t: 'hello',
        versions: CURRENT_VERSIONS,
        roomCode: 'DFGH',
      }),
    );
    const welcome = out.map((o) => o.msg).find((m) => m.t === 'welcome');
    expect(welcome).toBeTruthy();
    if (welcome?.t !== 'welcome') return;
    expect(welcome.sectorCount).toBe(5);
    expect(welcome.coreSectors).toEqual([3, 5]);
    expect(welcome.generation).toBe('G-03');
  });

  it('uma profundidade malformada na configuracao e saneada, nunca aceita', () => {
    const server = new SurvivalServer({
      // @ts-expect-error: exatamente o que um arquivo de configuracao errado produz
      coopDepth: { generation: 'G-99', sectorCount: 400, coreSectors: [0, 99] },
    });
    server.addConnection('a');
    server.handleMessage(
      'a',
      JSON.stringify({
        t: 'hello',
        versions: CURRENT_VERSIONS,
        roomCode: 'FGHJ',
      }),
    );
    const depth = server.roomForCode('FGHJ')!.state.config.depth;
    expect(isValidRunDepth(depth)).toBe(true);
    expect(depth.generation).toBe('G-00');
    expect(depth.sectorCount).toBe(7);
  });
});

describe('liquidacao de multiplos Nucleos', () => {
  it('credita a contagem que a re-simulacao produziu, e nao um literal', () => {
    expect(rewardFor('extracted_with_core', 100, 2)).toEqual({ ore: 100, cores: 2, lost: 0 });
    expect(rewardFor('extracted_with_core', 100, 1)).toEqual({ ore: 100, cores: 1, lost: 0 });
  });

  it('a fase garante o piso: um resumo sem contagem nao credita zero', () => {
    // Um replay de versao antiga chega sem `cores`. A fase ja prova que houve
    // ao menos um Nucleo, e perder a recompensa por omissao seria pior que
    // pagar de menos.
    expect(rewardFor('extracted_with_core', 100).cores).toBe(1);
    expect(rewardFor('extracted_with_core', 100, 0).cores).toBe(1);
  });

  it('extrair sem Nucleo nao credita nenhum, mesmo com contagem enviada', () => {
    expect(rewardFor('extracted', 100, 2).cores).toBe(0);
  });

  it('morrer perde a carga e nao credita Nucleo', () => {
    expect(rewardFor('dead', 100, 2)).toEqual({ ore: 0, cores: 0, lost: 100 });
  });

  it('liquidar duas vezes nao duplica os dois Nucleos', async () => {
    const store = new MemoryProgressionStore();
    const profile = await store.createProfile('p9', '2026-08-05T00:00:00.000Z');
    const input = {
      profileId: profile.profileId,
      runId: 'run-1',
      phase: 'extracted_with_core' as const,
      cargoOre: 40,
      cores: 2,
      kills: {},
      discoveries: 0,
      seed: 1,
      simulationVersion: 32,
      durationTicks: 100,
      now: '2026-08-05T00:01:00.000Z',
      idFactory: () => 'id-1',
    };

    const first = await store.settleRun(input);
    expect('error' in first).toBe(false);
    if ('error' in first) return;
    expect(first.fresh).toBe(true);
    expect(first.reward.cores).toBe(2);
    expect(first.profile.wallet.cores).toBe(2);

    const again = await store.settleRun({ ...input, idFactory: () => 'id-2' });
    expect('error' in again).toBe(false);
    if ('error' in again) return;
    expect(again.fresh).toBe(false);
    // Nada foi creditado de novo: a carteira continua em dois.
    expect(again.profile.wallet.cores).toBe(2);
  });
});
