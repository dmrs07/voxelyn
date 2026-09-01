// Quanto tempo a rede cobra, e o que fazer com essa medida.
//
// O protocolo ja tinha `ping`/`pong` — o servidor sempre respondeu, devolvendo
// o `clientTimeMs` que recebeu (ver `server.ts`). O que faltava era alguem
// perguntar: o cliente nunca chamou `ping` e nao tratava o `pong`. Este arquivo
// e a metade que faltava, e mora fora de `net.ts` de proposito: a aritmetica de
// uma janela de amostras nao precisa de socket para ser testada, e era so ela
// que podia estar errada em silencio.
//
// A MEDIANA, e nao a media. Uma amostra ruim isolada — o navegador entregando
// o `pong` depois de um GC, o celular trocando de antena — desloca a media e
// nao a mediana. O que o jogador precisa ler e "como esta a minha conexao
// AGORA", nao "quao ruim foi o pior instante dos ultimos doze segundos"; para
// isso existe a variacao, que e a outra metade da resposta e a que de fato
// dimensiona o colchao de interpolacao (ver `playout.ts`).

import { TICK_MS } from '@voxelyn/survival-sim';

/**
 * Quantas amostras a janela guarda.
 *
 * Doze, a uma sondagem por segundo: doze segundos de historia. Curto o
 * bastante para a leitura acompanhar uma piora (entrar no elevador) e longo o
 * bastante para a mediana nao balancar a cada amostra.
 */
export const LATENCY_WINDOW = 12;

/** Ida e volta ate onde o jogo ainda responde como o jogador espera. */
export const LATENCY_GOOD_MS = 80;
/** Acima disto o tiro ja sai visivelmente atras do que a tela mostrava. */
export const LATENCY_FAIR_MS = 160;

/**
 * Teto de espera de UMA sondagem.
 *
 * Sem ele, um destino que aceita a conexao e nunca responde — proxy travado,
 * upstream num buraco negro — deixa a promessa pendurada pelo tempo que o
 * navegador quiser (minutos), e a tela fica em "medindo…" com o botao inerte,
 * porque a proxima tentativa e recusada enquanto a anterior nao volta. Quatro
 * segundos e muito acima de qualquer rede jogavel: quem passa disso nao esta
 * lento, esta inacessivel, e e isso que a tela deve dizer.
 */
export const PROBE_TIMEOUT_MS = 4000;

export type LatencyGrade = 'good' | 'fair' | 'poor';

/**
 * A leitura de uma ida e volta, em tres faixas.
 *
 * Os cortes sao lidos em TICKS, que e a unidade que o jogo tem: 80 ms sao ~1,5
 * ticks e 160 ms sao ~3. Ate um tick e meio o mundo desenhado e o mundo que o
 * servidor vai resolver; a partir de tres, mirar no que se ve e mirar atras.
 */
export const latencyGrade = (rttMs: number): LatencyGrade =>
  rttMs <= LATENCY_GOOD_MS ? 'good' : rttMs <= LATENCY_FAIR_MS ? 'fair' : 'poor';

export type LatencyReading = {
  /** Mediana das amostras da janela, em ms. */
  rttMs: number;
  /** Quanto as amostras se afastam da mediana, em ms. */
  jitterMs: number;
  samples: number;
};

/**
 * A janela de idas e voltas.
 *
 * Guarda o minimo para responder duas perguntas — quanto, e quao instavel — e
 * nada alem disso: um historico maior viraria um grafico, e um grafico e outra
 * feature.
 */
export class LatencyWindow {
  private readonly samples: number[] = [];

  /** Registra uma ida e volta. Amostras impossiveis sao descartadas. */
  push(rttMs: number): void {
    if (!Number.isFinite(rttMs) || rttMs < 0) return;
    this.samples.push(rttMs);
    if (this.samples.length > LATENCY_WINDOW) this.samples.shift();
  }

  /** Esquece tudo: outra conexao, outra medida. */
  reset(): void {
    this.samples.length = 0;
  }

  get count(): number {
    return this.samples.length;
  }

  /** `null` enquanto nenhuma resposta chegou — e ausencia, nao zero. */
  read(): LatencyReading | null {
    if (this.samples.length === 0) return null;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const rttMs = median(sorted);
    // Desvio absoluto MEDIO em torno da mediana. Nao e desvio padrao de
    // proposito: elevar ao quadrado daria ao pico isolado o peso que a mediana
    // acabou de tirar dele.
    const jitterMs =
      sorted.reduce((total, sample) => total + Math.abs(sample - rttMs), 0) / sorted.length;
    return { rttMs, jitterMs, samples: sorted.length };
  }
}

const median = (sorted: readonly number[]): number => {
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

/**
 * O atraso que o colchao de interpolacao acrescenta, em ms.
 *
 * Sai de `delayTicks` (medido em `playout.ts`) e nao da ida e volta: sao dois
 * atrasos diferentes e somaveis, e o jogador merece ver os dois. A rede diz
 * quando o comando chega ao servidor; o colchao diz quanto o desenho fica atras
 * do ultimo quadro recebido — e e ele, nao o ping, que explica um tiro que
 * "passou por dentro" do inimigo.
 */
export const cushionMs = (delayTicks: number): number => delayTicks * TICK_MS;

/**
 * O que a folha de Opcoes mostra, resolvido FORA do DOM.
 *
 * Tres situacoes, e a diferenca entre elas e o assunto: numa sala aberta os
 * numeros sao medidos continuamente pelo `pong`; fora dela existe no maximo o
 * resultado de uma sondagem avulsa; e antes de qualquer uma das duas nao ha
 * medida nenhuma — que NAO e zero, e por isso tem texto proprio.
 */
export type NetReadout =
  /**
   * Sala aberta: ida e volta medida, com o colchao que a irregularidade impos.
   *
   * A variacao da JANELA nao vem junto de proposito, e a medicao explica por
   * que: o `pong` so e processado quando o laco de render libera a thread,
   * entao o espalhamento das amostras carrega o ritmo de quadro deste
   * aparelho. Contra um servidor em localhost — rede praticamente zero — a
   * mediana ficou em 14 ms e a variacao em 39. Publicar isso faria todo mundo
   * culpar a propria conexao pelo proprio FPS.
   *
   * Quem responde por irregularidade e `cushionMs`, que sai do colchao medido
   * em `playout.ts` a partir do INTERVALO ENTRE CHEGADAS de snapshot — a
   * medida que o jogo ja usa para dimensionar o proprio atraso, e que nao
   * depende de quando este cliente conseguiu ler a resposta.
   */
  | { kind: 'live'; rttMs: number; cushionMs: number; grade: LatencyGrade }
  /** Sem sala: o que a ultima sondagem HTTP respondeu. */
  | { kind: 'probe'; rttMs: number; grade: LatencyGrade }
  /** Nada medido ainda — ou a sondagem nao chegou ao servidor. */
  | { kind: 'idle' }
  | { kind: 'unreachable' };

/**
 * Monta a leitura a partir do que existe, na ordem de autoridade.
 *
 * A sala aberta ganha da sondagem sempre que ha `pong` respondido: ela mede o
 * MESMO caminho que os comandos percorrem, e a sondagem mede um caminho
 * parecido. Enquanto a sala existe mas nenhum `pong` voltou, a resposta e
 * "ainda nao sei" — e nao o numero antigo de uma sondagem de antes de entrar,
 * que descreveria outra coisa.
 */
export const netReadout = (
  live: { latency: LatencyReading | null; delayTicks: number } | null,
  probeMs: number | null | undefined,
): NetReadout => {
  if (live?.latency) {
    return {
      kind: 'live',
      rttMs: live.latency.rttMs,
      cushionMs: cushionMs(live.delayTicks),
      grade: latencyGrade(live.latency.rttMs),
    };
  }
  if (live) return { kind: 'idle' };
  if (probeMs === null) return { kind: 'unreachable' };
  if (probeMs === undefined) return { kind: 'idle' };
  return { kind: 'probe', rttMs: probeMs, grade: latencyGrade(probeMs) };
};

/**
 * Mede uma ida e volta HTTP ate o servidor, sem socket nenhum.
 *
 * Existe porque a pergunta que o jogador faz esta quase sempre FORA da partida:
 * "da para jogar co-op agora?". Sem uma sala aberta nao ha `ping` a fazer, e
 * uma tela que so sabe responder durante o co-op responde tarde demais.
 *
 * `/healthz` porque e a rota mais barata que o servidor tem, e `cache: 'no-store'`
 * porque uma resposta servida do cache mediria o disco local, nao a rede.
 * `null` cobre offline, servidor fora e URL invalida — os tres sao "nao deu
 * para medir", que e uma resposta honesta e nao um erro a mostrar na cara.
 *
 * `mode: 'no-cors'` e o detalhe que faz isto funcionar de dentro do navegador.
 * `/healthz` NAO manda cabecalho de CORS — so as rotas de ranking e ecos
 * mandam, e cada origem liberada ali e uma decisao de politica que uma medida
 * de latencia nao tem por que forcar. Sem `no-cors` o navegador recusa a
 * leitura e toda sondagem volta como "servidor fora", inclusive contra um
 * servidor saudavel.
 *
 * O preco e que a resposta vem OPACA: da para saber que ela chegou e quando,
 * nunca o que ela dizia. Para "quanto tempo leva a ida e volta" isso basta —
 * o relogio nao le corpo nenhum —, e e por isso que o sucesso aqui nao pode
 * ser `res.ok`: numa resposta opaca `ok` e sempre falso. O que separa chegar
 * de nao chegar e o `fetch` resolver ou lancar.
 */
export const probeServerLatency = async (
  serverUrl: string,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<number | null> => {
  const base = serverUrl.replace(/^ws/, 'http').replace(/\/+$/, '');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  const started = performance.now();
  try {
    await fetch(`${base}/healthz`, { cache: 'no-store', mode: 'no-cors', signal: abort.signal });
    return performance.now() - started;
  } catch {
    // O `abort` cai aqui junto com recusa de conexao e DNS que nao resolve, e
    // os tres dizem a mesma coisa ao jogador: nao deu para medir.
    return null;
  } finally {
    clearTimeout(timer);
  }
};
