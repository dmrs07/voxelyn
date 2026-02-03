import type { GameState } from '../game/types';
import { countAliveEnemies, getPlayer } from '../game/state';

export const drawHud = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const player = getPlayer(state);
  if (!player) return;

  const enemies = countAliveEnemies(state);
  const width = ctx.canvas.width;
  const hpRatio = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));

  ctx.save();
  ctx.fillStyle = 'rgba(14,22,36,0.9)';
  ctx.fillRect(0, 0, width, 72);

  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#dfe7ff';
  ctx.fillText(`Andar: ${state.floorNumber}/10`, 14, 24);
  ctx.fillText(`Inimigos: ${enemies}`, 14, 44);
  ctx.fillText(`Poderes: ${player.powerUps.length}`, 14, 64);

  ctx.fillText(`ATK ${player.attack.toFixed(0)}  DEF ${player.damageReduction.toFixed(0)}`, 250, 24);
  ctx.fillText(`Move ${player.moveCooldownMs}ms  Regen ${player.regenPerSecond.toFixed(1)}/s`, 250, 44);

  ctx.fillStyle = 'rgba(34,42,58,1)';
  ctx.fillRect(width - 304, 16, 280, 20);
  ctx.fillStyle = '#6fe08f';
  ctx.fillRect(width - 304, 16, Math.floor(280 * hpRatio), 20);
  ctx.fillStyle = '#0b1018';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, width - 288, 31);

  ctx.font = '12px monospace';
  ctx.fillStyle = '#9bb1d8';
  const hint =
    state.phase === 'powerup_choice'
      ? 'Escolha: tecla 1 ou 2'
      : 'Mover: WASD/Setas | Objetivo: alcancar a saida';
  ctx.fillText(hint, width - 304, 55);

  ctx.restore();
};
