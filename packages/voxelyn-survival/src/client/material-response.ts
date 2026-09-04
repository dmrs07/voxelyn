// COMO CADA MATERIA DO VEIO DEVOLVE A LUZ QUE RECEBE.
//
// O sistema de luz (`lighting.ts`) nao sabe nada sobre o jogo: ele entrega
// irradiancia e pergunta ao material o que fazer com ela. Esta tabela e a
// resposta, e ela e a razao pela qual um mesmo clarao de explosao NAO faz a
// mesma coisa em pedra, em gelo e em poca.
//
// ---------------------------------------------------------------------------
// AS DUAS COLUNAS
// ---------------------------------------------------------------------------
// `albedo` e a cor propria da materia — a mesma que o atlas ja usa para
// pinta-la. A luz refletida e o PRODUTO dela pela cor da fonte, que e a lei
// que faz o trabalho sozinha: um clarao alaranjado sobre rocha cinza devolve
// cinza-quente, e sobre cristal azul devolve quase nada, porque azul nao tem
// vermelho para devolver. Ninguem precisa autorar essa diferenca; ela cai da
// multiplicacao.
//
// `gloss` e o que a multiplicacao NAO da: quanto a superficie concentra o que
// devolve. Zero espalha por igual (a rocha, o fungo, a cinza) e recebe um veu
// largo e fraco. Perto de um concentra (o gelo, o vidro, a lamina d'agua, o
// latao do chassi) e recebe um realce pequeno e forte no mesmo lugar. E a
// diferenca entre uma parede acesa por uma explosao e o gelo da Cripta acendendo
// como um espelho na mesma explosao.
//
// ---------------------------------------------------------------------------
// DE ONDE SAEM OS NUMEROS
// ---------------------------------------------------------------------------
// Do que a materia E na ficcao, e nao do que fica bonito: rocha e fosca porque
// e rocha; gelo, vidro e agua parada sao os tres unicos materiais polidos do
// jogo; minerio e metal e fica no meio; fungo e o mais fosco de todos porque e
// organico e seco. O chassi do Prospector e latao usinado — o unico corpo
// polido que anda pela tela — e e por isso que o tiro dele acende a propria
// armadura ao sair.
//
// O albedo cita a paleta mestra em hex e nao um nome importado por uma razao
// pratica: o atlas de terreno assa 168 cores proprias, e nenhuma constante
// unica representa "a cor da rocha do estrato X". O que se quer aqui e a cor
// MEDIA da familia, que e uma decisao de apresentacao — e ela vive no cliente,
// como todo o resto do modulo.

import {
  SOLID_CRYSTAL,
  SOLID_CRYSTAL_DULL,
  SOLID_FRAGILE,
  SOLID_FRAGILE_WEAK,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_ORE_SPENT,
  SOLID_PIPE_E,
  SOLID_PIPE_N,
  SOLID_PIPE_S,
  SOLID_PIPE_W,
  SURF_BIOFLUID,
  SURF_EMBER,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GLASS,
  SURF_ICE,
  SURF_ICE_CRACKED,
  SURF_ICE_CRITICAL,
  SURF_ICE_FRACTURED,
  SURF_DEEP_WATER,
  SURF_RAIL,
  SURF_RAIL_V,
  SURF_SCORCHED,
  SURF_SILT,
  SURF_SPORES,
  SURF_WATER,
} from '@voxelyn/survival-sim';
import type { MaterialResponse } from './lighting';

/** Rocha nua: o padrao de tudo que nao declarar resposta propria. */
const ROCK: MaterialResponse = { albedo: '#6b7480', gloss: 0.06 };

const SOLID_RESPONSE: Record<number, MaterialResponse> = {
  [SOLID_FRAGILE]: { albedo: '#5a5346', gloss: 0.04 },
  [SOLID_FRAGILE_WEAK]: { albedo: '#6e4a33', gloss: 0.03 },
  // Minerio e METAL: devolve pouco no difuso e concentra no realce, que e o
  // que faz uma veia acender em risco quando um clarao passa por perto — e a
  // leitura que diz ao jogador que ali ha o que minerar.
  [SOLID_ORE]: { albedo: '#b07840', gloss: 0.42 },
  [SOLID_ORE_CHIPPED]: { albedo: '#8a6a3a', gloss: 0.34 },
  [SOLID_ORE_SPENT]: { albedo: '#3a3f44', gloss: 0.12 },
  // Cristal VIVO e o material mais polido do jogo, e o unico solido que emite:
  // ele acende sozinho e ainda espelha o que passa.
  [SOLID_CRYSTAL]: { albedo: '#59f2c2', gloss: 0.72 },
  // Opacado pelo acido perde as duas coisas de uma vez — a emissao e o polimento.
  // A perda TEM de ser visivel: e ela que o jogador precisa ler como dano.
  [SOLID_CRYSTAL_DULL]: { albedo: '#2f6b4f', gloss: 0.1 },
  [SOLID_PIPE_N]: { albedo: '#5d6b78', gloss: 0.5 },
  [SOLID_PIPE_E]: { albedo: '#5d6b78', gloss: 0.5 },
  [SOLID_PIPE_S]: { albedo: '#5d6b78', gloss: 0.5 },
  [SOLID_PIPE_W]: { albedo: '#5d6b78', gloss: 0.5 },
};

/** Chao nu, sem crosta: a mesma rocha do bloco, um tom mais frio. */
const BARE: MaterialResponse = { albedo: '#5c646e', gloss: 0.05 };

const SURFACE_RESPONSE: Record<number, MaterialResponse> = {
  // Organico e seco: o mais fosco de tudo, e o que menos devolve.
  [SURF_FUNGAL]: { albedo: '#4c7a3a', gloss: 0.02 },
  [SURF_FUNGAL_HEATED]: { albedo: '#7a6a2a', gloss: 0.04 },
  [SURF_SPORES]: { albedo: '#6e7a4a', gloss: 0.02 },
  // Fluidos: lamina lisa, reflexo concentrado. A poca e o unico chao que
  // ESPELHA, e e tambem o que conduz corrente — as duas leituras se reforcam.
  [SURF_BIOFLUID]: { albedo: '#a8e63c', gloss: 0.6 },
  [SURF_WATER]: { albedo: '#3f6d8f', gloss: 0.78 },
  // Gelo e vidro: os dois espelhos do jogo. O vidro e o que o Devorador Branco
  // deixa para tras, e um clarao atravessando uma sala envidracada tem de
  // parecer isso mesmo.
  [SURF_ICE]: { albedo: '#bcdcf0', gloss: 0.86 },
  [SURF_GLASS]: { albedo: '#cfe6f2', gloss: 0.9 },
  // O CICLO DE RACHADURAS: a placa PERDE o polimento antes de perder a cor.
  //
  // Gelo espelha porque e liso. Uma placa trincada nao e — cada fenda espalha o
  // que devolveria concentrado —, e por isso o `gloss` desce em degraus enquanto
  // o albedo quase nao muda. O efeito e o que interessa: um clarao de explosao
  // acende o lago inteiro como um espelho e MORRE nas celulas que ja estao
  // gastas. O jogador le a rota que ele mesmo abriu na primeira luz forte que
  // atravessar a arena, sem que nada precise ser desenhado por cima.
  [SURF_ICE_CRACKED]: { albedo: '#b4d3e6', gloss: 0.62 },
  [SURF_ICE_FRACTURED]: { albedo: '#a6c4d8', gloss: 0.38 },
  [SURF_ICE_CRITICAL]: { albedo: '#93aec2', gloss: 0.18 },
  // O buraco: escuro e MUITO polido. Agua parada e funda e o espelho mais
  // limpo que existe — e um vao que devolve o clarao inteiro num ponto e a
  // leitura de perigo que a cor sozinha nao daria no escuro da Cripta.
  [SURF_DEEP_WATER]: { albedo: '#1b2635', gloss: 0.88 },
  // Queimado devolve quase nada: carvao e o material menos reflexivo que existe.
  [SURF_SCORCHED]: { albedo: '#2a2622', gloss: 0.02 },
  // Fogo e brasa JA emitem; o que chega de fora quase nao muda o que se ve.
  // Um veu forte por cima do fogo so o sujaria.
  [SURF_FIRE]: { albedo: '#ff7a2f', gloss: 0.05 },
  [SURF_EMBER]: { albedo: '#c8542a', gloss: 0.06 },
  [SURF_SILT]: { albedo: '#6a5f4c', gloss: 0.03 },
  // Trilho: aco batido. Polido o bastante para a luz correr por ele, que e o
  // que faz o trilho ler como caminho.
  [SURF_RAIL]: { albedo: '#7a828c', gloss: 0.55 },
  [SURF_RAIL_V]: { albedo: '#7a828c', gloss: 0.55 },
};

export const solidResponse = (solid: number): MaterialResponse =>
  SOLID_RESPONSE[solid] ?? ROCK;

export const surfaceResponse = (surface: number): MaterialResponse =>
  SURFACE_RESPONSE[surface] ?? BARE;

/**
 * O CHASSI: latao usinado sobre placa de osso.
 *
 * O unico corpo polido que anda pela tela, e o motivo pelo qual o proprio tiro
 * do jogador acende a armadura dele ao sair. Vale para o Prospector local e para
 * o parceiro — sao o mesmo modelo.
 */
export const CHASSIS_RESPONSE: MaterialResponse = { albedo: '#c8a66a', gloss: 0.55 };

/**
 * Criaturas do Veio: casca organica, fosca.
 *
 * Uma so entrada para todo o bestiario de proposito. A alternativa seria uma
 * tabela por arquetipo que ninguem manteria — e o que a luz precisa dizer sobre
 * um bicho nao e de que material ele e, e QUE ELE ESTA ILUMINADO: um vulto que
 * acende quando a explosao estoura ao lado dele e informacao de combate.
 */
export const CREATURE_RESPONSE: MaterialResponse = { albedo: '#9aa7b3', gloss: 0.14 };

/**
 * Props do mundo: pedra e aco da operacao.
 *
 * Uma entrada so, como no bestiario, e pela mesma razao — mas aqui ela e ainda
 * mais defensavel: o atlas de props mistura monolito, fumarola, broca, pedestal
 * e portal, e todos sao materia INERTE do cenario. O que a luz precisa dizer
 * sobre um monolito nao e de que rocha ele e; e que ele tem VOLUME, e o volume
 * quem entrega e a normal por pixel, nao o albedo.
 *
 * Levemente polido: metade das pecas e equipamento da companhia, e um brilho
 * curto na quina de uma broca a separa da pedra em volta dela.
 */
export const PROP_RESPONSE: MaterialResponse = { albedo: '#7d8590', gloss: 0.3 };
