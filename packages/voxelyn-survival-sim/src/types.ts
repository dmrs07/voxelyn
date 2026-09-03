import type { RNG } from '@voxelyn/core';
import type { LineageId, OccupationId, StratumId } from './strata.js';
import type { PlayerTuning, RunDepthConfig } from './progression.js';

export type Vec2 = { x: number; y: number };

export type RunConfig = {
  seed: number;
  width?: number;
  height?: number;
  playerCount?: number;
  /**
   * Setor em que a run COMECA. Padrao 1.
   *
   * Existe porque a run deixou de ser um mapa e virou varios encadeados, e sem
   * isto nao ha como construir o estado do setor 3 diretamente. Dois
   * consumidores reais dependem disso: um cliente que reconecta no meio de uma
   * run de co-op precisa reconstruir o mundo do setor em que a sala esta, e
   * testar um chefe exigiria dirigir a run inteira ate ele antes de qualquer
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
  /**
   * A PROFUNDIDADE autorizada desta run. Ausente = tres setores, Nucleo no
   * terceiro (o Prospector de fabrica, e toda run gravada antes da expansao).
   *
   * Congelada pelo mesmo motivo e com a mesma forca que `tuning`, e a razao vale
   * ser dita por extenso porque e mais facil de errar: quantos setores a run tem
   * NAO pode ser reconsultado no perfil a cada descida. Se fosse, comprar o
   * decimo segundo protocolo no meio de uma expedicao de G-02 mudaria o setor
   * final, moveria o Nucleo, trocaria o chefe e invalidaria o hash de uma run em
   * andamento — e o jogador veria isso como "o jogo esqueceu onde eu estava".
   *
   * O servidor resolve a geracao no momento de emitir o ticket e congela o
   * resultado aqui. Depois disso o perfil deixa de existir para esta run.
   */
  depth?: RunDepthConfig;
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
  | 'diamandis'
  /**
   * DEVORADOR BRANCO: o chefe dos Sumidouros de Silica. Mergulha, deixa faixa
   * de silica solta por onde passa, preve onde o jogador vai estar e emerge
   * dali. Nao ha o que perseguir — o que se decide contra ele e ONDE ele pode
   * sair, e a resposta e vitrificar o chao com calor.
   */
  | 'white_devourer'
  /**
   * NINHADA DO DEVORADOR: os filhotes, e o unico corpo do bestiario que NAO e
   * uma ameaca.
   *
   * `contactDamage` zero, um ponto de vida, sem acao nenhuma no repertorio:
   * eles nao mordem, nao perseguem e nao podem ser perigosos nem por acidente.
   * O que eles fazem e existir aos montes em volta da mae e morrer com um passo.
   *
   * A razao de estarem na simulacao e nao no cliente e uma so, e ela e de
   * mecanica: eles sao MATERIA no disco da boca. A sucao ja arrasta todo corpo
   * que nao seja chefe, entao a ninhada e arrastada e devorada junto com o
   * jogador — e ver dez filhotes desaparecendo garganta abaixo ensina o raio da
   * coisa melhor que qualquer anel desenhado no chao. Feitos de enfeite no
   * cliente, eles atravessariam o vortice como se ele nao existisse.
   */
  | 'devourer_brood'
  /**
   * Os seis chefes de estrato. Cada um opera, em escala de chefe, a alavanca
   * que a propria geologia ja tem: cristal que descarrega, agua que conduz,
   * gas que ocupa espaco, brasa que aquece, gelo que derrete, minerio que
   * atrai. Ver constants.ts, secao "OS CHEFES DE ESTRATO".
   */
  | 'archcantor'
  | 'sheet_leviathan'
  | 'lung_matrix'
  | 'furnace_heart'
  | 'frost_queen'
  | 'magnetarch';
export type ModuleId =
  | 'piercing'
  | 'conductive'
  | 'explosive'
  | 'siphon'
  | 'ricochet'
  | 'return_disc'
  /**
   * MINIGUN: o canhao rotativo. Unico modulo que nao MODIFICA o tiro — ele
   * TROCA o tiro. Ver `modules.ts` para a matriz de compatibilidade e
   * `constants.ts`, secao "MINIGUN", para os numeros.
   */
  | 'minigun';
/**
 * `weapon` marca o modulo que OCUPA o disparo principal em vez de modifica-lo.
 *
 * Existe porque a diferenca e de categoria e nao de grau: dois modulos com a
 * marca disputam o mesmo gatilho, e quem decide qual vence precisa de um
 * predicado, nao de uma lista de ids espalhada por tres arquivos.
 */
export type ModuleTag = 'projectile' | 'utility' | 'volatile' | 'defensive' | 'safe' | 'weapon';

/**
 * As cinco fases do canhao rotativo. Estado nomeado, e nao tres booleanos.
 *
 * A diferenca importa: com booleanos soltos ("girando", "atirando",
 * "travado") existem combinacoes que a arma nao tem — girando e travado ao
 * mesmo tempo, atirando sem girar — e todo leitor precisa saber de cor quais
 * sao impossiveis. Aqui o conjunto de estados E o contrato, e o cliente pinta
 * cada um deles sem inferir nada.
 */
export type MinigunPhase = 'idle' | 'spinning_up' | 'firing' | 'spinning_down' | 'overheated';

/**
 * O estado autoritativo do canhao rotativo de um slot.
 *
 * Vive no `PlayerExtra` e nao no `ActiveModule` porque ele sobrevive ao
 * modulo: quando a bala 300 sai, o cartucho e ejetado, mas os canos ainda
 * estao girando e precisam DESACELERAR na tela e no ouvido. Um estado que
 * morresse junto com o modulo cortaria a rotacao no meio.
 *
 * Ambos os campos sao INTEIROS em milesimos. Ver `constants.ts`.
 */
export type MinigunState = {
  /** Rotacao atual, 0..MINIGUN_SPIN_MAX. */
  spin: number;
  /** Fracao de tiro acumulada, 0..999. E o que torna a cadencia independente de quadro. */
  fireAccum: number;
  phase: MinigunPhase;
  /** Quantos tiros sairam na janela do `minigun_burst` ainda nao publicada. */
  pendingRounds: number;
};
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
  | {
      kind: 'enemy_projectile';
      archetype: EnemyArchetype;
      elite: boolean;
      projectile: ProjectileKind;
    }
  | { kind: 'fire' }
  | { kind: 'gas' }
  | { kind: 'spores' }
  /**
   * Saturacao: o ar do setor inteiro, cobrando permanencia.
   *
   * Tem causa propria em vez de reaproveitar `gas` porque a licao da tela de
   * morte e outra. `gas` significa "voce pisou numa nuvem" e ensina a desviar;
   * esta significa "voce ficou tempo demais" e ensina a sair. Duas mortes
   * diferentes que dessem a mesma frase apagariam a unica coisa que a tela de
   * morte tem para fazer.
   */
  | { kind: 'contamination' }
  | { kind: 'discharge'; source: EffectOrigin['source'] }
  | { kind: 'leviathan_discharge' }
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
   * escolha de modulo com isso — e SO isso. O minerio nao entra na pontuacao da
   * run (ver `compareRunScore`) nem sequer como desempate: enquanto entrava, era
   * uma pergunta que o placar fazia e o briefing nao. Uma cota obrigatoria
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
 * VITRIFICOU silica solta — transformou o rastro do Devorador em vidro.
 *
 * O bit nao exige ter entendido para que serve: exige ter FEITO. E a ordem
 * certa, porque a compreensao vem de ver o verme falhar em subir ali depois.
 */
export const DISCOVERY_SILICA_VITRIFIED = 1 << 18;

/**
 * As seis Descobertas dos chefes de estrato.
 *
 * Cada uma marca o instante em que o jogador ENTENDE a alavanca daquele bioma
 * — nao "matou o chefe", e sim "descobriu por que ele e daquele lugar". Sao os
 * bits que destravam o miolo do arco documental de cada um, e a razao de eles
 * nao serem marcos de abate e a mesma de sempre: um chefe aparece uma vez por
 * run, e uma grade de repeticao transformaria a revelacao em farm.
 */
/** Bateu no Arquicantor com a Catedral em silencio: a rede vazia o expoe. */
export const DISCOVERY_CATHEDRAL_SILENCED = 1 << 19;
/** Atordoou o Leviata eletrificando a lamina em que ele nada. */
export const DISCOVERY_LEVIATHAN_SHOCKED = 1 << 20;
/** Acendeu a expiracao do Pulmao-Matriz e queimou a coluna de volta. */
export const DISCOVERY_LUNG_IGNITED = 1 << 21;
/** Acertou o Coracao da Fornalha na janela fria — a unica em que ele abre. */
export const DISCOVERY_FURNACE_COOLED = 1 << 22;
/** Derreteu o lago da Rainha e bateu nela sem a couraça do estrato. */
export const DISCOVERY_QUEEN_THAWED = 1 << 23;
/** Ficou na FAIXA do Magnetarca: dentro do campo e fora das duas bordas. */
export const DISCOVERY_MAGNET_BANDED = 1 << 24;
/**
 * Uma descarga ATRAVESSOU uma juncao roteada. Marcada no rele efetivo — quando
 * a energia sai do outro lado — e nao no toggle: apertar o botao nao ensina
 * nada; ver a corrente continuar por um caminho que VOCE abriu, sim.
 */
export const DISCOVERY_LEYLINE_ROUTED = 1 << 25;
/**
 * O CIRCUITO fechou: uma unica cascata acendeu a rede inteira do setor, e a
 * propriedade que da identidade ao estrato parou de valer.
 *
 * Distinta de `DISCOVERY_LEYLINE_ROUTED` porque ensinam coisas diferentes: o
 * rele ensina que a corrente atravessa uma juncao aberta, o circuito ensina
 * que a rede inteira e um objetivo. Quem fecha um circuito ja marcou o rele no
 * caminho; o contrario nunca acontece.
 */
export const DISCOVERY_LEYLINE_CIRCUIT = 1 << 26;

/**
 * Todo bit de descoberta que existe, num numero so.
 *
 * Existe porque a lista cresce e quem consome ela de fora nao percebe. A
 * telemetria do servidor prendia `discoveries` em `0xffff` — um teto escrito
 * quando havia dezesseis bits — e a partir do bit 16 toda run com uma
 * descoberta de chefe era GRAVADA COMO 65535: o bit real se perdia e todos os
 * bits abaixo dele apareciam ligados, fabricando dezesseis descobertas que
 * nunca aconteceram. O defeito nao dava erro em lugar nenhum; so envenenava a
 * analise.
 *
 * Prender por faixa era o erro de fundo, e nao o numero: um valor acima do teto
 * SATURA, e saturar uma bitmask inventa bits. Quem recebe isto de fora deve
 * MASCARAR (`& DISCOVERY_MASK`), que descarta o que nao reconhece em vez de
 * mentir sobre o que reconhece.
 *
 * O teste `descobertas.test.ts` confere que todo `DISCOVERY_*` exportado cabe
 * aqui dentro — e o que faz o bit novo nascer coberto em vez de nascer perdido.
 */
export const DISCOVERY_MASK = (1 << 27) - 1;

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
  /**
   * Nucleos que sairam do Veio com o time. 0..2 hoje.
   *
   * A liquidacao credita a partir daqui — e daqui SO no servidor, depois de
   * re-simular o log. Uma run de G-03 ou G-04 pode terminar com zero, com o
   * Nucleo intermediario, com o final, ou com os dois; a recompensa segue o
   * que a re-simulacao produziu, nunca o que o cliente afirmou.
   */
  cores: number;
  /**
   * Nucleos que esta run TINHA para dar — o denominador da terceira estrela.
   *
   * Congelado junto do resto porque a run congelou a propria profundidade: uma
   * descida de G-01 vale "1 de 1" para sempre, mesmo lida por um perfil que
   * hoje esta em G-04 e enxergaria dois.
   */
  coresAvailable: number;
  /** A profundidade que esta run atravessou. Contexto para a tela de fim. */
  sectorCount: number;
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
  /** Emergencia do Devorador: o chao racha no ponto marcado, e entao ele sobe. */
  | 'erupt'
  /**
   * O ARCO do Devorador, da decolagem ate a queda.
   *
   * Nao tem `release`: nenhum ramo de `releaseAction` responde por ela. Ela
   * existe para dois trabalhos, e os dois sao de tempo. Na simulacao, e o que
   * poe o voo no ramo em que a ACAO conduz o corpo passo a passo (o mesmo do
   * Corcel e da broca), em vez de no fluxo de IA. No cliente, `startedAt` e
   * `releaseAt` dao o vao do voo — e so com ele da para desenhar a parabola,
   * porque a ALTURA nao existe na simulacao e nao viaja no snapshot.
   */
  | 'leap'
  /** Congelamento da Rainha: o lago se refaz e os Espectros saem dele. */
  | 'freeze'
  /** Carga global do Leviata; as bolhas de ar sao o contra-jogo. */
  | 'massive_shock'
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
 * O MINIMO que o setor precisa saber sobre o proprio chefe.
 *
 * Tres campos, e nenhum deles e de nenhum chefe em particular. E a fronteira
 * que o portal e o pedestal consultam: eles perguntam "ha dono aqui?" e "ele ja
 * caiu?", e nunca "e o Bispo?". Enquanto perguntavam por arquetipo, cada chefe
 * novo tinha de ser lembrado em dois lugares distantes do arquivo em que ele
 * foi escrito — e nao foi.
 *
 * `archetype` nulo significa "setor sem chefe" e nao "chefe ainda nao nasceu":
 * a resolucao e deterministica e acontece na entrada do setor. Um setor sem
 * dono nunca bloqueia nada.
 */
export type SectorBossState = {
  /** O corpo que guarda este setor, ou `null` quando ninguem guarda. */
  archetype: EnemyArchetype | null;
  /** A entidade viva em campo. `null` depois da morte ou antes do spawn. */
  entityId: number | null;
  /** Ja caiu NESTA RUN. Sobrevive a regeneracao do setor na subida. */
  defeated: boolean;
};

/**
 * O estado vivo do encontro de chefe do setor.
 *
 * Existia como seis campos soltos no estado, todos com prefixo `guardian`,
 * porque durante muito tempo so havia um chefe com estado proprio. Com
 * `bossForBiome` a camara final passou a poder ser de qualquer um da tabela —
 * e `state.guardianPath` sendo consumido pelo Bispo era um nome mentindo.
 *
 * Um objeto so, e nao um por chefe: a run pode ter dois encontros de chefe
 * (G-03 e G-04), mas nunca DOIS AO MESMO TEMPO — um setor tem um dono, e trocar
 * de setor reinicia o encontro. O runtime e do setor atual, e e por isso que
 * `descend`/`ascend` o zeram.
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
   * O TETO CEDENDO: celulas marcadas para receber uma estalactite, com o tick
   * da queda.
   *
   * Par (celula, quando) e nao duas listas paralelas: as estalactites caem em
   * levas sobrepostas — uma marcada agora convive com uma prestes a cair — e
   * duas listas que precisam ficar alinhadas por indice sao a forma mais facil
   * de desalinhar. Entra no hash: duas simulacoes que discordem de onde o teto
   * vai ceder divergem um segundo depois, e no lugar errado.
   */
  collapseCells: Array<{ idx: number; at: number }>;
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
  /**
   * Onde o salto do Devorador vai CAIR, escolhido na decolagem.
   *
   * Vive aqui e nao na acao pelo mesmo motivo das cargas de demolicao: o alvo
   * nao pode se corrigir no meio do voo. Sair de baixo da queda e a resposta
   * inteira do golpe, e ela so existe se o ponto ficar onde nasceu — um arco
   * que persegue seria dano sem contra-jogo.
   *
   * Entra no hash: duas simulacoes que discordem de onde ele cai divergem na
   * cratera, no dano e na posicao do chefe pelo resto da luta.
   */
  leapToX: number;
  leapToY: number;
  /**
   * Saltos que faltam na rajada atual do Devorador.
   *
   * O ciclo dele e uma RAJADA e nao um golpe: tres arcos mirados em sequencia e
   * so entao a janela. Zero (ou menos) significa "comece uma rajada nova" — a
   * contagem se recompoe sozinha em vez de depender de quem inicializou o
   * chefe, que e o que evita um Devorador nascido pelo caminho errado ir direto
   * para a janela sem nunca ter atacado.
   */
  leapsLeft: number;
  /**
   * O tick em que a BOCA do Devorador abriu. -1 = nunca abriu nesta camara.
   *
   * Um numero e nao um booleano porque a boca nao esta so aberta ou fechada:
   * ela CRESCE. O alcance da sucao sai deste instante (ver
   * DEVOURER_MAW_SPOOL_TICKS), e sao o alcance e o instante juntos que decidem
   * quem esta sendo puxado e quanta areia ja foi engolida.
   *
   * Entra no hash pela mesma razao que `delugeAt`: ele decide dano e posicao de
   * todo corpo dentro do disco, e duas simulacoes que discordassem de um tick
   * continuariam parecendo iguais no comeco da janela e divergiriam segundos
   * depois — com um jogador na garganta de um lado e a tres tiles dela do
   * outro.
   *
   * Viaja em `WorldFlags` pela mesma razao que `delugeAt` viaja: quem reconecta
   * no meio da janela nunca recebeu a transicao, e sem este numero desenharia
   * um chefe entalado e inofensivo enquanto o servidor o arrasta para dentro.
   * Dano sem sinal e o unico invariante de combate que este projeto nao quebra.
   */
  mawOpenedAt: number;
  /**
   * O DILUVIO: o tick em que a lamina comecou a subir, e de onde.
   *
   * `delugeAt < 0` significa "nunca aconteceu". Tres numeros, e nao uma camada
   * de celulas, e essa e a decisao de desenho inteira: o Diluvio cobre TODO o
   * setor, entao "esta submerso?" nao precisa de mapa — precisa de um centro,
   * um instante e a regra (ver `isDeluged`). Uma quarta camada de mundo teria
   * de entrar no diff de chunks, engordar toda celula alterada do jogo e ainda
   * assim diria menos do que estes tres campos dizem.
   *
   * Entram no hash: eles decidem por onde o chefe anda, onde ele emerge e
   * quanto uma descarga cobra. Duas simulacoes que discordem do instante da
   * subida divergem em tudo o que vem depois dela.
   */
  delugeAt: number;
  delugeX: number;
  delugeY: number;
  leviathanShockAt: number;
  leviathanShockRecoverAt: number;
  leviathanShockSeq: number;
  protectiveBubbles: Array<{ x: number; y: number; radius: number }>;
  /**
   * Os dois estados de blindagem que so existiam DENTRO do funil de dano e
   * que a apresentacao precisa ver como TRANSICAO (`boss_vulnerable`).
   *
   * A couraça da Rainha e a rede do Arquicantor sao recomputadas da grade a
   * cada golpe; para dizer "a armadura quebrou" e "a Catedral calou" e preciso
   * lembrar o que se viu no tick anterior. Nao entram no hash nem no wire: sao
   * memoria de apresentacao, e o cliente que reconecta ouve a proxima
   * transicao — o estado em si ele ja ve na grade.
   *
   * `frostArmored` e tri-estado: -1 ainda nao medido (a primeira leitura nao
   * e uma transicao), 0 sem couraça, 1 com.
   */
  frostArmored: number;
  archcantorSilent: boolean;
};

/**
 * As habilidades de chefe que os eventos `boss_windup`/`boss_attack` nomeiam.
 *
 * Uma lista chata de proposito: cada nome e uma coisa que o JOGADOR precisa
 * distinguir de ouvido, e nao uma acao interna. A broca e a demolicao do
 * Diamandis pedem respostas opostas (recuar da linha, sair das marcas), entao
 * sao dois nomes; a decolagem e a emergencia do Devorador sao a mesma
 * ameaca ("o chao onde voce esta"), entao sao um.
 */
export type BossAbility =
  // Guardiao: pedra e massa.
  | 'salvo'
  | 'slam'
  | 'charge'
  | 'contact'
  // Bispo.
  | 'nova'
  // Diamandis: ferramentas.
  | 'drill'
  | 'demolish'
  | 'beam'
  // Devorador Branco.
  | 'erupt'
  | 'maw'
  // Arquicantor.
  | 'song'
  // Leviata do Lencol.
  | 'breach'
  | 'deluge'
  | 'massive_shock'
  // Coracao da Fornalha.
  | 'wave'
  // Rainha da Geada.
  | 'freeze'
  // Magnetarca.
  | 'crush'
  | 'tether';

/**
 * Os momentos de ESTADO/PRESENCA de chefe (`boss_state`): nem preparacao nem
 * execucao — o corpo fazendo o que o corpo faz, e o mundo mudando por causa
 * disso. E o que deixa o audio localizar o que nao esta na tela (o Devorador
 * cavando, o Leviata chamando de longe) e ler o relogio da luta (a
 * respiracao do Pulmao, a polaridade do Magnetarca).
 */
export type BossMoment =
  // Guardiao: um passo pesado; a estrutura cedendo na fase final; a lasca ao
  // levar dano (ele nao geme — desloca massa).
  | 'step'
  | 'strain'
  | 'chip'
  // Devorador: deslocamento sob a silica; a boca abrindo e fechando.
  | 'burrow'
  | 'maw_open'
  | 'maw_close'
  // Leviata: o chamado de presenca; a recuperacao depois da descarga.
  | 'call'
  | 'recover'
  // Pulmao-Matriz: as fases do ciclo e o ferimento (fole perfurado).
  | 'inhale'
  | 'hold'
  | 'exhale'
  | 'wound'
  // Rainha da Geada: os Espectros saindo do gelo; o tiro absorvido pela couraça.
  | 'wraiths'
  | 'armor_hit'
  // Magnetarca: a polaridade que acabou de valer.
  | 'attract'
  | 'repel'
  // Arquicantor: a nota isolada do idle; uma camada de cristal respondendo.
  | 'idle_note'
  | 'resonance';

/** A matilha da segunda fase do Guardiao. Antes: `guardianSummoned`. */
export const BOSS_PHASE_SUMMON = 1 << 0;
/** O colapso do reator do Diamandis, abaixo de metade da vida. */
export const BOSS_PHASE_REACTOR = 1 << 1;
/**
 * COLAPSO TERMICO do Coracao da Fornalha (45% de vida). O teto comeca a ceder.
 *
 * Nao confundir com a mood `FURNACE_OVERHEATING`: aquela e a janela de
 * blindagem, que gira o encontro inteiro; esta e uma escada de dano acumulado,
 * disparada uma vez e sem volta.
 */
export const BOSS_PHASE_OVERHEAT = 1 << 2;
/** INSTABILIDADE do Coracao (10% de vida). Ciclones de fogo atravessam a sala. */
export const BOSS_PHASE_UNSTABLE = 1 << 3;
/**
 * O DILUVIO do Leviata do Lencol. Uma vez por encontro, e sem volta.
 *
 * O resto das fases desta lista aumenta a pressao; esta muda o MAPA. Ver
 * `isDeluged` e a nota do Diluvio em constants.ts.
 */
export const BOSS_PHASE_DELUGE = 1 << 4;

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

/**
 * Postura do Devorador Branco: por baixo da silica ou exposto na superficie.
 * Viaja no snapshot porque o cliente desenha coisas completamente diferentes —
 * submerso ele e uma ondulacao na areia, e nao um corpo.
 */
export const DEVOURER_BURROWED = 0;
export const DEVOURER_SURFACED = 1;
/**
 * NO AR: entre a decolagem e a queda do salto.
 *
 * E uma postura e nao um detalhe de animacao porque ela decide DANO. Submerso a
 * areia absorve 88% do tiro; no ar nao ha areia entre a bala e o corpo, e o
 * dano entra inteiro — a mesma regra do `SURFACED`, por um motivo diferente. O
 * cliente tambem depende dela: e o unico momento em que o corpo e desenhado
 * ACIMA do chao, com sombra propria embaixo.
 */
export const DEVOURER_AIRBORNE = 2;
/**
 * A BOCA ABERTA: aberto no proprio buraco, no fim da rajada de saltos.
 *
 * E a janela de dano do encontro inteiro, e por isso e um humor e nao um
 * cooldown invisivel: ele nao anda e nao tem areia absorvendo tiro. O cliente
 * troca a silhueta por causa dele — a pose `downed` do atlas e uma cratera
 * dentada rente ao chao, com as placas da frente descascadas para fora, a carne
 * a mostra e um vao escuro no meio, espasmando em seis quadros.
 *
 * Chamava-se `DEVOURER_STUCK`, "entalado", e o nome era honesto sobre o que a
 * janela era: um alvo imovel e inofensivo, uma TORRE. Ele continua imovel — o
 * que mudou nao e o corpo, e o que o corpo faz parado. Enquanto a boca esta
 * aberta ela puxa o setor para dentro de si, e quem chega na garganta e
 * devorado (ver DEVOURER_MAW_*). O humor precisa dizer isso porque e ele que o
 * cliente le para desenhar o vortice: submerso, no ar e com a boca aberta sao
 * tres desenhos sem nada em comum.
 *
 * O nome nao e `SURFACED` de proposito: aquele humor continua existindo e e do
 * LEVIATA, que emerge para perseguir. Os dois ficariam com o mesmo numero e
 * significados opostos — um caçando, o outro comendo de onde esta.
 */
export const DEVOURER_MAW = 3;

/**
 * Posturas dos chefes de estrato que ALTERNAM, e por que elas viajam.
 *
 * Em todos os tres a postura decide se o dano entra — e o cliente precisa
 * desenhar a diferenca no MESMO tick em que ela vale, senao o jogador gasta a
 * janela inteira sem saber que ela abriu.
 */
/** Pulmao-Matriz: puxando o gas para dentro, ou soprando a coluna. */
export const LUNG_INHALING = 0;
export const LUNG_EXHALING = 1;
/** Coracao da Fornalha: blindado e acendendo a sala, ou frio e aberto. */
export const FURNACE_OVERHEATING = 0;
export const FURNACE_COOLING = 1;
/** Magnetarca: atraindo (perto machuca) ou repelindo (longe machuca). */
export const MAGNET_ATTRACT = 0;
export const MAGNET_REPEL = 1;

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
  /**
   * O canhao rotativo deste slot. Existe SEMPRE, mesmo sem o modulo instalado
   * — em `idle`, com rotacao zero.
   *
   * Alocar sob demanda pareceria mais economico e seria pior: o estado entra
   * no hash autoritativo, e um campo que ora existe ora nao obrigaria o hash a
   * ramificar (e um `undefined` do lado do servidor a valer o mesmo que um
   * `spin: 0` do lado do cliente, o que e exatamente o tipo de acordo tacito
   * que diverge). Quatro numeros por slot custam nada.
   */
  minigun: MinigunState;
  /**
   * Carrega ao menos um Nucleo? DERIVADO de `carriedCoreMask`, mantido em par
   * com ele nos quatro pontos que escrevem a carga.
   *
   * Continua booleano porque e o que atravessa o wire, o que a extracao
   * pergunta e o que o HUD desenha — nenhum dos tres quer saber QUAIS. Quem
   * quer saber quais e a devolucao ao mundo quando o portador morre, e essa le
   * a mascara.
   */
  hasCore: boolean;
  /**
   * MASCARA dos setores cujos Nucleos este jogador carrega (bit N = setor N).
   *
   * Existe porque uma run de G-03 ou G-04 tem dois Nucleos, e quando o portador
   * cai eles precisam voltar aos PEDESTAIS DELES. Um contador diria "dois
   * caíram" e nao diria de onde; a run seguinte reabriria o pedestal errado, ou
   * pior, reabriria os dois e deixaria o parceiro coletar quatro.
   */
  carriedCoreMask: number;
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
export type ProjectileKind =
  | 'bolt'
  | 'spit'
  | 'rock'
  | 'return_disc'
  | 'seeker'
  | 'cart'
  /**
   * FLECHETTE: a bala da Minigun.
   *
   * Tipo proprio e nao um `bolt` menor porque o cliente decide FORMA pelo
   * `kind`: um bolt em escala reduzida ainda desenharia o estilhaco de dois
   * voxels com rastro de energia, e dezesseis deles por segundo viram uma
   * mancha. A flechette e um tracante fino — corpo minusculo, risco longo —,
   * que e o que mantem a leitura de "para onde esta indo aquele muro de
   * balas" num calibre que quase nao ocupa pixel.
   */
  | 'flechette'
  /**
   * CICLONE DE FOGO: a instabilidade do Coracao da Fornalha andando pela sala.
   *
   * Projetil e nao entidade porque ele nao decide nada — nao persegue, nao mira
   * e nao morre no impacto. Ele atravessa, acende o que encosta e some. Como
   * projetil, ganha de graca o movimento, a colisao com parede, o hash e o
   * snapshot; como inimigo, teria uma IA vazia e um lugar na contagem de
   * abates que ele nao merece.
   */
  | 'cyclone';

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
  /**
   * Proximo tick em que este projetil pode cobrar de novo. So o ciclone usa.
   *
   * Um relogio POR PROJETIL e nao por par (projetil, corpo): quem esta dentro
   * do funil esta no mesmo problema, e o encontro nao fica mais barato por
   * serem dois Prospectors. Entra no hash junto com o resto do projetil.
   */
  nextTouchAt?: number;
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

/**
 * Um SEGMENTO de leyline: o trecho de condutor entre duas juncoes.
 *
 * A materia e permanente e vive no grid (`SOLID_LEYLINE`), entao ela chega ao
 * cliente pelo diff de chunk e sobrevive a resync como qualquer parede. O que
 * este tipo guarda e a FASE do segmento — os relogios do ciclo dormente →
 * carregando → descarga → refrataria. Eles decidem dano, e por isso ENTRAM no
 * hash autoritativo (diferente dos `railTimers`, que so telegrafam): duas
 * simulacoes discordando de `dischargeAt` divergiriam em vida um segundo
 * depois, longe da causa.
 *
 * `cells` e geometria derivada da seed (como `hallCenters`): reconstruida nas
 * duas pontas pelo worldgen, nao viaja no wire nem entra no hash.
 */
export type LeylineSegment = {
  cells: number[];
  /** Tick da descarga anunciada; 0 = nao esta carregando. */
  dischargeAt: number;
  /** Ate quando o segmento ignora novas ativacoes; 0 = pronto. */
  refractoryUntil: number;
  /**
   * ID da ENTIDADE do jogador que ativou (-1 = ambiente): decide o `source`
   * do discharge — e, com ele, o desconto de fogo amigo e o credito de
   * ressonancia. E id e nao slot porque e o que `recordPlayerResonance` casa.
   */
  triggeredBy: number;
  /**
   * Esta carga foi armada por RELE (juncao roteada), nao por tiro. Decide se
   * o discharge futuro credita ressonancia — a cascata inteira e UMA decisao
   * do jogador, entao so a ativacao original conta — e por decidir credito
   * ENTRA no hash como os relogios.
   */
  relayed: boolean;
};

/**
 * Uma JUNCAO de leyline e os segmentos que ela articula.
 *
 * `cell` e `segments` sao geometria derivada da seed (a adjacencia e por
 * proximidade — Chebyshev <= 2 — ver `deriveLeylineNodes`): ficam fora do hash
 * e do wire, como as celulas dos segmentos. So `routed` e autoritativo — ele
 * decide se uma descarga atravessa, portanto decide dano, portanto hasheia e
 * viaja (`WorldFlags.leylineRouting`).
 */
export type LeylineNode = {
  cell: number;
  /** Indices em `leylineSegments` dos segmentos que tocam esta juncao. */
  segments: number[];
  /** O jogador abriu o rele: descargas adjacentes atravessam. */
  routed: boolean;
};

/**
 * O CIRCUITO do setor: a rede de leyline vista como um problema, e nao como
 * decoracao.
 *
 * A pergunta que ele responde e "o que a leyline PEDE do jogador". Fechar o
 * circuito e fazer uma UNICA cascata acender todos os segmentos de `members`,
 * o que obriga a percorrer a rede inteira roteando cada juncao e a consertar
 * os segmentos em curto antes de lancar.
 *
 * Por que a rede inteira, e nao um caminho da nascente ate uma ponta funda:
 * porque a topologia medida nao comporta um caminho. Em 637 setores com rede,
 * 71,6% dos circuitos separavam as duas pontas por UMA juncao (mediana 1 em
 * todos os sete estratos), e o rele arma TODOS os vizinhos dormentes — entao
 * "rotear tudo" sempre venceu e escolher rota nunca foi decisao. Exigir a rede
 * toda transforma o mesmo grafo raso num objetivo de escala do setor.
 *
 * `sourceNode` e `members` sao geometria derivada da seed (como `cells` e
 * `hallCenters`): ficam fora do hash e do wire. `reached`, `live` e `closed`
 * decidem o mundo — `closed` desliga a propriedade do estrato — e por isso
 * hasheiam.
 */
export type LeylineCircuit = {
  /**
   * Indice em `leylineNodes` da NASCENTE: a juncao do componente por onde o
   * jogador lanca a cascata. -1 quando a rede nao comporta circuito (nenhum
   * componente com dois segmentos) — 18,8% dos setores com leyline, medido.
   *
   * A nascente nasce `routed` e o interact nela LANCA em vez de togglar: ela e
   * a ponta, e um verbo por tecla vale mais do que economizar um no.
   */
  sourceNode: number;
  /** Segmentos que precisam acender na mesma cascata. Vazio sem circuito. */
  members: number[];
  /** Segmentos ja acesos pela cascata em curso, em ordem crescente. */
  reached: number[];
  /** Ha cascata em curso lancada pela nascente. */
  live: boolean;
  /** O circuito fechou neste setor: a subversao do estrato esta valendo. */
  closed: boolean;
};

export type SemanticEvent =
  | {
      t: 'action_start';
      entity: number;
      action: EntityActionKind;
      /**
       * Quem esta agindo. Opcional por defesa (fixtures montam o evento a
       * mao); a simulacao sempre o preenche. Existe para o audio calar o
       * telegrafo GENERICO quando o ator e um chefe com assinatura propria —
       * o `boss_windup` que sai no mesmo tick e quem fala por ele.
       */
      archetype?: EnemyArchetype;
      x: number;
      y: number;
      dx: number;
      dy: number;
      startTick: number;
      releaseTick: number;
      endTick: number;
    }
  /**
   * Uma acao telegrafada morreu ANTES do `endTick` anunciado. Existe para o
   * sopro canalizado: `action_start` promete uma pose de 2,5 s, e um canal
   * cancelado (stun, queda, troca no poco) deixaria o cliente segurando a pose
   * — e retomando-a apos o revive — sem chama nenhuma saindo. O fim natural
   * NAO emite isto: ele coincide com o `endTick` que o cliente ja conhece.
   */
  | { t: 'action_end'; entity: number }
  /**
   * `hazard` marca dano POR TICK do chao cobrando presenca (gas, esporo, fogo
   * sob os pes — os tres ramos de `applyCellHazards`). O audio precisa da
   * distincao para nao tocar o impacto pleno a 20 Hz dentro de uma nuvem.
   *
   * E um flag do CALL SITE, nao da causa, de proposito: a varredura do
   * Coracao da Fornalha tambem fere com `{kind:'fire'}`, mas e uma pancada de
   * chefe e NAO marca — inferir da causa no cliente foi exatamente o erro que
   * este campo corrige. Opcional por defesa (fixtures e eventos construidos a
   * mao nao o carregam); a interoperabilidade real e garantida pelo handshake.
   */
  | { t: 'hit'; x: number; y: number; amount: number; target: number; hazard?: true }
  | {
      t: 'death';
      x: number;
      y: number;
      entity: number;
      archetype: string;
      facingX: number;
      facingY: number;
      tick: number;
    }
  | {
      t: 'explosion';
      x: number;
      y: number;
      radius: number;
      source: 'player' | 'enemy' | 'environment';
      owner?: number;
    }
  | {
      t: 'leviathan_discharge';
      x: number;
      y: number;
      radius: number;
      bubbles: Array<{ x: number; y: number; radius: number }>;
    }
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
  /**
   * `fromX`/`fromY` sao o PONTO em que a corrente entrou no condutor, quando ha
   * um so. Ausentes nas descargas de fonte multipla (o canto do Arquicantor arma
   * dezenas de cristais, e cada um e uma fonte) — e sem eles o dano continua
   * plano, que e o que essas sempre fizeram. Com eles, a corrente atenua com a
   * distancia: ver DELUGE_SHOCK_FULL_RANGE.
   */
  | {
      t: 'discharge';
      cells: number[];
      source: 'player' | 'enemy' | 'environment';
      owner?: number;
      fromX?: number;
      fromY?: number;
      /**
       * A descarga veio de um segmento armado por RELE. Mantem autoria (dano,
       * stun, fogo amigo continuam do dono) mas nao credita ressonancia de
       * novo: a cascata inteira e uma ativacao so.
       */
      relayed?: boolean;
    }
  /**
   * Um segmento de leyline foi energizado e VAI descarregar em `dischargeTick`.
   * E o sinal previo obrigatorio: o dano so existe porque este aviso chegou
   * antes (LEYLINE_CHARGE_TICKS de folga). Carrega as celulas porque o cliente
   * precisa acender o trecho exato — reconstruir o segmento pela grade exigiria
   * conhecer as juncoes, que sao informacao do worldgen.
   */
  | { t: 'leyline_charge'; seg: number; cells: number[]; dischargeTick: number }
  /**
   * Um jogador ROTEOU (ou fechou) uma juncao. Carrega a posicao porque cue e
   * particula nao devem precisar do grid para achar o no; `routed` e o estado
   * NOVO, para o feedback dizer o que aconteceu e nao o que havia.
   */
  | { t: 'leyline_routed'; node: number; x: number; y: number; routed: boolean; slot: number }
  /**
   * Um segmento recusou a ativacao por estar em CURTO — cristal e minerio
   * encostados nele sangram a carga (ver `leylineSegmentShorted`).
   *
   * Existe porque um obstaculo que nao se anuncia e um bug para quem joga: sem
   * ele, lancar o circuito num setor com um segmento sujo seria indistinguivel
   * de a mecanica estar quebrada. Carrega as celulas pelo mesmo motivo que
   * `leyline_charge` carrega: o cliente precisa acender a parede exata que
   * pede picareta.
   */
  | { t: 'leyline_short'; seg: number; cells: number[] }
  /**
   * A cascata lancada na nascente terminou. `closed` diz se ela acendeu TODOS
   * os segmentos do circuito; `lit` e `total` deixam o cliente dizer o quanto
   * faltou sem recontar nada.
   *
   * Um evento so para os dois desfechos, e nao um par sucesso/fracasso, porque
   * quem escuta faz a mesma coisa nos dois casos — encerra o telegrafo e
   * mostra o placar; ramificar no tipo espalharia essa decisao pelo cliente.
   */
  | { t: 'leyline_circuit'; closed: boolean; lit: number; total: number }
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
  | {
      t: 'flame_cone';
      owner: number;
      x: number;
      y: number;
      dx: number;
      dy: number;
      range: number;
      arc: number;
      seq: number;
      reach: number[];
    }
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
  /**
   * Um Nucleo saiu do pedestal. `sector` e `total` viajam junto porque a run
   * pode ter dois, e "NUCLEO 1 DE 2" e uma frase diferente de "NUCLEO
   * RECUPERADO" — a primeira diz ao jogador que a descida continua autorizada.
   */
  | { t: 'pickup_core'; x: number; y: number; sector: number; taken: number; total: number }
  | { t: 'terminal_activated'; siteId: number; x: number; y: number; completesAtTick: number }
  | { t: 'terminal_scan_complete'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_revealed'; siteId: number; x: number; y: number }
  | { t: 'salvage_cache_opened'; siteId: number; slot: number; x: number; y: number }
  | { t: 'purge_cell_acquired'; slot: number; amount: number }
  | { t: 'purge_cell_used'; slot: number; x: number; y: number }
  | {
      t: 'module_selected';
      slot: number;
      module: ModuleId;
      sourceSiteId: number;
      recharged: boolean;
    }
  | {
      t: 'module_charge_consumed';
      slot: number;
      module: ModuleId;
      remaining: number;
      maximum: number;
    }
  | { t: 'module_expired'; slot: number; module: ModuleId }
  /**
   * O canhao rotativo MUDOU DE FASE. Emitido so na transicao, nunca por tick.
   *
   * Carrega a rotacao do instante da virada para o cliente poder continuar a
   * rampa por conta propria com as MESMAS constantes: entre duas transicoes a
   * apresentacao integra sozinha, e nada precisa trafegar. E o que faz o
   * parceiro remoto parecer estar usando a arma sem um campo por tick.
   */
  | { t: 'minigun_spin'; slot: number; x: number; y: number; phase: MinigunPhase; spin: number }
  /**
   * QUANTAS balas sairam na ultima janela de `MINIGUN_BURST_EVENT_TICKS`.
   *
   * Cinco por segundo, agregados, em vez de dezesseis "saiu mais uma". A
   * apresentacao inteira da rajada — a textura sonora, o clarao curto, as
   * capsulas ejetadas — se alimenta da DENSIDADE, e densidade e o que este
   * campo diz. O projetil individual continua viajando no snapshot, entao
   * nada do que machuca depende deste evento.
   */
  | {
      t: 'minigun_burst';
      slot: number;
      x: number;
      y: number;
      dx: number;
      dy: number;
      rounds: number;
      spin: number;
    }
  | { t: 'overheat'; slot: number; x: number; y: number }
  /**
   * O chefe do setor acordou. Chamava-se `guardian_awake`: o Guardiao era o
   * unico chefe que dormia ate ser notado, e desde `bossForBiome` a camara
   * final pode ser de outro.
   */
  // `archetype`/`x`/`y` sao opcionais por defesa (fixtures antigas); a
  // simulacao sempre os preenche, e e por eles que o despertar de cada chefe
  // soa como o proprio chefe, de onde ele esta.
  | { t: 'boss_awake'; archetype?: EnemyArchetype; x?: number; y?: number }
  /**
   * OS TRES MOMENTOS de uma habilidade de chefe, como eventos PROPRIOS.
   *
   *   boss_windup      preparacao — "algo vai acontecer".
   *   boss_attack      execucao   — "aconteceu agora".
   *   boss_state       consequencia/presenca — "o mundo (ou o corpo) mudou".
   *   boss_vulnerable  a blindagem abriu (ou fechou de novo).
   *
   * Existem porque a assinatura sonora de cada chefe nao pode ser INFERIDA no
   * cliente: `action_start` diz que uma acao `pulse` comecou, mas so a
   * simulacao sabe que aquele pulso e o canto do Arquicantor e nao a Supernova
   * do Bispo — e as fases que nao passam por `EntityAction` (a respiracao do
   * Pulmao, a polaridade do Magnetarca, a boca do Devorador) nao tinham
   * evento nenhum. Cada um carrega o arquetipo e a habilidade/momento, e NADA
   * de acustica: que voz soa, com que altura, e decisao do cliente (cues.ts).
   *
   * `intensity` (0..1) e o unico numero "de apresentacao" que viaja, e o
   * significado e da habilidade: para o canto do Arquicantor e o tamanho da
   * rede que vai responder; para a ressonancia, quao perto do corpo a camada
   * esta. `releaseTick` no windup e para o cliente poder casar a duracao da
   * preparacao com a do aviso, como `action_start` ja faz.
   */
  | {
      t: 'boss_windup';
      archetype: EnemyArchetype;
      ability: BossAbility;
      x: number;
      y: number;
      dx?: number;
      dy?: number;
      releaseTick: number;
      intensity?: number;
    }
  | {
      t: 'boss_attack';
      archetype: EnemyArchetype;
      ability: BossAbility;
      x: number;
      y: number;
      dx?: number;
      dy?: number;
      intensity?: number;
    }
  | {
      t: 'boss_state';
      archetype: EnemyArchetype;
      state: BossMoment;
      x: number;
      y: number;
      intensity?: number;
    }
  /**
   * A JANELA DE DANO abriu (`open`) ou fechou. E o "bata agora" sonoro: a
   * Fornalha esfriando, o lago da Rainha derretido, a Catedral em silencio, a
   * boca do Devorador, o Pulmao aceso pela propria expiracao.
   */
  | { t: 'boss_vulnerable'; archetype: EnemyArchetype; x: number; y: number; open: boolean }
  /**
   * O chefe cruzou um LIMIAR e nao volta atras.
   *
   * Evento proprio, e nao um `hit` que o cliente interprete: quem sabe que
   * aquele dano foi o que cruzou os 45% e a simulacao, e a apresentacao da
   * fase (o brilho, a fumaca, o tremor no ritmo do coracao) precisa comecar no
   * tick exato — um cliente contando vida por conta propria comecaria cedo ou
   * tarde conforme o atraso da rede.
   *
   * O bit tambem viaja em `WorldFlags.bossPhases`, entao quem reconecta no meio
   * do colapso chega ja com a apresentacao certa.
   */
  | { t: 'boss_phase'; archetype: EnemyArchetype; phase: number; x?: number; y?: number }
  /**
   * Uma estalactite foi MARCADA. `fireTick` e quando ela chega.
   *
   * O aviso viaja separado da queda pelo invariante de sempre: nada neste jogo
   * causa dano sem sinal. O cliente desenha a sombra crescendo no chao; a
   * simulacao cobra quando o tick chega.
   */
  | { t: 'stalactite'; x: number; y: number; radius: number; fireTick: number }
  /**
   * A SALA ESFRIA: o Coracao caiu e o calor sai junto com ele.
   *
   * Nao e so apresentacao — a simulacao apaga a brasa e o fogo da camara e
   * dissolve os ciclones. E o alivio que fecha o encontro, e ele tem de ser
   * autoritativo: um cliente que apagasse o fogo sozinho estaria desenhando um
   * chao seguro sobre celulas que ainda queimam.
   */
  | { t: 'furnace_cooled'; x: number; y: number; radius: number }
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
      /**
       * Quantos setores esta run atravessa. Viaja no evento e nao so no
       * handshake porque e o denominador do HUD ("SETOR 5 / 7"), e um cliente
       * que entrou depois da abertura precisa dele antes de desenhar o primeiro
       * quadro do setor novo.
       */
      sectorCount: number;
      /** Ha Nucleo aqui? Decide o que o ponto especial do mapa significa. */
      hasCore: boolean;
      /** O dono deste setor, quando existe. `null` = setor sem chefe. */
      boss: EnemyArchetype | null;
      /** O selo ja caiu? Verdadeiro na chegada quando nao ha chefe, ou ja caiu. */
      unsealed: boolean;
    }
  /**
   * O SELO DO SETOR CEDEU: o dono caiu e o que ele guardava abriu.
   *
   * Evento proprio e nao um `death` reinterpretado pelo cliente porque a morte
   * de um chefe e a abertura de um portal sao coisas diferentes e o cliente nao
   * tem como derivar a segunda: ele nao sabe se aquele arquetipo era o dono
   * DESTE setor ou um segundo corpo do mesmo tipo. Quem sabe e a simulacao, e e
   * ela quem tem de dizer.
   *
   * Nao transporta ninguem. Ele so anuncia que descer (e recolher, quando ha
   * Nucleo aqui) passou a ser possivel.
   */
  | {
      t: 'sector_unsealed';
      sector: number;
      archetype: EnemyArchetype;
      /** O pedestal deste setor abriu junto. */
      coreUnlocked: boolean;
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
  | {
      t: 'beam_line';
      x: number;
      y: number;
      dx: number;
      dy: number;
      length: number;
      powered: boolean;
    }
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
  | {
      t: 'player_down';
      slot: number;
      x: number;
      y: number;
      facingX: number;
      facingY: number;
      tick: number;
    }
  | { t: 'revive'; x: number; y: number; slot: number; tick: number }
  | { t: 'extracted'; withCore: boolean; cores: number }
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
  | {
      t: 'message';
      key: SimMessageKey;
      /**
       * Para QUEM a mensagem e. Ausente, e um anuncio do mundo (contaminacao,
       * Nucleo caido) e todo cliente a mostra; presente, e a resposta a uma
       * acao daquele jogador ("reviva o parceiro antes de descer") e so o
       * cliente dele a ve. No co-op os dois recebem os mesmos eventos, e sem
       * isto o parceiro lia as recusas do outro como se fossem as suas.
       */
      slot?: number;
    };

/**
 * As mensagens que a simulacao sabe emitir.
 *
 * Uniao fechada de proposito: uma mensagem nova aqui quebra o catalogo do
 * cliente na COMPILACAO, que e onde o texto faltando tem de aparecer — e nao na
 * tela do jogador, como uma chave crua.
 */
export type SimMessageKey =
  /** O circuito da leyline fechou: o estrato parou de valer contra voce. */
  | 'sim.leylineCircuitClosed'
  | 'sim.partnerRevived'
  | 'sim.reviveBeforeDescend'
  | 'sim.waitAtShaft'
  | 'sim.coreTaken'
  | 'sim.wellSealedReturn'
  | 'sim.reviveBeforeExtract'
  | 'sim.waitAtExit'
  | 'sim.contaminationRising'
  /** O ar saturou: dali em diante ficar custa vida. Dispara UMA vez por setor. */
  | 'sim.contaminationCritical'
  | 'sim.coreDropped'
  | 'sim.arenaSealed'
  | 'sim.siegeCollapsed'
  /** O teto da camara comecou a ceder. */
  | 'sim.ceilingCollapsing'
  /** O constructo perdeu a forma: a sala inteira virou fogo. */
  | 'sim.furnaceUnstable'
  | 'sim.delugeRising'
  /** O Coracao caiu e o calor foi embora com ele. */
  | 'sim.furnaceCooled'
  /** O poco nao abre: o dono do setor ainda esta de pe. */
  | 'sim.descentSealedByBoss'
  /** O pedestal recusa a mao: o mesmo selo, o mesmo dono. */
  | 'sim.coreSealedByBoss'
  /** Nucleo intermediario recolhido — e ha mais Veio abaixo. */
  | 'sim.coreTakenDeeper';

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
   * Setor atual da descida, de 1 ao `sectorCount` congelado da run.
   *
   * `corePos` e o PONTO ESPECIAL do setor, e o que ele significa depende da
   * configuracao: no ultimo setor e o pedestal do Nucleo; num setor de Nucleo
   * intermediario e as DUAS COISAS (recolhe-se o Nucleo ali e desce-se dali
   * mesmo, em duas interacoes); nos demais e so o poco de descida.
   *
   * E a mesma posicao reaproveitada de proposito: o worldgen ja garante que ela
   * seja alcancavel a partir da entrada, que e exatamente a garantia que o poco
   * precisa. Gerar um segundo ponto especial exigiria repetir essa prova para
   * ele — e, pior, mudaria a geracao semeada de todo mapa ja existente.
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
  /**
   * O campo do DILUVIO: distancia da agua ate cada celula, andando pelos vaos.
   *
   * DERIVADO, como `bossRuntime.path`: sai de (solido, canos, origem) e da para
   * refazer a qualquer momento, entao nao entra no hash e nao viaja em
   * snapshot. `delugeFieldBucket` e o balde de tick em que ele foi feito — as
   * duas pontas refazem nos MESMOS instantes, e nao quando cada uma tiver
   * vontade. Ver `delugeField`.
   */
  delugeField: Uint16Array | null;
  delugeFieldBucket: number;
  chunkVersion: Uint32Array;
  entry: Vec2;
  corePos: Vec2;
  /**
   * MASCARA dos Nucleos ja recolhidos nesta run (bit N = Nucleo do setor N).
   *
   * Substituiu o booleano `coreTaken`, que so conseguia dizer "o Nucleo" — e a
   * partir de G-03 ha dois. Mascara e nao lista porque o campo entra no hash
   * autoritativo e viaja em snapshot: um inteiro tem uma unica representacao, e
   * duas simulacoes nunca podem divergir por ordem de insercao. Sete setores
   * cabem numa nibble e meia; o teto e `MAX_LINEAGE_SECTORS`.
   *
   * "Recolhido" e diferente de "liquidado": o bit acende na coleta e apaga se o
   * portador cair (o Nucleo volta ao pedestal). So a extracao bem-sucedida
   * converte um bit em recompensa.
   */
  coresTakenMask: number;
  /**
   * O chefe DESTE setor, como o portal e o Nucleo precisam conhece-lo.
   *
   * Deliberadamente magro: quem e, qual corpo esta em campo e se ja caiu. As
   * mecanicas proprias de cada chefe continuam em `bossRuntime` e nos campos
   * dele — generalizar a rota do Guardiao e a arena do Diamandis num tipo comum
   * so produziria um objeto que nenhum dos dois preenche inteiro.
   *
   * O ponto do tipo e outro: o portal e o pedestal precisam perguntar "o dono
   * deste setor ja caiu?" sem conhecer `bishop` nem `guardian`. Enquanto a
   * pergunta era feita por nome, cada chefe novo exigia editar as duas
   * respostas — e o `bossesDownMask` passou tres versoes marcando so dois
   * arquetipos porque ninguem lembrou.
   */
  sectorBoss: SectorBossState;
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
   * campo novo. Cabe folgado em 32 bits (o teto e `MAX_LINEAGE_SECTORS`, 7).
   *
   * A mascara responde UMA pergunta — "o chefe do setor N ja caiu?" — e a
   * ausencia de bit e ambigua de proposito: significa tanto "ainda vivo" quanto
   * "este setor nao tem chefe". Quem precisa distinguir pergunta antes se o
   * setor tem dono (`sectorBoss.archetype`), e e por isso que os dois campos
   * andam juntos.
   */
  bossesDownMask: number;
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
   * Segmentos de leyline do setor, na ordem em que o worldgen os entregou.
   * Vazio em todo estrato sem leyline. Ver `LeylineSegment` para o contrato
   * de hash/wire (relogios entram, geometria nao).
   */
  leylineSegments: LeylineSegment[];
  /**
   * Juncoes da rede, com a adjacencia derivada da seed em `createRun`. So o
   * `routed` de cada uma e autoritativo (hash + wire); ver `LeylineNode`.
   */
  leylineNodes: LeylineNode[];
  /**
   * O circuito do setor: o que a rede pede do jogador. Ver `LeylineCircuit`.
   */
  leylineCircuit: LeylineCircuit;
  /**
   * O circuito fechou e a propriedade que da identidade a este estrato parou
   * de valer ate a proxima descida.
   *
   * Um booleano so, e nao um efeito por estrato, porque quem sabe o que
   * desligar e cada sistema — `isConductiveCell` sabe da agua, o calor sabe da
   * brasa, o Miner sabe da sobrecarga. Espalhar a leitura e o que impede este
   * campo de virar uma tabela de excecoes que ninguem mantem.
   *
   * Espelha `leylineCircuit.closed` para os leitores quentes nao precisarem
   * alcancar o objeto do circuito a cada tick.
   */
  stratumSubverted: boolean;
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
  /**
   * Tick em que a saturacao comecou, ou 0 enquanto ela nao chegou.
   *
   * Mora no estado (e nao num contador do cliente) porque a escalada da mordida
   * se mede a partir dele: duas maquinas que discordem de quando o ar virou
   * divergem no dano do proximo pulso.
   */
  contaminationSaturatedAt: number;
  /** Proximo tick em que a saturacao cobra, e em que a onda tardia repete. */
  contaminationNextPulseAt: number;
  contaminationNextSurgeAt: number;
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
