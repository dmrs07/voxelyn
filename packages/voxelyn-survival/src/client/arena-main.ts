// Ponto de entrada da Arena de Chefes: uma ferramenta de playtest isolado,
// separada da run normal (arena.html, nao index.html). Deixa escolher chefe,
// HP e eco/módulos de entrada e joga a luta com o MESMO motor de render/input
// do jogo real — sem leaderboard, sem gravacao de replay, sem Ecos de morte.
// Tem telemetria PROPRIA (arena-telemetry-client.ts), separada da de campanha
// de proposito — ver o cabecalho de @voxelyn/survival-server/arena-telemetry.ts.
//
// O laco de jogo abaixo e um recorte deliberado do de `main.ts`: mesma
// simulacao (`stepRun` a 20 Hz, `LocalPlayout` interpolando para o desenho),
// mesmo `SurvivalRenderer`/`SurvivalInput`, mesma assistencia de combate, e o
// MESMO `AudioDirector` (tiros, impactos, telegrafos de chefe, ambiencia) —
// o que sobra de fora e so o que pertence a EXPEDICAO (ticket do servidor,
// gravacao de log, homologacao, Ecos de morte): nada disso faz sentido para
// uma arena que existe so para testar uma luta isolada. O volume/mudo segue
// o que o jogador ja configurou na run normal (mesmo localStorage) — a
// arena nao tem sliders proprios de proposito, e uma ferramenta de playtest.
import { TICK_MS, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import type { AbilityId, ModuleId, SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalInput, type TouchSafeArea } from './input';
import { EngagementMemory, applyCombatAssist } from './combat-assist';
import { SurvivalRenderer } from './render';
import { LocalPlayout } from './local-playout';
import { TickEventQueue } from './playout';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { loadAudioSettings, loadQuality } from './settings';
import { audio } from './audio';
import { ARENA_BOSS_ORDER, ARENA_CATALOG, type ArenaBossId } from './arena-catalog';
import { arenaOutcomeFor, type ArenaOutcome } from './arena-outcome';
import { createArenaConclusionGuard } from './arena-conclusion';
import { reportArenaOutcome } from './arena-telemetry-client';
import {
  ARENA_MAX_HP,
  ARENA_MIN_HP,
  arenaIceCensus,
  clampArenaHp,
  createArenaRun,
  type ArenaConditions,
} from './arena-setup';
import {
  FROST_SCENARIOS,
  applyFastDecay,
  applyFrostScenario,
  arenaFrostReadout,
  type FrostScenario,
} from './arena-frost-debug';
import {
  LEVIATHAN_SCENARIOS,
  applyLeviathanScenario,
  leviathanReadout,
  type LeviathanScenario,
} from './arena-leviathan-debug';

const FROST_SCENARIO_LABELS: Record<FrostScenario, string> = {
  clear: 'Medidor vazio',
  queen: '+1 Nova (450)',
  queen2: '+2 Novas',
  nearFull: 'Quase cheio (950)',
  frostbite: 'Frostbite agora',
  hotWeapon: 'Arma quente (85)',
  wraith: 'Espectro ao lado',
  partnerHalf: 'Parceiro a 60%',
};

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
  minigun: 'Minigun',
};
const MODULE_ORDER: readonly ModuleId[] = [
  'piercing',
  'conductive',
  'explosive',
  'siphon',
  'ricochet',
  'return_disc',
  'minigun',
];

const setupEl = document.getElementById('setup') as HTMLDivElement;
const formEl = document.getElementById('setup-form') as HTMLFormElement;
const bossSelect = document.getElementById('boss') as HTMLSelectElement;
const bossPlaceEl = document.getElementById('boss-place') as HTMLSpanElement;
const hpInput = document.getElementById('hp') as HTMLInputElement;
const abilityGrid = document.getElementById('ability-grid') as HTMLDivElement;
const moduleGrid = document.getElementById('module-grid') as HTMLDivElement;
const stabilisersInput = document.getElementById('stabilisers') as HTMLInputElement;
const coopInput = document.getElementById('coop') as HTMLInputElement;
const frostPanel = document.getElementById('frost-panel') as HTMLDivElement;
const frostReadout = document.getElementById('frost-readout') as HTMLDivElement;
const frostButtons = document.getElementById('frost-buttons') as HTMLDivElement;
const frostFastDecay = document.getElementById('frost-fast-decay') as HTMLInputElement;
const leviathanPanel = document.getElementById('leviathan-panel') as HTMLDivElement;
const leviathanReadoutEl = document.getElementById('leviathan-readout') as HTMLDivElement;
const leviathanButtons = document.getElementById('leviathan-buttons') as HTMLDivElement;
const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game não encontrado.');
const hudNote = document.getElementById('hud-note') as HTMLDivElement;
const icePanel = document.getElementById('ice-panel') as HTMLDivElement;
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
  return {
    boss,
    maxHp,
    ability,
    modules,
    stabilisers: stabilisersInput.checked,
    coop: coopInput.checked,
  };
};

// ---------------------------------------------------------------------------
// O painel de congelamento: cenarios e leitura exata (arena-frost-debug.ts).
// Os botoes agem sobre a run ATIVA; `activeFrostState` e trocado a cada run.
// ---------------------------------------------------------------------------
let activeFrostState: SurvivalState | null = null;
let activeFrostEvents: ((events: SemanticEvent[]) => void) | null = null;
for (const scenario of FROST_SCENARIOS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = FROST_SCENARIO_LABELS[scenario];
  button.dataset.scenario = scenario;
  button.addEventListener('click', () => {
    if (!activeFrostState) return;
    const events = applyFrostScenario(activeFrostState, scenario);
    // Os eventos que a simulacao emitiria passam pelo mesmo funil dos de
    // verdade: a apresentacao (som, clarao, dica) e o que se esta testando.
    if (events.length > 0) activeFrostEvents?.(events);
  });
  frostButtons.appendChild(button);
}
// ---------------------------------------------------------------------------
// O painel do Leviata: cada postura do ciclo e a leitura exata do encontro
// (arena-leviathan-debug.ts). Os botoes agem sobre a run ATIVA.
// ---------------------------------------------------------------------------
const LEVIATHAN_SCENARIO_LABELS: Record<LeviathanScenario, string> = {
  anchor: 'ancorar',
  faceN: 'rumo N',
  faceE: 'rumo E',
  faceS: 'rumo S',
  faceW: 'rumo W',
  probeDry: 'Sondagem (piso seco)',
  probeDeepen: 'Sondagem (aprofundar)',
  standOnLid: 'jogador sobre a tampa',
  stepOff: 'jogador ao lado, em piso seco',
  dive: 'mergulho',
  hidden: 'viagem escondida',
  emerge: 'emergência',
  deluge: 'Dilúvio',
  hunting: 'perseguição',
  charge: 'carga da descarga',
  bubbleIn: 'jogador dentro da bolha',
  bubbleEdge: 'jogador na borda',
  bubbleOut: 'jogador fora',
};
for (const scenario of LEVIATHAN_SCENARIOS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = LEVIATHAN_SCENARIO_LABELS[scenario];
  button.dataset.scenario = scenario;
  button.addEventListener('click', () => {
    if (!activeFrostState) return;
    applyLeviathanScenario(activeFrostState, scenario);
  });
  leviathanButtons.appendChild(button);
}
const LEVIATHAN_READOUT_INTERVAL_MS = 100;
let leviathanReadoutAt = -1;
const updateLeviathanPanel = (state: SurvivalState, nowMs: number): void => {
  if (leviathanReadoutAt >= 0 && nowMs - leviathanReadoutAt < LEVIATHAN_READOUT_INTERVAL_MS) return;
  leviathanReadoutAt = nowMs;
  const r = leviathanReadout(state);
  if (!r) {
    leviathanReadoutEl.innerHTML = '<div>sem Leviatã em campo</div>';
    return;
  }
  const rows: string[] = [
    `postura <b>${r.posture}</b>`,
    `exposição <b>${Math.round(r.exposure * 100)}%</b> ${r.targetable ? '<span class="danger">alvo</span>' : '<span class="safe">fora de alcance</span>'}`,
    `tampa <b>${r.lidCells}</b> células`,
    `Sondagens <b>${r.anchorProbes}</b> aqui / <b>${r.probeSeq}</b> total`,
    `marca <b>${r.probeCell >= 0 ? (r.probeDeepen ? 'afunda' : 'rasa') : '—'}</b>`,
    `poças abertas <b>${r.pools}</b>`,
    `destino <b>${r.dest >= 0 ? r.dest : '—'}</b>${r.surfaceIn !== null ? ` emerge em <b>${r.surfaceIn}</b>` : ''}`,
    `Dilúvio <b>${r.deluged ? 'sim' : 'não'}</b>`,
    `descarga <b>${r.shockIn !== null ? `em ${r.shockIn} ticks` : '—'}</b> · bolhas <b>${r.bubbles}</b>`,
    `bolha: <b class="${r.insideBubble ? 'safe' : 'danger'}">${r.insideBubble ? 'PROTEGIDO' : 'exposto'}</b>${r.bubbleMargin !== null ? ` (${r.bubbleMargin >= 0 ? '+' : ''}${r.bubbleMargin.toFixed(2)})` : ''}`,
  ];
  leviathanReadoutEl.innerHTML = rows.map((l) => `<div>${l}</div>`).join('');
};
const FROST_READOUT_INTERVAL_MS = 100;
let frostReadoutAt = -1;
const updateFrostPanel = (state: SurvivalState, nowMs: number): void => {
  if (frostReadoutAt >= 0 && nowMs - frostReadoutAt < FROST_READOUT_INTERVAL_MS) return;
  frostReadoutAt = nowMs;
  const r = arenaFrostReadout(state, frostFastDecay.checked);
  const rows: string[] = [
    `medidor <b>${r.freeze}</b>/1000`,
    `<b>${r.percent}%</b>`,
    `frostbitten <b class="${r.frostbitten ? 'lock' : ''}">${r.frostbitten ? 'SIM' : 'não'}</b>`,
    `decaimento <b>${r.decayPerSecond.toFixed(1)}%/s</b>`,
    `última dose <b>${r.lastDoseTicksAgo === null ? '—' : `${r.lastDoseTicksAgo} ticks`}</b>`,
    `calor <b>${r.heat}</b>`,
    `lockout <b>${r.overheatLockTicks} ticks</b>`,
    `próx. ciclo <b>${r.nextCycleInTicks} ticks</b>`,
    `espectros <b>${r.wraiths.total}</b> (névoa ${r.wraiths.hidden})`,
    r.partner
      ? `parceiro <b>${r.partner.freeze}</b>${r.partner.frostbitten ? ' <b class="lock">FROSTBITE</b>' : ''}`
      : 'parceiro <b>—</b>',
  ];
  frostReadout.innerHTML = rows.map((row) => `<span>${row}</span>`).join('');
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

// ---------------------------------------------------------------------------
// Audio — mesmas preferencias (volume/mudo/trilha) da run normal, lidas do
// mesmo localStorage. O contexto so nasce num gesto do usuario (unlock),
// entao a rede de seguranca abaixo destrava no primeiro toque/tecla mesmo
// que o testador nunca clique em "Entrar na arena" pelo mouse.
// ---------------------------------------------------------------------------
const audioSettings = loadAudioSettings();
audio.setVolume(audioSettings.volume);
audio.setMusicVolume(audioSettings.musicVolume);
audio.setSfxVolume(audioSettings.sfxVolume);
audio.setMuted(audioSettings.muted);
audio.setMusicSource(audioSettings.musicSource);
for (const evt of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(evt, () => audio.unlock(), { once: true, passive: true });
}

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

/**
 * O CENSO DO GELO, no painel de diagnostico.
 *
 * Uma vez por segundo, e nao por quadro: a varredura le o grid inteiro, e a
 * informacao que ela entrega ("quantas celulas eu ja gastei?") nao muda em
 * 16 ms — atualizar a 60 Hz gastaria seis milhoes de leituras por segundo para
 * escrever o mesmo texto. `lastAt` de -1 forca a primeira escrita.
 */
const ICE_PANEL_INTERVAL_MS = 1000;
let icePanelAt = -1;
const updateIcePanel = (state: SurvivalState, nowMs: number): void => {
  if (icePanelAt >= 0 && nowMs - icePanelAt < ICE_PANEL_INTERVAL_MS) return;
  icePanelAt = nowMs;
  const c = arenaIceCensus(state);
  icePanel.innerHTML = [
    `gelo <b>${c.intact}</b>`,
    `rachado <b>${c.cracked}</b>`,
    `fraturado <b>${c.fractured}</b>`,
    `crítico <b class="crit">${c.critical}</b>`,
    `buracos <b class="hole">${c.holes}</b>`,
  ].join(' · ');
};

const runArena = (conditions: ArenaConditions): void => {
  setupEl.classList.add('hidden');
  endOverlay.classList.add('hidden');
  canvas.classList.remove('hidden');
  hudNote.classList.remove('hidden');
  // O censo so faz sentido onde ha gelo. Nos outros chefes o painel seria cinco
  // zeros permanentes tapando um canto da tela.
  icePanel.classList.toggle('hidden', conditions.boss !== 'frost_queen');
  frostPanel.classList.toggle('hidden', conditions.boss !== 'frost_queen');
  leviathanPanel.classList.toggle('hidden', conditions.boss !== 'sheet_leviathan');
  icePanelAt = -1;
  frostReadoutAt = -1;
  leviathanReadoutAt = -1;
  resize();

  const state: SurvivalState = createArenaRun(conditions);
  activeFrostState = state;
  audio.setLocalPlayerId(1);
  audio.reset();
  // Reiniciar a arena e uma RUN NOVA com os mesmos ids: sem isto, a queda, a
  // lapide e os rastros da tentativa anterior atravessariam para a proxima —
  // um Prospector afundando num buraco que ja recongelou.
  renderer.resetRunPresentation();
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  const playout = new LocalPlayout();
  playout.capture(state);
  const assistMemory = new EngagementMemory();
  let frameNow = lastTime;
  const eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
    audio.ingest(events, frameNow, state);
  });
  activeFrostEvents = (events) => {
    renderer.ingestEvents(events, frameNow);
    audio.ingest(events, frameNow, state);
  };
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
      // Segue chamando update() mesmo parado: e o que faz ambiencia/musica/
      // motor da minigun APAGAREM em rampa (approachLevels, silence()) em vez
      // de travarem no ultimo ganho que tinham quando a luta se decidiu.
      audio.update(state, now);
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
      // A APRESENTACAO DA QUEDA TERMINA ANTES DO RESULTADO. O overlay e HTML e
      // fica por cima do canvas: aberto no primeiro quadro, ele tapa
      // exatamente a animacao que esta ferramenta existe para deixar testar.
      // Mesma espera que `renderEnd` ja faz sozinho por dentro.
      if (!ended && !renderer.plungeActive(now)) {
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
      // O parceiro de apresentacao nao recebe comando: fica onde nasceu.
      const result = stepRun(state, conditions.coop ? [raw, emptyCommand()] : [raw]);
      if (frostFastDecay.checked && conditions.boss === 'frost_queen') applyFastDecay(state);
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
    audio.update(view, now);
    renderer.setCargoOre(view.stats.oreCollected);
    renderer.render(view, 1, input.state, now);
    if (conditions.boss === 'frost_queen') {
      updateIcePanel(state, now);
      updateFrostPanel(state, now);
    }
    if (conditions.boss === 'sheet_leviathan') updateLeviathanPanel(state, now);
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    const pendingChoice = view.playerExtra.pendingModuleChoice;
    if (pendingChoice && renderer.isChoiceRevealReady(now)) {
      const regions = renderer.renderChoice(view, vw, vh, input.state, now);
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
  // O clique que entra na arena e o gesto que destrava o audio, exatamente
  // como o clique que inicia uma descida em main.ts.
  audio.unlock();
  audio.ui();
  currentConditions = readConditions();
  runArena(currentConditions);
});

btnRetry.addEventListener('click', () => {
  audio.unlock();
  audio.ui();
  stopLoop?.();
  runArena(currentConditions);
});

btnReconfigure.addEventListener('click', () => {
  // Se a luta ainda estava indecisa, ISTO e o que a torna 'abandoned' em vez
  // de simplesmente sumir sem desfecho nenhum.
  abandonActiveRun?.();
  stopLoop?.();
  // O laco de quadros para AQUI: sem mais update(), ambiencia/musica/motor da
  // minigun ficariam presos no ultimo ganho que tinham. reset() os cala na
  // hora, do mesmo jeito que main.ts faz ao voltar para o menu.
  audio.reset();
  audio.ui();
  canvas.classList.add('hidden');
  hudNote.classList.add('hidden');
  icePanel.classList.add('hidden');
  frostPanel.classList.add('hidden');
  activeFrostState = null;
  activeFrostEvents = null;
  endOverlay.classList.add('hidden');
  setupEl.classList.remove('hidden');
});
