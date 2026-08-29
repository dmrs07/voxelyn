// A abertura, montada: a maquina + o preload + a tela.
//
// Este e o unico ponto do jogo que sabe das tres coisas ao mesmo tempo, e o
// unico que `main.ts` precisa chamar. Tudo o que ele faz cabe em cinco linhas
// de prosa:
//
//   1. escolhe o perfil de tempo (normal, movimento reduzido, desenvolvimento);
//   2. dispara o preload IMEDIATAMENTE, junto com a identidade;
//   3. avanca a maquina de estados a cada quadro;
//   4. pinta a fase corrente e o progresso;
//   5. entrega o menu — uma vez so.
//
// A REGRA DO PASSO 5, que e a mais facil de quebrar num refactor: `onReady`
// roda no maximo UMA vez em toda a vida da pagina. O boot nao pode inicializar
// subsistema nenhum duas vezes, e uma nova tentativa depois de uma falha
// critica volta para a tela de carregamento sem nunca reapresentar a marca nem
// reexecutar a entrega.
//
// O QUE ESTA ABERTURA NAO FAZ, de proposito:
//
// - nao cria run, nao gera mundo, nao roda tick de simulacao. Preparar o
//   aplicativo e comecar uma partida sao coisas diferentes, e o preload so
//   toca em recursos COMPARTILHADOS (fontes, atlas, imagem de fundo).
// - nao encosta em audio. O `AudioContext` continua nascendo de um gesto do
//   jogador, como o navegador exige e como o jogo sempre fez; uma identidade
//   com jingle exigiria burlar a politica de autoplay para acabar em contexto
//   suspenso e som nenhum. O dia em que houver um sting de abertura, ele entra
//   como qualquer outro som: depois do primeiro toque.

import {
  advanceBoot,
  bootTiming,
  handoffTotalMs,
  identityOpacity,
  initialBootState,
  type BootPhase,
  type BootState,
} from './boot-flow';
import { runBootTasks, type BootReport, type BootTask } from './boot-tasks';
import { BootScreen } from './boot-screen';
import { DEVELOPER_IDENT, hasDeveloperIdent, type DeveloperIdent } from './developer-ident';

export type BootOptions = {
  /**
   * Monta a lista de tarefas desta abertura, recebendo a imagem de fundo que a
   * tela conseguiu criar (ou `null`).
   *
   * E uma funcao, e nao uma lista pronta, por duas razoes: o fundo so existe
   * depois de a tela ser montada, e assim o boot NAO precisa conhecer o
   * renderizador — quem liga uma coisa na outra e `main.ts`, com
   * `buildBootPlan`. O modulo da abertura fica sabendo de fases e progresso, e
   * de mais nada do jogo.
   */
  buildTasks: (assets: {
    keyart: HTMLImageElement | null;
    identMark: HTMLImageElement | null;
  }) => BootTask[];
  /** Chamado UMA vez, com a abertura ja escurecida: e a hora de revelar o menu. */
  onReady: () => void;
  /**
   * A identidade a apresentar. Por padrao a cadastrada em
   * `developer-ident.ts` — este parametro existe para os testes e para quem
   * quiser experimentar uma marca sem editar o modulo.
   */
  ident?: DeveloperIdent;
  /** Sobrescreve a deteccao de ambiente. So os testes passam isto. */
  env?: { reduced?: boolean; skip?: boolean; withoutIdentity?: boolean };
};

/** Le `?boot=skip` — o atalho de desenvolvimento. Ver `BOOT_TIMING_SKIPPED`. */
const skipRequested = (): boolean => {
  try {
    return new URLSearchParams(location.search).get('boot') === 'skip';
  } catch {
    return false;
  }
};

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Resume o laudo do preload numa linha para a tela de erro.
 *
 * So as tarefas CRITICAS entram: a tela existe para dizer por que o jogo nao
 * abriu, e listar junto uma degradacao cosmetica so afogaria a causa.
 */
const failureDetail = (report: BootReport): string =>
  report.outcomes
    .filter((outcome) => outcome.critical && !outcome.ok)
    .map(
      (outcome) => `${outcome.id}: ${String((outcome.error as Error)?.message ?? outcome.error)}`,
    )
    .join(' · ');

/**
 * Roda a sequencia de abertura.
 *
 * Resolve quando a abertura terminou (menu entregue). Nao rejeita: uma falha
 * critica termina na tela de erro, que fica no ar ate o jogador pedir nova
 * tentativa — e a promessa so resolve quando uma tentativa der certo.
 */
export const runBootSequence = async ({
  buildTasks,
  onReady,
  ident = DEVELOPER_IDENT,
  env,
}: BootOptions): Promise<void> => {
  const screen = new BootScreen();
  const timing = bootTiming({
    reduced: env?.reduced ?? prefersReducedMotion(),
    skip: env?.skip ?? skipRequested(),
    // Sem marca de desenvolvedor cadastrada, a fase de identidade atravessa em
    // zero: a ordem das telas continua a mesma, mas ninguem espera dois
    // segundos diante de um preto vazio. Ver `developer-ident.ts`.
    withoutIdentity: env?.withoutIdentity ?? !hasDeveloperIdent(ident),
  });

  // Sem o markup da abertura (uma pagina que nao seja o index principal, um
  // teste que so quer a maquina) o jogo abre como abria antes: direto no menu.
  // Melhor isso do que uma tela preta esperando elementos que nao existem.
  if (!screen.mounted) {
    onReady();
    return;
  }

  screen.applyTiming(timing);
  const identMark = screen.mountIdentity(ident);
  screen.showPhase('identity');

  const keyart = screen.requestKeyart();
  const tasks: BootTask[] = buildTasks({ keyart, identMark });

  let state: BootState = initialBootState(performance.now(), timing);
  let delivered = false;

  const paint = (phase: BootPhase): void => {
    screen.showPhase(phase);
    if (delivered) return;
    // `menu` conta junto com `handoff`, e nao por simetria: com um perfil de
    // duracao zero (o atalho de desenvolvimento, o handoff sob movimento
    // reduzido) a maquina atravessa as duas fases no mesmo instante e `handoff`
    // nunca chega a ser observado. Exigir exatamente `handoff` aqui deixaria
    // justamente esses perfis sem entrega — o menu ficaria oculto para sempre.
    if (phase !== 'handoff' && phase !== 'menu') return;
    // A ENTREGA. Sob o escurecimento da abertura, nunca por cima da barra
    // ainda visivel: `dismiss` inicia o fade e o menu e revelado agora, por
    // baixo dele, de modo que o jogador so ve a troca ja terminada.
    delivered = true;
    screen.dismiss(handoffTotalMs(timing));
    onReady();
  };

  /**
   * Roda o preload e alimenta a maquina com o desfecho.
   *
   * Um caminho so para a primeira passada e para a nova tentativa: as tarefas
   * sao idempotentes (esperam objetos que ja existem) e `retryFailed` dentro
   * delas re-emite apenas o que falhou, entao repetir a lista inteira nao
   * baixa nem um byte a mais do que precisa.
   */
  const preload = async (): Promise<void> => {
    const report = await runBootTasks(tasks, (fraction, pendingId) =>
      screen.setProgress(fraction, pendingId),
    );
    if (report.outcomes.some((outcome) => outcome.id === 'keyart' && outcome.ok)) {
      screen.revealKeyart();
    }
    if (report.criticalFailed) screen.setFailureDetail(failureDetail(report));
    state = advanceBoot(state, {
      type: 'preload-settled',
      nowMs: performance.now(),
      criticalFailed: report.criticalFailed,
    });
    paint(state.phase);
  };

  void preload();

  return new Promise<void>((resolve) => {
    let retrying = false;
    screen.onRetry(() => {
      // Duas guardas, e as duas importam: fora da tela de erro o botao nem
      // existe para o jogador, e um segundo clique durante uma tentativa em
      // curso dobraria as tarefas em voo por nada.
      if (state.phase !== 'failed' || retrying) return;
      retrying = true;
      state = advanceBoot(state, { type: 'retry', nowMs: performance.now() });
      screen.setProgress(0);
      paint(state.phase);
      void preload().finally(() => {
        retrying = false;
      });
    });

    // O relogio da apresentacao. `requestAnimationFrame` e nao `setInterval`
    // porque a abertura e uma coisa VISUAL: numa aba escondida ela deve pausar
    // junto com a pintura, em vez de correr as fases contra uma tela que
    // ninguem esta vendo.
    const tick = (): void => {
      const before = state.phase;
      const nowMs = performance.now();
      state = advanceBoot(state, { type: 'tick', nowMs });
      // A curva da marca vem da maquina, quadro a quadro — ver
      // `identityOpacity`. Escrita ANTES da troca de fase para que o ultimo
      // quadro da identidade seja o zero, e nao um resto visivel por cima da
      // tela seguinte.
      if (state.phase === 'identity') {
        screen.setIdentityOpacity(identityOpacity(timing, nowMs - state.phaseStartedMs));
      } else if (before === 'identity') {
        screen.setIdentityOpacity(0);
      }
      if (state.phase !== before) paint(state.phase);
      if (state.phase === 'menu') return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};
