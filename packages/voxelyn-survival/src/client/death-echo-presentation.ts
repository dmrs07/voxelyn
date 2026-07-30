// Controller client-side dos Ecos do Veio.
//
// Esta camada guarda memória local, projeta carcaças e decide o que está PAREADO
// com a caixa-preta. Ela não participa da simulação: o renderer recebe apenas um
// quadro imutável de apresentação.
//
// O pareamento observa o botão usar sem consumi-lo. O comando continua indo
// inteiro para a simulação — se o eco roubasse o `interact`, a run gravada
// deixaria de ser a run jogada, e o replay do servidor voltaria divergente por
// causa de um painel de texto.

import type { SurvivalState } from '@voxelyn/survival-sim';
import {
  DEATH_ECHO_TRACE_SAMPLES,
  DEATH_ECHO_TRACE_STEP_MS,
  clusterDeathEchoes,
  type DeathEchoCapsule,
  type DeathEchoTraceSample,
  type PlacedDeathEcho,
} from '@voxelyn/survival-protocol';
import { describeCause } from './run-summary';
import { carcassVariant, deathEchoDesignation } from './death-echo-carcass';
import {
  applyDeathEchoOnce,
  loadDeathEchoRecords,
  projectSectorEchoes,
  saveDeathEchoRecords,
  type DeathEchoRecords,
} from './death-echoes';

/** Distância em que o botão usar abre a transmissão. */
export const DEATH_ECHO_PAIR_RADIUS = 1.7;
/**
 * Distância em que a transmissão cai sozinha.
 *
 * Maior que o raio de pareamento de propósito: sair da caixa-preta por um passo
 * lateral fecharia o painel no meio da leitura.
 */
export const DEATH_ECHO_LINK_RADIUS = 3.4;

export type DeathEchoReadout = {
  title: string;
  condition: string;
  headline: string;
  lesson: string;
  /** Presente somente quando o corpo representa mais de uma morte. */
  aggregate: string | null;
};

export type DeathEchoReadoutRegion = {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  align: 'right' | 'center';
  placement: 'side' | 'below';
};

/** Transmissão aberta: o eco e o instante em que o jogador pareou com ele. */
export type DeathEchoLink = {
  echo: PlacedDeathEcho;
  openedAtMs: number;
};

export type DeathEchoFrame = {
  echoes: readonly PlacedDeathEcho[];
  /** Ao alcance do botão usar, transmissão ainda fechada. */
  prompt: PlacedDeathEcho | null;
  paired: DeathEchoLink | null;
};

export const emptyDeathEchoFrame = (): DeathEchoFrame => ({
  echoes: [],
  prompt: null,
  paired: null,
});

type Insets = { top: number; right: number; bottom: number; left: number };
type PanelRect = { x: number; y: number; width: number; height: number };

export const deathEchoReadout = (echo: PlacedDeathEcho): DeathEchoReadout => {
  const cause = describeCause(echo.cause);
  return {
    title: deathEchoDesignation(echo.id),
    // Laudo do corpo, não da run: é a linha que amarra o texto ao que o jogador
    // está vendo no chão.
    condition: `CARCAÇA ${carcassVariant(echo.cause).condition}`,
    headline: cause.headline,
    lesson: cause.lesson,
    // Um corpo que representa muitos vira a estatística da câmara. A causa
    // narrada continua sendo a de UMA morte real — a do corpo que sobreviveu ao
    // agrupamento —, então o texto diz "predominante" e não "a causa".
    aggregate: echo.lost > 1
      ? `${echo.lost} UNIDADES PERDIDAS NESTA CÂMARA — CAUSA PREDOMINANTE ABAIXO`
      : null,
  };
};

/**
 * Reserva o retângulo do HUD antes de posicionar a caixa-preta.
 *
 * Em telas largas ela fica ao lado do painel. Em retrato estreito, desce para
 * baixo dele. Se nem ali houver espaço legível, o readout não é desenhado —
 * esconder informação opcional é melhor do que cobrir HP, calor ou objetivo.
 */
export const deathEchoReadoutRegion = (
  viewportWidth: number,
  viewportHeight: number,
  safeArea: Insets,
  hud: PanelRect,
): DeathEchoReadoutRegion | null => {
  const margin = 14;
  const gap = 12;
  const safeLeft = safeArea.left + margin;
  const safeRight = viewportWidth - safeArea.right - margin;
  const safeTop = safeArea.top + margin;
  const safeBottom = viewportHeight - safeArea.bottom - margin;
  if (safeRight <= safeLeft || safeBottom <= safeTop) return null;

  const sideX = Math.max(safeLeft, hud.x + hud.width + gap);
  const sideWidth = safeRight - sideX;
  if (sideWidth >= 180) {
    return {
      x: sideX,
      y: safeTop,
      maxWidth: Math.min(360, sideWidth),
      maxHeight: safeBottom - safeTop,
      align: 'right',
      placement: 'side',
    };
  }

  const belowY = Math.max(safeTop, hud.y + hud.height + gap);
  const availableWidth = safeRight - safeLeft;
  const availableHeight = safeBottom - belowY;
  if (availableWidth < 140 || availableHeight < 46) return null;
  return {
    x: safeLeft,
    y: belowY,
    maxWidth: Math.min(360, availableWidth),
    maxHeight: availableHeight,
    align: 'center',
    placement: 'below',
  };
};

/**
 * Janela deslizante dos últimos segundos do Prospector local.
 *
 * Amostrada pelo RELÓGIO e não pelo quadro: em rAF a 120Hz o mesmo buffer
 * guardaria metade do tempo, e a reprodução holográfica duraria metade em
 * monitores rápidos.
 */
class DeathEchoTraceRecorder {
  private samples: DeathEchoTraceSample[] = [];
  private nextSampleAtMs = 0;

  reset(): void {
    this.samples = [];
    this.nextSampleAtMs = 0;
  }

  observe(state: SurvivalState, nowMs: number): void {
    // Só a run solo produz cápsula, e só ela produz rastro. No co-op a posição é
    // deste cliente mas a causa é da sala: unir os dois inventaria uma morte.
    if (state.config.playerCount !== 1 || state.phase !== 'running') return;
    if (nowMs < this.nextSampleAtMs) return;
    this.nextSampleAtMs = nowMs + DEATH_ECHO_TRACE_STEP_MS;
    const extra = state.playerExtra;
    this.samples.push({
      x: state.player.x,
      y: state.player.y,
      aimX: extra.aim.x,
      aimY: extra.aim.y,
      // `nextShotAt` no futuro significa "acabou de disparar": é o único sinal
      // de gatilho que o estado carrega depois que o tiro já saiu.
      firing: extra.nextShotAt > state.tick,
    });
    if (this.samples.length > DEATH_ECHO_TRACE_SAMPLES) {
      this.samples.splice(0, this.samples.length - DEATH_ECHO_TRACE_SAMPLES);
    }
  }

  window(): readonly DeathEchoTraceSample[] {
    return this.samples;
  }
}

export class DeathEchoController {
  private recordedIdentity: string | null = null;
  private terminal = false;
  private projectionKey = '';
  private worldKey = '';
  private placed: readonly PlacedDeathEcho[] = [];
  private readonly trace = new DeathEchoTraceRecorder();
  private pool: readonly DeathEchoCapsule[] = [];
  private pairedId: string | null = null;
  private pairedAtMs = 0;
  private interactPending = false;
  /** A última cápsula gravada, para quem quiser publicá-la no pool. */
  private lastCaptured: DeathEchoCapsule | null = null;

  constructor(private records: DeathEchoRecords = loadDeathEchoRecords()) {}

  /**
   * O jogador apertou usar neste tick.
   *
   * Chamado com o MESMO comando que a simulação recebeu, depois de ele ter sido
   * submetido. Vários ticks num quadro colapsam num único pedido: o painel é
   * alternado uma vez por quadro, nunca duas.
   */
  pressInteract(): void {
    this.interactPending = true;
  }

  /**
   * Entrega o pool comunitário.
   *
   * Chega por HTTP, depois do começo da run, e isso é seguro precisamente porque
   * eco é apresentação: ele não entra em `SurvivalState`, no hash nem no replay.
   * Uma cápsula que atrasou aparece um pouco depois no chão e nada mais acontece.
   * No dia em que um eco der módulo, este caminho deixa de servir — aí o pool tem
   * de ser escolhido antes do tick zero, num manifesto imutável.
   */
  setPool(pool: readonly DeathEchoCapsule[]): void {
    this.pool = pool;
    // Força reprojeção no próximo quadro: o pool novo tem de disputar as células.
    this.projectionKey = '';
  }

  /** A cápsula da morte mais recente deste cliente, ou null. */
  capturedEcho(): DeathEchoCapsule | null {
    return this.lastCaptured;
  }

  sync(state: SurvivalState, nowMs: number): DeathEchoFrame {
    const requested = this.interactPending;
    this.interactPending = false;

    if (state.phase !== 'running') {
      if (!this.terminal && state.phase === 'dead') {
        const result = applyDeathEchoOnce(
          this.records,
          state,
          this.recordedIdentity,
          this.trace.window(),
        );
        this.recordedIdentity = result.identity;
        if (result.applied) {
          this.records = result.records;
          this.lastCaptured = result.echo;
          saveDeathEchoRecords(this.records);
        }
      }
      this.terminal = true;
      this.projectionKey = '';
      this.placed = [];
      this.pairedId = null;
      return emptyDeathEchoFrame();
    }

    if (this.terminal) {
      this.recordedIdentity = null;
      this.terminal = false;
      this.trace.reset();
    }

    // O MUNDO trocou, não só a projeção.
    //
    // `descend` teleporta o Prospector para a entrada de um mapa recém-gerado
    // mantendo a fase em `running`. Sem zerar o rastro aqui, morrer nos ~2,9 s
    // seguintes gravaria uma janela com coordenadas dos DOIS setores; codificadas
    // em relação à célula da morte nova, elas produziriam um holograma que salta
    // de um mapa para o outro e não descreve encontro nenhum.
    //
    // A chave é só o mundo: `nextSerial` também muda a projeção, mas trocar de
    // cápsula guardada não desloca o Prospector e não pode custar o rastro dele.
    const worldKey = [
      state.config.seed,
      state.sector,
      state.config.width,
      state.config.height,
    ].join(':');
    if (worldKey !== this.worldKey) {
      this.worldKey = worldKey;
      this.trace.reset();
    }
    this.trace.observe(state, nowMs);

    const key = `${worldKey}:${this.records.nextSerial}:${this.pool.length}`;
    if (key !== this.projectionKey) {
      this.projectionKey = key;
      // Agrupa DEPOIS de projetar: no contrato de seed compartilhada as cápsulas
      // voltam à coordenada real e a mesma câmara letal acumula dezenas delas.
      this.placed = clusterDeathEchoes(
        projectSectorEchoes(state, this.records.echoes, this.pool),
      );
      // A descida troca o mundo inteiro: um vínculo com a carcaça do setor
      // anterior sobreviveria apontando para um corpo que não existe mais.
      this.pairedId = null;
    }

    return this.resolveLink(state, nowMs, requested);
  }

  private resolveLink(
    state: SurvivalState,
    nowMs: number,
    requested: boolean,
  ): DeathEchoFrame {
    const distanceTo = (echo: PlacedDeathEcho): number =>
      Math.hypot(state.player.x - echo.x, state.player.y - echo.y);

    let paired = this.placed.find((echo) => echo.id === this.pairedId) ?? null;
    if (paired && distanceTo(paired) > DEATH_ECHO_LINK_RADIUS) {
      paired = null;
      this.pairedId = null;
    }

    let nearest: PlacedDeathEcho | null = null;
    let nearestDistance = DEATH_ECHO_PAIR_RADIUS;
    for (const echo of this.placed) {
      const distance = distanceTo(echo);
      if (distance > nearestDistance) continue;
      nearest = echo;
      nearestDistance = distance;
    }

    if (requested) {
      if (paired) {
        paired = null;
        this.pairedId = null;
      } else if (nearest) {
        paired = nearest;
        this.pairedId = nearest.id;
        this.pairedAtMs = nowMs;
      }
    }

    return {
      echoes: this.placed,
      prompt: paired ? null : nearest,
      paired: paired ? { echo: paired, openedAtMs: this.pairedAtMs } : null,
    };
  }
}
