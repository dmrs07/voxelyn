import { RNG } from '@voxelyn/core';
import type {
  ActiveModule,
  ModuleId,
  ModuleTag,
  PendingModuleChoice,
  PlayerExtra,
  SemanticEvent,
} from './types.js';

export type ModuleDefinition = {
  id: ModuleId;
  lifetime: 'charges' | 'timer';
  defaultCharges?: number;
  durationTicks?: number;
  tier: 1 | 2 | 3;
  tags: readonly ModuleTag[];
};

/**
 * QUANTAS CARGAS UM MÓDULO VALE.
 *
 * O jogo dispara a `BOLT_COOLDOWN_TICKS = 5` num tick de 20 Hz: quatro tiros por
 * segundo. Com os números antigos — 12, 10, 6, 5 — um módulo acabava em menos de
 * dez segundos de combate sustentado. O jogador escolhia entre dois módulos no
 * terminal, via o ícone acender, e antes de terminar a sala ele já tinha sumido.
 * Isso não é economia de recurso: é um brinde que não dá tempo de virar decisão.
 *
 * A régua nova conta PROCS, e um proc vale mais quanto mais forte for o efeito:
 *
 * - tier 1 (perfura, drena, rebate): ~80 a 100. São multiplicadores pequenos do
 *   tiro comum, e o módulo tem de durar a sala inteira para o jogador sentir a
 *   diferença que escolheu;
 * - tier 2 (descarga): ~55. Cada proc eletrifica uma poça inteira e mata grupos;
 * - tier 3 (explosão, disco): 40 e 55. Explosão é a única coisa do arsenal que
 *   mata o próprio Prospector, e disco é uma ARMA inteira, não um modificador —
 *   ambos valem mais por uso e por isso duram menos usos.
 *
 * Nenhum deles cobra o gatilho: a carga sai quando o efeito acontece (ver
 * `procModule`). Então "80 travessias" é bem mais do que 80 tiros — é 80 tiros
 * que ACERTARAM algo que valia perfurar.
 *
 * Um número alto demais tem custo simétrico ao baixo: se o módulo nunca acaba,
 * o segundo terminal deixa de ser uma decisão e vira coleta. Estes valores foram
 * escolhidos para o módulo atravessar um setor e MORRER dentro do seguinte, de
 * modo que recarregar o que já se tem continue competindo com pegar outro.
 */
export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  piercing: {
    id: 'piercing',
    lifetime: 'charges',
    defaultCharges: 100,
    tier: 1,
    tags: ['projectile', 'safe'],
  },
  siphon: {
    id: 'siphon',
    lifetime: 'charges',
    defaultCharges: 80,
    tier: 1,
    tags: ['utility', 'safe'],
  },
  ricochet: {
    id: 'ricochet',
    lifetime: 'charges',
    defaultCharges: 80,
    tier: 1,
    tags: ['projectile', 'safe'],
  },
  conductive: {
    id: 'conductive',
    lifetime: 'charges',
    defaultCharges: 55,
    tier: 2,
    tags: ['projectile', 'utility', 'safe'],
  },
  explosive: {
    id: 'explosive',
    lifetime: 'charges',
    defaultCharges: 40,
    tier: 3,
    tags: ['projectile', 'volatile'],
  },
  return_disc: {
    id: 'return_disc',
    lifetime: 'charges',
    defaultCharges: 55,
    tier: 3,
    tags: ['projectile', 'defensive', 'safe'],
  },
};

export const moduleDefinition = (id: ModuleId): ModuleDefinition => MODULE_DEFINITIONS[id];

export const activeModule = (extra: PlayerExtra, id: ModuleId): ActiveModule | undefined =>
  extra.activeModules.find((module) => module.id === id);

export const moduleHasCapacity = (extra: PlayerExtra, id: ModuleId, tick: number): boolean => {
  const module = activeModule(extra, id);
  if (!module) return false;
  if (module.lifetime.kind === 'charges') return module.lifetime.remaining > 0;
  return tick < module.lifetime.expiresAtTick;
};

const createModule = (id: ModuleId, tick: number): ActiveModule => {
  const def = moduleDefinition(id);
  if (def.lifetime === 'timer') {
    const duration = def.durationTicks ?? 0;
    return {
      id,
      lifetime: { kind: 'timer', acquiredAtTick: tick, expiresAtTick: tick + duration },
    };
  }
  const maximum = def.defaultCharges ?? 1;
  return { id, lifetime: { kind: 'charges', remaining: maximum, maximum } };
};

/** Grants a module or refreshes the existing instance to its configured maximum. */
export const grantOrRechargeModule = (extra: PlayerExtra, id: ModuleId, tick: number): ActiveModule => {
  const existing = activeModule(extra, id);
  const fresh = createModule(id, tick);
  if (!existing) {
    extra.activeModules.push(fresh);
    extra.activeModules.sort((a, b) => a.id.localeCompare(b.id));
    return fresh;
  }
  existing.lifetime = fresh.lifetime;
  return existing;
};

/**
 * Consumes one charge only when the requested mechanic actually procs.
 * Returns false when the module is missing/expired, preventing free late procs
 * from multiple projectiles sharing the last charge.
 */
export const consumeModuleCharge = (
  extra: PlayerExtra,
  id: ModuleId,
  slot: number,
  events: SemanticEvent[]
): boolean => {
  const index = extra.activeModules.findIndex((module) => module.id === id);
  if (index < 0) return false;
  const module = extra.activeModules[index];
  if (module.lifetime.kind !== 'charges' || module.lifetime.remaining <= 0) return false;
  module.lifetime.remaining--;
  events.push({
    t: 'module_charge_consumed',
    slot,
    module: id,
    remaining: module.lifetime.remaining,
    maximum: module.lifetime.maximum,
  });
  if (module.lifetime.remaining === 0) {
    extra.activeModules.splice(index, 1);
    events.push({ t: 'module_expired', slot, module: id });
  }
  return true;
};

export const expireTimedModules = (
  extra: PlayerExtra,
  tick: number,
  slot: number,
  events: SemanticEvent[]
): void => {
  for (let i = extra.activeModules.length - 1; i >= 0; i--) {
    const module = extra.activeModules[i];
    if (module.lifetime.kind === 'timer' && tick >= module.lifetime.expiresAtTick) {
      extra.activeModules.splice(i, 1);
      events.push({ t: 'module_expired', slot, module: module.id });
    }
  }
};

const tierPool = (tier: 1 | 2 | 3): ModuleId[] => {
  const allowed = Math.min(3, tier);
  return (Object.keys(MODULE_DEFINITIONS) as ModuleId[])
    .filter((id) => MODULE_DEFINITIONS[id].tier <= allowed)
    .sort();
};

const isFull = (extra: PlayerExtra, id: ModuleId, tick: number): boolean => {
  const module = activeModule(extra, id);
  if (!module) return false;
  if (module.lifetime.kind === 'timer') {
    const def = moduleDefinition(id);
    return module.lifetime.expiresAtTick - tick >= (def.durationTicks ?? 0);
  }
  return module.lifetime.remaining >= module.lifetime.maximum;
};

/**
 * Finite deterministic selection: no reroll loops. The seeded offset rotates a
 * sorted pool, then the first valid safe option and first compatible companion
 * are selected. Full modules are deprioritized but remain a bounded fallback.
 */
export const rollModuleChoice = (
  seed: number,
  siteId: number,
  tier: 1 | 2 | 3,
  extra: PlayerExtra,
  tick: number
): PendingModuleChoice['options'] => {
  const rng = new RNG((seed ^ Math.imul(siteId + 1, 0x9e3779b9)) >>> 0 || 1);
  const base = tierPool(tier);
  const offset = rng.nextInt(base.length);
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];
  const preferred = rotated.filter((id) => !isFull(extra, id, tick));
  const candidates = preferred.length >= 2 ? preferred : rotated;

  const safe = candidates.find((id) => !MODULE_DEFINITIONS[id].tags.includes('volatile')) ?? candidates[0];
  const companion = candidates.find((id) => {
    if (id === safe) return false;
    if (MODULE_DEFINITIONS[safe].tags.includes('volatile')) {
      return !MODULE_DEFINITIONS[id].tags.includes('volatile');
    }
    return true;
  }) ?? rotated.find((id) => id !== safe) ?? safe;

  return [safe, companion];
};

/**
 * Os modulos que este projetil ainda consegue DISPARAR, e nao os que ele
 * carrega.
 *
 * O disparo grava a intencao no projetil (`proj.modules`) e quem paga e o proc,
 * la no impacto. Entre um e outro o dono pode ficar sem carga: `procModule`
 * recusa, mas o registro no projetil continua dizendo que sim. Quem desenha
 * lendo esse registro promete um dardo que ja nao perfura e uma bola que ja nao
 * rebate — e a forma do projetil e justamente o que diz ao jogador o que vai
 * acontecer no proximo instante.
 *
 * Deriva em vez de limpar a marca no projetil de proposito: recuperar o modulo
 * antes do impacto devolve o efeito, e apagar a marca tiraria isso do jogo por
 * causa de um problema de desenho.
 *
 * Devolve o MESMO objeto quando nada caducou, que e o caso normal: assim o
 * caminho quente nao aloca por quadro.
 */
export const liveProjectileModules = <T extends { piercing?: true; ricochet?: unknown; explosive?: unknown }>(
  modules: T | undefined,
  extra: PlayerExtra | undefined,
  tick: number
): T | undefined => {
  if (!modules) return undefined;
  // Sem o dono a vista (projetil hostil, ou parceiro cujas cargas so o servidor
  // conhece) nao ha o que conferir: quem produziu a marca ja e a fonte certa.
  if (!extra) return modules;
  const ids = ['piercing', 'ricochet', 'explosive'] as const;
  const stale = ids.filter((id) => modules[id] !== undefined && !moduleHasCapacity(extra, id, tick));
  if (stale.length === 0) return modules;
  const live = { ...modules };
  for (const id of stale) delete live[id];
  return live;
};
