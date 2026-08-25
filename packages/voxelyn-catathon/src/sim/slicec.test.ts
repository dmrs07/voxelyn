import { describe, expect, it } from 'vitest';
import { HACK_TICKS, LASER_USES, SOCIAL_WINDOW } from './constants.js';
import { CLASSIC_TEAM, catOf, createHackathon, dailySeed, emptyCommand, rollGearOffers, step } from './index.js';
import type { HackState } from './types.js';

/** Slice C: apetrechos, eventos sociais e o premio — provados jogando. */

const mk = (seed: number, gear: Parameters<typeof createHackathon>[2] extends infer O ? (O extends { gear?: infer G } ? G : never) : never = []): HackState =>
  createHackathon(seed, CLASSIC_TEAM, { classic: true, gear });

describe('apetrechos', () => {
  it('a lojinha oferece tres itens distintos, deterministicos por semente', () => {
    const a = rollGearOffers(9);
    const b = rollGearOffers(9);
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
    expect(new Set(a.map((g) => g.id)).size).toBe(3);
  });

  it('catnip sobe a moral na hora e gasta a dose; as doses acabam', () => {
    const state = mk(5, ['catnip']);
    const cat = catOf(state, 'smoking')!;
    cat.moral = 0.3;
    step(state, { catnip: 'smoking' });
    expect(cat.moral).toBeGreaterThan(0.6);
    expect(state.catnipLeft).toBe(1);
    step(state, { catnip: 'smoking' });
    expect(state.catnipLeft).toBe(0);
    const before = catOf(state, 'bigode')!.moral;
    step(state, { catnip: 'bigode' });
    expect(catOf(state, 'bigode')!.moral).toBe(before);
  });

  it('o laser acalma TODOS e interrompe TODOS (zoomies) — trade-off no objeto', () => {
    const state = mk(5, ['laser-pointer']);
    for (const c of state.cats) c.stress = 0.5;
    expect(state.laserLeft).toBe(LASER_USES);
    step(state, { laser: true });
    expect(state.laserLeft).toBe(0);
    for (const c of state.cats) {
      expect(c.stress).toBeLessThan(0.5);
      expect(c.mode).toBe('zoomies');
    }
  });

  it('a almofada termica entra nos modificadores do booth na criacao', () => {
    const plain = mk(5, []);
    const comfy = mk(5, ['almofada-termica']);
    expect(comfy.layoutMods.napRate).toBeGreaterThan(plain.layoutMods.napRate);
  });
});

describe('eventos sociais', () => {
  const toEvent = (state: HackState): void => {
    const ev = state.social[0]!;
    state.tick = ev.at;
    step(state, emptyCommand());
    expect(ev.until).toBeGreaterThan(0);
  };

  it('a janela abre no instante agendado e, ignorada, fecha na opcao SEGURA', () => {
    const state = mk(7);
    toEvent(state);
    const ev = state.social[0]!;
    state.tick = ev.until;
    step(state, emptyCommand());
    expect(ev.resolved).toBe(true);
    expect(ev.taken).toBe('b');
  });

  it('responder A dentro da janela aplica o efeito (workshop: +8% permanente)', () => {
    const state = mk(7);
    // Forca o tipo para o efeito ser verificavel independente da semente.
    state.social[0]!.kind = 'workshop';
    toEvent(state);
    const rested = [...state.cats].sort((x, y) => y.energy - x.energy)[0]!;
    step(state, { social: 'a' });
    expect(state.social[0]!.taken).toBe('a');
    expect(rested.speedBoost).toBeCloseTo(0.08, 5);
  });

  it('a janela tem prazo de verdade', () => {
    const state = mk(7);
    toEvent(state);
    expect(state.social[0]!.until - state.social[0]!.at).toBe(SOCIAL_WINDOW);
  });
});

describe('premio e daily', () => {
  it('o resultado paga por colocacao, e acordos somam', () => {
    const state = mk(2);
    state.prizeBonus = 80;
    state.tick = HACK_TICKS - 1;
    while (state.phase !== 'done') step(state, emptyCommand());
    // Parado do inicio: participacao ou crash — mas o bonus negociado fica.
    expect(state.result!.prize).toBeGreaterThanOrEqual(80);
  });

  it('a semente do dia e a mesma para o mesmo dia, e muda com o dia', () => {
    expect(dailySeed('2026-08-25')).toBe(dailySeed('2026-08-25'));
    expect(dailySeed('2026-08-25')).not.toBe(dailySeed('2026-08-26'));
  });
});

describe('achados de revisao (vigiados para sempre)', () => {
  it('cooldown de palco de TIME GERADO entra no hash', async () => {
    const { hashState, rollCandidates } = await import('./index.js');
    const seed = 314;
    const team = rollCandidates(seed).slice(0, 4);
    const a = createHackathon(seed, team);
    const b = createHackathon(seed, team);
    for (const s of [a, b]) {
      s.tick = HACK_TICKS - 1;
      step(s, emptyCommand());
      expect(s.phase).toBe('pitch');
    }
    // So o cooldown de UM gato gerado difere: o hash tem de acusar.
    b.pitch!.readyAt[team[0]!.id] = 999;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('o toque da raca e mecanica: quem "dorme menos" recupera mais RAPIDO (a soneca encurta)', () => {
    // A direcao ja saiu invertida uma vez (nap 0.85 fazia o Bengal dormir
    // MAIS): nap > 1 = recuperacao mais rapida = levanta antes.
    const perky = mk(5);
    const plain = mk(5);
    for (const s of [perky, plain]) {
      const c = s.cats[0]!;
      c.mode = 'nap';
      c.energy = 0.3;
      c.slot = 'puff';
    }
    perky.cats[0]!.breedMod = { nap: 1.18, stress: 1, hunger: 1, social: 1 };
    step(perky, emptyCommand());
    step(plain, emptyCommand());
    expect(perky.cats[0]!.energy).toBeGreaterThan(plain.cats[0]!.energy);
  });
});
