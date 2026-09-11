import { RNG } from '@voxelyn/core';
import { MINIGUN_AMMO } from './constants.js';
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
  /**
   * MINIGUN: 300, e o numero nao segue a regua de procs acima porque ela nao
   * conta procs — ela conta BALAS. Cada carga e um projetil, cobrado na saida
   * e nao no acerto, porque aqui o gatilho E o efeito: nao existe uma
   * "minigun que nao procou". Trezentas balas a 16 por segundo sao 18,7
   * segundos de gatilho puro, que o calor estica para quatro rajadas com
   * travamento entre elas — a mesma ordem de grandeza de vida util dos
   * outros tier 3, distribuida de outro jeito.
   */
  minigun: {
    id: 'minigun',
    lifetime: 'charges',
    defaultCharges: MINIGUN_AMMO,
    tier: 3,
    tags: ['projectile', 'weapon', 'safe'],
  },
  /**
   * AS DUAS ARMAS DE TIER 2, e por que elas nao sao tier 3 como a Minigun.
   *
   * A Minigun e tier 3 porque e um UPLIFT: mais dano por segundo do que o
   * parafuso em toda situacao, limitada so por municao. Estas duas sao
   * SIDEGRADES — cada uma e pior que o parafuso comum em metade do jogo. A
   * Lanca nao tem janela de burst e erra tudo no corpo a corpo; o Bacamarte
   * nao existe a oito tiles. Trocar de arma aqui e escolher um problema, e
   * escolher problema e o que tier 2 sempre fez.
   *
   * AS CARGAS CONTAM TIROS e nao procs, como na Minigun e pelo mesmo motivo:
   * aqui o gatilho E o efeito, nao existe "Lanca que nao procou". Mas a regua
   * das balas nao serve — 300 balas da Minigun sao 18,7 s de gatilho porque ela
   * cospe 16 por segundo. Convertido para TEMPO DE GATILHO, que e a unidade em
   * que os tres se comparam: 70 tiros de Lanca a 1,11/s sao 63 s, e 60 do
   * Bacamarte a 0,91/s sao 66 s. A mesma ordem de grandeza dos tier 3 do resto
   * da lista, e a mesma promessa: atravessa um setor e morre dentro do
   * seguinte.
   */
  prospect_lance: {
    id: 'prospect_lance',
    lifetime: 'charges',
    defaultCharges: 70,
    tier: 2,
    tags: ['projectile', 'weapon', 'safe'],
  },
  blunderbuss: {
    id: 'blunderbuss',
    lifetime: 'charges',
    defaultCharges: 60,
    tier: 2,
    tags: ['projectile', 'weapon', 'safe'],
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

/**
 * MATRIZ DE COMPATIBILIDADE ENTRE MODULOS.
 *
 * O jogo permite varios modulos ativos ao mesmo tempo, e ate agora isso nunca
 * foi um problema: perfura, ricochete, condutivo, sifao e explosivo sao
 * MODIFICADORES do mesmo tiro, e o disco de retorno so troca o veiculo que os
 * carrega. Todos cobram no proc, e o proc acontece no maximo quatro vezes por
 * segundo.
 *
 * A Minigun quebra as duas premissas. Ela nao modifica o tiro — ela ocupa o
 * gatilho — e ela dispara dezesseis vezes por segundo. Um so exemplo basta
 * para fechar a questao: `explosive` com Minigun seriam DEZESSEIS explosoes
 * de raio 2,4 por segundo, cada uma podendo matar o proprio Prospector. Nao e
 * uma combinacao forte, e uma combinacao que nao tem orcamento — nem de
 * balanceamento, nem de particula, nem de projetil vivo.
 *
 * A REGRA E SOBRE VOLUME, E NAO SOBRE A ETIQUETA `weapon`. Isso ficou visivel
 * quando a Lanca e o Bacamarte entraram: os tres tem a etiqueta, e so dois
 * precisam da recusa.
 *
 *   - a LANCA dispara 1,11 vez por segundo — MENOS que o parafuso comum, que
 *     ja aceita tudo a 4/s. Um modulo nela e estritamente mais seguro do que
 *     no tiro que o jogo entrega de graca, entao ela ACEITA os modificadores;
 *   - o BACAMARTE dispara 0,91 vez por segundo, mas cada disparo sao CINCO
 *     graos. `explosive` viraria cinco explosoes por tiro no colo do proprio
 *     Prospector, que e a versao curta do problema da Minigun. Ele RECUSA;
 *   - a MINIGUN recusa por 16 tiros por segundo, como sempre.
 *
 * Escrever a regra como "arma nao aceita modulo" teria sido mais curto e teria
 * mentido: o que nao cabe e multiplicar o proc, nao trocar o gatilho.
 *
 * A regra, entao, e conservadora e explicita:
 *
 *   | equipado com Minigun ativa | efeito na bala da Minigun          |
 *   |----------------------------|------------------------------------|
 *   | piercing                   | NAO se aplica                      |
 *   | conductive                 | NAO se aplica                      |
 *   | explosive                  | NAO se aplica                      |
 *   | siphon                     | NAO se aplica                      |
 *   | ricochet                   | NAO se aplica                      |
 *   | return_disc                | NAO dispara enquanto ha Minigun    |
 *
 * Os modulos continuam INSTALADOS, com as cargas intactas, e voltam a valer
 * sozinhos no instante em que a bala 300 sair. Guardar as cargas em vez de
 * consumi-las e a metade que importa: quem pega Minigun com Ricochete
 * carregado nao perde o Ricochete, so o poe na prateleira por vinte segundos.
 *
 * Quem faz valer e o `weapon` no `tags`, lido por `activeWeaponModule` — e nao
 * uma comparacao com o literal `'minigun'` espalhada pelo `run.ts`.
 */
export const isWeaponModule = (id: ModuleId): boolean =>
  MODULE_DEFINITIONS[id].tags.includes('weapon');

/**
 * O modulo-arma que esta com o gatilho AGORA, ou `undefined` para o tiro comum.
 *
 * O CRITERIO E O TIER, do maior para o menor, e ele deixou de ser academico no
 * dia em que a Lanca e o Bacamarte entraram. Antes esta funcao devolvia o
 * primeiro em ordem de id — "arbitrario, mas TOTAL", o que era verdade
 * enquanto existia uma arma so. Com tres, a ordem alfabetica passaria o gatilho
 * ao `blunderbuss` por cima de uma `minigun` carregada, e alguem perderia
 * duzentas balas sem entender por que.
 *
 * Tier resolve isso do jeito que o encontro ja prometia: a Minigun (tier 3)
 * SEGURA o gatilho ate a bala 300 sair, que e exatamente o que o disco de
 * retorno ja fazia ("NAO dispara enquanto ha Minigun"). Quem pega uma arma de
 * tier 2 com a Minigun viva nao perde nada — as cargas ficam intactas e ela
 * assume sozinha quando a rajada acabar.
 *
 * O QUE ISTO NAO RESOLVE, e fica dito: entre as DUAS armas de tier 2 o
 * desempate volta a ser o id (`blunderbuss` antes de `prospect_lance`), entao
 * quem carrega as duas atira sempre com o Bacamarte. E total e deterministico,
 * mas nao e intencao do jogador — o criterio certo seria "a ultima que voce
 * pegou", e ele pede um `acquiredAtTick` na vida util por cargas, que hoje nao
 * existe e viaja no wire. Fica para quando alguem reclamar de verdade.
 */
export const activeWeaponModule = (extra: PlayerExtra, tick: number): ModuleId | undefined => {
  const armed = extra.activeModules.filter(
    (module) => isWeaponModule(module.id) && moduleHasCapacity(extra, module.id, tick),
  );
  if (armed.length === 0) return undefined;
  // `activeModules` ja vem ordenado por id, entao um sort ESTAVEL por tier
  // preserva o desempate alfabetico sem precisar repeti-lo aqui.
  return [...armed].sort((a, b) => moduleDefinition(b.id).tier - moduleDefinition(a.id).tier)[0].id;
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
export const grantOrRechargeModule = (
  extra: PlayerExtra,
  id: ModuleId,
  tick: number,
): ActiveModule => {
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
  events: SemanticEvent[],
  /**
   * Nao publicar o `module_charge_consumed` desta carga.
   *
   * Existe por causa da cadencia da Minigun e de mais nada. Um proc de
   * perfura ou de descarga acontece algumas vezes por segundo e o recibo
   * sonoro/visual dele e informacao: "a carga saiu". A Minigun cobra dezesseis
   * cargas por segundo, e o mesmo recibo viraria dezesseis eventos de rede,
   * dezesseis pulsos no icone da HUD e — pela trava de 40 ms da voz
   * `moduleCharge` — vinte e cinco cliques por segundo empilhados sobre a
   * propria rajada. O contador de municao ja viaja no `ViewerState` a cada
   * snapshot, entao nada se perde: o que a HUD desenha e o RESTANTE, nao a
   * sequencia de decrementos.
   *
   * O `module_expired` NUNCA e silenciado: o fim do modulo e o unico evento
   * desta funcao que decide alguma coisa (a ejecao visual, o retorno do tiro
   * comum), e ele continua saindo exatamente uma vez.
   */
  quiet = false,
): boolean => {
  const index = extra.activeModules.findIndex((module) => module.id === id);
  if (index < 0) return false;
  const module = extra.activeModules[index];
  if (module.lifetime.kind !== 'charges' || module.lifetime.remaining <= 0) return false;
  module.lifetime.remaining--;
  if (!quiet) {
    events.push({
      t: 'module_charge_consumed',
      slot,
      module: id,
      remaining: module.lifetime.remaining,
      maximum: module.lifetime.maximum,
    });
  }
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
  events: SemanticEvent[],
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
  tick: number,
): PendingModuleChoice['options'] => {
  const rng = new RNG((seed ^ Math.imul(siteId + 1, 0x9e3779b9)) >>> 0 || 1);
  const base = tierPool(tier);
  const offset = rng.nextInt(base.length);
  const rotated = [...base.slice(offset), ...base.slice(0, offset)];
  const preferred = rotated.filter((id) => !isFull(extra, id, tick));
  const candidates = preferred.length >= 2 ? preferred : rotated;

  const safe =
    candidates.find((id) => !MODULE_DEFINITIONS[id].tags.includes('volatile')) ?? candidates[0];
  const companion =
    candidates.find((id) => {
      if (id === safe) return false;
      if (MODULE_DEFINITIONS[safe].tags.includes('volatile')) {
        return !MODULE_DEFINITIONS[id].tags.includes('volatile');
      }
      return true;
    }) ??
    rotated.find((id) => id !== safe) ??
    safe;

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
export const liveProjectileModules = <
  T extends { piercing?: true; ricochet?: unknown; explosive?: unknown; siphon?: true },
>(
  modules: T | undefined,
  extra: PlayerExtra | undefined,
  tick: number,
): T | undefined => {
  if (!modules) return undefined;
  // Sem o dono a vista (projetil hostil, ou parceiro cujas cargas so o servidor
  // conhece) nao ha o que conferir: quem produziu a marca ja e a fonte certa.
  if (!extra) return modules;
  // `siphon` entrou na lista quando o tiro dele ganhou corpo proprio (a
  // serpente verde): a marca caduca cobra a mesma honestidade das outras —
  // sem carga, o dreno nao proca, e a serpente estaria prometendo cura.
  const ids = ['piercing', 'ricochet', 'explosive', 'siphon'] as const;
  const stale = ids.filter(
    (id) => modules[id] !== undefined && !moduleHasCapacity(extra, id, tick),
  );
  if (stale.length === 0) return modules;
  const live = { ...modules };
  for (const id of stale) delete live[id];
  return live;
};
