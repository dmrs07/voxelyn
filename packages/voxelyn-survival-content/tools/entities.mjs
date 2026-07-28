import { box, collapse, renderVoxels } from './voxel.mjs';
import {
  facetEllipse,
  fillDiamond,
  fillEllipse,
  fillRect,
  grid,
  line,
  outlineWith,
  set,
  thickLine,
} from './lib.mjs';

export const ANIM_ORDER = ['idle', 'walk', 'attack', 'special', 'hit', 'downed', 'revive', 'die', 'fly', 'burst'];
const DIRS = ['dr', 'dl', 'ur', 'ul'];
const dirInfo = (dir) => ({
  front: dir === 'dr' || dir === 'dl',
  side: dir === 'dr' || dir === 'ur' ? 1 : -1,
  back: dir === 'ur' || dir === 'ul',
});
const bob6 = [0, -1, -1, 0, 0, -1];
const walkPhase = [0, 1, 2, 0, 2, 1];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const limb = (g, x0, y0, x1, y1, name = 'rockShadow', width = 1) => {
  thickLine(g, x0, y0, x1, y1, width, name);
  set(g, x1, y1, 'rockLight');
};

const scatter = (g, cx, cy, phase, names, spreadX, spreadY) => {
  const offsets = [[-5, 0], [-3, -3], [0, 1], [3, -2], [5, 1], [-1, -5], [2, 4], [-5, 4]];
  const count = clamp(2 + phase * 2, 2, offsets.length);
  for (let i = 0; i < count; i++) {
    const [ox, oy] = offsets[i];
    const x = cx + Math.round((ox * spreadX * phase) / 4);
    const y = cy + Math.round((oy * spreadY * phase) / 4);
    fillRect(g, x, y, i % 3 === 0 ? 2 : 1, i % 2 === 0 ? 2 : 1, names[i % names.length]);
  }
};

// ---------------------------------------------------------------------------
// player-prospector 32x40 — MODELO VOXEL
//
// Este e o primeiro personagem migrado do desenho 2D para o rasterizador voxel.
// As quatro direcoes sao rotacoes do mesmo modelo, entao nao podem divergir
// entre si como acontecia quando cada uma era redesenhada a mao.
// ---------------------------------------------------------------------------
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

/**
 * Progresso da morte, de 0 (corpo ainda inteiro, no frame do golpe) a 1 (so
 * destrocos). `living.die` tem 5 frames; o primeiro fica intacto de proposito
 * para o jogador ver QUAL pose morreu antes de o corpo se desfazer.
 */
const DIE_FRAMES = 5;
const dieT = (f) => Math.min(1, Math.max(0, f) / (DIE_FRAMES - 1));

/** Prospector de pe. `y0` desloca o corpo (bob, recuo de dano). */
const prospectorStanding = ({ bob = 0, st = 0, sw = 0, lean = 0, crouch = 0 } = {}) => {
  const b = [];
  // `crouch` encurta as pernas E baixa todo o resto na mesma medida: sem isso
  // o tronco descola das pernas nos frames de queda e de revive.
  const c = Math.max(0, Math.min(3, crouch));
  const legH = Math.max(1, 3 - c);
  const up = bob - c;
  // botas + pernas
  b.push(box(-2, -1, Math.max(0, st), 2, 2, 1, 'rust'));
  b.push(box(1, -1, Math.max(0, -st), 2, 2, 1, 'rust'));
  b.push(box(-2, -1, 1 + Math.max(0, st), 2, 2, legH, 'rockDeep'));
  b.push(box(1, -1, 1 + Math.max(0, -st), 2, 2, legH, 'rockDeep'));
  // cinto
  b.push(box(-2, -1 + lean, 5 + up, 5, 2, 1, 'loot'));
  // torso: peitoral na frente, modulo fungico nas costas
  b.push(box(-2, -1 + lean, 6 + up, 5, 2, 4, 'rock'));
  b.push(box(-2, -2 + lean, 6 + up, 5, 1, 4, 'rust'));
  b.push(box(-1, 1 + lean, 7 + up, 3, 1, 3, 'fungus'));
  b.push(box(-1, 2 + lean, 8 + up, 3, 1, 1, 'biolum'));
  // ombreiras
  b.push(box(-3, -1 + lean, 9 + up, 1, 2, 1, 'rock'));
  b.push(box(3, -1 + lean, 9 + up, 1, 2, 1, 'rock'));
  // capacete assentado nos ombros + visor + lanterna
  b.push(box(-1, -1 + lean * 2, 10 + up, 3, 3, 2, 'bone'));
  b.push(box(-1, -2 + lean * 2, 10 + up, 3, 1, 1, 'biolum'));
  b.push(box(0, -2 + lean * 2, 11 + up, 1, 1, 1, 'loot'));
  // bracos + picareta
  b.push(box(-3, -1 + lean, 6 + up, 1, 2, 3, 'rock'));
  b.push(box(3, -1 + lean, 6 + up + sw, 1, 2, 3, 'rock'));
  b.push(box(3, -2 + lean, 4 + up + sw * 3, 1, 1, 3, 'loot'));
  return b;
};

/**
 * Prospector CAIDO, de costas no chao. Silhueta horizontal — em co-op este e
 * o estado que o parceiro precisa reconhecer de longe para vir reanimar, entao
 * ele nao pode parecer so uma versao baixinha da pose em pe.
 * O modulo fungico e o visor ficam virados para cima, funcionando como farol.
 */
const prospectorProne = ({ breath = 0, settle = 0 } = {}) => {
  // +1: deitado, a diagonal do corpo alcanca mais para a frente que os pes da
  // pose em pe e furava a base do frame. Um voxel acima alinha as duas bases.
  const z = settle + 1;
  const b = [];
  // O corpo fica ENCOLHIDO e centrado no MESMO eixo da pose em pe. Na projecao
  // isometrica largura e profundidade somam na mesma diagonal, entao bracos
  // abertos e pernas estendidas jogavam o sprite para fora do frame de 32px, e
  // um corpo autorado mais a frente empurrava a UNIAO das poses para fora
  // mesmo com cada pose cabendo sozinha. Recolhido tambem le melhor: alguem
  // incapacitado, nao um cadaver largado.
  // capacete no chao, visor para cima
  b.push(box(-1, -4, z, 3, 2, 2, 'bone'));
  b.push(box(-1, -4, z + 2, 3, 2, 1, 'biolum'));
  // torso deitado, peitoral virado para cima
  b.push(box(-2, -2, z, 5, 3, 2, 'rock'));
  b.push(box(-2, -2, z + 2, 5, 3, 1, 'rust'));
  // modulo fungico brilhando para cima: farol de revive
  b.push(box(-1, -1, z + 3 + breath, 3, 1, 1, 'biolum'));
  // joelhos dobrados contra o tronco
  b.push(box(-2, 1, z, 2, 2, 2, 'rockDeep'));
  b.push(box(1, 1, z, 2, 2, 2, 'rockDeep'));
  // bracos junto ao corpo
  b.push(box(-3, -2, z, 1, 2, 1, 'rock'));
  b.push(box(3, -2, z, 1, 2, 1, 'rock'));
  // picareta caida ao lado
  b.push(box(3, 1, z, 1, 2, 1, 'loot'));
  return b;
};

/** Modelo 3D do prospector para uma animacao/frame. */
const prospectorModel = (anim, f) => {
  if (anim === 'idle') return prospectorStanding({ bob: [0, 0, 1, 0][f % 4] });
  if (anim === 'walk') return prospectorStanding({ st: [0, 1, 2, 1, 0, -1][f % 6] });
  if (anim === 'attack') return prospectorStanding({ sw: [0, 0, 1, 2][f % 4] });
  // dano: recuo real do tronco e da cabeca, nao um pixel de bob
  if (anim === 'hit') return prospectorStanding({ lean: [1, 0][f % 2], bob: [1, 0][f % 2] });
  // queda: dois frames tombando, depois o corpo ja no chao assentando
  if (anim === 'die') {
    if (f === 0) return prospectorStanding({ lean: 1, crouch: 1 });
    if (f === 1) return prospectorStanding({ lean: 2, crouch: 3 });
    return prospectorProne({ settle: Math.max(0, 4 - f) });
  }
  // abatido: respira devagar, com o farol pulsando
  if (anim === 'downed') return prospectorProne({ breath: [0, 0, 1, 0][f % 4] });
  // revive: espelha a queda — sobe do chao ate ficar de pe
  if (anim === 'revive') {
    if (f <= 2) return prospectorProne({ settle: f });
    if (f === 3) return prospectorStanding({ lean: 2, crouch: 3 });
    if (f === 4) return prospectorStanding({ lean: 1, crouch: 1 });
    return prospectorStanding({});
  }
  return prospectorStanding({});
};

const prospectorFrame = (dir, anim, f) =>
  renderVoxels(prospectorModel(anim, f), DIR_INDEX[dir], 32, 40, 14, 34);

// ---------------------------------------------------------------------------
// enemy-stalker 32x32 — predador baixo e comprido, quitina, lamina mineral
// ---------------------------------------------------------------------------
const stalkerModel = (anim, f) => {
  const gait = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const lunge = anim === 'attack' ? [0, -1, 1, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // quatro patas finas, alternando aos pares
  b.push(box(-3, -2, Math.max(0, gait), 1, 1, 3, 'blood'));
  b.push(box(2, 1, Math.max(0, gait), 1, 1, 3, 'blood'));
  b.push(box(-3, 1, Math.max(0, -gait), 1, 1, 3, 'blood'));
  b.push(box(2, -2, Math.max(0, -gait), 1, 1, 3, 'blood'));
  // corpo baixo e comprido: silhueta horizontal, oposta a do prospector
  b.push(box(-2, -2, 3, 4, 4, 2, 'blood'));
  b.push(box(-2, -2, 5, 4, 3, 1, 'rust'));
  // cabeca projetada a frente
  b.push(box(-1, -3 - lunge, 3 + flinch, 2, 1, 2, 'blood'));
  b.push(box(-1, -4 - lunge, 4 + flinch, 2, 1, 1, 'biolum'));
  // lamina mineral em UM lado so: assimetria e a marca da especie
  b.push(box(3, -1 - lunge, 4, 1, 1, 2, 'bone'));
  b.push(box(3, -2 - lunge, 5, 1, 1, 1, 'bone'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const stalkerFrame = (dir, anim, f) => renderVoxels(stalkerModel(anim, f), DIR_INDEX[dir], 32, 32, 14, 27);

// ---------------------------------------------------------------------------
// enemy-spitter 32x32 — anfibio fungico bojudo, garganta acida, olhos em haste
// ---------------------------------------------------------------------------
const spitterModel = (anim, f) => {
  const hop = anim === 'walk' ? [0, 1, 2, 1, 0, 0][f % 6] : 0;
  const spit = anim === 'attack' ? [0, 1, 2, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const z = hop - flinch;
  const b = [];
  // patas dobradas e ABERTAS para fora: leitura de anfibio agachado, e o corpo
  // fica erguido do chao em vez de virar um bloco apoiado
  b.push(box(-4, -2, 0, 1, 2, 2, 'fungusDeep'));
  b.push(box(3, -2, 0, 1, 2, 2, 'fungusDeep'));
  b.push(box(-4, 1, 0, 1, 2, 2, 'fungusDeep'));
  b.push(box(3, 1, 0, 1, 2, 2, 'fungusDeep'));
  b.push(box(-3, -2, 2 + z, 1, 5, 1, 'fungusDeep'));
  b.push(box(3, -2, 2 + z, 1, 5, 1, 'fungusDeep'));
  // corpo achatado e largo, suspenso entre as patas
  b.push(box(-3, -2, 3 + z, 7, 5, 2, 'fungus'));
  // garganta acida: incha para a FRENTE antes do disparo (telegraph)
  b.push(box(-1, -3 - spit, 3 + z, 3, 1 + spit, 2, 'acid'));
  // olhos bulbosos em haste, acima da linha das costas
  b.push(box(-2, -1, 5 + z, 1, 1, 1, 'fungus'));
  b.push(box(2, -1, 5 + z, 1, 1, 1, 'fungus'));
  b.push(box(-2, -1, 6 + z, 1, 1, 1, 'biolum'));
  b.push(box(2, -1, 6 + z, 1, 1, 1, 'biolum'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const spitterFrame = (dir, anim, f) => renderVoxels(spitterModel(anim, f), DIR_INDEX[dir], 32, 32, 14, 27);

// ---------------------------------------------------------------------------
// enemy-spore-bomber 32x32 — encapuzado, olho unico, pod que incha antes de estourar
// ---------------------------------------------------------------------------
const bomberModel = (anim, f) => {
  const drift = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` e o telegraph da explosao: o pod incha frame a frame
  const swell = anim === 'special' ? Math.min(2, f) : anim === 'attack' ? [0, 1, 1, 0][f % 4] : 0;
  const z = -flinch + drift;
  const b = [];
  // pes curtos: a criatura pende, nao caminha
  b.push(box(-2, -1, 0, 2, 2, 1, 'fungusDeep'));
  b.push(box(1, -1, 0, 2, 2, 1, 'fungusDeep'));
  // capuz CONICO alto: silhueta pontuda, oposta ao spitter achatado
  b.push(box(-3, -2, 1 + z, 7, 4, 2, 'fungusDeep'));
  b.push(box(-2, -2, 3 + z, 5, 4, 2, 'fungusDeep'));
  b.push(box(-1, -1, 5 + z, 3, 3, 2, 'fungusDeep'));
  b.push(box(0, -1, 7 + z, 1, 2, 1, 'fungusDeep'));
  // olho unico fundo na sombra do capuz
  b.push(box(0, -3, 4 + z, 1, 1, 2, 'biolum'));
  // pod de esporos: massa grande atras, cresce ate estourar
  b.push(box(-3, 2, 2 + z, 5 + swell, 2, 4 + swell, 'acid'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bomberFrame = (dir, anim, f) => renderVoxels(bomberModel(anim, f), DIR_INDEX[dir], 32, 32, 14, 27);

// ---------------------------------------------------------------------------
// enemy-bruiser 48x56 — geodo de ombros largos, placas palidas, nucleo eletrico
// ---------------------------------------------------------------------------
const bruiserModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  const slam = anim === 'attack' ? [0, 0, 3, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` e o arremesso-gorila: agacha, ergue o bloco acima da cabeca,
  // segura dois frames para leitura e termina sem a pedra no follow-through.
  const hurlLift = anim === 'special' ? [0, 3, 6, 9, 12, 12, 12, 7][f % 8] : 0;
  const hurlHold = anim === 'special' && f >= 2 && f <= 6;
  const hurlThrow = anim === 'special' && f >= 7;
  const crouch = anim === 'special' ? [2, 2, 1, 0, 0, 0, 0, 1][f % 8] : 0;
  const up = -flinch - crouch;
  const b = [];
  // pernas grossas e curtas
  b.push(box(-3, -1, Math.max(0, step), 3, 3, 4, 'rockDeep'));
  b.push(box(1, -1, Math.max(0, -step), 3, 3, 4, 'rockDeep'));
  // torso trapezoidal que alarga para cima
  b.push(box(-3, -2, 4 + up, 6, 4, 4, 'rockDeep'));
  b.push(box(-4, -2, 8 + up, 8, 4, 4, 'rock'));
  // placas palidas nos ombros: a leitura de "geodo"
  b.push(box(-5, -2, 10 + up, 2, 4, 3, 'bone'));
  b.push(box(4, -2, 10 + up, 2, 4, 3, 'bone'));
  // nucleo eletrico exposto no peito
  b.push(box(-1, -3, 9 + up, 3, 1, 3, 'electric'));
  // cabeca pequena e afundada entre os ombros
  b.push(box(-1, -1, 12 + up, 3, 2, 2, 'rockDeep'));
  b.push(box(-1, -2, 13 + up, 3, 1, 1, 'biolum'));
  // bracos longos de gorila. No special, sobem juntos sustentando a pedra.
  const armRaise = anim === 'special' ? Math.min(10, hurlLift) : slam;
  b.push(box(-6, -1, 6 + up + armRaise, 2, 2, 5, 'rock'));
  b.push(box(5, -1, 6 + up + armRaise, 2, 2, 5, 'rock'));
  if (anim === 'special' && !hurlThrow) {
    const rockZ = 5 + hurlLift;
    // O volume converge com um bloco real do terreno, sem ocupar o frame inteiro.
    b.push(box(-3, -2, rockZ, 7, 5, 4, hurlHold ? 'rock' : 'rockDeep'));
    b.push(box(-2, -3, rockZ + 2, 5, 1, 2, 'rock'));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bruiserFrame = (dir, anim, f) => renderVoxels(bruiserModel(anim, f), DIR_INDEX[dir], 48, 68, 22, 62);

// ---------------------------------------------------------------------------
// enemy-guardian 48x56 — titan mineral, antebracos enormes, mascara, nucleo
// ---------------------------------------------------------------------------
const guardianModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  const swing = anim === 'attack' ? [0, 1, 3, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` = invocacao: o nucleo se abre e o corpo se ergue
  const call = anim === 'special' ? [0, 1, 1, 1][f % 4] : 0;
  const up = -flinch + call;
  const b = [];
  // O bruiser e largo e agachado; o guardian tem de ser COLUNAR e alto, senao
  // vira so uma escala do bruiser — o que a spec proibe explicitamente.
  //
  // A primeira versao errava por CONTRASTE, nao por proporcao: antebracos e
  // mascara eram ambos 'bone', encostados no tronco, e as tres pecas fundiam
  // numa laje unica. Agora o corpo e escuro, os bracos sao de tom medio e so as
  // placas de ombro e a mascara sao palidas — e ha um vao real entre braco e
  // tronco, para a silhueta ter buracos por onde o fundo aparece.
  b.push(box(-2, -1, Math.max(0, step), 2, 3, 7, 'rockDeep'));
  b.push(box(1, -1, Math.max(0, -step), 2, 3, 7, 'rockDeep'));
  // torso estreito e alto
  b.push(box(-2, -2, 7 + up, 5, 4, 7, 'rockDeep'));
  // nucleo eletrico: fenda VERTICAL alta, abrindo no special. Sai 1 voxel a
  // frente do peito para nao ser engolido pela face escura do tronco.
  b.push(box(-1, -4, 8 + up, 3, 2, 5 + call, 'electric'));
  // placas de ombro palidas, mais largas que o tronco
  b.push(box(-4, -2, 14 + up, 9, 4, 2, 'bone'));
  // recuo escuro sob a mascara: separa a cabeca dos ombros
  b.push(box(-1, -2, 16 + up, 3, 4, 1, 'rockDeep'));
  // mascara palida ESTREITA — cabeca, nao tampa
  b.push(box(-2, -2, 17 + up, 5, 4, 3, 'bone'));
  // fenda dos olhos, atravessando a mascara
  b.push(box(-2, -3, 18 + up, 5, 1, 1, 'electric'));
  // antebracos enormes PENDURADOS, com vao de 1 voxel ate as placas de ombro
  b.push(box(-7, -1, 3 + up + swing, 3, 3, 10, 'rock'));
  b.push(box(5, -1, 3 + up + swing, 3, 3, 10, 'rock'));
  // punhos palidos: a massa que desce no golpe tem de ser lida a distancia
  b.push(box(-7, -1, 3 + up + swing, 3, 3, 2, 'bone'));
  b.push(box(5, -1, 3 + up + swing, 3, 3, 2, 'bone'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const guardianFrame = (dir, anim, f) => renderVoxels(guardianModel(anim, f), DIR_INDEX[dir], 48, 56, 22, 50);


const boltFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  fillDiamond(g, 8, 8, 3, 3, 'biolum');
  fillDiamond(g, 8, 8, 1, 1, 'player');
  const pts = [[13, 8], [8, 13], [3, 8], [8, 3]];
  const [x, y] = pts[f % 4];
  set(g, x, y, 'electric');
  outlineWith(g, 'dark');
  return g;
};
const impactFrame = (_dir, _anim, f) => {
  const g = grid(16, 16);
  const r = 1 + f;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    set(g, 8 + Math.round(Math.cos(a) * r), 8 + Math.round(Math.sin(a) * r), f < 2 ? 'player' : 'biolum');
  }
  if (f === 0) fillDiamond(g, 8, 8, 2, 2, 'player');
  return g;
};

const living = {
  idle: { frames: 4, fps: 6, loop: true },
  walk: { frames: 6, fps: 10, loop: true },
  attack: { frames: 4, fps: 12, loop: false },
  hit: { frames: 2, fps: 12, loop: false },
  die: { frames: 5, fps: 10, loop: false },
};
const base = (id, frameWidth, frameHeight, anchorX, anchorY, hitbox, footprint, animations, draw, prompt) => ({
  id,
  version: 2,
  frameWidth,
  frameHeight,
  anchorX,
  anchorY,
  directions: 4,
  authoredDirs: DIRS,
  flipPairs: {},
  hitbox,
  footprint,
  animations,
  draw,
  prompt,
});

export const ENTITY_SPECS = [
  base('player-prospector', 32, 40, 16, 38, { w: 0.68, h: 1 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    downed: { frames: 4, fps: 6, loop: true },
    revive: { frames: 6, fps: 8, loop: false },
  }, prospectorFrame, 'voxel-isometric underground prospector, pale mining helmet, cyan visor, asymmetric tool ring and fungal back module'),
  base('enemy-stalker', 32, 32, 16, 30, { w: 0.64, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, stalkerFrame, 'voxel-isometric low red chitin predator with one mineral blade, four authored directions'),
  base('enemy-spitter', 32, 32, 16, 30, { w: 0.68, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, spitterFrame, 'voxel-isometric fungal amphibian, bulb eyes, acid throat, restrained neon accents'),
  base('enemy-spore-bomber', 32, 32, 16, 30, { w: 0.62, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, bomberFrame, 'voxel-isometric compact spore carrier, hooded silhouette, central eye and telegraphed explosive pod'),
  base('enemy-bruiser', 48, 68, 24, 66, { w: 0.92, h: 1.1 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 8, fps: 10, loop: false },
  }, bruiserFrame, 'voxel-isometric gorilla geode bruiser lifting a full stone block overhead, broad shoulders, pale rock plates and electric core'),
  base('enemy-guardian', 48, 56, 24, 54, { w: 1.36, h: 1.4 }, { w: 1.7, h: 1.7, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, guardianFrame, 'voxel-isometric mineral titan, huge pale forearms, dark torso, mask and electric chest core'),
  {
    id: 'fx-projectile-bolt', version: 2, frameWidth: 16, frameHeight: 16, anchorX: 8, anchorY: 8,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0.2, h: 0.2 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { fly: { frames: 4, fps: 16, loop: true } }, draw: boltFrame,
    prompt: 'small cyan voxel energy bolt',
  },
  {
    id: 'fx-impact-burst', version: 2, frameWidth: 16, frameHeight: 16, anchorX: 8, anchorY: 8,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0, h: 0 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { burst: { frames: 5, fps: 14, loop: false } }, draw: impactFrame,
    prompt: 'small cyan voxel impact ring',
  },
];
