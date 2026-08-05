import type { RNG } from '@voxelyn/core';
import type { LineageId, OccupationId, StratumId } from './strata.js';
import type { PlayerTuning } from './progression.js';

export type Vec2 = { x: number; y: number };

export type RunConfig = {
  seed: number;
  width?: number;
  height?: number;
  playerCount?: number;
  /**
   * Setor em que a run COMECA. Padrao 1.
   *
   * Existe porque a run deixou de ser um mapa e virou tres encadeados, e sem
   * isto nao ha como construir o estado do setor 3 diretamente. Dois
   * consumidores reais dependem disso: um cliente que reconecta no meio de uma
   * run de co-op precisa reconstruir o mundo do setor em que a sala esta, e
   * testar o Guardiao exigiria dirigir a run inteira ate ele antes de qualquer
   * asserção sobre a arena.
   */
  sector?: number;
  /**
   * A configuracao do Prospector desta run. Ausente = G-00 de fabrica.
   *
   * Congelada na criacao e nunca relida: a run inteira roda contra o mesmo
   * objeto, e comprar um protocolo no meio de uma expedicao nao muda o
   * Prospector que ja desceu. E o que permite re-simular uma run antiga com o
   * tuning que ela realmente usou, meses depois de a arvore ter mudado.
   */
  tuning?: PlayerTuning;
};

export type RunPhase = 'running' | 'dead' | 'extracted' | 'extracted_with_core';
export type EnemyArchetype =
  | 'stalker'
  | 'bruiser'
  | 'spitter'
  | 'bomber'
  | 'guardian'
  /**
   * Bispo: o chefe de qualquer mapa profundamente ocupado pelo micelio (ver
   * bossForBiome em bosses.ts). Regenera em pe sobre chao fungico, e o contra e
   * queimar a arena. A identidade dele nao e o ataque, e o TERRENO — ele
   * transforma a luta num problema de material, que e a identidade do jogo.
   */
  | 'bishop'
  /**
   * Cavalo Fungico: elite MOVEL, sorteado em qualquer setor. Investida longa
   * deixando rastro de fogo, o que encolhe a arena sozinho e reage com tudo o
   * que ja existe no chao.
   */
  | 'fungal_horse'
  /**
   * Empoverished Miner: um AUTOMATO de extracao abandonado. Passivo por padrao.
   *
   * Foi uma unidade de manutencao da grade, deixada para tras quando os veios
   * desabaram, e continua cumprindo a ordem que ninguem cancelou. E da mesma
   * familia do prospector — e essa e a leitura que o encontro inteiro carrega:
   * o jogador nao esta matando um coitado, esta matando o proprio antecessor.
   *
   * A reacao dele nao e sorteada: sai do CALOR da sua arma quando ele levanta a
   * cabeca. Frio, te ignora; morno, foge; quente, sobrecarrega e ataca. O
   * sorteio era a versao obvia e violava o invariante do jogo — dano sem sinal.
   */
  | 'miner'
  /**
   * Bestiario de assinatura: um por estrato, e cada um manipula a REGRA do
   * proprio bioma em vez de trazer uma nova. Ver constants.ts, secao
   * "Bestiario de assinatura", para o desenho de cada um.
   */
  | 'resonant'
  | 'mud_lamprey'
  | 'bellows'
  | 'scoriac'
  | 'frost_wraith'
  /**
   * Bombardeiro de Enxofre: a silhueta do Spore Bomber com a quimica do
   * lugar. Estoura em GAS, nao em esporos — e gas, ao contrario de esporo,
   * pega fogo. So nasce onde o enxofre existe (Fenda e Fornalha).
   */
  | 'sulfur_bomber'
  /**
   * Coveiro: catador de sucata do Ferrifero. ATRAI o jogador com o eletroima
   * do braço e prensa. E o unico corpo do bestiario que tira do jogador a
   * posicao — a variavel de que todo o resto do combate depende.
   */
  | 'undertaker'
  /**
   * DIAMANDIS: o chefe da Cicatriz Aurix. Nao e fauna e nao e do Veio — e a
   * maior escavadeira que a companhia construiu, abandonada porque recupera-la
   * custava mais que o programa inteiro, ainda executando uma escavacao que
   * nao consta dos mapas. As tres armas dele sao FERRAMENTAS: broca, cargas de
   * implosao e um feixe de prospeccao. Ele nao esta lutando, esta trabalhando.
   */
  | 'diamandis';
export type ModuleId = 'piercing' | 'conductive' | 'explosive' | 'siphon' | 'ricochet' | 'return_disc';
export type ModuleTag = 'projectile' | 'utility' | 'volatile' | 'defensive' | 'safe';
export type ModuleLifetime =
  | { kind: 'charges'; remaining: number; maximum: number }
  | { kind: 'timer'; acquiredAtTick: number; expiresAtTick: number };
export type ActiveModule = { id: ModuleId; lifetime: ModuleLifetime };
export type EffectOrigin = { source: 'player' | 'enemy' | 'environment'; owner?: number };
export type PendingModuleChoice = {
  sourceSiteId: number;
  options: [ModuleId, ModuleId];
  createdAtTick: number;
};

/**
 * O QUE machucou. Autoritativo, produzido pela simulacao.
 *
 * Existe por causa do invariante de design "morte que ensina" (secao 15 da
 * spec): uma tela de fim que so diz "O VEIO TE CONSUMIU" nao ensina nada, e a
 * diferenca entre um jogador que volta e um que fecha a aba costuma ser saber
 * o que o matou. Tres mortes que hoje sao indistinguiveis viram licoes
 * distintas: o gas que VOCE acendeu, a poca que VOCE eletrificou, e o bruiser
 * que voce nao ouviu.
 *
 * Vive na sim e nao no cliente porque so a sim sabe. Reconstruir a causa a
 * partir dos eventos seria adivinhacao: `hit` diz quanto doeu, nunca de onde
 * veio, e o ultimo `hit` antes da morte pode ser o respingo de fogo e nao a
 * pedra que tirou 22.
 *
 * `source` em explosao e descarga e o campo que carrega a licao inteira:
 * `{ kind: 'explosion', source: 'player' }` significa "voce se explodiu", que e
 * uma morte de decisao — exatamente o tipo que o design quer que aconteca.
 */
export type DamageCause =
  | { kind: 'player_shot' }
  | { kind: 'enemy_contact'; archetype: EnemyArchetype; elite: boolean }
  | { kind: 'enemy_projectile'; archetype: EnemyArchetype; elite: boolean; projectile: ProjectileKind }
  | { kind: 'fire' }
  | { kind: 'gas' }
  | { kind: 'spores' }
  | { kind: 'discharge'; source: EffectOrigin['source'] }
  | { kind: 'explosion'; source: EffectOrigin['source'] }
  | { kind: 'overheat' }
  | { kind: 'bleedout' }
  /** Ultimo recurso: nenhum caminho de dano deveria chegar aqui. */
  | { kind: 'unknown' };

/**
 * Contadores da run. Puramente descritivos: nada aqui realimenta a simulacao.
 *
 * Sao inteiros de proposito — entram no hash autoritativo, e float acumulado em
 * ordens diferentes diverge entre maquinas. `damageTaken` e `damageDealt`
 * guardam decimos arredondados pelo mesmo motivo.
 */
export type RunStats = {
  shotsFired: number;
  /** Mortes por arquetipo. Alimenta o bestiario do cliente. */
  kills: Record<EnemyArchetype, number>;
  /** Decimos de dano; dividir por 10 para exibir. */
  damageTakenTenths: number;
  damageDealtTenths: number;
  /** Solidos destruidos pelo jogador ou por reacoes que ele causou. */
  solidsDestroyed: number;
  /** Terminais de salvage concluidos. */
  salvageCompleted: number;
  modulesAcquired: number;
  purgeCellsUsed: number;
  /** Quantas vezes o jogador ficou abatido (co-op). */
  timesDowned: number;
  revivesGiven: number;
  /**
   * Lascas de minerio arrancadas — a "cota".
   *
   * Opcional por design: ninguem e obrigado a minerar. Quem minera compra
   * escolha de modulo com isso, e desempata no ranking. Uma cota obrigatoria
   * viraria imposto sobre o tempo, e o tempo ja e cobrado pela terceira estrela.
   */
  oreCollected: number;
  /**
   * Mineradores PASSIVOS destruidos — unidades que nao tinham reagido a voce.
   *
   * Nao muda numero nenhum da run, de proposito. O prospector e um robo sem
   * compasso moral e o jogo nao vai puni-lo com dano nem com pontuacao por isso
   * — ia soar como uma moral que a ficcao nega. Ele so ANOTA, e mostra anotado
   * no fim. A mancha e o registro, nao a penalidade.
   *
   * O nome do campo continua sendo `innocentsKilled` depois de o mineiro deixar
   * de ser humano porque o que ele conta nao mudou: alguma coisa que nao ia
   * fazer nada com voce, e que voce destruiu assim mesmo.
   */
  innocentsKilled: number;
  /**
   * Reacoes sistemicas testemunhadas, para o codex do cliente.
   *
   * Bitmask e nao lista porque entra no hash: um Set nao tem ordem estavel
   * entre maquinas e um array cresceria sem teto.
   */
  discoveries: number;
};

/** Bits de `RunStats.discoveries`. Cada um e uma licao que o mundo ensinou. */
export const DISCOVERY_FIRE_SPREAD = 1 << 0;
export const DISCOVERY_DISCHARGE_POOL = 1 << 1;
export const DISCOVERY_GAS_IGNITION = 1 << 2;
export const DISCOVERY_FRAGILE_BREACH = 1 << 3;
export const DISCOVERY_SELF_HARM = 1 << 4;
export const DISCOVERY_ORE_CHAIN = 1 << 5;
export const DISCOVERY_GUARDIAN_FELLED = 1 << 6;
export const DISCOVERY_CORE_TAKEN = 1 << 7;
export const DISCOVERY_BISHOP_FELLED = 1 << 8;
export const DISCOVERY_HORSE_FELLED = 1 << 9;
export const DISCOVERY_MINER_FLED = 1 << 10;
export const DISCOVERY_MINER_ENRAGED = 1 << 11;
/**
 * APOSENTADO. Era "a empresa paga por tonelada", da cota de modulo por minerio.
 *
 * A constante fica reservada em vez de reciclada: perfis salvos ja tem este bit
 * aceso, e dar o mesmo numero a uma descoberta nova a faria nascer desbloqueada
 * para quem jogou antes. O bit nao volta a ser usado.
 */
export const DISCOVERY_ORE_QUOTA_RETIRED = 1 << 12;
/**
 * Morrer carregando carga nao homologada.
 *
 * A licao que substitui a da cota, e a unica frase que o loop novo precisa
 * ensinar: o que fica no Veio nunca existiu. Ninguem aprende isso lendo o menu;
 * aprende-se perdendo trinta lascas a dois setores da plataforma.
 */
export const DISCOVERY_CARGO_LOST = 1 << 13;
/**
 * VIU a cura do Bispo acontecer — perto o bastante e com a linha livre.
 *
 * Nao basta ele ter se curado: o documento que este bit abre e uma MEDICAO de
 * campo, e medir exige ter estado la. Um bit aceso por uma cura do outro lado
 * do mapa entregaria o relatorio a quem nunca viu o chao devolver vida a nada.
 */
export const DISCOVERY_BISHOP_HEALED = 1 << 14;
/**
 * Estava DENTRO do disco da Supernova quando ela abriu — e continuou de pe.
 *
 * O par natural do bit acima, e o unico jeito honesto de destravar o documento
 * que diz que a emissao nao persegue ninguem: quem leu isso pagou para ler.
 */
export const DISCOVERY_BISHOP_NOVA_SURVIVED = 1 << 15;
/**
 * VIU a broca do Diamandis abrir um corredor pela rocha.
 *
 * E o unico fato do encontro que ensina o que ele E: uma maquina cujo golpe
 * nao mira em voce — ele reescreve a sala. O documento que este bit abre e o
 * relatorio de engenharia sobre o raio minimo de operacao, e ele so faz
 * sentido para quem viu a resposta da companhia acontecer na propria parede.
 */
export const DISCOVERY_DIAMANDIS_CORRIDOR = 1 << 16;
/**
 * VIU um Coveiro arrancar um modulo da carcaça do Diamandis.
 *
 * E o instante em que o jogador descobre que aquelas unidades nao vieram COM o
 * chefe — vieram antes dele, e continuam executando uma ordem de recolhimento
 * que ninguem cancelou. O que ele faz com essa informacao (deixar trabalhar ou
 * interceptar) e a escolha do encontro.
 */
export const DISCOVERY_DIAMANDIS_MODULE = 1 << 17;

/**
 * O resultado congelado de uma run. Construido uma vez, quando a run termina.
 *
 * Congelado e nao derivado sob demanda porque `state` continua sendo o objeto
 * vivo depois do fim (o cliente ainda o desenha na tela de resultado), e um
 * sumario recalculado a cada quadro daria numeros que mudam enquanto o jogador
 * os le.
 */
export type RunSummary = {
  seed: number;
  phase: RunPhase;
  ticks: number;
  /** Contaminacao final, 0..1. */
  contamination: number;
  /** Nulo quando a run terminou em extracao. */
  deathCause: DamageCause | null;
  stats: RunStats;
  stars: 0 | 1 | 2 | 3;
  /** Tempo, em ticks, abaixo do qual a terceira estrela e concedida. */
  targetTicks: number;
};

export type EntityActionKind =
  | 'player_shot'
  | 'ranged'
  | 'contact'
  | 'charge'
  | 'detonate'
  | 'slam'
  | 'hurl'
  | 'pulse'
  /** Broca de avanco do Diamandis: rumo fixo, atravessa a arena abrindo vao. */
  | 'drill'
  /** Salva de demolicao: tres cargas caem nas areas marcadas no windup. */
  | 'demolish'
  /** Feixe de prospeccao: varredura inofensiva, depois potencia na mesma linha. */
  | 'beam'
  /** Eletroima do Coveiro: arrasta o alvo para perto antes da prensa. */
  | 'haul'
  /** Canalizacao do lanca-chamas: `endTick` cobre a duracao inteira do sopro. */
  | 'breath';
export type EntityActionPhase = 'windup' | 'release' | 'recovery';
export type EntityAction = {
  kind: EntityActionKind;
  phase: EntityActionPhase;
  startedAt: number;
  releaseAt: number;
  endsAt: number;
  direction: Vec2;
  target?: number;
  /**
   * Disparos AINDA POR SAIR de uma rajada (Salva Litoclasta do Guardiao em
   * segunda fase). Presente = a acao re-arma o proprio release: cada disparo
   * corrige a mira e empurra `releaseAt` pelo intervalo da rajada, entao o
   * hash (que mistura os relogios da acao) acompanha sozinho. Ausente = acao
   * de release unico, como todas as outras.
   */
  salvo?: number;
};

export type Entity = {
  id: number;
  kind: 'player' | 'enemy';
  archetype: EnemyArchetype | 'prospector';
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  elite: boolean;
  nextActionAt: number;
  contactReadyAt: number;
  rangedReadyAt: number;
  stunnedUntil: number;
  /**
   * Ate quando este inimigo continua caçando por ter LEVADO DANO.
   *
   * Sem isto o aggro era so distancia, recalculado a cada tick — entao dava para
   * matar qualquer coisa de fora do raio dela sem que ela reagisse. Com alcance
   * de tiro de 18 tiles contra raios de aggro de 7 a 9, isso nao era um caso de
   * borda: era o jeito normal de lutar.
   */
  alertedUntil: number;
  facing: Vec2;
  action?: EntityAction;
  slot?: number;
  /**
   * Postura do Empoverished Miner. Ver MINER_MOOD_*.
   *
   * Vive na entidade e viaja no snapshot porque o cliente precisa DESENHAR a
   * diferenca — olhos vermelhos fumegando raiva sao a unica coisa que avisa que
   * aquele humano parado virou uma ameaca. Derivar no cliente exigiria repetir a
   * regra de calor la, e as duas copias divergiriam no primeiro ajuste.
   */
  mood?: number;
};

/**
 * O estado vivo do encontro de chefe do setor.
 *
 * Existia como seis campos soltos no estado, todos com prefixo `guardian`,
 * porque durante muito tempo so havia um chefe com estado proprio. Com
 * `bossForBiome` a camara final passou a poder ser de qualquer um da tabela —
 * e `state.guardianPath` sendo consumido pelo Bispo era um nome mentindo.
 *
 * Um objeto so, e nao um por chefe: a run tem UM encontro de chefe (o setor
 * final). O dia em que tiver dois, isto vira um mapa por `entityId` e todo
 * consumidor ja esta lendo de um lugar so.
 */
export type BossRuntime = {
  /** O chefe ja notou o jogador? Antes: `guardianAwake`. */
  awake: boolean;
  /**
   * Fases de UMA VEZ ja disparadas, por bit (ver `BOSS_PHASE_*`).
   *
   * Bitmask e nao um booleano por fase: o Guardiao tem uma (a matilha), o
   * Diamandis tera o colapso do reator, e cada chefe novo somaria mais um
   * campo ao estado autoritativo — que e hasheado e reenviado a cada resync.
   */
  phasesFired: number;
  /**
   * Rota corrente do chefe, em indices de celula, e o tick em que foi
   * calculada. DERIVADO: da para recalcular da grade a qualquer momento, entao
   * nao entra no hash nem viaja em snapshot.
   */
  path: number[];
  pathAt: number;
  /**
   * O cerco ja fechou? Separado das fases porque ele pode ter de ESPERAR o
   * jogador entrar no raio, enquanto os invocados saem na hora.
   */
  arenaClosed: boolean;
  /** Celulas vazias convertidas pelo cerco; removidas quando o chefe morre. */
  arenaBarrierCells: number[];
  /**
   * Onde as cargas da Salva de Demolicao vao cair, marcadas no INICIO do
   * telegrafo.
   *
   * Vive aqui e nao na acao porque `EntityAction` carrega UMA direcao, e a
   * salva sao tres pontos — e porque os pontos nao podem se corrigir depois de
   * marcados: sair do circulo e a resposta inteira do golpe, e ela so existe
   * se a marca ficar onde nasceu. Entra no hash: duas simulacoes que discordem
   * de onde a carga cai divergem no estrago.
   */
  blastCells: number[];
  /**
   * Modulos do Diamandis que ja se SOLTARAM da carcaca (bitmask por indice).
   *
   * Solto nao e perdido: a arma daquele modulo continua funcionando enquanto
   * ele estiver ali pendurado. O que "solto" muda e que um Coveiro passa a
   * conseguir engatar o eletroima nele.
   */
  modulesExposed: number;
  /**
   * Modulos ARRANCADOS (bitmask). Estes o chefe perdeu de vez: a arma
   * correspondente para de existir na luta.
   *
   * Separado de `modulesExposed` porque as duas coisas respondem a perguntas
   * diferentes — "da para arrancar?" e "ele ainda tem essa arma?" — e um unico
   * campo com tres estados obrigaria todo leitor a saber a ordem deles.
   */
  modulesLost: number;
};

/** A matilha da segunda fase do Guardiao. Antes: `guardianSummoned`. */
export const BOSS_PHASE_SUMMON = 1 << 0;
/** O colapso do reator do Diamandis, abaixo de metade da vida. */
export const BOSS_PHASE_REACTOR = 1 << 1;

/**
 * Os modulos do Diamandis, na ordem em que se soltam. Cada um alimenta UMA
 * arma: sem o modulo, a arma nao existe mais na luta.
 */
export const BOSS_MODULE_DRILL = 0;
export const BOSS_MODULE_TOWER = 1;
export const BOSS_MODULE_SCANNER = 2;

/** Postura do Miner. Ele nasce PASSIVO; o calor da sua arma decide o resto. */
export const MINER_MOOD_PASSIVE = 0;
export const MINER_MOOD_FLEEING = 1;
export const MINER_MOOD_ENRAGED = 2;

/**
 * Postura dos espreitadores (Lampreia e Espectro): dentro do proprio elemento
 * (submersa / sob o gelo) ou exposto. O cliente desenha a diferenca — a
 * ondulacao no lugar do corpo e a razao de o campo viajar no snapshot, pela
 * mesma logica do humor do Miner.
 */
export const LURKER_HIDDEN = 0;
export const LURKER_EXPOSED = 1;

/** Postura do Escoriaceo: couraça fria fechada, ou aberta pelo calor. */
export const SCORIAC_COOL = 0;
export const SCORIAC_HOT = 1;

/** Fase do Fole: inspirando (limpa gas em volta) ou expelindo (sopra linha). */
export const BELLOWS_INHALING = 0;
export const BELLOWS_EXHALING = 1;

/**
 * O que o Veio observou o jogador provocar.
 *
 * Quatro reacoes, e nao uma por evento do jogo: a oferta do poco precisa
 * distinguir ESTILOS, e um registro fino demais devolveria sempre a habilidade do
 * ultimo acidente em vez da do habito.
 */
export type ResonanceKind = 'fire' | 'current' | 'blast' | 'kinetic';

export type ResonanceTally = Record<ResonanceKind, number>;

export type AbilityId = 'pulse' | 'flamethrower' | 'seeker' | 'arc';

/**
 * Um Eco demonstrando uma habilidade ao lado do poco.
 *
 * Nao e uma entidade: nao colide, nao toma dano e nao aparece na lista de
 * inimigos. E uma oferta com posicao — o jogador anda ate ela e aperta usar.
 */
export type WellOffer = {
  ability: AbilityId;
  x: number;
  y: number;
  /** Slot que levou esta habilidade, ou null. A oferta some quando alguem pega. */
  takenBy: number | null;
};

export type PlayerExtra = {
  aim: Vec2;
  heat: number;
  overheatedUntil: number;
  nextShotAt: number;
  /**
   * Ate quando este jogador esta CANALIZANDO o lanca-chamas.
   *
   * Estado autoritativo: enquanto `tick < channelingUntil`, a simulacao emite o
   * sopro por conta propria a cada emissao e o disparo de bolts fica travado.
   * Zero significa "sem canal". Entra no hash — duas simulacoes que discordam
   * de um canal ativo divergem no primeiro tiro travado.
   */
  channelingUntil: number;
  dodgeUntil: number;
  iframesUntil: number;
  dodgeCooldownUntil: number;
  abilityCooldownUntil: number;
  purgeCells: number;
  activeModules: ActiveModule[];
  pendingModuleChoice: PendingModuleChoice | null;
  hasCore: boolean;
  dodgeDir: Vec2;
  downed: boolean;
  bleedoutAt: number;
  joined: boolean;
  /**
   * O que machucou este jogador por ultimo, e quando.
   *
   * Guardado no momento do dano e nao no momento da morte porque no instante da
   * morte a informacao ja se perdeu: `resolveDownedAndDeaths` roda depois, ve
   * apenas `hp <= 0`, e nao tem como saber se foram os 22 da pedra ou os 2,2
   * do fogo que estavam por baixo.
   */
  lastDamage: { cause: DamageCause; tick: number } | null;
  /** A habilidade equipada. Comeca em `pulse` e so muda no poco. */
  ability: AbilityId;
  /**
   * Reacoes provocadas NESTE setor.
   *
   * Zera na descida: a oferta do poco descreve como o jogador jogou o setor que
   * acabou de atravessar, e nao a run inteira. Sem o reset, o setor 3 ofereceria
   * o estilo do setor 1.
   */
  resonance: ResonanceTally;
};

/**
 * Que COISA e o projetil, para o cliente saber desenha-lo.
 *
 * Nao da para inferir isso das flags: a pedra do bruiser e o cuspe do spitter
 * sao os dois `hostile` e mais nada, entao o cliente desenhava os dois com a
 * rampa acida — um bloco de rocha arrancado da parede aparecia como cusparada.
 * As flags dizem o que o projetil FAZ; isto diz o que ele E.
 */
export type ProjectileKind = 'bolt' | 'spit' | 'rock' | 'return_disc' | 'seeker' | 'cart';

export type ProjectileModules = {
  piercing?: true;
  conductive?: true;
  siphon?: true;
  explosive?: { armAfterDistance: number };
  ricochet?: { remainingBounces: number };
};

export type DiscState = {
  phase: 'outbound' | 'returning';
  travelled: number;
  maxDistance: number;
  outboundHits: number[];
  returnHits: number[];
};

export type Projectile = {
  kind: ProjectileKind;
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Raio de colisao autoritativo; projeteis pequenos usam o fallback historico. */
  radius?: number;
  modules?: ProjectileModules;
  distanceTravelled: number;
  disc?: DiscState;
  hostile: boolean;
  leavesBiofluid: boolean;
  /**
   * Interrompe o alvo no impacto (BRUISER_ROCK_STUN_TICKS). E a assinatura do
   * arremesso unico do Britador; a Salva Litoclasta do Guardiao usa o mesmo
   * `kind: 'rock'` sem esta flag — tres pedras encadeando atordoamento seria
   * um stun-lock sem resposta. A flag vive no projetil (e nao numa checagem de
   * arquetipo do dono) porque o dono pode morrer com a pedra em voo.
   */
  stuns?: true;
  ttl: number;
  hits?: number[];
  /** Celulas fungicas que este projetil ja aqueceu; evita duplicar o mesmo impacto nos subpassos. */
  heatedSurfaceCells?: number[];
};

export type SalvageSite = {
  id: number;
  tier: 1 | 2 | 3;
  terminal: Vec2;
  cache: Vec2;
  terminalState: 'inactive' | 'scanning' | 'complete';
  scanEndsAt: number;
  cacheRevealed: boolean;
  cacheOpened: boolean;
  openedBySlot: number | null;
};
export type Vent = { x: number; y: number; nextEmitAt: number };

/**
 * Um tramo de trilho da armadilha de carrinho. Posicao/direcao/comprimento
 * vem do worldgen (derivaveis da seed, como os vents); `readyAt`/`firingAt`
 * sao o relogio da armadilha e `fromEnd` guarda de que ponta o carrinho vem
 * (decidido no gatilho: o lado LONGE de quem pisou).
 */
export type RailTrack = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  readyAt: number;
  firingAt: number;
  fromEnd: 0 | 1;
};

export type SemanticEvent =
  | { t: 'action_start'; entity: number; action: EntityActionKind; x: number; y: number; dx: number; dy: number; startTick: number; releaseTick: number; endTick: number }
  /**
   * Uma acao telegrafada morreu ANTES do `endTick` anunciado. Existe para o
   * sopro canalizado: `action_start` promete uma pose de 2,5 s, e um canal
   * cancelado (stun, queda, troca no poco) deixaria o cliente segurando a pose
   * — e retomando-a apos o revive — sem chama nenhuma saindo. O fim natural
   * NAO emite isto: ele coincide com o `endTick` que o cliente ja conhece.
   */
  | { t: 'action_end'; entity: number }
  | { t: 'hit'; x: number; y: number; amount: number; target: number }
  | { t: 'death'; x: number; y: number; entity: number; archetype: string; facingX: number; facingY: number; tick: number }
  | { t: 'explosion'; x: number; y: number; radius: number; source: 'player' | 'enemy' | 'environment'; owner?: number }
  /**
   * Um solido deixou de existir. Carrega QUAL material caiu para o cliente
   * poder desfazer o bloco no material certo; sem isso ele teria de adivinhar
   * pela grade, e a grade ja mudou quando o evento chega.
   */
  | { t: 'break'; x: number; y: number; solid: number }
  /**
   * Material cedendo por corrosao, sem ainda ter caido. O ESTADO em si viaja
   * pelo diff de chunk (o cliente ve o bloco enfraquecido no grid); este evento
   * so marca o instante, para o cliente cuspir respingo no lugar certo.
   */
  | { t: 'corrode'; x: number; y: number; solid: number }
  /** Lasca arrancada de um veio de minerio por impacto cinetico. */
  | { t: 'chip'; x: number; y: number }
  /**
   * O Miner levantou a cabeca e decidiu. Carrega a postura porque o cliente
   * precisa reagir NO INSTANTE — som e particula de raiva sao o aviso de que
   * aquele humano parado virou uma ameaca, e reconstruir isso de `mood` no
   * snapshot chegaria um tick depois e sem saber que foi a transicao.
   */
  | { t: 'miner_mood'; entity: number; x: number; y: number; mood: number }
  /** Minerio entrou na cota. `total` para o HUD nao ter de somar por conta. */
  | { t: 'ore_gained'; x: number; y: number; amount: number; total: number }
  | { t: 'discharge'; cells: number[]; source: 'player' | 'enemy' | 'environment'; owner?: number }
  | { t: 'ignite'; x: number; y: number }
  /**
   * Alguem recuperou vida. Existe para o Bispo poder ser LIDO: sem um evento, a
   * regeneracao dele seria uma barra que sobe sozinha e o jogador nunca
   * descobriria que o chao e a causa.
   */
  | { t: 'heal'; x: number; y: number; entity: number; amount: number }
  | { t: 'shot'; x: number; y: number; dx: number; dy: number; owner: number }
  | { t: 'dodge'; x: number; y: number }
  /**
   * Frente circular sem fogo. Carrega o RAIO porque agora tem duas fontes com
   * alcances diferentes — o pulso cinetico do jogador e a Supernova do bispo — e
   * o cliente desenha uma frente que promete ate onde o efeito chega. Um raio
   * constante copiado no cliente viraria mentira no primeiro ajuste de balanco.
   */
  | { t: 'pulse'; x: number; y: number; radius: number }
  /**
   * UMA emissao do sopro do lanca-chamas. `dx`/`dy` sao a direcao, `arc` a
   * meia-abertura. `seq` numera a emissao dentro do canal — sal deterministico
   * para as particulas variarem entre emissoes sem relogio local. `reach` e o
   * alcance REAL, ja recortado por paredes, de raios amostrados de `-arc` a
   * `+arc`: o cliente desenha o jato ate onde a simulacao de fato chegou, em vez
   * de prometer um cone que atravessa pedra. `owner` e a entidade soprando: e
   * por ele que o cliente mantem o TRONCO do dono girando junto com o jato —
   * inclusive o do parceiro remoto, cujo `facing` de snapshot segue os pes.
   */
  | { t: 'flame_cone'; owner: number; x: number; y: number; dx: number; dy: number; range: number; arc: number; seq: number; reach: number[] }
  /**
   * Um bolt do jogador morreu contra um solido que nao cedeu. Puramente
   * presentacional — o burst de plasma no ponto de contato. `nx`/`ny` e a normal
   * da face atingida, para o clarao nascer NA superficie da parede e nao no
   * centro da celula solida.
   */
  | { t: 'bolt_impact'; x: number; y: number; nx: number; ny: number }
  /** Um salto do arco condutivo, ja resolvido: o cliente so desenha a linha. */
  | { t: 'arc_chain'; hops: Array<{ x: number; y: number }> }
  /** Os Ecos do poco apareceram com o que demonstrar. */
  | { t: 'well_offers'; sector: number; abilities: AbilityId[] }
  | { t: 'ability_taken'; slot: number; ability: AbilityId; x: number; y: number }
  | { t: 'pickup_core'; x: number; y: number }
  | { t: 'terminal_activated'; siteId: number; x: number; y: number; completesAtTick: number }
  | { t: 'terminal_scan_complete'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_revealed'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_opened'; siteId: number; slot: number; x: number; y: number }
  | { t: 'purge_cell_acquired'; slot: number; amount: number }
  | { t: 'purge_cell_used'; slot: number; x: number; y: number }
  | { t: 'module_selected'; slot: number; module: ModuleId; sourceSiteId: number; recharged: boolean }
  | { t: 'module_charge_consumed'; slot: number; module: ModuleId; remaining: number; maximum: number }
  | { t: 'module_expired'; slot: number; module: ModuleId }
  | { t: 'overheat'; x: number; y: number }
  /**
   * O chefe do setor acordou. Chamava-se `guardian_awake`: o Guardiao era o
   * unico chefe que dormia ate ser notado, e desde `bossForBiome` a camara
   * final pode ser de outro.
   */
  | { t: 'boss_awake' }
  /**
   * O mundo inteiro foi trocado: o cliente precisa redesenhar do zero.
   *
   * Carrega o BIOMA porque o setor deixou de ser so um numero: o anuncio de
   * chegada mostra "AQUIFERO NEGRO · MATRIZ MICELIAL", e derivar isso no
   * cliente exigiria repetir a derivacao de linhagem la — duas copias que
   * divergiriam no primeiro ajuste de tabela.
   */
  | {
      t: 'sector_entered';
      sector: number;
      final: boolean;
      stratum: StratumId;
      occupation: OccupationId;
      /** Presente (true) quando a chegada e do caminho de VOLTA. */
      ascending?: true;
    }
  /**
   * O TELEGRAFO da armadilha de carrinho: pisar num tramo armado anuncia o
   * carrinho CART_WINDUP_TICKS antes de ele existir. O evento carrega o tramo
   * inteiro (origem, direcao, comprimento) para o cliente iluminar a LINHA —
   * o aviso util nao e "algo vem ai", e "saia DESTA faixa".
   */
  | { t: 'cart_warning'; x: number; y: number; dx: number; dy: number; len: number }
  /**
   * UMA carga da Salva de Demolicao foi marcada. O cliente desenha o circulo
   * ate `fireTick`; o dano so acontece la. Sai um evento por carga (e nao um
   * com a lista) porque o cliente ja trata efeitos por posicao, e assim uma
   * carga a mais nao muda o formato da mensagem.
   */
  | { t: 'blast_marker'; x: number; y: number; radius: number; fireTick: number }
  /**
   * O feixe de prospeccao. `powered` distingue as DUAS metades do golpe: a
   * varredura (false, inofensiva, durante o windup) e a passagem com potencia
   * (true, no release). Sem o campo o cliente desenharia as duas iguais e a
   * unica informacao que importa — "agora queima" — nao chegaria.
   */
  | { t: 'beam_line'; x: number; y: number; dx: number; dy: number; length: number; powered: boolean }
  /**
   * A vida de um modulo do Diamandis, num evento so em vez de tres tipos.
   *
   * `exposed`  soltou da carcaca — a partir daqui um Coveiro consegue engatar;
   * `detached` foi ARRANCADO: o chefe perdeu a arma e a peca esta sendo levada;
   * `dropped`  o carregador caiu e a peca voltou ao chao, recuperavel;
   * `lost`     a peca saiu do mapa. A recompensa foi junto.
   *
   * Um tipo por estado inflaria o wire com quatro formatos identicos, e o
   * cliente ja trata efeitos por posicao: o que muda entre eles e a cor do
   * aviso, nao a estrutura.
   */
  | {
      t: 'boss_module';
      x: number;
      y: number;
      module: number;
      state: 'exposed' | 'detached' | 'dropped' | 'lost';
    }
  | { t: 'player_down'; slot: number; x: number; y: number; facingX: number; facingY: number; tick: number }
  | { t: 'revive'; x: number; y: number; slot: number; tick: number }
  | { t: 'extracted'; withCore: boolean }
  /**
   * Um aviso da simulacao ao jogador, identificado por CHAVE e nao por frase.
   *
   * A simulacao roda nos dois lados — cliente e servidor, este ultimo para
   * re-verificar replays — e o servidor nao tem idioma de jogador para escolher.
   * Uma frase pronta aqui obrigaria a simulacao a saber em que lingua a partida
   * esta sendo jogada, o que e informacao de apresentacao vazando para dentro do
   * modelo. A chave viaja no wire com o mesmo custo e e traduzida por quem
   * desenha, no idioma daquele cliente.
   */
  | { t: 'message'; key: SimMessageKey };

/**
 * As mensagens que a simulacao sabe emitir.
 *
 * Uniao fechada de proposito: uma mensagem nova aqui quebra o catalogo do
 * cliente na COMPILACAO, que e onde o texto faltando tem de aparecer — e nao na
 * tela do jogador, como uma chave crua.
 */
export type SimMessageKey =
  | 'sim.partnerRevived'
  | 'sim.reviveBeforeDescend'
  | 'sim.waitAtShaft'
  | 'sim.coreTaken'
  | 'sim.wellSealedReturn'
  | 'sim.reviveBeforeExtract'
  | 'sim.waitAtExit'
  | 'sim.contaminationRising'
  | 'sim.coreDropped'
  | 'sim.arenaSealed'
  | 'sim.siegeCollapsed';

export type PlayerCommand = {
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  ability: boolean;
  dodge: boolean;
  interact: boolean;
  purge: boolean;
  choose: 0 | 1 | null;
};

export type SurvivalState = {
  config: Required<RunConfig>;
  rng: RNG;
  tick: number;
  phase: RunPhase;
  /**
   * Setor atual da descida, de 1 a SECTOR_COUNT.
   *
   * Nos setores anteriores ao ultimo, `corePos` marca o POCO de descida e nao
   * ha Guardiao nem nucleo; alcanca-lo troca o mundo inteiro por um novo em vez
   * de terminar a run. E a mesma posicao reaproveitada de proposito: o worldgen
   * ja garante que ela seja alcancavel a partir da entrada, que e exatamente a
   * garantia que o poco precisa. Gerar um segundo ponto especial exigiria
   * repetir essa prova para ele.
   */
  sector: number;
  /** Tick em que o setor atual comecou; o cronometro da run continua global. */
  sectorStartedAt: number;
  /**
   * O bioma do setor atual: estrato geologico + ocupacao + linhagem da run.
   *
   * DERIVADO da seed (ver strata.ts), entao nao entra no hash autoritativo nem
   * viaja em snapshot: qualquer maquina que conheca a seed e o setor chega ao
   * mesmo bioma. Vive no estado porque o cliente desenha com ele (paleta,
   * anuncio do setor) e a simulacao compoe a fauna a partir dele — recalcular
   * a cada uso espalharia a derivacao por todo consumidor.
   */
  stratum: StratumId;
  occupation: OccupationId;
  lineage: LineageId;
  solid: Uint8Array;
  surface: Uint8Array;
  surfaceTimer: Uint16Array;
  chunkVersion: Uint32Array;
  entry: Vec2;
  corePos: Vec2;
  coreTaken: boolean;
  /**
   * O estado VIVO do encontro de chefe deste setor. Ver `BossRuntime`.
   *
   * Um objeto e nao seis campos soltos com prefixo `guardian*`: desde
   * `bossForBiome` a camara final pode ser do Bispo, do Diamandis ou de quem
   * mais entrar na tabela, e um campo chamado `guardianPath` sendo consumido
   * por um Bispo e a documentacao mentindo em silencio.
   */
  bossRuntime: BossRuntime;
  /**
   * Rota atual do guardiao, em indices de celula, e o tick em que foi calculada.
   *
   * Vive no estado e nao na entidade porque e DERIVADO: da para recalcular a
   * qualquer momento a partir da grade, entao nao entra no hash autoritativo nem
   * precisa viajar num snapshot. O cliente so desenha; quem persegue e o
   * servidor.
   */
  /**
   * MASCARA DE BITS dos setores cujo chefe ja caiu (bit N = setor N).
   *
   * Existe por causa da extracao de retorno: o mundo do setor e REGENERADO ao
   * subir (mesma seed, fauna repovoada — o Veio nao ficou esperando), e o
   * repovoamento carimbava o chefe de volta na camara. Quem matou o Bispo para
   * descer o encontrava vivo na volta, e o feito mais caro da run desmanchava
   * sozinho. Bicho comum repovoar e pressao; um CHEFE repovoar apaga uma
   * conquista — sao coisas diferentes e so a segunda e um defeito.
   *
   * Mascara e nao um par de booleanos porque a regra e "por setor", nao "por
   * arquetipo": o dia em que um estrato ganhar o proprio chefe, ele entra sem
   * campo novo. Cabe folgado em 32 bits (SECTOR_COUNT e 3).
   */
  bossesDown: number;
  leftEntryZone: boolean;
  players: Entity[];
  playerExtras: PlayerExtra[];
  player: Entity;
  playerExtra: PlayerExtra;
  enemies: Entity[];
  projectiles: Projectile[];
  salvageSites: SalvageSite[];
  /**
   * Ofertas de habilidade ao lado do poco, congeladas na primeira chegada.
   *
   * Vazio ate o jogador chegar perto, e vazio para sempre no setor final — la o
   * ponto e o nucleo do Guardiao, e parar para escolher habilidade no meio da
   * arena seria o pior lugar possivel para um menu.
   */
  wellOffers: WellOffer[];
  vents: Vent[];
  /** Tramos da armadilha de carrinho. Vazio fora da operacao (Aurix/ferric). */
  railTracks: RailTrack[];
  /**
   * Centros dos saloes carimbados pela gramatica espacial do estrato.
   *
   * Informacao de APRESENTACAO, nao de jogo: a simulacao nunca le isto, nao
   * entra no hash autoritativo nem viaja em snapshot — qualquer cliente
   * reconstroi a mesma lista via `createRun`, como faz com o resto do mundo.
   * O consumidor e a camada de decoracao, que ancora os landmarks monumentais
   * no centro dos saloes em vez de num sorteio sem significado.
   */
  hallCenters: Vec2[];
  charges: Array<{ idx: number; until: number }>;
  contamination: number;
  contaminationWaves: number;
  nextEntityId: number;
  reactionQueue: number[];
  stats: RunStats;
  /** Preenchido uma unica vez, no tick em que a run termina. */
  summary: RunSummary | null;
};

export type StepResult = { state: SurvivalState; events: SemanticEvent[] };
export type PlayerSnapshot = {
  slot: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  heat: number;
  hasCore: boolean;
  downed: boolean;
  alive: boolean;
};
export type SurvivalSnapshot = {
  tick: number;
  phase: RunPhase;
  player: { x: number; y: number; hp: number; heat: number; hasCore: boolean };
  players: PlayerSnapshot[];
  enemyCount: number;
  contamination: number;
};
