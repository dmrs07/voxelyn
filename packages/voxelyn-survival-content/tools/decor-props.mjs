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
];

/** Kinds no formato do atlas de props: um frame estatico por variante. */
export const DECOR_PROP_KINDS = VOLUMETRIC.flatMap((kind) =>
  Array.from({ length: DECOR_VARIANTS }, (_, v) => ({
    name: `decor:${kind}:${v}`,
    frames: 1,
    frameMs: 0,
  })),
);

/** Camada quadrada centrada: o tijolo de toda torre e de todo cone. */
const layer = (boxes, r, z, h, mat) => {
  boxes.push(box(-r, -r, z, r * 2 + 1, r * 2 + 1, h, mat));
};

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

/** Cone: camadas quadradas encolhendo. `steps` = [[raio, altura, mat], ...]. */
const cone = (boxes, steps) => {
  let z = 0;
  for (const [r, h, mat] of steps) {
    layer(boxes, r, z, h, mat);
    z += h;
  }
  return z;
};

const modelOf = (kind, v) => {
  const s = v === 0 ? 1 : -1; // espelho por variante
  const boxes = [];

  switch (kind) {
    case 'fallen_column': {
      // Tambores tombados em linha, afundando no chao; o capitel quebrado
      // largado ao lado. Peso tectonico deitado, nao empilhado.
      boxes.push(box(-5, -2 + v, 0, 3, 3, 3, 'rock'));
      boxes.push(box(-2, -2 + v, 0, 3, 3, 2, 'rock'));
      boxes.push(box(1, -1 + v, 0, 3, 3, 2, 'rockDeep'));
      boxes.push(box(4, s, 0, 2, 2, 1, 'rockDeep'));
      break;
    }
    case 'stalagmite': {
      cone(boxes, [[2, 2, 'bone'], [1, 3, 'bone'], [0, 3 + v, 'bone']]);
      boxes.push(box(s * 2, 1, 0, 1, 1, 2, 'bone')); // broto ao lado
      break;
    }
    case 'flow_curtain': {
      // Cascata petrificada: laminas CONTIGUAS descendo em degraus — placas
      // soltas liam como tres pilares, nao como cortina.
      boxes.push(box(-4, -1, 0, 2, 2, 8, 'bone'));
      boxes.push(box(-2, -1, 0, 2, 2, 7 + v, 'ice'));
      boxes.push(box(0, -1, 0, 2, 2, 5, 'bone'));
      boxes.push(box(2, -1, 0, 2, 2, 3, 'ice'));
      boxes.push(box(s * 3, -1, 0, 1, 2, 1, 'bone')); // a saia da base
      break;
    }
    case 'fumarole_cone': {
      // Cone mineral com a BOCA escura: extinta — nenhum voxel de fogo.
      const top = cone(boxes, [[3, 2, 'bone'], [2, 2, 'rust'], [1, 2 + v, 'bone']]);
      boxes.push(box(0, 0, top, 1, 1, 1, 'scorch'));
      break;
    }
    case 'slag_block': {
      // Corpo em rockDeep, nao em scorch: a rampa do queimado e toda escura
      // e some no fundo — a MESMA armadilha do primeiro sprite do Escoriaceo.
      // O scorch fica nas frestas, onde escuro e informacao, nao silhueta.
      boxes.push(box(-3, -3, 0, 6, 6, 3, 'rockDeep'));
      boxes.push(box(-2, -1 + v, 3, 4, 3, 2, 'rock'));
      boxes.push(box(-1, 0, 5, 2, 1, 1, 'scorch'));
      boxes.push(box(s * 2, -2, 3, 1, 1, 1, 'rust'));
      break;
    }
    case 'ice_spike': {
      cone(boxes, [[2, 3, 'ice'], [1, 3, 'ice'], [0, 3 + v, 'ice']]);
      boxes.push(box(s * 2, s, 0, 1, 1, 3, 'ice'));
      break;
    }
    case 'crate': {
      // Caixa Aurix: corpo de ferrugem, tampa de osso, cinta escura. Sem
      // ouro, sem halo — o brilho de coletavel pertence ao cofre.
      boxes.push(box(-3, -3, 0, 7, 6, 5, 'rust'));
      boxes.push(box(-3, -3, 5, 7, 6, 1, 'bone'));
      boxes.push(box(-1 + v, -3, 0, 1, 6, 6, 'rockDeep'));
      break;
    }
    case 'strut': {
      boxes.push(box(-4, -1, 0, 2, 2, 7, 'rust'));
      boxes.push(box(2, -1, 0, 2, 2, 7 - v, 'rust'));
      boxes.push(box(-4, -1, 7 - v, 8, 2, 1, 'rust'));
      boxes.push(box(-1, -1, 3, 2, 2, 1, 'bone'));
      break;
    }
    case 'insulator': {
      layer(boxes, 2, 0, 2, 'bone');
      layer(boxes, 1, 2, 2, 'ice');
      layer(boxes, 2, 4, 1, 'bone');
      boxes.push(box(0, 0, 5, 1, 1, 2 + v, 'rust'));
      break;
    }
    case 'duct': {
      // Cotovelo rompido: o gas que ele levava ja nao existe.
      boxes.push(box(-5, -1, 1, 6, 3, 3, 'rust'));
      boxes.push(box(0, -1, 1, 3, 3, 3, 'rockDeep'));
      boxes.push(box(0, -1, 4, 3, 3, 3 + v, 'rust'));
      boxes.push(box(1, 0, 7 + v, 1, 1, 1, 'scorch'));
      break;
    }
    case 'mushroom': {
      // Talo ALTO e chapeu em domo: com o chapeu baixo demais a projecao o
      // achatava sobre o talo e o cogumelo lia como panqueca verde no chao.
      boxes.push(box(-1, -1, 0, 2, 2, 6, 'bone'));
      layer(boxes, 3, 6, 2, 'fungus');
      layer(boxes, 2, 8, 1, 'fungus');
      layer(boxes, 1, 9, 1 + v, 'fungusDeep');
      boxes.push(box(s * 2, -2, 7, 1, 1, 1, 'bone'));
      boxes.push(box(-s * 2, 1 + v, 7, 1, 1, 1, 'bone'));
      break;
    }

    // ------------------------------------------------------------------
    // LANDMARKS: os monumentos. Mais altos que qualquer parede, mais baixos
    // que o Nucleo — pontuacao do salao, nunca competindo com o objetivo.
    // ------------------------------------------------------------------
    case 'monolith': {
      cone(boxes, [
        [4, 5, 'rock'],
        [3, 5, 'rockDeep'],
        [2, 5, 'rock'],
        [1, 4 + v, 'rockDeep'],
      ]);
      boxes.push(box(s * 3, s * 2, 5, 1, 1, 2, 'rockDeep')); // lasca na junta
      break;
    }
    case 'great_prism': {
      // A agulha FRIA: facetas que abrem e fecham, familia do gelo — nem um
      // voxel do biolum reativo. Monumento nao e municao.
      layer(boxes, 3, 0, 2, 'rock');
      const radii = [1, 2, 3, 2, 1, 0];
      let z = 2;
      for (const r of radii) {
        layer(boxes, r, z, 3, 'ice');
        z += 3;
      }
      boxes.push(box(s * 4, 0, 4, 1, 1, 3, 'ice'));
      boxes.push(box(-s * 3, s * 2, 3, 1, 1, 2 + v, 'ice'));
      break;
    }
    case 'stalagnate': {
      // Chao e teto unidos: larga embaixo, cintura no meio, flare discreto
      // em cima — o flare largo demais lia como MESA, nao como coluna.
      cone(boxes, [
        [3, 3, 'bone'],
        [2, 4, 'bone'],
        [1, 5, 'ice'],
        [2, 3, 'bone'],
        [1, 2 + v, 'bone'],
      ]);
      break;
    }
    case 'strata_arch': {
      // A porta que a erosao fez: pilares laminados e o lintel por cima.
      for (const px of [-4, 3]) {
        boxes.push(box(px, -1, 0, 2, 3, 4, 'bone'));
        boxes.push(box(px, -1, 4, 2, 3, 4, 'rust'));
        boxes.push(box(px, -1, 8, 2, 3, 3, 'bone'));
      }
      boxes.push(box(-5, -1, 11, 10, 3, 2, 'bone'));
      boxes.push(box(-3 + v, -1, 13, 5, 2, 1, 'rust'));
      break;
    }
    case 'great_fumarole': {
      // A chamine-mae, extinta: boca escura funda, nenhuma fumaca.
      const top = cone(boxes, [
        [4, 3, 'bone'],
        [3, 3, 'rust'],
        [2, 3, 'bone'],
        [1, 4 + v, 'rust'],
      ]);
      boxes.push(box(0, 0, top, 1, 1, 2, 'scorch'));
      boxes.push(box(s * 3, s, 3, 1, 1, 3, 'rust')); // escorrimento na saia
      break;
    }
    case 'slag_monolith': {
      // Mesma regra do slag_block: rockDeep/rock dao a silhueta; o scorch e
      // detalhe de fresta, nunca o volume (invisivel contra o fundo).
      boxes.push(box(-4, -3, 0, 8, 7, 4, 'rockDeep'));
      boxes.push(box(-3, -2, 4, 6, 5, 4, 'rock'));
      boxes.push(box(-2, 0, 6, 4, 1, 2, 'scorch'));
      boxes.push(box(-1 + s, -1, 8, 4, 3, 4, 'rockDeep'));
      boxes.push(box(0, -1, 12, 2, 2, 3 - v, 'rock'));
      boxes.push(box(s * 4, 0, 2, 1, 1, 6, 'rust')); // veio de oxido na face
      break;
    }
    case 'frost_obelisk': {
      layer(boxes, 3, 0, 3, 'rock');
      layer(boxes, 2, 3, 5, 'ice');
      layer(boxes, 1, 8, 6, 'ice');
      layer(boxes, 0, 14, 4 + v, 'ice');
      boxes.push(box(s * 3, s * 2, 3, 1, 1, 2, 'ice'));
      break;
    }
    case 'magnet_core': {
      // O no-mae: massa escura com placas de oxido presas em orbita — a
      // unica "fisica" e visual e congelada.
      layer(boxes, 3, 0, 6, 'rockDeep');
      layer(boxes, 2, 6, 3, 'rockDeep');
      boxes.push(box(-5, -1, 4 + v, 1, 3, 3, 'rust'));
      boxes.push(box(4, -1, 6 - v, 1, 3, 3, 'rust'));
      boxes.push(box(-1, -1, 9, 3, 3, 2, 'rust'));
      boxes.push(box(0, 0, 11, 1, 1, 2, 'rockDeep'));
      break;
    }
    case 'drill': {
      // A broca-mae, parada onde parou: plataforma, mastro, colar e a ponta
      // de osso apontando para o veio. Maquina morta — sem luz de painel.
      boxes.push(box(-4, -4, 0, 9, 8, 2, 'rockDeep'));
      for (const [lx, ly] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) {
        boxes.push(box(lx, ly, 2, 1, 1, 3, 'rust'));
      }
      boxes.push(box(-1, -1, 2, 2, 2, 12, 'rust'));
      boxes.push(box(-2, -2, 8, 4, 4, 2, 'rockDeep'));
      boxes.push(box(1, -1 + v, 11, 3, 2, 1, 'rust'));
      boxes.push(box(s * 2, 0, 4, 1, 1, 4, 'bone'));
      boxes.push(box(s * 2, 0, 3, 1, 1, 1, 'bone'));
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
