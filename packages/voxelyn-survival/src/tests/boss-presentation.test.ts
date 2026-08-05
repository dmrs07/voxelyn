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
import { ARCHETYPE_SPRITE } from '../client/sprites';
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

describe('todo arquetipo tem atlas', () => {
  it('nenhum inimigo da simulacao cai no losango de recuo', () => {
    const missing = ARCHETYPES.filter((a) => !ARCHETYPE_SPRITE[a]);
    expect(missing, `sem atlas: ${missing.join(', ')}`).toEqual([]);
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
