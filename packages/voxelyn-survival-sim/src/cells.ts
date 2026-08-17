import {
  BUDGET_DISCHARGE_CELLS,
  BUDGET_REACTING_CELLS,
  CELL_STEP_INTERVAL,
  COAL_FIRE_FUEL_TICKS,
  DISCHARGE_TICKS,
  FIRE_FUEL_TICKS,
  ICE_REFREEZE_TICKS,
  FIRE_SPREAD_BIOFLUID,
  FUNGAL_FIRE_FUEL_TICKS,
  FUNGAL_HEAT_IMPACT_TICKS,
  FUNGAL_HEAT_TICKS,
  GAS_FLASH_TICKS,
  GAS_LIFE_TICKS,
  GAS_SPREAD_CHANCE,
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_NONE,
  DELUGE_FRONT_SPEED,
  DELUGE_FIELD_REFRESH_TICKS,
  PIPE_MOUTH,
  isPipe,
  SOLID_ROCK,
  SPORE_BURN_TICKS,
  SURF_BIOFLUID,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_NONE,
  SURF_ICE,
  SURF_GLASS,
  SURF_SCORCHED,
  SURF_SILT,
  SURF_SPORES,
  SURF_WATER,
  VENT_BASE_INTERVAL_TICKS,
  VENT_CYCLE_TICKS,
} from './constants.js';
import { markDiscovery } from './stats.js';
import {
  DISCOVERY_FIRE_SPREAD,
  DISCOVERY_FRAGILE_BREACH,
  DISCOVERY_GAS_IGNITION,
  DISCOVERY_SILICA_VITRIFIED,
} from './types.js';
import { chunkOf } from './worldgen.js';
import type { EffectOrigin, Entity, SemanticEvent, SurvivalState } from './types.js';

const W = (state: SurvivalState): number => state.config.width;
const H = (state: SurvivalState): number => state.config.height;

export const markDirty = (state: SurvivalState, x: number, y: number): void => {
  state.chunkVersion[chunkOf(x, y, W(state))]++;
};

const isReactiveSurface = (kind: number): boolean =>
  kind === SURF_FIRE || kind === SURF_GAS || kind === SURF_SPORES || kind === SURF_FUNGAL_HEATED;

/**
 * Superficies que conduzem descarga eletrica.
 *
 * Biofluido e agua conduzem JUNTOS: uma poca de lodo encostada num lago faz a
 * carga atravessar os dois. E deliberado — a conducao territorial do Aquifero
 * so funciona se o jogador puder ler "liquido conectado = circuito", sem
 * decorar excecoes por materia.
 */
export const isConductiveSurface = (kind: number): boolean =>
  kind === SURF_BIOFLUID || kind === SURF_WATER;

/**
 * O raio ja alcancado pela frente do Diluvio, ou -1 se ele nunca aconteceu.
 *
 * Funcao PURA de (tick, instante da subida). E o que permite ao cliente
 * desenhar a lamina sem receber uma unica celula pelo wire: as duas pontas
 * fazem a mesma conta a partir dos tres numeros que ja viajam no `bossRuntime`.
 */
export const delugeFront = (state: SurvivalState): number => {
  const at = state.bossRuntime.delugeAt;
  if (at < 0) return -1;
  return Math.max(0, (state.tick - at) * DELUGE_FRONT_SPEED);
};

/**
 * Esta celula esta SUBMERSA?
 *
 * O Diluvio nao e uma superficie: ele nao ocupa `state.surface`, e por isso o
 * material de baixo continua inteiro — na regra e na tela. O que ele faz e
 * cobrir, e cobrir e uma pergunta que se responde por geometria.
 *
 * Rocha nao submerge: o lencol sobe pelos vaos, nao por dentro do macico. Isso
 * tambem e o que impede o Diluvio de virar um condutor que atravessa parede —
 * a inundacao e total no espaco ABERTO, e o espaco aberto e o mesmo por onde a
 * corrente ja andava.
 */
export const isDeluged = (state: SurvivalState, i: number): boolean => {
  const front = delugeFront(state);
  if (front < 0) return false;
  if (state.solid[i] !== SOLID_NONE) return false;
  return delugeField(state)[i] <= front;
};

/** Sem caminho ate nenhuma boca: esta celula nao enche nunca. */
const DELUGE_UNREACHED = 0xffff;

/**
 * A DISTANCIA DA AGUA ate cada celula, andando pelos vaos.
 *
 * O Diluvio so molha o chao, e por isso as paredes recortam o alagado em
 * CANAIS — e um campo geodesico e a unica forma honesta de dizer isso. Um
 * circulo diria que uma sala selada do outro lado da rocha enche junto so
 * porque esta perto; a busca em largura diz que ela enche quando a agua
 * encontra o caminho ate la, ou nunca.
 *
 * As FONTES sao as bocas dos canos, e nao o corpo do chefe. E o que faz a
 * inundacao entrar pelas paredes em vez de brotar do meio da sala — "os dutos
 * estao enchendo a camara" e uma frase que o campo desenha sozinho. O corpo
 * dele entra como fonte de reserva, porque uma camara sem cano nenhum ainda
 * precisa submergir.
 *
 * DERIVADO: sai de (solido, canos, origem), que as duas pontas ja tem. Nao
 * entra no hash e nao viaja no wire — e a mesma economia da cunha da Fornalha,
 * num dado mil vezes maior. Refeito por BUCKET de tick para as duas pontas
 * refazerem nos mesmos instantes, e nao quando cada uma tiver vontade.
 */
export const delugeField = (state: SurvivalState): Uint16Array => {
  const w = W(state);
  const h = H(state);
  const bucket = Math.floor(state.tick / DELUGE_FIELD_REFRESH_TICKS);
  const cached = state.delugeField;
  if (cached && cached.length === w * h && state.delugeFieldBucket === bucket) return cached;

  const field = cached && cached.length === w * h ? cached : new Uint16Array(w * h);
  field.fill(DELUGE_UNREACHED);
  state.delugeField = field;
  state.delugeFieldBucket = bucket;

  // As bocas primeiro, em ordem de indice: duas maquinas do mesmo mapa tem de
  // semear a busca na mesma ordem.
  const queue: number[] = [];
  for (let i = 0; i < field.length; i++) {
    if (!isPipe(state.solid[i])) continue;
    const [dx, dy] = PIPE_MOUTH[state.solid[i]];
    const x = (i % w) + dx;
    const y = ((i - (i % w)) / w) + dy;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const mouth = y * w + x;
    if (state.solid[mouth] !== SOLID_NONE || field[mouth] === 0) continue;
    field[mouth] = 0;
    queue.push(mouth);
  }
  // O corpo do chefe e a fonte de RESERVA: uma camara sem duto nenhum ainda
  // precisa submergir, e o lencol sobe de baixo mesmo onde ninguem construiu
  // nada.
  const bx = Math.floor(state.bossRuntime.delugeX);
  const by = Math.floor(state.bossRuntime.delugeY);
  if (bx >= 0 && by >= 0 && bx < w && by < h) {
    const origin = by * w + bx;
    if (state.solid[origin] === SOLID_NONE && field[origin] !== 0) {
      field[origin] = 0;
      queue.push(origin);
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    const cx = cell % w;
    const cy = (cell - cx) / w;
    const next = field[cell] + 1;
    for (let k = 0; k < 4; k++) {
      const x = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
      const y = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const ni = y * w + x;
      if (state.solid[ni] !== SOLID_NONE || field[ni] <= next) continue;
      field[ni] = next;
      queue.push(ni);
    }
  }
  return field;
};

/**
 * A celula conduz? — a pergunta que a descarga faz, e que passou a ter duas
 * respostas possiveis.
 *
 * Existe porque `isConductiveSurface` le a MATERIA e o Diluvio nao e uma
 * materia. Todo caminho que decide por onde a corrente anda tem de passar por
 * aqui, senao a lamina do Leviata conduziria para uns sistemas e nao para
 * outros — e a incoerencia apareceria como "o choque nao pegou" no meio da
 * unica fase em que o mapa inteiro e um circuito.
 */
export const isConductiveCell = (state: SurvivalState, i: number): boolean => {
  // A SUBVERSAO do Aquifero passa por aqui, e passa AQUI e nao em
  // `isConductiveSurface` de proposito: a funcao de superficie e pura (le um
  // `kind`, nao um estado) e e o vocabulario que o cliente tambem usa. Quem
  // conhece o setor e esta.
  //
  // O Diluvio NAO e desligado: ele e obra do Leviata, nao propriedade do
  // estrato — e a fase em que o mapa inteiro vira circuito continua sendo dele.
  if (state.stratumSubverted && state.stratum === 'aquifer') return isDeluged(state, i);
  return isConductiveSurface(state.surface[i]) || isDeluged(state, i);
};

export const setSurface = (state: SurvivalState, i: number, kind: number, timer: number): void => {
  state.surface[i] = kind;
  state.surfaceTimer[i] = timer;
  const x = i % W(state);
  const y = (i - x) / W(state);
  markDirty(state, x, y);
  // Agua COM timer e agua derretida de gelo: entra na fila para recongelar.
  // Agua nativa (timer 0) continua inerte, como toda superficie permanente.
  if (isReactiveSurface(kind) || (kind === SURF_WATER && timer > 0)) state.reactionQueue.push(i);
};

/** Derrete uma celula de gelo em agua condutiva que vai recongelar sozinha. */
export const meltIce = (state: SurvivalState, i: number): boolean => {
  // Circuito fechado na Cripta: a lamina para de derreter. Some junto a agua
  // condutiva que o degelo criava — e some a janela de rota que ela abria,
  // que e o lado da moeda que o jogador paga.
  if (state.stratumSubverted && state.stratum === 'glacial') return false;
  if (state.surface[i] !== SURF_ICE) return false;
  setSurface(state, i, SURF_WATER, ICE_REFREEZE_TICKS);
  return true;
};

const announceIgnite = (state: SurvivalState, i: number, events: SemanticEvent[]): void => {
  const x = i % W(state);
  events.push({ t: 'ignite', x, y: (i - x) / W(state) });
};

/**
 * Comeca ou acelera a secagem do tapete fungico.
 *
 * O fungo e biomassa umida: calor nao o troca por fogo no mesmo instante. O
 * estado intermediario viaja pelo grid, portanto o cliente mostra a colonia
 * fumegando antes da chama aparecer. `directHeat` representa um novo impacto
 * termico; proximidade de fogo apenas inicia a secagem e deixa o relogio correr.
 */
export const heatFungalCell = (
  state: SurvivalState,
  i: number,
  directHeat = false
): boolean => {
  const surf = state.surface[i];
  if (surf === SURF_FUNGAL) {
    const timer = Math.max(CELL_STEP_INTERVAL, FUNGAL_HEAT_TICKS - (directHeat ? FUNGAL_HEAT_IMPACT_TICKS : 0));
    setSurface(state, i, SURF_FUNGAL_HEATED, timer);
    return true;
  }
  if (surf === SURF_FUNGAL_HEATED && directHeat) {
    state.surfaceTimer[i] = Math.max(CELL_STEP_INTERVAL, state.surfaceTimer[i] - FUNGAL_HEAT_IMPACT_TICKS);
    return true;
  }
  return surf === SURF_FUNGAL_HEATED;
};

/**
 * Aplica uma fonte de chama a uma superficie.
 *
 * Cada materia tem sua propria assinatura:
 * - fungo umido apenas entra em secagem;
 * - gas vira um flash curtissimo;
 * - esporos queimam/esterilizam sem explodir;
 * - biofluido usa a combustao normal.
 */
export const igniteCell = (state: SurvivalState, i: number, events: SemanticEvent[]): boolean => {
  const surf = state.surface[i];
  if (surf === SURF_FUNGAL) return heatFungalCell(state, i, false);
  if (surf === SURF_FUNGAL_HEATED) {
    // Uma nova fonte de calor acelera a secagem, mas nao ignora a umidade que
    // ainda resta. A transicao para fogo continua pertencendo ao relogio de
    // stepCells, garantindo que o aviso fumegante nunca seja pulado.
    return heatFungalCell(state, i, true);
  }
  if (surf === SURF_GAS) {
    setSurface(state, i, SURF_FIRE, GAS_FLASH_TICKS);
    markDiscovery(state.stats, DISCOVERY_GAS_IGNITION);
    announceIgnite(state, i, events);
    return true;
  }
  if (surf === SURF_SPORES) {
    setSurface(state, i, SURF_FIRE, SPORE_BURN_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  if (surf === SURF_BIOFLUID) {
    setSurface(state, i, SURF_FIRE, FIRE_FUEL_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  if (surf === SURF_ICE) {
    // Calor nao acende gelo: derrete. A agua que sobra e condutiva e vai
    // recongelar — quem derreteu abriu uma janela, nao editou o mapa.
    meltIce(state, i);
    return false;
  }
  if (surf === SURF_SILT) {
    // VITRIFICACAO. Calor na silica solta nao acende nada: FUNDE. O que sobra e
    // vidro, e vidro e chao firme — o Devorador Branco nao sobe por ele.
    //
    // E o unico contra-jogo do encontro, e ele e territorial em vez de
    // reflexivo: nao se trata de acertar o verme, e de decidir onde ele NAO
    // pode sair. O rastro dele e a propria materia-prima disso.
    setSurface(state, i, SURF_GLASS, 0);
    markDiscovery(state.stats, DISCOVERY_SILICA_VITRIFIED);
    return false;
  }
  if (surf === SURF_SCORCHED && state.stratum === 'furnace') {
    // Na Fornalha o chao queimado e CARVAO, nao cinza esteril: explosao ou
    // chama o acende em combustao persistente. So la — em qualquer outro
    // estrato a cinza continua sendo o fim do fogo, nunca o recomeco.
    setSurface(state, i, SURF_FIRE, COAL_FIRE_FUEL_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
  return false;
};

/** Descarga eletrica: BFS pela poca de biofluido conectada, com orcamento. */
/**
 * Alastra por celulas conectadas que satisfacam `connected`, partindo da
 * vizinhanca 3x3 de (sx, sy), ate o orcamento.
 *
 * Era especifico de biofluido; virou generico porque veio de minerio e cadeia
 * de cristal alastram exatamente do mesmo jeito, so mudando o material. Manter
 * tres copias divergiria os orcamentos e o determinismo com o tempo.
 */
export const floodFrom = (
  state: SurvivalState,
  sx: number,
  sy: number,
  budget: number,
  connected: (index: number) => boolean
): number[] => {
  const w = W(state);
  const h = H(state);
  const startCells: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const i = ny * w + nx;
      if (connected(i)) startCells.push(i);
    }
  }
  if (startCells.length === 0) return [];

  const seen = new Set<number>(startCells);
  const queue = [...startCells];
  let head = 0;
  while (head < queue.length && seen.size < budget) {
    const cur = queue[head++];
    const cx = cur % w;
    const neighbors = [cur - 1, cur + 1, cur - w, cur + w];
    const valid = [cx > 0, cx < w - 1, cur >= w, cur < w * (h - 1)];
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue;
      const ni = neighbors[k];
      if (seen.has(ni) || !connected(ni)) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return [...seen];
};

/** Planta carga temporaria nas celulas dadas e anuncia a descarga. */
export const chargeCells = (
  state: SurvivalState,
  cells: number[],
  events: SemanticEvent[],
  origin: EffectOrigin = { source: 'environment' },
  /**
   * Onde a corrente ENTROU no condutor, quando ha um ponto so.
   *
   * Opcional porque nem toda descarga tem um: o canto do Arquicantor arma
   * dezenas de cristais de uma vez, e cada um e uma fonte. Sem ponto, o dano
   * continua plano — que e o comportamento que essas descargas sempre tiveram.
   */
  from?: { x: number; y: number },
  /**
   * A carga veio de um segmento de leyline armado por RELE. Viaja no evento
   * para `resolveChainedEvents` nao creditar ressonancia de novo — a cascata
   * inteira e uma ativacao so. Dano, stun e fogo amigo nao mudam.
   */
  relayed?: boolean,
): void => {
  if (cells.length === 0) return;
  for (const i of cells) {
    state.charges.push({ idx: i, until: state.tick + DISCHARGE_TICKS });
  }
  events.push({
    t: 'discharge',
    cells,
    ...origin,
    ...(from ? { fromX: from.x, fromY: from.y } : {}),
    ...(relayed ? { relayed: true } : {}),
  });
};

export const dischargeAt = (
  state: SurvivalState,
  sx: number,
  sy: number,
  events: SemanticEvent[],
  origin: EffectOrigin = { source: 'environment' }
): boolean => {
  const cells = floodFrom(state, sx, sy, BUDGET_DISCHARGE_CELLS, (i) => isConductiveCell(state, i));
  // O PONTO de entrada da corrente viaja com o evento, e nao so as celulas.
  //
  // Sem ele o dano da descarga so podia ser plano — a poca inteira cobrando
  // igual —, e num setor submerso "a poca inteira" passou a ser o setor
  // inteiro. Guardar de onde a corrente entrou e o que permite a atenuacao por
  // distancia existir (ver DELUGE_SHOCK_FULL_RANGE).
  chargeCells(state, cells, events, origin, { x: sx, y: sy });
  return cells.length > 0;
};

export const explodeAt = (
  state: SurvivalState,
  ex: number,
  ey: number,
  radius: number,
  events: SemanticEvent[],
  origin: EffectOrigin = { source: 'environment' }
): void => {
  const w = W(state);
  const h = H(state);
  events.push({ t: 'explosion', x: ex, y: ey, radius, ...origin });
  const r = Math.ceil(radius);
  for (let y = Math.max(0, Math.floor(ey) - r); y <= Math.min(h - 1, Math.floor(ey) + r); y++) {
    for (let x = Math.max(0, Math.floor(ex) - r); x <= Math.min(w - 1, Math.floor(ex) + r); x++) {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      if (dx * dx + dy * dy > radius * radius) continue;
      const i = y * w + x;
      // Delega em vez de repetir: esta copia da regra de quebra ja existia e
      // teria de aprender cada material novo por conta propria — um bloco
      // corroido seria indestrutivel ate por explosao.
      if (state.solid[i] !== SOLID_NONE) {
        breakSolid(state, x, y, events);
      } else {
        igniteCell(state, i, events);
      }
    }
  }
};

/**
 * Passo celular: processa fila deterministica de celulas reagindo com orcamento fixo.
 * Excedente fica na fila para o proximo passo (degrada latencia, nunca o determinismo).
 */
export const stepCells = (state: SurvivalState, events: SemanticEvent[]): void => {
  if (state.tick % CELL_STEP_INTERVAL !== 0) return;
  const w = W(state);
  const h = H(state);

  // Respiradouros minerais emitem o gas sulfurico periodicamente. A nuvem de
  // esporos e outra materia e nasce exclusivamente do Spore Bomber.
  for (const vent of state.vents) {
    // VENTILACAO da Fenda Sulfurosa: cada fonte alterna janelas ativas e
    // dormentes, com fase pela POSICAO — metade das camaras respira enquanto a
    // outra enche, e a rota muda com o relogio. A fase vem da posicao (e nunca
    // de sorteio) para as duas maquinas de uma sala concordarem sem trocar um
    // byte. Nos demais estratos o comportamento historico fica intacto.
    if (state.stratum === 'sulfur') {
      // Circuito fechado: a ventilacao trava DESLIGADA. A identidade da Fenda
      // e a respiracao das camaras, e desliga-la e o premio dela.
      if (state.stratumSubverted) continue;
      const phase = (vent.x * 7 + vent.y * 13) % 2;
      const window = Math.floor(state.tick / VENT_CYCLE_TICKS) % 2;
      if (window !== phase) continue;
    }
    if (state.tick >= vent.nextEmitAt) {
      const interval = Math.max(50, VENT_BASE_INTERVAL_TICKS * (1 - state.contamination * 0.6));
      vent.nextEmitAt = state.tick + Math.floor(interval);
      const i = vent.y * w + vent.x;
      if (state.solid[i] === SOLID_NONE && state.surface[i] === SURF_NONE) {
        setSurface(state, i, SURF_GAS, GAS_LIFE_TICKS);
      }
    }
  }

  // descargas expiram
  state.charges = state.charges.filter((c) => c.until > state.tick);

  const queue = state.reactionQueue;
  const budget = Math.min(queue.length, BUDGET_REACTING_CELLS);
  const nextQueue: number[] = [];
  const seenNext = new Set<number>();
  const pushNext = (i: number): void => {
    if (!seenNext.has(i)) {
      seenNext.add(i);
      nextQueue.push(i);
    }
  };

  for (let n = 0; n < budget; n++) {
    const i = queue[n];
    const kind = state.surface[i];
    const x = i % w;
    const y = (i - x) / w;

    if (kind === SURF_FIRE) {
      // Cada vizinho recebe a reacao do proprio material. O fungo nao vira chama
      // aqui: apenas inicia a secagem. Gas e esporos queimam com timers curtos.
      const neighbors = [i - 1, i + 1, i - w, i + w];
      const valid = [x > 0, x < w - 1, y > 0, y < h - 1];
      // Agua APAGA fogo encostado nela, antes de ele espalhar qualquer coisa.
      // E a regra que faz o Aquifero ler como anti-termico sem tabela nova: a
      // margem de um lago e uma fronteira que o fogo nao atravessa nem
      // contorna queimando. Vira cinza, nao nada — o jogador ve ONDE apagou.
      // SUBMERSO nao queima. O Diluvio nao grava superficie — o material de
      // baixo continua inteiro, e essa e a promessa dele —, mas uma chama
      // debaixo de agua e uma promessa que a materia nao sustenta.
      //
      // Aqui, na fila de reacao, e nao numa varredura da area alagada: fogo ja
      // e uma superficie reativa e ja passa por este laco, entao a regra custa
      // uma comparacao por celula que ja ia ser visitada. Varrer o alagado
      // custaria o mapa inteiro por tick, e a primeira versao fazia isso — pior,
      // fazia so na passagem da frente, o que deixava acender fogo novo debaixo
      // do lencol depois que ela passava.
      //
      // O custo para o JOGADOR e real e e o outro lado da carta do Leviata:
      // quem lutava com fogo perde o fogo no setor inteiro. Em troca ganha um
      // setor que conduz.
      let doused = isDeluged(state, i);
      for (let k = 0; k < 4 && !doused; k++) {
        if (valid[k] && state.surface[neighbors[k]] === SURF_WATER) doused = true;
      }
      if (doused) {
        state.surface[i] = SURF_SCORCHED;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
        continue;
      }
      for (let k = 0; k < 4; k++) {
        if (!valid[k]) continue;
        const ni = neighbors[k];
        const nsurf = state.surface[ni];
        if (nsurf === SURF_GAS || nsurf === SURF_SPORES) {
          igniteCell(state, ni, events);
        } else if (nsurf === SURF_FUNGAL) {
          heatFungalCell(state, ni, false);
        } else if (nsurf === SURF_BIOFLUID && state.rng.nextFloat01() < FIRE_SPREAD_BIOFLUID) {
          igniteCell(state, ni, events);
          markDiscovery(state.stats, DISCOVERY_FIRE_SPREAD);
        } else if (nsurf === SURF_ICE) {
          // Fogo derrete o gelo vizinho — e a agua que nasce disso apaga este
          // mesmo fogo no proximo passo. A troca e deliberada: derreter uma
          // ponte custa a chama que a derreteu.
          meltIce(state, ni);
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_SCORCHED;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_FUNGAL_HEATED) {
      // A umidade precisa sair antes da ignicao. O estado visual permanece
      // fungico/fumegante durante toda a contagem, em vez de surgir fogo do nada.
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        setSurface(state, i, SURF_FIRE, FUNGAL_FIRE_FUEL_TICKS);
        announceIgnite(state, i, events);
        pushNext(i);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_SPORES) {
      // Nuvem localizada: nao se multiplica como gas; apenas paira e se desfaz.
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_WATER) {
      // So agua DERRETIDA chega aqui (timer > 0): a contagem regressiva do
      // recongelamento. Expirou, vira gelo de novo — a janela fechou.
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        setSurface(state, i, SURF_ICE, 0);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    } else if (kind === SURF_GAS) {
      // difusao: gas se espalha para celulas abertas sem superficie
      if (state.rng.nextFloat01() < GAS_SPREAD_CHANCE) {
        const dir = state.rng.nextInt(4);
        const ni = [i - 1, i + 1, i - w, i + w][dir];
        const validDir = [x > 0, x < w - 1, y > 0, y < h - 1][dir];
        if (validDir && state.solid[ni] === SOLID_NONE && state.surface[ni] === SURF_NONE) {
          const t = state.surfaceTimer[i];
          if (t > 30) {
            setSurface(state, ni, SURF_GAS, Math.floor(t * 0.65));
            state.surfaceTimer[i] = Math.floor(t * 0.65);
          }
        }
      }
      const t = state.surfaceTimer[i];
      if (t <= CELL_STEP_INTERVAL) {
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
        markDirty(state, x, y);
      } else {
        state.surfaceTimer[i] = t - CELL_STEP_INTERVAL;
        pushNext(i);
      }
    }
  }

  // excedente da fila permanece (ordem preservada)
  for (let n = budget; n < queue.length; n++) pushNext(queue[n]);
  state.reactionQueue = nextQueue;
};

/** Quebra uma celula solida por dano direcionado (projetil perfurante, investida, explosao). */
export const breakSolid = (state: SurvivalState, x: number, y: number, events: SemanticEvent[]): boolean => {
  const w = W(state);
  const i = y * w + x;
  const solid = state.solid[i];
  if (solid === SOLID_FRAGILE || solid === SOLID_FRAGILE_WEAK) {
    state.solid[i] = SOLID_NONE;
    state.surface[i] = SURF_SCORCHED;
    markDirty(state, x, y);
    state.stats.solidsDestroyed += 1;
    markDiscovery(state.stats, DISCOVERY_FRAGILE_BREACH);
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    return true;
  }
  if (solid === SOLID_CRYSTAL) {
    state.solid[i] = SOLID_NONE;
    markDirty(state, x, y);
    state.stats.solidsDestroyed += 1;
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    dischargeAt(state, x, y, events);
    return true;
  }
  if (solid === SOLID_CRYSTAL_DULL) {
    // Quebra, mas sem descarga: a energia dele ja foi embora com o acido.
    state.solid[i] = SOLID_NONE;
    markDirty(state, x, y);
    state.stats.solidsDestroyed += 1;
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    return true;
  }
  return false;
};

/**
 * Arranca uma celula de parede COMUM, para virar municao do bruiser.
 *
 * Separado de `breakSolid` de proposito, e as duas diferencas sao intencionais:
 *
 * - `breakSolid` nao quebra rocha — so fragil e cristal. Arrancar a parede e
 *   exatamente o que o bruiser faz de especial, entao precisa passar por cima
 *   dessa regra sem afrouxa-la para todo o resto do jogo.
 * - MINERIO e CRISTAL ficam de fora. Minerio e recurso do jogador e cristal e
 *   luz e descarga; deixar um inimigo apagar qualquer um dos dois de graca
 *   tiraria do jogador coisas que ele foi ate ali buscar, sem que ele pudesse
 *   sequer disputar.
 *
 * A celula vira chao nu, e nao queimado: nada foi incinerado ali, foi levado.
 *
 * A BORDA do mapa tambem fica de fora, e isso apareceu num teste e nao no
 * papel: com o jogador nascendo perto da parede externa, o bruiser arrancava o
 * proprio limite do mundo. Nada quebrava — `isSolidAt` trata fora do mapa como
 * solido — mas abria um buraco na moldura da sala, que e cenario e nao arena.
 */
export const canRip = (state: SurvivalState, x: number, y: number): boolean => {
  const w = W(state);
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= state.config.height - 1) return false;
  const solid = state.solid[y * w + x];
  return solid === SOLID_ROCK || solid === SOLID_FRAGILE || solid === SOLID_FRAGILE_WEAK;
};

export const ripSolid = (state: SurvivalState, x: number, y: number, events: SemanticEvent[]): boolean => {
  const w = W(state);
  if (!canRip(state, x, y)) return false;
  const i = y * w + x;
  const solid = state.solid[i];
  state.solid[i] = SOLID_NONE;
  markDirty(state, x, y);
  events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
  return true;
};

/**
 * Lacra uma arena quadrada em volta do guardiao, com poucas saidas quebraveis.
 *
 * Existe porque perseguir nao basta. Mesmo caçando com busca de caminho, o
 * guardiao anda 2,1 contra os 4,6 do jogador: em corredor aberto da para vencer
 * a luta andando para tras e atirando, sem nunca decidir nada. A arena tira essa
 * saida — e, com ela, a luta passa a ser sobre POSICAO dentro de um espaco, que
 * e onde os invocados importam.
 *
 * O anel e ROCHA porque rocha nao cede a tiro nenhum (`impactSolid` devolve
 * `broke: false` para as quatro classes de projetil). Fosse fragil, o jogador
 * abriria a parede em qualquer ponto e a arena nao teria sentido.
 *
 * As saidas sao FRAGIL, poucas e sorteadas: existe rota de fuga, mas ela custa
 * tiros e tempo, e e nesse tempo que o guardiao e os invocados cobram. Um cerco
 * sem saida nenhuma nao seria dificuldade, seria uma sentenca — e o jogo promete
 * morte por decisao arriscada, nao por falta de opcao.
 *
 * So converte celula VAZIA: minerio, cristal e rocha ja existentes ficam como
 * estao, senao o cerco apagaria recurso e luz que o jogador foi ali buscar.
 *
 * Celula com CORPO em cima nao pode virar pedra — seria alguem emparedado. Mas
 * pular a celula deixava um vao ABERTO e permanente: o bicho saia de cima dela
 * e o cerco ficava com uma porta franca, que nem custa tiro como as saidas
 * frageis custam. O cerco e a promessa da segunda fase do guardiao, e uma porta
 * de graca a desmancha. Entao o corpo e EMPURRADO uma casa para DENTRO (onde a
 * luta e) e a parede fecha atras dele. So quando nem isso da certo — a casa de
 * dentro tambem ocupada ou solida — e que o vao sobra, porque emparedar alguem
 * e pior do que um cerco furado.
 */
export const closeArena = (
  state: SurvivalState,
  cx: number,
  cy: number,
  radius: number,
  exits: number,
  events: SemanticEvent[]
): number => {
  const w = W(state);
  const h = state.config.height;
  // Ordem fixa (jogadores, depois inimigos) porque o empurrao abaixo mexe em
  // posicao autoritativa: as duas maquinas de uma sala de co-op tem de resolver
  // a mesma celula do mesmo jeito.
  const bodies = new Map<number, Entity[]>();
  for (const e of [...state.players, ...state.enemies]) {
    if (!e.alive) continue;
    const i = Math.floor(e.y) * w + Math.floor(e.x);
    const list = bodies.get(i);
    if (list) list.push(e);
    else bodies.set(i, [e]);
  }
  // Nucleo e extracao nunca viram parede: sao os dois objetivos da run.
  const objectives = new Set<number>([
    state.corePos.y * w + state.corePos.x,
    state.entry.y * w + state.entry.x,
  ]);

  const ring: number[] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
      if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== radius) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE) continue;
      if (objectives.has(i)) continue;
      const here = bodies.get(i);
      if (here) {
        // Uma casa para DENTRO: Chebyshev cai para radius-1, ou seja, sempre no
        // lado de dentro do anel — nunca empurra alguem para fora do cerco.
        const tx = x + Math.sign(cx - x);
        const ty = y + Math.sign(cy - y);
        const target = ty * w + tx;
        // Casa de dentro OCUPADA tambem invalida o empurrao. Sem isto o corpo
        // do anel pousava nas coordenadas exatas de quem ja estava la — um
        // inimigo escondido em cima do jogador, com o dano de contato dos dois
        // no mesmo ponto. Duas celulas do anel podem ainda dividir o mesmo
        // destino (o canto (r,0) e o (r,1) apontam os dois para (r-1,0)), entao
        // quem e empurrado PASSA A CONSTAR em `bodies`: o segundo ve o primeiro.
        if (state.solid[target] !== SOLID_NONE || objectives.has(target)) continue;
        if (bodies.has(target)) continue;
        // DOIS corpos na mesma celula do anel: o vao sobra. A simulacao nao
        // aplica colisao entre entidades no movimento, entao dois bichos podem
        // dividir uma celula com coordenadas diferentes — mandar os dois para o
        // centro da casa de dentro os sobreporia PERFEITAMENTE, que e o
        // empilhamento que este trecho existe para evitar. Espalha-los em
        // subposicoes resolveria a sobreposicao e criaria outro problema (dois
        // corpos onde o cerco conta um), e um vao a mais e mais barato.
        if (here.length > 1) continue;
        here[0].x = tx + 0.5;
        here[0].y = ty + 0.5;
        bodies.delete(i);
        bodies.set(target, here);
      }
      ring.push(i);
    }
  }
  if (ring.length === 0) return 0;
  state.bossRuntime.arenaBarrierCells = [];

  // Saidas sorteadas com a RNG da simulacao, e nao com `Math.random`: as duas
  // maquinas de uma sala de co-op precisam abrir a parede nos mesmos pontos.
  const doors = new Set<number>();
  const wanted = Math.min(exits, ring.length);
  for (let k = 0; k < wanted; k++) {
    // Espalha as tentativas pelo anel: sorteio livre agrupa as saidas num canto
    // com frequencia alta, e duas saidas coladas valem por uma.
    const span = Math.floor(ring.length / wanted);
    const base = k * span;
    doors.add(ring[base + state.rng.nextInt(Math.max(1, span))]);
  }

  for (const i of ring) {
    state.solid[i] = doors.has(i) ? SOLID_FRAGILE : SOLID_ROCK;
    state.bossRuntime.arenaBarrierCells.push(i);
    markDirty(state, i % w, Math.floor(i / w));
  }
  events.push({ t: 'message', key: 'sim.arenaSealed' });
  return ring.length;
};

/** Remove somente os blocos criados pelo cerco; terreno original permanece intacto. */
export const openArena = (state: SurvivalState, events: SemanticEvent[]): number => {
  const w = W(state);
  let removed = 0;
  for (const i of state.bossRuntime.arenaBarrierCells) {
    const solid = state.solid[i];
    if (solid === SOLID_NONE) continue;
    state.solid[i] = SOLID_NONE;
    const x = i % w;
    const y = Math.floor(i / w);
    markDirty(state, x, y);
    events.push({ t: 'break', x: x + 0.5, y: y + 0.5, solid });
    removed++;
  }
  state.bossRuntime.arenaBarrierCells = [];
  state.bossRuntime.arenaClosed = false;
  if (removed > 0) events.push({ t: 'message', key: 'sim.siegeCollapsed' });
  return removed;
};
