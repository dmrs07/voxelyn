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
  b.push(box(-2.5, -2.5, 4.5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  b.push(box(2, -2.5, 4.5 + z, 0.5, 0.5, 0.5, 'fungusDeep'));
  // BOCA LARGA (o unico legado da tentativa de redesign que ficou): a fenda
  // escura atravessando a frente do corpo, sob a garganta. O anfibio e quase
  // todo boca, e sem ela o corpo lia como bloco.
  b.push(box(-2.5, -2.5, 3.5 + z, 5.5, 0.5, 0.5, 'fungusDeep'));
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

  // A LEITURA DA FICHA (concept MIN-07): um gorila de pedra AGACHADO. A
  // silhueta e um morro largo — punhos-montanha palidos PLANTADOS NO CHAO nas
  // duas pontas, corcunda dorsal palida no alto, e o centro escuro quase
  // sumido entre eles, com o geodo aceso no peito. A versao anterior tinha
  // bracos-palito pendurados e pernas a mostra: lia como robo caixote.

  // Pernas curtas e escuras, meio ENGOLIDAS pelo corpo: quem anda por ele sao
  // os nos dos dedos, e as pernas so aparecem no vao entre os punhos.
  b.push(box(-2.5, -1, Math.max(0, step), 2, 3, 4, 'rockDeep'));
  b.push(box(0.5, -1, Math.max(0, -step), 2, 3, 4, 'rockDeep'));

  // Torso escuro estreitando para BAIXO: a massa do bicho fica em cima.
  b.push(box(-2.5, -2, 3 + up, 5, 4, 3, 'rockDeep'));
  b.push(box(-3, -2.5, 6 + up, 6, 5, 5, 'rockDeep'));

  // NUCLEO-GEODO radial: o bloco emissivo no peito e quatro raios de
  // meio-passo rachando a pedra em volta — "acentos eletricos pulsam
  // continuamente em emissao" (detalhe critico da ficha). Os raios sao
  // FINOS e curtos: rachadura conduzindo luz, nao um segundo nucleo.
  b.push(box(-1.5, -3, 7.5 + up, 3, 1, 3, 'electric'));
  b.push(box(-0.5, -3, 6.5 + up, 1, 0.5, 1, 'electric'));
  b.push(box(-0.5, -3, 10.5 + up, 1, 0.5, 1, 'electric'));
  b.push(box(-2.5, -3, 8.5 + up, 1, 0.5, 1, 'electric'));
  b.push(box(1.5, -3, 8.5 + up, 1, 0.5, 1, 'electric'));

  // COROA DORSAL palida: a corcunda de pedra clara que fecha o alto da
  // silhueta, mais alta ATRAS — e ela que da o perfil de gorila. Calombos de
  // meio-passo quebram o contorno reto em pedra empilhada.
  b.push(box(-3.5, -1, 11 + up + heave, 7, 4, 3, 'bone'));
  b.push(box(-2.5, 0, 14 + up + heave, 5, 3, 1.5, 'bone'));
  b.push(box(-3, -1.5, 13.5 + up + heave, 1, 1, 1, 'bone'));
  b.push(box(2, -0.5, 13.5 + up + heave, 1, 1, 1, 'bone'));
  b.push(box(-0.5, 1.5, 15.5 + up + heave, 1, 1, 0.5, 'bone'));

  // Cabeca MINUSCULA e escura, afundada na frente da coroa: o visor de fenda
  // e o unico rosto que a ficha mostra — o Britador quase nao tem cabeca.
  b.push(box(-1, -2, 11 + up, 2, 2, 1.5, 'rockDeep'));
  b.push(box(-1, -2.5, 11.5 + up, 2, 0.5, 0.5, 'biolum'));

  // BRACOS-MONTANHA: ombro alto colado na coroa, antebraco descendo por fora
  // e punho ENORME plantado no chao. Sao a linha mais larga do bicho e o que a
  // silhueta da ficha mostra primeiro. No walk os punhos alternam com as
  // pernas (andar de nos dos dedos); no attack sobem e ESMAGAM; no special
  // sobem juntos sustentando a pedra. Flinch e crouch movem o CORPO — punho
  // plantado fica plantado, que e o que faz o bicho parecer ancorado no chao.
  const armRaise = anim === 'special' ? Math.min(10, hurlLift) : slam;
  const fistL = armRaise + (anim === 'walk' ? Math.max(0, -step) : 0);
  const fistR = armRaise + (anim === 'walk' ? Math.max(0, step) : 0);
  for (const [side, fist] of [[-1, fistL], [1, fistR]]) {
    const ox = side < 0 ? -6 : 3.5; // ombro
    const fx = side < 0 ? -7.5 : 4.5; // punho
    const ax = side < 0 ? -7 : 5; // antebraco
    b.push(box(ox, -2, 8 + up + armRaise + heave, 2.5, 4, 4, 'bone'));
    b.push(box(ax, -1.5, fist + 2 + heave, 2.5, 3.5, 7, 'bone'));
    b.push(box(fx, -2, fist, 3, 4, 3, 'bone'));
    // Sulcos dos dedos: duas fendas de pedra media na face frontal do punho —
    // a mao fechada le como mao, nao como bloco.
    b.push(box(fx + 0.5, -2.5, fist + 0.5, 0.5, 0.5, 2, 'rock'));
    b.push(box(fx + 1.5, -2.5, fist + 0.5, 0.5, 0.5, 2, 'rock'));
  }

  if (anim === 'special' && !hurlThrow) {
    const rockZ = 5 + hurlLift;
    // A MESMA pedra que voa (ProjectileView): corpo de rocha com TAMPA palida
    // de osso — a pedra-placa dos ombros do proprio Britador. O bloco erguido
    // e o projetil tem de ser um objeto so, senao o telegraph ensina uma coisa
    // e o voo cobra outra.
    b.push(box(-3, -2, rockZ, 7, 5, 3.5, hurlHold ? 'rock' : 'rockDeep'));
    b.push(box(-3, -2, rockZ + 3.5, 7, 5, 0.5, 'bone'));
    b.push(box(-2, -3, rockZ + 2, 5, 1, 2, 'rock'));
    // A CARGA aparece na pausa em tensao: faiscas eletricas de meio-passo
    // crepitando no bloco durante o hold — a corrente do nucleo-geodo subindo
    // pela pedra e o mesmo azul que vai orbitar o projetil. O telegraph deixa
    // de ser so "pedra no alto" e passa a ser "pedra ARMANDO".
    if (hurlHold) {
      b.push(box(-3.5, -1.5, rockZ + 1, 0.5, 0.5, 1, 'electric'));
      b.push(box(4, -1, rockZ + 2, 0.5, 0.5, 1, 'electric'));
      b.push(box(0, -3.5, rockZ + 2.5, 0.5, 0.5, 0.5, 'electric'));
      b.push(box(-1, -2.5, rockZ + 4, 1, 0.5, 0.5, 'electric'));
    }
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bruiserFrame = (dir, anim, f) => renderVoxels(bruiserModel(anim, f), DIR_INDEX[dir], 96, 136, 44, 124);

// ---------------------------------------------------------------------------
// enemy-guardian 96x112 — a cidadela-montanha que anda (concept ANOMALIA
// TERMINAL)
//
// A ficha nao mostra um humanoide: mostra um MACICO triangular de rocha escura
// coroado por torres-cogumelo, com um nucleo redondo e difuso aceso no meio da
// face, patas-coluna rastejando por baixo da saia e garras de dominio na base.
// "A massa e os bracos indicam dominio de area; o nucleo luminoso e o unico
// foco saturado."
//
// A distincao com o Britador continua, mas por FORMA e nao por eixo: o
// Britador e um gorila com dois punhos plantados e o centro vazado; o Guardiao
// e UMA massa continua, mais larga que alta ate a linha do cume — e sao as
// torres que devolvem a altura de chefe final.
// ---------------------------------------------------------------------------
const guardianModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  const swing = anim === 'attack' ? [0, 1, 3, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // `special` = invocacao: o nucleo se abre e a montanha inteira se ergue
  const call = anim === 'special' ? [0, 1, 1, 1][f % 4] : 0;
  // Idle vivo: o nucleo se dilata e as garras sobem meio voxel — uma montanha
  // respira pelo que tem de vivo, nao pela pedra.
  const breath = anim === 'idle' ? [0, 0, 1, 0][f % 4] : 0;
  const up = -flinch + call;
  const b = [];

  // HIERARQUIA DE CHEFE: o Guardiao tem de ser maior E mais complexo que o
  // Britador em toda medida que o olho pega — o canvas dele e o unico 112x128
  // do bestiario, o maciço e mais largo que o gorila de punhos plantados, o
  // cume sobe mais alto que qualquer outra silhueta, e a contagem de pecas
  // (seis patas, sete torres, franja, garras de duas unhas) nao existe em
  // nenhum inimigo menor.

  // Patas-coluna: SEIS tocos blindados rastejando sob a saia. Aparecem no
  // vao entre a base e o chao — a cidadela nao flutua, ela RASTEJA.
  b.push(box(-7, -2, Math.max(0, step), 2.5, 3, 3, 'rockDeep'));
  b.push(box(-4, -2.5, Math.max(0, -step), 2.5, 3.5, 3, 'rockDeep'));
  b.push(box(-1, -2, Math.max(0, step), 2, 3, 3, 'rockDeep'));
  b.push(box(1, -2.5, Math.max(0, -step), 2.5, 3.5, 3, 'rockDeep'));
  b.push(box(4, -2, Math.max(0, step), 2.5, 3, 3, 'rockDeep'));
  b.push(box(6.5, -2.5, Math.max(0, -step), 2, 3, 3, 'rockDeep'));

  // O macico: CINCO andares que estreitam para cima, escuro e medio
  // alternados, para cada andar ler como estrato e nao como caixa empilhada.
  b.push(box(-8.5, -2.5, 2 + up, 17, 6, 3, 'rockDeep'));
  b.push(box(-7.5, -2, 5 + up, 15, 5.5, 3, 'rock'));
  b.push(box(-6, -1.5, 8 + up, 12, 5, 3, 'rockDeep'));
  b.push(box(-4.5, -1, 11 + up, 9, 4, 3, 'rock'));
  b.push(box(-3, -0.5, 14 + up, 6, 3.5, 2, 'rockDeep'));

  // Franja de estalactites pendurada na borda dianteira da base: a rocha
  // escorreu e congelou. E o tipo de ruido de contorno que so um chefe tem
  // orcamento de silhueta para carregar.
  for (const fx of [-7, -4.5, -2, 0.5, 3, 5.5]) {
    b.push(box(fx, -3, 1.5 + up, 0.5, 0.5, 1, 'rockDeep'));
  }

  // Escleroticos: placas palidas aflorando nas encostas, e oxido escorrendo
  // de baixo das torres — mais numerosos que em qualquer inimigo menor.
  b.push(box(-6.5, -3, 5.5 + up, 2, 0.5, 1.5, 'bone'));
  b.push(box(4, -3, 6 + up, 2, 0.5, 1.5, 'bone'));
  b.push(box(-4.5, -2.5, 9 + up, 1.5, 0.5, 1.5, 'bone'));
  b.push(box(2.5, -2.5, 8.5 + up, 2, 0.5, 1, 'bone'));
  b.push(box(-2, -1.5, 12 + up, 1.5, 0.5, 1, 'bone'));
  b.push(box(-1, -1, 14.5 + up, 1, 0.5, 1.5, 'rust'));
  b.push(box(-5.5, -2.5, 7.5 + up, 1, 0.5, 1, 'rust'));
  b.push(box(3.5, -2, 11.5 + up, 1, 0.5, 1, 'rust'));

  // NUCLEO redondo e difuso, alto na face da montanha: tres lajes emissivas
  // com larguras alternadas — o degrade de largura da a leitura de esfera
  // brilhando atraves da pedra — e QUATRO rachaduras radiais de meio-passo
  // conduzindo a luz pela rocha. Dilata no special, respira no idle, e e o
  // unico foco saturado do bicho inteiro.
  b.push(box(-2.5, -3, 7 + up, 5, 1, 5 + call + breath, 'electric'));
  b.push(box(-2, -3.5, 7.5 + up, 4, 0.5, 4 + call + breath, 'electric'));
  b.push(box(-3, -2.5, 8.5 + up, 6, 0.5, 2.5 + call, 'electric'));
  b.push(box(-0.5, -3, 12.5 + up, 1, 0.5, 1, 'electric'));
  b.push(box(-0.5, -3, 5.5 + up, 1, 0.5, 1, 'electric'));
  b.push(box(-4.5, -3, 9 + up, 1.5, 0.5, 0.5, 'electric'));
  b.push(box(3, -3, 9.5 + up, 1.5, 0.5, 0.5, 'electric'));

  // TORRES-COGUMELO no cume: SETE agulhas de oxido com chapeu palido, subindo
  // para o pinaculo central — que carrega um remate dourado. E a coroa da
  // cidadela: a silhueta mais alta do jogo, e so dele.
  const spires = [
    [-7, 0.5, 7, 2.5],
    [-5.5, 0, 9, 3],
    [-3.5, 0.5, 12, 4],
    [-1, 0, 15, 5],
    [1.5, 0.5, 13, 4],
    [4, 0, 10, 3.5],
    [6, 0.5, 7.5, 2.5],
  ];
  for (const [sx, sy, zb, h] of spires) {
    b.push(box(sx, sy, zb + up, 1, 1, h, 'rust'));
    b.push(box(sx - 0.5, sy - 0.5, zb + h + up, 2, 2, 1, 'bone'));
  }
  b.push(box(-1, 0, 21 + up, 0.5, 0.5, 1, 'loot'));

  // GARRAS DE DOMINIO: dois bracos-toco blindados na frente da base, cada um
  // com DUAS unhas palidas. Sobem no swing do attack — a varrida que sela o
  // espaco — e respiram no idle.
  b.push(box(-8.5, -3.5, 2 + up + swing + breath, 3, 2.5, 3.5, 'rock'));
  b.push(box(5.5, -3.5, 2 + up + swing + breath, 3, 2.5, 3.5, 'rock'));
  b.push(box(-8, -4, 2 + up + swing + breath, 1, 0.5, 1, 'bone'));
  b.push(box(-6.5, -4, 2 + up + swing + breath, 1, 0.5, 1, 'bone'));
  b.push(box(6, -4, 2 + up + swing + breath, 1, 0.5, 1, 'bone'));
  b.push(box(7.5, -4, 2 + up + swing + breath, 1, 0.5, 1, 'bone'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const guardianFrame = (dir, anim, f) => renderVoxels(guardianModel(anim, f), DIR_INDEX[dir], 112, 128, 52, 116);


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
  // `special` = Supernova Fungica: ele SE ERGUE e a cortina ABRE antes do
  // estouro. O crescimento e o telegrafo, e nao um efeito posterior.
  const nova = anim === 'special' ? [0, 1, 2, 3, 3, 2][f % 6] : 0;
  const up = breathe - flinch + nova;
  const b = [];

  // A LEITURA DA FICHA (concept EQ-09): o manto nao e uma torre de degraus —
  // e uma CORTINA DE RAIZES em decomposicao que cai dos ombros e encontra o
  // chao esfiapada, com bracos abertos em bencao, baculo de disco-aureola,
  // coroa quitinosa e cogumelos brotando na bainha. E a altura fecha ABAIXO do
  // pinaculo do Guardiao: chefe de setor 2 nao passa do chefe final — a
  // hierarquia e por tamanho E por forma (cortina fina contra montanha).

  // Raizes de micelio no chao, saindo de baixo da cortina. Desenhadas primeiro
  // para ficarem sob tudo. Sao IDENTIDADE, nao sinal: quem avisa que a cura
  // esta acontecendo AGORA e a particula do evento `heal`.
  for (const [rx, ry] of BISHOP_ROOTS) {
    if (nova === 0 && (rx + ry) % 3 === 0) continue; // esparsas em repouso
    b.push(box(rx, ry, 0, 1, 1, 1, 'electric'));
  }

  // Cogumelos na bainha: brotos de meio-passo com chapeu palido, no arco onde
  // a cortina toca o chao. Tres, e nao um tapete — o tapete e o chao do mapa.
  for (const [mx, my] of [[-4.5, -4], [3.5, -4.5], [5, -2]]) {
    b.push(box(mx, my, 0, 0.5, 0.5, 1, 'rust'));
    b.push(box(mx - 0.5, my - 0.5, 1, 1, 1, 0.5, 'bone'));
  }

  // NUCLEO da batina: coluna escura solida por dentro da cortina. E ela que
  // aparece nos vaos entre os fiapos — sombra sob o manto, nunca o fundo.
  b.push(box(-3, -2.5, 1, 6, 5, 12, 'rockDeep'));
  b.push(box(-2, -2, 13, 4, 4, 2, 'rust'));

  // CORTINA DE RAIZES: fiapos verticais pendurados do ombro, alternando
  // tecido em decomposicao (ferrugem) e micelio (osso), com bainhas em alturas
  // VARIADAS — o esfiapado e a identidade. Na Supernova a cortina abre: cada
  // fio desloca para fora junto com o corpo que se ergue.
  const strands = [
    [-4.5, -3, 1, 'rust'],
    [-3.5, -3.5, 0, 'bone'],
    [-2.5, -3.5, 2, 'rust'],
    [-1.5, -4, 0, 'rust'],
    [-0.5, -4, 1, 'bone'],
    [0.5, -4, 0, 'rust'],
    [1.5, -3.5, 2, 'bone'],
    [2.5, -3.5, 0, 'rust'],
    [3.5, -3, 1, 'rust'],
    [-5, -1, 0, 'rust'],
    [4.5, -1.5, 0, 'bone'],
    [-5, 1.5, 1, 'rust'],
    [4.5, 1, 0, 'rust'],
  ];
  for (const [sx0, sy0, zb, mat] of strands) {
    const flare = nova * 0.5 * Math.sign(sx0 || 1);
    b.push(box(sx0 + flare, sy0, zb, 1, 1, 13 - zb, mat));
  }

  // Estola dourada descendo pelo centro da cortina, com o MEDALHAO circular
  // do peito por cima: e o que faz o olho subir ate a coroa.
  b.push(box(-0.5, -4.5, 2.5, 1.5, 0.5, 9, 'loot'));
  b.push(box(-1, -5, 10.5, 2, 0.5, 2, 'loot'));
  b.push(box(-0.5, -5.5, 11, 1, 0.5, 1, 'electric'));

  // BRACOS ABERTOS em bencao: mangas horizontais com fiapos pendurados.
  // `raise` e a nova os erguem — o gesto do telegrafo e o proprio corpo.
  b.push(box(-6.5, -2, 12 + up + raise, 3, 2, 1.5, 'rust'));
  b.push(box(3.5, -2, 12 + up + raise, 3, 2, 1.5, 'rust'));
  b.push(box(-6, -2, 9.5 + up + raise, 0.5, 1, 2.5, 'rust'));
  b.push(box(-5, -2.5, 10 + up + raise, 0.5, 1, 2, 'bone'));
  b.push(box(5, -2, 9.5 + up + raise, 0.5, 1, 2.5, 'rust'));
  b.push(box(6, -2.5, 10.5 + up + raise, 0.5, 1, 1.5, 'bone'));

  // Turibulo pendurado da mao esquerda, com brasa viva e corrente de elos.
  b.push(box(-6.5, -1.5, 7 + up + raise, 2, 2, 2, 'loot'));
  b.push(box(-6, -0.5, 5.5 + up + raise, 1, 1, 1.5, 'fire'));
  b.push(box(-6, -1, 9.5 + up + raise, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(-5.5, -1, 10.5 + up + raise, 0.5, 0.5, 0.5, 'loot'));

  // BACULO na mao direita, AFASTADO do corpo, com cabeca em DISCO-AUREOLA:
  // um aro dourado vazado com o olho eletrico no centro — o simbolo da ficha,
  // e o vao dentro do aro e o que o separa da coroa.
  b.push(box(7, -1.5, 1, 0.5, 0.5, 16.5 + sway, 'loot'));
  b.push(box(6.5, -1.5, 17.5 + sway, 2, 0.5, 0.5, 'loot'));
  b.push(box(6.5, -1.5, 19.5 + sway, 2, 0.5, 0.5, 'loot'));
  b.push(box(6, -1.5, 18 + sway, 0.5, 0.5, 1.5, 'loot'));
  b.push(box(8, -1.5, 18 + sway, 0.5, 0.5, 1.5, 'loot'));
  b.push(box(7, -1.5, 18.25 + sway, 0.5, 0.5, 1, 'electric'));

  // GOLA, cabeca pequena e COROA QUITINOSA de tres pontas com remate dourado.
  // A coroa e quem fecha a silhueta — e fecha ABAIXO do pinaculo do chefe.
  b.push(box(-2.5, -2.5, 15 + up, 5, 5, 1, 'bone'));
  b.push(box(-1, -2, 16 + up, 2, 3, 2, 'rust'));
  b.push(box(-1, -2.5, 17 + up, 2, 0.5, 0.5, 'electric'));
  b.push(box(-1.5, -2.5, 18 + up, 3, 4, 1, 'bone'));
  b.push(box(-1.5, -2, 19 + up, 0.5, 1, 1, 'bone'));
  b.push(box(0, -2.5, 19 + up, 0.5, 1, 1, 'bone'));
  b.push(box(1, -2, 19 + up, 0.5, 1, 1, 'bone'));
  b.push(box(0, -2, 20 + up, 0.5, 0.5, 0.5, 'loot'));

  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bishopFrame = (dir, anim, f) => renderVoxels(bishopModel(anim, f), DIR_INDEX[dir], 112, 124, 52, 108);

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
  // Cauda de hifas caindo atras — com a ponta em BRASA: a garupa do concept
  // queima, e a cauda e o unico lugar onde o fogo pode aparecer atras sem
  // encostar no corpo neutro ("o laranja e reservado ao rastro e a combustao").
  b.push(box(-1 + swish, 7, backZ, 2, 2, 4, 'rockDeep'));
  b.push(box(-0.5 + swish, 7.5, backZ + 3.5, 1, 1, 1.5, 'fire'));

  // BARDA ORGANICA nos flancos (concept EQ-02): a ficha veste o Corcel de
  // guerra cerimonial — abas de placa drapejadas descendo do dorso sobre o
  // barril, com bordas escalonadas, e um MEDALHAO circular dourado no centro
  // de cada flanco. Substitui as placas de fungo de prateleira: o que cresce
  // nele agora e ARREIO, e arreio sem operador e exatamente o arrepio que a
  // ficha pede. As abas caem POR CIMA da linha das pernas, como caparazao.
  for (const side of [-1, 1]) {
    const px = side < 0 ? -3 : 2;
    // aba dianteira e aba traseira, com bainhas em alturas diferentes
    b.push(box(px, -3.5, backZ - 2, 1, 2.5, 3, 'rust'));
    b.push(box(px, 0, backZ - 2.5, 1, 2.5, 3.5, 'rust'));
    // recorte escalonado da bainha: um dente de meio-passo por aba
    b.push(box(px, -1.5, backZ - 3, 1, 0.5, 0.5, 'rust'));
    b.push(box(px, 2, backZ - 3, 1, 0.5, 0.5, 'rust'));
    // medalhao dourado saliente no centro do flanco
    b.push(box(side < 0 ? -3.5 : 3, -0.5, backZ - 0.5, 0.5, 1.5, 1.5, 'loot'));
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
  // Crista do chanfrao: uma barbatana de meio-passo subindo da testeira, no
  // eixo — "a crista e a postura alongam a direcao da carga".
  b.push(box(0, -12.5 - lunge, headZ + 3, 0.5, 1.5, 0.5, 'bone'));
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

// ---------------------------------------------------------------------------
// BESTIARIO DE ASSINATURA — um inimigo por estrato, e cada silhueta diz qual
// alavanca do bioma ele opera: o Ressonante e cristal, a Lampreia e lodo, o
// Fole e um orgao de ar, o Escoriaceo e escoria com nucleo vivo, o Espectro e
// gelo palido. Nenhum introduz material novo: as rampas ja existem.
// ---------------------------------------------------------------------------

// enemy-resonant 64x64 — nodulo mineral lento coroado de cristais vivos.
// A leitura que importa: os CRISTAIS sao a arma, nao o corpo. No idle eles
// pulsam devagar; no attack (o pulso que arma a sala) eles crescem e acendem.
const resonantModel = (anim, f) => {
  const gait = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const hum = anim === 'idle' ? [0, 0, 1, 0][f % 4] : 0;
  const surge = anim === 'attack' ? [1, 2, 3, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // Dois cotos de rocha como pes: ele mal anda, e a marcha e um balanco.
  b.push(box(-2, -1, Math.max(0, gait), 2, 2, 2, 'rockDeep'));
  b.push(box(1, -1, Math.max(0, -gait), 2, 2, 2, 'rockDeep'));
  // Corpo: um nodulo de rocha escura, mais largo que alto.
  b.push(box(-3 + flinch, -2, 2, 6, 4, 3, 'rock'));
  b.push(box(-2 + flinch, -2, 5, 4, 3, 1, 'rockDeep'));
  // Fissuras de energia no flanco: o nucleo aparece pelas juntas.
  b.push(box(-3 + flinch, 0, 3, 0.5, 1, 1, 'electric'));
  b.push(box(2.5 + flinch, -1, 3.5, 0.5, 1, 0.5, 'electric'));
  // A coroa de cristais: tres lascas que pulsam (idle) e crescem (attack).
  const spike = hum + surge;
  b.push(box(-2, -1, 6, 1, 1, 2 + spike, 'electric'));
  b.push(box(0, 0, 6, 1, 1, 3 + spike, 'electric'));
  b.push(box(1.5, -1.5, 6, 1, 1, 2 + Math.max(0, spike - 1), 'electric'));
  // No pico do pulso, um anel baixo de estilhacos ao redor do corpo.
  if (surge >= 2) {
    b.push(box(-4, -1, 2, 1, 1, 1, 'electric'));
    b.push(box(3, -1, 2, 1, 1, 1, 'electric'));
    b.push(box(0, -3.5, 2, 1, 1, 1, 'electric'));
    b.push(box(0, 2.5, 2, 1, 1, 1, 'electric'));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const resonantFrame = (dir, anim, f) => renderVoxels(resonantModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-mud-lamprey 64x64 — serpente de lodo, baixa e comprida, ondulando.
// Quase todo o tempo de jogo ela esta SUBMERSA (o cliente desenha ondulacao,
// nao este sprite); este corpo aparece no bote e quando encalha — entao a
// silhueta precisa dizer na hora "aquilo que morava na agua".
const mudLampreyModel = (anim, f) => {
  const lunge = anim === 'attack' ? [0, 0.5, 1.5, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // A ondulacao NUNCA para: e um corpo de agua mesmo fora dela. No idle a fase
  // anda devagar; na caminhada, com o passo.
  const b = [];
  for (let s = 0; s < 5; s++) {
    // Onda discreta em meia-grade: anda com o frame na caminhada e respira
    // devagar no idle (a lampreia nunca fica rigida — e um corpo de agua).
    const phase =
      anim === 'walk'
        ? Math.round(Math.sin((s + f) * 1.1)) * 0.5
        : anim === 'idle'
          ? ((s + f) % 2) * 0.5
          : (s % 2) * 0.5;
    const x = -3 + s * 1.3 + (s >= 3 ? lunge : 0);
    const height = s === 4 ? 2.5 : 2;
    b.push(box(x, -1 + phase, 0.5 + flinch * 0.3, 1.3, 2, height, 'pool'));
    // Barbatana dorsal serrilhada: meia lamina por segmento.
    b.push(box(x + 0.2, -0.5 + phase, 0.5 + height, 0.8, 1, 0.5, 'fungusDeep'));
  }
  // Cabeca: boca circular de lampreia — um anel claro com o miolo escuro.
  const hx = 2 + lunge;
  b.push(box(hx, -1.5, 0.5, 1.6, 3, 2.8, 'pool'));
  b.push(box(hx + 1.2, -1, 1, 0.6, 2, 1.8, 'bone'));
  b.push(box(hx + 1.5, -0.5, 1.4, 0.4, 1, 1, 'blood'));
  // Olhos bioluminescentes: o unico brilho — e o que a ondulacao promete.
  b.push(box(hx + 0.4, -1.6, 2.8, 0.6, 0.6, 0.6, 'biolum'));
  b.push(box(hx + 0.4, 1, 2.8, 0.6, 0.6, 0.6, 'biolum'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const mudLampreyFrame = (dir, anim, f) => renderVoxels(mudLampreyModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-bellows 64x64 — o Fole: um saco de ar com costelas de osso.
// O ciclo inteiro do bicho e RESPIRACAO, entao o idle e a mecanica: o saco
// infla e murcha. No attack ele se espreme — e o sopro que contamina a rota.
const bellowsModel = (anim, f) => {
  const breath = anim === 'idle' || anim === 'walk' ? [0, 1, 2, 1][f % 4] : 0;
  const squeeze = anim === 'attack' ? [0, 1, 2, 1][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const gait = anim === 'walk' ? [0, 1, 0, -1, 0, 1][f % 6] : 0;
  const b = [];
  // Pes atarracados de ferrugem: ele mal sai do lugar.
  b.push(box(-2.5, -1, Math.max(0, gait), 2, 2, 1.5, 'rust'));
  b.push(box(0.5, -1, Math.max(0, -gait), 2, 2, 1.5, 'rust'));
  // O saco: largo quando cheio, espremido e baixo no sopro.
  const sw = 6 + breath - squeeze * 1.5;
  const sh = 4 + breath - squeeze;
  b.push(box(-sw / 2 + flinch, -2, 1.5, sw, 4, sh, 'sulfur'));
  // Costelas de osso vergadas por cima do saco: a gaiola que o espreme.
  for (let r = 0; r < 3; r++) {
    b.push(box(-sw / 2 + 0.5 + r * (sw / 3), -2.2, 1.5, 0.8, 4.4, sh + 0.5, 'bone'));
  }
  // Boca-valvula frontal; no sopro, um jato de grao sulfuroso sai dela.
  b.push(box(sw / 2 - 0.5 + flinch, -0.8, 2.5, 1.2, 1.6, 1.6, 'rust'));
  if (squeeze >= 1) {
    for (let p = 0; p < 1 + squeeze; p++) {
      b.push(box(sw / 2 + 0.8 + p * 1, -0.6 + (p % 2) * 0.8, 2.5 + p * 0.4, 0.8, 0.8, 0.8, 'acid'));
    }
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const bellowsFrame = (dir, anim, f) => renderVoxels(bellowsModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-scoriac 64x64 — besouro de escoria: placas frias por fora, brasa viva
// por dentro. A MECANICA esta na silhueta: as placas escondem o nucleo; o
// attack (e o estado quente) as abre e o fogo aparece pelas frestas.
const scoriacModel = (anim, f) => {
  const gait = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const open = anim === 'attack' ? [0, 1, 2, 1][f % 4] : 0;
  // Idle vivo: as placas SOBEM meio voxel e assentam — o nucleo respira calor
  // por baixo da couraça, e a fresta que pisca e o aviso do que ha dentro.
  const vent = anim === 'idle' ? [0, 0.5, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // Seis patas curtas, aos pares. `rockDeep`, e nao `scorch`: a rampa do
  // carvao e toda escura e sumia contra o chao da Fornalha — a silhueta
  // precisa existir ANTES de o jogador ler o nucleo.
  for (let s = -1; s <= 1; s++) {
    b.push(box(s * 2 - 0.5, -2.5, Math.max(0, s % 2 === 0 ? gait : -gait), 1, 1, 2, 'rockDeep'));
    b.push(box(s * 2 - 0.5, 1.5, Math.max(0, s % 2 === 0 ? -gait : gait), 1, 1, 2, 'rockDeep'));
  }
  // O nucleo de brasa: SEMPRE presente, visivel pelo vao entre as placas.
  b.push(box(-2.5 + flinch, -1.5, 2, 5, 3, 2, 'fire'));
  // Placas dorsais de escoria: duas metades que se afastam quando ele abre.
  // Rocha escura com a borda carbonizada — o scorch entra como DETALHE, nunca
  // como a placa inteira.
  b.push(box(-3 - open + flinch, -2, 3.5 + vent, 3, 4, 1.5, 'rockDeep'));
  b.push(box(0.5 + open + flinch, -2, 3.5 + vent, 3, 4, 1.5, 'rockDeep'));
  b.push(box(-3 - open + flinch, -2, 5 + vent, 1, 4, 0.5, 'scorch'));
  b.push(box(2.5 + open + flinch, -2, 5 + vent, 1, 4, 0.5, 'scorch'));
  // Placa frontal menor: a "testa" que ele abaixa para investir.
  b.push(box(-1 + flinch, -2.6, 2.5, 2, 1, 1.5, 'rockDeep'));
  // Fresta dorsal: com as placas abertas, uma crista de brasa sobe no vao.
  if (open >= 1) b.push(box(-0.5 + flinch, -1, 4, 1, 2, 1 + open * 0.5, 'fire'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const scoriacFrame = (dir, anim, f) => renderVoxels(scoriacModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-frost-wraith 64x64 — o Espectro de Geada: um risco palido e raso.
// Ele passa o jogo SOB o gelo (o cliente desenha a trilha de rachaduras);
// este corpo e o bote e o encalhe — um peixe-lamina de gelo leitoso.
const frostWraithModel = (anim, f) => {
  const rise = anim === 'attack' ? [0, 1, 3, 2][f % 4] : 0;
  const glide =
    anim === 'walk' ? [0, 0.5, 1, 0.5, 0, -0.5][f % 6] : anim === 'idle' ? [0, 0.5, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // Corpo raso e comprido, afinando para tras: quatro segmentos de gelo.
  for (let s = 0; s < 4; s++) {
    const x = -4 + s * 2;
    const d = 3 - s * 0.5;
    b.push(box(x, -d / 2 + glide * (s % 2 === 0 ? 0.4 : -0.4), 0.5 + rise * (s >= 2 ? 0.6 : 0.2) + flinch * 0.3, 2, d, 1.5, 'ice'));
  }
  // Nadadeira dorsal translucida — a lamina que corta o gelo por baixo.
  b.push(box(-1, -0.4, 2 + rise * 0.6, 3, 0.8, 1.5 + rise * 0.5, 'ice'));
  // Cabeca em cunha, com dois olhos de corrente: o unico ponto que brilha.
  b.push(box(3.4, -1.2 + glide * 0.3, 0.8 + rise, 2, 2.4, 1.6, 'ice'));
  b.push(box(4.6, -1.2 + glide * 0.3, 1.8 + rise, 0.6, 0.6, 0.6, 'electric'));
  b.push(box(4.6, 0.6 + glide * 0.3, 1.8 + rise, 0.6, 0.6, 0.6, 'electric'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const frostWraithFrame = (dir, anim, f) => renderVoxels(frostWraithModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-sulfur-bomber 64x64 — a MESMA silhueta do Spore Bomber, outra quimica.
//
// Igual de proposito: o jogador ja aprendeu a ler "encapuzado com pod atras =
// vem correndo e estoura", e essa licao nao pode ser cobrada duas vezes. O que
// muda e a MATERIA — capuz de osso mineral crostado em vez de fungo, pod de
// enxofre em vez de esporo, e cristais de enxofre condensado onde o outro tem
// lamelas. Quem ve isto sabe o que vem; o que ele precisa saber a mais e que a
// nuvem que sobra PEGA FOGO, e a cor amarela e quem diz isso.
const sulfurBomberModel = (anim, f) => {
  const drift = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const swell = anim === 'special' ? Math.min(2, f) : anim === 'attack' ? [0, 1, 1, 0][f % 4] : 0;
  const pulse = anim === 'idle' ? [0, 1, 1, 0][f % 4] : 0;
  const z = -flinch + drift;
  const b = [];
  // Pes curtos de rocha crostada: ele tambem pende mais do que caminha.
  b.push(box(-2, -1, 0, 2, 2, 1, 'rockDeep'));
  b.push(box(1, -1, 0, 2, 2, 1, 'rockDeep'));
  // Capuz conico ESCURO, com o cone afinando depressa.
  //
  // Duas tentativas erradas antes desta, e as duas ensinaram a mesma coisa
  // sobre hierarquia. Na primeira o pod era grande demais e virava a silhueta
  // (topo `loot`, o dourado de maior amplitude da paleta, contra um corpo que
  // sumia no fundo). Na segunda o capuz virou OSSO para ganhar presenca — e
  // ai corpo e pod ficaram os dois claros, sem nada separando um do outro: a
  // criatura lia como uma escadaria de degraus bege.
  //
  // O Spore Bomber resolve isso ha muito tempo e a resposta e a dele: capuz
  // ESCURO (a forma), acento CLARO (o pod). Aqui o escuro e mineral em vez de
  // organico, que e justamente a troca que este bicho representa.
  b.push(box(-3, -2, 1 + z, 6, 4, 2, 'rockDeep'));
  b.push(box(-2, -1.5, 3 + z, 4, 3, 2, 'rockDeep'));
  b.push(box(-1, -1, 5 + z, 2, 2, 2, 'rockDeep'));
  b.push(box(-0.5, -0.5, 7 + z, 1, 1, 1, 'rust'));
  // Onde o outro tem lamelas de fungo, este tem CROSTA: agulhas de enxofre
  // condensado crescidas na borda de cada degrau.
  b.push(box(-2.5, -2.5, 2 + z, 0.5, 0.5, 1, 'sulfur'));
  b.push(box(1, -2.5, 1.5 + z, 0.5, 0.5, 1, 'sulfur'));
  b.push(box(-1.5, -2.5, 4 + z, 0.5, 0.5, 0.5, 'sulfur'));
  b.push(box(0.5, -1.5, 6 + z, 0.5, 0.5, 0.5, 'sulfur'));
  // O olho: BRASA, e nao biolum. Ele nao e uma coisa viva do micelio — e um
  // corpo mineral com calor dentro, como o nucleo do Escoriaceo (mesma rampa
  // `fire`, mesma leitura: o que arde por dentro deste estrato).
  b.push(box(0, -3, 4 + z, 1, 1, 1.5, 'fire'));
  // O pod: a bolsa de gas, MENOR que o capuz e com o ombro chanfrado — ela
  // acompanha o corpo em vez de engoli-lo. Cresce nos dois eixos no telegrafo,
  // que continua sendo o unico momento em que ela manda na silhueta.
  b.push(box(-2.5, 2, 2 + z, 4 + swell, 2, 3 + swell + pulse, 'sulfur'));
  b.push(box(-2, 2.5, 5 + swell + pulse + z, 3 + swell, 1, 0.5, 'sulfur'));
  // Valvulas de ferrugem no lugar dos poros: por onde o gas escapa.
  b.push(box(-1.5, 3.5, 3 + z, 0.5, 0.5, 0.5, 'rust'));
  b.push(box(0, 3.5, 4 + z, 0.5, 0.5, 0.5, 'rust'));
  b.push(box(1, 3.5, 3 + z, 0.5, 0.5, 0.5, 'rust'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const sulfurBomberFrame = (dir, anim, f) => renderVoxels(sulfurBomberModel(anim, f), DIR_INDEX[dir], 64, 64, 28, 54);

// enemy-undertaker 96x120 — o Coveiro: catador de sucata do Ferrifero.
//
// A silhueta tem de dizer as duas coisas que ele faz, e nesta ordem: o BRACO
// DE ELETROIMA (o disco enorme de um lado, desproporcional, que e o unico
// jeito de o jogador entender de longe o que o puxou) e as costas de carga —
// a caçamba onde ele empilhava carcaças. O corpo e ferrugem industrial, da
// mesma familia do Miner: os dois sao maquinario da Aurix que ninguem
// desligou. A diferenca e que este ainda esta cumprindo a ordem com voce.
const undertakerModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  // `special` e a carga do eletroima: as bobinas acendem e o campo aparece.
  const charge = anim === 'special' ? Math.min(3, f) : 0;
  // O ataque e a prensa: o braco pesado sobe e desce.
  const slam = anim === 'attack' ? [0, 0, 4, 1][f % 4] : 0;
  const idle = anim === 'idle' ? [0, 0.5, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // O primeiro desenho era uma PILHA DE LAJES: caixas largas e baixas
  // empilhadas, cada uma mais comprida que alta, e o resultado lia como
  // mobilia — uma mesa com uma prancha por cima. A correcao e proporcao, nao
  // detalhe: o corpo agora e ESTREITO e ALTO (6 de largura contra 15 de
  // altura), e o unico volume horizontal do bicho e o braco que puxa.
  //
  // Pernas curtas e grossas, plantadas: ele nao corre, ele CHEGA.
  for (const s of [-1, 1]) {
    const lift = s > 0 ? Math.max(0, step) : Math.max(0, -step);
    b.push(box(s * 1.5 - 1, -1, lift, 2, 2.5, 4, 'rockDeep'));
    b.push(box(s * 1.5 - 1.5, -1.5, lift, 3, 3.5, 1, 'rust')); // o pe
  }
  // Torso alto e estreito, com a cintura marcada: o vulto e vertical.
  b.push(box(-2, -1.5, 4 + idle - flinch, 4, 3.5, 3, 'rust'));
  b.push(box(-2.5, -2, 7 + idle - flinch, 5, 4, 5, 'rust'));
  // Costura industrial: uma faixa escura na altura do peito quebra o bloco.
  b.push(box(-2.5, -2.1, 9 + idle - flinch, 5, 0.5, 1, 'rockDeep'));
  // A CACAMBA nas costas: alta e encostada no dorso (nao uma bancada por
  // cima). E a caçamba que conta o que ele faz — carregar carcaça.
  b.push(box(-2, 2, 6 + idle, 4, 2, 7, 'rockDeep'));
  b.push(box(-2, 2, 13 + idle, 4, 2, 0.5, 'bone'));
  // Sucata espiando de dentro: dois cotos de osso, a carga que ele ja tem.
  b.push(box(-1.5, 2.5, 13 + idle, 1, 1, 1.5, 'bone'));
  b.push(box(0.5, 2.5, 13.5 + idle, 1, 1, 1, 'bone'));
  // Cabeca pequena, afundada entre os ombros: ele nao olha, ele VARRE.
  b.push(box(-1.5, -1.5, 12 + idle - flinch, 3, 3, 2.5, 'rockDeep'));
  // A lente de varredura, larga e fina. Eletrica: e sensor, nao premio.
  b.push(box(-1, -2, 13 + idle - flinch, 2, 0.5, 0.8, 'electric'));

  // BRACO DE ELETROIMA (esquerda). A leitura inteira do bicho mora aqui,
  // entao ele e desproporcional de proposito — e o disco fica EM PE, no plano
  // vertical, com um vao no meio: um anel. Chapado e deitado (a primeira
  // versao) projetava como uma prancha e nao dizia nada.
  const armZ = 8 + idle - slam;
  b.push(box(-3.5, -1, armZ, 2, 2, 2, 'rust')); // ombro
  b.push(box(-5, -1, armZ - 1, 1.5, 2, 2, 'rust')); // antebraco
  // O ANEL do eletroima: quatro segmentos em volta de um vao, no plano y-z.
  //
  // Compacto de proposito. A primeira versao esticava o braco ate x=-8,5 e o
  // sprite passava de 80px de largura projetada — para um bicho de raio 0,5,
  // que e o mesmo do Fole (canvas 64x64). O custo nao era so de memoria de
  // textura: um corpo tao largo quanto o do Britador prometia uma ameaca de
  // peso que o Coveiro nao e. O disco continua desproporcional em relacao ao
  // RESTO DELE, que e o que faz a leitura — nao em relacao ao mundo.
  const ringX = -6;
  const ringZ = armZ - 3.5;
  b.push(box(ringX, -2, ringZ + 4.5, 1.5, 4, 1, 'rockDeep')); // topo
  b.push(box(ringX, -2, ringZ, 1.5, 4, 1, 'rockDeep')); // base
  b.push(box(ringX, -2, ringZ + 1, 1.5, 1, 3.5, 'rockDeep')); // lado
  b.push(box(ringX, 1, ringZ + 1, 1.5, 1, 3.5, 'rockDeep')); // lado
  // Bobinas: acendem na carga. Apagadas sao osso; carregando viram corrente —
  // o telegrafo em COR, no lugar exato de onde o puxao vai sair.
  const coil = charge > 0 ? 'electric' : 'bone';
  b.push(box(ringX - 0.5, -1.5, ringZ + 1.5, 0.5, 3, 0.5, coil));
  b.push(box(ringX - 0.5, -1.5, ringZ + 3, 0.5, 3, 0.5, coil));
  if (charge >= 2) {
    // No auge da carga o campo se ve: o vao do anel acende.
    b.push(box(ringX, -1, ringZ + 2, 1, 2, 1.5, 'electric'));
  }

  // BRACO DE PRENSA (direita): curto e pesado, com o bloco no punho. E ele
  // que desce no `attack` — o "porradao" que o puxao existe para viabilizar.
  b.push(box(2, -1, 8 + idle - slam * 0.5, 1.5, 2, 2, 'rust'));
  b.push(box(2.5, -1.5, 5 + idle - slam, 2.5, 3, 3.5, 'rockDeep'));
  b.push(box(2.5, -1.5, 4.5 + idle - slam, 2.5, 3, 0.5, 'bone'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const undertakerFrame = (dir, anim, f) => renderVoxels(undertakerModel(anim, f), DIR_INDEX[dir], 72, 88, 34, 78);

// FX AUTORADOS NATIVOS na resolucao fina (32x32). Ate a subdivisao da grade
// eles eram desenhos de 16x16 dobrados por vizinho-mais-proximo — pixels
// gordos de 2x2 fingindo resolucao. Redesenhados no grao real: o estilhaco
// ganha faceta sombreada, halo que cintila e DUAS faiscas orbitando; o impacto
// vira fragmentacao com estilhacos alongados e anel residual apagando.
// (O `upscale2x` que dobrava os antigos saiu junto com eles.)
const boltFrame = (_dir, _anim, f) => {
  const g = grid(32, 32);
  // Nucleo facetado: tres losangos deslocados para o alto-esquerda — a mesma
  // key light de todo volume do jogo, agora com resolucao para o degrade.
  fillDiamond(g, 16, 16, 6, 6, 'fungus');
  fillDiamond(g, 15, 15, 4, 4, 'biolum');
  fillDiamond(g, 14, 14, 2, 2, 'player');
  // Halo esparso cintilando: um terco dos pontos se apaga por quadro, em
  // rodizio — energia respingando do nucleo, nao um aro fixo.
  const halo = [[16, 6], [25, 11], [26, 16], [22, 24], [16, 26], [9, 23], [6, 16], [9, 9]];
  halo.forEach(([hx, hy], i) => {
    if ((i + f) % 3 === 0) return;
    set(g, hx, hy, 'biolum');
  });
  // DUAS faiscas eletricas em orbita oposta, oito posicoes no ciclo de quatro
  // quadros, com um rastro de um pixel na posicao anterior.
  for (const off of [0, 4]) {
    const step = (f + off) % 8;
    const a = step * (Math.PI / 4);
    const prev = a - Math.PI / 4;
    set(g, 16 + Math.cos(a) * 10, 16 + Math.sin(a) * 10, 'electric');
    set(g, 16 + Math.cos(prev) * 10, 16 + Math.sin(prev) * 10, 'mist');
  }
  outlineWith(g, 'dark');
  return g;
};
const impactFrame = (_dir, _anim, f) => {
  const g = grid(32, 32);
  // Anel principal expandindo, com meio passo de giro por quadro para os
  // estilhacos nao viajarem em trilhos retos.
  const r = 3 + f * 2.5;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + (f % 2) * (Math.PI / 16);
    const mat = f < 1 ? 'player' : f < 3 ? 'biolum' : 'electric';
    set(g, 16 + Math.cos(a) * r, 16 + Math.sin(a) * r, mat);
    // Fragmento ALONGADO: um segundo pixel radial para fora em metade dos
    // raios dos quadros medios — estilhaco voando, nao pontilhado.
    if (f >= 1 && f <= 3 && i % 2 === 0) {
      set(g, 16 + Math.cos(a) * (r + 2), 16 + Math.sin(a) * (r + 2), mat);
    }
  }
  // Clarao do primeiro quadro: o momento do acerto e o mais claro do ciclo.
  if (f === 0) {
    fillDiamond(g, 16, 16, 4, 4, 'player');
    fillDiamond(g, 16, 16, 2, 2, 'beam');
  }
  // Anel residual interno apagando atras da frente: a energia que ja passou.
  if (f >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      set(g, 16 + Math.cos(a) * (r - 4), 16 + Math.sin(a) * (r - 4), 'fungus');
    }
  }
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
    'voxel-isometric modular mining bot, digitigrade legs, boxy industrial chassis, round tactical headlamp and cyan sensor visor, rear hardpoint module, conductive cabling, extraction claw arm',
    5
  ),
  base('enemy-stalker', 64, 64, 32, 60, { w: 0.64, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, stalkerFrame, 'voxel-isometric low red chitin predator with one mineral blade, four authored directions', 6),
  base('enemy-spitter', 64, 64, 32, 60, { w: 0.68, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, spitterFrame, 'voxel-isometric fungal amphibian, bulb eyes, acid throat, restrained neon accents', 6),
  base('enemy-spore-bomber', 64, 64, 32, 60, { w: 0.62, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, bomberFrame, 'voxel-isometric compact spore carrier, hooded silhouette, central eye and telegraphed explosive pod', 6),
  base('enemy-bruiser', 96, 136, 48, 132, { w: 0.92, h: 1.1 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 8, fps: 10, loop: false },
  }, bruiserFrame, 'voxel-isometric gorilla geode bruiser lifting a full stone block overhead, broad shoulders, pale rock plates and electric core', 6),
  base('enemy-guardian', 112, 128, 56, 124, { w: 1.36, h: 1.4 }, { w: 1.7, h: 1.7, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, guardianFrame, 'voxel-isometric walking mountain-citadel boss, dark mineral massif crowned with seven mushroom spire towers and gold finial, round diffuse electric core with radial cracks, six armored crawler legs, twin dominion claws, stalactite fringe', 6),
  base('enemy-bishop', 112, 124, 56, 116, { w: 1.2, h: 1.9 }, { w: 1.5, h: 1.5, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 9, loop: false },
  }, bishopFrame, 'voxel-isometric fungal cleric, decaying root-curtain vestment with frayed hem, open blessing arms, halo-disc pastoral staff, hanging censer, chitinous three-pronged crown, mycelial roots and mushrooms at the hem', 6),
  base('enemy-fungal-horse', 160, 168, 80, 156, { w: 1.4, h: 0.95 }, { w: 1.6, h: 1.2, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, horseFrame, 'voxel-isometric fungal warhorse, long low body, ember mane crest and burning tail tip, split hooves, draped organic plate barding with gold flank medallions, crested war mask', 5),
  base('enemy-miner', 96, 120, 48, 108, { w: 0.92, h: 1.5 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, living, minerFrame, 'voxel-isometric abandoned mining automaton, hunched under its load, long arms, cracked faceplate, shoulder lamp, exposed conductive wiring, refitted pickaxe'),
  // Bestiario de assinatura (um por estrato). `version` nasce em 1: sao os
  // primeiros pixels destes atlases.
  base('enemy-resonant', 64, 64, 32, 60, { w: 0.88, h: 0.9 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, resonantFrame, 'voxel-isometric slow mineral node crowned with living electric crystals, dark rock body with glowing seams', 1),
  base('enemy-mud-lamprey', 64, 64, 32, 60, { w: 0.8, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, mudLampreyFrame, 'voxel-isometric low mud eel, undulating dark segments, serrated dorsal fin, circular bone-ringed mouth, twin bioluminescent eyes', 1),
  base('enemy-bellows', 64, 64, 32, 60, { w: 1, h: 0.9 }, { w: 1.1, h: 1.1, offsetX: 0, offsetY: 0 }, living, bellowsFrame, 'voxel-isometric wide breathing sac creature, sulfur-yellow bladder caged by bone ribs, rusted valve mouth, squat rust feet', 1),
  base('enemy-scoriac', 64, 64, 32, 60, { w: 0.88, h: 0.8 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, scoriacFrame, 'voxel-isometric slag beetle, cold black scoria plates over a living ember core glowing through the seams, six charcoal legs', 1),
  base('enemy-frost-wraith', 64, 64, 32, 60, { w: 0.72, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, frostWraithFrame, 'voxel-isometric pale ice wraith, low elongated milky body, translucent dorsal blade fin, wedge head with twin electric eyes', 1),
  // Fauna afinada por bioma. O de enxofre herda o `special` do Spore Bomber
  // (mesmo telegrafo de pod inchando), e o Coveiro tem o proprio: a carga do
  // eletroima, que e o aviso mais importante do bicho.
  base('enemy-sulfur-bomber', 64, 64, 32, 60, { w: 0.62, h: 0.72 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, sulfurBomberFrame, 'voxel-isometric hooded sulfur carrier, mineral crusted hood with yellow sulfur needles, ember eye, swelling sulfur gas bladder with rusted valves', 1),
  base('enemy-undertaker', 72, 88, 34, 78, { w: 1, h: 1.5 }, { w: 1.25, h: 1.25, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 6, fps: 10, loop: false },
  }, undertakerFrame, 'voxel-isometric scrap-collector automaton, oversized electromagnet disc arm with glowing coils, heavy press arm, rusted industrial chassis, hauling bin on its back, recessed scanning lens', 1),
  {
    id: 'fx-projectile-bolt', version: 4, frameWidth: 32, frameHeight: 32, anchorX: 16, anchorY: 16,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0.2, h: 0.2 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { fly: { frames: 4, fps: 16, loop: true } }, draw: boltFrame,
    prompt: 'faceted cyan energy shard, shimmering halo, twin orbiting electric sparks',
  },
  {
    id: 'fx-impact-burst', version: 4, frameWidth: 32, frameHeight: 32, anchorX: 16, anchorY: 16,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0, h: 0 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { burst: { frames: 5, fps: 14, loop: false } }, draw: impactFrame,
    prompt: 'fragmenting impact burst, elongated shards, fading inner ring',
  },
];
