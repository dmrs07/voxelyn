// Particulas voxel: gas, fogo, explosao e descarga desenhados como cubinhos do
// MESMO tamanho de voxel que blocos e criaturas.
//
// Por que voxel e nao circulos alfa: o resto do jogo e facetado e de alpha
// binario, entao nuvem redonda e translucida destoa na hora. Alem disso o
// contrato dos atlas e alpha binario — nuvem translucida teria de virar um
// sistema de FX a parte de qualquer jeito, entao ela ja nasce aqui.
//
// Tudo aqui e COSMETICO. As particulas nascem de eventos semanticos
// autoritativos e nunca alteram a simulacao: o cliente nao decide que houve
// explosao, so a desenha. Duas maquinas no co-op recebem o mesmo evento e
// semeiam o mesmo burst, entao veem a mesma coisa sem trocar um byte a mais.

import type { SemanticEvent } from '@voxelyn/survival-sim';

export type ParticleKind = 'ember' | 'gas' | 'debris' | 'spark';

type Particle = {
  x: number; // tile
  y: number;
  z: number; // altura em tiles (0 = chao)
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  kind: ParticleKind;
};

/** Cores por tipo, em ordem do mais quente/novo ao mais frio/velho. */
const RAMP: Record<ParticleKind, string[]> = {
  ember: ['#ffd166', '#ff7a2f', '#d93b4c'],
  gas: ['#a8e63c', '#2f6b4f', '#1f3d33'],
  debris: ['#46566e', '#2e3a4d', '#1d2430'],
  spark: ['#e8f1ff', '#7ab8ff', '#2e3a4d'],
};

/**
 * PRNG barata semeada por evento. Nao precisa da qualidade da RNG da simulacao
 * — nada aqui e autoritativo — mas precisa ser DETERMINISTA por evento, para os
 * dois clientes de uma sala verem o mesmo estilhaco.
 */
const seeded = (seed: number) => {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
};

const eventSeed = (x: number, y: number, salt: number): number =>
  Math.imul(Math.round(x * 16) | 0, 374761393) ^ Math.imul(Math.round(y * 16) | 0, 668265263) ^ salt;

export class VoxelParticles {
  private items: Particle[] = [];
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */
  budget = 240;

  get count(): number { return this.items.length; }

  clear(): void { this.items.length = 0; }

  private push(p: Particle): void {
    // Descarta o mais VELHO, nao o novo: um burst recente e o que o jogador
    // esta olhando, e cortar a cauda deixaria a explosao pela metade.
    if (this.items.length >= this.budget) this.items.shift();
    this.items.push(p);
  }

  private burst(
    x: number,
    y: number,
    kind: ParticleKind,
    count: number,
    speed: number,
    lift: number,
    life: number,
    salt: number
  ): void {
    const rnd = seeded(eventSeed(x, y, salt));
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const mag = speed * (0.35 + rnd() * 0.65);
      this.push({
        x, y,
        z: 0.12 + rnd() * 0.25,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        vz: lift * (0.4 + rnd() * 0.9),
        life: life * (0.6 + rnd() * 0.6),
        maxLife: life,
        kind,
      });
    }
  }

  /**
   * Traduz eventos autoritativos em particulas. `scale` vem da qualidade: no
   * preset baixo o mesmo evento gera menos materia, nunca eventos diferentes.
   */
  ingest(events: readonly SemanticEvent[], worldWidth: number, scale: number): void {
    const n = (base: number) => Math.max(1, Math.round(base * scale));
    for (const ev of events) {
      switch (ev.t) {
        case 'explosion':
          // Duas camadas: brasa que sobe rapido e entulho que sai rasteiro.
          this.burst(ev.x, ev.y, 'ember', n(14), 2.4 * ev.radius * 0.4, 2.2, 520, 1);
          this.burst(ev.x, ev.y, 'debris', n(10), 3.0 * ev.radius * 0.4, 1.1, 700, 2);
          break;
        case 'ignite':
          this.burst(ev.x, ev.y, 'ember', n(4), 0.5, 1.6, 420, 3);
          break;
        case 'discharge':
          for (const cell of ev.cells.slice(0, Math.max(4, n(16)))) {
            const cx = (cell % worldWidth) + 0.5;
            const cy = Math.floor(cell / worldWidth) + 0.5;
            this.burst(cx, cy, 'spark', n(2), 1.6, 2.6, 240, cell);
          }
          break;
        case 'death':
          // Acompanha o desabamento do sprite: a criatura vira materia.
          this.burst(ev.x, ev.y, 'debris', n(9), 1.5, 1.3, 560, ev.entity);
          break;
        case 'overheat':
          this.burst(ev.x, ev.y, 'ember', n(6), 1.0, 2.0, 380, 4);
          break;
        default:
          break;
      }
    }
  }

  /** Emissao contínua do gas parado no mundo — a ameaca tem de ser VISTA. */
  emitGas(x: number, y: number, nowMs: number, scale: number): void {
    // Um mote por celula a cada ~200ms, defasado pela posicao para as celulas
    // vizinhas nao pulsarem em uniso.
    const phase = (Math.imul(x | 0, 92837111) ^ Math.imul(y | 0, 689287499)) >>> 0;
    const bucket = (nowMs / 200) | 0;
    const every = Math.max(1, Math.round(3 / scale));
    if (bucket % every !== phase % every) return;
    // A semente inclui o INSTANTE, nao so a celula: com semente fixa por celula
    // todo mote nascia no mesmo ponto e o gas subia em fila indiana, uma linha
    // vertical em vez de uma coluna que se abre.
    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 2654435761)));
    this.push({
      x: x + rnd() * 0.9 - 0.45,
      y: y + rnd() * 0.9 - 0.45,
      z: 0.05,
      vx: (rnd() - 0.5) * 0.12,
      vy: (rnd() - 0.5) * 0.12,
      vz: 0.5 + rnd() * 0.4,
      life: 900,
      maxLife: 900,
      kind: 'gas',
    });
  }

  step(dtMs: number): void {
    const dt = Math.min(64, dtMs) / 1000;
    const out: Particle[] = [];
    for (const p of this.items) {
      p.life -= dtMs;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Brasa e entulho caem; gas sobe e desacelera, nunca cai.
      if (p.kind === 'gas') {
        p.vz *= 0.985;
      } else {
        p.vz -= 5.5 * dt;
        if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.28; p.vx *= 0.6; p.vy *= 0.6; }
      }
      p.vx *= 0.97;
      p.vy *= 0.97;
      out.push(p);
    }
    this.items = out;
  }

  /**
   * Desenha os cubinhos. `project` converte (tile x, tile y) em pixel de tela;
   * `zoom` da o tamanho do voxel, entao a particula cresce junto com o mundo.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    project: (x: number, y: number) => [number, number],
    zoom: number,
    tileH: number
  ): void {
    if (this.items.length === 0) return;
    // Ordem do pintor, igual ao resto da cena: o que esta atras desenha antes.
    const sorted = [...this.items].sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
    const vw = Math.max(1, Math.round(4 * zoom));
    const vh = Math.max(1, Math.round(2 * zoom));
    ctx.save();
    for (const p of sorted) {
      const [sx, sy] = project(p.x, p.y);
      const ramp = RAMP[p.kind];
      const t = 1 - p.life / p.maxLife;
      ctx.fillStyle = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
      const py = sy - p.z * tileH * zoom;
      ctx.fillRect(Math.round(sx - vw / 2), Math.round(py - vh / 2), vw, vh);
    }
    ctx.restore();
  }
}
