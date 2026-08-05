// Atlas de crostas de chao pre-renderizadas em voxel.
//
// Por que existe: o cenario inteiro ja e voxel — bloco, criatura, projetil,
// particula — mas o CHAO continuava sendo um losango de cor chapada por celula,
// e as materias que vivem nele eram um `rgba()` translucido por cima. Era a
// ultima superficie plana do jogo, e a maior: ocupa mais pixels que todo o resto
// somado.
//
// O alpha era o problema de fundo. O contrato dos atlas e alpha binario (art
// bible §2), e uma nuvem translucida nao pertence a um mundo facetado — ela nao
// tem forma, so cor por cima de cor. A resposta voxel para "ver atraves" nao e
// transparencia: e OCUPACAO ESPARSA. Gas e esporos sao cubinhos separados por
// vazio; o chao aparece pelos buracos e as duas materias continuam tendo volume.
//
// Cada tipo e um tile de chao COMPLETO, com o substrato de rocha embutido: o
// cliente faz UM drawImage por celula, no lugar de um fill de losango mais os
// remendos por cima. Nao ha custo novo por frame — ha menos.
import { box, DIR_UNROTATED, MODEL_SCALE, modelBounds, renderVoxels } from './voxel.mjs';
import { dim, LIGHT_LEVELS, lightFactor, VARIANTS } from './terrain.mjs';
import { COLORS } from './lib.mjs';

/**
 * A crosta usa a MESMA grade 8x8 de colunas AUTORADAS do bloco: um voxel de
 * chao tem exatamente o tamanho de um voxel de parede, senao o piso e o bloco
 * em cima dele parecem feitos em escalas diferentes.
 *
 * Com a grade subdividida (MODEL_SCALE), a laje e as materias em cima dela sao
 * construidas coluna a coluna FINA (16x16 por tile) — cascalho, tapete, lamina,
 * chama e graos sorteados por voxel fino, como o terreno ja faz. O gas e a
 * excecao deliberada: o algoritmo de sopros continua raciocinando na grade
 * autorada (os contratos de forma, deriva e cobertura vivem nela) e cada cubo
 * escolhido vira um aglomerado fino ROIDO na hora de virar caixa.
 */
export const SURFACE_COLS = 8;
const F = MODEL_SCALE;
const FINE_COLS = SURFACE_COLS * F;

/**
 * Tipos na ordem em que o cliente os indexa (espelha SURF_* da simulacao, com o
 * chao nu na frente porque SURF_NONE e 0).
 *
 * Os IDs 0..5 sao historicos e nao mudam. `spores` e `fungal-heated` entram no
 * fim para que diffs de chunks antigos nao passem a significar outra materia.
 */
export const SURFACE_KINDS = [
  { name: 'bare', frames: 1, frameMs: 0 },
  { name: 'fungal', frames: 2, frameMs: 520 },
  { name: 'biofluid', frames: 4, frameMs: 260 },
  { name: 'gas', frames: 6, frameMs: 240 },
  { name: 'fire', frames: 4, frameMs: 110 },
  { name: 'scorched', frames: 1, frameMs: 0 },
  { name: 'spores', frames: 4, frameMs: 360 },
  { name: 'fungal-heated', frames: 2, frameMs: 240 },
  // Agua do Aquifero Negro (SURF_WATER = 8). Entra no fim pela regra de sempre:
  // os IDs viajam nos diffs de chunk e nao podem mudar de significado. Mais
  // lenta que o biofluido: agua parada ondula, nao borbulha.
  { name: 'water', frames: 4, frameMs: 340 },
  // Fissura incandescente da Fornalha Abissal (SURF_EMBER = 9): pulsa devagar,
  // como rocha respirando calor — nao e chama, e o chao rachado por baixo.
  { name: 'ember', frames: 4, frameMs: 260 },
  // Gelo da Cripta Glacial (SURF_ICE = 10): quase estatico; so o reflexo anda.
  { name: 'ice', frames: 2, frameMs: 760 },
  // Trilhos da operacao (SURF_RAIL = 11 horizontal, SURF_RAIL_V = 12
  // vertical): dormentes e dois frisos gastos. Estaticos — o que se move
  // neles e o CARRINHO, e esse e um projetil, nao a crosta.
  { name: 'rail', frames: 1, frameMs: 0 },
  { name: 'rail-v', frames: 1, frameMs: 0 },
  // Silica solta (SURF_SILT = 13) e vidro (SURF_GLASS = 14), os dois lados da
  // mesma decisao nos Sumidouros: a areia e o rastro do Devorador, o vidro e a
  // resposta do jogador a ela. Precisam se separar A DISTANCIA, porque o que o
  // jogador le no chao e onde ele pode ou nao ser pego por baixo — daí um ser
  // areia morna com ondulacao e o outro placa fria, lisa e brilhante.
  { name: 'silt', frames: 2, frameMs: 620 },
  { name: 'glass', frames: 2, frameMs: 900 },
];

const hash3d = (x, y, z, seed) => {
  let h =
    Math.imul(x + 8, 374761393) ^
    Math.imul(y + 8, 668265263) ^
    Math.imul(z + 8, 2147483647) ^
    Math.imul(seed + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Laje de rocha sob toda crosta, com relevo de MEIO voxel em parte das colunas
 * finas. O topo continua na mesma altura autorada (as entidades assentam onde
 * sempre assentaram); o que dobra e a frequencia do cascalho.
 */
const slab = (variant, mat, bumpMat) => {
  const boxes = [];
  const half = SURFACE_COLS / 2;
  for (let fx = 0; fx < FINE_COLS; fx++) {
    for (let fy = 0; fy < FINE_COLS; fy++) {
      const h = hash3d(fx, fy, 0, variant);
      const x = fx / F - half;
      const y = fy / F - half;
      // Cerca de um quinto das colunas sobe meio voxel: cascalho, nao azulejo.
      const bump = (h & 7) < 2;
      boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, (h >>> 3) % 7 === 0 ? bumpMat : mat));
      if (bump) boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, bumpMat));
    }
  }
  return boxes;
};

/** Altura da laje numa coluna fina, para a materia de cima assentar sobre ela. */
const slabTop = (fx, fy, variant) => ((hash3d(fx, fy, 0, variant) & 7) < 2 ? 1.5 : 1);

/** Percorre as colunas FINAS da grade entregando posicao, topo da laje e hash. */
const overSlab = (variant, seed, fn) => {
  const half = SURFACE_COLS / 2;
  for (let fx = 0; fx < FINE_COLS; fx++) {
    for (let fy = 0; fy < FINE_COLS; fy++) {
      fn({
        cx: fx,
        cy: fy,
        x: fx / F - half,
        y: fy / F - half,
        top: slabTop(fx, fy, variant),
        h: hash3d(fx, fy, seed, variant),
      });
    }
  }
};

/**
 * O gas tem DUAS camadas, e a razao e de leitura, nao de enfeite.
 *
 * A referencia de penacho e uma peca UNICA: pe fino subindo para uma cabeca
 * lobulada, dramatica porque esta sozinha contra o fundo. Um atlas de tiles nao
 * desenha uma peca — desenha a MESMA peca em toda celula que a simulacao marcar
 * como gas. Repetido celula a celula, o penacho vira mato: renderizado, um campo
 * de gas com penacho em toda celula fecha numa parede verde opaca que esconde o
 * que esta atras. Num jogo que promete que a morte venha de decisao arriscada e
 * nunca do que nao dava para ver, isso e pior do que feio.
 *
 * Entao: TODA celula de gas tem a bruma baixa — esparsa, na altura de antes, e e
 * ela que marca o perigo e mantem o chao visivel. E so UMA das tres variantes
 * solta penacho. Como o cliente escolhe a variante pela posicao, cerca de um
 * terco das celulas levanta uma coluna, e o campo le como bruma de enxofre com
 * penachos subindo dela — que e a linguagem da referencia, num arranjo que
 * continua jogavel.
 */
const GAS_HAZE_FLOOR = 4;
const GAS_HAZE_CEIL = 5;

/**
 * Estagios da bruma, do nascimento a dissipacao.
 *
 * `count` e o numero EXATO de colunas: sortear cada uma com probabilidade caindo
 * com a distancia — a formulacao obvia — deixava a variancia dominar a media, e
 * a massa medida oscilava entre 2 e 10 voxels por celula. Numa animacao curta
 * isso nao le como dissipacao, le como PISCA.
 *
 * `core` sao as primeiras colunas do ranking, e sobem DOIS voxels: em projecao
 * isometrica a altura e a unica coisa que separa um monte de uma fileira.
 */
const GAS_HAZE_STAGES = [
  { count: 2, core: 1, base: GAS_HAZE_FLOOR, lift: 0 },
  { count: 3, core: 2, base: GAS_HAZE_FLOOR, lift: 0 },
  { count: 3, core: 2, base: GAS_HAZE_FLOOR, lift: 0 },
  { count: 2, core: 2, base: GAS_HAZE_FLOOR, lift: 1 },
  { count: 2, core: 1, base: GAS_HAZE_FLOOR, lift: 1 },
  { count: 1, core: 1, base: GAS_HAZE_FLOOR, lift: 1 },
];

/**
 * Raio unico para TODOS os estagios.
 *
 * Ele era por estagio, e isso quebrava calado a propriedade que faz a animacao
 * ser crescimento: com raios diferentes, o conjunto de colunas candidatas muda,
 * a ordem do ranking muda junto, e o estagio seguinte pode escolher colunas
 * completamente outras. Medido, havia transicao de quadro com sobreposicao ZERO
 * — a celula inteira trocava de lugar de um quadro para o outro. Com raio fixo,
 * os estagios sao subconjuntos ANINHADOS da mesma lista ordenada: o sopro so
 * pode crescer de dentro para fora e se recolher pelo mesmo caminho.
 */
const GAS_HAZE_RADIUS = 2;

/**
 * Peso da distancia na disputa por uma vaga na bruma.
 *
 * As colunas do raio sao ordenadas por `hash + distancia * este peso` e as
 * primeiras `count` vencem. Baixo demais e a bruma sai espalhada sem miolo; alto
 * demais e a distancia decide sozinha e sai um losango solido, liso e sem os
 * vazios internos que deixam ver atraves. No meio, o centro quase sempre ganha,
 * mas uma coluna de borda com hash baixo rouba a vaga de uma central com hash
 * alto — e essa troca abre buraco no miolo e esfarrapa a borda de graca.
 */
const GAS_DIST_WEIGHT = 260;

/** Dois sopros de bruma por celula, sempre em estagios opostos do ciclo. */
const GAS_HAZE_PUFFS = 2;

/**
 * Faixa vertical do penacho.
 *
 * O pe comeca em 2 e nao encosta na laje: nascendo em z=1 — a altura do proprio
 * topo do piso — metade dos cubos nasceria DENTRO dele e a materia se deitaria
 * no chao, lendo como poca, que foi o defeito que originou todo este trabalho.
 *
 * O teto e caro: a crosta e desenhada no passo de piso, ANTES da fila ordenada
 * por profundidade, entao tudo que ela levanta passa por TRAS das paredes mesmo
 * estando na frente delas. A bruma cabe em dois niveis justamente para nao
 * agravar isso; o penacho nao cabe, porque sem altura nao ha pe nem cabeca — a
 * silhueta pedida E a altura. Fica restrito a uma variante em tres, entao o
 * artefato aparece em poucas celulas em vez de em todas.
 */
const GAS_BASE = 2;
const GAS_TOP = 12;

/**
 * Estagios do penacho, do fiapo ao que sobrou dele.
 *
 * `stem` e a faixa do pe (nula quando ele ja se desprendeu), `headZ` a altura do
 * centro da cabeca, `lobes` quantos bulbos a compoem e `spread` o quanto se
 * afastam. A cabeca sobe e se abre, o pe se consome de baixo para cima, e no fim
 * so restam bulbos soltos la em cima — que e o ciclo da referencia.
 */
const GAS_PLUME_STAGES = [
  { stem: [GAS_BASE, 4], headZ: 5, lobes: 1, spread: 0, mass: 3 },
  { stem: [GAS_BASE, 5], headZ: 7, lobes: 2, spread: 1, mass: 3 },
  { stem: [GAS_BASE, 6], headZ: 8, lobes: 3, spread: 1, mass: 4 },
  { stem: [GAS_BASE + 1, 7], headZ: 9, lobes: 3, spread: 2, mass: 4 },
  { stem: [GAS_BASE + 3, 8], headZ: 10, lobes: 3, spread: 2, mass: 3 },
  { stem: null, headZ: 11, lobes: 2, spread: 2, mass: 2 },
];

/** Variante que levanta penacho. As outras duas ficam so na bruma. */
const GAS_PLUME_VARIANT = 2;

/** Bruma baixa: sopros com ciclo de vida, presentes em toda celula de gas. */
const gasHaze = (variant, frame, put) => {
  for (let p = 0; p < GAS_HAZE_PUFFS; p++) {
    const seed = hash3d(p * 5 + 1, p * 3 + 2, 0, variant);
    const stage = (frame + p * 3) % GAS_HAZE_STAGES.length;
    const { count, core, base, lift } = GAS_HAZE_STAGES[stage];
    const radius = GAS_HAZE_RADIUS;
    // Deriva de UM passo, na metade de cima do ciclo. Acumulando um passo por
    // estagio, o sopro andava varias colunas e voltava de uma vez ao reiniciar:
    // medida, a sobreposicao entre quadros consecutivos chegava a ZERO e a
    // celula inteira teleportava.
    // A deriva NAO pode acontecer na volta do laco. Ela valia para todo estagio
    // a partir do terceiro, entao no ultimo quadro o sopro estava deslocado e no
    // primeiro voltava — um salto que, somado a troca de forma, zerava a
    // sobreposicao entre o ultimo quadro e o primeiro.
    const driftX = ((seed >>> 8) % 3) - 1;
    const driftY = ((seed >>> 11) % 3) - 1;
    const step = stage === 3 || stage === 4 ? 1 : 0;
    const ox = (seed % SURFACE_COLS) + driftX * step;
    const oy = ((seed >>> 4) % SURFACE_COLS) + driftY * step;

    const candidates = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Distancia em losango, e nao em quadrado: e a forma da propria celula
        // isometrica, entao o sopro sai redondo na TELA.
        const d = Math.abs(dx) + Math.abs(dy);
        if (d > radius) continue;
        candidates.push({
          dx,
          dy,
          // O ranking NAO depende do estagio, e e isso que torna a animacao um
          // crescimento: com o estagio na semente, cada quadro re-sorteava a
          // forma inteira e o sopro era substituido em vez de crescer.
          rank: (hash3d(ox + dx, oy + dy, p * 13, variant) % 1000) + d * GAS_DIST_WEIGHT,
        });
      }
    }
    // Desempate por posicao: `sort` so e estavel dentro de uma implementacao, e
    // este atlas precisa sair identico byte a byte em qualquer maquina.
    candidates.sort((a, b) => a.rank - b.rank || a.dx - b.dx || a.dy - b.dy);

    // Cresce CONECTADO: depois do miolo entra sempre a melhor coluna que ENCOSTA
    // no que ja foi escolhido. Pegar as `count` melhores direto nao garante
    // nada — nos estagios de duas colunas as duas melhores caiam em pontas
    // opostas e o sopro saia como dois pontos soltos.
    const chosen = [candidates[0]];
    while (chosen.length < count && chosen.length < candidates.length) {
      const next =
        candidates.find(
          (c) =>
            !chosen.includes(c) &&
            chosen.some((s) => Math.abs(c.dx - s.dx) + Math.abs(c.dy - s.dy) === 1)
        ) ?? candidates.find((c) => !chosen.includes(c));
      if (!next) break;
      chosen.push(next);
    }

    chosen.forEach((c, i) => {
      if (i < core) {
        put(ox + c.dx, oy + c.dy, base);
        put(ox + c.dx, oy + c.dy, base + 1);
        return;
      }
      put(ox + c.dx, oy + c.dy, Math.min(GAS_HAZE_CEIL, base + lift));
    });
  }
};

/**
 * Penacho: pe fino subindo para uma cabeca lobulada. UM por celula.
 *
 * Um so, e nao dois, porque o ciclo passa por um estagio quase vazio e a
 * tentacao e defasar um segundo penacho para cobrir esse vao. Nao e preciso: a
 * bruma ja esta em toda celula e ja e ela que garante que o perigo nunca some
 * da tela. Com dois, medido, o campo voltava a fechar numa massa continua — o
 * penacho custa altura E area, e duas colunas por celula gastam as duas.
 */
const gasPlume = (variant, frame, put) => {
  {
    const p = 0;
    const seed = hash3d(p * 9 + 3, p * 7 + 5, 1, variant);
    const stage = frame % GAS_PLUME_STAGES.length;
    const { stem, headZ, lobes, spread, mass } = GAS_PLUME_STAGES[stage];
    const ox = seed % SURFACE_COLS;
    const oy = (seed >>> 4) % SURFACE_COLS;
    // O eixo nao e uma reta vertical: um pe perfeitamente reto le como poste;
    // inclinado, le como algo que sobe empurrado pelo ar.
    const leanX = ((seed >>> 8) % 3) - 1;
    const leanY = ((seed >>> 11) % 3) - 1;
    const axis = (z) => [
      ox + Math.floor((leanX * (z - GAS_BASE)) / 4),
      oy + Math.floor((leanY * (z - GAS_BASE)) / 4),
    ];

    if (stem) {
      for (let z = stem[0]; z <= stem[1]; z++) {
        const [sx, sy] = axis(z);
        put(sx, sy, z);
        // Fiapo lateral esparso: o pe ondula em vez de ser uma coluna de um
        // voxel do inicio ao fim.
        if (hash3d(sx, sy, z, seed) % 3 === 0) put(sx + leanX, sy, z);
      }
    }

    const [hx, hy] = axis(headZ);
    for (let i = 0; i < lobes; i++) {
      const h = hash3d(i * 7 + 1, headZ, i, seed);
      const ang = (h % 4) + i;
      const dist = i === 0 ? 0 : spread;
      const cx = hx + Math.round(Math.cos((ang * Math.PI) / 2) * dist);
      const cy = hy + Math.round(Math.sin((ang * Math.PI) / 2) * dist);
      const cz = headZ + ((h >>> 5) % 2) - (i === 0 ? 0 : 1);
      // Bulbo: centro mais os vizinhos melhor ranqueados, e uma tampa em cima.
      // O ranking esfarrapa a borda — um bulbo cheio sairia um losango liso, que
      // le como cristal e nao como gas.
      put(cx, cy, cz);
      const around = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
        .map(([dx, dy], k) => ({ dx, dy, rank: hash3d(cx + dx, cy + dy, cz, seed + i * 31 + k) % 1000 }))
        .sort((a, b) => a.rank - b.rank || a.dx - b.dx || a.dy - b.dy);
      for (let k = 0; k < Math.min(mass, around.length); k++) {
        put(cx + around[k].dx, cy + around[k].dy, cz);
      }
      // Tampa: sem ela o bulbo e uma placa horizontal. E a altura que
      // transforma um disco num volume.
      if (mass >= 3) put(cx, cy, cz + 1);
    }
  }
};

const gasModel = (variant, frame) => {
  const half = SURFACE_COLS / 2;
  const wrap = (v) => ((v % SURFACE_COLS) + SURFACE_COLS) % SURFACE_COLS;
  // O tile de gas NAO traz a laje, e e o unico assim.
  //
  // Ela vinha embutida como em todo tipo, o que obrigava o gas a ser desenhado
  // no passo de piso — e ali ele e desenhado ANTES da fila ordenada por
  // profundidade, entao toda celula de gas encostada numa parede tinha o
  // penacho engolido por ela, mesmo estando na frente. Sem laje, o gas vira uma
  // peca solta que o cliente pode pos na fila ordenada, no lugar certo, e ainda
  // desenhar com alfa proprio sem deixar o CHAO translucido junto. O piso das
  // celulas de gas passa a ser o tipo `bare`.
  const boxes = [];
  const taken = new Set();
  // As colunas dao a volta na grade em vez de serem cortadas na borda. Recortar
  // obrigaria a manter os centros no miolo da celula, e um campo viraria uma
  // GRADE de penachos centralizados — a regularidade que a nuvem nao pode ter.
  const put = (cx, cy, z) => {
    if (z < GAS_BASE || z > GAS_TOP) return;
    const key = `${wrap(cx)},${wrap(cy)},${z}`;
    if (taken.has(key)) return;
    taken.add(key);
    // Grade fina: o cubo autorado que o algoritmo escolheu vira um aglomerado
    // 2x2x2 de voxels finos com ~1/5 deles roidos por hash. O sopro continua
    // raciocinando na grade grossa — os contratos de forma, deriva e cobertura
    // vivem nela —, mas a borda que o jogador ve fica esfarrapada no grao novo,
    // que e a diferenca entre gas e cristal.
    const bx = wrap(cx) - half;
    const by = wrap(cy) - half;
    for (let sx = 0; sx < F; sx++) {
      for (let sy = 0; sy < F; sy++) {
        for (let sz = 0; sz < F; sz++) {
          const eaten = hash3d(wrap(cx) * F + sx, wrap(cy) * F + sy, z * F + sz, variant + 101) % 5 === 0;
          if (eaten) continue;
          boxes.push(box(bx + sx / F, by + sy / F, z + sz / F, 1 / F, 1 / F, 1 / F, 'sulfur'));
        }
      }
    }
  };

  gasHaze(variant, frame, put);
  if (variant % VARIANTS === GAS_PLUME_VARIANT) gasPlume(variant, frame, put);
  return boxes;
};

/** Modelo de um tipo num quadro de animacao. */
export const surfaceModel = (kind, variant, frame) => {
  if (kind === 'bare') return slab(variant, 'floor', 'rockDeep');

  if (kind === 'scorched') {
    const boxes = slab(variant, 'scorch', 'floor');
    // Cinza com brasa apagando: pouquissimas e so onde a laje ja e alta.
    overSlab(variant, 91, ({ x, y, top, h }) => {
      if (top === 1.5 && h % 11 === 0) boxes.push(box(x, y, top, 1 / F, 1 / F, 0.5, 'rust'));
    });
    return boxes;
  }

  if (kind === 'fungal') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 17, ({ x, y, top, h }) => {
      if (h % 8 === 0) return; // falhas no tapete: o chao aparece por baixo
      boxes.push(box(x, y, top, 1 / F, 1 / F, 0.5, 'fungusDeep'));
      // Pontos vivos pulsam devagar; a massa continua baixa, um tapete umido.
      if ((h >>> 4) % 9 === (frame % 2) * 3) boxes.push(box(x, y, top + 0.5, 1 / F, 1 / F, 0.5, 'fungus'));
    });
    return boxes;
  }

  if (kind === 'fungal-heated') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 109, ({ x, y, top, h }) => {
      if (h % 8 === 0) return;
      // Mesma silhueta do fungo, mas sem o verde vivo uniforme: a colonia esta
      // secando. Rust/scorch aparecem em ilhas, nunca como chama antecipada.
      const dry = ((h >>> 3) + frame) % 5 === 0;
      boxes.push(box(x, y, top, 1 / F, 1 / F, 0.5, dry ? 'rust' : 'fungusDeep'));
      if ((h >>> 6) % 13 === frame * 4) {
        boxes.push(box(x, y, top + 0.5, 1 / F, 1 / F, 0.5, dry ? 'rust' : 'fungus'));
      }
    });
    return boxes;
  }

  if (kind === 'biofluid') {
    // Liquido acha nivel. O leito e plano e poucas pedras claras emergem dele.
    // Na grade fina a lamina e um FILME de meio voxel — liquido e raso — com o
    // reflexo em faixa fina e BOLHAS estourando na propria superficie: pontos
    // de biolum que acendem por dois quadros e somem, sorteados por coluna
    // fina. As bolhas vivem NO nivel da lamina de proposito — o contrato "o
    // liquido acha um nivel unico" e testado, e bolha e superficie, nao espuma
    // flutuando.
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let fx = 0; fx < FINE_COLS; fx++) {
      for (let fy = 0; fy < FINE_COLS; fy++) {
        const x = fx / F - half;
        const y = fy / F - half;
        const h = hash3d(fx, fy, 29, variant);
        boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, 'floor'));
        if (h % 89 === 0) {
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 1.5, 'rock'));
          continue;
        }
        // Reflexo em faixa fina na diagonal da projecao, nao pontos aleatorios.
        const band = (fx + fy + frame * 2) % FINE_COLS;
        // Bolha: acende dois quadros do ciclo e estoura.
        const bubble = h % 21 === 0 && ((h >>> 6) + frame) % 4 < 2;
        boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, bubble || band === 0 ? 'biolum' : 'pool'));
      }
    }
    return boxes;
  }

  if (kind === 'water') {
    // A mesma construcao da poca — leito plano, filme de meio voxel, reflexo em
    // faixa — com DUAS diferencas de leitura: a familia de cor e a azul da
    // rocha (agua nunca compartilha matiz com o fungo), e a ondulacao substitui
    // as bolhas. Agua parada nao ferve; ela ondula. A faixa `electric` anda com
    // o frame e uma segunda faixa defasada cruza na outra diagonal, entao o
    // lago inteiro parece respirar sem nenhum ponto piscando.
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let fx = 0; fx < FINE_COLS; fx++) {
      for (let fy = 0; fy < FINE_COLS; fy++) {
        const x = fx / F - half;
        const y = fy / F - half;
        const h = hash3d(fx, fy, 41, variant);
        boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, 'floor'));
        if (h % 97 === 0) {
          // Mineral azulado emergindo: a "ilha" que da escala ao lago.
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 1.5, 'rock'));
          continue;
        }
        const band = (fx + fy + frame * 2) % FINE_COLS;
        const cross = (fx - fy + FINE_COLS * 4 - frame * 3) % Math.floor(FINE_COLS / 2);
        const glint = band === 0 || (cross === 0 && (h & 3) === 0);
        boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, glint ? 'electric' : 'water'));
      }
    }
    return boxes;
  }

  if (kind === 'ember') {
    // A laje ja e a rocha escura da Fornalha; as FISSURAS correm por ela como
    // veios finos incandescentes. O trajeto sai de um hash por coluna — duas
    // diagonais quebradas por celula — e o PULSO e o quadro: o miolo alterna
    // entre brasa (`fire`) e nucleo saturado (`amber`, emissivo), com pontas
    // `blood` esfriando. Nada levanta acima de meio voxel: fissura e chao, nao
    // chama — a leitura de perigo vem da luz, nunca da silhueta.
    const boxes = slab(variant, 'scorch', 'floor');
    overSlab(variant, 131, ({ cx, cy, x, y, top, h }) => {
      // Duas linhas quebradas por celula: colunas cuja distancia a diagonal
      // (com um zigue por hash) e zero. Espessura de UMA coluna fina.
      const wob = (h >>> 7) % 2;
      const onVeinA = (cx + cy + wob) % Math.floor(FINE_COLS / 2) === 0;
      const onVeinB = (cx - cy + FINE_COLS * 2 + wob) % Math.floor(FINE_COLS / 2) === 3;
      if (!onVeinA && !onVeinB) return;
      if (h % 5 === 0) return; // falhas: a fissura e tracejada, nao um trilho
      // O pulso alterna brasa viva (`fire`, cujo topo emissivo e o amber) e
      // pontas esfriando (`blood`). No pico, o veio incha meio voxel — a
      // fissura respira sem nunca virar chama.
      const hot = ((h >>> 4) + frame) % 4;
      boxes.push(box(x, y, top, 1 / F, 1 / F, 0.5, hot === 3 ? 'blood' : 'fire'));
      if (hot === 0) boxes.push(box(x, y, top + 0.5, 1 / F, 1 / F, 0.5, 'fire'));
    });
    return boxes;
  }

  if (kind === 'ice') {
    // Placa leitosa que acha nivel, como os liquidos — mas SOLIDA: o filme tem
    // um voxel inteiro de altura e quase nenhum movimento. As rachaduras sao
    // colunas `rock` afundadas meio voxel; o reflexo e uma faixa `electric`
    // que anda UM passo entre os dois quadros, devagar como convem a uma
    // superficie que nao flui.
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let fx = 0; fx < FINE_COLS; fx++) {
      for (let fy = 0; fy < FINE_COLS; fy++) {
        const x = fx / F - half;
        const y = fy / F - half;
        const h = hash3d(fx, fy, 53, variant);
        boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, 'floor'));
        // Rachadura: fica meio voxel abaixo do topo da placa.
        if (h % 43 === 0) {
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, 'rock'));
          continue;
        }
        const band = (fx + fy + frame) % FINE_COLS;
        const sparkle = band === 0 && (h & 7) === 0;
        boxes.push(box(x, y, 1, 1 / F, 1 / F, 1, sparkle ? 'electric' : 'ice'));
      }
    }
    return boxes;
  }

  if (kind === 'silt') {
    // Areia solta: cobertura quase total sobre a laje, com ONDULACAO. A duna em
    // miniatura e o que faz a silica nao ler como "chao claro" — sem as cristas
    // ela vira uma laje bege e o rastro do Devorador some no cenario.
    //
    // A crista nao segue a diagonal da projecao: correndo no eixo X do mundo ela
    // sai obliqua na tela, e um campo de silica passa a ter direcao. O quadro
    // desloca a onda por UMA coluna fina — nao para animar vento (areia parada
    // nao anda), mas para os graos grossos trocarem de lugar e a superficie
    // parecer solta em vez de fundida.
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 149, ({ cx, cy, x, y, top, h }) => {
      if (h % 29 === 0) return; // rocha aparecendo: a camada e fina, nao infinita
      // Crista de duna a cada oito colunas finas, com DUAS de largura: no
      // periodo curto que isto tinha antes as cristas caiam quase coladas e o
      // olho lia ruido, nao ondulacao. Ondulacao precisa de vale.
      const ripple = (cx + ((h >>> 9) & 1)) % 8;
      // Grao grosso: uma coluna em sete sobe meio voxel a mais e sai em `bone`,
      // um degrau abaixo. E o que da textura sem custar altura.
      const coarse = ((h >>> 4) + frame) % 7 === 0;
      boxes.push(box(x, y, top, 1 / F, 1 / F, 0.5, coarse ? 'bone' : 'silt'));
      if (ripple < 2) boxes.push(box(x, y, top + 0.5, 1 / F, 1 / F, 0.5, 'silt'));
    });
    return boxes;
  }

  if (kind === 'glass') {
    // Placa vitrificada: LISA. A laje por baixo perde o cascalho de proposito —
    // o vidro e a unica crosta do jogo sem relevo nenhum, e e por isso que ela
    // le como "isto aqui esta selado" antes mesmo de o jogador saber a regra.
    //
    // O que quebra a lisura sao as FRATURAS: linhas retas e longas, ao contrario
    // das rachaduras espalhadas do gelo. Vidro trinca em reta; gelo estala em
    // ponto. E o reflexo e uma faixa continua que anda um passo entre os dois
    // quadros — brilho de placa polida, nao o cintilar do gelo.
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let fx = 0; fx < FINE_COLS; fx++) {
      for (let fy = 0; fy < FINE_COLS; fy++) {
        const x = fx / F - half;
        const y = fy / F - half;
        const h = hash3d(fx, fy, 151, variant);
        boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, 'floor'));
        // Duas fraturas retas por celula, com um zigue por variante. Elas
        // AFUNDAM meio voxel e saem em `rock`: a trinca e uma sombra dentro da
        // placa, nunca um friso por cima dela.
        const wob = (variant * 3) % 5;
        const cracked =
          (fx + fy + wob) % FINE_COLS === 0 || (fx - fy + FINE_COLS * 2 + wob) % FINE_COLS === 5;
        if (cracked && h % 4 !== 0) {
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, 'rock'));
          continue;
        }
        const band = (fx + fy * 2 + frame) % FINE_COLS;
        boxes.push(box(x, y, 1, 1 / F, 1 / F, 1, band === 0 ? 'electric' : 'glass'));
      }
    }
    return boxes;
  }

  if (kind === 'rail' || kind === 'rail-v') {
    // Trilho da operacao: chao nu com DORMENTES atravessados e dois frisos
    // `rust` continuos meio voxel acima. `rail` corre no eixo X do mundo;
    // `rail-v` e o mesmo desenho girado — a fisica nao distingue, o olho sim.
    // Falhas por hash nos frisos: linha morta, gasta, nao trilho novo.
    const vertical = kind === 'rail-v';
    const boxes = [];
    const half = SURFACE_COLS / 2;
    for (let fx = 0; fx < FINE_COLS; fx++) {
      for (let fy = 0; fy < FINE_COLS; fy++) {
        const x = fx / F - half;
        const y = fy / F - half;
        const h = hash3d(fx, fy, 61, variant);
        boxes.push(box(x, y, 0, 1 / F, 1 / F, 1, h % 6 === 0 ? 'rockDeep' : 'floor'));
        const along = vertical ? fy : fx;
        const across = vertical ? fx : fy;
        // Dormentes: faixas de osso atravessadas, com folga nas pontas.
        if (along % 6 < 2 && across >= 2 && across <= FINE_COLS - 3 && h % 11 !== 0) {
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, 'bone'));
        }
        // Os dois frisos, por cima de tudo — gastos: falha 1 em 9.
        if ((across === 4 || across === 11) && h % 9 !== 0) {
          boxes.push(box(x, y, 1, 1 / F, 1 / F, 1, 'rust'));
        }
      }
    }
    return boxes;
  }

  if (kind === 'gas') return gasModel(variant, frame);

  if (kind === 'spores') {
    const boxes = slab(variant, 'floor', 'rockDeep');
    overSlab(variant, 73, ({ cx, cy, x, y, h }) => {
      // Esporos sao graos organicos em suspensao, nao tapete e nao enxofre. A
      // nuvem fica mais baixa e lateral que o gas, com pequenos pares que o olho
      // agrupa como uma massa verde liberada pelo bomber. Grao FINO: um esporo
      // e o menor solido do jogo, e o modulo alto compensa a grade com quatro
      // vezes mais colunas — a nuvem continua com a mesma massa contada.
      const phase = (cx * 5 + cy * 3 + frame * 2 + (h >>> 8)) % 59;
      if (phase > 1) return;
      const z = 3 + ((h >>> 5) % 5) * 0.5;
      boxes.push(box(x, y, z, 1 / F, 1 / F, 0.5, phase === 0 ? 'fungus' : 'fungusDeep'));
      if (phase === 0 && z < 5 && ((h >>> 3) & 1) === 0) {
        boxes.push(box(x, y, z + 0.5, 1 / F, 1 / F, 0.5, 'fungus'));
      }
    });
    return boxes;
  }

  if (kind === 'fire') {
    // A chama queima o que esta embaixo: a laje ja e a cinza que vai sobrar.
    // Linguas FINAS de meio voxel, mais numerosas que as antigas na mesma massa
    // total: fogo e a materia que mais ganha com o grao novo, porque lingua de
    // chama e exatamente o que nao pode ser um cubo gordo.
    const boxes = slab(variant, 'scorch', 'floor');
    overSlab(variant, 61, ({ cx, cy, x, y, h }) => {
      const phase = (cx * 2 + cy * 3 + frame) % 7;
      if (phase > 1) return;
      const core = h % 4 === 0;
      if (core) boxes.push(box(x, y, 1, 1 / F, 1 / F, 0.5, 'blood'));
      boxes.push(box(x, y, core ? 1.5 : 1, 1 / F, 1 / F, 0.5 + ((h >>> 6) % 3) * 0.5, 'fire'));
    });
    return boxes;
  }

  throw new Error(`tipo de superficie desconhecido: ${kind}`);
};

/**
 * Extensao projetada de qualquer crosta, para dimensionar frame e ancora.
 * Medida por modelBounds, na mesma grade fina que o rasterizador pinta —
 * projetar a coordenada autorada a mao mentiria por um fator de MODEL_SCALE.
 */
export const surfaceBounds = () => {
  let acc;
  for (const kind of SURFACE_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < kind.frames; frame++) {
        acc = modelBounds(surfaceModel(kind.name, variant, frame), acc);
      }
    }
  }
  return acc;
};

/**
 * Renderiza todos os frames, na ordem em que `resolveSurface` os indexa:
 * tipos em sequencia, e dentro de cada tipo variante -> quadro -> nivel de luz.
 */
export const buildSurfaceFrames = (frameW, frameH, anchorX, anchorY) => {
  const frames = [];
  for (const kind of SURFACE_KINDS) {
    for (let variant = 0; variant < VARIANTS; variant++) {
      for (let frame = 0; frame < kind.frames; frame++) {
        const lit = renderVoxels(
          surfaceModel(kind.name, variant, frame),
          DIR_UNROTATED,
          frameW,
          frameH,
          anchorX,
          anchorY
        );
        // Chao e parede escurecem na mesma escala para nao abrir costura visual.
        for (let level = 0; level < LIGHT_LEVELS; level++) frames.push(dim(lit, lightFactor(level)));
      }
    }
  }
  return frames;
};

export const SURFACE_COLORS = COLORS;
