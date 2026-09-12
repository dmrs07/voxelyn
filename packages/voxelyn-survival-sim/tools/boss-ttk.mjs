// O TETO de cada encontro: quanto tempo o chefe dura contra um agente que nao
// erra, nao morre e nao sai da faixa.
//
// O QUE ELE MEDE E O QUE ELE NAO MEDE. Este bot e imortal, tem mira perfeita e
// so anda para manter a distancia de tiro. Ele NAO diz quanto tempo alguem leva
// de verdade — diz o PISO de duracao do encontro, o numero que sobra quando
// nada da errado. E o unico numero comparavel entre onze chefes com
// contra-jogos diferentes: tudo acima dele e erro humano, e erro humano nao se
// compara entre biomas.
//
// A CENA e a mesma de `duel` nos testes de estrato: clareira limpa no meio do
// mapa, chefe a `gap` tiles a leste, `bossRuntime.awake` ligado, fauna fora. O
// que se mede e o CHEFE, e um Espreitador entrando na conta responderia outra
// pergunta. Dois chefes precisam do proprio chao e o recebem aqui: o Leviata
// nao existe sem pocas, e o Bispo cura em cima de micelio — a clareira e larga
// o bastante para que nenhum dos dois saia dela e passe a medir o cenario.
//
// REGRAS DO AGENTE, todas explicitas porque sao elas que tornam o numero
// discutivel:
//
// 1. TUDO PELOS COMANDOS NORMAIS. Mira, passo e tiro saem de `PlayerCommand` e
//    passam por `stepRun`. A UNICA coisa que ele faz por fora e repor a propria
//    vida — e imortalidade e a definicao desta medicao, nao um atalho dela.
// 2. MIRA PERFEITA COM ANTECIPACAO. O projetil voa a `BOLT_SPEED`; mirar na
//    posicao atual de um chefe que anda seria erro de mira disfarcado de
//    medicao. Ele resolve o encontro em uma iteracao de tempo de voo.
// 3. SO A FAIXA. Um passo para dentro quando o chefe se afasta, um para fora
//    quando ele encosta, e nada mais: sem esquiva, sem habilidade, sem rota.
//    Um bot que escolhesse caminho mediria o caminho, nao o encontro.
// 4. TETO DE CALOR. Ele para de atirar a dois tiros do travamento: o ritmo
//    sustentavel do disparo basico e a linha de base de dano do jogo.
//
// A ARMA e o parafuso basico e mais nada — sem missil, sem Minigun, sem
// modulos. E de proposito: e o unico equipamento que todo jogador tem em toda
// run, entao e o unico denominador em que onze chefes se comparam.
//
// USO:
//   pnpm --filter @voxelyn/survival-sim build
//   node packages/voxelyn-survival-sim/tools/boss-ttk.mjs [--seeds=8]
//   node packages/voxelyn-survival-sim/tools/boss-ttk.mjs --boss=frost_queen --sweep=640,900,1200

import {
  BOLT_SPEED,
  HEAT_MAX,
  HEAT_PER_SHOT,
  MAGNETARCH_CRUSH_RANGE,
  MAGNETARCH_TETHER_RANGE,
  SOLID_NONE,
  SURF_DEEP_WATER,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_NONE,
  SURF_WATER,
  TICK_HZ,
  BOSS_TTK_SECONDS,
  IMPLEMENTED_BOSS,
  createRun,
  emptyCommand,
  grantOrRechargeModule,
  spawnEnemy,
  stepRun,
} from '../dist/src/index.js';

/** Acima disto ele para de atirar para nao travar no superaquecimento. */
const HEAT_CEILING = HEAT_MAX - HEAT_PER_SHOT * 2;
/** Teto da partida. Um chefe que nao cai aqui nao cai. */
const LIMIT_SECONDS = 300;
/**
 * Raio da clareira carimbada em volta do duelo.
 *
 * Generoso de proposito: com 18 o Bispo saia da clareira a caminho do primeiro
 * micelio do setor e a medicao virava uma perseguicao pelo mapa gerado — que e
 * uma pergunta legitima, mas nao esta.
 */
const ARENA_RADIUS = 30;

/**
 * A FAIXA de cada chefe: a distancia que o agente mantem.
 *
 * Nao e um numero solto por chefe — e o lugar que o proprio encontro define.
 * Para a maioria e a distancia media de tiro (6 tiles, dentro da clareira e
 * fora do corpo a corpo). O Magnetarca usa o meio dos dois aneis, que e a
 * unica posicao que o campo dele deixa de pe; o Leviata usa os 7 tiles com que
 * a vida dele foi medida quando o encontro nasceu.
 */
const BAND = {
  magnetarch: (MAGNETARCH_CRUSH_RANGE + MAGNETARCH_TETHER_RANGE) / 2,
  sheet_leviathan: 7,
};
const DEFAULT_BAND = 6;

/**
 * A lista, e o ALVO de cada um, saem de `BOSS_TTK_SECONDS` na simulacao.
 *
 * Nao ha uma segunda tabela aqui de proposito: uma ferramenta de medicao que
 * carregasse a propria copia dos alvos passaria a aprovar o que ela mesma
 * decidiu. Um chefe novo entra nesta varredura no dia em que entra na tabela.
 */
const BOSSES = Object.entries(BOSS_TTK_SECONDS)
  .filter(([boss]) => IMPLEMENTED_BOSS[boss])
  .sort((a, b) => a[1] - b[1])
  .map(([boss]) => IMPLEMENTED_BOSS[boss]);

/** O alvo do arquetipo, pela volta de `IMPLEMENTED_BOSS`. */
const targetOf = (archetype) =>
  BOSS_TTK_SECONDS[Object.keys(BOSS_TTK_SECONDS).find((b) => IMPLEMENTED_BOSS[b] === archetype)];

/** Pinta uma POCA ocupavel: margem rasa num disco, profunda no meio. */
const paintPool = (state, cx, cy, rim = 2.6) => {
  const w = state.config.width;
  for (let y = cy - 3; y <= cy + 3; y++) {
    for (let x = cx - 3; x <= cx + 3; x++) {
      if (Math.hypot(x - cx, y - cy) > rim) continue;
      state.surface[y * w + x] = SURF_WATER;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    state.surface[(cy + dy) * w + (cx + dx)] = SURF_DEEP_WATER;
  }
};

/**
 * O RUMO do encontro nesta seed, em radianos.
 *
 * A clareira e sempre a mesma — e o que torna as partidas comparaveis —, e por
 * isso o chefe nao pode nascer sempre a leste: contra um agente que segue regra
 * fixa, uma cena identica da uma partida identica, e doze seeds eram doze copias
 * da mesma medicao com um P90 que so repetia a mediana. O que varia e a
 * GEOMETRIA do engajamento: de que lado o corpo esta quando a luta comeca, e
 * portanto para onde o chefe telegrafa, por onde o coro gira, de que lado o gelo
 * se acumula. Deriva da seed, entao continua reproduzivel.
 */
const bearing = (seed) => ((seed * 2654435761) % 4096) * ((Math.PI * 2) / 4096);

/** Clareira limpa no meio do mapa, com o chefe a `gap` tiles no rumo da seed. */
const duel = (seed, archetype, gap, hp) => {
  const state = createRun({ seed });
  const w = state.config.width;
  const px = Math.floor(state.config.width / 2);
  const py = Math.floor(state.config.height / 2);
  state.player.x = px + 0.5;
  state.player.y = py + 0.5;
  for (let y = py - ARENA_RADIUS; y <= py + ARENA_RADIUS; y++) {
    for (let x = px - ARENA_RADIUS; x <= px + ARENA_RADIUS; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
  state.enemies = [];
  state.salvageSites = [];
  // O LENCOL: ancoradouro a leste e dois destinos, como na camara do estrato.
  // Sem pocas o Leviata nao ancora, nao sonda e nao mergulha — e o numero seria
  // sobre um chefe que o jogo nao serve.
  const a = bearing(seed);
  const bx = Math.round(px + Math.cos(a) * gap);
  const by = Math.round(py + Math.sin(a) * gap);
  if (archetype === 'sheet_leviathan') {
    // O ancoradouro e os dois destinos GIRAM JUNTO com o rumo: pocas fixas com
    // corpo girando fariam o Leviata nascer em terra seca em tres quartos das
    // seeds, e a primeira fase dele nao existe fora da agua.
    paintPool(state, bx, by);
    paintPool(
      state,
      Math.round(px + Math.cos(a + 2.6) * 9),
      Math.round(py + Math.sin(a + 2.6) * 9),
    );
    paintPool(
      state,
      Math.round(px + Math.cos(a - 2.6) * 9),
      Math.round(py + Math.sin(a - 2.6) * 9),
    );
  }
  const boss = spawnEnemy(state, archetype, bx, by, false);
  // A VIDA POR FORA existe para a varredura: trocar `*_HP` e reconstruir o
  // pacote a cada candidato transformaria uma busca de dez valores numa tarde.
  // As fases lidas em fracao de `maxHp` continuam corretas porque as duas
  // pontas mudam juntas.
  if (hp) {
    boss.hp = hp;
    boss.maxHp = hp;
  }
  if (weapon) {
    // Cargas cheias e nunca reabastecidas: se a arma acabar no meio, o resto da
    // luta sai no parafuso e o numero vira uma media de duas armas.
    grantOrRechargeModule(state.playerExtras[0], weapon, state.tick);
  }
  state.bossRuntime.awake = true;
  return { state, boss };
};

/**
 * A mira que acerta um alvo que anda: uma iteracao de tempo de voo.
 *
 * Uma so basta na pratica — a velocidade do chefe e uma ordem de grandeza menor
 * que a do projetil, e a segunda iteracao mexe na terceira casa decimal.
 */
const leadAim = (me, target, lastTarget) => {
  const vx = lastTarget ? (target.x - lastTarget.x) * TICK_HZ : 0;
  const vy = lastTarget ? (target.y - lastTarget.y) * TICK_HZ : 0;
  const flight = Math.hypot(target.x - me.x, target.y - me.y) / BOLT_SPEED;
  const ax = target.x + vx * flight - me.x;
  const ay = target.y + vy * flight - me.y;
  const len = Math.hypot(ax, ay) || 1;
  return { x: ax / len, y: ay / len };
};

/**
 * NAO PISAR NO BURACO — a unica leitura de terreno que o bot faz.
 *
 * A Sondagem do Leviata abre agua profunda debaixo de quem fica parado, e agua
 * profunda prende: sem esta regra a medicao do ultimo chefe terminava com o
 * agente afogado a oito tiles do corpo e o relogio correndo ate o teto, o que
 * nao e um dado sobre a vida dele. Sair do centro marcado e exatamente o que o
 * telegrafo pede — e o que os testes do lencol ja faziam a mao.
 */
const avoidHoles = (state, cmd) => {
  const w = state.config.width;
  const me = state.player;
  const deep = (x, y) => state.surface[Math.floor(y) * w + Math.floor(x)] === SURF_DEEP_WATER;
  // Ja dentro: sair pelo rumo mais curto para fora, antes de qualquer outra
  // intencao. Um agente afogado nao mede chefe nenhum.
  if (deep(me.x, me.y)) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      if (!deep(me.x + Math.cos(a) * 2, me.y + Math.sin(a) * 2)) {
        cmd.move = { x: Math.cos(a), y: Math.sin(a) };
        return;
      }
    }
  }
  // A coluna MARCADA que afunda: sair do circulo dela enquanto o aviso corre.
  const cell = state.bossRuntime.leviathanProbeCell;
  if (cell >= 0) {
    const cx = (cell % w) + 0.5;
    const cy = Math.floor(cell / w) + 0.5;
    const d = Math.hypot(me.x - cx, me.y - cy);
    if (d < 3) {
      cmd.move = { x: (me.x - cx) / (d || 1), y: (me.y - cy) / (d || 1) };
      return;
    }
  }
  // O passo pretendido nao entra na agua: desliza 90 graus em vez de entrar.
  if (cmd.move.x || cmd.move.y) {
    if (deep(me.x + cmd.move.x * 1.2, me.y + cmd.move.y * 1.2)) {
      cmd.move = { x: -cmd.move.y, y: cmd.move.x };
    }
  }
};

/**
 * O TAPETE DO BISPO, resolvido — a unica concessao desta medicao, e declarada.
 *
 * Sobre micelio vivo o Bispo cura 64/s: mais que o disparo basico sustentado,
 * por decisao de desenho (ver BISHOP_REGEN_PER_TICK). Ele nao e um chefe que se
 * vence por atrito e nunca devia ser — quem o vence acende o chao debaixo dele,
 * e acender o chao exige um modulo termico que este bot nao tem.
 *
 * Entao o bot nao ganha uma arma que os outros dez nao tem: o chao aquece por
 * fora, no mesmo tick em que o micelio aparece sob o corpo, que e o efeito
 * EXATO da resposta certa. O numero que sai daqui e o teto do encontro DEPOIS
 * de resolvido o quebra-cabeca territorial — a unica pergunta de duracao que o
 * Bispo aceita.
 */
const denyCarpet = (state, boss) => {
  if (boss.archetype !== 'bishop') return;
  const w = state.config.width;
  const i = Math.floor(boss.y) * w + Math.floor(boss.x);
  if (state.surface[i] === SURF_FUNGAL) {
    state.surface[i] = SURF_FUNGAL_HEATED;
    state.surfaceTimer[i] = 0;
  }
};

const play = (seed, archetype, hp) => {
  const gap = forcedBand !== null ? Number(forcedBand) : (BAND[archetype] ?? DEFAULT_BAND);
  const { state, boss } = duel(seed, archetype, gap, hp);
  const limit = LIMIT_SECONDS * TICK_HZ;
  let ticks = 0;
  let last = null;
  // O QUE A IMORTALIDADE ESTA PAGANDO. Cada ponto reposto e um ponto que o
  // encontro cobrou, e a soma e o outro lado da duracao: alongar um chefe sem
  // olhar esta coluna e alongar a exposicao do jogador as cegas.
  //
  // SEPARADO POR CAUSA, e nao um total. O afogamento nas pocas do Leviata e
  // artefato DESTE bot — ele nao tem busca de rota e sai da agua pelo rumo mais
  // curto, nao pelo certo —, e somado ao resto inflaria o unico chefe da lista
  // que tem agua. Fica numa coluna propria, declarado.
  let hurt = 0;
  let drowned = 0;
  let lastHp = state.player.hp;
  while (boss.alive && ticks < limit) {
    const cmd = emptyCommand();
    // MANTER A FAIXA, e so isso: um passo para dentro quando o chefe se afasta,
    // um para fora quando ele encosta. Sem isto, um chefe que recua (o Bispo)
    // ou que corre (a Rainha) mede a paciencia do bot, nao a luta.
    const dx = boss.x - state.player.x;
    const dy = boss.y - state.player.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > gap + 0.5) cmd.move = { x: dx / d, y: dy / d };
    else if (d < gap - 1.5) cmd.move = { x: -dx / d, y: -dy / d };
    avoidHoles(state, cmd);
    cmd.aim = leadAim(state.player, boss, last);
    cmd.fire = state.playerExtras[0].heat < HEAT_CEILING;
    last = { x: boss.x, y: boss.y };
    denyCarpet(state, boss);
    stepRun(state, [cmd]);
    // IMORTAL: a vida volta ao teto todo tick. Sem isto a run termina no meio da
    // medicao e o numero vira "quanto o chefe demorou para me matar".
    //
    // A FASE volta junto, e nao e detalhe: uma queda em agua profunda encerra a
    // run inteira, e `stepRun` numa run encerrada nao avanca o tick. Sem esta
    // linha o afogamento nao aparecia como morte — aparecia como um chefe
    // eterno, que e o diagnostico oposto.
    if (state.phase !== 'running') state.phase = 'running';
    const lost = Math.max(0, lastHp - state.player.hp);
    if (lost > 0) {
      const cause = state.playerExtras[0].lastDamage?.cause?.kind ?? 'unknown';
      if (cause === 'deep_water') drowned += lost;
      else hurt += lost;
    }
    state.player.hp = state.player.maxHp;
    lastHp = state.player.maxHp;
    state.player.alive = true;
    ticks++;
  }
  return {
    seed,
    archetype,
    killed: !boss.alive,
    seconds: ticks / TICK_HZ,
    maxHp: boss.maxHp,
    hurt,
    drowned,
  };
};

// --- relatorio -------------------------------------------------------------

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const seeds = Number(arg('seeds', 8));
/**
 * A FAIXA forcada, em tiles — para perguntar quanto vale DISTANCIA.
 *
 * O alcance do parafuso e hoje 18,2 tiles (BOLT_SPEED x 1,4 s de ttl), e a
 * medicao padrao acontece a seis. Forcar a faixa e como se pergunta o que um
 * corte de alcance tira de cada encontro: nao o teto de dano, que quase nao
 * muda, mas o DANO TOMADO — quem so podia ser enfrentado de longe passa a
 * cobrar de perto.
 */
const forcedBand = arg('band', null);
/**
 * A ARMA equipada na medicao, ou o parafuso basico.
 *
 * O alvo de `BOSS_TTK_SECONDS` e medido SEM modulo nenhum, e continua sendo:
 * o parafuso e o unico equipamento que toda run tem, e por isso o unico
 * denominador em que onze chefes se comparam. Esta flag responde outra
 * pergunta — quanto uma arma de tier 2 encurta o teto —, e a resposta dela
 * nunca vira alvo.
 */
const weapon = arg('weapon', null);
const only = arg('boss', null);
const sweep = arg('sweep', null);
const list = only ? only.split(',') : BOSSES;

const fmt = (n, d = 1) => n.toFixed(d).replace('.', ',');
const median = (xs) => quantile(xs, 0.5);

/**
 * O quantil pelo metodo do vizinho mais proximo, e nao interpolado.
 *
 * Interpolar inventaria uma camara que nao foi jogada: com doze seeds, o P90 e
 * a decima primeira partida da amostra ordenada, e ela existe. Um numero
 * interpolado entre a decima e a decima primeira nao corresponde a nenhuma
 * medicao e nao da para ir olhar.
 */
const quantile = (xs, q) => {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};

const measure = (archetype, hp) => {
  const runs = [];
  for (let i = 0; i < seeds; i++) runs.push(play(1000 + i * 37, archetype, hp));
  const times = runs.map((r) => r.seconds).sort((a, b) => a - b);
  return {
    archetype,
    hp: runs[0].maxHp,
    median: median(times),
    p90: quantile(times, 0.9),
    min: times[0],
    max: times[times.length - 1],
    failed: runs.filter((r) => !r.killed).length,
    hurt: median(runs.map((r) => r.hurt)),
    hurtMax: Math.max(...runs.map((r) => r.hurt)),
    drowned: median(runs.map((r) => r.drowned)),
  };
};

const header =
  'chefe               vida    alvo   mediana      P90      max     min   dano/s   dano tomado   sem morte';
// O DANO POR SEGUNDO EFETIVO e a coluna que se usa para escolher a vida nova:
// ele ja traz dentro tudo o que o encontro tira do jogador (blindagem, corpo
// fora de alcance, fase sem alvo), entao vida = alvo de TTK x dano/s acerta de
// primeira em quem nao muda de fase com a vida.
const line = (r) =>
  `${r.archetype.padEnd(18)} ${String(Math.round(r.hp)).padStart(5)}  ` +
  `${(String(targetOf(r.archetype)) + ' s').padStart(6)}  ` +
  `${(fmt(r.median) + ' s').padStart(8)}  ${(fmt(r.p90) + ' s').padStart(7)}  ` +
  `${(fmt(r.max) + ' s').padStart(7)}  ${(fmt(r.min) + ' s').padStart(6)}  ` +
  `${fmt(r.hp / r.median).padStart(7)}  ` +
  `${(String(Math.round(r.hurt)) + ' / ' + String(Math.round(r.hurtMax))).padStart(13)}  ` +
  `${r.failed || ''}`;

console.log('');
console.log(header);
console.log('(dano tomado: mediana / pior partida, em pontos de vida, com PLAYER_HP = 100)');
const measured = [];
for (const archetype of list) {
  const hps = sweep ? sweep.split(',').map(Number) : [null];
  for (const hp of hps) {
    const row = measure(archetype, hp);
    measured.push(row);
    console.log(line(row));
  }
}
// O AFOGAMENTO sai do rodape e nao da tabela: e limitacao do agente e nao conta
// do encontro, e uma coluna com zero em dez linhas sugeriria que a decima e
// pior do que e.
const drowning = measured.filter((r) => r.drowned > 0);
if (drowning.length > 0) {
  console.log('');
  for (const r of drowning) {
    console.log(
      `nota: ${r.archetype} — mais ${Math.round(r.drowned)} de afogamento por partida (mediana), ` +
        'que e o bot sem busca de rota saindo da poca pelo rumo mais curto e nao pelo certo.',
    );
  }
}
console.log('');
