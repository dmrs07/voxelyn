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
import { fillDiamond, fillEllipse, fillRect, grid, outlineWith, set, thickLine } from './lib.mjs';

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
  // A cabeca sobe assim que ele deixa de estar so trabalhando. E o gesto que a
  // ficha descreve: "it raises its head only to decide".
  const alert = anim === 'idle' ? 0 : 2;
  const up = -flinch;
  const b = [];

  // REWORK guiado pela ficha de referencia (EX-016). O desenho anterior tinha
  // todas as pecas certas — lampada, veias, tremonha, bracos longos, picareta —
  // e mesmo assim lia como um amontoado de caixas. Duas tentativas ensinaram o
  // porque, e as duas licoes estao aplicadas aqui:
  //
  // 1. NAO EXISTE VOLUME LARGO E BAIXO. Uma laje mostra so a face de topo na
  //    isometrica, e essa face vira a maior mancha chapada da tela — foi o
  //    "telhado" que a primeira versao do manto virou, cobrindo a cabeca.
  //    Roupa aqui e feita de FIOS VERTICAIS, como a cortina do Bispo: fio
  //    projeta lateral, e lateral desenha contorno em vez de mancha.
  // 2. O CENTRO DO CORPO E CLARO, AS PONTAS SAO ESCURAS. A segunda versao fez
  //    o contrario (tronco escuro, membros de latao) e o resultado foi pior: o
  //    meio do bicho sumia no fundo e braco, perna e cabeca flutuavam como
  //    pecas soltas. Uma figura precisa de UMA massa continua, e ela tem de
  //    ser a mais clara — o resto pendura nela.
  const lean = 1; // o tronco pende para a frente (-y), sob a carga

  // PERNAS digitigradas e ESCURAS, encostadas no quadril: sem vao entre elas e
  // o corpo, senao voltam a parecer postes plantados ao lado de um tronco.
  for (const [lx, phase] of [[-3, step], [1, -step]]) {
    const lift = Math.max(0, phase);
    b.push(box(lx, -0.5, lift, 2, 3, 1, 'rockDeep')); // pe comprido
    b.push(box(lx, 0.5, 1 + lift, 2, 2, 4, 'rockDeep')); // canela (recuada)
    b.push(box(lx, -0.5, 5 + lift, 2, 2, 4, 'rockDeep')); // coxa (avancada)
    b.push(box(lx - 0.5, 0, 4.5 + lift, 3, 2, 1, 'rust')); // cinta do joelho
  }

  // A COLUNA CLARA: quadril, tronco e pescoco em latao, contiguos. E a maior
  // massa clara do modelo e a unica coisa que o olho precisa achar primeiro.
  b.push(box(-3, -0.5, 9 + up, 6, 3, 2, 'rust')); // quadril
  b.push(box(-2.5, -1 + lean, 11 + up, 5, 3, 6, 'rust')); // torso
  // Veio reativo crescido POR DENTRO do peito: mineral virando fiacao. Fica no
  // centro optico do bicho, sobre o latao — o unico azul do torso.
  b.push(box(-1, -2 + lean, 13 + up, 2, 1, 2, 'electric'));
  b.push(box(-1.5, -2 + lean, 15 + up, 0.5, 0.5, 0.5, 'electric'));
  // Costura do chassi: uma faixa escura no peito, que quebra o latao sem
  // apaga-lo (a caixa lisa e o que fazia o torso ler como caixote).
  b.push(box(-2.5, -1.1 + lean, 14 + up, 5, 0.5, 1, 'rockDeep'));

  // TREMONHA nas costas: o compartimento de carga, ainda cheio. Estreita e
  // atras do torso — sem a tampa dourada larga da versao antiga, que virava um
  // chapeu amarelo por cima de tudo e roubava a leitura da cabeca.
  b.push(box(-2, 2, 12 + up, 4, 2, 5, 'rockDeep'));
  b.push(box(-1.5, 2.5, 17 + up, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(-0.5, 3, 17 + up, 0.5, 0.5, 0.5, 'loot'));
  b.push(box(0.5, 2.5, 17.5 + up, 0.5, 0.5, 0.5, 'loot'));

  // O MANTO: uma capa curta e ESCURA sobre os ombros, com fios caindo atras.
  // Ele emoldura a coluna clara em vez de cobri-la — a frente do peito fica
  // livre, que e onde moram a veia azul e o chassi.
  b.push(box(-3.5, 0.5, 16 + up, 7, 3, 2, 'rockDeep')); // ombreira
  const shroud = [
    [-3.5, 1, 5, 'rockDeep'], [-2.5, 2.5, 8, 'scorch'], [-1.5, 3, 5, 'rockDeep'],
    [-0.5, 3.5, 7, 'scorch'], [0.5, 3.5, 4, 'rockDeep'], [1.5, 3, 6, 'scorch'],
    [2.5, 2.5, 4, 'rockDeep'], [3, 1, 7, 'scorch'],
  ];
  for (const [sx, sy, len, mat] of shroud) {
    b.push(box(sx, sy, 16 - len + up, 1, 1, len, mat));
  }

  // CABEAMENTO EXPOSTO descendo do tronco, com bracadeiras. Azul: a corrente
  // da grade que ainda passa por ele, e que o calor faz sobrecarregar.
  b.push(box(-3.5, 0 + lean, 12 + up, 1, 1, 3, 'electric'));
  b.push(box(3, 0.5 + lean, 13 + up, 1, 1, 2, 'electric'));
  b.push(box(-4, 0 + lean, 14 + up, 0.5, 1, 0.5, 'rust'));
  b.push(box(3.5, 0.5 + lean, 14 + up, 0.5, 1, 0.5, 'rust'));

  // BRACOS longos e escuros, colados ao tronco, com a MAO no fim. Escuros
  // porque a coluna clara ja e a figura: um braco de latao ao lado de um torso
  // de latao devolveria a mancha unica que este rework existe para desfazer.
  for (const [ax, side] of [[-4.5, -1], [3.5, 1]]) {
    b.push(box(ax, 0 + lean, 13 + up, 1.5, 2, 4, 'rockDeep')); // braco
    b.push(box(ax, 0 + lean, 6 + up, 1.5, 2, 7, 'rockDeep')); // antebraco
    b.push(box(ax - 0.25, -0.5 + lean, 4 + up, 2, 3, 2, 'rust')); // mao
    b.push(box(ax + (side < 0 ? 0 : 1), -1 + lean, 4 + up, 0.5, 0.5, 1.5, 'bone')); // garra
  }

  // CABECA: pequena, de latao, PROJETADA A FRENTE e para baixo, saindo do
  // capuz. Ela e a ponta da coluna clara, e nao uma peca solta em cima dela.
  const headZ = 17 + up + alert;
  b.push(box(-1.25, -2.5 + lean, headZ, 2.5, 2.5, 2.5, 'rust'));
  // Placa facial ESTREITA, encaixada na frente da calota. Larga (3 de vao,
  // como era) ela virava uma aba horizontal atravessada no topo do bicho — o
  // olho lia um chapeu, e os rebites da calota viravam dois olhos naquela
  // aba. Rosto aqui e a fissura e a optica, e nada mais.
  b.push(box(-1, -3.25 + lean, headZ + 0.5, 2, 0.75, 1.5, 'bone'));
  // A RACHADURA da placa: fissura escura em diagonal de dois segmentos. E o
  // unico rosto que ele tem.
  b.push(box(0, -4 + lean, headZ + 2, 0.5, 0.5, 1, 'rust'));
  b.push(box(-0.5, -4 + lean, headZ + 1.5, 0.5, 0.5, 0.5, 'rust'));
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
  b.push(box(-0.5, -4 + lean, headZ + 1, 1, 1, 1, f % 4 === 3 ? 'fungus' : 'biolum'));
  // Rebite unico na crista da calota: latao rebitado, e nao casca lisa. Um so,
  // e fora do eixo — dois simetricos no alto liam como um par de olhos.
  b.push(box(-0.75, -1.5 + lean, headZ + 2.5, 0.5, 0.5, 0.5, 'bone'));

  // LAMPADA DE MINERACAO na lateral do capacete. E o unico calor do modelo e a
  // coisa mais brilhante dele: `lamp` EMITE (rampa de luz branca quente), entao
  // ela acende de verdade no escuro em vez de so ser amarela.
  b.push(box(-3, -2.5 + lean, headZ + 1, 1.5, 2, 2, 'rust'));
  b.push(box(-3.5, -3 + lean, headZ + 1.5, 1, 1, 1, 'lamp'));

  // A picareta. Em repouso ela BATE NO CHAO — ele nao esta esperando voce.
  if (swing < 0) {
    // Encostada no braco direito e MERGULHANDO no chao a frente dele, e nao de
    // pe ao lado: solta, ela lia como um poste plantado no chao ao lado de um
    // corpo, e a leitura "ele esta trabalhando" e o que faz o encontro
    // significar alguma coisa antes de o jogador decidir qualquer coisa.
    b.push(box(4, -4, 1 + toil, 1.5, 1.5, 9 - toil, 'rust'));
    b.push(box(3.25, -4.75, 0 + toil, 2.5, 1.5, 1, 'bone'));
    b.push(box(3.25, -4.75, 0 + toil, 1, 1, 1, 'electric'));
  } else {
    const arc = [
      [0, -6, 14], // erguida a frente
      [6, -1, 13], // lado direito
      [0, 5, 12], // POR TRAS: e este frame que promete o circulo
      [-6, -1, 13], // lado esquerdo, recolhendo
    ][swing];
    b.push(box(arc[0], arc[1], arc[2] + up, 2, 2, 2, 'rust'));
    b.push(box(arc[0], arc[1], arc[2] + 2 + up, 2, 2, 1, 'bone'));
    // Corrente residual no fio da lamina: ela crepita quando ele gira.
    b.push(box(arc[0], arc[1], arc[2] + 3 + up, 1, 1, 1, 'electric'));
    b.push(box(Math.round(arc[0] / 2), Math.round(arc[1] / 2), 13 + up, 2, 2, 1, 'rockDeep'));
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

/**
 * Gira um modelo um quarto de volta, levando a frente de +x para -y.
 *
 * Quatro assinaturas (Lampreia, Fole, Escoriaceo, Espectro) nasceram autoradas
 * com a frente em +x — cabeca, valvula e eixo do corpo correndo pelo x. O
 * contrato do rasterizador e frente em -y (ver DIRECTION_ROTATION em
 * voxel.mjs), entao cada direcao pedida saia girada um quadrante: quem andava
 * para dl aparecia olhando ul, quem andava para dr aparecia olhando dl.
 *
 * Girar o modelo PRONTO, em vez de reescrever caixa a caixa, mantem a
 * autoria legivel no eixo em que esses corpos compridos foram pensados. A
 * transformacao e a rotacao (x, y) -> (y, -x) aplicada a caixas: a origem
 * vira (y, -x-w) e largura e profundidade trocam de lugar.
 *
 * O +0.5 nao e ajuste de gosto: shellVoxels rotaciona CANTOS de voxel, e a
 * rotacao verdadeira de uma caixa desloca o canto em uma unidade fina. Sem a
 * compensacao, dl e ul saiam 2px a esquerda das outras direcoes — a uniao dos
 * frames alargava alem da margem e o sprite pulava um pixel ao virar.
 */
const quarterTurn = (boxes) =>
  boxes.map((b) => ({ ...b, x: b.y, y: -b.x - b.w + 0.5, w: b.d, d: b.w }));

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
const mudLampreyFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(mudLampreyModel(anim, f)), DIR_INDEX[dir], 64, 64, 28, 54);

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
const bellowsFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(bellowsModel(anim, f)), DIR_INDEX[dir], 64, 64, 28, 54);

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
  // Placa frontal menor: a "testa" que ele abaixa para investir. Na FRENTE do
  // corpo (+x, o eixo em que este modelo foi autorado — ver quarterTurn): ela
  // estava em -y, que e o flanco, e o besouro investia de lado.
  b.push(box(2.5 + flinch, -1, 2.5, 1, 2, 1.5, 'rockDeep'));
  // Fresta dorsal: com as placas abertas, uma crista de brasa sobe no vao.
  if (open >= 1) b.push(box(-0.5 + flinch, -1, 4, 1, 2, 1 + open * 0.5, 'fire'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};
const scoriacFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(scoriacModel(anim, f)), DIR_INDEX[dir], 64, 64, 28, 54);

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
const frostWraithFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(frostWraithModel(anim, f)), DIR_INDEX[dir], 64, 64, 28, 54);

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

// ===========================================================================
// CHEFES — um por estrato, mais os dois de ocupacao forte.
//
// Regra que vale para os oito, e ela vem de uma falha que ja custou caro: o
// jogador tem de conseguir NOMEAR o contra-jogo olhando o corpo, antes de a
// primeira acao sair. O Bispo ja funciona assim (o fungo esta no manto, e o
// fungo e a regra dele) e o Guardiao tambem (o nucleo rachado e onde o dano
// entra). Aqui isso vira exigencia explicita de autoria: cada modelo carrega,
// na SILHUETA, a materia que decide a luta.
//
//   Diamandis      — os modulos salientes: sao eles que os Coveiros levam.
//   Devorador      — placas de silica: ele e o chao, e o chao vira vidro.
//   Arquicantor    — os cristais: quebra-los e apagar o canto dele.
//   Leviata        — as linhas condutivas: a agua eletrificada e o freio.
//   Pulmao-Matriz  — o saco de gas: incendia-lo e a unica janela de dano.
//   Coracao        — as placas sobre a brasa: fechadas, blindado; abertas, nao.
//   Rainha         — a couraça de gelo: derreter em volta e desnuda-la.
//   Magnetarca     — os aneis de ferro: a polaridade se le na distancia deles.
// ===========================================================================

// ---------------------------------------------------------------------------
// enemy-diamandis — a fabrica ambulante da Cicatriz Aurix.
//
// A leitura tem de dizer TRABALHO, nao guerra. Nada nele e militar: e uma broca
// de avanco, um rack de cargas de implosao e um mastro de prospeccao montados
// num chassi industrial que ninguem desligou. O jogador nao esta sendo atacado,
// esta no caminho da obra — e essa e a diferenca entre este chefe e "um robo
// grande atira em voce".
//
// A primeira versao errou a proporcao e o erro tem nome no repositorio: virou
// uma CAIXA. Chassi baixo e largo, tampo claro de `rust` (a face de topo dessa
// rampa e cor de osso) e tudo o que contava a historia — mastro, rack, reator —
// contido dentro do bloco. E o mesmo defeito da primeira versao do Corcel e da
// do Coveiro: um volume horizontal grande, iluminado por cima, le como MOBILIA.
//
// A correcao e vertical e e de hierarquia. O corpo sobe em tres degraus com o
// tampo ESCURO, as pernas ganham vao para ler como pernas, e as tres
// ferramentas saem para FORA da silhueta: a broca a frente, o rack acima da
// linha do deck, o mastro acima de tudo. Em ordem de leitura a distancia:
//   1. A BROCA — o cone que come parede;
//   2. O REATOR no ventre, brasa exposta — a segunda fase inteira mora ali;
//   3. Os TRES MODULOS salientes — o que os Coveiros vem buscar, e por isso
//      precisam parecer peças aparafusadas, e nao partes do corpo.
// ---------------------------------------------------------------------------
const diamandisModel = (anim, f) => {
  const step = anim === 'walk' ? [0, 1, 2, 1, 0, -1][f % 6] : 0;
  // `special` e a carga da broca: 1,8 s parado com a ponta girando. E o
  // telegrafo mais longo do jogo e tem de PARECER longo — a broca avanca sobre
  // o mancal sem que o chefe saia do lugar.
  const wind = anim === 'special' ? Math.min(3, f) : 0;
  const fire = anim === 'attack' ? [0, 2, 1, 0][f % 4] : 0;
  const idle = anim === 'idle' ? [0, 0.5, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // A broca gira SEMPRE, em todo quadro de toda animacao: uma ferramenta
  // industrial que so gira quando ataca e uma arma disfarçada de ferramenta.
  const spin = f % 4;
  const b = [];

  // PERNAS com vao. O primeiro desenho tinha quatro pastilhas coladas no chassi
  // e o bicho parecia assentado numa mesa; aqui ha 5 voxels de perna VISIVEL
  // antes de o corpo comecar, e e esse vao que diz "isto anda".
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const lift = Math.max(0, sx * sy > 0 ? step : -step) * 0.5;
      b.push(box(sx * 3 - 1, sy * 3 - 1, lift + 1, 2, 2, 4.5, 'rockDeep'));
      b.push(box(sx * 3.5 - 1.5, sy * 3.5 - 1.5, lift, 3, 3, 1.2, 'rust'));
    }
  }

  const z = 5.5 + idle - flinch;
  // Ventre: o volume mais estreito, para o corpo AFINAR na cintura em vez de
  // ser um bloco unico do chao ao topo.
  b.push(box(-3.5, -3.5, z, 7, 7, 4, 'rust'));
  // Deck: mais largo que o ventre e com o tampo ESCURO. `rust` iluminado por
  // cima e a cor de osso, e um tampo de osso desse tamanho vira tabua.
  b.push(box(-4.5, -4, z + 4, 9, 8, 3, 'rust'));
  b.push(box(-4.7, -4.2, z + 7, 9.4, 8.4, 1.2, 'rockDeep'));
  // Torre: o terceiro degrau, recuado para tras, so de rocha.
  b.push(box(-3, -3.5, z + 8.2, 6, 6, 4, 'rockDeep'));
  b.push(box(-3, -3.6, z + 10.5, 6, 0.6, 1.2, 'rust'));

  // O REATOR, exposto no ventre pela FRENTE (-y). Nao esta atras de tampa: uma
  // instalacao que vaza brasa na segunda fase tem de estar vazando de algum
  // lugar visivel desde o primeiro segundo. Ele ocupa quase toda a face frontal
  // do ventre de proposito — e o alvo que a segunda fase promete.
  b.push(box(-2.6, -4.6, z + 0.4, 5.2, 1.4, 3.4, 'fire'));
  b.push(box(-1.6, -5, z + 1, 3.2, 0.8, 2.2, 'loot'));

  // MODULO 1 — A BROCA. Cone de cinco degraus afinando ate a ponta, montado
  // num mancal a frente do ventre e na altura dele: a broca do jogo abre um
  // CORREDOR no chao, entao ela nao pode estar apontada para o horizonte.
  const bit = -6 - wind - fire * 0.5;
  b.push(box(-3, bit + 3, z + 0.6, 6, 3, 5, 'rust')); // mancal
  b.push(box(-2.4, bit + 1.4, z + 0.6, 4.8, 2, 4.2, 'rockDeep'));
  b.push(box(-1.9, bit - 0.2, z + 1.1, 3.8, 2, 3.2, 'bone'));
  b.push(box(-1.4, bit - 1.8, z + 1.6, 2.8, 2, 2.2, 'bone'));
  b.push(box(-0.9, bit - 3.2, z + 2.1, 1.8, 1.6, 1.2, 'bone'));
  b.push(box(-0.4, bit - 4.4, z + 2.4, 0.8, 1.4, 0.6, 'bone'));
  for (let i = 0; i < 4; i++) {
    // Helicoide: um nub por degrau, girando um quarto de volta por quadro. E o
    // giro que faz um cone virar broca — sem ele e um bico.
    const a = ((spin + i) * Math.PI) / 2;
    const r = 2.4 - i * 0.45;
    b.push(box(Math.cos(a) * r - 0.3, bit + 1.4 - i * 1.6, z + 2.6 + Math.sin(a) * r - 0.3, 0.6, 1.2, 0.6, 'rust'));
  }

  // MODULO 2 — O RACK DE DEMOLICAO, acima do deck e para tras. Ele fica ACIMA
  // da linha do corpo porque uma peça encaixada dentro da silhueta nao parece
  // removivel, e a economia inteira dos Coveiros depende de o jogador olhar
  // isto e pensar "aquilo sai". Sao TRES cilindros porque a salva tem tres
  // cargas: quem contar o rack sabe quantos circulos vao nascer no chao.
  for (let i = 0; i < 3; i++) {
    const gone = anim === 'attack' && f >= 2 && i === 1;
    if (gone) continue; // no disparo o do meio ja saiu: o rack conta a salva
    b.push(box(-3.6 + i * 2.8, 2.6, z + 12.2, 1.8, 2.4, 4.5, 'loot'));
    b.push(box(-3.8 + i * 2.8, 2.4, z + 16.7, 2.2, 2.8, 0.8, 'rust'));
  }

  // MODULO 3 — O MASTRO DE PROSPECCAO: a peça mais alta e a mais fina. Ele e o
  // primeiro sistema a cair no colapso do reator, entao a fragilidade tem de
  // estar na proporcao — um pino de 1,2 de lado contra um corpo de 9.
  b.push(box(-0.6, -0.8, z + 12.2, 1.2, 1.2, 6, 'rust'));
  b.push(box(-1.6, -1.4, z + 18.2, 3.2, 2.6, 1.8, 'rockDeep'));
  // A lente varre no idle e ACENDE no feixe. Enquanto so varre e sensor —
  // eletrica, fria; a potencia so aparece no release, e o atlas nao mente
  // sobre isso: nem no `special` ela vira chama.
  b.push(box(-1.1, -1.9, z + 18.8, 2.2, 0.8, 0.9, fire >= 2 ? 'loot' : 'electric'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-white-devourer — o verme dos Sumidouros de Silica.
//
// Autorado com a frente em +x (ver quarterTurn): o corpo E um eixo comprido, e
// pensa-lo em qualquer outro eixo seria escrever contra ele.
//
// Duas decisoes carregam o bicho:
//
// SEM OLHOS. Ele caça por vibracao, e a ausencia de rosto e o que separa "um
// verme grande" de "uma coisa que nao esta olhando para voce porque nao
// precisa". A boca em anel de dentes ocupa a frente inteira.
//
// PLACAS DE SILICA. O corpo e feito da mesma materia do chao onde ele vive —
// e essa e literalmente a regra do encontro: ele nao atravessa a silica, a
// silica assume a forma dele.
//
// A boca teve de ser refeita: na primeira versao ela era uma placa frontal com
// uma fenda escura, e a fenda projeta como um risco de dois pixels. Boca de
// lampreia nao e um corte, e um BURACO — entao aqui nao ha placa nenhuma na
// frente: ha um anel de dentes montado em volta do vazio, com a goela escura ao
// fundo dele. O que se ve de longe e a abertura, que e o que ela e.
// ---------------------------------------------------------------------------
const devourerModel = (anim, f) => {
  const rear = anim === 'attack' ? [0, 2, 4, 2][f % 4] : anim === 'special' ? Math.min(3, f) : 0;
  // A ondulacao nunca para: o corpo de um verme e o proprio movimento dele.
  const wave = (s) =>
    anim === 'walk'
      ? Math.round(Math.sin((s + f) * 0.9)) * 0.5
      : anim === 'idle'
        ? ((s + f) % 2) * 0.5
        : (s % 2) * 0.5;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];

  // Oito aneis SOBREPOSTOS (passo 1,6 para largura 2,2), afinando para tras.
  // Sobrepostos e o ponto: com passo igual a largura a primeira versao saiu
  // como uma fila de caixas separadas por vazio, e um verme com vao entre os
  // segmentos e um trenzinho.
  for (let s = 0; s < 8; s++) {
    const x = -10 + s * 1.9;
    const d = 2.2 + s * 0.42;
    // ARCO: o dorso sobe no meio e volta a descer. Um verme que sai do chao nao
    // deita reto — e a curva que diz que o resto dele continua LA EMBAIXO. Sem
    // ela o corpo projetava como uma prancha comprida, que foi o defeito da
    // primeira versao mesmo depois de os segmentos passarem a se sobrepor.
    const arch = Math.sin(((s + 1) / 9) * Math.PI) * 1.4;
    const lift = arch + (s >= 5 ? rear * (s - 4) * 0.45 : 0);
    const y = -d / 2 + wave(s);
    b.push(box(x, y, 0.4 + lift + flinch * 0.3, 2.2, d, d * 1.05, 'silt'));
    // Cume mais estreito: o anel deixa de ser um cubo e passa a ler como tubo.
    b.push(box(x, y + d * 0.2, 0.4 + lift + flinch * 0.3 + d * 1.05, 2.2, d * 0.6, 0.6, 'silt'));
    // Sulco entre aneis: uma fatia ESTREITA e ESCURA, recuada nos dois eixos.
    // Ela e a sombra da juntura — em osso, como estava antes, o corpo virava
    // uma escada de dois beges sem separacao nenhuma.
    b.push(box(x + 1.7, y + 0.35, 0.5 + lift + flinch * 0.3, 0.5, d - 0.7, d * 0.95, 'rockDeep'));
  }

  // A CABECA: anel de dentes em volta de um vazio, no plano y-z. Doze lascas
  // de osso num circulo, a goela escura ao fundo e NENHUMA placa na frente.
  const hx = 5.4 + rear * 0.5;
  const hz = 2.6 + rear * 1.6;
  b.push(box(hx - 1.6, -1.6, hz - 1.6, 1.4, 3.2, 3.2, 'blood')); // a goela, ao fundo
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const r = 2.5 + (i % 2) * 0.35; // dentes desiguais: arcada, nao engrenagem
    // Os dentes AVANCAM no bote — a boca abre para fora em vez de so subir.
    b.push(box(hx + rear * 0.25, Math.cos(a) * r - 0.45, hz + Math.sin(a) * r - 0.45, 1.2, 0.9, 0.9, 'bone'));
    // Segundo anel, meio passo atras e mais fechado: da PROFUNDIDADE ao furo.
    b.push(box(hx - 1.1, Math.cos(a) * (r - 0.9) - 0.4, hz + Math.sin(a) * (r - 0.9) - 0.4, 1, 0.8, 0.8, 'silt'));
  }
  // Areia escorrendo dos flancos enquanto ele esta fora. So no bote — submerso
  // nao ha sprite, e parado ele ja assentou.
  if (rear > 0) {
    for (let i = 0; i < 4; i++) {
      b.push(box(-5 + i * 2.6, (i % 2 ? 1.9 : -2.6), 0.4 + (3 - i) * 0.6, 0.6, 0.6, 0.6, 'silt'));
    }
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-archcantor — o Arquicantor da Catedral Prismatica.
//
// Ele nao atira: CANTA, e a sala responde. Entao o corpo nao pode ter arma
// nenhuma — nem braco, nem bocal, nem cano. O que ele tem sao TUBOS: cristais
// de orgao crescidos do corpo, altos e desiguais, e uma cavidade de ressonancia
// no lugar onde um rosto estaria.
//
// Os tubos nasceram todos nas COSTAS, e isso os escondia em duas das quatro
// direcoes — justamente a peça que e a regra do encontro (quebrar a rede apaga
// o canto) desaparecendo metade do tempo. Agora eles circundam o tronco: sete
// cristais distribuidos em volta, de alturas diferentes, de modo que qualquer
// angulo mostre pelo menos quatro deles.
//
// O corpo tambem subiu um degrau de valor. Em `rockDeep` sobre o chao da
// Catedral ele era uma mancha preta que so tinha silhueta contra os cristais;
// em `rock`, a massa existe antes da luz.
// ---------------------------------------------------------------------------
const archcantorModel = (anim, f) => {
  const gait = anim === 'walk' ? [0, 1, 1, 0, -1, -1][f % 6] : 0;
  // O canto: os tubos INCHAM e acendem. E a unica coisa que ele faz, entao
  // ataque e especial sao a mesma acao em intensidades diferentes.
  const sing = anim === 'attack' ? [1, 2, 3, 1][f % 4] : anim === 'special' ? Math.min(3, f) : 0;
  const hum = anim === 'idle' ? [0, 0, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];

  // Base pesada em vez de pernas: ele desliza mais do que caminha, e o passo e
  // um balanco do corpo inteiro.
  for (const s of [-1, 1]) {
    b.push(box(s * 2 - 1, -1.2, Math.max(0, s > 0 ? gait : -gait) * 0.5, 2, 2.4, 3.2, 'rockDeep'));
  }
  b.push(box(-3.2, -2.4, 3, 6.4, 4.8, 3, 'rockDeep'));
  const z = 6 - flinch;
  // Tronco alto e estreito: a massa que segura os tubos.
  b.push(box(-2.7, -2.2, z, 5.4, 4.4, 7, 'rock'));
  // Costelas de cristal aflorando pelo peito — a rede comeca DENTRO dele.
  b.push(box(-1.8, -2.3, z + 1.5, 1, 0.6, 3, 'electric'));
  b.push(box(0.9, -2.3, z + 2.5, 1, 0.6, 2.4, 'electric'));

  // A CAVIDADE DE RESSONANCIA no lugar do rosto: um vao emoldurado com a
  // garganta acendendo quando ele canta. Nao ha olhos e nao ha boca — ha uma
  // abertura por onde o som sai, e ela e o unico "rosto" que ele tem.
  b.push(box(-2, -2, z + 7, 4, 4, 3.6, 'rock'));
  b.push(box(-1.4, -2.4, z + 7.8, 2.8, 0.6, 2.2, sing > 0 ? 'electric' : 'rockDeep'));
  // Coroa de lascas: tres pontas desiguais.
  b.push(box(-1.6, -0.9, z + 10.6, 0.9, 0.9, 2 + sing * 0.5, 'electric'));
  b.push(box(-0.4, 0.1, z + 10.6, 0.9, 0.9, 3 + sing * 0.5, 'electric'));
  b.push(box(0.8, -0.5, z + 10.6, 0.9, 0.9, 2.5 + sing * 0.5, 'electric'));

  // OS TUBOS DE ORGAO: sete cristais EM VOLTA do tronco, nao atras dele. As
  // alturas sao desiguais para nao lerem como cerca, e os angulos sao
  // irregulares pelo mesmo motivo — um heptagono regular vira engrenagem.
  // O setor FRONTAL fica vazio de proposito. Cercando o tronco por inteiro, os
  // sete tubos fecharam uma paliçada em volta dele e o corpo desapareceu: sobrou
  // um feixe de canos sem nada dentro, e com ele foi embora a cavidade de
  // ressonancia, que e o unico "rosto" do bicho. Os tubos ficam dos flancos para
  // tras (angulos 0,4 a 4,0 rad), entao o peito e a garganta continuam a vista
  // de qualquer direcao e a floresta de cristal emoldura em vez de engolir.
  const pipes = [
    { a: 0.4, h: 9 },
    { a: 1.0, h: 6 },
    { a: 1.6, h: 11 },
    { a: 2.2, h: 7.5 },
    { a: 2.8, h: 10 },
    { a: 3.4, h: 6.5 },
    { a: 4.0, h: 8.5 },
  ];
  for (const p of pipes) {
    const px = Math.cos(p.a) * 3.6 - 0.6;
    const py = Math.sin(p.a) * 3.6 - 0.6;
    b.push(box(px, py, z + 1, 1.2, 1.2, p.h + sing * 1.2 + hum, 'electric'));
    // Base fosca: o cristal NASCE da rocha, nao esta plantado nela.
    b.push(box(px - 0.3, py - 0.3, z + 0.4, 1.8, 1.8, 1.4, 'rock'));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-sheet-leviathan — o Leviata do Lencol, no Aquifero Negro.
//
// Mesma gramatica do Devorador (mergulha, marca, emerge) e por isso a silhueta
// tem de ser o OPOSTO da dele: onde o verme e um tubo que se levanta, este e uma
// LAMINA larga — uma arraia de agua escura. Duas ameaças com o mesmo ciclo e a
// mesma forma seriam a mesma criatura pintada de outra cor.
//
// A cor, alias, foi o primeiro erro: o corpo saiu em `pool`, cuja face de topo e
// verde de fungo. Um chefe do Aquifero NEGRO nao pode ser verde — verde e do
// micelio, e o jogo inteiro depende dessa separacao. Agora ele e `water`, a
// familia azul da rocha, exatamente como a crosta do lago em que ele vive.
//
// As linhas laterais condutivas sao o contra-jogo desenhado no corpo: o que o
// detem e eletrificar a agua. Autorado com a frente em +x.
// ---------------------------------------------------------------------------
const leviathanModel = (anim, f) => {
  const breach = anim === 'attack' ? [0, 2, 4, 2][f % 4] : anim === 'special' ? Math.min(3, f) : 0;
  // As asas batem devagar sempre — mesmo encalhado ele nao para de nadar.
  const flap =
    anim === 'walk'
      ? [0, 1, 2, 1, 0, -1][f % 6]
      : anim === 'idle'
        ? [0, 0.5, 1, 0.5][f % 4]
        : breach * 0.5;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  const z = 0.5 + breach * 0.7 + flinch * 0.3;

  // Corpo central: baixo e largo, mas com LOMBO. A primeira versao tinha 3 de
  // altura contra 12 de comprimento e projetava como um tapete; o dorso agora
  // sobe ao dobro no meio, e e essa corcova que separa "bicho" de "mancha".
  for (let s = 0; s < 5; s++) {
    const x = -6 + s * 2.4;
    const d = 5.4 - s * 0.7;
    const h = [3.5, 5, 5.5, 4, 2.6][s];
    b.push(box(x, -d / 2, z, 2.4, d, h, 'water'));
  }
  // Cauda em chicote: quatro segmentos finos, ondulando fora de fase.
  for (let s = 0; s < 4; s++) {
    const ph = Math.round(Math.sin((s + f) * 1.2)) * 0.6;
    b.push(box(-8.4 - s * 1.6, -0.7 + ph, z + 0.6, 1.6, 1.4, 1.4 - s * 0.2, 'water'));
  }
  // AS ASAS: as duas placas largas que dao nome ao bicho. Nascem coladas ao
  // lombo e DESCEM ate a borda, entao a secao le como asa e nao como prateleira
  // saindo do meio do corpo. A ponta bate o dobro da raiz.
  // Cinco tiras por asa, com a corda encolhendo e as pontas alinhadas para
  // TRAS: a membrana sai triangular, como asa de arraia. Em tres tiras largas
  // com degraus de altura, como estava, ela projetava como uma escadaria de
  // prateleiras saindo do meio do corpo.
  for (const s of [-1, 1]) {
    for (let w = 0; w < 5; w++) {
      const lift = flap * (w + 1) * 0.3 * s;
      const wy = s > 0 ? 2.4 + w * 1.1 : -3.5 - w * 1.1;
      b.push(box(-5.4 + w * 1.1, wy, z + 2.4 - w * 0.25 + lift * 0.5, 7.2 - w * 1.2, 1.1, 1, 'water'));
    }
  }
  // LINHAS LATERAIS CONDUTIVAS: dois frisos de corrente correndo do focinho a
  // cauda, na quina do lombo. Sao o unico brilho do corpo e apontam para o
  // contra-jogo — o que para este bicho e eletrificar a agua embaixo dele.
  for (let s = 0; s < 5; s++) {
    const d = 5.4 - s * 0.7;
    const h = [3.5, 5, 5.5, 4, 2.6][s];
    b.push(box(-6 + s * 2.4, -d / 2 - 0.3, z + h - 1.2, 2.4, 0.6, 0.6, 'electric'));
    b.push(box(-6 + s * 2.4, d / 2 - 0.3, z + h - 1.2, 2.4, 0.6, 0.6, 'electric'));
  }
  // A cabeca: cunha achatada e larga, com fendas branquiais e a boca em fresta
  // — nao um focinho de peixe, um sugador de fundo.
  const hx = 6.4 + breach * 0.4;
  b.push(box(hx - 0.4, -3, z, 1.4, 6, 3, 'water'));
  b.push(box(hx + 1, -2.2, z, 1.2, 4.4, 2.4, 'water'));
  b.push(box(hx + 2.2, -1.4, z, 1.2, 2.8, 1.8, 'water')); // focinho em cunha
  b.push(box(hx + 1, -2, z + 0.2, 0.8, 4, 1, 'bone')); // a boca
  for (const dy of [-2.8, 2.2]) {
    b.push(box(hx - 0.2, dy, z + 0.6, 0.6, 0.6, 1.8, 'rockDeep'));
    b.push(box(hx + 1, dy, z + 0.6, 0.6, 0.6, 1.8, 'rockDeep'));
  }
  // Olhos no TOPO da cabeca, nao na frente: ele vive por baixo e olha para
  // cima, que e de onde a presa vem.
  b.push(box(hx + 0.2, -1.9, z + 3, 0.8, 0.8, 0.6, 'electric'));
  b.push(box(hx + 0.2, 1.1, z + 3, 0.8, 0.8, 0.6, 'electric'));
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-lung-matrix — o Pulmao-Matriz da Fenda Sulfurosa.
//
// FIXO: nao tem pernas e nao vai ter. Ele esta ancorado nos respiradouros por
// tubos enraizados no chao, e a ausencia de meio de locomocao e informacao —
// quem ve isto sabe que fugir dele funciona, e que o problema e o que ele faz
// com o ar da sala.
//
// O saco nasceu CUBICO e um cubo de 9 de lado com tampo `loot` (a face de topo
// mais clara da paleta) le como engradado, nao como orgao. Agora ele e uma
// abobada: cinco camadas de pegada decrescente, sem nenhum tampo grande, e as
// costelas ACOMPANHAM a curva em vez de correrem retas por cima. Materia mole
// nao tem quina — a unica quina do modelo e a gaiola de osso que a comprime, e
// e justamente esse contraste que conta o que esta acontecendo ali.
//
// O ciclo E o modelo: `idle` inspira e solta, `special` e a inspiracao cheia
// (zona limpa em volta) e `attack` e a expiracao espremida (o jato). O saco
// inchado tambem e a janela de dano — e ele que pega fogo.
// ---------------------------------------------------------------------------
const lungMatrixModel = (anim, f) => {
  const breath = anim === 'idle' ? [0, 1, 2, 1][f % 4] : 0;
  const inhale = anim === 'special' ? Math.min(3, f) : 0;
  const exhale = anim === 'attack' ? [0, 1.5, 3, 1.5][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];

  // RAIZES: quatro tubos de ferrugem descendo do corpo e mordendo o chao. Sao
  // a razao de ele nao perseguir ninguem, e por isso sao grossos e visiveis.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      // Os tubos ABREM para fora enquanto descem e terminam num pe largo: uma
      // coluna reta com pastilha embaixo le como PERNA, e a unica coisa que
      // este chefe nao pode parecer e capaz de andar.
      b.push(box(sx * 2.2 - 1, sy * 2.2 - 1, 2.4, 2, 2, 2, 'rust'));
      b.push(box(sx * 2.9 - 1.1, sy * 2.9 - 1.1, 1, 2.2, 2.2, 1.6, 'rust'));
      b.push(box(sx * 3.6 - 1.6, sy * 3.6 - 1.6, 0, 3.2, 3.2, 1.2, 'rockDeep'));
    }
  }
  b.push(box(-3.6, -3.6, 4, 7.2, 7.2, 1.5, 'rust'));

  // O SACO, em abobada. `swell` e o folego; a pegada de cada camada encolhe
  // para cima, entao o topo e uma cupula e nao um tampo.
  const swell = breath * 0.5 + inhale * 0.6 - exhale * 0.8;
  const z = 5.5 - flinch * 0.5;
  const layers = [
    { w: 8.4, h: 2.6 },
    { w: 9.6, h: 2.6 },
    { w: 9.2, h: 2.4 },
    { w: 7.6, h: 2.2 },
    { w: 5.2, h: 2 },
    { w: 2.8, h: 1.4 },
  ];
  let lz = z;
  for (const layer of layers) {
    const w = layer.w + swell;
    b.push(box(-w / 2, -w / 2, lz, w, w, layer.h, 'sulfur'));
    lz += layer.h;
  }
  const top = lz;

  // COSTELAS: quatro arcos de osso subindo pela abobada em degraus que seguem
  // a curva dela. Elas NAO mudam de tamanho com o folego — e por isso que o
  // saco parece pressionado por elas em vez de simplesmente encolher.
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let rz = z;
    for (const layer of layers) {
      const w = layer.w + swell;
      const rx = dx === 0 ? -1 : dx * (w / 2 - 0.2) - (dx < 0 ? 0.8 : 0);
      const ry = dy === 0 ? -1 : dy * (w / 2 - 0.2) - (dy < 0 ? 0.8 : 0);
      b.push(box(rx, ry, rz, dx === 0 ? 2 : 1, dy === 0 ? 2 : 1, layer.h, 'bone'));
      rz += layer.h;
    }
  }
  // Coroa de valvulas no alto da cupula: por onde o orgao sangra gas quando
  // esta cheio demais.
  b.push(box(-1.2, -1.2, top, 2.4, 2.4, 1.2, 'rust'));

  // TRAQUEIA frontal: o bocal por onde a expiracao sai. Fica na altura media do
  // saco e projeta para FORA da abobada — e o unico apendice do corpo, entao e
  // ele que diz de que lado o sopro vem.
  const ty = -(layers[1].w + swell) / 2;
  b.push(box(-1.8, ty - 2.8, z + 3, 3.6, 3, 3.6, 'rust'));
  b.push(box(-1.2, ty - 3.2, z + 3.8, 2.4, 0.6, 1.8, 'rockDeep'));
  if (exhale >= 1.5) {
    for (let p = 0; p < 4; p++) {
      b.push(box(-1 + (p % 2) * 1.2, ty - 4 - p * 1.6, z + 3.4 + p * 0.4, 1.2, 1.2, 1.2, 'acid'));
    }
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-furnace-heart — o Coracao da Fornalha Abissal.
//
// FIXO, como o Pulmao, e pelo mesmo motivo: a luta e contra a SALA. O que o
// modelo tem de entregar e o ciclo, porque o ciclo e a unica decisao que o
// jogador toma — ele nao escolhe quando bater, escolhe onde estar quando puder.
//
// SUPERAQUECIDO (blindado): as placas fecham sobre a brasa, as espinhas sobem e
// so as frestas brilham. RESFRIANDO (vulneravel): as placas se abrem e o nucleo
// aparece inteiro. E a mesma linguagem da couraça do Escoriaceo na escala de um
// chefe — repeticao deliberada, nao falta de ideia: o jogador ja sabe ler
// "placa fechada = nao entra".
//
// A base era um pedestal de dois degraus centrados, e pedestal e ARQUITETURA.
// Isto e geologia: o monte agora e assimetrico, com blocos de escoria de
// tamanhos diferentes empilhados fora de eixo.
// ---------------------------------------------------------------------------
const furnaceHeartModel = (anim, f) => {
  // `special` e o superaquecimento (fecha) e `attack` e a onda que sai dele;
  // `idle` respira devagar entre os dois, que e o estado neutro do ciclo.
  const shut = anim === 'special' ? Math.min(2, f) : anim === 'attack' ? [2, 1, 0, 1][f % 4] : 0;
  const open = anim === 'idle' ? [0, 0.5, 1, 0.5][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  // Espalhamento das placas: fechado no superaquecimento, aberto no resfriar.
  const gap = 1.6 - shut * 0.8 + open;

  // Monte de escoria fria, assimetrico: cinco blocos fora de eixo. Um monte
  // regular lê como construcao, e isto e a rocha que o nucleo rompeu.
  b.push(box(-5.5, -4.6, 0, 10.5, 9.4, 2.6, 'rockDeep'));
  b.push(box(-4.8, -3.4, 2.6, 6.2, 7.4, 2.4, 'rockDeep'));
  b.push(box(-0.6, -4.2, 2.6, 5.4, 6.4, 3.2, 'rockDeep'));
  b.push(box(-4.4, -2.6, 5, 3.4, 4.4, 1.8, 'scorch'));
  b.push(box(1.2, -3.6, 5.8, 3.2, 5.2, 1.4, 'scorch'));

  // O NUCLEO: sempre presente, e a fonte de toda a luz do modelo. Ele nao muda
  // de tamanho com o ciclo — o que muda e o quanto as placas o cobrem, e essa
  // distincao e o que ensina "abrir e a janela".
  b.push(box(-3.4, -3.4, 5.4, 6.8, 6.8, 6.6, 'fire'));
  b.push(box(-2, -2, 12, 4, 4, 2.4, 'fire'));

  // PLACAS: quatro laminas em volta do nucleo, afastando-se dele quando abre.
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const px = -2.5 + dx * (3.2 + gap * 0.8) - (dx < 0 ? 1.5 : 0);
    const py = -2.5 + dy * (3.2 + gap * 0.8) - (dy < 0 ? 1.5 : 0);
    const pw = dx === 0 ? 6.8 : 2;
    const pd = dy === 0 ? 6.8 : 2;
    b.push(box(px, py, 4.8 - flinch * 0.5, pw, pd, 8, 'rockDeep'));
    b.push(box(px, py, 12.8 - flinch * 0.5, pw, pd, 0.5, 'scorch'));
  }
  // ESPINHAS: sobem no superaquecimento e somem no resfriar. Sao o aviso que se
  // le de mais longe — a SILHUETA muda antes de a cor mudar.
  if (shut >= 1) {
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.push(box(sx * 3.4 - 0.5, sy * 3.4 - 0.5, 11.8, 1, 1, 1.5 + shut, 'scorch'));
    }
  }
  // Frestas: com as placas abertas, veios de brasa vazam pela base do monte.
  if (gap >= 1.6) {
    b.push(box(-5, -1, 5.4, 2.5, 1, 0.8, 'fire'));
    b.push(box(2.5, 0.5, 5.4, 2.5, 1, 0.8, 'fire'));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-frost-queen — a Rainha da Geada, na Cripta Glacial.
//
// A unica figura HUMANOIDE entre os chefes de estrato, e isso e a escolha: os
// outros sao orgaos, maquinas e bichos, e ela e a coisa que tem POSTURA.
//
// A primeira versao nao tinha postura nenhuma: a saia era uma sequencia de
// degraus centrados que encolhiam para cima, e o resultado foi um ZIGURATE —
// um bolo de casamento de gelo. A licao e a mesma que o Coveiro deu com a
// pilha de lajes: silhueta se faz por PROPORCAO, nao por detalhe. Uma figura de
// pe precisa de tres larguras distintas na vertical (saia larga, cintura
// estreita, ombros medios) e de algo saindo para os LADOS na altura dos bracos.
// Um cone de degraus so tem uma largura, que diminui — e isso e um monte.
//
// A couraça dela e o estrato: placas de gelo crescidas sobre um corpo escuro que
// so aparece pelas frestas. Derreter o lago em volta e o contra-jogo, e o modelo
// diz por que — tire o gelo e o que sobra e a coisa magra debaixo dele.
// ---------------------------------------------------------------------------
const frostQueenModel = (anim, f) => {
  const glide = anim === 'walk' ? [0, 0.5, 1, 1, 0.5, 0][f % 6] : 0;
  // `special` e a carga do congelamento: os bracos sobem e as lascas crescem.
  const raise = anim === 'special' ? Math.min(3, f) : anim === 'attack' ? [1, 3, 2, 0][f % 4] : 0;
  const drift = anim === 'idle' ? [0, 0.5, 0.5, 0][f % 4] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  const b = [];
  const z = drift + glide * 0.3;

  // SAIA: um tronco ESTREITO do chao a cintura, com o alargamento so na barra.
  // Duas larguras, nao seis — a saia tem de ler como uma peça, e a barra e o
  // que arrasta. As lascas soltas na borda sao a nevoa; sao elas, e nao mais
  // degraus, que quebram a base.
  b.push(box(-1.8, -1.6, z + 4, 3.6, 3.2, 5, 'ice'));
  b.push(box(-2.6, -2.2, z + 1.6, 5.2, 4.4, 2.4, 'ice'));
  b.push(box(-3.4, -2.8, z, 6.8, 5.6, 1.6, 'ice'));
  for (let i = 0; i < 7; i++) {
    const a = (i * 2 * Math.PI) / 7 + glide * 0.3;
    b.push(box(Math.cos(a) * 3.6 - 0.45, Math.sin(a) * 3 - 0.45, z + (i % 2) * 0.8, 0.9, 0.9, 1.4 + (i % 3) * 0.6, 'ice'));
  }

  // CINTURA e TRONCO: a parte mais estreita do corpo inteiro, e e ela que faz a
  // figura ler como figura. O corpo por baixo e ESCURO, e a fresta entre as duas
  // placas de gelo deixa ver isso — a promessa do contra-jogo.
  b.push(box(-1.2, -1, z + 9, 2.4, 2, 5.6, 'rockDeep'));
  b.push(box(-2.2, -1.5, z + 9.4, 1.5, 3, 5, 'ice'));
  b.push(box(0.7, -1.5, z + 9.4, 1.5, 3, 5, 'ice'));

  // OMBROS: uma barra atravessada, mais larga que a cintura e mais estreita que
  // a barra da saia. E o terceiro degrau de largura, e sem ele nao ha figura.
  b.push(box(-3.2, -1.2, z + 14 - flinch * 0.5, 6.4, 2.4, 1.6, 'ice'));

  // BRACOS de sincelo: finos, sem mao — terminam em ponta, e saem para os LADOS
  // antes de descer. Sobem na carga, e e nesse gesto que o telegrafo do
  // congelamento acontece.
  for (const s of [-1, 1]) {
    const ax = s * 3.4 - 0.5;
    b.push(box(ax, -0.7, z + 13 - flinch * 0.5, 1.1, 1.6, 1.6, 'ice'));
    b.push(box(ax, -0.7, z + 9.5 + raise * 1.4, 1.1, 1.4, 3.5 + raise * 0.4, 'ice'));
  }

  // PESCOCO e CABECA: pequenos. A cabeca pequena sobre ombros largos e o que
  // da ESCALA a figura — do tamanho da cintura, ela viraria um boneco.
  b.push(box(-0.8, -0.8, z + 15.6 - flinch * 0.5, 1.6, 1.6, 1.2, 'rockDeep'));
  b.push(box(-1.4, -1.4, z + 16.8 - flinch * 0.5, 2.8, 2.8, 2.4, 'ice'));
  // O rosto: dois pontos de corrente na fresta escura. Nada mais — e o unico
  // brilho do modelo e ele fica na altura dos olhos de proposito.
  b.push(box(-1.1, -1.7, z + 17.6 - flinch * 0.5, 0.7, 0.6, 0.7, 'electric'));
  b.push(box(0.4, -1.7, z + 17.6 - flinch * 0.5, 0.7, 0.6, 0.7, 'electric'));

  // COROA: cinco lascas desiguais, a do meio mais alta. Crescem com a carga —
  // a silhueta anuncia antes de a cor mudar, como no Coracao.
  [1.4, 2.4, 4, 2.4, 1.4].forEach((hgt, i) => {
    b.push(box(-1.5 + i * 0.8, -0.4, z + 19.2 - flinch * 0.5, 0.7, 0.9, hgt + raise * 0.5, 'ice'));
  });
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

// ---------------------------------------------------------------------------
// enemy-magnetarch — o Magnetarca do Estrato Ferrifero.
//
// Nao e uma criatura e nao pode parecer uma: e um NUCLEO de magnetita suspenso
// dentro de dois aneis de ferro. Nao tem pernas, nao tem rosto e nao toca o chao.
//
// Os aneis sairam pontilhados na primeira versao — oito cubos de lado 1 num
// raio de 4,5 nao sao um anel, sao oito cubos. Ficaram vinte segmentos
// SOBREPOSTOS por anel, e o segmento cresceu para 1,4: a circunferencia fecha e
// o olho le uma peça unica girando, que era o ponto.
//
// A polaridade e a luta inteira, e ela se le na distancia dos aneis: atraindo,
// eles se fecham sobre o nucleo; repelindo, se abrem. O jogador nao precisa de
// icone — o campo esta desenhado no corpo, e a faixa segura e o que sobra entre
// os dois.
// ---------------------------------------------------------------------------
const RING_SEGMENTS = 20;
const magnetarchModel = (anim, f) => {
  // ATRAINDO e `attack` (os aneis fecham); REPELINDO e `special` (abrem).
  const pull = anim === 'attack' ? [2, 3, 3, 2][f % 4] : 0;
  const push = anim === 'special' ? Math.min(3, f) : 0;
  const hover = [0, 0.5, 1, 0.5][f % 4];
  const glide = anim === 'walk' ? [0, 0.5, 1, 0.5, 0, -0.5][f % 6] : 0;
  const flinch = anim === 'hit' ? [1, 0][f % 2] : 0;
  // Raio dos aneis. A amplitude e curta de proposito: com aneis abrindo o dobro
  // disto o sprite passava de 170px de largura projetada — mais largo que o
  // Diamandis — e prometia uma massa que um chefe de raio 0,8 nao tem. A
  // polaridade se le na PROPORCAO entre anel e nucleo, e essa nao depende de o
  // anel ser grande.
  const r = 4 - pull * 0.5 + push * 0.7;
  const b = [];

  // Ele PAIRA, entao a base e o vazio. O que ancora a leitura no chao e uma
  // pequena chuva de limalha suspensa logo abaixo — sem ela o corpo flutua sem
  // referencia e o jogador nao sabe onde ele esta pisando.
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 + f * 0.4;
    b.push(box(Math.cos(a) * 2.4 - 0.35, Math.sin(a) * 2.4 - 0.35, 0.4 + (i % 3) * 0.5, 0.7, 0.7, 0.7, 'rust'));
  }

  const z = 6 + hover + glide * 0.5 - flinch;
  // O NUCLEO: um octaedro grosseiro de magnetita, e o volume DOMINANTE. Ele era
  // menor que os aneis e por isso o bicho lia como uma nuvem com um ponto no
  // meio; agora e o anel que orbita alguma coisa, que e a leitura certa.
  b.push(box(-2.6, -2.6, z + 1.6, 5.2, 5.2, 4.4, 'rockDeep'));
  b.push(box(-1.8, -1.8, z, 3.6, 3.6, 1.6, 'rockDeep'));
  b.push(box(-1.8, -1.8, z + 6, 3.6, 3.6, 1.6, 'rockDeep'));
  // Costuras: dois frisos cruzados de corrente, mais uma cinta equatorial. E o
  // unico brilho, e ele diz "campo", nao "olho".
  b.push(box(-2.9, -0.5, z + 3.2, 5.8, 1, 1, 'electric'));
  b.push(box(-0.5, -2.9, z + 3.2, 1, 5.8, 1, 'electric'));
  b.push(box(-2.7, -2.7, z + 5.4, 5.4, 5.4, 0.6, 'electric'));

  // OS DOIS ANEIS, em planos perpendiculares. Segmentos sobrepostos e um giro
  // lento com o quadro para nao lerem como estrutura parada.
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const a = (i * 2 * Math.PI) / RING_SEGMENTS + f * 0.16;
    b.push(box(Math.cos(a) * r - 0.7, -0.7, z + 3.2 + Math.sin(a) * r - 0.7, 1.4, 1.4, 1.4, 'rust'));
    const a2 = a + Math.PI / RING_SEGMENTS;
    b.push(box(-0.7, Math.cos(a2) * r - 0.7, z + 3.2 + Math.sin(a2) * r - 0.7, 1.4, 1.4, 1.4, 'rust'));
  }
  // SUCATA presa ao campo: tres cacos de ferro, e sao TRES porque cinco viravam
  // ruido em volta do anel. Colados no nucleo quando ele puxa, arremessados
  // para fora quando ele empurra — o estado do campo em objetos, e nao so na
  // geometria dos aneis.
  const debris = 1.4 + pull * -0.3 + push * 0.8;
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3 - f * 0.3;
    b.push(box(
      Math.cos(a) * (r + debris) - 0.7,
      Math.sin(a) * (r + debris) - 0.7,
      z + 2 + (i % 3) * 1.6,
      1.4,
      1.4,
      1.4,
      i % 2 ? 'bone' : 'rust'
    ));
  }
  return anim === 'die' ? collapse(b, dieT(f)) : b;
};

const diamandisFrame = (dir, anim, f) =>
  renderVoxels(diamandisModel(anim, f), DIR_INDEX[dir], 120, 138, 58, 114);
const devourerFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(devourerModel(anim, f)), DIR_INDEX[dir], 104, 94, 50, 71);
const archcantorFrame = (dir, anim, f) =>
  renderVoxels(archcantorModel(anim, f), DIR_INDEX[dir], 64, 114, 30, 97);
const leviathanFrame = (dir, anim, f) =>
  renderVoxels(quarterTurn(leviathanModel(anim, f)), DIR_INDEX[dir], 124, 80, 60, 51);
const lungMatrixFrame = (dir, anim, f) =>
  renderVoxels(lungMatrixModel(anim, f), DIR_INDEX[dir], 116, 112, 56, 88);
const furnaceHeartFrame = (dir, anim, f) =>
  renderVoxels(furnaceHeartModel(anim, f), DIR_INDEX[dir], 116, 108, 56, 84);
const frostQueenFrame = (dir, anim, f) =>
  renderVoxels(frostQueenModel(anim, f), DIR_INDEX[dir], 60, 118, 28, 101);
const magnetarchFrame = (dir, anim, f) =>
  renderVoxels(magnetarchModel(anim, f), DIR_INDEX[dir], 128, 98, 62, 83);

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
// DRONE RASTREADOR: quadricoptero kamikaze visto de cima, em isometrico
// achatado (2:1). A leitura que importa: MAQUINA, nao inseto. Um mosquito e
// pernas finas penduradas, tromba comprida e asas de membrana — aqui nada
// disso existe: quatro DISCOS de rotor solidos girando em X, bracos curtos e
// grossos, chassi facetado com a mesma key light de todo volume do jogo, e a
// carga explosiva pulsando ambar no centro — o unico ponto quente do corpo,
// dizendo "isto e uma bomba com helices" antes de qualquer legenda.
const droneFrame = (_dir, _anim, f) => {
  const g = grid(32, 32);
  // Cubos de rotor em X, achatados pela projecao. Pares diagonais giram em
  // sentidos opostos, como num quad de verdade.
  const hubs = [
    { x: 8, y: 11, ccw: false },
    { x: 24, y: 11, ccw: true },
    { x: 8, y: 21, ccw: true },
    { x: 24, y: 21, ccw: false },
  ];
  // Bracos primeiro, por baixo de tudo: curtos e grossos, de chassi.
  for (const hub of hubs) thickLine(g, 16, 16, hub.x, hub.y, 2, 'rockLight');
  // Chassi central facetado, frio como o casco do projetil em jogo.
  fillDiamond(g, 16, 16, 5, 3, 'rock');
  fillDiamond(g, 15, 15, 3, 2, 'mist');
  set(g, 14, 14, 'player');
  // A CARGA: nucleo emissivo pulsando no centro. E o kamikaze do nome.
  fillRect(g, 15, 15, 2, 2, f % 2 === 0 ? 'amber' : 'beam');
  // Rotores por cima dos bracos: disco de borrao solido, cubo escuro no eixo e
  // duas pas claras opostas que giram um oitavo de volta por quadro.
  hubs.forEach((hub, i) => {
    fillEllipse(g, hub.x, hub.y, 4, 2, 'mist');
    const a = (hub.ccw ? -1 : 1) * ((f * Math.PI) / 4) + (i * Math.PI) / 8;
    for (const opposite of [0, Math.PI]) {
      set(g, hub.x + Math.cos(a + opposite) * 3, hub.y + Math.sin(a + opposite) * 1.5, 'player');
    }
    set(g, hub.x, hub.y, 'dark');
  });
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
  base('enemy-mud-lamprey', 64, 64, 32, 60, { w: 0.8, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, mudLampreyFrame, 'voxel-isometric low mud eel, undulating dark segments, serrated dorsal fin, circular bone-ringed mouth, twin bioluminescent eyes', 2),
  base('enemy-bellows', 64, 64, 32, 60, { w: 1, h: 0.9 }, { w: 1.1, h: 1.1, offsetX: 0, offsetY: 0 }, living, bellowsFrame, 'voxel-isometric wide breathing sac creature, sulfur-yellow bladder caged by bone ribs, rusted valve mouth, squat rust feet', 2),
  base('enemy-scoriac', 64, 64, 32, 60, { w: 0.88, h: 0.8 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, scoriacFrame, 'voxel-isometric slag beetle, cold black scoria plates over a living ember core glowing through the seams, six charcoal legs', 2),
  base('enemy-frost-wraith', 64, 64, 32, 60, { w: 0.72, h: 0.6 }, { w: 1, h: 1, offsetX: 0, offsetY: 0 }, living, frostWraithFrame, 'voxel-isometric pale ice wraith, low elongated milky body, translucent dorsal blade fin, wedge head with twin electric eyes', 2),
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
  // Chefes. Todos nascem em `version: 1` — sao os primeiros pixels destes
  // atlases; ate agora estes oito arquetipos desenhavam pelo recuo do cliente.
  //
  // O `special` de cada um e o TELEGRAFO que mais importa naquele chefe, e nao
  // um segundo ataque: broca carregando, verme rasgando o chao, canto inchando
  // os tubos, mergulho, inspiracao, superaquecimento, coroa carregando o
  // congelamento, campo invertendo. Foi o que o Coveiro ensinou — apontar o
  // `special` para o golpe seguinte em vez de para o aviso em curso mostra o
  // membro errado se movendo na hora que decide a luta.
  base('enemy-diamandis', 120, 138, 58, 114, { w: 1.8, h: 2.4 }, { w: 2, h: 2, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 8, loop: false },
  }, diamandisFrame, 'voxel-isometric walking industrial excavator boss, conical advance drill head, exposed ember reactor in the belly, three-canister demolition rack on the back, fragile prospecting mast with a cold sensor lens, four heavy track feet, rusted Aurix chassis — a working machine, never a weapon', 1),
  base('enemy-white-devourer', 104, 94, 50, 71, { w: 2.2, h: 1.2 }, { w: 2, h: 1.6, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, devourerFrame, 'voxel-isometric pale silica worm boss, seven tapering plated segments with bone joint rings, eyeless, circular bone tooth ring around a dark gullet, loose sand shedding from the flanks', 1),
  base('enemy-archcantor', 64, 114, 30, 97, { w: 1.4, h: 2.2 }, { w: 1.6, h: 1.6, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 9, loop: false },
  }, archcantorFrame, 'voxel-isometric prismatic cathedral cantor boss, dark rock body with five uneven electric crystal organ pipes growing from its back, resonance cavity instead of a face, crown of crystal shards, no arms and no weapon', 1),
  base('enemy-sheet-leviathan', 124, 80, 60, 51, { w: 2.2, h: 1.4 }, { w: 2, h: 1.8, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 10, loop: false },
  }, leviathanFrame, 'voxel-isometric black aquifer ray-leviathan boss, broad flat wing sheets, whip tail, conductive electric lateral lines running nose to tail, flattened wedge head with gill slits and a slit mouth, top-mounted eyes', 1),
  // Pulmao e Coracao sao FIXOS na simulacao (speed 0) e por isso nao tem
  // `walk`: um atlas com marcha para quem nunca sai do lugar seria 24 quadros
  // de textura que nenhum frame do jogo chega a pedir. O cliente ja cai em
  // `idle` para animacao ausente.
  base('enemy-lung-matrix', 116, 112, 56, 88, { w: 1.8, h: 1.8 }, { w: 2, h: 2, offsetX: 0, offsetY: 0 }, {
    idle: { frames: 4, fps: 5, loop: true },
    attack: { frames: 4, fps: 10, loop: false },
    special: { frames: 4, fps: 6, loop: false },
    hit: { frames: 2, fps: 12, loop: false },
    die: { frames: 5, fps: 10, loop: false },
  }, lungMatrixFrame, 'voxel-isometric anchored sulfur lung organ boss, huge yellow gas sac caged by four bone ribs, rusted root pipes biting the floor, frontal trachea valve venting sulfur, accessory sacs on the back — no legs', 1),
  base('enemy-furnace-heart', 116, 108, 56, 84, { w: 2, h: 2 }, { w: 2, h: 2, offsetX: 0, offsetY: 0 }, {
    idle: { frames: 4, fps: 5, loop: true },
    attack: { frames: 4, fps: 10, loop: false },
    special: { frames: 4, fps: 8, loop: false },
    hit: { frames: 2, fps: 12, loop: false },
    die: { frames: 5, fps: 10, loop: false },
  }, furnaceHeartFrame, 'voxel-isometric anchored igneous core boss, four dark slag plates opening and closing around a permanent molten core, charred plate edges, scoria mound base, spines rising when overheated — no legs', 1),
  base('enemy-frost-queen', 60, 118, 28, 101, { w: 1.2, h: 2.2 }, { w: 1.4, h: 1.4, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 9, loop: false },
  }, frostQueenFrame, 'voxel-isometric glacial crypt queen boss, humanoid posture, dragging skirt of ice and mist instead of legs, dark narrow body showing through gaps between ice plates, icicle arms without hands, five-shard crown, two electric eyes', 1),
  base('enemy-magnetarch', 128, 98, 62, 83, { w: 1.4, h: 1.8 }, { w: 1.6, h: 1.6, offsetX: 0, offsetY: 0 }, {
    ...living,
    special: { frames: 4, fps: 9, loop: false },
  }, magnetarchFrame, 'voxel-isometric hovering magnetite core boss, rough dark octahedron with glowing electric seams, two perpendicular iron segment rings that tighten or widen with polarity, orbiting scrap debris, suspended iron filings below — no legs, no face', 1),
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
  {
    id: 'fx-seeker-drone', version: 1, frameWidth: 32, frameHeight: 32, anchorX: 16, anchorY: 16,
    directions: 1, authoredDirs: ['n'], flipPairs: {}, hitbox: { w: 0.32, h: 0.32 },
    footprint: { w: 0, h: 0, offsetX: 0, offsetY: 0 },
    animations: { fly: { frames: 4, fps: 12, loop: true } }, draw: droneFrame,
    prompt: 'voxel-isometric kamikaze quadcopter drone, four solid rotor discs in X, faceted cold chassis, pulsing amber demolition core — machine, not insect',
  },
];
