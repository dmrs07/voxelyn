import {
  ACHIEVEMENT_TEXT,
  GEAR_TEXT,
  HACK_TICKS,
  HOURS_PER_TICK,
  BUILD_REPAIR_COST,
  JUDGES,
  SOCIAL_TEXT,
  SOCIAL_WINDOW,
  SPECIAL_TEXT,
  SPONSOR_TEXT,
  TREATS_START,
  fmtCost,
  vibeOf,
  workable,
  type Candidate,
  type GearId,
} from '../sim/index.js';
import { getLocale, setLocale, specLabel, t, tierLabel, traitLabel } from './i18n.js';
import type { RunClose } from './career.js';

/** Alias do dicionario para escopos onde `t` e uma Task. */
const i18n = t;
import type { Cat } from '../sim/types.js';
import { applyItemSprite, type ItemSpriteId } from './atlas.js';
import { ganttEntries, resetGanttLog, sampleGantt, type GanttEntry } from './ganttlog.js';
import type { CatId, HackState, SimEvent, SpecialCategoryId, SponsorContract, Task } from '../sim/types.js';

/**
 * O HUD e HTML, nao pixels — a regra de acessibilidade da casa: botao com
 * PALAVRA escrita (a licao dos icones ilegiveis), foco de teclado e leitor de
 * tela de graca. O canvas fica com o que tem posicao no mundo; o resto e DOM.
 */

/**
 * Icones FOFOS em SVG desenhado a mao, herdando a cor do botao.
 *
 * A licao da Iliada vale aqui dobrada: icone sozinho nao ensina (nao ha hover
 * num dedo), entao TODO botao leva icone + PALAVRA. E SVG e nao emoji porque a
 * plataforma pinta emoji com a paleta dela — um peixinho azul brilhante no
 * meio do creme-e-laranja do pavilhao seria o escudo azul da Iliada de novo.
 */
const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ` +
  `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  /** O peixinho do petisco: corpo, rabinho, olho feliz. */
  fish: svg('<path d="M4 12c3-4 8-5 12-2 2 1.5 2 4.5 0 6-4 3-9 2-12-2z"/><path d="M16 9l4-3-1 6 1 6-4-3"/><circle cx="8" cy="11" r="0.6" fill="currentColor"/>'),
  /** O quadro de tarefas: prancheta com post-its. */
  board: svg('<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 2.5h6v3H9z"/><path d="M7.5 10h4"/><path d="M7.5 14h6"/><path d="M7.5 18h3"/><circle cx="16.5" cy="10" r="1.1"/>'),
  /** Som: uma orelhinha de gato ouvindo uma nota. */
  sound: svg('<path d="M5 14V7l4-4 3 6v5a3.5 3.5 0 11-7 0z"/><path d="M16 6v9"/><circle cx="14.2" cy="15.8" r="1.8"/><path d="M16 6l3 1.5"/>'),
  /** Cortar escopo: tesourinha. */
  scissors: svg('<circle cx="6" cy="7" r="2.4"/><circle cx="6" cy="17" r="2.4"/><path d="M8.2 8.4L19 17"/><path d="M8.2 15.6L19 7"/>'),
  /** A credencial do hackathon: comecar e pendurar o cracha. */
  badge: svg('<rect x="7" y="8" width="10" height="13" rx="2"/><path d="M12 8V5"/><path d="M8 3h8l-1.5 2h-5z"/><path d="M9.5 13h5"/><path d="M9.5 16.5h3.5"/>'),
  /** Jogar de novo: a seta que volta. */
  again: svg('<path d="M5 12a7 7 0 1 1 2 5"/><path d="M5 17v-5h5"/>'),
  /** Catnip: a folhinha com talo. */
  leaf: svg('<path d="M12 21c-5-2-7-6-7-11 5 0 9 2 11 7-1 2-2 3-4 4z"/><path d="M12 21C12 14 9 9 5 6"/><path d="M12 10V3"/>'),
  /** Laser: o ponto e o feixe — o unico botao que mira o chao. */
  laser: svg('<circle cx="7" cy="17" r="2.5"/><path d="M9.5 14.5L20 4"/><path d="M16 4h4v4"/>'),
} as const;

/**
 * Um botao MACIO: cantos generosos, gradiente quente, e fisica de apertar
 * (afunda e perde a sombra). A fofura mora na TEXTURA e no gesto — nunca em
 * formato de pata ou orelha: botao fantasiado de gato e caricatura, e a
 * direcao do jogo inteiro e "gatos produtivos a meia-noite", nao desenho
 * animado. Icone + PALAVRA sempre: num dedo nao existe hover.
 */
const softButton = (icon: string, word: string, className = ''): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `soft-btn ${className}`.trim();
  const ic = document.createElement('span');
  ic.className = 'btn-icon';
  ic.innerHTML = icon;
  ic.setAttribute('aria-hidden', 'true');
  const w = document.createElement('span');
  w.className = 'btn-word';
  w.textContent = word;
  b.append(ic, w);
  return b;
};

/**
 * Um SLOT de item, com apelo de inventario de Minecraft: moldura quadrada
 * com bisel fundo, O OBJETO em pixel art recortado do atlas, a contagem no
 * canto e a palavra em letra miuda embaixo (a regra da casa: sem hover num
 * dedo, todo botao carrega palavra).
 */
const itemSlot = (sprite: ItemSpriteId, word: string): HTMLButtonElement => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'item-slot';
  const frame = el('span', 'slot-frame');
  const spr = el('span', 'slot-sprite');
  spr.setAttribute('aria-hidden', 'true');
  applyItemSprite(spr, sprite, 3);
  frame.append(spr, el('span', 'btn-badge', ''));
  b.append(frame, el('span', 'slot-word', word));
  return b;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

type TaskRow = {
  row: HTMLElement;
  state: HTMLElement;
  bar: HTMLElement;
  fill: HTMLElement;
  cutBtn: HTMLButtonElement;
  /** Botoes de DECISAO (so em tarefas com escolha), criados uma vez. */
  choices: HTMLElement | null;
};

type Meter = { row: HTMLElement; fill: HTMLElement };

export type Hud = {
  root: HTMLElement;
  clock: HTMLElement;
  remain: HTMLElement;
  build: HTMLElement;
  proj: HTMLElement;
  bugsChip: HTMLButtonElement;
  decideChip: HTMLButtonElement;
  alarm: HTMLElement;
  treatsBtn: HTMLButtonElement;
  board: HTMLElement;
  /** O feed virou FAIXA unica + painel expansivel: tres logs empilhados
   * cobriam o canto de descanso inteiro. */
  feedStrip: HTMLButtonElement;
  feedLatest: HTMLElement;
  feedBadge: HTMLElement;
  feedPanel: HTMLElement;
  /** A FICHA COMPACTA no rodape: nunca cobre o gato nem a estacao dele. */
  dock: HTMLElement;
  dockName: HTMLElement;
  dockNow: HTMLElement;
  dockMeters: Record<'energia' | 'estresse' | 'moral', Meter>;
  dockDetails: HTMLElement;
  dockBio: HTMLElement;
  dockHunger: Meter;
  /** CONVIVENCIA: com quem este gato vibra e com quem ele bufa — visivel
   * so depois da revelacao (o comportamento voce ja via; o nome, so agora). */
  dockVibes: HTMLElement;
  /** Retratos da equipe na borda esquerda: selecao sem cacar pixel. */
  teamBtns: Map<CatId, HTMLButtonElement>;
  /** O palco: gauge da plateia, timer e uma habilidade por gato. */
  pitchPanel: HTMLElement;
  pitchGauge: HTMLElement;
  pitchTimer: HTMLElement;
  pitchCrisis: HTMLElement;
  pitchBtns: Map<CatId, HTMLButtonElement>;
  /**
   * Linhas do quadro, criadas UMA vez e atualizadas no lugar. A primeira
   * versao reconstruia o quadro a cada frame — e um botao recriado 60x por
   * segundo esta sempre "detached" entre o touchstart e o click: o dedo
   * tocava "cortar" e nada acontecia. Botao que existe fica existindo.
   */
  rows: Map<string, TaskRow>;
  /**
   * O GANTT REAL dentro do Kanban: 48h de vao, uma raia por gato, e os
   * segmentos vao preenchendo conforme cada um trabalha — cor por trilha,
   * duracao no tooltip. Derivado por AMOSTRAGEM do estado a cada frame:
   * display puro, nada disso entra na simulacao nem no hash.
   */
  ganttLanes: Map<CatId, HTMLElement>;
  ganttNow: Map<CatId, HTMLElement>;
  ganttSegs: Map<CatId, HTMLElement[]>;
  /** Containers que bindTeam preenche a cada run. */
  teamBar: HTMLElement;
  abilityRow: HTMLElement;
  /** Consumiveis: aparecem na barra so quando ha doses. */
  catnipBtn: HTMLButtonElement;
  laserBtn: HTMLButtonElement;
  /** O modal do evento social: titulo, A/B e a barra do prazo. */
  socialModal: HTMLElement;
  socialTitle: HTMLElement;
  socialA: HTMLButtonElement;
  socialB: HTMLButtonElement;
  socialTimer: HTMLElement;
  socialKind: { current: string | null };
  onCut: (taskId: string) => void;
  onFeedToggle: () => void;
  onChoose: (task: string, option: string) => void;
  onSelect: (cat: CatId) => void;
  onAbility: (cat: CatId) => void;
};

export const createHud = (
  host: HTMLElement,
  handlers: {
    onCut: (taskId: string) => void;
    onFeedToggle: () => void;
    /** Controle por barramento (direcao §14): musica, efeitos, teclados, ambiente, gatos. */
    onLevel: (bus: string, level01: number) => void;
    levels: () => Record<string, number>;
    onSelect: (cat: CatId) => void;
    onChoose: (task: string, option: string) => void;
    onAbility: (cat: CatId) => void;
    onCatnipToggle: () => void;
    onLaser: () => void;
    onSocial: (option: 'a' | 'b') => void;
  }
): Hud => {
  const root = el('div', 'hud');

  /**
   * O topo e so INFORMACAO, em chips com hierarquia: prazo primeiro (e o
   * unico numero que decide tudo), depois build, projeto e bugs — que so
   * aparecem quando existem e mudam de peso quando aparecem. "features 0/12"
   * numa frase minuscula era telemetria de debug, nao HUD.
   */
  const top = el('div', 'hud-top');
  const clock = el('div', 'hud-chip hud-clock', 'DIA 1 · SEX · 18:00');
  const remain = el('div', 'hud-chip hud-remain', '48h00 restantes');
  const build = el('div', 'hud-chip hud-build', 'BUILD OK');
  const proj = el('div', 'hud-chip hud-proj', '0/12');
  // O chip de bug e CLICAVEL: toca-lo abre o projeto, onde a trilha travada
  // esta a vista. Alerta que nao leva a lugar nenhum e decoracao.
  const bugsChip = document.createElement('button');
  bugsChip.type = 'button';
  bugsChip.className = 'hud-chip hud-bugs';
  bugsChip.hidden = true;
  // DECISAO aberta e alarme com destino: o chip pisca enquanto os devs se
  // juntam no quadro, e toca-lo abre o projeto onde a escolha mora.
  const decideChip = document.createElement('button');
  decideChip.type = 'button';
  decideChip.className = 'hud-chip hud-decide';
  decideChip.hidden = true;
  const alarm = el('div', 'hud-chip hud-alarm-chip', '');
  alarm.hidden = true;
  // O petisco e um ITEM: slot quadrado com o peixinho do atlas e a contagem
  // no canto — inventario com cara de inventario.
  const treatsBtn = itemSlot('petisco', t().btnTreat);
  treatsBtn.querySelector('.btn-badge')!.textContent = `×${TREATS_START}`;
  treatsBtn.addEventListener('click', handlers.onFeedToggle);
  // O projeto e um PAINEL ABERTO POR BOTAO, nao um movel permanente — e o
  // botao mora NO TOPO, junto dos chips de estado: abrir o quadro e leitura
  // de projeto, nao uso de item; embaixo ficou so o inventario.
  const boardBtn = document.createElement('button');
  boardBtn.type = 'button';
  boardBtn.className = 'proj-btn';
  boardBtn.innerHTML = `<span class="btn-icon" aria-hidden="true">${ICONS.board}</span><span>${t().btnProject}</span>`;
  top.append(clock, remain, build, proj, boardBtn, bugsChip, decideChip, alarm);
  // Embaixo, a HOTBAR: so os itens, cada um no seu slot.
  const cluster = el('div', 'action-bar');
  const groupItems = el('div', 'action-group');

  const board = el('div', 'hud-board');
  board.hidden = true;

  boardBtn.addEventListener('click', () => {
    board.hidden = !board.hidden;
  });
  bugsChip.addEventListener('click', () => {
    board.hidden = false;
  });
  decideChip.addEventListener('click', () => {
    board.hidden = false;
  });

  // O FEED virou uma faixa unica: a ultima noticia + um contador. Tres logs
  // empilhados cobriam o canto de descanso inteiro. O historico mora num
  // painel que abre por toque e fecha por toque.
  const feedStrip = document.createElement('button');
  feedStrip.type = 'button';
  feedStrip.className = 'feed-strip';
  const feedLatest = el('span', 'feed-latest', t().welcome);
  const feedBadge = el('span', 'feed-badge', '0');
  feedStrip.append(feedLatest, feedBadge);
  const feedPanel = el('div', 'feed-panel');
  feedPanel.hidden = true;
  feedPanel.setAttribute('role', 'log');
  feedPanel.setAttribute('aria-live', 'polite');
  feedStrip.addEventListener('click', () => {
    feedPanel.hidden = !feedPanel.hidden;
  });

  // A FICHA COMPACTA: ancorada no rodape esquerdo, ACIMA da faixa de feed —
  // nunca sobre o gato selecionado nem sobre a estacao dele. A ficha grande
  // (bio + fome) abre por "detalhes", nao por padrao.
  const dock = el('div', 'cat-dock');
  dock.hidden = true;
  const dockHead = el('div', 'dock-head');
  const dockName = el('span', 'dock-name', '');
  const detailsBtn = document.createElement('button');
  detailsBtn.type = 'button';
  detailsBtn.className = 'dock-details-btn';
  detailsBtn.textContent = t().btnDetails;
  dockHead.append(dockName, detailsBtn);
  const dockNow = el('div', 'dock-now', '');
  const meterOf = (label: string, cls: string): Meter => {
    const rowEl = el('div', 'dock-meter');
    rowEl.appendChild(el('span', 'dock-meter-label', label));
    const bar = el('span', `dock-bar ${cls}`);
    const fill = el('span', 'dock-fill');
    bar.appendChild(fill);
    rowEl.appendChild(bar);
    return { row: rowEl, fill };
  };
  const dockMeters = {
    energia: meterOf(t().meters.energy, 'bar-energy'),
    estresse: meterOf(t().meters.stress, 'bar-stress'),
    moral: meterOf(t().meters.morale, 'bar-moral'),
  };
  const dockDetails = el('div', 'dock-details');
  dockDetails.hidden = true;
  const dockBio = el('div', 'dock-bio', '');
  const dockHunger = meterOf(t().meters.hunger, 'bar-hunger');
  const dockVibes = el('div', 'dock-vibes', '');
  dockVibes.hidden = true;
  dockDetails.append(dockBio, dockHunger.row, dockVibes);
  detailsBtn.addEventListener('click', () => {
    dockDetails.hidden = !dockDetails.hidden;
  });
  dock.append(dockHead, dockNow, dockMeters.energia.row, dockMeters.estresse.row, dockMeters.moral.row, dockDetails);

  // A BARRA DA EQUIPE e as HABILIDADES de palco: containers vazios aqui —
  // o time agora e GERADO por run, e bindTeam preenche a cada recrutamento.
  const teamBar = el('div', 'team-bar');
  const teamBtns = new Map<CatId, HTMLButtonElement>();

  const pitchPanel = el('div', 'pitch-panel');
  pitchPanel.hidden = true;
  pitchPanel.appendChild(el('div', 'pitch-title', t().pitchTitle));
  const gaugeBar = el('div', 'pitch-gauge-bar');
  const pitchGauge = el('span', 'pitch-gauge-fill');
  gaugeBar.appendChild(pitchGauge);
  const pitchTimer = el('div', 'pitch-timer', '');
  const pitchCrisis = el('div', 'pitch-crisis', t().pitchCrisis);
  pitchCrisis.hidden = true;
  const abilityRow = el('div', 'pitch-abilities');
  const pitchBtns = new Map<CatId, HTMLButtonElement>();
  pitchPanel.append(gaugeBar, pitchTimer, pitchCrisis, abilityRow);

  // O PAINEL DE SOM: cinco faixas independentes, com palavra, atras de botao.
  // "Jogar horas sem fadiga auditiva" comeca em poder abaixar exatamente o que
  // cansa — e um controle por barramento e acessibilidade, nao luxo. O botao
  // mora no CANTO de configuracoes (topo direito), fora das acoes de jogo:
  // "som" nao e um verbo da partida.
  const soundBtn = softButton(ICONS.sound, t().btnSound, 'dim som-corner');
  const soundPanel = el('div', 'hud-sound');
  soundPanel.hidden = true;
  const BUS_LABEL: Record<string, string> = t().buses;
  for (const bus of Object.keys(BUS_LABEL)) {
    const rowEl = el('label', 'sound-row');
    rowEl.appendChild(el('span', 'sound-label', BUS_LABEL[bus]));
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round((handlers.levels()[bus] ?? 1) * 100));
    slider.setAttribute('aria-label', `volume de ${BUS_LABEL[bus]}`);
    slider.addEventListener('input', () => handlers.onLevel(bus, Number(slider.value) / 100));
    rowEl.appendChild(slider);
    soundPanel.appendChild(rowEl);
  }
  soundBtn.addEventListener('click', () => {
    soundPanel.hidden = !soundPanel.hidden;
  });
  // Consumiveis: catnip arma (proximo toque num gato dosa), laser dispara.
  // Escondidos ate existirem doses — slot vazio e ruido. Cada um renderiza
  // O OBJETO recortado do mesmo atlas da lojinha.
  const catnipBtn = itemSlot('catnip', t().btnCatnip);
  catnipBtn.hidden = true;
  catnipBtn.addEventListener('click', handlers.onCatnipToggle);
  const laserBtn = itemSlot('laser-pointer', t().btnLaser);
  laserBtn.hidden = true;
  laserBtn.addEventListener('click', handlers.onLaser);
  groupItems.append(catnipBtn, laserBtn, treatsBtn);
  cluster.append(groupItems);

  // O EVENTO SOCIAL: um modal curto com prazo VISIVEL. B e a opcao segura e
  // o default do prazo — o modal informa, nunca chantageia.
  const socialModal = el('div', 'social-modal');
  socialModal.hidden = true;
  const socialTitle = el('div', 'social-title', '');
  const socialA = document.createElement('button');
  socialA.type = 'button';
  socialA.className = 'task-choice social-a';
  socialA.addEventListener('click', () => handlers.onSocial('a'));
  const socialB = document.createElement('button');
  socialB.type = 'button';
  socialB.className = 'task-choice social-b';
  socialB.addEventListener('click', () => handlers.onSocial('b'));
  const socialTimerBar = el('div', 'social-timer-bar');
  const socialTimer = el('span', 'social-timer-fill');
  socialTimerBar.appendChild(socialTimer);
  socialModal.append(socialTitle, socialA, socialB, socialTimerBar);

  root.append(top, soundBtn, teamBar, cluster, board, soundPanel, dock, feedStrip, feedPanel, pitchPanel, socialModal);
  host.appendChild(root);

  const hudRef: Hud = {
    root,
    clock,
    remain,
    build,
    proj,
    bugsChip,
    decideChip,
    alarm,
    treatsBtn,
    board,
    feedStrip,
    feedLatest,
    feedBadge,
    feedPanel,
    dock,
    dockName,
    dockNow,
    dockMeters,
    dockDetails,
    dockBio,
    dockHunger,
    dockVibes,
    teamBtns,
    pitchPanel,
    pitchGauge,
    pitchTimer,
    pitchCrisis,
    pitchBtns,
    rows: new Map(),
    ganttLanes: new Map(),
    ganttNow: new Map(),
    ganttSegs: new Map(),
    teamBar,
    abilityRow,
    catnipBtn,
    laserBtn,
    socialModal,
    socialTitle,
    socialA,
    socialB,
    socialTimer,
    socialKind: { current: null },
    ...handlers,
  };
  return hudRef;
};

const CSS_HEX = (v: number): string => `#${v.toString(16).padStart(6, '0')}`;

/**
 * Constroi retratos e habilidades para O TIME DESTA RUN. Chamado a cada
 * recrutamento; o quadro de tarefas tambem renasce (o projeto mudou).
 */
export const bindTeam = (hud: Hud, cats: readonly Cat[]): void => {
  hud.teamBar.replaceChildren();
  hud.teamBtns.clear();
  hud.abilityRow.replaceChildren();
  hud.pitchBtns.clear();
  hud.rows.clear();
  hud.ganttLanes.clear();
  hud.ganttNow.clear();
  hud.ganttSegs.clear();
  resetGanttLog();
  hud.board.replaceChildren();
  hud.feedPanel.replaceChildren();
  for (const c of cats) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'team-btn';
    const sw = el('span', 'team-swatch');
    sw.style.background = CSS_HEX(c.coat.body);
    b.append(sw, el('span', 'team-name', c.name.toLowerCase()));
    b.addEventListener('click', () => hud.onSelect(c.id));
    hud.teamBtns.set(c.id, b);
    hud.teamBar.appendChild(b);

    const pb = document.createElement('button');
    pb.type = 'button';
    pb.className = 'soft-btn pitch-ability';
    const psw = el('span', 'team-swatch');
    psw.style.background = CSS_HEX(c.coat.body);
    pb.append(psw, el('span', 'btn-word', `${c.name.toLowerCase()}: ${t().abilityWord[c.personality]}`));
    pb.addEventListener('click', () => hud.onAbility(c.id));
    hud.pitchBtns.set(c.id, pb);
    hud.abilityRow.appendChild(pb);
  }
};

const TRACK_LABEL: Record<string, string> = {
  backend: 'backend',
  frontend: 'frontend',
  design: 'design',
  devops: 'devops',
};

const clockText = (tick: number): string => {
  const hours = 18 + tick * HOURS_PER_TICK;
  const dayIdx = Math.min(2, Math.floor(hours / 24));
  const day = t().weekdays[dayIdx];
  const hh = Math.floor(hours % 24);
  const mm = Math.floor((hours % 1) * 60);
  return `${t().day} ${dayIdx + 1} · ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const remainText = (tick: number): string => {
  const left = Math.max(0, (HACK_TICKS - tick) * HOURS_PER_TICK);
  const hh = Math.floor(left);
  const mm = Math.floor((left % 1) * 60);
  return t().left(hh, String(mm).padStart(2, '0'));
};

const makeRow = (t: Task, onCut: (id: string) => void, onChoose: (task: string, option: string) => void): TaskRow => {
  const row = el('div', `task track-${t.track}`);
  row.appendChild(el('span', 'task-name', t.label + (t.polish ? ' ✦' : '')));
  const state = el('span', 'task-state', '');
  const bar = el('span', 'task-bar');
  const fill = el('span', 'task-fill');
  bar.appendChild(fill);
  const cutBtn = document.createElement('button');
  cutBtn.type = 'button';
  cutBtn.className = 'task-cut';
  cutBtn.innerHTML = `<span class="btn-icon" aria-hidden="true">${ICONS.scissors}</span><span>${i18n().btnCut}</span>`;
  cutBtn.title = i18n().cutHint;
  cutBtn.addEventListener('click', () => onCut(t.id));
  row.append(state, bar, cutBtn);
  // A DECISAO mora no proprio quadro: tres opcoes com palavra e dica, criadas
  // uma vez (a licao dos botoes detached vale dobrado para decisoes).
  let choices: HTMLElement | null = null;
  if (t.choice) {
    choices = el('div', 'task-choices');
    choices.appendChild(el('div', 'task-choice-prompt', t.choice.prompt));
    for (const opt of t.choice.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'task-choice';
      b.textContent = opt.label;
      b.title = opt.hint;
      b.appendChild(el('span', 'task-choice-hint', opt.hint));
      b.addEventListener('click', () => onChoose(t.id, opt.id));
      choices.appendChild(b);
    }
    row.appendChild(choices);
  }
  return { row, state, bar, fill, cutBtn, choices };
};

const updateRow = (state: HackState, t: Task, r: TaskRow): void => {
  r.row.className = `task track-${t.track} ${t.done ? 'done' : ''} ${t.cut ? 'cut' : ''} ${t.awaitingShip ? 'await' : ''}`;
  const depsPending = t.deps.filter((d) => !state.tasks.find((x) => x.id === d)?.done);
  const locked = depsPending.length > 0 && !t.done && !t.cut;

  const deciding = !!t.choice && t.chosen === null && !t.done && !t.cut;
  if (r.choices) r.choices.style.display = deciding ? '' : 'none';

  let text = '';
  let blink = false;
  if (t.done) text = i18n().taskShipped;
  else if (t.cut) text = i18n().taskCut;
  else if (deciding) {
    text = i18n().taskDeciding;
    blink = true;
  } else if (t.awaitingShip) {
    text = i18n().taskAwaitShip;
    blink = true;
  } else if (locked) {
    text = i18n().taskWaits(depsPending.map((d) => state.tasks.find((x) => x.id === d)?.label ?? d).join(', '));
  }
  if (r.state.textContent !== text) r.state.textContent = text;
  r.state.className = `task-state ${blink ? 'task-blink' : ''}`;
  r.state.style.display = text ? '' : 'none';

  const showBar = !t.done && !t.cut && !t.awaitingShip && !locked && !deciding;
  r.bar.style.display = showBar ? '' : 'none';
  const progress = t.done ? 100 : t.cut ? 0 : Math.round((t.progress / t.cost) * 100);
  r.fill.style.width = `${progress}%`;
  r.row.style.setProperty('--task-progress', `${progress}%`);

  r.cutBtn.style.display = t.done || t.cut ? 'none' : '';
};

/**
 * Sincroniza o DOM do gantt com o LOG compartilhado (ganttlog.ts): um
 * elemento por trecho, o ultimo esticando a cada frame. A amostragem em si
 * mora no log — o quadro fisico do pavilhao desenha da mesma fonte.
 */
const segClass = (e: GanttEntry): string =>
  e.kind === 'task' ? `track-${e.track}` : e.kind === 'bug' ? 'seg-bug' : 'seg-fix';

const updateGantt = (state: HackState, hud: Hud): void => {
  sampleGantt(state);
  for (const cat of state.cats) {
    const lane = hud.ganttLanes.get(cat.id);
    if (!lane) continue;
    const nowline = hud.ganttNow.get(cat.id)!;
    const nowLeft = `${Math.min(100, (state.tick / HACK_TICKS) * 100).toFixed(2)}%`;
    if (nowline.style.left !== nowLeft) nowline.style.left = nowLeft;
    const entries = ganttEntries(cat.id);
    if (entries.length === 0) continue;
    const els = hud.ganttSegs.get(cat.id)!;
    while (els.length < entries.length) {
      const entry = entries[els.length]!;
      const node = el('span', `gantt-seg ${segClass(entry)}`);
      node.style.left = `${((entry.start / HACK_TICKS) * 100).toFixed(2)}%`;
      lane.appendChild(node);
      els.push(node);
    }
    const last = entries[entries.length - 1]!;
    const node = els[entries.length - 1]!;
    node.style.width = `${Math.max(0.4, ((last.end - last.start) / HACK_TICKS) * 100).toFixed(2)}%`;
    const hours = (last.end - last.start) * HOURS_PER_TICK;
    const title = `${last.label} · ${Math.floor(hours)}h${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`;
    if (node.title !== title) node.title = title;
  }
};

const EVENT_TEXT = (state: HackState, e: SimEvent): string | null => {
  const name = (id: string): string => state.cats.find((c) => c.id === id)?.name ?? id;
  const d = t();
  switch (e.kind) {
    case 'ship':
      return d.ev.ship(name(e.by), e.task);
    case 'await-ship':
      return d.ev.awaitShip(name(e.by), e.task);
    case 'shortcut':
      return d.ev.shortcut(name(e.by), e.task);
    case 'bug':
      return e.cause === 'teclado' ? d.ev.bugKeyboard(name(e.by), e.track) : d.ev.bugUntested(name(e.by), e.track);
    case 'bugfix':
      return d.ev.bugfix(e.track);
    case 'zoomies':
      return d.ev.zoomies(name(e.cat));
    case 'cable':
      return d.ev.cable(name(e.by));
    case 'cable-fixed':
      return d.ev.cableFixed;
    case 'nap':
      return d.ev.nap(name(e.cat));
    case 'eat':
      return d.ev.eat(name(e.cat));
    case 'hairball':
      return d.ev.hairball;
    case 'hairball-fixed':
      return d.ev.hairballFixed;
    case 'build-broken':
      return d.ev.buildBroken;
    case 'build-fixed':
      return d.ev.buildFixed;
    case 'treat':
      return d.ev.treat(name(e.cat));
    case 'cut':
      return d.ev.cut(e.task);
    case 'overpet':
      return d.ev.overpet(name(e.cat));
    case 'decision-needed':
      return d.ev.decisionNeeded(e.task);
    case 'decision':
      return d.ev.decision(e.option);
    case 'pep':
      // A variedade e deterministica: o tick escolhe a fala.
      return d.ev.pep(name(e.cat), e.tick % 3);
    case 'pm-worry':
      return d.ev.pmWorry(e.behind, e.tick % 3);
    case 'pitch-start':
      return d.ev.pitchStart;
    case 'demo-glitch':
      return d.ev.demoGlitch;
    case 'improviso':
      return d.ev.improviso(name(e.cat));
    case 'trait-revealed':
      return d.ev.traitRevealed(name(e.cat), traitLabel(e.trait));
    case 'sponsor-outage':
      return d.ev.sponsorOutage;
    case 'harmony':
      return d.ev.harmony(name(e.a), name(e.b));
    case 'friction':
      return d.ev.friction(name(e.a), name(e.b));
    case 'fight':
      return d.ev.fight(name(e.a), name(e.b));
    case 'fight-separated':
      return d.ev.fightSeparated(name(e.a), name(e.b));
    case 'mentor':
      return d.ev.mentor(name(e.mentor), name(e.junior));
    case 'grown':
      return d.ev.grown(name(e.cat));
    default:
      return null;
  }
};

const setText = (node: HTMLElement, value: string): void => {
  if (node.textContent !== value) node.textContent = value;
};

export const drawHud = (hud: Hud, state: HackState): void => {
  setText(hud.clock, clockText(state.tick));
  setText(hud.remain, remainText(state.tick));
  const shipped = state.tasks.filter((t) => t.done).length;
  const bugs = state.bugs.filter((b) => !b.fixed).length;

  // Build com cor de estado; bugs so existem no HUD quando existem no jogo,
  // e chegam ja com peso de alarme — nao como rodape de frase.
  const buildState = state.buildBroken
    ? `${t().buildDead} · ${Math.min(100, Math.round((state.buildProgress / BUILD_REPAIR_COST) * 100))}%`
    : state.cableOut ? t().buildDown : t().buildOk;
  setText(hud.build, buildState);
  hud.build.classList.toggle('chip-bad', state.buildBroken || state.cableOut);
  setText(hud.proj, t().features(shipped));
  hud.bugsChip.hidden = bugs === 0;
  if (bugs > 0) setText(hud.bugsChip, t().bugs(bugs));
  // Decisao aberta em tarefa DESBLOQUEADA: o alerta so grita quando a
  // escolha ja esta travando alguem de verdade.
  const decisions = state.tasks.filter(
    (task) => !task.done && !task.cut && !!task.choice && task.chosen === null && workable(state, task)
  ).length;
  hud.decideChip.hidden = decisions === 0;
  if (decisions > 0) setText(hud.decideChip, t().decisions(decisions));
  hud.alarm.hidden = !state.hairball.active;
  if (state.hairball.active) setText(hud.alarm, t().mergeLocked);

  // O numero vive na badge: acao e inventario separados no mesmo botao.
  const badge = hud.treatsBtn.querySelector('.btn-badge');
  if (badge && badge.textContent !== `×${state.treats}`) badge.textContent = `×${state.treats}`;
  hud.treatsBtn.disabled = state.treats <= 0;

  if (hud.rows.size === 0) {
    for (const track of ['backend', 'frontend', 'design', 'devops'] as const) {
      const group = el('div', 'board-track');
      group.appendChild(el('div', 'board-title', TRACK_LABEL[track]));
      for (const t of state.tasks.filter((x) => x.track === track)) {
        const r = makeRow(t, hud.onCut, hud.onChoose);
        hud.rows.set(t.id, r);
        group.appendChild(r.row);
      }
      hud.board.appendChild(group);
    }
    // O GANTT mora NO Kanban, nao numa vista paralela: mesmo painel, mesma
    // paleta. O vao e o hackathon inteiro (48h) com guias a cada 12h; cada
    // gato tem a sua raia e os segmentos nascem do que ele REALMENTE fez.
    const gsec = el('div', 'board-gantt');
    const ghead = el('div', 'gantt-row gantt-head');
    ghead.appendChild(el('span', 'board-title', 'gantt'));
    const scale = el('span', 'gantt-scale');
    for (const h of [0, 12, 24, 36, 48]) scale.appendChild(el('span', '', `${h}h`));
    ghead.appendChild(scale);
    gsec.appendChild(ghead);
    for (const c of state.cats) {
      const row = el('div', 'gantt-row');
      row.appendChild(el('span', 'gantt-cat', c.name.toLowerCase()));
      const lane = el('div', 'gantt-lane');
      const nowline = el('span', 'gantt-nowline');
      lane.appendChild(nowline);
      hud.ganttLanes.set(c.id, lane);
      hud.ganttNow.set(c.id, nowline);
      hud.ganttSegs.set(c.id, []);
      row.appendChild(lane);
      gsec.appendChild(row);
    }
    hud.board.appendChild(gsec);
  }
  for (const t of state.tasks) {
    const r = hud.rows.get(t.id);
    if (r) updateRow(state, t, r);
  }
  updateGantt(state, hud);

  // Aneis de estado nos retratos da equipe: quem trabalha, quem dorme, quem
  // esta na zona de perigo — legivel sem abrir ficha nenhuma.
  for (const cat of state.cats) {
    const btn = hud.teamBtns.get(cat.id);
    if (!btn) continue;
    const danger = cat.stress > 0.72;
    const cls = `team-btn ${danger ? 'ring-danger' : cat.mode === 'work' ? 'ring-work' : cat.mode === 'nap' ? 'ring-nap' : ''}`;
    if (btn.className !== cls.trim()) btn.className = cls.trim();
  }

  // Consumiveis na barra: visiveis enquanto houver doses, com o estoque na
  // badge (acao na palavra, inventario na badge — regra da casa).
  hud.catnipBtn.hidden = state.catnipLeft <= 0;
  const cb = hud.catnipBtn.querySelector('.btn-badge');
  if (cb && cb.textContent !== `×${state.catnipLeft}`) cb.textContent = `×${state.catnipLeft}`;
  hud.laserBtn.hidden = state.laserLeft <= 0;
  const lb = hud.laserBtn.querySelector('.btn-badge');
  if (lb && lb.textContent !== `×${state.laserLeft}`) lb.textContent = `×${state.laserLeft}`;

  // O EVENTO SOCIAL aberto (se houver): texto por tipo, prazo na barra.
  const openSocial = state.social.find((s) => !s.resolved && s.until > 0 && state.tick < s.until);
  hud.socialModal.hidden = !openSocial;
  if (openSocial) {
    if (hud.socialKind.current !== openSocial.kind) {
      hud.socialKind.current = openSocial.kind;
      const st = SOCIAL_TEXT[getLocale()][openSocial.kind]!;
      setText(hud.socialTitle, st.title);
      setText(hud.socialA, st.a);
      setText(hud.socialB, st.b);
    }
    const frac = Math.max(0, (openSocial.until - state.tick) / SOCIAL_WINDOW);
    hud.socialTimer.style.width = `${Math.round(frac * 100)}%`;
  } else {
    hud.socialKind.current = null;
  }

  // O PALCO: o painel so existe durante o pitch, e enquanto existe e o jogo
  // — as acoes de booth (petisco, projeto, equipe) saem do caminho.
  const inPitch = state.phase === 'pitch' && state.pitch !== null;
  hud.root.classList.toggle('in-pitch', inPitch);
  hud.pitchPanel.hidden = !inPitch;
  if (inPitch) {
    // Subiu ao palco: os paineis de booth fecham sozinhos.
    hud.board.hidden = true;
    const p = state.pitch!;
    hud.pitchGauge.style.width = `${Math.round(p.gauge * 100)}%`;
    hud.pitchGauge.classList.toggle('gauge-hot', p.gauge > 0.7);
    setText(hud.pitchTimer, t().pitchTimer(Math.ceil(p.ticksLeft / 30)));
    const crisisOpen = p.crisisUntil > 0 && state.tick < p.crisisUntil && !p.crisisResolved;
    hud.pitchCrisis.hidden = !crisisOpen;
    for (const [id, btn] of hud.pitchBtns) {
      btn.disabled = (p.readyAt[id] ?? 0) > state.tick;
    }
  }
};

export const pushFeed = (hud: Hud, state: HackState, events: SimEvent[]): void => {
  for (const e of events) {
    const text = EVENT_TEXT(state, e);
    if (!text) continue;
    // A faixa mostra a ULTIMA noticia; o historico mora no painel.
    setText(hud.feedLatest, text);
    const line = el('div', 'feed-line', text);
    hud.feedPanel.prepend(line);
    while (hud.feedPanel.children.length > 12) hud.feedPanel.lastChild?.remove();
    setText(hud.feedBadge, String(hud.feedPanel.children.length));
  }
};

/**
 * A FICHA COMPACTA no rodape. A primeira versao era um cartao no canto
 * superior esquerdo que cobria UM QUARTO da area jogavel — exatamente sobre a
 * estacao do gato selecionado. Agora: nome, o que ele esta fazendo AGORA e
 * tres micro-medidores; bio e fome atras de "detalhes".
 */


export const drawCard = (hud: Hud, state: HackState, selected: string | null): void => {
  if (!selected) {
    hud.dock.hidden = true;
    return;
  }
  const cat = state.cats.find((x) => x.id === selected);
  if (!cat) {
    hud.dock.hidden = true;
    return;
  }
  hud.dock.hidden = false;
  setText(hud.dockName, `${cat.name} · ${specLabel(cat.specialty)} ${tierLabel(cat.tier)}`);
  setText(hud.dockNow, t().dockNow(t().modes[cat.mode] ?? cat.mode));
  hud.dockMeters.energia.fill.style.width = `${Math.round(cat.energy * 100)}%`;
  hud.dockMeters.estresse.fill.style.width = `${Math.round(cat.stress * 100)}%`;
  hud.dockMeters.moral.fill.style.width = `${Math.round(cat.moral * 100)}%`;
  hud.dockHunger.fill.style.width = `${Math.round(cat.hunger * 100)}%`;
  setText(hud.dockBio, cat.bio);
  // A CONVIVENCIA nomeada so depois da revelacao: o vibe le o trait oculto,
  // e a ficha nao pode contar o que o curriculo ainda esconde — ate la o
  // jogador ve o comportamento (o feed anuncia bufos) sem ver o mapa.
  if (cat.revealed) {
    const parts: string[] = [];
    for (const other of state.cats) {
      if (other.id === cat.id) continue;
      const v = vibeOf(cat, other);
      if (v > 0) parts.push(`♥ ${other.name}`);
      else if (v < 0) parts.push(`⚡ ${other.name}`);
    }
    hud.dockVibes.hidden = parts.length === 0;
    setText(hud.dockVibes, parts.length > 0 ? `${t().vibesLabel}: ${parts.join(' · ')}` : '');
  } else {
    hud.dockVibes.hidden = true;
  }
};

/** A tela final: as tres notas, o veredito e a historia que deu nisso. */
export const showResult = (
  host: HTMLElement,
  state: HackState,
  extras: RunClose,
  onAgain: () => void
): void => {
  const r = state.result!;
  const wrap = el('div', 'screen result');
  wrap.appendChild(el('h1', 'result-title', t().resultTitle[r.outcome] ?? r.outcome));
  if (r.crashed) {
    wrap.appendChild(el('p', 'result-sub', state.buildBroken ? t().crashedBuild : t().crashedBugs(r.bugs)));
  }
  const judges = el('div', 'result-judges');
  JUDGES.forEach((j, i) => {
    const jj = el('div', 'judge');
    jj.appendChild(el('div', 'judge-name', j.name));
    jj.appendChild(el('div', 'judge-lens', t().judgeLens[i] ?? j.lens));
    jj.appendChild(el('div', 'judge-score', String(r.perJudge[i])));
    judges.appendChild(jj);
  });
  wrap.appendChild(judges);
  // As CINCO dimensoes + o voto popular: o pos-jogo ensina O QUE pesou —
  // "foi o pitch que te tirou o podio" e uma licao tao boa quanto o bug vivo.
  const dims = el('div', 'result-dims');
  for (const [label, value] of [
    [t().dims.tecnica, r.dimensions.tecnica],
    [t().dims.estabilidade, r.dimensions.estabilidade],
    [t().dims.experiencia, r.dimensions.experiencia],
    [t().dims.inovacao, r.dimensions.inovacao],
    [t().dims.pitch, r.dimensions.pitch],
  ] as const) {
    const d = el('div', 'result-dim');
    d.appendChild(el('span', 'dim-label', label));
    d.appendChild(el('span', 'dim-value', String(value)));
    dims.appendChild(d);
  }
  wrap.appendChild(dims);
  wrap.appendChild(el('p', 'result-plateia', t().plateia(Math.round(r.plateia * 100))));
  if (r.improvised) {
    wrap.appendChild(el('p', 'result-improviso', t().improviso));
  }
  wrap.appendChild(
    el('p', 'result-stats', t().stats(r.core, r.polish, r.bugs, r.looseEnds, r.score))
  );
  // O PREMIO em moedas fisicas — e, na carreira, a carteira que ele virou.
  const prizeRow = el('p', 'result-prize', t().prizeLine(fmtCost(r.prize, getLocale())));
  wrap.appendChild(prizeRow);
  // O EXTRATO do premio: a sim itemiza (prizeParts) exatamente para a tela
  // poder ser honesta — sem ele, o jogador nunca ve a mordida da divida nem
  // o payout do sponsor (achado de revisao).
  const ledger = (Object.keys(r.prizeParts) as (keyof typeof r.prizeParts)[])
    .filter((k) => r.prizeParts[k] !== 0)
    .map((k) => `${t().prizePartName[k]} ${r.prizeParts[k] > 0 ? '+' : ''}${r.prizeParts[k]}`);
  if (ledger.length > 0) wrap.appendChild(el('p', 'result-ledger', ledger.join(' · ')));
  if (extras.wallet !== null) {
    wrap.appendChild(el('p', 'result-wallet', t().walletAfter(fmtCost(extras.wallet, getLocale()))));
  }

  // O DUELO com o rival: a nota deles contra a tua, e quem esta insuportavel.
  if (extras.rival) {
    const rv = extras.rival;
    const line = rv.beat ? t().rivalBeat(rv.name, rv.score, r.score) : t().rivalLost(rv.name, rv.score, r.score);
    wrap.appendChild(el('p', `result-rival ${rv.beat ? 'rival-beat' : 'rival-lost'}`, line));
  }
  // REPUTACAO (so na carreira): o telao lembra.
  if (extras.wallet !== null) {
    wrap.appendChild(el('p', 'result-rep', t().repLine(extras.repAfter, extras.repAfter - extras.repBefore)));
  }
  // O VEREDITO do sponsor, se havia contrato: cumprido paga, furado corre.
  if (state.sponsor && r.sponsorMet !== null) {
    const sn = SPONSOR_TEXT[getLocale()][state.sponsor.id]!.name;
    wrap.appendChild(
      el('p', `result-sponsor ${r.sponsorMet ? 'sponsor-met' : 'sponsor-failed'}`,
        r.sponsorMet ? t().sponsorMetLine(sn) : t().sponsorFailedLine(sn))
    );
  }
  // O trofeu da categoria especial, quando o predicado fechou.
  if (r.specialWon) {
    const spName = SPECIAL_TEXT[getLocale()][state.specialCategory]!.name;
    wrap.appendChild(el('p', 'result-special', t().specialWonLine(spName)));
  }
  // Os juniores que cresceram — e a estrela que foi embora, se foi.
  if (extras.graduates.length > 0) {
    wrap.appendChild(el('p', 'result-grown', t().graduatesLine(extras.graduates.join(', '))));
  }
  if (extras.poachedStar && extras.rival) {
    wrap.appendChild(el('p', 'result-poached', t().poachedLine(extras.poachedStar, extras.rival.name)));
  }
  if (extras.newAchievements.length > 0) {
    const ach = el('div', 'result-achs');
    ach.appendChild(el('div', 'achs-title', t().achievementsTitle));
    const achRow = el('div', 'achs-row');
    for (const id of extras.newAchievements) {
      const at = ACHIEVEMENT_TEXT[getLocale()][id];
      const chip = el('span', 'ach-chip', at?.name ?? id);
      chip.title = at?.hint ?? '';
      achRow.appendChild(chip);
    }
    ach.appendChild(achRow);
    wrap.appendChild(ach);
  }

  // A historia: os tres eventos mais contaveis da partida. E o que faz alguem
  // dizer "o laranja quebrou o build duas vezes e mesmo assim ganhamos".
  const notable = state.events.filter((e) => ['bug', 'cable', 'shortcut', 'build-broken', 'hairball'].includes(e.kind)).slice(-3);
  if (notable.length > 0) {
    const story = el('div', 'result-story');
    for (const e of notable) {
      const text = EVENT_TEXT(state, e);
      if (text) story.appendChild(el('div', 'feed-line', text));
    }
    wrap.appendChild(story);
  }

  const again = softButton(ICONS.again, t().btnAgain, 'big');
  again.addEventListener('click', onAgain);
  wrap.appendChild(again);
  host.appendChild(wrap);
};

export const showTitle = (host: HTMLElement, onStart: (mode: 'career' | 'quick' | 'daily') => void): void => {
  const wrap = el('div', 'screen title');
  wrap.appendChild(el('h1', 'title-logo', 'CATATHON'));
  wrap.appendChild(el('p', 'title-sub', t().titleSub));
  wrap.appendChild(el('p', 'title-brief', t().titleBrief));
  wrap.appendChild(el('p', 'title-help', t().titleHelp));
  // Os TRES MODOS: carreira (a carteira persiste), quick run (tudo
  // sorteado), daily (a semente do dia, igual para todo mundo).
  const modeRow = el('div', 'mode-row');
  const modes: ['career' | 'quick' | 'daily', string][] = [
    ['career', t().modeCareer],
    ['quick', t().modeQuick],
    ['daily', t().modeDaily],
  ];
  for (const [mode, word] of modes) {
    const b = softButton(ICONS.badge, `${t().btnOpenEmail} · ${word}`, mode === 'career' ? 'big' : 'dim');
    b.addEventListener('click', () => onStart(mode));
    modeRow.appendChild(b);
  }
  wrap.appendChild(modeRow);
  // O botao de IDIOMA: o outro idioma, pelo nome dele. Troca e recarrega — o
  // HUD e construido uma vez, de proposito (a licao dos botoes detached).
  const lang = softButton(ICONS.sound, t().langWord, 'dim');
  lang.querySelector('.btn-icon')?.remove();
  lang.addEventListener('click', () => {
    setLocale(getLocale() === 'en' ? 'pt' : 'en');
    location.reload();
  });
  wrap.appendChild(lang);
  host.appendChild(wrap);
};


/**
 * O RECRUTAMENTO, diegetico: um e-mail do recrutador com seis crachas em
 * anexo. Cada candidato mostra raca, tier, disciplina, DOIS traits (o
 * terceiro o curriculo nao conta) e o custo nas tres moedas. Contrata-se
 * 3 ou 4, dentro do orcamento — e uma decisao, nao uma soma obvia.
 */
export const showRecruit = (
  host: HTMLElement,
  candidates: readonly Candidate[],
  gearOffers: readonly { id: GearId; cost: number }[],
  budget: number,
  project: { name: string; brief: string; emphasis: string },
  layoutName: string,
  extras: {
    /** A oferta de sponsor desta edicao (carreira com reputacao) ou null. */
    sponsor: SponsorContract | null;
    /** A provocacao do rival (carreira) e quem eles ja levaram de ti. */
    rivalLine: string | null;
    rosterLine: string | null;
    /** A categoria especial da edicao, anunciada no convite. */
    special: SpecialCategoryId;
  },
  onDone: (hired: Candidate[], gear: GearId[], sponsor: SponsorContract | null) => void
): void => {
  const wrap = el('div', 'screen recruit');
  wrap.appendChild(el('h1', 'recruit-title', i18n().recruitTitle));
  wrap.appendChild(
    el(
      'p',
      'recruit-intro',
      i18n().recruitIntro(project.name, project.brief, i18n().emphasisName[project.emphasis] ?? project.emphasis, layoutName)
    )
  );
  // A CATEGORIA ESPECIAL vem no convite, como a lente da banca: um segundo
  // objetivo anunciado muda como se joga a edicao inteira.
  const sp = SPECIAL_TEXT[getLocale()][extras.special]!;
  wrap.appendChild(el('p', 'recruit-special', i18n().specialLine(sp.name, sp.hint)));
  // O RIVAL provoca no proprio e-mail: os Golden Retrievers existem para
  // serem vencidos, e a provocacao e o lembrete.
  if (extras.rivalLine) wrap.appendChild(el('p', 'recruit-rival', extras.rivalLine));
  if (extras.rosterLine) wrap.appendChild(el('p', 'recruit-rival roster', extras.rosterLine));

  const hired = new Set<string>();
  const cart = new Set<GearId>();
  let signed = false;
  const spent = (): number =>
    candidates.filter((c) => hired.has(c.id)).reduce((s, c) => s + c.cost, 0) +
    gearOffers.filter((g) => cart.has(g.id)).reduce((s, g) => s + g.cost, 0);

  const saldo = el('div', 'recruit-saldo', '');
  const closeBtn = softButton(ICONS.badge, i18n().btnLockTeam, 'big');
  const refresh = (): void => {
    // O adiantamento do sponsor entra no saldo NA HORA da assinatura: e
    // dinheiro de verdade para esta edicao (e a letra miuda tambem vale).
    const left = budget + (signed && extras.sponsor ? extras.sponsor.budget : 0) - spent();
    setText(saldo, i18n().recruitBalance(fmtCost(Math.max(0, left), getLocale()), hired.size, left < 0));
    closeBtn.disabled = hired.size < 3 || hired.size > 4 || left < 0;
  };

  const grid = el('div', 'recruit-grid');
  for (const c of candidates) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cand-card';
    const head = el('div', 'cand-head');
    const sw = el('span', 'team-swatch');
    sw.style.background = `#${c.coat.body.toString(16).padStart(6, '0')}`;
    head.append(sw, el('span', 'cand-name', c.name));
    head.appendChild(el('span', 'cand-tier', tierLabel(c.tier)));
    card.appendChild(head);
    card.appendChild(el('div', 'cand-spec', `${specLabel(c.specialty)} · ${c.breed}`));
    const traits = el('div', 'cand-traits');
    for (const tr of c.traits) traits.appendChild(el('span', 'cand-trait', traitLabel(tr)));
    traits.appendChild(el('span', 'cand-trait cand-hidden', '???'));
    card.appendChild(traits);
    card.appendChild(el('div', 'cand-cv', `"${c.cv}" — ${c.note}`));
    card.appendChild(el('div', 'cand-cost', fmtCost(c.cost, getLocale())));
    card.addEventListener('click', () => {
      if (hired.has(c.id)) hired.delete(c.id);
      else hired.add(c.id);
      card.classList.toggle('hired', hired.has(c.id));
      refresh();
    });
    grid.appendChild(card);
  }
  // A LOJINHA: tres apetrechos por edicao, trade-off escrito no objeto.
  const shop = el('div', 'shop');
  shop.appendChild(el('div', 'shop-title', i18n().shopTitle));
  const shopRow = el('div', 'shop-row');
  for (const g of gearOffers) {
    const gt = GEAR_TEXT[getLocale()][g.id]!;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shop-item';
    // O objeto REAL do apetrecho, recortado do mesmo atlas da hotbar.
    const spr = el('span', 'slot-sprite shop-sprite');
    spr.setAttribute('aria-hidden', 'true');
    applyItemSprite(spr, g.id, 2);
    b.append(spr, el('span', 'shop-name', gt.name), el('span', 'shop-hint', gt.hint), el('span', 'cand-cost', fmtCost(g.cost, getLocale())));
    b.addEventListener('click', () => {
      if (cart.has(g.id)) cart.delete(g.id);
      else cart.add(g.id);
      b.classList.toggle('hired', cart.has(g.id));
      refresh();
    });
    shopRow.appendChild(b);
  }
  shop.appendChild(shopRow);

  // O SPONSOR: um cartao com o contrato ESCRITO — o que paga, o que cobra e
  // o que amarra. Assinar e opcional e reversivel ate fechar a equipe.
  let sponsorBox: HTMLElement | null = null;
  if (extras.sponsor) {
    const st = SPONSOR_TEXT[getLocale()][extras.sponsor.id]!;
    sponsorBox = el('div', 'sponsor-box');
    sponsorBox.appendChild(el('div', 'shop-title', i18n().sponsorTitle));
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'shop-item sponsor-card';
    card.append(
      el('span', 'shop-name', st.name),
      el('span', 'shop-hint', st.offer),
      el('span', 'sponsor-strings', st.strings)
    );
    const signedTag = el('span', 'sponsor-signed', i18n().sponsorSigned);
    signedTag.hidden = true;
    card.appendChild(signedTag);
    card.addEventListener('click', () => {
      signed = !signed;
      card.classList.toggle('hired', signed);
      signedTag.hidden = !signed;
      refresh();
    });
    sponsorBox.appendChild(card);
  }

  wrap.append(grid, shop, ...(sponsorBox ? [sponsorBox] : []), saldo);
  closeBtn.addEventListener('click', () => {
    if (closeBtn.disabled) return;
    onDone(candidates.filter((c) => hired.has(c.id)), [...cart], signed ? extras.sponsor : null);
  });
  wrap.appendChild(closeBtn);
  refresh();
  host.appendChild(wrap);
};

export const clearScreens = (host: HTMLElement): void => {
  for (const s of Array.from(host.querySelectorAll('.screen'))) s.remove();
};
