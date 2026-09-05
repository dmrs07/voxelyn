// O RASTRO POR COMPRIMENTO DE ARCO — a coluna de qualquer corpo comprido.
//
// Generalizado a partir da coluna do Devorador (`devourer-spine.ts`), que e
// hoje uma instancia disto: a simulacao move UM ponto, a cabeca, e o corpo e
// desenho — N segmentos pendurados no caminho que a cabeca ja percorreu, cada
// um no ponto que ela ocupava `headOffset + k * gap` TILES atras.
//
// Por que follow-the-leader por ARCO e nao Verlet nem IK: as tres desenham a
// mesma coisa quando a cabeca anda para a frente e divergem no que fazem com
// o TEMPO. Amostrar por comprimento de arco e uma pergunta sobre a trajetoria
// e nao sobre o relogio, entao dois clientes da mesma sala a 144 Hz e a 30 Hz
// desenham a mesma forma, e o corpo nunca estica nem encolhe com queda de FPS
// porque o comprimento e a propria unidade da amostragem.
//
// O que viaja no rastro alem da posicao e uma ELEVACAO (`liftPx`): o Devorador
// a usa para o arco do salto (o corpo entra na areia com a cauda ainda no ar),
// e o Leviata para nada — a submersao dele e por posto, nao por caminho.

/** Um ponto do rastro, com a distancia acumulada ate a cabeca. */
export type TrailSample = { x: number; y: number; liftPx: number; back: number };

/** Um segmento resolvido, pronto para desenhar. */
export type TrailNode = {
  x: number;
  y: number;
  /** Elevacao em pixels logicos: positiva no ar, negativa enterrado. */
  liftPx: number;
  /** A tangente do caminho ali — e a direcao que escolhe o quadro do atlas. */
  dirX: number;
  dirY: number;
  /** 0 = colado no pescoco, `segments - 1` = ponta da cauda. */
  rank: number;
};

export type TrailHead = {
  x: number;
  y: number;
  liftPx: number;
  dirX: number;
  dirY: number;
};

export type TrailConfig = {
  /** Quantos segmentos o corpo tem. */
  segments: number;
  /** Passo entre segmentos, em tiles — menor que o comprimento da peca. */
  gap: number;
  /** Onde o primeiro segmento se encaixa, em tiles atras da ancora da cabeca. */
  headOffset: number;
  /** Distancia minima entre duas amostras do rastro, em tiles. */
  step: number;
  /** Amplitude da ondulacao lateral, em tiles; ondas por corpo; ciclos/s. */
  sway: number;
  swayWaves: number;
  swayHz: number;
  /**
   * RIGIDEZ do corpo, 0..1 — o coeficiente de dobra.
   *
   * Em 0 cada segmento senta exatamente sobre o caminho da cabeca: e a
   * cobra, o Devorador. Acima disso o corpo vira uma corrente de elos rigidos
   * pendurada na cabeca, e a direcao de cada elo e uma mistura entre a
   * tangente do caminho (o que o rastro pede) e a direcao do elo anterior (o
   * que um corpo duro pede), pesada por este numero. A CABECA e o vetor: o
   * primeiro elo herda o rumo dela, e cada elo seguinte so pode desviar do
   * anterior ate `maxBend`. Uma raia dobra pouco e dobra do meio para tras —
   * as asas sao uma peca so com a cabeca — e e isso que a leitura pede: um
   * corpo largo que VIRA, e nao uma fila de quadros que serpenteia.
   */
  stiffness?: number;
  /** Desvio maximo entre um elo e o anterior, em radianos. So vale com rigidez. */
  maxBend?: number;
  /**
   * Salto de posicao acima do qual o rastro e jogado fora, em tiles.
   *
   * Um snapshot perdido, um `respawn`, a troca de sala — ou o Leviata
   * reaparecendo em outra poca — entregam a cabeca longe do ultimo quadro, e
   * arrastar o corpo por essa reta desenharia um bicho de vinte tiles
   * atravessando o mapa. Mais que qualquer coisa que a cabeca faz num quadro,
   * menos que qualquer teleporte.
   */
  teleportTiles: number;
};

const norm = (x: number, y: number): { x: number; y: number } => {
  const m = Math.hypot(x, y);
  return m > 1e-6 ? { x: x / m, y: y / m } : { x: 0, y: 1 };
};

/**
 * `want` girado em direcao a `toward`, mas nunca mais que `maxBend` radianos
 * a partir de `from`. E o elo que tenta seguir o caminho e e segurado pelo
 * elo anterior.
 */
export const bendToward = (
  from: { x: number; y: number },
  want: { x: number; y: number },
  maxBend: number,
): { x: number; y: number } => {
  const a0 = Math.atan2(from.y, from.x);
  const a1 = Math.atan2(want.y, want.x);
  let delta = a1 - a0;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const clamped = Math.max(-maxBend, Math.min(maxBend, delta));
  return { x: Math.cos(a0 + clamped), y: Math.sin(a0 + clamped) };
};

/**
 * O ponto a `want` tiles de rastro atras da cabeca, interpolado.
 *
 * Interpolar (em vez de pegar a amostra mais proxima) e o que tira o degrau:
 * sem isso cada segmento SALTA `step` tiles toda vez que uma amostra nova
 * entra, e dez segmentos saltando juntos leem como tremor.
 */
export const sampleTrailAt = (
  trail: ReadonlyArray<TrailSample>,
  head: TrailHead,
  want: number,
): { x: number; y: number; liftPx: number } => {
  if (trail.length === 0 || want <= 0) return { x: head.x, y: head.y, liftPx: head.liftPx };
  for (let i = 0; i < trail.length - 1; i++) {
    const a = trail[i];
    const b = trail[i + 1];
    if (want <= b.back) {
      const span = b.back - a.back;
      const t = span > 1e-6 ? (want - a.back) / span : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        liftPx: a.liftPx + (b.liftPx - a.liftPx) * t,
      };
    }
  }
  // Alem do fim do rastro: fica na ultima amostra em vez de extrapolar. Um
  // rastro curto tem de amontoar a cauda, e nao inventar caminho.
  const last = trail[trail.length - 1];
  return { x: last.x, y: last.y, liftPx: last.liftPx };
};

/**
 * Os rastros de todos os corpos compridos de um tipo, por id de entidade.
 *
 * Guarda estado entre quadros porque o rastro E o estado: a forma do corpo
 * agora depende de por onde a cabeca andou. Nada disto viaja pela rede nem
 * entra em hash.
 */
export class SpineTrail {
  private readonly trails = new Map<number, TrailSample[]>();
  private readonly span: number;

  constructor(private readonly config: TrailConfig) {
    this.span = config.headOffset + (config.segments - 1) * config.gap;
  }

  reset(): void {
    this.trails.clear();
  }

  /** Esquece um corpo especifico: o proximo `follow` nasce reto atras da cabeca. */
  forget(id: number): void {
    this.trails.delete(id);
  }

  /** Esquece os corpos que nao estao mais na cena (morte, fim de setor). */
  keepOnly(live: ReadonlySet<number>): void {
    for (const id of this.trails.keys()) if (!live.has(id)) this.trails.delete(id);
  }

  has(id: number): boolean {
    return this.trails.has(id);
  }

  /**
   * Registra onde a cabeca esta e devolve os segmentos.
   *
   * Uma chamada por quadro e por corpo: ela avanca o rastro E o le, porque as
   * duas coisas tem de ver a mesma cabeca.
   */
  follow(id: number, head: TrailHead, nowMs: number): TrailNode[] {
    const trail = this.advance(id, head);
    return this.read(trail, head, nowMs);
  }

  private advance(id: number, head: TrailHead): TrailSample[] {
    const { step, teleportTiles } = this.config;
    let trail = this.trails.get(id);
    if (trail && trail.length > 0) {
      const first = trail[0];
      if (Math.hypot(head.x - first.x, head.y - first.y) > teleportTiles) trail = undefined;
    }
    if (!trail || trail.length === 0) {
      // NASCE RETO, atras da cabeca: um corpo que se montasse conforme anda
      // desenharia uma cabeca solta no primeiro segundo de cada encontro.
      const back = norm(-head.dirX, -head.dirY);
      trail = [];
      for (let d = 0; d <= this.span + step; d += step) {
        trail.push({
          x: head.x + back.x * d,
          y: head.y + back.y * d,
          liftPx: head.liftPx,
          back: d,
        });
      }
      this.trails.set(id, trail);
      return trail;
    }

    const moved = Math.hypot(head.x - trail[0].x, head.y - trail[0].y);
    if (moved >= step) {
      for (const s of trail) s.back += moved;
      trail.unshift({ x: head.x, y: head.y, liftPx: head.liftPx, back: 0 });
      let cut = trail.length;
      while (cut > 2 && trail[cut - 2].back > this.span) cut--;
      if (cut < trail.length) trail.length = cut;
    } else {
      trail[0].liftPx = head.liftPx;
    }
    return trail;
  }

  private read(trail: TrailSample[], head: TrailHead, nowMs: number): TrailNode[] {
    const { segments, gap, headOffset, sway, swayWaves, swayHz } = this.config;
    const stiffness = Math.max(0, Math.min(1, this.config.stiffness ?? 0));
    const maxBend = this.config.maxBend ?? Math.PI;
    const nodes: TrailNode[] = [];
    // O elo anterior da corrente rigida: comeca na cabeca, que e o vetor.
    let prevDir = norm(head.dirX, head.dirY);
    let prevX = head.x;
    let prevY = head.y;
    for (let k = 0; k < segments; k++) {
      const want = headOffset + k * gap;
      const at = sampleTrailAt(trail, head, want);
      // A TANGENTE sai de uma corda curta em volta do ponto, e nao do vizinho
      // imediato: entre duas amostras o angulo e ruidoso, e a direcao escolhe
      // o quadro do atlas — um segmento oscilando entre duas direcoes autoradas
      // pisca a cada quadro.
      const ahead = sampleTrailAt(trail, head, Math.max(0, want - gap * 0.5));
      const behind = sampleTrailAt(trail, head, want + gap * 0.5);
      const pathDir = norm(ahead.x - behind.x, ahead.y - behind.y);
      let dir = pathDir;
      let x = at.x;
      let y = at.y;
      if (stiffness > 0) {
        // O elo quer a tangente do caminho e e segurado pelo anterior: a
        // mistura pesada pela rigidez, depois o limite de dobra. A posicao
        // deixa de ser a amostra do rastro e passa a ser o fim do elo — os
        // elos ficam sempre a `gap` um do outro, sem fresta nem amontoado.
        const blended = norm(
          pathDir.x * (1 - stiffness) + prevDir.x * stiffness,
          pathDir.y * (1 - stiffness) + prevDir.y * stiffness,
        );
        dir = bendToward(prevDir, blended, maxBend);
        const reach = k === 0 ? headOffset : gap;
        x = prevX - dir.x * reach;
        y = prevY - dir.y * reach;
      }
      prevDir = dir;
      prevX = x;
      prevY = y;
      const phase = want * swayWaves * Math.PI * 2 - (nowMs / 1000) * swayHz * Math.PI * 2;
      const grow = segments > 1 ? k / (segments - 1) : 0;
      const wobble = Math.sin(phase) * sway * grow;
      nodes.push({
        x: x - dir.y * wobble,
        y: y + dir.x * wobble,
        liftPx: at.liftPx,
        dirX: dir.x,
        dirY: dir.y,
        rank: k,
      });
    }
    return nodes;
  }
}
