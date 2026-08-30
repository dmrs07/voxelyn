// PROSPECTOR — Unidade Modular PX, Aurix Dynamics.
//
// Modelo voxel unico, compartilhado pelo sheet completo (`entities.mjs`) e pelas
// tres camadas de runtime (`player-layers.mjs`). Estava duplicado nos dois
// arquivos e os dois ja tinham divergido: o sheet carregava uma PICARETA e as
// camadas carregavam a arma que a substituiu, entao o personagem trocava de
// modelo toda vez que soltava o gatilho. Uma fonte so torna essa divergencia
// impossivel em vez de improvavel.
//
// O QUE ELE E, e por que o desenho mudou por inteiro
// ---------------------------------------------------
// Nao e um mineiro de macacao com capacete. E um BOT de mineracao modular: 1,35 m,
// 280 kg, chassi PX com hardpoints, reator interno e braco de extracao. A leitura
// tem de dizer maquina industrial antes de dizer personagem, porque tudo o mais
// no jogo depende disso — o Miner e "o que sobra de mim" e so significa alguma
// coisa se o jogador se reconhecer nele, e o Eco de morte deixa uma CARCACA.
//
// Quatro decisoes carregam a silhueta:
//
// 1. PERNAS DIGITIGRADAS. Joelho invertido, canela subindo para tras, pe longo
//    com garras a frente. E a unica parte do corpo que nenhuma criatura do
//    bestiario tem, e e o que se ve primeiro de longe. Pernas retas fariam dele
//    mais um bipede humanoide numa tela que ja tem tres.
// 2. SEM PESCOCO. A cabeca e uma caixa baixa assentada nos ombros e inclinada
//    para a frente. Pescoco e a assinatura de bicho; ausencia de pescoco e a de
//    equipamento.
// 3. FAROL DE UM LADO SO. O farol tatico quente fica na face esquerda e o visor
//    cyan atravessa a frente. A assimetria e o que faz o rumo do bot ser legivel
//    em qualquer uma das quatro direcoes sem depender do corpo inteiro.
// 4. MODULO NAS COSTAS. O hardpoint traseiro e o volume que fecha a silhueta por
//    tras e o unico lugar onde a plataforma modular aparece no corpo. Ele
//    substitui o modulo fungico da versao anterior: o Prospector nao e feito de
//    fungo, ele desce ate onde o fungo esta.
//
// PALETA. Latao gasto (`rust`, com topo cor de osso) sobre aco escuro
// (`rockDeep`), cyan (`biolum`) so no visor, no nucleo e no indicador do modulo,
// azul (`electric`) nos cabos condutivos, e UM ponto quente (`loot`/`player`) no
// farol. Tres materiais e tres luzes; qualquer coisa a mais vira ruido a 4px por
// voxel.
import { box } from './voxel.mjs';

/**
 * Enquadramento comum ao sheet completo e as tres camadas.
 *
 * Maior que os 32x40 do mineiro de macacao que ele substitui, e por dois motivos
 * que nao sao "o bot e maior": o chassi e LARGO (a ficha diz 1,35 m de altura
 * para 280 kg, ou seja, baixo e pesado), e a passada de verdade joga o pe tres
 * voxels a frente do corpo — a mesma passada que o ciclo antigo nao tinha.
 *
 * Continua abaixo do Miner (48x60) de proposito. O Miner e o Prospector
 * degradado e grande demais, curvado sob a propria carga; se os dois medissem o
 * mesmo, a leitura do encontro inteiro se perderia.
 */
// Dobrado junto com MODEL_SCALE: o modelo continua o mesmo, mas cada unidade
// autorada projeta 2x2x2 voxels finos, entao o frame e a ancora medem o dobro
// de pixels. O tamanho em MUNDO nao muda — o cliente desenha com metade do
// zoom (ATLAS_SCALE) e o bot ocupa o mesmo tile de sempre.
export const FRAME_WIDTH = 88;
export const FRAME_HEIGHT = 112;
export const ANCHOR_X = 44;
export const ANCHOR_Y = 108;
/** Origem de desenho do rasterizador; o enquadramento final vem do fitToMargin. */
export const RENDER_ANCHOR_X = 40;
export const RENDER_ANCHOR_Y = 100;

/**
 * Unidades AUTORADAS por tile do mundo: 8 continua valendo — a autoria nao
 * mudou de escala. Em voxels finos um tile tem 16; quem converte passada em
 * tiles (walkFps) trabalha na unidade autorada e nao ve a subdivisao.
 */
export const VOXELS_PER_TILE = 8;

/**
 * Balanco do pe ao longo do ciclo de caminhada, em voxels no eixo do corpo.
 *
 * A tabela e uma rampa LINEAR de +3 a -3 e de volta, e nao uma senoide. Isso
 * importa: durante o apoio o pe tem de andar para tras a uma taxa CONSTANTE,
 * porque e ele que finge estar preso ao chao enquanto o corpo avanca. Com uma
 * senoide o pe desacelera nos extremos e o personagem parece patinar duas vezes
 * por passo — exatamente o defeito que uma cadencia bem calculada nao conserta.
 *
 * As duas pernas usam a mesma tabela defasada de tres quadros, entao enquanto
 * uma apoia a outra avanca.
 */
export const WALK_SWING = [3, 1, -1, -3, -1, 1];
export const WALK_FRAMES = WALK_SWING.length;
/** Amplitude do balanco, em voxels: metade da passada. */
export const STRIDE_VOXELS = 3;
/**
 * Distancia que o corpo percorre num ciclo completo, em tiles.
 *
 * Duas passadas por ciclo, cada uma do tamanho da abertura entre os pes: 4x a
 * amplitude, em voxels, dividido por voxels por tile. E este numero que amarra a
 * animacao a velocidade do personagem — ver `walkFps`.
 */
export const WALK_CYCLE_TILES = (4 * STRIDE_VOXELS) / VOXELS_PER_TILE;

/**
 * Cadencia do ciclo de caminhada para uma dada velocidade do personagem.
 *
 * O ciclo antigo nao tinha passada NENHUMA: `stride` so levantava a bota alguns
 * voxels em z, sem deslocar o pe no eixo do corpo. O personagem marchava no
 * lugar enquanto deslizava pela sala a 4,6 tiles por segundo, e nao havia
 * cadencia que consertasse isso — nao ha o que sincronizar com um pe que nao
 * anda.
 *
 * Com passada de verdade a conta e direta: o ciclo cobre `WALK_CYCLE_TILES`, e
 * ele tem de durar exatamente o tempo que o personagem leva para cobrir a mesma
 * distancia. Fora disso o pe patina — para a frente se a animacao for lenta
 * demais, para tras se for rapida demais.
 */
export const walkFps = (tilesPerSecond) =>
  (WALK_FRAMES * tilesPerSecond) / WALK_CYCLE_TILES;

/**
 * ONDE A ARMA ESTA MONTADA, nesta pose. Origem unica do hardpoint direito.
 *
 * Existe porque a arma deixou de ser a unica coisa presa ali. Os modulos se
 * acoplam A ELA (`prospector-modules.mjs`), e um acessorio que calculasse a
 * propria altura a partir de uma copia do `chest` descolaria do cano no
 * primeiro quadro de coice — que e exatamente o modo de falha que o cabecalho
 * deste arquivo descreve entre o sheet e as camadas, um nivel acima.
 *
 * Devolve o canto de origem do RECEPTOR (o bloco palido). Tudo o mais — cano,
 * trilho, camara e os seis pontos de acoplagem — e offset a partir daqui, e
 * por isso `bob`, `kick`, `lean` e `crouch` entram numa conta so.
 *
 * O eixo: `-y` e a FRENTE (a boca do cano esta em `y - 3`), `+x` e o lado
 * direito do bot e `+z` sobe. Vale para os acessorios tanto quanto para a arma.
 */
export const gunAnchor = ({ bob = 0, kick = 0, lean = 0, crouch = 0 } = {}) => {
  const up = bob - Math.max(0, Math.min(4, crouch));
  return { x: 2, y: -1 + kick + lean, z: 6 + up + 2 + 2 };
};

/**
 * Uma perna digitigrada. `swing` desloca pe e canela no eixo do corpo; a coxa
 * fica presa ao quadril, que e o que faz o conjunto ler como perna girando em
 * torno da bacia em vez de escorregar inteira para o lado.
 */
const leg = (lx, swing) => {
  const b = [];
  const s = Math.round(swing);
  // A COXA ACOMPANHA METADE DA PASSADA. Antes so pe e canela transladavam e
  // coxa/jarrete ficavam cravados no lugar: a perna nao GIRAVA em torno do
  // quadril, deslizava por baixo dele, e o bot lia como se patinasse. Uma
  // caixa nao cisalha; a rotacao e aproximada em degraus — quadril fixo, coxa
  // superior parada, coxa inferior e jarrete a meio caminho do pe.
  const h = s * 0.5;
  // Pe longo e chato, com garras palidas na ponta. Sao as garras que dizem que
  // ele AGARRA terreno, e nao que ele calca bota.
  b.push(box(lx, -2 + s, 0, 2, 3, 1, 'rockDeep'));
  b.push(box(lx, -3 + s, 0, 2, 1, 1, 'bone'));
  // Canela subindo PARA TRAS a partir do pe. A diagonal invertida e a leitura
  // inteira da perna: nenhuma criatura do bestiario dobra o joelho para tras, e
  // e o que se enxerga do bot antes de qualquer detalhe.
  b.push(box(lx, -1 + s, 1, 2, 2, 2, 'rockDeep'));
  // Pistao hidraulico da ficha: haste palida de meio-passo saliente na frente
  // da canela, acompanhando a passada. E o detalhe que faz a perna ler como
  // mecanismo articulado e nao como coluna dobrada.
  b.push(box(lx + 0.5, -1.5 + s, 1, 1, 0.5, 2, 'bone'));
  // Jarrete: a junta que dobra ao contrario, um degrau atras da canela.
  // Acompanha a coxa inferior — e a junta entre os dois segmentos que giram.
  b.push(box(lx, 1 + h, 3, 2, 2, 1, 'rust'));
  // Pino da junta: um rebite de ouro MEIO-PASSO SALIENTE na face frontal do
  // jarrete. Saliente, e nao rente: um voxel fino embutido na casca fica com a
  // unica face exposta virada para fora do quadrante visivel e a ordem do
  // pintor o enterra — applique de detalhe fino se projeta da face.
  b.push(box(lx + 0.5, 0.5 + h, 3.5, 1, 0.5, 0.5, 'loot'));
  // Coxa em DOIS degraus: a metade de baixo inclina com a passada, a de cima
  // fica presa ao quadril — e o degrau entre elas que desenha a rotacao.
  b.push(box(lx, 0 + h, 4, 2, 2, 1, 'rust'));
  b.push(box(lx, 0, 5, 2, 2, 1, 'rust'));
  return b;
};

/**
 * Partes do Prospector em pe, separadas nas tres camadas de runtime.
 *
 * `crouch` encurta o conjunto e baixa todo o resto na mesma medida — sem isso o
 * tronco descola da bacia nos quadros de queda e de revive. `lean` inclina
 * chassi e cabeca para a frente no dano. `kick` e o coice do disparo, e vale
 * para o braco da arma e para a arma juntos.
 *
 * HIERARQUIA DE VOLUMES, que e o que faz o bot ser legivel a 4px por voxel:
 * chassi de latao (o maior), bacia e ombreiras de aco escuro em volta dele,
 * cabeca ESCURA e menor que tudo por cima, e tres luzes — visor, nucleo e farol.
 * Cada peca a mais que nao entra nessa lista vira ruido nesta escala, e a
 * primeira versao deste modelo tinha oito delas.
 */
export const prospectorParts = ({
  bob = 0,
  swing = 0,
  kick = 0,
  flash = false,
  lean = 0,
  crouch = 0,
} = {}) => {
  const lower = [];
  const upper = [];
  const gun = [];

  const c = Math.max(0, Math.min(4, crouch));
  const up = bob - c;
  // Base LARGA: as duas pernas ficam nas bordas do chassi, com tres voxels de
  // vao entre elas. Juntas no meio, um bipede de 280 kg le como pedestal.
  lower.push(...leg(-3, swing));
  lower.push(...leg(1, -swing));

  // BACIA de aco escuro, mais larga que o chassi: e ela que recebe as duas
  // pernas e esconde a emenda entre as camadas quando elas animam em cadencias
  // diferentes.
  const hip = 6 + up;
  upper.push(box(-3, -1 + lean, hip, 7, 3, 2, 'rockDeep'));

  // CHASSI. Caixa de latao, o volume dominante do bot.
  //
  // A CHAPA DE TOPO e escura, e essa e a peca mais importante do modelo inteiro.
  // O material `rust` tem rampa [topo, esquerda, direita] = ['bone', 'rust',
  // 'rockShadow']: o topo dele e cor de OSSO, quase branco. Nesta isometria 2:1 a
  // face de topo e a maior de qualquer volume horizontal, entao um chassi de 5x4
  // voxels em latao projeta um plano quase branco do tamanho do bot — e o
  // personagem le como um tampo de mesa sobre pernas, que foi o que aconteceu em
  // tres versoes seguidas deste modelo.
  //
  // Com um voxel de aco escuro por cima, o latao passa a aparecer so nas
  // LATERAIS, que e onde ele deve aparecer: chassi de bronze visto de lado,
  // blindagem escura vista de cima. E o mesmo esquema da ficha.
  const chest = hip + 2;
  upper.push(box(-2, -2 + lean, chest, 5, 4, 4, 'rust'));
  upper.push(box(-2, -2 + lean, chest + 4, 5, 4, 1, 'rockDeep'));
  // DETALHE DE MEIO-PASSO (grade fina). Tudo aqui e APPLIQUE: caixas de 0.5
  // salientes um voxel fino para FORA da face que decoram. Rente a casca nao
  // funciona — o voxel fino embutido fica com todas as faces visiveis cobertas
  // por vizinhos solidos e a ordem do pintor o enterra.
  //
  // Venezianas de exaustao no flanco esquerdo do chassi: duas fendas escuras.
  // Sao elas que fazem o latao ler como carcaca de maquina e nao como caixa
  // pintada.
  upper.push(box(-2.5, -1 + lean, chest + 1, 0.5, 2, 0.5, 'rockDeep'));
  upper.push(box(-2.5, -1 + lean, chest + 2, 0.5, 2, 0.5, 'rockDeep'));
  // Costura de chapa no flanco direito: uma junta vertical escura dividindo o
  // flanco em dois paineis.
  upper.push(box(3, -0.5 + lean, chest + 0.5, 0.5, 0.5, 3, 'rockDeep'));
  // NUCLEO DE ENERGIA, como na ficha da Aurix (painel 2): um NICHO escuro
  // embutido na frente do chassi com DUAS barras verticais de cyan dentro. Na
  // grade grossa isso era impossivel — a barra unica de 1 voxel era o maximo
  // que a escala sustentava; no meio-passo as duas barras tem 2px cada, com
  // 2px de recesso escuro entre elas, e o reator le como reator.
  // Curtas de proposito (2 voxels autorados): mais altas que isso elas sobem
  // ate a sombra da cabeca e leem como tiras penduradas do visor, competindo
  // com ele — o reator e um ORGAO no peito, nao um segundo rosto.
  upper.push(box(-1, -2.5 + lean, chest + 0.5, 3, 0.5, 3, 'rockDeep'));
  upper.push(box(-0.5, -3 + lean, chest + 1, 0.5, 0.5, 2, 'biolum'));
  upper.push(box(0.5, -3 + lean, chest + 1, 0.5, 0.5, 2, 'biolum'));

  // HARDPOINT TRASEIRO: o modulo nas costas, com o indicador aceso. Menor que o
  // chassi de proposito — ele fecha a silhueta por tras sem disputar com ela.
  upper.push(box(-1, 2 + lean, chest + 1, 3, 2, 4, 'rockDeep'));
  // Trilhos-padrao Aurix (ficha, painel 3): duas guias de meio-passo descendo a
  // face externa do modulo. Sao os encaixes de carga modular — a razao de o
  // modulo existir — e viram textura vertical que separa "hardpoint" de "caixa".
  upper.push(box(-1, 4 + lean, chest + 1.5, 0.5, 0.5, 3, 'rust'));
  upper.push(box(0.5, 4 + lean, chest + 1.5, 0.5, 0.5, 3, 'rust'));
  upper.push(box(1, 3 + lean, chest + 3, 1, 1, 1, 'biolum'));
  // Cabo condutivo saindo do modulo e descendo pelo flanco. UM, e nao dois: a
  // fiacao e assinatura, nao textura.
  upper.push(box(-2, 3 + lean, chest, 1, 1, 3, 'electric'));

  // OMBREIRAS de latao, um voxel alem do chassi de cada lado: a linha mais larga
  // do corpo fica na altura dos ombros, como na ficha.
  const shoulder = chest + 3;
  upper.push(box(-3, -2 + lean, shoulder, 1, 4, 2, 'rust'));
  upper.push(box(3, -2 + lean, shoulder, 1, 4, 2, 'rust'));
  // Rebites de meio-passo nas ombreiras: um por ombro, no canto da frente. E o
  // que separa "chapa aparafusada" de "bloco da mesma cor".
  upper.push(box(-3, -2.5 + lean, shoulder + 1.5, 0.5, 0.5, 0.5, 'bone'));
  upper.push(box(3.5, -2.5 + lean, shoulder + 1.5, 0.5, 0.5, 0.5, 'bone'));

  // BRACO DE EXTRACAO, a esquerda: coluna escura descendo ate a altura do
  // quadril, com a garra palida na ponta. E o membro assimetrico do bot — do
  // outro lado fica a arma — e e o que a ficha chama de ferramenta multiuso.
  upper.push(box(-3, -1 + lean, chest - 1, 1, 2, 4, 'rockDeep'));
  upper.push(box(-3, -2 + lean, chest - 2, 1, 2, 1, 'bone'));
  // Garra magnetica da ficha (painel 4): a mao termina em DOIS dedos de
  // meio-passo abertos para baixo, com o vao entre eles. Antes a ferramenta era
  // um toco palido; os dedos sao o que a torna uma garra que agarra.
  upper.push(box(-3, -2 + lean, chest - 3, 0.5, 0.5, 1, 'bone'));
  upper.push(box(-2.5, -0.5 + lean, chest - 3, 0.5, 0.5, 1, 'bone'));
  // Braco da arma, a direita: curto e recolhido, porque ele sustenta.
  upper.push(box(3, -1 + lean + kick, chest + 1, 1, 2, 3, 'rockDeep'));

  // CABECA: bloco de sensores baixo e ESTREITO, sem pescoco, projetado a frente.
  //
  // Estreito por uma razao de projecao, e nao de estilo: nesta isometria 2:1 a
  // face de topo e a maior e a mais clara de qualquer caixa. Uma cabeca LARGA no
  // ponto mais alto do modelo projeta o maior plano claro do personagem, e o bot
  // inteiro passa a ler como um tampo de mesa sobre pernas — foi exatamente o
  // que aconteceu na primeira versao deste modelo, e e o mesmo defeito que o
  // Corcel tinha. Com tres voxels de largura sobre um chassi de cinco, o plano
  // que domina volta a ser o do chassi, que e o volume que deve dominar.
  const head = shoulder + 2;
  upper.push(box(-1, -3 + lean * 2, head, 3, 4, 1, 'rust'));
  // Mesma chapa escura do chassi, pela mesma razao: nenhuma superficie
  // horizontal grande pode ficar em latao.
  upper.push(box(-1, -3 + lean * 2, head + 1, 3, 4, 1, 'rockDeep'));
  // Faixa ESCURA atravessando a frente do bloco: e a moldura do visor, e e ela
  // que impede a luz cyan de encostar direto no latao. Sem a moldura o visor
  // lia como uma fita colada por cima da cabeca em vez de uma fresta dentro dela.
  upper.push(box(-1, -4 + lean * 2, head, 3, 1, 1, 'rockDeep'));
  upper.push(box(-1, -4 + lean * 2, head + 1, 3, 1, 1, 'biolum'));
  // FAROL TATICO, so na face esquerda: carcaca escura, lente quente e o miolo
  // branco. Tres voxels, e o ponto mais claro do personagem inteiro — e o que o
  // jogador localiza no breu antes de localizar o corpo. Num bot simetrico o
  // rumo dependeria do corpo todo; com o farol de um lado so, basta ele.
  //
  // A lente usa o material `lamp`, que existe para isto: branco quente sobre
  // brasa, tres faces emissivas. Nem `loot`, que e OURO — o farol nao emitiria e
  // acenderia menos que o cascalho no chao — nem `fire`, que e CHAMA: um farol
  // tatico nao queima, e a cor que desenha incendio no chao nao pode desenhar o
  // equipamento que ilumina o caminho.
  upper.push(box(-2, -3 + lean * 2, head, 1, 2, 2, 'rockDeep'));
  upper.push(box(-2, -4 + lean * 2, head, 1, 1, 2, 'lamp'));

  // CRAVADOR DE ESTILHACOS, montado no hardpoint direito.
  //
  // A 4px por voxel a arma tem de ler por CONTRASTE e SILHUETA, nao por detalhe:
  // receptor palido atravessado contra o chassi escuro, camara de energia de UM
  // voxel e a boca do cano apontada para a frente. No disparo ela recua no eixo
  // do corpo em vez de girar — o giro seria invisivel neste tamanho.
  // A arma sai do ancoramento compartilhado, e nao de uma conta local: e o
  // mesmo ponto que os modulos acoplados leem.
  const a = gunAnchor({ bob, kick, lean, crouch });
  gun.push(box(a.x, a.y - 2, a.z, 2, 3, 1, 'bone'));
  // Trilho superior escuro de meio-passo sobre o receptor palido: da a arma uma
  // linha de mira e quebra o bloco unico em corpo + trilho, sem engordar a
  // silhueta — o meio-passo sobe no vao entre a arma e a cabeca.
  gun.push(box(a.x, a.y - 2, a.z + 1, 2, 3, 0.5, 'rockDeep'));
  gun.push(box(a.x, a.y - 1, a.z + 1, 1, 1, 1, 'biolum'));
  gun.push(box(a.x, a.y - 3, a.z, 1, 1, 1, flash ? 'loot' : 'rust'));

  return { lower, upper, gun };
};

/**
 * Prospector CAIDO, de lado no chao. Silhueta horizontal — em co-op este e o
 * estado que o parceiro precisa reconhecer de longe para vir reanimar, entao ele
 * nao pode parecer so uma versao baixinha da pose em pe.
 *
 * O farol e o nucleo ficam virados para CIMA e continuam acesos: um bot caido
 * ainda tem energia, e sao eles que atravessam o breu para dizer onde ele esta.
 */
export const prospectorProne = ({ breath = 0, settle = 0 } = {}) => {
  const z = settle + 1;
  const b = [];
  // Recolhido e centrado no MESMO eixo da pose em pe: na projecao isometrica
  // largura e profundidade somam na mesma diagonal, entao membros estendidos
  // empurram a UNIAO das poses para fora do frame mesmo com cada pose cabendo
  // sozinha.
  // Cabeca no chao, farol para cima.
  b.push(box(-1, -4, z, 3, 3, 2, 'rust'));
  b.push(box(-1, -4, z + 2, 3, 2, 1, 'biolum'));
  b.push(box(-2, -3, z + 1, 1, 1, 1, 'loot'));
  // Chassi deitado, com o nucleo virado para cima.
  b.push(box(-2, -2, z, 5, 4, 2, 'rust'));
  b.push(box(-1, -1, z + 2, 3, 2, 1, 'rockDeep'));
  b.push(box(0, -1, z + 2 + breath, 1, 1, 1, 'biolum'));
  // Modulo traseiro tombado ao lado.
  b.push(box(-2, 2, z, 5, 2, 2, 'rockDeep'));
  // Pernas dobradas contra o chassi, com as garras a mostra.
  b.push(box(-2, 1, z, 2, 2, 2, 'rockDeep'));
  b.push(box(1, 1, z, 2, 2, 2, 'rockDeep'));
  b.push(box(-2, -4, z, 1, 1, 1, 'bone'));
  // Braco de extracao estendido, e a arma caida do outro lado.
  b.push(box(-3, -2, z, 1, 3, 1, 'rockDeep'));
  b.push(box(3, -1, z, 1, 2, 1, 'bone'));
  return b;
};
