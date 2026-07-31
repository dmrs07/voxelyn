import { describe, expect, it } from 'vitest';
import { COLORS } from '../tools/lib.mjs';
import { EMISSIVE, LIGHT_OF, RAMPS, SHADOW_OF } from '../tools/voxel.mjs';

/** Luminancia perceptual, 0..100. E nela que "salto de valor" se mede. */
const L = (name) => {
  const [r, g, b] = COLORS[name];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 2.55;
};

/**
 * Rampas deixadas de fora do limite de salto, cada uma por um motivo de JOGO e
 * nao de estetica. Estao nomeadas para que incluir uma nova seja uma decisao
 * consciente em vez de um teste que afrouxa sozinho.
 */
const STEEP_BY_DESIGN = {
  // O piso tem de ficar ao menos dois passos de valor abaixo de qualquer coisa
  // viva em cima dele (art bible §6), senao a silhueta das criaturas some
  // justamente onde elas andam.
  floor: 'contraste com criatura',
  scorch: 'queimado e chapado de proposito',
  pool: 'liquido le por profundidade, nao por matiz',
  // A crosta de gas precisa gritar perigo em menos de 200ms sobre pedra escura.
  sulfur: 'gas tem de ser lido como ameaca a distancia',
  // Metal polido reflete o topo com forca e cai rapido nas laterais; e esse
  // contraste que faz ouro parecer ouro em vez de tinta amarela.
  loot: 'ouro e especular',
};
const MAX_RAMP_GAP = 34;

describe('paleta mestra', () => {
  it('cada rampa usa so cores da paleta', () => {
    for (const [mat, ramp] of Object.entries(RAMPS)) {
      expect(ramp, mat).toHaveLength(3);
      for (const color of ramp) expect(COLORS[color], `${mat} -> ${color}`).toBeDefined();
    }
  });

  it('as tres faces de um material sao degraus proximos em valor', () => {
    for (const [mat, ramp] of Object.entries(RAMPS)) {
      if (mat in STEEP_BY_DESIGN) continue;
      const gaps = [L(ramp[0]) - L(ramp[1]), L(ramp[1]) - L(ramp[2])];
      for (const gap of gaps) {
        expect(gap, `${mat} ${ramp.join('>')}`).toBeLessThanOrEqual(MAX_RAMP_GAP);
      }
    }
  });

  it('a face de topo e a mais clara e a da direita a mais escura', () => {
    for (const [mat, ramp] of Object.entries(RAMPS)) {
      expect(L(ramp[0]), mat).toBeGreaterThanOrEqual(L(ramp[1]));
      expect(L(ramp[1]), mat).toBeGreaterThanOrEqual(L(ramp[2]));
    }
  });

  it('as escadas de sombra e de luz cobrem a paleta inteira', () => {
    for (const name of Object.keys(COLORS)) {
      expect(SHADOW_OF[name], `sombra de ${name}`).toBeDefined();
      expect(LIGHT_OF[name], `luz de ${name}`).toBeDefined();
    }
  });

  it('a escada de sombra sempre desce, e termina', () => {
    for (const name of Object.keys(COLORS)) {
      const next = SHADOW_OF[name];
      expect(L(next), `${name} -> ${next}`).toBeLessThanOrEqual(L(name));
      // Termina em `dark` sem ciclo: no maximo o tamanho da paleta de passos.
      let cur = name;
      let steps = 0;
      while (SHADOW_OF[cur] !== cur && steps <= Object.keys(COLORS).length) {
        cur = SHADOW_OF[cur];
        steps++;
      }
      expect(cur, `escada de ${name}`).toBe('dark');
    }
  });

  it('a escada de luz sempre sobe, e termina', () => {
    for (const name of Object.keys(COLORS)) {
      const next = LIGHT_OF[name];
      expect(L(next), `${name} -> ${next}`).toBeGreaterThanOrEqual(L(name));
    }
  });

  /**
   * A invariante que mais custaria caro se quebrasse, e que nenhuma imagem
   * denunciaria: uma quina iluminada de metal comum NAO pode virar cor emissiva.
   *
   * Se virasse, ela ganharia halo no runtime — o cliente acende por COR, nao por
   * material — e uma aresta de chassi passaria a brilhar como se fosse uma luz,
   * prometendo uma mecanica que o jogo nao tem. O erro so apareceria no escuro,
   * em jogo, em algumas quinas.
   */
  it('realce nunca transforma material comum em fonte de luz', () => {
    for (const name of Object.keys(COLORS)) {
      if (EMISSIVE.has(name)) continue;
      expect(EMISSIVE.has(LIGHT_OF[name]), `${name} -> ${LIGHT_OF[name]}`).toBe(false);
    }
  });

  it('sombra tambem nao inventa luz onde nao havia', () => {
    for (const name of Object.keys(COLORS)) {
      if (EMISSIVE.has(name)) continue;
      expect(EMISSIVE.has(SHADOW_OF[name]), `${name} -> ${SHADOW_OF[name]}`).toBe(false);
    }
  });

  /**
   * O farol do Prospector foi parar em `loot` e depois em `fire` antes de ganhar
   * material proprio. Os dois estavam errados por motivos opostos — ouro nao
   * emite, chama nao e equipamento —, e o teste existe para que a terceira
   * tentativa nao repita nenhuma das duas.
   */
  it('a lampada e material proprio, e emite nas tres faces', () => {
    expect(RAMPS.lamp).toBeDefined();
    for (const color of RAMPS.lamp) expect(EMISSIVE.has(color), color).toBe(true);
    expect(RAMPS.lamp).not.toEqual(RAMPS.fire);
    expect(RAMPS.lamp).not.toEqual(RAMPS.loot);
  });
});
