// Codigo de sala: o jeito de duas pessoas jogarem juntas DE PROPOSITO.
//
// O matchmaking era o primeiro quarto com vaga, e so. Duas pessoas que
// quisessem descer juntas nao tinham como — clicavam "co-op" e caiam com
// estranhos, ou sozinhas, conforme quem mais estivesse online no instante. Para
// um co-op de exatamente duas pessoas, a camada social E a funcionalidade: sem
// convite, o modo existe no codigo e nao existe na pratica.
//
// Vive no protocolo, e nao no servidor, porque cliente e servidor precisam
// concordar sobre o que e um codigo valido. O cliente normaliza o que o jogador
// digitou antes de enviar; o servidor rejeita o que nao passa. As duas pontas
// lendo a mesma regra e o que evita o caso classico de "o codigo funciona no
// meu celular e nao no dele".

/**
 * Alfabeto sem ambiguidade visual e sem vogais.
 *
 * Sem O/0, I/1/L: um codigo e lido em voz alta ou copiado de uma tela de
 * celular, e "0" contra "O" e o erro mais comum que existe nesse formato.
 * Sem vogais para que nenhum sorteio produza palavra ofensiva por acidente —
 * quatro caracteres bastam para isso acontecer mais do que se imagina.
 */
export const ROOM_CODE_ALPHABET = 'BCDFGHJKMNPQRSTVWXYZ23456789';

/**
 * Quatro caracteres: 28^4 = 614.656 combinacoes.
 *
 * Curto o bastante para ser dito por telefone, e amplo o bastante para que a
 * chance de colisao entre salas simultaneas seja desprezivel no alvo deste
 * jogo. Nao e segredo nem tenta ser: quem tem o codigo entra, que e exatamente
 * o comportamento desejado de um convite.
 */
export const ROOM_CODE_LENGTH = 4;

/**
 * Normaliza o que o jogador digitou: maiusculas, sem espacos nem hifens.
 *
 * Deliberadamente conservadora. A tentacao e "consertar" os caracteres
 * excluidos — 0 vira O, I vira 1 — e isso estaria errado nos dois sentidos: os
 * excluidos NAO estao no alfabeto, entao nao ha destino para onde manda-los.
 * Um chute produziria a pior falha possivel aqui, que e duas pessoas em salas
 * diferentes convictas de terem digitado o mesmo codigo. O que nao passa e
 * recusado na cara, e o jogador redigita.
 */
export const normalizeRoomCode = (raw: string): string => raw.toUpperCase().replace(/[\s-]+/g, '');

export const isValidRoomCode = (code: string): boolean => {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
};

/**
 * Gera um codigo. `random` e injetavel para o servidor poder testar colisao.
 */
export const generateRoomCode = (random: () => number = Math.random): string => {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.floor(random() * ROOM_CODE_ALPHABET.length) % ROOM_CODE_ALPHABET.length;
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
};
