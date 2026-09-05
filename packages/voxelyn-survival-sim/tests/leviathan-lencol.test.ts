// O LENCOL POR BAIXO — a primeira fase do Leviata, e a costura para a segunda.
//
// O que estes testes protegem, em uma frase cada: ancorado ele nao anda; a
// Sondagem e progressiva (raso, depois fundo) e nunca atravessa parede nem
// toca celula critica; o destino e determinista; a posicao so salta com o
// corpo inteiro submerso; a tampa viva segura o Prospector e solta no tick em
// que a cauda some; a primeira fase nunca persegue; o Diluvio encerra o ciclo
// de pocas para sempre; e as bolhas obedecem a UM predicado.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { moveEntity, spawnEnemy } from '../src/entities';
import { sealIceHole } from '../src/cells';
import {
  BUBBLE_EPSILON,
  bubbleShellRadius,
  insideAnyBubble,
  isPoolCore,
  leviathanCovers,
  leviathanExposure,
  leviathanLidCells,
  leviathanPosture,
  leviathanSegmentSubmersion,
  leviathanTargetable,
  LEVIATHAN_BODY_RANKS,
  nearestPoolCore,
  playerProtectedByBubble,
} from '../src/leviathan';
import {
  BOSS_PHASE_DELUGE,
  LEVIATHAN_ANCHORED,
  LEVIATHAN_DIVING,
  LEVIATHAN_EMERGING,
  LEVIATHAN_HIDDEN,
  LEVIATHAN_HUNTING,
  type SemanticEvent,
  type SurvivalState,
} from '../src/types';
import {
  DELUGE_HP_FRACTION,
  LEVIATHAN_LID_RADIUS,
  LEVIATHAN_PROBE_DAMAGE,
  LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS,
  LEVIATHAN_PROTECTIVE_BUBBLE_SHELL_RADIUS,
  LEVIATHAN_SHOCK_DAMAGE,
  LEVIATHAN_SHOCK_WINDUP_TICKS,
  PLAYER_RADIUS,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_DEEP_WATER,
  SURF_NONE,
  SURF_WATER,
} from '../src/constants';

/** Pinta uma POCA ocupavel: margem rasa num disco, plus profunda no meio. */
const paintPool = (state: SurvivalState, cx: number, cy: number, rim = 2.6): void => {
  const w = state.config.width;
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (Math.hypot(x - cx, y - cy) > rim) continue;
      state.surface[y * w + x] = SURF_WATER;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    state.surface[(cy + dy) * w + (cx + dx)] = SURF_DEEP_WATER;
  }
};

/**
 * A camara da primeira fase: um salao aberto de 37x37 com o Prospector no
 * centro, o Leviata ancorado numa poca a leste e mais duas pocas (norte e
 * oeste) como destinos possiveis. Tudo determinista e sem RNG.
 */
const lencol = (seed = 7100, gap = 7) => {
  const state = createRun({ seed });
  const w = state.config.width;
  const px = Math.floor(w / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - 18; y <= py + 18; y++) {
    for (let x = px - 18; x <= px + 18; x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
  }
  state.enemies = [];
  state.salvageSites = [];
  paintPool(state, px + gap, py);
  paintPool(state, px - 8, py - 2);
  paintPool(state, px + 1, py - 9);
  const boss = spawnEnemy(state, 'sheet_leviathan', px + gap, py, false);
  state.bossRuntime.awake = true;
  return { state, boss, px, py, w };
};

/** Avanca N ticks com o jogador parado e imortal, colhendo os eventos. */
const advance = (state: SurvivalState, ticks: number, hold?: () => void): SemanticEvent[] => {
  const out: SemanticEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    out.push(...stepRun(state, [emptyCommand()]).events);
    state.player.hp = state.player.maxHp;
    hold?.();
  }
  return out;
};

/** Avanca ate `ready()`, com teto. Devolve os eventos do caminho. */
const until = (
  state: SurvivalState,
  ready: () => boolean,
  limit: number,
  hold?: () => void,
): SemanticEvent[] => {
  const out: SemanticEvent[] = [];
  for (let t = 0; t < limit && !ready(); t++) {
    out.push(...stepRun(state, [emptyCommand()]).events);
    state.player.hp = state.player.maxHp;
    hold?.();
  }
  return out;
};

const starts = (events: SemanticEvent[], id: number, kind: string) =>
  events.filter((e) => e.t === 'action_start' && e.entity === id && e.action === kind);

/**
 * O Prospector de pe em (px, py) — que SAI de la quando uma Sondagem que
 * afunda esta marcada em cima dele. E o que um jogador faz com o aviso
 * pesado: fica para a rasa (dano e empurrao), foge da profunda (a queda).
 */
const stand = (state: SurvivalState, px: number, py: number) => (): void => {
  const w = state.config.width;
  const cell = state.bossRuntime.leviathanProbeCell;
  const dodge =
    state.surface[py * w + px] === SURF_DEEP_WATER ||
    (cell >= 0 &&
      state.bossRuntime.leviathanProbeDeepen &&
      Math.hypot((cell % w) + 0.5 - (px + 0.5), Math.floor(cell / w) + 0.5 - (py + 0.5)) < 3);
  state.player.x = (dodge ? px - 4 : px) + 0.5;
  state.player.y = (dodge ? py + 4 : py) + 0.5;
};

const countKind = (state: SurvivalState, kind: number, cx: number, cy: number, r: number) => {
  const w = state.config.width;
  let n = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) if (state.surface[y * w + x] === kind) n++;
  }
  return n;
};

describe('Leviata do Lencol — ancorado', () => {
  it('nasce ancorado sobre um nucleo, e ancorado nao anda: posicao e velocidade zeradas', () => {
    const { state, boss } = lencol();
    expect(boss.mood).toBe(LEVIATHAN_ANCHORED);
    expect(isPoolCore(state, Math.floor(boss.y) * state.config.width + Math.floor(boss.x))).toBe(
      true,
    );
    const x0 = boss.x;
    const y0 = boss.y;
    // O jogador anda em volta dele o tempo todo: nada disto o move.
    let t = 0;
    advance(state, 260, () => {
      t++;
      state.player.x = state.player.x + Math.cos(t / 9) * 0.15;
      state.player.y = state.player.y + Math.sin(t / 9) * 0.15;
      if (boss.mood === LEVIATHAN_ANCHORED) {
        expect(boss.x).toBe(x0);
        expect(boss.y).toBe(y0);
        expect(boss.vx).toBe(0);
        expect(boss.vy).toBe(0);
      }
    });
  });

  it('gira para acompanhar o Prospector, sem translacao', () => {
    const { state, boss, px, py } = lencol();
    state.player.x = px + 0.5;
    state.player.y = py - 6 + 0.5;
    const facing0 = { ...boss.facing };
    advance(state, 30, () => {
      state.player.x = px + 0.5;
      state.player.y = py - 6 + 0.5;
    });
    expect(boss.facing.x !== facing0.x || boss.facing.y !== facing0.y).toBe(true);
    // Rumo apontando para o norte, e nao mais para o leste.
    expect(boss.facing.y).toBeLessThan(-0.3);
  });
});

describe('Leviata do Lencol — a Sondagem Abissal', () => {
  it('em piso seco cria SOMENTE agua rasa, com marca antes e dano no centro', () => {
    const { state, boss, px, py } = lencol();
    const hold = () => {
      state.player.x = px + 0.5;
      state.player.y = py + 0.5;
    };
    const events = until(state, () => state.bossRuntime.leviathanProbeSeq >= 1, 400, hold);
    const marker = events.find((e) => e.t === 'probe_marker');
    expect(marker, 'a Sondagem saiu sem marca no chao').toBeDefined();
    if (marker?.t !== 'probe_marker') return;
    expect(marker.deepen).toBe(false);
    const cx = Math.floor(marker.x);
    const cy = Math.floor(marker.y);
    // A mirada e o proprio jogador parado: a marca cai em cima dele.
    expect(Math.hypot(marker.x - state.player.x, marker.y - state.player.y)).toBeLessThan(2);
    expect(countKind(state, SURF_WATER, cx, cy, 3)).toBeGreaterThan(3);
    expect(countKind(state, SURF_DEEP_WATER, cx, cy, 3)).toBe(0);
    // O golpe cobrou: `hit` no jogador com o dano da Sondagem.
    const hit = events.find((e) => e.t === 'hit' && e.target === state.player.id);
    expect(hit?.t === 'hit' ? hit.amount : 0).toBe(LEVIATHAN_PROBE_DAMAGE);
    void boss;
  });

  it('a segunda Sondagem sobre a poca AFUNDA o centro e preserva a margem rasa', () => {
    const { state, px, py, w } = lencol();
    const hold = stand(state, px, py);
    until(state, () => state.bossRuntime.leviathanProbeSeq >= 1, 400, hold);
    expect(state.surface[py * w + px], 'a primeira Sondagem nao molhou o alvo').toBe(SURF_WATER);
    const events = until(state, () => state.bossRuntime.leviathanProbeSeq >= 2, 400, hold);
    const marker = events.find((e) => e.t === 'probe_marker');
    expect(marker?.t === 'probe_marker' && marker.deepen, 'a segunda nao avisou mais pesado').toBe(
      true,
    );
    const deep = countKind(state, SURF_DEEP_WATER, px, py, 2);
    expect(deep, 'o centro nao afundou').toBeGreaterThanOrEqual(3);
    // Toda celula profunda tem os quatro vizinhos em agua ou rocha: margem.
    for (let y = py - 3; y <= py + 3; y++) {
      for (let x = px - 3; x <= px + 3; x++) {
        const i = y * w + x;
        if (state.surface[i] !== SURF_DEEP_WATER) continue;
        for (const n of [i - 1, i + 1, i - w, i + w]) {
          const ok =
            state.solid[n] !== SOLID_NONE ||
            state.surface[n] === SURF_WATER ||
            state.surface[n] === SURF_DEEP_WATER;
          expect(ok, `celula profunda encostada em piso seco em ${n}`).toBe(true);
        }
      }
    }
    // A poca afundada virou candidata a proxima emergencia.
    expect(nearestPoolCore(state, px, py, 2)).toBeGreaterThanOrEqual(0);
  });

  it('nunca modifica celulas criticas: o pedestal e a entrada ficam secos', () => {
    const { state, px, py, w } = lencol();
    // O Prospector fica de pe SOBRE o pedestal: a mirada cai la, e a Sondagem
    // tem de procurar outra celula — e nunca pintar o 3x3 do poco.
    state.corePos = { x: px, y: py };
    const hold = stand(state, px, py);
    until(state, () => state.bossRuntime.leviathanProbeSeq >= 2, 700, hold);
    for (let y = py - 1; y <= py + 1; y++) {
      for (let x = px - 1; x <= px + 1; x++) expect(state.surface[y * w + x]).toBe(SURF_NONE);
    }
  });

  it('nao atravessa parede: a marca nunca cai em rocha e a agua nao continua por dentro dela', () => {
    const { state, px, py, w } = lencol();
    const wallX = px - 2;
    for (let y = py - 16; y <= py + 16; y++) state.solid[y * w + wallX] = SOLID_ROCK;
    const hold = stand(state, wallX - 1, py);
    const events = until(state, () => state.bossRuntime.leviathanProbeSeq >= 2, 700, hold);
    for (const ev of events) {
      if (ev.t !== 'probe_marker') continue;
      expect(state.solid[Math.floor(ev.y) * w + Math.floor(ev.x)]).toBe(SOLID_NONE);
    }
    for (let y = py - 16; y <= py + 16; y++) expect(state.surface[y * w + wallX]).toBe(SURF_NONE);
  });
});

describe('Leviata do Lencol — mergulho, viagem e emergencia', () => {
  /** Leva o encontro ate o primeiro mergulho comecar. */
  const untilDive = (scene: ReturnType<typeof lencol>) => {
    const { state, boss, px, py } = scene;
    const hold = stand(state, px, py);
    const events = until(state, () => boss.mood === LEVIATHAN_DIVING, 1200, hold);
    expect(boss.mood, 'nunca mergulhou').toBe(LEVIATHAN_DIVING);
    return { events, hold };
  };

  it('escolhe deterministicamente uma poca valida como destino', () => {
    const a = lencol(7105);
    const b = lencol(7105);
    untilDive(a);
    untilDive(b);
    const dest = a.state.bossRuntime.leviathanDest;
    expect(dest).toBeGreaterThanOrEqual(0);
    expect(dest).toBe(b.state.bossRuntime.leviathanDest);
    expect(isPoolCore(a.state, dest), 'o destino nao e um nucleo ocupavel').toBe(true);
    // Longe do jogador, e longe da poca atual.
    const w = a.state.config.width;
    const dx = (dest % w) + 0.5;
    const dy = Math.floor(dest / w) + 0.5;
    expect(Math.hypot(dx - a.state.player.x, dy - a.state.player.y)).toBeGreaterThanOrEqual(3);
    expect(Math.hypot(dx - a.boss.x, dy - a.boss.y)).toBeGreaterThanOrEqual(5);
  });

  it('so muda de posicao quando TODOS os segmentos estao submersos, e o salto vai para o destino', () => {
    const scene = lencol();
    const { state, boss } = scene;
    const { hold } = untilDive(scene);
    const x0 = boss.x;
    const y0 = boss.y;
    const dest = state.bossRuntime.leviathanDest;
    const w = state.config.width;
    let moved = -1;
    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      hold();
      const segmentsGone = boss.mood === LEVIATHAN_HIDDEN;
      if (boss.x !== x0 || boss.y !== y0) {
        expect(segmentsGone, 'a posicao mudou com um segmento ainda visivel').toBe(true);
        moved = t;
        break;
      }
      // Enquanto mergulha a exposicao cai ate zero — e nunca salta.
      expect(leviathanExposure(boss, state.tick)).toBeGreaterThanOrEqual(0);
    }
    expect(moved, 'nunca saltou').toBeGreaterThan(0);
    expect(boss.x).toBe((dest % w) + 0.5);
    expect(boss.y).toBe(Math.floor(dest / w) + 0.5);
    // Escondido ele nao e alvo. Emergindo, a janela so abre com a cabeca fora.
    expect(leviathanTargetable(boss, state.tick)).toBe(false);
    until(state, () => boss.mood === LEVIATHAN_EMERGING, 400, hold);
    expect(boss.mood).toBe(LEVIATHAN_EMERGING);
    const openedAt = leviathanExposure(boss, state.tick);
    expect(openedAt).toBe(0);
    until(state, () => boss.mood === LEVIATHAN_ANCHORED, 200, hold);
    expect(boss.mood).toBe(LEVIATHAN_ANCHORED);
    expect(leviathanTargetable(boss, state.tick)).toBe(true);
  });

  it('a submersao por segmentos e ordenada: cabeca primeiro, cauda por ultimo — e o inverso ao emergir', () => {
    const ranks = LEVIATHAN_BODY_RANKS;
    for (let p = 0; p <= 1; p += 0.05) {
      let last = Infinity;
      for (let rank = -1; rank < ranks; rank++) {
        const sub = leviathanSegmentSubmersion(rank, ranks, p, 'dive');
        expect(sub).toBeLessThanOrEqual(last + 1e-9);
        last = sub;
        expect(leviathanSegmentSubmersion(rank, ranks, p, 'emerge')).toBeCloseTo(1 - sub, 9);
      }
    }
    expect(leviathanSegmentSubmersion(-1, ranks, 0, 'dive')).toBe(0);
    expect(leviathanSegmentSubmersion(ranks - 1, ranks, 1, 'dive')).toBe(1);
    // A cabeca ja sumiu com a cauda ainda inteira fora: e um corpo atravessando.
    expect(leviathanSegmentSubmersion(-1, ranks, 0.3, 'dive')).toBe(1);
    expect(leviathanSegmentSubmersion(ranks - 1, ranks, 0.3, 'dive')).toBe(0);
  });

  it('a postura reconstroi-se de humor e acao — o que viaja no snapshot', () => {
    const scene = lencol();
    const { state, boss } = scene;
    const { hold } = untilDive(scene);
    const mid = { mood: boss.mood, action: boss.action ? { ...boss.action } : undefined };
    expect(leviathanPosture(mid)).toBe('diving');
    until(state, () => boss.mood === LEVIATHAN_HIDDEN, 200, hold);
    expect(leviathanPosture({ mood: boss.mood, action: undefined })).toBe('hidden');
    until(state, () => boss.mood === LEVIATHAN_EMERGING, 400, hold);
    expect(leviathanPosture({ mood: boss.mood, action: boss.action })).toBe('emerging');
    expect(leviathanPosture({ mood: LEVIATHAN_HUNTING, action: undefined })).toBe('hunting');
    expect(
      leviathanPosture({
        mood: LEVIATHAN_HUNTING,
        action: {
          kind: 'massive_shock',
          phase: 'windup',
          startedAt: 0,
          releaseAt: 10,
          endsAt: 20,
          direction: { x: 1, y: 0 },
        },
      }),
    ).toBe('charging');
  });
});

describe('Leviata do Lencol — o corpo como tampa viva', () => {
  it('agua profunda coberta pelo corpo ancorado NAO mata o Prospector', () => {
    const { state, boss, w } = lencol();
    const cell = Math.floor(boss.y) * w + Math.floor(boss.x);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
    expect(leviathanLidCells(state, boss).length).toBeGreaterThanOrEqual(5);
    expect(leviathanCovers(state, cell)).toBe(true);
    // A tampa cobre a plus inteira, e nao so a celula do hitbox.
    for (const n of [cell - 1, cell + 1, cell - w, cell + w]) {
      expect(leviathanCovers(state, n)).toBe(true);
    }
    state.player.x = boss.x;
    state.player.y = boss.y;
    for (let t = 0; t < 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.x = boss.x;
      state.player.y = boss.y;
      if (boss.mood !== LEVIATHAN_ANCHORED) break;
      expect(state.player.alive, `caiu no tick ${t} com o corpo em cima`).toBe(true);
    }
  });

  it('a mesma celula mata depois que a cauda desaparece, e a tampa so volta no FIM da emergencia', () => {
    const { state, boss, px, py, w } = lencol();
    const homeX = boss.x;
    const homeY = boss.y;
    const home = Math.floor(homeY) * w + Math.floor(homeX);
    const hold = stand(state, px, py);
    until(state, () => boss.mood === LEVIATHAN_DIVING, 1200, hold);
    // Durante o aviso e a descida a tampa continua valendo.
    expect(leviathanCovers(state, home)).toBe(true);
    until(state, () => boss.mood === LEVIATHAN_HIDDEN, 200, hold);
    expect(leviathanCovers(state, home), 'a cauda sumiu e a poca continuou tampada').toBe(false);
    // Agora a poca abandonada e fatal: o Prospector que ficou la cai.
    const probe = lencol();
    const dest = state.bossRuntime.leviathanDest;
    void probe;
    state.player.x = homeX;
    state.player.y = homeY;
    const result = stepRun(state, [emptyCommand()]);
    expect(state.player.alive).toBe(false);
    const fall = result.events.find((e) => e.t === 'ice_fall');
    expect(fall?.t === 'ice_fall' ? fall.medium : null).toBe('water');
    // O destino, enquanto ele emerge, NAO esta tampado: a cobertura so volta
    // quando o corpo termina de ocupar o nucleo.
    const scene2 = lencol();
    const hold2 = stand(scene2.state, scene2.px, scene2.py);
    until(scene2.state, () => scene2.boss.mood === LEVIATHAN_EMERGING, 1600, hold2);
    expect(scene2.boss.mood).toBe(LEVIATHAN_EMERGING);
    const dest2 = Math.floor(scene2.boss.y) * scene2.w + Math.floor(scene2.boss.x);
    expect(leviathanCovers(scene2.state, dest2)).toBe(false);
    until(scene2.state, () => scene2.boss.mood === LEVIATHAN_ANCHORED, 200, hold2);
    expect(leviathanCovers(scene2.state, dest2)).toBe(true);
    void dest;
  });

  it('a tampa e a silhueta estacionaria: nada alem do raio autorado, e so por agua conexa', () => {
    const { state, boss, w } = lencol();
    for (const cell of leviathanLidCells(state, boss)) {
      const x = (cell % w) + 0.5;
      const y = Math.floor(cell / w) + 0.5;
      expect(Math.hypot(x - boss.x, y - boss.y)).toBeLessThanOrEqual(LEVIATHAN_LID_RADIUS);
      expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
    }
    // Uma celula profunda solta a dois tiles, do outro lado de chao seco, nao
    // esta debaixo de asa nenhuma.
    const stray = (Math.floor(boss.y) + 2) * w + Math.floor(boss.x) - 2;
    state.surface[stray] = SURF_DEEP_WATER;
    state.surface[stray + 1] = SURF_NONE;
    state.surface[stray - w] = SURF_NONE;
    expect(leviathanCovers(state, stray)).toBe(false);
  });
});

describe('Leviata do Lencol — as duas fases', () => {
  it('a primeira fase NUNCA inicia perseguicao: sem contato, sem cacada, sem andar', () => {
    const { state, boss, px, py } = lencol();
    let t = 0;
    const hold = () => {
      t++;
      state.player.x = px + Math.cos(t / 40) * 5 + 0.5;
      state.player.y = py + Math.sin(t / 40) * 5 + 0.5;
    };
    const events = advance(state, 1500, hold);
    expect(starts(events, boss.id, 'contact')).toHaveLength(0);
    expect(starts(events, boss.id, 'erupt')).toHaveLength(0);
    expect(starts(events, boss.id, 'massive_shock')).toHaveLength(0);
    expect(starts(events, boss.id, 'probe').length).toBeGreaterThan(0);
    expect(starts(events, boss.id, 'dive').length).toBeGreaterThan(0);
    expect(boss.mood).not.toBe(LEVIATHAN_HUNTING);
  });

  it('depois do Diluvio ele nao volta a teleportar nem a ancorar, e a descarga so sai cacando', () => {
    const { state, boss, px, py } = lencol();
    const hold = stand(state, px, py);
    advance(state, 2, hold);
    boss.hp = boss.maxHp * (DELUGE_HP_FRACTION - 0.05);
    const transition = until(state, () => boss.mood === LEVIATHAN_HUNTING, 1200, hold);
    expect(boss.mood).toBe(LEVIATHAN_HUNTING);
    expect(state.bossRuntime.phasesFired & BOSS_PHASE_DELUGE).not.toBe(0);
    // A virada foi anunciada, ele mergulhou e emergiu inteiro.
    expect(transition.some((e) => e.t === 'boss_phase')).toBe(true);
    expect(starts(transition, boss.id, 'dive').length).toBeGreaterThan(0);
    expect(starts(transition, boss.id, 'emerge').length).toBeGreaterThan(0);
    const after = advance(state, 900, hold);
    expect(starts(after, boss.id, 'dive')).toHaveLength(0);
    expect(starts(after, boss.id, 'emerge')).toHaveLength(0);
    expect(starts(after, boss.id, 'probe')).toHaveLength(0);
    expect(boss.mood).toBe(LEVIATHAN_HUNTING);
    // A descarga massiva e as bolhas SAIRAM, e so depois da virada.
    expect(starts(transition, boss.id, 'massive_shock')).toHaveLength(0);
    expect(starts(after, boss.id, 'massive_shock').length).toBeGreaterThan(0);
  });

  it('cacando ele nada na direcao do Prospector com o corpo inteiro exposto', () => {
    const { state, boss, px, py } = lencol();
    boss.mood = LEVIATHAN_HUNTING;
    state.bossRuntime.phasesFired |= BOSS_PHASE_DELUGE;
    state.bossRuntime.delugeAt = 0;
    state.bossRuntime.delugeX = boss.x;
    state.bossRuntime.delugeY = boss.y;
    state.tick = 400;
    state.delugeFieldBucket = -1;
    state.bossRuntime.leviathanShockRecoverAt = 10_000;
    const d0 = Math.hypot(boss.x - state.player.x, boss.y - state.player.y);
    advance(state, 10, () => {
      state.player.x = px + 0.5;
      state.player.y = py + 0.5;
    });
    expect(Math.hypot(boss.x - state.player.x, boss.y - state.player.y)).toBeLessThan(d0);
    expect(leviathanExposure(boss, state.tick)).toBe(1);
  });

  it('a mesma seed produz as mesmas pocas e os mesmos destinos em solo, em co-op e no replay', () => {
    const solo = createRun({ seed: 4242, sector: 3 });
    const coop = createRun({ seed: 4242, sector: 3, playerCount: 2 });
    expect(Array.from(solo.surface)).toEqual(Array.from(coop.surface));
    // REPLAY: duas simulacoes identicas com os mesmos comandos passam pelo
    // ciclo inteiro e terminam no mesmo hash — inclusive as pocas que a
    // Sondagem abriu e o destino que o mergulho escolheu.
    const a = lencol(7777);
    const b = lencol(7777);
    let t = 0;
    for (let k = 0; k < 900; k++) {
      t++;
      for (const scene of [a, b]) {
        stepRun(scene.state, [emptyCommand()]);
        scene.state.player.hp = scene.state.player.maxHp;
        scene.state.player.x = scene.px + Math.cos(t / 30) * 4 + 0.5;
        scene.state.player.y = scene.py + Math.sin(t / 30) * 4 + 0.5;
      }
      expect(hashAuthoritativeState(a.state)).toBe(hashAuthoritativeState(b.state));
    }
    expect(a.state.bossRuntime.leviathanPools).toEqual(b.state.bossRuntime.leviathanPools);
    expect(a.state.bossRuntime.leviathanProbeSeq).toBeGreaterThan(0);
  });
});

describe('Leviata do Lencol — as bolhas obedecem a um predicado', () => {
  const bubble = { x: 10.5, y: 10.5, radius: LEVIATHAN_PROTECTIVE_BUBBLE_RADIUS };

  it('centro, limite exato, epsilon dentro e epsilon fora', () => {
    const r = bubble.radius;
    expect(playerProtectedByBubble(bubble.x, bubble.y, bubble)).toBe(true);
    expect(playerProtectedByBubble(bubble.x + r, bubble.y, bubble)).toBe(true);
    expect(playerProtectedByBubble(bubble.x + r - 1e-4, bubble.y, bubble)).toBe(true);
    expect(playerProtectedByBubble(bubble.x + r + BUBBLE_EPSILON * 10, bubble.y, bubble)).toBe(
      false,
    );
    // O raio do corpo NAO entra numa segunda regra: o centro na linha e seguro
    // mesmo com o corpo passando dela.
    expect(playerProtectedByBubble(bubble.x + r - PLAYER_RADIUS / 2, bubble.y, bubble)).toBe(true);
    expect(insideAnyBubble(bubble.x, bubble.y, [bubble])).toBe(true);
    expect(insideAnyBubble(bubble.x + 3, bubble.y, [bubble])).toBe(false);
    // A casca visual e derivada do raio seguro, nunca um numero solto.
    expect(bubbleShellRadius(bubble)).toBeCloseTo(LEVIATHAN_PROTECTIVE_BUBBLE_SHELL_RADIUS, 9);
    expect(bubbleShellRadius(bubble)).toBeGreaterThan(bubble.radius);
  });

  /** A segunda fase pronta para a descarga: sala alagada e ele cacando. */
  const flooded = (seed = 9101, coop = false) => {
    const state = createRun({ seed, playerCount: coop ? 2 : 1 });
    const w = state.config.width;
    const px = Math.floor(w / 2);
    const py = Math.floor(state.config.height / 2);
    for (const p of state.players) {
      p.x = px + 0.5;
      p.y = py + 0.5;
    }
    for (let y = py - 18; y <= py + 18; y++) {
      for (let x = px - 18; x <= px + 18; x++) {
        state.solid[y * w + x] = SOLID_NONE;
        state.surface[y * w + x] = SURF_NONE;
      }
    }
    state.enemies = [];
    const boss = spawnEnemy(state, 'sheet_leviathan', px + 6, py, false);
    boss.mood = LEVIATHAN_HUNTING;
    state.bossRuntime.phasesFired |= BOSS_PHASE_DELUGE;
    state.bossRuntime.awake = true;
    state.tick = 1000;
    state.bossRuntime.delugeAt = 0;
    state.bossRuntime.delugeX = boss.x;
    state.bossRuntime.delugeY = boss.y;
    state.delugeFieldBucket = -1;
    return { state, boss, w, px, py };
  };

  it('nunca nasce sobre agua profunda, nem com um nucleo dentro da area segura', () => {
    const { state, px, py, w } = flooded(9102);
    // Nucleos espalhados pela sala: os candidatos dos aneis caem em cima.
    for (let y = py - 15; y <= py + 15; y += 5) {
      for (let x = px - 15; x <= px + 15; x += 5) {
        if (Math.hypot(x - px, y - py) < 2) continue;
        state.surface[y * w + x] = SURF_DEEP_WATER;
      }
    }
    const events = stepRun(state, [emptyCommand()]).events;
    expect(events.some((e) => e.t === 'action_start' && e.action === 'massive_shock')).toBe(true);
    for (const b of state.bossRuntime.protectiveBubbles) {
      for (let y = Math.floor(b.y - b.radius); y <= Math.floor(b.y + b.radius); y++) {
        for (let x = Math.floor(b.x - b.radius); x <= Math.floor(b.x + b.radius); x++) {
          if (Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y) > b.radius + 0.5) continue;
          expect(state.surface[y * w + x]).not.toBe(SURF_DEEP_WATER);
          expect(state.solid[y * w + x]).toBe(SOLID_NONE);
        }
      }
    }
  });

  it('cada bolha tem rota caminhavel a partir de um jogador vivo — e no co-op cada um tem a sua', () => {
    const { state, w, px, py } = flooded(9103, true);
    state.players[1].x = px - 9 + 0.5;
    state.players[1].y = py + 0.5;
    // Uma parede fechada entre os dois, com o segundo do lado de la: a bolha
    // dele tem de nascer do lado dele.
    const wallX = px - 4;
    for (let y = py - 18; y <= py + 18; y++) state.solid[y * w + wallX] = SOLID_ROCK;
    const events = stepRun(state, [emptyCommand()]).events;
    expect(events.some((e) => e.t === 'action_start' && e.action === 'massive_shock')).toBe(true);
    const bubbles = state.bossRuntime.protectiveBubbles;
    expect(bubbles).toHaveLength(2);
    const sides = bubbles.map((b) => (b.x < wallX ? 'west' : 'east')).sort();
    expect(sides).toEqual(['east', 'west']);
  });

  it('a mesma linha do tempo para jogador, bolha e descarga: cruzar a borda no ultimo tick decide', () => {
    for (const inside of [true, false]) {
      const { state } = flooded(9104);
      stepRun(state, [emptyCommand()]);
      const b = state.bossRuntime.protectiveBubbles[0];
      expect(b).toBeDefined();
      const hp = state.player.hp;
      // Fora ate o penultimo tick; no ultimo tick antes da descarga, para
      // dentro (ou continua um epsilon fora).
      state.player.x = b.x + b.radius + 2;
      state.player.y = b.y;
      for (let i = 1; i < LEVIATHAN_SHOCK_WINDUP_TICKS; i++) stepRun(state, [emptyCommand()]);
      state.player.x = inside ? b.x + b.radius : b.x + b.radius + 0.01;
      state.player.y = b.y;
      const events = stepRun(state, [emptyCommand()]).events;
      expect(events.some((e) => e.t === 'leviathan_discharge')).toBe(true);
      expect(hp - state.player.hp).toBe(inside ? 0 : LEVIATHAN_SHOCK_DAMAGE);
    }
  });
});

describe('Aquifero — a semantica da agua profunda', () => {
  it('Leviata e Lampreia atravessam agua profunda; inimigos terrestres ficam barrados', () => {
    const { state, w } = lencol();
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y) + 6;
    for (let x = px - 3; x <= px + 3; x++) state.surface[py * w + x] = SURF_DEEP_WATER;
    const cross = (archetype: 'sheet_leviathan' | 'mud_lamprey' | 'stalker'): boolean => {
      const ent = spawnEnemy(state, archetype, px, py - 1, false);
      // Empurra direto para dentro da faixa profunda, pelo mesmo caminho que
      // todo corpo usa: `moveEntity`, que e quem le `CROSSES_DEEP_WATER`.
      for (let k = 0; k < 4; k++) moveEntity(state, ent, 0, 0.3);
      const entered = Math.floor(ent.y) === py;
      state.enemies = state.enemies.filter((e) => e !== ent);
      return entered;
    };
    expect(cross('sheet_leviathan')).toBe(true);
    expect(cross('mud_lamprey')).toBe(true);
    expect(cross('stalker')).toBe(false);
  });

  it('agua profunda nativa e permanente e nunca vira gelo: o registro de buracos e que recongela', () => {
    const { state, boss, w } = lencol();
    const cell = Math.floor(boss.y) * w + Math.floor(boss.x);
    expect(state.iceHoles).toHaveLength(0);
    expect(sealIceHole(state, cell), 'selou agua profunda nativa como se fosse buraco').toBe(false);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
    for (let t = 0; t < 600; t++) stepRun(state, [emptyCommand()]);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
  });

  it('cair na agua profunda do Aquifero e uma queda de AGUA, nao de gelo', () => {
    const { state, px, py, w } = lencol();
    const cell = (py + 5) * w + px;
    state.surface[cell] = SURF_DEEP_WATER;
    state.player.x = px + 0.5;
    state.player.y = py + 5 + 0.5;
    const events = stepRun(state, [emptyCommand()]).events;
    const fall = events.find((e) => e.t === 'ice_fall');
    expect(fall?.t === 'ice_fall' ? fall.medium : null).toBe('water');
    expect(state.player.alive).toBe(false);
    expect(state.playerExtra.lastDamage?.cause.kind).toBe('deep_water');
  });
});
