// Modelos voxel dos PORTAIS entre setores — um por bioma.
//
// Por que existe: o transporte entre setores era UM poco generico (descent)
// em todos os estratos. Depois que parede, chao, decoracao e ate a crosta do
// trilho ganharam identidade por bioma, o unico objeto que o jogador PRECISA
// encontrar em todo setor era tambem o unico igual em toda parte — a Cripta
// Glacial e a Matriz Micelial compartilhavam a mesma boca de metal.
//
// Cada portal fala o dialeto do seu bioma, mas TODOS falam a mesma lingua:
// - a BOCA ESCURA: um furo opaco e uniforme no centro. Nada no jogo tem um
//   centro assim — nem cofre, nem fumarola (a boca dela e 2x2; esta e 6x6).
// - a CRUZ DE LUZES-GUIA convergentes: quatro voxels dourados que caminham
//   da borda para o miolo, ciclo apos ciclo. E a MESMA assinatura do poco
//   original — o jogador que aprendeu "cruz dourada convergindo = transporte"
//   continua sabendo ler qualquer portal novo.
// A regra anti-mentira vale ao contrario aqui: decoracao nunca usa ouro
// JUSTAMENTE para que estes quatro voxels continuem significando "entre".
//
// A chave do flavor e a mesma do cliente (portalKeyFor): a OCUPACAO manda —
// uma operacao Aurix cava elevadores em qualquer rocha — e, sem ocupacao,
// o estrato. 10 chaves + o poco SELADO da extracao de retorno: com o Nucleo
// na mao o poco nao desce mais, e um portal animado convidando para uma
// interacao que sera recusada seria uma mentira de interface.
import { box } from './voxel.mjs';

export const PORTAL_KEYS = [
  'basalt',
  'prismatic',
  'aquifer',
  'sulfur',
  'furnace',
  'silica',
  'glacial',
  'ferric',
  'mycelial',
  'aurix',
];

// Mesma cadencia do poco original (170ms): o ritmo tambem e parte da lingua.
export const PORTAL_PROP_KINDS = [
  ...PORTAL_KEYS.map((key) => ({ name: `portal:${key}`, frames: 6, frameMs: 170 })),
  { name: 'portal:sealed', frames: 1, frameMs: 0 },
];

/** Meia-largura da base: um voxel mais largo que o poco antigo — e uma PORTA. */
const HALF = 6;

const ring = (boxes, z, inset, h, mat) => {
  const a = -HALF + inset;
  const b = HALF - inset - 1;
  for (let x = a; x <= b; x++) {
    for (let y = a; y <= b; y++) {
      if (x !== a && x !== b && y !== a && y !== b) continue;
      boxes.push(box(x, y, z, 1, 1, h, mat));
    }
  }
};

/**
 * A BOCA: placa opaca no fundo + aro interno escuro. Opaca de proposito —
 * sem ela o centro mostraria o piso comum e o portal viraria um aro de
 * decoracao (a mesma licao do descentModel).
 */
const mouth = (boxes) => {
  boxes.push(box(-3, -3, 0, 6, 6, 1, 'rockDeep'));
  ring(boxes, 1, 3, 1, 'scorch');
};

/**
 * A cruz de luzes-guia, com a MESMA lei de movimento do poco original:
 * converge da borda para o centro enquanto perde altura. Uma cruz que anda
 * le como direcao; quatro pontos piscando seriam ruido.
 */
const guides = (boxes, step) => {
  const inset = Math.min(3, 1 + Math.floor(step / 2));
  const g = HALF - inset - 1;
  const z = 3 - Math.min(2, Math.floor(step / 2));
  for (const [x, y] of [[-g, 0], [g, 0], [0, -g], [0, g]]) {
    boxes.push(box(x, y, z, 1, 1, 1, 'loot'));
  }
};

// Posicoes de colar fora dos EIXOS: as luzes-guia caminham pelos eixos
// (|x| ou |y| ate 4) e uma torre de flavor na frente delas as engoliria.
const COLLAR_8 = [
  [4, -5], [5, 1], [2, 5], [-2, 4], [-5, 3], [-6, -2], [-4, -5], [1, -6],
];

const flavorOf = (key, step) => {
  const boxes = [];
  switch (key) {
    case 'basalt': {
      // Escada de colunas basalticas espiralando para dentro: as alturas
      // descem ao redor da boca — o proprio colar ja desenha "descida".
      COLLAR_8.forEach(([cx, cy], i) => {
        const h = 2 + i;
        boxes.push(box(cx, cy, 0, 2, 2, h, 'rock'));
        // O degrau "ativo" corre a espiral no ciclo: pedra clara, nao luz —
        // basalto nao emite, quem emite e a cruz dourada.
        boxes.push(box(cx, cy, h, 2, 2, 1, i === step ? 'bone' : 'rockDeep'));
      });
      break;
    }
    case 'prismatic': {
      // Garganta de geodo: agulhas de cristal frio inclinadas para fora.
      // O brilho e um reflexo (electric) que corre de agulha em agulha —
      // cristal nao pulsa, ele REFLETE a luz de quem passa.
      COLLAR_8.forEach(([cx, cy], i) => {
        if (i % 2 === 1) {
          boxes.push(box(cx, cy, 0, 2, 2, 1, 'rockDeep'));
          return;
        }
        const h = 3 + (i % 3);
        boxes.push(box(cx, cy, 0, 2, 2, 2, 'rock'));
        boxes.push(box(cx, cy, 2, 1, 1, h, 'ice'));
        boxes.push(box(cx, cy, 2 + h, 1, 1, 1, i / 2 === step % 4 ? 'electric' : 'ice'));
      });
      break;
    }
    case 'aquifer': {
      // Sumidouro dissolvido: labio baixo de rocha comida pela agua, com a
      // lamina escura empocada na borda. O reflexo frio orbita a boca — e o
      // unico movimento que agua parada tem.
      ring(boxes, 0, 0, 1, 'rock');
      COLLAR_8.forEach(([cx, cy], i) => {
        boxes.push(box(cx, cy, 0, 2, 2, i % 3 === 0 ? 2 : 1, 'rock'));
        boxes.push(box(cx, cy, i % 3 === 0 ? 2 : 1, 1, 1, 1, 'water'));
      });
      const [gx, gy] = COLLAR_8[step];
      boxes.push(box(gx, gy, 2, 1, 1, 1, 'electric'));
      break;
    }
    case 'sulfur': {
      // Garganta porosa: labio de osso mineral com PLACAS de enxofre — e um
      // sopro amarelo que sobe da boca e se desfaz: o portal RESPIRA, como
      // os respiradouros do proprio estrato. Crosta em placas, nunca em
      // anel: o topo da rampa do enxofre e ouro, e um aro amarelo cheio
      // leria como premio e afogaria a propria cruz-guia.
      ring(boxes, 0, 0, 2, 'bone');
      for (const [cx, cy] of [[-6, -3], [5, 2], [-2, -6], [1, 5], [-6, 3], [4, -6]]) {
        boxes.push(box(cx, cy, 2, 1, 1, 1, 'sulfur'));
      }
      COLLAR_8.forEach(([cx, cy], i) => {
        if (i % 2 === 0) boxes.push(box(cx, cy, 0, 2, 2, 2, i % 4 === 0 ? 'rust' : 'bone'));
      });
      if (step < 4) boxes.push(box(0, 0, 3 + step, 1, 1, 1, 'sulfur'));
      break;
    }
    case 'furnace': {
      // Rampa de entulho da Fornalha: escoria escura com brasa PULSANDO nas
      // frestas. A brasa e real neste estrato (SURF_EMBER) — aqui ela nao
      // mente, ela ambienta.
      ring(boxes, 0, 0, 2, 'rockDeep');
      COLLAR_8.forEach(([cx, cy], i) => {
        boxes.push(box(cx, cy, 0, 2, 2, 1 + (i % 3), 'rockDeep'));
        if (i % 4 === 2) boxes.push(box(cx, cy, 1 + (i % 3), 1, 1, 1, 'scorch'));
      });
      if (step % 2 === 0) {
        boxes.push(box(-5, -2, 1, 1, 1, 1, 'fire'));
        boxes.push(box(4, 2, 1, 1, 1, 1, 'fire'));
      }
      break;
    }
    case 'silica': {
      // Tunel escorado nos proprios estratos: o colar e a estratigrafia em
      // bandas, os pontaletes de osso seguram a boca. Um grao de sedimento
      // cai pelo furo — a Silica esta sempre desmoronando um pouco.
      ring(boxes, 0, 0, 1, 'bone');
      ring(boxes, 1, 0, 1, 'rock');
      ring(boxes, 2, 1, 1, 'rust');
      for (const [px, py] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) {
        boxes.push(box(px, py, 0, 1, 1, 5, 'bone'));
        boxes.push(box(px, py, 5, 1, 1, 1, 'rust'));
      }
      boxes.push(box(1, -2, 5 - step, 1, 1, 1, 'rock'));
      break;
    }
    case 'glacial': {
      // Furo no gelo: colar leitoso com rachaduras radiais escuras — e o
      // reflexo correndo a borda, como em toda superficie da Cripta.
      ring(boxes, 0, 0, 2, 'ice');
      for (const [cx, cy] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) {
        boxes.push(box(cx, cy, 2, 2, 2, 1, 'ice'));
        boxes.push(box(cx, cy, 0, 1, 1, 2, 'rockDeep')); // rachadura
      }
      const [gx, gy] = COLLAR_8[step];
      boxes.push(box(gx, gy, 2, 1, 1, 1, 'electric'));
      break;
    }
    case 'ferric': {
      // O poco do VEIO: colar em bandas de minerio oxidado e dois pilares
      // magnetizados com a faisca alternando entre eles — o mesmo campo que
      // conduz descarga pelas paredes do estrato.
      ring(boxes, 0, 0, 2, 'rust');
      ring(boxes, 2, 1, 1, 'scorch');
      boxes.push(box(-6, -4, 0, 2, 2, 5, 'rust'));
      boxes.push(box(4, 2, 0, 2, 2, 5, 'rust'));
      boxes.push(box(-6, -4, 5, 1, 1, 1, step % 2 === 0 ? 'electric' : 'rockDeep'));
      boxes.push(box(4, 2, 5, 1, 1, 1, step % 2 === 1 ? 'electric' : 'rockDeep'));
      break;
    }
    case 'mycelial': {
      // Iris fungica: labios organicos que RESPIRAM em volta da boca —
      // abrem e fecham no ciclo. O biolum pontua como esporo, nao como
      // premio: dois voxels, pulsando com a respiracao.
      ring(boxes, 0, 0, 2, 'fungusDeep');
      ring(boxes, 2, 1, 1, 'fungus');
      const breath = step < 3 ? step : 5 - step; // 0,1,2,2,1,0
      const lip = 3 - breath;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        boxes.push(box(sx * lip + (sx < 0 ? 0 : -1), sy * lip + (sy < 0 ? 0 : -1), 2, 1, 1, 1, 'fungus'));
      }
      boxes.push(box(-5, 2, 3, 1, 1, 1, breath === 2 ? 'biolum' : 'fungus'));
      boxes.push(box(4, -4, 3, 1, 1, 1, breath === 0 ? 'biolum' : 'fungus'));
      break;
    }
    case 'aurix': {
      // O elevador industrial: castelete de quatro montantes com travessas
      // no topo e a CABINE descendo — o descentModel crescido, porque aqui
      // a ocupacao construiu de verdade o que os outros biomas so cavaram.
      ring(boxes, 0, 0, 1, 'rust');
      for (const [px, py] of [[-5, -5], [4, -5], [-5, 4], [4, 4]]) {
        boxes.push(box(px, py, 0, 1, 1, 8, 'rust'));
        boxes.push(box(px, py, 8, 1, 1, 1, 'bone'));
      }
      boxes.push(box(-5, -5, 7, 10, 1, 1, 'rust'));
      boxes.push(box(-5, 4, 7, 10, 1, 1, 'rust'));
      // Vigas de topo cruzadas + GUINCHO: sem eles a gaiola lia vazia nos
      // quadros em que a cabine ja afundou — o cabo desenrolando e o que
      // mantem "elevador em movimento" legivel o ciclo inteiro.
      boxes.push(box(-5, 0, 8, 10, 1, 1, 'rust'));
      boxes.push(box(0, -5, 8, 1, 10, 1, 'rust'));
      boxes.push(box(-1, -1, 9, 2, 2, 1, 'rust'));
      boxes.push(box(0, 0, 7 - step, 1, 1, 2 + step, 'rust')); // o cabo
      // Cabine: mesma lei do poco original — perde area E altura ao descer.
      const radius = step < 2 ? 2 : step < 4 ? 1 : 0;
      const size = radius * 2 + 1;
      const mat = step < 2 ? 'loot' : step < 4 ? 'rust' : 'rock';
      boxes.push(box(-radius, -radius, 6 - step, size, size, 1, mat));
      if (radius > 0) {
        boxes.push(box(-radius, 0, 7 - step, size, 1, 1, 'bone'));
        boxes.push(box(0, -radius, 7 - step, 1, size, 1, 'bone'));
      }
      break;
    }
    default:
      throw new Error(`portal desconhecido: ${key}`);
  }
  return boxes;
};

/**
 * O poco SELADO da extracao de retorno: a boca tampada com laje e barrotes,
 * SEM luzes-guia e sem brilho nenhum. O contraste com o portal vivo e a
 * informacao: quem chega aqui com o Nucleo entende de longe que a descida
 * acabou — a saida e por onde entrou.
 */
const sealedModel = () => {
  const boxes = [];
  mouth(boxes);
  ring(boxes, 0, 0, 1, 'rock');
  boxes.push(box(-3, -3, 1, 6, 6, 1, 'rockDeep')); // a laje sobre o furo
  boxes.push(box(-3, 0, 2, 6, 1, 1, 'rust')); // barrotes cruzados
  boxes.push(box(0, -3, 2, 1, 6, 1, 'rust'));
  for (const [rx, ry] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) {
    boxes.push(box(rx, ry, 2, 1, 1, 1, 'bone')); // rebites
  }
  return boxes;
};

export const portalModel = (kind, frame) => {
  if (kind === 'portal:sealed') return sealedModel();
  const key = kind.slice('portal:'.length);
  const step = ((Math.floor(frame) % 6) + 6) % 6;
  const boxes = [];
  mouth(boxes);
  boxes.push(...flavorOf(key, step));
  guides(boxes, step);
  return boxes;
};
