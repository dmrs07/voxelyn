// O Codex corporativo: 64 documentos, e as regras de quem pode ler o que.
//
// ---------------------------------------------------------------------------
// POR QUE O TEXTO MORA NO SERVIDOR
// ---------------------------------------------------------------------------
// O resto do jogo guarda CHAVES de i18n e resolve a frase na hora de desenhar,
// para que trocar de idioma no meio da sessao funcione. Aqui a decisao e outra:
// o corpo dos documentos vive no servidor e viaja ja resolvido.
//
// A razao e que um bundle com os textos e um bundle em que qualquer pessoa le
// o ato V no primeiro dia — e a graca inteira do arco e nao saber. Com o texto
// aqui, "documento bloqueado" e uma afirmacao sobre bytes que o cliente nunca
// recebeu, e nao sobre um `if` que ele poderia editar. O preco e que trocar de
// idioma refaz a busca do codex, o que e barato e acontece raramente.
//
// ---------------------------------------------------------------------------
// A FORMA DA HISTORIA
// ---------------------------------------------------------------------------
// Seis atos, distribuidos por PREFIXO e nao por origem do desbloqueio — assim
// protocolo, Ativo e Descoberta atravessam a mesma curva de tom:
//
//   I    AX-PUB  Propaganda        brochura, investidor, orgulho tecnico
//   II   AX-ENG  Engenharia        especificacao, tolerancia, primeira frieza
//   III  AX-PRC  Aquisicoes        custo, reposicao, linguagem desumanizada
//   IV   AX-INC  Incidentes        falha, censura, transmissao apos a morte
//   V    AX-EXE  Executivo         ordem, reclassificacao, encobrimento
//   VI   AX-UNK  Nao classificado  memoria, Ecos, o que "geracao" significa
//
// E quatro marcos geracionais (AX-GEN-*), liberados por chegar a G-01..G-04.
//
// ---------------------------------------------------------------------------
// DE ONDE UM DOCUMENTO PODE VIR
// ---------------------------------------------------------------------------
// O desbloqueio e um GATILHO, e nao um par de campos opcionais. Um documento
// pode vir de um protocolo comprado, de um marco geracional, de um Ativo que o
// jogador passou a conhecer (primeiro abate confirmado pela re-simulacao), de
// uma Descoberta (bit de DISCOVERY_*), ou de uma combinacao. O gatilho e DADO
// do catalogo; a avaliacao e uma funcao pura sobre os fatos do perfil — e os
// fatos saem SEMPRE do replay autoritativo, nunca do Registro local.
//
// O horror sai da normalidade burocratica. Ninguem escreve que e mau; escrevem
// que a operacao de resgate custa mais que a unidade, e deixam a distancia entre
// isso e o que o jogador acabou de viver fazer o trabalho.

import {
  DISCOVERY_BISHOP_FELLED,
  DISCOVERY_CARGO_LOST,
  DISCOVERY_CORE_TAKEN,
  DISCOVERY_DISCHARGE_POOL,
  DISCOVERY_FIRE_SPREAD,
  DISCOVERY_FRAGILE_BREACH,
  DISCOVERY_GAS_IGNITION,
  DISCOVERY_GUARDIAN_FELLED,
  DISCOVERY_HORSE_FELLED,
  DISCOVERY_MINER_ENRAGED,
  DISCOVERY_MINER_FLED,
  DISCOVERY_ORE_CHAIN,
  DISCOVERY_SELF_HARM,
  findUpgrade,
  UPGRADES,
  type EnemyArchetype,
  type LoreFragmentId,
  type ProspectorGeneration,
  type UpgradeId,
} from '@voxelyn/survival-sim';
import type {
  LoreCategory,
  PublicLoreFragment,
  PublicLoreTrigger,
} from '@voxelyn/survival-protocol';
import { LORE_TEXT, type LoreLocale, type LoreText } from './progression-lore-text.js';

// ---------------------------------------------------------------------------
// Gatilhos
// ---------------------------------------------------------------------------

/**
 * O que precisa ter acontecido para um documento abrir.
 *
 * Uma uniao discriminada, e nao mais dois campos `unlockedBy*`: cada origem
 * nova de desbloqueio (Ativo, Descoberta, combinacao) viraria mais um campo
 * opcional em todo documento, e a avaliacao viraria uma cascata de `if` que
 * ninguem testa por inteiro. Com o gatilho como valor, adicionar uma origem e
 * adicionar um caso — e o compilador aponta todo lugar que esqueceu dele.
 */
export type LoreUnlockTrigger =
  | { kind: 'default' }
  | { kind: 'upgrade'; upgradeId: UpgradeId }
  | { kind: 'generation'; generation: ProspectorGeneration }
  /**
   * `minKills` transforma um Ativo numa TRILHA: a ficha inicial abre no
   * primeiro abate (default 1), e documentos posteriores abrem em marcos de
   * abates ACUMULADOS pelo replay autoritativo. E o mecanismo do arco do
   * Corcel Fungico — a burocracia so admite o que o cavalo e depois de o
   * jogador derruba-lo vezes o bastante para a papelada nao dar mais conta.
   */
  | { kind: 'asset'; archetype: EnemyArchetype; minKills?: number }
  | { kind: 'discovery'; discoveryBit: number }
  | { kind: 'compound'; allOf?: LoreUnlockTrigger[]; anyOf?: LoreUnlockTrigger[] };

/**
 * Os FATOS de um perfil, ja derivados do que o servidor confirmou.
 *
 * Nada aqui vem do cliente: protocolos e geracao saem da arvore comprada,
 * Ativos e Descobertas saem das liquidacoes re-simuladas. O Registro local do
 * navegador continua existindo para apresentacao, e continua sem autoridade.
 */
export type LoreFacts = {
  purchasedUpgradeIds: ReadonlySet<UpgradeId>;
  generations: ReadonlySet<ProspectorGeneration>;
  /** Abates ACUMULADOS por arquetipo, confirmados por re-simulacao. */
  assetKills: Partial<Record<EnemyArchetype, number>>;
  /** Bitmask acumulada de DISCOVERY_*. */
  discoveries: number;
};

export const triggerSatisfied = (trigger: LoreUnlockTrigger, facts: LoreFacts): boolean => {
  switch (trigger.kind) {
    case 'default':
      return true;
    case 'upgrade':
      return facts.purchasedUpgradeIds.has(trigger.upgradeId);
    case 'generation':
      return facts.generations.has(trigger.generation);
    case 'asset':
      return (facts.assetKills[trigger.archetype] ?? 0) >= (trigger.minKills ?? 1);
    case 'discovery':
      return (facts.discoveries & trigger.discoveryBit) !== 0;
    case 'compound': {
      const all = trigger.allOf ?? [];
      const any = trigger.anyOf ?? [];
      if (!all.every((t) => triggerSatisfied(t, facts))) return false;
      if (any.length > 0 && !any.some((t) => triggerSatisfied(t, facts))) return false;
      // Um compound vazio nao existe por construcao; se existir, e um erro de
      // catalogo que o teste de validade pega — aqui ele nao abre nada.
      return all.length > 0 || any.length > 0;
    }
  }
};

/** O gatilho e bem formado? (compound nao-vazio, bit de descoberta valido) */
export const isValidTrigger = (trigger: LoreUnlockTrigger): boolean => {
  switch (trigger.kind) {
    case 'default':
      return true;
    case 'upgrade':
      return findUpgrade(trigger.upgradeId) !== undefined;
    case 'generation':
      return ['G-01', 'G-02', 'G-03', 'G-04'].includes(trigger.generation);
    case 'asset':
      return (
        ASSET_ARCHETYPES.includes(trigger.archetype) &&
        (trigger.minKills === undefined ||
          (Number.isInteger(trigger.minKills) && trigger.minKills >= 1))
      );
    case 'discovery':
      return LORE_DISCOVERY_BITS.includes(trigger.discoveryBit);
    case 'compound': {
      const parts = [...(trigger.allOf ?? []), ...(trigger.anyOf ?? [])];
      return parts.length > 0 && parts.every(isValidTrigger);
    }
  }
};

/**
 * A versao do gatilho que PODE viajar num documento ja desbloqueado.
 *
 * So sai do servidor para fragmentos abertos, entao nao ha o que vazar — mas
 * um compound ainda assim nao enumera as partes: um `anyOf` pode conter
 * condicoes que o jogador nao cumpriu, e cada uma delas nomearia um Ativo ou
 * uma Descoberta que ele ainda nao viu.
 */
export const publicTrigger = (trigger: LoreUnlockTrigger): PublicLoreTrigger => {
  switch (trigger.kind) {
    case 'compound':
      return { kind: 'compound' };
    default:
      return trigger;
  }
};

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export type LoreFragmentDefinition = {
  id: LoreFragmentId;
  trigger: LoreUnlockTrigger;
  category: LoreCategory;
  /** 0 = publico. Sobe com o ato; e o que a lista de bloqueados mostra. */
  clearanceLevel: number;
  documentCode: string;
  /** Ordem de LEITURA da historia, independente da ordem de desbloqueio. */
  chronologyIndex: number;
  relatedFragmentIds: LoreFragmentId[];
  redactionLevel: 0 | 1 | 2 | 3;
};

/** O unico documento aberto desde o comeco: a versao publica do programa. */
export const DEFAULT_UNLOCKED_LORE: readonly LoreFragmentId[] = ['AX-PUB-001'];

const GENERATION_LORE: Record<ProspectorGeneration, LoreFragmentId | null> = {
  'G-00': null,
  'G-01': 'AX-GEN-G01',
  'G-02': 'AX-GEN-G02',
  'G-03': 'AX-GEN-G03',
  'G-04': 'AX-GEN-G04',
};

export const loreForGeneration = (generation: ProspectorGeneration): LoreFragmentId | null =>
  GENERATION_LORE[generation] ?? null;

/**
 * Os arquetipos que o Codex conhece, na ordem canonica do Registro.
 *
 * A lista vive AQUI, e nao importada do cliente: o servidor precisa normalizar
 * `knownArchetypes` sem depender de codigo de apresentacao. O teste de catalogo
 * cobra que cada um tenha documento.
 */
export const ASSET_ARCHETYPES: readonly EnemyArchetype[] = [
  'stalker',
  'spitter',
  'bomber',
  'bruiser',
  'miner',
  'fungal_horse',
  'resonant',
  'mud_lamprey',
  'bellows',
  'scoriac',
  'frost_wraith',
  'sulfur_bomber',
  'undertaker',
  'bishop',
  'guardian',
];

/**
 * Um documento por Ativo, liberado quando o Ativo passa a ser CONHECIDO — que
 * hoje significa o primeiro abate confirmado pela re-simulacao, o mesmo
 * comportamento do Registro local. Nenhum nome viaja antes disso.
 *
 * Estes nao sao fichas de bestiario: sao o que a EMPRESA arquivou sobre cada
 * um — classificacao, risco, valor de recuperacao, contencao — e o que ela se
 * recusou a escrever fica para os documentos posteriores, ligados por codigo.
 */
export const ASSET_LORE: Record<EnemyArchetype, LoreFragmentId> = {
  stalker: 'AX-ENG-012',
  spitter: 'AX-ENG-014',
  bomber: 'AX-ENG-016',
  bruiser: 'AX-PRC-015',
  miner: 'AX-PRC-017',
  fungal_horse: 'AX-INC-024',
  resonant: 'AX-ENG-017',
  mud_lamprey: 'AX-PRC-018',
  bellows: 'AX-INC-022',
  scoriac: 'AX-INC-026',
  frost_wraith: 'AX-INC-028',
  sulfur_bomber: 'AX-PRC-020',
  undertaker: 'AX-UNK-043',
  bishop: 'AX-EXE-034',
  guardian: 'AX-EXE-039',
};

/** Um documento por Descoberta. O bit aposentado (ORE_QUOTA) fica de fora. */
export const DISCOVERY_LORE: readonly { bit: number; fragmentId: LoreFragmentId }[] = [
  { bit: DISCOVERY_FIRE_SPREAD, fragmentId: 'AX-ENG-021' },
  { bit: DISCOVERY_GAS_IGNITION, fragmentId: 'AX-INC-030' },
  { bit: DISCOVERY_DISCHARGE_POOL, fragmentId: 'AX-ENG-022' },
  { bit: DISCOVERY_ORE_CHAIN, fragmentId: 'AX-PRC-022' },
  { bit: DISCOVERY_FRAGILE_BREACH, fragmentId: 'AX-PUB-004' },
  { bit: DISCOVERY_SELF_HARM, fragmentId: 'AX-PUB-006' },
  { bit: DISCOVERY_MINER_FLED, fragmentId: 'AX-EXE-035' },
  { bit: DISCOVERY_MINER_ENRAGED, fragmentId: 'AX-ENG-025' },
  { bit: DISCOVERY_CARGO_LOST, fragmentId: 'AX-PRC-023' },
  { bit: DISCOVERY_HORSE_FELLED, fragmentId: 'AX-INC-033' },
  { bit: DISCOVERY_BISHOP_FELLED, fragmentId: 'AX-UNK-045' },
  { bit: DISCOVERY_GUARDIAN_FELLED, fragmentId: 'AX-EXE-042' },
  { bit: DISCOVERY_CORE_TAKEN, fragmentId: 'AX-UNK-050' },
];

/**
 * Marcos de abate: a trilha do Corcel Fungico.
 *
 * A ficha inicial (AX-INC-024) nega os arreios; cada marco seguinte e a
 * burocracia perdendo a capacidade de nao ver — o formulario sem campo
 * "cavalo", o fogo que a quimica nao explica, a ordem de vocabulario — ate o
 * documento sem departamento que nomeia o cavaleiro. Os numeros sao baixos de
 * proposito: o EQ-02 e um miniboss, e a piada morre se o segredo exigir
 * farm.
 */
export const ASSET_MILESTONE_LORE: readonly {
  archetype: EnemyArchetype;
  minKills: number;
  fragmentId: LoreFragmentId;
}[] = [
  { archetype: 'fungal_horse', minKills: 3, fragmentId: 'AX-ENG-023' },
  { archetype: 'fungal_horse', minKills: 6, fragmentId: 'AX-INC-034' },
  { archetype: 'fungal_horse', minKills: 10, fragmentId: 'AX-EXE-043' },
  { archetype: 'fungal_horse', minKills: 15, fragmentId: 'AX-UNK-046' },
  // As TRES linhas de Solaris: o Veio guarda quem morre nele e devolve o
  // GESTO — o que a pessoa fazia pelos outros quando terminou. Assinaturas de
  // bioma morrem em maior numero que o Corcel, entao os marcos sobem (8/20).
  { archetype: 'bellows', minKills: 8, fragmentId: 'AX-ENG-019' },
  { archetype: 'bellows', minKills: 20, fragmentId: 'AX-UNK-042' },
  { archetype: 'mud_lamprey', minKills: 8, fragmentId: 'AX-INC-031' },
  { archetype: 'mud_lamprey', minKills: 20, fragmentId: 'AX-UNK-048' },
  { archetype: 'frost_wraith', minKills: 8, fragmentId: 'AX-EXE-037' },
  { archetype: 'frost_wraith', minKills: 20, fragmentId: 'AX-UNK-053' },
];

/** Bits que o Codex reconhece. Usado para sanitizar a mascara persistida. */
export const LORE_DISCOVERY_BITS: readonly number[] = DISCOVERY_LORE.map((d) => d.bit);

export const LORE_DISCOVERY_MASK: number = LORE_DISCOVERY_BITS.reduce((m, b) => m | b, 0);

const CATEGORY_BY_PREFIX: Record<string, LoreCategory> = {
  PUB: 'public_relations',
  ENG: 'engineering',
  PRC: 'procurement',
  INC: 'incident',
  EXE: 'executive',
  UNK: 'unknown',
  GEN: 'telemetry',
};

const CLEARANCE_BY_PREFIX: Record<string, number> = {
  PUB: 0,
  ENG: 1,
  PRC: 1,
  INC: 2,
  EXE: 3,
  UNK: 4,
  GEN: 2,
};

const prefixOf = (id: LoreFragmentId): string => id.split('-')[1] ?? 'PUB';

/**
 * Arquivos relacionados: a costura que faz uma redacao valer a pena.
 *
 * Um termo censurado no ato III so vira revelacao se houver um caminho ate o
 * documento do ato V que o nomeia. Guardado como DADO, e nao inferido por
 * heuristica, porque a costura e autoral: quem escreveu os dois sabe qual par
 * conta uma coisa que nenhum dos dois conta sozinho.
 *
 * Com Ativos e Descobertas no catalogo, os relacionados viram CAMINHOS DE
 * INVESTIGACAO: a ficha "fauna hostil" do Espreitador aponta para o relatorio
 * de contato que menciona organizacao; a necropsia do Corcel aponta para os
 * arreios; o descarte do Guardiao aponta para a origem do Nucleo.
 */
const RELATED: Record<LoreFragmentId, LoreFragmentId[]> = {
  'AX-PUB-001': ['AX-PRC-014', 'AX-GEN-G04'],
  'AX-PUB-002': ['AX-PRC-014'],
  'AX-ENG-011': ['AX-INC-027'],
  'AX-PRC-014': ['AX-PUB-001', 'AX-EXE-033'],
  'AX-INC-027': ['AX-ENG-011', 'AX-UNK-041'],
  'AX-EXE-033': ['AX-PRC-014', 'AX-UNK-041'],
  'AX-UNK-041': ['AX-INC-027', 'AX-UNK-043'],
  'AX-PUB-003': ['AX-PRC-016'],
  'AX-ENG-013': ['AX-INC-023'],
  'AX-PRC-016': ['AX-PUB-003', 'AX-EXE-031'],
  'AX-INC-023': ['AX-ENG-013', 'AX-UNK-044'],
  'AX-EXE-031': ['AX-PRC-016', 'AX-UNK-044'],
  'AX-UNK-044': ['AX-INC-023', 'AX-UNK-047'],
  'AX-PUB-005': ['AX-PRC-019'],
  'AX-ENG-018': ['AX-INC-029'],
  'AX-PRC-019': ['AX-PUB-005', 'AX-EXE-036'],
  'AX-INC-029': ['AX-ENG-018', 'AX-ENG-017'],
  'AX-EXE-036': ['AX-PRC-019', 'AX-UNK-047'],
  'AX-UNK-047': ['AX-INC-029', 'AX-UNK-044'],
  'AX-PUB-007': ['AX-PRC-021'],
  'AX-ENG-015': ['AX-INC-025'],
  'AX-PRC-021': ['AX-PUB-007', 'AX-EXE-038'],
  'AX-INC-025': ['AX-ENG-015', 'AX-UNK-049'],
  'AX-EXE-038': ['AX-PRC-021', 'AX-UNK-049'],
  'AX-UNK-049': ['AX-INC-025', 'AX-UNK-050'],
  // A trilha de IA costura em DUAS linhas que se cruzam no fim: a da venda
  // (propaganda → treino com dados de mortos → engajamento preventivo) e a da
  // maquina (classificador → disparo sem operador → o modelo se lembra).
  'AX-PUB-009': ['AX-PRC-024'],
  'AX-ENG-020': ['AX-INC-032', 'AX-PRC-017'],
  'AX-PRC-024': ['AX-PUB-009', 'AX-EXE-040'],
  'AX-INC-032': ['AX-ENG-020', 'AX-UNK-052'],
  'AX-EXE-040': ['AX-PRC-024', 'AX-UNK-052'],
  'AX-UNK-052': ['AX-INC-032', 'AX-GEN-G04'],
  'AX-GEN-G01': ['AX-PUB-001'],
  'AX-GEN-G02': ['AX-GEN-G01'],
  'AX-GEN-G03': ['AX-GEN-G02', 'AX-EXE-033'],
  'AX-GEN-G04': ['AX-GEN-G03', 'AX-UNK-041', 'AX-UNK-049'],
  // Descobertas ambientais: cada relatorio "novo" prova que a empresa ja sabia.
  'AX-PUB-004': ['AX-PRC-022'],
  'AX-PUB-006': ['AX-EXE-036', 'AX-INC-032'],
  'AX-ENG-021': ['AX-INC-030', 'AX-PRC-022'],
  'AX-ENG-022': ['AX-ENG-014'],
  'AX-ENG-025': ['AX-PRC-017', 'AX-INC-028'],
  'AX-PRC-022': ['AX-PUB-004', 'AX-ENG-021'],
  'AX-PRC-023': ['AX-PRC-014', 'AX-PRC-018'],
  'AX-INC-030': ['AX-ENG-021', 'AX-INC-022'],
  'AX-EXE-035': ['AX-PRC-017', 'AX-EXE-031'],
  // Ativos: da zoologia de rotina a tres negacoes para nao admitir o obvio.
  'AX-ENG-012': ['AX-INC-024'],
  'AX-ENG-014': ['AX-ENG-022'],
  'AX-ENG-016': ['AX-INC-030'],
  'AX-ENG-017': ['AX-INC-029'],
  'AX-PRC-015': ['AX-PRC-014'],
  'AX-PRC-017': ['AX-ENG-020', 'AX-EXE-035', 'AX-ENG-025'],
  'AX-PRC-018': ['AX-PRC-023'],
  'AX-PRC-020': ['AX-EXE-038'],
  'AX-INC-022': ['AX-INC-030'],
  'AX-INC-024': ['AX-INC-033', 'AX-ENG-012', 'AX-ENG-023'],
  'AX-INC-026': ['AX-INC-025'],
  'AX-INC-028': ['AX-ENG-025'],
  'AX-INC-033': ['AX-INC-024', 'AX-UNK-045', 'AX-UNK-046'],
  // A trilha do Corcel: taxonomia perdida → fogo impossivel → vocabulario
  // proibido → o cavaleiro. Cada elo e o proximo passo da investigacao.
  'AX-ENG-023': ['AX-INC-024', 'AX-INC-034'],
  'AX-INC-034': ['AX-ENG-023', 'AX-EXE-043'],
  'AX-EXE-043': ['AX-INC-034', 'AX-UNK-046'],
  'AX-UNK-046': ['AX-EXE-043', 'AX-INC-033', 'AX-UNK-054'],
  // As linhas de Solaris. Cada revelacao aponta para o documento da COMPANHIA
  // que causou a morte que o Veio guardou: o fole para o corte de manutencao,
  // a mergulhadora para o fim das operacoes de resgate, a caldeira para o
  // proprio corte que a ordem executiva admite no adendo.
  'AX-ENG-019': ['AX-INC-022', 'AX-UNK-042'],
  'AX-UNK-042': ['AX-ENG-019', 'AX-PRC-016', 'AX-UNK-054'],
  'AX-INC-031': ['AX-PRC-018', 'AX-UNK-048'],
  'AX-UNK-048': ['AX-INC-031', 'AX-PRC-014', 'AX-EXE-031', 'AX-UNK-054'],
  'AX-EXE-037': ['AX-INC-028', 'AX-UNK-053'],
  'AX-UNK-053': ['AX-EXE-037', 'AX-UNK-054'],
  'AX-UNK-054': ['AX-UNK-046', 'AX-UNK-042', 'AX-UNK-048', 'AX-UNK-053', 'AX-UNK-049'],
  'AX-EXE-034': ['AX-UNK-045', 'AX-INC-033'],
  'AX-EXE-039': ['AX-UNK-050', 'AX-EXE-042'],
  'AX-EXE-042': ['AX-EXE-039', 'AX-UNK-051'],
  'AX-UNK-043': ['AX-UNK-041', 'AX-GEN-G04'],
  'AX-UNK-045': ['AX-EXE-034', 'AX-INC-033', 'AX-UNK-047'],
  'AX-UNK-050': ['AX-EXE-039', 'AX-UNK-049'],
  'AX-UNK-051': ['AX-UNK-050', 'AX-EXE-042'],
};

const REDACTION: Record<LoreFragmentId, 0 | 1 | 2 | 3> = {
  'AX-INC-027': 1,
  'AX-INC-029': 1,
  'AX-INC-025': 2,
  'AX-INC-032': 1,
  'AX-EXE-033': 2,
  'AX-EXE-036': 1,
  'AX-EXE-038': 2,
  'AX-EXE-040': 2,
  'AX-UNK-041': 3,
  'AX-UNK-044': 2,
  'AX-UNK-047': 3,
  'AX-UNK-049': 3,
  'AX-UNK-052': 3,
  'AX-GEN-G04': 1,
  'AX-ENG-022': 1,
  'AX-PRC-020': 1,
  'AX-PRC-023': 1,
  'AX-INC-022': 1,
  'AX-INC-024': 1,
  'AX-INC-028': 1,
  'AX-INC-030': 2,
  'AX-INC-033': 2,
  'AX-EXE-034': 1,
  'AX-EXE-035': 1,
  'AX-EXE-039': 2,
  'AX-EXE-042': 2,
  'AX-UNK-043': 2,
  'AX-UNK-045': 3,
  'AX-UNK-050': 3,
  'AX-UNK-051': 3,
  'AX-INC-034': 1,
  'AX-EXE-043': 2,
  'AX-UNK-046': 3,
  'AX-INC-031': 1,
  'AX-EXE-037': 2,
  'AX-UNK-042': 2,
  'AX-UNK-048': 3,
  'AX-UNK-053': 2,
  'AX-UNK-054': 3,
};

/**
 * A ordem de LEITURA.
 *
 * Nao e a ordem de compra, de abate nem de descoberta, e nao pode ser: quem
 * sobe um ramo inteiro antes de tocar nos outros leria quatro atos de Chassi
 * seguidos, e quem cacasse chefes cedo leria o ato V antes do I. A cronologia
 * e posicao EDITORIAL: o Codex reordena por ela, e a historia fica legivel em
 * qualquer rota — documentos de protocolo, Ativo, Descoberta e geracao
 * intercalados na mesma linha do tempo interna da Aurix.
 */
const CHRONOLOGY: readonly LoreFragmentId[] = [
  // Ato I — Promessa
  'AX-PUB-001',
  'AX-PUB-002',
  'AX-PUB-003',
  'AX-PUB-004',
  'AX-PUB-005',
  'AX-PUB-006',
  'AX-PUB-007',
  'AX-PUB-009',
  'AX-GEN-G01',
  // Ato II — Procedimento
  'AX-ENG-011',
  'AX-ENG-012',
  'AX-ENG-013',
  'AX-ENG-014',
  'AX-ENG-015',
  'AX-ENG-016',
  'AX-ENG-017',
  'AX-ENG-018',
  'AX-ENG-019',
  'AX-ENG-020',
  'AX-ENG-021',
  'AX-ENG-022',
  'AX-ENG-023',
  'AX-ENG-025',
  // Ato III — Custo
  'AX-PRC-014',
  'AX-PRC-015',
  'AX-PRC-016',
  'AX-PRC-017',
  'AX-PRC-018',
  'AX-PRC-019',
  'AX-PRC-020',
  'AX-PRC-021',
  'AX-PRC-022',
  'AX-PRC-023',
  'AX-PRC-024',
  'AX-GEN-G02',
  // Ato IV — Incidente
  'AX-INC-022',
  'AX-INC-023',
  'AX-INC-024',
  'AX-INC-025',
  'AX-INC-026',
  'AX-INC-027',
  'AX-INC-028',
  'AX-INC-029',
  'AX-INC-030',
  'AX-INC-031',
  'AX-INC-032',
  'AX-INC-033',
  'AX-INC-034',
  'AX-GEN-G03',
  // Ato V — Encobrimento
  'AX-EXE-031',
  'AX-EXE-033',
  'AX-EXE-034',
  'AX-EXE-035',
  'AX-EXE-036',
  'AX-EXE-037',
  'AX-EXE-038',
  'AX-EXE-039',
  'AX-EXE-040',
  'AX-EXE-042',
  'AX-EXE-043',
  // Ato VI — Memoria
  'AX-UNK-041',
  'AX-UNK-042',
  'AX-UNK-043',
  'AX-UNK-044',
  'AX-UNK-045',
  'AX-UNK-046',
  'AX-UNK-047',
  'AX-UNK-048',
  'AX-UNK-049',
  'AX-UNK-050',
  'AX-UNK-051',
  'AX-UNK-052',
  'AX-UNK-053',
  'AX-UNK-054',
  'AX-GEN-G04',
];

const define = (id: LoreFragmentId, trigger: LoreUnlockTrigger): LoreFragmentDefinition => {
  const prefix = prefixOf(id);
  return {
    id,
    trigger,
    category: CATEGORY_BY_PREFIX[prefix] ?? 'unknown',
    clearanceLevel: CLEARANCE_BY_PREFIX[prefix] ?? 0,
    documentCode: id,
    chronologyIndex: CHRONOLOGY.indexOf(id),
    relatedFragmentIds: RELATED[id] ?? [],
    redactionLevel: REDACTION[id] ?? 0,
  };
};

export const LORE_FRAGMENTS: readonly LoreFragmentDefinition[] = [
  define('AX-PUB-001', { kind: 'default' }),
  ...UPGRADES.map((upgrade) =>
    define(upgrade.loreFragmentId, { kind: 'upgrade', upgradeId: upgrade.id }),
  ),
  define('AX-GEN-G01', { kind: 'generation', generation: 'G-01' }),
  define('AX-GEN-G02', { kind: 'generation', generation: 'G-02' }),
  define('AX-GEN-G03', { kind: 'generation', generation: 'G-03' }),
  define('AX-GEN-G04', { kind: 'generation', generation: 'G-04' }),
  ...ASSET_ARCHETYPES.map((archetype) =>
    define(ASSET_LORE[archetype], { kind: 'asset', archetype }),
  ),
  ...ASSET_MILESTONE_LORE.map(({ archetype, minKills, fragmentId }) =>
    define(fragmentId, { kind: 'asset', archetype, minKills }),
  ),
  ...DISCOVERY_LORE.map(({ bit, fragmentId }) =>
    define(fragmentId, { kind: 'discovery', discoveryBit: bit }),
  ),
  // Compound de fim de arco: recuperar o Nucleo E conhecer a ANOMALIA
  // TERMINAL sao fatos separados, e o documento que os cruza so existe para
  // quem viveu os dois.
  define('AX-UNK-051', {
    kind: 'compound',
    allOf: [
      { kind: 'discovery', discoveryBit: DISCOVERY_CORE_TAKEN },
      { kind: 'asset', archetype: 'guardian' },
    ],
  }),
  // A sintese de Solaris: so quem chegou ao fim das QUATRO historias humanas
  // (o cavaleiro, o homem do fole, a mergulhadora, a operadora de caldeira)
  // pode ler o documento que as nomeia como o mesmo fenomeno.
  define('AX-UNK-054', {
    kind: 'compound',
    allOf: [
      { kind: 'asset', archetype: 'fungal_horse', minKills: 15 },
      { kind: 'asset', archetype: 'bellows', minKills: 20 },
      { kind: 'asset', archetype: 'mud_lamprey', minKills: 20 },
      { kind: 'asset', archetype: 'frost_wraith', minKills: 20 },
    ],
  }),
];

const BY_ID = new Map(LORE_FRAGMENTS.map((f) => [f.id, f]));

export const findLoreFragment = (id: LoreFragmentId): LoreFragmentDefinition | undefined =>
  BY_ID.get(id);

export const TOTAL_LORE_FRAGMENTS = LORE_FRAGMENTS.length;

/**
 * Todo fragmento cujo gatilho os fatos satisfazem, na ordem do catalogo.
 *
 * E a UNICA porta de derivacao de desbloqueio: perfil novo, reparo de perfil,
 * liquidacao e compra passam todos por aqui. Nao existe segunda lista.
 */
export const unlockedLoreFor = (facts: LoreFacts): LoreFragmentId[] =>
  LORE_FRAGMENTS.filter((f) => triggerSatisfied(f.trigger, facts)).map((f) => f.id);

/**
 * O gatilho deste fragmento fala deste arquetipo? (direto ou dentro de compound)
 *
 * Usado para derivar o indice "Ver docs" de um Ativo conhecido — so sobre
 * fragmentos JA desbloqueados, entao nao ha vazamento a considerar aqui.
 */
export const triggerMentionsArchetype = (
  trigger: LoreUnlockTrigger,
  archetype: EnemyArchetype,
): boolean => {
  switch (trigger.kind) {
    case 'asset':
      return trigger.archetype === archetype;
    case 'compound':
      return [...(trigger.allOf ?? []), ...(trigger.anyOf ?? [])].some((t) =>
        triggerMentionsArchetype(t, archetype),
      );
    default:
      return false;
  }
};

export const triggerMentionsDiscovery = (trigger: LoreUnlockTrigger, bit: number): boolean => {
  switch (trigger.kind) {
    case 'discovery':
      return trigger.discoveryBit === bit;
    case 'compound':
      return [...(trigger.allOf ?? []), ...(trigger.anyOf ?? [])].some((t) =>
        triggerMentionsDiscovery(t, bit),
      );
    default:
      return false;
  }
};

const textFor = (id: LoreFragmentId, locale: LoreLocale): LoreText =>
  LORE_TEXT[locale][id] ?? LORE_TEXT['en'][id] ?? { title: id, summary: '', body: '', source: '' };

/**
 * Um fragmento pronto para viajar. So chamado depois de conferir autorizacao.
 *
 * `unlocked` mascara os ARQUIVOS RELACIONADOS que o perfil ainda nao pode ler.
 * Sem isso, o documento publico inicial — que todo perfil novo recebe — entregava
 * `AX-PRC-014` e `AX-GEN-G04` em texto limpo, e o painel os desenhava verbatim:
 * exatamente os prefixos de ato e de geracao que `maskCode` existe para esconder.
 * O mecanismo de mascara continuava certo e a lista de relacionados o devolvia
 * pela porta dos fundos, no primeiro minuto de jogo.
 *
 * `read` e estado de APRESENTACAO persistido: nao entra em hash nenhum e nao
 * muda gameplay — so decide onde a bolinha de "novo" aparece.
 */
export const toPublicFragment = (
  definition: LoreFragmentDefinition,
  locale: LoreLocale,
  unlocked?: ReadonlySet<LoreFragmentId>,
  read?: ReadonlySet<LoreFragmentId>,
): PublicLoreFragment => {
  const text = textFor(definition.id, locale);
  return {
    id: definition.id,
    trigger: publicTrigger(definition.trigger),
    category: definition.category,
    clearanceLevel: definition.clearanceLevel,
    documentCode: definition.documentCode,
    chronologyIndex: definition.chronologyIndex,
    title: text.title,
    summary: text.summary,
    body: text.body,
    source: text.source,
    // Sem `unlocked`, nada e mascarado: e o caso do fragmento revelado logo apos
    // uma compra, em que quem chama ja sabe que o perfil o possui.
    relatedFragmentIds: unlocked
      ? definition.relatedFragmentIds.map((id) => (unlocked.has(id) ? id : maskCode(id)))
      : definition.relatedFragmentIds,
    redactionLevel: definition.redactionLevel,
    read: read?.has(definition.id) ?? false,
  };
};

/**
 * O codigo mascarado de um documento que o perfil ainda nao pode ler.
 *
 * `AX-███-041`: o prefixo some junto com o resto porque ele ENTREGA o ato — um
 * jogador em G-00 que visse quatro AX-UNK saberia que existe um quinto ato antes
 * de qualquer coisa sugerir isso. O numero fica: saber que ha um 041 e parte do
 * desenho, saber o que ele diz e a recompensa.
 */
export const maskCode = (documentCode: string): string => {
  const parts = documentCode.split('-');
  if (parts.length < 3) return '███';
  return `${parts[0]}-███-${parts[2]}`;
};

/** Existe um protocolo apontando para cada fragmento de upgrade? (invariante) */
export const loreCoversEveryUpgrade = (): boolean =>
  UPGRADES.every((upgrade) => BY_ID.has(upgrade.loreFragmentId)) &&
  LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'upgrade').every((f) =>
    findUpgrade(f.trigger.kind === 'upgrade' ? f.trigger.upgradeId : ''),
  );
