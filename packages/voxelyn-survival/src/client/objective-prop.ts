import { isFinalSector, type OccupationId, type StratumId } from '@voxelyn/survival-sim';

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

/**
 * A chave do FLAVOR do portal: a ocupacao manda — uma operacao Aurix cava
 * elevadores em qualquer rocha, a Matriz abre iris em qualquer estrato — e,
 * sem ocupacao, o proprio estrato. E a mesma regra que ja governa o kit de
 * decoracao, entao portal e sala contam a mesma historia.
 */
export const portalKeyFor = (stratum: StratumId, occupation: OccupationId): string =>
  occupation !== 'none' ? occupation : stratum;

/**
 * Cadeia de nomes no atlas para o marcador em `corePos`, do mais especifico
 * ao fallback. O portal do bioma primeiro; o `descent` generico segura a
 * ponta se o atlas em cache for de uma versao sem portais. Com o Nucleo na
 * mao o poco SELA — desenhar o portal vivo convidaria para uma interacao que
 * a sim recusa, e um marcador nao pode mentir.
 */
export const objectiveAtlasChain = (
  sector: number,
  coreTaken: boolean,
  stratum: StratumId,
  occupation: OccupationId,
): string[] => {
  if (isFinalSector(sector)) return [coreTaken ? 'coreTaken' : 'core'];
  if (coreTaken) return ['portal:sealed', 'descent'];
  return [`portal:${portalKeyFor(stratum, occupation)}`, 'descent'];
};

/**
 * A ENTRADA do setor: plataforma de extracao — exceto na subida com o Nucleo,
 * quando ela e funcionalmente o portal para o setor de cima e tem de parecer
 * um. No setor 1 ela continua plataforma: e ali que o contrato fecha.
 */
export const entryAtlasChain = (
  sector: number,
  coreTaken: boolean,
  stratum: StratumId,
  occupation: OccupationId,
): string[] => {
  if (coreTaken && sector > 1) return [`portal:${portalKeyFor(stratum, occupation)}`, 'extraction'];
  return ['extraction'];
};

/** Luz funcional do marcador, separada da identidade visual do prop. */
export const objectiveLightSpec = (
  sector: number,
  coreTaken: boolean,
): ObjectiveLightSpec | null => {
  const prop = objectivePropName(sector, coreTaken);
  if (prop === 'coreTaken') return null;
  // O poco SELADO nao convida: com o Nucleo na mao a luz dele apaga — o
  // caminho iluminado na subida e a entrada, nao a descida que nao existe.
  if (prop === 'descent') return coreTaken ? null : { radius: 4.75, power: 0.62 };
  return { radius: 6, power: 0.9 };
};
