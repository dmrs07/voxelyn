// Andar com o stick e SOLTAR: o corpo fica virado para onde andou.
//
// A regressao que este arquivo guarda: `player.facing` era sinonimo da MIRA, e
// movimento nunca o atualizava — ao soltar o direcional o corpo girava de volta
// para a ultima mira (ou para o DR default de quem nunca mirou). No aparelho
// isso aparecia como "soltar o stick vira o personagem sozinho", e so parecia
// funcionar nas direcoes que coincidiam com a mira anterior.
//
// O teste atravessa o pipeline REAL do jogador local em solo: comandos
// quantizados -> stepRun -> deriveAnim (deslocamento observado) ->
// EntityPresentation -> dirFromFacing.
import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun, SOLID_NONE, SURF_NONE } from '@voxelyn/survival-sim';
import type { SurvivalState } from '@voxelyn/survival-sim';
import { quantizeCommand } from '@voxelyn/survival-protocol';
import { dirFromFacing } from '@voxelyn/survival-content';
import { screenToWorldAim, screenToWorldMove } from '../client/input';
import { deriveAnim, type EntityAnimState } from '../client/sprites';
import { EntityPresentation } from '../client/presentation';

const clearArena = (state: SurvivalState): void => {
  state.enemies = [];
  state.vents = [];
  state.projectiles = [];
  // Longe das bordas: colisao com o mundo mudaria o deslocamento observado e o
  // teste deixaria de medir a regra de facing.
  state.player.x = 40.5;
  state.player.y = 40.5;
  const w = state.config.width;
  for (let y = 28; y <= 52; y++) {
    for (let x = 28; x <= 52; x++) {
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
    }
  }
};

/** As oito deflexoes de stick, em coordenadas de TELA. */
const STICKS: Array<[string, number, number]> = [
  ['right', 1, 0],
  ['up-right', 1, -1],
  ['up', 0, -1],
  ['up-left', -1, -1],
  ['left', -1, 0],
  ['down-left', -1, 1],
  ['down', 0, 1],
  ['down-right', 1, 1],
];

type Pipeline = {
  state: SurvivalState;
  presentation: EntityPresentation;
  anim: EntityAnimState | undefined;
  nowMs: number;
};

const start = (seed: number): Pipeline => {
  const state = createRun({ seed });
  clearArena(state);
  return { state, presentation: new EntityPresentation(), anim: undefined, nowMs: 1000 };
};

const tick = (p: Pipeline, command = emptyCommand()): void => {
  const result = stepRun(p.state, [quantizeCommand(command)]);
  p.nowMs += 50;
  p.presentation.ingest(result.events as never, p.nowMs);
  p.anim = deriveAnim(
    p.anim,
    p.state.player.x,
    p.state.player.y,
    p.state.player.hp,
    p.state.player.alive,
    p.nowMs,
  );
};

const presentedDirs = (p: Pipeline): { lower: string; upper: string } => {
  const presented = p.presentation.animationFor(
    p.state.player as never,
    p.state as never,
    p.anim as never,
    p.nowMs,
  );
  if (typeof presented.anim === 'object') {
    const anim = presented.anim as {
      lower: { facingX: number; facingY: number };
      upper: { facingX: number; facingY: number };
    };
    return {
      lower: dirFromFacing(anim.lower.facingX, anim.lower.facingY),
      upper: dirFromFacing(anim.upper.facingX, anim.upper.facingY),
    };
  }
  return {
    lower: dirFromFacing(presented.facingX, presented.facingY),
    upper: dirFromFacing(presented.facingX, presented.facingY),
  };
};

describe('andar e soltar o stick preserva o rumo nas OITO direcoes', () => {
  for (const [label, sx, sy] of STICKS) {
    it(`stick ${label}`, () => {
      const p = start(0xace0 + sx * 3 + sy);
      const move = screenToWorldMove(sx, sy);
      const walkDir = dirFromFacing(move.x, move.y);

      const walk = emptyCommand();
      walk.move = { ...move };
      for (let t = 0; t < 20; t++) tick(p, { ...emptyCommand(), move: { ...move } });
      expect(presentedDirs(p).lower, `${label}: quadrante durante o andar`).toBe(walkDir);

      // Solta o direcional: dezenas de ticks neutros. O corpo NAO pode girar.
      for (let t = 0; t < 40; t++) tick(p);
      const after = presentedDirs(p);
      expect(after.lower, `${label}: pernas depois de parar`).toBe(walkDir);
      expect(after.upper, `${label}: tronco depois de parar`).toBe(walkDir);
      expect(
        dirFromFacing(p.state.player.facing.x, p.state.player.facing.y),
        `${label}: facing autoritativo`,
      ).toBe(walkDir);
    });
  }

  it('mirar e soltar tambem preserva, nas oito direcoes', () => {
    for (const [label, sx, sy] of STICKS) {
      const p = start(0xbee0 + sx * 3 + sy);
      const aim = screenToWorldAim(sx, sy);
      const aimDir = dirFromFacing(aim.x, aim.y);

      // Toque: stick de mira ativo = atirando.
      for (let t = 0; t < 10; t++) tick(p, { ...emptyCommand(), aim: { ...aim }, fire: true });
      for (let t = 0; t < 40; t++) tick(p);

      const after = presentedDirs(p);
      expect(after.lower, `${label}: pernas depois de soltar a mira`).toBe(aimDir);
      expect(after.upper, `${label}: tronco depois de soltar a mira`).toBe(aimDir);
    }
  });
});
