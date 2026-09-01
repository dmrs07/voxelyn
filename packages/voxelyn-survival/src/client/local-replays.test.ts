// @vitest-environment happy-dom
//
// O guarda-logs local, na parte que falha em silencio se ninguem olhar:
//
//   1. a cota do `localStorage` e COMPARTILHADA com records, opcoes e cache de
//      progressao. Um replay que se recusa a ser podado derruba o resto junto,
//      e o sintoma aparece longe daqui — no dia em que o historico parar de
//      salvar;
//   2. um log de outra `SIMULATION_VERSION` nao quebra nada: ele conta uma
//      descida DIFERENTE. Sem a recusa por versao, a tela chamaria isso de
//      replay da sua morte.

import { beforeEach, describe, expect, it } from 'vitest';
import { SIMULATION_VERSION } from '@voxelyn/survival-protocol';
import {
  MAX_LOCAL_REPLAYS,
  findLocalReplay,
  loadLocalReplays,
  replayableIdentities,
  saveLocalReplay,
  writeWithBudget,
  type LocalReplay,
} from './local-replays';

const save = (identity: string, over: { log?: string; simulationVersion?: number } = {}) =>
  saveLocalReplay({ identity, seed: 42, log: over.log ?? 'QQ==', ...over });

const replay = (identity: string): LocalReplay => ({
  identity,
  seed: 42,
  log: 'QQ==',
  simulationVersion: SIMULATION_VERSION,
  savedAt: 0,
});

beforeEach(() => {
  localStorage.clear();
});

describe('guardar e achar', () => {
  it('guarda o log da descida e o devolve por identidade', () => {
    save('42:dead:1200');
    const found = findLocalReplay('42:dead:1200');
    expect(found?.seed).toBe(42);
    expect(found?.log).toBe('QQ==');
  });

  it('identidade que nunca foi guardada nao acha nada', () => {
    save('42:dead:1200');
    expect(findLocalReplay('7:extracted:900')).toBeNull();
  });

  // A fase terminal persiste e o laco continua desenhando: `recordRun` pode
  // chegar aqui mais de uma vez com a MESMA run.
  it('regravar a mesma run atualiza no lugar, sem duplicar', () => {
    save('42:dead:1200', { log: 'QQ==' });
    save('42:dead:1200', { log: 'Qg==' });
    const all = loadLocalReplays();
    expect(all).toHaveLength(1);
    expect(all[0].log).toBe('Qg==');
  });

  it('a mais nova fica na frente', () => {
    save('1:dead:10');
    save('2:dead:20');
    expect(loadLocalReplays().map((run) => run.identity)).toEqual(['2:dead:20', '1:dead:10']);
  });
});

describe('versao da simulacao', () => {
  /**
   * A mesma regra do servidor (`leaderboard.ts`), e pelo mesmo motivo: um log
   * so significa alguma coisa contra a simulacao que o produziu.
   */
  it('log de outra versao nao e achado nem oferecido', () => {
    save('42:dead:1200', { simulationVersion: SIMULATION_VERSION - 1 });
    expect(findLocalReplay('42:dead:1200')).toBeNull();
    expect(replayableIdentities().has('42:dead:1200')).toBe(false);
    // Continua GUARDADO: quem decide descartar e a poda, nao a versao — e um
    // rollback de deploy devolve o replay em vez de o ter apagado.
    expect(loadLocalReplays()).toHaveLength(1);
  });

  it('log da versao corrente e oferecido', () => {
    save('42:dead:1200');
    expect(replayableIdentities().has('42:dead:1200')).toBe(true);
  });
});

describe('poda', () => {
  it('guarda no maximo o teto de descidas, descartando a mais velha', () => {
    for (let i = 0; i < MAX_LOCAL_REPLAYS + 3; i++) save(`${i}:dead:${i}`);
    const all = loadLocalReplays();
    expect(all).toHaveLength(MAX_LOCAL_REPLAYS);
    // A mais nova sobrevive; a primeira de todas ja saiu.
    expect(all[0].identity).toBe(`${MAX_LOCAL_REPLAYS + 2}:dead:${MAX_LOCAL_REPLAYS + 2}`);
    expect(all.some((run) => run.identity === '0:dead:0')).toBe(false);
  });

  /**
   * Cota estourada NAO pode derrubar a tela de resultado.
   *
   * Testado na politica (`writeWithBudget`) e nao no `localStorage`: o storage
   * do ambiente de teste nao recusa escrita, e o cenario que importa e
   * exatamente o de um que recusa. Ver o cabecalho da funcao.
   */
  it('cede espaco enquanto o escritor recusar, sacrificando a mais velha', () => {
    const aceitaAte = (limite: number) => (runs: LocalReplay[]) => {
      if (runs.length > limite) throw new Error('cota');
    };
    const runs = [replay('3:dead:30'), replay('2:dead:20'), replay('1:dead:10')];

    expect(writeWithBudget(runs, aceitaAte(3))?.map((r) => r.identity)).toEqual([
      '3:dead:30',
      '2:dead:20',
      '1:dead:10',
    ]);
    // Coube so uma: a que acabou de ser jogada e a que fica.
    expect(writeWithBudget(runs, aceitaAte(1))?.map((r) => r.identity)).toEqual(['3:dead:30']);
  });

  it('nem a run nova cabendo, avisa em vez de lancar', () => {
    const recusaTudo = () => {
      throw new Error('cota');
    };
    expect(writeWithBudget([replay('3:dead:30')], recusaTudo)).toBeNull();
  });

  it('a gravacao real sobrevive a um escritor que recusa tudo', () => {
    save('1:dead:10');
    // Sem storage nenhum disponivel a chamada ainda assim nao pode explodir na
    // cara de quem acabou de morrer.
    expect(() => save('2:dead:20')).not.toThrow();
  });
});

describe('storage hostil', () => {
  it('JSON corrompido le como vazio em vez de quebrar o painel', () => {
    localStorage.setItem('voxelyn.replays', '{{{ nao e json');
    expect(loadLocalReplays()).toEqual([]);
    expect(replayableIdentities().size).toBe(0);
  });

  it('schema desconhecido e descartado, nunca migrado', () => {
    localStorage.setItem(
      'voxelyn.replays',
      JSON.stringify({ schema: 99, runs: [{ identity: 'x', seed: 1, log: 'a' }] }),
    );
    expect(loadLocalReplays()).toEqual([]);
  });

  it('entrada torta no meio da lista e ignorada, e o resto sobrevive', () => {
    save('42:dead:1200');
    const raw = JSON.parse(localStorage.getItem('voxelyn.replays')!) as {
      schema: number;
      runs: unknown[];
    };
    raw.runs.push({ identity: 'sem log' });
    localStorage.setItem('voxelyn.replays', JSON.stringify(raw));
    expect(loadLocalReplays().map((run) => run.identity)).toEqual(['42:dead:1200']);
  });
});
