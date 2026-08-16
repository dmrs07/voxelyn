// O DIRETOR do treinamento: a maquina de passos que observa a run e decide o
// que a tela deve dizer.
//
// Ele e um OBSERVADOR, nunca um participante: le os eventos semanticos e o
// estado, e devolve CUES descritivos — quem os transforma em banner, toast ou
// silencio e o main.ts. O diretor nao conhece `setBanner`, `renderer.messages`,
// `t()` nem DOM, e e por isso que os testes dele rodam em node puro.
//
// A regra que impede o soft-lock pedagogico: o percurso NAO tem portas, entao
// o jogador pode furar a ordem (pegar o Nucleo antes de dar o dash). Progresso
// IRREVERSIVEL e sempre conferido como FATO DO ESTADO (`leftEntryZone`,
// inimigos mortos, `isCoreTaken`) — um fato consumado continua consumado quando
// o passo dele chegar. So acao repetivel (a esquiva) e portao de evento.
import { isCoreTaken, type SemanticEvent, type SurvivalState } from '@voxelyn/survival-sim';
import type { MessageKey } from './i18n';

/** O que o diretor pede a tela. Descricao, nunca efeito. */
export type TrainingCue =
  | { type: 'banner'; key: MessageKey }
  | {
      type: 'toast';
      key: MessageKey;
      /**
       * Espera antes de aparecer. A dica de calor usa 1650 ms porque o
       * renderer ja mostra o `toast.overheat` nativo por 1600 ms — a licao
       * entra logo DEPOIS do aviso, nunca por cima dele.
       */
      delayMs?: number;
    }
  | { type: 'clear-banner' };

export type TrainingStepId = 'move' | 'clear' | 'dash' | 'core' | 'extract';

type TrainingStep = {
  id: TrainingStepId;
  instruction: MessageKey;
  touchInstruction: MessageKey;
  doneToast?: MessageKey;
  /** Concluido? Eventos deste quadro + estado corrente. Pura, sem efeito. */
  isComplete(events: readonly SemanticEvent[], state: SurvivalState): boolean;
};

const STEPS: readonly TrainingStep[] = [
  {
    id: 'move',
    instruction: 'training.step.move',
    touchInstruction: 'training.step.move.touch',
    doneToast: 'training.done.move',
    // O mesmo fato que arma a extracao: >4 tiles da entrada. Nada client-side.
    isComplete: (_events, state) => state.leftEntryZone,
  },
  {
    id: 'clear',
    instruction: 'training.step.clear',
    touchInstruction: 'training.step.clear.touch',
    doneToast: 'training.done.clear',
    isComplete: (_events, state) => state.enemies.every((e) => !e.alive),
  },
  {
    id: 'dash',
    instruction: 'training.step.dash',
    touchInstruction: 'training.step.dash.touch',
    doneToast: 'training.done.dash',
    // Estritamente por evento, e SO enquanto o passo esta ativo: a esquiva e
    // repetivel, entao pedir uma nova aqui nunca trava ninguem.
    isComplete: (events) => events.some((e) => e.t === 'dodge'),
  },
  {
    id: 'core',
    instruction: 'training.step.core',
    touchInstruction: 'training.step.core.touch',
    // Sem toast proprio: a simulacao ja anuncia `sim.coreTaken` ("volte a
    // superficie"), que e exatamente a proxima instrucao.
    isComplete: (_events, state) => isCoreTaken(state, state.sector),
  },
  {
    id: 'extract',
    instruction: 'training.step.extract',
    touchInstruction: 'training.step.extract.touch',
    // O evento e a fonte; a fase e a rede de seguranca para o quadro em que a
    // fila ja foi drenada (`extracted_with_core` e RunPhase, nao evento).
    isComplete: (events, state) =>
      events.some((e) => e.t === 'extracted' && e.withCore) ||
      state.phase === 'extracted_with_core',
  },
];

export class TrainingDirector {
  private stepIndex = 0;
  private heatTipShown = false;
  private finishAnnounced = false;
  private lastBanner: MessageKey | null = null;
  private pending: SemanticEvent[] = [];

  /** Chamado do callback da TickEventQueue, junto com renderer/audio. */
  ingest(events: readonly SemanticEvent[]): void {
    this.pending.push(...events);
  }

  /**
   * Uma vez por quadro desenhado, depois do flush da fila: avanca quantos
   * passos os fatos permitirem, e devolve o que a tela deve mudar.
   */
  frame(state: SurvivalState, usingTouch: boolean): TrainingCue[] {
    const cues: TrainingCue[] = [];
    const events = this.pending;

    // A dica de calor e ortogonal aos passos: uma vez por tentativa, quando o
    // cano travar — que e o unico momento em que ela e resposta e nao ruido.
    if (!this.heatTipShown && events.some((e) => e.t === 'overheat')) {
      this.heatTipShown = true;
      cues.push({ type: 'toast', key: 'training.tip.heat', delayMs: 1650 });
    }

    // `while` e nao `if`: um fato consumado fora de ordem (Nucleo ja no
    // chassi) faz o passo dele concluir NO INSTANTE em que vira o ativo.
    while (this.stepIndex < STEPS.length && STEPS[this.stepIndex].isComplete(events, state)) {
      const step = STEPS[this.stepIndex];
      if (step.doneToast) cues.push({ type: 'toast', key: step.doneToast });
      this.stepIndex++;
    }
    this.pending = [];

    if (this.finished) {
      if (!this.finishAnnounced) {
        this.finishAnnounced = true;
        this.lastBanner = null;
        cues.push({ type: 'clear-banner' });
      }
      return cues;
    }

    // O banner so e reemitido quando a MENSAGEM muda — troca de passo ou troca
    // de modalidade (teclado ↔ toque), que sao as duas coisas que a mudam.
    const step = STEPS[this.stepIndex];
    const key = usingTouch ? step.touchInstruction : step.instruction;
    if (key !== this.lastBanner) {
      this.lastBanner = key;
      cues.push({ type: 'banner', key });
    }
    return cues;
  }

  get finished(): boolean {
    return this.stepIndex >= STEPS.length;
  }

  /** Recomeco da tentativa (morte no exercicio): tudo do zero. */
  reset(): void {
    this.stepIndex = 0;
    this.heatTipShown = false;
    this.finishAnnounced = false;
    this.lastBanner = null;
    this.pending = [];
  }
}
