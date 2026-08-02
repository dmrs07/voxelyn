// A armadilha de carrinho: trilhos da operacao, telegrafo e o atropelo.
//
// O que estes testes cobram:
// 1. GEOGRAFIA: so a operacao (Aurix/ferrifero) deixa trilhos; o estrato
//    intocado nao tem nenhum. Os tramos sao retos e moram na superficie
//    autoritativa (SURF_RAIL/SURF_RAIL_V) — entram no hash com o chao.
// 2. TELEGRAFO: pisar num tramo armado anuncia (cart_warning) ANTES de o
//    carrinho existir — morte sempre anunciada.
// 3. FISICA: o carrinho vem do lado LONGE, machuca quem ficar na linha,
//    atropela inimigo tambem, e o tramo descansa depois do disparo.
import { describe, expect, it } from 'vitest';
import {
  CART_COOLDOWN_TICKS,
  CART_WINDUP_TICKS,
  SURF_RAIL,
  SURF_RAIL_V,
} from '../src/constants';
import { createRun, emptyCommand, stepRun } from '../src/run';
import { lineageOf } from '../src/strata';
import type { RailTrack, SemanticEvent, SurvivalState } from '../src/types';

const seedIndustrial = (() => {
  for (let s = 1; s < 4096; s++) {
    if (lineageOf(s) === 'industrial') return s;
  }
  throw new Error('nenhuma seed industrial');
})();

/** Poe o jogador de pe sobre a celula `k` do tramo. */
const standOnTrack = (state: SurvivalState, track: RailTrack, k: number): void => {
  state.player.x = track.x + track.dx * k + 0.5;
  state.player.y = track.y + track.dy * k + 0.5;
};

const stepIdle = (state: SurvivalState): SemanticEvent[] => stepRun(state, [emptyCommand()]).events;

describe('armadilha de carrinho', () => {
  it('so a operacao deixa trilhos — e eles moram na superficie autoritativa', () => {
    const ferric = createRun({ seed: seedIndustrial, sector: 2 });
    expect(ferric.stratum).toBe('ferric');
    expect(ferric.railTracks.length).toBeGreaterThan(0);
    for (const track of ferric.railTracks) {
      const surf = track.dx === 1 ? SURF_RAIL : SURF_RAIL_V;
      for (let k = 0; k < track.len; k++) {
        const i = (track.y + track.dy * k) * ferric.config.width + (track.x + track.dx * k);
        expect(ferric.surface[i]).toBe(surf);
      }
    }
    // O basalto intocado do setor 1 nao tem um unico dormente.
    const basalt = createRun({ seed: 1 });
    expect(basalt.railTracks.length).toBe(0);
    expect([...basalt.surface].some((s) => s === SURF_RAIL || s === SURF_RAIL_V)).toBe(false);
  });

  it('pisar no tramo anuncia, o carrinho vem do lado LONGE e cobra de quem ficar', () => {
    const state = createRun({ seed: seedIndustrial, sector: 2 });
    const track = state.railTracks[0];
    // Cena controlada: sem fauna — o unico dano possivel e o carrinho.
    state.enemies = [];
    standOnTrack(state, track, 1);

    const events = stepIdle(state);
    const warning = events.find((ev) => ev.t === 'cart_warning');
    expect(warning).toBeDefined();
    // Pisou perto da origem: o carrinho parte da OUTRA ponta — e o disparo
    // fica agendado no futuro (o aviso vem ANTES do perigo).
    expect(track.fromEnd).toBe(1);
    expect(track.firingAt).toBeGreaterThan(state.tick);

    const hpBefore = state.player.hp;
    // Fica parado na linha ate o carrinho passar (aviso + travessia).
    for (let t = 0; t < CART_WINDUP_TICKS + track.len * 3 && state.player.hp === hpBefore; t++) {
      standOnTrack(state, track, 1);
      stepIdle(state);
    }
    expect(state.player.hp).toBeLessThan(hpBefore);
    // O tramo descansa: nada de metralhadora.
    expect(state.railTracks[0].readyAt).toBeGreaterThan(state.tick);
    expect(state.railTracks[0].readyAt - state.tick).toBeLessThanOrEqual(CART_COOLDOWN_TICKS);
  });

  it('quem sai da linha durante o aviso nao paga nada', () => {
    const state = createRun({ seed: seedIndustrial, sector: 2 });
    const track = state.railTracks[0];
    state.enemies = [];
    standOnTrack(state, track, 1);
    stepIdle(state); // arma o telegrafo
    // Sai da linha: uma celula PERPENDICULAR ao tramo.
    state.player.x = track.x + track.dy * 2 + 0.5;
    state.player.y = track.y + track.dx * 2 + 0.5;
    const hpBefore = state.player.hp;
    const offX = state.player.x;
    const offY = state.player.y;
    for (let t = 0; t < CART_WINDUP_TICKS + track.len * 3; t++) {
      state.player.x = offX;
      state.player.y = offY;
      stepIdle(state);
    }
    expect(state.player.hp).toBe(hpBefore);
  });

  it('fisica nao escolhe lado: o carrinho atropela inimigo na linha', () => {
    const state = createRun({ seed: seedIndustrial, sector: 2 });
    const track = state.railTracks[0];
    // Um unico bicho, plantado no MEIO da linha; o jogador arma da ponta.
    const victim = state.enemies[0];
    expect(victim).toBeDefined();
    state.enemies = [victim];
    const mid = Math.floor(track.len / 2);
    victim.x = track.x + track.dx * mid + 0.5;
    victim.y = track.y + track.dy * mid + 0.5;
    victim.stunnedUntil = state.tick + 10_000; // parado: nao foge da cena
    standOnTrack(state, track, 1);
    stepIdle(state);
    const hpBefore = victim.hp;
    for (let t = 0; t < CART_WINDUP_TICKS + track.len * 3 && victim.hp === hpBefore; t++) {
      victim.x = track.x + track.dx * mid + 0.5;
      victim.y = track.y + track.dy * mid + 0.5;
      // O jogador sai da frente: so o bicho fica na linha.
      state.player.x = track.x + track.dy * 3 + 0.5;
      state.player.y = track.y + track.dx * 3 + 0.5;
      stepIdle(state);
    }
    expect(victim.hp).toBeLessThan(hpBefore);
  });
});
