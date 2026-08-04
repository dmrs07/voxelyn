/**
 * Aurix Dynamics — a companhia.
 *
 * O jogo inteiro ja falava na voz dela (o laudo da carcaca, a designacao das
 * unidades, o contrato semanal "publicado pela companhia"), so faltava o nome e
 * a cara. Este arquivo e o unico lugar onde as duas coisas moram, para que a
 * marca nao seja recopiada em cada tela que precisar dela.
 *
 * O simbolo e SVG e nao PNG por tres motivos praticos: escala sem borrar no
 * mesmo pixel-art que a tela usa, atravessa o service worker sem virar mais um
 * arquivo no precache (o app shell ja passa de 1 MB) e muda de cor por CSS,
 * o que a tela de abandono usa para esmaecer a marca.
 *
 * O desenho segue a arte de referencia do redesign (doc AD-UI-2.0): uma placa
 * triangular chanfrada de bronze com fendas de teal aceso — o "A" da Aurix
 * como peca de maquinario, nao como letra.
 */

import { t } from './i18n';

/** Ouro da companhia. Mesma familia do bege de texto secundario ja usado (#b8a98f). */
export const AURIX_GOLD = '#c9a25e';

export const AURIX_NAME = 'AURIX DYNAMICS';

/**
 * O lema, que o jogo devolve ao jogador no pior momento possivel.
 *
 * Ele fecha a tela de abandono de proposito: as tres palavras descrevem o que a
 * companhia espera de um Prospector, e ele acabou de anunciar que nao vai fazer
 * nenhuma das tres. Nao ha reprimenda escrita em lugar nenhum — o lema faz o
 * trabalho sozinho.
 *
 * LOCALIZADO de proposito (chave `aurix.motto`): a Aurix fala a lingua do
 * operador — e o lema so cobra alguma coisa se quem le entender a cobranca.
 */
export const AURIX_TAGLINE = 'EXTRAIR. PROTEGER. ADAPTAR.';

/**
 * Contador de instancias, para os ids de gradiente.
 *
 * Um id fixo custou uma placa inteira: as duas telas montam a marca, os dois
 * `<linearGradient>` nasciam com o MESMO id e o `url(#...)` da segunda resolvia
 * para o gradiente da primeira. Como a primeira vive dentro de uma overlay
 * `display:none`, o navegador nao pinta o servidor de tinta que ela contem — e
 * a segunda marca aparecia vazia, so com a dobra escura visivel. O sintoma
 * (metade de um simbolo) nao aponta para a causa (dois ids iguais), e por isso o
 * numero fica aqui em vez de a marca ser copiada certa "com cuidado".
 */
let markSerial = 0;

/**
 * O monograma: um "A" angular montado de fitas chanfradas de bronze, com as
 * fendas de teal da arte de referencia. Sem `width`/`height` — quem monta
 * decide o tamanho por CSS.
 */
const markSvg = (): string => {
  const serial = (markSerial += 1);
  const leaf = `aurix-leaf-${serial}`;
  const vein = `aurix-vein-${serial}`;
  return `
<svg class="corp-mark" viewBox="0 0 100 100" role="img" aria-label="${AURIX_NAME}">
  <defs>
    <linearGradient id="${leaf}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0bd7c" />
      <stop offset="60%" stop-color="#c9a25e" />
      <stop offset="100%" stop-color="#8a6f42" />
    </linearGradient>
    <linearGradient id="${vein}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8ff0e6" />
      <stop offset="100%" stop-color="#2f7d75" />
    </linearGradient>
  </defs>
  <!-- a placa de fundo: o triangulo chanfrado em bronze escuro -->
  <path fill="#4a3a22" d="M50 2 L96 88 L78 96 L22 96 L4 88 Z" />
  <path fill="#2c2318" d="M50 10 L88 86 L68 92 L32 92 L12 86 Z" />
  <!-- as duas pernas do A, sem barra: o vao entre elas e o vazio do simbolo -->
  <path fill="url(#${leaf})" d="M50 8 L88 90 L69 90 L50 46 L31 90 L12 90 Z" />
  <!-- a dobra do apice, mais escura: e o que faz a fita parecer chanfrada -->
  <path fill="#6d5533" opacity="0.85" d="M50 22 L61 46 L39 46 Z" />
  <!-- travessa, em trapezio para acompanhar o angulo das pernas -->
  <path fill="url(#${leaf})" d="M35 60 L65 60 L70 74 L30 74 Z" />
  <!-- fendas de teal: o nucleo aceso atras da placa -->
  <path fill="url(#${vein})" d="M50 30 L56 44 L50 58 L44 44 Z" />
  <path fill="url(#${vein})" opacity="0.8" d="M24 78 L30 78 L27 88 Z" />
  <path fill="url(#${vein})" opacity="0.8" d="M70 78 L76 78 L73 88 Z" />
</svg>`;
};

/**
 * Placa da companhia: simbolo, nome e lema.
 *
 * Devolve HTML e nao nos prontos porque as duas telas que a usam ja sao
 * `innerHTML` de overlay; um construtor de elementos so adicionaria cerimonia.
 *
 * @param tagline inclui o lema. A tela de pausa deixa de fora — ali a marca e
 *   so um cabecalho, e o lema pertence ao momento em que ele cobra alguma coisa.
 */
export const aurixPlateHtml = (tagline = false): string =>
  `<div class="corp-plate">${markSvg()}<div class="corp-name">${AURIX_NAME}</div>${
    tagline ? `<div class="corp-tagline">${t('aurix.motto')}</div>` : ''
  }</div>`;

/**
 * So o monograma, para o trilho de arquivo — onde a placa completa nao cabe.
 * O tamanho e decidido pelo CSS de quem monta (`.ax-rail-mark .corp-mark`).
 */
export const aurixMarkHtml = (): string => markSvg();
