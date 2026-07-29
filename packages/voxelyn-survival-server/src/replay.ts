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
  type PlayerCommand,
  type RunSummary,
} from '@voxelyn/survival-sim';
import { decodeCommandLog, encodeCommandLog, fromBase64 } from '@voxelyn/survival-protocol';

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
  | { ok: true; summary: RunSummary; authHash: string; ticks: number; digest: string }
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
 * Re-simula uma submissao e devolve o resultado AUTORITATIVO.
 *
 * As checagens estao em ordem de custo crescente de proposito: tamanho do
 * texto antes de decodificar base64, tamanho dos bytes antes de expandir o
 * RLE, contagem de comandos antes de simular. Um log hostil e recusado no
 * degrau mais barato que o denuncia.
 */
export const verifySoloRun = (seed: number, logBase64: string): ReplayResult => {
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

  const state = createRun({ seed, playerCount: 1 });
  const buffer: PlayerCommand[] = [emptyCommand()];
  let consumedTicks = 0;

  for (let i = 0; i < commands.length; i++) {
    buffer[0] = commands[i];
    stepRun(state, buffer);
    consumedTicks = i + 1;
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

  // Re-encoda SOMENTE o prefixo que a simulacao consumiu. Isso normaliza:
  // - blocos RLE diferentes que expandem para os mesmos comandos;
  // - padding Base64 alternativo;
  // - qualquer cauda valida anexada depois do tick terminal.
  const canonicalLog = encodeCommandLog(commands.slice(0, consumedTicks));

  return {
    ok: true,
    summary: state.summary,
    authHash: hashAuthoritativeState(state),
    ticks: state.tick,
    digest: replayDigest(seed, canonicalLog),
  };
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
