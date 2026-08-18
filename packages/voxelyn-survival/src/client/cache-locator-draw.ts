// O desenho do localizador de cofre: um mostrador de agrimensor no topo-centro.
//
// A matematica mora em cache-locator.ts e e testada sem Canvas; aqui e so
// tinta. O instrumento e um anel achatado com o marcador orbitando — a posicao
// no anel E a direcao de tela — mais a distancia aproximada embaixo e a classe
// do cofre em romano + entalhes. Fosforo cyan para o sinal, ambar Aurix para a
// classe, e nada de minimapa: o aparelho diz "algo valioso NAQUELA direcao",
// nunca o caminho.

import { t } from './i18n';
import {
  bearingToDialPoint,
  formatCacheDistance,
  locatorSignal,
  type LocatorLayout,
  type LocatorTarget,
} from './cache-locator';
import { romanTier } from './salvage-presentation';

// Mesmas cores da art bible usadas pelo PAL privado do render.
const PHOSPHOR = '#59f2c2';
const AMBER = '#ffd166';

const ellipsePoint = (
  layout: LocatorLayout,
  bearingDeg: number,
): { x: number; y: number } => {
  const p = bearingToDialPoint(bearingDeg, layout.rx, layout.ry);
  return { x: layout.cx + p.x, y: layout.cy + p.y };
};

/**
 * Desenha o instrumento. `smoothedBearingDeg` ja vem interpolado pelo menor
 * arco (responsabilidade do render, que tem o relogio entre quadros) — a
 * suavizacao nunca pode inventar um rumo falso, so alcancar o verdadeiro.
 */
export const drawCacheLocator = (
  ctx: CanvasRenderingContext2D,
  layout: LocatorLayout,
  primary: LocatorTarget,
  smoothedBearingDeg: number,
  secondary: readonly LocatorTarget[],
  nowMs: number,
): void => {
  const signal = locatorSignal(primary.distance);
  const baseAlpha =
    signal === 'far' ? 0.5 : signal === 'mid' ? 0.72 : signal === 'near' ? 0.9 : 1;
  // Pulso curto e lento no near; travado (lock) fica ESTAVEL — piscar freneticamente
  // perto do alvo so atrapalharia a interacao com o cofre real.
  const pulse =
    signal === 'near' ? 0.08 * Math.sin(nowMs * 0.006) : 0;

  ctx.save();

  // Fundo discreto: vidro escuro atras do mostrador, sem moldura de minimapa.
  ctx.fillStyle = 'rgba(11,14,20,0.42)';
  ctx.beginPath();
  ctx.ellipse(layout.cx, layout.cy, layout.rx + 6, layout.ry + 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // O anel do instrumento.
  ctx.strokeStyle = `rgba(89,242,194,${0.3 * baseAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(layout.cx, layout.cy, layout.rx, layout.ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Marcas de rumo nos oito pontos principais DA TELA — referencia, nao rosa
  // dos ventos: a camera e fixa e o anel fala em direcao de tela.
  ctx.fillStyle = `rgba(184,169,143,${0.4 * baseAlpha})`;
  for (let i = 0; i < 8; i++) {
    const p = ellipsePoint(layout, i * 45);
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
  }

  // Sinais secundarios: cofres revelados alem do primario, so um traco fraco.
  ctx.fillStyle = `rgba(89,242,194,${0.3 * baseAlpha})`;
  for (const target of secondary.slice(0, 3)) {
    const p = ellipsePoint(layout, target.bearingDeg);
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
  }

  // O marcador primario: losango de salvamento com entalhes de classe.
  const marker = ellipsePoint(layout, smoothedBearingDeg);
  const mx = Math.round(marker.x);
  const my = Math.round(marker.y);
  const r = 5;
  ctx.globalAlpha = Math.min(1, baseAlpha + pulse);
  ctx.fillStyle = PHOSPHOR;
  ctx.beginPath();
  ctx.moveTo(mx, my - r);
  ctx.lineTo(mx + r, my);
  ctx.lineTo(mx, my + r);
  ctx.lineTo(mx - r, my);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(11,14,20,0.85)';
  ctx.fillRect(mx - 1, my - 1, 2, 2);

  // Entalhes de classe sob o losango: 1/2/3 tracos — conta em escala de cinza.
  ctx.fillStyle = AMBER;
  const notches = primary.tier;
  const notchSpan = notches * 3 - 1;
  for (let i = 0; i < notches; i++) {
    ctx.fillRect(mx - Math.floor(notchSpan / 2) + i * 3, my + r + 2, 2, 2);
  }

  // Travado no alvo: colchetes estaveis em volta do marcador.
  if (signal === 'lock') {
    ctx.strokeStyle = PHOSPHOR;
    ctx.lineWidth = 1;
    const b = r + 4;
    ctx.beginPath();
    ctx.moveTo(mx - b, my - b + 3);
    ctx.lineTo(mx - b, my - b);
    ctx.lineTo(mx - b + 3, my - b);
    ctx.moveTo(mx + b - 3, my - b);
    ctx.lineTo(mx + b, my - b);
    ctx.lineTo(mx + b, my - b + 3);
    ctx.moveTo(mx + b, my + b - 3);
    ctx.lineTo(mx + b, my + b);
    ctx.lineTo(mx + b - 3, my + b);
    ctx.moveTo(mx - b + 3, my + b);
    ctx.lineTo(mx - b, my + b);
    ctx.lineTo(mx - b, my + b - 3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Classe em romano + distancia, sob o mostrador. O romano e ambar (a cor de
  // identificacao Aurix) e a distancia e fosforo — duas leituras, uma linha.
  const tierText = romanTier(primary.tier);
  const distanceText = t('hud.locator.distance', {
    distance: formatCacheDistance(primary.distance).replace('m', ''),
  });
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const gap = 4;
  const tierW = ctx.measureText(tierText).width;
  const distW = ctx.measureText(distanceText).width;
  const total = tierW + gap + distW;
  ctx.fillStyle = `rgba(255,209,102,${Math.min(1, 0.75 + 0.25 * baseAlpha)})`;
  ctx.fillText(tierText, Math.round(layout.cx - total / 2 + tierW / 2), layout.distanceY);
  ctx.fillStyle = `rgba(89,242,194,${Math.min(1, 0.6 + 0.4 * baseAlpha)})`;
  ctx.fillText(
    distanceText,
    Math.round(layout.cx - total / 2 + tierW + gap + distW / 2),
    layout.distanceY,
  );
  ctx.textAlign = 'left';
  ctx.restore();
};
