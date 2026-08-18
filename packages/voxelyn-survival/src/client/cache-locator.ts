// O localizador de cofre: matematica pura do instrumento de bearing 360°.
//
// A camera do jogo e isometrica e FIXA — nao existe "frente do jogador" para
// ancorar uma fita de bussola. O instrumento e, portanto, um ANEL: o marcador
// orbita uma elipse achatada (o anel visto de traves), e a posicao dele no anel
// e literalmente a direcao em que o jogador deve andar NA TELA. Direita no anel
// = direita na tela. Isso elimina a descontinuidade classica de fita (359°→0°
// atravessando a tela): seno e cosseno sao continuos na volta inteira.
//
// Tudo aqui e puro e testavel sem Canvas. O desenho mora em
// cache-locator-draw.ts; o render so cola os dois.

import type { SalvageSite } from '@voxelyn/survival-sim';

/** Espelham TILE_W/TILE_H do render (32×16). Parametros para os testes poderem
 *  cobrar a projecao sem importar o renderizador inteiro. */
const ISO_TILE_W = 32;
const ISO_TILE_H = 16;

/** Normaliza para [0, 360). */
export const wrapDeg = (deg: number): number => {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
};

/** Menor arco de `from` ate `to`, em (-180, 180]. */
export const shortestDeltaDeg = (from: number, to: number): number => {
  const delta = wrapDeg(to - from);
  return delta > 180 ? delta - 360 : delta;
};

/**
 * Interpola bearing pelo MENOR arco. `lerp` ingenuo entre 359° e 1° passaria
 * por 180° — o marcador daria meia-volta no anel para andar dois graus.
 */
export const lerpBearingDeg = (from: number, to: number, t: number): number =>
  wrapDeg(from + shortestDeltaDeg(from, to) * Math.max(0, Math.min(1, t)));

/**
 * O bearing NA TELA de um deslocamento de mundo, em graus [0, 360).
 * 0° = cima da tela, 90° = direita, sentido horario.
 *
 * Passa pela projecao isometrica de proposito: o +x do mundo aparece na tela
 * como diagonal inferior-direita, e um marcador que ignorasse isso apontaria
 * para onde a GRADE acha que o cofre esta, nao para onde o jogador precisa
 * andar. O que o instrumento promete e direcao de tela.
 */
export const screenBearingDeg = (
  worldDx: number,
  worldDy: number,
  tileW = ISO_TILE_W,
  tileH = ISO_TILE_H,
): number => {
  const screenX = (worldDx - worldDy) * (tileW / 2);
  const screenY = (worldDx + worldDy) * (tileH / 2);
  if (screenX === 0 && screenY === 0) return 0;
  return wrapDeg((Math.atan2(screenX, -screenY) * 180) / Math.PI);
};

/** Ponto no anel (relativo ao centro) para um bearing. `ry < rx` achata o anel. */
export const bearingToDialPoint = (
  bearingDeg: number,
  rx: number,
  ry: number,
): { x: number; y: number } => {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: Math.sin(rad) * rx, y: -Math.cos(rad) * ry };
};

/**
 * Distancia aproximada em metros inteiros — mesma filosofia do HUD antigo:
 * "~10m" orienta, "12.37m" finge uma precisao que o instrumento nao tem.
 */
export const approxDistanceM = (worldDx: number, worldDy: number): number =>
  Math.round(Math.hypot(worldDx, worldDy));

export const formatCacheDistance = (distance: number): string =>
  `${Math.max(0, Math.round(distance))}m`;

/** Forca do sinal por distancia: so muda brilho/travamento, nunca o bearing. */
export type LocatorSignal = 'far' | 'mid' | 'near' | 'lock';

export const locatorSignal = (distance: number): LocatorSignal => {
  if (distance <= 2.5) return 'lock';
  if (distance <= 7) return 'near';
  if (distance <= 16) return 'mid';
  return 'far';
};

export type LocatorTarget = {
  siteId: number;
  tier: 1 | 2 | 3;
  bearingDeg: number;
  distance: number;
};

/**
 * Alvos do localizador: cofres REVELADOS e ainda fechados, do mais perto para
 * o mais longe. O primeiro e o alvo primario — regra deterministica, sem
 * selecao manual de waypoint. Abrir o cofre o remove da lista no mesmo quadro,
 * o que promove o proximo sozinho.
 */
export const locatorTargets = (
  sites: readonly SalvageSite[],
  playerX: number,
  playerY: number,
): LocatorTarget[] =>
  sites
    .filter((site) => site.cacheRevealed && !site.cacheOpened)
    .map((site) => {
      const dx = site.cache.x + 0.5 - playerX;
      const dy = site.cache.y + 0.5 - playerY;
      return {
        siteId: site.id,
        tier: site.tier,
        bearingDeg: screenBearingDeg(dx, dy),
        distance: Math.hypot(dx, dy),
      };
    })
    .sort((a, b) => a.distance - b.distance);

export type LocatorLayout = {
  /** Centro do anel. */
  cx: number;
  cy: number;
  /** Semieixos da elipse do anel (achatada: o anel visto quase de traves). */
  rx: number;
  ry: number;
  /** Linha de base do texto de distancia, abaixo do anel. */
  distanceY: number;
  /** Retangulo total ocupado, para os testes de area segura. */
  bounds: { x: number; y: number; w: number; h: number };
};

/**
 * O instrumento fica no topo-centro: longe dos joysticks, dos botoes de acao e
 * do bloco de status do topo-esquerda. Compacto de proposito — e um mostrador
 * de agrimensor, nao um minimapa.
 */
export const cacheLocatorLayout = (
  viewportWidth: number,
  viewportHeight: number,
  safe: { top: number; right: number; bottom: number; left: number },
): LocatorLayout => {
  const rx = Math.max(26, Math.min(40, viewportWidth * 0.045));
  const ry = Math.round(rx * 0.42);
  const cx = Math.round(viewportWidth / 2);
  // 20px abaixo do teto seguro: passa por baixo da barra de contaminacao e do
  // rotulo de porcentagem dela sem disputar o mesmo pixel.
  const cy = Math.round(safe.top + 22 + ry);
  // 16px abaixo do anel: o marcador no rumo "180°" (embaixo) carrega os
  // entalhes de classe logo abaixo de si, e o texto nao pode disputar o pixel.
  const distanceY = cy + ry + 16;
  const markerPad = 8; // o marcador orbita um pouco alem do anel
  return {
    cx,
    cy,
    rx,
    ry,
    distanceY,
    bounds: {
      x: cx - rx - markerPad,
      y: cy - ry - markerPad,
      w: (rx + markerPad) * 2,
      h: ry + markerPad + (distanceY - cy) + 6,
    },
  };
};
