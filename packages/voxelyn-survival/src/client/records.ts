// Memoria LOCAL entre runs: o que sobrevive a permadeath sem valer nada.
//
// ---------------------------------------------------------------------------
// A POLITICA MUDOU, E DE PROPOSITO
// ---------------------------------------------------------------------------
// Este arquivo dizia que metaprogressao era VARIEDADE — bestiario, descobertas,
// cosmeticos — e nunca poder numerico, porque no instante em que um recorde
// virasse +5 de vida a seed compartilhada deixaria de significar a mesma coisa
// para duas pessoas.
//
// O argumento estava certo sobre o que protegia, e continua valendo. A resposta
// nao foi abrir excecao, e sim separar contextos (spec de 2026-08-02):
//
//   Expedicao autoritativa → tuning derivado do perfil do SERVIDOR
//   Contrato ranqueado     → G-00 de fabrica, para todos
//   Co-op (1a versao)      → G-00 de fabrica, para todos
//
// A politica nova, escrita por extenso: a metaprogressao da Expedicao pode
// fornecer melhorias numericas leves e ponderadas; modos competitivos continuam
// usando Prospectors padronizados.
//
// ---------------------------------------------------------------------------
// O QUE ESTE ARQUIVO NAO E MAIS
// ---------------------------------------------------------------------------
// Ele NAO e autoridade sobre nada permanente. Carteira, nucleos, protocolos,
// geracao, codex e tuning vivem no servidor, e por um motivo que nao tem a ver
// com desconfianca do jogador: um saldo que mora no navegador e um saldo que
// qualquer aba de devtools edita, e uma economia que se pode editar nao consegue
// dar peso a decisao de extrair. Ver `progression-api.ts` e `progression-cache.ts`.
//
// O que sobra aqui e o que sempre foi util e nunca foi moeda: historico,
// bestiario, descobertas, seeds dominadas. Permadeath sem registro nao e
// permadeath, e reset — e a diferenca entre um jogador que volta e um que fecha
// a aba costuma ser ter algo a mostrar do que acabou de perder.

import {
  DISCOVERY_CORE_TAKEN,
  DISCOVERY_DISCHARGE_POOL,
  DISCOVERY_LEYLINE_CIRCUIT,
  DISCOVERY_LEYLINE_ROUTED,
  DISCOVERY_FIRE_SPREAD,
  DISCOVERY_FRAGILE_BREACH,
  DISCOVERY_GAS_IGNITION,
  DISCOVERY_BISHOP_FELLED,
  DISCOVERY_MINER_ENRAGED,
  DISCOVERY_MINER_FLED,
  DISCOVERY_CARGO_LOST,
  DISCOVERY_GUARDIAN_FELLED,
  DISCOVERY_HORSE_FELLED,
  DISCOVERY_ORE_CHAIN,
  DISCOVERY_SELF_HARM,
} from '@voxelyn/survival-sim';
import type { EnemyArchetype, RunSummary } from '@voxelyn/survival-sim';
import type { MessageKey } from './i18n';

const KEY = 'voxelyn.records';
/**
 * Versao do formato. Um schema desconhecido e DESCARTADO em vez de migrado.
 *
 * Migrar valeria a pena se o dado fosse insubstituivel; aqui ele e um historico
 * de jogo, e um parser de formato antigo que ninguem testa e uma fonte de falha
 * na inicializacao — o pior lugar possivel para uma. Perder o historico e ruim;
 * nao abrir o jogo e pior.
 */
const SCHEMA = 1;

/** Quantas runs recentes ficam guardadas. */
export const HISTORY_LIMIT = 20;

export type BestiaryEntry = {
  /** Quantas runs em que este arquetipo apareceu na contagem de abates. */
  killed: number;
};

export type Records = {
  schema: number;
  totals: {
    runs: number;
    deaths: number;
    extractions: number;
    extractionsWithCore: number;
    kills: number;
    ticks: number;
  };
  /** Melhor resultado por criterio. Null enquanto nunca aconteceu. */
  best: {
    stars: 0 | 1 | 2 | 3;
    /** Menor tempo de uma extracao COM o nucleo, em ticks. */
    fastestCoreTicks: number | null;
    /** Maior tempo sobrevivido numa run que terminou em morte. */
    longestSurvivalTicks: number;
  };
  bestiary: Partial<Record<EnemyArchetype, BestiaryEntry>>;
  /** Bitmask acumulada de descobertas, ver DISCOVERY_* na sim. */
  discoveries: number;
  /** Runs recentes, mais nova primeiro. */
  history: RunSummary[];
  /** Seeds com 3 estrelas, para a lista de dominadas. */
  masteredSeeds: number[];
};

export const emptyRecords = (): Records => ({
  schema: SCHEMA,
  totals: { runs: 0, deaths: 0, extractions: 0, extractionsWithCore: 0, kills: 0, ticks: 0 },
  best: { stars: 0, fastestCoreTicks: null, longestSurvivalTicks: 0 },
  bestiary: {},
  discoveries: 0,
  history: [],
  masteredSeeds: [],
});

export const loadRecords = (): Records => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyRecords();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return emptyRecords();
    const rec = parsed as Records;
    if (rec.schema !== SCHEMA) return emptyRecords();
    // Merge com o vazio: um campo adicionado depois de o jogador ja ter salvo
    // chegaria como undefined e explodiria na primeira leitura.
    const base = emptyRecords();
    return {
      ...base,
      ...rec,
      totals: { ...base.totals, ...rec.totals },
      best: { ...base.best, ...rec.best },
      bestiary: { ...rec.bestiary },
      history: Array.isArray(rec.history) ? rec.history.slice(0, HISTORY_LIMIT) : [],
      masteredSeeds: Array.isArray(rec.masteredSeeds) ? rec.masteredSeeds : [],
    };
  } catch {
    // JSON corrompido ou storage bloqueado (modo privativo). O jogo tem de
    // iniciar de qualquer jeito.
    return emptyRecords();
  }
};

export const saveRecords = (records: Records): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    /* sem storage: o jogo funciona, so nao lembra */
  }
};

/**
 * Incorpora uma run terminada. PURA: devolve um objeto novo.
 *
 * Sem mutacao porque este e o unico lugar do cliente em que um bug silencioso
 * custaria dado do jogador — e uma funcao pura pode ser testada com o historico
 * inteiro sem tocar em localStorage.
 */
/**
 * A identidade de uma run TERMINADA. Estavel entre copias JSON/WebSocket da
 * mesma run congelada, e diferente entre duas descidas diferentes.
 *
 * As duas metades da frase acima custam coisas opostas, e por isso ela e feita
 * de campos CONGELADOS do sumario e de nada mais: qualquer coisa vinda de fora
 * dele (um contador de sessao, o relogio) quebraria a primeira metade, que e a
 * que impede a mesma run de entrar duas vezes no historico quando o snapshot
 * terminal chega repetido.
 *
 * `seed:fase:ticks` sozinho nao dava conta da segunda. Com seed FIXA — o
 * "mesmo mapa para todos", e o campo de seed nas opcoes — duas tentativas que
 * morrem no mesmo tick colidem, e o `localStorage` de replays passa a guardar
 * uma sob a chave da outra: clicar na linha antiga abre a descida nova. Os
 * contadores abaixo sao o que distingue duas tentativas naquele mesmo mapa —
 * tiros dados, dano dado e levado, minerio e Nucleos trazidos.
 *
 * NAO e um identificador unico universal, e nao tenta ser: duas runs que
 * empatem em TODOS estes numeros continuam colidindo. Ali as duas linhas do
 * livro sao indistinguiveis uma da outra de qualquer forma — mesma nota, mesmo
 * tempo, mesma causa, mesma seed —, e um id de verdade sairia caro: ele teria
 * de ser gravado junto de cada run, e o schema novo do `voxelyn.records`
 * DESCARTA o historico que o jogador ja tem (ver `SCHEMA`).
 */
export const runSummaryIdentity = (summary: RunSummary): string =>
  [
    summary.seed,
    summary.phase,
    summary.ticks,
    summary.cores,
    summary.stats.shotsFired,
    summary.stats.damageDealtTenths,
    summary.stats.damageTakenTenths,
    summary.stats.oreCollected,
  ].join(':');

export type ApplyRunOnceResult = {
  records: Records;
  identity: string;
  applied: boolean;
};

/** Pure idempotency boundary used by the online and solo result screens. */
export const applyRunOnce = (
  records: Records,
  summary: RunSummary,
  previousIdentity: string | null,
): ApplyRunOnceResult => {
  const identity = runSummaryIdentity(summary);
  if (identity === previousIdentity) return { records, identity, applied: false };
  return { records: applyRun(records, summary), identity, applied: true };
};

export const applyRun = (records: Records, summary: RunSummary): Records => {
  const next: Records = {
    ...records,
    totals: { ...records.totals },
    best: { ...records.best },
    bestiary: { ...records.bestiary },
    history: [summary, ...records.history].slice(0, HISTORY_LIMIT),
    masteredSeeds: [...records.masteredSeeds],
  };

  next.totals.runs += 1;
  next.totals.ticks += summary.ticks;
  if (summary.phase === 'dead') {
    next.totals.deaths += 1;
    next.best.longestSurvivalTicks = Math.max(next.best.longestSurvivalTicks, summary.ticks);
  } else {
    next.totals.extractions += 1;
    if (summary.phase === 'extracted_with_core') {
      next.totals.extractionsWithCore += 1;
      next.best.fastestCoreTicks =
        next.best.fastestCoreTicks === null
          ? summary.ticks
          : Math.min(next.best.fastestCoreTicks, summary.ticks);
    }
  }

  for (const [archetype, count] of Object.entries(summary.stats.kills) as [
    EnemyArchetype,
    number,
  ][]) {
    if (count <= 0) continue;
    next.totals.kills += count;
    const entry = next.bestiary[archetype] ?? { killed: 0 };
    next.bestiary[archetype] = { killed: entry.killed + count };
  }

  next.discoveries |= summary.stats.discoveries;
  if (summary.stars > next.best.stars) next.best.stars = summary.stars;
  if (summary.stars === 3 && !next.masteredSeeds.includes(summary.seed)) {
    next.masteredSeeds.push(summary.seed);
  }
  return next;
};

// ---------------------------------------------------------------------------
// Apresentacao das descobertas
// ---------------------------------------------------------------------------

/**
 * Uma descoberta do codex.
 *
 * Guarda CHAVES, e nao frases. O painel resolve o texto no momento de desenhar,
 * porque a lista e uma constante de modulo — avaliada uma vez, no import — e
 * congelar a lingua ali deixaria o registro em portugues para sempre para quem
 * trocasse de idioma depois de abrir o jogo.
 */
export type Discovery = { bit: number; title: MessageKey; lesson: MessageKey };

/**
 * O codex. A ordem e de aprendizado, nao de valor do bit.
 *
 * Cada entrada e uma frase que o jogador PODE ter aprendido morrendo; o codex
 * so confirma o que o mundo ja mostrou. E por isso que nada aqui e desbloqueado
 * por marco ou por compra: uma linha aparece quando aquilo aconteceu com voce.
 */
export const DISCOVERIES: readonly Discovery[] = [
  {
    bit: DISCOVERY_FIRE_SPREAD,
    title: 'discovery.fireSpread.title',
    lesson: 'discovery.fireSpread.lesson',
  },
  {
    bit: DISCOVERY_GAS_IGNITION,
    title: 'discovery.gasIgnition.title',
    lesson: 'discovery.gasIgnition.lesson',
  },
  {
    bit: DISCOVERY_DISCHARGE_POOL,
    title: 'discovery.dischargePool.title',
    lesson: 'discovery.dischargePool.lesson',
  },
  {
    bit: DISCOVERY_LEYLINE_ROUTED,
    title: 'discovery.leylineRouted.title',
    lesson: 'discovery.leylineRouted.lesson',
  },
  {
    bit: DISCOVERY_LEYLINE_CIRCUIT,
    title: 'discovery.leylineCircuit.title',
    lesson: 'discovery.leylineCircuit.lesson',
  },
  {
    bit: DISCOVERY_ORE_CHAIN,
    title: 'discovery.oreChain.title',
    lesson: 'discovery.oreChain.lesson',
  },
  {
    bit: DISCOVERY_FRAGILE_BREACH,
    title: 'discovery.fragileBreach.title',
    lesson: 'discovery.fragileBreach.lesson',
  },
  {
    bit: DISCOVERY_SELF_HARM,
    title: 'discovery.selfHarm.title',
    lesson: 'discovery.selfHarm.lesson',
  },
  {
    bit: DISCOVERY_MINER_FLED,
    title: 'discovery.minerFled.title',
    lesson: 'discovery.minerFled.lesson',
  },
  {
    bit: DISCOVERY_MINER_ENRAGED,
    title: 'discovery.minerEnraged.title',
    lesson: 'discovery.minerEnraged.lesson',
  },
  {
    bit: DISCOVERY_CARGO_LOST,
    title: 'discovery.cargoLost.title',
    lesson: 'discovery.cargoLost.lesson',
  },
  {
    bit: DISCOVERY_HORSE_FELLED,
    title: 'discovery.horseFelled.title',
    lesson: 'discovery.horseFelled.lesson',
  },
  {
    bit: DISCOVERY_BISHOP_FELLED,
    title: 'discovery.bishopFelled.title',
    lesson: 'discovery.bishopFelled.lesson',
  },
  {
    bit: DISCOVERY_GUARDIAN_FELLED,
    title: 'discovery.guardianFelled.title',
    lesson: 'discovery.guardianFelled.lesson',
  },
  {
    bit: DISCOVERY_CORE_TAKEN,
    title: 'discovery.coreTaken.title',
    lesson: 'discovery.coreTaken.lesson',
  },
];

export const hasDiscovery = (records: Records, bit: number): boolean =>
  (records.discoveries & bit) !== 0;

/** Arquetipos na ordem em que o bestiario os apresenta. */
export const BESTIARY_ORDER: readonly EnemyArchetype[] = [
  'stalker',
  'spitter',
  'bomber',
  'bruiser',
  'miner',
  'fungal_horse',
  // Assinaturas de estrato, na ordem das levas de bioma.
  'resonant',
  'mud_lamprey',
  'bellows',
  'scoriac',
  'frost_wraith',
  'sulfur_bomber',
  'undertaker',
  'diamandis',
  'white_devourer',
  'archcantor',
  'sheet_leviathan',
  'lung_matrix',
  'furnace_heart',
  'frost_queen',
  'magnetarch',
  'bishop',
  'guardian',
];

/** O nome que o JOGADOR aprendeu em campo — a marginalia do relatorio. */
export const BESTIARY_NAME_KEYS: Record<EnemyArchetype, MessageKey> = {
  stalker: 'bestiary.name.stalker',
  spitter: 'bestiary.name.spitter',
  bomber: 'bestiary.name.bomber',
  bruiser: 'bestiary.name.bruiser',
  miner: 'bestiary.name.miner',
  fungal_horse: 'bestiary.name.fungal_horse',
  resonant: 'bestiary.name.resonant',
  mud_lamprey: 'bestiary.name.mud_lamprey',
  bellows: 'bestiary.name.bellows',
  scoriac: 'bestiary.name.scoriac',
  frost_wraith: 'bestiary.name.frost_wraith',
  sulfur_bomber: 'bestiary.name.sulfur_bomber',
  undertaker: 'bestiary.name.undertaker',
  diamandis: 'bestiary.name.diamandis',
  white_devourer: 'bestiary.name.white_devourer',
  archcantor: 'bestiary.name.archcantor',
  sheet_leviathan: 'bestiary.name.sheet_leviathan',
  lung_matrix: 'bestiary.name.lung_matrix',
  furnace_heart: 'bestiary.name.furnace_heart',
  frost_queen: 'bestiary.name.frost_queen',
  magnetarch: 'bestiary.name.magnetarch',
  bishop: 'bestiary.name.bishop',
  guardian: 'bestiary.name.guardian',
};

/**
 * A ficha corporativa de cada arquetipo.
 *
 * O bestiario era uma lista de nomes e contagens — a voz de um naturalista
 * catalogando fauna. Isso contradiz a ficcao que o resto do jogo estabeleceu: o
 * Veio e habitado por CIVILIZACOES pos-cataclisma que protegem o que sobrou, e o
 * prospector e um robo de uma mineradora enviado para levar o que e delas.
 *
 * Entao quem escreve o bestiario e a empresa, e a empresa nao chama ninguem de
 * povo. A voz e a de um relatorio de recuperacao de ativos: designacao, custo,
 * autorizacao. E ela vai ficando mais tensa conforme desce — no comeco e zoologia
 * de rotina, e no fim precisa de tres negacoes para nao admitir o obvio ("a
 * existencia de arreios nao implica operador").
 *
 * O texto NAO diz ao jogador o que sentir. Ele so mostra o que a empresa
 * registrou, e deixa a distancia entre isso e o que o jogador viu fazer o
 * trabalho. Quem ouviu a morte do mineiro ja sabe que "sem valor de recuperacao"
 * e uma frase sobre a empresa, e nao sobre ele.
 */
export type BestiaryFile = { code: MessageKey; note: MessageKey };

export const BESTIARY_FILES: Record<EnemyArchetype, BestiaryFile> = {
  stalker: { code: 'bestiary.code.stalker', note: 'bestiary.note.stalker' },
  spitter: { code: 'bestiary.code.spitter', note: 'bestiary.note.spitter' },
  bomber: { code: 'bestiary.code.bomber', note: 'bestiary.note.bomber' },
  bruiser: { code: 'bestiary.code.bruiser', note: 'bestiary.note.bruiser' },
  miner: { code: 'bestiary.code.miner', note: 'bestiary.note.miner' },
  fungal_horse: { code: 'bestiary.code.fungal_horse', note: 'bestiary.note.fungal_horse' },
  resonant: { code: 'bestiary.code.resonant', note: 'bestiary.note.resonant' },
  mud_lamprey: { code: 'bestiary.code.mud_lamprey', note: 'bestiary.note.mud_lamprey' },
  bellows: { code: 'bestiary.code.bellows', note: 'bestiary.note.bellows' },
  scoriac: { code: 'bestiary.code.scoriac', note: 'bestiary.note.scoriac' },
  frost_wraith: { code: 'bestiary.code.frost_wraith', note: 'bestiary.note.frost_wraith' },
  sulfur_bomber: { code: 'bestiary.code.sulfur_bomber', note: 'bestiary.note.sulfur_bomber' },
  undertaker: { code: 'bestiary.code.undertaker', note: 'bestiary.note.undertaker' },
  diamandis: { code: 'bestiary.code.diamandis', note: 'bestiary.note.diamandis' },
  white_devourer: { code: 'bestiary.code.white_devourer', note: 'bestiary.note.white_devourer' },
  archcantor: { code: 'bestiary.code.archcantor', note: 'bestiary.note.archcantor' },
  sheet_leviathan: { code: 'bestiary.code.sheet_leviathan', note: 'bestiary.note.sheet_leviathan' },
  lung_matrix: { code: 'bestiary.code.lung_matrix', note: 'bestiary.note.lung_matrix' },
  furnace_heart: { code: 'bestiary.code.furnace_heart', note: 'bestiary.note.furnace_heart' },
  frost_queen: { code: 'bestiary.code.frost_queen', note: 'bestiary.note.frost_queen' },
  magnetarch: { code: 'bestiary.code.magnetarch', note: 'bestiary.note.magnetarch' },
  bishop: { code: 'bestiary.code.bishop', note: 'bestiary.note.bishop' },
  guardian: { code: 'bestiary.code.guardian', note: 'bestiary.note.guardian' },
};
