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

import {
  MINIGUN_SPIN_MAX,
  TICK_HZ,
  normalizedDepth,
  runSectorCount,
} from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { SILENT_AMBIENCE, approachLevels, sampleAmbience, type AmbienceLevels } from './ambience';
import { AmbienceBus } from './ambience-bus';
import { cuesForEvents } from './cues';
import { MinigunBus } from './minigun-bus';
import { CueMixer, NEAR_CUTOFF_HZ } from './mixer';
import { MusicBus } from './music-bus';
import {
  MENU_SOUNDTRACK_URL,
  SOUNDTRACK_URL,
  menuBaseGain,
  resolveMusicSource,
  type MusicSource,
} from './soundtrack';
import { SoundtrackBus } from './soundtrack-bus';
import { VOICE_RENDERERS, createNoiseBuffer } from './synth';
import { voiceSpec, type VoiceId } from './voices';

export type { AmbienceLevels } from './ambience';
export type { Cue } from './cues';
export type { MusicSource } from './soundtrack';
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
  /**
   * Barramento dos EFEITOS: tudo o que o mundo faz passa por aqui antes do
   * mestre — as vozes de `play()` e o leito de ambiencia.
   *
   * A ambiencia entra junto de proposito. Ela e o vento, o gotejo, o zumbido
   * da maquina: som do MUNDO, do mesmo lado da fronteira que um tiro, e do
   * lado oposto da trilha. Quem baixa "Efeitos" quer o mundo mais baixo, nao
   * so as explosoes — deixar o leito no mestre faria o slider parecer
   * quebrado justamente no silencio, que e quando a ambiencia e tudo o que se
   * ouve.
   *
   * O que NAO passa por aqui: os tres barramentos de musica. E a fronteira
   * inteira da feature.
   */
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambienceBus: AmbienceBus | null = null;
  private minigunBus: MinigunBus | null = null;
  private musicBus: MusicBus | null = null;
  private soundtrackBus: SoundtrackBus | null = null;
  private menuTrackBus: SoundtrackBus | null = null;

  /** A virgula sonora decodificada (ou a promessa dela). Ver `prepareIdentitySting`. */
  private identSting: Promise<AudioBuffer | null> | null = null;

  private readonly mixer = new CueMixer();
  private levels: AmbienceLevels = SILENT_AMBIENCE;
  private targetLevels: AmbienceLevels = SILENT_AMBIENCE;
  private lastSampleMs = 0;
  private lastUpdateMs = 0;

  private volume = 0.8;
  private musicVolume = 0.7;
  /** 1.0 = a mixagem do jogo. Ver `AudioSettings.sfxVolume`. */
  private sfxVolume = 1;
  private muted = false;
  /**
   * Preferencia de trilha do jogador: a composta (arquivo, padrao) ou a
   * sintetizada (os oito temas procedurais — o backup, por escolha). O que
   * SOA a cada quadro e resolveMusicSource(preferencia, arquivo pronto):
   * enquanto o FLAC carrega — ou se falhar — o backup toca sozinho.
   */
  private musicSource: MusicSource = 'composed';
  /** Fonte que soou no quadro anterior, para detectar a transicao. */
  private activeSource: MusicSource | null = null;
  /**
   * Onde o jogador esta: no terminal (menu e overlays de titulo) ou numa run.
   * Quem informa e o main.ts, nas MESMAS transicoes que mostram/escondem o
   * menu sob o veu de deploy — o audio nao adivinha tela por DOM. A trilha de
   * menu toca em 'menu' (quando o arquivo existe), cala em 'run'.
   */
  // 'boot' e o padrao, e nao 'menu': assim um `unlock()` chamado cedo — antes
  // de a sequencia de abertura sequer existir — nao acorda a trilha do
  // terminal por baixo da assinatura do estudio. Quem liga o terminal e um
  // `setScreen('menu')` explicito.
  private screen: 'boot' | 'menu' | 'run' = 'boot';
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
      this.minigunBus?.silence();
      // O scheduler para junto (update retorna cedo com muted); silenciar o
      // barramento evita que o desmute volte com um acorde pendurado.
      this.musicBus?.silence();
      this.soundtrackBus?.silence();
      this.menuTrackBus?.silence();
    } else if (this.screen === 'menu') {
      // Desmutou no terminal: a trilha de menu volta sozinha — nao ha
      // update() de run para religa-la, entao o religamento mora aqui.
      this.menuTrackBus?.wake();
    }
  }

  /** Volume da musica (0..1). Multiplica o teto interno do barramento. */
  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.musicBus?.setVolume(this.musicVolume);
    this.soundtrackBus?.setVolume(this.musicVolume);
    this.menuTrackBus?.setVolume(this.musicVolume);
  }

  /**
   * Volume dos efeitos (0..1). Ganho unitario: 1.0 e a mixagem do jogo.
   *
   * A rampa e a mesma do mestre (`setTargetAtTime`, 50 ms) e existe pelo mesmo
   * motivo: arrastar um slider escreve dezenas de valores por segundo, e
   * atribuir `gain.value` a cada um deles produz um degrau audivel por
   * atribuicao — um chiado, exatamente enquanto a pessoa procura o volume que
   * quer.
   */
  setSfxVolume(volume: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (!this.ctx || !this.sfxBus) return;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
  }

  /**
   * Transicao de tela, chamada pelo main.ts junto das trocas de DOM sob o
   * veu. Toda a politica da trilha de menu vive aqui: acorda no terminal,
   * cala na descida. Idempotente — wake/silence ja o sao.
   */
  setScreen(screen: 'boot' | 'menu' | 'run'): void {
    this.screen = screen;
    // 'boot' cala a trilha do terminal pelo mesmo motivo que 'run': a tela de
    // identidade e da VIRGULA SONORA do estudio, e uma trilha por baixo dela
    // roubaria a peca inteira. O terminal so ganha voz quando a abertura chega
    // a tela de carregamento — e `main.ts` que faz a troca.
    if (screen === 'menu' && !this.muted) this.menuTrackBus?.wake();
    else this.menuTrackBus?.silence();
  }

  /**
   * Busca e decodifica a virgula sonora, SEM tocar nada.
   *
   * Separada de `playIdentitySting` por uma razao medida, e nao por gosto: no
   * primeiro segundo de vida da pagina a thread principal esta tomada
   * construindo as mascaras de halo dos 57 atlas (`emissiveMask`, uma leitura
   * de pixel por atlas), e tudo o que depende de uma tarefa espera atras disso.
   *
   * Medido, com o pedido saindo antes do renderizador: resposta aos 337 ms,
   * corpo lido so aos 1171 ms, decode em 34 ms. Adiantar o pedido tirou o
   * DECODE da fila (eram 422 ms), mas a leitura do corpo continua atras das
   * mascaras — o gargalo e a thread, nao a rede, e resolve-lo de verdade
   * significa fatiar `emissiveMask` ou leva-lo para um worker, que e uma
   * mudanca do banco de sprites e nao desta abertura.
   *
   * Idempotente: a segunda chamada devolve a mesma promessa.
   */
  prepareIdentitySting(url: string): Promise<AudioBuffer | null> {
    if (this.identSting) return this.identSting;
    this.identSting = (async () => {
      this.unlock();
      const ctx = this.ctx;
      if (!ctx) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        return null;
      }
    })();
    return this.identSting;
  }

  /**
   * A VIRGULA SONORA do estudio, tocada uma vez sobre a tela de identidade.
   *
   * Resolve com a duracao da peca em ms quando ela REALMENTE comecou a tocar, e
   * com `null` quando nao tocou. Esse retorno nao e um detalhe: e ele que
   * decide quanto tempo a marca fica na tela (ver `identity-hold-until` em
   * `boot-flow.ts`). Segurar uma tela preta pela duracao de um audio que nunca
   * soou seria uma espera inventada, e esta abertura se proibiu isso.
   *
   * Os tres motivos de `null`, todos legitimos e nenhum um erro:
   *
   * - o jogador esta no mudo;
   * - o navegador nao autorizou o audio ainda (nao houve gesto, e este site
   *   nao tem engajamento de midia suficiente) — o contexto fica suspenso e a
   *   peca seria tocada para ninguem;
   * - o arquivo nao existe, nao baixou ou nao decodificou.
   *
   * Governada pelo MESTRE e pelo mudo, e nao pelos sliders de efeitos ou
   * musica: a assinatura do estudio nao e som do mundo nem trilha do jogo — e
   * a apresentacao, e responde ao "quanto o jogo inteiro fala".
   */
  async playIdentitySting(url: string): Promise<number | null> {
    const buffer = await this.prepareIdentitySting(url);
    const ctx = this.ctx;
    const master = this.master;
    // As checagens acontecem no momento de TOCAR, e nao no de preparar: entre
    // as duas coisas o jogador pode ter chegado com o mudo ligado, e o
    // navegador so decide sobre o contexto quando ele e retomado.
    //
    // `running` e a pergunta certa, e nao "existe contexto": um contexto
    // suspenso aceita `start()` sem erro e nao produz som nenhum — a marca
    // ficaria parada 2,6 s de gracas.
    if (!buffer || !ctx || !master || this.muted || ctx.state !== 'running') return null;
    // A peca ja vem masterizada em -14 LUFS com teto de -1,8 dBFS (ver o
    // manifesto em docs/audio/danitools/): o ganho aqui e unitario de
    // proposito. Recalibra-la seria desfazer a mixagem que ela tem.
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    source.start();
    return buffer.duration * 1000;
  }

  /**
   * Preferencia de trilha (opcoes). A troca em si acontece no proximo
   * update(): e la que a fonte antiga cala e a nova acorda, com as rampas de
   * cada barramento — nada estala aqui.
   */
  setMusicSource(source: MusicSource): void {
    this.musicSource = source;
  }

  get currentMusicSource(): MusicSource {
    return this.musicSource;
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

      // O barramento de efeitos entra ANTES do mestre e DEPOIS de tudo o que
      // o mundo produz. A musica continua indo direto ao mestre, entao o
      // compressor do barramento final segue vendo a soma inteira — o
      // ducking e o teto da mixagem nao mudam de lugar.
      const sfxBus = ctx.createGain();
      sfxBus.gain.value = this.sfxVolume;
      sfxBus.connect(master);

      this.ctx = ctx;
      this.master = master;
      this.sfxBus = sfxBus;
      this.noise = createNoiseBuffer(ctx);
      this.ambienceBus = new AmbienceBus(ctx, sfxBus, this.noise);
      this.ambienceBus.start();
      // O motor do canhao rotativo nasce junto com a ambiencia e em ganho
      // zero, como ela: e um leito, e leito nao e criado no meio do combate.
      // Criar sob demanda pouparia tres nos numa run que nunca ve a arma, e
      // custaria um estalo de alocacao no primeiro tick de rotacao — que e
      // exatamente o instante em que o jogador esta esperando o som.
      this.minigunBus = new MinigunBus(ctx, master, this.noise);
      this.minigunBus.start();
      this.musicBus = new MusicBus(ctx, master);
      this.musicBus.start();
      this.musicBus.setVolume(this.musicVolume);
      this.soundtrackBus = new SoundtrackBus(ctx, master);
      this.soundtrackBus.start();
      this.soundtrackBus.setVolume(this.musicVolume);
      // O load e assincrono e fora do caminho critico do gesto: ate resolver,
      // resolveMusicSource devolve o backup procedural e o jogo tem musica
      // desde o primeiro compasso. Falha (404/decode) = backup para sempre.
      void this.soundtrackBus.load(SOUNDTRACK_URL);
      // A trilha do terminal: nasce querendo tocar (o unlock e um gesto NO
      // menu na esmagadora maioria dos casos) — o wake antes do load e
      // inocuo, e o attach acontece sozinho quando o FLAC decodificar. Sem o
      // arquivo, o menu segue em silencio, como sempre foi.
      this.menuTrackBus = new SoundtrackBus(ctx, master, menuBaseGain);
      this.menuTrackBus.start();
      this.menuTrackBus.setVolume(this.musicVolume);
      void this.menuTrackBus.load(MENU_SOUNDTRACK_URL);
      if (this.screen === 'menu' && !this.muted) this.menuTrackBus.wake();
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
      // Cinto de seguranca: update() com run correndo implica tela de run —
      // se algum caminho novo esquecer o setScreen, a trilha de menu nao
      // pode vazar por baixo da descida. silence() ja silenciado e gratis.
      this.menuTrackBus?.silence();
      // Qual trilha soa AGORA: a composta quando o jogador a prefere e o
      // arquivo ja decodificou; o backup procedural em qualquer outro caso.
      // A resolucao e por quadro de proposito — o FLAC que termina de
      // carregar no meio da run entra aqui, em crossfade, sem evento.
      const active = resolveMusicSource(this.musicSource, this.soundtrackBus?.ready ?? false);
      if (active !== this.activeSource) {
        // A fonte que sai cala com a propria rampa; a que entra acorda na
        // dela. Voltar ao synth exige re-apresentar o tema do estrato atual:
        // zerar o precedente forca o setTheme abaixo.
        if (active === 'composed') this.musicBus?.silence();
        else {
          this.soundtrackBus?.silence();
          this.lastStratum = null;
          this.lastOccupation = null;
        }
        this.activeSource = active;
      }

      if (active === 'composed') {
        // A trilha composta e uma so para todos os estratos (contrato do
        // compositor): sem setTheme, sem intensidade, sem tick — atmosfera
        // continua no relogio do proprio contexto.
        this.soundtrackBus?.wake();
      } else {
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
      }
    } else {
      // Morte e extracao calam a musica como calam a ambiencia: o sting
      // (`died`/`extracted`) soa sozinho, e o silencio e o efeito.
      this.musicBus?.silence();
      this.soundtrackBus?.silence();
    }

    // O MOTOR do canhao rotativo segue o ESTADO autoritativo do jogador local,
    // e nunca um contador do cliente: um relogio proprio divergiria do gatilho
    // na primeira reconexao e o motor aceleraria depois de a arma ja estar
    // cuspindo. `strain` e a mesma fracao de calor que o HUD desenha — o
    // desafino do motor perto do travamento e a unica antecipacao sonora que
    // o superaquecimento tem.
    if (state.phase === 'running') {
      const mg = state.playerExtra.minigun;
      const strain = Math.min(1, state.playerExtra.heat / Math.max(1, state.config.tuning.heatMax));
      this.minigunBus?.set(mg.spin / MINIGUN_SPIN_MAX, strain);
    } else {
      this.minigunBus?.silence();
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
    this.minigunBus?.silence();
    this.musicBus?.silence();
    this.soundtrackBus?.silence();
    this.activeSource = null;
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
    // A saida das vozes e o barramento de EFEITOS, nunca o mestre direto: e o
    // que faz o slider de efeitos valer para todo som do mundo sem que cada
    // voz precise saber que ele existe.
    const out = this.sfxBus;
    const noise = this.noise;
    if (!ctx || !out || !noise) return;
    const render = VOICE_RENDERERS[voice];
    if (!render) return;

    // A musica cede o canal para o que informa: telegrafos/stings (>= 9) e a
    // pancada no jogador local (excecao explicita, ver MUSIC_DUCK_PRIORITY).
    const spec = voiceSpec(voice);
    if (spec.priority >= MUSIC_DUCK_PRIORITY || voice === 'hitPlayer') {
      // Ambos os barramentos: so um esta audivel, e duck num bus calado e
      // inocuo — mais simples que perguntar qual esta ativo.
      this.musicBus?.duck();
      this.soundtrackBus?.duck();
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
    tail.connect(out);

    render(ctx, voiceGain, t0, noise);
  }
}

/** Instancia unica do processo. O jogo tem um ouvinte so. */
export const audio = new AudioDirector();
