import { MODULE_DEFINITIONS, type ModuleId } from '@voxelyn/survival-sim';
import { t, type MessageKey } from './i18n';

export type ModulePresentation = {
  label: string;
  shortDescription: string;
  risk: 'safe' | 'volatile';
  lifetimeLabel: string;
};

/**
 * O que e do modulo e nao muda com a lingua: o risco.
 *
 * (O antigo campo `icon` era metadado morto: nem a HUD nem o terminal de
 * recuperacao o liam — ambos desenham pela PROPRIA ModuleId, o glifo em
 * drawModuleGlyph e o cartucho em module-hardware.ts. Saiu de proposito em
 * vez de ganhar mais uma abstracao sem leitor.)
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
  risk: 'safe' | 'volatile';
};

const MODULES: Record<ModuleId, ModuleStatic> = {
  piercing: {
    label: 'module.piercing.label',
    description: 'module.piercing.description',
    proc: 'module.piercing.proc',
    risk: 'safe',
  },
  conductive: {
    label: 'module.conductive.label',
    description: 'module.conductive.description',
    proc: 'module.conductive.proc',
    risk: 'safe',
  },
  explosive: {
    label: 'module.explosive.label',
    description: 'module.explosive.description',
    proc: 'module.explosive.proc',
    risk: 'volatile',
  },
  siphon: {
    label: 'module.siphon.label',
    description: 'module.siphon.description',
    proc: 'module.siphon.proc',
    risk: 'safe',
  },
  ricochet: {
    label: 'module.ricochet.label',
    description: 'module.ricochet.description',
    proc: 'module.ricochet.proc',
    risk: 'safe',
  },
  return_disc: {
    label: 'module.return_disc.label',
    description: 'module.return_disc.description',
    proc: 'module.return_disc.proc',
    risk: 'safe',
  },
  /**
   * MINIGUN e `safe` mesmo sendo a coisa mais forte da bancada.
   *
   * `risk` neste arquivo significa UMA coisa: o modulo pode matar o proprio
   * Prospector? Explosivo pode. A Minigun nao — o que ela cobra e calor, e
   * calor ja e o vermelho do HUD. Marca-la de volatil so porque ela e
   * poderosa apagaria a unica leitura que o selo tem: hoje, um selo laranja
   * num card significa exatamente "isto pode te matar".
   */
  minigun: {
    label: 'module.minigun.label',
    description: 'module.minigun.description',
    proc: 'module.minigun.proc',
    risk: 'safe',
  },
  /**
   * As duas armas de tier 2 sao `safe` pelo mesmo criterio da Minigun: `risk`
   * aqui responde UMA pergunta — o modulo pode matar o proprio Prospector? — e
   * nenhuma das duas pode. O Bacamarte cobra POSICAO, que e outra coisa: quem
   * paga por ela e a barra de vida, e a barra de vida ja esta na tela.
   */
  prospect_lance: {
    label: 'module.prospect_lance.label',
    description: 'module.prospect_lance.description',
    proc: 'module.prospect_lance.proc',
    risk: 'safe',
  },
  blunderbuss: {
    label: 'module.blunderbuss.label',
    description: 'module.blunderbuss.description',
    proc: 'module.blunderbuss.proc',
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
    risk: module.risk,
    lifetimeLabel,
  };
};
