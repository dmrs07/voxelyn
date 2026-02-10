import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { cliConsoleStore } from './store';

type CliEventMap = {
  'cli:stdout': Array<(payload: { runId: string; chunk: string }) => void>;
  'cli:stderr': Array<(payload: { runId: string; chunk: string }) => void>;
  'cli:exit': Array<(payload: { runId: string; code: number; signal: string | null; canceled: boolean; endedAt: number }) => void>;
  'cli:error': Array<(payload: { runId: string; message: string }) => void>;
};

const createDesktopBridgeMock = () => {
  const listeners: CliEventMap = {
    'cli:stdout': [],
    'cli:stderr': [],
    'cli:exit': [],
    'cli:error': [],
  };

  return {
    isDesktop: true as const,
    async runCli({ cwd, args }: { cwd?: string; args: string[] }) {
      return {
        runId: 'run_test_1',
        cwd: cwd ?? '/tmp/project',
        args,
        startedAt: 100,
      };
    },
    async cancelCli() {
      return;
    },
    onCliStdout(cb: (payload: { runId: string; chunk: string }) => void) {
      listeners['cli:stdout'].push(cb);
      return () => {
        listeners['cli:stdout'] = listeners['cli:stdout'].filter((fn) => fn !== cb);
      };
    },
    onCliStderr(cb: (payload: { runId: string; chunk: string }) => void) {
      listeners['cli:stderr'].push(cb);
      return () => {
        listeners['cli:stderr'] = listeners['cli:stderr'].filter((fn) => fn !== cb);
      };
    },
    onCliExit(cb: (payload: { runId: string; code: number; signal: string | null; canceled: boolean; endedAt: number }) => void) {
      listeners['cli:exit'].push(cb);
      return () => {
        listeners['cli:exit'] = listeners['cli:exit'].filter((fn) => fn !== cb);
      };
    },
    onCliError(cb: (payload: { runId: string; message: string }) => void) {
      listeners['cli:error'].push(cb);
      return () => {
        listeners['cli:error'] = listeners['cli:error'].filter((fn) => fn !== cb);
      };
    },
    onUiCommand() {
      return () => {};
    },
    openProjectPath: async () => ({ path: '/tmp/project' }),
    emit<K extends keyof CliEventMap>(channel: K, payload: Parameters<CliEventMap[K][number]>[0]) {
      for (const cb of listeners[channel]) {
        cb(payload as never);
      }
    },
  };
};

describe('cliConsoleStore', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    cliConsoleStore.dispose();
    cliConsoleStore.clearRuns();
  });

  afterEach(() => {
    cliConsoleStore.dispose();
    cliConsoleStore.clearRuns();
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it('tracks stdout/stderr/exit for running command', async () => {
    const desktop = createDesktopBridgeMock();
    globalThis.window = {
      ...(globalThis.window ?? {}),
      voxelynDesktop: desktop,
    } as Window & typeof globalThis;

    cliConsoleStore.initialize();
    await cliConsoleStore.runCommand({
      cwd: '/tmp/project',
      args: ['build'],
      label: 'build',
    });

    desktop.emit('cli:stdout', { runId: 'run_test_1', chunk: 'building...\n' });
    desktop.emit('cli:stderr', { runId: 'run_test_1', chunk: 'warn\n' });
    desktop.emit('cli:exit', {
      runId: 'run_test_1',
      code: 0,
      signal: null,
      canceled: false,
      endedAt: 200,
    });

    const state = get(cliConsoleStore);
    expect(state.runs).toHaveLength(1);
    expect(state.runs[0]?.stdout).toContain('building...');
    expect(state.runs[0]?.stderr).toContain('warn');
    expect(state.runs[0]?.status).toBe('success');
    expect(state.runs[0]?.exitCode).toBe(0);
  });
});
