import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content, 'utf8');

const replaceOnce = (source, from, to, label) => {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`anchor not found: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) {
    throw new Error(`anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + to + source.slice(first + from.length);
};

const insertBeforeBlockEnd = (source, blockStart, nextBlock, insertion, label) => {
  const start = source.indexOf(blockStart);
  const next = source.indexOf(nextBlock, start + blockStart.length);
  if (start < 0 || next < 0) throw new Error(`block not found: ${label}`);
  const closing = source.lastIndexOf('};', next);
  if (closing < start) throw new Error(`block closing not found: ${label}`);
  return source.slice(0, closing) + insertion + source.slice(closing);
};

const lorePath = 'packages/voxelyn-survival-server/src/progression-lore.ts';
let lore = read(lorePath);

lore = replaceOnce(
  lore,
  '// O Codex corporativo: 64 documentos, e as regras de quem pode ler o que.',
  '// O Codex corporativo: 88 documentos, e as regras de quem pode ler o que.',
  'lore document count comment',
);

lore = replaceOnce(
  lore,
  "import { LORE_TEXT, type LoreLocale, type LoreText } from './progression-lore-text.js';",
  "import {\n  ASSET_MEMORY_CHRONOLOGY,\n  ASSET_MEMORY_MILESTONE_LORE,\n  ASSET_MEMORY_REDACTION,\n  ASSET_MEMORY_RELATED,\n} from './progression-lore-asset-memory.js';\nimport { LORE_TEXT, type LoreLocale, type LoreText } from './progression-lore-text.js';",
  'asset memory catalog import',
);

lore = replaceOnce(
  lore,
  `/**
 * Marcos de abate: a trilha do Corcel Fungico.
 *
 * A ficha inicial (AX-INC-024) nega os arreios; cada marco seguinte e a
 * burocracia perdendo a capacidade de nao ver — o formulario sem campo
 * "cavalo", o fogo que a quimica nao explica, a ordem de vocabulario — ate o
 * documento sem departamento que nomeia o cavaleiro. Os numeros sao baixos de
 * proposito: o EQ-02 e um miniboss, e a piada morre se o segredo exigir
 * farm.
 */`,
  `/**
 * Marcos de abate dos Ativos de assinatura.
 *
 * O Corcel inaugura o mecanismo; Ressonante, Lampreia, Fole, Scoriac e
 * Espectro Glacial usam a mesma progressao 3 → 6 → 10 → 15. Os numeros sao
 * baixos de proposito: documento e historia, nao recompensa por farming.
 */`,
  'milestone comment',
);

lore = replaceOnce(
  lore,
  "  { archetype: 'fungal_horse', minKills: 15, fragmentId: 'AX-UNK-046' },\n];",
  "  { archetype: 'fungal_horse', minKills: 15, fragmentId: 'AX-UNK-046' },\n  ...ASSET_MEMORY_MILESTONE_LORE,\n];",
  'milestone spread',
);

lore = insertBeforeBlockEnd(
  lore,
  'const RELATED: Record<LoreFragmentId, LoreFragmentId[]> = {',
  'const REDACTION:',
  '  ...ASSET_MEMORY_RELATED,\n',
  'related map',
);

lore = insertBeforeBlockEnd(
  lore,
  'const REDACTION: Record<LoreFragmentId, 0 | 1 | 2 | 3> = {',
  '/**\n * A ordem de LEITURA.',
  '  ...ASSET_MEMORY_REDACTION,\n',
  'redaction map',
);

lore = replaceOnce(
  lore,
  "  'AX-ENG-025',\n  // Ato III — Custo",
  "  'AX-ENG-025',\n  ...ASSET_MEMORY_CHRONOLOGY.engineering,\n  // Ato III — Custo",
  'engineering chronology',
);
lore = replaceOnce(
  lore,
  "  'AX-INC-034',\n  'AX-GEN-G03',",
  "  'AX-INC-034',\n  ...ASSET_MEMORY_CHRONOLOGY.incident,\n  'AX-GEN-G03',",
  'incident chronology',
);
lore = replaceOnce(
  lore,
  "  'AX-EXE-043',\n  // Ato VI — Memoria",
  "  'AX-EXE-043',\n  ...ASSET_MEMORY_CHRONOLOGY.executive,\n  // Ato VI — Memoria",
  'executive chronology',
);
lore = replaceOnce(
  lore,
  "  'AX-UNK-052',\n  'AX-GEN-G04',",
  "  'AX-UNK-052',\n  ...ASSET_MEMORY_CHRONOLOGY.unknown,\n  'AX-GEN-G04',",
  'unknown chronology',
);

write(lorePath, lore);

const textPath = 'packages/voxelyn-survival-server/src/progression-lore-text.ts';
let text = read(textPath);
text = replaceOnce(
  text,
  '// Os 64 documentos da Aurix Dynamics, em pt-BR e en.',
  '// Os 88 documentos da Aurix Dynamics, em pt-BR e en.',
  'text count comment',
);
text = replaceOnce(
  text,
  "import type { LoreFragmentId } from '@voxelyn/survival-sim';",
  "import type { LoreFragmentId } from '@voxelyn/survival-sim';\nimport { ASSET_MEMORY_TEXT } from './progression-lore-asset-memory-text.js';",
  'asset memory text import',
);
text = replaceOnce(
  text,
  '\n};\n\nconst en: Record<LoreFragmentId, LoreText> = {',
  "\n  ...ASSET_MEMORY_TEXT['pt-BR'],\n};\n\nconst en: Record<LoreFragmentId, LoreText> = {",
  'pt text spread',
);
text = replaceOnce(
  text,
  '\n};\n\nexport const LORE_TEXT: Record<LoreLocale, Record<LoreFragmentId, LoreText>> = {',
  '\n  ...ASSET_MEMORY_TEXT.en,\n};\n\nexport const LORE_TEXT: Record<LoreLocale, Record<LoreFragmentId, LoreText>> = {',
  'en text spread',
);
write(textPath, text);

const testPath = 'packages/voxelyn-survival-server/tests/progression.test.ts';
let tests = read(testPath);
tests = replaceOnce(
  tests,
  "it('tem 68 documentos: 30 protocolos, 4 marcos, 19 de Ativo, 13 Descobertas, 1 composto e o publico', () => {",
  "it('tem 88 documentos: 30 protocolos, 4 marcos, 39 de Ativo, 13 Descobertas, 1 composto e o publico', () => {",
  'codex test description',
);
tests = replaceOnce(
  tests,
  'expect(TOTAL_LORE_FRAGMENTS).toBe(68);',
  'expect(TOTAL_LORE_FRAGMENTS).toBe(88);',
  'codex total test',
);
tests = replaceOnce(
  tests,
  "expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'asset')).toHaveLength(19);",
  "expect(LORE_FRAGMENTS.filter((f) => f.trigger.kind === 'asset')).toHaveLength(39);",
  'asset trigger total test',
);
write(testPath, tests);

const specPath = 'docs/superpowers/specs/2026-08-04-survival-ia-codex-narrativo.md';
let spec = read(specPath);
spec = spec.replace('progression-lore-text.ts  os 64 textos', 'progression-lore-text.ts  os 88 textos');
spec = spec.replace('## 4. Catálogo: 68 documentos', '## 4. Catálogo: 88 documentos');
spec = spec.replace(
  '35 existentes + 33 novos: 30 de protocolo, 4 marcos geracionais, 1 público,\n**19 de Ativo** (15 fichas + 4 marcos do Corcel), **13 de Descoberta**,\n1 composto.',
  'O catálogo atual reúne 30 documentos de protocolo, 4 marcos geracionais,\n1 público, **39 de Ativo** (15 fichas + 24 milestones), **13 de Descoberta**\ne 1 composto. Os vinte milestones adicionais são detalhados na spec\n`2026-08-04-survival-asset-memory-milestones.md`.',
);
spec = spec.replace('cobrindo os 64 documentos', 'cobrindo os 88 documentos');
write(specPath, spec);

console.log('Asset memory milestones integrated.');
