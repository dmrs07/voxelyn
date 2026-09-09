// Modelos voxel dos PROPS DECORATIVOS volumetricos.
//
// Por que existe: a primeira versao da decoracao desenhava tudo em runtime
// com meia duzia de drawVoxel — cubos empilhados. Para pedrinha e caco isso
// funciona (a silhueta e que carrega); para uma fumarola, uma broca ou um
// monolito, o empilhado le como PAINEL DE PAPELAO, nao como coisa com massa.
// Estes aqui sao modelos de verdade, rasterizados pelo mesmo pipeline dos
// blocos e das criaturas — mesma projecao, mesma ordem do pintor, mesmo
// tamanho de voxel — e entram no atlas world-props como kinds estaticos.
//
// AUTORADOS NA MALHA FINA, como as paredes: cada prop carrega o dobro de
// celulas por eixo do primeiro rascunho, entao a textura volumetrica (a
// malha por material) trabalha em grao cheio e as silhuetas ganham chanfro
// nos cantos — nada de torre de bolo quadrada. As reguas de escala:
// - prop de chao/borda: SEMPRE mais estreito que um tile (16 voxels finos) —
//   nunca pode parecer que bloqueia;
// - landmark: ate ~1 tile de largura e mais alto que a parede, mas SEMPRE
//   abaixo do Nucleo — o monumento pontua o salao, o objetivo comanda o mapa.
//
// As regras anti-mentira da camada valem no modelo:
// - nada de 'loot' nem 'biolum': enfeite nao parece premio nem municao;
// - nada de 'fire': a fumarola decorativa e EXTINTA;
// - cristal decorativo usa 'ice' (familia fria), nunca o biolum reativo.
//
// Cada kind sai em DUAS variantes (espelho + proporcao), porque estes props
// repetem pelo setor e a repeticao exata e o que denuncia o carimbo.
import { box } from './voxel.mjs';

export const DECOR_VARIANTS = 2;

const VOLUMETRIC = [
  'fallen_column',
  'stalagmite',
  'flow_curtain',
  'fumarole_cone',
  'slag_block',
  'ice_spike',
  'crate',
  'strut',
  'insulator',
  'duct',
  'mushroom',
  'monolith',
  'great_prism',
  'stalagnate',
  'strata_arch',
  'great_fumarole',
  'slag_monolith',
  'frost_obelisk',
  'magnet_core',
  'drill',
  // Segunda varredura: os medios de chao/borda e a infra Aurix tambem
  // ganham malha fina — so pedrinha/caco e os pendentes que BALANCAM por
  // relogio (veu, cabo, raiz) continuam em runtime.
  'walkway',
  'rail',
  'calcite_basin',
  'crystal_fan',
  'slab_pile',
  'fallen_plate',
  'sulfur_mound',
  'cinder_pile',
  'frost_stone',
  'lodestone',
  'ore_spur',
  // Pendentes MINERAIS de teto: autorados de ponta-cabeca — a bica no z0
  // (que e a ancora) alargando para cima; o cliente os desenha ERGUIDOS e
  // translucidos, como sempre.
  'hanging_spur',
  'crystal_chandelier',
  'stalactite',
  'hanging_slab',
  'sulfur_drip',
  'soot_fang',
  'icicle',
  // A gaiola de canario: aqui o eixo de "variante" NAO e anti-carimbo — e o
  // ESTADO. :0 = canario vivo, :1 = canario morto; o cliente escolhe o frame
  // pela contaminacao autoritativa (CANARY_DEAD_AT), nao por sorteio.
  'canary_cage',
  // A ROCHA SUTURADA: o que a Cerzideira e os Costureiros deixam pela camara.
  // Teias de canto e de chao, um casulo que ainda se mexe (o unico decor
  // ANIMADO: tres quadros de espasmo), a casa de aranha em domo com a boca
  // escura, a ninhada de ovos e os fios pendurados do teto.
  //
  // NOVE QUADROS AO TODO, e nao mais: o atlas de props tinha nove vagas na
  // ultima linha, e uma linha nova custa 2,2 MiB de RGBA no boot (todo quadro
  // paga o canvas dos monumentos), que o orcamento nao tem. So a teia de chao
  // tem duas variantes — e a que mais se repete; o resto tem uma, e o
  // anti-carimbo fica por conta da colocacao.
  { name: 'web_corner', variants: 1 },
  'web_sheet',
  { name: 'web_hang', variants: 1 },
  { name: 'cocoon_twitch', frames: 3, frameMs: 180, variants: 1 },
  { name: 'spider_nest', variants: 1 },
  { name: 'egg_cluster', variants: 1 },
];

/**
 * Kinds no formato do atlas de props: um frame por variante, ou os quadros
 * que o kind declarar (o casulo que se mexe). Um kind animado paga
 * `frames x variantes` quadros; e por isso que so ele e animado.
 */
export const DECOR_PROP_KINDS = VOLUMETRIC.flatMap((entry) => {
  const kind = typeof entry === 'string' ? entry : entry.name;
  const frames = typeof entry === 'string' ? 1 : (entry.frames ?? 1);
  const frameMs = typeof entry === 'string' ? 0 : (entry.frameMs ?? 0);
  const variants = typeof entry === 'string' ? DECOR_VARIANTS : (entry.variants ?? DECOR_VARIANTS);
  return Array.from({ length: variants }, (_, v) => ({
    name: `decor:${kind}:${v}`,
    frames,
    frameMs,
  }));
});

const hash3 = (x, y, z, seed) => {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 2147483647) ^
    Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * TEXTURA VOLUMETRICA, a mesma ideia dos blocos de terreno: o material de
 * cada voxel depende de (x, y, z), entao qualquer face que o modelo exponha
 * mostra a mesma materia malhada — sem isto as caixas grandes saem com faces
 * CHAPADAS de um material so, e o prop volta a parecer papelao pintado.
 * Cada material tem as proprias inclusoes: a rocha malha de rocha funda, o
 * osso mancha de oxido, o gelo prende sedimento, a ferrugem descasca.
 */
const SPECKLE = {
  rock: [['rockDeep', 5]],
  rockDeep: [['rock', 6]],
  bone: [['rust', 7]],
  rust: [
    ['rockDeep', 6],
    ['bone', 11],
  ],
  ice: [['rock', 9]],
  fungus: [['fungusDeep', 5]],
  fungusDeep: [['fungus', 7]],
};

const texture = (boxes, seed) => {
  const out = [];
  for (const b of boxes) {
    const rules = SPECKLE[b.mat];
    if (!rules) {
      // Sem regra (scorch e afins): o material e DETALHE deliberado — a boca
      // extinta da fumarola tem de continuar um buraco uniforme e escuro.
      out.push(b);
      continue;
    }
    for (let dz = 0; dz < b.h; dz++) {
      for (let dy = 0; dy < b.d; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          const x = b.x + dx;
          const y = b.y + dy;
          const z = b.z + dz;
          let roll = hash3(x, y, z, seed) >>> 3;
          let mat = b.mat;
          for (const [alt, mod] of rules) {
            if (roll % mod === 0) {
              mat = alt;
              break;
            }
            roll >>>= 4;
          }
          out.push(box(x, y, z, 1, 1, 1, mat));
        }
      }
    }
  }
  return out;
};

/**
 * Camada quadrada centrada com CANTOS CHANFRADOS: o tijolo de toda torre.
 * Cortar o voxel do canto a partir de r>=2 arredonda a leitura sem custar
 * resolucao — e a diferenca entre "coluna" e "pilha de caixas".
 */
const slab = (boxes, cx, cy, r, z, h, mat) => {
  if (r <= 1) {
    boxes.push(box(cx - r, cy - r, z, r * 2 + 1, r * 2 + 1, h, mat));
    return;
  }
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (Math.abs(x) === r && Math.abs(y) === r) continue; // chanfro
      boxes.push(box(cx + x, cy + y, z, 1, 1, h, mat));
    }
  }
};

/** Cone centrado em (0,0): camadas chanfradas encolhendo. */
/** Um FIO DE SEDA: cubinhos de meio voxel entre dois pontos. */
const thread = (boxes, a, b, mat = 'silk') => {
  const n = Math.max(1, Math.ceil(Math.max(...a.map((p, i) => Math.abs(p - b[i]))) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const at = a.map((p, k) => Math.round((p + (b[k] - p) * t) * 2) / 2);
    boxes.push(box(at[0], at[1], at[2], 0.5, 0.5, 0.5, mat));
  }
};

const cone = (boxes, steps, cx = 0, cy = 0) => {
  let z = 0;
  for (const [r, h, mat] of steps) {
    slab(boxes, cx, cy, r, z, h, mat);
    z += h;
  }
  return z;
};

const modelOf = (kind, v, frame = 0) => {
  const s = v === 0 ? 1 : -1; // espelho por variante
  const boxes = [];

  switch (kind) {
    case 'fallen_column': {
      // Tambores tombados em linha, meio afundados; o capitel quebrado ao
      // lado. Cada tambor tem cinta propria — juntas legiveis, nao um tubo.
      boxes.push(box(-7, -3 + v, 0, 4, 5, 5, 'rock'));
      boxes.push(box(-3, -3 + v, 0, 1, 5, 5, 'rockDeep')); // junta
      boxes.push(box(-2, -3 + v, 0, 4, 5, 4, 'rock'));
      boxes.push(box(2, -2 + v, 0, 1, 4, 4, 'rockDeep'));
      boxes.push(box(3, -2 + v, 0, 4, 4, 3, 'rock'));
      boxes.push(box(6, s * 2, 0, 3, 3, 2, 'rockDeep')); // capitel
      break;
    }
    case 'stalagmite': {
      cone(boxes, [
        [3, 2, 'bone'],
        [2, 3, 'bone'],
        [1, 3, 'bone'],
        [0, 3 + v, 'bone'],
      ]);
      cone(
        boxes,
        [
          [1, 2, 'bone'],
          [0, 2, 'bone'],
        ],
        s * 4,
        2,
      ); // broto
      break;
    }
    case 'flow_curtain': {
      // Cascata petrificada: laminas contiguas descendo em degraus, com a
      // saia escorrida na base — a agua desenhou, o tempo petrificou.
      boxes.push(box(-6, -1, 0, 3, 3, 12, 'bone'));
      boxes.push(box(-3, -1, 0, 3, 3, 10 + v, 'ice'));
      boxes.push(box(0, -1, 0, 3, 3, 8, 'bone'));
      boxes.push(box(3, -1, 0, 2, 3, 5, 'ice'));
      boxes.push(box(5, -1, 0, 2, 3, 3, 'bone'));
      boxes.push(box(-6 + v, 1, 0, 12, 2, 1, 'bone')); // a saia
      break;
    }
    case 'fumarole_cone': {
      // Cone mineral com a BOCA escura: extinta — nenhum voxel de fogo.
      const top = cone(boxes, [
        [5, 2, 'bone'],
        [4, 2, 'rust'],
        [3, 2, 'bone'],
        [2, 2, 'rust'],
        [1, 2 + v, 'bone'],
      ]);
      boxes.push(box(-1, -1, top, 2, 2, 1, 'scorch'));
      boxes.push(box(s * 4, s, 2, 1, 1, 2, 'rust')); // escorrimento na saia
      break;
    }
    case 'slag_block': {
      // Corpo em rockDeep, nao em scorch: a rampa do queimado e toda escura
      // e some no fundo — a MESMA armadilha do primeiro sprite do Escoriaceo.
      // O scorch fica nas frestas, onde escuro e informacao, nao silhueta.
      slab(boxes, 0, 0, 4, 0, 4, 'rockDeep');
      slab(boxes, v - 1, 0, 3, 4, 3, 'rock');
      boxes.push(box(-2, 0, 7, 4, 2, 1, 'scorch'));
      boxes.push(box(s * 3, -3, 4, 2, 2, 2, 'rust'));
      break;
    }
    case 'ice_spike': {
      cone(boxes, [
        [3, 3, 'ice'],
        [2, 4, 'ice'],
        [1, 4, 'ice'],
        [0, 4 + v, 'ice'],
      ]);
      cone(
        boxes,
        [
          [1, 3, 'ice'],
          [0, 3, 'ice'],
        ],
        s * 4,
        s * 2,
      ); // agulha filha
      break;
    }
    case 'crate': {
      // Caixa Aurix: corpo de ferrugem, tampa de osso, cintas escuras. Sem
      // ouro, sem halo — o brilho de coletavel pertence ao cofre.
      boxes.push(box(-5, -4, 0, 10, 8, 7, 'rust'));
      boxes.push(box(-5, -4, 7, 10, 8, 1, 'bone'));
      boxes.push(box(-2 + v, -4, 0, 1, 8, 8, 'rockDeep'));
      boxes.push(box(2 - v, -4, 0, 1, 8, 8, 'rockDeep'));
      boxes.push(box(-5, -1, 0, 10, 1, 8, 'rockDeep'));
      break;
    }
    case 'strut': {
      // Escora em portico: pes alargados, vigas duplas, contraventamento.
      boxes.push(box(-6, -2, 0, 3, 4, 1, 'rockDeep'));
      boxes.push(box(4, -2, 0, 3, 4, 1, 'rockDeep'));
      boxes.push(box(-5, -1, 1, 2, 2, 10, 'rust'));
      boxes.push(box(4, -1, 1, 2, 2, 10 - v, 'rust'));
      boxes.push(box(-5, -1, 11 - v, 11, 2, 2, 'rust'));
      boxes.push(box(-2, -1, 5, 5, 2, 1, 'bone')); // contraventamento
      break;
    }
    case 'insulator': {
      // Isolador ceramico: pratos empilhados com garganta entre eles.
      slab(boxes, 0, 0, 3, 0, 2, 'bone');
      slab(boxes, 0, 0, 2, 2, 2, 'ice');
      slab(boxes, 0, 0, 3, 4, 1, 'bone');
      slab(boxes, 0, 0, 2, 5, 2, 'ice');
      slab(boxes, 0, 0, 3, 7, 1, 'bone');
      boxes.push(box(0, 0, 8, 1, 1, 3 + v, 'rust')); // pino
      break;
    }
    case 'duct': {
      // Cotovelo rompido: o gas que ele levava ja nao existe.
      boxes.push(box(-8, -2, 2, 9, 4, 4, 'rust'));
      boxes.push(box(-8, -2, 2, 1, 4, 4, 'rockDeep')); // flange
      boxes.push(box(0, -2, 2, 4, 4, 4, 'rockDeep')); // cotovelo
      boxes.push(box(0, -2, 6, 4, 4, 4 + v, 'rust'));
      boxes.push(box(1, -1, 10 + v, 2, 2, 1, 'scorch')); // boca rompida
      break;
    }
    case 'mushroom': {
      // Talo ALTO e chapeu em domo: com o chapeu baixo demais a projecao o
      // achatava sobre o talo e o cogumelo lia como panqueca verde no chao.
      boxes.push(box(-1, -1, 0, 3, 3, 8, 'bone'));
      slab(boxes, 0, 0, 5, 8, 2, 'fungus');
      slab(boxes, 0, 0, 4, 10, 2, 'fungus');
      slab(boxes, 0, 0, 2, 12, 1 + v, 'fungusDeep');
      boxes.push(box(s * 3, -3, 9, 1, 1, 1, 'bone')); // pintas
      boxes.push(box(-s * 3, 2 + v, 9, 1, 1, 1, 'bone'));
      boxes.push(box(s, 3, 10, 1, 1, 1, 'bone'));
      break;
    }

    // ------------------------------------------------------------------
    // ROCHA SUTURADA: seda. Fios sao caixas de meio voxel (a seda nao tem
    // regra de textura, entao passam inteiras); so o que e macico usa osso.
    // ------------------------------------------------------------------
    case 'web_corner': {
      // A TEIA DE CANTO: um leque de fios de um no alto na parede ate uma
      // linha no chao, com duas cordas cruzando o leque. A variante espelha o
      // lado e muda o numero de fios, para duas teias vizinhas nao rimarem.
      const top = [s * 0.5, -s * 0.5, 10 + v];
      const spokes = 6 + v;
      const foot = (t) => [s * (-4.5 + 8 * t), -s * (-4.5 + 8 * t) + (t - 0.5) * 2 * s, 0];
      boxes.push(box(top[0] - 0.5, top[1] - 0.5, top[2] - 0.5, 1, 1, 1, 'sutureResin'));
      for (let k = 0; k < spokes; k++) thread(boxes, top, foot(k / (spokes - 1)), 'silk');
      for (const h of [0.35, 0.65]) {
        let prev = null;
        for (let k = 0; k < spokes; k++) {
          const f = foot(k / (spokes - 1));
          const at = f.map((c, i) => top[i] + (c - top[i]) * h);
          // A corda cede um pouco entre um fio e outro.
          at[2] -= 0.5;
          if (prev) thread(boxes, prev, at, 'silt');
          prev = at;
        }
      }
      // Poeira presa: pontos de silte pelo leque.
      for (let k = 0; k < 5; k++)
        boxes.push(box(s * (k - 2), -s * (k - 2) + 0.5, 3 + k * 1.3, 0.5, 0.5, 0.5, 'silt'));
      break;
    }
    case 'web_sheet': {
      // A TEIA DE CHAO: um funil. Aneis concentricos rentes ao chao, oito
      // raios, e a boca escura no centro com a borda levantada — e para dentro
      // dela que a coisa que mora ali some quando alguem chega.
      const R = 3.5 + v * 0.5;
      const ringPoint = (a, r) => [
        Math.cos(a) * r,
        Math.sin(a) * r * 0.85,
        0.5 + (1 - r / R) * 0.5,
      ];
      for (const r of [R, R * 0.68, R * 0.38]) {
        let prev = null;
        for (let k = 0; k <= 16; k++) {
          const at = ringPoint((k / 16) * Math.PI * 2 + v * 0.2, r);
          if (prev) thread(boxes, prev, at, k % 3 === 0 ? 'silt' : 'silk');
          prev = at;
        }
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + 0.3 + v * 0.2;
        thread(boxes, ringPoint(a, R), ringPoint(a, 1.2), 'silk');
      }
      // O funil: borda de seda e o fundo escuro.
      slab(boxes, 0, 0, 1.5, 0.5, 1, 'silk');
      boxes.push(box(-1, -1, 0.5, 2, 2, 1, 'scorch'));
      break;
    }
    case 'web_hang': {
      // OS FIOS DO TETO: pendem de alturas diferentes; num deles, um casulo
      // pequeno enrolado, e um no de resina onde o fio se prende.
      const hangs = [
        [-2 * s, 1, 14, 6],
        [1.5 * s, -1.5, 14, 9],
        [0, 2.5, 14, 4 + v],
      ];
      for (const [x, y, z0, len] of hangs) {
        thread(boxes, [x, y, z0], [x + 0.3 * s, y, z0 - len], 'silk');
        boxes.push(box(x - 0.5, y - 0.5, z0 - 0.5, 1, 1, 1, 'sutureResin'));
      }
      // O casulinho no fio mais comprido: um ovo de seda com duas voltas.
      const cx = hangs[1][0] + 0.3 * s,
        cy = hangs[1][1],
        cz = hangs[1][2] - hangs[1][3];
      boxes.push(box(cx - 1, cy - 1, cz - 3, 2, 2, 3, 'silk'));
      boxes.push(box(cx - 1.5, cy - 1.5, cz - 2, 3, 3, 0.5, 'silt'));
      boxes.push(box(cx - 1.5, cy - 1.5, cz - 0.5, 3, 3, 0.5, 'silt'));
      break;
    }
    case 'cocoon_twitch': {
      // O CASULO QUE SE MEXE: pendurado por um fio curto na parede, com
      // faixas de osso. Quatro quadros: balanca para um lado, estufa (algo
      // empurra de dentro, uma bossa escura na costura), volta, descansa.
      const sway = [0, 0.5, -0.5][frame] * s;
      const bulge = frame === 1;
      const top = [s * 0.5, -s * 0.5, 11];
      boxes.push(box(top[0] - 0.5, top[1] - 0.5, top[2] - 0.5, 1, 1, 1, 'sutureResin'));
      thread(boxes, top, [top[0] + sway, top[1], 8.5], 'silk');
      const cx = top[0] + sway,
        cy = top[1];
      // O ovo: tres camadas de seda, a do meio mais larga.
      boxes.push(box(cx - 1, cy - 1, 2, 2, 2, 1.5, 'silk'));
      boxes.push(box(cx - 1.5, cy - 1.5, 3.5, 3, 3, 3, 'silk'));
      boxes.push(box(cx - 1, cy - 1, 6.5, 2, 2, 2, 'silk'));
      // As faixas de osso em volta, e a bossa escura quando ele estufa.
      boxes.push(box(cx - 1.5, cy - 1.5, 4.5, 3, 3, 0.5, 'bone'));
      boxes.push(box(cx - 1.5, cy - 1.5, 6, 3, 3, 0.5, 'bone'));
      if (bulge) {
        const bx = cx + (v ? -2 : 1.5);
        boxes.push(box(bx, cy + 1.5, 4, 0.5, 0.5, 1.5, 'scorch'));
        boxes.push(box(bx, cy + 1.5, 3.5, 0.5, 0.5, 0.5, 'silt'));
      }
      // Fios soltos ate o chao, balancando com o corpo.
      thread(boxes, [cx - 1, cy + 1, 2], [cx - 2 + sway, cy + 2, 0], 'silk');
      thread(boxes, [cx + 1, cy - 1, 2.5], [cx + 2.5 + sway, cy - 1.5, 0], 'silk');
      break;
    }
    case 'spider_nest': {
      // A CASA DE ARANHA: um domo de seda encostado na parede, com a boca
      // escura virada para a camera, fios de sustentacao ate o chao e ovos
      // encostados na base. A variante muda o tamanho e o lado da boca.
      const R = 3 + v * 0.5;
      // Camadas REDONDAS (uma caixa por voxel dentro do circulo), e nao os
      // degraus quadrados de `slab`: e o que faz ler como domo e nao caixote.
      for (let z = 0; z < R; z += 0.5) {
        const r = Math.sqrt(Math.max(0, R * R - z * z));
        for (let y = -Math.ceil(r); y <= Math.ceil(r); y += 0.5)
          for (let x = -Math.ceil(r); x <= Math.ceil(r); x += 0.5) {
            const d = Math.hypot(x, y);
            if (d > r || d < r - 0.75) continue;
            // A boca: um vao na frente (x+y grande, para a camera), na base.
            if (z < 2 && x + y > r * 0.9 && Math.abs(x - y) < 1.6 + (v ? 0.5 : 0)) continue;
            boxes.push(box(x, y, z, 0.5, 0.5, 0.5, z % 1 === 0 ? 'silk' : 'silt'));
          }
      }
      // O escuro atras da boca.
      boxes.push(box(R * 0.35 - 0.5, R * 0.35 - 0.5, 0, 1.5, 1.5, 1.5, 'scorch'));
      // Estais do domo ate o chao e ate a parede.
      thread(boxes, [-s * R * 0.7, -R * 0.7, R * 0.6], [-s * (R + 2.5), -R - 1.5, 0], 'silk');
      thread(boxes, [s * R * 0.7, -R * 0.7, R * 0.6], [s * (R + 2), -R - 2, 0], 'silk');
      thread(boxes, [0, 0, R], [-s * 1.5, -1.5, R + 3.5], 'silk');
      boxes.push(box(-s * 1.5 - 0.25, -1.75, R + 3.25, 0.5, 0.5, 0.5, 'sutureResin'));
      // Ovos na base, do lado da boca.
      for (let k = 0; k < 3; k++) {
        const ex = s * (R - 0.5 - k * 0.9),
          ey = -R + 0.5 + k * 0.7;
        boxes.push(box(ex, ey, 0, 1, 1, 1.5, 'silk'));
      }
      break;
    }
    case 'egg_cluster': {
      // A NINHADA: seis ovos de seda juntos por fios, um deles ja aberto (o
      // fundo escuro aparece pela racha). A variante muda a arrumacao.
      const eggs = [
        [0, 0],
        [1.5, 0.5],
        [-1.5, 0.8],
        [0.4, 1.8],
        [-0.6, -1.4],
        [1.6, -1.2],
      ];
      eggs.forEach(([x, y], k) => {
        const ex = x * s + (v ? 0.3 : 0),
          ey = y + (v && k % 2 ? 0.4 : 0);
        const h = 1.5 + (k % 3) * 0.25;
        boxes.push(box(ex - 0.5, ey - 0.5, 0, 1, 1, h, 'silk'));
        boxes.push(box(ex - 0.25, ey - 0.25, h, 0.5, 0.5, 0.5, 'silt'));
        if (k === 3 + v) {
          // O ovo aberto: a tampa fora e o fundo escuro.
          boxes.push(box(ex - 0.25, ey - 0.25, h - 0.5, 0.5, 0.5, 0.5, 'scorch'));
          boxes.push(box(ex + 0.75, ey - 0.75, 0, 0.5, 0.5, 0.5, 'silt'));
        }
      });
      // Os fios que prendem a ninhada ao chao.
      thread(boxes, [0, 0, 1.5], [-3 * s, 2, 0], 'silk');
      thread(boxes, [1.5 * s, 0.5, 1.5], [3.5 * s, -1.5, 0], 'silk');
      break;
    }

    // ------------------------------------------------------------------
    // LANDMARKS: os monumentos. Mais altos que qualquer parede, mais baixos
    // que o Nucleo — pontuacao do salao, nunca competindo com o objetivo.
    // ------------------------------------------------------------------
    case 'monolith': {
      cone(boxes, [
        [6, 6, 'rock'],
        [5, 6, 'rockDeep'],
        [4, 6, 'rock'],
        [2, 5 + v, 'rockDeep'],
      ]);
      boxes.push(box(s * 5, s * 3, 6, 2, 2, 3, 'rockDeep')); // lasca na junta
      boxes.push(box(-s * 4, s * 4, 12, 1, 1, 2, 'rock'));
      break;
    }
    case 'great_prism': {
      // A agulha FRIA: facetas que abrem e fecham, familia do gelo — nem um
      // voxel do biolum reativo. Monumento nao e municao.
      slab(boxes, 0, 0, 5, 0, 3, 'rock');
      const radii = [2, 3, 4, 3, 2, 1];
      let z = 3;
      for (const r of radii) {
        slab(boxes, 0, 0, r, z, 3, 'ice');
        z += 3;
      }
      slab(boxes, 0, 0, 0, z, 2, 'ice'); // a ponta
      cone(
        boxes,
        [
          [1, 4, 'ice'],
          [0, 3, 'ice'],
        ],
        s * 6,
        s,
      ); // lasca satelite
      cone(
        boxes,
        [
          [1, 3, 'ice'],
          [0, 2 + v, 'ice'],
        ],
        -s * 5,
        s * 3,
      );
      break;
    }
    case 'stalagnate': {
      // Chao e teto unidos: larga embaixo, cintura no meio, flare discreto
      // em cima — o flare largo demais lia como MESA, nao como coluna.
      cone(boxes, [
        [5, 3, 'bone'],
        [3, 4, 'bone'],
        [2, 5, 'ice'],
        [1, 5, 'bone'],
        [2, 4, 'bone'],
        [1, 3 + v, 'bone'],
      ]);
      cone(
        boxes,
        [
          [1, 3, 'bone'],
          [0, 2, 'bone'],
        ],
        s * 5,
        s * 2,
      ); // filha
      break;
    }
    case 'strata_arch': {
      // A porta que a erosao fez: pilares laminados (a banda segue o z, como
      // a parede da Silica) e o lintel por cima.
      for (const px of [-6, 4]) {
        boxes.push(box(px, -2, 0, 3, 4, 3, 'bone'));
        boxes.push(box(px, -2, 3, 3, 4, 3, 'rust'));
        boxes.push(box(px, -2, 6, 3, 4, 3, 'bone'));
        boxes.push(box(px, -2, 9, 3, 4, 3, 'rust'));
      }
      boxes.push(box(-7, -2, 12, 15, 4, 3, 'bone'));
      boxes.push(box(-5 + v, -2, 15, 8, 3, 2, 'rust'));
      break;
    }
    case 'great_fumarole': {
      // A chamine-mae, extinta: boca escura funda, nenhuma fumaca.
      const top = cone(boxes, [
        [6, 3, 'bone'],
        [5, 3, 'rust'],
        [4, 3, 'bone'],
        [3, 3, 'rust'],
        [2, 4 + v, 'bone'],
      ]);
      boxes.push(box(-1, -1, top, 3, 3, 2, 'scorch'));
      boxes.push(box(s * 5, s, 3, 1, 2, 5, 'rust')); // escorrimento na saia
      boxes.push(box(-s * 4, s * 3, 3, 1, 1, 3, 'rust'));
      break;
    }
    case 'slag_monolith': {
      // Mesma regra do slag_block: rockDeep/rock dao a silhueta; o scorch e
      // detalhe de fresta, nunca o volume (invisivel contra o fundo).
      slab(boxes, 0, 0, 6, 0, 5, 'rockDeep');
      slab(boxes, v - 1, 0, 4, 5, 5, 'rock');
      boxes.push(box(-3, 1, 8, 6, 2, 2, 'scorch'));
      slab(boxes, s, 0, 3, 10, 5, 'rockDeep');
      slab(boxes, 0, 0, 1, 15, 4 - v, 'rock');
      boxes.push(box(s * 6, 0, 2, 1, 2, 9, 'rust')); // veio de oxido na face
      break;
    }
    case 'frost_obelisk': {
      slab(boxes, 0, 0, 5, 0, 4, 'rock');
      slab(boxes, 0, 0, 3, 4, 7, 'ice');
      slab(boxes, 0, 0, 2, 11, 7, 'ice');
      slab(boxes, 0, 0, 1, 18, 5, 'ice');
      slab(boxes, 0, 0, 0, 23, 2 + v, 'ice');
      cone(
        boxes,
        [
          [1, 4, 'ice'],
          [0, 3, 'ice'],
        ],
        s * 5,
        s * 3,
      ); // agulha filha
      break;
    }
    case 'magnet_core': {
      // O no-mae: massa escura com placas de oxido presas em orbita — a
      // unica "fisica" e visual e congelada.
      slab(boxes, 0, 0, 5, 0, 8, 'rockDeep');
      slab(boxes, 0, 0, 3, 8, 5, 'rockDeep');
      boxes.push(box(-8, -2, 6 + v, 2, 5, 4, 'rust'));
      boxes.push(box(6, -2, 9 - v, 2, 5, 4, 'rust'));
      boxes.push(box(-2, -2, 13, 5, 5, 3, 'rust'));
      slab(boxes, 0, 0, 1, 16, 3, 'rockDeep');
      break;
    }
    case 'drill': {
      // A broca-mae, parada onde parou: plataforma, mastro, colar e a ponta
      // de osso apontando para o veio. Maquina morta — sem luz de painel.
      slab(boxes, 0, 0, 6, 0, 3, 'rockDeep');
      for (const [lx, ly] of [
        [-6, -6],
        [5, -6],
        [-6, 5],
        [5, 5],
      ]) {
        boxes.push(box(lx, ly, 3, 2, 2, 5, 'rust'));
      }
      boxes.push(box(-2, -2, 3, 4, 4, 17, 'rust')); // mastro
      slab(boxes, 0, 0, 3, 12, 3, 'rockDeep'); // colar
      boxes.push(box(2, -1 + v, 17, 5, 3, 2, 'rust')); // braco
      boxes.push(box(s * 4, -1, 6, 2, 2, 6, 'bone')); // o fuste da broca
      // A PONTA: entre o topo da plataforma (z3) e o fuste (z6) — no z0 o
      // helper a enterrava dentro da propria plataforma.
      boxes.push(box(s * 4, 0, 3, 1, 1, 3, 'bone'));
      break;
    }
    // ------------------------------------------------------------------
    // CHAO/BORDA medios e a infraestrutura Aurix de piso.
    // ------------------------------------------------------------------
    case 'walkway': {
      // Passarela CAIDA: pranchas rasas com vao e uma ponta levantada —
      // baixa de proposito, quebrada o bastante para nunca parecer caminho.
      boxes.push(box(-7, -3 + v, 0, 5, 5, 1, 'rust'));
      boxes.push(box(-2, -3 + v, 0, 1, 5, 1, 'rockDeep')); // travessa
      // o VAO
      boxes.push(box(1, -2 + v, 0, 5, 5, 1, 'rust'));
      boxes.push(box(4, -2 + v, 1, 2, 5, 1, 'rust')); // ponta levantada
      boxes.push(box(s * 6, 2, 0, 2, 2, 1, 'rockDeep')); // prancha solta
      break;
    }
    case 'rail': {
      // Trilho: DORMENTES curtos atravessados, dois frisos compridos por
      // cima — e um dormente arrancado adiante, porque a linha morreu.
      for (const tx of [-6, -2, 2]) boxes.push(box(tx, -4, 0, 2, 9, 1, 'bone'));
      boxes.push(box(-7, -3, 1, 13 + v, 1, 1, 'rust'));
      boxes.push(box(-7, 2, 1, 13 + v, 1, 1, 'rust'));
      boxes.push(box(6, s * 4, 0, 2, 5, 1, 'bone')); // dormente arrancado
      break;
    }
    case 'calcite_basin': {
      // Bacia: anel de borda com o fundo raso — a agua que a esculpiu ja
      // secou; sobra o espelho mineral.
      slab(boxes, 0, 0, 5, 0, 1, 'bone');
      for (let y = -5; y <= 5; y++) {
        for (let x = -5; x <= 5; x++) {
          const edge = Math.max(Math.abs(x), Math.abs(y));
          if (edge < 4 || (Math.abs(x) === 5 && Math.abs(y) === 5)) continue;
          boxes.push(box(x, y, 1, 1, 1, 1 + (edge === 4 ? 0 : v), 'bone'));
        }
      }
      boxes.push(box(-2, -2 + v, 1, 4, 4, 1, 'ice')); // o fundo umido
      break;
    }
    case 'crystal_fan': {
      // Leque FRIO: laminas em degraus contra a parede — familia do gelo,
      // nunca o biolum reativo.
      boxes.push(box(-4, -1, 0, 2, 2, 5, 'ice'));
      boxes.push(box(-2, -1, 0, 2, 2, 8, 'ice'));
      boxes.push(box(0, -1, 0, 2, 2, 10 + v, 'ice'));
      boxes.push(box(2, -1, 0, 2, 2, 7, 'ice'));
      boxes.push(box(4, -1, 0, 2, 2, 4, 'ice'));
      boxes.push(box(s * 2 - 1, 1, 0, 3, 1, 2, 'bone')); // a base mineral
      break;
    }
    case 'slab_pile': {
      // Pilha de lajes desalinhadas: cada uma com o proprio rumo.
      boxes.push(box(-5, -3, 0, 9, 7, 2, 'bone'));
      boxes.push(box(-4 + v, -2, 2, 7, 5, 2, 'rust'));
      boxes.push(box(-2, -1 + v, 4, 5, 4, 2, 'bone'));
      boxes.push(box(s * 4, 3, 0, 3, 2, 1, 'rust')); // a laja que escorregou
      break;
    }
    case 'fallen_plate': {
      // Placa inteira tombada, apoiada num canto — congelada no meio da queda.
      boxes.push(box(-6, -3, 0, 10, 7, 2, 'bone'));
      boxes.push(box(-6, -3, 2, 10, 2, 1, 'rust')); // a borda laminada
      boxes.push(box(3, 2, 0, 3, 3, 3 + v, 'bone')); // o apoio
      boxes.push(box(s * 5, -2, 0, 2, 2, 1, 'rust'));
      break;
    }
    case 'sulfur_mound': {
      cone(boxes, [
        [3, 1, 'bone'],
        [2, 1, 'rust'],
        [1, 1 + v, 'bone'],
      ]);
      cone(
        boxes,
        [
          [1, 1, 'rust'],
          [0, 1, 'bone'],
        ],
        s * 4,
        s,
      );
      break;
    }
    case 'cinder_pile': {
      // Cinza assentada: montinho escuro com nucleos que ja foram brasa.
      cone(boxes, [
        [3, 1, 'rockDeep'],
        [2, 1, 'rockDeep'],
        [1, 1, 'rock'],
      ]);
      boxes.push(box(s * 3, -2, 0, 2, 2, 1 + v, 'rockDeep'));
      boxes.push(box(-s * 2, 2, 0, 2, 2, 1, 'rock'));
      break;
    }
    case 'frost_stone': {
      slab(boxes, 0, 0, 3, 0, 3, 'rock');
      slab(boxes, v - 1, 0, 2, 3, 2, 'ice'); // a capa de geada
      boxes.push(box(s * 3, s, 0, 2, 2, 2, 'rock'));
      break;
    }
    case 'lodestone': {
      // Magnetita: pedra escura com a face oxidada — sem ouro, nunca.
      slab(boxes, 0, 0, 2, 0, 4, 'rockDeep');
      boxes.push(box(2, -2, 1, 1, 4, 3, 'rust')); // a face oxidada
      boxes.push(box(s * 3, s, 0, 2, 2, 2 - v, 'rockDeep'));
      break;
    }
    case 'ore_spur': {
      // Esporao de veio aflorando: a camada que continua parede adentro.
      boxes.push(box(-4, -2, 0, 8, 4, 2, 'rockDeep'));
      boxes.push(box(-3, -1, 2, 3, 2, 3, 'rust'));
      boxes.push(box(1, -1, 2, 3, 2, 2 + v, 'rust'));
      boxes.push(box(s * 2, 1, 4, 2, 1, 2, 'rust'));
      break;
    }

    // ------------------------------------------------------------------
    // TETO (minerais): de ponta-cabeca — a BICA no z0 (ancora), alargando
    // para cima. O cliente desenha erguido e translucido.
    // ------------------------------------------------------------------
    case 'hanging_spur': {
      cone(boxes, [
        [0, 3, 'rockDeep'],
        [1, 4, 'rock'],
        [2, 4, 'rockDeep'],
      ]);
      cone(
        boxes,
        [
          [0, 2, 'rock'],
          [1, 3 + v, 'rockDeep'],
        ],
        s * 4,
        s,
      );
      break;
    }
    case 'crystal_chandelier': {
      // Lustre frio: agulhas invertidas em leque, presas num miolo comum.
      cone(
        boxes,
        [
          [0, 4, 'ice'],
          [1, 4, 'ice'],
        ],
        0,
        0,
      );
      cone(
        boxes,
        [
          [0, 3, 'ice'],
          [1, 2, 'ice'],
        ],
        -4,
        s,
      );
      cone(
        boxes,
        [
          [0, 3 + v, 'ice'],
          [1, 2, 'ice'],
        ],
        4,
        -s,
      );
      boxes.push(box(-5, -1, 7, 11, 3, 2, 'rock')); // o miolo na rocha
      break;
    }
    case 'stalactite': {
      cone(boxes, [
        [0, 3, 'bone'],
        [1, 4, 'bone'],
        [2, 4, 'bone'],
        [3, 3 + v, 'bone'],
      ]);
      cone(
        boxes,
        [
          [0, 2, 'bone'],
          [1, 3, 'bone'],
        ],
        s * 5,
        s * 2,
      );
      break;
    }
    case 'hanging_slab': {
      // Laje descolada do teto, pendendo em diagonal — degraus descendo.
      boxes.push(box(-5, -2, 6 + v, 4, 4, 3, 'bone'));
      boxes.push(box(-2, -2, 4, 4, 4, 3, 'rust'));
      boxes.push(box(1, -2, 2, 4, 4, 3, 'bone'));
      boxes.push(box(4, -1, 0, 2, 3, 3, 'rust')); // a ponta que vai cair
      break;
    }
    case 'sulfur_drip': {
      // Escorrimento mineral APAGADO: crosta terrosa gotejando — sem verde
      // de gas, sem particula.
      cone(boxes, [
        [0, 2, 'rust'],
        [1, 3, 'bone'],
        [2, 3, 'rust'],
        [3, 2 + v, 'bone'],
      ]);
      cone(boxes, [[0, 3, 'bone']], s * 3, s);
      cone(boxes, [[0, 2, 'rust']], -s * 3, -s);
      break;
    }
    case 'soot_fang': {
      cone(boxes, [
        [0, 3, 'rockDeep'],
        [1, 4, 'rockDeep'],
        [2, 3 + v, 'rock'],
      ]);
      boxes.push(box(s * 2, 0, 8 + v, 2, 2, 1, 'scorch')); // fuligem na raiz
      break;
    }
    case 'icicle': {
      cone(boxes, [
        [0, 4, 'ice'],
        [1, 4, 'ice'],
        [2, 3, 'ice'],
      ]);
      cone(
        boxes,
        [
          [0, 3, 'ice'],
          [1, 2, 'ice'],
        ],
        s * 4,
        s,
      );
      cone(boxes, [[0, 2 + v, 'ice']], -s * 3, s * 2);
      break;
    }
    case 'canary_cage': {
      // O medidor vivo da operacao. v=0: o canario no poleiro — o UNICO
      // amarelo permitido na decoracao, porque aqui o amarelo e INFORMACAO
      // (um passaro engaiolado nao le como coletavel). v=1: o poleiro vazio
      // e o passaro caido na bandeja, sem um voxel de cor viva.
      boxes.push(box(-2, -2, 0, 5, 5, 1, 'rockDeep')); // bandeja
      for (const [bx, by] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        boxes.push(box(bx, by, 1, 1, 1, 6, 'rust')); // barras
      }
      slab(boxes, 0, 0, 2, 7, 1, 'rust'); // tampa
      boxes.push(box(0, 0, 8, 1, 1, 2, 'rust')); // argola
      boxes.push(box(-2, 0, 3, 5, 1, 1, 'bone')); // poleiro
      if (v === 0) {
        boxes.push(box(0, 0, 4, 1, 1, 1, 'loot')); // o canario, cantando
      } else {
        boxes.push(box(1, 1, 1, 1, 1, 1, 'rust')); // o canario, calado
      }
      break;
    }
    default:
      throw new Error(`decor prop desconhecido: ${kind}`);
  }
  return boxes;
};

/** Modelo pelo NOME de atlas (`decor:<kind>:<variante>`), ja texturizado. */
export const decorPropModel = (name, frame = 0) => {
  const [, kind, v] = name.split(':');
  // Seed por (kind, variante): a malha da variante 1 nao repete a da 0.
  let seed = 0x811c9dc5 ^ Number(v);
  for (let i = 0; i < kind.length; i++) seed = Math.imul(seed ^ kind.charCodeAt(i), 0x01000193);
  return texture(modelOf(kind, Number(v), frame), seed >>> 0);
};
