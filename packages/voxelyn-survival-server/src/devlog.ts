// Leitura do devlog a partir do disco.
//
// O pipeline de `scripts/devlog` produz arquivos versionados em `docs/devlog`;
// este modulo os LE, e nada aqui escreve. A separacao importa: quem publica e o
// pipeline, rodando na tarefa diaria com o repositorio inteiro em maos; o
// servidor so serve o que ja foi commitado.
//
// Nenhuma dependencia nova. O plano e JSON e os posts sao Markdown — os dois
// cabem em `node:fs`.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** O subconjunto do plan.json que o servico usa. */
export type DevlogShot = { recipe: string; file: string; label: string };

export type DevlogEntry = {
  id: string;
  pr: number | null;
  title: string;
  slug: string;
  tipShort: string;
  realDate: string;
  publishDate: string;
  status: 'pending' | 'shot' | 'written' | 'published';
  skipped: boolean;
  shots: DevlogShot[];
  carousel: string[];
  carousels?: Record<string, { files: string[]; pdf: string }>;
  publishedAt: string | null;
  commits: Array<{ sha: string; subject: string }>;
  stat: { added: number; removed: number; files: number; partial?: boolean };
};

export type DevlogPlan = { startDate: string; entries: DevlogEntry[] };

export type DevlogSocial = {
  hook?: string;
  slides?: Array<{ title?: string; body?: string; shot?: string }>;
  caption?: string;
  tags?: string[];
};

/** Um arquivo servivel: bytes mais o tipo, ja resolvido. */
export type DevlogAsset = { body: Buffer; contentType: string };

/**
 * O que pode sair como arquivo: imagem e PDF, e mais nada.
 *
 * `.md` e `.json` ficam DE FORA de proposito. O post e servido renderizado, e
 * o plano e a copy social sao lidos por acessor tipado — nenhum deles precisa
 * de rota de download. Deixa-los aqui transformava `asset()` num leitor
 * generico do diretorio: foi assim que `/devlog/a/social/001.json` respondeu
 * 200 antes de o teste pegar.
 */
const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

/**
 * Onde mora `docs/devlog`.
 *
 * Sobe a arvore procurando `docs/devlog/plan.json` em vez de contar saltos de
 * `..`: o modulo roda de `src/` nos testes e de `dist/` em producao, e um
 * caminho relativo fixo estaria certo em exatamente um dos dois. `DEVLOG_DIR`
 * cobre um layout que a busca nao preveja.
 */
export const resolveDevlogDir = (start?: string): string | null => {
  if (process.env.DEVLOG_DIR) {
    return existsSync(join(process.env.DEVLOG_DIR, 'plan.json')) ? process.env.DEVLOG_DIR : null;
  }
  let dir = start ?? dirname(fileURLToPath(import.meta.url));
  for (let up = 0; up < 8; up += 1) {
    const candidate = join(dir, 'docs', 'devlog');
    if (existsSync(join(candidate, 'plan.json'))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
};

export interface DevlogStore {
  /** false quando `docs/devlog` nao esta ao alcance — as rotas viram 404. */
  readonly available: boolean;
  plan(): DevlogPlan | null;
  /** So as entradas ja publicadas, da mais recente para a mais antiga. */
  published(): DevlogEntry[];
  entry(id: string): DevlogEntry | null;
  /** O Markdown do post, ou null se a redacao ainda nao existe. */
  post(id: string): string | null;
  /**
   * O titulo do POST, que nao e o titulo da entrada.
   *
   * `entry.title` e o assunto do commit — materia-prima. O H1 do markdown e o
   * que foi de fato publicado ("Dia 1: uma biblioteca sem tela" contra "first
   * commit"), e e ele que a vitrine deve mostrar.
   */
  headline(id: string): string | null;
  social(id: string, lang?: string | null): DevlogSocial | null;
  asset(relativePath: string): DevlogAsset | null;
}

/** Ids sao sempre tres digitos; qualquer outra coisa nao e um id. */
export const isEntryId = (value: string): boolean => /^\d{3}$/.test(value);

/**
 * Resolve um caminho DENTRO da raiz, ou null.
 *
 * `normalize` antes de `resolve` e a checagem de prefixo com separador: sem o
 * separador, uma raiz `/srv/devlog` deixaria passar `/srv/devlog-secreto`,
 * porque a string realmente comeca com a outra.
 */
const within = (root: string, relativePath: string): string | null => {
  const cleaned = normalize(relativePath).replace(/^([./\\])+/, '');
  const full = resolve(root, cleaned);
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
};

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf('.');
  return dot < 0 ? '' : path.slice(dot).toLowerCase();
};

/**
 * Store com cache invalidado por mtime.
 *
 * O plano tem ~180 KB e e relido a cada requisicao sem cache; com cache, so
 * quando o arquivo muda. Isso importa porque a tarefa diaria REESCREVE o plano
 * enquanto o servidor esta no ar: um cache eterno mostraria a fila de ontem
 * ate o proximo deploy.
 */
export const createDevlogStore = (
  dir: string | null = resolveDevlogDir(),
  log: (line: Record<string, unknown>) => void = () => {},
): DevlogStore => {
  if (!dir) log({ ev: 'devlog_dir_missing' });
  else log({ ev: 'devlog_dir', dir });

  let cached: { mtimeMs: number; plan: DevlogPlan } | null = null;
  // Titulos ficam em cache sem invalidacao: o indice le um por entrada
  // publicada, e uma entrada publicada nao muda mais — o pipeline nunca
  // reescreve o passado.
  const headlines = new Map<string, string | null>();

  const readPlan = (): DevlogPlan | null => {
    if (!dir) return null;
    const path = join(dir, 'plan.json');
    let mtimeMs: number;
    try {
      mtimeMs = statSync(path).mtimeMs;
    } catch {
      return null;
    }
    if (cached && cached.mtimeMs === mtimeMs) return cached.plan;
    try {
      const plan = JSON.parse(readFileSync(path, 'utf8')) as DevlogPlan;
      cached = { mtimeMs, plan };
      return plan;
    } catch (err) {
      // Plano ilegivel (escrita a meio caminho, JSON quebrado) nao derruba o
      // servico: serve o ultimo bom, se houver, e segue.
      log({
        ev: 'devlog_plan_unreadable',
        error: err instanceof Error ? err.message : String(err),
      });
      return cached?.plan ?? null;
    }
  };

  const readJson = <T>(path: string): T | null => {
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
      return null;
    }
  };

  return {
    available: dir !== null,

    plan: readPlan,

    published(): DevlogEntry[] {
      const plan = readPlan();
      if (!plan) return [];
      return plan.entries
        .filter((e) => e.status === 'published')
        .sort((a, b) => b.id.localeCompare(a.id));
    },

    entry(id): DevlogEntry | null {
      if (!isEntryId(id)) return null;
      return readPlan()?.entries.find((e) => e.id === id) ?? null;
    },

    post(id): string | null {
      if (!dir || !isEntryId(id)) return null;
      const entriesDir = join(dir, 'entries');
      if (!existsSync(entriesDir)) return null;
      // Casa pelo PREFIXO do id: o slug do arquivo vem do titulo do post e pode
      // ser reescrito sem que o plano saiba.
      const file = readdirSync(entriesDir).find((f) => f.startsWith(`${id}-`) && f.endsWith('.md'));
      if (!file) return null;
      try {
        return readFileSync(join(entriesDir, file), 'utf8');
      } catch {
        return null;
      }
    },

    headline(id): string | null {
      if (headlines.has(id)) return headlines.get(id) ?? null;
      const markdown = this.post(id);
      const match = markdown ? /^#\s+(.+)$/m.exec(markdown) : null;
      const title = match ? match[1].replace(/^\d{3}\s*[—-]\s*/, '').trim() : null;
      headlines.set(id, title);
      return title;
    },

    social(id, lang = null): DevlogSocial | null {
      if (!dir || !isEntryId(id)) return null;
      if (lang !== null && !/^[a-z]{2}$/.test(lang)) return null;
      const name = lang ? `${id}.${lang}.json` : `${id}.json`;
      return readJson<DevlogSocial>(join(dir, 'social', name));
    },

    asset(relativePath): DevlogAsset | null {
      if (!dir) return null;
      const full = within(dir, relativePath);
      if (!full) return null;
      const contentType = MIME[extensionOf(full)];
      // Lista de tipos conhecidos, e nao octet-stream por padrao: o diretorio
      // do devlog tambem guarda o plano e a copy social, e servir "qualquer
      // arquivo" daqui e como o console vazaria a fila inteira.
      if (!contentType) return null;
      try {
        if (!statSync(full).isFile()) return null;
        return { body: readFileSync(full), contentType };
      } catch {
        return null;
      }
    },
  };
};
