import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootProgress,
  heaviestPending,
  runBootTasks,
  withBootTimeout,
  type BootTask,
} from './boot-tasks';

/** Fabrica de tarefa: peso e desfecho explicitos, corpo contado. */
const task = (
  id: string,
  opts: {
    weight?: number;
    critical?: boolean;
    fail?: boolean;
    delayMs?: number;
    onRun?: () => void;
  } = {},
): BootTask => ({
  id,
  weight: opts.weight ?? 1,
  critical: opts.critical ?? false,
  run: async () => {
    opts.onRun?.();
    if (opts.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
    if (opts.fail) throw new Error(`${id} quebrou`);
  },
});

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // As falhas SAO registradas de proposito; o espiao existe para provar isso
  // sem sujar a saida do teste.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('progresso', () => {
  it('e a fracao dos PESOS, nao a contagem de tarefas', () => {
    const tasks = [task('leve', { weight: 1 }), task('pesado', { weight: 9 })];
    expect(bootProgress(tasks, ['leve'])).toBeCloseTo(0.1);
    expect(bootProgress(tasks, ['pesado'])).toBeCloseTo(0.9);
    expect(bootProgress(tasks, ['leve', 'pesado'])).toBe(1);
  });

  it('comeca em zero e termina em um', () => {
    const tasks = [task('a', { weight: 2 }), task('b', { weight: 3 })];
    expect(bootProgress(tasks, [])).toBe(0);
    expect(bootProgress(tasks, ['a', 'b'])).toBe(1);
  });

  it('uma lista vazia ja esta pronta', () => {
    expect(bootProgress([], [])).toBe(1);
  });

  it('ignora id desconhecido e peso negativo em vez de estourar a barra', () => {
    const tasks = [task('a', { weight: 2 }), task('torto', { weight: -5 })];
    expect(bootProgress(tasks, ['a', 'fantasma'])).toBe(1);
    expect(bootProgress(tasks, [])).toBe(0);
  });

  it('o rotulo aponta a tarefa mais pesada ainda pendente', () => {
    const tasks = [task('a', { weight: 1 }), task('b', { weight: 5 }), task('c', { weight: 3 })];
    expect(heaviestPending(tasks, [])).toBe('b');
    expect(heaviestPending(tasks, ['b'])).toBe('c');
    expect(heaviestPending(tasks, ['b', 'c'])).toBe('a');
    expect(heaviestPending(tasks, ['a', 'b', 'c'])).toBeUndefined();
  });
});

describe('execucao do preload', () => {
  it('preload inteiro bem-sucedido: sem falha critica, sem degradacao', async () => {
    const report = await runBootTasks([task('a'), task('b', { critical: true })]);
    expect(report.criticalFailed).toBe(false);
    expect(report.degraded).toEqual([]);
    expect(report.outcomes.every((o) => o.ok)).toBe(true);
  });

  it('falha CRITICA e reportada — nunca vira menu em silencio', async () => {
    const report = await runBootTasks([
      task('ok'),
      task('essencial', { critical: true, fail: true }),
    ]);
    expect(report.criticalFailed).toBe(true);
    expect(report.outcomes.find((o) => o.id === 'essencial')?.error).toBeInstanceOf(Error);
    expect(warn).toHaveBeenCalled();
  });

  it('falha OPCIONAL degrada e segue', async () => {
    const report = await runBootTasks([
      task('essencial', { critical: true }),
      task('enfeite', { fail: true }),
    ]);
    expect(report.criticalFailed).toBe(false);
    expect(report.degraded).toEqual(['enfeite']);
    // Registrada, nunca engolida.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('enfeite'), expect.anything());
  });

  it('uma tarefa que quebra nao impede as outras de liquidarem', async () => {
    const report = await runBootTasks([
      task('a', { fail: true }),
      task('b', { fail: true }),
      task('c'),
    ]);
    expect(report.outcomes).toHaveLength(3);
    expect([...report.degraded].sort()).toEqual(['a', 'b']);
  });

  it('recursos ja em cache (resolvem na hora) chegam a 100%', async () => {
    const progress: number[] = [];
    const report = await runBootTasks(
      [task('a', { weight: 3 }), task('b', { weight: 1 })],
      (fraction) => progress.push(fraction),
    );
    expect(report.criticalFailed).toBe(false);
    expect(progress[progress.length - 1]).toBe(1);
    // Monotonico: a barra nunca anda para tras.
    expect([...progress].sort((x, y) => x - y)).toEqual(progress);
  });

  it('o progresso reportado sai dos pesos, tarefa a tarefa', async () => {
    const seen: Array<{ fraction: number; pending: string | undefined }> = [];
    await runBootTasks(
      [task('rapida', { weight: 1 }), task('lenta', { weight: 3, delayMs: 20 })],
      (fraction, pending) => seen.push({ fraction, pending }),
    );
    expect(seen[0]).toEqual({ fraction: 0.25, pending: 'lenta' });
    expect(seen[1]).toEqual({ fraction: 1, pending: undefined });
  });

  it('cada tarefa roda UMA vez por passada — nada e inicializado em dobro', async () => {
    let runs = 0;
    const tasks = [task('unica', { onRun: () => runs++ })];
    await runBootTasks(tasks);
    expect(runs).toBe(1);
    // A nova tentativa e uma segunda passada EXPLICITA, nunca um efeito
    // colateral de ler o progresso.
    bootProgress(tasks, []);
    heaviestPending(tasks, []);
    expect(runs).toBe(1);
    await runBootTasks(tasks);
    expect(runs).toBe(2);
  });

  it('nunca rejeita, mesmo com tudo quebrado', async () => {
    await expect(
      runBootTasks([task('a', { critical: true, fail: true }), task('b', { fail: true })]),
    ).resolves.toBeDefined();
  });
});

describe('teto por tarefa', () => {
  it('uma promessa que nunca resolve vira FALHA, e nao 87% eterno', async () => {
    const eterna = new Promise<void>(() => {});
    await expect(withBootTimeout(eterna, 10, 'eterna')).rejects.toThrow(/tempo esgotado/);
  });

  it('quem resolve dentro do prazo passa intacto', async () => {
    await expect(withBootTimeout(Promise.resolve('ok'), 1000, 'rapida')).resolves.toBe('ok');
  });

  it('o teto integrado a uma tarefa produz um laudo, nao um travamento', async () => {
    const travada: BootTask = {
      id: 'travada',
      weight: 1,
      critical: true,
      run: () => withBootTimeout(new Promise<void>(() => {}), 10, 'travada'),
    };
    const report = await runBootTasks([travada]);
    expect(report.criticalFailed).toBe(true);
  });
});
