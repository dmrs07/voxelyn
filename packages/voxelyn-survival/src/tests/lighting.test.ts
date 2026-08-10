import { describe, expect, it } from 'vitest';
import {
  FACE_LEFT,
  FACE_RIGHT,
  FACE_TOP,
  LIGHT_NEUTRAL,
  LightField,
  attenuation,
  bounceOf,
  chromaOf,
  type WorldLight,
} from '../client/lighting';
import { CHASSIS_RESPONSE, solidResponse, surfaceResponse } from '../client/material-response';
import { SOLID_CRYSTAL, SOLID_ROCK, SURF_ICE, SURF_SCORCHED } from '@voxelyn/survival-sim';

const light = (over: Partial<WorldLight> = {}): WorldLight => ({
  x: 10.5,
  y: 10.5,
  r: 4,
  power: 1,
  hex: '#ff7a2f',
  height: 0.7,
  ...over,
});

const fieldWith = (...lights: WorldLight[]): LightField => {
  const field = new LightField();
  field.begin(0, 0, 20, 20);
  for (const l of lights) field.add(l);
  return field;
};

describe('atenuacao fisica', () => {
  it('vale 1 no centro e exatamente 0 no raio', () => {
    expect(attenuation(0, 4)).toBe(1);
    expect(attenuation(4, 4)).toBe(0);
    expect(attenuation(9, 4)).toBe(0);
  });

  /**
   * Chegar a zero SUAVEMENTE e o motivo da janela. Um corte seco no raio
   * desenharia um circulo no chao — a borda da luz apareceria como uma linha.
   */
  it('some suave em vez de cortar na borda', () => {
    const nearEdge = attenuation(3.9, 4);
    expect(nearEdge).toBeGreaterThan(0);
    expect(nearEdge).toBeLessThan(0.01);
  });

  it('nunca aumenta com a distancia', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let d = 0; d <= 4; d += 0.1) {
      const a = attenuation(d, 4);
      expect(a).toBeLessThanOrEqual(previous + 1e-12);
      previous = a;
    }
  });

  it('raio zero ou negativo nao ilumina nada', () => {
    expect(attenuation(0, 0)).toBe(0);
    expect(attenuation(1, -3)).toBe(0);
  });
});

describe('cromaticidade', () => {
  it('branco nao tem cor, e as fontes do jogo tem', () => {
    expect(chromaOf(LIGHT_NEUTRAL)).toBe(0);
    expect(chromaOf('#ff7a2f')).toBeGreaterThan(0.5);
    expect(chromaOf('#59f2c2')).toBeGreaterThan(0.5);
  });
});

describe('grade de luz', () => {
  /**
   * O CONTRATO que nao pode quebrar: a intensidade continua sendo o maximo com
   * queda LINEAR, porque e ela que escolhe um dos oito niveis ja assados no
   * atlas. Trocar a curva por baixo deles re-iluminaria toda caverna do jogo.
   */
  it('reproduz a intensidade antiga: maximo, queda linear', () => {
    const l = light({ x: 10.5, y: 10.5, r: 4, power: 1 });
    const field = fieldWith(l);
    for (const [x, y] of [
      [10, 10],
      [12, 10],
      [13, 10],
    ] as const) {
      const d = Math.hypot(x + 0.5 - l.x, y + 0.5 - l.y);
      expect(field.intensityAt(x, y)).toBeCloseTo(Math.min(1, l.power * (1 - d / l.r)), 5);
    }
  });

  it('fica em zero fora do alcance e fora da janela', () => {
    const field = fieldWith(light({ r: 2 }));
    expect(field.intensityAt(18, 18)).toBe(0);
    expect(field.intensityAt(-5, -5)).toBe(0);
  });

  /**
   * A lanterna do chassi e BRANCA e tem de continuar sem tingir nada. Se toda
   * luz pintasse, o mundo ganharia um veu permanente e a cor deixaria de
   * significar "ha uma fonte de fogo ali".
   */
  it('luz branca ilumina sem depositar cor', () => {
    const field = fieldWith(light({ hex: LIGHT_NEUTRAL }));
    expect(field.intensityAt(10, 10)).toBeGreaterThan(0);
    expect(field.hasChromaAt(10, 10)).toBe(false);
  });

  it('luz colorida deposita cor onde alcanca', () => {
    const field = fieldWith(light({ hex: '#ff7a2f' }));
    const lit = field.illuminationAt(10, 10);
    expect(field.hasChromaAt(10, 10)).toBe(true);
    // Laranja: muito vermelho, nenhum azul digno de nota.
    expect(lit.r).toBeGreaterThan(lit.b * 4);
  });

  /**
   * O vetor de incidencia aponta PARA a fonte. E ele que responde "de que lado
   * veio" quando cada face pergunta o proprio N.L.
   */
  it('o vetor de incidencia aponta para a fonte', () => {
    const field = fieldWith(light({ x: 14.5, y: 10.5, r: 6 }));
    const lit = field.illuminationAt(10, 10);
    expect(lit.dx).toBeGreaterThan(0); // a fonte esta a leste
    expect(Math.abs(lit.dy)).toBeLessThan(Math.abs(lit.dx));
    expect(lit.dz).toBeGreaterThan(0); // e acima do plano do chao
  });

  it('duas luzes somam cor mas a intensidade continua sendo o maximo', () => {
    const one = fieldWith(light({ power: 0.5 }));
    const two = fieldWith(light({ power: 0.5 }), light({ power: 0.5, x: 10.6 }));
    expect(two.intensityAt(10, 10)).toBeCloseTo(one.intensityAt(10, 10), 2);
    expect(two.illuminationAt(10, 10).r).toBeGreaterThan(one.illuminationAt(10, 10).r);
  });

  it('reaproveita o buffer entre quadros sem vazar o quadro anterior', () => {
    const field = new LightField();
    field.begin(0, 0, 20, 20);
    field.add(light());
    expect(field.hasChromaAt(10, 10)).toBe(true);
    field.begin(0, 0, 20, 20);
    expect(field.hasChromaAt(10, 10)).toBe(false);
    expect(field.intensityAt(10, 10)).toBe(0);
  });
});

describe('reflexao por face', () => {
  const litFrom = (x: number, y: number) =>
    fieldWith(light({ x, y, r: 8, hex: '#ff7a2f' })).illuminationAt(10, 10);

  /**
   * E ISTO que a parede nao sabia fazer. Uma explosao a leste acende a face
   * DIREITA (que olha para +x) e deixa a esquerda no escuro. Antes as duas
   * recebiam o mesmo valor e o bloco lia como adesivo chapado.
   */
  it('so a face virada para a luz recebe', () => {
    const fromEast = litFrom(15.5, 10.5);
    expect(bounceOf(fromEast, FACE_RIGHT, solidResponse(SOLID_ROCK))).not.toBeNull();
    expect(bounceOf(fromEast, FACE_LEFT, solidResponse(SOLID_ROCK))).toBeNull();

    const fromSouth = litFrom(10.5, 15.5);
    expect(bounceOf(fromSouth, FACE_LEFT, solidResponse(SOLID_ROCK))).not.toBeNull();
    expect(bounceOf(fromSouth, FACE_RIGHT, solidResponse(SOLID_ROCK))).toBeNull();
  });

  it('o topo recebe de qualquer lado, porque a fonte esta acima do chao', () => {
    for (const [x, y] of [
      [15.5, 10.5],
      [5.5, 10.5],
      [10.5, 15.5],
    ] as const) {
      expect(bounceOf(litFrom(x, y), FACE_TOP, solidResponse(SOLID_ROCK))).not.toBeNull();
    }
  });

  it('nao inventa reflexo onde nao chegou luz nenhuma', () => {
    const dark = fieldWith(light({ hex: LIGHT_NEUTRAL })).illuminationAt(10, 10);
    expect(bounceOf(dark, FACE_TOP, solidResponse(SOLID_ROCK))).toBeNull();
  });
});

describe('resposta do material', () => {
  /** Tocha laranja a tres tiles: longe o bastante para nada saturar no teto. */
  const orange = fieldWith(
    light({ x: 13.5, y: 10.5, r: 8, power: 0.6, hex: '#ff7a2f' }),
  ).illuminationAt(10, 10);
  /**
   * A tocha na DIRECAO ESPELHADA da camera — o unico lugar de onde um realce
   * especular chega ao observador.
   *
   * A projecao e uma dimetrica de 30 graus vista de -x,-y: a reflexao de um
   * piso manda para a camera exatamente a luz que vem de +x,+y a 30 graus de
   * elevacao. Com altura 0,7 isso cai a ~1,21 tile de distancia, nas duas
   * diagonais. E o mesmo motivo pelo qual uma poca na rua so devolve o poste
   * quando ele esta do lado certo dela.
   *
   * Com a geometria perfeita um material polido SATURA o teto do realce, e e
   * assim que se quer: a comparacao contra o fosco continua valendo (o fosco
   * fica duas ordens de grandeza abaixo), e saturar e o comportamento honesto de
   * um espelho apontado para a camera.
   */
  const mirror = fieldWith(
    light({ x: 10.5 + 0.856, y: 10.5 + 0.856, r: 8, power: 0.06, hex: '#ff7a2f' }),
  ).illuminationAt(10, 10);

  /**
   * A LEI que faz o trabalho sozinha: refletido = luz x albedo, canal a canal.
   *
   * O que se cobra aqui e o DESVIO DE MATIZ, e nao "quanto" — cristal azul-verde
   * e uma cor mais clara que rocha cinza, entao ele devolve mais energia total,
   * e esta certo que devolva. O que muda e a COR do que volta: sobre rocha o
   * reflexo continua alaranjado; sobre o cristal ele e puxado para o verde,
   * porque o material nao tem vermelho para devolver.
   */
  it('o albedo desvia a cor do reflexo para a do material', () => {
    const onRock = bounceOf(orange, FACE_TOP, solidResponse(SOLID_ROCK));
    const onCrystal = bounceOf(orange, FACE_TOP, solidResponse(SOLID_CRYSTAL));
    expect(onRock).not.toBeNull();
    expect(onCrystal).not.toBeNull();
    const ratio = (css: string): number => {
      const [r, g] = css.match(/\d+/g)!.map(Number);
      return r / Math.max(1, g);
    };
    // Rocha devolve mais vermelho que verde; o cristal inverte a proporcao.
    expect(ratio(onRock!.color)).toBeGreaterThan(1);
    expect(ratio(onCrystal!.color)).toBeLessThan(ratio(onRock!.color));
  });

  /**
   * Polido CONCENTRA. O gelo e a rocha recebendo o MESMO clarao tem de ler
   * diferente: realce forte e estreito contra veu largo.
   *
   * Com a luz na direcao espelhada, que e a unica em que o vetor-metade manda a
   * reflexao para a camera. Fora dela nem o gelo lampeja — e isso e o modelo
   * funcionando, nao falhando: e por isso que uma poca so acende quando a tocha
   * esta no lado certo dela.
   */
  it('o polido ganha realce e o fosco nao', () => {
    const ice = bounceOf(mirror, FACE_TOP, surfaceResponse(SURF_ICE))!;
    const rock = bounceOf(mirror, FACE_TOP, solidResponse(SOLID_ROCK))!;
    expect(ice.specular).toBeGreaterThan(rock.specular * 3);
  });

  /**
   * E a contraprova, que e o que separa "especular" de "difuso estreito": a
   * MESMA tocha, na mesma distancia, mas fora da direcao espelhada nao acende
   * realce nenhum no gelo.
   */
  it('fora da direcao espelhada o polido nao lampeja', () => {
    const offAxis = fieldWith(
      light({ x: 10.5 - 0.856, y: 10.5 - 0.856, r: 8, power: 0.06, hex: '#ff7a2f' }),
    ).illuminationAt(10, 10);
    const glinting = bounceOf(mirror, FACE_TOP, surfaceResponse(SURF_ICE))!;
    const dull = bounceOf(offAxis, FACE_TOP, surfaceResponse(SURF_ICE));
    expect(dull?.specular ?? 0).toBeLessThan(glinting.specular * 0.05);
  });

  /** E o inverso no veu: o fosco espalha por um hemisferio, e entrega mais. */
  it('o fosco entrega mais veu difuso que o polido', () => {
    const ice = bounceOf(orange, FACE_TOP, surfaceResponse(SURF_ICE))!;
    const rock = bounceOf(orange, FACE_TOP, solidResponse(SOLID_ROCK))!;
    // Corrigido pelo albedo (o gelo e MUITO mais claro), o que resta e a
    // diferenca de espalhamento: e ela que se cobra aqui.
    expect(rock.alpha / 0.46).toBeGreaterThan(ice.alpha / 0.85);
  });

  /**
   * O especular sai com a cor da FONTE, e nao a do material: dieletrico polido
   * tem brilho da cor da luz, e nao um brilho da propria cor mais claro.
   */
  it('o realce carrega a cor da luz, nao a do material', () => {
    const ice = bounceOf(mirror, FACE_TOP, surfaceResponse(SURF_ICE))!;
    // A fonte e laranja: o realce sai avermelhado, e nao azul-gelo.
    const [r, , b] = ice.specularColor.match(/\d+/g)!.map(Number);
    expect(r).toBeGreaterThan(b);
  });

  it('carvao queimado devolve quase nada, que e o que carvao faz', () => {
    const scorched = bounceOf(orange, FACE_TOP, surfaceResponse(SURF_SCORCHED));
    const rock = bounceOf(orange, FACE_TOP, solidResponse(SOLID_ROCK));
    expect(scorched?.alpha ?? 0).toBeLessThan(rock!.alpha);
  });

  /** O chassi e o unico corpo polido que anda pela tela. */
  it('o chassi do Prospector responde como metal, e nao como pedra', () => {
    const chassis = bounceOf(mirror, FACE_TOP, CHASSIS_RESPONSE)!;
    const rock = bounceOf(mirror, FACE_TOP, solidResponse(SOLID_ROCK))!;
    expect(chassis.specular).toBeGreaterThan(rock.specular);
  });
});
