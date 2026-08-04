import { aurixPlateHtml } from './aurix';
import { isEditingText } from './input';
import { HoldToOpen, PAUSE_HOLD_MS, isInPauseZone } from './pause';
import { t } from './i18n';

/**
 * O menu de campo: a unica porta de saida de uma run em andamento.
 *
 * Antes dele, uma run comecada so terminava de tres formas — morrer, extrair ou
 * fechar a aba. A terceira e a que doia: quem quisesse trocar de modo, baixar o
 * volume ou simplesmente parar tinha de matar a pagina, e a telemetria contava
 * isso como abandono de jogador frustrado sem conseguir distinguir de quem so
 * queria mexer numa opcao.
 *
 * Os gestos que abrem estao explicados em `pause.ts`. Aqui mora o que eles
 * acionam: overlay, confirmacao do abandono e a integracao com o botao VOLTAR.
 */

export type PauseHost = {
  /** Ha uma run em andamento — rodando OU na tela de fim. */
  runActive: () => boolean;
  /** A run corrente ja acabou (morte ou extracao)? */
  runTerminal: () => boolean;
  /** Este modo congela o mundo enquanto o menu esta aberto? (solo sim, co-op nao) */
  freezesWorld: () => boolean;
  /** Linha de estado a mostrar no cabecalho (setor, contaminacao). */
  status: () => string;
  onOpen: () => void;
  onClose: () => void;
  /** O jogador desistiu: encerre a run e volte ao menu principal. */
  onAbandon: () => void;
  /** Clique de UI (som). */
  ui: () => void;
};

/**
 * Marca da nossa entrada no historico.
 *
 * Existe para que `history.back()` no fim da run so seja chamado quando a
 * entrada sentinela e de fato a atual. Sem a checagem, um back cego mandaria o
 * jogador para fora do jogo — para a pagina anterior do navegador.
 */
type RunHistoryState = { voxelynRun?: true };

export class PauseMenu {
  private readonly hold = new HoldToOpen();
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private open = false;
  private confirming = false;
  /** A sentinela de historico esta na pilha? */
  private historyArmed = false;
  /** Ignora UM popstate: o que a nossa propria saida provoca. */
  private swallowPop = false;

  private readonly overlay: HTMLDivElement;
  private readonly confirmOverlay: HTMLDivElement;
  private readonly statusLine: HTMLDivElement;
  private readonly coopWarning: HTMLDivElement;
  private readonly abandonButton: HTMLButtonElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: PauseHost,
  ) {
    this.overlay = document.getElementById('pause') as HTMLDivElement;
    this.confirmOverlay = document.getElementById('pause-confirm') as HTMLDivElement;
    this.statusLine = document.getElementById('pause-status') as HTMLDivElement;
    this.coopWarning = document.getElementById('pause-coop-warning') as HTMLDivElement;
    this.abandonButton = document.getElementById('btn-pause-abandon') as HTMLButtonElement;

    this.mountPlates();
  }

  /**
   * (Re)monta as placas da companhia. Chamado tambem por `refreshLabels`: o
   * lema da placa de rescisao e localizado, e trocar de idioma no bloco de
   * opcoes que este menu hospeda tem de valer para ele tambem.
   */
  private mountPlates(): void {
    for (const id of ['pause-mark', 'pause-confirm-mark']) {
      const slot = document.getElementById(id);
      if (slot) slot.innerHTML = aurixPlateHtml(id === 'pause-confirm-mark');
    }
  }

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    // Direto no canvas, e nao na janela: assim um toque numa overlay aberta
    // nunca alimenta o gesto — o DOM de cima ja engoliu o evento.
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('popstate', this.onPopState);

    document.getElementById('btn-pause-resume')?.addEventListener('click', () => this.close());
    this.abandonButton.addEventListener('click', () => this.requestAbandon());
    document
      .getElementById('btn-abandon-cancel')
      ?.addEventListener('click', () => this.cancelAbandon());
    document
      .getElementById('btn-abandon-confirm')
      ?.addEventListener('click', () => this.confirmAbandon());
  }

  // -------------------------------------------------------------------------
  // Historico: o botao VOLTAR do celular
  // -------------------------------------------------------------------------

  /**
   * Chamado ao iniciar uma run. Empilha uma entrada sentinela para que o gesto
   * de voltar tenha para onde voltar sem sair da pagina.
   */
  armHistory(): void {
    if (this.historyArmed) return;
    try {
      history.pushState({ voxelynRun: true } satisfies RunHistoryState, '');
      this.historyArmed = true;
    } catch {
      // Historico bloqueado (iframe restrito, storage particionado): os outros
      // dois gestos continuam de pe. Perder o botao voltar nao pode derrubar o
      // resto do menu.
    }
  }

  /** Chamado ao sair da run. Desfaz a sentinela, se ela ainda for a entrada atual. */
  disarmHistory(): void {
    if (!this.historyArmed) return;
    this.historyArmed = false;
    const state = history.state as RunHistoryState | null;
    if (state?.voxelynRun !== true) return; // outra navegacao ja a consumiu
    this.swallowPop = true;
    history.back();
  }

  private readonly onPopState = (): void => {
    if (this.swallowPop) {
      this.swallowPop = false;
      return;
    }
    if (!this.historyArmed || !this.host.runActive()) return;
    // A sentinela acabou de ser consumida pelo voltar. Reponha-a antes de
    // qualquer outra coisa: sem isso, o segundo voltar sai da pagina no meio da
    // run — que e exatamente a perda que este menu existe para evitar.
    this.historyArmed = false;
    this.armHistory();
    if (this.confirming) this.cancelAbandon();
    else if (this.open) this.close();
    else this.openMenu();
  };

  // -------------------------------------------------------------------------
  // Gestos
  // -------------------------------------------------------------------------

  private readonly onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' && ev.key !== 'p' && ev.key !== 'P') return;
    // ESCAPE continua valendo dentro do campo de nome: fechar a tela e o que ele
    // significa em qualquer lugar. O P, nao — ali ele e a letra P, e um jogador
    // chamado "Pedro" veria o menu fechar e a run voltar na primeira letra.
    if (ev.key !== 'Escape' && isEditingText(ev.target)) return;
    if (!this.host.runActive()) return;
    ev.preventDefault();
    if (this.confirming) this.cancelAbandon();
    else if (this.open) this.close();
    else this.openMenu();
  };

  private readonly onPointerDown = (ev: PointerEvent): void => {
    // Toque apenas. No mouse, segurar o botao na parte de cima da tela e mirar
    // e atirar para cima — o gesto roubaria a arma do jogador de desktop.
    if (ev.pointerType !== 'touch') return;
    if (this.open || this.confirming || !this.host.runActive()) return;
    if (!isInPauseZone(ev.clientY, window.innerHeight)) return;
    this.hold.begin(ev.pointerId, ev.clientX, ev.clientY, performance.now());
    if (this.holdTimer !== null) clearTimeout(this.holdTimer);
    // +8 ms de folga: o timer pode acordar um fio de tempo antes do prazo, e
    // `completed` recusaria por microssegundos.
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null;
      if (this.hold.completed(performance.now()) && this.host.runActive()) this.openMenu();
    }, PAUSE_HOLD_MS + 8);
  };

  private readonly onPointerMove = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'touch' || !this.hold.pending) return;
    this.hold.drag(ev.pointerId, ev.clientX, ev.clientY);
  };

  private readonly onPointerUp = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'touch') return;
    this.hold.end(ev.pointerId);
  };

  // -------------------------------------------------------------------------
  // Abrir / fechar
  // -------------------------------------------------------------------------

  get isOpen(): boolean {
    return this.open || this.confirming;
  }

  /**
   * Reescreve o que este menu monta por codigo: a linha de estado e o rotulo do
   * abandono.
   *
   * Separado de `openMenu` porque os dois textos tambem envelhecem SEM
   * reabertura — a troca de idioma acontece dentro deste menu, no bloco de
   * opcoes que ele hospeda, e sem isto o jogador trocaria de lingua e veria a
   * frase anterior no botao que ele esta prestes a apertar.
   */
  refreshLabels(): void {
    this.statusLine.textContent = this.host.status();
    this.abandonButton.textContent = t(this.host.runTerminal() ? 'pause.leave' : 'pause.abandon');
    this.mountPlates();
  }

  openMenu(): void {
    if (this.open || this.confirming) return;
    this.open = true;
    this.cancelHold();
    this.refreshLabels();
    // O aviso so aparece quando e verdade. No solo o mundo REALMENTE parou, e
    // avisar do contrario ali ensinaria o jogador a nao acreditar no aviso
    // justamente no modo em que ele importa.
    this.coopWarning.classList.toggle('hidden', this.host.freezesWorld());
    this.overlay.classList.remove('hidden');
    this.host.ui();
    this.host.onOpen();
  }

  close(): void {
    if (!this.open && !this.confirming) return;
    this.open = false;
    this.confirming = false;
    this.overlay.classList.add('hidden');
    this.confirmOverlay.classList.add('hidden');
    this.cancelHold();
    this.host.ui();
    this.host.onClose();
  }

  private cancelHold(): void {
    this.hold.cancel();
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Abandono
  // -------------------------------------------------------------------------

  private requestAbandon(): void {
    // Numa run que ja acabou nao ha nada a perder: a tela de fim ja foi lida, o
    // resultado ja foi gravado e enviado. Pedir confirmacao ali seria cerimonia
    // sobre uma decisao sem consequencia.
    if (this.host.runTerminal()) {
      this.host.ui();
      this.leave();
      return;
    }
    this.open = false;
    this.confirming = true;
    this.overlay.classList.add('hidden');
    this.confirmOverlay.classList.remove('hidden');
    this.host.ui();
  }

  private cancelAbandon(): void {
    if (!this.confirming) return;
    this.confirming = false;
    this.open = true;
    this.confirmOverlay.classList.add('hidden');
    this.overlay.classList.remove('hidden');
    this.host.ui();
  }

  private confirmAbandon(): void {
    this.host.ui();
    this.leave();
  }

  /** Fecha tudo e devolve o jogador ao menu principal. */
  private leave(): void {
    this.open = false;
    this.confirming = false;
    this.overlay.classList.add('hidden');
    this.confirmOverlay.classList.add('hidden');
    this.cancelHold();
    this.disarmHistory();
    this.host.onAbandon();
  }
}
