import { mountSutureDebug } from './arena-sutures-debug';
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
  resolveArenaSeed,
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
import {
  DIAMANDIS_SCENARIOS,
  applyDiamandisScenario,
  diamandisReadout,
  type DiamandisScenario,
} from './arena-diamandis-debug';
import {
  DEVOURER_SCENARIOS,
  applyDevourerScenario,
  devourerReadout,
  resetDevourerReadout,
  type DevourerScenario,
} from './arena-devourer-debug';
import {
  BOSS_BAR_SCENARIOS,
  BossBarGallery,
  BossBarScenarioDriver,
  GALLERY_SCENARIOS,
  GALLERY_VIEWPORTS,
  bossBarReadout,
  type BossBarScenario,
  type GalleryScenario,
  type GalleryViewport,
} from './arena-bossbar-debug';
import { setReducedMotionOverride } from './render';
import {
  LOCALES,
  LOCALE_LABELS,
  applyStaticTranslations,
  getLocale,
  onLocaleChange,
  setLocale,
  t,
} from './i18n';
import { BOSS_ARCHETYPES } from '@voxelyn/survival-sim';
import { bossBarAccent } from './boss-health-bar-palette';

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
  seismic: 'Onda Sísmica',
  slipstream: 'Disparada',
  vent: 'Respiro de Emergência',
  seeker: 'Perseguidor',
  arc: 'Arco Condutivo',
};
const ABILITY_ORDER: readonly AbilityId[] = [
  'pulse',
  'flamethrower',
  'seeker',
  'arc',
  'seismic',
  'slipstream',
  'vent',
];

const MODULE_LABELS: Record<ModuleId, string> = {
  piercing: 'Perfurante',
  conductive: 'Condutivo',
  explosive: 'Explosivo',
  siphon: 'Sifão',
  ricochet: 'Ricochete',
  return_disc: 'Disco de Retorno',
  minigun: 'Minigun',
  prospect_lance: 'Lança de Prospecção',
  blunderbuss: 'Bacamarte',
};
const MODULE_ORDER: readonly ModuleId[] = [
  'piercing',
  'conductive',
  'explosive',
  'siphon',
  'ricochet',
  'return_disc',
  'minigun',
  'prospect_lance',
  'blunderbuss',
];

const setupEl = document.getElementById('setup') as HTMLDivElement;
const formEl = document.getElementById('setup-form') as HTMLFormElement;
const bossSelect = document.getElementById('boss') as HTMLSelectElement;
const bossPlaceEl = document.getElementById('boss-place') as HTMLSpanElement;

/**
 * A seed pedida na URL (`arena.html?seed=216`), ou null.
 *
 * Lida UMA vez: ela e um parametro de sessao de playtest, e nao um controle do
 * seletor. Quem quiser outra camara troca a URL — que e tambem como ela se
 * compartilha entre duas pessoas observando a mesma luta.
 *
 * Nao e validada aqui de proposito: a validacao depende do chefe escolhido, e o
 * chefe muda no seletor. Quem valida e `resolveArenaSeed`, na hora de abrir.
 */
const requestedSeed = ((): number | null => {
  const raw = new URLSearchParams(location.search).get('seed');
  if (raw === null) return null;
  const seed = Number(raw);
  return Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : null;
})();
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
const diamandisPanel = document.getElementById('diamandis-panel') as HTMLDivElement;
const diamandisReadoutEl = document.getElementById('diamandis-readout') as HTMLDivElement;
const diamandisButtons = document.getElementById('diamandis-buttons') as HTMLDivElement;
const devourerPanel = document.getElementById('devourer-panel') as HTMLDivElement;
const devourerReadoutEl = document.getElementById('devourer-readout') as HTMLDivElement;
const devourerButtons = document.getElementById('devourer-buttons') as HTMLDivElement;
const bossBarPanel = document.getElementById('bossbar-panel') as HTMLDivElement;
const bossBarReadoutEl = document.getElementById('bossbar-readout') as HTMLDivElement;
const bossBarButtons = document.getElementById('bossbar-buttons') as HTMLDivElement;
const bossBarReconnect = document.getElementById('bossbar-reconnect') as HTMLButtonElement;
const bossBarReduced = document.getElementById('bossbar-reduced') as HTMLInputElement;
const bossBarLocale = document.getElementById('bossbar-locale') as HTMLSelectElement;
const setupLocale = document.getElementById('setup-locale') as HTMLSelectElement;
const bossBarGalleryOpen = document.getElementById('bossbar-gallery-open') as HTMLButtonElement;
const galleryEl = document.getElementById('bossbar-gallery') as HTMLDivElement;
const galleryScenario = document.getElementById('gallery-scenario') as HTMLSelectElement;
const galleryViewport = document.getElementById('gallery-viewport') as HTMLSelectElement;
const gallerySingle = document.getElementById('gallery-single') as HTMLSelectElement;
const galleryReduced = document.getElementById('gallery-reduced') as HTMLInputElement;
const galleryFit = document.getElementById('gallery-fit') as HTMLInputElement;
const galleryLocale = document.getElementById('gallery-locale') as HTMLSelectElement;
const galleryClose = document.getElementById('gallery-close') as HTMLButtonElement;
const galleryStage = document.getElementById('gallery-stage') as HTMLDivElement;
const galleryCanvas = document.getElementById('gallery-canvas') as HTMLCanvasElement;
const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game não encontrado.');
const hudNote = document.getElementById('hud-note') as HTMLDivElement;
const toolsToggle = document.getElementById('tools-toggle') as HTMLButtonElement;

// ---------------------------------------------------------------------------
// O interruptor das ferramentas (ver o CSS de `#tools-toggle`). Um so estado
// para todos os paineis de debug. Em tela de toque comeca ESCONDIDO: no
// celular os paineis cobrem a sala e roubam o toque dos manches, e o que se
// quer testar ali e jogar. A escolha do testador persiste no navegador.
// ---------------------------------------------------------------------------
const TOOLS_STORAGE_KEY = 'voxelyn.arena.tools';
const coarsePointer = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const readToolsHidden = (): boolean => {
  try {
    const stored = localStorage.getItem(TOOLS_STORAGE_KEY);
    if (stored === 'shown') return false;
    if (stored === 'hidden') return true;
  } catch {
    /* sem storage: fica a regra por aparelho */
  }
  return coarsePointer() || window.innerWidth < 900;
};
const applyToolsHidden = (hidden: boolean): void => {
  document.body.classList.toggle('tools-hidden', hidden);
  toolsToggle.textContent = t(hidden ? 'arena.tools.show' : 'arena.tools.hide');
  toolsToggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
};
applyToolsHidden(readToolsHidden());
toolsToggle.addEventListener('click', () => {
  const hidden = !document.body.classList.contains('tools-hidden');
  applyToolsHidden(hidden);
  try {
    localStorage.setItem(TOOLS_STORAGE_KEY, hidden ? 'hidden' : 'shown');
  } catch {
    /* sem storage: vale para esta sessao */
  }
});
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
  const entry = ARENA_CATALOG[id];
  // A SEED ATIVA FICA NA TELA, sempre — nao so quando alguem a forcou. Uma
  // ferramenta de medicao que esconde qual camara abriu produz conversa sobre
  // "aquela luta" sem ninguem saber qual luta era; e, quando o override e
  // RECUSADO (seed que nao entrega este chefe), a tela tem de dizer que caiu de
  // volta na canonica, senao o playtest inteiro acontece na camara errada
  // achando que esta na certa.
  const active = resolveArenaSeed(id, requestedSeed ?? entry?.seed);
  const refused = requestedSeed !== null && active !== requestedSeed;
  const seedNote = refused
    ? ` · seed ${active} (a ${requestedSeed} nao entrega este chefe)`
    : ` · seed ${active}`;
  bossPlaceEl.textContent = `${entry?.place ?? ''}${entry ? seedNote : ''}`;
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
    // `undefined` quando ninguem pediu: a arena abre a camara do catalogo, que
    // continua sendo o fluxo normal da ferramenta.
    seed: requestedSeed ?? undefined,
  };
};

// ---------------------------------------------------------------------------
// O painel de congelamento: cenarios e leitura exata (arena-frost-debug.ts).
// Os botoes agem sobre a run ATIVA; `activeFrostState` e trocado a cada run.
// ---------------------------------------------------------------------------
let activeFrostState: SurvivalState | null = null;
let suturePaused = false;

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
// ---------------------------------------------------------------------------
// O painel do Diamandis: os oito rumos, cada estado de cada peca, o frenesi e
// a leitura do que a simulacao decide (arena-diamandis-debug.ts).
// ---------------------------------------------------------------------------
const DIAMANDIS_SCENARIO_LABELS: Record<DiamandisScenario, string> = {
  reset: 'peças de volta',
  wake: 'acordar',
  beside: 'jogador ao lado',
  center: 'os dois no meio da sala',
  faceR: 'rumo →',
  faceDR: 'rumo ↘',
  faceD: 'rumo ↓',
  faceDL: 'rumo ↙',
  faceL: 'rumo ←',
  faceUL: 'rumo ↖',
  faceU: 'rumo ↑',
  faceUR: 'rumo ↗',
  exposeNext: 'soltar próxima peça',
  ripNext: 'arrancar (com Coveiro)',
  killCarrier: 'abater carregador',
  frenzyMax: 'frenesi máximo',
  reactor: 'colapso do reator',
  beam: 'feixe de prospecção',
  demolish: 'salva de demolição',
  drill: 'avanço da broca',
  drillWall: 'broca contra veio',
  drillMiss: 'broca errando',
  pummel: 'desarmado: o soco',
};
for (const scenario of DIAMANDIS_SCENARIOS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = DIAMANDIS_SCENARIO_LABELS[scenario];
  button.dataset.scenario = scenario;
  button.addEventListener('click', () => {
    if (!activeFrostState) return;
    const events = applyDiamandisScenario(activeFrostState, scenario);
    // Pelo mesmo funil dos eventos de verdade: o corpo, a barra, o som e o
    // clarao sao o que se esta testando.
    if (events.length > 0) activeFrostEvents?.(events);
  });
  diamandisButtons.appendChild(button);
}
const DIAMANDIS_READOUT_INTERVAL_MS = 100;
let diamandisReadoutAt = -1;
const updateDiamandisPanel = (state: SurvivalState, nowMs: number): void => {
  if (diamandisReadoutAt >= 0 && nowMs - diamandisReadoutAt < DIAMANDIS_READOUT_INTERVAL_MS) return;
  diamandisReadoutAt = nowMs;
  const r = diamandisReadout(state);
  if (!r) {
    diamandisReadoutEl.innerHTML = '<div>sem Diamandis em campo</div>';
    return;
  }
  const PART_STATE_LABEL = { mounted: 'presa', loose: 'solta', gone: 'arrancada' } as const;
  const parts = r.parts
    .map((p) => {
      const cls = p.state === 'mounted' ? 'safe' : p.state === 'loose' ? '' : 'danger';
      const carrier = p.carrier !== null ? ` (Coveiro #${p.carrier})` : '';
      return `${p.name} <b class="${cls}">${PART_STATE_LABEL[p.state]}</b>${carrier}`;
    })
    .join(' · ');
  const rows: string[] = [
    `vida <b>${Math.round(r.hpFraction * 100)}%</b> · rumo <b>${r.facing}</b> · ${r.awake ? 'acordado' : 'dormindo'}`,
    parts,
    `próxima peça solta a <b>${r.nextExposeAt !== null ? `${Math.round(r.nextExposeAt * 100)}%` : '—'}</b>`,
    `frenesi <b class="${r.stacks > 0 ? 'danger' : ''}">${r.stacks}</b> · dano ×<b>${r.multiplier.toFixed(2)}</b> (teto ×${r.cap.toFixed(2)})`,
    `estagger <b>${r.staggerLeft > 0 ? `${r.staggerLeft}/${r.staggerTicks} ticks` : '—'}</b>`,
    `Coveiros <b>${r.undertakers}</b> · carregando <b>${r.carriers}</b>`,
    `reator <b>${r.reactor ? 'em colapso' : 'estável'}</b>`,
    `feixe <b>${r.beam ? `${r.beam.phase === 'survey' ? 'levantamento' : 'passagem'} ${Math.round(r.beam.progress * 100)}%` : '—'}</b>${r.beam ? ` · alcance <b>${r.beam.reach.toFixed(1)}</b>` : ''} · cargas <b>${r.charges}</b> · broca <b>${r.drill ? `${r.drill.stage} giro ${Math.round(r.drill.spin * 100)}% vel ${Math.round(r.drill.speed * 100)}%` : '—'}</b>`,
  ];
  diamandisReadoutEl.innerHTML = rows.map((l) => `<div>${l}</div>`).join('');
};
// ---------------------------------------------------------------------------
// O painel do DEVORADOR (arena-devourer-debug.ts): os oito rumos de salto.
//
// O que ele mede: quatro dos oito quadros do corpo so aparecem em arcos NAO
// ORTOGONAIS. Sem uma forma de pedir cada rumo e ver o que a simulacao produz,
// a metade nova do atlas seria fe.
// ---------------------------------------------------------------------------
const DEVOURER_SCENARIO_LABELS: Record<DevourerScenario, string> = {
  hopDR: 'salto +x (dr)',
  hopDL: 'salto +y (dl)',
  hopUR: 'salto −y (ur)',
  hopUL: 'salto −x (ul)',
  hopR: 'salto ↗ (r)',
  hopD: 'salto ↘ (d)',
  hopL: 'salto ↙ (l)',
  hopU: 'salto ↖ (u)',
  maw: 'boca aberta',
  burrow: 'submerso',
  hunger: 'a Fome (45% de vida)',
  reset: 'reiniciar',
};
for (const scenario of DEVOURER_SCENARIOS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = DEVOURER_SCENARIO_LABELS[scenario];
  button.dataset.scenario = scenario;
  button.addEventListener('click', () => {
    if (!activeFrostState) return;
    const events = applyDevourerScenario(activeFrostState, scenario);
    if (events.length > 0) activeFrostEvents?.(events);
  });
  devourerButtons.appendChild(button);
}
const DEVOURER_MOOD_LABELS: Record<string, string> = {
  burrowed: 'submerso',
  surfaced: 'à superfície',
  airborne: 'no ar',
  maw: 'boca aberta',
  unknown: '—',
};
const DEVOURER_READOUT_INTERVAL_MS = 100;
let devourerReadoutAt = -1;
const updateDevourerPanel = (state: SurvivalState, nowMs: number): void => {
  if (devourerReadoutAt >= 0 && nowMs - devourerReadoutAt < DEVOURER_READOUT_INTERVAL_MS) return;
  devourerReadoutAt = nowMs;
  const r = devourerReadout(state);
  if (!r) {
    devourerReadoutEl.innerHTML = '<div>sem Devorador em campo</div>';
    return;
  }
  const arc = r.arc
    ? `<b class="${r.arc.orthogonal ? '' : 'safe'}">${r.arc.dir}</b> (${r.arc.dx.toFixed(1)}, ${r.arc.dy.toFixed(1)}) ${r.arc.orthogonal ? 'ortogonal' : '<b class="safe">diagonal</b>'}`
    : '—';
  const pedido = r.asked
    ? `pedido <b>${r.asked}</b> → ${r.arc ? `saiu <b>${r.arc.dir}</b>` : '<span style="opacity:.7">aguardando</span>'}`
    : '';
  const rows: string[] = [
    `vida <b>${Math.round(r.hpFraction * 100)}%</b> · <b>${DEVOURER_MOOD_LABELS[r.mood] ?? r.mood}</b> · rumo <b>${r.facing}</b>`,
    ...(pedido ? [pedido] : []),
    `arco ${arc}`,
    `saltos restantes <b>${r.leapsLeft}</b>${r.mawTicks !== null ? ` · boca <b>${r.mawTicks}</b> ticks` : ''}`,
    // A prova acumulada: os quatro rumos diagonais so podem ter vindo de arcos
    // que nao correm num eixo.
    `rumos vistos <b>${r.seen.length}/8</b> · diagonais <b class="${r.seenDiagonal > 0 ? 'safe' : 'danger'}">${r.seenDiagonal}/4</b>`,
    `<span style="opacity:.7">${r.seen.join(' ') || '—'}</span>`,
  ];
  devourerReadoutEl.innerHTML = rows.map((l) => `<div>${l}</div>`).join('');
};
// ---------------------------------------------------------------------------
// O painel da barra de chefe (arena-bossbar-debug.ts): cenarios sobre a luta
// corrente, pelo funil da simulacao; leitura exata; alternadores; galeria.
// ---------------------------------------------------------------------------
const BOSS_BAR_SCENARIO_LABELS: Record<BossBarScenario, string> = {
  sleep: 'dormir',
  awaken: 'despertar',
  full: 'vida cheia',
  hitSmall: 'dano pequeno (3%)',
  hitBig: 'dano grande (18%)',
  burst: 'rajada (4 golpes)',
  heal: 'cura (+12%)',
  phase: 'transição de fase',
  hide: 'ocultar / submergir',
  offscreen: 'fora da câmera',
  kill: 'morte',
};
const bossBarDriver = new BossBarScenarioDriver();
for (const scenario of BOSS_BAR_SCENARIOS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = BOSS_BAR_SCENARIO_LABELS[scenario];
  button.dataset.scenario = scenario;
  button.addEventListener('click', () => {
    if (!activeFrostState) return;
    const events = bossBarDriver.apply(activeFrostState, scenario);
    // Pelo mesmo funil dos eventos de verdade: a barra, o som e o clarao sao o
    // que se esta testando.
    if (events.length > 0) activeFrostEvents?.(events);
  });
  bossBarButtons.appendChild(button);
}
bossBarReconnect.addEventListener('click', () => {
  // Um reconnect: a apresentacao esquece tudo e reentra no HP atual — sem o
  // ritual, porque ninguem viu o chefe dormir e nenhum `boss_awake` chegou.
  renderer.bossHealthBar.reset();
});
bossBarReduced.addEventListener('change', () => {
  setReducedMotionOverride(bossBarReduced.checked ? true : null);
});
mountSutureDebug(
  () => activeFrostState,
  (events) => activeFrostEvents?.(events),
  (paused) => {
    suturePaused = paused;
  },
);

const fillLocaleSelect = (select: HTMLSelectElement): void => {
  for (const locale of LOCALES) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = LOCALE_LABELS[locale];
    select.appendChild(option);
  }
  select.value = getLocale();
  select.addEventListener('change', () => {
    setLocale(select.value as (typeof LOCALES)[number]);
    bossBarLocale.value = select.value;
    galleryLocale.value = select.value;
    gallery.restart();
  });
};
const BOSS_BAR_READOUT_INTERVAL_MS = 100;
let bossBarReadoutAt = -1;
const updateBossBarPanel = (state: SurvivalState, nowMs: number): void => {
  if (bossBarReadoutAt >= 0 && nowMs - bossBarReadoutAt < BOSS_BAR_READOUT_INTERVAL_MS) return;
  bossBarReadoutAt = nowMs;
  const r = bossBarReadout(state);
  const shown = renderer.bossHealthBar.archetype;
  const rows: string[] = [
    `dono <b>${r.archetype ?? '—'}</b>`,
    `entityId <b>${r.entityIdNull ? 'null' : 'id'}</b>`,
    `acordado <b>${r.awake ? 'sim' : 'não'}</b>`,
    `derrotado <b>${r.defeated ? 'sim' : 'não'}</b>`,
    `HP <b class="blood">${r.hp ?? '—'}</b> / <b>${r.maxHp ?? '—'}</b>`,
    `fases <b>${r.phases.toString(2).padStart(6, '0')}</b>`,
    `barra <b>${shown ?? 'oculta'}</b>`,
    `acento <b>${r.material}</b>`,
  ];
  bossBarReadoutEl.innerHTML = rows.map((row) => `<span>${row}</span>`).join('');
};

// A GALERIA: um laco proprio de quadros enquanto estiver aberta.
const gallery = new BossBarGallery(galleryCanvas);
const GALLERY_SCENARIO_LABELS: Record<GalleryScenario, string> = {
  entry: 'entrada (ritual)',
  full: 'vida cheia',
  hit: 'dano (pequeno, rajada, grande)',
  heal: 'cura',
  phase: 'transição de fase',
  veiled: 'oculto / submerso',
  death: 'morte',
};
for (const scenario of GALLERY_SCENARIOS) {
  const option = document.createElement('option');
  option.value = scenario;
  option.textContent = GALLERY_SCENARIO_LABELS[scenario];
  galleryScenario.appendChild(option);
}
const GALLERY_VIEWPORT_LABELS: Record<GalleryViewport, string> = {
  desktop: 'Desktop 1366×768',
  desktopHd: 'Desktop 1920×1080',
  ultrawide: 'Ultrawide 2560×1080',
  landscape: 'Móvel paisagem 568×320',
  portrait: 'Móvel retrato 320×568',
};
for (const id of Object.keys(GALLERY_VIEWPORTS) as GalleryViewport[]) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = GALLERY_VIEWPORT_LABELS[id];
  galleryViewport.appendChild(option);
}
{
  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'todos (comparativo)';
  gallerySingle.appendChild(all);
  for (const archetype of BOSS_ARCHETYPES) {
    const option = document.createElement('option');
    option.value = archetype;
    option.textContent = `${archetype} — ${t(bossBarAccent(archetype).materialKey)}`;
    gallerySingle.appendChild(option);
  }
}
fillLocaleSelect(bossBarLocale);
fillLocaleSelect(galleryLocale);
fillLocaleSelect(setupLocale);
let galleryRunning = false;
const galleryFrame = (now: number): void => {
  if (!galleryRunning) return;
  gallery.render(now);
  requestAnimationFrame(galleryFrame);
};
const applyGalleryControls = (): void => {
  gallery.scenario = galleryScenario.value as GalleryScenario;
  gallery.viewport = galleryViewport.value as GalleryViewport;
  gallery.single = gallerySingle.value || null;
  gallery.reducedMotion = galleryReduced.checked;
  galleryStage.classList.toggle('fit', galleryFit.checked);
  gallery.restart();
};
for (const el of [galleryScenario, galleryViewport, gallerySingle, galleryReduced, galleryFit]) {
  el.addEventListener('change', applyGalleryControls);
}
bossBarGalleryOpen.addEventListener('click', () => {
  applyGalleryControls();
  galleryEl.classList.remove('hidden');
  galleryRunning = true;
  requestAnimationFrame(galleryFrame);
});
galleryClose.addEventListener('click', () => {
  galleryRunning = false;
  galleryEl.classList.add('hidden');
});
// `?gallery=1` abre a galeria direto, sem entrar numa luta — e o caminho das
// capturas de tela automatizadas.
if (new URLSearchParams(location.search).get('gallery') === '1') {
  const params = new URLSearchParams(location.search);
  if (params.get('scenario')) galleryScenario.value = params.get('scenario')!;
  if (params.get('viewport')) galleryViewport.value = params.get('viewport')!;
  if (params.get('single') !== null) gallerySingle.value = params.get('single')!;
  if (params.get('locale')) {
    setLocale(params.get('locale') as (typeof LOCALES)[number]);
    galleryLocale.value = getLocale();
  }
  galleryFit.checked = params.get('fit') !== '0';
  applyGalleryControls();
  galleryEl.classList.remove('hidden');
  galleryRunning = true;
  requestAnimationFrame(galleryFrame);
}

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

const OUTCOME_TITLE = {
  victory: 'arena.end.victory',
  defeat: 'arena.end.defeat',
  abandoned: 'arena.end.abandoned',
} as const satisfies Record<ArenaOutcome, string>;

// A ultima tela de fim, para redesenha-la se o idioma mudar com ela aberta.
let lastEnd: { outcome: ArenaOutcome; state: SurvivalState } | null = null;

const showEnd = (outcome: ArenaOutcome, state: SurvivalState): void => {
  lastEnd = { outcome, state };
  endTitle.textContent = t(OUTCOME_TITLE[outcome]);
  const summary = state.summary;
  const lines: string[] = [t('arena.end.ticks', { ticks: state.tick })];
  if (summary) {
    lines.push(t('arena.end.cause', { cause: summary.deathCause?.kind ?? t('arena.end.noCause') }));
    lines.push(
      t('arena.end.damageDealt', { value: (summary.stats.damageDealtTenths / 10).toFixed(1) }),
    );
    lines.push(
      t('arena.end.damageTaken', { value: (summary.stats.damageTakenTenths / 10).toFixed(1) }),
    );
    lines.push(t('arena.end.shots', { value: summary.stats.shotsFired }));
  } else {
    // Vitoria contra o chefe nao encerra `state.phase` (ver arena-outcome.ts),
    // entao nao ha RunSummary — so o que a propria arena sabe medir.
    lines.push(
      t('arena.end.damageDealt', { value: (state.stats.damageDealtTenths / 10).toFixed(1) }),
    );
    lines.push(
      t('arena.end.damageTaken', { value: (state.stats.damageTakenTenths / 10).toFixed(1) }),
    );
    lines.push(t('arena.end.shots', { value: state.stats.shotsFired }));
  }
  endSummary.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  endOverlay.classList.remove('hidden');
};

// A arena inteira fala UMA lingua: a do HUD. Os textos estaticos vem por
// `data-i18n` (escopo no corpo, para nao reescrever o titulo da aba), e o que
// e montado em codigo — o interruptor, a tela de fim — e refeito aqui.
const applyArenaLocale = (): void => {
  applyStaticTranslations(document.body);
  applyToolsHidden(document.body.classList.contains('tools-hidden'));
  if (lastEnd && !endOverlay.classList.contains('hidden')) showEnd(lastEnd.outcome, lastEnd.state);
  for (const select of [bossBarLocale, galleryLocale, setupLocale]) select.value = getLocale();
};
applyArenaLocale();
onLocaleChange(applyArenaLocale);

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
  // A SEED ATIVA TAMBEM DURANTE A LUTA. O mostrador do seletor some quando o
  // jogo comeca, e e justamente no meio da luta que alguem pergunta "que camara
  // e essa?". Uma ferramenta de medicao que esconde a camara produz conversa
  // sobre "aquela partida" sem ninguem saber qual partida era.
  hudNote.textContent =
    `Arena de teste — sem telemetria, sem placar, sem gravação de replay. ` +
    `Câmara: seed ${resolveArenaSeed(conditions.boss, conditions.seed ?? ARENA_CATALOG[conditions.boss].seed)}.`;
  hudNote.classList.remove('hidden');
  toolsToggle.classList.remove('hidden');
  // O censo so faz sentido onde ha gelo. Nos outros chefes o painel seria cinco
  // zeros permanentes tapando um canto da tela.
  icePanel.classList.toggle('hidden', conditions.boss !== 'frost_queen');
  frostPanel.classList.toggle('hidden', conditions.boss !== 'frost_queen');
  leviathanPanel.classList.toggle('hidden', conditions.boss !== 'sheet_leviathan');
  diamandisPanel.classList.toggle('hidden', conditions.boss !== 'diamandis');
  devourerPanel.classList.toggle('hidden', conditions.boss !== 'white_devourer');
  bossBarPanel.classList.remove('hidden');
  bossBarDriver.reset();
  bossBarReadoutAt = -1;
  icePanelAt = -1;
  frostReadoutAt = -1;
  leviathanReadoutAt = -1;
  diamandisReadoutAt = -1;
  devourerReadoutAt = -1;
  resetDevourerReadout();
  resize();

  const state: SurvivalState = createArenaRun(conditions);
  suturePaused = false;
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
    accumulator += suturePaused ? 0 : delta;
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

    if (suturePaused) playout.capture(state);
    while (!suturePaused && accumulator >= TICK_MS) {
      const raw = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        raw.choose = queuedChoice;
        queuedChoice = null;
      }
      applyCombatAssist(state, raw, input.consumeAimTap(), assistMemory);
      // O parceiro de apresentacao nao recebe comando: fica onde nasceu.
      const result = stepRun(state, conditions.coop ? [raw, emptyCommand()] : [raw]);
      if (frostFastDecay.checked && conditions.boss === 'frost_queen') applyFastDecay(state);
      // A rajada da barra de chefe: um golpe por tick, pelo funil de dano, com
      // os eventos na MESMA leva do tick — a barra os ve no tick apresentado.
      result.events.push(...bossBarDriver.tick(state));
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
    if (conditions.boss === 'diamandis') updateDiamandisPanel(state, now);
    if (conditions.boss === 'white_devourer') updateDevourerPanel(state, now);
    updateBossBarPanel(state, now);
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
  toolsToggle.classList.add('hidden');
  icePanel.classList.add('hidden');
  frostPanel.classList.add('hidden');
  leviathanPanel.classList.add('hidden');
  diamandisPanel.classList.add('hidden');
  devourerPanel.classList.add('hidden');
  bossBarPanel.classList.add('hidden');
  activeFrostState = null;
  activeFrostEvents = null;
  endOverlay.classList.add('hidden');
  setupEl.classList.remove('hidden');
});
