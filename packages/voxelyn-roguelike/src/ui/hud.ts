import type { GameState, PowerUpId } from '../game/types';
import { countAliveEnemies, getPlayer } from '../game/state';

const POWER_ICON: Record<PowerUpId, { label: string; color: string }> = {
  vital_boost: { label: 'V', color: '#6fe08f' },
  attack_boost: { label: 'A', color: '#ff8a78' },
  swift_boots: { label: 'S', color: '#8db7ff' },
  iron_skin: { label: 'I', color: '#c8b7a0' },
  vampiric_spores: { label: 'P', color: '#d988ff' },
  fungal_regen: { label: 'R', color: '#89f5b9' },
};

export const drawHud = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const player = getPlayer(state);
  if (!player) return;

  const enemies = countAliveEnemies(state);
  const width = ctx.canvas.width;
  const hpRatio = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));

  ctx.save();
  ctx.fillStyle = 'rgba(12,20,32,0.9)';
  ctx.fillRect(0, 0, width, 86);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#dfe7ff';
  ctx.fillText(`Andar ${state.floorNumber}/10`, 14, 24);
  ctx.fillText(`Inimigos ${enemies}`, 14, 44);
  ctx.fillText(`ATK ${player.attack.toFixed(0)} | DEF ${player.damageReduction.toFixed(0)}`, 14, 64);

  ctx.fillStyle = 'rgba(34,42,58,1)';
  ctx.fillRect(width - 324, 14, 300, 24);
  ctx.fillStyle = '#7a2727';
  ctx.fillRect(width - 320, 18, 292, 16);
  ctx.fillStyle = '#6fe08f';
  ctx.fillRect(width - 320, 18, Math.floor(292 * hpRatio), 16);
  ctx.fillStyle = '#0b1018';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, width - 304, 31);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#9bb1d8';
  const hint =
    state.phase === 'powerup_choice'
      ? 'Escolha: tecla 1 ou 2'
      : 'Mover: WASD/Setas | Objetivo: achar Saida/Nucleo';
  ctx.fillText(hint, width - 324, 56);

  const recent = state.messages[state.messages.length - 1] ?? '';
  if (recent.length > 0) {
    ctx.fillStyle = '#c9d7f6';
    ctx.fillText(recent, width - 324, 74);
  }

  // Power-up strip
  const iconY = 68;
  let iconX = 260;
  const uniquePowerups = Array.from(new Set(player.powerUps)).slice(-8);
  for (const power of uniquePowerups) {
    const icon = POWER_ICON[power];
    if (!icon) continue;
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

  ctx.restore();
};
