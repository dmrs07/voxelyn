import { get, writable } from 'svelte/store';
import { projectStore } from '$lib/project/store';
import { generateMapArtifact } from './generate-map';
import { createDefaultWorldFile, parseWorldFile, serializeWorldFile } from './serialization';
import type { ViewMode } from '$lib/document/types';
import type { GeneratedMapArtifact, Vec3, WorldFile, WorldItem, WorldItemType, WorldTransform } from './types';

type WorldState = {
  world: WorldFile;
  selectedItemId: string | null;
  composerMode: boolean;
  testMode: boolean;
  heroPosition: Vec3;
  heroSpawnPlacementMode: boolean;
  loading: boolean;
  dirty: boolean;
  message: string | null;
  error: string | null;
};

export type WorldStoreState = WorldState;

type HistorySnapshot = {
  world: WorldFile;
  selectedItemId: string | null;
};

const DEFAULT_WORLD_FILE = 'worlds/default.world.json';
const DEFAULT_MAP_FILE = 'build/maps/default.map.json';

const deepCloneWorld = (world: WorldFile): WorldFile =>
  JSON.parse(JSON.stringify(world)) as WorldFile;

const toVec3 = (value: number[]): Vec3 => [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];

const createItemId = (): string =>
  `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const getBridge = () => {
  if (typeof window === 'undefined') return null;
  return (window as Window & { voxelyn?: {
    projectReadFile: (relPath: string) => Promise<string | Uint8Array>;
    projectWriteFile: (relPath: string, data: string | Uint8Array) => Promise<void>;
    projectExists: (relPath: string) => Promise<boolean>;
  } }).voxelyn ?? null;
};

const itemAabb = (item: WorldItem) => {
  const width = Math.max(0.5, Number(item.meta.width ?? 1) * Math.max(0.1, item.transform.scale[0]));
  const height = Math.max(0.5, Number(item.meta.height ?? 1) * Math.max(0.1, item.transform.scale[1]));
  const depth = Math.max(0.5, Number(item.meta.depth ?? 1) * Math.max(0.1, item.transform.scale[2]));
  return {
    min: [item.transform.position[0], item.transform.position[1], item.transform.position[2]] as Vec3,
    max: [
      item.transform.position[0] + width,
      item.transform.position[1] + height,
      item.transform.position[2] + depth,
    ] as Vec3,
  };
};

const intersectsAabb = (a: { min: Vec3; max: Vec3 }, b: { min: Vec3; max: Vec3 }): boolean =>
  a.min[0] < b.max[0] &&
  a.max[0] > b.min[0] &&
  a.min[1] < b.max[1] &&
  a.max[1] > b.min[1] &&
  a.min[2] < b.max[2] &&
  a.max[2] > b.min[2];

const constrainTransformForViewMode = (
  viewMode: ViewMode,
  current: WorldTransform,
  patch: Partial<WorldTransform>,
): WorldTransform => {
  const next: WorldTransform = {
    position: patch.position ? [...patch.position] as Vec3 : [...current.position] as Vec3,
    rotation: patch.rotation ? [...patch.rotation] as Vec3 : [...current.rotation] as Vec3,
    scale: patch.scale ? [...patch.scale] as Vec3 : [...current.scale] as Vec3,
  };

  if (viewMode === '2d') {
    // 2D top-down edits in XY plane and blocks height (Z).
    next.position[2] = current.position[2];
    // Yaw-only for 2D edit mode.
    next.rotation[0] = 0;
    next.rotation[1] = 0;
  }

  return next;
};

const createWorldStore = () => {
  const state = writable<WorldState>({
    world: createDefaultWorldFile(),
    selectedItemId: null,
    composerMode: false,
    testMode: false,
    heroPosition: [0, 0, 0],
    heroSpawnPlacementMode: false,
    loading: false,
    dirty: false,
    message: null,
    error: null,
  });

  let past: HistorySnapshot[] = [];
  let future: HistorySnapshot[] = [];
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let currentProjectRoot: string | null = null;

  const pushHistory = () => {
    const current = get(state);
    past.push({
      world: deepCloneWorld(current.world),
      selectedItemId: current.selectedItemId,
    });
    if (past.length > 100) past = past.slice(-100);
    future = [];
  };

  const setWorld = (world: WorldFile, selectedItemId: string | null = null) => {
    state.update((s) => ({
      ...s,
      world,
      selectedItemId,
      heroPosition: toVec3(world.hero.spawn),
      dirty: false,
      error: null,
    }));
  };

  const markDirty = () => {
    state.update((s) => ({ ...s, dirty: true, message: null, error: null }));
  };

  const scheduleAutosave = () => {
    if (!currentProjectRoot) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      void saveWorld();
    }, 400);
  };

  const mutateWorld = (mutator: (world: WorldFile) => WorldFile) => {
    pushHistory();
    state.update((s) => ({ ...s, world: mutator(deepCloneWorld(s.world)) }));
    markDirty();
    scheduleAutosave();
  };

  const loadFromProject = async () => {
    const bridge = getBridge();
    const project = get(projectStore);
    if (!bridge || !project.projectRoot) {
      currentProjectRoot = null;
      setWorld(createDefaultWorldFile());
      return;
    }

    currentProjectRoot = project.projectRoot;
    state.update((s) => ({ ...s, loading: true, error: null, message: null }));

    try {
      const exists = await bridge.projectExists(DEFAULT_WORLD_FILE);
      if (!exists) {
        const initial = createDefaultWorldFile();
        setWorld(initial);
        state.update((s) => ({ ...s, loading: false, message: 'Initialized new world file.' }));
        return;
      }
      const raw = await bridge.projectReadFile(DEFAULT_WORLD_FILE);
      const text = typeof raw === 'string' ? raw : new TextDecoder('utf-8').decode(raw);
      const parsed = parseWorldFile(JSON.parse(text));
      past = [];
      future = [];
      setWorld(parsed);
      state.update((s) => ({ ...s, loading: false, message: `Loaded ${DEFAULT_WORLD_FILE}` }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.update((s) => ({ ...s, loading: false, error: message }));
    }
  };

  const saveWorld = async () => {
    const bridge = getBridge();
    if (!bridge || !currentProjectRoot) return false;
    const current = get(state);
    try {
      await bridge.projectWriteFile(DEFAULT_WORLD_FILE, serializeWorldFile(current.world));
      state.update((s) => ({ ...s, dirty: false, message: `Saved ${DEFAULT_WORLD_FILE}`, error: null }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.update((s) => ({ ...s, error: message }));
      return false;
    }
  };

  const generateMap = async (): Promise<GeneratedMapArtifact | null> => {
    const bridge = getBridge();
    if (!bridge || !currentProjectRoot) {
      state.update((s) => ({ ...s, error: 'No project root is open.' }));
      return null;
    }
    const current = get(state);
    const artifact = await generateMapArtifact(current.world, (sourceRef) => bridge.projectExists(sourceRef));
    try {
      await bridge.projectWriteFile(DEFAULT_MAP_FILE, JSON.stringify(artifact, null, 2));
      state.update((s) => ({
        ...s,
        message: artifact.errors.length > 0 ? `Map generated with ${artifact.errors.length} warning(s).` : 'Map generated successfully.',
        error: null,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      state.update((s) => ({ ...s, error: message }));
    }
    return artifact;
  };

  const addItem = (entry: {
    type: WorldItemType;
    sourceRef: string;
    position?: Vec3;
    meta?: WorldItem['meta'];
  }) => {
    mutateWorld((world) => {
      const item: WorldItem = {
        id: createItemId(),
        type: entry.type,
        sourceRef: entry.sourceRef.replace(/\\/g, '/'),
        transform: {
          position: entry.position ?? [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        meta: entry.meta ?? {},
      };
      world.items.push(item);
      return world;
    });
    const latest = get(state);
    const last = latest.world.items[latest.world.items.length - 1];
    state.update((s) => ({ ...s, selectedItemId: last?.id ?? s.selectedItemId }));
  };

  const updateSelectedTransform = (patch: Partial<WorldTransform>) => {
    const selected = get(state).selectedItemId;
    if (!selected) return;
    mutateWorld((world) => {
      const item = world.items.find((entry) => entry.id === selected);
      if (!item) return world;
      item.transform = constrainTransformForViewMode(world.viewMode, item.transform, patch);
      return world;
    });
  };

  const moveSelectedBy = (delta: Vec3) => {
    const selected = get(state).selectedItemId;
    if (!selected) return;
    const current = get(state);
    const selectedItem = current.world.items.find((item) => item.id === selected);
    if (!selectedItem) return;
    const next: Vec3 = [
      selectedItem.transform.position[0] + delta[0],
      selectedItem.transform.position[1] + delta[1],
      selectedItem.transform.position[2] + delta[2],
    ];
    updateSelectedTransform({ position: next });
  };

  const rotateSelectedBy = (delta: Vec3) => {
    const selected = get(state).selectedItemId;
    if (!selected) return;
    const current = get(state);
    const selectedItem = current.world.items.find((item) => item.id === selected);
    if (!selectedItem) return;
    const next: Vec3 = [
      selectedItem.transform.rotation[0] + delta[0],
      selectedItem.transform.rotation[1] + delta[1],
      selectedItem.transform.rotation[2] + delta[2],
    ];
    updateSelectedTransform({ rotation: next });
  };

  const removeSelected = () => {
    const selected = get(state).selectedItemId;
    if (!selected) return;
    mutateWorld((world) => {
      world.items = world.items.filter((item) => item.id !== selected);
      if (world.hero.itemId === selected) {
        world.hero.itemId = undefined;
      }
      return world;
    });
    state.update((s) => ({ ...s, selectedItemId: null }));
  };

  const setHeroSpawn = (spawn: Vec3) => {
    mutateWorld((world) => {
      world.hero.spawn = spawn;
      return world;
    });
    state.update((s) => ({ ...s, heroPosition: spawn, heroSpawnPlacementMode: false }));
  };

  const setSelectedAsHero = () => {
    const selected = get(state).selectedItemId;
    if (!selected) return;
    mutateWorld((world) => {
      world.hero.itemId = selected;
      return world;
    });
  };

  const toggleTestMode = (enabled: boolean) => {
    if (enabled) {
      const current = get(state);
      const heroSource = current.world.items.find((item) => item.id === current.world.hero.itemId);
      const heroPosition = heroSource ? toVec3(heroSource.transform.position) : toVec3(current.world.hero.spawn);
      state.update((s) => ({ ...s, testMode: true, heroPosition, heroSpawnPlacementMode: false }));
      return;
    }
    state.update((s) => ({ ...s, testMode: false, heroPosition: toVec3(s.world.hero.spawn) }));
  };

  const moveHeroBy = (delta: Vec3) => {
    const current = get(state);
    if (!current.testMode) return;
    const next: Vec3 = [
      current.heroPosition[0] + delta[0],
      current.heroPosition[1] + delta[1],
      current.heroPosition[2] + delta[2],
    ];

    if (current.world.hero.collision === 'off') {
      state.update((s) => ({ ...s, heroPosition: next }));
      return;
    }

    const heroAabb = {
      min: [next[0] - 0.35, next[1], next[2] - 0.35] as Vec3,
      max: [next[0] + 0.35, next[1] + 1.8, next[2] + 0.35] as Vec3,
    };
    const hit = current.world.items.some((item) => intersectsAabb(heroAabb, itemAabb(item)));
    if (!hit) {
      state.update((s) => ({ ...s, heroPosition: next }));
    }
  };

  const setComposerOption = (patch: Partial<WorldFile['composer']>) => {
    mutateWorld((world) => {
      world.composer = { ...world.composer, ...patch };
      return world;
    });
  };

  const setViewMode = (viewMode: ViewMode) => {
    state.update((s) => {
      if (s.world.viewMode === viewMode) return s;
      const world = deepCloneWorld(s.world);
      world.viewMode = viewMode;
      return { ...s, world, dirty: true };
    });
    scheduleAutosave();
  };

  const undo = () => {
    if (past.length === 0) return;
    const current = get(state);
    const previous = past[past.length - 1];
    past = past.slice(0, -1);
    future = [
      {
        world: deepCloneWorld(current.world),
        selectedItemId: current.selectedItemId,
      },
      ...future,
    ];
    state.update((s) => ({
      ...s,
      world: deepCloneWorld(previous.world),
      selectedItemId: previous.selectedItemId,
      dirty: true,
    }));
    scheduleAutosave();
  };

  const redo = () => {
    if (future.length === 0) return;
    const current = get(state);
    const next = future[0];
    future = future.slice(1);
    past = [
      ...past,
      {
        world: deepCloneWorld(current.world),
        selectedItemId: current.selectedItemId,
      },
    ];
    state.update((s) => ({
      ...s,
      world: deepCloneWorld(next.world),
      selectedItemId: next.selectedItemId,
      dirty: true,
    }));
    scheduleAutosave();
  };

  projectStore.subscribe((project) => {
    if (project.projectRoot !== currentProjectRoot) {
      void loadFromProject();
    }
  });

  return {
    subscribe: state.subscribe,
    loadFromProject,
    saveWorld,
    generateMap,
    setComposerMode: (enabled: boolean) => state.update((s) => ({ ...s, composerMode: enabled })),
    setHeroSpawnPlacementMode: (enabled: boolean) => state.update((s) => ({ ...s, heroSpawnPlacementMode: enabled })),
    setSelectedItem: (id: string | null) => state.update((s) => ({ ...s, selectedItemId: id })),
    addItem,
    updateSelectedTransform,
    moveSelectedBy,
    rotateSelectedBy,
    removeSelected,
    setSelectedAsHero,
    setHeroSpawn,
    toggleTestMode,
    moveHeroBy,
    setComposerOption,
    setViewMode,
    undo,
    redo,
  };
};

export const worldStore = createWorldStore();
