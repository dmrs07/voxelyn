import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';
import {
  CIRCUIT_TEXT,
  CLASSIC_TEAM,
  RIVAL_TAUNT_TEXT,
  RUN_BUDGET,
  TICK_MS,
  createHackathon,
  dailySeed,
  eventForRep,
  returningCandidate,
  rivalScoreFor,
  rollCandidates,
  rollGearOffers,
  rollLayout,
  rollProject,
  rollSpecialCategory,
  rollSponsorOffer,
  step,
  type Candidate,
  type CircuitEventSpec,
  type GearId,
} from '../sim/index.js';
import { applyRun, ensureRival, loadCareer, todayUTC, type Mode } from './career.js';
import type { HackState, SimEvent, SponsorContract } from '../sim/types.js';
import {
  createAudioEngine,
  demoAudio,
  eventsAudio,
  getLevels,
  grabVocal,
  setLevel,
  setPetPurr,
  startGameAudio,
  stopGameAudio,
  tickAudio,
  unlockAudio,
  type AudioEngine,
  type BusId,
} from './audio/index.js';
import { attachInput, attachKeyboard, buildCommand, createInput, type InputState, type InputTeardown } from './input.js';
import { getLocale, t } from './i18n.js';
import { bindTeam, clearScreens, createHud, drawCard, drawHud, pushFeed, showHub, showRecruit, showResult, showTitle, type Hud } from './hud.js';
import { createView, drawHand, drawScene, type View } from './render.js';

export type App = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  view: View;
  state: HackState;
  input: InputState;
  hud: Hud;
  audio: AudioEngine;
  screenHost: HTMLElement;
  phase: 'title' | 'recruit' | 'playing' | 'result';
  /** A semente DESTA edicao: candidatos, projeto e layout saem dela. */
  seed: number;
  /** O modo da edicao: carreira persiste a carteira; daily fixa a semente. */
  mode: Mode;
  /** O que esta edicao custou (contratos + apetrechos, menos o adiantamento
   * do sponsor) — a carreira desconta. */
  spent: number;
  /** A equipe contratada desta run (a carreira le crescimento daqui). */
  hired: readonly Candidate[];
  /** O contrato de sponsor assinado nesta edicao, se houve. */
  sponsor: SponsorContract | null;
  /** O palco do CIRCUITO desta edicao (carreira; null fora dela). */
  event: CircuitEventSpec | null;
  accumulator: number;
  lastFrame: number;
  frameHandle: number;
  detach: InputTeardown[];
};

/**
 * VIBRACAO: o tato do telefone, com a mesma disciplina das vozes — escassa.
 * Pegar e soltar sao toquinhos; so os CRITICOS ganham padrao. Guardada porque
 * nem todo aparelho (nem todo humano) quer vibrar.
 */
const buzz = (pattern: number | number[]): void => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // sem vibracao nao e sem jogo
  }
};

const tickGame = (app: App): void => {
  const wasHeld = app.state.held;
  const cmd = buildCommand(app.input, app.state, () => performance.now());
  const events = step(app.state, cmd);

  // Pegar um gato PODE arrancar um chirp de reconhecimento — pode: as regras
  // de escassez (cooldown, vaga global, 1 em 3 silencioso) moram no modulo de
  // vozes, nao aqui.
  if (!wasHeld && app.state.held) {
    grabVocal(app.audio, app.state, app.state.held);
    buzz(8);
  }
  if (wasHeld && !app.state.held) buzz(14);

  const petted = app.input.petting ? app.state.cats.find((c) => c.id === app.input.petting) ?? null : null;
  setPetPurr(app.audio, app.state.phase === 'hack' ? petted : null);

  tickAudio(app.audio, app.state);
  eventsAudio(app.audio, app.state, events);
  for (const e of events) {
    if (e.kind === 'hairball' || e.kind === 'cable' || e.kind === 'build-broken' || e.kind === 'demo-glitch') buzz([30, 40, 30]);
    else if (e.kind === 'ship' || e.kind === 'improviso') buzz(12);
    else if (e.kind === 'treat') buzz([8, 20, 8]);
  }
  pushFeed(app.hud, app.state, events);

  if (app.state.phase === 'done') {
    app.phase = 'result';
    // O ritual da submissao: a musica congela, o deploy fala, e o final e
    // festa intima ou feltro gentil — nunca tragedia.
    demoAudio(app.audio, app.state);
    // A CARREIRA fecha a conta da edicao: carteira, reputacao, o duelo com o
    // rival, os juniores que cresceram, a estrela que talvez tenha ido
    // embora. A nota do rival usa o skill de ANTES da run (a carreira so e
    // salva nos fechamentos — durante a run ela nao muda).
    const career = loadCareer();
    // O rival leva o CIRCUITO a serio: o bonus do palco soma ao skill que a
    // carreira acumulou — a final do Global e contra o rival no auge.
    const rivalScore =
      app.mode === 'career' && career.rival
        ? rivalScoreFor(app.state.seed, career.rival.skill + (app.event?.rivalBonus ?? 0))
        : null;
    const close = applyRun(career, app.state, {
      mode: app.mode,
      spent: app.spent,
      hired: app.hired,
      rivalScore,
      event: app.event,
    });
    showResult(app.screenHost, app.state, close, () => openRecruit(app, app.mode), () => openHub(app));
  }
};

/**
 * O RECRUTAMENTO abre uma edicao nova: semente nova (daqui saem candidatos,
 * projeto e layout — a sim nunca ve relogio, so a semente congelada), seis
 * curriculos na tela, e a equipe contratada entra na run como argumento.
 */
const openRecruit = (app: App, mode: Mode): void => {
  clearScreens(app.screenHost);
  app.phase = 'recruit';
  app.mode = mode;
  // DAILY: a semente do dia UTC, igual para todo mundo. Nos outros modos, o
  // relogio e lido UMA vez aqui — a sim nunca ve tempo real.
  app.seed = mode === 'daily' ? dailySeed(todayUTC()) : (Date.now() ^ 0xca7a7040) >>> 0;
  const career = mode === 'career' ? loadCareer() : null;
  const budget = career ? career.wallet : RUN_BUDGET;
  const project = rollProject(app.seed, getLocale());
  const layout = rollLayout(app.seed);
  const candidates = rollCandidates(app.seed, getLocale());
  // EVOLUCAO DO JUNIOR entre runs: um alumnus (deterministico pela semente)
  // toma a vaga do primeiro curinga — mesmo gato, agora pleno, com desconto.
  if (career && career.alumni.length > 0) {
    const alum = career.alumni[app.seed % career.alumni.length]!;
    candidates[4] = returningCandidate(alum, getLocale());
  }
  // O RIVAL nasce na primeira edicao de carreira; o SPONSOR so procura quem
  // a reputacao ja apresentou. Nada disso existe no quick/daily — a
  // comparacao justa do daily nao pode depender da tua carreira.
  const rival = career ? ensureRival(career, app.seed) : null;
  const taunts = RIVAL_TAUNT_TEXT[getLocale()];
  // O PALCO desta edicao: a carreira joga o maior evento que a reputacao ja
  // abriu, com a identidade DECLARADA no convite (patas, premiacao).
  app.event = career ? eventForRep(career.rep) : null;
  const evText = app.event ? CIRCUIT_TEXT[getLocale()][app.event.id]! : null;
  showRecruit(
    app.screenHost,
    candidates,
    rollGearOffers(app.seed),
    budget,
    { name: project.name, brief: project.brief, emphasis: project.emphasis },
    layout.name,
    {
      sponsor: career ? rollSponsorOffer(app.seed, career.rep) : null,
      rivalLine: rival ? t().rivalIntro(rival.name, taunts[app.seed % taunts.length]!) : null,
      rosterLine: rival && rival.roster.length > 0 ? t().rivalRoster(rival.roster.join(', ')) : null,
      special: rollSpecialCategory(app.seed),
      eventLine:
        app.event && evText
          ? t().eventInvite(
              evText.name,
              evText.blurb,
              '●'.repeat(app.event.paws) + '○'.repeat(5 - app.event.paws),
              String(app.event.prizeScale)
            )
          : null,
    },
    (hired, gear, sponsor) => startRun(app, hired, gear, sponsor)
  );
};

const startRun = (
  app: App,
  team: readonly Candidate[],
  gear: readonly GearId[],
  sponsor: SponsorContract | null
): void => {
  clearScreens(app.screenHost);
  stopGameAudio(app.audio);
  startGameAudio(app.audio);
  app.hired = team;
  app.sponsor = sponsor;
  // O adiantamento do sponsor ABATE o gasto da edicao: dinheiro que entrou
  // junto com a letra miuda. Pode ate deixar o saldo positivo.
  app.spent =
    team.reduce((s, c) => s + c.cost, 0) +
    gear.reduce((s, g) => {
      const offer = rollGearOffers(app.seed).find((o) => o.id === g);
      return s + (offer?.cost ?? 0);
    }, 0) -
    (sponsor?.budget ?? 0);
  app.state = createHackathon(app.seed, team, { locale: getLocale(), gear, sponsor, circuit: app.event });
  bindTeam(app.hud, app.state.cats);
  app.input.selected = null;
  app.input.queue.length = 0;
  app.phase = 'playing';
};

const frame = (app: App, now: number): void => {
  const delta = Math.min(200, now - (app.lastFrame || now));
  app.lastFrame = now;

  if (app.phase === 'playing') {
    app.accumulator += delta;
    let steps = 0;
    while (app.accumulator >= TICK_MS && steps < 6) {
      tickGame(app);
      app.accumulator -= TICK_MS;
      steps++;
      if (app.phase !== 'playing') break;
    }
    drawHud(app.hud, app.state);
    drawCard(app.hud, app.state, app.input.selected);
    // O botao de petisco pulsa enquanto armado: o proximo toque num gato
    // alimenta, e o jogador precisa VER que o modo esta ligado.
    app.hud.treatsBtn.classList.toggle('armed', app.input.feedArmed);
    app.hud.catnipBtn.classList.toggle('armed', app.input.catnipArmed);
    app.hud.root.hidden = false;
  } else {
    app.accumulator = 0;
    app.hud.root.hidden = app.phase === 'title' || app.phase === 'recruit';
  }

  drawScene(app.view, app.state, app.state.tick, app.input.selected, getLocale());
  if (app.phase === 'playing') drawHand(app.view, app.input.x, app.input.y, app.state.held !== null);
  presentToCanvas(app.ctx, app.view.surface);
  app.frameHandle = requestAnimationFrame((t) => frame(app, t));
};

export const createApp = (canvas: HTMLCanvasElement, hudHost: HTMLElement, screenHost: HTMLElement): App => {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d indisponivel');
  canvas.width = 480;
  canvas.height = 270;

  const input = createInput();
  const audio = createAudioEngine();
  const app: App = {
    seed: 20260821,
    canvas,
    ctx,
    view: createView(),
    // A cena do titulo: o time classico no booth original.
    state: createHackathon(20260821, CLASSIC_TEAM, { classic: true, locale: getLocale() }),
    input,
    hud: createHud(hudHost, {
      onCut: (taskId) => input.queue.push({ cut: taskId }),
      onFeedToggle: () => {
        input.feedArmed = !input.feedArmed;
        if (input.feedArmed) input.catnipArmed = false;
      },
      onLevel: (bus, level) => setLevel(audio, bus as BusId, level),
      levels: () => getLevels(audio),
      // Selecao pelos retratos da equipe: sem cacar 22 pixels em movimento.
      onSelect: (cat) => {
        input.selected = input.selected === cat ? null : cat;
      },
      onChoose: (task, option) => input.queue.push({ choose: { task, option } }),
      onAbility: (cat) => input.queue.push({ ability: cat }),
      // Armar o catnip desarma o petisco (e vice-versa): uma mao, um modo.
      onCatnipToggle: () => {
        input.catnipArmed = !input.catnipArmed;
        if (input.catnipArmed) input.feedArmed = false;
      },
      onLaser: () => input.queue.push({ laser: true }),
      onSocial: (option) => input.queue.push({ social: option }),
      // O STRETCH SPRINT: congelar a submissao ou topar a oportunidade.
      onFreeze: () => input.queue.push({ freeze: true }),
      onStretch: () => input.queue.push({ stretch: true }),
    }),
    audio,
    screenHost,
    phase: 'title',
    mode: 'career',
    spent: 0,
    hired: CLASSIC_TEAM,
    sponsor: null,
    event: null,
    accumulator: 0,
    lastFrame: 0,
    frameHandle: 0,
    detach: [],
  };

  app.detach.push(attachInput(input, canvas, () => app.state, () => performance.now()));
  app.detach.push(attachKeyboard(input, () => app.state));
  window.addEventListener('pointerdown', () => unlockAudio(app.audio), { once: true });
  window.addEventListener('touchstart', () => unlockAudio(app.audio), { once: true, passive: true });

  openTitle(app);

  return app;
};

/** A tela de titulo, com a porta para a CENTRAL DA CARREIRA. */
const openTitle = (app: App): void => {
  clearScreens(app.screenHost);
  app.phase = 'title';
  showTitle(
    app.screenHost,
    (mode) => openRecruit(app, mode),
    () => openHub(app)
  );
};

/** A Central: a jornada visivel — e as portas de volta para o jogo. */
const openHub = (app: App): void => {
  clearScreens(app.screenHost);
  app.phase = 'title';
  showHub(app.screenHost, loadCareer(), {
    onBack: () => openTitle(app),
    onPlay: (mode) => openRecruit(app, mode),
  });
};

export const start = (app: App): void => {
  app.frameHandle = requestAnimationFrame((t) => frame(app, t));
};
