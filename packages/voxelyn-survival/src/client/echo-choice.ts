import { canChooseEcho, type PlayerCommand, type SurvivalState } from '@voxelyn/survival-sim';
import { abilityDetails, abilityPresentation, echoUnlockText } from './ability-presentation';
import { abilityIconSvg } from './ability-icons';
import { getLocale, t } from './i18n';
import {
  MOVE_JOYSTICK_RADIUS,
  isEditingText,
  touchControlGeometry,
  type TouchSafeArea,
} from './input';
import './echo-choice.css';

type EchoCommand = Pick<PlayerCommand, 'choose' | 'choiceKind'>;
const text = (tag: string, className: string, content: string): HTMLElement => {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = content;
  return el;
};

/** Presentation only. Every action is queued into the recorded/validated command stream. */
export class EchoChoicePanel {
  readonly element = document.createElement('section');
  private signature = '';
  private pending: EchoCommand | null = null;
  private submitted = '';
  private choices = 0;
  private focusBeforeOpen: HTMLElement | null = null;
  private safeArea: Partial<Pick<TouchSafeArea, 'left' | 'right' | 'bottom'>> = {};

  constructor() {
    this.element.className = 'echo-choice';
    this.element.hidden = true;
    this.element.setAttribute('aria-labelledby', 'echo-choice-title');
    // Canvas input never receives card pointers, so choosing cannot also aim/fire.
    this.element.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.element.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
    });
    window.addEventListener('keydown', this.onKey, true);
    document.body.append(this.element);
  }

  private onKey = (event: KeyboardEvent): void => {
    if (this.element.hidden || event.repeat || event.ctrlKey || event.altKey || event.metaKey)
      return;
    if (isEditingText(event.target)) return;
    const index =
      event.code === 'Digit1' || event.code === 'Numpad1'
        ? 0
        : event.code === 'Digit2' || event.code === 'Numpad2'
          ? 1
          : -1;
    if (index < 0 || index >= this.choices) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.select(index as 0 | 1);
  };

  private select(index: 0 | 1 | null): void {
    this.pending = { choose: index, choiceKind: 'echo' };
    this.submitted = this.signature;
    this.element.hidden = true;
    this.restoreFocus();
  }

  consume(): EchoCommand | null {
    const command = this.pending;
    this.pending = null;
    return command;
  }

  private restoreFocus(): void {
    if (this.element.contains(document.activeElement))
      this.focusBeforeOpen?.focus({ preventScroll: true });
  }

  /** A mesma area segura que posiciona os controles de toque (main.ts, resize). */
  setSafeArea(safe: Partial<Pick<TouchSafeArea, 'left' | 'right' | 'bottom'>>): void {
    this.safeArea = safe;
  }

  /**
   * Em PAISAGEM com toque o painel vive na FAIXA entre o joystick de movimento
   * (esquerda) e o aglomerado de botoes de acao (direita), e nao numa margem
   * fixa: a largura desse aglomerado depende da tela (raio e passo dos botoes
   * escalam com a altura), e 150 px de recuo cobriam o botao de habilidade em
   * qualquer celular largo. A conta e a MESMA de `touchControlGeometry`, entao
   * o painel e os botoes nunca discordam sobre onde cada um esta. Fora desse
   * caso o CSS decide sozinho.
   */
  private layoutLane(touch: boolean): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const style = this.element.style;
    if (!touch || width <= height) {
      style.removeProperty('--echo-lane-left');
      style.removeProperty('--echo-lane-right');
      delete this.element.dataset.lane;
      return;
    }
    const g = touchControlGeometry(width, height, this.safeArea);
    // Folga visual (o desenho do controle), nao a area de toque: o painel
    // engole os toques que caem nele, entao a zona de ativacao pode ficar
    // por baixo; o que nao pode e o DESENHO do botao sumir atras do card.
    const left = Math.round(g.moveX + MOVE_JOYSTICK_RADIUS + 10);
    const right = Math.round(width - (g.aimX - g.step * 2 - g.buttonRadius) + 10);
    style.setProperty('--echo-lane-left', `${left}px`);
    style.setProperty('--echo-lane-right', `${right}px`);
    this.element.dataset.lane = width - left - right < 320 ? 'narrow' : 'wide';
  }

  hide(): void {
    this.restoreFocus();
    this.element.hidden = true;
    this.signature = '';
    this.submitted = '';
    this.pending = null;
  }

  update(state: SurvivalState, touch = false, blocked = false): void {
    if (blocked || !canChooseEcho(state)) {
      this.hide();
      return;
    }
    const signature = JSON.stringify([
      state.config.seed,
      state.sector,
      state.wellOffers,
      state.playerExtra.ability,
      state.config.tuning.playerDamageScale,
      state.config.tuning.abilityCooldownScale,
      getLocale(),
    ]);
    this.element.dataset.touch = String(touch);
    this.layoutLane(touch);
    if (signature === this.submitted) return;
    if (signature === this.signature) {
      this.element.hidden = false;
      return;
    }
    this.signature = signature;
    this.submitted = '';
    this.focusBeforeOpen = document.activeElement as HTMLElement | null;
    this.element.replaceChildren();
    this.element.hidden = false;

    const header = document.createElement('header');
    header.append(text('p', 'echo-eyebrow', t('ability.choice.sector', { sector: state.sector })));
    const title = text('h2', 'echo-title', t('ability.choice.title'));
    title.id = 'echo-choice-title';
    header.append(title, text('p', 'echo-subtitle', t('ability.choice.subtitle')));
    this.element.append(header);

    const cards = text('div', 'echo-cards', '');
    this.choices = state.wellOffers.length;
    state.wellOffers.forEach((offer, index) => {
      if (offer.takenBy !== null) return;
      const spec = abilityPresentation(offer.ability),
        details = abilityDetails(offer.ability, state.config.tuning);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'echo-card';
      card.style.setProperty('--echo-accent', spec.color);
      const icon = text('span', 'echo-icon', '');
      icon.innerHTML = abilityIconSvg(offer.ability);
      const top = text('span', 'echo-card-top', '');
      const names = text('span', 'echo-card-names', '');
      names.append(
        text('strong', 'echo-name', spec.label),
        text('span', 'echo-cooldown', details.cooldown),
      );
      top.append(icon, names);
      card.append(
        top,
        text('span', 'echo-effect', details.effect),
        text('span', 'echo-hint', spec.hint),
      );
      const why = text('span', 'echo-unlock', '');
      why.append(
        text('strong', '', t('ability.choice.why')),
        text('span', '', echoUnlockText(offer.unlock)),
      );
      if (state.config.playerCount > 1)
        why.append(
          text('span', 'echo-owner', t('ability.choice.shared', { slot: offer.unlock.slot + 1 })),
        );
      card.append(why, text('span', 'echo-cta', t('ability.choice.select', { key: index + 1 })));
      card.addEventListener('click', () => this.select(index as 0 | 1));
      cards.append(card);
    });
    this.element.append(cards);
    const current = abilityPresentation(state.playerExtra.ability);
    const footer = document.createElement('footer');
    const keep = document.createElement('button');
    keep.type = 'button';
    keep.className = 'echo-keep';
    keep.textContent = t('ability.choice.keep', { ability: current.label });
    keep.addEventListener('click', () => this.select(null));
    footer.append(keep, text('p', 'echo-live', t('ability.choice.live')));
    this.element.append(footer);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.element.remove();
  }
}
