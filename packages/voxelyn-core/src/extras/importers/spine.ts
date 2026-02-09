/**
 * Minimal Spine JSON parser (v0.1).
 * Accepts unknown fields for forward compatibility.
 */

export type SpineJson = Record<string, unknown>;

export type SpineSkeleton = {
  version?: string;
  spine?: string;
  hash?: string;
  [key: string]: unknown;
};

export type SpineParseResult = {
  data: SpineJson;
  meta: {
    version?: string;
    hash?: string;
  };
};

export function parseSpineJson(json: unknown): SpineParseResult {
  if (!json || typeof json !== 'object') {
    throw new Error('Spine JSON invalido');
  }

  const data = json as SpineJson;
  const skeletonRaw = data.skeleton;
  const skeleton =
    skeletonRaw && typeof skeletonRaw === 'object'
      ? (skeletonRaw as SpineSkeleton)
      : undefined;

  const version =
    typeof skeleton?.version === 'string'
      ? skeleton.version
      : typeof skeleton?.spine === 'string'
        ? skeleton.spine
        : undefined;

  const hash = typeof skeleton?.hash === 'string' ? skeleton.hash : undefined;

  return {
    data,
    meta: {
      version,
      hash
    }
  };
}
