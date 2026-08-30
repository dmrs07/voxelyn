// AS DUAS PONTAS DA VIDA DE UM MODULO, desenhadas: a incorporacao e a ejecao.
//
// Nao e um sistema da Minigun. E o sistema de TODO modulo, e a Minigun foi
// so o que o tornou obrigatorio: uma arma que substitui o tiro principal e
// depois some tinha de ter um instante visivel de "isto entrou no bot" e
// outro de "isto saiu do bot". Assim que esses dois instantes existiram para
// ela, nao havia argumento para os outros seis continuarem aparecendo e
// desaparecendo por corte seco.
//
// A regra que rege o arquivo inteiro, e a unica que nao pode ser negociada:
// ISTO E APRESENTACAO. A concessao do modulo acontece na simulacao, no tick
// do comando, e o `module_selected` que dispara a animacao daqui e um
// RELATO do que ja aconteceu. Nada aqui atrasa, condiciona ou confirma nada:
// se o cliente estiver com a aba escondida, se a origem nao puder ser
// resolvida, se o pool estiver cheio — o modulo ja e do jogador de qualquer
// forma, e o unico prejuizo e nao ter visto o cartucho voar.
//
// Por isso tambem nao ha colisao, pickup, dano ou rede aqui: o cartucho
// ejetado e um objeto de cena. Ele quica no chao porque um objeto pesado
// quica, nao porque o chao existe para ele.

import type { ModuleId } from '@voxelyn/survival-sim';
import { drawModuleHardware } from './module-hardware';

export type Point = { x: number; y: number };

/** Onde um voo comeca: um ponto de TELA (card da HUD) ou de MUNDO (o cofre). */
export type PropOrigin =
  | { space: 'screen'; x: number; y: number }
  | { space: 'world'; x: number; y: number };

/**
 * TETOS. Pequenos de proposito: sao objetos grandes e desenhados com a arte
 * completa do cartucho, e mais do que isto na tela ao mesmo tempo nao seria
 * leitura, seria confete.
 */
export const MAX_INSTALL_FLIGHTS = 4;
export const MAX_EJECTED_PROPS = 8;

/** Duracao do voo de incorporacao, em ms. */
export const INSTALL_FLIGHT_MS = 620;

/** Duracao do clarao de encaixe depois que o cartucho chega. */
const SEAT_FLASH_MS = 220;

/** Vida do cartucho ejetado: voa, quica, repousa, apaga. */
const EJECT_LIFE_MS = 2400;

/** Fracao final da vida em que o cartucho ejetado apaga. */
const EJECT_FADE_AT = 0.3;

type InstallFlight = {
  module: ModuleId;
  slot: number;
  origin: PropOrigin | null;
  startedAt: number;
  /** Quando o clarao de encaixe termina; 0 enquanto ainda esta voando. */
  seatUntil: number;
};

type EjectedProp = {
  module: ModuleId;
  /** Tiles. */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  spinRate: number;
  bounces: number;
  life: number;
  maxLife: number;
  /** A Minigun sai FUMEGANTE: um resto de calor que o desenho do cartucho le. */
  heat: number;
};

/**
 * A curva do voo: arco, e nao linha reta.
 *
 * A mesma forma do `rewardFlightPosition` (module-layout.ts), e nao uma
 * chamada a ele, porque as duas coisas divergem no que precisam: aquela leva
 * uma lasca de minerio ate um contador de HUD e satura o arco em 64 px;
 * esta leva um objeto pesado ate um corpo no mundo, e a altura do arco tem de
 * acompanhar a distancia percorrida para o cartucho nao raspar o chao numa
 * travessia longa. Compartilhar a funcao amarraria uma ao ajuste da outra.
 */
export const installFlightSample = (
  from: Point,
  to: Point,
  elapsedMs: number,
  durationMs: number,
): Point & { progress: number; spin: number } => {
  const progress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, durationMs)));
  // Ease-out cubico: sai depressa do cache e ASSENTA no bot. A chegada lenta
  // e o que da ao clarao de encaixe um instante para significar alguma coisa.
  const eased = 1 - (1 - progress) ** 3;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const arc = Math.sin(Math.PI * progress) * Math.min(120, 26 + distance * 0.18);
  return {
    x: from.x + (to.x - from.x) * eased,
    y: from.y + (to.y - from.y) * eased - arc,
    progress,
    // Giro discreto e SEMPRE no mesmo sentido: o cartucho e uma peca de
    // maquina sendo entregue, nao uma moeda girando no ar.
    spin: (1 - progress) * 0.9,
  };
};

/** Escala do cartucho durante o voo: ele ENCOLHE ate caber no bot. */
export const installFlightScale = (progress: number): number => 1 - 0.62 * progress;

export class ModulePropField {
  private readonly flights: InstallFlight[] = [];
  private readonly ejected: EjectedProp[] = [];

  /**
   * Eventos cosmeticos ja consumidos, por chave.
   *
   * IDEMPOTENCIA. Um `module_selected` ou um `module_expired` reaplicado —
   * uma leva de eventos reentregue depois de um resync, um snapshot repetido
   * — nao pode fazer o cartucho voar duas vezes nem o bot cuspir dois
   * cartuchos. A chave carrega o tick autoritativo, entao dois eventos
   * genuinamente distintos (pegar e recarregar o MESMO modulo em ticks
   * diferentes) continuam sendo dois.
   */
  private readonly seen = new Map<string, number>();

  get flightCount(): number {
    return this.flights.length;
  }

  get ejectedCount(): number {
    return this.ejected.length;
  }

  clear(): void {
    this.flights.length = 0;
    this.ejected.length = 0;
    this.seen.clear();
  }

  /**
   * Este evento cosmetico ja foi encenado? Marca-o como visto se nao.
   *
   * A memoria e podada por idade e nao por tamanho: uma run longa gera
   * dezenas de eventos de modulo, nunca milhares, e a poda por tempo mantem
   * o mapa pequeno sem inventar um teto arbitrario que poderia esquecer um
   * evento ainda em voo.
   */
  private claim(key: string, nowMs: number): boolean {
    for (const [k, at] of this.seen) if (nowMs - at > 8000) this.seen.delete(k);
    if (this.seen.has(key)) return false;
    this.seen.set(key, nowMs);
    return true;
  }

  /**
   * O cartucho escolhido no terminal voa ate o Prospector.
   *
   * `origin` pode ser `null` — e o caso do cliente que entrou no meio da run,
   * do parceiro cujo cofre esta fora da camera, ou de um `module_selected`
   * que chegou por resync sem que este cliente tenha visto o card. Nesses
   * casos NAO ha voo: a `drawScreen` cai no clarao curto sobre o proprio
   * jogador, que e o recuo prometido — a selecao nunca quebra por falta de
   * uma origem visual.
   */
  install(
    module: ModuleId,
    slot: number,
    origin: PropOrigin | null,
    /**
     * O que torna ESTE evento distinto dos outros do mesmo slot e modulo.
     *
     * Quem chama passa o `sourceSiteId` do `module_selected`: um cofre abre
     * uma vez, entao a tripla (slot, modulo, cofre) identifica a selecao sem
     * ambiguidade — e o mesmo evento reentregue por um resync cai na mesma
     * chave e nao encena duas vezes. Um tick tambem serviria; o que nao
     * serviria e deduplicar so por (slot, modulo), porque pegar e depois
     * RECARREGAR o mesmo cartucho sao duas coisas que aconteceram.
     */
    identity: number,
    nowMs: number,
  ): void {
    if (!this.claim(`sel:${slot}:${module}:${identity}`, nowMs)) return;
    if (this.flights.length >= MAX_INSTALL_FLIGHTS) this.flights.shift();
    this.flights.push({ module, slot, origin, startedAt: nowMs, seatUntil: 0 });
  }

  /**
   * O modulo que acabou sai FISICAMENTE do bot.
   *
   * Vale para as tres formas de acabar — a ultima carga consumida, o timer
   * que venceu, e a bala 300 da Minigun —, porque as tres chegam ao cliente
   * como o mesmo `module_expired`. Nao ha um caminho por motivo: o cliente
   * nao precisa saber POR QUE acabou para desenhar a peca saindo.
   */
  eject(
    module: ModuleId,
    slot: number,
    x: number,
    y: number,
    /** Ver `install`: o que separa duas expiracoes do mesmo modulo. */
    identity: number,
    nowMs: number,
    facingX = 0,
    facingY = 0,
    heat = 0,
    /**
     * REDUCAO DE MOVIMENTO. A peca aparece JA ASSENTADA ao lado do bot, sem
     * arco, sem giro e sem quique — a mesma informacao ("este modulo acabou e
     * saiu daqui"), sem o movimento. Nunca menos informacao: ela continua
     * visivel, com a mesma arte e o mesmo tempo de permanencia.
     */
    reducedMotion = false,
  ): void {
    if (!this.claim(`exp:${slot}:${module}:${identity}`, nowMs)) return;
    if (this.ejected.length >= MAX_EJECTED_PROPS) this.ejected.shift();
    // Para FORA e para CIMA, oposto ao rumo do corpo: a peca e cuspida pelo
    // hardpoint, e sair na direcao em que o jogador esta olhando faria o
    // cartucho voar por cima do que ele esta mirando.
    const len = Math.hypot(facingX, facingY) || 1;
    const bx = -facingX / len;
    const by = -facingY / len;
    this.ejected.push({
      module,
      x: reducedMotion ? x + bx * 0.8 : x,
      y: reducedMotion ? y + by * 0.8 : y,
      z: reducedMotion ? 0 : 0.7,
      vx: reducedMotion ? 0 : bx * 1.9 + 0.6,
      vy: reducedMotion ? 0 : by * 1.9 - 0.35,
      vz: reducedMotion ? 0 : 3.1,
      spin: 0,
      spinRate: reducedMotion ? 0 : 5.2,
      bounces: reducedMotion ? 0 : 2,
      life: EJECT_LIFE_MS,
      maxLife: EJECT_LIFE_MS,
      heat,
    });
  }

  /** Um passo de fisica visual dos cartuchos ejetados. `dtMs` e tempo real. */
  step(dtMs: number, nowMs: number): void {
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i];
      if (flight.seatUntil !== 0 && nowMs >= flight.seatUntil) this.flights.splice(i, 1);
    }
    if (this.ejected.length === 0) return;
    const clamped = Math.min(64, dtMs);
    const dt = clamped / 1000;
    const drag = Math.pow(0.93, dt * 60);
    for (let i = this.ejected.length - 1; i >= 0; i--) {
      const p = this.ejected[i];
      p.life -= dtMs;
      if (p.life <= 0) {
        this.ejected.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.spin += p.spinRate * dt;
      p.vz -= 9 * dt;
      // O calor residual esfria enquanto a peca esta no ar: a Minigun sai
      // fumegante e chega ao chao morna.
      p.heat = Math.max(0, p.heat - dt * 0.35);
      if (p.z <= 0) {
        p.z = 0;
        if (p.bounces > 0) {
          p.bounces--;
          p.vz = Math.abs(p.vz) * 0.38;
          p.vx *= 0.5;
          p.vy *= 0.5;
          p.spinRate *= 0.4;
        } else {
          p.vz = 0;
          p.vx *= 0.25;
          p.vy *= 0.25;
          // Assenta DIREITO: um cartucho parado no chao torto le como bug.
          p.spinRate = 0;
          p.spin *= 0.9;
        }
      }
      p.vx *= drag;
      p.vy *= drag;
    }
  }

  /**
   * Os cartuchos que estao no chao, no espaco do MUNDO.
   *
   * `visible` corta pela camera antes de qualquer desenho: o parceiro pode
   * ter terminado um modulo do outro lado do setor, e o cartucho dele nao
   * custa nada por estar la.
   */
  drawWorld(
    ctx: CanvasRenderingContext2D,
    project: (x: number, y: number) => [number, number],
    zoom: number,
    tileH: number,
    visible: (sx: number, sy: number) => boolean,
    nowMs: number,
  ): void {
    if (this.ejected.length === 0) return;
    for (const p of this.ejected) {
      const [sx, sy] = project(p.x, p.y);
      if (!visible(sx, sy)) continue;
      const py = sy - p.z * tileH * zoom;
      const fade = Math.min(1, p.life / (p.maxLife * EJECT_FADE_AT));
      ctx.save();
      // Sombra: e ela que diz que a peca esta caindo, e nao apenas longe.
      ctx.globalAlpha = 0.3 * fade;
      ctx.fillStyle = '#000000';
      const shadow = Math.max(3, 8 * zoom * (0.7 + 0.3 * (1 - Math.min(1, p.z))));
      ctx.beginPath();
      ctx.ellipse(sx, sy, shadow, shadow * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = fade;
      ctx.translate(sx, py);
      ctx.rotate(p.spin);
      // TAMANHO: quase o do corpo que o cuspiu, e nao um icone.
      //
      // A primeira versao desenhava o cartucho no calibre de um item de chao e
      // ele sumia contra a rocha — o que devia ser o instante de "a peca
      // acabou e saiu de mim" virava um bloco escuro passando. A prancheta e
      // de 32 unidades, entao qualquer tamanho entre 64 e 95 px cai na mesma
      // unidade de dois pixels: e o menor calibre em que o conjunto de canos
      // e o tambor continuam legiveis.
      //
      // O cartucho sai APAGADO — `lit` parcial. Ele acabou: nada nele deve
      // continuar aceso como no terminal, e essa diferenca e o que conta
      // "isto esta gasto". A Minigun ainda quente acende um pouco mais.
      drawModuleHardware(ctx, p.module, 0, 0, Math.max(32, 34 * zoom), {
        lit: 0.42 + p.heat * 0.4,
        nowMs,
        heat: p.heat,
        spin: p.spin / (Math.PI * 2),
      });
      ctx.restore();
    }
  }

  /**
   * Os voos de incorporacao, no espaco da TELA.
   *
   * `resolveTarget` devolve onde o Prospector daquele slot esta AGORA, em
   * pixel de tela, ou `null` quando ele nao pode ser resolvido (fora da
   * camera, ainda nao entrou, morreu no meio do voo). `hudFallback` e o
   * ponto do painel para onde o clarao curto vai nesse caso.
   *
   * `resolveOrigin` converte uma origem de MUNDO em tela; devolve `null` para
   * um cofre fora da camera. Quando origem ou destino falham, o voo vira o
   * clarao de recuo — nunca um cartucho parado no canto da tela.
   */
  drawScreen(
    ctx: CanvasRenderingContext2D,
    nowMs: number,
    resolveTarget: (slot: number) => Point | null,
    resolveOrigin: (origin: PropOrigin) => Point | null,
    hudFallback: Point,
  ): void {
    if (this.flights.length === 0) return;
    for (const flight of this.flights) {
      const target = resolveTarget(flight.slot) ?? hudFallback;
      const origin = flight.origin ? resolveOrigin(flight.origin) : null;

      // RECUO, e chegada: os dois caem no mesmo clarao, e ele comeca NO
      // MESMO quadro em que a condicao aparece. Sem origem nao ha arco a
      // desenhar, e inventar um ponto de partida mentiria sobre de onde a
      // peca veio; o clarao curto sobre o destino diz a unica coisa que
      // importa — "voce ganhou isto agora" — e a HUD assume dali.
      if (flight.seatUntil === 0 && !origin) flight.seatUntil = nowMs + SEAT_FLASH_MS;
      const sample = origin
        ? installFlightSample(origin, target, nowMs - flight.startedAt, INSTALL_FLIGHT_MS)
        : null;
      if (flight.seatUntil === 0 && sample && sample.progress >= 1) {
        flight.seatUntil = nowMs + SEAT_FLASH_MS;
      }
      if (flight.seatUntil !== 0) {
        this.drawSeatFlash(ctx, target, (flight.seatUntil - nowMs) / SEAT_FLASH_MS);
        continue;
      }
      if (!sample || !origin) continue;

      const scale = installFlightScale(sample.progress);
      ctx.save();
      // RASTRO DISCRETO: tres residuos ao longo do arco ja percorrido. Nao e
      // fumaca nem faisca — e a propria peca, mais fraca e menor, que e o que
      // marca a trajetoria sem competir com o combate que continua atras.
      for (let i = 3; i >= 1; i--) {
        const back = installFlightSample(
          origin,
          target,
          nowMs - flight.startedAt - i * 55,
          INSTALL_FLIGHT_MS,
        );
        if (back.progress <= 0) continue;
        ctx.globalAlpha = 0.16 - i * 0.035;
        drawModuleHardware(
          ctx,
          flight.module,
          back.x,
          back.y,
          Math.max(24, 86 * installFlightScale(back.progress)),
          { lit: 0.6, nowMs },
        );
      }
      ctx.globalAlpha = 1;
      ctx.translate(sample.x, sample.y);
      ctx.rotate(sample.spin);
      drawModuleHardware(ctx, flight.module, 0, 0, Math.max(28, 96 * scale), {
        lit: 1,
        nowMs,
      });
      ctx.restore();
    }
  }

  /** O clarao de encaixe: um anel curto que fecha sobre o ponto de destino. */
  private drawSeatFlash(ctx: CanvasRenderingContext2D, at: Point, remaining: number): void {
    const t = Math.max(0, Math.min(1, remaining));
    if (t <= 0) return;
    ctx.save();
    ctx.globalAlpha = t * 0.85;
    ctx.strokeStyle = '#59f2c2';
    ctx.lineWidth = 1 + t * 2.5;
    ctx.beginPath();
    // FECHA em vez de abrir: um anel que cresce le como explosao; um que
    // encolhe le como encaixe, que e o que acabou de acontecer.
    ctx.arc(at.x, at.y, 6 + t * 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = t;
    ctx.fillStyle = '#e8f1ff';
    ctx.fillRect(at.x - 2, at.y - 2, 4, 4);
    ctx.restore();
  }
}
