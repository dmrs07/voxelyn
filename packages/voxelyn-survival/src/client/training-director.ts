// O DIRETOR do treinamento: a maquina de passos que observa a run e decide o
// que a tela deve dizer.
//
// Ele e um OBSERVADOR, nunca um participante: le os eventos semanticos e o
// estado, e devolve CUES descritivos — quem os transforma em banner, toast ou
// silencio e o main.ts. O diretor nao conhece `setBanner`, `renderer.messages`,
// `t()` nem DOM, e e por isso que os testes dele rodam em node puro.
//
// ---------------------------------------------------------------------------
// A REGRA QUE IMPEDE O SOFT-LOCK PEDAGOGICO
// ---------------------------------------------------------------------------
// O percurso NAO tem portas, entao o jogador pode furar a ordem (abrir o cofre
// antes de limpar a camara, descer sem sintonizar Eco nenhum). Progresso
// IRREVERSIVEL e sempre conferido como FATO DO ESTADO — `leftEntryZone`,
// `cacheOpened`, `isCoreTaken`, o setor corrente. Um fato consumado continua
// consumado quando o passo dele chegar, e o `while` do avanco despacha em UM
// quadro todos os passos que a realidade ja cumpriu.
//
// Duas classes de passo escapam disso e por isso ganham rede de seguranca:
//
//   · acao REPETIVEL (a esquiva, a habilidade) e portao de evento/latch —
//     pedir uma nova nunca trava ninguem;
//   · acao OPCIONAL no jogo real (sintonizar um Eco, escolher um modulo) tem
//     sempre uma segunda condicao que a dispensa quando o jogador ja seguiu em
//     frente. O exercicio ensina o que o poco oferece; ele nao inventa uma
//     obrigacao que a descida de verdade nao tem.
import {
  DISCOVERY_FRAGILE_BREACH,
  isCoreTaken,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
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

export type TrainingStepId =
  | 'move'
  | 'mine'
  | 'clear'
  | 'dash'
  | 'terminal'
  | 'hold'
  | 'cache'
  | 'module'
  | 'echo'
  | 'descend'
  | 'ability'
  | 'breach'
  | 'core'
  | 'ascend'
  | 'extract';

/**
 * As duas acoes REPETIVEIS do curriculo, como fatos DESTE quadro.
 *
 * Elas nao podem ser lidas do estado como as outras licoes, porque nao deixam
 * rastro permanente: uma esquiva e um evento, e um Eco disparado e um relogio
 * que expira sozinho. E nao podem virar memoria, tampouco — um fato latchado
 * concluiria o passo com uma acao feita LANCES antes de ele existir, e a
 * instrucao "esquive" apareceria e sumiria sem ninguem ter esquivado.
 *
 * Por serem do quadro, elas sao tambem a rede de seguranca: pedir uma acao
 * repetivel de novo nunca trava ninguem.
 */
type TrainingFacts = {
  dodged: boolean;
  abilityCast: boolean;
};

type TrainingStep = {
  id: TrainingStepId;
  /** Em que setor esta licao acontece — e a partir de onde a morte rebobina. */
  sector: 1 | 2;
  instruction: MessageKey;
  touchInstruction: MessageKey;
  doneToast?: MessageKey;
  /** Concluido? Eventos deste quadro + estado corrente. Pura, sem efeito. */
  isComplete(state: SurvivalState, facts: TrainingFacts): boolean;
  /**
   * O jogador ja SEGUIU EM FRENTE sem dar esta licao?
   *
   * A diferenca entre isto e `isComplete` e a diferenca entre aprender e
   * passar, e ela existe porque a alternativa e pior: sem dispensa, uma licao
   * opcional que o jogador pulou congela o banner nela para sempre, e a tela
   * passa a mandar "atire no veio" enquanto um espreitador morde. Uma
   * instrucao que descreve o que o jogador NAO esta fazendo e pior do que
   * nenhuma instrucao — ela ensina a ignorar o banner.
   *
   * Um passo dispensado nao toca o `doneToast`: ninguem e parabenizado por
   * algo que nao fez.
   */
  dispensedBy?(state: SurvivalState): boolean;
};

/** O sitio de salvage do exercicio; `null` no setor que nao tem um. */
const site = (state: SurvivalState): SurvivalState['salvageSites'][number] | null =>
  state.salvageSites[0] ?? null;

/**
 * A dispensa geral do setor 1: o jogador desceu.
 *
 * Regra unica, e nao uma condicao por licao, porque o fato e um so — a
 * descida encerrou o setor onde essas licoes moram, e nenhuma delas volta a
 * ser possivel. As licoes do fundo tem as dispensas delas, mais estreitas.
 */
const descended = (state: SurvivalState): boolean => state.sector > 1;

/**
 * Quao perto um corpo tem de estar para a licao seguinte ja ter comecado.
 *
 * Dentro do aggro do espreitador (9), mas com folga: a esta distancia ele nao
 * esta considerando atacar, ele esta atacando.
 */
const ENGAGE_RANGE = 6;

/**
 * A luta ja comecou?
 *
 * A pergunta e sobre os INIMIGOS, e nao sobre a vida do jogador. A primeira
 * versao media "o Prospector levou dano" e estava errada por um motivo que so
 * a tela mostrou: o cano cobra vida ao saturar, entao minerar ate travar a
 * arma se registrava como combate e dispensava a propria licao de minerar no
 * meio dela.
 */
const engaged = (state: SurvivalState): boolean =>
  state.enemies.some(
    (enemy) =>
      !enemy.alive ||
      enemy.hp < enemy.maxHp ||
      Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= ENGAGE_RANGE,
  );

/** O jogador ja acionou o terminal: as licoes anteriores ficaram para tras. */
const salvageBegun = (state: SurvivalState): boolean =>
  descended(state) || site(state)?.terminalState !== 'inactive';

/** O tampao do fundo caiu — a licao da brecha ja aconteceu. */
const breached = (state: SurvivalState): boolean =>
  (state.stats.discoveries & DISCOVERY_FRAGILE_BREACH) !== 0;

/**
 * Quantas lascas de minerio o exercicio cobra antes de dar a licao por dada.
 *
 * Tres: uma pode ser acidente de mira, duas ainda; a terceira e intencao. O
 * veio carimbado tem seis celulas (doze lascas), entao a cota sobra.
 */
const MINE_QUOTA = 3;

const STEPS: readonly TrainingStep[] = [
  // -------------------------------------------------------------------------
  // SETOR 1 · a descida
  // -------------------------------------------------------------------------
  {
    id: 'move',
    sector: 1,
    instruction: 'training.step.move',
    touchInstruction: 'training.step.move.touch',
    doneToast: 'training.done.move',
    // O mesmo fato que arma a extracao: >4 tiles da entrada. Nada client-side.
    isComplete: (state) => state.leftEntryZone,
  },
  {
    id: 'mine',
    sector: 1,
    instruction: 'training.step.mine',
    touchInstruction: 'training.step.mine.touch',
    doneToast: 'training.done.mine',
    isComplete: (state) => state.stats.oreCollected >= MINE_QUOTA,
    // Minerar e opcional no jogo real — carga e decisao, nao contrato —, e
    // insistir nisso com a luta em curso e a companhia falando por cima do
    // jogo. Quem ja esta trocando tiro passou de licao.
    dispensedBy: (state) => engaged(state) || salvageBegun(state),
  },
  {
    id: 'clear',
    sector: 1,
    instruction: 'training.step.clear',
    touchInstruction: 'training.step.clear.touch',
    doneToast: 'training.done.clear',
    isComplete: (state) => state.enemies.every((e) => !e.alive),
    // Passar correndo pela camara e uma jogada legitima — e o alarme do
    // terminal vai repovoar a baia de qualquer forma.
    dispensedBy: salvageBegun,
  },
  {
    id: 'dash',
    sector: 1,
    instruction: 'training.step.dash',
    touchInstruction: 'training.step.dash.touch',
    doneToast: 'training.done.dash',
    isComplete: (_state, facts) => facts.dodged,
    dispensedBy: salvageBegun,
  },
  {
    id: 'terminal',
    sector: 1,
    instruction: 'training.step.terminal',
    touchInstruction: 'training.step.terminal.touch',
    // Sem toast: o passo seguinte ja explica o que o alarme acabou de fazer.
    isComplete: (state) => site(state)?.terminalState !== 'inactive',
    dispensedBy: descended,
  },
  {
    id: 'hold',
    sector: 1,
    instruction: 'training.step.hold',
    touchInstruction: 'training.step.hold.touch',
    doneToast: 'training.done.hold',
    isComplete: (state) => site(state)?.cacheRevealed === true,
    dispensedBy: descended,
  },
  {
    id: 'cache',
    sector: 1,
    instruction: 'training.step.cache',
    touchInstruction: 'training.step.cache.touch',
    isComplete: (state) => site(state)?.cacheOpened === true,
    dispensedBy: descended,
  },
  {
    id: 'module',
    sector: 1,
    instruction: 'training.step.module',
    touchInstruction: 'training.step.module.touch',
    doneToast: 'training.done.module',
    // A escolha resolvida some do estado.
    isComplete: (state) => !state.playerExtra.pendingModuleChoice,
    dispensedBy: descended,
  },
  {
    id: 'echo',
    sector: 1,
    instruction: 'training.step.echo',
    touchInstruction: 'training.step.echo.touch',
    doneToast: 'training.done.echo',
    isComplete: (state) => state.wellOffers.some((offer) => offer.takenBy !== null),
    // Sintonizar e OPCIONAL no jogo real — descer direto mantem a habilidade
    // atual, e o exercicio nao transforma isso em erro.
    dispensedBy: descended,
  },
  {
    id: 'descend',
    sector: 1,
    instruction: 'training.step.descend',
    touchInstruction: 'training.step.descend.touch',
    isComplete: (state) => state.sector > 1,
  },
  // -------------------------------------------------------------------------
  // SETOR 2 · o Nucleo, e o caminho de volta
  // -------------------------------------------------------------------------
  {
    id: 'ability',
    sector: 2,
    instruction: 'training.step.ability',
    touchInstruction: 'training.step.ability.touch',
    doneToast: 'training.done.ability',
    isComplete: (_state, facts) => facts.abilityCast,
    // Quem atravessou a camara e ja quebrou o tampao nao e mandado de volta
    // para usar uma habilidade numa sala vazia.
    dispensedBy: breached,
  },
  {
    id: 'breach',
    sector: 2,
    instruction: 'training.step.breach',
    touchInstruction: 'training.step.breach.touch',
    doneToast: 'training.done.breach',
    isComplete: breached,
    // Sem dispensa, e sem precisar de uma: o tampao E a porta do pedestal.
    // Esta e a unica licao do exercicio que nao tem como ser pulada.
  },
  {
    id: 'core',
    sector: 2,
    instruction: 'training.step.core',
    touchInstruction: 'training.step.core.touch',
    // Sem toast proprio: a simulacao ja anuncia `sim.coreTaken` ("volte a
    // superficie"), que e exatamente a proxima instrucao.
    isComplete: (state) => isCoreTaken(state, 2),
  },
  {
    id: 'ascend',
    sector: 2,
    instruction: 'training.step.ascend',
    touchInstruction: 'training.step.ascend.touch',
    doneToast: 'training.done.ascend',
    isComplete: (state) => state.sector <= 1,
  },
  {
    id: 'extract',
    sector: 1,
    instruction: 'training.step.extract',
    touchInstruction: 'training.step.extract.touch',
    isComplete: (state) => state.phase === 'extracted_with_core',
  },
];

const stepAt = (id: TrainingStepId): number => STEPS.findIndex((step) => step.id === id);

/** O primeiro passo de cada setor: para onde a morte rebobina o exercicio. */
const FIRST_STEP_OF_SECTOR: Record<1 | 2, number> = {
  1: 0,
  2: STEPS.findIndex((step) => step.sector === 2),
};
/** Depois deste indice o Nucleo ja saiu do pedestal, e o checkpoint carrega. */
const CORE_STEP = stepAt('core');
/** Onde o caminho de VOLTA recomeca, em cada setor. */
const RETURN_STEP: Record<1 | 2, number> = { 1: stepAt('extract'), 2: stepAt('ascend') };

/**
 * Onde o exercicio recomeca depois de uma unidade perdida.
 *
 * O par (setor, Nucleo na mao) e o minimo que descreve um checkpoint deste
 * percurso, porque o setor 1 e atravessado DUAS vezes e as duas passagens
 * pedem coisas opostas: na descida, andar ate o poco; na subida, andar ate a
 * plataforma. Sem o segundo campo, morrer voltando mandaria o jogador refazer
 * a descida inteira — e a licao que ele estava no meio de aprender e
 * justamente que a volta e a parte que paga.
 */
export type TrainingCheckpoint = { sector: 1 | 2; withCore: boolean };

export class TrainingDirector {
  private stepIndex = 0;
  private finishAnnounced = false;
  private lastBanner: MessageKey | null = null;
  private pending: SemanticEvent[] = [];
  /**
   * O `abilityCooldownUntil` do quadro anterior.
   *
   * Disparar o Eco nao emite evento proprio (cada habilidade emite o SEU: um
   * pulso, um cone, uma cadeia), e escrever a lista das sete aqui seria um
   * lugar a mais para esquecer a oitava. O que TODAS fazem e acender a
   * recarga, entao a borda de subida deste numero e a definicao mais estavel
   * de "usou a habilidade" que o estado oferece.
   */
  private lastAbilityCooldown = 0;
  /** Dicas ortogonais aos passos; cada uma sai UMA vez por tentativa. */
  private tipsShown = new Set<string>();

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
    this.pending = [];

    // Os fatos do quadro, antes do avanco: uma acao instantanea daqui tem de
    // valer para o passo que este mesmo quadro vai ativar.
    const facts: TrainingFacts = {
      dodged: events.some((e) => e.t === 'dodge'),
      abilityCast: state.playerExtra.abilityCooldownUntil > this.lastAbilityCooldown,
    };
    this.lastAbilityCooldown = state.playerExtra.abilityCooldownUntil;

    // -----------------------------------------------------------------------
    // As dicas: ortogonais aos passos, porque respondem a um ACONTECIMENTO e
    // nao a um progresso. Cada uma so aparece no unico momento em que ela e
    // resposta, e nao ruido.
    // -----------------------------------------------------------------------
    if (events.some((e) => e.t === 'overheat')) {
      this.tip(cues, 'heat', 'training.tip.heat', 1650);
    }
    if (events.some((e) => e.t === 'purge_cell_acquired')) {
      this.tip(cues, 'purge', 'training.tip.purge', 900);
    }
    if (events.some((e) => e.t === 'sector_entered' && state.sector > 1)) {
      this.tip(cues, 'contamination', 'training.tip.contamination', 1400);
    }
    // A PRIMEIRA descoberta da tentativa e o gancho do arquivo: e o momento em
    // que o jogador acaba de gerar um documento sem saber que documentos
    // existem. O debriefing termina de contar; aqui so se planta a palavra.
    if (state.stats.discoveries !== 0) {
      this.tip(cues, 'archive', 'training.tip.archive', 1200);
    }

    // `while` e nao `if`: um fato consumado fora de ordem faz o passo dele
    // concluir NO INSTANTE em que vira o ativo.
    while (this.stepIndex < STEPS.length) {
      const step = STEPS[this.stepIndex];
      const done = step.isComplete(state, facts);
      if (!done && !step.dispensedBy?.(state)) break;
      // So quem FEZ e parabenizado: um passo dispensado passa em silencio.
      if (done && step.doneToast) cues.push({ type: 'toast', key: step.doneToast });
      this.stepIndex++;
    }

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

  private tip(cues: TrainingCue[], id: string, key: MessageKey, delayMs: number): void {
    if (this.tipsShown.has(id)) return;
    this.tipsShown.add(id);
    cues.push({ type: 'toast', key, delayMs });
  }

  get finished(): boolean {
    return this.stepIndex >= STEPS.length;
  }

  get currentStep(): TrainingStepId | null {
    return this.finished ? null : STEPS[this.stepIndex].id;
  }

  /**
   * A instrucao que DEVERIA estar na tela agora, ou `null` quando nao ha uma.
   *
   * O banner e compartilhado com os avisos do cliente (o de qualidade
   * adaptativa e o mais comum), e um aviso que se limpa sozinho limpa a
   * instrucao junto. Como o diretor so reemite quando a MENSAGEM muda, sem
   * isto a licao sumia da tela para sempre — e o exercicio ficava mudo
   * exatamente nas maquinas fracas, que sao onde a qualidade cai.
   */
  get standingBanner(): MessageKey | null {
    return this.lastBanner;
  }

  /** O checkpoint da licao corrente, sem mexer em nada. */
  get checkpoint(): TrainingCheckpoint {
    const step = STEPS[Math.min(this.stepIndex, STEPS.length - 1)];
    return { sector: step.sector, withCore: this.stepIndex > CORE_STEP };
  }

  /**
   * Perder a unidade nao apaga o exercicio: ele volta ao checkpoint do trecho
   * em que a licao estava, e devolve qual e para quem reconstroi o mundo.
   *
   * O treinamento existe para ensinar, nao para filtrar — refazer a galeria
   * inteira porque um espreitador acertou o tampao seria cobrar do novato
   * exatamente o tempo que a operacao promete economizar. O que se perde e o
   * progresso DENTRO do trecho, que e o mesmo que a simulacao perde ao
   * reconstruir o setor.
   */
  rewind(): TrainingCheckpoint {
    const checkpoint = this.checkpoint;
    this.stepIndex = checkpoint.withCore
      ? RETURN_STEP[checkpoint.sector]
      : FIRST_STEP_OF_SECTOR[checkpoint.sector];
    this.finishAnnounced = false;
    this.lastBanner = null;
    this.pending = [];
    // O mundo vai ser reconstruido com o relogio no zero; sem zerar a marca
    // d'agua junto, a borda de subida nunca mais aconteceria e a licao do Eco
    // ficaria impossivel depois da primeira morte.
    this.lastAbilityCooldown = 0;
    return checkpoint;
  }

  /** Recomeco da tentativa inteira (o exercicio, do zero). */
  reset(): void {
    this.stepIndex = 0;
    this.finishAnnounced = false;
    this.lastBanner = null;
    this.pending = [];
    this.lastAbilityCooldown = 0;
    this.tipsShown.clear();
  }
}
