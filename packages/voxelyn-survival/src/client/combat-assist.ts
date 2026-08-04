// A trilha de IA — Cognicao de Combate, executada.
//
// Os seis protocolos IA existem como campos em `PlayerTuning.combat` que
// ninguem leria: este arquivo e o que faz cada um deles existir, no mesmo
// espirito do survey-overlay para o Levantamento.
//
// ---------------------------------------------------------------------------
// A REGRA QUE SEPARA ESTE ARQUIVO DA SIMULACAO
// ---------------------------------------------------------------------------
// Nada aqui altera um tick DIRETAMENTE. Os tres primeiros protocolos sao
// leitura pura (brackets, telegrafo, antecipacao). Os tres ultimos mexem no
// COMANDO antes de o recorder grava-lo: o que chega a simulacao — e ao replay
// do servidor — e um `aim` comum, indistinguivel de um do mouse. E por isso
// que `combat` fica fora do hash autoritativo, e por isso que a assistencia
// nunca pode dessincronizar: ela ja aconteceu quando a simulacao olha.
//
// A consequencia de design importa tanto quanto no Levantamento: nenhum
// protocolo daqui aumenta dano. A IA interpreta ameacas, preve movimento e
// executa melhor o comando do jogador — o unico bonus direto de dano da arvore
// continua no fim do Reator.
//
// ---------------------------------------------------------------------------
// AS REGRAS DO AUTO-AIM (a lista que o capstone nao pode quebrar)
// ---------------------------------------------------------------------------
// - So entidades vivas, hostis, no alcance e com linha de visao. Nunca
//   atraves de paredes.
// - O Minerador passivo ou em fuga NUNCA e alvo: ele comeca neutro e reage ao
//   calor da arma — um auto-aim ingenuo faria o jogador ataca-lo por acidente
//   e carimbaria `innocentsKilled` numa decisao que nao foi dele.
// - Espreitadores dentro do proprio elemento (submersos / sob o gelo) ficam
//   fora: mirar no que nao se ve seria a assistencia inventando informacao.
// - Empate e deterministico: distancia, depois `entity.id`.
// - Sem alvo valido, nenhum disparo acontece e nenhum calor e gerado — o
//   comando simplesmente nao vira tiro.
// - Um vetor manual diferente de zero sempre substitui o auto-aim.

import {
  BOLT_SPEED,
  DEFAULT_PLAYER_TUNING,
  LURKER_HIDDEN,
  MINER_MOOD_ENRAGED,
  MINER_MOOD_FLEEING,
  TICK_HZ,
  hasLineOfSight,
  type Entity,
  type PlayerCommand,
  type PlayerTuning,
  type SurvivalState,
  type Vec2,
} from '@voxelyn/survival-sim';

export type CombatTuning = PlayerTuning['combat'];

/**
 * O grupo `combat` do tuning, tolerando tickets emitidos antes da trilha.
 *
 * Um ticket cacheado do deploy anterior chega sem o grupo; quebrar o render
 * por causa dele seria punir exatamente o jogador que estava no meio de uma
 * run quando a Aurix atualizou a linha.
 */
export const combatTuningOf = (tuning: PlayerTuning): CombatTuning =>
  tuning.combat ?? DEFAULT_PLAYER_TUNING.combat;

/** Algum protocolo de leitura esta instalado? Evita trabalho por quadro. */
export const hasCombatSense = (combat: CombatTuning): boolean =>
  combat.threatBrackets || combat.intentTelegraph || combat.interceptMarker;

/**
 * Alcance de aquisicao, em tiles: NO MAXIMO o alcance efetivo do bolt.
 *
 * Derivado das mesmas constantes que a simulacao usa (velocidade x vida util),
 * e arredondado para BAIXO: a IA nunca pode prometer um alvo que o armamento
 * nao alcanca.
 */
export const ACQUIRE_RANGE_TILES = Math.floor(BOLT_SPEED * (Math.ceil(TICK_HZ * 1.4) / TICK_HZ));

/** IA-04: o teto da correcao vem do tuning; estes sao os cones AUXILIARES. */
/** Cone de aquisicao para a memoria quando IA-04 nao esta instalado. */
export const MEMORY_ACQUIRE_CONE_DEGREES = 8;
/** Ate onde a aderencia (IA-05) segue um alvo que a mira manual quase acompanha. */
export const STICKINESS_CONE_DEGREES = 25;

export type ThreatPosture = 'hostile' | 'passive' | 'fleeing';

/** IA-01: a leitura de postura. So o Minerador tem tres; o resto e hostil. */
export const threatPostureOf = (enemy: Entity): ThreatPosture => {
  if (enemy.archetype !== 'miner') return 'hostile';
  if (enemy.mood === MINER_MOOD_ENRAGED) return 'hostile';
  if (enemy.mood === MINER_MOOD_FLEEING) return 'fleeing';
  return 'passive';
};

/** O corpo esta visivel? Espreitadores no proprio elemento nao estao. */
const hasVisibleBody = (enemy: Entity): boolean =>
  !(
    (enemy.archetype === 'mud_lamprey' || enemy.archetype === 'frost_wraith') &&
    (enemy.mood ?? LURKER_HIDDEN) === LURKER_HIDDEN
  );

const distanceTo = (from: Vec2, enemy: Entity): number =>
  Math.hypot(enemy.x - from.x, enemy.y - from.y);

const directionTo = (from: Vec2, enemy: Entity): Vec2 => {
  const dx = enemy.x - from.x;
  const dy = enemy.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

/** Angulo entre dois rumos, em graus. Ambos precisam ter comprimento > 0. */
export const angleBetweenDegrees = (a: Vec2, b: Vec2): number => {
  const la = Math.hypot(a.x, a.y);
  const lb = Math.hypot(b.x, b.y);
  if (la <= 0 || lb <= 0) return 180;
  const cos = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / (la * lb)));
  return (Math.acos(cos) * 180) / Math.PI;
};

/**
 * Este inimigo e um alvo VALIDO para aquisicao? A lista inteira das regras do
 * capstone, numa funcao so — e a unica porta pela qual um alvo entra.
 */
export const isAcquirableTarget = (state: SurvivalState, from: Vec2, enemy: Entity): boolean =>
  enemy.kind === 'enemy' &&
  enemy.alive &&
  threatPostureOf(enemy) === 'hostile' &&
  hasVisibleBody(enemy) &&
  distanceTo(from, enemy) <= ACQUIRE_RANGE_TILES &&
  hasLineOfSight(state, from.x, from.y, enemy.x, enemy.y);

/**
 * O alvo valido mais proximo. Empate por distancia e depois por `entity.id`,
 * para duas maquinas (e dois quadros) escolherem SEMPRE o mesmo.
 */
export const acquireTarget = (state: SurvivalState, from: Vec2): Entity | null => {
  let best: Entity | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (!isAcquirableTarget(state, from, enemy)) continue;
    const distance = distanceTo(from, enemy);
    if (
      distance < bestDistance - 1e-9 ||
      (Math.abs(distance - bestDistance) <= 1e-9 && best !== null && enemy.id < best.id)
    ) {
      best = enemy;
      bestDistance = distance;
    }
  }
  return best;
};

/**
 * O alvo valido mais ALINHADO com a mira, dentro de um cone. Desempate por
 * angulo, depois distancia, depois id — o mais perto do rumo ganha, nao o mais
 * perto do corpo.
 */
export const bestTargetInCone = (
  state: SurvivalState,
  from: Vec2,
  aim: Vec2,
  coneDegrees: number,
): Entity | null => {
  let best: Entity | null = null;
  let bestAngle = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (!isAcquirableTarget(state, from, enemy)) continue;
    const angle = angleBetweenDegrees(aim, directionTo(from, enemy));
    if (angle > coneDegrees) continue;
    const distance = distanceTo(from, enemy);
    const better =
      angle < bestAngle - 1e-9 ||
      (Math.abs(angle - bestAngle) <= 1e-9 &&
        (distance < bestDistance - 1e-9 ||
          (Math.abs(distance - bestDistance) <= 1e-9 && best !== null && enemy.id < best.id)));
    if (better) {
      best = enemy;
      bestAngle = angle;
      bestDistance = distance;
    }
  }
  return best;
};

/**
 * IA-05: a memoria de engajamento.
 *
 * Guarda QUEM foi adquirido manualmente e ate QUANDO a aderencia vale. Vive no
 * modulo chamador (uma por run), nunca na simulacao: e estado de assistencia,
 * e a simulacao so ve os comandos que sairam dela.
 */
export class EngagementMemory {
  private targetId: number | null = null;
  private heldUntilTick = 0;

  remember(targetId: number, heldUntilTick: number): void {
    this.targetId = targetId;
    this.heldUntilTick = heldUntilTick;
  }

  heldTarget(tick: number): number | null {
    return tick < this.heldUntilTick ? this.targetId : null;
  }

  get heldUntil(): number {
    return this.heldUntilTick;
  }

  clear(): void {
    this.targetId = null;
    this.heldUntilTick = 0;
  }
}

const setAimTo = (cmd: PlayerCommand, from: Vec2, enemy: Entity): void => {
  cmd.aim = directionTo(from, enemy);
};

/**
 * A camada de assistencia inteira, entre o input e o recorder.
 *
 * Muta o comando CRU antes de `recorder.capture`: o log grava — e o servidor
 * re-simula — o comando ja resolvido. A ordem dos ramos e a regra de
 * prioridade da proposta: mira manual primeiro, aderencia depois, e o comando
 * neutro (IA-X) por ultimo, so quando nenhum vetor manual existe.
 */
export const applyCombatAssist = (
  state: SurvivalState,
  cmd: PlayerCommand,
  aimTap: boolean,
  memory: EngagementMemory,
): void => {
  const combat = combatTuningOf(state.config.tuning);
  const player = state.player;
  if (!player.alive) return;
  const tick = state.tick;
  const manualAim = Math.hypot(cmd.aim.x, cmd.aim.y) > 0.01;

  if (cmd.fire && manualAim) {
    // IA-04 corrige; sem ele, IA-05 ainda ADQUIRE (num cone menor) para ter o
    // que aderir. A aquisicao e sempre manual: a mira do jogador passou perto.
    const acquireCone =
      combat.aimAssistConeDegrees > 0
        ? combat.aimAssistConeDegrees
        : combat.targetMemoryTicks > 0
          ? MEMORY_ACQUIRE_CONE_DEGREES
          : 0;
    const target = acquireCone > 0 ? bestTargetInCone(state, player, cmd.aim, acquireCone) : null;
    if (target) {
      if (combat.aimAssistConeDegrees > 0) setAimTo(cmd, player, target);
      if (combat.targetMemoryTicks > 0) memory.remember(target.id, tick + combat.targetMemoryTicks);
      return;
    }

    if (combat.targetMemoryTicks > 0) {
      const heldId = memory.heldTarget(tick);
      if (heldId === null) return;
      const held = state.enemies.find((enemy) => enemy.id === heldId);
      if (held && isAcquirableTarget(state, player, held)) {
        // Aderencia: a mira que AINDA acompanha o alvo (dentro do cone largo)
        // encosta nele; a que desviou de vez e uma decisao nova do jogador.
        if (angleBetweenDegrees(cmd.aim, directionTo(player, held)) <= STICKINESS_CONE_DEGREES) {
          setAimTo(cmd, player, held);
        } else {
          memory.clear();
        }
        return;
      }
      // O alvo caiu (ou deixou de ser valido) no meio da aderencia: troca para
      // o proximo, HERDANDO a janela restante — a memoria e curta e nao se
      // renova sozinha. "Nao adquire partindo do repouso" continua valendo: so
      // chegamos aqui com o gatilho apertado e uma aquisicao manual previa.
      const next = acquireTarget(state, player);
      if (
        next &&
        angleBetweenDegrees(cmd.aim, directionTo(player, next)) <= STICKINESS_CONE_DEGREES
      ) {
        memory.remember(next.id, memory.heldUntil);
        setAimTo(cmd, player, next);
      } else {
        memory.clear();
      }
    }
    return;
  }

  if (aimTap && !cmd.fire) {
    // IA-X: o comando neutro. Sem o capstone, o tap ja foi consumido e nada
    // acontece — nenhum tiro, nenhum calor. Com ele, resolve contra o alvo
    // valido mais proximo; sem alvo, idem.
    if (!combat.autoAcquire) return;
    const target = acquireTarget(state, player);
    if (!target) return;
    setAimTo(cmd, player, target);
    cmd.fire = true;
  }
};

// ---------------------------------------------------------------------------
// Leitura (IA-01, IA-02, IA-03)
// ---------------------------------------------------------------------------

export type ThreatMark = {
  enemy: Entity;
  posture: ThreatPosture;
  /** O hostil mais proximo — o bracket que acende inteiro. */
  nearest: boolean;
  /** IA-02: ha um ataque telegrafado em windup AGORA. */
  windup: boolean;
};

/**
 * A classificacao do quadro: inimigos com corpo visivel, no alcance e com
 * linha de visao. E a MESMA validade da aquisicao de proposito — o bracket
 * mostra exatamente o conjunto sobre o qual a assistencia pode agir, e um
 * bracket em quem o auto-aim recusaria seria a interface mentindo.
 * Excecao deliberada: passivo e em fuga APARECEM (classificar e o protocolo),
 * so nunca sao alvo.
 */
export const threatMarks = (state: SurvivalState): ThreatMark[] => {
  const player = state.player;
  const marks: ThreatMark[] = [];
  let nearestHostile: Entity | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (!enemy.alive || !hasVisibleBody(enemy)) continue;
    const distance = distanceTo(player, enemy);
    if (distance > ACQUIRE_RANGE_TILES) continue;
    if (!hasLineOfSight(state, player.x, player.y, enemy.x, enemy.y)) continue;
    const posture = threatPostureOf(enemy);
    if (posture === 'hostile' && distance < nearestDistance) {
      nearestHostile = enemy;
      nearestDistance = distance;
    }
    marks.push({
      enemy,
      posture,
      nearest: false,
      windup: enemy.action?.phase === 'windup',
    });
  }
  for (const mark of marks) mark.nearest = mark.enemy === nearestHostile;
  return marks;
};

/**
 * IA-03: a solucao de interceptacao — onde estara o alvo quando o bolt chegar.
 *
 * Resolve o encontro linear classico: |T + v·t − S| = s·t. Devolve null quando
 * o alvo e mais rapido que a solucao (sem raiz positiva) ou quando o encontro
 * cai fora do alcance efetivo — um marcador atras de uma parede de distancia
 * seria promessa vazia.
 */
export const interceptPoint = (
  shooter: Vec2,
  target: Vec2,
  targetVelocity: Vec2,
  projectileSpeed: number,
): Vec2 | null => {
  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const a =
    targetVelocity.x * targetVelocity.x +
    targetVelocity.y * targetVelocity.y -
    projectileSpeed * projectileSpeed;
  const b = 2 * (dx * targetVelocity.x + dy * targetVelocity.y);
  const c = dx * dx + dy * dy;
  let t: number;
  if (Math.abs(a) < 1e-9) {
    if (Math.abs(b) < 1e-9) return null;
    t = -c / b;
  } else {
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const sqrt = Math.sqrt(disc);
    const t1 = (-b - sqrt) / (2 * a);
    const t2 = (-b + sqrt) / (2 * a);
    t = Math.min(
      t1 > 1e-6 ? t1 : Number.POSITIVE_INFINITY,
      t2 > 1e-6 ? t2 : Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(t)) return null;
  }
  if (t <= 1e-6 || t > 2) return null;
  const px = target.x + targetVelocity.x * t;
  const py = target.y + targetVelocity.y * t;
  if (Math.hypot(px - shooter.x, py - shooter.y) > ACQUIRE_RANGE_TILES) return null;
  return { x: px, y: py };
};

/**
 * Estimador de velocidade de alvo, do lado do desenho.
 *
 * A simulacao nao mantem `vx/vy` de inimigo fora de investidas, entao o
 * marcador estima do que VE: posicao por quadro, suavizada. E apresentacao —
 * um erro aqui desenha o losango um tile fora, nunca desvia um tiro.
 */
export class TargetMotion {
  private readonly last = new Map<number, { x: number; y: number; atMs: number }>();
  private readonly velocity = new Map<number, Vec2>();

  observe(state: SurvivalState, nowMs: number): void {
    const seen = new Set<number>();
    for (const enemy of state.enemies) {
      if (!enemy.alive) continue;
      seen.add(enemy.id);
      const prev = this.last.get(enemy.id);
      if (prev) {
        const dt = (nowMs - prev.atMs) / 1000;
        if (dt > 0.01 && dt < 0.5) {
          const vx = (enemy.x - prev.x) / dt;
          const vy = (enemy.y - prev.y) / dt;
          const smoothed = this.velocity.get(enemy.id) ?? { x: vx, y: vy };
          this.velocity.set(enemy.id, {
            x: smoothed.x * 0.6 + vx * 0.4,
            y: smoothed.y * 0.6 + vy * 0.4,
          });
        } else if (dt >= 0.5) {
          this.velocity.delete(enemy.id);
        }
      }
      this.last.set(enemy.id, { x: enemy.x, y: enemy.y, atMs: nowMs });
    }
    for (const id of [...this.last.keys()]) {
      if (!seen.has(id)) {
        this.last.delete(id);
        this.velocity.delete(id);
      }
    }
  }

  velocityOf(id: number): Vec2 {
    return this.velocity.get(id) ?? { x: 0, y: 0 };
  }

  reset(): void {
    this.last.clear();
    this.velocity.clear();
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------
// Canvas puro sobre coordenadas ja projetadas, como no survey-overlay. Os
// valores vem das funcoes acima; aqui nao se decide nada, so se pinta.

const POSTURE_COLOR: Record<ThreatPosture, string> = {
  hostile: '#ff8a5c',
  passive: '#9aa7b3',
  fleeing: '#ffd166',
};

/** A cor da instrumentacao de IA: a mesma familia fria do Levantamento. */
const INSTRUMENT = '#7fd4ff';

const drawBracket = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  half: number,
  z: number,
  color: string,
  alpha: number,
): void => {
  const arm = Math.max(2, half * 0.45);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.2 * z);
  ctx.beginPath();
  for (const [cx, cy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const px = sx + cx * half;
    const py = sy + cy * half * 0.62; // achatado como a projecao 2:1
    ctx.moveTo(px, py - cy * arm * 0.62);
    ctx.lineTo(px, py);
    ctx.lineTo(px - cx * arm, py);
  }
  ctx.stroke();
  ctx.restore();
};

export type CombatSenseDrawContext = {
  ctx: CanvasRenderingContext2D;
  state: SurvivalState;
  combat: CombatTuning;
  z: number;
  nowMs: number;
  motion: TargetMotion;
  toScreen: (x: number, y: number) => [number, number];
};

/** Brackets (IA-01), telegrafo de windup (IA-02) e antecipacao (IA-03). */
export const drawCombatSenseWorld = (draw: CombatSenseDrawContext): void => {
  const { ctx, state, combat, z, nowMs } = draw;
  const marks = threatMarks(state);
  const tuning = state.config.tuning;

  for (const mark of marks) {
    const { enemy } = mark;
    const [sx, sy] = draw.toScreen(enemy.x, enemy.y);
    const bodyY = sy - 7 * z;
    const half = (8 + enemy.radius * 10) * z;

    // IA-01: brackets DISCRETOS. O hostil mais proximo acende inteiro; o resto
    // fica num traco de canto. Postura fala por cor E por intensidade.
    if (combat.threatBrackets) {
      drawBracket(ctx, sx, bodyY, half, z, POSTURE_COLOR[mark.posture], mark.nearest ? 0.85 : 0.32);
    }

    // IA-02: o windup pulsa por cima do bracket — e o instante em que a
    // informacao vale alguma coisa, entao ele NAO e discreto.
    if (combat.intentTelegraph && mark.windup) {
      const pulse = 0.5 + 0.5 * Math.sin(nowMs / 90);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.45 * pulse;
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = Math.max(1, 1.6 * z);
      ctx.beginPath();
      ctx.ellipse(sx, sy, half * 1.15, half * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // IA-03: um marcador de antecipacao, e SO um — o do alvo que a mira
  // persistida esta acompanhando (ou o hostil mais proximo, sem mira clara).
  // Um losango por inimigo viraria chuva de sinal.
  if (combat.interceptMarker) {
    const player = state.player;
    const aim = state.playerExtra.aim;
    const hostiles = marks.filter((mark) => mark.posture === 'hostile');
    let chosen: ThreatMark | null = null;
    let bestAngle = 20;
    for (const mark of hostiles) {
      const angle = angleBetweenDegrees(aim, directionTo(player, mark.enemy));
      if (angle <= bestAngle) {
        bestAngle = angle;
        chosen = mark;
      }
    }
    if (!chosen) chosen = hostiles.find((mark) => mark.nearest) ?? null;
    if (chosen) {
      const velocity = draw.motion.velocityOf(chosen.enemy.id);
      const speed = Math.hypot(velocity.x, velocity.y);
      // Alvo parado nao precisa de antecipacao: o marcador coincidiria com o
      // corpo e so sujaria a leitura.
      if (speed > 0.6) {
        const point = interceptPoint(
          player,
          chosen.enemy,
          velocity,
          BOLT_SPEED * tuning.projectileSpeedScale,
        );
        if (point) {
          const [ix, iy] = draw.toScreen(point.x, point.y);
          const r = 3.4 * z;
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = INSTRUMENT;
          ctx.lineWidth = Math.max(1, 1.2 * z);
          ctx.beginPath();
          ctx.moveTo(ix, iy - r);
          ctx.lineTo(ix + r, iy);
          ctx.lineTo(ix, iy + r);
          ctx.lineTo(ix - r, iy);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }
};
