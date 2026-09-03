// AS FALAS DO DIAMANDIS: uma tabela, dois consumidores.
//
// A voz corporativa e sintetizada como fonemas (`speak` em synth.ts), entao
// as palavras nao ficam inteligiveis — o ritmo silabico e a personalidade. A
// LEGENDA e o que devolve a palavra: a mesma frase que a maquina "diz" sobe
// na tela, no tom da voz, no mesmo instante e pelo MESMO evento.
//
// Uma tabela so, e nao uma no audio e outra no HUD, porque as duas tem de
// concordar para sempre: a legenda de "AFASTE-SE" sobre a voz de "SONDAGEM"
// seria pior que nenhuma legenda. `diamandisLineFor` e a unica funcao que
// decide qual fala um evento carrega; cues.ts a usa para escolher a voz, e
// render.ts para escolher a chave de texto.
//
// Puro e sem DOM de proposito: testavel em Node, como o resto de cues.ts.

import { BOSS_PHASE_REACTOR } from '@voxelyn/survival-sim';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import type { MessageKey } from '../i18n';
import type { VoiceId } from './voices';

export type DiamandisLine = 'unmapped' | 'standClear' | 'armed' | 'survey' | 'fault' | 'lost';

export type DiamandisLineSpec = {
  /** A voz sintetizada (fonemas) da frase. */
  voice: VoiceId;
  /** A chave de catalogo da legenda (i18n). */
  key: MessageKey;
  /** Quanto tempo a legenda fica, em ms. Frases longas ficam mais. */
  holdMs: number;
};

export const DIAMANDIS_LINES: Record<DiamandisLine, DiamandisLineSpec> = {
  unmapped: { voice: 'diamandisVoiceUnmapped', key: 'voice.diamandis.unmapped', holdMs: 3200 },
  standClear: {
    voice: 'diamandisVoiceStandClear',
    key: 'voice.diamandis.standClear',
    holdMs: 2400,
  },
  armed: { voice: 'diamandisVoiceArmed', key: 'voice.diamandis.armed', holdMs: 2600 },
  survey: { voice: 'diamandisVoiceSurvey', key: 'voice.diamandis.survey', holdMs: 2400 },
  fault: { voice: 'diamandisVoiceFault', key: 'voice.diamandis.fault', holdMs: 3400 },
  lost: { voice: 'diamandisVoiceLost', key: 'voice.diamandis.lost', holdMs: 3400 },
};

/**
 * Qual fala (se alguma) um evento carrega. `null` para tudo o que nao e o
 * Diamandis falando — inclusive os eventos dele que sao ferramenta e nao voz.
 */
export const diamandisLineFor = (ev: SemanticEvent): DiamandisLine | null => {
  switch (ev.t) {
    case 'boss_awake':
      return ev.archetype === 'diamandis' ? 'unmapped' : null;
    case 'boss_windup':
      if (ev.archetype !== 'diamandis') return null;
      if (ev.ability === 'drill') return 'standClear';
      if (ev.ability === 'demolish') return 'armed';
      if (ev.ability === 'beam') return 'survey';
      return null;
    case 'boss_phase':
      return ev.archetype === 'diamandis' && ev.phase === BOSS_PHASE_REACTOR ? 'fault' : null;
    case 'boss_module':
      // A peca ARRANCADA ou perdida de vez. Soltar e cair ao chao sao mudos: o
      // clarao e a marca ja dizem, e uma frase por estado viraria narrador.
      return ev.state === 'detached' || ev.state === 'lost' ? 'lost' : null;
    default:
      return null;
  }
};
