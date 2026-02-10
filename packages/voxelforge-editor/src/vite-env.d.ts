import 'vite/client';

declare module '*.svelte' {
  import type { ComponentType } from 'svelte';
  const component: ComponentType;
  export default component;
}

type VoxelynProjectDirEntry = {
  name: string;
  type: 'file' | 'directory';
};

type VoxelynBridge = {
  openProjectFolder: () => Promise<{ path: string } | null>;
  openProjectPath: (projectPath: string) => Promise<{ path: string } | null>;
  selectDirectory: () => Promise<{ path: string } | null>;
  projectReadFile: (relPath: string) => Promise<string | Uint8Array>;
  projectReadDir: (relPath: string) => Promise<VoxelynProjectDirEntry[]>;
  projectExists: (relPath: string) => Promise<boolean>;
  projectWriteFile: (relPath: string, data: string | Uint8Array) => Promise<void>;
  projectJoin: (...rel: string[]) => Promise<string>;
  onProjectOpened: (cb: (payload: { path: string | null }) => void) => () => void;
};

type CliRunPayload = {
  cwd?: string;
  args: string[];
};

type CliRunStart = {
  runId: string;
  cwd: string;
  args: string[];
  startedAt: number;
};

type CliStdPayload = {
  runId: string;
  chunk: string;
};

type CliExitPayload = {
  runId: string;
  code: number;
  signal: string | null;
  canceled: boolean;
  endedAt: number;
};

type CliErrorPayload = {
  runId: string;
  message: string;
};

type UiCommandPayload = {
  type: string;
  payload?: Record<string, unknown>;
};

type VoxelynDesktopBridge = {
  isDesktop: true;
  runCli: (payload: CliRunPayload) => Promise<CliRunStart>;
  cancelCli: (payload: { runId: string }) => Promise<void>;
  onCliStdout: (cb: (payload: CliStdPayload) => void) => () => void;
  onCliStderr: (cb: (payload: CliStdPayload) => void) => () => void;
  onCliExit: (cb: (payload: CliExitPayload) => void) => () => void;
  onCliError: (cb: (payload: CliErrorPayload) => void) => () => void;
  onUiCommand: (cb: (payload: UiCommandPayload) => void) => () => void;
  openProjectPath: (projectPath: string) => Promise<{ path: string } | null>;
};

interface Window {
  voxelyn?: VoxelynBridge;
  voxelynDesktop?: VoxelynDesktopBridge;
  voxelforge?: {
    version: string;
  };
}
