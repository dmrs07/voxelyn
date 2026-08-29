// A ILUMINACAO, derivada da propria cena.
//
// Nenhuma luz e posta "onde fica bonito": cada uma nasce de um objeto que existe
// no mundo e que, na ficcao do jogo, emite. O nucleo ilumina porque ha um
// cristal biolum no berco; a Vein ilumina porque o condutor esta carregado; os
// pontos ambar existem onde ha equipamento Aurix energizado. Se o objeto sair da
// cena, a luz sai junto — e essa dependencia e o que impede a iluminacao de
// virar pintura.
//
// HIERARQUIA LUMINOSA, na ordem que o briefing fixa:
//   1. o core;  2. o berco e a Vein perto dele;  3. o visage do Guardiao;
//   4. o Prospector;  5. os pontos ambar;  6. o ambiente.
// Ela nao e uma intencao vaga: e a ordem das intensidades declaradas aqui, e o
// teste de composicao mede a luminancia media de cada regiao para conferir.
import { COLORS } from '../lib.mjs';
import { VOXELS_PER_TILE, MATERIAL_INDEX } from './geometry.mjs';
import { GROUND, tileOrigin, OBJ } from './scene.mjs';

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linear = ([r, g, b]) => [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];

/**
 * COR de uma luz: o matiz de uma cor da paleta, normalizado para brilho 1.
 *
 * A distincao entre matiz e forca e o que a primeira versao desta cena nao fazia,
 * e o resultado foi uma imagem quase preta. O motivo: `rockShadow` e uma cor
 * ESCURA (luminancia linear na casa de 0,02), e usa-la crua como cor de luz
 * multiplicava o albedo — ja baixo, porque a paleta do jogo e escura de proposito
 * — por mais um fator de 0,02. Duas escuridoes multiplicadas dao preto, e nenhum
 * ajuste de exposicao recupera o que virou zero.
 *
 * Cor de luz e cor de superficie sao grandezas diferentes: uma diz QUE COR a luz
 * tem, a outra QUANTO da luz a superficie devolve. Normalizando o matiz aqui, a
 * intensidade passa a ser o unico controle de forca — que e como um refletor
 * funciona, e como qualquer ajuste posterior fica previsivel.
 */
const chroma = (rgb) => {
  const l = linear(rgb);
  const m = Math.max(l[0], l[1], l[2]) || 1;
  return [l[0] / m, l[1] / m, l[2] / m];
};

/**
 * Puxa uma cor de luz para o branco. `t` = 0 mantem o matiz, 1 devolve branco.
 *
 * Existe por uma medicao, nao por gosto. Comparando o histograma do render com o
 * da referencia, a estrutura de VALOR bateu quase exatamente — mediana 0,059
 * contra 0,052, sombras cobrindo 60% do quadro contra 62%, altas 3,7% contra
 * 4,2%. O que nao bateu foi a COR: media RGB (8,5 24,0 64,6) contra (20,0 28,0
 * 28,5). A referencia e um cinza escuro quase neutro com acentos ciano e ambar;
 * o render era monocromatico azul.
 *
 * A causa e uma multiplicacao dupla: a rocha do basalto ja e azul-acinzentada na
 * paleta ([46 58 77], razao vermelho/azul de 0,6), e a luz que a iluminava era
 * azul tambem. Duas fontes de azul multiplicadas nao dao "mais frio" — dao
 * monocromia, e a cena perde a capacidade de dizer que material esta olhando.
 *
 * Luz de caverna e quase neutra; o que a faz LER como fria e o contraste com os
 * poucos pontos quentes. Dessaturar a luz devolve ao material o direito de ter
 * cor propria, e e o que aproxima o render da referencia sem tocar na paleta.
 */
const towardWhite = (rgb, t) => {
  const c = chroma(rgb);
  return [c[0] + (1 - c[0]) * t, c[1] + (1 - c[1]) * t, c[2] + (1 - c[2]) * t];
};

/**
 * Uma luz pontual. `radius` e o alcance em que ela zera — nao um raio de
 * referencia, mas o corte real —, e `falloff` controla a curva dentro dele.
 * `shadow` custa um raio por pixel; so o nucleo paga isso.
 */
const point = ({ pos, color, intensity, radius, falloff = 0.0006, shadow = false, ignoreAo = false, volumetric = 0, tag }) => ({
  pos,
  color,
  intensity,
  radius,
  radius2: radius * radius,
  falloff,
  shadow,
  ignoreAo,
  /** Densidade do meio para esta fonte. Zero = nao espalha no ar. */
  volumetric,
  tag,
});

/**
 * Monta o conjunto de luzes a partir do estado do jogo e da janela renderizada.
 *
 * `veinCells` sao as celulas de leyline que o passe de carga marcou como ACESAS
 * (ver `chargeVein`): a Vein nao brilha inteira, brilha onde a corrente esta —
 * que e o que a tagline afirma e o que o sistema do jogo de fato faz.
 */
export const buildLights = (state, win, veinCells, propLights, cameraVoxel) => {
  const points = [];

  // -----------------------------------------------------------------------
  // 1. O NUCLEO. A fonte principal, e a unica que projeta sombra.
  //
  // Ela custa um raio de sombra por pixel e paga: sao as sombras do nucleo
  // atravessando as patas do Guardiao que dizem, sem texto, que ele esta
  // ENTRE a camera e a luz. Uma luz de mesma cor sem sombra deixaria o chefe
  // parecer colado num fundo aceso.
  //
  // A altura e a do cristal no modelo (`coreModel`: o cristal fica por volta de
  // z=10 autorado, sobre o berco), convertida para voxels finos.
  // -----------------------------------------------------------------------
  const core = tileOrigin(win, state.corePos.x, state.corePos.y);
  points.push(
    point({
      pos: [core.ox, core.oy, GROUND + 22],
      color: chroma(COLORS.biolum),
      intensity: 11.0,
      radius: 34 * VOXELS_PER_TILE,
      falloff: 0.00035,
      shadow: true,
      // A unica fonte que espalha no ar. E ela que faz o berco ler como fonte
      // dentro de um espaco, e nao como um objeto brilhante colado no fundo.
      // A DENSIDADE foi calibrada contra o histograma, nao a olho. Em 0,0034 o
      // halo deixava de ser halo: cobria a metade superior do quadro com um veu
      // ciano, as sombras caiam de 62% para 33% da imagem e a media do canal
      // verde subia de 28 para 47. O espalhamento tem de dizer onde a fonte
      // esta, e nao pintar a caverna inteira da cor dela.
      volumetric: 0.0011,
      tag: 'core',
    })
  );
  // Um segundo emissor curto no proprio berco, sem sombra: o cristal ilumina os
  // quatro contrafortes e os degraus do pedestal a queima-roupa, e uma luz so —
  // com alcance longo — nao consegue ser forte de perto sem lavar a arena.
  points.push(
    point({
      pos: [core.ox, core.oy, GROUND + 14],
      color: chroma(COLORS.biolum),
      intensity: 4.0,
      radius: 6 * VOXELS_PER_TILE,
      falloff: 0.002,
      tag: 'cradle',
    })
  );

  // -----------------------------------------------------------------------
  // 2. A VEIN. Uma luz curta por trecho carregado, e nao uma por celula.
  //
  // Uma luz por celula daria centenas de fontes, o custo por pixel subiria na
  // mesma proporcao e o resultado seria um cordao continuo — exatamente o
  // "cabo de neon" que o briefing proibe. Amostrando um trecho a cada poucas
  // celulas, o brilho fica IRREGULAR ao longo do veio, que e como minerio
  // condutivo aparece: forte onde a materia esta exposta, apagado onde a rocha
  // cobre.
  // -----------------------------------------------------------------------
  const w = state.config.width;
  veinCells.forEach((cell, i) => {
    if (i % 3 !== 0) return;
    const tx = cell % w;
    const ty = (cell / w) | 0;
    if (tx < win.x0 || tx >= win.x1 || ty < win.y0 || ty >= win.y1) return;
    const o = tileOrigin(win, tx, ty);
    // A intensidade decai ao longo do veio a partir do berco: a corrente vem
    // de la, e um pulso que chega igual na outra ponta nao le como pulso.
    const decay = 1 - Math.min(0.72, (i / Math.max(1, veinCells.length)) * 0.8);
    points.push(
      point({
        pos: [o.ox, o.oy, GROUND + 5],
        color: chroma(COLORS.electric),
        intensity: 3.4 * decay,
        radius: 4.2 * VOXELS_PER_TILE,
        falloff: 0.004,
        tag: 'vein',
      })
    );
  });

  // -----------------------------------------------------------------------
  // 3. PONTOS AMBAR. Poucos, e so onde ha equipamento Aurix energizado.
  //
  // O briefing e explicito contra "highlights dourados aleatorios": ambar
  // aparece em terminal, luz de status e caixa energizada, e em nada mais. Sao
  // as posicoes reais dos props que a cena montou.
  // -----------------------------------------------------------------------
  for (const p of propLights) {
    const o = tileOrigin(win, p.tile.x, p.tile.y);
    points.push(
      point({
        pos: [o.ox, o.oy, GROUND + (p.height ?? 6)],
        color: chroma(COLORS.amber),
        intensity: p.intensity ?? 1.5,
        radius: (p.radius ?? 4) * VOXELS_PER_TILE,
        falloff: 0.003,
        tag: 'aurix',
      })
    );
  }

  // -----------------------------------------------------------------------
  // 4. FILL, na posicao da CAMERA. O minimo que o briefing autoriza:
  //    "suficiente para separar o Guardiao do fundo".
  //
  // O problema que ele resolve e concreto e aparece so no render final: o
  // Guardiao e uma massa de basalto escuro recortada contra rocha do mesmo
  // basalto escuro. As luzes da cena estao todas do outro lado dele (o nucleo
  // fica atras, a key vem de cima), entao as faces viradas para a camera nao
  // recebiam nada e a silhueta de cidadela — que o passe de segmentacao mostrava
  // perfeita — simplesmente sumia no beauty.
  //
  // Uma luz na camera nao inventa fonte: e a mesma claridade ambiente da caverna
  // chegando pelo lado de ca, e por isso ela e fraca, fria e sem sombra. O
  // alcance e longo para nao criar um circulo de luz em volta do primeiro plano,
  // e a queda e quase linear pelo mesmo motivo.
  if (cameraVoxel) {
    points.push(
      point({
        pos: cameraVoxel,
        color: towardWhite(COLORS.mist, 0.5),
        intensity: 0.30,
        radius: 40 * VOXELS_PER_TILE,
        falloff: 0.00008,
        tag: 'fill',
      })
    );
  }

  return {
    points,
    // ---------------------------------------------------------------------
    // LUZ PRINCIPAL FRIA, de cima.
    //
    // Nao e sol: e a claridade difusa que desce pelas fraturas do teto, e por
    // isso vem quase de prumo, com uma inclinacao pequena para o quadrante da
    // key light da art bible (topo-esquerda). O alcance da sombra e curto de
    // proposito — sombra de contato, que revela volume, sem o custo de tracar a
    // cena inteira contra o teto que nao existe no modelo.
    // ---------------------------------------------------------------------
    key: {
      dir: (() => {
        // A LUZ VEM DO LADO DA CAMERA, e essa e uma correcao que o passe de
        // segmentacao tornou obvia: nele o Guardiao aparecia com a silhueta de
        // cidadela perfeitamente legivel, e no beauty ele era uma mancha escura.
        // A causa nao era intensidade — era direcao. A key apontava de oeste, a
        // camera olha de leste, e as faces que ela ve (leste e norte do chefe)
        // recebiam produto escalar negativo: estavam, literalmente, no lado
        // errado da luz.
        //
        // A art bible fixa a key no topo-esquerda porque a projecao do jogo e
        // fixa; com camera livre o equivalente e o topo-esquerda DA CAMERA, e e
        // isso que este vetor e — de cima, do quadrante leste-norte, que e onde
        // a camera esta. A inclinacao continua alta o bastante para as faces de
        // topo receberem mais que as laterais, como manda a hierarquia de faces.
        const v = [0.5, -0.45, 0.74];
        const l = Math.hypot(...v);
        return [v[0] / l, v[1] / l, v[2] / l];
      })(),
      // `mist` e nao `rockLight`: a segunda tem cromaticidade (0,41 0,61 1,00),
      // ou seja, o canal vermelho vale menos de metade do azul, e uma cena
      // inteira de rocha azul multiplicada por uma luz azul saiu monocromatica.
      // `mist` e o mesmo lugar da escala fria com metade da saturacao (0,54 0,70
      // 1,00) — continua sendo luz fria de caverna, mas deixa o material dizer
      // alguma coisa sobre a propria cor.
      color: towardWhite(COLORS.mist, 0.82),
      intensity: 3.6,
      shadowRange: 30 * VOXELS_PER_TILE,
    },
    // Preenchimento minimo: so o bastante para o Guardiao se separar do fundo.
    // Frio e fraco — um fill quente aqui produziria o teal-and-orange generico
    // que o briefing rejeita.
    ambient: towardWhite(COLORS.mist, 0.68).map((c) => c * 0.34),
    // Forca de emissao por material. O cristal do nucleo e o mais forte da
    // cena: ele e o topo da hierarquia luminosa e precisa aguentar o tonemap
    // sem perder a cor para o branco.
    // FORCA DE EMISSAO por material.
    //
    // Os valores caíram bastante depois do primeiro render em escala de leitura:
    // com o cristal em 3,4 e o condutor em 1,45, o nucleo do Guardiao virava uma
    // mancha branca do tamanho de um tile e o cristal do berco perdia o ciano
    // para o branco do ombro do tonemap. Emissivo forte demais nao le como luz
    // forte — le como buraco na imagem, porque a cor morre antes da intensidade.
    //
    // A hierarquia permanece a do briefing: o cristal do berco e o mais forte da
    // cena, o condutor vem depois, e o ambar dos equipamentos fica abaixo dos
    // dois. O que mudou foi a ESCALA, nao a ordem.
    emissiveStrength: {
      default: 0.7,
      [MATERIAL_INDEX.biolum]: 1.25,
      [MATERIAL_INDEX.electric]: 0.32,
      [MATERIAL_INDEX.amber]: 0.9,
      [MATERIAL_INDEX.beam]: 1.1,
      [MATERIAL_INDEX.fire]: 0.9,
      [MATERIAL_INDEX.acid]: 0.6,
      /**
       * Multiplicador por OBJETO, aplicado sobre o do material.
       *
       * A Vein sobe porque a corrente esta nela agora — e o que `chargeVein`
       * acabou de plantar em `state.charges`, e o que a tagline afirma. O nucleo
       * do Guardiao desce porque ele esta em repouso: no modelo canonico ele
       * "respira" no idle, nao dispara. E o berco fica no meio, porque o cristal
       * esta suspenso e pulsando, mas a luz dele ja vem quase toda da fonte
       * pontual que ele carrega.
       */
      byObject: {
        [OBJ.VEIN]: 3.2,
        [OBJ.GUARDIAN]: 0.7,
        [OBJ.CORE]: 1.15,
        // O visor e o farol do Prospector sao o quarto degrau da hierarquia
        // luminosa que o briefing fixa, e no primeiro plano eles competem com a
        // rocha iluminada pelo fill. Sem o reforco, o bot lia como silhueta sem
        // vida — e o visor aceso e o que diz que ele esta ligado e olhando.
        [OBJ.PROSPECTOR]: 1.6,
      },
    },
    // Bruma: cor fria e densidade baixa. E ela que abre a profundidade e cria a
    // area mais clara ao fundo, sem o veu uniforme que o briefing proibe.
    fog: {
      color: towardWhite(COLORS.rockShadow, 0.45).map((c) => c * 0.075),
      density: 0.0010,
    },
  };
};
