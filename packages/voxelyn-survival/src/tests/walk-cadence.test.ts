import { describe, expect, it } from 'vitest';
import { PLAYER_SPEED } from '@voxelyn/survival-sim';
import { PROSPECTOR_WALK_CYCLE_TILES } from '@voxelyn/survival-content';
import lowerManifest from '@voxelyn/survival-content/assets/atlases/layer-player-prospector-lower.json';
import fullManifest from '@voxelyn/survival-content/assets/atlases/player-prospector.json';

/**
 * O pe do Prospector nao pode patinar.
 *
 * O ciclo antigo nao tinha passada NENHUMA: a tabela de caminhada so levantava a
 * bota alguns voxels em z, sem deslocar o pe no eixo do corpo. O personagem
 * marchava no lugar enquanto deslizava pela sala a 4,6 tiles por segundo, e nao
 * havia cadencia que consertasse isso — nao ha o que sincronizar com um pe que
 * nao anda.
 *
 * Com passada de verdade, a cadencia deixa de ser gosto e vira conta: o ciclo
 * cobre `PROSPECTOR_WALK_CYCLE_TILES` e tem de durar exatamente o tempo que o
 * jogador leva para cobrir a mesma distancia. Este teste le o `fps` ASSADO no
 * atlas, e nao a formula do gerador: e o numero assado que o runtime consome, e
 * um atlas gerado antes de uma mudanca de velocidade passaria despercebido de
 * qualquer outra forma.
 */
const walkDefinition = (manifest: { animations: Record<string, { frames: number; fps: number }> }) =>
  manifest.animations.walk;

describe('cadencia da caminhada', () => {
  it('casa a duracao do ciclo com a velocidade do jogador', () => {
    const walk = walkDefinition(lowerManifest as never);
    const cycleSeconds = walk.frames / walk.fps;
    const tilesPerCycleAtSpeed = PLAYER_SPEED * cycleSeconds;

    expect(tilesPerCycleAtSpeed).toBeCloseTo(PROSPECTOR_WALK_CYCLE_TILES, 3);
  });

  /**
   * O sheet completo e o caminho de recuo enquanto os tres atlas de camada nao
   * carregaram. Se ele andasse noutra cadencia, o personagem trocaria de ritmo
   * no meio do carregamento — que e justamente quando o jogador esta olhando.
   */
  it('usa a mesma cadencia no sheet completo e na camada de baixo', () => {
    const layered = walkDefinition(lowerManifest as never);
    const full = walkDefinition(fullManifest as never);

    expect(full.frames).toBe(layered.frames);
    expect(full.fps).toBeCloseTo(layered.fps, 3);
  });
});
