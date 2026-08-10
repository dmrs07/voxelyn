// A BARRA DE COMANDOS do desktop: as teclas e as recargas, sempre na tela.
//
// ---------------------------------------------------------------------------
// O BURACO QUE ELA FECHA
// ---------------------------------------------------------------------------
// O jogo nasceu mobile-first, e a interface de controle nasceu junto: dois
// manches, quatro botoes redondos e o radial de recarga desenhado POR CIMA dos
// botoes de esquiva e habilidade (`cooldown-overlay.ts`). Aquele radial e a
// unica leitura de recarga que existe — e ele so aparece com `usingTouch`.
//
// A consequencia no teclado nao era estetica. O jogador de desktop:
//
//   - nunca soube quais eram as teclas, porque nao ha o que apertar na tela e
//     nenhuma tela ensina antes da primeira descida;
//   - nunca soube quando a esquiva ou a habilidade voltaram, porque a UNICA
//     resposta de "ja da?" era apertar e ver se acontecia alguma coisa. Numa
//     luta, apertar para descobrir custa a esquiva que teria salvado.
//
// Esta barra e a mesma informacao do polegar, na lingua do teclado: cada
// comando com a sua tecla, e as duas recargas de verdade preenchendo de volta.
//
// ---------------------------------------------------------------------------
// AS REGRAS QUE ELA SEGUE
// ---------------------------------------------------------------------------
// - So no DESKTOP (`!usingTouch`). O toque ja tem os botoes, e as duas
//   interfaces na mesma tela seriam dois vocabularios para o mesmo comando.
// - A CONTA da recarga e a mesma do radial de toque — funcoes importadas de
//   `cooldown-overlay.ts`, nunca reescritas. Duas contas divergiriam no
//   primeiro ajuste de tuning, e o jogador aprenderia a nao confiar em nenhuma.
// - O LAYOUT e puro e exportado, para o teste medir posicao sem canvas.
// - Ela nao intercepta nada: e desenho por cima do HUD, sem area de toque. Uma
//   barra clicavel viraria um segundo caminho de comando para manter.
//
// A repouso ela e um sussurro; o que puxa o olho e o que MUDA — a tecla que
// esta apertada, a recarga correndo, o pulso do "voltou".

import {
  TICK_HZ,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { abilityPresentation } from './ability-presentation';
import {
  abilityCooldownDurationTicks,
  abilityReadyAtTick,
  cooldownModeForState,
  cooldownRemainingFraction,
  resolveCooldownReadyAt,
} from './cooldown-overlay';
import { t, type MessageKey } from './i18n';
import type { InputState } from './input';

/** Os comandos que a barra publica, na ordem em que a mao os aprende. */
export type DesktopControlId =
  | 'move'
  | 'fire'
  | 'dodge'
  | 'ability'
  | 'purge'
  | 'interact'
  | 'menu';

/** Os dois comandos que tem recarga de verdade na simulacao. */
export type DesktopCooldownId = Extract<DesktopControlId, 'dodge' | 'ability'>;

export type DesktopControl = {
  id: DesktopControlId;
  /** As teclas, ja como o jogador as ve na tampa. */
  caps: readonly string[];
  label: MessageKey;
  /** Este comando tem radial de recarga? */
  cooldown: boolean;
};

/**
 * A LISTA, na ordem de leitura da barra.
 *
 * Movimento e tiro primeiro porque sao o que o jogador ja esta fazendo quando
 * olha para baixo pela primeira vez; esquiva e habilidade no MEIO, que e o
 * lugar de maior atencao numa faixa horizontal, porque sao os dois que mudam de
 * estado; purga, interacao e menu no fim, onde ficam as coisas que se procura
 * de proposito em vez de conferir de relance.
 *
 * As teclas repetem `input.ts` a letra. Um mapa proprio aqui seria uma segunda
 * verdade sobre o teclado, e a primeira vez que ela mentisse seria justamente
 * na tela que existe para ensinar.
 */
export const DESKTOP_CONTROLS: readonly DesktopControl[] = [
  { id: 'move', caps: ['W', 'A', 'S', 'D'], label: 'controls.move', cooldown: false },
  { id: 'fire', caps: ['LMB'], label: 'controls.fire', cooldown: false },
  { id: 'dodge', caps: ['SPACE'], label: 'controls.dodge', cooldown: true },
  { id: 'ability', caps: ['Q'], label: 'controls.ability', cooldown: true },
  { id: 'purge', caps: ['F'], label: 'controls.purge', cooldown: false },
  { id: 'interact', caps: ['E'], label: 'controls.interact', cooldown: false },
  { id: 'menu', caps: ['ESC'], label: 'controls.menu', cooldown: false },
];

export type ControlSlot = {
  control: DesktopControl;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ControlBarLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  slots: ControlSlot[];
};

/** Altura da faixa, em pixels. Uma linha de tampa mais uma de rotulo. */
const BAR_HEIGHT = 40;
/** Folga entre a faixa e a borda de baixo da area segura. */
const BAR_BOTTOM_GAP = 12;
const SLOT_GAP = 6;
const SLOT_PADDING = 10;

/** Avanco de um caractere da fonte do rotulo (8px monoespacada), em pixels. */
const LABEL_CHAR_PX = 5;
/** Avanco de um caractere da tampa (9px monoespacada, negrito). */
const CAP_CHAR_PX = 6.2;
/** Folga interna de uma tampa, dos dois lados. */
const CAP_PADDING = 10;

/**
 * Largura de um compartimento: o que for mais largo, as tampas ou o rotulo.
 *
 * Medida em CARACTERES e nao com `measureText`: o layout e puro — o teste roda
 * sem canvas — e as duas fontes sao monoespacadas, entao contar caractere e
 * exato a menos de um arredondamento.
 *
 * O ROTULO vem RESOLVIDO de fora, e nao da chave de i18n. A primeira versao
 * media `control.label`, que e a CHAVE (`'controls.interact'`, 17 caracteres) —
 * um numero que nao tem relacao nenhuma com o texto desenhado. Em portugues
 * "HABILIDADE" ja estourava, e o compartimento da habilidade mostra o nome da
 * habilidade EQUIPADA ("PULSO CINETICO"), que o layout nao teria como adivinhar
 * a partir de chave nenhuma. O resultado era rotulo cortado com reticencias e
 * vazando por cima do compartimento vizinho.
 */
const slotWidth = (control: DesktopControl, label: string): number => {
  const caps =
    control.caps.reduce((sum, cap) => sum + cap.length * CAP_CHAR_PX + CAP_PADDING, 0) +
    (control.caps.length - 1) * 4;
  return Math.max(52, Math.max(caps, label.length * LABEL_CHAR_PX) + SLOT_PADDING * 2);
};

/**
 * Onde cada compartimento cai, dado o tamanho da janela.
 *
 * Centralizada embaixo: e a unica regiao da tela que nao disputa com nada — o
 * painel de vida esta em cima a esquerda, as mensagens no terco de cima, e o
 * personagem no centro. Numa janela estreita a barra ENCOLHE por escala em vez
 * de quebrar em duas linhas: duas linhas roubariam altura de jogo, e a faixa
 * inteira e legivel a 80% sem virar outra coisa.
 */
export const controlBarLayout = (
  controls: readonly DesktopControl[],
  viewportWidth: number,
  viewportHeight: number,
  safeBottom = 0,
  /**
   * O texto REALMENTE desenhado em cada compartimento. Sem ele o layout cai no
   * rotulo traduzido da lista, que e o certo para todos menos a habilidade —
   * aquele mostra o nome do Eco equipado, que so quem tem o estado sabe.
   */
  labelOf: (control: DesktopControl) => string = (control) => t(control.label),
): ControlBarLayout => {
  const labels = controls.map(labelOf);
  const widths = controls.map((control, i) => slotWidth(control, labels[i]));
  const natural = widths.reduce((sum, w) => sum + w, 0) + Math.max(0, controls.length - 1) * SLOT_GAP;
  const available = Math.max(120, viewportWidth - 32);
  const scale = Math.min(1, available / natural);
  const w = natural * scale;
  const h = BAR_HEIGHT * scale;
  const x = (viewportWidth - w) / 2;
  const y = viewportHeight - safeBottom - BAR_BOTTOM_GAP - h;

  const slots: ControlSlot[] = [];
  let cursor = x;
  controls.forEach((control, i) => {
    const slotW = widths[i] * scale;
    slots.push({ control, x: cursor, y, w: slotW, h });
    cursor += slotW + SLOT_GAP * scale;
  });
  return { x, y, w, h, slots };
};

/**
 * Quanto da faixa esta ACESO, dado ha quanto tempo a run comecou.
 *
 * A barra e permanente, e permanente so funciona se ela souber sumir do caminho.
 * Nos primeiros segundos ela entra cheia — e o momento em que o jogador acabou
 * de cair no setor e ainda esta procurando o que fazer — e depois assenta no
 * repouso, de onde volta sozinha sempre que uma recarga esta correndo.
 *
 * Pura para o teste conferir as duas pontas sem relogio de verdade.
 */
export const controlBarEmphasis = (elapsedMs: number): number => {
  const HOLD_MS = 6000;
  const FADE_MS = 2500;
  if (elapsedMs <= HOLD_MS) return 1;
  const t = Math.min(1, (elapsedMs - HOLD_MS) / FADE_MS);
  return 1 - t * (1 - RESTING_EMPHASIS);
};

/** Opacidade da faixa em repouso: legivel de canto de olho, nunca competindo. */
const RESTING_EMPHASIS = 0.45;

const PANEL = 'rgba(11,14,20,0.72)';
const EDGE = 'rgba(232,241,255,0.22)';
const CAP_FACE = 'rgba(232,241,255,0.10)';
const CAP_TEXT = '#e8f1ff';
const LABEL_TEXT = 'rgba(232,241,255,0.62)';
/** Tampa apertada AGORA: o mesmo ambar que o toque usa no botao pressionado. */
const CAP_PRESSED = '#ffd166';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * A barra, com a memoria minima que a recarga online exige.
 *
 * O estado de PREDICAO existe pela mesma razao que no radial de toque: no co-op
 * o snapshot com os timers privados chega um ida-e-volta depois do aperto, e sem
 * previsao a barra anunciaria a esquiva pronta no instante em que o servidor
 * acabou de cobra-la. As funcoes que decidem sao as mesmas — so o estado e
 * proprio, porque as duas interfaces nunca estao na tela ao mesmo tempo.
 */
export class DesktopControlBar {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly predictedReadyAt = new Map<DesktopCooldownId, number>();
  private readonly seenPressSeq: Record<DesktopCooldownId, number> = { dodge: 0, ability: 0 };
  private readonly readyPulseUntil = new Map<DesktopCooldownId, number>();
  private readonly cooling = new Set<DesktopCooldownId>();
  private lastState: SurvivalState | null = null;
  /** Relogio em que a run atual apareceu — a origem do realce de entrada. */
  private startedAtMs = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponivel para a barra de comandos.');
    this.ctx = ctx;
  }

  /** Descarta previsao e realce. Chamado quando o estado troca de identidade. */
  reset(input: InputState, nowMs: number): void {
    this.predictedReadyAt.clear();
    this.readyPulseUntil.clear();
    this.cooling.clear();
    this.seenPressSeq.dodge = input.actionPressSeq.dodge;
    this.seenPressSeq.ability = input.actionPressSeq.ability;
    this.startedAtMs = nowMs;
  }

  render(
    state: SurvivalState,
    input: InputState,
    nowMs: number,
    viewportWidth: number,
    viewportHeight: number,
    safeBottom: number,
  ): void {
    // O toque tem os proprios botoes. Desenhar os dois seria ensinar duas
    // linguas para a mesma mao.
    if (input.usingTouch) return;
    const ctx = this.ctx;
    if (state !== this.lastState) {
      this.reset(input, nowMs);
      this.lastState = state;
    }

    // O rotulo da HABILIDADE e o nome do Eco equipado, e nao a palavra
    // "habilidade": o jogador troca de Eco no poco e a barra tem de dizer o que
    // ele acabou de equipar. Resolvido AQUI e passado ao layout para a largura
    // do compartimento casar com o texto que vai ser desenhado nele.
    const labelOf = (control: DesktopControl): string =>
      control.id === 'ability'
        ? abilityPresentation(state.playerExtra.ability).label
        : t(control.label);
    const layout = controlBarLayout(
      DESKTOP_CONTROLS,
      viewportWidth,
      viewportHeight,
      safeBottom,
      labelOf,
    );
    const scale = layout.h / BAR_HEIGHT;
    const cooldowns = this.sampleCooldowns(state, input, nowMs);
    // Recarga correndo REACENDE a barra: e exatamente quando ela tem algo a
    // dizer, e esperar o jogador lembrar de olhar para um sussurro seria
    // devolver o problema que ela veio resolver.
    const busy = [...cooldowns.values()].some((cd) => cd.remaining > 0);
    const emphasis = Math.max(
      busy ? 0.92 : 0,
      controlBarEmphasis(nowMs - this.startedAtMs),
    );

    ctx.save();
    ctx.globalAlpha = emphasis;
    ctx.textBaseline = 'alphabetic';

    for (const slot of layout.slots) {
      const cd = cooldowns.get(slot.control.id as DesktopCooldownId);
      this.drawSlot(ctx, slot, scale, cd, input, nowMs, state, labelOf(slot.control));
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  /**
   * As duas recargas do quadro, ja resolvidas contra a previsao.
   *
   * Devolve `remaining` em fracao (1 = acabou de usar) e a duracao em ticks,
   * que e o que o desenho precisa para o preenchimento e para os segundos.
   */
  private sampleCooldowns(
    state: SurvivalState,
    input: InputState,
    nowMs: number,
  ): Map<DesktopCooldownId, { remaining: number; duration: number; accent: string }> {
    const out = new Map<DesktopCooldownId, { remaining: number; duration: number; accent: string }>();
    if (state.phase !== 'running') {
      this.seenPressSeq.dodge = input.actionPressSeq.dodge;
      this.seenPressSeq.ability = input.actionPressSeq.ability;
      return out;
    }
    const tick = state.tick;
    const mode = cooldownModeForState(state);
    const specs: Array<{
      id: DesktopCooldownId;
      duration: number;
      readyAt: number;
      accent: string;
    }> = [
      {
        id: 'dodge',
        duration: state.config.tuning.dodgeCooldownTicks,
        readyAt: state.playerExtra.dodgeCooldownUntil,
        accent: '#e8f1ff',
      },
      {
        id: 'ability',
        duration: abilityCooldownDurationTicks(state),
        readyAt: abilityReadyAtTick(state),
        accent: abilityPresentation(state.playerExtra.ability).color,
      },
    ];

    for (const spec of specs) {
      const pressSeq = input.actionPressSeq[spec.id];
      const pressChanged = pressSeq !== this.seenPressSeq[spec.id];
      this.seenPressSeq[spec.id] = pressSeq;
      const readyAt = resolveCooldownReadyAt(
        mode,
        spec.readyAt,
        this.predictedReadyAt.get(spec.id) ?? 0,
        pressChanged,
        tick,
        spec.duration,
      );
      if (mode === 'predicted' && readyAt > spec.readyAt && readyAt > tick) {
        this.predictedReadyAt.set(spec.id, readyAt);
      } else {
        this.predictedReadyAt.delete(spec.id);
      }
      const remaining = cooldownRemainingFraction(readyAt, tick, spec.duration);
      if (remaining > 0) this.cooling.add(spec.id);
      else if (this.cooling.delete(spec.id)) this.readyPulseUntil.set(spec.id, nowMs + 260);
      out.set(spec.id, { remaining, duration: spec.duration, accent: spec.accent });
    }
    return out;
  }

  private drawSlot(
    ctx: CanvasRenderingContext2D,
    slot: ControlSlot,
    scale: number,
    cd: { remaining: number; duration: number; accent: string } | undefined,
    input: InputState,
    nowMs: number,
    state: SurvivalState,
    label: string,
  ): void {
    const { control, x, y, w, h } = slot;
    const radius = 6 * scale;

    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = PANEL;
    ctx.fill();

    // O PREENCHIMENTO da recarga sobe pelo compartimento inteiro, da esquerda
    // para a direita, e nao num arco: numa faixa horizontal a leitura de
    // progresso ja e horizontal, e um radial minusculo aqui seria um relogio
    // que ninguem consegue ler de relance no meio de uma luta.
    if (cd && cd.remaining > 0) {
      ctx.save();
      ctx.beginPath();
      roundedRect(ctx, x, y, w, h, radius);
      ctx.clip();
      ctx.fillStyle = 'rgba(11,14,20,0.55)';
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = cd.accent;
      ctx.fillRect(x, y, w * (1 - cd.remaining), h);
      ctx.restore();
    }

    ctx.beginPath();
    roundedRect(ctx, x, y, w, h, radius);
    ctx.strokeStyle = cd && cd.remaining > 0 ? withAlpha(cd.accent, 0.42) : EDGE;
    ctx.lineWidth = Math.max(1, 1.1 * scale);
    ctx.stroke();

    // Pulso do "voltou": um contorno que se abre e apaga. E o unico aviso ATIVO
    // da barra, e existe porque o instante em que a esquiva volta e o unico em
    // que o jogador precisa saber sem ter perguntado.
    const pulseUntil = this.readyPulseUntil.get(control.id as DesktopCooldownId) ?? 0;
    if (pulseUntil > nowMs) {
      const progress = 1 - (pulseUntil - nowMs) / 260;
      const eased = 1 - (1 - clamp01(progress)) ** 3;
      ctx.save();
      ctx.globalAlpha *= 1 - eased;
      ctx.strokeStyle = cd?.accent ?? CAP_TEXT;
      ctx.lineWidth = Math.max(1, 1.6 * scale);
      ctx.beginPath();
      roundedRect(ctx, x - eased * 4, y - eased * 4, w + eased * 8, h + eased * 8, radius + eased * 3);
      ctx.stroke();
      ctx.restore();
    } else if (pulseUntil > 0) {
      this.readyPulseUntil.delete(control.id as DesktopCooldownId);
    }

    // TAMPAS. Cada tecla e um retangulo proprio: um `W A S D` corrido leria como
    // palavra, e quatro tampas leem como quatro teclas.
    const pressed = this.isPressed(control.id, input, state);
    const capH = 14 * scale;
    const capY = y + 5 * scale;
    const capFont = Math.max(7, Math.round(9 * scale));
    ctx.font = `bold ${capFont}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    const capWidths = control.caps.map((cap) => (cap.length * 8 + 12) * scale);
    const capsTotal = capWidths.reduce((sum, cw) => sum + cw, 0) + (control.caps.length - 1) * 4 * scale;
    let capX = x + (w - capsTotal) / 2;
    control.caps.forEach((cap, i) => {
      const cw = capWidths[i];
      ctx.beginPath();
      roundedRect(ctx, capX, capY, cw, capH, 3 * scale);
      ctx.fillStyle = pressed ? withAlpha(CAP_PRESSED, 0.32) : CAP_FACE;
      ctx.fill();
      ctx.strokeStyle = pressed ? withAlpha(CAP_PRESSED, 0.85) : EDGE;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = pressed ? CAP_PRESSED : CAP_TEXT;
      ctx.fillText(cap, capX + cw / 2, capY + capH - 4 * scale);
      capX += cw + 4 * scale;
    });

    // ROTULO, ja resolvido pelo chamador — e a MESMA string que dimensionou o
    // compartimento, que e a unica forma de a largura e o texto concordarem.
    const labelFont = Math.max(6, Math.round(8 * scale));
    ctx.font = `${labelFont}px ui-monospace, monospace`;
    ctx.fillStyle = control.id === 'ability' && cd ? withAlpha(cd.accent, 0.78) : LABEL_TEXT;
    ctx.fillText(fitText(ctx, label, w - 6 * scale), x + w / 2, y + h - 5 * scale);

    // Os SEGUNDOS que faltam, so quando ha pelo menos um: abaixo disso o numero
    // pisca uma vez e some, o que le como falha de desenho e nao como contagem.
    if (cd && cd.remaining > 0) {
      const seconds = (cd.remaining * cd.duration) / TICK_HZ;
      if (seconds >= 0.95) {
        ctx.font = `bold ${Math.max(8, Math.round(10 * scale))}px ui-monospace, monospace`;
        ctx.fillStyle = withAlpha(cd.accent, 0.95);
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.ceil(seconds)}`, x + w - 4 * scale, y + h - 5 * scale);
        ctx.textAlign = 'center';
      }
    }
  }

  /**
   * A tecla esta apertada AGORA?
   *
   * Nem toda tecla e observavel: `SurvivalInput` guarda o teclado privado e so
   * publica o que a simulacao precisa. O que da para responder com honestidade —
   * o gatilho pelo `firing`, esquiva e habilidade pela janela em que a acao
   * acabou de sair — e respondido; o resto fica sem realce, porque um realce que
   * as vezes acende e as vezes nao seria pior do que nenhum.
   */
  private isPressed(id: DesktopControlId, input: InputState, state: SurvivalState): boolean {
    if (id === 'fire') return input.firing;
    if (id === 'dodge') return state.playerExtra.dodgeUntil > state.tick;
    return false;
  }
}

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
};

/** `#rrggbb` com opacidade. A paleta e publicada em hex; o canvas quer rgba. */
const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
};

/**
 * Corta o rotulo com reticencias quando ele nao cabe.
 *
 * Nomes de habilidade sao compostos ("SOPRO TERMICO", "DRONE RASTREADOR") e a
 * barra encolhe em janela estreita: sem o corte, o texto vaza para os
 * compartimentos vizinhos e derruba a leitura dos dois.
 */
const fitText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
};
