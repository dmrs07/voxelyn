import { describe, expect, it } from 'vitest';
import { VoxelParticles } from '../client/particles';
import type { SemanticEvent } from '@voxelyn/survival-sim';

const explosion = (x = 10, y = 10, radius = 3): SemanticEvent => ({ t: 'explosion', x, y, radius });

describe('particulas voxel', () => {
  it('nasce de evento autoritativo, nunca por conta propria', () => {
    const p = new VoxelParticles();
    p.step(500);
    expect(p.count).toBe(0);
    p.ingest([explosion()], 96, 1);
    expect(p.count).toBeGreaterThan(0);
  });

  // Dois clientes de uma sala recebem o MESMO evento; se o burst fosse
  // Math.random cada um veria estilhacos diferentes no mesmo lugar.
  it('produz o mesmo burst para o mesmo evento', () => {
    const a = new VoxelParticles();
    const b = new VoxelParticles();
    a.ingest([explosion()], 96, 1);
    b.ingest([explosion()], 96, 1);
    a.step(120);
    b.step(120);
    expect(a.count).toBe(b.count);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('da bursts diferentes em lugares diferentes', () => {
    const a = new VoxelParticles();
    const b = new VoxelParticles();
    a.ingest([explosion(10, 10)], 96, 1);
    b.ingest([explosion(40, 25)], 96, 1);
    a.step(120);
    b.step(120);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('respeita o teto e descarta a particula MAIS VELHA', () => {
    const p = new VoxelParticles();
    p.budget = 12;
    // Cada explosao nasce na propria posicao, entao da para saber DE QUAL
    // evento cada sobrevivente veio.
    for (let i = 0; i < 20; i++) p.ingest([explosion(i * 10, i * 10)], 96, 1);
    expect(p.count).toBe(12);
    // Descartar a particula NOVA no lugar da velha tambem respeitaria o teto,
    // mas congelaria a tela no primeiro estouro e deixaria a explosao que o
    // jogador esta olhando pela metade. Os sobreviventes tem de ser os ultimos.
    const items = (p as unknown as { items: Array<{ x: number }> }).items;
    const oldest = Math.min(...items.map((it) => it.x));
    expect(oldest).toBeGreaterThan(100);
  });

  it('escala a quantidade com a qualidade, sem mudar quais eventos existem', () => {
    const alto = new VoxelParticles();
    const baixo = new VoxelParticles();
    alto.ingest([explosion()], 96, 1);
    baixo.ingest([explosion()], 96, 0.2);
    expect(baixo.count).toBeGreaterThan(0);
    expect(baixo.count).toBeLessThan(alto.count);
  });

  it('expira tudo com o tempo, sem vazar', () => {
    const p = new VoxelParticles();
    p.ingest([explosion()], 96, 1);
    for (let i = 0; i < 200; i++) p.step(33);
    expect(p.count).toBe(0);
  });

  it('emite gas com o tempo e o gas SOBE, nunca cai', () => {
    const p = new VoxelParticles();
    let emitted = 0;
    for (let ms = 0; ms < 4000 && emitted === 0; ms += 100) {
      p.emitGas(5.5, 7.5, ms, 1);
      emitted = p.count;
    }
    expect(emitted).toBeGreaterThan(0);

    const heights: number[] = [];
    for (let i = 0; i < 8; i++) {
      p.step(50);
      const items = (p as unknown as { items: Array<{ z: number; kind: string }> }).items;
      const gas = items.filter((it) => it.kind === 'gas');
      if (gas.length > 0) heights.push(Math.max(...gas.map((g) => g.z)));
    }
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
  });

  // A semente do gas era so a celula, entao todo mote nascia no mesmo ponto e a
  // nuvem subia em fila indiana — uma linha vertical, nao uma coluna que abre.
  it('espalha os motes de gas de uma mesma celula', () => {
    const p = new VoxelParticles();
    for (let ms = 0; ms < 6000; ms += 200) p.emitGas(5.5, 7.5, ms, 1);
    const items = (p as unknown as { items: Array<{ x: number; y: number }> }).items;
    expect(items.length).toBeGreaterThan(3);
    const spots = new Set(items.map((it) => `${it.x.toFixed(3)},${it.y.toFixed(3)}`));
    expect(spots.size).toBeGreaterThan(1);
  });

  it('ignora eventos que nao geram materia', () => {
    const p = new VoxelParticles();
    p.ingest([{ t: 'message', text: 'oi' }, { t: 'extracted', withCore: true }], 96, 1);
    expect(p.count).toBe(0);
  });
});
