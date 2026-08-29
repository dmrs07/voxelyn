// Presets de qualidade grafica adaptavel (mobile-first). Persistidos em
// localStorage. O loop pode rebaixar automaticamente quando o FPS cai.

export type QualityLevel = 'high' | 'medium' | 'low';

export type QualityPreset = {
  level: QualityLevel;
  maxDpr: number; // limite de device pixel ratio
  maxFx: number; // teto de efeitos simultaneos
  dynamicLights: boolean; // luzes de fogo/cristais/descarga
  shakeScale: number; // 0..1
  targetFps: number;
  /**
   * Halo aditivo sobre os pixels emissivos do sprite (visor, nucleo, brasa).
   *
   * Custa UM drawImage a mais por criatura desenhada, de uma mascara em meia
   * resolucao — nao ha leitura de pixel nem filtro por quadro. Mesmo assim sai
   * no preset baixo: e o unico efeito da lista que e puro enfeite. Ele nao conta
   * nada que o jogador precise saber, e num aparelho que ja esta no minimo cada
   * drawImage por criatura por quadro e um que poderia ser gasto em nao perder
   * quadro.
   */
  bloom: boolean;
};

export const PRESETS: Record<QualityLevel, QualityPreset> = {
  high: {
    level: 'high',
    maxDpr: 2,
    maxFx: 120,
    dynamicLights: true,
    shakeScale: 1,
    targetFps: 60,
    bloom: true,
  },
  medium: {
    level: 'medium',
    maxDpr: 1.5,
    maxFx: 60,
    dynamicLights: true,
    shakeScale: 0.7,
    targetFps: 45,
    bloom: true,
  },
  low: {
    level: 'low',
    maxDpr: 1,
    maxFx: 24,
    dynamicLights: false,
    shakeScale: 0.4,
    targetFps: 30,
    bloom: false,
  },
};

const KEY = 'voxelyn.quality';
const ORDER: QualityLevel[] = ['high', 'medium', 'low'];

export const loadQuality = (): QualityLevel => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'high' || v === 'medium' || v === 'low') return v;
  } catch {
    /* sem storage */
  }
  return 'high';
};

export const saveQuality = (level: QualityLevel): void => {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    /* ignora */
  }
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

export type AudioSettings = {
  /** Volume mestre, 0..1. */
  volume: number;
  /**
   * Volume da MUSICA, 0..1. Multiplica o teto interno do barramento de musica
   * (MUSIC_CEILING), nunca vira ganho WebAudio unitario: 1.0 no slider e o
   * teto projetado da mixagem, nao "musica no maximo do alto-falante".
   */
  musicVolume: number;
  /**
   * Volume dos EFEITOS, 0..1 — tudo o que o mundo faz: tiros, passos, chefes,
   * telegrafos, e o leito de ambiencia que sustenta os tres.
   *
   * Existe porque o slider mestre nao resolve o que as pessoas querem resolver.
   * Quem baixa o volume por causa dos SFX baixa a musica junto e perde o leito
   * que o compositor calibrou; quem sobe para ouvir a trilha leva as explosoes
   * junto. Com os dois independentes, o mestre volta a ser o que ele deve ser:
   * quanto o jogo INTEIRO fala.
   *
   * Ao contrario do musicVolume, este multiplica ganho unitario: 1.0 e "os
   * efeitos como o jogo os mixou", que e o padrao — o teto do SFX ja esta
   * embutido no ganho de cada voz, e mexer nele aqui recalibraria a mixagem.
   */
  sfxVolume: number;
  muted: boolean;
  /**
   * Qual trilha toca na run: 'composed' e a trilha do compositor (arquivo em
   * loop, padrao); 'synth' e a antiga — os oito temas procedurais por estrato,
   * mantidos como backup e como escolha. Se o arquivo nao carregar, o jogo cai
   * no synth sozinho, independente do valor aqui.
   */
  musicSource: 'composed' | 'synth';
};

/**
 * Padrao COM som ligado.
 *
 * A tentacao e comecar mudo "para nao assustar", e seria um erro: o audio aqui
 * carrega telegrafo de perigo, entao um jogador que nunca abre as opcoes jogaria
 * a versao sem metade da informacao de combate e concluiria que o jogo e
 * injusto. Volume abaixo de 1 e a concessao: alto o bastante para informar,
 * baixo o bastante para nao assustar quem esta de fone.
 */
const AUDIO_DEFAULTS: AudioSettings = {
  volume: 0.8,
  musicVolume: 0.7,
  // 1.0, e nao 0.8 como o mestre: o padrao dos efeitos tem de ser exatamente a
  // mixagem que o jogo sempre teve. Qualquer valor menor rebaixaria o som de
  // todo mundo que ja jogava, sem ninguem ter pedido.
  sfxVolume: 1,
  muted: false,
  musicSource: 'composed',
};
const AUDIO_KEY = 'voxelyn.audio';

export const loadAudioSettings = (): AudioSettings => {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return { ...AUDIO_DEFAULTS };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...AUDIO_DEFAULTS };
    const obj = parsed as Partial<AudioSettings>;
    return {
      volume:
        typeof obj.volume === 'number' && Number.isFinite(obj.volume)
          ? Math.max(0, Math.min(1, obj.volume))
          : AUDIO_DEFAULTS.volume,
      // Storage gravado antes da musica existir nao tem o campo: cai no
      // padrao, sem migracao.
      musicVolume:
        typeof obj.musicVolume === 'number' && Number.isFinite(obj.musicVolume)
          ? Math.max(0, Math.min(1, obj.musicVolume))
          : AUDIO_DEFAULTS.musicVolume,
      // Storage anterior ao barramento de efeitos nao tem o campo: cai em 1.0,
      // que e a mixagem de antes — mesmo criterio (sem migracao) do
      // musicVolume acima. Quem ja jogava nao ouve diferenca nenhuma.
      sfxVolume:
        typeof obj.sfxVolume === 'number' && Number.isFinite(obj.sfxVolume)
          ? Math.max(0, Math.min(1, obj.sfxVolume))
          : AUDIO_DEFAULTS.sfxVolume,
      muted: obj.muted === true,
      // Storage anterior a trilha composta nao tem o campo: padrao, sem
      // migracao — mesmo criterio do musicVolume acima.
      musicSource:
        obj.musicSource === 'composed' || obj.musicSource === 'synth'
          ? obj.musicSource
          : AUDIO_DEFAULTS.musicSource,
    };
  } catch {
    // JSON corrompido ou storage bloqueado (modo privativo): o jogo tem de
    // iniciar mesmo assim, com o padrao.
    return { ...AUDIO_DEFAULTS };
  }
};

export const saveAudioSettings = (settings: AudioSettings): void => {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(settings));
  } catch {
    /* ignora */
  }
};

// ---------------------------------------------------------------------------
// Identidade no ranking
// ---------------------------------------------------------------------------

const NAME_KEY = 'voxelyn.name';

/**
 * Nome exibido no ranking. Puramente cosmetico e sem conta.
 *
 * Sem login de proposito: um jogo web de sessao curta que pede cadastro antes
 * de deixar jogar perde o jogador na primeira tela. A consequencia aceita e que
 * nomes nao sao unicos nem reivindicaveis — o que o ranking prova nao e QUEM
 * jogou, e que a run aconteceu (o servidor a re-simulou).
 */
export const loadPlayerName = (): string => {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
};

export const savePlayerName = (name: string): void => {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 18));
  } catch {
    /* ignora */
  }
};

/** Proximo nivel mais leve, ou null se ja no minimo. */
export const nextLowerQuality = (level: QualityLevel): QualityLevel | null => {
  const i = ORDER.indexOf(level);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
};

/**
 * Monitor de FPS que sugere rebaixamento apos janelas sustentadas abaixo do alvo.
 * Determinista o suficiente para o loop; nao decide sozinho (o chamador aplica).
 */
export class FpsGovernor {
  private samples: number[] = [];
  private lowStreak = 0;
  fps = 60;

  sample(dtMs: number): void {
    if (dtMs <= 0) return;
    const inst = 1000 / dtMs;
    this.samples.push(inst);
    if (this.samples.length > 60) this.samples.shift();
    this.fps = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  /** true quando o FPS ficou abaixo do alvo por ~2s seguidos. */
  shouldDowngrade(targetFps: number): boolean {
    if (this.samples.length < 30) return false;
    if (this.fps < targetFps - 5) {
      this.lowStreak += 1;
    } else {
      this.lowStreak = 0;
    }
    if (this.lowStreak > 120) {
      this.lowStreak = 0;
      return true;
    }
    return false;
  }
}
