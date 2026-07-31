// i18n do Survival: uma chave, N línguas, zero texto solto.
//
// Três decisões que valem a pena serem ditas em voz alta:
//
// 1) Os catálogos são ESTÁTICOS, não carregados sob demanda. O jogo é um PWA
//    que precisa abrir offline e o solo é o modo principal; um `import()` de
//    tradução transformaria a primeira frase da tela numa dependência de rede
//    ou num arquivo a mais no precache. Duas línguas cabem no bundle sem
//    discussão, e quando forem oito o custo continua sendo texto comprimido.
//
// 2) pt-BR é a FONTE e as demais são `Record<MessageKey, string>`. Não existe
//    fallback silencioso para chave faltando numa língua traduzida porque não
//    existe chave faltando: o compilador cobra. O fallback em runtime cobre
//    apenas o caso de um catálogo carregado de fora do build.
//
// 3) Nada aqui exige DOM. Os testes rodam em ambiente `node`, e a simulação e
//    os formatadores de texto (`run-summary`, `records`) são importados por
//    eles: qualquer acesso a `navigator`, `localStorage` ou `document` é
//    guardado, e a língua padrão é pt-BR.

import { PT_BR } from './locales/pt-BR';
import { EN } from './locales/en';

export type MessageKey = keyof typeof PT_BR;
export type Locale = 'pt-BR' | 'en';

export const LOCALES: readonly Locale[] = ['pt-BR', 'en'];

/** A língua em que o jogo foi escrito, e o destino de qualquer detecção falha. */
export const DEFAULT_LOCALE: Locale = 'pt-BR';

/**
 * O nome de cada língua NA PRÓPRIA língua.
 *
 * Traduzir os nomes seria o erro clássico: quem abriu o jogo em português por
 * engano precisa achar "English" na lista, e não "Inglês".
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  'pt-BR': 'Português',
  en: 'English',
};

const CATALOGS: Record<Locale, Record<MessageKey, string>> = {
  'pt-BR': PT_BR,
  en: EN,
};

const STORAGE_KEY = 'voxelyn.locale';

/**
 * Reduz uma tag BCP-47 a uma das línguas que existem.
 *
 * Por prefixo, e não por igualdade: `pt-PT`, `pt` e `pt-BR` são todos o mesmo
 * catálogo aqui, e `en-GB` é `en`. Recusar `pt-PT` porque a tag não bate ao
 * caractere mandaria um falante de português para o inglês.
 */
export const normalizeLocale = (tag: string | null | undefined): Locale | null => {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower === 'pt-br' || lower.startsWith('pt')) return 'pt-BR';
  if (lower.startsWith('en')) return 'en';
  return null;
};

const readStoredLocale = (): Locale | null => {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage bloqueado (modo privativo): a língua não persiste
  }
};

const persistLocale = (locale: Locale): void => {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* sem storage: a escolha vale para esta sessão */
  }
};

/**
 * A língua desta sessão, em ordem de autoridade.
 *
 * `?lang=` vem primeiro porque é o que permite MANDAR um link já traduzido —
 * que é como o convite de co-op viaja. A escolha salva vem antes do navegador
 * porque uma preferência explícita não pode ser desfeita por uma configuração
 * de sistema que o jogador nem lembra de ter.
 */
export const detectLocale = (): Locale => {
  // Sem documento não há jogador para detectar língua.
  //
  // A guarda é por `document` e não por `navigator` porque o Node 22 EXPÕE
  // `navigator.language` — com o locale da máquina, que aqui é o do runner de
  // CI e não o de ninguém. Sem isto, os testes de `run-summary` e `records`
  // (que rodam em ambiente `node` e cobram o texto-fonte) passavam ou falhavam
  // conforme a variável de ambiente da máquina que os rodou.
  if (typeof document === 'undefined') return DEFAULT_LOCALE;

  const fromQuery = normalizeLocale(new URLSearchParams(location.search).get('lang'));
  if (fromQuery) return fromQuery;
  const stored = readStoredLocale();
  if (stored) return stored;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const match = normalizeLocale(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
};

let current: Locale = detectLocale();
const listeners = new Set<() => void>();

export const getLocale = (): Locale => current;

/**
 * Assina a troca de língua. Devolve o cancelamento.
 *
 * Existe porque metade da UI é DOM montado uma vez (rótulo do botão de som,
 * painel de registro aberto) e a outra metade é canvas redesenhado a cada
 * quadro. O canvas se resolve sozinho no quadro seguinte; o DOM precisa ser
 * avisado, e avisar é mais barato que reconstruir a tela inteira.
 */
export const onLocaleChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const setLocale = (locale: Locale): void => {
  if (locale === current) return;
  current = locale;
  persistLocale(locale);
  applyStaticTranslations();
  // Cópia da lista: um ouvinte que se cancela durante a notificação não pode
  // encurtar o laço e pular o vizinho dele.
  for (const listener of [...listeners]) listener();
};

/**
 * O texto de uma chave, com interpolação `{nome}`.
 *
 * Um marcador sem valor correspondente fica no texto em vez de virar
 * `undefined`: "Setor {sector}" na tela é um bug óbvio e localizável, e
 * "Setor undefined" parece um bug de dado.
 */
export const t = (key: MessageKey, params?: Record<string, string | number>): string => {
  const template = CATALOGS[current][key] ?? PT_BR[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
};

/**
 * Plural de contagem, do jeito que pt-BR e en precisam: 1 e o resto.
 *
 * Deliberadamente NÃO é `Intl.PluralRules`. As duas línguas atendidas hoje têm
 * as mesmas duas categorias, e uma língua com `few`/`many` (russo, polonês) vai
 * exigir chaves por categoria de qualquer forma — a hora de trocar isto é a de
 * adicionar essa língua, não antes.
 */
export const tCount = (
  keys: { one: MessageKey; other: MessageKey },
  count: number,
  params?: Record<string, string | number>,
): string => t(count === 1 ? keys.one : keys.other, { count, ...params });

// ---------------------------------------------------------------------------
// DOM estático
// ---------------------------------------------------------------------------

/**
 * Traduz o HTML marcado com `data-i18n*`.
 *
 * O `index.html` não carrega mais nenhuma frase: ele carrega CHAVES, e esta
 * função as resolve na carga e a cada troca de língua. A alternativa — montar
 * os menus por JS — jogaria fora a única parte da UI que hoje é legível como
 * documento.
 *
 * `textContent` e nunca `innerHTML`: a tradução é dado do build, mas a regra de
 * "texto entra como texto" vale para o arquivo inteiro por disciplina, e não
 * por análise de origem caso a caso.
 */
export const applyStaticTranslations = (root: ParentNode | null = null): void => {
  if (typeof document === 'undefined') return;
  const scope = root ?? document;

  scope.querySelectorAll<HTMLElement>('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n as MessageKey | undefined;
    if (key) node.textContent = t(key);
  });
  scope.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((node) => {
    const key = node.dataset.i18nPlaceholder as MessageKey | undefined;
    if (key) node.setAttribute('placeholder', t(key));
  });
  scope.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((node) => {
    const key = node.dataset.i18nAriaLabel as MessageKey | undefined;
    if (key) node.setAttribute('aria-label', t(key));
  });

  // Só quando o escopo é o documento: traduzir uma subárvore não deve reescrever
  // o título da aba nem o idioma da página.
  if (scope === document) {
    document.title = t('app.title');
    document.documentElement.lang = current;
  }
};
