export type ProjectDirEntry = {
  name: string;
  type: 'file' | 'directory';
};

export type ProjectPaths = {
  assets: string;
  scenes: string;
  worlds: string;
  generated: string;
  ai: string;
  build: string;
};

export type ProjectMeta = {
  version: number;
  name: string;
  paths: ProjectPaths;
};

export type ProjectEntry = {
  path: string;
  name: string;
  category: 'scene' | 'asset' | 'ai';
  ext: string;
  meta?: {
    width?: number;
    height?: number;
    depth?: number;
    type?: string;
  };
};

export type ProjectIndex = {
  assetsIndex: ProjectEntry[];
  scenesIndex: ProjectEntry[];
  aiOutputsIndex: ProjectEntry[];
};

export type VoxelynBridge = {
  openProjectFolder: () => Promise<{ path: string } | null>;
  openProjectPath: (projectPath: string) => Promise<{ path: string } | null>;
  selectDirectory: () => Promise<{ path: string } | null>;
  projectReadFile: (relPath: string) => Promise<string | Uint8Array>;
  projectReadDir: (relPath: string) => Promise<ProjectDirEntry[]>;
  projectExists: (relPath: string) => Promise<boolean>;
  projectWriteFile: (relPath: string, data: string | Uint8Array) => Promise<void>;
  projectJoin: (...rel: string[]) => Promise<string>;
  onProjectOpened: (cb: (payload: { path: string | null }) => void) => () => void;
};
