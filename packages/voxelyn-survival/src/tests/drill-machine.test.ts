// A BROCA COMO MAQUINA, conferida sem canvas.
//
// O que esta suite protege: os atos saem da acao autoritativa; a fase do
// giro e a integral da curva compartilhada (acelera, e por isso troca de pose
// cada vez mais depressa; no maximo salta poses); o quadro do andar vem da
// distancia e nao do relogio; a pose do chassi senta para tras no spool,
// mergulha o nariz no solavanco e esmaga no impacto, e com movimento reduzido
// nao chacoalha; o telegrafo e determinista, vibra com o giro e nao com
// movimento reduzido; as marcas e os impactos nascem dos eventos e apagam no
// prazo; a derrapagem e o impacto sao leituras diferentes; e o cenario da
// arena arma a broca pelo caminho de verdade.
import { describe, expect, it } from 'vitest';
import {
  DIAMANDIS_DRILL_ALIGN_TICKS,
  DIAMANDIS_DRILL_RUN_TILES,
  DIAMANDIS_DRILL_SKID_RECOVERY_TICKS,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WALL_RECOVERY_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  emptyCommand,
  stepRun,
  type EntityAction,
  type SemanticEvent,
} from '@voxelyn/survival-sim';
import {
  DRAG_MS,
  DRILL_RUN_TILES,
  DrillPresentation,
  IMPACT_FX_MS,
  LANE_LOCK_AT,
  SCAR_MS,
  chassisPoseAt,
  drillDistanceAt,
  drillGaitMs,
  drillPhaseAt,
  drillPoseFrame,
  drillSpinPhase,
  fracturesAt,
  gravelAt,
  impactShake,
  laneStyle,
} from '../client/drill-machine';
import { composeDiamandisParts } from '../client/diamandis-body';
import { PAL } from '../client/palette';
import {
  applyDiamandisScenario,
  arenaCenter,
  bossOf,
  diamandisReadout,
} from '../client/arena-diamandis-debug';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';
import chassisManifest from '@voxelyn/survival-content/assets/atlases/enemy-diamandis.json';
import drillManifest from '@voxelyn/survival-content/assets/atlases/part-diamandis-drill.json';
import type { SpriteManifestEntry } from '@voxelyn/survival-content';

const conditions = (): ArenaConditions => ({
  boss: 'diamandis',
  maxHp: 100,
  ability: 'pulse',
  modules: [],
  stabilisers: false,
  coop: false,
});

const drill = (startedAt: number): EntityAction => ({
  kind: 'drill',
  phase: 'windup',
  startedAt,
  releaseAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS,
  endsAt: startedAt + DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS,
  direction: { x: 1, y: 0 },
});

const moment = (state: string, x = 10, y = 10, intensity?: number): SemanticEvent => ({
  t: 'boss_state',
  archetype: 'diamandis',
  state: state as never,
  x,
  y,
  dx: 1,
  dy: 0,
  ...(intensity !== undefined ? { intensity } : {}),
});

describe('os atos', () => {
  it('preparo ate o release, avanco ate o fim; nada fora da broca', () => {
    expect(drillPhaseAt(undefined, 5)).toBeNull();
    expect(drillPhaseAt({ ...drill(0), kind: 'beam' }, 5)).toBeNull();
    const a = drill(100);
    expect(drillPhaseAt(a, 100)).toEqual({ kind: 'windup', progress: 0 });
    expect(drillPhaseAt(a, 118)!.progress).toBeCloseTo(0.5);
    expect(drillPhaseAt(a, 136)).toEqual({ kind: 'advance', progress: 0 });
    expect(drillPhaseAt(a, 999)!.progress).toBe(1);
    expect(DRILL_RUN_TILES).toBe(DIAMANDIS_DRILL_RUN_TILES);
  });
});

describe('o giro e a pose da broca', () => {
  it('a fase acumula cada vez mais depressa no spool e salta poses no maximo', () => {
    const a = drill(0);
    let last = drillSpinPhase(a, DIAMANDIS_DRILL_ALIGN_TICKS + 1);
    let lastDelta = 0;
    for (let t = DIAMANDIS_DRILL_ALIGN_TICKS + 2; t < DIAMANDIS_DRILL_WINDUP_TICKS; t++) {
      const phase = drillSpinPhase(a, t);
      expect(phase).toBeGreaterThanOrEqual(last);
      expect(phase - last).toBeGreaterThanOrEqual(lastDelta - 1e-9);
      lastDelta = phase - last;
      last = phase;
    }
    // No maximo, um tick avanca mais de meia volta: entre dois ticks a broca
    // ja esta em outra pose "distante" — o chocalho de alta rotacao.
    const peak = a.releaseAt + 20;
    expect(drillSpinPhase(a, peak + 1) - drillSpinPhase(a, peak)).toBeGreaterThan(0.5);
    // Fracionario: entre os dois.
    const mid = drillSpinPhase(a, peak + 0.5);
    expect(mid).toBeGreaterThan(drillSpinPhase(a, peak));
    expect(mid).toBeLessThan(drillSpinPhase(a, peak + 1));
    // Antes do inicio nada girou.
    expect(drillSpinPhase(a, 0)).toBe(0);
  });

  it('a pose e uma das oito, e volta ao inicio a cada volta', () => {
    for (let turns = 0; turns < 3; turns += 0.07) {
      const f = drillPoseFrame(turns, 8);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(8);
      expect(drillPoseFrame(turns + 1, 8)).toBe(f);
    }
    expect(drillPoseFrame(0.5, 8)).toBe(4);
    expect(drillPoseFrame(-0.125, 8)).toBe(7);
  });

  it('o atlas da broca tem as oito fases, e a composicao as usa no quadro pedido', () => {
    const drillM = drillManifest as unknown as SpriteManifestEntry;
    expect(drillM.animations.special.frames).toBe(8);
    expect(drillM.animations.special.loop).toBe(true);
    const chassis = chassisManifest as unknown as SpriteManifestEntry;
    const parts = composeDiamandisParts({
      chassis,
      parts: [drillM, null, null],
      exposed: 0,
      lost: 0,
      chassisAnim: 'walk',
      facingX: 1,
      facingY: 0,
      elapsedMs: 0,
      nowMs: 0,
      stacks: 0,
      footX: 0,
      footY: 0,
      zoom: 1,
      drillFrame: 5,
    });
    expect(parts.length).toBe(1);
    expect(parts[0].anim).toBe('special');
    expect(parts[0].frame).toBe(5);
    // Solta, a broca nao gira: a pose do giro nao se aplica.
    const loose = composeDiamandisParts({
      chassis,
      parts: [drillM, null, null],
      exposed: 1,
      lost: 0,
      chassisAnim: 'walk',
      facingX: 1,
      facingY: 0,
      elapsedMs: 0,
      nowMs: 0,
      stacks: 0,
      footX: 0,
      footY: 0,
      zoom: 1,
      drillFrame: 5,
    });
    expect(loose[0].anim).toBe('loose');
  });
});

describe('a passada', () => {
  it('o quadro do andar vem da distancia: parado nao troca, e uma passada e um ciclo', () => {
    expect(drillDistanceAt(0)).toBe(0);
    expect(drillDistanceAt(DIAMANDIS_DRILL_TICKS)).toBeCloseTo(DIAMANDIS_DRILL_RUN_TILES, 9);
    const frame = (d: number) => Math.floor((drillGaitMs(d, 6, 10) / 1000) * 10) % 6;
    expect(frame(0)).toBe(0);
    expect(frame(0.1)).toBe(0);
    expect(frame(1.4)).toBe(0);
    expect(frame(0.7)).toBe(3);
    // Ao longo da corrida o quadro so avanca (ou repete), nunca volta sem
    // completar o ciclo: os pes acompanham o chao.
    let last = -1;
    let cycles = 0;
    for (let k = 0; k <= DIAMANDIS_DRILL_TICKS; k++) {
      const f = frame(drillDistanceAt(k));
      if (last >= 0 && f < last) cycles++;
      last = f;
    }
    expect(cycles).toBeGreaterThanOrEqual(10);
  });
});

describe('a pose do chassi', () => {
  const a = drill(0);
  it('senta para tras no spool, mergulha o nariz no solavanco, esmaga no impacto', () => {
    expect(chassisPoseAt(a, 2, -1, null, false).pitch).toBe(0);
    const spool = chassisPoseAt(a, a.releaseAt - 1, -1, null, false);
    expect(spool.pitch).toBeLessThan(-0.4);
    expect(spool.squash).toBeGreaterThan(0.08);
    expect(spool.rattle).toBeGreaterThan(0);
    const lurch = chassisPoseAt(a, a.releaseAt, -1, null, false);
    expect(lurch.pitch).toBeGreaterThan(0.4);
    const peak = chassisPoseAt(a, a.releaseAt + 22, -1, null, false);
    expect(Math.abs(peak.pitch)).toBeLessThan(0.1);
    const skid = chassisPoseAt(a, a.endsAt - 2, -1, null, false);
    expect(skid.pitch).toBeLessThan(0);
    const impactAt = a.releaseAt + 20;
    const crushed = chassisPoseAt(a, impactAt + 1, impactAt, null, false);
    expect(crushed.squash).toBeGreaterThan(0.2);
    expect(crushed.pitch).toBeGreaterThan(0.8);
    expect(crushed.spin).toBeLessThan(0.8);
    expect(chassisPoseAt(a, impactAt + 9, impactAt, null, false).squash).toBeLessThan(0.05);
  });

  it('com movimento reduzido nao chacoalha nem mergulha; a mola e o esmagamento ficam', () => {
    const spool = chassisPoseAt(a, a.releaseAt - 1, -1, null, true);
    expect(spool.rattle).toBe(0);
    expect(spool.squash).toBeGreaterThan(0);
    expect(chassisPoseAt(a, a.releaseAt, -1, null, true).pitch).toBe(0);
  });

  it('sem acao, a recuperacao ainda chacoalha e morre', () => {
    const early = chassisPoseAt(null, 0, -1, { from: 0.85, sinceTicks: 1, ticks: 14 }, false);
    expect(early.spin).toBeGreaterThan(0.5);
    expect(early.rattle).toBeGreaterThan(0);
    expect(chassisPoseAt(null, 0, -1, { from: 0.85, sinceTicks: 14, ticks: 14 }, false).spin).toBe(
      0,
    );
    expect(chassisPoseAt(null, 0, -1, null, false)).toEqual({
      squash: 0,
      pitch: 0,
      rattle: 0,
      spin: 0,
    });
  });
});

describe('o telegrafo', () => {
  it('a faixa e apagada, sem brilho, e trava quando o alinhamento acaba', () => {
    expect(laneStyle(0).alpha).toBeLessThan(0.2);
    expect(laneStyle(1).alpha).toBeLessThan(0.5);
    expect(laneStyle(LANE_LOCK_AT - 0.01).locked).toBe(false);
    expect(laneStyle(LANE_LOCK_AT).locked).toBe(true);
    expect(laneStyle(0).color).toBe(PAL.loot);
    expect(laneStyle(1).color).toBe(PAL.fire);
  });

  it('o cascalho e determinista, cabe na faixa, vibra com o giro e para com movimento reduzido', () => {
    const a = gravelAt(77, 12, 0.8, 1000, false);
    expect(a).toEqual(gravelAt(77, 12, 0.8, 1000, false));
    expect(a.length).toBeGreaterThan(10);
    for (const g of a) {
      expect(g.along).toBeGreaterThanOrEqual(1);
      expect(g.along).toBeLessThanOrEqual(12);
      expect(Math.abs(g.lateral)).toBeLessThan(1.5);
    }
    const moving = gravelAt(77, 12, 0.8, 1000, false).map((g) => g.jitter);
    const later = gravelAt(77, 12, 0.8, 1040, false).map((g) => g.jitter);
    expect(moving).not.toEqual(later);
    expect(gravelAt(77, 12, 0, 1000, false).every((g) => g.jitter === 0)).toBe(true);
    expect(gravelAt(77, 12, 1, 1000, true).every((g) => g.jitter === 0)).toBe(true);
  });

  it('as rachas nascem do pe, crescem com o preparo e ficam curtas', () => {
    const early = fracturesAt(5, 0.1);
    const late = fracturesAt(5, 1);
    expect(early.length).toBe(late.length);
    for (let i = 0; i < early.length; i++) {
      const e = early[i].points;
      const l = late[i].points;
      expect(e[0]).toEqual(l[0]);
      expect(l[l.length - 1].x).toBeGreaterThan(e[e.length - 1].x);
      expect(l[l.length - 1].x).toBeLessThan(5);
    }
  });
});

describe('as marcas e os impactos', () => {
  it('o impacto e a derrapagem sao leituras diferentes, e apagam no prazo', () => {
    const p = new DrillPresentation();
    const wall = p.ingest([moment('drill_impact', 10, 10, 0.9)], 1000);
    expect(wall.length).toBe(1);
    expect(wall[0].kind).toBe('wall');
    expect(p.marks.filter((m) => m.kind === 'scar').length).toBe(1);
    expect(p.recovery?.ticks).toBe(DIAMANDIS_DRILL_WALL_RECOVERY_TICKS);
    expect(impactShake(wall[0]).power).toBeGreaterThan(
      impactShake({ ...wall[0], kind: 'skid' }).power,
    );

    const q = new DrillPresentation();
    const skid = q.ingest([moment('drill_skid', 4, 4)], 1000);
    expect(skid[0].kind).toBe('skid');
    expect(q.marks.filter((m) => m.kind === 'scrape').length).toBe(2);
    expect(q.marks.filter((m) => m.kind === 'scar').length).toBe(0);
    expect(q.recovery?.ticks).toBe(DIAMANDIS_DRILL_SKID_RECOVERY_TICKS);
    expect(q.recovery!.from).toBeGreaterThan(p.recovery!.from);

    const strike = new DrillPresentation().ingest([moment('drill_strike', 1, 1, 1)], 0);
    expect(strike[0].kind).toBe('strike');
    // Outros momentos do chefe nao viram impacto.
    expect(p.ingest([moment('frenzy'), moment('obstruction')], 0)).toEqual([]);

    p.step(1000 + IMPACT_FX_MS);
    expect(p.impacts.length).toBe(0);
    p.step(1000 + SCAR_MS - 1);
    expect(p.marks.length).toBe(1);
    p.step(1000 + SCAR_MS);
    expect(p.marks.length).toBe(0);
  });

  it('as esteiras de arrasto nascem em pares atras da posicao anterior e apagam', () => {
    const p = new DrillPresentation();
    p.drag(0, 0, { x: 1, y: 0 }, 0);
    expect(p.marks.length).toBe(0);
    p.drag(0.5, 0, { x: 1, y: 0 }, 60);
    expect(p.marks.length).toBe(2);
    expect(p.marks[0].kind).toBe('drag');
    expect(p.marks[0].x).toBe(0);
    expect(p.marks[0].length).toBeCloseTo(0.5);
    expect(p.marks[0].y).toBeCloseTo(-p.marks[1].y);
    // No mesmo bucket nao repete.
    p.drag(0.6, 0, { x: 1, y: 0 }, 70);
    expect(p.marks.length).toBe(2);
    p.step(60 + DRAG_MS);
    expect(p.marks.length).toBe(0);
  });

  it('a recuperacao conta em ticks a partir do evento e acaba', () => {
    const p = new DrillPresentation();
    p.ingest([moment('drill_skid')], 1000);
    expect(p.recoveryAt(1000)!.sinceTicks).toBe(0);
    expect(p.recoveryAt(1000 + 250)!.sinceTicks).toBeCloseTo(5);
    expect(p.recoveryAt(1000 + DIAMANDIS_DRILL_SKID_RECOVERY_TICKS * 50)).toBeNull();
    expect(p.recovery).toBeNull();
    p.reset();
    expect(p.lockedAtMs).toBe(-1);
  });
});

describe('o cenario da arena', () => {
  it('arma a broca pelo caminho de verdade, o chassi alinha parado e a corrida atravessa', () => {
    const state = createArenaRun(conditions());
    const events = applyDiamandisScenario(state, 'drill');
    const boss = bossOf(state)!;
    expect(boss.action?.kind).toBe('drill');
    expect(
      events.some(
        (e) => e.t === 'boss_windup' && e.archetype === 'diamandis' && e.ability === 'drill',
      ),
    ).toBe(true);
    expect(drillPhaseAt(boss.action, state.tick)).toEqual({ kind: 'windup', progress: 0 });
    const x0 = boss.x;
    const y0 = boss.y;
    const seen: SemanticEvent[] = [];
    for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS - 1; i++) {
      seen.push(...stepRun(state, [emptyCommand()]).events);
    }
    expect(Math.hypot(boss.x - x0, boss.y - y0)).toBeLessThan(0.05);
    expect(seen.some((e) => e.t === 'boss_state' && e.state === 'drill_lock')).toBe(true);
    stepRun(state, [emptyCommand()]);
    expect(drillPhaseAt(boss.action, state.tick)!.kind).toBe('advance');
    for (let i = 0; i < DIAMANDIS_DRILL_TICKS; i++) {
      seen.push(...stepRun(state, [emptyCommand()]).events);
    }
    expect(Math.hypot(boss.x - x0, boss.y - y0)).toBeGreaterThan(6);
    // A corrida acabou de um dos dois jeitos, e o cliente sabe qual.
    const p = new DrillPresentation();
    const ends = p.ingest(seen, 0);
    expect(ends.some((e) => e.kind === 'wall' || e.kind === 'skid')).toBe(true);
  });

  it('do meio da sala, cada rumo segurado vira a corrida daquele rumo quando ha sala', () => {
    const state = createArenaRun(conditions());
    applyDiamandisScenario(state, 'center');
    const boss = bossOf(state)!;
    const spot = arenaCenter(state)!;
    expect(Math.hypot(boss.x - spot.x - 0.5, boss.y - spot.y - 0.5)).toBeLessThan(4);
    let followed = 0;
    for (const face of [
      'faceR',
      'faceDR',
      'faceD',
      'faceDL',
      'faceL',
      'faceUL',
      'faceU',
      'faceUR',
    ] as const) {
      const run = createArenaRun(conditions());
      applyDiamandisScenario(run, 'center');
      applyDiamandisScenario(run, face);
      const b = bossOf(run)!;
      const held = { ...b.facing };
      applyDiamandisScenario(run, 'drill');
      const dir = b.action!.direction;
      const dot = (dir.x * held.x + dir.y * held.y) / (Math.hypot(held.x, held.y) || 1);
      if (dot > 0.99) followed++;
      // Seja qual for o rumo, a corrida anda e acaba de um dos dois jeitos.
      const x0 = b.x;
      const y0 = b.y;
      const seen: SemanticEvent[] = [];
      for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS; i++) {
        seen.push(...stepRun(run, [emptyCommand()]).events);
      }
      expect(Math.hypot(b.x - x0, b.y - y0), face).toBeGreaterThan(3);
      const ends = new DrillPresentation()
        .ingest(seen, 0)
        .filter((e) => e.kind === 'wall' || e.kind === 'skid');
      expect(ends.length, face).toBe(1);
    }
    // A arena e um recorte da caverna: nem todo rumo tem seis tiles, mas a
    // maioria tem — e e neles que as diagonais sao conferidas.
    expect(followed).toBeGreaterThanOrEqual(5);
  });

  it('contra o veio: impacto, cicatriz, minerio de pe; errando: derrapagem', () => {
    const wall = createArenaRun(conditions());
    applyDiamandisScenario(wall, 'drillWall');
    const seenWall: SemanticEvent[] = [];
    for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS; i++) {
      seenWall.push(...stepRun(wall, [emptyCommand()]).events);
    }
    const pw = new DrillPresentation();
    const wallEnds = pw.ingest(seenWall, 0);
    expect(wallEnds.map((e) => e.kind)).toEqual(['wall']);
    expect(pw.marks.some((m) => m.kind === 'scar')).toBe(true);
    expect(diamandisReadout(wall)!.drill).toBeNull();

    const miss = createArenaRun(conditions());
    applyDiamandisScenario(miss, 'drillMiss');
    expect(diamandisReadout(miss)!.drill?.stage).toBe('align');
    const hp0 = miss.player.hp;
    const seenMiss: SemanticEvent[] = [];
    for (let i = 0; i < DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS; i++) {
      seenMiss.push(...stepRun(miss, [emptyCommand()]).events);
    }
    const pm = new DrillPresentation();
    expect(pm.ingest(seenMiss, 0).map((e) => e.kind)).toEqual(['skid']);
    expect(miss.player.hp).toBe(hp0);
  });
});
