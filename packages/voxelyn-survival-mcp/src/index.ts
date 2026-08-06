#!/usr/bin/env node
// Servidor MCP do Voxelyn Survival: da a um agente de LLM as maos para jogar
// a simulacao headless de verdade (sem browser, sem WebSocket), exportar o
// resultado no MESMO formato de replay que o servidor real re-simula para o
// leaderboard, e agregar telemetria das runs que ele proprio jogou — o
// insumo para apontar desbalanceamento em vez de so jogar.
//
// Este processo nunca importa nada de rede: so @voxelyn/survival-sim (a
// simulacao) e @voxelyn/survival-protocol (o codec de comando/replay, que ja
// roda nos dois lados do jogo real). O `stdio` e so o transporte MCP.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  MAX_TICKS_PER_ACT,
  applyAction,
  createAgentRun,
  deleteAgentRun,
  exportReplay,
  getAgentRun,
  listAgentRuns,
  runSummary,
  type AgentAction,
} from './runs.js';
import { MAX_WINDOW_RADIUS, buildAgentSnapshot } from './snapshot.js';
import { clearAgentRunRecords, recordAgentRun, telemetryDigest } from './telemetry.js';
import type { SemanticEvent } from '@voxelyn/survival-sim';

const server = new McpServer({
  name: 'voxelyn-survival',
  version: '0.1.0',
  title: 'Voxelyn Survival — agente de playtest',
});

const json = (data: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

const error = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
});

/** Teto de eventos devolvidos por `act`. Acima disso so a contagem sobrevive. */
const MAX_RETURNED_EVENTS = 300;

const flattenEvents = (
  perTick: SemanticEvent[][],
): { events: SemanticEvent[]; totalEvents: number; truncated: number } => {
  const flat = perTick.flat();
  if (flat.length <= MAX_RETURNED_EVENTS) {
    return { events: flat, totalEvents: flat.length, truncated: 0 };
  }
  return {
    events: flat.slice(0, MAX_RETURNED_EVENTS),
    totalEvents: flat.length,
    truncated: flat.length - MAX_RETURNED_EVENTS,
  };
};

const vec2 = z.object({ x: z.number(), y: z.number() });
const runIdShape = { runId: z.string().describe('id devolvido por survival_new_run') };
const windowRadiusShape = {
  windowRadius: z
    .number()
    .int()
    .min(1)
    .max(MAX_WINDOW_RADIUS)
    .optional()
    .describe(
      `raio (em tiles) da janela de terreno ao redor do jogador; default 12, teto ${MAX_WINDOW_RADIUS}`,
    ),
};

server.registerTool(
  'survival_new_run',
  {
    title: 'Iniciar uma run solo',
    description:
      'Cria uma nova run SOLO (um Prospector) da simulacao headless do Voxelyn Survival e devolve o id da run ' +
      'junto com o snapshot inicial. A seed decide o mundo e a run inteira e determinista a partir dela — a ' +
      'mesma seed com os mesmos comandos sempre produz o mesmo resultado.',
    inputSchema: {
      seed: z
        .number()
        .int()
        .min(0)
        .max(0xffffffff)
        .optional()
        .describe('seed do mundo; se omitida, uma seed aleatoria e escolhida'),
      windowRadius: windowRadiusShape.windowRadius,
    },
  },
  async ({ seed, windowRadius }) => {
    const actualSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
    const run = createAgentRun(actualSeed);
    return json({
      runId: run.id,
      seed: run.seed,
      snapshot: buildAgentSnapshot(run.state, windowRadius),
    });
  },
);

server.registerTool(
  'survival_act',
  {
    title: 'Agir por N ticks',
    description:
      `Aplica a MESMA acao repetida por ate ${MAX_TICKS_PER_ACT} ticks (20 por segundo de jogo) e devolve o novo ` +
      'snapshot mais os eventos semanticos ocorridos (tiros, mortes, explosoes, etc). Segurar a mesma acao por ' +
      'varios ticks e o jeito de jogar sem precisar decidir a 20 Hz: escolha uma intencao curta (andar nessa ' +
      'direcao, mirar ali, atirando) e deixe alguns ticks passarem antes de decidir de novo. Para no meio do ' +
      'lote se a run terminar (morte, extracao).',
    inputSchema: {
      ...runIdShape,
      ticks: z.number().int().min(1).max(MAX_TICKS_PER_ACT).optional().describe('default 1'),
      move: vec2
        .optional()
        .describe('direcao de movimento; magnitude 0..1, nao precisa ser unitaria'),
      aim: vec2
        .optional()
        .describe('direcao de mira/tiro; so o RUMO importa, a magnitude e normalizada'),
      fire: z.boolean().optional(),
      ability: z
        .boolean()
        .optional()
        .describe('usa a habilidade equipada (pulse/flamethrower/seeker/arc)'),
      dodge: z.boolean().optional(),
      interact: z
        .boolean()
        .optional()
        .describe('interage com terminal de salvage, poco, nucleo, etc'),
      purge: z
        .boolean()
        .optional()
        .describe('consome uma celula de purga no material sob o jogador'),
      choose: z
        .union([z.literal(0), z.literal(1), z.null()])
        .optional()
        .describe('resolve uma escolha de modulo pendente (ver pendingModuleChoice no snapshot)'),
      windowRadius: windowRadiusShape.windowRadius,
    },
  },
  async ({
    runId,
    ticks,
    move,
    aim,
    fire,
    ability,
    dodge,
    interact,
    purge,
    choose,
    windowRadius,
  }) => {
    const run = getAgentRun(runId);
    if (!run) return error(`run '${runId}' nao encontrada`);
    const action: AgentAction = { move, aim, fire, ability, dodge, interact, purge, choose };
    const result = applyAction(run, action, ticks ?? 1);
    const { events, totalEvents, truncated } = flattenEvents(result.events);
    return json({
      ticksApplied: result.ticksApplied,
      finished: result.finished,
      totalEvents,
      truncatedEvents: truncated,
      events,
      snapshot: buildAgentSnapshot(run.state, windowRadius),
      summary: result.finished ? runSummary(run) : null,
    });
  },
);

server.registerTool(
  'survival_snapshot',
  {
    title: 'Ler o estado atual sem agir',
    description:
      'Devolve o snapshot legivel da run atual (posicao, hp, inimigos proximos, terreno local, etc) sem avancar nenhum tick.',
    inputSchema: { ...runIdShape, ...windowRadiusShape },
  },
  async ({ runId, windowRadius }) => {
    const run = getAgentRun(runId);
    if (!run) return error(`run '${runId}' nao encontrada`);
    return json(buildAgentSnapshot(run.state, windowRadius));
  },
);

server.registerTool(
  'survival_run_summary',
  {
    title: 'Ler o resultado final da run',
    description:
      'Devolve o RunSummary autoritativo (causa da morte, estrelas, estatisticas) quando a run ja terminou; null enquanto ainda esta em andamento.',
    inputSchema: { ...runIdShape },
  },
  async ({ runId }) => {
    const run = getAgentRun(runId);
    if (!run) return error(`run '${runId}' nao encontrada`);
    return json({ phase: run.state.phase, summary: runSummary(run) });
  },
);

server.registerTool(
  'survival_export_replay',
  {
    title: 'Exportar o replay da run',
    description:
      'Devolve { seed, log } no MESMO formato de SoloRunSubmission que o servidor real do Voxelyn Survival ' +
      're-simula para verificar o leaderboard (ver @voxelyn/survival-server verifySoloRun). Nao e um formato ' +
      'novo: e o log de comandos RLE em base64, reproduzivel por qualquer maquina que rode a mesma simulacao.',
    inputSchema: { ...runIdShape },
  },
  async ({ runId }) => {
    const run = getAgentRun(runId);
    if (!run) return error(`run '${runId}' nao encontrada`);
    return json(exportReplay(run));
  },
);

server.registerTool(
  'survival_list_runs',
  {
    title: 'Listar runs em memoria',
    description:
      'Lista todas as runs criadas nesta sessao do servidor, com seed, tick atual e fase.',
    inputSchema: {},
  },
  async () =>
    json(
      listAgentRuns().map((r) => ({
        runId: r.id,
        seed: r.seed,
        tick: r.state.tick,
        phase: r.state.phase,
      })),
    ),
);

server.registerTool(
  'survival_record_run',
  {
    title: 'Registrar o resultado da run para telemetria',
    description:
      'Registra o resultado de uma run TERMINADA (morte ou extracao) para o digest de telemetria. Falha se a ' +
      'run ainda estiver em andamento. Use `tag` para separar lotes/experimentos (ex.: "tuning-atual" vs ' +
      '"tuning-proposto") e comparar o digest de cada um separadamente. IDEMPOTENTE: chamar de novo para a ' +
      'mesma run devolve o registro original (`alreadyRecorded: true`) em vez de duplica-lo no digest.',
    inputSchema: {
      ...runIdShape,
      tag: z.string().max(64).optional().describe('rotulo do lote; default "default"'),
    },
  },
  async ({ runId, tag }) => {
    const run = getAgentRun(runId);
    if (!run) return error(`run '${runId}' nao encontrada`);
    const result = recordAgentRun(run, tag);
    if (!result) return error('a run ainda esta em andamento; jogue ate o fim antes de registrar');
    return json(result);
  },
);

server.registerTool(
  'survival_delete_run',
  {
    title: 'Descartar uma run da memoria',
    description:
      'Remove uma run do registro em memoria (ja registrada ou nao). Nao afeta a telemetria ja gravada.',
    inputSchema: { ...runIdShape },
  },
  async ({ runId }) => json({ deleted: deleteAgentRun(runId) }),
);

server.registerTool(
  'survival_telemetry_digest',
  {
    title: 'Agregar telemetria das runs jogadas',
    description:
      'Agrega as runs registradas com survival_record_run: funil de setores alcancados, distribuicao de ' +
      'estrelas, causas de morte mais comuns, tempo mediano de run por desfecho e tiros por abate. E o insumo ' +
      'para apontar onde o jogo mata demais ou de menos, e para comparar duas tags (ex.: antes/depois de um ajuste).',
    inputSchema: {
      tag: z.string().max(64).optional().describe('filtra por rotulo; omitido agrega tudo'),
    },
  },
  async ({ tag }) => json(telemetryDigest(tag)),
);

server.registerTool(
  'survival_telemetry_clear',
  {
    title: 'Limpar a telemetria acumulada',
    description:
      'Descarta todos os registros de telemetria desta sessao. Util para comecar um novo experimento do zero.',
    inputSchema: {},
  },
  async () => {
    clearAgentRunRecords();
    return json({ cleared: true });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
