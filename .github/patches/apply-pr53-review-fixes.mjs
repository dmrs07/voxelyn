import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const replaceExact = (path, before, after, expected = 1) => {
  const source = readFileSync(path, 'utf8');
  const matches = source.split(before).length - 1;
  if (matches !== expected) {
    throw new Error(`${path}: expected ${expected} occurrence(s), found ${matches}`);
  }
  writeFileSync(path, source.replace(before, after), 'utf8');
};

// Idempotent: the validation workflow can be re-run in the same worktree.
const marker = 'export const runSummaryIdentity = (summary: RunSummary): string =>';
if (!readFileSync('packages/voxelyn-survival/src/client/records.ts', 'utf8').includes(marker)) {
  replaceExact(
    'packages/voxelyn-survival/src/client/records.ts',
    `export const applyRun = (records: Records, summary: RunSummary): Records => {`,
    `/** Stable across JSON/WebSocket copies of the same frozen terminal run. */
export const runSummaryIdentity = (summary: RunSummary): string =>
  \`${'${summary.seed}:${summary.phase}:${summary.ticks}'}\`;

export type ApplyRunOnceResult = {
  records: Records;
  identity: string;
  applied: boolean;
};

/** Pure idempotency boundary used by the online and solo result screens. */
export const applyRunOnce = (
  records: Records,
  summary: RunSummary,
  previousIdentity: string | null,
): ApplyRunOnceResult => {
  const identity = runSummaryIdentity(summary);
  if (identity === previousIdentity) return { records, identity, applied: false };
  return { records: applyRun(records, summary), identity, applied: true };
};

export const applyRun = (records: Records, summary: RunSummary): Records => {`,
  );

  replaceExact(
    'packages/voxelyn-survival/src/client/main.ts',
    `import { applyRun, loadRecords, saveRecords, type Records } from './records';`,
    `import { applyRunOnce, loadRecords, saveRecords, type Records } from './records';`,
  );
  replaceExact(
    'packages/voxelyn-survival/src/client/main.ts',
    ` * O guard por identidade do sumario e o que impede a run de ser contada a cada
 * quadro: a fase terminal persiste, o loop continua desenhando, e sem ele o
 * historico ganharia sessenta copias por segundo da mesma morte.
 */
let recordedSummary: unknown = null;`,
    ` * A identidade usa campos congelados, nao referencia do objeto: no online cada
 * snapshot desserializa uma nova copia da mesma run terminal.
 */
let recordedSummaryKey: string | null = null;`,
  );
  replaceExact(
    'packages/voxelyn-survival/src/client/main.ts',
    `const recordRun = (state: SurvivalState): void => {
  if (!state.summary || state.summary === recordedSummary) return;
  recordedSummary = state.summary;
  records = applyRun(records, state.summary);
  saveRecords(records);
};`,
    `const recordRun = (state: SurvivalState): void => {
  if (!state.summary) return;
  const result = applyRunOnce(records, state.summary, recordedSummaryKey);
  recordedSummaryKey = result.identity;
  if (!result.applied) return;
  records = result.records;
  saveRecords(records);
};`,
  );
  replaceExact(
    'packages/voxelyn-survival/src/client/main.ts',
    `recordedSummary = null;`,
    `recordedSummaryKey = null;`,
    2,
  );

  replaceExact(
    'packages/voxelyn-survival/src/client/records.test.ts',
    `import { HISTORY_LIMIT, applyRun, emptyRecords, hasDiscovery } from './records';`,
    `import { HISTORY_LIMIT, applyRun, applyRunOnce, emptyRecords, hasDiscovery } from './records';`,
  );
  replaceExact(
    'packages/voxelyn-survival/src/client/records.test.ts',
    `  // applyRun e pura porque este e o unico lugar do cliente em que um bug
  // silencioso custaria dado do jogador.`,
    `  it('deduplica copias JSON da mesma run, mas aceita uma nova run apos reset', () => {
    const original = summary({ seed: 42, phase: 'extracted', ticks: 777, stars: 1 });
    const copy = JSON.parse(JSON.stringify(original)) as RunSummary;
    const first = applyRunOnce(emptyRecords(), original, null);
    const duplicate = applyRunOnce(first.records, copy, first.identity);
    expect(duplicate.applied).toBe(false);
    expect(duplicate.records.totals.runs).toBe(1);

    // Reiniciar limpa a identidade da tela; a mesma seed/resultado pode ser jogada de novo.
    const nextRun = applyRunOnce(duplicate.records, copy, null);
    expect(nextRun.applied).toBe(true);
    expect(nextRun.records.totals.runs).toBe(2);
  });

  // applyRun e pura porque este e o unico lugar do cliente em que um bug
  // silencioso custaria dado do jogador.`,
  );

  replaceExact(
    'packages/voxelyn-survival-server/src/leaderboard.ts',
    `const totalKills = (summary: RunSummary): number =>
  Object.values(summary.stats.kills).reduce((a, b) => a + b, 0);`,
    `const totalKills = (summary: RunSummary): number =>
  Object.values(summary.stats.kills).reduce((a, b) => a + b, 0);

/** Only successful extractions are eligible for either leaderboard mode. */
export const isLeaderboardEligible = (summary: RunSummary): boolean =>
  summary.phase === 'extracted' || summary.phase === 'extracted_with_core';`,
  );
  replaceExact(
    'packages/voxelyn-survival-server/src/leaderboard.ts',
    `  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    if (input.digest && this.digests.has(input.digest)) return null;`,
    `  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    if (!isLeaderboardEligible(input.summary)) return null;
    if (input.digest && this.digests.has(input.digest)) return null;`,
    1,
  );
  replaceExact(
    'packages/voxelyn-survival-server/src/leaderboard.ts',
    `        (r) =>
          (query.seed === undefined || r.seed === query.seed) &&`,
    `        (r) =>
          r.phase !== 'dead' &&
          (query.seed === undefined || r.seed === query.seed) &&`,
  );
  replaceExact(
    'packages/voxelyn-survival-server/src/leaderboard.ts',
    `  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    // \`on conflict do nothing\` faz a deduplicacao no BANCO e nao na aplicacao:`,
    `  async submit(input: SubmitInput): Promise<LeaderboardEntry | null> {
    if (!isLeaderboardEligible(input.summary)) return null;
    // \`on conflict do nothing\` faz a deduplicacao no BANCO e nao na aplicacao:`,
  );
  replaceExact(
    'packages/voxelyn-survival-server/src/leaderboard.ts',
    `  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const conditions: string[] = [];`,
    `  async top(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    // Hide legacy failed rows that may have been stored before eligibility was enforced.
    const conditions: string[] = [\`phase <> 'dead'\`];`,
  );

  replaceExact(
    'packages/voxelyn-survival-server/src/ws.ts',
    `      if (!summary || !leaderboardStore) return;`,
    `      if (!summary || summary.phase === 'dead' || !leaderboardStore) return;`,
  );

  replaceExact(
    'packages/voxelyn-survival-server/src/server.ts',
    `      const terminal =
        room.state.phase === 'dead' ||
        room.state.phase === 'extracted' ||
        room.state.phase === 'extracted_with_core';
      // Dispara UMA vez por sala. A fase terminal persiste e o loop continua
      // rodando ate a sala expirar; sem a marca, o mesmo resultado entraria no
      // ranking vinte vezes por segundo.
      if (terminal && !room.resultReported && room.state.summary) {
        room.resultReported = true;
        this.onRunFinished?.(room);
      }
      // salas terminadas nao avancam a sim, mas ainda podem emitir um snapshot final
      const { events, chunkDiffs, removed } = terminal
        ? { events: [], chunkDiffs: [], removed: [] }
        : room.step();`,
    `      const wasTerminal = room.state.phase !== 'running';
      // Salas ja terminadas nao avancam; salas correndo podem terminar NESTE passo.
      const { events, chunkDiffs, removed } = wasTerminal
        ? { events: [], chunkDiffs: [], removed: [] }
        : room.step();
      const terminal = room.state.phase !== 'running';
      // Reporta no MESMO tick que congelou o sumario, antes do snapshot final.
      // Assim o ultimo socket pode fechar logo apos recebe-lo sem perder o resultado.
      if (terminal && !room.resultReported && room.state.summary) {
        room.resultReported = true;
        this.onRunFinished?.(room);
      }`,
  );

  replaceExact(
    'packages/voxelyn-survival-server/tests/leaderboard.test.ts',
    `import { MemoryLeaderboard, compareEntries, type LeaderboardEntry } from '../src/leaderboard';`,
    `import { MemoryLeaderboard, compareEntries, isLeaderboardEligible, type LeaderboardEntry } from '../src/leaderboard';`,
  );
  replaceExact(
    'packages/voxelyn-survival-server/tests/leaderboard.test.ts',
    `  it('runs de co-op nao deduplicam entre si', async () => {`,
    `  it('recusa derrotas e nunca as devolve no ranking', async () => {
    const store = new MemoryLeaderboard();
    const dead = summary({ phase: 'dead', stars: 0, deathCause: { kind: 'fire' } });
    expect(isLeaderboardEligible(dead)).toBe(false);
    expect(await store.submit({ name: 'derrota', mode: 'coop', summary: dead, digest: null })).toBeNull();
    await store.submit({ name: 'extracao', mode: 'coop', summary: summary(), digest: null });
    expect((await store.top({})).map((entry) => entry.name)).toEqual(['extracao']);
  });

  it('runs de co-op nao deduplicam entre si', async () => {`,
  );

  writeFileSync(
    'packages/voxelyn-survival-server/tests/run-finished.test.ts',
    `import { describe, expect, it } from 'vitest';
import { CURRENT_VERSIONS, type ServerMessage } from '@voxelyn/survival-protocol';
import { SurvivalServer } from '../src/server';
import type { GameRoom } from '../src/room';

describe('resultado terminal da sala', () => {
  it('reporta no mesmo tick do snapshot final e apenas uma vez', () => {
    const finished: GameRoom[] = [];
    const server = new SurvivalServer({
      maxPlayersPerRoom: 1,
      baseSeed: 123,
      onRunFinished: (room) => finished.push(room),
    });
    server.addConnection('a', 0);
    server.handleMessage('a', JSON.stringify({ t: 'hello', versions: CURRENT_VERSIONS }), 0);
    const room = server.roomForClient('a');
    expect(room).not.toBeNull();

    // A morte e o summary nascem dentro de room.step(), neste server.tick().
    room!.state.players[0].hp = 0;
    const outbound = server.tick();

    expect(room!.state.phase).toBe('dead');
    expect(room!.state.summary).not.toBeNull();
    expect(finished).toEqual([room]);
    expect(room!.resultReported).toBe(true);
    const finalSnapshot = outbound
      .map((item) => item.msg)
      .find((msg): msg is Extract<ServerMessage, { t: 'snapshot' }> => msg.t === 'snapshot');
    expect(finalSnapshot?.phase).toBe('dead');

    // O ultimo cliente fecha imediatamente depois de receber o snapshot terminal.
    server.removeConnection('a');
    expect(server.roomCount()).toBe(0);
    server.tick();
    expect(finished).toHaveLength(1);
  });
});
`,
    'utf8',
  );

  replaceExact(
    'render.yaml',
    `databases:
  - name: voxelyn-leaderboard
    plan: free`,
    `databases:
  - name: voxelyn-leaderboard
    region: virginia
    plan: free`,
  );

  const deploy = 'docs/deploy/render.md';
  replaceExact(deploy, 'Blueprint: [`render.yaml`](../../render.yaml). Dois serviços:', 'Blueprint: [`render.yaml`](../../render.yaml). Três recursos:');
  replaceExact(deploy, '- **voxelyn-survival-client** — Static Site (PWA).', '- **voxelyn-survival-client** — Static Site (PWA).\n- **voxelyn-leaderboard** — Render Postgres, usado somente pelo ranking.');
  replaceExact(deploy, 'Durante o alpha o servidor roda em **instância única** (o estado das salas é em\nmemória; sem Postgres nem Key Value). Não escale horizontalmente ainda — dois\nprocessos não compartilham salas.', 'Durante o alpha o servidor roda em **instância única**: o estado das salas continua\nem memória e dois processos não compartilhariam partidas. O Postgres persiste apenas\no ranking; ele não torna as salas distribuídas.');
  replaceExact(deploy, '`render.yaml` e cria os dois serviços.', '`render.yaml` e cria o Web Service, o Static Site e o banco Postgres.');
  replaceExact(deploy, '| server | `NODE_VERSION` | `22.22.0` | build |', '| server | `NODE_VERSION` | `22.22.0` | build |\n| server | `DATABASE_URL` | injetada por `fromDatabase.connectionString` | runtime |');
  replaceExact(
    deploy,
    `O Render já executa a instalação de dependências com pnpm antes do comando de
build. Por isso o blueprint chama somente os scripts necessários:

\`\`\`sh
pnpm --filter @voxelyn/survival-server... build
pnpm --filter @voxelyn/survival... build
\`\`\`

Não execute \`corepack enable\` no \`buildCommand\`: no ambiente do Render ele pode
tentar recriar links em \`/usr/bin\`, que é somente leitura. Também não é
necessário repetir \`pnpm install\` dentro do comando de build.`,
    `O checkout do Render é limpo. Os dois recursos executam explicitamente a mesma
preparação declarada no Blueprint e falham alto se o lockfile estiver defasado:

\`\`\`sh
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @voxelyn/survival-server... build # servidor
pnpm --filter @voxelyn/survival... build        # cliente
\`\`\`

Mantenha esta seção sincronizada com \`render.yaml\`; não dependa de uma instalação
implícita fora do \`buildCommand\`.`,
  );
  replaceExact(deploy, '4. encerra HTTP e sai com código 0.', '4. encerra HTTP, fecha o pool do ranking e sai com código 0.');
  replaceExact(deploy, '- Sem Postgres (não há persistência real) nem Render Key Value (não há múltiplas\n  instâncias/matchmaking distribuído).', '- O Postgres persiste somente o ranking. Não há Render Key Value nem múltiplas\n  instâncias/matchmaking distribuído.\n- O plano gratuito do Postgres é adequado ao alpha, mas expira após 30 dias. Para\n  ranking persistente em produção, altere o banco para um plano pago antes disso.');
}

console.log('PR #53 review fixes applied');
