import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from '../src/room-code.js';

describe('alfabeto do codigo de sala', () => {
  // Um codigo e lido em voz alta ou copiado de uma tela de celular: 0/O e I/1/L
  // sao o erro mais comum que existe nesse formato.
  it('nao contem caracteres visualmente ambiguos', () => {
    for (const ch of '0O1IL') {
      expect(ROOM_CODE_ALPHABET.includes(ch), `alfabeto contem ${ch}`).toBe(false);
    }
  });

  // Quatro caracteres sorteados de um alfabeto com vogais produzem palavra
  // ofensiva com mais frequencia do que se imagina.
  it('nao contem vogais', () => {
    for (const ch of 'AEIOU') {
      expect(ROOM_CODE_ALPHABET.includes(ch), `alfabeto contem ${ch}`).toBe(false);
    }
  });

  it('nao repete caracteres', () => {
    expect(new Set(ROOM_CODE_ALPHABET).size).toBe(ROOM_CODE_ALPHABET.length);
  });
});

describe('geracao', () => {
  it('sempre produz codigo valido', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode();
      expect(isValidRoomCode(code), `invalido: ${code}`).toBe(true);
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
    }
  });

  // O indice vem de Math.floor(random * len): random() === 1 (fora do contrato,
  // mas retornado por geradores mal escritos) estouraria o array e produziria
  // "undefined" no codigo.
  it('nao estoura o alfabeto com random no limite superior', () => {
    expect(isValidRoomCode(generateRoomCode(() => 0.999999999))).toBe(true);
    expect(isValidRoomCode(generateRoomCode(() => 1))).toBe(true);
    expect(isValidRoomCode(generateRoomCode(() => 0))).toBe(true);
  });
});

describe('normalizacao', () => {
  it('aceita como as pessoas realmente digitam', () => {
    expect(normalizeRoomCode('bcdf')).toBe('BCDF');
    expect(normalizeRoomCode(' BC DF ')).toBe('BCDF');
    expect(normalizeRoomCode('BC-DF')).toBe('BCDF');
  });

  // A pior falha possivel aqui e duas pessoas em salas DIFERENTES convictas de
  // terem digitado o mesmo codigo. Recusar na cara e melhor que adivinhar.
  it('recusa em vez de adivinhar o que o jogador quis dizer', () => {
    expect(isValidRoomCode(normalizeRoomCode('BCD0'))).toBe(false);
    expect(isValidRoomCode(normalizeRoomCode('BCDI'))).toBe(false);
    expect(isValidRoomCode(normalizeRoomCode('BCDA'))).toBe(false);
  });

  it('rejeita comprimento errado', () => {
    expect(isValidRoomCode('BCD')).toBe(false);
    expect(isValidRoomCode('BCDFG')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('normalizar e idempotente', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(normalizeRoomCode(normalizeRoomCode(code))).toBe(code);
    }
  });
});
