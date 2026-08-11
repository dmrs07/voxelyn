import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { renderMarkdown } from '../src/devlog-http';
import { createDevlogStore } from '../src/devlog';
import { createWsServer, type WsServerHandle } from '../src/ws';

/**
 * Fixture em disco, e nao o `docs/devlog` do repositorio.
 *
 * O devlog de verdade muda todo dia — a tarefa diaria publica uma entrada nova
 * e reescreve o plano. Um teste ancorado nele passaria a falhar por motivo
 * nenhum, e a asserção que mais importa aqui ("o que NAO foi publicado nao
 * vaza") depende de saber exatamente o que esta publicado.
 */
const TOKEN = 'token-de-teste-longo-o-bastante';
let dir: string;
let handle: WsServerHandle;
let base: string;
let previousDevlogDir: string | undefined;

const entry = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  pr: 42,
  kind: 'pr',
  title: `assunto cru do commit ${id}`,
  slug: `entrada-${id}`,
  tip: `${id}0000000000000000000000000000000000000`,
  tipShort: `${id}abcd`,
  realDate: '2026-01-18',
  publishDate: `2026-08-${id}`,
  areas: [],
  stat: { added: 10, removed: 2, files: 3 },
  commits: [{ sha: 'abc1234', subject: 'um commit' }],
  recipes: ['noita'],
  status,
  skipped: false,
  shots: [{ recipe: 'noita', file: `${id}-noita.png`, label: 'demo' }],
  shotError: null,
  entryFile: null,
  carousel: [`${id}-01.png`],
  publishedAt: status === 'published' ? '2026-08-11' : null,
  ...extra,
});

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'devlog-test-'));
  mkdirSync(join(dir, 'entries'));
  mkdirSync(join(dir, 'social'));
  mkdirSync(join(dir, 'media'));
  mkdirSync(join(dir, 'carousel'));

  writeFileSync(
    join(dir, 'plan.json'),
    JSON.stringify({
      version: 1,
      startDate: '2026-08-11',
      cadence: 'daily',
      entries: [entry('001', 'published'), entry('002', 'shot')],
    }),
  );
  writeFileSync(
    join(dir, 'entries', '001-titulo-do-post.md'),
    '# 001 — O titulo publicado\n\nUm paragrafo com **enfase**.\n\n![arte](../media/001-noita.png)\n',
  );
  writeFileSync(
    join(dir, 'social', '001.json'),
    JSON.stringify({ caption: 'legenda em portugues', tags: ['#gamedev'] }),
  );
  writeFileSync(
    join(dir, 'social', '002.json'),
    JSON.stringify({ caption: 'legenda da proxima', tags: ['#gamedev'] }),
  );
  for (const file of ['001-noita.png', '002-noita.png'])
    writeFileSync(join(dir, 'media', file), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  for (const file of ['001-01.png', '002-01.png'])
    writeFileSync(join(dir, 'carousel', file), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  previousDevlogDir = process.env.DEVLOG_DIR;
  process.env.DEVLOG_DIR = dir;

  const booted = createWsServer({
    port: 0,
    host: '127.0.0.1',
    baseSeed: 4242,
    devlogToken: TOKEN,
  });
  await booted.ready;
  await new Promise<void>((resolve) => {
    if (booted.http.listening) return resolve();
    booted.http.once('listening', () => resolve());
  });
  const addr = booted.http.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  handle = booted;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await handle.close();
  if (previousDevlogDir === undefined) delete process.env.DEVLOG_DIR;
  else process.env.DEVLOG_DIR = previousDevlogDir;
  rmSync(dir, { recursive: true, force: true });
});

describe('vitrine publica', () => {
  it('lista a entrada publicada pelo titulo do POST, nao pelo assunto do commit', async () => {
    const res = await fetch(`${base}/devlog`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('O titulo publicado');
    expect(body).not.toContain('assunto cru do commit 001');
  });

  it('nao revela a entrada que ainda nao foi publicada', async () => {
    const index = await (await fetch(`${base}/devlog`)).text();
    expect(index).not.toContain('002');
    expect((await fetch(`${base}/devlog/e/002`)).status).toBe(404);
  });

  it('serve o post publicado com a arte da epoca', async () => {
    const res = await fetch(`${base}/devlog/e/001`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('/devlog/a/media/001-noita.png');
    expect(body).toContain('<strong>enfase</strong>');
  });

  it('serve asset de entrada publicada', async () => {
    const res = await fetch(`${base}/devlog/a/media/001-noita.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });
});

describe('o que nao esta publicado nao vaza', () => {
  // A razao de o pipeline gerar tudo de uma vez: o carrossel da entrada 40
  // existe em disco hoje e so pode aparecer daqui a cinco semanas.
  it('recusa asset cuja entrada dona ainda nao saiu', async () => {
    expect((await fetch(`${base}/devlog/a/carousel/002-01.png`)).status).toBe(404);
    expect((await fetch(`${base}/devlog/a/media/002-noita.png`)).status).toBe(404);
  });

  it('recusa arquivo cujo tipo nao e servivel, mesmo dentro do diretorio', async () => {
    expect((await fetch(`${base}/devlog/a/plan.json`)).status).toBe(404);
    expect((await fetch(`${base}/devlog/a/social/001.json`)).status).toBe(404);
  });

  it('recusa travessia de caminho', async () => {
    for (const path of [
      '/devlog/a/../../../etc/passwd',
      '/devlog/a/%2e%2e%2f%2e%2e%2fpackage.json',
      '/devlog/a/....//package.json',
    ]) {
      expect((await fetch(`${base}${path}`)).status).toBe(404);
    }
  });
});

describe('area do operador', () => {
  it('fica fechada sem token e com token errado', async () => {
    expect((await fetch(`${base}/devlog/console`)).status).toBe(404);
    expect((await fetch(`${base}/devlog/console?token=errado`)).status).toBe(404);
    expect((await fetch(`${base}/devlog/panel?token=${TOKEN}x`)).status).toBe(404);
  });

  it('mostra a proxima entrada pendente e a legenda dela', async () => {
    const res = await fetch(`${base}/devlog/console?token=${TOKEN}`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('Próxima: 002');
    expect(body).toContain('legenda da proxima');
  });

  it('baixa asset que o publico nao pode ver', async () => {
    const res = await fetch(`${base}/devlog/console/a/carousel/002-01.png?token=${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
  });

  it('renderiza o painel com os digests do jogo', async () => {
    const res = await fetch(`${base}/devlog/panel?token=${TOKEN}`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain('Campanha');
    expect(body).toContain('Arena de chefes');
  });
});

describe('superficie', () => {
  it('so responde a leitura', async () => {
    const res = await fetch(`${base}/devlog`, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('nao intercepta as outras rotas do servidor', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
  });
});

describe('renderMarkdown', () => {
  const rewrite = (src: string): string => src;

  it('escapa HTML antes de formatar', () => {
    const out = renderMarkdown('<script>alert(1)</script>\n', rewrite);
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('nao deixa um link injetar atributo', () => {
    const out = renderMarkdown('[x](" onerror="alert(1))\n', rewrite);
    expect(out).not.toContain('onerror="alert');
  });

  it('junta a continuacao indentada no proprio item da lista', () => {
    const out = renderMarkdown('- primeiro\n  continua aqui\n- segundo\n', rewrite);
    expect(out).toContain('<li>primeiro continua aqui</li>');
    expect(out).toContain('<li>segundo</li>');
    // A continuacao NAO pode virar paragrafo solto depois da lista.
    expect(out).not.toContain('<p>continua aqui</p>');
  });
});

describe('createDevlogStore', () => {
  it('desliga o servico quando o diretorio nao existe', () => {
    const store = createDevlogStore(null);
    expect(store.available).toBe(false);
    expect(store.plan()).toBeNull();
    expect(store.published()).toEqual([]);
  });

  it('recusa id que nao seja de tres digitos', () => {
    const store = createDevlogStore(dir);
    expect(store.entry('1')).toBeNull();
    expect(store.post('../../etc/passwd')).toBeNull();
    expect(store.social('001', '../..')).toBeNull();
  });
});

describe('CDN', () => {
  const rewrite = (src: string): string => (/^https:\/\//i.test(src) ? src : '');

  it('deixa passar https e barra esquema perigoso no src da imagem', () => {
    const ok = renderMarkdown('![a](https://res.cloudinary.com/x/y.png)\n', rewrite);
    expect(ok).toContain('src="https://res.cloudinary.com/x/y.png"');

    const bad = renderMarkdown('![a](javascript:alert(1))\n', rewrite);
    expect(bad).not.toContain('javascript:');
  });

  it('prefere a URL do CDN a rota local quando a entrada tem uma', async () => {
    // O plano do fixture nao tem `cdn`, entao a rota local e o caminho normal.
    // Aqui provamos o outro lado: com `cdn` preenchido, o indice aponta pra la.
    const withCdn = {
      ...entry('001', 'published'),
      cdn: { 'media/001-noita.png': 'https://res.cloudinary.com/demo/voxelyn.png' },
    };
    writeFileSync(
      join(dir, 'plan.json'),
      JSON.stringify({
        version: 1,
        startDate: '2026-08-11',
        cadence: 'daily',
        entries: [withCdn, entry('002', 'shot')],
      }),
    );
    const body = await (await fetch(`${base}/devlog`)).text();
    expect(body).toContain('https://res.cloudinary.com/demo/voxelyn.png');
    expect(body).not.toContain('/devlog/a/media/001-noita.png');
  });
});
