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

/** Quantas vezes o valor mudou de um quadro para o seguinte. */
const changes = <T>(values: T[]): number => {
  let count = 0;
  for (let i = 1; i < values.length; i++) if (values[i] !== values[i - 1]) count++;
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
    expect(changes(frames.map((f) => f.dir))).toBe(0);
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
 * Distancia, em ticks, entre o quadro ALVO da interpolacao e o ultimo tick que o
 * servidor simulou.
 *
 * E uma leitura POR BAIXO do colchao: o alvo e o mais novo dos dois quadros que
 * cercam o instante desenhado, entao ele fica ate um tick a frente do instante
 * de verdade. Serve exatamente para o que se cobra aqui — comparar um colchao
 * com o outro e provar que ele regula —, e nao para afirmar o valor absoluto.
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
  it('desce ate o piso quando a rede e limpa', () => {
    const loop = new JitteryLoop(0);
    loop.client.connect();
    // No piso (um tick), o alvo da interpolacao e o proprio quadro mais novo.
    expect(measureTargetLagTicks(loop, 600)).toBeLessThan(1);
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
    // controle disfarcado de suavidade.
    expect(roughLag).toBeLessThan(4);
  });
});
