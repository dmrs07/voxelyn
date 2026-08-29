// AS CAPSULAS EJETADAS. Apresentacao pura, com teto e reciclagem.
//
// Tres decisoes governam o arquivo, e as tres sao a mesma decisao vista de
// angulos diferentes: a capsula NAO E ESTADO AUTORITATIVO.
//
// 1. Ela nasce de um `minigun_burst`, que e um recibo AGREGADO de quatro
//    ticks. Isso significa que o jogo dispara logicamente mais balas do que
//    desenha capsulas quando a carga aperta — e esta certo assim. A impressao
//    de abundancia vem da AMOSTRAGEM (cada rajada cospe um punhado com
//    velocidades e giros diferentes), nunca de uma relacao 1:1 que o alvo
//    movel nao sustentaria.
// 2. Ela nao trafega pela rede, nao colide, nao machuca, nao pode ser pega e
//    nao entra em hash nenhum. Duas maquinas de co-op semeiam as proprias a
//    partir do mesmo evento e chegam ao mesmo resultado sem trocar um byte —
//    e se divergirem, nada acontece.
// 3. O teto e GLOBAL e por jogador. Trezentas balas por cartucho, dois
//    Prospectors: sem teto, um combate longo deixaria centenas de objetos
//    vivos no chao de um celular. O anel circular abaixo garante que a
//    memoria seja alocada uma vez, na construcao, e nunca mais.

import { seededUnit } from './particles';

/** Uma capsula. Campos planos: o pool inteiro e um anel de objetos reusados. */
type Casing = {
  /** Em uso? O anel nunca cresce nem encolhe; so alterna esta marca. */
  live: boolean;
  x: number;
  y: number;
  /** Altura em tiles, 0 = chao. */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Fase de giro, em radianos. */
  spin: number;
  spinRate: number;
  /** Quiques restantes antes de assentar. */
  bounces: number;
  /** Milissegundos de vida restantes. */
  life: number;
  maxLife: number;
  /** 0..1, escolhe entre as duas cores de latao. */
  tone: number;
  /** Slot dono, para o teto por jogador. */
  slot: number;
};

/**
 * TETO POR JOGADOR. Quarenta e oito e o topo da faixa recomendada: com a
 * rajada cheia (16 balas/s) e vida de 2,6 s, a populacao de equilibrio fica
 * em torno de quarenta se cada bala virasse capsula — e ela nao vira, porque
 * a amostragem por rajada limita antes disso. O numero existe para o caso
 * patologico (dois jogadores, rajada maxima, tudo na tela), nao para o caso
 * normal.
 */
export const MAX_CASINGS_PER_PLAYER = 48;

/** Teto GLOBAL. Dois jogadores no maximo, mais folga de uma troca de slot. */
export const MAX_CASINGS = MAX_CASINGS_PER_PLAYER * 2;

/** Vida de uma capsula, em ms: quica, repousa um instante e some. */
const CASING_LIFE_MS = 2600;

/** Fracao final da vida em que ela apaga. */
const FADE_AT = 0.22;

/** Quantas capsulas uma rajada de N balas cospe. */
export const casingsForBurst = (rounds: number, quality: number): number => {
  // Raiz e nao proporcional: uma janela de oito balas nao deve cuspir oito
  // capsulas — o olho nao conta capsula, ele le DENSIDADE, e a raiz entrega
  // crescimento visivel com teto natural. `quality` vem do preset, entao o
  // aparelho fraco recebe menos materia do mesmo evento, nunca outro evento.
  return Math.max(1, Math.round(Math.sqrt(Math.max(0, rounds)) * 1.6 * quality));
};

/** Latao: o mesmo par de tons do minerio e dos cascos da paleta mestra. */
const BRASS_BRIGHT = '#ffd166';
const BRASS_DARK = '#6e4a33';

export class CasingField {
  /**
   * O anel. Alocado inteiro na construcao e nunca redimensionado: e este
   * detalhe que faz "trezentas balas" custar zero alocacao em regime.
   */
  private readonly pool: Casing[] = [];
  private cursor = 0;
  private liveCount = 0;
  private readonly perSlot = new Map<number, number>();

  constructor(capacity: number = MAX_CASINGS) {
    for (let i = 0; i < capacity; i++) {
      this.pool.push({
        live: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        spin: 0,
        spinRate: 0,
        bounces: 0,
        life: 0,
        maxLife: CASING_LIFE_MS,
        tone: 0,
        slot: 0,
      });
    }
  }

  get count(): number {
    return this.liveCount;
  }

  countFor(slot: number): number {
    return this.perSlot.get(slot) ?? 0;
  }

  clear(): void {
    for (const c of this.pool) c.live = false;
    this.liveCount = 0;
    this.cursor = 0;
    this.perSlot.clear();
  }

  /**
   * A vaga onde a proxima capsula nasce.
   *
   * Percorre o anel a partir do cursor procurando uma vaga morta; se o anel
   * estiver cheio, RECICLA a mais velha — que e a do proprio cursor, porque o
   * cursor avanca em ordem de nascimento. Reciclar a mais velha e a escolha
   * certa: a capsula que acabou de sair da arma esta perto do jogador e e a
   * que ele esta olhando; a que esta prestes a apagar no canto da tela nao.
   */
  private acquire(): Casing {
    for (let probe = 0; probe < this.pool.length; probe++) {
      const index = (this.cursor + probe) % this.pool.length;
      const candidate = this.pool[index];
      if (!candidate.live) {
        this.cursor = (index + 1) % this.pool.length;
        return candidate;
      }
    }
    const recycled = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    this.release(recycled);
    return recycled;
  }

  private release(c: Casing): void {
    if (!c.live) return;
    c.live = false;
    this.liveCount--;
    this.perSlot.set(c.slot, Math.max(0, (this.perSlot.get(c.slot) ?? 1) - 1));
  }

  /**
   * Ejeta as capsulas de UMA rajada.
   *
   * A ejecao e LATERAL, como manda a ficcao da arma: o vetor perpendicular a
   * mira, com o lado alternando por capsula, e nao um espalhamento radial —
   * capsula que sai para a frente parece projetil, e projetil e a outra coisa
   * que esta saindo do mesmo cano no mesmo instante.
   *
   * `seed` vem do EVENTO (tick, slot), entao duas maquinas de co-op semeiam a
   * mesma chuva de latao. E cosmetico, mas de graca.
   */
  emitBurst(
    slot: number,
    x: number,
    y: number,
    aimX: number,
    aimY: number,
    rounds: number,
    seed: number,
    quality: number,
  ): void {
    const wanted = casingsForBurst(rounds, quality);
    const rnd = seededUnit(seed);
    const len = Math.hypot(aimX, aimY) || 1;
    // Perpendicular a mira, no plano do mundo.
    const px = -aimY / len;
    const py = aimX / len;
    for (let i = 0; i < wanted; i++) {
      if (this.countFor(slot) >= MAX_CASINGS_PER_PLAYER) {
        // O teto por jogador ja foi atingido: recicla a mais velha DESTE
        // jogador em vez de deixar de ejetar. A alternativa — parar de
        // desenhar — faria a chuva de latao sumir justamente na rajada mais
        // longa, que e quando ela mais tem o que dizer.
        const oldest = this.oldestOf(slot);
        if (oldest) this.release(oldest);
      }
      const side = i % 2 === 0 ? 1 : -1;
      const c = this.acquire();
      c.live = true;
      this.liveCount++;
      this.perSlot.set(slot, (this.perSlot.get(slot) ?? 0) + 1);
      c.slot = slot;
      c.x = x + px * side * 0.18;
      c.y = y + py * side * 0.18;
      c.z = 0.62 + rnd() * 0.1;
      c.vx = px * side * (1.6 + rnd() * 1.1) - (aimX / len) * 0.35;
      c.vy = py * side * (1.6 + rnd() * 1.1) - (aimY / len) * 0.35;
      c.vz = 1.1 + rnd() * 0.7;
      c.spin = rnd() * Math.PI * 2;
      c.spinRate = (6 + rnd() * 10) * (rnd() > 0.5 ? 1 : -1);
      c.bounces = rnd() > 0.45 ? 2 : 1;
      c.life = CASING_LIFE_MS * (0.8 + rnd() * 0.4);
      c.maxLife = c.life;
      c.tone = rnd();
    }
  }

  private oldestOf(slot: number): Casing | null {
    let oldest: Casing | null = null;
    for (const c of this.pool) {
      if (!c.live || c.slot !== slot) continue;
      if (!oldest || c.life < oldest.life) oldest = c;
    }
    return oldest;
  }

  /**
   * Um passo de fisica visual. `dtMs` e o tempo REAL do quadro.
   *
   * O teto de 64 ms e o mesmo das particulas e existe pela mesma razao: uma
   * aba que volta do segundo plano nao pode teleportar latao pelo mapa. Como
   * a capsula so decora, perder o intervalo suprimido nao custa nada — ela
   * simplesmente apaga um pouco mais tarde.
   */
  step(dtMs: number): void {
    if (this.liveCount === 0) return;
    const clamped = Math.min(64, dtMs);
    const dt = clamped / 1000;
    const drag = Math.pow(0.9, dt * 60);
    for (const c of this.pool) {
      if (!c.live) continue;
      c.life -= dtMs;
      if (c.life <= 0) {
        this.release(c);
        continue;
      }
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.spin += c.spinRate * dt;
      c.vz -= 7.5 * dt;
      if (c.z <= 0) {
        c.z = 0;
        if (c.bounces > 0) {
          c.bounces--;
          // Quique curto e com perda alta: latao no chao de pedra nao pula, ele
          // TINE e para. Dois quiques e o teto — o terceiro ja seria borracha.
          c.vz = Math.abs(c.vz) * 0.34;
          c.vx *= 0.55;
          c.vy *= 0.55;
          c.spinRate *= 0.5;
        } else {
          c.vz = 0;
          c.vx *= drag * 0.4;
          c.vy *= drag * 0.4;
          c.spinRate *= 0.82;
        }
      }
      c.vx *= drag;
      c.vy *= drag;
    }
  }

  /**
   * Desenha o latao. `visible` recorta pela camera ANTES de qualquer conta —
   * uma sala grande com dois jogadores atirando enche o chao de capsulas que
   * o jogador nao esta vendo, e desenhar fora da tela e o gasto mais facil de
   * cortar.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    project: (x: number, y: number) => [number, number],
    zoom: number,
    tileH: number,
    visible: (sx: number, sy: number) => boolean,
  ): void {
    if (this.liveCount === 0) return;
    ctx.save();
    for (const c of this.pool) {
      if (!c.live) continue;
      const [sx, sy] = project(c.x, c.y);
      if (!visible(sx, sy)) continue;
      const py = sy - c.z * tileH * zoom;
      const fade = Math.max(0, Math.min(1, c.life / (c.maxLife * FADE_AT)));
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, fade);
      // Sombra no chao: e ela que diz que a capsula esta NO AR e nao longe.
      // Some junto com a altura, entao a capsula assentada nao ganha auréola.
      if (c.z > 0.02) {
        ctx.fillStyle = 'rgba(0,0,0,0.32)';
        const shadow = Math.max(1, zoom);
        ctx.fillRect(
          Math.round(sx - shadow / 2),
          Math.round(sy - shadow / 4),
          shadow,
          Math.max(1, shadow / 2),
        );
      }
      // O corpo: um retangulo de 3x1 pixels girado. Nao ha voxel aqui — uma
      // capsula tem o tamanho de um pixel e meio, e tres faces sombreadas
      // seriam o mesmo pixel tres vezes.
      const long = Math.max(2, Math.round(3 * zoom));
      const thick = Math.max(1, Math.round(zoom));
      // save/restore por capsula, e nunca `setTransform(identidade)`: a
      // transformacao do canvas ja carrega a escala de densidade de pixel do
      // aparelho, e zera-la desenharia latao em tamanho de retina num
      // telefone.
      ctx.save();
      ctx.translate(Math.round(sx), Math.round(py));
      ctx.rotate(c.spin);
      ctx.fillStyle = c.tone > 0.5 ? BRASS_BRIGHT : BRASS_DARK;
      ctx.fillRect(-long / 2, -thick / 2, long, thick);
      // A boca, um pixel claro na ponta: e o que faz um retangulo virar
      // cartucho no calibre em que ele existe.
      ctx.fillStyle = BRASS_BRIGHT;
      ctx.fillRect(long / 2 - thick, -thick / 2, thick, thick);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
