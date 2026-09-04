#!/usr/bin/env node
/**
 * Renderiza um post de `docs/devlog/builds/` nas duas saidas que ele precisa ter.
 *
 * A fonte e sempre o `.md` escrito a mao. Este script nao edita texto: ele so
 * decide COMO cada destino recebe o mesmo texto, porque os dois destinos tem
 * regras opostas.
 *
 *   NNNN-slug.html        a pagina que se manda para uma pessoa. Imagens
 *                         embutidas, video do YouTube tocando dentro do post,
 *                         CSS proprio. Abre com dois cliques, sem servidor.
 *
 *   NNNN-slug.itch.html   o que se cola no formulario de devlog do itch.io. O
 *                         editor de la e rich text e SANEIA o que chega: <style>,
 *                         <iframe> e atributos de classe nao sobrevivem a
 *                         colagem. Entao esta saida e markup semantico puro, e
 *                         imagem e video viram LINHAS DE MARCACAO que a pessoa
 *                         troca pelos botoes da barra de ferramentas. Um slot
 *                         visivel e melhor que um embed que o editor come em
 *                         silencio.
 *
 * Uso: node scripts/devlog/build-post.mjs docs/devlog/builds/<arquivo>.md
 */

import fs from 'node:fs';
import path from 'node:path';

/** A faixa que toca dentro do post. Trocar aqui muda as duas saidas. */
const VIDEO = {
  id: 'HsP8OoMEuy8',
  url: 'https://youtu.be/HsP8OoMEuy8',
  label: 'LISTEN · the track, by Clevo',
  note: 'Headphones. The mix leaves the centre of the field free so the game can speak through it, and this is what fills the sides.',
};

/**
 * O video entra logo depois DESTA frase, e nao no rodape: o post inteiro
 * argumenta que a trilha muda como o jogo se sente, e pedir para o leitor
 * guardar isso ate o fim seria pedir de graca.
 */
const VIDEO_ANCHOR = 'I have been playing my own build differently ever since.';

/** A hero usa a arte SEM branding: a com branding traz o letreiro assado. */
const HERO_IMAGE = 'media/key-art-clean.webp';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(t) {
  return esc(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Markdown -> blocos. Devolve uma lista de nos em vez de HTML pronto porque as
 * duas saidas discordam justamente em `image` e `video`.
 */
function parse(md) {
  const lines = md.split('\n');
  const nodes = [];
  let para = [];
  let bullets = [];
  const flushP = () => { if (para.length) { nodes.push({ t: 'p', text: para.join(' ') }); para = []; } };
  const flushB = () => { if (bullets.length) { nodes.push({ t: 'ul', items: bullets }); bullets = []; } };

  for (let i = 0; i < lines.length; ) {
    const s = lines[i].trim();

    const img = s.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) { flushP(); flushB(); nodes.push({ t: 'img', alt: img[1], src: img[2] }); i++; continue; }

    if (s.startsWith('# ')) { flushP(); flushB(); nodes.push({ t: 'h1', text: s.slice(2) }); i++; continue; }
    if (s.startsWith('## ')) { flushP(); flushB(); nodes.push({ t: 'h2', text: s.slice(3) }); i++; continue; }
    if (/^\*\*\d{4}-\d{2}-\d{2}\*\*/.test(s)) { flushP(); flushB(); nodes.push({ t: 'meta', text: s }); i++; continue; }

    if (/^[-*] /.test(s)) {
      flushP();
      let item = s.slice(2); i++;
      while (i < lines.length && lines[i].startsWith('  ') && lines[i].trim() && !/^[-*] /.test(lines[i].trim())) {
        item += ' ' + lines[i].trim(); i++;
      }
      bullets.push(item); continue;
    }

    if (/^\d+\. /.test(s)) {
      flushP(); flushB();
      const items = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        if (/^\d+\. /.test(t)) {
          let item = t.replace(/^\d+\. /, ''); i++;
          while (i < lines.length && lines[i].startsWith('   ') && lines[i].trim()) { item += ' ' + lines[i].trim(); i++; }
          items.push(item);
        } else if (t === '') {
          i++;
          if (i < lines.length && !/^\d+\. /.test(lines[i].trim())) break;
        } else break;
      }
      nodes.push({ t: 'ol', items }); continue;
    }

    if (s === '') { flushP(); flushB(); i++; continue; }

    para.push(s); i++;
  }
  flushP(); flushB();

  // O video entra como no proprio, logo depois do paragrafo que apresenta o Clevo.
  const at = nodes.findIndex((n) => n.t === 'p' && n.text.includes(VIDEO_ANCHOR));
  if (at === -1) throw new Error(`ancora do video nao encontrada: "${VIDEO_ANCHOR}"`);
  nodes.splice(at + 1, 0, { t: 'video' });

  return nodes;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ------------------------------------------------------------------ pagina */

function renderPage(nodes) {
  const title = nodes.find((n) => n.t === 'h1').text;
  const meta = nodes.find((n) => n.t === 'meta');
  const hero = nodes.find((n) => n.t === 'img');
  const out = [];

  for (const n of nodes) {
    if (n === hero || n.t === 'h1' || n.t === 'meta') continue;
    switch (n.t) {
      case 'h2': out.push(`<h2 id="${slug(n.text)}">${inline(n.text)}</h2>`); break;
      case 'p': out.push(`<p>${inline(n.text)}</p>`); break;
      case 'ul': out.push('<ul>' + n.items.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>'); break;
      case 'ol': out.push('<ol class="playlist">' + n.items.map((b) => `<li>${inline(b)}</li>`).join('') + '</ol>'); break;
      case 'img':
        out.push(
          `<figure>\n  <a href="${n.src}" target="_blank" rel="noopener">` +
          `<img src="${n.src}" alt="${esc(n.alt)}" loading="lazy"></a>\n` +
          `  <figcaption>${inline(n.alt)}</figcaption>\n</figure>`);
        break;
      case 'video':
        out.push(`<aside class="player">
  <div class="player-label"><span class="dot"></span>${esc(VIDEO.label)}</div>
  <div class="player-frame">
    <iframe src="https://www.youtube-nocookie.com/embed/${VIDEO.id}"
            title="Voxelyn Survival soundtrack by Clevo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen loading="lazy"></iframe>
  </div>
  <p class="player-note">${esc(VIDEO.note)}
  <a href="${VIDEO.url}" target="_blank" rel="noopener">Open on YouTube</a> &middot;
  <a href="https://instagram.com/clevoclevoclevo" target="_blank" rel="noopener">@clevoclevoclevo</a></p>
</aside>`);
        break;
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} &middot; Voxelyn Survival devlog</title>
<meta name="description" content="Voxelyn Survival build notes. A composed soundtrack by Clevo, an ice sheet that remembers where you walked, and a boss that swallows the room.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=VT323&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
  :root {
    --void: #08090b; --panel: #0e1013; --line: #1d2228;
    --bone: #d9d4c7; --dim: #8b8f95; --phosphor: #5fe3c0; --amber: #d8a13a;
    --measure: 45rem;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0; background: var(--void); color: var(--bone);
    font-family: "IBM Plex Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    font-size: 1.0625rem; line-height: 1.72; -webkit-font-smoothing: antialiased;
  }
  a { color: var(--phosphor); text-decoration: none; border-bottom: 1px solid rgba(95,227,192,.35); }
  a:hover { border-bottom-color: var(--phosphor); }

  .hero { position: relative; border-bottom: 1px solid var(--line); }
  .hero img { display: block; width: 100%; height: clamp(260px, 56vh, 640px); object-fit: cover; object-position: center 42%; }
  .hero::after { content: ""; position: absolute; inset: 0;
    background: linear-gradient(to bottom, rgba(8,9,11,.15) 0%, rgba(8,9,11,.55) 55%, var(--void) 100%); }
  .hero-copy { position: absolute; z-index: 2; left: 0; right: 0; bottom: 0; padding: 0 1.25rem 2.5rem; }
  .hero-inner { max-width: var(--measure); margin: 0 auto; }
  .kicker { font-family: "Chakra Petch", sans-serif; font-weight: 700; letter-spacing: .22em;
    text-transform: uppercase; font-size: .72rem; color: var(--amber); margin: 0 0 .75rem; }
  h1 { font-family: "Chakra Petch", sans-serif; font-weight: 700; line-height: 1.08;
    font-size: clamp(1.9rem, 5.2vw, 3.1rem); margin: 0 0 .9rem; letter-spacing: -.01em;
    text-shadow: 0 2px 24px rgba(8,9,11,.9); }
  .meta { font-family: "VT323", monospace; font-size: 1.2rem; letter-spacing: .06em; color: var(--dim); margin: 0; }
  .meta strong { color: var(--bone); font-weight: 400; }

  main { max-width: var(--measure); margin: 0 auto; padding: 3rem 1.25rem 5rem; }
  main > p:first-of-type::first-letter {
    font-family: "Chakra Petch", sans-serif; font-weight: 700; font-size: 3.4rem;
    float: left; line-height: .82; padding: .1em .14em 0 0; color: var(--phosphor); }
  h2 { font-family: "Chakra Petch", sans-serif; font-weight: 700;
    font-size: clamp(1.35rem, 3.4vw, 1.75rem); line-height: 1.22;
    margin: 3.4rem 0 1.1rem; padding-top: 1.6rem; border-top: 1px solid var(--line); }
  h2::before { content: ""; display: block; width: 34px; height: 2px; background: var(--amber); margin-bottom: 1rem; }
  p { margin: 0 0 1.25rem; }
  strong { color: #fff; font-weight: 600; }
  em { color: var(--phosphor); font-style: italic; }
  code { font-family: "VT323", monospace; font-size: 1.05em; color: var(--amber);
    background: rgba(216,161,58,.08); padding: 0 .3em; border-radius: 2px; }
  ul, ol { margin: 0 0 1.4rem; padding-left: 1.3rem; }
  li { margin-bottom: .7rem; }
  ul li::marker { color: var(--amber); }
  ol.playlist { counter-reset: step; list-style: none; padding-left: 0; }
  ol.playlist li { counter-increment: step; position: relative; padding-left: 3.1rem; margin-bottom: 1rem; }
  ol.playlist li::before { content: counter(step, decimal-leading-zero);
    position: absolute; left: 0; top: .05em; font-family: "VT323", monospace; font-size: 1.35rem;
    color: var(--phosphor); border: 1px solid rgba(95,227,192,.3); border-radius: 3px;
    padding: 0 .35em; line-height: 1.35; }

  figure { margin: 2.4rem 0; }
  figure a { border: 0; display: block; }
  figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line);
    border-radius: 3px; background: #000; }
  figcaption { font-family: "VT323", monospace; font-size: 1.05rem; letter-spacing: .04em;
    color: var(--dim); margin-top: .7rem; padding-left: .9rem;
    border-left: 2px solid var(--amber); line-height: 1.5; }
  @media (min-width: 62rem) { figure { width: calc(100% + 7rem); margin-left: -3.5rem; } }

  .player { margin: 2.4rem 0; padding: 1.1rem 1.1rem 1rem; background: var(--panel);
    border: 1px solid rgba(95,227,192,.28); border-radius: 4px;
    box-shadow: 0 0 0 1px rgba(95,227,192,.06), 0 18px 48px -28px rgba(95,227,192,.35); }
  .player-label { font-family: "Chakra Petch", sans-serif; font-weight: 700; font-size: .74rem;
    letter-spacing: .2em; text-transform: uppercase; color: var(--phosphor);
    display: flex; align-items: center; gap: .55rem; margin-bottom: .85rem; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--phosphor);
    box-shadow: 0 0 8px var(--phosphor); animation: pulse 2.2s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
  .player-frame { position: relative; padding-top: 56.25%; background: #000; border-radius: 3px; overflow: hidden; }
  .player-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .player-note { margin: .9rem 0 0; font-size: .95rem; color: var(--dim); line-height: 1.6; }

  footer { border-top: 1px solid var(--line); background: var(--panel); padding: 2.6rem 1.25rem 3.4rem; }
  .foot-inner { max-width: var(--measure); margin: 0 auto; }
  .credits { font-family: "Chakra Petch", sans-serif; letter-spacing: .12em; text-transform: uppercase;
    font-size: .78rem; color: var(--dim); line-height: 2.1; }
  .credits b { color: var(--bone); font-weight: 600; letter-spacing: .1em; }
  .stamp { font-family: "VT323", monospace; font-size: 1.15rem; color: var(--amber);
    letter-spacing: .3em; margin-top: 1.4rem; }
  @media (max-width: 40rem) { body { font-size: 1rem; } main { padding-top: 2.2rem; } }
</style>
</head>
<body>

<header class="hero">
  <img src="${HERO_IMAGE}" alt="${esc(hero.alt)}" fetchpriority="high">
  <div class="hero-copy"><div class="hero-inner">
    <p class="kicker">Voxelyn Survival &middot; build notes</p>
    <h1>${esc(title)}</h1>
    <p class="meta">${inline(meta.text)}</p>
  </div></div>
</header>

<main>
${out.join('\n')}
</main>

<footer><div class="foot-inner">
  <p class="credits">
    Music by <b>Clevo</b> &middot; <a href="https://instagram.com/clevoclevoclevo" target="_blank" rel="noopener">@clevoclevoclevo</a><br>
    Game by <b>DaniTools</b> &middot; <a href="https://instagram.com/dani.tools" target="_blank" rel="noopener">@dani.tools</a><br>
    Fonts Chakra Petch and VT323 under SIL OFL 1.1
  </p>
  <p class="stamp">EXTRACT. PROTECT. ADAPT.</p>
</div></footer>

</body>
</html>
`;
}

/* -------------------------------------------------------------------- itch */

function renderItch(nodes) {
  const title = nodes.find((n) => n.t === 'h1').text;
  const images = [];
  const out = [];

  for (const n of nodes) {
    switch (n.t) {
      // O titulo e a data ja sao campos do formulario do itch. Repetir dentro
      // do corpo poe o titulo duas vezes na pagina publicada.
      case 'h1': case 'meta': break;
      case 'h2': out.push(`<h2>${inline(n.text)}</h2>`); break;
      case 'p': out.push(`<p>${inline(n.text)}</p>`); break;
      case 'ul': out.push('<ul>\n' + n.items.map((b) => `  <li>${inline(b)}</li>`).join('\n') + '\n</ul>'); break;
      case 'ol': out.push('<ol>\n' + n.items.map((b) => `  <li>${inline(b)}</li>`).join('\n') + '\n</ol>'); break;
      case 'img': {
        images.push(n);
        out.push(`<p class="slot">[ IMAGE ${images.length} &nbsp;&middot;&nbsp; ${esc(n.src.split('/').pop())} &nbsp;&middot;&nbsp; ${esc(n.alt)} ]</p>`);
        break;
      }
      case 'video':
        out.push(`<p class="slot">[ VIDEO &nbsp;&middot;&nbsp; ${VIDEO.url} &nbsp;&middot;&nbsp; delete this line and paste that URL on a line of its own, itch turns it into a player ]</p>`);
        break;
    }
  }

  const list = images.map((n, i) => `  ${String(i + 1).padStart(2, '0')}. ${n.src.split('/').pop()}`).join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>${esc(title)} &middot; for the itch.io devlog form</title>
<!--
  HOW TO PUBLISH THIS ON ITCH.IO

  1. Open this file in a browser.
  2. Ctrl+A, Ctrl+C.
  3. Paste into the Content field of the itch devlog form. The editor there is
     rich text and does not read Markdown, so pasting rendered HTML is what
     keeps the headings, the bold and the lists.
  4. Every red [ IMAGE n ] line is a placeholder. Delete the line and put the
     image in its place with the toolbar image button, in this order:

${list}

  5. The red [ VIDEO ] line is the soundtrack. Delete it and paste
     ${VIDEO.url} on a line of its own. itch turns a bare
     YouTube URL into a player by itself.

  Title for the form:  ${title}

  Nothing in here carries styling on purpose. itch strips <style>, <iframe> and
  class attributes out of a paste, so an embed pasted from here would vanish
  without saying so. A visible placeholder beats a silent deletion.
-->
<style>
  /* Only for reading this file before the copy. None of it survives the paste. */
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
         max-width: 44em; margin: 3em auto; padding: 0 1.2em; line-height: 1.65; color: #111; }
  h2 { margin-top: 2.2em; }
  .slot { border: 1px dashed #b00; color: #b00; padding: .55em .8em; font-weight: 700; }
</style>

${out.join('\n')}
`;
}

/* -------------------------------------------------------------------- main */

const input = process.argv[2];
if (!input) {
  console.error('uso: node scripts/devlog/build-post.mjs docs/devlog/builds/<arquivo>.md');
  process.exit(1);
}

const md = fs.readFileSync(input, 'utf8');
const nodes = parse(md);
const base = input.replace(/\.md$/, '');

fs.writeFileSync(`${base}.html`, renderPage(nodes));
fs.writeFileSync(`${base}.itch.html`, renderItch(nodes));

const imgs = nodes.filter((n) => n.t === 'img').length;
console.log(`${path.basename(base)}.html`);
console.log(`${path.basename(base)}.itch.html   (${imgs} image slots + 1 video slot)`);
