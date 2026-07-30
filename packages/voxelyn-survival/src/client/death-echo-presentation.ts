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

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => {
  const serialParts = echo.id.split(':');
  const serial = serialParts[serialParts.length - 1] ?? '---';
  return {
    title: `CAIXA-PRETA ${serial.padStart(3, '0')}`,
    headline: describeCause(echo.cause).headline,
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
