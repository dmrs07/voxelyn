// Registro de runs em memoria para o agente MCP.
//
// Cada run aqui e SOLO (playerCount fixo em 1): o agente controla um unico
// Prospector, no mesmo desenho que `resimulateRun` ja usa para verificar o
// leaderboard (ver @voxelyn/survival-server/replay.ts). Isso simplifica o
// modelo de acao para "um comando por tick" e mantem o log de comandos
// diretamente compativel com o formato que o servidor real sabe re-simular —
// nao existe um segundo protocolo de replay, e o mesmo log RLE.
import { randomUUID } from 'node:crypto';
import {
  createRun,
  emptyCommand,
  stepRun,
  type PlayerCommand,
  type RunSummary,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { encodeCommandLog, quantizeCommand, toBase64 } from '@voxelyn/survival-protocol';

/**
 * O que o agente pode enviar num `act`. Todos os campos sao opcionais e caem
 * no default neutro de `emptyCommand` — um agente que so quer andar nao
 * precisa listar `fire: false, dodge: false, ...` toda vez.
 */
export type AgentAction = {
  move?: { x: number; y: number };
  aim?: { x: number; y: number };
  fire?: boolean;
  ability?: boolean;
  dodge?: boolean;
  interact?: boolean;
  purge?: boolean;
  choose?: 0 | 1 | null;
};

const toCommand = (action: AgentAction): PlayerCommand => {
  const base = emptyCommand();
  return {
    move: action.move ?? base.move,
    aim: action.aim ?? base.aim,
    fire: action.fire ?? base.fire,
    ability: action.ability ?? base.ability,
    dodge: action.dodge ?? base.dodge,
    interact: action.interact ?? base.interact,
    purge: action.purge ?? base.purge,
    choose: action.choose ?? base.choose,
  };
};

export type AgentRun = {
  id: string;
  seed: number;
  state: SurvivalState;
  /** Um comando QUANTIZADO por tick, na mesma codificacao que o cliente real grava. */
  commandLog: PlayerCommand[];
  createdAt: number;
};

const runs = new Map<string, AgentRun>();

export const createAgentRun = (seed: number): AgentRun => {
  const state = createRun({ seed, playerCount: 1 });
  const run: AgentRun = { id: randomUUID(), seed, state, commandLog: [], createdAt: Date.now() };
  runs.set(run.id, run);
  return run;
};

export const getAgentRun = (id: string): AgentRun | undefined => runs.get(id);

export const listAgentRuns = (): AgentRun[] => [...runs.values()];

export const deleteAgentRun = (id: string): boolean => runs.delete(id);

/** Teto por chamada: um agente que peca 100000 ticks nao trava o processo. */
export const MAX_TICKS_PER_ACT = 400;

export type ActResult = {
  ticksApplied: number;
  /** Um array de eventos por tick avancado, na mesma ordem. */
  events: SemanticEvent[][];
  /** A run deixou de estar `running` durante este lote. */
  finished: boolean;
};

/**
 * Aplica a MESMA acao por `ticks` ticks (ou ate a run terminar, o que vier
 * primeiro). Repetir a acao — e nao exigir uma chamada por tick a 20 Hz — e o
 * que torna viavel um agente de LLM jogar: decidir uma intencao curta
 * ("anda nessa direcao mirando ali, atirando") e deixar a simulacao rodar por
 * meio segundo a um segundo antes de decidir de novo.
 *
 * O comando e QUANTIZADO antes de entrar em `stepRun`, pelo mesmo motivo do
 * cliente real (ver command-log.ts): sem isso o log exportado divergiria do
 * que a simulacao efetivamente viveu, e o replay deixaria de ser exato.
 */
export const applyAction = (run: AgentRun, action: AgentAction, ticks: number): ActResult => {
  const clamped = Math.max(1, Math.min(MAX_TICKS_PER_ACT, Math.floor(ticks)));
  const command = quantizeCommand(toCommand(action));
  const events: SemanticEvent[][] = [];
  let applied = 0;
  for (let i = 0; i < clamped; i++) {
    if (run.state.phase !== 'running') break;
    const result = stepRun(run.state, [command]);
    run.commandLog.push(command);
    events.push(result.events);
    applied++;
  }
  return { ticksApplied: applied, events, finished: run.state.phase !== 'running' };
};

export type ReplayExport = { seed: number; log: string; ticks: number };

/**
 * O log desta run, no MESMO formato que `SoloRunSubmission.log` espera. Quem
 * quiser confirmar um resultado por fora (ou alimentar o leaderboard real) usa
 * `verifySoloRun(seed, log)` de @voxelyn/survival-server sem tocar em nada
 * daqui: e o ponto inteiro de reusar o codec em vez de inventar um formato novo.
 */
export const exportReplay = (run: AgentRun): ReplayExport => ({
  seed: run.seed,
  log: toBase64(encodeCommandLog(run.commandLog)),
  ticks: run.state.tick,
});

export const runSummary = (run: AgentRun): RunSummary | null => run.state.summary;
