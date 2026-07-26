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

import { SOLID_CRYSTAL } from '@voxelyn/survival-sim';
import type { FaceRamp } from './voxel-draw';
import { drawVoxel } from './voxel-draw';
import type { SemanticEvent } from '@voxelyn/survival-sim';

export type ParticleKind = 'ember' | 'gas' | 'debris' | 'spark' | 'rubble' | 'crystalShard' | 'acidDrip' | 'oreChip';

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

/**
 * Rampa de faces por tipo: [topo, esquerda, direita].
 *
 * Antes era uma lista de cores por idade e a particula saia num retangulo
 * chapado. Agora as tres entradas sao as tres FACES do voxel, entao a materia
 * no ar tem o mesmo volume facetado que o bloco e a criatura — o retangulo liso
 * denunciava o truque justamente nos momentos de maior atencao, a explosao.
 */
const RAMP: Record<ParticleKind, FaceRamp> = {
  ember: ['#ffd166', '#ff7a2f', '#d93b4c'],
  gas: ['#a8e63c', '#2f6b4f', '#1f3d33'],
  debris: ['#46566e', '#2e3a4d', '#1d2430'],
  spark: ['#e8f1ff', '#7ab8ff', '#2e3a4d'],
  // Materiais de bloco: os cacos saem da MESMA paleta com que o bloco foi
  // renderizado, senao o entulho nao parece feito da pedra que acabou de cair.
  rubble: ['#6e4a33', '#46566e', '#2e3a4d'],
  crystalShard: ['#59f2c2', '#2f6b4f', '#1f3d33'],
  // Corrosao pinga; lasca de minerio salta.
  acidDrip: ['#a8e63c', '#2f6b4f', '#1f3d33'],
  oreChip: ['#ffd166', '#6e4a33', '#2e3a4d'],
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

/**
 * Tempo decorrido do frame, em ms, a partir do relogio do render.
 *
 * O render roda em requestAnimationFrame, entao passar um passo fixo de 16.7ms
 * amarra a fisica das particulas a taxa de atualizacao do monitor: a 120Hz um
 * mote de 900ms durava 450ms reais e caia pela metade da distancia; a 30Hz
 * durava 1.8s e voava o dobro. O passo tem de vir do relogio.
 *
 * O teto de 100ms existe para a aba voltar do segundo plano sem teleportar todo
 * mundo; a vida, essa, consome o tempo real, entao o que ficou velho durante a
 * pausa expira como deve.
 */
export const FALLBACK_FRAME_MS = 16.7;
export const frameDeltaMs = (lastMs: number, nowMs: number): number => {
  if (!Number.isFinite(lastMs) || lastMs <= 0) return FALLBACK_FRAME_MS;
  const dt = nowMs - lastMs;
  if (!(dt > 0)) return FALLBACK_FRAME_MS;
  return Math.min(100, dt);
};

export class VoxelParticles {
  private items: Particle[] = [];
  /**
   * Ultimo bucket de tempo em que cada celula emitiu gas. Limitado ao numero de
   * celulas do mundo, entao nao cresce sem teto.
   */
  private readonly lastGasBucket = new Map<number, number>();
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */
  budget = 240;

  get count(): number { return this.items.length; }

  clear(): void {
    this.items.length = 0;
    this.lastGasBucket.clear();
  }

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
        case 'break': {
          // O bloco se desfaz no PROPRIO material. O evento carrega qual era,
          // porque quando ele chega a grade ja mudou e o cliente nao teria mais
          // como saber o que caiu ali.
          const kind: ParticleKind = ev.solid === SOLID_CRYSTAL ? 'crystalShard' : 'rubble';
          // Poucos cacos POR bloco de proposito: uma explosao derruba dezenas
          // de celulas de uma vez, e 12 cacos em cada uma comeria o orcamento
          // inteiro — o entulho expulsaria as brasas da propria explosao.
          this.burst(ev.x, ev.y, kind, n(6), 1.6, 1.5, 620, 7);
          break;
        }
        case 'corrode':
          // Poucas gotas e vida curta: a informacao de verdade esta no BLOCO,
          // que mudou de estado no grid e fica na tela. A particula so aponta
          // onde olhar no instante em que acontece.
          this.burst(ev.x, ev.y, 'acidDrip', n(5), 0.9, 1.0, 420, 11);
          break;
        case 'chip':
          this.burst(ev.x, ev.y, 'oreChip', n(4), 1.4, 1.4, 380, 13);
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

    // O chamador percorre as celulas de gas visiveis a CADA frame, e a condicao
    // acima continua verdadeira pelos 200ms inteiros do bucket. Sem esta trava
    // uma unica celula empurrava ~12 motes por bucket a 60Hz — e, como a
    // semente e constante dentro do bucket, os 12 nasciam na MESMA posicao com
    // a MESMA velocidade: duplicatas invisiveis, empilhadas, comendo o
    // orcamento e expulsando as brasas de explosao.
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastGasBucket.get(cell) === bucket) return;
    this.lastGasBucket.set(cell, bucket);

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
    // A particula encolhe com a idade em vez de trocar de cor: com as tres
    // entradas da rampa agora ocupadas pelas FACES do voxel, o esmaecer passou
    // a ser tamanho e alpha, que e o que faz brasa parecer brasa apagando.
    const base = 4 * zoom;
    ctx.save();
    for (const p of sorted) {
      const [sx, sy] = project(p.x, p.y);
      const life = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = 0.35 + life * 0.65;
      const py = sy - p.z * tileH * zoom;
      drawVoxel(ctx, sx, py, base * (0.45 + life * 0.55), RAMP[p.kind]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
