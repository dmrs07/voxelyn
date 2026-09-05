// A BARRA DE VIDA DOS CHEFES: selecao, estado visual e desenho, sem Canvas.
//
// O que este arquivo protege e o contrato que a HUD faz com o jogador quando
// um chefe desperta: a barra existe enquanto o encontro existir (cheia, fora
// da camera, submersa), mostra o HP AUTORITATIVO do tick apresentado, nunca
// anima uma diferenca que nao foi dano (snapshot repetido, resync, cura), e
// termina a historia da morte mesmo depois de o corpo sair da lista. E o
// dono do setor nao tem DUAS barras.
import { describe, expect, it } from 'vitest';
import {
  BOSS_ARCHETYPES,
  BOSS_PHASE_SUMMON,
  DEVOURER_BURROWED,
  LEVIATHAN_HIDDEN,
  type Entity,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  BOSS_BAR_DEATH_EXIT_MS,
  BOSS_BAR_DEATH_HOLD_MS,
  BOSS_BAR_ECHO_HOLD_MS,
  BOSS_BAR_ECHO_RECEDE_MAX_MS,
  BOSS_BAR_ENTRY_INSTANT_MS,
  BOSS_BAR_ENTRY_MS,
  BOSS_BAR_RESYNC_TICK_GAP,
  BossHealthBarPresentation,
  bossBarNameKey,
  bossBodyVeiled,
  bossHealthBarTarget,
  clampHp,
  drawBossHealthBar,
  resolveSectorBoss,
  usesMonumentalBar,
} from '../client/boss-health-bar';
import { bossHealthBarLayout } from '../client/boss-health-bar-layout';
import {
  BOSS_BAR_LIFE,
  NEUTRAL_BOSS_BAR_ACCENT,
  bossBarAccent,
  hasBossBarAccent,
} from '../client/boss-health-bar-palette';
import { LOCALES, setLocale, t } from '../client/i18n';
import { PT_BR } from '../client/i18n/locales/pt-BR';
import { EN } from '../client/i18n/locales/en';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Um estado MINIMO: so o que a barra le. `as SurvivalState` porque montar o
// mundo inteiro para testar uma HUD e testar o worldgen, nao a HUD.
// ---------------------------------------------------------------------------
type Fixture = {
  state: SurvivalState;
  boss: Entity;
};

const enemy = (id: number, archetype: string, hp: number, maxHp = hp): Entity =>
  ({
    id,
    kind: 'enemy',
    archetype,
    x: 10,
    y: 10,
    vx: 0,
    vy: 0,
    hp,
    maxHp,
    radius: 0.5,
    alive: true,
    elite: false,
    nextActionAt: 0,
    contactReadyAt: 0,
    rangedReadyAt: 0,
    stunnedUntil: 0,
    alertedUntil: 0,
    facing: { x: 1, y: 0 },
  }) as Entity;

const fixture = (archetype = 'guardian', opts: { awake?: boolean; hp?: number } = {}): Fixture => {
  const boss = enemy(7, archetype, opts.hp ?? 400, 400);
  const state = {
    config: { seed: 11, width: 96, height: 96 },
    sector: 3,
    tick: 100,
    sectorBoss: { archetype, entityId: null, defeated: false },
    bossRuntime: { awake: opts.awake ?? true, phasesFired: 0 },
    enemies: [enemy(3, 'stalker', 12, 20), boss],
  } as unknown as SurvivalState;
  return { state, boss };
};

/** Avanca `ms` no relogio e um tick por 50 ms na simulacao. */
const advance = (f: Fixture, from: number, ms: number): number => {
  f.state.tick += Math.max(1, Math.round(ms / 50));
  return from + ms;
};

describe('selecao do chefe', () => {
  it('resolve por arquetipo mesmo com sectorBoss.entityId nulo (espelho online)', () => {
    const f = fixture();
    expect(f.state.sectorBoss.entityId).toBeNull();
    expect(resolveSectorBoss(f.state)).toBe(f.boss);
  });

  it('nao resolve quem ja caiu, quem nao esta vivo, nem um setor sem dono', () => {
    const f = fixture();
    f.state.sectorBoss.defeated = true;
    expect(resolveSectorBoss(f.state)).toBeNull();
    f.state.sectorBoss.defeated = false;
    f.boss.alive = false;
    expect(resolveSectorBoss(f.state)).toBeNull();
    const g = fixture();
    g.state.sectorBoss.archetype = null;
    expect(resolveSectorBoss(g.state)).toBeNull();
  });

  it('chefe acordado com HP cheio e alvo da barra; dormindo e cheio nao e', () => {
    const awake = fixture('guardian', { awake: true });
    expect(bossHealthBarTarget(awake.state)).toBe(awake.boss);
    const asleep = fixture('guardian', { awake: false });
    expect(bossHealthBarTarget(asleep.state)).toBeNull();
  });

  it('chefe derrotado nao e alvo', () => {
    const f = fixture();
    f.state.sectorBoss.defeated = true;
    expect(bossHealthBarTarget(f.state)).toBeNull();
  });

  it('o dono do setor nao recebe a barra local; o resto do bestiario recebe', () => {
    const f = fixture();
    expect(usesMonumentalBar(f.state, f.boss)).toBe(true);
    expect(usesMonumentalBar(f.state, f.state.enemies[0])).toBe(false);
    // Um elite muito resistente continua sendo um inimigo comum para a HUD.
    const elite = enemy(9, 'bruiser', 900, 900);
    elite.elite = true;
    expect(usesMonumentalBar(f.state, elite)).toBe(false);
    // Um chefe de OUTRO bioma solto no mapa (nao guarda este setor) idem.
    expect(usesMonumentalBar(f.state, enemy(10, 'bishop', 260))).toBe(false);
  });

  it('render.ts guarda a barra local do inimigo com usesMonumentalBar', () => {
    const src = readFileSync(join(HERE, '..', 'client', 'render.ts'), 'utf8');
    const call = src.indexOf('drawHealthBar(sx, bodyY - size * 2.1');
    expect(call).toBeGreaterThan(0);
    const guard = src.lastIndexOf('usesMonumentalBar(state, enemy)', call);
    expect(guard).toBeGreaterThan(0);
    expect(call - guard).toBeLessThan(400);
    // E a barra monumental e desenhada por ULTIMO, sobre a HUD.
    expect(src.indexOf('this.renderBossHealthBar(')).toBeGreaterThan(
      src.indexOf('this.renderHud('),
    );
  });

  it('HP fica preso a 0..maxHp', () => {
    expect(clampHp(-5, 100)).toBe(0);
    expect(clampHp(150, 100)).toBe(100);
    expect(clampHp(40, 100)).toBe(40);
    expect(clampHp(10, -3)).toBe(0);
  });

  it('o veu segue so o que a simulacao decide', () => {
    const lev = enemy(1, 'sheet_leviathan', 100);
    lev.mood = LEVIATHAN_HIDDEN;
    expect(bossBodyVeiled(lev, 0)).toBe(true);
    const dev = enemy(2, 'white_devourer', 100);
    dev.mood = DEVOURER_BURROWED;
    expect(bossBodyVeiled(dev, 0)).toBe(true);
    expect(bossBodyVeiled(enemy(3, 'guardian', 100), 0)).toBe(false);
  });
});

describe('a apresentacao', () => {
  it('chefe acordado mostra a barra mesmo com HP cheio, com o ritual quando o viu dormir', () => {
    const f = fixture('guardian', { awake: false });
    const bar = new BossHealthBarPresentation();
    let now = 1000;
    bar.sync(f.state, now);
    expect(bar.view(now, false)).toBeNull();
    f.state.bossRuntime.awake = true;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    const v = bar.view(now, false);
    expect(v).not.toBeNull();
    expect(v!.hpFrac).toBe(1);
    expect(v!.echoFrac).toBe(1);
    expect(v!.entry.ritual).toBe(true);
    expect(v!.entry.progress).toBe(0);
    expect(bar.view(now + BOSS_BAR_ENTRY_MS, false)!.entry.progress).toBe(1);
  });

  it('o evento boss_awake tambem dispara o ritual', () => {
    const f = fixture('bishop', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.ingestEvents([{ t: 'boss_awake', archetype: 'bishop', x: 1, y: 1 }], 500);
    f.state.bossRuntime.awake = true;
    bar.sync(f.state, 520);
    expect(bar.view(520, false)!.entry.ritual).toBe(true);
  });

  it('boss adormecido nao mostra; derrotado nao mostra', () => {
    const asleep = fixture('guardian', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.sync(asleep.state, 0);
    expect(bar.view(0, false)).toBeNull();
    const defeated = fixture('guardian');
    defeated.state.sectorBoss.defeated = true;
    const bar2 = new BossHealthBarPresentation();
    bar2.sync(defeated.state, 0);
    expect(bar2.view(0, false)).toBeNull();
  });

  it('reconnect (chefe ja acordado, sem evento) entra direto no HP atual, sem ritual', () => {
    const f = fixture('archcantor', { awake: true, hp: 130 });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 3000);
    const v = bar.view(3000, false)!;
    expect(v.entry.ritual).toBe(false);
    expect(v.hpFrac).toBeCloseTo(130 / 400);
    expect(v.echoFrac).toBeCloseTo(130 / 400);
    expect(bar.view(3000 + BOSS_BAR_ENTRY_INSTANT_MS, false)!.entry.progress).toBe(1);
  });

  it('fora da camera e escondido a barra persiste (a posicao nao entra na conta)', () => {
    const f = fixture('sheet_leviathan');
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.boss.x = -500;
    f.boss.y = 900;
    f.boss.mood = LEVIATHAN_HIDDEN;
    bar.sync(f.state, 16);
    const v = bar.view(16, false)!;
    expect(v).not.toBeNull();
    expect(v.veiled).toBe(true);
    expect(v.hpFrac).toBe(1);
  });

  it('dano cria um eco do tamanho exato do golpe, segura e recua', () => {
    const f = fixture();
    const bar = new BossHealthBarPresentation();
    let now = 0;
    bar.sync(f.state, now);
    f.boss.hp = 300; // -100 de 400
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    let v = bar.view(now, false)!;
    expect(v.hpFrac).toBeCloseTo(0.75);
    expect(v.echoFrac).toBeCloseTo(1);
    expect(v.hit).not.toBeNull();
    expect(v.hit!.strength).toBeCloseTo(0.25);
    // Segura durante o hold.
    now = advance(f, now, BOSS_BAR_ECHO_HOLD_MS - 20);
    bar.sync(f.state, now);
    expect(bar.view(now, false)!.echoFrac).toBeCloseTo(1);
    // Recua depois...
    now = advance(f, now, 200);
    bar.sync(f.state, now);
    v = bar.view(now, false)!;
    expect(v.echoFrac).toBeLessThan(1);
    expect(v.echoFrac).toBeGreaterThan(0.75);
    // ...e alcanca a vida.
    now = advance(f, now, BOSS_BAR_ECHO_RECEDE_MAX_MS);
    bar.sync(f.state, now);
    expect(bar.view(now, false)!.echoFrac).toBeCloseTo(0.75);
  });

  it('snapshots repetidos (mesmo HP) nao recriam o dano', () => {
    const f = fixture();
    const bar = new BossHealthBarPresentation();
    let now = 0;
    bar.sync(f.state, now);
    f.boss.hp = 350;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    const seq = bar.view(now, false)!.hit!.seq;
    for (let i = 0; i < 5; i++) {
      now += 16; // mesmo tick, mesmo HP: um snapshot repetido
      bar.sync(f.state, now);
      const v = bar.view(now, false)!;
      expect(v.hit === null || v.hit.seq === seq).toBe(true);
    }
    // Um golpe NOVO e um seq novo.
    f.boss.hp = 340;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    expect(bar.view(now, false)!.hit!.seq).toBe(seq + 1);
  });

  it('cura nao e dano: sem eco, com marca de cura no sentido oposto', () => {
    const f = fixture('bishop', { hp: 200 });
    const bar = new BossHealthBarPresentation();
    let now = 0;
    bar.sync(f.state, now);
    f.boss.hp = 260;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    const v = bar.view(now, false)!;
    expect(v.hit).toBeNull();
    expect(v.hpFrac).toBeCloseTo(0.65);
    expect(v.echoFrac).toBeCloseTo(0.65);
    expect(v.heal).not.toBeNull();
    expect(v.heal!.fromFrac).toBeCloseTo(0.5);
    expect(v.heal!.toFrac).toBeCloseTo(0.65);
    // Regeneracao em passos: a marca cresce a partir de onde comecou.
    f.boss.hp = 280;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    expect(bar.view(now, false)!.heal!.fromFrac).toBeCloseTo(0.5);
    expect(bar.view(now, false)!.heal!.toFrac).toBeCloseTo(0.7);
  });

  it('fase nao reseta o HP; so marca a varredura', () => {
    const f = fixture('guardian', { hp: 220 });
    const bar = new BossHealthBarPresentation();
    let now = 0;
    bar.sync(f.state, now);
    expect(bar.view(now, false)!.phase).toBeNull();
    f.state.bossRuntime.phasesFired |= BOSS_PHASE_SUMMON;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    const v = bar.view(now, false)!;
    expect(v.hpFrac).toBeCloseTo(0.55);
    expect(v.echoFrac).toBeCloseTo(0.55);
    expect(v.phase).not.toBeNull();
    // O evento da mesma virada, chegando pelo outro caminho, nao remarca.
    bar.ingestEvents(
      [{ t: 'boss_phase', archetype: 'guardian', phase: BOSS_PHASE_SUMMON }],
      now + 10,
    );
    expect(bar.view(now + 10, false)!.phase).toBeCloseTo(10 / 700);
  });

  it('reconnect no meio de uma fase ja disparada nao varre', () => {
    const f = fixture('furnace_heart', { hp: 100 });
    f.state.bossRuntime.phasesFired = BOSS_PHASE_SUMMON;
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    expect(bar.view(0, false)!.phase).toBeNull();
  });

  it('morte: a vida vai a zero na hora, a barra segura e depois some — sem o corpo', () => {
    const f = fixture('guardian', { hp: 30 });
    const bar = new BossHealthBarPresentation();
    let now = 0;
    bar.sync(f.state, now);
    // O golpe fatal: o evento chega no tick, o corpo sai da lista, a derrota e marcada.
    bar.ingestEvents(
      [
        {
          t: 'death',
          x: 1,
          y: 1,
          entity: 7,
          archetype: 'guardian',
          facingX: 1,
          facingY: 0,
          tick: 101,
        },
      ],
      now + 50,
    );
    f.state.enemies = f.state.enemies.filter((e) => e !== f.boss);
    f.state.sectorBoss.defeated = true;
    now = advance(f, now, 50);
    bar.sync(f.state, now);
    let v = bar.view(now, false)!;
    expect(v).not.toBeNull();
    expect(v.hpFrac).toBe(0);
    expect(v.echoFrac).toBeGreaterThan(0); // o eco ainda esta contando o golpe
    expect(v.death).not.toBeNull();
    expect(v.name).toBe(t('bestiary.name.guardian'));
    // Segura o estado final...
    now = advance(f, now, BOSS_BAR_DEATH_HOLD_MS - 100);
    bar.sync(f.state, now);
    v = bar.view(now, false)!;
    expect(v).not.toBeNull();
    expect(v.death!.exit).toBe(0);
    // ...e some depois da saida.
    now = advance(f, now, 100 + BOSS_BAR_DEATH_EXIT_MS + 10);
    bar.sync(f.state, now);
    expect(bar.view(now, false)).toBeNull();
  });

  it('morte sem evento: corpo removido com HP zero tambem fecha a historia', () => {
    const f = fixture('magnetarch', { hp: 10 });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.boss.hp = 0;
    f.state.tick += 1;
    bar.sync(f.state, 50);
    expect(bar.view(50, false)!.death).not.toBeNull();
    f.state.enemies = [];
    f.state.tick += 1;
    bar.sync(f.state, 100);
    expect(bar.view(100, false)!.death).not.toBeNull();
  });

  it('reset e troca de setor limpam o presenter na hora', () => {
    const f = fixture();
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    expect(bar.active).toBe(true);
    bar.reset();
    expect(bar.active).toBe(false);
    expect(bar.view(0, false)).toBeNull();

    const g = fixture();
    const bar2 = new BossHealthBarPresentation();
    bar2.sync(g.state, 0);
    g.state.sector = 4;
    g.state.sectorBoss = { archetype: null, entityId: null, defeated: false };
    g.state.enemies = [];
    bar2.sync(g.state, 16);
    expect(bar2.view(16, false)).toBeNull();
  });

  it('um corpo que some sem morrer nem trocar de setor solta a barra depois da folga', () => {
    const f = fixture();
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.state.enemies = [];
    f.state.tick += 1;
    bar.sync(f.state, 16);
    expect(bar.view(16, false)).not.toBeNull(); // um quadro sem corpo nao pisca
    f.state.tick += 6;
    bar.sync(f.state, 400);
    expect(bar.view(400, false)).toBeNull();
  });

  it('um salto de tick (resync) encaixa no HP novo sem eco', () => {
    const f = fixture('guardian', { hp: 400 });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.boss.hp = 90;
    f.state.tick += BOSS_BAR_RESYNC_TICK_GAP + 5;
    bar.sync(f.state, 3000);
    const v = bar.view(3000, false)!;
    expect(v.hpFrac).toBeCloseTo(90 / 400);
    expect(v.echoFrac).toBeCloseTo(90 / 400);
    expect(v.hit).toBeNull();
  });

  it('reducao de movimento elimina a montagem e o pulso do golpe', () => {
    const f = fixture('guardian', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.state.bossRuntime.awake = true;
    f.state.tick += 1;
    bar.sync(f.state, 50);
    const v = bar.view(50, true)!;
    expect(v.entry.ritual).toBe(false);
    expect(bar.view(50 + BOSS_BAR_ENTRY_INSTANT_MS, true)!.entry.progress).toBe(1);
    f.boss.hp = 300;
    f.state.tick += 1;
    bar.sync(f.state, 400);
    expect(bar.view(400, true)!.hit).toBeNull();
    expect(bar.view(400, false)!.hit).not.toBeNull();
  });

  it('a barra le o HP do estado apresentado, e nao um valor de evento', () => {
    // Um `hit` no chefe chega pela fila, mas o HP so muda quando o ESTADO do
    // tick apresentado muda — e o que impede o online de reproduzir um dano
    // que o playout ainda nao alcancou.
    const f = fixture();
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    bar.ingestEvents([{ t: 'hit', x: 1, y: 1, amount: 80, target: 7 }], 10);
    bar.sync(f.state, 16);
    expect(bar.view(16, false)!.hpFrac).toBe(1);
    expect(bar.view(16, false)!.hit).toBeNull();
  });
});

describe('nomes e acentos', () => {
  it('todo chefe tem nome em todos os locales', () => {
    for (const archetype of BOSS_ARCHETYPES) {
      const key = bossBarNameKey(archetype);
      expect(PT_BR[key as keyof typeof PT_BR]?.trim()).toBeTruthy();
      expect(EN[key as keyof typeof EN]?.trim()).toBeTruthy();
      for (const locale of LOCALES) {
        setLocale(locale);
        expect(t(key)).not.toBe(key);
        expect(t(key).trim().length).toBeGreaterThan(0);
      }
    }
    setLocale('pt-BR');
  });

  it('todo chefe tem acento proprio e valido; a vida continua sangue', () => {
    for (const archetype of BOSS_ARCHETYPES) {
      expect(hasBossBarAccent(archetype)).toBe(true);
      const acc = bossBarAccent(archetype);
      for (const hex of [acc.accent, acc.glow, acc.frame, acc.frameLight, acc.frameDark]) {
        expect(hex).toMatch(/^#[0-9a-f]{6}$/);
      }
      expect(PT_BR[acc.materialKey as keyof typeof PT_BR]?.trim()).toBeTruthy();
      expect(EN[acc.materialKey as keyof typeof EN]?.trim()).toBeTruthy();
      expect(['mineral', 'metal', 'crystal', 'fluid', 'ember', 'ice']).toContain(acc.tail);
    }
    expect(BOSS_BAR_LIFE).toBe('#d93b4c');
    expect(bossBarAccent('stalker')).toBe(NEUTRAL_BOSS_BAR_ACCENT);
    expect(bossBarAccent(null)).toBe(NEUTRAL_BOSS_BAR_ACCENT);
  });

  it('os acentos sao distintos entre si', () => {
    const accents = new Set(BOSS_ARCHETYPES.map((a) => bossBarAccent(a).accent));
    expect(accents.size).toBe(BOSS_ARCHETYPES.length);
  });
});

// ---------------------------------------------------------------------------
// Desenho: um contexto falso que grava os retangulos. A promessa e a fidelidade
// voxel — toda coordenada final e inteira — e que as fases desenham o que
// prometem (nada durante a fissura alem do fio; vida so depois da revelacao).
// ---------------------------------------------------------------------------
type Rect = [number, number, number, number];
const fakeCtx = (): { ctx: CanvasRenderingContext2D; rects: Rect[]; texts: string[] } => {
  const rects: Rect[] = [];
  const texts: string[] = [];
  const noop = (): void => {};
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    clip: noop,
    fillRect: (x: number, y: number, w: number, h: number) => {
      rects.push([x, y, w, h]);
    },
    fillText: (s: string) => {
      texts.push(s);
    },
    measureText: (s: string) => ({ width: s.length * 11 }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, rects, texts };
};

const DESKTOP = { viewportWidth: 1366, viewportHeight: 768 };
const layoutOf = () =>
  bossHealthBarLayout({
    ...DESKTOP,
    safe: { top: 0, right: 0, bottom: 0, left: 0 },
    touchMode: false,
  });

describe('o desenho', () => {
  const stable = (hp = 0.6, echo = 0.8) => {
    const f = fixture('frost_queen', { hp: 400 });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.boss.hp = 400 * hp;
    f.state.tick += 1;
    bar.sync(f.state, 100);
    // Um segundo golpe para o eco ficar exatamente onde o teste quer.
    void echo;
    return bar.view(100 + BOSS_BAR_ENTRY_INSTANT_MS + 10, false)!;
  };

  it('toda coordenada e inteira, em todas as fases', () => {
    const layout = layoutOf();
    const f = fixture('frost_queen', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.state.bossRuntime.awake = true;
    f.state.tick += 1;
    bar.sync(f.state, 50);
    const phases = [0.05, 0.25, 0.45, 0.6, 0.85, 1.2].map((p) => 50 + p * BOSS_BAR_ENTRY_MS);
    for (const now of phases) {
      const { ctx, rects } = fakeCtx();
      drawBossHealthBar(ctx, layout, bar.view(now, false)!, { reducedMotion: false });
      expect(rects.length).toBeGreaterThan(0);
      for (const r of rects) for (const v of r) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('a fissura e so um fio; a vida so aparece depois da revelacao', () => {
    const layout = layoutOf();
    const f = fixture('guardian', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.state.bossRuntime.awake = true;
    f.state.tick += 1;
    bar.sync(f.state, 50);
    const early = fakeCtx();
    drawBossHealthBar(early.ctx, layout, bar.view(50 + 0.05 * BOSS_BAR_ENTRY_MS, false)!, {
      reducedMotion: false,
    });
    expect(early.rects.length).toBe(1);
    expect(early.rects[0][3]).toBe(1);
    expect(early.texts.length).toBe(0);
    const late = fakeCtx();
    drawBossHealthBar(late.ctx, layout, bar.view(50 + BOSS_BAR_ENTRY_MS, false)!, {
      reducedMotion: false,
    });
    // O nome saiu, em caixa alta, caractere a caractere (sombra e letra: dois
    // fillText por caractere).
    expect(late.texts.filter((_, i) => i % 2 === 1).join('')).toContain('GUARDIÃO');
    // A vida cheia ocupa o leito inteiro.
    expect(late.rects.some(([x, , w]) => x === layout.bed.x && w === layout.bed.width)).toBe(true);
  });

  it('a vida desenhada tem a largura do HP e o eco fica atras dela', () => {
    const layout = layoutOf();
    const view = stable(0.6);
    const { ctx, rects } = fakeCtx();
    drawBossHealthBar(ctx, layout, view, { reducedMotion: false });
    const lifeW = Math.round(layout.bed.width * 0.6);
    expect(
      rects.some(
        ([x, y, w, h]) =>
          x === layout.bed.x && y === layout.bed.y && w === lifeW && h === layout.bed.height,
      ),
    ).toBe(true);
    // O eco: comeca onde a vida termina.
    expect(rects.some(([x]) => x === layout.bed.x + lifeW)).toBe(true);
  });

  it('com reducao de movimento nao ha montagem: nome e HP legiveis no primeiro quadro', () => {
    const layout = layoutOf();
    const f = fixture('lung_matrix', { awake: false });
    const bar = new BossHealthBarPresentation();
    bar.sync(f.state, 0);
    f.state.bossRuntime.awake = true;
    f.state.tick += 1;
    bar.sync(f.state, 50);
    const { ctx, rects, texts } = fakeCtx();
    drawBossHealthBar(ctx, layout, bar.view(66, true)!, { reducedMotion: true });
    expect(texts.length).toBeGreaterThan(0);
    expect(rects.some(([x, , w]) => x === layout.bed.x && w === layout.bed.width)).toBe(true);
  });

  it('layout invisivel nao desenha nada', () => {
    const layout = bossHealthBarLayout({
      viewportWidth: 120,
      viewportHeight: 90,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
      touchMode: false,
    });
    expect(layout.visible).toBe(false);
    const { ctx, rects } = fakeCtx();
    drawBossHealthBar(ctx, layout, stable(), { reducedMotion: false });
    expect(rects.length).toBe(0);
  });
});
