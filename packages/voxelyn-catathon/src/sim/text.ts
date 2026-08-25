import type { TraitId } from './gen.js';
import type { Spec, TaskChoice, Tier } from './types.js';

/**
 * OS TEXTOS DA SIMULACAO, por idioma. O jogo fala ingles por padrao (o maior
 * hackathon do MUNDO) e portugues de casa; a run inteira nasce num idioma —
 * rotulos de tarefa, curriculos, briefings — porque esses textos moram no
 * ESTADO, e estado se gera, nao se traduz depois.
 *
 * Modulo puro, sem DOM: o cliente tem o proprio dicionario (client/i18n.ts)
 * para o que e interface.
 */

export type Locale = 'en' | 'pt';

/** Tres variantes por tarefa, sorteadas pelo gerador. */
export const TASK_TEXT: Record<Locale, Record<string, readonly string[]>> = {
  pt: {
    b1: ['schema dos adotaveis', 'modelo de dados felino', 'schema com historico de ronrons'],
    b2: ['API /adotar com auth por bigode', 'API de matching por vibracao', 'API com auth por patinha'],
    b3: ['cache de sardinha', 'fila de mensagens de miado', 'cache morno de colo'],
    d1: ['design system Patinha', 'design system Almofada', 'design system Novelo'],
    d2: ['fluxo de adocao acessivel', 'fluxo de triagem acessivel', 'jornada do adotante'],
    d3: ['modo escuro (para gatos)', 'microinteracoes de orelha', 'ilustracoes de recibo'],
    f1: ['onboarding com novelo', 'onboarding com laser', 'tour guiado por cheiro'],
    f2: ['dashboard de adocoes', 'dashboard em tempo real', 'painel da fila de espera'],
    f3: ['confete de lazinha', 'easter egg do ronrom', 'animacao de pouso de pata'],
    o1: ['pipeline de deploy', 'pipeline com gate de soneca', 'deploy azul-cinza (daltonico)'],
    o2: ['miau-metrics no grafana', 'alertas por bigode', 'observabilidade de tigela'],
    o3: ['autoscaling de sonecas', 'backup em caixa de papelao', 'chaos monkey (literal)'],
  },
  en: {
    b1: ['adoptables schema', 'feline data model', 'schema with purr history'],
    b2: ['/adopt API with whisker auth', 'vibe-matching API', 'API with paw auth'],
    b3: ['sardine cache', 'meow message queue', 'warm-lap cache'],
    d1: ['Pawprint design system', 'Cushion design system', 'Yarnball design system'],
    d2: ['accessible adoption flow', 'accessible triage flow', 'adopter journey'],
    d3: ['dark mode (for cats)', 'ear micro-interactions', 'receipt illustrations'],
    f1: ['yarn-ball onboarding', 'laser-pointer onboarding', 'scent-guided tour'],
    f2: ['adoption dashboard', 'realtime dashboard', 'waitlist panel'],
    f3: ['ribbon confetti', 'purr easter egg', 'paw-landing animation'],
    o1: ['deploy pipeline', 'pipeline with nap gate', 'blue-gray deploy (colorblind)'],
    o2: ['meow-metrics in grafana', 'whisker alerts', 'bowl observability'],
    o3: ['nap autoscaling', 'cardboard-box backup', 'chaos monkey (literal)'],
  },
};

/** As tres DECISOES (b1/d1/o1): ids estaveis, texto por idioma. */
export const CHOICE_TEXT: Record<Locale, Record<string, TaskChoice>> = {
  pt: {
    b1: {
      prompt: 'arquitetura do backend?',
      options: [
        { id: 'monolito', label: 'monolito felino', hint: 'rapido agora, divida depois' },
        { id: 'micro', label: 'microsservicos', hint: 'caro agora, backend rende depois' },
        { id: 'serverless', label: 'serverless do sponsor', hint: 'rapidissimo, e se a API deles cair na demo?' },
      ],
    },
    d1: {
      prompt: 'como atacar a UI?',
      options: [
        { id: 'sistemaPrimeiro', label: 'design system primeiro', hint: 'lento agora, telas rendem depois' },
        { id: 'componentesLocais', label: 'componentes locais', hint: 'rapido, inconsistencia vira divida' },
        { id: 'templateSponsor', label: 'template do sponsor', hint: 'muito rapido, zero originalidade' },
      ],
    },
    o1: {
      prompt: 'como vai ao ar?',
      options: [
        { id: 'pipelineCompleto', label: 'pipeline completo', hint: 'caro, e a demo agradece' },
        { id: 'deployNaMao', label: 'deploy na mao', hint: 'rapido, divida na certa' },
        { id: 'presetSponsor', label: 'preset do sponsor', hint: 'confortavel, e amarra a demo neles' },
      ],
    },
  },
  en: {
    b1: {
      prompt: 'backend architecture?',
      options: [
        { id: 'monolito', label: 'feline monolith', hint: 'fast now, debt later' },
        { id: 'micro', label: 'microservices', hint: 'pricey now, backend pays off later' },
        { id: 'serverless', label: 'sponsor serverless', hint: 'blazing fast — and if their API dies mid-demo?' },
      ],
    },
    d1: {
      prompt: 'how do we attack the UI?',
      options: [
        { id: 'sistemaPrimeiro', label: 'design system first', hint: 'slow now, screens pay off later' },
        { id: 'componentesLocais', label: 'local components', hint: 'fast, inconsistency becomes debt' },
        { id: 'templateSponsor', label: 'sponsor template', hint: 'very fast, zero originality' },
      ],
    },
    o1: {
      prompt: 'how does it ship?',
      options: [
        { id: 'pipelineCompleto', label: 'full pipeline', hint: 'pricey, and the demo thanks you' },
        { id: 'deployNaMao', label: 'deploy by hand', hint: 'fast, guaranteed debt' },
        { id: 'presetSponsor', label: 'sponsor preset', hint: 'comfy, and ties the demo to them' },
      ],
    },
  },
};

export const NOTES_TEXT: Record<Locale, readonly string[]> = {
  pt: [
    'referencias impecaveis, exceto por um vaso.',
    'trabalhou no booth vencedor do ano passado. dormiu no trofeu.',
    'pediu para nao trabalhar perto de aspiradores.',
    'so aceita reuniao depois do cafe. do cafe DELE.',
    'trouxe o proprio teclado. e o proprio rato (de brinquedo).',
    'ex-startup de comedouros: saiu quando pivotaram para caes.',
  ],
  en: [
    'impeccable references, except for one vase.',
    "worked at last year's winning booth. slept on the trophy.",
    'asked to never work near vacuum cleaners.',
    'only takes meetings after coffee. THEIR coffee.',
    'brought their own keyboard. and their own mouse (a toy one).',
    'ex food-bowl startup: left when they pivoted to dogs.',
  ],
};

export const CVS_TEXT: Record<Locale, readonly string[]> = {
  pt: [
    'oito anos de experiencia em derrubar objetos de mesas.',
    'fluente em quatro linguagens e dois miados regionais.',
    'lidera pela frente, especialmente na fila do atum.',
    'serenidade comprovada em incidentes (dormiu durante um).',
    'portfolio inteiro em caixas de papelao numeradas.',
    'nunca perdeu um deploy. ja perdeu tres bolinhas atras da geladeira.',
  ],
  en: [
    'eight years of experience knocking objects off tables.',
    'fluent in four languages and two regional meows.',
    'leads from the front, especially in the tuna line.',
    'proven calm under incidents (slept through one).',
    'entire portfolio in numbered cardboard boxes.',
    'never lost a deploy. has lost three toy balls behind the fridge.',
  ],
};

export const DOMAINS_TEXT: Record<Locale, readonly string[]> = {
  pt: [
    'triagem veterinaria por IA',
    'logistica de peixes sustentaveis',
    'avaliacao de caixas de papelao',
    'adocao de gatos com IA',
    'monitoramento de sonecas coletivas',
    'entrega de petiscos por drone',
  ],
  en: [
    'AI-powered vet triage',
    'sustainable fish logistics',
    'cardboard box reviews',
    'AI-assisted cat adoption',
    'collective nap monitoring',
    'treat delivery by drone',
  ],
};

export const AUDIENCES_TEXT: Record<Locale, readonly string[]> = {
  pt: ['abrigos', 'catios urbanos', 'clinicas', 'condominios felinos', 'ONGs'],
  en: ['shelters', 'urban catios', 'clinics', 'feline condos', 'nonprofits'],
};

export const CONSTRAINTS_TEXT: Record<Locale, readonly string[]> = {
  pt: ['com modo offline', 'acessivel', 'com dados sensiveis', 'em tempo real', 'sustentavel'],
  en: ['with offline mode', 'accessible', 'with sensitive data', 'in real time', 'sustainable'],
};

export const TRAIT_TEXT: Record<Locale, Record<TraitId, string>> = {
  pt: {
    'cacador-de-bugs': 'cacador de bugs',
    'dorme-rapido': 'dorme rapido',
    polidactila: 'digitacao polidactila',
    'pitchador-nato': 'pitchador nato',
    'gambiarra-elegante': 'gambiarra elegante',
    zen: 'zen',
    'dorme-no-teclado': 'dorme no teclado',
    'zoomies-noturnos': 'zoomies noturnos',
    'producao-em-main': 'producao direta em main',
    'detesta-legado': 'detesta legado',
    'medo-de-palco': 'medo de palco',
    guloso: 'guloso',
    'recusa-css': 'recusa CSS',
  },
  en: {
    'cacador-de-bugs': 'bug hunter',
    'dorme-rapido': 'fast sleeper',
    polidactila: 'polydactyl typing',
    'pitchador-nato': 'born pitcher',
    'gambiarra-elegante': 'elegant kludge',
    zen: 'zen',
    'dorme-no-teclado': 'sleeps on keyboard',
    'zoomies-noturnos': 'night zoomies',
    'producao-em-main': 'commits straight to main',
    'detesta-legado': 'hates legacy',
    'medo-de-palco': 'stage fright',
    guloso: 'always hungry',
    'recusa-css': 'refuses CSS',
  },
};

export const TIER_TEXT: Record<Locale, Record<Tier, string>> = {
  pt: { junior: 'junior', pleno: 'pleno', senior: 'senior', especialista: 'especialista' },
  en: { junior: 'junior', pleno: 'mid-level', senior: 'senior', especialista: 'specialist' },
};

export const SPEC_TEXT: Record<Locale, Record<Spec, string>> = {
  pt: { backend: 'backend', frontend: 'frontend', design: 'design', devops: 'devops', freestyler: 'freestyler' },
  en: { backend: 'backend', frontend: 'frontend', design: 'design', devops: 'devops', freestyler: 'freestyler' },
};

/** As tres moedas fisicas, por idioma. */
export const CURRENCY_TEXT: Record<Locale, { fish: [string, string]; ball: [string, string]; cap: [string, string]; free: string }> = {
  pt: { fish: ['peixinho', 'peixinhos'], ball: ['bolinha', 'bolinhas'], cap: ['tampinha', 'tampinhas'], free: 'de graca' },
  en: { fish: ['goldfish', 'goldfish'], ball: ['toy ball', 'toy balls'], cap: ['bottle cap', 'bottle caps'], free: 'free' },
};

export const CLASSIC_BIO: Record<Locale, Record<string, { note: string; cv: string }>> = {
  pt: {
    bigode: { note: 'arquitetura impecavel, recusa CSS.', cv: 'nao deixa mergear sem um "shipa" teu.' },
    cheeto: { note: 'um neuronio, confianca infinita.', cv: 'shipa sem testar.' },
    almofada: { note: 'ocupa tres cadeiras, calmo ate no incendio.', cv: 'cochila no servidor.' },
    smoking: { note: 'interfaces lindas; sofre em silencio a cada bug vivo.', cv: 'ele SABE.' },
  },
  en: {
    bigode: { note: 'impeccable architecture, refuses CSS.', cv: 'will not let anything merge without your "ship it".' },
    cheeto: { note: 'one neuron, infinite confidence.', cv: 'ships without testing.' },
    almofada: { note: 'occupies three chairs, calm even mid-fire.', cv: 'naps on the server.' },
    smoking: { note: 'beautiful interfaces; suffers silently at every live bug.', cv: 'he KNOWS.' },
  },
};
