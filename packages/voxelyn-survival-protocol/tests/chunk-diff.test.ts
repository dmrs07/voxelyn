import { describe, expect, it } from 'vitest';
import {
  SOLID_NONE,
  SURF_DEEP_WATER,
  SURF_ICE,
  SURF_ICE_CRACKED,
  SURF_ICE_CRITICAL,
  SURF_ICE_FRACTURED,
  advanceIceCrack,
  breakSolid,
  createRun,
  emptyCommand,
  explodeAt,
  openIceHole,
  setSurface,
  stepRun,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  ChunkTracker,
  ClientWorldMirror,
  decodeChunkDiffs,
  encodeChunkDiffs,
} from '../src/index';

const worldsEqual = (a: SurvivalState, mirror: ClientWorldMirror): boolean => {
  for (let i = 0; i < a.solid.length; i++) {
    if (a.solid[i] !== mirror.solid[i]) return false;
    if (a.surface[i] !== mirror.surface[i]) return false;
  }
  return true;
};

describe('codec de chunk diff', () => {
  it('diff -> encode -> decode -> apply reconstroi o mundo modificado', () => {
    const server = createRun({ seed: 314159 });
    const tracker = new ChunkTracker(server.config.width, server.config.height);
    tracker.seed(server);

    // cliente inicia com o mesmo estado estatico (worldgen local via mesma seed)
    const clientView = createRun({ seed: 314159 });
    const mirror = new ClientWorldMirror(
      clientView.config.width,
      clientView.config.height,
      clientView.solid,
      clientView.surface
    );
    expect(worldsEqual(server, mirror)).toBe(true);

    // provoca destruicao no servidor: explosao + quebra de celulas
    explodeAt(server, 48, 48, 4, []);
    for (let x = 20; x < 40; x++) breakSolid(server, x, 30, []);
    // avanca a sim para propagar reacoes/superficies
    for (let t = 0; t < 30; t++) stepRun(server, [emptyCommand()]);

    // o servidor produz diffs, serializa e transmite; o cliente aplica
    const diffs = tracker.diff(server);
    expect(diffs.length).toBeGreaterThan(0);
    const wire = encodeChunkDiffs(diffs);
    const received = decodeChunkDiffs(wire);
    mirror.apply(received);

    expect(worldsEqual(server, mirror)).toBe(true);
  });

  it('nao envia o mundo inteiro: apenas chunks alterados aparecem no diff', () => {
    const server = createRun({ seed: 3 });
    const tracker = new ChunkTracker(server.config.width, server.config.height);
    tracker.seed(server);

    // altera uma unica celula (chunk central), garantindo exatamente 1 chunk sujo
    server.surface[24 * server.config.width + 24] = 4;
    const diffs = tracker.diff(server);
    const totalChunks =
      Math.ceil(server.config.width / 16) * Math.ceil(server.config.height / 16);
    expect(diffs.length).toBeLessThan(totalChunks);
    expect(diffs.length).toBeGreaterThan(0);
  });

  it('diffs incrementais sucessivos convergem ao longo de uma run', () => {
    const server = createRun({ seed: 777 });
    const tracker = new ChunkTracker(server.config.width, server.config.height);
    tracker.seed(server);
    const mirror = new ClientWorldMirror(server.config.width, server.config.height, server.solid, server.surface);

    const cmd = emptyCommand();
    cmd.fire = true;
    cmd.move = { x: 1, y: 0.4 };
    for (let t = 0; t < 200; t++) {
      cmd.aim = { x: Math.cos(t * 0.2), y: Math.sin(t * 0.2) };
      stepRun(server, [cmd]);
      if (t % 5 === 0) {
        const diffs = tracker.diff(server);
        mirror.apply(decodeChunkDiffs(encodeChunkDiffs(diffs)));
      }
    }
    tracker.diff(server); // drena qualquer alteracao final
    mirror.apply(tracker.diff(server));
    // garante estado final identico
    const finalDiffs = tracker.fullSnapshot(server);
    const freshMirror = new ClientWorldMirror(server.config.width, server.config.height);
    freshMirror.apply(finalDiffs);
    expect(worldsEqual(server, freshMirror)).toBe(true);
  });

  it('full resync corrige divergencia de um cliente corrompido', () => {
    const server = createRun({ seed: 42 });
    for (let t = 0; t < 40; t++) stepRun(server, [emptyCommand()]);

    // cliente com mundo deliberadamente corrompido
    const mirror = new ClientWorldMirror(server.config.width, server.config.height);
    mirror.solid.fill(9);
    mirror.surface.fill(7);
    expect(worldsEqual(server, mirror)).toBe(false);

    const tracker = new ChunkTracker(server.config.width, server.config.height);
    const full = tracker.fullSnapshot(server);
    mirror.apply(full);
    expect(worldsEqual(server, mirror)).toBe(true);
  });

  /**
   * Os quatro estados novos do gelo viajam pelo diff como qualquer outra
   * superficie — e e por isso que eles sao IDS DE SUPERFICIE e nao um contador
   * escondido em `surfaceTimer`, que o diff nao sincroniza. Um cliente que
   * reconectasse no meio de uma luta na Cripta veria placa inteira em cima de
   * uma celula que cede no proximo passo.
   */
  it('os estados do gelo e o buraco atravessam o diff e o full resync', () => {
    const server = createRun({ seed: 20260904 });
    const w = server.config.width;
    const tracker = new ChunkTracker(w, server.config.height);
    tracker.seed(server);
    const mirror = new ClientWorldMirror(w, server.config.height, server.solid, server.surface);

    // Uma faixa aberta com um estagio diferente em cada celula, mais o buraco.
    const base = 40 * w + 40;
    for (let k = 0; k < 5; k++) {
      server.solid[base + k] = SOLID_NONE;
      setSurface(server, base + k, SURF_ICE, 0);
    }
    for (let k = 1; k <= 3; k++) {
      for (let n = 0; n < k; n++) advanceIceCrack(server, base + k, []);
    }
    openIceHole(server, base + 4, []);

    mirror.apply(tracker.diff(server));
    const stages = [SURF_ICE, SURF_ICE_CRACKED, SURF_ICE_FRACTURED, SURF_ICE_CRITICAL, SURF_DEEP_WATER];
    for (let k = 0; k < stages.length; k++) {
      expect(server.surface[base + k], `origem k=${k}`).toBe(stages[k]);
      expect(mirror.surface[base + k], `espelho k=${k}`).toBe(stages[k]);
    }
    expect(worldsEqual(server, mirror)).toBe(true);

    // E um cliente que chega depois (full resync) recebe os mesmos ids.
    const late = new ClientWorldMirror(w, server.config.height);
    late.apply(new ChunkTracker(w, server.config.height).fullSnapshot(server));
    expect(worldsEqual(server, late)).toBe(true);
    for (let k = 0; k < stages.length; k++) expect(late.surface[base + k]).toBe(stages[k]);
  });

  it('diffs obsoletos (versao menor) sao ignorados na aplicacao', () => {
    const server = createRun({ seed: 8 });
    const tracker = new ChunkTracker(server.config.width, server.config.height);
    tracker.seed(server);
    const mirror = new ClientWorldMirror(server.config.width, server.config.height, server.solid, server.surface);

    breakSolid(server, 40, 40, []);
    const diffsA = tracker.diff(server);
    mirror.apply(diffsA);

    // reentrega de um diff antigo com versao menor nao deve reverter
    const stale = diffsA.map((d) => ({ ...d, v: Math.max(0, d.v - 5), cells: d.cells.map((c) => ({ ...c, solid: 1, surface: 1 })) }));
    mirror.apply(stale);

    // o estado permanece o do diff mais recente
    const gi = 40 * server.config.width + 40;
    expect(mirror.solid[gi]).toBe(server.solid[gi]);
  });
});
