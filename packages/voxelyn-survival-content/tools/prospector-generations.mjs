// OS MARCOS GERACIONAIS DO PROSPECTOR, como pecas de voxel sobre o G-00.
//
// A Matriz Geracional (spec 2026-08-02, §14) pede que a geracao se LEIA no
// chassi sem quebrar a silhueta: cinco marcos cumulativos, cada um somando ao
// contorno sem redesenha-lo. A primeira entrega desenhava os marcos em runtime,
// por cima do sprite, em coordenadas de tela — e eles foram medidos para um
// corpo mais baixo que o atual, cairam na cintura e leram como glitch. Aqui
// cada marco e um conjunto de CAIXAS no mesmo espaco do modelo, assado pelo
// mesmo rasterizador, na mesma pose do tronco: ele respira com o bot, inclina
// com o dano e some atras do chassi nas direcoes em que deveria sumir.
//
// Cada marco e uma ALEGORIA do que a geracao significa na ficcao da Aurix, e
// nao um enfeite a mais: o jogador que ve o parceiro ou o replay tem de saber
// de longe o que aquela unidade ja atravessou.
//
//   G-01  HOMOLOGADA. A unidade saiu da fabrica e passou pela primeira
//         homologacao de campo: ganha a PLACA DE MATRICULA ambar no canto do
//         peito e a ALCA DE ICAMENTO em osso sobre o ombro esquerdo — o
//         primeiro sinal de que alguem a puxou de um poco e a mandou de volta.
//   G-02  ENGAIOLADA. Sobreviveu a desabamentos suficientes para receber a
//         GAIOLA DE PROTECAO: dois montantes atras dos ombros e a barra sobre
//         a cabeca, como o santo-antonio de um veiculo de mina. E a linha mais
//         alta do bot, e so ela: nada muda abaixo do ombro.
//   G-03  DE DOIS NUCLEOS. Ja carregou Nucleos de volta a superficie; ganha o
//         BERCO DUPLO nos trilhos das costas, dois encaixes com o indicador
//         aceso cada um — o hardpoint que nasceu para um modulo passa a
//         carregar dois.
//   G-04  DE CAMPO COMPLETO. O chassi de expedicao: PILHA DE REATOR sobre o
//         hardpoint (o unico emissivo novo, para nao competir com o nucleo do
//         peito) e PLACAS PEITORAIS de osso ladeando o reator — blindagem
//         que se ve de frente, na direcao em que a unidade enfrenta o setor.
//
// As pecas nunca se INTERPENETRAM com o corpo nem umas com as outras, em pose
// nenhuma: cada uma vive numa regiao propria do chassi (ha teste varrendo
// todas as poses das camadas). Regioes, do G-00 para fora:
//
//   chassi x[-2,3] y[-2,2] z[8,12]  chapa z[12,13]  ombreiras x[-3,-2] e
//   x[3,4] y[-2,2] z[11,13]  cabeca x[-1,2] y[-3,1] z[13,15]  hardpoint
//   x[-1,2] y[2,4] z[9,13] com trilhos em y[4,4.5]  braco esquerdo x[-3,-2]
//   (balanca em y)  braco da arma x[3.5,4.5] y[0,1.5]+coice z[9,12]  arma
//   x[3,5] y[-3,0]+coice z[10,11.5]
//
// Tudo e derivado da pose (`bob`, `lean`) do mesmo jeito que o tronco deriva:
// a peca acompanha a respiracao e a inclinacao voxel a voxel.

import { box } from './voxel.mjs';

/** As geracoes que ACRESCENTAM algo ao chassi de fabrica, em ordem. */
export const GENERATION_IDS = ['G-01', 'G-02', 'G-03', 'G-04'];

/** O id de atlas de um marco. Uma funcao so, lida pelo gerador e pelo cliente. */
export const generationLayerId = (generation) =>
  `layer-generation-${generation.toLowerCase().replace('-', '')}`;

/** Os niveis do tronco nesta pose, os mesmos de `prospectorParts`. */
const torso = ({ bob = 0 } = {}) => {
  const hip = 6 + bob;
  const chest = hip + 2;
  const shoulder = chest + 3;
  const head = shoulder + 2;
  return { chest, shoulder, head };
};

const homologated = (pose) => {
  const { lean = 0 } = pose;
  const { chest, shoulder } = torso(pose);
  return [
    // PLACA DE MATRICULA: um voxel de ambar (`loot`) no canto inferior direito
    // da frente do peito, ao lado do nicho do reator — appliqué de meio-passo,
    // saliente da face, como todo detalhe fino do modelo.
    box(2, -2.5 + lean, chest + 0.5, 1, 0.5, 1, 'loot'),
    // ALCA DE ICAMENTO: uma barra de osso deitada sobre a ombreira esquerda, no
    // sentido do corpo. Osso sobre latao, para trocar de material na borda.
    box(-3, -1.5 + lean, shoulder + 2, 1, 3, 0.5, 'bone'),
  ];
};

const caged = (pose) => {
  const { lean = 0 } = pose;
  const { shoulder, head } = torso(pose);
  // Os montantes nascem ATRAS das ombreiras (y 1.5) e um voxel acima da linha
  // da arma: o coice leva o trilho da arma ate y 2 em z[11,11.5], e um
  // montante que comecasse em z 11 seria atravessado por ele no disparo. O da
  // direita fica meio voxel mais para fora que o da esquerda porque o braco da
  // arma (x ate 4.5) tambem e mais para fora que o de extracao.
  const top = head + 3;
  return [
    box(-3.5, 1.5 + lean, shoulder + 1, 0.5, 0.5, top - shoulder - 1, 'rockDeep'),
    box(4.5, 1.5 + lean, shoulder + 1, 0.5, 0.5, top - shoulder - 1, 'rockDeep'),
    // A BARRA sobre a cabeca, de montante a montante, um voxel acima da chapa
    // da cabeca: e o que faz a gaiola ler como gaiola e nao como duas antenas.
    box(-3.5, 1.5 + lean, top, 8.5, 0.5, 0.5, 'rockDeep'),
    // Terminais de osso nas duas quinas, para a barra nao sumir contra o breu.
    box(-3.5, 1.5 + lean, top + 0.5, 0.5, 0.5, 0.5, 'bone'),
    box(4.5, 1.5 + lean, top + 0.5, 0.5, 0.5, 0.5, 'bone'),
  ];
};

const twinCradle = (pose) => {
  const { lean = 0 } = pose;
  const { chest } = torso(pose);
  return [
    // DOIS BERCOS pendurados nos trilhos das costas (y 4.5), um de cada lado
    // do eixo, com meio voxel de vao entre eles e o cabo condutivo.
    box(-2, 4.5 + lean, chest + 1, 1.5, 1, 3.5, 'rockDeep'),
    box(1.5, 4.5 + lean, chest + 1, 1.5, 1, 3.5, 'rockDeep'),
    // O INDICADOR de cada berco, aceso: e o que diz "carregado" de longe.
    box(-1.5, 5.5 + lean, chest + 4, 0.5, 0.5, 0.5, 'biolum'),
    box(2, 5.5 + lean, chest + 4, 0.5, 0.5, 0.5, 'biolum'),
    // A TRAVESSA de latao unindo os dois bercos por cima.
    box(-2, 4.5 + lean, chest + 4.5, 5, 1, 0.5, 'rust'),
  ];
};

const fullField = (pose) => {
  const { lean = 0 } = pose;
  const { chest } = torso(pose);
  return [
    // PILHA DE REATOR sobre o hardpoint (topo em z 13): carcaca escura e a
    // tampa acesa. E o unico emissivo novo de todas as geracoes, e fica nas
    // COSTAS de proposito — o reator do peito continua sendo o orgao que manda
    // na frente.
    box(-0.5, 2.5 + lean, chest + 5, 2, 1.5, 1.5, 'rockDeep'),
    box(0, 2.5 + lean, chest + 6.5, 1, 1, 0.5, 'biolum'),
    // PLACAS PEITORAIS de osso, uma de cada lado do nicho do reator, acima da
    // placa de matricula do G-01: blindagem palida sobre o latao, visivel nas
    // direcoes em que o bot encara o setor.
    box(-2, -2.5 + lean, chest + 2, 1, 0.5, 1.5, 'bone'),
    box(2, -2.5 + lean, chest + 2, 1, 0.5, 1.5, 'bone'),
  ];
};

/**
 * As caixas que CADA geracao acrescenta — so as dela, nao as das anteriores.
 * O cliente empilha as camadas de G-01 ate a geracao da unidade, e e assim que
 * o acumulo acontece: G-03 e o corpo com tres camadas por cima, nao um atlas
 * que repete as duas primeiras.
 */
export const GENERATION_ALLEGORIES = {
  'G-01': homologated,
  'G-02': caged,
  'G-03': twinCradle,
  'G-04': fullField,
};
