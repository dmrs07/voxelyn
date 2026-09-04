// O CONGELAMENTO DA RAINHA, como o cliente o mostra e o toca.
//
// O que estes testes protegem:
//
// 1. A COROA CABE NO ALCANCE. A geometria promete ate onde o lago foi refeito
//    (e quais buracos fecharam); uma lasca alem do raio real mentiria.
// 2. O CIRCULO E COMPLETO. A referencia e uma coroa em volta da figura, sem
//    lado aberto: todo quadrante recebe lascas.
// 3. SALTA E APAGA. A coroa sai do chao nos primeiros ~30% e so entao some —
//    gelo que JA se formou de uma vez, e nao gelo se formando.
// 4. MESMA SEMENTE, MESMA COROA. Duas maquinas de uma sala veem o mesmo leque.
// 5. O SOM E O QUE FOI PEDIDO: um saco de cacos caindo (muitos estalos curtos
//    e um baque) e sinos de gelo pendurados (senos agudos com cauda longa que
//    sobrevivem ao fim dos cacos).
import { describe, expect, it } from 'vitest';
import {
  FROST_BURST_MS,
  FROST_BURST_SHARDS,
  FROST_BURST_STREAKS,
  frostBurst,
  frostBurstFrame,
  pieceGrow,
} from './frost-burst';
import { VOICE_RENDERERS } from './audio/synth';

describe('a coroa de estilhacos', () => {
  const radius = 6;
  const burst = frostBurst(1234, radius);

  it('nenhuma lasca nem risco passa do raio da habilidade', () => {
    expect(burst.shards).toHaveLength(FROST_BURST_SHARDS);
    expect(burst.streaks).toHaveLength(FROST_BURST_STREAKS);
    for (const sh of burst.shards) {
      expect(sh.reach).toBeLessThanOrEqual(radius);
      expect(sh.base).toBeLessThan(sh.reach);
      expect(sh.height).toBeGreaterThan(0);
    }
    for (const st of burst.streaks) {
      expect(st.to).toBeLessThanOrEqual(radius);
      expect(st.from).toBeLessThan(st.to);
    }
  });

  it('o circulo e completo: cada quadrante recebe lascas', () => {
    const quadrants = [0, 0, 0, 0];
    for (const sh of burst.shards) {
      const a = ((sh.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      quadrants[Math.floor(a / (Math.PI / 2))]++;
    }
    for (const q of quadrants) expect(q).toBeGreaterThanOrEqual(FROST_BURST_SHARDS / 4 - 2);
  });

  it('as lascas se inclinam para FORA e tem duas alturas', () => {
    // A ponta chega mais longe que a base (leque, nao palicada), e ha uma
    // fileira baixa e uma alta — a profundidade da referencia.
    const heights = burst.shards.map((s) => s.height).sort((a, b) => a - b);
    expect(heights[heights.length - 1] - heights[0]).toBeGreaterThan(0.5);
  });

  it('salta nos primeiros 30% e so entao apaga; no fim nao sobra nada', () => {
    expect(frostBurstFrame(0).grow).toBe(0);
    expect(frostBurstFrame(0.3).grow).toBeCloseTo(1, 5);
    expect(frostBurstFrame(0.3).alpha).toBe(1);
    expect(frostBurstFrame(0.7).alpha).toBeLessThan(frostBurstFrame(0.45).alpha);
    expect(frostBurstFrame(1).alpha).toBe(0);
    expect(frostBurstFrame(1).disc).toBe(0);
    // Uma peca com atraso nao aparece antes da vez, e chega inteira.
    expect(pieceGrow(0.1, 0.5)).toBe(0);
    expect(pieceGrow(1, 0.5)).toBe(1);
    // A coroa dura o suficiente para ser lida e menos que o preparo dela.
    expect(FROST_BURST_MS).toBeGreaterThanOrEqual(700);
    expect(FROST_BURST_MS).toBeLessThanOrEqual(1300);
  });

  it('mesma semente, mesma coroa; sementes diferentes, coroas diferentes', () => {
    expect(frostBurst(77, radius)).toEqual(frostBurst(77, radius));
    expect(frostBurst(77, radius)).not.toEqual(frostBurst(78, radius));
  });
});

// Um AudioContext de mentira que so anota o que foi criado: a altura de cada
// oscilador, quando comecou e quando parou, e quantas rajadas de ruido sairam.
type Osc = { type: string; hz: number; start: number; stop: number };
const fakeContext = (): { ctx: AudioContext; oscs: Osc[]; bursts: number[] } => {
  const oscs: Osc[] = [];
  const bursts: number[] = [];
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime: (v: number) => {
        p.value = v;
      },
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
    };
    return p;
  };
  const node = () => {
    const n = { connect: () => n };
    return n;
  };
  const ctx = {
    createGain: () => ({ ...node(), gain: param() }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
    createOscillator: () => {
      const rec: Osc = { type: '', hz: 0, start: 0, stop: 0 };
      const frequency = param();
      const osc = {
        ...node(),
        set type(v: string) {
          rec.type = v;
        },
        frequency,
        detune: param(),
        start: (t: number) => {
          rec.hz = frequency.value;
          rec.start = t;
        },
        stop: (t: number) => {
          rec.stop = t;
          oscs.push(rec);
        },
      };
      return osc;
    },
    createBufferSource: () => ({
      ...node(),
      buffer: null,
      playbackRate: param(),
      start: (t: number) => {
        bursts.push(t);
      },
    }),
  };
  return { ctx: ctx as unknown as AudioContext, oscs, bursts };
};

describe('o som do congelamento', () => {
  const render = () => {
    const fake = fakeContext();
    VOICE_RENDERERS.frostQueenFreeze(
      fake.ctx,
      { connect: () => undefined } as unknown as AudioNode,
      0,
      { duration: 2 } as unknown as AudioBuffer,
    );
    return fake;
  };

  it('um saco de cacos: um baque grave e DEZENAS de estalos curtos que rareiam', () => {
    const { oscs, bursts } = render();
    expect(oscs.some((o) => o.type === 'sine' && o.hz < 200)).toBe(true);
    expect(bursts.length).toBeGreaterThanOrEqual(16);
    // Densos no comeco, rareando: a primeira metade dos estalos cabe em menos
    // tempo que a segunda.
    const at = [...bursts].sort((a, b) => a - b);
    const mid = Math.floor(at.length / 2);
    expect(at[mid] - at[0]).toBeLessThan(at[at.length - 1] - at[mid]);
  });

  it('sinos de gelo pendurados: senos agudos, inarmonicos, com cauda longa', () => {
    const { oscs, bursts } = render();
    const chimes = oscs.filter((o) => o.type === 'sine' && o.hz > 3000 && o.stop - o.start >= 0.8);
    expect(chimes.length).toBeGreaterThanOrEqual(6);
    // Pendurados: cada altura aparece em PAR (o batimento entre os dois e o
    // balanco do caco).
    const byHz = new Map<number, number>();
    for (const c of chimes) byHz.set(c.hz, (byHz.get(c.hz) ?? 0) + 1);
    for (const n of byHz.values()) expect(n).toBeGreaterThanOrEqual(2);
    // Nenhum par de sinos forma oitava ou quinta justa: e gelo, nao cristal.
    const hzs = [...byHz.keys()];
    for (let i = 0; i < hzs.length; i++) {
      for (let j = i + 1; j < hzs.length; j++) {
        const ratio = Math.max(hzs[i], hzs[j]) / Math.min(hzs[i], hzs[j]);
        for (const just of [2, 1.5]) expect(Math.abs(ratio - just)).toBeGreaterThan(0.02);
      }
    }
    // Os sinos SOBREVIVEM ao fim da avalanche.
    const lastBurst = Math.max(...bursts);
    const lastChimeEnd = Math.max(...chimes.map((c) => c.stop));
    expect(lastChimeEnd).toBeGreaterThan(lastBurst + 0.5);
  });
});
