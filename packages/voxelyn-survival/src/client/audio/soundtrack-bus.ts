// A trilha composta, do lado do browser.
//
// Mesmo contrato de ciclo de vida do music-bus: nos persistentes criados uma
// vez, ganho movido so por setTargetAtTime (atribuir `.value` num no vivo e um
// clique). A diferenca e a fonte: em vez de osciladores, um AudioBuffer
// decodificado de FLAC tocando em loop=true — a unica forma gapless com
// precisao de amostra que o WebAudio oferece.
//
// O que este bus se PROIBE de fazer, por contrato com o compositor (ver
// soundtrack.ts): somar para mono, inserir panner, filtro ou processamento de
// largura. A trilha foi mixada com as laterais ocupadas e o centro livre para
// os SFX do jogo; a cadeia aqui e fonte -> trim -> duck -> bus -> out e
// preserva a imagem byte a byte ate o master.
//
// A trilha NAO e sincronizada ao tick da simulacao, de proposito: ela e
// atmosfera continua, nao identidade de compasso — dois clientes de co-op
// ouvirem a trilha em fases diferentes e imperceptivel e inofensivo, enquanto
// reiniciar o loop a cada resync seria audivel e pior. O relogio do proprio
// AudioContext basta.

import { COMPOSED_FADE_DOWN_TAU, COMPOSED_FADE_UP_TAU, composedBaseGain } from './soundtrack';

/** Ducking: mesmos valores do music-bus, para a musica ceder o canal igual. */
const DUCK_FACTOR = 0.5;
const DUCK_ATTACK_TAU = 0.015;
const DUCK_RELEASE_TAU = 0.25;
const DUCK_HOLD_SEC = 0.12;

/** Ver music-bus.ts: ancora o valor atual antes de re-agendar automacao. */
const cancelAndHold = (param: AudioParam, t: number): void => {
  const holdable = param as AudioParam & { cancelAndHoldAtTime?: (when: number) => AudioParam };
  if (typeof holdable.cancelAndHoldAtTime === 'function') {
    holdable.cancelAndHoldAtTime(t);
  } else {
    const current = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(current, t);
  }
};

export class SoundtrackBus {
  private started = false;
  private silenced = true;
  private disposed = false;

  private buffer: AudioBuffer | null = null;
  private loading = false;
  private source: AudioBufferSourceNode | null = null;

  private busGain: GainNode | null = null;
  private duckGain: GainNode | null = null;

  private musicVolume = 0.7;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    /**
     * Ganho base sob o slider de musica. Cada trilha (run, menu) tem o
     * proprio trim calibrado, entao o bus recebe a funcao em vez de conhecer
     * uma constante — duas instancias, um contrato.
     */
    private readonly baseGain: (musicVolume: number) => number = composedBaseGain,
  ) {}

  /** O arquivo decodificou e a trilha pode soar? */
  get ready(): boolean {
    return this.buffer !== null;
  }

  /** Cria os nos persistentes em ganho zero. Idempotente. */
  start(): void {
    if (this.started) return;
    this.started = true;
    const { ctx, out } = this;

    this.busGain = ctx.createGain();
    this.busGain.gain.value = 0;
    this.duckGain = ctx.createGain();
    this.duckGain.gain.value = 1;
    this.duckGain.connect(this.busGain).connect(out);
  }

  /**
   * Busca e decodifica o asset. Chamar depois de start(), fora do caminho
   * critico (o load e assincrono; ate resolver, o AudioDirector toca o backup
   * procedural). Resolve `false` em QUALQUER falha — 404, rede, decode — e o
   * jogo segue no backup, nunca mudo e nunca quebrado.
   */
  async load(url: string): Promise<boolean> {
    if (this.buffer) return true;
    if (this.loading) return false;
    this.loading = true;
    try {
      // PRIORIDADE BAIXA, e isto passou a importar quando a abertura comecou a
      // armar o audio ja na tela de carregamento: os dois FLAC somam ~45 MB e
      // agora viajam JUNTO com os atlas que a abertura espera. Sem a dica, o
      // navegador os trata como qualquer fetch e eles disputam a banda do
      // caminho critico — a musica chegaria mais cedo ao custo de o menu
      // chegar mais tarde, que e a troca errada. Navegador sem suporte ignora
      // a propriedade e nada muda.
      const res = await fetch(url, { priority: 'low' } as RequestInit);
      if (!res.ok) return false;
      const bytes = await res.arrayBuffer();
      // decodeAudioData entrega PCM float: fim da cadeia lossless do FLAC.
      const buffer = await this.ctx.decodeAudioData(bytes);
      if (this.disposed) return false;
      this.buffer = buffer;
      // Se wake() ja foi pedido enquanto carregava, a fonte nasce agora.
      if (!this.silenced) this.attachSource();
      return true;
    } catch {
      return false;
    } finally {
      this.loading = false;
    }
  }

  /** Volume do usuario (0..1). MULTIPLICA o teto, como no music-bus. */
  setVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (!this.busGain || this.silenced) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(this.baseGain(this.musicVolume), t, 0.1);
  }

  /** Abaixa a trilha sob um som que precisa do canal. Igual ao music-bus. */
  duck(): void {
    if (!this.duckGain || this.silenced) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.duckGain.gain, t);
    this.duckGain.gain.setTargetAtTime(DUCK_FACTOR, t, DUCK_ATTACK_TAU);
    this.duckGain.gain.setTargetAtTime(1, t + DUCK_HOLD_SEC, DUCK_RELEASE_TAU);
  }

  /**
   * Fade rapido a zero. A FONTE CONTINUA TOCANDO em ganho zero: parar e
   * recriar reiniciaria o loop do comeco a cada tela de morte, e a trilha
   * voltar de onde estava e o que faz o mundo parecer continuo.
   */
  silence(): void {
    if (this.silenced) return;
    this.silenced = true;
    if (!this.busGain) return;
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(0, t, COMPOSED_FADE_DOWN_TAU);
  }

  /** Religa (ou liga pela primeira vez). Idempotente; barato por quadro. */
  wake(): void {
    if (!this.silenced || !this.started || !this.busGain) return;
    this.silenced = false;
    this.attachSource();
    const t = this.ctx.currentTime;
    cancelAndHold(this.busGain.gain, t);
    this.busGain.gain.setTargetAtTime(this.baseGain(this.musicVolume), t, COMPOSED_FADE_UP_TAU);
  }

  dispose(): void {
    this.disposed = true;
    if (!this.started) return;
    try {
      this.source?.stop();
      this.source?.disconnect();
    } catch {
      // ja parada; nada a fazer
    }
    this.source = null;
    this.busGain?.disconnect();
    this.started = false;
  }

  /** Cria a fonte em loop se ha buffer e ainda nao ha fonte viva. */
  private attachSource(): void {
    if (this.source || !this.buffer || !this.duckGain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    // Sem trim de loopStart/loopEnd: o asset ja chega com as bordas tratadas
    // pelo prepare-soundtrack.mjs; o loop cobre o buffer inteiro.
    src.connect(this.duckGain);
    src.start(this.ctx.currentTime);
    this.source = src;
  }
}
