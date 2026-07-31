import { MODULE_DEFINITIONS, type ModuleId } from '@voxelyn/survival-sim';
import { t, type MessageKey } from './i18n';

export type ModulePresentation = {
  label: string;
  shortDescription: string;
  icon: string;
  risk: 'safe' | 'volatile';
  lifetimeLabel: string;
};

/**
 * O que e do modulo e nao muda com a lingua: icone e risco.
 *
 * Rotulo e descricao saem do catalogo, e por isso este mapa guarda CHAVES em
 * vez de frases — a tabela e uma constante de modulo, avaliada uma vez no
 * import, e um texto resolvido aqui ficaria congelado na lingua com que o jogo
 * abriu. Os cards de escolha sao redesenhados a cada quadro; resolver ali custa
 * uma busca em objeto e mantem a troca de idioma valendo no meio da run.
 */
type ModuleStatic = {
  label: MessageKey;
  description: MessageKey;
  proc: MessageKey;
  icon: string;
  risk: 'safe' | 'volatile';
};

const MODULES: Record<ModuleId, ModuleStatic> = {
  piercing: {
    label: 'module.piercing.label',
    description: 'module.piercing.description',
    proc: 'module.piercing.proc',
    icon: 'modulePiercing',
    risk: 'safe',
  },
  conductive: {
    label: 'module.conductive.label',
    description: 'module.conductive.description',
    proc: 'module.conductive.proc',
    icon: 'moduleConductive',
    risk: 'safe',
  },
  explosive: {
    label: 'module.explosive.label',
    description: 'module.explosive.description',
    proc: 'module.explosive.proc',
    icon: 'moduleExplosive',
    risk: 'volatile',
  },
  siphon: {
    label: 'module.siphon.label',
    description: 'module.siphon.description',
    proc: 'module.siphon.proc',
    icon: 'moduleSiphon',
    risk: 'safe',
  },
  ricochet: {
    label: 'module.ricochet.label',
    description: 'module.ricochet.description',
    proc: 'module.ricochet.proc',
    icon: 'moduleRicochet',
    risk: 'safe',
  },
  return_disc: {
    label: 'module.return_disc.label',
    description: 'module.return_disc.description',
    proc: 'module.return_disc.proc',
    icon: 'moduleReturnDisc',
    risk: 'safe',
  },
};

/**
 * O rotulo da carga CONTA o efeito, nao o gatilho. Nenhum modulo cobra o
 * disparo: a carga sai quando o efeito acontece. `piercing` e `ricochet` diziam
 * "DISPAROS" quando ainda cobravam no gatilho — manter isso agora seria mentir
 * sobre o que o jogador esta gastando, em qualquer lingua.
 */
export const modulePresentation = (id: ModuleId): ModulePresentation => {
  const def = MODULE_DEFINITIONS[id];
  const module = MODULES[id];
  const lifetimeLabel =
    def.lifetime === 'charges'
      ? t('module.lifetime.charges', {
          count: def.defaultCharges ?? 0,
          proc: t(module.proc),
        })
      : t('module.lifetime.duration', { seconds: Math.round((def.durationTicks ?? 0) / 20) });
  return {
    label: t(module.label),
    shortDescription: t(module.description),
    icon: module.icon,
    risk: module.risk,
    lifetimeLabel,
  };
};
