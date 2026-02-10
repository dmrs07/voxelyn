import type { ProjectEntry, ProjectIndex, ProjectMeta, ProjectPaths, VoxelynBridge } from './types';

const DEFAULT_PATHS: ProjectPaths = {
  assets: 'assets',
  scenes: 'scenes',
  worlds: 'worlds',
  generated: 'assets/generated',
  ai: 'ai',
  build: 'build',
};

const SCENE_EXT = new Set(['.scene.json', '.layout.json', '.vxf', '.world.json', '.terrain.spec.json']);
const ASSET_EXT = new Set([
  '.voxels.u16',
  '.terrain.u16',
  '.meta.json',
  '.ppm',
  '.png',
  '.jpg',
  '.jpeg',
  '.obj',
  '.json',
]);

const normalizeRelPath = (value: string): string => value.replace(/\\/g, '/').replace(/^\/+/, '');

const pathExt = (filePath: string): string => {
  const normalized = normalizeRelPath(filePath);
  const lower = normalized.toLowerCase();
  const multiExt = ['.scene.json', '.layout.json', '.world.json', '.terrain.spec.json', '.meta.json', '.voxels.u16', '.terrain.u16'];
  for (const candidate of multiExt) {
    if (lower.endsWith(candidate)) return candidate;
  }
  const index = lower.lastIndexOf('.');
  return index >= 0 ? lower.slice(index) : '';
};

const joinRel = (...parts: string[]): string =>
  parts
    .map((part) => normalizeRelPath(part))
    .filter(Boolean)
    .join('/');

const readTextFile = async (api: VoxelynBridge, relPath: string): Promise<string | null> => {
  try {
    const content = await api.projectReadFile(relPath);
    if (typeof content === 'string') return content;
    return new TextDecoder('utf-8').decode(content);
  } catch {
    return null;
  }
};

const readJsonFile = async <T>(api: VoxelynBridge, relPath: string): Promise<T | null> => {
  const text = await readTextFile(api, relPath);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const readProjectMeta = async (api: VoxelynBridge, projectRoot: string): Promise<ProjectMeta> => {
  const marker = await readJsonFile<Partial<ProjectMeta>>(api, 'voxelyn.project.json');
  const safeName = projectRoot.split(/[\\/]/).filter(Boolean).pop() ?? 'voxelyn-project';
  if (!marker || typeof marker !== 'object') {
    return {
      version: 1,
      name: safeName,
      paths: { ...DEFAULT_PATHS },
    };
  }

  const paths = marker.paths ?? {};
  return {
    version: typeof marker.version === 'number' && Number.isFinite(marker.version) ? marker.version : 1,
    name: typeof marker.name === 'string' && marker.name.trim().length > 0 ? marker.name : safeName,
    paths: {
      assets: typeof paths.assets === 'string' ? normalizeRelPath(paths.assets) : DEFAULT_PATHS.assets,
      scenes: typeof paths.scenes === 'string' ? normalizeRelPath(paths.scenes) : DEFAULT_PATHS.scenes,
      worlds: typeof paths.worlds === 'string' ? normalizeRelPath(paths.worlds) : DEFAULT_PATHS.worlds,
      generated: typeof paths.generated === 'string' ? normalizeRelPath(paths.generated) : DEFAULT_PATHS.generated,
      ai: typeof paths.ai === 'string' ? normalizeRelPath(paths.ai) : DEFAULT_PATHS.ai,
      build: typeof paths.build === 'string' ? normalizeRelPath(paths.build) : DEFAULT_PATHS.build,
    },
  };
};

const walkRecursive = async (api: VoxelynBridge, relDir: string): Promise<string[]> => {
  const exists = await api.projectExists(relDir);
  if (!exists) return [];

  const out: string[] = [];
  const stack: string[] = [normalizeRelPath(relDir)];
  while (stack.length > 0) {
    const current = stack.pop() ?? '';
    const entries = await api.projectReadDir(current || '.');
    for (const entry of entries) {
      const next = current ? joinRel(current, entry.name) : normalizeRelPath(entry.name);
      if (entry.type === 'directory') {
        stack.push(next);
      } else {
        out.push(next);
      }
    }
  }
  return out;
};

const readEntryMeta = async (api: VoxelynBridge, relPath: string): Promise<ProjectEntry['meta']> => {
  const lower = relPath.toLowerCase();
  if (lower.endsWith('scenario.scale.json') || lower.endsWith('object.meta.json') || lower.endsWith('manifest.json')) {
    const parsed = await readJsonFile<Record<string, unknown>>(api, relPath);
    if (!parsed) return undefined;
    return {
      width: typeof parsed.width === 'number' ? parsed.width : undefined,
      height: typeof parsed.height === 'number' ? parsed.height : undefined,
      depth: typeof parsed.depth === 'number' ? parsed.depth : undefined,
      type: typeof parsed.type === 'string' ? parsed.type : undefined,
    };
  }
  return undefined;
};

const toProjectEntry = async (
  api: VoxelynBridge,
  relPath: string,
  category: ProjectEntry['category']
): Promise<ProjectEntry> => {
  const normalized = normalizeRelPath(relPath);
  const parts = normalized.split('/');
  return {
    path: normalized,
    name: parts[parts.length - 1] ?? normalized,
    category,
    ext: pathExt(normalized),
    meta: await readEntryMeta(api, normalized),
  };
};

export const indexProject = async (api: VoxelynBridge, meta: ProjectMeta): Promise<ProjectIndex> => {
  const [sceneFiles, assetFiles, generatedFiles, aiFiles] = await Promise.all([
    walkRecursive(api, meta.paths.scenes),
    walkRecursive(api, meta.paths.assets),
    walkRecursive(api, meta.paths.generated),
    walkRecursive(api, meta.paths.ai),
  ]);

  const scenes = sceneFiles.filter((file) => SCENE_EXT.has(pathExt(file)));

  const assetsRaw = assetFiles.filter((file) => ASSET_EXT.has(pathExt(file)));
  const assets = assetsRaw.filter((file) => !file.toLowerCase().endsWith('/manifest.json'));

  const aiBundles = generatedFiles.filter((file) => file.toLowerCase().endsWith('/manifest.json'));
  const aiDirect = aiFiles.filter((file) => ASSET_EXT.has(pathExt(file)));

  const [sceneEntries, assetEntries, aiEntries] = await Promise.all([
    Promise.all(scenes.map((file) => toProjectEntry(api, file, 'scene'))),
    Promise.all(assets.map((file) => toProjectEntry(api, file, 'asset'))),
    Promise.all([...aiBundles, ...aiDirect].map((file) => toProjectEntry(api, file, 'ai'))),
  ]);

  sceneEntries.sort((a, b) => a.path.localeCompare(b.path));
  assetEntries.sort((a, b) => a.path.localeCompare(b.path));
  aiEntries.sort((a, b) => a.path.localeCompare(b.path));

  return {
    scenesIndex: sceneEntries,
    assetsIndex: assetEntries,
    aiOutputsIndex: aiEntries,
  };
};
