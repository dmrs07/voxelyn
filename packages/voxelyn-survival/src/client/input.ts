import type { PlayerCommand, Vec2 } from '@voxelyn/survival-sim';
import { emptyCommand } from '@voxelyn/survival-sim';

export type TouchButton = {
  id: 'dodge' | 'ability' | 'consume' | 'interact';
  label: string;
  cx: number;
  cy: number;
  r: number;
  pressed: boolean;
};

export type InputState = {
  joystick: { active: boolean; originX: number; originY: number; dx: number; dy: number; pointerId: number };
  aimTouch: { active: boolean; dx: number; dy: number; pointerId: number };
  buttons: TouchButton[];
  usingTouch: boolean;
  tapQueue: Array<{ x: number; y: number }>;
};

const JOY_RADIUS = 56;

/**
 * Entrada mobile-first: joystick virtual a esquerda, area de mira com autofire a
 * direita, botoes de esquiva/habilidade/consumivel/interacao. Teclado+mouse no desktop.
 */
export class SurvivalInput {
  private readonly keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0, down: false };
  private queuedDodge = false;
  private queuedInteract = false;
  private queuedConsume = false;
  private queuedAbility = false;
  private queuedChoice: 0 | 1 | null = null;
  private queuedRestart = false;

  readonly state: InputState = {
    joystick: { active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 },
    aimTouch: { active: false, dx: 0, dy: 0, pointerId: -1 },
    buttons: [],
    usingTouch: false,
    tapQueue: [],
  };

  constructor(private readonly canvas: HTMLCanvasElement) {}

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  layoutButtons(width: number, height: number): void {
    const r = Math.max(26, Math.min(38, height * 0.075));
    const margin = r * 0.7;
    const baseX = width - r - margin - 8;
    const baseY = height - r - margin - 8;
    this.state.buttons = [
      { id: 'dodge', label: 'ESQ', cx: baseX, cy: baseY, r, pressed: false },
      { id: 'ability', label: 'PLS', cx: baseX - (r * 2 + margin), cy: baseY - r * 0.4, r: r * 0.85, pressed: false },
      { id: 'consume', label: 'VIA', cx: baseX - r * 0.4, cy: baseY - (r * 2 + margin), r: r * 0.85, pressed: false },
      { id: 'interact', label: 'USA', cx: baseX - (r * 1.75 + margin), cy: baseY - (r * 1.75 + margin), r: r * 0.8, pressed: false },
    ];
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys[k] = true;
    if (k === ' ') this.queuedDodge = true;
    if (k === 'e') this.queuedInteract = true;
    if (k === 'f') this.queuedConsume = true;
    if (k === 'q' || k === 'shift') this.queuedAbility = true;
    if (k === 'r') this.queuedRestart = true;
    if (k === '1') this.queuedChoice = 0;
    if (k === '2') this.queuedChoice = 1;
    if ([' ', 'w', 'a', 's', 'd', 'e', 'f', 'q', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.key.toLowerCase()] = false;
  };

  private buttonAt(x: number, y: number): TouchButton | null {
    for (const b of this.state.buttons) {
      if (Math.hypot(x - b.cx, y - b.cy) <= b.r * 1.25) return b;
    }
    return null;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    const x = e.clientX;
    const y = e.clientY;
    if (e.pointerType === 'touch') {
      this.state.usingTouch = true;
      this.state.tapQueue.push({ x, y });
      const btn = this.buttonAt(x, y);
      if (btn) {
        btn.pressed = true;
        if (btn.id === 'dodge') this.queuedDodge = true;
        if (btn.id === 'ability') this.queuedAbility = true;
        if (btn.id === 'consume') this.queuedConsume = true;
        if (btn.id === 'interact') this.queuedInteract = true;
        return;
      }
      if (x < window.innerWidth * 0.45 && !this.state.joystick.active) {
        this.state.joystick = { active: true, originX: x, originY: y, dx: 0, dy: 0, pointerId: e.pointerId };
      } else if (!this.state.aimTouch.active) {
        this.state.aimTouch = { active: true, dx: 0, dy: 0, pointerId: e.pointerId };
        this.updateAimTouch(x, y);
      }
    } else {
      this.mouse.down = true;
      this.mouse.x = x;
      this.mouse.y = y;
      this.state.tapQueue.push({ x, y });
    }
  };

  private updateAimTouch(x: number, y: number): void {
    // direcao a partir do centro da metade direita (mira relativa e estavel)
    const cx = window.innerWidth * 0.5;
    const cy = window.innerHeight * 0.5;
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      this.state.aimTouch.dx = dx / len;
      this.state.aimTouch.dy = dy / len;
    }
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (this.state.joystick.active && e.pointerId === this.state.joystick.pointerId) {
        const dx = e.clientX - this.state.joystick.originX;
        const dy = e.clientY - this.state.joystick.originY;
        const len = Math.hypot(dx, dy);
        const clamp = Math.min(1, len / JOY_RADIUS);
        if (len > 2) {
          this.state.joystick.dx = (dx / len) * clamp;
          this.state.joystick.dy = (dy / len) * clamp;
        }
      } else if (this.state.aimTouch.active && e.pointerId === this.state.aimTouch.pointerId) {
        this.updateAimTouch(e.clientX, e.clientY);
      }
    } else {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (e.pointerId === this.state.joystick.pointerId) {
        this.state.joystick.active = false;
        this.state.joystick.dx = 0;
        this.state.joystick.dy = 0;
        this.state.joystick.pointerId = -1;
      }
      if (e.pointerId === this.state.aimTouch.pointerId) {
        this.state.aimTouch.active = false;
        this.state.aimTouch.pointerId = -1;
      }
      for (const b of this.state.buttons) b.pressed = false;
    } else {
      this.mouse.down = false;
    }
  };

  consumeChoiceTap(regions: Array<{ x: number; y: number; w: number; h: number }>): 0 | 1 | null {
    if (this.queuedChoice !== null) {
      const c = this.queuedChoice;
      this.queuedChoice = null;
      return c;
    }
    while (this.state.tapQueue.length > 0) {
      const tap = this.state.tapQueue.shift() as { x: number; y: number };
      for (let i = 0; i < regions.length; i++) {
        const r = regions[i];
        if (tap.x >= r.x && tap.x <= r.x + r.w && tap.y >= r.y && tap.y <= r.y + r.h) {
          return i as 0 | 1;
        }
      }
    }
    return null;
  }

  /**
   * Descarta intencoes de UI pendentes (toques e a tecla R). A fila de toques
   * so existe para UI (menu de escolha, tela de fim); durante a run ninguem a
   * consome, entao sem este dreno cada toque no joystick/mira/botao — e cada
   * clique de tiro no mouse — fica guardado e o primeiro hasTap() apos a morte
   * reinicia a run na hora, antes do jogador ver o resultado. A tecla R e
   * travada do mesmo jeito e precisa do mesmo dreno.
   */
  clearPendingUiInput(): void {
    this.state.tapQueue.length = 0;
    this.queuedRestart = false;
  }

  hasTap(): boolean {
    if (this.state.tapQueue.length > 0) {
      this.state.tapQueue.length = 0;
      return true;
    }
    return false;
  }

  /**
   * Reinicio por teclado, alinhado com o texto da tela de fim. A tecla fica
   * TRAVADA ate ser consumida: se o jogador apertar R antes de a porta armar,
   * o pedido sobrevive ao keyup em vez de se perder.
   */
  consumeRestartKey(): boolean {
    if (!this.queuedRestart) return false;
    this.queuedRestart = false;
    return true;
  }

  /** Converte o estado bruto em PlayerCommand. worldAim: funcao tela->direcao de mira. */
  snapshot(playerScreen: Vec2): PlayerCommand {
    const cmd: PlayerCommand = emptyCommand();

    // movimento: teclado (tela iso: WASD mapeado para eixos do mundo)
    let mx = 0;
    let my = 0;
    if (this.keys.w || this.keys.arrowup) my -= 1;
    if (this.keys.s || this.keys.arrowdown) my += 1;
    if (this.keys.a || this.keys.arrowleft) mx -= 1;
    if (this.keys.d || this.keys.arrowright) mx += 1;

    if (this.state.joystick.active) {
      mx = this.state.joystick.dx;
      my = this.state.joystick.dy;
    }
    // conversao tela->mundo isometrico (45 graus)
    if (mx !== 0 || my !== 0) {
      cmd.move = { x: mx + my * 2, y: my * 2 - mx };
    }

    // mira
    if (this.state.aimTouch.active) {
      const ax = this.state.aimTouch.dx;
      const ay = this.state.aimTouch.dy;
      cmd.aim = { x: ax + ay * 2, y: ay * 2 - ax };
      cmd.fire = true; // autofire enquanto mira (mobile)
    } else if (!this.state.usingTouch) {
      const dx = this.mouse.x - playerScreen.x;
      const dy = this.mouse.y - playerScreen.y;
      cmd.aim = { x: dx + dy * 2, y: dy * 2 - dx };
      cmd.fire = this.mouse.down;
    }

    cmd.dodge = this.queuedDodge;
    cmd.interact = this.queuedInteract;
    cmd.consume = this.queuedConsume;
    cmd.ability = this.queuedAbility;
    this.queuedDodge = false;
    this.queuedInteract = false;
    this.queuedConsume = false;
    this.queuedAbility = false;

    return cmd;
  }
}
