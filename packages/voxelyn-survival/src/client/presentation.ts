import {
  DEVOURER_STUCK,
  HEAT_MAX,
  TICK_HZ,
  moduleHasCapacity,
  type Entity,
  type EntityActionKind,
  type ModuleId,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
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
  //
  // `drill`, `erupt` e `freeze` entram pela mesma porta, agora que os chefes
  // tem atlas. Sao as tres acoes do jogo cujo PREPARO e mais longo e mais
  // importante que o golpe: a broca do Diamandis fica 1,8 s parada girando
  // antes de atravessar a arena, o Devorador rasga o chao antes de sair dele, e
  // a Rainha levanta os bracos antes de o lago congelar. Mostrar a pose de
  // ataque durante esses telegrafos e o erro do Coveiro outra vez.
  if (
    action === 'detonate' ||
    action === 'charge' ||
    action === 'pulse' ||
    action === 'hurl' ||
    action === 'haul' ||
    action === 'drill' ||
    action === 'erupt' ||
    action === 'freeze' ||
    // O voo herda a pose do telegrafo: no atlas do Devorador o `special` e o
    // corpo erguido com a boca aberta, que e exatamente a silhueta de quem
    // atravessa o ar. Cair no `attack` traria a pose de bote, com o corpo
    // ainda plantado no chao.
    action === 'leap'
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
 *
 * O MESMO vale para os modulos montados, e pelo mesmo motivo: `activeModules`
 * vive em `playerExtras`, que este cliente so tem do proprio jogador. O
 * `EntitySnapshot` do parceiro carrega posicao, vida e acao, e nada mais. No
 * solo (e para o jogador local em qualquer modo) a lista e completa; para o
 * parceiro remoto ela sai vazia e a arma dele aparece limpa. Preencher isso
 * exigiria campo novo no protocolo — decisao de rede, nao de desenho.
 */
/** O que o cliente sabe do canhao rotativo deste Prospector, por reconstrucao. */
export type MinigunGunView = {
  /** 0..1. Acima de zero, os canos estao girando — logo, a arma esta montada. */
  spin: number;
  /** Angulo acumulado do conjunto, 0..1. E ele que escolhe o quadro da ventoinha. */
  barrelPhase: number;
};

const gunStateOf = (
  entity: Entity,
  state: SurvivalState,
): { heat: number; overheated: boolean; modules: readonly ModuleId[] } => {
  const slot = entity.slot;
  const extra = slot === undefined ? undefined : state.playerExtras?.[slot];
  if (!extra) return { heat: 0, overheated: false, modules: [] };
  return {
    heat: Math.max(0, Math.min(1, extra.heat / HEAT_MAX)),
    overheated: state.tick < extra.overheatedUntil,
    // `moduleHasCapacity` e nao `activeModules` cru: um modulo gasto continua na
    // lista ate expirar, e uma peca que nao faz mais nada nao pode continuar
    // parafusada na arma. Quem mede e a MESMA funcao que decide se o efeito
    // acontece, entao o metal some no tick em que o efeito some.
    modules: extra.activeModules
      .map((module) => module.id)
      .filter((id) => moduleHasCapacity(extra, id, state.tick)),
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
  gun: { heat: number; overheated: boolean; modules: readonly ModuleId[] },
  gunView: MinigunGunView | undefined
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
  // O sopro canalizado dura segundos e o jogador REDIRECIONA o jato durante a
  // acao: o `dx/dy` do intent e atualizado a cada emissao `flame_cone` (ver
  // `ingest`), entao o tronco gira junto com a chama — sem seguir
  // `entity.facing`, que desde "andar gira o corpo" pode ser o rumo dos PES, e
  // movimento nao guia o sopro.
  const upperFacing = action ? facing(FACING_UPPER, action.dx, action.dy) : lowerFacing;

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
    // A ROTACAO tem prioridade sobre a lista de modulos para decidir se o
    // canhao esta montado, e nao o contrario. Ver `MinigunGunView`: a lista
    // esta vazia para o parceiro remoto e perde a Minigun no tick exato da
    // bala 300, com os canos ainda em desaceleracao. A rotacao cobre os dois.
    modules: mountedModules(gun.modules, gunView),
    barrelPhase: gunView?.barrelPhase ?? 0,
  };
};

/**
 * Rotacao acima da qual o canhao ainda esta MONTADO no bot.
 *
 * Nao e zero por causa do float da integracao local: `advanceSpin` chega a
 * zero por saturacao, mas um quadro longo pode deixar residuo. E o mesmo
 * limiar que a sobreposicao procedural usava antes de ser aposentada.
 */
export const MINIGUN_MOUNTED_SPIN = 0.001;

/**
 * Que modulos estao MONTADOS no bot, somando a rotacao a lista autoritativa.
 *
 * A lista sozinha nao basta, e os dois furos dela sao especificos:
 *
 *  - O PARCEIRO REMOTO nao tem `activeModules` neste cliente (`playerExtras` e
 *    so do viewer), mas `MinigunViews` reconstroi a rotacao dele a partir de
 *    `minigun_spin` e `minigun_burst`. Sem esta soma, o Prospector do parceiro
 *    voltaria a aparecer com o tiro comum cuspindo dezesseis balas por segundo
 *    — o defeito que a sobreposicao procedural existia para resolver, e que a
 *    aposentadoria dela reabriu.
 *  - LOCALMENTE, `moduleHasCapacity` devolve falso no tick em que a bala 300 e
 *    consumida, e os canos ainda levam dez ticks para parar. Sem esta soma a
 *    arma trocaria de volta no meio da desaceleracao, que e justamente quando o
 *    jogador esta olhando para ela.
 *
 * A rotacao nunca REMOVE um modulo da lista: ela so acrescenta o canhao que a
 * lista nao sabe que existe.
 */
export const mountedModules = (
  modules: readonly ModuleId[],
  gunView?: MinigunGunView
): readonly ModuleId[] =>
  gunView && gunView.spin > MINIGUN_MOUNTED_SPIN && !modules.includes('minigun')
    ? [...modules, 'minigun']
    : modules;

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
      } else if (event.t === 'flame_cone') {
        // Cada emissão carrega a mira DAQUELE instante: o tronco do dono gira
        // junto com o jato, inclusive o do parceiro remoto — cujo facing de
        // snapshot segue os pés, não a chama.
        const intent = this.actions.get(event.owner);
        if (intent && intent.action === 'breath') {
          intent.dx = event.dx;
          intent.dy = event.dy;
        }
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
    downed = false,
    /**
     * A rotacao do canhao RECONSTRUIDA pelo cliente, quando ha uma.
     *
     * Vem de `MinigunViews` (que vive no render, porque e ele quem ingere os
     * eventos e integra por quadro) e nao de `playerExtras`, e a diferenca e o
     * que faz o canhao existir em dois casos que a lista de modulos nao cobre:
     * o parceiro remoto, cujo `activeModules` este cliente nao tem, e a
     * desaceleracao depois da bala 300, quando o modulo ja saiu da lista e os
     * canos ainda estao girando.
     */
    gunView?: MinigunGunView
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

    // O DEVORADOR ENTALADO. Vem antes de tudo o que consulta acao porque preso
    // ele nao TEM acao — e sem esta linha o `base.anim` cairia em `idle`, que e
    // o corpo deitado passeando pelo chao. E a unica janela de dano do encontro:
    // desenha-la com a pose de repouso apagaria o convite que ela e.
    //
    // A pose `downed` do atlas ergue a metade dianteira para fora da cratera. O
    // slot ja significava exatamente isto — "fora de combate, vulneravel" — e o
    // Devorador e o unico inimigo que o usa em vida.
    if (entity.archetype === 'white_devourer' && entity.mood === DEVOURER_STUCK) {
      const start = this.downedAt.get(entity.id) ?? nowMs;
      this.downedAt.set(entity.id, start);
      const aim = bodyFacing();
      return { anim: 'downed', elapsedMs: nowMs - start, facingX: aim.x, facingY: aim.y };
    }

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
            entity, base, action, elapsedMs, nowMs, facing, gunStateOf(entity, state), gunView
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
        entity, base, null, nowMs - base.animStartMs, nowMs, facing, gunStateOf(entity, state), gunView
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
