import {
  tryPlayerBumpAction,
  updateParticles,
  updateProjectiles,
} from '../combat/combat';
import { updateEnemiesAI } from '../entities/ai';
import { applyPlayerRegen } from '../entities/player';
import { Controls } from '../input/controls';
import { resolvePowerUpChoice, startNextPowerUpChoiceIfNeeded } from '../powerups/system';
import { IsoRenderer } from '../render/iso-renderer';
import { updateCorridorEvents } from '../world/corridor-events';
import { updateDynamicCorridors } from '../world/dynamic-corridors';
import { applyPlayerFeatureInteractions } from '../world/features';
import { SIMULATION_STEP_MS } from './constants';
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

  private readonly frame = (now: number): void => {
    if (!this.running) return;

    const delta = Math.min(100, now - this.lastTime);
    this.lastTime = now;
    this.accumulator += delta;

    while (this.accumulator >= SIMULATION_STEP_MS) {
      const input = this.controls.snapshot();
      this.simulateStep(input.dx, input.dy, input.pickChoice);
      this.accumulator -= SIMULATION_STEP_MS;
    }

    this.renderer.render(this.state);
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private simulateStep(dx: number, dy: number, pickChoice: 1 | 2 | null): void {
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
