/**
 * CATATHON — o maior hackathon do mundo, e a tua equipe e de gatos.
 *
 * A simulacao e o jogo inteiro: o cliente so desenha e encaminha toques. A
 * disciplina e a da casa (Survival, Iliada): ticks inteiros, RNG semeado, hash
 * autoritativo, nenhum DOM, nenhum relogio de parede. Um replay de Catathon e
 * `(semente, comandos)` — vergonha da demo incluida.
 *
 * O coracao do jogo, por contrato de design: ORQUESTRACAO DE TAREFAS (um grafo
 * com dependencias entre trilhas) e PSICOLOGIA FELINA (personalidade + mania,
 * cada uma com efeito mecanico, nunca so numero pintado).
 */

/**
 * Desde o Slice B o time e GERADO: o id e uma string por candidato. Os
 * quatro classicos (bigode, cheeto, almofada, smoking) viraram o time de
 * demonstracao e de teste.
 */
export type CatId = string;

export type Track = 'backend' | 'frontend' | 'design' | 'devops';

/** Especializacao: as quatro trilhas ou o freestyler (rende 0.75 em tudo). */
export type Spec = Track | 'freestyler';

/**
 * Tier muda a FORMA de jogar, nao so a velocidade: junior aprende durante a
 * run e shipa sujo; senior conserta rapido e shipa limpo; especialista voa
 * na propria trilha e afunda fora dela.
 */
export type Tier = 'junior' | 'pleno' | 'senior' | 'especialista';

export type CoatPattern = 'solid' | 'tabby' | 'tuxedo' | 'siames' | 'sphynx';

/**
 * APETRECHOS: comprados no recrutamento, com trade-off. Quatro passivos
 * (modificadores do booth) e dois CONSUMIVEIS — o catnip da moral e pode dar
 * zoomies; o laser acalma a equipe INTEIRA e interrompe todo mundo, porque
 * e um laser e eles sao gatos.
 */
export type GearId =
  | 'teclado-mecanico'
  | 'almofada-termica'
  | 'rubber-duck'
  | 'cafeteira-pro'
  | 'catnip'
  | 'laser-pointer';

/**
 * EVENTO SOCIAL: o pavilhao interrompe o booth com uma escolha A/B numa
 * janela curta. Ignorar escolhe B (a opcao segura) — o jogo nunca trava
 * esperando, mas a escolha boa premia quem presta atencao.
 */
export type SocialKind = 'influencer' | 'poach' | 'workshop';
export type SocialEvent = {
  kind: SocialKind;
  at: number;
  /** Fim da janela (0 = ainda nao abriu). */
  until: number;
  resolved: boolean;
  taken: 'a' | 'b' | null;
};

/**
 * PERSONALIDADE: como o gato trabalha.
 * - perfeccionista: termina e NAO deixa mergear — segura a feature pronta ate
 *   alguem dizer "shipa" (um carinho). Qualidade impecavel, ansiedade tua.
 * - cowboy: 25% mais rapido, shipa sem testar (bugs), e as vezes descobre um
 *   atalho genial sem querer. Laranja.
 * - calmo: o estresse sobe a metade. Tres cadeiras, zero pressa.
 * - julga-em-silencio: sofre quando ha bug vivo no projeto. Ele SABE.
 */
export type Personality = 'perfeccionista' | 'cowboy' | 'calmo' | 'julga-em-silencio';

/**
 * MANIA FELINA: o que o gato faz por ser gato.
 * - territorial: ser deslocado da mesa da estresse.
 * - morde-cabo: o proc de caos fora da mesa pode derrubar o build.
 * - dorme-no-rack: cochila em cima do servidor (perto das emergencias).
 * - caixa: dorme na caixa de papelao e recupera mais rapido.
 */
export type Quirk = 'territorial' | 'morde-cabo' | 'dorme-no-rack' | 'caixa';

export type SlotId =
  | 'desk-backend'
  | 'desk-frontend'
  | 'desk-design'
  | 'desk-devops'
  | 'puff'
  | 'rack'
  | 'cafe';

export type CatMode =
  | 'idle'
  | 'walk'
  | 'work'
  | 'nap'
  | 'eat'
  | 'zoomies'
  | 'keyboard'
  | 'held'
  | 'petted';

export type Cat = {
  id: CatId;
  name: string;
  specialty: Spec;
  personality: Personality;
  quirk: Quirk;
  tier: Tier;
  /** Traits visiveis + o oculto (revelado no meio da run). Todos mecanicos. */
  traits: readonly string[];
  hiddenTrait: string;
  /** O trait oculto ja apareceu? (entra no hash: muda eventos futuros) */
  revealed: boolean;
  /** Pelagem 0xRRGGBB + padrao: dados puros, o cliente converte. */
  coat: { body: number; mark: number; belly: number };
  pattern: CoatPattern;
  big: boolean;
  /** A ficha em uma linha (nota do recrutador + curriculo). */
  bio: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  mode: CatMode;
  modeUntil: number;
  slot: SlotId | null;
  /** 0..1. Trabalhar drena; soneca e petisco recuperam. */
  energy: number;
  /** 0..1. Fome. Baixa, o gato larga tudo e vai ao balcao — e gato. */
  hunger: number;
  /**
   * 0..1. Estresse (o "caos"). Estourando, o gato FAZ ALGO DE GATO: senta no
   * teclado (bug), morde o cabo (build cai), zoomies. Carinho e a valvula.
   * Gerir estresse E gerir bugs, porque bug nasce de estresse.
   */
  stress: number;
  /**
   * 0..1. MORAL: cooperacao e vontade. Sobe com carinho (bem dado), ship
   * proprio e da equipe; desce trabalhando exausto e sendo despejado. Manda
   * na VELOCIDADE de trabalho — gato desanimado rende menos, e nenhum
   * medidor e enfeite.
   */
  moral: number;
  /**
   * Carinho tem MEMORIA: sessoes seguidas rendem cada vez menos, e a
   * terceira SUPERESTIMULA (estresse sobe). Streak decai com o tempo — o
   * jogador aprende o ritmo de cada gato em vez de esfregar o dedo.
   */
  petStreak: number;
  /** Tick do fim da ultima sessao de carinho (-1 = nunca). */
  petLastTick: number;
  /** Bonus permanente de velocidade (workshop). Entra no hash. */
  speedBoost: number;
};

/**
 * DECISAO DE ENGENHARIA embutida numa tarefa: a tarefa com `choice` NAO anda
 * enquanto o jogador nao escolher — colocar um gato e esperar barras encherem
 * nao e jogo. Cada opcao mexe em custos (agora e depois) e em tags de
 * pontuacao (divida, inovacao, estabilidade, risco do patrocinador).
 */
export type TaskChoice = {
  prompt: string;
  options: readonly { id: string; label: string; hint: string }[];
};

export type Task = {
  id: string;
  track: Track;
  label: string;
  polish: boolean;
  cost: number;
  choice?: TaskChoice;
  /** Opcao escolhida (id) ou null enquanto a decisao esta aberta. */
  chosen: string | null;
  /**
   * O GRAFO. Uma tarefa so pode ser trabalhada com as dependencias prontas — o
   * dashboard espera a API, que espera o schema. E o que transforma "aloque
   * gatos" em orquestracao: a ordem importa, e backend parado trava frontend.
   */
  deps: readonly string[];
  progress: number;
  done: boolean;
  /**
   * CORTADA pelo jogador. Cortar escopo e decisao de primeira classe: uma
   * tarefa comecada e abandonada e uma PONTA SOLTA e custa pontos na banca;
   * cortada, vira decisao de engenharia e nao custa nada.
   */
  cut: boolean;
  /**
   * Pronta e SEGURADA pelo perfeccionista: ele nao deixa mergear ate alguem
   * dizer "shipa" (carinho nele). Na demo, segurada conta como ponta solta.
   */
  awaitingShip: boolean;
};

export type Bug = {
  id: number;
  track: Track;
  by: CatId;
  cost: number;
  progress: number;
  fixed: boolean;
};

export type Hairball = {
  active: boolean;
  at: number;
  deadline: number;
  cost: number;
  progress: number;
  fired: number;
};

export type Outcome = 'grand-prize' | 'podio' | 'mencao' | 'participacao' | 'crashed';

/**
 * A nota nao e um numero: e CINCO dimensoes + o voto popular. O projeto com
 * mais features nem sempre vence — estabilidade, experiencia, inovacao e o
 * proprio pitch pesam, e o detalhamento e o pos-jogo inteiro.
 */
export type ScoreDimensions = {
  tecnica: number;
  estabilidade: number;
  experiencia: number;
  inovacao: number;
  pitch: number;
};

export type DemoResult = {
  core: number;
  polish: number;
  bugs: number;
  looseEnds: number;
  /** As tres notas, uma por juiz, na ordem de JUDGES. */
  perJudge: [number, number, number];
  dimensions: ScoreDimensions;
  /** 0..1: onde o gauge da plateia terminou. */
  plateia: number;
  /** O premio em tampinhas: colocacao + bonus de zero bugs + acordos. */
  prize: number;
  score: number;
  crashed: boolean;
  /** A crise de demo virou improviso heroico? Historia pra contar. */
  improvised: boolean;
  outcome: Outcome;
};

/**
 * O PITCH e fase jogavel, nao cutscene: o gauge da plateia decai sozinho e
 * cada gato tem UMA habilidade de palco (cooldown proprio; repetir a mesma
 * rende metade). A crise de demo — o bug que estourou — abre uma janela
 * curta: responder com qualquer habilidade vira improviso heroico.
 */
export type PitchState = {
  ticksLeft: number;
  /** 0..1: atencao/afeicao da plateia. */
  gauge: number;
  /** Ultima habilidade usada (repetir perde efeito). */
  lastAbility: CatId | null;
  /** Tick em que cada gato pode agir de novo (chaveado por id do time). */
  readyAt: Record<string, number>;
  /** Tick da crise de demo (-1 = nao havera). */
  crisisAt: number;
  /** Fim da janela de resposta da crise (0 = sem crise ativa). */
  crisisUntil: number;
  /** A crise ja foi respondida (ou nunca existiu)? */
  crisisResolved: boolean;
};

export type SimEvent =
  | { kind: 'ship'; tick: number; task: string; track: Track; by: CatId }
  | { kind: 'await-ship'; tick: number; task: string; by: CatId }
  | { kind: 'shortcut'; tick: number; task: string; by: CatId }
  | { kind: 'bug'; tick: number; by: CatId; track: Track; cause: 'teclado' | 'sem-teste' }
  | { kind: 'bugfix'; tick: number; track: Track }
  | { kind: 'zoomies'; tick: number; cat: CatId }
  | { kind: 'cable'; tick: number; by: CatId }
  | { kind: 'cable-fixed'; tick: number }
  | { kind: 'nap'; tick: number; cat: CatId }
  | { kind: 'eat'; tick: number; cat: CatId }
  | { kind: 'hairball'; tick: number }
  | { kind: 'hairball-fixed'; tick: number }
  | { kind: 'build-broken'; tick: number }
  | { kind: 'treat'; tick: number; cat: CatId }
  | { kind: 'cut'; tick: number; task: string }
  | { kind: 'overpet'; tick: number; cat: CatId }
  | { kind: 'trait-revealed'; tick: number; cat: CatId; trait: string }
  | { kind: 'sponsor-outage'; tick: number }
  | { kind: 'catnip'; tick: number; cat: CatId; zoomies: boolean }
  | { kind: 'laser'; tick: number }
  | { kind: 'social-open'; tick: number; social: SocialKind }
  | { kind: 'social-taken'; tick: number; social: SocialKind; option: 'a' | 'b' }
  | { kind: 'decision-needed'; tick: number; task: string }
  | { kind: 'decision'; tick: number; task: string; option: string }
  | { kind: 'pitch-start'; tick: number }
  | { kind: 'ability'; tick: number; cat: CatId; effect: number }
  | { kind: 'demo-glitch'; tick: number }
  | { kind: 'improviso'; tick: number; cat: CatId }
  | { kind: 'demo'; tick: number; result: DemoResult };

export type Phase = 'hack' | 'pitch' | 'done';

export type HackState = {
  tick: number;
  phase: Phase;
  seed: number;
  rngState: number;
  cats: Cat[];
  tasks: Task[];
  bugs: Bug[];
  hairball: Hairball;
  /** O cabo mordido: build fora do ar ate alguem consertar no rack. */
  cableOut: boolean;
  cableProgress: number;
  treats: number;
  buildBroken: boolean;
  held: CatId | null;
  handX: number;
  handY: number;
  /** Tags acumuladas pelas DECISOES de tarefa. Cada uma pesa na banca. */
  debt: number;
  innovation: number;
  uxCare: number;
  stability: number;
  /** Uma escolha amarrou o projeto ao patrocinador: risco extra na demo. */
  sponsorRisk: boolean;
  /** O projeto desta edicao (gerado da semente; classico nos testes). */
  project: { name: string; brief: string; emphasis: string; risk: string };
  /** O booth desta edicao: coordenadas E modificadores. */
  layoutId: string;
  layoutName: string;
  layoutMods: { stressWork: number; stressIdle: number; fixSpeed: number; napRate: number; moralShip: number; eatScale: number };
  slots: { id: SlotId; x: number; y: number; track: Track | null }[];
  pitch: PitchState | null;
  /** Apetrechos comprados no recrutamento (passivos ja aplicados). */
  gear: GearId[];
  catnipLeft: number;
  laserLeft: number;
  /** Hype acumulado (influencer): entra no gauge inicial do pitch. */
  hype: number;
  /** Bonus de premio negociado em eventos (poach). */
  prizeBonus: number;
  /** Sessoes de carinho na run (conquistas leem daqui). */
  petSessions: number;
  social: SocialEvent[];
  events: SimEvent[];
  result: DemoResult | null;
};

/** No maximo uma acao por tick: a mao e uma so, e isso E o jogo. */
export type Command = {
  grab?: CatId;
  drop?: SlotId;
  pet?: CatId;
  treat?: CatId;
  /** Soltar o gato ONDE A MAO ESTA, sem posto: ele fica idle ali. */
  release?: boolean;
  /** Cortar uma tarefa do escopo, pelo quadro. */
  cut?: string;
  /** Decidir uma tarefa com escolha aberta. */
  choose?: { task: string; option: string };
  /** No pitch: mandar um gato usar a habilidade de palco. */
  ability?: CatId;
  /** Consumiveis: catnip num gato; laser para a equipe inteira. */
  catnip?: CatId;
  laser?: boolean;
  /** Responder o evento social aberto. */
  social?: 'a' | 'b';
  handX?: number;
  handY?: number;
};
