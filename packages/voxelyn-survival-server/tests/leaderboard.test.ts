import { describe, expect, it } from 'vitest';
import {
  createRun,
  emptyCommand,
  stepRun,
  hashAuthoritativeState,
  type PlayerCommand,
  type RunSummary,
} from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';
import type { SoloRunSubmission } from '@voxelyn/survival-protocol';
import { MAX_REPLAY_BYTES, replayDigest, sanitizeName, verifySoloRun } from '../src/replay';
import {
  MemoryLeaderboard,
  compareEntries,
  isLeaderboardEligible,
  type LeaderboardEntry,
} from '../src/leaderboard';

/**
 * Joga uma run de verdade e devolve o log codificado.
 *
 * Usa o MESMO caminho que o cliente usara: quantiza o comando, alimenta a
 * simulacao com o comando quantizado, e grava. E o unico jeito honesto de
 * testar o replay — gravar um comando e simular outro esconderia exatamente o
 * bug que a quantizacao na captura existe para evitar.
 */
/**
 * Teto de ticks: guarda contra loop infinito, e NAO um botao de dificuldade.
 *
 * Ele estava em 4000, que era justo o bastante para a run de fixture morrer — e
 * por isso quebrou quando a simulacao mudou. Corrigir o excedente de velocidade
 * do inimigo em parede (ele andava a 114% da propria velocidade ao raspar) fez o
 * jogador de fixture, que se debate em circulos, sobreviver ate a extracao em
 * 5688 ticks em vez de morrer antes de 4000.
 *
 * Doze mil e folga deliberada. O que estes testes provam e que o servidor chega
 * ao mesmo sumario que o cliente; terminar e pre-requisito, nao o assunto. Um
 * teto apertado transforma qualquer ajuste de balanceamento em falha de
 * leaderboard, que e o pior lugar possivel para descobrir isso.
 */
const MAX_FIXTURE_TICKS = 12_000;

const playAndLog = (seed: number, drive: (tick: number) => Partial<PlayerCommand>) => {
  const state = createRun({ seed, playerCount: 1 });
  const log: PlayerCommand[] = [];
  for (let t = 0; t < MAX_FIXTURE_TICKS && state.phase === 'running'; t++) {
    const cmd = quantizeCommand({ ...emptyCommand(), ...drive(t) });
    log.push(cmd);
    stepRun(state, [cmd]);
  }
  return { state, log, base64: toBase64(encodeCommandLog(log)) };
};

describe('verificacao por re-simulacao', () => {
  /**
   * A propriedade que o leaderboard inteiro depende, testada de ponta a ponta:
   * o servidor chega ao MESMO resultado que o cliente viveu, tendo recebido
   * apenas a seed e as teclas.
   *
   * Se este teste falhar, nenhuma run honesta entra no ranking — e o modo de
   * falha e traicoeiro, porque a submissao volta como "fraude" em vez de
   * "bug".
   */
  it('deriva o mesmo sumario que o cliente observou', () => {
    const played = playAndLog(4242, (t) => ({
      move: { x: Math.sin(t / 40), y: Math.cos(t / 37) },
      aim: { x: Math.cos(t / 13), y: Math.sin(t / 11) },
      fire: t % 4 === 0,
      interact: t % 11 === 0,
    }));
    expect(played.state.phase, 'a run de teste precisa terminar').not.toBe('running');
    const clientSummary = played.state.summary!;

    const verdict = verifySoloRun(4242, played.base64);
    expect(verdict.ok, verdict.ok ? '' : verdict.reason).toBe(true);
    if (!verdict.ok) return;

    // Igualdade PROFUNDA: tempo, estrelas, causa de morte, contadores. Nao
    // basta o resultado "bater no geral" — o ranking ordena por ticks, e um
    // tick de diferenca ja e uma posicao diferente.
    expect(verdict.summary).toEqual(clientSummary);
    expect(verdict.ticks).toBe(played.state.tick);
  });

  it('reproduz a run tick a tick, e nao so o desfecho', () => {
    const played = playAndLog(777, (t) => ({
      move: { x: t % 60 < 30 ? 1 : -1, y: 0 },
      aim: { x: 0, y: 1 },
      fire: t % 3 === 0,
    }));
    const replayed = createRun({ seed: 777, playerCount: 1 });
    for (const cmd of played.log) {
      stepRun(replayed, [cmd]);
      if (replayed.phase !== 'running') break;
    }
    expect(hashAuthoritativeState(replayed)).toBe(hashAuthoritativeState(played.state));
  });

  // O ataque real de um leaderboard de jogo web e editar o corpo do POST.
  // Aqui nao ha o que editar: a submissao nao carrega resultado nenhum.
  it('a submissao nao tem campo de resultado para forjar', () => {
    const submission: SoloRunSubmission = { seed: 1, log: 'AAAAAAA', name: 'x' };
    const campos = Object.keys(submission);
    for (const proibido of ['stars', 'ticks', 'summary', 'score', 'phase']) {
      expect(campos, `submissao aceita ${proibido}`).not.toContain(proibido);
    }
  });
});

describe('recusa de entrada hostil', () => {
  it('recusa seed fora da faixa', () => {
    const log = toBase64(encodeCommandLog([quantizeCommand(emptyCommand())]));
    expect(verifySoloRun(-1, log).ok).toBe(false);
    expect(verifySoloRun(2 ** 40, log).ok).toBe(false);
    expect(verifySoloRun(1.5, log).ok).toBe(false);
  });

  it('recusa log que nao e base64', () => {
    const verdict = verifySoloRun(1, 'não é base64 %%%');
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('base64');
  });

  it('recusa log vazio', () => {
    const verdict = verifySoloRun(1, '');
    expect(verdict.ok).toBe(false);
  });

  // O teto existe para limitar o custo de CPU de UMA verificacao: o event loop
  // que re-simula e o mesmo que roda o tick autoritativo a 20 Hz.
  it('recusa log acima do teto de bytes antes de decodificar', () => {
    const verdict = verifySoloRun(1, 'A'.repeat(MAX_REPLAY_BYTES + 1));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain('tamanho maximo');
  });

  it('nao lanca com bytes tortos', () => {
    for (const junk of ['AAAA', 'AAAAAAAA', toBase64(new Uint8Array([0, 0, 1, 2, 3, 4, 5]))]) {
      expect(() => verifySoloRun(1, junk)).not.toThrow();
    }
  });
});

describe('digest de replay', () => {
  it('e estavel e distingue bytes canonicos', () => {
    const abc = Uint8Array.from([97, 98, 99]);
    const abd = Uint8Array.from([97, 98, 100]);
    expect(replayDigest(1, abc)).toBe(replayDigest(1, abc));
    expect(replayDigest(1, abc)).not.toBe(replayDigest(2, abc));
    expect(replayDigest(1, abc)).not.toBe(replayDigest(1, abd));
    expect(() => replayDigest(1, 'abc' as never)).toThrow('bytes canonicos');
  });
});

describe('nome exibido', () => {
  it('corta, colapsa espaco e nunca fica vazio', () => {
    expect(sanitizeName('  Dani   Moraes  ')).toBe('Dani Moraes');
    expect(sanitizeName('x'.repeat(50))).toHaveLength(18);
    expect(sanitizeName('')).toBe('anônimo');
    expect(sanitizeName('   ')).toBe('anônimo');
    expect(sanitizeName(null)).toBe('anônimo');
    expect(sanitizeName(42)).toBe('anônimo');
  });

  // Nao sao "texto estranho": sao bytes que quebram terminal e log estruturado.
  it('remove caracteres de controle', () => {
    expect(sanitizeName('a\0b\x1fc\x7fd')).toBe('abcd');
  });
});

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  seed: 1,
  phase: 'extracted_with_core',
  ticks: 9000,
  contamination: 0.5,
  deathCause: null,
  stats: {
    shotsFired: 10,
    kills: { stalker: 2, bruiser: 1, spitter: 0, bomber: 0, guardian: 1 },
    damageTakenTenths: 100,
    damageDealtTenths: 200,
    solidsDestroyed: 1,
    salvageCompleted: 1,
    modulesAcquired: 1,
    purgeCellsUsed: 0,
    timesDowned: 0,
    revivesGiven: 0,
    discoveries: 0,
    oreCollected: 0,
    innocentsKilled: 0,
  },
  cores: 1,
  sectorCount: 3,
  stars: 3,
  targetTicks: 14400,
  ...over,
});

describe('ordenacao do ranking', () => {
  const entry = (over: Partial<LeaderboardEntry>): LeaderboardEntry => ({
    id: 1, name: 'x', seed: 1, stars: 3, ticks: 1000, phase: 'extracted_with_core',
    mode: 'solo', kills: 0, cores: 1, sectorCount: 3, ore: 0, createdAt: '', ...over,
  });

  it('mais NUCLEOS primeiro', () => {
    expect(compareEntries(entry({ cores: 1 }), entry({ cores: 2 }))).toBeGreaterThan(0);
  });

  it('entre Nucleos iguais, menos tempo primeiro', () => {
    expect(compareEntries(entry({ ticks: 500 }), entry({ ticks: 900 }))).toBeLessThan(0);
  });

  /**
   * O caso que motivou trocar estrelas por Nucleos.
   *
   * Duas estrelas com dois Nucleos e uma run que cumpriu o objetivo DUAS VEZES,
   * so que devagar; tres estrelas com um Nucleo cumpriu uma vez, com pressa.
   * Enquanto a nota ordenava, a segunda passava a frente — e o placar punia
   * quem desceu mais fundo.
   */
  it('dois Nucleos fora do tempo batem um Nucleo com tres estrelas', () => {
    const doisNucleos = entry({ cores: 2, stars: 2, ticks: 20_000 });
    const tresEstrelas = entry({ cores: 1, stars: 3, ticks: 6_000 });
    expect(compareEntries(doisNucleos, tresEstrelas)).toBeLessThan(0);
  });

  // Minerar custa tempo e nao e o que a run pede. Enquanto o minerio desempatava,
  // ele era um criterio — pequeno, mas criterio — que o briefing nunca cobrou.
  it('minerio nao decide nada', () => {
    expect(compareEntries(entry({ id: 1, ore: 0 }), entry({ id: 2, ore: 999 }))).toBeLessThan(0);
  });

  it('empate total mantem quem chegou antes', () => {
    expect(compareEntries(entry({ id: 1 }), entry({ id: 2 }))).toBeLessThan(0);
  });
});

describe('store', () => {
  it('grava e ordena', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({ name: 'lento', mode: 'solo', summary: summary({ ticks: 12000 }), digest: 'a' });
    await store.submit({ name: 'rapido', mode: 'solo', summary: summary({ ticks: 7000 }), digest: 'b' });
    // Extraiu vivo e depressa, mas de maos vazias: zero Nucleo, ultimo lugar.
    await store.submit({
      name: 'fraco',
      mode: 'solo',
      summary: summary({ phase: 'extracted', cores: 0, stars: 1, ticks: 100 }),
      digest: 'c',
    });
    const top = await store.top({});
    expect(top.map((e) => e.name)).toEqual(['rapido', 'lento', 'fraco']);
  });

  it('grava a classe e os Nucleos que a re-simulacao produziu', async () => {
    const store = new MemoryLeaderboard();
    const entry = await store.submit({
      name: 'g04',
      mode: 'solo',
      summary: summary({ cores: 2, sectorCount: 7 }),
      digest: 'g04',
    });
    expect(entry?.cores).toBe(2);
    expect(entry?.sectorCount).toBe(7);
  });

  // A rede pode cair depois do POST e o cliente reenviar. Reenvio nao pode
  // duplicar a entrada no ranking.
  it('deduplica por digest', async () => {
    const store = new MemoryLeaderboard();
    expect(await store.submit({ name: 'a', mode: 'solo', summary: summary(), digest: 'x' })).not.toBeNull();
    expect(await store.submit({ name: 'a', mode: 'solo', summary: summary(), digest: 'x' })).toBeNull();
    expect(await store.top({})).toHaveLength(1);
  });

  it('recusa derrotas e nunca as devolve no ranking', async () => {
    const store = new MemoryLeaderboard();
    const dead = summary({ phase: 'dead', stars: 0, deathCause: { kind: 'fire' } });
    expect(isLeaderboardEligible(dead)).toBe(false);
    expect(await store.submit({ name: 'derrota', mode: 'coop', summary: dead, digest: null })).toBeNull();
    await store.submit({ name: 'extracao', mode: 'coop', summary: summary(), digest: null });
    expect((await store.top({})).map((entry) => entry.name)).toEqual(['extracao']);
  });

  it('runs de co-op nao deduplicam entre si', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({ name: 'sala BCDF', mode: 'coop', summary: summary(), digest: null });
    await store.submit({ name: 'sala GHJK', mode: 'coop', summary: summary(), digest: null });
    expect(await store.top({})).toHaveLength(2);
  });

  /**
   * O ponto inteiro do ranking por classe: uma descida de tres setores e uma de
   * sete nao sao a mesma prova. A de sete tem mais Nucleos disponiveis e leva o
   * dobro do tempo — no mesmo livro, ela nao compara habilidade, compara
   * autorizacao. E autorizacao se compra, nao se joga.
   */
  it('runs de profundidades diferentes nao competem entre si', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({
      name: 'tres setores',
      mode: 'solo',
      summary: summary({ sectorCount: 3, cores: 1, ticks: 9000 }),
      digest: 'a',
    });
    await store.submit({
      name: 'sete setores',
      mode: 'solo',
      summary: summary({ sectorCount: 7, cores: 2, ticks: 20000 }),
      digest: 'b',
    });

    expect((await store.top({ sectorCount: 3 })).map((e) => e.name)).toEqual(['tres setores']);
    expect((await store.top({ sectorCount: 7 })).map((e) => e.name)).toEqual(['sete setores']);
  });

  it('lista os livros que existem, do mais raso ao mais fundo', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({ name: 'a', mode: 'solo', summary: summary({ sectorCount: 7 }), digest: 'a' });
    await store.submit({ name: 'b', mode: 'solo', summary: summary({ sectorCount: 3 }), digest: 'b' });
    await store.submit({ name: 'c', mode: 'solo', summary: summary({ sectorCount: 3 }), digest: 'c' });
    expect(await store.classes({})).toEqual([
      { sectorCount: 3, entries: 2 },
      { sectorCount: 7, entries: 1 },
    ]);
  });

  // Um seletor que conta com um filtro e uma lista que abre com outro produziria
  // uma aba que abre vazia — a unica forma de o placar mentir sem errar um numero.
  it('os livros respeitam o mesmo filtro que a lista', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({ name: 'solo', mode: 'solo', summary: summary({ sectorCount: 3 }), digest: 'a' });
    await store.submit({ name: 'coop', mode: 'coop', summary: summary({ sectorCount: 7 }), digest: null });
    expect(await store.classes({ mode: 'solo' })).toEqual([{ sectorCount: 3, entries: 1 }]);
    // Derrotas nunca aparecem, nem na lista nem na contagem de livros.
    await store.submit({
      name: 'morto',
      mode: 'coop',
      summary: summary({ phase: 'dead', cores: 0, stars: 0, sectorCount: 5 }),
      digest: null,
    });
    expect((await store.classes({})).map((c) => c.sectorCount)).toEqual([3, 7]);
  });

  it('filtra por seed e por modo', async () => {
    const store = new MemoryLeaderboard();
    await store.submit({ name: 'solo1', mode: 'solo', summary: summary({ seed: 10 }), digest: 'a' });
    await store.submit({ name: 'coop1', mode: 'coop', summary: summary({ seed: 10 }), digest: null });
    await store.submit({ name: 'solo2', mode: 'solo', summary: summary({ seed: 99 }), digest: 'c' });
    expect(await store.top({ seed: 10 })).toHaveLength(2);
    expect(await store.top({ mode: 'solo' })).toHaveLength(2);
    expect(await store.top({ seed: 10, mode: 'solo' })).toHaveLength(1);
  });

  it('respeita o teto de resultados', async () => {
    const store = new MemoryLeaderboard();
    for (let i = 0; i < 40; i++) {
      await store.submit({ name: `p${i}`, mode: 'solo', summary: summary({ ticks: i }), digest: `d${i}` });
    }
    expect(await store.top({ limit: 5 })).toHaveLength(5);
    expect((await store.top({ limit: 9999 })).length).toBeLessThanOrEqual(100);
  });
});
