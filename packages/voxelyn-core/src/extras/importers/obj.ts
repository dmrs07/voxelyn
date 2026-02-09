/**
 * Minimal Wavefront OBJ parser (v0.1).
 * Supports v/vt/vn/f, negative indices and N-gon triangulation.
 */

export type ObjMesh = {
  positions: Float32Array;
  uvs?: Float32Array;
  normals?: Float32Array;
  indices: Uint16Array | Uint32Array;
};

export type ObjParseOptions = {
  triangulate?: boolean;
  flipV?: boolean;
};

type FaceVertex = {
  v: number;
  vt?: number;
  vn?: number;
};

type Face = {
  verts: FaceVertex[];
};

const resolveIndex = (raw: number, length: number): number => {
  const idx = raw < 0 ? length + raw + 1 : raw;
  return idx - 1;
};

export function parseObj(text: string, options: ObjParseOptions = {}): ObjMesh {
  const triangulate = options.triangulate ?? true;
  const flipV = options.flipV ?? false;

  const positions: number[][] = [];
  const uvs: number[][] = [];
  const normals: number[][] = [];
  const faces: Face[] = [];
  let usesUV = false;
  let usesNormal = false;

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    const head = parts[0];
    if (head === 'v') {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      positions.push([x || 0, y || 0, z || 0]);
      continue;
    }
    if (head === 'vt') {
      const u = Number(parts[1]);
      const v = Number(parts[2]);
      uvs.push([u || 0, v || 0]);
      continue;
    }
    if (head === 'vn') {
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      normals.push([x || 0, y || 0, z || 0]);
      continue;
    }
    if (head === 'f') {
      const verts: FaceVertex[] = [];
      for (let i = 1; i < parts.length; i += 1) {
        const token = parts[i];
        if (!token) continue;
        const [vRaw, vtRaw, vnRaw] = token.split('/');
        const vIndex = resolveIndex(Number(vRaw), positions.length);
        const vtIndex = vtRaw ? resolveIndex(Number(vtRaw), uvs.length) : undefined;
        const vnIndex = vnRaw ? resolveIndex(Number(vnRaw), normals.length) : undefined;
        if (vtIndex !== undefined) usesUV = true;
        if (vnIndex !== undefined) usesNormal = true;
        verts.push({ v: vIndex, vt: vtIndex, vn: vnIndex });
      }
      if (verts.length >= 3) faces.push({ verts });
      continue;
    }
  }

  const outPositions: number[] = [];
  const outUvs: number[] = [];
  const outNormals: number[] = [];
  const indices: number[] = [];
  const vertexMap = new Map<string, number>();

  const getVertexIndex = (vert: FaceVertex): number => {
    const key = `${vert.v}/${vert.vt ?? ''}/${vert.vn ?? ''}`;
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const pos = positions[vert.v];
    if (!pos) throw new Error('OBJ invalid vertex index');
    const newIndex = outPositions.length / 3;
    outPositions.push(pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0);

    if (usesUV) {
      const uv = vert.vt !== undefined ? uvs[vert.vt] : undefined;
      const u = uv?.[0] ?? 0;
      const v = uv?.[1] ?? 0;
      outUvs.push(u, flipV ? 1 - v : v);
    }

    if (usesNormal) {
      const n = vert.vn !== undefined ? normals[vert.vn] : undefined;
      outNormals.push(n?.[0] ?? 0, n?.[1] ?? 0, n?.[2] ?? 0);
    }

    vertexMap.set(key, newIndex);
    return newIndex;
  };

  for (const face of faces) {
    if (!triangulate && face.verts.length !== 3) {
      throw new Error('OBJ face is not a triangle and triangulate is false');
    }
    if (face.verts.length === 3) {
      for (const vert of face.verts) indices.push(getVertexIndex(vert));
      continue;
    }
    for (let i = 1; i < face.verts.length - 1; i += 1) {
      const a = getVertexIndex(face.verts[0]!);
      const b = getVertexIndex(face.verts[i]!);
      const c = getVertexIndex(face.verts[i + 1]!);
      indices.push(a, b, c);
    }
  }

  const maxIndex = indices.reduce((max, val) => (val > max ? val : max), 0);
  const IndexArray = maxIndex > 65535 ? Uint32Array : Uint16Array;

  return {
    positions: new Float32Array(outPositions),
    uvs: usesUV ? new Float32Array(outUvs) : undefined,
    normals: usesNormal ? new Float32Array(outNormals) : undefined,
    indices: new IndexArray(indices)
  };
}
