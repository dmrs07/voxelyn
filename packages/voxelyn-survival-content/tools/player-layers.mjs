import { renderVoxels } from './voxel.mjs';
import {
  ATTACHMENT_IDS,
  MINIGUN_FAN_FRAMES,
  MODULE_ATTACHMENTS,
  minigunGun,
} from './prospector-modules.mjs';
import {
  ANCHOR_X,
  ANCHOR_Y,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  RENDER_ANCHOR_X,
  RENDER_ANCHOR_Y,
  WALK_FRAMES,
  WALK_SWING,
  gunAnchor,
  prospectorParts,
  walkFps,
} from './prospector.mjs';

const DIRS = ['dr', 'dl', 'ur', 'ul'];
const DIR_INDEX = { dr: 0, dl: 1, ur: 2, ul: 3 };

const idleBob = [0, 0, 1, 0];
// Coice: parado, recua fundo no disparo, volta. O clarao so existe no frame
// em que a arma cospe — um clarao que dura a animacao inteira vira lanterna.
const attackKick = [0, 2, 1, 0];
/** Quadros de `attack` em que a boca do cano acende. */
export const ATTACK_FLASH = [false, true, false, false];
const attackFlash = ATTACK_FLASH;

/**
 * Cadencia da caminhada, casada com a velocidade do Prospector na simulacao.
 *
 * O numero NAO e escolhido a olho. `PLAYER_SPEED` e 4,6 tiles/s e a passada
 * autorada cobre `WALK_CYCLE_TILES` por ciclo, entao a duracao do ciclo esta
 * determinada: qualquer outro valor faz o pe patinar contra o chao. Escrito como
 * a propria conta para o dia em que a velocidade mudar — muda-se o 4.6 e a
 * animacao acompanha, em vez de alguem redescobrir a relacao por tentativa.
 *
 * Duplicar a constante aqui e proposital e coberto por teste: o pacote de
 * conteudo nao depende da simulacao (ele so precisa de @voxelyn/core), e
 * inverter essa dependencia so para ler um numero acoplaria o pipeline de arte
 * ao balanceamento.
 */
const PLAYER_SPEED_TILES_PER_SECOND = 4.6;
const WALK_FPS = walkFps(PLAYER_SPEED_TILES_PER_SECOND);

/** Quadros de cada animacao das camadas, para quem precisa varrer as poses. */
export const LAYER_POSE_FRAMES = {
  idle: idleBob.length,
  walk: WALK_FRAMES,
  attack: attackKick.length,
};

/** Pose exata que cada quadro do atlas de camadas assa. */
export const poseFor = (anim, frame) => {
  if (anim === 'walk') return prospectorParts({ swing: WALK_SWING[frame % WALK_FRAMES] });
  if (anim === 'attack') {
    return prospectorParts({
      kick: attackKick[frame % attackKick.length],
      flash: attackFlash[frame % attackFlash.length],
    });
  }
  return prospectorParts({ bob: idleBob[frame % idleBob.length] });
};

/**
 * Os argumentos de POSE de um quadro, que `poseFor` consome mas nao devolve.
 *
 * Os modulos precisam deles crus: eles nao sao partes do `prospectorParts`, e
 * mesmo assim tem de acompanhar coice, respiracao e agachamento voxel a voxel.
 * Reconstruir a pose aqui (em vez de deixar cada modulo adivinhar) e o que
 * garante que a peca acoplada nunca descole do cano — a mesma razao pela qual
 * `gunAnchor` existe um nivel abaixo.
 */
const poseArgsFor = (anim, frame) => {
  if (anim === 'walk') return { swing: WALK_SWING[frame % WALK_FRAMES] };
  if (anim === 'attack') {
    return {
      kick: attackKick[frame % attackKick.length],
      flash: attackFlash[frame % attackFlash.length],
    };
  }
  return { bob: idleBob[frame % idleBob.length] };
};

/**
 * As caixas de um MODULO acoplado, neste quadro.
 *
 * OS ACOPLADOS seguem a pose do tronco, quadro a quadro: eles estao parafusados
 * no Cravador, e o Cravador recua no disparo.
 *
 * A MINIGUN NAO. Os quatro quadros dela codificam SO a posicao da ventoinha, e
 * o corpo fica na pose de repouso. Duas razoes, e as duas vieram de medir o que
 * o jogo faz de verdade:
 *
 *  1. A rotacao nao cabe no relogio da acao. A simulacao passa ~450 ms subindo
 *     antes de emitir o primeiro `action_start`, e desce sem emitir nenhum:
 *     amarrar a ventoinha a animacao de `attack` a deixaria PARADA durante as
 *     duas transicoes que a arma inteira existe para vender.
 *  2. E o relogio da acao nem e continuo. A rajada agregada republica
 *     `action_start` com um `startTick` novo a cada quatro ticks, e
 *     `visualActionElapsed` reancora a cada troca de `startTick` — a animacao
 *     de quatro quadros a 12 fps reiniciava a cada 200 ms sem nunca chegar ao
 *     quarto. Um coice assado herdaria essa mesma gagueira.
 *
 * Quem escolhe o quadro, entao, e o cliente, a partir de `barrelPhase` — o
 * angulo que `MinigunViews` ja integra da rotacao autoritativa. O coice nao se
 * perde: `recoilScreenOffset` desloca a arma inteira e e aplicado fora da
 * escolha de quadro.
 */
const moduleBoxes = (id, anim, frame) => {
  if (id === 'minigun') return minigunGun({ fan: frame });
  return MODULE_ATTACHMENTS[id](gunAnchor(poseArgsFor(anim, frame)));
};

const renderModule = (dir, anim, frame, id) =>
  renderVoxels(
    moduleBoxes(id, anim, frame),
    DIR_INDEX[dir],
    FRAME_WIDTH,
    FRAME_HEIGHT,
    RENDER_ANCHOR_X,
    RENDER_ANCHOR_Y
  );

const renderPart = (dir, anim, frame, part) =>
  renderVoxels(
    poseFor(anim, frame)[part],
    DIR_INDEX[dir],
    FRAME_WIDTH,
    FRAME_HEIGHT,
    RENDER_ANCHOR_X,
    RENDER_ANCHOR_Y
  );

/** Todo modulo que tem camada propria: os seis acoplados mais a Minigun. */
export const ALL_MODULE_IDS = [...ATTACHMENT_IDS, 'minigun'];

/** O id de atlas de um modulo. Uma funcao so, lida pelo gerador e pelo cliente. */
export const moduleLayerId = (id) => `layer-module-${id.replace(/_/g, '-')}`;

/**
 * Referência comum de enquadramento usada pelos atlas. O gerador inclui
 * estes frames ao calcular a união visual e aplica exatamente o mesmo dx/dy às
 * pernas, ao tronco, à arma e aos módulos, preservando cintura, anchor e escala
 * entre as camadas.
 */
const fitReference = () => {
  const frames = [];
  const animations = [
    ['idle', idleBob.length],
    ['walk', WALK_FRAMES],
    ['attack', attackKick.length],
  ];
  for (const dir of DIRS) {
    for (const [anim, count] of animations) {
      for (let frame = 0; frame < count; frame++) {
        const pose = poseFor(anim, frame);
        // Os MODULOS entram na referencia junto com o corpo, e isso e o que
        // mantem as camadas alinhadas. `fitSpriteToMargin` centraliza o
        // conteudo da uniao: se a lanca do perfurante ou os canos da Minigun
        // ficassem de fora, a camada do modulo receberia um dx diferente do
        // corpo e a peca nasceria deslocada do cano — em pixels, e so em
        // algumas direcoes.
        //
        // Incluir tudo aqui custa nada em bytes (a referencia e descartada) e
        // troca um desalinhamento silencioso por um enquadramento comum. Ha
        // teste conferindo que a ancora declarada nao se mexeu com isso.
        const withModules = [
          ...ALL_MODULE_IDS.flatMap((id) => moduleBoxes(id, anim, frame)),
        ];
        frames.push(renderVoxels(
          [...pose.lower, ...pose.upper, ...pose.gun, ...withModules],
          DIR_INDEX[dir],
          FRAME_WIDTH,
          FRAME_HEIGHT,
          RENDER_ANCHOR_X,
          RENDER_ANCHOR_Y
        ));
      }
    }
  }
  return frames;
};

const baseLayer = (id, animations, draw, prompt) => ({
  id,
  // 7: coxa e jarrete passam a acompanhar metade da passada (fim do patinar).
  version: 7,
  frameWidth: FRAME_WIDTH,
  frameHeight: FRAME_HEIGHT,
  anchorX: ANCHOR_X,
  anchorY: ANCHOR_Y,
  directions: 4,
  authoredDirs: DIRS,
  flipPairs: {},
  hitbox: { w: 0.68, h: 1 },
  footprint: { w: 1, h: 1, offsetX: 0, offsetY: 0 },
  animations,
  draw,
  fitReference,
  prompt,
});

export const PLAYER_LAYER_SPECS = [
  baseLayer(
    'layer-player-prospector-lower',
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      walk: { frames: WALK_FRAMES, fps: WALK_FPS, loop: true },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'lower'),
    'digitigrade locomotion layer for the Aurix PX prospector bot'
  ),
  // O tronco tem `walk` desde que os bracos existem: o braco de extracao
  // balanca com a passada (ver `prospectorParts`), e sem quadros proprios ele
  // ficaria duro enquanto as pernas andam. A cadencia e a MESMA das pernas —
  // as duas camadas leem `WALK_FPS` — para o balanco casar com o passo.
  baseLayer(
    'layer-player-prospector-upper',
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      walk: { frames: WALK_FRAMES, fps: WALK_FPS, loop: true },
      attack: { frames: attackKick.length, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'upper'),
    'chassis, back hardpoint and sensor head layer for the Aurix PX prospector bot'
  ),
  // Mesmas animações do tronco, quadro a quadro: a arma acompanha o coice, e
  // qualquer divergência de contagem faria o cano descolar do braço no disparo.
  // Inclui `walk` pelo mesmo motivo: o tronco anda, e a arma tem de ter a
  // animacao correspondente — mas de UM quadro so. O braco da arma nao
  // balanca com a passada (o coice e a unica animacao dele, e `gunAnchor` nem
  // le `swing`), entao os seis quadros da marcha seriam seis copias do mesmo
  // desenho: 24 quadros por atlas, em nove atlas, para nada. Um quadro que
  // dura a marcha inteira e a arma parada na mira enquanto o corpo se move.
  baseLayer(
    'layer-player-prospector-gun',
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      walk: { frames: 1, fps: WALK_FPS, loop: true },
      attack: { frames: attackKick.length, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderPart(dir, anim, frame, 'gun'),
    'shard driver weapon layer for the Aurix PX prospector bot, tinted by barrel heat at runtime'
  ),
];

/**
 * As camadas de MODULO: uma por peca, com os mesmos quadros da arma.
 *
 * `idle`, `walk` e `attack`, exatamente como a camada da arma: o modulo
 * acompanha o TRONCO, e e o tronco que decide se o bot esta andando ou
 * atirando. Qualquer divergencia de contagem faria a peca descolar do cano no
 * disparo — o mesmo motivo pelo qual a arma ja copia esses numeros do tronco.
 *
 * A Minigun entra na mesma lista porque ela e desenhada do mesmo jeito, mas ela
 * NAO e um acoplamento: o cliente troca a camada `gun` por ela em vez de somar
 * as duas. Ver `prospector-modules.mjs`.
 */
export const MODULE_LAYER_SPECS = ALL_MODULE_IDS.map((id) =>
  baseLayer(
    moduleLayerId(id),
    {
      idle: { frames: idleBob.length, fps: 6, loop: true },
      // Nada parafusado no cano balanca com a passada (ver a camada da arma),
      // entao `walk` e um quadro so. A Minigun e a excecao pelo motivo
      // contrario: o quadro dela e a posicao da ventoinha, que o cliente
      // escolhe pelo angulo em QUALQUER animacao, entao o `walk` dela precisa
      // das quatro posicoes — e de nenhuma a mais.
      walk:
        id === 'minigun'
          ? { frames: MINIGUN_FAN_FRAMES, fps: WALK_FPS, loop: true }
          : { frames: 1, fps: WALK_FPS, loop: true },
      attack: { frames: attackKick.length, fps: 12, loop: false },
    },
    (dir, anim, frame) => renderModule(dir, anim, frame, id),
    id === 'minigun'
      ? 'rotary cannon weapon layer replacing the shard driver on the Aurix PX prospector bot'
      : `${id.replace(/_/g, ' ')} module hardware bolted onto the shard driver of the Aurix PX prospector bot`
  )
);
