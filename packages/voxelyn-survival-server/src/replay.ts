// Verificacao de runs solo por RE-SIMULACAO.
//
// A regra que todo este modulo serve: o cliente nunca submete um resultado. Ele
// submete a seed e o que PRESSIONOU; o servidor roda a mesma simulacao
// deterministica e descobre sozinho o que aconteceu.
//
// A consequencia e o ponto: nao existe campo para mentir. Um cliente
// modificado que quisesse aparecer no topo teria de produzir uma sequencia de
// comandos que, alimentada a simulacao autoritativa, realmente chegasse ao
// nucleo e voltasse dentro do tempo — o que e a definicao de jogar bem. Nao ha
// "confie no cliente e valide depois": nao ha nada vindo do cliente que seja
// afirmacao sobre o mundo.
//
// Isto so e possivel porque a sim ja era deterministica por seed + comandos e o
// repositorio ja testava isso. O leaderboard nao adiciona confianca nenhuma ao
// cliente; ele colhe uma garantia que ja existia.
//
// ---------------------------------------------------------------------------
// O QUE ESTE MODULO NAO RESOLVE
// ---------------------------------------------------------------------------
// Re-simulacao prova que os comandos produzem o resultado. NAO prova que um
// humano os digitou. Um bot que jogue bem produz um log legitimo, e nenhuma
// verificacao server-side distingue isso — quem afirma o contrario esta
// vendendo heuristica como prova. O que ela elimina e a classe inteira de
// "editei o JSON e mandei 3 estrelas em 4 segundos", que e o ataque real de um
// leaderboard de jogo web.

import {
  createRun,
  emptyCommand,
  hashAuthoritativeState,
  stepRun,
  TICK_HZ,
  TICK_MS,
  type PlayerCommand,
  hashPlayerTuning,
  type PlayerTuning,
  type RunDepthConfig,
  type RunSummary,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  SIMULATION_VERSION,
  DEATH_ECHO_TRACE_SAMPLES,
  DEATH_ECHO_TRACE_STEP_MS,
  buildDeathEchoCapsule,
  decodeCommandLog,
  encodeCommandLog,
  fromBase64,
  toBase64,
  type DeathEchoCapsule,
  type DeathEchoTraceSample,
} from '@voxelyn/survival-protocol';

/**
 * Teto de ticks de uma submissao. 30 minutos a 20 Hz.
 *
 * Generoso contra a promessa de 12 a 20 minutos porque quem morre devagar
 * tambem tem direito a entrar no ranking, e apertado o bastante para limitar o
 * custo de CPU de UMA verificacao. E o limite que impede um log de duas horas
 * de ocupar o event loop.
 */
export const MAX_REPLAY_TICKS = 30 * 60 * TICK_HZ;

/** Teto de bytes do log codificado, antes de qualquer decodificacao. */
export const MAX_REPLAY_BYTES = 512 * 1024;

export type ReplayResult =
  | {
      ok: true;
      summary: RunSummary;
      authHash: string;
      ticks: number;
      digest: string;
      /**
       * O log CANONICO, em base64 — o mesmo que `resimulateRun` acabou de rodar.
       *
       * Sai daqui, e nao do corpo da requisicao, pelo mesmo motivo do digest: o
       * cliente manda o que apertou, isto e o que a verificacao aceitou como
       * verdade. E o que permite ao leaderboard guardar "o replay desta run" sem
       * guardar nada que nao tenha passado pela re-simulacao.
       */
      replayLog: string;
    }
  | { ok: false; reason: string };

/**
 * Digest estavel de uma sequencia CANONICA de comandos, para deduplicar reenvios.
 *
 * FNV-1a sobre seed + bytes RLE produzidos pelo encoder oficial. Nao e
 * criptografico e nao precisa ser: o resultado e autoritativamente re-simulado;
 * o digest so identifica duas representacoes da mesma run verificada.
 */
export const replayDigest = (seed: number, canonicalLog: Uint8Array): string => {
  if (!(canonicalLog instanceof Uint8Array)) {
    throw new TypeError('replayDigest exige bytes canonicos');
  }
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  mix(seed & 0xff);
  mix((seed >>> 8) & 0xff);
  mix((seed >>> 16) & 0xff);
  mix((seed >>> 24) & 0xff);
  for (const byte of canonicalLog) mix(byte);
  return (h >>> 0).toString(16).padStart(8, '0');
};

/**
 * Quantos ticks separam duas amostras do rastro final.
 *
 * O cliente amostra pelo relógio, a 120 ms. O servidor amostra por TICK, porque
 * na re-simulação não existe relógio de quadro — e por isso o passo real do
 * rastro reconstruído aqui é `ticks × TICK_MS`, que viaja dentro da própria
 * cápsula. O consumidor lê `stepMs` da cápsula e não presume nenhum dos dois.
 */
const TRACE_TICKS_PER_SAMPLE = Math.max(1, Math.round(DEATH_ECHO_TRACE_STEP_MS / TICK_MS));
const TRACE_STEP_MS_RESIMULATED = TRACE_TICKS_PER_SAMPLE * TICK_MS;

export type Resimulation =
  | { ok: true; state: SurvivalState; canonicalLog: Uint8Array; trace: DeathEchoTraceSample[] }
  | { ok: false; reason: string };

/**
 * O laco de re-simulacao, num lugar so.
 *
 * As checagens estao em ordem de custo crescente de proposito: tamanho do
 * texto antes de decodificar base64, tamanho dos bytes antes de expandir o
 * RLE, contagem de comandos antes de simular. Um log hostil e recusado no
 * degrau mais barato que o denuncia.
 *
 * A janela do rastro e colhida DURANTE a simulacao porque ela so existe durante
 * a simulacao: depois do ultimo tick, as posicoes intermediarias sumiram. Custa
 * uma amostra a cada dois ticks num buffer de 24 — nada perto de um `stepRun`.
 */
/**
 * Re-simula um log e devolve o estado terminal.
 *
 * `tuning` e `depth` sao o que a progressao acrescentou a este modulo, e os
 * dois entram como PARAMETRO em vez de virem do log: o cliente manda o que
 * apertou, e quem decide com qual Prospector — e com qual PROFUNDIDADE —
 * aqueles comandos rodam e o ticket guardado no servidor.
 *
 * Ausentes = G-00 de fabrica, tres setores. E o caminho de quem nao tem ticket:
 * run offline, servidor sem progressao, pool de Ecos. Nao e um teto — e a
 * descida de fabrica, a mesma que o jogo sempre foi para quem nao comprou
 * protocolo nenhum.
 *
 * O ranking POR CLASSE e o que tirou daqui a antiga politica de re-simular tudo
 * em tres setores. Ela mantinha um livro so, ao preco de recusar como fraude
 * toda run mais funda que tres — e agora que cada profundidade tem o proprio
 * livro, a comparacao justa nao precisa mais de um teto: precisa de um ticket.
 */
export const resimulateRun = (
  seed: number,
  logBase64: string,
  tuning?: PlayerTuning,
  depth?: RunDepthConfig,
): Resimulation => {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    return { ok: false, reason: 'seed invalida' };
  }
  if (typeof logBase64 !== 'string' || logBase64.length > MAX_REPLAY_BYTES) {
    return { ok: false, reason: 'log excede o tamanho maximo' };
  }
  const bytes = fromBase64(logBase64);
  if (!bytes) return { ok: false, reason: 'log nao e base64 valido' };
  if (bytes.length > MAX_REPLAY_BYTES) return { ok: false, reason: 'log excede o tamanho maximo' };

  const commands = decodeCommandLog(bytes, MAX_REPLAY_TICKS);
  if (!commands) return { ok: false, reason: 'log malformado' };
  if (commands.length === 0) return { ok: false, reason: 'log vazio' };

  const state = createRun({ seed, playerCount: 1, tuning, depth });
  const buffer: PlayerCommand[] = [emptyCommand()];
  const trace: DeathEchoTraceSample[] = [];
  let consumedTicks = 0;
  /** Setor em que as amostras correntes foram colhidas. */
  let traceSector = state.sector;

  for (let i = 0; i < commands.length; i++) {
    buffer[0] = commands[i];
    stepRun(state, buffer);
    consumedTicks = i + 1;
    // A descida troca o mundo mantendo a run: amostras do setor anterior
    // codificadas contra a celula da morte nova produziriam um rastro que salta
    // de um mapa para o outro.
    if (state.sector !== traceSector) {
      traceSector = state.sector;
      trace.length = 0;
    }
    if (state.tick % TRACE_TICKS_PER_SAMPLE === 0) {
      const extra = state.playerExtra;
      trace.push({
        x: state.player.x,
        y: state.player.y,
        aimX: extra.aim.x,
        aimY: extra.aim.y,
        firing: extra.nextShotAt > state.tick,
      });
      if (trace.length > DEATH_ECHO_TRACE_SAMPLES) trace.shift();
    }
    // Para no instante em que a run acaba. O cliente pode ter capturado comandos
    // adicionais antes de observar a fase terminal; eles NAO participam da run
    // e, portanto, tampouco participam da identidade usada no leaderboard.
    if (state.phase !== 'running') break;
  }

  if (state.phase === 'running') {
    // O log acabou com a run em andamento: nao ha resultado a registrar. Nao e
    // fraude, e submissao incompleta (aba fechada no meio, por exemplo).
    return { ok: false, reason: 'a run nao terminou dentro do log enviado' };
  }
  if (!state.summary) {
    return { ok: false, reason: 'run terminou sem sumario' };
  }

  return {
    ok: true,
    state,
    trace,
    // Re-encoda SOMENTE o prefixo que a simulacao consumiu. Isso normaliza:
    // - blocos RLE diferentes que expandem para os mesmos comandos;
    // - padding Base64 alternativo;
    // - qualquer cauda valida anexada depois do tick terminal.
    canonicalLog: encodeCommandLog(commands.slice(0, consumedTicks)),
  };
};

/**
 * Impressao da CONFIGURACAO sob a qual um log foi verificado.
 *
 * Existe porque `seed + bytes` deixou de identificar uma run. Enquanto toda
 * submissao rodava a descida de fabrica, os dois bastavam; agora os mesmos
 * bytes, com a mesma seed, produzem resultados diferentes conforme a
 * profundidade e o tuning que o ticket autorizou — e sao esses resultados que
 * entram em LIVROS diferentes. Um digest cego a configuracao faria o segundo
 * deles voltar como "duplicata" e sumir do livro dele.
 *
 * A configuracao de FABRICA imprime vazio, de proposito: e o que mantem
 * identico todo digest ja gravado no banco, e portanto a deduplicacao de todo
 * reenvio de run que ja aconteceu.
 */
const configFingerprint = (tuning?: PlayerTuning, depth?: RunDepthConfig): string => {
  if (!tuning && !depth) return '';
  const parts: string[] = [`v${SIMULATION_VERSION}`];
  if (depth) parts.push(`d${depth.sectorCount}:${[...depth.coreSectors].sort((a, b) => a - b)}`);
  // O tuning entra pelo HASH que a progressao ja calcula, e nao campo a campo:
  // uma segunda enumeracao dos atributos divergiria da primeira no dia em que
  // um atributo novo entrasse so numa delas.
  if (tuning) parts.push(`t${hashPlayerTuning(tuning)}`);
  return parts.join('|');
};

/**
 * Re-simula uma submissao e devolve o resultado AUTORITATIVO.
 *
 * `tuning` e `depth` NAO vem do corpo da requisicao — quem os passa e o
 * chamador, depois de le-los de um ticket que o proprio servidor emitiu (ver
 * `createLeaderboardHandler`). Ausentes, a run e re-simulada como G-00 de
 * fabrica: tres setores, sem protocolo nenhum.
 *
 * Foi preciso abrir estes dois parametros porque o ranking passou a ser POR
 * CLASSE de descida. Enquanto o livro era um so, re-simular tudo em tres
 * setores era a politica; agora ela RECUSARIA toda run mais funda que tres —
 * o log de uma descida de sete setores, alimentado a uma run de tres, nao chega
 * ao mesmo fim, e voltaria ao jogador como fraude.
 *
 * O digest devolvido carrega a configuracao junto (ver `configFingerprint`).
 * `replayDigest` em si NAO muda: ele tambem nomeia as capsulas do pool de Ecos,
 * e mexer nele renomearia carcacas ja publicadas para trocar de assunto.
 */
export const verifySoloRun = (
  seed: number,
  logBase64: string,
  tuning?: PlayerTuning,
  depth?: RunDepthConfig,
): ReplayResult => {
  const run = resimulateRun(seed, logBase64, tuning, depth);
  if (!run.ok) return run;
  const summary = run.state.summary;
  if (!summary) return { ok: false, reason: 'run terminou sem sumario' };
  const fingerprint = configFingerprint(tuning, depth);
  return {
    ok: true,
    summary,
    authHash: hashAuthoritativeState(run.state),
    ticks: run.state.tick,
    digest: replayDigest(seed, run.canonicalLog) + (fingerprint ? `:${fingerprint}` : ''),
    replayLog: toBase64(run.canonicalLog),
  };
};

export type DeathEchoReplayResult =
  | { ok: true; capsule: DeathEchoCapsule; digest: string }
  | { ok: false; reason: string };

/**
 * Re-simula um log e constroi a capsula da morte que ele produziu.
 *
 * Esta e a unica porta pela qual uma morte SOLO entra no pool comunitario, e ela
 * existe para manter a mesma regra do leaderboard: o cliente manda a seed e o que
 * pressionou; o servidor descobre sozinho onde e de que o Prospector morreu. Nao
 * ha campo de posicao, de causa nem de topologia para preencher — logo nao ha o
 * que mentir. Uma capsula enviada pronta seria uma afirmacao do cliente sobre o
 * mundo, e o pool perderia para sempre o direito de conceder qualquer coisa.
 *
 * O rastro tambem sai daqui, e nao do cliente: reconstruido pela re-simulacao ele
 * e autoritativo de graca, porque a simulacao ja teve de percorrer aqueles ticks.
 *
 * O id e derivado do digest — anonimo por construcao. Nenhum nome de jogador
 * atravessa esta funcao.
 */
export const verifySoloDeath = (seed: number, logBase64: string): DeathEchoReplayResult => {
  const run = resimulateRun(seed, logBase64);
  if (!run.ok) return run;
  const state = run.state;
  if (state.phase !== 'dead') {
    return { ok: false, reason: 'a run nao terminou em morte' };
  }
  const cause = state.summary?.deathCause;
  if (!cause) return { ok: false, reason: 'morte sem causa autoritativa' };

  const digest = replayDigest(seed, run.canonicalLog);
  const capsule = buildDeathEchoCapsule(state, {
    id: `pool:${digest}:${state.sector}`,
    x: state.player.x,
    y: state.player.y,
    facingX: state.player.facing.x,
    facingY: state.player.facing.y,
    cause,
    ticks: state.tick,
    trace: run.trace,
  });
  // O passo do rastro re-simulado vem do TICK, nao do relogio de quadro do
  // cliente. Corrigi-lo aqui em vez de no encoder mantem `encodeDeathEchoTrace`
  // com um unico default e deixa a excecao onde ela nasce.
  if (capsule.finalTrace) capsule.finalTrace.stepMs = TRACE_STEP_MS_RESIMULATED;
  return { ok: true, capsule, digest };
};

/**
 * Higieniza o nome exibido.
 *
 * Vem de um campo de texto de um cliente qualquer: corta o comprimento, remove
 * controle e colapsa espaco. NAO tenta filtrar palavrao — um filtro ingenuo
 * gera falso positivo com nome legitimo e falso negativo com qualquer grafia
 * criativa, e moderacao de conteudo nao se resolve numa regex.
 */
export const sanitizeName = (raw: unknown): string => {
  if (typeof raw !== 'string') return 'anônimo';
  const clean = raw
    // Controle C0/C1 e DEL: nao sao "texto estranho", sao bytes que quebram
    // terminal, log estruturado e qualquer coisa que renderize o nome depois.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 18);
  return clean.length > 0 ? clean : 'anônimo';
};
