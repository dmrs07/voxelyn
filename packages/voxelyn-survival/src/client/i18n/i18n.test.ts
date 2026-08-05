import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_LABELS,
  getLocale,
  normalizeLocale,
  onLocaleChange,
  setLocale,
  t,
  tCount,
} from './index';
import { PT_BR } from './locales/pt-BR';
import { EN } from './locales/en';

const CLIENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(CLIENT_DIR, '..', '..');

describe('catálogos', () => {
  // A cobertura em si é garantida pelo compilador (`Record<MessageKey, string>`
  // em cada tradução). O que o tipo NÃO cobre é uma entrada preenchida com
  // string vazia — ela satisfaz `string` e some da tela.
  it.each(LOCALES)('%s não tem entrada vazia', (locale) => {
    setLocale(locale);
    const vazias = (Object.keys(PT_BR) as Array<keyof typeof PT_BR>).filter(
      (key) => t(key).trim() === '',
    );
    expect(vazias).toEqual([]);
  });

  it('traduz de fato: nenhum catálogo é uma cópia do outro', () => {
    const keys = Object.keys(PT_BR) as Array<keyof typeof PT_BR>;
    const iguais = keys.filter((key) => PT_BR[key] === EN[key]);
    // Alguns coincidem de propósito: marca, siglas de designação e o travessão
    // de valor ausente. O que não pode acontecer é a tradução ser um `cp`.
    expect(iguais.length).toBeLessThan(keys.length * 0.2);
  });

  /**
   * Os marcadores de interpolação têm de bater entre as línguas.
   *
   * Uma tradução que perde `{sector}` não quebra nada — ela só apaga o número
   * da tela, em silêncio, para quem joga naquela língua. Este teste é a única
   * coisa entre esse bug e o jogador.
   */
  it.each(LOCALES)('%s preserva todos os marcadores de pt-BR', (locale) => {
    const placeholders = (text: string): string[] => (text.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(PT_BR) as Array<keyof typeof PT_BR>) {
      const esperado = placeholders(PT_BR[key]);
      const obtido = placeholders(locale === 'pt-BR' ? PT_BR[key] : EN[key]);
      expect(obtido, `${locale} · ${key}`).toEqual(esperado);
    }
  });

  it('nomeia cada língua nela mesma', () => {
    for (const locale of LOCALES) expect(LOCALE_LABELS[locale]).toBeTruthy();
    expect(LOCALE_LABELS.en).toBe('English');
  });
});

describe('resolução de chave', () => {
  it('interpola por nome', () => {
    setLocale('pt-BR');
    expect(t('hud.sector', { sector: 2, total: 3 })).toBe('SETOR 2/3');
  });

  // Um marcador sem valor fica visível de propósito: "Setor {sector}" na tela
  // aponta para o bug, e "Setor undefined" parece um bug de dado.
  it('deixa o marcador à vista quando falta o valor', () => {
    setLocale('pt-BR');
    expect(t('hud.sector', { sector: 2 })).toBe('SETOR 2/{total}');
  });

  it('escolhe singular e plural pela contagem', () => {
    setLocale('pt-BR');
    const keys = { one: 'summary.reputation.one', other: 'summary.reputation.other' } as const;
    expect(tCount(keys, 1)).toContain('1 unidade inativa destruída');
    expect(tCount(keys, 4)).toContain('4 unidades inativas destruídas');
  });

  it('troca a língua de toda a superfície de texto', () => {
    setLocale('en');
    expect(t('summary.outcome.dead')).toBe('THE VEIN CONSUMED YOU');
    setLocale('pt-BR');
    expect(t('summary.outcome.dead')).toBe('O VEIO TE CONSUMIU');
  });

  it('avisa quem depende de DOM montado, e só quando algo muda', () => {
    setLocale('pt-BR');
    let avisos = 0;
    const cancelar = onLocaleChange(() => (avisos += 1));
    setLocale('en');
    setLocale('en'); // mesma língua: não é uma mudança
    expect(avisos).toBe(1);
    cancelar();
    setLocale('pt-BR');
    expect(avisos).toBe(1);
  });
});

describe('detecção de língua', () => {
  it('reduz variantes regionais à língua que existe', () => {
    expect(normalizeLocale('pt-BR')).toBe('pt-BR');
    expect(normalizeLocale('pt-PT')).toBe('pt-BR');
    expect(normalizeLocale('PT')).toBe('pt-BR');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('ja-JP')).toBeNull();
    expect(normalizeLocale(null)).toBeNull();
  });

  // Fora do navegador não há jogador cuja língua detectar. Vale um teste porque
  // o Node 22 expõe `navigator.language`, e sem a guarda o texto-fonte cobrado
  // pelos outros testes dependeria do locale da máquina que rodou o CI.
  it('cai no idioma-fonte sem documento', () => {
    expect(typeof document).toBe('undefined');
    expect(DEFAULT_LOCALE).toBe('pt-BR');
    expect(getLocale()).toBe('pt-BR');
  });
});

/**
 * A trava que mantém o "100%": nenhuma frase nova solta no código.
 *
 * Sem isto o sistema decai por adição — o próximo botão nasce com o texto
 * embutido, ninguém percebe, e a versão em inglês fica com uma frase em
 * português no meio.
 *
 * São DUAS varreduras, e a primeira existe porque a segunda não bastou.
 *
 * Procurar letra acentuada é barato e pega quase tudo, já que o texto-fonte é
 * português. Mas "quase" foi o bastante para deixar passar um toast inteiro:
 * `O VEIO RESSOA - DOIS ECOS DEMONSTRAM` é português sem um único acento, e a
 * varredura o leu como se fosse uma constante técnica. Acento é traço de
 * ORTOGRAFIA, e a pergunta que interessa é outra — por onde o texto SAI.
 *
 * Daí a varredura por SUMIDOURO: nos pontos em que uma string vira pixel na
 * tela (`fillText`, `textContent`, `setBanner`, o `text:` de um toast, os
 * campos de apresentação), o literal só é aceito se for vazio ou uma chave que
 * existe no catálogo. Prosa tem espaço e maiúscula; chave é minúscula pontuada.
 * A regra não depende de como a frase se escreve, e por isso não tem como uma
 * língua sem acento — ou uma frase em português que não usa nenhum — escapar.
 */
describe('nenhum texto de jogador fora do catálogo', () => {
  // A arena de chefes (arena.html) é a mesma classe de exceção que o visualizador
  // de sprites: ferramenta de playtest interno, não a run que o jogador paga para
  // ver. Passa pelo mesmo motor de render (por isso mora em `src/client`, e não
  // num diretório de ferramentas separado), mas o texto da tela de setup nunca
  // aparece no jogo publicado.
  const IGNORADOS = new Set(['i18n', 'sprite-viewer.ts', 'arena-main.ts', 'arena-catalog.ts']);

  const arquivos = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (IGNORADOS.has(entry.name)) return [];
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return arquivos(full);
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) return [];
      return [full];
    });

  /** Tira comentários de linha e de bloco: eles são em português por escolha. */
  const semComentarios = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const ARQUIVOS = arquivos(CLIENT_DIR).map((f) => [f.slice(REPO_ROOT.length + 1), f]);

  /**
   * Por onde uma string vira pixel. Cada entrada casa até a aspa de abertura;
   * o literal seguinte é o que precisa ser chave.
   */
  const SUMIDOUROS = [
    /\bfillText\(\s*(['"`])/g,
    /\bstrokeText\(\s*(['"`])/g,
    /\bsetBanner\(\s*(['"`])/g,
    /\btextContent\s*=\s*(['"`])/g,
    /\b(?:text|label|headline|lesson|hint|origin|condition|title|note|code|proc|aggregate|emptyReason|description|shortDescription)\s*:\s*(['"`])/g,
  ];

  const CHAVES = new Set(Object.keys(PT_BR));

  it.each(ARQUIVOS)('%s — sem literal acentuado', (_nome, caminho) => {
    const code = semComentarios(readFileSync(caminho, 'utf8'));
    const literais = code.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
    const soltos = literais.filter((literal) => /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(literal));
    expect(soltos).toEqual([]);
  });

  it.each(ARQUIVOS)('%s — todo sumidouro de texto recebe chave', (_nome, caminho) => {
    const code = semComentarios(readFileSync(caminho, 'utf8'));
    const soltos: string[] = [];
    for (const sumidouro of SUMIDOUROS) {
      for (const match of code.matchAll(sumidouro)) {
        const aspa = match[1];
        const inicio = match.index + match[0].length;
        const fim = code.indexOf(aspa, inicio);
        if (fim === -1) continue;
        const valor = code.slice(inicio, fim);
        // Vazio limpa o nó; chave conhecida resolve no catálogo.
        if (valor === '' || CHAVES.has(valor)) continue;
        // Sem LETRA nenhuma fora das interpolações não há língua: o `!` do alerta,
        // o `12` do cooldown, o `40 / 100` da barra de vida. Um número não se
        // traduz, e a regra é essa e não uma lista de exceções — a lista teria de
        // crescer a cada novo indicador numérico, e alguém acabaria pendurando
        // uma frase nela.
        if (!/\p{L}/u.test(valor.replace(/\$\{[^}]*\}/g, ''))) continue;
        soltos.push(`${match[0].trim()}${valor}${aspa}`);
      }
    }
    expect(soltos).toEqual([]);
  });

  it('o HTML carrega chaves, e não frases', () => {
    const html = readFileSync(join(REPO_ROOT, 'index.html'), 'utf8');
    const corpo = html.slice(html.indexOf('<body>')).replace(/<!--[\s\S]*?-->/g, '');
    // Todo nó de texto com acento precisa estar sob um `data-i18n`: o conteúdo
    // no arquivo é só o valor de partida, substituído na carga.
    for (const match of corpo.matchAll(/<(h1|button|label|span|div|option)\b([^>]*)>([^<]*)</g)) {
      const [, tag, attrs, texto] = match;
      if (!/[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(texto)) continue;
      expect(attrs, `<${tag}> com texto solto: ${texto.trim()}`).toContain('data-i18n');
    }
  });
});
