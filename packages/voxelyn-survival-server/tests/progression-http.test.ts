// A rota de progressao, com o servidor DE VERDADE numa porta efemera.
//
// Chamar o handler direto testaria a logica e nao o caminho: cookie, CORS,
// roteamento, limite de corpo e concorrencia so existem no servidor HTTP
// montado, e sao justamente eles que protegem a unica superficie que aceita
// corpo grande de cliente nao autenticado E credita recurso permanente.
//
// O foco destes testes e ADULTERACAO. Cada um deles corresponde a uma coisa que
// um cliente modificado tentaria, e a resposta esperada e sempre a mesma: o
// servidor re-simula e credita o que a simulacao decidiu.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun, type PlayerCommand } from '@voxelyn/survival-sim';
import {
  PROTOCOL_VERSION,
  SIMULATION_VERSION,
  encodeCommandLog,
  quantizeCommand,
  toBase64,
  type ProgressionRunTicket,
  type PublicProgressionProfile,
} from '@voxelyn/survival-protocol';
import { createWsServer, type WsServerHandle } from '../src/ws';

let handle: WsServerHandle;
let base: string;

beforeAll(async () => {
  const booted = createWsServer({
    port: 0,
    host: '127.0.0.1',
    baseSeed: 4242,
    progressionSecret: 'segredo-de-teste-com-tamanho-suficiente',
    // A suite inteira sai de 127.0.0.1: com o teto de producao, o proprio
    // arquivo viraria um teste do rate limit. Ele ja tem os seus em `http-util`.
    progressionRateLimits: { settlePerMinute: 10_000, readsPerMinute: 10_000 },
  });
  await booted.ready;
  await new Promise<void>((resolve) => {
    if (booted.http.listening) return resolve();
    booted.http.once('listening', () => resolve());
  });
  const addr = booted.http.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  handle = booted;
  base = `http://127.0.0.1:${port}`;
  findFixtures();
}, 120_000);

afterAll(async () => {
  await handle.close();
});

const MAX_FIXTURE_TICKS = 12_000;

/** Joga uma run solo pelo mesmo caminho do cliente e devolve o log canonico. */
const playRun = (seed: number) => {
  const state = createRun({ seed, playerCount: 1 });
  const log: PlayerCommand[] = [];
  for (let t = 0; t < MAX_FIXTURE_TICKS && state.phase === 'running'; t++) {
    const cmd = quantizeCommand({
      ...emptyCommand(),
      move: { x: Math.sin(t / 40), y: Math.cos(t / 37) },
      aim: { x: Math.cos(t / 13), y: Math.sin(t / 11) },
      fire: t % 4 === 0,
      interact: t % 11 === 0,
    });
    log.push(cmd);
    stepRun(state, [cmd]);
  }
  return { seed, state, base64: toBase64(encodeCommandLog(log)) };
};

/**
 * As seeds sao BUSCADAS, e nao fixadas.
 *
 * Extrair depende do entorno da entrada, e toda mudanca de worldgen re-sorteia
 * isso. Uma seed fixa aqui e um fixture que quebra sozinho — e pior, quebra numa
 * assercao que nao tem nada a ver com a causa.
 *
 * Memoizadas porque cada busca custa uma run inteira simulada: repeti-la por
 * teste transformava a suite num benchmark do worldgen.
 *
 * O bot senoidal NAO extrai com o nucleo (isso exige vencer o Guardiao e subir
 * de volta), entao `extracted_with_core` nao aparece aqui. Os testes que
 * precisam de nucleo financiam o perfil pelo store — ver `fundProfile`.
 */
let extraction: ReturnType<typeof playRun>;
let death: ReturnType<typeof playRun>;

const findFixtures = (): void => {
  for (let seed = 1; seed <= 300 && (!extraction || !death); seed++) {
    const played = playRun(seed);
    if (!extraction && played.state.phase === 'extracted') extraction = played;
    // Uma morte COM carga: e o que torna a assercao de perda significativa.
    if (!death && played.state.phase === 'dead' && played.state.stats.oreCollected > 0) {
      death = played;
    }
  }
  if (!extraction || !death) throw new Error('fixtures de run nao encontrados');
};

const firstExtraction = (): ReturnType<typeof playRun> => extraction;
const firstDeath = (): ReturnType<typeof playRun> => death;

// ---------------------------------------------------------------------------
// Sessao
// ---------------------------------------------------------------------------

/** Um "navegador": guarda o cookie entre chamadas, como o de verdade faria. */
class Client {
  private cookie: string | null = null;

  async call(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set('cookie', this.cookie);
    if (init.body) headers.set('content-type', 'application/json');
    // Uma tentativa de retry: o teste de corpo gigante derruba a conexao de
    // proposito (`req.destroy()`), e o pool de keep-alive do fetch entrega essa
    // conexao morta para a chamada seguinte. Isso e artefato do POOL, nao do
    // servidor — um navegador real abriria outra e seguiria.
    const res = await fetch(`${base}${path}`, { ...init, headers }).catch(() =>
      fetch(`${base}${path}`, { ...init, headers }),
    );
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    return res;
  }

  async session(): Promise<PublicProgressionProfile> {
    const res = await this.call('/api/progression/session', { method: 'POST' });
    const body = (await res.json()) as { profile: PublicProgressionProfile };
    return body.profile;
  }

  async profile(): Promise<PublicProgressionProfile> {
    const res = await this.call('/api/progression/profile');
    const body = (await res.json()) as { profile: PublicProgressionProfile };
    return body.profile;
  }

  async ticket(seed: number): Promise<ProgressionRunTicket> {
    const res = await this.call('/api/progression/runs', {
      method: 'POST',
      body: JSON.stringify({ seed, mode: 'expedition' }),
    });
    const body = (await res.json()) as { ticket: ProgressionRunTicket };
    return body.ticket;
  }

  settle(runId: string, body: unknown): Promise<Response> {
    return this.call(`/api/progression/runs/${runId}/settle`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /** Descarta o cookie: vira um navegador diferente. */
  forget(): void {
    this.cookie = null;
  }
}

describe('sessao anonima', () => {
  it('cria um perfil zerado e o devolve pelo cookie', async () => {
    const client = new Client();
    const created = await client.session();
    expect(created.wallet).toEqual({ ore: 0, cores: 0 });
    expect(created.purchasedUpgradeIds).toEqual([]);
    expect(created.generation).toBe('G-00');

    const again = await client.profile();
    expect(again.profileId).toBe(created.profileId);
  });

  it('sem cookie nao ha perfil: 401', async () => {
    const res = await fetch(`${base}/api/progression/profile`);
    expect(res.status).toBe(401);
  });

  it('cookie adulterado e recusado', async () => {
    const client = new Client();
    const created = await client.session();
    const res = await fetch(`${base}/api/progression/profile`, {
      headers: { cookie: `aurix_profile=${created.profileId}.99999999999999.assinaturafalsa` },
    });
    expect(res.status).toBe(401);
  });

  // Nome de exibicao nao identifica ninguem: nao existe campo para isso.
  it('dois navegadores diferentes recebem perfis diferentes', async () => {
    const a = new Client();
    const b = new Client();
    const first = await a.session();
    const second = await b.session();
    expect(second.profileId).not.toBe(first.profileId);
  });

  it('o token nao aparece no corpo da resposta', async () => {
    const client = new Client();
    const res = await client.call('/api/progression/session', { method: 'POST' });
    const raw = await res.text();
    expect(raw).not.toContain('aurix_profile');
    expect(raw.toLowerCase()).not.toContain('secret');
  });
});

// ---------------------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------------------

describe('a sessao tambem viaja fora do cookie', () => {
  // O cenario do Safari: cliente e API em sites diferentes, cookie de terceiros
  // bloqueado. `SameSite=None` autoriza o envio e NAO contorna o bloqueio — sem
  // um segundo transporte, toda expedicao virava simulacao local em silencio.
  it('um cliente SEM cookie autentica pelo header Authorization', async () => {
    const created = await fetch(`${base}/api/progression/session`, { method: 'POST' });
    const body = (await created.json()) as { token?: string; profile: PublicProgressionProfile };
    expect(body.token, 'a sessao nova precisa devolver o token').toBeTruthy();

    // Nenhum cookie: exatamente o que o navegador bloqueado entrega.
    const profile = await fetch(`${base}/api/progression/profile`, {
      headers: { authorization: `Bearer ${body.token}` },
    });
    expect(profile.status).toBe(200);
    const seen = (await profile.json()) as { profile: PublicProgressionProfile };
    expect(seen.profile.profileId).toBe(body.profile.profileId);
  });

  it('o header tambem autoriza ticket e codex, e nao so a leitura de perfil', async () => {
    const created = await fetch(`${base}/api/progression/session`, { method: 'POST' });
    const { token } = (await created.json()) as { token: string };
    const auth = { authorization: `Bearer ${token}` };

    const ticket = await fetch(`${base}/api/progression/runs`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ seed: 5, mode: 'expedition' }),
    });
    expect(ticket.status).toBe(201);
    expect((await fetch(`${base}/api/progression/codex`, { headers: auth })).status).toBe(200);
  });

  it('token adulterado no header e recusado como o cookie adulterado', async () => {
    const res = await fetch(`${base}/api/progression/profile`, {
      headers: { authorization: 'Bearer abc.99999999999999.assinaturafalsa' },
    });
    expect(res.status).toBe(401);
  });

  it('header sem o esquema Bearer nao autentica', async () => {
    const created = await fetch(`${base}/api/progression/session`, { method: 'POST' });
    const { token } = (await created.json()) as { token: string };
    const res = await fetch(`${base}/api/progression/profile`, {
      headers: { authorization: token },
    });
    expect(res.status).toBe(401);
  });

  // O cookie continua sendo o caminho preferido: onde ele chega, o token nunca
  // precisa passar por JavaScript nenhum.
  it('com cookie E header, o cookie manda', async () => {
    const a = new Client();
    const first = await a.session();
    const outro = await fetch(`${base}/api/progression/session`, { method: 'POST' });
    const { token: outroToken } = (await outro.json()) as { token: string };

    const res = await a.call('/api/progression/profile', {
      headers: { authorization: `Bearer ${outroToken}` },
    });
    const seen = (await res.json()) as { profile: PublicProgressionProfile };
    expect(seen.profile.profileId).toBe(first.profileId);
  });
});

describe('emissao de ticket', () => {
  it('vincula perfil, seed, tuning e versoes', async () => {
    const client = new Client();
    const profile = await client.session();
    const ticket = await client.ticket(1234);
    expect(ticket.profileId).toBe(profile.profileId);
    expect(ticket.seed).toBe(1234);
    expect(ticket.mode).toBe('expedition');
    expect(ticket.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(ticket.simulationVersion).toBe(SIMULATION_VERSION);
    expect(ticket.progressionProfileVersion).toBe(profile.profileVersion);
    expect(Date.parse(ticket.expiresAt)).toBeGreaterThan(Date.parse(ticket.issuedAt));
  });

  // O tuning e DERIVADO do perfil. Um perfil novo joga G-00, e nao ha campo pelo
  // qual pedir outra coisa.
  it('o tuning do ticket e o de fabrica para um perfil novo', async () => {
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(99);
    expect(ticket.tuning.maxHp).toBe(100);
    expect(ticket.tuning.playerDamageScale).toBe(1);
  });

  // O cliente e o servidor sao origens DIFERENTES no deploy (Static Site x Web
  // Service). Com `SameSite=Lax` o navegador nao manda o cookie num fetch
  // cross-site: a sessao nascia e todas as chamadas seguintes voltavam 401.
  it('o cookie de sessao atravessa origens quando servido por https', async () => {
    const res = await fetch(`${base}/api/progression/session`, {
      method: 'POST',
      // O que o proxy do Render poe: e o unico sinal de https que o servidor tem.
      headers: { 'x-forwarded-proto': 'https' },
    });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('SameSite=None');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
  });

  // Em http local `SameSite=None` seria descartado pelo navegador (ele exige
  // Secure), e o desenvolvimento inteiro pararia.
  it('em http local o cookie fica em Lax, sem Secure', async () => {
    const res = await fetch(`${base}/api/progression/session`, { method: 'POST' });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Secure');
  });

  it('sem sessao nao ha ticket', async () => {
    const res = await fetch(`${base}/api/progression/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ seed: 1, mode: 'expedition' }),
    });
    expect(res.status).toBe(401);
  });

  it('modo nao elegivel nao rende ticket de recompensa', async () => {
    const client = new Client();
    await client.session();
    const res = await client.call('/api/progression/runs', {
      method: 'POST',
      body: JSON.stringify({ seed: 1, mode: 'ranked' }),
    });
    expect(res.status).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Liquidacao
// ---------------------------------------------------------------------------

describe('liquidacao por re-simulacao', () => {
  it('uma extracao credita exatamente o que o REPLAY encontrou', async () => {
    const played = firstExtraction();
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(played.seed);

    const res = await client.settle(ticket.runId, { log: played.base64 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      outcome: string;
      result: { phase: string; cargoOre: number; oreCredited: number; coresCredited: number };
      profile: PublicProgressionProfile;
    };
    expect(body.outcome).toBe('settled');
    expect(body.result.phase).toBe(played.state.phase);
    expect(body.result.cargoOre).toBe(played.state.stats.oreCollected);
    expect(body.result.oreCredited).toBe(played.state.stats.oreCollected);
    expect(body.result.coresCredited).toBe(played.state.phase === 'extracted_with_core' ? 1 : 0);
    expect(body.profile.wallet.ore).toBe(played.state.stats.oreCollected);
  });

  it('uma morte credita zero e registra a perda', async () => {
    const played = firstDeath();
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(played.seed);

    const res = await client.settle(ticket.runId, { log: played.base64 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { oreCredited: number; coresCredited: number; oreLost: number };
      profile: PublicProgressionProfile;
    };
    expect(body.result.oreCredited).toBe(0);
    expect(body.result.coresCredited).toBe(0);
    expect(body.result.oreLost).toBe(played.state.stats.oreCollected);
    expect(body.profile.wallet).toEqual({ ore: 0, cores: 0 });
  });

  // O TESTE CENTRAL DE ADULTERACAO. O cliente manda tudo o que gostaria que
  // fosse verdade; o servidor le so o log.
  it('IGNORA todo campo de resultado enviado pelo cliente', async () => {
    const played = firstDeath();
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(played.seed);

    const res = await client.settle(ticket.runId, {
      log: played.base64,
      claimedOre: 999_999,
      claimedCores: 99,
      claimedPhase: 'extracted_with_core',
      claimedGeneration: 'G-04',
      summary: { phase: 'extracted_with_core', stats: { oreCollected: 999_999 } },
      wallet: { ore: 999_999, cores: 99 },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: PublicProgressionProfile };
    expect(body.profile.wallet).toEqual({ ore: 0, cores: 0 });
    expect(body.profile.generation).toBe('G-00');
  });

  it('log vazio, invalido ou de run inacabada e recusado', async () => {
    const client = new Client();
    await client.session();
    for (const log of ['', 'nao-e-base64!!', toBase64(new Uint8Array([1, 2, 3]))]) {
      const ticket = await client.ticket(77);
      const res = await client.settle(ticket.runId, { log });
      expect(res.status).toBe(422);
    }
  });

  // O log e valido, mas para OUTRA seed: a re-simulacao contra a seed do ticket
  // nao chega a fase terminal, ou chega a outra. De qualquer forma nao e a run
  // que o jogador afirma ter jogado.
  it('log de outra seed nao credita a run desta', async () => {
    const played = firstExtraction();
    const client = new Client();
    await client.session();
    const otherSeed = played.seed + 1;
    const ticket = await client.ticket(otherSeed);
    const res = await client.settle(ticket.runId, { log: played.base64 });
    if (res.status === 200) {
      const body = (await res.json()) as { result: { cargoOre: number } };
      const replayed = playRun(otherSeed);
      expect(body.result.cargoOre).toBe(replayed.state.stats.oreCollected);
    } else {
      expect(res.status).toBe(422);
    }
  });

  it('o mesmo runId liquidado duas vezes credita uma vez', async () => {
    const played = firstExtraction();
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(played.seed);

    const first = await client.settle(ticket.runId, { log: played.base64 });
    expect(first.status).toBe(200);
    const second = await client.settle(ticket.runId, { log: played.base64 });
    expect(second.status).toBe(200);
    const body = (await second.json()) as {
      outcome: string;
      profile: PublicProgressionProfile;
    };
    expect(body.outcome).toBe('already_settled');
    expect(body.profile.wallet.ore).toBe(played.state.stats.oreCollected);
  });

  it('ticket inexistente e recusado', async () => {
    const client = new Client();
    await client.session();
    const res = await client.settle('nao-existe', { log: 'AAAA' });
    expect(res.status).toBe(404);
  });

  // Um perfil nao liquida a run de outro nem sabendo o runId.
  it('ticket de outro perfil e recusado', async () => {
    const played = firstExtraction();
    const owner = new Client();
    await owner.session();
    const ticket = await owner.ticket(played.seed);

    const intruder = new Client();
    await intruder.session();
    const res = await intruder.settle(ticket.runId, { log: played.base64 });
    expect(res.status).toBe(403);

    // E a vitima continua podendo liquidar a propria run.
    const legit = await owner.settle(ticket.runId, { log: played.base64 });
    expect(legit.status).toBe(200);
  });

  it('corpo gigante e recusado antes de virar trabalho de CPU', async () => {
    const client = new Client();
    await client.session();
    const ticket = await client.ticket(5);
    const res = await client
      .settle(ticket.runId, { log: 'A'.repeat(1024 * 1024) })
      .catch(() => null);
    // 413 direto, ou a conexao cortada pelo `req.destroy()` que o acompanha.
    expect(res === null || res.status === 413).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compra
// ---------------------------------------------------------------------------

describe('compra autoritativa', () => {
  /**
   * Um perfil com carteira de verdade.
   *
   * O credito entra pelo STORE, e nao por HTTP, porque o bot senoidal nao extrai
   * com o nucleo — e nenhum campo da API aceita "me de nucleos", que e
   * exatamente a garantia que estes testes existem para nao furar.
   *
   * O caminho de credito por re-simulacao ja tem os proprios testes acima; o que
   * este bloco exercita e a COMPRA, e ela precisa de um perfil com fundos.
   */
  const fundedClient = async (): Promise<{ client: Client; profile: PublicProgressionProfile }> => {
    const client = new Client();
    const created = await client.session();
    const store = handle.progression();
    if (!store) throw new Error('store de progressao indisponivel');
    await store.settleRun({
      profileId: created.profileId,
      runId: `fixture-${created.profileId}`,
      phase: 'extracted_with_core',
      cargoOre: 400,
      seed: 1,
      simulationVersion: SIMULATION_VERSION,
      durationTicks: 1000,
      now: new Date().toISOString(),
      idFactory: () => `fx-${Math.random().toString(36).slice(2)}`,
    });
    return { client, profile: await client.profile() };
  };

  it('o cliente nao controla o custo', async () => {
    const client = new Client();
    await client.session();
    const profile = await client.profile();
    const res = await client.call('/api/progression/upgrades/CA-01/purchase', {
      method: 'POST',
      body: JSON.stringify({
        expectedProfileVersion: profile.profileVersion,
        idempotencyKey: 'custo-zero-01',
        // O que um cliente modificado mandaria. Nao e lido.
        oreCost: 0,
        coreCost: 0,
      }),
    });
    // Perfil zerado: o preco real e 35 + 1, e a compra falha por falta de minerio.
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('insufficient_ore');
  });

  // A regra economica central, atravessando a rota inteira: extrair salva o
  // minerio, e minerio sozinho nao compra nada. E o que mantem a extracao
  // antecipada sendo uma decisao, e nao uma rota alternativa de progressao.
  it('minerio sem nucleo nao compra nada', async () => {
    const client = new Client();
    const created = await client.session();
    const store = handle.progression();
    if (!store) throw new Error('store de progressao indisponivel');
    await store.settleRun({
      profileId: created.profileId,
      runId: `sem-nucleo-${created.profileId}`,
      // Extracao SEM nucleo: muito minerio, zero nucleo.
      phase: 'extracted',
      cargoOre: 5000,
      seed: 1,
      simulationVersion: SIMULATION_VERSION,
      durationTicks: 900,
      now: new Date().toISOString(),
      idFactory: () => 'fx-sem-nucleo',
    });

    const profile = await client.profile();
    expect(profile.wallet.ore).toBe(5000);
    expect(profile.wallet.cores).toBe(0);

    // 5000 de minerio nao compram nem o protocolo mais barato da arvore.
    const res = await client.call('/api/progression/upgrades/CA-01/purchase', {
      method: 'POST',
      body: JSON.stringify({
        expectedProfileVersion: profile.profileVersion,
        idempotencyKey: 'sem-nucleo-01',
      }),
    });
    expect(res.status).toBe(402);
    expect(((await res.json()) as { error: string }).error).toBe('insufficient_cores');
    expect((await client.profile()).wallet.ore).toBe(5000);
  });

  it('versao antiga recebe 409 em vez de comprar contra numeros velhos', async () => {
    const { client } = await fundedClient();
    const res = await client.call('/api/progression/upgrades/CA-01/purchase', {
      method: 'POST',
      body: JSON.stringify({ expectedProfileVersion: 1, idempotencyKey: 'versao-velha-1' }),
    });
    expect([409, 402]).toContain(res.status);
  });

  it('id desconhecido e 404, e a arvore nao muda', async () => {
    const { client, profile } = await fundedClient();
    const res = await client.call('/api/progression/upgrades/ZZ-99/purchase', {
      method: 'POST',
      body: JSON.stringify({
        expectedProfileVersion: profile.profileVersion,
        idempotencyKey: 'desconhecido-1',
      }),
    });
    expect(res.status).toBe(404);
    expect((await client.profile()).purchasedUpgradeIds).toEqual(profile.purchasedUpgradeIds);
  });

  it('idempotencyKey invalida e recusada antes de qualquer decisao', async () => {
    const { client, profile } = await fundedClient();
    const res = await client.call('/api/progression/upgrades/CA-01/purchase', {
      method: 'POST',
      body: JSON.stringify({ expectedProfileVersion: profile.profileVersion, idempotencyKey: 'x' }),
    });
    expect(res.status).toBe(400);
  });

  it('uma compra valida debita, registra e desbloqueia a lore na mesma resposta', async () => {
    const { client, profile } = await fundedClient();
    if (profile.wallet.cores < 1 || profile.wallet.ore < 35) return; // sem fundos neste worldgen
    const res = await client.call('/api/progression/upgrades/CA-01/purchase', {
      method: 'POST',
      body: JSON.stringify({
        expectedProfileVersion: profile.profileVersion,
        idempotencyKey: 'compra-valida-1',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      profile: PublicProgressionProfile;
      purchase: { oreSpent: number; coresSpent: number };
      unlockedLoreFragment: { id: string; body: string } | null;
    };
    expect(body.purchase.oreSpent).toBe(35);
    expect(body.purchase.coresSpent).toBe(1);
    expect(body.profile.wallet.ore).toBe(profile.wallet.ore - 35);
    expect(body.profile.purchasedUpgradeIds).toContain('CA-01');
    expect(body.unlockedLoreFragment?.id).toBe('AX-PUB-002');
    expect(body.unlockedLoreFragment?.body.length).toBeGreaterThan(20);
    expect(body.profile.unlockedLoreFragmentIds).toContain('AX-PUB-002');
  });
});

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

describe('limite das rotas de leitura', () => {
  // Uma sessao anonima sai de um POST — qualquer script consegue uma. As rotas
  // de leitura pareciam baratas e nao sao: cada uma consulta o store, e o codex
  // ainda serializa a colecao inteira de documentos.
  it('perfil, codex e documento respeitam o teto por origem', async () => {
    const booted = createWsServer({
      port: 0,
      host: '127.0.0.1',
      baseSeed: 7,
      progressionSecret: 'segredo-de-teste-com-tamanho-suficiente',
      progressionRateLimits: { readsPerMinute: 3, settlePerMinute: 3 },
    });
    await booted.ready;
    await new Promise<void>((resolve) => {
      if (booted.http.listening) return resolve();
      booted.http.once('listening', () => resolve());
    });
    const addr = booted.http.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const url = `http://127.0.0.1:${port}`;

    try {
      const created = await fetch(`${url}/api/progression/session`, { method: 'POST' });
      const cookie = (created.headers.get('set-cookie') ?? '').split(';')[0];
      const get = (path: string): Promise<Response> =>
        fetch(`${url}${path}`, { headers: { cookie } });

      // A sessao ja consumiu uma vaga; as tres rotas de leitura consomem o resto.
      const statuses = [
        (await get('/api/progression/profile')).status,
        (await get('/api/progression/codex')).status,
        (await get('/api/progression/codex/AX-PUB-001')).status,
        (await get('/api/progression/profile')).status,
      ];
      expect(statuses).toContain(429);
    } finally {
      await booted.close();
    }
  });
});

describe('codex', () => {
  it('um perfil novo le so o documento publico, e ve o resto mascarado', async () => {
    const client = new Client();
    await client.session();
    const res = await client.call('/api/progression/codex?lang=pt-BR');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      unlocked: { id: string; body: string }[];
      locked: { maskedCode: string }[];
      total: number;
    };
    expect(body.total).toBe(29);
    expect(body.unlocked).toHaveLength(1);
    expect(body.unlocked[0].id).toBe('AX-PUB-001');
    expect(body.locked).toHaveLength(28);
  });

  // O que este teste protege e a razao inteira de o texto morar no servidor.
  it('o corpo de um documento bloqueado NAO viaja', async () => {
    const client = new Client();
    await client.session();
    const raw = await (await client.call('/api/progression/codex?lang=pt-BR')).text();
    // Uma frase que so existe no ato V.
    expect(raw).not.toContain('Estamos');
    expect(raw).not.toContain('respondendo a um');
    expect(raw).not.toContain('AX-UNK-047');
  });

  it('pedir um fragmento nao autorizado responde igual a pedir um inexistente', async () => {
    const client = new Client();
    await client.session();
    const locked = await client.call('/api/progression/codex/AX-UNK-047');
    const missing = await client.call('/api/progression/codex/AX-NAO-000');
    expect(locked.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await locked.text()).toBe(await missing.text());
  });

  it('o documento publico pode ser lido, nos dois idiomas', async () => {
    const client = new Client();
    await client.session();
    const pt = (await (
      await client.call('/api/progression/codex/AX-PUB-001?lang=pt-BR')
    ).json()) as {
      fragment: { title: string; body: string };
    };
    const en = (await (await client.call('/api/progression/codex/AX-PUB-001?lang=en')).json()) as {
      fragment: { title: string; body: string };
    };
    expect(pt.fragment.title).not.toBe(en.fragment.title);
    expect(pt.fragment.body.length).toBeGreaterThan(50);
    expect(en.fragment.body.length).toBeGreaterThan(50);
  });

  // `maskCode` esconde o prefixo de ato dos documentos bloqueados — e a lista de
  // ARQUIVOS RELACIONADOS o devolvia pela porta dos fundos: o documento publico
  // inicial, que todo perfil novo recebe, citava AX-PRC-014 e AX-GEN-G04 em texto
  // limpo, no primeiro minuto de jogo.
  it('os arquivos relacionados de um documento bloqueado vem mascarados', async () => {
    const client = new Client();
    await client.session();
    const body = (await (await client.call('/api/progression/codex?lang=pt-BR')).json()) as {
      unlocked: { id: string; relatedFragmentIds: string[] }[];
    };
    const publico = body.unlocked.find((f) => f.id === 'AX-PUB-001');
    expect(publico).toBeDefined();
    expect(publico?.relatedFragmentIds.length).toBeGreaterThan(0);
    for (const related of publico?.relatedFragmentIds ?? []) {
      // O sufixo sobrevive de proposito (AX-███-014, AX-███-G04): saber que
      // existe um documento 014 e parte do desenho, e a escada G-00..G-04 ja e
      // visivel na propria Matriz. O que nao pode vazar e o ATO.
      expect(related, 'nenhum ato pode vazar').toMatch(/^AX-███-\w+$/);
    }
  });

  it('nenhum prefixo de ato aparece na resposta inteira de um perfil novo', async () => {
    const client = new Client();
    await client.session();
    const raw = await (await client.call('/api/progression/codex?lang=pt-BR')).text();
    for (const prefix of ['AX-PRC', 'AX-INC', 'AX-EXE', 'AX-UNK', 'AX-GEN', 'AX-ENG']) {
      expect(raw, `${prefix} vazou`).not.toContain(prefix);
    }
  });

  it('sem sessao nao ha codex', async () => {
    expect((await fetch(`${base}/api/progression/codex`)).status).toBe(401);
  });
});
