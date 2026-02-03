import { tryPlayerBumpAction } from '../combat/combat';
import { updateEnemiesAI } from '../entities/ai';
import { applyPlayerRegen } from '../entities/player';
import { Controls } from '../input/controls';
import { resolvePowerUpChoice, startNextPowerUpChoiceIfNeeded } from '../powerups/system';
import { IsoRenderer } from '../render/iso-renderer';
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

    if (this.state.phase === 'game_over' || this.state.phase === 'victory') {
      return;
    }

    if (this.state.phase === 'powerup_choice') {
      if (pickChoice) {
        resolvePowerUpChoice(this.state, pickChoice);
      }
      return;
    }

    const player = getPlayer(this.state);
    if (!player || !player.alive) {
      this.state.phase = 'game_over';
      return;
    }

    applyPlayerRegen(player, SIMULATION_STEP_MS);

    if (dx !== 0 || dy !== 0) {
      const action = tryPlayerBumpAction(this.state.level, player, dx, dy, this.state.simTimeMs, this.state.simTick);
      if (action.killedEnemyIds.length > 0) {
        handleEnemyKills(this.state, action.killedEnemyIds);
        startNextPowerUpChoiceIfNeeded(this.state);
        if (this.state.activePowerUpChoice) {
          return;
        }
      }
    }

    updateEnemiesAI(this.state, this.state.simTimeMs);
    const playerAfterAi = getPlayer(this.state);
    if (!playerAfterAi || !playerAfterAi.alive) {
      this.state.phase = 'game_over';
      return;
    }

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
  }
}
