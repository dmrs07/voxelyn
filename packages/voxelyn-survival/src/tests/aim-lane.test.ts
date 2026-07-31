import { describe, expect, it } from 'vitest';
import { RICOCHET_BOUNCES } from '@voxelyn/survival-sim';
import { AIM_LANE_LENGTH, aimLanePath, aimLaneReach } from '../client/render';
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

/**
 * Com Ricochete a faixa deixa de parar na parede e segue ate o ULTIMO quique.
 *
 * E a unica leitura util do modulo: um tiro que rebate so vale a pena se der
 * para ESCOLHER a parede, e escolher a parede exige ver para onde ela devolve.
 * Sem isso o jogador mira num obstaculo e torce.
 */
describe('faixa de mira com Ricochete', () => {
  const open = (): boolean => false;
  /** Parede em x = 14, o resto livre. */
  const wallAtX14 = (x: number): boolean => Math.floor(x) === 14;

  it('sem rebote, continua sendo um trecho so', () => {
    const legs = aimLanePath(10.5, 10.5, 1, 0, wallAtX14, 0);
    expect(legs).toHaveLength(1);
  });

  it('com rebote, atravessa a parede como um segundo trecho', () => {
    const legs = aimLanePath(10.5, 10.5, 1, 0, wallAtX14, RICOCHET_BOUNCES);
    expect(legs).toHaveLength(2);
    // Batendo de frente numa parede vertical, o tiro volta pelo mesmo eixo.
    expect(legs[1].nx).toBeCloseTo(-1);
    expect(legs[1].ny).toBeCloseTo(0);
    // E parte de onde o primeiro trecho terminou: nao ha salto entre os dois.
    expect(legs[1].x0).toBeCloseTo(legs[0].x1);
    expect(legs[1].y0).toBeCloseTo(legs[0].y1);
  });

  /**
   * O espelhamento tem de ser o MESMO de `bounceOffSolid` na simulacao: reflete
   * no eixo por onde o tiro entrou na celula. Numa parede vertical batida de
   * esguelha, so o eixo x inverte — o y segue. Deduzir de outro jeito daria uma
   * faixa apontando para um lugar e um projetil indo para outro.
   *
   * O angulo aqui e raso de proposito. Batida de canto — quando o tiro cruza a
   * fronteira em x e em y no MESMO instante — os dois eixos invertem, e isso e
   * geometria, nao bug: nao ha "eixo de entrada" unico num canto. A simulacao
   * faz o mesmo.
   */
  it('espelha so no eixo por onde entrou na parede', () => {
    const legs = aimLanePath(10.5, 10.5, 1, 0.1, wallAtX14, RICOCHET_BOUNCES);
    expect(legs).toHaveLength(2);
    const n = Math.hypot(1, 0.1);
    expect(legs[1].nx).toBeCloseTo(-1 / n, 3);
    expect(legs[1].ny).toBeCloseTo(0.1 / n, 3);
  });

  it('nao gasta rebote onde nao ha parede', () => {
    expect(aimLanePath(10, 10, 1, 0, open, RICOCHET_BOUNCES)).toHaveLength(1);
  });

  /**
   * Os trechos repartem o MESMO alcance. Um tiro nao viaja mais longe por
   * rebater, e uma faixa que crescesse a cada quique prometeria alcance que o
   * projetil nao tem — o TTL dele nao muda com o modulo.
   */
  it('reparte o alcance entre os trechos, sem estica-lo', () => {
    const legs = aimLanePath(10.5, 10.5, 1, 0, wallAtX14, RICOCHET_BOUNCES);
    const total = legs.reduce((sum, leg) => sum + leg.length, 0);
    expect(total).toBeLessThanOrEqual(AIM_LANE_LENGTH + 1e-9);
    expect(legs[1].length).toBeGreaterThan(0);
  });

  it('para no numero de rebotes que o modulo concede', () => {
    // Corredor de um tile entre duas paredes: sem o limite, isto rebateria para
    // sempre e o laco nao terminaria.
    const corridor = (x: number): boolean => Math.floor(x) <= 9 || Math.floor(x) >= 12;
    const legs = aimLanePath(10.5, 10.5, 1, 0, corridor, RICOCHET_BOUNCES);
    expect(legs).toHaveLength(RICOCHET_BOUNCES + 1);
  });
});
