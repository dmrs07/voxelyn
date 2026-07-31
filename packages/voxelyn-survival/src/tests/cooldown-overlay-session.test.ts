// A troca de sessao no HUD de cooldown.
//
// O radial online e PREDITO: o snapshot nao carrega os timers privados, entao a
// unica evidencia de que uma esquiva foi aceita e a sequencia de toques do
// proprio cliente. Quem zera essa sequencia zera a evidencia — e o botao fica
// pronto na tela enquanto o servidor o considera em recarga.
import { describe, expect, it } from 'vitest';
import { TouchCooldownOverlay } from '../client/cooldown-overlay';
import type { InputState } from '../client/input';
import type { SurvivalState } from '@voxelyn/survival-sim';

/** Canvas de mentira que conta os arcos desenhados — o radial e feito de arcos. */
const stubCanvas = () => {
  let arcs = 0;
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'arc') return () => { arcs += 1; };
        // Propriedades de estilo sao lidas e escritas; qualquer outra coisa e
        // uma chamada de desenho que nao interessa aqui.
        return () => {};
      },
      set: () => true,
    },
  );
  return {
    canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement,
    arcsDrawn: () => arcs,
  };
};

/** Sala online (playerCount 2) em `running`, sem nenhum cooldown autoritativo. */
const onlineState = (): SurvivalState =>
  ({
    phase: 'running',
    config: { playerCount: 2 },
    playerExtra: { dodgeCooldownUntil: 0, abilityCooldownUntil: 0 },
  }) as unknown as SurvivalState;

const touchInput = (): InputState =>
  ({
    usingTouch: true,
    buttons: [{ id: 'dodge', cx: 100, cy: 100, r: 40, pressed: false }],
    actionPressSeq: { dodge: 0, ability: 0 },
  }) as unknown as InputState;

describe('TouchCooldownOverlay — troca de sessao', () => {
  // A regressao: `runOnline` consome e envia o comando ANTES de renderizar. Uma
  // esquiva apertada entre o welcome e o primeiro quadro ja virou comando aceito;
  // sincronizar a sequencia nesse instante fazia `pressChanged` nascer falso e a
  // acao ficava para sempre sem radial.
  it('nao engole o toque apertado entre o welcome e o primeiro quadro', () => {
    const { canvas, arcsDrawn } = stubCanvas();
    const overlay = new TouchCooldownOverlay(canvas);
    const input = touchInput();

    // Sessao 1: um quadro qualquer, para que exista um estado anterior.
    overlay.render(onlineState(), input, 10, 0);

    // Welcome de uma sala nova + esquiva apertada antes do primeiro quadro dela.
    const fresh = onlineState();
    input.actionPressSeq.dodge += 1;

    overlay.render(fresh, input, 0, 16);
    expect(arcsDrawn(), 'o toque da sessao nova foi engolido').toBeGreaterThan(0);
  });

  // O outro lado da mesma moeda: sem estado anterior nao ha sessao a preservar, e
  // a sequencia acumulada vem de antes de existir uma run.
  it('na primeira renderizacao nao inventa cooldown a partir de toques do menu', () => {
    const { canvas, arcsDrawn } = stubCanvas();
    const overlay = new TouchCooldownOverlay(canvas);
    const input = touchInput();
    input.actionPressSeq.dodge = 7; // toques anteriores a qualquer run

    overlay.render(onlineState(), input, 0, 0);
    expect(arcsDrawn()).toBe(0);
  });

  // A predicao antiga nao pode atravessar: ela descreve um cooldown de um mundo
  // que nao existe mais, e o tick da sala nova pode ser menor que o da anterior.
  it('descarta o radial predito da sessao anterior', () => {
    const { canvas, arcsDrawn } = stubCanvas();
    const overlay = new TouchCooldownOverlay(canvas);
    const input = touchInput();

    const first = onlineState();
    overlay.render(first, input, 0, 0);
    input.actionPressSeq.dodge += 1;
    overlay.render(first, input, 1, 16); // predicao armada, radial em curso
    expect(arcsDrawn()).toBeGreaterThan(0);

    const before = arcsDrawn();
    // Sala nova, nenhum toque novo: nada deve ser desenhado.
    overlay.render(onlineState(), input, 0, 32);
    expect(arcsDrawn()).toBe(before);
  });
});
