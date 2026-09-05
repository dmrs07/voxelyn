// A rigidez do rastro: o que separa uma raia de uma cobra. As promessas que
// o corpo do Leviata carrega alem das do Devorador — que a cabeca e o vetor,
// que os elos ficam sempre a `gap` um do outro, e que nenhum elo dobra mais
// que o limite — se quebram em silencio: um corpo torto continua sendo um
// corpo.
import { describe, expect, it } from 'vitest';
import { SpineTrail, bendToward, type TrailConfig, type TrailHead } from './spine-trail';

const base: TrailConfig = {
  segments: 6,
  gap: 0.6,
  headOffset: 0.7,
  step: 0.1,
  sway: 0,
  swayWaves: 1,
  swayHz: 0,
  teleportTiles: 3,
};

/** Anda a cabeca em linha reta para +x e depois vira 90 graus para +y. */
const walkAnL = (trail: SpineTrail, id: number): TrailHead => {
  let head: TrailHead = { x: 0, y: 0, liftPx: 0, dirX: 1, dirY: 0 };
  for (let i = 0; i < 60; i++) {
    head = { ...head, x: head.x + 0.1 };
    trail.follow(id, head, 0);
  }
  for (let i = 0; i < 30; i++) {
    head = { ...head, y: head.y + 0.1, dirX: 0, dirY: 1 };
    trail.follow(id, head, 0);
  }
  return head;
};

const angleBetween = (a: { dirX: number; dirY: number }, b: { dirX: number; dirY: number }) =>
  Math.abs(Math.atan2(a.dirX * b.dirY - a.dirY * b.dirX, a.dirX * b.dirX + a.dirY * b.dirY));

describe('bendToward', () => {
  it('gira ate o alvo quando ele esta dentro do limite, e para no limite quando nao', () => {
    const from = { x: 1, y: 0 };
    const near = bendToward(from, { x: Math.cos(0.1), y: Math.sin(0.1) }, 0.5);
    expect(Math.atan2(near.y, near.x)).toBeCloseTo(0.1, 6);
    const far = bendToward(from, { x: 0, y: 1 }, 0.5);
    expect(Math.atan2(far.y, far.x)).toBeCloseTo(0.5, 6);
    const back = bendToward(from, { x: 0, y: -1 }, 0.5);
    expect(Math.atan2(back.y, back.x)).toBeCloseTo(-0.5, 6);
  });
});

describe('rigidez do rastro', () => {
  it('sem rigidez o corpo senta sobre o caminho: a cauda ainda esta na reta antiga', () => {
    const trail = new SpineTrail(base);
    const head = walkAnL(trail, 1);
    const nodes = trail.follow(1, head, 0);
    // A cabeca subiu 3 tiles; o corpo tem 3,7 de arco, entao a cauda ainda
    // esta no trecho horizontal, apontando para +x.
    const tail = nodes[nodes.length - 1];
    expect(tail.y).toBeCloseTo(0, 1);
    expect(tail.dirX).toBeCloseTo(1, 1);
  });

  it('com rigidez total o corpo e uma reta atras do vetor da cabeca', () => {
    const trail = new SpineTrail({ ...base, stiffness: 1 });
    const head = walkAnL(trail, 1);
    const nodes = trail.follow(1, head, 0);
    nodes.forEach((node, k) => {
      expect(node.dirX).toBeCloseTo(0, 6);
      expect(node.dirY).toBeCloseTo(1, 6);
      expect(node.x).toBeCloseTo(head.x, 6);
      expect(node.y).toBeCloseTo(head.y - base.headOffset - k * base.gap, 6);
    });
  });

  it('com rigidez parcial os elos ficam a `gap` um do outro e nenhum dobra alem do limite', () => {
    const maxBend = (12 * Math.PI) / 180;
    const trail = new SpineTrail({ ...base, stiffness: 0.72, maxBend });
    const head = walkAnL(trail, 1);
    const nodes = trail.follow(1, head, 0);
    expect(Math.hypot(nodes[0].x - head.x, nodes[0].y - head.y)).toBeCloseTo(base.headOffset, 6);
    for (let k = 1; k < nodes.length; k++) {
      const a = nodes[k - 1];
      const b = nodes[k];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(base.gap, 6);
      expect(angleBetween(a, b)).toBeLessThanOrEqual(maxBend + 1e-9);
    }
    // O primeiro elo herda o rumo da cabeca: e o vetor.
    expect(angleBetween({ dirX: head.dirX, dirY: head.dirY }, nodes[0])).toBeLessThanOrEqual(
      maxBend + 1e-9,
    );
    // E o corpo VIRA: a cauda esta a caminho do rumo antigo (+x), mas nao
    // chegou la — a curva total e menor que a da cobra.
    const tail = nodes[nodes.length - 1];
    const turned = angleBetween({ dirX: 0, dirY: 1 }, tail);
    expect(turned).toBeGreaterThan(0.2);
    expect(turned).toBeLessThan(Math.PI / 2 - 0.05);
  });

  it('rigidez nao muda a forma quando a cabeca anda reto', () => {
    const soft = new SpineTrail(base);
    const stiff = new SpineTrail({ ...base, stiffness: 0.9, maxBend: 0.2 });
    let head: TrailHead = { x: 0, y: 0, liftPx: 0, dirX: 1, dirY: 0 };
    let a = soft.follow(1, head, 0);
    let b = stiff.follow(1, head, 0);
    for (let i = 0; i < 40; i++) {
      head = { ...head, x: head.x + 0.1 };
      a = soft.follow(1, head, 0);
      b = stiff.follow(1, head, 0);
    }
    // A corrente parte da cabeca EXATA; o rastro, da ultima amostra gravada,
    // que fica ate `step` atras dela. E a unica diferenca permitida.
    a.forEach((node, k) => {
      expect(Math.abs(b[k].x - node.x)).toBeLessThanOrEqual(base.step + 1e-9);
      expect(b[k].y).toBeCloseTo(node.y, 6);
      expect(b[k].dirX).toBeCloseTo(node.dirX, 6);
      expect(b[k].dirY).toBeCloseTo(node.dirY, 6);
    });
  });
});
