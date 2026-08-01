import { box, collapse, renderVoxels } from './voxel.mjs';
import {
  ANCHOR_X as PROSPECTOR_ANCHOR_X,
  ANCHOR_Y as PROSPECTOR_ANCHOR_Y,
  FRAME_HEIGHT as PROSPECTOR_FRAME_HEIGHT,
  FRAME_WIDTH as PROSPECTOR_FRAME_WIDTH,
  RENDER_ANCHOR_X as PROSPECTOR_RENDER_ANCHOR_X,
  RENDER_ANCHOR_Y as PROSPECTOR_RENDER_ANCHOR_Y,
  WALK_FRAMES,
  WALK_SWING,
  prospectorParts,
  prospectorProne,
} from './prospector.mjs';
// Restos do desenhador 2D que os modelos voxel substituiram — `limb`, `scatter`,
// `dirInfo`, as tabelas de fase e os ajudantes de elipse — sairam junto com o
// ultimo personagem que ainda os usava. Continuavam importados e definidos sem
// nenhuma chamada, e o lint do repositorio ja os acusava.
import { fillDiamond, grid, outlineWith, set } from './lib.mjs';

export const ANIM_ORDER = ['idle', 'walk', 'attack', 'special', 'hit', 'downed', 'revive', 'die', 'fly', 'burst'];
const DIRS = ['dr', 'dl', 'ur', 'ul'];

// ---------------------------------------------------------------------------
// player-prospector — SHEET COMPLETO do bot PX
//
// O modelo vive em `prospector.mjs` e e o MESMO das tres camadas de runtime.
// Este arquivo so escolhe a pose de cada quadro e concatena as partes.
//
// Antes o corpo estava escrito duas vezes, aqui e la, e os dois ja tinham
// divergido: este carregava uma picareta e as camadas carregavam a arma que a
// substituiu. O jogador via o personagem trocar de modelo toda vez que soltava
// o gatilho, porque a composicao so valia durante a acao de tiro.
//
// O sheet completo continua existindo pelas poses que as camadas nao autoram —
// `hit`, `die`, `downed` e `revive` —, e por ser o caminho de recuo enquanto os
// tres atlas de camada nao carregaram.
// ---------------------------------------------------------------------------
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

/**
 * Progresso da morte, de 0 (corpo ainda inteiro, no frame do golpe) a 1 (so
 * destrocos). `living.die` tem 5 frames; o primeiro fica intacto de proposito
 * para o jogador ver QUAL pose morreu antes de o corpo se desfazer.
 */
const DIE_FRAMES = 5;
const dieT = (f) => Math.min(1, Math.max(0, f) / (DIE_FRAMES - 1));

/** Corpo inteiro numa pose: as tres camadas empilhadas na ordem de montagem. */
const prospectorStanding = (pose) => {
  const parts = prospectorParts(pose);
  return [...parts.lower, ...parts.upper, ...parts.gun];
};

/** Modelo 3D do prospector para uma animacao/frame. */
const prospectorModel = (anim, f) => {
  if (anim === 'idle') return prospectorStanding({ bob: [0, 0, 1, 0][f % 4] });
  if (anim === 'walk') return prospectorStanding({ swing: WALK_SWING[f % WALK_FRAMES] });
  if (anim === 'attack') return prospectorStanding({ kick: [0, 2, 1, 0][f % 4], flash: f % 4 === 1 });
  // dano: recuo real do tronco e da cabeca, nao um pixel de bob
  if (anim === 'hit') return prospectorStanding({ lean: [1, 0][f % 2], bob: [1, 0][f % 2] });
  // queda: dois frames tombando, depois o corpo ja no chao assentando
  if (anim === 'die') {
    if (f === 0) return prospectorStanding({ lean: 1, crouch: 2 });
    if (f === 1) return prospectorStanding({ lean: 2, crouch: 4 });
    return prospectorProne({ settle: Math.max(0, 4 - f) });
  }
  // abatido: o farol e o nucleo pulsam devagar
  if (anim === 'downed') return prospectorProne({ breath: [0, 0, 1, 0][f % 4] });
  // revive: espelha a queda — sobe do chao ate ficar de pe
  if (anim === 'revive') {
    if (f <= 2) return prospectorProne({ settle: f });
    if (f === 3) return prospectorStanding({ lean: 2, crouch: 4 });
    if (f === 4) return prospectorStanding({ lean: 1, crouch: 2 });
    return prospectorStanding({});
  }
  return prospectorStanding({});
};

const prospectorFrame = (dir, anim, f) =>
  renderVoxels(
    prospectorModel(anim, f),
    DIR_INDEX[dir],
    PROSPECTOR_FRAME_WIDTH,
    PROSPECTOR_FRAME_HEIGHT,
    PROSPECTOR_RENDER_ANCHOR_X,
    PROSPECTOR_RENDER_ANCHOR_Y
  );

// ---------------------------------------------------------------------------
// enemy-stalker 32x32 — predador baixo e comprido, quitina, lamina mineral
// ---------------------------------------------------------------------------
const stalkerModel = (anim, f) => {
  const gait = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const lunge = anim === 'attack' ? [0, -1, 1, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // Idle vivo: o dorso INCHA para cima e assenta — respiracao de predador
  // agachado. Cresce em altura em vez de subir inteiro, porque as patas ficam
  // plantadas e um corpo que sobe descolado delas viraria um bicho flutuando.
  const breath = anim === 'idle' ? [0, 1, 1, 0][f % 4] : 0;
  const b = [];
  // quatro patas finas, alternando aos pares
  b.push(box(-3, -2, Math.max(0, gait), 1, 1, 3, 'blood'));
  b.push(box(2, 1, Math.max(0, gait), 1, 1, 3, 'blood'));
  b.push(box(-3, 1, Math.max(0, -gait), 1, 1, 3, 'blood'));
  b.push(box(2, -2, Math.max(0, -gait), 1, 1, 3, 'blood'));
  // corpo baixo e comprido: silhueta horizontal, oposta a do prospector
  b.push(box(-2, -2, 3, 4, 4, 2 + breath, 'blood'));
  b.push(box(-2, -2, 5 + breath, 4, 3, 1, 'rust'));
  // DETALHE FINO — segmentacao da carapaca: duas bandas de quitina vermelha
  // atravessando a placa dorsal em meio-passo saliente. Mais estreitas que a
  // placa de proposito: banda de largura total pintava o dorso de listras e
  // roubava a placa; recuada meio passo de cada borda ela le como articulacao
  // POR BAIXO da placa aparecendo nas juntas.
  b.push(box(-1.5, -1, 5.5 + breath, 3, 0.5, 0.5, 'blood'));
  b.push(box(-1.5, 0.5, 5.5 + breath, 3, 0.5, 0.5, 'blood'));
  // Espinhos dorsais: tres nubs de meio-passo na linha do dorso, crescendo
  // para tras — leitura de predador eriçado ja na silhueta.
  b.push(box(-0.5, -1.5, 6 + breath, 0.5, 0.5, 0.5, 'rust'));
  b.push(box(0, 0, 6 + breath, 0.5, 0.5, 0.5, 'rust'));
  b.push(box(-0.5, 1.5, 5.5 + breath, 0.5, 0.5, 0.5, 'rust'));
  // cabeca projetada a frente
  b.push(box(-1, -3 - lunge, 3 + flinch, 2, 1, 2, 'blood'));
  b.push(box(-1, -4 - lunge, 4 + flinch, 2, 1, 1, 'biolum'));
  // Mandibulas: dois dentes palidos de meio-passo sob a cabeca, abertos. A boca
  // e para onde o olho vai quando o bicho corre na sua direcao.
  b.push(box(-1, -3.5 - lunge, 3 + flinch, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(0.5, -3.5 - lunge, 3 + flinch, 0.5, 0.5, 0.5, 'bone'));
  // lamina mineral em UM lado so: assimetria e a marca da especie
  b.push(box(3, -1 - lunge, 4, 1, 1, 2, 'bone'));
  b.push(box(3, -2 - lunge, 5, 1, 1, 1, 'bone'));
  // Serrilha da lamina: dois dentes de meio-passo no fio dianteiro.
  b.push(box(3, -2.5 - lunge, 5.5, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(3, -1.5 - lunge, 4.5, 0.5, 0.5, 0.5, 'bone'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const stalkerFrame = (dir, anim, f) => renderVoxels(stalkerModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// ---------------------------------------------------------------------------
// enemy-spitter 32x32 — anfibio fungico bojudo, garganta acida, olhos em haste
// ---------------------------------------------------------------------------
const spitterModel = (anim, f) => {
  const hop = anim === 'walk' ? [0, 1, 2, 1, 0, 0][f % 6] : 0;
  const spit = anim === 'attack' ? [0, 1, 2, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // Idle vivo: a bolsa de acido PULSA — respiracao de anfibio pelo saco
  // vocal. Amplitude 1 contra as 2 do telegraph de ataque, para o pulso de
  // repouso nunca ser confundido com o aviso de disparo.
  const pulse = anim === 'idle' ? [0, 1, 1, 0][f % 4] : 0;
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
  // DETALHE FINO — verrugas dorsais: bossas de meio-passo espalhadas pelo
  // lombo, em fungo escuro. Pele de anfibio e textura, nao superficie lisa; as
  // bossas ficam ABAIXO da linha dos olhos para nao disputar com eles.
  b.push(box(-2.5, -1, 5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(-0.5, 0.5, 5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(1.5, -0.5, 5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(0.5, 1.5, 5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  // Pintas do flanco: duas manchas escuras salientes na face dianteira.
  b.push(box(-2.5, -2.5, 3.5 + z, 0.5, 0.5, 1, 'fungusDeep'));
  b.push(box(2, -2.5, 3.5 + z, 0.5, 0.5, 1, 'fungusDeep'));
  // garganta acida: incha para a FRENTE antes do disparo (telegraph)
  b.push(box(-1, -3 - spit - pulse, 3 + z, 3, 1 + spit + pulse, 2, 'acid'));
  // olhos bulbosos em haste, acima da linha das costas
  b.push(box(-2, -1, 5 + z, 1, 1, 1, 'fungus'));
  b.push(box(2, -1, 5 + z, 1, 1, 1, 'fungus'));
  b.push(box(-2, -1, 6 + z, 1, 1, 1, 'biolum'));
  b.push(box(2, -1, 6 + z, 1, 1, 1, 'biolum'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const spitterFrame = (dir, anim, f) => renderVoxels(spitterModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// ---------------------------------------------------------------------------
// enemy-spore-bomber 32x32 — encapuzado, olho unico, pod que incha antes de estourar
// ---------------------------------------------------------------------------
const bomberModel = (anim, f) => {
  const drift = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` e o telegraph da explosao: o pod incha frame a frame
  const swell = anim === 'special' ? Math.min(2, f) : anim === 'attack' ? [0, 1, 1, 0][f % 4] : 0;
  // Idle vivo: o pod respira SO em altura. O telegraph cresce nos dois eixos e
  // com amplitude maior — a carga viva se mexe, mas a expansao que anuncia a
  // explosao continua inconfundivel.
  const pulse = anim === 'idle' ? [0, 1, 1, 0][f % 4] : 0;
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
  // DETALHE FINO — lamelas do capuz: escamas claras de meio-passo penduradas
  // na borda de cada degrau, alternadas. Capuz de fungo e feito de prateleiras
  // que crescem umas sobre as outras, e sao as lamelas que contam isso.
  b.push(box(-2.5, -2.5, 2 + z, 0.5, 0.5, 1, 'fungus'));
  b.push(box(1, -2.5, 1.5 + z, 0.5, 0.5, 1, 'fungus'));
  b.push(box(-1.5, -2.5, 4 + z, 0.5, 0.5, 0.5, 'fungus'));
  b.push(box(0.5, -1.5, 6 + z, 0.5, 0.5, 0.5, 'fungus'));
  // olho unico fundo na sombra do capuz
  b.push(box(0, -3, 4 + z, 1, 1, 2, 'biolum'));
  // pod de esporos: massa grande atras, cresce ate estourar
  b.push(box(-3, 2, 2 + z, 5 + swell, 2, 4 + swell + pulse, 'acid'));
  // Poros do pod: tres pontos escuros de meio-passo na face externa da
  // capsula — os furos por onde o esporo vai sair. Ficam na face de tras, longe
  // do telegraph, e nao crescem com ele: sao textura, nao sinal.
  b.push(box(-2, 4, 3 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(-0.5, 4, 4.5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(1, 4, 3.5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bomberFrame = (dir, anim, f) => renderVoxels(bomberModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

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
  // Idle vivo: ombros e bracos SOBEM juntos e caem — respiracao de gorila. A
  // cabeca fica parada de proposito: afundada entre os ombros, ela subir junto
  // abriria um vao entre ela e o torso.
  const heave = anim === 'idle' ? [0, 0, 1, 0][f % 4] : 0;
  const up = -flinch - crouch;
  const b = [];
  // pernas grossas e curtas
  b.push(box(-3, -1, Math.max(0, step), 3, 3, 4, 'rockDeep'));
  b.push(box(1, -1, Math.max(0, -step), 3, 3, 4, 'rockDeep'));
  // torso trapezoidal que alarga para cima
  b.push(box(-3, -2, 4 + up, 6, 4, 4, 'rockDeep'));
  b.push(box(-4, -2, 8 + up, 8, 4, 4, 'rock'));
  // DETALHE FINO — rachaduras: duas fendas escuras de meio-passo salientes na
  // face do torso claro. Geodo e pedra PARTIDA; as rachaduras apontam para o
  // nucleo, que e onde a fratura comecou.
  b.push(box(-3, -2.5, 8.5 + up, 0.5, 0.5, 2, 'rockDeep'));
  b.push(box(2.5, -2.5, 9 + up, 0.5, 0.5, 1.5, 'rockDeep'));
  // placas palidas nos ombros: a leitura de "geodo"
  b.push(box(-5, -2, 10 + up + heave, 2, 4, 3, 'bone'));
  b.push(box(4, -2, 10 + up + heave, 2, 4, 3, 'bone'));
  // Lascas de cristal de meio-passo cravadas nas placas de ombro: o geodo
  // aberto aparece nas bordas, nao so no peito. Emissivas de proposito — sao o
  // mesmo mineral do nucleo.
  b.push(box(-4.5, -2.5, 11 + up + heave, 0.5, 0.5, 1, 'electric'));
  b.push(box(4.5, -2.5, 11.5 + up + heave, 0.5, 0.5, 1, 'electric'));
  // nucleo eletrico exposto no peito
  b.push(box(-1, -3, 9 + up, 3, 1, 3, 'electric'));
  // Borda da fratura: aro palido de meio-passo acima e abaixo do nucleo — a
  // pedra clara que se partiu para expor o mineral.
  b.push(box(-1.5, -2.5, 8.5 + up, 4, 0.5, 0.5, 'bone'));
  b.push(box(-1.5, -2.5, 12 + up, 4, 0.5, 0.5, 'bone'));
  // cabeca pequena e afundada entre os ombros
  b.push(box(-1, -1, 12 + up, 3, 2, 2, 'rockDeep'));
  b.push(box(-1, -2, 13 + up, 3, 1, 1, 'biolum'));
  // bracos longos de gorila. No special, sobem juntos sustentando a pedra.
  const armRaise = anim === 'special' ? Math.min(10, hurlLift) : slam;
  b.push(box(-6, -1, 6 + up + armRaise + heave, 2, 2, 5, 'rock'));
  b.push(box(5, -1, 6 + up + armRaise + heave, 2, 2, 5, 'rock'));
  // Nodoas de meio-passo nos punhos: pedra calejada onde o braco bate. Um nub
  // palido por punho, na face de impacto.
  b.push(box(-5.5, -1.5, 6.5 + up + armRaise + heave, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(5.5, -1.5, 6.5 + up + armRaise + heave, 0.5, 0.5, 0.5, 'bone'));
  if (anim === 'special' && !hurlThrow) {
    const rockZ = 5 + hurlLift;
    // O volume converge com um bloco real do terreno, sem ocupar o frame inteiro.
    b.push(box(-3, -2, rockZ, 7, 5, 4, hurlHold ? 'rock' : 'rockDeep'));
    b.push(box(-2, -3, rockZ + 2, 5, 1, 2, 'rock'));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bruiserFrame = (dir, anim, f) => renderVoxels(bruiserModel(anim, f), DIR_INDEX[dir], 96, 136, 44, 124);

// ---------------------------------------------------------------------------
// enemy-guardian 48x56 — titan mineral, antebracos enormes, mascara, nucleo
// ---------------------------------------------------------------------------
const guardianModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  const swing = anim === 'attack' ? [0, 1, 3, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` = invocacao: o nucleo se abre e o corpo se ergue
  const call = anim === 'special' ? [0, 1, 1, 1][f % 4] : 0;
  // Idle vivo: os antebracos pendurados sobem 1 voxel e o nucleo se alonga
  // junto — um titan respira devagar, e quase nada dele se move alem da massa
  // que ja esta solta do corpo.
  const breath = anim === 'idle' ? [0, 0, 1, 0][f % 4] : 0;
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
  b.push(box(-1, -4, 8 + up, 3, 2, 5 + call + breath, 'electric'));
  // placas de ombro palidas, mais largas que o tronco
  b.push(box(-4, -2, 14 + up, 9, 4, 2, 'bone'));
  // DETALHE FINO — chanfro: friso de pedra media de meio-passo correndo a
  // borda frontal das placas. A placa ganha espessura lida — chapa lavrada, e
  // nao laje.
  b.push(box(-4, -2.5, 15.5 + up, 9, 0.5, 0.5, 'rock'));
  // recuo escuro sob a mascara: separa a cabeca dos ombros
  b.push(box(-1, -2, 16 + up, 3, 4, 1, 'rockDeep'));
  // mascara palida ESTREITA — cabeca, nao tampa
  b.push(box(-2, -2, 17 + up, 5, 4, 3, 'bone'));
  // fenda dos olhos, atravessando a mascara
  b.push(box(-2, -3, 18 + up, 5, 1, 1, 'electric'));
  // Sulcos rituais: duas lagrimas escuras de meio-passo descendo da fenda dos
  // olhos pela face da mascara. Gravura, nao dano — e o unico ornamento que um
  // titan de pedra carrega.
  b.push(box(-1.5, -2.5, 17 + up, 0.5, 0.5, 1, 'rockDeep'));
  b.push(box(1, -2.5, 17 + up, 0.5, 0.5, 1, 'rockDeep'));
  // antebracos enormes PENDURADOS, com vao de 1 voxel ate as placas de ombro
  b.push(box(-7, -1, 3 + up + swing + breath, 3, 3, 10, 'rock'));
  b.push(box(5, -1, 3 + up + swing + breath, 3, 3, 10, 'rock'));
  // Estratos: duas vetas palidas de meio-passo atravessando a face externa de
  // cada antebraco. Pedra empilhada por eras — e as linhas horizontais fazem a
  // massa ler ainda mais alta.
  b.push(box(-7.5, -0.5, 7 + up + swing + breath, 0.5, 2, 0.5, 'bone'));
  b.push(box(-7.5, -0.5, 10 + up + swing + breath, 0.5, 2, 0.5, 'bone'));
  b.push(box(8, -0.5, 7 + up + swing + breath, 0.5, 2, 0.5, 'bone'));
  b.push(box(8, -0.5, 10 + up + swing + breath, 0.5, 2, 0.5, 'bone'));
  // punhos palidos: a massa que desce no golpe tem de ser lida a distancia
  b.push(box(-7, -1, 3 + up + swing + breath, 3, 3, 2, 'bone'));
  b.push(box(5, -1, 3 + up + swing + breath, 3, 3, 2, 'bone'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const guardianFrame = (dir, anim, f) => renderVoxels(guardianModel(anim, f), DIR_INDEX[dir], 96, 112, 44, 100);


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
  // Pedras da barra do manto: tres cravos palidos de meio-passo ao longo da
  // bainha frontal — o peso que mantem um manto de cerimonia no chao.
  b.push(box(-3.5, -4.5, 1, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(-0.5, -4.5, 0.5, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(2.5, -4.5, 1, 0.5, 0.5, 0.5, 'bone'));
  b.push(box(-4, -3, 3, 9, 7, 4, 'rust'));
  // O degrau de cima do manto e FERRUGEM, e nao osso.
  //
  // Osso e o material mais palido do jogo, e este e o maior volume do bicho: com
  // as rampas espacadas por igual, ele passou a ler como uma torre de arenito
  // clara — a coisa mais brilhante da tela, competindo com o proprio jogador
  // numa caverna escura. Antes o material se salvava por acidente, porque a
  // rampa dele caia 35 pontos entre o topo e a lateral e o volume saia escuro
  // apesar da cor.
  //
  // O palido continua no bicho, concentrado onde o olho deve parar: gola e
  // mitra. A separacao entre este degrau e o de baixo, que agora usam o mesmo
  // material, sai da sombra de contato — que e exatamente para isso que ela
  // existe.
  b.push(box(-3, -3, 7, 7, 6, 5 + nova, 'bone'));
  // Estola vertical dourada descendo pelo centro do manto: e o que faz o olho
  // subir ate a mitra em vez de parar no volume maior.
  b.push(box(-1, -5, 4, 3, 1, 10 + nova, 'loot'));
  // DETALHE FINO — bordado da estola: tracos de ferrugem de meio-passo
  // cruzando a faixa dourada. Paramento tecido, nao chapa de ouro.
  b.push(box(-0.5, -5.5, 6, 2, 0.5, 0.5, 'rust'));
  b.push(box(-0.5, -5.5, 9, 2, 0.5, 0.5, 'rust'));
  b.push(box(-0.5, -5.5, 12, 2, 0.5, 0.5, 'rust'));
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
  // Corrente do turibulo: dois elos de meio-passo subindo ate a mao. Sem a
  // corrente ele e uma caixa dourada flutuando ao lado do corpo.
  b.push(box(-5.5, -1.5, 9.5 + up + raise, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(-6, -2, 10.5 + up + raise, 0.5, 0.5, 0.5, 'loot'));
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
  // Friso dourado de meio-passo na base da mitra: a coroa da leitura clerical,
  // no unico volume que pode carregar ouro sem disputar com a estola.
  b.push(box(-2, -3.5, 20 + up, 5, 0.5, 0.5, 'loot'));
  b.push(box(-1, -2, 23 + up, 3, 3, 3, 'bone'));
  b.push(box(0, -2, 26 + up, 1, 2, 2, 'loot'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bishopFrame = (dir, anim, f) => renderVoxels(bishopModel(anim, f), DIR_INDEX[dir], 112, 152, 56, 140);

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
  //
  // ATAQUE BASICO: uma BOTADA, e nao um aceno de cabeca.
  //
  // O `bite` de dois voxels que existia aqui era invisivel em jogo — a cabeca
  // descia meio pixel na tela e voltava. Um elite que investe atravessando a
  // arena nao pode ter, no golpe curto, menos gesto do que um stalker. O ciclo
  // agora tem os quatro tempos que um golpe precisa para ser lido: recolher
  // (armar), estourar para a frente, sustentar o alcance maximo, recolher.
  //
  // `lunge` empurra o pescoco e a cabeca no eixo do corpo; `stomp` levanta as
  // dianteiras no tempo de armar e as crava no chao no tempo do impacto. Os dois
  // juntos sao o que faz o golpe pesar: a massa vai para a frente e para baixo.
  const ATTACK_LUNGE = [-1, 2, 2, 0];
  const ATTACK_STOMP = [2, 0, 0, 1];
  const attacking = anim === 'attack';
  const lunge = attacking ? ATTACK_LUNGE[f % 4] : 0;
  const stomp = attacking ? ATTACK_STOMP[f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` = Investida Flamejante. Os tres primeiros frames EMPINAM (o
  // telegrafo de 1,3 s que o jogador tem de ler); os tres ultimos abaixam a
  // crista, esticam o corpo e GALOPAM.
  const rear = anim === 'special' ? [1, 3, 4, 0, 0, 0][f % 6] : 0;
  const dash = anim === 'special' ? [0, 0, 0, 2, 3, 2][f % 6] : 0;
  const galloping = anim === 'special' && f % 6 >= 3;
  // Idle vivo: a cabeca MERGULHA um voxel e volta — o aceno de um animal
  // pastando/farejando — e o rabo de hifas balanca no contratempo. O corpo
  // fica parado: e a unica silhueta horizontal do jogo, e um bob no barril
  // leria como o bicho quicando no lugar.
  const graze = anim === 'idle' ? [0, 1, 1, 0][f % 4] : 0;
  const swish = anim === 'idle' ? [0, 1, 0, -1][f % 4] : 0;

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
      // O empinar da investida e a botada do golpe curto usam as MESMAS patas
      // dianteiras: as traseiras ficam plantadas nos dois casos, e e isso que
      // faz o corpo girar em torno da garupa em vez de pular.
      lift = rear * 2 + stomp;
    }
    b.push(box(lx, sy, lift, 2, 2, 7, 'rockDeep'));
    // Casco: o unico ponto do corpo que toca o chao, e de onde o alcatrao sai.
    b.push(box(lx, sy, lift, 2, 2, 1, 'loot'));
  }

  // TRONCO EM TRES MASSAS, e nao uma caixa unica.
  //
  // A caixa unica era o defeito estrutural do bicho, e nenhum detalhe na cabeca
  // ia consertar: na projecao 2:1 um paralelepipedo de 11 voxels de comprimento
  // com o topo todo na mesma altura projeta um plano claro continuo sobre quatro
  // apoios. Isso e um TAMPO DE MESA. O modelo tinha placas separadas de osso
  // justamente para evitar essa leitura, mas elas estavam DEITADAS no topo, o
  // que so aumentava o tampo em area e em brilho.
  //
  // Um cavalo nao tem lombo reto: tem peitoral alto, barril fundo e garupa alta,
  // com a linha do dorso descendo e subindo entre eles. Tres volumes de alturas
  // diferentes quebram o plano em degraus, e degrau e o que a projecao consegue
  // mostrar. As placas fungicas saem do topo e vao para os FLANCOS, onde
  // cogumelo de prateleira cresce de verdade e onde nao viram tampo.
  // O corpo e ESCURO. Esta e a decisao que resolve o bicho, e nao a forma.
  //
  // Toda caixa `rust` tem `bone` no topo — a rampa do material e [topo, esquerda,
  // direita] = ['bone', 'rust', 'rockShadow'] — e na projecao 2:1 a face de topo
  // e a maior e a mais clara de qualquer volume horizontal. Um tronco de 4x12
  // voxels em `rust` projeta, portanto, um plano cor de osso do tamanho do bicho
  // inteiro. Nenhuma quantidade de degraus na linha do dorso conserta isso: o que
  // lia como tampo de mesa nao era o formato, era a COR do topo.
  //
  // Em `rockDeep` o topo e `rock`, dois passos abaixo. O corpo vira massa escura
  // e sobram exatamente tres coisas claras no bicho — a crina de brasa, a mascara
  // de osso e os cascos. Sao os tres pontos que a criatura precisa que voce leia:
  // de onde vem o fogo, para onde ela esta virada, e onde ela pisa.
  const backZ = 7 + up;
  // Peitoral: a massa da frente, alta e funda. E ela que atinge primeiro.
  b.push(box(-2, -5, backZ, 4, 4, 5 + rear, 'rockDeep'));
  // DETALHE FINO — ARREIOS. A ficha do bestiario diz "a presenca de arreios
  // nao implica operador", entao os arreios tem de EXISTIR no bicho: peitoral
  // de couro dourado atravessando o peito e barrigueira descendo pelos dois
  // flancos do barril. Meio-passo saliente, sobre o corpo escuro — a unica
  // linha "de civilizacao" numa criatura selvagem.
  b.push(box(-2, -5.5, backZ + 3, 4, 0.5, 0.5, 'loot'));
  // Barril: mais baixo que o peitoral e que a garupa — este e o degrau.
  b.push(box(-2, -1, backZ, 4, 4, 4 + rear, 'rockDeep'));
  // Barrigueira: desce os flancos e fecha por baixo do ventre.
  b.push(box(-2.5, 0.5, backZ, 0.5, 0.5, 4 + rear, 'loot'));
  b.push(box(2, 0.5, backZ, 0.5, 0.5, 4 + rear, 'loot'));
  b.push(box(-2, 0.5, backZ - 1.5, 4, 0.5, 0.5, 'loot'));
  // Garupa alta, de bicho de carga, com o lombo subindo de novo atras.
  b.push(box(-2, 3, backZ, 4, 4, 5 + rear, 'rockDeep'));
  // Ventre baixo, fechando o vao entre as patas dianteiras e as traseiras.
  b.push(box(-2, -5, backZ - 1, 4, 12, 1, 'rockDeep'));
  // Cauda de hifas caindo atras.
  b.push(box(-1 + swish, 7, backZ, 2, 2, 4, 'rockDeep'));

  // Placas de fungo de prateleira nos FLANCOS: duas de cada lado, e so.
  //
  // Um voxel de largura cada, para a face de topo medir 4x2 pixels — pequena
  // demais para virar plano. Deitadas no dorso, como estavam, elas eram o
  // proprio tampo, so que mais claro que o resto; em fileira de tres viravam uma
  // escada clara que competia com a cabeca. Duas bastam para dizer "cresce fungo
  // nele" sem disputar a leitura com a unica coisa que precisa vencer, que e a
  // mascara.
  for (const py of [-4, 1]) {
    b.push(box(-3, py, backZ + 1, 1, 2, 2, 'rust'));
    b.push(box(2, py, backZ + 1, 1, 2, 2, 'rust'));
  }

  // CABECA-MASCARA. Angular, fechada, e a mesma ideia do cavalo de Troia: uma
  // peca de guerra construida, nao um focinho de bicho.
  //
  // O que havia antes era um cavalo de DESENHO: tres caixas de larguras iguais
  // empilhadas, olhos na frente da testa e nenhuma aresta. Numa silhueta lida a
  // 32px, largura constante e o que produz cara redonda — a leitura de "fofo"
  // nao vem do tamanho dos olhos, vem de a cabeca nao terminar em ponta.
  //
  // Tres coisas trocam essa leitura, e nenhuma delas e detalhe: o focinho
  // AFUNILA em degraus ate um bico de um voxel; uma viseira de osso atravessa a
  // testa e joga sombra sobre os olhos, que passam a ser fendas AFUNDADAS em vez
  // de duas brasas na frente da cara; e dois chifres varridos para a frente saem
  // da mascara, apontando para onde ele vai investir. A ponta e a promessa.
  // O pescoco nasce no TOPO do peitoral e sobe, em vez de sair da altura do
  // lombo e seguir reto para a frente. E a mudanca que mais devolve presenca: a
  // cabeca passa a ficar acima da linha do dorso, e um bicho cuja cabeca esta
  // acima do proprio lombo le como animal olhando para voce. Na mesma altura do
  // lombo ele lia como movel. O corpo continua mais largo do que alto — a
  // identidade horizontal e a distancia que ele cobre —, mas agora ha uma coluna
  // na frente dela.
  const neckZ = 12 + up + rear * 2 - graze;
  // Pescoco em dois degraus que estreitam. Escuro inteiro: qualquer peca clara
  // aqui encosta na mascara e as duas viram uma mancha so.
  b.push(box(-2, -7 - lunge, neckZ - 2, 4, 3, 4 - dash, 'rockDeep'));
  b.push(box(-1, -9 - lunge, neckZ + 1 - dash, 3, 3, 3, 'rockDeep'));

  // Cranio ESTREITO — 3 voxels, contra os 4 do pescoco — e focinho afunilando em
  // dois degraus ate um bico de 1. A cabeca so termina em ponta se cada degrau
  // for mais estreito que o anterior; larguras iguais empilhadas dao focinho
  // quadrado, que era o problema.
  const headZ = neckZ + 1 - dash;
  b.push(box(-1, -12 - lunge, headZ, 3, 3, 3, 'rockDeep'));
  b.push(box(-1, -13 - lunge, headZ, 2, 1, 2, 'rockDeep'));
  b.push(box(0, -14 - lunge, headZ, 1, 1, 1, 'rockDeep'));

  // Testeira: uma FAIXA de osso de um voxel de altura atravessando a fronte, e
  // nao um bloco. O bloco de 4x2x2 que estava aqui projetava um losango claro do
  // tamanho da propria cabeca e, encostado nos chifres, fechava tudo num unico
  // plano pálido — a cabeca virava uma tabua apontando para o lado. Uma faixa
  // fina desenha a aresta da mascara em vez de substituir a cabeca por ela.
  b.push(box(-1, -13 - lunge, headZ + 2, 3, 2, 1, 'bone'));
  // Chapas de face, verticais, uma de cada lado: e o par delas que fecha a
  // leitura de mascara, e de pe elas quase nao tem topo.
  b.push(box(-1, -12 - lunge, headZ, 1, 2, 2, 'bone'));
  b.push(box(1, -12 - lunge, headZ, 1, 2, 2, 'bone'));
  // Rebites da mascara: um ponto escuro de meio-passo por chapa. Mascara
  // MONTADA, peca de guerra — nao osso que cresceu ali.
  b.push(box(-1.5, -11.5 - lunge, headZ + 0.5, 0.5, 0.5, 0.5, 'rust'));
  b.push(box(2, -11.5 - lunge, headZ + 0.5, 0.5, 0.5, 0.5, 'rust'));

  // Olhos entre as chapas, sob a aba da testeira: duas fendas de brasa na sombra.
  b.push(box(0, -13 - lunge, headZ + 1, 1, 1, 1, 'fire'));

  // Chifres. Nascem DENTRO da largura do cranio e sobem antes de varrer para a
  // frente: abertos para fora, como estavam, eles eram mais largos que a cabeca e
  // a silhueta virava um T.
  for (const hx of [-1, 1]) {
    b.push(box(hx, -11 - lunge, headZ + 3, 1, 1, 2, 'bone'));
    b.push(box(hx, -12 - lunge, headZ + 4, 1, 2, 1, 'bone'));
  }

  // Crina de brasa correndo do cachaco ate a garupa. Fica ATRAS da cabeca,
  // nunca por cima: coberta pela crina, a cabeca sumia dentro do fogo e o bicho
  // perdia o unico ponto que diz para onde ele esta virado.
  //
  // Na corrida ela se ABAIXA junto com a crista, e e o que faz os tres ultimos
  // frames lerem como velocidade e nao como o mesmo cavalo mais para a frente.
  // Estreita para UM voxel de largura e desce em degraus do topete ate a
  // cernelha: crista, e nao cobertor. Com 2 voxels de largura deitados sobre o
  // dorso inteiro ela era a maior area clara do bicho e roubava a leitura da
  // cabeca — a fonte do fogo tem de estar visivel, nao dominar.
  const crest = neckZ + 3 - dash;
  b.push(box(-1, -8 - lunge, crest, 2, 2, 2 + rear, 'fire'));
  b.push(box(-1, -6, crest - 1, 2, 2, 2, 'fire'));
  b.push(box(0, -4, crest - 3, 1, 3, 2, 'loot'));
  b.push(box(0, -1, crest - 5, 1, 2, 1, 'loot'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
// 72x76 e nao mais 68x72: a mascara com chifres varridos para a frente estende a
// diagonal do modelo, e o enquadramento tem de acompanhar. O ancoradouro segue a
// mesma regra de antes (centro na largura, seis pixels acima da base), entao a
// criatura continua assentando no mesmo ponto do chao.
const horseFrame = (dir, anim, f) => renderVoxels(horseModel(anim, f), DIR_INDEX[dir], 160, 168, 80, 156);

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
  // DETALHE FINO — minerio transbordando: tres torroes de meio-passo por cima
  // da carga. A ordem que ninguem cancelou era ENCHER a tremonha, e ela esta
  // alem da borda.
  b.push(box(-1.5, 3.5 + lean, 15 + up, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(0, 4 + lean, 15 + up, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(1, 3.5 + lean, 15 + up, 0.5, 0.5, 0.5, 'loot'));
  // Cabeamento exposto descendo do tronco. Azul: a corrente da grade que ainda
  // passa por ele, e que o calor faz sobrecarregar.
  b.push(box(-4, 1 + lean, 9 + up, 1, 1, 4, 'electric'));
  b.push(box(3, 2 + lean, 10 + up, 1, 1, 3, 'electric'));
  // Bracadeiras de meio-passo prendendo os cabos ao chassi: fiacao PRESA e
  // manutencao; fiacao solta e abandono. A dele esta meio a meio.
  b.push(box(-4.5, 1 + lean, 11 + up, 0.5, 1, 0.5, 'rust'));
  b.push(box(4, 2 + lean, 11 + up, 0.5, 1, 0.5, 'rust'));
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
  // A RACHADURA da placa facial: uma fissura escura de meio-passo cortando a
  // chapa palida em diagonal de dois segmentos. E o unico rosto que ele tem.
  b.push(box(0.5, -3.5 + lean, headZ + 2, 0.5, 0.5, 1, 'rust'));
  b.push(box(0, -3.5 + lean, headZ + 1.5, 0.5, 0.5, 0.5, 'rust'));
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
const minerFrame = (dir, anim, f) => renderVoxels(minerModel(anim, f), DIR_INDEX[dir], 96, 120, 48, 108);

/**
 * Upscale 2x vizinho-mais-proximo para os FX desenhados em 2D.
 *
 * Os FX nao passam pelo rasterizador voxel, entao MODEL_SCALE nao os alcanca —
 * mas o cliente desenha TODO atlas com o mesmo fator (ATLAS_SCALE), e um FX que
 * ficasse em 16x16 sairia com metade do tamanho de mundo. Dobrar por vizinho
 * preserva o desenho autorado pixel a pixel.
 */
const upscale2x = (g) => {
  const out = grid(g.w * 2, g.h * 2);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const src = (y * g.w + x) * 4;
      if (g.buf[src + 3] === 0) continue;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const dst = ((y * 2 + dy) * out.w + x * 2 + dx) * 4;
          out.buf[dst] = g.buf[src];
          out.buf[dst + 1] = g.buf[src + 1];
          out.buf[dst + 2] = g.buf[src + 2];
          out.buf[dst + 3] = g.buf[src + 3];
        }
      }
    }
  }
  return out;
};

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
// `version` sobe junto com qualquer mudanca de pixel no atlas (production spec
// §13). A subdivisao da grade (MODEL_SCALE) redesenhou TODO atlas de entidade,
// entao o piso agora e 3.
const base = (id, frameWidth, frameHeight, anchorX, anchorY, hitbox, footprint, animations, draw, prompt, version = 4) => ({
  id,
  version,
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
  base(
    'player-prospector',
    PROSPECTOR_FRAME_WIDTH,
    PROSPECTOR_FRAME_HEIGHT,
    PROSPECTOR_ANCHOR_X,
    PROSPECTOR_ANCHOR_Y,
    { w: 0.68, h: 1 },
    { w: 1, h: 1, offsetX: 0, offsetY: 0 },
    {
      ...living,
      // A caminhada do sheet completo usa a MESMA contagem de quadros das
      // camadas; a cadencia sai do mesmo calculo, no manifest da camada de baixo.
      walk: { frames: WALK_FRAMES, fps: 18.4, loop: true },
      downed: { frames: 4, fps: 6, loop: true },
      revive: { frames: 6, fps: 8, loop: false },
    },
    prospectorFrame,
    'voxel-isometric modular mining bot, digitigrade legs, boxy industrial chassis, round tactical headlamp and cyan sensor visor, rear hardpoint module, conductive cabling, extraction claw arm'
  ),
  base('enemy-stalker', 64, 64, 32, 60, { w: 0.64, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, stalkerFrame, 'voxel-isometric low red chitin predator with one mineral blade, four authored directions', 4),
  base('enemy-spitter', 64, 64, 32, 60, { w: 0.68, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, spitterFrame, 'voxel-isometric fungal amphibian, bulb eyes, acid throat, restrained neon accents', 4),
  base('enemy-spore-bomber', 64, 64, 32, 60, { w: 0.62, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, bomberFrame, 'voxel-isometric compact spore carrier, hooded silhouette, central eye and telegraphed explosive pod', 4),
  base('enemy-bruiser', 96, 136, 48, 132, { w: 0.92, h: 1.1 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 8, fps: 10, loop: false },
  }, bruiserFrame, 'voxel-isometric gorilla geode bruiser lifting a full stone block overhead, broad shoulders, pale rock plates and electric core', 4),
  base('enemy-guardian', 96, 112, 48, 108, { w: 1.36, h: 1.4 }, { w: 1.7, h: 1.7, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, guardianFrame, 'voxel-isometric mineral titan, huge pale forearms, dark torso, mask and electric chest core', 4),
  base('enemy-bishop', 112, 152, 56, 148, { w: 1.2, h: 1.9 }, { w: 1.5, h: 1.5, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 9, loop: false },
  }, bishopFrame, 'voxel-isometric fungal cleric, tall flaring vestment, tall mitre, pastoral staff and hanging censer, mycelial roots at the hem'),
  base('enemy-fungal-horse', 160, 168, 80, 156, { w: 1.4, h: 0.95 }, { w: 1.6, h: 1.2, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, horseFrame, 'voxel-isometric fungal warhorse, long low body, ember mane and crest, split hooves, shelf-fungus armor plates', 4),
  base('enemy-miner', 96, 120, 48, 108, { w: 0.92, h: 1.5 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, living, minerFrame, 'voxel-isometric abandoned mining automaton, hunched under its load, long arms, cracked faceplate, shoulder lamp, exposed conductive wiring, refitted pickaxe'),
  {
    id: 'fx-projectile-bolt', version: 3, frameWidth: 32, frameHeight: 32, anchorX: 16, anchorY: 16,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0.2, h: 0.2 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { fly: { frames: 4, fps: 16, loop: true } },
    draw: (dir, anim, f) => upscale2x(boltFrame(dir, anim, f)),
    prompt: 'small cyan voxel energy bolt',
  },
  {
    id: 'fx-impact-burst', version: 3, frameWidth: 32, frameHeight: 32, anchorX: 16, anchorY: 16,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0, h: 0 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { burst: { frames: 5, fps: 14, loop: false } },
    draw: (dir, anim, f) => upscale2x(impactFrame(dir, anim, f)),
    prompt: 'small cyan voxel impact ring',
  },
];
