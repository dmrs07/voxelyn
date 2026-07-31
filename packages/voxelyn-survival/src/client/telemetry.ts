// Telemetria do lado do cliente.
//
// Tres regras que este arquivo nunca quebra, em ordem:
//
// 1. NUNCA fala com o jogador. Sem banner, sem erro na tela, sem retry
//    visivel. Uma telemetria que atrapalha o jogo deixou de ser diagnostico.
// 2. NUNCA bloqueia. Todo envio e disparado e esquecido, e a falha (offline,
//    servidor fora, opt-out) e o caminho normal — o solo funciona sem rede, e o
//    PWA existe justamente para isso.
// 3. NUNCA identifica ninguem. A sessao vive em `sessionStorage` e morre com a
//    aba; nao ha nome, nem id persistente, nem nada que atravesse visitas.
//
// A escolha de `sessionStorage` custa a metrica de retencao entre DIAS, que e a
// que menos importa agora, e evita ter de pedir consentimento para o que hoje e
// diagnostico interno.

import type { RunSummary } from '@voxelyn/survival-sim';

const SESSION_KEY = 'voxelyn.session';
const OPTOUT_KEY = 'voxelyn.telemetry.optout';

export type RunOutcome = 'dead' | 'extracted' | 'extracted_with_core' | 'abandoned';

const randomId = (): string => {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const sessionId = (): string => {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh = randomId();
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Modo privativo ou storage bloqueado: a sessao vira de uso unico. Perde-se
    // o agrupamento, nao o evento — e um evento solto ainda alimenta o funil e
    // o histograma de estrelas.
    return randomId();
  }
};

export const isOptedOut = (): boolean => {
  try {
    return localStorage.getItem(OPTOUT_KEY) === '1';
  } catch {
    return false;
  }
};

export const setOptedOut = (value: boolean): void => {
  try {
    if (value) localStorage.setItem(OPTOUT_KEY, '1');
    else localStorage.removeItem(OPTOUT_KEY);
  } catch {
    /* ignora */
  }
};

/**
 * Acompanha a sessao e envia um evento por run terminada.
 *
 * Os dois campos que este objeto existe para produzir sao `runIndex` e
 * `msSincePreviousRun`: eles nao descrevem a run, descrevem a SESSAO em volta
 * dela, e sao o que responde "houve vontade de jogar de novo". Sem eles a
 * telemetria mede o jogo e nao mede o jogador.
 */
export class TelemetrySession {
  private readonly id = sessionId();
  private runIndex = 0;
  /** Instante em que a run ANTERIOR terminou. */
  private lastRunEndedAt: number | null = null;
  /**
   * Quanto tempo o jogador levou para comecar ESTA run depois de a anterior
   * acabar. Medido em `begin()` e guardado ate o evento sair.
   */
  private pendingGap: number | null = null;
  /**
   * Esta run ja emitiu o evento terminal dela?
   *
   * Um booleano por run, e nao a identidade do sumario. Comparar com o objeto
   * de sumario so protegia contra `finish` repetido: um `abandon` anterior
   * gravava um marcador diferente, a comparacao dava falso e a MESMA run saia
   * duas vezes — uma como abandonada, outra como terminada. Contagem de runs e
   * taxa de abandono inflavam juntas, e nada denunciava.
   */
  private terminalReported = false;

  constructor(
    private readonly serverUrl: () => string,
    private readonly quality: () => string,
  ) {}

  /**
   * Chamado ao iniciar uma run.
   *
   * O intervalo desde a run anterior e capturado AQUI, e nao no fim.
   *
   * Medido no fim, ele somava a duracao da propria run: reiniciar em 4 segundos
   * e jogar dois minutos registrava 124 segundos e classificava o reinicio como
   * "nao imediato". Isso corrompia exatamente `immediateRestartRate`, que e a
   * metrica que este objeto existe para produzir — a que responde se houve
   * vontade de jogar de novo. A vontade acontece no instante em que se aperta
   * comecar, e e la que ela tem de ser cronometrada.
   */
  begin(): void {
    this.runIndex += 1;
    this.terminalReported = false;
    this.pendingGap = this.lastRunEndedAt === null ? null : Date.now() - this.lastRunEndedAt;
  }

  /**
   * Run terminada. Idempotente por sumario: a fase terminal persiste e o loop
   * continua desenhando, entao sem a guarda o mesmo fim viraria sessenta
   * eventos por segundo.
   */
  finish(summary: RunSummary, sector: number): void {
    if (this.terminalReported) return;
    this.terminalReported = true;
    const gap = this.pendingGap;
    this.pendingGap = null;
    this.lastRunEndedAt = Date.now();
    this.send(
      {
        outcome: summary.phase as RunOutcome,
        sector,
        ticks: summary.ticks,
        stars: summary.stars,
        contamination: summary.contamination,
        deathCause: summary.deathCause?.kind ?? null,
        kills: Object.values(summary.stats.kills).reduce((a, b) => a + b, 0),
        shots: summary.stats.shotsFired,
        damageTakenTenths: summary.stats.damageTakenTenths,
        damageDealtTenths: summary.stats.damageDealtTenths,
        salvageCompleted: summary.stats.salvageCompleted,
        modulesAcquired: summary.stats.modulesAcquired,
        discoveries: summary.stats.discoveries,
      },
      gap,
      false,
    );
  }

  /**
   * Aba fechada com a run em andamento.
   *
   * Abandono e a metrica que MORTE nao substitui: morrer e o jogo funcionando,
   * fechar a aba no meio e o jogo perdendo alguem. Somar os dois num balde so e
   * o erro que faz um jogo dificil parecer saudavel enquanto sangra jogador.
   */
  abandon(sector: number, ticks: number, contamination: number): void {
    if (this.terminalReported) return;
    this.terminalReported = true;
    const gap = this.pendingGap;
    this.pendingGap = null;
    this.lastRunEndedAt = Date.now();
    this.send(
      {
        outcome: 'abandoned',
        sector,
        ticks,
        stars: 0,
        contamination,
        deathCause: null,
        kills: 0,
        shots: 0,
        damageTakenTenths: 0,
        damageDealtTenths: 0,
        salvageCompleted: 0,
        modulesAcquired: 0,
        discoveries: 0,
      },
      gap,
      true,
    );
  }

  private send(
    partial: Omit<Record<string, unknown>, 'session' | 'runIndex' | 'msSincePreviousRun'>,
    msSincePreviousRun: number | null,
    beacon: boolean,
  ): void {
    if (isOptedOut()) return;
    const body = JSON.stringify({
      event: { session: this.id, runIndex: this.runIndex, msSincePreviousRun, ...partial },
      quality: this.quality(),
    });
    const base = this.serverUrl().replace(/^ws/, 'http').replace(/\/+$/, '');
    const url = `${base}/telemetry`;

    try {
      // `sendBeacon` e o UNICO envio que sobrevive ao fechamento da aba: um
      // fetch disparado em `pagehide` e cancelado junto com o documento, e o
      // evento de abandono — justamente o mais valioso — se perderia sempre.
      //
      // O tipo do Blob e `text/plain` e NAO `application/json`, e isso nao e
      // detalhe: `application/json` tira a requisicao da lista segura de CORS e
      // exige preflight, e sendBeacon NAO SABE fazer preflight. O navegador
      // entao descarta o beacon em silencio. Como em producao o cliente (static
      // site) e o servidor (web service) sao origens diferentes, com JSON o
      // abandono nunca chegaria — e nada denunciaria isso, porque telemetria
      // que falha e telemetria calada.
      //
      // O servidor nao le o content-type; ele so faz JSON.parse do corpo.
      if (beacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        navigator.sendBeacon(url, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        return;
      }
      void fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        /* regra 2: offline e o caminho normal */
      });
    } catch {
      /* regra 1: telemetria nunca fala com o jogador */
    }
  }
}
