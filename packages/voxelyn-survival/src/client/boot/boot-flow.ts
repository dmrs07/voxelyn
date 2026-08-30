// A abertura do jogo: contrato e aritmetica, zero DOM.
//
// Este arquivo e para o boot o que `soundtrack.ts` e para a trilha: as
// constantes e a maquina de estados puras, testaveis em Node. Quem transforma
// isto em tela e o `boot-screen`; quem liga as duas pontas e o `boot/index`.
//
// O QUE ESTA FEATURE MUDA. Ate aqui, abrir o Survival era abrir uma pagina: o
// `#menu` ja vinha pintado no primeiro quadro, os atlas chegavam quando
// chegavam e o jogo ficava desenhando silhueta de reserva enquanto isso. A
// sequencia de abertura troca isso por uma que qualquer pessoa reconhece de um
// console:
//
//   preto -> identidade -> tela de carregamento -> menu
//
// TRES REGRAS governam o desenho e explicam cada decisao abaixo.
//
// 1) O CARREGAMENTO E REAL. A barra nao e um cronometro disfarcado: ela conta
//    tarefas de preload de verdade (fontes, atlas de arte, fundo da tela),
//    ponderadas pelo peso de cada uma. Ver `boot-tasks.ts`.
//
// 2) A IDENTIDADE E TEMPO GRATIS. O preload comeca em t=0, JUNTO com a
//    identidade — nao depois dela. Os ~1,9 s da abertura sao 1,9 s de rede e
//    decodificacao ja acontecendo. Num segundo boot (PWA, tudo em cache) o
//    preload termina durante a identidade e a tela de carregamento aparece
//    pelo minimo visual e sai. E o oposto de segurar o jogador.
//
// 3) A ORDEM NUNCA VARIA. As fases avancam por uma maquina de estados unica,
//    alimentada por fatos (tempo decorrido, preload liquidado) — nao por
//    `setTimeout` espalhados. Nenhuma corrida entre "acabou o preload" e
//    "acabou a identidade" pode inverter as telas: `identity -> loading` so
//    depende do relogio, `loading -> handoff` so depende dos dois juntos.

/**
 * As fases da abertura, na ordem em que acontecem.
 *
 * - `identity`: a marca, em tela cheia sobre preto. Nenhuma UI de jogo.
 * - `loading`: a tela de carregamento do Survival, com progresso real.
 * - `handoff`: a passagem — 100%, um respiro curto, e o escurecimento que
 *   entrega a tela ao menu. Existe como fase propria para que o menu so seja
 *   revelado sob o preto, nunca por cima da barra ainda visivel.
 * - `menu`: a abertura acabou; o terminal e do jogador.
 * - `failed`: um recurso do caminho critico nao carregou. Ver `boot-tasks.ts`.
 */
export type BootPhase = 'identity' | 'loading' | 'handoff' | 'menu' | 'failed';

/** A ordem canonica das fases de sucesso. O teste de sequencia ancora nela. */
export const BOOT_SEQUENCE: readonly BootPhase[] = ['identity', 'loading', 'handoff', 'menu'];

/**
 * Os tempos de APRESENTACAO da abertura, em ms.
 *
 * Sao os unicos numeros do boot que nao vem de trabalho real, e existem por um
 * motivo unico: uma imagem que aparece e some no mesmo quadro nao e uma
 * abertura, e um defeito. Cada campo tem teto justificado — o total da
 * identidade cabe abaixo de dois segundos de proposito, porque quem abre o
 * jogo pela decima vez no dia nao pode ser cobrado por isso.
 */
export type BootTiming = {
  /** Entrada da marca. */
  identityFadeInMs: number;
  /** Quanto a marca fica parada, legivel. */
  identityHoldMs: number;
  /** Saida da marca, ate o preto. */
  identityFadeOutMs: number;
  /**
   * Piso da tela de carregamento — quanto tempo ela fica no ar no MINIMO.
   *
   * Comecou como anti-flash (algumas centenas de ms, so para a tela nao
   * aparecer e sumir dentro de um quadro) e virou tempo de APRESENTACAO, por
   * decisao de produto: com tudo em cache o preload liquida em ~200 ms, e a
   * tela que existe para o jogo ter cara de jogo passava rapido demais para
   * ser vista.
   *
   * E uma espera declarada, e nao disfarcada — a diferenca esta na barra. Ela
   * nunca mostra mais do que o menor entre o trabalho concluido e o tempo
   * decorrido do piso (ver `displayedProgress`), entao ela continua sendo o
   * progresso REAL rumo ao menu: quando a rede e lenta quem manda e o
   * trabalho, quando tudo esta em cache quem manda e o piso. O que ela nunca
   * faz e cravar 100% e ficar parada, que e como uma tela travada se parece.
   */
  loadingMinMs: number;
  /** O respiro em 100% antes de escurecer. */
  handoffHoldMs: number;
  /** O escurecimento que entrega a tela ao menu. */
  handoffFadeMs: number;
};

/** A abertura completa, para quem abre o jogo. */
export const BOOT_TIMING_FULL: BootTiming = {
  identityFadeInMs: 380,
  identityHoldMs: 1100,
  identityFadeOutMs: 380,
  loadingMinMs: 3200,
  handoffHoldMs: 220,
  handoffFadeMs: 420,
};

/**
 * `prefers-reduced-motion`: as MESMAS telas, na mesma ordem, sem transicao.
 *
 * O que a preferencia pede e ausencia de movimento, nao ausencia de
 * informacao: cortar a tela de carregamento aqui esconderia do jogador
 * justamente o feedback de que o jogo esta trabalhando. Entao os fades vao a
 * zero (a troca e um corte seco), a marca continua legivel pelo tempo de
 * leitura, e o preload continua sendo esperado por inteiro.
 */
export const BOOT_TIMING_REDUCED: BootTiming = {
  identityFadeInMs: 0,
  identityHoldMs: 900,
  identityFadeOutMs: 0,
  // O mesmo piso do perfil completo: `prefers-reduced-motion` pede menos
  // MOVIMENTO, nao menos informacao — cortar a tela aqui esconderia justamente
  // o feedback de que o jogo esta trabalhando.
  loadingMinMs: 3200,
  handoffHoldMs: 120,
  handoffFadeMs: 0,
};

/**
 * Modo de desenvolvimento: a apresentacao inteira em ~um quadro.
 *
 * Quem esta mexendo no menu abre a pagina centenas de vezes por tarde, e
 * assistir a abertura toda vez seria um imposto sobre o proprio trabalho. NAO
 * pula o preload — as tarefas rodam e sao esperadas igual; some so o tempo de
 * apresentacao. Ligado por `?boot=skip` na URL, do mesmo jeito que `?dev=1`
 * liga as ferramentas de desenvolvimento; nada disso existe numa sessao normal.
 */
export const BOOT_TIMING_SKIPPED: BootTiming = {
  identityFadeInMs: 0,
  identityHoldMs: 0,
  identityFadeOutMs: 0,
  loadingMinMs: 0,
  handoffHoldMs: 0,
  handoffFadeMs: 0,
};

/** Duracao total da identidade — o unico trecho puramente de apresentacao. */
export const identityTotalMs = (timing: BootTiming): number =>
  timing.identityFadeInMs + timing.identityHoldMs + timing.identityFadeOutMs;

/** Duracao total da passagem para o menu. */
export const handoffTotalMs = (timing: BootTiming): number =>
  timing.handoffHoldMs + timing.handoffFadeMs;

/**
 * A opacidade da marca no instante `elapsedMs` da fase de identidade.
 *
 * Por que isto e uma FUNCAO e nao uma transicao de CSS: a apresentacao da
 * identidade e `preto -> entra -> fica -> sai -> preto`, e a saida acontece
 * DENTRO da fase, terminando junto com ela. Uma transicao de CSS so poderia
 * comecar quando a classe cai — ou seja, quando a fase JA acabou —, e a marca
 * sairia por cima da tela de carregamento entrando. Foi exatamente esse o
 * defeito que apareceu na primeira captura: o emblema atravessado sobre o
 * wordmark, dois assuntos disputando o mesmo centro.
 *
 * Com a curva vindo daqui, os tres tempos do perfil descrevem de verdade o que
 * a tela faz, e o preto entre as duas telas volta a existir.
 */
export const identityOpacity = (timing: BootTiming, elapsedMs: number): number => {
  const { identityFadeInMs: fadeIn, identityHoldMs: hold, identityFadeOutMs: fadeOut } = timing;
  if (elapsedMs <= 0) return fadeIn > 0 ? 0 : 1;
  if (fadeIn > 0 && elapsedMs < fadeIn) return elapsedMs / fadeIn;
  const leavingAt = fadeIn + hold;
  if (elapsedMs < leavingAt) return 1;
  if (fadeOut <= 0) return elapsedMs >= identityTotalMs(timing) ? 0 : 1;
  return Math.max(0, 1 - (elapsedMs - leavingAt) / fadeOut);
};

/**
 * O que a barra DESENHA: o menor entre o trabalho concluido e o piso da tela.
 *
 * As duas coisas seguram o menu, entao as duas contam — e o menor dos dois e,
 * literalmente, o quanto falta para o jogador entrar. Numa rede lenta quem
 * manda e o trabalho (a barra e o preload); com tudo em cache quem manda e o
 * piso (a barra e o relogio da apresentacao). Em nenhum dos casos ela mostra
 * mais do que ja aconteceu.
 *
 * Piso zero (o atalho de desenvolvimento) devolve o progresso real intacto.
 */
export const displayedProgress = (
  realFraction: number,
  elapsedMs: number,
  floorMs: number,
): number => {
  const real = Math.max(0, Math.min(1, realFraction));
  if (floorMs <= 0) return real;
  const byClock = Math.max(0, Math.min(1, elapsedMs / floorMs));
  return Math.min(real, byClock);
};

/**
 * Escolhe o perfil de tempo. `reduced` (a media query) tem prioridade sobre
 * nada; `skip` (a chave de desenvolvimento) vence os dois, porque quem a
 * ligou pediu explicitamente para nao esperar.
 *
 * `withoutIdentity` zera SO os tempos da marca, preservando o resto do perfil.
 * E o caminho de quando ainda nao existe identidade de desenvolvedor para
 * apresentar (ver `developer-ident.ts`): a fase continua existindo — a ordem
 * das telas e um contrato — mas atravessa em zero, e a abertura comeca na tela
 * de carregamento em vez de segurar o jogador diante de um preto vazio.
 */
export const bootTiming = (
  opts: { reduced?: boolean; skip?: boolean; withoutIdentity?: boolean } = {},
): BootTiming => {
  const base = opts.skip
    ? BOOT_TIMING_SKIPPED
    : opts.reduced
      ? BOOT_TIMING_REDUCED
      : BOOT_TIMING_FULL;
  if (!opts.withoutIdentity) return base;
  return { ...base, identityFadeInMs: 0, identityHoldMs: 0, identityFadeOutMs: 0 };
};

/** Como o preload esta, do ponto de vista da maquina. */
export type PreloadOutcome = 'running' | 'ready' | 'critical-failed';

export type BootState = {
  phase: BootPhase;
  /** Relogio (ms) em que a fase corrente comecou. */
  phaseStartedMs: number;
  preload: PreloadOutcome;
  /**
   * O perfil de tempo desta abertura, decidido uma vez em `initialBootState`.
   *
   * Mora no ESTADO e nao num modulo mutavel de proposito: e o que mantem
   * `advanceBoot` uma funcao pura de (estado, evento), sem nenhuma leitura
   * escondida. Dois testes com perfis diferentes rodam lado a lado sem um
   * contaminar o outro, e nao existe ordem de inicializacao para acertar.
   */
  timing: BootTiming;
};

/**
 * Os fatos que a maquina aceita. Sao fatos, nao ordens: nenhum deles nomeia
 * uma fase de destino — quem decide o destino e `advanceBoot`, sozinho.
 */
export type BootEvent =
  | { type: 'tick'; nowMs: number }
  /** O preload liquidou (todas as tarefas resolveram ou falharam). */
  | { type: 'preload-settled'; nowMs: number; criticalFailed: boolean }
  /**
   * A virgula sonora do estudio COMECOU a tocar, e termina em `untilMs`.
   *
   * A marca passa a durar o tempo do som. Nao ha versao disto que funcione com
   * dois numeros fixos: a peca so toca onde o navegador permite (ver
   * `boot/index.ts`), e uma tela silenciosa segurada pela duracao de um audio
   * que nunca soou seria uma espera inventada — exatamente o que esta feature
   * se proibiu. Entao quem estica a fase e o som, depois de ter comecado.
   *
   * Ignorado fora da fase de identidade: um som que chega tarde demais nao
   * traz a marca de volta.
   */
  | { type: 'identity-hold-until'; nowMs: number; untilMs: number }
  /** O jogador pediu nova tentativa depois de uma falha critica. */
  | { type: 'retry'; nowMs: number };

/**
 * Teto da identidade estendida, ms.
 *
 * Existe porque a duracao vem de um arquivo, e um arquivo trocado por engano
 * (ou um `decodeAudioData` que devolve uma duracao absurda) nao pode prender o
 * jogador numa tela preta. Folgado o bastante para a assinatura completa de
 * 3,5 s caber MESMO comecando com um atraso de rede, curto o bastante para
 * nunca virar castigo. Ele so morde no caso patologico: com a peca comecando
 * cedo, quem termina a fase e o proprio som.
 */
export const IDENTITY_MAX_MS = 5200;

/**
 * Piso da tela de carregamento quando o desfecho e FALHA, ms.
 *
 * O anti-flash original, e nada mais: uma tela que aparece e some no mesmo
 * quadro parece defeito, mas segurar a mensagem de erro pelo tempo de
 * APRESENTACAO seria fazer o jogador esperar por uma ma noticia. Nunca maior
 * que o piso de sucesso — no modo de desenvolvimento, onde ele e zero, este
 * tambem e.
 */
export const LOADING_FAILURE_MIN_MS = 260;

export const initialBootState = (
  nowMs: number,
  timing: BootTiming = BOOT_TIMING_FULL,
): BootState => ({
  phase: 'identity',
  phaseStartedMs: nowMs,
  preload: 'running',
  timing,
});

const enter = (state: BootState, phase: BootPhase, nowMs: number): BootState =>
  state.phase === phase ? state : { ...state, phase, phaseStartedMs: nowMs };

/**
 * A transicao inteira, num lugar so.
 *
 * Pura de proposito: a mesma funcao decide a abertura no navegador e no teste,
 * e o teste consegue empurrar o relogio sem esperar 1,9 s de verdade.
 *
 * As duas garantias que este corpo precisa entregar:
 *
 * - a identidade NUNCA e encurtada por um preload rapido (o `loading` so
 *   comeca pelo relogio), e
 * - o menu NUNCA aparece por um relogio rapido com o preload no ar (o
 *   `handoff` exige as duas condicoes).
 *
 * E por isso que uma corrida entre as duas nao consegue trocar a ordem das
 * telas: cada aresta depende de um fato que a outra nao controla.
 */
export const advanceBoot = (state: BootState, event: BootEvent): BootState => {
  // Ate o ponto fixo, e nao uma fase por chamada.
  //
  // Com um perfil de duracao zero (movimento reduzido no handoff, o atalho de
  // desenvolvimento) varias arestas ficam satisfeitas no MESMO instante, e
  // avancar so uma por chamada faria a abertura gastar um quadro por fase para
  // atravessar tempos que valem zero. Pior: a sequencia observada passaria a
  // depender da taxa de quadros. O limite de iteracoes e o tamanho da maquina —
  // ela nao tem ciclos, entao o ponto fixo chega sempre.
  let next = step(state, event);
  for (let guard = 0; guard < BOOT_SEQUENCE.length && next.phase !== state.phase; guard += 1) {
    const after = step(next, { type: 'tick', nowMs: event.nowMs });
    if (after.phase === next.phase) break;
    next = after;
  }
  return next;
};

const step = (state: BootState, event: BootEvent): BootState => {
  if (event.type === 'preload-settled') {
    const preload: PreloadOutcome = event.criticalFailed ? 'critical-failed' : 'ready';
    // O evento so REGISTRA o desfecho; quem move a fase e o `tick` logo abaixo,
    // para que exista um caminho unico de transicao (e um so lugar onde os
    // minimos de tela sao cobrados).
    return step({ ...state, preload }, { type: 'tick', nowMs: event.nowMs });
  }

  if (event.type === 'identity-hold-until') {
    if (state.phase !== 'identity') return state;
    const { identityFadeInMs: fadeIn, identityFadeOutMs: fadeOut } = state.timing;
    // A fase inteira tem de cobrir o som E a saida da marca: o ultimo acorde
    // nao pode ser cortado pela troca de tela.
    const total = Math.min(IDENTITY_MAX_MS, event.untilMs - state.phaseStartedMs + fadeOut);
    const hold = Math.max(state.timing.identityHoldMs, total - fadeIn - fadeOut);
    if (hold === state.timing.identityHoldMs) return state;
    return { ...state, timing: { ...state.timing, identityHoldMs: hold } };
  }

  if (event.type === 'retry') {
    if (state.phase !== 'failed') return state;
    // A nova tentativa volta para a tela de carregamento, nao para a
    // identidade: a marca ja foi apresentada, e repeti-la a cada tentativa
    // transformaria a recuperacao de erro em castigo.
    return { ...state, phase: 'loading', phaseStartedMs: event.nowMs, preload: 'running' };
  }

  const elapsed = event.nowMs - state.phaseStartedMs;
  switch (state.phase) {
    case 'identity':
      // Só o relógio. Um preload instantâneo não abrevia a marca; um preload
      // lento também não a segura — ele segura a tela seguinte, que é dele.
      return elapsed >= identityTotalMs(state.timing)
        ? enter(state, 'loading', event.nowMs)
        : state;
    case 'loading': {
      if (state.preload === 'running') return state;
      // A FALHA nao espera o piso de apresentacao. O piso existe para a tela de
      // carregamento ser vista; a tela de erro nao precisa disso — ela precisa
      // chegar. Fazer o jogador esperar tres segundos por uma mensagem de que
      // deu errado seria a unica espera desta abertura que nao compra nada.
      // Sobra so o anti-flash, que e o piso original.
      if (state.preload === 'critical-failed') {
        const failureMin = Math.min(LOADING_FAILURE_MIN_MS, state.timing.loadingMinMs);
        return elapsed >= failureMin ? enter(state, 'failed', event.nowMs) : state;
      }
      if (elapsed < state.timing.loadingMinMs) return state;
      return enter(state, 'handoff', event.nowMs);
    }
    case 'handoff':
      return elapsed >= handoffTotalMs(state.timing) ? enter(state, 'menu', event.nowMs) : state;
    case 'failed':
    case 'menu':
      return state;
  }
};
