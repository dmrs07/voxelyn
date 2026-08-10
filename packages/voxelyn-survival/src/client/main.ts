import { TICK_MS } from '@voxelyn/survival-sim';
import { createRun, emptyCommand, runDepthForGeneration, stepRun } from '@voxelyn/survival-sim';
import type {
  PlayerTuning,
  RunDepthConfig,
  SemanticEvent,
  SurvivalState,
} from '@voxelyn/survival-sim';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { DesktopControlBar } from './desktop-controls';
import {
  inductionSeen,
  markInductionSeen,
  renderInduction,
  type InductionMode,
} from './induction';
import { SurvivalInput, isEditingText, type TouchSafeArea } from './input';
import { EngagementMemory, applyCombatAssist } from './combat-assist';
import { SurvivalRenderer } from './render';
import { DeathEchoController } from './death-echo-presentation';
import {
  deathEchoPoolQuery,
  fetchDeathEchoContract,
  fetchDeathEchoPool,
  submitDeathEcho,
} from './death-echo-pool';
import type { DeathEchoContract } from '@voxelyn/survival-protocol';
import { LocalPlayout } from './local-playout';
import { NetClient } from './net';
import { TickEventQueue } from './playout';
import { RestartGate } from './restart';
import {
  FpsGovernor,
  loadAudioSettings,
  loadPlayerName,
  loadQuality,
  savePlayerName,
  nextLowerQuality,
  saveAudioSettings,
  saveQuality,
  type QualityLevel,
} from './settings';
import { audio } from './audio';
import { applyRunOnce, loadRecords, saveRecords, type Records } from './records';
import {
  fetchCodex,
  markLoreRead,
  openSession,
  purchaseKey,
  purchaseUpgrade,
  requestRunTicketWithSession,
  settleRun,
} from './progression-api';
import { readCachedProfile, writeCachedProfile } from './progression-cache';
import { SettlementQueue } from './settlement-queue';
import { LatestQuery, type Query } from './latest-query';
import { renderRecordsPanel, type RecordsCodexLink } from './records-panel';
import {
  needsConfirmation,
  openCodexDocument,
  renderMatrixPanel,
  type MatrixHandlers,
  type MatrixViewState,
  type PanelNotice,
} from './matrix-panel';
import type { CodexContext, PublicLoreFragment } from '@voxelyn/survival-protocol';
import { formatSeed, parseSeed } from './run-summary';
import { endActionAt, type EndAction, type EndActionRegions } from './run-end-actions';
import {
  deathEchoContractLabelParts,
  isValidRoomCode,
  normalizeRoomCode,
} from '@voxelyn/survival-protocol';
import { RunRecorder, fetchLeaderboard, submitRun } from './run-recorder';
import { renderRankPanel } from './rank-panel';
import { TelemetrySession, isOptedOut, setOptedOut } from './telemetry';
import { inviteUrlFrom } from './invite';
import { deployVeil, veilActive } from './deploy-veil';
import { aurixMarkHtml } from './aurix';
import { PauseMenu } from './pause-menu';
import {
  LOCALES,
  LOCALE_LABELS,
  applyStaticTranslations,
  getLocale,
  onLocaleChange,
  setLocale,
  t,
  type Locale,
  type MessageKey,
} from './i18n';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');

/** Espera antes de aceitar toque como reinicio: a tela de fim precisa ser lida. */
const RESTART_ARM_MS = 900;

const menu = document.getElementById('menu') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const serverInput = document.getElementById('server') as HTMLInputElement;
const qualitySelect = document.getElementById('quality') as HTMLSelectElement;
const volumeInput = document.getElementById('volume') as HTMLInputElement;
const muteButton = document.getElementById('btn-mute') as HTMLButtonElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
const roomInput = document.getElementById('room') as HTMLInputElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const telemetryButton = document.getElementById('btn-telemetry') as HTMLButtonElement;
const rankOverlay = document.getElementById('rank') as HTMLDivElement;
const rankBody = document.getElementById('rank-body') as HTMLDivElement;
const optionsOverlay = document.getElementById('options') as HTMLDivElement;
const devTools = document.getElementById('dev-tools') as HTMLDivElement;
const inviteBar = document.getElementById('invite') as HTMLDivElement;
const inviteCode = document.getElementById('invite-code') as HTMLSpanElement;
const inviteButton = document.getElementById('btn-invite') as HTMLButtonElement;
const recordsOverlay = document.getElementById('records') as HTMLDivElement;
const recordsBody = document.getElementById('records-body') as HTMLDivElement;
const optionsControls = document.getElementById('options-controls') as HTMLDivElement;
const optionsSlot = document.getElementById('options-slot') as HTMLDivElement;
const pauseOptionsSlot = document.getElementById('pause-options-slot') as HTMLDivElement;
const contractButton = document.getElementById('btn-contract') as HTMLButtonElement;
const contractLabel = document.getElementById('contract-label') as HTMLDivElement;
const languageSelect = document.getElementById('language') as HTMLSelectElement;

// ---------------------------------------------------------------------------
// Idioma
// ---------------------------------------------------------------------------
// A primeira coisa depois de achar os elementos, e antes de qualquer rotulo ser
// escrito: as chamadas abaixo montam rotulos dinamicos (som, telemetria) e a
// tela nao pode piscar em portugues antes de virar ingles.
applyStaticTranslations();

/**
 * As opcoes do seletor, montadas por codigo.
 *
 * O HTML nao lista as linguas porque a lista e `LOCALES`, e duplica-la ali
 * criaria a unica forma de erro que o resto do sistema torna impossivel: uma
 * lingua no catalogo sem entrada no menu, ou o contrario.
 */
for (const locale of LOCALES) {
  const option = document.createElement('option');
  option.value = locale;
  option.textContent = LOCALE_LABELS[locale];
  languageSelect.appendChild(option);
}
languageSelect.value = getLocale();
languageSelect.addEventListener('change', () => {
  setLocale(languageSelect.value as Locale);
  audio.ui();
});

/**
 * Nome de cada nivel de qualidade, para o banner do redutor automatico.
 *
 * O banner imprimia o valor do enum (`medium`), que nao e portugues nem ingles
 * — e um identificador de codigo que vazou para a tela.
 */
const QUALITY_KEYS: Record<QualityLevel, MessageKey> = {
  high: 'options.quality.high',
  medium: 'options.quality.medium',
  low: 'options.quality.low',
};

/**
 * O contrato que a companhia ANUNCIOU, se houver servidor.
 *
 * Existir nao significa estar jogando nele: este e o cartaz na parede, e serve
 * apenas para o botao do menu ter um rotulo e uma seed para oferecer.
 */
let advertisedContract: DeathEchoContract | null = null;

/**
 * O contrato que ESTA run esta jogando, ou null.
 *
 * Precisa ser separado do anunciado. Enquanto eram a mesma variavel, qualquer run
 * comum com servidor alcancavel entrava no ramo filtrado por seed de `requestPool`
 * — o pool geral nunca era consultado, e o jogador que nunca tocou no contrato
 * recebia apenas as capsulas daquele mapa. Escrito so por quem inicia a run, ele
 * nao pode ficar preso a um contrato antigo depois de o jogador trocar a seed.
 */
let contractRun: DeathEchoContract | null = null;

const renderer = new SurvivalRenderer(canvas);
const deathEchoes = new DeathEchoController();
/**
 * Setor cujo pool ja foi pedido nesta run.
 *
 * O pool e buscado por SETOR porque a projecao e por setor, e uma vez por setor
 * porque a resposta conta uma manifestacao de cada capsula devolvida: refazer o
 * pedido a cada quadro queimaria o pool inteiro em segundos.
 */
let poolRequestKey = '';
const requestPool = (state: SurvivalState): void => {
  const key = `${state.config.seed}:${state.sector}`;
  if (key === poolRequestKey) return;
  poolRequestKey = key;
  const url = serverInput.value.trim() || defaultServerUrl();
  // `contractRun`, nunca `advertisedContract`: um contrato no cartaz nao decide a
  // modalidade da run que esta rodando.
  void fetchDeathEchoPool(url, deathEchoPoolQuery(state.sector, contractRun)).then((pool) => {
    // A run pode ter descido enquanto a resposta viajava. Sem esta guarda, o pool
    // do setor 1 chegaria depois e projetaria carcacas no setor 2.
    //
    // A pergunta e feita a `liveRun` e nao ao estado que veio no argumento: o
    // solo desenha de uma VISTA, que e um objeto novo por quadro com o setor
    // congelado dentro dele. Perguntar a ela onde a run esta agora e perguntar
    // ao retrato de um quadro que ja passou — a resposta seria sempre "no mesmo
    // setor de quando eu pedi", e a guarda nunca fecharia.
    const live = liveRun;
    if (!live || `${live.config.seed}:${live.sector}` !== key) return;
    if (pool.length > 0) deathEchoes.setPool(pool);
  });
};
const renderState = (
  state: SurvivalState,
  alpha: number,
  inputState: Parameters<SurvivalRenderer['render']>[2],
  nowMs: number,
): void => {
  // A carga sai do ESTADO, todo quadro. No solo e a simulacao local; no online e
  // o `cargoOre` que o snapshot copiou para ca. Um caminho so, e o evento
  // `ore_gained` fica sendo apenas a animacao.
  renderer.setCargoOre(state.stats.oreCollected);
  if (state.phase === 'running') requestPool(state);
  renderer.setDeathEchoes(deathEchoes.sync(state, nowMs));
  renderer.render(state, alpha, inputState, nowMs);
};
const input = new SurvivalInput(canvas);
const cooldownOverlay = new TouchCooldownOverlay(canvas);
/**
 * A barra de comandos do teclado. Irma do radial de toque, e no mesmo canvas:
 * cada uma se cala na modalidade da outra, entao nunca ha duas na tela.
 */
const controlBar = new DesktopControlBar(canvas);
input.attach();

let quality: QualityLevel = loadQuality();
qualitySelect.value = quality;
renderer.setQuality(quality);
const governor = new FpsGovernor();

const readCssPixels = (name: string): number => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};

const readSafeArea = (): TouchSafeArea => ({
  top: readCssPixels('--safe-area-inset-top'),
  right: readCssPixels('--safe-area-inset-right'),
  bottom: readCssPixels('--safe-area-inset-bottom'),
  left: readCssPixels('--safe-area-inset-left'),
});

/**
 * A area segura corrente, guardada em vez de relida por quadro.
 *
 * `readSafeArea` faz quatro `getComputedStyle` no elemento raiz, e a barra de
 * comandos precisa da folga de baixo em TODO quadro. Ela so muda quando a janela
 * muda, que e exatamente quando `resize` roda.
 */
let safeInsets: TouchSafeArea = readSafeArea();

const resize = (): void => {
  const safeArea = readSafeArea();
  safeInsets = safeArea;
  renderer.setSafeArea(safeArea);
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight, safeArea);
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

/**
 * De onde a mira do mouse e medida, em pixels de tela.
 *
 * O X e o centro (a camera segue o Prospector); o Y NAO e: o centro da tela e
 * onde estao os PES dele, e mirar dos pes para o corpo de um alvo somava um erro
 * de projecao que o jogo lia como distancia. O renderer publica o deslocamento
 * do plano de combate — a mesma altura em que o tiro e desenhado — e e dele que
 * o vetor sai. `aimAnchorLiftPx` depende do zoom, entao e lido por quadro.
 */
const playerScreen = (): { x: number; y: number } => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2 - renderer.aimAnchorLiftPx,
});

/**
 * Devolve o jogador ao menu (erro sem retry: URL invalida, versao incompativel).
 *
 * Reexibir o menu nao basta. A descida e ANUNCIADA antes de o socket existir —
 * `runInProgress` de pe e a sentinela de historico empilhada —, e desfazer o
 * anuncio e parte de desistir dela. Sem isso, o ESC (ou o botao voltar) na tela
 * de titulo abre um menu de campo para uma run que nunca comecou, com direito a
 * uma confirmacao de abandono prometendo perder um progresso inexistente.
 */
/** A estática de rádio que acompanha cada varredura do véu de deploy. */
const veilSound = (): void => audio.ui('deployStatic');

/**
 * Uma run preparada e ainda parada: o mundo (ou a conexao) existe, mas nenhum
 * quadro rodou. `firstFrame` desenha o estado inicial — chamado sob o preto do
 * véu, para a escotilha abrir sobre um mundo ja desenhado — e `start` liga o
 * laco, chamado so quando o véu termina e devolve os controles.
 */
type PreparedRun = { firstFrame: () => void; start: () => void };

const backToMenu = (): void => {
  runInProgress = false;
  liveRun = null;
  paused = false;
  stopLoop = null;
  pauseMenu.disarmHistory();
  // A volta ao terminal tambem passa pela escotilha: a unidade e recolhida.
  // Se um véu estiver no ar (nao deveria: as falhas de partida vivem no
  // `prepare` dele), a volta nao pode se perder — mostra o menu sem cerimonia.
  void deployVeil({ swap: () => menu.classList.remove('hidden'), sound: veilSound }).then((ran) => {
    if (!ran) menu.classList.remove('hidden');
  });
};

/**
 * O tom de um aviso de sistema (doc AD-UI-2.0): um estilo por SIGNIFICADO,
 * nunca o mesmo vermelho para tudo.
 *
 * - warning (ouro, o padrao): condicao operacional — nao e erro;
 * - info (teal apagado): o sistema esta trabalhando (conectando, ressinc);
 * - success (teal): confirmacao — carga homologada, run verificada;
 * - offline (cinza): perda de conexao — bloqueia gasto, mantem leitura;
 * - error (vermelho): falha real de sistema, com acao de repetir;
 * - destructive (vermelho 2px): perda irreversivel, e SO ela.
 */
type BannerTone = 'warning' | 'info' | 'success' | 'offline' | 'error' | 'destructive';

const setBanner = (text: string | null, tone: BannerTone = 'warning'): void => {
  if (!text) {
    banner.classList.add('hidden');
  } else {
    banner.textContent = text;
    banner.dataset.tone = tone;
    banner.classList.remove('hidden');
  }
};

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------
// O contexto so nasce num gesto do usuario (ver AudioDirector.unlock). Os
// controles do menu ajustam volume ANTES disso, entao o estado vive aqui e e
// aplicado assim que o contexto existir.
const audioSettings = loadAudioSettings();
audio.setVolume(audioSettings.volume);
audio.setMuted(audioSettings.muted);
volumeInput.value = String(Math.round(audioSettings.volume * 100));

const renderMuteLabel = (): void => {
  muteButton.textContent = t(audioSettings.muted ? 'options.sound.off' : 'options.sound.on');
  muteButton.classList.toggle('primary', !audioSettings.muted);
};
renderMuteLabel();

const setMuted = (muted: boolean): void => {
  audioSettings.muted = muted;
  audio.setMuted(muted);
  saveAudioSettings(audioSettings);
  renderMuteLabel();
};

volumeInput.addEventListener('input', () => {
  audioSettings.volume = Number(volumeInput.value) / 100;
  audio.setVolume(audioSettings.volume);
  saveAudioSettings(audioSettings);
});

muteButton.addEventListener('click', () => {
  setMuted(!audioSettings.muted);
  // Toca DEPOIS de religar: sem um som imediato, o botao nao da nenhum retorno
  // e parece que nao fez nada.
  if (!audioSettings.muted) {
    audio.unlock();
    audio.ui();
  }
});

// A aba escondida nao pode continuar zumbindo: os leitos de ambiencia sao
// continuos e sobreviveriam a troca de aplicativo no celular.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.suspend();
  else audio.resume();
});

/** Atalho M: mudo sem voltar ao menu. */
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'm' && ev.key !== 'M') return;
  if (isEditingText(ev.target)) return; // "Marta" nao pode desligar o som
  setMuted(!audioSettings.muted);
  if (!audioSettings.muted) audio.unlock();
  setBanner(t(audioSettings.muted ? 'banner.sound.off' : 'banner.sound.on'), 'info');
  setTimeout(() => setBanner(null), 1200);
});

// ---------------------------------------------------------------------------
// Memoria entre runs
// ---------------------------------------------------------------------------
let records: Records = loadRecords();

/**
 * Registra uma run terminada, UMA VEZ.
 *
 * A identidade usa campos congelados, nao referencia do objeto: no online cada
 * snapshot desserializa uma nova copia da mesma run terminal.
 */
let recordedSummaryKey: string | null = null;
/** A run corrente ja foi enviada para verificacao? */
let submitted = false;
/** Seed fixada pelo jogador no menu, ou null para sortear a cada descida. */
let forcedSeed: number | null = null;

/**
 * A autorizacao da expedicao corrente.
 *
 * `null` significa SIMULACAO LOCAL: a run acontece igual, com o Prospector de
 * fabrica, e nao rende nada. Nao existe caminho que guarde a run para creditar
 * depois — um log guardado no navegador para submeter "quando a rede voltar" e
 * uma superficie grande de adulteracao em troca de conveniencia pequena.
 */
let expedition: { runId: string; seed: number } | null = null;
/**
 * Ha uma autorizacao de expedicao EM VOO?
 *
 * Guarda de reentrada, e nao de conveniencia. `authorizeExpedition` e uma ida a
 * rede, e a tela de resultado continua desenhando enquanto ela corre — com o
 * portao ja armado. Cada toque a mais (e na tela de morte o jogador toca varias
 * vezes) emitia um ticket novo, e a ULTIMA promessa a resolver sobrescrevia
 * `state`: com respostas fora de ordem, a run que aparecia na tela nao era a do
 * ticket que seria liquidado no fim.
 */
let authorizing = false;

/**
 * Uma liquidacao que FALHOU e ainda pode ser reenviada.
 *
 * O log fica aqui porque a run que o produziu ja acabou: o `recorder` e o
 * `expedition` sao sobrescritos na proxima descida, e sem esta copia o minerio de
 * uma extracao bem-sucedida sumia por causa de um timeout de rede.
 *
 * Nao vai para o `localStorage`, e a distincao importa: isto NAO e o "guardar run
 * offline para creditar depois" que a spec proibe. Aquilo seria um log sem ticket,
 * uma superficie de adulteracao; isto e um log com ticket JA EMITIDO pelo
 * servidor, dentro da validade dele, reenviado com o MESMO `runId` — que a
 * liquidacao trata de forma idempotente. Perder isso ao fechar a aba e aceitavel;
 * perder ao abrir a Matriz nao era.
 */
const pendingSettlements = new SettlementQueue();
/** Esta run ja foi enviada para homologacao? */
let settlementSent = false;

/**
 * Pede a autorizacao da proxima expedicao.
 *
 * Falha vira simulacao local COM AVISO, e nunca silenciosamente: o jogador
 * precisa saber, antes de descer, que a carga daquela descida nao vai contar.
 */
/**
 * @param descent Qual descida pediu esta autorizacao.
 *
 * O token nao serve so para o CHAMADOR decidir se ainda vale — ele precisa ser
 * conferido AQUI DENTRO, antes de qualquer escrita global. A descida A
 * abandonada, resolvendo depois da B, publicava o proprio `runId` em
 * `expedition` e a B liquidava o log dela contra o ticket errado; se a A tivesse
 * falhado, ela zerava `expedition` e a B nao homologava nada.
 */
const authorizeExpedition = async (
  seed: number,
  descent: number,
): Promise<{ seed: number; tuning?: PlayerTuning; depth?: RunDepthConfig }> => {
  authorizing = true;
  const url = serverInput.value.trim() || defaultServerUrl();
  // A carga da run ANTERIOR primeiro: ela ja esta paga e so precisa chegar.
  retryPendingSettlement();
  const authorized = await requestRunTicketWithSession(url, seed).finally(() => {
    authorizing = false;
  });
  // Chegou tarde: outra descida ja e a atual, ou o jogador voltou ao menu. Sai
  // sem tocar em `expedition`, no cache nem no chassi desenhado.
  if (descent !== descentToken) return { seed };
  // A sessao pode ter nascido AGORA, nesta chamada: o perfil que veio com ela e
  // o unico estado autoritativo que o jogo tem antes de descer.
  if (authorized.openedProfile) {
    writeCachedProfile(authorized.openedProfile, Date.now());
    renderer.setProspectorGeneration(authorized.openedProfile.generation);
    renderDescentClearance();
  }
  const result = authorized.ticket;
  if (!result.ok) {
    expedition = null;
    setBanner(t('banner.expedition.offline'), 'offline');
    setTimeout(() => setBanner(null), 4200);
    return { seed };
  }
  const ticket = result.value.ticket;
  expedition = { runId: ticket.runId, seed: ticket.seed };
  // O chassi que vai aparecer na tela e o da arvore que AUTORIZOU esta run.
  // Derivado da contagem de protocolos do perfil em cache — o servidor ja
  // devolveu a geracao no perfil, e o ticket carrega a versao que a produziu.
  const cachedProfile = readCachedProfile()?.profile;
  if (cachedProfile && cachedProfile.profileVersion === ticket.progressionProfileVersion) {
    renderer.setProspectorGeneration(cachedProfile.generation);
  }
  // Tuning E PROFUNDIDADE vem do SERVIDOR, derivados do perfil autoritativo. O
  // cliente nao os calcula nem os corrige: ele executa a configuracao que foi
  // autorizada. Quantos setores esta run tem ja esta decidido antes do primeiro
  // tick, e comprar um protocolo no meio dela nao muda mais nada.
  return { seed: ticket.seed, tuning: ticket.tuning, depth: ticket.depth };
};

/**
 * Envia o que o jogador apertou, e mostra o que o SERVIDOR decidiu.
 *
 * Repare no que nao e enviado: minerio, nucleo, fase, tempo. O servidor
 * re-simula a run inteira com a seed e o tuning que ele mesmo autorizou.
 */
/** Envia (ou reenvia) uma liquidacao. Idempotente do lado do servidor. */
const transmitSettlement = (url: string, runId: string, log: string): void => {
  void settleRun(url, runId, log).then((result) => {
    if (!result.ok) {
      // GUARDA para reenviar, CHAVEADO POR runId.
      //
      // Um slot unico nao servia: a liquidacao espera ate 45 s e o ticket
      // seguinte volta em 6, entao a run B pode terminar e falhar enquanto a
      // retentativa da run A ainda esta no ar. Com um slot, o sucesso tardio de
      // A limpava o pendente de B — e a carga de B nunca mais seria reenviada.
      pendingSettlements.hold({ runId, log, url });
      console.info('[progressao] nao homologada:', result.error);
      setBanner(t('banner.expedition.pending'));
      setTimeout(() => setBanner(null), 4200);
      return;
    }
    // So o proprio runId sai do mapa. Ver o comentario da falha, acima.
    pendingSettlements.settled(runId);
    writeCachedProfile(result.value.profile, Date.now());
    const credited = result.value.result;
    // Tres frases, e nao uma com "+0 NUCLEO" no fim: a extracao antecipada e
    // uma decisao legitima, e anunciar o zero que ela nao trouxe a transforma
    // num fracasso parcial toda vez que o jogador escolhe voltar cedo.
    if (credited.coresCredited > 0) {
      setBanner(
        t('banner.cargo.cleared.core', {
          ore: credited.oreCredited,
          cores: credited.coresCredited,
        }),
        'success',
      );
    } else if (credited.oreCredited > 0) {
      setBanner(t('banner.cargo.cleared', { ore: credited.oreCredited }), 'success');
    } else {
      setBanner(t('banner.cargo.lost', { ore: credited.oreLost }), 'destructive');
    }
    setTimeout(() => setBanner(null), 4600);
  });
};

/**
 * Tenta de novo a liquidacao que ficou pendente.
 *
 * Chamada nos dois momentos em que o jogo ja esta falando com o servidor de
 * qualquer forma — abrir a Matriz e autorizar a proxima expedicao —, em vez de um
 * temporizador proprio: reenviar em laco contra um servidor fora do ar so gasta
 * bateria e rate limit.
 */
const retryPendingSettlement = (): void => {
  // Uma copia da lista antes de iterar: `transmitSettlement` pode escrever no
  // mapa de forma assincrona, e iterar sobre a colecao viva enquanto ela muda e
  // exatamente o tipo de bug que so aparece com a rede ruim.
  for (const pending of pendingSettlements.drain()) {
    transmitSettlement(pending.url, pending.runId, pending.log);
  }
};

const homologateRun = (state: SurvivalState): void => {
  if (settlementSent || !expedition || !state.summary) return;
  const url = serverInput.value.trim() || defaultServerUrl();
  if (!recorder.submittable) {
    // A run passou do teto de gravacao e nao ha log canonico para o servidor
    // re-simular. Dizer isso e obrigatorio: em silencio, a tela mostrava a carga
    // "transmitida para homologacao" e nada era creditado nunca.
    settlementSent = true;
    setBanner(t('banner.expedition.tooLong'));
    setTimeout(() => setBanner(null), 5200);
    return;
  }
  settlementSent = true;
  transmitSettlement(url, expedition.runId, recorder.encode());
};
const recordRun = (state: SurvivalState): void => {
  if (!state.summary) return;
  const result = applyRunOnce(records, state.summary, recordedSummaryKey);
  recordedSummaryKey = result.identity;
  if (!result.applied) return;
  records = result.records;
  saveRecords(records);
};

/**
 * Envia a run solo para verificacao no servidor.
 *
 * So runs que EXTRAIRAM sobem. Morte nao vai ao ranking: o placar ordena por
 * estrelas e tempo, e uma run de zero estrela nao tem posicao — mandaria
 * dezenas de replays por sessao para o servidor re-simular sem nada a mostrar
 * no fim.
 *
 * Falhar aqui e silencioso de proposito. O solo funciona offline (e o PWA
 * existe justamente para isso); transformar "sem rede" em erro na tela puniria
 * o modo de jogo principal por uma funcionalidade acessoria.
 */
const submitSoloRun = (state: SurvivalState): void => {
  if (submitted || !state.summary || state.summary.phase === 'dead') return;
  submitted = true;
  const url = serverInput.value.trim() || defaultServerUrl();
  void submitRun(url, recorder, playerName).then((outcome) => {
    if (!outcome.ok) {
      // Sem banner: o jogador esta lendo a tela de resultado.
      console.info('[leaderboard] nao enviado:', outcome.reason);
      return;
    }
    setBanner(t(outcome.duplicate ? 'banner.run.duplicate' : 'banner.run.verified'), 'success');
    setTimeout(() => setBanner(null), 2600);
  });
};

/** A run corrente ja ofereceu a propria morte ao pool? */
let echoSubmitted = false;

/**
 * Oferece a propria morte ao pool comunitario.
 *
 * Manda seed e log — nunca a capsula. O servidor re-simula, descobre sozinho onde
 * e de que o Prospector morreu, e so entao guarda. Ver `death-echo-pool.ts`.
 *
 * O espelho exato de `submitSoloRun`: la sobem as runs que EXTRAIRAM, aqui as que
 * MORRERAM. Juntas cobrem todo desfecho sem que nenhuma das duas rotas receba
 * trabalho que nao lhe serve.
 *
 * Silencioso em qualquer falha, e silencioso tambem no sucesso: o jogador esta
 * lendo a tela de resultado da propria morte, e um aviso de "carcaca publicada"
 * ali seria a companhia falando por cima do luto. O corpo dele aparecer no mapa de
 * um estranho e a recompensa; ela nao precisa de notificacao.
 */
const submitDeathToPool = (state: SurvivalState): void => {
  if (echoSubmitted || state.config.playerCount !== 1) return;
  if (state.phase !== 'dead' || !recorder.submittable) return;
  echoSubmitted = true;
  const url = serverInput.value.trim() || defaultServerUrl();
  void submitDeathEcho(url, recorder.recordedSeed, recorder.encode()).then((outcome) => {
    if (!outcome.ok) console.info('[echoes] nao enviado:', outcome.reason);
  });
};

/**
 * Zera as travas de "ja enviei esta run" antes de uma descida nova.
 *
 * Todas elas sao travas de idempotencia: a fase terminal persiste e o loop
 * continua desenhando, entao sem elas o mesmo fim viraria sessenta envios por
 * segundo. O preco e que elas precisam ser destravadas em algum lugar — e o
 * lugar so pode ser o inicio da run.
 *
 * Antes do menu de campo, a unica volta ao menu principal era recarregar a
 * pagina, e o modulo inteiro nascia limpo: a limpeza acontecia de graca e a
 * falta dela era invisivel. Com uma porta de saida real, `submitted` sobrevivia
 * a volta ao menu e a PROXIMA extracao nunca chegava ao ranking.
 */
const resetRunTracking = (): void => {
  settlementSent = false;
  recordedSummaryKey = null;
  submitted = false;
  echoSubmitted = false;
  poolRequestKey = '';
  // A apresentacao e do mesmo tipo de estado: nasce da run e nao pode atravessar
  // para a proxima, porque os ids de entidade sao reciclados. Ver
  // `resetRunPresentation`.
  renderer.resetRunPresentation();
};

// ---------------------------------------------------------------------------
// Convite de co-op
// ---------------------------------------------------------------------------

let currentInvite: string | null = null;

const showInvite = (code: string | null): void => {
  if (code === currentInvite) return;
  currentInvite = code;
  if (!code) {
    inviteBar.classList.add('hidden');
    return;
  }
  inviteCode.textContent = code;
  inviteBar.classList.remove('hidden');
};

inviteButton.addEventListener('click', () => {
  if (!currentInvite) return;
  const url = inviteUrlFrom(location.href, currentInvite);
  const done = (key: MessageKey): void => {
    inviteButton.textContent = t(key);
    setTimeout(() => {
      inviteButton.textContent = t('invite.copy');
    }, 1800);
  };
  // `navigator.share` primeiro porque no celular ele abre a folha nativa e
  // manda direto para o WhatsApp, que e como o convite de fato viaja. No
  // desktop ele quase nunca existe, e a area de transferencia e o certo.
  if (typeof navigator.share === 'function') {
    void navigator
      .share({
        title: t('app.title'),
        text: t('invite.shareText', { room: currentInvite }),
        url,
      })
      .then(() => done('invite.shared'))
      .catch(() => {
        /* o jogador cancelou a folha de compartilhamento: nao e erro */
      });
    return;
  }
  void navigator.clipboard
    ?.writeText(url)
    .then(() => done('invite.copied'))
    .catch(() => done('invite.manual'));
  audio.ui();
});

const haptics = (events: SemanticEvent[]): void => {
  if (!('vibrate' in navigator)) return;
  for (const e of events) {
    if (e.t === 'player_down') navigator.vibrate(120);
    else if (e.t === 'dodge') navigator.vibrate(15);
  }
};

const applyAdaptiveQuality = (dt: number): void => {
  governor.sample(dt);
  if (governor.shouldDowngrade(renderer.quality.targetFps)) {
    const lower = nextLowerQuality(renderer.quality.level);
    if (lower) {
      quality = lower;
      renderer.setQuality(lower);
      saveQuality(lower);
      qualitySelect.value = lower;
      setBanner(t('banner.quality.downgraded', { quality: t(QUALITY_KEYS[lower]) }));
      setTimeout(() => setBanner(null), 1800);
    }
  }
};

// ---------------------------------------------------------------------------
// SOLO (simulacao local, funciona offline)
// ---------------------------------------------------------------------------
let stopLoop: (() => void) | null = null;

/**
 * Qual descida e a ATUAL.
 *
 * `stopLoop` so existe depois que o laco comeca, e agora a descida espera uma ida
 * a rede antes disso. Nessa janela, abandonar pelo menu de campo nao tinha o que
 * cancelar: quando o ticket chegasse, a continuacao criava o mundo e ligava o
 * laco ATRAS da tela de titulo — e comecar outra descida nesse meio-tempo deixava
 * dois lacos vivos disputando o unico `stopLoop`.
 *
 * Um contador resolve os dois casos com a mesma pergunta: "eu ainda sou a descida
 * atual?". Abandonar incrementa; comecar outra tambem.
 */
let descentToken = 0;

/**
 * Seed da proxima descida.
 *
 * Uma seed digitada vale para a run inteira, INCLUSIVE os reinicios: a razao de
 * o campo existir e alguem colar a seed de outra pessoa e tentar a mesma
 * descida, e sortear uma nova ao morrer destruiria exatamente esse uso.
 */
const nextSeed = (): number => forcedSeed ?? (Date.now() ^ 0x5f3759df) >>> 0;

const recorder = new RunRecorder();
const telemetry = new TelemetrySession(
  () => serverInput.value.trim() || defaultServerUrl(),
  () => quality,
);
/** Estado vivo da run corrente, para o evento de abandono saber onde ela parou. */
let liveRun: SurvivalState | null = null;

/**
 * Ha uma descida em curso — mesmo que ainda nao exista estado nenhum.
 *
 * Separado de `liveRun` por causa do co-op: entre pedir a sala e o primeiro
 * snapshot chegar existe uma janela de "Conectando…" que, com servidor fora do
 * ar, nunca termina. Amarrar o menu de campo a `liveRun` deixaria justamente
 * essa tela — a unica em que o jogador precisa de uma saida — sem saida.
 */
let runInProgress = false;

// Aba fechada com a run em andamento. `pagehide` e nao `beforeunload`: este
// ultimo nao dispara de forma confiavel em Safari movel, que e metade do
// publico de um PWA.
//
// E `pagehide` SOZINHO, sem `visibilitychange`.
//
// Trocar de aba, atender uma ligacao ou olhar uma notificacao esconde o
// documento e devolve o jogador segundos depois — nao e abandono, e uma pausa.
// Reportar em `visibilitychange` transformava cada uma dessas idas em uma run
// perdida no funil, e a run continuava viva para terminar de verdade mais tarde
// e emitir o SEGUNDO evento terminal dela. As duas metricas que mais importam
// aqui, contagem de runs e taxa de abandono, subiam juntas por um motivo que nao
// tem nada a ver com o jogo.
//
// `pagehide` cobre o que realmente interessa: ele dispara ao descarregar E ao
// entrar no bfcache, que e por onde o navegador movel de fato leva a pagina
// embora. O que fica de fora e a aba escondida que o sistema mata sem aviso, e
// perder esse caso e mais barato que inventar abandono a cada troca de app.
const reportAbandon = (): void => {
  const state = liveRun;
  if (!state || state.phase !== 'running' || state.tick < 20) return;
  telemetry.abandon(state.sector, state.tick, state.contamination);
};
window.addEventListener('pagehide', reportAbandon);
let playerName = loadPlayerName();
nameInput.value = playerName;
nameInput.addEventListener('change', () => {
  playerName = nameInput.value.trim();
  savePlayerName(playerName);
});

// ---------------------------------------------------------------------------
// Menu de campo (pausa)
// ---------------------------------------------------------------------------

/**
 * O mundo esta congelado?
 *
 * Verdade apenas no solo, e a diferenca e estrutural, nao uma opcao: no co-op a
 * simulacao roda no servidor, para os dois jogadores, e nada que este cliente
 * faca pode paralisa-la. Prometer pausa la seria mentir para o jogador no exato
 * momento em que ele para de olhar para a tela.
 */
let paused = false;

/**
 * O quadro congelado precisa ser redesenhado UMA vez.
 *
 * Com o mundo em pausa o loop nao desenha nada — o canvas guarda a ultima
 * imagem, que e exatamente o mundo parado que a overlay quer ter atras de si. O
 * problema e que o bloco de opcoes vive DENTRO do menu de campo: trocar de
 * idioma ali muda o HUD desenhado no canvas, e a imagem guardada continua na
 * lingua anterior ate o jogador retomar a descida. Um quadro a mais resolve, e
 * so ele — redesenhar sempre desfaria a pausa.
 */
let frozenFrameStale = false;

/** Move o bloco unico de opcoes para a tela que esta abrindo. */
const mountOptions = (slot: HTMLDivElement): void => {
  slot.appendChild(optionsControls);
};

/**
 * Encerra a run corrente e devolve o jogador a tela de titulo.
 *
 * O evento de abandono e o MESMO que a aba fechada dispara, e de proposito:
 * para a telemetria as duas coisas sao a mesma perda — alguem que desceu e nao
 * chegou ao fim. `TelemetrySession.abandon` ja e idempotente por run, entao sair
 * pelo menu depois de a aba ter ficado escondida nao conta duas vezes.
 */
const abandonRun = (): void => {
  const state = liveRun;
  if (state && state.phase === 'running' && state.tick >= 20) {
    telemetry.abandon(state.sector, state.tick, state.contamination);
  }
  // Invalida qualquer autorizacao em voo: sem isto, um ticket que chegasse depois
  // do abandono ainda ligaria um laco por tras da tela de titulo.
  descentToken++;
  stopLoop?.();
  stopLoop = null;
  liveRun = null;
  runInProgress = false;
  paused = false;
  // A sentinela de historico sai junto com a run, venha o abandono do menu de
  // campo (que ja a desfez, e por isso isto e idempotente) ou do botao da tela
  // de fim. Deixa-la para tras nao quebra nada AGORA — quebra na descida
  // seguinte, em que `armHistory` se daria por armada e o botao voltar do
  // celular sairia da pagina no meio da run.
  pauseMenu.disarmHistory();
  // A fila de toques e as teclas de fim de run ficam cheias do que o jogador
  // apertou durante a run. Sem drenar, a PROXIMA descida encontra lixo desta.
  input.clearPendingUiInput();
  mountOptions(optionsSlot);
  showInvite(null);
  setBanner(null);
  audio.reset();
  void deployVeil({ swap: () => menu.classList.remove('hidden'), sound: veilSound }).then((ran) => {
    if (!ran) menu.classList.remove('hidden');
  });
};

/** Solo congela; co-op nao. Lido pelo menu ANTES de `onOpen`, entao nao pode depender de `paused`. */
const soloRun = (): boolean => liveRun !== null && liveRun.config.playerCount === 1;

const pauseMenu = new PauseMenu(canvas, {
  runActive: () => runInProgress,
  runTerminal: () => liveRun !== null && liveRun.phase !== 'running',
  freezesWorld: soloRun,
  status: () => {
    const state = liveRun;
    if (!state) return t('pause.status.noSignal');
    if (state.phase !== 'running') return t('pause.status.closed');
    return t('pause.status.running', {
      sector: state.sector,
      contamination: Math.round(state.contamination * 100),
    });
  },
  onOpen: () => {
    // No solo a pausa e real e o loop congela; no co-op ela e so a overlay, e o
    // comando enviado ao servidor vira neutro (o Prospector para de andar e de
    // atirar, como se o jogador tivesse tirado as maos — que foi o que ele fez).
    //
    // Na tela de FIM nada congela, nem no solo: e ali que a run e gravada,
    // enviada ao ranking e oferecida ao pool de carcacas, tudo uma vez so e tudo
    // dentro do quadro. Congelar o quadro nesse instante seguraria os tres
    // envios ate o jogador fechar o menu — e o abandono a partir dali os
    // perderia de vez. O que precisa ser barrado la nao e o tempo, e o R do
    // teclado, que atravessa a overlay.
    paused = soloRun() && liveRun?.phase === 'running';
    mountOptions(pauseOptionsSlot);
    // O jogador achou o menu: a dica cumpriu a funcao e sai de cena em vez de
    // ficar explicando por cima do que ela ensinou a abrir.
    clearHint();
  },
  onClose: () => {
    paused = false;
    mountOptions(optionsSlot);
    // Esquiva/habilidade apertadas com o menu aberto nao podem sair quando ele
    // fechar: o teclado continua chegando por cima da overlay, e o jogador
    // veria o personagem gastar o dash sozinho ao retomar.
    input.clearQueuedActions();
    input.clearPendingUiInput();
  },
  onAbandon: abandonRun,
  ui: () => audio.ui(),
});
pauseMenu.attach();

/**
 * O que o jogador pediu na tela de fim — descer de novo, voltar ao terminal, ou
 * nada ainda.
 *
 * Uma funcao para os dois modos porque a tela de fim e a MESMA no solo e no
 * co-op: o que muda e o que cada um faz com a resposta (mundo novo aqui, sala
 * nova la), e nao como a resposta e lida.
 *
 * `pauseMenu.isOpen` barra o TECLADO, que chega por cima da overlay: sem ele,
 * quem abrisse o menu de campo na tela de fim para sair veria a run reiniciar
 * por baixo do proprio menu. Os toques ja param sozinhos — a overlay engole o
 * pointerdown antes de o canvas ve-lo.
 *
 * `armed` vem da `RestartGate`: antes dela armar, a tela de fim ainda nao foi
 * lida e nenhum gesto vale como decisao.
 */
const endScreenAction = (regions: EndActionRegions | null, armed: boolean): EndAction | null => {
  if (!regions || !armed || pauseMenu.isOpen) return null;
  const tapped = input.consumeUiTap((x, y) => endActionAt(regions, x, y));
  if (tapped !== null) return tapped;
  if (input.consumeRestartKey()) return 'restart';
  if (input.consumeTerminalKey()) return 'terminal';
  return null;
};

/**
 * A dica, uma vez na vida.
 *
 * Um gesto sem affordance precisa ser dito pelo menos uma vez, e exatamente uma:
 * repetir a cada descida transformaria a dica no proprio ruido de tela que a
 * decisao de nao ter botao existe para evitar. Fica atras de um banner livre —
 * "Conectando…" do co-op tem prioridade sobre ela.
 */
const HINT_KEY = 'voxelyn.pausehint';
/** Timer da dica no ar, para que abrir o menu possa aposenta-la na hora. */
let hintTimer: ReturnType<typeof setTimeout> | null = null;

const clearHint = (): void => {
  if (hintTimer === null) return;
  clearTimeout(hintTimer);
  hintTimer = null;
  setBanner(null);
};

const hintOnce = (): void => {
  try {
    if (localStorage.getItem(HINT_KEY) === '1') return;
  } catch {
    return; // sem storage nao ha "uma vez": melhor nunca do que toda vez
  }
  setTimeout(() => {
    // Um banner ocupado tem prioridade: "Conectando…" e informacao que o
    // jogador esta esperando, e a dica pode ficar para a proxima descida.
    if (!runInProgress || pauseMenu.isOpen || !banner.classList.contains('hidden')) return;
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignora */
    }
    setBanner(t('pause.hint'), 'info');
    hintTimer = setTimeout(clearHint, 4000);
  }, 1600);
};

/**
 * Prepara uma descida solo: autoriza, constroi o mundo e monta o laco — sem
 * rodar um quadro sequer. Quem decide QUANDO o primeiro quadro aparece e
 * quando o laco anda e o véu de deploy, atraves do `PreparedRun` devolvido.
 * `null` quando a autorizacao chegou tarde (outra descida ja e a atual).
 */
const prepareSolo = async (): Promise<PreparedRun | null> => {
  const myDescent = ++descentToken;
  renderer.setLocalPlayerId(1); // solo: o unico player e o id 1
  audio.setLocalPlayerId(1);
  audio.reset();
  // A AUTORIZACAO VEM ANTES DO MUNDO. O servidor escolhe (ou confirma) a seed e
  // devolve o tuning derivado do perfil; so entao a run existe. Construir o
  // mundo primeiro e pedir o ticket depois criaria uma janela em que o
  // Prospector na tela nao e o Prospector autorizado.
  const authorized = await authorizeExpedition(nextSeed(), myDescent);
  // O jogador pode ter desistido — ou comecado outra descida — enquanto o ticket
  // vinha. Sair AQUI, antes de tocar em qualquer estado global, e o que impede um
  // mundo de nascer atras do menu.
  if (myDescent !== descentToken) return null;
  const seed = authorized.seed;
  recorder.start(seed);
  resetRunTracking();
  telemetry.begin();
  let state: SurvivalState = createRun({ seed, tuning: authorized.tuning, depth: authorized.depth });
  liveRun = state;
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  let queuedChoice: 0 | 1 | null = null;

  const gate = new RestartGate(RESTART_ARM_MS);

  // Mesma dupla do co-op, pelo mesmo motivo: o desenho fica um tick atras da
  // simulacao para ter entre o que interpolar, e a narracao daquele tick espera
  // a linha de render alcanca-lo. Disparar evento na hora do `stepRun` o poria a
  // frente do mundo que o produziu — a explosao acenderia antes de a criatura
  // chegar onde ela explodiu.
  const playout = new LocalPlayout();
  playout.capture(state);
  /**
   * A memoria de engajamento (IA-05) vive com a DESCIDA, nunca com a run
   * anterior: e estado de assistencia, e o alvo lembrado de um mundo que ja
   * morreu apontaria para um id que o mundo novo pode ter dado a outra coisa.
   */
  const assistMemory = new EngagementMemory();
  /** Instante do quadro corrente: e quando o evento vira imagem e som. */
  let frameNow = lastTime;
  const eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
    audio.ingest(events, frameNow, state);
    haptics(events);
  });
  /** Recomeco de run: nada do mundo anterior sobrevive nem espera na fila. */
  const rearm = (): void => {
    playout.reset();
    eventQueue.clear();
    playout.capture(state);
    assistMemory.clear();
    // Um tap neutro engatilhado na tela de fim nao pode virar o primeiro tiro
    // da run nova.
    input.consumeAimTap();
  };

  const frame = (now: number): void => {
    if (!running) return;
    frameNow = now;
    // Pausa de verdade: o relogio anda com o quadro, mas o acumulador nao recebe
    // nada, entao nenhum tick e simulado e nenhum e devido ao retomar. Mover
    // `lastTime` aqui e o que impede o mundo de compensar a pausa inteira de uma
    // vez — sem isso, um menu aberto por trinta segundos devolveria o jogador no
    // meio de um enxame que se moveu enquanto ele lia o volume.
    //
    // O quadro tambem nao e redesenhado: o canvas guarda a ultima imagem, que e
    // exatamente o mundo congelado que a overlay quer ter atras de si.
    if (paused) {
      lastTime = now;
      // Sem avancar o acumulador: nenhum tick e simulado e nenhum fica devido.
      // Este desenho e so a mesma cena com o texto na lingua nova.
      if (frozenFrameStale) {
        frozenFrameStale = false;
        renderState(playout.sample(state, accumulator / TICK_MS) ?? state, 1, input.state, now);
      }
      requestAnimationFrame(frame);
      return;
    }
    const delta = Math.min(120, now - lastTime);
    applyAdaptiveQuality(delta);
    lastTime = now;
    accumulator += delta;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (state.phase !== 'running') {
      // A linha de render parou de andar junto com a simulacao, entao o que
      // sobrou na fila nunca seria alcancado. Solta tudo: sao as mortes e a
      // explosao do ultimo tick, exatamente o que a tela de fim precisa ter
      // acontecido atras dela.
      eventQueue.flush(Number.POSITIVE_INFINITY);
      recordRun(state);
      homologateRun(state);
      submitSoloRun(state);
      submitDeathToPool(state);
      if (state.summary) telemetry.finish(state.summary, state.sector);
      const { drain, armed } = gate.frame(now, true);
      if (drain) input.clearPendingUiInput();
      audio.update(state, now);
      renderState(state, 1, input.state, now);
      const endRegions = renderer.renderEnd(state, vw, vh, now, { input: input.state });
      // `authorizing` so barra a DESCIDA: um ticket ja em voo e uma run nova a
      // caminho, e um segundo toque nao pode pedir uma terceira. Voltar ao
      // terminal continua valendo — `abandonRun` invalida o ticket em voo, que
      // e justamente o que "mudei de ideia" significa aqui.
      const action = endScreenAction(endRegions, armed);
      if (action === 'restart' && !authorizing) {
        // Cada tentativa e uma expedicao NOVA: ticket novo, runId novo, tuning
        // relido do perfil. Reusar o anterior deixaria a segunda run tentando
        // liquidar contra um runId ja fechado — e daria ao jogador um Prospector
        // desatualizado se ele tivesse comprado alguma coisa no intervalo.
        void authorizeExpedition(nextSeed(), myDescent).then((next) => {
          if (myDescent !== descentToken) return;
          recorder.start(next.seed);
          telemetry.begin();
          state = createRun({ seed: next.seed, tuning: next.tuning, depth: next.depth });
          liveRun = state;
          rearm();
          audio.reset();
          resetRunTracking();
          gate.reset();
        });
      } else if (action === 'terminal') {
        audio.ui();
        abandonRun();
      }
      accumulator = 0;
      requestAnimationFrame(frame);
      return;
    }

    while (accumulator >= TICK_MS) {
      const raw = input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        raw.choose = queuedChoice;
        queuedChoice = null;
      }
      // A assistencia de combate (IA-04/05/X) resolve o comando ANTES do
      // recorder: o log grava — e o servidor re-simula — o comando ja
      // resolvido, entao a trilha inteira e invisivel para a simulacao. No
      // co-op ela nao existe: la todo mundo desce G-00 de fabrica.
      applyCombatAssist(state, raw, input.consumeAimTap(), assistMemory);
      // O recorder fica NO CAMINHO, e nao ao lado: `capture` devolve o comando
      // quantizado, e e esse que a simulacao recebe. Gravar de um lado e
      // simular de outro produziria um log que, re-simulado no servidor,
      // diverge do que o jogador viveu — e a run honesta voltaria recusada.
      const cmd = recorder.capture(raw);
      // O eco OBSERVA o comando; nao o consome. O `interact` segue inteiro para
      // a simulacao — parear com uma caixa-preta nao pode custar ao jogador o
      // revive, a descida ou a extracao que ele pediu no mesmo aperto.
      if (cmd.interact) deathEchoes.pressInteract();
      const result = stepRun(state, [cmd]);
      playout.capture(state);
      eventQueue.push(state.tick, result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    const alpha = accumulator / TICK_MS;
    // O que se desenha e o instante ENTRE os dois ultimos ticks; o que a
    // simulacao guarda continua sendo `state`, e e nele que o recorder e a
    // telemetria continuam olhando — eles falam de decisao, e decisao acontece
    // no tick, nao no quadro.
    //
    // A run que acaba DENTRO deste quadro e a excecao: nao ha instante
    // intermediario que valha mostrar, e quem le o estado terminal aqui — o Eco
    // que se grava, o sumario que se congela — tem de ler o de verdade, e nao um
    // mundo meio tick atras dele.
    const view = state.phase === 'running' ? (playout.sample(state, alpha) ?? state) : state;
    // Depois da vista montada e antes de desenhar, como no co-op: quem ouve os
    // eventos desenha FX em cima do mundo que acabou de ser preparado.
    eventQueue.flush(view.tick);
    // A escolha vem da VISTA, e nao do estado vivo: quem atrasa a revelacao dos
    // cards e o `salvage_cache_opened`, que agora espera a linha de render. Lida
    // do presente, a escolha existiria um tick antes do evento que a anuncia —
    // os cards apareceriam por um quadro com a revelacao ainda zerada, sumiriam
    // quando o evento finalmente pedisse os 920 ms de espera, e um toque rapido
    // escolheria um modulo naquela brecha.
    const pendingChoice = view.playerExtra.pendingModuleChoice;
    // Toques comuns sao drenados; durante uma escolha, a fila pertence aos cards.
    if (!pendingChoice && gate.frame(now, false).drain) input.clearPendingUiInput();
    audio.update(view, now);
    renderState(view, 1, input.state, now);
    // O anel de cooldown fica no estado VIVO de proposito, e por dois motivos.
    // Ele responde "posso arrancar AGORA?", que e pergunta da linha do input e
    // nao da do desenho; e ele guarda predicao entre quadros comparando a
    // IDENTIDADE do estado para detectar run nova — servido de uma vista, que e
    // objeto novo a cada quadro, ele se daria por reiniciado sempre e o pulso de
    // pronto nunca chegaria a acontecer.
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    controlBar.render(
      state,
      input.state,
      now,
      window.innerWidth,
      window.innerHeight,
      safeInsets.bottom,
    );
    if (pendingChoice && renderer.isChoiceRevealReady(now)) {
      const regions = renderer.renderChoice(view, vw, vh, input.state);
      const choice = input.consumeChoiceTap(regions);
      if (choice !== null) queuedChoice = choice;
    } else if (pendingChoice) {
      input.clearPendingChoiceInput();
    }
    requestAnimationFrame(frame);
  };
  return {
    // Sob o preto do véu: a escotilha abre sobre o setor ja desenhado, nunca
    // sobre um canvas vazio.
    firstFrame: (): void => {
      frameNow = performance.now();
      renderState(playout.sample(state, 0) ?? state, 1, input.state, frameNow);
    },
    start: (): void => {
      // `lastTime` renasce aqui: o tempo que o véu segurou nao e divida de
      // simulacao — o mundo comeca a andar AGORA, nao 1,7 s atras.
      lastTime = performance.now();
      requestAnimationFrame(frame);
      stopLoop = () => {
        running = false;
      };
    },
  };
};

// ---------------------------------------------------------------------------
// ONLINE (servidor autoritativo; solo permanece disponivel offline)
// ---------------------------------------------------------------------------
const defaultServerUrl = (): string => {
  // 1) override em runtime por query (?server=)  2) build-time (VITE_SERVER_URL)
  // 3) fallback local
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = (import.meta.env as Record<string, string | undefined>).VITE_SERVER_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:8080`;
};

/**
 * Prepara a descida online: abre a run na telemetria, cria o socket e monta o
 * laco — que so anda quando o véu chamar `start`. `null` quando o socket nem
 * nasceu (URL malformada): o banner de erro ja esta na tela e o menu NUNCA
 * saiu dela — nao ha "voltar" a fazer.
 */
const runOnline = (url: string, roomCode: string | null): PreparedRun | null => {
  resetRunTracking();
  // O co-op tem de abrir a run na telemetria igual ao solo.
  //
  // O caminho online so chamava `finish()`. Sem o `begin()` correspondente, todo
  // evento saia com `runIndex = 0` — que o servidor grampeia em 1 em silencio —
  // entao a decima run online era indistinguivel da primeira e o intervalo entre
  // runs nunca era medido. A sessao inteira aparecia como uma unica partida.
  //
  // Aqui e nao dentro do socket de proposito: `connect()` e reexecutado a cada
  // reconexao, e reconectar na MESMA sala e a mesma run. Este ponto e a entrada
  // numa sala nova, que e o que abre uma run de verdade.
  telemetry.begin();
  let ws: WebSocket | null = null;
  let running = true;
  let lastTime = performance.now();
  let reconnectAt = 0;
  let fatal = false; // erro sem retry (versao incompativel, URL invalida)
  /** O socket nem chegou a nascer: nao ha loop a montar. */
  let startupFailed = false;
  const gate = new RestartGate(RESTART_ARM_MS);
  let queuedChoice: 0 | 1 | null = null;
  // Ultimo estado amostrado, guardado para o audio posicionar o ouvinte.
  // Os eventos chegam por `ws.onmessage`, fora do quadro, entao nao ha estado
  // "atual" ali — usar o do quadro anterior erra a posicao do ouvinte em no
  // maximo um quadro, que e menos que a resolucao do paneamento.
  let lastState: SurvivalState | null = null;

  // NetClient PERSISTENTE entre reconexoes: preserva resumeToken e a sequencia
  // de comandos. Se recriado a cada retry, o cliente enviaria seqs baixas que o
  // SequenceGate do servidor descartaria, travando os controles apos reconectar.
  const net = new NetClient((raw) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(raw);
  });
  // Sobrevive as reconexoes: a primeira queda de rede jogaria o jogador numa
  // sala qualquer, longe do parceiro, se o codigo vivesse so nesta chamada.
  net.roomCode = roomCode;
  net.onEvents = (events) => {
    const now = performance.now();
    renderer.ingestEvents(events, now);
    audio.ingest(events, now, lastState ?? undefined);
    haptics(events);
  };
  // Nem todo reject e recuperavel. Incompatibilidade de versao (o servidor
  // marca o campo) nunca melhora com retry: o cliente e antigo. Reconectar em
  // loop so gera churn durante um deploy — melhor parar e pedir recarga.
  net.onReject = (reason, field) => {
    if (field) {
      fatal = true;
      setBanner(t('banner.version.mismatch', { field }), 'error');
      ws?.close();
      return;
    }
    setBanner(t('banner.session.expired'));
    ws?.close();
  };
  net.onDiverged = () => setBanner(t('banner.resync'), 'info');

  const connect = (): void => {
    setBanner(t(net.resumeToken ? 'banner.reconnecting' : 'banner.connecting'), 'info');
    try {
      // URL malformada ou esquema nao-WebSocket lanca AQUI, de forma sincrona.
      // Sem tratar, o menu ja esta escondido e o loop ainda nao comecou: o
      // jogador fica numa tela morta, sem retry e sem como corrigir a URL.
      ws = new WebSocket(url);
    } catch {
      // So acontece na PRIMEIRA conexao: um reconnect reusa a mesma URL que ja
      // funcionou. O véu ainda esta fechando sobre o menu — que continua sendo
      // a tela certa — entao aqui so se declara a falha; nao ha volta a fazer.
      fatal = true;
      startupFailed = true;
      setBanner(t('banner.server.invalid', { url }), 'error');
      return;
    }
    ws.onopen = () => net.connect(net.resumeToken ?? undefined);
    ws.onmessage = (ev) =>
      net.receive(typeof ev.data === 'string' ? ev.data : '', performance.now());
    ws.onclose = () => {
      net.markOffline();
      if (running && !fatal) reconnectAt = performance.now() + 1500;
    };
    ws.onerror = () => ws?.close();
  };
  connect();
  // URL malformada: nao ha loop a montar. O chamador ve o `null`, mantem o
  // menu na tela e desfaz o anuncio da run — o banner de erro ja diz o resto.
  if (startupFailed) return null;

  const frame = (now: number): void => {
    if (!running) return;
    const delta = Math.min(120, now - lastTime);
    applyAdaptiveQuality(delta);
    lastTime = now;

    if (net.status === 'online') {
      // O codigo so aparece enquanto o parceiro NAO chegou: depois disso ele e
      // ruido permanente na tela, e a informacao que importa passa a ser o
      // jogo. Enquanto se joga sozinho, ele e a unica forma de convidar.
      // O convite so existe enquanto ha vaga: depois que o parceiro entra ele
      // vira ruido permanente na tela, e a informacao que importa passa a ser o
      // jogo.
      showInvite(net.playerCount() < 2 ? net.activeRoomCode : null);
      setBanner(null);
      renderer.setLocalPlayerId(net.slot + 1); // co-op: slot 1 tem id 2
      audio.setLocalPlayerId(net.slot + 1);
      // Com o menu de campo aberto o comando vira NEUTRO, e o loop de rede
      // continua bombeando. As duas coisas sao obrigatorias e por motivos
      // opostos: parar de bombear derrubaria a sessao por timeout e deixaria o
      // parceiro sozinho num mundo que nao para, e mandar o comando real faria
      // o Prospector continuar andando e atirando enquanto o dono dele mexe no
      // volume. Neutro e a unica leitura honesta de "tirei as maos".
      const menuOpen = pauseMenu.isOpen;
      const cmd = menuOpen ? emptyCommand() : input.snapshot(playerScreen());
      if (queuedChoice !== null) {
        cmd.choose = queuedChoice;
        queuedChoice = null;
      }
      if (cmd.interact) deathEchoes.pressInteract();
      net.setCommand(cmd);
      net.pump(now);
      const state = net.sampleRenderState(now);
      if (state) {
        lastState = state;
        liveRun = state;
        const terminal = state.phase !== 'running';
        audio.update(state, now);
        renderState(state, 1, input.state, now);
        cooldownOverlay.render(state, input.state, state.tick, now);
        controlBar.render(
          state,
          input.state,
          now,
          window.innerWidth,
          window.innerHeight,
          safeInsets.bottom,
        );
        const pendingChoice = state.playerExtra.pendingModuleChoice;
        if (pendingChoice && renderer.isChoiceRevealReady(now)) {
          const regions = renderer.renderChoice(
            state,
            window.innerWidth,
            window.innerHeight,
            input.state,
          );
          const choice = menuOpen ? null : input.consumeChoiceTap(regions);
          if (choice !== null) queuedChoice = choice;
        } else if (pendingChoice) {
          input.clearPendingChoiceInput();
        }
        const { drain, armed } = gate.frame(now, terminal);
        if (drain && !pendingChoice) input.clearPendingUiInput();
        if (terminal) {
          recordRun(state);
          if (state.summary) telemetry.finish(state.summary, state.sector);
          const endRegions = renderer.renderEnd(
            state,
            window.innerWidth,
            window.innerHeight,
            now,
            { input: input.state },
          );
          // a sala acabou: reiniciar significa entrar numa sala NOVA. Descarta o
          // resume token (senao o hello reentraria nesta mesma sala terminal) e
          // reabre o socket — o matchmaking so considera salas 'running'.
          const action = endScreenAction(endRegions, armed);
          if (action === 'restart') {
            gate.reset();
            audio.reset();
            resetRunTracking();
            // Sala nova e run nova: mesmo `begin()` da entrada, pelo mesmo
            // motivo — e daqui que sai o intervalo ate o reinicio.
            telemetry.begin();
            setBanner(t('banner.restarting'), 'info');
            net.resetSession();
            ws?.close(); // onclose agenda o reconnect, agora sem token
          } else if (action === 'terminal') {
            // Sair fecha o socket para valer: `abandonRun` chama o `stopLoop`
            // desta descida, que e quem derruba a conexao. Sem isso o cliente
            // ficaria reconectando a uma sala terminal por tras do menu.
            audio.ui();
            abandonRun();
          }
        }
      }
    } else {
      if (fatal) {
        requestAnimationFrame(frame);
        return; // banner ja explica; nao insiste
      }
      setBanner(
        t(net.status === 'reconnecting' ? 'banner.reconnecting' : 'banner.offline'),
        net.status === 'reconnecting' ? 'info' : 'offline',
      );
      if (reconnectAt && now >= reconnectAt && (!ws || ws.readyState === WebSocket.CLOSED)) {
        reconnectAt = 0;
        connect();
      }
    }
    requestAnimationFrame(frame);
  };
  return {
    // Online nao tem mundo antes do primeiro snapshot: o "primeiro quadro" e o
    // canvas escuro com o banner de conexao — que ja esta montado no DOM.
    firstFrame: (): void => {},
    start: (): void => {
      lastTime = performance.now();
      requestAnimationFrame(frame);
      stopLoop = () => {
        running = false;
        showInvite(null);
        ws?.close();
      };
    },
  };
};

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
qualitySelect.addEventListener('change', () => {
  quality = qualitySelect.value as QualityLevel;
  renderer.setQuality(quality);
  saveQuality(quality);
});

/**
 * O clique que inicia a run e o gesto que destrava o audio.
 *
 * Este e o unico momento garantido: o auto-start por query (?solo=1) NAO conta
 * como gesto, entao naquele caminho o contexto so nasce no primeiro toque
 * dentro do jogo — e por isso `unlock` tambem e chamado pelo input.
 */
const startSolo = (contract: DeathEchoContract | null = null): void => {
  // Ja ha um despacho no ar: Enter repetido no carimbo (ou dois toques) nao
  // pode emitir segunda autorizacao. O clique e descartado, nao enfileirado.
  if (veilActive()) return;
  // A modalidade e declarada por quem INICIA a run, e nao herdada do que o
  // servidor anunciou: descer normalmente sempre significa pool geral, mesmo com
  // um contrato aberto na tela.
  contractRun = contract;
  audio.unlock();
  audio.ui();
  // O despacho INTEIRO passa pelo véu: a autorizacao e a montagem do mundo
  // correm enquanto a colmeia fecha; a troca de telas e o primeiro quadro
  // acontecem sob o preto; e o laco so anda quando a escotilha reabre e os
  // controles voltam — nada progride por fora da sequencia.
  let run: PreparedRun | null = null;
  void deployVeil({
    sound: veilSound,
    prepare: async () => {
      stopLoop?.();
      runInProgress = true;
      run = await prepareSolo();
      // Autorizacao superada (outra descida ja e a atual): o anuncio se desfaz
      // e o swap mantem o terminal na tela.
      if (!run) runInProgress = false;
    },
    swap: () => {
      if (!run) return;
      menu.classList.add('hidden');
      run.firstFrame();
    },
  }).then((ran) => {
    if (!ran || !run) return;
    pauseMenu.armHistory();
    run.start();
    hintOnce();
  });
};
const startOnline = (): void => {
  if (veilActive()) return;
  const code = normalizeRoomCode(roomInput.value);
  if (code !== '' && !isValidRoomCode(code)) {
    setBanner(t('banner.room.invalid', { code }), 'error');
    setTimeout(() => setBanner(null), 2400);
    return;
  }
  contractRun = null;
  audio.unlock();
  audio.ui();
  // Mesma sequencia do solo; aqui o `prepare` cria o socket — a conexao viaja
  // enquanto a colmeia fecha, e uma URL malformada falha AINDA NO MENU, sem
  // nunca deixar o jogador numa tela morta.
  let run: PreparedRun | null = null;
  void deployVeil({
    sound: veilSound,
    prepare: () => {
      stopLoop?.();
      runInProgress = true;
      run = runOnline(serverInput.value.trim() || defaultServerUrl(), code || null);
      if (!run) runInProgress = false;
    },
    swap: () => {
      if (!run) return;
      menu.classList.add('hidden');
      run.firstFrame();
    },
  }).then((ran) => {
    if (!ran || !run) return;
    pauseMenu.armHistory();
    run.start();
    hintOnce();
  });
};

// Rede de seguranca para o auto-start por query e para browsers que exigem um
// gesto DENTRO do documento: qualquer primeiro toque/tecla destrava o audio.
// `once` porque depois disso o unlock e responsabilidade do ciclo de vida.
for (const evt of ['pointerdown', 'keydown'] as const) {
  window.addEventListener(evt, () => audio.unlock(), { once: true, passive: true });
}

/**
 * Descer no contrato coletivo: a mesma seed que todo mundo recebeu hoje.
 *
 * Fixa `forcedSeed`, e isso e a implementacao inteira do "mesmo mapa para todos".
 * Nao ha mundo persistido, servidor de terreno nem estado compartilhado — a run e
 * reproduzivel por um numero, e os tres setores derivam dele. Publicar o numero
 * basta.
 *
 * A seed sobrevive aos reinicios, como qualquer seed fixada: a razao de existir um
 * contrato e tentar o MESMO mapa de novo depois de morrer nele.
 */
/**
 * O rotulo do desafio no idioma do jogador.
 *
 * O campo `label` que vem do servidor e ignorado de proposito: ele nasce em
 * portugues, do lado que nao sabe em que lingua este cliente esta. As PARTES —
 * periodo e nome do veio — sao o dado, e a frase e remontada aqui.
 */
const contractText = (contract: DeathEchoContract): string => {
  const parts = deathEchoContractLabelParts(contract.id, contract.cadence);
  return t(parts.cadence === 'weekly' ? 'contract.weekly' : 'contract.daily', {
    period: parts.period,
    vein: parts.vein,
  });
};

const startContract = (): void => {
  const contract = advertisedContract;
  if (!contract) return;
  forcedSeed = contract.seed;
  seedInput.value = formatSeed(contract.seed);
  setBanner(contractText(contract));
  setTimeout(() => setBanner(null), 3200);
  startSolo(contract);
};

// ---------------------------------------------------------------------------
// Inducao do operador
// ---------------------------------------------------------------------------
const inductionOverlay = document.getElementById('induction') as HTMLDivElement;
const inductionBody = document.getElementById('induction-body') as HTMLDivElement;

/**
 * Abre a circular. Em `briefing` ela SEGURA a descida ate o jogador autorizar.
 *
 * O `onDismiss` recebe o que fazer depois em vez de decidir aqui: e a mesma
 * circular nos dois usos, e o que muda entre "li antes de descer" e "reabri no
 * despacho" e so o que acontece quando ela fecha.
 */
const openInduction = (mode: InductionMode, after: () => void): void => {
  renderInduction(inductionBody, {
    mode,
    onDismiss: () => {
      markInductionSeen();
      inductionOverlay.classList.add('hidden');
      menu.classList.remove('hidden');
      audio.ui();
      after();
    },
  });
  openOverlay(inductionOverlay);
};

/**
 * Entrega a circular ANTES da primeira descida, uma vez por navegador.
 *
 * Antes do veu de deploy de proposito: o veu e o corte entre o terminal e o
 * Veio, e uma tela de leitura DEPOIS dele seria a companhia interrompendo uma
 * queda que ja aconteceu. Quem ja leu desce direto — a circular nunca fica no
 * caminho duas vezes.
 */
const withInduction = (descend: () => void): void => {
  if (inductionSeen()) {
    descend();
    return;
  }
  openInduction('briefing', descend);
};

document.getElementById('btn-induction')?.addEventListener('click', () => {
  openInduction('archive', () => {});
});
document
  .getElementById('btn-induction-close')
  ?.addEventListener('click', () => closeOverlay(inductionOverlay));

// `() => startSolo()` e nao `startSolo`: o handler receberia o MouseEvent como
// primeiro argumento e o contrato passaria a ser um evento de clique.
document
  .getElementById('btn-solo')
  ?.addEventListener('click', () => withInduction(() => startSolo()));
document.getElementById('btn-online')?.addEventListener('click', () => withInduction(startOnline));
contractButton.addEventListener('click', () => withInduction(startContract));
serverInput.placeholder = defaultServerUrl();

/**
 * Anuncia o contrato do dia, se houver servidor.
 *
 * O botao nasce escondido e so aparece quando um contrato responde: sem pool, ele
 * prometeria uma experiencia comunitaria — pisar onde outros morreram — que o
 * cliente sozinho nao entrega. Falha em silencio, como todo o resto do caminho de
 * rede: o jogo principal e offline.
 */
void fetchDeathEchoContract(serverInput.value.trim() || defaultServerUrl()).then((contract) => {
  if (!contract) return;
  advertisedContract = contract;
  contractLabel.textContent = contractText(contract);
  contractButton.classList.remove('hidden');
  contractLabel.classList.remove('hidden');
});

// ---------------------------------------------------------------------------
// Seed e registro
// ---------------------------------------------------------------------------
const syncSeedFromInput = (): void => {
  forcedSeed = parseSeed(seedInput.value);
  // Normaliza para hex assim que a seed e aceita: o campo passa a mostrar
  // exatamente o texto que a tela de fim imprime, que e o que se compartilha.
  if (forcedSeed !== null) seedInput.value = formatSeed(forcedSeed);
};
seedInput.addEventListener('change', syncSeedFromInput);

// ?seed= permite mandar um link para a mesma descida, nao so o numero.
const seedParam = new URLSearchParams(location.search).get('seed');
if (seedParam) {
  seedInput.value = seedParam;
  syncSeedFromInput();
}

// O menu SAI enquanto o registro esta aberto. As duas overlays usam o mesmo
// fundo a 92% de opacidade, entao empilhadas o titulo "VOXELYN SURVIVAL"
// aparecia atras de "REGISTRO" — legivel o bastante para parecer defeito.
// As overlays sao mutuamente exclusivas: empilhadas, o fundo a 92% deixa o
// titulo da de tras aparecer atras do da frente e le como defeito.
const openOverlay = (overlay: HTMLDivElement): void => {
  menu.classList.add('hidden');
  overlay.classList.remove('hidden');
  audio.unlock();
  audio.ui();
};
const closeOverlay = (overlay: HTMLDivElement): void => {
  overlay.classList.add('hidden');
  menu.classList.remove('hidden');
  audio.ui();
};

/**
 * A ponte Registro → Codex, montada na hora do desenho para carregar o perfil
 * mais recente. `onViewDocs` e a navegacao inteira: fecha o Registro, poe a
 * Matriz na aba de Arquivos com o filtro do contexto, abre e foca o primeiro
 * documento relevante — e liga `codexReturn` para o caminho de volta existir.
 */
const recordsCodexLink = (): RecordsCodexLink => ({
  profile: matrixView.profile,
  onViewDocs: (context) => {
    recordsOverlay.classList.add('hidden');
    matrixView.tab = 'codex';
    matrixView.codexContext = context;
    matrixView.codexReturn = true;
    matrixView.notice = null;
    // O foco vai para o primeiro documento NOVO do contexto; sem novidade,
    // para o primeiro desbloqueado. A lista ja vem do servidor em ordem de
    // cronologia, entao "primeiro" e o comeco da historia daquele Ativo.
    const ids = contextDocIds(context);
    const read = new Set(matrixView.profile?.readLoreFragmentIds ?? []);
    openCodexDocument(ids.find((id) => !read.has(id)) ?? ids[0] ?? null);
    drawMatrix();
    matrixOverlay.classList.remove('hidden');
    audio.ui();
    void refreshCodex();
  },
});

/** Os ids do contexto, na ordem do indice do servidor. */
const contextDocIds = (context: CodexContext): string[] => {
  const index = matrixView.profile?.loreIndex;
  if (!index) return [];
  if (context.kind === 'asset') return index.assets?.[context.archetype] ?? [];
  if (context.kind === 'discovery') return index.discoveries?.[String(context.bit)] ?? [];
  return [];
};

const renderRecords = (): void =>
  renderRecordsPanel(recordsBody, records, renderer.sprites, recordsCodexLink());

document.getElementById('btn-records')?.addEventListener('click', () => {
  renderRecords();
  openOverlay(recordsOverlay);
  // O "Ver docs" e a bolinha dependem do perfil autoritativo; se ele ainda nao
  // veio nesta sessao, busca em segundo plano e redesenha por cima. O Registro
  // continua 100% funcional offline enquanto isso.
  if (!matrixView.profile || matrixView.cached) {
    void refreshProfile().then(() => {
      if (!recordsOverlay.classList.contains('hidden')) renderRecords();
    });
  }
});
document
  .getElementById('btn-records-close')
  ?.addEventListener('click', () => closeOverlay(recordsOverlay));

// ---------------------------------------------------------------------------
// Matriz Geracional
// ---------------------------------------------------------------------------
const matrixOverlay = document.getElementById('matrix') as HTMLDivElement;
const matrixBody = document.getElementById('matrix-body') as HTMLDivElement;

/**
 * O estado do painel. NAO e o estado da progressao.
 *
 * `profile` e sempre o que o servidor mandou por ultimo (ou o cache, marcado
 * como tal). Nenhuma acao deste painel escreve nele: a compra manda a intencao
 * e espera a resposta, que substitui o objeto inteiro.
 */

/**
 * O CARIMBO DE AUTORIZACAO do menu: geracao, profundidade, Nucleos.
 *
 * Existe porque a profundidade passou a ser consequencia da progressao, e uma
 * consequencia que o jogador so descobre descendo nao e uma recompensa — e uma
 * surpresa. Tres linhas antes de "Descer" e o suficiente: elas dizem sob que
 * autorizacao esta run vai correr.
 *
 * Informativo, nunca um seletor. A geracao continua sendo derivada dos
 * protocolos comprados, e nao ha nada aqui para escolher. Some inteiro quando
 * nao ha perfil (primeira visita, sessao offline): um carimbo com valores
 * inventados seria pior que carimbo nenhum.
 */
const renderDescentClearance = (): void => {
  const el = document.getElementById('descent-clearance');
  if (!el) return;
  const profile = readCachedProfile()?.profile ?? null;
  if (!profile) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  const depth = runDepthForGeneration(profile.generation);
  el.classList.remove('hidden');
  el.textContent = [
    t('menu.clearance.generation', { generation: profile.generation }),
    t('menu.clearance.depth', { sectors: depth.sectorCount }),
    t('menu.clearance.cores', { cores: depth.coreSectors.length }),
  ].join('\n');
};

const matrixView: MatrixViewState = {
  tab: 'matrix',
  profile: readCachedProfile()?.profile ?? null,
  cached: true,
  // Ainda nao perguntamos: nao ha falha para explicar, e nomear uma seria
  // inventar diagnostico.
  stale: null,
  codexNotice: null,
  loading: false,
  codex: null,
  pending: null,
  notice: null,
  reveal: null,
  codexContext: { kind: 'all' },
  codexReturn: false,
};

const drawMatrix = (): void => renderMatrixPanel(matrixBody, matrixView, matrixHandlers);

const progressionUrl = (): string => serverInput.value.trim() || defaultServerUrl();

/**
 * Qual consulta da Matriz e a ATUAL, e contra qual servidor.
 *
 * Mesma familia do token de descida — ver `latest-query.ts` para as tres vezes
 * em que esta corrida apareceu. Aqui o caso concreto: o campo de servidor e
 * editavel, entao abrir a Matriz para o servidor A, fechar, trocar o campo e
 * abrir para o B deixa duas consultas no ar. A de A, resolvendo depois,
 * substituia o perfil de B e ainda o marcava como autoritativo — e a compra
 * seguinte ia para o B carregando a arvore e a `profileVersion` do A, debitando
 * o B quando as versoes por acaso batessem.
 */
/**
 * UM RASTREADOR POR OPERACAO, e nao um compartilhado.
 *
 * A primeira versao usava um contador so para as tres, e isso e errado pela
 * definicao do mecanismo: ele existe para dizer "chegou outra do MESMO tipo,
 * esta aqui envelheceu". Abrir o Codex nao envelhece um refresh de perfil — sao
 * perguntas diferentes, e a resposta de uma nao substitui a da outra.
 *
 * O estrago de compartilhar era pior que uma resposta perdida: a do perfil era
 * descartada com `loading` ainda em true (painel presa em "Consultando"), e uma
 * compra ja debitada no servidor deixava `pending` preso para sempre, porque so
 * o callback pulado o limpava — e nem fechar e reabrir o painel resolvia.
 */
const profileQueries = new LatestQuery<string>();
const codexQueries = new LatestQuery<string>();
const purchaseQueries = new LatestQuery<string>();

const beginQuery = (tracker: LatestQuery<string>): Query<string> => tracker.begin(progressionUrl());

const isCurrentQuery = (tracker: LatestQuery<string>, query: Query<string>): boolean =>
  tracker.isCurrent(query, progressionUrl());

/**
 * O aviso que o painel mostra para uma falha da API.
 *
 * Um lugar so, porque sao TRES desfechos com acoes diferentes e antes os tres
 * saiam como "conexao indisponivel":
 *
 * - `offline`: nao chegou resposta. Espere a rede.
 * - `bad_server_url`: o endereco e invalido e a chamada nem saiu — nada foi
 *   perguntado a servidor nenhum, entao dizer que a Aurix recusou seria mentira.
 * - qualquer outro: a Aurix respondeu e recusou, e o codigo diz para onde olhar.
 *
 * O codigo nao e texto de jogador, e diagnostico — e era justamente o que
 * faltava para responder "e agora, o que eu conserto?" sem abrir o DevTools.
 */
const failureNotice = (result: { error: string; status?: number }): PanelNotice => {
  if (result.error === 'offline') return { key: 'matrix.offline' };
  if (result.error === 'bad_server_url') return { key: 'matrix.badUrl' };
  const code = result.status === undefined ? result.error : `${result.error} ${result.status}`;
  return { key: 'matrix.refused', params: { code } };
};

/** Busca o perfil autoritativo e SUBSTITUI o que estava na tela. */
const refreshProfile = async (): Promise<void> => {
  retryPendingSettlement();
  const query = beginQuery(profileQueries);
  matrixView.loading = true;
  drawMatrix();
  const result = await openSession(query.scope);
  // Chegou tarde, ou o jogador trocou de servidor: descarta sem tocar em nada.
  // Nem `loading` — quem for a consulta atual cuida do proprio estado.
  if (!isCurrentQuery(profileQueries, query)) return;
  matrixView.loading = false;
  if (!result.ok) {
    // Continua mostrando o cache, marcado, e sem botao de compra — mas agora
    // dizendo QUAL das duas falhas foi. `offline` e a unica que significa "nao
    // chegou resposta"; todo o resto e a Aurix respondendo e recusando, e o
    // codigo dela e o que aponta para onde olhar.
    matrixView.cached = true;
    matrixView.stale = failureNotice(result);
    matrixView.notice = null;
    drawMatrix();
    return;
  }
  matrixView.profile = result.value.profile;
  matrixView.cached = false;
  matrixView.stale = null;
  writeCachedProfile(result.value.profile, Date.now());
  renderer.setProspectorGeneration(result.value.profile.generation);
  renderDescentClearance();
  drawMatrix();
};

const refreshCodex = async (): Promise<void> => {
  const query = beginQuery(codexQueries);
  // A falha ANTERIOR sai da tela antes da pergunta nova, e nao depois dela.
  //
  // Mantida, ela seria mostrada durante toda a consulta seguinte — e o pior caso
  // e o unico que o jogador realmente vive: ele corrige o endereco do servidor,
  // reabre a aba, e continua lendo a reclamacao sobre o endereco que acabou de
  // consertar, ate a resposta nova chegar.
  matrixView.codexNotice = null;
  drawMatrix();
  const result = await fetchCodex(query.scope, getLocale());
  if (!isCurrentQuery(codexQueries, query)) return;
  matrixView.codex = result.ok ? result.value : null;
  matrixView.codexNotice = result.ok ? null : failureNotice(result);
  drawMatrix();
};

const matrixHandlers: MatrixHandlers = {
  onTab: (tab) => {
    matrixView.tab = tab;
    matrixView.notice = null;
    drawMatrix();
    audio.ui();
    // O codex e buscado sob demanda: o corpo dos documentos so sai do servidor
    // para quem tem autorizacao, e nao ha por que pedi-lo antes de abrir a aba.
    if (tab === 'codex') void refreshCodex();
  },
  onPurchase: (upgrade) => {
    const profile = matrixView.profile;
    if (!profile || matrixView.pending) return;
    if (
      needsConfirmation(upgrade) &&
      !confirm(
        `${t('matrix.confirm.title')}\n\n${t('matrix.confirm.cost', {
          ore: upgrade.oreCost,
          cores: upgrade.coreCost,
        })}\n${t('matrix.confirm.warning')}`,
      )
    ) {
      return;
    }
    matrixView.pending = upgrade.id;
    matrixView.notice = null;
    drawMatrix();
    const query = beginQuery(purchaseQueries);
    void purchaseUpgrade(
      query.scope,
      upgrade.id,
      profile.profileVersion,
      purchaseKey(profile.profileId, upgrade.id, profile.profileVersion),
    ).then((result) => {
      // Uma compra respondida depois de o jogador trocar de servidor ja foi
      // cobrada la — mas o perfil que ela devolve nao descreve o servidor que
      // esta na tela, e escreve-lo aqui mostraria a arvore do lugar errado.
      if (!isCurrentQuery(purchaseQueries, query)) return;
      matrixView.pending = null;
      if (!result.ok) {
        // Conflito de versao nao e erro do jogador: outra sessao mexeu na
        // Matriz. Recarrega e explica, em vez de tentar de novo sozinho.
        if (result.error === 'profile_version_conflict') {
          matrixView.notice = { key: 'matrix.conflict' };
          void refreshProfile();
          return;
        }
        // Mesma separacao do aviso de topo: `offline` e a unica falha que
        // significa "nao chegou resposta". Saldo insuficiente, teto de
        // requisicoes e protocolo desconhecido sao a Aurix respondendo, e
        // chamar isso de conexao indisponivel mandava o jogador conferir a rede
        // por um problema que nao estava nela.
        matrixView.notice = failureNotice(result);
        drawMatrix();
        return;
      }
      matrixView.profile = result.value.profile;
      matrixView.cached = false;
      matrixView.stale = null;
      writeCachedProfile(result.value.profile, Date.now());
      matrixView.codex = null; // desatualizado: um documento novo entrou
      matrixView.codexNotice = null;
      matrixView.reveal = result.value.unlockedLoreFragment;
      // A revelacao mostra o corpo inteiro na tela: e leitura inequivoca, e o
      // documento nao pode renascer com bolinha de "novo" depois disso.
      if (result.value.unlockedLoreFragment) markDocumentRead(result.value.unlockedLoreFragment);
      drawMatrix();
      audio.ui();
    });
  },
  onDismissReveal: () => {
    matrixView.reveal = null;
    drawMatrix();
    audio.ui();
  },
  onCodexContext: (context) => {
    // O documento aberto NAO e limpo aqui: seguir um link de relacionado para
    // fora do filtro passa por este handler com { kind: 'all' }, e limpar o
    // aberto engoliria exatamente a navegacao que o clique pediu. Quem limpa
    // o estado transitorio e a abertura normal da Matriz e o retorno ao
    // Registro.
    matrixView.codexContext = context;
    drawMatrix();
    audio.ui();
  },
  onOpenDocument: (fragment) => {
    markDocumentRead(fragment);
  },
  onReturnToRecords: () => {
    // A volta desfaz a navegacao contextual inteira: o proximo uso do botao da
    // Matriz nao pode herdar um filtro que o jogador nem lembra de ter posto.
    matrixView.codexReturn = false;
    matrixView.codexContext = { kind: 'all' };
    openCodexDocument(null);
    matrixOverlay.classList.add('hidden');
    renderRecords();
    recordsOverlay.classList.remove('hidden');
    audio.ui();
  },
};

/**
 * Marca leitura: na tela AGORA, no servidor atras.
 *
 * O estado local muda primeiro porque a bolinha e apresentacao pura — nada de
 * gameplay depende dela, entao o unico custo de uma falha do POST e a bolinha
 * voltar na proxima sessao, que e exatamente o que "o servidor nao confirmou"
 * deve significar. O perfil local acompanha para as bolinhas do Registro e da
 * aba sumirem juntas.
 */
const markDocumentRead = (fragment: PublicLoreFragment): void => {
  if (fragment.read) return;
  fragment.read = true;
  const profile = matrixView.profile;
  if (profile) {
    // O `??=` cobre o perfil hidratado de um cache anterior a este campo.
    profile.readLoreFragmentIds ??= [];
    if (!profile.readLoreFragmentIds.includes(fragment.id)) {
      profile.readLoreFragmentIds.push(fragment.id);
      writeCachedProfile(profile, Date.now());
    }
  }
  void markLoreRead(progressionUrl(), fragment.id);
};

document.getElementById('btn-matrix')?.addEventListener('click', () => {
  // Abrir o painel LIMPA o estado transitorio, e nao so o desenha.
  //
  // Rede de seguranca, e nao correcao do bug acima: qualquer caminho futuro que
  // deixe `pending` ou `loading` presos deixaria a Matriz inutilizavel ate um
  // reload, e "feche e abra de novo" precisa funcionar. Reabilitar o botao e
  // seguro porque a chave de idempotencia da compra e derivada do perfil e do
  // protocolo — um segundo clique sobre uma compra que ja passou recebe de volta
  // o mesmo resultado, sem debitar duas vezes.
  matrixView.pending = null;
  matrixView.loading = false;
  matrixView.notice = null;
  // A navegacao contextual (Registro → Codex) tambem e estado transitorio:
  // fechar a Matriz pelo botao normal nao passa pelo retorno ao Registro, e
  // sem esta limpeza a proxima abertura pelo menu herdaria o filtro e o botao
  // de voltar de uma visita que ja acabou.
  matrixView.codexContext = { kind: 'all' };
  matrixView.codexReturn = false;
  openCodexDocument(null);
  drawMatrix();
  openOverlay(matrixOverlay);
  void refreshProfile();
});
document
  .getElementById('btn-matrix-close')
  ?.addEventListener('click', () => closeOverlay(matrixOverlay));

const renderTelemetryLabel = (): void => {
  telemetryButton.textContent = t(isOptedOut() ? 'options.telemetry.off' : 'options.telemetry.on');
  telemetryButton.classList.toggle('primary', !isOptedOut());
};
renderTelemetryLabel();
telemetryButton.addEventListener('click', () => {
  setOptedOut(!isOptedOut());
  renderTelemetryLabel();
  audio.ui();
});

document.getElementById('btn-options')?.addEventListener('click', () => {
  // O bloco pode estar montado no menu de campo (a run anterior foi abandonada
  // por ali). Trazer de volta antes de abrir e o que garante que a tela de
  // opcoes nunca apareca vazia.
  mountOptions(optionsSlot);
  openOverlay(optionsOverlay);
});
document
  .getElementById('btn-options-close')
  ?.addEventListener('click', () => closeOverlay(optionsOverlay));

document.getElementById('btn-rank')?.addEventListener('click', () => {
  // Abre com estado de carregamento em vez de esperar a rede: um botao que nao
  // responde por dois segundos le como travado, e o solo funciona offline —
  // este painel pode legitimamente nunca carregar.
  renderRankPanel(rankBody, {
    entries: [],
    emptyReason: t('rank.loading'),
    seed: forcedSeed ?? undefined,
    loading: true,
  });
  openOverlay(rankOverlay);
  const url = serverInput.value.trim() || defaultServerUrl();
  void fetchLeaderboard(url, { seed: forcedSeed ?? undefined, limit: 25 }).then((entries) => {
    if (rankOverlay.classList.contains('hidden')) return; // jogador ja fechou
    renderRankPanel(rankBody, {
      entries,
      seed: forcedSeed ?? undefined,
      emptyReason: t('rank.empty.offline'),
    });
  });
});
document
  .getElementById('btn-rank-close')
  ?.addEventListener('click', () => closeOverlay(rankOverlay));

// ---------------------------------------------------------------------------
// Trilho de arquivo (doc AD-UI-2.0)
// ---------------------------------------------------------------------------
// O monograma no topo de cada trilho. Montado por codigo, e nao inline no HTML,
// pelo mesmo motivo da placa da pausa: o SVG vive em aurix.ts, unico lugar da
// marca — cada chamada aqui so referencia o `<symbol>` compartilhado, nao
// repete a geometria.
for (const id of [
  'menu-mark',
  'options-mark',
  'induction-mark',
  'records-mark',
  'matrix-mark',
  'rank-mark',
]) {
  const slot = document.getElementById(id);
  if (slot) slot.innerHTML = aurixMarkHtml();
}

// Navegacao lateral entre telas de arquivo. O trilho nao ganha caminho proprio
// de abertura: navegar e fechar a tela atual (pelo botao de fechar que os
// handlers ja escutam) e apertar o botao do menu correspondente — quem carrega
// dados, toca som e esconde o menu continua sendo o handler existente.
const NAV_BUTTON: Record<string, string> = {
  induction: 'btn-induction',
  records: 'btn-records',
  matrix: 'btn-matrix',
  rank: 'btn-rank',
  options: 'btn-options',
};
document.querySelectorAll<HTMLButtonElement>('[data-ax-nav]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = NAV_BUTTON[button.dataset.axNav ?? ''];
    const overlay = button.closest('.overlay');
    if (!target || !overlay) return;
    (document.getElementById(`btn-${overlay.id}-close`) as HTMLButtonElement | null)?.click();
    (document.getElementById(target) as HTMLButtonElement | null)?.click();
  });
});

/**
 * O que a troca de idioma NAO conserta sozinha.
 *
 * `applyStaticTranslations` cuida do HTML marcado e o canvas se resolve no
 * quadro seguinte, porque ele e redesenhado inteiro. Sobra o DOM que foi
 * escrito por codigo: rotulos de estado (som, telemetria), o painel aberto no
 * momento e o rotulo do contrato anunciado. Sao poucos e explicitos de
 * proposito — uma varredura generica reescreveria o que o jogador digitou.
 */
onLocaleChange(() => {
  // O canvas se redesenha sozinho a cada quadro — exceto quando o mundo esta
  // congelado, que e justamente o estado em que a troca de idioma acontece
  // dentro de uma run.
  frozenFrameStale = true;
  renderMuteLabel();
  renderTelemetryLabel();
  languageSelect.value = getLocale();
  if (advertisedContract) contractLabel.textContent = contractText(advertisedContract);
  // Os paineis so sao remontados se estiverem ABERTOS: reconstruir o de
  // ranking fechado descartaria as entradas que vieram da rede, e reabri-lo
  // dispararia outra busca.
  if (!recordsOverlay.classList.contains('hidden')) renderRecords();
  // O menu de campo escreve o estado e o rotulo do abandono ao abrir; com ele
  // aberto (e e de dentro dele que o idioma costuma ser trocado no meio de uma
  // run) os dois ficariam na lingua anterior ate a proxima abertura.
  pauseMenu.refreshLabels();
});

/**
 * Ferramentas de desenvolvimento atras de ?dev=1.
 *
 * Seed e URL de servidor NAO sao funcionalidades de jogador: uma exige entender
 * geracao procedural e a outra exige saber que existe um servidor. Numa tela de
 * titulo elas so gastam a atencao de quem quer jogar.
 */
if (new URLSearchParams(location.search).get('dev') === '1') {
  devTools.classList.remove('hidden');
}

// O carimbo de autorizacao ja no primeiro quadro do menu: ele sai do perfil em
// CACHE, entao nao espera a rede. A busca do perfil ao vivo o reescreve depois.
renderDescentClearance();

// auto-start por query (?online=1). ?room=XYZ transforma o convite num LINK,
// que e como as pessoas realmente compartilham: quem recebe entra direto.
const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) roomInput.value = normalizeRoomCode(roomParam);
if (roomParam || params.get('online') === '1') startOnline();
else if (params.get('solo') === '1') startSolo();

// PWA: registra o service worker (app shell offline para o solo)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* PWA opcional; o jogo funciona sem SW */
    });
    // O cache do shell passa de 1 MB com os atlases. Sob pressao de armazenamento
    // o navegador despeja a origem inteira sem avisar, e o app instalado volta a
    // depender da rede para abrir. Pedir persistencia e o unico jeito de sair
    // dessa fila; um "nao" nao muda nada e nao vale um aviso ao jogador.
    void navigator.storage?.persist?.().catch(() => undefined);
  });
}
