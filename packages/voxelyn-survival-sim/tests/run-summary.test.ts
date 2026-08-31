import { DEFAULT_SECTOR_COUNT } from '../src/constants';
import { describe, expect, it } from 'vitest';
import {
  BLEEDOUT_TICKS,
  PLAYER_HP,
  targetExtractionTicks,
  buildSummary,
  createRun,
  damageEntity,
  deepestCoreSector,
  emptyCommand,
  hashAuthoritativeState,
  markCoreTaken,
  compareRunScore,
  runClass,
  runScore,
  starsFor,
  stepRun,
} from '../src/index.js';
import type { DamageCause, RunSummary, StarInput, SurvivalState } from '../src/index.js';

const idle = () => [emptyCommand()];

/**
 * Espelha `runEndingCause`, que e interno a run.ts de proposito: nada fora da
 * simulacao deveria escolher a causa, e exportar so para o teste convidaria o
 * cliente a chamar.
 */
const runEndingCauseForTest = (state: SurvivalState): DamageCause | null => {
  if (state.phase !== 'dead') return null;
  let latest: { cause: DamageCause; tick: number } | null = null;
  for (const extra of state.playerExtras) {
    if (!extra.joined || !extra.lastDamage) continue;
    if (!latest || extra.lastDamage.tick > latest.tick) latest = extra.lastDamage;
  }
  return latest?.cause ?? { kind: 'unknown' };
};

/** Avanca a run ate ela terminar, com teto para nao pendurar a suite. */
const runUntilOver = (state: SurvivalState, maxTicks = 200): SurvivalState => {
  for (let i = 0; i < maxTicks && state.phase === 'running'; i++) stepRun(state, idle());
  return state;
};

/** Mata o jogador com uma causa especifica e deixa a run concluir. */
const killWith = (cause: DamageCause, seed = 7): SurvivalState => {
  const state = createRun({ seed });
  const events: never[] = [];
  damageEntity(state, state.player, PLAYER_HP * 2, events, cause);
  return runUntilOver(state, 5);
};

const TARGET_TICKS = targetExtractionTicks(DEFAULT_SECTOR_COUNT);

describe('as tres estrelas', () => {
  /** Uma descida rasa: UM Nucleo disponivel, como G-00 a G-02. */
  const rasa = (over: Partial<StarInput>): StarInput => ({
    phase: 'extracted_with_core',
    ticks: TARGET_TICKS - 1,
    targetTicks: TARGET_TICKS,
    cores: 1,
    coresAvailable: 1,
    ...over,
  });
  /** Uma descida funda: DOIS Nucleos disponiveis, como G-03 e G-04. */
  const funda = (over: Partial<StarInput>): StarInput =>
    rasa({ cores: 2, coresAvailable: 2, ...over });

  // A escada e de INTENCAO: morrer nao e um resultado parcial de extrair.
  it('nao concede estrela a quem morre, por mais rapido que seja', () => {
    expect(starsFor(rasa({ phase: 'dead', ticks: 1, cores: 0 }))).toBe(0);
    // Nem a quem morre CARREGANDO o Nucleo: morrer no Veio nao entrega nada.
    expect(starsFor(rasa({ phase: 'dead', ticks: 1, cores: 1 }))).toBe(0);
  });

  it('da uma estrela a quem sai vivo de maos vazias, independente do tempo', () => {
    expect(starsFor(rasa({ phase: 'extracted', ticks: 1, cores: 0 }))).toBe(1);
    expect(starsFor(rasa({ phase: 'extracted', ticks: TARGET_TICKS * 10, cores: 0 }))).toBe(1);
  });

  // A terceira nao adiciona objetivo novo: cobra o MESMO objetivo, inteiro e com
  // pressa. E o que mantem viva a decisao "extrair agora ou arriscar" depois que
  // o jogador ja aprendeu o mapa.
  it('a terceira estrela e a segunda cobrada no tempo', () => {
    expect(starsFor(rasa({ ticks: TARGET_TICKS - 1 }))).toBe(3);
    expect(starsFor(rasa({ ticks: TARGET_TICKS }))).toBe(3);
    expect(starsFor(rasa({ ticks: TARGET_TICKS + 1 }))).toBe(2);
  });

  /**
   * O buraco que a contagem de Nucleos fechou.
   *
   * Numa descida de G-04 (Nucleos nos setores 3 e 7) da para recolher o
   * INTERMEDIARIO e subir na hora. Enquanto a nota lia so a fase, essa run
   * ganhava TRES estrelas por metade do contrato — e ganhava facil, porque o
   * tempo-alvo e derivado dos sete setores enquanto ela so precisou de tres. A
   * saida antecipada era a jogada otima E a mais bem avaliada, que e o
   * contrario do que a escada existe para dizer.
   */
  it('sair cedo com um Nucleo de dois nao chega na terceira estrela', () => {
    const cedo = funda({ cores: 1, ticks: Math.floor(TARGET_TICKS / 4) });
    expect(starsFor(cedo)).toBe(2);
  });

  it('os dois Nucleos dentro do tempo, ai sim', () => {
    expect(starsFor(funda({ ticks: TARGET_TICKS }))).toBe(3);
    expect(starsFor(funda({ ticks: TARGET_TICKS + 1 }))).toBe(2);
  });

  // A descida rasa nao mudou de nota nenhuma: com UM Nucleo disponivel, "todos"
  // e "aquele", e a regra nova devolve exatamente a antiga.
  it('em descida de um Nucleo so, a regra e a mesma de sempre', () => {
    expect(starsFor(rasa({ cores: 1, ticks: TARGET_TICKS - 1 }))).toBe(3);
    expect(starsFor(rasa({ cores: 1, ticks: TARGET_TICKS + 1 }))).toBe(2);
    expect(starsFor(rasa({ cores: 0, phase: 'extracted' }))).toBe(1);
  });

  it('e monotonica no tempo: demorar nunca sobe a nota', () => {
    let previous = 4;
    for (let t = 0; t <= TARGET_TICKS * 2; t += TARGET_TICKS / 8) {
      const stars = starsFor(funda({ ticks: t }));
      expect(stars).toBeLessThanOrEqual(previous);
      previous = stars;
    }
  });

  // …e monotonica nos Nucleos, na outra direcao: trazer mais nunca desce a nota.
  it('e monotonica nos Nucleos: trazer mais nunca desce a nota', () => {
    let previous = 0;
    for (let cores = 0; cores <= 2; cores++) {
      // `phase` acompanha a contagem: a sim nunca produz `extracted_with_core`
      // com zero Nucleo, e passar essa combinacao aqui testaria um estado que
      // nao existe.
      const stars = starsFor(
        funda({ cores, phase: cores === 0 ? 'extracted' : 'extracted_with_core' }),
      );
      expect(stars).toBeGreaterThanOrEqual(previous);
      previous = stars;
    }
  });
});

describe('a pontuacao da run', () => {
  /**
   * Duas grandezas, e so elas. O sumario carrega minerio, abates, dano,
   * descobertas — nenhuma entra: sao consequencia de como a run foi jogada, e
   * nenhuma e o que a run pede. Este teste falha no dia em que alguem
   * acrescentar a terceira.
   */
  const scored = (over: Partial<RunSummary>): RunSummary =>
    ({ cores: 1, ticks: 1000, sectorCount: 3, ...over }) as RunSummary;

  it('le so Nucleos e tempo do sumario', () => {
    expect(runScore(scored({ cores: 2, ticks: 4321 }))).toEqual({ cores: 2, ticks: 4321 });
  });

  it('mais Nucleos primeiro', () => {
    expect(compareRunScore(scored({ cores: 2 }), scored({ cores: 1 }))).toBeLessThan(0);
  });

  it('entre Nucleos iguais, menos tempo primeiro', () => {
    expect(compareRunScore(scored({ ticks: 500 }), scored({ ticks: 900 }))).toBeLessThan(0);
  });

  /**
   * O Nucleo vale mais que qualquer tempo, e de proposito: ele e o OBJETIVO, e
   * uma descida que volta com dois cumpriu duas vezes o que a Aurix pediu.
   * Nenhuma pressa compra isso.
   */
  it('nenhum tempo compra um Nucleo', () => {
    const doisLento = scored({ cores: 2, ticks: 999_999 });
    const umInstantaneo = scored({ cores: 1, ticks: 1 });
    expect(compareRunScore(doisLento, umInstantaneo)).toBeLessThan(0);
  });

  // Empate REAL devolve zero: quem chama decide o desempate (o ranking mantem
  // quem chegou antes). Desempatar aqui obrigaria a pontuacao a conhecer id,
  // data ou nome — coisas que nao sao pontuacao.
  it('empate nao inventa desempate', () => {
    expect(compareRunScore(scored({}), scored({}))).toBe(0);
  });

  // A classe e a descida, e nao a geracao: G-00 e G-01 autorizam a MESMA
  // descida, e separa-las criaria dois livros para uma prova so.
  it('a classe da run e a profundidade que ela atravessou', () => {
    expect(runClass(scored({ sectorCount: 7 }))).toBe(7);
  });

  /**
   * A NOTA E A POSICAO NAO SE CONTRADIZEM — e este teste e o que sustenta a
   * tela do ranking.
   *
   * Dentro de um livro (profundidade fixa), ordenar por `compareRunScore` tem de
   * produzir estrelas que nunca SOBEM linha a linha. Se subissem, o jogador
   * veria uma ★★★ abaixo de uma ★★☆ e leria a lista como quebrada — e teria
   * razao em desconfiar, porque duas regras estariam medindo coisas diferentes.
   *
   * Antes de a nota contar Nucleos isto era falso: uma run de um Nucleo (de
   * dois) e rapida tirava tres estrelas e caia para o terceiro lugar atras de
   * duas de dois Nucleos com duas estrelas. Nao era so feio na tela — era o
   * sintoma de a escada premiar meia entrega.
   */
  it('dentro de um livro, a nota nunca sobe ao descer na lista', () => {
    const CORES_DISPONIVEIS = 2;
    const ALVO = 20_000;
    const runs: { cores: number; ticks: number }[] = [];
    for (let cores = 0; cores <= CORES_DISPONIVEIS; cores++) {
      for (const ticks of [1_000, ALVO - 1, ALVO, ALVO + 1, 90_000]) runs.push({ cores, ticks });
    }
    const ordenadas = [...runs].sort(compareRunScore);
    let previous = 4;
    for (const run of ordenadas) {
      const stars = starsFor({
        phase: run.cores > 0 ? 'extracted_with_core' : 'extracted',
        ticks: run.ticks,
        targetTicks: ALVO,
        cores: run.cores,
        coresAvailable: CORES_DISPONIVEIS,
      });
      expect(stars, `${run.cores} nucleos em ${run.ticks} ticks`).toBeLessThanOrEqual(previous);
      previous = stars;
    }
  });
});

describe('causa de morte', () => {
  // O caso que justifica o sistema inteiro: estas tres mortes eram
  // indistinguiveis na tela de fim, e sao licoes completamente diferentes.
  it('distingue o gas do inimigo e da propria explosao', () => {
    expect(killWith({ kind: 'gas' }).summary?.deathCause).toEqual({ kind: 'gas' });
    expect(killWith({ kind: 'explosion', source: 'player' }).summary?.deathCause).toEqual({
      kind: 'explosion',
      source: 'player',
    });
    expect(
      killWith({ kind: 'enemy_contact', archetype: 'bruiser', elite: false }).summary?.deathCause
    ).toEqual({ kind: 'enemy_contact', archetype: 'bruiser', elite: false });
  });

  it('preserva de qual criatura veio o projetil', () => {
    const cause: DamageCause = {
      kind: 'enemy_projectile',
      archetype: 'spitter',
      elite: true,
      projectile: 'spit',
    };
    expect(killWith(cause).summary?.deathCause).toEqual(cause);
  });

  // O ultimo golpe nao e o culpado: o fogo de 2,2 por tick costuma ser a ultima
  // coisa a acertar quem ja levou 22 de pedrada. O campo responde "o que te
  // matou", e a resposta e o dano que zerou a vida.
  it('guarda a causa do dano que efetivamente matou', () => {
    const state = createRun({ seed: 11 });
    const events: never[] = [];
    damageEntity(state, state.player, 10, events, { kind: 'fire' });
    damageEntity(state, state.player, PLAYER_HP, events, {
      kind: 'enemy_projectile', archetype: 'bruiser', elite: false, projectile: 'rock',
    });
    runUntilOver(state, 5);
    expect(state.summary?.deathCause?.kind).toBe('enemy_projectile');
  });

  // Sangrar ate o fim e uma licao DIFERENTE do golpe que derrubou: a primeira
  // culpa o combate, a segunda culpa o parceiro que nao chegou a tempo.
  it('sangramento sobrescreve a causa do golpe que derrubou', () => {
    const state = createRun({ seed: 3, playerCount: 2 });
    const events: never[] = [];
    damageEntity(state, state.players[0], PLAYER_HP * 2, events, {
      kind: 'enemy_contact', archetype: 'stalker', elite: false,
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(state.playerExtras[0].downed).toBe(true);
    expect(state.playerExtras[0].lastDamage?.cause.kind).toBe('enemy_contact');

    for (let i = 0; i < BLEEDOUT_TICKS + 5; i++) stepRun(state, [emptyCommand(), emptyCommand()]);
    expect(state.players[0].alive).toBe(false);
    expect(state.playerExtras[0].lastDamage?.cause).toEqual({ kind: 'bleedout' });
  });

  /**
   * O SEGUNDO a cair nunca sangra: sem aliado de pe, `resolveDownedAndDeaths`
   * mata na hora em vez de abater. A consequencia — que o teste fixa — e que a
   * causa que encerra a run e sempre a do ultimo a cair, e nunca 'bleedout'
   * enquanto os dois slots estiverem ocupados.
   */
  it('a causa que encerra a run e a do ultimo a cair', () => {
    const state = createRun({ seed: 3, playerCount: 2 });
    const events: never[] = [];
    damageEntity(state, state.players[0], PLAYER_HP * 2, events, {
      kind: 'enemy_contact', archetype: 'stalker', elite: false,
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);

    damageEntity(state, state.players[1], PLAYER_HP * 2, events, {
      kind: 'explosion', source: 'player',
    });
    stepRun(state, [emptyCommand(), emptyCommand()]);

    expect(state.phase).toBe('dead');
    expect(state.summary?.deathCause).toEqual({ kind: 'explosion', source: 'player' });
  });

  it('extracao nao tem causa de morte, mesmo tendo levado dano no caminho', () => {
    const state = createRun({ seed: 5 });
    const events: never[] = [];
    damageEntity(state, state.player, 10, events, { kind: 'fire' });
    // A fase E a posse, e nao so a fase. Forjar `extracted_with_core` com a
    // mascara vazia montava um estado que a sim nao produz — e a nota, que
    // agora conta Nucleos, lia dali "extraiu de maos vazias".
    markCoreTaken(state, deepestCoreSector(state));
    state.phase = 'extracted_with_core';
    // buildSummary direto: alcancar a extracao de verdade exigiria dirigir uma
    // run inteira, e o que esta sob teste e a regra do campo, nao o trajeto.
    const summary = buildSummary(state, runEndingCauseForTest(state));
    expect(summary.deathCause).toBeNull();
    expect(summary.stars).toBeGreaterThanOrEqual(2);
  });
});

describe('sumario da run', () => {
  it('e congelado uma vez e nao muda depois', () => {
    const state = killWith({ kind: 'fire' });
    const first = state.summary;
    expect(first).not.toBeNull();
    for (let i = 0; i < 20; i++) stepRun(state, idle());
    // Mesma REFERENCIA: reconstruir daria numeros mudando enquanto o jogador le.
    expect(state.summary).toBe(first);
  });

  it('carrega a seed, para a run poder ser compartilhada e repetida', () => {
    const state = killWith({ kind: 'fire' }, 4242);
    expect(state.summary?.seed).toBe(4242);
  });

  it('conta os tiros disparados', () => {
    const state = createRun({ seed: 9 });
    const cmd = { ...emptyCommand(), fire: true };
    for (let i = 0; i < 40; i++) stepRun(state, [cmd]);
    expect(state.stats.shotsFired).toBeGreaterThan(0);
    // Cadencia de 5 ticks: 40 ticks nao podem produzir 40 tiros.
    expect(state.stats.shotsFired).toBeLessThanOrEqual(9);
  });

  it('acumula dano recebido em decimos inteiros', () => {
    const state = createRun({ seed: 13 });
    const events: never[] = [];
    // 2,2 e o dano de fogo por tick: em float puro, somar dez vezes nao da 22.
    for (let i = 0; i < 10; i++) {
      state.playerExtras[0].iframesUntil = 0;
      damageEntity(state, state.player, 2.2, events, { kind: 'fire' });
    }
    expect(state.stats.damageTakenTenths).toBe(220);
    expect(Number.isInteger(state.stats.damageTakenTenths)).toBe(true);
  });

  // Contar tudo que nao veio de inimigo inflava o numero em silencio: fogo
  // ambiente consumindo um bicho num canto do mapa somaria como feito do jogador.
  it('so credita dano atribuivel ao jogador', () => {
    const state = createRun({ seed: 17 });
    const events: never[] = [];
    const enemy = state.enemies[0];

    damageEntity(state, enemy, 5, events, { kind: 'fire' });
    expect(state.stats.damageDealtTenths).toBe(0);

    damageEntity(state, enemy, 5, events, { kind: 'explosion', source: 'enemy' });
    expect(state.stats.damageDealtTenths).toBe(0);

    damageEntity(state, enemy, 5, events, { kind: 'player_shot' });
    expect(state.stats.damageDealtTenths).toBe(50);

    damageEntity(state, enemy, 5, events, { kind: 'explosion', source: 'player' });
    expect(state.stats.damageDealtTenths).toBe(100);
  });

  it('nao credita o excedente do golpe fatal', () => {
    const state = createRun({ seed: 19 });
    const events: never[] = [];
    const enemy = state.enemies[0];
    enemy.hp = 3;
    damageEntity(state, enemy, 40, events, { kind: 'player_shot' });
    expect(state.stats.damageDealtTenths).toBe(30); // 3 de vida, nao 40 de golpe
  });

  it('registra o abate por arquetipo', () => {
    const state = createRun({ seed: 23 });
    const events: never[] = [];
    const enemy = state.enemies.find((e) => e.archetype === 'stalker');
    expect(enemy).toBeDefined();
    damageEntity(state, enemy!, 9999, events, { kind: 'player_shot' });
    expect(state.stats.kills.stalker).toBe(1);
  });
});

describe('determinismo com os contadores', () => {
  // Contadores entram no hash porque o leaderboard verifica runs re-simulando o
  // log de comandos. Fora do hash, um resultado com os mesmos movimentos e
  // contagens diferentes passaria pela verificacao.
  it('mesma seed e mesmos comandos produzem o mesmo hash', () => {
    const play = (): string => {
      const state = createRun({ seed: 31337 });
      for (let i = 0; i < 120; i++) {
        stepRun(state, [{ ...emptyCommand(), fire: i % 3 === 0, move: { x: 1, y: 0 } }]);
      }
      return hashAuthoritativeState(state);
    };
    expect(play()).toBe(play());
  });

  it('um contador diferente muda o hash', () => {
    const state = createRun({ seed: 555 });
    const before = hashAuthoritativeState(state);
    state.stats.shotsFired += 1;
    expect(hashAuthoritativeState(state)).not.toBe(before);
  });

  // Object.keys funcionaria por acidente e quebraria em silencio se alguem
  // reordenasse o literal de emptyStats.
  it('a ordem dos arquetipos no hash nao depende da ordem de insercao', () => {
    const a = createRun({ seed: 777 });
    const b = createRun({ seed: 777 });
    b.stats.kills = { guardian: 0, bomber: 0, spitter: 0, bruiser: 0, stalker: 0 };
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
  });
});
