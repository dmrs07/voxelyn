// A GEOMETRIA da barra de vida dos chefes, sem Canvas.
//
// A barra e a unica peca de HUD que vive no RODAPE e atravessa a tela — e o
// rodape e onde moram os manches e os botoes de toque, a barra de comandos do
// teclado e a area segura do aparelho. Ela tem prioridade alta, mas prioridade
// nunca significa cobrir um input: um manche embaixo de uma moldura e um
// jogador que nao consegue andar. Entao a posicao e RESOLVIDA aqui, pela
// viewport, pela area segura e pelo que ja ocupa o rodape, e o render so
// desenha nos numeros que saem.
//
// Tres posturas, uma geometria:
//
//   DESKTOP     — centralizada, 66% da largura ate 860 px, acima da barra de
//                 comandos. E a postura monumental: a moldura inteira, as
//                 terminacoes em degraus, o nome em 18 px.
//   PAISAGEM    — na FAIXA LIVRE entre o manche de movimento e o grupo de
//   (toque)       botoes da direita, na linha dos manches. E mais estreita do
//                 que a direcao pede, porque a faixa e o que ha: os ornamentos
//                 encolhem antes da vida.
//   RETRATO     — quase a largura inteira, ACIMA da faixa dos controles.
//   (toque)
//
// Toda saida e inteira. A moldura e desenhada em retangulos de pixel, e meio
// pixel em qualquer coordenada borra a peca inteira.

import { hudScale } from './hud-layout';
import type { HudRect } from './hud-layout';
import type { SafeInsets } from './module-layout';
import { touchControlGeometry } from './input';
import { DESKTOP_CONTROL_BAR_RESERVE } from './desktop-controls';

export type BossHealthBarOrnament = 'full' | 'reduced' | 'none';

export type BossHealthBarLayoutInput = {
  viewportWidth: number;
  viewportHeight: number;
  safe: SafeInsets;
  /** Os controles de toque estao na tela (ver `InputState.usingTouch`). */
  touchMode: boolean;
  /**
   * O retangulo do painel de status, quando conhecido. So importa em telas
   * muito baixas: se a peca subir ate ele, ela recua para a DIREITA do painel
   * (encolhendo) em vez de cobrir o HP do jogador — a leitura que mais importa.
   */
  hudPanel?: HudRect | null;
};

export type BossHealthBarLayout = {
  visible: boolean;
  /** A escala da HUD (ver `hudScale`); a barra herda o ritmo do painel. */
  scale: number;
  orientation: 'landscape' | 'portrait';
  ornament: BossHealthBarOrnament;
  /** O retangulo INTEIRO da peca — nome, moldura e terminacoes. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** A moldura escura, sem as terminacoes. */
  frame: HudRect;
  /** O leito quase preto onde a vida corre — a regiao util de HP. */
  bed: HudRect;
  /** Largura de cada terminacao voxel, fora da moldura (0 = sem terminacao). */
  endCap: number;
  /** Espessura da moldura em volta do leito. */
  framePad: { x: number; y: number };
  name: {
    x: number;
    baseline: number;
    fontPx: number;
    /** Largura em que o nome cabe (alinhado ao inicio do leito). */
    maxWidth: number;
  };
  /** A pequena linha de acento material sob o nome. */
  accent: HudRect;
};

const MARGIN = 12;
const MIN_WIDTH = 96;
/** Folga entre a moldura e o que esta abaixo dela. */
const BOTTOM_GAP = 16;

const round = Math.round;

const hidden = (scale: number, orientation: 'landscape' | 'portrait'): BossHealthBarLayout => ({
  visible: false,
  scale,
  orientation,
  ornament: 'none',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  frame: { x: 0, y: 0, width: 0, height: 0 },
  bed: { x: 0, y: 0, width: 0, height: 0 },
  endCap: 0,
  framePad: { x: 0, y: 0 },
  name: { x: 0, baseline: 0, fontPx: 0, maxWidth: 0 },
  accent: { x: 0, y: 0, width: 0, height: 0 },
});

type Rhythm = {
  lifeH: number;
  fontPx: number;
  ornament: BossHealthBarOrnament;
};

const rhythmFor = (
  ornament: BossHealthBarOrnament,
  posture: 'desktop' | 'landscape' | 'portrait',
  scale: number,
): Rhythm => {
  if (posture === 'desktop') {
    return { lifeH: scale < 1 ? 10 : 13, fontPx: scale < 1 ? 16 : 18, ornament };
  }
  if (posture === 'landscape') return { lifeH: 9, fontPx: 13, ornament };
  return { lifeH: 10, fontPx: 14, ornament };
};

const ORNAMENT_PAD: Record<BossHealthBarOrnament, { x: number; y: number; cap: number }> = {
  full: { x: 4, y: 4, cap: 6 },
  reduced: { x: 3, y: 2, cap: 4 },
  none: { x: 2, y: 2, cap: 0 },
};

/**
 * Monta a peca a partir do CENTRO horizontal, da borda INFERIOR da moldura e
 * da largura total; o resto e derivado.
 */
const assemble = (
  centerX: number,
  frameBottom: number,
  totalWidth: number,
  rhythm: Rhythm,
  scale: number,
  orientation: 'landscape' | 'portrait',
): BossHealthBarLayout => {
  const pad = ORNAMENT_PAD[rhythm.ornament];
  const width = round(totalWidth);
  if (width < MIN_WIDTH) return hidden(scale, orientation);
  const endCap = pad.cap;
  const frameW = width - endCap * 2;
  const frameH = rhythm.lifeH + pad.y * 2;
  const frameX = round(centerX - frameW / 2);
  const frameY = round(frameBottom) - frameH;
  const bed: HudRect = {
    x: frameX + pad.x,
    y: frameY + pad.y,
    width: frameW - pad.x * 2,
    height: rhythm.lifeH,
  };
  const nameGap = rhythm.ornament === 'none' ? 6 : 9;
  const accentH = rhythm.ornament === 'none' ? 1 : 2;
  const accent: HudRect = {
    x: bed.x,
    y: frameY - accentH - 2,
    width: Math.min(bed.width, rhythm.ornament === 'full' ? 28 : 20),
    height: accentH,
  };
  const baseline = accent.y - (nameGap - 3);
  const nameTop = baseline - rhythm.fontPx;
  const x = frameX - endCap;
  const y = nameTop;
  return {
    visible: true,
    scale,
    orientation,
    ornament: rhythm.ornament,
    x,
    y,
    width,
    height: frameY + frameH - y,
    frame: { x: frameX, y: frameY, width: frameW, height: frameH },
    bed,
    endCap,
    framePad: { x: pad.x, y: pad.y },
    name: { x: bed.x, baseline, fontPx: rhythm.fontPx, maxWidth: bed.width },
    accent,
  };
};

/**
 * A largura MONUMENTAL, no desktop: dois tercos da tela, presa em 860 px.
 * Em 1366 sao 860 (63%); em 1920 continuam 860 — a barra nao cresce com o
 * monitor porque o que ela mede nao e a tela, e a sala.
 */
export const bossHealthBarDesktopWidth = (viewportWidth: number): number =>
  Math.min(860, round(viewportWidth * 0.66));

export const bossHealthBarLayout = (input: BossHealthBarLayoutInput): BossHealthBarLayout => {
  const vw = input.viewportWidth;
  const vh = input.viewportHeight;
  const safe = input.safe;
  const scale = hudScale(vw, vh);
  const orientation: 'landscape' | 'portrait' = vh > vw ? 'portrait' : 'landscape';
  if (vw < 200 || vh < 140) return hidden(scale, orientation);

  const usableLeft = safe.left + MARGIN;
  const usableRight = vw - safe.right - MARGIN;
  const usableWidth = usableRight - usableLeft;
  if (usableWidth < MIN_WIDTH) return hidden(scale, orientation);

  if (!input.touchMode) {
    // DESKTOP: acima da barra de comandos, centralizada na tela util.
    const ornament: BossHealthBarOrnament = vh < 480 ? 'reduced' : 'full';
    const rhythm = rhythmFor(ornament, 'desktop', scale);
    const width = Math.min(bossHealthBarDesktopWidth(vw), usableWidth);
    const frameBottom = vh - safe.bottom - DESKTOP_CONTROL_BAR_RESERVE - BOTTOM_GAP;
    return avoidPanel(
      (left) =>
        assemble(
          (left + usableRight) / 2,
          frameBottom,
          Math.min(width, usableRight - left),
          rhythm,
          scale,
          orientation,
        ),
      usableLeft,
      input.hudPanel,
    );
  }

  const g = touchControlGeometry(vw, vh, safe);

  if (orientation === 'portrait') {
    // RETRATO: quase a largura inteira, acima da faixa dos controles.
    const rhythm = rhythmFor(usableWidth < 300 ? 'reduced' : 'full', 'portrait', scale);
    const frameBottom = g.top - MARGIN;
    return avoidPanel(
      (left) =>
        assemble(
          (left + usableRight) / 2,
          frameBottom,
          Math.min(usableRight - left, round(vw * 0.94)),
          rhythm,
          scale,
          orientation,
        ),
      usableLeft,
      input.hudPanel,
    );
  }

  // PAISAGEM: a faixa livre entre os controles, na linha dos manches.
  const laneLeft = Math.max(usableLeft, g.laneLeft + 6);
  const laneRight = Math.min(usableRight, g.laneRight - 6);
  const laneWidth = laneRight - laneLeft;
  if (laneWidth >= 140) {
    const ornament: BossHealthBarOrnament = laneWidth >= 260 ? 'full' : 'reduced';
    const rhythm = rhythmFor(ornament, 'landscape', scale);
    const width = Math.min(laneWidth, round(vw * 0.68));
    // A moldura CENTRADA na altura dos manches: a barra e mais uma peca da
    // fileira do rodape, nao um painel flutuando sobre eles.
    const frameH = rhythm.lifeH + ORNAMENT_PAD[ornament].y * 2;
    const frameBottom = round(g.aimY + frameH / 2);
    return assemble((laneLeft + laneRight) / 2, frameBottom, width, rhythm, scale, orientation);
  }
  // Faixa estreita demais (tela minuscula): sobe para cima dos controles, sem
  // terminacoes, e ainda assim inteira e legivel.
  const rhythm = rhythmFor('none', 'landscape', scale);
  const frameBottom = g.top - 8;
  return avoidPanel(
    (left) =>
      assemble(
        (left + usableRight) / 2,
        frameBottom,
        Math.min(usableRight - left, round(vw * 0.68)),
        rhythm,
        scale,
        orientation,
      ),
    usableLeft,
    input.hudPanel,
  );
};

/**
 * A barra nunca cobre o painel de status. Monta uma vez; se a peca tocar o
 * painel (tela muito baixa), monta de novo comecando a direita dele — e se
 * nem assim couber, e melhor nenhuma barra do que uma por cima do HP do
 * jogador.
 */
const avoidPanel = (
  build: (usableLeft: number) => BossHealthBarLayout,
  usableLeft: number,
  panel: HudRect | null | undefined,
): BossHealthBarLayout => {
  const first = build(usableLeft);
  if (!first.visible || !panel || !rectsOverlap(first, panel)) return first;
  return build(Math.max(usableLeft, panel.x + panel.width + 8));
};

/** Dois retangulos se tocam? Para os testes de "nao cobre um controle". */
export const rectsOverlap = (a: HudRect, b: HudRect): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
