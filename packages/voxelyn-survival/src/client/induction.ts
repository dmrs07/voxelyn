// A INDUCAO DO OPERADOR: o documento que a companhia entrega antes da primeira
// descida.
//
// ---------------------------------------------------------------------------
// POR QUE ELE EXISTE
// ---------------------------------------------------------------------------
// O jogo nao ensinava nada. Quem clicava "Descer" caia num setor sem saber quais
// eram as teclas, o que estava procurando, por que a carga so vale se ele
// voltar, ou que a arma esquenta — e descobria as quatro coisas morrendo, uma
// por vez. Isso nao e dificuldade, e informacao sonegada: a run so e uma
// DECISAO depois que o jogador sabe o que esta em jogo.
//
// ---------------------------------------------------------------------------
// O QUE ELE NAO E
// ---------------------------------------------------------------------------
// Nao e um tutorial guiado, e nao e um catalogo. Ele para exatamente onde a
// descoberta comeca: diz que o Veio REAGE a fogo, corrente e acido, e nao diz o
// que cada combinacao faz. Quem quiser saber que gas sulfuroso explode
// descobre no escuro — ou lendo os Arquivos Aurix depois, que e para onde o §6
// aponta de proposito. A funcao dele e tornar a primeira descida legivel, nao
// resolve-la.
//
// ---------------------------------------------------------------------------
// FORMA
// ---------------------------------------------------------------------------
// E um DOCUMENTO da companhia, no mesmo cromo dos Arquivos (`codex-doc`), e nao
// uma tela de tutorial com setas e balões. A ficcao carrega a pedagogia: um
// operador remoto recebe uma circular obrigatoria antes do turno, e o tom
// corporativo — que notifica em vez de ensinar — e o que faz o texto caber no
// mundo em vez de ficar por cima dele.
//
// Montado por DOM e nao por `innerHTML` com interpolacao, pela mesma regra do
// Registro: nada aqui vem de fora, e manter a regra e mais barato que auditar a
// excecao.

import { DESKTOP_CONTROLS } from './desktop-controls';
import { t, type MessageKey } from './i18n';

/** Um artigo da circular: codigo, titulo e corpo. */
type Article = { code: MessageKey; title: MessageKey; body: MessageKey };

/**
 * Os seis artigos, na ordem em que a primeira descida precisa deles.
 *
 * Identidade antes de objetivo (o jogador precisa saber que a morte e prevista
 * ANTES de saber o que procurar, senao o primeiro fim de run le como fracasso
 * total), objetivo antes de ambiente, ambiente antes de armamento — e o arquivo
 * por ultimo, porque e o unico que aponta para fora desta tela.
 */
const ARTICLES: readonly Article[] = [
  { code: 'induction.asset.code', title: 'induction.asset.title', body: 'induction.asset.body' },
  {
    code: 'induction.contract.code',
    title: 'induction.contract.title',
    body: 'induction.contract.body',
  },
  { code: 'induction.vein.code', title: 'induction.vein.title', body: 'induction.vein.body' },
  { code: 'induction.heat.code', title: 'induction.heat.title', body: 'induction.heat.body' },
  { code: 'induction.echo.code', title: 'induction.echo.title', body: 'induction.echo.body' },
  {
    code: 'induction.archive.code',
    title: 'induction.archive.title',
    body: 'induction.archive.body',
  },
];

export type InductionHost = {
  /** O jogador terminou de ler. Em `briefing`, e aqui que a descida sai. */
  onDismiss: () => void;
  /**
   * O jogador prefere o exercicio antes do contrato. So aparece no `briefing`
   * (e so quando o chamador oferece): e a alternativa da primeira leitura, e
   * quem reabre a circular no despacho ja tem o botao proprio no terminal.
   */
  onTraining?: () => void;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * O ESQUEMA DE COMANDO, montado da MESMA lista que a barra do jogo desenha.
 *
 * Duplicar as teclas aqui seria criar uma segunda verdade sobre o teclado, e a
 * primeira vez que ela divergisse seria justamente na tela que existe para
 * ensinar. `DESKTOP_CONTROLS` e a fonte; esta tabela e uma vista dela.
 */
const controlsTable = (): HTMLElement => {
  const wrap = el('div', 'induction-controls');
  for (const control of DESKTOP_CONTROLS) {
    const row = el('div', 'induction-control');
    const keys = el('div', 'induction-keys');
    for (const cap of control.caps) keys.append(el('kbd', 'induction-key', cap));
    row.append(keys, el('span', 'induction-control-label', t(control.label)));
    wrap.append(row);
  }
  return wrap;
};

/** Monta a circular inteira dentro de `body`, substituindo o que houver la. */
export const renderInduction = (body: HTMLElement, host: InductionHost): void => {
  body.replaceChildren();

  body.append(el('p', 'induction-preamble', t('induction.preamble')));

  for (const article of ARTICLES) {
    const doc = el('article', 'codex-doc');
    doc.append(
      el('div', 'codex-code', t(article.code)),
      el('h3', undefined, t(article.title)),
      el('p', 'codex-body', t(article.body)),
    );
    body.append(doc);
  }

  const scheme = el('section', 'codex-doc induction-scheme');
  scheme.append(
    el('div', 'codex-code', t('induction.controls.title')),
    controlsTable(),
    el('p', 'codex-source', t('induction.controls.note')),
  );
  body.append(scheme);

  const footer = el('div', 'induction-footer');
  const action = el('button', 'primary ax-stamp');
  action.type = 'button';
  action.textContent = t('induction.begin');
  action.addEventListener('click', () => host.onDismiss());
  footer.append(action);
  // A alternativa do novato: treinar antes de autorizar. Secundaria de
  // proposito — a descida real continua sendo o carimbo, e o exercicio nunca
  // e obrigatorio.
  if (host.onTraining) {
    const training = el('button', 'ax-order-secondary');
    training.type = 'button';
    training.textContent = t('induction.training');
    const onTraining = host.onTraining;
    training.addEventListener('click', () => onTraining());
    footer.append(training);
  }
  body.append(footer);
};

// ---------------------------------------------------------------------------
// "Ja li isto?"
// ---------------------------------------------------------------------------

const SEEN_KEY = 'voxelyn.induction.seen';

/**
 * A circular ja foi entregue neste navegador?
 *
 * Storage bloqueado (modo privativo, iframe particionado) responde NAO, e a
 * consequencia e mostrar o documento de novo — que e o erro barato. Responder
 * SIM por engano esconderia para sempre a unica tela que ensina a jogar.
 */
export const inductionSeen = (): boolean => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

export const markInductionSeen = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* sem storage: a circular volta na proxima sessao, e tudo bem */
  }
};
