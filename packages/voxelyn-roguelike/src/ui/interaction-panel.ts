import type { GameState } from '../game/types';

const wrapText = (text: string, maxChars: number): string[] => {
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (candidate.length > maxChars && line.length > 0) {
      out.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line.length > 0) out.push(line);
  return out;
};

const drawInspectOverlay = (ctx: CanvasRenderingContext2D, text: string): void => {
  const width = ctx.canvas.width;
  const padding = 12;
  const maxW = Math.min(460, width - padding * 2);
  const lines = wrapText(text, 48);
  const lineH = 16;
  const boxH = lines.length * lineH + 16;
  const boxW = maxW;
  const x = Math.floor((width - boxW) / 2);
  const y = Math.max(8, ctx.canvas.height - 120 - boxH);

  ctx.save();
  ctx.fillStyle = 'rgba(16, 22, 32, 0.88)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = 'rgba(120, 140, 180, 0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#e0e8f0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let ty = y + 8;
  for (const line of lines) {
    ctx.fillText(line, x + 10, ty);
    ty += lineH;
  }
  ctx.restore();
};

const drawTerminalModal = (ctx: CanvasRenderingContext2D, text: string): void => {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  ctx.fillStyle = 'rgba(6, 10, 18, 0.78)';
  ctx.fillRect(0, 0, width, height);

  const boxW = Math.min(520, Math.floor(width * 0.8));
  const lines = wrapText(text, 50);
  const lineH = 18;
  const contentH = lines.length * lineH;
  const boxH = contentH + 90;
  const x = Math.floor((width - boxW) / 2);
  const y = Math.floor((height - boxH) / 2);

  ctx.fillStyle = 'rgba(18, 26, 40, 0.95)';
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = 'rgba(120, 140, 180, 0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.fillStyle = '#e6edf9';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Terminal Quebrado', x + boxW / 2, y + 16);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#cdd8ee';
  let ty = y + 48;
  for (const line of lines) {
    ctx.fillText(line, x + boxW / 2, ty);
    ty += lineH;
  }

  const buttonW = 220;
  const buttonH = 36;
  const bx = Math.floor(x + (boxW - buttonW) / 2);
  const by = Math.floor(y + boxH - buttonH - 22);
  ctx.fillStyle = 'rgba(52, 80, 120, 0.9)';
  ctx.fillRect(bx, by, buttonW, buttonH);
  ctx.strokeStyle = 'rgba(140, 190, 255, 0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, buttonW, buttonH);
  ctx.fillStyle = '#e6f0ff';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Consertar (E/Clique)', bx + buttonW / 2, by + buttonH / 2);

  ctx.fillStyle = '#9fb4d8';
  ctx.font = '12px monospace';
  ctx.fillText('Esc para fechar', x + boxW / 2, y + boxH - 16);

  ctx.restore();
};

export const drawInteractionPanel = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  if (state.interactionModal?.kind === 'terminal_repair') {
    drawTerminalModal(ctx, state.interactionModal.text);
    return;
  }

  const inspect = state.inspectOverlay;
  if (inspect && inspect.untilMs > state.simTimeMs) {
    drawInspectOverlay(ctx, inspect.text);
  }
};
