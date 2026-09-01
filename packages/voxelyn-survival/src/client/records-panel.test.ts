// @vitest-environment happy-dom
//
// O Registro, na parte que ganhou gesto novo: o botao de rever a descida.
//
// A regra que estes testes protegem e a mesma do livro do ranking, e ela vale
// dobrado aqui: a maioria destas linhas e MORTE, e morte nao sobe para servidor
// nenhum. O que torna uma linha revisivel e o log neste aparelho — e uma linha
// cujo log ja foi podado (ou foi gravado por outra versao da simulacao) nao
// pode oferecer um botao que nao leva a lugar nenhum.

import { beforeEach, describe, expect, it } from 'vitest';
import type { RunSummary } from '@voxelyn/survival-sim';
import { emptyStats } from '@voxelyn/survival-sim';
import { renderRecordsPanel } from './records-panel';
import { applyRun, emptyRecords, runSummaryIdentity, type Records } from './records';
import { setLocale } from './i18n';

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  seed: 42,
  phase: 'dead',
  ticks: 1200,
  contamination: 0.2,
  deathCause: { kind: 'fire' },
  stats: {
    shotsFired: 3,
    kills: emptyStats().kills,
    damageTakenTenths: 40,
    damageDealtTenths: 10,
    solidsDestroyed: 0,
    salvageCompleted: 0,
    modulesAcquired: 0,
    purgeCellsUsed: 0,
    timesDowned: 0,
    revivesGiven: 0,
    discoveries: 0,
    oreCollected: 0,
    innocentsKilled: 0,
  },
  cores: 0,
  coresAvailable: 1,
  sectorCount: 3,
  stars: 0,
  targetTicks: 14400,
  ...over,
});

/** O painel abre no RESUMO; estes testes falam da aba do historico. */
const openHistory = (host: HTMLElement): void => {
  const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('.ax-tabs .ax-tab'));
  tabs[tabs.length - 1].click();
};

let host: HTMLElement;
let records: Records;
const morte = summary();
const identity = runSummaryIdentity(morte);

beforeEach(() => {
  setLocale('pt-BR');
  host = document.createElement('div');
  records = applyRun(emptyRecords(), morte);
});

describe('botao de rever a descida', () => {
  it('nao aparece sem log guardado, mesmo com onWatchReplay', () => {
    renderRecordsPanel(host, records, undefined, undefined, {
      replayable: new Set(),
      onWatchReplay: () => {},
    });
    openHistory(host);
    expect(host.querySelector('.ax-replay-btn')).toBeNull();
  });

  it('nao aparece sem onWatchReplay, mesmo com log guardado', () => {
    renderRecordsPanel(host, records, undefined, undefined, {
      replayable: new Set([identity]),
    });
    openHistory(host);
    expect(host.querySelector('.ax-replay-btn')).toBeNull();
  });

  it('aparece com as duas condicoes, e o clique leva a propria descida', () => {
    const watched: string[] = [];
    renderRecordsPanel(host, records, undefined, undefined, {
      replayable: new Set([identity]),
      onWatchReplay: (run) => watched.push(runSummaryIdentity(run)),
    });
    openHistory(host);
    const btn = host.querySelector<HTMLButtonElement>('.ax-replay-btn');
    expect(btn).not.toBeNull();
    btn?.click();
    expect(watched).toEqual([identity]);
  });

  // O Registro guarda ate 20 descidas e mostra 8; os logs guardados sao menos
  // ainda. Cada linha responde pelo PROPRIO log, e nao pelo da vizinha.
  it('so a linha com log ganha o botao', () => {
    const outra = summary({ seed: 7, ticks: 900 });
    const comDuas = applyRun(records, outra);
    renderRecordsPanel(host, comDuas, undefined, undefined, {
      replayable: new Set([runSummaryIdentity(outra)]),
      onWatchReplay: () => {},
    });
    openHistory(host);
    const rows = Array.from(host.querySelectorAll('.ax-ledger-row'));
    const comBotao = rows.filter((row) => row.querySelector('.ax-replay-btn'));
    expect(rows.length).toBe(2);
    expect(comBotao).toHaveLength(1);
    // A mais nova primeiro: `outra` foi aplicada por ultimo.
    expect(rows[0].querySelector('.ax-replay-btn')).not.toBeNull();
  });
});
