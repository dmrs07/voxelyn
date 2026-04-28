import {
  tryPlayerBumpAction,
  updateParticles,
  updateProjectiles,
} from '../combat/combat';
import { updateEnemiesAI } from '../entities/ai';
import { applyPlayerRegen } from '../entities/player';
import { Controls } from '../input/controls';
import { attemptInteractionAt, cancelInteractionModal, confirmInteractionModal } from './interactions';
import { resolvePowerUpChoice, startNextPowerUpChoiceIfNeeded } from '../powerups/system';
import { IsoRenderer } from '../render/iso-renderer';
import { updateCorridorEvents } from '../world/corridor-events';
import { updateDynamicCorridors } from '../world/dynamic-corridors';
import { applyPlayerFeatureInteractions } from '../world/features';
import { inBounds2D } from '../world/level';
import {
  FEATURE_BIOFLUID,
  FEATURE_PROP_BEACON,
  FEATURE_PROP_CRATE,
  FEATURE_PROP_DEBRIS,
  FEATURE_PROP_FUNGAL_CLUSTER,
  FEATURE_CRYSTAL,
  FEATURE_SPORE_VENT,
  SIMULATION_STEP_MS,
} from './constants';
import { enemyDisplayName, getFloorTheme } from './lore';
import {
  advanceToNextFloor,
  getPlayer,
  handleEnemyKills,
  shouldAdvanceFloor,
  shouldTriggerVictory,
  createGameState,
} from './state';
import type { GameState } from './types';

export class GameLoop {
  private readonly controls = new Controls();
  private readonly renderer: IsoRenderer;
  private state: GameState;
  private running = false;
  private frameHandle = 0;
  private accumulator = 0;
  private lastTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement, baseSeed: number) {
    this.state = createGameState(baseSeed);
    this.renderer = new IsoRenderer(canvas);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.controls.attach();
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.controls.detach();
    cancelAnimationFrame(this.frameHandle);
  }

  advanceTime(ms: number): void {
    const steps = Math.max(1, Math.round(ms / SIMULATION_STEP_MS));
    for (let i = 0; i < steps; i += 1) {
      const input = this.controls.snapshot();
      this.simulateStep(input.dx, input.dy, input.pickChoice, input.interact, input.cancel);
    }
    this.renderer.render(this.state);
  }

  renderGameToText(): string {
    const player = getPlayer(this.state);
    const featureCounts = {
      biofluid: 0,
      fungal: 0,
      debris: 0,
      crate: 0,
      beacon: 0,
      crystal: 0,
      sporeVent: 0,
    };
    for (const flags of this.state.level.featureMap) {
      if ((flags & FEATURE_BIOFLUID) !== 0) featureCounts.biofluid += 1;
      if ((flags & FEATURE_PROP_FUNGAL_CLUSTER) !== 0) featureCounts.fungal += 1;
      if ((flags & FEATURE_PROP_DEBRIS) !== 0) featureCounts.debris += 1;
      if ((flags & FEATURE_PROP_CRATE) !== 0) featureCounts.crate += 1;
      if ((flags & FEATURE_PROP_BEACON) !== 0) featureCounts.beacon += 1;
      if ((flags & FEATURE_CRYSTAL) !== 0) featureCounts.crystal += 1;
      if ((flags & FEATURE_SPORE_VENT) !== 0) featureCounts.sporeVent += 1;
    }
    const enemies = Array.from(this.state.level.entities.values())
      .filter((entity) => entity.kind === 'enemy' && entity.alive)
      .slice(0, 8)
      .map((entity) => ({
        x: entity.x,
        y: entity.y,
        hp: entity.hp,
        archetype: entity.archetype,
        codexName: enemyDisplayName(entity.archetype),
      }));
    const floorTheme = getFloorTheme(this.state.floorNumber);

    return JSON.stringify({
      coordinateSystem: 'grid origin top-left; x projects down-right, y projects down-left',
      phase: this.state.phase,
      floorNumber: this.state.floorNumber,
      floorTheme: {
        id: floorTheme.id,
        name: floorTheme.name,
        threat: enemyDisplayName(floorTheme.threat),
      },
      simTick: this.state.simTick,
      player: player ? { x: player.x, y: player.y, hp: player.hp, maxHp: player.maxHp } : null,
      enemies,
      featureCounts,
    });
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;

    const delta = Math.min(100, now - this.lastTime);
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= SIMULATION_STEP_MS) {
      const input = this.controls.snapshot();
      this.simulateStep(input.dx, input.dy, input.pickChoice, input.interact, input.cancel);
      this.accumulator -= SIMULATION_STEP_MS;
    }

    this.renderer.render(this.state);
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private simulateStep(dx: number, dy: number, pickChoice: 1 | 2 | null, interact: boolean, cancel: boolean): void {
    const clickedTile = this.renderer.consumeClickedTile();
    const hoveredTile = this.renderer.getHoveredTile();

    if (this.state.interactionModal) {
      if (cancel) {
        cancelInteractionModal(this.state);
      } else if (interact || clickedTile) {
        confirmInteractionModal(this.state);
      }
      return;
    }

    this.state.simTick += 1;
    this.state.simTimeMs += SIMULATION_STEP_MS;

    this.state.screenFlash.damageMs = Math.max(0, this.state.screenFlash.damageMs - SIMULATION_STEP_MS);
    this.state.screenFlash.healMs = Math.max(0, this.state.screenFlash.healMs - SIMULATION_STEP_MS);
    this.state.cameraShakeMs = Math.max(0, this.state.cameraShakeMs - SIMULATION_STEP_MS);
    this.state.uiAlerts = this.state.uiAlerts.filter((item) => item.untilMs > this.state.simTimeMs);

    for (const entity of this.state.level.entities.values()) {
      if (!entity.alive) {
        entity.animIntent = 'die';
        continue;
      }
      // Only reset to idle if not in move cooldown (still animating walk)
      if (entity.animIntent !== 'die' && this.state.simTimeMs >= entity.nextMoveAt) {
        entity.animIntent = 'idle';
      }
    }

    if (this.state.phase === 'game_over' || this.state.phase === 'victory') {
      updateParticles(this.state, SIMULATION_STEP_MS);
      return;
    }

    if (this.state.phase === 'powerup_choice') {
      if (pickChoice) {
        resolvePowerUpChoice(this.state, pickChoice);
      }
      updateParticles(this.state, SIMULATION_STEP_MS);
      return;
    }

    const player = getPlayer(this.state);
    if (!player || !player.alive) {
      this.state.phase = 'game_over';
      return;
    }

    if (this.state.inspectOverlay && this.state.inspectOverlay.untilMs <= this.state.simTimeMs) {
      this.state.inspectOverlay = null;
    }

    if (this.state.phase === 'running' && (interact || clickedTile)) {
      let target = clickedTile ?? hoveredTile ?? null;
      if (!target) {
        const facing = player.facing;
        const fx = player.x + Math.sign(facing.x);
        const fy = player.y + Math.sign(facing.y);
        const facingTarget = { x: fx, y: fy };
        target = inBounds2D(this.state.level, facingTarget.x, facingTarget.y)
          ? facingTarget
          : { x: player.x, y: player.y };
      }
      if (!target) {
        target = { x: player.x, y: player.y };
      }

      const handled = attemptInteractionAt(this.state, target);
      if (this.state.interactionModal) {
        return;
      }
      if (handled) {
        dx = 0;
        dy = 0;
      }
    }

    applyPlayerRegen(player, SIMULATION_STEP_MS);
    if (this.state.activeDebuffs.slowUntilMs > this.state.simTimeMs) {
      player.animSpeedMul = 0.72;
    } else if (this.state.activeDebuffs.crystalBuffUntilMs > this.state.simTimeMs) {
      player.animSpeedMul = 1.12;
    } else {
      player.animSpeedMul = 1;
    }

    // 1) Player input/melee
    if (dx !== 0 || dy !== 0) {
      const action = tryPlayerBumpAction(this.state, player, dx, dy, this.state.simTimeMs);
      if (action.killedEnemyIds.length > 0) {
        handleEnemyKills(this.state, action.killedEnemyIds);
      }
    }

    applyPlayerFeatureInteractions(this.state, player);
    if (!player.alive) {
      this.state.phase = 'game_over';
      return;
    }

    // 2) Dynamic corridors + corridor events
    updateDynamicCorridors(this.state);
    const playerAfterDynamic = getPlayer(this.state);
    if (!playerAfterDynamic || !playerAfterDynamic.alive) {
      this.state.phase = 'game_over';
      return;
    }
    updateCorridorEvents(this.state);
    const playerAfterEvents = getPlayer(this.state);
    if (!playerAfterEvents || !playerAfterEvents.alive) {
      this.state.phase = 'game_over';
      return;
    }

    // 3) Enemy AI decisions/moves/attacks
    updateEnemiesAI(this.state, this.state.simTimeMs);
    const playerAfterAi = getPlayer(this.state);
    if (!playerAfterAi || !playerAfterAi.alive) {
      this.state.phase = 'game_over';
      return;
    }

    // 4) Projectile simulation/impacts
    const projectileResult = updateProjectiles(this.state, SIMULATION_STEP_MS);
    if (projectileResult.killedEnemyIds.length > 0) {
      handleEnemyKills(this.state, projectileResult.killedEnemyIds);
    }

    const playerAfterProjectiles = getPlayer(this.state);
    if (!playerAfterProjectiles || !playerAfterProjectiles.alive) {
      this.state.phase = 'game_over';
      return;
    }

    applyPlayerFeatureInteractions(this.state, playerAfterProjectiles);
    if (!playerAfterProjectiles.alive) {
      this.state.phase = 'game_over';
      return;
    }

    // 5) Particle lifecycle
    updateParticles(this.state, SIMULATION_STEP_MS);

    // 6) Power-up queue & transitions
    startNextPowerUpChoiceIfNeeded(this.state);
    if (this.state.activePowerUpChoice) {
      return;
    }

    if (shouldTriggerVictory(this.state)) {
      this.state.phase = 'victory';
      this.state.messages.push('O nucleo final foi conquistado!');
      return;
    }

    if (shouldAdvanceFloor(this.state)) {
      advanceToNextFloor(this.state);
    }

    if (this.state.messages.length > 10) {
      this.state.messages.splice(0, this.state.messages.length - 10);
    }
  }
}
