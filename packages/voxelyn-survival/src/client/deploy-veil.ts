// O véu de deploy: a transição entre o terminal e o Veio.
//
// Toda troca entre a UI e o canvas do jogo passa por uma colmeia de hexágonos
// pretos que fecha em onda DIAGONAL (canto superior esquerdo → inferior
// direito), troca a tela por baixo e segue abrindo na mesma direção — a onda
// atravessa, como um obturador de escotilha. É a ficção do despacho: a unidade
// não "aparece" no Veio, ela é DEPLOYADA através do casco.
//
// Decisões de custo, porque isto roda num celular:
// - cada célula anima SÓ `transform: scale` com `transition-delay` própria —
//   nenhuma propriedade de pintura muda por quadro;
// - o sequenciamento é por setTimeout, não por transitionend: um evento
//   perdido (aba oculta, célula removida) travaria o véu na tela para sempre;
// - o véu engole toques enquanto existe — sem isso, um segundo DESCER no meio
//   da onda dispararia duas runs.
//
// `prefers-reduced-motion` pula o véu inteiro: a troca é imediata, como era.

/** Largura de cada hexágono, px. Pequeno o bastante para ler como "colmeia". */
const HEX_W = 34;
/** Proporção de altura de um hexágono de topo pontudo: 2/√3. */
const HEX_H = HEX_W * 1.1547;
/** Passo do atraso por diagonal (linha+coluna), ms. */
const DELAY_STEP = 13;
/** Duração da transição de UMA célula, ms — casa com o CSS de `.ax-veil`. */
const CELL_MS = 240;
/** Pausa com a tela totalmente preta, antes de reabrir, ms. */
const HOLD_MS = 140;

let busy = false;
/** A troca do véu em voo, enquanto ainda não rodou. Ver o ramo `busy`. */
let flushPending: (() => void) | null = null;

/**
 * Fecha a colmeia, executa `swap` sob o preto total e reabre.
 *
 * `swap` é sempre chamado exatamente uma vez — inclusive quando o véu é
 * pulado (movimento reduzido) ou quando outra transição ainda está no ar
 * (caso em que a troca é imediata: perder a animação é melhor que perder o
 * clique).
 *
 * `sound` toca no INÍCIO de cada varredura (fechar e abrir): é o gancho da
 * estática de rádio que acompanha a onda. Opcional e nunca chamado quando o
 * véu é pulado — sem onda, sem estática.
 */
export const deployVeil = (swap: () => void, sound?: () => void): void => {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (busy || reduced || typeof document === 'undefined') {
    // Atropelar um véu em voo NÃO pode deixar a troca dele agendada: o timeout
    // dispararia depois desta e desfaria a tela mais nova (URL inválida, por
    // exemplo: DESCER agenda esconder o menu, o erro síncrono manda de volta,
    // e o timeout antigo esconderia o menu de novo — jogador preso num canvas
    // morto). A troca pendente roda AGORA, na ordem original, e o timeout dela
    // vira no-op.
    flushPending?.();
    swap();
    return;
  }
  busy = true;
  let done = false;
  const runSwap = (): void => {
    if (done) return;
    done = true;
    flushPending = null;
    swap();
  };
  flushPending = runSwap;

  const veil = document.createElement('div');
  veil.className = 'ax-veil';

  const width = window.innerWidth;
  const height = window.innerHeight;
  // Colunas/linhas com uma de folga: a fileira ímpar desloca meio hexágono e
  // a última célula precisa cobrir a borda mesmo assim.
  const cols = Math.ceil(width / HEX_W) + 1;
  const rows = Math.ceil(height / (HEX_H * 0.75)) + 1;
  let maxDelay = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = document.createElement('span');
      const delay = (row + col) * DELAY_STEP;
      maxDelay = Math.max(maxDelay, delay);
      cell.style.width = `${HEX_W}px`;
      cell.style.height = `${HEX_H}px`;
      cell.style.left = `${col * HEX_W + (row % 2 === 1 ? HEX_W / 2 : 0) - HEX_W / 2}px`;
      cell.style.top = `${row * HEX_H * 0.75 - HEX_H / 2}px`;
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
  sound?.();

  const sweep = maxDelay + CELL_MS + 50;
  setTimeout(() => {
    runSwap();
    setTimeout(() => {
      // Reabre na MESMA ordem de atrasos: a célula que fechou primeiro abre
      // primeiro, e a onda atravessa a tela em vez de voltar. A classe de
      // abertura troca o lampejo teal de lado — a frente de onda brilha na
      // borda que está se dissolvendo.
      veil.classList.remove('is-closed');
      veil.classList.add('is-opening');
      sound?.();
      setTimeout(() => {
        veil.remove();
        busy = false;
      }, sweep);
    }, HOLD_MS);
  }, sweep);
};
