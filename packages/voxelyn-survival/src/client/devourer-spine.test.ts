// O corpo do Devorador e desenho, mas ele carrega tres promessas que o jogo
// depende: que os dois clientes de uma sala desenham o MESMO bicho, que o corpo
// tem sempre o mesmo comprimento, e que a cauda esta onde a cabeca esteve. As
// tres se quebram em silencio — um verme errado continua sendo um verme.
import { describe, expect, it } from 'vitest';
import {
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_BURROW_SPEED,
  DEVOURER_MAW,
  DEVOURER_MAW_BURY_TICKS,
  TICK_HZ,
} from '@voxelyn/survival-sim';
import broodManifest from '@voxelyn/survival-content/assets/atlases/part-devourer-brood.json';
import { LEAP_PEAK_PX } from './leap-arc';
import { BROOD_PHASES, BROOD_VARIANTS } from './render';
import {
  DEVOURER_HEAD_OFFSET,
  DEVOURER_SEGMENTS,
  DEVOURER_SEGMENT_GAP,
  DEVOURER_SUBMERGED_PX,
  DEVOURER_SWAY,
  DEVOURER_TAIL_TILES,
  DevourerSpines,
  devourerHeadLiftPx,
} from './devourer-spine';

const head = (x: number, y: number, liftPx = 0, dirX = 1, dirY = 0) => ({ x, y, liftPx, dirX, dirY });

/** Anda a cabeca em linha reta, um passo de cada vez, e devolve o corpo final. */
/**
 * O relogio fica PARADO de proposito. A ondulacao lateral e conduzida por ele
 * (e um balanco, nao uma forma), entao dois percursos com cadencias diferentes
 * chegam ao mesmo ponto com fases de onda diferentes — o que e o comportamento
 * certo e nao o que estes testes medem. Congelando o relogio, o que sobra e a
 * FORMA, que e a coisa que nao pode depender da taxa de quadros.
 */
const walk = (
  spines: DevourerSpines,
  steps: number,
  step = 0.1,
  lift: (travelled: number) => number = () => 0
) => {
  let last;
  for (let i = 0; i <= steps; i++) {
    last = spines.follow(1, head(i * step, 0, lift(i * step)), 1000);
  }
  return last!;
};

describe('coluna do Devorador — o comprimento', () => {
  it('nasce inteira: no primeiro quadro ja ha dez aneis atras da cabeca', () => {
    // Sem isto o encontro comeca com uma cabeca solta, e o primeiro segundo e
    // exatamente quando o jogador esta decidindo o que aquela coisa e.
    const body = new DevourerSpines().follow(1, head(20, 20), 0);
    expect(body).toHaveLength(DEVOURER_SEGMENTS);
    for (const node of body) expect(Number.isFinite(node.x + node.y)).toBe(true);
  });

  it('cada anel esta a distancia declarada da cabeca, e nao mais perto', () => {
    const spines = new DevourerSpines();
    const body = walk(spines, 90);
    for (const node of body) {
      const want = DEVOURER_HEAD_OFFSET + node.rank * DEVOURER_SEGMENT_GAP;
      // A ondulacao desloca o anel PARA O LADO do caminho, entao a distancia em
      // linha reta ate a cabeca e um pouco menor que o arco. A folga cobre isso
      // e nada mais: o que este teste guarda e que o corpo nao ENCOLHE.
      expect(Math.hypot(node.x - 8.9, node.y), `posto ${node.rank}`).toBeGreaterThan(want - 0.2);
      expect(Math.hypot(node.x - 8.9, node.y), `posto ${node.rank}`).toBeLessThan(want + 0.2);
    }
  });

  it('NAO estica nem encolhe com a taxa de quadros', () => {
    // A razao de ser de follow-the-leader em vez de Verlet ou IK. Dois clientes
    // da mesma sala rodam a quadros diferentes por definicao; se o corpo
    // dependesse da cadencia, os dois desenhariam vermes de tamanhos
    // diferentes na mesma sala.
    const rapido = walk(new DevourerSpines(), 180, 0.05);
    const lento = walk(new DevourerSpines(), 30, 0.3);
    for (let k = 0; k < DEVOURER_SEGMENTS; k++) {
      expect(rapido[k].x, `posto ${k}`).toBeCloseTo(lento[k].x, 1);
      expect(rapido[k].y, `posto ${k}`).toBeCloseTo(lento[k].y, 1);
    }
  });

  it('e determinista: duas colunas com a mesma trajetoria dao o mesmo corpo', () => {
    const a = walk(new DevourerSpines(), 60);
    const b = walk(new DevourerSpines(), 60);
    expect(a).toEqual(b);
  });
});

describe('coluna do Devorador — o mergulho', () => {
  it('a cauda ainda esta no ar quando a cabeca ja tocou a areia', () => {
    // O paraboloide, e a unica coisa que o corpo segmentado entrega e que
    // nenhum sprite rigido entregava. Nao ha codigo dedicado a isto: e a
    // consequencia de a elevacao ser amostrada pelo MESMO arco que a posicao.
    const spines = new DevourerSpines();
    const LEN = 9;
    const body = walk(spines, 90, LEN / 90, (travelled) => {
      const p = travelled / LEN;
      return devourerHeadLiftPx(DEVOURER_AIRBORNE, 4 * p * (1 - p));
    });
    // A cabeca acabou de pousar (p = 1, altura 0); os aneis leem o arco que ela
    // percorreu ha meio segundo.
    expect(body[0].liftPx, 'o primeiro anel desceu junto com a cabeca').toBeLessThan(
      body[DEVOURER_SEGMENTS - 1].liftPx
    );
    expect(body[DEVOURER_SEGMENTS - 1].liftPx, 'a cauda nao ficou no ar').toBeGreaterThan(10);
  });

  it('enterrado, o corpo inteiro esta abaixo da linha da areia', () => {
    const body = walk(new DevourerSpines(), 60, 0.1, () =>
      devourerHeadLiftPx(DEVOURER_BURROWED, 0)
    );
    for (const node of body) expect(node.liftPx).toBe(-DEVOURER_SUBMERGED_PX);
  });
});

describe('coluna do Devorador — a altura da cabeca', () => {
  it('nao ESTALA nas pontas do arco: sai e volta ao chao enterrado', () => {
    // O defeito que a interpolacao a partir do chao enterrado evita. Com o arco
    // partindo de zero, a altura pulava 11 px no tick em que a acao de salto
    // comecava e os 11 de volta no tick em que ela acabava — dois estalos por
    // salto, nas duas pontas, que e justamente onde a cratera acontece e onde o
    // olho esta olhando.
    const chao = devourerHeadLiftPx(DEVOURER_BURROWED, 0);
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 0)).toBe(chao);
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 0.0001)).toBeCloseTo(chao, 1);
  });

  it('no apice ele esta na altura do salto, e nao acima dela', () => {
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 1)).toBe(LEAP_PEAK_PX);
  });

  it('enterrado e de boca aberta ele esta ABAIXO do chao', () => {
    expect(devourerHeadLiftPx(DEVOURER_BURROWED, 0)).toBeLessThan(0);
    expect(devourerHeadLiftPx(DEVOURER_MAW, 0)).toBeLessThan(0);
  });

  it('sem humor nenhum ele fica na superficie, que era onde ele ficava antes', () => {
    expect(devourerHeadLiftPx(undefined, 0)).toBe(0);
  });

  it('afunda menos do que a cabeca mede: enterrado ele continua sendo ALVO', () => {
    // Nao e gosto — e mecanica. Enterrado ele tem 12% de armadura e continua
    // levando tiro; um alvo invisivel nao e um alvo com armadura, e uma janela
    // de dano apagada.
    expect(DEVOURER_SUBMERGED_PX).toBeLessThan(25.5);
    expect(DEVOURER_SUBMERGED_PX).toBeGreaterThan(0);
  });
});

describe('coluna do Devorador — a memoria', () => {
  it('um teleporte joga o rastro fora em vez de arrastar o corpo pelo mapa', () => {
    const spines = new DevourerSpines();
    walk(spines, 60);
    const body = spines.follow(1, head(80, 80), 3000);
    for (const node of body) {
      expect(Math.hypot(node.x - 80, node.y - 80), `posto ${node.rank}`).toBeLessThan(
        DEVOURER_HEAD_OFFSET + DEVOURER_SEGMENTS * DEVOURER_SEGMENT_GAP + 1
      );
    }
  });

  it('esquece os chefes que sairam de cena', () => {
    const spines = new DevourerSpines();
    walk(spines, 40);
    spines.keepOnly(new Set());
    // O rastro foi embora: o corpo renasce RETO atras da cabeca (que aponta
    // para +y), e nao com a forma velha. O desvio que sobra em x e a ondulacao,
    // que empurra o anel para o lado do caminho e esta limitada por construcao.
    const body = spines.follow(1, head(0, 0, 0, 0, 1), 9000);
    for (const node of body) {
      expect(Math.abs(node.x), `posto ${node.rank}`).toBeLessThanOrEqual(DEVOURER_SWAY);
      expect(node.y, `posto ${node.rank}`).toBeLessThan(0);
    }
  });
});

describe('coluna do Devorador — o contrato com a simulacao', () => {
  it('o corpo mede o que a simulacao supoe que ele mede', () => {
    // A UNICA amarra entre os dois lados, e ela existe porque a simulacao NAO
    // TEM corpo: ela move e testa um ponto so. Mesmo assim ela precisa saber
    // quanto tempo o corpo leva para seguir a cabeca para dentro do buraco —
    // e o vao entre o terceiro pouso e a boca abrir (`DEVOURER_MAW_BURY_TICKS`)
    // e exatamente esse tempo.
    //
    // Sem este teste, reautorar a coluna aqui mudaria o comprimento sem tocar
    // na constante de la, e o ritmo do encontro sairia de sincronia com o
    // desenho EM SILENCIO: a boca abriria com meio corpo ainda de fora, ou o
    // chao ficaria vazio um segundo alem do necessario. Nenhum dos dois quebra
    // nada — so fica errado.
    const corpo =
      DEVOURER_HEAD_OFFSET + (DEVOURER_SEGMENTS - 1) * DEVOURER_SEGMENT_GAP + DEVOURER_TAIL_TILES;
    const ticks = Math.round((corpo / DEVOURER_BURROW_SPEED) * TICK_HZ);
    expect(ticks, `o corpo mede ${corpo.toFixed(2)} tiles`).toBe(DEVOURER_MAW_BURY_TICKS);
  });
});

describe('a ninhada — o contrato com o atlas', () => {
  it('as duas fatias dos quadros batem com o que o gerador autorou', () => {
    // O manifest publica a CONTAGEM de quadros e nao como ela se fatora: 18
    // quadros nao dizem sozinhos se sao tres variantes de seis fases ou seis de
    // tres. O cliente precisa dos dois numeros para escolher o quadro
    // (`variante * FASES + fase`), entao ele os repete — e uma troca no gerador
    // sem uma troca aqui nao quebraria nada: as minhoquinhas simplesmente
    // passariam a desenhar o corpo errado na fase errada, calada.
    const m = broodManifest as unknown as { animations: Record<string, { frames: number }> };
    expect(m.animations.idle.frames).toBe(BROOD_VARIANTS * BROOD_PHASES);
  });

  it('cada variante tem o ciclo inteiro dentro do atlas', () => {
    const m = broodManifest as unknown as { animations: Record<string, { frames: number }> };
    for (let v = 0; v < BROOD_VARIANTS; v++) {
      for (let f = 0; f < BROOD_PHASES; f++) {
        expect(v * BROOD_PHASES + f).toBeLessThan(m.animations.idle.frames);
      }
    }
  });
});
