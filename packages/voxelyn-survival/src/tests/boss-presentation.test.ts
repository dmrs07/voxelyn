// O que este arquivo protege: as tres pontas de APRESENTACAO dos chefes que
// existiam so na simulacao e nao chegavam a tela.
//
// A falha original nao dava erro em lugar nenhum, e e por isso que ela durou:
// o renderer tem recuo para tudo. Arquetipo sem atlas vira um losango de cor,
// superficie sem tile vira uma cor chapada, evento sem tratamento simplesmente
// nao acontece. Nada quebra — a informacao e que nao chega. Os testes daqui
// derivam as listas da propria simulacao, entao o bicho, a materia ou o estado
// que nascer amanha e cobrado sozinho.
import { describe, expect, it } from 'vitest';
import { emptyStats } from '@voxelyn/survival-sim';
import {
  SURF_BIOFLUID,
  SURF_EMBER,
  SURF_FIRE,
  SURF_FUNGAL,
  SURF_FUNGAL_HEATED,
  SURF_GAS,
  SURF_GLASS,
  SURF_ICE,
  SURF_NONE,
  SURF_RAIL,
  SURF_RAIL_V,
  SURF_SCORCHED,
  SURF_SILT,
  SURF_SPORES,
  SURF_WATER,
} from '@voxelyn/survival-sim';
import surfaceManifest from '@voxelyn/survival-content/assets/atlases/surface-tiles.json';
import { ARCHETYPE_SPRITE, DEVOURER_BROOD_ATLAS } from '../client/sprites';
import broodManifest from '@voxelyn/survival-content/assets/atlases/part-devourer-brood.json';
import devourerManifest from '@voxelyn/survival-content/assets/atlases/enemy-white-devourer.json';
import { EntityPresentation } from '../client/presentation';
import {
  DEVOURER_AIRBORNE,
  DEVOURER_BURROWED,
  DEVOURER_MAW,
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_RADIUS,
  DEVOURER_MAW_SPOOL_TICKS,
  TICK_HZ,
  mawReach,
} from '@voxelyn/survival-sim';
import { SURFACE_FALLBACK, SURFACE_KIND_INDEX } from '../client/render';
import {
  applyBossModuleMark,
  bossModuleNameKey,
  bossModulePresentation,
  type BossModuleMark,
  type BossModuleState,
} from '../client/boss-module-presentation';
import { t } from '../client/i18n';

const ARCHETYPES = Object.keys(emptyStats().kills);

/**
 * Os arquetipos que o RENDERER desenha por um caminho proprio.
 *
 * `ARCHETYPE_SPRITE` e o mapa do caminho GENERICO, e o teste abaixo existe
 * porque oito chefes chegaram ao jogo sem entrada nele e apareciam como um
 * losango de cor. O invariante de verdade nunca foi "estar no mapa" — e "nao
 * cair no losango", e ha mais de uma forma de cumpri-lo.
 *
 * A ninhada cumpre pelo outro caminho, e por uma razao que o mapa nao
 * comportaria: os quadros do atlas dela sao (variante x fase), e o caminho
 * generico deriva o quadro so do relogio. Posta no mapa, as tres variantes
 * virariam uma unica minhoquinha trocando de corpo enquanto anda.
 *
 * A lista e explicita de proposito: cada nome aqui e uma promessa de que ALGUEM
 * desenha aquele bicho, e quem a escreve tem de ter escrito o desenho tambem.
 */
const DRAWN_BY_HAND = new Set(['devourer_brood']);

describe('todo arquetipo tem atlas', () => {
  it('nenhum inimigo da simulacao cai no losango de recuo', () => {
    const missing = ARCHETYPES.filter((a) => !ARCHETYPE_SPRITE[a] && !DRAWN_BY_HAND.has(a));
    expect(missing, `sem atlas: ${missing.join(', ')}`).toEqual([]);
  });

  it('quem e desenhado a mao tem MESMO um atlas proprio carregado', () => {
    // A contrapartida da lista acima: sem esta linha, `DRAWN_BY_HAND` viraria
    // uma lista de isencoes — bastaria por um nome nela para o teste calar
    // sobre um bicho que ninguem desenha.
    expect(DEVOURER_BROOD_ATLAS).toBeTruthy();
    const m = broodManifest as unknown as { animations: Record<string, { frames: number }> };
    expect(m.animations.idle.frames).toBeGreaterThan(0);
  });

  it('o jogador tambem, e cada atlas e usado por alguem', () => {
    expect(ARCHETYPE_SPRITE.prospector).toBe('player-prospector');
    // Dois arquetipos apontando para o mesmo atlas seria uma copia colada que
    // ninguem notaria — o segundo bicho apareceria com a cara do primeiro.
    const ids = Object.values(ARCHETYPE_SPRITE);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('toda superficie tem tile', () => {
  // Os SURF_* sao numeros e o mapa e um Record<number, number>: um indice
  // ausente nao e erro de tipo, e `undefined`. Antes de o cliente conferir isso
  // explicitamente, `?? 0` mandava a materia desconhecida desenhar como CHAO
  // NU — e `draw` devolvia `true`, entao nem a cor de recuo aparecia.
  const ALL_SURFACES = [
    SURF_NONE, SURF_FUNGAL, SURF_BIOFLUID, SURF_GAS, SURF_FIRE, SURF_SCORCHED,
    SURF_SPORES, SURF_FUNGAL_HEATED, SURF_WATER, SURF_EMBER, SURF_ICE,
    SURF_RAIL, SURF_RAIL_V, SURF_SILT, SURF_GLASS,
  ];

  it('mapeia cada SURF_* para um tipo que existe no atlas', () => {
    const kinds = (surfaceManifest as { kinds: unknown[] }).kinds.length;
    for (const surf of ALL_SURFACES) {
      const index = SURFACE_KIND_INDEX[surf];
      expect(index, `SURF ${surf} sem tile`).toBeTypeOf('number');
      expect(index).toBeLessThan(kinds);
    }
    // Sem buracos e sem repetidos: dois SURF_* no mesmo tile seria uma materia
    // desenhando com a cara de outra.
    const used = ALL_SURFACES.map((s) => SURFACE_KIND_INDEX[s]);
    expect(new Set(used).size).toBe(used.length);
  });

  it('da cor de recuo a toda materia menos o chao nu', () => {
    for (const surf of ALL_SURFACES) {
      if (surf === SURF_NONE) continue;
      expect(SURFACE_FALLBACK[surf], `SURF ${surf} sem cor de recuo`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('separa silica de vidro no recuo, que e a decisao do encontro', () => {
    expect(SURFACE_FALLBACK[SURF_SILT]).not.toBe(SURFACE_FALLBACK[SURF_GLASS]);
    expect(SURFACE_FALLBACK[SURF_GLASS]).not.toBe(SURFACE_FALLBACK[SURF_ICE]);
  });
});

describe('os quatro estados de boss_module', () => {
  const STATES: BossModuleState[] = ['exposed', 'detached', 'dropped', 'lost'];

  it('sao visualmente distintos uns dos outros', () => {
    const colors = STATES.map((s) => bossModulePresentation(s).color);
    expect(new Set(colors).size).toBe(4);
    const keys = STATES.map((s) => bossModulePresentation(s).toastKey);
    expect(new Set(keys).size).toBe(4);
  });

  it('so marca o chao onde ha mesmo uma peca', () => {
    expect(bossModulePresentation('exposed').marks).toBe(true);
    expect(bossModulePresentation('dropped').marks).toBe(true);
    // A peca viaja com o Coveiro; marcar o ponto do arranco apontaria o jogador
    // para onde ela NAO esta mais.
    expect(bossModulePresentation('detached').marks).toBe(false);
    expect(bossModulePresentation('lost').marks).toBe(false);
  });

  it('perder avisa por mais tempo do que ganhar', () => {
    expect(bossModulePresentation('lost').toastMs).toBeGreaterThan(
      bossModulePresentation('exposed').toastMs
    );
  });

  it('traduz nome de peca nos dois idiomas, inclusive indice invalido', () => {
    for (const key of [bossModuleNameKey(0), bossModuleNameKey(1), bossModuleNameKey(2)]) {
      expect(t(key)).not.toBe('');
    }
    expect(bossModuleNameKey(99)).toBe('bossModule.unknown');
    expect(t(bossModuleNameKey(99))).not.toBe('');
  });
});

describe('a marca de peca segue a peca', () => {
  const marks = (): Map<number, BossModuleMark> => new Map();

  it('uma peca que troca de mao tres vezes deixa UMA marca', () => {
    const m = marks();
    applyBossModuleMark(m, { module: 0, x: 5, y: 5, state: 'exposed' }, 0);
    applyBossModuleMark(m, { module: 0, x: 5, y: 5, state: 'detached' }, 100);
    applyBossModuleMark(m, { module: 0, x: 20, y: 9, state: 'dropped' }, 200);
    expect(m.size).toBe(1);
    expect(m.get(0)?.x).toBe(20);
    expect(m.get(0)?.y).toBe(9);
  });

  it('some de vez quando a peca sai do mapa', () => {
    const m = marks();
    applyBossModuleMark(m, { module: 2, x: 3, y: 3, state: 'exposed' }, 0);
    applyBossModuleMark(m, { module: 2, x: 40, y: 1, state: 'lost' }, 500);
    expect(m.size).toBe(0);
  });

  it('as tres pecas convivem, cada uma no proprio lugar', () => {
    const m = marks();
    applyBossModuleMark(m, { module: 0, x: 1, y: 1, state: 'exposed' }, 0);
    applyBossModuleMark(m, { module: 1, x: 2, y: 2, state: 'exposed' }, 0);
    applyBossModuleMark(m, { module: 2, x: 3, y: 3, state: 'dropped' }, 0);
    expect(m.size).toBe(3);
    expect([...m.values()].map((v) => v.x)).toEqual([1, 2, 3]);
  });
});


describe('o Devorador de boca aberta troca de silhueta', () => {
  // A janela de dano do encontro inteiro e um HUMOR, nao uma acao: preso ele
  // nao tem acao nenhuma. Sem a troca explicita de pose ele cairia em `idle` —
  // o corpo deitado passeando pelo chao — e a unica abertura do ciclo pareceria
  // exatamente igual a ele nadando por baixo da areia.
  const worm = (mood: number) => ({
    id: 10,
    archetype: 'white_devourer',
    facing: { x: 1, y: 0 },
    mood,
    stunnedUntil: 0,
  });
  const base = {
    anim: 'idle', animStartMs: 0, lastX: 0, lastY: 0, lastHp: 100,
    hitUntilMs: 0, movingUntilMs: 0, moveFacingX: 1, moveFacingY: 0,
  };

  /**
   * O estado que a boca precisa: um tick e o instante em que ela abriu.
   *
   * Os dois numeros sao autoritativos e ja viajam no snapshot — a pose sai do
   * MESMO `mawOpenedAt` de que saem o alcance da sucao e a areia engolida.
   */
  const room = (tick: number, mawOpenedAt = 0) =>
    ({ tick, bossRuntime: { mawOpenedAt } }) as never;

  /** Quantos ticks a abertura leva, pela mesma conta que a pose usa. */
  const OPEN = DEVOURER_MAW_SPOOL_TICKS * (DEVOURER_MAW_BITE_RADIUS / DEVOURER_MAW_RADIUS);

  it('preso desenha a pose erguida; mergulhado e no ar, nao', () => {
    const p = new EntityPresentation();
    const stuck = p.animationFor(worm(DEVOURER_MAW) as never, room(200), base as never, 1_000);
    expect(stuck.anim).toBe('downed');

    for (const mood of [DEVOURER_BURROWED, DEVOURER_AIRBORNE]) {
      const other = p.animationFor(worm(mood) as never, room(200), base as never, 1_000);
      expect(other.anim, `humor ${mood}`).not.toBe('downed');
    }
  });

  it('ABRE antes de espasmar: o chao se rasga, e so entao a boca engasga', () => {
    // A ordem que o jogador precisa ver. Antes a cratera dentada aparecia
    // inteira no tick do terceiro pouso — um estalo — e a unica coisa que
    // separava "ele pousou" de "a janela abriu" era o jogador ja saber.
    const p = new EntityPresentation();
    const at = (tick: number) =>
      p.animationFor(worm(DEVOURER_MAW) as never, room(tick), base as never, 1_000).anim;
    expect(at(0), 'a boca nasceu escancarada').toBe('burst');
    expect(at(Math.floor(OPEN) - 1)).toBe('burst');
    expect(at(Math.ceil(OPEN))).toBe('downed');
  });

  it('a abertura acaba quando a garganta comeca a MORDER, e nao depois', () => {
    // Uma cratera que engolisse antes de estar aberta seria um golpe sem aviso,
    // e uma que continuasse abrindo depois de ja matar seria um aviso que
    // chega tarde. O mesmo numero decide as duas coisas — aqui e na simulacao.
    expect(mawReach(Math.floor(OPEN), 0)).toBeLessThan(DEVOURER_MAW_BITE_RADIUS);
    expect(mawReach(Math.ceil(OPEN), 0)).toBeGreaterThanOrEqual(DEVOURER_MAW_BITE_RADIUS);
  });

  it('o ESPASMO anda: o relogio da pose avanca entre ticks', () => {
    // Regressao de um defeito real, e o pior tipo de defeito de animacao:
    // silencioso. A boca e a pose de jogador CAIDO usam o mesmo slot de atlas
    // (`downed`), e a boca reaproveitava o mapa `downedAt` — que o ramo logo
    // acima limpa a cada quadro para quem nao esta caido. O registro era
    // apagado no quadro seguinte ao que o escrevia, `elapsedMs` nascia zero
    // sempre, e o espasmo de seis quadros ficava travado no primeiro.
    //
    // Nada quebrava, nada avisava: a pose certa, parada.
    const p = new EntityPresentation();
    const at = (tick: number) =>
      p.animationFor(worm(DEVOURER_MAW) as never, room(tick), base as never, 1_000);
    // A abertura acaba a 19,2 ticks — no MEIO de um tick —, entao o primeiro
    // quadro de espasmo ja nasce com a fracao que sobrou. O que este teste
    // guarda e o AVANCO, e nao um zero exato: e o avanco que faltava quando o
    // relogio da pose estava travado.
    const t0 = Math.ceil(OPEN);
    expect(at(t0).elapsedMs).toBeLessThan(1000 / TICK_HZ);
    expect(at(t0 + 4).elapsedMs - at(t0).elapsedMs, 'o relogio da boca nao avancou').toBeCloseTo(
      200,
      6
    );
    expect(at(t0 + 10).elapsedMs - at(t0).elapsedMs).toBeCloseTo(500, 6);
  });

  it('quem RECONECTA no meio da janela nao ve a boca abrir de novo', () => {
    // O defeito por nascer que tirou o relogio de tela daqui. Guardando "quando
    // a boca abriu" no primeiro quadro em que o cliente ve o humor, um jogador
    // que entra na sala com a janela ja correndo comeca a contar do zero: ele
    // veria a cratera se rasgando enquanto a sucao ja o arrasta em alcance
    // quase cheio. O tick e autoritativo e nao tem essa fraqueza.
    const p = new EntityPresentation();
    const meio = p.animationFor(worm(DEVOURER_MAW) as never, room(120), base as never, 9_999);
    expect(meio.anim).toBe('downed');
    expect(meio.elapsedMs).toBeGreaterThan(0);
  });

  it('a boca fechando REARMA a abertura para o ciclo seguinte', () => {
    const p = new EntityPresentation();
    p.animationFor(worm(DEVOURER_MAW) as never, room(200), base as never, 1_000);
    // Ele volta para baixo...
    p.animationFor(worm(DEVOURER_BURROWED) as never, room(260), base as never, 1_500);
    // ...e a boca seguinte se rasga de novo do chao intacto, porque a
    // simulacao carimba um `mawOpenedAt` novo.
    const reopened = p.animationFor(
      worm(DEVOURER_MAW) as never,
      room(400, 400),
      base as never,
      2_000,
    );
    expect(reopened.anim, 'a boca seguinte nasceu escancarada').toBe('burst');
    expect(reopened.elapsedMs).toBe(0);
  });

  it('o atlas tem a ABERTURA, nas quatro direcoes', () => {
    // O mesmo contrato que a pose de boca aberta ja tinha: sem o slot, o
    // cliente cai em `idle` calado — o corpo deitado passeando pelo chao no
    // lugar da unica janela de dano do encontro.
    const m = devourerManifest as unknown as {
      animations: Record<string, { frames: number }>;
      frameMap: Record<string, Record<string, number>>;
    };
    expect(m.animations.burst?.frames).toBeGreaterThan(1);
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      expect(m.frameMap[dir].burst, `direcao ${dir} sem a abertura`).toBeTypeOf('number');
    }
  });

  it('o atlas realmente tem a pose, e ela e a mais ALTA do bicho', () => {
    // O contrato com o gerador: `downed` existe e e uma pose de pe. Se alguem
    // regerar o atlas sem ela, o cliente cai em `idle` calado — que e como o
    // defeito original se pareceria de novo.
    const m = devourerManifest as unknown as {
      animations: Record<string, { frames: number }>;
      frameMap: Record<string, Record<string, number>>;
    };
    expect(m.animations.downed?.frames).toBeGreaterThan(0);
    for (const dir of ['dr', 'dl', 'ur', 'ul']) {
      expect(m.frameMap[dir].downed, `direcao ${dir} sem a pose`).toBeTypeOf('number');
    }
  });
});
