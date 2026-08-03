// O contrato HTTP da Matriz Geracional.
//
// Vive no protocolo, e nao no servidor, porque cliente e servidor precisam
// concordar sobre a FORMA das mensagens sem que o cliente importe uma linha de
// logica autoritativa. O que atravessa a fronteira e tipo e validacao; custo,
// pre-requisito e saldo sao decisao do servidor e nunca viajam como afirmacao.
//
// ---------------------------------------------------------------------------
// A REGRA QUE TODO ESTE ARQUIVO SERVE
// ---------------------------------------------------------------------------
// O cliente manda o que APERTOU. O servidor re-simula e descobre sozinho o que
// aconteceu. E a mesma regra do leaderboard (`replay.ts`), e ela vale ainda mais
// aqui: um leaderboard adulterado e uma linha errada numa lista, e uma carteira
// adulterada e a economia inteira perdendo o direito de dar peso a decisao de
// extrair.
//
// Por isso NAO existe neste contrato nenhum campo em que o cliente diga quanto
// minerio trouxe, se pegou o nucleo, como a run terminou, quanto custa um
// protocolo ou qual e a sua geracao. Onde a tentacao apareceu, ela esta marcada
// como ignorada — ver `ProgressionSettlementRequest`.

import type {
  LoreFragmentId,
  PlayerTuning,
  ProspectorGeneration,
  UpgradeId,
} from '@voxelyn/survival-sim';

/** Em que contexto a run acontece. So `expedition` rende recurso permanente. */
export type RunMode = 'expedition' | 'ranked' | 'coop' | 'local_simulation';

/** O perfil como o JOGADOR pode ve-lo. Sem segredo, sem token, sem ledger. */
export type PublicProgressionProfile = {
  profileId: string;
  profileVersion: number;
  wallet: { ore: number; cores: number };
  purchasedUpgradeIds: UpgradeId[];
  /** DERIVADA no servidor. Nunca enviada pelo cliente, nunca persistida solta. */
  generation: ProspectorGeneration;
  unlockedLoreFragmentIds: LoreFragmentId[];
  statistics: {
    oreHomologated: number;
    oreLost: number;
    coresRecovered: number;
    successfulReturns: number;
    failedExpeditions: number;
    upgradesPurchased: number;
  };
};

/**
 * A autorizacao de uma expedicao que pode render recurso.
 *
 * O tuning viaja DO servidor PARA o cliente, e nao o contrario: o servidor o
 * deriva do perfil autoritativo e o congela aqui. O cliente recebe uma
 * configuracao para executar, nao um campo para preencher.
 *
 * `progressionProfileVersion` e o que torna a run reproduzivel meses depois:
 * comprar um protocolo enquanto a expedicao corre nao muda o Prospector que ja
 * desceu, e a liquidacao sabe contra qual arvore re-simular.
 */
export type ProgressionRunTicket = {
  runId: string;
  profileId: string;
  seed: number;
  mode: RunMode;
  playerCount: number;
  tuning: PlayerTuning;
  tuningHash: string;
  progressionProfileVersion: number;
  protocolVersion: number;
  simulationVersion: number;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
};

/**
 * A submissao de uma run terminada.
 *
 * Repare no que NAO tem: fase, minerio, nucleo, estrelas, tempo. Nada aqui e
 * afirmacao sobre o mundo — so a seed (que ja esta no ticket) e a sequencia de
 * comandos, exatamente como o leaderboard.
 */
export type ProgressionSettlementRequest = {
  /** Log de comandos em base64, formato canonico de `command-log.ts`. */
  log: string;
};

/**
 * Campos que um cliente modificado tentaria mandar, e que o servidor IGNORA.
 *
 * Existe como constante exportada, e nao como comentario, para que o teste de
 * adulteracao possa varrer a lista inteira em vez de escolher um exemplo. Se
 * alguem um dia adicionar um destes ao caminho de liquidacao, o teste falha.
 */
export const IGNORED_CLIENT_CLAIMS = [
  'claimedOre',
  'claimedCores',
  'claimedPhase',
  'claimedGeneration',
  'claimedStars',
  'summary',
  'stats',
  'wallet',
  'tuning',
  'oreCost',
  'coreCost',
] as const;

export type SettlementOutcome =
  /** Liquidada agora. */
  | 'settled'
  /** Ja tinha sido liquidada; o resultado devolvido e o mesmo de antes. */
  | 'already_settled';

export type ProgressionSettlementResponse = {
  outcome: SettlementOutcome;
  runId: string;
  /** O que o REPLAY canonico decidiu. */
  result: {
    phase: 'dead' | 'extracted' | 'extracted_with_core';
    ticks: number;
    /** Minerio que a run coletou, segundo a re-simulacao. */
    cargoOre: number;
    /** Creditado de fato. Zero quando a run morreu. */
    oreCredited: number;
    coresCredited: number;
    /** Carga perdida no Veio. Igual a `cargoOre` quando a run morreu. */
    oreLost: number;
  };
  profile: PublicProgressionProfile;
};

export type PurchaseUpgradeRequest = {
  upgradeId: UpgradeId;
  /**
   * A versao do perfil que a INTERFACE estava mostrando quando o jogador clicou.
   *
   * Sem isto, uma segunda aba com o saldo velho compraria contra numeros que ja
   * mudaram. Divergencia vira 409, e o jogador reve o estado antes de decidir de
   * novo — em vez de descobrir depois que gastou o que nao tinha.
   */
  expectedProfileVersion: number;
  idempotencyKey: string;
};

export type PurchaseUpgradeResponse = {
  profile: PublicProgressionProfile;
  purchase: {
    upgradeId: UpgradeId;
    oreSpent: number;
    coresSpent: number;
    generationBefore: ProspectorGeneration;
    generationAfter: ProspectorGeneration;
  };
  unlockedLoreFragment: PublicLoreFragment;
};

export type LoreCategory =
  | 'public_relations'
  | 'engineering'
  | 'procurement'
  | 'incident'
  | 'telemetry'
  | 'executive'
  | 'personnel'
  | 'unknown';

/**
 * Um documento desbloqueado, como o cliente o recebe.
 *
 * Aqui, ao contrario do resto do jogo, viaja a FRASE e nao a chave de i18n.
 *
 * O resto do cliente guarda chaves para poder trocar de idioma sem recarregar,
 * e isso continua certo la. Aqui a troca vale o preco inverso: uma chave exige
 * que o texto esteja no bundle, e um bundle com os 29 documentos e um bundle em
 * que qualquer pessoa le o ultimo ato no primeiro dia. Com a frase vindo do
 * servidor, "documento bloqueado" e uma afirmacao sobre bytes que o cliente
 * nunca recebeu. Trocar de idioma refaz a busca do codex.
 */
export type PublicLoreFragment = {
  id: LoreFragmentId;
  unlockedByUpgradeId: UpgradeId | null;
  /** Marco geracional que o libera, quando nao vem de um protocolo. */
  unlockedByGeneration: ProspectorGeneration | null;
  category: LoreCategory;
  clearanceLevel: number;
  documentCode: string;
  chronologyIndex: number;
  title: string;
  summary: string;
  body: string;
  source: string;
  relatedFragmentIds: LoreFragmentId[];
  redactionLevel: 0 | 1 | 2 | 3;
};

/**
 * Um documento que o perfil AINDA nao pode ler.
 *
 * O corpo nao viaja, e o titulo tambem nao quando ele e spoiler: o cliente
 * recebe o codigo mascarado e o nivel de autorizacao que falta. Saber que
 * existe um AX-███-041 e parte do desenho; saber o que ele diz e a recompensa.
 */
export type LockedLoreSlot = {
  maskedCode: string;
  clearanceLevel: number;
  category: LoreCategory;
};

export type CodexResponse = {
  unlocked: PublicLoreFragment[];
  locked: LockedLoreSlot[];
  total: number;
};

export type ProgressionErrorCode =
  | 'unauthenticated'
  | 'profile_version_conflict'
  | 'unknown_upgrade'
  | 'already_owned'
  | 'missing_prerequisite'
  | 'insufficient_ore'
  | 'insufficient_cores'
  | 'ticket_not_found'
  | 'ticket_expired'
  | 'ticket_foreign'
  | 'mode_not_eligible'
  | 'replay_rejected'
  | 'tuning_mismatch'
  | 'version_mismatch'
  | 'payload_too_large'
  | 'busy'
  | 'rate_limited'
  | 'internal';

export type ProgressionError = {
  error: ProgressionErrorCode;
  /** Diagnostico curto em ASCII. Nunca contem segredo nem detalhe interno. */
  detail?: string;
};

/** Teto do corpo de uma compra. Um objeto de tres campos nao chega perto disso. */
export const MAX_PURCHASE_BODY_BYTES = 4 * 1024;

/** Quanto tempo um ticket vale. 90 min = 3x o teto de replay do leaderboard. */
export const RUN_TICKET_TTL_MS = 90 * 60 * 1000;

/** Tamanho da chave de idempotencia aceita, em caracteres. */
export const IDEMPOTENCY_KEY_MIN = 8;
export const IDEMPOTENCY_KEY_MAX = 64;

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_-]+$/;

export const isValidIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length >= IDEMPOTENCY_KEY_MIN &&
  value.length <= IDEMPOTENCY_KEY_MAX &&
  IDEMPOTENCY_PATTERN.test(value);

/**
 * O modo rende recurso permanente?
 *
 * Uma funcao, e nao um `=== 'expedition'` espalhado: o dia em que um segundo
 * modo virar elegivel, a decisao muda num lugar so — e o teste que afirma que
 * `local_simulation` nunca rende continua valendo.
 */
export const isRewardEligibleMode = (mode: RunMode): boolean => mode === 'expedition';
