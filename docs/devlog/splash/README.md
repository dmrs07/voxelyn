# Splashes dos devlogs

A imagem de topo de um post do itch.io. Cada uma e um HTML aqui, renderizado
para `../media/NNN-splash.png` em 1200x630 — a medida que serve ao mesmo tempo
de imagem de topo do post e de preview quando o link e compartilhado.

**Por que HTML e nao um arquivo de imagem no repositorio:** a splash usa a
paleta de `render.ts` e as fontes de `packages/voxelyn-survival/src/assets/fonts`
— as MESMAS do jogo, e nao um par parecido. Guardando a fonte do desenho, uma
troca de paleta se propaga rerrenderizando, e ninguem precisa caçar o arquivo
original num editor que talvez nao exista mais.

## Rerrenderizar

O Playwright do repositorio pode estar numa versao mais nova que o Chromium
instalado na imagem, entao aponte o executavel em vez de baixar outro:

```js
// shoot.mjs, na raiz do repo (node resolve node_modules a partir dali)
import { chromium } from 'playwright';
const [,, src, out, w, h] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + src);
await p.waitForLoadState('networkidle');
await p.evaluate(() => document.fonts.ready);   // sem isto a fonte sai fallback
await p.screenshot({ path: out });
await b.close();
```

```
node shoot.mjs $PWD/docs/devlog/splash/113-splash.html $PWD/docs/devlog/media/113-splash.png 1200 630
```

As `@font-face` usam caminho ABSOLUTO `file:///home/user/voxelyn/...`. Se o
repositorio viver em outro lugar, ajuste as tres linhas do topo do HTML — e o
unico ponto que nao e portatil, e falha de forma silenciosa (cai no fallback)
em vez de dar erro.
