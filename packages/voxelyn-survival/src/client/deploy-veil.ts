// O véu de deploy: a transição entre o terminal e o Veio.
//
// Toda troca entre a UI e o canvas do jogo passa por uma colmeia de hexágonos
// pretos que fecha em onda DIAGONAL (canto superior esquerdo → inferior
// direito), troca a tela por baixo e segue abrindo na mesma direção — a onda
// atravessa, como um obturador de escotilha. É a ficção do despacho: a unidade
// não "aparece" no Veio, ela é DEPLOYADA através do casco.
//
// O véu não é decoração paralela ao início da run — ele GOVERNA o ciclo:
//
//   fechar ‖ preparar → trocar sob o preto → primeiro quadro → abrir → liberar
//
// `prepare` (autorização, conexão, montagem do mundo) corre em paralelo com a
// onda que fecha e é aguardado antes da troca; `swap` acontece sob o preto
// total; a reabertura só começa depois de o primeiro quadro do novo estado ter
// sido APRESENTADO; e a promessa devolvida só resolve com o véu removido — é
// nela que o chamador liga a progressão e devolve os controles.
//
// Enquanto o véu existe, NENHUM input passa: os toques morrem no próprio
// elemento (tela cheia) e o teclado é barrado por um handler de captura na
// janela — Enter repetido no carimbo não emite segunda autorização. Uma
// ativação com outra no ar é RECUSADA (resolve `false`, nada roda): o clique
// duplicado é descartado, nunca duplicado.
//
// Decisões de custo, porque isto roda num celular. Esta é a TERCEIRA
// estratégia, e a lição das duas primeiras está gravada aqui:
// - v1 animava a COR de cada célula — pintura por quadro em centenas de
//   clip-paths, engasgo no meio da onda;
// - v2 animava `transform` por célula — sem pintura, mas ~390 nós criados no
//   clique + ~390 camadas com `will-change` era peso demais para GPU de
//   celular, e o engasgo continuou;
// - v3 (esta): ZERO células. O véu são TRÊS elementos fixos — um retângulo
//   preto gigante rotacionado que desliza cobrindo a tela (o obturador), e o
//   fio de fósforo atrás de um estêncil de colmeia estático (mask-image) que
//   dá a borda celular. Duas animações de transform no total, custo
//   independente do tamanho da tela.
// - o sequenciamento é por setTimeout, não por animationend: um evento
//   perdido (aba oculta, elemento removido) travaria o véu na tela;
//
// `prefers-reduced-motion` pula a onda: a MESMA sequência roda na hora
// (preparar → trocar), sem véu e sem estática.

/** Largura de um hexágono do estêncil, px — o passo visual da colmeia. */
const HEX_W = 34;
/** Proporção de altura de um hexágono de topo pontudo: 2/√3. */
const HEX_RATIO = 1.1547;
/** Duração de UMA varredura (fechar ou abrir), ms — igual em toda tela. */
const SWEEP_MS = 780;
/** Pausa mínima com a tela totalmente preta, antes de reabrir, ms. */
const HOLD_MS = 140;

let busy = false;

/** Há uma transição no ar? Ativações novas serão recusadas até ela acabar. */
export const veilActive = (): boolean => busy;

export type DeploySequence = {
  /**
   * Corre em PARALELO com a onda que fecha e é aguardado antes da troca:
   * autorização, conexão, montagem do mundo. Erros aqui são do preparador —
   * o véu segue a sequência e abre de volta sobre o que `swap` mostrar.
   */
  prepare?: () => void | Promise<void>;
  /** A troca de telas, sob o preto total. Desenhe aqui o primeiro quadro. */
  swap: () => void;
  /** A estática de rádio, no início de cada varredura (fechar e abrir). */
  sound?: () => void;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * O estêncil da colmeia: um tile SVG (período hexW × 1.5·hexH) com hexágonos
 * levemente encolhidos (0.92) nas mesmas posições das células — as costuras
 * entre eles são o que devolve ao fio a aparência de acender CÉLULA a célula
 * em vez de uma faixa contínua. Branco é o que a máscara deixa visível.
 */
const hexStencilSvg = (hexW: number, hexH: number): string => {
  const tileH = hexH * 1.5;
  const s = 0.92;
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  const hex = (cx: number, cy: number): string => {
    const hw = (hexW / 2) * s;
    const q = (hexH / 4) * s;
    const h = (hexH / 2) * s;
    return (
      `M${r2(cx)} ${r2(cy - h)}L${r2(cx + hw)} ${r2(cy - q)}L${r2(cx + hw)} ${r2(cy + q)}` +
      `L${r2(cx)} ${r2(cy + h)}L${r2(cx - hw)} ${r2(cy + q)}L${r2(cx - hw)} ${r2(cy - q)}Z`
    );
  };
  // Os cinco centros de um período: os quatro cantos (fileiras pares) e o
  // meio deslocado meia célula (fileiras ímpares) — igual ao laço das células.
  const d = [
    hex(0, 0),
    hex(hexW, 0),
    hex(hexW / 2, hexH * 0.75),
    hex(0, tileH),
    hex(hexW, tileH),
  ].join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(hexW)}" height="${r2(tileH)}"><path fill="#fff" d="${d}"/></svg>`;
};

/**
 * O quadro trocado em `swap` de fato APRESENTADO na tela. Dois rAF: o
 * primeiro roda antes da pintura do quadro corrente, o segundo garante que
 * aquela pintura aconteceu. Fallback por timeout para aba oculta, onde rAF
 * não dispara — o véu nunca pode ficar preso esperando um quadro que não vem.
 */
const firstFramePresented = (): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, 250);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });

/**
 * Executa a sequência de deploy sob o véu.
 *
 * Resolve `true` com o véu já removido e a sequência inteira executada — é o
 * sinal de "liberado": progressão e controles voltam a partir daí. Resolve
 * `false` se outra transição estava no ar: NADA da sequência roda, e o
 * chamador deve tratar a ativação como descartada.
 */
export const deployVeil = async (seq: DeploySequence): Promise<boolean> => {
  if (busy) return false;
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof document === 'undefined') {
    // Sem onda, mesma ordem: preparar, depois trocar. O `busy` continua de
    // guarda — Enter repetido durante a autorização é recusado igual.
    busy = true;
    try {
      await seq.prepare?.();
      seq.swap();
    } finally {
      busy = false;
    }
    return true;
  }
  busy = true;

  // O teclado morre na captura da janela enquanto o véu existir: é o que
  // impede Enter/Espaço repetidos no carimbo ainda focado de reativarem o
  // clique — e qualquer atalho de jogo de vazar para um mundo em troca.
  const blockKeys = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  window.addEventListener('keydown', blockKeys, true);
  window.addEventListener('keyup', blockKeys, true);

  // A preparação começa JUNTO com a onda — a autorização viaja enquanto a
  // colmeia fecha. O erro é engolido aqui de propósito: o estado de falha é
  // responsabilidade do preparador; o véu só garante que a tela nunca fica
  // presa no preto.
  const prepared = Promise.resolve()
    .then(() => seq.prepare?.())
    .catch(() => {});

  const veil = document.createElement('div');
  veil.className = 'ax-veil';

  const width = window.innerWidth;
  const height = window.innerHeight;
  // O percurso em px desta tela: um translate de -S a +S move a frente
  // diagonal de x+y=0 até x+y=vw+vh (Δ(x+y) = 4S), com folga para a faixa
  // do fio entrar e sair limpa.
  veil.style.setProperty('--ax-sweep', `${(width + height) / 4 + 200}px`);

  // O obturador: um retângulo preto gigante, rotacionado 45°, cuja metade
  // TRASEIRA é sólida — deslizando, ele cobre tudo atrás da frente diagonal.
  // É ele que garante o preto total, sem depender de célula nenhuma.
  const fill = document.createElement('div');
  fill.className = 'ax-veil-fill';
  fill.style.animationDuration = `${SWEEP_MS}ms`;
  veil.appendChild(fill);

  // A borda celular: o fio de fósforo viaja por transform ATRÁS de um
  // estêncil de colmeia estático (mask-image no passo real dos hexágonos).
  // Cada abertura acende quando a faixa cruza por baixo — o olho vê hexágonos
  // piscando na frente de onda; o navegador só move uma camada.
  const stencil = document.createElement('div');
  stencil.className = 'ax-veil-stencil';
  const mask = `url("data:image/svg+xml,${encodeURIComponent(hexStencilSvg(HEX_W, HEX_W * HEX_RATIO))}")`;
  stencil.style.setProperty('mask-image', mask);
  stencil.style.setProperty('-webkit-mask-image', mask);
  const front = document.createElement('i');
  front.className = 'ax-veil-front';
  front.style.animationDuration = `${SWEEP_MS}ms`;
  stencil.appendChild(front);
  veil.appendChild(stencil);
  document.body.appendChild(veil);

  // Reflow: garante que o estado inicial exista antes da classe que anima.
  void veil.offsetWidth;
  veil.classList.add('is-closed');
  seq.sound?.();

  const sweep = SWEEP_MS;
  await wait(sweep);
  // Sob o preto: a preparação precisa ter TERMINADO antes da troca — é isto
  // que impede o mundo de nascer (ou o loop de girar) atrás de uma tela que
  // ainda não é a dele.
  await prepared;
  try {
    seq.swap();
  } catch {
    // A troca é do chamador; a abertura é nossa. Um swap que lança não pode
    // deixar a tela presa no preto.
  }
  await firstFramePresented();
  await wait(HOLD_MS);

  // Reabre na MESMA direção: a onda atravessa a tela em vez de voltar. A
  // troca de classe inverte os gradientes (o preto passa para a frente da
  // linha, revelando atrás) — uma repintura única, feita sob o preto total,
  // onde nenhum quadro dela é visível.
  veil.classList.remove('is-closed');
  veil.classList.add('is-opening');
  seq.sound?.();
  await wait(sweep);

  veil.remove();
  window.removeEventListener('keydown', blockKeys, true);
  window.removeEventListener('keyup', blockKeys, true);
  busy = false;
  return true;
};
