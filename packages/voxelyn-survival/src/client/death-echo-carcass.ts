// O que sobrou do corpo, por tipo de morte.
//
// A cápsula já guardava a causa autoritativa, mas a carcaça era sempre a mesma
// silhueta enferrujada: fogo, descarga e Britador chegavam ao jogador como o
// mesmo objeto. A causa só ensina quando o CORPO diz o que aconteceu antes de
// qualquer texto — a mesma regra que rege `describeCause` na tela de fim.
//
// Nada aqui inventa geometria. A variante decide cor, material e os cacos ao
// redor do corpo; ela nunca move a carcaça, nunca ocupa outra célula e nunca
// altera o mapa. Os cacos são deslocamentos em fração de tile a partir do pé do
// corpo, e o renderer os converte com o zoom do quadro.

import type { DamageCause } from '@voxelyn/survival-sim';
import { t, type MessageKey } from './i18n';

// Paleta da art bible (docs/art/voxelyn-survival-art-bible.md). Repetida aqui
// pela mesma razão que em `voxel-fallback.ts`: este módulo desenha matéria e não
// pode depender do renderer, que já depende dele.
const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rust: '#6e4a33',
  bone: '#b8a98f',
  fungus: '#2f6b4f',
  fungusLight: '#66c28a',
  biolum: '#59f2c2',
  acid: '#a8e63c',
  fire: '#ff7a2f',
  electric: '#7ab8ff',
};

export type CarcassKind =
  | 'scorched'
  | 'arced'
  | 'ruptured'
  | 'crushed'
  | 'dissolved'
  | 'overgrown'
  | 'intact';

/** Um caco no chão, em frações de tile a partir do pé da carcaça. */
export type CarcassDebris = {
  dx: number;
  dy: number;
  size: number;
  color: string;
};

export type CarcassVariant = {
  kind: CarcassKind;
  /**
   * Estado do corpo na voz da empresa.
   *
   * Substantivo de laudo, nunca de luto: a companhia registra material perdido.
   * Chave e nao frase: as variantes sao constantes de modulo e resolver o texto
   * aqui congelaria a lingua da primeira carga do arquivo.
   */
  condition: MessageKey;
  /** Tint sobre o frame de morte do Prospector. */
  tint: { color: string; alpha: number };
  /** Cor do casco quando o atlas não carregou e o corpo sai em blocos. */
  shell: string;
  debris: readonly CarcassDebris[];
};

const scorched: CarcassVariant = {
  kind: 'scorched',
  condition: 'echo.condition.scorched',
  tint: { color: 'rgba(24,20,18,0.74)', alpha: 0.74 },
  shell: PAL.dark,
  debris: [
    { dx: -0.42, dy: 0.1, size: 0.16, color: PAL.fire },
    { dx: 0.34, dy: -0.08, size: 0.12, color: PAL.fire },
    { dx: 0.06, dy: 0.26, size: 0.2, color: '#2a1a12' },
  ],
};

const arced: CarcassVariant = {
  kind: 'arced',
  condition: 'echo.condition.arced',
  tint: { color: 'rgba(122,184,255,0.55)', alpha: 0.55 },
  shell: PAL.rock,
  debris: [
    { dx: -0.5, dy: 0.04, size: 0.1, color: PAL.electric },
    { dx: 0.46, dy: 0.12, size: 0.1, color: PAL.electric },
    { dx: -0.1, dy: -0.24, size: 0.08, color: PAL.biolum },
  ],
};

const ruptured: CarcassVariant = {
  kind: 'ruptured',
  condition: 'echo.condition.ruptured',
  tint: { color: 'rgba(110,74,51,0.6)', alpha: 0.6 },
  shell: PAL.rust,
  debris: [
    { dx: -0.62, dy: 0.18, size: 0.18, color: PAL.rust },
    { dx: 0.58, dy: 0.02, size: 0.16, color: PAL.rockShadow },
    { dx: 0.2, dy: 0.4, size: 0.14, color: PAL.rust },
    { dx: -0.28, dy: -0.3, size: 0.12, color: PAL.bone },
  ],
};

const crushed: CarcassVariant = {
  kind: 'crushed',
  condition: 'echo.condition.crushed',
  tint: { color: 'rgba(46,58,77,0.66)', alpha: 0.66 },
  shell: PAL.rockShadow,
  debris: [
    { dx: -0.36, dy: 0.22, size: 0.22, color: PAL.rock },
    { dx: 0.4, dy: 0.16, size: 0.18, color: PAL.rock },
  ],
};

const dissolved: CarcassVariant = {
  kind: 'dissolved',
  condition: 'echo.condition.dissolved',
  tint: { color: 'rgba(168,230,60,0.5)', alpha: 0.5 },
  shell: PAL.fungus,
  debris: [
    { dx: -0.3, dy: 0.2, size: 0.2, color: PAL.acid },
    { dx: 0.32, dy: 0.28, size: 0.16, color: PAL.acid },
    { dx: 0.02, dy: -0.18, size: 0.1, color: PAL.fungusLight },
  ],
};

const overgrown: CarcassVariant = {
  kind: 'overgrown',
  condition: 'echo.condition.overgrown',
  tint: { color: 'rgba(102,194,138,0.52)', alpha: 0.52 },
  shell: PAL.fungus,
  debris: [
    { dx: -0.26, dy: 0.12, size: 0.14, color: PAL.fungusLight },
    { dx: 0.24, dy: 0.24, size: 0.18, color: PAL.fungus },
    { dx: 0.44, dy: -0.06, size: 0.12, color: PAL.fungusLight },
  ],
};

const intact: CarcassVariant = {
  kind: 'intact',
  condition: 'echo.condition.intact',
  tint: { color: 'rgba(110,74,51,0.62)', alpha: 0.62 },
  shell: PAL.rust,
  debris: [{ dx: 0.3, dy: 0.2, size: 0.12, color: PAL.rust }],
};

/**
 * A carcaça que uma causa autoritativa deixa para trás.
 *
 * O `switch` é exaustivo de propósito: uma causa nova na simulação precisa
 * escolher um corpo, e o ramo de recuo existe só para storage de uma versão
 * futura que este cliente ainda não conhece — nunca para economizar um caso.
 */
export const carcassVariant = (cause: DamageCause): CarcassVariant => {
  switch (cause.kind) {
    case 'fire':
    case 'overheat':
      return scorched;
    case 'discharge':
    case 'leviathan_discharge':
      return arced;
    case 'explosion':
      return ruptured;
    // Saturacao e gas sem nuvem: o corpo que ela deixa e o mesmo que o ar
    // dissolve, porque a diferenca entre as duas mortes esta em QUANTO tempo
    // se ficou, e tempo nao muda o que sobra.
    case 'gas':
    case 'contamination':
      return dissolved;
    case 'spores':
      return overgrown;
    case 'enemy_contact':
      return crushed;
    case 'enemy_projectile':
      return cause.projectile === 'rock' ? crushed : dissolved;
    case 'bleedout':
    case 'player_shot':
    case 'unknown':
    default:
      return intact;
  }
};

const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const DESIGNATION_LETTERS = 'ABCDEFGH';

/**
 * O identificador que a empresa dá ao corpo.
 *
 * A ficção resolve aqui um problema real de privacidade: a caixa-preta precisa
 * de um NOME para a leitura funcionar como arqueologia, e nenhum nome de jogador
 * pode ser persistido (invariante 6 da spec). Um serial derivado do id do eco dá
 * identidade sem identificar ninguém, e a linguagem desumanizante já é a da
 * companhia no resto do jogo.
 */
export const deathEchoDesignation = (echoId: string): string => {
  const hash = hashString(echoId);
  const digit = (hash % 9) + 1;
  const letter = DESIGNATION_LETTERS[(hash >>> 4) % DESIGNATION_LETTERS.length];
  const serial = 100 + ((hash >>> 8) % 900);
  return t('echo.designation', { serial: `${digit}${letter}-${serial}` });
};
