import { describe, expect, it } from 'vitest';
import { TICK_MS } from '@voxelyn/survival-sim';
import { ArrivalStats, PlayoutClock, TickEventQueue } from './playout';

/**
 * O relogio de exibicao, medido direto.
 *
 * Quatro defeitos seguidos moraram nesta logica e nenhum tinha teste proprio:
 * so dava para alcanca-los pelo `NetClient` inteiro — servidor em memoria,
 * protocolo, montagem de um `SurvivalState` — e nessa distancia eles passavam
 * batido. Aqui cada um deles e aritmetica de poucas linhas.
 */

/** Chegadas a 20 Hz perfeitas: um tick a cada TICK_MS. */
const feedSteady = (clock: PlayoutClock<number>, ticks: number, startMs = 0): number => {
  let now = startMs;
  for (let t = 1; t <= ticks; t++) {
    clock.ingest(t, now, t);
    now += TICK_MS;
  }
  return now;
};

describe('ArrivalStats: ritmo do servidor', () => {
  it('aprende o ritmo de uma cadencia regular', () => {
    const stats = new ArrivalStats();
    // Servidor 20% mais lento que o nominal (laco escorregando sob carga).
    const realMs = TICK_MS * 1.2;
    for (let i = 0; i < 400; i++) stats.observeSpan(10, realMs * 10);
    expect(stats.tickRate).toBeCloseTo(1 / realMs, 4);
  });

  /**
   * O defeito P1 do review: em TCP e comum a rede soltar dois snapshots colados
   * a cada 100 ms. Medido entre quadros VIZINHOS, o par da tempo zero (amostra
   * descartada) e o proximo par da um tick em 100 ms — metade do ritmo real. A
   * media convergia para a metade errada, a linha de render andava a meia
   * velocidade e o movimento voltava a congelar.
   *
   * Medido sobre a janela inteira do buffer, a rajada conta os ticks dela junto
   * com o tempo dela e a conta fecha.
   */
  it('nao se deixa enganar por snapshots que chegam aos pares', () => {
    const stats = new ArrivalStats();
    // 12 quadros por janela, entregues 2 a 2 a cada 100 ms: 11 ticks em 500 ms.
    for (let i = 0; i < 400; i++) stats.observeSpan(11, 500);
    expect(stats.tickRate).toBeCloseTo(11 / 500, 4);
    // O valor errado que o codigo anterior alcancava.
    expect(stats.tickRate).toBeGreaterThan(0.015);
  });

  it('ignora janela curta demais para dizer alguma coisa', () => {
    const stats = new ArrivalStats();
    const before = stats.tickRate;
    stats.observeSpan(1, TICK_MS); // um unico intervalo
    expect(stats.tickRate).toBe(before);
  });

  it('descarta amostra absurda de aba suspensa', () => {
    const stats = new ArrivalStats();
    const before = stats.tickRate;
    stats.observeSpan(1, 600_000); // dez minutos para um tick
    expect(stats.tickRate).toBe(before);
  });
});

describe('ArrivalStats: colchao de interpolacao', () => {
  /**
   * Numa cadencia perfeita o pior intervalo E de um tick — e o intervalo entre
   * dois quadros vizinhos —, entao o colchao assenta em um tick mais a folga. O
   * piso de um tick sozinho so seria alcancado por uma rede que entrega antes de
   * o servidor simular, que nao existe.
   */
  it('assenta logo acima do piso quando cada quadro chega na hora', () => {
    const stats = new ArrivalStats();
    for (let i = 0; i < 200; i++) stats.observeArrival(TICK_MS);
    expect(stats.delayTicks).toBeCloseTo(1.35, 2);
  });

  /**
   * O colchao precisa cobrir o INTERVALO entre chegadas, e nao a "lateness" de
   * cada quadro. Com os snapshots saindo aos pares, cada quadro chega "um tick
   * depois" do anterior — lateness baixa —, mas entre pares passam quase dois
   * ticks, e e essa a distancia que a linha de render atravessa sozinha.
   */
  it('cresce com o pior intervalo, nao com o intervalo medio', () => {
    const stats = new ArrivalStats();
    for (let i = 0; i < 50; i++) {
      stats.observeArrival(0); // o segundo membro do par: chegou junto
      stats.observeArrival(TICK_MS * 2); // o proximo par, dois ticks depois
    }
    expect(stats.delayTicks).toBeGreaterThan(2);
  });

  it('desce sozinho quando a rede acalma, de volta a cadencia limpa', () => {
    const stats = new ArrivalStats();
    stats.observeArrival(TICK_MS * 3); // um pico
    const afterSpike = stats.delayTicks;
    expect(afterSpike).toBeGreaterThan(3 - 1e-9);
    for (let i = 0; i < 1000; i++) stats.observeArrival(TICK_MS);
    expect(stats.delayTicks).toBeLessThan(afterSpike);
    expect(stats.delayTicks).toBeCloseTo(1.35, 2);
  });

  it('nunca passa do teto, por pior que a rede esteja', () => {
    const stats = new ArrivalStats();
    for (let i = 0; i < 20; i++) stats.observeArrival(TICK_MS * 40);
    expect(stats.delayTicks).toBe(3);
  });
});

describe('PlayoutClock', () => {
  it('sem quadro nenhum nao ha o que desenhar', () => {
    expect(new PlayoutClock<number>().sample(0)).toBeNull();
  });

  it('desenha atras do quadro mais novo, nunca a frente dele', () => {
    const clock = new PlayoutClock<number>();
    const now = feedSteady(clock, 20);
    const sample = clock.sample(now)!;
    expect(sample.tick).toBeLessThan(20);
    expect(sample.tick).toBeGreaterThanOrEqual(20 - Math.ceil(clock.delayTicks) - 1);
  });

  /**
   * O defeito P2 do review: a posicao interpola entre dois quadros, mas vida,
   * acao e quem existe nao interpolam — ou sao de um, ou sao do outro. Lidos do
   * quadro SEGUINTE enquanto o corpo ainda esta a caminho dele, o mundo aparecia
   * adiantado em ate um tick inteiro.
   */
  it('o tick da amostra e o do quadro JA ALCANCADO', () => {
    const clock = new PlayoutClock<number>();
    const now = feedSteady(clock, 20);
    for (let f = 0; f < 30; f++) {
      const sample = clock.sample(now + f * 16.7)!;
      // `from` e a carga do tick anunciado; `to` e o quadro seguinte.
      expect(sample.from).toBe(sample.tick);
      if (sample.from !== sample.to) expect(sample.to).toBe(sample.tick + 1);
    }
  });

  it('avanca em fracoes de tick, sem saltar nem recuar', () => {
    const clock = new PlayoutClock<number>();
    let now = 0;
    // Posicao continua deduzida da amostra: tick + alpha.
    const positions: number[] = [];
    for (let t = 1; t <= 60; t++) {
      clock.ingest(t, now, t);
      for (let f = 0; f < 3; f++) {
        const sample = clock.sample(now + f * 16.7);
        if (sample) positions.push(sample.tick + sample.alpha * (sample.to - sample.from));
      }
      now += TICK_MS;
    }
    const tail = positions.slice(30);
    for (let i = 1; i < tail.length; i++) {
      expect(tail[i]).toBeGreaterThanOrEqual(tail[i - 1] - 1e-9); // nunca para tras
      expect(tail[i] - tail[i - 1]).toBeLessThan(0.75); // nunca um tick de uma vez
    }
  });

  it('segura o ultimo quadro em vez de extrapolar para o que nao chegou', () => {
    const clock = new PlayoutClock<number>();
    // Desenhando junto com a chegada: o cursor precisa estar VIVO para que a
    // parada seguinte seja uma parada, e nao a ancoragem do primeiro quadro.
    let now = 0;
    for (let t = 1; t <= 20; t++) {
      clock.ingest(t, now, t);
      clock.sample(now);
      now += TICK_MS;
    }
    // A rede parou: nenhum quadro novo por dois segundos.
    const stalled = clock.sample(now + 2000)!;
    expect(stalled.tick).toBe(20);
    expect(stalled.from).toBe(stalled.to);
  });

  /**
   * O tick e o relogio da SALA: so anda para tras quando a sala e outra. Quem
   * chama precisa saber, para descartar o que ELE guarda daquele mundo.
   */
  it('avisa quando a linha do tempo reinicia', () => {
    const clock = new PlayoutClock<number>();
    const now = feedSteady(clock, 20);
    expect(clock.ingest(21, now, 21)).toBe(false);
    expect(clock.ingest(1, now + TICK_MS, 1)).toBe(true);
    expect(clock.newest).toBe(1);
  });

  it('o reenvio de um tick substitui o anterior', () => {
    const clock = new PlayoutClock<number>();
    const now = feedSteady(clock, 5);
    clock.ingest(5, now, 555);
    expect(clock.newest).toBe(555);
  });

  it('reengata de uma vez quando a distancia e grande demais para andar', () => {
    const clock = new PlayoutClock<number>();
    let now = feedSteady(clock, 20);
    clock.sample(now);
    // Aba em segundo plano: o mundo andou muito enquanto ninguem desenhava.
    now += 5000;
    for (let t = 21; t <= 120; t++) {
      clock.ingest(t, now, t);
      now += TICK_MS;
    }
    const sample = clock.sample(now)!;
    expect(sample.tick).toBeGreaterThan(110);
  });

  it('esquece tudo quando o mundo e trocado', () => {
    const clock = new PlayoutClock<number>();
    feedSteady(clock, 20);
    clock.reset();
    expect(clock.newest).toBeNull();
    expect(clock.sample(0)).toBeNull();
  });
});

describe('TickEventQueue', () => {
  /**
   * O defeito P1 do review: os eventos disparavam na CHEGADA do snapshot
   * enquanto o corpo e desenhado com o atraso do colchao. O telegraph acendia
   * antes de a criatura chegar onde atacou.
   */
  it('nao solta nada antes de a linha de render alcancar o tick', () => {
    const seen: string[] = [];
    const queue = new TickEventQueue<string>((events) => seen.push(...events));
    queue.push(10, ['a']);
    queue.push(11, ['b']);

    queue.flush(9);
    expect(seen).toEqual([]);
    queue.flush(10);
    expect(seen).toEqual(['a']);
    queue.flush(11);
    expect(seen).toEqual(['a', 'b']);
  });

  it('solta na ordem dos ticks, mesmo alcancando varios de uma vez', () => {
    const seen: string[] = [];
    const queue = new TickEventQueue<string>((events) => seen.push(...events));
    queue.push(1, ['a']);
    queue.push(2, ['b']);
    queue.push(3, ['c']);
    queue.flush(3);
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('fila cheia despacha os mais velhos em vez de engolir evento', () => {
    const seen: string[] = [];
    const queue = new TickEventQueue<string>((events) => seen.push(...events));
    for (let t = 1; t <= 100; t++) queue.push(t, [`e${t}`]);
    // Ninguem desenhou: os que passaram do teto sairam na hora, sem sumir.
    expect(seen.length).toBeGreaterThan(0);
    queue.flush(100);
    expect(seen).toHaveLength(100);
    expect(seen[0]).toBe('e1');
    expect(seen[99]).toBe('e100');
  });

  it('tick sem evento nenhum nao ocupa a fila', () => {
    const queue = new TickEventQueue<string>(() => undefined);
    queue.push(1, []);
    expect(queue.size).toBe(0);
  });

  it('mundo trocado descarta a narracao do mundo antigo', () => {
    const seen: string[] = [];
    const queue = new TickEventQueue<string>((events) => seen.push(...events));
    queue.push(10, ['setor antigo']);
    queue.clear();
    queue.flush(999);
    expect(seen).toEqual([]);
  });
});
