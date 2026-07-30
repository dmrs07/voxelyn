// Como cada habilidade se apresenta ao jogador.
//
// Vive no cliente pelo mesmo motivo que `module-presentation.ts`: a simulação
// decide o que a habilidade FAZ, e nomear é decisão de apresentação. Um rótulo
// dentro do sim viajaria no wire por nada e amarraria texto a hash.
//
// O `hint` não descreve o efeito — descreve QUANDO usar. "Cone de fogo" o jogador
// vê sozinho na primeira vez; o que ele não vê é que a chama fica no chão e que
// isso resolve corredor, não campo aberto.

import type { AbilityId, ResonanceKind } from '@voxelyn/survival-sim';

export type AbilityPresentation = {
  label: string;
  hint: string;
  /** A reação que ensinou esta habilidade, na voz do Veio. */
  origin: string;
  color: string;
};

const PRESENTATION: Record<AbilityId, AbilityPresentation> = {
  pulse: {
    label: 'PULSO CINÉTICO',
    hint: 'Empurra e dissipa nuvem. É a saída quando algo já está colado em você.',
    origin: 'Equipamento padrão de prospecção.',
    color: '#e8f1ff',
  },
  flamethrower: {
    label: 'SOPRO TÉRMICO',
    hint: 'A chama FICA no chão. Vale em corredor, e vira armadilha no seu recuo.',
    origin: 'O Veio ouviu você secar e queimar o que encontrou.',
    color: '#ff7a2f',
  },
  seeker: {
    label: 'LANÇA RASTREADORA',
    hint: 'Um só, com curva lenta. Solte quando o alvo já se comprometeu com uma direção.',
    origin: 'O Veio ouviu você detonar o que encontrou.',
    color: '#7ab8ff',
  },
  arc: {
    label: 'ARCO CONDUTIVO',
    hint: 'Salta entre corpos próximos e não precisa de poça. Grupo colado é o alvo.',
    origin: 'O Veio ouviu você eletrificar o que encontrou.',
    color: '#59f2c2',
  },
};

export const abilityPresentation = (id: AbilityId): AbilityPresentation => PRESENTATION[id];

/** O nome que o Veio dá à reação registrada, para o painel de ressonância. */
export const RESONANCE_LABELS: Record<ResonanceKind, string> = {
  fire: 'COMBUSTÃO',
  current: 'CORRENTE',
  blast: 'ESTOURO',
  kinetic: 'IMPACTO',
};
