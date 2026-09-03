// Constroi o SurvivalState de uma arena de chefe isolada, a partir das
// condicoes escolhidas na tela de setup (HP, eco/habilidade, modulos).
//
// Nao existe um segundo motor aqui: `createRun` com `sector`/`depth` ja
// reconstroi o setor inteiro do zero — trash, terreno, sitios de salvage e o
// chefe junto —, exatamente como um cliente que reconecta no meio de uma
// expedicao faz. O trabalho desta ferramenta e apontar para o (seed, setor)
// certo (ver `arena-catalog.ts`) e aplicar por cima, ANTES do primeiro tick, as
// condicoes que o testador escolheu — a mesma liberdade que `resimulateRun` do
// servidor usa para re-simular contra um tuning e uma profundidade dados.
//
// E entao RECORTAR. O setor inteiro era o que a ferramenta entregava, e era
// deliberado: a arena e o lugar real, e nao uma caixa branca. Na pratica isso
// custava exatamente o que ela prometia poupar — atravessar meio mapa ate o
// chefe, limpar fauna que nao tem nada a ver com a luta, e ver a Supernova
// acertar um stalker que apareceu por conta propria. `carveArena` deixa de pe a
// camara e as galerias que saem dela, e mais nada.
import {
  CONTAMINATION_WAVES,
  DEFAULT_PLAYER_TUNING,
  SOLID_CRYSTAL,
  SOLID_NONE,
  SOLID_FRAGILE,
  SOLID_ROCK,
  isPipe,
  PIPE_MOUTH,
  SURF_NONE,
  createRun,
  grantOrRechargeModule,
  type AbilityId,
  type ModuleId,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { ARENA_CATALOG, type ArenaBossId } from './arena-catalog';

export type ArenaConditions = {
  boss: ArenaBossId;
  maxHp: number;
  ability: AbilityId;
  modules: readonly ModuleId[];
};

/** Faixa de HP que a tela de setup oferece. Fora disso nao ha teste util: */
export const ARENA_MIN_HP = 20;
export const ARENA_MAX_HP = 500;

export const clampArenaHp = (hp: number): number =>
  Math.round(
    Math.max(
      ARENA_MIN_HP,
      Math.min(ARENA_MAX_HP, Number.isFinite(hp) ? hp : DEFAULT_PLAYER_TUNING.maxHp),
    ),
  );

/**
 * O RAIO DA ARENA, em passos de caminhada a partir do chefe.
 *
 * Passos e nao tiles: a medida atravessa os vaos, entao o que sobra e o espaco
 * REALMENTE alcancavel em volta dele — a camara e as galerias que saem dela —,
 * e nao um quadrado carimbado por cima da rocha.
 *
 * Trinta, e o numero saiu de uma medicao. Com 22 a regra "cobre a maior ameaca
 * do elenco" era so uma frase: numa gramatica de canyon ou de warren a busca
 * satura no primeiro bolsao e devolve muito menos que o raio promete — a arena
 * do Coracao ficava com 153 celulas numa caixa de 16x19, e a varredura DELE
 * alcanca 15. O chefe cobria a arena inteira, e "esquivar" virava "nao ter para
 * onde ir".
 *
 * Trinta da folga para o golpe mais longo do elenco (a broca do Diamandis, 20)
 * caber com espaco para recuar depois dele.
 */
export const ARENA_KEEP_RADIUS = 30;
/**
 * A que distancia do chefe o testador comeca.
 *
 * Nove passos: dentro do aggro de todo mundo (o menor da lista e 10) e fora do
 * corpo a corpo. A luta comeca porque o testador esta la, e nao depois de uma
 * caminhada procurando o chefe — que e o tempo que esta ferramenta existe para
 * economizar.
 */
const ARENA_PLAYER_GAP = 9;
/**
 * Quantas vezes a arena e ALARGADA antes do recorte.
 *
 * Extensao e largura sao dois problemas diferentes, e so o primeiro se resolve
 * com raio. Medida a arena do Diamandis, 13% das celulas de chao tinham dois
 * tiles livres em cruz: nao era uma sala apertada, era um emaranhado de
 * corredores — e um chefe de 1,5 tile/s que abre galeria com a broca precisa de
 * sala, nao de labirinto.
 *
 * A passada remove os NOS de parede: pedra solta com tres ou mais vizinhos
 * abertos. Isso apaga pilar isolado e ponta de esporao — o que atrapalha
 * circulacao — e deixa de pe o maciço, que e o que da forma ao lugar.
 *
 * UMA passada, e o numero foi medido: a segunda quase nao acha nada (uma celula
 * na arena do Guardiao, nenhuma em sete das dez), porque o que sobra depois da
 * primeira ja e maciço — cada celula dele tem no maximo dois lados livres.
 * Insistir so comecaria a comer parede de verdade, e a arena e para ser a
 * camara do bioma, e nao um disco.
 */
const ARENA_WIDEN_PASSES = 1;
/**
 * O PISO da arena, em celulas de chao, e o disco que o garante.
 *
 * Alargar resolve largura e o raio resolve extensao, mas nem sempre ha o que
 * alargar: em gramatica de canyon (Fornalha) e nos sumidouros da Silica a
 * caverna simplesmente ACABA perto do chefe, e depois das duas passadas a arena
 * do Coracao ainda ficava numa caixa de 20 de largo — com uma varredura que
 * alcanca 15. O chefe cobria a arena inteira.
 *
 * Quando a caverna nao entrega, a arena escava: um disco de pedra comum some em
 * volta do chefe e a busca corre de novo. E uma REDE, e nao a forma padrao — as
 * arenas que ja nascem abertas nunca chegam aqui, e continuam com os pilares e
 * as reentrancias que o bioma pos nelas. Dezesseis de raio dao trinta e dois de
 * vao livre: a varredura do Coracao cabe com uma passada de sobra.
 */
export const ARENA_MIN_FLOOR = 420;
const ARENA_MIN_RADIUS = 16;

/** Ordem fixa de vizinhanca das duas buscas do recorte. */
const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Reduz o setor a ARENA DO CHEFE e as adjacencias seguras, sem mobs.
 *
 * A ferramenta nascia montando o setor INTEIRO — mesmo terreno, mesmo trash,
 * mesmos sitios de salvage — e isso era deliberado: a arena e o lugar real, e
 * nao uma caixa branca. Na pratica testar chefe assim custa o que a ferramenta
 * prometia poupar: atravessar meio mapa, limpar dois Espectros e um Coveiro que
 * nao tem nada a ver com a luta, e descobrir no meio do encontro que a
 * Supernova acertou um stalker que apareceu por conta propria.
 *
 * O recorte responde a isso sem inventar um segundo gerador: o mundo continua
 * sendo o que a seed produziu, e o que muda e quanto dele fica de pe.
 *
 * - Uma busca em largura A PARTIR DO CHEFE marca tudo o que se alcanca a pe
 *   dentro do raio. O resto do chao vira rocha — nao ha teleporte para o nada,
 *   nao ha corredor que leve a lugar nenhum, e a fronteira e parede de verdade.
 * - Todo inimigo que nao e o chefe sai de campo. Os que ele INVOCA continuam
 *   nascendo normalmente: a matilha do Guardiao, os Escoriaceos do Coracao, os
 *   Coveiros do Diamandis e os Espectros da Rainha sao a luta, e nao ruido.
 * - As ondas de contaminacao ficam desarmadas. Elas repovoam o setor sozinhas
 *   conforme o relogio da run sobe, e sem isto uma luta longa terminaria com
 *   stalkers nascendo no meio dela — exatamente o que o recorte tirou.
 *
 * O que NAO muda: o terreno do bioma, as reacoes de materia e o proprio chefe.
 * A arena continua sendo o Aquifero, a Fornalha ou a Catedral, com a agua, a
 * brasa e os cristais que a seed pos ali.
 */
export const carveArena = (state: SurvivalState, bossArchetype: string): void => {
  const boss = state.enemies.find((e) => e.alive && e.archetype === bossArchetype);
  if (!boss) return;
  const w = state.config.width;
  const h = state.config.height;

  const bx = Math.floor(boss.x);
  const by = Math.floor(boss.y);
  // ALARGAR antes de recortar, para o chao que abrir entrar na busca.
  //
  // So pedra comum e fragil: minerio, cristal e duto ficam. Os tres sao
  // linguagem — o cristal E a mecanica do Arquicantor, o duto E a fonte do
  // Diluvio —, e alargar a sala nao pode custar aquilo que se foi testar.
  const reach = ARENA_KEEP_RADIUS + 4;
  for (let pass = 0; pass < ARENA_WIDEN_PASSES; pass++) {
    const doomed: number[] = [];
    for (let y = Math.max(2, by - reach); y <= Math.min(h - 3, by + reach); y++) {
      for (let x = Math.max(2, bx - reach); x <= Math.min(w - 3, bx + reach); x++) {
        const i = y * w + x;
        if (state.solid[i] !== SOLID_ROCK && state.solid[i] !== SOLID_FRAGILE) continue;
        let open = 0;
        if (state.solid[i - 1] === SOLID_NONE) open++;
        if (state.solid[i + 1] === SOLID_NONE) open++;
        if (state.solid[i - w] === SOLID_NONE) open++;
        if (state.solid[i + w] === SOLID_NONE) open++;
        // Tres lados livres = no de parede: pilar solto ou ponta de esporao.
        // Com dois ou menos a celula faz parte de um maciço, e o maciço e o
        // que da forma ao lugar.
        if (open >= 3) doomed.push(i);
      }
    }
    if (doomed.length === 0) break;
    // Marcadas todas ANTES de derrubar qualquer uma: derrubar durante a
    // varredura faria uma parede inteira desabar em cascata, celula a celula,
    // porque cada queda cria o terceiro lado livre da vizinha.
    for (const i of doomed) state.solid[i] = SOLID_NONE;
  }

  const dist = new Int32Array(w * h).fill(-1);
  const start = by * w + bx;
  if (state.solid[start] !== SOLID_NONE) return;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head];
    if (dist[cell] >= ARENA_KEEP_RADIUS) continue;
    const cx = cell % w;
    const cy = (cell - cx) / w;
    for (const [dx, dy] of NEIGHBORS) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (state.solid[i] !== SOLID_NONE || dist[i] >= 0) continue;
      dist[i] = dist[cell] + 1;
      queue.push(i);
    }
  }

  // A caverna nao entregou sala: escava. Ver ARENA_MIN_FLOOR.
  let kept = 0;
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) kept++;
  if (kept < ARENA_MIN_FLOOR) {
    for (
      let y = Math.max(2, by - ARENA_MIN_RADIUS);
      y <= Math.min(h - 3, by + ARENA_MIN_RADIUS);
      y++
    ) {
      for (
        let x = Math.max(2, bx - ARENA_MIN_RADIUS);
        x <= Math.min(w - 3, bx + ARENA_MIN_RADIUS);
        x++
      ) {
        if (Math.hypot(x - bx, y - by) > ARENA_MIN_RADIUS) continue;
        const i = y * w + x;
        if (state.solid[i] === SOLID_ROCK || state.solid[i] === SOLID_FRAGILE) {
          state.solid[i] = SOLID_NONE;
        }
      }
    }
    dist.fill(-1);
    dist[start] = 0;
    queue.length = 0;
    queue.push(start);
    for (let head = 0; head < queue.length; head++) {
      const cell = queue[head];
      if (dist[cell] >= ARENA_KEEP_RADIUS) continue;
      const cx = cell % w;
      const cy = (cell - cx) / w;
      for (const [dx, dy] of NEIGHBORS) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
        const i = y * w + x;
        if (state.solid[i] !== SOLID_NONE || dist[i] >= 0) continue;
        dist[i] = dist[cell] + 1;
        queue.push(i);
      }
    }
  }

  // Fora da arena, TUDO vira rocha comum — e o "tudo" e literal.
  //
  // Nao basta fechar o vao: o macico selado herdava cristal, minerio e duto
  // intactos, e os tres se desenham diferente de pedra. Cristal ainda POR CIMA
  // emite luz no cliente, entao a rocha que ninguem vai visitar ficava salpicada
  // de clarao azul e de veios de ferrugem — cenario chamando atencao para um
  // lugar que a arena acabou de declarar inexistente.
  //
  // A excecao e o duto que faz parede com a arena, e a pergunta ali e sobre a
  // BOCA e nao sobre o corpo do cano: a busca so anda em vao, entao a distancia
  // da propria celula de um duto e sempre -1 — testar por ela apagava ate os que
  // despejam aqui dentro, e o Diluvio voltava a brotar do corpo do chefe.
  for (let i = 0; i < state.solid.length; i++) {
    if (dist[i] >= 0) continue;
    if (bossArchetype === 'archcantor' && state.solid[i] === SOLID_CRYSTAL) {
      const x = i % w;
      const y = Math.floor(i / w);
      if (Math.hypot(x + 0.5 - boss.x, y + 0.5 - boss.y) <= 10) continue;
    }
    if (isPipe(state.solid[i])) {
      const [dx, dy] = PIPE_MOUTH[state.solid[i]];
      const mouth = (Math.floor(i / w) + dy) * w + (i % w) + dx;
      if (mouth >= 0 && mouth < dist.length && dist[mouth] >= 0) continue;
    }
    if (state.solid[i] === SOLID_NONE) {
      state.surface[i] = SURF_NONE;
      state.surfaceTimer[i] = 0;
    }
    state.solid[i] = SOLID_ROCK;
  }
  for (let c = 0; c < state.chunkVersion.length; c++) state.chunkVersion[c]++;

  // Sem mobs: so o dono da sala — E O QUE E DELE.
  //
  // A ninhada do Devorador nao e fauna do setor: ela nasce com a mae, existe so
  // onde ela existe e some do mapa junto com ela. Varre-la daqui tiraria da
  // arena metade do encontro que a arena serve para testar, e a ferramenta
  // passaria a mostrar uma luta que o jogo nao tem.
  //
  // Os que ficaram FORA do recorte vao junto com o resto: a arena emparedou
  // aquilo, e um filhote do outro lado da rocha nova nao pode ser pisado nem
  // sugado — ele so ficaria empurrando a parede para sempre.
  state.enemies = state.enemies.filter(
    (e) =>
      e === boss ||
      (e.archetype === 'devourer_brood' && dist[Math.floor(e.y) * w + Math.floor(e.x)] >= 0),
  );
  // Cenario que so faria sentido no setor inteiro. Os respiradouros e os
  // trilhos que sobraram DENTRO da arena ficam: eles sao o chao do bioma, e o
  // chao do bioma e metade do que se esta testando.
  state.vents = state.vents.filter((v) => dist[v.y * w + v.x] >= 0);
  state.railTracks = state.railTracks.filter((t) => dist[t.y * w + t.x] >= 0);
  state.salvageSites = [];
  state.wellOffers = [];
  // As ondas de contaminacao ja nasceram gastas: `stepContamination` so dispara
  // a onda `w` enquanto `contaminationWaves <= w`.
  state.contaminationWaves = CONTAMINATION_WAVES.length;

  // O testador entra na arena, e nao na entrada do setor — que quase sempre
  // ficou do lado de fora da parede nova.
  let spawn = start;
  let best = Infinity;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0) continue;
    const gap = Math.abs(dist[i] - ARENA_PLAYER_GAP);
    if (gap < best) {
      best = gap;
      spawn = i;
    }
  }
  for (const player of state.players) {
    player.x = (spawn % w) + 0.5;
    player.y = Math.floor(spawn / w) + 0.5;
  }
  state.entry = { x: spawn % w, y: Math.floor(spawn / w) };
};

export const createArenaRun = (conditions: ArenaConditions): SurvivalState => {
  const entry = ARENA_CATALOG[conditions.boss];
  const tuning = { ...DEFAULT_PLAYER_TUNING, maxHp: clampArenaHp(conditions.maxHp) };
  const state = createRun({
    seed: entry.seed,
    sector: entry.sector,
    tuning,
    depth: {
      generation: entry.generation,
      sectorCount: entry.sectorCount,
      coreSectors: entry.coreSectors,
    },
  });

  // Aplicado DEPOIS de `createRun` e ANTES do primeiro `stepRun`: o mesmo
  // ponto em que um teste de chefe (`arena-chefe.test.ts`) monta a condicao
  // que quer examinar, e nao um estado que a simulacao jamais produziria
  // sozinha por progressao normal — esta ferramenta existe justamente para
  // pular a progressao.
  state.player.hp = tuning.maxHp;
  state.playerExtra.ability = conditions.ability;
  for (const moduleId of conditions.modules) {
    grantOrRechargeModule(state.playerExtra, moduleId, state.tick);
  }

  // O recorte vem por ULTIMO, e depende de o chefe ja estar em campo: quem
  // define o centro da arena e o corpo dele, e nao um ponto do mapa.
  carveArena(state, state.sectorBoss.archetype ?? conditions.boss);

  return state;
};
