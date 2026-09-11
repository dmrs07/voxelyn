// O BOT MORTAL do encontro do Magnetarca — uma etapa entre a varredura e o playtest.
//
// O QUE ELE E E O QUE ELE NAO E. O bot anterior era imortal e de mira perfeita:
// ele media o TETO do encontro (quanto tempo a luta dura quando nada da errado).
// Este morre, erra a mira e demora a reagir, entao ele encontra SITUACOES
// impraticaveis e compara ESTRATEGIAS. O que ele nao faz e estabelecer um piso
// para gente de verdade: os resultados continuam sendo cenarios simulados, com
// as limitacoes de um agente que segue regras fixas.
//
// REGRAS QUE ELE OBEDECE, e que sao o que torna o numero discutivel:
//
// 1. TUDO PELOS COMANDOS NORMAIS. Movimento, mira, tiro e esquiva saem de
//    `PlayerCommand` e passam por `stepRun`. Nada de teletransportar o corpo,
//    zerar calor ou aplicar dano por fora — as unicas coisas que ele pode fazer
//    sao as que um controle faz.
// 2. SO SINAIS VISIVEIS. Ele le a posicao do chefe, a polaridade (`mood`), o
//    prazo da inversao, o descompasso e as massas (posicao, estado, rota,
//    rachadura). Tudo isso e desenhado na tela — ver `drawMagnetField` e
//    `drawMagnetShards`. Ele NAO le vida do chefe, nem `rangedReadyAt`, nem a
//    RNG da run.
// 3. ATRASO DE REACAO EXPLICITO. Ele decide no tick T com a percepcao do tick
//    T - REACTION_TICKS, guardada num anel. Nada de reagir no mesmo quadro.
// 4. ERRO DE MIRA EXPLICITO E REPRODUZIVEL. A mira e girada por um angulo
//    sorteado de um PRNG semeado por (seed, estrategia): a mesma linha de
//    comando sempre produz a mesma partida.
//
// USO:
//   pnpm --filter @voxelyn/survival-sim build
//   node packages/voxelyn-survival-sim/tools/magnetarch-bot.mjs [--runs=24] [--fauna]

import {
  HEAT_MAX,
  HEAT_PER_SHOT,
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_SHARD_RADIUS,
  MAGNETARCH_SHARD_RETURN_DAMAGE,
  MAGNETARCH_TETHER_RANGE,
  MAGNET_ATTRACT,
  SHARD_FLIGHT,
  SHARD_LAUNCH,
  SHARD_LODGED,
  SHARD_WINDUP,
  TICK_HZ,
  bossForSector,
  createRun,
  emptyCommand,
  hasLineOfSight,
  magnetField,
  runDepthForGeneration,
  sectorBiome,
  stepRun,
} from '../dist/src/index.js';

// --- parametros do agente, todos explicitos --------------------------------

/** Quantos ticks o bot demora para reagir ao que ve. 5 ticks = 250 ms. */
const REACTION_TICKS = 5;
/** Desvio tipico da mira, em radianos (~4,6 graus). */
const AIM_SIGMA = 0.08;
/** Acima disto ele para de atirar para nao travar no superaquecimento. */
const HEAT_CEILING = HEAT_MAX - HEAT_PER_SHOT * 2;
/** A que distancia de uma rota marcada ele considera que esta na linha. */
const LANE_CLEARANCE = MAGNETARCH_SHARD_RADIUS + 0.9;
/** Massa em voo a menos disto, vindo na direcao dele: esquiva. */
const DODGE_RANGE = 3.2;

const mulberry32 = (a) => () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Gaussiana padrao por Box-Muller, para o erro de mira ter cauda. */
const gauss = (rnd) => {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const s = (t) => (t / TICK_HZ).toFixed(1);

/** Distancia de um ponto ao segmento — a mesma conta da rota marcada. */
const toSegment = (p, a, b) => {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = vx * vx + vy * vy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
};

// --- a percepcao: SO o que a tela mostra -----------------------------------

const perceive = (state, boss) => ({
  tick: state.tick,
  boss: { x: boss.x, y: boss.y, alive: boss.alive, mood: boss.mood ?? 0 },
  field: magnetField(
    state.tick,
    state.bossRuntime.magnetFlipAt,
    boss.mood ?? 0,
    state.bossRuntime.magnetExposedUntil,
  ),
  shards: state.bossRuntime.magnetShards.map((s) => ({
    x: s.x,
    y: s.y,
    tx: s.tx,
    ty: s.ty,
    state: s.state,
    cracked: s.cracked,
    hp: s.hp,
  })),
});

// --- as tres estrategias ---------------------------------------------------

/**
 * Qual massa este bot quer preparar AGORA, ou null para mirar no chefe.
 *
 * `one` para de preparar depois da primeira de cada recolhimento; `all` insiste
 * enquanto houver ferro inteiro no chao. `none` nunca olha para elas.
 *
 * LINHA DE VISAO E OBRIGATORIA, e a falta dela era um defeito com consequencia
 * grande: a versao anterior escolhia so pela integridade, entao o bot podia
 * insistir numa massa atras de uma coluna e gastar a janela inteira atirando em
 * rocha. A linha de visao garantida no nascimento e para o CHEFE, nao para as
 * massas — e um agente teimando num alvo bloqueado faz a sabotagem parecer uma
 * armadilha quando o problema e a escolha dele.
 */
const pickShard = (state, me, strategy, seen, preparedThisCycle) => {
  if (strategy === 'none') return null;
  if (strategy === 'one' && preparedThisCycle > 0) return null;
  const candidates = seen.shards.filter(
    (s) => (s.state === SHARD_LODGED || s.state === SHARD_WINDUP) && s.cracked === 0,
  );
  const visible = candidates.filter((s) => hasLineOfSight(state, me.x, me.y, s.x, s.y));
  if (visible.length === 0) {
    // Nenhuma alcancavel: ele ABANDONA a ideia e volta para o chefe neste tick,
    // em vez de guardar um alvo que nao pode acertar.
    return { blocked: candidates.length > 0, shard: null };
  }
  // A mais adiantada: a que ja levou tiro. Terminar uma vale mais que comecar
  // tres, e isso e uma decisao de jogador e nao de simulacao.
  visible.sort((a, b) => a.hp - b.hp);
  return { blocked: false, shard: visible[0] };
};

// --- uma partida -----------------------------------------------------------

const play = (seed, strategy, { fauna, trace = false }) => {
  const shotsAt = { chefe: 0, massa: 0 };
  const depth = runDepthForGeneration('G-04');
  const state = createRun({ seed, sector: 7, depth });
  const boss = state.enemies.find((e) => e.archetype === 'magnetarch');
  if (!boss) return null;
  if (!fauna) state.enemies = state.enemies.filter((e) => e === boss);

  // ONDE ELE COMECA, e por que isto e uma decisao e nao um detalhe.
  //
  // A primeira versao largava o bot na borda do campo (13 tiles). Em camara de
  // verdade isso quase sempre cai FORA do salao, no sistema de cavernas em volta
  // — e este bot nao tem busca de rota. Resultado: dezesseis partidas com o
  // corpo encostado em rocha a onze tiles, tomando 14/s do arco de retorno em
  // cada repulsao, sem nunca ver a faixa. O numero que sairia dali seria sobre o
  // meu harness, nao sobre o encontro.
  //
  // Ele comeca DENTRO da faixa, com LINHA DE VISAO para o chefe: a travessia ate
  // a camara nao e o que se esta medindo, e um agente sem rota nao pode
  // responder por ela. E uma limitacao declarada, nao um resultado.
  const spawn = (() => {
    const w = state.config.width;
    const mid = (MAGNETARCH_CRUSH_RANGE + MAGNETARCH_TETHER_RANGE) / 2;
    for (const ring of [mid, mid + 1.5, mid - 1.5, MAGNETARCH_CRUSH_RANGE + 1]) {
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2;
        const x = boss.x + Math.cos(a) * ring;
        const y = boss.y + Math.sin(a) * ring;
        const cx = Math.floor(x);
        const cy = Math.floor(y);
        if (cx < 1 || cy < 1 || cx >= w - 1 || cy >= state.config.height - 1) continue;
        if (state.solid[cy * w + cx] !== 0) continue;
        if (!hasLineOfSight(state, x, y, boss.x, boss.y)) continue;
        return { x, y };
      }
    }
    return null;
  })();
  if (!spawn) return null;
  state.player.x = spawn.x;
  state.player.y = spawn.y;

  // A MESMA SEQUENCIA DE ERRO DE MIRA nas tres estrategias: o PRNG e semeado so
  // pela seed. A versao anterior somava `strategy.length`, o que dava a `none`
  // um stream diferente de `one`/`all` (que por acidente compartilhavam o
  // mesmo) — comparar estrategias com sortes diferentes mistura a decisao com o
  // dado. As sequencias divergem depois da primeira escolha diferente, o que e
  // inevitavel; o que se pode garantir e a mesma largada.
  const rnd = mulberry32(seed * 7919);
  const memory = [];
  const damageBy = new Map();
  let ticks = 0;
  let cracked = 0;
  let shattered = 0;
  let exposedTicks = 0;
  let exposedPlayerDamage = 0;
  let normalTicks = 0;
  let normalPlayerDamage = 0;
  let returnDamage = 0;
  let blockedTicks = 0;
  let flatTicks = 0;
  let bossHpBefore = boss.hp;
  let lastHp = state.player.hp;
  let preparedThisCycle = 0;
  let lastMood = boss.mood;
  let firstShatterAt = -1;

  const LIMIT = 120 * TICK_HZ;
  while (boss.alive && state.player.alive && ticks < LIMIT) {
    memory.push(perceive(state, boss));
    const seen = memory[Math.max(0, memory.length - 1 - REACTION_TICKS)];
    const me = state.player;
    const cmd = emptyCommand();

    if (seen.boss.mood !== lastMood) {
      preparedThisCycle = 0;
      lastMood = seen.boss.mood;
    }

    // --- para onde andar ---------------------------------------------------
    const d = dist(me, seen.boss);
    const away = { x: (me.x - seen.boss.x) / (d || 1), y: (me.y - seen.boss.y) / (d || 1) };
    let move = { x: 0, y: 0 };
    const attracting = seen.boss.mood === MAGNET_ATTRACT;
    const quiet = seen.field.quiet;
    // A FAIXA primeiro: perto demais atraindo, longe demais repelindo.
    if (!quiet && attracting && d < MAGNETARCH_CRUSH_RANGE + 1.6) move = away;
    else if (!quiet && !attracting && d > MAGNETARCH_TETHER_RANGE - 1.6)
      move = { x: -away.x, y: -away.y };
    else if (d > MAGNETARCH_TETHER_RANGE - 0.5) move = { x: -away.x, y: -away.y };
    else if (d < MAGNETARCH_CRUSH_RANGE + 0.5) move = away;

    // --- sair das ROTAS marcadas ------------------------------------------
    for (const shard of seen.shards) {
      // SHARD_LAUNCH entra aqui: a rota que sai do corpo e justamente a que vem
      // mirada nele. A primeira versao disto so olhava `WINDUP`, e o bot
      // atravessava os tres corredores de arremesso de cada ciclo sem desviar.
      if (
        shard.state !== SHARD_WINDUP &&
        shard.state !== SHARD_LAUNCH &&
        shard.state !== SHARD_FLIGHT
      )
        continue;
      if (toSegment(me, shard, { x: shard.tx, y: shard.ty }) > LANE_CLEARANCE) continue;
      const lx = shard.tx - shard.x;
      const ly = shard.ty - shard.y;
      const len = Math.hypot(lx, ly) || 1;
      // Perpendicular a rota, para o lado em que ele ja esta: a saida mais curta.
      const px = -ly / len;
      const py = lx / len;
      const side = Math.sign((me.x - shard.x) * px + (me.y - shard.y) * py) || 1;
      move = { x: move.x + px * side * 1.4, y: move.y + py * side * 1.4 };
    }

    // --- esquivar do ferro em voo -----------------------------------------
    let dodging = false;
    for (const shard of seen.shards) {
      if (shard.state !== SHARD_FLIGHT) continue;
      if (dist(me, shard) > DODGE_RANGE) continue;
      const vx = shard.tx - shard.x;
      const vy = shard.ty - shard.y;
      const len = Math.hypot(vx, vy) || 1;
      const closing = ((me.x - shard.x) * vx + (me.y - shard.y) * vy) / len;
      if (closing <= 0) continue;
      dodging = state.tick >= (state.playerExtras[0].dodgeCooldownUntil ?? 0);
    }
    cmd.dodge = dodging;
    const mlen = Math.hypot(move.x, move.y);
    cmd.move = mlen > 0 ? { x: move.x / mlen, y: move.y / mlen } : { x: 0, y: 0 };

    // --- em que atirar -----------------------------------------------------
    const pick = pickShard(state, me, strategy, seen, preparedThisCycle);
    if (pick?.blocked) blockedTicks++;
    const target = pick?.shard ?? seen.boss;
    const ax = target.x - me.x;
    const ay = target.y - me.y;
    const alen = Math.hypot(ax, ay) || 1;
    const err = gauss(rnd) * AIM_SIGMA;
    const ca = Math.cos(err);
    const sa = Math.sin(err);
    cmd.aim = {
      x: (ax / alen) * ca - (ay / alen) * sa,
      y: (ax / alen) * sa + (ay / alen) * ca,
    };
    cmd.fire = state.playerExtras[0].heat < HEAT_CEILING;

    const res = stepRun(state, [cmd]);
    ticks++;
    if (trace) {
      const aiming = target === seen.boss ? 'chefe' : 'massa';
      if (cmd.fire && state.playerExtras[0].nextShotAt === state.tick + 5) shotsAt[aiming]++;
      if (ticks % 20 === 0) {
        const st = state.bossRuntime.magnetShards
          .map((m) => `${m.state}${m.cracked ? 'X' : ''}:${Math.round(m.hp)}`)
          .join(',');
        console.log(
          `   t=${s(ticks)}s d=${dist(me, boss).toFixed(1)} pol=${seen.field.polarity} mirando=${aiming} hp=${state.player.hp.toFixed(0)} massas=[${st}]`,
        );
      }
    }

    let shattersThisTick = 0;
    for (const ev of res.events) {
      if (ev.t !== 'boss_state' || ev.archetype !== 'magnetarch') continue;
      if (ev.state === 'crack') {
        cracked++;
        preparedThisCycle++;
      }
      if (ev.state === 'shatter') {
        shattered++;
        shattersThisTick++;
        if (firstShatterAt < 0) firstShatterAt = ticks;
      }
    }

    // --- contabilidade -----------------------------------------------------
    if (state.player.hp < lastHp) {
      const cause = state.playerExtras[0].lastDamage?.cause?.kind ?? 'desconhecida';
      damageBy.set(cause, (damageBy.get(cause) ?? 0) + (lastHp - state.player.hp));
    }
    lastHp = state.player.hp;

    // DANO EFETIVO NO CHEFE, separado por autor. O retorno e exato (96 por massa
    // e fora do multiplicador), entao o que sobra da queda de vida no tick e o
    // que o JOGADOR cobrou. "Gatilho pressionado" nao dizia nada: nao confirmava
    // disparo, nem alvo, nem dano — e a pergunta e se a janela virou vantagem.
    const bossDrop = bossHpBefore - boss.hp;
    const fromReturns = shattersThisTick * MAGNETARCH_SHARD_RETURN_DAMAGE;
    const fromPlayer = Math.max(0, bossDrop - fromReturns);
    returnDamage += Math.min(fromReturns, bossDrop);
    bossHpBefore = boss.hp;

    const exposed = state.tick < state.bossRuntime.magnetExposedUntil;
    if (exposed) {
      exposedTicks++;
      exposedPlayerDamage += fromPlayer;
    } else {
      normalTicks++;
      normalPlayerDamage += fromPlayer;
    }
    if (!exposed && state.bossRuntime.magnetShards.length === 0 && boss.alive) {
      // CAMPO NORMAL SEM MASSAS: o trecho que pode voltar a ser repetitivo. A
      // janela do descompasso fica FORA desta conta de proposito — ela e
      // recompensa conquistada, e somar as duas escondia exatamente a diferenca
      // que interessa.
      flatTicks++;
    }
  }

  if (trace) console.log(`   tiros: chefe=${shotsAt.chefe} massa=${shotsAt.massa}`);
  // TRES DESFECHOS, e nao um booleano. "Nao vitoria" juntava morte com estouro
  // de tempo, que sao diagnosticos opostos: um diz que a luta cobra caro, o
  // outro que ela nao termina. O trace chegava a imprimir MORTE para os dois.
  const outcome = !boss.alive ? 'vitoria' : !state.player.alive ? 'morte' : 'timeout';
  return {
    seed,
    strategy,
    outcome,
    ticks,
    hpLeft: Math.max(0, state.player.hp),
    bossHpLeft: Math.max(0, boss.hp),
    cracked,
    shattered,
    firstShatterAt,
    exposedTicks,
    exposedPlayerDamage,
    normalTicks,
    normalPlayerDamage,
    returnDamage,
    blockedTicks,
    flatTicks,
    damageBy,
  };
};

// --- seeds: camaras de verdade, abertas e apertadas ------------------------

/** Quanto chao aberto existe a ate 10 tiles do chefe — a "largura" da camara. */
const openness = (state, boss) => {
  let open = 0;
  const w = state.config.width;
  for (let y = Math.floor(boss.y) - 10; y <= Math.floor(boss.y) + 10; y++)
    for (let x = Math.floor(boss.x) - 10; x <= Math.floor(boss.x) + 10; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      if (Math.hypot(x - boss.x, y - boss.y) > 10) continue;
      if (state.solid[y * w + x] === 0) open++;
    }
  return open;
};

const findSeeds = (count) => {
  const depth = runDepthForGeneration('G-04');
  const found = [];
  for (let seed = 1; seed < 4000 && found.length < count * 3; seed++) {
    const def = bossForSector((s) => sectorBiome(seed, s), 7, depth.sectorCount, depth.coreSectors);
    if (def?.archetype !== 'magnetarch') continue;
    const state = createRun({ seed, sector: 7, depth });
    const boss = state.enemies.find((e) => e.archetype === 'magnetarch');
    if (!boss) continue;
    found.push({ seed, open: openness(state, boss) });
  }
  found.sort((a, b) => a.open - b.open);
  const tight = found.slice(0, Math.ceil(count / 2));
  const wide = found.slice(-Math.floor(count / 2));
  return [
    ...tight.map((f) => ({ ...f, kind: 'apertada' })),
    ...wide.map((f) => ({ ...f, kind: 'aberta' })),
  ];
};

// --- relatorio -------------------------------------------------------------

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const fauna = argv.includes('--fauna');
const RUNS = arg('runs', 16);

const traceSeed = argv.find((a) => a.startsWith('--trace='));
if (traceSeed) {
  const seed = Number(traceSeed.split('=')[1]);
  for (const strategy of ['none', 'all']) {
    console.log(`\n--- seed ${seed}, estrategia ${strategy} ---`);
    const r = play(seed, strategy, { fauna, trace: true });
    console.log(
      `   => ${r.outcome.toUpperCase()} em ${s(r.ticks)}s, vida ${r.hpLeft.toFixed(0)}/100, chefe com ${r.bossHpLeft.toFixed(0)}, fraturadas=${r.cracked} estilhacadas=${r.shattered}`,
    );
  }
  process.exit(0);
}

const seeds = findSeeds(RUNS);

console.log(
  `\nBOT MORTAL — ${seeds.length} camaras reais (G-04 setor 7), fauna ${fauna ? 'LIGADA' : 'desligada'}`,
);
console.log(
  `atraso de reacao ${REACTION_TICKS} ticks (${(REACTION_TICKS / TICK_HZ) * 1000} ms) · erro de mira sigma ${AIM_SIGMA} rad · teto de calor ${HEAT_CEILING}`,
);

const rows = [];
for (const strategy of ['none', 'one', 'all']) {
  const label = { none: 'IGNORAR  ', one: 'UMA/CICLO', all: 'TODAS    ' }[strategy];
  const runs = seeds
    .map((entry) => ({ ...entry, r: play(entry.seed, strategy, { fauna }) }))
    .filter((x) => x.r);
  rows.push({ strategy, label, runs });
  const by = (o) => runs.filter((x) => x.r.outcome === o);
  const causes = new Map();
  let cracked = 0;
  let shattered = 0;
  let exposedTicks = 0;
  let exposedDmg = 0;
  let normalTicks = 0;
  let normalDmg = 0;
  let returnDmg = 0;
  let blocked = 0;
  let flat = 0;
  let hpLeft = 0;
  for (const { r } of runs) {
    cracked += r.cracked;
    shattered += r.shattered;
    exposedTicks += r.exposedTicks;
    exposedDmg += r.exposedPlayerDamage;
    normalTicks += r.normalTicks;
    normalDmg += r.normalPlayerDamage;
    returnDmg += r.returnDamage;
    blocked += r.blockedTicks;
    flat += r.flatTicks;
    hpLeft += r.hpLeft;
    for (const [k, v] of r.damageBy) causes.set(k, (causes.get(k) ?? 0) + v);
  }
  const wins = by('vitoria');
  const all = runs.reduce((a, x) => a + x.r.ticks, 0) / Math.max(1, runs.length);
  const won = wins.reduce((a, x) => a + x.r.ticks, 0) / Math.max(1, wins.length);
  // O NUMERO QUE RESPONDE A PERGUNTA: o dano por segundo que o JOGADOR cobra
  // dentro da janela, contra o que ele cobra fora dela.
  //
  // E ele PODE passar de 1,6x sem ser erro de conta. O multiplicador atua no
  // dano por acerto; a janela tambem cala o campo, e um campo calado nao obriga
  // a andar — o agente fica parado mirando e ACERTA mais. O 1,6x e o piso do que
  // a janela vale quando usada, nao o teto.
  const dpsIn = exposedTicks > 0 ? (exposedDmg / exposedTicks) * TICK_HZ : 0;
  const dpsOut = normalTicks > 0 ? (normalDmg / normalTicks) * TICK_HZ : 0;
  const byKind = (kind) => {
    const sub = runs.filter((x) => x.kind === kind);
    return `${sub.filter((x) => x.r.outcome === 'vitoria').length}/${sub.length}`;
  };
  console.log(
    `\n${label} vitoria ${wins.length} · morte ${by('morte').length} · timeout ${by('timeout').length}` +
      `   (aberta ${byKind('aberta')} · apertada ${byKind('apertada')})\n` +
      `          tempo ${s(all)}s (todas) · ${wins.length ? `${s(won)}s (vitorias)` : '—'}` +
      `   vida restante media ${(hpLeft / runs.length).toFixed(0)}/100\n` +
      `          massas fraturadas ${(cracked / runs.length).toFixed(1)}/partida · estilhacadas ${(shattered / runs.length).toFixed(1)}` +
      `   dano do retorno ${(returnDmg / runs.length).toFixed(0)}/partida\n` +
      `          janela: ${s(exposedTicks / runs.length)}s/partida · dano do JOGADOR nela ${(exposedDmg / runs.length).toFixed(0)}` +
      `   dps na janela ${dpsIn.toFixed(1)} vs fora ${dpsOut.toFixed(1)} (${dpsOut > 0 ? (dpsIn / dpsOut).toFixed(2) : '—'}x; 1,60x e o multiplicador)\n` +
      `          campo normal SEM massas ${s(flat / runs.length)}s/partida` +
      `   ticks com alvo BLOQUEADO ${(blocked / runs.length).toFixed(0)}\n` +
      `          dano tomado: ${
        [...causes]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${Math.round(v / runs.length)}`)
          .join(' · ') || 'nenhum'
      }`,
  );
}

// AS NAO VITORIAS, uma por uma. Elas tem de ser identificaveis antes de
// qualquer afirmacao sobre letalidade: "15/16" nao diz se a que faltou foi uma
// morte ou uma luta que nao terminou.
const bad = rows.flatMap(({ label, runs }) =>
  runs.filter((x) => x.r.outcome !== 'vitoria').map((x) => ({ label, ...x })),
);
if (bad.length === 0) console.log('\nNenhuma nao vitoria.');
else {
  console.log('\nNAO VITORIAS:');
  for (const b of bad) {
    console.log(
      `  ${b.label} seed ${b.seed} (${b.kind}) — ${b.r.outcome.toUpperCase()} em ${s(b.r.ticks)}s` +
        `, vida ${b.r.hpLeft.toFixed(0)}/100, chefe com ${b.r.bossHpLeft.toFixed(0)}` +
        `, fraturadas ${b.r.cracked}, estilhacadas ${b.r.shattered}`,
    );
  }
}
console.log('');
