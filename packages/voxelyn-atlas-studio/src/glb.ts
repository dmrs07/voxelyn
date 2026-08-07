// Import de GLB (glTF 2.0 binario): malha, esqueleto e ANIMACAO.
//
// Por que GLB e nao FBX/USDZ: GLB e um arquivo unico e autocontido (geometria +
// esqueleto + pesos de skin + animacoes no mesmo binario), com um cabecalho JSON
// legivel — da para ler inteiro aqui, sem dependencia, o que importa num PWA que
// roda offline no celular. FBX e proprietario e exigiria um parser grande; USDZ
// e um zip de USD com o payload em binario proprio. GLB e o unico dos tres que
// cabe em um arquivo deste tamanho.
//
// O que este modulo faz: amostra a malha JA DEFORMADA pelo esqueleto num
// instante da animacao e devolve triangulos soltos — a mesma forma que o
// voxelizador do STL ja consome. Assim uma animacao do Meshy vira frames
// Voxelyn passando pelo caminho que ja existe e ja foi testado.

export type GlbClip = { name: string; duration: number };

export type GlbScene = {
  animations: GlbClip[];
  triangleCount: number;
  vertexCount: number;
  /**
   * Triangulos (9 floats por triangulo) da malha no instante `t` do clipe. Com
   * `clip = null` devolve a pose de repouso.
   */
  sample: (clip: number | null, t: number) => Float32Array;
};

/** Como girar o modelo para o espaco do editor (z para cima, frente = -y). */
export type GlbOrientation = {
  /** eixo "para cima" no arquivo. glTF diz Y; exportadores de CAD as vezes usam Z. */
  up: 'y' | 'z';
  /** giro em torno do eixo vertical, em graus, para o bicho olhar para a frente */
  yaw: 0 | 90 | 180 | 270;
};

export const DEFAULT_ORIENTATION: GlbOrientation = { up: 'y', yaw: 0 };

// o glTF e um JSON de forma variavel (extensoes, campos opcionais); tipar cada
// no aqui seria copiar o schema inteiro sem ganhar seguranca de verdade — a
// validacao que importa e a de runtime, logo abaixo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Mat4 = Float32Array; // coluna-maior, como no glTF

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_SIZE: Record<number, number> = {
  5120: 1, // BYTE
  5121: 1, // UNSIGNED_BYTE
  5122: 2, // SHORT
  5123: 2, // UNSIGNED_SHORT
  5125: 4, // UNSIGNED_INT
  5126: 4, // FLOAT
};

const TYPE_COUNT: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

// ---------------------------------------------------------------- matrizes

const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const multiply = (a: Mat4, b: Mat4): Mat4 => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

const fromTRS = (t: number[], r: number[], s: number[]): Mat4 => {
  const [x, y, z, w] = r;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2;
  const yy = y * y2,
    yz = y * z2,
    zz = z * z2;
  const wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  return new Float32Array([
    (1 - (yy + zz)) * s[0],
    (xy + wz) * s[0],
    (xz - wy) * s[0],
    0,
    (xy - wz) * s[1],
    (1 - (xx + zz)) * s[1],
    (yz + wx) * s[1],
    0,
    (xz + wy) * s[2],
    (yz - wx) * s[2],
    (1 - (xx + yy)) * s[2],
    0,
    t[0],
    t[1],
    t[2],
    1,
  ]);
};

const transformPoint = (m: Mat4, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

// -------------------------------------------------------------- interpolacao

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Slerp de quaternions com correcao de sinal — sem ela o giro pode "dar a volta". */
const slerp = (a: number[], b: number[], t: number): number[] => {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (dot < 0) {
    bb = [-b[0], -b[1], -b[2], -b[3]];
    dot = -dot;
  }
  if (dot > 0.9995) {
    const out = [
      lerp(a[0], bb[0], t),
      lerp(a[1], bb[1], t),
      lerp(a[2], bb[2], t),
      lerp(a[3], bb[3], t),
    ];
    const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
    return out.map((v) => v / l);
  }
  const theta = Math.acos(dot);
  const sin = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sin;
  const wb = Math.sin(t * theta) / sin;
  return [
    a[0] * wa + bb[0] * wb,
    a[1] * wa + bb[1] * wb,
    a[2] * wa + bb[2] * wb,
    a[3] * wa + bb[3] * wb,
  ];
};

/** Hermite cubico do glTF: a saida tem [tangenteEntrada, valor, tangenteSaida]. */
const cubicSpline = (
  v0: number[],
  outTangent0: number[],
  inTangent1: number[],
  v1: number[],
  dt: number,
  t: number,
): number[] => {
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return v0.map(
    (_, i) => h00 * v0[i] + h10 * dt * outTangent0[i] + h01 * v1[i] + h11 * dt * inTangent1[i],
  );
};

// ------------------------------------------------------------------ parsing

const decodeBase64 = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

type Channel = {
  node: number;
  path: 'translation' | 'rotation' | 'scale';
  times: Float32Array;
  values: Float32Array;
  stride: number;
  interpolation: string;
};

export const parseGlb = (buffer: ArrayBuffer): GlbScene => {
  const dv = new DataView(buffer);
  if (buffer.byteLength < 12 || dv.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('arquivo nao e um GLB (glTF binario)');
  }
  if (dv.getUint32(4, true) !== 2) throw new Error('so glTF 2.0 e suportado');

  let json: Json | null = null;
  let bin: Uint8Array | null = null;
  let off = 12;
  while (off + 8 <= buffer.byteLength) {
    const length = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === CHUNK_JSON) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length)));
    } else if (type === CHUNK_BIN) {
      bin = new Uint8Array(buffer, start, length);
    }
    off = start + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error('GLB sem bloco JSON');

  const buffers: Uint8Array[] = (json.buffers ?? []).map((b: Json, i: number) => {
    if (typeof b.uri === 'string') {
      const comma = b.uri.indexOf(',');
      if (!b.uri.startsWith('data:')) {
        throw new Error('GLB aponta para um arquivo externo — exporte como GLB autocontido');
      }
      return decodeBase64(b.uri.slice(comma + 1));
    }
    if (i === 0 && bin) return bin;
    throw new Error('GLB sem os dados binarios');
  });

  const viewOf = (index: number): { data: Uint8Array; stride: number } => {
    const v = json!.bufferViews[index];
    const buf = buffers[v.buffer ?? 0];
    return {
      data: new Uint8Array(buf.buffer, buf.byteOffset + (v.byteOffset ?? 0), v.byteLength),
      stride: v.byteStride ?? 0,
    };
  };

  /** Le um accessor como Float32Array achatado (count * componentes). */
  const readAccessor = (index: number): Float32Array => {
    const acc = json!.accessors[index];
    const comps = TYPE_COUNT[acc.type];
    if (!comps) throw new Error(`tipo de accessor desconhecido: ${acc.type}`);
    const out = new Float32Array(acc.count * comps);
    if (acc.bufferView === undefined) return out; // accessor "zerado" e legal no spec

    const { data, stride: viewStride } = viewOf(acc.bufferView);
    const size = COMPONENT_SIZE[acc.componentType];
    const elemStride = viewStride || comps * size;
    const dvv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const base = acc.byteOffset ?? 0;
    for (let i = 0; i < acc.count; i++) {
      for (let c = 0; c < comps; c++) {
        const at = base + i * elemStride + c * size;
        let v: number;
        switch (acc.componentType) {
          case 5126:
            v = dvv.getFloat32(at, true);
            break;
          case 5125:
            v = dvv.getUint32(at, true);
            break;
          case 5123:
            v = dvv.getUint16(at, true);
            break;
          case 5122:
            v = dvv.getInt16(at, true);
            break;
          case 5121:
            v = dvv.getUint8(at);
            break;
          case 5120:
            v = dvv.getInt8(at);
            break;
          default:
            throw new Error(`componentType desconhecido: ${acc.componentType}`);
        }
        // normalizado: inteiro guarda uma fracao (pesos de skin costumam vir assim)
        if (acc.normalized) {
          if (acc.componentType === 5121) v /= 255;
          else if (acc.componentType === 5123) v /= 65535;
          else if (acc.componentType === 5120) v = Math.max(v / 127, -1);
          else if (acc.componentType === 5122) v = Math.max(v / 32767, -1);
        }
        out[i * comps + c] = v;
      }
    }
    return out;
  };

  const nodes: Json[] = json.nodes ?? [];
  const parentOf = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => {
    for (const c of n.children ?? []) parentOf[c] = i;
  });

  // ---- animacoes: canais achatados, prontos para amostrar em qualquer t ----
  const clips: { name: string; duration: number; channels: Channel[] }[] = [];
  for (const [ai, anim] of ((json.animations ?? []) as Json[]).entries()) {
    const channels: Channel[] = [];
    let duration = 0;
    for (const ch of anim.channels ?? []) {
      const path = ch.target?.path;
      if (ch.target?.node === undefined || !['translation', 'rotation', 'scale'].includes(path)) {
        continue; // morph targets e alvos sem no nao mudam a geometria aqui
      }
      const sampler = anim.samplers[ch.sampler];
      const times = readAccessor(sampler.input);
      const values = readAccessor(sampler.output);
      const stride = path === 'rotation' ? 4 : 3;
      duration = Math.max(duration, times[times.length - 1] ?? 0);
      channels.push({
        node: ch.target.node,
        path,
        times,
        values,
        stride,
        interpolation: sampler.interpolation ?? 'LINEAR',
      });
    }
    clips.push({ name: anim.name ?? `animacao-${ai + 1}`, duration, channels });
  }

  /** Valor de um canal no instante t (ja tratando STEP/LINEAR/CUBICSPLINE). */
  const sampleChannel = (ch: Channel, t: number): number[] => {
    const n = ch.times.length;
    const cubic = ch.interpolation === 'CUBICSPLINE';
    const per = cubic ? ch.stride * 3 : ch.stride;
    const valueAt = (i: number): number[] =>
      Array.from(
        ch.values.subarray(
          i * per + (cubic ? ch.stride : 0),
          i * per + (cubic ? 2 : 1) * ch.stride,
        ),
      );
    if (n === 0) return new Array(ch.stride).fill(0);
    if (t <= ch.times[0]) return valueAt(0);
    if (t >= ch.times[n - 1]) return valueAt(n - 1);
    let i = 0;
    while (i < n - 2 && ch.times[i + 1] < t) i++;
    const t0 = ch.times[i];
    const t1 = ch.times[i + 1];
    const dt = t1 - t0 || 1;
    const u = (t - t0) / dt;
    if (ch.interpolation === 'STEP') return valueAt(i);
    if (cubic) {
      const out0 = Array.from(ch.values.subarray(i * per + 2 * ch.stride, (i + 1) * per));
      const in1 = Array.from(ch.values.subarray((i + 1) * per, (i + 1) * per + ch.stride));
      return cubicSpline(valueAt(i), out0, in1, valueAt(i + 1), dt, u);
    }
    const a = valueAt(i);
    const b = valueAt(i + 1);
    if (ch.path === 'rotation') return slerp(a, b, u);
    return a.map((v, k) => lerp(v, b[k], u));
  };

  /** Matriz local de cada no no instante t (repouso quando clip e null). */
  const localMatrices = (clip: number | null, t: number): Mat4[] => {
    const posed = new Map<
      number,
      { translation?: number[]; rotation?: number[]; scale?: number[] }
    >();
    if (clip !== null && clips[clip]) {
      for (const ch of clips[clip].channels) {
        const entry = posed.get(ch.node) ?? {};
        entry[ch.path] = sampleChannel(ch, t);
        posed.set(ch.node, entry);
      }
    }
    return nodes.map((n, i) => {
      const p = posed.get(i);
      if (!p && Array.isArray(n.matrix)) return new Float32Array(n.matrix);
      return fromTRS(
        p?.translation ?? n.translation ?? [0, 0, 0],
        p?.rotation ?? n.rotation ?? [0, 0, 0, 1],
        p?.scale ?? n.scale ?? [1, 1, 1],
      );
    });
  };

  const worldMatrices = (clip: number | null, t: number): Mat4[] => {
    const local = localMatrices(clip, t);
    const world: Mat4[] = new Array(nodes.length);
    const resolve = (i: number): Mat4 => {
      if (world[i]) return world[i];
      const p = parentOf[i];
      world[i] = p < 0 ? local[i] : multiply(resolve(p), local[i]);
      return world[i];
    };
    for (let i = 0; i < nodes.length; i++) resolve(i);
    return world;
  };

  // ---- primitivas de triangulo, lidas uma vez ----
  type Prim = {
    node: number;
    positions: Float32Array;
    indices: Uint32Array;
    joints?: Float32Array;
    weights?: Float32Array;
    skin?: number;
  };
  const prims: Prim[] = [];
  nodes.forEach((node, ni) => {
    if (node.mesh === undefined) return;
    for (const prim of json!.meshes[node.mesh].primitives ?? []) {
      if ((prim.mode ?? 4) !== 4) continue; // so triangulos: linhas/pontos nao viram volume
      const posIdx = prim.attributes?.POSITION;
      if (posIdx === undefined) continue;
      const positions = readAccessor(posIdx);
      const indices =
        prim.indices !== undefined
          ? Uint32Array.from(readAccessor(prim.indices))
          : Uint32Array.from({ length: positions.length / 3 }, (_, i) => i);
      prims.push({
        node: ni,
        positions,
        indices,
        joints:
          prim.attributes.JOINTS_0 !== undefined
            ? readAccessor(prim.attributes.JOINTS_0)
            : undefined,
        weights:
          prim.attributes.WEIGHTS_0 !== undefined
            ? readAccessor(prim.attributes.WEIGHTS_0)
            : undefined,
        skin: node.skin,
      });
    }
  });
  if (prims.length === 0) throw new Error('GLB sem malha de triangulos');

  const skins: { joints: number[]; ibm: Float32Array }[] = (json.skins ?? []).map((s: Json) => ({
    joints: s.joints ?? [],
    ibm:
      s.inverseBindMatrices !== undefined
        ? readAccessor(s.inverseBindMatrices)
        : new Float32Array((s.joints ?? []).length * 16).map((_, i) => (i % 17 === 0 ? 1 : 0)),
  }));

  const triangleCount = prims.reduce((n, p) => n + p.indices.length / 3, 0);
  const vertexCount = prims.reduce((n, p) => n + p.positions.length / 3, 0);

  const sample = (clip: number | null, t: number): Float32Array => {
    const world = worldMatrices(clip, t);
    const out = new Float32Array(triangleCount * 9);
    let o = 0;
    for (const prim of prims) {
      const vertCount = prim.positions.length / 3;
      const skinned = new Float32Array(prim.positions.length);
      const skin = prim.skin !== undefined ? skins[prim.skin] : undefined;

      if (skin && prim.joints && prim.weights) {
        // matriz de skin por junta: mundo da junta * bind inversa (spec glTF).
        // O transform do proprio no e ignorado no caso com skin — quem posiciona
        // a malha sao as juntas.
        const jointMat = skin.joints.map((nodeIdx, j) =>
          multiply(world[nodeIdx] ?? identity(), skin.ibm.slice(j * 16, j * 16 + 16)),
        );
        for (let v = 0; v < vertCount; v++) {
          const x = prim.positions[v * 3];
          const y = prim.positions[v * 3 + 1];
          const z = prim.positions[v * 3 + 2];
          let sx = 0,
            sy = 0,
            sz = 0,
            total = 0;
          for (let k = 0; k < 4; k++) {
            const w = prim.weights[v * 4 + k];
            if (w === 0) continue;
            const m = jointMat[prim.joints[v * 4 + k]];
            if (!m) continue;
            const [px, py, pz] = transformPoint(m, x, y, z);
            sx += px * w;
            sy += py * w;
            sz += pz * w;
            total += w;
          }
          // peso zerado (vertice sem junta) fica onde estava, no espaco do no
          if (total <= 1e-6) {
            const [px, py, pz] = transformPoint(world[prim.node] ?? identity(), x, y, z);
            sx = px;
            sy = py;
            sz = pz;
            total = 1;
          }
          skinned[v * 3] = sx / total;
          skinned[v * 3 + 1] = sy / total;
          skinned[v * 3 + 2] = sz / total;
        }
      } else {
        const m = world[prim.node] ?? identity();
        for (let v = 0; v < vertCount; v++) {
          const [px, py, pz] = transformPoint(
            m,
            prim.positions[v * 3],
            prim.positions[v * 3 + 1],
            prim.positions[v * 3 + 2],
          );
          skinned[v * 3] = px;
          skinned[v * 3 + 1] = py;
          skinned[v * 3 + 2] = pz;
        }
      }

      for (const idx of prim.indices) {
        out[o++] = skinned[idx * 3];
        out[o++] = skinned[idx * 3 + 1];
        out[o++] = skinned[idx * 3 + 2];
      }
    }
    return out;
  };

  return {
    animations: clips.map((c) => ({ name: c.name, duration: c.duration })),
    triangleCount,
    vertexCount,
    sample,
  };
};

/**
 * Leva os triangulos do espaco glTF (Y para cima) para o do editor (Z para cima,
 * frente = -y). Feito DEPOIS da amostragem para que a matematica de skin fique
 * exatamente como o spec manda — converter antes exigiria girar tambem as bind
 * matrices, e um erro ali so aparece nos frames animados.
 */
export const orientTriangles = (tris: Float32Array, o: GlbOrientation): Float32Array => {
  const out = new Float32Array(tris.length);
  const rad = (o.yaw * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  for (let i = 0; i < tris.length; i += 3) {
    const gx = tris[i];
    const gy = tris[i + 1];
    const gz = tris[i + 2];
    // Y para cima: o +z do glTF (frente) vira o -y do editor
    const x = o.up === 'y' ? gx : gx;
    const y = o.up === 'y' ? -gz : gy;
    const z = o.up === 'y' ? gy : gz;
    out[i] = x * cos - y * sin;
    out[i + 1] = x * sin + y * cos;
    out[i + 2] = z;
  }
  return out;
};
