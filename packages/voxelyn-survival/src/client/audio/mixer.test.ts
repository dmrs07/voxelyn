import { describe, expect, it } from 'vitest';
import type { Cue } from './cues';
import { CueMixer, distanceCutoff, distanceGain, panFromOffset } from './mixer';
import { FULL_PAN_DISTANCE, MAX_AUDIBLE_DISTANCE, MAX_VOICES, NEAR_DISTANCE } from './voices';

const at = (voice: Cue['voice'], x: number, y = 0, scale = 1): Cue => ({ voice, x, y, scale });
const origin = { x: 0, y: 0 };

describe('atenuacao por distancia', () => {
  it('nao atenua dentro do raio proximo e zera no limite', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(NEAR_DISTANCE)).toBe(1);
    expect(distanceGain(MAX_AUDIBLE_DISTANCE)).toBe(0);
    expect(distanceGain(MAX_AUDIBLE_DISTANCE + 50)).toBe(0);
  });

  // O ponto da curva quadratica: no meio do caminho o som ja tem de soar
  // distante. Queda linear entregaria 0,5 aqui, que o ouvido le como "perto".
  it('cai mais rapido que linear no meio do caminho', () => {
    const meio = (NEAR_DISTANCE + MAX_AUDIBLE_DISTANCE) / 2;
    expect(distanceGain(meio)).toBeCloseTo(0.25, 5);
    expect(distanceGain(meio)).toBeLessThan(0.5);
  });

  it('e monotonica', () => {
    for (let d = 0; d < MAX_AUDIBLE_DISTANCE; d += 0.5) {
      expect(distanceGain(d)).toBeGreaterThanOrEqual(distanceGain(d + 0.5));
    }
  });
});

describe('corte de agudos por distancia', () => {
  it('abre junto ao ouvinte e fecha no limite', () => {
    expect(distanceCutoff(0)).toBeCloseTo(16000, 0);
    expect(distanceCutoff(MAX_AUDIBLE_DISTANCE)).toBeCloseTo(700, 0);
  });

  // Interpolacao exponencial: no meio do caminho o corte fica na MEDIA
  // GEOMETRICA (~3346 Hz), nao na aritmetica (8350 Hz). E o que distribui a
  // mudanca audivel por todo o trajeto em vez de concentra-la no fim.
  it('interpola em oitavas e nao em hertz', () => {
    const meio = (NEAR_DISTANCE + MAX_AUDIBLE_DISTANCE) / 2;
    expect(distanceCutoff(meio)).toBeCloseTo(Math.sqrt(16000 * 700), 0);
    expect(distanceCutoff(meio)).toBeLessThan((16000 + 700) / 2);
  });
});

describe('paneamento', () => {
  it('satura no alcance declarado e respeita o sinal', () => {
    expect(panFromOffset(0)).toBe(0);
    expect(panFromOffset(FULL_PAN_DISTANCE)).toBe(1);
    expect(panFromOffset(-FULL_PAN_DISTANCE * 3)).toBe(-1);
    expect(panFromOffset(FULL_PAN_DISTANCE / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('planejamento de vozes', () => {
  it('descarta o que esta alem do alcance audivel', () => {
    const mixer = new CueMixer();
    const planned = mixer.plan([at('breakRock', MAX_AUDIBLE_DISTANCE + 1)], origin, 0);
    expect(planned).toEqual([]);
  });

  it('nao atenua nem paneia voz de interface', () => {
    const mixer = new CueMixer();
    // `hitPlayer` nao e espacial: levar dano nao pode ficar mais baixo porque o
    // golpe veio das costas.
    const [voz] = mixer.plan([at('hitPlayer', 999, 999)], origin, 0);
    expect(voz.pan).toBe(0);
    expect(voz.gain).toBeGreaterThan(0.5);
  });

  it('respeita a trava anti-repeticao por voz', () => {
    const mixer = new CueMixer();
    expect(mixer.plan([at('ignite', 0)], origin, 0)).toHaveLength(1);
    // ignite trava em 160 ms: a 100 ms ainda esta travado, a 200 ms liberou.
    expect(mixer.plan([at('ignite', 0)], origin, 100)).toHaveLength(0);
    expect(mixer.plan([at('ignite', 0)], origin, 200)).toHaveLength(1);
  });

  // O comportamento que justifica ordenar ANTES de aplicar a trava. Tres
  // paredes caem no mesmo quadro e so uma vaga existe; a que o jogador precisa
  // ouvir e a que caiu ao lado dele, nao a primeira da ordem de varredura de
  // celula — que nao significa nada para quem esta jogando.
  it('entre iguais no mesmo quadro, guarda a mais PERTO', () => {
    const mixer = new CueMixer();
    const planned = mixer.plan(
      [at('breakRock', 18), at('breakRock', 2), at('breakRock', 11)],
      origin,
      0,
    );
    expect(planned).toHaveLength(1);
    expect(planned[0].gain).toBeCloseTo(distanceGain(2) * 0.3, 5);
  });

  it('quando o mundo desaba, o telegrafo sobrevive ao entulho', () => {
    const mixer = new CueMixer();
    const entulho: Cue[] = [];
    for (let i = 0; i < MAX_VOICES * 3; i++) entulho.push(at('breakRock', 1 + i * 0.01));
    // O telegrafo entra por ultimo na lista de proposito: se a ordem de chegada
    // decidisse, ele seria o primeiro descartado.
    const planned = mixer.plan([...entulho, at('telegraphHurl', 6)], origin, 0);
    expect(planned.length).toBeLessThanOrEqual(MAX_VOICES);
    expect(planned.map((v) => v.voice)).toContain('telegraphHurl');
  });

  it('nunca ultrapassa o teto de vozes', () => {
    const mixer = new CueMixer();
    const cues: Cue[] = [];
    for (let i = 0; i < 40; i++) cues.push(at(i % 2 === 0 ? 'explosion' : 'discharge', 1));
    expect(mixer.plan(cues, origin, 0).length).toBeLessThanOrEqual(MAX_VOICES);
  });

  it('esquece as travas ao reiniciar', () => {
    const mixer = new CueMixer();
    mixer.plan([at('ignite', 0)], origin, 0);
    mixer.reset();
    expect(mixer.plan([at('ignite', 0)], origin, 1)).toHaveLength(1);
  });

  it('descarta som audivel apenas na teoria', () => {
    const mixer = new CueMixer();
    // corrode tem ganho base 0,22; a um passo do limite a atenuacao o joga
    // abaixo do piso e ele nao deve custar um no de audio.
    expect(mixer.plan([at('corrode', MAX_AUDIBLE_DISTANCE - 0.2)], origin, 0)).toEqual([]);
  });
});
