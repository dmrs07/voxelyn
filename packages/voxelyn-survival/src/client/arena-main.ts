// Ponto de entrada da Arena de Chefes: uma ferramenta de playtest isolado,
// separada da run normal (arena.html, nao index.html). Deixa escolher chefe,
// HP e eco/módulos de entrada e joga a luta com o MESMO motor de render/input
// do jogo real — sem leaderboard, sem gravacao de replay, sem Ecos de morte.
// Tem telemetria PROPRIA (arena-telemetry-client.ts), separada da de campanha
// de proposito — ver o cabecalho de @voxelyn/survival-server/arena-telemetry.ts.
//
// O laco de jogo abaixo e um recorte deliberado do de `main.ts`: mesma
// simulacao (`stepRun` a 20 Hz, `LocalPlayout` interpolando para o desenho),
// mesmo `SurvivalRenderer`/`SurvivalInput`, mesma assistencia de combate — o
// que sobra de fora e tudo que pertence a EXPEDICAO (ticket do servidor,
// gravacao de log, homologacao, Ecos de morte, som): nada disso faz sentido
// para uma arena que existe so para testar uma luta isolada.
import { TICK_MS, stepRun } from '@voxelyn/survival-sim';
import type { AbilityId, ModuleId, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalInput, type TouchSafeArea } from './input';
import { EngagementMemory, applyCombatAssist } from './combat-assist';
import { SurvivalRenderer } from './render';
import { LocalPlayout } from './local-playout';
import { TickEventQueue } from './playout';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { loadQuality } from './settings';
import { ARENA_BOSS_ORDER, ARENA_CATALOG, type ArenaBossId } from './arena-catalog';
import { arenaOutcomeFor, type ArenaOutcome } from './arena-outcome';
import { createArenaConclusionGuard } from './arena-conclusion';
import { reportArenaOutcome } from './arena-telemetry-client';
import {
  ARENA_MAX_HP,
  ARENA_MIN_HP,
  clampArenaHp,
  createArenaRun,
  type ArenaConditions,
} from './arena-setup';

const ABILITY_LABELS: Record<AbilityId, string> = {
  pulse: 'Pulso Cinético',
  flamethrower: 'Sopro (lança-chamas)',
  seeker: 'Perseguidor',
  arc: 'Arco Condutivo',
};
const ABILITY_ORDER: readonly AbilityId[] = ['pulse', 'flamethrower', 'seeker', 'arc'];

const MODULE_LABELS: Record<ModuleId, string> = {
  piercing: 'Perfurante',
  conductive: 'Condutivo',
  explosive: 'Explosivo',
  siphon: 'Sifão',
  ricochet: 'Ricochete',
  return_disc: 'Disco de Retorno',
};
const MODULE_ORDER: readonly ModuleId[] = [
  'piercing',
  'conductive',
  'explosive',
  'siphon',
  'ricochet',
  'return_disc',
];

const setupEl = document.getElementById('setup') as HTMLDivElement;
const formEl = document.getElementById('setup-form') as HTMLFormElement;
const bossSelect = document.getElementById('boss') as HTMLSelectElement;
const bossPlaceEl = document.getElementById('boss-place') as HTMLSpanElement;
const hpInput = document.getElementById('hp') as HTMLInputElement;
const abilityGrid = document.getElementById('ability-grid') as HTMLDivElement;
const moduleGrid = document.getElementById('module-grid') as HTMLDivElement;
const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game não encontrado.');
const hudNote = document.getElementById('hud-note') as HTMLDivElement;
const endOverlay = document.getElementById('end-overlay') as HTMLDivElement;
const endTitle = document.getElementById('end-title') as HTMLHeadingElement;
const endSummary = document.getElementById('end-summary') as HTMLDivElement;
const btnRetry = document.getElementById('btn-retry') as HTMLButtonElement;
const btnReconfigure = document.getElementById('btn-reconfigure') as HTMLButtonElement;

hpInput.min = String(ARENA_MIN_HP);
hpInput.max = String(ARENA_MAX_HP);

for (const id of ARENA_BOSS_ORDER) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = ARENA_CATALOG[id].label;
  bossSelect.appendChild(option);
}
const updateBossPlace = (): void => {
  const id = bossSelect.value as ArenaBossId;
  bossPlaceEl.textContent = ARENA_CATALOG[id]?.place ?? '';
};
bossSelect.addEventListener('change', updateBossPlace);
updateBossPlace();

for (const id of ABILITY_ORDER) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'ability';
  input.value = id;
  if (id === 'pulse') input.checked = true;
  const span = document.createElement('span');
  span.textContent = ABILITY_LABELS[id];
  label.append(input, span);
  abilityGrid.appendChild(label);
}

for (const id of MODULE_ORDER) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = 'module';
  input.value = id;
  const span = document.createElement('span');
  span.textContent = MODULE_LABELS[id];
  label.append(input, span);
  moduleGrid.appendChild(label);
}

const readConditions = (): ArenaConditions => {
  const boss = bossSelect.value as ArenaBossId;
  const maxHp = clampArenaHp(Number(hpInput.value));
  const abilityInput = formEl.querySelector<HTMLInputElement>('input[name="ability"]:checked');
  const ability = (abilityInput?.value ?? 'pulse') as AbilityId;
  const modules = Array.from(
    formEl.querySelectorAll<HTMLInputElement>('input[name="module"]:checked'),
    (el) => el.value as ModuleId,
  );
  return { boss, maxHp, ability, modules };
};

// ---------------------------------------------------------------------------
// Motor de jogo — recorte do laco solo de main.ts, sem expedicao/servidor.
// ---------------------------------------------------------------------------
const renderer = new SurvivalRenderer(canvas);
renderer.setLocalPlayerId(1);
renderer.setQuality(loadQuality());
const input = new SurvivalInput(canvas);
const cooldownOverlay = new TouchCooldownOverlay(canvas);
input.attach();

const readCssPixels = (name: string): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
const readSafeArea = (): TouchSafeArea => ({
  top: readCssPixels('--safe-area-inset-top'),
  right: readCssPixels('--safe-area-inset-right'),
  bottom: readCssPixels('--safe-area-inset-bottom'),
  left: readCssPixels('--safe-area-inset-left'),
});
const resize = (): void => {
  const safeArea = readSafeArea();
  renderer.setSafeArea(safeArea);
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight, safeArea);
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

const playerScreen = (): { x: number; y: number } => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

let stopLoop: (() => void) | null = null;
/** Marca a run corrente como abandonada, se ela ainda nao tiver se decidido. */
let abandonActiveRun: (() => void) | null = null;

/**
 * Fechar/trocar de aba no MEIO da luta e o abandono mais importante que
 * existe, e o unico jeito de captura-lo e um listener global — nao ha botao
 * para "sair", so o X do navegador. `pagehide` (e nao `beforeunload`) porque
 * ele dispara de forma confiavel em navegacao para tras/fechamento de aba em
 * mobile, onde `beforeunload` e notoriamente inconsistente; `conclude()` ja
 * e a guarda idempotente que torna isto seguro chamar mesmo sem luta ativa
 * (`abandonActiveRun` nulo) ou com a luta ja concluida (vitoria/derrota).
 */
window.addEventListener('pagehide', () => abandonActiveRun?.());

const OUTCOME_TITLE: Record<ArenaOutcome, string> = {
  victory: 'Chefe derrotado',
  defeat: 'O Prospector caiu',
  abandoned: 'Luta abandonada',
};

const showEnd = (outcome: ArenaOutcome, state: SurvivalState): void => {
  endTitle.textContent = OUTCOME_TITLE[outcome];
  const summary = state.summary;
  const lines: string[] = [`${state.tick} ticks simulados`];
  if (summary) {
    lines.push(`Causa: ${summary.deathCause?.kind ?? 'nenhuma'}`);
    lines.push(`Dano causado: ${(summary.stats.damageDealtTenths / 10).toFixed(1)}`);
    lines.push(`Dano recebido: ${(summary.stats.damageTakenTenths / 10).toFixed(1)}`);
    lines.push(`Tiros disparados: ${summary.stats.shotsFired}`);
  } else {
    // Vitoria contra o chefe nao encerra `state.phase` (ver arena-outcome.ts),
    // entao nao ha RunSummary — so o que a propria arena sabe medir.
    lines.push(`Dano causado: ${(state.stats.damageDealtTenths / 10).toFixed(1)}`);
    lines.push(`Dano recebido: ${(state.stats.damageTakenTenths / 10).toFixed(1)}`);
    lines.push(`Tiros disparados: ${state.stats.shotsFired}`);
  }
  endSummary.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  endOverlay.classList.remove('hidden');
};

const runArena = (conditions: ArenaConditions): void => {
  setupEl.classList.add('hidden');
  endOverlay.classList.add('hidden');
  canvas.classList.remove('hidden');
  hudNote.classList.remove('hidden');
  resize();

  const state: SurvivalState = createArenaRun(conditions);
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  const playout = new LocalPlayout();
  playout.capture(state);
  const assistMemory = new EngagementMemory();
  let frameNow = lastTime;
  const eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
  });
  let queuedChoice: 0 | 1 | null = null;
  let ended = false;

  // Guarda pura (arena-conclusion.ts): `conclude` so tem efeito na PRIMEIRA
  // chamada. E o que torna seguro o `pagehide` global chamar `abandonActiveRun`
  // sem checar se ha luta em andamento, e o que impede um abandono tardio
  // (aba fechada depois de uma vitoria ja concluida) de sobrescrever o
  // desfecho de verdade.
  const guard = createArenaConclusionGuard();
  const conclude = (result: ArenaOutcome): void => {
    if (guard.conclude(result)) reportArenaOutcome(conditions, result, state);
  };
  abandonActiveRun = (): void => conclude('abandoned');

  const frame = (now: number): void => {
    if (!running) return;
    frameNow = now;
    const delta = Math.min(120, now - lastTime);
    lastTime = now;
    accumulator += delta;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const outcome = guard.current();
    if (outcome) {
      eventQueue.flush(Number.POSITIVE_INFINITY);
      renderer.render(state, 1, input.state, now);
      // `renderEnd` e a tela de fim NATIVA da sim (morte/extracao); vitoria
      // contra o chefe nao passa por `state.phase`, entao nao ha nada la para
      // desenhar — o overlay de HTML e o resultado inteiro nesse caso.
      //
      // Sem o rodape de acoes: aqui ele fica ATRAS do resultado da ferramenta e
      // este laco nao le toque nem as teclas R/T. Dois botoes que nao levam a
      // lugar nenhum sao piores que nenhum — um botao promete que funciona.
      if (state.phase !== 'running') {
        renderer.renderEnd(state, vw, vh, now, { input: input.state, actions: false });
      }
      if (!ended) {
        ended = true;
        showEnd(outcome, state);
      }
      requestAnimationFrame(frame);
      return;
    }

    while (accumulator >= TICK_MS) {
      const raw = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        raw.choose = queuedChoice;
        queuedChoice = null;
      }
      applyCombatAssist(state, raw, input.consumeAimTap(), assistMemory);
      const result = stepRun(state, [raw]);
      playout.capture(state);
      eventQueue.push(state.tick, result.events);
      accumulator -= TICK_MS;
      const detected = arenaOutcomeFor(state, conditions.boss);
      if (detected) {
        conclude(detected);
        break;
      }
    }
    const alpha = accumulator / TICK_MS;
    const view = guard.current() ? state : (playout.sample(state, alpha) ?? state);
    eventQueue.flush(view.tick);
    renderer.setCargoOre(view.stats.oreCollected);
    renderer.render(view, 1, input.state, now);
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    const pendingChoice = view.playerExtra.pendingModuleChoice;
    if (pendingChoice && renderer.isChoiceRevealReady(now)) {
      const regions = renderer.renderChoice(view, vw, vh, input.state);
      const choice = input.consumeChoiceTap(regions);
      if (choice !== null) queuedChoice = choice;
    } else if (pendingChoice) {
      input.clearPendingChoiceInput();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  stopLoop = (): void => {
    running = false;
  };
};

let currentConditions: ArenaConditions = readConditions();

formEl.addEventListener('submit', (ev) => {
  ev.preventDefault();
  currentConditions = readConditions();
  runArena(currentConditions);
});

btnRetry.addEventListener('click', () => {
  stopLoop?.();
  runArena(currentConditions);
});

btnReconfigure.addEventListener('click', () => {
  // Se a luta ainda estava indecisa, ISTO e o que a torna 'abandoned' em vez
  // de simplesmente sumir sem desfecho nenhum.
  abandonActiveRun?.();
  stopLoop?.();
  canvas.classList.add('hidden');
  hudNote.classList.add('hidden');
  endOverlay.classList.add('hidden');
  setupEl.classList.remove('hidden');
});
