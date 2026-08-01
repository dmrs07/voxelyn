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
    default:
      return;
  }
};
