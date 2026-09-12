// A assinatura do relatorio: o campo de nome na tela de fim.
//
// POR QUE ELE EXISTE
// ---------------------------------------------------------------------------
// O nome que vai ao ranking morava num lugar so — Opcoes > Operador —, e uma
// tela de opcoes e exatamente onde ninguem passa antes da primeira descida. O
// resultado e que a maioria das runs subia sem nome e o livro ficava cheio de
// "anonimo"; o jogador so descobria que havia um campo DEPOIS de ver a propria
// run sem nome, quando ja nao dava para corrigir.
//
// O campo aparece onde a decisao acontece: no fim da run que valeu a pena. Sem
// estrela nenhuma ele nao aparece — uma morte no primeiro setor nao vai ao
// livro, e pedir um nome ali seria pedir assinatura num documento que ninguem
// vai arquivar.
//
// POR QUE ELE E HTML, E NAO CANVAS
// ---------------------------------------------------------------------------
// A tela de fim inteira e desenhada em canvas, e este painel e a unica parte
// dela que nao e. Entrada de texto em canvas significa reimplementar cursor,
// selecao, teclado virtual, IME e colar — e significa reimplementar tudo isso
// PIOR do que o navegador ja faz. Um `<input>` de verdade tambem e o unico que
// o corretor do celular, o gerenciador de senha e o leitor de tela entendem.
//
// O preco e que ele flutua por cima do documento em vez de fazer parte dele, e
// e por isso que ele se ANCORA: `anchorAbove` recebe a moldura dos botoes que
// `renderEnd` devolve e se poe logo acima dela. Sem isso o painel cobriria as
// metricas da run — a tela ficaria pedindo o nome por cima da razao de o
// jogador querer dar um.
import { t } from './i18n';
import type { Rect } from './module-layout';
import './run-name-prompt.css';

/**
 * De quem e o nome que se pede.
 *
 * `solo` e o nome do Prospector. `team` e o nome da EQUIPE, e so o dono da sala
 * o digita: a run de co-op gera UMA linha no livro, e duas pessoas assinando a
 * mesma linha seria a segunda apagando a primeira. Ver `name_run` no protocolo.
 */
export type NamePromptKind = 'solo' | 'team';

/**
 * Como o campo foi resolvido.
 *
 * `null` significa "nao mexi no nome salvo" e nasce so do botao de pular. Uma
 * string — INCLUSIVE vazia — significa "e este": esvaziar o campo de proposito
 * e uma escolha (subir anonimo), e trata-la como desistencia devolveria ao
 * jogador o nome que ele acabou de apagar.
 */
export type NameChoice = string | null;

const MAX_NAME = 18;

export class RunNamePrompt {
  readonly element = document.createElement('section');
  private readonly field = document.createElement('input');
  private readonly label = document.createElement('label');
  private readonly hint = document.createElement('p');
  private readonly confirm = document.createElement('button');
  private readonly skip = document.createElement('button');
  private done: ((choice: NameChoice) => void) | null = null;
  /** Ultimo `bottom` aplicado, para nao reescrever estilo a 60 Hz. */
  private anchored = -1;

  constructor() {
    this.element.className = 'run-name';
    this.element.hidden = true;
    this.element.append(this.label, this.field, this.hint, this.buttons());
    this.field.id = 'run-name-field';
    this.field.maxLength = MAX_NAME;
    // Via atributo: o `autocomplete` tipado do DOM nao aceita 'nickname', que e
    // justamente o valor certo aqui — e o que faz o navegador oferecer o apelido
    // ja usado em vez do nome completo do dono do aparelho.
    this.field.setAttribute('autocomplete', 'nickname');
    this.label.htmlFor = this.field.id;
    this.label.className = 'run-name-label';
    this.hint.className = 'run-name-hint';

    // O canvas da tela de fim ouve ponteiro para saber qual botao um toque
    // acertou. Sem esta barreira, tocar no campo para digitar tambem contaria
    // como toque na tela atras — e o toque que abre o teclado reiniciaria a run.
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
    // Mesma historia para o teclado: Espaco e Enter sao acoes de jogo, e um
    // nome com espaco no meio nao pode disparar nenhuma delas.
    this.element.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.resolve(this.typed());
      }
    });
  }

  private buttons(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'run-name-actions';
    this.skip.type = 'button';
    this.skip.className = 'run-name-skip';
    this.skip.addEventListener('click', () => this.resolve(null));
    this.confirm.type = 'button';
    this.confirm.className = 'run-name-confirm';
    this.confirm.addEventListener('click', () => this.resolve(this.typed()));
    row.append(this.skip, this.confirm);
    return row;
  }

  private typed(): string {
    return this.field.value.trim().slice(0, MAX_NAME);
  }

  /** Este painel esta esperando uma resposta agora? */
  get waiting(): boolean {
    return this.done !== null;
  }

  /**
   * Abre o campo e chama `done` com o que o jogador decidir.
   *
   * `done` SEMPRE e chamado — nao ha caminho em que ele fique pendurado. Quem
   * chama esta segurando o envio da run ao ranking, e um envio que nunca
   * acontece e pior que um envio sem nome.
   *
   * CALLBACK, E NAO PROMESSA, e a diferenca e um defeito de verdade e nao
   * estilo: o `then` de uma promessa so roda no microtask seguinte, DEPOIS do
   * bloco sincrono que a resolveu. No co-op esse bloco e o que trata "descer de
   * novo" — ele fecha o socket logo abaixo da chamada a `settle()`, e o envio do
   * nome chegaria a um socket ja fechado, que o `NetClient` descarta calado. Com
   * callback o nome sai antes de o socket cair.
   */
  open(kind: NamePromptKind, prefill: string, done: (choice: NameChoice) => void): void {
    // Uma abertura por vez. Se ainda havia uma pendente (a run anterior, numa
    // sequencia rapida de reinicios), ela resolve com o que estava no campo em
    // vez de vazar uma promessa que ninguem mais aguarda.
    this.settle();
    this.label.textContent = t(kind === 'team' ? 'runname.label.team' : 'runname.label.solo');
    this.hint.textContent = t(kind === 'team' ? 'runname.hint.team' : 'runname.hint.solo');
    this.confirm.textContent = t('runname.confirm');
    this.skip.textContent = t('runname.skip');
    this.field.placeholder = t('options.name.placeholder');
    this.field.value = prefill;
    this.element.hidden = false;
    this.anchored = -1;
    this.done = done;
  }

  private resolve(choice: NameChoice): void {
    const done = this.done;
    this.done = null;
    this.element.hidden = true;
    // Devolve o foco ao documento. Sem isto o campo escondido continua sendo o
    // elemento focado e as teclas da run seguinte iriam todas para dentro dele.
    if (this.element.contains(document.activeElement)) this.field.blur();
    done?.(choice);
  }

  /**
   * Fecha o campo com o que estiver escrito nele.
   *
   * Chamado quando o jogador sai da tela de fim por conta propria — descer de
   * novo, voltar ao terminal, fechar a aba. Sair NAO e desistir do nome: o
   * campo ja nasce preenchido com o nome salvo, entao quem simplesmente ignorou
   * o painel envia exatamente o nome que enviaria antes de ele existir. E quem
   * digitou e saiu sem apertar nada nao perde o que digitou.
   */
  settle(): void {
    if (this.done) this.resolve(this.typed());
  }

  /**
   * Poe o painel logo acima dos botoes da tela de fim.
   *
   * `rect` e a moldura de um dos botoes, em pixels de CSS, como `renderEnd` a
   * devolve. `null` (a tela de fim ainda nao desenhou, ou dispensou o rodape)
   * deixa o painel no rodape da viewport — a unica posicao que nao depende de
   * uma medida que ainda nao existe.
   *
   * Escreve estilo so quando o numero MUDA: este metodo e chamado a cada
   * quadro, e reatribuir `style.bottom` com o mesmo valor sessenta vezes por
   * segundo invalida layout sessenta vezes por segundo.
   */
  anchorAbove(rect: Rect | null): void {
    if (this.element.hidden) return;
    const bottom = rect ? Math.max(8, window.innerHeight - rect.y + 12) : 8;
    if (Math.abs(bottom - this.anchored) < 1) return;
    this.anchored = bottom;
    this.element.style.bottom = `${bottom}px`;
  }
}
