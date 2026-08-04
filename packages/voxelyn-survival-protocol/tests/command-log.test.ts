import { describe, expect, it } from 'vitest';
import { emptyCommand } from '@voxelyn/survival-sim';
import type { PlayerCommand } from '@voxelyn/survival-sim';
import {
  COMMAND_BYTES,
  commandLogLength,
  decodeCommandLog,
  encodeCommandLog,
  fromBase64,
  quantizeCommand,
  toBase64,
} from '../src/command-log.js';

const cmd = (over: Partial<PlayerCommand> = {}): PlayerCommand => ({ ...emptyCommand(), ...over });

describe('quantizacao', () => {
  // A propriedade que o leaderboard inteiro depende: o comando que o jogador
  // JOGA e o comando que o servidor REPRODUZ. Sem idempotencia, o replay
  // diverge do original e uma run honesta e recusada como fraude.
  it('e idempotente', () => {
    const original = cmd({ aim: { x: 0.37219, y: -0.9284 }, move: { x: 1, y: -1 } });
    const once = quantizeCommand(original);
    expect(quantizeCommand(once)).toEqual(once);
  });

  it('sobrevive a ida e volta pelo log', () => {
    const original = quantizeCommand(cmd({ aim: { x: 0.3721, y: -0.9284 } }));
    const decoded = decodeCommandLog(encodeCommandLog([original]), 10)!;
    expect(decoded[0]).toEqual(original);
  });

  it('preserva o extremo dos eixos do movimento', () => {
    const q = quantizeCommand(cmd({ move: { x: 1, y: -1 } }));
    expect(q.move.x).toBe(1);
    expect(q.move.y).toBe(-1);
  });

  it('preserva um eixo de mira que ja cabe na faixa', () => {
    const q = quantizeCommand(cmd({ aim: { x: -1, y: 0 } }));
    expect(q.aim.x).toBe(-1);
    expect(q.aim.y).toBe(0);
  });

  it('mira NEUTRA (zero) atravessa o codec como zero, nunca vira um rumo', () => {
    // O comando neutro significa "sem mira nova, preserve a ultima": se a
    // quantizacao ou o log inventassem um rumo aqui, o replay giraria o
    // personagem para um lado que o jogador nunca apontou.
    const neutral = quantizeCommand(cmd());
    expect(neutral.aim).toEqual({ x: 0, y: 0 });
    const decoded = decodeCommandLog(encodeCommandLog([neutral]), 10)!;
    expect(decoded[0].aim).toEqual({ x: 0, y: 0 });
  });

  /**
   * O defeito que custou a pontaria do jogo.
   *
   * `q` satura cada eixo em ±1 — o cabecalho deste arquivo sempre presumiu que a
   * mira chegava unitaria, mas nada garantia isso. O cliente mandava a diferenca
   * em PIXELS entre o cursor e o centro da tela, na casa das centenas: os dois
   * eixos batiam no teto juntos e o vetor inteiro colapsava numa das quatro
   * diagonais. Varrendo o cursor em volta do personagem, 360 rumos viravam
   * QUATRO, e o tiro so saia em quatro direcoes de tela.
   *
   * A magnitude nao tem dono aqui: a simulacao normaliza a mira de qualquer
   * forma. O que o codec precisa entregar intacto e o RUMO.
   */
  it('preserva o rumo da mira mesmo com o vetor fora de escala', () => {
    for (let deg = 0; deg < 360; deg += 7) {
      const rad = (deg * Math.PI) / 180;
      const direction = { x: Math.cos(rad), y: Math.sin(rad) };
      for (const scale of [1, 7, 300, 12_000]) {
        const q = quantizeCommand(cmd({ aim: { x: direction.x * scale, y: direction.y * scale } }));
        const cross = q.aim.x * direction.y - q.aim.y * direction.x;
        const dot = q.aim.x * direction.x + q.aim.y * direction.y;
        const error = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
        expect(error, `${deg} graus x${scale}`).toBeLessThan(0.4);
      }
    }
  });

  it('continua idempotente com a mira fora de escala', () => {
    const once = quantizeCommand(cmd({ aim: { x: 431, y: -298 } }));
    expect(quantizeCommand(once)).toEqual(once);
  });

  it('nao explode com valores nao finitos vindos de input quebrado', () => {
    const q = quantizeCommand(cmd({ aim: { x: NaN, y: Infinity } }));
    expect(Number.isFinite(q.aim.x)).toBe(true);
    expect(Number.isFinite(q.aim.y)).toBe(true);
  });
});

describe('codificacao do log', () => {
  it('preserva todas as flags e a escolha', () => {
    const commands = [
      cmd({ fire: true }),
      cmd({ ability: true }),
      cmd({ dodge: true }),
      cmd({ interact: true }),
      cmd({ purge: true }),
      cmd({ choose: 0 }),
      cmd({ choose: 1 }),
      cmd({ fire: true, dodge: true, purge: true, choose: 1 }),
    ].map(quantizeCommand);
    expect(decodeCommandLog(encodeCommandLog(commands), 100)).toEqual(commands);
  });

  // Gente segura a mesma direcao por segundos a fio: cada segundo parado sao 20
  // comandos identicos. E a diferenca entre um envio que passa em rede movel e
  // um que o jogador cancela.
  it('comprime forte quando a intencao nao muda', () => {
    const parado = Array.from({ length: 12000 }, () => quantizeCommand(cmd({ move: { x: 1, y: 0 } })));
    const encoded = encodeCommandLog(parado);
    expect(encoded.length).toBeLessThan(parado.length * COMMAND_BYTES / 100);
    expect(decodeCommandLog(encoded, 20000)).toHaveLength(12000);
  });

  it('conta o tamanho sem decodificar tudo', () => {
    const commands = Array.from({ length: 500 }, (_, i) =>
      quantizeCommand(cmd({ fire: i % 7 === 0, move: { x: (i % 3) - 1, y: 0 } }))
    );
    expect(commandLogLength(encodeCommandLog(commands))).toBe(500);
  });

  it('log vazio ida e volta', () => {
    expect(decodeCommandLog(encodeCommandLog([]), 10)).toEqual([]);
  });
});

describe('robustez contra entrada hostil', () => {
  // Um cliente hostil nao pode derrubar o processo mandando bytes tortos: o
  // decodificador devolve null e o servidor trata como submissao invalida.
  it('recusa comprimento que nao e multiplo do bloco', () => {
    expect(decodeCommandLog(new Uint8Array([1, 2, 3]), 100)).toBeNull();
  });

  it('recusa bloco com contagem zero', () => {
    const bad = new Uint8Array(2 + COMMAND_BYTES); // run = 0
    expect(decodeCommandLog(bad, 100)).toBeNull();
  });

  it('recusa os bits reservados 0b11 do campo choose', () => {
    const bad = encodeCommandLog([quantizeCommand(cmd())]);
    bad[2 + COMMAND_BYTES - 1] = 0b11 << 5;
    expect(decodeCommandLog(bad, 100)).toBeNull();
  });

  // Sem o teto, um unico bloco declarando 65535 repeticoes forcaria a alocacao
  // de milhoes de objetos antes de qualquer outra checagem.
  it('recusa log que estoura o teto de comandos', () => {
    const commands = Array.from({ length: 100 }, () => quantizeCommand(cmd()));
    expect(decodeCommandLog(encodeCommandLog(commands), 50)).toBeNull();
  });
});

describe('base64 sem Buffer nem btoa', () => {
  it('ida e volta para todo comprimento de padding', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 0xff);
      const back = fromBase64(toBase64(bytes));
      expect(back, `n=${n}`).toEqual(bytes);
    }
  });

  it('cobre a faixa completa de bytes', () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it('recusa texto que nao e base64', () => {
    expect(fromBase64('nao é base64!')).toBeNull();
    expect(fromBase64('####')).toBeNull();
  });
});
