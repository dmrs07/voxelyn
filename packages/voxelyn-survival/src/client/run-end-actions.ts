// As duas saidas da tela de fim, como geometria. Sem canvas aqui: so onde os
// botoes ficam e qual deles um toque acertou.
//
// Antes deste arquivo a tela de fim tinha UMA saida: qualquer toque, em
// qualquer lugar, descia de novo. Isso responde bem a unica pergunta que o
// jogador faz depois de morrer rapido ("de novo") e nao responde nenhuma das
// outras duas — gastar no terminal o minerio que a run rendeu, ou simplesmente
// parar. As duas existiam, escondidas atras do gesto de segurar o topo da tela
// para abrir o menu de campo; um gesto que ninguem descobre no momento em que
// esta lendo o proprio relatorio de morte.
//
// Com duas saidas, "toque em qualquer lugar" deixa de ser uma resposta: um
// toque ambiguo teria de escolher por conta propria, e escolheria errado
// metade das vezes. Por isso o alvo passa a ser explicito — e por isso ele
// mora aqui, testavel em Node, e nao no meio das mil linhas de `renderEnd`.

import type { Rect } from './module-layout';

/** Descer de novo, ou voltar ao terminal (o menu principal). */
export type EndAction = 'restart' | 'terminal';

export type EndActionRegions = { restart: Rect; terminal: Rect };

/**
 * Folga de toque alem da moldura desenhada, em pixels de CSS.
 *
 * O dedo acerta o centro do que ve, mas erra a borda por alguns pixels — e
 * esta e a tela em que um erro de borda parece o jogo ter travado, porque nada
 * mais responde a toque aqui.
 *
 * Vale para fora: em cima, embaixo e nos lados de fora. Entre os dois botoes
 * quem manda e a linha do meio do vao (veja `endActionAt`) — com `unit` de 7
 * pixels o vao inteiro tem 6, e duas folgas de 6 se sobreporiam ali.
 */
export const END_ACTION_HIT_PAD = 6;

/** Altura do botao, em unidades tipograficas da tela de fim. */
export const BUTTON_UNITS = 2;
/** Vao horizontal entre os dois botoes, em unidades. */
export const GAP_UNITS = 0.9;
/** Respiro entre a ultima linha do documento e o topo dos botoes. */
export const TOP_GAP_UNITS = 1.2;
/**
 * Quanto a tela de fim precisa reservar para o rodape de acoes, em unidades:
 * o respiro, os botoes e a folga que sobra abaixo deles.
 *
 * Exportado porque `renderEnd` soma os coeficientes de TODOS os blocos antes
 * de escolher o `unit` que faz o documento caber — um numero solto la dentro
 * desandaria em silencio no dia em que o botao mudar de altura aqui.
 */
export const ACTIONS_UNITS = TOP_GAP_UNITS + BUTTON_UNITS + 0.5;

/**
 * Os dois botoes, lado a lado e centrados.
 *
 * Lado a lado sempre, inclusive no celular em pe: empilhados eles somariam
 * mais duas unidades de altura numa tela que ja encolhe o documento inteiro
 * para caber (o caso completo tem nove metricas, carga, registro e dica), e o
 * que sobraria de espaco sairia do texto que explica a morte. A largura e que
 * cede — ate o minimo de seis unidades —, e o rotulo encolhe com ela.
 *
 * @param vw largura da viewport, em pixels de CSS
 * @param top borda superior dos botoes
 * @param unit a unidade tipografica ja resolvida pela tela de fim
 * @param margin a margem da moldura do documento
 */
export const layoutEndActions = (
  vw: number,
  top: number,
  unit: number,
  margin: number,
): EndActionRegions => {
  const gap = unit * GAP_UNITS;
  // Uma unidade de recuo de cada lado: o botao nunca encosta na moldura.
  const available = Math.max(unit * 12, vw - margin * 2 - unit * 2);
  const w = Math.max(unit * 6, Math.min(unit * 13, (available - gap) / 2));
  const h = unit * BUTTON_UNITS;
  return {
    restart: { x: vw / 2 - gap / 2 - w, y: top, w, h },
    terminal: { x: vw / 2 + gap / 2, y: top, w, h },
  };
};

/**
 * A faixa vertical dos botoes, com a folga do dedo em cima e embaixo.
 *
 * Em cima e embaixo a folga acompanha a altura do botao, e nao so o minimo
 * fixo: numa paisagem de 320px o documento inteiro encolhe e o botao fica com
 * 15 pixels de altura, que e menos da metade de um dedo. Nada mais responde a
 * toque acima nem abaixo dele, entao crescer nesse eixo nao tira nada de
 * ninguem.
 */
const inRow = (rect: Rect, y: number): boolean => {
  const pad = Math.max(END_ACTION_HIT_PAD, rect.h * 0.35);
  return y >= rect.y - pad && y <= rect.y + rect.h + pad;
};

/**
 * Qual acao um toque em (x, y) acertou, ou null se ele caiu no vazio.
 *
 * O vao entre os botoes e dividido ao meio: tudo a esquerda da linha desce de
 * novo, tudo a direita volta ao terminal. Nao ha zona morta entre eles nem
 * ponto que responda as duas coisas — um toque no vao pertence ao botao mais
 * proximo, que e o que o jogador quis dizer.
 *
 * Fora da faixa dos botoes o toque NAO vale nada, e isso e a mudanca: enquanto
 * a tela de fim tinha uma saida so, um toque em qualquer lugar descia de novo.
 * Com duas, o toque ambiguo teria de adivinhar — e adivinharia errado metade
 * das vezes, na tela em que a escolha errada custa a run seguinte.
 */
export const endActionAt = (regions: EndActionRegions, x: number, y: number): EndAction | null => {
  const { restart, terminal } = regions;
  const mid = (restart.x + restart.w + terminal.x) / 2;
  if (x < mid) {
    return inRow(restart, y) && x >= restart.x - END_ACTION_HIT_PAD ? 'restart' : null;
  }
  return inRow(terminal, y) && x <= terminal.x + terminal.w + END_ACTION_HIT_PAD
    ? 'terminal'
    : null;
};
