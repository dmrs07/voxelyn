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

export type CatId = 'bigode' | 'cheeto' | 'almofada' | 'smoking';

export type Track = 'backend' | 'frontend' | 'design' | 'devops';

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
  specialty: Track;
  personality: Personality;
  quirk: Quirk;
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
};

export type Task = {
  id: string;
  track: Track;
  label: string;
  polish: boolean;
  cost: number;
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

export type DemoResult = {
  core: number;
  polish: number;
  bugs: number;
  looseEnds: number;
  /** As tres notas, uma por juiz, na ordem de JUDGES. */
  perJudge: [number, number, number];
  score: number;
  crashed: boolean;
  outcome: Outcome;
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
  | { kind: 'demo'; tick: number; result: DemoResult };

export type Phase = 'hack' | 'done';

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
  handX?: number;
  handY?: number;
};
