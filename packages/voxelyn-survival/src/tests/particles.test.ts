import { describe, expect, it } from 'vitest';
import { FALLBACK_FRAME_MS, VoxelParticles, frameDeltaMs } from '../client/particles';
import { SOLID_CRYSTAL, SOLID_FRAGILE } from '@voxelyn/survival-sim';
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

  // O evento carrega o material porque quando ele chega a grade ja mudou: o
  // cliente nao teria mais como saber o que havia naquela celula.
  it('desfaz o bloco no proprio material', () => {
    const pedra = new VoxelParticles();
    const cristal = new VoxelParticles();
    pedra.ingest([{ t: 'break', x: 4.5, y: 4.5, solid: SOLID_FRAGILE }], 96, 1);
    cristal.ingest([{ t: 'break', x: 4.5, y: 4.5, solid: SOLID_CRYSTAL }], 96, 1);
    const kinds = (p: VoxelParticles) =>
      new Set((p as unknown as { items: Array<{ kind: string }> }).items.map((i) => i.kind));
    expect(kinds(pedra)).toEqual(new Set(['rubble']));
    expect(kinds(cristal)).toEqual(new Set(['crystalShard']));
  });

  it('desmorona rasteiro, nao explode para cima', () => {
    const quebra = new VoxelParticles();
    const estouro = new VoxelParticles();
    quebra.ingest([{ t: 'break', x: 4.5, y: 4.5, solid: SOLID_FRAGILE }], 96, 1);
    estouro.ingest([explosion(4.5, 4.5)], 96, 1);
    const topo = (p: VoxelParticles) => {
      for (let i = 0; i < 10; i++) p.step(33);
      const items = (p as unknown as { items: Array<{ z: number }> }).items;
      return items.length ? Math.max(...items.map((it) => it.z)) : 0;
    };
    expect(topo(quebra)).toBeLessThan(topo(estouro));
  });

  // O chamador varre as celulas de gas visiveis a cada frame, e a janela de
  // 200ms continua aberta o tempo todo. Sem trava por celula, uma unica celula
  // empurrava ~12 motes por bucket a 60Hz — todos na MESMA posicao, porque a
  // semente e constante dentro do bucket. Duplicatas invisiveis comendo o teto.
  it('emite no maximo um mote de gas por celula por janela de tempo', () => {
    const p = new VoxelParticles();
    for (let ms = 0; ms < 600; ms += 16) p.emitGas(5.5, 7.5, ms, 1);
    // Tres janelas de 200ms => no maximo tres motes, nunca um por frame.
    expect(p.count).toBeLessThanOrEqual(3);
  });

  it('nao deixa o gas expulsar as particulas de explosao', () => {
    const p = new VoxelParticles();
    p.budget = 40;
    p.ingest([explosion(20, 20)], 96, 1);
    const aposEstouro = p.count;
    // Meio segundo de gas de varias celulas, no ritmo real do render.
    for (let ms = 0; ms < 500; ms += 16) {
      for (let cx = 0; cx < 6; cx++) p.emitGas(cx + 0.5, 3.5, ms, 1);
    }
    const items = (p as unknown as { items: Array<{ kind: string }> }).items;
    expect(aposEstouro).toBeGreaterThan(0);
    expect(items.filter((i) => i.kind !== 'gas').length).toBeGreaterThan(0);
  });

  // Fisica igual em qualquer taxa de atualizacao: 12 passos de 8ms tem de levar
  // a particula ao mesmo lugar que 3 passos de 32ms.
  it('avanca igual a 60Hz e a 120Hz para o mesmo tempo real', () => {
    const rapido = new VoxelParticles();
    const lento = new VoxelParticles();
    rapido.ingest([explosion(10, 10)], 96, 1);
    lento.ingest([explosion(10, 10)], 96, 1);
    for (let i = 0; i < 12; i++) rapido.step(8);
    for (let i = 0; i < 3; i++) lento.step(32);
    const topo = (p: VoxelParticles) => {
      const items = (p as unknown as { items: Array<{ z: number }> }).items;
      return items.length ? Math.max(...items.map((i) => i.z)) : 0;
    };
    expect(topo(rapido)).toBeCloseTo(topo(lento), 1);
  });

  it('ignora eventos que nao geram materia', () => {
    const p = new VoxelParticles();
    p.ingest([{ t: 'message', text: 'oi' }, { t: 'extracted', withCore: true }], 96, 1);
    expect(p.count).toBe(0);
  });
});

describe('passo do frame', () => {
  it('usa o tempo real decorrido', () => {
    expect(frameDeltaMs(1000, 1033)).toBeCloseTo(33);
    expect(frameDeltaMs(1000, 1008)).toBeCloseTo(8);
  });

  it('cai no padrao no primeiro frame e em relogio invalido', () => {
    expect(frameDeltaMs(0, 1000)).toBe(FALLBACK_FRAME_MS);
    expect(frameDeltaMs(NaN, 1000)).toBe(FALLBACK_FRAME_MS);
    // relogio andando para tras nao pode virar passo negativo
    expect(frameDeltaMs(2000, 1000)).toBe(FALLBACK_FRAME_MS);
  });

  it('limita o salto de uma aba que volta do segundo plano', () => {
    expect(frameDeltaMs(1000, 61000)).toBe(100);
  });
});
