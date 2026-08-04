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
// Decisões de custo, porque isto roda num celular:
// - cada célula anima SÓ `transform: scale` com `transition-delay` própria —
//   nenhuma propriedade de pintura muda por quadro;
// - o sequenciamento é por setTimeout, não por transitionend: um evento
//   perdido (aba oculta, célula removida) travaria o véu na tela para sempre;
// - o custo tem TETO em qualquer tela: o hexágono cresce até a colmeia caber
//   em ~700 células e o passo diagonal encolhe até a onda durar o mesmo que
//   dura no celular — um monitor 1920×1080 não paga nem mais spans nem mais
//   segundos que um 844×390.
//
// `prefers-reduced-motion` pula a onda: a MESMA sequência roda na hora
// (preparar → trocar), sem véu e sem estática.

/** Largura base de um hexágono, px. Pequeno o bastante para ler "colmeia". */
const HEX_W = 34;
/** Proporção de altura de um hexágono de topo pontudo: 2/√3. */
const HEX_RATIO = 1.1547;
/** Passo máximo do atraso por diagonal (linha+coluna), ms. */
const DELAY_STEP = 13;
/** Duração da transição de UMA célula, ms — casa com o CSS de `.ax-veil`. */
const CELL_MS = 240;
/** Pausa mínima com a tela totalmente preta, antes de reabrir, ms. */
const HOLD_MS = 140;
/** Teto de células da colmeia: acima disto o hexágono cresce. */
const CELL_CAP = 700;
/** Teto da duração da onda (do primeiro ao último atraso), ms. */
const WAVE_MS = 520;

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
  // O hexágono cresce até a colmeia caber no teto de células: numa tela 4×
  // maior a célula é ~2× maior, e o número de spans é o mesmo do celular.
  const baseCells =
    (Math.ceil(width / HEX_W) + 1) * (Math.ceil(height / (HEX_W * HEX_RATIO * 0.75)) + 1);
  const hexW = baseCells > CELL_CAP ? HEX_W * Math.sqrt(baseCells / CELL_CAP) : HEX_W;
  const hexH = hexW * HEX_RATIO;
  // Colunas/linhas com uma de folga: a fileira ímpar desloca meio hexágono e
  // a última célula precisa cobrir a borda mesmo assim.
  const cols = Math.ceil(width / hexW) + 1;
  const rows = Math.ceil(height / (hexH * 0.75)) + 1;
  // O passo encolhe até a onda caber no teto de duração: a diagonal de um
  // monitor grande tem mais células, não mais segundos.
  const step = Math.min(DELAY_STEP, WAVE_MS / Math.max(1, rows + cols - 2));
  let maxDelay = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = document.createElement('span');
      const delay = Math.round((row + col) * step);
      maxDelay = Math.max(maxDelay, delay);
      cell.style.width = `${hexW}px`;
      cell.style.height = `${hexH}px`;
      cell.style.left = `${col * hexW + (row % 2 === 1 ? hexW / 2 : 0) - hexW / 2}px`;
      cell.style.top = `${row * hexH * 0.75 - hexH / 2}px`;
      cell.style.transitionDelay = `${delay}ms`;
      // O mesmo atraso na ANIMAÇÃO do lampejo teal: é ele que faz a frente de
      // onda brilhar célula a célula em vez de a tela inteira piscar junto.
      cell.style.animationDelay = `${delay}ms`;
      veil.appendChild(cell);
    }
  }
  document.body.appendChild(veil);

  // Reflow: sem ele o navegador aplicaria escala 0 e 1 no mesmo quadro e
  // nenhuma transição aconteceria.
  void veil.offsetWidth;
  veil.classList.add('is-closed');
  seq.sound?.();

  const sweep = maxDelay + CELL_MS + 50;
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

  // Reabre na MESMA ordem de atrasos: a célula que fechou primeiro abre
  // primeiro, e a onda atravessa a tela em vez de voltar. A classe de
  // abertura troca o lampejo teal de lado — a frente de onda brilha na
  // borda que está se dissolvendo.
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
