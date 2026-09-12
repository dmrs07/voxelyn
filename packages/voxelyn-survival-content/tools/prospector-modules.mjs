// OS MODULOS ACOPLADOS A ARMA — replicas voxel dos cartuchos Aurix, montadas no
// Cravador de Estilhacos e vistas nas mesmas quatro direcoes do bot.
//
// ---------------------------------------------------------------------------
// POR QUE ISTO NAO E UMA SOBREPOSICAO PROCEDURAL
// ---------------------------------------------------------------------------
// A primeira Minigun montada no bot foi desenhada em runtime (`minigun-mount.
// ts`), com o argumento de que quatro rumos x N posicoes de cano dariam quadros
// demais para uma peca de vinte segundos. O argumento estava errado em dois
// pontos, e vale registrar os dois porque eles decidem a forma deste arquivo:
//
//  1. A CONTA. A camada da arma inteira — quatro direcoes, idle e attack, 32
//     quadros de 88x112 — pesa 12,9 kB de PNG. Sete modulos na mesma forma
//     custam cerca de 100 kB contra os 8,4 MB de atlas que o jogo ja carrega.
//     Nao havia orcamento a proteger.
//  2. A LUZ. O desenho procedural nao participa do rasterizador: ele nao tem
//     mapa de normais, nao tem oclusao de ambiente, nao entra na ordem do
//     pintor com o corpo e nao recebe a luz por face que o resto do bot recebe.
//     Um acessorio desenhado por cima fica CHAPADO ao lado de um chassi
//     facetado, e a 4px por voxel isso e a diferenca entre "peca montada" e
//     "adesivo".
//
// ---------------------------------------------------------------------------
// OS SEIS PONTOS DE ACOPLAGEM
// ---------------------------------------------------------------------------
// O jogador pode ter cinco modificadores ativos ao mesmo tempo, e todos se
// montam na mesma arma. Cada um tem um ponto PROPRIO, e nenhum divide volume
// com outro — a leitura tem de sobreviver a montagem cheia:
//
//   frente/eixo    perfurante   lanca palida prolongando o cano
//   frente/baixo   explosivo    tambor de latao com ogiva quente
//   frente/alto    condutivo    emissor com aresta viva azul
//   frente/externo disco        o disco dourado de perfil, num braco curto
//   externo/alto   ricochete    duas aletas defletoras
//   externo/baixo  sifao        tanque com visor de fluido
//
// A alocacao NAO e arbitraria, e o mapa acima e o SEGUNDO: o primeiro punha
// pecas na culatra e no flanco interno, e os dois pontos nao existem. O chassi
// ocupa x[-2,3] y[-2,2] z[8,12] e a ombreira direita x[3,4] z[11,13] — tudo o
// que fica atras da boca ou para dentro do receptor nasce ENTERRADO. Medido, e
// nao suposto: `siphon` e `return_disc` sairam 100% dentro do corpo na
// primeira tentativa, `conductive` 75%.
//
// Sobra, entao, exatamente duas regioes livres em volta da arma — a FRENTE
// (y <= -3, adiante do chassi e da boca) e o LADO DE FORA (x >= 4, adiante da
// ombreira) —, e os seis pontos sao subdivisoes delas. Dentro dessa restricao a
// funcao ainda manda: o perfurante prolonga o cano, o explosivo pendura massa
// embaixo, o condutivo precisa de ceu para descarregar, o ricochete deflete
// para fora, o sifao e reservatorio (vai embaixo, onde nao disputa contorno) e
// o disco sai pela frente porque e por ali que ele volta.
//
// Toda peca ENCOSTA na arma. Um acessorio flutuando a um voxel do receptor le
// como erro de montagem, e o `return_disc` precisou de um braco curto de
// ligacao justamente por isso.
//
// ---------------------------------------------------------------------------
// A MINIGUN NAO SE ACOPLA: ELA SUBSTITUI
// ---------------------------------------------------------------------------
// Ela e o unico modulo com a tag `weapon`, e a simulacao BLOQUEIA o tiro comum
// enquanto ela tem municao (`activeWeaponModule`, em `modules.ts`). Desenhar as
// duas armas juntas faria a silhueta mentir sobre qual delas dispara.
//
// E pela mesma matriz de compatibilidade, os seis acessorios SOMEM enquanto ela
// esta montada: eles continuam instalados, com as cargas intactas, mas nao
// valem na bala da Minigun. O corpo do bot passa a contar isso sozinho.
//
// ---------------------------------------------------------------------------
// ESCALA
// ---------------------------------------------------------------------------
// Um voxel autorado e 1/8 de tile e projeta 4px no atlas. Isso e MUITO pouco:
// nenhuma peca aqui passa de tres voxels na maior dimensao, e o que separa uma
// da outra e a silhueta contra o ceu — nao a textura. A regra que segui em
// todas: uma forma dominante, um material de acento, e nada de detalhe interno
// que nao mude o contorno.
import { box } from './voxel.mjs';
import { gunAnchor } from './prospector.mjs';

/**
 * Os acessorios, por id de modulo da simulacao.
 *
 * Cada entrada recebe o ANCORAMENTO da arma na pose corrente e devolve as
 * caixas. Receber o ancoramento (e nao recalcula-lo) e o que mantem a peca
 * colada ao cano durante o coice, o agachamento e a inclinacao: as tres poses
 * mexem no mesmo ponto, e quem le esse ponto acompanha de graca.
 *
 * `-y` e a frente, `+x` e o lado direito do bot, `+z` sobe. O receptor da arma
 * ocupa x[a.x, a.x+2], y[a.y-2, a.y+1], z[a.z, a.z+1], com o trilho ate
 * z+1,5 e a boca do cano em y-3.
 */
export const MODULE_ATTACHMENTS = {
  /**
   * PERFURANTE — a lanca no eixo do cano.
   *
   * Raiz escura, haste palida, ponta rebaixada: tres voxels a frente da boca. E
   * o unico acessorio que muda o COMPRIMENTO da arma, e por isso o mais
   * legivel de longe — o contorno do bot ganha uma agulha que nenhum outro
   * modulo produz.
   */
  piercing: (a) => [
    box(a.x, a.y - 4, a.z, 1, 1, 1, 'rockDeep'),
    box(a.x, a.y - 5.5, a.z, 1, 1.5, 1, 'bone'),
    // Ponta rebaixada meio voxel: sem ela a lanca acaba num toco quadrado e
    // volta a ler como "cano mais comprido" em vez de peca montada.
    box(a.x, a.y - 6, a.z, 1, 0.5, 0.5, 'bone'),
  ],

  /**
   * EXPLOSIVO — o tambor sob o cano.
   *
   * Massa pendurada embaixo: e o unico acessorio que BAIXA o centro visual da
   * arma, e a leitura pretendida e de peso. A ogiva quente aponta para a frente
   * junto com o cano — um explosivo cuja ponta olhasse para outro lado
   * prometeria uma mecanica que o jogo nao tem.
   */
  explosive: (a) => [
    box(a.x, a.y - 4, a.z - 1, 2, 2, 1, 'rust'),
    box(a.x + 0.5, a.y - 5, a.z - 1, 1, 1, 1, 'fire'),
  ],

  /**
   * CONDUTIVO — o emissor sobre o trilho.
   *
   * O unico acessorio que sobe acima da linha da arma, porque descarga precisa
   * de ceu: e a silhueta contra o fundo que o distingue, nao a cor.
   *
   * A lamina azul e mais ESTREITA que a carcaca que a sustenta, e isso nao e
   * enfeite. Na primeira tentativa ela cobria a carcaca inteira, e nesta
   * isometria a face de topo e a maior de qualquer volume horizontal: o modulo
   * lia como uma losango azul chapado flutuando sobre o ombro. Estreita, ela
   * volta a ler como emissor apoiado numa base.
   *
   * `electric` e nao `biolum`: o azul e o mesmo dos cabos condutivos do chassi,
   * e o cyan ja significa "nucleo" — nao pode passar a significar duas coisas.
   */
  conductive: (a) => [
    box(a.x, a.y - 4, a.z + 1.5, 2, 2.5, 1, 'rockDeep'),
    box(a.x + 0.5, a.y - 4, a.z + 2.5, 1, 2.5, 1, 'electric'),
  ],

  /**
   * DISCO DE RETORNO — o disco de perfil, sobre a boca.
   *
   * DE PERFIL e a unica orientacao que sobrevive as quatro direcoes: um disco
   * de frente vira circulo num rumo e traco no seguinte, e o jogador perderia a
   * peca em metade das poses. O berco atravessa da boca ate o trilho — sem ele
   * o disco flutua, e peca flutuante le como erro de montagem.
   */
  return_disc: (a) => [
    box(a.x, a.y - 5, a.z + 1, 2, 3, 0.5, 'rockDeep'),
    box(a.x + 0.5, a.y - 5, a.z + 1.5, 1, 0.5, 2, 'loot'),
  ],

  /**
   * RICOCHETE — o par de aletas defletoras, para fora.
   *
   * Duas, com meio voxel de vao: encostadas viram um bloco so, e o que diz
   * "defletor" e o PAR. Ficam para fora porque e para fora que a bala sai
   * quando desvia — e porque o flanco externo, ADIANTE da ombreira, e o unico
   * lugar do lado direito que ainda recorta contra o fundo.
   */
  ricochet: (a) => [
    box(a.x + 2, a.y - 3.5, a.z, 1, 2.5, 0.5, 'rockDeep'),
    box(a.x + 2, a.y - 3.5, a.z + 0.5, 1, 1, 1.5, 'bone'),
    box(a.x + 2, a.y - 3, a.z + 0.5, 1, 1, 1.5, 'bone'),
  ],

  /**
   * SIFAO — o tanque na culatra do flanco externo.
   *
   * O ponto mais discreto da arma, e e o que lhe cabe: o sifao e o unico
   * acessorio de utilidade pura e nao deve disputar contorno com os cinco que
   * mudam o tiro. A faixa de fluido e o que o identifica — e a unica coisa
   * vermelha do bot inteiro, o que a torna inconfundivel apesar do tamanho.
   */
  siphon: (a) => [
    box(a.x + 2, a.y - 1, a.z - 1, 1, 2, 1, 'rockDeep'),
    box(a.x + 2, a.y - 1, a.z, 1, 2, 0.5, 'blood'),
  ],
};

/** Os ids que se ACOPLAM, na ordem em que sao empilhados. */
export const ATTACHMENT_IDS = Object.keys(MODULE_ATTACHMENTS);

/**
 * A MINIGUN como camada de ARMA: substitui o Cravador, nao se soma a ele.
 *
 * A silhueta segue o cartucho C5 (`module-hardware.ts`): caixa de municao
 * atras, carcaca do motor no meio, dois canos GROSSOS a frente. Dois e nao
 * quatro pela mesma razao de la — a 4px por voxel um feixe de tubos finos vira
 * um borrao de tres pixels, e o que diz "minigun" nesta escala e calibre, nao
 * contagem.
 *
 * `fan` e a posicao da ventoinha da culatra, 0..3. Ela e o unico elemento que
 * ANDA entre quadros: em pouquissimo espaco rotacao nao se le por movimento
 * angular, se le por ALTERNANCIA, e quatro quadros de `attack` a 12 fps dao
 * tres voltas por segundo — rapido o bastante para ler como maquina, devagar o
 * bastante para nao cintilar a 30 quadros por segundo.
 */
/**
 * Quantas posicoes a ventoinha tem — e, por consequencia, quantos quadros CADA
 * animacao da camada da Minigun tem. O quadro dela codifica so a posicao da
 * ventoinha (o cliente o escolhe por `barrelPhase`, nunca pelo relogio), entao
 * `idle`, `walk` e `attack` precisam ter exatamente esta contagem: um `walk`
 * com os seis quadros da passada teria dois quadros que nenhum angulo alcança.
 * O cliente trava o mesmo numero em `sprites.ts` (`MINIGUN_FAN_FRAMES`).
 */
export const MINIGUN_FAN_FRAMES = 4;

export const minigunGun = ({
  bob = 0,
  kick = 0,
  lean = 0,
  crouch = 0,
  fan = 0,
  flash = false,
} = {}) => {
  const a = gunAnchor({ bob, kick, lean, crouch });

  // O VOLUME PROJETA PARA A FRENTE, e nao para tras. A primeira versao punha a
  // caixa de municao atras do ombro, como o cartucho da tela de recuperacao faz
  // — e 91% dela nascia DENTRO do chassi (medido). Atras da boca nao ha espaco:
  // o chassi ocupa x[-2,3] y[-2,2] z[8,12] e a ombreira x[3,4] z[11,13]. Uma
  // minigun e uma arma comprida; para a frente ela cabe, e la ela recorta.
  const orbit = [
    [a.y - 2.5, a.z + 1.5],
    [a.y - 1.5, a.z + 0.5],
    [a.y - 2.5, a.z - 0.5],
    [a.y - 3.5, a.z + 0.5],
  ];
  const [fy, fz] = orbit[((fan % MINIGUN_FAN_FRAMES) + MINIGUN_FAN_FRAMES) % MINIGUN_FAN_FRAMES];

  return [
    // CARCACA DO MOTOR: o volume dominante, em latao, com a chapa escura em
    // cima. A chapa nao e enfeite — `rust` tem topo cor de OSSO, e nesta
    // isometria a face de topo e a maior de qualquer volume horizontal. Sem
    // ela, um bloco deste tamanho projeta um plano quase branco maior que a
    // cabeca do bot, e a arma le como tampo de mesa. E o mesmo defeito que o
    // chassi corrigiu com a mesma chapa, tres versoes atras.
    box(a.x, a.y - 3, a.z - 0.5, 2, 2, 2.5, 'rust'),
    box(a.x, a.y - 3, a.z + 2, 2, 2, 0.5, 'rockDeep'),

    // TAMBOR DE MUNICAO, pendurado sob a carcaca. E a massa que diz de longe
    // qual arma o Prospector esta carregando — inclusive a do parceiro, do
    // outro lado da sala —, e e o unico volume do bot que fica abaixo da linha
    // do cano.
    // Em LATAO, e nao em aco escuro. A primeira versao pintou o tambor de
    // `rockDeep` e a arma inteira virou uma mancha escura contra um chassi
    // tambem escuro — o Cravador que ela substitui le porque e OSSO palido
    // contra o corpo, e a arma que toma o lugar dele tem de ganhar a mesma
    // disputa de contraste. Havia tambem uma cinta de altura 0,25 aqui: a
    // grade real e 0,5 autorado = 1 voxel fino, entao ela nem existia como
    // volume — nascia arredondada para dentro do proprio tambor.
    box(a.x, a.y - 3, a.z - 1.5, 2, 2, 1, 'rust'),

    // OS CANOS: um feixe GROSSO, com a mesma chapa escura por cima pela mesma
    // razao. Dois tubos finos nao existem nesta escala — a 4px por voxel eles
    // viram um borrao de tres pixels —, e o que diz "minigun" aqui e calibre.
    // Saem na altura da boca do Cravador para a arma nao mudar de altura ao
    // trocar (`PROSPECTOR_MUZZLE_HEIGHT_TILES`).
    box(a.x, a.y - 4.5, a.z + 0.5, 2, 1.5, 1, 'bone'),
    box(a.x, a.y - 4.5, a.z + 1.5, 2, 1.5, 0.5, 'rockDeep'),

    // A VENTOINHA, na face externa da carcaca: um voxel dourado em quatro
    // posicoes de orbita. E o unico elemento que ANDA entre quadros, e vai para
    // FORA porque em pouquissimo espaco rotacao nao se le por movimento
    // angular — se le por ALTERNANCIA, e alternancia so funciona onde a peca
    // recorta contra o fundo. Quatro quadros de `attack` a 12 fps dao tres
    // voltas por segundo: rapido o bastante para ler como maquina, devagar o
    // bastante para nao cintilar a 30 quadros por segundo.
    //
    // `loot` e nao `fire`: a ventoinha e peca USINADA pegando luz, nao fonte.
    // Um material emissivo poria um ponto aceso girando no ombro a tres voltas
    // por segundo, competindo com o farol tatico — que e o ponto que o jogador
    // procura no breu.
    box(a.x + 2, fy, fz, 0.5, 1, 1, 'loot'),

    // BOCA. Acende no mesmo quadro em que o Cravador acenderia: o cliente le o
    // clarao pelo ATLAS, e uma arma que nao acendesse deixaria a luz do disparo
    // sem fonte no corpo.
    box(a.x + 0.5, a.y - 5.5, a.z + 0.5, 1, 1, 1, flash ? 'loot' : 'rockDeep'),
  ];
};

/**
 * A LANCA DE PROSPECCAO — o cano longo.
 *
 * Ela substitui o Cravador como a Minigun substitui, e a leitura tem de ser
 * OPOSTA a dela em todos os eixos: onde a Minigun e massa, tambor e ventoinha,
 * a Lanca e COMPRIMENTO e mais nada. A silhueta e o argumento inteiro — a
 * 4px por voxel ninguem le calibre, mas todo mundo le que aquele bot tem uma
 * coisa comprida apontada para a frente.
 *
 * Osso palido pelo mesmo motivo da Minigun: o chassi e escuro, e uma arma
 * `rockDeep` some dentro dele. A cinta escura no meio existe para o cano nao
 * virar um traco branco unico de sete voxels — ela parte o comprimento em duas
 * leituras e devolve a escala.
 */
export const prospectLanceGun = ({
  bob = 0,
  kick = 0,
  lean = 0,
  crouch = 0,
  flash = false,
} = {}) => {
  const a = gunAnchor({ bob, kick, lean, crouch });
  return [
    // RECEPTOR: curto e baixo, porque tudo o que ela tem de dizer esta na
    // frente. Mais volume aqui roubaria contraste do cano.
    box(a.x, a.y - 2.5, a.z, 2, 2, 1.5, 'rust'),
    box(a.x, a.y - 2.5, a.z + 1.5, 2, 2, 0.5, 'rockDeep'),

    // O CANO, em dois trechos com a cinta entre eles. Sete voxels a frente do
    // receptor — quase o dobro do Cravador, que e a unica coisa que o jogador
    // precisa perceber a distancia.
    box(a.x + 0.5, a.y - 4, a.z + 0.5, 1, 2, 1, 'bone'),
    box(a.x + 0.25, a.y - 4.5, a.z + 0.5, 1.5, 1, 1, 'rockDeep'),
    box(a.x + 0.5, a.y - 5.25, a.z + 0.5, 1, 1.5, 1, 'bone'),

    // O TRILHO DE MIRA, acima do receptor: o unico volume que sobe, e o que
    // distingue a Lanca do Perfurante (que tambem alonga a arma, mas por
    // baixo, no eixo do cano, e sem nada em cima).
    box(a.x + 0.5, a.y - 3, a.z + 2, 1, 2.5, 0.5, 'rockDeep'),
    box(a.x + 0.5, a.y - 4, a.z + 2.5, 1, 0.5, 0.5, 'electric'),

    // BIPE dobrado sob a boca: peso de arma apoiada, e o contraponto de baixo
    // que impede o conjunto de ler como uma antena.
    box(a.x + 0.5, a.y - 5.25, a.z - 0.5, 1, 0.5, 1, 'rust'),

    // BOCA: aro fino e o FURO recuado atras dele, pelo mesmo motivo do
    // Bacamarte — um cano que termina num bloco escuro chapado nao tem cano.
    // Aqui o anel e de meio voxel em volta de um furo de meio, que e tudo o que
    // cabe num cano de 1 de largura, e mesmo assim separa "tubo" de "vareta".
    box(a.x + 0.5, a.y - 5.7, a.z + 0.5, 1, 0.4, 1, 'rockDeep'),
    box(a.x + 0.5, a.y - 5.2, a.z + 0.5, 0.5, 0.8, 0.5, flash ? 'loot' : 'scorch'),
  ];
};

/**
 * O BACAMARTE — o cano curto e ABERTO.
 *
 * O oposto exato da Lanca, e de proposito: ela e comprimento sem massa, ele e
 * massa sem comprimento. A boca em funil e a peca inteira — e o unico volume
 * do arsenal que fica MAIS LARGO na ponta, e e por isso que ele se reconhece de
 * relance mesmo sem o jogador saber o nome.
 *
 * O funil e `rust` e nao `bone`: chumbo e polvora sao ferragem suja, e o osso
 * palido ja e a linguagem do Cravador e da Lanca. Duas armas brancas e uma
 * escura separam melhor do que tres brancas de comprimentos diferentes.
 */
export const blunderbussGun = ({ bob = 0, kick = 0, lean = 0, crouch = 0, flash = false } = {}) => {
  const a = gunAnchor({ bob, kick, lean, crouch });
  return [
    // CULATRA: curta e GROSSA. Ela ocupa quase todo o comprimento da arma, que
    // e o que sobra quando o cano nao existe.
    box(a.x, a.y - 3, a.z, 2, 2.5, 2, 'rust'),
    box(a.x, a.y - 3, a.z + 2, 2, 2.5, 0.5, 'rockDeep'),

    // O FUNIL, em dois degraus que ABREM — e abrem em ALTURA, nao em largura.
    //
    // A primeira versao alargava para os lados, que e o que um bacamarte faz, e
    // isso estourou o quadro: `fitReference` enquadra o corpo e TODOS os modulos
    // juntos, entao a peca mais larga do arsenal define o recorte de todas as
    // camadas do bot. Nao havia folga lateral — o Ricochete ja ocupa a borda
    // direita — e havia folga vertical de sobra. Abrindo em z, o trompete se le
    // igual nesta isometria e nao empurra ninguem.
    box(a.x, a.y - 4.5, a.z + 0.25, 2, 1.5, 2.5, 'rust'),
    box(a.x, a.y - 5.3, a.z + 0.25, 2, 1, 3.2, 'rust'),

    // O ARO da boca e um ANEL, e nao uma placa.
    //
    // A primeira versao fechou o funil com uma chapa escura inteira, e o
    // resultado foi o defeito que o playtest apontou: a arma lia como um bloco
    // solido, sem furo de cano. Um bacamarte e uma BOCA — tapa-la com metal
    // apaga a unica coisa que a peca tem para dizer.
    //
    // Quatro barras em volta de um vazio, entao, e o furo por tras delas. As
    // barras de cima e de baixo sao o que sobra do aro em z (onde o funil abre);
    // as dos lados sao meio voxel cada, que e tudo o que 2 de largura permite —
    // e o suficiente para o buraco ter borda em vez de virar um corte na
    // silhueta.
    box(a.x, a.y - 5.6, a.z + 1.65, 2, 0.4, 0.5, 'rockDeep'),
    box(a.x, a.y - 5.6, a.z - 1.15, 2, 0.4, 0.5, 'rockDeep'),
    box(a.x - 0.75, a.y - 5.6, a.z + 0.25, 0.5, 0.4, 3.2, 'rockDeep'),
    box(a.x + 0.75, a.y - 5.6, a.z + 0.25, 0.5, 0.4, 3.2, 'rockDeep'),

    // O FURO, RECUADO atras do aro. `scorch` e o unico material da paleta com
    // as tres faces escuras — ele nao tem lado iluminado, entao le como cavidade
    // de qualquer um dos quatro rumos, que e exatamente o que um buraco precisa
    // fazer. Recuado e nao rente: rente ele viraria um disco preto pintado na
    // ponta, e o que se quer e profundidade.
    box(a.x, a.y - 5.0, a.z + 0.25, 1, 1.1, 2.4, 'scorch'),

    // CARTUCHEIRA sob a culatra: a massa que diz que a municao dele e grossa,
    // e o contrapeso que impede a arma de parecer so uma boca flutuando.
    box(a.x + 0.25, a.y - 2.5, a.z - 1, 1.5, 1.5, 1, 'loot'),

    // O CLARAO nasce DENTRO do furo, e nao sobre ele: e o fundo do cano que
    // acende, entao o aro continua escuro e a boca vira uma luz emoldurada.
    ...(flash ? [box(a.x, a.y - 5.0, a.z + 0.25, 1, 1.1, 2.4, 'loot')] : []),
  ];
};
