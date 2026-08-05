// A mascara de descobertas tem de cobrir TODA descoberta.
//
// Este arquivo existe por um defeito que ninguem viu por versoes seguidas: a
// telemetria prendia `discoveries` num teto de 16 bits escrito quando havia
// dezesseis deles. Do bit 16 em diante, toda run com descoberta de chefe era
// gravada como 65535 — o bit real perdido e todos os de baixo ligados. Nada
// falhava; a analise e que passou a mentir.
//
// A defesa nao e lembrar de atualizar o teto: e um teste que ENUMERA os bits
// exportados e cobra a mascara. Bit novo nasce coberto, ou o teste cai.
import { describe, expect, it } from 'vitest';
import * as sim from '../src/types';

const DISCOVERY_BITS = Object.entries(sim)
  .filter(([name, value]) => name.startsWith('DISCOVERY_') && name !== 'DISCOVERY_MASK' && typeof value === 'number')
  .map(([name, value]) => [name, value as number] as const);

describe('mascara de descobertas', () => {
  it('cobre todo DISCOVERY_* exportado', () => {
    expect(DISCOVERY_BITS.length).toBeGreaterThan(20);
    for (const [name, bit] of DISCOVERY_BITS) {
      expect(bit & sim.DISCOVERY_MASK, `${name} fora da mascara`).toBe(bit);
    }
  });

  it('cada descoberta e UM bit, e nenhum se repete', () => {
    // Dois nomes no mesmo bit seria uma descoberta acendendo outra no codex —
    // e o tipo de erro que so aparece quando o jogador ve um documento que nao
    // deveria ter destravado.
    const seen = new Map<number, string>();
    for (const [name, bit] of DISCOVERY_BITS) {
      expect(bit, `${name} nao e potencia de dois`).toBeGreaterThan(0);
      expect(bit & (bit - 1), `${name} nao e um bit unico`).toBe(0);
      expect(seen.get(bit), `${name} colide com ${seen.get(bit)}`).toBeUndefined();
      seen.set(bit, name);
    }
  });

  it('a mascara nao carrega folga alem do proximo bit', () => {
    // Uma mascara larga demais aceitaria bits que nao significam nada, e o
    // ponto dela e justamente descartar o que nao se reconhece.
    const highest = DISCOVERY_BITS.reduce((max, [, bit]) => Math.max(max, bit), 0);
    expect(sim.DISCOVERY_MASK).toBeLessThan(highest * 4);
    expect(sim.DISCOVERY_MASK).toBeGreaterThanOrEqual(highest);
  });
});
