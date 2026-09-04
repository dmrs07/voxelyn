// @vitest-environment happy-dom
// O QUE A ARENA REPORTA sobre a luta que acabou de acontecer.
//
// Este arquivo existe por causa de um defeito de agregacao, que e a pior
// especie de defeito de telemetria: nada quebra, nada avisa, e os numeros
// mentem meses depois, na planilha de quem esta decidindo balanco.
//
// O `tuningHash` era reconstruido aqui a partir de `DEFAULT_PLAYER_TUNING` mais
// o HP escolhido. Funcionava enquanto o HP fosse a unica condicao da tela de
// setup que tocava o tuning — e deixou de ser no instante em que os
// Estabilizadores Giroscopicos (MV-04) entraram como controle. As duas lutas
// que aquele controle existe para COMPARAR passaram a cair no mesmo digest.
//
// A correcao e hashear o tuning que a simulacao de fato congelou
// (`state.config.tuning`), e o que este teste protege e a propriedade, nao a
// linha: duas configuracoes de movimento diferentes tem de produzir baldes
// diferentes, qualquer que seja a condicao que as separe.
//
// Em happy-dom (e nao no `node` padrao da suite) porque o caminho de envio le
// `localStorage` para o opt-out e `location` para resolver o servidor — e o
// opt-out e uma das quatro propriedades que este arquivo tem de provar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPlayerTuning } from '@voxelyn/survival-sim';
import { reportArenaOutcome } from '../client/arena-telemetry-client';
import { createArenaRun, type ArenaConditions } from '../client/arena-setup';

type ArenaEvent = {
  boss: string;
  startingHp: number;
  tuningHash: string;
  outcome: string;
};

const conditions = (stabilisers: boolean): ArenaConditions => ({
  boss: 'frost_queen',
  maxHp: 200,
  ability: 'pulse',
  modules: [],
  stabilisers,
});

describe('reportArenaOutcome', () => {
  let sent: ArenaEvent[];

  beforeEach(() => {
    sent = [];
    localStorage.clear();
    vi.stubGlobal('fetch', (_url: string, init?: { body?: string }) => {
      sent.push(JSON.parse(init?.body ?? '{}').event);
      return Promise.resolve({ ok: true } as Response);
    });
    // `sendBeacon` ausente força o caminho de `fetch`, que é o que o teste lê.
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const report = (stabilisers: boolean): ArenaEvent => {
    const c = conditions(stabilisers);
    reportArenaOutcome(c, 'defeat', createArenaRun(c));
    return sent[sent.length - 1];
  };

  it('separa a luta COM e SEM os Estabilizadores em baldes diferentes', () => {
    const plain = report(false);
    const stabilised = report(true);
    expect(plain.tuningHash).not.toBe(stabilised.tuningHash);
  });

  it('reporta o tuning que a simulacao congelou, e nao um reconstruido', () => {
    for (const stabilisers of [false, true]) {
      const c = conditions(stabilisers);
      const state = createArenaRun(c);
      sent = [];
      reportArenaOutcome(c, 'defeat', state);
      expect(sent[0].tuningHash, `stabilisers=${stabilisers}`).toBe(
        hashPlayerTuning(state.config.tuning),
      );
    }
  });

  it('continua distinguindo o HP escolhido', () => {
    // A propriedade que o codigo antigo ja tinha, e que a correcao nao pode
    // perder: dois HPs diferentes continuam sendo duas configuracoes.
    const low = conditions(false);
    const high = { ...conditions(false), maxHp: 400 };
    reportArenaOutcome(low, 'defeat', createArenaRun(low));
    reportArenaOutcome(high, 'defeat', createArenaRun(high));
    expect(sent[0].tuningHash).not.toBe(sent[1].tuningHash);
    expect(sent[0].startingHp).toBe(200);
    expect(sent[1].startingHp).toBe(400);
  });

  it('respeita o opt-out da campanha: nada sai', () => {
    localStorage.setItem('voxelyn.telemetry.optout', '1');
    const c = conditions(true);
    reportArenaOutcome(c, 'defeat', createArenaRun(c));
    expect(sent).toHaveLength(0);
  });
});
