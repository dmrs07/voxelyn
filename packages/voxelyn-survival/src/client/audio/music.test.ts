import { describe, expect, it } from 'vitest';
import type { OccupationId, StratumId } from '@voxelyn/survival-sim';
import {
  LAYER_GAINS,
  MUSIC_CEILING,
  MUSIC_DUCK_FACTOR,
  MUSIC_THEMES,
  SMALLEST_TELEGRAPH_GAIN,
  OCCUPATION_VARIATIONS,
  barDurationSec,
  barIndexForTick,
  degreeHz,
  layersForIntensity,
  notesForBar,
} from './music';

// Listas explicitas de proposito: se um estrato novo entrar na sim sem tema,
// este arquivo quebra ANTES do jogador descer num setor mudo.
const STRATA: readonly StratumId[] = [
  'basalt',
  'prismatic',
  'aquifer',
  'sulfur',
  'furnace',
  'silica',
  'glacial',
  'ferric',
];
const OCCUPATIONS: readonly OccupationId[] = ['none', 'mycelial', 'aurix'];

describe('temas por estrato', () => {
  it('todo estrato tem tema e toda ocupacao tem variacao', () => {
    for (const s of STRATA) expect(MUSIC_THEMES[s], `estrato ${s} sem tema`).toBeDefined();
    for (const o of OCCUPATIONS) {
      expect(OCCUPATION_VARIATIONS[o], `ocupacao ${o} sem variacao`).toBeDefined();
    }
  });

  it('fundamentais na regiao doom (E1..D2) e andamento lento', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      expect(t.rootHz, `root de ${s}`).toBeGreaterThanOrEqual(40);
      expect(t.rootHz, `root de ${s}`).toBeLessThanOrEqual(80);
      expect(t.bpm, `bpm de ${s}`).toBeGreaterThanOrEqual(45);
      expect(t.bpm, `bpm de ${s}`).toBeLessThanOrEqual(72);
    }
  });

  it('todo grau do riff resolve para uma frequencia de baixo sensata', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      for (const note of t.riff) {
        const hz = degreeHz(t, note.degree, (note.octave ?? 0) + 1);
        expect(hz, `${s} grau ${note.degree}`).toBeGreaterThanOrEqual(30);
        expect(hz, `${s} grau ${note.degree}`).toBeLessThanOrEqual(400);
      }
    }
  });

  it('o riff cabe nos compassos que declara', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      const total = t.beatsPerBar * t.riffBars;
      for (const note of t.riff) {
        expect(note.beat, `${s}: beat fora do ciclo`).toBeGreaterThanOrEqual(0);
        expect(note.beat, `${s}: beat fora do ciclo`).toBeLessThan(total);
        expect(note.beat + note.lenBeats, `${s}: nota vaza o ciclo`).toBeLessThanOrEqual(
          total + 1,
        );
      }
    }
  });

  it('parametros expressivos dentro das faixas', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      expect(t.riffDensity).toBeGreaterThan(0);
      expect(t.riffDensity).toBeLessThanOrEqual(1);
      expect(t.noteDecay).toBeGreaterThan(0);
      expect(t.padAttack).toBeGreaterThan(0);
    }
  });
});

describe('mixagem declarada', () => {
  // A promessa central continua sendo SFX > musica — mas ela e cobrada onde
  // importa, e nao no silencio. Em repouso a musica agora PASSA do menor
  // telegrafo de proposito (foi assim que ela saiu de -30 para -21 LUFS); o que
  // nao pode acontecer e ela disputar o canal enquanto um telegrafo fala.
  //
  // Um teto solto (o antigo `<= 0.16`) nao dizia nada disso: era um numero que
  // passava a impressao de proteger sem nomear do que protegia.
  it('sob um telegrafo, a musica cede o canal', () => {
    const worstCase = Object.values(LAYER_GAINS).reduce((a, b) => a + b, 0);
    const ducked = MUSIC_CEILING * worstCase * MUSIC_DUCK_FACTOR;
    expect(ducked).toBeLessThan(SMALLEST_TELEGRAPH_GAIN);
  });

  it('o teto e o duck sao um par: mexeu num, recalcule o outro', () => {
    // O duck existe para devolver a musica ao ponto em que ela tocava em
    // repouso antes de o teto subir 9 dB (0,13 x 1,74 = 0,2262 de ganho). Se
    // este par sair de sincronia, ou a musica some sob o duck ou ela deixa de
    // ceder o canal — e nos dois casos alguem precisa olhar, nao descobrir no
    // ouvido de um jogador.
    const NIVEL_HISTORICO = 0.13 * 1.74;
    const duckedComposed = MUSIC_CEILING * 1.74 * MUSIC_DUCK_FACTOR;
    expect(duckedComposed).toBeCloseTo(NIVEL_HISTORICO, 2);
  });

  it('nenhuma camada passa do proprio barramento', () => {
    for (const gain of Object.values(LAYER_GAINS)) {
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(1);
    }
  });
});

describe('camadas por profundidade', () => {
  it('drone sempre; baixo, pad e tensao entram por limiar', () => {
    expect(layersForIntensity(0)).toEqual({ drone: true, bass: false, pad: false, tension: false });
    expect(layersForIntensity(0.2).bass).toBe(true);
    expect(layersForIntensity(0.2).pad).toBe(false);
    expect(layersForIntensity(0.5).pad).toBe(true);
    expect(layersForIntensity(0.5).tension).toBe(false);
    expect(layersForIntensity(1).tension).toBe(true);
  });

  it('mais fundo nunca toca menos camadas', () => {
    const count = (i: number): number =>
      Object.values(layersForIntensity(i)).filter(Boolean).length;
    let prev = count(0);
    for (let i = 0; i <= 1.001; i += 0.05) {
      const cur = count(i);
      expect(cur, `intensidade ${i.toFixed(2)}`).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});

describe('timeline pelo relogio da simulacao', () => {
  // A ponte tick -> compasso e o que sincroniza o co-op: valores concretos
  // aqui sao o contrato. bpm 60 e 4 batidas = compasso de 4 s = 80 ticks.
  it('barIndexForTick com valores concretos', () => {
    const t = MUSIC_THEMES.basalt; // bpm 60, 4 batidas
    expect(barDurationSec(t)).toBeCloseTo(4, 10);
    expect(barIndexForTick(0, t)).toBe(0);
    expect(barIndexForTick(79, t)).toBe(0);
    expect(barIndexForTick(80, t)).toBe(1);
    expect(barIndexForTick(800, t)).toBe(10);
  });

  it('e estavel a resync: o compasso e funcao do tick, nao do relogio local', () => {
    const t = MUSIC_THEMES.furnace;
    // Dois clientes no mesmo tick — um recem-conectado, outro na run desde o
    // inicio — tem de concordar no compasso.
    for (const tick of [0, 137, 4096, 99999]) {
      expect(barIndexForTick(tick, t)).toBe(barIndexForTick(tick, t));
      expect(Number.isInteger(barIndexForTick(tick, t))).toBe(true);
      expect(barIndexForTick(tick, t)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('notesForBar', () => {
  const layersOn = { drone: true, bass: true, pad: true, tension: false };

  it('e deterministica: mesmos argumentos, mesmo array', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      for (let bar = 0; bar < 8; bar++) {
        expect(notesForBar(t, bar, layersOn)).toEqual(notesForBar(t, bar, layersOn));
      }
    }
  });

  it('sem camada de baixo nao ha nota nenhuma', () => {
    const silent = { drone: true, bass: false, pad: false, tension: false };
    for (const s of STRATA) {
      expect(notesForBar(MUSIC_THEMES[s], 3, silent)).toEqual([]);
    }
  });

  it('as notas devolvidas cabem no compasso', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      for (let bar = 0; bar < 16; bar++) {
        for (const note of notesForBar(t, bar, layersOn)) {
          expect(note.beat).toBeGreaterThanOrEqual(0);
          expect(note.beat).toBeLessThan(t.beatsPerBar);
          expect(note.hz).toBeGreaterThan(0);
          expect(note.lenBeats).toBeGreaterThan(0);
        }
      }
    }
  });

  // Um riff que pode passar o ciclo inteiro calado deixa de ser fundacao.
  it('a ancora do ciclo sempre toca', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      const anchorBar = 0; // fase 0 do ciclo
      const notes = notesForBar(t, anchorBar, layersOn);
      expect(
        notes.some((n) => n.beat === 0),
        `${s}: compasso-ancora sem a primeira nota`,
      ).toBe(true);
    }
  });

  it('a rarefacao varia entre ciclos mas nunca inventa nota', () => {
    for (const s of STRATA) {
      const t = MUSIC_THEMES[s];
      const declared = t.riff.length;
      for (let bar = 0; bar < 32; bar++) {
        expect(notesForBar(t, bar, layersOn).length).toBeLessThanOrEqual(declared);
      }
    }
  });
});
