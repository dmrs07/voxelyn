// A APRESENTACAO DO CONGELAMENTO: como o cliente veste, toca e anuncia o
// medidor — sem jamais decidir nada por ele.
//
// O que estes testes protegem:
//
// 1. A GEADA E MONOTONICA. Mais frio nunca tira gelo do corpo, e cada degrau
//    acrescenta ao anterior (geada -> placas -> cristais).
// 2. A ESTATUA COBRE O CORPO e nao e uma elipse; as fissuras crescem na
//    proporcao do que derreteu.
// 3. O PULSO DO CICLO tem duracao e apaga; o tremor respeita movimento
//    reduzido.
// 4. CADA EVENTO TEM VOZ PROPRIA, com spec e sintetizador; a crosta fechando e
//    se partindo soam como interface (nao espaciais) e com prioridade alta.
// 5. OS RELOGIOS DA APRESENTACAO seguem os eventos e sao limpos no reset.
// 6. AS DICAS aparecem poucas vezes e depois calam; armazenamento bloqueado
//    nao vira ruido.
// 7. OS TEXTOS existem nas duas linguas e a instrucao critica DIZ o que fazer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import { cuesForEvent } from './audio/cues';
import { VOICE_SPECS } from './audio/voices';
import { VOICE_RENDERERS } from './audio/synth';
import {
  FROST_CRYSTALS_AT,
  FROST_PLATES_AT,
  FROST_VISIBLE_AT,
  THERMAL_PULSE_MS,
  frostCracks,
  frostPieces,
  frostShell,
  frostTier,
  frostTint,
  thermalPulse,
} from './frost-shell';
import { FROST_HINT_SHOWS, resetFrostHints, takeFrostHint } from './frost-hints';
import { EntityPresentation } from './presentation';
import { PT_BR } from './i18n/locales/pt-BR';
import { EN } from './i18n/locales/en';

const ctx = { worldWidth: 96, localPlayerId: 1 };

describe('a geada no corpo', () => {
  it('e monotonica: mais frio nunca tira gelo', () => {
    let previous = 0;
    for (let f = 0; f <= 1.0001; f += 0.02) {
      const n = frostPieces(42, f).length;
      expect(n, `frac ${f.toFixed(2)}`).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });

  it('os degraus acrescentam tipos: geada, depois placas, depois cristais', () => {
    const kinds = (f: number) => new Set(frostPieces(7, f).map((p) => p.kind));
    expect(kinds(FROST_VISIBLE_AT - 0.01).size).toBe(0);
    expect([...kinds(FROST_VISIBLE_AT + 0.05)]).toEqual(['speck']);
    expect(kinds(FROST_PLATES_AT + 0.05).has('plate')).toBe(true);
    expect(kinds(FROST_PLATES_AT + 0.05).has('crystal')).toBe(false);
    expect(kinds(FROST_CRYSTALS_AT + 0.05).has('crystal')).toBe(true);
    expect(kinds(1).has('speck')).toBe(true);
    expect(frostTier(0, false)).toBe('none');
    expect(frostTier(0.5, false)).toBe('plates');
    expect(frostTier(0.9, false)).toBe('crystals');
    expect(frostTier(0.2, true)).toBe('statue');
  });

  it('os cristais apontam para o nucleo do chassi', () => {
    for (const c of frostPieces(9, 1).filter((p) => p.kind === 'crystal')) {
      // A direcao aponta do cristal para (0, 0.5): o cosseno do angulo tem o
      // sinal contrario ao x da raiz.
      const towardsX = Math.cos(c.angle);
      if (Math.abs(c.x) > 0.05) expect(Math.sign(towardsX)).toBe(-Math.sign(c.x));
    }
  });

  it('o veu sobe com o medidor e a estatua e o mais opaco', () => {
    expect(frostTint(0, false)).toBeUndefined();
    const low = frostTint(0.2, false)!;
    const high = frostTint(0.9, false)!;
    const statue = frostTint(1, true)!;
    expect(low.alpha).toBeLessThan(high.alpha);
    expect(high.alpha).toBeLessThan(statue.alpha);
    // Nunca chapado: as faces do sprite tem de sobreviver por baixo.
    expect(statue.alpha).toBeLessThan(0.8);
  });

  it('a concha e facetada, cobre o corpo inteiro e e a mesma para a mesma semente', () => {
    const shell = frostShell(3);
    expect(shell.length).toBeGreaterThanOrEqual(10);
    const xs = shell.map(([x]) => x);
    const ys = shell.map(([, y]) => y);
    expect(Math.min(...xs)).toBeLessThan(-0.8);
    expect(Math.max(...xs)).toBeGreaterThan(0.8);
    expect(Math.min(...ys)).toBeLessThan(0.05);
    expect(Math.max(...ys)).toBeGreaterThan(0.95);
    // Nao e uma elipse: os raios variam.
    const radii = shell.map(([x, y]) => Math.hypot(x, (y - 0.5) / 0.56));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.05);
    expect(frostShell(3)).toEqual(shell);
    expect(frostShell(4)).not.toEqual(shell);
  });

  it('as fissuras nascem no motor e na arma', () => {
    const cracks = frostCracks(5);
    expect(cracks.length).toBeGreaterThanOrEqual(6);
    expect(cracks.some((c) => Math.abs(c.x0 - 0.6) < 0.01)).toBe(true);
    expect(cracks.some((c) => Math.abs(c.x0) < 0.15)).toBe(true);
  });

  it('o pulso do ciclo acende, treme e apaga; movimento reduzido tira o tremor', () => {
    expect(thermalPulse(0).glow).toBe(1);
    expect(thermalPulse(THERMAL_PULSE_MS / 2).glow).toBeLessThan(1);
    expect(thermalPulse(THERMAL_PULSE_MS).glow).toBe(0);
    expect(thermalPulse(Number.POSITIVE_INFINITY).steam).toBe(false);
    expect(thermalPulse(20).steam).toBe(true);
    const shaking = thermalPulse(20);
    expect(Math.abs(shaking.dx) + Math.abs(shaking.dy)).toBeGreaterThan(0);
    const reduced = thermalPulse(20, true);
    expect(Math.abs(reduced.dx)).toBe(0);
    expect(Math.abs(reduced.dy)).toBe(0);
    expect(reduced.glow).toBe(shaking.glow);
  });
});

describe('o som do congelamento', () => {
  const dose: SemanticEvent = {
    t: 'freeze_dose',
    slot: 0,
    x: 4,
    y: 4,
    amount: 450,
    freeze: 450,
    source: 'frost_queen',
  };
  const frostbite: SemanticEvent = { t: 'frostbite', slot: 0, x: 4, y: 4 };
  const cycle: SemanticEvent = { t: 'thermal_cycle', slot: 0, x: 4, y: 4, freeze: 900, heat: 12 };
  const brk: SemanticEvent = { t: 'frostbite_break', slot: 0, x: 4, y: 4 };

  it('cada evento tem voz propria, com spec e sintetizador', () => {
    const voices = [dose, frostbite, cycle, brk].map((e) => cuesForEvent(e, ctx)[0].voice);
    expect(voices).toEqual(['freezeDose', 'frostbite', 'thermalCycle', 'frostbiteBreak']);
    for (const id of voices) {
      expect(VOICE_SPECS[id], `${id} sem spec`).toBeDefined();
      expect(VOICE_RENDERERS[id], `${id} sem sintetizador`).toBeTypeOf('function');
    }
  });

  it('a crosta fechando e se partindo soam como interface, e mandam', () => {
    expect(VOICE_SPECS.frostbite.spatial).toBe(false);
    expect(VOICE_SPECS.frostbiteBreak.spatial).toBe(false);
    expect(VOICE_SPECS.frostbite.priority).toBeGreaterThanOrEqual(9);
    expect(VOICE_SPECS.frostbiteBreak.priority).toBeGreaterThanOrEqual(9);
    // A dose e o ciclo sao do mundo: o parceiro tomando frio e informacao.
    expect(VOICE_SPECS.freezeDose.spatial).toBe(true);
    expect(VOICE_SPECS.thermalCycle.spatial).toBe(true);
    // O ciclo sai cinco vezes por segundo; a trava impede dois no mesmo quadro.
    expect(VOICE_SPECS.thermalCycle.minIntervalMs).toBeGreaterThanOrEqual(100);
    expect(VOICE_SPECS.thermalCycle.minIntervalMs).toBeLessThan(200);
  });

  it('a dose pequena soa menor que a Nova', () => {
    const small = cuesForEvent({ ...dose, amount: 120, source: 'frost_wraith' }, ctx)[0];
    expect(small.scale).toBeLessThan(cuesForEvent(dose, ctx)[0].scale);
  });
});

describe('os relogios da apresentacao', () => {
  it('seguem os eventos e sao limpos pela quebra e pelo reset', () => {
    const p = new EntityPresentation();
    p.ingest([{ t: 'frostbite', slot: 0, x: 1, y: 1 }], 1000);
    expect(p.frostClocks(1, 1300).sinceFrostbiteMs).toBe(300);
    expect(p.frostClocks(1, 1300).sinceCycleMs).toBe(Number.POSITIVE_INFINITY);
    p.ingest([{ t: 'thermal_cycle', slot: 0, x: 1, y: 1, freeze: 900, heat: 12 }], 1400);
    expect(p.frostClocks(1, 1500).sinceCycleMs).toBe(100);
    // Outro slot nao herda o relogio.
    expect(p.frostClocks(2, 1500).sinceCycleMs).toBe(Number.POSITIVE_INFINITY);
    p.ingest([{ t: 'frostbite_break', slot: 0, x: 1, y: 1 }], 1800);
    const after = p.frostClocks(1, 1900);
    expect(after.sinceBreakMs).toBe(100);
    expect(after.sinceFrostbiteMs).toBe(Number.POSITIVE_INFINITY);
    expect(after.sinceCycleMs).toBe(Number.POSITIVE_INFINITY);
    p.reset();
    expect(p.frostClocks(1, 1900).sinceBreakMs).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('as dicas do frio', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('aparecem poucas vezes e depois calam', () => {
    resetFrostHints();
    let shown = 0;
    for (let i = 0; i < FROST_HINT_SHOWS + 4; i++) if (takeFrostHint('frostbite')) shown++;
    expect(shown).toBe(FROST_HINT_SHOWS);
    // A outra dica tem a propria contagem.
    expect(takeFrostHint('partial')).toBe(true);
  });

  it('sem armazenamento, nunca viram ruido', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => undefined,
    });
    expect(takeFrostHint('partial')).toBe(false);
  });
});

describe('os textos do congelamento', () => {
  it('existem nas duas linguas, traduzidos, e a instrucao diz o que fazer', () => {
    for (const key of [
      'hud.freeze.label',
      'hud.freeze.critical',
      'hud.freeze.hold',
      'hint.freeze.partial',
      'hint.freeze.frostbite',
      'toast.frostbite.break',
    ] as const) {
      expect(PT_BR[key].trim().length, key).toBeGreaterThan(0);
      expect(EN[key].trim().length, key).toBeGreaterThan(0);
      expect(PT_BR[key], key).not.toBe(EN[key]);
    }
    expect(PT_BR['hint.freeze.frostbite']).toMatch(/SEGURE/);
    expect(EN['hint.freeze.frostbite']).toMatch(/HOLD/);
  });
});
