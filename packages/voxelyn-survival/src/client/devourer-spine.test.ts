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
import devourerManifest from '@voxelyn/survival-content/assets/atlases/enemy-white-devourer.json';
import coilManifest from '@voxelyn/survival-content/assets/atlases/part-white-devourer-coil.json';
import { LEAP_PEAK_PX } from './leap-arc';
import { BROOD_PHASES, BROOD_VARIANTS } from './render';
import { ATLAS_SCALE } from './sprites';
import {
  DEVOURER_HEAD_OFFSET,
  DEVOURER_SEGMENTS,
  DEVOURER_SEGMENT_GAP,
  DEVOURER_SUBMERGED_PX,
  DEVOURER_SWAY,
  DEVOURER_TAIL_TILES,
  DevourerSpines,
  devourerHeadLiftPx,
  devourerSubmergence,
  DEVOURER_BELOW_ANCHOR_PX,
  DEVOURER_DIVE_TICKS,
  DEVOURER_HEAD_GONE_AT,
  DEVOURER_HIDDEN_PX,
  devourerHeadShows,
  type SpineNode,
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
      return devourerHeadLiftPx(DEVOURER_AIRBORNE, 4 * p * (1 - p), 0);
    });
    // A cabeca acabou de pousar (p = 1, altura 0); os aneis leem o arco que ela
    // percorreu ha meio segundo.
    expect(body[0].liftPx, 'o primeiro anel desceu junto com a cabeca').toBeLessThan(
      body[DEVOURER_SEGMENTS - 1].liftPx
    );
    expect(body[DEVOURER_SEGMENTS - 1].liftPx, 'a cauda nao ficou no ar').toBeGreaterThan(10);
  });

  it('enterrado e sumido, o corpo inteiro esta abaixo da linha da areia', () => {
    const body = walk(new DevourerSpines(), 60, 0.1, () =>
      devourerHeadLiftPx(DEVOURER_BURROWED, 0, 1)
    );
    for (const node of body) expect(node.liftPx).toBe(-DEVOURER_HIDDEN_PX);
  });
});

describe('coluna do Devorador — a altura da cabeca', () => {
  it('o arco sai e volta a SUPERFICIE, que e onde as duas pontas o encontram', () => {
    // O arco tem de fechar nos dois lados: ele decola de onde a subida da
    // erupcao terminou (superficie) e pousa onde a descida do mergulho comeca
    // (superficie). Partir de outra altura seria um estalo de 95 px no tick da
    // cratera — que e justamente onde o olho esta.
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 0, 0)).toBe(0);
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 0.0001, 0)).toBeCloseTo(0, 1);
  });

  it('no apice ele esta na altura do salto, e nao acima dela', () => {
    expect(devourerHeadLiftPx(DEVOURER_AIRBORNE, 1, 0)).toBe(LEAP_PEAK_PX);
  });

  it('enterrado e de boca aberta ele esta ABAIXO do chao', () => {
    expect(devourerHeadLiftPx(DEVOURER_BURROWED, 0, 1)).toBeLessThan(0);
    expect(
      devourerHeadLiftPx(DEVOURER_MAW, 0, devourerSubmergence(DEVOURER_MAW, null, null))
    ).toBeLessThan(0);
  });

  it('sem humor nenhum ele fica na superficie, que era onde ele ficava antes', () => {
    expect(devourerHeadLiftPx(undefined, 0, devourerSubmergence(undefined, null, null))).toBe(0);
  });
});

describe('coluna do Devorador — o mergulho e a emergencia', () => {
  it('DE BOCA ABERTA ele volta a crista, e nao ao sumico', () => {
    // A cratera dentada E a janela de dano do encontro, e uma janela que
    // ninguem ve nao e uma janela. Este e o unico humor enterrado que continua
    // na superficie, e o numero e o de antes deste mergulho existir.
    const crista = devourerSubmergence(DEVOURER_MAW, null, null);
    expect(devourerHeadLiftPx(DEVOURER_MAW, 0, crista)).toBeCloseTo(-DEVOURER_SUBMERGED_PX, 9);
  });

  it('a descida comeca na superficie e acaba sumida', () => {
    expect(devourerSubmergence(DEVOURER_BURROWED, 0, null)).toBe(0);
    expect(devourerSubmergence(DEVOURER_BURROWED, DEVOURER_DIVE_TICKS, null)).toBe(1);
    // E ela e MONOTONA: um verme que oscila entrando na areia le como bug, nao
    // como bicho.
    let anterior = -1;
    for (let t = 0; t <= DEVOURER_DIVE_TICKS; t++) {
      const agora = devourerSubmergence(DEVOURER_BURROWED, t, null);
      expect(agora).toBeGreaterThanOrEqual(anterior);
      anterior = agora;
    }
  });

  it('a subida da erupcao DESFAZ a descida, e nao continua afundando', () => {
    // O windup e o unico telegrafo desta emergencia. Enquanto ele corre o bicho
    // sobe, mesmo que o pouso tenha sido ha muito tempo — sem esta prioridade a
    // contagem desde o pouso mandaria, e o aviso prometeria uma saida enquanto
    // o desenho mostrava um corpo afundando.
    const velho = DEVOURER_DIVE_TICKS * 10;
    expect(devourerSubmergence(DEVOURER_BURROWED, velho, 0)).toBe(1);
    expect(devourerSubmergence(DEVOURER_BURROWED, velho, 0.5)).toBeCloseTo(0.5, 9);
    expect(devourerSubmergence(DEVOURER_BURROWED, velho, 1)).toBe(0);
  });

  it('quem entra na sala com o chefe enterrado nao ve meio verme boiando', () => {
    // Sem o pouso na memoria a resposta e SUMIDO. Errar para o lado de escondido
    // e o certo: o erro contrario desenha metade de um chefe de seis tiles
    // parado na areia ate o proximo arco.
    expect(devourerSubmergence(DEVOURER_BURROWED, null, null)).toBe(1);
  });

  it('NO AR ele nao esta enterrado, qualquer que seja a memoria do pouso', () => {
    expect(devourerSubmergence(DEVOURER_AIRBORNE, null, null)).toBe(0);
    expect(devourerSubmergence(DEVOURER_AIRBORNE, 0, null)).toBe(0);
  });

  it('o ciclo inteiro nao ESTALA em nenhuma costura', () => {
    // As tres transicoes, medidas nos dois ticks que se encostam. O ciclo e
    // windup -> arco -> pouso -> descida, e cada ponta tem de encontrar a
    // anterior no mesmo pixel.
    const fimDoWindup = devourerHeadLiftPx(
      DEVOURER_BURROWED,
      0,
      devourerSubmergence(DEVOURER_BURROWED, 99, 1)
    );
    const inicioDoArco = devourerHeadLiftPx(
      DEVOURER_AIRBORNE,
      0,
      devourerSubmergence(DEVOURER_AIRBORNE, 99, null)
    );
    expect(inicioDoArco).toBeCloseTo(fimDoWindup, 9);

    const fimDoArco = devourerHeadLiftPx(
      DEVOURER_AIRBORNE,
      0,
      devourerSubmergence(DEVOURER_AIRBORNE, 99, null)
    );
    const inicioDaDescida = devourerHeadLiftPx(
      DEVOURER_BURROWED,
      0,
      devourerSubmergence(DEVOURER_BURROWED, 0, null)
    );
    expect(inicioDaDescida).toBeCloseTo(fimDoArco, 9);
  });

  it('a linha da areia bate com o que o atlas do anel declara', () => {
    // `DEVOURER_BELOW_ANCHOR_PX` e onde o recorte passa, e ele vale para os
    // dois sprites: o anel chega la pelo manifesto (`altura - ancora`) e a
    // cabeca por medida dos quadros vivos, porque o quadro dela tem 48 px
    // abaixo da ancora e 37 deles sao folga da pose de boca aberta.
    //
    // Esta prova prende a metade que da para prender. A outra, a da cabeca, esta
    // escrita na constante junto com a medida — e foi o defeito que ela evita
    // que apareceu na captura: cortando pelo tamanho do quadro, o verme subia
    // inteiro e de pe, desenhado por cima do chao a frente dele.
    const anel = coilManifest as unknown as { frameHeight: number; anchorY: number };
    expect(anel.frameHeight - anel.anchorY).toBe(DEVOURER_BELOW_ANCHOR_PX);
  });

  it('a cabeca some do recorte MUITO antes de o afundamento chegar a 1', () => {
    // O defeito que a revisao apontou: comparar com 1 para decidir o que
    // desenhar em volta dele. A cabeca mede 104 px acima da ancora e 11 abaixo,
    // e o desenho multiplica a altura por `z` enquanto o sprite escala por
    // `spriteZoom` — no zoom largo (z = 2, spriteZoom = 1) ela desaparece com
    // 115/190 de afundamento. Nove dos vinte e quatro ticks da rampa ficavam com
    // a sombra e a barra desenhadas sozinhas, no ponto de emergencia.
    const z = 2;
    const spriteZoom = 1;
    const some = (sub: number) =>
      !devourerHeadShows(devourerHeadLiftPx(DEVOURER_BURROWED, 0, sub), z, spriteZoom);
    expect(some(1)).toBe(true);
    expect(some(DEVOURER_HEAD_GONE_AT + 0.001)).toBe(true);
    expect(some(DEVOURER_HEAD_GONE_AT - 0.001)).toBe(false);
    expect(DEVOURER_HEAD_GONE_AT).toBeLessThan(0.7);
  });

  it('o limiar da mira e o CONSERVADOR dos dois zooms', () => {
    // A mira nao tem zoom, entao ela usa o limiar do zoom em que a cabeca some
    // primeiro. A prova cobra a direcao do erro: no limiar, o zoom largo ja
    // escondeu e o estreito ainda mostra — nunca o contrario, que seria a mira
    // grudando em areia lisa.
    const lift = devourerHeadLiftPx(DEVOURER_BURROWED, 0, DEVOURER_HEAD_GONE_AT);
    expect(devourerHeadShows(lift, 2, 1), 'zoom largo ja escondeu').toBe(false);
    expect(devourerHeadShows(lift, 1.6, 1), 'zoom estreito ainda mostra').toBe(true);
  });

  it('de boca aberta a cabeca continua a mostra', () => {
    // A cratera E a janela de dano: ela nao pode cair no mesmo corte.
    const crista = devourerSubmergence(DEVOURER_MAW, null, null);
    const lift = devourerHeadLiftPx(DEVOURER_MAW, 0, crista);
    expect(devourerHeadShows(lift, 2, 1)).toBe(true);
    expect(crista).toBeLessThan(DEVOURER_HEAD_GONE_AT);
  });

  it('a profundidade de sumico esconde os DOIS atlas, nos dois zooms', () => {
    // A conta que `DEVOURER_HIDDEN_PX` promete, contra os manifestos de verdade.
    //
    // O desenho poe a ancora em `sy - liftPx * z` e escala o sprite por
    // `spriteZoom`, e o recorte corta em `sy + (altura - ancora) * spriteZoom`.
    // Para nao sobrar um pixel, o topo do sprite tem de ficar abaixo do corte:
    //   liftPx * z >= altura * spriteZoom
    // O pior caso e o zoom estreito, onde `spriteZoom` nao acompanha `z`.
    const zooms = [2, 1.6];
    const manifestos = [devourerManifest, coilManifest] as unknown as Array<{
      frameHeight: number;
    }>;
    for (const z of zooms) {
      const spriteZoom = Math.max(1, Math.round(z / ATLAS_SCALE));
      for (const m of manifestos) {
        expect(
          DEVOURER_HIDDEN_PX * z,
          `zoom ${z}, quadro de ${m.frameHeight}`
        ).toBeGreaterThanOrEqual(m.frameHeight * spriteZoom);
      }
    }
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

describe('o rastro NAO pode depender de a cabeca estar visivel', () => {
  /** Um passeio curto em curva, o suficiente para o corpo deixar de ser reto. */
  const passeio = (spines: DevourerSpines, id: number): SpineNode[] => {
    let out: SpineNode[] = [];
    for (let i = 0; i < 60; i++) {
      const t = i * 0.05;
      out = spines.follow(
        id,
        { x: 40 + Math.cos(t) * 4, y: 40 + Math.sin(t) * 4, liftPx: 0, dirX: 1, dirY: 0 },
        i * 50,
      );
    }
    return out;
  };

  /** O quanto o corpo se afasta da reta que vai da cabeca a cauda. */
  /** A cabeca no ponto exato onde o passeio parou. */
  const cabeca = {
    x: 40 + Math.cos(59 * 0.05) * 4,
    y: 40 + Math.sin(59 * 0.05) * 4,
    liftPx: 0,
    dirX: 1,
    dirY: 0,
  };

  const curvatura = (nodes: SpineNode[]): number => {
    const a = nodes[0];
    const b = nodes[nodes.length - 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let max = 0;
    for (const n of nodes) {
      const d = Math.abs((b.x - a.x) * (a.y - n.y) - (a.x - n.x) * (b.y - a.y)) / len;
      max = Math.max(max, d);
    }
    return max;
  };

  it('um quadro sem registrar o id joga o rastro fora e o corpo volta RETO', () => {
    // Este e o mecanismo por tras do defeito que a revisao apontou no render: o
    // corte de luz saia da iteracao pela luz da CABECA, entao um chefe com a
    // cabeca na sombra nao entrava no conjunto do quadro — e `keepOnly`, que so
    // existe para esquecer chefe morto, esquecia um chefe vivo.
    //
    // A prova mede a consequencia e nao a intencao: o corpo que estava em curva
    // volta a ser uma reta. Um corpo de seis tiles endireitando de um quadro
    // para o outro e a coisa mais visivel que este sistema pode fazer de errado.
    const spines = new DevourerSpines();
    const curvo = passeio(spines, 7);
    expect(curvatura(curvo)).toBeGreaterThan(0.2);

    // O quadro em que o id nao foi registrado.
    spines.keepOnly(new Set<number>());
    const depois = spines.follow(7, cabeca, 3000);

    // A prova nao e "ficou menos curvo": e que o corpo voltou a ser EXATAMENTE o
    // corpo que nasce do nada. Comparado anel a anel com uma coluna virgem que
    // so viu esta cabeca, no mesmo instante de relogio — se bate ponto a ponto,
    // os dois segundos de rastro foram jogados fora.
    const virgem = new DevourerSpines().follow(7, cabeca, 3000);
    expect(depois.length).toBe(virgem.length);
    for (let i = 0; i < depois.length; i++) {
      expect(depois[i].x, `anel ${i}`).toBeCloseTo(virgem[i].x, 9);
      expect(depois[i].y, `anel ${i}`).toBeCloseTo(virgem[i].y, 9);
    }
    expect(curvatura(depois)).toBeLessThan(curvatura(curvo) / 3);
  });

  it('registrando o id em todo quadro, a curva sobrevive', () => {
    const spines = new DevourerSpines();
    const curvo = passeio(spines, 7);
    spines.keepOnly(new Set([7]));
    const depois = spines.follow(7, cabeca, 3000);

    const virgem = new DevourerSpines().follow(7, cabeca, 3000);
    const renasceu = depois.every(
      (n, i) => Math.abs(n.x - virgem[i].x) < 1e-9 && Math.abs(n.y - virgem[i].y) < 1e-9,
    );
    expect(renasceu, 'o corpo nao pode ter renascido').toBe(false);
    expect(curvatura(depois)).toBeGreaterThan(curvatura(curvo) * 0.9);
  });
});
