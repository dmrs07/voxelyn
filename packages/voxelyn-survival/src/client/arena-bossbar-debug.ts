// O MODO DE INSPECAO DA BARRA DE CHEFE na arena de teste.
//
// Duas ferramentas, e a separacao e o ponto:
//
// 1. CENARIOS AO VIVO (`BossBarScenarioDriver`) — agem sobre o estado
//    AUTORITATIVO da luta corrente pelo mesmo funil que a simulacao usa
//    (`damageEntity`, eventos semanticos, os bits de fase, os humores do
//    Leviata e do Devorador). O que se ve depois e o que o jogo faria: a
//    barra le o estado e os eventos do tick, nunca um valor injetado nela.
//
// 2. A GALERIA (`BossBarGallery`) — todos os chefes lado a lado, com a mesma
//    estrutura e os respectivos acentos, num canvas com a viewport que se
//    quiser (desktop, paisagem, retrato) e o cenario que se quiser (entrada,
//    cheia, dano, cura, fase, veu, morte). Nada aqui e importado pelo jogo:
//    durante o gameplay real so o chefe ativo aparece.
import {
  BOSS_ARCHETYPES,
  BOSS_PHASE_CHOIR,
  BOSS_PHASE_DELUGE,
  BOSS_PHASE_OVERHEAT,
  BOSS_PHASE_REACTOR,
  BOSS_PHASE_SUMMON,
  BOSS_PHASE_UNSTABLE,
  DEVOURER_BURROWED,
  LEVIATHAN_ANCHORED,
  LEVIATHAN_HIDDEN,
  damageEntity,
  type EnemyArchetype,
  type Entity,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { BossHealthBarPresentation, drawBossHealthBar, resolveSectorBoss } from './boss-health-bar';
import { bossHealthBarLayout, type BossHealthBarLayout } from './boss-health-bar-layout';
import { bossBarAccent } from './boss-health-bar-palette';
import { touchControlGeometry, AIM_JOYSTICK_RADIUS, MOVE_JOYSTICK_RADIUS } from './input';
import { PAL } from './palette';
import { t } from './i18n';

// ---------------------------------------------------------------------------
// Cenarios ao vivo
// ---------------------------------------------------------------------------

export type BossBarScenario =
  | 'sleep'
  | 'awaken'
  | 'full'
  | 'hitSmall'
  | 'hitBig'
  | 'burst'
  | 'heal'
  | 'phase'
  | 'hide'
  | 'offscreen'
  | 'kill';

/** Os cenarios, na ordem do painel. Os rotulos vivem em `arena-main.ts`. */
export const BOSS_BAR_SCENARIOS: readonly BossBarScenario[] = [
  'sleep',
  'awaken',
  'full',
  'hitSmall',
  'hitBig',
  'burst',
  'heal',
  'phase',
  'hide',
  'offscreen',
  'kill',
];

const PHASE_BITS = [
  BOSS_PHASE_SUMMON,
  BOSS_PHASE_REACTOR,
  BOSS_PHASE_OVERHEAT,
  BOSS_PHASE_UNSTABLE,
  BOSS_PHASE_DELUGE,
  BOSS_PHASE_CHOIR,
];

/**
 * Aplica um cenario ao estado autoritativo e devolve os eventos que a
 * simulacao emitiria — para passarem pelo mesmo funil (renderer e audio) que
 * os de verdade. Alguns cenarios (a rajada) se espalham por varios ticks:
 * `tick()` deve ser chamado uma vez por tick simulado para esgota-los.
 */
export class BossBarScenarioDriver {
  /** Golpes pendentes da rajada, um por tick, como fracao da vida maxima. */
  private pending: number[] = [];

  reset(): void {
    this.pending = [];
  }

  apply(state: SurvivalState, scenario: BossBarScenario): SemanticEvent[] {
    const events: SemanticEvent[] = [];
    const boss = resolveSectorBoss(state);
    if (!boss) return events;
    switch (scenario) {
      case 'sleep':
        state.bossRuntime.awake = false;
        boss.hp = boss.maxHp;
        break;
      case 'awaken':
        if (!state.bossRuntime.awake) {
          state.bossRuntime.awake = true;
          events.push({
            t: 'boss_awake',
            archetype: boss.archetype as EnemyArchetype,
            x: boss.x,
            y: boss.y,
          });
        }
        break;
      case 'full':
        boss.hp = boss.maxHp;
        break;
      case 'hitSmall':
        this.hit(state, boss, 0.03, events);
        break;
      case 'hitBig':
        this.hit(state, boss, 0.18, events);
        break;
      case 'burst':
        this.pending.push(0.04, 0.03, 0.05, 0.04);
        break;
      case 'heal': {
        const amount = Math.min(boss.maxHp - boss.hp, boss.maxHp * 0.12);
        if (amount > 0) {
          boss.hp += amount;
          events.push({ t: 'heal', x: boss.x, y: boss.y, entity: boss.id, amount });
        }
        break;
      }
      case 'phase': {
        const next = PHASE_BITS.find((bit) => (state.bossRuntime.phasesFired & bit) === 0);
        if (next !== undefined) {
          state.bossRuntime.phasesFired |= next;
          events.push({
            t: 'boss_phase',
            archetype: boss.archetype as EnemyArchetype,
            phase: next,
            x: boss.x,
            y: boss.y,
          });
        }
        break;
      }
      case 'hide':
        if (boss.archetype === 'sheet_leviathan') {
          boss.mood = LEVIATHAN_HIDDEN;
          boss.action = undefined;
          state.bossRuntime.leviathanDest = -1;
          state.bossRuntime.leviathanSurfaceAt = -1;
        } else if (boss.archetype === 'white_devourer') {
          boss.mood = DEVOURER_BURROWED;
          boss.action = undefined;
        }
        break;
      case 'offscreen': {
        // Longe da camera, dentro do mapa: a barra nao pode depender de o corpo
        // estar na tela.
        const w = state.config.width;
        const h = state.config.height;
        boss.x = Math.max(1.5, Math.min(w - 1.5, state.player.x + 26));
        boss.y = Math.max(1.5, Math.min(h - 1.5, state.player.y + 26));
        boss.action = undefined;
        break;
      }
      case 'kill':
        // Pelo funil de dano: o evento de morte, a derrota do setor e o resto da
        // contabilidade saem da simulacao, nao daqui.
        this.pending = [];
        damageEntity(state, boss, boss.hp + 1, events);
        break;
    }
    return events;
  }

  /** Um tick simulado passou: aplica o proximo golpe pendente da rajada. */
  tick(state: SurvivalState): SemanticEvent[] {
    const next = this.pending.shift();
    if (next === undefined) return [];
    const boss = resolveSectorBoss(state);
    if (!boss) return [];
    const events: SemanticEvent[] = [];
    this.hit(state, boss, next, events);
    return events;
  }

  private hit(state: SurvivalState, boss: Entity, fraction: number, events: SemanticEvent[]): void {
    // Sem passar do golpe fatal: quem quer matar usa `kill`.
    const amount = Math.min(boss.hp - 1, boss.maxHp * fraction);
    if (amount <= 0) return;
    damageEntity(state, boss, amount, events);
  }
}

/** A leitura exata do que a barra esta vendo, para o painel. */
export type BossBarReadout = {
  archetype: string | null;
  awake: boolean;
  defeated: boolean;
  hp: number | null;
  maxHp: number | null;
  phases: number;
  entityIdNull: boolean;
  material: string;
};

export const bossBarReadout = (state: SurvivalState): BossBarReadout => {
  const boss = resolveSectorBoss(state);
  return {
    archetype: state.sectorBoss.archetype,
    awake: state.bossRuntime.awake,
    defeated: state.sectorBoss.defeated,
    hp: boss ? Math.round(boss.hp * 10) / 10 : null,
    maxHp: boss ? boss.maxHp : null,
    phases: state.bossRuntime.phasesFired,
    entityIdNull: state.sectorBoss.entityId === null,
    material: t(bossBarAccent(state.sectorBoss.archetype).materialKey),
  };
};

// ---------------------------------------------------------------------------
// A galeria
// ---------------------------------------------------------------------------

export type GalleryScenario = 'entry' | 'full' | 'hit' | 'heal' | 'phase' | 'veiled' | 'death';
export const GALLERY_SCENARIOS: readonly GalleryScenario[] = [
  'entry',
  'full',
  'hit',
  'heal',
  'phase',
  'veiled',
  'death',
];

export type GalleryViewport = 'desktop' | 'desktopHd' | 'ultrawide' | 'landscape' | 'portrait';
/** As viewports da galeria. Os rotulos vivem em `arena-main.ts`. */
export const GALLERY_VIEWPORTS: Record<
  GalleryViewport,
  { width: number; height: number; touch: boolean }
> = {
  desktop: { width: 1366, height: 768, touch: false },
  desktopHd: { width: 1920, height: 1080, touch: false },
  ultrawide: { width: 2560, height: 1080, touch: false },
  landscape: { width: 568, height: 320, touch: true },
  portrait: { width: 320, height: 568, touch: true },
};

/** O periodo de cada cenario animado; no fim ele recomeca. */
export const GALLERY_LOOP_MS = 4200;

type GalleryFixture = {
  state: SurvivalState;
  boss: Entity;
  bar: BossHealthBarPresentation;
  /** O ultimo passo do roteiro ja aplicado neste laco. */
  step: number;
  loopStart: number;
};

/** O humor "em repouso, visivel" de cada chefe — o que nao poe veu na barra. */
const restMood = (archetype: string): number =>
  archetype === 'sheet_leviathan' ? LEVIATHAN_ANCHORED : 1;

const fixtureFor = (archetype: string): GalleryFixture => {
  const boss = {
    id: 7,
    kind: 'enemy',
    archetype,
    x: 10,
    y: 10,
    vx: 0,
    vy: 0,
    hp: 1000,
    maxHp: 1000,
    radius: 1,
    alive: true,
    elite: false,
    nextActionAt: 0,
    contactReadyAt: 0,
    beamReadyAt: 0,
    rangedReadyAt: 0,
    stunnedUntil: 0,
    alertedUntil: 0,
    facing: { x: 1, y: 0 },
    mood: restMood(archetype),
  } as Entity;
  const state = {
    config: { seed: 1, width: 64, height: 64 },
    sector: 1,
    tick: 0,
    sectorBoss: { archetype, entityId: null, defeated: false },
    bossRuntime: { awake: true, phasesFired: 0 },
    enemies: [boss],
  } as unknown as SurvivalState;
  return { state, boss, bar: new BossHealthBarPresentation(), step: -1, loopStart: 0 };
};

/**
 * O ROTEIRO de cada cenario: passos (instante no laco, acao). Cada passo roda
 * uma vez por laco; no fim do periodo a ficha e reposta e o laco recomeca.
 */
type Step = { at: number; run: (f: GalleryFixture) => void };
const SCRIPTS: Record<GalleryScenario, Step[]> = {
  entry: [
    {
      at: 0,
      run: (f) => {
        f.state.bossRuntime.awake = false;
      },
    },
    {
      at: 400,
      run: (f) => {
        f.state.bossRuntime.awake = true;
      },
    },
  ],
  full: [],
  hit: [
    { at: 700, run: (f) => (f.boss.hp -= 140) },
    { at: 1600, run: (f) => (f.boss.hp -= 35) },
    { at: 1900, run: (f) => (f.boss.hp -= 30) },
    { at: 2150, run: (f) => (f.boss.hp -= 45) },
    { at: 3100, run: (f) => (f.boss.hp -= 220) },
  ],
  heal: [
    { at: 0, run: (f) => (f.boss.hp = 420) },
    { at: 900, run: (f) => (f.boss.hp += 40) },
    { at: 1050, run: (f) => (f.boss.hp += 40) },
    { at: 1200, run: (f) => (f.boss.hp += 40) },
    { at: 1350, run: (f) => (f.boss.hp += 40) },
    { at: 2600, run: (f) => (f.boss.hp -= 90) },
  ],
  phase: [
    { at: 0, run: (f) => (f.boss.hp = 560) },
    { at: 1000, run: (f) => (f.state.bossRuntime.phasesFired |= BOSS_PHASE_SUMMON) },
  ],
  veiled: [
    { at: 0, run: (f) => (f.boss.hp = 700) },
    {
      at: 800,
      run: (f) => {
        if (f.boss.archetype === 'sheet_leviathan') f.boss.mood = LEVIATHAN_HIDDEN;
        if (f.boss.archetype === 'white_devourer') f.boss.mood = DEVOURER_BURROWED;
      },
    },
    { at: 2900, run: (f) => (f.boss.mood = restMood(f.boss.archetype)) },
  ],
  death: [
    { at: 0, run: (f) => (f.boss.hp = 90) },
    {
      at: 900,
      run: (f) => {
        f.boss.hp = 0;
        f.boss.alive = false;
        f.state.sectorBoss.defeated = true;
      },
    },
  ],
};

export class BossBarGallery {
  scenario: GalleryScenario = 'full';
  viewport: GalleryViewport = 'desktop';
  reducedMotion = false;
  /** Um chefe so, na posicao real do rodape (com os controles desenhados); ou todos, empilhados. */
  single: string | null = null;
  private readonly fixtures = new Map<string, GalleryFixture>();

  constructor(private readonly canvas: HTMLCanvasElement) {}

  /** Recomeca todos os lacos (troca de cenario, de viewport, de lingua). */
  restart(): void {
    this.fixtures.clear();
  }

  private fixture(archetype: string, nowMs: number): GalleryFixture {
    let f = this.fixtures.get(archetype);
    if (!f) {
      f = fixtureFor(archetype);
      f.loopStart = nowMs;
      this.fixtures.set(archetype, f);
    }
    return f;
  }

  /** Avanca o roteiro do chefe ate `nowMs` e sincroniza a barra. */
  private drive(f: GalleryFixture, nowMs: number): void {
    const script = SCRIPTS[this.scenario];
    let u = nowMs - f.loopStart;
    if (u >= GALLERY_LOOP_MS && script.length > 0) {
      // Laco novo: ficha nova, barra nova.
      const fresh = fixtureFor(f.boss.archetype);
      f.state = fresh.state;
      f.boss = fresh.boss;
      f.bar = fresh.bar;
      f.step = -1;
      f.loopStart = nowMs;
      u = 0;
    }
    for (let i = f.step + 1; i < script.length; i++) {
      if (script[i].at > u) break;
      script[i].run(f);
      f.step = i;
    }
    f.boss.hp = Math.max(0, Math.min(f.boss.maxHp, f.boss.hp));
    f.state.tick += 1;
    f.bar.sync(f.state, nowMs);
  }

  render(nowMs: number): void {
    const vp = GALLERY_VIEWPORTS[this.viewport];
    const canvas = this.canvas;
    if (canvas.width !== vp.width || canvas.height !== vp.height) {
      canvas.width = vp.width;
      canvas.height = vp.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(0, 0, vp.width, vp.height);
    const layout = bossHealthBarLayout({
      viewportWidth: vp.width,
      viewportHeight: vp.height,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      touchMode: vp.touch,
    });
    // Viewport pequena demais: a barra nao existe, e a galeria mostra o vazio —
    // que e exatamente o que o jogo mostraria.
    if (!layout.visible) return;
    if (vp.touch) drawTouchFootprints(ctx, vp.width, vp.height);
    else drawControlBarFootprint(ctx, vp.width, vp.height);

    const archetypes = this.single ? [this.single] : [...BOSS_ARCHETYPES];
    if (this.single) {
      const f = this.fixture(this.single, nowMs);
      this.drive(f, nowMs);
      const view = f.bar.view(nowMs, this.reducedMotion);
      if (view) drawBossHealthBar(ctx, layout, view, { reducedMotion: this.reducedMotion });
      return;
    }
    // Todos, empilhados de baixo para cima a partir da posicao real, com um
    // rotulo de material a direita do nome — inspecao, nao gameplay.
    const rowH = layout.height + 16;
    for (let i = 0; i < archetypes.length; i++) {
      const archetype = archetypes[i];
      const f = this.fixture(archetype, nowMs);
      this.drive(f, nowMs);
      const view = f.bar.view(nowMs, this.reducedMotion);
      const dy = -(archetypes.length - 1 - i) * rowH;
      // A peca inteira precisa caber; se a tela for baixa, as de cima saem
      // pela borda — melhor do que encolhe-las e mentir a escala.
      ctx.save();
      ctx.translate(0, dy);
      if (view) drawBossHealthBar(ctx, layout, view, { reducedMotion: this.reducedMotion });
      if (layout.ornament !== 'none') {
        ctx.fillStyle = 'rgba(184,169,143,0.55)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(
          t(bossBarAccent(archetype).materialKey),
          layout.bed.x + layout.bed.width,
          layout.name.baseline,
        );
      }
      ctx.restore();
    }
  }
}

/** Os controles de toque, como marcas fantasma: o que a barra nao pode cobrir. */
const drawTouchFootprints = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  const g = touchControlGeometry(w, h);
  ctx.save();
  ctx.strokeStyle = 'rgba(232,241,255,0.22)';
  ctx.lineWidth = 1;
  const circle = (cx: number, cy: number, r: number): void => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  };
  circle(g.moveX, g.moveY, MOVE_JOYSTICK_RADIUS);
  circle(g.aimX, g.aimY, AIM_JOYSTICK_RADIUS);
  circle(g.dodgeX, g.aimY, g.buttonRadius);
  circle(g.aimX - g.step * 2, g.actionY, g.buttonRadius);
  circle(g.aimX - g.step, g.actionY, g.buttonRadius);
  circle(g.aimX, g.actionY, g.buttonRadius);
  ctx.restore();
};

const drawControlBarFootprint = (ctx: CanvasRenderingContext2D, w: number, h: number): void => {
  ctx.save();
  ctx.strokeStyle = 'rgba(232,241,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(w / 2 - 220) + 0.5, h - 12 - 40 + 0.5, 440, 40);
  ctx.restore();
};

export type { BossHealthBarLayout };
