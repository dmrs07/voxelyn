import { HEAT_MAX, TICK_HZ, type Entity, type EntityActionKind, type SemanticEvent, type SurvivalState } from '@voxelyn/survival-sim';
import { FacingHysteresis } from './facing';
import type { EntityAnimState, LayeredPlayerAnimation, SpriteAnimationSelection } from './sprites';

/**
 * Camadas de rumo que uma entidade desenha ao mesmo tempo. As pernas seguem o
 * andar; o tronco segue o TIRO, e so enquanto ele dura. Cada uma precisa da
 * propria histerese nesse intervalo, senao a de baixo puxaria a de cima para o
 * quadrante dela no meio do disparo.
 */
const FACING_BODY = 0;
const FACING_UPPER = 1;

/** Resolve o rumo de uma camada em um vetor estavel de quadrante. */
type FacingResolver = (layer: number, x: number, y: number) => { x: number; y: number };

export type PresentedAnimation = {
  anim: SpriteAnimationSelection;
  elapsedMs: number;
  facingX: number;
  facingY: number;
};

export type DeathTombstone = {
  entity: number;
  archetype: string;
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  startedMs: number;
  expiresMs: number;
};

type ActionIntent = {
  action: EntityActionKind;
  startTick: number;
  releaseTick: number;
  endTick: number;
  dx: number;
  dy: number;
};

type ActionVisualClock = {
  startTick: number;
  startedMs: number;
};

export const actionAnimation = (action: EntityActionKind): string => {
  // `special` e a pose de PREPARO — o pod inchando, o corpo recuando para a
  // investida, a coroa abrindo. `haul` pertence a esta familia: no atlas do
  // Coveiro o `special` e a carga do eletroima (bobinas acesas, campo visivel)
  // e o `attack` e a prensa. Sem esta linha, o telegrafo de 1,1 s do puxao
  // mostrava o BRACO ERRADO se movendo — o aviso mais importante do bicho
  // apontando para o golpe seguinte em vez de para o que estava acontecendo.
  if (
    action === 'detonate' ||
    action === 'charge' ||
    action === 'pulse' ||
    action === 'hurl' ||
    action === 'haul'
  ) {
    return 'special';
  }
  return 'attack';
};

const actionElapsedMs = (action: ActionIntent, tick: number): number =>
  Math.max(0, ((tick - action.startTick) / TICK_HZ) * 1000);

/**
 * Resolve a direção visual de locomoção sem cair no DR implícito de
 * `dirFromFacing(0, 0)`. Durante walk, o deslocamento observado é a fonte de
 * verdade; fora dele, preservamos o facing autoritativo da entidade.
 */
export const locomotionFacing = (
  base: EntityAnimState,
  fallbackX: number,
  fallbackY: number
): { x: number; y: number } => {
  const hasMoveFacing = Math.hypot(base.moveFacingX, base.moveFacingY) > 0.001;
  if (base.anim === 'walk' && hasMoveFacing) {
    return { x: base.moveFacingX, y: base.moveFacingY };
  }
  return { x: fallbackX, y: fallbackY };
};

/**
 * Recoil visual curto e desacoplado da simulação. Ele nasce no release do
 * ataque e volta rapidamente a zero usando ease-out quadrático.
 */
export const recoilAtElapsed = (elapsedMs: number, releaseMs: number, durationMs = 120): number => {
  const age = elapsedMs - releaseMs;
  if (age < 0 || age >= durationMs) return 0;
  const t = age / durationMs;
  return (1 - t) * (1 - t);
};

/**
 * Calor do cano deste Prospector, normalizado.
 *
 * Sai do MESMO campo que trava o gatilho na simulacao. Um contador proprio no
 * cliente — "quantos tiros saíram" — divergiria do que a mecanica faz na
 * primeira vez que o decaimento por tick nao batesse com a taxa de quadros, e o
 * jogador aprenderia a ler um cano que mente sobre quando vai travar.
 *
 * O parceiro remoto nao transmite calor no snapshot: `heat` fica em 0 e a arma
 * dele sai fria. E o silencio certo — inventar calor para o outro seria desenhar
 * um estado que ninguem mediu.
 */
const gunHeatOf = (entity: Entity, state: SurvivalState): { heat: number; overheated: boolean } => {
  const slot = entity.slot;
  const extra = slot === undefined ? undefined : state.playerExtras?.[slot];
  if (!extra) return { heat: 0, overheated: false };
  return {
    heat: Math.max(0, Math.min(1, extra.heat / HEAT_MAX)),
    overheated: state.tick < extra.overheatedUntil,
  };
};

/**
 * Composicao do Prospector: pernas, tronco e arma como camadas independentes.
 *
 * `action` ausente e o repouso — o tronco fica em `idle` apontado para a mira e
 * nao ha coice. Ele existe porque a composicao deixou de ser o caminho do tiro e
 * passou a ser o caminho PADRAO: enquanto so o disparo era composto, o cano
 * quente sumia da tela assim que o jogador soltava o gatilho, e o calor dura
 * segundos contra os sete ticks da janela da acao. So a composicao separa a arma
 * do corpo, e sem ela nao ha o que pintar.
 */
const layeredPlayerAnimation = (
  entity: Entity,
  base: EntityAnimState,
  action: ActionIntent | null,
  upperElapsedMs: number,
  nowMs: number,
  facing: FacingResolver,
  gun: { heat: number; overheated: boolean }
): LayeredPlayerAnimation => {
  const releaseMs = action
    ? Math.max(0, ((action.releaseTick - action.startTick) / TICK_HZ) * 1000)
    : 0;
  const walking = base.anim === 'walk';
  const raw = locomotionFacing(base, entity.facing.x, entity.facing.y);
  const lowerFacing = facing(FACING_BODY, raw.x, raw.y);
  // Fora do disparo o tronco acompanha as PERNAS.
  //
  // Ele ja seguiu a mira o tempo todo, e o corpo saia torcido a cada quadro em
  // que o cursor estava num quadrante e o andar em outro — o que, com mira de
  // mouse, e quase sempre. A mira so precisa mandar no tronco quando ela vira
  // TIRO: e o disparo que o jogador precisa ver alinhado com o cano, e ele tem
  // direcao propria (`action.dx/dy`), medida no instante em que a acao comecou.
  //
  // Em repouso `locomotionFacing` ja devolve `entity.facing` — a mira —, entao
  // parado o bot continua encarando para onde vai atirar.
  //
  // Fora do tiro o tronco COPIA o rumo ja estabilizado das pernas, em vez de
  // resolver o mesmo vetor de novo na histerese dele. As duas camadas guardam
  // quadrantes separados de proposito, e resolver duas vezes deixaria as duas
  // memorias decidirem sozinhas em cima da fronteira — que e exatamente onde
  // W, A, S e D sozinhos caem. O bot andaria para cima com as pernas em `ul` e o
  // tronco em `ur`, torcido, e ficaria assim enquanto a tecla estivesse presa.
  // O sopro canalizado e a excecao da excecao: a acao dura segundos e o jogador
  // REDIRECIONA o jato durante ela, entao o tronco segue a mira VIVA
  // (`entity.facing`, que a sim atualiza por tick) e nao o rumo congelado no
  // instante do cast — congela-lo faria o corpo apontar para um lado enquanto a
  // chama sai pelo outro.
  const upperFacing = action
    ? action.action === 'breath'
      ? facing(FACING_UPPER, entity.facing.x, entity.facing.y)
      : facing(FACING_UPPER, action.dx, action.dy)
    : lowerFacing;

  return {
    kind: 'layered-player',
    lower: {
      animation: walking ? 'walk' : 'idle',
      elapsedMs: nowMs - base.animStartMs,
      facingX: lowerFacing.x,
      facingY: lowerFacing.y,
    },
    upper: {
      animation: action ? actionAnimation(action.action) : 'idle',
      elapsedMs: upperElapsedMs,
      facingX: upperFacing.x,
      facingY: upperFacing.y,
    },
    recoil: action ? recoilAtElapsed(upperElapsedMs, releaseMs) : 0,
    heat: gun.heat,
    overheated: gun.overheated,
  };
};

/** Client-side visual state that never feeds back into the authoritative simulation. */
export class EntityPresentation {
  private readonly actions = new Map<number, ActionIntent>();
  private readonly actionVisualClocks = new Map<number, ActionVisualClock>();
  private readonly downedAt = new Map<number, number>();
  private readonly reviveUntil = new Map<number, { startMs: number; endMs: number }>();
  private readonly tombstonesById = new Map<number, DeathTombstone>();
  private readonly facingHysteresis = new FacingHysteresis();

  reset(): void {
    this.actions.clear();
    this.actionVisualClocks.clear();
    this.downedAt.clear();
    this.reviveUntil.clear();
    this.tombstonesById.clear();
    this.facingHysteresis.clear();
  }

  /**
   * Rumo ESTAVEL de uma camada desta entidade.
   *
   * Toda saida de `animationFor` passa por aqui de proposito: o quadrante do
   * sprite tem de ser decidido num lugar so. Fosse aplicado apenas no caminho
   * que hoje pisca, a proxima pose a nascer entraria sem protecao — e o rumo
   * cru continuaria vazando para o desenho quando a entidade trocasse de pose.
   */
  private facingFor(entity: Entity, layer: number, x: number, y: number, nowMs: number): { x: number; y: number } {
    return this.facingHysteresis.resolve(entity.id * 2 + layer, x, y, nowMs);
  }

  ingest(events: readonly SemanticEvent[], nowMs: number): void {
    for (const event of events) {
      if (event.t === 'action_start') {
        this.actions.set(event.entity, {
          action: event.action,
          startTick: event.startTick,
          releaseTick: event.releaseTick,
          endTick: event.endTick,
          dx: event.dx,
          dy: event.dy,
        });
        // Uma nova ação com outro startTick receberá um relógio novo na primeira
        // renderização, ancorado ao elapsed autoritativo daquele instante.
        const clock = this.actionVisualClocks.get(event.entity);
        if (clock && clock.startTick !== event.startTick) this.actionVisualClocks.delete(event.entity);
      } else if (event.t === 'action_end') {
        // A simulação cancelou a ação antes do endTick prometido (canal de
        // sopro interrompido por stun, queda ou troca no poço). Sem apagar o
        // intent aqui, um jogador reerguido RETOMAVA a pose de sopro — o
        // player_down preserva intents de propósito, e o prazo original ainda
        // não venceu.
        this.actions.delete(event.entity);
        this.actionVisualClocks.delete(event.entity);
      } else if (event.t === 'player_down') {
        this.downedAt.set(event.slot + 1, nowMs);
      } else if (event.t === 'revive') {
        const id = event.slot + 1;
        this.downedAt.delete(id);
        this.reviveUntil.set(id, { startMs: nowMs, endMs: nowMs + 750 });
      } else if (event.t === 'death') {
        this.actions.delete(event.entity);
        this.actionVisualClocks.delete(event.entity);
        this.downedAt.delete(event.entity);
        this.reviveUntil.delete(event.entity);
        this.facingHysteresis.forget(event.entity * 2 + FACING_BODY);
        this.facingHysteresis.forget(event.entity * 2 + FACING_UPPER);
        this.tombstonesById.set(event.entity, {
          entity: event.entity,
          archetype: event.archetype,
          x: event.x,
          y: event.y,
          facingX: event.facingX,
          facingY: event.facingY,
          startedMs: nowMs,
          expiresMs: nowMs + 650,
        });
      }
    }
  }

  private visualActionElapsed(entityId: number, action: ActionIntent, tick: number, nowMs: number): number {
    const authoritativeElapsed = actionElapsedMs(action, tick);
    let clock = this.actionVisualClocks.get(entityId);
    if (!clock || clock.startTick !== action.startTick) {
      clock = { startTick: action.startTick, startedMs: nowMs - authoritativeElapsed };
      this.actionVisualClocks.set(entityId, clock);
    }
    // O tick continua como piso autoritativo, enquanto nowMs avança a pose e o
    // recoil nos frames intermediários de renderização.
    return Math.max(authoritativeElapsed, nowMs - clock.startedMs);
  }

  animationFor(
    entity: Entity,
    state: SurvivalState,
    base: EntityAnimState,
    nowMs: number,
    downed = false
  ): PresentedAnimation {
    // Resolvido no ponto de SAIDA, nunca antes: cada camada so pode ser gravada
    // uma vez por quadro, com o vetor que de fato vai ser desenhado. Resolver o
    // rumo da mira aqui em cima e o do andar la embaixo faria as duas fontes
    // disputarem a mesma memoria de quadrante, quadro sim, quadro nao.
    const facing: FacingResolver = (layer, x, y) => this.facingFor(entity, layer, x, y, nowMs);
    const bodyFacing = (): { x: number; y: number } =>
      facing(FACING_BODY, entity.facing.x, entity.facing.y);

    const revive = this.reviveUntil.get(entity.id);
    if (revive) {
      if (nowMs < revive.endMs) {
        const aim = bodyFacing();
        return { anim: 'revive', elapsedMs: nowMs - revive.startMs, facingX: aim.x, facingY: aim.y };
      }
      this.reviveUntil.delete(entity.id);
    }

    if (downed) {
      const start = this.downedAt.get(entity.id) ?? nowMs;
      this.downedAt.set(entity.id, start);
      const aim = bodyFacing();
      return { anim: 'downed', elapsedMs: nowMs - start, facingX: aim.x, facingY: aim.y };
    }
    this.downedAt.delete(entity.id);

    // Morte sempre substitui a silhueta inteira. Hit só interrompe a composição
    // do Prospector; inimigos mantêm telegraphs de ações que a sim não cancelou.
    if (base.anim === 'die') {
      const aim = bodyFacing();
      return {
        anim: base.anim,
        elapsedMs: nowMs - base.animStartMs,
        facingX: aim.x,
        facingY: aim.y,
      };
    }

    const authoritative = entity.action;
    // Alguns controles, como Conductive, cancelam a ação na simulação; outros
    // estados de stun legados podem preservá-la. Só apaga o intent visual quando
    // o snapshot confirma que a ação autoritativa realmente desapareceu.
    if (entity.stunnedUntil > state.tick && !authoritative) {
      this.actions.delete(entity.id);
      this.actionVisualClocks.delete(entity.id);
      const aim = bodyFacing();
      return {
        anim: 'idle',
        elapsedMs: 0,
        facingX: aim.x,
        facingY: aim.y,
      };
    }

    const eventIntent = this.actions.get(entity.id);
    const action: ActionIntent | undefined = authoritative
      ? {
          action: authoritative.kind,
          startTick: authoritative.startedAt,
          releaseTick: authoritative.releaseAt,
          endTick: authoritative.endsAt,
          dx: authoritative.direction.x,
          dy: authoritative.direction.y,
        }
      : eventIntent;
    if (action) {
      if (state.tick <= action.endTick) {
        if (entity.archetype === 'prospector' && base.anim === 'hit') {
          const aim = bodyFacing();
          return {
            anim: 'hit',
            elapsedMs: nowMs - base.animStartMs,
            facingX: aim.x,
            facingY: aim.y,
          };
        }

        const elapsedMs = this.visualActionElapsed(entity.id, action, state.tick, nowMs);
        if (entity.archetype === 'prospector') {
          // A composicao ja estabiliza as tres camadas por dentro; o rumo solto
          // que sai aqui e o do TRONCO, e reaproveita a mesma memoria dela.
          const layered = layeredPlayerAnimation(
            entity, base, action, elapsedMs, nowMs, facing, gunHeatOf(entity, state)
          );
          return {
            anim: layered,
            elapsedMs,
            facingX: layered.upper.facingX,
            facingY: layered.upper.facingY,
          };
        }
        // Inimigo desenha a acao com o corpo inteiro: a direcao dela E o rumo do
        // corpo, e por isso divide a memoria de quadrante com a locomocao.
        const aim = facing(FACING_BODY, action.dx, action.dy);
        return {
          anim: actionAnimation(action.action),
          elapsedMs,
          facingX: aim.x,
          facingY: aim.y,
        };
      }
      this.actions.delete(entity.id);
      this.actionVisualClocks.delete(entity.id);
    } else {
      this.actionVisualClocks.delete(entity.id);
    }

    // O rumo OBSERVADO so vale para o Prospector.
    //
    // `entity.facing` do jogador e a MIRA, nao o andar: sem derivar o rumo do
    // deslocamento, ele caminharia de lado com as pernas apontando para onde
    // atira. Para inimigos e o contrario — `facing` ja E a direcao de locomocao
    // que a simulacao escolheu, e o deslocamento observado e uma versao PIOR
    // dela: a colisao zera um eixo ao raspar parede, e o rumo derivado salta para
    // um quadrante isometrico vizinho por alguns quadros e volta.
    //
    // Medido no Miner, que e quem mais vive colado em parede: o rumo alternava
    // entre (0,94, -0,33) e (0,-1) exato — `dr` e `ur` — e o sprite girava no
    // proprio eixo. Nao era animacao nem interpolacao; era o cliente discordando
    // da simulacao sobre para onde a criatura estava virada.
    const raw =
      entity.archetype === 'prospector'
        ? locomotionFacing(base, entity.facing.x, entity.facing.y)
        : { x: entity.facing.x, y: entity.facing.y };
    const heading = facing(FACING_BODY, raw.x, raw.y);

    // Repouso e caminhada do Prospector tambem saem COMPOSTOS.
    //
    // O sheet completo desenha o corpo inteiro numa peca so, entao nele a arma
    // nao existe separada e nao ha o que pintar de quente. Como o calor decai em
    // segundos e a janela da acao dura sete ticks, compor apenas durante o tiro
    // fazia o cano incandescente sumir no instante em que o jogador soltava o
    // gatilho — justamente quando ele quer conferir quanto ainda pode atirar.
    //
    // `hit`, `die`, `downed` e `revive` continuam vindo do sheet completo: sao as
    // poses que as camadas nao autoram, e nas quatro o jogador tem coisa mais
    // urgente para ler do que a temperatura da arma.
    if (entity.archetype === 'prospector' && (base.anim === 'idle' || base.anim === 'walk')) {
      const layered = layeredPlayerAnimation(
        entity, base, null, nowMs - base.animStartMs, nowMs, facing, gunHeatOf(entity, state)
      );
      return {
        anim: layered,
        elapsedMs: layered.upper.elapsedMs,
        facingX: layered.upper.facingX,
        facingY: layered.upper.facingY,
      };
    }

    return {
      anim: base.anim,
      elapsedMs: nowMs - base.animStartMs,
      facingX: heading.x,
      facingY: heading.y,
    };
  }

  tombstones(nowMs: number): DeathTombstone[] {
    for (const [id, tombstone] of this.tombstonesById) {
      if (nowMs >= tombstone.expiresMs) this.tombstonesById.delete(id);
    }
    // Chamado uma vez por quadro pelo renderer: e a batida natural para expulsar
    // do mapa de histerese os ids que sumiram do mundo sem evento de morte.
    this.facingHysteresis.sweep(nowMs);
    return [...this.tombstonesById.values()];
  }
}
