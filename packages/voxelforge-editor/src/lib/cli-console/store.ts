import { get, writable } from 'svelte/store';

export type CliRunStatus = 'running' | 'success' | 'error' | 'cancelled';

export type CliRunRecord = {
  runId: string;
  cwd: string;
  args: string[];
  label: string;
  status: CliRunStatus;
  stdout: string;
  stderr: string;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  signal: string | null;
  canceled: boolean;
  errorMessage: string | null;
};

export type RunCommandInput = {
  cwd?: string;
  args: string[];
  label?: string;
};

export type CliConsoleState = {
  available: boolean;
  runs: CliRunRecord[];
  activeRunId: string | null;
  error: string | null;
};

type Waiter = (result: {
  runId: string;
  code: number;
  signal: string | null;
  canceled: boolean;
  endedAt: number;
}) => void;

const createFallbackRun = (runId: string): CliRunRecord => ({
  runId,
  cwd: '-',
  args: [],
  label: runId,
  status: 'running',
  stdout: '',
  stderr: '',
  startedAt: Date.now(),
  endedAt: null,
  exitCode: null,
  signal: null,
  canceled: false,
  errorMessage: null,
});

const createCliConsoleStore = () => {
  const state = writable<CliConsoleState>({
    available: false,
    runs: [],
    activeRunId: null,
    error: null,
  });

  const waiters = new Map<string, Waiter>();
  const unsubs: Array<() => void> = [];
  let initialized = false;

  const getDesktop = (): Window['voxelynDesktop'] | null => {
    if (typeof window === 'undefined') return null;
    return window.voxelynDesktop ?? null;
  };

  const updateRun = (runId: string, updater: (current: CliRunRecord) => CliRunRecord): void => {
    state.update((current) => {
      const idx = current.runs.findIndex((run) => run.runId === runId);
      if (idx < 0) {
        const fallback = updater(createFallbackRun(runId));
        return {
          ...current,
          runs: [fallback, ...current.runs],
          activeRunId: current.activeRunId ?? fallback.runId,
        };
      }
      const nextRuns = [...current.runs];
      nextRuns[idx] = updater(nextRuns[idx]);
      return { ...current, runs: nextRuns };
    });
  };

  const initialize = (): void => {
    if (initialized) return;
    initialized = true;

    const desktop = getDesktop();
    state.update((current) => ({
      ...current,
      available: Boolean(desktop?.isDesktop),
    }));

    if (!desktop) return;

    unsubs.push(
      desktop.onCliStdout(({ runId, chunk }) => {
        updateRun(runId, (run) => ({ ...run, stdout: `${run.stdout}${chunk}` }));
      }),
      desktop.onCliStderr(({ runId, chunk }) => {
        updateRun(runId, (run) => ({ ...run, stderr: `${run.stderr}${chunk}` }));
      }),
      desktop.onCliError(({ runId, message }) => {
        updateRun(runId, (run) => ({
          ...run,
          status: 'error',
          errorMessage: message,
        }));
        state.update((current) => ({ ...current, error: message }));
      }),
      desktop.onCliExit(({ runId, code, signal, canceled, endedAt }) => {
        updateRun(runId, (run) => ({
          ...run,
          status: canceled ? 'cancelled' : code === 0 ? 'success' : 'error',
          exitCode: code,
          signal,
          canceled,
          endedAt,
        }));
        const waiter = waiters.get(runId);
        if (waiter) {
          waiters.delete(runId);
          waiter({ runId, code, signal, canceled, endedAt });
        }
      }),
    );
  };

  const runCommand = async (input: RunCommandInput): Promise<{ runId: string }> => {
    const desktop = getDesktop();
    if (!desktop) {
      throw new Error('Desktop CLI bridge is unavailable in this environment.');
    }
    if (!Array.isArray(input.args) || input.args.length === 0) {
      throw new Error('Missing CLI command arguments.');
    }

    const started = await desktop.runCli({ cwd: input.cwd, args: input.args });
    updateRun(started.runId, () => ({
      runId: started.runId,
      cwd: started.cwd,
      args: [...started.args],
      label: input.label ?? started.args.join(' '),
      status: 'running',
      stdout: '',
      stderr: '',
      startedAt: started.startedAt,
      endedAt: null,
      exitCode: null,
      signal: null,
      canceled: false,
      errorMessage: null,
    }));

    state.update((current) => ({ ...current, activeRunId: started.runId, error: null }));
    return { runId: started.runId };
  };

  const runCommandAndWait = async (
    input: RunCommandInput,
  ): Promise<{
    runId: string;
    code: number;
    signal: string | null;
    canceled: boolean;
    endedAt: number;
  }> => {
    const started = await runCommand(input);
    return await new Promise((resolve) => {
      waiters.set(started.runId, resolve);
    });
  };

  const cancelRun = async (runId: string): Promise<void> => {
    const desktop = getDesktop();
    if (!desktop) return;
    await desktop.cancelCli({ runId });
  };

  const setActiveRun = (runId: string | null): void => {
    state.update((current) => ({ ...current, activeRunId: runId }));
  };

  const clearRuns = (): void => {
    state.update((current) => ({ ...current, runs: [], activeRunId: null, error: null }));
  };

  const dispose = (): void => {
    while (unsubs.length > 0) {
      const unsub = unsubs.pop();
      if (unsub) unsub();
    }
    initialized = false;
  };

  return {
    subscribe: state.subscribe,
    initialize,
    dispose,
    runCommand,
    runCommandAndWait,
    cancelRun,
    setActiveRun,
    clearRuns,
    getState: () => get(state),
  };
};

export const cliConsoleStore = createCliConsoleStore();
