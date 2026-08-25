import { describe, expect, it } from 'vitest';
import {
  LAYOUTS,
  RUN_BUDGET,
  createHackathon,
  emptyCommand,
  fmtCost,
  rollCandidates,
  rollLayout,
  rollProject,
  step,
} from './index.js';

/**
 * O GERADOR e testado como tudo aqui: jogando. Determinismo por semente,
 * cobertura de trilhas, orcamento sempre jogavel, grafos aciclicos e
 * completaveis, e uma run GERADA que atravessa ate a banca sem excecao.
 */

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 977 + 13);

describe('gerador de candidatos', () => {
  it('mesma semente, mesmos seis curriculos; sementes diferentes variam', () => {
    const a = rollCandidates(123);
    const b = rollCandidates(123);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = rollCandidates(124);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('os quatro primeiros COBREM as quatro trilhas — run sem backend e loteria, nao roguelite', () => {
    for (const seed of SEEDS) {
      const specs = rollCandidates(seed)
        .slice(0, 4)
        .map((c) => c.specialty);
      for (const t of ['backend', 'frontend', 'design', 'devops']) {
        expect(specs, `seed ${seed}`).toContain(t);
      }
    }
  });

  it('o QUARTETO de cobertura cabe no orcamento — a fumaca pagou para aprender', () => {
    for (const seed of SEEDS) {
      const four = rollCandidates(seed).slice(0, 4);
      const sum = four.reduce((s, c) => s + c.cost, 0);
      expect(sum, `seed ${seed}: cobertura custa ${sum}`).toBeLessThanOrEqual(RUN_BUDGET);
    }
  });

  it('o orcamento SEMPRE contrata pelo menos tres — nunca nasce uma run impossivel', () => {
    for (const seed of SEEDS) {
      const costs = rollCandidates(seed)
        .map((c) => c.cost)
        .sort((a, b) => a - b);
      expect(costs[0]! + costs[1]! + costs[2]!, `seed ${seed}`).toBeLessThanOrEqual(RUN_BUDGET);
    }
  });

  it('dois traits visiveis, um oculto, nunca repetidos; custo minimo positivo', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const c of rollCandidates(seed)) {
        expect(c.traits.length).toBe(2);
        expect(new Set([...c.traits, c.hiddenTrait]).size).toBe(3);
        expect(c.cost).toBeGreaterThan(0);
        expect(fmtCost(c.cost).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('gerador de projetos', () => {
  it('o grafo e ACICLICO e completavel em toda semente', () => {
    for (const seed of SEEDS) {
      const p = rollProject(seed);
      const done = new Set<string>();
      let moved = true;
      while (moved) {
        moved = false;
        for (const t of p.tasks) {
          if (!done.has(t.id) && t.deps.every((d) => done.has(d))) {
            done.add(t.id);
            moved = true;
          }
        }
      }
      expect(done.size, `seed ${seed}: grafo com ciclo ou dependencia orfa`).toBe(p.tasks.length);
    }
  });

  it('as tres DECISOES sobrevivem a geracao (b1, d1, o1)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const p = rollProject(seed);
      for (const id of ['b1', 'd1', 'o1']) {
        expect(p.tasks.find((t) => t.id === id)?.choice, `seed ${seed} ${id}`).toBeTruthy();
      }
    }
  });
});

describe('layouts', () => {
  it('todo layout tem os sete postos, dentro da cena e acima da barra de acoes', () => {
    for (const l of LAYOUTS) {
      expect(l.slots.length).toBe(7);
      for (const s of l.slots) {
        expect(s.x, `${l.id}/${s.id}`).toBeGreaterThan(20);
        expect(s.x, `${l.id}/${s.id}`).toBeLessThan(460);
        expect(s.y, `${l.id}/${s.id}`).toBeGreaterThan(100);
        expect(s.y, `${l.id}/${s.id}`).toBeLessThan(252);
      }
    }
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(LAYOUTS.length);
  });

  it('o sorteio de layout e deterministico por semente', () => {
    expect(rollLayout(55).id).toBe(rollLayout(55).id);
  });
});

describe('a run GERADA atravessa inteira', () => {
  it('contratar os quatro de cobertura e ficar parado: a run termina (e perde) sem excecao', () => {
    for (const seed of [3, 77, 901]) {
      const team = rollCandidates(seed).slice(0, 4);
      const state = createHackathon(seed, team);
      while (state.phase !== 'done') step(state, emptyCommand());
      expect(state.result, `seed ${seed}`).not.toBeNull();
      expect(state.result!.outcome, `seed ${seed}`).toBe('crashed');
    }
  });

  it('o projeto e o layout da run batem com a semente (recrutamento honesto)', () => {
    const seed = 4242;
    const state = createHackathon(seed, rollCandidates(seed).slice(0, 4));
    expect(state.project.name).toBe(rollProject(seed).name);
    expect(state.layoutId).toBe(rollLayout(seed).id);
  });
});
