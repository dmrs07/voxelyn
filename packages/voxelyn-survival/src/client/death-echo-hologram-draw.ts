// A tinta do holograma da caixa-preta.
//
// O modelo (death-echo-hologram.ts) decide ONDE cada ator está e em que pose;
// aqui só se decide como uma transmissão parece. Três coisas vendem o
// holograma sem trair o sprite: as linhas de varredura que o atravessam, a
// faixa de leitura que sobe por ele e o disco de projeção no chão, ligado por
// um feixe à caixa-preta que o emite. O sprite em si é o atlas de sempre, no
// tamanho de sempre — o jogador tem de reconhecer o Prospector e o Britador
// exatamente como os vê vivos.
//
// O compositor existe porque a varredura precisa de um canvas próprio: apagar
// linhas com `destination-out` direto na tela apagaria a caverna atrás do
// corpo. O sprite é desenhado num buffer do tamanho do quadro, tratado ali e
// só então carimbado no mundo com a opacidade da transmissão.

import type { HologramFrame } from './death-echo-hologram';

// A projeção 2:1 do jogo (`TILE_W`/`TILE_H` do renderer), repetida aqui para
// não importar o renderer de dentro de um módulo que ele importa.
const TILE_W = 32;
const TILE_H = 16;

// Paleta da art bible, repetida pela mesma razão de `death-echo-carcass.ts`:
// este módulo é importado pelo renderer e não pode depender dele.
const PAL = {
  biolum: '#59f2c2',
  electric: '#7ab8ff',
  blood: '#d93b4c',
  fire: '#ff7a2f',
  acid: '#a8e63c',
  fungusLight: '#66c28a',
  mist: '#7b8ba3',
  loot: '#ffd166',
};

/** A cor do Prospector projetado. */
export const HOLOGRAM_VICTIM_TINT = { color: 'rgba(89,242,194,0.58)', alpha: 0.58 };
/**
 * A cor do agressor projetado.
 *
 * Sangue e não fósforo: as duas figuras têm de se distinguir de longe, e o
 * que a caixa-preta quer que o jogador leia primeiro é QUEM matou.
 */
export const HOLOGRAM_THREAT_TINT = { color: 'rgba(217,59,76,0.55)', alpha: 0.55 };

/** Altura, em px de tela, entre linhas de varredura. */
const SCANLINE_PERIOD = 3;
const SCANLINE_ERASE = 0.42;
/** A faixa de leitura: quanto do quadro ela ocupa e quanto acende. */
const SWEEP_HEIGHT_FRACTION = 0.14;
const SWEEP_ALPHA = 0.22;
const SWEEP_PERIOD_MS = 1400;

/**
 * A cintilação da transmissão: dois senos defasados e um estalo raro.
 *
 * Determinística no relógio, e não em `Math.random()`: uma imagem que treme
 * diferente a cada quadro num monitor de 120 Hz vira ruído branco. Exposta
 * para o teste conferir que ela nunca apaga a figura.
 */
export const hologramFlicker = (nowMs: number, seed: number): number => {
  const slow = Math.sin(nowMs * 0.0041 + seed) * 0.05;
  const fast = Math.sin(nowMs * 0.031 + seed * 1.7) * 0.035;
  const dropout = Math.sin(nowMs * 0.0093 + seed * 3.1) > 0.985 ? -0.25 : 0;
  return Math.max(0.55, Math.min(1, 0.92 + slow + fast + dropout));
};

export class HologramCompositor {
  private buffer: HTMLCanvasElement | null = null;

  /**
   * Desenha um ator como transmissão.
   *
   * `paint` recebe o contexto do buffer e o PÉ do ator dentro dele, e devolve
   * `false` quando não conseguiu (atlas ainda carregando): nesse caso nada é
   * carimbado e quem chamou decide o recuo. `width`/`height`/`anchor` são as
   * medidas do quadro já multiplicadas pelo zoom do sprite.
   */
  project(
    target: CanvasRenderingContext2D,
    paint: (ctx: CanvasRenderingContext2D, footX: number, footY: number) => boolean,
    footX: number,
    footY: number,
    width: number,
    height: number,
    anchorX: number,
    anchorY: number,
    alpha: number,
    nowMs: number,
    seed: number,
  ): boolean {
    const w = Math.max(1, Math.ceil(width));
    const h = Math.max(1, Math.ceil(height));
    if (!this.buffer) this.buffer = document.createElement('canvas');
    const buffer = this.buffer;
    if (buffer.width !== w || buffer.height !== h) {
      buffer.width = w;
      buffer.height = h;
    }
    const ctx = buffer.getContext('2d');
    if (!ctx) return false;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    const drew = paint(ctx, anchorX, anchorY);
    ctx.restore();
    if (!drew) return false;

    // Linhas de varredura: apagam só dentro da silhueta, porque o buffer é
    // transparente fora dela.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${SCANLINE_ERASE})`;
    const phase = Math.floor(nowMs / 90) % SCANLINE_PERIOD;
    for (let y = phase; y < h; y += SCANLINE_PERIOD) ctx.fillRect(0, y, w, 1);
    // A faixa de leitura sobe pelo corpo: é o que diz "isto está sendo LIDO
    // agora", e não só "isto é verde".
    ctx.globalCompositeOperation = 'source-atop';
    const sweepHeight = Math.max(2, h * SWEEP_HEIGHT_FRACTION);
    const sweepY =
      h + sweepHeight - ((nowMs % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS) * (h + sweepHeight * 2);
    ctx.fillStyle = `rgba(255,255,255,${SWEEP_ALPHA})`;
    ctx.fillRect(0, sweepY, w, sweepHeight);
    ctx.restore();

    target.save();
    target.imageSmoothingEnabled = false;
    target.globalAlpha = Math.max(0, Math.min(1, alpha)) * hologramFlicker(nowMs, seed);
    target.drawImage(buffer, Math.round(footX - anchorX), Math.round(footY - anchorY));
    target.restore();
    return true;
  }
}

/** Deslocamento de mundo → deslocamento de tela, na projeção 2:1 do jogo. */
const isoOffset = (dx: number, dy: number, z: number): [number, number] => [
  (dx - dy) * (TILE_W / 2) * z,
  (dx + dy) * (TILE_H / 2) * z,
];

/**
 * O chão da transmissão: trajeto, disparos, discos de projeção e o feixe.
 *
 * Tudo aqui fica no PLANO do chão e por isso entra na fila antes dos atores.
 * O feixe sai da caixa-preta — a lâmpada que pisca na carcaça — e vai até o
 * disco do Prospector: é ele que amarra a figura a quem a está emitindo.
 */
export const drawHologramGround = (
  ctx: CanvasRenderingContext2D,
  frame: HologramFrame,
  origin: { x: number; y: number },
  toScreen: (x: number, y: number) => [number, number],
  z: number,
  nowMs: number,
): void => {
  const alpha = frame.alpha;
  if (alpha <= 0) return;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // O caminho inteiro fica fraco no fundo: é o contorno da fuga, e ler o
  // trajeto todo de uma vez é o que transforma um corpo num acontecimento.
  ctx.strokeStyle = PAL.biolum;
  ctx.globalAlpha = 0.2 * alpha;
  ctx.lineWidth = Math.max(1, z * 0.7);
  ctx.setLineDash([Math.max(2, 3 * z), Math.max(2, 2 * z)]);
  ctx.beginPath();
  frame.path.forEach((point, index) => {
    const [px, py] = toScreen(point.x, point.y);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Cada disparo marca o chão de onde saiu. Três ou quatro marcas dizem
  // "ele estava atirando enquanto recuava" sem uma linha de texto.
  ctx.fillStyle = PAL.electric;
  ctx.globalAlpha = 0.5 * alpha;
  for (const shot of frame.shots) {
    const [px, py] = toScreen(shot.x, shot.y);
    ctx.fillRect(Math.round(px - z), Math.round(py - z * 0.5), Math.max(1, 2 * z), Math.max(1, z));
  }

  // A trilha do agressor, quando há: o mesmo contorno, na cor dele.
  const threatPath = frame.path.filter((point) => point.threat !== null);
  if (threatPath.length > 1) {
    ctx.strokeStyle = PAL.blood;
    ctx.globalAlpha = 0.16 * alpha;
    ctx.setLineDash([Math.max(2, 2 * z), Math.max(2, 3 * z)]);
    ctx.beginPath();
    threatPath.forEach((point, index) => {
      const threat = point.threat;
      if (!threat) return;
      const [px, py] = toScreen(threat.x, threat.y);
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Os discos de projeção: o pé de cada figura sobre um anel que respira.
  const breath = 0.85 + Math.sin(nowMs * 0.006) * 0.15;
  const disc = (x: number, y: number, color: string, radius: number): void => {
    const [px, py] = toScreen(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12 * alpha;
    ctx.beginPath();
    ctx.ellipse(px, py, radius * z * breath, radius * z * 0.5 * breath, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.45 * alpha;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.stroke();
  };
  disc(frame.victim.x, frame.victim.y, PAL.biolum, 9);
  if (frame.threat) disc(frame.threat.x, frame.threat.y, PAL.blood, 11);

  // O feixe: da lâmpada da caixa-preta ao disco do Prospector. Fraco e
  // tremido, porque é luz e não fio.
  const [bx, by] = toScreen(origin.x, origin.y);
  const [vx, vy] = toScreen(frame.victim.x, frame.victim.y);
  const jitter = Math.sin(nowMs * 0.02) * z * 0.6;
  ctx.strokeStyle = PAL.biolum;
  ctx.globalAlpha = 0.28 * alpha;
  ctx.lineWidth = Math.max(1, z * 0.5);
  ctx.beginPath();
  ctx.moveTo(bx + 3.5 * z, by - 5.5 * z);
  ctx.lineTo(vx + jitter, vy - 1.5 * z);
  ctx.stroke();
  ctx.restore();
};

/**
 * A silhueta de recuo de um ator sem atlas: dois blocos na cor da transmissão.
 *
 * É o mesmo desenho que o holograma antigo tinha — e só aparece enquanto o
 * atlas daquele arquétipo não chegou. Um chefe raro pode cair aqui na primeira
 * abertura da caixa-preta; o Prospector, nunca (o atlas dele é obrigatório).
 */
export const drawHologramFallback = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  z: number,
  color: string,
  alpha: number,
  nowMs: number,
  seed: number,
): void => {
  ctx.save();
  ctx.globalAlpha = alpha * 0.5 * hologramFlicker(nowMs, seed);
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.round(sx - 3 * z),
    Math.round(sy - 16 * z),
    Math.max(2, 6 * z),
    Math.max(2, 16 * z),
  );
  ctx.fillRect(
    Math.round(sx - 4 * z),
    Math.round(sy - 21 * z),
    Math.max(2, 8 * z),
    Math.max(2, 5 * z),
  );
  ctx.restore();
};

/**
 * O que a causa fez com o corpo, desenhado no instante da morte.
 *
 * Cada efeito acontece NO Prospector e em nenhum outro lugar — ver
 * `HologramEffect`. São primitivas de canvas, e não atlas de FX, porque são
 * transmissão: têm de parecer feitas da mesma luz da figura, e não uma
 * explosão de verdade estourando dentro de um holograma.
 */
export const drawHologramEffect = (
  ctx: CanvasRenderingContext2D,
  frame: HologramFrame,
  toScreen: (x: number, y: number) => [number, number],
  z: number,
  nowMs: number,
): void => {
  const strength = frame.effectT * frame.alpha;
  if (strength <= 0 || frame.effect === 'none') return;
  const [vx, vy] = toScreen(frame.victim.x, frame.victim.y);
  const age = Math.max(0, frame.effectAgeMs);
  ctx.save();
  ctx.lineCap = 'round';
  switch (frame.effect) {
    case 'flames': {
      // Línguas que sobem do chão pelo corpo: altura aleatória pelo relógio.
      ctx.fillStyle = PAL.fire;
      for (let i = 0; i < 7; i++) {
        const wobble = Math.sin(nowMs * 0.013 + i * 1.9);
        const height = (6 + (i % 3) * 4 + wobble * 3) * z * strength;
        const x = vx + (i - 3) * 2.6 * z + wobble * z;
        ctx.globalAlpha = (0.35 + Math.abs(wobble) * 0.3) * strength;
        ctx.fillRect(
          Math.round(x - z),
          Math.round(vy - height),
          Math.max(1, 2 * z),
          Math.max(1, height),
        );
      }
      break;
    }
    case 'overheat': {
      // O reator do próprio Prospector: brilho pulsando no ombro da arma.
      const pulse = 0.5 + Math.sin(nowMs * 0.02) * 0.5;
      ctx.fillStyle = PAL.fire;
      ctx.globalAlpha = (0.25 + pulse * 0.35) * strength;
      ctx.beginPath();
      ctx.ellipse(
        vx + 3 * z,
        vy - 13 * z,
        (5 + pulse * 3) * z,
        (4 + pulse * 2) * z,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      break;
    }
    case 'arc': {
      // Arcos quebrados em volta do corpo, redesenhados a cada ~50 ms.
      ctx.strokeStyle = PAL.electric;
      ctx.lineWidth = Math.max(1, z * 0.8);
      const step = Math.floor(nowMs / 50);
      for (let i = 0; i < 4; i++) {
        const seed = step * 7 + i * 13;
        const angle = ((seed % 16) / 16) * Math.PI * 2;
        ctx.globalAlpha = (0.4 + ((seed * 31) % 10) / 25) * strength;
        ctx.beginPath();
        let x = vx;
        let y = vy - 9 * z;
        ctx.moveTo(x, y);
        for (let k = 1; k <= 4; k++) {
          x += Math.cos(angle) * 3 * z + (((seed * k * 17) % 7) - 3) * z * 0.6;
          y += Math.sin(angle) * 1.5 * z + (((seed * k * 23) % 7) - 3) * z * 0.6;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      break;
    }
    case 'burst': {
      // O anel que se expande do ponto da morte e some.
      const t = Math.min(1, age / 700);
      ctx.strokeStyle = PAL.fire;
      ctx.lineWidth = Math.max(1, z * (2 - t * 1.5));
      ctx.globalAlpha = (1 - t) * 0.8 * strength;
      ctx.beginPath();
      ctx.ellipse(vx, vy - 2 * z, (4 + t * 26) * z, (2 + t * 13) * z, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PAL.loot;
      ctx.globalAlpha = Math.max(0, 0.6 - t * 1.2) * strength;
      ctx.beginPath();
      ctx.ellipse(vx, vy - 6 * z, 8 * z, 5 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'cloud': {
      // Bolhas de gás lentas em volta do tronco.
      ctx.fillStyle = PAL.acid;
      for (let i = 0; i < 6; i++) {
        const drift = ((nowMs * 0.02 + i * 97) % 120) / 120;
        const x = vx + Math.sin(nowMs * 0.002 + i * 2.1) * 8 * z;
        const y = vy - (4 + drift * 16) * z;
        ctx.globalAlpha = (1 - drift) * 0.3 * strength;
        ctx.beginPath();
        ctx.ellipse(x, y, (3 + drift * 3) * z, (2 + drift * 2) * z, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'spores': {
      // Pontos que orbitam e pousam: a colonização começando.
      ctx.fillStyle = PAL.fungusLight;
      for (let i = 0; i < 9; i++) {
        const orbit = nowMs * 0.0025 + i * 0.7;
        const x = vx + Math.cos(orbit) * (6 + (i % 3) * 3) * z;
        const y = vy - 8 * z + Math.sin(orbit) * (3 + (i % 2) * 2) * z - (i % 4) * 2 * z;
        ctx.globalAlpha = (0.35 + ((i * 37) % 10) / 20) * strength;
        ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, z), Math.max(1, z));
      }
      break;
    }
    case 'strike': {
      // O impacto: um clarão curto no corpo, do lado de quem bateu.
      const t = Math.min(1, age / 260);
      const threat = frame.threat;
      const [dx, dy] = threat
        ? isoOffset(threat.x - frame.victim.x, threat.y - frame.victim.y, 1)
        : [0, 0];
      const length = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = PAL.blood;
      ctx.lineWidth = Math.max(1, z * 1.4);
      ctx.globalAlpha = (1 - t) * 0.85 * strength;
      ctx.beginPath();
      const cx = vx + (dx / length) * 5 * z;
      const cy = vy - 9 * z + (dy / length) * 5 * z;
      for (let i = 0; i < 3; i++) {
        const angle = Math.atan2(dy, dx) + Math.PI + (i - 1) * 0.5;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * (4 + t * 6) * z, cy + Math.sin(angle) * (2 + t * 3) * z);
      }
      ctx.stroke();
      break;
    }
    case 'projectile': {
      // O tiro que chegou: viaja do agressor ao corpo nos últimos instantes
      // e explode em faíscas ao tocar. Sem agressor na fita, só o impacto.
      const threat = frame.threat;
      const lead = Math.max(0, Math.min(1, frame.effectT));
      if (threat && frame.effectAgeMs < 0) {
        const [tx, ty] = toScreen(threat.x, threat.y);
        const px = tx + (vx - tx) * lead;
        const py = ty - 10 * z + (vy - 8 * z - (ty - 10 * z)) * lead;
        ctx.fillStyle = PAL.blood;
        ctx.globalAlpha = 0.85 * frame.alpha;
        ctx.fillRect(
          Math.round(px - 1.5 * z),
          Math.round(py - 1.5 * z),
          Math.max(2, 3 * z),
          Math.max(2, 3 * z),
        );
      } else {
        const t = Math.min(1, age / 320);
        ctx.strokeStyle = PAL.blood;
        ctx.lineWidth = Math.max(1, z * 0.9);
        ctx.globalAlpha = (1 - t) * 0.8 * strength;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          ctx.moveTo(vx, vy - 9 * z);
          ctx.lineTo(
            vx + Math.cos(angle) * (3 + t * 8) * z,
            vy - 9 * z + Math.sin(angle) * (1.5 + t * 4) * z,
          );
        }
        ctx.stroke();
      }
      break;
    }
    case 'sink': {
      // A lâmina que sobe pelo corpo: ondulação onde o chão cedeu.
      const t = Math.min(1, age / 900);
      ctx.strokeStyle = PAL.mist;
      ctx.lineWidth = Math.max(1, z * 0.8);
      for (let i = 0; i < 2; i++) {
        const rt = Math.max(0, Math.min(1, t - i * 0.25));
        ctx.globalAlpha = (1 - rt) * 0.55 * strength;
        ctx.beginPath();
        ctx.ellipse(vx, vy - 2 * z, (5 + rt * 14) * z, (2.5 + rt * 7) * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'fade': {
      // Apagou: a projeção do corpo escurece um pouco mais a cada segundo.
      ctx.fillStyle = 'rgba(11,14,20,0.6)';
      ctx.globalAlpha = Math.min(0.6, age / 1400) * strength;
      ctx.beginPath();
      ctx.ellipse(vx, vy - 8 * z, 9 * z, 12 * z, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
  ctx.restore();
};
