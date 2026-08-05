import { describe, expect, it } from 'vitest';
import {
  entryAtlasChain,
  objectiveAtlasChain,
  objectiveLightSpec,
  objectivePropName,
  objectiveViewOf,
  portalKeyFor,
  type ObjectiveView,
} from './objective-prop';

/** Uma run de tres setores, Nucleo no terceiro: a configuracao historica. */
const view = (over: Partial<ObjectiveView> = {}): ObjectiveView => ({
  sector: 1,
  sectorCount: 3,
  hasCore: false,
  coreTakenHere: false,
  sealedByBoss: false,
  returning: false,
  ...over,
});

describe('marcador de objetivo por setor', () => {
  it('usa o poco de descida em todo setor sem pedestal', () => {
    for (let sector = 1; sector < 3; sector++) {
      expect(objectivePropName(view({ sector }))).toBe('descent');
      // Um Nucleo pego NOUTRO setor nao pode transformar este poco em berco
      // vazio: `coreTakenHere` e por setor exatamente por isso.
      expect(objectivePropName(view({ sector, returning: true }))).toBe('descent');
    }
  });

  it('reserva core e coreTaken para os setores COM pedestal', () => {
    expect(objectivePropName(view({ sector: 3, hasCore: true }))).toBe('core');
    expect(objectivePropName(view({ sector: 3, hasCore: true, coreTakenHere: true }))).toBe(
      'coreTaken',
    );
  });

  it('o pedestal INTERMEDIARIO vira poco depois de recolhido', () => {
    // G-04: Nucleo no setor 3, e ainda ha quatro setores abaixo. Depois da
    // coleta o mesmo ponto e o poco — e desenha-lo como berco vazio diria ao
    // jogador que a descida acabou.
    const g04 = { sectorCount: 7, sector: 3, hasCore: true };
    expect(objectivePropName(view(g04))).toBe('core');
    expect(objectivePropName(view({ ...g04, coreTakenHere: true }))).toBe('descent');
  });

  it('o Nucleo SELADO continua visivel: selado nao e escondido', () => {
    expect(objectivePropName(view({ sector: 3, hasCore: true, sealedByBoss: true }))).toBe('core');
    expect(objectiveAtlasChain(view({ sector: 3, hasCore: true, sealedByBoss: true }), 'basalt', 'none')).toEqual(['core']);
  });

  it('mantem o poco legivel sem dar a ele o farol forte do Nucleo', () => {
    expect(objectiveLightSpec(view())).toEqual({ radius: 4.75, power: 0.62 });
    expect(objectiveLightSpec(view({ sector: 3, hasCore: true }))).toEqual({
      radius: 6,
      power: 0.9,
    });
    expect(
      objectiveLightSpec(view({ sector: 3, hasCore: true, coreTakenHere: true })),
    ).toBeNull();
  });

  it('o poco que nao aceita a mao nao convida: a luz dele apaga', () => {
    // Duas razoes distintas, a mesma leitura: na subida descer nao existe mais;
    // com o chefe de pe, descer ainda nao existe.
    expect(objectiveLightSpec(view({ sector: 2, returning: true }))).toBeNull();
    expect(objectiveLightSpec(view({ sector: 2, sealedByBoss: true }))).toBeNull();
  });
});

describe('portais por bioma', () => {
  it('a ocupacao manda no flavor; sem ocupacao, o estrato', () => {
    expect(portalKeyFor('glacial', 'none')).toBe('glacial');
    expect(portalKeyFor('basalt', 'aurix')).toBe('aurix');
    expect(portalKeyFor('ferric', 'mycelial')).toBe('mycelial');
  });

  it('o poco fala o dialeto do bioma, com o descent generico de fallback', () => {
    expect(objectiveAtlasChain(view({ sector: 1 }), 'basalt', 'none')).toEqual([
      'portal:basalt',
      'descent',
    ]);
    expect(objectiveAtlasChain(view({ sector: 2 }), 'ferric', 'aurix')).toEqual([
      'portal:aurix',
      'descent',
    ]);
  });

  it('poco selado — por chefe ou pela subida — usa o mesmo desenho', () => {
    expect(objectiveAtlasChain(view({ sector: 2, returning: true }), 'ferric', 'aurix')).toEqual([
      'portal:sealed',
      'descent',
    ]);
    expect(objectiveAtlasChain(view({ sector: 2, sealedByBoss: true }), 'ferric', 'aurix')).toEqual([
      'portal:sealed',
      'descent',
    ]);
  });

  it('a entrada vira portal de SUBIDA na volta — menos no setor 1, onde extrai', () => {
    expect(entryAtlasChain(view({ sector: 2, returning: true }), 'silica', 'none')).toEqual([
      'portal:silica',
      'extraction',
    ]);
    expect(entryAtlasChain(view({ sector: 3 }), 'silica', 'none')).toEqual(['extraction']);
    expect(entryAtlasChain(view({ sector: 1, returning: true }), 'basalt', 'none')).toEqual([
      'extraction',
    ]);
  });
});

describe('descritor a partir do espelho da run', () => {
  const mirror = (over: Record<string, unknown> = {}) => ({
    sector: 3,
    coresTakenMask: 0,
    sectorBoss: { archetype: null as string | null, defeated: false },
    config: { depth: { sectorCount: 7, coreSectors: [3, 7] } },
    ...over,
  });

  it('le pedestal, selo e retorno da configuracao congelada', () => {
    expect(objectiveViewOf(mirror())).toEqual({
      sector: 3,
      sectorCount: 7,
      hasCore: true,
      coreTakenHere: false,
      sealedByBoss: false,
      returning: false,
    });
  });

  it('o Nucleo INTERMEDIARIO nao poe a run em retorno', () => {
    const v = objectiveViewOf(mirror({ coresTakenMask: 1 << 3 }));
    expect(v.coreTakenHere).toBe(true);
    expect(v.returning).toBe(false);
  });

  it('o Nucleo do FUNDO poe', () => {
    expect(objectiveViewOf(mirror({ coresTakenMask: 1 << 7 })).returning).toBe(true);
  });

  it('chefe vivo sela; chefe abatido nao', () => {
    expect(
      objectiveViewOf(mirror({ sectorBoss: { archetype: 'guardian', defeated: false } })).sealedByBoss,
    ).toBe(true);
    expect(
      objectiveViewOf(mirror({ sectorBoss: { archetype: 'guardian', defeated: true } })).sealedByBoss,
    ).toBe(false);
  });
});
