// Atlas de objetos de mundo: o Nucleo do Veio, o poco de descida e a plataforma de extracao.
//
// Por que existe: o Nucleo e O objetivo da run — a tela inteira diz "ENCONTRE O
// NUCLEO" — e era desenhado como UM losango de cor chapada com o brilho
// oscilando, flutuando 3px acima do chao. A coisa mais importante do mapa era o
// unico elemento sem forma nenhuma, menor que qualquer parede em volta dela.
// Depois que bloco, chao, criatura e projetil viraram voxel, ele ficou sendo
// literalmente a mancha de cor no meio de um mundo solido.
//
// Um objetivo tem de ser lido de longe, antes de estar na tela inteira: por
// isso e ALTO. Altura e o unico eixo que a projecao isometrica nao encurta com
// a distancia, e e o que faz o jogador virar a camera e ir ate la.
import { box, DIR_UNROTATED, modelBounds, renderVoxels } from './voxel.mjs';
import { DECOR_PROP_KINDS, decorPropModel } from './decor-props.mjs';
import { PORTAL_PROP_KINDS, portalModel } from './portal-props.mjs';

/**
 * Tipos e suas animacoes ASSADAS.
 *
 * O nucleo pulsa devagar: e um farol, nao um alarme. A cadencia lenta tambem o
 * separa do fogo (110ms) e do gas (300ms) que podem estar na mesma tela — se
 * tudo pulsasse junto, nada chamaria atencao.
 *
 * A descida e mais mecanica: uma plataforma some para dentro do poco em seis
 * passos. O ciclo e curto o bastante para o sentido vertical ser percebido de
 * relance, mas nao tao rapido a ponto de parecer uma armadilha pulsando.
 */
export const PROP_KINDS = [
  { name: 'core', frames: 6, frameMs: 190 },
  { name: 'coreTaken', frames: 1, frameMs: 0 },
  { name: 'descent', frames: 6, frameMs: 170 },
  { name: 'extraction', frames: 4, frameMs: 240 },
  { name: 'salvageTerminalIdle', frames: 2, frameMs: 420 },
  { name: 'salvageTerminalScanning', frames: 4, frameMs: 120 },
  { name: 'salvageTerminalComplete', frames: 2, frameMs: 300 },
  { name: 'salvageCache', frames: 1, frameMs: 0 },
  { name: 'salvageCacheOpened', frames: 1, frameMs: 0 },
  // Props DECORATIVOS volumetricos (fumarolas, monolitos, a broca...):
  // modelos estaticos em duas variantes, no fim para nao mover indices.
  // Ver decor-props.mjs — pedrinhas e cacos continuam em runtime.
  ...DECOR_PROP_KINDS,
  // PORTAIS por bioma (portal:<chave>) + o poco selado da extracao de
  // retorno. Ver portal-props.mjs — o `descent` acima vira fallback.
  ...PORTAL_PROP_KINDS,
];

/** Meia-largura da base, em voxels. */
const HALF = 5;

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
 * O Nucleo: pedestal de rocha, quatro contrafortes minerais e o cristal
 * suspenso entre eles.
 *
 * `phase` percorre 0..1 no ciclo da animacao. O cristal sobe e desce e engorda
 * junto — so mudar de cor devolveria o problema original, um brilho piscando
 * sem volume.
 */
const coreModel = (phase, taken) => {
  const boxes = [];
  const bob = Math.round(Math.sin(phase * Math.PI * 2) * 1.5);
  const swell = Math.sin(phase * Math.PI * 2) > 0.4 ? 1 : 0;

  // Pedestal em tres degraus: a base larga e o que da peso ao objeto.
  ring(boxes, 0, 0, 2, 'rockDeep');
  ring(boxes, 2, 1, 2, 'rock');
  ring(boxes, 4, 2, 1, 'bone');

  // Quatro contrafortes nos cantos, subindo e afinando. Sao eles que levam o
  // olho de baixo para cima ate o cristal.
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const cx = sx * (HALF - 2);
    const cy = sy * (HALF - 2);
    boxes.push(box(cx, cy, 5, 1, 1, 7, 'bone'));
    boxes.push(box(cx - sx, cy - sy, 12, 1, 1, 4, 'bone'));
    boxes.push(box(cx - sx, cy - sy, 16, 1, 1, 1, taken ? 'rust' : 'loot'));
  }

  if (taken) {
    // Berco vazio: os contrafortes continuam de pe e o encaixe fica a mostra.
    // O parceiro de co-op precisa saber, de longe, que alguem ja pegou.
    ring(boxes, 5, 2, 1, 'rockDeep');
    return boxes;
  }

  // O cristal, suspenso no meio dos contrafortes.
  //
  // Empilhado em aneis que abrem e fecham — estreito embaixo, largo no meio,
  // estreito em cima. A primeira versao era uma caixa com um ressalto por cima,
  // e o ressalto achatava tudo: lia como uma MESA verde flutuando, e ainda
  // escondia a ponta clara atras dele. Gema precisa de facetas, nao de tampo.
  const z = 9 + bob;
  const layers = [0, 1, 1 + swell, 1, 0];
  layers.forEach((r, k) => {
    boxes.push(box(-r, -r, z + k, r * 2 + 1, r * 2 + 1, 1, 'biolum'));
  });
  // Ponta clara acima de tudo: o ponto mais alto do mapa, e o unico voxel
  // branco da cena — e o que o olho encontra primeiro varrendo a tela.
  boxes.push(box(0, 0, z + layers.length, 1, 1, 1, 'player'));
  // Lascas orbitando, defasadas do corpo para o conjunto nao subir em bloco.
  const orbit = Math.round(Math.sin(phase * Math.PI * 2 + Math.PI) * 1.5);
  for (const [ox, oy] of [[-4, 0], [4, 0], [0, -4], [0, 4]]) {
    boxes.push(box(ox, oy, 10 + orbit, 1, 1, 1, 'biolum'));
  }
  return boxes;
};

/**
 * Estado puro da plataforma dentro do poco.
 *
 * A plataforma perde altura E area ao descer. Em isometria, apenas baixar `z`
 * poderia parecer que a peca andou para a frente; encolher junto fornece a pista
 * de profundidade que faz o olho entender que ela esta indo para baixo.
 *
 * A descida ocupa os SEIS passos, um por quadro. Antes ela partia de 5 e era
 * grampeada em 1, entao os dois ultimos quadros davam exatamente a mesma altura,
 * o mesmo raio e o mesmo material: o ciclo de seis quadros tinha cinco imagens e
 * a cabine parecia travar no fundo antes de reaparecer no topo. Comecando em 6 a
 * altura cai um degrau por quadro e o piso 1 e alcancado no ultimo, sem grampo —
 * z=0 e proibido porque a placa opaca do fundo do poco ocupa essa camada.
 */
export const descentPlatformState = (frame) => {
  const step = ((Math.floor(frame) % 6) + 6) % 6;
  const radius = step < 2 ? 2 : step < 4 ? 1 : 0;
  return {
    step,
    radius,
    z: 6 - step,
    material: step < 2 ? 'loot' : step < 4 ? 'rust' : 'rock',
  };
};

/**
 * O transporte entre setores: boca de poco reforcada e plataforma descendente.
 *
 * Ele e deliberadamente BAIXO. O Nucleo continua sendo o farol vertical da run;
 * o poco precisa dizer "entre aqui e va para baixo", nao competir por majestade.
 * O centro escuro permanece aparente em todos os quadros, enquanto a plataforma
 * encolhe e baixa e quatro luzes-guia caminham da borda para o miolo.
 */
const descentModel = (frame) => {
  const boxes = [];
  const platform = descentPlatformState(frame);

  // Boca larga e mecanica: rocha estrutural por fora, metal gasto por dentro.
  ring(boxes, 0, 0, 2, 'rockDeep');
  ring(boxes, 2, 1, 1, 'rust');
  ring(boxes, 1, 2, 1, 'bone');

  // Fundo opaco: sem esta placa o centro transparente mostraria o piso comum e
  // o poco seria lido como apenas mais um aro de decoracao.
  boxes.push(box(-2, -2, 0, 5, 5, 1, 'rockDeep'));

  // Quatro trilhos curtos seguram a silhueta de elevador sem criar outra torre.
  for (const [x, y] of [[-4, -4], [3, -4], [-4, 3], [3, 3]]) {
    boxes.push(box(x, y, 2, 1, 1, 4, 'rust'));
    boxes.push(box(x, y, 6, 1, 1, 1, 'bone'));
  }

  // Plataforma/cabine vista de cima. Tamanho e altura sao os dois sinais de
  // afastamento; o amarelo some cedo e vira ferrugem/sombra no fundo.
  const size = platform.radius * 2 + 1;
  boxes.push(box(-platform.radius, -platform.radius, platform.z, size, size, 1, platform.material));
  if (platform.radius > 0) {
    boxes.push(box(-platform.radius, 0, platform.z + 1, size, 1, 1, 'bone'));
    boxes.push(box(0, -platform.radius, platform.z + 1, 1, size, 1, 'bone'));
  }

  // Luzes de guia se movem da borda para o centro acompanhando a cabine. Uma
  // cruz convergente e lida como direcao; quatro pontos piscando seriam ruido.
  const guideInset = Math.min(3, 1 + Math.floor(platform.step / 2));
  const guide = HALF - guideInset - 1;
  for (const [x, y] of [[-guide, 0], [guide, 0], [0, -guide], [0, guide]]) {
    boxes.push(box(x, y, 3 - Math.min(2, Math.floor(platform.step / 2)), 1, 1, 1, 'loot'));
  }

  return boxes;
};

/**
 * A plataforma de extracao. Deliberadamente BAIXA e larga, o oposto do Nucleo:
 * os dois marcadores nao podem competir. Um chama para ir buscar, o outro diz
 * onde sair — confundir os dois custa a run.
 */
const extractionModel = (phase) => {
  const boxes = [];
  ring(boxes, 0, 0, 1, 'rust');
  ring(boxes, 0, 1, 1, 'rockDeep');
  // Marcas de guia acendendo em sequencia, apontando para dentro.
  const lit = Math.floor(phase * 4) % 4;
  const marks = [[-HALF + 1, 0], [HALF - 2, 0], [0, -HALF + 1], [0, HALF - 2]];
  marks.forEach(([x, y], i) => {
    boxes.push(box(x, y, 1, 1, 1, 1, i === lit ? 'loot' : 'rust'));
  });
  return boxes;
};

/** Terminal alto, com antena e tela pequena: tecnico sem competir com o Nucleo. */
const salvageTerminalModel = (phase, state) => {
  const boxes = [];
  boxes.push(box(-3, -2, 0, 6, 4, 2, 'rockDeep'));
  boxes.push(box(-2, -1, 2, 4, 3, 9, 'rock'));
  boxes.push(box(-2, -2, 7, 4, 1, 4, 'bone'));
  const scanning = state === 'scanning';
  const complete = state === 'complete';
  const lit = complete || (scanning && Math.floor(phase * 4) % 2 === 0);
  boxes.push(box(-1, -3, 8, 2, 1, 2, lit ? 'biolum' : 'rust'));
  boxes.push(box(0, 0, 11, 1, 1, 5, 'bone'));
  boxes.push(box(-2, 0, 15, 5, 1, 1, scanning ? 'loot' : complete ? 'biolum' : 'rust'));
  if (scanning) {
    const sweep = Math.floor(phase * 4) - 2;
    boxes.push(box(sweep, 1, 13, 1, 1, 1, 'loot'));
  }
  return boxes;
};

/** Cofre baixo e compacto. O amarelo e selo/acento, nao o volume inteiro. */
const salvageCacheModel = (opened) => {
  const boxes = [];
  boxes.push(box(-4, -3, 0, 8, 6, 2, 'rockDeep'));
  boxes.push(box(-3, -2, 2, 6, 4, opened ? 2 : 4, 'rock'));
  boxes.push(box(-3, -3, opened ? 2 : 5, 6, 1, 1, opened ? 'rust' : 'loot'));
  boxes.push(box(-1, -3, 3, 2, 1, 2, opened ? 'rockDeep' : 'bone'));
  if (opened) {
    boxes.push(box(-3, 1, 5, 6, 1, 1, 'rockDeep'));
    boxes.push(box(-2, 2, 6, 4, 1, 1, 'rust'));
  }
  return boxes;
};

export const propModel = (kind, frame) => {
  const spec = PROP_KINDS.find((k) => k.name === kind);
  if (!spec) throw new Error(`prop desconhecido: ${kind}`);
  if (kind.startsWith('decor:')) return decorPropModel(kind);
  if (kind.startsWith('portal:')) return portalModel(kind, frame);
  const phase = spec.frames > 1 ? frame / spec.frames : 0;
  if (kind === 'core') return coreModel(phase, false);
  if (kind === 'coreTaken') return coreModel(0, true);
  if (kind === 'descent') return descentModel(frame);
  if (kind === 'extraction') return extractionModel(phase);
  if (kind === 'salvageTerminalIdle') return salvageTerminalModel(phase, 'idle');
  if (kind === 'salvageTerminalScanning') return salvageTerminalModel(phase, 'scanning');
  if (kind === 'salvageTerminalComplete') return salvageTerminalModel(phase, 'complete');
  if (kind === 'salvageCache') return salvageCacheModel(false);
  return salvageCacheModel(true);
};

/**
 * Extensao projetada. Mede SEM rotacao, igual ao rasterizador — foi o
 * desalinhamento de 2px do atlas de blocos que ensinou a nao divergir aqui.
 */
export const propBounds = () => {
  let acc;
  for (const kind of PROP_KINDS) {
    for (let frame = 0; frame < kind.frames; frame++) {
      acc = modelBounds(propModel(kind.name, frame), acc);
    }
  }
  return acc;
};

/**
 * Renderiza todos os quadros. Sem niveis de luz: os objetivos emitem a propria
 * luz e precisam ser legiveis mesmo no canto escuro onde a geracao os coloca.
 */
export const buildPropFrames = (frameW, frameH, anchorX, anchorY) => {
  const frames = [];
  for (const kind of PROP_KINDS) {
    for (let frame = 0; frame < kind.frames; frame++) {
      frames.push(renderVoxels(propModel(kind.name, frame), DIR_UNROTATED, frameW, frameH, anchorX, anchorY));
    }
  }
  return frames;
};
