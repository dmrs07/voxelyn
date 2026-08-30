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
import { inductionSeen, markInductionSeen, renderInduction, type InductionMode } from './induction';
import { createTrainingRun, markTrainingDone } from './training-setup';
import { TrainingDirector, type TrainingCue } from './training-director';
import { SurvivalInput, isEditingText, type TouchSafeArea } from './input';
import { EngagementMemory, applyCombatAssist } from './combat-assist';
import { SurvivalRenderer } from './render';
import { DeathEchoController, emptyDeathEchoFrame } from './death-echo-presentation';
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
import { cachedUnlockBaseline, readCachedProfile, writeCachedProfile } from './progression-cache';
import { LoreToasts, newlyUnlocked } from './lore-toast';
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
import { RunRecorder, fetchLeaderboard, submitRun, type RankClass } from './run-recorder';
import { renderRankPanel } from './rank-panel';
import { TelemetrySession, isOptedOut, setOptedOut } from './telemetry';
import { inviteUrlFrom } from './invite';
import { deployVeil, veilActive } from './deploy-veil';
import { runBootSequence } from './boot';
import { buildBootPlan } from './boot/boot-plan';
import { identitySting } from './boot/developer-ident';
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

/**
 * A URL da virgula sonora do estudio, resolvida no topo do modulo.
 *
 * Vazia quando nao ha identidade sonora cadastrada — nesse caso o adiantamento
 * abaixo nao acontece e a abertura segue muda, como sempre.
 */
const IDENTITY_STING_URL = identitySting() ?? '';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas #game nao encontrado.');

/** Espera antes de aceitar toque como reinicio: a tela de fim precisa ser lida. */
const RESTART_ARM_MS = 900;

const menu = document.getElementById('menu') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const serverInput = document.getElementById('server') as HTMLInputElement;
const qualitySelect = document.getElementById('quality') as HTMLSelectElement;
const volumeInput = document.getElementById('volume') as HTMLInputElement;
const musicVolumeInput = document.getElementById('music-volume') as HTMLInputElement;
const sfxVolumeInput = document.getElementById('sfx-volume') as HTMLInputElement;
const musicSourceButton = document.getElementById('btn-music-source') as HTMLButtonElement;
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

// A VIRGULA SONORA e adiantada AQUI, antes do renderizador existir.
//
// O construtor do renderizador dispara os 57 atlas, e cada um constroi a
// mascara de halo com uma leitura de pixel na thread principal — tudo o que
// depende de uma tarefa espera atras disso. Pedir a peca ANTES tira o decode
// dessa fila (422 ms -> 34 ms, medido). O que sobra e a leitura do corpo, que
// continua atras das mascaras; ver `prepareIdentitySting`.
//
// Nada toca aqui: `prepare` so busca e decodifica, e quem decide se ha som e o
// `playIdentitySting` la embaixo, com o mudo ja carregado.
if (IDENTITY_STING_URL) void audio.prepareIdentitySting(IDENTITY_STING_URL);

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
  activeRunKind = 'none';
  liveRun = null;
  paused = false;
  stopLoop = null;
  pauseMenu.disarmHistory();
  audio.setScreen('menu');
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
audio.setMusicVolume(audioSettings.musicVolume);
audio.setSfxVolume(audioSettings.sfxVolume);
audio.setMuted(audioSettings.muted);
// A abertura e da assinatura do estudio: a trilha do terminal so ganha voz
// quando a sequencia chega a tela de carregamento (ver `onSplash` abaixo).
audio.setScreen('boot');
audio.setMusicSource(audioSettings.musicSource);
volumeInput.value = String(Math.round(audioSettings.volume * 100));
musicVolumeInput.value = String(Math.round(audioSettings.musicVolume * 100));
sfxVolumeInput.value = String(Math.round(audioSettings.sfxVolume * 100));

const renderMuteLabel = (): void => {
  muteButton.textContent = t(audioSettings.muted ? 'options.sound.off' : 'options.sound.on');
  muteButton.classList.toggle('primary', !audioSettings.muted);
};
renderMuteLabel();

const renderMusicSourceLabel = (): void => {
  musicSourceButton.textContent = t(
    audioSettings.musicSource === 'composed'
      ? 'options.musicSource.composed'
      : 'options.musicSource.synth',
  );
};
renderMusicSourceLabel();

// Alterna trilha composta <-> sintetizada (a antiga, mantida como backup). A
// troca sonora em si acontece no proximo update() do AudioDirector, com as
// rampas de cada barramento.
musicSourceButton.addEventListener('click', () => {
  audioSettings.musicSource = audioSettings.musicSource === 'composed' ? 'synth' : 'composed';
  audio.setMusicSource(audioSettings.musicSource);
  saveAudioSettings(audioSettings);
  renderMusicSourceLabel();
});

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

musicVolumeInput.addEventListener('input', () => {
  audioSettings.musicVolume = Number(musicVolumeInput.value) / 100;
  audio.setMusicVolume(audioSettings.musicVolume);
  saveAudioSettings(audioSettings);
});

// Efeitos: mesmo padrao dos outros dois sliders — o valor vai para o
// barramento na hora e o disco grava a cada movimento. Sem retorno sonoro
// proprio aqui de proposito: o jogador quase sempre mexe neste slider com o
// jogo fazendo barulho atras, e um bipe por passo do slider disputaria com
// justamente o som que ele esta tentando ajustar.
sfxVolumeInput.addEventListener('input', () => {
  audioSettings.sfxVolume = Number(sfxVolumeInput.value) / 100;
  audio.setSfxVolume(audioSettings.sfxVolume);
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
 * A geracao de avisos de lore em curso.
 *
 * Declarada AQUI, acima do primeiro leitor, e nao junto do cartao la embaixo:
 * `transmitSettlement` chega a ser chamada por `refreshProfile`, e um `let`
 * lido antes da sua propria linha de inicializacao e um ReferenceError, nao um
 * zero. `resetRunTracking()` a incrementa; ver a chamada la.
 */
let loreEpoch = 0;

/**
 * Envia o que o jogador apertou, e mostra o que o SERVIDOR decidiu.
 *
 * Repare no que nao e enviado: minerio, nucleo, fase, tempo. O servidor
 * re-simula a run inteira com a seed e o tuning que ele mesmo autorizou.
 */
/** Envia (ou reenvia) uma liquidacao. Idempotente do lado do servidor. */
const transmitSettlement = (url: string, runId: string, log: string): void => {
  // O RETRATO E TIRADO AGORA, e nao quando a resposta chega.
  //
  // Entre o pedido e a resposta, outra coisa pode gravar o cache com o perfil
  // JA liquidado: `refreshProfile()` (a Matriz aberta na espera) e
  // `openSession()` (o jogador autorizando a descida seguinte) escrevem os dois.
  // Lido depois, o "antes" ja conteria os desbloqueios novos, o delta sairia
  // vazio, e o aviso que existe para isto sumiria em silencio.
  //
  // A epoca acompanha pelo mesmo motivo, do outro lado do tempo: ver
  // `announceLoreUnlocks`.
  const knownLore = cachedUnlockBaseline();
  const bornInEpoch = loreEpoch;
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
    // `url`, e nao `progressionUrl()`: os ids saíram DESTE servidor, e os
    // corpos precisam sair do mesmo. Quem voltou ao menu e trocou o endereco
    // enquanto a liquidacao estava no ar buscaria os documentos no servidor
    // novo com os ids do antigo.
    announceLoreUnlocks(url, bornInEpoch, knownLore, result.value.profile.unlockedLoreFragmentIds);
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
  // O ticket desta descida viaja junto. E dele que o servidor tira a
  // profundidade autorizada — e, portanto, em qual livro esta run compete.
  void submitRun(url, recorder, playerName, expedition?.runId).then((outcome) => {
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
  // O cartao de arquivo liberado tambem morre aqui. Ele nasce da liquidacao,
  // que resolve depois do fim da run — quem aperta R rapido levaria o aviso da
  // expedicao anterior para dentro da proxima descida.
  //
  // `clear()` sozinho nao bastava: ele varre o que JA existe, e a liquidacao (ou
  // a busca do codex) ainda no ar entregaria o cartao depois, dentro da descida
  // nova. A epoca invalida o que estava a caminho.
  loreEpoch += 1;
  loreToasts.clear();
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

/**
 * QUE TIPO de descida esta no ar.
 *
 * Existe por causa da telemetria de abandono: `abandonRun` e `reportAbandon`
 * emitem para qualquer `liveRun` rodando, e a operacao de treinamento — que
 * nunca abre run na telemetria — contaminaria contagem de runs e taxa de
 * abandono a cada Esc, reload ou aba fechada no meio do exercicio.
 *
 * Escrito pelos DONOS do ciclo de vida, e so por eles: `startSolo`/`startOnline`
 * marcam `standard` (o contrato termina em `startSolo`, entao nao precisa de
 * linha propria), `startTraining` marca `training`, e as tres saidas
 * (`abandonRun`, `backToMenu`, `teardownTraining`) devolvem `none`.
 */
let activeRunKind: 'none' | 'standard' | 'training' = 'none';

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
  // Treinamento nao e run: fechar a aba no meio do exercicio nao pode entrar
  // no funil como uma descida perdida.
  if (activeRunKind !== 'standard') return;
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
  // So run de verdade entra no funil de abandono; ver `activeRunKind`.
  if (activeRunKind === 'standard' && state && state.phase === 'running' && state.tick >= 20) {
    telemetry.abandon(state.sector, state.tick, state.contamination);
  }
  activeRunKind = 'none';
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
  audio.setScreen('menu');
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
  let state: SurvivalState = createRun({
    seed,
    tuning: authorized.tuning,
    depth: authorized.depth,
  });
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
      const regions = renderer.renderChoice(view, vw, vh, input.state, now);
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
// OPERACAO DE TREINAMENTO (100% local: sem ticket, sem registro, sem ranking)
// ---------------------------------------------------------------------------

/** O formulario de homologacao do exercicio, mostrado sobre o mundo parado. */
const trainingCompleteOverlay = document.getElementById('training-complete') as HTMLDivElement;

/**
 * O desfecho do exercicio corrente, lido pelo botao primario do formulario:
 * homologado abre a descida real; nao homologado repete o exercicio.
 */
let trainingOutcome: 'certified' | 'incomplete' = 'certified';

/**
 * Mostra o formulario de fim de exercicio com o texto do DESFECHO, e assenta o
 * estado da run no mesmo instante.
 *
 * Assentar aqui, e nao no clique dos botoes, e deliberado: com o laco parado e
 * `runInProgress` ainda de pe, Esc (ou o voltar do navegador, pela sentinela de
 * historico) abriria um menu de campo fantasma POR BAIXO do formulario — e o
 * menu ainda levaria `#options-controls` para o proprio slot ao abrir. Depois
 * desta funcao, `runActive()` e falso e nenhum dos dois caminhos existe.
 */
const showTrainingOutcome = (certified: boolean): void => {
  trainingOutcome = certified ? 'certified' : 'incomplete';
  // `dataset.i18n` acompanha o texto: se o idioma trocar com o formulario
  // aberto, `applyStaticTranslations` reescreve na chave do desfecho certo.
  const set = (id: string, key: MessageKey): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.i18n = key;
    el.textContent = t(key);
  };
  set(
    'training-complete-title',
    certified ? 'training.complete.title' : 'training.incomplete.title',
  );
  set('training-complete-body', certified ? 'training.complete.body' : 'training.incomplete.body');
  set(
    'btn-training-descend',
    certified ? 'training.complete.descend' : 'training.incomplete.retry',
  );

  runInProgress = false;
  activeRunKind = 'none';
  liveRun = null;
  paused = false;
  pauseMenu.disarmHistory();
  input.clearPendingUiInput();
  mountOptions(optionsSlot);
  trainingCompleteOverlay.classList.remove('hidden');
};

/**
 * Prepara a operacao de treinamento: o irmao SINCRONO de `prepareSolo`.
 *
 * A mesma dupla playout/fila, o mesmo congelamento de pausa e o mesmo véu —
 * menos tudo o que fala com o mundo la fora: nao ha `authorizeExpedition`
 * (nenhum ticket), nao ha `recorder` (nada a re-simular), e o fim nao grava,
 * nao homologa, nao sobe ao ranking nem oferece carcaca ao pool. O exercicio
 * nao rende de proposito — e essa e a licao que ele existe para dar.
 *
 * `prepareSolo` nao foi parametrizado de proposito: cada ramo de rede dele
 * precisaria de uma guarda de modo, e a arena ja estabeleceu que uma copia
 * enxuta do laco e o preco certo por um cenario sob medida.
 */
const prepareTraining = (): PreparedRun => {
  descentToken++;
  renderer.setLocalPlayerId(1);
  audio.setLocalPlayerId(1);
  audio.reset();
  resetRunTracking();
  // Dois residuos que `resetRunTracking` nao cobre e que atravessariam da run
  // anterior: toasts ainda no ar, e a projecao de carcacas de outra descida —
  // o treinamento nunca consulta o pool, entao o que estiver aqui e lixo.
  renderer.messages.length = 0;
  renderer.setDeathEchoes(emptyDeathEchoFrame());

  let state: SurvivalState = createTrainingRun();
  liveRun = state;
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;

  const director = new TrainingDirector();
  const gate = new RestartGate(RESTART_ARM_MS);
  const playout = new LocalPlayout();
  playout.capture(state);
  const assistMemory = new EngagementMemory();
  let frameNow = lastTime;
  const eventQueue = new TickEventQueue<SemanticEvent>((events) => {
    renderer.ingestEvents(events, frameNow);
    audio.ingest(events, frameNow, state);
    haptics(events);
    // O diretor escuta a MESMA fila que desenha e soa: a instrucao avanca
    // quando o jogador VE o fato acontecer, nunca um tick antes.
    director.ingest(events);
  });
  const rearm = (): void => {
    playout.reset();
    eventQueue.clear();
    playout.capture(state);
    assistMemory.clear();
    input.consumeAimTap();
  };

  /** Os cues do diretor viram efeito AQUI — ele nao conhece banner nem toast. */
  const applyCues = (cues: TrainingCue[], nowMs: number): void => {
    for (const cue of cues) {
      if (cue.type === 'banner') setBanner(t(cue.key), 'info');
      else if (cue.type === 'clear-banner') setBanner(null);
      else {
        renderer.messages.push({
          text: t(cue.key),
          startsAt: cue.delayMs ? nowMs + cue.delayMs : undefined,
          until: nowMs + (cue.delayMs ?? 0) + 3200,
        });
      }
    }
  };

  /**
   * O desenho do treinamento contorna `renderState` de proposito: ela pede o
   * pool de carcacas na rede, e o exercicio nao pode gerar trafego. A carga do
   * HUD continua sincronizada a mao — o renderer guarda `cargoOre` como estado
   * proprio, e sem isto o contador da run anterior atravessaria.
   */
  const draw = (view: SurvivalState, nowMs: number): void => {
    renderer.setCargoOre(view.stats.oreCollected);
    renderer.render(view, 1, input.state, nowMs);
  };

  const frame = (now: number): void => {
    if (!running) return;
    frameNow = now;
    if (paused) {
      lastTime = now;
      if (frozenFrameStale) {
        frozenFrameStale = false;
        draw(playout.sample(state, accumulator / TICK_MS) ?? state, now);
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
      eventQueue.flush(Number.POSITIVE_INFINITY);

      // Extraiu. So a extracao COM o Nucleo homologa o exercicio — sair de
      // maos vazias e uma decisao legitima numa run real, mas aqui significa
      // que o curriculo foi pulado: o formulario diz isso e oferece repetir,
      // sem marcar o treinamento como feito. UMA vez: o formulario e DOM e nao
      // precisa do laco — diferente da tela de fim real, que continua
      // desenhando para escutar R/T.
      if (state.phase === 'extracted' || state.phase === 'extracted_with_core') {
        const certified = state.phase === 'extracted_with_core';
        if (certified) markTrainingDone();
        setBanner(null);
        audio.update(state, now);
        // O ultimo quadro fica congelado atras do formulario.
        draw(state, now);
        running = false;
        showTrainingOutcome(certified);
        return;
      }

      // Morreu: a mesma tela de fim de sempre — a leitura do resultado tambem
      // e curriculo. Reiniciar e instantaneo (nao ha ticket a esperar).
      const { drain, armed } = gate.frame(now, true);
      if (drain) input.clearPendingUiInput();
      audio.update(state, now);
      draw(state, now);
      const endRegions = renderer.renderEnd(state, vw, vh, now, { input: input.state });
      const action = endScreenAction(endRegions, armed);
      if (action === 'restart') {
        state = createTrainingRun();
        liveRun = state;
        rearm();
        audio.reset();
        resetRunTracking();
        renderer.messages.length = 0;
        director.reset();
        gate.reset();
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
      // A assistencia roda como no solo; o que NAO existe e o recorder — nada
      // aqui sera re-simulado por ninguem.
      applyCombatAssist(state, raw, input.consumeAimTap(), assistMemory);
      const result = stepRun(state, [raw]);
      playout.capture(state);
      eventQueue.push(state.tick, result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    const alpha = accumulator / TICK_MS;
    const view = state.phase === 'running' ? (playout.sample(state, alpha) ?? state) : state;
    eventQueue.flush(view.tick);
    // Depois do flush, uma vez por quadro: o diretor le os fatos e devolve o
    // que a tela deve mudar.
    applyCues(director.frame(state, input.state.usingTouch), now);
    if (gate.frame(now, false).drain) input.clearPendingUiInput();
    audio.update(view, now);
    draw(view, now);
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    controlBar.render(
      state,
      input.state,
      now,
      window.innerWidth,
      window.innerHeight,
      safeInsets.bottom,
    );
    requestAnimationFrame(frame);
  };

  return {
    firstFrame: (): void => {
      frameNow = performance.now();
      draw(playout.sample(state, 0) ?? state, frameNow);
    },
    start: (): void => {
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
            now,
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
          const endRegions = renderer.renderEnd(state, window.innerWidth, window.innerHeight, now, {
            input: input.state,
          });
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
      activeRunKind = 'standard';
      run = await prepareSolo();
      // Autorizacao superada (outra descida ja e a atual): o anuncio se desfaz
      // e o swap mantem o terminal na tela.
      if (!run) runInProgress = false;
    },
    swap: () => {
      if (!run) return;
      // A troca acontece sob o preto do veu: a trilha do terminal desce aqui
      // e a da run nasce nos primeiros quadros — nunca as duas ao mesmo tempo.
      audio.setScreen('run');
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
      activeRunKind = 'standard';
      run = runOnline(serverInput.value.trim() || defaultServerUrl(), code || null);
      if (!run) runInProgress = false;
    },
    swap: () => {
      if (!run) return;
      audio.setScreen('run');
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

/**
 * Inicia a operacao de treinamento: o clone de `startSolo` sem autorizacao.
 *
 * `hintOnce` fica de fora de proposito: o banner e o canal de instrucao do
 * exercicio, e a dica de pausa por cima da primeira licao seria as duas
 * mensagens se atropelando. A dica continua existindo para a primeira run
 * REAL, que e onde o menu de campo vira necessidade.
 */
const startTraining = (): void => {
  if (veilActive()) return;
  contractRun = null;
  audio.unlock();
  audio.ui();
  let run: PreparedRun | null = null;
  void deployVeil({
    sound: veilSound,
    prepare: () => {
      stopLoop?.();
      runInProgress = true;
      activeRunKind = 'training';
      run = prepareTraining();
    },
    swap: () => {
      if (!run) return;
      audio.setScreen('run');
      menu.classList.add('hidden');
      run.firstFrame();
    },
  }).then((ran) => {
    if (!ran || !run) return;
    pauseMenu.armHistory();
    run.start();
  });
};

/**
 * Recolhe o exercicio terminado: o espelho local de `abandonRun`, sem
 * telemetria (nunca houve run) e com o formulario de homologacao a fechar.
 */
const teardownTraining = (): void => {
  descentToken++;
  stopLoop?.();
  stopLoop = null;
  liveRun = null;
  runInProgress = false;
  activeRunKind = 'none';
  paused = false;
  pauseMenu.disarmHistory();
  input.clearPendingUiInput();
  setBanner(null);
  audio.reset();
  trainingCompleteOverlay.classList.add('hidden');
};

document.getElementById('btn-training-terminal')?.addEventListener('click', () => {
  audio.ui();
  teardownTraining();
  audio.setScreen('menu');
  void deployVeil({ swap: () => menu.classList.remove('hidden'), sound: veilSound }).then((ran) => {
    if (!ran) menu.classList.remove('hidden');
  });
});
// O botao primario segue o desfecho: exercicio homologado abre a descida real
// (o carimbo que ele acabou de aprender a merecer); nao homologado repete o
// exercicio. `startSolo`/`startTraining` cuidam do véu — o treinamento so
// precisa sair da frente primeiro.
document.getElementById('btn-training-descend')?.addEventListener('click', () => {
  audio.ui();
  teardownTraining();
  if (trainingOutcome === 'certified') startSolo();
  else startTraining();
});

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
/**
 * Abre a circular com DUAS continuacoes conceitualmente diferentes: a do
 * carimbo primario (`onAuthorise` — a acao que trouxe o jogador aqui) e a do
 * botao de treinamento (`onTraining`, so no briefing). Ambas marcam a leitura
 * e fecham a circular antes de seguir — mudar de ideia depois de ler e
 * exatamente o que os dois botoes existem para permitir.
 */
const openInduction = (
  mode: InductionMode,
  onAuthorise: () => void,
  onTraining?: () => void,
): void => {
  const dismissInto = (next: () => void) => (): void => {
    markInductionSeen();
    inductionOverlay.classList.add('hidden');
    menu.classList.remove('hidden');
    audio.ui();
    next();
  };
  renderInduction(inductionBody, {
    mode,
    onDismiss: dismissInto(onAuthorise),
    onTraining: onTraining ? dismissInto(onTraining) : undefined,
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
 *
 * Todo briefing de primeira leitura oferece o treinamento como caminho
 * secundario. So o botao DE TREINAMENTO inicia o treinamento: o carimbo
 * primario executa sempre a acao que abriu a circular — e o "nunca
 * obrigatorio" expresso em fiacao.
 */
const withInduction = (descend: () => void): void => {
  if (inductionSeen()) {
    descend();
    return;
  }
  openInduction('briefing', descend, startTraining);
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
// NAO e `withInduction(startTraining)`: isso faria o carimbo "AUTORIZAR
// DESCIDA" da circular iniciar o treinamento. Quem nunca leu recebe o briefing
// normal — com a descida real no primario e o exercicio no secundario — e quem
// ja leu vai direto ao exercicio.
document.getElementById('btn-training')?.addEventListener('click', () => {
  if (inductionSeen()) startTraining();
  else openInduction('briefing', () => startSolo(), startTraining);
});
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

/**
 * O aviso de arquivo liberado.
 *
 * Mora aqui, e nao no painel, porque o problema que ele resolve e o painel: o
 * digest de leitura mostrou 21 de 28 perfis que nunca abriram um documento. O
 * cartao leva o primeiro contato ate onde o jogador ja esta olhando, e clicar
 * nele abre a Matriz JA no documento — a navegacao sai do caminho.
 */
const loreToasts = new LoreToasts(document.getElementById('lore-toasts') as HTMLDivElement, {
  ui: () => audio.ui(),
  onOpen: (id) => {
    // O mesmo caminho de "Ver docs" no Registro, menos o retorno: nao ha
    // painel anterior para voltar, o cartao veio da tela de fim de expedicao.
    matrixView.tab = 'codex';
    matrixView.codexContext = { kind: 'all' };
    matrixView.codexReturn = false;
    matrixView.notice = null;
    openCodexDocument(id);
    drawMatrix();
    openOverlay(matrixOverlay);
    void refreshCodex();
    void refreshProfile();
  },
});

/**
 * Anuncia o que a liquidacao acabou de liberar.
 *
 * A resposta da liquidacao traz o perfil inteiro e nenhum delta, entao quem
 * descobre a novidade e o cliente, comparando com o perfil em cache ANTES da
 * escrita. Titulo e corpo nao estao no perfil (so os ids), e por isso o codex
 * e buscado — mas so quando existe algo novo para mostrar, nunca por rotina.
 */
const announceLoreUnlocks = (
  serverUrl: string,
  bornInEpoch: number,
  before: readonly string[] | null | undefined,
  after: readonly string[] | null | undefined,
): void => {
  const fresh = new Set(newlyUnlocked(before, after));
  if (fresh.size === 0) return;
  void fetchCodex(serverUrl, getLocale()).then((result) => {
    // Uma descida nova comecou enquanto isto voltava: o aviso perdeu a hora.
    if (!result.ok || bornInEpoch !== loreEpoch) return;
    loreToasts.push(
      // A ordem e a do indice do servidor (cronologia), e nao a da lista de
      // desbloqueados: se dois arquivos cairem na mesma run, eles chegam na
      // ordem em que a historia os conta.
      result.value.unlocked
        .filter((fragment) => fresh.has(fragment.id))
        .map((fragment) => ({
          id: fragment.id,
          code: fragment.documentCode,
          title: fragment.title,
          body: fragment.body,
        })),
    );
  });
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

/**
 * Abre um livro do ranking.
 *
 * `sectorCount` ausente na PRIMEIRA abertura de proposito: quem escolhe o livro
 * inicial e o servidor, que sabe quais existem. O cliente poderia palpitar pela
 * geracao do proprio perfil, e palpitaria errado justamente para quem mais
 * precisa do placar — o recem-chegado, cujo livro pode ainda nao ter ninguem.
 *
 * As abas ja aparecem no estado de carregamento (`classes` da consulta
 * anterior), e nao so quando a resposta chega: a aba clicada tem de continuar
 * na tela enquanto a lista dela e buscada, senao trocar de livro faz o seletor
 * inteiro piscar fora e voltar.
 */
let rankClasses: RankClass[] = [];
/**
 * A consulta MAIS RECENTE. Duas trocas de aba rapidas correm em paralelo, e sem
 * este token quem responde por ultimo desenha por ultimo — a lista na tela
 * poderia ser a da aba que o jogador ja abandonou, sob o rotulo da que ele
 * acabou de abrir.
 */
let rankQuery = 0;
const openRankBook = (sectorCount?: number): void => {
  const url = serverInput.value.trim() || defaultServerUrl();
  const query = ++rankQuery;
  // Abre com estado de carregamento em vez de esperar a rede: um botao que nao
  // responde por dois segundos le como travado, e o solo funciona offline —
  // este painel pode legitimamente nunca carregar.
  renderRankPanel(rankBody, {
    entries: [],
    emptyReason: t('rank.loading'),
    seed: forcedSeed ?? undefined,
    classes: rankClasses,
    sectorCount,
    loading: true,
  });
  void fetchLeaderboard(url, { seed: forcedSeed ?? undefined, limit: 25, sectorCount }).then(
    (page) => {
      if (query !== rankQuery) return; // outra aba foi pedida depois desta
      if (rankOverlay.classList.contains('hidden')) return; // jogador ja fechou
      rankClasses = page.classes;
      renderRankPanel(rankBody, {
        entries: page.entries,
        seed: forcedSeed ?? undefined,
        classes: page.classes,
        sectorCount: page.sectorCount,
        onSelectClass: openRankBook,
        emptyReason: t('rank.empty.offline'),
      });
    },
  );
};

document.getElementById('btn-rank')?.addEventListener('click', () => {
  openOverlay(rankOverlay);
  openRankBook();
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
  'training-complete-mark',
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
  renderMusicSourceLabel();
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

// ---------------------------------------------------------------------------
// A sequencia de abertura
// ---------------------------------------------------------------------------
//
// Ate aqui este arquivo terminava revelando nada: o `#menu` ja estava pintado
// desde o HTML e o modulo so pendurava handlers nele. Agora o menu nasce
// `hidden` e QUEM O REVELA e o fim da abertura — a identidade da companhia, a
// tela de carregamento com preload real, e so entao o terminal.
//
// Tres cuidados que esta ligacao precisa ter, e que o resto do arquivo assume:
//
// 1) NENHUMA RUN COMECA AQUI. O preload prepara recursos compartilhados
//    (fontes, atlas, imagem de fundo) e nada mais: nenhum `createRun`, nenhum
//    tick, nenhum mundo. O auto-start por query — que E um pedido explicito do
//    jogador, feito no link — foi movido para DEPOIS do boot pelo mesmo
//    motivo: uma descida nao pode nascer atras de uma tela de carregamento.
//
// 2) O AUDIO NAO E TOCADO. O `AudioContext` continua nascendo do primeiro
//    gesto, como o navegador exige; a abertura e muda de propósito.
//
// 3) A ENTREGA ACONTECE UMA VEZ. `onReady` roda no maximo uma vez em toda a
//    vida da pagina (garantido por `boot/index.ts`), entao nada aqui pode ser
//    inicializado duas vezes.
const params = new URLSearchParams(location.search);
const roomParam = params.get('room');
if (roomParam) roomInput.value = normalizeRoomCode(roomParam);

void runBootSequence({
  buildTasks: ({ keyart, identMark }) => buildBootPlan({ renderer, keyart, identMark }),
  // A VIRGULA SONORA do estudio, sobre a tela de identidade.
  //
  // Devolve a duracao so quando a peca REALMENTE comecou — e e isso que faz a
  // marca ficar na tela ate o ultimo acorde. Onde o navegador nao autoriza
  // audio sem gesto, devolve `null` e a identidade segue curta e silenciosa,
  // como era. Nunca ha uma tela preta esperando um som que nao veio.
  onIdentitySting: (url) => audio.playIdentitySting(url),
  // A trilha do terminal comeca na SPLASH, e nao no menu.
  //
  // `unlock` e o mesmo caminho de sempre, chamado mais cedo — nao ha truque
  // de autoplay aqui. Onde o navegador permite (um PWA instalado, um site com
  // engajamento de midia) o contexto nasce tocando e a musica cobre a tela de
  // carregamento inteira. Onde nao permite, ele nasce suspenso e nada soa
  // ainda; mas o FLAC ja comeca a viajar, entao quando o primeiro gesto
  // chegar a trilha entra na hora em vez de depois de um download.
  //
  // Mudo continua mudo: `unlock` respeita a preferencia, que ja foi aplicada
  // la em cima com o resto das configuracoes de audio.
  onSplash: () => {
    // Sai de 'boot' e entra em 'menu': ate aqui a trilha do terminal ficou
    // calada de proposito, para nao tocar por baixo da assinatura do estudio.
    audio.setScreen('menu');
    audio.unlock();
  },
  onReady: () => {
    // O menu entra sob o escurecimento da abertura — nunca por cima da barra
    // ainda visivel. Sem `deployVeil` aqui de proposito: o veu e a ficcao da
    // DESCIDA (o casco se abrindo para o Veio), e usa-lo para entrar no
    // terminal gastaria o gesto no lugar errado.
    menu.classList.remove('hidden');
    // auto-start por query (?online=1). ?room=XYZ transforma o convite num
    // LINK, que e como as pessoas realmente compartilham: quem recebe entra
    // direto — agora com os atlas ja carregados, entao a run que nasce do
    // link nasce desenhada.
    if (roomParam || params.get('online') === '1') startOnline();
    else if (params.get('solo') === '1') startSolo();
  },
});

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
