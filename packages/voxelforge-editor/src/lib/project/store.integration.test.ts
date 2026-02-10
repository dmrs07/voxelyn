import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { projectStore } from './store';
import { worldStore } from '../world/store';
import type { ProjectDirEntry } from './types';

type MockBridge = {
  openProjectFolder: () => Promise<{ path: string } | null>;
  openProjectPath: (projectPath: string) => Promise<{ path: string } | null>;
  selectDirectory: () => Promise<{ path: string } | null>;
  projectReadFile: (relPath: string) => Promise<string | Uint8Array>;
  projectReadDir: (relPath: string) => Promise<ProjectDirEntry[]>;
  projectExists: (relPath: string) => Promise<boolean>;
  projectWriteFile: (relPath: string, data: string | Uint8Array) => Promise<void>;
  projectJoin: (...rel: string[]) => Promise<string>;
  onProjectOpened: (cb: (payload: { path: string | null }) => void) => () => void;
  emitProjectOpened: (path: string) => void;
};

const normalize = (value: string): string => value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (check: () => boolean, timeoutMs = 1500): Promise<void> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (check()) return;
    await sleep(20);
  }
  throw new Error('Timed out while waiting for condition.');
};

const createMockBridge = (projectPath: string): MockBridge => {
  const listeners = new Set<(payload: { path: string | null }) => void>();
  const files = new Map<string, string>();

  files.set(
    'voxelyn.project.json',
    JSON.stringify(
      {
        version: 1,
        name: 'my-game',
        paths: {
          assets: 'assets',
          scenes: 'scenes',
          worlds: 'worlds',
          generated: 'assets/generated',
          ai: 'ai',
          build: 'build',
        },
      },
      null,
      2,
    ),
  );
  files.set('scenes/base.scene.json', '{"id":"base"}');
  files.set('assets/rock.obj', 'o Rock\nv 0 0 0\n');
  files.set(
    'worlds/default.world.json',
    JSON.stringify(
      {
        worldVersion: 1,
        viewMode: '3d',
        items: [
          {
            id: 'item_1',
            type: 'scene',
            sourceRef: 'scenes/base.scene.json',
            transform: { position: [1, 0, 2], rotation: [0, 0, 0], scale: [1, 1, 1] },
            meta: { width: 8, height: 4, depth: 8 },
          },
        ],
        hero: { spawn: [0, 0, 0], collision: 'aabb' },
        composer: {
          snapEnabled: true,
          snapSize: 1,
          snapFromMeta: true,
          rotationStepDeg: 15,
          space: 'world',
        },
      },
      null,
      2,
    ),
  );

  const exists = (relPath: string): boolean => {
    const normalized = normalize(relPath);
    if (!normalized || normalized === '.') return true;
    if (files.has(normalized)) return true;
    const prefix = `${normalized}/`;
    for (const key of files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  };

  const readDir = (relPath: string): ProjectDirEntry[] => {
    const normalized = normalize(relPath);
    const dir = !normalized || normalized === '.' ? '' : normalized;
    const out = new Map<string, ProjectDirEntry['type']>();

    for (const key of files.keys()) {
      if (dir) {
        const prefix = `${dir}/`;
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        if (!rest) continue;
        const [name, ...tail] = rest.split('/');
        const type: ProjectDirEntry['type'] = tail.length > 0 ? 'directory' : 'file';
        if (!out.has(name) || type === 'directory') {
          out.set(name, type);
        }
      } else {
        const [name, ...tail] = key.split('/');
        const type: ProjectDirEntry['type'] = tail.length > 0 ? 'directory' : 'file';
        if (!out.has(name) || type === 'directory') {
          out.set(name, type);
        }
      }
    }

    return Array.from(out.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, type]) => ({ name, type }));
  };

  return {
    openProjectFolder: async () => ({ path: projectPath }),
    openProjectPath: async (projectPathArg: string) => ({ path: projectPathArg }),
    selectDirectory: async () => ({ path: '/tmp' }),
    projectReadFile: async (relPath: string) => {
      const normalized = normalize(relPath);
      const content = files.get(normalized);
      if (content === undefined) {
        throw new Error(`Missing file: ${normalized}`);
      }
      return content;
    },
    projectReadDir: async (relPath: string) => readDir(relPath),
    projectExists: async (relPath: string) => exists(relPath),
    projectWriteFile: async (relPath: string, data: string | Uint8Array) => {
      const normalized = normalize(relPath);
      const content =
        typeof data === 'string' ? data : new TextDecoder('utf-8').decode(data);
      files.set(normalized, content);
    },
    projectJoin: async (...rel: string[]) => rel.map((part) => normalize(part)).filter(Boolean).join('/'),
    onProjectOpened: (cb: (payload: { path: string | null }) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    emitProjectOpened: (path: string) => {
      for (const listener of listeners) {
        listener({ path });
      }
    },
  };
};

describe('projectStore integration with bridge and worldStore', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    projectStore.clear();
  });

  afterEach(() => {
    if (originalWindow) {
      globalThis.window = originalWindow;
    } else {
      // Keep runtime clean when node environment starts without window.
      delete (globalThis as { window?: Window }).window;
    }
  });

  it('opens a project, indexes files, refreshes, and auto-loads world file', async () => {
    const bridge = createMockBridge('/tmp/my-game');
    globalThis.window = {
      ...(globalThis.window ?? {}),
      voxelyn: bridge,
    } as Window & typeof globalThis;

    projectStore.initialize();
    const opened = await projectStore.openProjectFolder();
    expect(opened).toEqual({ path: '/tmp/my-game' });

    await waitFor(() => get(projectStore).loading === false);
    await waitFor(() => get(worldStore).loading === false);

    const project = get(projectStore);
    expect(project.projectRoot).toBe('/tmp/my-game');
    expect(project.projectMeta?.name).toBe('my-game');
    expect(project.scenesIndex.some((entry) => entry.path === 'scenes/base.scene.json')).toBe(true);
    expect(project.assetsIndex.some((entry) => entry.path === 'assets/rock.obj')).toBe(true);

    await waitFor(() => get(worldStore).world.items.length === 1);
    expect(get(worldStore).world.items[0]?.sourceRef).toBe('scenes/base.scene.json');

    await bridge.projectWriteFile('assets/new-tree.obj', 'o Tree\nv 0 0 0\n');
    await projectStore.refresh();

    const refreshed = get(projectStore);
    expect(refreshed.assetsIndex.some((entry) => entry.path === 'assets/new-tree.obj')).toBe(true);
  });
});
