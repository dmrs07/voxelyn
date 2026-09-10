// A ESCALA DE ENCONTRO na fronteira do servidor.
//
// A regra vive na sim (coop.ts: quem esta em jogo AGORA paga a conta), e o que
// este arquivo protege e a ORDEM em que a sala a alimenta. `GameRoom` cria a run
// com todos os assentos da sala e so depois decide quem entrou; entre uma coisa
// e outra o setor de abertura ja foi povoado. Enquanto os `joined` eram zerados
// DEPOIS de `createRun`, esse setor nascia com a densidade e a vida de dois
// jogadores em toda sala — inclusive na que ficou a run inteira com um so.
//
// Ver docs/superpowers/specs/2026-09-09-survival-escala-de-coop.md.

import { describe, expect, it } from 'vitest';
import { createRun, descend } from '@voxelyn/survival-sim';
import { GameRoom } from '../src/room.js';

describe('escala de encontro: a sala vazia nao cobra por dois', () => {
  it('o setor de abertura de uma sala recem-criada e o setor de um jogador', () => {
    const room = new GameRoom('r1', 4242, 2);
    const solo = createRun({ seed: 4242, playerCount: 1 });

    // nenhum avatar entrou ainda...
    expect(room.state.playerExtras.every((e) => !e.joined)).toBe(true);
    // ...e o setor que ja esta em pe prova que a sim soube disso a tempo.
    expect(room.state.enemies.length).toBe(solo.enemies.length);
    expect(room.state.enemies.map((e) => e.maxHp)).toEqual(solo.enemies.map((e) => e.maxHp));
  });

  it('o setor SEGUINTE, ja com os dois em jogo, cobra por dois', () => {
    const room = new GameRoom('r2', 4242, 2);
    room.attach('a');
    room.attach('b');
    expect(room.state.playerExtras.every((e) => e.joined)).toBe(true);

    // A descida repovoa o setor, e ai o time ja esta em campo.
    const opening = room.state.enemies.length;
    descend(room.state, []);
    const next = room.state.enemies.filter((e) => e.alive).length;
    const soloNext = createRun({ seed: 4242, playerCount: 1, sector: room.state.sector });

    expect(room.state.sector).toBe(2);
    expect(next).toBeGreaterThan(soloNext.enemies.length);
    // e a abertura continua tendo sido a de um jogador
    expect(opening).toBe(createRun({ seed: 4242, playerCount: 1 }).enemies.length);
  });
});
