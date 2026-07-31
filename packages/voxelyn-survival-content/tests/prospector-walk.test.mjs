import { describe, expect, it } from 'vitest';
import {
  STRIDE_VOXELS,
  VOXELS_PER_TILE,
  WALK_CYCLE_TILES,
  WALK_FRAMES,
  WALK_SWING,
  prospectorParts,
  walkFps,
} from '../tools/prospector.mjs';
import { PROSPECTOR_WALK_CYCLE_TILES } from '../src/manifest';

/**
 * O lado do GERADOR do contrato de caminhada.
 *
 * O outro lado vive em `@voxelyn/survival`, onde `PLAYER_SPEED` existe: la se
 * confere que o `fps` assado no atlas casa com a velocidade real do jogador.
 * Aqui se confere que a passada autorada continua sendo a que aquele numero
 * pressupoe — sem isto, alguem mexe na tabela de balanco, a distancia por ciclo
 * muda, os dois testes continuam verdes separadamente e o pe volta a patinar.
 */
describe('passada do Prospector', () => {
  it('publica a mesma distancia por ciclo que o runtime declara', () => {
    expect(WALK_CYCLE_TILES).toBe(PROSPECTOR_WALK_CYCLE_TILES);
  });

  it('deriva a distancia por ciclo da passada autorada, e nao de um numero solto', () => {
    // Duas passadas por ciclo; cada passada e a abertura entre os pes, que e o
    // dobro da amplitude do balanco.
    expect(WALK_CYCLE_TILES).toBe((2 * (2 * STRIDE_VOXELS)) / VOXELS_PER_TILE);
  });

  /**
   * O pe de apoio finge estar preso ao chao enquanto o corpo avanca. Para isso
   * ele tem de andar para tras a uma taxa CONSTANTE: com uma senoide ele
   * desacelera nos extremos e o personagem patina duas vezes por passo, que e um
   * defeito que nenhuma cadencia conserta.
   */
  it('anda a passo constante, sem acelerar nem frear dentro do ciclo', () => {
    const deltas = WALK_SWING.map((value, i) => {
      const next = WALK_SWING[(i + 1) % WALK_FRAMES];
      return Math.abs(next - value);
    });
    expect(new Set(deltas).size).toBe(1);
    expect(deltas[0]).toBe((2 * STRIDE_VOXELS) / (WALK_FRAMES / 2));
  });

  it('cobre a abertura inteira entre os pes ao longo do ciclo', () => {
    expect(Math.max(...WALK_SWING)).toBe(STRIDE_VOXELS);
    expect(Math.min(...WALK_SWING)).toBe(-STRIDE_VOXELS);
  });

  it('calcula a cadencia a partir da velocidade, sem numero magico', () => {
    // Um ciclo tem de durar o tempo de percorrer WALK_CYCLE_TILES.
    const fps = walkFps(4.6);
    expect(WALK_FRAMES / fps).toBeCloseTo(WALK_CYCLE_TILES / 4.6, 6);
  });

  /**
   * As duas pernas usam a mesma tabela defasada de meio ciclo. Sem a defasagem
   * elas subiriam juntas e o bot pularia como coelho — que era exatamente o
   * defeito do ciclo antigo, em que `stride` so levantava a bota em z.
   */
  it('alterna as pernas em vez de move-las juntas', () => {
    const half = WALK_FRAMES / 2;
    for (let f = 0; f < WALK_FRAMES; f++) {
      expect(WALK_SWING[(f + half) % WALK_FRAMES]).toBe(-WALK_SWING[f]);
    }
  });

  it('mantem a arma numa camada propria, sem nenhum pixel de corpo junto', () => {
    const parts = prospectorParts({});
    expect(parts.gun.length).toBeGreaterThan(0);
    expect(parts.lower.length).toBeGreaterThan(0);
    expect(parts.upper.length).toBeGreaterThan(0);
    // A arma nunca partilha caixa com o tronco: se partilhasse, o tint de calor
    // pintaria pedaco de chassi junto.
    const gunKeys = new Set(parts.gun.map((b) => `${b.x},${b.y},${b.z}`));
    for (const b of parts.upper) expect(gunKeys.has(`${b.x},${b.y},${b.z}`)).toBe(false);
  });
});
