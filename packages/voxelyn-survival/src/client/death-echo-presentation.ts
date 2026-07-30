// Controller client-side dos Ecos do Veio.
//
// Esta camada guarda memória local e projeta carcaças, mas não participa da
// simulação. O renderer recebe apenas uma lista imutável de apresentação.

import type { SurvivalState } from '@voxelyn/survival-sim';
import { describeCause } from './run-summary';
import {
  applyDeathEchoOnce,
  loadDeathEchoRecords,
  projectDeathEchoes,
  saveDeathEchoRecords,
  type DeathEchoRecords,
  type PlacedDeathEcho,
} from './death-echoes';

export type DeathEchoReadout = {
  title: string;
  headline: string;
};

export type DeathEchoReadoutRegion = {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  align: 'right' | 'center';
  placement: 'side' | 'below';
};

type Insets = { top: number; right: number; bottom: number; left: number };
type PanelRect = { x: number; y: number; width: number; height: number };

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => {
  const serialParts = echo.id.split(':');
  const serial = serialParts[serialParts.length - 1] ?? '---';
  return {
    title: `CAIXA-PRETA ${serial.padStart(3, '0')}`,
    headline: describeCause(echo.cause).headline,
  };
};

/**
 * Reserva o retângulo do HUD antes de posicionar a caixa-preta.
 *
 * Em telas largas ela fica ao lado do painel. Em retrato estreito, desce para
 * baixo dele. Se nem ali houver espaço legível, o readout não é desenhado —
 * esconder informação opcional é melhor do que cobrir HP, calor ou objetivo.
 */
export const deathEchoReadoutRegion = (
  viewportWidth: number,
  viewportHeight: number,
  safeArea: Insets,
  hud: PanelRect,
): DeathEchoReadoutRegion | null => {
  const margin = 14;
  const gap = 12;
  const safeLeft = safeArea.left + margin;
  const safeRight = viewportWidth - safeArea.right - margin;
  const safeTop = safeArea.top + margin;
  const safeBottom = viewportHeight - safeArea.bottom - margin;
  if (safeRight <= safeLeft || safeBottom <= safeTop) return null;

  const sideX = Math.max(safeLeft, hud.x + hud.width + gap);
  const sideWidth = safeRight - sideX;
  if (sideWidth >= 180) {
    return {
      x: sideX,
      y: safeTop,
      maxWidth: Math.min(360, sideWidth),
      maxHeight: safeBottom - safeTop,
      align: 'right',
      placement: 'side',
    };
  }

  const belowY = Math.max(safeTop, hud.y + hud.height + gap);
  const availableWidth = safeRight - safeLeft;
  const availableHeight = safeBottom - belowY;
  if (availableWidth < 140 || availableHeight < 46) return null;
  return {
    x: safeLeft,
    y: belowY,
    maxWidth: Math.min(360, availableWidth),
    maxHeight: availableHeight,
    align: 'center',
    placement: 'below',
  };
};

export class DeathEchoController {
  private recordedIdentity: string | null = null;
  private terminal = false;
  private projectionKey = '';
  private placed: readonly PlacedDeathEcho[] = [];

  constructor(private records: DeathEchoRecords = loadDeathEchoRecords()) {}

  sync(state: SurvivalState): readonly PlacedDeathEcho[] {
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
      this.projectionKey = '';
      this.placed = [];
      return this.placed;
    }

    if (this.terminal) {
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
    if (key !== this.projectionKey) {
      this.projectionKey = key;
      this.placed = projectDeathEchoes(state, this.records);
    }
    return this.placed;
  }
}
