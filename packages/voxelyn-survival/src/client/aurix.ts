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
 * O desenho e o emblema oficial da companhia (pacote de marca Aurix Dynamics):
 * uma placa triangular chanfrada de bronze com fendas de teal aceso — o "A" da
 * Aurix como peca de maquinario, nao como letra. O arquivo fonte e o vetor
 * "clean editable" do pacote, recortado so no emblema — o wordmark do pacote
 * fica de fora porque `.corp-name` ja escreve "AURIX DYNAMICS" em HTML, na
 * fonte Chakra Petch do sistema, e duplicar o nome como path so inflaria o
 * SVG sem ganhar nada.
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
 * Contador de instancias, para os ids de gradiente e filtro do emblema.
 *
 * Um id fixo custou uma placa inteira: as duas telas montam a marca, os
 * `<linearGradient>`/`<filter>` nasciam com o MESMO id e o `url(#...)` da
 * segunda resolvia para a definicao da primeira. Como a primeira vive dentro
 * de uma overlay `display:none`, o navegador nao pinta o servidor de tinta
 * que ela contem — e a segunda marca aparecia vazia, so com a dobra escura
 * visivel. O sintoma (metade de um simbolo) nao aponta para a causa (ids
 * iguais), e por isso o numero fica aqui em vez de a marca ser copiada certa
 * "com cuidado".
 */
let markSerial = 0;

/**
 * O monograma: o emblema oficial do pacote de marca, recortado so na placa
 * triangular (o wordmark do arquivo fonte fica de fora — ver comentario no
 * topo do arquivo). Sem `width`/`height` — quem monta decide o tamanho por
 * CSS. O `viewBox` tem folga em volta da geometria (62–405, 545–858 no
 * arquivo fonte) para caber o desfoque da sombra e do brilho de teal sem
 * cortar.
 */
const markSvg = (): string => {
  const serial = (markSerial += 1);
  const id = (name: string): string => `${name}-${serial}`;
  return `
<svg class="corp-mark" viewBox="37 520 393 363" role="img" aria-label="${AURIX_NAME}">
  <defs>
    <linearGradient id="${id('goldMain')}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#332516"/>
      <stop offset=".16" stop-color="#9b7440"/>
      <stop offset=".34" stop-color="#e3c084"/>
      <stop offset=".50" stop-color="#6c4d27"/>
      <stop offset=".68" stop-color="#c89c5a"/>
      <stop offset=".86" stop-color="#4a341d"/>
      <stop offset="1" stop-color="#d8ae6c"/>
    </linearGradient>
    <linearGradient id="${id('goldVertical')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f0d59a"/>
      <stop offset=".12" stop-color="#9a7139"/>
      <stop offset=".35" stop-color="#4b3219"/>
      <stop offset=".58" stop-color="#d0a965"/>
      <stop offset=".78" stop-color="#6c4b27"/>
      <stop offset="1" stop-color="#1f180f"/>
    </linearGradient>
    <linearGradient id="${id('darkMetal')}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#050607"/>
      <stop offset=".22" stop-color="#241f19"/>
      <stop offset=".48" stop-color="#080a0b"/>
      <stop offset=".72" stop-color="#3b3022"/>
      <stop offset="1" stop-color="#08090a"/>
    </linearGradient>
    <linearGradient id="${id('tealCore')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5ffff"/>
      <stop offset=".22" stop-color="#aafffa"/>
      <stop offset=".55" stop-color="#28e6dd"/>
      <stop offset="1" stop-color="#028b94"/>
    </linearGradient>
    <radialGradient id="${id('tealHalo')}">
      <stop offset="0" stop-color="#dfffff" stop-opacity="1"/>
      <stop offset=".25" stop-color="#66fff2" stop-opacity=".95"/>
      <stop offset=".65" stop-color="#0bbcc2" stop-opacity=".36"/>
      <stop offset="1" stop-color="#0bbcc2" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id('edgeHighlight')}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#4a3318"/>
      <stop offset=".5" stop-color="#ffe4a5"/>
      <stop offset="1" stop-color="#52381e"/>
    </linearGradient>
    <filter id="${id('shadow')}" x="-30%" y="-30%" width="160%" height="170%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b"/>
      <feOffset dy="6" result="o"/>
      <feColorMatrix in="o" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 0"/>
      <feBlend in="SourceGraphic"/>
    </filter>
    <filter id="${id('cyanGlow')}" x="-250%" y="-250%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feColorMatrix in="blur" values="0 0 0 0 0.05  0 0 0 0 1  0 0 0 0 0.94  0 0 0 1 0" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id('metalTexture')}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="19" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0" result="gray"/>
      <feComponentTransfer in="gray" result="contrast">
        <feFuncR type="linear" slope=".28" intercept=".40"/>
        <feFuncG type="linear" slope=".28" intercept=".40"/>
        <feFuncB type="linear" slope=".28" intercept=".40"/>
        <feFuncA type="linear" slope=".24"/>
      </feComponentTransfer>
      <!-- recorta a textura pela silhueta antes de misturar: sem isso o
           feBlend pinta o retangulo INTEIRO da regiao do filtro, nao so o
           traco (bug do pacote de origem — visivel como uma mancha
           fantasma atras do emblema). -->
      <feComposite in="contrast" in2="SourceAlpha" operator="in" result="contrastClipped"/>
      <feBlend in="SourceGraphic" in2="contrastClipped" mode="overlay"/>
    </filter>
    <filter id="${id('fineBevel')}" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="4" specularConstant=".55" specularExponent="18" lighting-color="#fff5d9" result="spec">
        <feDistantLight azimuth="225" elevation="52"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut"/>
      <feBlend in="SourceGraphic" in2="specOut" mode="screen"/>
    </filter>
  </defs>
  <g filter="url(#${id('shadow')})">
    <!-- placa externa: silhueta e aletas -->
    <path d="M232 545 L251 549 L284 605 L298 612 L348 731 L405 801 L367 824 L311 798 L290 802 L260 839 L233 858 L207 838 L179 802 L157 798 L101 824 L62 801 L118 732 L167 613 L182 606 L215 549 Z"
          fill="#070809" stroke="#3b2a18" stroke-width="3"/>
    <!-- moldura blindada principal -->
    <path d="M231 550 L248 553 L278 610 L292 617 L340 737 L391 798 L364 814 L309 788 L282 794 L258 828 L233 846 L210 827 L185 794 L158 788 L103 814 L76 798 L127 737 L175 617 L188 610 L217 553 Z"
          fill="url(#${id('darkMetal')})" stroke="url(#${id('edgeHighlight')})" stroke-width="3" filter="url(#${id('fineBevel')})"/>
    <!-- blindagem superior, esquerda e direita -->
    <path d="M218 563 L185 619 L142 721 L161 742 L194 670 L228 601 Z"
          fill="url(#${id('goldMain')})" stroke="#1e160e" stroke-width="3" filter="url(#${id('metalTexture')})"/>
    <path d="M247 563 L280 619 L323 721 L304 742 L271 670 L237 601 Z"
          fill="url(#${id('goldMain')})" stroke="#1e160e" stroke-width="3" filter="url(#${id('metalTexture')})"/>
    <!-- trilhos externos escuros -->
    <path d="M183 618 L135 724 L112 774 L146 755 L178 684 L206 622 Z"
          fill="url(#${id('darkMetal')})" stroke="#b78a4f" stroke-width="2"/>
    <path d="M282 618 L330 724 L353 774 L319 755 L287 684 L259 622 Z"
          fill="url(#${id('darkMetal')})" stroke="#b78a4f" stroke-width="2"/>
    <!-- asas inferiores -->
    <path d="M143 724 L113 774 L72 799 L103 817 L159 790 L184 794 L210 829 L207 777 L181 732 L161 750 Z"
          fill="url(#${id('goldMain')})" stroke="#21170e" stroke-width="3" filter="url(#${id('metalTexture')})"/>
    <path d="M322 724 L352 774 L393 799 L362 817 L306 790 L281 794 L255 829 L258 777 L284 732 L304 750 Z"
          fill="url(#${id('goldMain')})" stroke="#21170e" stroke-width="3" filter="url(#${id('metalTexture')})"/>
    <!-- paineis embutidos das asas -->
    <path d="M112 776 L79 799 L103 811 L155 786 L179 789 L193 808 L188 782 L159 762 Z"
          fill="url(#${id('darkMetal')})" stroke="#8f6a39" stroke-width="1.5"/>
    <path d="M353 776 L386 799 L362 811 L310 786 L286 789 L272 808 L277 782 L306 762 Z"
          fill="url(#${id('darkMetal')})" stroke="#8f6a39" stroke-width="1.5"/>
    <!-- cavidade central escura -->
    <path d="M231 571 L264 631 L282 690 L257 767 L232 816 L207 767 L182 690 L201 631 Z"
          fill="#050708" stroke="#201a12" stroke-width="4"/>
    <!-- corpo central do A -->
    <path d="M232 596 L286 775 L258 775 L247 738 L218 738 L206 775 L178 775 Z
             M232 655 L222 714 L243 714 Z"
          fill="url(#${id('goldVertical')})" fill-rule="evenodd" stroke="#2a1d10" stroke-width="3"
          filter="url(#${id('metalTexture')})"/>
    <!-- bordas internas de brilho -->
    <path d="M232 602 L281 771 L269 771 L232 645 L195 771 L183 771 Z"
          fill="none" stroke="#e4bd73" stroke-width="2" opacity=".88"/>
    <path d="M211 731 L253 731" stroke="#f1cf89" stroke-width="4"/>
    <path d="M215 740 L249 740" stroke="#3d2a16" stroke-width="4"/>
    <!-- capa superior -->
    <path d="M218 555 L247 555 L261 583 L252 607 L214 607 L205 583 Z"
          fill="url(#${id('darkMetal')})" stroke="url(#${id('goldMain')})" stroke-width="3"/>
    <path d="M223 565 L242 565 L249 588 L244 600 L220 600 L215 588 Z"
          fill="#0a1213" stroke="#6e5734" stroke-width="1.5"/>
    <!-- lanca inferior -->
    <path d="M216 774 L232 814 L249 774 L256 822 L233 855 L209 824 Z"
          fill="url(#${id('darkMetal')})" stroke="#674a29" stroke-width="2"/>
    <path d="M232 816 L232 850" stroke="#a27641" stroke-width="2" opacity=".75"/>
    <!-- halos de luz teal -->
    <ellipse cx="232" cy="593" rx="31" ry="23" fill="url(#${id('tealHalo')})" opacity=".68"/>
    <ellipse cx="232" cy="690" rx="22" ry="39" fill="url(#${id('tealHalo')})" opacity=".66"/>
    <ellipse cx="136" cy="742" rx="24" ry="31" fill="url(#${id('tealHalo')})" opacity=".46"/>
    <ellipse cx="328" cy="742" rx="24" ry="31" fill="url(#${id('tealHalo')})" opacity=".46"/>
    <ellipse cx="169" cy="809" rx="24" ry="14" fill="url(#${id('tealHalo')})" opacity=".34"/>
    <ellipse cx="296" cy="809" rx="24" ry="14" fill="url(#${id('tealHalo')})" opacity=".34"/>
    <!-- nucleos de luz teal -->
    <path d="M222 579 L242 579 L238 598 L232 605 L226 598 Z"
          fill="url(#${id('tealCore')})" filter="url(#${id('cyanGlow')})"/>
    <path d="M232 661 L245 704 L232 687 L219 704 Z"
          fill="url(#${id('tealCore')})" filter="url(#${id('cyanGlow')})"/>
    <path d="M133 727 L143 730 L136 758 L126 755 Z"
          fill="url(#${id('tealCore')})" filter="url(#${id('cyanGlow')})"/>
    <path d="M331 727 L321 730 L328 758 L338 755 Z"
          fill="url(#${id('tealCore')})" filter="url(#${id('cyanGlow')})"/>
    <path d="M151 810 Q167 798 180 802 L174 810 Q162 807 151 816 Z"
          fill="url(#${id('tealCore')})" opacity=".72" filter="url(#${id('cyanGlow')})"/>
    <path d="M314 810 Q298 798 285 802 L291 810 Q303 807 314 816 Z"
          fill="url(#${id('tealCore')})" opacity=".72" filter="url(#${id('cyanGlow')})"/>
    <!-- rebites -->
    <g fill="#c59a5d" opacity=".55">
      <circle cx="188" cy="634" r="2"/><circle cx="277" cy="634" r="2"/>
      <circle cx="158" cy="705" r="2"/><circle cx="307" cy="705" r="2"/>
      <circle cx="118" cy="788" r="2"/><circle cx="347" cy="788" r="2"/>
    </g>
  </g>
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
