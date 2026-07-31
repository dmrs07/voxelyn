import { describe, expect, it } from 'vitest';
import { SurvivalServer } from '@voxelyn/survival-server';
import { createRun, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import { quantizeCommand } from '@voxelyn/survival-protocol';
import { NetClient } from '../client/net';
import { screenToWorldAim } from '../client/input';

/**
 * Onde o tiro SAI, comparado a onde o jogador apontou.
 *
 * O relato foi "a precisao dos tiros precisa de um ajuste, ataques que demoram a
 * calibrar", no solo e no co-op. A causa era uma so, e ficava entre o cursor e a
 * simulacao: a mira era capturada como a diferenca em PIXELS entre o cursor e o
 * centro da tela — centenas de unidades — e o codec do log de comandos, por onde
 * o solo passa, satura cada eixo em ±1. Os dois eixos batiam no teto juntos e a
 * mira colapsava numa das quatro diagonais.
 *
 * Estes testes medem a coisa que o jogador percebe: o angulo entre o rumo do
 * projetil e o rumo em que ele apontou, na TELA. Antes da correcao, 26,3 graus
 * de erro medio e 63 no pior caso, com apenas quatro rumos possiveis.
 */

/** Rumo de TELA de um vetor de mundo, em graus. Projecao 2:1 do renderer. */
const screenAngleOf = (x: number, y: number): number =>
  (Math.atan2((x + y) * 8, (x - y) * 16) * 180) / Math.PI;

const angleError = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Angulos de cursor cobrindo a volta inteira, sem cair so nos casos faceis. */
const CURSOR_ANGLES = Array.from({ length: 72 }, (_, i) => i * 5);

describe('pontaria: o tiro sai para onde o cursor aponta', () => {
  it('solo — o projetil segue o cursor em toda a volta', () => {
    let worst = 0;
    let total = 0;
    const headings = new Set<string>();

    for (const deg of CURSOR_ANGLES) {
      const state = createRun({ seed: 5150 });
      const rad = (deg * Math.PI) / 180;
      const cmd = emptyCommand();
      // Cursor a 300 px do centro da tela — onde o personagem esta desenhado.
      cmd.aim = screenToWorldAim(Math.cos(rad) * 300, Math.sin(rad) * 300);
      cmd.fire = true;
      // `quantizeCommand` NAO e decoracao de teste: e exatamente o que o cliente
      // solo faz antes de simular, para que o replay do ranking seja exato. O
      // defeito morava aqui.
      stepRun(state, [quantizeCommand(cmd)]);

      const bolt = state.projectiles.find((p) => !p.hostile);
      expect(bolt, `${deg} graus`).toBeDefined();
      const error = angleError(screenAngleOf(bolt!.vx, bolt!.vy), deg);
      worst = Math.max(worst, error);
      total += error;
      headings.add(`${Math.round(bolt!.vx * 1e4)},${Math.round(bolt!.vy * 1e4)}`);
    }

    // Meio grau e o passo do proprio codec (1/127 de vetor unitario) esticado
    // pela projecao 2:1; dezenas de graus era o defeito.
    expect(worst).toBeLessThan(0.6);
    expect(total / CURSOR_ANGLES.length).toBeLessThan(0.2);
    // E, o mais direto de tudo: cada rumo de cursor produz um rumo de tiro
    // proprio. Antes, os 72 colapsavam em 4.
    expect(headings.size).toBe(CURSOR_ANGLES.length);
  });

  it('co-op — o servidor atira no rumo que o cliente mandou', () => {
    let worst = 0;
    for (const deg of CURSOR_ANGLES) {
      const server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 5150 });
      let now = 0;
      const client: NetClient = new NetClient((raw) => {
        for (const o of server.handleMessage('A', raw, now)) {
          client.receive(JSON.stringify(o.msg), now);
        }
      });
      server.addConnection('A', now);
      client.connect();
      for (let t = 0; t < 3; t++) {
        now += 50;
        for (const o of server.tick()) client.receive(JSON.stringify(o.msg), now);
      }

      const rad = (deg * Math.PI) / 180;
      const cmd = emptyCommand();
      cmd.aim = screenToWorldAim(Math.cos(rad) * 300, Math.sin(rad) * 300);
      cmd.fire = true;
      client.setCommand(cmd);
      now += 50;
      client.pump(now);
      server.tick();

      const room = server.roomForClient('A')!;
      const bolt = room.state.projectiles.find((p) => !p.hostile);
      expect(bolt, `${deg} graus`).toBeDefined();
      worst = Math.max(worst, angleError(screenAngleOf(bolt!.vx, bolt!.vy), deg));
    }
    // Sem quantizacao no caminho de rede: o unico erro e o do float.
    expect(worst).toBeLessThan(1e-6);
  });
});
