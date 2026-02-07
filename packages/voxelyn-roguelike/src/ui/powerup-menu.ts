import type { GameState } from '../game/types';
import { POWER_UP_POOL } from '../powerups/pool';

export const drawPowerUpMenu = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const choice = state.activePowerUpChoice;
  if (!choice) return;

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  const left = POWER_UP_POOL[choice.options[0]];
  const right = POWER_UP_POOL[choice.options[1]];

  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f0f4ff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Escolha seu Power-up', width / 2, Math.floor(height * 0.28));

  const cardW = 340;
  const cardH = 170;
  const gap = 48;
  const startX = Math.floor((width - cardW * 2 - gap) / 2);
  const y = Math.floor(height * 0.35);

  const drawCard = (x: number, option: typeof left, pick: 1 | 2): void => {
    ctx.fillStyle = 'rgba(24,33,52,0.96)';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = '#78a2ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardW, cardH);

    ctx.fillStyle = '#9ec0ff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`[${pick}] ${option.name}`, x + 16, y + 30);

    ctx.fillStyle = '#dce5ff';
    ctx.font = '13px monospace';
    const lines = wrapText(option.description, 40);
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i] ?? '', x + 16, y + 60 + i * 20);
    }
  };

  drawCard(startX, left, 1);
  drawCard(startX + cardW + gap, right, 2);

  ctx.fillStyle = '#9fb4db';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Jogo pausado ate voce escolher.', width / 2, y + cardH + 30);

  ctx.restore();
};

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
