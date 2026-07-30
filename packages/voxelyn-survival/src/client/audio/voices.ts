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
  // --- impactos -----------------------------------------------------------
  | 'hitEnemy'
  | 'hitPlayer'
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
  | 'uiTap';

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

  hitEnemy: { priority: 4, gain: 0.28, minIntervalMs: 45, spatial: true },
  // Dano em MIM e informacao de sobrevivencia, nao textura: prioridade alta e
  // trava curta o bastante para que dois golpes seguidos soem como dois.
  hitPlayer: { priority: 8, gain: 0.55, minIntervalMs: 70, spatial: false },
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
};

export const voiceSpec = (id: VoiceId): VoiceSpec => VOICE_SPECS[id];
