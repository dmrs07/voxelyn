import { describe, expect, it } from 'vitest';
import { layerDepthDispute } from '../tools/voxel.mjs';
import { ALL_MODULE_IDS, moduleLayerId } from '../tools/player-layers.mjs';
import { MODULE_ATTACHMENTS, minigunGun } from '../tools/prospector-modules.mjs';
import { gunAnchor, prospectorParts } from '../tools/prospector.mjs';
import { MODULE_LAYER_SPRITE_IDS, PLAYER_GUN_BEHIND_DIRS } from '../src/manifest';

const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };
const POSES = [
  ...[0, 0, 1, 0].map((bob) => ({ bob })),
  ...[0, 2, 1, 0].map((kick) => ({ kick })),
];

const boxesFor = (id, pose, frame) =>
  id === 'minigun'
    ? minigunGun({ ...pose, fan: frame })
    : MODULE_ATTACHMENTS[id](gunAnchor(pose));

/**
 * A ordem em que o cliente desenha corpo e MODULO, medida nos voxels.
 *
 * Mesma conta do `prospector-gun-depth`, e pela mesma razao: dentro de um
 * modelo a profundidade se resolve voxel a voxel; entre dois atlas so existe a
 * ordem das duas chamadas de desenho. A diferenca e que aqui ha SETE camadas
 * novas, e um erro de ordem em qualquer uma poe uma peca de metal atravessando
 * o peito do bot.
 */
describe('profundidade entre corpo e modulos acoplados', () => {
  const verdict = (id) =>
    Object.entries(DIR_INDEX).map(([dir, index]) => {
      let disputed = 0;
      let inFront = 0;
      POSES.forEach((pose, frame) => {
        const d = layerDepthDispute(boxesFor(id, pose, frame % 4), prospectorParts(pose).upper, index);
        disputed += d.disputed;
        inFront += d.aInFront;
      });
      return { dir, disputed, share: disputed ? inFront / disputed : 0 };
    });

  it('toda camada de modulo disputa pixel com o corpo nas direcoes decididas', () => {
    // Sem pixel disputado a medida concordaria com qualquer ordem, inclusive
    // com a errada. As duas direcoes que o bloco seguinte trava (dr e ul) tem
    // de disputar de verdade; nas outras a peca pode estar limpa do corpo —
    // desde que a arma vive na mao do braco, o perfurante em `dl` aponta para
    // fora da silhueta e nao encosta em pixel nenhum do chassi, e ali a ordem
    // nao muda nada.
    for (const id of ALL_MODULE_IDS) {
      const byDir = Object.fromEntries(verdict(id).map((v) => [v.dir, v.disputed]));
      expect(byDir.dr, `${id} em dr`).toBeGreaterThan(20);
      expect(byDir.ul, `${id} em ul`).toBeGreaterThan(20);
    }
  });

  /**
   * Os modulos HERDAM a ordem da arma, e essa e a decisao que este bloco trava.
   *
   * Eles estao parafusados nela: separar as duas ordens deixaria uma peca cair
   * do lado oposto ao da arma em que ela esta montada, que e pior do que os
   * poucos pixels que a heranca erra. A medida sustenta a heranca nas duas
   * direcoes unanimes — `dr` a frente em todos os sete modulos, `ul` atras em
   * todos os sete.
   *
   * A EXCECAO conhecida e `ur`: ali `ricochet` e `siphon` deveriam vir a frente
   * (eles ficam no flanco EXTERNO, o lado que a camera ve nessa direcao) e a
   * heranca os poe atras. Sao 36 e 342 pixels de peca pequena e baixa, contra a
   * alternativa de uma tabela por modulo que precisaria ser mantida a mao a cada
   * ajuste de montagem. Fica registrado aqui em vez de descoberto no jogo.
   */
  it('a frente em dr e atras em ul, unanimemente, como a arma', () => {
    expect(PLAYER_GUN_BEHIND_DIRS).not.toContain('dr');
    expect(PLAYER_GUN_BEHIND_DIRS).toContain('ul');
    for (const id of ALL_MODULE_IDS) {
      const byDir = Object.fromEntries(verdict(id).map((v) => [v.dir, v.share]));
      expect(byDir.dr, `${id} deveria estar a frente em dr`).toBeGreaterThan(0.85);
      expect(byDir.ul, `${id} deveria estar atras em ul`).toBeLessThan(0.15);
    }
  });

  it('cada modulo tem um atlas registrado no manifesto', () => {
    expect([...MODULE_LAYER_SPRITE_IDS].sort()).toEqual(ALL_MODULE_IDS.map(moduleLayerId).sort());
  });
});

/**
 * A Minigun SUBSTITUI a arma, e por isso precisa cuspir da mesma altura.
 *
 * Se a boca dela ficasse noutro nivel, o estilhaco mudaria de altura ao trocar
 * de arma — e `PROSPECTOR_MUZZLE_HEIGHT_TILES`, que o cliente usa para fazer o
 * projetil nascer no cano, passaria a mentir para uma das duas.
 */
describe('a Minigun no lugar do Cravador', () => {
  it('acende UMA boca so, e no mesmo quadro', () => {
    const cold = minigunGun({ flash: false });
    const lit = minigunGun({ flash: true });
    const muzzle = cold.filter((box, i) => box.mat !== lit[i].mat);
    expect(muzzle).toHaveLength(1);
  });

  it('cospe na mesma altura que o Cravador', () => {
    const mgMuzzle = minigunGun({ flash: false }).filter(
      (box, i) => box.mat !== minigunGun({ flash: true })[i].mat,
    )[0];
    const gun = prospectorParts({ flash: false }).gun;
    const gunMuzzle = gun.filter((box, i) => box.mat !== prospectorParts({ flash: true }).gun[i].mat)[0];
    expect(mgMuzzle.z).toBe(gunMuzzle.z + 0.5);
  });

  it('a ventoinha ANDA a cada quadro de attack', () => {
    // A rotacao nesta escala se le por ALTERNANCIA, nao por movimento angular.
    // Quatro quadros identicos entregariam um canhao rotativo parado.
    const seen = new Set(
      [0, 1, 2, 3].map((fan) => JSON.stringify(minigunGun({ fan }).find((b) => b.mat === 'loot'))),
    );
    expect(seen.size).toBe(4);
  });
});
