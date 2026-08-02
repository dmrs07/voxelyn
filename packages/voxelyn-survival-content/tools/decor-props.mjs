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
];

/** Kinds no formato do atlas de props: um frame estatico por variante. */
export const DECOR_PROP_KINDS = VOLUMETRIC.flatMap((kind) =>
  Array.from({ length: DECOR_VARIANTS }, (_, v) => ({
    name: `decor:${kind}:${v}`,
    frames: 1,
    frameMs: 0,
  })),
);

const hash3 = (x, y, z, seed) => {
  let h =
    Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(seed, 2246822519);
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
  rust: [['rockDeep', 6], ['bone', 11]],
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
const cone = (boxes, steps, cx = 0, cy = 0) => {
  let z = 0;
  for (const [r, h, mat] of steps) {
    slab(boxes, cx, cy, r, z, h, mat);
    z += h;
  }
  return z;
};

const modelOf = (kind, v) => {
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
      cone(boxes, [[1, 2, 'bone'], [0, 2, 'bone']], s * 4, 2); // broto
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
      cone(boxes, [[1, 3, 'ice'], [0, 3, 'ice']], s * 4, s * 2); // agulha filha
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
      cone(boxes, [[1, 4, 'ice'], [0, 3, 'ice']], s * 6, s); // lasca satelite
      cone(boxes, [[1, 3, 'ice'], [0, 2 + v, 'ice']], -s * 5, s * 3);
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
      cone(boxes, [[1, 3, 'bone'], [0, 2, 'bone']], s * 5, s * 2); // filha
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
      cone(boxes, [[1, 4, 'ice'], [0, 3, 'ice']], s * 5, s * 3); // agulha filha
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
      for (const [lx, ly] of [[-6, -6], [5, -6], [-6, 5], [5, 5]]) {
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
      cone(boxes, [[3, 1, 'bone'], [2, 1, 'rust'], [1, 1 + v, 'bone']]);
      cone(boxes, [[1, 1, 'rust'], [0, 1, 'bone']], s * 4, s);
      break;
    }
    case 'cinder_pile': {
      // Cinza assentada: montinho escuro com nucleos que ja foram brasa.
      cone(boxes, [[3, 1, 'rockDeep'], [2, 1, 'rockDeep'], [1, 1, 'rock']]);
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
      cone(boxes, [[0, 3, 'rockDeep'], [1, 4, 'rock'], [2, 4, 'rockDeep']]);
      cone(boxes, [[0, 2, 'rock'], [1, 3 + v, 'rockDeep']], s * 4, s);
      break;
    }
    case 'crystal_chandelier': {
      // Lustre frio: agulhas invertidas em leque, presas num miolo comum.
      cone(boxes, [[0, 4, 'ice'], [1, 4, 'ice']], 0, 0);
      cone(boxes, [[0, 3, 'ice'], [1, 2, 'ice']], -4, s);
      cone(boxes, [[0, 3 + v, 'ice'], [1, 2, 'ice']], 4, -s);
      boxes.push(box(-5, -1, 7, 11, 3, 2, 'rock')); // o miolo na rocha
      break;
    }
    case 'stalactite': {
      cone(boxes, [[0, 3, 'bone'], [1, 4, 'bone'], [2, 4, 'bone'], [3, 3 + v, 'bone']]);
      cone(boxes, [[0, 2, 'bone'], [1, 3, 'bone']], s * 5, s * 2);
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
      cone(boxes, [[0, 2, 'rust'], [1, 3, 'bone'], [2, 3, 'rust'], [3, 2 + v, 'bone']]);
      cone(boxes, [[0, 3, 'bone']], s * 3, s);
      cone(boxes, [[0, 2, 'rust']], -s * 3, -s);
      break;
    }
    case 'soot_fang': {
      cone(boxes, [[0, 3, 'rockDeep'], [1, 4, 'rockDeep'], [2, 3 + v, 'rock']]);
      boxes.push(box(s * 2, 0, 8 + v, 2, 2, 1, 'scorch')); // fuligem na raiz
      break;
    }
    case 'icicle': {
      cone(boxes, [[0, 4, 'ice'], [1, 4, 'ice'], [2, 3, 'ice']]);
      cone(boxes, [[0, 3, 'ice'], [1, 2, 'ice']], s * 4, s);
      cone(boxes, [[0, 2 + v, 'ice']], -s * 3, s * 2);
      break;
    }
    default:
      throw new Error(`decor prop desconhecido: ${kind}`);
  }
  return boxes;
};

/** Modelo pelo NOME de atlas (`decor:<kind>:<variante>`), ja texturizado. */
export const decorPropModel = (name) => {
  const [, kind, v] = name.split(':');
  // Seed por (kind, variante): a malha da variante 1 nao repete a da 0.
  let seed = 0x811c9dc5 ^ Number(v);
  for (let i = 0; i < kind.length; i++) seed = Math.imul(seed ^ kind.charCodeAt(i), 0x01000193);
  return texture(modelOf(kind, Number(v)), seed >>> 0);
};
