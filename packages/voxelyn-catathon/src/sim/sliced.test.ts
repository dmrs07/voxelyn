import { describe, expect, it } from 'vitest';
import { runCompetent, runIdle } from './bots.js';
import {
  BUG_COST,
  HACK_TICKS,
  JUNIOR_GROWN_AT,
  PITCH_GAUGE_START,
  PRIZE_JUNIOR_GROWTH,
  PRIZE_SPECIAL,
  RIVAL_PER_SKILL,
  SPONSOR_AUDIT_BUGCOST,
  SPONSOR_BRANDING_GAUGE,
} from './constants.js';
import {
  BREEDS,
  CLASSIC_TEAM,
  SPONSORS,
  catOf,
  createHackathon,
  emptyCommand,
  hashState,
  returningCandidate,
  rivalScoreFor,
  rollCandidates,
  rollSpecialCategory,
  rollSponsorOffer,
  step,
  vibeOf,
} from './index.js';
import type { HackState, SponsorContract } from './types.js';

/**
 * Slice D: convivencia, mentoria, sponsors, categoria especial, rival e o
 * premio com extrato — provados JOGANDO, como tudo na casa. No booth
 * classico, backend+design sao mesas vizinhas (64px) e frontend+devops
 * tambem; os pares cruzados ficam a 308px — fora do raio.
 */

const mk = (seed: number, opts: Parameters<typeof createHackathon>[2] = {}): HackState =>
  createHackathon(seed, CLASSIC_TEAM, { classic: true, ...opts });

const seat = (state: HackState, cat: string, slot: string): void => {
  step(state, { grab: cat });
  step(state, { drop: slot as 'desk-backend' });
  while (catOf(state, cat)!.mode === 'walk') step(state, emptyCommand());
};

const toDone = (state: HackState): void => {
  state.tick = HACK_TICKS - 1;
  while (state.phase !== 'done') step(state, emptyCommand());
};

describe('convivencia (vibe entre gatos)', () => {
  it('o vibe e simetrico, limitado, e le o trait OCULTO desde o inicio', () => {
    const [bigode, cheeto, almofada, smoking] = CLASSIC_TEAM;
    expect(vibeOf(bigode!, cheeto!)).toBe(vibeOf(cheeto!, bigode!));
    // Perfeccionista vs cowboy: atrito. Perfeccionista + julgador: harmonia.
    expect(vibeOf(bigode!, cheeto!)).toBe(-1);
    expect(vibeOf(bigode!, smoking!)).toBe(1);
    expect(vibeOf(almofada!, smoking!)).toBe(1);
    // Trait oculto conta: dois zen escondidos se acalmam sem saber por que.
    const zenA = { personality: 'calmo' as const, traits: [], hiddenTrait: 'zen' };
    const zenB = { personality: 'perfeccionista' as const, traits: ['zen'], hiddenTrait: 'dorme-rapido' };
    expect(vibeOf(zenA, zenB)).toBe(1);
    for (const a of CLASSIC_TEAM) {
      for (const b of CLASSIC_TEAM) {
        if (a === b) continue;
        expect(Math.abs(vibeOf(a, b))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('atrito na mesa vizinha estressa MAIS — e o feed anuncia a dupla UMA vez', () => {
    // Bigode (perfeccionista) na mesa de backend, Cheeto (cowboy) na de
    // design, VIZINHA: atrito. No controle, Cheeto trabalha sozinho.
    const together = mk(31);
    seat(together, 'bigode', 'desk-backend');
    seat(together, 'cheeto', 'desk-design');
    const alone = mk(31);
    seat(alone, 'cheeto', 'desk-design');
    // A preparacao gasta ticks diferentes (dois transportes vs um): zera o
    // relogio de estresse dos DOIS para comparar so a taxa das mesas.
    catOf(together, 'cheeto')!.stress = 0.3;
    catOf(alone, 'cheeto')!.stress = 0.3;
    for (let i = 0; i < 300; i++) {
      step(together, emptyCommand());
      step(alone, emptyCommand());
    }
    expect(catOf(together, 'cheeto')!.stress).toBeGreaterThan(catOf(alone, 'cheeto')!.stress);
    const frictions = together.events.filter((e) => e.kind === 'friction');
    expect(frictions.length).toBe(1);
  });

  it('harmonia na mesa vizinha estressa MENOS', () => {
    // Bigode + Smoking (perfeccionista + julgador): harmonia declarada.
    const together = mk(32);
    seat(together, 'bigode', 'desk-backend');
    seat(together, 'smoking', 'desk-design');
    const alone = mk(32);
    seat(alone, 'smoking', 'desk-design');
    catOf(together, 'smoking')!.stress = 0.3;
    catOf(alone, 'smoking')!.stress = 0.3;
    for (let i = 0; i < 300; i++) {
      step(together, emptyCommand());
      step(alone, emptyCommand());
    }
    expect(catOf(together, 'smoking')!.stress).toBeLessThan(catOf(alone, 'smoking')!.stress);
    expect(together.events.filter((e) => e.kind === 'harmony').length).toBe(1);
  });

  it('o aprendizado do junior entra no hash', () => {
    const a = mk(5);
    const b = mk(5);
    b.cats[0]!.learned = 0.5;
    expect(hashState(a)).not.toBe(hashState(b));
  });
});

describe('mentoria (evolucao do junior)', () => {
  const juniorAtDesk = (seed: number, withMentor: boolean): HackState => {
    const state = mk(seed);
    catOf(state, 'cheeto')!.tier = 'junior';
    if (withMentor) catOf(state, 'almofada')!.tier = 'senior';
    seat(state, 'cheeto', 'desk-frontend');
    // f1 depende de d1: libera o quadro para as mesas terem o que puxar.
    for (const t of state.tasks) (t as { deps: readonly string[] }).deps = [];
    if (withMentor) seat(state, 'almofada', 'desk-devops'); // mesa VIZINHA
    return state;
  };

  it('o junior aprende TRABALHANDO — e mais rapido com um senior na vizinha', () => {
    const mentored = juniorAtDesk(41, true);
    const solo = juniorAtDesk(41, false);
    for (let i = 0; i < 300; i++) {
      step(mentored, emptyCommand());
      step(solo, emptyCommand());
    }
    const m = catOf(mentored, 'cheeto')!.learned;
    const s = catOf(solo, 'cheeto')!.learned;
    expect(s).toBeGreaterThan(0);
    expect(m).toBeGreaterThan(s * 1.4);
    expect(mentored.events.some((e) => e.kind === 'mentor')).toBe(true);
  });

  it('cruzar o limiar anuncia o CRESCIMENTO, e o premio paga por ele', () => {
    const state = juniorAtDesk(43, false);
    catOf(state, 'cheeto')!.learned = JUNIOR_GROWN_AT - 0.001;
    for (let i = 0; i < 30; i++) step(state, emptyCommand());
    expect(state.events.some((e) => e.kind === 'grown' && e.cat === 'cheeto')).toBe(true);

    const done = mk(43);
    catOf(done, 'cheeto')!.tier = 'junior';
    catOf(done, 'cheeto')!.learned = JUNIOR_GROWN_AT + 0.05;
    toDone(done);
    expect(done.result!.juniorsGrown).toBe(1);
    expect(done.result!.prizeParts.juniors).toBe(PRIZE_JUNIOR_GROWTH);
  });

  it('quem cresceu VOLTA como pleno, com desconto de lealdade', () => {
    const alum = { ...CLASSIC_TEAM[1]!, tier: 'junior' as const, cost: 12 };
    const back = returningCandidate(alum);
    expect(back.tier).toBe('pleno');
    expect(back.name).toBe(alum.name);
    expect(back.hiddenTrait).toBe(alum.hiddenTrait);
    expect(back.cost).toBeLessThan(64); // pleno de tabela custa 64
  });
});

describe('sponsors (contrato com objetivo e amarra)', () => {
  const byId = (id: string): SponsorContract => SPONSORS.find((s) => s.id === id)!;

  it('rep 0 = ninguem liga; rep alta = oferta deterministica entre os desbloqueados', () => {
    expect(rollSponsorOffer(7, 0)).toBeNull();
    expect(rollSponsorOffer(7, 9)?.id).toBe(rollSponsorOffer(7, 9)?.id);
    // Rep 1 so desbloqueia a TunaCloud: a oferta e ela, sempre.
    expect(rollSponsorOffer(123, 1)?.id).toBe('tunacloud');
  });

  it("a amarra 'demo-api' poe a API deles no caminho da demo desde a criacao", () => {
    expect(mk(5, { sponsor: byId('tunacloud') }).sponsorRisk).toBe(true);
    expect(mk(5, { sponsor: byId('purrdata') }).sponsorRisk).toBe(false);
  });

  it("a amarra 'audit' encarece cada bug", () => {
    const state = mk(5, { sponsor: byId('purrdata') });
    const cat = catOf(state, 'smoking')!;
    seat(state, 'smoking', 'desk-design');
    step(state, { choose: { task: 'd1', option: 'componentesLocais' } });
    let guard = 0;
    while (!state.bugs.some((b) => b.track === 'design') && guard++ < 9000) {
      cat.stress = Math.max(cat.stress, 0.95);
      cat.hunger = 1;
      cat.energy = 1;
      step(state, emptyCommand());
    }
    const bug = state.bugs.find((b) => b.track === 'design')!;
    expect(bug.cost).toBe(Math.round(BUG_COST * SPONSOR_AUDIT_BUGCOST));
  });

  it("a amarra 'branding' esfria a largada do pitch (o terno de mascote)", () => {
    const suited = mk(5, { sponsor: byId('litterbox-vc') });
    suited.tick = HACK_TICKS - 1;
    step(suited, emptyCommand());
    expect(suited.pitch!.gauge).toBeCloseTo(PITCH_GAUGE_START - SPONSOR_BRANDING_GAUGE, 5);
  });

  it('objetivo cumprido paga o payout; descumprido nao paga nada', () => {
    // PurrData quer zero bugs: uma run limpa (mesmo vazia) cumpre.
    const clean = mk(5, { sponsor: byId('purrdata') });
    toDone(clean);
    expect(clean.result!.sponsorMet).toBe(true);
    expect(clean.result!.prizeParts.sponsor).toBe(byId('purrdata').payout);
    // TunaCloud quer 8 features shipadas: zero shipado nao cumpre.
    const empty = mk(8, { sponsor: byId('tunacloud') });
    toDone(empty);
    expect(empty.result!.sponsorMet).toBe(false);
    expect(empty.result!.prizeParts.sponsor).toBe(0);
    // Sem sponsor: o campo e null e o extrato fica em zero.
    const solo = mk(5);
    toDone(solo);
    expect(solo.result!.sponsorMet).toBeNull();
  });
});

describe('categoria especial e o extrato do premio', () => {
  it('a categoria da edicao e deterministica por semente', () => {
    expect(rollSpecialCategory(9)).toBe(rollSpecialCategory(9));
    const all = new Set(Array.from({ length: 40 }, (_, i) => rollSpecialCategory(i * 977 + 13)));
    expect(all.size).toBeGreaterThan(1);
  });

  it('o trofeu paga quando o predicado fecha — e so entao', () => {
    const won = mk(5);
    won.specialCategory = 'clean-scratch'; // zero bugs E zero pontas soltas
    toDone(won);
    expect(won.result!.specialWon).toBe(true);
    expect(won.result!.prizeParts.special).toBe(PRIZE_SPECIAL);

    const lost = mk(5);
    lost.specialCategory = 'crowd-purr'; // plateia parada esfria: nunca 85%
    toDone(lost);
    expect(lost.result!.specialWon).toBe(false);
    expect(lost.result!.prizeParts.special).toBe(0);
  });

  it('a divida tecnica restante MORDE o cheque (§7 do brief)', () => {
    const clean = mk(5);
    toDone(clean);
    const indebted = mk(5);
    indebted.debt = 3;
    toDone(indebted);
    expect(indebted.result!.prizeParts.debt).toBeLessThan(0);
    expect(indebted.result!.prize).toBeLessThan(clean.result!.prize);
    // E o total nunca fica negativo: o piso da vergonha e zero.
    const broke = mk(5);
    broke.debt = 99;
    toDone(broke);
    expect(broke.result!.prize).toBe(0);
  });

  it('o extrato SOMA o premio: as partes batem com o total', () => {
    const state = mk(7);
    state.prizeBonus = 80;
    toDone(state);
    const p = state.result!.prizeParts;
    const sum = p.placement + p.zeroBugs + p.deals + p.sponsor + p.special + p.juniors + p.debt;
    expect(state.result!.prize).toBe(Math.max(0, sum));
  });
});

describe('achados de revisao do Slice D (vigiados para sempre)', () => {
  it('a FICHA MECANICA do contratado entra no hash: mesmo id, tier diferente, hash diferente', () => {
    // O elenco e ENTRADA do replay: dois payloads com os mesmos ids e
    // fichas diferentes divergem ja no tick zero, nao "muito depois".
    const team = rollCandidates(314).slice(0, 4);
    const twisted = team.map((c, i) =>
      i === 0 ? { ...c, tier: c.tier === 'senior' ? ('pleno' as const) : ('senior' as const) } : c
    );
    const a = createHackathon(314, team);
    const b = createHackathon(314, twisted);
    expect(hashState(a)).not.toBe(hashState(b));
    // O breedMod tambem e ficha: so ele diferente ja diverge.
    const shifted = team.map((c, i) => (i === 1 ? { ...c, breedMod: { ...c.breedMod, nap: c.breedMod.nap + 0.2 } } : c));
    expect(hashState(createHackathon(314, shifted))).not.toBe(hashState(a));
  });

  it('"dorme menos" e direcao de DADOS: o nap do Bengal e maior que 1', () => {
    // A primeira versao dava nap 0.85 ao Bengal — recuperacao mais lenta,
    // soneca mais LONGA: o oposto do anunciado. Direcao agora vigiada.
    for (const name of ['Bengal', 'Savannah', 'Abissinio']) {
      const breed = BREEDS.find((b) => b.name === name)!;
      expect(breed.nudge?.nap ?? 1, name).toBeGreaterThan(1);
    }
  });
});

describe('o rival (os Golden Retrievers do booth ao lado)', () => {
  it('a nota deles e pura: mesma semente e skill, mesma nota; skill soma linear', () => {
    expect(rivalScoreFor(9, 0)).toBe(rivalScoreFor(9, 0));
    expect(rivalScoreFor(9, 1) - rivalScoreFor(9, 0)).toBe(RIVAL_PER_SKILL);
    for (let i = 0; i < 200; i++) {
      const r = rivalScoreFor(i * 977 + 13, 0);
      expect(r).toBeGreaterThanOrEqual(38);
      expect(r).toBeLessThanOrEqual(78);
    }
  });

  it('parado, voce perde ATE para eles; o jogador decente os vence', () => {
    for (const seed of [7, 42, 99]) {
      const idle = mk(seed);
      runIdle(idle);
      expect(idle.result!.score, `seed ${seed}`).toBeLessThan(rivalScoreFor(seed, 0));
    }
    for (const seed of [42, 7, 99, 2026]) {
      const good = mk(seed);
      runCompetent(good);
      expect(good.result!.score, `seed ${seed}: ${good.result!.score}`).toBeGreaterThan(rivalScoreFor(seed, 0));
    }
  });
});
