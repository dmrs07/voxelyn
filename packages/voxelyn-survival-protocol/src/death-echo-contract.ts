// O contrato coletivo: uma seed que a companhia publica para todos.
//
// A ideia inteira depende de algo que o Voxelyn já tinha e que não custa nada
// aqui: uma run é reproduzível por um único número, e os três setores derivam
// dele. "Mesmo mapa para todos" portanto NÃO exige mapa permanente, servidor de
// mundo nem persistência de terreno — exige publicar um número.
//
// É essa economia que faz o contrato valer a pena. Ele não é um modo de jogo
// novo; é a run normal com a seed fixada e o pool consultado pela seed em vez de
// pela topologia. Nesse mapa as cápsulas voltam à coordenada REAL, e a
// experiência muda de "alguém morreu numa situação parecida com esta" para
// "alguém morreu exatamente aqui".
//
// O id e a seed são derivados do CALENDÁRIO, não sorteados e não guardados. Duas
// instâncias do servidor, um cliente offline e um teste chegam ao mesmo contrato
// para o mesmo instante sem trocar uma palavra — e um contrato que dependesse de
// uma linha no banco morreria com ela.

import { deathEchoHash } from './death-echo.js';

export type DeathEchoContractCadence = 'daily' | 'weekly';

export type DeathEchoContract = {
  /** `2026-07-30` no diário, `2026-W31` no semanal. */
  id: string;
  cadence: DeathEchoContractCadence;
  seed: number;
  /** O texto que a companhia usa. Nunca contém nome de jogador. */
  label: string;
  opensAt: string;
  closesAt: string;
  /**
   * Contrato ranqueado.
   *
   * Quando verdadeiro, ecos exatos permanecem visuais e informativos. A razão
   * está na spec §4: se eles dessem módulo ou mudassem inimigos, quem entrasse
   * mais tarde jogaria contra um mapa diferente de quem jogou de manhã, e o
   * placar compararia duas coisas que não são a mesma.
   */
  ranked: boolean;
};

const MS_PER_DAY = 86_400_000;

const pad = (value: number): string => String(value).padStart(2, '0');

/** Dia UTC de um instante. UTC e não local: o contrato é o mesmo no mundo todo. */
export const contractDayKey = (at: Date): string =>
  `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`;

/**
 * Semana ISO-8601 de um instante.
 *
 * Semana começa na segunda e pertence ao ano que contém a sua quinta-feira. Vale
 * a precisão: uma regra caseira faria o contrato semanal pular ou repetir na
 * virada de ano, e a virada é justamente quando alguém está olhando.
 */
export const contractWeekKey = (at: Date): string => {
  const thursday = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()),
  );
  const isoDay = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - isoDay + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstIsoDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDay + 3);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
};

/**
 * Nomes de veio, na voz da companhia.
 *
 * Letra grega porque a empresa numera depósitos, não os batiza: é o mesmo
 * registro desumanizante de «Unidade de Prospecção 7B-119».
 */
const VEIN_NAMES = [
  'KAPPA',
  'LAMBDA',
  'SIGMA',
  'OMEGA',
  'THETA',
  'ZETA',
  'PSI',
  'DELTA',
  'IOTA',
  'RHO',
] as const;

/**
 * A seed do contrato.
 *
 * Derivada do id com um prefixo próprio para NÃO colidir com nenhuma outra
 * derivação do jogo: a seed do contrato de 30-07 não pode, por acidente, ser a
 * mesma que alguma outra parte do sistema já usa para outra coisa.
 */
export const contractSeed = (id: string): number => deathEchoHash(`voxelyn.echo.contract:${id}`);

const contractLabel = (id: string, cadence: DeathEchoContractCadence): string => {
  const vein = VEIN_NAMES[deathEchoHash(id) % VEIN_NAMES.length];
  if (cadence === 'weekly') {
    const [, week] = id.split('-W');
    return `CONTRATO COLETIVO SEMANA ${week ?? '--'} — VEIO ${vein}`;
  }
  const [, month, day] = id.split('-');
  return `CONTRATO COLETIVO ${day ?? '--'}-${month ?? '--'} — VEIO ${vein}`;
};

const dailyWindow = (at: Date): { opensAt: Date; closesAt: Date } => {
  const opensAt = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  return { opensAt, closesAt: new Date(opensAt.getTime() + MS_PER_DAY) };
};

const weeklyWindow = (at: Date): { opensAt: Date; closesAt: Date } => {
  const monday = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return { opensAt: monday, closesAt: new Date(monday.getTime() + 7 * MS_PER_DAY) };
};

/** O contrato vigente num instante. Função pura do calendário. */
export const deathEchoContract = (
  at: Date,
  cadence: DeathEchoContractCadence = 'daily',
): DeathEchoContract => {
  const id = cadence === 'weekly' ? contractWeekKey(at) : contractDayKey(at);
  const { opensAt, closesAt } = cadence === 'weekly' ? weeklyWindow(at) : dailyWindow(at);
  return {
    id,
    cadence,
    seed: contractSeed(id),
    label: contractLabel(id, cadence),
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    ranked: true,
  };
};

/**
 * Valida um contrato que chegou pela rede.
 *
 * O cliente não confia no servidor para a SEED: ele recebe o id e recalcula. Um
 * servidor comprometido — ou uma resposta em cache de outro dia — poderia
 * anunciar `2026-07-30` com a seed de outra data, e todo mundo naquele contrato
 * jogaria mapas diferentes achando que jogava o mesmo. Recalcular custa um hash
 * e transforma a resposta num anúncio de QUAL contrato está aberto, não de qual
 * mundo carregar.
 */
export const parseDeathEchoContract = (value: unknown): DeathEchoContract | null => {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<DeathEchoContract>;
  if (typeof raw.id !== 'string') return null;
  const cadence: DeathEchoContractCadence = raw.cadence === 'weekly' ? 'weekly' : 'daily';
  const id = cadence === 'weekly'
    ? /^\d{4}-W\d{2}$/.exec(raw.id)?.[0]
    : /^\d{4}-\d{2}-\d{2}$/.exec(raw.id)?.[0];
  if (!id) return null;
  const opensAt = typeof raw.opensAt === 'string' ? raw.opensAt : '';
  const closesAt = typeof raw.closesAt === 'string' ? raw.closesAt : '';
  if (!Number.isFinite(Date.parse(opensAt)) || !Number.isFinite(Date.parse(closesAt))) return null;
  return {
    id,
    cadence,
    seed: contractSeed(id),
    label: contractLabel(id, cadence),
    opensAt,
    closesAt,
    ranked: raw.ranked !== false,
  };
};
