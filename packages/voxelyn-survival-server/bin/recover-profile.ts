#!/usr/bin/env node
//
// RESGATE DE UM PERFIL ORFAO.
//
// Existe por causa de um incidente real: o servidor rodou sem
// `PROGRESSION_SECRET`, o segredo efemero mudou no reinicio seguinte, e todo
// token guardado nos navegadores deixou de verificar. Nenhum dado foi apagado —
// carteira, protocolos e codex continuam no Postgres. O que se perdeu foi o
// ENDERECO: o `profileId` sao 128 bits de CSPRNG e nada mais indexa a linha.
//
// `assertProgressionSecretIsStable` impede o proximo caso. Este arquivo trata
// dos que ja aconteceram.
//
//   1. listar    node dist/bin/recover-profile.js list
//   2. reemitir  node dist/bin/recover-profile.js token <profileId>
//   3. o operador cola o token no `localStorage` do navegador, na chave que a
//      mensagem final imprime.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO NAO E UMA ESCALADA DE PRIVILEGIO
// ---------------------------------------------------------------------------
// Ele assina um token para um `profileId` arbitrario — o que e, literalmente, a
// capacidade de assumir qualquer perfil. Isso NAO amplia poder nenhum: a
// assinatura exige `PROGRESSION_SECRET`, e quem tem o segredo do servidor ja
// podia forjar qualquer sessao com quatro linhas de Node. A ferramenta so poupa
// escrever essas quatro linhas sob pressao, no dia em que a base esta orfa.
//
// O que ela nao faz, de proposito: nao roda dentro do servidor, nao tem rota
// HTTP e nao adivinha qual perfil e de quem. `list` mostra os candidatos e um
// humano escolhe — porque "o perfil mais rico" e um palpite, e um palpite que
// entrega a conta de outra pessoa nao e recuperacao, e vazamento.

import { createHmac, randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const die = (message: string): never => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

/**
 * Superficie minima do `pg`, declarada a mao pelo mesmo motivo que em
 * `leaderboard.ts`: o import e dinamico, e um ambiente sem o pacote instalado
 * recebe uma mensagem em vez de morrer no carregamento do modulo.
 */
type PgPool = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
};

const connect = async (databaseUrl: string): Promise<PgPool> => {
  const pg = (await import('pg')) as unknown as {
    default?: { Pool: new (config: unknown) => PgPool };
    Pool?: new (config: unknown) => PgPool;
  };
  const Pool = pg.Pool ?? pg.default?.Pool;
  if (!Pool) return die('pg: construtor Pool nao encontrado. `pnpm add pg` no servidor.');
  return new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
    max: 1,
  });
};

/**
 * Os candidatos, do mais provavel ao menos.
 *
 * Ordenado por atividade recente e nao por riqueza: quem procura o proprio
 * perfil depois de um incidente lembra de QUANDO jogou, nao de quanto tinha.
 * `purchased` aparece contado porque e o campo que o jogador reconhece — "eu
 * tinha onze protocolos" e uma memoria confiavel; o saldo de minerio nao.
 */
const list = async (pool: PgPool, limit: number): Promise<void> => {
  const { rows } = await pool.query(
    `select profile_id, ore, cores,
            jsonb_array_length(purchased) as protocolos,
            updated_at, created_at
       from progression_profiles
      order by updated_at desc
      limit $1`,
    [limit],
  );
  if (rows.length === 0) return console.log('\n  Nenhum perfil na tabela.\n');
  console.log(`\n  ${rows.length} perfil(is), do mais recente ao mais antigo:\n`);
  for (const r of rows) {
    const visto = new Date(String(r.updated_at)).toISOString().replace('T', ' ').slice(0, 16);
    console.log(
      `  ${String(r.profile_id)}\n` +
        `    ultima atividade ${visto} · ${String(r.protocolos)} protocolos · ` +
        `${String(r.ore)} minerio · ${String(r.cores)} nucleos\n`,
    );
  }
  console.log('  Reemita com: recover-profile token <profileId>\n');
};

/**
 * Reemite a sessao — o MESMO formato de `progression-auth.ts`.
 *
 * Duplicado aqui de proposito, e a duplicacao e o ponto: esta ferramenta roda
 * fora do servidor, e importar o modulo dele arrastaria o grafo inteiro para um
 * script de emergencia. O formato e `profileId.expiracao.hmac`; se ele mudar la,
 * este arquivo passa a emitir token invalido e o operador descobre na primeira
 * tentativa — barulhento, e nao silencioso.
 */
const token = async (pool: PgPool, profileId: string, secret: string): Promise<void> => {
  const { rows } = await pool.query(
    'select jsonb_array_length(purchased) as protocolos, ore from progression_profiles where profile_id = $1',
    [profileId],
  );
  if (rows.length === 0) return die(`Perfil ${profileId} nao existe. Rode \`list\` primeiro.`);

  const payload = `${profileId}.${Date.now() + SESSION_TTL_MS}`;
  const signature = base64url(createHmac('sha256', secret).update(payload).digest());
  console.log(
    `\n  Perfil encontrado: ${String(rows[0].protocolos)} protocolos, ${String(rows[0].ore)} minerio.\n` +
      `\n  Token (vale 365 dias):\n\n  ${payload}.${signature}\n` +
      '\n  No navegador, no console da ORIGEM do jogo:\n' +
      "\n  localStorage.setItem('voxelyn.progression.token:<origem-do-servidor>', '<token>')\n" +
      '\n  A origem e a do servidor, normalizada (ex.: https://voxelyn-survival-server.onrender.com).\n' +
      '  A chave e por origem de proposito — ver `originOf` no cliente.\n',
  );
};

const main = async (): Promise<void> => {
  const [command, argument] = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) die('DATABASE_URL ausente. Aponte para o banco de producao.');

  // O segredo NOVO e estavel — o que o servidor usa agora. Reemitir com o
  // efemero antigo seria assinar com uma chave que ninguem mais tem.
  const secret = process.env.PROGRESSION_SECRET;
  if (command === 'token' && (!secret || secret.length < 16)) {
    die('PROGRESSION_SECRET ausente ou curto. Use o MESMO valor estavel que o servidor usa hoje.');
  }

  const pool = await connect(databaseUrl!);
  try {
    if (command === 'list') await list(pool, Number(argument) || 20);
    else if (command === 'token') {
      if (!argument) die('Uso: recover-profile token <profileId>');
      await token(pool, argument, secret!);
    } else {
      console.log(
        '\n  Uso:\n' +
          '    recover-profile list [limite]      lista perfis por atividade recente\n' +
          '    recover-profile token <profileId>  reemite a sessao daquele perfil\n' +
          '\n  Exige DATABASE_URL; `token` exige tambem PROGRESSION_SECRET.\n',
      );
    }
  } finally {
    await pool.end();
  }
};

void main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

// `randomBytes` fica importado para o caso de alguem precisar gerar o proprio
// segredo estavel a partir daqui, que e a primeira coisa a fazer depois do
// incidente. Uma linha, e evita o operador procurar como fazer isso sob pressao.
export const suggestSecret = (): string => base64url(randomBytes(32));
