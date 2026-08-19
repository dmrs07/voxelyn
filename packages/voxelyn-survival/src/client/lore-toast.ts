// O AVISO DE ARQUIVO DESBLOQUEADO.
//
// ---------------------------------------------------------------------------
// POR QUE ELE EXISTE
// ---------------------------------------------------------------------------
// O digest de leitura (rota `/api/progression/lore-digest`) mediu o que ninguem
// sabia: 28 perfis, 230 fragmentos desbloqueados, e VINTE E UM perfis que nunca
// abriram um so. A mediana de leitura e zero. Dois perfis respondem por cerca
// de 85% de tudo o que foi lido no jogo inteiro.
//
// O numero que desmonta a hipotese obvia e o balde do meio: so TRES perfis
// leram exatamente um e pararam. Se o problema fosse texto longo demais, o
// abandono estaria ali. Nao esta. As pessoas nao desistem no meio da leitura,
// elas nunca comecam — o `AX-PUB-001` esta desbloqueado para os 28 e foi aberto
// por 6.
//
// Entao o alvo nao e o tamanho do texto, e o PRIMEIRO CLIQUE. Este modulo tira
// o primeiro contato do painel e o leva ate onde o jogador ja esta olhando.
//
// ---------------------------------------------------------------------------
// DUAS FORMAS, UM MECANISMO
// ---------------------------------------------------------------------------
// - ESTREIA: o primeiro fragmento que o perfil desbloquear na vida chega
//   ABERTO, com as primeiras linhas do corpo na tela. Zero clique ate a
//   primeira frase de lore que a pessoa le no jogo.
// - DEMAIS: cartao compacto, so codigo e titulo. Sutil, mais perto de um
//   "achievement unlocked" que de uma tela de leitura.
//
// Nos dois casos o cartao inteiro e clicavel e abre o documento na Matriz. E o
// que remove a navegacao do caminho: quem quiser ler nao precisa descobrir onde
// o arquivo mora.

import { t } from './i18n';
import { isoDocumentIconSvg } from './matrix-icons';

/** O que o cartao precisa saber sobre um fragmento. */
export type LoreToastItem = {
  id: string;
  /** O codigo do documento, como ele aparece no Codex (AX-PUB-001). */
  code: string;
  title: string;
  /** Corpo completo. So a estreia mostra as primeiras linhas dele. */
  body: string;
};

export type LoreToastHost = {
  /** Abrir o documento na Matriz. O cartao inteiro chama isto. */
  onOpen: (id: string) => void;
  /** Efeito sonoro da interface, se houver. */
  ui?: () => void;
};

/** Quanto do corpo a estreia mostra. Duas frases, nao um paragrafo. */
const DEBUT_CHARS = 190;

/**
 * Quanto tempo cada cartao fica.
 *
 * A estreia fica mais: ela tem texto para ler, e sumir no meio da primeira
 * frase seria pior que nao ter aparecido.
 */
const DWELL_MS = 9_000;
const DEBUT_DWELL_MS = 16_000;

const STORAGE_KEY = 'voxelyn.lore.debut';

/** O perfil ja recebeu a estreia? Storage bloqueado responde "sim". */
const debutDone = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Sem storage, a estreia viraria "toda vez": melhor nunca do que sempre.
    return true;
  }
};

const markDebutDone = (): void => {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignora */
  }
};

/** Corta no limite de palavra e sinaliza que continua. */
const excerpt = (body: string): string => {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (clean.length <= DEBUT_CHARS) return clean;
  const cut = clean.slice(0, DEBUT_CHARS);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : DEBUT_CHARS)}…`;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

export class LoreToasts {
  private readonly queue: LoreToastItem[] = [];
  private showing: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly host: LoreToastHost,
  ) {}

  /**
   * Enfileira os fragmentos recem-desbloqueados.
   *
   * Um por vez, e nao uma pilha: uma run que desbloqueia quatro arquivos
   * empilharia quatro cartoes na mesma esquina, o que le como erro. A fila
   * tambem e o que permite a estreia ter tratamento proprio sem competir.
   */
  push(items: readonly LoreToastItem[]): void {
    if (items.length === 0) return;
    this.queue.push(...items);
    if (!this.showing) this.next();
  }

  /** Some com o que estiver na tela e esquece a fila. */
  clear(): void {
    this.dismiss();
    this.queue.length = 0;
  }

  private next(): void {
    const item = this.queue.shift();
    if (!item) return;
    const debut = !debutDone();
    if (debut) markDebutDone();
    this.render(item, debut);
  }

  private dismiss(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const node = this.showing;
    this.showing = null;
    if (!node) return;
    node.classList.add('is-leaving');
    // Espera a transicao de saida antes de remover; se ela nao existir (motion
    // reduzido), o timeout ainda limpa o no.
    setTimeout(() => node.remove(), 320);
    if (this.queue.length > 0) setTimeout(() => this.next(), 380);
  }

  private render(item: LoreToastItem, debut: boolean): void {
    const card = el('button', `lore-toast${debut ? ' is-debut' : ''}`);
    card.type = 'button';

    // A folha isometrica, deitada na mesma projecao do mundo. Ela e o que faz
    // o cartao ser reconhecido antes de ser lido — em um canto da tela, a
    // silhueta chega primeiro que qualquer palavra. `innerHTML` de constante,
    // como o resto dos icones: nao ha texto de jogador nenhum aqui dentro.
    const icon = el('span', 'lore-toast-icon');
    icon.innerHTML = isoDocumentIconSvg();

    const head = el('div', 'lore-toast-head');
    head.append(
      el('span', 'lore-toast-tag', t(debut ? 'lore.toast.debut' : 'lore.toast.unlocked')),
      el('span', 'lore-toast-code', item.code),
    );

    const column = el('div', 'lore-toast-col');
    column.append(head, el('div', 'lore-toast-title', item.title));
    if (debut) {
      column.append(el('p', 'lore-toast-body', excerpt(item.body)));
    }
    column.append(el('div', 'lore-toast-cta', t('lore.toast.open')));
    card.append(icon, column);

    card.addEventListener('click', () => {
      this.host.ui?.();
      this.dismiss();
      this.host.onOpen(item.id);
    });

    this.root.append(card);
    this.showing = card;
    // Um quadro antes de ligar a classe de entrada: sem isso o navegador
    // aplica o estado final direto e a transicao nao acontece.
    requestAnimationFrame(() => card.classList.add('is-in'));
    this.timer = setTimeout(() => this.dismiss(), debut ? DEBUT_DWELL_MS : DWELL_MS);
  }
}

/**
 * Os fragmentos que apareceram entre dois perfis.
 *
 * O servidor devolve a lista INTEIRA de desbloqueados, nunca o delta, entao
 * quem sabe o que e novidade e o cliente, comparando com o perfil que ele ja
 * tinha em cache. Sem perfil anterior nao ha novidade: um primeiro login
 * legitimo traria dezenas de fragmentos de uma vez, e anunciar todos eles seria
 * confete no lugar de aviso.
 */
export const newlyUnlocked = (
  before: readonly string[] | null | undefined,
  after: readonly string[] | null | undefined,
): string[] => {
  if (!before || !after) return [];
  const had = new Set(before);
  return after.filter((id) => !had.has(id));
};
