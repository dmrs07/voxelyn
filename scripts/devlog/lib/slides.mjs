import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { mediaDir, repoRoot } from './paths.mjs';

/**
 * O carrossel fala a lingua do jogo, nao a de um template generico.
 *
 * Os tokens abaixo sao os MESMOS do sistema Aurix definidos no index.html do
 * Survival, copiados de proposito em vez de importados: o carrossel precisa
 * renderizar identico daqui a seis semanas, mesmo que o jogo mude de paleta.
 * Um post de devlog e um registro datado — ele nao deve mudar depois de
 * publicado so porque a fonte se moveu.
 */
const AX = {
  void: '#0a0a0b',
  sheet: '#100f0d',
  plate: '#141311',
  brass: '#4a3a1e',
  teal: '#4fd6c9',
  tealDim: '#2f7d75',
  gold: '#c9a35a',
  text: '#cfc6b4',
  textBright: '#e2d9c6',
  textMute: '#9a9184',
};

/** 4:5 — o maior formato de feed do Instagram. */
export const SLIDE = { width: 1080, height: 1350 };

const FONT_DIR = resolve(repoRoot, 'packages/voxelyn-survival/src/assets/fonts');

function dataUri(path, mime) {
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

/**
 * Fontes embutidas em base64.
 *
 * Nao ha rede na renderizacao e o Chromium do ambiente tem meia duzia de
 * fontes; sem embutir, o carrossel sairia em DejaVu e nao pareceria o jogo.
 */
function fontFaces() {
  const faces = [
    ['Chakra Petch', 600, 'chakra-petch-600.woff2'],
    ['Chakra Petch', 700, 'chakra-petch-700.woff2'],
    ['VT323', 400, 'vt323-400.woff2'],
  ];
  return faces
    .filter(([, , file]) => existsSync(resolve(FONT_DIR, file)))
    .map(
      ([family, weight, file]) => `@font-face{font-family:'${family}';font-weight:${weight};
        font-style:normal;font-display:block;
        src:url('${dataUri(resolve(FONT_DIR, file), 'font/woff2')}') format('woff2');}`,
    )
    .join('\n');
}

function shotUri(file) {
  const path = resolve(mediaDir, file);
  if (!existsSync(path)) return null;
  return dataUri(path, 'image/png');
}

function escapeHtml(text) {
  return String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

const css = `
  ${fontFaces()}
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000}
  .slide{
    position:relative;width:${SLIDE.width}px;height:${SLIDE.height}px;overflow:hidden;
    background:${AX.void};color:${AX.text};
    font-family:ui-monospace,'DejaVu Sans Mono',monospace;
    display:flex;flex-direction:column;
  }
  /* O trilho lateral do Aurix: a assinatura visual mais barata que existe. */
  .slide::before{
    content:'';position:absolute;left:0;top:0;bottom:0;width:8px;z-index:3;
    background:linear-gradient(180deg,${AX.teal} 0%,${AX.tealDim} 42%,${AX.brass} 100%);
  }
  .pad{padding:72px 76px 0 84px}
  /* Slide sem arte: o bloco flutua no meio, senao um corpo curto deixa
     dois tercos de vazio embaixo do titulo. */
  .slide.text{justify-content:center}
  .slide.text .pad{padding-bottom:110px}
  .meta{
    font-family:'VT323',ui-monospace,monospace;font-size:34px;letter-spacing:.16em;
    color:${AX.gold};text-transform:uppercase;display:flex;gap:26px;align-items:baseline;
  }
  .meta .dim{color:${AX.textMute}}
  h1{
    font-family:'Chakra Petch','DejaVu Sans',sans-serif;font-weight:700;
    font-size:78px;line-height:1.06;letter-spacing:.01em;color:${AX.textBright};
    margin-top:26px;text-wrap:balance;
  }
  h2{
    font-family:'Chakra Petch','DejaVu Sans',sans-serif;font-weight:700;
    font-size:62px;line-height:1.1;letter-spacing:.01em;color:${AX.textBright};
    margin-top:22px;text-wrap:balance;
  }
  .hook{font-size:34px;line-height:1.5;color:${AX.teal};margin-top:30px;max-width:22em}
  .body{font-size:33px;line-height:1.62;color:${AX.text};margin-top:34px;max-width:24em}
  .rule{height:2px;background:${AX.brass};margin-top:40px}

  /* A arte entra INTEIRA, nunca recortada.
     Recortar para 4:5 comeria o HUD, e o HUD e metade do que um devlog tem a
     mostrar — a barra de vida, o setor, a barra de comandos sao justamente o
     que muda de uma semana para a outra. Melhor sobrar preto em cima e
     embaixo do que publicar um quadro mutilado. */
  .art{flex:1;display:flex;align-items:center;justify-content:center;
    padding:44px 0 150px;min-height:0}
  .art img{width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;
    display:block;border-top:2px solid ${AX.brass};border-bottom:2px solid ${AX.brass}}
  /* Arte com legenda: a imagem divide a altura com a placa de texto, entao
     ela nao pode reservar os 150px do rodape — quem reserva e a placa. */
  .art.inset{padding:28px 76px 0 84px}

  .foot{
    position:absolute;left:84px;right:76px;bottom:52px;display:flex;
    justify-content:space-between;align-items:flex-end;
    font-family:'VT323',ui-monospace,monospace;font-size:30px;letter-spacing:.14em;
    color:${AX.textMute};text-transform:uppercase;z-index:2;
  }
  .foot .brand{color:${AX.gold}}

  .stats{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:52px}
  .stat{background:${AX.sheet};border:2px solid ${AX.brass};padding:34px 36px}
  .stat .n{font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:76px;
    color:${AX.teal};line-height:1}
  .stat .l{font-family:'VT323',monospace;font-size:30px;letter-spacing:.14em;
    color:${AX.textMute};text-transform:uppercase;margin-top:12px}

  .commits{margin-top:40px;display:flex;flex-direction:column;gap:20px}
  .commit{display:flex;gap:22px;align-items:flex-start;font-size:28px;line-height:1.45}
  .commit .sha{font-family:'VT323',monospace;font-size:30px;color:${AX.gold};
    letter-spacing:.08em;flex:none;padding-top:2px}
  .commit .s{color:${AX.text}}

  .caption-plate{background:${AX.plate};border-left:4px solid ${AX.teal};
    padding:30px 34px;margin:28px 76px 128px 84px;font-size:31px;line-height:1.5;
    color:${AX.textBright};flex:none}
`;

function foot(index, total, extra = '') {
  return `<div class="foot"><span class="brand">VOXELYN SURVIVAL</span>
    <span>${escapeHtml(extra)}${extra ? ' · ' : ''}${String(index).padStart(2, '0')}/${String(total).padStart(2, '0')}</span></div>`;
}

/**
 * Monta os slides a partir da entrada do plano e da copy social.
 *
 * A copy manda: se `social` traz slides, sao eles. O fallback derivado dos
 * assuntos de commit existe para que o pipeline seja testavel sem redacao —
 * nao para virar o post publicado.
 */
export function buildSlides(entry, social, opts = {}) {
  const shots = entry.shots ?? [];
  const cover = shotUri(shots[0]?.file ?? '');
  const dateLabel = opts.dateLabel ?? entry.publishDate;
  const slides = [];

  // 1. Capa: a arte manda, o titulo ancora.
  slides.push({
    name: 'capa',
    kind: 'cover',
    html: `<div class="pad">
      <div class="meta"><span>DEVLOG ${entry.id}</span><span class="dim">${escapeHtml(dateLabel)}</span></div>
      <h1>${escapeHtml(social.hook ?? entry.title)}</h1>
    </div>
    <div class="art">${cover ? `<img src="${cover}" alt="">` : ''}</div>`,
  });

  // 2..N. Os slides de conteudo.
  const content = social.slides?.length
    ? social.slides
    : entry.commits.slice(0, 3).map((c) => ({ title: c.subject, body: '' }));

  for (const s of content) {
    const art = s.shot ? shotUri(s.shot) : null;
    slides.push({
      name: s.title?.slice(0, 24) ?? 'slide',
      kind: art ? 'shot' : 'text',
      html: art
        ? `<div class="pad"><h2>${escapeHtml(s.title ?? '')}</h2></div>
           <div class="art inset"><img src="${art}" alt=""></div>
           ${s.body ? `<div class="caption-plate">${escapeHtml(s.body)}</div>` : ''}`
        : `<div class="pad">
             <div class="meta"><span class="dim">${escapeHtml(dateLabel)}</span></div>
             <h2>${escapeHtml(s.title ?? '')}</h2>
             <div class="rule"></div>
             <div class="body">${escapeHtml(s.body ?? '')}</div>
           </div>`,
    });
  }

  // Ultimo: o que o trabalho custou, em numeros do proprio git.
  //
  // Omitido quando o diff e parcial (commit na borda do clone shallow): um
  // slide que anuncia "+121.586 linhas" para um commit que mexeu em seis
  // arquivos desmente o post inteiro.
  if (!entry.stat.partial)
    slides.push({
      name: 'numeros',
      kind: 'stats',
      html: `<div class="pad">
      <div class="meta"><span>O QUE ENTROU</span></div>
      <h2>${entry.pr ? `PR #${entry.pr}` : 'na main'}</h2>
      <div class="stats">
        <div class="stat"><div class="n">${entry.commits.length}</div><div class="l">commits</div></div>
        <div class="stat"><div class="n">${entry.stat.files}</div><div class="l">arquivos</div></div>
        <div class="stat"><div class="n">+${entry.stat.added.toLocaleString('pt-BR')}</div><div class="l">linhas</div></div>
        <div class="stat"><div class="n">-${entry.stat.removed.toLocaleString('pt-BR')}</div><div class="l">linhas</div></div>
      </div>
      <div class="commits">
        ${entry.commits
          .slice(-4)
          .map(
            (c) =>
              `<div class="commit"><span class="sha">${escapeHtml(c.sha)}</span><span class="s">${escapeHtml(c.subject)}</span></div>`,
          )
          .join('')}
      </div>
    </div>`,
    });

  return slides.map((s, i) => ({
    ...s,
    html: `<section class="slide ${s.kind ?? 'text'}" data-slide="${i + 1}">${s.html}${foot(i + 1, slides.length)}</section>`,
  }));
}

export function slidesDocument(slides) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <style>${css}</style></head><body>${slides.map((s) => s.html).join('\n')}</body></html>`;
}
