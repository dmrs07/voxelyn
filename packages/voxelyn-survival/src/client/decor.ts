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
  SURF_FUNGAL,
  SURF_NONE,
  SURF_SCORCHED,
} from '@voxelyn/survival-sim';
import type { OccupationId, StratumId, SurvivalState } from '@voxelyn/survival-sim';

export type PropAnchor = 'floor' | 'wall_base';

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
  // Matriz Micelial (ocupacao): cresce SOBRE o tapete fungico.
  | 'mushroom'
  | 'puffball'
  // Cicatriz Aurix (ocupacao): operacao abandonada, sem brilho de interacao.
  | 'crate'
  | 'strut';

export type DecorativeProp = {
  kind: PropKind;
  /** Celula ancora. Para `wall_base`, a celula ABERTA ao pe da parede. */
  x: number;
  y: number;
  /** Celula da parede que sustenta um `wall_base`; -1 para props de chao. */
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

/** Kit de arquetipos por strata: [props de borda/ritmo, microprops de chao]. */
const STRATA_KIT: Record<StratumId, { edge: PropKind[]; micro: PropKind[] }> = {
  basalt: { edge: ['fallen_column'], micro: ['rubble', 'basalt_shard'] },
  prismatic: { edge: ['crystal_fan'], micro: ['crystal_shards'] },
  aquifer: { edge: ['flow_curtain', 'stalagmite'], micro: ['calcite_basin'] },
  silica: { edge: ['fallen_plate'], micro: ['slab_pile'] },
  sulfur: { edge: ['fumarole_cone'], micro: ['sulfur_mound'] },
  furnace: { edge: ['slag_block'], micro: ['cinder_pile'] },
  glacial: { edge: ['ice_spike'], micro: ['frost_stone'] },
};

const OCCUPATION_KIT: Record<Exclude<OccupationId, 'none'>, { edge: PropKind[]; micro: PropKind[] }> = {
  mycelial: { edge: ['mushroom'], micro: ['puffball'] },
  aurix: { edge: ['crate', 'strut'], micro: [] },
};

/** Orcamento por setor. Ritmo estrutura; micro da acabamento sem dominar. */
const EDGE_BUDGET = 18;
const MICRO_BUDGET = 40;
const OCCUPATION_EDGE_BUDGET = 10;
const OCCUPATION_MICRO_BUDGET = 16;
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

  const tryPlace = (
    kinds: readonly PropKind[],
    wantsWall: boolean,
    floorTest: (x: number, y: number) => boolean,
  ): void => {
    for (let attempt = 0; attempt < ATTEMPTS_PER_SLOT; attempt++) {
      const x = 1 + Math.floor(rng() * (w - 2));
      const y = 1 + Math.floor(rng() * (h - 2));
      if (!floorTest(x, y) || !allowed(x, y) || taken.has(idx(x, y))) continue;

      let wallCell = -1;
      if (wantsWall) {
        // Prop de borda mora ao PE de uma parede: quebra o aspecto quadrado da
        // grade sem nunca pisar no centro de um corredor.
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
        anchor: wantsWall ? 'wall_base' : 'floor',
      });
      return;
    }
  };

  const kit = STRATA_KIT[state.stratum];
  for (let n = 0; n < EDGE_BUDGET; n++) tryPlace(kit.edge, true, bareFloor);
  for (let n = 0; n < MICRO_BUDGET; n++) tryPlace(kit.micro, false, bareFloor);

  if (state.occupation !== 'none') {
    const occKit = OCCUPATION_KIT[state.occupation];
    // O micelio cresce SOBRE o proprio tapete: cogumelo em chao nu seria a
    // colonia mentindo sobre onde ela esta. A Aurix fica no chao firme.
    const occFloor =
      state.occupation === 'mycelial'
        ? (x: number, y: number): boolean => isOpen(x, y) && surface[idx(x, y)] === SURF_FUNGAL
        : bareFloor;
    for (let n = 0; n < OCCUPATION_EDGE_BUDGET; n++) tryPlace(occKit.edge, true, occFloor);
    for (let n = 0; n < OCCUPATION_MICRO_BUDGET; n++) tryPlace(occKit.micro, false, occFloor);
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
  if (state.solid[i] !== SOLID_NONE) return false;
  const surf = state.surface[i];
  if (!(surf === SURF_NONE || surf === SURF_SCORCHED || surf === SURF_FUNGAL)) return false;
  if (prop.anchor === 'wall_base' && prop.kind !== 'crate' && prop.kind !== 'strut') {
    // Formacao mineral de borda sem a parede que a formou nao existe. Os
    // restos Aurix sobrevivem a parede: caixa continua caixa no meio do chao.
    if (state.solid[prop.wallCell] === SOLID_NONE) return false;
  }
  return true;
};
