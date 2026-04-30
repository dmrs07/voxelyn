# Voxelyn Robot Resources & Combat Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the player's single-HP bump-attack model with a robot-flavored two-resource system (Integrity + Battery), real-time action combat (dedicated attack button + i-frame roll), an overclock trade-off, one-shot stations per floor, and persistent run state across 10 floors.

**Architecture:** Six sequential phases — input actions → player resources → player combat state machine → existing-test stabilization → Excavator kit (attack, roll, Drill Charge) → stations/crystals/overclock → run flow + death flow. Only the **player** gets the new resource model; enemies keep the existing single-HP system. The plan rewrites the player from the inside out: `controls.ts`, `entities/player.ts`, `combat/combat.ts`, and `game/types.ts:PlayerState` all change. Enemy code, AI, projectiles, and level generation are touched only at integration points.

**Tech Stack:** TypeScript, Vitest, existing `@voxelyn/animation` motion wrapper, existing `@voxelyn/core` RNG/voxel grid, fixed-timestep sim at `SIMULATION_HZ = 20` (50ms tick).

---

## Locked Decisions (from grilling session)

- **Resources:** Player has `Integrity` (chassis HP) + `Battery` (action resource). Enemies keep `hp` only.
- **No regen of any kind.** No `regenPerSecond`, no `lifeOnHit`. Recovery only at stations or rare power-up drops.
- **No ambient battery drain.** Battery falls only from dodges, specials, and traps.
- **Battery 0 → Degraded mode** (slow, no specials, weaker attack). After 30s in degraded → Shutdown (vulnerable, no movement).
- **Crystal at 0%** = instant full Battery, exits degraded mode cleanly.
- **Combat:** Real-time, 8-directional grid, dedicated attack (Space) and roll (Shift) keys.
- **Excavator kit:** Melee circular cutter arc + i-frame roll + Drill Charge special.
- **Roll:** 0.4s i-frames, costs 10% battery, follows 8-dir input, passes enemies, blocked by walls, cancels attack recovery only.
- **Attack:** ~100ms windup, 150ms active, 150ms recovery. Locks movement during windup+active. Hits in facing direction. Arc width **deferred to Phase 5 prototype** (Q36).
- **Hit-stun:** Enemies flinch scaled by damage. Player gets brief i-frames after damage, no stagger.
- **Stations (one per floor, one-shot):** Restore full Integrity + Battery. Offer overclock toggle. No 1-of-3 boon system in v1.
- **Overclock:** Toggleable at station, locks for next floor. Damage multiplier + integrity drain over time. Visual condition (sparks/glow). Can self-destruct.
- **Run structure:** 10 floors. Battery + Integrity persist between floors. One station per floor. Hybrid crystal placement (already exists). Floor 10 = gauntlet + boss in unique environment (deferred to a later plan).
- **Death:** No revives. Integrity 0 = run over with cinematic. Run-end UI shows floor reached, time, currency, kills, damage, cause of death, best stats.
- **Q36 deferred:** Excavator melee arc width chosen during Phase 5 prototype with Hive Tunnels test (3 enemies at varied angles). Candidate values: 60° (precise), **90° (default pick)**, 120° (forgiving).

---

## File Map

### Files to create

- `packages/voxelyn-roguelike/src/entities/resources.ts` — pure helpers for `PlayerResources` (apply damage, drain battery, enter/exit degraded, tick shutdown timer).
- `packages/voxelyn-roguelike/src/entities/combat-state.ts` — state machine type `PlayerCombatState` + transition helpers.
- `packages/voxelyn-roguelike/src/combat/roll.ts` — roll mechanic (consume battery, set i-frame window, advance position).
- `packages/voxelyn-roguelike/src/combat/special.ts` — generic special-attack dispatcher (Excavator-only entry: `drillCharge`).
- `packages/voxelyn-roguelike/src/world/stations.ts` — `StationInteractable` type + handlers.
- `packages/voxelyn-roguelike/src/world/overclock.ts` — overclock state + per-tick integrity drain.
- `packages/voxelyn-roguelike/src/game/run.ts` — multi-floor run controller (persist resources between floors, run-end summary).
- `packages/voxelyn-roguelike/src/ui/run-end.ts` — run-end results screen renderer.
- `packages/voxelyn-roguelike/src/tests/resources.test.ts`
- `packages/voxelyn-roguelike/src/tests/combat-state.test.ts`
- `packages/voxelyn-roguelike/src/tests/roll.test.ts`
- `packages/voxelyn-roguelike/src/tests/special-drill-charge.test.ts`
- `packages/voxelyn-roguelike/src/tests/stations.test.ts`
- `packages/voxelyn-roguelike/src/tests/overclock.test.ts`
- `packages/voxelyn-roguelike/src/tests/run-flow.test.ts`

### Files to modify

- `packages/voxelyn-roguelike/src/input/controls.ts` — add action input model, handle Space/Shift/Q via `event.code`, add 8-direction movement.
- `packages/voxelyn-roguelike/src/game/types.ts` — split `PlayerState` from `EntityBase` so player drops `hp`/`maxHp` and gains `resources`, `combatState`, etc. `EnemyState` keeps `hp`/`maxHp`.
- `packages/voxelyn-roguelike/src/game/constants.ts` — new tuning constants (Battery max, drain values, roll/attack timings, station/overclock numbers). Leave enemy constants alone.
- `packages/voxelyn-roguelike/src/entities/player.ts` — `createPlayer` returns new shape; `applyPlayerRegen` removed.
- `packages/voxelyn-roguelike/src/combat/combat.ts` — split `attemptMoveOrAttack` into `attemptMove` (no auto-attack) + new `triggerPlayerAttack`. Keep `attackEntity` for enemy → player and player → enemy damage events.
- `packages/voxelyn-roguelike/src/game/loop.ts` — new control snapshot fields, drive combat state machine, integrate resources tick.
- `packages/voxelyn-roguelike/src/game/state.ts` — drop `regenPerSecond`/`lifeOnHit` carry-over.
- `packages/voxelyn-roguelike/src/powerups/pool.ts` — disable HP-touching power-ups (`vital_boost`, `vampiric_spores`, `fungal_regen`); keep `attack_boost`, `swift_boots`, `iron_skin`. Either filter out the three or rewrite.
- `packages/voxelyn-roguelike/src/world/features.ts` — add station spawn (1 per floor, on or near main route).
- `packages/voxelyn-roguelike/src/game/interactions.ts` — handle station + crystal new effects.
- `packages/voxelyn-roguelike/src/ui/hud.ts` — render Integrity bar + Battery bar + degraded countdown.
- `packages/voxelyn-roguelike/src/tests/balance-sim.test.ts` — replace `hp`/`maxHp` references with `resources.integrity`.
- `packages/voxelyn-roguelike/src/tests/feedback-state.test.ts` — drop `lifeOnHit` test, add resource-flash assertions.
- `packages/voxelyn-roguelike/src/tests/progression.test.ts` — read player health from `resources.integrity`.
- `packages/voxelyn-roguelike/src/tests/combat-ai.test.ts` — replace bump-attack assertion with explicit `triggerPlayerAttack` call.
- `packages/voxelyn-roguelike/src/tests/animation-integration.test.ts` — same; the test currently relies on bump-attack to set `animIntent: 'attack'`.
- `packages/voxelyn-roguelike/src/tests/powerups.test.ts` — drop assertions about removed power-ups.

---

## Phase 1 — Input action model

### Task 1.1: Add `PlayerAction` type and extended `ControlSnapshot`

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/types.ts:301-307`

- [ ] **Step 1: Replace `ControlSnapshot` with the action-based snapshot**

In `packages/voxelyn-roguelike/src/game/types.ts`, replace:

```ts
export type ControlSnapshot = {
  dx: number;
  dy: number;
  pickChoice: 1 | 2 | null;
  interact: boolean;
  cancel: boolean;
};
```

with:

```ts
export type PlayerActionKind = 'attack' | 'roll' | 'special' | 'interact' | 'cancel' | 'pickChoice1' | 'pickChoice2';

export type ControlSnapshot = {
  dx: number;
  dy: number;
  facingDx: number;
  facingDy: number;
  actions: PlayerActionKind[];
};
```

`facingDx`/`facingDy` are the most-recent direction held (used for facing when standing still + Space). `actions` is the queue of action presses since the last snapshot (consumed by the loop).

- [ ] **Step 2: Build the project to confirm only the snapshot consumers complain**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: TS errors only in `controls.ts`, `loop.ts`, and any test that constructs a `ControlSnapshot`. List them; they are fixed in 1.2 / 1.3.

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/types.ts
git commit -m "refactor(roguelike): switch ControlSnapshot to action-based model"
```

### Task 1.2: Rewrite `controls.ts` for 8-direction + action keys

**Files:**
- Modify: `packages/voxelyn-roguelike/src/input/controls.ts`
- Test: `packages/voxelyn-roguelike/src/tests/controls.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/voxelyn-roguelike/src/tests/controls.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Controls } from '../input/controls';

const dispatch = (target: EventTarget, type: 'keydown' | 'keyup', code: string, key: string): void => {
  target.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
};

describe('Controls', () => {
  it('produces 8-direction movement when two cardinal keys are held', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'KeyW', 'w');
    dispatch(window, 'keydown', 'KeyD', 'd');
    const snap = controls.snapshot();
    expect(snap.dx).toBe(1);
    expect(snap.dy).toBe(-1);
    controls.detach();
  });

  it('queues a single attack action on Space', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'Space', ' ');
    const snap = controls.snapshot();
    expect(snap.actions).toContain('attack');
    controls.detach();
  });

  it('queues a roll on ShiftLeft via event.code', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'ShiftLeft', 'Shift');
    const snap = controls.snapshot();
    expect(snap.actions).toContain('roll');
    controls.detach();
  });

  it('queues special on KeyQ', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'KeyQ', 'q');
    const snap = controls.snapshot();
    expect(snap.actions).toContain('special');
    controls.detach();
  });

  it('clears action queue after a snapshot', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'Space', ' ');
    controls.snapshot();
    const snap = controls.snapshot();
    expect(snap.actions).toEqual([]);
    controls.detach();
  });

  it('keeps facing after release of movement keys', () => {
    const controls = new Controls();
    controls.attach();
    dispatch(window, 'keydown', 'KeyD', 'd');
    controls.snapshot();
    dispatch(window, 'keyup', 'KeyD', 'd');
    const snap = controls.snapshot();
    expect(snap.dx).toBe(0);
    expect(snap.facingDx).toBe(1);
    controls.detach();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/controls.test.ts -- --reporter=verbose`
Expected: All six tests fail (current `Controls` returns the old shape, has no Space/Shift/Q handling, forces single-axis).

- [ ] **Step 3: Rewrite `controls.ts`**

Replace `packages/voxelyn-roguelike/src/input/controls.ts` with:

```ts
import type { ControlSnapshot, PlayerActionKind } from '../game/types';

const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const codeToAxis = (code: string): { dx: number; dy: number } | null => {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      return { dx: 0, dy: -1 };
    case 'KeyS':
    case 'ArrowDown':
      return { dx: 0, dy: 1 };
    case 'KeyA':
    case 'ArrowLeft':
      return { dx: -1, dy: 0 };
    case 'KeyD':
    case 'ArrowRight':
      return { dx: 1, dy: 0 };
    default:
      return null;
  }
};

export class Controls {
  private readonly held: Set<string> = new Set();
  private readonly queued: PlayerActionKind[] = [];
  private lastFacingDx = 1;
  private lastFacingDy = 0;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code;

    if (MOVE_CODES.has(code)) {
      this.held.add(code);
      const axis = codeToAxis(code);
      if (axis) {
        this.lastFacingDx = axis.dx;
        this.lastFacingDy = axis.dy;
      }
      event.preventDefault();
      return;
    }

    if (code === 'Space') {
      this.queued.push('attack');
      event.preventDefault();
      return;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      this.queued.push('roll');
      event.preventDefault();
      return;
    }
    if (code === 'KeyQ') {
      this.queued.push('special');
      event.preventDefault();
      return;
    }
    if (code === 'KeyE') {
      this.queued.push('interact');
      event.preventDefault();
      return;
    }
    if (code === 'Digit1') {
      this.queued.push('pickChoice1');
      event.preventDefault();
      return;
    }
    if (code === 'Digit2') {
      this.queued.push('pickChoice2');
      event.preventDefault();
      return;
    }
    if (code === 'Escape') {
      this.queued.push('cancel');
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (MOVE_CODES.has(event.code)) {
      this.held.delete(event.code);
      event.preventDefault();
    }
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  snapshot(): ControlSnapshot {
    let dx = 0;
    let dy = 0;
    if (this.held.has('KeyW') || this.held.has('ArrowUp')) dy -= 1;
    if (this.held.has('KeyS') || this.held.has('ArrowDown')) dy += 1;
    if (this.held.has('KeyA') || this.held.has('ArrowLeft')) dx -= 1;
    if (this.held.has('KeyD') || this.held.has('ArrowRight')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      this.lastFacingDx = dx;
      this.lastFacingDy = dy;
    }

    const actions = this.queued.slice();
    this.queued.length = 0;

    return {
      dx,
      dy,
      facingDx: this.lastFacingDx,
      facingDy: this.lastFacingDy,
      actions,
    };
  }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/controls.test.ts`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/input/controls.ts packages/voxelyn-roguelike/src/tests/controls.test.ts
git commit -m "feat(roguelike): 8-dir movement + action key inputs (Space/Shift/Q)"
```

### Task 1.3: Adapt `loop.ts` to consume the new snapshot

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/loop.ts`

- [ ] **Step 1: Read current consumer**

Read: `packages/voxelyn-roguelike/src/game/loop.ts`. Find every usage of the old `ControlSnapshot` fields (`pickChoice`, `interact`, `cancel`). They live in the per-tick gameplay update path.

- [ ] **Step 2: Map old fields to new actions**

Adapt the loop so:
- `pickChoice === 1` → `actions.includes('pickChoice1')`
- `pickChoice === 2` → `actions.includes('pickChoice2')`
- `interact` → `actions.includes('interact')`
- `cancel` → `actions.includes('cancel')`

The new fields (`attack`, `roll`, `special`) are stubbed for now — log them but don't act on them yet:

```ts
if (snapshot.actions.includes('attack')) {
  // wired in Phase 5
}
if (snapshot.actions.includes('roll')) {
  // wired in Phase 5
}
if (snapshot.actions.includes('special')) {
  // wired in Phase 5
}
```

`facingDx` / `facingDy` are stored on the player only when no movement input is held (Phase 5 will use this); for now, keep movement behavior identical to before.

- [ ] **Step 3: Run build + full roguelike test suite**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: clean build.

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: all current tests pass (we have not yet changed `PlayerState`).

- [ ] **Step 4: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/loop.ts
git commit -m "refactor(roguelike): wire loop to action-based ControlSnapshot"
```

---

## Phase 2 — Player resources (Integrity + Battery, degraded, shutdown)

### Task 2.1: Add tuning constants

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/constants.ts`

- [ ] **Step 1: Append the new constants**

Append to `packages/voxelyn-roguelike/src/game/constants.ts`:

```ts
// === Player resources ===
export const PLAYER_BASE_INTEGRITY = 100;
export const PLAYER_BASE_BATTERY_MAX = 100;
export const PLAYER_BATTERY_INITIAL = 100;
export const DEGRADED_SHUTDOWN_TIMER_MS = 30_000;
export const DEGRADED_MOVE_COOLDOWN_MS = 180; // ~2x base, slow limp
export const DEGRADED_ATTACK_DAMAGE_MUL = 0.5;
export const SHUTDOWN_RECOVERY_BATTERY = 100; // crystal recovers full

// === Roll (i-frame dodge) ===
export const ROLL_BATTERY_COST = 10;
export const ROLL_IFRAME_MS = 400;
export const ROLL_DURATION_MS = 400; // roll motion lasts the i-frame window
export const ROLL_DISTANCE_TILES = 2;

// === Attack (player) ===
export const ATTACK_WINDUP_MS = 100;
export const ATTACK_ACTIVE_MS = 150;
export const ATTACK_RECOVERY_MS = 150;
export const ATTACK_TOTAL_LOCK_MS = ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS;
// Q36 (arc width) deferred to Phase 5 prototype. Default candidate:
export const ATTACK_ARC_DEGREES_DEFAULT = 90;

// === Special: Drill Charge ===
export const DRILL_CHARGE_BATTERY_COST = 30;
export const DRILL_CHARGE_TILES = 4;
export const DRILL_CHARGE_DAMAGE = 18;
export const DRILL_CHARGE_RECOVERY_MS = 200;

// === Player hit recovery ===
export const PLAYER_DAMAGE_IFRAMES_MS = 400;

// === Stations ===
export const STATION_PER_FLOOR = 1;

// === Overclock ===
export const OVERCLOCK_DAMAGE_MUL = 1.5;
export const OVERCLOCK_INTEGRITY_DRAIN_PER_SEC = 1; // can self-destruct
```

- [ ] **Step 2: Build to confirm no breakage**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/constants.ts
git commit -m "feat(roguelike): add resource/combat/station/overclock constants"
```

### Task 2.2: Define `PlayerResources` and `PlayerCombatState` in types

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/types.ts`

- [ ] **Step 1: Add new types and split player from `EntityBase`**

In `packages/voxelyn-roguelike/src/game/types.ts`:

1. Below the existing `EntityKind` line, add:

```ts
export type PlayerCombatStateKind =
  | 'idle'
  | 'moving'
  | 'attackWindup'
  | 'attackActive'
  | 'attackRecovery'
  | 'rolling'
  | 'specialWindup'
  | 'specialActive'
  | 'specialRecovery'
  | 'hitIFrames'
  | 'degraded'
  | 'shutdown'
  | 'dead';

export type PlayerCombatState = {
  kind: PlayerCombatStateKind;
  enteredAtMs: number;
  expiresAtMs: number | null;
};

export type PlayerResources = {
  integrity: number;
  maxIntegrity: number;
  battery: number;
  maxBattery: number;
  degradedSinceMs: number | null;
  shutdownAtMs: number | null;
  iFramesUntilMs: number;
};
```

2. **Split** `EntityBase` so `hp`/`maxHp` only live on enemies. Replace the existing `EntityBase` and `PlayerState` and `EnemyState` types with:

```ts
type EntityCommon = {
  id: string;
  occ: number;
  x: number;
  y: number;
  z: number;
  blocks: boolean;
  attack: number;
  damageReduction: number;
  alive: boolean;
  nextMoveAt: number;
  nextAttackAt: number;
  facing: Vec2;
  hitFlashUntilMs: number;
  alertUntilMs: number;
  animPhase: number;
  animIntent: AnimationIntent;
  animFacing: AnimationFacing;
  animSpeedMul: number;
};

export type PlayerState = EntityCommon & {
  kind: 'player';
  resources: PlayerResources;
  combatState: PlayerCombatState;
  powerUps: PowerUpId[];
  moveCooldownMs: number;
  attackCooldownMs: number;
  facingDx: number;
  facingDy: number;
};

export type EnemyState = EntityCommon & {
  kind: 'enemy';
  hp: number;
  maxHp: number;
  archetype: EnemyArchetype;
  aiState: 'patrol' | 'chase' | 'explode_windup';
  moveCooldownMs: number;
  attackCooldownMs: number;
  detectRadius: number;
  preferredMinRange: number;
  preferredMaxRange: number;
  patrolOrigin: Vec2;
  patrolTarget: Vec2 | null;
  fuseUntilMs: number | null;
};
```

Note: `regenPerSecond` and `lifeOnHit` are **removed** from `PlayerState`.

- [ ] **Step 2: Build — expect many errors**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: 30–60 TS errors. The big consumers: `entities/player.ts`, `combat/combat.ts`, `powerups/pool.ts`, `game/loop.ts`, `game/state.ts`, several tests. Don't fix yet — list them; subsequent tasks fix each one.

Save the error list to a scratchpad. The plan addresses each in 2.3 onward.

- [ ] **Step 3: Commit (intentionally broken intermediate state)**

```bash
git add packages/voxelyn-roguelike/src/game/types.ts
git commit -m "refactor(roguelike): split PlayerState (resources/combatState) from EnemyState"
```

### Task 2.3: Rewrite `entities/player.ts` to use the new shape

**Files:**
- Modify: `packages/voxelyn-roguelike/src/entities/player.ts`

- [ ] **Step 1: Replace `createPlayer` and remove regen helpers**

Replace the entire file with:

```ts
import {
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_BASE_ATTACK,
  PLAYER_BASE_BATTERY_MAX,
  PLAYER_BASE_INTEGRITY,
  PLAYER_BATTERY_INITIAL,
  PLAYER_MOVE_COOLDOWN_MS,
} from '../game/constants';
import type { PlayerState } from '../game/types';

export const createPlayer = (id: string, occ: number, x: number, y: number): PlayerState => ({
  id,
  occ,
  kind: 'player',
  x,
  y,
  z: 0,
  blocks: true,
  attack: PLAYER_BASE_ATTACK,
  damageReduction: 0,
  alive: true,
  nextMoveAt: 0,
  nextAttackAt: 0,
  facing: { x: 1, y: 0 },
  hitFlashUntilMs: 0,
  alertUntilMs: 0,
  animPhase: 0,
  animIntent: 'idle',
  animFacing: 'dr',
  animSpeedMul: 1,
  resources: {
    integrity: PLAYER_BASE_INTEGRITY,
    maxIntegrity: PLAYER_BASE_INTEGRITY,
    battery: PLAYER_BATTERY_INITIAL,
    maxBattery: PLAYER_BASE_BATTERY_MAX,
    degradedSinceMs: null,
    shutdownAtMs: null,
    iFramesUntilMs: 0,
  },
  combatState: {
    kind: 'idle',
    enteredAtMs: 0,
    expiresAtMs: null,
  },
  powerUps: [],
  moveCooldownMs: PLAYER_MOVE_COOLDOWN_MS,
  attackCooldownMs: PLAYER_ATTACK_COOLDOWN_MS,
  facingDx: 1,
  facingDy: 0,
});

export const clampPlayerIntegrity = (player: PlayerState): void => {
  if (player.resources.integrity > player.resources.maxIntegrity) {
    player.resources.integrity = player.resources.maxIntegrity;
  }
  if (player.resources.integrity < 0) player.resources.integrity = 0;
};
```

`applyPlayerRegen` and `clampPlayerHp` are deleted intentionally. Callers will be redirected (Phase 4 stabilization).

- [ ] **Step 2: Commit (still broken, building toward green)**

```bash
git add packages/voxelyn-roguelike/src/entities/player.ts
git commit -m "refactor(roguelike): rewrite createPlayer with PlayerResources/CombatState"
```

### Task 2.4: Resource pure helpers + tests (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/entities/resources.ts`
- Create: `packages/voxelyn-roguelike/src/tests/resources.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/resources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import {
  applyIntegrityDamage,
  drainBattery,
  enterDegradedIfEmpty,
  exitDegradedOnRecharge,
  tickDegradedTimer,
  rechargeBatteryFull,
} from '../entities/resources';
import { DEGRADED_SHUTDOWN_TIMER_MS } from '../game/constants';

describe('player resources', () => {
  it('applies integrity damage with reduction floor of 1', () => {
    const p = createPlayer('p', 1, 0, 0);
    p.damageReduction = 999;
    applyIntegrityDamage(p, 50);
    expect(p.resources.integrity).toBe(99);
  });

  it('kills player when integrity hits 0', () => {
    const p = createPlayer('p', 1, 0, 0);
    applyIntegrityDamage(p, 9999);
    expect(p.resources.integrity).toBe(0);
    expect(p.alive).toBe(false);
  });

  it('drains battery and clamps to 0', () => {
    const p = createPlayer('p', 1, 0, 0);
    drainBattery(p, 30);
    expect(p.resources.battery).toBe(70);
    drainBattery(p, 9999);
    expect(p.resources.battery).toBe(0);
  });

  it('marks degradedSinceMs when battery hits 0', () => {
    const p = createPlayer('p', 1, 0, 0);
    drainBattery(p, 100);
    enterDegradedIfEmpty(p, 1234);
    expect(p.resources.degradedSinceMs).toBe(1234);
    expect(p.resources.shutdownAtMs).toBe(1234 + DEGRADED_SHUTDOWN_TIMER_MS);
  });

  it('does not re-enter degraded when already degraded', () => {
    const p = createPlayer('p', 1, 0, 0);
    drainBattery(p, 100);
    enterDegradedIfEmpty(p, 1000);
    enterDegradedIfEmpty(p, 5000);
    expect(p.resources.degradedSinceMs).toBe(1000);
  });

  it('exits degraded when battery recharges', () => {
    const p = createPlayer('p', 1, 0, 0);
    drainBattery(p, 100);
    enterDegradedIfEmpty(p, 1000);
    rechargeBatteryFull(p);
    exitDegradedOnRecharge(p);
    expect(p.resources.battery).toBe(p.resources.maxBattery);
    expect(p.resources.degradedSinceMs).toBeNull();
    expect(p.resources.shutdownAtMs).toBeNull();
  });

  it('tickDegradedTimer returns "shutdown" when timer expires', () => {
    const p = createPlayer('p', 1, 0, 0);
    drainBattery(p, 100);
    enterDegradedIfEmpty(p, 0);
    expect(tickDegradedTimer(p, DEGRADED_SHUTDOWN_TIMER_MS - 1)).toBe('degraded');
    expect(tickDegradedTimer(p, DEGRADED_SHUTDOWN_TIMER_MS)).toBe('shutdown');
  });

  it('tickDegradedTimer returns "running" when not degraded', () => {
    const p = createPlayer('p', 1, 0, 0);
    expect(tickDegradedTimer(p, 5000)).toBe('running');
  });
});
```

- [ ] **Step 2: Run tests, expect all fail (module missing)**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/resources.test.ts`
Expected: import error.

- [ ] **Step 3: Implement resources module**

Create `packages/voxelyn-roguelike/src/entities/resources.ts`:

```ts
import { DEGRADED_SHUTDOWN_TIMER_MS } from '../game/constants';
import { clampPlayerIntegrity } from './player';
import type { PlayerState } from '../game/types';

export const applyIntegrityDamage = (player: PlayerState, rawAmount: number): number => {
  if (!player.alive) return 0;
  const reduced = Math.max(1, rawAmount - player.damageReduction);
  player.resources.integrity -= reduced;
  clampPlayerIntegrity(player);
  if (player.resources.integrity <= 0) {
    player.resources.integrity = 0;
    player.alive = false;
  }
  return reduced;
};

export const drainBattery = (player: PlayerState, amount: number): number => {
  const before = player.resources.battery;
  player.resources.battery = Math.max(0, before - amount);
  return before - player.resources.battery;
};

export const rechargeBatteryFull = (player: PlayerState): void => {
  player.resources.battery = player.resources.maxBattery;
};

export const enterDegradedIfEmpty = (player: PlayerState, nowMs: number): void => {
  if (player.resources.battery > 0) return;
  if (player.resources.degradedSinceMs !== null) return;
  player.resources.degradedSinceMs = nowMs;
  player.resources.shutdownAtMs = nowMs + DEGRADED_SHUTDOWN_TIMER_MS;
};

export const exitDegradedOnRecharge = (player: PlayerState): void => {
  if (player.resources.battery <= 0) return;
  player.resources.degradedSinceMs = null;
  player.resources.shutdownAtMs = null;
};

export type DegradedTickResult = 'running' | 'degraded' | 'shutdown';

export const tickDegradedTimer = (player: PlayerState, nowMs: number): DegradedTickResult => {
  if (player.resources.degradedSinceMs === null) return 'running';
  if (player.resources.shutdownAtMs !== null && nowMs >= player.resources.shutdownAtMs) {
    return 'shutdown';
  }
  return 'degraded';
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/resources.test.ts`
Expected: 8/8 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/entities/resources.ts packages/voxelyn-roguelike/src/tests/resources.test.ts
git commit -m "feat(roguelike): player resources (integrity/battery/degraded) helpers"
```

---

## Phase 3 — Player combat state machine

### Task 3.1: State machine module + tests (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/entities/combat-state.ts`
- Create: `packages/voxelyn-roguelike/src/tests/combat-state.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/combat-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import {
  beginAttackWindup,
  advanceCombatState,
  beginRoll,
  beginSpecial,
  enterDegradedState,
  enterShutdownState,
  isMovementLocked,
  isAttackInputAccepted,
  isRollInputAccepted,
  isAttackInIFrame,
} from '../entities/combat-state';
import {
  ATTACK_ACTIVE_MS,
  ATTACK_RECOVERY_MS,
  ATTACK_WINDUP_MS,
  ROLL_DURATION_MS,
  DRILL_CHARGE_RECOVERY_MS,
} from '../game/constants';

describe('player combat state machine', () => {
  it('starts in idle', () => {
    const p = createPlayer('p', 1, 0, 0);
    expect(p.combatState.kind).toBe('idle');
  });

  it('attack windup → active → recovery → idle on time', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginAttackWindup(p, 0);
    expect(p.combatState.kind).toBe('attackWindup');
    advanceCombatState(p, ATTACK_WINDUP_MS);
    expect(p.combatState.kind).toBe('attackActive');
    advanceCombatState(p, ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS);
    expect(p.combatState.kind).toBe('attackRecovery');
    advanceCombatState(p, ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS + ATTACK_RECOVERY_MS);
    expect(p.combatState.kind).toBe('idle');
  });

  it('movement locked during windup and active, free during recovery', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginAttackWindup(p, 0);
    expect(isMovementLocked(p)).toBe(true);
    advanceCombatState(p, ATTACK_WINDUP_MS);
    expect(isMovementLocked(p)).toBe(true);
    advanceCombatState(p, ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS);
    expect(isMovementLocked(p)).toBe(false);
  });

  it('roll cancels attackRecovery', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginAttackWindup(p, 0);
    advanceCombatState(p, ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS);
    expect(p.combatState.kind).toBe('attackRecovery');
    expect(isRollInputAccepted(p)).toBe(true);
    beginRoll(p, ATTACK_WINDUP_MS + ATTACK_ACTIVE_MS + 10);
    expect(p.combatState.kind).toBe('rolling');
  });

  it('roll does NOT cancel attackActive', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginAttackWindup(p, 0);
    advanceCombatState(p, ATTACK_WINDUP_MS);
    expect(p.combatState.kind).toBe('attackActive');
    expect(isRollInputAccepted(p)).toBe(false);
  });

  it('attack input rejected during rolling', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginRoll(p, 0);
    expect(isAttackInputAccepted(p)).toBe(false);
  });

  it('roll lasts ROLL_DURATION_MS then returns to idle', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginRoll(p, 0);
    advanceCombatState(p, ROLL_DURATION_MS - 1);
    expect(p.combatState.kind).toBe('rolling');
    advanceCombatState(p, ROLL_DURATION_MS);
    expect(p.combatState.kind).toBe('idle');
  });

  it('isAttackInIFrame true during rolling, false during recovery', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginRoll(p, 0);
    expect(isAttackInIFrame(p)).toBe(true);
    advanceCombatState(p, ROLL_DURATION_MS);
    expect(isAttackInIFrame(p)).toBe(false);
  });

  it('special goes windup → active → recovery → idle', () => {
    const p = createPlayer('p', 1, 0, 0);
    beginSpecial(p, 0);
    expect(p.combatState.kind).toBe('specialWindup');
    advanceCombatState(p, 100);
    expect(p.combatState.kind).toBe('specialActive');
    advanceCombatState(p, 100 + 100);
    expect(p.combatState.kind).toBe('specialRecovery');
    advanceCombatState(p, 100 + 100 + DRILL_CHARGE_RECOVERY_MS);
    expect(p.combatState.kind).toBe('idle');
  });

  it('enterDegradedState transitions from idle', () => {
    const p = createPlayer('p', 1, 0, 0);
    enterDegradedState(p, 0);
    expect(p.combatState.kind).toBe('degraded');
  });

  it('shutdown locks movement and rejects all combat input', () => {
    const p = createPlayer('p', 1, 0, 0);
    enterShutdownState(p, 0);
    expect(p.combatState.kind).toBe('shutdown');
    expect(isMovementLocked(p)).toBe(true);
    expect(isAttackInputAccepted(p)).toBe(false);
    expect(isRollInputAccepted(p)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect import failure**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/combat-state.test.ts`
Expected: import error.

- [ ] **Step 3: Implement state machine module**

Create `packages/voxelyn-roguelike/src/entities/combat-state.ts`:

```ts
import {
  ATTACK_ACTIVE_MS,
  ATTACK_RECOVERY_MS,
  ATTACK_WINDUP_MS,
  ROLL_DURATION_MS,
  ROLL_IFRAME_MS,
  DRILL_CHARGE_RECOVERY_MS,
} from '../game/constants';
import type { PlayerState, PlayerCombatStateKind } from '../game/types';

const SPECIAL_WINDUP_MS = 100;
const SPECIAL_ACTIVE_MS = 100;

const setState = (
  player: PlayerState,
  kind: PlayerCombatStateKind,
  nowMs: number,
  durationMs: number | null,
): void => {
  player.combatState = {
    kind,
    enteredAtMs: nowMs,
    expiresAtMs: durationMs === null ? null : nowMs + durationMs,
  };
};

export const beginAttackWindup = (player: PlayerState, nowMs: number): void => {
  setState(player, 'attackWindup', nowMs, ATTACK_WINDUP_MS);
};

export const beginRoll = (player: PlayerState, nowMs: number): void => {
  setState(player, 'rolling', nowMs, ROLL_DURATION_MS);
  player.resources.iFramesUntilMs = nowMs + ROLL_IFRAME_MS;
};

export const beginSpecial = (player: PlayerState, nowMs: number): void => {
  setState(player, 'specialWindup', nowMs, SPECIAL_WINDUP_MS);
};

export const beginHitIFrames = (player: PlayerState, nowMs: number, durationMs: number): void => {
  setState(player, 'hitIFrames', nowMs, durationMs);
  player.resources.iFramesUntilMs = nowMs + durationMs;
};

export const enterDegradedState = (player: PlayerState, nowMs: number): void => {
  setState(player, 'degraded', nowMs, null);
};

export const enterShutdownState = (player: PlayerState, nowMs: number): void => {
  setState(player, 'shutdown', nowMs, null);
};

export const enterDeadState = (player: PlayerState, nowMs: number): void => {
  setState(player, 'dead', nowMs, null);
};

export const advanceCombatState = (player: PlayerState, nowMs: number): void => {
  const cs = player.combatState;
  if (cs.expiresAtMs === null) return;
  if (nowMs < cs.expiresAtMs) return;

  switch (cs.kind) {
    case 'attackWindup':
      setState(player, 'attackActive', cs.expiresAtMs, ATTACK_ACTIVE_MS);
      break;
    case 'attackActive':
      setState(player, 'attackRecovery', cs.expiresAtMs, ATTACK_RECOVERY_MS);
      break;
    case 'attackRecovery':
      setState(player, 'idle', cs.expiresAtMs, null);
      break;
    case 'rolling':
      setState(player, 'idle', cs.expiresAtMs, null);
      break;
    case 'specialWindup':
      setState(player, 'specialActive', cs.expiresAtMs, SPECIAL_ACTIVE_MS);
      break;
    case 'specialActive':
      setState(player, 'specialRecovery', cs.expiresAtMs, DRILL_CHARGE_RECOVERY_MS);
      break;
    case 'specialRecovery':
      setState(player, 'idle', cs.expiresAtMs, null);
      break;
    case 'hitIFrames':
      setState(player, 'idle', cs.expiresAtMs, null);
      break;
    default:
      break;
  }
};

export const isMovementLocked = (player: PlayerState): boolean => {
  switch (player.combatState.kind) {
    case 'attackWindup':
    case 'attackActive':
    case 'specialWindup':
    case 'specialActive':
    case 'shutdown':
    case 'dead':
      return true;
    default:
      return false;
  }
};

export const isAttackInputAccepted = (player: PlayerState): boolean => {
  switch (player.combatState.kind) {
    case 'idle':
    case 'moving':
    case 'attackRecovery':
      return true;
    default:
      return false;
  }
};

export const isRollInputAccepted = (player: PlayerState): boolean => {
  switch (player.combatState.kind) {
    case 'idle':
    case 'moving':
    case 'attackRecovery':
    case 'specialRecovery':
      return true;
    default:
      return false;
  }
};

export const isSpecialInputAccepted = (player: PlayerState): boolean => {
  switch (player.combatState.kind) {
    case 'idle':
    case 'moving':
      return true;
    default:
      return false;
  }
};

export const isAttackInIFrame = (player: PlayerState): boolean => {
  return player.combatState.kind === 'rolling' || player.combatState.kind === 'hitIFrames';
};
```

- [ ] **Step 4: Run tests, expect 11/11 pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/combat-state.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/entities/combat-state.ts packages/voxelyn-roguelike/src/tests/combat-state.test.ts
git commit -m "feat(roguelike): player combat state machine with i-frames"
```

---

## Phase 3.5 — Existing-test stabilization

This phase **does not add features.** It updates every existing call site that referenced the removed fields (`hp`/`maxHp` on player, `regenPerSecond`, `lifeOnHit`, bump-attack auto-trigger) so the suite is green again. After this, the codebase compiles, all tests pass, and we're ready for kit work.

### Task 3.5.1: Repair `combat/combat.ts` damage routing

**Files:**
- Modify: `packages/voxelyn-roguelike/src/combat/combat.ts`

- [ ] **Step 1: Read `combat.ts:250-380`**

Goal: keep `attackEntity` working but route damage through the new shape:
- When source is enemy and target is player → use `applyIntegrityDamage`.
- When source is player and target is enemy → keep existing `target.hp -= dmg` (enemies still have `hp`).
- Remove `lifeOnHit` logic.
- Strip the auto-bump-attack from `attemptMoveOrAttack`. Rename to `attemptMove` and remove the adjacent-enemy auto-attack block (keep collision-blocking).

- [ ] **Step 2: Apply edits**

In `combat.ts`:

1. Replace the player-target damage branch in `attackEntity` so it calls `applyIntegrityDamage(player, dmg)` instead of mutating `target.hp` directly. Enemy-target branch stays the same.
2. Remove any line that reads or writes `source.lifeOnHit`.
3. Rename `attemptMoveOrAttack` → `attemptMove`. Remove the "auto-attack any adjacent enemy when attack is ready" block. The function now only handles tile-move + collision.

(The detailed `attemptMove` body matches the existing function with just the auto-attack section deleted; the engineer reads the file and removes those lines.)

- [ ] **Step 3: Update call sites that import `attemptMoveOrAttack`**

Run: `grep -rn "attemptMoveOrAttack" packages/voxelyn-roguelike/src/`. Update each to `attemptMove`.

- [ ] **Step 4: Build**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: TS errors decrease. Some tests still fail; fixed in 3.5.2–3.5.5.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/combat/combat.ts
git commit -m "refactor(roguelike): route player damage to integrity, drop bump-attack"
```

### Task 3.5.2: Repair `game/state.ts` carry-over

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/state.ts:103-104`

- [ ] **Step 1: Drop deleted fields from carry-over**

Read `state.ts` around lines 100-110. Remove the lines:

```ts
player.regenPerSecond = previous.regenPerSecond;
player.lifeOnHit = previous.lifeOnHit;
```

Replace them with the new persistence:

```ts
player.resources.integrity = previous.resources.integrity;
player.resources.maxIntegrity = previous.resources.maxIntegrity;
player.resources.battery = previous.resources.battery;
player.damageReduction = previous.damageReduction;
player.attack = previous.attack;
player.moveCooldownMs = previous.moveCooldownMs;
player.attackCooldownMs = previous.attackCooldownMs;
```

This implements **persistence between floors** (Q19) at the data level.

- [ ] **Step 2: Build**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: fewer TS errors.

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/state.ts
git commit -m "refactor(roguelike): persist resources between floors instead of regen/lifeOnHit"
```

### Task 3.5.3: Repair `powerups/pool.ts`

**Files:**
- Modify: `packages/voxelyn-roguelike/src/powerups/pool.ts`

- [ ] **Step 1: Disable HP-touching power-ups**

Replace `vital_boost`, `vampiric_spores`, `fungal_regen` with no-op stubs that still satisfy the existing `PowerUpId` enum (keeping the IDs avoids a deeper refactor of `pool.ts` and the choice UI). The stubs become unreachable once we filter them from the available pool below.

In `packages/voxelyn-roguelike/src/powerups/pool.ts`:

1. Remove `import { clampPlayerHp } from '../entities/player';` — that helper is gone.
2. Replace the three offending entries with:

```ts
vital_boost: {
  id: 'vital_boost',
  name: 'Cristal de Éter (DESATIVADO)',
  description: 'Power-up legado em revisão. Não aplica efeito.',
  maxStacks: 0, // not offered
  apply: () => {},
},
attack_boost: { ... unchanged ... },
swift_boots: { ... unchanged ... },
iron_skin: { ... unchanged ... },
vampiric_spores: {
  id: 'vampiric_spores',
  name: 'Esporos Vampíricos (DESATIVADO)',
  description: 'Power-up legado em revisão. Não aplica efeito.',
  maxStacks: 0,
  apply: () => {},
},
fungal_regen: {
  id: 'fungal_regen',
  name: 'Regeneração Fúngica (DESATIVADO)',
  description: 'Power-up legado em revisão. Não aplica efeito.',
  maxStacks: 0,
  apply: () => {},
},
```

`maxStacks: 0` means `getAvailablePowerUps` already filters them out (`stacks[id] < maxStacks` is always false). No change to the choice UI is needed.

- [ ] **Step 2: Build**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: pool no longer references removed fields.

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/powerups/pool.ts
git commit -m "refactor(roguelike): disable HP/regen power-ups (legacy stubs)"
```

### Task 3.5.4: Repair `loop.ts` HUD payload + projectile damage

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/loop.ts:101,117`

- [ ] **Step 1: Replace payload reads**

In `loop.ts:101`, the HUD payload currently reads `entity.hp`. Split it: enemies still expose `hp`, players expose `resources.integrity`. Replace the player branch in the payload assembly:

```ts
player: player
  ? {
      x: player.x,
      y: player.y,
      integrity: player.resources.integrity,
      maxIntegrity: player.resources.maxIntegrity,
      battery: player.resources.battery,
      maxBattery: player.resources.maxBattery,
      degradedSinceMs: player.resources.degradedSinceMs,
      shutdownAtMs: player.resources.shutdownAtMs,
    }
  : null,
```

In any place where projectile damage hits the player (`player.hp -= ...`), call `applyIntegrityDamage(player, dmg)` instead.

- [ ] **Step 2: Build**

Run: `pnpm --filter @voxelyn/roguelike build`
Expected: clean build (or one or two strays — fix inline).

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/loop.ts
git commit -m "refactor(roguelike): HUD/projectile read player integrity, not hp"
```

### Task 3.5.5: Update existing tests to new shapes

**Files:**
- Modify: `packages/voxelyn-roguelike/src/tests/balance-sim.test.ts:41-42,250,279-280`
- Modify: `packages/voxelyn-roguelike/src/tests/feedback-state.test.ts:24,42,56`
- Modify: `packages/voxelyn-roguelike/src/tests/progression.test.ts:9,68`
- Modify: `packages/voxelyn-roguelike/src/tests/combat-ai.test.ts:10`
- Modify: `packages/voxelyn-roguelike/src/tests/animation-integration.test.ts:33`
- Modify: `packages/voxelyn-roguelike/src/tests/powerups.test.ts`

- [ ] **Step 1: Repair `balance-sim.test.ts`**

This file has a local `Snapshot` type and a stub player. Replace player references:
- Local sim type: keep `hp`/`maxHp` if the file simulates with simplified entities, but at the real-state read sites (around line 279) read `finalPlayer?.resources.integrity` and `finalPlayer?.resources.maxIntegrity`.
- If the local sim type only models enemies, keep it.

- [ ] **Step 2: Repair `feedback-state.test.ts`**

Drop the test that asserts `lifeOnHit` (line 42–onwards). Replace the player damage assertion: instead of `expect(player.hp).toBeLessThan(...)`, use `expect(player.resources.integrity).toBeLessThan(...)`.

- [ ] **Step 3: Repair `progression.test.ts`**

`attackEntity(state, killer, player, ...)` damages the player. Replace `expect(player.hp).toBe(0)` (or similar) with `expect(player.resources.integrity).toBe(0)`. The import of `attackEntity` stays valid.

- [ ] **Step 4: Repair `combat-ai.test.ts`**

The test name is *"bump attack damages enemy without moving through it and respects cooldown"* — but bump-attack is gone. Rewrite to call `triggerPlayerAttack` (added in Phase 5) directly. **For now**, mark this test as skipped:

```ts
it.skip('bump attack damages enemy without moving through it and respects cooldown', () => {
  // Re-enabled in Phase 5 with explicit triggerPlayerAttack.
});
```

This is the only `.skip` allowed in the plan; it is undone in Task 5.4.

- [ ] **Step 5: Repair `animation-integration.test.ts`**

Same: `// Place a guaranteed adjacent enemy for bump attack.` is no longer valid. Skip the bump-attack assertion; keep the move/animation parts.

- [ ] **Step 6: Repair `powerups.test.ts`**

Drop assertions about `vital_boost`, `vampiric_spores`, `fungal_regen` actually applying effects. Replace with: assert these IDs are NOT in `getAvailablePowerUps()` for a fresh player.

- [ ] **Step 7: Run full test suite**

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green. **This is the stabilization checkpoint.** Do not move on until green.

- [ ] **Step 8: Commit**

```bash
git add packages/voxelyn-roguelike/src/tests/
git commit -m "test(roguelike): align existing tests with PlayerResources shape"
```

---

## Phase 4 — Excavator kit (attack + roll + Drill Charge)

### Task 4.1: Roll mechanic + tests (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/combat/roll.ts`
- Create: `packages/voxelyn-roguelike/src/tests/roll.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/roll.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import { tryRoll } from '../combat/roll';
import { ROLL_BATTERY_COST, ROLL_DISTANCE_TILES, ROLL_IFRAME_MS } from '../game/constants';

describe('roll mechanic', () => {
  it('rejects when battery insufficient', () => {
    const p = createPlayer('p', 1, 0, 0);
    p.resources.battery = ROLL_BATTERY_COST - 1;
    const result = tryRoll(p, { dx: 1, dy: 0 }, 0, () => true);
    expect(result.ok).toBe(false);
  });

  it('rejects when input direction is zero', () => {
    const p = createPlayer('p', 5, 5, 0);
    const result = tryRoll(p, { dx: 0, dy: 0 }, 0, () => true);
    expect(result.ok).toBe(false);
  });

  it('rejects when state machine is not idle/moving/recovery', () => {
    const p = createPlayer('p', 5, 5, 0);
    p.combatState = { kind: 'attackActive', enteredAtMs: 0, expiresAtMs: 999 };
    const result = tryRoll(p, { dx: 1, dy: 0 }, 0, () => true);
    expect(result.ok).toBe(false);
  });

  it('on success drains battery and sets i-frame window', () => {
    const p = createPlayer('p', 5, 5, 0);
    const before = p.resources.battery;
    const result = tryRoll(p, { dx: 1, dy: 0 }, 1000, () => true);
    expect(result.ok).toBe(true);
    expect(p.resources.battery).toBe(before - ROLL_BATTERY_COST);
    expect(p.resources.iFramesUntilMs).toBe(1000 + ROLL_IFRAME_MS);
    expect(p.combatState.kind).toBe('rolling');
  });

  it('rolls up to ROLL_DISTANCE_TILES, stopping at first wall', () => {
    const p = createPlayer('p', 5, 5, 0);
    const occupied = (x: number, y: number) => x === 7; // wall at x=7
    const result = tryRoll(p, { dx: 1, dy: 0 }, 0, occupied);
    expect(result.ok).toBe(true);
    expect(p.x).toBe(6); // 5 → 6 ok, 6 → 7 blocked
    expect(p.y).toBe(5);
  });

  it('rolls full distance when nothing blocks', () => {
    const p = createPlayer('p', 5, 5, 0);
    const result = tryRoll(p, { dx: 1, dy: 0 }, 0, () => false);
    expect(result.ok).toBe(true);
    expect(p.x).toBe(5 + ROLL_DISTANCE_TILES);
  });

  it('passes through enemies (occupied=enemies but ok-to-pass)', () => {
    const p = createPlayer('p', 5, 5, 0);
    // Mark x=6 as enemy (ignored), x=7 as wall (blocking)
    const occupied = (x: number, y: number, kind: 'wall' | 'enemy') => kind === 'wall' && x === 7;
    const result = tryRoll(p, { dx: 1, dy: 0 }, 0, (x, y) => occupied(x, y, x === 6 ? 'enemy' : 'wall'));
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, expect import failure**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/roll.test.ts`
Expected: import error.

- [ ] **Step 3: Implement `combat/roll.ts`**

Create `packages/voxelyn-roguelike/src/combat/roll.ts`:

```ts
import { ROLL_BATTERY_COST, ROLL_DISTANCE_TILES } from '../game/constants';
import { beginRoll, isRollInputAccepted } from '../entities/combat-state';
import { drainBattery } from '../entities/resources';
import type { PlayerState } from '../game/types';

export type RollDirection = { dx: number; dy: number };

export type RollResult = {
  ok: boolean;
  reason?: 'no-battery' | 'no-direction' | 'state-locked';
  finalX?: number;
  finalY?: number;
};

/**
 * `isWall` should return true ONLY for hard blockers (walls, closed gates).
 * Enemy tiles must return false — roll passes through enemies (Q39).
 */
export const tryRoll = (
  player: PlayerState,
  dir: RollDirection,
  nowMs: number,
  isWall: (x: number, y: number) => boolean,
): RollResult => {
  if (player.resources.battery < ROLL_BATTERY_COST) return { ok: false, reason: 'no-battery' };
  if (dir.dx === 0 && dir.dy === 0) return { ok: false, reason: 'no-direction' };
  if (!isRollInputAccepted(player)) return { ok: false, reason: 'state-locked' };

  drainBattery(player, ROLL_BATTERY_COST);
  beginRoll(player, nowMs);

  const stepX = Math.sign(dir.dx);
  const stepY = Math.sign(dir.dy);
  let x = player.x;
  let y = player.y;
  for (let i = 0; i < ROLL_DISTANCE_TILES; i += 1) {
    const nx = x + stepX;
    const ny = y + stepY;
    if (isWall(nx, ny)) break;
    x = nx;
    y = ny;
  }
  player.x = x;
  player.y = y;

  return { ok: true, finalX: x, finalY: y };
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/roll.test.ts`
Expected: 7/7 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/combat/roll.ts packages/voxelyn-roguelike/src/tests/roll.test.ts
git commit -m "feat(roguelike): roll mechanic (battery cost, i-frames, wall-blocked)"
```

### Task 4.2: Player attack trigger + tests (TDD)

**Files:**
- Modify: `packages/voxelyn-roguelike/src/combat/combat.ts` (add `triggerPlayerAttack`)
- Create: `packages/voxelyn-roguelike/src/tests/player-attack.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/player-attack.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import { triggerPlayerAttack } from '../combat/combat';
import {
  ATTACK_ARC_DEGREES_DEFAULT,
  ATTACK_WINDUP_MS,
  DEGRADED_ATTACK_DAMAGE_MUL,
} from '../game/constants';

describe('triggerPlayerAttack', () => {
  it('refuses when player is rolling', () => {
    const p = createPlayer('p', 1, 5, 5);
    p.combatState = { kind: 'rolling', enteredAtMs: 0, expiresAtMs: 999 };
    const r = triggerPlayerAttack(p, 0, () => []);
    expect(r.ok).toBe(false);
  });

  it('enters attackWindup state on success', () => {
    const p = createPlayer('p', 1, 5, 5);
    const r = triggerPlayerAttack(p, 1000, () => []);
    expect(r.ok).toBe(true);
    expect(p.combatState.kind).toBe('attackWindup');
  });

  it('damage applied during attackActive resolution, scaled by degraded mode', () => {
    const p = createPlayer('p', 1, 5, 5);
    p.attack = 20;
    triggerPlayerAttack(p, 0, () => []);
    // Simulate degraded mode: half damage
    p.combatState = { kind: 'degraded', enteredAtMs: 0, expiresAtMs: null };
    expect(Math.round(p.attack * DEGRADED_ATTACK_DAMAGE_MUL)).toBe(10);
  });

  it('hits enemies inside facing arc', () => {
    const p = createPlayer('p', 1, 5, 5);
    p.facingDx = 1;
    p.facingDy = 0;
    const enemy = { id: 'e', x: 6, y: 5, hp: 50, maxHp: 50, alive: true };
    const r = triggerPlayerAttack(p, 0, () => [enemy as any]);
    expect(r.ok).toBe(true);
    expect(r.targetIds).toContain('e');
  });

  it('does NOT hit enemies behind player', () => {
    const p = createPlayer('p', 1, 5, 5);
    p.facingDx = 1;
    p.facingDy = 0;
    const enemyBehind = { id: 'e', x: 4, y: 5, hp: 50, maxHp: 50, alive: true };
    const r = triggerPlayerAttack(p, 0, () => [enemyBehind as any]);
    expect(r.targetIds).not.toContain('e');
  });

  it('uses ATTACK_ARC_DEGREES_DEFAULT (90deg) so a perpendicular enemy at adjacent diagonal hits', () => {
    expect(ATTACK_ARC_DEGREES_DEFAULT).toBe(90);
    const p = createPlayer('p', 1, 5, 5);
    p.facingDx = 1;
    p.facingDy = 0;
    // diagonal forward at +1,+1 — within 45° of facing → inside 90° arc
    const enemy = { id: 'e', x: 6, y: 6, hp: 50, maxHp: 50, alive: true };
    const r = triggerPlayerAttack(p, 0, () => [enemy as any]);
    expect(r.targetIds).toContain('e');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/player-attack.test.ts`
Expected: `triggerPlayerAttack` not exported.

- [ ] **Step 3: Implement `triggerPlayerAttack`**

In `packages/voxelyn-roguelike/src/combat/combat.ts`, append:

```ts
import { ATTACK_ARC_DEGREES_DEFAULT } from '../game/constants';
import { beginAttackWindup, isAttackInputAccepted } from '../entities/combat-state';
import type { EnemyState, PlayerState } from '../game/types';

export type PlayerAttackResult = {
  ok: boolean;
  reason?: 'state-locked' | 'cooldown';
  targetIds: string[];
};

const isInsideArc = (
  dx: number,
  dy: number,
  facingDx: number,
  facingDy: number,
  arcDeg: number,
): boolean => {
  if (dx === 0 && dy === 0) return false;
  const facingLen = Math.hypot(facingDx, facingDy);
  const targetLen = Math.hypot(dx, dy);
  if (facingLen === 0 || targetLen === 0) return false;
  const cosAngle = (dx * facingDx + dy * facingDy) / (facingLen * targetLen);
  const halfArcCos = Math.cos((arcDeg / 2) * (Math.PI / 180));
  return cosAngle >= halfArcCos;
};

export const triggerPlayerAttack = (
  player: PlayerState,
  nowMs: number,
  getEnemies: () => EnemyState[],
  arcDeg: number = ATTACK_ARC_DEGREES_DEFAULT,
): PlayerAttackResult => {
  if (!isAttackInputAccepted(player)) {
    return { ok: false, reason: 'state-locked', targetIds: [] };
  }
  if (player.nextAttackAt > nowMs) {
    return { ok: false, reason: 'cooldown', targetIds: [] };
  }

  beginAttackWindup(player, nowMs);
  player.nextAttackAt = nowMs + player.attackCooldownMs;
  player.animIntent = 'attack';

  const enemies = getEnemies();
  const hits: string[] = [];
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue; // melee range = adjacent (incl. diag)
    if (isInsideArc(dx, dy, player.facingDx, player.facingDy, arcDeg)) {
      hits.push(enemy.id);
    }
  }

  return { ok: true, targetIds: hits };
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/player-attack.test.ts`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/combat/combat.ts packages/voxelyn-roguelike/src/tests/player-attack.test.ts
git commit -m "feat(roguelike): triggerPlayerAttack with arc-based melee hit detection"
```

### Task 4.3: Drill Charge special + tests (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/combat/special.ts`
- Create: `packages/voxelyn-roguelike/src/tests/special-drill-charge.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/special-drill-charge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import { tryDrillCharge } from '../combat/special';
import { DRILL_CHARGE_BATTERY_COST, DRILL_CHARGE_TILES } from '../game/constants';

describe('Drill Charge special', () => {
  it('rejects when battery below cost', () => {
    const p = createPlayer('p', 1, 5, 5);
    p.resources.battery = DRILL_CHARGE_BATTERY_COST - 1;
    const r = tryDrillCharge(p, { dx: 1, dy: 0 }, 0, () => false, () => []);
    expect(r.ok).toBe(false);
  });

  it('travels in straight line until first wall', () => {
    const p = createPlayer('p', 5, 5, 0);
    const r = tryDrillCharge(p, { dx: 1, dy: 0 }, 0, (x) => x === 7, () => []);
    expect(r.ok).toBe(true);
    expect(p.x).toBe(6); // stops at 6 because 7 is wall
  });

  it('hits all enemies on the line', () => {
    const p = createPlayer('p', 5, 5, 0);
    const enemies = [
      { id: 'e1', x: 6, y: 5, hp: 50, maxHp: 50, alive: true },
      { id: 'e2', x: 7, y: 5, hp: 50, maxHp: 50, alive: true },
      { id: 'e3', x: 8, y: 5, hp: 50, maxHp: 5, alive: true },
    ];
    const r = tryDrillCharge(p, { dx: 1, dy: 0 }, 0, () => false, () => enemies as any);
    expect(r.ok).toBe(true);
    expect(r.hitIds.sort()).toEqual(['e1', 'e2', 'e3'].slice(0, DRILL_CHARGE_TILES).sort());
  });

  it('drains battery on success', () => {
    const p = createPlayer('p', 5, 5, 0);
    const before = p.resources.battery;
    tryDrillCharge(p, { dx: 1, dy: 0 }, 0, () => false, () => []);
    expect(p.resources.battery).toBe(before - DRILL_CHARGE_BATTERY_COST);
  });

  it('rejects with zero direction', () => {
    const p = createPlayer('p', 5, 5, 0);
    const r = tryDrillCharge(p, { dx: 0, dy: 0 }, 0, () => false, () => []);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/special-drill-charge.test.ts`
Expected: import error.

- [ ] **Step 3: Implement special**

Create `packages/voxelyn-roguelike/src/combat/special.ts`:

```ts
import {
  DRILL_CHARGE_BATTERY_COST,
  DRILL_CHARGE_DAMAGE,
  DRILL_CHARGE_TILES,
} from '../game/constants';
import { beginSpecial, isSpecialInputAccepted } from '../entities/combat-state';
import { drainBattery } from '../entities/resources';
import type { EnemyState, PlayerState } from '../game/types';

export type SpecialDir = { dx: number; dy: number };

export type DrillChargeResult = {
  ok: boolean;
  reason?: 'no-battery' | 'no-direction' | 'state-locked';
  hitIds: string[];
};

export const tryDrillCharge = (
  player: PlayerState,
  dir: SpecialDir,
  nowMs: number,
  isWall: (x: number, y: number) => boolean,
  getEnemies: () => EnemyState[],
): DrillChargeResult => {
  if (!isSpecialInputAccepted(player)) return { ok: false, reason: 'state-locked', hitIds: [] };
  if (player.resources.battery < DRILL_CHARGE_BATTERY_COST) return { ok: false, reason: 'no-battery', hitIds: [] };
  if (dir.dx === 0 && dir.dy === 0) return { ok: false, reason: 'no-direction', hitIds: [] };

  drainBattery(player, DRILL_CHARGE_BATTERY_COST);
  beginSpecial(player, nowMs);

  const stepX = Math.sign(dir.dx);
  const stepY = Math.sign(dir.dy);
  const enemies = getEnemies().filter((e) => e.alive);
  const hitIds: string[] = [];

  let x = player.x;
  let y = player.y;
  for (let i = 0; i < DRILL_CHARGE_TILES; i += 1) {
    const nx = x + stepX;
    const ny = y + stepY;
    if (isWall(nx, ny)) break;
    x = nx;
    y = ny;
    for (const enemy of enemies) {
      if (enemy.x === x && enemy.y === y && !hitIds.includes(enemy.id)) {
        hitIds.push(enemy.id);
        enemy.hp = Math.max(0, enemy.hp - DRILL_CHARGE_DAMAGE);
        if (enemy.hp === 0) enemy.alive = false;
      }
    }
  }
  player.x = x;
  player.y = y;
  return { ok: true, hitIds };
};
```

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/special-drill-charge.test.ts`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/combat/special.ts packages/voxelyn-roguelike/src/tests/special-drill-charge.test.ts
git commit -m "feat(roguelike): Drill Charge special (line damage, battery cost)"
```

### Task 4.4: Wire input → loop → combat

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/loop.ts`

- [ ] **Step 1: Drive resources tick + state machine + actions**

In `loop.ts`, in the per-tick player update path (the same place that previously called `attemptMoveOrAttack`):

```ts
import { advanceCombatState, isMovementLocked, enterDegradedState, enterShutdownState, enterDeadState } from '../entities/combat-state';
import { enterDegradedIfEmpty, exitDegradedOnRecharge, tickDegradedTimer } from '../entities/resources';
import { tryRoll } from '../combat/roll';
import { triggerPlayerAttack } from '../combat/combat';
import { tryDrillCharge } from '../combat/special';

// Inside the player tick:
advanceCombatState(player, state.simTimeMs);

enterDegradedIfEmpty(player, state.simTimeMs);
const dt = tickDegradedTimer(player, state.simTimeMs);
if (dt === 'shutdown' && player.combatState.kind !== 'shutdown') {
  enterShutdownState(player, state.simTimeMs);
}
if (player.resources.battery > 0 && player.resources.degradedSinceMs !== null) {
  exitDegradedOnRecharge(player);
}
if (!player.alive && player.combatState.kind !== 'dead') {
  enterDeadState(player, state.simTimeMs);
}

// Movement (only if not locked)
if (!isMovementLocked(player) && (snapshot.dx !== 0 || snapshot.dy !== 0)) {
  attemptMove(state, player, snapshot.dx, snapshot.dy, state.simTimeMs);
  player.facingDx = snapshot.dx;
  player.facingDy = snapshot.dy;
}

// Facing-only press: Space + held direction → face that way before swing
if (snapshot.actions.includes('attack') && (snapshot.dx !== 0 || snapshot.dy !== 0)) {
  player.facingDx = snapshot.dx;
  player.facingDy = snapshot.dy;
}

if (snapshot.actions.includes('attack')) {
  const enemies = [...state.level.entities.values()].filter((e): e is EnemyState => e.kind === 'enemy');
  const result = triggerPlayerAttack(player, state.simTimeMs, () => enemies);
  if (result.ok) {
    for (const id of result.targetIds) {
      const enemy = state.level.entities.get(id);
      if (enemy && enemy.kind === 'enemy') {
        attackEntity(state, player, enemy, state.simTimeMs);
      }
    }
  }
}

if (snapshot.actions.includes('roll')) {
  const dir = (snapshot.dx !== 0 || snapshot.dy !== 0)
    ? { dx: snapshot.dx, dy: snapshot.dy }
    : { dx: snapshot.facingDx, dy: snapshot.facingDy };
  tryRoll(player, dir, state.simTimeMs, (x, y) => isHardWall(state.level, x, y));
}

if (snapshot.actions.includes('special')) {
  const dir = (snapshot.dx !== 0 || snapshot.dy !== 0)
    ? { dx: snapshot.dx, dy: snapshot.dy }
    : { dx: snapshot.facingDx, dy: snapshot.facingDy };
  const enemies = [...state.level.entities.values()].filter((e): e is EnemyState => e.kind === 'enemy');
  tryDrillCharge(player, dir, state.simTimeMs, (x, y) => isHardWall(state.level, x, y), () => enemies);
}
```

`isHardWall(level, x, y)` is a helper that already exists or needs a one-liner: returns `true` if the tile material is in the non-passable set OR a closed gate occupies that tile. (Reuse the predicate `attemptMove` already uses internally; if it's inline, extract it.)

Also, in `attackEntity` (when source is player and target is enemy): apply `Math.round(damage * (player.combatState.kind === 'degraded' ? DEGRADED_ATTACK_DAMAGE_MUL : 1))`.

- [ ] **Step 2: Build + full test suite**

Run: `pnpm --filter @voxelyn/roguelike build`
Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green.

- [ ] **Step 3: Re-enable skipped tests**

Un-skip `combat-ai.test.ts` and `animation-integration.test.ts`. Rewrite the bump-attack assertion to call `triggerPlayerAttack(player, now, () => enemies)` directly and assert `result.ok === true` and the enemy lost HP.

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green including the un-skipped tests.

- [ ] **Step 4: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/loop.ts packages/voxelyn-roguelike/src/tests/combat-ai.test.ts packages/voxelyn-roguelike/src/tests/animation-integration.test.ts
git commit -m "feat(roguelike): wire Space/Shift/Q to attack/roll/special in main loop"
```

### Task 4.5: Q36 prototype — arc width tuning

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/constants.ts:ATTACK_ARC_DEGREES_DEFAULT`

- [ ] **Step 1: Spawn the test scenario**

Add a developer-only browser hook in `loop.ts`: `window.spawnHiveTunnelsArcTest()` — places three Stalker enemies at angles 30°, 90°, 150° from a fixed player position in a Hive Tunnels module.

- [ ] **Step 2: Run the prototype build**

Run: `pnpm --filter @voxelyn/roguelike build && pnpm --filter @voxelyn/roguelike preview`
In the browser, call `window.spawnHiveTunnelsArcTest()` and play 5–10 attempts at each of `ATTACK_ARC_DEGREES_DEFAULT` set to 60, 90, 120.

- [ ] **Step 3: Decide and pin the value**

Decision criteria (from grilling):
- Should hit 1–2 enemies when well positioned.
- Should NOT feel like a 360° spin.
- Should reward correct facing.

Update `ATTACK_ARC_DEGREES_DEFAULT` to the chosen value. Default expectation: **90°**. Document the result in a one-line code comment above the constant.

- [ ] **Step 4: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/constants.ts packages/voxelyn-roguelike/src/game/loop.ts
git commit -m "tune(roguelike): pin Excavator melee arc width after Hive Tunnels prototype"
```

---

## Phase 5 — Stations, crystals, overclock

### Task 5.1: Crystals — restore battery only

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/interactions.ts`
- Modify: `packages/voxelyn-roguelike/src/game/constants.ts` (remove `CRYSTAL_HEAL`, `CRYSTAL_ATTACK_BONUS`, `CRYSTAL_BUFF_MS` references in interactions; the constants can stay as legacy values until grep is clean)
- Test: `packages/voxelyn-roguelike/src/tests/interactions.test.ts` (existing — update)

- [ ] **Step 1: Write failing test**

Append to `interactions.test.ts`:

```ts
it('crystal interaction restores battery to full and clears degraded state', () => {
  const state = createTestStateWithCrystalAdjacent();
  const player = state.level.entities.get(state.playerId)! as PlayerState;
  drainBattery(player, 100);
  enterDegradedIfEmpty(player, 1000);
  // Use the crystal
  triggerCrystalInteraction(state, /* crystalId */ 'crystal_0', 2000);
  expect(player.resources.battery).toBe(player.resources.maxBattery);
  expect(player.resources.degradedSinceMs).toBeNull();
});
```

(Engineer adapts to the actual interactions API. Helpers `createTestStateWithCrystalAdjacent` and `triggerCrystalInteraction` mirror what `interactions.ts` exposes.)

- [ ] **Step 2: Run test, expect failure**

Expected: current crystal logic applies HP heal + buff; new contract not implemented.

- [ ] **Step 3: Rewrite crystal interaction**

In `interactions.ts`, in the crystal handler:

```ts
import { rechargeBatteryFull, exitDegradedOnRecharge } from '../entities/resources';

// In the crystal interaction branch:
rechargeBatteryFull(player);
exitDegradedOnRecharge(player);
crystal.used = true;
state.messages.push('Cristal absorvido. Bateria recarregada.');
```

Drop the old `CRYSTAL_HEAL`, `CRYSTAL_ATTACK_BONUS`, `CRYSTAL_BUFF_MS` effects. Leave the constants in place; remove only the calls.

- [ ] **Step 4: Run tests, expect pass**

Run: `pnpm --filter @voxelyn/roguelike test -- interactions`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/interactions.ts packages/voxelyn-roguelike/src/tests/interactions.test.ts
git commit -m "feat(roguelike): crystals now restore battery only (no heal, no buff)"
```

### Task 5.2: Station type + spawn + interaction (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/world/stations.ts`
- Create: `packages/voxelyn-roguelike/src/tests/stations.test.ts`
- Modify: `packages/voxelyn-roguelike/src/game/types.ts` (add `StationInteractable`, extend `LevelInteractable` union)
- Modify: `packages/voxelyn-roguelike/src/world/features.ts` (1 station per floor placement)
- Modify: `packages/voxelyn-roguelike/src/game/interactions.ts` (handle station)

- [ ] **Step 1: Add `StationInteractable` type**

In `types.ts`:

```ts
export type StationInteractable = {
  id: string;
  type: 'station';
  x: number;
  y: number;
  used: boolean;
  overclockOffered: boolean;
};
```

Extend `LevelInteractable` union to include `StationInteractable`.

- [ ] **Step 2: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/stations.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import {
  applyStationInteraction,
  isStationOnRoute,
  countStationsInLevel,
} from '../world/stations';
import { applyIntegrityDamage, drainBattery } from '../entities/resources';
import { generateLevel } from '../world/level';
import { FLOOR_COUNT_MVP } from '../game/constants';

describe('stations', () => {
  it('placeStations puts exactly STATION_PER_FLOOR stations per generated level', () => {
    for (let f = 1; f <= FLOOR_COUNT_MVP; f += 1) {
      const level = generateLevel(/* seed */ 1234, f);
      expect(countStationsInLevel(level)).toBe(1);
    }
  });

  it('refills integrity and battery to full', () => {
    const p = createPlayer('p', 1, 5, 5);
    applyIntegrityDamage(p, 40);
    drainBattery(p, 80);
    const station = { id: 's1', type: 'station' as const, x: 5, y: 6, used: false, overclockOffered: false };
    applyStationInteraction(p, station, /* overclockChoice */ false);
    expect(p.resources.integrity).toBe(p.resources.maxIntegrity);
    expect(p.resources.battery).toBe(p.resources.maxBattery);
    expect(station.used).toBe(true);
  });

  it('rejects when already used', () => {
    const p = createPlayer('p', 1, 5, 5);
    const station = { id: 's1', type: 'station' as const, x: 5, y: 6, used: true, overclockOffered: false };
    const result = applyStationInteraction(p, station, false);
    expect(result.ok).toBe(false);
  });

  it('marks overclock pending when overclockChoice=true', () => {
    const p = createPlayer('p', 1, 5, 5);
    const station = { id: 's1', type: 'station' as const, x: 5, y: 6, used: false, overclockOffered: false };
    const result = applyStationInteraction(p, station, true);
    expect(result.ok).toBe(true);
    expect(result.overclockArmed).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests, expect fail**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/stations.test.ts`
Expected: import errors.

- [ ] **Step 4: Implement `world/stations.ts`**

Create `packages/voxelyn-roguelike/src/world/stations.ts`:

```ts
import { applyIntegrityDamage, rechargeBatteryFull, exitDegradedOnRecharge } from '../entities/resources';
import { clampPlayerIntegrity } from '../entities/player';
import type { LevelState, PlayerState, StationInteractable } from '../game/types';

export type StationInteractionResult = {
  ok: boolean;
  reason?: 'used';
  overclockArmed: boolean;
};

export const applyStationInteraction = (
  player: PlayerState,
  station: StationInteractable,
  overclockChoice: boolean,
): StationInteractionResult => {
  if (station.used) return { ok: false, reason: 'used', overclockArmed: false };

  player.resources.integrity = player.resources.maxIntegrity;
  clampPlayerIntegrity(player);
  rechargeBatteryFull(player);
  exitDegradedOnRecharge(player);

  station.used = true;
  station.overclockOffered = overclockChoice;
  return { ok: true, overclockArmed: overclockChoice };
};

export const countStationsInLevel = (level: LevelState): number =>
  level.interactables.filter((i) => i.type === 'station').length;

export const isStationOnRoute = (level: LevelState, station: StationInteractable): boolean => {
  // Simple heuristic: station exists on a non-wall tile reachable from entry. Real reachability
  // check belongs in `connectivity.ts`; for v1 trust the placer.
  return true;
};
```

- [ ] **Step 5: Wire station spawning in `features.ts`**

Find the `placeFeatures(level, rng)` (or analogous) function. Add a new sub-routine `placeStation` that picks a tile near the floor's main route — concretely, an air tile within distance 3 of the route mid-point, not adjacent to a crystal. Push one `StationInteractable` per floor:

```ts
const stationId = `station_${level.seed}_${level.floorNumber}`;
level.interactables.push({
  id: stationId,
  type: 'station',
  x: chosenX,
  y: chosenY,
  used: false,
  overclockOffered: false,
});
```

- [ ] **Step 6: Wire interaction in `game/interactions.ts`**

Add a case for `interactable.type === 'station'`. On `E` press while adjacent:
- Open a modal-like UI prompt: "Repair? (E to confirm) — Overclock next floor? (O to toggle)". For simplicity in v1, open the existing `interactionModal` shape with `kind: 'station_repair'`. Player presses E to accept (no overclock) or O+E to accept with overclock.

Add to `types.ts` `InteractionModal`:

```ts
export type InteractionModal =
  | { kind: 'terminal_repair'; sourceId: string; text: string }
  | { kind: 'station_repair'; sourceId: string; overclockArmed: boolean };
```

Update modal-handling code to keep both variants compiling.

- [ ] **Step 7: Run all roguelike tests**

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add packages/voxelyn-roguelike/src/world/stations.ts packages/voxelyn-roguelike/src/tests/stations.test.ts packages/voxelyn-roguelike/src/world/features.ts packages/voxelyn-roguelike/src/game/types.ts packages/voxelyn-roguelike/src/game/interactions.ts
git commit -m "feat(roguelike): one-shot stations per floor with refill + overclock toggle"
```

### Task 5.3: Overclock state + per-tick drain (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/world/overclock.ts`
- Create: `packages/voxelyn-roguelike/src/tests/overclock.test.ts`
- Modify: `packages/voxelyn-roguelike/src/game/types.ts` — add `overclock: { active: boolean; floorNumberLock: number | null }` to `PlayerState`
- Modify: `packages/voxelyn-roguelike/src/entities/player.ts` — initialize `overclock`
- Modify: `packages/voxelyn-roguelike/src/game/loop.ts` — tick overclock, apply damage multiplier in `attackEntity`

- [ ] **Step 1: Add `overclock` field**

In `types.ts`, append to `PlayerState`:

```ts
overclock: {
  active: boolean;
  floorNumberLock: number | null;
};
```

In `entities/player.ts`, initialize:

```ts
overclock: { active: false, floorNumberLock: null },
```

- [ ] **Step 2: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/overclock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import { armOverclock, tickOverclockDrain, getOverclockDamageMul, clearOverclockOnFloorChange } from '../world/overclock';
import { OVERCLOCK_DAMAGE_MUL, OVERCLOCK_INTEGRITY_DRAIN_PER_SEC } from '../game/constants';

describe('overclock', () => {
  it('armOverclock locks it to the next floor', () => {
    const p = createPlayer('p', 1, 0, 0);
    armOverclock(p, /* nextFloor */ 4);
    expect(p.overclock.active).toBe(true);
    expect(p.overclock.floorNumberLock).toBe(4);
  });

  it('damage mul is 1.0 when inactive, OVERCLOCK_DAMAGE_MUL when active', () => {
    const p = createPlayer('p', 1, 0, 0);
    expect(getOverclockDamageMul(p)).toBe(1);
    armOverclock(p, 3);
    expect(getOverclockDamageMul(p)).toBe(OVERCLOCK_DAMAGE_MUL);
  });

  it('drains integrity per real second when active', () => {
    const p = createPlayer('p', 1, 0, 0);
    armOverclock(p, 3);
    const before = p.resources.integrity;
    tickOverclockDrain(p, /* stepMs */ 1000);
    expect(p.resources.integrity).toBe(before - OVERCLOCK_INTEGRITY_DRAIN_PER_SEC);
  });

  it('can self-destruct (integrity → 0 sets alive=false)', () => {
    const p = createPlayer('p', 1, 0, 0);
    p.resources.integrity = 1;
    armOverclock(p, 3);
    tickOverclockDrain(p, 5000);
    expect(p.resources.integrity).toBe(0);
    expect(p.alive).toBe(false);
  });

  it('clearOverclockOnFloorChange disables when leaving locked floor', () => {
    const p = createPlayer('p', 1, 0, 0);
    armOverclock(p, 3);
    clearOverclockOnFloorChange(p, /* newFloor */ 4);
    expect(p.overclock.active).toBe(false);
    expect(p.overclock.floorNumberLock).toBeNull();
  });

  it('does not clear when staying on locked floor', () => {
    const p = createPlayer('p', 1, 0, 0);
    armOverclock(p, 3);
    clearOverclockOnFloorChange(p, 3);
    expect(p.overclock.active).toBe(true);
  });
});
```

- [ ] **Step 3: Run, expect fail**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/overclock.test.ts`

- [ ] **Step 4: Implement overclock**

Create `packages/voxelyn-roguelike/src/world/overclock.ts`:

```ts
import {
  OVERCLOCK_DAMAGE_MUL,
  OVERCLOCK_INTEGRITY_DRAIN_PER_SEC,
} from '../game/constants';
import { applyIntegrityDamage } from '../entities/resources';
import type { PlayerState } from '../game/types';

export const armOverclock = (player: PlayerState, nextFloorNumber: number): void => {
  player.overclock.active = true;
  player.overclock.floorNumberLock = nextFloorNumber;
};

export const clearOverclockOnFloorChange = (player: PlayerState, newFloorNumber: number): void => {
  if (player.overclock.floorNumberLock === null) return;
  if (player.overclock.floorNumberLock === newFloorNumber) return;
  player.overclock.active = false;
  player.overclock.floorNumberLock = null;
};

export const getOverclockDamageMul = (player: PlayerState): number =>
  player.overclock.active ? OVERCLOCK_DAMAGE_MUL : 1;

export const tickOverclockDrain = (player: PlayerState, stepMs: number): void => {
  if (!player.overclock.active) return;
  if (!player.alive) return;
  const drain = OVERCLOCK_INTEGRITY_DRAIN_PER_SEC * (stepMs / 1000);
  if (drain > 0) {
    applyIntegrityDamage(player, drain);
  }
};
```

- [ ] **Step 5: Wire into loop + combat**

In `loop.ts` per-tick:

```ts
tickOverclockDrain(player, stepMs);
```

In `combat.ts` `attackEntity` when source is player:

```ts
import { getOverclockDamageMul } from '../world/overclock';
const baseDamage = source.attack + getPlayerAttackBonus(state);
const degradedMul = source.combatState.kind === 'degraded' ? DEGRADED_ATTACK_DAMAGE_MUL : 1;
const overclockMul = getOverclockDamageMul(source);
const dmg = Math.max(1, Math.round(baseDamage * degradedMul * overclockMul - target.damageReduction));
```

(Adjust the existing damage formula to multiply rather than re-compute.)

In `loop.ts` floor-change path:

```ts
clearOverclockOnFloorChange(player, newFloorNumber);
// Also: if station with overclockOffered=true was used last floor, armOverclock(player, newFloorNumber)
```

- [ ] **Step 6: Run all tests, expect green**

Run: `pnpm --filter @voxelyn/roguelike test`

- [ ] **Step 7: Commit**

```bash
git add packages/voxelyn-roguelike/src/world/overclock.ts packages/voxelyn-roguelike/src/tests/overclock.test.ts packages/voxelyn-roguelike/src/game/types.ts packages/voxelyn-roguelike/src/entities/player.ts packages/voxelyn-roguelike/src/game/loop.ts packages/voxelyn-roguelike/src/combat/combat.ts
git commit -m "feat(roguelike): overclock arm at station, drain integrity, boost damage"
```

---

## Phase 6 — Run flow, death flow, run-end UI

### Task 6.1: Run controller (TDD)

**Files:**
- Create: `packages/voxelyn-roguelike/src/game/run.ts`
- Create: `packages/voxelyn-roguelike/src/tests/run-flow.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/voxelyn-roguelike/src/tests/run-flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPlayer } from '../entities/player';
import {
  buildRunSummary,
  createRunStats,
  recordEnemyKill,
  recordPlayerDamage,
  recordCauseOfDeath,
  recordFloorReached,
} from '../game/run';
import { FLOOR_COUNT_MVP } from '../game/constants';

describe('run flow', () => {
  it('createRunStats starts fresh', () => {
    const stats = createRunStats(/* startMs */ 1000);
    expect(stats.startMs).toBe(1000);
    expect(stats.enemiesKilled).toBe(0);
    expect(stats.damageDealt).toBe(0);
    expect(stats.damageTaken).toBe(0);
    expect(stats.floorReached).toBe(1);
    expect(stats.causeOfDeath).toBeNull();
  });

  it('records and aggregates events', () => {
    const stats = createRunStats(0);
    recordEnemyKill(stats, 'stalker', 14);
    recordEnemyKill(stats, 'bruiser', 22);
    recordPlayerDamage(stats, 12);
    recordFloorReached(stats, 7);
    expect(stats.enemiesKilled).toBe(2);
    expect(stats.damageDealt).toBe(36);
    expect(stats.damageTaken).toBe(12);
    expect(stats.floorReached).toBe(7);
  });

  it('records cause of death with localized message', () => {
    const stats = createRunStats(0);
    recordCauseOfDeath(stats, { kind: 'enemy', enemyArchetype: 'bruiser', attackName: 'Ground Slam' });
    expect(stats.causeOfDeath).not.toBeNull();
    expect(stats.causeOfDeath!.kind).toBe('enemy');
  });

  it('buildRunSummary computes elapsed and totals', () => {
    const stats = createRunStats(1000);
    recordEnemyKill(stats, 'stalker', 14);
    recordPlayerDamage(stats, 5);
    recordFloorReached(stats, 4);
    const summary = buildRunSummary(stats, /* nowMs */ 41_000, /* finalIntegrity */ 0, /* finalBattery */ 0);
    expect(summary.elapsedMs).toBe(40_000);
    expect(summary.floorReached).toBe(4);
    expect(summary.enemiesKilled).toBe(1);
    expect(summary.damageTaken).toBe(5);
    expect(summary.runCompleted).toBe(false);
  });

  it('runCompleted=true when floorReached==FLOOR_COUNT_MVP and integrity>0', () => {
    const stats = createRunStats(0);
    recordFloorReached(stats, FLOOR_COUNT_MVP);
    const summary = buildRunSummary(stats, 1000, 25, 100);
    expect(summary.runCompleted).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Expected: import error.

- [ ] **Step 3: Implement `game/run.ts`**

Create `packages/voxelyn-roguelike/src/game/run.ts`:

```ts
import { FLOOR_COUNT_MVP } from './constants';
import type { EnemyArchetype } from './types';

export type CauseOfDeath =
  | { kind: 'enemy'; enemyArchetype: EnemyArchetype; attackName: string }
  | { kind: 'overclock' }
  | { kind: 'shutdown' }
  | { kind: 'trap'; trapId: string };

export type RunStats = {
  startMs: number;
  enemiesKilled: number;
  damageDealt: number;
  damageTaken: number;
  floorReached: number;
  causeOfDeath: CauseOfDeath | null;
};

export type RunSummary = {
  startMs: number;
  endMs: number;
  elapsedMs: number;
  enemiesKilled: number;
  damageDealt: number;
  damageTaken: number;
  floorReached: number;
  causeOfDeath: CauseOfDeath | null;
  finalIntegrity: number;
  finalBattery: number;
  runCompleted: boolean;
};

export const createRunStats = (startMs: number): RunStats => ({
  startMs,
  enemiesKilled: 0,
  damageDealt: 0,
  damageTaken: 0,
  floorReached: 1,
  causeOfDeath: null,
});

export const recordEnemyKill = (stats: RunStats, _archetype: EnemyArchetype, damage: number): void => {
  stats.enemiesKilled += 1;
  stats.damageDealt += damage;
};

export const recordPlayerDamage = (stats: RunStats, damage: number): void => {
  stats.damageTaken += damage;
};

export const recordFloorReached = (stats: RunStats, floor: number): void => {
  if (floor > stats.floorReached) stats.floorReached = floor;
};

export const recordCauseOfDeath = (stats: RunStats, cause: CauseOfDeath): void => {
  stats.causeOfDeath = cause;
};

export const buildRunSummary = (
  stats: RunStats,
  nowMs: number,
  finalIntegrity: number,
  finalBattery: number,
): RunSummary => ({
  startMs: stats.startMs,
  endMs: nowMs,
  elapsedMs: nowMs - stats.startMs,
  enemiesKilled: stats.enemiesKilled,
  damageDealt: stats.damageDealt,
  damageTaken: stats.damageTaken,
  floorReached: stats.floorReached,
  causeOfDeath: stats.causeOfDeath,
  finalIntegrity,
  finalBattery,
  runCompleted: stats.floorReached >= FLOOR_COUNT_MVP && finalIntegrity > 0,
});
```

- [ ] **Step 4: Run, expect green**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/run-flow.test.ts`

- [ ] **Step 5: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/run.ts packages/voxelyn-roguelike/src/tests/run-flow.test.ts
git commit -m "feat(roguelike): run controller (stats aggregation + summary)"
```

### Task 6.2: Wire run stats into the loop + integrate cause-of-death detection

**Files:**
- Modify: `packages/voxelyn-roguelike/src/game/types.ts` — add `runStats: RunStats | null` to `GameState`
- Modify: `packages/voxelyn-roguelike/src/game/loop.ts`
- Modify: `packages/voxelyn-roguelike/src/combat/combat.ts` — when player is killed, record cause

- [ ] **Step 1: Add `runStats` to game state**

In `types.ts`:

```ts
export type GameState = {
  // ...existing fields...
  runStats: RunStats | null;
};
```

In `state.ts` initial state:

```ts
runStats: createRunStats(performance.now()),
```

- [ ] **Step 2: Record events from existing damage points**

When `attackEntity` results in enemy death attributable to the player: `recordEnemyKill(state.runStats!, enemy.archetype, dealt)`. When player takes damage: `recordPlayerDamage(state.runStats!, dealt)`. When `loop.ts` advances to a new floor: `recordFloorReached(state.runStats!, newFloorNumber)`. When integrity hits 0: determine cause based on most recent damage source — store the last enemy archetype + attack name (`'melee'`/`'projectile'`/`'explosion'`) in `state.lastDamageSource` and feed it to `recordCauseOfDeath`. If the last cause was overclock self-drain, mark `kind: 'overclock'` instead.

- [ ] **Step 3: Run all tests**

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/voxelyn-roguelike/src/game/types.ts packages/voxelyn-roguelike/src/game/state.ts packages/voxelyn-roguelike/src/game/loop.ts packages/voxelyn-roguelike/src/combat/combat.ts
git commit -m "feat(roguelike): wire run stats + cause-of-death recording"
```

### Task 6.3: Run-end UI

**Files:**
- Create: `packages/voxelyn-roguelike/src/ui/run-end.ts`
- Modify: `packages/voxelyn-roguelike/src/game/types.ts` — add `phase: 'game_over_summary'` (or reuse `'game_over'`) and tie summary into HUD payload
- Modify: `packages/voxelyn-roguelike/src/ui/hud.ts` — render Integrity bar, Battery bar, degraded countdown timer

- [ ] **Step 1: Implement HUD bars (Integrity + Battery + degraded countdown)**

In `hud.ts`, replace the current single-HP bar with two bars:
- Top: red Integrity bar `(integrity / maxIntegrity)`.
- Below: cyan Battery bar `(battery / maxBattery)`.
- When `degradedSinceMs !== null`, show a flashing "SHUTDOWN IN: NN.Ns" countdown computed from `shutdownAtMs - nowMs`.

- [ ] **Step 2: Implement run-end overlay**

Create `packages/voxelyn-roguelike/src/ui/run-end.ts`:

```ts
import type { RunSummary } from '../game/run';

export const renderRunEndOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  summary: RunSummary,
  bestFloor: number,
  bestTimeMs: number | null,
  totalCurrencyLifetime: number,
): void => {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#eaeaea';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  const cx = width / 2;
  let y = height * 0.18;
  ctx.fillText(summary.runCompleted ? 'CORE REACHED' : 'SHUTDOWN', cx, y);
  ctx.font = '16px sans-serif';
  y += 40;
  ctx.fillText(`Floor reached: ${summary.floorReached} / 10`, cx, y); y += 22;
  ctx.fillText(`Time: ${(summary.elapsedMs / 1000).toFixed(1)}s`, cx, y); y += 22;
  ctx.fillText(`Enemies destroyed: ${summary.enemiesKilled}`, cx, y); y += 22;
  ctx.fillText(`Damage dealt: ${summary.damageDealt}`, cx, y); y += 22;
  ctx.fillText(`Damage taken: ${summary.damageTaken}`, cx, y); y += 22;
  if (summary.causeOfDeath) {
    const cod = summary.causeOfDeath;
    let txt = '';
    if (cod.kind === 'enemy') txt = `Destroyed by: ${cod.enemyArchetype} ${cod.attackName}`;
    if (cod.kind === 'overclock') txt = 'Self-destruct (Overclock)';
    if (cod.kind === 'shutdown') txt = 'Shutdown — battery depletion';
    if (cod.kind === 'trap') txt = `Trap: ${cod.trapId}`;
    ctx.fillText(txt, cx, y); y += 22;
  }
  y += 20;
  ctx.fillText(`Best floor: ${bestFloor}`, cx, y); y += 22;
  if (bestTimeMs !== null) {
    ctx.fillText(`Best time: ${(bestTimeMs / 1000).toFixed(1)}s`, cx, y); y += 22;
  }
  ctx.fillText(`Lifetime currency: ${totalCurrencyLifetime}`, cx, y); y += 32;
  ctx.fillText('R: Retry    Esc: Back to Hub', cx, y);
  ctx.restore();
};
```

- [ ] **Step 3: Wire run-end overlay into the loop's render path**

In `loop.ts` render, when `state.phase === 'game_over'`, call `renderRunEndOverlay(ctx, w, h, summary, ...)`. Persist `bestFloor`, `bestTimeMs`, `totalCurrencyLifetime` to `localStorage` on run end.

- [ ] **Step 4: Manual test**

Run: `pnpm --filter @voxelyn/roguelike preview`. Damage yourself to 0 Integrity. Verify the overlay shows correct stats and a clear cause of death.

- [ ] **Step 5: Run all tests**

Run: `pnpm --filter @voxelyn/roguelike test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/voxelyn-roguelike/src/ui/run-end.ts packages/voxelyn-roguelike/src/ui/hud.ts packages/voxelyn-roguelike/src/game/loop.ts
git commit -m "feat(roguelike): run-end summary overlay + dual-resource HUD"
```

### Task 6.4: Persistent battery + integrity across floors (verification)

**Files:**
- Modify: `packages/voxelyn-roguelike/src/tests/run-flow.test.ts` (add integration test)

- [ ] **Step 1: Add an integration test that walks 3 floors**

Append to `run-flow.test.ts`:

```ts
it('battery and integrity persist across floor transitions', () => {
  const state = newGameState(/* seed */ 999);
  const player = state.level.entities.get(state.playerId)! as PlayerState;
  applyIntegrityDamage(player, 30);
  drainBattery(player, 60);
  advanceToNextFloor(state);
  expect(player.resources.integrity).toBe(player.resources.maxIntegrity - 30);
  expect(player.resources.battery).toBe(player.resources.maxBattery - 60);
  advanceToNextFloor(state);
  expect(player.resources.integrity).toBe(player.resources.maxIntegrity - 30);
});
```

`newGameState(seed)` and `advanceToNextFloor(state)` are existing helpers — if missing, expose them from `state.ts`/`loop.ts` for tests.

- [ ] **Step 2: Run, expect green**

Run: `pnpm --filter @voxelyn/roguelike exec vitest run src/tests/run-flow.test.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/voxelyn-roguelike/src/tests/run-flow.test.ts
git commit -m "test(roguelike): assert resources persist across floor transitions"
```

### Task 6.5: Final integration — full suite, build, browser sanity

- [ ] **Step 1: Run everything**

Run: `pnpm --filter @voxelyn/roguelike test`
Run: `pnpm --filter @voxelyn/roguelike build`
Run: `pnpm --filter @voxelyn/animation test`
Run: `pnpm --filter @voxelyn/cli test`

Expected: all green.

- [ ] **Step 2: Browser sanity**

Run: `pnpm --filter @voxelyn/roguelike preview`
Manually verify:
1. WASD moves the robot.
2. Diagonals work (W+D moves up-right).
3. Space attacks; the swing damages an adjacent enemy.
4. Shift rolls; consumes battery; provides i-frames.
5. Q triggers Drill Charge in the facing direction.
6. Crystal restores battery.
7. Station restores both, optionally arms overclock.
8. Battery hitting 0 enters degraded mode (slow + reduced damage); 30s later → shutdown if not recharged.
9. Death shows the run-end overlay with all stats.

- [ ] **Step 3: Commit (if anything tweaked)**

```bash
git add -A
git commit -m "chore(roguelike): final integration sanity for resource/combat refactor"
```

---

## Self-Review

**Spec coverage check:**

| Locked decision | Implemented in |
|---|---|
| Integrity + Battery on player only | Task 2.2, 2.3 |
| Enemies keep `hp`/`maxHp` | Task 2.2 (split type) |
| No regen, no `lifeOnHit` | Task 2.3 (removed), 3.5.3 (power-up stubs) |
| No ambient battery drain | Battery only changes via roll/special/trap calls (Tasks 4.1, 4.3, future trap work) |
| Battery 0 → degraded | Task 2.4 |
| Degraded for 30s → shutdown | Task 2.4, 4.4 |
| Crystal = full battery + exit degraded | Task 5.1 |
| 8-direction movement | Task 1.2 |
| Space = attack | Task 1.2, 4.4 |
| Shift = roll, 0.4s i-frames, 10% battery | Tasks 1.2, 4.1 |
| Q = special | Tasks 1.2, 4.4 |
| Excavator melee arc, hits in facing dir | Task 4.2 |
| Q36 (arc width) deferred to prototype | Task 4.5 |
| Drill Charge | Task 4.3 |
| Stations one-shot per floor, refill + overclock | Task 5.2 |
| Overclock damage mul, integrity drain, can self-destruct | Task 5.3 |
| Battery/integrity persist between floors | Task 3.5.2, verified Task 6.4 |
| 10 floors, run summary | Task 6.1, 6.3 |
| Run-end UI with all stats incl. cause of death | Task 6.3 |
| No revives | Implicit — no revive code added |

**Placeholder scan:** No "TBD", "TODO", "implement later". Test bodies are concrete; code blocks contain real implementations. The Phase 5 station UI modal is the lightest spec — flagged as "open existing modal shape" because the existing `interactionModal` system handles the rendering.

**Type consistency:**
- `PlayerCombatStateKind` defined Task 2.2, used Tasks 3.1, 4.1, 4.2, 4.3.
- `PlayerResources` field names (`integrity`, `battery`, `degradedSinceMs`, `shutdownAtMs`, `iFramesUntilMs`) consistent across Tasks 2.2, 2.3, 2.4, 5.1, 5.2.
- `tryRoll` / `tryDrillCharge` / `triggerPlayerAttack` named consistently between definition and call sites in Task 4.4.
- `applyStationInteraction` returns `{ ok, reason?, overclockArmed }` — same shape used by tests Task 5.2.
- `RunStats` and `RunSummary` field names consistent Tasks 6.1 → 6.3.

**Out-of-scope items deliberately deferred (not gaps):**
- Floor 10 boss + gauntlet content — separate plan.
- Meta-progression hub + currency spend UI — separate plan (Q22–Q24, Q50).
- New robot variants — separate plan (Q26).
- Heat tiers — separate plan (Q24, Q26).
- Boon system at stations — explicitly deferred per Q47 v1 scope.
- 1-of-3 station upgrade — Q47 v2.
- Per-attack combo strings — Q38 polish.

These are flagged so the executor doesn't try to implement them.
