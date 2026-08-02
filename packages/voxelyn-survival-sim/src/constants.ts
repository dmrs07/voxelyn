// Simulacao autoritativa: tempo em ticks inteiros a 20 Hz.
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;

export const WORLD_W = 96;
export const WORLD_H = 96;
export const CHUNK = 16;
export const CHUNKS_X = WORLD_W / CHUNK;
export const CHUNKS_Y = WORLD_H / CHUNK;

// Camada solida (paredes / vazio).
export const SOLID_NONE = 0;
export const SOLID_ROCK = 1;
export const SOLID_FRAGILE = 2;
export const SOLID_ORE = 3;
export const SOLID_CRYSTAL = 4;
// Estados intermediarios: existem para o jogador VER o material mudando antes
// de ceder. Sem o estagio visivel, corrosao e rachadura viram morte invisivel,
// que e justamente o que o design proibe.
export const SOLID_FRAGILE_WEAK = 5; // frágil corroído, cede ao proximo toque
export const SOLID_ORE_SPENT = 6; // veio esgotado ou contaminado: nao conduz
export const SOLID_CRYSTAL_DULL = 7; // cristal opaco: nao emite luz nem descarrega
export const SOLID_ORE_CHIPPED = 8; // veio ja lascado, a um golpe de esgotar

// Camada de superficie (o que cobre o chao de uma celula aberta).
//
// Os IDs antigos permanecem estaveis porque viajam nos diffs de chunk. Os dois
// estados novos entram no fim:
// - SPORES e a nuvem organica deixada pelo Spore Bomber;
// - FUNGAL_HEATED e o tapete umido secando/fumegando antes de pegar fogo.
export const SURF_NONE = 0;
export const SURF_FUNGAL = 1;
export const SURF_BIOFLUID = 2;
export const SURF_GAS = 3;
export const SURF_FIRE = 4;
export const SURF_SCORCHED = 5;
export const SURF_SPORES = 6;
export const SURF_FUNGAL_HEATED = 7;
// A agua do Aquifero Negro. Entra no fim pela mesma regra dos dois acima: os
// IDs viajam nos diffs de chunk e nao podem mudar de significado.
//
// Nao e biofluido azul: a agua e PERMANENTE (timer 0), nao queima nunca, APAGA
// fogo encostado nela e conduz descarga como o biofluido. E a versao estatica
// do bioma flooded — superficie que divide o chao em ilhas e areas rasas, sem
// exigir pressao, volume nem correnteza.
export const SURF_WATER = 8;
// Fissura incandescente da Fornalha Abissal. Nao machuca: e PRESSAO — em cima
// dela a arma dissipa calor devagar. Dano passivo por pisar seria punicao sem
// decisao; o que a fissura cobra e a barra de calor, que ja esta no HUD.
export const SURF_EMBER = 9;
// Gelo da Cripta Glacial. Nao conduz (isolante); fogo o derrete em agua
// condutiva, e a agua derretida recongela sozinha depois de um tempo.
export const SURF_ICE = 10;

// Orcamentos por tick (degradacao previsivel via fila deterministica).
export const BUDGET_REACTING_CELLS = 4096;
export const BUDGET_DISCHARGE_CELLS = 256;
export const MAX_PROJECTILES = 96;
export const MAX_ENEMIES = 48;

// Cadencia da simulacao celular (a cada N ticks).
export const CELL_STEP_INTERVAL = 3;

export const FIRE_FUEL_TICKS = 46;
export const FIRE_DAMAGE_PER_TICK = 2.2;

// Fungo e biomassa umida: primeiro seca/fumega, depois queima por mais tempo.
export const FUNGAL_HEAT_TICKS = 36; // ~1,8 s ate a ignicao a 20 Hz
export const FUNGAL_HEAT_IMPACT_TICKS = 12; // calor direto acelera a secagem
export const FUNGAL_FIRE_FUEL_TICKS = 72; // ~3,6 s de combustao lenta

// Gas sulfurico: permanece no ambiente, mas ao acender vira apenas um flash
// curto. A explosao direta continua sendo tratada por impactSurface.
export const GAS_LIFE_TICKS = 220;
export const GAS_DAMAGE_PER_TICK = 0.55;
export const GAS_SPREAD_CHANCE = 0.14;
export const GAS_FLASH_TICKS = 8; // ~0,4 s antes de sumir

// Esporos: nuvem organica localizada do bomber. Machuca, nao difunde como gas e
// desaparece sozinha; fogo a esteriliza numa combustao curta, sem explosao.
export const SPORE_LIFE_TICKS = 180;
export const SPORE_DAMAGE_PER_TICK = 0.55;
export const SPORE_BURN_TICKS = 18;

export const FIRE_SPREAD_BIOFLUID = 0.85;
export const BIOFLUID_SLOW = 0.55;
/**
 * Lentidao na agua: mais leve que no biofluido de proposito. O biofluido e
 * lodo — pisar nele e um erro que cobra caro. A agua e TERRENO: metade do
 * Aquifero e ela, e a 0,55 atravessar o proprio bioma viraria castigo passivo.
 * A 0,72 a agua cobra o bastante para a rota seca valer a pena sem transformar
 * o setor inteiro numa marcha.
 */
export const WATER_SLOW = 0.72;

// ---------------------------------------------------------------------------
// Segunda leva de estratos: Fenda Sulfurosa, Fornalha Abissal, Cripta Glacial
// ---------------------------------------------------------------------------
/**
 * Ciclo dos respiradouros na Fenda Sulfurosa, em ticks (10 s por janela).
 *
 * A identidade do estrato e a VENTILACAO: as fontes ligam e desligam em
 * janelas alternadas por posicao, entao metade das camaras esta sempre
 * respiravel e a rota muda com o relogio. So vale no estrato sulfuroso — nos
 * outros, os respiradouros continuam com o comportamento historico.
 */
export const VENT_CYCLE_TICKS = 200;
/**
 * Quanto da dissipacao de calor sobra em cima de uma fissura incandescente.
 *
 * O erro seria a barra subir sozinha no bioma inteiro — punicao passiva. O
 * calor e LOCALIZADO e visivel: pisar na fissura nao machuca, mas segura o
 * calor da arma, e a decisao de lutar ali dentro e do jogador.
 */
export const EMBER_HEAT_DECAY_SCALE = 0.35;
/**
 * Combustao do carvao da Fornalha. O chao queimado la nao e cinza esteril, e
 * CARVAO: uma fonte de calor (explosao, chama) o acende em fogo persistente —
 * mais que o dobro do combustivel do biofluido.
 */
export const COAL_FIRE_FUEL_TICKS = 110;
/**
 * Quanto tempo a agua derretida fica liquida antes de recongelar (~14 s).
 *
 * O recongelamento e propriedade da AGUA DERRETIDA, nao do estrato: gelo que
 * virou agua volta a ser gelo em qualquer lugar, e a agua nativa do Aquifero
 * (timer 0) nunca congela. Assim derreter uma ponte e abrir uma JANELA — de
 * conducao e de rota — e nao uma edicao permanente do mapa.
 */
export const ICE_REFREEZE_TICKS = 280;

/**
 * INERCIA DO GELO: por tick, quanto da velocidade ANTERIOR o Prospector
 * mantem sobre a lamina — o rumo comandado entra so no complemento. A 0,82 e
 * 20Hz, mudar de direcao leva ~0,4s para completar e soltar o direcional
 * desliza ~0,7 celula: o gelo vira uma decisao de rota (velocidade nas retas,
 * imprecisao nas curvas), nao um piso que so muda de cor. So o jogador tem
 * inercia — o Espectro ja tem o proprio contrato com a lamina, e os demais
 * bichos manteriam N flows de perseguicao para revisar de uma vez.
 */
export const ICE_GLIDE = 0.82;

/**
 * TRILHOS DA OPERACAO (SURF_RAIL, id 11 — append-only, como toda superficie).
 *
 * O trilho e superficie AUTORITATIVA, nao decoracao: um carrinho que machuca
 * nao pode correr por cima de um enfeite que so o cliente ve. E INERTE para
 * toda outra fisica — nao conduz, nao queima, nao retarda: o que ele faz e
 * uma coisa so, e e a armadilha.
 *
 * A armadilha: pisar num tramo armado dispara o aviso (CART_WINDUP_TICKS de
 * telegrafo — morte SEMPRE anunciada) e entao um carrinho de mineracao
 * desgovernado atravessa o tramo vindo do lado LONGE do jogador, atropelando
 * o que estiver na linha — jogador E bicho: fisica nao escolhe lado. Depois
 * do disparo o tramo descansa (CART_COOLDOWN_TICKS): armadilha e pontuacao,
 * nao metralhadora.
 */
export const SURF_RAIL = 11;
/**
 * O tramo VERTICAL usa id proprio so pela crosta: os frisos do atlas correm
 * numa direcao, e um trilho vertical com crosta horizontal leria como
 * escada. Para a fisica os dois sao o mesmo trilho inerte.
 */
export const SURF_RAIL_V = 12;
/** Celulas/s do carrinho: mais rapido que o Prospector — sair da LINHA e a fuga. */
export const CART_SPEED = 10;
export const CART_DAMAGE = 24;
/** Ticks entre o aviso e o carrinho: 1,2 s a 20 Hz — da para sair andando. */
export const CART_WINDUP_TICKS = 24;
export const CART_COOLDOWN_TICKS = 400;
export const CART_RADIUS = 0.55;
/** Tramo minimo/maximo, em celulas. Curto demais nao telegrafa nada. */
export const RAIL_TRACK_MIN = 8;
export const RAIL_TRACK_MAX = 16;

/**
 * O CANARIO morre neste nivel de contaminacao. A gaiola e decoracao, mas o
 * canario e MOSTRADOR: um medidor vivo espalhado pelo mundo, lendo o mesmo
 * valor autoritativo que o HUD — quando os passaros calam, o retorno ja
 * esta caro. O limiar mora na simulacao (e nao no cliente) porque e um fato
 * do mundo: o mesmo canario morre no mesmo instante em toda maquina.
 */
export const CANARY_DEAD_AT = 0.5;

// ---------------------------------------------------------------------------
// Bestiario de assinatura: um inimigo por estrato, manipulando a REGRA do bioma
// ---------------------------------------------------------------------------
// A regra que rege os cinco: nenhum deles inventa mecanica nova. Cada um opera
// uma alavanca que o estrato ja tem — cristal que descarrega, agua que conduz,
// gas que ocupa espaco, brasa que aquece, gelo que derrete. Uma criatura de
// gelo que so desse "dano de gelo" seria uma skin; uma que usa o lago como
// cobertura pertence ao lugar.

/**
 * Ressonante (Catedral Prismatica): nao atira no jogador. Ele VIBRA, e a
 * vibracao arma os cristais em volta — cada um descarrega pelas aberturas
 * coladas nele. O contra-jogo e decidir QUAIS cristais quebrar antes, onde
 * enfrenta-lo, ou usar a propria cadeia contra ele.
 */
export const RESONANT_PULSE_RADIUS = 4.5;
/** Telegrafo LONGO (1,2 s): a area do pulso e grande e muda conforme a sala. */
export const RESONANT_WINDUP_TICKS = 24;
export const RESONANT_COOLDOWN_TICKS = 150;
/** Cristais armados por pulso, no maximo. Orcamento, como toda propagacao. */
export const RESONANT_CRYSTAL_BUDGET = 12;

/**
 * Lampreia de Lodo (Aquifero Negro): submersa enquanto nao ataca — o cliente
 * desenha a ondulacao, nao o corpo. Ela so se move POR liquido; o bote curto e
 * telegrafado e a unica hora em que sai da agua. Corrente na agua a atordoa
 * (regra generica de descarga), mas a descarga percorre a poca inteira.
 */
export const LAMPREY_LUNGE_RANGE = 3.4;
export const LAMPREY_LUNGE_WINDUP_TICKS = 14; // a agua "se abre" por 0,7 s
export const LAMPREY_LUNGE_COOLDOWN_TICKS = 64;

/**
 * Fole (Fenda Sulfurosa): respira o ambiente. Na fase de inspirar, remove gas
 * num raio em volta; na de expelir, sopra uma linha de gas na direcao OPOSTA
 * ao jogador. Deixa-lo vivo por alguns segundos limpa a passagem que voce
 * quer — e contamina a que voce ia usar depois.
 */
export const BELLOWS_BREATH_RADIUS = 3;
export const BELLOWS_CYCLE_TICKS = 100; // 5 s inspirando, 5 s expelindo
export const BELLOWS_BREATH_INTERVAL_TICKS = 12;
export const BELLOWS_INHALE_PER_BREATH = 4;
export const BELLOWS_EXHALE_LENGTH = 6;

/**
 * Escoriaceo (Fornalha Abissal): carapaca resfriada reduz TODO dano enquanto
 * frio. Pisar em brasa ou fogo abre a couraça: vulneravel — e mais rapido e
 * agressivo — por alguns segundos. A pergunta e do jogador: quanto risco
 * termico aceitar para torna-lo vulneravel?
 */
export const SCORIAC_ARMOR_SCALE = 0.45;
export const SCORIAC_HOT_TICKS = 160; // ~8 s de couraça aberta
export const SCORIAC_HOT_SPEED_SCALE = 1.45;

/**
 * Espectro de Geada (Cripta Glacial): move-se SOB o gelo — rapido, raso,
 * dificil de ler fora da lamina — e emerge num bote telegrafado. Derreter o
 * lago tira a cobertura dele: exposto, e um corpo palido e lento na agua que
 * voce acabou de tornar condutiva.
 */
export const WRAITH_LUNGE_RANGE = 3.2;
export const WRAITH_LUNGE_WINDUP_TICKS = 12;
export const WRAITH_LUNGE_COOLDOWN_TICKS = 70;
/** Sob o gelo ele desliza mais rapido do que qualquer coisa anda. */
export const WRAITH_UNDER_ICE_SPEED_SCALE = 1.35;

/**
 * Bombardeiro de Enxofre (Fenda Sulfurosa e Fornalha Abissal).
 *
 * O Spore Bomber e uma coisa MICELIAL: ele estoura numa nuvem de esporos
 * organicos. Numa caverna de magma isso nao quer dizer nada — nao ha micelio
 * ali para produzi-lo, e a nuvem verde no meio da brasa era o sinal mais
 * fora de lugar do jogo. Esta e a mesma silhueta com a quimica do lugar: o
 * corpo carrega enxofre condensado e, ao romper, larga GAS no lugar dos
 * esporos.
 *
 * A diferenca nao e cosmetica, e a razao de ele existir: esporos so
 * envenenam, gas EXPLODE. Matar um destes perto de brasa, fogo ou de uma
 * fissura da Fornalha acende a nuvem inteira — a mesma regra de ignicao que
 * o estrato ja cobra dos respiradouros. A recompensa por ler o terreno e
 * matar longe do calor; o preco por nao ler e a sala pegando fogo.
 */
export const SULFUR_BOMBER_GAS_RADIUS = 2;
export const SULFUR_BOMBER_GAS_LIFE_TICKS = 240;

/**
 * Coveiro (Estrato Ferrifero): o catador de sucata do Veio.
 *
 * Foi construido para recolher automatos quebrados — e nunca recebeu ordem de
 * parar. O que ele faz com o jogador e o que fazia com carcaças: ATRAI pelo
 * eletroima do braço e prensa. Ele e o unico corpo do bestiario que tira do
 * jogador a coisa que o jogo inteiro assume dele — a posicao.
 *
 * O contra-jogo mora no telegrafo LONGO (1,1 s de eletroima carregando) e na
 * geometria: o puxao respeita parede, entao quem quebra a linha de visao ou
 * poe uma quina no caminho chega mais perto do que queria, mas nao no colo
 * dele. Esquivar durante a carga tambem sai — o iframe do dodge nao anula o
 * arrasto, mas os tiles ganhos, sim.
 */
/**
 * O ALCANCE e o ARRASTO andam juntos, e a conta precisa de MARGEM:
 *
 *   PULL_RANGE - PULL_TILES + PULL_STEP <= SLAM_RANGE
 *
 * Sem relacao nenhuma, o combo nao fechava no PRIMEIRO CONTATO: com engate a
 * 8,5 tiles e arrasto de 3,6, o alvo terminava a 4,9 do Coveiro contra uma
 * prensa de 1,5 — os dois telegrafos gastos num golpe que nao podia acertar
 * nem contra alguem parado, e como o aggro tambem valia 8,5 esse era o
 * comportamento NORMAL do encontro.
 *
 * A primeira correcao fechou a conta com IGUALDADE EXATA (6,5 - 5 = 1,5) e
 * isso ainda estava errado, por dois motivos que so aparecem no limite: a
 * checagem da prensa e estrita (`dist < reach`), entao a borda exata nao
 * acerta; e o arrasto anda em passos discretos de 0,2, entao em rumos
 * oblicuos o acumulado para um epsilon ACIMA da conta ideal. Medido: a 30 e
 * a 60 graus o alvo terminava a 1,5000...algo e a prensa passava batido.
 *
 * Agora sobra folga de um passo inteiro: 6,5 - 5,5 = 1,0 contra 1,5 de
 * alcance. O puxao entrega o alvo DENTRO do golpe em qualquer rumo, e nao na
 * borda dele.
 */
export const UNDERTAKER_PULL_RANGE = 6.5;
export const UNDERTAKER_PULL_MIN_RANGE = 2.2; // colado, ele so prensa
export const UNDERTAKER_PULL_WINDUP_TICKS = 22;
export const UNDERTAKER_PULL_COOLDOWN_TICKS = 130;
/** Quanto o eletroima arrasta, em tiles, se nada bloquear o caminho. */
export const UNDERTAKER_PULL_TILES = 5.5;
/** Passo do arrasto: a colisao e avaliada tile a tile, nunca em salto. */
export const UNDERTAKER_PULL_STEP = 0.2;
/** A prensa que vem logo depois do puxao — o "porradao". */
export const UNDERTAKER_SLAM_DAMAGE = 26;
export const UNDERTAKER_SLAM_WINDUP_TICKS = 14;
export const UNDERTAKER_SLAM_RANGE = 1.5;
export const DISCHARGE_DAMAGE = 26;
export const DISCHARGE_TICKS = 6;
/** Controle direto do Conductive em alvos organicos: 1,2 s a 20 Hz. */
export const CONDUCTIVE_STUN_TICKS = Math.round(1.2 * TICK_HZ);

// Propagacao por material solido. Orcamentos separados do biofluido porque um
// veio de minerio atravessa a sala inteira e nao pode custar um tick.
export const BUDGET_VEIN_CELLS = 64;

/**
 * CONDUCAO POR PAREDE do Estrato Ferrifero: la, o veio conectado nao e um
 * fio — e a fiacao do lugar. O orcamento do flood triplica, entao a descarga
 * que entra num seam atravessa o no de magnetita e sai DUAS salas adiante.
 * So muda dentro do ferric: nos demais estratos o veio conduz como sempre.
 */
export const FERRIC_VEIN_SCALE = 3;
export const BUDGET_RESONANCE_CELLS = 24;


export const PLAYER_HP = 100;
export const PLAYER_SPEED = 4.6; // tiles/s
export const PLAYER_RADIUS = 0.34;
export const DODGE_SPEED = 11;
export const DODGE_TICKS = 4; // impulso
export const DODGE_IFRAME_TICKS = 7;
export const DODGE_COOLDOWN_TICKS = 18;

export const HEAT_PER_SHOT = 9;
export const HEAT_MAX = 100;
export const HEAT_DECAY_PER_TICK = 1.15;
export const OVERHEAT_LOCK_TICKS = 36;
export const OVERHEAT_SELF_DAMAGE = 6;

/**
 * Quanto tempo um inimigo caça depois de levar dano, independente da distancia.
 *
 * Quatro segundos e o bastante para ele SAIR do lugar e vir na sua direcao —
 * um bruiser a 2.3 tiles/s anda ~9 tiles nesse tempo, mais que o proprio raio
 * de aggro. Nao e infinito de proposito: quem atira e foge continua conseguindo
 * quebrar o contato, so nao de graça.
 */
export const ALERT_TICKS = 4 * TICK_HZ;

/**
 * Arremesso de bloco do bruiser.
 *
 * Ele era o unico inimigo sem NENHUMA resposta a distancia, andando a metade da
 * velocidade do jogador: contra alguem que recua ele simplesmente nunca
 * encostava. O arremesso existe para isso, e o windup e longo porque a ameaca
 * tem de ser vista e evitada — a promessa do jogo e morrer por decisao
 * arriscada, nunca por algo que nao deu para ler.
 */
export const BRUISER_HURL_WINDUP_TICKS = 16; // ~0,8 s de telegrafo
export const BRUISER_HURL_COOLDOWN_TICKS = 70; // ~3,5 s
export const BRUISER_HURL_MIN_RANGE = 2.6;
export const BRUISER_HURL_MAX_RANGE = 9;
/**
 * Velocidade da pedra: quase o DOBRO da do jogador (4,6).
 *
 * A primeira tentativa foi 6 — "mais lento que o cuspe, da para desviar" — e
 * media zero acerto contra quem foge em linha reta: a 6 contra 4,6 a pedra se
 * aproxima 1,4 tile/s e nunca chega. Contra alvo em fuga, projetil so ameaca se
 * for claramente mais rapido que o alvo. O que torna o arremesso justo nao e a
 * lentidao da pedra, e o telegrafo de 0,8 s antes dela sair.
 */
export const BRUISER_HURL_SPEED = 9;
/**
 * Distancia que a pedra voa, em tiles — deliberadamente MAIOR que o alcance em
 * que o arremesso e decidido.
 *
 * Derivar o alcance de voo do alcance de decisao (9) parecia obvio e nao
 * funcionava: durante os 0,8 s de telegrafo um jogador em fuga corre quase 4
 * tiles, entao no instante do lancamento ele ja esta ALEM do alcance de
 * decisao. Medido, a pedra morria a meio caminho e o arremesso acertava zero
 * contra quem simplesmente segurava o botao de andar para tras. O excedente e a
 * margem para alvo em movimento.
 */
export const BRUISER_HURL_FLIGHT_TILES = 20;
export const BRUISER_HURL_DAMAGE = 22;
/** Corpo fisico do bloco arremessado, maior que cuspe/bolt. */
export const BRUISER_ROCK_RADIUS = 0.46;
/** A pancada interrompe o Prospector por 1,2 s. */
export const BRUISER_ROCK_STUN_TICKS = Math.round(1.2 * TICK_HZ);
/** Vida do bruiser: ver ARCHETYPES. 95 dava 1,7 s de vida — um arremesso so. */
/** Raio de busca, em celulas, do bloco que ele arranca para usar como municao. */
export const BRUISER_HURL_REACH = 3;

/**
 * De quantos em quantos ticks o guardiao recalcula a rota.
 *
 * Meio segundo: o alvo anda no maximo ~2 tiles nesse intervalo, e a busca e a
 * coisa mais cara que a simulacao faz por criatura. Recalcular a cada tick
 * gastaria vinte vezes mais para mudar quase nada na rota.
 */
export const GUARDIAN_PATH_INTERVAL_TICKS = 10;

/**
 * Cerco da segunda fase do guardiao.
 *
 * Raio 7 da uma sala de 15x15: espaco para desviar e usar o terreno, e pouco
 * para vencer andando para tras. As saidas sao poucas de proposito — elas
 * existem para que haja escolha ("abro caminho ou encaro?"), nao para que fugir
 * seja o plano obvio.
 *
 * Quatro invocados e nao dois porque o stalker anda a 5,2 contra os 4,6 do
 * jogador: dentro de um espaco fechado, sao eles que punem quem fica so
 * circulando. O guardiao segura o centro; eles cobram a orbita.
 */
export const GUARDIAN_ARENA_RADIUS = 7;
export const GUARDIAN_ARENA_EXITS = 2;
export const GUARDIAN_SUMMON_COUNT = 4;

export const BOLT_SPEED = 13; // tiles/s
export const BOLT_DAMAGE = 14;
export const BOLT_COOLDOWN_TICKS = 5;

export const ABILITY_COOLDOWN_TICKS = 120; // pulso cinetico
export const ABILITY_RADIUS = 2.6;

// ---------------------------------------------------------------------------
// Habilidades da Ressonancia do Poco
// ---------------------------------------------------------------------------
// Todas com cooldown MAIOR que o do pulso. O pulso e a habilidade inicial e
// tambem a mais fraca: ele empurra e limpa gas, mas nao mata. As outras matam, e
// por isso a janela entre usos e o que impede cada uma de virar a arma primaria.
//
// A regra de balanceamento que rege as tres: nenhuma delas pode ser melhor que o
// tiro comum em DPS sustentado. Elas resolvem SITUACOES — o grupo colado, o alvo
// que fugiu, a poca cheia de bicho —, e o custo de resolver e nao ter a resposta
// pronta de novo pelos proximos seis a nove segundos.

/** Cone de chamas: curto, largo e deixa fogo no chao. */
export const FLAMETHROWER_COOLDOWN_TICKS = 160; // 8 s
export const FLAMETHROWER_RANGE = 4.2;
/** Meia-abertura do cone, em radianos. ~35 graus para cada lado. */
export const FLAMETHROWER_ARC = 0.61;
export const FLAMETHROWER_DAMAGE = 9;

/**
 * Missil rastreador: UM, com dano alto e curva lenta.
 *
 * Um so, e nao uma salva, porque a habilidade tem de ser uma DECISAO e nao um
 * segundo gatilho. A curva lenta e o que a impede de ser infalivel: contra um
 * alvo que se move de lado ele erra, e acertar exige atirar quando o inimigo esta
 * comprometido com uma direcao.
 */
export const SEEKER_COOLDOWN_TICKS = 180; // 9 s
export const SEEKER_DAMAGE = 46;
export const SEEKER_SPEED = 7.5;
export const SEEKER_TTL = 70;
/** Quanto o missil consegue corrigir por tick, em radianos. */
export const SEEKER_TURN_RATE = 0.16;
export const SEEKER_BLAST_RADIUS = 1.6;

/** Arco condutivo: salta entre inimigos proximos, sem precisar de poca. */
export const ARC_COOLDOWN_TICKS = 140; // 7 s
export const ARC_DAMAGE = 16;
export const ARC_CHAIN_RANGE = 4.5;
export const ARC_MAX_TARGETS = 4;

/**
 * Distancia em que um Eco do poco revela a oferta, e em que ela pode ser pega.
 *
 * REVELAR e maior que PEGAR de proposito: o jogador tem de VER os dois Ecos e
 * poder comparar antes de chegar em qualquer um deles. Se a revelacao acontecesse
 * ao alcance de pegar, ele descobriria a segunda opcao depois de ja ter tomado a
 * primeira.
 */
export const WELL_OFFER_REVEAL = 7.5;
export const WELL_OFFER_REACH = 1.4;
/** Quao longe do poco os dois Ecos ficam, um de cada lado. */
export const WELL_OFFER_SPREAD = 2.4;
export const ABILITY_KNOCKBACK = 3.2;

export const PURGE_CELL_HEAL = 18;
export const PURGE_CELL_RADIUS = 3;

export const EXPLOSION_RADIUS = 2.4;
export const EXPLOSION_DAMAGE = 42;
/**
 * Quanto do proprio estrago o jogador leva de volta. Era 0.35 — um desconto de
 * 65% que tirava o risco justamente de onde ele devia estar: detonar uma nuvem
 * de enxofre colado na parede era quase de graca, e "o mundo e o inimigo
 * principal" nao sobrevive a isso. Metade do desconto, metade do dano: o numero
 * agora e legivel de cabeca no meio da luta.
 */
export const PLAYER_MODULE_FRIENDLY_DAMAGE_SCALE = 0.5;
export const EXPLOSIVE_ARM_DISTANCE = 2.25;
/**
 * Rebotes que a Lente de Ricochete concede a um tiro.
 *
 * Constante e nao literal porque agora tem DOIS leitores que precisam concordar:
 * a simulacao, que arma o projetil, e a faixa de mira do cliente, que desenha o
 * trajeto ate o ultimo quique. Uma faixa que prometesse dois rebotes num tiro de
 * um seria pior do que faixa nenhuma.
 */
export const RICOCHET_BOUNCES = 1;
export const RETURN_DISC_MAX_DISTANCE = 8;
export const RETURN_DISC_SPEED = 11;
export const SALVAGE_SCAN_TICKS = 6 * TICK_HZ;

/**
 * Quantos setores uma descida atravessa.
 *
 * Tres e o menor numero que produz um ARCO em vez de uma linha: um setor para
 * aprender o Veio do dia, um para se equipar sabendo o que enfrenta, e um para
 * o Guardiao. Com dois, o meio nao existe e o jogo vira tutorial seguido de
 * chefe. Com quatro, o terceiro repete o segundo — a run so fica mais longa, e
 * a promessa e de 12 a 20 minutos.
 *
 * Os setores 1..N-1 nao tem nucleo nem Guardiao: o objetivo neles e o POCO, e a
 * pergunta e "exploro mais ou desco agora". Apenas o ultimo tem o nucleo, o
 * Guardiao, e a viagem de volta ate a entrada.
 */
export const SECTOR_COUNT = 3;

/**
 * Quanto a contaminacao acelera a cada setor.
 *
 * Ela ATRAVESSA os setores em vez de zerar, e cresce mais rapido a cada
 * descida. Sem isso, descer seria puro ganho e a decisao de explorar mais nao
 * teria custo nenhum — a pressao tem de vir junto com a profundidade, senao o
 * arco e so mapa novo.
 */
export const CONTAMINATION_SECTOR_SCALE = 0.45;

/** Contaminacao herdada ao descer, como fracao do que havia no setor anterior. */
export const CONTAMINATION_CARRYOVER = 0.6;

export const CONTAMINATION_PER_TICK = 1 / (TICK_HZ * 60 * 14); // ~14 min ate 1.0
export const VENT_BASE_INTERVAL_TICKS = 160;

/**
 * Bispo — chefe do setor 2.
 *
 * A cura NAO e um recurso que ele gasta: e uma propriedade do lugar onde ele
 * pisa. Isso muda a pergunta da luta de "quanto dano por segundo eu faco" para
 * "de que chao eu o tiro", e usa fungo, fogo e propagacao que ja existem, sem
 * mecanica nova nenhuma.
 */
/**
 * Setor do Bispo.
 *
 * O 2 e o unico lugar onde ele cabe. No 1 o jogador ainda nao tem modulo nenhum
 * e a resposta correta (queimar o chao) depende de ferramentas que ele ainda vai
 * achar; no 3 ele dividiria a cena com o Guardiao e a run teria dois chefes
 * seguidos sem respiro entre eles. O meio da descida e onde a run precisava de
 * um evento — era o setor sem nada de proprio.
 */
export const BISHOP_SECTOR = 2;
export const BISHOP_HP = 260;
/**
 * Cura por tick sobre fungo. A 20 Hz sao 24 de vida por segundo.
 *
 * Deliberadamente ACIMA do dano sustentado do tiro base (14 por bolt a cada 5
 * ticks = 56/s, menos o tempo de mira e o calor). Em cima do fungo ele nao e
 * dificil de matar: e IMPOSSIVEL de matar por atrito. Tirar a cura tem de ser
 * uma decisao, nao uma otimizacao.
 */
export const BISHOP_REGEN_PER_TICK = 1.2;
/** Abaixo desta fracao de vida ele ABANDONA a perseguicao e busca fungo. */
export const BISHOP_RETREAT_HP_FRACTION = 0.72;
/** Ate onde ele procura chao fungico, em tiles. */
export const BISHOP_FUNGAL_SEARCH = 14;

/**
 * Supernova Fungica — a assinatura do Bispo.
 *
 * O que ela faz de verdade nao e o dano: e REPLANTAR o tapete. Sem ela, queimar
 * a arena resolvia a luta de uma vez e o resto era formalidade; com ela, o chao
 * volta e a pergunta "de que piso eu o tiro" precisa ser respondida de novo. E o
 * que transforma um truque numa luta.
 *
 * So dispara com ele FERIDO e SEM fungo por perto — e a resposta dele a ter
 * perdido o chao, e nao mais um golpe no rodizio. Assim o jogador vive a
 * sequencia inteira como causa e efeito: queimei, ele fugiu, nao achou nada,
 * plantou.
 */
export const BISHOP_NOVA_RADIUS = 5.5;
export const BISHOP_NOVA_DAMAGE = 16;
export const BISHOP_NOVA_WINDUP_TICKS = 30;
export const BISHOP_NOVA_COOLDOWN_TICKS = 420;
/** Vida do tapete replantado. Longo: ele precisa durar a luta, nao um segundo. */
export const BISHOP_NOVA_FUNGAL_TICKS = 6000;

/**
 * Cavalo Fungico — elite movel.
 *
 * O rastro e a mecanica; a investida e so o jeito de deposita-lo. Ele nao mata
 * pelo impacto, mata por ir tirando espaco da sala.
 */
export const HORSE_HP = 110;
export const HORSE_CHARGE_SPEED = 10.5;
/**
 * Telegrafo de 1,3 s — o mais longo do jogo.
 *
 * A investida cruza a sala inteira e deixa fogo permanente atras: e a unica
 * acao que muda o MAPA. Uma ameaca que altera o terreno tem de ser vista com
 * folga, senao o jogador perde a rota sem nunca ter tido a chance de escolher.
 */
export const HORSE_CHARGE_WINDUP_TICKS = 26;
export const HORSE_CHARGE_TICKS = 22;
export const HORSE_CHARGE_COOLDOWN_TICKS = 110;
export const HORSE_CHARGE_MIN_RANGE = 4;
export const HORSE_CHARGE_MAX_RANGE = 16;
/** Combustivel do rastro em chao sem material proprio, em ticks. */
export const HORSE_TRAIL_FUEL_TICKS = 40;
/**
 * De quantos ticks o fogo fica ATRAS do cavalo.
 *
 * Sem atraso, o rastro nasce sob as patas e quem foi rocado ja esta em chamas
 * antes de ver o que aconteceu. Com atraso, o cavalo passa, o jogador ve o
 * caminho que ele fez, e so entao o fogo sobe — da um instante para sair.
 */
export const HORSE_TRAIL_DELAY_TICKS = 4;
/**
 * Chance de a vaga de elite do setor ser um Cavalo.
 *
 * Nem raro nem garantido, de proposito. Garantido viraria mobilia — o jogador
 * deixa de ler a sala e passa a esperar o cavalo. Raro demais e conteudo que a
 * maioria das runs nunca ve, e um encontro que ninguem encontra nao ensina nada.
 * Perto de um terco, a run media de tres setores tem um; nao ter nenhum e ter
 * dois sao os dois lados normais disso.
 */
export const HORSE_SPAWN_CHANCE = 0.34;
/**
 * Quanto ele consegue virar por tick, em RADIANOS.
 *
 * Todo o resto do bestiario aponta para o jogador e anda naquela direcao no
 * mesmo tick, sem inercia — aceitavel num bicho pequeno e ilegivel num
 * quadrupede de 2 tiles, que lia como sprite sendo arrastado e nao como corpo
 * correndo. Virando aos poucos ele descreve um ARCO, e o arco e o que da ao
 * jogador a chance de sair pelo lado de dentro da curva: o contra-jogo natural
 * de qualquer coisa que carrega.
 *
 * 0,12 rad/tick sao ~137 graus por segundo, entao dar meia-volta custa 1,3 s.
 * Mais rapido e ele volta a girar no lugar; mais lento e ele nunca alcanca
 * ninguem entre uma investida e outra.
 */
export const HORSE_TURN_RATE = 0.12;

export const ENEMY_MIN_SPAWN_DIST = 12;
export const GUARDIAN_HP = 420;

// Co-op: estado abatido, revive e extracao coletiva.
export const MAX_PLAYERS = 2;
export const BLEEDOUT_TICKS = 20 * TICK_HZ; // ~20s abatido antes de morrer
export const REVIVE_RADIUS = 1.5;
export const REVIVE_HP_FRACTION = 0.35;
export const EXTRACT_RADIUS = 3;

export const RUN_SEED_MIX = 0x9e3779b9;

/**
 * Empoverished Miner — automato de extracao abandonado.
 *
 * O gatilho da reacao dele e o CALOR DA SUA ARMA, e nao um sorteio.
 *
 * E fisico, e nao emocional: o corpo dele esta saturado de minerio reativo e o
 * cabeamento ainda conduz corrente da grade. Calor em excesso SOBRECARREGA o
 * circuito. Ele nao fica com raiva de voce; ele entra em falha perto de voce, e
 * a falha dele e violenta.
 *
 * O sorteio era a versao obvia da ideia e violava o invariante que sustenta o
 * jogo inteiro: o jogador nunca leva dano sem sinal. Uma coisa parada que as
 * vezes vira ameaca sem nada mudar no mundo e exatamente isso — e pior, ensina
 * o jogador a destruir tudo por precaucao, que apaga o encontro.
 *
 * Com o calor, a decisao volta para quem joga, lida num medidor que ja esta no
 * HUD desde sempre:
 *
 *   frio   → ele te ignora. Passar sem incidente e possivel, e e uma escolha.
 *   morno  → ele foge. Perseguir rende o minerio dele.
 *   quente → ele ataca. Nao por escolha: a corrente que ainda o alimenta nao
 *            suporta o calor que voce trouxe.
 *
 * Note que a rota MAIS lucrativa exige esfriar antes de chegar perto — o que
 * significa parar de atirar num setor hostil. E a mesma troca de sempre: tempo
 * e seguranca contra recurso.
 */
export const MINER_NOTICE_RANGE = 7;
/**
 * Calor acima do qual ele entende que voce e uma ameaca. HEAT_MAX e 100.
 *
 * Dois tercos da barra, e nao pouco mais da metade. A 55 o limiar caia dentro do
 * calor de um combate curto qualquer, e a rota "chegar frio" sumia na pratica —
 * o jogador chegava enfurecendo sem ter escolhido isso, que e o oposto do ponto.
 * Em 66,6 e preciso ter atirado com vontade para cruza-lo.
 */
export const MINER_RAGE_HEAT = 66.6;
/** Abaixo disto ele nem levanta a cabeca. */
export const MINER_FEAR_HEAT = 8;
export const MINER_HP = 34;
export const MINER_FLEE_SPEED = 4.9;
export const MINER_RAGE_SPEED = 3.6;
/**
 * Cleave de picareta: circular em volta DELE, e nao um golpe direcional.
 *
 * Circular porque a resposta certa e RECUAR, nao circular por tras. Um golpe
 * frontal ensinaria a orbitar, que e o que o jogador ja faz com todo o resto —
 * o miner enfurecido existe para punir quem entra em cima.
 */
export const MINER_CLEAVE_RADIUS = 2.3;
export const MINER_CLEAVE_DAMAGE = 19;
export const MINER_CLEAVE_WINDUP_TICKS = 14;
export const MINER_CLEAVE_COOLDOWN_TICKS = 40;
/** A carga que ele ainda estava transportando, e que voce leva se o destruir. */
export const MINER_ORE_DROP = 6;
/** Quantos mineradores por setor, no maximo. */
export const MINER_PER_SECTOR = 3;
/** Distancia minima de um no de minerio para ele nascer ali. */
export const MINER_ORE_SEARCH = 6;

/**
 * Lascas de minerio por recompensa de modulo.
 *
 * A cota precisava de um BENEFICIO concreto, e nao de um numero bonito no fim.
 * Modulo e a moeda que o jogo ja usa para pagar risco (salvage), entao pagar
 * mineracao com a mesma moeda mantem as duas atividades comparaveis: vale mais
 * a pena abrir aquele terminal ou arrancar aquele veio?
 *
 * 14 e cerca de dois veios inteiros. Baixo demais e minerar vira a estrategia
 * unica; alto demais e ninguem chega la dentro do tempo-alvo.
 */
export const ORE_PER_MODULE = 14;
