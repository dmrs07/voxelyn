import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { ARCHETYPES, damageEntity, spawnEnemy } from '../src/entities';
import {
  BOSS_OF_OCCUPATION,
  BOSS_OF_STRATUM,
  IMPLEMENTED_BOSS,
  bossArchetypeForBiome,
  bossForBiome,
} from '../src/bosses';
import { sectorBiome } from '../src/strata';
import { emptyStats } from '../src/stats';
import { heatFungalCell } from '../src/cells';
import {
  BISHOP_NOVA_COOLDOWN_TICKS,
  BOLT_COOLDOWN_TICKS,
  BOLT_DAMAGE,
  BISHOP_NOVA_SEEK_TICKS,
  BISHOP_NOVA_WINDUP_TICKS,
  BISHOP_NOVA_RADIUS,
  BISHOP_NOVA_TRAVEL_TICKS,
  BISHOP_REGEN_PER_TICK,
  BISHOP_RETREAT_HP_FRACTION,
  GUARDIAN_FAN_SPREAD,
  GUARDIAN_VOLLEY_SHOTS,
  HORSE_CHARGE_TICKS,
  HORSE_CHARGE_WINDUP_TICKS,
  DEFAULT_SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
} from '../src/constants';
import { BOSS_PHASE_SUMMON } from '../src/types';
import {
  DISCOVERY_BISHOP_HEALED,
  DISCOVERY_BISHOP_NOVA_SURVIVED,
  type EnemyArchetype,
  type SemanticEvent,
  type SurvivalState,
} from '../src/types';

/** Primeira seed >= base cujo setor FINAL recebe o arquetipo pedido. */
const seedWithFinalBoss = (archetype: EnemyArchetype, base = 1): number => {
  for (let seed = base; seed < base + 4096; seed++) {
    if (bossArchetypeForBiome(sectorBiome(seed, DEFAULT_SECTOR_COUNT)) === archetype) return seed;
  }
  throw new Error(`nenhuma seed proxima de ${base} com ${archetype} no setor final`);
};

const stepIdle = (state: SurvivalState, ticks: number): void => {
  for (let t = 0; t < ticks; t++) stepRun(state, [emptyCommand()]);
};

/** Chao livre e limpo em volta do jogador, para isolar o comportamento sob teste. */
const clearArena = (state: SurvivalState, radius: number): void => {
  const w = state.config.width;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.solid[y * w + x] = SOLID_NONE;
      state.surface[y * w + x] = SURF_NONE;
      state.surfaceTimer[y * w + x] = 0;
    }
  }
};

const paint = (state: SurvivalState, cx: number, cy: number, radius: number, kind: number): void => {
  const w = state.config.width;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= state.config.height - 1) continue;
      state.surface[y * w + x] = kind;
      state.surfaceTimer[y * w + x] = 6000;
    }
  }
};

const archetypesOf = (state: SurvivalState): string[] => state.enemies.map((e) => e.archetype);

describe('tabela de arquetipos', () => {
  // A guarda que faltava quando 'bishop' e 'fungal_horse' foram adicionados:
  // `RunStats.kills` e o hash autoritativo iteram arquetipos por lista, e uma
  // lista incompleta nao quebra o typecheck — quebra o hash em producao, so no
  // co-op, so quando alguem matar o bicho esquecido.
  it('todo arquetipo tem definicao e contador', () => {
    for (const archetype of Object.keys(ARCHETYPES) as EnemyArchetype[]) {
      expect(ARCHETYPES[archetype], archetype).toBeDefined();
      expect(emptyStats().kills[archetype], `${archetype} sem contador`).toBe(0);
    }
    expect(Object.keys(emptyStats().kills).sort()).toEqual(Object.keys(ARCHETYPES).sort());
  });
});

describe('chefes por bioma — bossForBiome', () => {
  it('ocupacao forte substitui o chefe do estrato', () => {
    expect(bossForBiome({ stratum: 'aquifer', occupation: 'mycelial' })).toBe('bishop');
    expect(bossForBiome({ stratum: 'prismatic', occupation: 'mycelial' })).toBe('bishop');
    expect(bossForBiome({ stratum: 'ferric', occupation: 'aurix' })).toBe('diamandis');
  });

  it('sem ocupacao dominante, entra o chefe natural do estrato', () => {
    expect(bossForBiome({ stratum: 'basalt', occupation: 'none' })).toBe('guardian');
    expect(bossForBiome({ stratum: 'prismatic', occupation: 'none' })).toBe('archcantor');
    expect(bossForBiome({ stratum: 'aquifer', occupation: 'none' })).toBe('sheet_leviathan');
    expect(bossForBiome({ stratum: 'sulfur', occupation: 'none' })).toBe('lung_matrix');
    expect(bossForBiome({ stratum: 'furnace', occupation: 'none' })).toBe('furnace_heart');
    expect(bossForBiome({ stratum: 'silica', occupation: 'none' })).toBe('white_devourer');
    expect(bossForBiome({ stratum: 'glacial', occupation: 'none' })).toBe('frost_queen');
    expect(bossForBiome({ stratum: 'ferric', occupation: 'none' })).toBe('magnetarch');
  });

  it('a tabela esta COMPLETA: todo bioma tem o proprio dono', () => {
    // O fallback no Guardiao sustentou a selecao enquanto a lista era parcial.
    // Agora nao responde por nenhuma linha — e este teste e o que impede que
    // ele volte a responder em silencio quando um BossId novo entrar.
    for (const stratum of Object.keys(BOSS_OF_STRATUM) as (keyof typeof BOSS_OF_STRATUM)[]) {
      const id = BOSS_OF_STRATUM[stratum];
      expect(IMPLEMENTED_BOSS[id], `estrato ${stratum} -> ${id} sem corpo`).toBeDefined();
    }
    for (const id of Object.values(BOSS_OF_OCCUPATION)) {
      expect(IMPLEMENTED_BOSS[id], `ocupacao -> ${id} sem corpo`).toBeDefined();
    }
    expect(bossArchetypeForBiome({ stratum: 'prismatic', occupation: 'none', lineage: 'mineral' }))
      .toBe('archcantor');
    expect(bossArchetypeForBiome({ stratum: 'aquifer', occupation: 'mycelial', lineage: 'hydric' }))
      .toBe('bishop');
    expect(bossArchetypeForBiome({ stratum: 'basalt', occupation: 'none', lineage: 'basaltic' }))
      .toBe('guardian');
  });
});

describe('Bispo — onde ele mora', () => {
  it('e o chefe do mapa final profundamente ocupado pelo micelio', () => {
    // A linhagem hidrica termina em Aquifero + Matriz Micelial: o Bispo e o
    // chefe DALI — nao mais "o chefe obrigatorio do setor 2".
    const seed = seedWithFinalBoss('bishop');
    expect(archetypesOf(createRun({ seed, sector: DEFAULT_SECTOR_COUNT }))).toContain('bishop');
  });

  it('o setor 1 nunca tem chefe, e o do meio tambem nao', () => {
    for (const seed of [7, 11, 42, seedWithFinalBoss('bishop')]) {
      for (const sector of [1, 2]) {
        const kinds = archetypesOf(createRun({ seed, sector }));
        expect(kinds, `seed ${seed} s${sector}`).not.toContain('bishop');
        expect(kinds, `seed ${seed} s${sector}`).not.toContain('guardian');
      }
    }
  });

  it('ha UM chefe no setor final, nunca dois', () => {
    for (const seed of [seedWithFinalBoss('bishop'), seedWithFinalBoss('guardian')]) {
      const kinds = archetypesOf(createRun({ seed, sector: DEFAULT_SECTOR_COUNT }));
      const bosses = kinds.filter((k) => k === 'bishop' || k === 'guardian');
      expect(bosses.length, `seed ${seed}`).toBe(1);
    }
  });
});

describe('Bispo — a cura vem do chao', () => {
  it('regenera em pe sobre fungo vivo', () => {
    const state = createRun({ seed: 31 });
    clearArena(state, 14);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 8, Math.floor(state.player.y), false);
    paint(state, Math.floor(bishop.x), Math.floor(bishop.y), 3, SURF_FUNGAL);
    bishop.hp = 100;

    stepIdle(state, 10);

    expect(bishop.hp).toBeGreaterThan(100);
    expect(bishop.hp).toBeLessThanOrEqual(100 + BISHOP_REGEN_PER_TICK * 11);
  });

  // O ponto INTEIRO do encontro. Se a cura so parasse quando a chama sobe, a
  // recompensa por encostar calor chegaria segundos depois da acao e o jogador
  // nao ligaria uma coisa a outra.
  it('para de curar assim que o fungo esquenta, antes de virar fogo', () => {
    const state = createRun({ seed: 32 });
    clearArena(state, 14);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 8, Math.floor(state.player.y), false);
    paint(state, Math.floor(bishop.x), Math.floor(bishop.y), 3, SURF_FUNGAL);
    bishop.hp = 100;
    stepIdle(state, 4);
    const healed = bishop.hp;
    expect(healed).toBeGreaterThan(100);

    // Aquece o tapete inteiro: nenhuma celula virou fogo ainda.
    const w = state.config.width;
    for (let y = Math.floor(bishop.y) - 3; y <= Math.floor(bishop.y) + 3; y++) {
      for (let x = Math.floor(bishop.x) - 3; x <= Math.floor(bishop.x) + 3; x++) {
        heatFungalCell(state, y * w + x, true);
      }
    }
    expect(state.surface[Math.floor(bishop.y) * w + Math.floor(bishop.x)]).not.toBe(SURF_FIRE);

    const before = bishop.hp;
    stepIdle(state, 4);
    expect(bishop.hp, 'continuou se curando em fungo aquecido').toBeLessThanOrEqual(before);
  });

  it('nao passa da vida maxima', () => {
    const state = createRun({ seed: 33 });
    clearArena(state, 14);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 9, Math.floor(state.player.y), false);
    paint(state, Math.floor(bishop.x), Math.floor(bishop.y), 3, SURF_FUNGAL);
    bishop.hp = bishop.maxHp - 1;
    stepIdle(state, 30);
    expect(bishop.hp).toBe(bishop.maxHp);
  });

  it('anuncia a cura no barramento semantico, e nao a cada tick', () => {
    const state = createRun({ seed: 34 });
    clearArena(state, 14);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 8, Math.floor(state.player.y), false);
    paint(state, Math.floor(bishop.x), Math.floor(bishop.y), 3, SURF_FUNGAL);
    bishop.hp = 50;

    const heals: SemanticEvent[] = [];
    for (let t = 0; t < 20; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'heal') heals.push(ev);
      }
    }
    expect(heals.length).toBeGreaterThan(0);
    // 20 ticks a cada 4 = no maximo 5 anuncios, e nao 20.
    expect(heals.length).toBeLessThanOrEqual(6);
    expect(heals[0]).toMatchObject({ entity: bishop.id });
  });
});

describe('Bispo — o tell', () => {
  // O contra-jogo nao esta escrito em lugar nenhum do jogo: esta no fato de o
  // chefe APONTAR para o que o mantem vivo toda vez que se machuca.
  it('ferido e fora do fungo, abandona a perseguicao e vai ate o tapete', () => {
    const state = createRun({ seed: 41 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 6, py, false);
    // Fungo do lado OPOSTO ao jogador: ir ate ele so pode significar recuar.
    paint(state, px + 14, py, 2, SURF_FUNGAL);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);

    const distBefore = Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y);
    stepIdle(state, 30);
    const distAfter = Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y);

    expect(distAfter, 'continuou perseguindo em vez de buscar cura').toBeGreaterThan(distBefore + 1);
    expect(bishop.x).toBeGreaterThan(px + 7);
  });

  // A sequencia que a luta inteira existe para produzir: queimei o tapete, ele
  // fugiu, nao achou nada, e REPLANTOU. Cada passo e consequencia do anterior.
  it('ferido e sem fungo ao alcance, replanta o tapete com a Supernova', () => {
    const state = createRun({ seed: 42 });
    clearArena(state, 20);
    const w = state.config.width;
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 6, Math.floor(state.player.y), false);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);
    const fungalNear = (): number => {
      let n = 0;
      for (let y = Math.floor(bishop.y) - 6; y <= Math.floor(bishop.y) + 6; y++) {
        for (let x = Math.floor(bishop.x) - 6; x <= Math.floor(bishop.x) + 6; x++) {
          if (state.surface[y * w + x] === SURF_FUNGAL) n++;
        }
      }
      return n;
    };
    expect(fungalNear()).toBe(0);

    let telegraph = false;
    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + 12; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === bishop.id && ev.action === 'pulse') telegraph = true;
      }
    }
    expect(telegraph, 'nao telegrafou a Supernova').toBe(true);
    expect(fungalNear(), 'a Supernova nao replantou nada').toBeGreaterThan(20);
  });

  // O replantio nao pode plantar POR CIMA do incendio: apagar o fogo que o
  // jogador acabou de acender transformaria a acao dele em nada.
  it('a Supernova nao apaga o fogo que ja esta no chao', () => {
    const state = createRun({ seed: 44 });
    clearArena(state, 20);
    const w = state.config.width;
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 6, Math.floor(state.player.y), false);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);
    const burning = Math.floor(bishop.y) * w + Math.floor(bishop.x) + 2;
    state.surface[burning] = SURF_FIRE;
    state.surfaceTimer[burning] = 4000;

    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + 6; t++) stepRun(state, [emptyCommand()]);
    expect(state.surface[burning]).toBe(SURF_FIRE);
  });

  // A arena queimada nao o deixa acuado: deixa-o mortal. Sem isso, queimar tudo
  // viraria um botao de desligar o chefe.
  it('ferido, sem fungo e com a Supernova em recarga, volta a perseguir', () => {
    const state = createRun({ seed: 45 });
    clearArena(state, 20);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 6, Math.floor(state.player.y), false);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);
    bishop.nextActionAt = state.tick + 10_000; // supernova indisponivel

    const distBefore = Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y);
    stepIdle(state, 30);
    expect(Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y)).toBeLessThan(distBefore);
  });

  it('inteiro, persegue mesmo com fungo por perto', () => {
    const state = createRun({ seed: 43 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 6, py, false);
    paint(state, px + 14, py, 2, SURF_FUNGAL);
    // Supernova em recarga: aqui interessa a perseguicao, nao o ataque.
    bishop.nextActionAt = state.tick + 10_000;

    const distBefore = Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y);
    stepIdle(state, 30);
    expect(Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y)).toBeLessThan(distBefore);
  });

  // O caso que travava a Supernova PARA SEMPRE: uma unica celula de fungo
  // detectavel pela varredura, mas inalcancavel atras de uma parede. A regra
  // antiga ("so dispara se NAO houver fungo em 14 tiles") fazia o Bispo recuar
  // eternamente contra a pedra. A regra nova mede o que importa: ele PISOU em
  // fungo dentro da janela? Nao pisou — replanta.
  it('fungo detectavel mas INALCANCAVEL atras de parede: a Supernova sai apos a janela', () => {
    const state = createRun({ seed: 46 });
    clearArena(state, 20);
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 6, py, false);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);
    // Uma celula de fungo a leste — atras de um muro que o corpo dele nao passa.
    const fx = px + 12;
    state.surface[py * w + fx] = SURF_FUNGAL;
    state.surfaceTimer[py * w + fx] = 0;
    for (let dy = -8; dy <= 8; dy++) state.solid[(py + dy) * w + (fx - 2)] = SOLID_ROCK;

    let telegraph = false;
    for (let t = 0; t < BISHOP_NOVA_SEEK_TICKS + BISHOP_NOVA_WINDUP_TICKS + 20 && !telegraph; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === bishop.id && ev.action === 'pulse') telegraph = true;
      }
    }
    expect(telegraph, 'a celula inalcancavel bloqueou a Supernova para sempre').toBe(true);
  });

  // A Supernova e a resposta PRIMARIA a distancia — ela existe na luta normal,
  // nao apenas no cenario artificial com o mapa inteiro queimado.
  it('em luta normal, com o jogador dentro do raio, a Supernova sai', () => {
    const state = createRun({ seed: 47 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    // INTEIRO e em cima do proprio tapete: nada de retirada envolvida.
    const bishop = spawnEnemy(state, 'bishop', px + 4, py, false);
    paint(state, px + 4, py, 3, SURF_FUNGAL);

    let telegraph = false;
    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + 20 && !telegraph; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === bishop.id && ev.action === 'pulse') telegraph = true;
      }
    }
    expect(telegraph, 'a Supernova nao participa da luta normal').toBe(true);
    // E cobra a recarga: nao vira metralhadora de area.
    expect(bishop.nextActionAt - state.tick).toBeGreaterThan(BISHOP_NOVA_COOLDOWN_TICKS / 2);
  });

  it('o Bispo NAO cospe: nenhum projetil sai dele', () => {
    const state = createRun({ seed: 48 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 5, py, false);

    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      expect(
        state.projectiles.some((p) => p.owner === bishop.id),
        `tick ${t}: o chefe do chao atirou gosma`,
      ).toBe(false);
      if (!state.player.alive) break;
    }
  });
});

// O arco documental do Bispo nao abre por FARM: ele aparece uma vez por run,
// no maximo, e uma grade de abates transformaria a revelacao em cinquenta
// descidas. Abre por ENTENDER o encontro — e sao estes dois bits que medem o
// entendimento.
describe('Bispo — as Descobertas de entendimento', () => {
  const healingScene = (seed: number) => {
    const state = createRun({ seed });
    clearArena(state, 16);
    const bishop = spawnEnemy(
      state,
      'bishop',
      Math.floor(state.player.x) + 8,
      Math.floor(state.player.y),
      false,
    );
    paint(state, Math.floor(bishop.x), Math.floor(bishop.y), 3, SURF_FUNGAL);
    bishop.hp = 100;
    return { state, bishop };
  };

  it('ver a cura de perto marca a Descoberta', () => {
    const { state } = healingScene(91);
    stepIdle(state, 8);
    expect(state.stats.discoveries & DISCOVERY_BISHOP_HEALED).not.toBe(0);
  });

  it('a cura atras de uma parede NAO marca: medicao de campo exige campo', () => {
    const { state, bishop } = healingScene(92);
    const w = state.config.width;
    const wallX = Math.floor((state.player.x + bishop.x) / 2);
    for (let dy = -6; dy <= 6; dy++) {
      state.solid[(Math.floor(state.player.y) + dy) * w + wallX] = SOLID_ROCK;
    }
    stepIdle(state, 8);
    expect(bishop.hp, 'a cena nao chegou a curar: o teste nao mede nada').toBeGreaterThan(100);
    expect(state.stats.discoveries & DISCOVERY_BISHOP_HEALED).toBe(0);
  });

  it('SOBRE FUNGO o tiro base nao derruba: o atrito perde para a cura', () => {
    // O teste de aceitacao que o playtest pediu, palavra por palavra: um
    // Prospector com arma normal, atirando continuamente num Bispo sobre fungo,
    // nao consegue reduzir a vida dele de forma sustentavel.
    //
    // A regra antiga dizia isso num comentario e nao cumpria na conta: a cura
    // era 24/s contra 56/s de bolt sustentado, ou seja, menos da metade. Dava
    // para queimar o Bispo EM CIMA do tapete, e o quebra-cabeca territorial —
    // "de que chao eu o tiro" — nunca precisava ser resolvido.
    const state = createRun({ seed: 41 });
    clearArena(state, 16);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 6, py, false);
    paint(state, px, py, 14, SURF_FUNGAL);

    for (let t = 0; t < 600; t++) {
      if (t % BOLT_COOLDOWN_TICKS === 0) {
        damageEntity(state, bishop, BOLT_DAMAGE, [], { kind: 'player_shot' });
      }
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      // O tapete e uma propriedade do lugar, e o lugar nao pode secar sozinho
      // no meio da medicao: o que esta sob teste e a cura contra o dano, e nao
      // a durabilidade do fungo.
      paint(state, px, py, 14, SURF_FUNGAL);
    }
    expect(bishop.alive, 'trinta segundos de tiro base derrubaram o Bispo no tapete').toBe(true);
    expect(bishop.hp, 'o atrito venceu a cura sobre fungo vivo').toBeGreaterThan(
      bishop.maxHp * 0.9,
    );
  });

  it('FORA do fungo o mesmo tiro derruba: o problema e o chao, nao a barra', () => {
    // O controle do teste acima, e ele e o que impede a correcao de virar um
    // chefe simplesmente mais duro. A vida nao subiu; o que decide e onde ele
    // pisa.
    const state = createRun({ seed: 42 });
    clearArena(state, 16);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 6, py, false);

    for (let t = 0; t < 600 && bishop.alive; t++) {
      if (t % BOLT_COOLDOWN_TICKS === 0) {
        damageEntity(state, bishop, BOLT_DAMAGE, [], { kind: 'player_shot' });
      }
      // A Supernova replanta: sem limpar, o proprio chefe refaz o chao que este
      // teste precisa que NAO exista.
      clearArena(state, 16);
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
    }
    expect(bishop.alive, 'sem tapete embaixo ele deveria cair').toBe(false);
  });

  it('a Supernova VIAJA: o tapete cresce de dentro para fora', () => {
    // "Apareceu mais um pouco de fungo perto dele" e "eu limpei a arena e ele
    // acabou de retomar a arena" sao a mesma mecanica com duas leituras
    // diferentes, e a diferenca inteira e a frente andar. Um disco que nasce
    // pronto num tick nao consegue dizer a segunda frase.
    const state = createRun({ seed: 95 });
    clearArena(state, 20);
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 3, py, false);

    const bx = Math.floor(bishop.x);
    const by = Math.floor(bishop.y);
    // Duas sondas na MESMA direcao (para longe do jogador, onde nada mais
    // mexe no chao): uma colada nele, outra na borda do disco.
    const near = by * w + bx + 2;
    const far = by * w + bx + (Math.floor(BISHOP_NOVA_RADIUS) - 1);
    let nearAt = -1;
    let farAt = -1;
    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + BISHOP_NOVA_TRAVEL_TICKS + 40; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (nearAt < 0 && state.surface[near] === SURF_FUNGAL) nearAt = t;
      if (farAt < 0 && state.surface[far] === SURF_FUNGAL) farAt = t;
    }
    expect(nearAt, 'a Supernova nao chegou a plantar nada').toBeGreaterThanOrEqual(0);
    expect(farAt, 'a frente nao chegou a borda do disco').toBeGreaterThanOrEqual(0);
    expect(farAt, 'a borda plantou junto com o centro: a onda nao viajou')
      .toBeGreaterThan(nearAt);
  });

  it('a frente FECHA o disco: a celula no raio maximo tambem recebe', () => {
    // `advanceAction` limpa a acao assim que `tick >= endsAt`, entao a frente
    // nunca roda no instante final. Normalizando pelo vao cheio, o ultimo passo
    // executado parava em 25/26 do percurso e a faixa externa do disco — de
    // ~8,65 a 9 — nunca recebia fungo nem dano. A borda que o telegrafo radial
    // prometeu tem de existir de verdade, senao o aviso mede uma coisa e o
    // golpe cobra outra.
    const state = createRun({ seed: 96 });
    clearArena(state, 20);
    const w = state.config.width;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const bishop = spawnEnemy(state, 'bishop', px + 3, py, false);
    const bx = Math.floor(bishop.x);
    const by = Math.floor(bishop.y);
    // Exatamente no raio maximo, na direcao oposta ao jogador.
    const rim = by * w + bx + Math.floor(BISHOP_NOVA_RADIUS);
    let planted = false;
    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + BISHOP_NOVA_TRAVEL_TICKS + 40 && !planted; t++) {
      stepRun(state, [emptyCommand()]);
      state.player.hp = state.player.maxHp;
      if (state.surface[rim] === SURF_FUNGAL) planted = true;
    }
    expect(planted, 'a borda do disco anunciado nunca recebeu a onda').toBe(true);
  });

  it('estar dentro do disco da Supernova e continuar de pe marca a Descoberta', () => {
    const state = createRun({ seed: 93 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    spawnEnemy(state, 'bishop', px + 4, py, false);
    paint(state, px + 4, py, 3, SURF_FUNGAL);

    for (let t = 0; t < BISHOP_NOVA_WINDUP_TICKS + 20; t++) {
      stepRun(state, [emptyCommand()]);
      if ((state.stats.discoveries & DISCOVERY_BISHOP_NOVA_SURVIVED) !== 0) break;
    }
    expect(state.player.hp, 'o jogador morreu: isso nao e sobreviver').toBeGreaterThan(0);
    expect(state.stats.discoveries & DISCOVERY_BISHOP_NOVA_SURVIVED).not.toBe(0);
  });

  it('ver a Supernova de FORA do disco nao marca nada', () => {
    const state = createRun({ seed: 94 });
    clearArena(state, 20);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    // Ferido e sem fungo: a Supernova sai pela janela de busca. O jogador fica
    // preso a uma distancia MAIOR que o raio a cada tick — a frente da onda
    // viaja, entao "fora do disco" so significa alguma coisa se continuar
    // valendo no instante em que ela chega ao fim do curso, e nao apenas no
    // instante do release.
    const bishop = spawnEnemy(state, 'bishop', px + 8, py, false);
    bishop.hp = bishop.maxHp * (BISHOP_RETREAT_HP_FRACTION - 0.1);
    // Fora do disco (9) e ainda dentro do aggro (10), que e a unica faixa em
    // que a cena existe: um Bispo que nao ve ninguem nao lanca Supernova
    // nenhuma, e o teste mediria o silencio em vez da regra.
    const outside = BISHOP_NOVA_RADIUS + 0.6;

    let fired = false;
    const window = BISHOP_NOVA_SEEK_TICKS + BISHOP_NOVA_WINDUP_TICKS + BISHOP_NOVA_TRAVEL_TICKS + 30;
    for (let t = 0; t < window; t++) {
      state.player.x = bishop.x + outside;
      state.player.y = bishop.y;
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'pulse' && Math.hypot(ev.x - bishop.x, ev.y - bishop.y) < 1) fired = true;
      }
    }
    expect(fired, 'a Supernova nao chegou a sair: o teste nao mede nada').toBe(true);
    expect(state.stats.discoveries & DISCOVERY_BISHOP_NOVA_SURVIVED).toBe(0);
  });
});

describe('Guardiao — Salva Litoclasta', () => {
  const guardianDuel = (seed: number): { state: SurvivalState; guardian: SurvivalState['enemies'][number] } => {
    const state = createRun({ seed });
    clearArena(state, 20);
    state.enemies = [];
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const guardian = spawnEnemy(state, 'guardian', px + 5, py, false);
    state.bossRuntime.awake = true;
    return { state, guardian };
  };

  /** Roda ate o primeiro release de salva e devolve as pedras do guardiao. */
  const fireOnce = (state: SurvivalState, guardian: { id: number }) => {
    for (let t = 0; t < 80; t++) {
      stepRun(state, [emptyCommand()]);
      const rocks = state.projectiles.filter((p) => p.owner === guardian.id);
      if (rocks.length > 0) return rocks;
    }
    return [];
  };

  it('atira um LEQUE de tres pedras, nunca gosma', () => {
    const { state, guardian } = guardianDuel(81);
    const rocks = fireOnce(state, guardian);
    expect(rocks.length, 'nenhuma pedra saiu').toBe(3);
    for (const rock of rocks) {
      expect(rock.kind, 'o chefe de basalto cuspiu').toBe('rock');
      expect(rock.leavesBiofluid, 'pedra sujou o chao de biofluido').toBe(false);
      expect(rock.stuns, 'pedra de salva nao pode atordoar (stun-lock)').toBeUndefined();
      expect(rock.radius, 'pedra sem hitbox visivel').toBeGreaterThan(0.3);
    }
    // Tres corredores: as direcoes abrem em leque, nao empilham no mesmo rumo.
    // Medido como desvio do rumo MEDIO (normalizado) para nao tropecar no
    // wraparound do atan2 quando o alvo esta a oeste (angulos perto de +-pi).
    const mid = Math.atan2(
      rocks.reduce((acc, r) => acc + r.vy, 0),
      rocks.reduce((acc, r) => acc + r.vx, 0),
    );
    const offsets = rocks
      .map((r) => {
        const d = Math.atan2(r.vy, r.vx) - mid;
        return Math.atan2(Math.sin(d), Math.cos(d));
      })
      .sort((a, b) => a - b);
    expect(offsets[0]).toBeCloseTo(-GUARDIAN_FAN_SPREAD, 1);
    expect(offsets[1]).toBeCloseTo(0, 1);
    expect(offsets[2]).toBeCloseTo(GUARDIAN_FAN_SPREAD, 1);
  });

  it('as pedras sao mais lentas que o cuspe do Spitter', () => {
    const { state, guardian } = guardianDuel(82);
    const rocks = fireOnce(state, guardian);
    expect(rocks.length).toBe(3);
    for (const rock of rocks) {
      expect(Math.hypot(rock.vx, rock.vy)).toBeLessThan(7);
    }
  });

  it('na segunda fase, alterna leque e RAJADA de tres pedras corrigidas', () => {
    const { state, guardian } = guardianDuel(83);
    guardian.hp = guardian.maxHp * 0.4; // enfurecido
    // A guarda de invocacao dispara stalkers; o teste isola a salva.
    state.bossRuntime.phasesFired |= BOSS_PHASE_SUMMON;

    // Primeira salva enfurecida (impar): RAJADA — as pedras saem em TICKS
    // diferentes, uma por release, com re-mira entre elas.
    const shotTicks: number[] = [];
    for (let t = 0; t < 200 && shotTicks.length < GUARDIAN_VOLLEY_SHOTS; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'shot' && ev.owner === guardian.id) shotTicks.push(state.tick);
      }
    }
    expect(shotTicks.length, 'a rajada nao completou os tres disparos').toBe(GUARDIAN_VOLLEY_SHOTS);
    expect(new Set(shotTicks).size, 'os disparos sairam todos juntos: isso e leque, nao rajada').toBe(
      GUARDIAN_VOLLEY_SHOTS,
    );
  });
});

describe('Cavalo Fungico', () => {
  const spawnHorseFacing = (state: SurvivalState, gap: number) => {
    clearArena(state, 24);
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    return spawnEnemy(state, 'fungal_horse', px + gap, py, false);
  };

  it('telegrafa a investida antes de sair do lugar', () => {
    const state = createRun({ seed: 51 });
    const horse = spawnHorseFacing(state, 9);
    const startX = horse.x;

    let telegraph: SemanticEvent | null = null;
    for (let t = 0; t < 40 && !telegraph; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === horse.id && ev.action === 'charge') telegraph = ev;
      }
    }
    expect(telegraph, 'nunca investiu').not.toBeNull();
    if (!telegraph || telegraph.t !== 'action_start') return;
    expect(telegraph.releaseTick - telegraph.startTick).toBe(HORSE_CHARGE_WINDUP_TICKS);
    // Parado durante o aviso: um telegrafo que ja move e um aviso do que ja
    // aconteceu.
    expect(Math.abs(horse.x - startX)).toBeLessThan(1.5);
  });

  it('deixa rastro de fogo na linha em que correu', () => {
    const state = createRun({ seed: 52 });
    const horse = spawnHorseFacing(state, 10);
    const w = state.config.width;
    const row = Math.floor(state.player.y);
    // Conta so DENTRO da arena limpa e so na faixa da corrida: fogo ambiente em
    // outro canto do mapa nao pode ser confundido com o rastro.
    const fireOnLane = (): number => {
      let n = 0;
      for (let x = Math.floor(state.player.x) - 4; x <= Math.floor(state.player.x) + 14; x++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (state.surface[(row + dy) * w + x] === SURF_FIRE) n++;
        }
      }
      return n;
    };
    expect(fireOnLane()).toBe(0);

    let charged = false;
    for (let t = 0; t < 60 && !charged; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === horse.id && ev.action === 'charge') charged = true;
      }
    }
    expect(charged, 'nunca investiu').toBe(true);
    // O `action_start` sai no inicio do TELEGRAFO, nao da corrida: medir o
    // rastro logo depois dele mediria o cavalo ainda parado.
    stepIdle(state, HORSE_CHARGE_WINDUP_TICKS + HORSE_CHARGE_TICKS);

    expect(fireOnLane(), 'a investida nao acendeu nada no caminho').toBeGreaterThan(2);
  });

  // O unico contra-jogo posicional que o cavalo oferece: quem le o telegrafo poe
  // pedra no caminho e ganha o cooldown inteiro de graca.
  it('a investida termina ao bater na pedra', () => {
    const state = createRun({ seed: 53 });
    const horse = spawnHorseFacing(state, 12);
    const w = state.config.width;
    const py = Math.floor(state.player.y);

    // Aguarda o telegrafo e so entao levanta a parede, no meio do caminho.
    let charged = false;
    for (let t = 0; t < 60 && !charged; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === horse.id && ev.action === 'charge') charged = true;
      }
    }
    expect(charged).toBe(true);
    const wallX = Math.floor((horse.x + state.player.x) / 2);
    for (let dy = -4; dy <= 4; dy++) state.solid[(py + dy) * w + wallX] = SOLID_ROCK;

    // Conta em QUANTOS ticks a acao morreu.
    //
    // Afirmar so "no fim da janela ele nao passou da parede" nao provaria nada:
    // `moveEntity` ja recusa atravessar solido, entao um cavalo que raspasse na
    // pedra pela janela inteira passaria no mesmo teste. O que distingue as duas
    // versoes e a investida ACABAR ANTES do tempo dela.
    const total = HORSE_CHARGE_WINDUP_TICKS + HORSE_CHARGE_TICKS;
    let endedAfter = total;
    for (let t = 1; t <= total; t++) {
      stepRun(state, [emptyCommand()]);
      if (!horse.action) {
        endedAfter = t;
        break;
      }
    }

    expect(endedAfter, 'a investida durou a janela inteira raspando na pedra').toBeLessThan(total);
    expect(endedAfter).toBeGreaterThan(HORSE_CHARGE_WINDUP_TICKS);
    // Parou do lado de la da parede: nao a atravessou nem a arrombou.
    expect(horse.x).toBeGreaterThan(wallX);
    expect(state.solid[Math.floor(horse.y) * w + wallX], 'atropelou a pedra').toBe(SOLID_ROCK);
    // E gastou a investida inteira: o cooldown correu, entao ler o telegrafo
    // comprou tempo de verdade.
    expect(horse.rangedReadyAt).toBeGreaterThan(state.tick);
  });

  // Todos os outros inimigos apontam para o jogador e andam naquela direcao no
  // mesmo tick. Num quadrupede de 2 tiles isso le como sprite sendo arrastado, e
  // nao como corpo correndo.
  it('vira em arco, e nao no lugar', () => {
    const state = createRun({ seed: 54 });
    const horse = spawnHorseFacing(state, 8);
    // Cabeca apontando para o lado OPOSTO ao jogador (que esta em -x).
    horse.facing = { x: 1, y: 0 };
    // Fora da janela de investida: aqui interessa a perseguicao, nao a corrida.
    horse.rangedReadyAt = state.tick + 10_000;

    stepRun(state, [emptyCommand()]);
    const afterOne = horse.facing.x;
    expect(afterOne, 'virou 180 graus num unico tick').toBeGreaterThan(0.5);

    stepIdle(state, 20);
    expect(horse.facing.x, 'nunca completou a curva').toBeLessThan(0);
  });

  it('aparece pela seed, e nao pelo relogio', () => {
    const a = archetypesOf(createRun({ seed: 771, sector: 1 }));
    const b = archetypesOf(createRun({ seed: 771, sector: 1 }));
    expect(a).toEqual(b);
  });

  it('e uma vaga de elite ocupada, e nao um inimigo a mais', () => {
    // Setores com e sem cavalo tem a MESMA contagem de inimigos: o sorteio muda
    // qual e a ameaca de destaque, nunca a densidade da sala.
    const counts = new Set<number>();
    let seenHorse = false;
    let seenNone = false;
    for (let seed = 1; seed <= 60; seed++) {
      const state = createRun({ seed, sector: 1 });
      counts.add(state.enemies.length);
      if (state.enemies.some((e) => e.archetype === 'fungal_horse')) seenHorse = true;
      else seenNone = true;
    }
    expect(seenHorse, 'nenhuma das 60 seeds trouxe cavalo').toBe(true);
    expect(seenNone, 'todas as seeds trouxeram cavalo').toBe(true);
    expect(counts.size, 'a contagem de inimigos variou com o sorteio').toBe(1);
  });

  it('nunca nasce como elite: o fogo dele e a investida, nao o chao sob as patas', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const state = createRun({ seed, sector: 1 });
      for (const e of state.enemies) {
        if (e.archetype === 'fungal_horse') expect(e.elite, `seed ${seed}`).toBe(false);
      }
    }
  });
});

describe('mortes de chefe entram no codex', () => {
  it('derrubar bispo e cavalo marca descoberta e contador', () => {
    const state = createRun({ seed: 61 });
    clearArena(state, 12);
    const bishop = spawnEnemy(state, 'bishop', Math.floor(state.player.x) + 4, Math.floor(state.player.y), false);
    const horse = spawnEnemy(state, 'fungal_horse', Math.floor(state.player.x) + 5, Math.floor(state.player.y), false);
    damageEntity(state, bishop, bishop.maxHp, [], { kind: 'player_shot' });
    damageEntity(state, horse, horse.maxHp, [], { kind: 'player_shot' });

    expect(state.stats.kills.bishop).toBe(1);
    expect(state.stats.kills.fungal_horse).toBe(1);
  });
});
