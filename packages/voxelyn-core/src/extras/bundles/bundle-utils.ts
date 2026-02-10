import { packRGBA } from '../../core/palette.js';

export type BundleManifestType = 'scenario' | 'object' | 'texture';

export type BundleManifest = {
  version: number;
  type: BundleManifestType | string;
  mode?: string;
  prompt?: string;
  seed?: number;
  provider?: string;
  model?: string;
  scale?: number;
  size?: [number, number];
  depth?: number;
  bounds?: [number, number, number];
  files?: string[];
};

export type IsoViewConfig = {
  tileW: number;
  tileH: number;
  zStep: number;
  defaultHeight: number;
  baselineZ: number;
  axisScale: {
    x: number;
    y: number;
    z: number;
  };
  centerBiasY: number;
};

export type CameraViewConfig = {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
};

export type ViewIntentSummary = {
  macroForm?: string;
  waterSystem?: string;
  reliefEnergy?: string;
  semanticClass: string;
  confidence: number;
};

export type BundleViewSettings = {
  version: number;
  artifactType: BundleManifestType;
  presetId: string;
  intent: ViewIntentSummary;
  iso: IsoViewConfig;
  relief?: {
    strength: number;
    exponent: number;
    terrainBlend: number;
    verticalOffset: number;
  };
  camera: CameraViewConfig;
  diagnostics?: {
    heightSpan?: number;
    slopeMean?: number;
    waterCoverage?: number;
    landComponents?: number;
    extents?: {
      width: number;
      height: number;
      depth: number;
    };
    generatedFrom?: string;
  };
};

export type VisibleVoxel = {
  x: number;
  y: number;
  z: number;
  mat: number;
  showTop: boolean;
  showLeft: boolean;
  showRight: boolean;
};

export type TerrainTopSurface = {
  topZByCell: Float32Array;
  topMaterialByCell: Uint16Array;
};

export type VoxelConnectivityMetrics = {
  componentCount: number;
  largestComponentSize: number;
  filledVoxels: number;
  largestComponentRatio: number;
};

export type VoxelFillMetrics = {
  filledVoxels: number;
  totalVoxels: number;
  fillRatio: number;
  extents: {
    width: number;
    height: number;
    depth: number;
  };
  horizontalToVerticalRatio: number;
};

export type ScenarioReliefMetrics = {
  heightMin: number;
  heightMax: number;
  heightSpan: number;
  slopeMean: number;
  waterCoverage: number;
  landComponents: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const ensurePositiveInteger = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`Invalid ${field}: ${String(value)}`);
  }
  return value as number;
};

const ensureNonNegativeInteger = (value: unknown, field: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`Invalid ${field}: ${String(value)}`);
  }
  return value as number;
};

const ensureFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}: ${String(value)}`);
  }
  return value;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const isWhitespaceByte = (byte: number): boolean =>
  byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

const index3D = (x: number, y: number, z: number, width: number, height: number): number =>
  x + y * width + z * width * height;

const hasVoxelAt = (
  voxels: Uint16Array,
  width: number,
  height: number,
  depth: number,
  x: number,
  y: number,
  z: number,
): boolean => {
  if (x < 0 || y < 0 || z < 0 || x >= width || y >= height || z >= depth) {
    return false;
  }
  return (voxels[index3D(x, y, z, width, height)] ?? 0) !== 0;
};

export function parseBundleManifest(input: unknown): BundleManifest {
  if (!isRecord(input)) {
    throw new Error('Invalid manifest: expected object');
  }

  const version = input.version;
  const type = input.type;
  if (!Number.isInteger(version)) {
    throw new Error('Invalid manifest: "version" must be an integer');
  }
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error('Invalid manifest: "type" must be a non-empty string');
  }

  const output: BundleManifest = {
    version: version as number,
    type,
  };

  if (typeof input.mode === 'string') output.mode = input.mode;
  if (typeof input.prompt === 'string') output.prompt = input.prompt;
  if (typeof input.seed === 'number') output.seed = input.seed;
  if (typeof input.provider === 'string') output.provider = input.provider;
  if (typeof input.model === 'string') output.model = input.model;
  if (typeof input.scale === 'number') output.scale = input.scale;
  if (Array.isArray(input.files)) {
    output.files = input.files.filter((entry): entry is string => typeof entry === 'string');
  }

  if (Array.isArray(input.size) && input.size.length >= 2) {
    const w = Number(input.size[0]);
    const h = Number(input.size[1]);
    if (Number.isFinite(w) && Number.isFinite(h)) {
      output.size = [Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h))];
    }
  }

  if (typeof input.depth === 'number' && Number.isFinite(input.depth)) {
    output.depth = Math.max(1, Math.floor(input.depth));
  }

  if (Array.isArray(input.bounds) && input.bounds.length >= 3) {
    const x = Number(input.bounds[0]);
    const y = Number(input.bounds[1]);
    const z = Number(input.bounds[2]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      output.bounds = [Math.max(1, Math.floor(x)), Math.max(1, Math.floor(y)), Math.max(1, Math.floor(z))];
    }
  }

  return output;
}

export function validateBundleManifestFiles(
  manifest: BundleManifest,
  requiredFiles: string[],
  contextName = 'bundle',
): void {
  if (!Array.isArray(manifest.files)) {
    throw new Error(`Invalid ${contextName} manifest: "files" must be an array`);
  }
  for (const required of requiredFiles) {
    if (!manifest.files.includes(required)) {
      throw new Error(`Invalid ${contextName} manifest: missing required file "${required}"`);
    }
  }
}

export function parseViewSettings(input: unknown): BundleViewSettings {
  if (!isRecord(input)) {
    throw new Error('Invalid view settings: expected object');
  }

  const version = ensurePositiveInteger(input.version, 'view.settings.version');
  const artifactType = input.artifactType;
  if (artifactType !== 'scenario' && artifactType !== 'object' && artifactType !== 'texture') {
    throw new Error(`Invalid view.settings.artifactType: ${String(artifactType)}`);
  }

  const presetId = input.presetId;
  if (typeof presetId !== 'string' || presetId.trim().length === 0) {
    throw new Error('Invalid view.settings.presetId: expected non-empty string');
  }

  const intentRaw = input.intent;
  if (!isRecord(intentRaw)) {
    throw new Error('Invalid view.settings.intent: expected object');
  }
  const semanticClass = intentRaw.semanticClass;
  if (typeof semanticClass !== 'string' || semanticClass.trim().length === 0) {
    throw new Error('Invalid view.settings.intent.semanticClass: expected non-empty string');
  }

  const intent: ViewIntentSummary = {
    semanticClass: semanticClass.trim(),
    confidence: clamp01(ensureFiniteNumber(intentRaw.confidence, 'view.settings.intent.confidence')),
  };
  if (typeof intentRaw.macroForm === 'string') intent.macroForm = intentRaw.macroForm;
  if (typeof intentRaw.waterSystem === 'string') intent.waterSystem = intentRaw.waterSystem;
  if (typeof intentRaw.reliefEnergy === 'string') intent.reliefEnergy = intentRaw.reliefEnergy;

  const isoRaw = input.iso;
  if (!isRecord(isoRaw)) {
    throw new Error('Invalid view.settings.iso: expected object');
  }
  const axisScaleRaw = isoRaw.axisScale;
  if (!isRecord(axisScaleRaw)) {
    throw new Error('Invalid view.settings.iso.axisScale: expected object');
  }
  const iso: IsoViewConfig = {
    tileW: ensureFiniteNumber(isoRaw.tileW, 'view.settings.iso.tileW'),
    tileH: ensureFiniteNumber(isoRaw.tileH, 'view.settings.iso.tileH'),
    zStep: ensureFiniteNumber(isoRaw.zStep, 'view.settings.iso.zStep'),
    defaultHeight: ensureFiniteNumber(isoRaw.defaultHeight, 'view.settings.iso.defaultHeight'),
    baselineZ: ensureFiniteNumber(isoRaw.baselineZ, 'view.settings.iso.baselineZ'),
    axisScale: {
      x: ensureFiniteNumber(axisScaleRaw.x, 'view.settings.iso.axisScale.x'),
      y: ensureFiniteNumber(axisScaleRaw.y, 'view.settings.iso.axisScale.y'),
      z: ensureFiniteNumber(axisScaleRaw.z, 'view.settings.iso.axisScale.z'),
    },
    centerBiasY: ensureFiniteNumber(isoRaw.centerBiasY, 'view.settings.iso.centerBiasY'),
  };

  const cameraRaw = input.camera;
  if (!isRecord(cameraRaw)) {
    throw new Error('Invalid view.settings.camera: expected object');
  }
  const camera: CameraViewConfig = {
    x: ensureFiniteNumber(cameraRaw.x, 'view.settings.camera.x'),
    y: ensureFiniteNumber(cameraRaw.y, 'view.settings.camera.y'),
    zoom: ensureFiniteNumber(cameraRaw.zoom, 'view.settings.camera.zoom'),
    rotation: ensureFiniteNumber(cameraRaw.rotation, 'view.settings.camera.rotation'),
  };

  let relief: BundleViewSettings['relief'];
  if (input.relief !== undefined && input.relief !== null) {
    const reliefRaw = input.relief;
    if (!isRecord(reliefRaw)) {
      throw new Error('Invalid view.settings.relief: expected object');
    }
    relief = {
      strength: ensureFiniteNumber(reliefRaw.strength, 'view.settings.relief.strength'),
      exponent: ensureFiniteNumber(reliefRaw.exponent, 'view.settings.relief.exponent'),
      terrainBlend: clamp01(
        ensureFiniteNumber(reliefRaw.terrainBlend, 'view.settings.relief.terrainBlend'),
      ),
      verticalOffset: ensureFiniteNumber(reliefRaw.verticalOffset, 'view.settings.relief.verticalOffset'),
    };
  }

  let diagnostics: BundleViewSettings['diagnostics'];
  if (input.diagnostics !== undefined && input.diagnostics !== null) {
    const diagnosticsRaw = input.diagnostics;
    if (!isRecord(diagnosticsRaw)) {
      throw new Error('Invalid view.settings.diagnostics: expected object');
    }
    diagnostics = {};
    if (diagnosticsRaw.heightSpan !== undefined) {
      diagnostics.heightSpan = ensureFiniteNumber(
        diagnosticsRaw.heightSpan,
        'view.settings.diagnostics.heightSpan',
      );
    }
    if (diagnosticsRaw.slopeMean !== undefined) {
      diagnostics.slopeMean = ensureFiniteNumber(
        diagnosticsRaw.slopeMean,
        'view.settings.diagnostics.slopeMean',
      );
    }
    if (diagnosticsRaw.waterCoverage !== undefined) {
      diagnostics.waterCoverage = clamp01(
        ensureFiniteNumber(diagnosticsRaw.waterCoverage, 'view.settings.diagnostics.waterCoverage'),
      );
    }
    if (diagnosticsRaw.landComponents !== undefined) {
      diagnostics.landComponents = ensureNonNegativeInteger(
        diagnosticsRaw.landComponents,
        'view.settings.diagnostics.landComponents',
      );
    }
    if (typeof diagnosticsRaw.generatedFrom === 'string') {
      diagnostics.generatedFrom = diagnosticsRaw.generatedFrom;
    }
    if (diagnosticsRaw.extents !== undefined) {
      if (!isRecord(diagnosticsRaw.extents)) {
        throw new Error('Invalid view.settings.diagnostics.extents: expected object');
      }
      diagnostics.extents = {
        width: ensurePositiveInteger(diagnosticsRaw.extents.width, 'view.settings.diagnostics.extents.width'),
        height: ensurePositiveInteger(diagnosticsRaw.extents.height, 'view.settings.diagnostics.extents.height'),
        depth: ensurePositiveInteger(diagnosticsRaw.extents.depth, 'view.settings.diagnostics.extents.depth'),
      };
    }
  }

  return {
    version,
    artifactType,
    presetId: presetId.trim(),
    intent,
    iso,
    relief,
    camera,
    diagnostics,
  };
}

export function validateViewSettingsForManifest(
  view: BundleViewSettings,
  manifestType: BundleManifestType | string,
): void {
  if (view.artifactType !== manifestType) {
    throw new Error(
      `Invalid view settings: artifactType "${view.artifactType}" does not match manifest type "${manifestType}"`,
    );
  }
  if (view.artifactType === 'scenario' && !view.relief) {
    throw new Error('Invalid view settings for scenario: "relief" is required');
  }
}

export function decodePpm(buffer: ArrayBuffer): {
  width: number;
  height: number;
  pixels: Uint32Array;
} {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let cursor = 0;

  const skipSpacing = (): void => {
    while (cursor < bytes.length) {
      const byte = bytes[cursor] ?? 0;
      if (isWhitespaceByte(byte)) {
        cursor += 1;
        continue;
      }
      if (byte === 0x23) {
        while (cursor < bytes.length && bytes[cursor] !== 0x0a) {
          cursor += 1;
        }
        continue;
      }
      break;
    }
  };

  const readToken = (name: string): string => {
    skipSpacing();
    if (cursor >= bytes.length) {
      throw new Error(`Invalid texture.ppm: missing ${name}`);
    }
    const start = cursor;
    while (cursor < bytes.length) {
      const byte = bytes[cursor] ?? 0;
      if (isWhitespaceByte(byte) || byte === 0x23) break;
      cursor += 1;
    }
    if (cursor <= start) {
      throw new Error(`Invalid texture.ppm: missing ${name}`);
    }
    return decoder.decode(bytes.subarray(start, cursor));
  };

  const magic = readToken('magic header');
  if (magic !== 'P6') {
    throw new Error(`Invalid texture.ppm format: expected P6, got "${magic}"`);
  }

  const width = ensurePositiveInteger(Number(readToken('width')), 'texture.ppm width');
  const height = ensurePositiveInteger(Number(readToken('height')), 'texture.ppm height');
  const maxValue = ensurePositiveInteger(Number(readToken('max value')), 'texture.ppm max value');
  if (maxValue !== 255) {
    throw new Error(`Unsupported texture.ppm max value: expected 255, got ${maxValue}`);
  }

  const expectedRgbBytes = width * height * 3;
  if (cursor >= bytes.length || !isWhitespaceByte(bytes[cursor] ?? 0)) {
    throw new Error('Invalid texture.ppm: missing header/data delimiter');
  }

  cursor += 1;
  while (
    cursor < bytes.length &&
    isWhitespaceByte(bytes[cursor] ?? 0) &&
    bytes.length - (cursor + 1) >= expectedRgbBytes
  ) {
    cursor += 1;
  }

  const remaining = bytes.length - cursor;
  if (remaining < expectedRgbBytes) {
    throw new Error(
      `Invalid texture.ppm data length: expected at least ${expectedRgbBytes} bytes, got ${remaining}`,
    );
  }

  const pixels = new Uint32Array(width * height);
  let src = cursor;
  for (let i = 0; i < pixels.length; i += 1) {
    const r = bytes[src] ?? 0;
    const g = bytes[src + 1] ?? 0;
    const b = bytes[src + 2] ?? 0;
    pixels[i] = packRGBA(r, g, b, 255);
    src += 3;
  }

  return { width, height, pixels };
}

export function extractTerrainTopSurface(
  terrain: Uint16Array,
  width: number,
  height: number,
  depth: number,
): TerrainTopSurface {
  ensurePositiveInteger(width, 'width');
  ensurePositiveInteger(height, 'height');
  ensurePositiveInteger(depth, 'depth');
  const layerSize = width * height;
  const expected = layerSize * depth;
  if (terrain.length !== expected) {
    throw new Error(`Terrain size mismatch: expected ${expected}, got ${terrain.length}`);
  }

  const topZByCell = new Float32Array(layerSize);
  const topMaterialByCell = new Uint16Array(layerSize);
  const zDivisor = Math.max(1, depth - 1);

  for (let idx2d = 0; idx2d < layerSize; idx2d += 1) {
    let topZ = -1;
    for (let z = depth - 1; z >= 0; z -= 1) {
      const materialId = terrain[idx2d + z * layerSize] ?? 0;
      if (materialId !== 0) {
        topZ = z;
        topMaterialByCell[idx2d] = materialId;
        break;
      }
    }
    topZByCell[idx2d] = topZ >= 0 ? topZ / zDivisor : 0;
  }

  return { topZByCell, topMaterialByCell };
}

export function collectVisibleVoxels(
  voxels: Uint16Array,
  width: number,
  height: number,
  depth: number,
): VisibleVoxel[] {
  ensurePositiveInteger(width, 'width');
  ensurePositiveInteger(height, 'height');
  ensurePositiveInteger(depth, 'depth');
  const expected = width * height * depth;
  if (voxels.length !== expected) {
    throw new Error(`Voxel size mismatch: expected ${expected}, got ${voxels.length}`);
  }

  const visible: VisibleVoxel[] = [];

  for (let z = 0; z < depth; z += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const mat = voxels[index3D(x, y, z, width, height)] ?? 0;
        if (mat === 0) continue;

        const showTop = !hasVoxelAt(voxels, width, height, depth, x, y, z + 1);
        const showLeft = !hasVoxelAt(voxels, width, height, depth, x, y + 1, z);
        const showRight = !hasVoxelAt(voxels, width, height, depth, x + 1, y, z);

        if (showTop || showLeft || showRight) {
          visible.push({ x, y, z, mat, showTop, showLeft, showRight });
        }
      }
    }
  }

  visible.sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    const diagA = a.x + a.y;
    const diagB = b.x + b.y;
    if (diagA !== diagB) return diagA - diagB;
    return a.x - b.x;
  });

  return visible;
}

export function computeVoxelConnectivity(
  voxels: Uint16Array,
  width: number,
  height: number,
  depth: number,
): VoxelConnectivityMetrics {
  ensurePositiveInteger(width, 'width');
  ensurePositiveInteger(height, 'height');
  ensurePositiveInteger(depth, 'depth');
  const total = width * height * depth;
  if (voxels.length !== total) {
    throw new Error(`Voxel size mismatch: expected ${total}, got ${voxels.length}`);
  }

  const area = width * height;
  const visited = new Uint8Array(total);
  const queue = new Uint32Array(total);
  let filledVoxels = 0;
  for (let i = 0; i < total; i += 1) {
    if ((voxels[i] ?? 0) !== 0) filledVoxels += 1;
  }

  if (filledVoxels === 0) {
    return {
      componentCount: 0,
      largestComponentSize: 0,
      filledVoxels: 0,
      largestComponentRatio: 0,
    };
  }

  let componentCount = 0;
  let largestComponentSize = 0;

  for (let i = 0; i < total; i += 1) {
    if ((voxels[i] ?? 0) === 0 || visited[i] === 1) continue;

    componentCount += 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    visited[i] = 1;
    let componentSize = 0;

    while (head < tail) {
      const current = queue[head++]!;
      componentSize += 1;

      const x = current % width;
      const yz = Math.floor(current / width);
      const y = yz % height;
      const z = Math.floor(yz / height);

      if (x > 0) {
        const n = current - 1;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (x + 1 < width) {
        const n = current + 1;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = current - width;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y + 1 < height) {
        const n = current + width;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (z > 0) {
        const n = current - area;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (z + 1 < depth) {
        const n = current + area;
        if ((voxels[n] ?? 0) !== 0 && visited[n] === 0) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    if (componentSize > largestComponentSize) {
      largestComponentSize = componentSize;
    }
  }

  return {
    componentCount,
    largestComponentSize,
    filledVoxels,
    largestComponentRatio: filledVoxels > 0 ? largestComponentSize / filledVoxels : 0,
  };
}

export function computeVoxelFillMetrics(
  voxels: Uint16Array,
  width: number,
  height: number,
  depth: number,
): VoxelFillMetrics {
  ensurePositiveInteger(width, 'width');
  ensurePositiveInteger(height, 'height');
  ensurePositiveInteger(depth, 'depth');
  const total = width * height * depth;
  if (voxels.length !== total) {
    throw new Error(`Voxel size mismatch: expected ${total}, got ${voxels.length}`);
  }

  let filledVoxels = 0;
  let minX = width;
  let minY = height;
  let minZ = depth;
  let maxX = -1;
  let maxY = -1;
  let maxZ = -1;

  for (let i = 0; i < voxels.length; i += 1) {
    if ((voxels[i] ?? 0) === 0) continue;
    filledVoxels += 1;

    const x = i % width;
    const yz = Math.floor(i / width);
    const y = yz % height;
    const z = Math.floor(yz / height);

    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const extents =
    maxX < minX || maxY < minY || maxZ < minZ
      ? { width: 0, height: 0, depth: 0 }
      : {
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          depth: maxZ - minZ + 1,
        };

  const horizontalSpan = Math.max(extents.width, extents.depth);
  const verticalSpan = Math.max(1, extents.height);

  return {
    filledVoxels,
    totalVoxels: total,
    fillRatio: total > 0 ? filledVoxels / total : 0,
    extents,
    horizontalToVerticalRatio: horizontalSpan / verticalSpan,
  };
}

export function computeScenarioReliefMetrics(
  heightmap: ArrayLike<number>,
  width: number,
  height: number,
  topZByCell?: ArrayLike<number>,
): ScenarioReliefMetrics {
  ensurePositiveInteger(width, 'width');
  ensurePositiveInteger(height, 'height');
  const total = width * height;
  if (heightmap.length !== total) {
    throw new Error(`Heightmap size mismatch: expected ${total}, got ${heightmap.length}`);
  }
  if (topZByCell && topZByCell.length !== total) {
    throw new Error(`Top surface size mismatch: expected ${total}, got ${topZByCell.length}`);
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < total; i += 1) {
    const value = Number(heightmap[i] ?? 0);
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error('Invalid heightmap values: expected finite numbers');
  }

  const range = Math.max(1e-6, max - min);
  const normalized = new Float32Array(total);
  let waterCount = 0;
  const waterThreshold = 0.26;

  for (let i = 0; i < total; i += 1) {
    const hNorm = clamp01((Number(heightmap[i] ?? 0) - min) / range);
    const tNorm = topZByCell ? clamp01(Number(topZByCell[i] ?? 0)) : hNorm;
    const combined = topZByCell ? (hNorm + tNorm) * 0.5 : hNorm;
    normalized[i] = combined;
    if (combined <= waterThreshold) {
      waterCount += 1;
    }
  }

  let slopeSum = 0;
  let slopeSamples = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = x + y * width;
      const center = normalized[idx] ?? 0;
      if (x + 1 < width) {
        slopeSum += Math.abs(center - (normalized[idx + 1] ?? 0));
        slopeSamples += 1;
      }
      if (y + 1 < height) {
        slopeSum += Math.abs(center - (normalized[idx + width] ?? 0));
        slopeSamples += 1;
      }
    }
  }

  const landMask = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) {
    landMask[i] = (normalized[i] ?? 0) > waterThreshold ? 1 : 0;
  }

  let landComponents = 0;
  const queue = new Uint32Array(total);
  for (let i = 0; i < total; i += 1) {
    if (landMask[i] === 0) continue;
    landComponents += 1;
    landMask[i] = 0;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    while (head < tail) {
      const current = queue[head++]!;
      const cx = current % width;
      const cy = Math.floor(current / width);

      if (cx > 0) {
        const n = current - 1;
        if (landMask[n] === 1) {
          landMask[n] = 0;
          queue[tail++] = n;
        }
      }
      if (cx + 1 < width) {
        const n = current + 1;
        if (landMask[n] === 1) {
          landMask[n] = 0;
          queue[tail++] = n;
        }
      }
      if (cy > 0) {
        const n = current - width;
        if (landMask[n] === 1) {
          landMask[n] = 0;
          queue[tail++] = n;
        }
      }
      if (cy + 1 < height) {
        const n = current + width;
        if (landMask[n] === 1) {
          landMask[n] = 0;
          queue[tail++] = n;
        }
      }
    }
  }

  return {
    heightMin: min,
    heightMax: max,
    heightSpan: max - min,
    slopeMean: slopeSamples > 0 ? slopeSum / slopeSamples : 0,
    waterCoverage: total > 0 ? waterCount / total : 0,
    landComponents,
  };
}
