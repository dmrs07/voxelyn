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
 */

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
 */
export const AURIX_TAGLINE = 'EXTRAIR. PROTEGER. ADAPTAR.';

/**
 * Contador de instancias, para o id do gradiente.
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
 * O monograma: um "A" angular montado de fitas chanfradas, como uma placa
 * gravada em metal. Sem `width`/`height` — quem monta decide o tamanho por CSS.
 */
const markSvg = (): string => {
  const gradient = `aurix-leaf-${(markSerial += 1)}`;
  return `
<svg class="corp-mark" viewBox="0 0 100 100" role="img" aria-label="${AURIX_NAME}">
  <defs>
    <linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e0bd7c" />
      <stop offset="60%" stop-color="#c9a25e" />
      <stop offset="100%" stop-color="#8a6f42" />
    </linearGradient>
  </defs>
  <!-- as duas pernas do A, sem barra: o vao entre elas e o vazio do simbolo -->
  <path fill="url(#${gradient})" d="M50 8 L88 90 L69 90 L50 46 L31 90 L12 90 Z" />
  <!-- a dobra do apice, mais escura: e o que faz a fita parecer chanfrada -->
  <path fill="#6d5533" opacity="0.85" d="M50 22 L61 46 L39 46 Z" />
  <!-- travessa, em trapezio para acompanhar o angulo das pernas -->
  <path fill="url(#${gradient})" d="M35 60 L65 60 L70 74 L30 74 Z" />
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
    tagline ? `<div class="corp-tagline">${AURIX_TAGLINE}</div>` : ''
  }</div>`;
