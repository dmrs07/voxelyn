import { TASK_CORE_COST, TASK_POLISH_COST } from './constants.js';
import type { Cat, CatId, SlotId, Task, Track } from './types.js';

/**
 * A EQUIPE, por arquetipo do contrato de design. Cada gato = disciplina +
 * personalidade + mania, e as tres dimensoes tem efeito mecanico — a ficha
 * nao e enfeite, e o manual do jogador.
 */
export const CATS: readonly {
  id: CatId;
  name: string;
  specialty: Track;
  personality: Cat['personality'];
  quirk: Cat['quirk'];
  bio: string;
}[] = [
  {
    id: 'bigode',
    name: 'Bigode',
    specialty: 'backend',
    personality: 'perfeccionista',
    quirk: 'territorial',
    bio: 'siames senior. arquitetura impecavel, recusa CSS, nao deixa mergear sem um "shipa" teu.',
  },
  {
    id: 'cheeto',
    name: 'Cheeto',
    specialty: 'frontend',
    personality: 'cowboy',
    quirk: 'morde-cabo',
    bio: 'laranja junior full-stack. um neuronio, confianca infinita, shipa sem testar.',
  },
  {
    id: 'almofada',
    name: 'Almofada',
    specialty: 'devops',
    personality: 'calmo',
    quirk: 'dorme-no-rack',
    bio: 'maine coon devops. ocupa tres cadeiras, calmo ate no incendio, cochila no servidor.',
  },
  {
    id: 'smoking',
    name: 'Smoking',
    specialty: 'design',
    personality: 'julga-em-silencio',
    quirk: 'caixa',
    bio: 'tuxedo designer. interfaces lindas; sofre em silencio a cada bug vivo. ele SABE.',
  },
];

/**
 * O DESAFIO (gerado "pela organizacao"): plataforma de adocao de gatos com IA,
 * acessivel, mas sustentavel. O PROJETO e um GRAFO — as dependencias cruzam
 * trilhas de proposito: o dashboard espera a API, que espera o schema, e a
 * banca nao aceita frontend bonito sobre backend imaginario.
 */
export const TASKS: readonly Omit<Task, 'progress' | 'done' | 'cut' | 'awaitingShip' | 'chosen'>[] = [
  // backend
  {
    id: 'b1',
    track: 'backend',
    label: 'schema dos adotaveis',
    polish: false,
    cost: TASK_CORE_COST,
    deps: [],
    // A primeira DECISAO da run: a arquitetura. A tarefa nao anda ate o
    // jogador escolher — e cada opcao muda a partida, nao so um numero.
    choice: {
      prompt: 'arquitetura do backend?',
      options: [
        { id: 'monolito', label: 'monolito felino', hint: 'rapido agora, divida depois' },
        { id: 'micro', label: 'microsservicos', hint: 'caro agora, backend rende depois' },
        { id: 'serverless', label: 'serverless do sponsor', hint: 'rapidissimo, e se a API deles cair na demo?' },
      ],
    },
  },
  { id: 'b2', track: 'backend', label: 'API /adotar com auth por bigode', polish: false, cost: TASK_CORE_COST, deps: ['b1'] },
  { id: 'b3', track: 'backend', label: 'cache de sardinha', polish: true, cost: TASK_POLISH_COST, deps: ['b2'] },
  // design
  {
    id: 'd1',
    track: 'design',
    label: 'design system Patinha',
    polish: false,
    cost: TASK_CORE_COST,
    deps: [],
    choice: {
      prompt: 'como atacar a UI?',
      options: [
        { id: 'sistemaPrimeiro', label: 'design system primeiro', hint: 'lento agora, telas rendem depois' },
        { id: 'componentesLocais', label: 'componentes locais', hint: 'rapido, inconsistencia vira divida' },
        { id: 'templateSponsor', label: 'template do sponsor', hint: 'muito rapido, zero originalidade' },
      ],
    },
  },
  { id: 'd2', track: 'design', label: 'fluxo de adocao acessivel', polish: false, cost: TASK_CORE_COST, deps: ['d1'] },
  { id: 'd3', track: 'design', label: 'modo escuro (para gatos)', polish: true, cost: TASK_POLISH_COST, deps: ['d1'] },
  // frontend
  { id: 'f1', track: 'frontend', label: 'onboarding com novelo', polish: false, cost: TASK_CORE_COST, deps: ['d1'] },
  { id: 'f2', track: 'frontend', label: 'dashboard de adocoes', polish: false, cost: TASK_CORE_COST, deps: ['b2', 'd1'] },
  { id: 'f3', track: 'frontend', label: 'confete de lazinha', polish: true, cost: TASK_POLISH_COST, deps: ['f2'] },
  // devops
  {
    id: 'o1',
    track: 'devops',
    label: 'pipeline de deploy',
    polish: false,
    cost: TASK_CORE_COST,
    deps: ['b1'],
    choice: {
      prompt: 'como vai ao ar?',
      options: [
        { id: 'pipelineCompleto', label: 'pipeline completo', hint: 'caro, e a demo agradece' },
        { id: 'deployNaMao', label: 'deploy na mao', hint: 'rapido, divida na certa' },
        { id: 'presetSponsor', label: 'preset do sponsor', hint: 'confortavel, e amarra a demo neles' },
      ],
    },
  },
  { id: 'o2', track: 'devops', label: 'miau-metrics no grafana', polish: false, cost: TASK_CORE_COST, deps: ['o1'] },
  { id: 'o3', track: 'devops', label: 'autoscaling de sonecas', polish: true, cost: TASK_POLISH_COST, deps: ['o2'] },
];

/**
 * A BANCA. Tres juizes, tres lentes — a nota final e a soma, e o detalhamento
 * aparece na tela de resultado porque a licao ("foi o bug vivo que te tirou o
 * podio") e o pos-jogo inteiro.
 */
export const JUDGES: readonly { name: string; lens: string }[] = [
  { name: 'Purrfessor Von Whiskers', lens: 'arquitetura: features core e pontas soltas' },
  { name: 'Grace Meowper', lens: 'estabilidade: bugs vivos na demo' },
  { name: 'Cocada', lens: 'experiencia: polimento e a trilha de design' },
];

/**
 * Coordenadas de cena (480x270). O booth tem RELACOES espaciais, nao fileiras:
 * duas estacoes de cada lado olhando para o centro, quadro de planejamento no
 * meio, area social embaixo no centro, descanso no canto esquerdo e o servidor
 * no direito. O corredor central fica livre para os gatos circularem.
 */
export const SLOTS: readonly { id: SlotId; x: number; y: number; track: Track | null }[] = [
  { id: 'desk-backend', x: 86, y: 126, track: 'backend' },
  { id: 'desk-frontend', x: 394, y: 126, track: 'frontend' },
  { id: 'desk-design', x: 86, y: 190, track: 'design' },
  { id: 'desk-devops', x: 394, y: 190, track: 'devops' },
  { id: 'puff', x: 56, y: 240, track: null },
  { id: 'rack', x: 432, y: 208, track: null },
  { id: 'cafe', x: 240, y: 210, track: null },
];

export const slotOf = (id: SlotId) => SLOTS.find((s) => s.id === id)!;
export const deskOfTrack = (track: Track): SlotId => SLOTS.find((s) => s.track === track)!.id;

export const startCats = (): Cat[] =>
  CATS.map((c, i) => ({
    id: c.id,
    name: c.name,
    specialty: c.specialty,
    personality: c.personality,
    quirk: c.quirk,
    x: 150 + i * 46,
    y: 190,
    targetX: 150 + i * 46,
    targetY: 190,
    mode: 'idle',
    modeUntil: 0,
    slot: null,
    // Escalonadas de proposito: quatro gatos com o mesmo relogio apagam todos
    // juntos, e uma "onda de soneca" com uma mao so e injusta — nao dificil,
    // injusta. Escalonar transforma a onda em rodizio.
    energy: 1 - i * 0.07,
    hunger: 1 - i * 0.05,
    stress: 0.12 + i * 0.03,
    // Moral tambem escalonada, pela mesma razao das energias.
    moral: 0.62 + i * 0.04,
    petStreak: 0,
    petLastTick: -1,
  }));
