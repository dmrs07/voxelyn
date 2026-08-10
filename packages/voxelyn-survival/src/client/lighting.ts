// LUZ QUE TEM COR, E MATERIA QUE RESPONDE A ELA.
//
// ---------------------------------------------------------------------------
// O QUE HAVIA
// ---------------------------------------------------------------------------
// Uma lista de luzes `{x, y, r, power}` — sem cor — e uma funcao `brightness`
// que devolvia UM escalar por celula, o maximo entre todas elas. Esse escalar
// escolhia um dos oito niveis de luz ja assados no atlas. Funcionava, e a
// disciplina de paleta da art bible saia de graca: nenhuma cor nova entrava no
// jogo, porque o atlas ja trazia cada bloco pintado nos oito niveis.
//
// O que ele NAO conseguia dizer:
//
//   - de QUE COR era a luz. Uma poca de fogo deixava o cristal azul mais azul,
//     em vez de alaranja-lo. Toda fonte do jogo iluminava do mesmo jeito;
//   - de QUE LADO ela vinha. Um bloco recebia o mesmo valor nas tres faces, e
//     uma parede iluminada por uma explosao a leste ficava igual a uma
//     iluminada por outra a oeste;
//   - QUEM estava iluminado. Sprites nunca consultavam a luz para a COR — o
//     brilho so decidia se a criatura aparecia (`b <= 0.05` some). O Prospector
//     local era desenhado em opacidade cheia, sempre, no meio de qualquer
//     incendio;
//   - e o tiro nao emitia nada. O objeto mais brilhante da tela, aquele que o
//     jogador dispara dezenas de vezes por minuto, nao acendia um pixel do
//     mundo por onde passava.
//
// ---------------------------------------------------------------------------
// O QUE ESTE MODULO FAZ
// ---------------------------------------------------------------------------
// Duas coisas, e a separacao entre elas e o desenho todo:
//
// 1. INTENSIDADE continua sendo o maximo escalar de antes, e continua
//    escolhendo o nivel assado. Nao se toca nela. Os oito degraus foram
//    calibrados contra a queda LINEAR da lista antiga, e trocar a curva por
//    baixo deles re-iluminaria toda caverna ja existente do jogo como efeito
//    colateral de acrescentar cor. Acrescentar nao pode reescrever.
//
// 2. IRRADIANCIA COLORIDA e nova, e por isso pode ser fisica desde o inicio.
//    E acumulada como VETOR — soma de (contribuicao x direcao unitaria ate a
//    fonte), a mesma ideia da banda linear de harmonicos esfericos que os
//    renderizadores usam para luz indireta. Com o vetor, cada face pergunta o
//    proprio N.L e recebe o que a geometria dela manda receber, sem guardar
//    lista de luz nenhuma.
//
// A queda da parte colorida e a INVERSA DO QUADRADO com janela — a forma
// padrao (Frostbite/UE4) de usar `1/d^2` sem a singularidade em zero e com
// alcance finito de verdade:
//
//     att = clamp(1 - (d/r)^4)^2 / (d^2 + 1)
//
// O `+1` no denominador tira o infinito no centro; a janela elevada ao quadrado
// leva a contribuicao a exatamente zero no raio, em vez de cortar num degrau
// que apareceria como um circulo desenhado no chao.
//
// ---------------------------------------------------------------------------
// ESPALHAR, E NAO COLHER
// ---------------------------------------------------------------------------
// A `brightness` antiga percorria TODAS as luzes para CADA celula visivel. Com
// fogo e cristal empurrando uma luz por celula acesa, uma sala em chamas
// chegava a centenas de luzes vezes vinte mil celulas por quadro.
//
// Aqui a conta e virada: cada luz escreve nas celulas do proprio raio, uma vez,
// e a consulta vira leitura de indice. Uma poca de fogo (raio 4) toca ~50
// celulas em vez de participar de 20.000 comparacoes. E o que torna a cor
// pagavel — ela sai praticamente de graca no mesmo passe.

/** Cor de luz sem cor: nao tinge nada, so ilumina. E a lanterna do chassi. */
export const LIGHT_NEUTRAL = '#ffffff';

export type WorldLight = {
  x: number;
  y: number;
  /** Alcance em tiles. Fora dele a contribuicao e exatamente zero. */
  r: number;
  /** Forca no centro, 0..1. */
  power: number;
  /** Cor da fonte, em hex. `LIGHT_NEUTRAL` para luz branca. */
  hex: string;
  /**
   * Altura da fonte acima do plano do chao, em tiles.
   *
   * E o que da ao piso um N.L honesto: uma luz rasteira ilumina o chao logo
   * abaixo dela e passa a raspar conforme se afasta, que e a razao fisica de
   * uma poca de fogo iluminar um circulo pequeno e brilhante em vez de um disco
   * chapado do tamanho do alcance.
   */
  height: number;
};

/** Como um material devolve a luz que recebe. */
export type MaterialResponse = {
  /**
   * Cor propria do material, em hex. A luz refletida e o produto dela pela cor
   * da fonte — e por isso que uma explosao alaranjada sobre rocha cinza da
   * cinza-alaranjado, e sobre cristal azul da quase nada: azul nao tem o que
   * devolver de vermelho.
   */
  albedo: string;
  /**
   * De fosco (0) a espelhado (1).
   *
   * Fosco espalha a luz por igual e recebe um veu largo e fraco; polido
   * concentra, e recebe um realce menor e mais forte no mesmo lugar. E a
   * diferenca entre a rocha da parede e o gelo da Cripta recebendo o MESMO
   * clarao.
   */
  gloss: number;
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Atenuacao fisica com alcance finito. Ver o cabecalho.
 *
 * Pura e exportada porque e a unica parte do modulo que faz uma afirmacao sobre
 * o mundo — o teste cobra as tres propriedades que importam: vale 1 no centro,
 * exatamente 0 no raio, e nunca sobe com a distancia.
 */
export const attenuation = (distance: number, radius: number): number => {
  if (!(radius > 0) || distance >= radius) return 0;
  const d = Math.max(0, distance);
  const window = clamp01(1 - (d / radius) ** 4);
  return (window * window) / (d * d + 1);
};

/** `#rrggbb` -> canais 0..1. Aceita a paleta mestra, que e sempre 6 digitos. */
export const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
};

/**
 * O quanto uma cor de luz DESVIA do branco, 0..1.
 *
 * E o que decide se a luz tinge alguma coisa. A lanterna do Prospector e
 * branca e tem de continuar sem tingir nada — se toda luz pintasse, o mundo
 * inteiro ganharia um veu permanente e a cor deixaria de significar "ha uma
 * fonte de fogo ali".
 */
export const chromaOf = (hex: string): number => {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max <= 0 ? 0 : (max - min) / max;
};

/** O que uma celula recebeu, ja somado. */
export type Illumination = {
  /** O escalar de sempre: maximo, queda linear, alimenta o nivel assado. */
  intensity: number;
  /** Energia colorida acumulada, por canal. Pode passar de 1. */
  r: number;
  g: number;
  b: number;
  /** Vetor de incidencia (para onde estao as fontes), ja em 3D. */
  dx: number;
  dy: number;
  dz: number;
};

const FIELD_STRIDE = 7;

/**
 * A grade de luz da janela visivel.
 *
 * Um `Float32Array` reaproveitado entre quadros: alocar vinte mil floats por
 * quadro seria entregar ao coletor de lixo exatamente o orcamento que a
 * mudanca economizou no espalhamento.
 */
export class LightField {
  private data = new Float32Array(0);
  private originX = 0;
  private originY = 0;
  private width = 0;
  private height = 0;

  /** Prepara a janela `[x0,x1] x [y0,y1]` (inclusiva) e zera o que havia. */
  begin(x0: number, y0: number, x1: number, y1: number): void {
    const width = Math.max(0, x1 - x0 + 1);
    const height = Math.max(0, y1 - y0 + 1);
    const needed = width * height * FIELD_STRIDE;
    // Um `Float32Array` novo ja nasce zerado; so o reaproveitado precisa limpar.
    if (this.data.length < needed) this.data = new Float32Array(needed);
    else this.data.fill(0, 0, needed);
    this.originX = x0;
    this.originY = y0;
    this.width = width;
    this.height = height;
  }

  /**
   * Espalha uma luz pelas celulas do proprio raio.
   *
   * O centro de cada celula e `(x + 0.5, y + 0.5)`, e a fonte esta a
   * `light.height` tiles acima do plano do chao: a distancia e 3D, que e o que
   * faz o N.L do piso ser fisico em vez de decorativo.
   */
  add(light: WorldLight): void {
    if (this.width === 0 || light.power <= 0 || light.r <= 0) return;
    const chroma = chromaOf(light.hex);
    const [lr, lg, lb] = rgbOf(light.hex);
    const minX = Math.max(this.originX, Math.floor(light.x - light.r));
    const maxX = Math.min(this.originX + this.width - 1, Math.ceil(light.x + light.r));
    const minY = Math.max(this.originY, Math.floor(light.y - light.r));
    const maxY = Math.min(this.originY + this.height - 1, Math.ceil(light.y + light.r));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const ox = light.x - (x + 0.5);
        const oy = light.y - (y + 0.5);
        const flat = Math.hypot(ox, oy);
        if (flat >= light.r) continue;
        const base = (y - this.originY) * this.width + (x - this.originX);
        const at = base * FIELD_STRIDE;

        // 1. INTENSIDADE: a conta antiga, letra por letra. Maximo e queda
        //    linear — e o que os oito niveis assados esperam receber.
        const linear = light.power * (1 - flat / light.r);
        if (linear > this.data[at]) this.data[at] = linear;

        // 2. COR: so quem tem cor deposita. Luz branca ilumina e vai embora.
        if (chroma <= 0.02) continue;
        const energy = light.power * attenuation(flat, light.r) * chroma;
        if (energy <= 0) continue;
        this.data[at + 1] += energy * lr;
        this.data[at + 2] += energy * lg;
        this.data[at + 3] += energy * lb;

        // 3. VETOR DE INCIDENCIA, em 3D e ponderado pela energia: e ele que
        //    responde "de que lado veio" quando cada face perguntar.
        const dist = Math.hypot(flat, light.height);
        if (dist > 1e-6) {
          this.data[at + 4] += (energy * ox) / dist;
          this.data[at + 5] += (energy * oy) / dist;
          this.data[at + 6] += (energy * light.height) / dist;
        }
      }
    }
  }

  /** Só a intensidade — o caminho quente, chamado por celula do chao e parede. */
  intensityAt(x: number, y: number): number {
    const cx = Math.floor(x) - this.originX;
    const cy = Math.floor(y) - this.originY;
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return 0;
    return Math.min(1, this.data[(cy * this.width + cx) * FIELD_STRIDE]);
  }

  /** Ha cor para aplicar nesta celula? Evita montar o objeto a toa. */
  hasChromaAt(x: number, y: number): boolean {
    const cx = Math.floor(x) - this.originX;
    const cy = Math.floor(y) - this.originY;
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return false;
    const at = (cy * this.width + cx) * FIELD_STRIDE;
    return this.data[at + 1] + this.data[at + 2] + this.data[at + 3] > 0.004;
  }

  illuminationAt(x: number, y: number): Illumination {
    const cx = Math.floor(x) - this.originX;
    const cy = Math.floor(y) - this.originY;
    if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) {
      return { intensity: 0, r: 0, g: 0, b: 0, dx: 0, dy: 0, dz: 0 };
    }
    const at = (cy * this.width + cx) * FIELD_STRIDE;
    return {
      intensity: Math.min(1, this.data[at]),
      r: this.data[at + 1],
      g: this.data[at + 2],
      b: this.data[at + 3],
      dx: this.data[at + 4],
      dy: this.data[at + 5],
      dz: this.data[at + 6],
    };
  }
}

/** Uma face que recebe luz, no espaco do mundo. `z` aponta para cima. */
export type FaceNormal = { x: number; y: number; z: number };

/**
 * As tres faces que a projecao mostra.
 *
 * Na iso 2:1 deste jogo, a face desenhada a ESQUERDA na tela e a que olha para
 * +y do mundo, e a da DIREITA olha para +x — e a mesma leitura que
 * `edgeLeft`/`edgeRight` ja fazem no renderer para decidir a morfologia de
 * borda. Repetir a convencao aqui, nomeada, e o que impede o brilho de cair na
 * face errada no dia em que alguem inverter a projecao.
 */
export const FACE_TOP: FaceNormal = { x: 0, y: 0, z: 1 };
export const FACE_LEFT: FaceNormal = { x: 0, y: 1, z: 0 };
export const FACE_RIGHT: FaceNormal = { x: 1, y: 0, z: 0 };

/**
 * A DIRECAO DA CAMERA, no mundo — apontando da cena para o observador.
 *
 * Aqui esta a vantagem de uma camera fixa: numa projecao livre o vetor de visao
 * mudaria por pixel e o especular custaria isso; nesta ele e uma CONSTANTE, e o
 * reflexo especular sai praticamente de graca.
 *
 * De onde vem: a projecao e 2:1, que e uma dimetrica de 30 graus de elevacao —
 * a razao 0,5 entre a altura e a largura do losango E o seno dessa elevacao. O
 * azimute e 45 graus porque x e y descem para lados opostos da tela com o mesmo
 * peso. A camera esta, portanto, em -x, -y e +z: `cos30` repartido pelos dois
 * eixos horizontais, `sin30` na vertical.
 */
const VIEW = { x: -0.6124, y: -0.6124, z: 0.5 };

/** A luz refletida por uma face, pronta para pintar — ou null se nao ha nada. */
export type Bounce = {
  /** Difuso: `rgb(...)` da luz JA multiplicada pelo albedo do material. */
  color: string;
  /** Opacidade do veu largo (difuso). */
  alpha: number;
  /**
   * Especular: a cor da FONTE, sem o albedo.
   *
   * Nao e capricho — e como dieletricos se comportam. O reflexo difuso passa
   * pelo material e sai com a cor dele; o reflexo especular quica na superficie
   * e sai com a cor da LUZ. E por isso que uma bola vermelha polida tem um
   * brilho branco, e nao um brilho vermelho mais claro.
   */
  specularColor: string;
  /** Opacidade do realce concentrado. Zero em material fosco. */
  specular: number;
};

/** Piso do que vale desenhar: abaixo disto o veu custa mais do que informa. */
const BOUNCE_EPSILON = 0.008;
/** Teto do veu difuso. Acima disto a cor come o material em vez de acender. */
const MAX_DIFFUSE = 0.34;
const MAX_SPECULAR = 0.3;
/**
 * EXPOSICAO: de energia acumulada para opacidade de tela.
 *
 * A inversa do quadrado devolve energia FISICA, e energia fisica nao e pixel —
 * falta a intensidade luminosa real da fonte (uma poca de fogo nao tem uma
 * candela) e falta a exposicao da camera. Sem esta constante, a luz de uma
 * tocha a tres tiles chega em 0,03 de opacidade: matematicamente correta e
 * literalmente invisivel.
 *
 * Ela vive AQUI, no ponto em que a energia vira tinta, e nao dentro da queda —
 * e uma decisao de apresentacao, e enfia-la na atenuacao disfarcaria uma
 * escolha de exposicao de camera como se fosse fisica.
 *
 * Calibrada contra os raios que o jogo usa (1,5 a 5,5 tiles): satura colado na
 * fonte, entrega um veu legivel na metade do alcance e morre sozinha antes da
 * borda, sem precisar de corte.
 */
const EXPOSURE = 12;

/**
 * A REFLEXAO: irradiancia x albedo, separada em difuso e especular.
 *
 * O difuso e Lambert puro — `N.L` sobre a energia que chegou. O especular usa
 * o mesmo `N.L` elevado a uma potencia que sai do `gloss`, que e o atalho
 * classico para um lobo mais estreito sem precisar da direcao da camera: a
 * camera aqui e fixa, entao a direcao dela nao acrescenta informacao nenhuma
 * que o expoente ja nao carregue.
 *
 * O produto pelo albedo e a parte que responde "cada material diferente": o
 * mesmo clarao alaranjado devolve cinza-quente na rocha, quase nada no cristal
 * azul (azul nao tem vermelho para devolver) e um realce branco-frio no gelo,
 * que e polido e quase acromatico.
 */
export const bounceOf = (
  illumination: Illumination,
  normal: FaceNormal,
  material: MaterialResponse,
): Bounce | null => {
  const energy = Math.hypot(illumination.r, illumination.g, illumination.b);
  if (energy <= 0) return null;
  const length = Math.hypot(illumination.dx, illumination.dy, illumination.dz);
  if (length <= 1e-6) return null;

  const nDotL =
    (illumination.dx * normal.x + illumination.dy * normal.y + illumination.dz * normal.z) / length;
  if (nDotL <= 0) return null;

  const [ar, ag, ab] = rgbOf(material.albedo);
  // Canais refletidos = luz que chegou x o que o material devolve em cada um.
  const rr = illumination.r * ar;
  const rg = illumination.g * ag;
  const rb = illumination.b * ab;
  const reflected = luminance(rr, rg, rb);
  if (reflected <= 0) return null;

  // Normaliza para a cor pura do reflexo; a FORCA vai no alpha, e nao no canal.
  // Escurecer o canal aqui daria uma cor suja composta sobre o material em vez
  // de luz somada a ele.
  const color = normalized(rr, rg, rb, Math.max(rr, rg, rb));
  const incident = luminance(illumination.r, illumination.g, illumination.b);
  const specularColor = normalized(
    illumination.r,
    illumination.g,
    illumination.b,
    Math.max(illumination.r, illumination.g, illumination.b),
  );

  // DIFUSO: Lambert. Fosco espalha o que recebe por um hemisferio inteiro, e
  // por isso entrega mais no veu largo do que um material polido entregaria.
  const matte = 1 - material.gloss;
  const alpha = Math.min(MAX_DIFFUSE, EXPOSURE * reflected * nDotL * (0.35 + 0.65 * matte));

  // ESPECULAR: Blinn-Phong com o vetor-metade, e nao `N.L` elevado a alguma
  // coisa. A diferenca importa e e visivel: `N.L^n` so faz o difuso ficar mais
  // estreito, e o realce apareceria sempre que a luz estivesse de frente para a
  // face. O vetor-metade poe o realce onde a REFLEXAO de fato manda a luz para
  // a camera — que e por isso que uma poca so lampeja quando a tocha esta do
  // lado certo dela, e nao sempre que ha tocha por perto.
  //
  // A normalizacao `(n+2)/8` e a conservacao de energia do lobo: espalhar a
  // mesma energia por um cone mais largo tem de baixar o pico. Sem ela, um
  // material fosco com lobo largo somaria mais luz total que um espelho.
  const hx = illumination.dx / length + VIEW.x;
  const hy = illumination.dy / length + VIEW.y;
  const hz = illumination.dz / length + VIEW.z;
  const hLength = Math.hypot(hx, hy, hz) || 1;
  const nDotH = Math.max(
    0,
    (hx * normal.x + hy * normal.y + hz * normal.z) / hLength,
  );
  const exponent = 2 + material.gloss * 60;
  const specular = Math.min(
    MAX_SPECULAR,
    EXPOSURE * incident * material.gloss * nDotH ** exponent * ((exponent + 2) / 8),
  );

  if (alpha < BOUNCE_EPSILON && specular < BOUNCE_EPSILON) return null;
  return { color, alpha, specularColor, specular };
};

/**
 * Luminancia Rec. 709 — o quanto o olho ve de uma cor.
 *
 * O maximo dos canais serviria para normalizar a COR, mas nao para medir
 * FORCA: `#00ff00` e `#0000ff` tem o mesmo maximo e nao acendem nada parecido.
 * Verde pesa quase quatro quintos do que se enxerga, e e o que decide se um
 * reflexo vale um pixel na tela.
 */
const luminance = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Canais reescalados para o mais forte deles saturar: cor pura, sem a forca. */
const normalized = (r: number, g: number, b: number, peak: number): string => {
  if (peak <= 0) return 'rgb(255,255,255)';
  const scale = 255 / peak;
  return `rgb(${Math.min(255, Math.round(r * scale))},${Math.min(255, Math.round(g * scale))},${Math.min(255, Math.round(b * scale))})`;
};
