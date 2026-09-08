// OS ACENTOS MATERIAIS da barra de vida dos chefes — um por arquetipo.
//
// A vida e SEMPRE `PAL.blood`. E a leitura universal: em qualquer sala, em
// qualquer bioma, vermelho comprido no rodape e "a vida do chefe". O que muda
// de chefe para chefe e um acento discreto — a cor da moldura, a linha sob o
// nome, o pulso de entrada e a varredura de fase — tirado do MATERIAL que
// define a criatura: o basalto do Guardiao, o biofluido do Bispo, o Aurix do
// Diamandis, a agua abissal do Leviata. Nada aqui recolore a vida.
//
// Uma tabela declarativa, e nao condicionais espalhadas pelo desenho: o chefe
// novo entra numa linha, e o compilador cobra a linha (`Record` fechado sobre
// os arquetipos de chefe). `bossBarAccent` devolve o acento neutro de osso
// para qualquer arquetipo fora da tabela, para que um chefe conceitual que
// ganhe corpo amanha apareca com moldura antes de ganhar acento.

import type { BOSS_ARCHETYPES, EnemyArchetype } from '@voxelyn/survival-sim';
import { PAL, mixHex, scaleHex } from './palette';
import type { MessageKey } from './i18n';

/**
 * A FAMILIA sonora do material — a pequena cauda do som de entrada.
 *
 * Seis familias, e nao dez vozes: o que o ouvido separa e pedra de metal, e
 * cristal de agua. Um Guardiao e um Pulmao-Matriz sao ambos "mineral" para o
 * som mesmo sendo basalto e enxofre para a cor.
 */
export type BossBarTail = 'mineral' | 'metal' | 'crystal' | 'fluid' | 'ember' | 'ice';

export type BossBarAccent = {
  /** A chave i18n do par de materiais (`bossBar.material.*`); a galeria a mostra ao lado do nome. */
  materialKey: MessageKey;
  /** A cor do acento: linha sob o nome, chips da moldura, varredura de fase. */
  accent: string;
  /** O brilho do pulso de entrada e do eco de cura — uma versao mais clara do acento. */
  glow: string;
  /** A cor de base da moldura (osso, metal escuro ou ardosia), ja misturada com o acento. */
  frame: string;
  /** A face mais clara da moldura — a "chapa" de cima. */
  frameLight: string;
  /** A face escura — a sombra dos encaixes e das terminacoes. */
  frameDark: string;
  /** A familia da cauda sonora. */
  tail: BossBarTail;
};

/** A cor da vida, em todos os chefes. Exportada para o teste cobrar que nao muda. */
export const BOSS_BAR_LIFE = PAL.blood;
/** A face superior da vida: um degrau mais claro, ainda inequivocamente sangue. */
export const BOSS_BAR_LIFE_LIGHT = mixHex(PAL.blood, '#ffffff', 0.16);
/** A face inferior da vida: um degrau mais escuro. */
export const BOSS_BAR_LIFE_DARK = scaleHex(PAL.blood, 0.62);
/**
 * O ECO DA FERIDA: osso manchado de sangue. Mais claro que a vida e mais
 * apagado que ela — nunca amarelo, nunca brilhante, nunca mais importante que
 * o que ainda esta vivo.
 */
export const BOSS_BAR_ECHO = mixHex(PAL.blood, PAL.bone, 0.55);
/** O leito vazio: quase preto, um tom abaixo do fundo da tela. */
export const BOSS_BAR_BED = '#07090d';

/** Materiais que a paleta mestra nao nomeia mas que o mundo ja usa. */
const BASALT = '#3a3f4a';
const AURIX = '#4fd8c8';
const IVORY_SILICA = '#e3d9c4';
const PRISM = '#c9a6ff';
const ABYSS = '#123a55';
const SULFUR = '#d9c34a';
const EMBER = '#ff9a3c';
const COAL = '#1a1714';
const WHITE_ICE = '#dbeeff';
const IRON = '#5b6270';

const slate = (accent: string, amount: number): Omit<BossBarAccent, 'materialKey' | 'tail'> => {
  const frame = mixHex(PAL.rockShadow, accent, amount);
  return {
    accent,
    glow: mixHex(accent, '#ffffff', 0.35),
    frame,
    frameLight: mixHex(frame, '#ffffff', 0.18),
    frameDark: scaleHex(frame, 0.55),
  };
};

const boneFrame = (accent: string, amount: number): Omit<BossBarAccent, 'materialKey' | 'tail'> => {
  const frame = mixHex(mixHex(PAL.bone, PAL.rockShadow, 0.55), accent, amount);
  return {
    accent,
    glow: mixHex(accent, '#ffffff', 0.35),
    frame,
    frameLight: mixHex(frame, '#ffffff', 0.2),
    frameDark: scaleHex(frame, 0.5),
  };
};

const metalFrame = (
  accent: string,
  amount: number,
): Omit<BossBarAccent, 'materialKey' | 'tail'> => {
  const frame = mixHex(IRON, accent, amount);
  return {
    accent,
    glow: mixHex(accent, '#ffffff', 0.4),
    frame: scaleHex(frame, 0.8),
    frameLight: mixHex(frame, '#ffffff', 0.22),
    frameDark: scaleHex(frame, 0.45),
  };
};

/** O acento de quem nao esta na tabela: osso e ardosia, sem cor de bioma. */
export const NEUTRAL_BOSS_BAR_ACCENT: BossBarAccent = {
  materialKey: 'bossBar.material.neutral',
  tail: 'mineral',
  ...boneFrame(PAL.bone, 0.2),
};

type BossArchetype = (typeof BOSS_ARCHETYPES)[number];

const ACCENTS: Record<string, BossBarAccent> = {
  guardian: {
    materialKey: 'bossBar.material.guardian',
    tail: 'mineral',
    ...boneFrame(BASALT, 0.35),
  },
  bishop: { materialKey: 'bossBar.material.bishop', tail: 'fluid', ...slate(PAL.biolum, 0.2) },
  diamandis: {
    materialKey: 'bossBar.material.diamandis',
    tail: 'metal',
    ...metalFrame(AURIX, 0.25),
  },
  white_devourer: {
    materialKey: 'bossBar.material.white_devourer',
    tail: 'mineral',
    ...boneFrame(IVORY_SILICA, 0.45),
  },
  archcantor: {
    materialKey: 'bossBar.material.archcantor',
    tail: 'crystal',
    ...slate(PRISM, 0.25),
  },
  sheet_leviathan: {
    materialKey: 'bossBar.material.sheet_leviathan',
    tail: 'fluid',
    ...slate(PAL.electric, 0.18),
    frame: mixHex(PAL.rockShadow, ABYSS, 0.6),
  },
  lung_matrix: {
    materialKey: 'bossBar.material.lung_matrix',
    tail: 'mineral',
    ...boneFrame(SULFUR, 0.22),
  },
  furnace_heart: {
    materialKey: 'bossBar.material.furnace_heart',
    tail: 'ember',
    ...slate(EMBER, 0.14),
    frame: mixHex(COAL, PAL.rockShadow, 0.35),
  },
  frost_queen: {
    materialKey: 'bossBar.material.frost_queen',
    tail: 'ice',
    ...slate(WHITE_ICE, 0.3),
  },
  seamstress: {
    materialKey: 'bossBar.material.seamstress',
    tail: 'mineral',
    ...slate(PAL.bone, 0.3),
  },
  magnetarch: {
    materialKey: 'bossBar.material.magnetarch',
    tail: 'metal',
    ...metalFrame(PAL.rust, 0.5),
    glow: mixHex(PAL.electric, '#ffffff', 0.2),
  },
};

/**
 * O acento do chefe, ou o neutro.
 *
 * Aceita `string` e nao so `EnemyArchetype` porque o espelho online devolve o
 * arquetipo como veio do wire; a tabela e quem decide se o conhece.
 */
export const bossBarAccent = (
  archetype: EnemyArchetype | string | null | undefined,
): BossBarAccent => (archetype && ACCENTS[archetype]) || NEUTRAL_BOSS_BAR_ACCENT;

/** Tem acento PROPRIO (nao o neutro)? Para o teste cobrar a tabela completa. */
export const hasBossBarAccent = (archetype: BossArchetype | string): boolean =>
  Object.prototype.hasOwnProperty.call(ACCENTS, archetype);

/**
 * Uma semente estavel por arquetipo, para o DESGASTE da moldura: os entalhes
 * assimetricos sao os mesmos toda vez que o mesmo chefe aparece — uma moldura
 * que mudasse de arranhoes a cada despertar pareceria ruido, nao uso.
 */
export const bossBarSeed = (archetype: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < archetype.length; i++) {
    h ^= archetype.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};
