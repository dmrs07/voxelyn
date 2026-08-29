// A abertura no DOM: o unico arquivo do boot que toca elementos.
//
// A divisao e a mesma que a trilha composta usa (`soundtrack.ts` decide,
// `soundtrack-bus.ts` faz soar): `boot-flow` sabe QUANDO cada tela entra,
// `boot-plan` sabe O QUE esta sendo carregado, e este arquivo so obedece. Nada
// aqui decide fase nem progresso — se decidisse, a maquina de estados teria um
// segundo dono e a ordem das telas voltaria a depender de quem escreveu por
// ultimo.
//
// O markup vive em `index.html`, ja pintado antes de qualquer script, e nao e
// construido aqui de proposito: um `innerHTML` no boot chegaria tarde demais
// para ser a primeira coisa que o jogador ve.

import { t, type MessageKey } from '../i18n';
import type { BootPhase, BootTiming } from './boot-flow';
import { DEVELOPER_IDENT, type DeveloperIdent } from './developer-ident';

/** Caminho do fundo, relativo a base do app (vite `base: './'`). */
export const BOOT_KEYART_URL = 'boot/keyart-1600.webp';

const el = <T extends HTMLElement>(id: string): T | null =>
  (document.getElementById(id) as T | null) ?? null;

/**
 * Rotulo de estado por tarefa do preload.
 *
 * O texto NAO e enfeite: ele nomeia a tarefa mais pesada que ainda nao
 * liquidou, ou seja, exatamente aquilo que a barra esta esperando naquele
 * instante. Uma tarefa sem rotulo cai no texto generico — e o que mantem a
 * promessa de "adicionar uma tarefa nova nao exige reescrever a tela".
 */
const STATUS_KEY: Record<string, MessageKey> = {
  fonts: 'boot.status.fonts',
  'atlas-core': 'boot.status.core',
  'atlas-terrain': 'boot.status.terrain',
  'atlas-props': 'boot.status.props',
  keyart: 'boot.status.keyart',
};

export class BootScreen {
  private readonly root = el<HTMLDivElement>('boot');
  private readonly stages: Record<string, HTMLElement | null> = {
    identity: el('boot-identity'),
    loading: el('boot-loading'),
    failed: el('boot-failure'),
  };
  private readonly meter = el<HTMLDivElement>('boot-meter');
  private readonly meterFill = el<HTMLElement>('boot-meter-fill');
  private readonly percent = el<HTMLSpanElement>('boot-percent');
  private readonly status = el<HTMLSpanElement>('boot-status');
  private readonly detail = el<HTMLParagraphElement>('boot-error-detail');
  private readonly retryButton = el<HTMLButtonElement>('btn-boot-retry');
  private readonly keyart = el<HTMLImageElement>('boot-keyart');

  /** `true` quando o markup da abertura existe. Ver `boot/index.ts`. */
  get mounted(): boolean {
    return this.root !== null;
  }

  /**
   * Escreve os tempos do perfil ativo como variaveis de CSS.
   *
   * E o que impede o numero de existir em dois lugares: o CSS le
   * `--boot-fade-in` e nunca conhece um valor proprio, entao
   * `prefers-reduced-motion` e o modo de desenvolvimento (que ja chegam
   * zerados de `boot-flow`) valem para a folha inteira sem uma segunda regra.
   */
  applyTiming(timing: BootTiming): void {
    const style = this.root?.style;
    if (!style) return;
    style.setProperty('--boot-fade-in', `${timing.identityFadeInMs}ms`);
    style.setProperty('--boot-fade-out', `${timing.identityFadeOutMs}ms`);
    style.setProperty('--boot-handoff', `${timing.handoffFadeMs}ms`);
  }

  /**
   * Monta a identidade do DESENVOLVEDOR — nunca a da companhia do jogo.
   *
   * A distincao esta escrita por extenso em `developer-ident.ts` e vale
   * repetir aqui, porque o emblema da Aurix esta a um import de distancia e
   * cabe bonito nesta tela: ele e ficcao interna, e usa-lo aqui diria ao
   * jogador que a Aurix fez o jogo.
   *
   * Devolve a imagem da marca quando ha uma para carregar, para que o preload
   * a espere como qualquer outro recurso — e para que a falha dela seja apenas
   * a tipografia sozinha, nunca um icone quebrado no meio da abertura.
   */
  mountIdentity(ident: DeveloperIdent = DEVELOPER_IDENT): HTMLImageElement | null {
    const nameSlot = el<HTMLDivElement>('boot-ident-name');
    if (nameSlot) nameSlot.textContent = ident.name;
    const markSlot = el<HTMLDivElement>('boot-ident-mark');
    if (!markSlot || !ident.markUrl) return null;
    const image = document.createElement('img');
    image.className = 'ax-boot-ident-mark';
    image.alt = ident.markAlt ?? ident.name;
    // `onerror` esconde o no: um `<img>` que falha desenha o icone de imagem
    // quebrada do navegador, e uma tela de abertura com um icone quebrado no
    // centro e pior do que uma tela de abertura sem marca.
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = ident.markUrl;
    markSlot.appendChild(image);
    return image;
  }

  /**
   * A opacidade da marca, escrita por quadro a partir de `identityOpacity`.
   *
   * Inline e nao por classe: a curva inteira (entra, fica, sai) acontece dentro
   * da fase de identidade, e uma transicao de CSS so saberia comecar quando a
   * fase ja tivesse acabado — a marca sairia por cima da tela de carregamento.
   */
  setIdentityOpacity(value: number): void {
    const stage = this.stages.identity;
    if (stage) stage.style.opacity = String(value);
  }

  /**
   * A imagem de fundo, se o navegador aceitar cria-la.
   *
   * O `src` e atribuido AQUI e nao no HTML por um motivo de ordem: assim o
   * pedido nasce junto do resto do preload, contado pela barra como qualquer
   * outra tarefa, em vez de competir com os atlas antes de o boot existir.
   */
  requestKeyart(): HTMLImageElement | null {
    if (!this.keyart) return null;
    this.keyart.src = BOOT_KEYART_URL;
    return this.keyart;
  }

  /** Acende o fundo. Chamado so quando a imagem terminou de decodificar. */
  revealKeyart(): void {
    this.keyart?.classList.add('is-ready');
  }

  /**
   * Poe uma fase na tela.
   *
   * `handoff` nao tem tela propria: ele e a fase de carregamento em 100% mais
   * o escurecimento da abertura inteira, que `dismiss` dispara. Mostrar uma
   * quarta tela no handoff seria um piscar a mais no exato momento em que a
   * sequencia precisa parecer continua.
   */
  showPhase(phase: BootPhase): void {
    if (!this.root) return;
    const visible = phase === 'handoff' ? 'loading' : phase;
    this.root.dataset.phase = visible;
    for (const [name, stage] of Object.entries(this.stages)) {
      stage?.classList.toggle('is-current', name === visible);
    }
    // O foco vai para o botao quando a tela de erro entra: sem isso, quem
    // navega por teclado fica com o foco num elemento que acabou de sumir.
    if (phase === 'failed') this.retryButton?.focus();
  }

  /**
   * Desenha o progresso. `fraction` vem de `bootProgress`, nunca de um relogio.
   *
   * O arredondamento e para BAIXO: um `Math.round` mostraria "100%" com uma
   * tarefa ainda no ar, e a barra passaria os ultimos instantes contradizendo
   * a tela que ela mesma esta segurando.
   */
  setProgress(fraction: number, pendingId?: string): void {
    const clamped = Math.max(0, Math.min(1, fraction));
    const percent = Math.floor(clamped * 100);
    if (this.meterFill) this.meterFill.style.width = `${clamped * 100}%`;
    if (this.percent) this.percent.textContent = `${percent}%`;
    this.meter?.setAttribute('aria-valuenow', String(percent));
    if (!this.status) return;
    const key = pendingId ? STATUS_KEY[pendingId] : undefined;
    this.status.textContent = t(key ?? (clamped >= 1 ? 'boot.status.ready' : 'boot.status.start'));
  }

  /**
   * O motivo tecnico da falha, logo abaixo do texto humano.
   *
   * NAO e traduzido de proposito: sao nomes de arquivo e mensagens de erro do
   * navegador, e traduzi-los so dificultaria colar o problema num relatorio. O
   * texto que explica o que aconteceu, esse e localizado no HTML.
   *
   * Escreve o detalhe e nada mais — quem poe a tela de erro no ar continua
   * sendo `showPhase`, para que exista um caminho unico de troca de fase.
   */
  setFailureDetail(detail: string): void {
    if (this.detail) this.detail.textContent = detail;
  }

  onRetry(handler: () => void): void {
    this.retryButton?.addEventListener('click', handler);
  }

  /**
   * Encerra a abertura: escurece e some.
   *
   * O `hidden` no fim e obrigatorio e nao cosmetico — um elemento de tela
   * cheia com `opacity: 0` continua engolindo todo toque do jogador, e o menu
   * revelado por baixo dele ficaria bonito e completamente morto.
   */
  dismiss(fadeMs: number): void {
    if (!this.root) return;
    const root = this.root;
    root.dataset.phase = 'done';
    if (fadeMs <= 0) {
      root.hidden = true;
      return;
    }
    setTimeout(() => {
      root.hidden = true;
    }, fadeMs);
  }
}
