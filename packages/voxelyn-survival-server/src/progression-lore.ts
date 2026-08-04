// O Codex corporativo: 35 documentos, e as regras de quem pode ler o que.
//
// ---------------------------------------------------------------------------
// POR QUE O TEXTO MORA NO SERVIDOR
// ---------------------------------------------------------------------------
// O resto do jogo guarda CHAVES de i18n e resolve a frase na hora de desenhar,
// para que trocar de idioma no meio da sessao funcione. Aqui a decisao e outra:
// o corpo dos documentos vive no servidor e viaja ja resolvido.
//
// A razao e que um bundle com os 29 textos e um bundle em que qualquer pessoa le
// o ato V no primeiro dia — e a graca inteira do arco e nao saber. Com o texto
// aqui, "documento bloqueado" e uma afirmacao sobre bytes que o cliente nunca
// recebeu, e nao sobre um `if` que ele poderia editar. O preco e que trocar de
// idioma refaz a busca do codex, o que e barato e acontece raramente.
//
// ---------------------------------------------------------------------------
// A FORMA DA HISTORIA
// ---------------------------------------------------------------------------
// Cinco atos, distribuidos por TIER e nao por ramificacao — assim qualquer ordem
// de compra atravessa a mesma curva de tom:
//
//   T1  AX-PUB  Propaganda        brochura, investidor, orgulho tecnico
//   T2  AX-ENG  Engenharia        especificacao, tolerancia, primeira frieza
//   T3  AX-PRC  Aquisicoes        custo, reposicao, linguagem desumanizada
//   T4  AX-INC  Incidentes        falha, censura, transmissao apos a morte
//   T5  AX-EXE  Executivo         ordem, reclassificacao, encobrimento
//   T6  AX-UNK  Nao classificado  memoria, Ecos, o que "geracao" significa
//
// E quatro marcos geracionais (AX-GEN-*), liberados por chegar a G-01..G-04.
//
// O horror sai da normalidade burocratica. Ninguem escreve que e mau; escrevem
// que a operacao de resgate custa mais que a unidade, e deixam a distancia entre
// isso e o que o jogador acabou de viver fazer o trabalho.

import {
  findUpgrade,
  UPGRADES,
  type LoreFragmentId,
  type ProspectorGeneration,
  type UpgradeId,
} from '@voxelyn/survival-sim';
import type { LoreCategory, PublicLoreFragment } from '@voxelyn/survival-protocol';
import { LORE_TEXT, type LoreLocale, type LoreText } from './progression-lore-text.js';

export type LoreFragmentDefinition = {
  id: LoreFragmentId;
  unlockedByUpgradeId: UpgradeId | null;
  unlockedByGeneration: ProspectorGeneration | null;
  category: LoreCategory;
  /** 0 = publico. Sobe com o ato; e o que a lista de bloqueados mostra. */
  clearanceLevel: number;
  documentCode: string;
  /** Ordem de LEITURA da historia, independente da ordem de compra. */
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
 */
const RELATED: Record<LoreFragmentId, LoreFragmentId[]> = {
  'AX-PUB-001': ['AX-PRC-014', 'AX-GEN-G04'],
  'AX-PUB-002': ['AX-PRC-014'],
  'AX-ENG-011': ['AX-INC-027'],
  'AX-PRC-014': ['AX-PUB-001', 'AX-EXE-033'],
  'AX-INC-027': ['AX-ENG-011', 'AX-UNK-041'],
  'AX-EXE-033': ['AX-PRC-014', 'AX-UNK-041'],
  'AX-UNK-041': ['AX-INC-027', 'AX-GEN-G04'],
  'AX-PUB-003': ['AX-PRC-016'],
  'AX-ENG-013': ['AX-INC-023'],
  'AX-PRC-016': ['AX-PUB-003', 'AX-EXE-031'],
  'AX-INC-023': ['AX-ENG-013', 'AX-UNK-044'],
  'AX-EXE-031': ['AX-PRC-016', 'AX-UNK-044'],
  'AX-UNK-044': ['AX-INC-023', 'AX-UNK-047'],
  'AX-PUB-005': ['AX-PRC-019'],
  'AX-ENG-018': ['AX-INC-029'],
  'AX-PRC-019': ['AX-PUB-005', 'AX-EXE-036'],
  'AX-INC-029': ['AX-ENG-018', 'AX-UNK-047'],
  'AX-EXE-036': ['AX-PRC-019', 'AX-UNK-047'],
  'AX-UNK-047': ['AX-INC-029', 'AX-UNK-044'],
  'AX-PUB-007': ['AX-PRC-021'],
  'AX-ENG-015': ['AX-INC-025'],
  'AX-PRC-021': ['AX-PUB-007', 'AX-EXE-038'],
  'AX-INC-025': ['AX-ENG-015', 'AX-UNK-049'],
  'AX-EXE-038': ['AX-PRC-021', 'AX-UNK-049'],
  'AX-UNK-049': ['AX-INC-025', 'AX-GEN-G04'],
  // A trilha de IA costura em DUAS linhas que se cruzam no fim: a da venda
  // (propaganda → treino com dados de mortos → engajamento preventivo) e a da
  // maquina (classificador → disparo sem operador → o modelo se lembra).
  'AX-PUB-009': ['AX-PRC-024'],
  'AX-ENG-020': ['AX-INC-032'],
  'AX-PRC-024': ['AX-PUB-009', 'AX-EXE-040'],
  'AX-INC-032': ['AX-ENG-020', 'AX-UNK-052'],
  'AX-EXE-040': ['AX-PRC-024', 'AX-UNK-052'],
  'AX-UNK-052': ['AX-INC-032', 'AX-GEN-G04'],
  'AX-GEN-G01': ['AX-PUB-001'],
  'AX-GEN-G02': ['AX-GEN-G01'],
  'AX-GEN-G03': ['AX-GEN-G02', 'AX-EXE-033'],
  'AX-GEN-G04': ['AX-GEN-G03', 'AX-UNK-041', 'AX-UNK-049'],
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
};

/**
 * A ordem de LEITURA.
 *
 * Nao e a ordem de compra e nao pode ser: quem sobe um ramo inteiro antes de
 * tocar nos outros leria quatro atos de Chassi seguidos. A cronologia deixa o
 * Codex reordenar por data interna e a historia ficar legivel em qualquer rota.
 */
const CHRONOLOGY: readonly LoreFragmentId[] = [
  'AX-PUB-001',
  'AX-PUB-002',
  'AX-PUB-003',
  'AX-PUB-005',
  'AX-PUB-007',
  'AX-PUB-009',
  'AX-GEN-G01',
  'AX-ENG-011',
  'AX-ENG-013',
  'AX-ENG-015',
  'AX-ENG-018',
  'AX-ENG-020',
  'AX-PRC-014',
  'AX-PRC-016',
  'AX-PRC-019',
  'AX-PRC-021',
  'AX-PRC-024',
  'AX-GEN-G02',
  'AX-INC-023',
  'AX-INC-025',
  'AX-INC-027',
  'AX-INC-029',
  'AX-INC-032',
  'AX-GEN-G03',
  'AX-EXE-031',
  'AX-EXE-033',
  'AX-EXE-036',
  'AX-EXE-038',
  'AX-EXE-040',
  'AX-UNK-041',
  'AX-UNK-044',
  'AX-UNK-047',
  'AX-UNK-049',
  'AX-UNK-052',
  'AX-GEN-G04',
];

const define = (
  id: LoreFragmentId,
  unlockedByUpgradeId: UpgradeId | null,
  unlockedByGeneration: ProspectorGeneration | null,
): LoreFragmentDefinition => {
  const prefix = prefixOf(id);
  return {
    id,
    unlockedByUpgradeId,
    unlockedByGeneration,
    category: CATEGORY_BY_PREFIX[prefix] ?? 'unknown',
    clearanceLevel: CLEARANCE_BY_PREFIX[prefix] ?? 0,
    documentCode: id,
    chronologyIndex: CHRONOLOGY.indexOf(id),
    relatedFragmentIds: RELATED[id] ?? [],
    redactionLevel: REDACTION[id] ?? 0,
  };
};

export const LORE_FRAGMENTS: readonly LoreFragmentDefinition[] = [
  define('AX-PUB-001', null, null),
  ...UPGRADES.map((upgrade) => define(upgrade.loreFragmentId, upgrade.id, null)),
  define('AX-GEN-G01', null, 'G-01'),
  define('AX-GEN-G02', null, 'G-02'),
  define('AX-GEN-G03', null, 'G-03'),
  define('AX-GEN-G04', null, 'G-04'),
];

const BY_ID = new Map(LORE_FRAGMENTS.map((f) => [f.id, f]));

export const findLoreFragment = (id: LoreFragmentId): LoreFragmentDefinition | undefined =>
  BY_ID.get(id);

export const TOTAL_LORE_FRAGMENTS = LORE_FRAGMENTS.length;

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
 */
export const toPublicFragment = (
  definition: LoreFragmentDefinition,
  locale: LoreLocale,
  unlocked?: ReadonlySet<LoreFragmentId>,
): PublicLoreFragment => {
  const text = textFor(definition.id, locale);
  return {
    id: definition.id,
    unlockedByUpgradeId: definition.unlockedByUpgradeId,
    unlockedByGeneration: definition.unlockedByGeneration,
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
  LORE_FRAGMENTS.filter((f) => f.unlockedByUpgradeId !== null).every((f) =>
    findUpgrade(f.unlockedByUpgradeId ?? ''),
  );
