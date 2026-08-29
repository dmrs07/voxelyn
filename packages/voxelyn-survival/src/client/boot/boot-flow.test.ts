import { describe, expect, it } from 'vitest';
import {
  BOOT_SEQUENCE,
  BOOT_TIMING_FULL,
  BOOT_TIMING_REDUCED,
  BOOT_TIMING_SKIPPED,
  IDENTITY_MAX_MS,
  advanceBoot,
  bootTiming,
  handoffTotalMs,
  identityOpacity,
  identityTotalMs,
  initialBootState,
  type BootPhase,
  type BootState,
  type BootTiming,
} from './boot-flow';

/**
 * Roda a maquina como o navegador roda: empurrando o relogio em passos, com o
 * preload liquidando num instante escolhido pelo teste. Devolve a SEQUENCIA de
 * fases visitadas — e a sequencia, e nao o estado final, que esta feature
 * promete.
 */
const play = (opts: {
  timing: BootTiming;
  /** Instante (ms desde o inicio) em que o preload liquida. */
  settleAtMs: number;
  criticalFailed?: boolean;
  untilMs?: number;
  stepMs?: number;
}): { phases: BootPhase[]; final: BootState } => {
  const step = opts.stepMs ?? 10;
  const until = opts.untilMs ?? 8000;
  let state = initialBootState(0, opts.timing);
  const phases: BootPhase[] = [state.phase];
  let settled = false;
  for (let now = 0; now <= until; now += step) {
    if (!settled && now >= opts.settleAtMs) {
      settled = true;
      state = advanceBoot(state, {
        type: 'preload-settled',
        nowMs: now,
        criticalFailed: opts.criticalFailed ?? false,
      });
    } else {
      state = advanceBoot(state, { type: 'tick', nowMs: now });
    }
    if (state.phase !== phases[phases.length - 1]) phases.push(state.phase);
  }
  return { phases, final: state };
};

describe('sequencia da abertura', () => {
  it('visita identidade, carregamento e menu, nessa ordem', () => {
    const { phases, final } = play({ timing: BOOT_TIMING_FULL, settleAtMs: 300 });
    expect(phases).toEqual([...BOOT_SEQUENCE]);
    expect(final.phase).toBe('menu');
  });

  it('nao encurta a identidade quando o preload liquida na hora (boot em cache)', () => {
    // O cenario do PWA reaberto: tudo em cache, preload liquida em 0 ms. A
    // identidade PRECISA durar o mesmo tanto — e a promessa de apresentacao.
    const { phases } = play({ timing: BOOT_TIMING_FULL, settleAtMs: 0 });
    expect(phases).toEqual([...BOOT_SEQUENCE]);

    let state = initialBootState(0, BOOT_TIMING_FULL);
    state = advanceBoot(state, { type: 'preload-settled', nowMs: 0, criticalFailed: false });
    expect(state.phase).toBe('identity');
    // Um milissegundo antes do fim da identidade, ainda identidade.
    state = advanceBoot(state, { type: 'tick', nowMs: identityTotalMs(BOOT_TIMING_FULL) - 1 });
    expect(state.phase).toBe('identity');
    state = advanceBoot(state, { type: 'tick', nowMs: identityTotalMs(BOOT_TIMING_FULL) });
    expect(state.phase).toBe('loading');
  });

  it('nao entrega o menu enquanto o preload esta no ar, por mais tempo que passe', () => {
    // A corrida ao contrario: relogio rapido, preload eterno. Sem o `handoff`
    // exigindo as duas condicoes, o menu apareceria com os atlas pela metade.
    let state = initialBootState(0, BOOT_TIMING_FULL);
    for (let now = 0; now <= 60_000; now += 100) {
      state = advanceBoot(state, { type: 'tick', nowMs: now });
    }
    expect(state.phase).toBe('loading');
  });

  it('cobra o piso da tela de carregamento (anti-flash)', () => {
    const timing = BOOT_TIMING_FULL;
    let state = initialBootState(0, timing);
    state = advanceBoot(state, { type: 'tick', nowMs: identityTotalMs(timing) });
    expect(state.phase).toBe('loading');
    const enteredAt = state.phaseStartedMs;
    // Liquidou imediatamente: ainda assim a tela fica o minimo visual.
    state = advanceBoot(state, {
      type: 'preload-settled',
      nowMs: enteredAt,
      criticalFailed: false,
    });
    expect(state.phase).toBe('loading');
    state = advanceBoot(state, { type: 'tick', nowMs: enteredAt + timing.loadingMinMs - 1 });
    expect(state.phase).toBe('loading');
    state = advanceBoot(state, { type: 'tick', nowMs: enteredAt + timing.loadingMinMs });
    expect(state.phase).toBe('handoff');
  });

  it('a ordem nao depende de quem chega primeiro', () => {
    // Cinco instantes de liquidacao muito diferentes — antes da identidade
    // acabar, no meio, depois — produzem exatamente a mesma sequencia.
    for (const settleAtMs of [0, 200, 1500, 1860, 3000, 5000]) {
      const { phases } = play({ timing: BOOT_TIMING_FULL, settleAtMs, untilMs: 12_000 });
      expect(phases, `liquidacao em ${settleAtMs}ms`).toEqual([...BOOT_SEQUENCE]);
    }
  });
});

describe('a curva da marca', () => {
  const t = BOOT_TIMING_FULL;

  it('nasce no preto, fica cheia e volta ao preto DENTRO da propria fase', () => {
    expect(identityOpacity(t, 0)).toBe(0);
    expect(identityOpacity(t, t.identityFadeInMs / 2)).toBeCloseTo(0.5);
    expect(identityOpacity(t, t.identityFadeInMs)).toBe(1);
    expect(identityOpacity(t, t.identityFadeInMs + t.identityHoldMs)).toBe(1);
    // O ponto que a primeira captura denunciou: no fim da fase a marca ja
    // esta em zero, e nao comecando a sair por cima da tela seguinte.
    expect(identityOpacity(t, identityTotalMs(t))).toBe(0);
    expect(identityOpacity(t, identityTotalMs(t) + 500)).toBe(0);
  });

  it('e monotona: sobe, mantem, desce — nunca oscila', () => {
    const total = identityTotalMs(t);
    let rising = true;
    let previous = identityOpacity(t, 0);
    for (let ms = 0; ms <= total; ms += 10) {
      const value = identityOpacity(t, ms);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      if (rising && value < previous) rising = false;
      if (!rising) expect(value).toBeLessThanOrEqual(previous + 1e-9);
      previous = value;
    }
    expect(previous).toBe(0);
  });

  it('sem fade (movimento reduzido) a marca e um corte seco', () => {
    const r = BOOT_TIMING_REDUCED;
    expect(identityOpacity(r, 0)).toBe(1);
    expect(identityOpacity(r, r.identityHoldMs - 1)).toBe(1);
    expect(identityOpacity(r, identityTotalMs(r))).toBe(0);
  });
});

describe('a virgula sonora estica a identidade', () => {
  const t = BOOT_TIMING_FULL;

  it('a marca fica ate o som acabar, e a saida dela cabe depois disso', () => {
    let state = initialBootState(0, t);
    // A peca comecou em 300ms e dura 2600ms: termina em 2900ms.
    state = advanceBoot(state, { type: 'identity-hold-until', nowMs: 300, untilMs: 2900 });
    // A fase inteira tem de cobrir o som E o fade de saida — o ultimo acorde
    // nao pode ser cortado pela troca de tela.
    expect(identityTotalMs(state.timing)).toBe(2900 + t.identityFadeOutMs);
    state = advanceBoot(state, { type: 'tick', nowMs: 2899 });
    expect(state.phase).toBe('identity');
    state = advanceBoot(state, { type: 'tick', nowMs: identityTotalMs(state.timing) });
    expect(state.phase).toBe('loading');
  });

  it('NUNCA encurta: um som mais curto que a leitura da marca nao rouba tela', () => {
    let state = initialBootState(0, t);
    const antes = identityTotalMs(state.timing);
    state = advanceBoot(state, { type: 'identity-hold-until', nowMs: 0, untilMs: 400 });
    expect(identityTotalMs(state.timing)).toBe(antes);
  });

  it('tem teto: uma duracao absurda nao prende o jogador', () => {
    let state = initialBootState(0, t);
    state = advanceBoot(state, { type: 'identity-hold-until', nowMs: 0, untilMs: 999_999 });
    expect(identityTotalMs(state.timing)).toBe(IDENTITY_MAX_MS);
    // E o teto ainda deixa a assinatura completa de 3,5 s caber.
    expect(IDENTITY_MAX_MS).toBeGreaterThan(3502 + t.identityFadeOutMs);
  });

  it('um som que chega tarde nao traz a marca de volta', () => {
    let state = initialBootState(0, t);
    state = advanceBoot(state, { type: 'tick', nowMs: identityTotalMs(t) });
    expect(state.phase).toBe('loading');
    const antes = state;
    state = advanceBoot(state, { type: 'identity-hold-until', nowMs: 2000, untilMs: 6000 });
    expect(state).toBe(antes);
  });

  it('a curva da marca acompanha o tempo esticado', () => {
    let state = initialBootState(0, t);
    state = advanceBoot(state, { type: 'identity-hold-until', nowMs: 300, untilMs: 2900 });
    // Cheia durante o som inteiro, e zerada quando a fase acaba.
    expect(identityOpacity(state.timing, 1500)).toBe(1);
    expect(identityOpacity(state.timing, 2900)).toBe(1);
    expect(identityOpacity(state.timing, identityTotalMs(state.timing))).toBe(0);
  });

  it('sem som, a identidade continua abaixo de dois segundos', () => {
    // A garantia antiga, agora explicitamente condicionada ao caso mudo: quem
    // abre o jogo pela decima vez com o audio bloqueado nao paga por isso.
    expect(identityTotalMs(BOOT_TIMING_FULL)).toBeLessThan(2000);
  });
});

describe('falha critica', () => {
  it('para em `failed` e NUNCA entra no menu sozinho', () => {
    const { phases, final } = play({
      timing: BOOT_TIMING_FULL,
      settleAtMs: 100,
      criticalFailed: true,
      untilMs: 30_000,
    });
    expect(phases).toEqual(['identity', 'loading', 'failed']);
    expect(final.phase).toBe('failed');
    expect(phases).not.toContain('menu');
  });

  it('a nova tentativa volta ao carregamento — nunca a identidade', () => {
    let state: BootState = initialBootState(0, BOOT_TIMING_FULL);
    state = advanceBoot(state, { type: 'tick', nowMs: 2000 });
    state = advanceBoot(state, { type: 'preload-settled', nowMs: 2400, criticalFailed: true });
    expect(state.phase).toBe('failed');

    state = advanceBoot(state, { type: 'retry', nowMs: 3000 });
    expect(state.phase).toBe('loading');
    expect(state.preload).toBe('running');

    // Agora dando certo: segue para o menu pelo caminho normal.
    state = advanceBoot(state, { type: 'preload-settled', nowMs: 3100, criticalFailed: false });
    state = advanceBoot(state, { type: 'tick', nowMs: 3400 });
    expect(state.phase).toBe('handoff');
    state = advanceBoot(state, { type: 'tick', nowMs: 3400 + handoffTotalMs(BOOT_TIMING_FULL) });
    expect(state.phase).toBe('menu');
  });

  it('ignora `retry` fora da tela de erro', () => {
    const state = initialBootState(0, BOOT_TIMING_FULL);
    expect(advanceBoot(state, { type: 'retry', nowMs: 10 })).toBe(state);
  });

  it('`menu` e terminal', () => {
    let state = initialBootState(0, BOOT_TIMING_SKIPPED);
    state = advanceBoot(state, { type: 'preload-settled', nowMs: 0, criticalFailed: false });
    state = advanceBoot(state, { type: 'tick', nowMs: 1 });
    expect(state.phase).toBe('menu');
    expect(advanceBoot(state, { type: 'tick', nowMs: 99_999 })).toBe(state);
  });
});

describe('perfis de tempo', () => {
  it('movimento reduzido mantem as telas e a ordem, sem transicao', () => {
    expect(BOOT_TIMING_REDUCED.identityFadeInMs).toBe(0);
    expect(BOOT_TIMING_REDUCED.identityFadeOutMs).toBe(0);
    expect(BOOT_TIMING_REDUCED.handoffFadeMs).toBe(0);
    // A tela de carregamento continua existindo: a preferencia pede menos
    // movimento, nao menos informacao.
    expect(BOOT_TIMING_REDUCED.loadingMinMs).toBeGreaterThan(0);
    const { phases } = play({ timing: BOOT_TIMING_REDUCED, settleAtMs: 50 });
    expect(phases).toEqual([...BOOT_SEQUENCE]);
  });

  it('o atalho de desenvolvimento chega ao menu no primeiro quadro', () => {
    expect(identityTotalMs(BOOT_TIMING_SKIPPED)).toBe(0);
    const { phases, final } = play({
      timing: BOOT_TIMING_SKIPPED,
      settleAtMs: 0,
      untilMs: 100,
      stepMs: 1,
    });
    // Com todas as duracoes em zero, as arestas ficam satisfeitas no MESMO
    // instante e a maquina atravessa a sequencia inteira dentro de uma chamada
    // (ver o ponto fixo em `advanceBoot`). Nenhuma fase intermediaria chega a
    // ser pintada — que e exatamente o que quem ligou `?boot=skip` pediu.
    expect(phases).toEqual(['identity', 'menu']);
    expect(final.phase).toBe('menu');
  });

  it('nenhum perfil inverte a ordem das fases', () => {
    // A garantia mais forte da feature, cobrada nos tres perfis e em varios
    // instantes de liquidacao: o que for visitado e sempre uma SUBSEQUENCIA da
    // ordem canonica. Nada pode aparecer antes do que vem antes dele.
    for (const timing of [BOOT_TIMING_FULL, BOOT_TIMING_REDUCED, BOOT_TIMING_SKIPPED]) {
      for (const settleAtMs of [0, 120, 900, 2400]) {
        const { phases } = play({ timing, settleAtMs, untilMs: 12_000, stepMs: 5 });
        const positions = phases.map((phase) => BOOT_SEQUENCE.indexOf(phase));
        expect(positions.every((p) => p >= 0)).toBe(true);
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      }
    }
  });

  it('`skip` vence `reduced`; sem nada, a abertura completa', () => {
    expect(bootTiming({ skip: true, reduced: true })).toBe(BOOT_TIMING_SKIPPED);
    expect(bootTiming({ reduced: true })).toBe(BOOT_TIMING_REDUCED);
    expect(bootTiming({})).toBe(BOOT_TIMING_FULL);
  });

  it('o perfil mora no estado — duas aberturas nao se contaminam', () => {
    const full = initialBootState(0, BOOT_TIMING_FULL);
    const skipped = initialBootState(0, BOOT_TIMING_SKIPPED);
    expect(advanceBoot(full, { type: 'tick', nowMs: 1 }).phase).toBe('identity');
    expect(advanceBoot(skipped, { type: 'tick', nowMs: 1 }).phase).toBe('loading');
  });
});
