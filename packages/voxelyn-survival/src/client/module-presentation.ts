import { MODULE_DEFINITIONS, type ModuleId } from '@voxelyn/survival-sim';

export type ModulePresentation = {
  label: string;
  shortDescription: string;
  icon: string;
  risk: 'safe' | 'volatile';
  lifetimeLabel: string;
};

const LABELS: Record<ModuleId, Omit<ModulePresentation, 'lifetimeLabel'>> = {
  piercing: {
    label: 'PIERCING',
    shortDescription: 'Perfura alvos sem repetir dano durante a travessia.',
    icon: 'modulePiercing',
    risk: 'safe',
  },
  conductive: {
    label: 'CONDUCTIVE',
    shortDescription: 'Descarrega biofluido e materiais conectados.',
    icon: 'moduleConductive',
    risk: 'safe',
  },
  explosive: {
    label: 'EXPLOSIVE',
    shortDescription: 'Detona impactos armados em uma área. Perigoso a curta distância.',
    icon: 'moduleExplosive',
    risk: 'volatile',
  },
  siphon: {
    label: 'SIPHON',
    shortDescription: 'Recupera 2 HP quando um acerto útil é drenado.',
    icon: 'moduleSiphon',
    risk: 'safe',
  },
  ricochet: {
    label: 'RICOCHET LENS',
    shortDescription: 'Faz o bolt rebater uma vez em uma superfície sólida.',
    icon: 'moduleRicochet',
    risk: 'safe',
  },
  return_disc: {
    label: 'RETURN DISC',
    shortDescription: 'Causa dano na ida e retorna perseguindo o Prospector.',
    icon: 'moduleReturnDisc',
    risk: 'safe',
  },
};

/**
 * O que a carga CONTA. Nenhum modulo cobra o disparo: a carga sai quando o
 * efeito acontece, entao o rotulo tem de nomear o efeito, e nao o gatilho.
 * `piercing` e `ricochet` diziam "DISPAROS" quando ainda cobravam no gatilho —
 * manter isso agora seria mentir sobre o que o jogador esta gastando.
 */
const PROC_LABELS: Record<ModuleId, string> = {
  piercing: 'TRAVESSIAS',
  conductive: 'DESCARGAS',
  explosive: 'EXPLOSÕES',
  siphon: 'DRENAGENS',
  ricochet: 'REBOTES',
  return_disc: 'RETORNOS',
};

export const modulePresentation = (id: ModuleId): ModulePresentation => {
  const def = MODULE_DEFINITIONS[id];
  const lifetimeLabel = def.lifetime === 'charges'
    ? `${def.defaultCharges ?? 0} ${PROC_LABELS[id]}`
    : `${Math.round((def.durationTicks ?? 0) / 20)}s`;
  return { ...LABELS[id], lifetimeLabel };
};
