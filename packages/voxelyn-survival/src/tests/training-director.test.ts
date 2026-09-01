import { describe, expect, it } from 'vitest';
import { markCoreTaken, type SemanticEvent } from '@voxelyn/survival-sim';
import { TrainingDirector, type TrainingCue } from '../client/training-director';
import { createTrainingRun } from '../client/training-setup';

/**
 * O diretor e um observador puro: estado real da simulacao entra, cues saem.
 * Os testes usam o MESMO estado que o jogo usa (`createTrainingRun`), mutado a
 * mao — mais fiel que um mock, e igualmente headless.
 */
const dodge: SemanticEvent = { t: 'dodge', x: 0, y: 0 };
const overheat: SemanticEvent = { t: 'overheat', slot: 0, x: 0, y: 0 };
const extracted: SemanticEvent = { t: 'extracted', withCore: true, cores: 1 };

const banners = (cues: TrainingCue[]): string[] =>
  cues.filter((c) => c.type === 'banner').map((c) => c.key);
const toasts = (cues: TrainingCue[]): string[] =>
  cues.filter((c) => c.type === 'toast').map((c) => c.key);

describe('TrainingDirector', () => {
  it('percorre os cinco passos na ordem, um fato de cada vez', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();

    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
    // Nada mudou: nenhum cue novo, o banner nao e reemitido.
    expect(director.frame(state, false)).toEqual([]);

    state.leftEntryZone = true;
    let cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.move']);
    expect(banners(cues)).toEqual(['training.step.clear']);

    for (const enemy of state.enemies) enemy.alive = false;
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.clear']);
    expect(banners(cues)).toEqual(['training.step.dash']);

    director.ingest([dodge]);
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.dash']);
    expect(banners(cues)).toEqual(['training.step.core']);

    markCoreTaken(state, state.sector);
    cues = director.frame(state, false);
    expect(banners(cues)).toEqual(['training.step.extract']);
    expect(director.finished).toBe(false);

    director.ingest([extracted]);
    cues = director.frame(state, false);
    expect(cues).toContainEqual({ type: 'clear-banner' });
    expect(director.finished).toBe(true);
    // Terminado e terminado: nenhum cue repetido no quadro seguinte.
    expect(director.frame(state, false)).toEqual([]);
  });

  it('uma esquiva fora do passo dela nao conta', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.frame(state, false); // agora no passo 'clear'

    director.ingest([dodge]);
    expect(banners(director.frame(state, false))).toEqual([]); // continua em 'clear'

    for (const enemy of state.enemies) enemy.alive = false;
    // O passo 'dash' vira o ativo AGORA — a esquiva antiga ja foi descartada.
    expect(banners(director.frame(state, false))).toEqual(['training.step.dash']);
    expect(director.finished).toBe(false);
  });

  it('furar a ordem nunca trava: Nucleo pego durante o passo do dash', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.frame(state, false);
    for (const enemy of state.enemies) enemy.alive = false;
    director.frame(state, false); // no passo 'dash'

    // O jogador ignora a instrucao, caminha ate o pedestal e recolhe o Nucleo.
    markCoreTaken(state, state.sector);
    expect(banners(director.frame(state, false))).toEqual([]); // dash segue ativo

    // So entao ele da o dash: o passo do Nucleo conclui NO MESMO quadro,
    // porque a posse e fato do estado — e o percurso segue para a extracao.
    director.ingest([dodge]);
    const cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.dash']);
    expect(banners(cues)).toEqual(['training.step.extract']);
  });

  it('a dica de calor sai uma vez, atrasada para depois do aviso nativo', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);

    director.ingest([overheat]);
    const cues = director.frame(state, false);
    expect(cues).toContainEqual({ type: 'toast', key: 'training.tip.heat', delayMs: 1650 });

    director.ingest([overheat]);
    expect(toasts(director.frame(state, false))).toEqual([]);
  });

  it('a troca de modalidade reemite a instrucao na variante certa', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
    expect(banners(director.frame(state, true))).toEqual(['training.step.move.touch']);
    expect(banners(director.frame(state, true))).toEqual([]);
    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
  });

  it('reset devolve tudo ao primeiro passo, dica de calor inclusa', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.ingest([overheat]);
    director.frame(state, false);

    director.reset();
    const fresh = createTrainingRun();
    expect(banners(director.frame(fresh, false))).toEqual(['training.step.move']);
    director.ingest([overheat]);
    expect(toasts(director.frame(fresh, false))).toEqual(['training.tip.heat']);
  });
});
