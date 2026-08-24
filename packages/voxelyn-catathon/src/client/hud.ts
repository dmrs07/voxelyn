import { CATS, HACK_TICKS, HOURS_PER_TICK, JUDGES, TREATS_START } from '../sim/index.js';
import type { HackState, SimEvent, Task } from '../sim/types.js';

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
};

export type Hud = {
  root: HTMLElement;
  clock: HTMLElement;
  remain: HTMLElement;
  build: HTMLElement;
  proj: HTMLElement;
  bugsChip: HTMLElement;
  alarm: HTMLElement;
  treatsBtn: HTMLButtonElement;
  board: HTMLElement;
  feed: HTMLElement;
  card: HTMLElement;
  /**
   * Linhas do quadro, criadas UMA vez e atualizadas no lugar. A primeira
   * versao reconstruia o quadro a cada frame — e um botao recriado 60x por
   * segundo esta sempre "detached" entre o touchstart e o click: o dedo
   * tocava "cortar" e nada acontecia. Botao que existe fica existindo.
   */
  rows: Map<string, TaskRow>;
  onCut: (taskId: string) => void;
  onFeedToggle: () => void;
};

export const createHud = (
  host: HTMLElement,
  handlers: {
    onCut: (taskId: string) => void;
    onFeedToggle: () => void;
    /** Controle por barramento (direcao §14): musica, efeitos, teclados, ambiente, gatos. */
    onLevel: (bus: string, level01: number) => void;
    levels: () => Record<string, number>;
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
  const bugsChip = el('div', 'hud-chip hud-bugs', '');
  bugsChip.hidden = true;
  const alarm = el('div', 'hud-chip hud-alarm-chip', '');
  alarm.hidden = true;
  // As ACOES moram numa barra contextual embaixo, com base escura coerente
  // com o HUD — nao botoes soltos flutuando sobre o cenario. Petisco separa
  // ACAO (a palavra) de INVENTARIO (a badge com o numero).
  const treatsBtn = softButton(ICONS.fish, 'petisco', 'treat');
  const treatsBadge = el('span', 'btn-badge', `×${TREATS_START}`);
  treatsBtn.appendChild(treatsBadge);
  treatsBtn.addEventListener('click', handlers.onFeedToggle);
  // O projeto e um PAINEL ABERTO POR BOTAO, nao um movel permanente: fixo,
  // ele cobria metade do pavilhao atras de uma lista. Aberto por vontade,
  // pode ser grande a vontade — e o quadro FISICO do centro mostra o resumo.
  const boardBtn = softButton(ICONS.board, 'projeto');
  top.append(clock, remain, build, proj, bugsChip, alarm);
  const cluster = el('div', 'action-bar');

  const board = el('div', 'hud-board');
  board.hidden = true;
  const feed = el('div', 'hud-feed');
  feed.setAttribute('role', 'log');
  feed.setAttribute('aria-live', 'polite');
  const card = el('div', 'hud-card');
  card.hidden = true;

  boardBtn.addEventListener('click', () => {
    board.hidden = !board.hidden;
  });

  // O PAINEL DE SOM: cinco faixas independentes, com palavra, atras de botao.
  // "Jogar horas sem fadiga auditiva" comeca em poder abaixar exatamente o que
  // cansa — e um controle por barramento e acessibilidade, nao luxo. O botao
  // mora no CANTO de configuracoes (topo direito), fora das acoes de jogo:
  // "som" nao e um verbo da partida.
  const soundBtn = softButton(ICONS.sound, 'som', 'dim som-corner');
  const soundPanel = el('div', 'hud-sound');
  soundPanel.hidden = true;
  const BUS_LABEL: Record<string, string> = {
    music: 'musica',
    sfx: 'efeitos',
    typing: 'teclados',
    ambience: 'ambiente',
    vocals: 'gatos',
  };
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
  cluster.append(boardBtn, treatsBtn);

  root.append(top, soundBtn, cluster, board, soundPanel, feed, card);
  host.appendChild(root);

  // Aviso de RETRATO: o pavilhao e largo, e deitado se ve o dobro. Aviso,
  // nunca bloqueio — e mora no HOST, fora do root que se esconde no titulo:
  // e justamente na tela de titulo que girar mais ajuda.
  const hint = el('div', 'rotate-hint', 'gire o aparelho para ver o pavilhao inteiro');
  hint.setAttribute('role', 'status');
  host.appendChild(hint);

  return { root, clock, remain, build, proj, bugsChip, alarm, treatsBtn, board, feed, card, rows: new Map(), ...handlers };
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
  const day = ['SEX', 'SAB', 'DOM'][dayIdx];
  const hh = Math.floor(hours % 24);
  const mm = Math.floor((hours % 1) * 60);
  return `DIA ${dayIdx + 1} · ${day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const remainText = (tick: number): string => {
  const left = Math.max(0, (HACK_TICKS - tick) * HOURS_PER_TICK);
  const hh = Math.floor(left);
  const mm = Math.floor((left % 1) * 60);
  return `${hh}h${String(mm).padStart(2, '0')} restantes`;
};

const makeRow = (t: Task, onCut: (id: string) => void): TaskRow => {
  const row = el('div', 'task');
  row.appendChild(el('span', 'task-name', t.label + (t.polish ? ' ✦' : '')));
  const state = el('span', 'task-state', '');
  const bar = el('span', 'task-bar');
  const fill = el('span', 'task-fill');
  bar.appendChild(fill);
  const cutBtn = document.createElement('button');
  cutBtn.type = 'button';
  cutBtn.className = 'task-cut';
  cutBtn.innerHTML = `<span class="btn-icon" aria-hidden="true">${ICONS.scissors}</span><span>cortar</span>`;
  cutBtn.title = 'tirar do escopo: nao pontua, mas nao vira ponta solta';
  cutBtn.addEventListener('click', () => onCut(t.id));
  row.append(state, bar, cutBtn);
  return { row, state, bar, fill, cutBtn };
};

const updateRow = (state: HackState, t: Task, r: TaskRow): void => {
  r.row.className = `task ${t.done ? 'done' : ''} ${t.cut ? 'cut' : ''} ${t.awaitingShip ? 'await' : ''}`;
  const depsPending = t.deps.filter((d) => !state.tasks.find((x) => x.id === d)?.done);
  const locked = depsPending.length > 0 && !t.done && !t.cut;

  let text = '';
  let blink = false;
  if (t.done) text = 'shipada';
  else if (t.cut) text = 'cortada';
  else if (t.awaitingShip) {
    text = 'Bigode espera teu SHIPA (carinho nele)';
    blink = true;
  } else if (locked) {
    text = `espera: ${depsPending.map((d) => state.tasks.find((x) => x.id === d)?.label ?? d).join(', ')}`;
  }
  if (r.state.textContent !== text) r.state.textContent = text;
  r.state.className = `task-state ${blink ? 'task-blink' : ''}`;
  r.state.style.display = text ? '' : 'none';

  const showBar = !t.done && !t.cut && !t.awaitingShip && !locked;
  r.bar.style.display = showBar ? '' : 'none';
  if (showBar) r.fill.style.width = `${Math.round((t.progress / t.cost) * 100)}%`;

  r.cutBtn.style.display = t.done || t.cut ? 'none' : '';
};

const EVENT_TEXT = (state: HackState, e: SimEvent): string | null => {
  const name = (id: string): string => CATS.find((c) => c.id === id)?.name ?? id;
  switch (e.kind) {
    case 'ship':
      return `${name(e.by)} shipou "${e.task}"`;
    case 'await-ship':
      return `${name(e.by)} terminou "${e.task}" e NAO deixa mergear. Faz carinho nele.`;
    case 'shortcut':
      return `${name(e.by)} descobriu um atalho genial sem querer: "${e.task}" adiantou`;
    case 'bug':
      return e.cause === 'teclado'
        ? `${name(e.by)} sentou no teclado: BUG em ${TRACK_LABEL[e.track]}`
        : `${name(e.by)} shipou sem testar: BUG em ${TRACK_LABEL[e.track]}`;
    case 'bugfix':
      return `bug de ${TRACK_LABEL[e.track]} consertado`;
    case 'zoomies':
      return `${name(e.cat)} entrou em zoomies pelas mesas`;
    case 'cable':
      return `${name(e.by)} MORDEU O CABO: build fora do ar (leva alguem ao rack)`;
    case 'cable-fixed':
      return 'cabo religado, build de volta';
    case 'nap':
      return `${name(e.cat)} apagou`;
    case 'eat':
      return `${name(e.cat)} foi comer`;
    case 'hairball':
      return 'BOLA DE PELO no repositorio: merge travado! (leva alguem ao rack)';
    case 'hairball-fixed':
      return 'bola de pelo resolvida, merge liberado';
    case 'build-broken':
      return 'O BUILD QUEBROU. Nao ha mais conserto.';
    case 'treat':
      return `${name(e.cat)} ganhou petisco`;
    case 'cut':
      return `escopo cortado: "${e.task}"`;
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
  const buildState = state.buildBroken ? 'BUILD QUEBRADO' : state.cableOut ? 'BUILD FORA DO AR' : 'BUILD OK';
  setText(hud.build, buildState);
  hud.build.classList.toggle('chip-bad', buildState !== 'BUILD OK');
  setText(hud.proj, `${shipped}/12`);
  hud.bugsChip.hidden = bugs === 0;
  if (bugs > 0) setText(hud.bugsChip, `${bugs} bug${bugs > 1 ? 's' : ''}`);
  hud.alarm.hidden = !state.hairball.active;
  if (state.hairball.active) setText(hud.alarm, 'MERGE TRAVADO — leva alguem ao rack');

  // O numero vive na badge: acao e inventario separados no mesmo botao.
  const badge = hud.treatsBtn.querySelector('.btn-badge');
  if (badge && badge.textContent !== `×${state.treats}`) badge.textContent = `×${state.treats}`;
  hud.treatsBtn.disabled = state.treats <= 0;

  if (hud.rows.size === 0) {
    for (const track of ['backend', 'frontend', 'design', 'devops'] as const) {
      const group = el('div', 'board-track');
      group.appendChild(el('div', 'board-title', TRACK_LABEL[track]));
      for (const t of state.tasks.filter((x) => x.track === track)) {
        const r = makeRow(t, hud.onCut);
        hud.rows.set(t.id, r);
        group.appendChild(r.row);
      }
      hud.board.appendChild(group);
    }
  }
  for (const t of state.tasks) {
    const r = hud.rows.get(t.id);
    if (r) updateRow(state, t, r);
  }
};

export const pushFeed = (hud: Hud, state: HackState, events: SimEvent[]): void => {
  for (const e of events) {
    const text = EVENT_TEXT(state, e);
    if (!text) continue;
    const line = el('div', 'feed-line', text);
    hud.feed.prepend(line);
    // Tres linhas no maximo: o feed mora sobre o canto de descanso e nao
    // pode virar uma coluna cobrindo o sofa.
    while (hud.feed.children.length > 3) hud.feed.lastChild?.remove();
  }
};

export const drawCard = (hud: Hud, state: HackState, selected: string | null): void => {
  if (!selected) {
    hud.card.hidden = true;
    return;
  }
  const cat = state.cats.find((x) => x.id === selected);
  const meta = CATS.find((x) => x.id === selected);
  if (!cat || !meta) {
    hud.card.hidden = true;
    return;
  }
  hud.card.hidden = false;
  hud.card.replaceChildren();
  hud.card.appendChild(el('div', 'card-name', `${meta.name} · ${meta.specialty}`));
  hud.card.appendChild(el('div', 'card-bio', meta.bio));
  const bars = el('div', 'card-bars');
  for (const [label, value, cls] of [
    ['energia', cat.energy, 'bar-energy'],
    ['fome', cat.hunger, 'bar-hunger'],
    ['estresse', cat.stress, 'bar-stress'],
  ] as const) {
    const rowEl = el('div', 'card-bar-row');
    rowEl.appendChild(el('span', 'card-bar-label', label));
    const bar = el('span', `card-bar ${cls}`);
    const fill = el('span', 'card-fill');
    fill.style.width = `${Math.round(value * 100)}%`;
    bar.appendChild(fill);
    rowEl.appendChild(bar);
    bars.appendChild(rowEl);
  }
  hud.card.appendChild(bars);
};

/** A tela final: as tres notas, o veredito e a historia que deu nisso. */
export const showResult = (host: HTMLElement, state: HackState, onAgain: () => void): void => {
  const r = state.result!;
  const wrap = el('div', 'screen result');
  const title: Record<string, string> = {
    'grand-prize': 'GRAND PRIZE! 🏆',
    podio: 'PODIO!',
    mencao: 'mencao honrosa',
    participacao: 'certificado de participacao',
    crashed: 'A DEMO CRASHOU.',
  };
  wrap.appendChild(el('h1', 'result-title', title[r.outcome]));
  if (r.crashed) {
    wrap.appendChild(
      el('p', 'result-sub', state.buildBroken ? 'o build estava quebrado desde a bola de pelo.' : `${r.bugs} bug(s) vivos na demo. os deuses da demo cobraram.`)
    );
  }
  const judges = el('div', 'result-judges');
  JUDGES.forEach((j, i) => {
    const jj = el('div', 'judge');
    jj.appendChild(el('div', 'judge-name', j.name));
    jj.appendChild(el('div', 'judge-lens', j.lens));
    jj.appendChild(el('div', 'judge-score', String(r.perJudge[i])));
    judges.appendChild(jj);
  });
  wrap.appendChild(judges);
  wrap.appendChild(
    el('p', 'result-stats', `${r.core} core · ${r.polish} polimentos · ${r.bugs} bugs vivos · ${r.looseEnds} pontas soltas · total ${r.score}`)
  );

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

  const again = softButton(ICONS.again, 'jogar de novo', 'big');
  again.addEventListener('click', onAgain);
  wrap.appendChild(again);
  host.appendChild(wrap);
};

export const showTitle = (host: HTMLElement, onStart: () => void): void => {
  const wrap = el('div', 'screen title');
  wrap.appendChild(el('h1', 'title-logo', 'CATATHON'));
  wrap.appendChild(el('p', 'title-sub', 'o maior hackathon do mundo. a tua equipe e de gatos.'));
  wrap.appendChild(
    el('p', 'title-brief', 'desafio da organizacao: "plataforma de adocao com IA, acessivel, mas sustentavel". 48 horas. tres juizes. uma mao.')
  );
  const team = el('div', 'title-team');
  for (const c of CATS) team.appendChild(el('div', 'team-line', `${c.name} — ${c.bio}`));
  wrap.appendChild(team);
  wrap.appendChild(
    el('p', 'title-help', 'arrasta um gato para a mesa dele. segura o dedo em cima = carinho (e o "shipa" do Bigode). petisco = botao. corta escopo no painel de projeto. emergencia? leva alguem ao rack.')
  );
  const start = softButton(ICONS.badge, 'comecar', 'big');
  start.addEventListener('click', onStart);
  wrap.appendChild(start);
  host.appendChild(wrap);
};

export const clearScreens = (host: HTMLElement): void => {
  for (const s of Array.from(host.querySelectorAll('.screen'))) s.remove();
};
