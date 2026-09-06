// A BARRA DE VIDA DOS CHEFES — selecao, estado visual e desenho.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO EXISTE
// ---------------------------------------------------------------------------
// Ate aqui um chefe de setor tinha a MESMA barra de qualquer criatura: dois
// pixels flutuando sobre a cabeca, do tamanho do corpo, que so apareciam
// depois do primeiro golpe e sumiam junto do corpo — debaixo d'agua, atras de
// uma parede, fora da camera. O Leviata do Lencol e um espreitador tinham a
// mesma linguagem visual, e a HUD nao tinha como dizer "esta criatura domina
// a sala".
//
// Quando o dono do setor desperta, o jogo muda de postura: uma faixa longa
// surge no rodape, com o nome, a moldura e a vida — e fica ali enquanto o
// encontro durar, esteja o corpo onde estiver. A gloria vem da escala, do
// silencio, do tempo e da disciplina: nenhuma cutscene, nenhum letterbox,
// nenhum input bloqueado. A referencia e a dignidade de uma boss bar de
// Souls; a aparencia e Voxelyn — chapas, encaixes, facetas, pixels inteiros.
//
// ---------------------------------------------------------------------------
// TRES CAMADAS, TRES RESPONSABILIDADES
// ---------------------------------------------------------------------------
// 1. SELECAO (`resolveSectorBoss`, `bossHealthBarTarget`, `usesMonumentalBar`)
//    — quem e o chefe e se a barra deve existir. Le `state.sectorBoss`
//    (arquetipo e derrota), `state.bossRuntime.awake` e o corpo vivo em
//    `state.enemies`. Nunca depende de `sectorBoss.entityId`: o espelho online
//    o deixa nulo de proposito, e a resolucao por arquetipo e a mesma que o
//    audio ja usava para os leitos de chefe.
//
// 2. ESTADO VISUAL (`BossHealthBarPresentation`) — o que a barra MOSTRA e o
//    que ela esta ANIMANDO: o HP autoritativo, o eco da ferida, a entrada, a
//    cura, a fase, a morte. E alimentado pelo estado do quadro apresentado
//    (`sync`) e pelos eventos daquele mesmo tick (`ingestEvents`). Nao guarda
//    referencia a entidade nenhuma: copia os numeros de que precisa, porque a
//    morte remove o corpo da lista antes de a barra terminar de contar a
//    historia dele.
//
// 3. DESENHO (`drawBossHealthBar`) — puro sobre uma `BossHealthBarView` e um
//    `BossHealthBarLayout`. Nao le estado, nao decide nada.
//
// ---------------------------------------------------------------------------
// A LINHA DO TEMPO E UMA SO
// ---------------------------------------------------------------------------
// O HP vem do `SurvivalState` que o renderer recebe — no solo e no replay a
// amostra do `LocalPlayout`, no online o `sampleRenderState` do tick
// alcancado. E o mesmo estado que posiciona os corpos, entao a barra nunca
// mistura a vida do snapshot mais novo com o corpo do quadro anterior. Um
// snapshot repetido tem o mesmo HP e nao gera eco; um tick que salta (resync,
// reconexao) faz a barra ENCAIXAR no valor novo sem animar a diferenca como
// se fosse dano.

import {
  DEVOURER_BURROWED,
  leviathanExposure,
  type EnemyArchetype,
  type Entity,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { t, type MessageKey } from './i18n';
import {
  BOSS_BAR_BED,
  BOSS_BAR_ECHO,
  BOSS_BAR_LIFE,
  BOSS_BAR_LIFE_DARK,
  BOSS_BAR_LIFE_LIGHT,
  bossBarAccent,
  bossBarSeed,
  type BossBarAccent,
} from './boss-health-bar-palette';
import type { BossHealthBarLayout } from './boss-health-bar-layout';
import { PAL, hexAlpha, mixHex } from './palette';

// ---------------------------------------------------------------------------
// Selecao
// ---------------------------------------------------------------------------

/**
 * O corpo vivo do dono do setor, ou `null`.
 *
 * Por ARQUETIPO, nunca por `entityId`: o espelho online recebe o dono do
 * setor resolvido pelo servidor e deixa o id nulo. E a mesma pergunta que os
 * leitos de audio fazem, respondida num lugar so.
 */
export const resolveSectorBoss = (state: SurvivalState): Entity | null => {
  const archetype = state.sectorBoss.archetype;
  if (!archetype || state.sectorBoss.defeated) return null;
  return state.enemies.find((e) => e.alive && e.archetype === archetype) ?? null;
};

/**
 * Esta entidade e apresentada pela barra MONUMENTAL — e portanto NAO recebe a
 * barra local flutuante?
 *
 * Vale para o dono do setor enquanto ele nao caiu, acordado ou nao: um chefe
 * dormindo esta cheio (a barra local nem apareceria) e um chefe ferido esta
 * acordado. Elites, minichefes que nao guardam o setor, aliados e o resto do
 * bestiario continuam com a barra local.
 */
export const usesMonumentalBar = (state: SurvivalState, entity: Entity): boolean =>
  entity.kind === 'enemy' &&
  state.sectorBoss.archetype !== null &&
  !state.sectorBoss.defeated &&
  entity.archetype === state.sectorBoss.archetype;

/**
 * O encontro esta ATIVO — a barra deve existir?
 *
 * Acordado e vivo. Um chefe que ja levou dano sem "acordar" (nao existe na
 * simulacao de hoje, mas o estado permite) tambem conta: quem sangra esta em
 * combate. Um chefe dormindo e cheio nao aparece; um chefe derrotado tampouco.
 */
export const bossHealthBarTarget = (state: SurvivalState): Entity | null => {
  const body = resolveSectorBoss(state);
  if (!body) return null;
  if (!state.bossRuntime.awake && body.hp >= body.maxHp) return null;
  return body;
};

/** A chave i18n do nome canonico do chefe. */
export const bossBarNameKey = (archetype: EnemyArchetype | string): MessageKey =>
  `bestiary.name.${archetype}` as MessageKey;

/**
 * O corpo esta completamente INALVEJAVEL agora — submerso, enterrado?
 *
 * So o que a simulacao ja decide: a exposicao do Leviata e a postura
 * enterrada do Devorador. Nada aqui inventa "imune" — a barra apenas ganha um
 * veu material enquanto o corpo nao pode ser ferido.
 */
export const bossBodyVeiled = (entity: Entity, tick: number): boolean => {
  if (entity.archetype === 'sheet_leviathan') return leviathanExposure(entity, tick) < 0.5;
  if (entity.archetype === 'white_devourer') return (entity.mood ?? -1) === DEVOURER_BURROWED;
  return false;
};

/** HP preso a `0..maxHp`. */
export const clampHp = (hp: number, maxHp: number): number =>
  Math.max(0, Math.min(Math.max(0, maxHp), hp));

// ---------------------------------------------------------------------------
// Tempos
// ---------------------------------------------------------------------------

/** A montagem ritual, do primeiro pixel da fissura ao estado estavel. */
export const BOSS_BAR_ENTRY_MS = 800;
/** A entrada SEM ritual (reconexao, chefe ja acordado): um fade curto. */
export const BOSS_BAR_ENTRY_INSTANT_MS = 180;
/** Quanto o eco da ferida segura o valor antigo antes de recuar. */
export const BOSS_BAR_ECHO_HOLD_MS = 240;
/** O recuo do eco: do menor golpe ao maior. */
export const BOSS_BAR_ECHO_RECEDE_MIN_MS = 300;
export const BOSS_BAR_ECHO_RECEDE_MAX_MS = 450;
/** A resposta da moldura a um golpe grande. */
export const BOSS_BAR_HIT_PULSE_MS = 150;
/** A partir de que fracao da vida um golpe e "grande" (moldura, lascas). */
export const BOSS_BAR_BIG_HIT_FRACTION = 0.06;
/** A marca de cura: revela e desvanece. */
export const BOSS_BAR_HEAL_MS = 560;
/** A varredura de fase. */
export const BOSS_BAR_PHASE_MS = 700;
/** A morte: segura o estado final, depois dissolve. */
export const BOSS_BAR_DEATH_HOLD_MS = 1100;
export const BOSS_BAR_DEATH_EXIT_MS = 420;
/** Um tick que salta mais que isto (2 s) e um resync: encaixa, nao anima. */
export const BOSS_BAR_RESYNC_TICK_GAP = 40;
/** O `boss_awake` vale como gatilho do ritual por este tempo. */
const AWAKE_EVENT_WINDOW_MS = 1500;
/** Um corpo sumido sem morte segura a barra por isto antes de limpa-la. */
const ABSENT_GRACE_MS = 250;

// ---------------------------------------------------------------------------
// Estado visual
// ---------------------------------------------------------------------------

type Shown = {
  archetype: string;
  maxHp: number;
  /** HP autoritativo do ultimo quadro sincronizado. */
  hp: number;
  /** O eco da ferida: o valor "antigo" que ainda esta na tela. */
  echo: number;
  hitAt: number;
  receding: boolean;
  recedeFrom: number;
  recedeAt: number;
  recedeMs: number;
  /** Fracao da vida que o ultimo golpe tirou, e um contador para semear lascas. */
  hitStrength: number;
  hitSeq: number;
  enteredAt: number;
  entryMs: number;
  ritual: boolean;
  heal: { from: number; to: number; at: number } | null;
  phases: number;
  phaseAt: number;
  death: { at: number } | null;
  veiled: boolean;
};

export type BossHealthBarView = {
  archetype: string;
  name: string;
  accent: BossBarAccent;
  hpFrac: number;
  echoFrac: number;
  /** Progresso da entrada, 0..1; `ritual` diz se e a montagem ou o fade. */
  entry: { progress: number; ritual: boolean };
  hit: { progress: number; strength: number; seq: number } | null;
  heal: { fromFrac: number; toFrac: number; progress: number } | null;
  /** Progresso da varredura de fase, 0..1, ou null. */
  phase: number | null;
  death: { hold: number; exit: number } | null;
  veiled: boolean;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const easeOutCubic = (p: number): number => 1 - Math.pow(1 - clamp01(p), 3);
const easeInCubic = (p: number): number => Math.pow(clamp01(p), 3);

export class BossHealthBarPresentation {
  private shown: Shown | null = null;
  /** O arquetipo visto DORMINDO neste setor: acordar depois disso e o ritual. */
  private dormant: string | null = null;
  private awakeEventArchetype: string | null = null;
  private awakeEventAt = -1e9;
  private phaseEventAt = -1e9;
  private deathEventArchetype: string | null = null;
  private lastTick = -1;
  private sectorKey = '';
  private absentSince = -1;

  /** Ha algo na tela (inclusive a saida da morte)? */
  get active(): boolean {
    return this.shown !== null;
  }

  /** O chefe apresentado, para testes e para a galeria. */
  get archetype(): string | null {
    return this.shown?.archetype ?? null;
  }

  /** Tudo esquecido: run nova, volta ao menu, troca de sala. */
  reset(): void {
    this.shown = null;
    this.dormant = null;
    this.awakeEventArchetype = null;
    this.awakeEventAt = -1e9;
    this.phaseEventAt = -1e9;
    this.deathEventArchetype = null;
    this.lastTick = -1;
    this.sectorKey = '';
    this.absentSince = -1;
  }

  /**
   * Os eventos do tick apresentado. Eles so MARCAM momentos (o despertar, a
   * virada de fase, a morte); o valor da vida vem sempre de `sync`.
   */
  ingestEvents(events: readonly SemanticEvent[], nowMs: number): void {
    for (const ev of events) {
      if (ev.t === 'boss_awake') {
        this.awakeEventArchetype = ev.archetype ?? null;
        this.awakeEventAt = nowMs;
      } else if (ev.t === 'boss_phase') {
        if (this.shown && this.shown.archetype === ev.archetype && !this.shown.death) {
          this.markPhase(nowMs);
        }
      } else if (ev.t === 'boss_state' && ev.state === 'frenzy') {
        // O FRENESI do Diamandis e uma virada como a fase: o acento atravessa a
        // moldura uma vez e o nome intensifica. Sem efeito de tela inteira.
        if (this.shown && this.shown.archetype === ev.archetype && !this.shown.death) {
          this.shown.phaseAt = nowMs;
          this.phaseEventAt = nowMs;
        }
      } else if (ev.t === 'death') {
        if (this.shown && this.shown.archetype === ev.archetype) {
          this.deathEventArchetype = ev.archetype;
          this.beginDeath(nowMs);
        } else if (ev.archetype) {
          // A morte pode chegar ANTES do quadro em que o corpo some.
          this.deathEventArchetype = ev.archetype;
        }
      }
    }
  }

  /**
   * O estado do quadro APRESENTADO. Chamar uma vez por quadro, antes de `view`.
   */
  sync(state: SurvivalState, nowMs: number): void {
    const sectorKey = `${state.config.seed}:${state.sector}`;
    if (sectorKey !== this.sectorKey) {
      // Setor novo: nada do encontro anterior sobrevive — nem a saida da morte.
      this.shown = null;
      this.dormant = null;
      this.absentSince = -1;
      this.deathEventArchetype = null;
      this.sectorKey = sectorKey;
    }
    const tick = state.tick;
    const resync =
      this.lastTick >= 0 &&
      (tick < this.lastTick || tick - this.lastTick > BOSS_BAR_RESYNC_TICK_GAP);
    this.lastTick = tick;

    const shown = this.shown;
    if (shown?.death) {
      this.stepEcho(shown, nowMs);
      if (nowMs - shown.death.at >= BOSS_BAR_DEATH_HOLD_MS + BOSS_BAR_DEATH_EXIT_MS) {
        this.shown = null;
      }
      return;
    }

    const archetype = state.sectorBoss.archetype;
    if (!archetype) {
      this.shown = null;
      this.dormant = null;
      return;
    }
    if (state.sectorBoss.defeated) {
      if (shown && shown.archetype === archetype) {
        shown.hp = 0;
        this.beginDeath(nowMs);
        this.stepEcho(shown, nowMs);
      } else this.shown = null;
      return;
    }

    const body = resolveSectorBoss(state);
    const target = bossHealthBarTarget(state);

    if (body && !target) {
      // Dormindo, cheio: nao ha barra — mas lembramos que o vimos dormir.
      this.dormant = body.archetype;
      if (shown) this.shown = null; // encontro reiniciado
      return;
    }

    if (target) {
      this.absentSince = -1;
      const maxHp = Math.max(1, target.maxHp);
      const hp = clampHp(target.hp, maxHp);
      if (!shown || shown.archetype !== target.archetype) {
        const ritual =
          this.dormant === target.archetype ||
          (this.awakeEventArchetype === target.archetype &&
            nowMs - this.awakeEventAt < AWAKE_EVENT_WINDOW_MS);
        this.shown = {
          archetype: target.archetype,
          maxHp,
          hp,
          echo: hp,
          hitAt: -1e9,
          receding: false,
          recedeFrom: hp,
          recedeAt: -1e9,
          recedeMs: BOSS_BAR_ECHO_RECEDE_MIN_MS,
          hitStrength: 0,
          hitSeq: 0,
          enteredAt: nowMs,
          entryMs: ritual ? BOSS_BAR_ENTRY_MS : BOSS_BAR_ENTRY_INSTANT_MS,
          ritual,
          heal: null,
          phases: state.bossRuntime.phasesFired,
          phaseAt: -1e9,
          death: null,
          veiled: bossBodyVeiled(target, tick),
        };
        this.dormant = null;
        if (hp <= 0) this.beginDeath(nowMs);
        return;
      }

      shown.maxHp = maxHp;
      if (resync) {
        // Um salto na linha do tempo nao e um golpe nem uma cura: encaixa.
        shown.hp = hp;
        shown.echo = hp;
        shown.receding = false;
        shown.heal = null;
        shown.phases = state.bossRuntime.phasesFired;
      } else if (hp < shown.hp) {
        this.onDamage(shown, hp, nowMs);
      } else if (hp > shown.hp) {
        this.onHeal(shown, hp, nowMs);
      }
      shown.hp = hp;
      const phases = state.bossRuntime.phasesFired;
      if ((phases & ~shown.phases) !== 0) this.markPhase(nowMs);
      shown.phases = phases;
      shown.veiled = bossBodyVeiled(target, tick);
      this.stepEcho(shown, nowMs);
      if (hp <= 0) this.beginDeath(nowMs);
      return;
    }

    // Sem corpo, sem derrota marcada. Ou o golpe fatal ja tirou o corpo da
    // lista (a morte chegou por evento ou a vida ja estava em zero), ou o
    // corpo sumiu sem morrer — e ai a barra some depois de uma folga curta,
    // para um unico quadro sem entidade nao piscar a moldura inteira.
    if (!shown) return;
    if (shown.hp <= 0 || this.deathEventArchetype === shown.archetype) {
      shown.hp = 0;
      this.beginDeath(nowMs);
      this.stepEcho(shown, nowMs);
      return;
    }
    if (this.absentSince < 0) this.absentSince = nowMs;
    else if (nowMs - this.absentSince > ABSENT_GRACE_MS) {
      this.shown = null;
      this.absentSince = -1;
    }
  }

  private onDamage(shown: Shown, hp: number, nowMs: number): void {
    const lost = shown.hp - hp;
    // O eco segura o valor ANTERIOR — ou o que ainda estava recuando de um
    // golpe anterior, se for maior. Nunca sobe alem do que ja estava na tela.
    shown.echo = Math.max(shown.echo, shown.hp);
    shown.hitAt = nowMs;
    shown.receding = false;
    shown.hitStrength = lost / shown.maxHp;
    shown.hitSeq += 1;
    // Cura interrompida por dano: a marca da cura nao tem mais o que marcar.
    shown.heal = null;
  }

  private onHeal(shown: Shown, hp: number, nowMs: number): void {
    // Regeneracao continua (o Bispo) chega em muitos passos pequenos: a marca
    // cresce a partir de onde a cura COMECOU, em vez de piscar um fio por tick.
    const active = shown.heal && nowMs - shown.heal.at < BOSS_BAR_HEAL_MS;
    shown.heal = { from: active && shown.heal ? shown.heal.from : shown.hp, to: hp, at: nowMs };
    // Cura nao deixa eco: o rastro sobe junto.
    if (shown.echo < hp) shown.echo = hp;
  }

  private markPhase(nowMs: number): void {
    if (!this.shown) return;
    // Evento e estado marcam a mesma virada; a segunda marca em meio segundo e
    // a mesma virada chegando pelo outro caminho.
    if (nowMs - this.phaseEventAt < 500) return;
    this.phaseEventAt = nowMs;
    this.shown.phaseAt = nowMs;
  }

  private beginDeath(nowMs: number): void {
    const shown = this.shown;
    if (!shown || shown.death) return;
    shown.hp = 0;
    shown.heal = null;
    shown.death = { at: nowMs };
    if (shown.echo > 0 && !shown.receding) {
      // O golpe fatal e um golpe: o eco segura e recua como qualquer outro.
      shown.hitAt = Math.max(shown.hitAt, nowMs - BOSS_BAR_ECHO_HOLD_MS / 2);
    }
  }

  private stepEcho(shown: Shown, nowMs: number): void {
    if (shown.echo <= shown.hp) {
      shown.echo = shown.hp;
      shown.receding = false;
      return;
    }
    if (nowMs - shown.hitAt < BOSS_BAR_ECHO_HOLD_MS) return;
    if (!shown.receding) {
      shown.receding = true;
      shown.recedeFrom = shown.echo;
      // O recuo comeca quando o HOLD termina, e nao no quadro em que o
      // notamos: duas maquinas de co-op com quadros defasados convergem no
      // mesmo instante, e um quadro atrasado nao atrasa o eco.
      shown.recedeAt = shown.hitAt + BOSS_BAR_ECHO_HOLD_MS;
      const gap = (shown.echo - shown.hp) / shown.maxHp;
      shown.recedeMs = Math.min(
        BOSS_BAR_ECHO_RECEDE_MAX_MS,
        BOSS_BAR_ECHO_RECEDE_MIN_MS + gap * 600,
      );
    }
    const p = easeOutCubic((nowMs - shown.recedeAt) / shown.recedeMs);
    shown.echo = Math.max(shown.hp, shown.recedeFrom + (shown.hp - shown.recedeFrom) * p);
  }

  /** O que desenhar neste quadro, ou null. Puro sobre o estado sincronizado. */
  view(nowMs: number, reducedMotion: boolean): BossHealthBarView | null {
    const s = this.shown;
    if (!s) return null;
    const entryMs = reducedMotion ? BOSS_BAR_ENTRY_INSTANT_MS : s.entryMs;
    const entry = {
      progress: clamp01((nowMs - s.enteredAt) / entryMs),
      ritual: s.ritual && !reducedMotion,
    };
    const hitAge = nowMs - s.hitAt;
    const hit =
      !reducedMotion && hitAge >= 0 && hitAge < BOSS_BAR_HIT_PULSE_MS
        ? { progress: hitAge / BOSS_BAR_HIT_PULSE_MS, strength: s.hitStrength, seq: s.hitSeq }
        : null;
    const heal =
      s.heal && nowMs - s.heal.at < BOSS_BAR_HEAL_MS
        ? {
            fromFrac: s.heal.from / s.maxHp,
            toFrac: s.heal.to / s.maxHp,
            progress: (nowMs - s.heal.at) / BOSS_BAR_HEAL_MS,
          }
        : null;
    const phaseAge = nowMs - s.phaseAt;
    const phase =
      phaseAge >= 0 && phaseAge < BOSS_BAR_PHASE_MS ? phaseAge / BOSS_BAR_PHASE_MS : null;
    const death = s.death
      ? {
          hold: clamp01((nowMs - s.death.at) / BOSS_BAR_DEATH_HOLD_MS),
          exit: clamp01((nowMs - s.death.at - BOSS_BAR_DEATH_HOLD_MS) / BOSS_BAR_DEATH_EXIT_MS),
        }
      : null;
    return {
      archetype: s.archetype,
      name: t(bossBarNameKey(s.archetype)),
      accent: bossBarAccent(s.archetype),
      hpFrac: s.maxHp > 0 ? s.hp / s.maxHp : 0,
      echoFrac: s.maxHp > 0 ? s.echo / s.maxHp : 0,
      entry,
      hit,
      heal,
      phase,
      death,
      veiled: s.veiled,
    };
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/**
 * O DESGASTE da moldura: entalhes assimetricos, semeados pelo arquetipo.
 * Calculado uma vez por chefe e guardado — o padrao nao muda de quadro para
 * quadro, e reconstrui-lo a 60 Hz seria pagar por ruido.
 */
type Wear = Array<{ u: number; edge: 0 | 1; w: number }>;
const wearCache = new Map<string, Wear>();
const wearFor = (archetype: string): Wear => {
  const cached = wearCache.get(archetype);
  if (cached) return cached;
  let seed = bossBarSeed(archetype) || 1;
  const rnd = (): number => {
    seed ^= seed << 13;
    seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    seed >>>= 0;
    return seed / 0xffffffff;
  };
  const wear: Wear = [];
  const count = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < count; i++) {
    wear.push({ u: 0.06 + rnd() * 0.88, edge: rnd() < 0.5 ? 0 : 1, w: 1 + Math.floor(rnd() * 3) });
  }
  wearCache.set(archetype, wear);
  return wear;
};

/** Avanco de um caractere por fonte, medido uma vez (o nome e monoespacado). */
const advanceCache = new Map<string, number>();

const NAME_COLOR = mixHex(PAL.bone, PAL.player, 0.45);
const NAME_SHADOW = hexAlpha(PAL.dark, 0.85);
const TOP_SHEEN = 'rgba(255,255,255,0.10)';

export type BossHealthBarDrawOptions = {
  reducedMotion: boolean;
  /** A familia tipografica da HUD; a padrao e a monoespacada do jogo. */
  fontFamily?: string;
};

/**
 * Desenha a barra. Todas as coordenadas finais sao inteiras: a peca e um
 * arranjo de retangulos de pixel, e meio pixel em qualquer um deles borra a
 * moldura inteira.
 */
export const drawBossHealthBar = (
  ctx: CanvasRenderingContext2D,
  layout: BossHealthBarLayout,
  view: BossHealthBarView,
  options: BossHealthBarDrawOptions,
): void => {
  if (!layout.visible) return;
  const { frame, bed, endCap, ornament } = layout;
  const acc = view.accent;
  const font = options.fontFamily ?? 'monospace';
  const reduced = options.reducedMotion;

  const death = view.death;
  const entryP = view.entry.progress;
  const ritual = view.entry.ritual && entryP < 1;

  // O alfa GLOBAL da peca: o fade da entrada sem ritual e o afundar da morte.
  // Na postura discreta (paisagem de toque) a peca inteira e atenuada: ela
  // informa sem pedir o olhar.
  let alpha = (view.entry.ritual ? 1 : entryP) * (layout.quiet ? 0.8 : 1);
  if (death) alpha *= 1 - easeInCubic(death.exit);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Etapas do ritual, em fracoes do progresso.
  const fissure = ritual ? clamp01(entryP / 0.18) : 1;
  const assembly = ritual ? clamp01((entryP - 0.18) / 0.32) : 1;
  const nameAlpha = ritual ? easeOutCubic((entryP - 0.4) / 0.25) : 1;
  const reveal = ritual ? easeOutCubic((entryP - 0.5) / 0.35) : 1;
  const pulse = ritual ? clamp01((entryP - 0.8) / 0.2) : entryP >= 1 ? 1 : 0;

  // A FISSURA: um fio escuro no centro, crescendo para os lados.
  if (ritual && assembly <= 0) {
    const w = Math.max(2, Math.round(frame.width * easeOutCubic(fissure)));
    const x = Math.round(frame.x + (frame.width - w) / 2);
    const y = bed.y + Math.floor(bed.height / 2);
    ctx.fillStyle = acc.frameDark;
    ctx.fillRect(x, y, w, 1);
    ctx.restore();
    return;
  }

  // A MONTAGEM: a moldura sobe em degraus de 2 px a partir do fio central.
  const fullH = frame.height;
  const stepH = ritual
    ? Math.max(2, Math.min(fullH, 2 * Math.ceil((fullH * assembly) / 2)))
    : fullH;
  const frameTop = frame.y + Math.floor((fullH - stepH) / 2);
  const frameBottom = frameTop + stepH;
  // Na morte a moldura ENCOLHE para o centro e perde as pontas.
  let frameX = frame.x;
  let frameW = frame.width;
  if (death && death.exit > 0) {
    const keep = 1 - easeInCubic(death.exit);
    frameW = Math.max(2, Math.round(frame.width * keep));
    frameX = Math.round(frame.x + (frame.width - frameW) / 2);
  }
  // A CONTRACAO de um golpe grande: um pixel para dentro, no primeiro terco.
  const bigHit = view.hit && view.hit.strength >= BOSS_BAR_BIG_HIT_FRACTION;
  const contract = bigHit && view.hit && view.hit.progress < 0.35 && !reduced ? 1 : 0;

  ctx.save();
  if (frameW < frame.width) {
    ctx.beginPath();
    ctx.rect(frameX - endCap - 2, layout.y - 2, frameW + endCap * 2 + 4, layout.height + 4);
    ctx.clip();
  }

  const frameAlpha = view.veiled ? 0.78 : 1;
  ctx.globalAlpha = alpha * frameAlpha;

  // Contorno escuro, moldura, faces.
  ctx.fillStyle = hexAlpha(PAL.dark, 0.92);
  ctx.fillRect(
    frameX - 1 + contract,
    frameTop - 1 + contract,
    frameW + 2 - contract * 2,
    stepH + 2 - contract * 2,
  );
  ctx.fillStyle = acc.frame;
  ctx.fillRect(frameX + contract, frameTop + contract, frameW - contract * 2, stepH - contract * 2);
  // Face de cima clara, face de baixo e direita escuras: chapa iluminada de cima.
  ctx.fillStyle = acc.frameLight;
  ctx.fillRect(frameX + contract, frameTop + contract, frameW - contract * 2, 1);
  ctx.fillRect(frameX + contract, frameTop + contract, 1, stepH - contract * 2);
  ctx.fillStyle = acc.frameDark;
  ctx.fillRect(frameX + contract, frameBottom - 1 - contract, frameW - contract * 2, 1);
  ctx.fillRect(frameX + frameW - 1 - contract, frameTop + contract, 1, stepH - contract * 2);
  // A linha de brilho muito discreta, so quando a moldura esta inteira.
  if (stepH >= fullH && ornament !== 'none') {
    ctx.fillStyle = TOP_SHEEN;
    ctx.fillRect(frameX + 2, frameTop + 1, Math.max(0, frameW - 4), 1);
  }
  // O desgaste: entalhes assimetricos nas arestas.
  if (ornament !== 'none' && stepH >= fullH) {
    ctx.fillStyle = acc.frameDark;
    for (const n of wearFor(view.archetype)) {
      const x = Math.round(frameX + n.u * frameW);
      if (x + n.w > frameX + frameW - 1) continue;
      ctx.fillRect(x, n.edge === 0 ? frameTop : frameBottom - 1, n.w, 1);
    }
  }
  // A morte RACHA a moldura: entalhes a mais, crescendo com a espera.
  if (death && death.hold > 0.45 && ornament !== 'none') {
    const cracks = Math.floor(((death.hold - 0.45) / 0.55) * 7);
    ctx.fillStyle = hexAlpha(PAL.dark, 0.9);
    for (let i = 0; i < cracks; i++) {
      const u = ((i * 0.37 + 0.11) % 1) * 0.9 + 0.05;
      const x = Math.round(frameX + u * frameW);
      ctx.fillRect(x, i % 2 === 0 ? frameTop : frameBottom - 2, 1, 2);
    }
  }

  // AS TERMINACOES: chapa, degrau e ponta — encaixes de suporte, nao filigrana.
  if (endCap > 0 && (assembly >= 0.7 || !ritual)) {
    // Na morte as pontas perdem pixels: a chapa vai primeiro, o degrau depois.
    const lost = death ? Math.floor(clamp01((death.hold - 0.55) / 0.45) * 3) : 0;
    drawEndCap(ctx, acc, frameX, frameTop, stepH, endCap, -1, lost, pulse);
    drawEndCap(ctx, acc, frameX + frameW, frameTop, stepH, endCap, 1, lost, pulse);
  }

  // O LEITO.
  const bedX = frameX + layout.framePad.x;
  const bedW = Math.max(0, frameW - layout.framePad.x * 2);
  const bedY = Math.max(bed.y, frameTop + layout.framePad.y);
  const bedH = Math.max(0, Math.min(bed.y + bed.height, frameBottom - layout.framePad.y) - bedY);
  if (bedW > 0 && bedH > 0) {
    ctx.fillStyle = BOSS_BAR_BED;
    ctx.fillRect(bedX, bedY, bedW, bedH);
  }

  // A VIDA e o ECO, sob a mascara da revelacao.
  if (reveal > 0 && bedW > 0 && bedH > 0) {
    const revealW = Math.round(bedW * reveal);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bedX, bedY, revealW, bedH);
    ctx.clip();
    ctx.globalAlpha = alpha;

    const lifeW = view.hpFrac > 0 ? Math.max(1, Math.round(bedW * clamp01(view.hpFrac))) : 0;
    const echoW = Math.round(bedW * clamp01(view.echoFrac));
    if (echoW > lifeW) {
      ctx.fillStyle = BOSS_BAR_ECHO;
      ctx.fillRect(bedX + lifeW, bedY, echoW - lifeW, bedH);
      ctx.fillStyle = mixHex(BOSS_BAR_ECHO, '#ffffff', 0.12);
      ctx.fillRect(bedX + lifeW, bedY, echoW - lifeW, 1);
    }
    if (lifeW > 0) {
      ctx.fillStyle = BOSS_BAR_LIFE;
      ctx.fillRect(bedX, bedY, lifeW, bedH);
      const facet = bedH >= 12 ? 2 : 1;
      ctx.fillStyle = BOSS_BAR_LIFE_LIGHT;
      ctx.fillRect(bedX, bedY, lifeW, facet);
      ctx.fillStyle = BOSS_BAR_LIFE_DARK;
      ctx.fillRect(bedX, bedY + bedH - facet, lifeW, facet);
      // Facetas: uma coluna escura a cada 8 px, a grade que da o voxel sem
      // quebrar o comprimento em quadradinhos. A postura discreta as dispensa:
      // numa vida de 7 px elas virariam textura.
      if (!layout.quiet) {
        ctx.fillStyle = hexAlpha(BOSS_BAR_LIFE_DARK, 0.45);
        for (let x = bedX + 8; x < bedX + lifeW - 1; x += 8)
          ctx.fillRect(x, bedY + facet, 1, bedH - facet * 2);
      }
      // A ponta: um pixel mais claro onde a vida termina.
      ctx.fillStyle = BOSS_BAR_LIFE_LIGHT;
      ctx.fillRect(bedX + lifeW - 1, bedY, 1, bedH);
    }

    // A CURA: a area recuperada, revelada de onde a cura comecou ate onde
    // chegou — o sentido oposto ao do dano — e desvanecendo.
    if (view.heal) {
      const h = view.heal;
      const fromX = bedX + Math.round(bedW * clamp01(h.fromFrac));
      const toX = bedX + Math.round(bedW * clamp01(h.toFrac));
      if (toX > fromX) {
        const grow = reduced ? 1 : easeOutCubic(h.progress / 0.4);
        const fade = 1 - easeInCubic((h.progress - 0.35) / 0.65);
        const w = Math.max(1, Math.round((toX - fromX) * grow));
        ctx.fillStyle = hexAlpha(acc.glow, 0.5 * fade);
        ctx.fillRect(fromX, bedY, w, bedH);
        ctx.fillStyle = hexAlpha(PAL.player, 0.9 * fade);
        ctx.fillRect(fromX + w - 1, bedY, 1, bedH);
      }
    }

    // O GOLPE: um clarao contido na ponta da vida e, se for grande, lascas.
    if (view.hit && !reduced) {
      const hp = view.hit.progress;
      const fade = 1 - hp;
      ctx.fillStyle = hexAlpha(mixHex(BOSS_BAR_LIFE_LIGHT, '#ffffff', 0.5), 0.8 * fade);
      ctx.fillRect(bedX + Math.max(0, lifeW - 1), bedY, 2, bedH);
      if (bigHit) {
        const drop = Math.round(hp * 6);
        for (let i = 0; i < 3; i++) {
          const dx = ((view.hit.seq * 7 + i * 5) % 9) - 4;
          const dy = ((view.hit.seq * 3 + i * 4) % 5) - 2;
          ctx.fillStyle = hexAlpha(BOSS_BAR_ECHO, 0.9 * fade);
          ctx.fillRect(bedX + lifeW + dx * 2, bedY + dy + drop, 2, 2);
        }
      }
    }

    // O VEU: o corpo esta inalvejavel; a vida continua ali, atras de agua ou areia.
    if (view.veiled) {
      ctx.fillStyle = hexAlpha(mixHex(acc.accent, PAL.dark, 0.55), 0.42);
      ctx.fillRect(bedX, bedY, bedW, bedH);
      ctx.fillStyle = hexAlpha(acc.accent, 0.35);
      for (let x = bedX; x < bedX + bedW; x += 6) ctx.fillRect(x, bedY, 3, 1);
    }
    ctx.restore();
  }

  // A VARREDURA DE FASE: um segmento claro atravessa a moldura uma vez.
  if (view.phase !== null && !reduced && stepH >= fullH) {
    const p = easeOutCubic(view.phase);
    const segW = 12;
    const x = Math.round(frameX - segW + (frameW + segW) * p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(frameX, frameTop, frameW, stepH);
    ctx.clip();
    ctx.fillStyle = hexAlpha(acc.glow, 0.9 * (1 - view.phase * 0.5));
    ctx.fillRect(x, frameTop, segW, 1);
    ctx.fillRect(x, frameBottom - 1, segW, 1);
    ctx.restore();
  }

  // O PULSO DE ENTRADA: o acento acende uma vez ao longo da linha de cima.
  if (ritual && pulse > 0 && pulse < 1) {
    ctx.fillStyle = hexAlpha(acc.glow, 0.6 * Math.sin(pulse * Math.PI));
    ctx.fillRect(frameX, frameTop, frameW, 1);
  }
  ctx.restore();

  // O NOME, em caixa alta, alinhado ao inicio do leito.
  if (nameAlpha > 0 && !(death && death.exit > 0.5)) {
    const nameFade = death ? 1 - easeInCubic(clamp01(death.exit / 0.5)) : 1;
    ctx.globalAlpha = alpha * nameAlpha * nameFade;
    const intensify = view.phase !== null ? Math.sin(clamp01(view.phase) * Math.PI) : 0;
    const base = layout.quiet ? mixHex(NAME_COLOR, PAL.bone, 0.6) : NAME_COLOR;
    const color = intensify > 0 ? mixHex(base, acc.glow, intensify * 0.6) : base;
    drawSpacedName(ctx, view.name, layout, font, color);

    // O ACENTO MATERIAL sob o nome: apaga na morte, acende no pulso.
    const accentOff = death ? easeInCubic(clamp01((death.hold - 0.35) / 0.3)) : 0;
    if (accentOff < 1) {
      const a = layout.accent;
      const glow = ritual ? Math.sin(pulse * Math.PI) : view.phase !== null ? intensify : 0;
      ctx.globalAlpha = alpha * nameAlpha * (1 - accentOff);
      ctx.fillStyle = glow > 0 ? mixHex(acc.accent, acc.glow, glow) : acc.accent;
      ctx.fillRect(a.x, a.y, a.width, a.height);
      ctx.fillStyle = acc.frameDark;
      ctx.fillRect(a.x + a.width, a.y, 1, a.height);
    }
  }

  ctx.restore();
};

const drawEndCap = (
  ctx: CanvasRenderingContext2D,
  acc: BossBarAccent,
  edgeX: number,
  top: number,
  h: number,
  cap: number,
  dir: -1 | 1,
  lost: number,
  pulse: number,
): void => {
  // `edgeX` e a borda da moldura; a terminacao cresce para fora dela.
  const plateW = 2;
  const plateX = dir < 0 ? edgeX - plateW : edgeX;
  if (lost < 3) {
    // A chapa: 2 px, um pixel mais alta que a moldura em cima e embaixo.
    ctx.fillStyle = acc.frameLight;
    ctx.fillRect(plateX, top - 1, plateW, h + 2);
    ctx.fillStyle = acc.frameDark;
    ctx.fillRect(plateX, top + h, plateW, 1);
  }
  if (cap >= 4 && lost < 2) {
    // O degrau: 2 px, dois tercos da altura, centrado.
    const stepH = Math.max(2, 2 * Math.round((h * 0.66) / 2));
    const stepY = top + Math.floor((h - stepH) / 2);
    const stepX = dir < 0 ? plateX - 2 : plateX + plateW;
    ctx.fillStyle = acc.frame;
    ctx.fillRect(stepX, stepY, 2, stepH);
    ctx.fillStyle = acc.frameDark;
    ctx.fillRect(stepX, stepY + stepH - 1, 2, 1);
  }
  if (cap >= 6 && lost < 1) {
    // A ponta: 2 px, um terco da altura — o encaixe do suporte.
    const tipH = Math.max(2, 2 * Math.round((h * 0.34) / 2));
    const tipY = top + Math.floor((h - tipH) / 2);
    const tipX = dir < 0 ? plateX - 4 : plateX + plateW + 2;
    ctx.fillStyle = acc.frameDark;
    ctx.fillRect(tipX, tipY, 2, tipH);
  }
  if (lost < 3) {
    // O chip de acento no topo da chapa: a unica cor de bioma na moldura.
    ctx.fillStyle =
      pulse > 0 && pulse < 1 ? mixHex(acc.accent, acc.glow, Math.sin(pulse * Math.PI)) : acc.accent;
    ctx.fillRect(plateX, top - 1, plateW, 2);
  }
};

/**
 * O nome em caixa alta, caractere a caractere, com espacamento inteiro. A
 * fonte e monoespacada, entao o avanco e medido uma vez por fonte e guardado.
 */
const drawSpacedName = (
  ctx: CanvasRenderingContext2D,
  name: string,
  layout: BossHealthBarLayout,
  fontFamily: string,
  color: string,
): void => {
  const fontPx = layout.name.fontPx;
  const fontSpec = `bold ${fontPx}px ${fontFamily}`;
  ctx.font = fontSpec;
  let advance = advanceCache.get(fontSpec);
  if (advance === undefined) {
    advance = Math.max(1, Math.round(ctx.measureText('M').width));
    advanceCache.set(fontSpec, advance);
  }
  const spacing = fontPx >= 16 ? 2 : 1;
  const text = name.toUpperCase();
  const step = advance + spacing;
  // Nunca vaza o leito: corta com um travessao, que e o mesmo recurso da HUD.
  const maxChars = Math.max(1, Math.floor(layout.name.maxWidth / step));
  const shown = text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}—` : text;
  let x = layout.name.x;
  const y = layout.name.baseline;
  for (const ch of shown) {
    if (ch !== ' ') {
      ctx.fillStyle = NAME_SHADOW;
      ctx.fillText(ch, x + 1, y + 1);
      ctx.fillStyle = color;
      ctx.fillText(ch, x, y);
    }
    x += step;
  }
};
