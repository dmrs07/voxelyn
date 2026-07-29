// Memoria entre runs: o que sobrevive a permadeath.
//
// A spec (secao 2.3) e explicita: metaprogressao aqui e VARIEDADE — bestiario,
// descobertas, cosmeticos —, nunca poder numerico. Nada neste arquivo altera
// uma unica constante da simulacao, e essa e a linha que nao se cruza: no
// instante em que um recorde virar +5 de vida, a run deixa de ser justa consigo
// mesma e a seed compartilhada deixa de significar a mesma coisa para duas
// pessoas.
//
// O que ele faz e mais simples e mais importante: registrar. Permadeath sem
// registro nao e permadeath, e reset — e a diferenca entre um jogador que volta
// e um que fecha a aba costuma ser ter algo a mostrar do que acabou de perder.

import {
  DISCOVERY_CORE_TAKEN,
  DISCOVERY_DISCHARGE_POOL,
  DISCOVERY_FIRE_SPREAD,
  DISCOVERY_FRAGILE_BREACH,
  DISCOVERY_GAS_IGNITION,
  DISCOVERY_BISHOP_FELLED,
  DISCOVERY_MINER_ENRAGED,
  DISCOVERY_MINER_FLED,
  DISCOVERY_ORE_QUOTA,
  DISCOVERY_GUARDIAN_FELLED,
  DISCOVERY_HORSE_FELLED,
  DISCOVERY_ORE_CHAIN,
  DISCOVERY_SELF_HARM,
} from '@voxelyn/survival-sim';
import type { EnemyArchetype, RunSummary } from '@voxelyn/survival-sim';

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
/** Stable across JSON/WebSocket copies of the same frozen terminal run. */
export const runSummaryIdentity = (summary: RunSummary): string =>
  `${summary.seed}:${summary.phase}:${summary.ticks}`;

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

export type Discovery = { bit: number; title: string; lesson: string };

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
    title: 'Fogo caminha',
    lesson: 'Biofluido conduz chama de célula em célula. Uma poça é um rastilho.',
  },
  {
    bit: DISCOVERY_GAS_IGNITION,
    title: 'O gás não espera',
    lesson: 'Gás sulfúrico acende ao primeiro contato com fogo. Sala fechada é câmara.',
  },
  {
    bit: DISCOVERY_DISCHARGE_POOL,
    title: 'A poça inteira é o alvo',
    lesson: 'Descarga percorre todo o biofluido conectado — e não pergunta quem está nele.',
  },
  {
    bit: DISCOVERY_ORE_CHAIN,
    title: 'Minério é fiação',
    lesson: 'Um veio carrega a carga até o outro lado da parede e a solta nas aberturas.',
  },
  {
    bit: DISCOVERY_FRAGILE_BREACH,
    title: 'Nem toda parede é parede',
    lesson: 'Rocha frágil cede a explosão e perfuração. Rotas existem onde não parecia haver.',
  },
  {
    bit: DISCOVERY_SELF_HARM,
    title: 'O Veio não escolhe lados',
    lesson: 'Toda reação atinge você igual. A build mais forte é a mais perigosa de carregar.',
  },
  {
    bit: DISCOVERY_MINER_FLED,
    title: 'Ele larga a carga',
    lesson: 'Arma morna e o mineiro recua pelos túneis — e deixa o que carregava. Alcançá-lo custa tempo.',
  },
  {
    bit: DISCOVERY_MINER_ENRAGED,
    title: 'O calor sobrecarrega',
    lesson: 'Chegue em brasa e o circuito dele falha: picareta em círculo. Recuar responde; orbitar, não.',
  },
  {
    bit: DISCOVERY_ORE_QUOTA,
    title: 'A empresa paga por tonelada',
    lesson: 'Minério acumulado vira escolha de módulo. Cavar é uma rota, não um enfeite.',
  },
  {
    bit: DISCOVERY_HORSE_FELLED,
    title: 'O rastro fica',
    lesson: 'A investida atravessa a sala e deixa fogo onde passou. Pedra no caminho a encerra.',
  },
  {
    bit: DISCOVERY_BISHOP_FELLED,
    title: 'Ele se cura do chão',
    lesson: 'Sobre fungo vivo o Bispo regenera mais do que você tira. Aquecer o tapete já corta a cura.',
  },
  {
    bit: DISCOVERY_GUARDIAN_FELLED,
    title: 'O Guardião cai',
    lesson: 'Ele sela a arena na metade da vida e chama companhia. O cerco desaba com ele.',
  },
  {
    bit: DISCOVERY_CORE_TAKEN,
    title: 'O núcleo é só metade',
    lesson: 'Pegá-lo dobra o ritmo da contaminação. A saída é a outra metade.',
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
  'bishop',
  'guardian',
];

export const BESTIARY_NAMES: Record<EnemyArchetype, string> = {
  stalker: 'Espreitador',
  spitter: 'Cuspidor',
  bomber: 'Portador de Esporos',
  bruiser: 'Britador',
  miner: 'Minerador Empobrecido',
  fungal_horse: 'Corcel Fúngico',
  bishop: 'Bispo do Veio',
  guardian: 'Guardião do Núcleo',
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
export type BestiaryFile = { code: string; note: string };

export const BESTIARY_FILES: Record<EnemyArchetype, BestiaryFile> = {
  stalker: {
    code: 'ESPÉCIME QUIT-04',
    note: 'Fauna de túnel. Agressiva por instinto, não por organização. Custo de remoção desprezível.',
  },
  spitter: {
    code: 'ESPÉCIME FUNG-11',
    note: 'Secreção corrosiva sem valor industrial confirmado. Programa de amostragem descontinuado.',
  },
  bomber: {
    code: 'ESPÉCIME FUNG-23',
    note: 'Vetor de esporos. Ruptura espontânea documentada em 100% dos encontros registrados.',
  },
  bruiser: {
    code: 'ESPÉCIME MIN-07',
    note: 'Massa mineral animada. Reclassificado de "maquinário extraviado" após o terceiro relatório.',
  },
  miner: {
    code: 'UNIDADE EX-016',
    note: 'Extratora da geração anterior. Operação após o encerramento do contrato não foi autorizada. Sem valor de recuperação.',
  },
  fungal_horse: {
    code: 'ATIVO HOSTIL EQ-02',
    note: 'Quadrúpede adaptado. A presença de arreios não implica operador.',
  },
  bishop: {
    code: 'ATIVO HOSTIL EQ-09',
    note: 'Figura cerimonial. A alegação de estrutura religiosa permanece não corroborada.',
  },
  guardian: {
    code: 'ANOMALIA TERMINAL',
    note: 'Impede o acesso ao núcleo. Nenhuma outra propriedade é relevante para esta operação.',
  },
};
