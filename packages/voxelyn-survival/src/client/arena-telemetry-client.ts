// Envio de telemetria da Arena de Chefes — dispara e esquece, para
// `/arena-telemetry` (ver @voxelyn/survival-server/arena-telemetry.ts), NUNCA
// para `/telemetry`: os dois medem coisas diferentes (ver o cabecalho daquele
// modulo) e nao podem se misturar.
//
// Mesmas tres regras de `telemetry.ts`: nunca fala com o jogador, nunca
// bloqueia, nunca identifica ninguem. A Arena reusa o MESMO opt-out da
// campanha (`isOptedOut`) — e a mesma pessoa, e um segundo interruptor de
// privacidade so criaria confusao sobre qual dos dois desliga o que.
import { hashPlayerTuning, type SurvivalState } from '@voxelyn/survival-sim';
import { ARENA_CATALOG } from './arena-catalog';
import type { ArenaOutcome } from './arena-outcome';
import type { ArenaConditions } from './arena-setup';
import { isOptedOut } from './telemetry';

const OUTCOME_MAP: Record<ArenaOutcome, 'boss_killed' | 'player_dead' | 'abandoned'> = {
  victory: 'boss_killed',
  defeat: 'player_dead',
  abandoned: 'abandoned',
};

/**
 * Mesma resolucao de `main.ts` (query `?server=` > `VITE_SERVER_URL` >
 * fallback local), duplicada de proposito: importar de `main.ts` executaria
 * o boot inteiro do menu principal, que a Arena nao tem e nao quer.
 */
const defaultServerUrl = (): string => {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SERVER_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:8080`;
};

/**
 * Reporta o desfecho de UMA luta de arena. Chamar exatamente uma vez por
 * luta — o mesmo `conclude()` idempotente de `arena-main.ts` ja garante isso.
 */
export const reportArenaOutcome = (
  conditions: ArenaConditions,
  outcome: ArenaOutcome,
  state: SurvivalState,
): void => {
  if (isOptedOut()) return;

  const entry = ARENA_CATALOG[conditions.boss];
  const kills = Object.values(state.stats.kills).reduce((a, b) => a + b, 0);

  const body = JSON.stringify({
    event: {
      boss: conditions.boss,
      seed: entry.seed,
      generation: entry.generation,
      sector: entry.sector,
      startingHp: conditions.maxHp,
      ability: conditions.ability,
      // Ordenado: duas submissoes do MESMO conjunto de modulos tem de cair no
      // mesmo balde de loadout no digest, nao um por ordem de clique.
      modules: [...conditions.modules].sort(),
      /**
       * O tuning que a run REALMENTE usou, e nao um reconstruido aqui.
       *
       * Isto era `{ ...DEFAULT_PLAYER_TUNING, maxHp }`, e a reconstrucao so
       * funcionava enquanto o HP fosse a unica condicao que tocava o tuning.
       * Com os Estabilizadores Giroscopicos (MV-04) deixou de ser: as duas
       * lutas que o controle existe para COMPARAR caiam no mesmo digest, e a
       * telemetria agregava configuracoes de movimento materialmente
       * diferentes num balde so.
       *
       * Ler `state.config.tuning` fecha a classe inteira do defeito em vez de
       * remendar este caso: qualquer condicao futura que altere o tuning entra
       * no digest sozinha, porque o que se hasheia e o que a simulacao
       * congelou antes do tick zero.
       */
      tuningHash: hashPlayerTuning(state.config.tuning),
      outcome: OUTCOME_MAP[outcome],
      ticks: state.tick,
      hpRemaining: Math.max(0, Math.round(state.player.hp)),
      damageDealtTenths: state.stats.damageDealtTenths,
      damageTakenTenths: state.stats.damageTakenTenths,
      shots: state.stats.shotsFired,
      kills,
      deathCause: outcome === 'defeat' ? (state.summary?.deathCause?.kind ?? null) : null,
    },
  });

  const base = defaultServerUrl().replace(/^ws/, 'http').replace(/\/+$/, '');
  const url = `${base}/arena-telemetry`;

  try {
    // `sendBeacon` no ABANDONO especificamente: e o unico caminho de
    // reconfigurar-no-meio-da-luta que pode coincidir com a aba fechando, e
    // sendBeacon e o unico envio que sobrevive a isso (ver telemetry.ts para
    // o porque do Blob `text/plain` em vez de `application/json`).
    if (outcome === 'abandoned' && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* offline ou servidor fora e o caminho normal */
    });
  } catch {
    /* telemetria nunca fala com o jogador */
  }
};
