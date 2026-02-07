import type { GameState, PowerUpId } from '../game/types';
import { countAliveEnemies, getPlayer } from '../game/state';

export const HUD_HEIGHT = 96;

const POWER_ICON: Record<PowerUpId, { label: string; color: string }> = {
  vital_boost: { label: 'V', color: '#6fe08f' },
  attack_boost: { label: 'A', color: '#ff8a78' },
  swift_boots: { label: 'S', color: '#8db7ff' },
  iron_skin: { label: 'I', color: '#c8b7a0' },
  vampiric_spores: { label: 'P', color: '#d988ff' },
  fungal_regen: { label: 'R', color: '#89f5b9' },
};

const ellipsizeText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string => {
  if (maxWidth <= 8) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '...';
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}${ellipsis}`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}${ellipsis}`;
};

const drawClampedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number
): void => {
  ctx.fillText(ellipsizeText(ctx, text, maxWidth), x, y);
};

export const drawHud = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const player = getPlayer(state);
  if (!player) return;

  const enemies = countAliveEnemies(state);
  const width = ctx.canvas.width;
  const padding = 14;
  const hpPanelWidth = Math.min(340, Math.max(268, Math.floor(width * 0.3)));
  const rightX = width - padding - hpPanelWidth;
  const centerX = Math.max(
    padding + 170,
    Math.min(padding + 260, rightX - 220)
  );
  const leftTextMax = Math.max(120, centerX - padding - 10);
  const centerTextMax = Math.max(110, rightX - centerX - 10);
  const rightTextMax = Math.max(120, hpPanelWidth - 14);

  const hpRatio = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));
  const now = state.simTimeMs;
  const slowMs = Math.max(0, state.activeDebuffs.slowUntilMs - now);
  const crystalMs = Math.max(0, state.activeDebuffs.crystalBuffUntilMs - now);
  const activeCorridorEvents = state.level.corridorEvents.filter((event) => event.activeUntilMs > now).length;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(12,20,32,0.9)';
  ctx.fillRect(0, 0, width, HUD_HEIGHT);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#dfe7ff';
  drawClampedText(ctx, `Andar ${state.floorNumber}/10`, padding, 24, leftTextMax);
  drawClampedText(ctx, `Inimigos ${enemies}`, padding, 44, leftTextMax);
  drawClampedText(
    ctx,
    `ATK ${player.attack.toFixed(0)} | DEF ${player.damageReduction.toFixed(0)}`,
    padding,
    64,
    leftTextMax
  );
  drawClampedText(
    ctx,
    `Eventos ${activeCorridorEvents} | Recuperacoes ${state.pathRecovery.forcedOpenCount}`,
    padding,
    84,
    leftTextMax
  );

  ctx.fillStyle = 'rgba(34,42,58,1)';
  ctx.fillRect(rightX, 14, hpPanelWidth, 24);
  ctx.fillStyle = '#7a2727';
  ctx.fillRect(rightX + 4, 18, hpPanelWidth - 8, 16);
  ctx.fillStyle = '#6fe08f';
  ctx.fillRect(rightX + 4, 18, Math.floor((hpPanelWidth - 8) * hpRatio), 16);
  ctx.fillStyle = '#0b1018';
  ctx.font = 'bold 13px monospace';
  drawClampedText(ctx, `HP ${Math.ceil(player.hp)}/${player.maxHp}`, rightX + 16, 31, rightTextMax);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#9bb1d8';
  const hint =
    state.phase === 'powerup_choice'
      ? 'Escolha: tecla 1 ou 2'
      : 'Mover: WASD/Setas | Objetivo: achar Saida/Nucleo';
  drawClampedText(ctx, hint, rightX, 56, rightTextMax);

  const statusParts: string[] = [];
  if (slowMs > 0) statusParts.push(`LENTO ${Math.ceil(slowMs / 1000)}s`);
  if (crystalMs > 0) statusParts.push(`CRISTAL ${Math.ceil(crystalMs / 1000)}s`);
  if (statusParts.length > 0) {
    ctx.fillStyle = '#9ef3bf';
    drawClampedText(ctx, statusParts.join(' | '), rightX, 74, rightTextMax);
  } else {
    const recent = state.messages[state.messages.length - 1] ?? '';
    if (recent.length > 0) {
      ctx.fillStyle = '#c9d7f6';
      drawClampedText(ctx, recent, rightX, 74, rightTextMax);
    }
  }

  // Power-up strip
  const iconY = 68;
  let iconX = centerX;
  const iconMaxX = rightX - 20;
  const uniquePowerups = Array.from(new Set(player.powerUps)).slice(-8);
  for (const power of uniquePowerups) {
    const icon = POWER_ICON[power];
    if (!icon) continue;
    if (iconX + 16 > iconMaxX) break;
    ctx.fillStyle = 'rgba(24,32,48,0.95)';
    ctx.fillRect(iconX, iconY - 12, 16, 16);
    ctx.strokeStyle = icon.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(iconX, iconY - 12, 16, 16);
    ctx.fillStyle = icon.color;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(icon.label, iconX + 4, iconY);
    iconX += 20;
  }

  const activeAlerts = state.uiAlerts
    .filter((item) => item.untilMs > now)
    .slice(-2);
  let alertY = 18;
  for (const alert of activeAlerts) {
    ctx.fillStyle =
      alert.tone === 'warn'
        ? 'rgba(245,142,122,0.95)'
        : alert.tone === 'buff'
          ? 'rgba(138,244,178,0.95)'
          : 'rgba(172,208,255,0.95)';
    ctx.font = 'bold 12px monospace';
    drawClampedText(ctx, alert.text, centerX, alertY, centerTextMax);
    alertY += 16;
  }

  ctx.restore();
};
