/**
 * Receitas de captura: como dirigir um build JA PRONTO ate um quadro que vale
 * uma screenshot.
 *
 * A regra que molda este arquivo: as receitas rodam contra commits de semanas
 * atras, onde seletores podem nao existir ainda. Por isso todo passo aceita
 * `optional` — um `#btn-arena` que so nasceu no PR #120 nao pode derrubar a
 * captura do PR #95. O que NAO e opcional e o alvo final: se o canvas nunca
 * pinta, a captura falha alto, porque um PNG preto passando por screenshot de
 * jogo e pior que nenhum PNG.
 */

/** Desktop 16:10 — enquadramento de devlog, nao de loja. */
const DESKTOP = { width: 1280, height: 800 };
/** Retrato de celular: o Atlas Studio e o Survival sao mobile-first. */
const PHONE = { width: 430, height: 932 };

export const recipes = {
  /** A tela de abertura (Ordem de Despacho). Barata e sempre disponivel. */
  menu: {
    app: 'survival',
    page: 'index.html',
    viewport: DESKTOP,
    label: 'terminal',
    steps: [
      { do: 'waitFor', selector: '#menu' },
      // As duas fontes auto-hospedadas trocam a metrica do documento inteiro
      // quando carregam; capturar antes disso fotografa um layout que nenhum
      // jogador ve.
      { do: 'waitForFonts' },
      { do: 'wait', ms: 600 },
    ],
  },

  /** Uma run solo em andamento: o quadro que de fato mostra o jogo. */
  solo: {
    app: 'survival',
    page: 'index.html',
    viewport: DESKTOP,
    label: 'run solo',
    steps: [
      { do: 'waitFor', selector: '#btn-solo' },
      // Cinto e suspensorio para a Inducao: o storage semeado ja deveria ter
      // impedido a folha de abrir, mas em commits onde a chave tinha outro
      // nome ela aparece por cima do despacho e engole o carimbo.
      { do: 'dismiss', selector: '#btn-induction-close', optional: true },
      { do: 'click', selector: '#btn-solo' },
      { do: 'waitFor', selector: '#game' },
      // O veu de deploy cobre a tela por ~1,7s. `reducedMotion` ja o pula,
      // mas a montagem do mundo continua assincrona: esperamos o canvas
      // PINTAR em vez de cronometrar no escuro.
      { do: 'waitForInk', selector: '#game' },
      { do: 'wait', ms: 1500 },
      // Sair do ponto de spawn: parado no centro de um setor vazio o quadro
      // nao conta nada. Andar revela terreno, props e inimigos.
      { do: 'hold', key: 'd', ms: 850 },
      { do: 'hold', key: 's', ms: 500 },
      { do: 'wait', ms: 1200 },
    ],
  },

  /** Arena de chefes: o encontro isolado, sem a campanha em volta. */
  arena: {
    app: 'survival',
    page: 'arena.html',
    viewport: DESKTOP,
    label: 'arena de chefes',
    optional: true, // arena.html so existe a partir de certo ponto do historico
    steps: [
      { do: 'waitFor', selector: '#setup' },
      { do: 'waitForFonts' },
      { do: 'submit', selector: '#setup-form', optional: true },
      { do: 'waitForInk', selector: '#game' },
      { do: 'wait', ms: 1800 },
      { do: 'hold', key: 'd', ms: 600 },
      { do: 'wait', ms: 900 },
    ],
  },

  /** Visualizador de sprites: a captura mais estavel que existe no repo. */
  sprites: {
    app: 'survival',
    page: 'sprites.html',
    viewport: DESKTOP,
    label: 'atlas de sprites',
    optional: true,
    steps: [
      { do: 'waitFor', selector: '#zoom' },
      { do: 'wait', ms: 1500 },
    ],
  },

  /**
   * O Noita-like: a PRIMEIRA coisa do Voxelyn que teve imagem.
   *
   * Existe desde o commit inicial, em 18/01, quando o projeto ainda era uma
   * biblioteca headless de simulacao por celula e estes demos eram a unica
   * forma de ver a biblioteca funcionando.
   */
  noita: {
    app: 'examples',
    page: 'examples/browser-noita-like/index.html',
    viewport: DESKTOP,
    label: 'demo Noita-like',
    // Recorta NO CANVAS. Os demos sao uma caixa centrada numa pagina vazia:
    // fotografar a janela entrega 80% de fundo preto, e recortar no `#wrap`
    // nao resolve porque ele estica por `min-height: 100vh`. O titulo e o
    // contador de fps sao cromo da pagina, nao o que o commit fez.
    clip: '#c',
    steps: [
      // A areia leva alguns quadros para cair e formar pilha; capturar no
      // primeiro quadro pega um mundo ainda em repouso.
      { do: 'waitForInk', selector: '#c' },
      { do: 'wait', ms: 2500 },
    ],
  },

  /** O demo iso Diablo-like: a outra metade da origem, do mesmo commit. */
  iso: {
    app: 'examples',
    page: 'examples/browser-iso-diablo-like/index.html',
    viewport: DESKTOP,
    label: 'demo iso Diablo-like',
    optional: true,
    clip: '#c',
    steps: [
      { do: 'waitForInk', selector: '#c' },
      { do: 'wait', ms: 1500 },
    ],
  },

  /**
   * O roguelike: a origem jogavel do projeto, de fevereiro a julho.
   *
   * A captura mais facil do repositorio inteiro — o main.ts instancia o loop
   * com seed fixa (0xdecafbad) e comeca a rodar. Sem menu, sem onboarding,
   * sem servidor: carregou, ja e jogo.
   */
  roguelike: {
    app: 'roguelike',
    page: 'index.html',
    viewport: DESKTOP,
    label: 'roguelike',
    steps: [
      { do: 'waitForInk', selector: '#game' },
      { do: 'wait', ms: 1500 },
      { do: 'hold', key: 'd', ms: 700 },
      { do: 'wait', ms: 1000 },
    ],
  },

  /** VoxelForge: o editor, e a unica coisa com tela que existia em janeiro. */
  editor: {
    app: 'editor',
    page: 'index.html',
    viewport: DESKTOP,
    label: 'VoxelForge',
    steps: [{ do: 'waitFor', selector: '#app' }, { do: 'waitForFonts' }, { do: 'wait', ms: 2000 }],
  },

  /** O editor de atlas, em retrato — e como ele foi desenhado pra ser usado. */
  'atlas-studio': {
    app: 'atlas-studio',
    page: 'index.html',
    viewport: PHONE,
    label: 'Atlas Studio',
    optional: true,
    steps: [{ do: 'waitFor', selector: '#app' }, { do: 'waitForFonts' }, { do: 'wait', ms: 1800 }],
  },
};

/**
 * Escolhe as receitas de uma entrada.
 *
 * A primeira da lista e a CAPA (o slide 1 do carrossel), entao a ordem e
 * intencional: o quadro mais especifico ao que o PR mudou vem primeiro.
 *
 * `available` e o conjunto de apps que EXISTIAM naquele commit. Sem ele, um
 * PR de fevereiro pediria uma run do Survival — um app que so nasceria cinco
 * meses depois — e a entrada terminaria sem imagem. Com ele, cada era e
 * fotografada pelo que ela tinha: o editor em janeiro, o roguelike de
 * fevereiro a julho, o Survival dai em diante.
 */
export function pickRecipes(areas, title = '', available = null) {
  const exists = (app) => available === null || available.has(app);
  const has = (needle) => areas.some((a) => a.includes(needle));
  const says = (re) => re.test(title.toLowerCase());
  const picked = [];

  if (exists('atlas-studio') && has('atlas-studio')) picked.push('atlas-studio');

  if (exists('survival')) {
    if (says(/arena|chefe|boss/)) picked.push('arena');
    if (says(/sprite|atlas|anima|frame|pose/) && !has('atlas-studio')) picked.push('sprites');
    if (says(/menu|terminal|tela|hud|opcoes|op..es|ranking|registro/)) picked.push('menu');
  }

  // O leito de seguranca e o app jogavel mais recente que existia na epoca:
  // toda entrada precisa de pelo menos um quadro, e ele nao pode vir de um
  // app que ainda nao tinha sido escrito. A cadeia desce ate os demos do
  // core, que existem desde o commit inicial — por isso nenhuma entrada do
  // devlog fica sem imagem, nem as de janeiro.
  if (!picked.length || !picked.some((r) => recipes[r].app !== 'atlas-studio')) {
    if (exists('survival')) picked.push('solo');
    else if (exists('roguelike')) picked.push('roguelike');
    else if (says(/editor|voxelforge|material|palet/) && exists('editor')) picked.push('editor');
    else if (exists('examples')) {
      // Na era dos demos, os DOIS: sao quinze posts nessa janela e o mesmo
      // quadro de areia caindo quinze vezes mataria o carrossel. Noita-like e
      // iso Diablo-like mostram as duas metades da biblioteca headless.
      picked.push('noita', 'iso');
    }
  }

  return [...new Set(picked)].filter((r) => exists(recipes[r].app)).slice(0, 2);
}
