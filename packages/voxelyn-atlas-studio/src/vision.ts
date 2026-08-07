// Visao da IA: transforma o modelo em imagens que o Claude enxerga.
//
// Existe porque o resumo de texto descreve a anatomia mas nao a MOSTRA — e um
// animador precisa ver a pose neutra para saber para que lado cada pata aponta.
// Mandar as camadas de voxel em texto seria a alternativa obvia e e a errada:
// custa ~10x mais tokens e modelos leem grade densa de caracteres com muito
// mais erro do que leem uma figura. Tres imagens pequenas resolvem por ~450
// tokens.
//
// Browser-only (usa canvas).
import type { Grid } from './types';
import { renderVoxelView, VOXEL_DIRS, type VoxelModel } from './voxel';
import { partsLegend, partsPreviewModel, type Part } from './pose';

export type VisionImage = { label: string; base64: string };

/** Alvo do lado maior da imagem: legivel para o modelo, barato em tokens. */
const TARGET_PX = 320;

const gridToPngBase64 = (g: Grid, background = '#0b0e14'): string => {
  const scale = Math.max(1, Math.min(8, Math.round(TARGET_PX / Math.max(g.w, g.h))));
  const small = document.createElement('canvas');
  small.width = g.w;
  small.height = g.h;
  small.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);

  const out = document.createElement('canvas');
  out.width = g.w * scale;
  out.height = g.h * scale;
  const ctx = out.getContext('2d')!;
  // fundo solido: sprite claro sobre alpha vira quase invisivel para o modelo
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, out.width, out.height);
  return out.toDataURL('image/png').split(',')[1];
};

const dirIndex = (d: string): number => (VOXEL_DIRS as readonly string[]).indexOf(d);

/**
 * Imagens enviadas junto do pedido: a pose neutra de duas direcoes (para a IA
 * entender o bicho) e o MAPA DE PARTES colorido (para ela saber exatamente
 * quais voxels respondem por cada nome que ela vai citar).
 */
export const buildVisionImages = (model: VoxelModel, parts: Part[]): VisionImage[] => {
  const out: VisionImage[] = [];
  for (const d of ['dr', 'ur']) {
    const view = renderVoxelView(model, dirIndex(d));
    if (view.grid.w <= 1) continue;
    out.push({
      label: `Pose neutra vista de ${d} (${d === 'dr' ? 'frente em 3/4' : 'costas em 3/4'})`,
      base64: gridToPngBase64(view.grid),
    });
  }
  const preview = renderVoxelView(partsPreviewModel(parts), dirIndex('dr'));
  if (preview.grid.w > 1) {
    out.push({
      label: `Mapa de partes visto de dr — ${partsLegend(parts)}`,
      base64: gridToPngBase64(preview.grid),
    });
  }
  return out;
};

/** Uma imagem so, para a folha de partes na interface. */
export const partsPreviewDataUrl = (parts: Part[], dir = 'dr'): string => {
  const view = renderVoxelView(partsPreviewModel(parts), dirIndex(dir));
  if (view.grid.w <= 1) return '';
  return `data:image/png;base64,${gridToPngBase64(view.grid)}`;
};
