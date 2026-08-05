import type {
  Entity,
  PlayerExtra,
  Projectile,
  SalvageSite,
  SectorBossState,
  SurvivalState,
  Vec2,
  WellOffer,
} from '@voxelyn/survival-sim';

/**
 * O RELOGIO DE EXIBICAO do solo: o mesmo contrato de `playout.ts`, sem rede.
 *
 * A simulacao anda em ticks inteiros a 20 Hz e o monitor desenha a 60 ou 120.
 * Desenhar o tick recem-simulado como ele esta faz o mundo avancar em degraus:
 * o acumulador do laco so cruza `TICK_MS` a cada tres quadros, entao dois de
 * cada tres saem com deslocamento ZERO e o terceiro salta 0,23 tile de uma vez
 * (`PLAYER_SPEED` dividido por `TICK_HZ`). E o mesmo defeito que o co-op teve e
 * consertou — la a irregularidade vinha da rede, aqui vem da diferenca entre a
 * taxa da simulacao e a do monitor — e por isso a correcao e a mesma: o que se
 * desenha nao e um tick, e um INSTANTE ENTRE DOIS.
 *
 * A divisao de trabalho com o co-op e deliberada. De la vem a REGRA — posicao
 * interpolada entre dois retratos, todo o resto lido do retrato ja alcancado —,
 * porque foi ela que resolveu o teleporte e o sumico antecipado. O que NAO vem
 * de la e o relogio: `PlayoutClock` estima ritmo e mede jitter porque nao sabe
 * quando o proximo quadro chega. Aqui sabe-se exatamente — o proximo tick sai
 * quando o acumulador cruzar `TICK_MS` —, entao a fase e o proprio acumulador e
 * o atraso e de um tick cravado, o piso que o co-op so alcanca em rede perfeita.
 * Herdar a estimativa daria 1,7 tick de defasagem para medir uma irregularidade
 * que nao existe.
 */

/**
 * A grade do retrato, em buffers reaproveitados.
 *
 * A grade tambem tem de andar na linha de render, e nao na da simulacao: o
 * bloco minerado desaparece no tick em que a picareta o quebra, mas o estalo e
 * a poeira sao um evento, e evento agora espera a linha chegar nele. Servida do
 * presente, a pedra sumia ate um tick ANTES do proprio efeito de quebra — o
 * jogador via o buraco e so depois ouvia o golpe que o abriu.
 *
 * Copia por `set` em buffer proprio, e nao array novo: sao dois vetores de
 * `width * height` por tick, e alocar isso 20 vezes por segundo para descartar
 * na seguinte e trabalho para o coletor sem nada em troca.
 */
class GridBuffer {
  solid = new Uint8Array(0);
  surface = new Uint8Array(0);

  /** Realoca so quando a descida troca o mundo por um de outro tamanho. */
  copyFrom(state: SurvivalState): void {
    if (this.solid.length !== state.solid.length) this.solid = new Uint8Array(state.solid.length);
    if (this.surface.length !== state.surface.length) {
      this.surface = new Uint8Array(state.surface.length);
    }
    this.solid.set(state.solid);
    this.surface.set(state.surface);
  }
}

/**
 * Um retrato do que se desenha num tick.
 *
 * Guarda COPIA e nao referencia: `stepRun` muta o mundo e as entidades no
 * lugar, entao um retrato por referencia seria sempre igual ao presente e a
 * interpolacao entre dois deles nao teria de onde sair.
 *
 * Os campos sao exatamente os que o desenho consulta e que mudam por tick. O
 * que nao muda — configuracao, semente — segue vindo do estado vivo, porque
 * copiar o que ninguem escreve so custa.
 */
type Pose = {
  tick: number;
  /** Setor deste retrato; troca dele e descontinuidade, ver `capture`. */
  sector: number;
  /** Indice de `players` que o renderer segue (camera, HUD, mira). */
  playerIndex: number;
  players: Entity[];
  playerExtras: PlayerExtra[];
  enemies: Entity[];
  projectiles: Projectile[];
  grid: GridBuffer;
  entry: Vec2;
  corePos: Vec2;
  coresTakenMask: number;
  sectorBoss: SectorBossState;
  contamination: number;
  charges: Array<{ idx: number; until: number }>;
  salvageSites: SalvageSite[];
  wellOffers: WellOffer[];
};

/**
 * Copia o que muda por tick; compartilha o que nao muda.
 *
 * `facing` e `action.direction` sao clonados porque a simulacao escreve DENTRO
 * deles: mantidos por referencia, o retrato do tick passado apontaria para o
 * rumo do tick atual e a interpolacao entregaria um corpo deslizando com a pose
 * errada.
 */
const cloneEntity = (e: Entity): Entity => ({
  ...e,
  facing: { x: e.facing.x, y: e.facing.y },
  action: e.action
    ? { ...e.action, direction: { x: e.action.direction.x, y: e.action.direction.y } }
    : undefined,
});

/** Mesma regra do `cloneEntity` para os campos que a simulacao muta no lugar. */
const cloneExtra = (pe: PlayerExtra): PlayerExtra => ({
  ...pe,
  aim: { x: pe.aim.x, y: pe.aim.y },
  dodgeDir: { x: pe.dodgeDir.x, y: pe.dodgeDir.y },
  activeModules: pe.activeModules.slice(),
  resonance: { ...pe.resonance },
});

const capturePose = (state: SurvivalState, grid: GridBuffer): Pose => {
  grid.copyFrom(state);
  return {
    tick: state.tick,
    sector: state.sector,
    playerIndex: Math.max(0, state.players.indexOf(state.player)),
    players: state.players.map(cloneEntity),
    playerExtras: state.playerExtras.map(cloneExtra),
    enemies: state.enemies.map(cloneEntity),
    projectiles: state.projectiles.map((p) => ({ ...p })),
    grid,
    entry: { x: state.entry.x, y: state.entry.y },
    corePos: { x: state.corePos.x, y: state.corePos.y },
    coresTakenMask: state.coresTakenMask,
    sectorBoss: { ...state.sectorBoss },
    contamination: state.contamination,
    charges: state.charges.map((c) => ({ ...c })),
    salvageSites: state.salvageSites.map((s) => ({ ...s })),
    wellOffers: state.wellOffers.map((o) => ({ ...o })),
  };
};

export class LocalPlayout {
  /** O retrato ja alcancado pela linha de render. */
  private from: Pose | null = null;
  /** O retrato para onde os corpos estao a caminho. */
  private to: Pose | null = null;
  /**
   * Duas grades alternadas. Vivem no maximo dois retratos, entao a que o retrato
   * novo sobrescreve e sempre a do que acabou de cair fora.
   */
  private readonly grids = [new GridBuffer(), new GridBuffer()];
  private nextGrid = 0;

  /** Esquece tudo: o que estava guardado nao descreve mais o mundo do jogador. */
  reset(): void {
    this.from = null;
    this.to = null;
  }

  /**
   * Guarda o retrato do tick recem-simulado. Chamar depois de cada `stepRun`.
   *
   * A descida troca o mundo inteiro sob os mesmos ids — o Prospector sai do poco
   * e reaparece na entrada do setor seguinte no mesmo tick. Interpolar entre os
   * dois arrastaria ele pela diagonal do mapa durante 50 ms, por cima de um
   * terreno que o retrato anterior nao descreve. E a mesma situacao do `tick`
   * que anda para tras no co-op: linha do tempo nova, buffer velho sem valor.
   */
  capture(state: SurvivalState): void {
    const pose = capturePose(state, this.grids[this.nextGrid]);
    this.nextGrid ^= 1;
    if (this.to && this.to.sector !== pose.sector) {
      this.from = null;
      this.to = pose;
      return;
    }
    this.from = this.to;
    this.to = pose;
  }

  /**
   * O mundo no instante entre os dois ultimos ticks, ou `null` antes do
   * primeiro retrato.
   *
   * `alpha` e a fracao de tick ja decorrida (o acumulador do laco dividido por
   * `TICK_MS`). O estado devolvido e uma VISTA: compartilha com o vivo tudo que
   * o desenho so le — grade, sitios, ventos, configuracao — e substitui apenas
   * o que tem posicao. A simulacao nunca e tocada; escrever posicao interpolada
   * nela faria o proximo tick partir de um lugar onde o mundo nunca esteve.
   */
  sample(state: SurvivalState, alpha: number): SurvivalState | null {
    const to = this.to;
    if (!to) return null;
    const from = this.from ?? to;

    // O retrato JA ALCANCADO manda em tudo que nao e posicao — vida, acao, quem
    // existe. Ler isso de `to` enquanto o corpo ainda esta a caminho dele
    // adiantaria o mundo em ate um tick: a criatura sumiria antes de o corpo
    // chegar onde morreu, e o telegraph acenderia antes do tick que o disparou.
    const t = from === to ? 1 : Math.max(0, Math.min(1, alpha));
    const targets = from === to ? null : new Map<number, Entity>();
    if (targets) {
      for (const e of to.players) targets.set(e.id, e);
      for (const e of to.enemies) targets.set(e.id, e);
    }

    // Sem alvo no retrato seguinte a entidade morreu ali: segurar a ultima
    // posicao conhecida e mais honesto que empurra-la para lugar nenhum. Sem
    // alvo tambem nao ha o que alocar — a propria copia do retrato serve, porque
    // ninguem escreve na vista.
    const moved = (e: Entity): Entity => {
      const target = targets?.get(e.id);
      if (!target) return e;
      return { ...e, x: e.x + (target.x - e.x) * t, y: e.y + (target.y - e.y) * t };
    };

    const players = from.players.map(moved);

    // Projeteis viajam a 13 tiles/s — quase dois tercos de tile por tick. Sem
    // interpolar eles saltam enquanto tudo em volta desliza, e o tiro chega ao
    // alvo antes da criatura que ele vai acertar.
    const projectileTargets = targets
      ? new Map(to.projectiles.map((p) => [p.id, p]))
      : null;

    return {
      ...state,
      tick: from.tick,
      sector: from.sector,
      // O mundo tambem vem do retrato alcancado. Servido do presente, ele
      // mostraria a pedra ja quebrada e o bau ja aberto ate um tick antes do
      // efeito e da narracao que contam a quebra e a abertura — os eventos
      // esperam a linha de render, e o mundo tem de esperar com eles.
      solid: from.grid.solid,
      surface: from.grid.surface,
      entry: from.entry,
      corePos: from.corePos,
      coresTakenMask: from.coresTakenMask,
      sectorBoss: from.sectorBoss,
      contamination: from.contamination,
      charges: from.charges,
      salvageSites: from.salvageSites,
      wellOffers: from.wellOffers,
      players,
      playerExtras: from.playerExtras,
      player: players[from.playerIndex] ?? players[0] ?? state.player,
      playerExtra: from.playerExtras[from.playerIndex] ?? state.playerExtra,
      enemies: from.enemies.map(moved),
      projectiles: from.projectiles.map((p) => {
        const target = projectileTargets?.get(p.id);
        if (!target) return p;
        return { ...p, x: p.x + (target.x - p.x) * t, y: p.y + (target.y - p.y) * t };
      }),
    };
  }
}
