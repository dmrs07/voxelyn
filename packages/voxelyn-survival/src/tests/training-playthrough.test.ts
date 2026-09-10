import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_CORE_TAKEN,
  SALVAGE_SCAN_TICKS,
  SOLID_FRAGILE,
  SOLID_NONE,
  emptyCommand,
  isCoreTaken,
  stepRun,
  type PlayerCommand,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import {
  carveTrainingCourse,
  createTrainingRun,
  placeAtTrainingObjective,
  stampTrainingSector,
} from '../client/training-setup';

/**
 * O EXERCICIO INTEIRO, jogado.
 *
 * Os outros dois testes provam as pecas: a geografia carimbada e a maquina de
 * passos. Este prova a unica coisa que nenhum dos dois alcanca — que a
 * simulacao de verdade atravessa o percurso do comeco ao fim, com as duas
 * transicoes de setor recarimbadas no meio.
 *
 * Ele existe por uma razao muito concreta: `descend` e `ascend` REGERAM o mundo
 * do worldgen, e o carimbo do treinamento nao sobrevive a nenhuma das duas. Um
 * refactor futuro que mova a transicao de lugar quebra o exercicio de um jeito
 * que so aparece no minuto quatro de quem esta jogando pela primeira vez.
 *
 * O bot NAO anda: ele se teleporta para cada ponto e interage. Andar exigiria
 * um pathfinder, e a alcancabilidade ja e provada em `training-setup.test.ts` —
 * o que este teste tem de cobrar e o CONTRATO das interacoes, na ordem.
 */

/** O laco do cliente, reduzido ao que importa: tick, e recarimbo na transicao. */
const tick = (state: SurvivalState, cmd: PlayerCommand = emptyCommand()): SurvivalState => {
  const before = state.sector;
  stepRun(state, [cmd]);
  if (state.sector !== before) {
    const course = stampTrainingSector(state);
    if (state.sector < before) placeAtTrainingObjective(state, course);
  }
  return state;
};

const put = (state: SurvivalState, x: number, y: number): void => {
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  state.player.vx = 0;
  state.player.vy = 0;
};

const interact = (state: SurvivalState): void => {
  tick(state, { ...emptyCommand(), interact: true });
};

describe('a operacao de treinamento, jogada de ponta a ponta', () => {
  it('atravessa os dois setores e homologa na plataforma', () => {
    const state = createTrainingRun();
    const site = state.salvageSites[0];

    // -- SETOR 1 · o terminal e o alarme ------------------------------------
    put(state, site.terminal.x, site.terminal.y);
    interact(state);
    expect(site.terminalState).toBe('scanning');
    // O alarme e a licao: acionar o terminal chama companhia.
    expect(state.enemies.filter((e) => e.alive).length).toBeGreaterThan(2);

    // -- SETOR 1 · o escaneamento revela o cofre ----------------------------
    // Os corpos do alarme sao removidos: o que este teste cobra e o contrato
    // das interacoes, e uma luta de seis segundos so adicionaria variancia.
    state.enemies = [];
    for (let t = 0; t <= SALVAGE_SCAN_TICKS; t++) tick(state);
    expect(site.cacheRevealed).toBe(true);

    // -- SETOR 1 · o cofre paga celula de purga e hardware ------------------
    const purgeBefore = state.playerExtra.purgeCells;
    put(state, site.cache.x, site.cache.y);
    interact(state);
    expect(site.cacheOpened).toBe(true);
    expect(state.playerExtra.purgeCells).toBe(purgeBefore + 1);
    expect(state.playerExtra.pendingModuleChoice).not.toBeNull();

    tick(state, { ...emptyCommand(), choose: 0 });
    expect(state.playerExtra.pendingModuleChoice).toBeNull();

    // -- SETOR 1 · o poco oferece um Eco -----------------------------------
    // O poco do primeiro setor NUNCA fica mudo (ver `revealWellOffers`): mesmo
    // sem ressonancia nenhuma ha uma demonstracao garantida. E disso que a
    // licao do Eco depende para existir.
    put(state, state.corePos.x, state.corePos.y);
    tick(state);
    expect(state.wellOffers.length).toBeGreaterThan(0);

    const before = state.playerExtra.ability;
    tick(state, { ...emptyCommand(), choose: 0, choiceKind: 'echo' });
    expect(state.playerExtra.ability).not.toBe(before);

    // -- A DESCIDA, e o recarimbo ------------------------------------------
    put(state, state.corePos.x, state.corePos.y);
    interact(state);
    expect(state.sector).toBe(2);
    // O mundo do setor 2 e o CARIMBADO, e nao o que o worldgen gerou: o teto
    // de inimigos do exercicio prova isso sozinho.
    expect(state.enemies.filter((e) => e.alive)).toHaveLength(3);
    expect(state.salvageSites).toHaveLength(0);

    // -- SETOR 2 · o tampao fragil separa o pedestal ------------------------
    const course = carveTrainingCourse(createTrainingRun({ sector: 2, withCore: false }));
    const w = state.config.width;
    for (const cell of course.fragileCells) {
      expect(state.solid[cell.y * w + cell.x]).toBe(SOLID_FRAGILE);
      state.solid[cell.y * w + cell.x] = SOLID_NONE;
    }

    // -- SETOR 2 · o Nucleo -------------------------------------------------
    state.enemies = [];
    put(state, state.corePos.x, state.corePos.y);
    interact(state);
    expect(isCoreTaken(state, 2)).toBe(true);
    expect(state.playerExtra.hasCore).toBe(true);

    // -- A SUBIDA: com o Nucleo, a entrada do setor profundo SOBE -----------
    put(state, state.entry.x, state.entry.y);
    interact(state);
    expect(state.sector).toBe(1);
    expect(state.phase).toBe('running');
    // E o Prospector emerge no poco CARIMBADO, nunca dentro do macico.
    expect(state.solid[Math.floor(state.player.y) * w + Math.floor(state.player.x)]).toBe(
      SOLID_NONE,
    );
    expect(Math.floor(state.player.x)).toBe(state.corePos.x);

    // -- A EXTRACAO, que e a unica coisa que homologa ----------------------
    state.enemies = [];
    put(state, state.entry.x, state.entry.y);
    interact(state);
    expect(state.phase).toBe('extracted_with_core');

    // -- E o que o exercicio tem a arquivar --------------------------------
    // A licao central do percurso — o Nucleo recolhido — NAO esta em
    // `state.stats`: `buildSummary` a deriva do estado terminal e a escreve num
    // clone. Quem le as estatisticas vivas na homologacao arquiva tudo MENOS a
    // descoberta que a homologacao acabou de exigir.
    expect(state.stats.discoveries & DISCOVERY_CORE_TAKEN).toBe(0);
    expect((state.summary?.stats.discoveries ?? 0) & DISCOVERY_CORE_TAKEN).not.toBe(0);
  });

  it('o checkpoint de volta nasce sem descobertas: quem as carrega e o laco', () => {
    // `createRun` zera `RunStats`, e a reconstrucao so devolve a posse do
    // Nucleo. Como o checkpoint de volta comeca DEPOIS do tampao fragil, uma
    // descoberta perdida aqui nao tem como ser reconquistada — e por isso o
    // laco do treinamento acumula a mascara por fora, atravessando a morte.
    const state = createTrainingRun({ sector: 1, withCore: true });
    expect(state.stats.discoveries).toBe(0);
    expect(state.summary).toBeNull();
  });

  it('extrair de maos vazias no setor 1 NAO homologa', () => {
    // A outra saida legitima, e a que o formulario recusa: o exercicio cobra o
    // Nucleo, e sair sem ele e uma decisao — nao um erro, e nao uma aprovacao.
    const state = createTrainingRun();
    put(state, state.corePos.x, state.corePos.y);
    tick(state);
    put(state, state.entry.x, state.entry.y);
    interact(state);
    expect(state.phase).toBe('extracted');
  });
});
