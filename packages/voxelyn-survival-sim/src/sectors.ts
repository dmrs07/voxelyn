// A descida: o que acontece quando o jogador alcanca o poco.
//
// Este arquivo existe porque a run tinha 96x96 tiles fixos, um bioma e uma
// topologia. As seeds mudavam o desenho e nada mais: nao havia profundidade,
// nao havia aposta crescente, e a fantasia declarada — "um prospector DESCENDO
// no Veio" — nunca acontecia. O jogador entrava, andava no plano e saia.
//
// A correcao nao e mais conteudo, e ESTRUTURA. Uma run agora sao ATE SETE
// mundos encadeados — quantos exatamente e a autorizacao da geracao (ver
// depth.ts) —, e a pergunta "exploro mais ou desco agora" se repete a cada um
// deles.
//
// A decisao de implementacao que rege o arquivo: descer REESCREVE o estado no
// lugar em vez de criar um `SurvivalState` novo.
//
// Criar um novo era o caminho obvio e estava errado por dois motivos, nesta
// ordem de gravidade. Primeiro, o servidor guarda a referencia do estado da
// sala e a distribui: trocar o objeto obrigaria a rastrear a troca em todo
// lugar que segura uma referencia, e a primeira que ficasse velha viraria uma
// sala fantasma. Segundo, a maior parte do estado ATRAVESSA a descida —
// modulos, frascos, vida, contaminacao, contadores, os proprios jogadores — e
// um construtor novo os recriaria zerados, obrigando a copiar de volta campo a
// campo. Escrever o que muda e menor e diz o que realmente acontece.

import {
  CHUNK,
  CONTAMINATION_CARRYOVER,
  HORSE_SPAWN_CHANCE,
  MAX_ENEMIES,
  MINER_ORE_SEARCH,
  RUN_SEED_MIX,
  SOLID_NONE,
  SOLID_ORE,
  SURF_FUNGAL,
} from './constants.js';
import { emptyResonance } from './abilities.js';
import { emptyBossRuntime } from './bosses.js';
import { isFinalSector, resolveSectorBoss, runDepth, runSectorCount } from './depth.js';
import { isConductiveSurface, setSurface } from './cells.js';
import { SIGNATURE_OF_STRATUM, SIGNATURE_PACK, spawnEnemy } from './entities.js';
import { biomeMix, biomeProfile, horseChanceFor, sectorBiome, sectorProfile } from './strata.js';
import { deriveLeylineNetwork, generateWorld } from './worldgen.js';
import { SURF_ICE } from './constants.js';
import type { EnemyArchetype, SemanticEvent, SurvivalState, Vec2 } from './types.js';

/**
 * A rede de leyline do setor novo, montada num lugar so.
 *
 * `descend` e `ascend` faziam isto identico e lado a lado, e foi exatamente
 * essa duplicacao que o review do PR #144 pegou em outra forma: o que se
 * escreve duas vezes diverge na terceira. Com o circuito somando quatro campos
 * ao que precisa zerar, a copia deixaria de ser barata.
 */
const resetLeylineNetwork = (
  state: SurvivalState,
  world: { leylines: Array<{ cells: number[] }>; leylineNodes: Array<{ cell: number; segments: number[] }>; entry: Vec2 },
): void => {
  const network = deriveLeylineNetwork(world, state.config.width);
  state.leylineNodes = network.nodes;
  state.leylineCircuit = {
    sourceNode: network.circuit.sourceNode,
    members: network.circuit.members,
    reached: [],
    live: false,
    closed: false,
  };
  state.stratumSubverted = false;
};

/**
 * Seed do setor N a partir da seed da run.
 *
 * Derivada e nao sorteada: a run inteira tem de ser reproduzivel a partir de um
 * unico numero. E disso que dependem a seed compartilhavel, o replay e a
 * verificacao do leaderboard — se o segundo setor viesse do relogio, duas
 * pessoas com a "mesma seed" jogariam mapas diferentes a partir do minuto
 * quatro.
 */
export const sectorSeed = (runSeed: number, sector: number): number =>
  (Math.imul(runSeed ^ (sector * 0x9e3779b9), 0x85ebca6b) ^ (sector * 0x27d4eb2f)) >>> 0;

export { isFinalSector } from './depth.js';

/**
 * O anuncio de chegada num setor, montado num lugar so.
 *
 * Descida e subida emitem o MESMO evento (a subida so acrescenta `ascending`),
 * e ele carrega agora o que o HUD precisa para desenhar profundidade dinamica:
 * o total acessivel, se ha Nucleo aqui, quem guarda o setor e se o selo ja
 * cedeu. Montar isso nos dois lugares foi o que deixou `final` correto na
 * descida e desatualizado na subida em versoes anteriores.
 */
const sectorEntered = (state: SurvivalState): Extract<SemanticEvent, { t: 'sector_entered' }> => ({
  t: 'sector_entered',
  sector: state.sector,
  final: isFinalSector(state.sector, runSectorCount(state)),
  stratum: state.stratum,
  occupation: state.occupation,
  sectorCount: runSectorCount(state),
  hasCore: runDepth(state).coreSectors.includes(state.sector),
  boss: state.sectorBoss.archetype,
  unsealed: state.sectorBoss.archetype === null || state.sectorBoss.defeated,
});

/**
 * Bolso micelial do Bispo: a colonia que tomou a camara do chefe.
 *
 * O Bispo agora so aparece onde o micelio DOMINA (bossForBiome), entao o mapa
 * dele sempre tem fungo espalhado — mas a luta e um problema de terreno (tirar
 * o chao fungico de baixo dele), e a CAMARA especificamente precisa da colonia
 * garantida: um disco de tapete em volta do ponto do chefe, plantado sobre o
 * que quer que o estrato tenha posto ali (inclusive agua — a colonia cresceu
 * por cima). E a gramatica de "bolso" da spec: um encontro autoral dentro de
 * um estrato qualquer.
 */
const BISHOP_POCKET_RADIUS = 4;
/** Ate onde o pedestal do objetivo resiste a colonia (Chebyshev, em celulas). */
const PEDESTAL_KEEPOUT = 3;
const plantBishopPocket = (state: SurvivalState, cx: number, cy: number): void => {
  const w = state.config.width;
  const h = state.config.height;
  for (let y = Math.max(1, cy - BISHOP_POCKET_RADIUS); y <= Math.min(h - 2, cy + BISHOP_POCKET_RADIUS); y++) {
    for (let x = Math.max(1, cx - BISHOP_POCKET_RADIUS); x <= Math.min(w - 2, cx + BISHOP_POCKET_RADIUS); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > BISHOP_POCKET_RADIUS * BISHOP_POCKET_RADIUS) continue;
      // O PEDESTAL e mais antigo que a colonia. O anel do objetivo carrega o
      // sotaque do estrato (fosso de agua no Aquifero, brasa na Fornalha...) e
      // ele e FUNCIONAL — o fosso conduz a descarga do jogador. Com o chefe
      // agora na MESMA camara que o nucleo (um chefe por run, no setor final),
      // deixar o bolso engolir o anel apagaria a identidade e a funcao do
      // pedestal em todo mapa micelial. Excecao: o 3x3 do PROPRIO chefe —
      // a cura dele e o tapete sob os pes, e um Bispo que nasce em chao nu
      // porque calhou de nascer perto do pedestal nao tem encontro.
      const onPedestal =
        Math.max(Math.abs(x - state.corePos.x), Math.abs(y - state.corePos.y)) <= PEDESTAL_KEEPOUT;
      const underBoss = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
      if (onPedestal && !underBoss) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      setSurface(state, i, SURF_FUNGAL, 0);
    }
  }
};

/**
 * Onde a assinatura realmente nasce: espreitadores sao realocados para a
 * celula do proprio elemento (agua/gelo) mais proxima do ponto sorteado, numa
 * varredura em anel deterministica. Sem elemento ao alcance, ficam no ponto
 * original — expostos, que e um encontro valido, so nao o ideal.
 */
const signatureHome = (
  state: SurvivalState,
  signature: EnemyArchetype,
  x: number,
  y: number,
  taken: Set<number>,
): { x: number; y: number } => {
  const wantsWater = signature === 'mud_lamprey';
  const wantsIce = signature === 'frost_wraith';
  if (!wantsWater && !wantsIce) return { x, y };
  const w = state.config.width;
  const h = state.config.height;
  for (let r = 0; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx <= 0 || ny <= 0 || nx >= w - 1 || ny >= h - 1) continue;
        const i = ny * w + nx;
        if (state.solid[i] !== SOLID_NONE) continue;
        // Um lago so tem UM dono por celula. Sem esta reserva, dois membros do
        // mesmo bando cujos pontos de spawn ficam perto convergem para a mesma
        // agua (a varredura em anel e deterministica e escolhe sempre a mesma
        // celula) e nascem EMPILHADOS: um sprite, uma hitbox, dois bichos
        // atacando. Enquanto o pack era 1 isso nao podia acontecer; foi o
        // bando que criou o caso.
        if (taken.has(i)) continue;
        if (wantsWater && isConductiveSurface(state.surface[i])) {
          taken.add(i);
          return { x: nx, y: ny };
        }
        if (wantsIce && state.surface[i] === SURF_ICE) {
          taken.add(i);
          return { x: nx, y: ny };
        }
      }
    }
  }
  return { x, y };
};

/**
 * Popula inimigos e o CHEFE (se houver) do setor.
 *
 * `bossSpawn` e o ponto que o worldgen reservou com folga para um corpo grande.
 * Chamava-se `guardian` e o nome mentia desde que a camara passou a poder ser
 * de qualquer um da tabela; agora ele e o que sempre foi — uma posicao.
 */
export const populateSector = (
  state: SurvivalState,
  spawns: readonly { x: number; y: number }[],
  bossSpawn: { x: number; y: number },
): void => {
  // A mistura sai do BIOMA, nao mais de uma tabela por numero de setor: o
  // aquifero e anfibio, o prismatico e mineral, o micelio traz o proprio
  // ecossistema. A profundidade continua endurecendo a composicao la dentro.
  const biome = { stratum: state.stratum, occupation: state.occupation, lineage: state.lineage };
  const mix = biomeMix(biome, state.sector);
  // Um elite por setor, no meio da lista: cedo demais e o jogador ainda nao tem
  // com o que responder, tarde demais e ele ja passou pelo setor.
  const eliteIndex = Math.floor(spawns.length / 2);
  // O CHEFE deste setor, resolvido por posicao (ultimo setor ou setor de
  // Nucleo) e por bioma (quem e). `null` = setor sem dono, e a maioria e.
  //
  // O estado generico e escrito AQUI, e nao pelo chamador, porque este e o
  // unico ponto por onde toda entrada de setor passa — createRun, descend e
  // ascend. Escrever nos tres deixaria o quarto de fora.
  state.sectorBoss = resolveSectorBoss(state, state.sector);
  const bossArchetype = state.sectorBoss.archetype;
  const bossHere = bossArchetype !== null;
  const budget = Math.min(spawns.length, MAX_ENEMIES - (bossHere ? 1 : 0));

  // O Cavalo OCUPA a vaga do elite em vez de somar um inimigo.
  //
  // Somar seria inflar a contagem do setor num sorteio, e a densidade e a coisa
  // que menos deveria variar por sorte: o mesmo mapa ficaria facil ou apertado
  // sem nada visivel explicando a diferenca. Ocupando a vaga, o que o sorteio
  // decide e QUAL e a ameaca de destaque daquele setor — um bicho reforcado ou
  // um cavalo que redesenha o chao — e nao quantas existem.
  //
  // A tirada vem de `state.rng`, o mesmo gerador da run: o setor 2 da seed X tem
  // cavalo para todo mundo que jogar a seed X, senao o replay do leaderboard
  // divergiria do que o jogador viveu.
  // SEMPRE uma tirada, qualquer que seja o bioma: a ocupacao muda o LIMIAR e
  // nunca a quantidade de sorteios, senao a mesma seed produziria runs
  // diferentes conforme a linhagem consumisse a RNG em ordens distintas.
  const horseHere = state.rng.nextFloat01() < horseChanceFor(biome, HORSE_SPAWN_CHANCE);

  // O inimigo de ASSINATURA do estrato ocupa vagas comuns — nunca soma. O
  // padrao e UM por setor (encontro autoral); a Lampreia vem em bando (ver
  // SIGNATURE_PACK), espalhada pela lista para os lagos do setor inteiro
  // pertencerem a ela. Espreitadores nascem DENTRO do proprio elemento: uma
  // lampreia em chao seco nao e um encontro, e um peixe fora d'agua.
  const signature = SIGNATURE_OF_STRATUM[state.stratum] as EnemyArchetype | undefined;
  const signatureIndices = new Set<number>();
  // Celulas de elemento ja entregues a um membro do bando. Local, como o
  // `taken` de populateMiners: vale durante a povoacao e nao existe depois.
  const signatureHomes = new Set<number>();
  if (signature) {
    const pack = SIGNATURE_PACK[signature] ?? 1;
    for (let k = 1; k <= pack; k++) {
      let idx = Math.floor((budget * k) / (pack + 1));
      // A vaga do elite tem dono; a assinatura desliza uma casa em vez de sumir.
      if (idx === eliteIndex) idx = idx + 1 < budget ? idx + 1 : Math.max(0, idx - 1);
      signatureIndices.add(idx);
    }
  }

  for (let i = 0; i < budget; i++) {
    if (i === eliteIndex && horseHere) {
      // Nao entra como `elite`: elite acende o fungo sob os proprios pes, e o
      // cavalo ficaria cercado do fogo que so a investida dele devia acender.
      spawnEnemy(state, 'fungal_horse', spawns[i].x, spawns[i].y, false);
      continue;
    }
    if (signature && signatureIndices.has(i) && i !== eliteIndex) {
      const home = signatureHome(state, signature, spawns[i].x, spawns[i].y, signatureHomes);
      spawnEnemy(state, signature, home.x, home.y, false);
      continue;
    }
    spawnEnemy(state, mix[i % mix.length], spawns[i].x, spawns[i].y, i === eliteIndex);
  }

  // A camara recebe o chefe QUE O BIOMA PEDE: ocupacao forte primeiro
  // (micelio -> Bispo), depois o chefe natural do estrato.
  //
  // MAS chefe abatido nao volta. Na subida da extracao de retorno o setor e
  // regenerado inteiro, e sem esta guarda o chefe morto reaparecia na camara —
  // a fauna repovoar e a pressao prometida, um chefe repovoar e uma conquista
  // desmanchando. O BOLSO do Bispo continua sendo plantado de qualquer jeito:
  // a colonia e terreno, e ela nao morreu junto com quem reinava sobre ela.
  if (bossHere) {
    if (bossArchetype === 'bishop') plantBishopPocket(state, bossSpawn.x, bossSpawn.y);
    if (!state.sectorBoss.defeated) {
      const body = spawnEnemy(state, bossArchetype, bossSpawn.x, bossSpawn.y, false);
      // O id do corpo em campo. E por ele que a morte sabe que ESTE cadaver era
      // o dono do setor, e nao um segundo exemplar do mesmo arquetipo — o que
      // acontece de verdade quando um Bispo guarda uma camara micelial cheia de
      // fauna micelial.
      state.sectorBoss.entityId = body.id;
    }
  }
  populateMiners(state, spawns, biomeProfile(biome, state.sector).minerCap);
};

/**
 * Mineradores nascem PERTO DE MINERIO, e nao em pontos de spawn de inimigo.
 *
 * O lugar e a caracterizacao: eles ainda estao trabalhando o veio, decadas
 * depois de a grade que os mandou ter parado de responder. Espalha-los pelos mesmos
 * pontos que os bichos os transformaria em mais um inimigo que por acaso nao
 * ataca — o encontro so significa alguma coisa acontecendo ONDE voce foi buscar
 * o que eles ja estavam tirando.
 *
 * A varredura anda pelos pontos de spawn em ordem fixa e procura minerio na
 * vizinhanca de cada um, com a ordem de iteracao como desempate. Deterministica
 * pelo mesmo motivo de sempre: as duas maquinas de uma sala de co-op precisam
 * colocar os mineradores nas MESMAS celulas.
 */
const populateMiners = (
  state: SurvivalState,
  spawns: readonly { x: number; y: number }[],
  cap: number,
): void => {
  const w = state.config.width;
  let placed = 0;
  // Uma celula so recebe UM minerador.
  //
  // Duas janelas de busca vizinhas enxergam o mesmo veio e, varrendo na mesma
  // ordem fixa, escolhem a mesma celula ao lado dele — no setor 1 com semente 9
  // os dois nasciam exatamente em `78.5,82.5`. Empilhados, eles desenham e andam
  // como um corpo so, e o jogador so descobre o segundo quando o primeiro morre e
  // sobra vida onde nao devia haver mais nada. A reserva e um `Set` local e nao um
  // campo de estado: ela vale durante a povoacao e nao existe depois dela.
  const taken = new Set<number>();
  for (const enemy of state.enemies) {
    if (enemy.alive) taken.add(Math.floor(enemy.y) * w + Math.floor(enemy.x));
  }
  for (const spawn of spawns) {
    if (placed >= cap || state.enemies.length >= MAX_ENEMIES) return;
    let found: { x: number; y: number } | null = null;
    // O VEIO que o pos ali. Guardado junto com a celula porque o encontro
    // inteiro depende dele: um minerador de costas para a rocha e so um corpo
    // parado no corredor.
    let vein: { x: number; y: number } | null = null;
    for (let dy = -MINER_ORE_SEARCH; dy <= MINER_ORE_SEARCH && !found; dy++) {
      for (let dx = -MINER_ORE_SEARCH; dx <= MINER_ORE_SEARCH && !found; dx++) {
        const x = spawn.x + dx;
        const y = spawn.y + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
        if (state.solid[y * w + x] !== SOLID_ORE) continue;
        // O veio e solido: ele fica ao LADO dele, num chao livre, nao dentro.
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const fx = x + ox;
          const fy = y + oy;
          const i = fy * w + fx;
          if (state.solid[i] !== SOLID_NONE) continue;
          if (taken.has(i)) continue;
          found = { x: fx, y: fy };
          vein = { x, y };
          break;
        }
      }
    }
    if (!found || !vein) continue;
    taken.add(found.y * w + found.x);
    const miner = spawnEnemy(state, 'miner', found.x, found.y, false);
    // E ele nasce ENCARANDO o veio.
    //
    // O lugar ja dizia "ele ainda esta trabalhando o minerio", mas a POSTURA
    // desmentia: todo miner nascia com o facing padrao (leste), entao metade
    // deles picaretava o corredor vazio de costas para a rocha que motivou o
    // proprio spawn. A animacao de repouso e a batida da picareta; virada
    // para o nada, ela lia como um tique, e nao como trabalho.
    //
    // O veio e ortogonalmente adjacente (a busca acima so aceita vizinho de
    // aresta), entao a direcao sai exata, sem normalizar.
    miner.facing = { x: vein.x - found.x, y: vein.y - found.y };
    placed++;
  }
};

/**
 * Troca o mundo pelo do proximo setor, preservando os jogadores.
 *
 * Nao verifica se ha proximo setor nem se o selo cedeu: quem chama decide. No
 * ultimo setor o mesmo ponto significa outra coisa (o Nucleo) e o caminho e
 * completamente diferente, e num setor selado a interacao nem chega aqui.
 */
export const descend = (state: SurvivalState, events: SemanticEvent[]): void => {
  const width = state.config.width;
  const height = state.config.height;
  state.sector += 1;
  state.sectorStartedAt = state.tick;

  // Mesma mistura de createRun: o setor 2 gerado ao descer tem de ser IDENTICO
  // ao setor 2 construido por `createRun({ sector: 2 })`, senao um cliente que
  // reconstroi o mundo ao reconectar veria outro mapa. O bioma sai da MESMA
  // derivacao pura da seed, pela mesma razao.
  const biome = sectorBiome(state.config.seed, state.sector);
  state.stratum = biome.stratum;
  state.occupation = biome.occupation;
  state.lineage = biome.lineage;
  // A mesma fonte unica do createRun — a troca de setor regenera o mundo pelo
  // perfil identico, garantia inclusa.
  const profile = sectorProfile(state.config.seed, state.sector);
  const world = generateWorld(
    sectorSeed((state.config.seed ^ RUN_SEED_MIX) >>> 0, state.sector),
    width,
    height,
    profile,
  );

  state.solid = world.solid;
  state.surface = world.surface;
  state.surfaceTimer = new Uint16Array(width * height);
  state.entry = world.entry;
  state.corePos = world.corePos;

  // TODA versao de chunk avanca. O cliente online detecta mundo novo por
  // divergencia de versao; sem o incremento global, chunks que por acaso
  // tivessem o mesmo conteudo ficariam marcados como atuais e o jogador veria
  // pedacos do setor ANTERIOR costurados no novo.
  for (let i = 0; i < state.chunkVersion.length; i++) state.chunkVersion[i] += 1;

  state.enemies = [];
  state.projectiles = [];
  state.charges = [];
  state.reactionQueue = [];
  state.vents = world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 }));
  state.railTracks = world.railTracks.map((t) => ({ ...t, readyAt: 0, firingAt: 0, fromEnd: 0 as const }));
  state.hallCenters = world.hallCenters;
  // Segmentos do setor novo, todos dormentes — os relogios do setor velho
  // descreviam paredes que ja nao existem.
  state.leylineSegments = world.leylines.map((seg) => ({
    cells: seg.cells,
    dischargeAt: 0,
    refractoryUntil: 0,
    triggeredBy: -1,
    relayed: false,
  }));
  // Os reles e o circuito tambem zeram: o roteamento descrevia paredes que ja
  // nao existem, e a subversao do estrato VELHO nao acompanha quem desceu — e
  // isso que faz o premio ser "ate a proxima descida" sem nenhum relogio.
  resetLeylineNetwork(state, world);
  state.salvageSites = world.salvageSites.map((site) => ({
    ...site,
    terminalState: 'inactive' as const,
    scanEndsAt: 0,
    cacheRevealed: false,
    cacheOpened: false,
    openedBySlot: null,
  }));

  // Os Ecos do poco ficaram no mapa antigo, e a ressonancia descrevia o setor que
  // acabou de ser trocado. Levar qualquer um dos dois adiante faria o poco do
  // setor 2 oferecer o estilo com que o jogador atravessou o setor 1.
  state.wellOffers = [];
  for (const extra of state.playerExtras) extra.resonance = emptyResonance();

  state.bossRuntime = emptyBossRuntime();
  state.leftEntryZone = false;

  // A contaminacao NAO zera. Descer alivia, nunca absolve: comecar limpo faria
  // do poco um botao de reset e destruiria a pressao que da sentido a decisao
  // de explorar mais antes de descer.
  state.contamination = Math.min(1, state.contamination * CONTAMINATION_CARRYOVER);
  state.contaminationWaves = 0;

  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  for (let slot = 0; slot < state.players.length; slot++) {
    const player = state.players[slot];
    const extra = state.playerExtras[slot];
    const offset = offsets[slot] ?? offsets[0];
    player.x = world.entry.x + offset.x;
    player.y = world.entry.y + offset.y;
    player.vx = 0;
    player.vy = 0;
    player.stunnedUntil = 0;
    player.alertedUntil = 0;
    player.action = undefined;
    // Quem chegou abatido no poco desce de pe. O parceiro ja pagou o resgate ao
    // arrasta-lo ate aqui, e manter o abatido do outro lado significaria
    // sangrar num mapa que ele nem viu.
    if (extra.downed && player.alive) {
      extra.downed = false;
      player.hp = Math.max(player.hp, Math.floor(player.maxHp * 0.35));
    }
    extra.heat = 0;
    extra.overheatedUntil = 0;
    // O canal do sopro nao atravessa a descida: o mapa novo nao tem o fogo que
    // o canal estava pintando, e um bolt travado sem chama na tela mentiria.
    // A MIRA fica — trocar de setor nao gira o Prospector.
    extra.channelingUntil = 0;
    extra.dodgeUntil = 0;
    extra.iframesUntil = 0;
    extra.pendingModuleChoice = null;
  }

  populateSector(state, world.enemySpawns, world.guardianSpawn);
  events.push(sectorEntered(state));
};

/**
 * A SUBIDA do caminho de volta: com o Nucleo na mao, o contrato so fecha na
 * plataforma do SETOR 1 — e cada setor tem de ser atravessado de novo, ao
 * contrario: chega-se pelo POCO (por onde se desceu) e sai-se pela ENTRADA.
 *
 * O setor e regenerado da MESMA seed derivada da descida: o mapa e identico
 * ao que o jogador atravessou (mesma geografia, mesmos trilhos), mas o Veio
 * nao ficou esperando — a fauna repovoou, os sites de salvage rearmaram, e a
 * contaminacao NAO alivia na subida (descer alivia; subir e a conta
 * chegando). Populacao identica a de createRun({sector}) pela mesma razao de
 * sempre: reconexao e replay reconstroem o mesmo mundo.
 */
export const ascend = (state: SurvivalState, events: SemanticEvent[]): void => {
  const width = state.config.width;
  const height = state.config.height;
  state.sector -= 1;
  state.sectorStartedAt = state.tick;

  const biome = sectorBiome(state.config.seed, state.sector);
  state.stratum = biome.stratum;
  state.occupation = biome.occupation;
  state.lineage = biome.lineage;
  // A mesma fonte unica do createRun — a troca de setor regenera o mundo pelo
  // perfil identico, garantia inclusa.
  const profile = sectorProfile(state.config.seed, state.sector);
  const world = generateWorld(
    sectorSeed((state.config.seed ^ RUN_SEED_MIX) >>> 0, state.sector),
    width,
    height,
    profile,
  );

  state.solid = world.solid;
  state.surface = world.surface;
  state.surfaceTimer = new Uint16Array(width * height);
  state.entry = world.entry;
  state.corePos = world.corePos;
  for (let i = 0; i < state.chunkVersion.length; i++) state.chunkVersion[i] += 1;

  state.enemies = [];
  state.projectiles = [];
  state.charges = [];
  state.reactionQueue = [];
  state.vents = world.ventPositions.map((p) => ({ x: p.x, y: p.y, nextEmitAt: 0 }));
  state.railTracks = world.railTracks.map((t) => ({ ...t, readyAt: 0, firingAt: 0, fromEnd: 0 as const }));
  state.hallCenters = world.hallCenters;
  // Segmentos do setor novo, todos dormentes — os relogios do setor velho
  // descreviam paredes que ja nao existem.
  state.leylineSegments = world.leylines.map((seg) => ({
    cells: seg.cells,
    dischargeAt: 0,
    refractoryUntil: 0,
    triggeredBy: -1,
    relayed: false,
  }));
  // Os reles e o circuito tambem zeram: o roteamento descrevia paredes que ja
  // nao existem, e a subversao do estrato VELHO nao acompanha quem desceu — e
  // isso que faz o premio ser "ate a proxima descida" sem nenhum relogio.
  resetLeylineNetwork(state, world);
  state.salvageSites = world.salvageSites.map((site) => ({
    ...site,
    terminalState: 'inactive' as const,
    scanEndsAt: 0,
    cacheRevealed: false,
    cacheOpened: false,
    openedBySlot: null,
  }));

  // Na subida o poco nao oferece nada — e a ressonancia acumulada FICA: o
  // caminho de volta e a prova do estilo com que se desceu, nao um recomeco.
  state.wellOffers = [];

  state.bossRuntime = emptyBossRuntime();
  // Os jogadores emergem no POCO, fundo do mapa: a zona de entrada ja esta
  // longe, entao a saida (subir de novo, ou extrair no setor 1) nasce armada.
  state.leftEntryZone = true;

  const offsets = [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ];
  for (let slot = 0; slot < state.players.length; slot++) {
    const player = state.players[slot];
    const extra = state.playerExtras[slot];
    const offset = offsets[slot] ?? offsets[0];
    player.x = world.corePos.x + offset.x;
    player.y = world.corePos.y + offset.y;
    player.vx = 0;
    player.vy = 0;
    player.stunnedUntil = 0;
    player.alertedUntil = 0;
    player.action = undefined;
    if (extra.downed && player.alive) {
      extra.downed = false;
      player.hp = Math.max(player.hp, Math.floor(player.maxHp * 0.35));
    }
    extra.heat = 0;
    extra.overheatedUntil = 0;
    // Mesma regra da descida: canal do sopro nao atravessa a transicao; mira sim.
    extra.channelingUntil = 0;
    extra.dodgeUntil = 0;
    extra.iframesUntil = 0;
    extra.pendingModuleChoice = null;
  }

  populateSector(state, world.enemySpawns, world.guardianSpawn);
  events.push({ ...sectorEntered(state), ascending: true });
};

/** Celula do poco/nucleo esta livre? Usado so por testes e diagnostico. */
export const descentPointOpen = (state: SurvivalState): boolean =>
  state.solid[state.corePos.y * state.config.width + state.corePos.x] === SOLID_NONE;

/** Chunks por linha; util a quem itera versoes de chunk. */
export const chunksPerRow = (width: number): number => Math.ceil(width / CHUNK);
