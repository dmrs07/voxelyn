// O holograma da caixa-preta: a REPRODUÇÃO dos últimos segundos, sem tinta.
//
// A cápsula guarda um rastro grosseiro — 24 amostras a cada 120 ms, em oitavos
// de tile — e este módulo o transforma, quadro a quadro, em ATORES: onde o
// Prospector estava, em que pose, olhando para onde; onde o agressor estava e o
// que fazia; que efeito a causa deixa no instante da morte. O renderer recebe
// isso pronto e só escolhe tinta e sprite.
//
// Duas regras que o modelo protege:
//
// 1) NADA aqui inventa geometria. Posição vem do rastro; pose vem do que o
//    rastro prova (andou, atirou, perdeu vida); o agressor só aparece quando a
//    cápsula trouxe a trilha dele. Um rastro antigo, sem vida e sem trilha,
//    produz um holograma que anda e atira — e não um que apanha de ninguém.
//
// 2) O TEMPO é o da cápsula. A reprodução dura o que o rastro durou, mais a
//    pausa da morte e o rebobinar; o quadro é derivado do relógio desde o
//    pareamento, nunca acumulado — reabrir a caixa-preta reinicia a fita.

import type { DamageCause, EnemyArchetype } from '@voxelyn/survival-sim';
import {
  DEATH_ECHO_TRACE_STEP_MS,
  deathEchoTraceDuration,
  decodeDeathEchoTracePoint,
  type DeathEchoTrace,
  type DeathEchoTracePoint,
  type PlacedDeathEcho,
} from '@voxelyn/survival-protocol';

/** Quanto tempo o corpo fica caído, com o efeito da causa, antes de rebobinar. */
export const DEATH_ECHO_HOLD_MS = 1400;
/** O apagão entre o fim de uma reprodução e o começo da seguinte. */
export const DEATH_ECHO_REWIND_MS = 600;
/** Quanto do começo da fita é gasto acendendo a projeção. */
export const DEATH_ECHO_FADE_IN_MS = 220;
/** Quanto antes da morte o efeito da causa começa a aparecer. */
export const DEATH_ECHO_EFFECT_LEAD_MS = 320;
/** Deslocamento por passo a partir do qual o Prospector "andou". */
const MOVING_TILES_PER_STEP = 0.02;
/** Queda de vida por passo a partir da qual houve um golpe. */
const HIT_HP_DROP = 0.004;
/** Quantas amostras antes do fim o agressor já está desferindo o golpe. */
const THREAT_ATTACK_STEPS = 2;
/** Quantas amostras tem a fita SEM rastro: o Prospector parado, e a morte. */
const STILL_TRACE_SAMPLES = 6;
/**
 * O ciclo da pose de ataque enquanto o gatilho continua apertado.
 *
 * `attack` não faz laço no atlas: sem isto, três amostras seguidas de disparo
 * congelariam o Prospector no último quadro do coice. O ciclo é o do Cravador
 * (~3 tiros/s), e o mesmo serve para o golpe do agressor.
 */
const ATTACK_CYCLE_MS = 340;

export type HologramPhase = 'replay' | 'death' | 'rewind';

export type HologramAnimation = 'idle' | 'walk' | 'attack' | 'hit' | 'die';

export type HologramActor = {
  x: number;
  y: number;
  anim: HologramAnimation;
  facingX: number;
  facingY: number;
  /** Desde quando esta pose está em curso, para o quadro do atlas. */
  elapsedMs: number;
};

export type HologramThreat = HologramActor & {
  archetype: EnemyArchetype;
  elite: boolean;
};

/**
 * O que a causa deixa ver no instante da morte.
 *
 * É uma tradução da causa autoritativa para um vocabulário de DESENHO — chama,
 * arco, nuvem — e nada mais: o efeito acontece no corpo, no ponto da morte, e
 * nunca desenha uma fonte que a cápsula não conhece. O gás aparece ao redor do
 * Prospector porque foi ali que ele o respirou; de onde o gás veio, o holograma
 * não sabe e não finge saber.
 */
export type HologramEffect =
  | 'flames'
  | 'arc'
  | 'burst'
  | 'cloud'
  | 'spores'
  | 'strike'
  | 'projectile'
  | 'sink'
  | 'overheat'
  | 'fade'
  | 'none';

export type HologramFrame = {
  phase: HologramPhase;
  /** Milissegundos até a morte: negativo na reprodução, zero ou mais depois. */
  timecodeMs: number;
  /** 0..1 ao longo de reprodução + morte. Alimenta a barra do laudo. */
  progress: number;
  /** Intensidade da projeção inteira: acende no começo, apaga no rebobinar. */
  alpha: number;
  victim: HologramActor;
  threat: HologramThreat | null;
  /** O trajeto inteiro, no mundo, para o contorno fraco no chão. */
  path: readonly DeathEchoTracePoint[];
  /** Os disparos já alcançados pela fita. */
  shots: readonly { x: number; y: number }[];
  effect: HologramEffect;
  /** Ms desde a morte para animar o efeito; negativo enquanto ele só anuncia. */
  effectAgeMs: number;
  /** 0..1: quanto do efeito já se vê. */
  effectT: number;
};

export const hologramEffectFor = (cause: DamageCause): HologramEffect => {
  switch (cause.kind) {
    case 'fire':
      return 'flames';
    case 'overheat':
      return 'overheat';
    case 'discharge':
    case 'leviathan_discharge':
      return 'arc';
    case 'explosion':
      return 'burst';
    case 'gas':
    case 'contamination':
      return 'cloud';
    case 'spores':
      return 'spores';
    case 'enemy_contact':
    case 'suture_whip':
      return 'strike';
    case 'enemy_projectile':
      return 'projectile';
    case 'deep_water':
    case 'suture_fall':
      return 'sink';
    case 'bleedout':
      return 'fade';
    case 'player_shot':
    case 'unknown':
    default:
      return 'none';
  }
};

const octantOf = (x: number, y: number): number => {
  if (x === 0 && y === 0) return 0;
  return ((Math.round(Math.atan2(y, x) / (Math.PI / 4)) % 8) + 8) % 8;
};

/**
 * A fita de uma cápsula SEM rastro: o Prospector parado onde caiu, e a morte.
 *
 * O co-op não contribui rastro (ver spec, Etapa 2), e uma cápsula legada
 * tampouco. Ainda assim a caixa-preta tem o que mostrar: o corpo em pé, no
 * ponto exato onde morreu, virado para onde a carcaça aponta, e a causa
 * acontecendo com ele. Nenhum passo é inventado — todos os deslocamentos são
 * zero, que é o único valor que a cápsula prova.
 */
export const stillDeathEchoTrace = (echo: { facingX: number; facingY: number }): DeathEchoTrace => {
  const aim = octantOf(echo.facingX, echo.facingY);
  return {
    stepMs: DEATH_ECHO_TRACE_STEP_MS,
    dx: new Array<number>(STILL_TRACE_SAMPLES).fill(0),
    dy: new Array<number>(STILL_TRACE_SAMPLES).fill(0),
    aim: new Array<number>(STILL_TRACE_SAMPLES).fill(aim),
  };
};

/** A fita que a caixa-preta reproduz para este corpo. */
export const deathEchoReplayTrace = (echo: PlacedDeathEcho): DeathEchoTrace =>
  echo.finalTrace ?? stillDeathEchoTrace(echo);

/** Duração de um laço inteiro: fita, morte e rebobinar. */
export const deathEchoReplayDuration = (trace: DeathEchoTrace): number =>
  deathEchoTraceDuration(trace) + DEATH_ECHO_HOLD_MS + DEATH_ECHO_REWIND_MS;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** O tempo de pose que vai ao atlas: o ataque recomeça a cada ciclo. */
const poseElapsed = (anim: HologramAnimation, elapsedMs: number): number =>
  anim === 'attack' ? elapsedMs % ATTACK_CYCLE_MS : elapsedMs;

const normalize = (
  x: number,
  y: number,
  fallbackX: number,
  fallbackY: number,
): [number, number] => {
  const length = Math.hypot(x, y);
  if (length < 1e-6) return [fallbackX, fallbackY];
  return [x / length, y / length];
};

/**
 * A pose do Prospector no passo `index` → `index + 1`, provada pelo rastro.
 *
 * Prioridade: apanhou > atirou > andou > parado. O golpe vence porque é o que a
 * reprodução existe para mostrar; o tiro vence o andar porque a mira é a
 * informação (para onde ele achava que o perigo estava), e a passada não.
 */
const victimStepAnim = (
  points: readonly DeathEchoTracePoint[],
  index: number,
): HologramAnimation => {
  const here = points[index];
  const next = points[Math.min(points.length - 1, index + 1)];
  if (here.hp !== null && next.hp !== null && next.hp < here.hp - HIT_HP_DROP) return 'hit';
  if (here.firing) return 'attack';
  if (Math.hypot(next.x - here.x, next.y - here.y) > MOVING_TILES_PER_STEP) return 'walk';
  return 'idle';
};

/** Quantos passos seguidos, terminando em `index`, tiveram esta mesma pose. */
const runLength = (
  points: readonly DeathEchoTracePoint[],
  index: number,
  anim: HologramAnimation,
): number => {
  let count = 0;
  for (let i = index - 1; i >= 0 && victimStepAnim(points, i) === anim; i--) count++;
  return count;
};

const threatStepAnim = (
  points: readonly DeathEchoTracePoint[],
  index: number,
): HologramAnimation => {
  if (index >= points.length - 1 - THREAT_ATTACK_STEPS) return 'attack';
  const here = points[index].threat;
  const next = points[Math.min(points.length - 1, index + 1)].threat;
  if (here && next && Math.hypot(next.x - here.x, next.y - here.y) > MOVING_TILES_PER_STEP) {
    return 'walk';
  }
  return 'idle';
};

const threatRunLength = (
  points: readonly DeathEchoTracePoint[],
  index: number,
  anim: HologramAnimation,
): number => {
  let count = 0;
  for (
    let i = index - 1;
    i >= 0 && points[i].threat !== null && threatStepAnim(points, i) === anim;
    i--
  ) {
    count++;
  }
  return count;
};

const threatIdentity = (
  cause: DamageCause,
): { archetype: EnemyArchetype; elite: boolean } | null =>
  cause.kind === 'enemy_contact' || cause.kind === 'enemy_projectile'
    ? { archetype: cause.archetype, elite: cause.elite }
    : null;

/**
 * O quadro da reprodução `nowMs - openedAtMs` depois do pareamento.
 *
 * Devolve `null` só quando a fita não tem nem dois pontos — o que o protocolo
 * já impede em rastro real, e `stillDeathEchoTrace` impede no sintético.
 */
export const deathEchoHologramFrame = (
  echo: PlacedDeathEcho,
  openedAtMs: number,
  nowMs: number,
): HologramFrame | null => {
  const trace = deathEchoReplayTrace(echo);
  const count = trace.dx.length;
  if (count < 2) return null;
  const points: DeathEchoTracePoint[] = [];
  for (let i = 0; i < count; i++) {
    const point = decodeDeathEchoTracePoint(trace, i, echo.x, echo.y);
    if (!point) return null;
    points.push(point);
  }

  const traceMs = deathEchoTraceDuration(trace);
  const total = deathEchoReplayDuration(trace);
  const elapsed = Math.max(0, nowMs - openedAtMs) % total;
  const effect = hologramEffectFor(echo.cause);
  const identity = threatIdentity(echo.cause);
  const last = points[count - 1];

  const shotsUntil = (index: number): { x: number; y: number }[] => {
    const shots: { x: number; y: number }[] = [];
    for (let i = 0; i <= index; i++) {
      if (points[i].firing) shots.push({ x: points[i].x, y: points[i].y });
    }
    return shots;
  };

  if (elapsed < traceMs) {
    // REPRODUÇÃO: o passo `index` está `frac` percorrido.
    const position = elapsed / trace.stepMs;
    const index = Math.min(count - 1, Math.floor(position));
    const frac = Math.min(1, position - index);
    const here = points[index];
    // No último passo o destino é a CARCAÇA: a última amostra foi colhida até
    // 120 ms antes da morte, e o corpo tem de cair onde o corpo está.
    const nextPoint = index + 1 < count ? points[index + 1] : null;
    const next = nextPoint ?? { x: echo.x, y: echo.y };
    const x = lerp(here.x, next.x, frac);
    const y = lerp(here.y, next.y, frac);
    const anim = victimStepAnim(points, index);
    const [moveX, moveY] = normalize(next.x - here.x, next.y - here.y, here.aimX, here.aimY);
    const facesAim = anim === 'attack' || anim === 'idle' || anim === 'hit';
    const victim: HologramActor = {
      x,
      y,
      anim,
      facingX: facesAim ? here.aimX : moveX,
      facingY: facesAim ? here.aimY : moveY,
      elapsedMs: poseElapsed(
        anim,
        runLength(points, index, anim) * trace.stepMs + frac * trace.stepMs,
      ),
    };

    let threat: HologramThreat | null = null;
    if (identity && here.threat) {
      // Sem amostra seguinte (ou sem o agressor nela) a criatura fica onde a
      // fita a viu pela última vez, em vez de deslizar para um lugar inventado.
      const target = nextPoint ? nextPoint.threat : here.threat;
      const tx = target ? lerp(here.threat.x, target.x, frac) : here.threat.x;
      const ty = target ? lerp(here.threat.y, target.y, frac) : here.threat.y;
      const threatAnim = threatStepAnim(points, index);
      // O agressor encara o Prospector: é a única direção que o rastro prova.
      const [fx, fy] = normalize(x - tx, y - ty, 0, 1);
      threat = {
        ...identity,
        x: tx,
        y: ty,
        anim: threatAnim,
        facingX: fx,
        facingY: fy,
        elapsedMs: poseElapsed(
          threatAnim,
          threatRunLength(points, index, threatAnim) * trace.stepMs + frac * trace.stepMs,
        ),
      };
    }

    const effectAgeMs = elapsed - traceMs;
    return {
      phase: 'replay',
      timecodeMs: effectAgeMs,
      progress: elapsed / (traceMs + DEATH_ECHO_HOLD_MS),
      alpha: Math.min(1, elapsed / DEATH_ECHO_FADE_IN_MS),
      victim,
      threat,
      path: points,
      shots: shotsUntil(index),
      effect,
      effectAgeMs,
      effectT: Math.max(0, Math.min(1, 1 + effectAgeMs / DEATH_ECHO_EFFECT_LEAD_MS)),
    };
  }

  // MORTE e REBOBINAR: o corpo caído sobre a carcaça, o efeito no auge.
  const sinceDeath = elapsed - traceMs;
  const rewinding = sinceDeath >= DEATH_ECHO_HOLD_MS;
  const rewindT = rewinding ? (sinceDeath - DEATH_ECHO_HOLD_MS) / DEATH_ECHO_REWIND_MS : 0;
  const victim: HologramActor = {
    x: echo.x,
    y: echo.y,
    anim: 'die',
    facingX: last.aimX,
    facingY: last.aimY,
    elapsedMs: sinceDeath,
  };
  let threat: HologramThreat | null = null;
  if (identity && last.threat) {
    const [fx, fy] = normalize(echo.x - last.threat.x, echo.y - last.threat.y, 0, 1);
    // O golpe final ainda está saindo nos primeiros instantes; depois, a
    // criatura só está lá, parada sobre o que fez.
    const striking = sinceDeath < 520;
    threat = {
      ...identity,
      x: last.threat.x,
      y: last.threat.y,
      anim: striking ? 'attack' : 'idle',
      facingX: fx,
      facingY: fy,
      elapsedMs: striking ? THREAT_ATTACK_STEPS * trace.stepMs + sinceDeath : sinceDeath - 520,
    };
  }
  return {
    phase: rewinding ? 'rewind' : 'death',
    timecodeMs: sinceDeath,
    progress: rewinding ? 1 : (traceMs + sinceDeath) / (traceMs + DEATH_ECHO_HOLD_MS),
    alpha: rewinding ? Math.max(0, 1 - rewindT) : 1,
    victim,
    threat,
    path: points,
    shots: shotsUntil(count - 1),
    effect,
    effectAgeMs: sinceDeath,
    effectT: 1,
  };
};

/**
 * O contador da fita, como o laudo o mostra: `-2.4` antes da morte, `0.0`
 * dela em diante. Décimos bastam — a amostra é de 120 ms.
 */
export const hologramTimecode = (frame: HologramFrame): string => {
  const seconds = Math.min(0, frame.timecodeMs) / 1000;
  const magnitude = Math.abs(seconds).toFixed(1);
  return seconds < -0.05 ? `-${magnitude}` : '0.0';
};
