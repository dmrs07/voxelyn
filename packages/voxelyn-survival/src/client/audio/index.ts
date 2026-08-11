// AudioDirector: o unico objeto que o resto do cliente conhece.
//
// Ele pluga no MESMO barramento de eventos semanticos que o renderer ja
// consome (`ingestEvents`), pelo mesmo motivo que as particulas plugam ali: o
// que a simulacao afirma e a unica fonte da verdade sobre o que aconteceu, e
// audio derivado de outra coisa (do input, do render, de um palpite) sai
// dessincronizado do que a tela mostra na primeira reconexao de co-op.
//
// Regra de ciclo de vida que rege o arquivo: NADA e criado antes de um gesto do
// usuario. Politica de autoplay a parte, um AudioContext criado no load fica
// 'suspended' em todo browser movel e depois soa com atraso ou nao soa; criar
// no primeiro toque e o que garante que o primeiro tiro da run ja tenha som.

import { TICK_HZ, normalizedDepth, runSectorCount } from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SILENT_AMBIENCE, approachLevels, sampleAmbience, type AmbienceLevels } from './ambience';
import { AmbienceBus } from './ambience-bus';
import { cuesForEvents } from './cues';
import { CueMixer, NEAR_CUTOFF_HZ } from './mixer';
import { MusicBus } from './music-bus';
import { VOICE_RENDERERS, createNoiseBuffer } from './synth';
import { voiceSpec, type VoiceId } from './voices';

export type { AmbienceLevels } from './ambience';
export type { Cue } from './cues';
export type { VoiceId } from './voices';

/**
 * Antecedencia minima de agendamento, em segundos.
 *
 * Agendar em `currentTime` exato e agendar no passado quando a thread de audio
 * ja avancou entre a leitura e a chamada — e som agendado no passado toca
 * imediatamente, sem envelope, ou seja: estala. Cinco milissegundos e
 * imperceptivel e resolve.
 */
const SCHEDULE_LOOKAHEAD = 0.005;

/**
 * De quanto em quanto tempo a grade e reamostrada para a ambiencia, em ms.
 *
 * A varredura e barata (~841 celulas) mas nao e de graca a 60 Hz num celular, e
 * nada no mundo muda tao rapido a ponto de justifica-la todo quadro: fogo se
 * alastra a cada 3 ticks (150 ms). Os NIVEIS continuam sendo interpolados todo
 * quadro — o que e amostrado devagar e o alvo, nao o movimento.
 */
const AMBIENCE_SAMPLE_MS = 100;

/**
 * Prioridade a partir da qual uma voz abaixa a musica (ducking). Nove pega os
 * telegrafos e os stings de fim de ato; `hitPlayer` (prioridade 8) e a UNICA
 * excecao deliberada abaixo da regra — a pancada no proprio corpo merece o
 * canal inteiro, e e por nome, nao por prioridade, para a excecao ficar
 * visivel aqui em vez de escondida num numero.
 */
const MUSIC_DUCK_PRIORITY = 9;

export class AudioDirector {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambienceBus: AmbienceBus | null = null;
  private musicBus: MusicBus | null = null;

  private readonly mixer = new CueMixer();
  private levels: AmbienceLevels = SILENT_AMBIENCE;
  private targetLevels: AmbienceLevels = SILENT_AMBIENCE;
  private lastSampleMs = 0;
  private lastUpdateMs = 0;

  private volume = 0.8;
  private musicVolume = 0.7;
  private muted = false;
  /**
   * Fase do quadro anterior, para detectar a transicao para 'dead'.
   *
   * A morte do jogador e a unica conclusao de run que NAO tem evento semantico
   * proprio: `extracted` existe, morrer so muda `phase`. Em vez de inventar um
   * evento na simulacao autoritativa por uma razao de apresentacao, o audio
   * observa a transicao aqui — a sim nao deve saber que existe som.
   */
  private lastPhase: SurvivalState['phase'] | null = null;
  /**
   * Bioma do quadro anterior, pelo mesmo padrao do lastPhase: a musica troca
   * quando o ESTADO diz que o lugar mudou, nao quando o evento
   * `sector_entered` chega — evento nao sobrevive a resync, estado sim, entao
   * quem reconecta no setor 4 ouve o tema do setor 4 de graca.
   */
  private lastStratum: SurvivalState['stratum'] | null = null;
  private lastOccupation: SurvivalState['occupation'] | null = null;
  /** Id da entidade do jogador local; ouvinte e referencia de "dano em mim". */
  private localPlayerId = 1;
  private worldWidth = 96;

  /** Ha contexto de audio ativo? Falso ate o primeiro gesto do usuario. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setLocalPlayerId(id: number): void {
    this.localPlayerId = id;
  }

  setWorldWidth(width: number): void {
    this.worldWidth = width;
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyMasterGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyMasterGain();
    if (muted) {
      this.ambienceBus?.silence();
      // O scheduler para junto (update retorna cedo com muted); silenciar o
      // barramento evita que o desmute volte com um acorde pendurado.
      this.musicBus?.silence();
    }
  }

  /** Volume da musica (0..1). Multiplica o teto interno do barramento. */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicBus?.setVolume(this.musicVolume);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private applyMasterGain(): void {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  /**
   * Cria o contexto. DEVE ser chamado de dentro de um handler de gesto.
   *
   * Seguro chamar varias vezes: alem de criar uma vez so, ele tambem RETOMA um
   * contexto suspenso, que e o caso normal quando o jogador volta de outra aba
   * — o browser suspende sozinho e nunca avisa.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return; // sem WebAudio o jogo segue mudo, nunca quebrado
      const ctx = new Ctor();

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : this.volume;
      // Compressor no barramento final: com ate 16 vozes, uma cadeia de
      // explosoes soma acima de 1.0 e o browser corta a onda, o que soa como
      // chiado quebrado. O compressor troca esse chiado por uma reducao de
      // volume momentanea — que e, por acaso, exatamente o que um ouvido faz
      // perto de uma explosao.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 8;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;

      master.connect(compressor).connect(ctx.destination);

      this.ctx = ctx;
      this.master = master;
      this.noise = createNoiseBuffer(ctx);
      this.ambienceBus = new AmbienceBus(ctx, master, this.noise);
      this.ambienceBus.start();
      this.musicBus = new MusicBus(ctx, master);
      this.musicBus.start();
      this.musicBus.setVolume(this.musicVolume);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Consome a leva de eventos autoritativos e dispara o que couber. */
  ingest(events: readonly SemanticEvent[], nowMs: number, state?: SurvivalState): void {
    if (!this.ready || this.muted || events.length === 0) return;
    const listener = this.listenerPosition(state);
    const cues = cuesForEvents(events, {
      worldWidth: this.worldWidth,
      localPlayerId: this.localPlayerId,
    });
    for (const planned of this.mixer.plan(cues, listener, nowMs)) {
      this.play(planned.voice, planned.gain, planned.pan, planned.cutoffHz);
    }
  }

  /** Atualiza a ambiencia a partir do estado. Chamar uma vez por quadro. */
  update(state: SurvivalState, nowMs: number): void {
    if (!this.ready || this.muted) return;
    this.worldWidth = state.config.width;

    const dt = this.lastUpdateMs === 0 ? 16 : Math.min(250, nowMs - this.lastUpdateMs);
    this.lastUpdateMs = nowMs;

    if (this.lastPhase === 'running' && state.phase === 'dead') this.ui('died');
    this.lastPhase = state.phase;

    if (state.phase === 'running') {
      // Troca de tema pela MUDANCA DE ESTADO, com o precedente do lastPhase.
      if (state.stratum !== this.lastStratum || state.occupation !== this.lastOccupation) {
        this.lastStratum = state.stratum;
        this.lastOccupation = state.occupation;
        this.musicBus?.setTheme(state.stratum, state.occupation);
      }
      // wake e idempotente: religa depois de um mute que passou.
      this.musicBus?.wake();
      this.musicBus?.setIntensity(normalizedDepth(state.sector, runSectorCount(state)));
      // A bomba do scheduler, com o TEMPO DA SIMULACAO: e isto que faz dois
      // clientes de co-op tocarem o mesmo compasso.
      this.musicBus?.update(state.tick / TICK_HZ);
    } else {
      // Morte e extracao calam a musica como calam a ambiencia: o sting
      // (`died`/`extracted`) soa sozinho, e o silencio e o efeito.
      this.musicBus?.silence();
    }

    if (nowMs - this.lastSampleMs >= AMBIENCE_SAMPLE_MS) {
      this.lastSampleMs = nowMs;
      // Run terminada nao tem ambiencia: o silencio e o efeito. Os leitos
      // descem pela mesma interpolacao de sempre, entao o mundo se cala em vez
      // de ser cortado.
      this.targetLevels =
        state.phase === 'running' ? sampleAmbience(state, this.localPlayerId) : SILENT_AMBIENCE;
    }

    this.levels = approachLevels(this.levels, this.targetLevels, dt);
    this.ambienceBus?.apply(this.levels);
  }

  /**
   * Som sem posicao: botoes de menu, cards de escolha, stings de fim de run.
   *
   * Usa o ganho declarado da propria voz e nao um valor fixo — `uiTap` e
   * `died` sao os dois "nao espaciais" e nao ha volume que sirva aos dois.
   */
  ui(voice: VoiceId = 'uiTap'): void {
    if (!this.ready || this.muted) return;
    this.play(voice, voiceSpec(voice).gain, 0, NEAR_CUTOFF_HZ);
  }

  /** Zera travas e leitos. Chamar ao iniciar uma run nova. */
  reset(): void {
    this.mixer.reset();
    this.levels = SILENT_AMBIENCE;
    this.targetLevels = SILENT_AMBIENCE;
    this.lastSampleMs = 0;
    this.lastUpdateMs = 0;
    this.lastPhase = null;
    this.lastStratum = null;
    this.lastOccupation = null;
    this.ambienceBus?.silence();
    this.musicBus?.silence();
  }

  /** Suspende o contexto (aba escondida). Nao destroi nada. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private listenerPosition(state?: SurvivalState): { x: number; y: number } {
    if (!state) return { x: 0, y: 0 };
    const local = state.players.find((p) => p.id === this.localPlayerId);
    // Sem o jogador local (ainda nao entrou na sala, ou morreu de vez), o
    // ouvinte fica onde ele estava: usar a origem jogaria todo o mundo para a
    // direita do estereo de uma vez, o que e mais estranho que qualquer
    // imprecisao.
    const fallback = state.players.find((p) => p.alive) ?? state.player;
    const ent = local ?? fallback;
    return { x: ent.x, y: ent.y };
  }

  private play(voice: VoiceId, gain: number, pan: number, cutoffHz: number): void {
    const ctx = this.ctx;
    const master = this.master;
    const noise = this.noise;
    if (!ctx || !master || !noise) return;
    const render = VOICE_RENDERERS[voice];
    if (!render) return;

    // A musica cede o canal para o que informa: telegrafos/stings (>= 9) e a
    // pancada no jogador local (excecao explicita, ver MUSIC_DUCK_PRIORITY).
    const spec = voiceSpec(voice);
    if (spec.priority >= MUSIC_DUCK_PRIORITY || voice === 'hitPlayer') {
      this.musicBus?.duck();
    }

    const t0 = ctx.currentTime + SCHEDULE_LOOKAHEAD;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = gain;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = cutoffHz;

    let tail: AudioNode = voiceGain;
    voiceGain.connect(lowpass);
    tail = lowpass;

    if (typeof ctx.createStereoPanner === 'function' && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      tail.connect(panner);
      tail = panner;
    }
    tail.connect(master);

    render(ctx, voiceGain, t0, noise);
  }
}

/** Instancia unica do processo. O jogo tem um ouvinte so. */
export const audio = new AudioDirector();
