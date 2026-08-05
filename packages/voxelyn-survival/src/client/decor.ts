// A camada de PROPS DECORATIVOS: o que explica onde o jogador esta, o que
// aconteceu ali e qual e a escala do Veio.
//
// A divisao de trabalho do mundo, formalizada:
//   1. A strata define a formacao da caverna (worldgen).
//   2. Materiais e superficies definem o que reage fisicamente (simulacao).
//   3. Props dao escala, historia e identidade — e NADA alem disso.
//
// Um prop nao ocupa celula autoritativa, nao bloqueia caminho, nao conduz,
// nao pode ser destruido e nao entra em solid, surface, pathfinding, hash nem
// snapshot. Ele e DERIVADO: qualquer cliente reconstroi a mesma decoracao a
// partir de (seed, setor, strata), entao o co-op ve o mesmo cenario sem o
// servidor transmitir um unico objeto cosmetico.
//
// A regra anti-mentira que rege cada arquetipo:
//   - baixo, estreito ou quebrado: nunca solido o bastante para parecer
//     bloquear o Prospector;
//   - cristal decorativo NUNCA usa a cor do cristal reativo (nada de biolum);
//   - nada de ouro de loot nem contorno de cofre: prop nao parece coletavel;
//   - nada sobre superficie reativa ou elemento (fogo, gas, agua, gelo...):
//     o chao que JOGA nunca e escondido por enfeite.
import {
  createRun,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SCORCHED,
} from '@voxelyn/survival-sim';
import type { OccupationId, StratumId, SurvivalState } from '@voxelyn/survival-sim';

/**
 * Onde um prop mora:
 * - `floor`: sobre uma celula aberta e nua;
 * - `wall_base`: na celula aberta ao PE de uma parede viva;
 * - `ceiling`: PENDURADO sobre uma celula aberta, agarrado a uma parede
 *   vizinha (o teto desce nas bordas). Desenhado alto e TRANSLUCIDO: o chao
 *   que joga continua visivel por baixo;
 * - `landmark`: COROANDO uma celula SOLIDA no centro de um salao. E o unico
 *   prop com presenca monumental, e por isso o unico ancorado em materia que
 *   de fato bloqueia — a silhueta imensa nunca mente sobre colisao, porque o
 *   pedestal e uma parede de verdade.
 */
export type PropAnchor = 'floor' | 'wall_base' | 'ceiling' | 'landmark';

export type PropKind =
  // Basalto: pesado e tectonico.
  | 'fallen_column'
  | 'rubble'
  | 'basalt_shard'
  // Catedral: angular e cristalino (decorativo: translucido, sem pulso).
  | 'crystal_fan'
  | 'crystal_shards'
  // Carste: esculpido pela agua.
  | 'stalagmite'
  | 'calcite_basin'
  | 'flow_curtain'
  // Sedimentar: laminado e arqueologico.
  | 'slab_pile'
  | 'fallen_plate'
  // Fenda: poroso e pressurizado (fumarola DECORATIVA: apagada, sem particula).
  | 'fumarole_cone'
  | 'sulfur_mound'
  // Fornalha: escoria fria.
  | 'slag_block'
  | 'cinder_pile'
  // Cripta: gelo morto.
  | 'ice_spike'
  | 'frost_stone'
  // Ferrifero: magnetita fria.
  | 'lodestone'
  | 'ore_spur'
  // Matriz Micelial (ocupacao): cresce SOBRE o tapete fungico.
  | 'mushroom'
  | 'puffball'
  // Cicatriz Aurix (ocupacao): operacao abandonada, sem brilho de interacao.
  | 'crate'
  | 'strut'
  // TETO, por estrato: o que desce da rocha sobre a cabeca do Prospector.
  | 'hanging_spur'
  | 'crystal_chandelier'
  | 'stalactite'
  | 'hanging_slab'
  | 'sulfur_drip'
  | 'soot_fang'
  | 'icicle'
  // Infraestrutura Aurix: a operacao abandonada em escala de chao...
  | 'walkway'
  | 'rail'
  // ...adaptada ao substrato: isolador ceramico (cristal), duto (gas/calor).
  | 'insulator'
  | 'duct'
  // O medidor vivo: a gaiola cujo canario morre quando a contaminacao passa
  // de CANARY_DEAD_AT — informacao, nao enfeite.
  | 'canary_cage'
  // Teto das ocupacoes.
  | 'spore_veil'
  | 'cable_hook'
  // Ruptura a Superficie: raizes que desceram pela fenda.
  | 'root_strand'
  // ...e em escala monumental: a broca que justificou tudo.
  | 'drill'
  // LANDMARKS, um por estrato: o monumento no coracao do salao.
  | 'magnet_core'
  | 'monolith'
  | 'great_prism'
  | 'stalagnate'
  | 'strata_arch'
  | 'great_fumarole'
  | 'slag_monolith'
  | 'frost_obelisk';

export type DecorativeProp = {
  kind: PropKind;
  /**
   * Celula ancora. Para `wall_base` e `ceiling`, a celula ABERTA junto a
   * parede; para `landmark`, a propria celula SOLIDA do pedestal.
   */
  x: number;
  y: number;
  /** Parede que sustenta um `wall_base`/`ceiling`; -1 para chao e landmark. */
  wallCell: number;
  variant: number;
  anchor: PropAnchor;
};

/**
 * PRNG proprio da decoracao (mulberry32). NUNCA a RNG autoritativa: consumir
 * `state.rng` aqui dessincronizaria a simulacao entre um cliente que decora e
 * um servidor que nao decora.
 */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const hashStr = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const mix32 = (a: number, b: number): number =>
  (Math.imul(a ^ Math.imul(b, 0x9e3779b9), 0x85ebca6b) ^ ((a ^ b) >>> 13)) >>> 0;

/**
 * A RUPTURA A SUPERFICIE: o evento raro em que o teto do Veio rachou ate o
 * ceu — um feixe de luz de dia desce sobre UM salao, e raizes da superficie
 * pendem pela fenda. E um EVENTO, nao um setor: ~1 em 6 setores RASOS
 * (1 e 2; mais fundo nao ha superficie por perto), derivado puramente de
 * (seed, setor) + os centros de salao que a gramatica registrou — qualquer
 * cliente ve a mesma fenda no mesmo lugar, sem um byte de rede nem de RNG
 * autoritativa. A luz e ambiente e as raizes sao decor: NADA joga diferente
 * debaixo dela (a mecanica da Ruptura e trabalho futuro com doc proprio).
 */
export const surfaceRuptureFor = (
  seed: number,
  sector: number,
  hallCenters: ReadonlyArray<{ x: number; y: number }>,
): { x: number; y: number } | null => {
  if (sector > 2 || hallCenters.length === 0) return null;
  const h = mix32(seed >>> 0, Math.imul(sector, 0x27d4eb2f) ^ 0x52e5a7);
  if (h % 6 !== 0) return null;
  return hallCenters[(h >>> 8) % hallCenters.length];
};

/**
 * A ruptura do setor de um estado VIVO, escolhida contra o mundo PRISTINO.
 *
 * `hallCenters` retem de proposito saloes que as provas de alcancabilidade
 * selaram de volta — um centro pode ser rocha solida. A fenda so pode se
 * abrir sobre um salao que EXISTE: aqui a lista e filtrada pelo terreno
 * reconstruido da seed antes da selecao. Filtrar pelo estado vivo seria
 * errado duas vezes: mineracao so ABRE celulas (nunca mudaria a escolha),
 * mas o cerco do Guardiao fecha celulas temporariamente — e a fenda que
 * muda de salao no meio da luta seria o teto mentindo.
 */
export const sectorRupture = (live: SurvivalState): { x: number; y: number } | null => {
  // Dois primeiros setores, em qualquer profundidade de run. Isto NAO e um
  // resto da era dos tres setores: a fenda chega a SUPERFICIE, e a superficie
  // nao fica mais longe porque a run tem autorizacao para descer mais. Uma
  // expedicao de sete setores tem exatamente as mesmas duas galerias rasas.
  if (live.sector > 2) return null;
  const state = createRun({
    seed: live.config.seed,
    sector: live.sector,
    width: live.config.width,
    height: live.config.height,
    playerCount: 1,
    depth: live.config.depth,
  });
  const w = state.config.width;
  const open = state.hallCenters.filter((c) => state.solid[c.y * w + c.x] === SOLID_NONE);
  return surfaceRuptureFor(state.config.seed, state.sector, open);
};

/**
 * Kit de arquetipos por strata: borda/ritmo, microprops de chao, teto e o
 * landmark monumental do salao — a hierarquia de composicao completa.
 */
const STRATA_KIT: Record<
  StratumId,
  { edge: PropKind[]; micro: PropKind[]; ceiling: PropKind[]; landmark: PropKind }
> = {
  basalt: {
    edge: ['fallen_column'],
    micro: ['rubble', 'basalt_shard'],
    ceiling: ['hanging_spur'],
    landmark: 'monolith',
  },
  prismatic: {
    edge: ['crystal_fan'],
    micro: ['crystal_shards'],
    ceiling: ['crystal_chandelier'],
    landmark: 'great_prism',
  },
  aquifer: {
    edge: ['flow_curtain', 'stalagmite'],
    micro: ['calcite_basin'],
    ceiling: ['stalactite'],
    landmark: 'stalagnate',
  },
  silica: {
    edge: ['fallen_plate'],
    micro: ['slab_pile'],
    ceiling: ['hanging_slab'],
    landmark: 'strata_arch',
  },
  sulfur: {
    edge: ['fumarole_cone'],
    micro: ['sulfur_mound'],
    ceiling: ['sulfur_drip'],
    landmark: 'great_fumarole',
  },
  furnace: {
    edge: ['slag_block'],
    micro: ['cinder_pile'],
    ceiling: ['soot_fang'],
    landmark: 'slag_monolith',
  },
  glacial: {
    edge: ['ice_spike'],
    micro: ['frost_stone'],
    ceiling: ['icicle'],
    landmark: 'frost_obelisk',
  },
  ferric: {
    edge: ['ore_spur'],
    micro: ['lodestone', 'rubble'],
    ceiling: ['hanging_spur'],
    landmark: 'magnet_core',
  },
};

const OCCUPATION_KIT: Record<
  Exclude<OccupationId, 'none'>,
  { edge: PropKind[]; micro: PropKind[]; ceiling: PropKind[] }
> = {
  mycelial: { edge: ['mushroom'], micro: ['puffball'], ceiling: ['spore_veil'] },
  aurix: { edge: ['crate', 'strut', 'canary_cage'], micro: ['walkway', 'rail'], ceiling: ['cable_hook'] },
};

/**
 * A Aurix ADAPTA a infraestrutura ao substrato — a mesma operacao deixa
 * registros diferentes conforme onde fracassou: isoladores ceramicos contra o
 * cristal condutor da Catedral, dutos na Fenda e na Fornalha (gas e
 * refrigeracao), escoras dobradas no sedimento que cede, passarelas sobre o
 * chao alagavel do Aquifero. O basalto fica com o kit base: ele E a
 * referencia da operacao. Os kinds extras entram no sorteio de borda junto
 * com caixa/escora — vies, nao substituicao.
 */
const AURIX_SUBSTRATE_EDGE: Partial<Record<StratumId, PropKind[]>> = {
  prismatic: ['insulator', 'insulator'],
  sulfur: ['duct'],
  furnace: ['duct', 'duct'],
  silica: ['strut'],
  aquifer: ['walkway'],
};

/** Orcamento por setor. Ritmo estrutura; micro da acabamento sem dominar. */
const EDGE_BUDGET = 18;
const MICRO_BUDGET = 32;
const CEILING_BUDGET = 14;
/**
 * COMPOSICAO POR SALA: alem do orcamento global, cada salao registrado pela
 * gramatica recebe um anel proprio de ritmo e micro. O salao e MOBILIADO —
 * landmark no centro, ritmo em volta, micro no acabamento — enquanto os
 * corredores continuam rarefeitos (o orcamento global de micro encolheu na
 * mesma medida). E o contraste, nao a quantidade, que faz o salao ler como
 * lugar.
 */
const HALL_RING_EDGE = 6;
const HALL_RING_MICRO = 4;
const HALL_RADIUS = 8;
const HALLS_COMPOSED = 3;
const OCCUPATION_EDGE_BUDGET = 10;
const OCCUPATION_MICRO_BUDGET = 16;
const OCCUPATION_CEILING_BUDGET = 8;
/**
 * No maximo DOIS monumentos por setor: landmark e pontuacao, nao ritmo — tres
 * "corações de salao" no mesmo mapa ja competiriam entre si pela leitura.
 */
const LANDMARK_CAP = 2;
/** Dois landmarks colados leem como um so borrado; espacamento minimo. */
const LANDMARK_MIN_GAP = 14;
/** Tentativas de sorteio por vaga; falhar e normal (zonas proibidas). */
const ATTEMPTS_PER_SLOT = 6;

/**
 * Coloca a decoracao de um setor. Determinstica e derivada: mesma seed, mesmo
 * setor, mesma strata => mesma lista, em qualquer maquina.
 *
 * As ZONAS PROIBIDAS vem primeiro e sao inegociaveis: nada de chao no raio da
 * entrada, do poco/nucleo, dos terminais e cofres, dos respiradouros nem da
 * posicao de chefe. Decoracao nunca compete com informacao.
 */
export const placeDecor = (live: SurvivalState): DecorativeProp[] => {
  // A colocacao le um mundo PRISTINO do setor, reconstruido da seed — nunca o
  // estado vivo. O estado vivo ja pode ter paredes arrancadas e fungo queimado
  // quando um cliente entra numa sala em andamento, e cada rejeicao diferente
  // na amostragem deslocaria a sequencia do PRNG: dois clientes veriam
  // cenarios diferentes da MESMA seed. Derivando do mundo de entrada do setor,
  // a lista e identica em qualquer maquina, entre a qualquer momento; o mundo
  // vivo so participa na validacao por quadro (`propStillValid`).
  const state = createRun({
    seed: live.config.seed,
    sector: live.sector,
    width: live.config.width,
    height: live.config.height,
    playerCount: 1,
  });
  const w = state.config.width;
  const h = state.config.height;
  const rng = mulberry32(
    (state.config.seed ^ Math.imul(state.sector, 0x9e3779b9) ^ hashStr(state.stratum)) >>> 0,
  );

  const forbidden: Array<{ x: number; y: number; r: number }> = [
    { x: state.entry.x, y: state.entry.y, r: 5 },
    { x: state.corePos.x, y: state.corePos.y, r: 5 },
  ];
  for (const site of state.salvageSites) {
    forbidden.push({ x: site.terminal.x, y: site.terminal.y, r: 3 });
    forbidden.push({ x: site.cache.x, y: site.cache.y, r: 3 });
  }
  for (const vent of state.vents) forbidden.push({ x: vent.x, y: vent.y, r: 2 });
  for (const enemy of state.enemies) {
    if (enemy.archetype === 'bishop' || enemy.archetype === 'guardian') {
      forbidden.push({ x: Math.floor(enemy.x), y: Math.floor(enemy.y), r: 8 });
    }
  }
  const allowed = (x: number, y: number): boolean =>
    forbidden.every((f) => (f.x - x) ** 2 + (f.y - y) ** 2 > f.r * f.r);

  const solid = state.solid;
  const surface = state.surface;
  const idx = (x: number, y: number): number => y * w + x;
  const isOpen = (x: number, y: number): boolean =>
    x > 0 && y > 0 && x < w - 1 && y < h - 1 && solid[idx(x, y)] === SOLID_NONE;
  /** Chao ELEGIVEL: aberto e sem materia que jogue (nada de esconder o jogo). */
  const bareFloor = (x: number, y: number): boolean =>
    isOpen(x, y) && (surface[idx(x, y)] === SURF_NONE || surface[idx(x, y)] === SURF_SCORCHED);

  const taken = new Set<number>();
  const props: DecorativeProp[] = [];
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];

  /** Sorteio global: qualquer celula da moldura para dentro. */
  const anywhere = (): { x: number; y: number } => ({
    x: 1 + Math.floor(rng() * (w - 2)),
    y: 1 + Math.floor(rng() * (h - 2)),
  });
  /** Sorteio no ANEL de um salao: a composicao da sala, nao do setor. */
  const nearHall = (c: { x: number; y: number }) => (): { x: number; y: number } => ({
    x: Math.max(1, Math.min(w - 2, c.x + Math.floor((rng() * 2 - 1) * HALL_RADIUS))),
    y: Math.max(1, Math.min(h - 2, c.y + Math.floor((rng() * 2 - 1) * HALL_RADIUS))),
  });

  const tryPlace = (
    kinds: readonly PropKind[],
    anchor: 'floor' | 'wall_base' | 'ceiling',
    floorTest: (x: number, y: number) => boolean,
    sample: () => { x: number; y: number } = anywhere,
  ): void => {
    const wantsWall = anchor !== 'floor';
    for (let attempt = 0; attempt < ATTEMPTS_PER_SLOT; attempt++) {
      const { x, y } = sample();
      if (!floorTest(x, y) || !allowed(x, y) || taken.has(idx(x, y))) continue;

      let wallCell = -1;
      if (wantsWall) {
        // Borda e teto moram junto a uma parede: o prop de borda no PE dela, o
        // de teto PENDURADO onde a rocha desce — nunca no centro do corredor.
        const walls: number[] = [];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (!isOpen(x + dx, y + dy) && x + dx > 0 && y + dy > 0 && x + dx < w - 1 && y + dy < h - 1) {
            walls.push(idx(x + dx, y + dy));
          }
        }
        if (walls.length === 0) continue;
        wallCell = walls[Math.floor(rng() * walls.length) % walls.length];
      }

      taken.add(idx(x, y));
      props.push({
        kind: pick(kinds),
        x,
        y,
        wallCell,
        variant: Math.floor(rng() * 1024),
        anchor,
      });
      return;
    }
  };

  const kit = STRATA_KIT[state.stratum];

  // LANDMARKS primeiro: a hierarquia de composicao comeca no monumento e o
  // resto se organiza em volta. A ancora vem dos centros de salao que a
  // gramatica registrou — o pedestal e a primeira celula SOLIDA visivel (com
  // vizinho aberto) num anel curto em volta do centro. Um salao selado pelas
  // provas de alcancabilidade nao tem celula visivel e e pulado sem drama.
  const landmarks: Array<{ x: number; y: number }> = [];
  const placeLandmarkAt = (c: { x: number; y: number }, kind: PropKind): boolean => {
    for (let r = 0; r <= 3; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) continue;
          // Pedestal so de rocha COMUM: fragil, minerio e cristal sao
          // linguagem mecanica (o que cede, rende, conduz — e seus estagios
          // lascado/opaco), e um monumento opaco em cima deles esconderia
          // exatamente a informacao que precisa ficar visivel.
          if (solid[idx(x, y)] !== SOLID_ROCK) continue;
          const visible = isOpen(x - 1, y) || isOpen(x + 1, y) || isOpen(x, y - 1) || isOpen(x, y + 1);
          if (!visible || !allowed(x, y) || taken.has(idx(x, y))) continue;
          taken.add(idx(x, y));
          props.push({
            kind,
            x,
            y,
            wallCell: -1,
            variant: Math.floor(rng() * 1024),
            anchor: 'landmark',
          });
          landmarks.push({ x, y });
          return true;
        }
      }
    }
    return false;
  };
  for (const c of state.hallCenters) {
    if (landmarks.length >= LANDMARK_CAP) break;
    if (landmarks.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < LANDMARK_MIN_GAP)) continue;
    placeLandmarkAt(c, kit.landmark);
  }
  // A broca da Cicatriz Aurix: o monumento da OCUPACAO, num salao que os
  // monumentos do estrato deixaram livre — "o buraco que justificou a
  // operacao". Uma so por setor: e a origem da cicatriz, nao mobiliario.
  if (state.occupation === 'aurix') {
    for (const c of state.hallCenters) {
      if (landmarks.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < LANDMARK_MIN_GAP)) continue;
      if (placeLandmarkAt(c, 'drill')) break;
    }
  }

  // O anel dos saloes vem antes do orcamento global: a sala escolhe primeiro,
  // o setor preenche o resto — landmark, depois ritmo, depois micro.
  for (const c of state.hallCenters.slice(0, HALLS_COMPOSED)) {
    const sampler = nearHall(c);
    for (let n = 0; n < HALL_RING_EDGE; n++) tryPlace(kit.edge, 'wall_base', bareFloor, sampler);
    for (let n = 0; n < HALL_RING_MICRO; n++) tryPlace(kit.micro, 'floor', bareFloor, sampler);
  }

  // As raizes da RUPTURA: so no setor raro em que o teto rachou, penduradas
  // em volta da fenda — a superficie entrando pelo buraco que a luz mostra.
  // A selecao filtra saloes SELADOS pelas provas de alcancabilidade (mesma
  // regra de `sectorRupture`): a fenda so se abre sobre um salao que existe.
  const rupture = surfaceRuptureFor(
    state.config.seed,
    state.sector,
    state.hallCenters.filter((c) => solid[idx(c.x, c.y)] === SOLID_NONE),
  );
  if (rupture) {
    const sampler = nearHall(rupture);
    for (let n = 0; n < 7; n++) tryPlace(['root_strand'], 'ceiling', isOpen, sampler);
  }

  for (let n = 0; n < EDGE_BUDGET; n++) tryPlace(kit.edge, 'wall_base', bareFloor);
  for (let n = 0; n < MICRO_BUDGET; n++) tryPlace(kit.micro, 'floor', bareFloor);
  // Teto pendura sobre qualquer celula aberta (a superficie do chao nao
  // importa: o prop e alto e translucido, o que joga continua visivel).
  for (let n = 0; n < CEILING_BUDGET; n++) tryPlace(kit.ceiling, 'ceiling', isOpen);

  if (state.occupation !== 'none') {
    const occKit = OCCUPATION_KIT[state.occupation];
    // O micelio cresce SOBRE o proprio tapete: cogumelo em chao nu seria a
    // colonia mentindo sobre onde ela esta. A Aurix fica no chao firme.
    const occFloor =
      state.occupation === 'mycelial'
        ? (x: number, y: number): boolean => isOpen(x, y) && surface[idx(x, y)] === SURF_FUNGAL
        : bareFloor;
    const occEdge =
      state.occupation === 'aurix'
        ? [...occKit.edge, ...(AURIX_SUBSTRATE_EDGE[state.stratum] ?? [])]
        : occKit.edge;
    for (let n = 0; n < OCCUPATION_EDGE_BUDGET; n++) tryPlace(occEdge, 'wall_base', occFloor);
    for (let n = 0; n < OCCUPATION_MICRO_BUDGET; n++) tryPlace(occKit.micro, 'floor', occFloor);
    // O veu de esporos so pende sobre o tapete da colonia — teto e chao
    // contam a mesma historia. O gancho Aurix pende sobre o chao firme.
    for (let n = 0; n < OCCUPATION_CEILING_BUDGET; n++) tryPlace(occKit.ceiling, 'ceiling', occFloor);
  }

  return props;
};

/**
 * Um prop continua valido AGORA? O mundo muda por baixo da decoracao — parede
 * arrancada pelo Bruiser, fogo passando pela celula — e um prop que ficasse
 * flutuando sobre o buraco (ou escondendo a chama) viraria mentira. Checar na
 * hora do desenho custa duas leituras de array por prop visivel.
 */
export const propStillValid = (state: SurvivalState, prop: DecorativeProp): boolean => {
  const w = state.config.width;
  const i = prop.y * w + prop.x;
  // Landmark: o monumento vive ENQUANTO o pedestal solido viver. Minerar a
  // celula derruba o salao inteiro de simbolo — o prop some com ela.
  if (prop.anchor === 'landmark') return state.solid[i] !== SOLID_NONE;
  if (state.solid[i] !== SOLID_NONE) return false;
  // Teto: nao toca o chao, entao a superficie embaixo e livre para jogar —
  // mas a parede de onde a formacao pende precisa continuar de pe.
  if (prop.anchor === 'ceiling') return state.solid[prop.wallCell] !== SOLID_NONE;
  const surf = state.surface[i];
  if (!(surf === SURF_NONE || surf === SURF_SCORCHED || surf === SURF_FUNGAL)) return false;
  if (prop.anchor === 'wall_base' && prop.kind !== 'crate' && prop.kind !== 'strut') {
    // Formacao mineral de borda sem a parede que a formou nao existe. Os
    // restos Aurix sobrevivem a parede: caixa continua caixa no meio do chao.
    if (state.solid[prop.wallCell] === SOLID_NONE) return false;
  }
  return true;
};
