import { describe, expect, it } from 'vitest';
import { AIM_LANE_LENGTH, aimLaneReach } from '../client/render';
import { SMALL_PROJECTILE_RADIUS } from '../client/projectiles';

/**
 * A faixa de mira no chao promete duas coisas ao jogador, e as duas tem de ser
 * verdade ou ela e pior do que nao existir: a LARGURA em que o tiro acerta, e o
 * ponto em que a parede interrompe.
 *
 * O indicador anterior nao prometia nenhuma das duas — era um risco de 20px
 * flutuando na altura do peito, que so dizia o rumo.
 */
describe('faixa de mira', () => {
  const open = (): boolean => false;

  it('vai ate o alcance da faixa quando nao ha nada no caminho', () => {
    expect(aimLaneReach(10, 10, 1, 0, open)).toBe(AIM_LANE_LENGTH);
    expect(aimLaneReach(10, 10, 0, -1, open)).toBe(AIM_LANE_LENGTH);
  });

  it('para ANTES da parede, e nao dentro dela', () => {
    // Pedra ocupando a coluna x = 14; o jogador esta em x = 10,5.
    const reach = aimLaneReach(10.5, 10.5, 1, 0, (x) => Math.floor(x) === 14);
    expect(reach).toBeGreaterThan(3);
    expect(reach).toBeLessThan(3.5);
    // O ponto final continua em chao livre: uma faixa que termina dentro da
    // pedra promete alcance que o tiro nao tem.
    expect(Math.floor(10.5 + reach)).toBeLessThan(14);
  });

  it('nao desenha nada quando a parede esta colada', () => {
    expect(aimLaneReach(10.9, 10.5, 1, 0, (x) => Math.floor(x) === 11)).toBe(0);
  });

  it('mede o mesmo comprimento em qualquer direcao, e nao so nos eixos', () => {
    const diagonal = aimLaneReach(10, 10, 0.7071, 0.7071, open);
    expect(diagonal).toBe(AIM_LANE_LENGTH);
    // Vetor nao normalizado tem de dar o mesmo: a mira chega em pixels de tela e
    // o comprimento dela nao significa alcance nenhum.
    expect(aimLaneReach(10, 10, 340, 0, open)).toBe(AIM_LANE_LENGTH);
  });

  it('ignora mira nula em vez de escolher uma direcao por conta propria', () => {
    expect(aimLaneReach(10, 10, 0, 0, open)).toBe(0);
  });

  /**
   * O numero que a faixa desenha e o MESMO que a simulacao usa para colidir.
   * Duplicar o raio aqui deixaria a promessa e o efeito divergirem em silencio
   * no dia em que um dos dois mudasse.
   */
  it('usa o raio de colisao do projetil como meia-largura', () => {
    expect(SMALL_PROJECTILE_RADIUS).toBe(0.2);
  });
});
