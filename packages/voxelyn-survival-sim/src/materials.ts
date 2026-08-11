// Como cada CLASSE de projetil reage com cada MATERIAL.
//
// Por que existe: a taxonomia de materiais ja estava no mundo — rocha, frágil,
// minerio, cristal, fungo, biofluido, gas, fogo, cinza — mas nao chegava na
// mecanica. `ORE` e `ROCK` eram identicos na pratica (o tiro morria, nada
// acontecia), e nenhum projetil se comportava diferente de outro diante de um
// material: qualquer tiro quebrava frágil e cristal do mesmo jeito. Havia arte
// e geracao para quatro solidos e regra para dois.
//
// A classe do projetil NAO e uma escolha de arma: sai dos modificadores que a
// run entregou. Isso mantem o roguelike (voce nao escolhe, voce recebe e
// aprende a explorar o mapa com o que caiu) sem abrir menu nem inventario.

import {
  BUDGET_RESONANCE_CELLS,
  BUDGET_VEIN_CELLS,
  FERRIC_VEIN_SCALE,
  LEYLINE_CHARGE_TICKS,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_ORE_SPENT,
  SOLID_ROCK,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_ICE,
  SURF_SCORCHED,
  SURF_SPORES,
} from './constants.js';
import { markDiscovery } from './stats.js';
import { DISCOVERY_ORE_CHAIN } from './types.js';
import {
  breakSolid,
  chargeCells,
  explodeAt,
  floodFrom,
  heatFungalCell,
  igniteCell,
  markDirty,
  setSurface,
} from './cells.js';
import type { EffectOrigin, Projectile, SemanticEvent, SurvivalState } from './types.js';

export type ProjectileClass = 'kinetic' | 'energy' | 'thermal' | 'bio';

/** O projetil ja andou o bastante para o Explosive armar? */
export const explosiveArmedByDistance = (p: Projectile): boolean =>
  Boolean(p.modules?.explosive && p.distanceTravelled >= p.modules.explosive.armAfterDistance);

/**
 * Classe efetiva de um projetil.
 *
 * A ordem de precedencia importa: um projetil pode carregar mais de um
 * modificador, e sem uma ordem fixa o mesmo tiro reagiria diferente conforme a
 * ordem em que as flags fossem lidas — o que quebraria o determinismo.
 * Termico vence energia, energia vence cinetico.
 *
 * As duas flags de habilitacao existem porque a flag no projetil diz o que ele
 * FOI ARMADO para fazer, e nao o que ele ainda PODE fazer: o dono pode ter
 * ficado sem carga enquanto o tiro voava. Sem elas, um bolt sem carga continuava
 * valendo como termico e acendia uma nuvem de enxofre — uma explosao inteira,
 * de graca e sem debitar nada, porque a ignicao de gas nao passa pelo ponto que
 * cobra o modulo. Quem chama e obrigado a resolver a capacidade e passar aqui.
 */
export const projectileClass = (
  p: Projectile,
  conductiveEnabled = true,
  explosiveEnabled = true
): ProjectileClass => {
  if (p.leavesBiofluid) return 'bio';
  if (explosiveEnabled && explosiveArmedByDistance(p)) return 'thermal';
  if (p.modules?.conductive && conductiveEnabled) return 'energy';
  return 'kinetic';
};

const W = (state: SurvivalState): number => state.config.width;

/** Celulas abertas coladas num conjunto de solidos: por onde a carga escapa. */
export const openNeighbours = (state: SurvivalState, cells: number[]): number[] => {
  const w = W(state);
  const h = state.config.height;
  const out = new Set<number>();
  for (const i of cells) {
    const cx = i % w;
    const neighbours = [i - 1, i + 1, i - w, i + w];
    const valid = [cx > 0, cx < w - 1, i >= w, i < w * (h - 1)];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      if (state.solid[neighbours[k]] === SOLID_NONE) out.add(neighbours[k]);
    }
  }
  return [...out];
};

export type SolidImpact = {
  /** O projetil para aqui. */
  stop: boolean;
  /** A celula deixou de ser solida. */
  broke: boolean;
};

/**
 * Reacao de um solido ao ser atingido. Devolve o que o projetil deve fazer.
 *
 * Todo estado intermediario (frágil enfraquecido, cristal opaco, veio esgotado)
 * vive no GRID, nao num evento: assim ele chega ao cliente pelo diff de chunk
 * como qualquer outra mudanca de mundo, sobrevive a reconexao e ao full_resync,
 * e o jogador ve o material a caminho de ceder antes de ele ceder. Um estado so
 * anunciado por evento seria perdido por quem reconecta.
 */
export const impactSolid = (
  state: SurvivalState,
  cx: number,
  cy: number,
  cls: ProjectileClass,
  events: SemanticEvent[],
  origin: EffectOrigin = { source: 'environment' }
): SolidImpact => {
  const w = W(state);
  const i = cy * w + cx;
  const solid = state.solid[i];
  const at = { x: cx + 0.5, y: cy + 0.5 };

  switch (solid) {
    // -----------------------------------------------------------------------
    case SOLID_ROCK: {
      if (cls === 'energy') {
        // A rocha nao cede, mas conduz para fora: a carga sai pelas celulas
        // abertas coladas nela. Atirar numa parede vira uma armadilha curta.
        chargeCells(state, openNeighbours(state, [i]), events, origin);
      } else if (cls === 'bio') {
        // O acido escorre pela parede e se acumula no pe dela.
        for (const open of openNeighbours(state, [i])) {
          if (state.surface[open] === SURF_NONE) setSurface(state, open, SURF_BIOFLUID, 0);
        }
      }
      return { stop: true, broke: false };
    }

    // -----------------------------------------------------------------------
    case SOLID_FRAGILE: {
      if (cls === 'bio') {
        // Corroi em DOIS estagios. O primeiro nao derruba nada: da ao jogador
        // um quadro para ver a cobertura indo embora e decidir sair.
        state.solid[i] = SOLID_FRAGILE_WEAK;
        markDirty(state, cx, cy);
        events.push({ t: 'corrode', ...at, solid: SOLID_FRAGILE });
        return { stop: true, broke: false };
      }
      if (cls === 'thermal') {
        // Estilhaca em area: o calor propaga pela rocha rachada e leva os
        // vizinhos frageis junto.
        const broke = breakSolid(state, cx, cy, events);
        for (const n of [i - 1, i + 1, i - w, i + w]) {
          if (n < 0 || n >= state.solid.length) continue;
          if (state.solid[n] === SOLID_FRAGILE || state.solid[n] === SOLID_FRAGILE_WEAK) {
            breakSolid(state, n % w, Math.floor(n / w), events);
          }
        }
        return { stop: true, broke };
      }
      {
        const broke = breakSolid(state, cx, cy, events);
        // FRATURA POR CAMADA (so na Silica sedimentar): a rocha fragil e uma
        // LAMINA continua — quebrar uma celula racha as vizinhas frageis da
        // MESMA faixa horizontal, que caem para o estagio enfraquecido. Nao
        // derruba (o thermal ja faz isso em area): AVISA. O jogador aprende
        // que na sedimentar a parede fina cede em fileira, e passa a abrir
        // atalhos pela camada em vez de celula a celula.
        if (broke && state.stratum === 'silica') {
          for (const n of [i - 1, i + 1]) {
            if (n < 0 || n >= state.solid.length) continue;
            if (Math.floor(n / w) !== cy) continue;
            if (state.solid[n] === SOLID_FRAGILE) {
              state.solid[n] = SOLID_FRAGILE_WEAK;
              markDirty(state, n % w, cy);
              events.push({ t: 'corrode', x: (n % w) + 0.5, y: cy + 0.5, solid: SOLID_FRAGILE });
            }
          }
        }
        return { stop: true, broke };
      }
    }

    case SOLID_FRAGILE_WEAK: {
      // Ja enfraquecido: qualquer coisa derruba.
      return { stop: true, broke: breakSolid(state, cx, cy, events) };
    }

    // -----------------------------------------------------------------------
    // Veio inteiro e veio lascado reagem igual a tudo menos ao cinetico, que e
    // o que consome a materia. Tratar os dois no mesmo caso evita a recursao em
    // que o lascado delegava para si mesmo.
    case SOLID_ORE:
    case SOLID_ORE_CHIPPED: {
      if (cls === 'energy') {
        // O veio e fiacao: a carga percorre o minerio conectado e sai nas
        // aberturas do outro lado. E a razao de o minerio existir. No
        // FERRIFERO a parede inteira e a fiacao: o orcamento triplica e a
        // descarga viaja de sala em sala pelo seam.
        const vein = floodFrom(
          state,
          cx,
          cy,
          state.stratum === 'ferric' ? BUDGET_VEIN_CELLS * FERRIC_VEIN_SCALE : BUDGET_VEIN_CELLS,
          (n) => state.solid[n] === SOLID_ORE || state.solid[n] === SOLID_ORE_CHIPPED
        );
        chargeCells(state, openNeighbours(state, vein), events, origin);
        // So conta como descoberta quando o veio REALMENTE conduziu a algum
        // lugar. Uma pedrinha de minerio isolada nao ensina que minerio e fiacao.
        if (vein.length > 1) markDiscovery(state.stats, DISCOVERY_ORE_CHAIN);
        return { stop: true, broke: false };
      }
      if (cls === 'thermal') {
        // Funde: o veio some e deixa chao queimado no lugar.
        state.solid[i] = SOLID_NONE;
        setSurface(state, i, SURF_SCORCHED, 0);
        markDirty(state, cx, cy);
        events.push({ t: 'break', ...at, solid: SOLID_ORE });
        return { stop: true, broke: true };
      }
      if (cls === 'bio') {
        // Contamina: continua sendo parede, mas nao conduz mais nada.
        state.solid[i] = SOLID_ORE_SPENT;
        markDirty(state, cx, cy);
        events.push({ t: 'corrode', ...at, solid: SOLID_ORE });
        return { stop: true, broke: false };
      }
      // Cinetico arranca lascas ate esgotar. O progresso mora no GRID, como
      // todo o resto: contar lascas num Map a parte do estado nao sobreviveria
      // a um full_resync e ainda entraria no hash autoritativo. Rende recurso,
      // mas e finito — sem limite uma parede de minerio seria fonte infinita.
      state.solid[i] = solid === SOLID_ORE ? SOLID_ORE_CHIPPED : SOLID_ORE_SPENT;
      markDirty(state, cx, cy);
      // A lasca entra na COTA. O minerio ja saia do grid ha muito tempo e nao
      // ia para lugar nenhum: o prospector e um robo de mineracao que nao
      // minerava. Contar aqui, no unico ponto onde a materia realmente e
      // consumida, garante que a cota nao possa ser inflada por outro caminho.
      state.stats.oreCollected += 1;
      events.push({ t: 'chip', ...at });
      events.push({ t: 'ore_gained', ...at, amount: 1, total: state.stats.oreCollected });
      return { stop: true, broke: false };
    }

    case SOLID_ORE_SPENT:
      return { stop: true, broke: false };

    // -----------------------------------------------------------------------
    case SOLID_CRYSTAL: {
      if (cls === 'thermal') {
        // Racha sem quebrar: vira frágil. Duas etapas em vez de "aperta e some".
        state.solid[i] = SOLID_FRAGILE;
        markDirty(state, cx, cy);
        events.push({ t: 'corrode', ...at, solid: SOLID_CRYSTAL });
        return { stop: true, broke: false };
      }
      if (cls === 'bio') {
        // Opaca: para de emitir luz e de descarregar. O mapa escurece onde o
        // spitter passou, o que e uma perda real para quem depende da luz.
        state.solid[i] = SOLID_CRYSTAL_DULL;
        markDirty(state, cx, cy);
        events.push({ t: 'corrode', ...at, solid: SOLID_CRYSTAL });
        return { stop: true, broke: false };
      }
      if (cls === 'energy') {
        // Ressoa: a cadeia leva os cristais vizinhos junto.
        const chain = floodFrom(state, cx, cy, BUDGET_RESONANCE_CELLS, (n) => state.solid[n] === SOLID_CRYSTAL);
        for (const n of chain) breakSolid(state, n % w, Math.floor(n / w), events);
        return { stop: true, broke: true };
      }
      return { stop: true, broke: breakSolid(state, cx, cy, events) };
    }

    // -----------------------------------------------------------------------
    case SOLID_LEYLINE: {
      if (cls === 'energy') {
        // A leyline NAO descarrega no impacto: ela ARMA. O tiro energiza o
        // segmento — o trecho ate a proxima juncao, fechado pelo worldgen —
        // e o `leyline_charge` anuncia a descarga LEYLINE_CHARGE_TICKS antes
        // dela existir. O dano so acontece porque este aviso veio primeiro;
        // quem esta em cima da linha tem quase um segundo para sair.
        //
        // Nao ha flood aqui: o alcance de uma ativacao e ESTRUTURAL (as
        // celulas do segmento), entao a corrente nunca cruza a juncao nem
        // viaja o mapa — o que separa "usei o terreno" de "limpei a sala".
        const segIdx = state.leylineSegments.findIndex((s) => s.cells.includes(i));
        if (segIdx >= 0) {
          const seg = state.leylineSegments[segIdx];
          // Carregando ou refrataria: o tiro morre na parede sem feedback
          // mecanico novo — o estado ja e legivel pela luz do trecho.
          if (seg.dischargeAt === 0 && state.tick >= seg.refractoryUntil) {
            seg.dischargeAt = state.tick + LEYLINE_CHARGE_TICKS;
            seg.triggeredBy = origin.source === 'player' && origin.owner !== undefined ? origin.owner : -1;
            events.push({ t: 'leyline_charge', seg: segIdx, cells: seg.cells, dischargeTick: seg.dischargeAt });
          }
        }
      }
      // As outras classes nao mordem: a leyline e permanente. Nao rende
      // lasca, nao corroi, nao funde — a materia dela nunca esteve em jogo.
      return { stop: true, broke: false };
    }

    case SOLID_LEYLINE_NODE:
      // A juncao continua inerte a projetil: ROTEA-LA e via interact
      // (stepPlayer) — o toggle e de mao, nao de bala. Deixar a bala rotear
      // misturaria o verbo de ativar a linha com o de reconfigura-la, e uma
      // rajada perdida mudaria a rede sem o jogador decidir nada.
      return { stop: true, broke: false };

    case SOLID_CRYSTAL_DULL: {
      // Opaco ainda quebra, mas sem descarga: a energia dele ja foi.
      state.solid[i] = SOLID_NONE;
      markDirty(state, cx, cy);
      events.push({ t: 'break', ...at, solid: SOLID_CRYSTAL_DULL });
      return { stop: true, broke: true };
    }

    default:
      return { stop: true, broke: false };
  }
};

/**
 * Reacao da SUPERFICIE de uma celula aberta por onde o projetil passa.
 * Devolve true quando o projetil e consumido.
 */
export const impactSurface = (
  state: SurvivalState,
  cx: number,
  cy: number,
  cls: ProjectileClass,
  events: SemanticEvent[],
  origin: EffectOrigin = { source: 'environment' }
): boolean => {
  const i = cy * W(state) + cx;
  const surface = state.surface[i];

  if (surface === SURF_GAS && (cls === 'energy' || cls === 'thermal')) {
    // Gas sulfurico e a materia volatil: faisca ou calor o consome no mesmo
    // impacto e produz a explosao. Esporos nao entram neste ramo.
    setSurface(state, i, SURF_NONE, 0);
    explodeAt(state, cx + 0.5, cy + 0.5, 2.4, events, origin);
    return true;
  }

  if ((surface === SURF_FUNGAL || surface === SURF_FUNGAL_HEATED) && cls === 'thermal') {
    // Biomassa umida nao vira fogo no frame do impacto. O primeiro toque cria o
    // estado fumegante; impactos adicionais apenas aceleram a secagem.
    heatFungalCell(state, i, true);
    return false;
  }

  if (surface === SURF_SPORES && cls === 'thermal') {
    // A nuvem organica e esterilizada por calor, mas nao detona como gas.
    igniteCell(state, i, events);
    return false;
  }

  if (surface === SURF_BIOFLUID && cls === 'thermal') {
    igniteCell(state, i, events);
    return false;
  }

  if (surface === SURF_ICE && cls === 'thermal') {
    // Projetil termico derrete a lamina por onde passa: um rastro de agua
    // condutiva que vai recongelar. igniteCell ja sabe derreter.
    igniteCell(state, i, events);
    return false;
  }

  if (cls === 'bio') {
    // O acido do spitter ALIMENTA o fungo: a colonia avanca para as celulas
    // limpas em volta. E o inimigo trabalhando a favor do mundo, nao so contra
    // o jogador — o terreno piora mesmo quando o tiro erra.
    if (surface === SURF_FUNGAL || surface === SURF_FUNGAL_HEATED) {
      // Acido reidrata uma colonia que estava secando.
      if (surface === SURF_FUNGAL_HEATED) setSurface(state, i, SURF_FUNGAL, 0);
      const w = W(state);
      const h = state.config.height;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (state.solid[n] === SOLID_NONE && state.surface[n] === SURF_NONE) {
          setSurface(state, n, SURF_FUNGAL, 0);
        }
      }
      return false;
    }
    // Fogo e apagado pelo acido; cinza volta a criar fungo.
    if (surface === SURF_FIRE) {
      setSurface(state, i, SURF_SCORCHED, 0);
      return false;
    }
    if (surface === SURF_SCORCHED) {
      setSurface(state, i, SURF_FUNGAL, 0);
      return false;
    }
  }

  return false;
};
