// Como cada habilidade se apresenta ao jogador.
//
// Vive no cliente pelo mesmo motivo que `module-presentation.ts`: a simulação
// decide o que a habilidade FAZ, e nomear é decisão de apresentação. Um rótulo
// dentro do sim viajaria no wire por nada e amarraria texto a hash.
//
import {
  abilityDefinition,
  ABILITY_SHAPE,
  TICK_HZ,
  FLAMETHROWER_CHANNEL_TICKS,
  FLAMETHROWER_EMISSION_DAMAGE,
  FLAMETHROWER_EMIT_INTERVAL_TICKS,
  FLAMETHROWER_GUARD_TICKS,
  DODGE_SPEED,
  type EchoUnlock,
  type SurvivalState,
  type AbilityId,
  type ResonanceKind,
} from '@voxelyn/survival-sim';
import { t, type MessageKey } from './i18n';

export type AbilityPresentation = {
  label: string;
  hint: string;
  /** A reação que ensinou esta habilidade, na voz do Veio. */
  origin: string;
  color: string;
};

/** A cor é da habilidade; o resto é do catálogo. */
type AbilityStatic = { label: MessageKey; hint: MessageKey; origin: MessageKey; color: string };

const PRESENTATION: Record<AbilityId, AbilityStatic> = {
  pulse: {
    label: 'ability.pulse.label',
    hint: 'ability.pulse.hint',
    origin: 'ability.pulse.origin',
    color: '#e8f1ff',
  },
  flamethrower: {
    label: 'ability.flamethrower.label',
    hint: 'ability.flamethrower.hint',
    origin: 'ability.flamethrower.origin',
    color: '#ff7a2f',
  },
  seeker: {
    label: 'ability.seeker.label',
    hint: 'ability.seeker.hint',
    origin: 'ability.seeker.origin',
    color: '#7ab8ff',
  },
  arc: {
    label: 'ability.arc.label',
    hint: 'ability.arc.hint',
    origin: 'ability.arc.origin',
    color: '#59f2c2',
  },
  seismic: {
    label: 'ability.seismic.label',
    hint: 'ability.seismic.hint',
    origin: 'ability.seismic.origin',
    color: '#e6b16b',
  },
  slipstream: {
    label: 'ability.slipstream.label',
    hint: 'ability.slipstream.hint',
    origin: 'ability.slipstream.origin',
    color: '#b8a0ff',
  },
  vent: {
    label: 'ability.vent.label',
    hint: 'ability.vent.hint',
    origin: 'ability.vent.origin',
    color: '#81dbe9',
  },
};

export const abilityPresentation = (id: AbilityId): AbilityPresentation => {
  const spec = PRESENTATION[id];
  return {
    label: t(spec.label),
    hint: t(spec.hint),
    origin: t(spec.origin),
    color: spec.color,
  };
};

/** O nome que o Veio dá à reação registrada, para o painel de ressonância. */
const RESONANCE_KEYS: Record<ResonanceKind, MessageKey> = {
  fire: 'resonance.fire',
  current: 'resonance.current',
  blast: 'resonance.blast',
  kinetic: 'resonance.kinetic',
  evasion: 'resonance.evasion',
  purge: 'resonance.purge',
};

export const resonanceLabel = (kind: ResonanceKind): string => t(RESONANCE_KEYS[kind]);

const EFFECT_KEYS: Record<AbilityId, MessageKey> = {
  pulse: 'ability.pulse.effect',
  flamethrower: 'ability.flamethrower.effect',
  seeker: 'ability.seeker.effect',
  arc: 'ability.arc.effect',
  seismic: 'ability.seismic.effect',
  slipstream: 'ability.slipstream.effect',
  vent: 'ability.vent.effect',
};
const UNLOCK_KEYS: Record<EchoUnlock['kind'], MessageKey> = {
  fire: 'ability.unlock.fire',
  current: 'ability.unlock.current',
  blast: 'ability.unlock.blast',
  kinetic: 'ability.unlock.kinetic',
  evasion: 'ability.unlock.evasion',
  purge: 'ability.unlock.purge',
  first_descent: 'ability.unlock.first',
};
export const echoUnlockText = (unlock: EchoUnlock): string =>
  t(UNLOCK_KEYS[unlock.kind], { count: unlock.amount, required: unlock.required });
const number = (n: number): string => String(Math.round(n * 10) / 10);
export const abilityDetails = (
  id: AbilityId,
  tuning: SurvivalState['config']['tuning'],
): { effect: string; cooldown: string } => {
  const shape = ABILITY_SHAPE;
  const params = {
    radius: number(
      id === 'seismic'
        ? shape.seismic.radius
        : id === 'vent'
          ? shape.vent.radius
          : shape.pulse.radius,
    ),
    damage: number(
      (id === 'arc'
        ? shape.arc.damage
        : id === 'seismic'
          ? shape.seismic.damage
          : shape.seeker.damage) * tuning.playerDamageScale,
    ),
    range: number(id === 'arc' ? shape.arc.range : shape.flamethrower.range),
    targets: shape.arc.maxTargets,
    duration: number(FLAMETHROWER_CHANNEL_TICKS / TICK_HZ),
    totalDamage: number(
      (FLAMETHROWER_CHANNEL_TICKS / FLAMETHROWER_EMIT_INTERVAL_TICKS) *
        FLAMETHROWER_EMISSION_DAMAGE *
        tuning.playerDamageScale,
    ),
    guard: number(FLAMETHROWER_GUARD_TICKS / TICK_HZ),
    dash: number((shape.slipstream.ticks * DODGE_SPEED) / TICK_HZ),
    dashTime: number(shape.slipstream.ticks / TICK_HZ),
    stun: number(shape.seismic.stun / TICK_HZ),
  };
  return {
    effect: t(EFFECT_KEYS[id], params),
    cooldown: t(id === 'flamethrower' ? 'ability.cooldown.after' : 'ability.cooldown', {
      seconds: number(
        Math.round(abilityDefinition(id).cooldownTicks * tuning.abilityCooldownScale) / TICK_HZ,
      ),
    }),
  };
};
