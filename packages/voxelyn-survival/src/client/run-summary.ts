// A tela de fim, como texto. Sem canvas aqui: so a decisao do que dizer.
//
// A tela antiga dizia "O VEIO TE CONSUMIU" e mais nada. Tres mortes
// completamente diferentes — o gas que voce mesmo acendeu, a poca que voce
// eletrificou com o proprio modulo, e o Britador que voce nao ouviu chegar —
// chegavam ao jogador como a mesma frase. A spec pede "morte que ensina"
// (secao 15), e uma morte so ensina se ela DISSER o que foi.
//
// Regra que rege todos os textos deste arquivo: a linha de licao fala do que o
// jogador PODE fazer diferente, nunca do que ele fez de errado. "Detone longe
// de paredes" ensina; "voce se explodiu" so informa.
//
// As frases moram no catalogo (`i18n/locales`), e o que sobra aqui e a ESCOLHA
// de qual delas cabe a cada causa — que e a decisao de design de verdade.
// Nenhuma funcao deste arquivo guarda texto em variavel: todas resolvem a
// chave na hora da chamada, porque a tela de fim e redesenhada a cada quadro e
// trocar de idioma no menu de campo tem de valer para ela tambem.

import { TICK_HZ } from '@voxelyn/survival-sim';
import type { DamageCause, EnemyArchetype, RunSummary } from '@voxelyn/survival-sim';
import { t, tCount, type MessageKey } from './i18n';

const ARCHETYPE_KEYS: Record<EnemyArchetype, MessageKey> = {
  stalker: 'enemy.stalker',
  spitter: 'enemy.spitter',
  bomber: 'enemy.bomber',
  bruiser: 'enemy.bruiser',
  fungal_horse: 'enemy.fungal_horse',
  bishop: 'enemy.bishop',
  miner: 'enemy.miner',
  guardian: 'enemy.guardian',
  resonant: 'enemy.resonant',
  mud_lamprey: 'enemy.mud_lamprey',
  bellows: 'enemy.bellows',
  scoriac: 'enemy.scoriac',
  frost_wraith: 'enemy.frost_wraith',
  sulfur_bomber: 'enemy.sulfur_bomber',
  undertaker: 'enemy.undertaker',
};

/**
 * O nome do arquetipo, com a marca de elite quando ela existe.
 *
 * Passa por uma chave propria (`summary.enemy.elite`) em vez de colar um
 * sufixo: em portugues o adjetivo vem depois do nome e em ingles vem antes, e
 * um `name + ' mutado'` so funcionaria na lingua em que foi escrito.
 */
const enemyName = (archetype: EnemyArchetype, elite: boolean): string => {
  const name = t(ARCHETYPE_KEYS[archetype]);
  return elite ? t('summary.enemy.elite', { name }) : name;
};

export type CauseText = { headline: string; lesson: string };

/** Formata ticks como m:ss. */
export const formatDuration = (ticks: number): string => {
  const totalSeconds = Math.floor(ticks / TICK_HZ);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const describeCause = (cause: DamageCause | null): CauseText => {
  if (!cause) return { headline: t('summary.cause.none.headline'), lesson: '' };
  switch (cause.kind) {
    case 'enemy_contact':
      return {
        headline: t('summary.cause.contact.headline', {
          enemy: enemyName(cause.archetype, cause.elite),
        }),
        lesson: t('summary.cause.contact.lesson'),
      };
    case 'enemy_projectile':
      return {
        headline: t('summary.cause.projectile.headline', {
          enemy: enemyName(cause.archetype, cause.elite),
        }),
        lesson: t(
          cause.projectile === 'rock'
            ? 'summary.cause.projectile.rock.lesson'
            : 'summary.cause.projectile.spit.lesson',
        ),
      };
    case 'fire':
      return {
        headline: t('summary.cause.fire.headline'),
        lesson: t('summary.cause.fire.lesson'),
      };
    case 'gas':
      return {
        headline: t('summary.cause.gas.headline'),
        lesson: t('summary.cause.gas.lesson'),
      };
    case 'spores':
      return {
        headline: t('summary.cause.spores.headline'),
        lesson: t('summary.cause.spores.lesson'),
      };
    case 'discharge':
      return cause.source === 'player'
        ? {
            headline: t('summary.cause.discharge.self.headline'),
            lesson: t('summary.cause.discharge.self.lesson'),
          }
        : {
            headline: t('summary.cause.discharge.world.headline'),
            lesson: t('summary.cause.discharge.world.lesson'),
          };
    case 'explosion':
      return cause.source === 'player'
        ? {
            headline: t('summary.cause.explosion.self.headline'),
            lesson: t('summary.cause.explosion.self.lesson'),
          }
        : {
            headline: t('summary.cause.explosion.world.headline'),
            lesson: t('summary.cause.explosion.world.lesson'),
          };
    case 'overheat':
      return {
        headline: t('summary.cause.overheat.headline'),
        lesson: t('summary.cause.overheat.lesson'),
      };
    case 'bleedout':
      // NAO diz "sangrou".
      //
      // O identificador interno e `bleedout` (termo de genero para o relogio do
      // abatido, anterior a este codigo), mas o texto que o jogador le nao pode
      // herdar dele uma afirmacao sobre a MATERIA do Prospector. Nada na art
      // bible diz que ele e organico — ela o descreve como humanoide de traje,
      // com lampada e tanque — e "sangrou" fecharia essa porta numa string de
      // UI, que e o pior lugar possivel para decidir lore.
      //
      // "Apagou" funciona para carne, maquina ou traje selado, e diz a mesma
      // coisa: o tempo acabou antes de alguem chegar. A traducao carrega a
      // mesma regra: nenhuma lingua pode escolher um verbo que decida do que
      // ele e feito.
      return {
        headline: t('summary.cause.bleedout.headline'),
        lesson: t('summary.cause.bleedout.lesson'),
      };
    case 'player_shot':
    case 'unknown':
    default:
      return { headline: t('summary.cause.unknown.headline'), lesson: '' };
  }
};

export type SummaryLine = { label: string; value: string };

/** As linhas de estatistica da tela de fim, na ordem em que sao lidas. */
export const summaryLines = (summary: RunSummary): SummaryLine[] => {
  const { stats } = summary;
  const totalKills = Object.values(stats.kills).reduce((a, b) => a + b, 0);
  const accuracy =
    stats.shotsFired > 0
      ? `${Math.round((stats.damageDealtTenths / 10 / stats.shotsFired) * 10) / 10}`
      : t('summary.stat.none');
  return [
    { label: t('summary.stat.time'), value: formatDuration(summary.ticks) },
    {
      label: t('summary.stat.contamination'),
      value: `${Math.round(summary.contamination * 100)}%`,
    },
    { label: t('summary.stat.kills'), value: String(totalKills) },
    {
      label: t('summary.stat.damageDealt'),
      value: String(Math.round(stats.damageDealtTenths / 10)),
    },
    {
      label: t('summary.stat.damageTaken'),
      value: String(Math.round(stats.damageTakenTenths / 10)),
    },
    { label: t('summary.stat.damagePerShot'), value: accuracy },
    { label: t('summary.stat.salvage'), value: String(stats.salvageCompleted) },
    { label: t('summary.stat.modules'), value: String(stats.modulesAcquired) },
    { label: t('summary.stat.ore'), value: String(stats.oreCollected) },
  ];
};

/**
 * O registro corporativo: quantas unidades passivas voce destruiu.
 *
 * NAO e mais uma celula na grade de numeros, e a diferenca e o ponto inteiro.
 * Ali ele viraria uma metrica entre outras — algo a otimizar, para cima ou para
 * baixo. Como linha propria, em vermelho, com a voz da empresa, ele nao pede
 * nada ao jogador: so registra.
 *
 * "sem valor de recuperacao" faz o trabalho todo, e faz um trabalho DIFERENTE
 * agora que o mineiro e um automato: a empresa esta falando de uma maquina que
 * ela mesma abandonou, ainda cumprindo a ordem que ninguem cancelou, e a unica
 * coisa que ela anota e que nao sobrou nada aproveitavel. O prospector e da
 * mesma geracao. A frase e sobre a empresa, e e uma previsao sobre o jogador.
 *
 * O jogo nao diz nada disso. So mostra a linha.
 *
 * Devolve null em zero: uma linha "0 unidades" toda run transformaria a ausencia
 * de violencia gratuita numa pontuacao, que e o mesmo erro pelo outro lado.
 */
export const reputationNote = (summary: RunSummary): string | null => {
  const n = summary.stats.innocentsKilled;
  if (n <= 0) return null;
  // A frase INTEIRA por chave, e nao "REGISTRO CORPORATIVO: " + contagem: o
  // singular e o plural mudam mais do que a terminacao em varias linguas, e a
  // voz da empresa depende da frase inteira caber numa linha so.
  return tCount({ one: 'summary.reputation.one', other: 'summary.reputation.other' }, n);
};

/**
 * O que a carga desta run virou.
 *
 * A linha e derivada da FASE, e nao da resposta do servidor, de proposito: a
 * tela de resultado aparece no instante em que a run acaba, e esperar a
 * homologacao para dizer "voce perdeu 27 de carga" deixaria a informacao mais
 * importante do loop atras de um spinner de rede.
 *
 * O que ela NAO faz e prometer saldo. Numa morte ela diz o que ficou no Veio —
 * um fato que a simulacao local ja conhece e que nao depende de ninguem. Numa
 * extracao ela anuncia a carga transmitida; o numero creditado chega pelo banner
 * quando o servidor responde (`homologateRun`), e e ele que vale.
 *
 * Devolve null quando a run nao coletou nada: uma linha "0 de carga perdida"
 * transformaria a ausencia de mineracao num placar.
 */
export type CargoNote = { text: string; tone: 'lost' | 'cleared' };

export const cargoNote = (summary: RunSummary): CargoNote | null => {
  const ore = summary.stats.oreCollected;
  if (ore <= 0) return null;
  if (summary.phase === 'dead') {
    return { text: t('summary.cargo.lost', { ore }), tone: 'lost' };
  }
  return {
    text: t(
      summary.phase === 'extracted_with_core' ? 'summary.cargo.core' : 'summary.cargo.cleared',
      { ore },
    ),
    tone: 'cleared',
  };
};

export type OutcomeText = { title: string; color: 'blood' | 'loot' | 'biolum' };

export const describeOutcome = (summary: RunSummary): OutcomeText => {
  if (summary.phase === 'extracted_with_core') {
    return { title: t('summary.outcome.core'), color: 'biolum' };
  }
  if (summary.phase === 'extracted') {
    return { title: t('summary.outcome.extracted'), color: 'loot' };
  }
  return { title: t('summary.outcome.dead'), color: 'blood' };
};

/**
 * A linha que diz o que faltou para a proxima estrela.
 *
 * Existe porque uma nota sem criterio visivel e ruido: o jogador que tira duas
 * estrelas precisa saber que a terceira e a MESMA run com pressa, e nao um
 * objetivo escondido que ele ainda nao encontrou.
 */
export const nextStarHint = (summary: RunSummary): string | null => {
  if (summary.stars === 3) return null;
  if (summary.phase === 'extracted_with_core') {
    const over = summary.ticks - summary.targetTicks;
    return t('summary.nextStar.three', {
      target: formatDuration(summary.targetTicks),
      over: formatDuration(over),
    });
  }
  if (summary.phase === 'extracted') return t('summary.nextStar.two');
  return t('summary.nextStar.one');
};

/** Seed em hexadecimal, o formato em que ela e compartilhada. */
export const formatSeed = (seed: number): string =>
  `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

/** Le uma seed digitada/colada. Aceita hex com ou sem 0x, e decimal. */
export const parseSeed = (raw: string): number | null => {
  const text = raw.trim();
  if (text === '') return null;
  const hex = /^0x[0-9a-f]+$/i.test(text);
  const value = hex ? Number.parseInt(text.slice(2), 16) : Number(text);
  if (!Number.isFinite(value) || value < 0) return null;
  return value >>> 0;
};
