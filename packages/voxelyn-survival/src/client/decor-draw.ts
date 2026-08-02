// Desenho dos props decorativos: conjuntos pequenos de voxels em runtime.
//
// Sem atlas de proposito: um prop sao tres a seis voxels do MESMO primitivo
// que particulas e projeteis ja usam (`drawVoxel`), entao ele pertence ao
// mundo facetado de graca e nao custa um byte de textura. O grao maior que o
// dos blocos pre-renderizados e aceitavel para enfeite — e a silhueta, nao o
// detalhe, que carrega a leitura.
//
// As rampas obedecem as regras anti-mentira da camada:
// - cristal decorativo usa a familia FRIA (mist/rocha) — nunca o biolum
//   pulsante do cristal reativo;
// - nada de ouro de loot: caixa Aurix e ferrugem e osso, nao premio;
// - enxofre decorativo e APAGADO (terroso), sem o verde vivo do gas;
// - nenhum vermelho de projetil, nenhuma brasa acesa.
import { drawVoxel, type FaceRamp } from './voxel-draw';
import type { DecorativeProp } from './decor';

const ROCK: FaceRamp = ['#46566e', '#2e3a4d', '#1d2430'];
const ROCK_DEEP: FaceRamp = ['#2e3a4d', '#1d2430', '#0b0e14'];
const BONE: FaceRamp = ['#b8a98f', '#8a7154', '#6e4a33'];
const RUST: FaceRamp = ['#6e4a33', '#3d2a22', '#1d2430'];
const MIST: FaceRamp = ['#7b8ba3', '#46566e', '#2e3a4d'];
const FUNGUS: FaceRamp = ['#66c28a', '#3f8a5e', '#1f3d33'];
const FUNGUS_DEEP: FaceRamp = ['#2f6b4f', '#1f3d33', '#0b0e14'];
const SULFUR_DULL: FaceRamp = ['#8a7154', '#6e4a33', '#3d2a22'];
const CHAR: FaceRamp = ['#3d2a22', '#1d2430', '#0b0e14'];

/**
 * As familias de cor da decoracao, exportadas para quem desenha ENFEITE fora
 * deste arquivo (a morfologia de borda das paredes usa as mesmas). A regra
 * anti-mentira viaja junto: nenhuma delas contem o biolum reativo, o ouro de
 * loot, nem cor de fogo/projetil.
 */
export const DECOR_RAMPS = {
  ROCK,
  ROCK_DEEP,
  BONE,
  RUST,
  MIST,
  FUNGUS,
  FUNGUS_DEEP,
  SULFUR_DULL,
  CHAR,
} as const;

const h32 = (v: number): number => {
  let x = Math.imul(v ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  return (Math.imul(x, 0xc2b2ae35) ^ (x >>> 16)) >>> 0;
};

/**
 * Desenha um prop na posicao de tela (sx, sy) da celula ancora.
 *
 * Todo prop e BAIXO (teto em ~metade da parede) e com vazios na silhueta: a
 * regra e nunca parecer solido o bastante para bloquear o Prospector. A
 * variacao (tamanho, espelho, jitter) sai do `variant` sorteado na colocacao —
 * nunca de Math.random, senao o prop tremeria entre quadros.
 */
/**
 * Opacidade dos props de TETO. Eles pairam sobre a celula onde o jogo
 * acontece; a translucidez e o contrato de honestidade — nada que pende do
 * alto pode esconder um inimigo, um projetil ou a superficie que joga.
 */
const CEILING_ALPHA = 0.58;

/** Props de teto: desenhados ERGUIDOS (pendem da rocha) e sob alpha proprio. */
const drawCeilingProp = (
  ctx: CanvasRenderingContext2D,
  prop: DecorativeProp,
  x: number,
  sy: number,
  s: (px: number) => number,
  flip: number,
  v: number,
  nowMs: number,
): void => {
  // A altura do "teto" na projecao: bem acima da cabeca das criaturas.
  const top = sy - s(17);
  switch (prop.kind) {
    case 'hanging_spur':
      // Esporao basaltico: dois dentes rombudos descendo.
      drawVoxel(ctx, x, top, s(3.6), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(2.6), top + s(1.6), s(2.6), ROCK);
      drawVoxel(ctx, x, top + s(3), s(2.2), ROCK_DEEP);
      return;
    case 'crystal_chandelier': {
      // Lustre da Catedral: leque invertido na familia FRIA — decorativo,
      // nunca o biolum pulsante do cristal reativo.
      for (let k = 0; k < 3; k++) {
        drawVoxel(ctx, x + flip * (k - 1) * s(2.4), top + Math.abs(k - 1) * s(1.4), s(2.4), MIST);
      }
      drawVoxel(ctx, x, top + s(3.2), s(1.6), MIST);
      return;
    }
    case 'stalactite':
      drawVoxel(ctx, x, top, s(3.6), BONE);
      drawVoxel(ctx, x, top + s(2.4), s(2.6), BONE);
      drawVoxel(ctx, x, top + s(4.4), s(1.6), BONE);
      return;
    case 'hanging_slab':
      // Laje descolada do teto sedimentar, pendendo em diagonal.
      drawVoxel(ctx, x, top, s(4.6), BONE);
      drawVoxel(ctx, x + flip * s(2.4), top + s(2), s(3.4), RUST);
      return;
    case 'sulfur_drip':
      // Escorrimento mineral APAGADO: crosta terrosa, nenhum verde de gas.
      drawVoxel(ctx, x, top, s(3.4), SULFUR_DULL);
      drawVoxel(ctx, x + flip * s(1.4), top + s(2.2), s(2.2), RUST);
      drawVoxel(ctx, x, top + s(4), s(1.4), SULFUR_DULL);
      return;
    case 'soot_fang':
      drawVoxel(ctx, x, top, s(3.2), CHAR);
      drawVoxel(ctx, x, top + s(2.4), s(2), ROCK_DEEP);
      return;
    case 'icicle':
      drawVoxel(ctx, x - s(1.6), top, s(2.4), MIST);
      drawVoxel(ctx, x + s(1.8), top + s(0.8), s(2), MIST);
      drawVoxel(ctx, x, top + s(2.6), s(1.4), MIST);
      return;
    case 'spore_veil': {
      // O veu da colonia RESPIRA como o cogumelo respira: deriva lenta por
      // tempo local + variant, nunca pela RNG autoritativa.
      const drift = Math.sin(nowMs / 1400 + (v % 9)) * s(0.7);
      drawVoxel(ctx, x + drift, top, s(4.2), FUNGUS_DEEP);
      drawVoxel(ctx, x - drift * 0.6, top + s(2.2), s(3), FUNGUS);
      drawVoxel(ctx, x + drift * 0.3, top + s(4.2), s(1.8), FUNGUS_DEEP);
      return;
    }
    case 'cable_hook': {
      // Cabo Aurix esquecido: pende reto, gancho vazio. Sem carga, sem
      // brilho — o que a operacao icava ja foi embora ha muito tempo.
      const sway = Math.sin(nowMs / 1700 + (v % 5)) * s(0.5);
      drawVoxel(ctx, x, top, s(1.6), RUST);
      drawVoxel(ctx, x + sway * 0.5, top + s(2.2), s(1.4), RUST);
      drawVoxel(ctx, x + sway, top + s(4.2), s(2.2), ROCK_DEEP);
      return;
    }
    default:
      return;
  }
};

/**
 * Landmarks: os monumentos que coroam uma celula SOLIDA no coracao do salao.
 * Sao os unicos props altos e macicos — e por isso mesmo ancorados em materia
 * que de fato bloqueia. Desenham a partir do TOPO do bloco pedestal.
 */
const drawLandmarkProp = (
  ctx: CanvasRenderingContext2D,
  prop: DecorativeProp,
  x: number,
  sy: number,
  s: (px: number) => number,
  flip: number,
): void => {
  // O topo do bloco de parede fica ~14px (WALL_H) acima da base do tile; o
  // monumento nasce dali para cima.
  const base = sy - s(12);
  switch (prop.kind) {
    case 'monolith':
      // Basalto: tambores empilhados afinando — o peso que sobrou de pe.
      drawVoxel(ctx, x, base, s(7), ROCK);
      drawVoxel(ctx, x + flip * s(0.6), base - s(4), s(5.6), ROCK_DEEP);
      drawVoxel(ctx, x, base - s(7.6), s(4.4), ROCK);
      drawVoxel(ctx, x - flip * s(0.4), base - s(10.6), s(3), ROCK_DEEP);
      return;
    case 'great_prism':
      // Catedral: agulha da familia FRIA. Imensa, mas sem um unico pixel do
      // biolum reativo — monumento nao e municao.
      drawVoxel(ctx, x, base, s(6.4), MIST);
      drawVoxel(ctx, x + flip * s(2.8), base - s(2), s(3.4), MIST);
      drawVoxel(ctx, x, base - s(4.6), s(4.6), MIST);
      drawVoxel(ctx, x, base - s(8.6), s(3.2), MIST);
      drawVoxel(ctx, x, base - s(11.4), s(2), MIST);
      return;
    case 'stalagnate':
      // Aquifero: a coluna que juntou chao e teto — milhoes de gotas.
      drawVoxel(ctx, x, base, s(6.6), BONE);
      drawVoxel(ctx, x, base - s(3.6), s(4.4), BONE);
      drawVoxel(ctx, x, base - s(6.6), s(3.4), MIST);
      drawVoxel(ctx, x, base - s(9.4), s(4.2), BONE);
      drawVoxel(ctx, x, base - s(12), s(5.4), BONE);
      return;
    case 'strata_arch':
      // Silica: dois pilares laminados e o lintel — a porta que a erosao fez.
      drawVoxel(ctx, x - s(3.6), base, s(3.6), BONE);
      drawVoxel(ctx, x - s(3.6), base - s(3.2), s(3.2), RUST);
      drawVoxel(ctx, x - s(3.6), base - s(6), s(3), BONE);
      drawVoxel(ctx, x + s(3.6), base, s(3.6), RUST);
      drawVoxel(ctx, x + s(3.6), base - s(3.2), s(3.2), BONE);
      drawVoxel(ctx, x + s(3.6), base - s(6), s(3), RUST);
      drawVoxel(ctx, x, base - s(8.8), s(8), BONE);
      return;
    case 'great_fumarole':
      // Fenda: a chamine-mae, EXTINTA — boca escura, nenhuma fumaca.
      drawVoxel(ctx, x, base, s(8), SULFUR_DULL);
      drawVoxel(ctx, x + flip * s(0.8), base - s(4.4), s(6), RUST);
      drawVoxel(ctx, x, base - s(8), s(4.4), SULFUR_DULL);
      drawVoxel(ctx, x, base - s(10.6), s(2.6), CHAR);
      return;
    case 'slag_monolith':
      // Fornalha: escoria que esfriou empilhada, um idolo involuntario.
      drawVoxel(ctx, x, base, s(7.4), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(1.6), base - s(4), s(5.4), CHAR);
      drawVoxel(ctx, x - flip * s(0.8), base - s(7.4), s(4.6), ROCK_DEEP);
      drawVoxel(ctx, x, base - s(10.2), s(2.8), CHAR);
      return;
    case 'frost_obelisk':
      // Cripta: pedra antiga sob gelo morto — opaco, sem cintilar.
      drawVoxel(ctx, x, base, s(6), ROCK);
      drawVoxel(ctx, x, base - s(4), s(4.6), MIST);
      drawVoxel(ctx, x, base - s(7.6), s(3.6), MIST);
      drawVoxel(ctx, x, base - s(10.4), s(2.2), MIST);
      return;
    case 'magnet_core': {
      // O NO-MAE do Ferrifero: bloco de magnetita com placas de oxido presas
      // em orbita — a unica "fisica" e visual e congelada. Escuro e pesado;
      // nenhuma luz, nenhum ouro.
      drawVoxel(ctx, x, base, s(7.2), ROCK_DEEP);
      drawVoxel(ctx, x, base - s(4.2), s(5.2), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(3.6), base - s(6), s(2.4), RUST);
      drawVoxel(ctx, x - flip * s(3.2), base - s(7.4), s(2), RUST);
      drawVoxel(ctx, x, base - s(8), s(3.6), RUST);
      drawVoxel(ctx, x + flip * s(1.2), base - s(10.6), s(2.2), ROCK_DEEP);
      return;
    }
    case 'drill':
      // A broca-mae da Aurix, parada onde parou: mastro de ferrugem, colar
      // escuro, e a ponta de osso enterrada no pedestal. Sem luz de painel,
      // sem ouro — maquina morta e maquina morta.
      drawVoxel(ctx, x, base, s(7.6), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(2.2), base - s(3.6), s(3), RUST);
      drawVoxel(ctx, x, base - s(4.4), s(5), RUST);
      drawVoxel(ctx, x, base - s(8), s(4), ROCK_DEEP);
      drawVoxel(ctx, x, base - s(11), s(3), RUST);
      drawVoxel(ctx, x, base - s(13.2), s(1.8), BONE);
      return;
    default:
      return;
  }
};

export const drawDecorProp = (
  ctx: CanvasRenderingContext2D,
  prop: DecorativeProp,
  sx: number,
  sy: number,
  z: number,
  nowMs: number,
): void => {
  const v = h32(prop.variant);
  const flip = (v & 1) === 0 ? 1 : -1;
  const jx = (((v >>> 2) & 3) - 1.5) * z;
  const grow = 0.85 + ((v >>> 4) % 8) * 0.05; // 0.85..1.2
  const s = (px: number): number => px * z * grow;
  const x = sx + jx;

  if (prop.anchor === 'ceiling') {
    ctx.save();
    ctx.globalAlpha *= CEILING_ALPHA;
    drawCeilingProp(ctx, prop, x, sy, s, flip, v, nowMs);
    ctx.restore();
    return;
  }
  if (prop.anchor === 'landmark') {
    // Landmark ignora o jitter: o monumento e centrado no pedestal.
    drawLandmarkProp(ctx, prop, sx, sy, s, flip);
    return;
  }

  switch (prop.kind) {
    case 'fallen_column': {
      // Coluna tombada: tres tambores em linha, afundando — peso tectonico.
      for (let k = 0; k < 3; k++) {
        drawVoxel(ctx, x + flip * k * s(4.4), sy + k * s(1.4), s(4.6 - k * 0.5), ROCK);
      }
      return;
    }
    case 'rubble':
      drawVoxel(ctx, x - s(2.2), sy + s(0.8), s(3.4), ROCK_DEEP);
      drawVoxel(ctx, x + s(1.8), sy, s(2.8), ROCK);
      drawVoxel(ctx, x, sy - s(1.4), s(2.4), ROCK);
      return;
    case 'basalt_shard':
      drawVoxel(ctx, x, sy, s(2.6), ROCK_DEEP);
      return;
    case 'crystal_fan': {
      // Leque decorativo: fino, translucido na leitura (familia fria), SEM o
      // nucleo pulsante do cristal reativo.
      for (let k = 0; k < 3; k++) {
        drawVoxel(ctx, x + flip * k * s(2.2), sy - k * s(2.6), s(2.4 + k * 0.4), MIST);
      }
      return;
    }
    case 'crystal_shards':
      drawVoxel(ctx, x, sy, s(2), MIST);
      drawVoxel(ctx, x + flip * s(2.6), sy + s(1), s(1.6), MIST);
      return;
    case 'stalagmite':
      drawVoxel(ctx, x, sy, s(4.2), BONE);
      drawVoxel(ctx, x, sy - s(3), s(2.8), BONE);
      return;
    case 'calcite_basin':
      drawVoxel(ctx, x, sy, s(6), BONE);
      drawVoxel(ctx, x - s(2.4), sy - s(0.6), s(2), MIST);
      return;
    case 'flow_curtain': {
      // Cascata petrificada ao pe da parede: camadas descendo.
      for (let k = 0; k < 3; k++) {
        drawVoxel(ctx, x + flip * k * s(1.2), sy - k * s(2.2), s(3.6 - k * 0.5), k % 2 === 0 ? BONE : MIST);
      }
      return;
    }
    case 'slab_pile':
      drawVoxel(ctx, x, sy, s(5.2), BONE);
      drawVoxel(ctx, x + flip * s(1.6), sy - s(1.6), s(4), RUST);
      return;
    case 'fallen_plate':
      drawVoxel(ctx, x, sy, s(5.6), BONE);
      drawVoxel(ctx, x + flip * s(3), sy + s(1.2), s(3), BONE);
      return;
    case 'fumarole_cone':
      // Fumarola INATIVA: nenhum fio de fumaca, nenhuma particula. A funcional
      // e o respiradouro da simulacao; esta e a carcaça mineral de uma antiga.
      drawVoxel(ctx, x, sy, s(4.4), SULFUR_DULL);
      drawVoxel(ctx, x, sy - s(3), s(2.6), RUST);
      return;
    case 'sulfur_mound':
      drawVoxel(ctx, x, sy, s(3.2), SULFUR_DULL);
      drawVoxel(ctx, x + flip * s(2), sy + s(0.8), s(2.2), SULFUR_DULL);
      return;
    case 'slag_block':
      drawVoxel(ctx, x, sy, s(5), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(2.4), sy - s(1.8), s(2.6), CHAR);
      return;
    case 'cinder_pile':
      drawVoxel(ctx, x - s(1.8), sy, s(2.4), CHAR);
      drawVoxel(ctx, x + s(1.4), sy + s(0.6), s(2), CHAR);
      drawVoxel(ctx, x, sy - s(1.2), s(1.8), ROCK_DEEP);
      return;
    case 'ice_spike':
      drawVoxel(ctx, x, sy, s(3), MIST);
      drawVoxel(ctx, x, sy - s(2.8), s(2.2), MIST);
      drawVoxel(ctx, x, sy - s(5), s(1.5), MIST);
      return;
    case 'frost_stone':
      drawVoxel(ctx, x, sy, s(3), ROCK);
      drawVoxel(ctx, x, sy - s(1.6), s(1.8), MIST);
      return;
    case 'lodestone':
      // Magnetita solta: pedra escura com a face oxidada. Sem ouro — a parede
      // comum do estrato mais rico do Veio nao pode fingir que rende.
      drawVoxel(ctx, x, sy, s(2.8), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(1.6), sy - s(1.2), s(1.8), RUST);
      return;
    case 'ore_spur':
      // Esporao de veio aflorando ao pe da parede: a camada que continua.
      drawVoxel(ctx, x, sy, s(3.6), ROCK_DEEP);
      drawVoxel(ctx, x + flip * s(2.2), sy - s(1.6), s(2.6), RUST);
      drawVoxel(ctx, x - flip * s(1.4), sy - s(2.6), s(1.8), RUST);
      return;
    case 'mushroom': {
      // O cogumelo RESPIRA: o chapeu sobe e assenta devagar. Tempo local +
      // variant, nunca a RNG autoritativa — e um enfeite vivo, nao um estado.
      const breath = Math.sin(nowMs / 1100 + (v % 7)) * s(0.5);
      drawVoxel(ctx, x, sy, s(2.2), BONE);
      drawVoxel(ctx, x, sy - s(2.6) + breath, s(4.4), FUNGUS);
      return;
    }
    case 'puffball':
      drawVoxel(ctx, x, sy, s(2.6), FUNGUS_DEEP);
      drawVoxel(ctx, x + flip * s(1.8), sy + s(0.8), s(1.8), FUNGUS_DEEP);
      return;
    case 'crate':
      // Caixa Aurix: cubo de ferrugem com tampa de osso. Sem ouro, sem halo —
      // o brilho de coletavel pertence ao cofre de verdade.
      drawVoxel(ctx, x, sy, s(5.4), RUST);
      drawVoxel(ctx, x, sy - s(3.2), s(4.2), BONE);
      return;
    case 'strut':
      // Escora: viga dupla ao pe da parede que ela um dia segurou.
      drawVoxel(ctx, x - s(1.6), sy, s(2.4), RUST);
      drawVoxel(ctx, x - s(1.6), sy - s(2.8), s(2.4), RUST);
      drawVoxel(ctx, x + s(1.8), sy - s(1.4), s(2.2), RUST);
      return;
    case 'walkway': {
      // Passarela CAIDA: placas rasas em linha, com um vao — quebrada o
      // bastante para nunca parecer um caminho que importa.
      for (let k = 0; k < 3; k++) {
        if (k === 1 && (v & 8) !== 0) continue; // o vao
        drawVoxel(ctx, x + flip * (k - 1) * s(4), sy + (k - 1) * s(1), s(3.8), k === 2 ? ROCK_DEEP : RUST);
      }
      return;
    }
    case 'rail':
      // Trilho abandonado: dois frisos paralelos sobre um dormente de osso.
      drawVoxel(ctx, x, sy + s(0.6), s(4.6), BONE);
      drawVoxel(ctx, x - s(1.8), sy - s(0.6), s(1.8), RUST);
      drawVoxel(ctx, x + s(1.8), sy - s(0.2), s(1.8), RUST);
      drawVoxel(ctx, x + flip * s(4), sy - s(1), s(1.6), RUST);
      return;
    case 'insulator':
      // Isolador ceramico: discos empilhados ao pe da parede cristalina — a
      // Aurix protegendo os circuitos DO cristal, nunca o contrario. Familia
      // fria/ossea; nenhum pixel de biolum.
      drawVoxel(ctx, x, sy, s(3.4), BONE);
      drawVoxel(ctx, x, sy - s(2), s(2.6), MIST);
      drawVoxel(ctx, x, sy - s(3.8), s(3), BONE);
      return;
    case 'duct':
      // Duto rompido: dois segmentos e o cotovelo apontando para lugar
      // nenhum — o gas que ele levava ja nao existe.
      drawVoxel(ctx, x - s(2.2), sy, s(2.6), RUST);
      drawVoxel(ctx, x + s(0.6), sy - s(0.4), s(2.6), RUST);
      drawVoxel(ctx, x + s(2.6), sy - s(2.4), s(2.2), ROCK_DEEP);
      return;
    default:
      return;
  }
};
