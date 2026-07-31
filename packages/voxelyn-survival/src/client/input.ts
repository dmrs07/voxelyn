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
  /**
   * O jogador esta MIRANDO agora — no toque, o manche direito saiu do repouso;
   * no mouse, o gatilho esta apertado.
   *
   * Existe para a faixa de mira no chao. Ela precisa aparecer so quando ha
   * intencao de atirar: desenhada o tempo todo, ela vira mobilia da tela, e o
   * jogador para de ve-la exatamente no instante em que ela deveria informar
   * alguma coisa. No toque isso e literal — o manche tem posicao de repouso, e
   * fora dela nao ha mira nenhuma acontecendo.
   *
   * Sai daqui e nao de uma releitura do estado no renderer porque e a MESMA
   * condicao que decide `cmd.fire`: separadas, faixa e tiro divergiriam no
   * primeiro ajuste de zona morta.
   */
  aiming: boolean;
};

export const MOVE_JOYSTICK_RADIUS = 60;
export const AIM_JOYSTICK_RADIUS = 60;
export const TOUCH_BUTTON_HIT_SCALE = 1.08;
const MOVE_STICK_ACTIVATION_SCALE = 1.55;
export const AIM_STICK_ACTIVATION_SCALE = 1.45;
const MOVE_DEAD_ZONE = 0.08;
const AIM_DEAD_ZONE = 0.12;

/**
 * Este elemento recebe digitacao?
 *
 * A decisao vive separada do DOM (como em `restart.ts` e `pause.ts`) porque a
 * LISTA e a parte que erra com o tempo: quem adicionar um campo novo precisa de
 * um teste que reclame, e nao de um jogo que silencie o som quando o jogador se
 * chama Marta.
 */
export const isEditableTag = (tagName: string, contentEditable = false): boolean =>
  tagName === 'INPUT' ||
  tagName === 'TEXTAREA' ||
  // `select` entra pelo mesmo motivo que os campos de texto: as setas navegam as
  // opcoes, e o `preventDefault` do movimento as roubava do teclado.
  tagName === 'SELECT' ||
  contentEditable;

/**
 * A tecla foi digitada DENTRO de um campo?
 *
 * Os atalhos do jogo escutam a janela inteira, e isso funcionou enquanto o unico
 * campo de texto — o nome do ranking — vivia numa tela de titulo que nunca esta
 * aberta junto com o jogo. Com as opcoes disponiveis no meio da run, o mesmo
 * listener passa a receber cada letra que o jogador digita: "Marta" silenciava o
 * som no M, "Rafael" engatilhava o reinicio no R e o espaco, com
 * `preventDefault`, nunca chegava a entrar no nome.
 */
export const isEditingText = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && isEditableTag(target.tagName, target.isContentEditable);

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
 * Deflexao de TELA -> DIRECAO de mira no mundo, sempre unitaria.
 *
 * A conversao isometrica e a mesma do movimento; o que muda e o resto. A mira
 * nao tem magnitude: a simulacao so usa o rumo dela, e quem le o vetor cru la
 * na frente o normaliza de novo. Guardar aqui a escala da tela era caro e
 * invisivel — ate deixar de ser.
 *
 * O DEFEITO QUE ISTO CONSERTA: no solo o comando passa por `quantizeCommand`
 * antes de entrar na simulacao, e la cada eixo vira `round(v*127)` SATURADO em
 * ±127. Isso pressupoe um vetor unitario — o cabecalho do codec diz isso com
 * todas as letras —, e o que chegava era a diferenca em PIXELS entre o cursor e
 * o centro da tela, na casa das centenas. Os dois eixos saturavam juntos, e o
 * vetor inteiro colapsava numa das quatro diagonais.
 *
 * Consequencia medida, varrendo o cursor em volta do personagem: o tiro so saia
 * em quatro rumos de tela — cima, baixo, esquerda, direita. Erro medio de 20,5
 * graus e maximo de 44,5. Mirar na diagonal atirava reto para baixo, e mover o
 * cursor nao mudava nada ate cruzar a fronteira, quando o tiro saltava 90 graus
 * de uma vez. No analogico o mesmo estouro dava erro medio de 9 graus.
 *
 * Normalizar aqui e o conserto na origem: a mira sai deste metodo como o codec
 * sempre presumiu que ela chegava.
 */
export const screenToWorldAim = (sx: number, sy: number): Vec2 => {
  const wx = sx + sy * 2;
  const wy = sy * 2 - sx;
  const length = Math.hypot(wx, wy);
  if (length <= 0) return { x: 0, y: 0 };
  return { x: wx / length, y: wy / length };
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
    aiming: false,
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
    // Digitar num campo nao e jogar. `onKeyUp` NAO tem a mesma guarda de
    // proposito: ele so limpa teclas, e limpar de mais e sempre seguro —
    // deixar uma tecla presa porque o foco mudou no meio do aperto nao e.
    if (isEditingText(e.target)) return;
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

  /**
   * Descarta acoes de uso unico ainda engatilhadas (esquiva, habilidade, purga,
   * interacao).
   *
   * Elas ficam travadas ate a proxima `snapshot`, que e o certo durante a run —
   * um aperto no meio de um tick nao pode se perder. Mas com o menu de campo
   * aberto ninguem chama `snapshot`, e o teclado continua chegando por cima da
   * overlay: sem este dreno, o espaco apertado por engano enquanto se mexe no
   * volume sairia como um dash no instante em que o menu fecha.
   */
  clearQueuedActions(): void {
    this.queuedDodge = false;
    this.queuedInteract = false;
    this.queuedPurge = false;
    this.queuedAbility = false;
    this.queuedChoice = null;
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
      cmd.aim = screenToWorldAim(this.state.aimTouch.dx, this.state.aimTouch.dy);
      cmd.fire = true;
    } else if (!this.state.usingTouch) {
      cmd.aim = screenToWorldAim(this.mouse.x - playerScreen.x, this.mouse.y - playerScreen.y);
      cmd.fire = this.mouse.down;
    }
    // A faixa de mira segue o GATILHO, e nao o cursor. No toque o manche fora do
    // repouso ja atira, entao as duas coisas coincidem; no mouse, o cursor esta
    // sempre apontando para algum lugar e uma faixa permanente no chao seria
    // ruido constante — quem tem cursor ja ve para onde mira sem ela.
    this.state.aiming = cmd.fire;

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
