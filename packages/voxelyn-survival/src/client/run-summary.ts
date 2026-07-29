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

import { TICK_HZ } from '@voxelyn/survival-sim';
import type { DamageCause, EnemyArchetype, RunSummary } from '@voxelyn/survival-sim';

const ARCHETYPE_NAMES: Record<EnemyArchetype, string> = {
  stalker: 'Espreitador',
  spitter: 'Cuspidor',
  bomber: 'Portador de Esporos',
  bruiser: 'Britador',
  fungal_horse: 'Corcel',
  bishop: 'Bispo',
  miner: 'Mineiro',
  guardian: 'Guardião',
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
  if (!cause) return { headline: 'Você saiu inteiro', lesson: '' };
  switch (cause.kind) {
    case 'enemy_contact':
      return {
        headline: `${ARCHETYPE_NAMES[cause.archetype]}${cause.elite ? ' mutado' : ''} te alcançou`,
        lesson: 'Corpo a corpo é telegrafado. O som do windup chega antes do golpe.',
      };
    case 'enemy_projectile':
      return {
        headline: `${ARCHETYPE_NAMES[cause.archetype]}${cause.elite ? ' mutado' : ''} te acertou de longe`,
        lesson:
          cause.projectile === 'rock'
            ? 'O arremesso avisa por 0,8 s antes de sair. Quebre a linha de visão ou desvie de lado.'
            : 'Cuspe deixa poça de biofluido. Recuar em linha reta te mantém no caminho dela.',
      };
    case 'fire':
      return {
        headline: 'O fogo te consumiu',
        lesson: 'Chama caminha por biofluido e fungo. O chão pega antes de você ver a chama.',
      };
    case 'gas':
      return {
        headline: 'O gás sulfúrico te dissolveu',
        lesson: 'Gás se acumula em espaço fechado. O pulso cinético dissipa a nuvem.',
      };
    case 'spores':
      return {
        headline: 'Os esporos te tomaram',
        lesson: 'A nuvem do Portador não se espalha, mas fica. Saia dela em vez de atravessá-la.',
      };
    case 'discharge':
      return cause.source === 'player'
        ? {
            headline: 'Sua própria descarga te pegou',
            lesson: 'Condutivo percorre a poça inteira. Antes de eletrificar, olhe onde você pisa.',
          }
        : {
            headline: 'Uma descarga te pegou na poça',
            lesson: 'Cristal quebrado eletrifica todo biofluido conectado. Poça é terreno hostil.',
          };
    case 'explosion':
      return cause.source === 'player'
        ? {
            headline: 'Você se explodiu',
            lesson: 'O módulo explosivo arma a 2,25 tiles. Em corredor, ele volta para você.',
          }
        : {
            headline: 'Uma explosão te alcançou',
            lesson:
              'O Portador detona ao morrer. Matá-lo de perto é o mesmo que detoná-lo em você.',
          };
    case 'overheat':
      return {
        headline: 'Sua arma superaqueceu em você',
        lesson: 'O calor sobe a cada tiro e o apito sobe junto. Solte o gatilho antes do topo.',
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
      // coisa: o tempo acabou antes de alguem chegar.
      return {
        headline: 'Você se apagou no escuro',
        lesson: 'Abatido dura 20 s. Caia perto do parceiro, não no meio da sala.',
      };
    case 'player_shot':
    case 'unknown':
    default:
      return { headline: 'O Veio te consumiu', lesson: '' };
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
      : '—';
  return [
    { label: 'Tempo', value: formatDuration(summary.ticks) },
    { label: 'Contaminação', value: `${Math.round(summary.contamination * 100)}%` },
    { label: 'Abates', value: String(totalKills) },
    { label: 'Dano causado', value: String(Math.round(stats.damageDealtTenths / 10)) },
    { label: 'Dano sofrido', value: String(Math.round(stats.damageTakenTenths / 10)) },
    { label: 'Dano/tiro', value: accuracy },
    { label: 'Salvage', value: String(stats.salvageCompleted) },
    { label: 'Módulos', value: String(stats.modulesAcquired) },
    { label: 'Minério', value: String(stats.oreCollected) },
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
  const corpo = n === 1 ? '1 unidade inativa destruída' : `${n} unidades inativas destruídas`;
  return `REGISTRO CORPORATIVO: ${corpo} — sem valor de recuperação.`;
};

export type OutcomeText = { title: string; color: 'blood' | 'loot' | 'biolum' };

export const describeOutcome = (summary: RunSummary): OutcomeText => {
  if (summary.phase === 'extracted_with_core') {
    return { title: 'NÚCLEO EXTRAÍDO', color: 'biolum' };
  }
  if (summary.phase === 'extracted') return { title: 'EXTRAÍDO SEM O NÚCLEO', color: 'loot' };
  return { title: 'O VEIO TE CONSUMIU', color: 'blood' };
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
    return `★★★ exige o núcleo em ${formatDuration(summary.targetTicks)} — você passou ${formatDuration(over)}.`;
  }
  if (summary.phase === 'extracted') return '★★ exige sair com o núcleo do Guardião.';
  return '★ exige alcançar a extração vivo.';
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
