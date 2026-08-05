/**
 * Aurix Dynamics — a companhia.
 *
 * O jogo inteiro ja falava na voz dela (o laudo da carcaca, a designacao das
 * unidades, o contrato semanal "publicado pela companhia"), so faltava o nome e
 * a cara. Este arquivo e o unico lugar onde as duas coisas moram, para que a
 * marca nao seja recopiada em cada tela que precisar dela.
 *
 * O simbolo e SVG e nao PNG por um motivo pratico: escala sem borrar no
 * mesmo pixel-art que a tela usa, do selo de 26px no trilho de arquivo ate a
 * placa de 54px do menu de pausa.
 *
 * O desenho e o emblema oficial da companhia (pacote de marca Aurix Dynamics),
 * na versao "full-vector high-fidelity": um traco vetorial pixel a pixel da
 * arte de referencia, nao um redesenho procedural. Fica mais fiel ao render
 * original, ao custo de ~1 MB de paths — grande demais para repetir inline
 * por instancia, por isso mora em `assets/aurix-mark.svg` e entra via import
 * `?raw` do Vite (inlina no bundle uma unica vez em build; sem isso viraria
 * mais um arquivo no precache do service worker, que o app shell ja passa de
 * 1 MB sozinho). O recorte fica so no emblema — o wordmark do arquivo fonte
 * fica de fora porque `.corp-name` ja escreve "AURIX DYNAMICS" em HTML, na
 * fonte Chakra Petch do sistema.
 */

import aurixMarkSvg from '../assets/aurix-mark.svg?raw';
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
 * O monograma: o emblema oficial do pacote de marca (recorte de
 * `assets/aurix-mark.svg`, ver comentario no topo do arquivo). Sem
 * `<defs>`/gradientes — cada fragmento ja carrega a propria cor solida —
 * entao, ao contrario da versao anterior deste arquivo, nao ha id nenhum
 * para colidir quando a marca aparece duas vezes na mesma pagina (pausa e
 * confirmacao de abandono); as duas copias sao o mesmo texto estatico.
 */
const markSvg = (): string => aurixMarkSvg;

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
