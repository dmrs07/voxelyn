// A BROCA DE AVANCO como MAQUINA.
//
// O que este modulo guarda e a FISICA LEGIVEL do golpe: o chassi que gira para
// alinhar com o corredor, a broca que acelera antes de sair, o perfil de
// velocidade da corrida (solavanco, aceleracao forte, maximo no meio, derrapagem
// no fim), a ponta que fere, o impacto e a recuperacao. Tudo aqui e funcao pura
// do relogio da acao — o cliente le o MESMO giro para a animacao e para o som,
// e a simulacao le o MESMO passo para mover e para ferir. Nenhum dos dois
// inventa o proprio ritmo.
//
// Proibido: DOM, Canvas, tempo de parede. So ticks.
import {
  DIAMANDIS_DRILL_SPEED,
  DIAMANDIS_DRILL_TICKS,
  DIAMANDIS_DRILL_WINDUP_TICKS,
  TICK_HZ,
} from './constants.js';
import type { EntityAction, Vec2 } from './types.js';

/**
 * ALINHAMENTO: o chassi gira ate encarar o corredor a esta taxa (radianos por
 * tick). Meia volta em 12 ticks (600 ms) — pesado, mas cabe na preparacao, e
 * o restante do aviso e broca acelerando com o rumo ja travado.
 */
export const DIAMANDIS_DRILL_ALIGN_RATE = Math.PI / 12;
/**
 * Janela nominal de alinhamento dentro da preparacao. O giro da broca so
 * comeca de verdade depois dela — o mancal primeiro, a ferramenta depois. Nao
 * depende de o chassi ter travado antes: a maquina segue o proprio protocolo.
 */
export const DIAMANDIS_DRILL_ALIGN_TICKS = 12;
/**
 * CORRECAO MINIMA nos primeiros instantes da corrida: no maximo estes radianos
 * (cerca de 6 graus) no total, espalhados pelos primeiros ticks. Nao e
 * perseguicao — sair da linha continua sendo a resposta inteira do golpe.
 */
export const DIAMANDIS_DRILL_CORRECT_RAD = 0.1;
export const DIAMANDIS_DRILL_CORRECT_TICKS = 6;
/** A PONTA da broca, a frente do centro do chassi (tiles) — e onde o dano mora. */
export const DIAMANDIS_DRILL_TIP_AHEAD = 1.6;
/** Raio da capsula de dano centro->ponta. Estreita: e uma broca, nao uma parede. */
export const DIAMANDIS_DRILL_TIP_RADIUS = 0.55;
/**
 * Abaixo desta fracao da velocidade maxima, bater na parede nao e impacto —
 * e a maquina encostando na derrapagem. So acima dela o corpo comprime, a
 * ferramenta trava e a corrida acaba.
 */
export const DIAMANDIS_DRILL_IMPACT_MIN_SPEED = 0.2;
/** Recuo depois do impacto: quantos ticks e quantos tiles no total. */
export const DIAMANDIS_DRILL_RECOIL_TICKS = 8;
export const DIAMANDIS_DRILL_RECOIL_TILES = 1.1;
/** Recuperacao parada: mais longa depois da parede do que depois do erro. */
export const DIAMANDIS_DRILL_WALL_RECOVERY_TICKS = 30;
export const DIAMANDIS_DRILL_SKID_RECOVERY_TICKS = 14;

/** O que a maquina esta fazendo neste tick, para quem a desenha e a soa. */
export type DrillStage = 'align' | 'spool' | 'lurch' | 'accelerate' | 'peak' | 'skid';

const smooth = (t: number): number => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/**
 * PERFIL DE VELOCIDADE da corrida, como fracao do maximo, em `u` = fracao da
 * corrida (0..1):
 *
 *   solavanco   0.00–0.05  a maquina sai do lugar (um tranco curto);
 *   aceleracao  0.05–0.34  forte, no primeiro terco;
 *   maximo      0.34–0.68  o meio da corrida;
 *   derrapagem  0.68–1.00  desacelera ate quase parar — e o "passou reto".
 */
export const drillSpeedProfile = (u: number): number => {
  if (u < 0.05) return 0.25 + 0.1 * (u / 0.05);
  if (u < 0.34) return 0.35 + 0.65 * smooth((u - 0.05) / 0.29);
  if (u < 0.68) return 1;
  return 1 - 0.88 * smooth((u - 0.68) / 0.32);
};

const profileSum = (() => {
  let s = 0;
  for (let k = 0; k < DIAMANDIS_DRILL_TICKS; k++) s += drillSpeedProfile(k / DIAMANDIS_DRILL_TICKS);
  return s;
})();

/**
 * Alcance total da corrida, em tiles. E o mesmo da broca de velocidade
 * constante que ela substitui: o perfil redistribui o passo, nao o corredor.
 */
export const DIAMANDIS_DRILL_RUN_TILES = (DIAMANDIS_DRILL_SPEED * DIAMANDIS_DRILL_TICKS) / TICK_HZ;

/** O passo (tiles) do tick `k` da corrida, `k` = ticks desde o release. */
export const drillStepAt = (k: number): number => {
  if (k < 0 || k >= DIAMANDIS_DRILL_TICKS) return 0;
  return (DIAMANDIS_DRILL_RUN_TILES * drillSpeedProfile(k / DIAMANDIS_DRILL_TICKS)) / profileSum;
};

/** A velocidade do tick `k` como fracao do maximo (0..1). */
export const drillSpeedFractionAt = (k: number): number => {
  if (k < 0 || k >= DIAMANDIS_DRILL_TICKS) return 0;
  return drillSpeedProfile(k / DIAMANDIS_DRILL_TICKS);
};

/** Velocidade maxima da corrida, tiles por segundo. */
export const DIAMANDIS_DRILL_PEAK_SPEED = (DIAMANDIS_DRILL_RUN_TILES / profileSum) * TICK_HZ;

/** Recuo do tick `j` depois do impacto (tiles, positivo = para tras). */
export const drillRecoilStepAt = (j: number): number => {
  if (j < 0 || j >= DIAMANDIS_DRILL_RECOIL_TICKS) return 0;
  // Forte no primeiro tick, morrendo linearmente: um tranco e um arrasto.
  const w = DIAMANDIS_DRILL_RECOIL_TICKS - j;
  const total = (DIAMANDIS_DRILL_RECOIL_TICKS * (DIAMANDIS_DRILL_RECOIL_TICKS + 1)) / 2;
  return (DIAMANDIS_DRILL_RECOIL_TILES * w) / total;
};

/** Que estagio da corrida (ou do aviso) o tick esta. */
export const drillStageAt = (action: EntityAction, tick: number): DrillStage | null => {
  if (action.kind !== 'drill') return null;
  if (tick < action.releaseAt) {
    return tick - action.startedAt < DIAMANDIS_DRILL_ALIGN_TICKS ? 'align' : 'spool';
  }
  const u = (tick - action.releaseAt) / DIAMANDIS_DRILL_TICKS;
  if (u < 0.05) return 'lurch';
  if (u < 0.34) return 'accelerate';
  if (u < 0.68) return 'peak';
  return 'skid';
};

/**
 * O GIRO da broca como fracao da rotacao maxima, pelo relogio da acao.
 *
 * Preparacao: quase parada enquanto o chassi alinha, depois sobe em curva
 * (lenta no comeco, visivelmente acelerando) ate 0,8 no release. Corrida:
 * chega ao maximo junto com a velocidade e cai um pouco na derrapagem.
 * `impactAt` >= 0 e a parede: a ferramenta TRAVA em dois ticks e fica
 * mastigando baixo enquanto recua. Depois da acao (`action` ausente), quem
 * chama usa `drillSpinDown`.
 *
 * Aceita tick fracionario: o cliente interpola entre ticks para a animacao e
 * para o som, e os dois leem esta mesma curva.
 */
export const drillSpinAt = (action: EntityAction, tick: number, impactAt = -1): number => {
  if (action.kind !== 'drill') return 0;
  const t = tick - action.startedAt;
  const windup = action.releaseAt - action.startedAt;
  if (tick < action.releaseAt) {
    if (t < DIAMANDIS_DRILL_ALIGN_TICKS) return 0.05 * Math.max(0, t / DIAMANDIS_DRILL_ALIGN_TICKS);
    const span = Math.max(1, windup - DIAMANDIS_DRILL_ALIGN_TICKS);
    const s = Math.min(1, (t - DIAMANDIS_DRILL_ALIGN_TICKS) / span);
    return 0.05 + 0.75 * s * s;
  }
  if (impactAt >= 0 && tick >= impactAt) {
    const since = tick - impactAt;
    return since < 2 ? 0.8 - 0.65 * (since / 2) : 0.15;
  }
  const k = tick - action.releaseAt;
  const u = k / DIAMANDIS_DRILL_TICKS;
  if (u < 0.34) return 0.8 + 0.2 * smooth(u / 0.34);
  if (u < 0.68) return 1;
  return 1 - 0.15 * smooth((u - 0.68) / 0.32);
};

/**
 * O giro DEPOIS da acao: a recuperacao. Da parede parte de 0,15 (a ferramenta
 * travada); do erro parte de 0,85 (a derrapagem). Cai ate zero em `ticks`,
 * com um tremor de "esforco" — a maquina nao desliga limpa, ela engasga.
 */
export const drillSpinDown = (from: number, sinceTicks: number, ticks: number): number => {
  if (sinceTicks >= ticks) return 0;
  const s = 1 - sinceTicks / ticks;
  const strain = 1 + 0.12 * Math.sin(sinceTicks * 2.7);
  return Math.max(0, from * s * s * strain);
};

/** Menor angulo assinado de `from` para `to`. */
export const angleBetween = (from: Vec2, to: Vec2): number => {
  const a = Math.atan2(from.y, from.x);
  const b = Math.atan2(to.y, to.x);
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Gira `from` na direcao de `to`, no maximo `rate` radianos. Ja alinhado: `to`. */
export const turnToward = (from: Vec2, to: Vec2, rate: number): Vec2 => {
  const d = angleBetween(from, to);
  if (Math.abs(d) <= rate) return { x: to.x, y: to.y };
  const a = Math.atan2(from.y, from.x) + Math.sign(d) * rate;
  return { x: Math.cos(a), y: Math.sin(a) };
};

/** O OITANTE (0..7) de um rumo: cada troca e um clique do mancal. */
export const octantOf = (dir: Vec2): number => {
  const a = Math.atan2(dir.y, dir.x);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
};

/** A posicao da PONTA da broca para um chassi em `x,y` olhando `dir`. */
export const drillTipAt = (x: number, y: number, dir: Vec2): Vec2 => ({
  x: x + dir.x * DIAMANDIS_DRILL_TIP_AHEAD,
  y: y + dir.y * DIAMANDIS_DRILL_TIP_AHEAD,
});

/**
 * Um ponto esta dentro da CAPSULA de dano da broca? O segmento vai de um
 * pouco atras do centro ate a ponta; o raio e o da capsula mais o do alvo.
 * Nunca a frente da ponta: o que fere e o que se ve.
 */
export const drillCapsuleHits = (
  x: number,
  y: number,
  dir: Vec2,
  px: number,
  py: number,
  targetRadius: number,
): boolean => {
  const ax = x - dir.x * 0.2;
  const ay = y - dir.y * 0.2;
  const tip = drillTipAt(x, y, dir);
  const bx = tip.x - ax;
  const by = tip.y - ay;
  const len2 = bx * bx + by * by;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0;
  const cx = ax + bx * t;
  const cy = ay + by * t;
  const r = DIAMANDIS_DRILL_TIP_RADIUS + targetRadius;
  return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
};

export const DIAMANDIS_DRILL_TOTAL_TICKS = DIAMANDIS_DRILL_WINDUP_TICKS + DIAMANDIS_DRILL_TICKS;
