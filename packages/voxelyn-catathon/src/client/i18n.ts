import { SPEC_TEXT, TIER_TEXT, TRAIT_TEXT, type Locale } from '../sim/index.js';
import type { Personality, Spec, Tier } from '../sim/types.js';
import type { TraitId } from '../sim/gen.js';

/**
 * O DICIONARIO da interface. O jogo fala ingles por padrao (o maior
 * hackathon do MUNDO recebe todo mundo) e portugues de casa pelo botao da
 * tela de titulo. O que mora no ESTADO (rotulos de tarefa, curriculos,
 * briefings) nasce ja no idioma via gerador (sim/text.ts); aqui vive o que
 * e interface: chips, botoes, eventos, telas.
 *
 * A troca de idioma recarrega a pagina: o HUD e construido uma vez, de
 * proposito (a licao dos botoes detached) — reconstruir tudo em voo custaria
 * mais do que um reload na tela de titulo.
 */

const KEY = 'catathon-locale';

let current: Locale = 'en';
try {
  const saved = localStorage.getItem(KEY);
  if (saved === 'pt' || saved === 'en') current = saved;
} catch {
  // sem storage nao e sem jogo
}

export const getLocale = (): Locale => current;
export const setLocale = (l: Locale): void => {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // idem
  }
};

type Dict = {
  weekdays: [string, string, string];
  day: string;
  left: (h: number, mm: string) => string;
  features: (n: number, total: number) => string;
  buildOk: string;
  buildDown: string;
  buildDead: string;
  bugs: (n: number) => string;
  decisions: (n: number) => string;
  mergeLocked: string;
  btnTreat: string;
  btnProject: string;
  btnSound: string;
  btnDetails: string;
  btnCut: string;
  btnOpenEmail: string;
  btnLockTeam: string;
  btnAgain: string;
  cutHint: string;
  titleSub: string;
  titleBrief: string;
  titleHelp: string;
  langWord: string;
  welcome: string;
  buses: Record<string, string>;
  dockNow: (mode: string) => string;
  meters: { energy: string; stress: string; morale: string; hunger: string };
  modes: Record<string, string>;
  taskShipped: string;
  taskCut: string;
  taskDeciding: string;
  taskAwaitShip: string;
  taskWaits: (deps: string) => string;
  recruitTitle: string;
  recruitIntro: (name: string, brief: string, emphasis: string, layout: string) => string;
  recruitBalance: (cost: string, n: number, blown: boolean) => string;
  emphasisName: Record<string, string>;
  pitchTitle: string;
  pitchTimer: (s: number) => string;
  pitchCrisis: string;
  abilityWord: Record<Personality, string>;
  resultTitle: Record<string, string>;
  crashedBuild: string;
  crashedBugs: (n: number) => string;
  dims: { tecnica: string; estabilidade: string; experiencia: string; inovacao: string; pitch: string };
  plateia: (pct: number) => string;
  improviso: string;
  stats: (core: number, polish: number, bugs: number, loose: number, total: number) => string;
  judgeLens: [string, string, string];
  modeCareer: string;
  modeQuick: string;
  modeDaily: string;
  walletLine: (cost: string) => string;
  shopTitle: string;
  gearOwned: string;
  btnCatnip: string;
  btnLaser: string;
  prizeLine: (prize: string) => string;
  /** Rotulos do EXTRATO do premio (prizeParts) na tela final. */
  prizePartName: Record<'placement' | 'zeroBugs' | 'deals' | 'sponsor' | 'special' | 'juniors' | 'debt', string>;
  walletAfter: (wallet: string) => string;
  achievementsTitle: string;
  sponsorTitle: string;
  sponsorAccept: string;
  sponsorSigned: string;
  specialLine: (name: string, hint: string) => string;
  rivalIntro: (name: string, taunt: string) => string;
  rivalRoster: (names: string) => string;
  rivalBeat: (name: string, theirs: number, yours: number) => string;
  rivalLost: (name: string, theirs: number, yours: number) => string;
  repLine: (rep: number, delta: number) => string;
  sponsorMetLine: (name: string) => string;
  sponsorFailedLine: (name: string) => string;
  specialWonLine: (name: string) => string;
  graduatesLine: (names: string) => string;
  poachedLine: (star: string, rival: string) => string;
  vibesLabel: string;
  /** O STRETCH SPRINT no HUD: o painel que abre quando o MVP fecha. */
  sprintTitle: string;
  sprintFreezeWord: string;
  sprintFreezeHint: (pts: number) => string;
  sprintAccept: string;
  sprintTakenTag: string;
  sprintMult: (mult: string) => string;
  sprintGain: (gain: string) => string;
  sprintRisk: (risk: string) => string;
  /** O CIRCUITO: convite, resultado e a Central. */
  btnHub: string;
  eventInvite: (name: string, blurb: string, paws: string, prize: string) => string;
  eventAt: (name: string) => string;
  earlyLine: (pts: number) => string;
  stretchLine: (n: number, mult: string) => string;
  qualifiedLine: (name: string) => string;
  newBestLine: (score: number) => string;
  seasonWonLine: string;
  hubTitle: string;
  hubCircuitTitle: string;
  hubSeasonWon: string;
  hubStatRuns: string;
  hubStatBest: string;
  hubStatRep: string;
  hubStatWallet: string;
  hubNever: string;
  hubNextUnlock: (name: string, missing: number) => string;
  hubAllOpen: string;
  hubLockedTag: (gate: number) => string;
  hubWinsTag: (n: number) => string;
  hubCurrentTag: string;
  hubRivalTitle: string;
  hubRivalLine: (wins: number, losses: number) => string;
  hubNoRival: string;
  hubAlumniTitle: string;
  hubNoAlumni: string;
  hubHistoryTitle: string;
  hubNoHistory: string;
  hubAchTitle: (got: number, total: number) => string;
  hubSecret: string;
  hubDailyLine: (date: string) => string;
  hubPlayNext: (name: string) => string;
  hubBack: string;
  modeWord: Record<'career' | 'quick' | 'daily', string>;
  ev: {
    ship: (name: string, task: string) => string;
    awaitShip: (name: string, task: string) => string;
    shortcut: (name: string, task: string) => string;
    bugKeyboard: (name: string, track: string) => string;
    bugUntested: (name: string, track: string) => string;
    bugfix: (track: string) => string;
    zoomies: (name: string) => string;
    cable: (name: string) => string;
    cableFixed: string;
    nap: (name: string) => string;
    eat: (name: string) => string;
    hairball: string;
    hairballFixed: string;
    buildBroken: string;
    buildFixed: string;
    treat: (name: string) => string;
    cut: (task: string) => string;
    overpet: (name: string) => string;
    decisionNeeded: (task: string) => string;
    decision: (option: string) => string;
    pep: (name: string, flavor: number) => string;
    pmWorry: (behind: number, flavor: number) => string;
    pitchStart: string;
    demoGlitch: string;
    improviso: (name: string) => string;
    traitRevealed: (name: string, trait: string) => string;
    sponsorOutage: string;
    harmony: (a: string, b: string) => string;
    friction: (a: string, b: string) => string;
    fight: (a: string, b: string) => string;
    fightSeparated: (a: string, b: string) => string;
    mentor: (mentor: string, junior: string) => string;
    grown: (name: string) => string;
    mvpReady: string;
    stretchOpen: (name: string) => string;
    stretchTaken: (name: string) => string;
    stretchDone: (name: string) => string;
    freeze: string;
  };
};

const EN: Dict = {
  weekdays: ['FRI', 'SAT', 'SUN'],
  day: 'DAY',
  left: (h, mm) => `${h}h${mm} left`,
  features: (n, total) => `features ${n}/${total}`,
  buildOk: 'BUILD OK',
  buildDown: 'BUILD IS DOWN',
  buildDead: 'BUILD BROKEN',
  bugs: (n) => `${n} bug${n > 1 ? 's' : ''}`,
  decisions: (n) => (n > 1 ? `${n} decisions!` : 'decision!'),
  mergeLocked: 'MERGE LOCKED — send someone to the rack',
  btnTreat: 'treat',
  btnProject: 'project',
  btnSound: 'sound',
  btnDetails: 'details',
  btnCut: 'cut',
  btnOpenEmail: 'open the email',
  btnLockTeam: 'lock the team',
  btnAgain: 'play again',
  cutHint: 'cut from scope: scores nothing, but never counts as a loose end',
  titleSub: "the world's biggest hackathon. your team is made of cats.",
  titleBrief: 'organizers challenge: 48 hours, three judges, one hand.',
  titleHelp:
    'first, RECRUITMENT: six candidates, three currencies, one budget. then: drag a cat to a desk, hold your finger = petting, cut scope in the project, emergency = rack.',
  langWord: 'PT-BR',
  welcome: 'welcome to CATATHON',
  buses: { music: 'music', sfx: 'effects', typing: 'keyboards', ambience: 'ambience', vocals: 'cats' },
  dockNow: (mode) => `now: ${mode}`,
  meters: { energy: 'energy', stress: 'stress', morale: 'morale', hunger: 'hunger' },
  modes: {
    idle: 'idle, contemplating life',
    walk: 'walking',
    work: 'working',
    nap: 'sleeping',
    eat: 'eating',
    zoomies: 'ZOOMIES across the booth',
    keyboard: 'sitting on the keyboard (bug!)',
    held: 'in your hand',
    petted: 'being petted',
  },
  taskShipped: 'shipped',
  taskCut: 'cut',
  taskDeciding: 'DECISION open: the desk is waiting',
  taskAwaitShip: 'the perfectionist awaits your SHIP IT (pet them)',
  taskWaits: (deps) => `waits for: ${deps}`,
  recruitTitle: 'Re: Candidates for CATATHON',
  recruitIntro: (name, brief, emphasis, layout) =>
    `"picked six profiles for you. your budget covers three or four, depending on tier. this edition's challenge is ${name}: ${brief}. the judges will weigh ${emphasis}. your booth: ${layout}."`,
  recruitBalance: (cost, n, blown) => `balance: ${cost}${blown ? ' (OVER BUDGET)' : ''} · team: ${n}`,
  emphasisName: { tecnica: 'engineering', estabilidade: 'stability', experiencia: 'experience', inovacao: 'innovation' },
  pitchTitle: 'THE PITCH — hold the crowd!',
  pitchTimer: (s) => `${s}s on stage`,
  pitchCrisis: 'THE DEMO FROZE! any cat: improvise!',
  abilityWord: {
    perfeccionista: 'stare down',
    cowboy: 'chase cursor',
    calmo: 'purr',
    'julga-em-silencio': 'make biscuits',
  },
  resultTitle: {
    'grand-prize': 'GRAND PRIZE! 🏆',
    podio: 'PODIUM!',
    mencao: 'honorable mention',
    participacao: 'certificate of participation',
    crashed: 'THE DEMO CRASHED.',
  },
  crashedBuild: 'the build had been broken since the hairball.',
  crashedBugs: (n) => `${n} live bug(s) in the demo. the demo gods collected.`,
  dims: { tecnica: 'engineering', estabilidade: 'stability', experiencia: 'experience', inovacao: 'innovation', pitch: 'pitch' },
  plateia: (pct) => `crowd: ${pct}% on their feet`,
  improviso: 'the demo FROZE live — and became a heroic improv. legend.',
  stats: (core, polish, bugs, loose, total) =>
    `${core} core · ${polish} polish · ${bugs} live bugs · ${loose} loose ends · total ${total}`,
  judgeLens: ['architecture: core features and loose ends', 'stability: live bugs in the demo', 'experience: polish and the design track'],
  modeCareer: 'career',
  modeQuick: 'quick run',
  modeDaily: 'daily',
  walletLine: (cost) => `wallet: ${cost}`,
  shopTitle: 'gear shop (this edition offers three)',
  gearOwned: 'in the cart',
  btnCatnip: 'catnip',
  btnLaser: 'laser',
  prizeLine: (prize) => `prize: ${prize}`,
  prizePartName: {
    placement: 'placement',
    zeroBugs: 'zero bugs',
    deals: 'deals',
    sponsor: 'sponsor',
    special: 'special trophy',
    juniors: 'junior growth',
    debt: 'tech debt',
  },
  walletAfter: (wallet) => `career wallet: ${wallet}`,
  achievementsTitle: 'achievements unlocked',
  sponsorTitle: 'a sponsor came by the booth',
  sponsorAccept: 'sign the contract',
  sponsorSigned: 'signed — read the fine print again if you dare',
  specialLine: (name, hint) => `special category this edition: ${name} — ${hint}`,
  rivalIntro: (name, taunt) => `next booth: ${name}. ${taunt}`,
  rivalRoster: (names) => `on their team now: ${names}`,
  rivalBeat: (name, theirs, yours) => `you beat ${name}! their ${theirs} vs your ${yours}. the tail wagging stopped.`,
  rivalLost: (name, theirs, yours) => `${name} scored ${theirs} vs your ${yours}. they are UNBEARABLE about it.`,
  repLine: (rep, delta) => `reputation: ${rep}${delta === 0 ? '' : delta > 0 ? ` (+${delta})` : ` (${delta})`}`,
  sponsorMetLine: (name) => `${name} contract fulfilled: the payout is in the prize`,
  sponsorFailedLine: (name) => `${name} contract MISSED — word gets around (reputation down)`,
  specialWonLine: (name) => `special trophy won: ${name}`,
  graduatesLine: (names) => `grew up this edition: ${names} — will return as mid-level`,
  poachedLine: (star, rival) => `${star} left for ${rival}. the money was good. the booth is quieter.`,
  vibesLabel: 'vibes',
  sprintTitle: 'MVP READY — freeze it, or reach higher?',
  sprintFreezeWord: 'freeze the build',
  sprintFreezeHint: (pts) => `early delivery: +${pts} pts + stability, guaranteed`,
  sprintAccept: 'take it on',
  sprintTakenTag: 'on the board',
  sprintMult: (mult) => `score multiplier ×${mult}`,
  sprintGain: (gain) => `pays: ${gain}`,
  sprintRisk: (risk) => `risk: ${risk}`,
  btnHub: 'career hub',
  eventInvite: (name, blurb, paws, prize) => `this stage of the circuit: ${name} — ${blurb}. difficulty ${paws} · prize ×${prize}`,
  eventAt: (name) => `stage: ${name}`,
  earlyLine: (pts) => `early delivery: +${pts} pts (frozen with time to spare)`,
  stretchLine: (n, mult) => `stretch sprint: ${n} ambitious feature${n > 1 ? 's' : ''} shipped — score ×${mult}`,
  qualifiedLine: (name) => `QUALIFIED: the ${name} invite just arrived`,
  newBestLine: (score) => `new personal best: ${score}`,
  seasonWonLine: 'THE SEASON IS YOURS: Global Catathon won with the rival beaten.',
  hubTitle: 'CAREER HUB',
  hubCircuitTitle: 'CATATHON CIRCUIT — the season',
  hubSeasonWon: 'season complete: the Global is yours',
  hubStatRuns: 'runs',
  hubStatBest: 'personal best',
  hubStatRep: 'reputation',
  hubStatWallet: 'wallet',
  hubNever: '—',
  hubNextUnlock: (name, missing) => `${missing} reputation short of the ${name}`,
  hubAllOpen: 'the whole season is open',
  hubLockedTag: (gate) => `rep ${gate}`,
  hubWinsTag: (n) => `${n}× podium`,
  hubCurrentTag: 'current stage',
  hubRivalTitle: 'THE RIVAL',
  hubRivalLine: (wins, losses) => `you ${wins} × ${losses} them`,
  hubNoRival: 'no rival yet: play your first career edition',
  hubAlumniTitle: 'ALUMNI',
  hubNoAlumni: 'no graduates yet: hire juniors and let a senior sit next door',
  hubHistoryTitle: 'RECENT RUNS',
  hubNoHistory: 'no runs on record yet',
  hubAchTitle: (got, total) => `ACHIEVEMENT GALLERY · ${got}/${total}`,
  hubSecret: '??? (secret)',
  hubDailyLine: (date) => `today's daily (${date}): same seed for everyone — one fair fight`,
  hubPlayNext: (name) => `play: ${name}`,
  hubBack: 'back',
  modeWord: { career: 'career', quick: 'quick', daily: 'daily' },
  ev: {
    ship: (name, task) => `${name} shipped "${task}"`,
    awaitShip: (name, task) => `${name} finished "${task}" and will NOT let it merge. Pet them.`,
    shortcut: (name, task) => `${name} stumbled into a brilliant shortcut: "${task}" jumped ahead`,
    bugKeyboard: (name, track) => `${name} sat on the keyboard: BUG in ${track}`,
    bugUntested: (name, track) => `${name} shipped without testing: BUG in ${track}`,
    bugfix: (track) => `${track} bug fixed`,
    zoomies: (name) => `${name} got the zoomies across the desks`,
    cable: (name) => `${name} BIT THE CABLE: build is down (send someone to the rack)`,
    cableFixed: 'cable reconnected, build is back',
    nap: (name) => `${name} passed out`,
    eat: (name) => `${name} went to eat`,
    hairball: 'HAIRBALL in the repository: merge locked! (send someone to the rack)',
    hairballFixed: 'hairball resolved, merge unlocked',
    buildBroken: 'BUILD LOST. Send a cat to the rack to recover it.',
    buildFixed: 'build recovered, merges are moving again',
    treat: (name) => `${name} got a treat`,
    cut: (task) => `scope cut: "${task}"`,
    overpet: (name) => `${name} is OVERSTIMULATED: enough petting for now`,
    decisionNeeded: (task) => `the project awaits a DECISION: "${task}" (open the project)`,
    decision: (option) => `decided: ${option}`,
    pep: (name, flavor) =>
      [
        `Biscoito (PM) to ${name}: "you are CRUSHING it. hydrate."`,
        `Biscoito (PM) pats ${name}: "one commit at a time, champion"`,
        `Biscoito (PM) to ${name}: "the demo believes in you. I believe in you."`,
      ][flavor]!,
    pmWorry: (behind, flavor) =>
      [
        `Biscoito (PM) stares at the gantt: ${behind} feature${behind > 1 ? 's' : ''} behind the curve...`,
        `Biscoito (PM) recalculates the burndown for the ${behind}th time`,
        `Biscoito (PM), sweating: "we are ${behind} behind but it's FINE. it's fine."`,
      ][flavor]!,
    pitchStart: 'THE 48 HOURS ARE UP. Everyone on stage: pitch time!',
    demoGlitch: 'THE DEMO FROZE LIVE! any cat: improvise!',
    improviso: (name) => `${name} turned the bug into an improvised demo. The crowd LOVED it.`,
    traitRevealed: (name, trait) => `the resume didn't mention: ${name} is a "${trait}"`,
    sponsorOutage: "THE SPONSOR'S INTEGRATION WENT DOWN: build is down (send someone to the rack)",
    harmony: (a, b) => `${a} and ${b} are purring in sync at neighboring desks`,
    friction: (a, b) => `${a} and ${b} are hissing across the desks — bad chemistry`,
    fight: (a, b) => `${a} and ${b} ARE SCRATCHING EACH OTHER — separate them!`,
    fightSeparated: (a, b) => `${a} and ${b} were separated. dignity not recovered.`,
    mentor: (mentor, junior) => `${mentor} is mentoring ${junior} from the next desk`,
    grown: (name) => `${name} GREW UP this edition: junior no more (in spirit)`,
    mvpReady: 'MVP READY: freeze the submission, or reach for more (open the sprint panel)',
    stretchOpen: (name) => `stretch opportunity open: ${name}`,
    stretchTaken: (name) => `stretch accepted: "${name}" is on the board`,
    stretchDone: (name) => `STRETCH SHIPPED: ${name} — the score multiplier went up`,
    freeze: 'BUILD FROZEN. Early delivery in the pocket — straight to the stage!',
  },
};

const PT: Dict = {
  weekdays: ['SEX', 'SAB', 'DOM'],
  day: 'DIA',
  left: (h, mm) => `${h}h${mm} restantes`,
  features: (n, total) => `features ${n}/${total}`,
  buildOk: 'BUILD OK',
  buildDown: 'BUILD FORA DO AR',
  buildDead: 'BUILD QUEBRADO',
  bugs: (n) => `${n} bug${n > 1 ? 's' : ''}`,
  decisions: (n) => (n > 1 ? `${n} decisoes!` : 'decisao!'),
  mergeLocked: 'MERGE TRAVADO — leva alguem ao rack',
  btnTreat: 'petisco',
  btnProject: 'projeto',
  btnSound: 'som',
  btnDetails: 'detalhes',
  btnCut: 'cortar',
  btnOpenEmail: 'abrir o e-mail',
  btnLockTeam: 'fechar equipe',
  btnAgain: 'jogar de novo',
  cutHint: 'tirar do escopo: nao pontua, mas nao vira ponta solta',
  titleSub: 'o maior hackathon do mundo. a tua equipe e de gatos.',
  titleBrief: 'desafio da organizacao: 48 horas, tres juizes, uma mao.',
  titleHelp:
    'primeiro, o RECRUTAMENTO: seis candidatos, tres moedas, um orcamento. depois: arrasta gato para mesa, segura o dedo = carinho, corta escopo no projeto, emergencia = rack.',
  langWord: 'EN',
  welcome: 'bem-vindos ao CATATHON',
  buses: { music: 'musica', sfx: 'efeitos', typing: 'teclados', ambience: 'ambiente', vocals: 'gatos' },
  dockNow: (mode) => `agora: ${mode}`,
  meters: { energy: 'energia', stress: 'estresse', morale: 'moral', hunger: 'fome' },
  modes: {
    idle: 'parado, pensando na vida',
    walk: 'andando',
    work: 'trabalhando',
    nap: 'dormindo',
    eat: 'comendo',
    zoomies: 'ZOOMIES pelo booth',
    keyboard: 'sentado no teclado (bug!)',
    held: 'na tua mao',
    petted: 'recebendo carinho',
  },
  taskShipped: 'shipada',
  taskCut: 'cortada',
  taskDeciding: 'DECISAO aberta: a mesa espera',
  taskAwaitShip: 'o perfeccionista espera teu SHIPA (carinho nele)',
  taskWaits: (deps) => `espera: ${deps}`,
  recruitTitle: 'Re: Candidatos para a CATATHON',
  recruitIntro: (name, brief, emphasis, layout) =>
    `"separei seis perfis. teu orcamento da para tres ou quatro, dependendo do tier. o desafio desta edicao e ${name}: ${brief}. a banca vai pesar ${emphasis}. teu booth: ${layout}."`,
  recruitBalance: (cost, n, blown) => `saldo: ${cost}${blown ? ' (ESTOUROU)' : ''} · equipe: ${n}`,
  emphasisName: { tecnica: 'tecnica', estabilidade: 'estabilidade', experiencia: 'experiencia', inovacao: 'inovacao' },
  pitchTitle: 'O PITCH — segura a plateia!',
  pitchTimer: (s) => `${s}s de palco`,
  pitchCrisis: 'A DEMO TRAVOU! qualquer gato improvisa!',
  abilityWord: {
    perfeccionista: 'encarada',
    cowboy: 'cacar cursor',
    calmo: 'ronronar',
    'julga-em-silencio': 'paozinho',
  },
  resultTitle: {
    'grand-prize': 'GRAND PRIZE! 🏆',
    podio: 'PODIO!',
    mencao: 'mencao honrosa',
    participacao: 'certificado de participacao',
    crashed: 'A DEMO CRASHOU.',
  },
  crashedBuild: 'o build estava quebrado desde a bola de pelo.',
  crashedBugs: (n) => `${n} bug(s) vivos na demo. os deuses da demo cobraram.`,
  dims: { tecnica: 'tecnica', estabilidade: 'estabilidade', experiencia: 'experiencia', inovacao: 'inovacao', pitch: 'pitch' },
  plateia: (pct) => `plateia: ${pct}% de pe`,
  improviso: 'a demo TRAVOU ao vivo — e virou improviso heroico. lenda.',
  stats: (core, polish, bugs, loose, total) =>
    `${core} core · ${polish} polimentos · ${bugs} bugs vivos · ${loose} pontas soltas · total ${total}`,
  judgeLens: ['arquitetura: features core e pontas soltas', 'estabilidade: bugs vivos na demo', 'experiencia: polimento e a trilha de design'],
  modeCareer: 'carreira',
  modeQuick: 'quick run',
  modeDaily: 'daily',
  walletLine: (cost) => `carteira: ${cost}`,
  shopTitle: 'lojinha de apetrechos (a edicao oferece tres)',
  gearOwned: 'no carrinho',
  btnCatnip: 'catnip',
  btnLaser: 'laser',
  prizeLine: (prize) => `premio: ${prize}`,
  prizePartName: {
    placement: 'colocacao',
    zeroBugs: 'zero bugs',
    deals: 'acordos',
    sponsor: 'sponsor',
    special: 'trofeu especial',
    juniors: 'crescimento de junior',
    debt: 'divida tecnica',
  },
  walletAfter: (wallet) => `carteira da carreira: ${wallet}`,
  achievementsTitle: 'conquistas desbloqueadas',
  sponsorTitle: 'um sponsor passou no booth',
  sponsorAccept: 'assinar o contrato',
  sponsorSigned: 'assinado — rele a letra miuda se tiver coragem',
  specialLine: (name, hint) => `categoria especial desta edicao: ${name} — ${hint}`,
  rivalIntro: (name, taunt) => `booth ao lado: ${name}. ${taunt}`,
  rivalRoster: (names) => `no time deles agora: ${names}`,
  rivalBeat: (name, theirs, yours) => `voce venceu ${name}! ${theirs} deles vs ${yours} teus. o rabo parou de abanar.`,
  rivalLost: (name, theirs, yours) => `${name} fez ${theirs} vs teus ${yours}. eles estao INSUPORTAVEIS.`,
  repLine: (rep, delta) => `reputacao: ${rep}${delta === 0 ? '' : delta > 0 ? ` (+${delta})` : ` (${delta})`}`,
  sponsorMetLine: (name) => `contrato da ${name} cumprido: o payout esta no premio`,
  sponsorFailedLine: (name) => `contrato da ${name} FURADO — a noticia corre (reputacao cai)`,
  specialWonLine: (name) => `trofeu especial conquistado: ${name}`,
  graduatesLine: (names) => `cresceram nesta edicao: ${names} — voltam como plenos`,
  poachedLine: (star, rival) => `${star} foi para ${rival}. o dinheiro era bom. o booth ficou mais quieto.`,
  vibesLabel: 'convivencia',
  sprintTitle: 'MVP PRONTO — congela, ou mira mais alto?',
  sprintFreezeWord: 'congelar a build',
  sprintFreezeHint: (pts) => `entrega antecipada: +${pts} pts + estabilidade, garantidos`,
  sprintAccept: 'topar',
  sprintTakenTag: 'no quadro',
  sprintMult: (mult) => `multiplicador de score ×${mult}`,
  sprintGain: (gain) => `paga: ${gain}`,
  sprintRisk: (risk) => `risco: ${risk}`,
  btnHub: 'central da carreira',
  eventInvite: (name, blurb, paws, prize) => `este palco do circuito: ${name} — ${blurb}. dificuldade ${paws} · premiacao ×${prize}`,
  eventAt: (name) => `palco: ${name}`,
  earlyLine: (pts) => `entrega antecipada: +${pts} pts (congelou com folga)`,
  stretchLine: (n, mult) => `stretch sprint: ${n} feature${n > 1 ? 's' : ''} ambiciosa${n > 1 ? 's' : ''} shipada${n > 1 ? 's' : ''} — score ×${mult}`,
  qualifiedLine: (name) => `CLASSIFICADO: chegou o convite do ${name}`,
  newBestLine: (score) => `novo recorde pessoal: ${score}`,
  seasonWonLine: 'A TEMPORADA E TUA: Global Catathon vencido com o rival batido.',
  hubTitle: 'CENTRAL DA CARREIRA',
  hubCircuitTitle: 'CATATHON CIRCUIT — a temporada',
  hubSeasonWon: 'temporada completa: o Global e teu',
  hubStatRuns: 'runs',
  hubStatBest: 'recorde pessoal',
  hubStatRep: 'reputacao',
  hubStatWallet: 'carteira',
  hubNever: '—',
  hubNextUnlock: (name, missing) => `faltam ${missing} de reputacao para o ${name}`,
  hubAllOpen: 'a temporada inteira esta aberta',
  hubLockedTag: (gate) => `rep ${gate}`,
  hubWinsTag: (n) => `${n}× podio`,
  hubCurrentTag: 'palco atual',
  hubRivalTitle: 'O RIVAL',
  hubRivalLine: (wins, losses) => `voce ${wins} × ${losses} eles`,
  hubNoRival: 'ainda sem rival: jogue a primeira edicao da carreira',
  hubAlumniTitle: 'ALUMNI',
  hubNoAlumni: 'nenhum formado ainda: contrate juniores e sente um senior ao lado',
  hubHistoryTitle: 'ULTIMAS RUNS',
  hubNoHistory: 'nenhuma run registrada ainda',
  hubAchTitle: (got, total) => `GALERIA DE CONQUISTAS · ${got}/${total}`,
  hubSecret: '??? (secreta)',
  hubDailyLine: (date) => `daily de hoje (${date}): a mesma semente para todo mundo — briga justa`,
  hubPlayNext: (name) => `jogar: ${name}`,
  hubBack: 'voltar',
  modeWord: { career: 'carreira', quick: 'quick', daily: 'daily' },
  ev: {
    ship: (name, task) => `${name} shipou "${task}"`,
    awaitShip: (name, task) => `${name} terminou "${task}" e NAO deixa mergear. Faz carinho nele.`,
    shortcut: (name, task) => `${name} descobriu um atalho genial sem querer: "${task}" adiantou`,
    bugKeyboard: (name, track) => `${name} sentou no teclado: BUG em ${track}`,
    bugUntested: (name, track) => `${name} shipou sem testar: BUG em ${track}`,
    bugfix: (track) => `bug de ${track} consertado`,
    zoomies: (name) => `${name} entrou em zoomies pelas mesas`,
    cable: (name) => `${name} MORDEU O CABO: build fora do ar (leva alguem ao rack)`,
    cableFixed: 'cabo religado, build de volta',
    nap: (name) => `${name} apagou`,
    eat: (name) => `${name} foi comer`,
    hairball: 'BOLA DE PELO no repositorio: merge travado! (leva alguem ao rack)',
    hairballFixed: 'bola de pelo resolvida, merge liberado',
    buildBroken: 'BUILD PERDIDO. Leve um gato ao rack para recuperar.',
    buildFixed: 'build recuperado, merges liberados novamente',
    treat: (name) => `${name} ganhou petisco`,
    cut: (task) => `escopo cortado: "${task}"`,
    overpet: (name) => `${name} ficou SUPERESTIMULADO: chega de carinho por ora`,
    decisionNeeded: (task) => `o projeto espera uma DECISAO: "${task}" (abre o projeto)`,
    decision: (option) => `decidido: ${option}`,
    pep: (name, flavor) =>
      [
        `Biscoito (PM) para ${name}: "voce esta ARRASANDO. bebe agua."`,
        `Biscoito (PM) da tapinha em ${name}: "um commit de cada vez, campeao"`,
        `Biscoito (PM) para ${name}: "a demo acredita em voce. EU acredito."`,
      ][flavor]!,
    pmWorry: (behind, flavor) =>
      [
        `Biscoito (PM) encara o gantt: ${behind} feature${behind > 1 ? 's' : ''} atras da curva...`,
        `Biscoito (PM) recalcula o burndown pela ${behind}a vez`,
        `Biscoito (PM), suando: "estamos ${behind} atras mas TA TUDO BEM. ta tudo bem."`,
      ][flavor]!,
    pitchStart: 'AS 48H ACABARAM. Todos ao palco: e hora do pitch!',
    demoGlitch: 'A DEMO TRAVOU AO VIVO! qualquer gato: improvisa!',
    improviso: (name) => `${name} transformou o bug em demo improvisada. A plateia AMOU.`,
    traitRevealed: (name, trait) => `o curriculo nao contava: ${name} e "${trait}"`,
    sponsorOutage: 'A INTEGRACAO DO SPONSOR CAIU: build fora do ar (leva alguem ao rack)',
    harmony: (a, b) => `${a} e ${b} estao ronronando em sincronia nas mesas vizinhas`,
    friction: (a, b) => `${a} e ${b} estao se bufando entre as mesas — quimica ruim`,
    fight: (a, b) => `${a} e ${b} ESTAO SE UNHANDO — separe os dois!`,
    fightSeparated: (a, b) => `${a} e ${b} foram separados. a dignidade nao.`,
    mentor: (mentor, junior) => `${mentor} esta mentorando ${junior} da mesa ao lado`,
    grown: (name) => `${name} CRESCEU nesta edicao: junior so no cracha`,
    mvpReady: 'MVP PRONTO: congele a submissao, ou mire mais alto (abra o painel do sprint)',
    stretchOpen: (name) => `oportunidade de stretch aberta: ${name}`,
    stretchTaken: (name) => `stretch aceito: "${name}" entrou no quadro`,
    stretchDone: (name) => `STRETCH SHIPADO: ${name} — o multiplicador de score subiu`,
    freeze: 'BUILD CONGELADA. Entrega antecipada no bolso — direto ao palco!',
  },
};

const DICTS: Record<Locale, Dict> = { en: EN, pt: PT };

/** O dicionario do idioma atual. */
export const t = (): Dict => DICTS[current];

/** Rotulos dos dados da sim, no idioma atual. */
export const traitLabel = (id: string): string => TRAIT_TEXT[current][id as TraitId] ?? id;
export const tierLabel = (tier: Tier): string => TIER_TEXT[current][tier];
export const specLabel = (spec: Spec): string => SPEC_TEXT[current][spec];
