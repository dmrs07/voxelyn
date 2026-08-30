import { describe, expect, it } from 'vitest';
import { layerDepthDispute } from '../tools/voxel.mjs';
import { ATTACK_FLASH, LAYER_POSE_FRAMES, poseFor } from '../tools/player-layers.mjs';
import { VOXELS_PER_TILE, prospectorParts } from '../tools/prospector.mjs';
import { minigunGun } from '../tools/prospector-modules.mjs';
import {
  PLAYER_GUN_BEHIND_DIRS,
  PROSPECTOR_MUZZLES,
  gunBehindUpper,
  PROSPECTOR_MUZZLE_FLASH_FRAME,
  PROSPECTOR_MUZZLE_HEIGHT_TILES,
} from '../src/manifest';

const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

/**
 * A ordem em que o cliente desenha tronco e arma nao pode ser opiniao.
 *
 * Dentro de um modelo unico a profundidade se resolve voxel a voxel; separando a
 * arma num atlas proprio — para o calor do cano poder pintar so ela — sobrou
 * apenas a ordem das duas chamadas de desenho. Este teste recalcula, a partir
 * dos MESMOS voxels que geram os atlas, de que lado do tronco a arma cai em cada
 * direcao, e cobra que a tabela do runtime diga a mesma coisa.
 *
 * Sem ele, mexer na montagem da arma ou na rotacao das direcoes deixaria o cano
 * flutuando sobre o peito sem nenhum teste vermelho.
 */
describe('profundidade entre tronco e arma do Prospector', () => {
  const verdicts = Object.entries(DIR_INDEX).map(([dir, index]) => {
    let disputed = 0;
    let gunInFront = 0;
    for (const [anim, frames] of Object.entries(LAYER_POSE_FRAMES)) {
      for (let frame = 0; frame < frames; frame++) {
        const pose = poseFor(anim, frame);
        const dispute = layerDepthDispute(pose.gun, pose.upper, index);
        disputed += dispute.disputed;
        gunInFront += dispute.aInFront;
      }
    }
    return { dir, disputed, share: gunInFront / disputed };
  });

  it('mede sobreposicao real entre as duas camadas em toda direcao', () => {
    // Sem pixel disputado o teste passaria vazio, concordando com qualquer
    // tabela — inclusive com uma tabela errada.
    for (const { dir, disputed } of verdicts) {
      expect(disputed, `direcao ${dir}`).toBeGreaterThan(100);
    }
  });

  it('publica no runtime as direcoes em que o chassi cobre a arma', () => {
    const behind = verdicts.filter((v) => v.share < 0.5).map((v) => v.dir);
    expect(behind.sort()).toEqual([...PLAYER_GUN_BEHIND_DIRS].sort());
  });

  it('responde pelo vetor de rumo, que e o que o cliente tem em maos', () => {
    // O cliente nao conhece 'dl'/'ur': ele tem a mira e o andar em coordenadas
    // de mundo. +y e dl, +x e dr.
    expect(gunBehindUpper(0, 1)).toBe(true);
    expect(gunBehindUpper(1, 0)).toBe(false);
  });

  /**
   * `dr` e a direcao de folga curta: a arma fica na quina do corpo, metade a
   * frente e metade atras, e nenhuma das duas ordens acerta todos os pixels. As
   * outras tres sao decididas com folga, e e nelas que a arma por cima gritava.
   */
  it('decide as tres direcoes de costas com folga larga', () => {
    for (const { dir, share } of verdicts) {
      if (dir === 'dr') continue;
      expect(share, `direcao ${dir}`).toBeLessThan(0.2);
    }
  });
});

/**
 * De onde o tiro SAI, e quando o disparo acende.
 *
 * Os dois numeros vivem no modelo e sao consumidos pelo cliente, que nao tem
 * como olhar para os voxels: um manda o estilhaco voar na altura do cano em vez
 * de na barriga do bot, o outro acende a armadura no mesmo quadro em que a boca
 * do cano acende. Escrever qualquer um dos dois a olho e como eles saem de fase
 * com a arte sem nenhum teste reclamar.
 */
describe('boca do cano do Prospector', () => {
  // A boca e o voxel que TROCA DE MATERIAL no clarao: e ele que cospe, e achá-lo
  // assim dispensa apontar um indice de caixa que a proxima edicao do modelo
  // embaralharia.
  const cold = prospectorParts({ flash: false }).gun;
  const lit = prospectorParts({ flash: true }).gun;
  const muzzle = cold.filter((box, i) => box.mat !== lit[i].mat);

  it('tem uma boca so, e e ela que acende', () => {
    expect(muzzle).toHaveLength(1);
  });

  /**
   * As TRES medidas, e nao so a altura.
   *
   * O ponto de referencia e o CENTRO do voxel, e nao o canto: o tiro sai do
   * meio do cano. A versao anterior publicava `box.z` cru — a borda de baixo —,
   * meio voxel abaixo de onde a boca de fato esta.
   */
  const offsetOf = (box) => ({
    forward: -(box.y + box.d / 2) / VOXELS_PER_TILE,
    lateral: (box.x + box.w / 2) / VOXELS_PER_TILE,
    height: (box.z + box.h / 2) / VOXELS_PER_TILE,
  });

  it('publica as tres medidas da boca, tiradas dos voxels', () => {
    expect(PROSPECTOR_MUZZLES.bolt).toEqual(offsetOf(muzzle[0]));
    expect(PROSPECTOR_MUZZLE_HEIGHT_TILES).toBe(PROSPECTOR_MUZZLES.bolt.height);
    // Bem acima do meio tile em que o projetil voava: a diferenca entre sair da
    // arma e sair da barriga.
    expect(PROSPECTOR_MUZZLE_HEIGHT_TILES).toBeGreaterThan(1);
  });

  it('a boca esta ao LADO do eixo do corpo, que e o defeito que ela corrige', () => {
    // A arma e montada no ombro direito. Um deslocamento lateral de zero seria
    // o tiro nascendo no centro do bot — que era o comportamento anterior, e
    // dele a boca dista um terco de tile.
    expect(PROSPECTOR_MUZZLES.bolt.lateral).toBeGreaterThan(0.25);
    expect(PROSPECTOR_MUZZLES.minigun.lateral).toBeGreaterThan(0.25);
  });

  it('a Minigun tem boca PROPRIA, a frente e acima da do Cravador', () => {
    const mgCold = minigunGun({ flash: false });
    const mgLit = minigunGun({ flash: true });
    const mgMuzzle = mgCold.filter((box, i) => box.mat !== mgLit[i].mat);
    expect(mgMuzzle).toHaveLength(1);
    expect(PROSPECTOR_MUZZLES.minigun).toEqual(offsetOf(mgMuzzle[0]));
    // Um numero unico para as duas armas poria o tiro da Minigun nascendo
    // ATRAS dos proprios canos — e dezesseis vezes por segundo.
    expect(PROSPECTOR_MUZZLES.minigun.forward).toBeGreaterThan(PROSPECTOR_MUZZLES.bolt.forward);
    expect(PROSPECTOR_MUZZLES.minigun.height).toBeGreaterThan(PROSPECTOR_MUZZLES.bolt.height);
  });

  it('publica o quadro do clarao, e ele e unico na animacao', () => {
    expect(ATTACK_FLASH.filter(Boolean)).toHaveLength(1);
    expect(ATTACK_FLASH.indexOf(true)).toBe(PROSPECTOR_MUZZLE_FLASH_FRAME);
  });
});
