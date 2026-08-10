// Art Bible validator for generated sprite atlases.
import { PNG } from 'pngjs';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_HEX, COLORS } from './lib.mjs';
import { ANIM_ORDER } from './entities.mjs';
import { lightFactor } from './terrain.mjs';
import { SURFACE_KINDS } from './surfaces.mjs';
import { PROP_KINDS } from './props.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, '../assets/atlases');
const CANONICAL = {
  // O bot PX e mais largo e mais alto que o mineiro de macacao que ele
  // substitui: chassi de 280 kg e uma passada que joga o pe tres voxels a frente
  // do corpo. Continua abaixo do Miner (96x120), que e o Prospector degradado e
  // grande demais — se os dois medissem o mesmo, a leitura do encontro se perde.
  //
  // Todos os canvases DOBRARAM com a subdivisao da grade voxel (MODEL_SCALE):
  // mesma proporcao entre entidades e com o tile, o dobro de pixels de detalhe.
  'player-prospector': [88, 112],
  'enemy-stalker': [64, 64],
  'enemy-spitter': [64, 64],
  'enemy-spore-bomber': [64, 64],
  'enemy-bruiser': [96, 136],
  // O chefe final tem o unico canvas 112x128 do bestiario: a hierarquia de
  // tamanho sobre o Britador e contrato, nao acidente.
  'enemy-guardian': [112, 128],
  'fx-projectile-bolt': [32, 32],
  'fx-impact-burst': [32, 32],
  'fx-seeker-drone': [32, 32],
  'fx-fire-cyclone': [32, 32],
};
const REQUIRED_LIVING = ['idle', 'walk', 'attack', 'hit', 'die'];
/**
 * Sprites que legitimamente nao tem `walk`, com o motivo escrito.
 *
 * A regra por tras da lista: `walk` e obrigatorio porque a falta dele quase
 * sempre e um esquecimento, e o cliente cai calado em `idle` — a criatura anda
 * pelo mapa parada e ninguem e avisado. Nao e obrigatorio quando a SIMULACAO
 * garante que a marcha nunca vai ser pedida. Os dois abaixo tem `speed: 0` em
 * ARCHETYPES: estao ancorados no chao e a luta contra eles e contra a sala.
 * Assar 24 quadros de caminhada para eles seria textura que nenhum frame do
 * jogo chega a amostrar.
 *
 * Entrar nesta lista exige a mesma conferencia: se um dia um deles ganhar
 * velocidade, o atlas volta a precisar de marcha e a linha sai daqui.
 */
const ANCHORED_NO_WALK = new Set(['enemy-lung-matrix', 'enemy-furnace-heart']);
/**
 * Teto de cores por atlas, incluindo o contorno.
 *
 * Era 16, o tamanho da paleta mestra de entao. A paleta cresceu para 22 ao
 * ganhar seis degraus intermediarios — meios-tons que fecham vaos de ate 51
 * pontos de luminancia dentro de uma mesma rampa —, e manter o teto em 16
 * proibiria justamente o uso daqueles degraus: o Prospector e o Miner passam de
 * 16 sem nenhuma cor nova de MATERIA, so com os meios-tons das cores que eles ja
 * usavam.
 *
 * 20 e nao 22 de proposito. O teto existe para impedir que uma peca sozinha
 * gaste a paleta inteira, e isso continua valendo — o que ele nao pode e ser
 * apertado a ponto de tornar a propria escala de valor inutilizavel.
 */
const MAX_ATLAS_COLORS = 20;
const MAX_ATLAS_WIDTH = 4096;
/**
 * Orcamentos revisados junto com a subdivisao da grade (MODEL_SCALE): a area
 * de todo atlas quadruplicou, entao os tetos antigos (512 KiB por PNG, 2,5 MiB
 * de transferencia, 24 MiB de RGBA) passariam a rejeitar o pacote inteiro por
 * definicao. Os novos valores dao ~2x de folga sobre o pacote medido no dia da
 * mudanca (maior PNG 675 KiB, total ~3,1 MiB, RGBA ~68 MiB) — apertados o
 * bastante para um atlas fora da curva continuar sendo barrado.
 *
 * Segunda revisao (estratos, leva 2): o atlas de crostas ganhou tres materias
 * de mundo — agua, fissura incandescente e gelo — e foi de 28 para 34 quadros
 * autorados (1,18 MiB). Mesmo criterio de sempre: teto novo com folga curta
 * sobre o medido (~25%), porque crescer por materia nova e o caminho esperado
 * do jogo, e um atlas 50% acima da curva continua sendo um erro a barrar.
 *
 * Terceira revisao (portais por bioma + fauna afinada): o world-props passou a
 * carregar dez portais animados e o bestiario ganhou dois corpos (Bombardeiro
 * de Enxofre e Coveiro). So o teto de RGBA se move, e ele so se moveu DEPOIS
 * de o desperdicio ser pago: o Coveiro nascera num canvas de 96x120 herdado do
 * Miner com 37px de margem morta no topo, e apertar o canvas ao conteudo real
 * (72x88) devolveu 2,8 MiB — mais do que o proprio bicho custa agora. O teto
 * sobe de 96 para 112 MiB sobre um pacote medido de ~98 MiB: folga de ~14%,
 * mais curta que a das revisoes anteriores justamente porque o pacote esta
 * grande. Um atlas fora da curva continua sendo barrado, e a proxima materia
 * nova volta a exigir esta mesma conversa — que e o ponto do orcamento.
 *
 * Quarta revisao (os oito chefes): e esta a conversa que a revisao anterior
 * marcou. O bestiario tinha dois chefes autorados e passou a ter dez — os oito
 * que faltavam desenhavam pelo recuo do cliente, isto e, nao desenhavam. Sao os
 * sprites mais caros do pacote por definicao: canvas grande porque a criatura e
 * grande, e quatro direcoes como todo mundo. Medido: +1,7 MiB de PNG e +41 MiB
 * de RGBA, para um pacote de ~7,3 MiB e ~145 MiB.
 *
 * O desperdicio foi pago primeiro, como da outra vez. Todo canvas de chefe e
 * calculado a partir da caixa envolvente medida dos proprios quadros (conteudo
 * + 2px de margem, nunca um numero redondo herdado de outro bicho), e os dois
 * chefes ANCORADOS nao levam marcha — 24 quadros por atlas que a simulacao,
 * com `speed: 0`, nunca chegaria a pedir. Sem essas duas medidas o pacote
 * fecharia perto de 160 MiB.
 *
 * Os tetos vao a 10 MiB e 160 MiB, folga de ~10% sobre o medido — a mais curta
 * ate hoje, e de proposito. E aqui que este orcamento para de ser um numero e
 * vira uma decisao de arquitetura: TODO atlas e carregado no boot, e um chefe
 * so pode existir no setor final de uma run. Dez atlas de chefe na memoria para
 * desenhar no maximo um e o desperdicio que o teto agora esta encostando. A
 * proxima adicao de peso nao deve ser paga com outro aumento — deve ser paga
 * com carregamento sob demanda, que e o que remove os nove chefes que a run nao
 * vai encontrar.
 *
 * ---------------------------------------------------------------------------
 * E A PROXIMA ADICAO VEIO: o MAPA DE FACES (`*.normal.png`)
 * ---------------------------------------------------------------------------
 * A normal por pixel de cada sprite, para a luz do mundo bater no lado certo do
 * corpo. Medido: +0,8 MiB de PNG e +26 MiB de RGBA — o que estouraria os 160
 * MiB em 12 MiB.
 *
 * O teto NAO subiu. A regra escrita acima foi seguida a letra: o peso novo e
 * pago com carregamento SOB DEMANDA. Nenhum mapa de faces e carregado no boot;
 * cada um chega na primeira vez que aquele arquetipo e desenhado sob luz
 * colorida, e ate chegar o sprite recebe a iluminacao por silhueta de antes —
 * que continua correta, so menos informativa. Um bicho que a run nao encontra
 * nao custa um byte.
 *
 * Por isso ha DOIS orcamentos daqui em diante. O de boot continua sendo o que
 * aperta, e continua em 160 MiB, sem folga nova. O sob demanda tem teto proprio
 * e mais largo, porque o pior caso dele — o jogador encontrar todo arquetipo do
 * jogo numa sessao — e raro e chega gradualmente, em vez de tudo na tela de
 * carregamento.
 */
const MAX_PNG_BYTES = 1536 * 1024;
const MAX_TOTAL_PNG_BYTES = 10 * 1024 * 1024;
const MAX_DECODED_BYTES = 160 * 1024 * 1024;
/** Teto do que chega DEPOIS do boot, um arquetipo por vez. */
const MAX_ON_DEMAND_DECODED_BYTES = 48 * 1024 * 1024;

const toHex = (r, g, b) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
const framePixels = (png, m, index) => {
  const pixels = [];
  const columns = m.columns ?? Number.MAX_SAFE_INTEGER;
  const x0 = (index % columns) * m.frameWidth;
  const y0 = Math.floor(index / columns) * m.frameHeight;
  for (let y = 0; y < m.frameHeight; y++) {
    for (let x = 0; x < m.frameWidth; x++) {
      const i = ((y0 + y) * png.width + x0 + x) * 4;
      pixels.push([x, y, png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]]);
    }
  }
  return pixels;
};

export const validateManifest = (id) => {
  const errors = [];
  const jsonPath = resolve(DIR, `${id}.json`);
  if (!existsSync(jsonPath)) return [`${id}: manifest ausente`];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`${id}: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));
  const anims = ANIM_ORDER.filter((a) => m.animations[a]);
  const framesPerDir = anims.reduce((s, a) => s + m.animations[a].frames, 0);
  const totalFrames = framesPerDir * m.authoredDirs.length;
  const columns = m.columns ?? totalFrames;
  const expectedW = Math.min(totalFrames, columns) * m.frameWidth;
  const expectedRows = Math.ceil(totalFrames / columns);
  const expectedH = expectedRows * m.frameHeight;

  const canonical = CANONICAL[id];
  if (canonical && (m.frameWidth !== canonical[0] || m.frameHeight !== canonical[1])) {
    errors.push(`${id}: canvas ${m.frameWidth}x${m.frameHeight} != canônico ${canonical[0]}x${canonical[1]}`);
  }
  if (png.width !== expectedW) errors.push(`${id}: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`${id}: altura ${png.height} != ${expectedH}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`${id}: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push(`${id}: PNG excede o teto de 1,5 MiB`);
  if (!(m.anchorX >= 0 && m.anchorX < m.frameWidth)) errors.push(`${id}: anchorX fora do frame`);
  if (!(m.anchorY >= 0 && m.anchorY < m.frameHeight)) errors.push(`${id}: anchorY fora do frame`);
  if (!m.footprint || !['w', 'h', 'offsetX', 'offsetY'].every((k) => Number.isFinite(m.footprint[k]))) {
    errors.push(`${id}: footprint inválido`);
  } else if (m.footprint.w < 0 || m.footprint.h < 0) errors.push(`${id}: footprint negativo`);

  if (id.startsWith('player-') || id.startsWith('enemy-')) {
    for (const a of REQUIRED_LIVING) {
      if (a === 'walk' && ANCHORED_NO_WALK.has(id)) continue;
      if (!m.animations[a]) errors.push(`${id}: animação obrigatória ausente: ${a}`);
    }
    if (m.directions !== 4) errors.push(`${id}: entidade viva deve declarar 4 direções`);
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      if (!m.authoredDirs.includes(dir) && !m.flipPairs[dir]) errors.push(`${id}: direção ${dir} não resolvível`);
    }
  }

  for (const dir of m.authoredDirs) {
    if (!m.frameMap[dir]) errors.push(`${id}: frameMap sem ${dir}`);
    else for (const a of anims) if (m.frameMap[dir][a] === undefined) errors.push(`${id}: frameMap[${dir}] sem ${a}`);
  }
  for (const [dst, src] of Object.entries(m.flipPairs)) {
    if (!m.authoredDirs.includes(src)) errors.push(`${id}: flipPairs.${dst} -> ${src} não autorada`);
  }

  const atlasColors = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    // Current engine contract is binary alpha for every atlas. Any translucent cloud
    // must live in a separate runtime FX system rather than the entity sheet.
    if (alpha !== 0 && alpha !== 255) {
      errors.push(`${id}: alpha parcial (${alpha}) no pixel ${i}`);
      break;
    }
    if (alpha === 255) {
      const hex = toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]);
      atlasColors.add(hex);
      if (!ALLOWED_HEX.has(hex)) errors.push(`${id}: cor ${hex} fora da paleta mestra`);
    }
  }
  if (atlasColors.size > MAX_ATLAS_COLORS) {
    errors.push(`${id}: usa ${atlasColors.size} cores; máximo é ${MAX_ATLAS_COLORS} incluindo outline`);
  }
  for (const hex of atlasColors) if (!m.paletteColors.includes(hex)) errors.push(`${id}: cor ${hex} não declarada`);
  for (const hex of m.paletteColors) if (!atlasColors.has(hex)) errors.push(`${id}: cor declarada ${hex} não usada`);

  for (const dir of m.authoredDirs) {
    for (const anim of anims) {
      const start = m.frameMap[dir][anim];
      const count = m.animations[anim].frames;
      let previousBox = null;
      for (let f = 0; f < count; f++) {
        const pixels = framePixels(png, m, start + f);
        const opaque = pixels.filter((p) => p[5] !== 0);
        if (opaque.length === 0) {
          errors.push(`${id}: frame vazio em ${dir}/${anim}/${f}`);
          continue;
        }
        const xs = opaque.map((p) => p[0]);
        const ys = opaque.map((p) => p[1]);
        const box = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
        if (box.minX === 0 || box.maxX === m.frameWidth - 1 || box.minY === 0 || box.maxY === m.frameHeight - 1) {
          errors.push(`${id}: conteúdo toca borda em ${dir}/${anim}/${f}`);
        }
        if (previousBox && ['idle', 'walk', 'hit'].includes(anim)) {
          // 6px de atlas = os mesmos 3px logicos de antes da subdivisao.
          const cx = (box.minX + box.maxX) / 2;
          const pcx = (previousBox.minX + previousBox.maxX) / 2;
          if (Math.abs(cx - pcx) > 6) errors.push(`${id}: jitter horizontal >6px em ${dir}/${anim}/${f}`);
        }
        previousBox = box;
      }
    }
  }
  return [...new Set(errors)];
};

/**
 * O atlas de terreno tem regras proprias: os niveis de luz sao assados, entao as
 * cores NAO sao a paleta mestra pura — sao multiplos dela. O que precisa valer e
 * que toda cor derive de uma cor da paleta por um dos fatores de luz assados, e
 * que o atlas caiba na textura.
 */
export const validateTerrain = () => {
  const errors = [];
  const jsonPath = resolve(DIR, 'terrain-blocks.json');
  if (!existsSync(jsonPath)) return ['terrain-blocks: manifest ausente'];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`terrain-blocks: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));

  const total = m.kinds.length * m.variants * m.lightLevels;
  const expectedW = Math.min(total, m.columns) * m.frameWidth;
  const expectedH = Math.ceil(total / m.columns) * m.frameHeight;
  if (png.width !== expectedW) errors.push(`terrain-blocks: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`terrain-blocks: altura ${png.height} != ${expectedH}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`terrain-blocks: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push('terrain-blocks: PNG excede o teto de 1,5 MiB');
  if (!(m.originX >= 0 && m.originX < m.frameWidth)) errors.push('terrain-blocks: originX fora do frame');
  if (!(m.originY >= 0 && m.originY < m.frameHeight)) errors.push('terrain-blocks: originY fora do frame');

  const derived = bakedPalette(m.lightLevels);
  const seen = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    if (alpha !== 0 && alpha !== 255) { errors.push(`terrain-blocks: alpha parcial (${alpha})`); break; }
    if (alpha === 255) seen.add(toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]));
  }
  for (const hex of seen) if (!derived.has(hex)) errors.push(`terrain-blocks: cor ${hex} nao deriva da paleta mestra`);

  // Cada frame tem de ter conteudo: um bloco vazio vira buraco no cenario.
  for (let index = 0; index < total; index++) {
    const x0 = (index % m.columns) * m.frameWidth;
    const y0 = Math.floor(index / m.columns) * m.frameHeight;
    let opaque = 0;
    for (let y = 0; y < m.frameHeight && opaque === 0; y++) {
      for (let x = 0; x < m.frameWidth; x++) {
        if (png.data[((y0 + y) * png.width + x0 + x) * 4 + 3] !== 0) { opaque++; break; }
      }
    }
    if (opaque === 0) errors.push(`terrain-blocks: frame ${index} vazio`);
  }
  return [...new Set(errors)];
};

/**
 * Cores derivadas: toda cor assada tem de ser uma cor da paleta mestra
 * multiplicada por um dos fatores de luz. Assim uma cor inventada a mao nao
 * entra num atlas sem passar pelo gerador.
 */
const bakedPalette = (lightLevels) => {
  const derived = new Set();
  for (let level = 0; level < lightLevels; level++) {
    // Importado do gerador, nao copiado: uma formula duplicada aqui deixaria a
    // validacao passar em silencio depois de mudarem os niveis de luz.
    const f = lightFactor(level);
    for (const [r, g, b] of Object.values(COLORS)) {
      derived.add(toHex(
        Math.max(0, Math.min(255, Math.round(r * f))),
        Math.max(0, Math.min(255, Math.round(g * f))),
        Math.max(0, Math.min(255, Math.round(b * f)))
      ));
    }
  }
  return derived;
};

/**
 * O atlas de crostas de chao segue as regras do terreno mais uma: o numero de
 * quadros varia POR TIPO, entao a contagem total nao sai de uma multiplicacao.
 * O manifest tem de declarar exatamente os tipos que o gerador conhece — um
 * `frames` divergente nao quebraria nada de forma visivel, so faria o cliente
 * recortar o frame do tipo vizinho e pintar o chao com o material errado.
 */
export const validateSurfaces = () => {
  const errors = [];
  const jsonPath = resolve(DIR, 'surface-tiles.json');
  if (!existsSync(jsonPath)) return ['surface-tiles: manifest ausente'];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`surface-tiles: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));

  if (m.kinds.length !== SURFACE_KINDS.length) {
    errors.push(`surface-tiles: ${m.kinds.length} tipos declarados, gerador tem ${SURFACE_KINDS.length}`);
  }
  m.kinds.forEach((kind, i) => {
    const spec = SURFACE_KINDS[i];
    if (!spec) return;
    if (kind.name !== spec.name) errors.push(`surface-tiles: tipo ${i} e ${kind.name}, esperado ${spec.name}`);
    if (kind.frames !== spec.frames) errors.push(`surface-tiles: ${kind.name} declara ${kind.frames} quadros, gerador faz ${spec.frames}`);
    if (kind.frames > 1 && !(kind.frameMs > 0)) errors.push(`surface-tiles: ${kind.name} anima sem frameMs`);
  });

  const total = m.kinds.reduce((sum, k) => sum + k.frames * m.variants * m.lightLevels, 0);
  const expectedW = Math.min(total, m.columns) * m.frameWidth;
  const expectedH = Math.ceil(total / m.columns) * m.frameHeight;
  if (png.width !== expectedW) errors.push(`surface-tiles: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`surface-tiles: altura ${png.height} != ${expectedH}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`surface-tiles: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push('surface-tiles: PNG excede o teto de 1,5 MiB');
  if (!(m.originX >= 0 && m.originX < m.frameWidth)) errors.push('surface-tiles: originX fora do frame');
  if (!(m.originY >= 0 && m.originY < m.frameHeight)) errors.push('surface-tiles: originY fora do frame');

  const derived = bakedPalette(m.lightLevels);
  const seen = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    // O ponto do atlas inteiro: o gas antigo era um `rgba()` translucido, e a
    // troca foi por ocupacao esparsa de voxels opacos. Um pixel semitransparente
    // aqui significa que o alpha voltou por alguma porta.
    if (alpha !== 0 && alpha !== 255) { errors.push(`surface-tiles: alpha parcial (${alpha})`); break; }
    if (alpha === 255) seen.add(toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]));
  }
  for (const hex of seen) if (!derived.has(hex)) errors.push(`surface-tiles: cor ${hex} nao deriva da paleta mestra`);

  // Cada frame tem de ter conteudo: uma crosta vazia vira buraco no chao.
  for (let index = 0; index < total; index++) {
    const x0 = (index % m.columns) * m.frameWidth;
    const y0 = Math.floor(index / m.columns) * m.frameHeight;
    let opaque = 0;
    for (let y = 0; y < m.frameHeight && opaque === 0; y++) {
      for (let x = 0; x < m.frameWidth; x++) {
        if (png.data[((y0 + y) * png.width + x0 + x) * 4 + 3] !== 0) { opaque++; break; }
      }
    }
    if (opaque === 0) errors.push(`surface-tiles: frame ${index} vazio`);
  }
  return [...new Set(errors)];
};

export const listIds = () => JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')).ids;

/**
 * O atlas de objetos de mundo nao tem variante nem nivel de luz: sao pecas
 * unicas e autoluminosas. O que precisa valer e que o manifest concorde com o
 * gerador quadro a quadro, e que nenhum quadro saia vazio — um Nucleo invisivel
 * deixaria a run sem objetivo visivel e sem nenhum erro na tela.
 */
export const validateProps = () => {
  const errors = [];
  const jsonPath = resolve(DIR, 'world-props.json');
  if (!existsSync(jsonPath)) return ['world-props: manifest ausente'];
  const m = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const pngPath = resolve(DIR, m.atlas);
  if (!existsSync(pngPath)) return [`world-props: atlas ${m.atlas} ausente`];
  const png = PNG.sync.read(readFileSync(pngPath));

  if (m.kinds.length !== PROP_KINDS.length) {
    errors.push(`world-props: ${m.kinds.length} tipos declarados, gerador tem ${PROP_KINDS.length}`);
  }
  m.kinds.forEach((kind, i) => {
    const spec = PROP_KINDS[i];
    if (!spec) return;
    if (kind.name !== spec.name) errors.push(`world-props: tipo ${i} e ${kind.name}, esperado ${spec.name}`);
    if (kind.frames !== spec.frames) errors.push(`world-props: ${kind.name} declara ${kind.frames} quadros, gerador faz ${spec.frames}`);
    if (kind.frames > 1 && !(kind.frameMs > 0)) errors.push(`world-props: ${kind.name} anima sem frameMs`);
  });

  const total = m.kinds.reduce((sum, k) => sum + k.frames, 0);
  const expectedW = Math.min(total, m.columns) * m.frameWidth;
  const expectedH = Math.ceil(total / m.columns) * m.frameHeight;
  if (png.width !== expectedW) errors.push(`world-props: largura ${png.width} != ${expectedW}`);
  if (png.height !== expectedH) errors.push(`world-props: altura ${png.height} != ${expectedH}`);
  if (png.width > MAX_ATLAS_WIDTH) errors.push(`world-props: largura ${png.width} excede ${MAX_ATLAS_WIDTH}`);
  if (statSync(pngPath).size > MAX_PNG_BYTES) errors.push('world-props: PNG excede o teto de 1,5 MiB');
  if (!(m.originX >= 0 && m.originX < m.frameWidth)) errors.push('world-props: originX fora do frame');
  if (!(m.originY >= 0 && m.originY < m.frameHeight)) errors.push('world-props: originY fora do frame');

  const seen = new Set();
  for (let i = 0; i < png.width * png.height; i++) {
    const alpha = png.data[i * 4 + 3];
    if (alpha !== 0 && alpha !== 255) { errors.push(`world-props: alpha parcial (${alpha})`); break; }
    if (alpha === 255) seen.add(toHex(png.data[i * 4], png.data[i * 4 + 1], png.data[i * 4 + 2]));
  }
  // Autoluminoso: as cores saem da paleta mestra SEM escurecimento assado.
  for (const hex of seen) if (!ALLOWED_HEX.has(hex)) errors.push(`world-props: cor ${hex} fora da paleta mestra`);

  for (let index = 0; index < total; index++) {
    const x0 = (index % m.columns) * m.frameWidth;
    const y0 = Math.floor(index / m.columns) * m.frameHeight;
    let opaque = 0;
    for (let y = 0; y < m.frameHeight && opaque === 0; y++) {
      for (let x = 0; x < m.frameWidth; x++) {
        if (png.data[((y0 + y) * png.width + x0 + x) * 4 + 3] !== 0) { opaque++; break; }
      }
    }
    if (opaque === 0) errors.push(`world-props: frame ${index} vazio`);
  }
  return [...new Set(errors)];
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = listIds();
  let totalErrors = 0;
  let totalBytes = 0;
  let decodedBytes = 0;
  let onDemandDecodedBytes = 0;
  // Terreno e chao ficam FORA do index de sprites: nao tem animacao por
  // direcao, nem frameMap, e o validador de personagem tentaria le-los assim.
  for (const [id, run] of [['terrain-blocks', validateTerrain], ['surface-tiles', validateSurfaces], ['world-props', validateProps]]) {
    const errs = run();
    totalErrors += errs.length;
    if (errs.length === 0) console.log(`  OK ${id}`);
    else for (const e of errs) console.error(`  FAIL ${e}`);
    const path = resolve(DIR, `${id}.png`);
    if (existsSync(path)) {
      totalBytes += statSync(path).size;
      const decoded = PNG.sync.read(readFileSync(path));
      decodedBytes += decoded.width * decoded.height * 4;
    }
  }
  for (const id of ids) {
    const errs = validateManifest(id);
    totalErrors += errs.length;
    const m = JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8'));
    const pngPath = resolve(DIR, m.atlas);
    if (existsSync(pngPath)) {
      totalBytes += statSync(pngPath).size;
      const png = PNG.sync.read(readFileSync(pngPath));
      decodedBytes += png.width * png.height * 4;
    }
    // O MAPA DE FACES conta no mesmo orcamento.
    //
    // Ele nao e arte e nao passa pela conferencia de paleta — sao tres cores
    // que nao existem na paleta mestra de proposito —, mas ocupa memoria de
    // video exatamente como qualquer outro atlas, e um teto que ignora metade
    // do que o jogo carrega nao e um teto. E por isso que ele sai em meia
    // resolucao: em resolucao cheia, sozinho, estouraria o limite.
    if (m.normalAtlas) {
      const normalPath = resolve(DIR, m.normalAtlas);
      if (!existsSync(normalPath)) {
        console.error(`  FAIL ${id}: manifest declara ${m.normalAtlas}, que nao existe`);
        totalErrors++;
      } else {
        totalBytes += statSync(normalPath).size;
        const normal = PNG.sync.read(readFileSync(normalPath));
        onDemandDecodedBytes += normal.width * normal.height * 4;
      }
    }
    if (errs.length === 0) console.log(`  OK ${id}`);
    else for (const e of errs) console.error(`  FAIL ${e}`);
  }
  if (totalBytes > MAX_TOTAL_PNG_BYTES) {
    console.error(`  FAIL total PNG ${totalBytes} > ${MAX_TOTAL_PNG_BYTES}`);
    totalErrors++;
  }
  if (decodedBytes > MAX_DECODED_BYTES) {
    console.error(`  FAIL memória decodificada (boot) ${decodedBytes} > ${MAX_DECODED_BYTES}`);
    totalErrors++;
  }
  if (onDemandDecodedBytes > MAX_ON_DEMAND_DECODED_BYTES) {
    console.error(
      `  FAIL memória decodificada (sob demanda) ${onDemandDecodedBytes} > ${MAX_ON_DEMAND_DECODED_BYTES}`
    );
    totalErrors++;
  }
  console.log(
    `\nPNG total: ${totalBytes} bytes; memória RGBA no boot: ${decodedBytes} bytes;` +
      ` sob demanda: ${onDemandDecodedBytes} bytes`
  );
  if (totalErrors) process.exit(1);
  console.log(`${ids.length} sprites válidos.`);
}
