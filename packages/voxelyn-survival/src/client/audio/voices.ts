// Catalogo de vozes e a POLITICA de cada uma (prioridade, ganho, trava
// anti-repeticao, se e espacial).
//
// Por que politica vive separada do timbre: o timbre precisa de um
// AudioContext e so pode ser julgado com ouvido; a politica e aritmetica e
// decide o que o jogador ESCUTA quando trinta coisas acontecem no mesmo tick —
// que e o caso normal aqui, nao a excecao. Uma cadeia de fogo em biofluido
// emite dezenas de `ignite` num quadro, e uma explosao em rocha fragil cospe
// um `break` por celula. Sem trava e sem orcamento isso vira ruido branco e
// come o unico canal que ainda estava livre para telegrafar perigo.
//
// A regra de ouro do arquivo: o que PROMETE dano tem prioridade sobre o que
// RELATA dano. Um telegrafo de arremesso perdido custa uma morte injusta; um
// respingo de pedra perdido nao custa nada.

export type VoiceId =
  // --- telegrafos: prometem dano, prioridade maxima -----------------------
  | 'telegraphCharge'
  | 'telegraphHurl'
  | 'telegraphSlam'
  | 'telegraphRanged'
  | 'telegraphDetonate'
  | 'telegraphPulse'
  // --- acoes do jogador ---------------------------------------------------
  | 'shot'
  | 'dodge'
  | 'pulse'
  | 'overheat'
  // --- canhao rotativo ----------------------------------------------------
  //
  // Tres identidades, e nao uma. O GIRO e o motor (arranque e parada); a
  // RAJADA e a saraivada; a CAPSULA e o latao no chao. Sao tres coisas que o
  // jogador precisa distinguir sem olhar — "esta pegando no tranco", "esta
  // cuspindo", "isto e so enfeite" — e uma voz so para as tres soaria como
  // ruido continuo, que e exatamente o que uma minigun de brinquedo soa.
  //
  // O que NAO esta aqui e tao importante quanto o que esta: nao ha
  // `minigunShot`. Dezesseis vozes por segundo estourariam o orcamento de
  // dezesseis sozinhas e mascarariam todo telegrafo da tela. Quem carrega a
  // cadencia e o `minigunBurst`, que soa cinco vezes por segundo e sintetiza
  // a saraivada INTEIRA da janela dentro de uma voz so.
  | 'minigunSpinStart'
  | 'minigunSpinStop'
  | 'minigunBurst'
  | 'minigunCasing'
  // --- impactos -----------------------------------------------------------
  | 'hitEnemy'
  | 'hitPlayer'
  | 'hitPlayerHazard'
  | 'death'
  | 'deathGuardian'
  | 'deathMiner'
  | 'bishopHeal'
  | 'minerFlee'
  | 'minerRage'
  | 'oreGained'
  // --- mundo --------------------------------------------------------------
  | 'explosion'
  | 'discharge'
  | 'ignite'
  | 'breakRock'
  | 'breakCrystal'
  | 'corrode'
  | 'chip'
  | 'spit'
  | 'rock'
  // --- objetivos e UI (nao espaciais) -------------------------------------
  | 'terminalStart'
  | 'terminalDone'
  | 'cacheRevealed'
  | 'cacheOpened'
  | 'pickupCore'
  | 'purgeAcquired'
  | 'purgeUsed'
  | 'moduleSelected'
  | 'moduleCharge'
  | 'moduleExpired'
  | 'guardianAwake'
  | 'playerDown'
  | 'revive'
  | 'extracted'
  | 'died'
  | 'uiTap'
  // A estatica do véu de deploy: a colmeia fechando sobre a tela.
  | 'deployStatic'
  // --- OS CHEFES ---------------------------------------------------------
  //
  // Cada chefe tem uma ASSINATURA (um material, uma fisica), e cada
  // habilidade dele a usa para dizer tres coisas distintas: PREPARACAO ("algo
  // vai acontecer"), EXECUCAO ("aconteceu agora") e CONSEQUENCIA ("o mundo
  // mudou por causa disso"). As vozes abaixo sao essas tres coisas, por chefe,
  // e nao uma paleta de rugidos: o jogador tem de aprender a OUVIR qual golpe
  // vem, e isso so funciona se cada momento tiver a propria forma.
  //
  // Guardiao de Pedra: massa, rocha, subgrave. Nao fala, nao canta — desloca
  // massa. Mantem `guardianAwake` e `deathGuardian`, que ja eram isso.
  | 'guardianStep'
  | 'guardianCompress'
  | 'guardianSalvoCrack'
  | 'guardianSlam'
  | 'guardianChip'
  | 'guardianStrain'
  // Bispo: materia organica, fungo e regeneracao — a subida da cura, agora
  // tambem na preparacao da Supernova.
  | 'bishopNovaCharge'
  // Diamandis: maquina industrial + VOZ CORPORATIVA. Ele nao esta lutando,
  // esta trabalhando, e cada habilidade parece uma operacao de mineracao. A
  // voz e fonemas roboticos curtos: mesmo sem as palavras ficarem
  // inteligiveis, o ritmo silabico e a personalidade.
  | 'diamandisBoot'
  | 'diamandisVoiceUnmapped'
  | 'diamandisVoiceSurvey'
  | 'diamandisVoiceArmed'
  | 'diamandisVoiceStandClear'
  | 'diamandisVoiceFault'
  | 'diamandisVoiceLost'
  | 'diamandisDrillSpin'
  | 'diamandisDrillImpact'
  | 'diamandisChargeArmed'
  | 'diamandisImplosion'
  | 'diamandisBeamScan'
  | 'diamandisBeamLocked'
  | 'diamandisReactorFail'
  | 'diamandisShutdown'
  // Devorador Branco: friccao subterranea, garganta, vacuo. O som LOCALIZA o
  // que nao pode ser visto. O vortice em si e um leito (devourer-vortex-bus).
  | 'devourerBurrow'
  | 'devourerEmergeWarning'
  | 'devourerEmerge'
  | 'devourerMawOpen'
  | 'devourerMawClose'
  | 'devourerVulnerable'
  | 'devourerBroodSwallowed'
  // Arquicantor: cristal AFINADO, acordes e ressonancia. Um motivo de tres
  // notas: o idle e uma; a preparacao, duas; o ataque completa a frase — e o
  // ataque perigoso termina num tritono, sem resolucao.
  | 'archcantorNote'
  | 'archcantorPhrase'
  | 'archcantorChord'
  | 'archcantorTritone'
  | 'archcantorResonance'
  | 'archcantorSilenced'
  | 'archcantorDeath'
  // Leviata do Lencol: baleia abissal, agua, eletricidade abafada. O canto
  // anuncia intencao; o estalo eletrico anuncia perigo.
  | 'leviathanCall'
  | 'leviathanBreach'
  | 'leviathanDelugeRise'
  | 'leviathanShockCharge'
  | 'leviathanShockRelease'
  | 'leviathanBubbleSafe'
  | 'leviathanShockRecover'
  // Pulmao-Matriz: inspiracao, pressao, membrana, gas. O ciclo respiratorio
  // e o relogio da luta; a succao continua e um leito (lung-breath-bus).
  | 'lungHold'
  | 'lungExhale'
  | 'lungClose'
  | 'lungIgnite'
  | 'lungWound'
  // Coracao da Fornalha: pulsacao, pressao e combustao. NAO vocaliza — a
  // sala e a voz dele. O batimento e um leito (furnace-heart-bus).
  | 'furnaceWedgeWarn'
  | 'furnaceWave'
  | 'furnaceCooling'
  | 'furnaceReheat'
  | 'furnaceCrack'
  | 'furnaceUnstable'
  | 'furnaceDebris'
  // Rainha da Geada: cristais finos, gelo tensionado, estilhacos. Beleza fria
  // antes de ruptura violenta. Aperiodica e desafinada — nunca a linguagem do
  // Arquicantor, embora os dois sejam cristal.
  | 'frostQueenFreezeCharge'
  | 'frostQueenFreeze'
  | 'frostQueenWraithRise'
  | 'frostQueenArmorHit'
  | 'frostQueenArmorBreak'
  | 'frostQueenShatter'
  // Magnetarca: magnetismo, inversao e metal tensionado. Atracao e repulsao
  // precisam soar OPOSTAS — e o jogador precisa saber a polaridade sem olhar.
  | 'magnetarchAttract'
  | 'magnetarchRepel'
  | 'magnetarchFlip'
  | 'magnetarchCrush'
  | 'magnetarchArc';

export type VoiceSpec = {
  /**
   * Quem sobrevive ao estouro do orcamento. Maior vence.
   *
   * A escala e deliberadamente grosseira (0-10) porque a decisao real e de
   * categoria, nao de ajuste fino: telegrafo (9-10) > dano em mim (7-8) >
   * objetivo (6) > dano em outros (4-5) > textura do mundo (1-3).
   */
  priority: number;
  /** Ganho base, antes de atenuacao por distancia. */
  gain: number;
  /**
   * Silencio minimo entre duas emissoes DESTA voz, em ms.
   *
   * Zero significa "pode empilhar no mesmo quadro" e e reservado para o que o
   * jogador dispara de proposito — o tiro tem cadencia de 250 ms e travar em
   * 60 ms seria inaudivel, mas travar em 300 ms comeria disparos reais.
   */
  minIntervalMs: number;
  /** Falso = som de interface: toca centrado, com ganho cheio, sem distancia. */
  spatial: boolean;
};

/**
 * Teto de vozes simultaneas.
 *
 * Dezesseis e o que um telefone intermediario sustenta sem estalar, e ja e
 * generoso: com as travas por voz abaixo, chegar a dezesseis exige uma cadeia
 * de reacoes de verdade — que e exatamente quando o jogador deve ouvir caos.
 */
export const MAX_VOICES = 16;

/**
 * Alem disto nao ha som. Em tiles.
 *
 * Vinte e dois cobre bem mais que a tela (a camera mostra ~15 tiles de largura
 * no celular) de proposito: o ponto do audio aqui e justamente contar o que
 * esta FORA do quadro. Descartar por distancia antes de qualquer alocacao
 * tambem e o que mantem barata uma cadeia de fogo do outro lado do mapa.
 */
export const MAX_AUDIBLE_DISTANCE = 22;

/** Dentro deste raio nao ha atenuacao: o som e "aqui". */
export const NEAR_DISTANCE = 3;

/** Distancia, em tiles, que satura o paneamento estereo. */
export const FULL_PAN_DISTANCE = 12;

export const VOICE_SPECS: Record<VoiceId, VoiceSpec> = {
  // Telegrafos. Prioridade 10 e trava curta: se dois inimigos avisam ao mesmo
  // tempo, o jogador precisa ouvir OS DOIS — e disso que depende a promessa de
  // "morte por decisao, nunca por algo que nao deu para ler".
  telegraphCharge: { priority: 10, gain: 0.55, minIntervalMs: 90, spatial: true },
  telegraphHurl: { priority: 10, gain: 0.6, minIntervalMs: 90, spatial: true },
  telegraphSlam: { priority: 10, gain: 0.6, minIntervalMs: 90, spatial: true },
  telegraphRanged: { priority: 9, gain: 0.45, minIntervalMs: 90, spatial: true },
  telegraphDetonate: { priority: 10, gain: 0.65, minIntervalMs: 90, spatial: true },
  telegraphPulse: { priority: 9, gain: 0.5, minIntervalMs: 90, spatial: true },

  shot: { priority: 6, gain: 0.3, minIntervalMs: 0, spatial: true },
  dodge: { priority: 6, gain: 0.35, minIntervalMs: 60, spatial: true },
  pulse: { priority: 7, gain: 0.5, minIntervalMs: 60, spatial: true },
  overheat: { priority: 8, gain: 0.6, minIntervalMs: 400, spatial: false },

  // O arranque e a parada do motor. Espaciais porque o parceiro remoto tambem
  // as emite, e ouvir de que lado da sala uma minigun esta pegando no tranco e
  // informacao de posicionamento. Trava de 200 ms: o gatilho batido produz
  // transicoes rapidas, e sem ela um jogador nervoso viraria um motor de
  // partida em loop.
  minigunSpinStart: { priority: 6, gain: 0.4, minIntervalMs: 200, spatial: true },
  minigunSpinStop: { priority: 4, gain: 0.3, minIntervalMs: 200, spatial: true },
  /**
   * A SARAIVADA. Prioridade 6 — a mesma do tiro comum, e nao mais.
   *
   * Esta e a decisao de mixagem mais importante da arma, e ela e deliberada:
   * a Minigun NAO pode calar telegrafo. Um jogador com o gatilho preso ja
   * ocupa a tela inteira de projetil; se ele tambem ocupasse o orcamento de
   * vozes, o aviso do bruiser que vem por tras simplesmente nao existiria, e
   * a promessa de "morte por decisao, nunca por algo que nao deu para ler"
   * morreria na arma mais divertida do jogo.
   *
   * `minIntervalMs` de 150 casa com a janela de quatro ticks (200 ms) do
   * evento agregado: passa todas as janelas sem nunca empilhar duas.
   */
  minigunBurst: { priority: 6, gain: 0.34, minIntervalMs: 150, spatial: true },
  /**
   * O LATAO. Prioridade 1, a mais baixa do banco, junto de `corrode` e `chip`.
   *
   * E textura, e o design pede explicitamente que ela SUMA quando o orcamento
   * apertar. A trava de 130 ms transforma a chuva inteira em ate sete toques
   * por segundo, agregados: um som por capsula seria a mesma armadilha do som
   * por bala, um andar abaixo.
   */
  minigunCasing: { priority: 1, gain: 0.16, minIntervalMs: 130, spatial: true },

  hitEnemy: { priority: 4, gain: 0.28, minIntervalMs: 45, spatial: true },
  // Dano em MIM e informacao de sobrevivencia, nao textura: prioridade alta e
  // trava curta o bastante para que dois golpes seguidos soem como dois.
  hitPlayer: { priority: 8, gain: 0.55, minIntervalMs: 70, spatial: false },
  // Dano ambiental POR TICK (gas, esporo, fogo sob os pes). Nao e pancada, e
  // pressao: o evento chega a 20 Hz e o leito continuo (gas/fire) e quem
  // carrega a informacao de "estou no perigo" — esta voz so pontua o custo.
  // A trava de 500 ms transforma os ~14 disparos/s em ~2 toques/s, e a
  // prioridade 5 significa que perde-la no orcamento nao custa nada.
  hitPlayerHazard: { priority: 5, gain: 0.3, minIntervalMs: 500, spatial: false },
  death: { priority: 5, gain: 0.4, minIntervalMs: 60, spatial: true },
  deathGuardian: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },
  // Prioridade 7 contra os 5 do `death` comum, e espacial.
  //
  // Sete e alto para uma morte que nao e a sua, e o motivo e estreito: esta e a
  // unica do jogo que o jogador pode ter causado SEM PRECISAR. Perde-la no
  // orcamento durante um tiroteio seria apaga-la justamente na situacao em que
  // ela mais tem o que dizer. Espacial porque importa DE ONDE veio — voce
  // atirou naquela direcao de proposito.
  deathMiner: { priority: 7, gain: 0.6, minIntervalMs: 0, spatial: true },
  // Prioridade 8: acima de "dei dano", abaixo de telegrafo. E a unica voz de
  // dano-que-nao-e-meu com prioridade alta, e por um motivo estreito — ela nao
  // descreve um impacto, descreve que os impactos nao estao valendo. Perde-la no
  // orcamento seria perder a pergunta da luta. `minIntervalMs` de 180 casa com o
  // evento a cada 4 ticks (200 ms): passa todos sem virar zumbido continuo.
  bishopHeal: { priority: 8, gain: 0.4, minIntervalMs: 180, spatial: true },
  // O grito do mineiro tem prioridade de TELEGRAFO (9), e nao de dano: ele e o
  // aviso de que um alvo que estava NEUTRO deixou de estar. Perde-lo no
  // orcamento seria perder a unica coisa que separa "havia alguem ali" de
  // "alguem esta vindo".
  minerRage: { priority: 9, gain: 0.75, minIntervalMs: 0, spatial: true },
  minerFlee: { priority: 5, gain: 0.45, minIntervalMs: 0, spatial: true },
  // Recibo, e nao evento: baixo e agudo, para sumir sob o combate.
  oreGained: { priority: 3, gain: 0.28, minIntervalMs: 90, spatial: true },

  explosion: { priority: 8, gain: 0.75, minIntervalMs: 70, spatial: true },
  discharge: { priority: 7, gain: 0.6, minIntervalMs: 110, spatial: true },
  // Ignicao e o caso patologico: uma poca de biofluido pegando fogo emite
  // dezenas destes por segundo. A trava de 160 ms transforma a cadeia num
  // crepitar continuo em vez de uma serra eletrica.
  ignite: { priority: 3, gain: 0.3, minIntervalMs: 160, spatial: true },
  breakRock: { priority: 2, gain: 0.3, minIntervalMs: 70, spatial: true },
  breakCrystal: { priority: 4, gain: 0.45, minIntervalMs: 70, spatial: true },
  corrode: { priority: 1, gain: 0.22, minIntervalMs: 200, spatial: true },
  chip: { priority: 1, gain: 0.25, minIntervalMs: 120, spatial: true },
  spit: { priority: 5, gain: 0.3, minIntervalMs: 60, spatial: true },
  rock: { priority: 6, gain: 0.45, minIntervalMs: 60, spatial: true },

  terminalStart: { priority: 6, gain: 0.5, minIntervalMs: 0, spatial: false },
  terminalDone: { priority: 6, gain: 0.55, minIntervalMs: 0, spatial: false },
  cacheRevealed: { priority: 6, gain: 0.5, minIntervalMs: 0, spatial: false },
  cacheOpened: { priority: 6, gain: 0.55, minIntervalMs: 0, spatial: false },
  pickupCore: { priority: 10, gain: 0.85, minIntervalMs: 0, spatial: false },
  purgeAcquired: { priority: 5, gain: 0.4, minIntervalMs: 0, spatial: false },
  purgeUsed: { priority: 6, gain: 0.5, minIntervalMs: 0, spatial: false },
  moduleSelected: { priority: 7, gain: 0.6, minIntervalMs: 0, spatial: false },
  moduleCharge: { priority: 4, gain: 0.3, minIntervalMs: 40, spatial: false },
  moduleExpired: { priority: 6, gain: 0.45, minIntervalMs: 0, spatial: false },
  guardianAwake: { priority: 10, gain: 0.95, minIntervalMs: 0, spatial: false },
  playerDown: { priority: 10, gain: 0.8, minIntervalMs: 0, spatial: false },
  revive: { priority: 9, gain: 0.7, minIntervalMs: 0, spatial: false },
  extracted: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },
  died: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },
  uiTap: { priority: 5, gain: 0.35, minIntervalMs: 40, spatial: false },
  // Trava de 500 ms: o véu chama uma vez por varredura (fechar e abrir), e a
  // trava so existe para um duplo-disparo acidental nao somar duas estaticas.
  deployStatic: { priority: 8, gain: 0.5, minIntervalMs: 500, spatial: false },

  // --- OS CHEFES ---------------------------------------------------------
  //
  // A politica de prioridade dos chefes, e a regra que a rege:
  //
  //   windup de golpe letal              10
  //   mudanca de fase / estado global    10
  //   execucao da habilidade principal    9
  //   cue de vulnerabilidade              9
  //   movimento importante fora da tela   7-8
  //   vocalizacao de personalidade        5-6
  //   passos, respiracao e fragmentos     2-4
  //
  // Vocalizacao NUNCA rouba a vaga de um windup, e o canto do Leviata nao
  // pode mascarar a propria descarga: e por isso que `leviathanCall` esta em
  // 6 e `leviathanShockCharge` em 10, e nao o contrario.

  // Guardiao. O passo e textura (3); a compressao de rocha antes do golpe e
  // o estalo seco antes da salva sao telegrafos (10); o golpe em si e curto e
  // sem cauda (9). A lasca ao levar dano e textura, e a trava de 110 ms e o
  // que impede uma minigun de transforma-la numa britadeira.
  guardianStep: { priority: 3, gain: 0.34, minIntervalMs: 150, spatial: true },
  guardianCompress: { priority: 10, gain: 0.6, minIntervalMs: 90, spatial: true },
  guardianSalvoCrack: { priority: 10, gain: 0.55, minIntervalMs: 90, spatial: true },
  guardianSlam: { priority: 9, gain: 0.7, minIntervalMs: 60, spatial: true },
  guardianChip: { priority: 3, gain: 0.26, minIntervalMs: 110, spatial: true },
  guardianStrain: { priority: 4, gain: 0.3, minIntervalMs: 800, spatial: true },

  bishopNovaCharge: { priority: 10, gain: 0.5, minIntervalMs: 90, spatial: true },

  // Diamandis. As frases de sistema sao personalidade (6): a trava de 400 ms
  // e o que garante que duas ordens no mesmo tick nao saiam sobrepostas. As
  // ferramentas seguem a tabela: motor da broca e bipes das cargas sao
  // windup (10); o contato da broca, a implosao e a trava do feixe sao
  // execucao (9). A falha operacional e o desligamento sao fase (10).
  diamandisBoot: { priority: 10, gain: 0.85, minIntervalMs: 0, spatial: false },
  diamandisVoiceUnmapped: { priority: 6, gain: 0.42, minIntervalMs: 400, spatial: true },
  diamandisVoiceSurvey: { priority: 6, gain: 0.42, minIntervalMs: 400, spatial: true },
  diamandisVoiceArmed: { priority: 6, gain: 0.42, minIntervalMs: 400, spatial: true },
  diamandisVoiceStandClear: { priority: 6, gain: 0.42, minIntervalMs: 400, spatial: true },
  diamandisVoiceFault: { priority: 6, gain: 0.46, minIntervalMs: 400, spatial: true },
  diamandisVoiceLost: { priority: 6, gain: 0.42, minIntervalMs: 400, spatial: true },
  diamandisDrillSpin: { priority: 10, gain: 0.55, minIntervalMs: 90, spatial: true },
  diamandisDrillImpact: { priority: 9, gain: 0.7, minIntervalMs: 60, spatial: true },
  diamandisChargeArmed: { priority: 10, gain: 0.5, minIntervalMs: 90, spatial: true },
  diamandisImplosion: { priority: 9, gain: 0.75, minIntervalMs: 60, spatial: true },
  diamandisBeamScan: { priority: 10, gain: 0.45, minIntervalMs: 90, spatial: true },
  diamandisBeamLocked: { priority: 9, gain: 0.55, minIntervalMs: 60, spatial: true },
  diamandisReactorFail: { priority: 10, gain: 0.8, minIntervalMs: 0, spatial: false },
  diamandisShutdown: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },

  // Devorador. O deslocamento sob a silica e MOVIMENTO FORA DA TELA (7): e
  // a informacao espacial do encontro, e perde-la no orcamento seria perder
  // a rota. A trava de 400 ms casa com a cadencia do evento (500 ms) sem
  // nunca empilhar dois. A boca abrindo e estado global (10); fechando e
  // consequencia (8); a ninhada engolida e fragmento (2).
  devourerBurrow: { priority: 7, gain: 0.4, minIntervalMs: 400, spatial: true },
  devourerEmergeWarning: { priority: 10, gain: 0.6, minIntervalMs: 90, spatial: true },
  devourerEmerge: { priority: 9, gain: 0.75, minIntervalMs: 60, spatial: true },
  devourerMawOpen: { priority: 10, gain: 0.75, minIntervalMs: 0, spatial: true },
  devourerMawClose: { priority: 8, gain: 0.6, minIntervalMs: 0, spatial: true },
  devourerVulnerable: { priority: 9, gain: 0.45, minIntervalMs: 0, spatial: true },
  devourerBroodSwallowed: { priority: 2, gain: 0.22, minIntervalMs: 90, spatial: true },

  // Arquicantor. A nota isolada e a ressonancia dos cristais sao vocalizacao
  // (5); a frase de preparacao e telegrafo (10); o acorde e o tritono sao
  // execucao (9); o silencio da Catedral e vulnerabilidade (9) e nao e
  // espacial — o reverb tonal que some e o da SALA. A ressonancia tem trava
  // de 250 ms porque a onda solta uma camada a cada 300 ms.
  archcantorNote: { priority: 5, gain: 0.3, minIntervalMs: 300, spatial: true },
  archcantorPhrase: { priority: 10, gain: 0.5, minIntervalMs: 90, spatial: true },
  archcantorChord: { priority: 9, gain: 0.6, minIntervalMs: 60, spatial: true },
  archcantorTritone: { priority: 9, gain: 0.62, minIntervalMs: 60, spatial: true },
  archcantorResonance: { priority: 5, gain: 0.32, minIntervalMs: 250, spatial: true },
  archcantorSilenced: { priority: 9, gain: 0.55, minIntervalMs: 0, spatial: false },
  archcantorDeath: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },

  // Leviata. O chamado e presenca (6) e espacial: e "algo enorme navegando
  // fora da camera". A carga da descarga e a descarga NAO sao espaciais: a
  // descarga atravessa a arena inteira, entao o aviso e informacao GLOBAL e
  // tem de ser reconhecido de qualquer lugar. As bolhas (8) sao o "voce esta
  // seguro" do jogador local; a trava de 500 ms da a elas o ritmo de um
  // coracao ouvido de dentro. O Diluvio muda o mapa: global tambem.
  leviathanCall: { priority: 6, gain: 0.42, minIntervalMs: 900, spatial: true },
  leviathanBreach: { priority: 10, gain: 0.55, minIntervalMs: 90, spatial: true },
  leviathanDelugeRise: { priority: 10, gain: 0.7, minIntervalMs: 0, spatial: false },
  leviathanShockCharge: { priority: 10, gain: 0.7, minIntervalMs: 0, spatial: false },
  leviathanShockRelease: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },
  leviathanBubbleSafe: { priority: 8, gain: 0.36, minIntervalMs: 500, spatial: false },
  leviathanShockRecover: { priority: 9, gain: 0.5, minIntervalMs: 0, spatial: true },

  // Pulmao. A retencao (pulmao cheio) e telegrafo (10): e o meio segundo de
  // medo antes do jato. A expiracao e execucao (9); a valvula fechando e
  // consequencia (7); a expiracao acesa e vulnerabilidade (9). O vazamento
  // ao levar dano e textura (4), com trava longa — ele leva dano continuo.
  lungHold: { priority: 10, gain: 0.5, minIntervalMs: 0, spatial: true },
  lungExhale: { priority: 9, gain: 0.65, minIntervalMs: 0, spatial: true },
  lungClose: { priority: 7, gain: 0.5, minIntervalMs: 0, spatial: true },
  lungIgnite: { priority: 9, gain: 0.7, minIntervalMs: 200, spatial: true },
  lungWound: { priority: 4, gain: 0.3, minIntervalMs: 300, spatial: true },

  // Fornalha. A cunha marcada e telegrafo (10) e ESPACIAL de proposito: o
  // jogador tem de ouvir de que lado vem a varredura. A onda e execucao (9).
  // O resfriamento (9) e o reaquecimento (8) sao da SALA, nao do corpo —
  // globais. Colapso e instabilidade sao fase (10). Os detritos antes da
  // estalactite sao movimento (7), espaciais: dizem ONDE o teto vai cair.
  furnaceWedgeWarn: { priority: 10, gain: 0.5, minIntervalMs: 90, spatial: true },
  furnaceWave: { priority: 9, gain: 0.7, minIntervalMs: 200, spatial: true },
  furnaceCooling: { priority: 9, gain: 0.6, minIntervalMs: 0, spatial: false },
  furnaceReheat: { priority: 8, gain: 0.5, minIntervalMs: 0, spatial: false },
  furnaceCrack: { priority: 10, gain: 0.85, minIntervalMs: 0, spatial: false },
  furnaceUnstable: { priority: 10, gain: 0.8, minIntervalMs: 0, spatial: false },
  furnaceDebris: { priority: 7, gain: 0.4, minIntervalMs: 150, spatial: true },

  // Rainha. Os blings convergindo sao telegrafo (10); a expansao do gelo e
  // execucao (9); os Espectros saindo sao consequencia (8); o tilintar da
  // couraça e textura (4) com trava curta — cada tiro absorvido tem de ser
  // ouvido como absorvido; a couraça quebrando e vulnerabilidade (9).
  frostQueenFreezeCharge: { priority: 10, gain: 0.5, minIntervalMs: 90, spatial: true },
  frostQueenFreeze: { priority: 9, gain: 0.65, minIntervalMs: 60, spatial: true },
  frostQueenWraithRise: { priority: 8, gain: 0.5, minIntervalMs: 0, spatial: true },
  frostQueenArmorHit: { priority: 4, gain: 0.28, minIntervalMs: 90, spatial: true },
  frostQueenArmorBreak: { priority: 9, gain: 0.75, minIntervalMs: 0, spatial: true },
  frostQueenShatter: { priority: 10, gain: 0.9, minIntervalMs: 0, spatial: false },

  // Magnetarca. A polaridade e ESTADO GLOBAL (10) e nao espacial: o jogador
  // tem de saber qual vale sem olhar para o HUD nem para o chefe. O rele
  // (clack) sai junto da polaridade que entra. O esmagamento e o arco sao
  // execucao (9); o arco soa onde fecha, longe do corpo.
  magnetarchAttract: { priority: 10, gain: 0.6, minIntervalMs: 0, spatial: false },
  magnetarchRepel: { priority: 10, gain: 0.6, minIntervalMs: 0, spatial: false },
  magnetarchFlip: { priority: 10, gain: 0.55, minIntervalMs: 0, spatial: false },
  magnetarchCrush: { priority: 9, gain: 0.6, minIntervalMs: 200, spatial: true },
  magnetarchArc: { priority: 9, gain: 0.55, minIntervalMs: 200, spatial: true },
};

export const voiceSpec = (id: VoiceId): VoiceSpec => VOICE_SPECS[id];
