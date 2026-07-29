// Traducao de evento semantico autoritativo para pedido de som.
//
// Este arquivo e o gemeo auditivo de `particles.ingest` e existe pelo mesmo
// motivo: o cliente nunca DECIDE que houve explosao, so a apresenta. Duas
// maquinas de uma sala de co-op recebem o mesmo evento e pedem a mesma voz,
// entao ouvem a mesma coisa sem trocar um byte a mais.
//
// Nada aqui toca nada. A funcao devolve descricoes; quem decide o que cabe no
// orcamento e o mixer, e quem faz barulho e o synth. Essa separacao e o que
// permite testar a parte que importa — QUE som sai e de ONDE — num ambiente
// Node, sem AudioContext.

import { SOLID_CRYSTAL, SOLID_CRYSTAL_DULL } from '@voxelyn/survival-sim';
import type { EntityActionKind, SemanticEvent } from '@voxelyn/survival-sim';
import type { VoiceId } from './voices';

export type Cue = {
  voice: VoiceId;
  /** Posicao no mundo, em tiles. Ignorada quando a voz nao e espacial. */
  x: number;
  y: number;
  /**
   * Multiplicador sobre o ganho base da voz, 0..1+.
   *
   * Serve para variacao DENTRO de uma mesma voz — um golpe de 40 e um de 6
   * usam `hitEnemy`, e seria errado soarem identicos. Nao substitui a
   * atenuacao por distancia, que e do mixer.
   */
  scale: number;
};

/**
 * Telegrafo de cada acao.
 *
 * `null` significa "esta acao nao avisa" e existe so para `player_shot`: o
 * disparo do proprio jogador ja tem `shot`, e emitir tambem um telegrafo daria
 * dois sons por tiro.
 *
 * Vozes distintas por tipo de acao sao o ponto do sistema, nao um capricho:
 * `hurl` e `charge` chegam do bruiser com o mesmo corpo na tela, e o que separa
 * "sai da frente" de "recua" e justamente qual dos dois comecou. Um bipe
 * generico devolveria o problema ao visual, que ja esta saturado.
 */
const TELEGRAPH_VOICE: Record<EntityActionKind, VoiceId | null> = {
  player_shot: null,
  ranged: 'telegraphRanged',
  contact: 'telegraphCharge',
  charge: 'telegraphCharge',
  detonate: 'telegraphDetonate',
  slam: 'telegraphSlam',
  hurl: 'telegraphHurl',
  pulse: 'telegraphPulse',
};

/** Centro geometrico de uma descarga, em tiles. */
const dischargeCentroid = (
  cells: readonly number[],
  worldWidth: number,
): { x: number; y: number } => {
  let cx = 0;
  let cy = 0;
  for (const cell of cells) {
    cx += (cell % worldWidth) + 0.5;
    cy += Math.floor(cell / worldWidth) + 0.5;
  }
  return { x: cx / cells.length, y: cy / cells.length };
};

/**
 * Escala de um impacto pelo dano.
 *
 * Raiz e nao linear pelo mesmo motivo que o numero de dano usa raiz: linear,
 * um golpe de 42 sairia sete vezes mais alto que um de 6 e estouraria o
 * barramento sozinho. O piso de 0,55 garante que o golpe fraco continue
 * audivel — um acerto que nao soa le como um erro.
 */
export const impactScale = (amount: number): number =>
  Math.min(1.4, 0.55 + Math.sqrt(Math.max(0, amount)) / 7);

export type CueContext = {
  worldWidth: number;
  /** Id da entidade do jogador local: separa "levei dano" de "dei dano". */
  localPlayerId: number;
};

/**
 * Converte UM evento em zero ou mais pedidos de som.
 *
 * Devolve array porque alguns eventos merecem duas camadas (a morte do
 * guardiao e um impacto E um sting), e porque devolver `null` obrigaria todo
 * chamador a testar.
 */
export const cuesForEvent = (ev: SemanticEvent, ctx: CueContext): Cue[] => {
  switch (ev.t) {
    case 'action_start': {
      const voice = TELEGRAPH_VOICE[ev.action];
      if (!voice) return [];
      return [{ voice, x: ev.x, y: ev.y, scale: 1 }];
    }

    case 'shot':
      return [{ voice: 'shot', x: ev.x, y: ev.y, scale: 1 }];

    case 'hit': {
      const mine = ev.target === ctx.localPlayerId;
      return [
        {
          voice: mine ? 'hitPlayer' : 'hitEnemy',
          x: ev.x,
          y: ev.y,
          scale: impactScale(ev.amount),
        },
      ];
    }

    case 'death':
      // O guardiao ganha voz propria porque a morte dele e o fim de um ato, nao
      // mais um bicho caindo. Reaproveitar `death` com ganho maior nao resolve:
      // o que muda nao e o volume, e o que o som DIZ.
      //
      // O bispo divide a voz com o guardiao porque divide o PAPEL: os dois sao o
      // fim de um ato. Dar a ele um terceiro sting seria gastar uma voz nova
      // para dizer a mesma coisa, e o jogador nao precisa distinguir os dois
      // pelo som — ele acabou de passar cinco minutos olhando para o que caiu.
      //
      // O mineiro tem voz propria pelo motivo inverso ao dos chefes: nao porque
      // a morte dele encerra alguma coisa, mas porque ele e a unica PESSOA do
      // bestiario. Deixa-lo no `death` generico faria o jogo dizer que matar
      // alguem que estava trabalhando soa igual a estourar um bomber — e tudo
      // no encontro dele existe para dizer o contrario.
      if (ev.archetype === 'miner') return [{ voice: 'deathMiner', x: ev.x, y: ev.y, scale: 1 }];
      return ev.archetype === 'guardian' || ev.archetype === 'bishop'
        ? [{ voice: 'deathGuardian', x: ev.x, y: ev.y, scale: 1 }]
        : [{ voice: 'death', x: ev.x, y: ev.y, scale: 1 }];

    // A cura do bispo E a informacao da luta. Sem som, o jogador so descobre que
    // nao esta progredindo comparando a barra de vida com a memoria do que ela
    // era ha dez segundos — que e a forma mais lenta possivel de aprender uma
    // regra. Com som, ele ouve o chao trabalhando contra ele enquanto atira.
    case 'heal':
      return [{ voice: 'bishopHeal', x: ev.x, y: ev.y, scale: 1 }];

    // Duas vozes bem diferentes para a MESMA transicao, porque o que o jogador
    // precisa saber e qual das duas aconteceu — e ele precisa saber sem olhar.
    case 'miner_mood':
      return [{ voice: ev.mood === 2 ? 'minerRage' : 'minerFlee', x: ev.x, y: ev.y, scale: 1 }];

    case 'ore_gained':
      return [{ voice: 'oreGained', x: ev.x, y: ev.y, scale: Math.min(1.3, 0.7 + ev.amount / 10) }];

    case 'explosion':
      // Explosao maior soa maior, mas com teto: o raio do modulo explosivo e
      // fixo, entao a variacao aqui e pequena de proposito.
      return [{ voice: 'explosion', x: ev.x, y: ev.y, scale: Math.min(1.25, 0.7 + ev.radius / 8) }];

    case 'discharge': {
      if (ev.cells.length === 0) return [];
      const { x, y } = dischargeCentroid(ev.cells, ctx.worldWidth);
      // Uma poca grande descarregando e mais alta que uma celula solta — e a
      // unica pista de QUANTO da poca voce esta pisando.
      return [{ voice: 'discharge', x, y, scale: Math.min(1.3, 0.6 + ev.cells.length / 24) }];
    }

    case 'ignite':
      return [{ voice: 'ignite', x: ev.x, y: ev.y, scale: 1 }];

    case 'break':
      return [
        {
          voice:
            ev.solid === SOLID_CRYSTAL || ev.solid === SOLID_CRYSTAL_DULL
              ? 'breakCrystal'
              : 'breakRock',
          x: ev.x,
          y: ev.y,
          scale: 1,
        },
      ];

    case 'corrode':
      return [{ voice: 'corrode', x: ev.x, y: ev.y, scale: 1 }];

    case 'chip':
      return [{ voice: 'chip', x: ev.x, y: ev.y, scale: 1 }];

    case 'dodge':
      return [{ voice: 'dodge', x: ev.x, y: ev.y, scale: 1 }];

    case 'pulse':
      return [{ voice: 'pulse', x: ev.x, y: ev.y, scale: 1 }];

    case 'overheat':
      return [{ voice: 'overheat', x: ev.x, y: ev.y, scale: 1 }];

    case 'pickup_core':
      return [{ voice: 'pickupCore', x: ev.x, y: ev.y, scale: 1 }];

    case 'terminal_activated':
      return [{ voice: 'terminalStart', x: ev.x, y: ev.y, scale: 1 }];

    case 'terminal_scan_complete':
      return [{ voice: 'terminalDone', x: ev.x, y: ev.y, scale: 1 }];

    case 'salvage_cache_revealed':
      return [{ voice: 'cacheRevealed', x: ev.x, y: ev.y, scale: 1 }];

    case 'salvage_cache_opened':
      return [{ voice: 'cacheOpened', x: ev.x, y: ev.y, scale: 1 }];

    case 'purge_cell_acquired':
      return [{ voice: 'purgeAcquired', x: 0, y: 0, scale: 1 }];

    case 'purge_cell_used':
      return [{ voice: 'purgeUsed', x: ev.x, y: ev.y, scale: 1 }];

    case 'module_selected':
      return [{ voice: 'moduleSelected', x: 0, y: 0, scale: 1 }];

    case 'module_charge_consumed':
      // A carga que ACABA soa diferente das outras. Sem isso o jogador so
      // descobre que ficou sem modulo no tiro seguinte, que ja saiu errado.
      return [{ voice: 'moduleCharge', x: 0, y: 0, scale: ev.remaining === 0 ? 1.3 : 0.8 }];

    case 'module_expired':
      return [{ voice: 'moduleExpired', x: 0, y: 0, scale: 1 }];

    case 'guardian_awake':
      return [{ voice: 'guardianAwake', x: 0, y: 0, scale: 1 }];

    case 'player_down':
      return [{ voice: 'playerDown', x: ev.x, y: ev.y, scale: 1 }];

    case 'revive':
      return [{ voice: 'revive', x: ev.x, y: ev.y, scale: 1 }];

    case 'extracted':
      return [{ voice: 'extracted', x: 0, y: 0, scale: ev.withCore ? 1 : 0.8 }];

    case 'message':
      // Texto nao tem som proprio: o evento que gerou a mensagem ja soou.
      return [];

    default:
      return [];
  }
};

/** Traduz uma leva inteira de eventos, preservando a ordem de chegada. */
export const cuesForEvents = (events: readonly SemanticEvent[], ctx: CueContext): Cue[] => {
  const out: Cue[] = [];
  for (const ev of events) {
    for (const cue of cuesForEvent(ev, ctx)) out.push(cue);
  }
  return out;
};
