// Como cada habilidade se apresenta ao jogador.
//
// Vive no cliente pelo mesmo motivo que `module-presentation.ts`: a simulação
// decide o que a habilidade FAZ, e nomear é decisão de apresentação. Um rótulo
// dentro do sim viajaria no wire por nada e amarraria texto a hash.
//
// O `hint` não descreve o efeito — descreve QUANDO usar. "Cone de fogo" o jogador
// vê sozinho na primeira vez; o que ele não vê é que a chama fica no chão e que
// isso resolve corredor, não campo aberto. A tradução carrega essa regra: uma
// versão que descreve o efeito em vez do momento é uma tradução errada, mesmo
// que cada palavra esteja certa.

import type { AbilityId, ResonanceKind } from '@voxelyn/survival-sim';
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
};

export const resonanceLabel = (kind: ResonanceKind): string => t(RESONANCE_KEYS[kind]);
