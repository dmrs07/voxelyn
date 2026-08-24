import { SLOTS } from '../sim/index.js';
import type { Cat, CatId, Command, HackState, SlotId } from '../sim/types.js';

/**
 * A MAO DE DEUS, com as licoes de toque pagas na Iliada embutidas desde o
 * primeiro commit: toque e o cidadao primario (mouse e o mesmo caminho),
 * `touch-action: none` na pagina, nenhuma informacao so-de-hover, e o teclado
 * cobre o jogo inteiro para quem nao tem (ou nao quer) ponteiro.
 *
 * Semantica de ponteiro, uma so para dedo e mouse:
 *  - descer no gato e MOVER  -> arrastar (pega; soltar em cima de posto larga la)
 *  - descer no gato e SEGURAR -> carinho continuo (e o "shipa" do Bigode)
 *  - toque curto no gato     -> selecionar (ficha no HUD)
 *  - com modo petisco armado -> o proximo toque num gato alimenta
 */

export type InputState = {
  x: number;
  y: number;
  down: boolean;
  downAtMs: number;
  /** Onde o dedo DESCEU. O arrasto mede daqui, nunca do evento anterior. */
  downX: number;
  downY: number;
  downCat: CatId | null;
  moved: boolean;
  petting: CatId | null;
  selected: CatId | null;
  feedArmed: boolean;
  /** Acoes de um tiro na fila; a sim consome uma por tick. */
  queue: Command[];
};

export const createInput = (): InputState => ({
  x: 240,
  y: 135,
  down: false,
  downAtMs: 0,
  downX: 0,
  downY: 0,
  downCat: null,
  moved: false,
  petting: null,
  selected: null,
  feedArmed: false,
  queue: [],
});

const DRAG_PX = 7;
const HOLD_MS = 260;

export const catAt = (state: HackState, x: number, y: number): Cat | null => {
  let best: Cat | null = null;
  let bestD = 20;
  for (const cat of state.cats) {
    const d = Math.hypot(cat.x - x, cat.y - (y + 6));
    if (d < bestD) {
      bestD = d;
      best = cat;
    }
  }
  return best;
};

export const slotAt = (x: number, y: number): SlotId | null => {
  let best: SlotId | null = null;
  let bestD = 30;
  for (const slot of SLOTS) {
    const d = Math.hypot(slot.x - x, slot.y - y);
    if (d < bestD) {
      bestD = d;
      best = slot.id;
    }
  }
  return best;
};

export type InputTeardown = () => void;

export const attachInput = (
  input: InputState,
  canvas: HTMLCanvasElement,
  state: () => HackState,
  nowMs: () => number
): InputTeardown => {
  const toScene = (clientX: number, clientY: number): { x: number; y: number } => {
    // O canvas usa object-fit: contain — o bitmap 480x270 fica em caixa
    // dentro do elemento. Mapear pelo retangulo do elemento erra o alvo em
    // qualquer tela que nao seja 16:9; mapeamos pelo retangulo contido.
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 480, rect.height / 270);
    const offX = rect.left + (rect.width - 480 * scale) / 2;
    const offY = rect.top + (rect.height - 270 * scale) / 2;
    return {
      x: (clientX - offX) / scale,
      y: (clientY - offY) / scale,
    };
  };

  const down = (clientX: number, clientY: number): void => {
    const p = toScene(clientX, clientY);
    input.x = p.x;
    input.y = p.y;
    input.down = true;
    input.downAtMs = nowMs();
    input.downX = p.x;
    input.downY = p.y;
    input.moved = false;
    const s = state();
    const cat = catAt(s, p.x, p.y);
    input.downCat = cat?.id ?? null;
    if (input.feedArmed && cat) {
      input.queue.push({ treat: cat.id });
      input.feedArmed = false;
      input.downCat = null;
    }
  };

  const move = (clientX: number, clientY: number): void => {
    const p = toScene(clientX, clientY);
    // Distancia da ORIGEM do toque, nunca do evento anterior: um dedo lento
    // dispara touchmove a cada 2-3px e um "arrasto" medido por evento nunca
    // passaria do limiar — o gesto mais importante do jogo morreria exatamente
    // para quem arrasta com cuidado. (Pego pela fumaca, que arrasta como gente.)
    if (input.down && Math.hypot(p.x - input.downX, p.y - input.downY) > DRAG_PX) input.moved = true;
    input.x = p.x;
    input.y = p.y;
    const s = state();
    // Arrastou de cima de um gato: vira pegar (uma vez).
    if (input.down && input.moved && input.downCat && !s.held && input.petting === null) {
      input.queue.push({ grab: input.downCat });
      input.downCat = null;
    }
  };

  const up = (): void => {
    const s = state();
    const heldNow = s.held;
    if (heldNow) {
      const slot = slotAt(input.x, input.y);
      input.queue.push(slot ? { drop: slot } : { release: true });
    } else if (input.downCat && !input.moved && nowMs() - input.downAtMs < HOLD_MS) {
      // Toque curto: seleciona (a ficha aparece no HUD, nunca so em hover).
      input.selected = input.selected === input.downCat ? null : input.downCat;
    }
    input.down = false;
    input.downCat = null;
    input.petting = null;
  };

  const onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    const t = e.changedTouches[0];
    down(t.clientX, t.clientY);
  };
  const onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const t = e.changedTouches[0];
    move(t.clientX, t.clientY);
  };
  // `preventDefault` SO no que e nosso — a licao do clique sintetizado: um
  // touchend cancelado na janela mata o clique dos botoes HTML do HUD.
  const onTouchEnd = (e: TouchEvent): void => {
    if (input.down) {
      e.preventDefault();
      up();
    }
  };

  const onMouseDown = (e: MouseEvent): void => down(e.clientX, e.clientY);
  const onMouseMove = (e: MouseEvent): void => move(e.clientX, e.clientY);
  const onMouseUp = (): void => {
    if (input.down) up();
  };

  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  window.addEventListener('touchend', onTouchEnd, { passive: false });
  window.addEventListener('touchcancel', onTouchEnd, { passive: false });
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return () => {
    canvas.removeEventListener('touchstart', onTouchStart);
    canvas.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
};

/**
 * Monta o comando DESTE tick. Uma acao por tick — a fila garante que um gesto
 * rapido nao se perde entre ticks (a licao dos 144Hz: nunca descartar borda
 * fora do passo da simulacao).
 */
export const buildCommand = (input: InputState, state: HackState, nowMs: () => number): Command => {
  const cmd: Command = input.queue.shift() ?? {};
  cmd.handX = input.x;
  cmd.handY = input.y;

  // Segurar parado em cima de um gato = carinho continuo.
  if (
    input.down &&
    !input.moved &&
    input.downCat &&
    !state.held &&
    nowMs() - input.downAtMs >= HOLD_MS
  ) {
    input.petting = input.downCat;
  }
  if (input.petting && !cmd.grab && !cmd.drop && !cmd.treat) cmd.pet = input.petting;
  return cmd;
};

/** Teclado completo: 1-4 pega/solta, QWER mesas, Z puff, X rack, C cafe, P carinho. */
export const attachKeyboard = (input: InputState, state: () => HackState): InputTeardown => {
  const CAT_KEYS: Record<string, CatId> = { Digit1: 'bigode', Digit2: 'cheeto', Digit3: 'almofada', Digit4: 'smoking' };
  const SLOT_KEYS: Record<string, SlotId> = {
    KeyQ: 'desk-backend',
    KeyW: 'desk-frontend',
    KeyE: 'desk-design',
    KeyR: 'desk-devops',
    KeyZ: 'puff',
    KeyX: 'rack',
    KeyC: 'cafe',
  };
  const onKey = (e: KeyboardEvent): void => {
    const s = state();
    if (CAT_KEYS[e.code]) {
      e.preventDefault();
      const id = CAT_KEYS[e.code];
      if (s.held === id) input.queue.push({ release: true });
      else if (!s.held) {
        input.queue.push({ grab: id });
        input.selected = id;
      }
    } else if (SLOT_KEYS[e.code] && s.held) {
      e.preventDefault();
      input.queue.push({ drop: SLOT_KEYS[e.code] });
    } else if (e.code === 'KeyP' && input.selected && !s.held) {
      e.preventDefault();
      input.petting = input.selected;
    } else if (e.code === 'KeyT') {
      e.preventDefault();
      input.feedArmed = !input.feedArmed;
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyP') input.petting = null;
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
  };
};
