import type { GameState, PowerUpId } from '../game/types';
import { countAliveEnemies, getPlayer } from '../game/state';
import {
  POWERUP_KILLS_PER_CHOICE_EARLY,
  POWERUP_KILLS_PER_CHOICE_LATE,
} from '../game/constants';
import { getFloorTheme } from '../game/lore';
import { index2D } from '../world/level';

export const HUD_HEIGHT = 96;

const INK = '#dbe4f2';
const INK_2 = '#8695b2';
const INK_3 = '#55668a';
const PANEL_BG = 'rgba(7,11,18,0.72)';
const RULE_2 = '#2a3a5a';
const RULE = '#1e2a44';
const CORE = '#c86bff';
const BLOOD = '#e04f5f';
const BLOOD_LIGHT = '#ff8090';
const ENTRY = '#5ed0ec';
const EXIT = '#f6c453';
const FUNGAL_GLOW = '#6fe19a';

const FONT_DISPLAY = '"Space Grotesk", ui-sans-serif, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

const POWER_LABEL: Record<PowerUpId, string> = {
  vital_boost: 'HP',
  attack_boost: 'ATK',
  swift_boots: 'SPD',
  iron_skin: 'ARM',
  vampiric_spores: 'VMP',
  fungal_regen: 'REG',
};

const POWER_COLOR: Record<PowerUpId, string> = {
  vital_boost: BLOOD_LIGHT,
  attack_boost: '#ff8a78',
  swift_boots: ENTRY,
  iron_skin: '#c8b7a0',
  vampiric_spores: CORE,
  fungal_regen: FUNGAL_GLOW,
};

const ellipsize = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string => {
  if (maxWidth <= 8) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
};

const drawPanelFrame = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void => {
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = RULE_2;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};

const drawCaps = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = INK_2,
  size = 10
): void => {
  ctx.font = `500 ${size}px ${FONT_MONO}`;
  ctx.fillStyle = color;
  // approximate CSS letter-spacing 0.16em by drawing char-by-char
  const spacing = size * 0.16;
  let cursor = x;
  for (const ch of text.toUpperCase()) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
};

const capsWidth = (ctx: CanvasRenderingContext2D, text: string, size = 10): number => {
  ctx.font = `500 ${size}px ${FONT_MONO}`;
  const spacing = size * 0.16;
  let w = 0;
  const t = text.toUpperCase();
  for (let i = 0; i < t.length; i++) {
    w += ctx.measureText(t[i]).width;
    if (i < t.length - 1) w += spacing;
  }
  return w;
};

export const drawHud = (ctx: CanvasRenderingContext2D, state: GameState): void => {
  const player = getPlayer(state);
  if (!player) return;
  const theme = getFloorTheme(state.floorNumber);

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const padding = 16;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  /* ============================================================
     HP PANEL (top-left)
  ============================================================ */
  const hpW = 220;
  const hpH = 52;
  const hpX = padding;
  const hpY = padding;
  const hpRatio = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));

  drawPanelFrame(ctx, hpX, hpY, hpW, hpH);

  // "HP" Space Grotesk label + numeric readout
  ctx.font = `600 13px ${FONT_DISPLAY}`;
  ctx.fillStyle = INK;
  ctx.fillText('HP', hpX + 12, hpY + 20);
  ctx.font = `500 12px ${FONT_MONO}`;
  ctx.fillStyle = INK_2;
  const hpText = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  ctx.fillText(hpText, hpX + 34, hpY + 20);

  // status inline (slow / crystal) top-right of HP panel
  const now = state.simTimeMs;
  const slowMs = Math.max(0, state.activeDebuffs.slowUntilMs - now);
  const crystalMs = Math.max(0, state.activeDebuffs.crystalBuffUntilMs - now);
  ctx.font = `500 9px ${FONT_MONO}`;
  const statusBits: Array<{ label: string; color: string }> = [];
  if (slowMs > 0) statusBits.push({ label: `LENTO ${Math.ceil(slowMs / 1000)}S`, color: CORE });
  if (crystalMs > 0)
    statusBits.push({ label: `CRISTAL ${Math.ceil(crystalMs / 1000)}S`, color: FUNGAL_GLOW });
  let sx = hpX + hpW - 10;
  for (let i = statusBits.length - 1; i >= 0; i--) {
    const bit = statusBits[i];
    const w = capsWidth(ctx, bit.label, 9) + 10;
    sx -= w;
    ctx.strokeStyle = bit.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, hpY + 10.5, w - 6, 12);
    drawCaps(ctx, bit.label, sx + 3, hpY + 19, bit.color, 9);
    sx -= 4;
  }

  // Bar track + fill (blood → pink gradient)
  const barX = hpX + 12;
  const barY = hpY + 30;
  const barW = hpW - 24;
  const barH = 10;
  ctx.fillStyle = RULE;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = RULE_2;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  const fillW = Math.max(0, Math.floor((barW - 2) * hpRatio));
  if (fillW > 0) {
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, BLOOD);
    grad.addColorStop(1, BLOOD_LIGHT);
    ctx.fillStyle = grad;
    ctx.fillRect(barX + 1, barY + 1, fillW, barH - 2);
  }

  /* ============================================================
     STATUS RAIL (below HP panel)
  ============================================================ */
  const railY = hpY + hpH + 6;
  const enemies = countAliveEnemies(state);
  const powerKillsRequired = state.floorNumber <= 3
    ? POWERUP_KILLS_PER_CHOICE_EARLY
    : POWERUP_KILLS_PER_CHOICE_LATE;
  const mutationText = state.pendingPowerUpChoices.length > 0
    ? 'MUT PRONTA'
    : `MUT ${Math.min(state.powerUpKillCharge, powerKillsRequired)}/${powerKillsRequired}`;
  drawCaps(
    ctx,
    `INIMIGOS ${enemies} · ATK ${Math.round(player.attack)} · DEF ${Math.round(
      player.damageReduction
    )} · ${mutationText}`,
    hpX + 2,
    railY + 8,
    INK_3,
    9
  );

  /* ============================================================
     DEPTH PANEL (top-right)
  ============================================================ */
  const depthW = 236;
  const depthH = 66;
  const depthX = width - padding - depthW;
  const depthY = padding;
  drawPanelFrame(ctx, depthX, depthY, depthW, depthH);
  drawCaps(ctx, 'DEPTH', depthX + 12, depthY + 18, INK_2, 10);
  ctx.font = `600 20px ${FONT_DISPLAY}`;
  ctx.fillStyle = theme.accent;
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 8;
  const depthLabel = `ANDAR ${String(state.floorNumber).padStart(2, '0')}`;
  ctx.fillText(depthLabel, depthX + 12, depthY + 42);
  ctx.shadowBlur = 0;
  ctx.font = `500 10px ${FONT_MONO}`;
  ctx.fillStyle = INK_2;
  ctx.fillText(ellipsize(ctx, theme.name, depthW - 24), depthX + 12, depthY + 58);

  /* ============================================================
     ALERTS (under depth panel)
  ============================================================ */
  const alerts = state.uiAlerts.filter((a) => a.untilMs > now).slice(-2);
  let alertY = depthY + depthH + 6;
  for (const a of alerts) {
    const color = a.tone === 'warn' ? BLOOD_LIGHT : a.tone === 'buff' ? FUNGAL_GLOW : ENTRY;
    ctx.font = `600 11px ${FONT_DISPLAY}`;
    const text = ellipsize(ctx, a.text, depthW);
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = color;
    ctx.fillText(text, depthX + depthW - textW, alertY + 10);
    alertY += 18;
  }

  /* ============================================================
     MESSAGE / HINT (center bottom, above powerslots)
  ============================================================ */
  const recent = state.messages[state.messages.length - 1] ?? '';
  const hint =
    state.phase === 'powerup_choice'
      ? 'Escolha: tecla 1 ou 2'
      : recent.length > 0
        ? recent
        : 'WASD move · E interage · 1/2 seleciona poder';
  ctx.font = `500 10px ${FONT_MONO}`;
  ctx.fillStyle = INK_2;
  const hintText = ellipsize(ctx, hint, width - 2 * padding - 280);
  const hintW = ctx.measureText(hintText).width;
  const hintX = Math.round((width - hintW) / 2);
  const hintY = height - 70;
  ctx.fillStyle = 'rgba(7,11,18,0.72)';
  ctx.fillRect(hintX - 10, hintY - 12, hintW + 20, 18);
  ctx.strokeStyle = RULE;
  ctx.strokeRect(hintX - 9.5, hintY - 11.5, hintW + 19, 17);
  ctx.fillStyle = INK_2;
  ctx.fillText(hintText, hintX, hintY);

  /* ============================================================
     POWERSLOTS (bottom-left): Q / E / R
  ============================================================ */
  const slotSize = 44;
  const slotGap = 6;
  const slotsY = height - padding - slotSize;
  const slotsX = padding;
  const slotKeys: Array<{ key: string; power: PowerUpId | null }> = [
    { key: 'Q', power: player.powerUps[player.powerUps.length - 1] ?? null },
    { key: 'E', power: player.powerUps[player.powerUps.length - 2] ?? null },
    { key: 'R', power: null },
  ];
  slotKeys.forEach((slot, i) => {
    const sxSlot = slotsX + i * (slotSize + slotGap);
    drawPanelFrame(ctx, sxSlot, slotsY, slotSize, slotSize);
    // keycap in bottom-right
    ctx.font = `500 9px ${FONT_MONO}`;
    ctx.fillStyle = INK_3;
    ctx.fillText(slot.key, sxSlot + slotSize - 10, slotsY + slotSize - 4);
    // power icon — tinted square + label caps
    if (slot.power) {
      const color = POWER_COLOR[slot.power] ?? INK_2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(sxSlot + 6, slotsY + 6, slotSize - 12, slotSize - 16);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.strokeRect(sxSlot + 6.5, slotsY + 6.5, slotSize - 13, slotSize - 17);
      const label = POWER_LABEL[slot.power] ?? '?';
      ctx.font = `600 11px ${FONT_DISPLAY}`;
      ctx.fillStyle = color;
      const lw = ctx.measureText(label).width;
      ctx.fillText(label, sxSlot + (slotSize - lw) / 2, slotsY + slotSize / 2 + 2);
    }
  });

  // extra powerups beyond slots — small chiclets
  const extraPowers = Array.from(new Set(player.powerUps)).slice(0, -2).slice(-4);
  let chipX = slotsX + 3 * (slotSize + slotGap) + 4;
  const chipY = slotsY + slotSize - 18;
  ctx.font = `500 9px ${FONT_MONO}`;
  for (const p of extraPowers) {
    const label = POWER_LABEL[p] ?? '?';
    const lw = capsWidth(ctx, label, 9) + 10;
    const color = POWER_COLOR[p] ?? INK_2;
    ctx.strokeStyle = color;
    ctx.strokeRect(chipX + 0.5, chipY + 0.5, lw, 14);
    drawCaps(ctx, label, chipX + 4, chipY + 10, color, 9);
    chipX += lw + 4;
  }

  /* ============================================================
     MINIMAP (bottom-right)
  ============================================================ */
  const level = state.level;
  const mmCols = 28; // sample cols
  const mmRows = 16;
  const mmW = mmCols * 4 + 8;
  const mmH = mmRows * 4 + 8;
  const mmX = width - padding - mmW;
  const mmY = height - padding - mmH;

  drawPanelFrame(ctx, mmX, mmY, mmW, mmH);
  // label tab
  const tabText = 'MAP';
  drawCaps(ctx, tabText, mmX + 6, mmY - 2, INK_3, 8);

  // Sample the level at a reduced resolution. Cell = 4×4 px.
  const sampleW = level.width / mmCols;
  const sampleH = level.height / mmRows;
  const innerX = mmX + 4;
  const innerY = mmY + 4;
  for (let cy = 0; cy < mmRows; cy++) {
    for (let cx = 0; cx < mmCols; cx++) {
      const lx = Math.min(level.width - 1, Math.floor(cx * sampleW + sampleW / 2));
      const ly = Math.min(level.height - 1, Math.floor(cy * sampleH + sampleH / 2));
      const h = level.heightMap[index2D(level.width, lx, ly)] ?? 1;
      // wall vs floor
      if (h >= 0.5) {
        ctx.fillStyle = '#1a2238';
        ctx.fillRect(innerX + cx * 4, innerY + cy * 4, 4, 4);
      } else {
        ctx.fillStyle = '#0e1424';
        ctx.fillRect(innerX + cx * 4, innerY + cy * 4, 4, 4);
      }
    }
  }

  // Helper to paint a single tile on the minimap
  const paintCell = (lx: number, ly: number, color: string, glow = false): void => {
    if (lx < 0 || ly < 0 || lx >= level.width || ly >= level.height) return;
    const cx = Math.min(mmCols - 1, Math.floor(lx / sampleW));
    const cy = Math.min(mmRows - 1, Math.floor(ly / sampleH));
    if (glow) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = color;
    ctx.fillRect(innerX + cx * 4, innerY + cy * 4, 4, 4);
    if (glow) ctx.restore();
  };

  // entry / exit
  paintCell(level.entry.x, level.entry.y, ENTRY, true);
  paintCell(level.exit.x, level.exit.y, EXIT, true);

  // enemies (alive only)
  for (const entity of level.entities.values()) {
    if (entity.kind !== 'enemy') continue;
    if (!entity.alive) continue;
    paintCell(entity.x, entity.y, BLOOD);
  }

  // player
  paintCell(player.x, player.y, INK, true);

  /* ============================================================
     FLASH OVERLAYS on the HP frame when taking damage / healing
  ============================================================ */
  if (state.screenFlash.damageMs > 0) {
    ctx.strokeStyle = BLOOD;
    ctx.lineWidth = 2;
    ctx.strokeRect(hpX + 1, hpY + 1, hpW - 2, hpH - 2);
    ctx.lineWidth = 1;
  }

  ctx.restore();
};
