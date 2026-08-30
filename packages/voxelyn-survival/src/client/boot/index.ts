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
// - nao burla a politica de autoplay. O `AudioContext` continua nascendo pelos
//   caminhos legitimos; o que mudou e QUANDO ele e pedido.
//
//   A identidade pede a virgula sonora do estudio no primeiro quadro
//   (`onIdentitySting`) e a tela de carregamento arma o resto (`onSplash`).
//   Onde o navegador permite — um PWA instalado, um site com engajamento de
//   midia —, a assinatura toca sobre a marca e a trilha do terminal entra na
//   splash. Onde nao permite, nada soa: o contexto nasce suspenso, os arquivos
//   comecam a viajar mais cedo, e o primeiro gesto retoma tudo.
//
//   E a identidade so estica ate o fim do som SE o som comecou. Segurar uma
//   tela preta pela duracao de um audio que ninguem ouviu seria uma espera
//   inventada — a mesma coisa que a regra 1 proibe na barra de progresso.

import {
  advanceBoot,
  bootTiming,
  displayedProgress,
  handoffTotalMs,
  identityOpacity,
  initialBootState,
  type BootPhase,
  type BootState,
} from './boot-flow';
import { runBootTasks, type BootReport, type BootTask } from './boot-tasks';
import { BootScreen } from './boot-screen';
import {
  DEVELOPER_IDENT,
  hasDeveloperIdent,
  identitySting,
  type DeveloperIdent,
} from './developer-ident';

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
  /**
   * Chamado UMA vez, quando a tela de carregamento entra.
   *
   * E o gancho de "a abertura ja tem cara de jogo": daqui `main.ts` arma o
   * audio, para que a trilha do terminal comece na splash onde o navegador
   * deixar, em vez de so no primeiro toque. O boot nao sabe o que ha do outro
   * lado — nao ha um import de audio neste modulo, e nao deve haver.
   *
   * Dispara mesmo quando a splash nao chega a ser pintada (o atalho de
   * desenvolvimento atravessa as fases num quadro): quem depende dele depende
   * de "a abertura passou da identidade", nao de um quadro especifico.
   */
  onSplash?: () => void;
  /**
   * Chamado no PRIMEIRO quadro, com a URL da virgula sonora do estudio.
   *
   * Resolve com a duracao da peca em ms se ela realmente comecou a tocar, e com
   * `null` se nao tocou (mudo, navegador sem autorizacao, arquivo ausente). O
   * boot usa a resposta para esticar a identidade ate o som acabar — e so
   * nesse caso. Uma tela preta segurada pela duracao de um audio que ninguem
   * ouviu seria a espera inventada que esta abertura se proibiu.
   */
  onIdentitySting?: (url: string) => Promise<number | null>;
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
  onSplash,
  onIdentitySting,
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

  // A VIRGULA SONORA, pedida no primeiro quadro — junto da marca, nao depois
  // dela. Se tocar, a identidade estica ate o som acabar; se nao tocar, nada
  // muda e a tela fica exatamente o que ficaria em silencio.
  const sting = identitySting(ident);
  if (sting && onIdentitySting) {
    void onIdentitySting(sting).then((durationMs) => {
      if (!durationMs || durationMs <= 0) return;
      // `performance.now()` AQUI: a peca comecou quando a promessa resolveu, e
      // nao quando foi pedida — entre as duas coisas houve rede e decode.
      const now = performance.now();
      state = advanceBoot(state, {
        type: 'identity-hold-until',
        nowMs: now,
        untilMs: now + durationMs,
      });
    });
  }
  let delivered = false;
  let armed = false;
  // O progresso REAL do preload, guardado para o laco de quadros poder
  // redesenhar a barra: com um piso de tela, o que a barra mostra depende
  // tambem do tempo, e nao so das tarefas que liquidaram.
  let realFraction = 0;
  let pendingId: string | undefined;

  const paintProgress = (nowMs: number): void => {
    const elapsed = state.phase === 'loading' ? nowMs - state.phaseStartedMs : 0;
    screen.setProgress(
      displayedProgress(realFraction, elapsed, state.timing.loadingMinMs),
      pendingId,
    );
  };

  const paint = (phase: BootPhase): void => {
    screen.showPhase(phase);
    // Passou da identidade: a abertura ja e do jogo. Uma vez so, e antes da
    // entrega — e o que faz a trilha comecar na splash e nao no menu.
    if (!armed && phase !== 'identity') {
      armed = true;
      onSplash?.();
    }
    if (delivered) return;
    // `menu` conta junto com `handoff`, e nao por simetria: com um perfil de
    // duracao zero (o atalho de desenvolvimento, o handoff sob movimento
    // reduzido) a maquina atravessa as duas fases no mesmo instante e `handoff`
    // nunca chega a ser observado. Exigir exatamente `handoff` aqui deixaria
    // justamente esses perfis sem entrega — o menu ficaria oculto para sempre.
    if (phase !== 'handoff' && phase !== 'menu') return;
    // Chegar ao handoff significa que as DUAS comportas cairam — o trabalho
    // acabou e o piso da tela foi cumprido. Entao a barra crava 100%, e o
    // ultimo quadro visivel dela nao fica num 99% de arredondamento.
    screen.setProgress(1);
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
    const report = await runBootTasks(tasks, (fraction, pending) => {
      realFraction = fraction;
      pendingId = pending;
      paintProgress(performance.now());
    });
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
      realFraction = 0;
      pendingId = undefined;
      paintProgress(performance.now());
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
      // A barra e redesenhada TODO quadro enquanto a tela esta no ar: com um
      // piso de apresentacao ela avanca com o relogio tambem, e nao so quando
      // uma tarefa liquida.
      if (state.phase === 'loading') paintProgress(nowMs);
      if (state.phase === 'menu') return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
};
