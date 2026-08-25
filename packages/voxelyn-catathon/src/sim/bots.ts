import { STRESS_DANGER } from './constants.js';
import { catOf, step } from './sim.js';
import type { CatId, Command, HackState, SlotId } from './types.js';

/**
 * OS DOIS BOTS da casa, agora compartilhados entre suites: a partida tem de
 * saber SER PERDIDA (bot parado) e ser vencida (bot decente), e as duas
 * coisas se provam JOGANDO a simulacao — nunca inspecionando constantes.
 * O Slice D compara os dois tambem com o RIVAL: parado perde ate para os
 * Golden Retrievers; o decente os vence.
 */

const DESKS: Record<CatId, SlotId> = {
  bigode: 'desk-backend',
  cheeto: 'desk-frontend',
  almofada: 'desk-devops',
  smoking: 'desk-design',
};

export const runIdle = (state: HackState): void => {
  // Ate o FIM — inclusive o pitch, onde ficar parado tambem perde: a plateia
  // esfria e a crise de demo passa sem resposta.
  while (state.phase !== 'done') step(state, {});
};

/** A ordem de palco do bot: revezar habilidades (repetir rende metade). */
const PITCH_ORDER = ['bigode', 'cheeto', 'almofada', 'smoking'] as const;

/**
 * O jogador DECENTE: cada gato na propria mesa, carinho em quem esta na zona
 * de perigo, "shipa" no perfeccionista, o gato mais descansado nas
 * emergencias do rack, RESERVA de palco enquanto a crise puder vir.
 */
export const runCompetent = (state: HackState): void => {
  let stage = 0;
  while (state.phase !== 'done') {
    if (state.phase === 'pitch') {
      const p = state.pitch!;
      const crisisOpen = p.crisisUntil > 0 && state.tick < p.crisisUntil && !p.crisisResolved;
      const ready = PITCH_ORDER.filter((id) => (p.readyAt[id] ?? 0) <= state.tick);
      const mustReserve = !p.crisisResolved && !crisisOpen;
      if (ready.length > 0 && (crisisOpen || !mustReserve || ready.length >= 2)) {
        const pick = ready.find((id) => id === PITCH_ORDER[stage % 4]) ?? ready[0];
        stage++;
        step(state, { ability: pick });
      } else {
        step(state, {});
      }
      continue;
    }
    const cmd: Command = {};
    // Decisao aberta e a PRIMEIRA prioridade: mesa parada nao produz.
    const open = state.tasks.find((t) => t.choice && t.chosen === null && !t.done && !t.cut);
    if (open) {
      const pickOption = open.id === 'b1' ? 'micro' : open.id === 'd1' ? 'sistemaPrimeiro' : 'pipelineCompleto';
      step(state, { choose: { task: open.id, option: pickOption } });
      continue;
    }
    const emergency = state.hairball.active || state.buildBroken || state.cableOut;
    const atRack = state.cats.find((c) => c.slot === 'rack' && c.mode !== 'nap');
    // O bombeiro e o gato com a PIOR necessidade mais folgada: energia OU
    // fome baixa o tiram do rack no meio do conserto.
    const fitness = (c: (typeof state.cats)[number]) => Math.min(c.energy, c.hunger);
    const fixer = atRack ?? [...state.cats].sort((a, b) => fitness(b) - fitness(a))[0]!;

    if (state.fight && !state.held) {
      cmd.grab = state.fight.a;
    } else if (state.held) {
      const held = catOf(state, state.held)!;
      cmd.drop = emergency && held.id === fixer.id ? 'rack' : DESKS[held.id];
    } else if (emergency && fitness(fixer) < 0.4 && state.treats > 0) {
      cmd.treat = fixer.id;
    } else if (emergency && fixer.slot !== 'rack' && fixer.mode !== 'held') {
      cmd.grab = fixer.id;
    } else {
      const awaiting = state.tasks.some((t) => t.awaitingShip && !t.cut);
      const bigode = catOf(state, 'bigode')!;
      const risky = state.cats.find((c) => c.stress > STRESS_DANGER - 0.06 && c.mode === 'work');
      const loose = state.cats.find(
        (c) => c.mode === 'idle' && c.slot === null && !(emergency && c.id === fixer.id)
      );
      if (awaiting && bigode.mode !== 'held' && bigode.mode !== 'nap') cmd.pet = 'bigode';
      else if (risky) cmd.pet = risky.id;
      else if (loose) cmd.grab = loose.id;
    }
    step(state, cmd);
  }
};
