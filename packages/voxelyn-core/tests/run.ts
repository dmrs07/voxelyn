import {
  createGrid2D,
  createSurface2D,
  makePalette,
  packRGBA,
  parseBundleManifest,
  validateBundleManifestFiles,
  parseViewSettings,
  validateViewSettingsForManifest,
  computeScenarioReliefMetrics,
  decodePpm,
  extractTerrainTopSurface,
  collectVisibleVoxels,
  computeVoxelConnectivity,
  computeVoxelFillMetrics,
  getMaterial,
  getFlags,
  getXY
} from "../src/index.js";
import {
  forEachRowMajor,
  forEachBottomUp,
  forEachMorton,
  forEachChunkOrder
} from "../src/core/traversal2d.js";
import {
  decodeTiledGid,
  resolveTilesetForGid,
  tiledLayerToGrid2D,
  TILED_FLIP_H,
  TILED_FLIP_V
} from "../src/extras/importers/tiled.js";
import { parseSpineJson } from "../src/extras/importers/spine.js";
import { parseUnityMeta } from "../src/extras/importers/unity.js";
import { parseObj } from "../src/extras/importers/obj.js";
import {
  tiledLayerFixture,
  tiledChunkLayerFixture,
  tiledTilesetsFixture
} from "./fixtures/tiled.js";
import { spineFixture } from "./fixtures/spine.js";
import { unityMetaFixture } from "./fixtures/unity.js";
import { objFixture } from "./fixtures/obj.js";

const assert = (cond: boolean, msg: string): void => {
  if (!cond) throw new Error(msg);
};

const g = createGrid2D(4, 4, { chunkSize: 2 });
assert(g.chunkCountX === 2, "chunkCountX");
assert(g.chunkCountY === 2, "chunkCountY");

let count = 0;
forEachRowMajor(4, 4, () => count++);
assert(count === 16, "row-major count");

count = 0;
forEachBottomUp(4, 4, () => count++);
assert(count === 16, "bottom-up count");

count = 0;
forEachMorton(4, 4, () => count++);
assert(count === 16, "morton count");

count = 0;
forEachChunkOrder(g, 1234, () => count++);
assert(count === 4, "chunk order count");

const surface = createSurface2D(2, 2);
const palette = makePalette(4, 0, [[1, packRGBA(255, 0, 0, 255)]]);

surface.pixels[0] = palette[1] ?? 0;
assert(surface.pixels[0] !== 0, "palette color");

const gidInfo = decodeTiledGid(1 | 0x80000000 | 0x20000000);
assert(gidInfo.flipH && gidInfo.flipD && !gidInfo.flipV, "tiled flip decode");

const resolved = resolveTilesetForGid(tiledTilesetsFixture, 6);
assert(resolved?.tileset.name === "extra", "tiled resolve tileset");
assert(resolved?.localId === 1, "tiled resolve localId");

const tiledGrid = createGrid2D(4, 4, { chunkSize: 2 });
tiledLayerToGrid2D(tiledLayerFixture, tiledGrid, {
  tileW: 16,
  tileH: 16,
  tilesets: tiledTilesetsFixture,
  gidToMaterial: (info) => (info.localId !== undefined ? info.localId + 1 : info.id)
});

const cellA = getXY(tiledGrid, 1, 0);
assert(getMaterial(cellA) === 1, "tiled material");
const flagsA = getFlags(cellA);
assert((flagsA & TILED_FLIP_H) !== 0, "tiled flip H");
assert((flagsA & TILED_FLIP_V) !== 0, "tiled flip V");

const emptyCell = getXY(tiledGrid, 2, 0);
assert(emptyCell === 0, "tiled empty cell");

const tiledChunkGrid = createGrid2D(4, 4, { chunkSize: 2 });
tiledLayerToGrid2D(tiledChunkLayerFixture, tiledChunkGrid, {
  tilesets: tiledTilesetsFixture,
  gidToMaterial: (info) => (info.localId !== undefined ? info.localId + 1 : info.id)
});

const chunkCell = getXY(tiledChunkGrid, 2, 1);
assert(getMaterial(chunkCell) === 1, "tiled chunk material");

const spine = parseSpineJson(spineFixture);
assert(spine.meta.version === "4.1", "spine version");
assert(spine.meta.hash === "abc123", "spine hash");

const unity = parseUnityMeta(unityMetaFixture);
assert(unity.sprites.length === 2, "unity sprite count");
assert(unity.sprites[0]?.name === "hero", "unity sprite name");
assert(unity.sprites[1]?.pivot.y === 0.75, "unity sprite pivot");

const mesh = parseObj(objFixture);
assert(mesh.indices.length === 9, "obj indices count");
const vertexCount = mesh.positions.length / 3;
if (mesh.uvs) assert(mesh.uvs.length === vertexCount * 2, "obj uv length");
if (mesh.normals) assert(mesh.normals.length === vertexCount * 3, "obj normal length");

const meshFlipped = parseObj(objFixture, { flipV: true });
if (mesh.uvs && meshFlipped.uvs) {
  const originalV = mesh.uvs[1];
  const flippedV = meshFlipped.uvs[1];
  if (originalV !== undefined && flippedV !== undefined) {
    assert(flippedV === 1 - originalV, "obj flipV");
  }
}

const manifest = parseBundleManifest({
  version: 1,
  type: "object",
  files: ["object.meta.json", "object.voxels.u16"],
});
validateBundleManifestFiles(manifest, ["object.meta.json"], "object");

const parsedView = parseViewSettings({
  version: 1,
  artifactType: "scenario",
  presetId: "scenario-flatlands-v1",
  intent: {
    semanticClass: "flatlands",
    confidence: 0.82,
    macroForm: "plain",
  },
  iso: {
    tileW: 32,
    tileH: 16,
    zStep: 18,
    defaultHeight: 14,
    baselineZ: 0,
    axisScale: { x: 1, y: 1, z: 1 },
    centerBiasY: 0.56,
  },
  relief: {
    strength: 2.2,
    exponent: 1.15,
    terrainBlend: 0.48,
    verticalOffset: 0,
  },
  camera: {
    x: 0,
    y: 14,
    zoom: 1.05,
    rotation: 0,
  },
});
validateViewSettingsForManifest(parsedView, "scenario");

const ppmText = "P6\n2 1\n255\n";
const ppmData = new Uint8Array([
  ...new TextEncoder().encode(ppmText),
  255, 0, 0,
  0, 255, 0,
]);
const decoded = decodePpm(ppmData.buffer);
assert(decoded.width === 2 && decoded.height === 1, "ppm decode dimensions");
assert(decoded.pixels.length === 2, "ppm decode pixels");

const terrain = new Uint16Array([
  // z0
  1, 0,
  0, 2,
  // z1
  0, 3,
  0, 0,
]);
const topSurface = extractTerrainTopSurface(terrain, 2, 2, 2);
assert(topSurface.topMaterialByCell[0] === 1, "top material cell 0");
assert(topSurface.topMaterialByCell[1] === 3, "top material cell 1");

const voxels = new Uint16Array([
  // z0
  1, 1,
  0, 0,
  // z1
  0, 0,
  2, 0,
]);
const visible = collectVisibleVoxels(voxels, 2, 2, 2);
assert(visible.length >= 2, "visible voxel extraction");

const connectivity = computeVoxelConnectivity(voxels, 2, 2, 2);
assert(connectivity.componentCount === 2, "connectivity components");

const fillMetrics = computeVoxelFillMetrics(voxels, 2, 2, 2);
assert(fillMetrics.filledVoxels === 3, "fill metrics filled count");
assert(fillMetrics.fillRatio > 0.3 && fillMetrics.fillRatio < 0.4, "fill metrics ratio");

const reliefMetrics = computeScenarioReliefMetrics(
  new Float32Array([
    0.1, 0.2, 0.8,
    0.2, 0.35, 0.9,
    0.15, 0.4, 0.88,
  ]),
  3,
  3,
);
assert(reliefMetrics.heightSpan > 0.7, "scenario relief height span");
assert(reliefMetrics.slopeMean > 0.09, "scenario relief slope mean");
assert(reliefMetrics.waterCoverage > 0 && reliefMetrics.waterCoverage < 0.6, "scenario water coverage");
assert(reliefMetrics.landComponents >= 1, "scenario land components");

console.log("tests ok");
