import { describe, expect, it } from 'vitest';
import { PROSPECTOR_MUZZLES, PROSPECTOR_MUZZLE_HEIGHT_TILES } from '@voxelyn/survival-content';
import {
  COMBAT_PLANE_TILES,
  MUZZLE_SETTLE_TILES,
  muzzleForProjectile,
  muzzleLateralTiles,
  heightToScreenPx,
  projectileHeightTiles,
} from '../client/combat-plane';
import { screenToWorldAim } from '../client/input';

/**
 * O ERRO DE MIRA DA PROJECAO ISOMETRICA, medido.
 *
 * O relato foi "mirar ficou mais dificil depois que o tiro subiu para a altura
 * da arma", e a causa e geometrica, nao de gosto. A mira era medida dos PES do
 * Prospector (o centro da tela) ate o cursor. Ninguem aponta para os pes de um
 * bicho: aponta para o CORPO dele, que esta desenhado acima do chao dele. O
 * vetor resultante ligava dois pontos em ALTURAS diferentes, e numa projecao em
 * que subir na tela e afastar-se sao o mesmo pixel, essa diferenca vira rumo.
 *
 * Estes testes medem exatamente o que o jogador sente: o angulo entre o rumo do
 * tiro e o rumo do alvo que ele apontou, com o cursor no tronco do alvo.
 */

const TILE_W = 32;
const TILE_H = 16;
const ZOOM = 2;

/** Ponto de chao -> pixel de tela, relativo ao jogador. A projecao do renderer. */
const toScreen = (dx: number, dy: number): { x: number; y: number } => ({
  x: (dx - dy) * (TILE_W / 2) * ZOOM,
  y: (dx + dy) * (TILE_H / 2) * ZOOM,
});

const angleBetween = (a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la === 0 || lb === 0) return 180;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
};

/**
 * Alvos cobrindo a volta inteira e varias distancias.
 *
 * A distancia importa: o erro do ancoramento errado e ANGULAR, entao ele cresce
 * quanto mais perto o alvo esta — e perto e onde se luta. Um teste so com alvos
 * distantes esconderia o pior caso.
 */
const TARGETS = ([2, 4, 8] as const).flatMap((distance) =>
  Array.from({ length: 24 }, (_, i) => {
    const rad = (i * 15 * Math.PI) / 180;
    return { x: Math.cos(rad) * distance, y: Math.sin(rad) * distance };
  }),
);

describe('mira isometrica: o cursor no tronco do alvo', () => {
  /**
   * A ancora fica no PLANO DE COMBATE, e nao nos pes — e e por isso que o rumo
   * sai certo. Com as duas pontas do vetor na mesma altura, o deslocamento de
   * altura se cancela e sobra o rumo de chao verdadeiro.
   */
  it('acerta o rumo de chao quando a origem esta na altura do corpo', () => {
    const lift = heightToScreenPx(COMBAT_PLANE_TILES, TILE_H, ZOOM);
    let worst = 0;
    for (const target of TARGETS) {
      const feet = toScreen(target.x, target.y);
      // O cursor no CORPO do alvo: o mesmo ponto de chao, subido pela altura em
      // que o corpo dele esta desenhado.
      const cursor = { x: feet.x, y: feet.y - lift };
      // A origem sobe a MESMA altura. Este e o conserto inteiro.
      const anchor = { x: 0, y: -lift };
      const aim = screenToWorldAim(cursor.x - anchor.x, cursor.y - anchor.y);
      worst = Math.max(worst, angleBetween(aim, target));
    }
    // Milesimo de grau: o que sobra e o ruido de `acos` perto de zero, e nao
    // rumo. O defeito media dezenas de graus.
    expect(worst).toBeLessThan(1e-3);
  });

  /**
   * E o contrafactual, que e o que prova que o teste acima nao e vacuo: medindo
   * dos PES, o mesmo cursor produz dezenas de graus de erro no alvo colado.
   */
  it('erra feio quando a origem fica nos pes — o defeito, medido', () => {
    const lift = heightToScreenPx(COMBAT_PLANE_TILES, TILE_H, ZOOM);
    let worst = 0;
    for (const target of TARGETS) {
      const feet = toScreen(target.x, target.y);
      const cursor = { x: feet.x, y: feet.y - lift };
      const aim = screenToWorldAim(cursor.x, cursor.y);
      worst = Math.max(worst, angleBetween(aim, target));
    }
    // Mais de dez graus no pior caso, e o pior caso e o alvo a dois tiles.
    expect(worst).toBeGreaterThan(10);
  });

  /**
   * Com o tiro desenhado na altura ANTIGA (a boca do cano) o erro seria ainda
   * maior — o corpo do projetil passava 20 px acima da linha que o jogador
   * enxergava entre o personagem e o cursor.
   */
  it('a altura do cano deslocava mais que o dobro do plano de combate', () => {
    expect(heightToScreenPx(PROSPECTOR_MUZZLE_HEIGHT_TILES, TILE_H, ZOOM)).toBeGreaterThan(
      heightToScreenPx(COMBAT_PLANE_TILES, TILE_H, ZOOM) * 2,
    );
  });
});

const BOLT = PROSPECTOR_MUZZLES.bolt;

describe('altura de voo do projetil', () => {
  it('nasce na boca do cano e assenta no plano de combate', () => {
    expect(projectileHeightTiles(0, BOLT)).toBeCloseTo(PROSPECTOR_MUZZLE_HEIGHT_TILES, 6);
    expect(projectileHeightTiles(MUZZLE_SETTLE_TILES, BOLT)).toBeCloseTo(COMBAT_PLANE_TILES, 6);
    // Depois de assentar ela nao volta a subir, por mais longe que o tiro va.
    expect(projectileHeightTiles(50, BOLT)).toBeCloseTo(COMBAT_PLANE_TILES, 6);
  });

  it('so desce — nunca sobe de volta no meio do voo', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let d = 0; d <= MUZZLE_SETTLE_TILES; d += MUZZLE_SETTLE_TILES / 20) {
      const height = projectileHeightTiles(d, BOLT);
      expect(height).toBeLessThanOrEqual(previous + 1e-9);
      previous = height;
    }
  });

  /**
   * O que voa do CHAO ja nasce no plano: o cuspe do Spitter e a pedra do
   * Britador nao saem de arma montada em chassi nenhum, e uma descida neles
   * seria uma queda que a criatura nao fez.
   */
  it('o que e hostil fica no plano do comeco ao fim', () => {
    for (const travelled of [0, 0.3, 1, 5, 20]) {
      expect(projectileHeightTiles(travelled, null)).toBe(COMBAT_PLANE_TILES);
    }
  });

  it('distancia negativa (relogio torto) nao levanta o tiro acima do cano', () => {
    expect(projectileHeightTiles(-5, BOLT)).toBeCloseTo(PROSPECTOR_MUZZLE_HEIGHT_TILES, 6);
  });
});

/**
 * O EIXO QUE FALTAVA: a arma esta no ombro direito, nao no eixo do corpo.
 *
 * A simulacao nasce o projetil no centro do bot porque e ali que a colisao
 * dele comeca. Sem esta correcao o jogador via o tiro sair do peito, um terco
 * de tile ao lado da boca que visivelmente o cuspia — e o defeito era pior na
 * Minigun, onde ele aparece dezesseis vezes por segundo.
 */
describe('deslocamento lateral ate a boca', () => {
  it('nasce na boca e converge para a trajetoria autoritativa', () => {
    expect(muzzleLateralTiles(0, BOLT)).toBeCloseTo(BOLT.lateral, 6);
    expect(muzzleLateralTiles(MUZZLE_SETTLE_TILES, BOLT)).toBeCloseTo(0, 6);
    // Convergir NAO e opcional: a colisao acontece na posicao autoritativa, e
    // um deslocamento permanente faria o tiro desenhado passar ao lado do que
    // ele de fato acerta.
    expect(muzzleLateralTiles(50, BOLT)).toBeCloseTo(0, 6);
  });

  it('so encolhe — nunca reabre no meio do voo', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let d = 0; d <= MUZZLE_SETTLE_TILES; d += MUZZLE_SETTLE_TILES / 20) {
      const lateral = muzzleLateralTiles(d, BOLT);
      expect(lateral).toBeLessThanOrEqual(previous + 1e-9);
      previous = lateral;
    }
  });

  it('o que sai do chao nao tem boca, e nao anda de lado', () => {
    for (const travelled of [0, 0.5, 3]) {
      expect(muzzleLateralTiles(travelled, null)).toBe(0);
    }
  });

  it('cada arma obedece a PROPRIA boca', () => {
    // O `kind` e o discriminador porque ele ja carrega a arma: `flechette` so
    // existe saindo da Minigun. Um numero unico poria a bala dela nascendo
    // atras dos proprios canos.
    expect(muzzleForProjectile('flechette', false)).toBe(PROSPECTOR_MUZZLES.minigun);
    expect(muzzleForProjectile('bolt', false)).toBe(PROSPECTOR_MUZZLES.bolt);
    expect(muzzleForProjectile('return_disc', false)).toBe(PROSPECTOR_MUZZLES.bolt);
    expect(PROSPECTOR_MUZZLES.minigun.height).not.toBe(PROSPECTOR_MUZZLES.bolt.height);
  });

  it('o que e hostil nao tem boca, venha de que tipo vier', () => {
    for (const kind of ['spit', 'rock', 'bolt']) {
      expect(muzzleForProjectile(kind, true)).toBeNull();
    }
  });
});
