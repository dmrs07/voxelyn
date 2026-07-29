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


// ---------------------------------------------------------------------------
// enemy-bishop 56x76 — clerigo fungico: torre de manto, mitra, baculo, raizes
//
// O unico inimigo do jogo que e uma PESSOA, e o desenho tem de dizer isso antes
// de qualquer mecanica. Os outros cinco sao fauna: silhueta de bicho, membros,
// postura. O bispo e arquitetura vestida — base larga que se abre no chao,
// tronco que estreita, mitra fina no alto. A leitura pretendida e a de uma
// catedral pequena andando, porque a ameaca dele nao e alcancar o jogador: e
// ESTAR onde esta, plugado no tapete que o alimenta.
//
// Por que nao verde: o fungo do chao ja e verde. Um chefe da mesma cor do piso
// que o cura desaparece exatamente no lugar onde o jogador mais precisa
// enxerga-lo. Osso, ferrugem e ouro sao o oposto do tapete e continuam dentro
// da paleta mestra.
//
// As raizes usam `electric` e nao uma cor nova. A paleta mestra e validada e nao
// tem roxo; inventar um para um inimigo so criaria uma cor que existe em um
// sprite do jogo inteiro — e o azul-branco ja le como energia percorrendo o
// chao, que e o que as raizes sao.
// ---------------------------------------------------------------------------
const BISHOP_ROOTS = [
  [-6, -4], [-5, 2], [-3, -5], [-2, 4], [2, -5], [3, 4], [5, -3], [6, 1],
  [-7, 0], [7, -1], [-4, 5], [4, -6],
];

const bishopModel = (anim, f) => {
  const sway = anim === 'walk' ? [0, 1, 1, 0, 0, 1][f % 6] : 0;
  const breathe = anim === 'idle' ? [0, 0, 1, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const raise = anim === 'attack' ? [0, 1, 2, 1][f % 4] : 0;
  // `special` = Supernova Fungica: ele SE ERGUE e o manto se abre antes do
  // estouro. O crescimento e o telegrafo, e nao um efeito posterior.
  const nova = anim === 'special' ? [0, 1, 2, 3, 3, 2][f % 6] : 0;
  const up = breathe - flinch + nova;
  const b = [];

  // Raizes de micelio no chao, saindo de baixo do manto. Desenhadas primeiro
  // para ficarem sob tudo. Sao IDENTIDADE, nao sinal: quem avisa que a cura esta
  // acontecendo AGORA e a particula que sobe (evento `heal`), porque um sprite de
  // frames fixos nao sabe o que o chao debaixo dele e.
  for (const [rx, ry] of BISHOP_ROOTS) {
    if (nova === 0 && (rx + ry) % 3 === 0) continue; // esparsas em repouso
    b.push(box(rx, ry, 0, 1, 1, 1, 'electric'));
  }

  // Manto em tres degraus que estreitam para cima. A base e o volume MAIOR do
  // bicho: e ela que diz "isto esta enraizado" sem precisar de animacao.
  //
  // A altura total foi comprimida depois de ver o resultado ao lado do Guardiao:
  // o bispo saia MAIS ALTO que o chefe final, e escala e hierarquia — um chefe de
  // setor 2 maior que o do setor 3 promete uma ordem que o jogo nao cumpre. O
  // contraste com o Guardiao continua existindo, mas por FORMA (torre estreita
  // contra massa larga) e nao por tamanho.
  b.push(box(-5, -4, 0, 11, 9, 3, 'rockDeep'));
  b.push(box(-4, -3, 3, 9, 7, 4, 'rust'));
  b.push(box(-3, -3, 7, 7, 6, 5 + nova, 'bone'));
  // Estola vertical dourada descendo pelo centro do manto: e o que faz o olho
  // subir ate a mitra em vez de parar no volume maior.
  b.push(box(-1, -5, 4, 3, 1, 10 + nova, 'loot'));
  // Recuo escuro sob o peito: separa o tronco do manto em vez de deixar a torre
  // virar um bloco unico.
  b.push(box(-2, -4, 12 + nova, 5, 5, 4, 'rust'));

  // Bracos abertos. Sao os dois unicos volumes assimetricos do modelo e existem
  // para a silhueta nao fechar num trapezio perfeito.
  b.push(box(-6, -3, 10 + up + raise, 2, 4, 5, 'rust'));
  b.push(box(4, -3, 10 + up + raise, 2, 4, 5, 'rust'));
  // Turibulo pendurado a esquerda, com brasa viva.
  b.push(box(-7, -2, 6 + up + raise, 3, 3, 3, 'loot'));
  b.push(box(-6, -1, 4 + up + raise, 1, 1, 2, 'fire'));
  // Baculo a direita, AFASTADO do corpo: colado, ele e a mitra liam como duas
  // torres gemeas e o bicho parecia ter duas cabecas. O vao entre os dois e o que
  // faz um ser cajado e o outro ser mitra.
  b.push(box(7, -2, 2, 1, 1, 21 + sway, 'loot'));
  b.push(box(6, -2, 21 + sway, 3, 1, 1, 'loot'));
  b.push(box(7, -2, 22 + sway, 1, 1, 2, 'electric'));

  // Gola alta e cabeca pequena: a mitra so le como mitra se a cabeca sob ela
  // for menor que ela.
  b.push(box(-4, -3, 16 + up, 9, 6, 2, 'bone'));
  b.push(box(-1, -3, 18 + up, 3, 4, 2, 'rust'));
  b.push(box(-1, -4, 18 + up, 3, 1, 1, 'electric'));
  // Mitra: dois degraus estreitando ate a ponta.
  b.push(box(-2, -3, 20 + up, 5, 5, 3, 'bone'));
  b.push(box(-1, -2, 23 + up, 3, 3, 3, 'bone'));
  b.push(box(0, -2, 26 + up, 1, 2, 2, 'loot'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bishopFrame = (dir, anim, f) => renderVoxels(bishopModel(anim, f), DIR_INDEX[dir], 56, 76, 28, 70);

// ---------------------------------------------------------------------------
// enemy-fungal-horse 64x48 — Corcel: o unico quadrupede HORIZONTAL do bestiario
//
// Todo o resto do jogo se le como coluna. A leitura de "isto vai atravessar a
// sala" nao depende de reconhecer um cavalo: depende de ser a unica coisa mais
// larga do que alta, com quatro apoios e um pescoco caido a frente. O vao entre
// as pernas e o que separa um quadrupede de uma mesa — foi exatamente o que a
// primeira silhueta de fallback errou, e ela lia como mobilia.
//
// A crina e BRASA, e nao fungo. O rastro sai das patas, mas a fonte dele tem de
// estar visivel no bicho antes de estar no chao — um cavalo verde deixando fogo
// para tras nao explica de onde o fogo veio. Ela e tambem a unica luz quente do
// modelo, e ela aponta para onde ele vai correr.
// ---------------------------------------------------------------------------
const horseModel = (anim, f) => {
  // Perna anima por BALANCO (y), nao so por levantamento (z).
  //
  // A primeira versao so levantava a pata 2 voxels e as patas somiam atras do
  // corpo: metade dos frames do ciclo saia identica e o bicho parecia PLANAR.
  // Nesta projecao isometrica, deslocar no eixo do corpo le muito mais do que
  // subir — o balanco e o que faz a passada existir.
  const bite = anim === 'attack' ? [0, 1, 2, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` = Investida Flamejante. Os tres primeiros frames EMPINAM (o
  // telegrafo de 1,3 s que o jogador tem de ler); os tres ultimos abaixam a
  // crista, esticam o corpo e GALOPAM.
  const rear = anim === 'special' ? [1, 3, 4, 0, 0, 0][f % 6] : 0;
  const dash = anim === 'special' ? [0, 0, 0, 2, 3, 2][f % 6] : 0;
  const galloping = anim === 'special' && f % 6 >= 3;

  // Passada de dois tempos em diagonal: o par dianteira-esquerda +
  // traseira-direita anda junto, depois o outro par. O ciclo anterior levantava
  // as quatro pelo mesmo contador e ele pulava como coelho.
  const SWING = [-2, -1, 1, 2, 1, -1];
  const LIFT = [0, 1, 2, 1, 0, 0];
  const walking = anim === 'walk';
  const phaseA = f % 6;
  const phaseB = (f + 3) % 6;

  // No galope as QUATRO patas trabalham juntas: dianteiras esticam para a
  // frente enquanto as traseiras jogam para tras, e depois o corpo se recolhe.
  // E o que separa "correndo" de "o mesmo cavalo mais adiante".
  const GALLOP_SWING = [3, 0, -2];
  const GALLOP_LIFT = [3, 0, 2];
  const gi = galloping ? (f % 6) - 3 : 0;

  const bob = walking ? [0, 1, 1, 0, 1, 1][f % 6] : galloping ? [2, 0, 1][gi] : 0;
  const up = bob - flinch;
  const b = [];

  // Quatro patas com casco fendido. As DIANTEIRAS (y negativo) sobem no
  // empinar; as traseiras ficam plantadas, que e o que faz a pose ler como
  // empinar e nao como pulo.
  const legs = [
    [-2, -4, true, phaseA],
    [1, -4, true, phaseB],
    [-2, 3, false, phaseB],
    [1, 3, false, phaseA],
  ];
  for (const [lx, ly, front, phase] of legs) {
    let sy = ly;
    let lift = 0;
    if (walking) {
      sy += SWING[phase] * (front ? -1 : 1);
      lift = LIFT[phase];
    } else if (galloping) {
      sy += GALLOP_SWING[gi] * (front ? -1 : 1);
      lift = GALLOP_LIFT[gi];
    } else if (front) {
      lift = rear * 2;
    }
    b.push(box(lx, sy, lift, 2, 2, 5, 'rockDeep'));
    // Casco: o unico ponto do corpo que toca o chao, e de onde o alcatrao sai.
    b.push(box(lx, sy, lift, 2, 2, 1, 'loot'));
  }

  // Tronco longo e baixo, deitado no eixo y — a FRENTE do modelo e -y, que e o
  // que o rasterizador rotaciona. Autorar o comprimento em x deixava o cavalo
  // 90 graus fora de fase com a propria direcao: ele corria de lado.
  b.push(box(-2, -5, 5 + up, 4, 11, 4 + rear, 'rust'));
  // Garupa mais alta que a cernelha, como bicho de carga.
  b.push(box(-2, 4, 8 + up, 4, 3, 3, 'rust'));
  // Cauda de hifas caindo atras.
  b.push(box(-1, 7, 6 + up, 2, 2, 4, 'rockDeep'));

  // Placas de armadura fungica SEPARADAS, e nao uma laje corrida.
  //
  // A laje era o desenho obvio e reproduzia o erro que a silhueta de fallback ja
  // tinha cometido: um retangulo claro e continuo sobre quatro apoios le como
  // TAMPO DE MESA, nao como lombo. Placas discretas com vao entre elas devolvem
  // a leitura de dorso — e ainda batem com a referencia, que descreve "shelf
  // fungi", cogumelos de prateleira, que crescem em placas soltas.
  for (const py of [-4, -1, 2]) {
    b.push(box(-2, py, 9 + up + rear, 4, 2, 1, 'bone'));
  }

  // Pescoco inclinado para a frente e focinho BAIXO: para onde ele vai correr
  // esta escrito na direcao em que a cabeca aponta.
  const neckZ = 9 + up + rear * 2;
  b.push(box(-2, -7, neckZ - 1, 4, 3, 4 - dash, 'rust'));
  b.push(box(-2, -9, neckZ + 2 - dash - bite, 4, 3, 3, 'rust'));
  b.push(box(-2, -11, neckZ + 1 - dash - bite, 4, 3, 2, 'rockDeep'));
  // Olhos de brasa, um de cada lado do focinho.
  b.push(box(-2, -10, neckZ + 3 - dash - bite, 1, 1, 1, 'fire'));
  b.push(box(1, -10, neckZ + 3 - dash - bite, 1, 1, 1, 'fire'));

  // Crina de brasa correndo do cachaco ate a garupa. Fica ATRAS da cabeca,
  // nunca por cima: coberta pela crina, a cabeca sumia dentro do fogo e o bicho
  // perdia o unico ponto que diz para onde ele esta virado.
  //
  // Na corrida ela se ABAIXA junto com a crista, e e o que faz os tres ultimos
  // frames lerem como velocidade e nao como o mesmo cavalo mais para a frente.
  const crest = neckZ + 3 - dash;
  b.push(box(-1, -6, crest, 2, 2, 2 + rear, 'fire'));
  b.push(box(-1, -4, crest - 1, 2, 3, 2, 'fire'));
  b.push(box(-1, -1, crest - 2, 2, 3, 1, 'loot'));
  b.push(box(-1, 2, crest - 3, 2, 2, 1, 'loot'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const horseFrame = (dir, anim, f) => renderVoxels(horseModel(anim, f), DIR_INDEX[dir], 68, 72, 34, 66);

// ---------------------------------------------------------------------------
// enemy-miner 48x60 — automato de extracao abandonado
//
// NAO e uma pessoa. Foi uma unidade de manutencao e extracao da grade, deixada
// para tras quando os veios desabaram, e continua cumprindo a ordem que ninguem
// cancelou. E da mesma familia do prospector — e essa e a leitura que a silhueta
// precisa entregar antes de qualquer outra.
//
// Por isso ele NAO usa a gramatica de gente. Usa a do prospector, degradada:
// mesmo plano de corpo, mesma lanterna, mesma ferramenta — so que grande demais,
// curvado sob a propria carga, com o cabeamento para fora e o minerio reativo
// crescido por dentro. O jogador nao deve pensar "coitado". Deve pensar "isto
// aqui e o que sobra de mim".
//
// Tres voxels contam a historia toda e sao os unicos claros do modelo: a
// lanterna acesa, a placa facial rachada e as veias condutoras. O resto e
// ferrugem sobre ferrugem.
//
// "It raises its head only to decide": no `idle` a cabeca fica BAIXA, batendo a
// picareta no chao. Ela sobe em `walk` e `attack` — os dois estados que so
// existem depois de ele ter decidido alguma coisa a seu respeito. A selecao de
// animacao ja e por movimento, entao a leitura sai de graca.
// ---------------------------------------------------------------------------
const minerModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // Batida da picareta no chao, so em repouso: ele esta trabalhando.
  const toil = anim === 'idle' ? [0, 1, 2, 1][f % 4] : 0;
  // O cleave: a picareta descreve um circulo. Os quatro frames sao erguer,
  // girar, PASSAR POR TRAS, recolher — o terceiro e o que promete o circulo.
  const swing = anim === 'attack' ? [0, 1, 2, 3][f % 4] : -1;
  // A cabeca sobe assim que ele deixa de estar so trabalhando.
  const alert = anim === 'idle' ? 0 : 2;
  const up = -flinch;
  const b = [];

  // Pernas longas e segmentadas, com pe largo: ele e alto e pesado, e o vao
  // entre as pernas e o que impede a silhueta de virar um bloco.
  for (const [lx, phase] of [[-3, step], [1, -step]]) {
    b.push(box(lx, -1, Math.max(0, phase), 2, 2, 1, 'rockDeep'));
    b.push(box(lx, -1, 1 + Math.max(0, phase), 2, 2, 4, 'rust'));
    b.push(box(lx, -1, 5 + Math.max(0, phase), 2, 2, 3, 'rockDeep'));
  }

  // Tronco INCLINADO para a frente, sob a carga. A inclinacao e o que sobrou da
  // funcao dele: carregar minerio de um lado para o outro ate a grade acabar.
  const lean = 1;
  b.push(box(-3, -1 + lean, 8 + up, 6, 4, 5, 'rust'));
  // Tremonha nas costas: o compartimento de carga, ainda cheio.
  b.push(box(-2, 3 + lean, 10 + up, 4, 2, 4, 'rockDeep'));
  b.push(box(-2, 3 + lean, 14 + up, 4, 2, 1, 'loot'));
  // Cabeamento exposto descendo do tronco. Azul: a corrente da grade que ainda
  // passa por ele, e que o calor faz sobrecarregar.
  b.push(box(-4, 1 + lean, 9 + up, 1, 1, 4, 'electric'));
  b.push(box(3, 2 + lean, 10 + up, 1, 1, 3, 'electric'));
  // Veio reativo crescido POR DENTRO do peito: mineral virando fiacao.
  b.push(box(-1, -2 + lean, 10 + up, 2, 1, 2, 'electric'));

  // Bracos longos, DESCENDO ate quase o chao. Sao eles que dizem "isto nao e
  // gente": proporcao errada de proposito.
  //
  // Comecam abaixo da base do tronco (z 3 contra z 8) porque, comecando na
  // altura do ombro, eles ficavam inteiramente dentro da silhueta do tronco na
  // projecao isometrica e o bicho saia sem bracos. O que separa os dois volumes
  // aqui nao e a cor — e o braco existir onde o tronco nao esta.
  b.push(box(-5, 0 + lean, 3, 2, 2, 9 + up, 'rockDeep'));
  b.push(box(4, 0 + lean, 3, 2, 2, 9 + up, 'rockDeep'));

  // Cabeca baixa e a frente, com placa facial rachada. `alert` a levanta.
  const headZ = 13 + up + alert;
  b.push(box(-1, -2 + lean, headZ, 3, 3, 3, 'rust'));
  b.push(box(-1, -3 + lean, headZ + 1, 3, 1, 2, 'bone'));
  // Optica: um unico ponto, mais fraco que o visor do prospector. GUTTERING, e
  // nao piscando.
  //
  // A primeira versao alternava a cor por paridade de frame (`f % 2`), o que na
  // pratica era um estroboscopio: medido no atlas, o ponto ia de 6 pixels de
  // biolum a ZERO em frames alternados — 3 Hz no `idle` e 5 Hz no `walk`, no
  // grupo de pixels mais claro de um corpo inteiramente escuro. Era a unica troca
  // de cor por frame do gerador todo, e o sprite lia como se estivesse falhando.
  //
  // Um voxel de 1x1x1 na projecao nao e um pixel: sao ~6. Meio ciclo apagado num
  // aglomerado desses domina a leitura do bicho.
  //
  // A ficha pede "optics flicker", e flicker de lampada velha e MAIORITARIAMENTE
  // aceso com quedas curtas. Um frame em quatro apagado da isso: ~170 ms de queda
  // a cada 670 ms, que le como falha de contato e nao como pisca-pisca. O modulo
  // 4 vale para todas as animacoes — nenhuma tem menos de 4 frames alem de `hit`,
  // que dura dois e nao precisa de flicker nenhum.
  b.push(box(0, -4 + lean, headZ + 1, 1, 1, 1, f % 4 === 3 ? 'fungus' : 'biolum'));
  // Lanterna de mineracao no ombro, guttering. E o unico calor do modelo.
  b.push(box(-3, -3 + lean, headZ, 2, 2, 2, 'loot'));
  b.push(box(-3, -4 + lean, headZ + 1, 1, 1, 1, 'fire'));

  // A picareta. Em repouso ela BATE NO CHAO — ele nao esta esperando voce.
  if (swing < 0) {
    // Encostada no braco direito e MERGULHANDO no chao a frente dele, e nao de
    // pe ao lado: solta, ela lia como um poste plantado no chao ao lado de um
    // corpo, e a leitura "ele esta trabalhando" e o que faz o encontro
    // significar alguma coisa antes de o jogador decidir qualquer coisa.
    b.push(box(4, -4, 1 + toil, 2, 2, 8 - toil, 'rust'));
    b.push(box(3, -5, 0 + toil, 3, 2, 1, 'bone'));
    b.push(box(3, -5, 0 + toil, 1, 1, 1, 'electric'));
  } else {
    const arc = [
      [0, -6, 11], // erguida a frente
      [6, -1, 10], // lado direito
      [0, 5, 9], // POR TRAS: e este frame que promete o circulo
      [-6, -1, 10], // lado esquerdo, recolhendo
    ][swing];
    b.push(box(arc[0], arc[1], arc[2] + up, 2, 2, 2, 'rust'));
    b.push(box(arc[0], arc[1], arc[2] + 2 + up, 2, 2, 1, 'bone'));
    // Corrente residual no fio da lamina: ela crepita quando ele gira.
    b.push(box(arc[0], arc[1], arc[2] + 3 + up, 1, 1, 1, 'electric'));
    b.push(box(Math.round(arc[0] / 2), Math.round(arc[1] / 2), 9 + up, 2, 2, 1, 'rockDeep'));
  }

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const minerFrame = (dir, anim, f) => renderVoxels(minerModel(anim, f), DIR_INDEX[dir], 48, 60, 24, 54);

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
  base('enemy-bishop', 56, 76, 28, 74, { w: 1.2, h: 1.9 }, { w: 1.5, h: 1.5, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 9, loop: false },
  }, bishopFrame, 'voxel-isometric fungal cleric, tall flaring vestment, tall mitre, pastoral staff and hanging censer, mycelial roots at the hem'),
  base('enemy-fungal-horse', 68, 72, 34, 66, { w: 1.4, h: 0.95 }, { w: 1.6, h: 1.2, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, horseFrame, 'voxel-isometric fungal warhorse, long low body, ember mane and crest, split hooves, shelf-fungus armor plates'),
  base('enemy-miner', 48, 60, 24, 54, { w: 0.92, h: 1.5 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, living, minerFrame, 'voxel-isometric abandoned mining automaton, hunched under its load, long arms, cracked faceplate, shoulder lamp, exposed conductive wiring, refitted pickaxe'),
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
