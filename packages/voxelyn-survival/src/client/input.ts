import type { PlayerCommand, Vec2 } from '@voxelyn/survival-sim';
import { emptyCommand } from '@voxelyn/survival-sim';

export type TouchButton = {
  id: 'dodge' | 'ability' | 'purge' | 'interact';
  cx: number;
  cy: number;
  r: number;
  pressed: boolean;
};

export type TouchSafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type InputState = {
  joystick: { active: boolean; originX: number; originY: number; dx: number; dy: number; pointerId: number };
  aimTouch: {
    active: boolean;
    originX: number;
    originY: number;
    dx: number;
    dy: number;
    pointerId: number;
  };
  buttons: TouchButton[];
  actionPressSeq: { dodge: number; ability: number };
  usingTouch: boolean;
  tapQueue: Array<{ x: number; y: number }>;
};

export const MOVE_JOYSTICK_RADIUS = 60;
export const AIM_JOYSTICK_RADIUS = 60;
export const TOUCH_BUTTON_HIT_SCALE = 1.08;
const MOVE_STICK_ACTIVATION_SCALE = 1.55;
export const AIM_STICK_ACTIVATION_SCALE = 1.45;
const MOVE_DEAD_ZONE = 0.08;
const AIM_DEAD_ZONE = 0.12;

/** Cancela qualquer ponteiro touch ainda ativo ao selecionar mouse/trackpad. */
export const deactivateTouchControls = (state: InputState): void => {
  state.usingTouch = false;
  state.joystick.active = false;
  state.joystick.dx = 0;
  state.joystick.dy = 0;
  state.joystick.pointerId = -1;
  state.aimTouch.active = false;
  state.aimTouch.dx = 0;
  state.aimTouch.dy = 0;
  state.aimTouch.pointerId = -1;
  for (const button of state.buttons) button.pressed = false;
};

/**
 * Deflexao de TELA -> direcao de MUNDO, preservando a MAGNITUDE.
 *
 * A conversao isometrica `{x: mx + 2my, y: 2my - mx}` da a direcao certa e o
 * comprimento errado: ela estica o eixo vertical da tela por 2, entao o mesmo
 * empurrao de stick produz vetores de mundo de comprimentos diferentes conforme
 * a direcao. Mandar isso cru para a simulacao delegava o problema ao clamp de
 * la (`min(1, |move|)`), e o clamp so salva o caso de deflexao MAXIMA.
 *
 * Medido, antes da correcao: meio-stick para a direita dava 70,7% da velocidade,
 * meio-stick para cima dava 100%. No teclado nunca apareceu porque teclado e
 * sempre deflexao maxima — o bug morava inteiro no analogico, que e o controle da
 * plataforma que o jogo mira.
 *
 * A correcao separa as duas coisas que estavam misturadas: a DIRECAO sai da
 * conversao isometrica e e normalizada; a MAGNITUDE sai do quanto o jogador
 * empurrou, e nada mais. `min(1, ...)` continua aqui porque o teclado diagonal
 * produz comprimento raiz de 2 e "andar mais rapido na diagonal" e exatamente o
 * que nao pode acontecer.
 *
 * Nao mexe na velocidade de MUNDO por direcao — ela ja era constante nas oito, e
 * tem de continuar: uma velocidade que varia com o rumo faria um perseguidor
 * ganhar ou perder terreno conforme para onde voce olha.
 */
export const screenToWorldMove = (mx: number, my: number): Vec2 => {
  const magnitude = Math.min(1, Math.hypot(mx, my));
  if (magnitude <= 0) return { x: 0, y: 0 };
  const wx = mx + my * 2;
  const wy = my * 2 - mx;
  const length = Math.hypot(wx, wy) || 1;
  return { x: (wx / length) * magnitude, y: (wy / length) * magnitude };
};

/**
 * Entrada mobile-first: joystick fixo de movimento a esquerda, joystick fixo
 * de mira/auto-fire a direita e quatro acoes separadas acima da mira.
 * Teclado+mouse continuam sendo a modalidade desktop.
 */
export class SurvivalInput {
  private readonly keys: Record<string, boolean> = {};
  private mouse = { x: 0, y: 0, down: false };
  private queuedDodge = false;
  private queuedInteract = false;
  private queuedPurge = false;
  private queuedAbility = false;
  private queuedChoice: 0 | 1 | null = null;
  private queuedRestart = false;

  readonly state: InputState = {
    joystick: { active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 },
    aimTouch: { active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 },
    buttons: [],
    actionPressSeq: { dodge: 0, ability: 0 },
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

  layoutButtons(
    width: number,
    height: number,
    safeArea: Partial<Pick<TouchSafeArea, 'left' | 'right' | 'bottom'>> = {}
  ): void {
    const r = Math.max(24, Math.min(34, height * 0.066));
    const horizontalInset = Math.max(18, width * 0.025);
    const safeLeft = horizontalInset + Math.max(0, safeArea.left ?? 0);
    const safeRight = horizontalInset + Math.max(0, safeArea.right ?? 0);
    const safeBottom = Math.max(14, height * 0.035) + Math.max(0, safeArea.bottom ?? 0);
    const moveX = MOVE_JOYSTICK_RADIUS + safeLeft;
    const moveY = height - MOVE_JOYSTICK_RADIUS - safeBottom;
    const aimX = width - AIM_JOYSTICK_RADIUS - safeRight;
    const aimY = height - AIM_JOYSTICK_RADIUS - safeBottom;
    const aimActivationRadius = AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE;

    // Os dois controles ficam ancorados: a pele visual e a area de toque sempre
    // representam o mesmo lugar, em vez de o movimento nascer sob qualquer toque.
    this.state.joystick.originX = moveX;
    this.state.joystick.originY = moveY;
    this.state.aimTouch.originX = aimX;
    this.state.aimTouch.originY = aimY;

    // Hit targets continuam grandes, mas nunca se sobrepoem. O espaco real entre
    // eles e o que impede um polegar de acionar a acao vizinha por acidente.
    const hitRadius = r * TOUCH_BUTTON_HIT_SCALE;
    const gap = Math.max(14, Math.min(18, height * 0.04));
    const step = hitRadius * 2 + gap;
    const actionY = aimY - aimActivationRadius - hitRadius - gap;
    const dodgeX = aimX - aimActivationRadius - hitRadius - gap;

    this.state.buttons = [
      { id: 'dodge', cx: dodgeX, cy: aimY, r, pressed: false },
      { id: 'ability', cx: aimX - step * 2, cy: actionY, r, pressed: false },
      { id: 'purge', cx: aimX - step, cy: actionY, r, pressed: false },
      { id: 'interact', cx: aimX, cy: actionY, r, pressed: false },
    ];
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys[k] = true;
    if (k === ' ') {
      this.queuedDodge = true;
      this.state.actionPressSeq.dodge += 1;
    }
    if (k === 'e') this.queuedInteract = true;
    if (k === 'f') this.queuedPurge = true;
    if (k === 'q' || k === 'shift') {
      this.queuedAbility = true;
      this.state.actionPressSeq.ability += 1;
    }
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
      if (Math.hypot(x - b.cx, y - b.cy) <= b.r * TOUCH_BUTTON_HIT_SCALE) return b;
    }
    return null;
  }

  private selectMouseModality(): void {
    deactivateTouchControls(this.state);
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
        if (btn.id === 'dodge') {
          this.queuedDodge = true;
          this.state.actionPressSeq.dodge += 1;
        }
        if (btn.id === 'ability') {
          this.queuedAbility = true;
          this.state.actionPressSeq.ability += 1;
        }
        if (btn.id === 'purge') this.queuedPurge = true;
        if (btn.id === 'interact') this.queuedInteract = true;
        return;
      }

      const move = this.state.joystick;
      const inMoveZone =
        Math.hypot(x - move.originX, y - move.originY) <= MOVE_JOYSTICK_RADIUS * MOVE_STICK_ACTIVATION_SCALE;
      if (inMoveZone && !move.active) {
        move.active = true;
        move.pointerId = e.pointerId;
        this.updateMoveTouch(x, y);
        return;
      }

      const aim = this.state.aimTouch;
      const inAimZone =
        Math.hypot(x - aim.originX, y - aim.originY) <=
        AIM_JOYSTICK_RADIUS * AIM_STICK_ACTIVATION_SCALE;
      if (inAimZone && !aim.active) {
        aim.active = true;
        aim.pointerId = e.pointerId;
        this.updateAimTouch(x, y);
      }
    } else {
      // Mouse/trackpad ganha a modalidade e invalida dedos ainda pressionados.
      this.selectMouseModality();
      this.mouse.down = true;
      this.mouse.x = x;
      this.mouse.y = y;
      this.state.tapQueue.push({ x, y });
    }
  };

  private updateMoveTouch(x: number, y: number): void {
    const move = this.state.joystick;
    const dx = x - move.originX;
    const dy = y - move.originY;
    const len = Math.hypot(dx, dy);
    const clamp = Math.min(1, len / MOVE_JOYSTICK_RADIUS);

    if (clamp <= MOVE_DEAD_ZONE || len <= 2) {
      move.dx = 0;
      move.dy = 0;
      return;
    }

    move.dx = (dx / len) * clamp;
    move.dy = (dy / len) * clamp;
  }

  private updateAimTouch(x: number, y: number): void {
    const aim = this.state.aimTouch;
    const dx = x - aim.originX;
    const dy = y - aim.originY;
    const len = Math.hypot(dx, dy);
    const clamp = Math.min(1, len / AIM_JOYSTICK_RADIUS);

    if (clamp <= AIM_DEAD_ZONE || len <= 2) {
      aim.dx = 0;
      aim.dy = 0;
      return;
    }

    aim.dx = (dx / len) * clamp;
    aim.dy = (dy / len) * clamp;
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') {
      if (this.state.joystick.active && e.pointerId === this.state.joystick.pointerId) {
        this.updateMoveTouch(e.clientX, e.clientY);
      } else if (this.state.aimTouch.active && e.pointerId === this.state.aimTouch.pointerId) {
        this.updateAimTouch(e.clientX, e.clientY);
      }
    } else {
      this.selectMouseModality();
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
        this.state.aimTouch.dx = 0;
        this.state.aimTouch.dy = 0;
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

  /** Descarta uma escolha prematura durante a sequencia visual da recompensa. */
  clearPendingChoiceInput(): void {
    this.queuedChoice = null;
    this.state.tapQueue.length = 0;
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

    if (this.state.usingTouch && this.state.joystick.active) {
      mx = this.state.joystick.dx;
      my = this.state.joystick.dy;
    }
    cmd.move = screenToWorldMove(mx, my);

    // mira: vetor contido no joystick direito, sem depender da posicao do personagem.
    if (
      this.state.usingTouch &&
      this.state.aimTouch.active &&
      (this.state.aimTouch.dx !== 0 || this.state.aimTouch.dy !== 0)
    ) {
      const ax = this.state.aimTouch.dx;
      const ay = this.state.aimTouch.dy;
      cmd.aim = { x: ax + ay * 2, y: ay * 2 - ax };
      cmd.fire = true;
    } else if (!this.state.usingTouch) {
      const dx = this.mouse.x - playerScreen.x;
      const dy = this.mouse.y - playerScreen.y;
      cmd.aim = { x: dx + dy * 2, y: dy * 2 - dx };
      cmd.fire = this.mouse.down;
    }

    cmd.dodge = this.queuedDodge;
    cmd.interact = this.queuedInteract;
    cmd.purge = this.queuedPurge;
    cmd.ability = this.queuedAbility;
    this.queuedDodge = false;
    this.queuedInteract = false;
    this.queuedPurge = false;
    this.queuedAbility = false;

    return cmd;
  }
}
