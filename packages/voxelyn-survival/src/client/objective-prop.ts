import type { OccupationId, StratumId } from '@voxelyn/survival-sim';

export type ObjectivePropName = 'core' | 'coreTaken' | 'descent';
export type ObjectiveLightSpec = { radius: number; power: number };

/**
 * O que o ponto especial do setor E, agora que ele pode ser tres coisas.
 *
 * Um descritor em vez do par `(sector, coreTaken)` de antes, e a razao e que o
 * par deixou de bastar: com profundidade variavel, "e o ultimo setor?" depende
 * do total da RUN; com dois Nucleos, "o Nucleo foi pego?" depende de QUAL; e
 * com chefe por setor o poco pode estar selado com tudo o mais igual.
 *
 * Continua sem tocar em estado: quem monta o descritor e o renderer, a partir
 * do espelho local ou das flags que o servidor resolveu. Este modulo so decide
 * o que desenhar.
 */
export type ObjectiveView = {
  sector: number;
  /** Total ACESSIVEL nesta run, nunca o maximo potencial da linhagem. */
  sectorCount: number;
  /** Ha pedestal de Nucleo neste setor? */
  hasCore: boolean;
  /** O Nucleo DESTE setor ja saiu do pedestal? */
  coreTakenHere: boolean;
  /** O selo do setor ainda esta de pe (chefe vivo)? */
  sealedByBoss: boolean;
  /** A run ja entrou no caminho de volta: o poco nao desce mais. */
  returning: boolean;
};

/**
 * `corePos` e um nome historico: conforme a configuracao da run ele aponta para
 * o poco de descida, para o pedestal do Nucleo, ou — num setor de Nucleo
 * intermediario — para os dois em sequencia. Centralizar a escolha impede o
 * renderer de voltar a desenhar a recompensa no lugar do transporte.
 */
export const objectivePropName = (view: ObjectiveView): ObjectivePropName => {
  // Pedestal ocupado: o Nucleo e o que se ve, selado ou nao. Selado NAO e
  // escondido — o jogador tem de ver o que o chefe esta guardando.
  if (view.hasCore && !view.coreTakenHere) return 'core';
  // Pedestal vazio no fundo da run: o resto da descida e a volta.
  if (view.hasCore && view.sector >= view.sectorCount) return 'coreTaken';
  // Pedestal vazio com Veio abaixo: o mesmo ponto vira o poco.
  return 'descent';
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
 * ponta se o atlas em cache for de uma versao sem portais.
 *
 * O poco aparece SELADO em duas situacoes, e as duas sao a mesma promessa: a
 * de que um marcador nao mente. Com o Nucleo do fundo na mao, descer deixou de
 * existir; com o chefe do setor de pe, descer ainda nao existe. Desenhar o
 * portal vivo em qualquer das duas convidaria para uma interacao que a
 * simulacao recusa.
 */
export const objectiveAtlasChain = (
  view: ObjectiveView,
  stratum: StratumId,
  occupation: OccupationId,
): string[] => {
  const prop = objectivePropName(view);
  if (prop === 'core') return ['core'];
  if (prop === 'coreTaken') return ['coreTaken'];
  if (view.sealedByBoss || view.returning) return ['portal:sealed', 'descent'];
  return [`portal:${portalKeyFor(stratum, occupation)}`, 'descent'];
};

/**
 * A ENTRADA do setor: plataforma de extracao — exceto na subida com o Nucleo,
 * quando ela e funcionalmente o portal para o setor de cima e tem de parecer
 * um. No setor 1 ela continua plataforma: e ali que o contrato fecha.
 */
export const entryAtlasChain = (
  view: ObjectiveView,
  stratum: StratumId,
  occupation: OccupationId,
): string[] => {
  if (view.returning && view.sector > 1) {
    return [`portal:${portalKeyFor(stratum, occupation)}`, 'extraction'];
  }
  return ['extraction'];
};

/** Luz funcional do marcador, separada da identidade visual do prop. */
export const objectiveLightSpec = (view: ObjectiveView): ObjectiveLightSpec | null => {
  const prop = objectivePropName(view);
  if (prop === 'coreTaken') return null;
  if (prop === 'core') return { radius: 6, power: 0.9 };
  // O poco selado nao convida: a luz dele apaga. O caminho iluminado passa a
  // ser o que ainda esta aberto — a entrada, na subida; o chefe, antes dela.
  return view.sealedByBoss || view.returning ? null : { radius: 4.75, power: 0.62 };
};

/** O descritor a partir do espelho renderavel da run. */
export const objectiveViewOf = (state: {
  sector: number;
  coresTakenMask: number;
  sectorBoss: { archetype: string | null; defeated: boolean };
  config: { depth: { sectorCount: number; coreSectors: readonly number[] } };
}): ObjectiveView => {
  const { sectorCount, coreSectors } = state.config.depth;
  const deepestCore = coreSectors.length > 0 ? Math.max(...coreSectors) : sectorCount;
  return {
    sector: state.sector,
    sectorCount,
    hasCore: coreSectors.includes(state.sector),
    coreTakenHere: (state.coresTakenMask & (1 << state.sector)) !== 0,
    sealedByBoss: state.sectorBoss.archetype !== null && !state.sectorBoss.defeated,
    returning: (state.coresTakenMask & (1 << deepestCore)) !== 0,
  };
};
