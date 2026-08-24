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
export const TASKS: readonly Omit<Task, 'progress' | 'done' | 'cut' | 'awaitingShip'>[] = [
  // backend
  { id: 'b1', track: 'backend', label: 'schema dos adotaveis', polish: false, cost: TASK_CORE_COST, deps: [] },
  { id: 'b2', track: 'backend', label: 'API /adotar com auth por bigode', polish: false, cost: TASK_CORE_COST, deps: ['b1'] },
  { id: 'b3', track: 'backend', label: 'cache de sardinha', polish: true, cost: TASK_POLISH_COST, deps: ['b2'] },
  // design
  { id: 'd1', track: 'design', label: 'design system Patinha', polish: false, cost: TASK_CORE_COST, deps: [] },
  { id: 'd2', track: 'design', label: 'fluxo de adocao acessivel', polish: false, cost: TASK_CORE_COST, deps: ['d1'] },
  { id: 'd3', track: 'design', label: 'modo escuro (para gatos)', polish: true, cost: TASK_POLISH_COST, deps: ['d1'] },
  // frontend
  { id: 'f1', track: 'frontend', label: 'onboarding com novelo', polish: false, cost: TASK_CORE_COST, deps: ['d1'] },
  { id: 'f2', track: 'frontend', label: 'dashboard de adocoes', polish: false, cost: TASK_CORE_COST, deps: ['b2', 'd1'] },
  { id: 'f3', track: 'frontend', label: 'confete de lazinha', polish: true, cost: TASK_POLISH_COST, deps: ['f2'] },
  // devops
  { id: 'o1', track: 'devops', label: 'pipeline de deploy', polish: false, cost: TASK_CORE_COST, deps: ['b1'] },
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

/** Coordenadas de cena (480x270). O balcao do cafe cuida da fome. */
export const SLOTS: readonly { id: SlotId; x: number; y: number; track: Track | null }[] = [
  { id: 'desk-backend', x: 96, y: 118, track: 'backend' },
  { id: 'desk-frontend', x: 192, y: 118, track: 'frontend' },
  { id: 'desk-design', x: 288, y: 118, track: 'design' },
  { id: 'desk-devops', x: 384, y: 118, track: 'devops' },
  { id: 'puff', x: 60, y: 214, track: null },
  { id: 'rack', x: 424, y: 206, track: null },
  { id: 'cafe', x: 240, y: 226, track: null },
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
  }));
