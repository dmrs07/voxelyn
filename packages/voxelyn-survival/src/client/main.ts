import { TICK_MS } from '@voxelyn/survival-sim';
import { createRun, emptyCommand, stepRun } from '@voxelyn/survival-sim';
import type { SemanticEvent, SurvivalState } from '@voxelyn/survival-sim';
import { TouchCooldownOverlay } from './cooldown-overlay';
import { SurvivalInput, isEditingText, type TouchSafeArea } from './input';
import { SurvivalRenderer } from './render';
import { DeathEchoController } from './death-echo-presentation';
import {
  deathEchoPoolQuery,
  fetchDeathEchoContract,
  fetchDeathEchoPool,
  submitDeathEcho,
} from './death-echo-pool';
import type { DeathEchoContract } from '@voxelyn/survival-protocol';
import { NetClient } from './net';
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
import { renderRecordsPanel } from './records-panel';
import { formatSeed, parseSeed } from './run-summary';
import { isValidRoomCode, normalizeRoomCode } from '@voxelyn/survival-protocol';
import { RunRecorder, fetchLeaderboard, submitRun } from './run-recorder';
import { renderRankPanel } from './rank-panel';
import { TelemetrySession, isOptedOut, setOptedOut } from './telemetry';
import { inviteUrlFrom } from './invite';
import { PauseMenu } from './pause-menu';

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
    if (`${state.config.seed}:${state.sector}` !== key) return;
    if (pool.length > 0) deathEchoes.setPool(pool);
  });
};
const renderState = (
  state: SurvivalState,
  alpha: number,
  inputState: Parameters<SurvivalRenderer['render']>[2],
  nowMs: number,
): void => {
  if (state.phase === 'running') requestPool(state);
  renderer.setDeathEchoes(deathEchoes.sync(state, nowMs));
  renderer.render(state, alpha, inputState, nowMs);
};
const input = new SurvivalInput(canvas);
const cooldownOverlay = new TouchCooldownOverlay(canvas);
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

const resize = (): void => {
  const safeArea = readSafeArea();
  renderer.setSafeArea(safeArea);
  renderer.resize();
  input.layoutButtons(window.innerWidth, window.innerHeight, safeArea);
};
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

const playerScreen = (): { x: number; y: number } => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
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
const backToMenu = (): void => {
  runInProgress = false;
  liveRun = null;
  paused = false;
  stopLoop = null;
  pauseMenu.disarmHistory();
  menu.classList.remove('hidden');
};

const setBanner = (text: string | null): void => {
  if (!text) {
    banner.classList.add('hidden');
  } else {
    banner.textContent = text;
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
  muteButton.textContent = audioSettings.muted ? 'Som: desligado' : 'Som: ligado';
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
  setBanner(audioSettings.muted ? 'Som desligado' : 'Som ligado');
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
    setBanner(outcome.duplicate ? 'Run já registrada' : 'Run verificada e registrada');
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
  const done = (texto: string): void => {
    inviteButton.textContent = texto;
    setTimeout(() => {
      inviteButton.textContent = 'Copiar convite';
    }, 1800);
  };
  // `navigator.share` primeiro porque no celular ele abre a folha nativa e
  // manda direto para o WhatsApp, que e como o convite de fato viaja. No
  // desktop ele quase nunca existe, e a area de transferencia e o certo.
  if (typeof navigator.share === 'function') {
    void navigator
      .share({ title: 'Voxelyn Survival', text: `Desce comigo — sala ${currentInvite}`, url })
      .then(() => done('Enviado'))
      .catch(() => {
        /* o jogador cancelou a folha de compartilhamento: nao e erro */
      });
    return;
  }
  void navigator.clipboard
    ?.writeText(url)
    .then(() => done('Copiado!'))
    .catch(() => done('Copie da barra'));
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
      setBanner(`Qualidade reduzida para ${lower} (desempenho)`);
      setTimeout(() => setBanner(null), 1800);
    }
  }
};

// ---------------------------------------------------------------------------
// SOLO (simulacao local, funciona offline)
// ---------------------------------------------------------------------------
let stopLoop: (() => void) | null = null;

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
  stopLoop?.();
  stopLoop = null;
  liveRun = null;
  runInProgress = false;
  paused = false;
  // A fila de toques e a tecla R ficam cheias do que o jogador apertou durante a
  // run. Sem drenar, o primeiro `hasTap` da PROXIMA descida encontra lixo desta.
  input.clearPendingUiInput();
  mountOptions(optionsSlot);
  showInvite(null);
  setBanner(null);
  audio.reset();
  menu.classList.remove('hidden');
};

/** Solo congela; co-op nao. Lido pelo menu ANTES de `onOpen`, entao nao pode depender de `paused`. */
const soloRun = (): boolean => liveRun !== null && liveRun.config.playerCount === 1;

const pauseMenu = new PauseMenu(canvas, {
  runActive: () => runInProgress,
  runTerminal: () => liveRun !== null && liveRun.phase !== 'running',
  freezesWorld: soloRun,
  status: () => {
    const state = liveRun;
    if (!state) return 'sem sinal do setor — conexão pendente';
    if (state.phase !== 'running') return 'contrato encerrado — sem descida ativa';
    const contamination = Math.round(state.contamination * 100);
    return `Setor ${state.sector} · contaminação ${contamination}% · contrato em aberto`;
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
    setBanner('ESC ou segure no topo da tela para o menu');
    hintTimer = setTimeout(clearHint, 4000);
  }, 1600);
};

const runSolo = (): void => {
  renderer.setLocalPlayerId(1); // solo: o unico player e o id 1
  audio.setLocalPlayerId(1);
  audio.reset();
  const seed = nextSeed();
  recorder.start(seed);
  resetRunTracking();
  telemetry.begin();
  let state: SurvivalState = createRun({ seed });
  liveRun = state;
  let accumulator = 0;
  let lastTime = performance.now();
  let running = true;
  let queuedChoice: 0 | 1 | null = null;

  const gate = new RestartGate(RESTART_ARM_MS);

  const frame = (now: number): void => {
    if (!running) return;
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
      recordRun(state);
      submitSoloRun(state);
      submitDeathToPool(state);
      if (state.summary) telemetry.finish(state.summary, state.sector);
      const { drain, armed } = gate.frame(now, true);
      if (drain) input.clearPendingUiInput();
      audio.update(state, now);
      renderState(state, 1, input.state, now);
      renderer.renderEnd(state, vw, vh);
      // `!pauseMenu.isOpen` barra o R do teclado, que chega por cima da overlay:
      // sem ele, quem abrisse o menu na tela de fim para sair veria a run
      // reiniciar por baixo do proprio menu. Os TOQUES ja param sozinhos — a
      // overlay engole o pointerdown antes de o canvas ve-lo.
      if (!pauseMenu.isOpen && armed && (input.hasTap() || input.consumeRestartKey())) {
        const nextRunSeed = nextSeed();
        recorder.start(nextRunSeed);
        telemetry.begin();
        state = createRun({ seed: nextRunSeed });
        liveRun = state;
        audio.reset();
        resetRunTracking();
        gate.reset();
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
      renderer.ingestEvents(result.events, now);
      audio.ingest(result.events, now, state);
      haptics(result.events);
      accumulator -= TICK_MS;
      if (state.phase !== 'running') break;
    }
    const pendingChoice = state.playerExtra.pendingModuleChoice;
    // Toques comuns sao drenados; durante uma escolha, a fila pertence aos cards.
    if (!pendingChoice && gate.frame(now, false).drain) input.clearPendingUiInput();
    const alpha = accumulator / TICK_MS;
    audio.update(state, now);
    renderState(state, alpha, input.state, now);
    cooldownOverlay.render(state, input.state, state.tick + alpha, now);
    if (pendingChoice && renderer.isChoiceRevealReady(now)) {
      const regions = renderer.renderChoice(state, vw, vh, input.state);
      const choice = input.consumeChoiceTap(regions);
      if (choice !== null) queuedChoice = choice;
    } else if (pendingChoice) {
      input.clearPendingChoiceInput();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  stopLoop = () => {
    running = false;
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

const runOnline = (url: string, roomCode: string | null): void => {
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
      setBanner(`Versao incompativel (${field}) — recarregue a pagina.`);
      ws?.close();
      return;
    }
    setBanner('Sessao expirada — reconectando…');
    ws?.close();
  };
  net.onDiverged = () => setBanner('Ressincronizando o mundo…');

  const connect = (): void => {
    setBanner(net.resumeToken ? 'Reconectando…' : 'Conectando…');
    try {
      // URL malformada ou esquema nao-WebSocket lanca AQUI, de forma sincrona.
      // Sem tratar, o menu ja esta escondido e o loop ainda nao comecou: o
      // jogador fica numa tela morta, sem retry e sem como corrigir a URL.
      ws = new WebSocket(url);
    } catch {
      fatal = true;
      startupFailed = true;
      setBanner(`Endereco de servidor invalido: ${url}`);
      backToMenu();
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
  // URL malformada: `connect` ja devolveu o jogador ao menu de forma sincrona.
  // Sem sair aqui, o quadro seria agendado assim mesmo e ficaria girando para
  // sempre por tras da tela de titulo, so para reencontrar `fatal` a cada 16 ms
  // — e `stopLoop` apontaria para um loop que o jogador nao esta jogando.
  if (startupFailed) return;

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
          renderer.renderEnd(state, window.innerWidth, window.innerHeight);
          // a sala acabou: reiniciar significa entrar numa sala NOVA. Descarta o
          // resume token (senao o hello reentraria nesta mesma sala terminal) e
          // reabre o socket — o matchmaking so considera salas 'running'.
          //
          // `menuOpen` barra o R do teclado, que chega por cima da overlay: sem
          // ele, quem abrisse o menu na tela de fim para sair veria a run
          // reiniciar por baixo do proprio menu.
          if (!menuOpen && armed && (input.hasTap() || input.consumeRestartKey())) {
            gate.reset();
            audio.reset();
            resetRunTracking();
            // Sala nova e run nova: mesmo `begin()` da entrada, pelo mesmo
            // motivo — e daqui que sai o intervalo ate o reinicio.
            telemetry.begin();
            setBanner('Descendo de novo…');
            net.resetSession();
            ws?.close(); // onclose agenda o reconnect, agora sem token
          }
        }
      }
    } else {
      if (fatal) {
        requestAnimationFrame(frame);
        return; // banner ja explica; nao insiste
      }
      setBanner(net.status === 'reconnecting' ? 'Reconectando…' : 'Offline — tentando reconectar');
      if (reconnectAt && now >= reconnectAt && (!ws || ws.readyState === WebSocket.CLOSED)) {
        reconnectAt = 0;
        connect();
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  stopLoop = () => {
    running = false;
    showInvite(null);
    ws?.close();
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
  // A modalidade e declarada por quem INICIA a run, e nao herdada do que o
  // servidor anunciou: descer normalmente sempre significa pool geral, mesmo com
  // um contrato aberto na tela.
  contractRun = contract;
  audio.unlock();
  audio.ui();
  menu.classList.add('hidden');
  stopLoop?.();
  runInProgress = true;
  pauseMenu.armHistory();
  runSolo();
  hintOnce();
};
const startOnline = (): void => {
  const code = normalizeRoomCode(roomInput.value);
  if (code !== '' && !isValidRoomCode(code)) {
    setBanner(`Código de sala inválido: ${code}`);
    setTimeout(() => setBanner(null), 2400);
    return;
  }
  contractRun = null;
  audio.unlock();
  audio.ui();
  menu.classList.add('hidden');
  stopLoop?.();
  runInProgress = true;
  pauseMenu.armHistory();
  runOnline(serverInput.value.trim() || defaultServerUrl(), code || null);
  hintOnce();
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
const startContract = (): void => {
  const contract = advertisedContract;
  if (!contract) return;
  forcedSeed = contract.seed;
  seedInput.value = formatSeed(contract.seed);
  setBanner(contract.label);
  setTimeout(() => setBanner(null), 3200);
  startSolo(contract);
};

// `() => startSolo()` e nao `startSolo`: o handler receberia o MouseEvent como
// primeiro argumento e o contrato passaria a ser um evento de clique.
document.getElementById('btn-solo')?.addEventListener('click', () => startSolo());
document.getElementById('btn-online')?.addEventListener('click', startOnline);
contractButton.addEventListener('click', startContract);
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
  contractLabel.textContent = contract.label;
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

document.getElementById('btn-records')?.addEventListener('click', () => {
  renderRecordsPanel(recordsBody, records);
  openOverlay(recordsOverlay);
});
document
  .getElementById('btn-records-close')
  ?.addEventListener('click', () => closeOverlay(recordsOverlay));

const renderTelemetryLabel = (): void => {
  telemetryButton.textContent = isOptedOut() ? 'Telemetria: desligada' : 'Telemetria: ligada';
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
    emptyReason: 'carregando…',
    seed: forcedSeed ?? undefined,
  });
  openOverlay(rankOverlay);
  const url = serverInput.value.trim() || defaultServerUrl();
  void fetchLeaderboard(url, { seed: forcedSeed ?? undefined, limit: 25 }).then((entries) => {
    if (rankOverlay.classList.contains('hidden')) return; // jogador ja fechou
    renderRankPanel(rankBody, {
      entries,
      seed: forcedSeed ?? undefined,
      emptyReason: 'ninguém extraiu ainda — ou o servidor está fora do ar',
    });
  });
});
document
  .getElementById('btn-rank-close')
  ?.addEventListener('click', () => closeOverlay(rankOverlay));

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
