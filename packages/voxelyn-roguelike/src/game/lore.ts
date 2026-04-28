import type { EnemyArchetype } from './types';

export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type FloorTheme = {
  id: string;
  name: string;
  subtitle: string;
  lore: string;
  accent: string;
  bgTop: string;
  bgBottom: string;
  floorTint: RGB;
  wallTint: RGB;
  threat: EnemyArchetype;
};

export type EnemyLore = {
  code: string;
  displayName: string;
  role: string;
  shortRole: string;
  encounter: string;
};

export const ENEMY_LORE: Record<EnemyArchetype, EnemyLore> = {
  stalker: {
    code: 'E01',
    displayName: 'Striker',
    role: 'predador de emboscada guiado por vibracao',
    shortRole: 'emboscada',
    encounter: 'O Striker sente vibracoes e acelera quando o Excavator se move perto demais.',
  },
  bruiser: {
    code: 'E02',
    displayName: 'Bruiser',
    role: 'vanguarda de choque e controle de territorio',
    shortRole: 'bloqueio',
    encounter: 'O Bruiser fecha passagens com corpo pesado e manoplas osseas.',
  },
  spitter: {
    code: 'E03',
    displayName: 'Spitter',
    role: 'atacante a distancia com bile corrosiva',
    shortRole: 'bile',
    encounter: 'O Spitter cospe bile que continua queimando o piso depois do impacto.',
  },
  spore_bomber: {
    code: 'E04',
    displayName: 'Spore Bomber',
    role: 'unidade explosiva de longo alcance e sacrificio',
    shortRole: 'explosao',
    encounter: 'O Bomber carrega uma capsula instavel e espalha infeccao ao detonar.',
  },
  guardian: {
    code: 'E05',
    displayName: 'Guardian',
    role: 'sentinela defensiva do nucleo fungico',
    shortRole: 'sentinela',
    encounter: 'O Guardian projeta uma protecao roxa que reduz dano recebido por aliados proximos.',
  },
};

export const FLOOR_THEMES: FloorTheme[] = [
  {
    id: 'ether_mines',
    name: 'Minas de Eter',
    subtitle: 'cristais azuis, trilhos e ruinas mecanicas',
    lore: 'O Excavator desperta entre corredores de mineracao abandonados, seguindo veios de cristal de eter.',
    accent: '#5ed0ec',
    bgTop: '#071524',
    bgBottom: '#040811',
    floorTint: { r: 60, g: 154, b: 166 },
    wallTint: { r: 72, g: 104, b: 132 },
    threat: 'stalker',
  },
  {
    id: 'ambush_warren',
    name: 'Fendas de Emboscada',
    subtitle: 'cristais vermelhos e corredores de vibracao',
    lore: 'As primeiras ondas de corrupcao afiaram predadores que cacam cada passo no solo.',
    accent: '#e04f5f',
    bgTop: '#160b18',
    bgBottom: '#050711',
    floorTint: { r: 127, g: 52, b: 72 },
    wallTint: { r: 92, g: 48, b: 70 },
    threat: 'stalker',
  },
  {
    id: 'colmeia_umida',
    name: 'Colmeia Umida',
    subtitle: 'fungos verdes, bile corrosiva e ar saturado',
    lore: 'A colonia fungica dissolve estruturas e abre caminho com bile fermentada.',
    accent: '#6fe19a',
    bgTop: '#0a1a16',
    bgBottom: '#04090a',
    floorTint: { r: 70, g: 158, b: 86 },
    wallTint: { r: 64, g: 102, b: 74 },
    threat: 'spitter',
  },
  {
    id: 'camara_de_impacto',
    name: 'Camara de Impacto',
    subtitle: 'arenas subterraneas, osso roxo e portoes selados',
    lore: 'Bruisers guardam camaras de passagem: onde se posicionam, a rota se fecha.',
    accent: '#b56aff',
    bgTop: '#130f24',
    bgBottom: '#050610',
    floorTint: { r: 106, g: 74, b: 142 },
    wallTint: { r: 90, g: 76, b: 116 },
    threat: 'bruiser',
  },
  {
    id: 'bercario_volatil',
    name: 'Bercario Volatil',
    subtitle: 'capsulas de esporos, brilho amarelo e sacrificio',
    lore: 'A colonia cultiva bombas vivas para espalhar infeccao antes que o invasor alcance o nucleo.',
    accent: '#f6c453',
    bgTop: '#171024',
    bgBottom: '#07060d',
    floorTint: { r: 118, g: 76, b: 150 },
    wallTint: { r: 93, g: 72, b: 118 },
    threat: 'spore_bomber',
  },
  {
    id: 'porta_ancestral',
    name: 'Porta Ancestral',
    subtitle: 'sentinelas antigas, armadura ossea e nucleo roxo',
    lore: 'Um sentinela antigo desperta para proteger a ultima porta da cidade subterranea.',
    accent: '#c86bff',
    bgTop: '#150d25',
    bgBottom: '#05050d',
    floorTint: { r: 122, g: 78, b: 160 },
    wallTint: { r: 118, g: 104, b: 126 },
    threat: 'guardian',
  },
];

export const getFloorTheme = (floorNumber: number): FloorTheme => {
  if (floorNumber <= 1) return FLOOR_THEMES[0]!;
  if (floorNumber <= 3) return FLOOR_THEMES[1]!;
  if (floorNumber <= 5) return FLOOR_THEMES[2]!;
  if (floorNumber <= 7) return FLOOR_THEMES[3]!;
  if (floorNumber <= 9) return FLOOR_THEMES[4]!;
  return FLOOR_THEMES[5]!;
};

export const enemyDisplayName = (archetype: EnemyArchetype): string =>
  ENEMY_LORE[archetype]?.displayName ?? archetype;

export const enemyCodexLabel = (archetype: EnemyArchetype): string => {
  const lore = ENEMY_LORE[archetype];
  return lore ? `${lore.code} ${lore.displayName}` : archetype;
};
