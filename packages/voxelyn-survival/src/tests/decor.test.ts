// A camada de props decorativos: derivada, deterministica e fora do jogo.
//
// O que estes testes cobram:
// 1. DERIVACAO: mesma seed => mesma decoracao, em qualquer maquina — e a
//    colocacao nao consome a RNG autoritativa (o hash da simulacao nao muda).
// 2. ZONAS PROIBIDAS: nada de prop no raio da entrada, do poco, dos terminais
//    e cofres, dos respiradouros nem da posicao de chefe.
// 3. HONESTIDADE: prop de chao so em celula aberta e sem materia reativa; o
//    micelio so cresce sobre o proprio tapete; prop de borda tem parede viva.
import { describe, expect, it } from 'vitest';
import { createRun, hashAuthoritativeState, sectorBiome, SOLID_NONE, SURF_FUNGAL } from '@voxelyn/survival-sim';
import { placeDecor, propStillValid } from '../client/decor';

describe('decoracao derivada', () => {
  it('mesma seed, mesma lista — e nada da RNG autoritativa e consumido', () => {
    const a = createRun({ seed: 77 });
    const hashBefore = hashAuthoritativeState(a);
    const decorA = placeDecor(a);
    expect(hashAuthoritativeState(a)).toBe(hashBefore);

    const b = createRun({ seed: 77 });
    expect(placeDecor(b)).toEqual(decorA);
  });

  it('cliente que entra numa sala em andamento ve o MESMO cenario', () => {
    // A colocacao deriva do mundo pristino do setor, nao do snapshot que
    // chegou: um estado ja mutilado (paredes arrancadas, fungo queimado) nao
    // pode deslocar a amostragem e divergir a decoracao entre os clientes.
    const fresh = createRun({ seed: 77 });
    const decorFresh = placeDecor(fresh);

    const midRun = createRun({ seed: 77 });
    for (let i = 0; i < midRun.solid.length; i += 7) midRun.solid[i] = SOLID_NONE;
    for (let i = 0; i < midRun.surface.length; i += 5) midRun.surface[i] = 0;
    expect(placeDecor(midRun)).toEqual(decorFresh);
  });

  it('respeita todas as zonas proibidas do setor', () => {
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed, sector: 2 });
      const decor = placeDecor(state);
      expect(decor.length).toBeGreaterThan(10);
      for (const prop of decor) {
        const dEntry = Math.hypot(prop.x - state.entry.x, prop.y - state.entry.y);
        const dCore = Math.hypot(prop.x - state.corePos.x, prop.y - state.corePos.y);
        expect(dEntry, `seed ${seed}: prop na entrada`).toBeGreaterThan(5);
        expect(dCore, `seed ${seed}: prop no poco`).toBeGreaterThan(5);
        for (const site of state.salvageSites) {
          expect(Math.hypot(prop.x - site.terminal.x, prop.y - site.terminal.y)).toBeGreaterThan(3);
          expect(Math.hypot(prop.x - site.cache.x, prop.y - site.cache.y)).toBeGreaterThan(3);
        }
        for (const boss of state.enemies) {
          if (boss.archetype !== 'bishop' && boss.archetype !== 'guardian') continue;
          expect(Math.hypot(prop.x - boss.x, prop.y - boss.y)).toBeGreaterThan(7);
        }
      }
    }
  });

  it('todo prop nasce valido: chao aberto, ancora viva, sem materia por baixo', () => {
    for (const seed of [3, 42, 1337]) {
      const state = createRun({ seed });
      for (const prop of placeDecor(state)) {
        expect(propStillValid(state, prop), `seed ${seed} ${prop.kind}`).toBe(true);
        expect(state.solid[prop.y * state.config.width + prop.x]).toBe(SOLID_NONE);
        if (prop.anchor === 'wall_base') {
          expect(state.solid[prop.wallCell]).not.toBe(SOLID_NONE);
        }
      }
    }
  });

  it('o prop some quando o mundo muda por baixo dele', () => {
    const state = createRun({ seed: 42 });
    const decor = placeDecor(state);
    const wallProp = decor.find((p) => p.anchor === 'wall_base' && p.kind !== 'crate' && p.kind !== 'strut');
    expect(wallProp).toBeDefined();
    if (!wallProp) return;
    // O Bruiser arranca a parede que formava a cascata/leque: sem parede, sem
    // formacao — o prop deixa de desenhar em vez de flutuar.
    state.solid[wallProp.wallCell] = SOLID_NONE;
    expect(propStillValid(state, wallProp)).toBe(false);
  });

  it('cogumelos so crescem sobre o tapete fungico', () => {
    // A derivacao PURA acha a seed micelial sem construir mundo nenhum;
    // createRun (caro) roda uma unica vez, na seed certa.
    const seed = (() => {
      for (let s = 1; s < 4096; s++) {
        if (sectorBiome(s, 3).occupation === 'mycelial') return s;
      }
      throw new Error('nenhuma seed micelial encontrada');
    })();
    const state = createRun({ seed, sector: 3 });
    const decor = placeDecor(state);
    const shrooms = decor.filter((p) => p.kind === 'mushroom' || p.kind === 'puffball');
    for (const prop of shrooms) {
      expect(state.surface[prop.y * state.config.width + prop.x]).toBe(SURF_FUNGAL);
    }
  });
});
