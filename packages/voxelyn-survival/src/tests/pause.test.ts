import { describe, expect, it } from 'vitest';
import { isEditableTag } from '../client/input';
import {
  HoldToOpen,
  PAUSE_HINT_DEADLINE_MS,
  PAUSE_HINT_DELAY_MS,
  PAUSE_HOLD_MS,
  PAUSE_SLOP_PX,
  isInPauseZone,
  pauseHintVerdict,
  pauseZoneHeight,
} from '../client/pause';

describe('atalhos de teclado dentro de campos', () => {
  it('campos de digitacao ficam de fora dos atalhos', () => {
    // O nome do ranking agora e editavel NO MEIO DA RUN, pelo menu de campo.
    // Sem esta lista, "Marta" desligava o som no M, "Rafael" engatilhava o
    // reinicio no R, "Pedro" fechava o menu no P e o espaco nunca entrava.
    expect(isEditableTag('INPUT')).toBe(true);
    expect(isEditableTag('TEXTAREA')).toBe(true);
    expect(isEditableTag('SELECT')).toBe(true); // as setas navegam as opcoes
    expect(isEditableTag('DIV', true)).toBe(true); // contenteditable
  });

  it('o resto da pagina continua ouvindo os atalhos', () => {
    // A guarda nao pode virar um "desliga tudo": durante a run o foco esta no
    // body ou no canvas, e e ali que WASD, espaco e R precisam chegar.
    expect(isEditableTag('BODY')).toBe(false);
    expect(isEditableTag('CANVAS')).toBe(false);
    expect(isEditableTag('BUTTON')).toBe(false); // o botao de mudo nao e campo
    expect(isEditableTag('DIV')).toBe(false);
  });
});

describe('faixa de topo: onde o toque longo vale', () => {
  it('cobre o topo da tela e nunca a metade de baixo', () => {
    expect(isInPauseZone(4, 800)).toBe(true);
    expect(isInPauseZone(400, 800)).toBe(false);
    expect(isInPauseZone(799, 800)).toBe(false);
  });

  it('para bem acima dos botoes de acao em paisagem de celular', () => {
    // Layout medido de `SurvivalInput.layoutButtons` com altura 380: a fileira
    // de acoes comeca por volta de 150 px do topo. A faixa nao pode encostar.
    const height = 380;
    expect(pauseZoneHeight(height)).toBeLessThan(140);
    expect(isInPauseZone(150, height)).toBe(false);
  });

  it('nao encolhe a ponto de sumir numa tela muito baixa', () => {
    // 200 px de altura e teclado aberto em paisagem; a faixa ainda precisa
    // caber um dedo.
    expect(pauseZoneHeight(200)).toBeGreaterThanOrEqual(48);
  });

  it('tem teto: numa tela alta a faixa nao vira um terco do jogo', () => {
    expect(pauseZoneHeight(2000)).toBe(120);
  });
});

describe('HoldToOpen: o toque longo', () => {
  it('nao completa antes do tempo, e completa depois', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 1000);
    expect(hold.completed(1000 + PAUSE_HOLD_MS - 1)).toBe(false);
    expect(hold.completed(1000 + PAUSE_HOLD_MS)).toBe(true);
  });

  it('completa UMA vez so', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    expect(hold.completed(9000)).toBe(true);
    expect(hold.completed(9001)).toBe(false); // o menu nao reabre sozinho
  });

  it('tolera o tremor do dedo parado', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(1, 100 + PAUSE_SLOP_PX - 1, 20);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('um arrasto cancela: arrastar nao e segurar', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(1, 100 + PAUSE_SLOP_PX + 1, 20);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(false);
  });

  it('ignora o movimento de OUTRO dedo', () => {
    // Dois dedos na tela e o normal aqui: um no joystick, outro segurando o
    // topo. O que anda no joystick nao pode cancelar o que esta parado.
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.drag(2, 900, 900);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('soltar antes da hora cancela', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.end(1);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(false);
  });

  it('soltar OUTRO dedo nao cancela', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.end(2);
    expect(hold.completed(PAUSE_HOLD_MS)).toBe(true);
  });

  it('pending descreve o gesto em andamento', () => {
    const hold = new HoldToOpen();
    expect(hold.pending).toBe(false);
    hold.begin(1, 100, 20, 0);
    expect(hold.pending).toBe(true);
    hold.completed(PAUSE_HOLD_MS);
    expect(hold.pending).toBe(false); // ja disparou; nao ha mais o que esperar
  });

  it('cancel devolve o gesto ao repouso e o proximo toque comeca limpo', () => {
    const hold = new HoldToOpen();
    hold.begin(1, 100, 20, 0);
    hold.cancel();
    expect(hold.completed(9000)).toBe(false);
    hold.begin(2, 100, 20, 10_000);
    expect(hold.completed(10_000 + PAUSE_HOLD_MS)).toBe(true);
  });
});

describe('a dica do gesto espera o banner em vez de desistir', () => {
  it('banner livre: a dica entra', () => {
    expect(pauseHintVerdict(0, false)).toBe('show');
  });

  it('banner ocupado dentro do prazo: espera a proxima vez', () => {
    // A REGRESSAO QUE ISTO TRAVA. A versao antiga desistia da descida inteira
    // aqui, e uma descida offline abre com "AURIX UNREACHABLE" ocupando o
    // banner por 4,2 s — a unica tentativa caia sempre dentro dessa janela.
    // Medido no jogo: banner ocupado de t+22 ms a t+4265 ms, dica jamais vista.
    expect(pauseHintVerdict(0, true)).toBe('retry');
    expect(pauseHintVerdict(2000, true)).toBe('retry');
    // 4,2 s e o caso real: e depois do banner offline que a dica tem de caber.
    expect(pauseHintVerdict(4300, true)).toBe('retry');
  });

  it('o prazo existe para a dica nao brotar no meio de uma luta', () => {
    expect(pauseHintVerdict(PAUSE_HINT_DEADLINE_MS, true)).toBe('giveUp');
    expect(pauseHintVerdict(PAUSE_HINT_DEADLINE_MS + 5000, true)).toBe('giveUp');
  });

  it('o prazo nao atropela um banner que acabou de desocupar', () => {
    // Passado o prazo, mas a faixa esta livre: mostrar e melhor que calar —
    // a desistencia so vale contra a ESPERA, nunca contra a oportunidade.
    expect(pauseHintVerdict(PAUSE_HINT_DEADLINE_MS + 1, false)).toBe('show');
  });

  it('a janela de espera cobre com folga o banner que a bloqueava', () => {
    // O prazo tem de ser maior que o banner offline (4,2 s) somado ao atraso
    // inicial (1,6 s); sem essa folga o conserto seria so um empate mais lento.
    expect(PAUSE_HINT_DEADLINE_MS).toBeGreaterThan(4200 + PAUSE_HINT_DELAY_MS);
  });
});
