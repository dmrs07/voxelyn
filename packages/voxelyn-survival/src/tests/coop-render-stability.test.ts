import { describe, expect, it } from 'vitest';
import { SurvivalServer } from '@voxelyn/survival-server';
import { emptyCommand } from '@voxelyn/survival-sim';
import { dirFromFacing } from '@voxelyn/survival-content';
import { NetClient } from '../client/net';
import { EntityPresentation } from '../client/presentation';
import { deriveAnim, type EntityAnimState } from '../client/sprites';

/**
 * O que o jogador VE no co-op, quadro a quadro.
 *
 * Os dois defeitos que este arquivo tranca foram reportados juntos e tem a mesma
 * raiz — o cliente online desenhando a partir de dados que so parecem continuos:
 *
 * 1. "o personagem fica num flicker absurdo alternando rapidamente o facing":
 *    andar reto na tela cai sobre a fronteira entre dois quadrantes do sprite, e
 *    o arredondamento do servidor decidia o desempate por sorte a cada quadro.
 * 2. "senti meu personagem teleportar": a interpolacao pendurava no INTERVALO DE
 *    CHEGADA dos snapshots, entao rajada de rede virava salto e silencio virava
 *    congelamento.
 *
 * Nenhum dos dois aparece no solo, e por isso nenhum teste de simulacao os
 * pegava: no solo as duas componentes do deslocamento sao iguais bit a bit e o
 * quadro vem do laco local. Sao defeitos do CAMINHO DE REDE, e e nele que estes
 * testes vivem.
 */

/** Laco em memoria com controle de quando cada mensagem CHEGA no cliente. */
class JitteryLoop {
  readonly server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 5150 });
  readonly client: NetClient;
  now = 0;
  private nextTickAt = 0;
  private readonly inflight: Array<{ at: number; raw: string }> = [];
  private seed = 987654321;

  constructor(private readonly jitterMs = 0) {
    this.server.addConnection('A', 0);
    this.client = new NetClient((raw) => {
      for (const o of this.server.handleMessage('A', raw, this.now)) {
        this.deliver(JSON.stringify(o.msg));
      }
    });
  }

  /** Tick autoritativo da sala neste instante. */
  get serverTick(): number {
    return this.server.roomForClient('A')?.state.tick ?? 0;
  }

  /** PRNG deterministico: um teste de jitter que sorteia de verdade nao repete falha. */
  private random(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /**
   * Entrega em ORDEM, como TCP. Um pacote atrasado segura os que vem depois —
   * e por isso que a rajada existe, e a rajada e metade do defeito.
   */
  private deliver(raw: string): void {
    const previous = this.inflight[this.inflight.length - 1]?.at ?? 0;
    this.inflight.push({ at: Math.max(previous, this.now + this.random() * this.jitterMs), raw });
  }

  /** Avanca um quadro de render (60 Hz), entregando o que a rede ja soltou. */
  frame(): void {
    this.now += 1000 / 60;
    if (this.now >= this.nextTickAt) {
      this.nextTickAt = this.now + 1000 / 20;
      for (const o of this.server.tick()) this.deliver(JSON.stringify(o.msg));
    }
    while (this.inflight.length > 0 && this.inflight[0].at <= this.now) {
      this.client.receive(this.inflight.shift()!.raw, this.now);
    }
  }
}

type RenderedFrame = {
  /** Posicao na sequencia original, para nao comparar quadros nao vizinhos. */
  index: number;
  /** Quadrante do sprite que o renderer desenharia neste quadro. */
  dir: string;
  anim: string;
  x: number;
  y: number;
  /** Rumo OBSERVADO do deslocamento — a entrada crua do rumo das pernas. */
  moveX: number;
  moveY: number;
};

/** Roda a run e devolve, por quadro, o que o renderer desenharia do jogador. */
const walk = (loop: JitteryLoop, move: { x: number; y: number }, frames: number): RenderedFrame[] => {
  const anims = new Map<number, EntityAnimState>();
  const presentation = new EntityPresentation();
  const out: RenderedFrame[] = [];
  for (let f = 0; f < frames; f++) {
    loop.frame();
    const cmd = emptyCommand();
    cmd.move = move;
    // Mira travada para +x: o rumo das PERNAS e o unico que muda, e e ele que
    // piscava. Uma mira acompanhando o andar esconderia o defeito.
    cmd.aim = { x: 1, y: 0 };
    loop.client.setCommand(cmd);
    loop.client.pump(loop.now);
    const state = loop.client.sampleRenderState(loop.now);
    if (!state || !state.playerExtras[0].joined) continue;
    const player = state.players[0];
    const anim = deriveAnim(anims.get(player.id), player.x, player.y, player.hp, player.alive, loop.now);
    anims.set(player.id, anim);
    const presented = presentation.animationFor(player, state, anim, loop.now, false);
    out.push({
      index: f,
      dir: dirFromFacing(presented.facingX, presented.facingY),
      anim: anim.anim,
      x: player.x,
      y: player.y,
      moveX: anim.moveFacingX,
      moveY: anim.moveFacingY,
    });
  }
  return out;
};

/**
 * Quadros em que o Prospector esta ANDANDO PARA ONDE FOI MANDADO.
 *
 * Raspar uma parede muda o rumo observado de verdade — a colisao come um eixo do
 * deslocamento — e o sprite virar ali e acerto, nao flicker. O que este arquivo
 * cobra e o rumo ficar parado enquanto a direcao nao muda.
 */
const walkingStraight = (frames: RenderedFrame[], move: { x: number; y: number }): RenderedFrame[] =>
  frames.filter(
    (f) => f.anim === 'walk' && Math.hypot(f.moveX - move.x, f.moveY - move.y) < 0.02
  );

/**
 * Quantas vezes o sprite trocou de quadrante entre quadros VIZINHOS.
 *
 * Comparar atraves de um buraco na sequencia seria desonesto: o que foi filtrado
 * no meio e justamente uma raspada de parede, onde o rumo muda de verdade e o
 * sprite virar e acerto.
 */
const flickers = (frames: RenderedFrame[]): number => {
  let count = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].index !== frames[i - 1].index + 1) continue;
    if (frames[i].dir !== frames[i - 1].dir) count++;
  }
  return count;
};

describe('estabilidade do render co-op', () => {
  /**
   * As quatro teclas de andar reto na tela produzem rumos de mundo que caem EM
   * CIMA de uma fronteira de quadrante — sao justamente os quatro casos em que o
   * desempate era sorteado a cada quadro.
   */
  it.each([
    ['W', -0.7071, -0.7071],
    ['S', 0.7071, 0.7071],
    ['A', -0.7071, 0.7071],
    ['D', 0.7071, -0.7071],
  ])('andar com %s nao alterna o quadrante do sprite', (_key, mx, my) => {
    const loop = new JitteryLoop();
    loop.client.connect();
    for (let f = 0; f < 12; f++) loop.frame();

    const move = { x: mx, y: my };
    const frames = walkingStraight(walk(loop, move, 90), move);

    expect(frames.length).toBeGreaterThan(20);
    expect(flickers(frames)).toBe(0);
  });

  /**
   * Com jitter, o buffer de interpolacao e o que separa movimento de teleporte.
   *
   * Medido antes dele, com 10 a 90 ms de jitter: 367 de 379 quadros com
   * deslocamento ZERO, e os poucos que sobraram com um tick inteiro (0,23 tile)
   * de uma vez. Aqui a cobranca e a mesma coisa do outro lado: nenhum quadro
   * pode avancar mais que uma fracao de tick, e nenhum pode andar para tras.
   */
  it('interpola sem saltos nem recuos mesmo com jitter de chegada', () => {
    const loop = new JitteryLoop(90);
    loop.client.connect();
    for (let f = 0; f < 12; f++) loop.frame();

    const move = { x: -0.7071, y: -0.7071 };
    const moving = walkingStraight(walk(loop, move, 120), move);
    expect(moving.length).toBeGreaterThan(20);

    // Passo de um tick de servidor a 20 Hz; um quadro de render a 60 Hz cobre no
    // maximo um terco dele, com folga para o relogio reengatar.
    const tickStep = 0.24;
    let stalled = 0;
    for (let i = 1; i < moving.length; i++) {
      const dx = moving[i].x - moving[i - 1].x;
      const dy = moving[i].y - moving[i - 1].y;
      const step = Math.hypot(dx, dy);
      expect(step).toBeLessThan(tickStep * 0.75);
      // Recuar e o sintoma classico de interpolar pelo relogio errado.
      expect(dx).toBeLessThanOrEqual(1e-9);
      if (step < 1e-6) stalled++;
    }
    // Congelamento e o outro lado do salto: uns poucos quadros parados sao o
    // buffer esvaziando num pico, uma maioria deles e o defeito de volta.
    expect(stalled).toBeLessThan(moving.length * 0.2);
  });
});

/**
 * O colchao de interpolacao se paga em PONTARIA.
 *
 * Cada tick de atraso e um tick a mais entre onde o inimigo esta desenhado e
 * onde o servidor vai resolver o tiro: quem mira no que ve, mira atras. Por isso
 * o colchao e medido em vez de fixo — uma conexao boa nao pode pagar o preco de
 * uma ruim. O que se cobra aqui e a regulagem funcionando nas duas pontas: piso
 * de um tick sempre (senao o primeiro atraso congela o mundo) e crescimento so
 * quando a rede de fato exige.
 */
/**
 * Distancia, em ticks, entre o quadro DESENHADO e o ultimo tick que o servidor
 * simulou.
 *
 * Le por cima do colchao: soma a ele a parte fracionaria descartada por desenhar
 * o quadro ja alcancado, mais o quanto o servidor andou desde o ultimo snapshot
 * que chegou. Serve para o que se cobra aqui — comparar um colchao com o outro e
 * provar que ele regula —, e nao para afirmar o valor absoluto.
 */
const measureTargetLagTicks = (loop: JitteryLoop, frames: number): number => {
  let total = 0;
  let samples = 0;
  for (let f = 0; f < frames; f++) {
    loop.frame();
    const state = loop.client.sampleRenderState(loop.now);
    if (!state || !state.playerExtras[0].joined) continue;
    // Depois da metade: as primeiras amostras sao a estimativa se assentando.
    if (f > frames / 2) {
      total += loop.serverTick - state.tick;
      samples++;
    }
  }
  return samples === 0 ? Number.NaN : total / samples;
};

describe('colchao de interpolacao', () => {
  it('desce perto do piso quando a rede e limpa', () => {
    const loop = new JitteryLoop(0);
    loop.client.connect();
    // Colchao medido numa rede limpa: ~1,6 tick (80 ms). O que sobra ate o
    // limite abaixo e a leitura por cima descrita em measureTargetLagTicks.
    expect(measureTargetLagTicks(loop, 600)).toBeLessThan(2.4);
  });

  it('cresce quando a chegada dos quadros e irregular', () => {
    const clean = new JitteryLoop(0);
    clean.client.connect();
    const cleanLag = measureTargetLagTicks(clean, 600);

    const rough = new JitteryLoop(150);
    rough.client.connect();
    const roughLag = measureTargetLagTicks(rough, 600);

    expect(roughLag).toBeGreaterThan(cleanLag + 0.5);
    // E nunca sem teto: um colchao que cresce sem limite viraria atraso de
    // controle disfarcado de suavidade. O teto do colchao e de tres ticks; o
    // resto desta folga e a leitura por cima mais o jitter ainda em voo.
    expect(roughLag).toBeLessThan(5.5);
  });
});

/**
 * Laco em que a rede entrega em RAJADA: tudo que acumulou sai de uma vez, em
 * intervalos regulares. E o padrao normal de TCP depois de qualquer atraso — a 20
 * Hz com folgas de 100 ms, dois snapshots chegam colados e o proximo par so vem
 * cem milissegundos depois.
 */
class BurstyLoop {
  readonly server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 5150 });
  readonly client: NetClient;
  now = 0;
  private nextTickAt = 0;
  private nextReleaseAt: number;
  private readonly held: string[] = [];

  constructor(private readonly burstMs: number) {
    this.nextReleaseAt = burstMs;
    this.server.addConnection('A', 0);
    this.client = new NetClient((raw) => {
      for (const o of this.server.handleMessage('A', raw, this.now)) this.held.push(JSON.stringify(o.msg));
    });
  }

  frame(): void {
    this.now += 1000 / 60;
    if (this.now >= this.nextTickAt) {
      this.nextTickAt = this.now + 1000 / 20;
      for (const o of this.server.tick()) this.held.push(JSON.stringify(o.msg));
    }
    if (this.now >= this.nextReleaseAt) {
      this.nextReleaseAt += this.burstMs;
      while (this.held.length > 0) this.client.receive(this.held.shift()!, this.now);
    }
  }
}

describe('entrega em rajada', () => {
  /**
   * O ritmo do servidor NAO pode ser medido entre dois quadros vizinhos.
   *
   * Com os snapshots saindo aos pares, o tempo entre os dois membros de um par e
   * zero — amostra descartada — e entre um par e o proximo passam 100 ms com
   * apenas um tick de diferenca para o quadro que ficou de referencia. Toda
   * amostra aceita dizia metade do ritmo real, a media convergia para la, e a
   * linha de render passava a andar a meia velocidade ate o buffer alcanca-la.
   * Medido com o codigo anterior: `tickRate` estacionado em 0,01000 quando o
   * verdadeiro era 0,0172, e 62% dos quadros parados.
   */
  it('mantem o movimento continuo quando os snapshots chegam colados', () => {
    const loop = new BurstyLoop(100);
    loop.client.connect();
    for (let f = 0; f < 12; f++) loop.frame();

    // Anda em circulo largo: a corrida precisa ser LONGA para a estimativa de
    // ritmo ter tempo de convergir — o defeito nao aparece no primeiro segundo,
    // ele se instala conforme a media aprende o valor errado —, e em linha reta
    // o Prospector encosta numa parede antes disso.
    const anims = new Map<number, EntityAnimState>();
    const steps: number[] = [];
    let last: { x: number; y: number } | null = null;
    for (let f = 0; f < 600; f++) {
      loop.frame();
      const cmd = emptyCommand();
      const angle = (f / 200) * Math.PI * 2;
      cmd.move = { x: Math.cos(angle), y: Math.sin(angle) };
      cmd.aim = { x: 1, y: 0 };
      loop.client.setCommand(cmd);
      loop.client.pump(loop.now);
      const state = loop.client.sampleRenderState(loop.now);
      if (!state || !state.playerExtras[0].joined) continue;
      const player = state.players[0];
      const anim = deriveAnim(anims.get(player.id), player.x, player.y, player.hp, player.alive, loop.now);
      anims.set(player.id, anim);
      if (last && anim.anim === 'walk') steps.push(Math.hypot(player.x - last.x, player.y - last.y));
      last = { x: player.x, y: player.y };
    }

    expect(steps.length).toBeGreaterThan(200);
    // A assinatura do defeito: a linha de render andando a meia velocidade fica
    // para tras, o buffer a alcanca e cada quadro evictado a arrasta um tick
    // inteiro de uma vez. Um quadro de render a 60 Hz nunca pode cobrir mais que
    // uma fracao do passo de um tick (0,23 tile).
    expect(Math.max(...steps)).toBeLessThan(0.18);
    const stalled = steps.filter((s) => s < 1e-6).length;
    expect(stalled).toBeLessThan(steps.length * 0.2);
  });
});

/**
 * Eventos sao a NARRACAO de um tick, e tem de chegar junto com o mundo daquele
 * tick.
 *
 * O corpo e desenhado com o atraso do colchao de interpolacao. Enquanto os
 * eventos eram disparados na CHEGADA do snapshot, eles corriam na frente do
 * mundo que os produziu: o telegraph de um ataque acendia antes de a criatura
 * chegar ao ponto onde atacou, a explosao clareava antes do corpo, e o relogio
 * visual da acao ja nascia adiantado — quando o quadro atrasado finalmente
 * alcancava o tick, a pose saltava.
 *
 * O que se cobra: nenhum evento pode ser entregue antes de a linha de render
 * alcancar o tick dele. `action_start` carrega `startTick`, e `death` carrega
 * `tick`; sao os dois que dizem, dentro do proprio evento, a que instante eles
 * pertencem.
 */
describe('linha do tempo dos eventos', () => {
  it('nenhum evento chega antes do mundo que o produziu', () => {
    const loop = new JitteryLoop(60);
    let checked = 0;
    let earliest = Number.POSITIVE_INFINITY;

    // Os eventos saem DE DENTRO de `sampleRenderState`, entao sao anotados aqui
    // e conferidos logo depois, contra o tick do quadro que os soltou. Compara-los
    // dentro do callback usaria o tick do quadro ANTERIOR e acusaria um atraso de
    // um tick que nao existe.
    const dispatched: number[] = [];
    loop.client.onEvents = (events) => {
      for (const event of events) {
        if (event.t === 'action_start') dispatched.push(event.startTick);
        else if (event.t === 'death') dispatched.push(event.tick);
      }
    };

    loop.client.connect();
    for (let f = 0; f < 900; f++) {
      loop.frame();
      const cmd = emptyCommand();
      // Anda em circulo para encontrar criaturas e provocar telegraphs.
      const angle = (f / 90) * Math.PI * 2;
      cmd.move = { x: Math.cos(angle), y: Math.sin(angle) };
      cmd.aim = { x: 1, y: 0 };
      cmd.fire = true;
      loop.client.setCommand(cmd);
      loop.client.pump(loop.now);
      const state = loop.client.sampleRenderState(loop.now);
      if (state) {
        for (const tick of dispatched) {
          checked++;
          earliest = Math.min(earliest, state.tick - tick);
        }
      }
      dispatched.length = 0;
    }

    expect(checked).toBeGreaterThan(5);
    // Zero ou mais: o evento so sai quando o mundo ja chegou no tick dele.
    expect(earliest).toBeGreaterThanOrEqual(0);
  });
});

/**
 * O ESTADO de uma entidade tem de acompanhar a POSICAO dela.
 *
 * A posicao desenhada fica entre dois snapshots — e o que a interpolacao faz. O
 * resto (vida, acao, quem existe) nao interpola: ou e o de um quadro, ou e o do
 * outro. Ler esses campos do quadro SEGUINTE, enquanto o corpo ainda esta a
 * caminho dele, adianta o mundo em ate um tick inteiro: a criatura sumia antes
 * de o corpo chegar onde ela morreu, e o dano aparecia antes do golpe.
 *
 * O teste alimenta o cliente com uma rampa fabricada — a posicao anda 0,2 tile
 * por tick e a vida cai de uma vez num tick conhecido — e cobra a coerencia
 * entre as duas em todo quadro desenhado: enquanto o corpo nao passou do ponto
 * da virada, a vida ainda tem de ser a de antes.
 */
describe('coerencia entre estado e posicao', () => {
  it('a vida so cai quando o corpo alcanca o tick em que ela caiu', () => {
    const server = new SurvivalServer({ maxPlayersPerRoom: 2, baseSeed: 5150 });
    let now = 0;
    const outbound: string[] = [];
    const client = new NetClient((raw) => {
      for (const o of server.handleMessage('A', raw, now)) outbound.push(JSON.stringify(o.msg));
    });
    server.addConnection('A', 0);
    client.connect();
    while (outbound.length > 0) client.receive(outbound.shift()!, now);

    // Um snapshot de verdade serve de molde: fabricar a mensagem inteira a mao
    // deixaria o teste passar num formato que o servidor nao usa mais.
    let template: Record<string, unknown> | null = null;
    for (let t = 0; t < 4 && !template; t++) {
      now += 50;
      for (const o of server.tick()) {
        const raw = JSON.stringify(o.msg);
        client.receive(raw, now);
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.t === 'snapshot') template = parsed;
      }
    }
    expect(template).not.toBeNull();

    // A rampa comeca EXATAMENTE onde o Prospector esta no molde: emendada na
    // posicao real, nao ha salto artificial entre o ultimo quadro de verdade e o
    // primeiro fabricado, e todo deslocamento observado vem da rampa.
    const templatePlayer = (template!.entities as Array<Record<string, unknown>>).find(
      (e) => e.kind === 'player'
    )!;
    const START_X = templatePlayer.x as number;
    const START_Y = templatePlayer.y as number;
    const STEP = 0.2;
    const HP_DROP_TICK = 12;
    const baseTick = template!.serverTick as number;
    /** Vida que a rampa define para um tick. */
    const hpAt = (k: number): number => (k >= HP_DROP_TICK ? 50 : 100);

    const frameFor = (k: number): string => {
      const msg = JSON.parse(JSON.stringify(template)) as Record<string, unknown>;
      msg.serverTick = baseTick + 1 + k;
      msg.events = [];
      msg.chunkDiffs = [];
      const entities = msg.entities as Array<Record<string, unknown>>;
      for (const e of entities) {
        if (e.kind !== 'player') continue;
        e.x = START_X + STEP * (k + 1);
        e.y = START_Y;
        e.hp = hpAt(k);
      }
      return JSON.stringify(msg);
    };

    let checked = 0;
    for (let k = 0; k < 30; k++) {
      now += 50;
      client.receive(frameFor(k), now);
      // Tres quadros de render por tick de servidor, como no jogo.
      for (let f = 0; f < 3; f++) {
        const state = client.sampleRenderState(now + f * (1000 / 60));
        if (!state) continue;
        if (state.tick <= baseTick) continue; // ainda nos quadros reais
        const player = state.players[0];
        // De que tick da rampa e o corpo desenhado agora — lido da POSICAO, que e
        // a unica coisa que interpola.
        const bodyTick = Math.floor((player.x - START_X) / STEP - 1 + 1e-9);
        expect(player.hp, `corpo no tick ${bodyTick}`).toBe(hpAt(bodyTick));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});
