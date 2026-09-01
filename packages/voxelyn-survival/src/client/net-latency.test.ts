// A aritmetica da latencia, que e a parte capaz de errar em silencio.
//
// Um numero de rede errado na tela nao trava nada: ele so faz o jogador culpar
// a propria conexao por um problema que nao tem, ou o contrario. Por isso o
// que se testa aqui e a MEDIDA (mediana robusta a pico, variacao em torno
// dela) e a decisao de o que mostrar em cada situacao — nao o socket.

import { describe, expect, it } from 'vitest';
import { TICK_MS } from '@voxelyn/survival-sim';
import {
  LATENCY_WINDOW,
  LatencyWindow,
  cushionMs,
  latencyGrade,
  netReadout,
  probeServerLatency,
} from './net-latency';

const windowWith = (...samples: number[]): LatencyWindow => {
  const win = new LatencyWindow();
  for (const sample of samples) win.push(sample);
  return win;
};

describe('janela de idas e voltas', () => {
  it('sem amostra nao inventa zero: nao ha leitura', () => {
    expect(new LatencyWindow().read()).toBeNull();
  });

  it('a mediana ignora um pico isolado', () => {
    // Uma amostra de 900 ms (GC, troca de antena) no meio de uma conexao de
    // 40 ms: a media daria ~212, a mediana continua dizendo 40.
    const win = windowWith(40, 40, 900, 40, 40);
    expect(win.read()?.rttMs).toBe(40);
  });

  it('a variacao mede o quanto a conexao balanca', () => {
    expect(windowWith(50, 50, 50, 50).read()?.jitterMs).toBe(0);
    expect(windowWith(40, 60).read()?.jitterMs).toBe(10);
  });

  it('guarda so a janela, descartando as mais velhas', () => {
    const win = new LatencyWindow();
    for (let i = 0; i < LATENCY_WINDOW + 5; i++) win.push(100);
    expect(win.read()?.samples).toBe(LATENCY_WINDOW);
  });

  // Relogio que anda para tras, `pong` de outra sessao: o que nao pode e uma
  // amostra impossivel entrar na conta e mentir na tela.
  it('descarta amostras impossiveis', () => {
    const win = windowWith(50, -10, Number.NaN, Number.POSITIVE_INFINITY);
    expect(win.read()?.samples).toBe(1);
    expect(win.read()?.rttMs).toBe(50);
  });

  it('reconectar zera a medida', () => {
    const win = windowWith(50, 60);
    win.reset();
    expect(win.read()).toBeNull();
  });
});

describe('leitura em faixas', () => {
  it('classifica pela distancia em ticks', () => {
    expect(latencyGrade(30)).toBe('good');
    expect(latencyGrade(80)).toBe('good');
    expect(latencyGrade(120)).toBe('fair');
    expect(latencyGrade(161)).toBe('poor');
  });

  it('o colchao e dito em ms, e nao em ticks', () => {
    expect(cushionMs(2)).toBe(2 * TICK_MS);
  });
});

describe('o que a folha de Opcoes mostra', () => {
  const live = (rtt: number) => ({
    latency: { rttMs: rtt, jitterMs: 4, samples: 6 },
    delayTicks: 2,
  });

  it('numa sala com pong respondido, os numeros medidos', () => {
    const readout = netReadout(live(70), undefined);
    expect(readout).toEqual({
      kind: 'live',
      rttMs: 70,
      cushionMs: 2 * TICK_MS,
      grade: 'good',
    });
  });

  /**
   * A variacao da janela NAO chega a tela.
   *
   * Ela carrega o ritmo de quadro deste aparelho — o `pong` so e lido quando o
   * laco de render solta a thread —, e contra localhost saiu em 39 ms para uma
   * mediana de 14. Quem responde por irregularidade e o colchao. Ver o tipo
   * `NetReadout`.
   */
  it('nao publica a variacao da janela: ela mede o proprio FPS junto', () => {
    expect(netReadout(live(70), undefined)).not.toHaveProperty('jitterMs');
  });

  /**
   * A sala manda enquanto ela existir — mesmo antes do primeiro `pong`.
   *
   * O contrario seria mostrar, no meio do co-op, o resultado de uma sondagem
   * feita antes de entrar: um numero de outro caminho, com cara de atual.
   */
  it('numa sala ainda sem resposta, diz que nao sabe em vez de reusar a sondagem', () => {
    const semPong = { latency: null, delayTicks: 1 };
    expect(netReadout(semPong, 42)).toEqual({ kind: 'idle' });
  });

  it('fora de sala, o resultado da sondagem', () => {
    expect(netReadout(null, 120)).toEqual({ kind: 'probe', rttMs: 120, grade: 'fair' });
  });

  it('sondagem que nao chegou e diferente de nunca ter sondado', () => {
    expect(netReadout(null, null)).toEqual({ kind: 'unreachable' });
    expect(netReadout(null, undefined)).toEqual({ kind: 'idle' });
  });

  /**
   * Sem socket de pe, quem manda e a sondagem.
   *
   * `netStats` devolve `null` fora de `online` (ver `net.ts`), e e isso que
   * impede os dois enganos: conectando, a sala reivindicaria a tela sem numero
   * nenhum e engoliria o resultado da sondagem; caida, ela seguiria mostrando
   * a ida e volta do socket anterior como se fosse de agora.
   */
  it('sala fora do ar nao engole a sondagem', () => {
    expect(netReadout(null, 90)).toEqual({ kind: 'probe', rttMs: 90, grade: 'fair' });
  });
});

describe('sondagem avulsa', () => {
  const withFetch = async (
    impl: typeof globalThis.fetch,
    run: () => Promise<unknown>,
  ): Promise<unknown> => {
    const real = globalThis.fetch;
    globalThis.fetch = impl;
    try {
      return await run();
    } finally {
      globalThis.fetch = real;
    }
  };

  it('mede a ida e volta quando o servidor responde', async () => {
    const result = await withFetch(
      (async () => new Response(null)) as typeof globalThis.fetch,
      () => probeServerLatency('ws://exemplo:8080'),
    );
    expect(typeof result).toBe('number');
    expect(result as number).toBeGreaterThanOrEqual(0);
  });

  /**
   * O destino que aceita a conexao e nunca responde.
   *
   * Sem teto, a promessa fica pendurada e a tela trava em "medindo…" — com o
   * botao inerte, porque a tentativa seguinte e recusada enquanto esta nao
   * volta. O teto tem de devolver `null` pelo mesmo caminho de "nao deu para
   * medir".
   */
  it('desiste no teto em vez de ficar pendurada', async () => {
    const nuncaResponde: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('abortado')));
      });
    const result = await withFetch(nuncaResponde, () =>
      probeServerLatency('ws://exemplo:8080', 20),
    );
    expect(result).toBeNull();
  });

  it('servidor inacessivel devolve null', async () => {
    const result = await withFetch(
      (() => Promise.reject(new Error('sem rota'))) as typeof globalThis.fetch,
      () => probeServerLatency('ws://exemplo:8080', 50),
    );
    expect(result).toBeNull();
  });
});
