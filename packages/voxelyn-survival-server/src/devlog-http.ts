// O serviço do devlog: vitrine pública e console de operação.
//
// Três áreas, duas posturas de acesso:
//
//   /devlog                 público  — as entradas já publicadas
//   /devlog/e/<id>          público  — o post, com as imagens da época
//   /devlog/a/<caminho>     público  — asset, SÓ de entrada publicada
//   /devlog/console         token    — a próxima entrada a postar, pronta
//   /devlog/panel           token    — os digests de telemetria do jogo
//
// A separação não é decorativa. O pipeline gera 107 entradas de uma vez, e o
// carrossel do dia 40 existe em disco desde hoje; servir `docs/devlog` inteiro
// publicamente entregaria a fila toda antes da hora. Por isso o acesso público
// a asset é derivado do STATUS no plano, não do que existe no disco.
//
// O painel NÃO coleta nada. Ele lê os digests que `/telemetry` e
// `/arena-telemetry` já produzem — os mesmos números, pela mesma função pura,
// só que desenhados. Nenhum evento novo, nenhum identificador novo, nenhum
// cookie: a disciplina de `telemetry.ts` continua valendo porque este arquivo
// não tem como quebrá-la.

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { ArenaTelemetryDigest, ArenaTelemetryStore } from './arena-telemetry.js';
import type { DevlogEntry, DevlogSocial, DevlogStore } from './devlog.js';
import { canonicalRelative, isEntryId } from './devlog.js';
import { SubmissionRateLimiter, requestRateLimitKey,
  operatorTokenMatches,
} from './http-util.js';
import type { TelemetryDigest, TelemetryStore } from './telemetry.js';

/** Linhas lidas para montar o digest do painel. */
const PANEL_DIGEST_ROWS = 5_000;

/**
 * Teto por origem nas rotas com token.
 *
 * Não é sobre carga — é sobre adivinhação. Sem limite, o token é atacável por
 * força bruta na velocidade da rede; com ele, uma origem consegue algumas
 * dezenas de tentativas por minuto e o custo do ataque deixa de ser trivial.
 */
const OPERATOR_WINDOW_MS = 60_000;
const OPERATOR_MAX_PER_WINDOW = 30;

export type DevlogHttpOptions = {
  store: DevlogStore;
  log: (line: Record<string, unknown>) => void;
  trustedProxyHops?: number;
  /**
   * Token do console e do painel. Sem ele, as duas rotas ficam FECHADAS.
   *
   * Mesma política de `telemetry-http.ts`, e mesma sensibilidade: quem tem este
   * token lê o funil de setor e a taxa de abandono. É credencial de operador,
   * não de leitor.
   */
  operatorToken?: string;
  /** Digests do jogo. Ausentes enquanto o banco não conecta — o painel avisa. */
  telemetry?: () => TelemetryStore | null;
  arenaTelemetry?: () => ArenaTelemetryStore | null;
};

/* -------------------------------------------------------------------------- */
/* HTML                                                                        */
/* -------------------------------------------------------------------------- */

const escapeHtml = (text: unknown): string =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

/**
 * Markdown do subconjunto que os posts do devlog realmente usam.
 *
 * Escrever isto à mão em vez de trazer uma dependência é a escolha barata aqui:
 * o pacote inteiro não tem dependência de renderização, os arquivos de entrada
 * são gerados por um pipeline que este mesmo repositório controla, e o
 * subconjunto é pequeno — títulos, parágrafos, listas, ênfase, código, imagem,
 * link e régua.
 *
 * TUDO é escapado ANTES de qualquer formatação. O texto vem do repositório e
 * não de um usuário, mas uma página pública que injeta HTML de um arquivo é uma
 * porta que não precisa existir.
 */
export const renderMarkdown = (markdown: string, rewriteAsset: (src: string) => string): string => {
  const inline = (raw: string): string =>
    escapeHtml(raw)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
        const href = rewriteAsset(src);
        return href ? `<img src="${escapeHtml(href)}" alt="${alt}" loading="lazy">` : '';
      })
      .replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        (_m, text: string, href: string) =>
          `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${text}</a>`,
      )
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<![\w*])[_*]([^_*\n]+)[_*](?![\w*])/g, '<em>$1</em>');

  const out: string[] = [];
  let list: string[] | null = null;
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (!paragraph.length) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushList = (): void => {
    if (!list) return;
    out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
  };
  const flush = (): void => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      out.push('<hr>');
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      (list ??= []).push(bullet[1]);
      continue;
    }
    // Continuação indentada de um item: pertence ao item anterior, não é
    // parágrafo novo. Sem isto, uma lista com quebra vira lista + texto solto.
    if (list && /^\s{2,}\S/.test(rawLine)) {
      list[list.length - 1] += ` ${line.trim()}`;
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flush();
  return out.join('\n');
};

/** Paleta Aurix — a mesma do jogo e do carrossel. */
const CSS = `
  :root{--void:#0a0a0b;--sheet:#100f0d;--plate:#141311;--brass:#4a3a1e;
    --teal:#4fd6c9;--teal-dim:#2f7d75;--gold:#c9a35a;--text:#cfc6b4;
    --bright:#e2d9c6;--mute:#9a9184;--red:#c0392b}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:var(--void);color:var(--text);
    font-family:ui-monospace,'DejaVu Sans Mono',SFMono-Regular,Menlo,monospace;
    font-size:15px;line-height:1.6;padding:0 0 96px}
  a{color:var(--teal)}
  a:hover{color:var(--bright)}
  header{border-bottom:2px solid var(--brass);padding:26px 0;margin-bottom:36px;
    background:linear-gradient(180deg,var(--sheet),transparent)}
  .wrap{max-width:920px;margin:0 auto;padding:0 22px}
  .mark{color:var(--gold);letter-spacing:.18em;text-transform:uppercase;font-size:13px}
  .rail{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap;font-size:13px;
    letter-spacing:.1em;text-transform:uppercase}
  h1{font-size:30px;line-height:1.2;color:var(--bright);margin:14px 0;font-weight:700}
  h2{font-size:22px;color:var(--bright);margin:34px 0 12px;font-weight:700}
  h3{font-size:17px;color:var(--gold);margin:26px 0 10px;letter-spacing:.06em}
  p{margin:14px 0}
  ul{margin:14px 0 14px 22px}
  li{margin:7px 0}
  hr{border:0;border-top:1px solid var(--brass);margin:30px 0}
  code{background:var(--plate);padding:1px 6px;color:var(--teal);font-size:.92em}
  img{max-width:100%;height:auto;display:block;image-rendering:pixelated;
    border:1px solid var(--brass);margin:20px 0}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}
  .card{background:var(--sheet);border:1px solid var(--brass);text-decoration:none;
    color:inherit;display:flex;flex-direction:column}
  .card:hover{border-color:var(--teal)}
  .card img{border:0;border-bottom:1px solid var(--brass);margin:0;aspect-ratio:16/10;
    object-fit:cover}
  .card .body{padding:14px 16px 18px}
  .card .t{color:var(--bright);font-size:15px;line-height:1.35;margin-top:6px}
  .meta{color:var(--mute);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
  .empty{border:1px dashed var(--brass);padding:40px;text-align:center;color:var(--mute)}
  .panel{background:var(--sheet);border:1px solid var(--brass);padding:22px;margin:20px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px}
  .stat{background:var(--plate);border:1px solid var(--brass);padding:16px}
  .stat .n{font-size:28px;color:var(--teal);line-height:1.1}
  .stat .l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--mute);
    margin-top:6px}
  table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--brass)}
  th{color:var(--gold);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
  td.num{text-align:right;color:var(--teal)}
  .bar{background:var(--plate);height:8px;position:relative;overflow:hidden}
  .bar>span{display:block;height:100%;background:var(--teal)}
  textarea{width:100%;min-height:190px;background:var(--plate);color:var(--text);
    border:1px solid var(--brass);padding:14px;font:inherit;font-size:13px;resize:vertical}
  button{background:var(--plate);color:var(--teal);border:1px solid var(--teal-dim);
    padding:9px 16px;font:inherit;font-size:13px;cursor:pointer;letter-spacing:.08em}
  button:hover{background:var(--teal);color:var(--void)}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}
  .files{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
  .files a{background:var(--plate);border:1px solid var(--brass);padding:9px 14px;
    text-decoration:none;font-size:13px}
  .warn{border-left:3px solid var(--gold);padding:12px 16px;background:var(--plate);
    color:var(--bright);margin:14px 0}
  .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
  .thumbs img{margin:0}
  .ok{color:var(--teal)}
  .miss{color:var(--red)}
`;

const layout = (
  title: string,
  subtitle: string,
  body: string,
  rail: string[] = [],
): string => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="color-scheme" content="dark">
<style>${CSS}</style></head><body>
<header><div class="wrap">
  <div class="mark">Voxelyn · devlog</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(subtitle)}</div>
  ${rail.length ? `<nav class="rail">${rail.join('')}</nav>` : ''}
</div></header>
<main class="wrap">${body}</main>
</body></html>`;

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

/* -------------------------------------------------------------------------- */
/* Páginas                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Para onde apontar um binário desta entrada.
 *
 * CDN quando há URL, rota local quando não há. A ordem importa: depois do
 * upload o arquivo pode não existir mais em disco, e antes dele a URL não
 * existe — a mesma função cobre as duas fases sem que nada quebre no meio.
 */
const assetHref = (entry: DevlogEntry, relative: string, localPrefix: string): string =>
  entry.cdn?.[relative] ?? `${localPrefix}${relative}`;

const coverOf = (entry: DevlogEntry): string | null => entry.shots?.[0]?.file ?? null;

const renderIndex = (
  entries: DevlogEntry[],
  total: number,
  headlineOf: (id: string) => string | null,
): string => {
  if (!entries.length) {
    return layout(
      'Devlog',
      'nada publicado ainda',
      '<div class="empty">A primeira entrada ainda não saiu.</div>',
    );
  }
  const cards = entries
    .map((e) => {
      const cover = coverOf(e);
      return `<a class="card" href="/devlog/e/${e.id}">
        ${cover ? `<img src="${escapeHtml(assetHref(e, `media/${cover}`, '/devlog/a/'))}" alt="" loading="lazy">` : ''}
        <div class="body">
          <div class="meta">${escapeHtml(e.id)} · ${escapeHtml(e.publishedAt ?? e.publishDate)}</div>
          <div class="t">${escapeHtml(headlineOf(e.id) ?? e.title)}</div>
        </div></a>`;
    })
    .join('');

  return layout(
    'Devlog',
    `${entries.length} de ${total} entradas publicadas`,
    `<p>O trabalho no Voxelyn aconteceu entre janeiro e agosto de 2026. Cada post sai com a
     screenshot gerada construindo o commit daquele dia — não o build de hoje.</p>
     <div class="cards">${cards}</div>`,
  );
};

const renderEntry = (
  entry: DevlogEntry,
  markdown: string | null,
  headline: string | null,
): string => {
  const rewrite = (src: string): string => {
    // Depois do upload, `upload.mjs` reescreve o markdown para a URL do CDN —
    // isso mantém a imagem visível também no GitHub, que não passa por aqui.
    // Só `https:` entra: `javascript:` e `data:` num `src` são exatamente o
    // que uma página pública não deve carregar de um arquivo.
    if (/^https:\/\//i.test(src)) return src;
    // O que sobra é o caminho relativo de antes do upload (`../media/x.png`),
    // servido pela rota local. Qualquer outra coisa é descartada.
    const match = /^\.\.\/(media|carousel)\/(.+)$/.exec(src);
    return match ? `/devlog/a/${match[1]}/${match[2]}` : '';
  };
  // O H1 do markdown vira o cabeçalho da página, então sai do corpo: mantê-lo
  // nos dois lugares imprime o mesmo título duas vezes, uma embaixo da outra.
  const withoutTitle = markdown?.replace(/^#\s+.*$/m, '') ?? null;
  const body = withoutTitle
    ? renderMarkdown(withoutTitle, rewrite)
    : `<div class="empty">O texto desta entrada ainda não foi escrito.</div>`;

  const pr = entry.pr
    ? ` · <a href="https://github.com/dmrs07/voxelyn/pull/${entry.pr}">PR #${entry.pr}</a>`
    : '';

  return layout(
    `${entry.id} — ${headline ?? entry.title}`,
    `publicado em ${entry.publishedAt ?? entry.publishDate} · commit ${entry.tipShort} de ${entry.realDate}`,
    `<nav class="rail"><a href="/devlog">← todas as entradas</a></nav>
     ${body}
     <hr><p class="meta">commit ${escapeHtml(entry.tipShort)}${pr}</p>`,
  );
};

const captionBlock = (slot: string, social: DevlogSocial | null, id: string): string => {
  if (!social?.caption) return `<h3>Legenda</h3><p class="miss">sem copy escrita.</p>`;
  const full = social.tags?.length
    ? `${social.caption}\n\n${social.tags.join(' ')}`
    : social.caption;
  const domId = `cap-${slot}-${escapeHtml(id)}`;
  return `<h3>Legenda</h3>
    <textarea id="${domId}" readonly>${escapeHtml(full)}</textarea>
    <div class="row"><button data-copy="${domId}">copiar legenda</button></div>`;
};

const renderConsole = (
  entry: DevlogEntry | null,
  all: DevlogEntry[],
  post: string | null,
  pt: DevlogSocial | null,
  en: DevlogSocial | null,
  token: string,
): string => {
  const q = `?token=${encodeURIComponent(token)}`;
  const rail = [
    `<a href="/devlog">vitrine pública</a>`,
    `<a href="/devlog/panel${q}">painel de telemetria</a>`,
  ];

  if (!entry) {
    return layout('Console', 'fila vazia', '<div class="empty">Nada pendente.</div>', rail);
  }

  // No console o CDN também vale: baixar de lá poupa a banda do servidor, e
  // depois do prune é o único lugar onde o arquivo existe.
  const file = (path: string, label: string): string => {
    const href = entry.cdn?.[path] ?? `/devlog/console/a/${path}${q}`;
    return `<a href="${escapeHtml(href)}" download>${escapeHtml(label)}</a>`;
  };

  const ptFiles = (entry.carousel ?? []).map((f) => file(`carousel/${f}`, f)).join('');
  const enPack = entry.carousels?.en;
  const enFiles = enPack
    ? [
        file(`carousel/en/${enPack.pdf}`, `${enPack.pdf} (documento do LinkedIn)`),
        ...enPack.files.map((f) => file(`carousel/en/${f}`, f)),
      ].join('')
    : '';

  const thumbs = (entry.carousel ?? [])
    .map(
      (f) =>
        `<img src="${escapeHtml(entry.cdn?.[`carousel/${f}`] ?? `/devlog/console/a/carousel/${f}${q}`)}" alt="" loading="lazy">`,
    )
    .join('');

  const check = (ok: boolean, label: string): string =>
    `<li class="${ok ? 'ok' : 'miss'}">${ok ? '✓' : '✗'} ${escapeHtml(label)}</li>`;

  const queue = all
    .filter((e) => e.status !== 'published' && !e.skipped)
    .slice(0, 12)
    .map(
      (e) =>
        `<tr><td>${e.id}</td><td>${escapeHtml(e.publishDate)}</td><td>${escapeHtml(e.status)}</td>
         <td>${escapeHtml(e.title)}</td></tr>`,
    )
    .join('');

  return layout(
    `Próxima: ${entry.id}`,
    `${entry.title} · alvo ${entry.publishDate}`,
    `<div class="panel">
       <h2>Prontidão</h2>
       <ul>
         ${check((entry.shots?.length ?? 0) > 0, `screenshot (${entry.shots?.length ?? 0})`)}
         ${check(post !== null, 'texto do post')}
         ${check(pt !== null, 'copy em português')}
         ${check(en !== null, 'copy em inglês')}
         ${check((entry.carousel?.length ?? 0) > 0, 'carrossel do Instagram')}
         ${check(Boolean(enPack), 'PDF do LinkedIn')}
       </ul>
     </div>

     <h2>Instagram</h2>
     ${ptFiles ? `<div class="files">${ptFiles}</div>` : '<p class="miss">carrossel não gerado.</p>'}
     ${thumbs ? `<div class="thumbs">${thumbs}</div>` : ''}
     ${captionBlock('ig', pt, entry.id)}

     <h2>LinkedIn</h2>
     ${enFiles ? `<div class="files">${enFiles}</div>` : '<p class="miss">versão em inglês não gerada.</p>'}
     ${captionBlock('li', en, entry.id)}

     <h2>Fila</h2>
     <table><tr><th>#</th><th>alvo</th><th>estado</th><th>título</th></tr>${queue}</table>

     <script>
       document.addEventListener('click', function (ev) {
         var id = ev.target.getAttribute && ev.target.getAttribute('data-copy');
         if (!id) return;
         var field = document.getElementById(id);
         field.select();
         navigator.clipboard.writeText(field.value).then(function () {
           var was = ev.target.textContent;
           ev.target.textContent = 'copiado';
           setTimeout(function () { ev.target.textContent = was; }, 1400);
         });
       });
     </script>`,
    rail,
  );
};

const renderPanel = (
  campaign: TelemetryDigest | null,
  arena: ArenaTelemetryDigest | null,
  token: string,
): string => {
  const rail = [
    `<a href="/devlog">vitrine pública</a>`,
    `<a href="/devlog/console?token=${encodeURIComponent(token)}">console</a>`,
  ];

  const campaignHtml = !campaign
    ? '<div class="warn">Telemetria de campanha indisponível — o banco ainda não conectou.</div>'
    : `<div class="grid">
         <div class="stat"><div class="n">${campaign.runs}</div><div class="l">runs</div></div>
         <div class="stat"><div class="n">${campaign.sessions}</div><div class="l">sessões</div></div>
         <div class="stat"><div class="n">${pct(campaign.abandonRate)}</div><div class="l">abandono</div></div>
         <div class="stat"><div class="n">${pct(campaign.immediateRestartRate)}</div><div class="l">recomeço imediato</div></div>
         <div class="stat"><div class="n">${campaign.runsPerSession.toFixed(2)}</div><div class="l">runs por sessão</div></div>
       </div>

       <h3>Funil de setor</h3>
       <table><tr><th>setor</th><th>alcançou</th><th></th></tr>
       ${campaign.sectorReach
         .map(
           (reach, i) =>
             `<tr><td>${i + 1}</td><td class="num">${pct(reach)}</td>
              <td><div class="bar"><span style="width:${(reach * 100).toFixed(1)}%"></span></div></td></tr>`,
         )
         .join('')}</table>

       <h3>Estrelas</h3>
       <table><tr><th>estrelas</th><th>runs</th></tr>
       ${campaign.starHistogram
         .map((n, i) => `<tr><td>${i}</td><td class="num">${n}</td></tr>`)
         .join('')}</table>

       <h3>Causas de morte</h3>
       ${
         campaign.deathCauses.length
           ? `<table><tr><th>causa</th><th>runs</th></tr>
             ${campaign.deathCauses
               .map(
                 (d) => `<tr><td>${escapeHtml(d.cause)}</td><td class="num">${d.count}</td></tr>`,
               )
               .join('')}</table>`
           : '<p class="meta">nenhuma morte registrada.</p>'
       }

       <h3>Tempo mediano, em ticks</h3>
       <table><tr><th>desfecho</th><th>ticks</th></tr>
       ${Object.entries(campaign.medianTicks)
         .map(
           ([outcome, ticks]) =>
             `<tr><td>${escapeHtml(outcome)}</td><td class="num">${ticks ?? '—'}</td></tr>`,
         )
         .join('')}</table>`;

  const arenaHtml = !arena
    ? '<div class="warn">Telemetria da Arena indisponível — o banco ainda não conectou.</div>'
    : `<div class="grid">
         <div class="stat"><div class="n">${arena.runs}</div><div class="l">encontros</div></div>
         ${Object.entries(arena.outcomeCounts)
           .map(
             ([outcome, n]) =>
               `<div class="stat"><div class="n">${n}</div><div class="l">${escapeHtml(outcome)}</div></div>`,
           )
           .join('')}
       </div>
       <h3>Por chefe</h3>
       ${
         Object.keys(arena.byBoss).length
           ? `<table>
               <tr><th>chefe</th><th>encontros</th><th>quedas</th><th>ticks até a queda</th><th>HP restante</th></tr>
               ${Object.entries(arena.byBoss)
                 .map(
                   ([boss, d]) =>
                     `<tr><td>${escapeHtml(boss)}</td><td class="num">${d.runs}</td>
                      <td class="num">${d.outcomeCounts.boss_killed}</td>
                      <td class="num">${d.medianTicksToKill ?? '—'}</td>
                      <td class="num">${d.medianHpRemainingOnKill ?? '—'}</td></tr>`,
                 )
                 .join('')}</table>`
           : '<p class="meta">nenhum encontro registrado.</p>'
       }`;

  return layout(
    'Telemetria',
    `digest sobre as últimas ${PANEL_DIGEST_ROWS.toLocaleString('pt-BR')} linhas`,
    `<p class="meta">Leitura do que o servidor já coleta. Esta página não registra nada.</p>
     <h2>Campanha</h2>${campaignHtml}
     <h2>Arena de chefes</h2>${arenaHtml}`,
    rail,
  );
};

/* -------------------------------------------------------------------------- */
/* Handler                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Comparação de token em tempo constante.
 *
 * `!==` sai no primeiro byte diferente, e a diferença de tempo é medível pela
 * rede em número suficiente de tentativas. O comprimento continua vazando —
 * daí a comparação de tamanho antes —, mas o conteúdo não.
 */
const tokenMatches = (expected: string | undefined, given: string | null): boolean => {
  if (!expected || given === null) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

export const createDevlogHandler = (opts: DevlogHttpOptions) => {
  const limiter = new SubmissionRateLimiter({
    windowMs: OPERATOR_WINDOW_MS,
    maxPerWindow: OPERATOR_MAX_PER_WINDOW,
  });

  const html = (res: ServerResponse, status: number, body: string): void => {
    res.writeHead(status, {
      'content-type': 'text/html; charset=utf-8',
      // A vitrine é conteúdo publicado, mas o console mostra material que ainda
      // não saiu. Nenhuma das duas deve ficar num cache intermediário.
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
    res.end(body);
  };

  const notFound = (res: ServerResponse): void =>
    html(res, 404, layout('404', 'nada aqui', '<div class="empty">Não encontrado.</div>'));

  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname.replace(/\/+$/, '') || '/devlog';
    if (path !== '/devlog' && !path.startsWith('/devlog/')) return false;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('metodo nao suportado');
      return true;
    }
    if (!opts.store.available) {
      notFound(res);
      return true;
    }

    const plan = opts.store.plan();
    const published = opts.store.published();

    /* ---- área com token ---------------------------------------------------- */
    const operator =
      path === '/devlog/console' ||
      path === '/devlog/panel' ||
      path.startsWith('/devlog/console/a/');

    if (operator) {
      const origin = requestRateLimitKey(req, opts.trustedProxyHops ?? 0);
      if (limiter.check(origin, Date.now())) {
        res.writeHead(429, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('devagar');
        return true;
      }
      if (!operatorTokenMatches(opts.operatorToken, url, req)) {
        // 404 e não 401: a existência do console é ela própria informação, e a
        // rota de digest do jogo já responde assim. Duas portas, mesma cara.
        notFound(res);
        return true;
      }

      // O valor real do token, para os links da propria pagina. O `+` volta
      // pelo mesmo motivo da checagem, e os renderers ja passam por
      // `encodeURIComponent` — sem isso, cada link do painel derrubaria a
      // sessao do operador no primeiro clique.
      const token = (url.searchParams.get('token') ?? '').replace(/ /g, '+');

      if (path.startsWith('/devlog/console/a/')) {
        const asset = opts.store.asset(decodeURIComponent(path.slice('/devlog/console/a/'.length)));
        if (!asset) {
          notFound(res);
          return true;
        }
        res.writeHead(200, { 'content-type': asset.contentType, 'cache-control': 'no-store' });
        res.end(asset.body);
        return true;
      }

      if (path === '/devlog/panel') {
        const [campaign, arena] = await Promise.all([
          opts
            .telemetry?.()
            ?.digest(PANEL_DIGEST_ROWS)
            .catch(() => null) ?? null,
          opts
            .arenaTelemetry?.()
            ?.digest(PANEL_DIGEST_ROWS)
            .catch(() => null) ?? null,
        ]);
        html(res, 200, renderPanel(campaign, arena, token as string));
        return true;
      }

      const next = plan?.entries.find((e) => e.status !== 'published' && !e.skipped) ?? null;
      html(
        res,
        200,
        renderConsole(
          next,
          plan?.entries ?? [],
          next ? opts.store.post(next.id) : null,
          next ? opts.store.social(next.id) : null,
          next ? opts.store.social(next.id, 'en') : null,
          token as string,
        ),
      );
      return true;
    }

    /* ---- área pública ------------------------------------------------------ */
    if (path === '/devlog') {
      html(
        res,
        200,
        renderIndex(published, plan?.entries.length ?? 0, (id) => opts.store.headline(id)),
      );
      return true;
    }

    if (path.startsWith('/devlog/e/')) {
      const id = path.slice('/devlog/e/'.length);
      const entry = published.find((e) => e.id === id);
      if (!entry) {
        notFound(res);
        return true;
      }
      html(res, 200, renderEntry(entry, opts.store.post(entry.id), opts.store.headline(entry.id)));
      return true;
    }

    if (path.startsWith('/devlog/a/')) {
      // CANONIZA primeiro, decide depois. Autorizar sobre a string crua e ler
      // sobre a normalizada é como o `%2F` conseguia atravessar de uma entrada
      // publicada para uma que ainda não saiu.
      const relative = canonicalRelative(decodeURIComponent(path.slice('/devlog/a/'.length)));
      if (!relative) {
        notFound(res);
        return true;
      }

      // Duas guardas, e as duas precisam passar.
      //
      // A pasta, porque só `media/` e `carousel/` guardam material de exibição
      // — o resto do diretório é insumo do pipeline e não tem rota pública.
      // E o STATUS, nunca o disco: o carrossel da entrada 40 já existe em
      // disco hoje, e servi-lo hoje entregaria a fila cinco semanas antes.
      const folder = /^(media|carousel)\//.test(relative);
      const owner = /(?:^|\/)(\d{3})[-.]/.exec(relative)?.[1];
      if (!folder || !owner || !isEntryId(owner) || !published.some((e) => e.id === owner)) {
        notFound(res);
        return true;
      }
      const asset = opts.store.asset(relative);
      if (!asset) {
        notFound(res);
        return true;
      }
      res.writeHead(200, {
        'content-type': asset.contentType,
        // Entrada publicada é imutável: o pipeline nunca reescreve o passado.
        'cache-control': 'public, max-age=86400',
      });
      res.end(asset.body);
      return true;
    }

    notFound(res);
    return true;
  };
};
