// O CASULO DA REDE: o Prospector envolvido em seda, no canvas e na ancora do
// proprio Prospector (96x112, pe em 48/108), para o cliente carimbar o atlas
// exatamente onde carimba o corpo. Um so rumo: o casulo e um ovo, e o que o
// distingue de qualquer angulo sao as faixas em helice e os nos de resina, que
// giram em volta dele e nao dependem de para onde o corpo olhava.
//
// Quatro animacoes, pelos nomes canonicos de ANIM_ORDER:
// - `attack` FECHANDO: a seda sobe do chao ao topo em quatro quadros, a helice
//   enrola junto e os estais se prendem ao chao. O corpo ainda aparece por
//   cima da linha da seda — e o que diz "esta sendo embrulhado", e nao "sumiu".
// - `idle`   PRESO: o ovo inteiro respira (4 quadros em laco), os nos de
//   resina escorrem e a helice se ajusta; por buracos na seda se ve o escuro.
// - `burst`  LIBERTO: a costura da frente racha, as placas de seda voam para
//   fora e caem, as faixas viram farrapos, o chao fica sujo de seda.
// - `loose`  CHEIO DE FIOS: sem ovo. Tufos de seda presos ao corpo (cabeca,
//   peito, quadril) e fios pendentes ate o chao, balancando, arrastando atras.
import { box, renderVoxels } from './voxel.mjs';

// A ancora fica ACIMA da do Prospector (84 contra 108): o casulo tem estais e
// sujeira de seda no chao a frente do corpo, e o pe do quadro precisa de
// lugar para eles. O cliente carimba os dois pelo mesmo ponto do pe, e cada
// atlas resolve a propria ancora — os dois z=0 caem no mesmo pixel.
export const COCOON_FRAME = { w: 96, h: 112, ax: 48, ay: 84 };

// O corpo do Prospector ocupa x -3..4, y -3..4, z 0..15 (prospector.mjs).
const CX = 0.5,
  CY = 0.5;
const RX = 5,
  RY = 5,
  RZ = 8.6,
  CZ = 7.4;
const TOP = CZ + RZ;

/** Ruido deterministico em [0,1): o mesmo buraco no mesmo lugar em toda geracao. */
const noise = (x, y, z, seed = 0) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 4.147) * 43758.5453;
  return v - Math.floor(v);
};
const half = (v) => Math.round(v * 2) / 2;
const vox = (out, x, y, z, mat, s = 0.5) => out.push(box(half(x), half(y), half(z), s, s, s, mat));

/** Um fio: cubinhos de 0,5 entre dois pontos. */
const thread = (out, a, b, mat = 'silk', s = 0.5) => {
  const n = Math.max(1, Math.ceil(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    vox(out, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, mat, s);
  }
};

/** Raio horizontal do ovo na altura z, em [0,1] do raio maximo. */
const ring = (z) => {
  const u = (z - CZ) / RZ;
  return u * u >= 1 ? 0 : Math.sqrt(1 - u * u);
};
/** Ponto na superficie do ovo (escala `k` fora dela). */
const surface = (angle, z, k = 1) => {
  const r = ring(z) * k;
  return [CX + Math.cos(angle) * RX * r, CY + Math.sin(angle) * RY * r, z];
};

/**
 * A CASCA: dois cascos concentricos. O de fora e seda com buracos (o ruido
 * decide), o de dentro e escuro — pelo buraco se ve sombra, nunca o corpo. A
 * seda tem VEIOS: faixas mais claras onde o ruido de baixa frequencia sobe,
 * para a superficie nao ser um so tom liso.
 */
const shell = (out, upTo, breathe = 1, seam = null, seed = 0, split = null) => {
  for (let z = 0; z <= Math.min(TOP, upTo); z += 0.5)
    for (let x = -RX - 1; x <= RX + 1.5; x += 0.5)
      for (let y = -RY - 1; y <= RY + 1.5; y += 0.5) {
        const dx = (x - CX) / (RX * breathe),
          dy = (y - CY) / (RY * breathe),
          dz = (z - CZ) / RZ;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d > 1 || d < 0.7) continue;
        const angle = Math.atan2(dy, dx);
        if (seam !== null) {
          // A costura da frente (rumo da camera) abre: nada de casca na fenda.
          let da = Math.abs(angle - seam.angle);
          if (da > Math.PI) da = Math.PI * 2 - da;
          if (da < seam.width * (0.4 + 0.6 * (1 - Math.abs(dz)))) continue;
        }
        // No `burst` as duas metades voam para os lados da costura e caem.
        let px = x,
          py = y,
          pz = z;
        if (split) {
          const side = Math.sin(angle - split.angle) >= 0 ? 1 : -1;
          const ox = -Math.sin(split.angle) * side,
            oy = Math.cos(split.angle) * side;
          px = x + ox * split.offset;
          py = y + oy * split.offset;
          pz = Math.max(0, z * split.squash - split.drop);
        }
        if (d >= 0.86) {
          // A seda, com buracos e veios.
          const hole = noise(x, y, z, seed) < 0.12 + (z > TOP - 1.5 ? 0.25 : 0);
          if (hole) continue;
          const vein = noise(Math.floor(x / 1.5), Math.floor(y / 1.5), Math.floor(z / 2.5), 7);
          vox(out, px, py, pz, vein > 0.62 ? 'silt' : 'silk');
        } else if (d >= 0.78 && !split) vox(out, px, py, pz, 'scorch');
      }
};

/**
 * AS FAIXAS EM HELICE: duas, em sentidos opostos, um pouco fora da casca,
 * mais grossas (osso) que a seda, com um NO de resina onde se cruzam. `upTo`
 * limita ate onde a helice ja enrolou; `spin` gira tudo (a respiracao do
 * `idle`); `fling` afasta os farrapos no `burst`.
 */
const bands = (out, upTo, spin = 0, fling = 0, seed = 0) => {
  const turns = 3.5;
  const z0 = CZ - RZ + 0.5,
    z1 = TOP - 0.5;
  const steps = 260;
  for (const dir of [1, -1]) {
    const mat = dir > 0 ? 'bone' : 'silk';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const z = z0 + (z1 - z0) * t;
      if (z > upTo) break;
      // No `burst` so sobram farrapos: trechos curtos, jogados para fora.
      if (fling > 0 && noise(i, dir, 0, seed) < 0.45 + fling * 0.25) continue;
      const angle = spin + dir * (t * turns * Math.PI * 2 + (dir < 0 ? 1.1 : 0));
      const k = 1.05 + fling * (0.15 + 0.12 * noise(i, 3, dir, seed));
      const [x, y] = surface(angle, z, k);
      // Farrapos caem, mas nao atravessam o chao.
      vox(out, x, y, Math.max(0, z - fling * 1.5), mat);
      // A faixa de osso e larga: um segundo cubinho um passo abaixo.
      if (dir > 0 && i % 2 === 0) vox(out, x, y, z - 0.5, mat);
    }
  }
  if (fling > 0) return;
  // Os nos de resina: onde as duas helices se cruzam (a cada meia volta).
  for (let n = 0; n < turns * 2; n++) {
    const t = (n + 0.5) / (turns * 2);
    const z = z0 + (z1 - z0) * t;
    if (z > upTo) break;
    const angle = spin + (t * turns * Math.PI * 2 + 0.55);
    const [x, y] = surface(angle, z, 1.1);
    out.push(box(half(x) - 0.5, half(y) - 0.5, half(z) - 0.5, 1, 1, 1, 'sutureResin'));
    // A gota que escorre do no.
    vox(out, x, y, z - 1, 'sutureResin');
  }
};

/** OS ESTAIS: fios da cintura do ovo ate o chao, presos a 7 tiles do centro. */
const guyLines = (out, count = 4, phase = 0, sag = 0) => {
  for (let n = 0; n < count; n++) {
    const angle = phase + (n / count) * Math.PI * 2 + 0.4;
    const from = surface(angle, CZ + 1, 1);
    const to = [CX + Math.cos(angle) * 6.5, CY + Math.sin(angle) * 6.5, 0];
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2 - sag];
    thread(out, from, mid);
    thread(out, mid, to);
    // O no no chao.
    vox(out, to[0], to[1], 0, 'sutureResin');
  }
};

/** O TUFO DO TOPO: o fio de que ela pendurou o embrulho, retorcido, e o no. */
const topKnot = (out, lean = 0) => {
  out.push(box(CX - 0.5, CY - 0.5, TOP - 0.5, 1, 1, 1, 'sutureResin'));
  thread(out, [CX, CY, TOP], [CX + lean, CY - 1.5, TOP + 2.5]);
  thread(out, [CX + lean, CY - 1.5, TOP + 2.5], [CX + lean * 2 + 1.5, CY - 1, TOP + 3.5]);
};

/** A SUJEIRA DE SEDA no chao em volta (fechando, preso e liberto). */
const litter = (out, amount, seed = 0) => {
  for (let n = 0; n < amount; n++) {
    const angle = noise(n, 1, 2, seed) * Math.PI * 2;
    const r = 4.5 + noise(n, 2, 3, seed) * 2;
    vox(out, CX + Math.cos(angle) * r, CY + Math.sin(angle) * r * 0.85, 0, 'silk');
  }
};

// ---------------------------------------------------------------------------
// Os quadros.
// ---------------------------------------------------------------------------
const wrapFrame = (f) => {
  const b = [];
  const c = (f + 1) / 4;
  const upTo = CZ - RZ + c * (RZ * 2) + 0.5;
  shell(b, upTo);
  bands(b, upTo, 0);
  // A frente de seda que ainda sobe: uma borda mais alta e irregular.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) {
    const h = upTo + 0.5 + noise(a, f, 1) * 1.5;
    if (h > TOP) continue;
    const [x, y] = surface(a, Math.min(TOP - 0.5, h), 1.02);
    vox(b, x, y, Math.min(TOP - 0.5, h), 'silk');
  }
  if (f >= 1) guyLines(b, 2 + f, 0, 0.6);
  if (f === 3) topKnot(b, 0);
  litter(b, 4 + f * 2, f);
  return b;
};

const holdFrame = (f) => {
  const b = [];
  const breathe = 1 + 0.025 * Math.sin((f / 4) * Math.PI * 2);
  shell(b, TOP + 1, breathe, null, 0);
  bands(b, TOP + 1, (f / 4) * (Math.PI / 6));
  guyLines(b, 5, 0, 0.6 + 0.2 * Math.sin((f / 4) * Math.PI * 2));
  topKnot(b, 0.5 * Math.sin((f / 4) * Math.PI * 2));
  litter(b, 10, 3);
  return b;
};

const burstFrame = (f) => {
  const b = [];
  // A costura abre para a camera. Na camera de `dr` (indice 0, modelo girado
  // 90 graus) quem olha para a tela e o rumo +x/-y do modelo, e as metades
  // voam pelo eixo x+y, que e a horizontal da tela.
  const seam = { angle: -Math.PI / 4, width: 0.3 + f * 0.35 };
  // As duas metades abrem como uma casca de ovo: afastam-se da costura, caem
  // e se achatam. No ultimo quadro ja estao no chao, encostadas nos estais.
  const split =
    f === 0
      ? null
      : { angle: seam.angle, offset: 0.5 + f * 0.9, drop: 2.5 * f, squash: 1 - f * 0.3 };
  shell(b, TOP + 1, 1 + f * 0.06, seam, 5 + f, split);
  bands(b, TOP + 1, 0.3 * f, 0.5 + f * 0.5, f);
  guyLines(b, 5, 0, 1.2 + f);
  if (f === 0) topKnot(b, 1);
  else thread(b, [CX, CY, TOP - f * 3], [CX + 1.5, CY - 2, TOP + 2 - f * 3]);
  litter(b, 12 + f * 5, 4 + f);
  return b;
};

const webbedFrame = (f) => {
  const b = [];
  const sway = Math.sin((f / 3) * Math.PI * 2);
  // Os tufos presos ao corpo: cabeca, ombro, peito, quadril, canela.
  const tufts = [
    [-1, -3.5, 14.5, 1.5],
    [2.5, -1, 12, 1],
    [-3.5, 1, 9.5, 1],
    [1, 3.5, 7, 1.5],
    [-2.5, -2, 3.5, 1],
    [3, 2, 2, 1],
  ];
  for (const [x, y, z, s] of tufts) {
    for (let i = 0; i < s; i += 0.5)
      for (let j = 0; j < s; j += 0.5) vox(b, x + i, y + j, z + (i + j) * 0.3, 'silk');
    // Um fio caindo de cada tufo ate o chao, balancando.
    const dx = Math.sign(x || 1) * (1 + 0.6 * sway),
      dy = Math.sign(y || 1) * (1.2 + 0.4 * sway);
    thread(b, [x, y, z], [x + dx, y + dy, Math.max(0, z - 4)]);
    thread(b, [x + dx, y + dy, Math.max(0, z - 4)], [x + dx * 1.6, y + dy * 1.8, 0]);
  }
  // O rastro atras (para -x/+y: as costas, na camera de `dr`), arrastando no chao.
  for (let n = 0; n < 3; n++) {
    const k = n - 1;
    thread(b, [CX + k, CY + k, 0], [CX - 4 + k * 0.5 + sway * 0.5, CY + 5 + k, 0]);
  }
  // Um no de resina esquecido na nuca e outro no ombro.
  vox(b, -0.5, -3, 13.5, 'sutureResin');
  vox(b, 3, -0.5, 11.5, 'sutureResin');
  return b;
};

export const cocoonModel = (anim, frame) =>
  anim === 'attack'
    ? wrapFrame(frame)
    : anim === 'burst'
      ? burstFrame(frame)
      : anim === 'loose'
        ? webbedFrame(frame)
        : holdFrame(frame);

export const SILK_COCOON_SPEC = {
  id: 'fx-silk-cocoon',
  version: 1,
  frameWidth: COCOON_FRAME.w,
  frameHeight: COCOON_FRAME.h,
  anchorX: COCOON_FRAME.ax,
  anchorY: COCOON_FRAME.ay,
  directions: 1,
  authoredDirs: ['dr'],
  flipPairs: {},
  hitbox: { w: 1, h: 1 },
  footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
  animations: {
    attack: { frames: 4, fps: 10, loop: false },
    idle: { frames: 4, fps: 6, loop: true },
    burst: { frames: 3, fps: 12, loop: false },
    loose: { frames: 3, fps: 5, loop: true },
  },
  draw: (_dir, anim, frame) =>
    renderVoxels(
      cocoonModel(anim, frame),
      0,
      COCOON_FRAME.w,
      COCOON_FRAME.h,
      COCOON_FRAME.ax,
      COCOON_FRAME.ay,
    ),
  prompt:
    'voxel-isometric silk cocoon wrapped around the prospector: pale mineral silk egg with holes showing a dark interior, two counter-spiralling bone-coloured bands with resin knots, guy-lines pinned to the floor, a twisted thread at the top; wrapping, breathing, bursting open and loose threads on the body',
};
