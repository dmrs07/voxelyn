import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_FRAGILE_BREACH,
  markCoreTaken,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';
import { TrainingDirector, type TrainingCue } from '../client/training-director';
import { createTrainingRun } from '../client/training-setup';

/**
 * O diretor e um observador puro: estado real da simulacao entra, cues saem.
 * Os testes usam o MESMO estado que o jogo usa (`createTrainingRun`), mutado a
 * mao — mais fiel que um mock, e igualmente headless.
 */
const dodge: SemanticEvent = { t: 'dodge', x: 0, y: 0 };
const overheat: SemanticEvent = { t: 'overheat', slot: 0, x: 0, y: 0 };
const purgeCell: SemanticEvent = { t: 'purge_cell_acquired', slot: 0, amount: 1 };

/** A escolha de modulo como a simulacao a monta ao abrir um cofre. */
const pendingChoice = (
  state: SurvivalState,
): SurvivalState['playerExtra']['pendingModuleChoice'] => ({
  sourceSiteId: 1,
  options: ['piercing', 'conductive'],
  createdAtTick: state.tick,
});

const banners = (cues: TrainingCue[]): string[] =>
  cues.filter((c) => c.type === 'banner').map((c) => c.key);
const toasts = (cues: TrainingCue[]): string[] =>
  cues.filter((c) => c.type === 'toast').map((c) => c.key);

/** O atalho que leva o estado ao fim de cada licao do setor 1, na ordem. */
const finishSectorOne = (state: SurvivalState, director: TrainingDirector): void => {
  director.frame(state, false);
  state.leftEntryZone = true;
  director.frame(state, false);
  state.stats.oreCollected = 3;
  director.frame(state, false);
  for (const enemy of state.enemies) enemy.alive = false;
  director.frame(state, false);
  director.ingest([dodge]);
  director.frame(state, false);
  const site = state.salvageSites[0];
  site.terminalState = 'scanning';
  director.frame(state, false);
  site.terminalState = 'complete';
  site.cacheRevealed = true;
  director.frame(state, false);
  // Como na simulacao: abrir o cofre e enfileirar a escolha acontecem no
  // MESMO tick, e e isso que segura o passo do modulo em vez de vaza-lo.
  site.cacheOpened = true;
  state.playerExtra.pendingModuleChoice = pendingChoice(state);
  director.frame(state, false);
};

describe('TrainingDirector', () => {
  it('percorre o setor 1 na ordem, um fato de cada vez', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();

    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
    // Nada mudou: nenhum cue novo, o banner nao e reemitido.
    expect(director.frame(state, false)).toEqual([]);

    state.leftEntryZone = true;
    let cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.move']);
    expect(banners(cues)).toEqual(['training.step.mine']);

    // Duas lascas nao bastam: a cota e o que separa acidente de intencao.
    state.stats.oreCollected = 2;
    expect(banners(director.frame(state, false))).toEqual([]);
    state.stats.oreCollected = 3;
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.mine']);
    expect(banners(cues)).toEqual(['training.step.clear']);

    for (const enemy of state.enemies) enemy.alive = false;
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.clear']);
    expect(banners(cues)).toEqual(['training.step.dash']);

    director.ingest([dodge]);
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.dash']);
    expect(banners(cues)).toEqual(['training.step.terminal']);

    const site = state.salvageSites[0];
    site.terminalState = 'scanning';
    expect(banners(director.frame(state, false))).toEqual(['training.step.hold']);

    site.terminalState = 'complete';
    site.cacheRevealed = true;
    cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.hold']);
    expect(banners(cues)).toEqual(['training.step.cache']);

    // Abrir o cofre enfileira a carta no MESMO tick, como na simulacao.
    site.cacheOpened = true;
    state.playerExtra.pendingModuleChoice = pendingChoice(state);
    expect(banners(director.frame(state, false))).toEqual(['training.step.module']);
  });

  it('a escolha de modulo segura o passo enquanto as cartas estao na tela', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    expect(director.currentStep).toBe('module');
    expect(banners(director.frame(state, false))).toEqual([]);

    state.playerExtra.pendingModuleChoice = null;
    const cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.module']);
    expect(banners(cues)).toEqual(['training.step.echo']);
  });

  it('sintonizar e opcional: descer sem escolher passa a licao do Eco', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    state.playerExtra.pendingModuleChoice = null;
    director.frame(state, false);
    expect(director.currentStep).toBe('echo');

    // O jogador ignora os Ecos e desce. Nao e erro no jogo real, e nao pode
    // travar aqui: os dois passos do poco concluem no mesmo quadro.
    state.sector = 2;
    expect(banners(director.frame(state, false))).toEqual(['training.step.ability']);
    expect(director.checkpoint).toEqual({ sector: 2, withCore: false });
  });

  it('o tampao fragil dispensa a licao da habilidade, e nunca o contrario', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    state.playerExtra.pendingModuleChoice = null;
    director.frame(state, false);
    state.sector = 2;
    director.frame(state, false);
    expect(director.currentStep).toBe('ability');

    // Quem atravessou a camara e ja abriu a brecha nao volta para usar
    // habilidade numa sala vazia: o passo e DISPENSADO, e passa em silencio —
    // so quem fez recebe o visto.
    state.stats.discoveries |= DISCOVERY_FRAGILE_BREACH;
    const cues = director.frame(state, false);
    expect(toasts(cues)).not.toContain('training.done.ability');
    expect(toasts(cues)).toContain('training.done.breach');
    expect(banners(cues)).toEqual(['training.step.core']);
  });

  it('uma licao pulada nao congela o banner: o terminal dispensa o que ficou para tras', () => {
    // O defeito que este contrato existe para impedir: sem dispensa, quem
    // ignorou o veio e os pilares via "atire no veio" na tela pelo resto do
    // setor — e uma instrucao que descreve o que o jogador NAO esta fazendo
    // ensina a ignorar o banner.
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.frame(state, false);
    expect(director.currentStep).toBe('mine');

    // Ele passa direto e aciona o terminal, sem minerar e sem esquivar.
    const site = state.salvageSites[0];
    site.terminalState = 'scanning';
    const cues = director.frame(state, false);
    expect(banners(cues)).toEqual(['training.step.hold']);
    // E nenhum dos passos pulados finge que foi feito.
    expect(toasts(cues)).toEqual([]);
  });

  it('a luta comecada dispensa a mineracao, que e opcional no jogo real', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.frame(state, false);
    expect(director.currentStep).toBe('mine');

    // Um espreitador ferido: a luta comecou, e a instrucao acompanha.
    state.enemies[0].hp = state.enemies[0].maxHp - 1;
    expect(banners(director.frame(state, false))).toEqual(['training.step.clear']);
  });

  it('travar a arma minerando NAO conta como combate', () => {
    // O cano cobra vida ao saturar. Medir "o Prospector levou dano" fazia a
    // licao de minerar dispensar a si mesma no meio dela — e o banner pulava
    // para "FOGO" numa galeria vazia.
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    director.frame(state, false);
    expect(director.currentStep).toBe('mine');

    state.player.hp = state.player.maxHp - 6;
    expect(banners(director.frame(state, false))).toEqual([]);
    expect(director.currentStep).toBe('mine');
  });

  it('fecha o ciclo: Nucleo, subida e extracao', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    state.playerExtra.pendingModuleChoice = null;
    director.frame(state, false);
    state.sector = 2;
    state.playerExtra.abilityCooldownUntil = state.tick + 100;
    state.stats.discoveries |= DISCOVERY_FRAGILE_BREACH;
    director.frame(state, false);
    expect(director.currentStep).toBe('core');
    expect(director.checkpoint).toEqual({ sector: 2, withCore: false });

    markCoreTaken(state, 2);
    expect(banners(director.frame(state, false))).toEqual(['training.step.ascend']);
    // A partir daqui o checkpoint carrega o Nucleo: morrer voltando nao
    // devolve ninguem ao inicio da galeria.
    expect(director.checkpoint).toEqual({ sector: 2, withCore: true });

    state.sector = 1;
    const cues = director.frame(state, false);
    expect(toasts(cues)).toEqual(['training.done.ascend']);
    expect(banners(cues)).toEqual(['training.step.extract']);
    expect(director.checkpoint).toEqual({ sector: 1, withCore: true });

    state.phase = 'extracted_with_core';
    expect(director.frame(state, false)).toContainEqual({ type: 'clear-banner' });
    expect(director.finished).toBe(true);
    // Terminado e terminado: nenhum cue repetido no quadro seguinte.
    expect(director.frame(state, false)).toEqual([]);
  });

  it('uma esquiva fora do passo dela nao conta', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    state.stats.oreCollected = 3;
    director.frame(state, false); // agora no passo 'clear'

    director.ingest([dodge]);
    expect(banners(director.frame(state, false))).toEqual([]); // continua em 'clear'

    for (const enemy of state.enemies) enemy.alive = false;
    // O passo 'dash' vira o ativo AGORA — e o latch da esquiva antiga foi
    // consumido pelo passo que ele nao fechou, entao uma nova e exigida.
    expect(banners(director.frame(state, false))).toEqual(['training.step.dash']);
    expect(director.currentStep).toBe('dash');
  });

  it('furar a ordem nunca trava: o cofre aberto durante o passo do dash', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);
    state.leftEntryZone = true;
    state.stats.oreCollected = 3;
    for (const enemy of state.enemies) enemy.alive = false;
    director.frame(state, false); // no passo 'dash'
    expect(director.currentStep).toBe('dash');

    // O jogador ignora a instrucao, atravessa os pilares andando e resolve o
    // salvage inteiro. Tudo isso e fato do estado, entao os passos consumados
    // caem de uma vez — e a esquiva, que ele nao deu, e dispensada em silencio
    // pelo terminal que ele acionou.
    const site = state.salvageSites[0];
    site.terminalState = 'complete';
    site.cacheRevealed = true;
    site.cacheOpened = true;
    const cues = director.frame(state, false);
    expect(banners(cues)).toEqual(['training.step.echo']);
    expect(toasts(cues)).not.toContain('training.done.dash');
    expect(toasts(cues)).toContain('training.done.hold');
  });

  it('as dicas saem uma vez cada, no momento em que sao resposta', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    director.frame(state, false);

    director.ingest([overheat]);
    expect(director.frame(state, false)).toContainEqual({
      type: 'toast',
      key: 'training.tip.heat',
      delayMs: 1650,
    });
    director.ingest([overheat]);
    expect(toasts(director.frame(state, false))).toEqual([]);

    director.ingest([purgeCell]);
    expect(toasts(director.frame(state, false))).toEqual(['training.tip.purge']);
    director.ingest([purgeCell]);
    expect(toasts(director.frame(state, false))).toEqual([]);

    // A primeira descoberta e o gancho do arquivo, e sai sozinha.
    state.stats.discoveries |= DISCOVERY_FRAGILE_BREACH;
    expect(toasts(director.frame(state, false))).toEqual(['training.tip.archive']);
    expect(toasts(director.frame(state, false))).toEqual([]);
  });

  it('a instrucao corrente fica disponivel para quem tiver de repo-la na tela', () => {
    // O banner e compartilhado com os avisos do cliente, e um aviso que se
    // limpa sozinho leva a licao junto. `standingBanner` e o que permite ao
    // laco devolve-la sem o diretor ter de reemitir cue nenhum.
    const state = createTrainingRun();
    const director = new TrainingDirector();
    expect(director.standingBanner).toBeNull();
    director.frame(state, false);
    expect(director.standingBanner).toBe('training.step.move');

    // E some quando o exercicio acaba: nao ha instrucao a repor.
    director.reset();
    expect(director.standingBanner).toBeNull();
  });

  it('a troca de modalidade reemite a instrucao na variante certa', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
    expect(banners(director.frame(state, true))).toEqual(['training.step.move.touch']);
    expect(banners(director.frame(state, true))).toEqual([]);
    expect(banners(director.frame(state, false))).toEqual(['training.step.move']);
  });

  it('rewind devolve ao inicio do TRECHO, e nao ao inicio do exercicio', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    state.playerExtra.pendingModuleChoice = null;
    director.frame(state, false);
    state.sector = 2;
    state.playerExtra.abilityCooldownUntil = state.tick + 100;
    state.stats.discoveries |= DISCOVERY_FRAGILE_BREACH;
    markCoreTaken(state, 2);
    director.frame(state, false);
    expect(director.currentStep).toBe('ascend');

    // Morreu voltando: recomeca a VOLTA do setor 2, com o Nucleo.
    expect(director.rewind()).toEqual({ sector: 2, withCore: true });
    const fresh = createTrainingRun({ sector: 2, withCore: true });
    expect(banners(director.frame(fresh, false))).toEqual(['training.step.ascend']);
  });

  it('rewind sem o Nucleo volta ao primeiro passo do setor', () => {
    const state = createTrainingRun();
    const director = new TrainingDirector();
    finishSectorOne(state, director);
    state.playerExtra.pendingModuleChoice = null;
    director.frame(state, false);
    state.sector = 2;
    director.frame(state, false);
    expect(director.currentStep).toBe('ability');

    expect(director.rewind()).toEqual({ sector: 2, withCore: false });
    const fresh = createTrainingRun({ sector: 2, withCore: false });
    expect(banners(director.frame(fresh, false))).toEqual(['training.step.ability']);

    // E morrer no setor 1 devolve a plataforma, sem apagar o exercicio.
    director.reset();
    expect(banners(director.frame(createTrainingRun(), false))).toEqual(['training.step.move']);
  });

  it('reset devolve tudo ao primeiro passo, dicas inclusas', () => {
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
