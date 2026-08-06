// Constroi o SurvivalState de uma arena de chefe isolada, a partir das
// condicoes escolhidas na tela de setup (HP, eco/habilidade, modulos).
//
// Nao existe um segundo motor aqui: `createRun` com `sector`/`depth` ja
// reconstroi o setor inteiro do zero — trash, terreno, sitios de salvage e o
// chefe junto —, exatamente como um cliente que reconecta no meio de uma
// expedicao faz. O unico trabalho desta ferramenta e apontar para o
// (seed, setor) certo (ver `arena-catalog.ts`) e aplicar por cima as tres
// condicoes que o testador escolheu, ANTES do primeiro tick — a mesma
// liberdade que `resimulateRun` do servidor usa para re-simular contra um
// tuning e uma profundidade dados.
import {
  DEFAULT_PLAYER_TUNING,
  createRun,
  grantOrRechargeModule,
  type AbilityId,
  type ModuleId,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { ARENA_CATALOG, type ArenaBossId } from './arena-catalog';

export type ArenaConditions = {
  boss: ArenaBossId;
  maxHp: number;
  ability: AbilityId;
  modules: readonly ModuleId[];
};

/** Faixa de HP que a tela de setup oferece. Fora disso nao ha teste util: */
export const ARENA_MIN_HP = 20;
export const ARENA_MAX_HP = 500;

export const clampArenaHp = (hp: number): number =>
  Math.round(
    Math.max(
      ARENA_MIN_HP,
      Math.min(ARENA_MAX_HP, Number.isFinite(hp) ? hp : DEFAULT_PLAYER_TUNING.maxHp),
    ),
  );

export const createArenaRun = (conditions: ArenaConditions): SurvivalState => {
  const entry = ARENA_CATALOG[conditions.boss];
  const tuning = { ...DEFAULT_PLAYER_TUNING, maxHp: clampArenaHp(conditions.maxHp) };
  const state = createRun({
    seed: entry.seed,
    sector: entry.sector,
    tuning,
    depth: {
      generation: entry.generation,
      sectorCount: entry.sectorCount,
      coreSectors: entry.coreSectors,
    },
  });

  // Aplicado DEPOIS de `createRun` e ANTES do primeiro `stepRun`: o mesmo
  // ponto em que um teste de chefe (`arena-chefe.test.ts`) monta a condicao
  // que quer examinar, e nao um estado que a simulacao jamais produziria
  // sozinha por progressao normal — esta ferramenta existe justamente para
  // pular a progressao.
  state.player.hp = tuning.maxHp;
  state.playerExtra.ability = conditions.ability;
  for (const moduleId of conditions.modules) {
    grantOrRechargeModule(state.playerExtra, moduleId, state.tick);
  }

  return state;
};
