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

/**
 * SILICA SOLTA (id 13) e VIDRO (id 14) — as duas materias do Devorador Branco.
 *
 * Append-only, como toda superficie: os ids viajam nos diffs de chunk e nao
 * podem mudar de significado.
 *
 * A silica solta e o RASTRO dele: onde o verme passou por baixo, o chao cedeu e
 * virou areia instavel. Ela e inerte para tudo — nao conduz, nao machuca, nao
 * retarda — e faz uma coisa so: e por ela que ele consegue emergir.
 *
 * O VIDRO e o que sobra quando alguem poe calor na silica solta. Tambem inerte,
 * tambem faz uma coisa so, e e a inversa: por cima de vidro ele NAO sobe.
 *
 * As duas juntas sao o encontro inteiro. O rastro dele e ao mesmo tempo o aviso
 * de por onde ele anda E a municao do contra-jogo: queimar o proprio caminho
 * dele fecha o chao por onde ele viria. O jogador nao aprende isso num tutorial
 * — aprende vendo a areia virar vidro na primeira vez que o fogo passa por ela.
 */
export const SURF_SILT = 13;
export const SURF_GLASS = 14;

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

/**
 * Salva Litoclasta — a resposta a distancia do Guardiao.
 *
 * Ele dividia o ramo generico de ataque a distancia com o Spitter e criava UM
 * projetil de gosma que deixava biofluido — visual e mecanicamente, o chefe das
 * Galerias de Basalto estava cuspindo. Agora ele arranca materia da propria
 * arena e dispara um LEQUE de tres pedras: a central mira a posicao prevista do
 * jogador (intercept sem homing, como a do Britador) e as laterais abrem um
 * pequeno angulo. O leque cria tres corredores legiveis — melhor que tres tiros
 * sequenciais perfeitos, que so testariam paciencia.
 *
 * As pedras sao `kind: 'rock'`: colidem com parede solida, quebram parede
 * fragil (a classe cinetica ja faz isso em impactSolid), tem hitbox visivel
 * (raio proprio) e NAO deixam biofluido — quem suja o chao e o cuspidor, e as
 * duas ameacas continuam querendo dizer coisas diferentes. Tambem nao atordoam:
 * o stun de pedra e a assinatura do arremesso unico do Britador, e tres pedras
 * encadeando atordoamento seria um stun-lock sem resposta.
 */
/** Mais lenta que o cuspe (7): a pedra e lida pelo corredor, nao pela pressa. */
export const GUARDIAN_ROCK_SPEED = 6;
export const GUARDIAN_ROCK_DAMAGE = 14;
/** Corpo visivel da pedra, entre o cuspe (0,2) e o bloco do Britador (0,46). */
export const GUARDIAN_ROCK_RADIUS = 0.42;
/** Distancia de voo, com a mesma margem para alvo em fuga do Britador. */
export const GUARDIAN_ROCK_FLIGHT_TILES = 14;
/** Meia-abertura do leque, em radianos (~22 graus por lado). */
export const GUARDIAN_FAN_SPREAD = 0.38;
/**
 * Segunda fase (abaixo de 50% de vida): ele ALTERNA o leque com uma RAJADA de
 * tres pedras em sequencia, com pequenos intervalos e correcao de mira entre os
 * disparos — o leque nega espaco, a rajada persegue movimento.
 */
export const GUARDIAN_VOLLEY_SHOTS = 3;
export const GUARDIAN_VOLLEY_INTERVAL_TICKS = 7;
/** Recarga da salva (leque ou rajada). O valor historico do ranged dele. */
export const GUARDIAN_SALVO_COOLDOWN_TICKS = 44;

// ---------------------------------------------------------------------------
// DIAMANDIS — o chefe da Cicatriz Aurix
// ---------------------------------------------------------------------------
/**
 * Projeto DIAMANDIS: o maior equipamento de escavacao autonoma que a Aurix
 * construiu, dez vezes um Prospector, abandonado no fundo porque recupera-lo
 * custava mais que o programa inteiro. Ele nao parou de funcionar — parou de
 * executar a tarefa que a Aurix dizia ter lhe dado.
 *
 * A regra que rege as tres armas dele: NENHUMA e militar. Sao ferramentas
 * industriais aplicadas com indiferenca — uma broca de avanco, cargas de
 * implosao de teto e um feixe de prospeccao. E o que separa o encontro de "um
 * robo grande atira em voce": o Diamandis nao esta lutando, esta TRABALHANDO,
 * e o jogador esta no caminho da obra.
 *
 * VIDA alta e corpo MODERADO, de proposito. Visualmente ele e uma fabrica
 * ambulante; mecanicamente uma hitbox gigante transformaria toda parede em
 * gaiola e todo tiro em acerto garantido. O tamanho mora no sprite e no
 * ESTRAGO que ele deixa, nunca no raio de colisao.
 */
export const DIAMANDIS_HP = 880;
export const DIAMANDIS_SPEED = 1.5;
export const DIAMANDIS_RADIUS = 0.9;

/**
 * BROCA DE AVANCO. Ele fixa uma direcao, carrega e ATRAVESSA a arena.
 *
 * Diferente da investida do Corcel em tudo o que importa: bater na pedra nao
 * encerra a acao — a pedra e que acaba. Abre um corredor de
 * `DIAMANDIS_DRILL_WIDTH` celulas, derruba rocha e fragil e deixa minerio e
 * cristal DE PE (e `canRip` que decide, a mesma regra do Britador), entao a
 * passagem dele expoe veio que estava emparedado. A luta altera a geometria da
 * sala em definitivo — e essa alteracao e recompensa e perigo ao mesmo tempo.
 */
export const DIAMANDIS_DRILL_WINDUP_TICKS = 36; // 1,8 s parado: a obra avisa
export const DIAMANDIS_DRILL_TICKS = 46;
export const DIAMANDIS_DRILL_SPEED = 7.5;
export const DIAMANDIS_DRILL_COOLDOWN_TICKS = 190;
/**
 * As tres ferramentas tem FAIXAS que nao se engolem, e a ordem de leitura da
 * IA e a mesma: longe -> broca, medio -> demolicao, perto -> feixe.
 *
 * A primeira versao deixou a broca comecando em 5 e a demolicao cobrindo
 * 0..13: como a broca e checada primeiro, ela vencia em toda distancia util e
 * a salva simplesmente nunca saia. Faixa que so existe no comentario nao e
 * faixa.
 */
export const DIAMANDIS_DRILL_MIN_RANGE = 9;
export const DIAMANDIS_DRILL_MAX_RANGE = 20;
export const DIAMANDIS_DRILL_DAMAGE = 34;
/** Meia-largura do corredor, em celulas: 1 => um vao de 3. */
export const DIAMANDIS_DRILL_WIDTH = 1;

/**
 * SALVA DE DEMOLICAO. Tres cargas caem em areas MARCADAS.
 *
 * Nao sao misseis: sao as cargas industriais de implodir teto e fraturar veio,
 * e a linguagem corporativa insiste que o Diamandis nunca foi armado. As
 * marcas nascem no INICIO do telegrafo, sobre a posicao do jogador naquele
 * instante, e nao se corrigem — sair do circulo e a resposta inteira, e ela so
 * existe porque a marca nao persegue.
 */
export const DIAMANDIS_DEMOLISH_WINDUP_TICKS = 34;
export const DIAMANDIS_DEMOLISH_COOLDOWN_TICKS = 150;
export const DIAMANDIS_DEMOLISH_RANGE = 13;
export const DIAMANDIS_DEMOLISH_MIN_RANGE = 4;
export const DIAMANDIS_DEMOLISH_CHARGES = 3;
export const DIAMANDIS_DEMOLISH_RADIUS = 2.6;
/** Quanto as duas cargas laterais se afastam da central, em tiles. */
export const DIAMANDIS_DEMOLISH_SPREAD = 3.2;

/**
 * FEIXE DE PROSPECCAO. Uma linha de levantamento que depois SOBE de potencia.
 *
 * A ordem importa e e o encontro inteiro: primeiro ele varre, e a varredura
 * nao machuca ninguem — e um scanner fazendo o trabalho dele. So no release o
 * feixe ganha potencia, e ai ele aquece fungo, acende gas, derrete gelo,
 * energiza minerio e queima quem estiver na linha. E uma ferramenta industrial
 * aplicada com indiferenca, nao uma arma: o dano e efeito colateral de uma
 * medicao.
 */
export const DIAMANDIS_BEAM_WINDUP_TICKS = 40; // 2 s de linha de levantamento
export const DIAMANDIS_BEAM_COOLDOWN_TICKS = 170;
export const DIAMANDIS_BEAM_LENGTH = 16;
export const DIAMANDIS_BEAM_DAMAGE = 26;
/** Passo da amostragem da linha: menor que meia celula nao pula parede. */
export const DIAMANDIS_BEAM_STEP = 0.25;

/**
 * COLAPSO DO REATOR, abaixo de metade da vida.
 *
 * A luta deixa de ser "uma maquina controlada" e vira "uma instalacao
 * industrial desabando em volta do jogador". O que acontece e deterministico e
 * legivel, e nao um sorteio de cadencia:
 *
 *   - o reator VAZA: brasa nasce em volta dele no instante do colapso, e
 *     continua nascendo sob os rastos enquanto ele anda;
 *   - um sistema DESLIGA: o feixe de prospeccao morre (o scanner e a primeira
 *     coisa a cair quando a alimentacao entra em colapso);
 *   - os outros OPERAM ACIMA DO LIMITE: broca e demolicao recarregam mais
 *     rapido.
 *
 * "Cadencia irregular" por sorteio seria dano sem sinal, que e justamente o
 * que o jogo proibe. Cadencia MAIOR com uma arma a menos e a mesma sensacao,
 * legivel e ensinavel.
 */
export const DIAMANDIS_REACTOR_HP_FRACTION = 0.5;
export const DIAMANDIS_REACTOR_EMBER_RADIUS = 5;
export const DIAMANDIS_REACTOR_EMBER_TICKS = 900;
/** Fator de recarga das armas que sobrevivem ao colapso. */
export const DIAMANDIS_REACTOR_CADENCE_SCALE = 0.65;

/**
 * OS MODULOS, e os Coveiros em volta deles.
 *
 * E o detalhe que transforma o encontro de bom em memoravel, e ele nao e um
 * golpe: e uma ESCOLHA que o jogador faz enquanto luta.
 *
 * Cada arma do Diamandis mora num modulo preso a carcaca. Conforme a vida cai,
 * o modulo daquela arma se SOLTA (fica exposto, ainda presol). Um Coveiro que
 * enxergue um modulo solto abandona o que estiver fazendo, conecta o
 * eletroima e o ARRANCA — e ai carrega a peca para fora do mapa.
 *
 * Os Coveiros nao sao minions do chefe e nao estao ajudando o jogador. Eles
 * continuam executando o trabalho para o qual foram deixados ali: recolher
 * sucata de equipamento abatido. O Diamandis so ainda nao esta abatido.
 *
 * A escolha, e os dois lados sao legitimos:
 *
 *   DEIXAR TRABALHAR  o modulo sai, o Diamandis PERDE aquela arma (a luta
 *                     fica mais facil) e a peca comeca a ir embora — se
 *                     escapar do mapa, a recompensa vai junto.
 *   MATAR O COVEIRO   antes do arranque, o modulo continua presol e a arma
 *                     continua funcionando (a luta fica mais longa), e a
 *                     sucata fica garantida no abate do chefe. Depois do
 *                     arranque, matar o carregador derruba a peca de volta e
 *                     ela ainda pode ser sua.
 */
export const DIAMANDIS_MODULE_COUNT = 3;
/**
 * Em que fracao de vida cada modulo se solta, na ORDEM em que se soltam.
 *
 * A ordem e fixa e nao sorteada porque ela e ensinavel: quem lutou uma vez
 * sabe que a broca sai primeiro. E ela vai da arma de maior alcance para a de
 * menor, entao o cerco em volta do chefe vai FECHANDO — perder a broca cedo
 * significa que a luta termina de perto, que e onde o corpo dele cobra caro.
 */
export const DIAMANDIS_MODULE_EXPOSE_AT: readonly number[] = [0.78, 0.55, 0.3];
/** Lascas por modulo preservado. Vale um veio inteiro: e uma decisao, nao um troco. */
export const DIAMANDIS_MODULE_ORE = 16;
/** Ate onde um Coveiro NOTA um modulo solto — bem alem do aggro dele. */
export const UNDERTAKER_SALVAGE_RANGE = 20;
/** Distancia em que ele consegue engatar o eletroima na carcaca. */
export const UNDERTAKER_SALVAGE_REACH = 2.2;
/** O engate: 2 s de eletroima carregando contra a blindagem, telegrafados. */
export const UNDERTAKER_SALVAGE_WINDUP_TICKS = 40;
/**
 * A que distancia da carcaça a peca esta FORA DE ALCANCE.
 *
 * "Sair do mapa" era o criterio obvio e estava errado: o carregador nao come
 * minerio (recurso do jogador, mesma regra da broca), entao um veio no caminho
 * o encalhava — medido na seed 404, ele parava em x=85 de um mapa de 96 e
 * ficava ali pelo resto da run. Com uma PORTA como criterio, "deixar
 * trabalhar" virava "espere, ele empaca", e o preco de nao interceptar nunca
 * chegava a ser cobrado.
 *
 * Distancia resolve isso sem pathfinding e diz a coisa certa: a peca se perde
 * quando sai da luta, e nao quando cruza uma linha desenhada na borda. A borda
 * continua valendo, para quem escapa de verdade.
 */
export const UNDERTAKER_SALVAGE_ESCAPE_DIST = 24;

// ---------------------------------------------------------------------------
// DEVORADOR BRANCO — o chefe dos Sumidouros de Silica
// ---------------------------------------------------------------------------
/**
 * O grande verme subterraneo. Ou o que quer que seja: a quantidade de materia
 * organica do estrato nao sustentaria um corpo daquele tamanho, e a hipotese
 * que os documentos acabam formulando e outra — ele nao atravessa a silica, a
 * silica assume temporariamente a forma dele.
 *
 * O ciclo e um so e nunca muda: MERGULHA, deixa faixa de silica solta enquanto
 * anda por baixo, calcula onde o jogador vai estar, EMERGE ali. Submerso ele e
 * quase invulneravel; a janela de dano e o tempo em que fica na superficie
 * depois de emergir.
 *
 * O contra-jogo nao esta escrito em lugar nenhum: esta no fato de o rastro dele
 * ser silica solta, e de calor virar silica solta em vidro. Quem entende
 * transforma o chao instavel em vidro e passa a DECIDIR por onde ele pode sair.
 */
export const DEVOURER_HP = 760;
/** Submerso ele desliza. E o unico deslocamento por velocidade que ele tem. */
export const DEVOURER_BURROW_SPEED = 4.6;
/**
 * Sobra do tempo em que ele perseguia a pe depois de emergir.
 *
 * Nao move mais nada: fora do mergulho ele esta no ar (conduzido pelo arco) ou
 * entalado (parado). Continua aqui porque `ARCHETYPES` exige um `speed` por
 * arquetipo, e um zero ali diria "fixo como o Pulmao", que e outra coisa.
 */
export const DEVOURER_SURFACE_SPEED = 1.6;
export const DEVOURER_RADIUS = 0.8;
/**
 * Quanto do dano a areia absorve enquanto ele esta por baixo.
 *
 * Reducao, e nao imunidade — a mesma escolha da couraça do Escoriaceo. Imune
 * ensinaria "guarde a municao e espere", que e a ausencia de jogo; a 12% o tiro
 * durante o mergulho vale a pena o bastante para atirar no rastro ser uma
 * jogada, e pouco o bastante para a janela de superficie continuar sendo A
 * janela.
 */
export const DEVOURER_BURROWED_ARMOR = 0.12;
/**
 * A RAJADA e a JANELA.
 *
 * O ciclo dele nao e um golpe seguido de descanso: sao TRES arcos mirados em
 * sequencia e so entao a abertura. Um salto por ciclo dava um chefe que
 * alternava ameaca e folga em ritmo constante, e ritmo constante e a coisa que
 * um encontro de chefe menos pode ter — a pressao precisa SUBIR ate obrigar o
 * jogador a errar, e a recompensa por sobreviver a ela precisa ser um alvo
 * parado.
 *
 * Entre um salto e o proximo ele mergulha por pouco tempo: o suficiente para o
 * rastro dizer de onde vem o proximo arco, e curto o bastante para os tres
 * lerem como UMA rajada e nao como tres ataques separados.
 */
export const DEVOURER_LEAPS_PER_CYCLE = 3;
export const DEVOURER_HOP_GAP_TICKS = 25;
/**
 * PRESO: a janela de dano do encontro inteiro.
 *
 * Ele entala meio enterrado no proprio buraco no fim da rajada — nao anda, nao
 * cobra contato e nao tem areia absorvendo tiro. 7,5 s e longo de proposito: e
 * a unica abertura do ciclo, e ela paga tres arcos esquivados.
 *
 * O total de exposicao por ciclo fica proximo do que existia antes (~60% contra
 * ~58%), mas concentrado num lugar so. E essa concentracao que transforma "vou
 * chipando dano quando der" em "guardei o superaquecimento para AGORA".
 */
export const DEVOURER_STUCK_TICKS = 150;
/** E quanto tempo passa por baixo antes de tentar sair de novo. */
export const DEVOURER_BURROW_MIN_TICKS = 70;
/**
 * O telegrafo da emergencia: 1,2 s de chao rachando no ponto marcado.
 *
 * Mais curto que o do Corcel (1,3 s) e o da broca (1,8 s) de proposito: a marca
 * dele aparece SOB o jogador, e a distancia a percorrer para sair dela e um
 * passo. O que custa aqui nao e o tempo, e perceber.
 */
export const DEVOURER_ERUPT_WINDUP_TICKS = 24;
export const DEVOURER_ERUPT_RADIUS = 2.8;
export const DEVOURER_ERUPT_DAMAGE = 30;
/** Ate onde ele procura chao valido quando o alvo esta sobre vidro. */
export const DEVOURER_ERUPT_SEARCH = 6;

/**
 * O SALTO. A emergencia nao e um ponto, e um ARCO.
 *
 * Ele nao sobe onde esta: recua por baixo ate um ponto de DECOLAGEM, rompe o
 * chao ali e atravessa o ar em parabola ate a queda, que e o ponto mirado. Duas
 * crateras por ciclo, uma em cada ponta, e nada no meio — passar por baixo do
 * arco nao machuca. A regra que o jogador aprende e limpa: saia das duas
 * marcas, e o intervalo entre elas e seu.
 *
 * O que isso muda no ENCONTRO, e a razao de existir: no ar nao ha areia entre a
 * bala e o corpo, entao o dano entra inteiro. E o comprimento do arco nao e
 * dele — e seu. Ele so decola de chao solto, entao vitrificar em volta de si
 * empurra a decolagem para longe, e decolagem longe e voo longo, e voo longo e
 * tiro de graca. O contra-jogo do vidro deixa de ser so "negar a saida" e passa
 * a ser "esticar a trajetoria": a mesma materia, agora com duas alavancas.
 *
 * O minimo existe porque um arco curto nao se le como arco — sem distancia nao
 * ha silhueta subindo, so um corpo pulando no lugar. O maximo existe porque o
 * voo e tempo de invulnerabilidade zero, e um arco de meia arena viraria a luta
 * inteira num tiro ao alvo.
 */
export const DEVOURER_LEAP_MIN_RANGE = 5;
export const DEVOURER_LEAP_MAX_RANGE = 11;
/** Bem mais rapido que o mergulho: um salto nao e uma caminhada. */
export const DEVOURER_LEAP_SPEED = 9;
/**
 * Ate onde ele procura chao de decolagem valido em volta do ponto ideal.
 *
 * Menor que a busca da queda de proposito. Recusar a QUEDA e o premio do
 * jogador e tem de ser dificil de conseguir; recusar a DECOLAGEM e um bonus
 * do mesmo trabalho, e se as duas buscas fossem igualmente teimosas o vidro
 * perto do corpo dele quase nunca contaria.
 */
export const DEVOURER_LAUNCH_SEARCH = 3;
/**
 * Quanto cada salto da rajada gira em volta do alvo, em radianos (~120 graus).
 *
 * Existe por dois motivos, e o segundo foi um defeito medido. O primeiro e de
 * desenho: tres arcos vindo sempre do mesmo lado sao o mesmo ataque repetido, e
 * girar faz a rajada CERCAR o jogador — a cada pouso o proximo vem de outra
 * direcao, e ficar parado deixa de ser uma opcao.
 *
 * O segundo e que a direcao de recuo DEGENERA. Ela sai de (posicao - queda), e
 * o pouso e mirado no jogador: parado o alvo, o verme cai exatamente em cima
 * dele e a subtracao da (0,0). Medido, o resultado era um arco de comprimento
 * zero — decolagem e queda no MESMO tick, sem voo, sem janela de dano no ar, e
 * a rajada de tres virava uma de um. Girar por um angulo fixo garante uma
 * direcao valida mesmo quando nao ha de onde tirar uma.
 */
export const DEVOURER_LEAP_TURN = 2.1;
/**
 * Dano da decolagem, mais baixo que o da queda.
 *
 * A queda e mirada em voce; a decolagem acontece longe, num ponto que ele
 * escolheu por ser chao solto. Cobrar o mesmo pelas duas puniria estar perto de
 * um lugar que o jogo nunca prometeu que seria seguro.
 */
export const DEVOURER_LAUNCH_DAMAGE = 18;
/** Quanto a mira antecipa o movimento do alvo, em segundos. */
export const DEVOURER_LEAD_SECONDS = 0.9;
/** Meia-largura da faixa de silica que o mergulho deixa. */
export const DEVOURER_TRAIL_WIDTH = 1;

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
 * Duracao da CANALIZACAO do sopro. O lanca-chamas nao e mais um cast de tick
 * unico: ele expele chama continuamente por esta janela, seguindo a mira a cada
 * emissao. Valor inicial de balanceamento — ajustar AQUI muda a habilidade
 * inteira, incluindo o telegrafo (`action_start.endTick`) e o bloqueio do bolt.
 */
export const FLAMETHROWER_CHANNEL_TICKS = Math.round(2.5 * TICK_HZ); // 2,5 s
/** Intervalo entre emissoes durante a canalizacao. */
export const FLAMETHROWER_EMIT_INTERVAL_TICKS = 2;
/**
 * Dano POR EMISSAO em criaturas dentro do cone. O total sustentado (canal
 * inteiro, alvo parado no fogo) fica em ~`CHANNEL/INTERVAL * este valor`, alem
 * do fogo que persiste no chao — mais que os 9 do antigo golpe unico, mas pago
 * em 2,5 s de compromisso com a postura.
 */
export const FLAMETHROWER_EMISSION_DAMAGE = 1.2;
/**
 * Passo, em tiles, da amostragem de linha-de-visada do sopro. Menor que meia
 * celula para uma parede de um tile nunca ser saltada entre duas amostras.
 */
export const FLAMETHROWER_LOS_STEP = 0.25;

/**
 * Drone rastreador: UM quadricoptero kamikaze, com dano alto e curva lenta.
 *
 * Um so, e nao uma salva, porque a habilidade tem de ser uma DECISAO e nao um
 * segundo gatilho. A curva lenta e o que o impede de ser infalivel: contra um
 * alvo que se move de lado ele erra, e acertar exige lancar quando o inimigo
 * esta comprometido com uma direcao.
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
 * Bispo — o chefe de qualquer mapa profundamente ocupado pelo micelio.
 *
 * Ele deixou de ser "o chefe obrigatorio do setor 2": a escolha de chefe agora
 * sai de `bossForBiome` (bosses.ts) — uma ocupacao forte substitui o chefe do
 * estrato, e a Matriz Micelial e uma ocupacao forte. So o setor FINAL da
 * linhagem tem chefe; um chefe por setor fragmentaria a run inteira.
 *
 * A cura NAO e um recurso que ele gasta: e uma propriedade do lugar onde ele
 * pisa. Isso muda a pergunta da luta de "quanto dano por segundo eu faco" para
 * "de que chao eu o tiro", e usa fungo, fogo e propagacao que ja existem, sem
 * mecanica nova nenhuma.
 */
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
 * De quao perto uma coisa conta como TESTEMUNHADA.
 *
 * Um raio so para todas as Descobertas que exigem presenca — a cura do Bispo,
 * a galeria que a broca abre, o modulo que o Coveiro arranca. Um pouco alem do
 * aggro dos chefes (10): quem esta trocando tiro ve, quem passou por outro
 * corredor nao. Os documentos que estes bits abrem sao relatorios de CAMPO, e
 * campo pressupoe alguem la.
 *
 * Um numero, e nao um por bicho: o criterio e o mesmo em todos os casos, e
 * tres copias divergiriam no primeiro ajuste.
 */
export const WITNESS_RANGE = 12;

/**
 * Supernova Fungica — a assinatura e a PRINCIPAL resposta a distancia do Bispo.
 *
 * O que ela faz de verdade nao e o dano: e REPLANTAR o tapete. Sem ela, queimar
 * a arena resolvia a luta de uma vez e o resto era formalidade; com ela, o chao
 * volta e a pergunta "de que piso eu o tiro" precisa ser respondida de novo. E o
 * que transforma um truque numa luta.
 *
 * Ela sai por DOIS caminhos, e os dois sao legiveis:
 *
 * 1. Em luta normal: jogador dentro do raio, cooldown pronto — o telegrafo
 *    radial de 1,5 s e o aviso, e sair do disco e a resposta. O Bispo NAO tem
 *    mais o cuspe generico do Spitter: um chefe do chao nao atira gosma.
 * 2. Ferido e sem conseguir PISAR em fungo dentro de uma janela curta
 *    (BISHOP_NOVA_SEEK_TICKS). A regra antiga era "nenhum fungo detectavel em
 *    14 tiles", e uma unica celula atras de uma parede bloqueava a Supernova
 *    para sempre: ele recuava eternamente para um tapete inalcancavel enquanto
 *    cuspia gosma. A janela mede o que importa — ele CHEGOU ao fungo? — e nao o
 *    que a varredura enxerga.
 *
 * O fungo e replantado somente no RELEASE, nunca no windup: o jogador que
 * queimou o tapete ve o proprio incendio ate o ultimo instante do aviso.
 */
export const BISHOP_NOVA_RADIUS = 5.5;
export const BISHOP_NOVA_DAMAGE = 16;
export const BISHOP_NOVA_WINDUP_TICKS = 30;
/**
 * Recarga da Supernova. Era 420 quando ela so existia como replantio de
 * emergencia; como resposta primaria a distancia, 15 s mantem o rodizio da
 * luta (uma nova por "fase" de queima do tapete) sem virar metralhadora de
 * area — o windup de 1,5 s continua sendo a unica coisa que a torna justa.
 */
export const BISHOP_NOVA_COOLDOWN_TICKS = 300;
/**
 * A janela de busca por chao vivo (4 s). Ferido e fora do fungo, ele recua em
 * direcao a area viva mais proxima; se a janela fecha sem ele ter PISADO em
 * fungo — parede no caminho, tapete comido pelo fogo, celula isolada — a
 * Supernova sai. Curta de proposito: mais que isso e um chefe fugindo da
 * propria luta.
 */
export const BISHOP_NOVA_SEEK_TICKS = 80;
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
 * Minerio NAO paga modulo.
 *
 * Ele pagava: cada 14 lascas rendiam uma escolha, a mesma moeda com que o
 * salvage paga risco. A ideia era manter as duas atividades comparaveis dentro
 * da run, e o problema era justamente esse — mineracao e salvage viravam duas
 * torneiras da mesma economia, e minerar era uma forma mais lenta de abrir um
 * cofre.
 *
 * Agora cada sistema tem uma funcao so: salvage paga modulo, Eco paga
 * habilidade, minerio paga a PROXIMA run (Matriz Geracional) e o nucleo paga o
 * que o minerio sozinho nao compra. Ver `progression.ts` e a spec de 2026-08-02.
 */

/**
 * Carga minima para que morrer com ela vire descoberta.
 *
 * Cerca de tres veios. Abaixo disso a morte nao ensina a licao — perder duas
 * lascas nao e perder uma carga, e uma descoberta que dispara na primeira morte
 * de qualquer run deixa de ser descoberta.
 */
export const CARGO_LOST_DISCOVERY_ORE = 20;

/**
 * Em que contaminacao cada onda dispara, e quantos bichos ela traz.
 *
 * Exportado, e nao um literal dentro de `stepContamination`, porque a
 * apresentacao precisa do mesmo numero: a previsao de onda (SV-X) desenha o
 * progresso ate o proximo limiar. A primeira versao dela COPIOU a escada e
 * copiou errado — inventou um degrau em 0,12 que a simulacao nao tem —, e o
 * teste que deveria travar as duas comparava a copia com um literal dela mesma.
 *
 * Uma constante compartilhada elimina a classe inteira do problema: nao ha o que
 * divergir.
 */
export const CONTAMINATION_WAVES: readonly (readonly [level: number, count: number])[] = [
  [0.35, 2],
  [0.6, 3],
  [0.85, 4],
];

// ---------------------------------------------------------------------------
// OS CHEFES DE ESTRATO: um dono para cada geologia
// ---------------------------------------------------------------------------
// A regra que rege os seis: nenhum inventa sistema novo. Cada um opera, em
// escala de chefe, a alavanca que o proprio estrato ja tem — cristal que
// descarrega, agua que conduz, gas que ocupa espaco, brasa que aquece, gelo que
// derrete, minerio que atrai. E a mesma regra do bestiario de assinatura, e ela
// vale ainda mais aqui: um chefe que trouxesse mecanica propria seria um chefe
// que poderia estar em qualquer mapa.

/**
 * ARQUICANTOR (Catedral Prismatica) — a formacao cristalina articulada.
 *
 * Ele nao atira: CANTA, e a sala responde. O pulso arma todo cristal ao alcance
 * e cada um descarrega pelas aberturas coladas nele — a mesma regra do
 * Ressonante, na escala da nave inteira.
 *
 * O contra-jogo e uma decisao de quanto destruir: cristal quebrado antes do
 * pulso e um cristal que nao canta, mas a Catedral tambem e a iluminacao e o
 * recurso do setor. O jogador decide quanto da catedral apagar para sobreviver
 * a ela.
 */
export const ARCHCANTOR_HP = 620;
export const ARCHCANTOR_PULSE_RADIUS = 9;
export const ARCHCANTOR_CRYSTAL_BUDGET = 26;
export const ARCHCANTOR_WINDUP_TICKS = 34;
export const ARCHCANTOR_COOLDOWN_TICKS = 150;
/** Quanto a rede vazia o enfraquece: sem cristal, o canto nao tem quem responda. */
export const ARCHCANTOR_SILENT_ARMOR = 1.5;

/**
 * LEVIATA DO LENCOL (Aquifero Negro) — o corpo que se move sob a agua.
 *
 * Mesma gramatica do Devorador Branco, outro elemento e outro contra-jogo: ele
 * so anda e so emerge por superficie CONDUTIVA, e o que o detem nao e negar o
 * chao — e eletrificar a agua. A descarga o atordoa pela regra generica que ja
 * existe, e eletrifica a regiao inteira junto: o preco de para-lo e o mesmo
 * meio ficar mortal para quem o parou.
 */
export const LEVIATHAN_HP = 800;
export const LEVIATHAN_SWIM_SPEED = 5;
export const LEVIATHAN_SURFACE_SPEED = 1.8;
export const LEVIATHAN_RADIUS = 0.85;
export const LEVIATHAN_SUBMERGED_ARMOR = 0.15;
export const LEVIATHAN_SURFACE_TICKS = 100;
export const LEVIATHAN_DIVE_MIN_TICKS = 60;
export const LEVIATHAN_BREACH_WINDUP_TICKS = 26;
export const LEVIATHAN_BREACH_RADIUS = 3;
export const LEVIATHAN_BREACH_DAMAGE = 28;
export const LEVIATHAN_BREACH_SEARCH = 7;
export const LEVIATHAN_LEAD_SECONDS = 0.8;

/**
 * PULMAO-MATRIZ (Fenda Sulfurosa) — o orgao que faz o estrato respirar.
 *
 * FIXO: ele nao persegue ninguem, esta ancorado nos respiradouros. Inspira o
 * gas da arena (abrindo zonas temporariamente seguras) e o expele em outra
 * direcao. Quem entende a respiracao ganha rota; quem nao entende descobre que
 * a passagem limpa de agora e a camara contaminada de daqui a pouco.
 *
 * O contra-jogo e incendiar a expiracao: o fogo sobe pela coluna de gas ate
 * ele e machuca de verdade — e transforma parte da arena em fogo. Ele e o unico
 * chefe do jogo cuja janela de dano o JOGADOR abre, e ela custa terreno.
 */
export const LUNG_MATRIX_HP = 700;
export const LUNG_MATRIX_RADIUS = 0.9;
export const LUNG_MATRIX_CYCLE_TICKS = 130;
export const LUNG_MATRIX_BREATH_INTERVAL_TICKS = 10;
export const LUNG_MATRIX_INHALE_RADIUS = 7;
export const LUNG_MATRIX_INHALE_PER_BREATH = 10;
export const LUNG_MATRIX_EXHALE_LENGTH = 12;
export const LUNG_MATRIX_EXHALE_WIDTH = 1;
/** Dano por celula de gas acesa encostada nele durante a expiracao. */
export const LUNG_MATRIX_BURN_DAMAGE = 26;

/**
 * CORACAO DA FORNALHA (Fornalha Abissal) — o nucleo igneo parcialmente exposto.
 *
 * FIXO, como o Pulmao: a luta nao e contra um corpo, e contra a sala. Ele
 * alterna SUPERAQUECIMENTO (blindado, e as fissuras da arena acendem em
 * sequencia) e RESFRIAMENTO (vulneravel, e a sala esfria junto).
 *
 * So fica vulneravel no resfriamento, e essa e a leitura inteira: o jogador nao
 * escolhe quando bater, escolhe onde estar quando puder.
 */
export const FURNACE_HEART_HP = 900;
export const FURNACE_HEART_RADIUS = 1;
export const FURNACE_HEART_CYCLE_TICKS = 150;
export const FURNACE_HEART_HOT_ARMOR = 0.2;
export const FURNACE_HEART_WAVE_RADIUS = 8;
export const FURNACE_HEART_WAVE_INTERVAL_TICKS = 12;
/** Meia-abertura do setor que acende por vez, em radianos (~60 graus). */
export const FURNACE_HEART_WAVE_ARC = 0.52;

/**
 * RAINHA DA GEADA (Cripta Glacial) — a figura de gelo, nevoa e reflexos.
 *
 * A couraça dela e o proprio estrato: enquanto houver gelo em volta, o dano
 * quase nao entra. Derreter o lago a expoe — e a agua que sobra e condutiva,
 * entao o jogador que a revela transforma o chao em algo que a descarga dele
 * atravessa nos dois sentidos.
 *
 * Os Espectros nao sao invocados como matilha: sao EXTENSOES dela, e por isso
 * saem do gelo em volta e nao dela.
 */
export const FROST_QUEEN_HP = 640;
export const FROST_QUEEN_SPEED = 2.4;
export const FROST_QUEEN_RADIUS = 0.7;
export const FROST_QUEEN_ICE_ARMOR = 0.22;
/** Quantas celulas de gelo em volta ainda a mantem blindada. */
export const FROST_QUEEN_ICE_RADIUS = 5;
export const FROST_QUEEN_ICE_THRESHOLD = 6;
export const FROST_QUEEN_FREEZE_COOLDOWN_TICKS = 120;
export const FROST_QUEEN_FREEZE_WINDUP_TICKS = 26;
export const FROST_QUEEN_FREEZE_RADIUS = 6;
export const FROST_QUEEN_WRAITHS = 2;
export const FROST_QUEEN_WRAITH_HP_FRACTION = 0.6;

/**
 * MAGNETARCA (Estrato Ferrifero) — a entidade de magnetita.
 *
 * A polaridade alterna, e com ela o que e perigoso. ATRAINDO, ele te puxa e a
 * proximidade cobra; REPELINDO, ele te empurra e a distancia cobra. Nao existe
 * posicao segura permanente: existe uma FAIXA, e ela troca de lado a cada
 * ciclo.
 *
 * O puxao usa o mesmo passo-a-passo do eletroima do Coveiro — colisao
 * respeitada, sem teleporte — porque a quina no caminho continua sendo o
 * contra-jogo geometrico do campo.
 */
export const MAGNETARCH_HP = 720;
export const MAGNETARCH_SPEED = 1.8;
export const MAGNETARCH_RADIUS = 0.8;
export const MAGNETARCH_CYCLE_TICKS = 170;
export const MAGNETARCH_FIELD_RANGE = 13;
export const MAGNETARCH_PULL_STEP = 0.12;
/** Dentro disto, atraindo, o campo esmaga. */
export const MAGNETARCH_CRUSH_RANGE = 3;
export const MAGNETARCH_CRUSH_DAMAGE = 16;
/** Alem disto, repelindo, o arco de retorno castiga. */
export const MAGNETARCH_TETHER_RANGE = 9;
export const MAGNETARCH_TETHER_DAMAGE = 14;
export const MAGNETARCH_FIELD_TICK_INTERVAL = 20;
