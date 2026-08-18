// Apresentacao pura do sistema de salvamento: que prop cada cofre usa, como um
// tier vira texto, e os numeros decorativos do terminal de recuperacao.
//
// Nada aqui toca Canvas nem estado — sao as tabelas que o render consulta, e por
// serem puras os testes cobram cada combinacao sem montar um jogo inteiro.

import { MODULE_DEFINITIONS, type ModuleId, type SalvageSite } from '@voxelyn/survival-sim';

export type CacheTier = 1 | 2 | 3;

/**
 * O prop de mundo de cada classe de cofre.
 *
 * Tier I mantem os nomes historicos `salvageCache`/`salvageCacheOpened`: eles
 * ja existem no atlas e nos testes de conteudo, e renomea-los quebraria o
 * contrato por nada. As classes novas entram como kinds proprios, ANEXADOS ao
 * fim da lista do atlas — inserir no meio moveria os indices de todos os
 * decorativos e portais que vieram depois.
 */
export const cachePropFor = (tier: CacheTier, opened: boolean): string => {
  if (tier === 3) return opened ? 'salvageCacheT3Opened' : 'salvageCacheT3';
  if (tier === 2) return opened ? 'salvageCacheT2Opened' : 'salvageCacheT2';
  return opened ? 'salvageCacheOpened' : 'salvageCache';
};

/**
 * Cadeia de fallback para o desenho: primeiro o prop da classe, depois o da
 * classe I — que existe em QUALQUER versao do atlas — para um PNG antigo em
 * cache nao apagar o cofre do mundo. Mesma logica do objectiveAtlasChain.
 */
export const cachePropChain = (tier: CacheTier, opened: boolean): string[] => {
  const primary = cachePropFor(tier, opened);
  const legacy = cachePropFor(1, opened);
  return primary === legacy ? [primary] : [primary, legacy];
};

/** Algarismo romano do tier — a lingua nao muda numeral de classe. */
export const romanTier = (tier: CacheTier): string => (tier === 3 ? 'III' : tier === 2 ? 'II' : 'I');

/** O tier REAL do modulo, direto do catalogo da simulacao — nunca derivado da
 *  cor nem do cofre de origem: um cofre classe III entrega modulos de tier
 *  menor com frequencia. */
export const moduleTierOf = (id: ModuleId): CacheTier => MODULE_DEFINITIONS[id].tier;

/**
 * O tier do cofre que originou a escolha pendente, lido do estado autoritativo
 * que o cliente JA tem — `pending.sourceSiteId` aponta para `salvageSites`.
 * Nenhum campo novo de protocolo para uma informacao que ja viaja.
 */
export const choiceSourceTier = (
  sites: readonly SalvageSite[],
  sourceSiteId: number,
): CacheTier | null => sites.find((site) => site.id === sourceSiteId)?.tier ?? null;

/**
 * "Integridade de dados" decorativa do terminal: deterministica por site para
 * nao tremer entre quadros nem divergir entre maquinas, e sempre alta o
 * bastante para nunca parecer um aviso mecanico.
 */
export const dataIntegrityPercent = (sourceSiteId: number): number =>
  86 + (Math.imul(sourceSiteId + 1, 2654435761) >>> 8) % 12;
