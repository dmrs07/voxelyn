import { get, writable } from 'svelte/store';
import { indexProject, readProjectMeta } from './indexer';
import type { ProjectEntry, ProjectMeta, VoxelynBridge } from './types';

type ProjectState = {
  projectRoot: string | null;
  projectMeta: ProjectMeta | null;
  assetsIndex: ProjectEntry[];
  scenesIndex: ProjectEntry[];
  aiOutputsIndex: ProjectEntry[];
  loading: boolean;
  error: string | null;
  available: boolean;
};

export type ProjectStoreState = ProjectState;

const getBridge = (): VoxelynBridge | null => {
  if (typeof window === 'undefined') return null;
  const bridge = (window as Window & { voxelyn?: VoxelynBridge }).voxelyn;
  return bridge ?? null;
};

const initialState: ProjectState = {
  projectRoot: null,
  projectMeta: null,
  assetsIndex: [],
  scenesIndex: [],
  aiOutputsIndex: [],
  loading: false,
  error: null,
  available: false,
};

const createProjectStore = () => {
  const state = writable<ProjectState>(initialState);
  let unlisten: (() => void) | null = null;

  const setError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    state.update((s) => ({ ...s, loading: false, error: message }));
  };

  const refresh = async () => {
    const bridge = getBridge();
    const current = get(state);
    if (!bridge || !current.projectRoot) {
      state.update((s) => ({ ...s, available: Boolean(bridge) }));
      return;
    }

    state.update((s) => ({ ...s, loading: true, error: null, available: true }));
    try {
      const projectMeta = await readProjectMeta(bridge, current.projectRoot);
      const index = await indexProject(bridge, projectMeta);
      state.update((s) => ({
        ...s,
        projectMeta,
        assetsIndex: index.assetsIndex,
        scenesIndex: index.scenesIndex,
        aiOutputsIndex: index.aiOutputsIndex,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setError(error);
    }
  };

  const openFromPath = async (projectPath: string) => {
    const bridge = getBridge();
    state.update((s) => ({
      ...s,
      projectRoot: projectPath,
      available: Boolean(bridge),
      error: null,
    }));
    await refresh();
  };

  const openProjectFolder = async () => {
    const bridge = getBridge();
    if (!bridge) {
      state.update((s) => ({ ...s, available: false, error: 'Electron bridge is unavailable in this environment.' }));
      return null;
    }
    state.update((s) => ({ ...s, available: true, error: null }));
    try {
      const result = await bridge.openProjectFolder();
      if (!result) return null;
      await openFromPath(result.path);
      return result;
    } catch (error) {
      setError(error);
      return null;
    }
  };

  const initialize = () => {
    const bridge = getBridge();
    state.update((s) => ({ ...s, available: Boolean(bridge) }));
    if (!bridge || unlisten) return;
    unlisten = bridge.onProjectOpened(async ({ path }) => {
      if (!path) {
        clear();
        return;
      }
      await openFromPath(path);
    });
  };

  const clear = () => {
    state.set({
      ...initialState,
      available: Boolean(getBridge()),
    });
  };

  return {
    subscribe: state.subscribe,
    initialize,
    refresh,
    openProjectFolder,
    openFromPath,
    clear,
  };
};

export const projectStore = createProjectStore();
