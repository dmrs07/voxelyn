// Camada de apresentação dos Ecos do Veio.
//
// A etapa local é instalada como um decorador explícito do renderer antes de
// `main.ts` carregar. O decorador observa o estado que o renderer já recebeu e
// desenha imediatamente antes da HUD; não existe segundo loop, segundo relógio
// ou cópia da simulação.

import type { InputState } from './input';
import { describeCause } from './run-summary';
import { TILE_H, TILE_W, SurvivalRenderer } from './render';
import type { SurvivalState } from '@voxelyn/survival-sim';
import {
  applyDeathEchoOnce,
  loadDeathEchoRecords,
  projectDeathEchoes,
  saveDeathEchoRecords,
  type DeathEchoRecords,
  type PlacedDeathEcho,
} from './death-echoes';

const INSTALLED = Symbol('voxelyn.deathEchoPresentation');
const READ_RADIUS = 4;
const PAL = {
  dark: '#0b0e14',
  rust: '#6e4a33',
  rockShadow: '#1d2430',
  player: '#e8f1ff',
  biolum: '#59f2c2',
  blood: '#d93b4c',
};

export type DeathEchoReadout = {
  title: string;
  headline: string;
};

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => ({
  title: `CAIXA-PRETA ${echo.id.split(':').at(-1)?.padStart(3, '0') ?? '---'}`,
  headline: describeCause(echo.cause).headline,
});

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

class DeathEchoPresentationRuntime {
  private records: DeathEchoRecords = loadDeathEchoRecords();
  private recordedIdentity: string | null = null;
  private terminal = false;
  private projectionKey = '';
  private placed: PlacedDeathEcho[] = [];

  sync(state: SurvivalState): void {
    if (state.phase !== 'running') {
      if (!this.terminal && state.phase === 'dead') {
        const result = applyDeathEchoOnce(this.records, state, this.recordedIdentity);
        this.recordedIdentity = result.identity;
        if (result.applied) {
          this.records = result.records;
          saveDeathEchoRecords(this.records);
        }
      }
      this.terminal = true;
      this.placed = [];
      this.projectionKey = '';
      return;
    }

    if (this.terminal) {
      // Fronteira de uma nova run: uma repetição honesta da mesma seed/tick pode
      // gerar outra cápsula, assim como o histórico principal aceita outra run.
      this.recordedIdentity = null;
      this.terminal = false;
    }

    const key = [
      state.config.seed,
      state.sector,
      state.config.width,
      state.config.height,
      this.records.nextSerial,
    ].join(':');
    if (key === this.projectionKey) return;
    this.projectionKey = key;
    this.placed = projectDeathEchoes(state, this.records);
  }

  draw(renderer: SurvivalRenderer, state: SurvivalState, nowMs: number, vw: number, vh: number): void {
    if (state.phase !== 'running' || this.placed.length === 0) return;
    const canvas = document.getElementById('game');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const z = renderer.zoom;
    const isoX = (x: number, y: number): number => (x - y) * (TILE_W / 2);
    const isoY = (x: number, y: number): number => (x + y) * (TILE_H / 2);
    const camX = isoX(state.player.x, state.player.y);
    const camY = isoY(state.player.x, state.player.y);
    const toScreen = (x: number, y: number): [number, number] => [
      (isoX(x, y) - camX) * z + vw / 2,
      (isoY(x, y) - camY) * z + vh / 2,
    ];

    ctx.save();
    for (const echo of this.placed) {
      const [sx, sy] = toScreen(echo.x, echo.y);
      if (sx < -80 || sx > vw + 80 || sy < -100 || sy > vh + 80) continue;
      this.drawBody(renderer, ctx, echo, sx, sy, z, nowMs);
      const distance = Math.hypot(state.player.x - echo.x, state.player.y - echo.y);
      if (distance <= READ_RADIUS) this.drawReadout(ctx, echo, sx, sy, z, vw);
    }
    ctx.restore();
  }

  private drawBody(
    renderer: SurvivalRenderer,
    ctx: CanvasRenderingContext2D,
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    nowMs: number,
  ): void {
    const size = 0.34 * TILE_W * 0.9 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const spriteZoom = Math.max(1, Math.round(z));
    const drew = renderer.sprites.drawEntity(
      ctx,
      'prospector',
      'die',
      echo.facingX,
      echo.facingY,
      10_000,
      sx,
      sy,
      spriteZoom,
      { color: 'rgba(110,74,51,0.62)', alpha: 0.62 },
    );
    if (!drew) {
      // Fallback baixo e horizontal: precisa ler como resto, nunca como uma
      // entidade ainda de pé enquanto o atlas carrega.
      ctx.fillStyle = PAL.rust;
      ctx.fillRect(sx - 9 * z, sy - 5 * z, 16 * z, 4 * z);
      ctx.fillStyle = PAL.rockShadow;
      ctx.fillRect(sx - 6 * z, sy - 8 * z, 7 * z, 4 * z);
      ctx.fillStyle = PAL.player;
      ctx.fillRect(sx - 5 * z, sy - 7 * z, 2 * z, z);
    }

    // A caixa-preta é a única parte ainda viva. O pulso é periódico, não
    // aleatório: dois clientes desenhariam a mesma cápsula no mesmo instante.
    const pulse = Math.sin(nowMs * 0.008 + echo.cell * 0.17) > -0.2;
    ctx.fillStyle = pulse ? PAL.biolum : PAL.rockShadow;
    ctx.fillRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
    ctx.strokeStyle = PAL.dark;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
  }

  private drawReadout(
    ctx: CanvasRenderingContext2D,
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    vw: number,
  ): void {
    const readout = deathEchoReadout(echo);
    const maxWidth = Math.min(360, vw - 28);
    const titleSize = Math.max(9, Math.round(6 * z));
    const bodySize = Math.max(10, Math.round(7 * z));
    ctx.font = `bold ${bodySize}px monospace`;
    const lines = wrapText(ctx, readout.headline.toUpperCase(), maxWidth - 24);
    const lineHeight = bodySize + 4;
    const boxHeight = 20 + titleSize + lines.length * lineHeight;
    const boxWidth = Math.min(
      maxWidth,
      Math.max(190, ...lines.map((line) => ctx.measureText(line).width + 24)),
    );
    const x = Math.max(14, Math.min(vw - boxWidth - 14, sx - boxWidth / 2));
    const y = Math.max(14, sy - 40 * z - boxHeight);

    ctx.fillStyle = 'rgba(11,14,20,0.92)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = PAL.biolum;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.biolum;
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText(readout.title, x + 12, y + 8);
    ctx.fillStyle = PAL.player;
    ctx.font = `bold ${bodySize}px monospace`;
    lines.forEach((line, index) => ctx.fillText(line, x + 12, y + 14 + titleSize + index * lineHeight));

    // Linha curta para distinguir lembrança local de um futuro sinal comunitário.
    ctx.fillStyle = echo.projection === 'exact' ? PAL.blood : PAL.rust;
    ctx.fillRect(x, y + boxHeight - 3, boxWidth, 3);
  }
}

type RendererPrototype = SurvivalRenderer & {
  renderHud: (state: SurvivalState, input: InputState, nowMs: number, vw: number, vh: number) => void;
  [INSTALLED]?: boolean;
};

const runtimes = new WeakMap<SurvivalRenderer, DeathEchoPresentationRuntime>();
const runtimeFor = (renderer: SurvivalRenderer): DeathEchoPresentationRuntime => {
  let runtime = runtimes.get(renderer);
  if (!runtime) {
    runtime = new DeathEchoPresentationRuntime();
    runtimes.set(renderer, runtime);
  }
  return runtime;
};

/** Instala uma única vez, antes de `main.ts` construir o renderer. */
export const installDeathEchoPresentation = (): void => {
  const prototype = SurvivalRenderer.prototype as RendererPrototype;
  if (prototype[INSTALLED]) return;
  prototype[INSTALLED] = true;

  const originalRender = prototype.render;
  prototype.render = function renderWithDeathEchoes(
    state: SurvivalState,
    alpha: number,
    input: InputState,
    nowMs: number,
  ): void {
    runtimeFor(this).sync(state);
    originalRender.call(this, state, alpha, input, nowMs);
  };

  const originalHud = prototype.renderHud;
  prototype.renderHud = function renderHudWithDeathEchoes(
    state: SurvivalState,
    input: InputState,
    nowMs: number,
    vw: number,
    vh: number,
  ): void {
    runtimeFor(this).draw(this, state, nowMs, vw, vh);
    originalHud.call(this, state, input, nowMs, vw, vh);
  };
};
