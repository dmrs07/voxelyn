import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { repoRoot } from './paths.mjs';

/** git(...) sincrono, saida em texto, sempre a partir da raiz do repo. */
export function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: opts.cwd ?? repoRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // `quiet` cala o stderr de sondagens que FALHAM DE PROPOSITO — perguntar
    // ao git se um pacote ja existia num commit antigo imprime "fatal: path
    // ... exists on disk, but not in <sha>" para cada resposta negativa, e o
    // resultado seria centenas de linhas de erro num comando bem-sucedido.
    stdio: opts.quiet ? ['ignore', 'pipe', 'ignore'] : ['ignore', 'pipe', 'pipe'],
  }).trim();
}

// Separadores de unidade/registro do ASCII: nao aparecem em mensagem de
// commit, entao dividir por eles nunca parte um assunto no meio.
const FIELD = '\x1f';
const RECORD = '\x1e';

function logRecords(range, extraArgs = []) {
  const format = ['%H', '%h', '%ad', '%an', '%s'].join(FIELD) + RECORD;
  const out = git(['log', `--pretty=format:${format}`, '--date=short', ...extraArgs, range]);
  if (!out) return [];
  return out
    .split(RECORD)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha, short, date, author, subject] = r.split(FIELD);
      return { sha, short, date, author, subject };
    });
}

/**
 * Commits na BORDA de um clone shallow: os que existem sem os pais deles.
 *
 * Isto importa porque `git show` num commit sem pai nao mostra a mudanca —
 * mostra a arvore INTEIRA como adicionada. Sem esta guarda, o primeiro post
 * do devlog anunciaria "535 arquivos, +121.586 linhas" para um commit que
 * mexeu em meia duzia deles, e listaria como area tocada todo pacote do
 * monorepo.
 */
let shallowCache = null;
function shallowBoundary() {
  if (shallowCache) return shallowCache;
  shallowCache = new Set();
  try {
    const out = git(['rev-parse', '--show-toplevel']);
    const file = `${out}/.git/shallow`;
    shallowCache = new Set(
      readFileSync(file, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    );
  } catch {
    /* clone completo: nao ha borda */
  }
  return shallowCache;
}

/** Um commit so tem diff confiavel se este clone tiver o pai dele. */
function hasParent(sha) {
  if (shallowBoundary().has(sha)) return false;
  return git(['rev-list', '--parents', '-n', '1', sha]).split(/\s+/).length > 1;
}

/** Assuntos que sao contabilidade de branch, nao entrega. */
const BOOKKEEPING = /^(Merge |Revert ")/i;

/**
 * O devlog nao fala do devlog.
 *
 * O proprio pipeline vive no repositorio e portanto aparece no historico. Uma
 * entrada sobre o commit que criou o pipeline seria um post anunciando a
 * existencia do post — ruido, e ruido que se repete a cada dia publicado,
 * porque cada publicacao tambem commita.
 */
const SELF = /^(docs\/devlog|scripts\/devlog)/;

function isSelfReferential(commits) {
  const files = new Set();
  for (const c of commits) {
    if (!hasParent(c.sha)) continue;
    for (const f of git(['show', '--name-only', '--pretty=format:', c.sha]).split('\n'))
      if (f.trim()) files.add(f.trim());
  }
  if (!files.size) return false;
  // Maioria, nao unanimidade: o commit que cria o pipeline tambem encosta em
  // package.json, eslint e lockfile, e exigir 100% deixaria justamente ele
  // passar. Um PR de verdade que por acaso atualize um arquivo do devlog fica
  // muito abaixo do corte.
  const mine = [...files].filter((f) => SELF.test(f)).length;
  return mine / files.size >= 0.6;
}

function representativeTitle(branch) {
  for (let i = branch.length - 1; i >= 0; i -= 1) {
    if (!BOOKKEEPING.test(branch[i].subject)) return branch[i].subject;
  }
  return branch[branch.length - 1].subject;
}

/**
 * Percorre a linha principal (--first-parent) e devolve as "unidades de
 * trabalho" em ordem CRONOLOGICA CRESCENTE.
 *
 * Cada merge de PR vira uma unidade contendo os commits do branch lateral
 * (M^1..M^2). Commits feitos direto na main — que existem e nao pertencem a
 * PR nenhuma — nao sao descartados: viram unidades avulsas do tipo 'direct'.
 * Perder esses commits significaria um devlog com buracos.
 */
export function workUnits(ref = 'HEAD') {
  const mainline = logRecords(ref, ['--first-parent']).reverse();
  const units = [];

  for (const commit of mainline) {
    const parents = git(['rev-list', '--parents', '-n', '1', commit.sha]).split(/\s+/).slice(1);
    const isMerge = parents.length > 1;

    if (!isMerge) {
      // Na BORDA de um clone shallow o merge mais antigo aparece sem pais e
      // se disfarca de commit direto. Ele nao descreve trabalho nenhum — o
      // conteudo dele esta em commits que este clone nao tem — e virar
      // entrada de devlog com o titulo "Merge pull request #85 from ..." e
      // exatamente o post que nao queremos.
      if (/^Merge (pull request|branch|origin)/i.test(commit.subject)) continue;
      if (isSelfReferential([commit])) continue;

      units.push({
        kind: 'direct',
        pr: null,
        tip: commit.sha,
        short: commit.short,
        date: commit.date,
        title: commit.subject,
        commits: [commit],
      });
      continue;
    }

    const prMatch = /Merge pull request #(\d+)/.exec(commit.subject);
    const branch = logRecords(`${parents[0]}..${parents[1]}`).reverse();
    // Merge sem commits proprios (ex.: main puxada de volta pro branch) nao e
    // uma unidade de trabalho — nao ha o que contar sobre ele.
    if (branch.length === 0) continue;
    if (isSelfReferential(branch)) continue;

    units.push({
      kind: 'pr',
      pr: prMatch ? Number(prMatch[1]) : null,
      // Construimos o MERGE, nao a ponta do branch: e o estado real da main
      // depois daquele PR, que e o que o devlog daquele dia descreve.
      tip: commit.sha,
      short: commit.short,
      date: commit.date,
      // O assunto do merge e burocratico ("Merge pull request #123 from ...").
      // O que descreve a entrega e o ultimo commit REAL do branch — pulando
      // os merges de main puxada de volta, que nao contam nada.
      title: representativeTitle(branch),
      commits: branch,
    });
  }

  return units;
}

/**
 * Quais apps ja existiam num commit.
 *
 * A escolha de receita precisa saber a ERA: em 18/01 so havia o editor, em
 * fevereiro entrou o roguelike, o Survival so nasceu em julho. Perguntar a
 * arvore daquele commit e mais barato e mais confiavel do que deduzir por
 * data — um branch antigo mergeado tarde quebraria qualquer regra de calendario.
 */
export function appsPresentAt(sha, apps) {
  const present = new Set();
  for (const [name, { dir }] of Object.entries(apps)) {
    try {
      git(['cat-file', '-e', `${sha}:${dir}/package.json`], { quiet: true });
      present.add(name);
    } catch {
      /* o pacote ainda nao existia neste ponto da historia */
    }
  }
  return present;
}

/** Pacotes/areas tocados por um conjunto de commits, mais frequente primeiro. */
export function touchedAreas(commits) {
  const counts = new Map();
  for (const c of commits) {
    if (!hasParent(c.sha)) continue;
    const files = git(['show', '--name-only', '--pretty=format:', c.sha])
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    for (const file of files) {
      const parts = file.split('/');
      const area = parts[0] === 'packages' && parts[1] ? `packages/${parts[1]}` : parts[0];
      counts.set(area, (counts.get(area) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([area]) => area);
}

/**
 * Linhas adicionadas/removidas e arquivos tocados no conjunto.
 *
 * `partial: true` avisa que algum commit ficou de fora por estar na borda do
 * clone — os numeros existem, mas subestimam. Quem exibe decide: o carrossel
 * simplesmente omite o slide de numeros nesse caso, porque numero errado num
 * post e pior do que numero nenhum.
 */
export function diffStat(commits) {
  let added = 0;
  let removed = 0;
  let partial = false;
  const files = new Set();
  for (const c of commits) {
    if (!hasParent(c.sha)) {
      partial = true;
      continue;
    }
    const out = git(['show', '--numstat', '--pretty=format:', c.sha]);
    for (const line of out.split('\n')) {
      const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim());
      if (!m) continue;
      if (m[1] !== '-') added += Number(m[1]);
      if (m[2] !== '-') removed += Number(m[2]);
      files.add(m[3]);
    }
  }
  return { added, removed, files: files.size, partial };
}
