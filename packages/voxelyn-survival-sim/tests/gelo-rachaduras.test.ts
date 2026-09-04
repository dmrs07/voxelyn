// O REWORK DO GELO: inercia, ciclo de rachaduras, buraco e recongelamento.
//
// O que estes testes protegem, em ordem de importancia:
//
// 1. O COMPROMISSO. O gelo so vira uma decisao de rota se a frenagem for
//    mensuravel — e se MV-04 a encurtar de um jeito que se sinta. As duas
//    coisas sao medidas em TILES percorridos, nunca no valor da constante: um
//    teste que conferisse `ICE_GLIDE === 0.915` passaria feliz no dia em que
//    alguem trocasse a formula do embalo e o Prospector parasse na hora.
// 2. A CONTAGEM. Quatro travessias, nem tres nem cinco, e travessia e ENTRADA
//    na celula — nunca tick parado em cima dela. Um segmento rapido nao pode
//    pular celula nenhuma, porque uma celula pulada e um buraco que nao matou.
// 3. A MORTE. Entrar em agua profunda mata com HP cheio e com iframe, nao
//    deixa corpo revivivel, e devolve os Nucleos aos pedestais certos.
// 4. O CIRCUITO FECHADO. Calor -> agua rasa -> gelo INTEIRO; a Rainha repara;
//    o buraco recongela sozinho no prazo. Sem nenhum desses tres o rework seria
//    dificuldade acumulada em vez de um loop.
// 5. O CONTRATO DE REDE. Os ids novos viajam no diff de chunk, o relogio do
//    buraco entra no hash, e re-simular o mesmo log produz o mesmo mundo.
import { describe, expect, it } from 'vitest';
import {
  DODGE_TICKS,
  FROST_QUEEN_FREEZE_COOLDOWN_TICKS,
  ICE_CRACK_CROSSINGS_TO_COLLAPSE,
  ICE_GLIDE,
  ICE_GLIDE_STABILISED,
  ICE_HOLE_REFREEZE_TICKS,
  ICE_MOMENTUM_CAP,
  ICE_REFREEZE_TICKS,
  PLAYER_SPEED,
  SOLID_NONE,
  SOLID_ROCK,
  SURF_DEEP_WATER,
  SURF_FIRE,
  SURF_ICE,
  SURF_ICE_CRACKED,
  SURF_ICE_CRITICAL,
  SURF_ICE_FRACTURED,
  SURF_NONE,
  SURF_WATER,
  TICK_HZ,
  iceCrackStage,
  isIceSurface,
} from '../src/constants';
import {
  advanceIceCrack,
  igniteCell,
  isConductiveSurface,
  openIceHole,
  sealIceHole,
  setSurface,
  stepCells,
} from '../src/cells';
import { moveEntity, spawnEnemy, updateEnemies } from '../src/entities';
import { cellsCrossed, createRun, emptyCommand, hashAuthoritativeState, stepRun } from '../src/run';
import { DEFAULT_PLAYER_TUNING, derivePlayerTuning, iceGlideFor } from '../src/progression';
import { markCoreTaken, isCoreTaken } from '../src/depth';
import type { PlayerCommand, SemanticEvent, SurvivalState } from '../src/types';

const at = (state: SurvivalState, x: number, y: number): number => y * state.config.width + x;

/**
 * Uma celula DENTRO da placa, em deslocamento a partir do Prospector.
 *
 * Coordenada absoluta nao serve: a placa e carimbada em volta de onde a seed
 * pos o jogador, e um `(30, 30)` escrito a mao cai na rocha em metade das
 * seeds — o teste passaria a medir o comportamento de chao nu sem avisar.
 */
const near = (state: SurvivalState, dx: number, dy: number): number =>
  (Math.floor(state.player.y) + dy) * state.config.width + Math.floor(state.player.x) + dx;

/**
 * Uma placa de gelo LIMPA e grande, com o Prospector no meio dela.
 *
 * Escrita direta no grid, como o resto da suite de estratos ja faz: o ponto
 * destes testes e a fisica da lamina, e passar por `descend` ate cair numa
 * Cripta com a forma certa faria cada caso depender da seed.
 */
const iceArena = (
  seed = 5,
  opts: { playerCount?: number; tuning?: typeof DEFAULT_PLAYER_TUNING; radius?: number } = {},
): SurvivalState => {
  const state = createRun({
    seed,
    playerCount: opts.playerCount ?? 1,
    tuning: opts.tuning ?? DEFAULT_PLAYER_TUNING,
  });
  const w = state.config.width;
  const h = state.config.height;
  const r = opts.radius ?? 24;
  const px = Math.floor(state.player.x);
  const py = Math.floor(state.player.y);
  for (let y = Math.max(1, py - r); y <= Math.min(h - 2, py + r); y++) {
    for (let x = Math.max(1, px - r); x <= Math.min(w - 2, px + r); x++) {
      const i = y * w + x;
      state.solid[i] = SOLID_NONE;
      state.surface[i] = SURF_ICE;
      state.surfaceTimer[i] = 0;
    }
  }
  // Sem fauna: o que se mede aqui e o chao, e um stalker empurrando o corpo
  // no meio de uma medicao de frenagem inventa deslocamento.
  state.enemies = [];
  state.projectiles = [];
  return state;
};

const move = (x: number, y: number): PlayerCommand => ({ ...emptyCommand(), move: { x, y } });

/** Empurra ate a velocidade estabilizar e devolve o quanto desliza ao soltar. */
const brakingDistance = (state: SurvivalState): number => {
  for (let t = 0; t < 90; t++) stepRun(state, [move(1, 0)]);
  const from = state.player.x;
  for (let t = 0; t < 400 && Math.abs(state.player.vx) > 1e-4; t++)
    stepRun(state, [emptyCommand()]);
  return state.player.x - from;
};

describe('inercia do gelo: o compromisso', () => {
  it('sem MV-04 a frenagem fica entre 2 e 3 tiles', () => {
    const distance = brakingDistance(iceArena());
    expect(distance).toBeGreaterThan(2);
    expect(distance).toBeLessThan(3);
  });

  it('com MV-04 a frenagem cai para 0,7-1,3 tile, pelo menos 40% menor', () => {
    const plain = brakingDistance(iceArena());
    const stabilised = brakingDistance(
      iceArena(5, { tuning: derivePlayerTuning(['MV-04']) as typeof DEFAULT_PLAYER_TUNING }),
    );
    expect(stabilised).toBeGreaterThan(0.7);
    expect(stabilised).toBeLessThan(1.3);
    expect(stabilised).toBeLessThan(plain * 0.6);
  });

  it('MV-04 nao seca a lamina: o gelo continua escorregando mais que o chao', () => {
    // O teto de design: o upgrade encurta a frenagem, nunca a elimina. Meio
    // tile ainda e meio tile — o Prospector estabilizado continua escolhendo
    // rota, so escolhe com mais precisao.
    const stabilised = brakingDistance(
      iceArena(5, { tuning: derivePlayerTuning(['MV-04']) as typeof DEFAULT_PLAYER_TUNING }),
    );
    expect(stabilised).toBeGreaterThan(0.5);
    expect(iceGlideFor({ iceGlide: 1 })).toBe(ICE_GLIDE_STABILISED);
    expect(iceGlideFor({ iceGlide: 0 })).toBe(ICE_GLIDE);
    // E a interpolacao e monotonica entre os dois extremos.
    expect(iceGlideFor({ iceGlide: 0.5 })).toBeLessThan(ICE_GLIDE);
    expect(iceGlideFor({ iceGlide: 0.5 })).toBeGreaterThan(ICE_GLIDE_STABILISED);
  });

  it('inverter o rumo derrapa, e MV-04 encurta a derrapagem E a recuperacao', () => {
    // Duas medidas porque a inversao tem duas metades, e as duas sao o que o
    // jogador sente: quanto o corpo AINDA anda para leste depois de o comando
    // apontar para oeste (a derrapagem), e quanto tempo ele leva para de fato
    // estar indo para oeste (a recuperacao).
    const reversal = (
      tuning: typeof DEFAULT_PLAYER_TUNING,
    ): { overshoot: number; recoveryTicks: number } => {
      const state = iceArena(5, { radius: 40, tuning });
      for (let t = 0; t < 90; t++) stepRun(state, [move(1, 0)]);
      const cruise = state.player.vx;
      const turnedAt = state.player.x;
      let furthest = turnedAt;
      let recoveryTicks = -1;
      for (let t = 0; t < 120; t++) {
        stepRun(state, [move(-1, 0)]);
        furthest = Math.max(furthest, state.player.x);
        if (recoveryTicks < 0 && state.player.vx <= -0.9 * cruise) recoveryTicks = t + 1;
      }
      return { overshoot: furthest - turnedAt, recoveryTicks };
    };
    const plain = reversal(DEFAULT_PLAYER_TUNING);
    const stabilised = reversal(derivePlayerTuning(['MV-04']) as typeof DEFAULT_PLAYER_TUNING);

    // Meio tile de derrapagem: o comando novo NAO vira rumo novo no mesmo tick,
    // e a diferenca e visivel a olho nu (mais de um corpo do Prospector).
    expect(plain.overshoot).toBeGreaterThan(0.5);
    // E a recuperacao leva mais de um segundo inteiro a 20 Hz.
    expect(plain.recoveryTicks).toBeGreaterThan(TICK_HZ);

    // Com estabilizador as duas metades encolhem, e nenhuma some.
    expect(stabilised.overshoot).toBeLessThan(plain.overshoot * 0.6);
    expect(stabilised.overshoot).toBeGreaterThan(0);
    expect(stabilised.recoveryTicks).toBeLessThan(plain.recoveryTicks * 0.6);
    expect(stabilised.recoveryTicks).toBeGreaterThan(0);
  });

  it('bater na parede elimina o embalo real', () => {
    const state = iceArena(5);
    const w = state.config.width;
    const wallX = Math.floor(state.player.x) + 6;
    for (let y = 0; y < state.config.height; y++) state.solid[y * w + wallX] = SOLID_ROCK;
    for (let t = 0; t < 90; t++) stepRun(state, [move(1, 0)]);
    // Encostado na parede: o deslocamento REAL do tick e zero, e e dele que a
    // inercia se alimenta — nao ha caso especial de colisao no ramo do gelo.
    expect(state.player.vx).toBeCloseTo(0, 6);
    const stuckAt = state.player.x;
    for (let t = 0; t < 20; t++) stepRun(state, [emptyCommand()]);
    expect(state.player.x).toBeCloseTo(stuckAt, 6);
  });

  it('a esquiva carrega momento sobre o gelo — com teto, sem acumulo', () => {
    const state = iceArena(5);
    const dodge: PlayerCommand = { ...emptyCommand(), move: { x: 1, y: 0 }, dodge: true };
    // Uma esquiva parado: sai mais longe do que uma caminhada sairia.
    stepRun(state, [dodge]);
    for (let t = 0; t < DODGE_TICKS; t++) stepRun(state, [emptyCommand()]);
    const afterDodge = state.player.x;
    let peak = 0;
    for (let t = 0; t < 200; t++) {
      stepRun(state, [emptyCommand()]);
      peak = Math.max(peak, Math.abs(state.player.vx));
      if (Math.abs(state.player.vx) <= 1e-4) break;
    }
    const glide = state.player.x - afterDodge;
    // Carrega momento de verdade: desliza mais do que a frenagem comum.
    expect(glide).toBeGreaterThan(2.5);
    // E o embalo NUNCA passa do teto: sem ele, a esquiva entraria a
    // DODGE_SPEED (11 tiles/s) e a lamina levaria o Prospector por seis tiles.
    expect(peak).toBeLessThanOrEqual(ICE_MOMENTUM_CAP + 1e-6);
  });

  it('esquivas encadeadas nao empilham embalo: a lamina satura no teto', () => {
    const state = iceArena(5, { radius: 40 });
    const dodge: PlayerCommand = { ...emptyCommand(), move: { x: 1, y: 0 }, dodge: true };
    // O impulso da propria esquiva e 11 tiles/s por DODGE_TICKS e nao muda —
    // ele e comportamento anterior a este rework. O que o teto protege e o que
    // a LAMINA carrega depois dele: e nessa velocidade que se mede o exploit.
    let peakGlide = 0;
    for (let n = 0; n < 6; n++) {
      for (let t = 0; t < 24; t++) {
        stepRun(state, [t === 0 ? dodge : move(1, 0)]);
        if (state.tick >= state.playerExtra.dodgeUntil) {
          peakGlide = Math.max(peakGlide, Math.hypot(state.player.vx, state.player.vy));
        }
      }
      // Devolve o chao e recentra: a medicao e de velocidade, e uma parede ou
      // um buraco aberto pelas proprias travessias a interromperia.
      state.player.x = Math.floor(state.player.x) + 0.5;
      for (let y = 1; y < state.config.height - 1; y++) {
        for (let x = 1; x < state.config.width - 1; x++) {
          const i = at(state, x, y);
          if (isIceSurface(state.surface[i]) || state.surface[i] === SURF_DEEP_WATER) {
            state.surface[i] = SURF_ICE;
          }
        }
      }
      state.iceHoles = [];
    }
    // Satura no teto em vez de crescer a cada esquiva encadeada.
    expect(peakGlide).toBeLessThanOrEqual(ICE_MOMENTUM_CAP + 1e-6);
    // E o teto e REAL: a esquiva de fato empurra o embalo ate ele.
    expect(peakGlide).toBeGreaterThan(PLAYER_SPEED);
  });
});

describe('fora do gelo o movimento nao mudou', () => {
  it('em chao nu o passo e exatamente moveSpeed/tick, sem embalo nenhum', () => {
    const state = iceArena(5);
    // Mesma arena, sem gelo: o ramo historico do movimento.
    for (let y = 1; y < state.config.height - 1; y++) {
      for (let x = 1; x < state.config.width - 1; x++) state.surface[at(state, x, y)] = SURF_NONE;
    }
    const dt = 1 / TICK_HZ;
    const before = state.player.x;
    stepRun(state, [move(1, 0)]);
    // Igualdade exata, e nao aproximada: o ramo de chao seco continua sendo
    // `posicao += rumo * velocidade * dt`, sem nenhum termo de inercia.
    expect(state.player.x - before).toBeCloseTo(PLAYER_SPEED * dt, 12);
    // E soltar o comando PARA no mesmo tick.
    const stopped = state.player.x;
    stepRun(state, [emptyCommand()]);
    expect(state.player.x).toBe(stopped);
  });

  it('em chao nu andar em cima da mesma celula nao muda o chao', () => {
    const state = iceArena(5);
    for (let y = 1; y < state.config.height - 1; y++) {
      for (let x = 1; x < state.config.width - 1; x++) state.surface[at(state, x, y)] = SURF_NONE;
    }
    for (let t = 0; t < 200; t++) stepRun(state, [move(t % 2 === 0 ? 1 : -1, 0)]);
    for (let i = 0; i < state.surface.length; i++) {
      expect(state.surface[i]).not.toBe(SURF_DEEP_WATER);
    }
  });
});

describe('o ciclo de rachaduras', () => {
  it('a quarta travessia abre o buraco, e as tres antes dela sao os estagios', () => {
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    const events: SemanticEvent[] = [];
    expect(state.surface[cell]).toBe(SURF_ICE);
    expect(advanceIceCrack(state, cell, events)).toBe('cracked');
    expect(state.surface[cell]).toBe(SURF_ICE_CRACKED);
    expect(advanceIceCrack(state, cell, events)).toBe('cracked');
    expect(state.surface[cell]).toBe(SURF_ICE_FRACTURED);
    expect(advanceIceCrack(state, cell, events)).toBe('cracked');
    expect(state.surface[cell]).toBe(SURF_ICE_CRITICAL);
    expect(advanceIceCrack(state, cell, events)).toBe('collapsed');
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
    // Tres avisos e um colapso — e os avisos numeram o degrau.
    expect(
      events.filter((e) => e.t === 'ice_crack').map((e) => (e as { stage: number }).stage),
    ).toEqual([1, 2, 3]);
    expect(events.filter((e) => e.t === 'ice_collapse')).toHaveLength(1);
    expect(ICE_CRACK_CROSSINGS_TO_COLLAPSE).toBe(4);
  });

  it('atravessar a MESMA celula quatro vezes faz o chao ceder', () => {
    const state = iceArena(5, { radius: 30 });
    const w = state.config.width;
    const lane = Math.floor(state.player.y);
    const target = Math.floor(state.player.x) + 3;
    const cell = lane * w + target;
    const stages: number[] = [];
    for (let pass = 0; pass < 4 && state.player.alive; pass++) {
      // Cada passagem parte de fora e ATRAVESSA a celula. Sair e voltar conta
      // como duas travessias no jogo; aqui a rota e refeita do zero de
      // proposito, para a contagem medida ser a da celula-alvo e nao a soma de
      // uma ida e uma volta.
      state.player.x = target - 2.5;
      state.player.y = lane + 0.5;
      state.player.vx = 0;
      state.player.vy = 0;
      // A VIZINHANCA volta a ficar inteira entre as passagens. Sem isto, as
      // celulas do caminho de aproximacao se gastam junto e uma delas cede
      // antes do alvo — o teste mediria a primeira celula da rota, e nao a
      // quarta travessia daquela.
      for (let x = target - 4; x <= target + 3; x++) {
        if (x === target) continue;
        const i = lane * w + x;
        if (isIceSurface(state.surface[i]) || state.surface[i] === SURF_DEEP_WATER) {
          state.surface[i] = SURF_ICE;
        }
      }
      state.iceHoles = state.iceHoles.filter((hole) => hole.idx === cell);
      for (let t = 0; t < 40 && state.player.alive && state.player.x < target + 1.5; t++) {
        stepRun(state, [move(1, 0)]);
      }
      stages.push(iceCrackStage(state.surface[cell]));
    }
    // Depois de cada passagem: fina, fraturado, critico, e entao o buraco.
    expect(stages.slice(0, 3)).toEqual([1, 2, 3]);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
    // E quem atravessou na quarta vez caiu junto com a placa.
    expect(state.player.alive).toBe(false);
  });

  it('ficar parado NAO racha: o contador e de entrada, nunca de tick', () => {
    const state = iceArena(5);
    const cell = at(state, Math.floor(state.player.x), Math.floor(state.player.y));
    expect(state.surface[cell]).toBe(SURF_ICE);
    for (let t = 0; t < 400; t++) stepRun(state, [emptyCommand()]);
    expect(state.surface[cell]).toBe(SURF_ICE);
    // Nem mesmo se mexer DENTRO da propria celula, sem cruzar fronteira.
    for (let t = 0; t < 40; t++) stepRun(state, [move(t % 2 === 0 ? 0.04 : -0.04, 0)]);
    expect(state.surface[cell]).toBe(SURF_ICE);
  });

  it('uma celula avanca no maximo um degrau por Prospector por passo', () => {
    // Um segmento que entra e sai da mesma celula num unico tick nao pode
    // cobrar duas travessias: quem passou por cima passou UMA vez.
    const state = iceArena(5);
    const w = state.config.width;
    const lane = Math.floor(state.player.y);
    const midX = Math.floor(state.player.x) + 6;
    const cell = lane * w + midX;
    const events: SemanticEvent[] = [];
    const crossed = cellsCrossed(state, midX - 0.5, lane + 0.5, midX + 1.5, lane + 0.5);
    expect(crossed.filter((i) => i === cell)).toHaveLength(1);
    for (const i of new Set(crossed)) advanceIceCrack(state, i, events);
    expect(state.surface[cell]).toBe(SURF_ICE_CRACKED);
  });
});

describe('a caminhada de celulas nao pula nada', () => {
  it('a diagonal produz um caminho conexo por aresta', () => {
    const state = iceArena(5);
    const w = state.config.width;
    const path = cellsCrossed(state, 20.5, 20.5, 26.5, 24.5);
    expect(path.length).toBeGreaterThan(0);
    let prev = 20 * w + 20;
    for (const i of path) {
      const dx = Math.abs((i % w) - (prev % w));
      const dy = Math.abs(Math.floor(i / w) - Math.floor(prev / w));
      // Um passo de cada vez, em UM eixo: nunca um salto pela quina.
      expect(dx + dy).toBe(1);
      prev = i;
    }
    expect(path[path.length - 1]).toBe(24 * w + 26);
  });

  it('um salto longo num tick atravessa toda celula do caminho', () => {
    const state = iceArena(5);
    const w = state.config.width;
    // Oito tiles num unico segmento: mais do que qualquer tick real produz.
    const path = cellsCrossed(state, 20.5, 30.5, 28.5, 30.5);
    expect(path).toEqual([21, 22, 23, 24, 25, 26, 27, 28].map((x) => 30 * w + x));
  });

  it('a esquiva conta como travessia e nao pula a celula critica', () => {
    const state = iceArena(5);
    const w = state.config.width;
    const lane = Math.floor(state.player.y);
    const hazard = lane * w + Math.floor(state.player.x) + 3;
    // Uma placa critica plantada no meio do caminho da esquiva.
    setSurface(state, hazard, SURF_ICE_CRITICAL, 0);
    const dodge: PlayerCommand = { ...emptyCommand(), move: { x: 1, y: 0 }, dodge: true };
    stepRun(state, [dodge]);
    for (let t = 0; t < DODGE_TICKS + 2 && state.player.alive; t++)
      stepRun(state, [emptyCommand()]);
    // A esquiva percorre ~0,55 tile por tick: sem a caminhada de celulas ela
    // teria passado por cima da placa sem toca-la.
    expect(state.surface[hazard]).toBe(SURF_DEEP_WATER);
    expect(state.player.alive).toBe(false);
  });
});

describe('co-op: duas cargas no mesmo tick', () => {
  it('dois Prospectors na mesma celula descem dois degraus, na ordem dos slots', () => {
    const run = (): { surface: number; hash: string } => {
      const state = iceArena(11, { playerCount: 2 });
      const w = state.config.width;
      const lane = Math.floor(state.player.y);
      const target = Math.floor(state.player.x) + 2;
      // Os dois lado a lado na MESMA celula, a um passo da fronteira: eles
      // cruzam para `target` no mesmo tick, que e o caso simultaneo.
      for (const p of state.players) {
        p.x = target - 0.15;
        p.y = lane + 0.5;
        p.vx = 0;
        p.vy = 0;
      }
      for (let t = 0; t < 8; t++) stepRun(state, [move(1, 0), move(1, 0)]);
      return { surface: state.surface[lane * w + target], hash: hashAuthoritativeState(state) };
    };
    const a = run();
    const b = run();
    // Determinismo: a mesma resolucao simultanea, nas duas execucoes.
    expect(a.hash).toBe(b.hash);
    // E os dois cobraram: a celula desceu DOIS degraus na primeira passagem.
    expect(iceCrackStage(a.surface)).toBe(2);
  });
});

describe('calor, recongelamento e agua', () => {
  it('fogo derrete QUALQUER estagio em agua rasa', () => {
    for (const stage of [SURF_ICE, SURF_ICE_CRACKED, SURF_ICE_FRACTURED, SURF_ICE_CRITICAL]) {
      const state = iceArena(5);
      const cell = near(state, 6, 6);
      setSurface(state, cell, stage, 0);
      igniteCell(state, cell, []);
      expect(state.surface[cell], `estagio ${stage}`).toBe(SURF_WATER);
      expect(state.surfaceTimer[cell]).toBe(ICE_REFREEZE_TICKS);
      // Agua rasa e SEGURA e CONDUTIVA: ela nao herda nada do buraco.
      expect(isConductiveSurface(state.surface[cell])).toBe(true);
    }
  });

  it('a agua derretida recongela como gelo INTEIRO, e nao no estagio anterior', () => {
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    setSurface(state, cell, SURF_ICE_CRITICAL, 0);
    igniteCell(state, cell, []);
    for (let t = 0; t <= ICE_REFREEZE_TICKS + 6 && state.surface[cell] === SURF_WATER; t++) {
      state.tick += 1;
      stepCells(state, []);
    }
    expect(state.surface[cell]).toBe(SURF_ICE);
    expect(iceCrackStage(state.surface[cell])).toBe(0);
  });

  it('agua profunda conduz como agua', () => {
    expect(isConductiveSurface(SURF_DEEP_WATER)).toBe(true);
  });

  it('calor nao devolve um buraco: agua profunda ja e agua', () => {
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    openIceHole(state, cell, []);
    igniteCell(state, cell, []);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
  });
});

describe('o buraco', () => {
  const holeAhead = (state: SurvivalState): number => {
    const w = state.config.width;
    const cell = Math.floor(state.player.y) * w + Math.floor(state.player.x) + 3;
    openIceHole(state, cell, []);
    return cell;
  };

  it('mata com HP cheio e com iframe de esquiva ativo', () => {
    const state = iceArena(5);
    holeAhead(state);
    state.player.hp = state.player.maxHp;
    // Iframe ligado por muito tempo: a queda nao e dano e nao passa por ele.
    state.playerExtra.iframesUntil = state.tick + 10_000;
    for (let t = 0; t < 40 && state.player.alive; t++) stepRun(state, [move(1, 0)]);
    expect(state.player.alive).toBe(false);
    expect(state.playerExtra.lastDamage?.cause).toEqual({ kind: 'deep_water' });
    expect(state.summary?.deathCause).toEqual({ kind: 'deep_water' });
  });

  it('emite a queda e a morte, nesta ordem, no mesmo tick', () => {
    const state = iceArena(5);
    holeAhead(state);
    let seen: SemanticEvent[] = [];
    for (let t = 0; t < 40 && state.player.alive; t++) {
      seen = stepRun(state, [move(1, 0)]).events;
    }
    const fall = seen.findIndex((e) => e.t === 'ice_fall');
    const death = seen.findIndex((e) => e.t === 'death');
    expect(fall).toBeGreaterThanOrEqual(0);
    expect(death).toBeGreaterThan(fall);
  });

  it('em co-op a queda nao deixa corpo revivivel dentro do buraco', () => {
    const state = iceArena(11, { playerCount: 2 });
    const w = state.config.width;
    const lane = Math.floor(state.player.y);
    // O parceiro fica de pe, longe: o slot 0 caindo com aliado vivo e
    // exatamente o caso em que a morte comum viraria "abatido".
    state.players[1].x = state.players[0].x + 8;
    state.players[1].y = lane + 0.5;
    const cell = lane * w + Math.floor(state.players[0].x) + 3;
    openIceHole(state, cell, []);
    for (let t = 0; t < 40 && state.players[0].alive; t++) {
      stepRun(state, [move(1, 0), emptyCommand()]);
    }
    expect(state.players[0].alive).toBe(false);
    expect(state.playerExtras[0].downed).toBe(false);
    expect(state.playerExtras[0].bleedoutAt).toBe(0);
    // O parceiro continua em jogo: a run nao acabou.
    expect(state.players[1].alive).toBe(true);
    expect(state.phase).toBe('running');
  });

  it('os Nucleos carregados voltam aos pedestais', () => {
    const state = iceArena(5);
    markCoreTaken(state, 1);
    state.playerExtra.carriedCoreMask = 1 << 1;
    state.playerExtra.hasCore = true;
    expect(isCoreTaken(state, 1)).toBe(true);
    holeAhead(state);
    for (let t = 0; t < 40 && state.player.alive; t++) stepRun(state, [move(1, 0)]);
    expect(state.player.alive).toBe(false);
    expect(isCoreTaken(state, 1)).toBe(false);
    expect(state.playerExtra.carriedCoreMask).toBe(0);
    expect(state.playerExtra.hasCore).toBe(false);
  });

  it('recongela como gelo INTEIRO no prazo, e o prazo fica entre 10 e 14 s', () => {
    expect(ICE_HOLE_REFREEZE_TICKS / TICK_HZ).toBeGreaterThanOrEqual(10);
    expect(ICE_HOLE_REFREEZE_TICKS / TICK_HZ).toBeLessThanOrEqual(14);
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    openIceHole(state, cell, []);
    expect(state.iceHoles).toHaveLength(1);
    const events: SemanticEvent[] = [];
    for (let t = 0; t <= ICE_HOLE_REFREEZE_TICKS + 6; t++) {
      state.tick += 1;
      stepCells(state, events);
    }
    expect(state.surface[cell]).toBe(SURF_ICE);
    expect(state.iceHoles).toHaveLength(0);
    expect(events.some((e) => e.t === 'ice_mend')).toBe(true);
  });

  it('projetil passa por cima; bicho de chao comum nao termina movimento nele', () => {
    const state = iceArena(5, { radius: 30 });
    const w = state.config.width;
    const lane = Math.floor(state.player.y) + 6;
    const hx = Math.floor(state.player.x) + 6;
    const cell = lane * w + hx;
    openIceHole(state, cell, []);

    const stalker = spawnEnemy(state, 'stalker', hx - 1, lane, false);
    stalker.x = hx - 0.5;
    stalker.y = lane + 0.5;
    // Empurrado para dentro do buraco: o passo e recusado, e ele fica na borda.
    moveEntity(state, stalker, 1, 0);
    expect(Math.floor(stalker.x)).toBe(hx - 1);

    // A Rainha e os Espectros atravessam: o buraco e do estrato deles.
    for (const archetype of ['frost_queen', 'frost_wraith'] as const) {
      const crosser = spawnEnemy(state, archetype, hx - 1, lane, false);
      crosser.x = hx - 0.5;
      crosser.y = lane + 0.5;
      moveEntity(state, crosser, 1, 0);
      expect(Math.floor(crosser.x), archetype).toBe(hx);
    }

    // O projetil nao consulta superficie: ele voa por cima.
    state.enemies = [];
    state.projectiles.push({
      kind: 'bolt',
      id: 9001,
      owner: state.player.id,
      x: hx - 1.5,
      y: lane + 0.5,
      vx: 14,
      vy: 0,
      damage: 1,
      distanceTravelled: 0,
    });
    for (let t = 0; t < 6; t++) stepRun(state, [emptyCommand()]);
    const bolt = state.projectiles.find((p) => p.id === 9001);
    // Ou ainda voando alem do buraco, ou ja saiu do alcance — nunca parado nele.
    expect(bolt === undefined || bolt.x > hx + 1).toBe(true);
    expect(state.surface[cell]).toBe(SURF_DEEP_WATER);
  });
});

describe('a Rainha da Geada', () => {
  /** Uma Rainha viva no meio de uma placa, com o jogador fora do caminho. */
  const queenArena = (): { state: SurvivalState; queen: ReturnType<typeof spawnEnemy> } => {
    const state = iceArena(5, { radius: 30 });
    const qx = Math.floor(state.player.x) + 10;
    const qy = Math.floor(state.player.y);
    const queen = spawnEnemy(state, 'frost_queen', qx, qy, false);
    return { state, queen };
  };

  it('a couraca conta gelo RACHADO como gelo, e para de contar o buraco', () => {
    const { state, queen } = queenArena();
    const w = state.config.width;
    const cx = Math.floor(queen.x);
    const cy = Math.floor(queen.y);
    // Blindada com a placa inteira.
    for (let t = 0; t < 3; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.frostArmored).toBe(1);

    // Rachar tudo em volta NAO abre a couraca: rachadura ainda e lamina.
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const i = (cy + dy) * w + cx + dx;
        if (isIceSurface(state.surface[i])) setSurface(state, i, SURF_ICE_CRITICAL, 0);
      }
    }
    for (let t = 0; t < 3; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.frostArmored).toBe(1);

    // DERRETER abre: e o contra-jogo autorado, e ele continua sendo o unico.
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const i = (cy + dy) * w + cx + dx;
        if (isIceSurface(state.surface[i])) setSurface(state, i, SURF_WATER, ICE_REFREEZE_TICKS);
      }
    }
    for (let t = 0; t < 3; t++) stepRun(state, [emptyCommand()]);
    expect(state.bossRuntime.frostArmored).toBe(0);
  });

  it('o congelamento repara rachaduras, fecha buracos e preserva fogo vivo', () => {
    const { state, queen } = queenArena();
    const w = state.config.width;
    const cx = Math.floor(queen.x);
    const cy = Math.floor(queen.y);
    const cracked = cy * w + cx + 2;
    const hole = cy * w + cx + 3;
    const fire = cy * w + cx + 4;
    setSurface(state, cracked, SURF_ICE_FRACTURED, 0);
    openIceHole(state, hole, []);
    setSurface(state, fire, SURF_FIRE, 400);

    // A habilidade e disparada direto, como os testes de chefe ja fazem: o
    // ponto aqui e o EFEITO do congelamento, nao o relogio que o agenda.
    const events: SemanticEvent[] = [];
    const before = state.iceHoles.length;
    expect(before).toBe(1);
    freezeNow(state, queen, events);

    expect(state.surface[cracked]).toBe(SURF_ICE);
    expect(state.surface[hole]).toBe(SURF_ICE);
    expect(state.iceHoles).toHaveLength(0);
    // Fogo vivo continua de pe: apagar o incendio do jogador desfaria a acao
    // dele, e essa regra e anterior ao rework.
    expect(state.surface[fire]).toBe(SURF_FIRE);

    const mend = events.find((e) => e.t === 'ice_mend');
    expect(mend).toBeDefined();
    expect((mend as { mended: number }).mended).toBeGreaterThan(0);
    expect((mend as { sealed: number }).sealed).toBe(1);
  });

  it('a janela entre congelamentos deixa abrir um buraco perto dela, e usa-lo', () => {
    // A 6 s (o valor antigo) o reparo dela apagava toda rota perto dela antes
    // do quarto degrau: o buraco, a unica consequencia nova da luta, so
    // existia longe do encontro. O que a janela garante: um laco apertado
    // (quatro passagens por uma celula, ~11 s a PLAYER_SPEED) abre o buraco
    // E sobram pelo menos 3 s dele antes de o congelamento seguinte poder
    // sela-lo. A garantia e a SOMA, nao cada parcela: comparar o intervalo
    // so com o laco deixaria um buraco que abre e fecha no mesmo tick.
    const lapTicks = Math.ceil(((2 * Math.PI * 2) / PLAYER_SPEED) * TICK_HZ);
    const openTicks = lapTicks * ICE_CRACK_CROSSINGS_TO_COLLAPSE;
    expect(FROST_QUEEN_FREEZE_COOLDOWN_TICKS - openTicks).toBeGreaterThanOrEqual(3 * TICK_HZ);
    // E o que ela NAO garante, de proposito: dentro do raio dela o buraco vive
    // o que restar da janela, nunca o relogio natural inteiro. Cobrir o laco e
    // o recongelamento juntos pediria ~23 s, um chefe que ataca duas vezes por
    // minuto.
    expect(FROST_QUEEN_FREEZE_COOLDOWN_TICKS).toBeLessThan(openTicks + ICE_HOLE_REFREEZE_TICKS);
  });

  it('dois congelamentos seguidos respeitam a cadencia, e o segundo nao vem antes', () => {
    const state = iceArena(9, { radius: 30 });
    const queen = spawnEnemy(
      state,
      'frost_queen',
      Math.floor(state.player.x) + 5,
      Math.floor(state.player.y),
      false,
    );
    queen.alertedUntil = state.tick + 100_000;
    const starts: number[] = [];
    for (let t = 0; t < FROST_QUEEN_FREEZE_COOLDOWN_TICKS * 2 + 200 && starts.length < 2; t++) {
      for (const ev of stepRun(state, [emptyCommand()]).events) {
        if (ev.t === 'action_start' && ev.entity === queen.id && ev.action === 'freeze') {
          starts.push(state.tick);
        }
      }
      state.player.hp = state.player.maxHp;
    }
    expect(starts, 'a Rainha nao congelou duas vezes').toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(FROST_QUEEN_FREEZE_COOLDOWN_TICKS);
  });

  it('o congelamento anuncia-se como golpe DELA, e nao como o pulso generico', () => {
    // O `pulse` e o evento do pulso do jogador (e da Supernova): o cliente
    // desenha a frente branca e toca a voz do pulso. O congelamento nao
    // empurra nem machuca — o que ele tem de anunciar e o `boss_attack` com
    // nome e dono, que e onde o leque de estilhacos e o som do gelo se penduram.
    const { state, queen } = queenArena();
    const events: SemanticEvent[] = [];
    freezeNow(state, queen, events);
    expect(
      events.some(
        (e) => e.t === 'boss_attack' && e.archetype === 'frost_queen' && e.ability === 'freeze',
      ),
    ).toBe(true);
    expect(events.some((e) => e.t === 'pulse')).toBe(false);
  });

  it('os Espectros nao quebram o gelo por onde passam', () => {
    const state = iceArena(7, { radius: 30 });
    const w = state.config.width;
    const lane = Math.floor(state.player.y);
    const wraith = spawnEnemy(state, 'frost_wraith', Math.floor(state.player.x) + 8, lane, false);
    // Cacando o jogador: ele atravessa a placa inteira ate o corpo dele.
    wraith.alertedUntil = state.tick + 10_000;
    const before: number[] = [];
    for (let x = 1; x < state.config.width - 1; x++) before.push(state.surface[lane * w + x]);
    for (let t = 0; t < 200; t++) stepRun(state, [emptyCommand()]);
    for (let x = 1; x < state.config.width - 1; x++) {
      // Nada rachou por conta dele: a carga e do Prospector, e o Espectro E a
      // lamina — ele nao a gasta.
      expect(state.surface[lane * w + x], `x=${x}`).toBe(before[x - 1]);
    }
  });
});

describe('a Cripta subvertida estabiliza os QUATRO estagios', () => {
  it('gelo rachado nao racha mais, nao derrete e nao escorrega', () => {
    const state = iceArena(5);
    state.stratum = 'glacial';
    state.stratumSubverted = true;
    for (const stage of [SURF_ICE, SURF_ICE_CRACKED, SURF_ICE_FRACTURED, SURF_ICE_CRITICAL]) {
      const cell = near(state, 6, 6);
      setSurface(state, cell, stage, 0);
      expect(advanceIceCrack(state, cell, [])).toBeNull();
      expect(state.surface[cell], `estagio ${stage}`).toBe(stage);
      igniteCell(state, cell, []);
      expect(state.surface[cell], `estagio ${stage}`).toBe(stage);
    }
    // E a inercia some junto: o Prospector para na hora, em qualquer estagio.
    setSurface(
      state,
      at(state, Math.floor(state.player.x), Math.floor(state.player.y)),
      SURF_ICE_CRITICAL,
      0,
    );
    for (let t = 0; t < 20; t++) stepRun(state, [move(1, 0)]);
    const stopped = state.player.x;
    stepRun(state, [emptyCommand()]);
    expect(state.player.x).toBe(stopped);
  });

  it('um buraco ja aberto continua fatal e continua no proprio relogio', () => {
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    openIceHole(state, cell, []);
    state.stratum = 'glacial';
    state.stratumSubverted = true;
    for (let t = 0; t <= ICE_HOLE_REFREEZE_TICKS + 6; t++) {
      state.tick += 1;
      stepCells(state, []);
    }
    expect(state.surface[cell]).toBe(SURF_ICE);
  });
});

describe('rede: hash, replay e diff de chunk', () => {
  it('o relogio do buraco entra no hash autoritativo', () => {
    const a = iceArena(5);
    const b = iceArena(5);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    openIceHole(a, near(a, 6, 6), []);
    openIceHole(b, near(b, 6, 6), []);
    expect(hashAuthoritativeState(a)).toBe(hashAuthoritativeState(b));
    // O MESMO buraco, com prazos diferentes: as duas simulacoes discordam de
    // quando a rota volta a existir, e o hash tem de acusar isso.
    b.iceHoles[0].at += 1;
    expect(hashAuthoritativeState(a)).not.toBe(hashAuthoritativeState(b));
  });

  it('re-simular o mesmo log de comandos reproduz o gelo inteiro', () => {
    const script: PlayerCommand[] = [];
    for (let t = 0; t < 240; t++) {
      script.push(move(t % 60 < 30 ? 1 : -1, t % 90 < 45 ? 0.35 : -0.35));
    }
    const play = (): { hash: string; holes: number; cracked: number } => {
      const state = iceArena(13);
      for (const cmd of script) stepRun(state, [cmd]);
      let cracked = 0;
      for (let i = 0; i < state.surface.length; i++) {
        if (iceCrackStage(state.surface[i]) > 0) cracked++;
      }
      return { hash: hashAuthoritativeState(state), holes: state.iceHoles.length, cracked };
    };
    const first = play();
    const second = play();
    expect(second).toEqual(first);
    // E o roteiro de fato gastou o chao: um teste que rodasse sobre gelo
    // intacto passaria sem provar nada.
    expect(first.cracked).toBeGreaterThan(0);
  });

  it('os quatro ids novos sao superficies validas e distintas', () => {
    const ids = [SURF_ICE_CRACKED, SURF_ICE_FRACTURED, SURF_ICE_CRITICAL, SURF_DEEP_WATER];
    // Append-only: todos acima do ultimo id historico (SURF_GLASS = 14).
    for (const id of ids) expect(id).toBeGreaterThan(14);
    expect(new Set(ids).size).toBe(4);
    // Os tres estagios sao gelo; o buraco nao e.
    expect(ids.slice(0, 3).every(isIceSurface)).toBe(true);
    expect(isIceSurface(SURF_DEEP_WATER)).toBe(false);
    // E cabem num Uint8Array, que e o que o diff de chunk transporta.
    const probe = new Uint8Array(ids.length);
    probe.set(ids);
    expect([...probe]).toEqual(ids);
  });

  it('selar um buraco tira o relogio junto', () => {
    const state = iceArena(5);
    const cell = near(state, 6, 6);
    openIceHole(state, cell, []);
    expect(sealIceHole(state, cell)).toBe(true);
    expect(state.iceHoles).toHaveLength(0);
    expect(state.surface[cell]).toBe(SURF_ICE);
    // Idempotente: selar de novo nao mente sobre ter fechado algo.
    expect(sealIceHole(state, cell)).toBe(false);
  });
});

/**
 * Dispara o congelamento da Rainha AGORA, sem esperar o relogio de habilidade.
 *
 * Os testes de chefe desta suite ja usam este atalho: o que se quer examinar e
 * o efeito da habilidade, e nao o agendamento dela — e esperar o ciclo inteiro
 * faria cada caso depender do balanco de cooldown.
 */
function freezeNow(state: SurvivalState, queen: { id: number }, events: SemanticEvent[]): void {
  const body = state.enemies.find((e) => e.id === queen.id);
  if (!body) throw new Error('rainha ausente');
  body.nextActionAt = 0;
  body.rangedReadyAt = 0;
  body.contactReadyAt = 0;
  // `updateEnemies` resolve a acao pelo caminho autoritativo normal; forcar os
  // relogios e a unica coisa que o teste faz por fora.
  for (let t = 0; t < 200; t++) {
    const before = events.length;
    updateEnemies(state, events);
    state.tick += 1;
    // O golpe saiu quando o `boss_attack` dela saiu — o `ice_mend` vem no
    // mesmo tick, mas so quando havia o que reparar.
    if (
      events
        .slice(before)
        .some(
          (e) => e.t === 'boss_attack' && e.archetype === 'frost_queen' && e.ability === 'freeze',
        )
    )
      return;
  }
  throw new Error('a Rainha nao congelou dentro da janela do teste');
}
