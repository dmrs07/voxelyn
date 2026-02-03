import type { ControlSnapshot } from '../game/types';

const MOVEMENT_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

export class Controls {
  private readonly keys: Record<string, boolean> = {};
  private readonly choiceQueue: Array<1 | 2> = [];
  private lastMoveKey: string | null = null;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();

    if (MOVEMENT_KEYS.has(key)) {
      this.keys[key] = true;
      this.lastMoveKey = key;
      event.preventDefault();
      return;
    }

    if (key === '1') {
      this.choiceQueue.push(1);
      event.preventDefault();
      return;
    }

    if (key === '2') {
      this.choiceQueue.push(2);
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (MOVEMENT_KEYS.has(key)) {
      this.keys[key] = false;
      if (this.lastMoveKey === key) {
        this.lastMoveKey = null;
      }
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
    const pickChoice = this.choiceQueue.shift() ?? null;

    let dx = 0;
    let dy = 0;

    const up = this.keys.w || this.keys.arrowup;
    const down = this.keys.s || this.keys.arrowdown;
    const left = this.keys.a || this.keys.arrowleft;
    const right = this.keys.d || this.keys.arrowright;

    if (up) dy = -1;
    if (down) dy = 1;
    if (left) dx = -1;
    if (right) dx = 1;

    // Grid-lock MVP uses cardinal movement; if diagonal is pressed, prefer latest pressed axis.
    if (dx !== 0 && dy !== 0) {
      if (this.lastMoveKey === 'w' || this.lastMoveKey === 'arrowup' || this.lastMoveKey === 's' || this.lastMoveKey === 'arrowdown') {
        dx = 0;
      } else {
        dy = 0;
      }
    }

    return { dx, dy, pickChoice };
  }
}
