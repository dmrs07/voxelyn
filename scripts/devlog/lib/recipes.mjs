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
 * Escolhe as receitas de uma entrada a partir das areas que o PR tocou.
 *
 * A primeira receita da lista e a CAPA (a que vira o slide 1 do carrossel), e
 * por isso a ordem aqui e intencional: o quadro mais especifico ao que o PR
 * mudou vem primeiro, e a run solo entra como leito de seguranca porque e a
 * unica que existe em todo o historico.
 */
export function pickRecipes(areas, title = '') {
  const has = (needle) => areas.some((a) => a.includes(needle));
  const says = (re) => re.test(title.toLowerCase());
  const picked = [];

  if (has('atlas-studio')) picked.push('atlas-studio');
  if (says(/arena|chefe|boss/)) picked.push('arena');
  if (says(/sprite|atlas|anima|frame|pose/) && !has('atlas-studio')) picked.push('sprites');
  if (says(/menu|terminal|tela|hud|opcoes|op..es|ranking|registro/)) picked.push('menu');

  if (has('voxelyn-survival') || picked.length === 0) picked.push('solo');

  return [...new Set(picked)].slice(0, 2);
}
