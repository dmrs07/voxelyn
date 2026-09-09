// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createRun, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import { EchoChoicePanel } from './echo-choice';
import { setLocale } from './i18n';

let panel: EchoChoicePanel | undefined;
afterEach(() => {
  panel?.dispose();
  document.body.replaceChildren();
});
const setup = (earned = true) => {
  setLocale('pt-BR');
  const state = createRun({ seed: 552 });
  state.player.x = state.corePos.x + 0.5;
  state.player.y = state.corePos.y + 0.5;
  if (earned) {
    state.playerExtra.resonance.fire = 12;
    state.playerExtra.resonance.current = 3;
  }
  stepRun(state, [emptyCommand()]);
  panel = new EchoChoicePanel();
  panel.update(state);
  return state;
};
describe('Echoes 2.0 selection UI', () => {
  it('shows factual evidence, cooldown and effect for both cards', () => {
    setup();
    const cards = panel!.element.querySelectorAll('.echo-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('12 registros de combustão');
    expect(cards[0].textContent).toContain('8 s após o jato');
    expect(cards[1].textContent).toContain('3 registros de corrente');
    expect(cards[1].textContent).toContain('até 4 inimigos');
    expect(panel!.element.textContent).toContain('ECHOES 2.0');
  });
  it('keyboard chooses once and disappears only after a deliberate choice', () => {
    const state = setup();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true }));
    expect(panel!.consume()).toEqual({ choose: 1, choiceKind: 'echo' });
    expect(panel!.consume()).toBeNull();
    panel!.update(state);
    expect(panel!.element.hidden).toBe(true);
  });
  it('KEEP is an explicit command and leaving range cancels a stale panel', () => {
    const state = setup();
    (panel!.element.querySelector('.echo-keep') as HTMLButtonElement).click();
    expect(panel!.consume()).toEqual({ choose: null, choiceKind: 'echo' });
    state.player.x += 30;
    panel!.update(state);
    expect(panel!.element.hidden).toBe(true);
  });
  it('does not invent a reaction for the teaching fallback or accept a missing card', () => {
    setup(false);
    expect(panel!.element.textContent).toContain('Não exige ações anteriores');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2' }));
    expect(panel!.consume()).toBeNull();
  });
  it('does not intercept typing or show through the pause menu', () => {
    const state = setup();
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true }));
    expect(panel!.consume()).toBeNull();
    panel!.update(state, false, true);
    expect(panel!.element.hidden).toBe(true);
  });
});
