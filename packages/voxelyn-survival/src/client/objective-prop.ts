import { isFinalSector } from '@voxelyn/survival-sim';

export type ObjectivePropName = 'core' | 'coreTaken' | 'descent';
export type ObjectiveLightSpec = { radius: number; power: number };

/**
 * `corePos` e um nome historico: nos setores intermediarios ele aponta para o
 * poco que leva ao setor seguinte; apenas no setor final aponta para o Nucleo.
 * Centralizar a escolha impede o renderer de voltar a desenhar a recompensa no
 * lugar do transporte.
 */
export const objectivePropName = (sector: number, coreTaken: boolean): ObjectivePropName => {
  if (!isFinalSector(sector)) return 'descent';
  return coreTaken ? 'coreTaken' : 'core';
};

/** Luz funcional do marcador, separada da identidade visual do prop. */
export const objectiveLightSpec = (
  sector: number,
  coreTaken: boolean,
): ObjectiveLightSpec | null => {
  const prop = objectivePropName(sector, coreTaken);
  if (prop === 'coreTaken') return null;
  if (prop === 'descent') return { radius: 4.75, power: 0.62 };
  return { radius: 6, power: 0.9 };
};
