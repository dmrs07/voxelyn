import { describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { ARCHETYPES, damageEntity, spawnEnemy } from '../src/entities';
import { emptyStats } from '../src/stats';
import { heatFungalCell } from '../src/cells';
import {
  BISHOP_NOVA_WINDUP_TICKS,
  BISHOP_REGEN_PER_TICK,
  BISHOP_RETREAT_HP_FRACTION,
  BISHOP_SECTOR,
  HORSE_CHARGE_TICKS,
  HORSE_CHARGE_WINDUP_TICKS,
  SECTOR_COUNT,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_NONE,
} from '../src/constants';
import type { EnemyArchetype, SemanticEvent, SurvivalState } from '../src/types';

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

describe('Bispo — onde ele mora', () => {
  it('esta no setor 2, e so nele', () => {
    expect(archetypesOf(createRun({ seed: 7, sector: 1 }))).not.toContain('bishop');
    expect(archetypesOf(createRun({ seed: 7, sector: BISHOP_SECTOR }))).toContain('bishop');
    expect(archetypesOf(createRun({ seed: 7, sector: SECTOR_COUNT }))).not.toContain('bishop');
  });

  it('nao divide setor com o Guardiao', () => {
    const final = archetypesOf(createRun({ seed: 11, sector: SECTOR_COUNT }));
    expect(final).toContain('guardian');
    expect(final).not.toContain('bishop');
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

    const distBefore = Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y);
    stepIdle(state, 30);
    expect(Math.hypot(bishop.x - state.player.x, bishop.y - state.player.y)).toBeLessThan(distBefore);
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
