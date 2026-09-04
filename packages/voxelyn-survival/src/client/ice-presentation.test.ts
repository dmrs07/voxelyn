// A APRESENTACAO DO GELO: o que o cliente faz com o ciclo de rachaduras.
//
// O que estes testes protegem:
//
// 1. O SOM CONTA O DEGRAU. Tres estalos distintos, um colapso e uma queda —
//    e a queda cala o `death` que vem junto, senao dois stings no mesmo tick
//    soam como falha de mixagem.
// 2. NENHUM SOM POR TICK. As travas de voz existem porque uma travessia cruza
//    varias celulas por segundo e o co-op dobra isso; sem elas, atravessar um
//    lago rachado calaria todo telegrafo da sala.
// 3. A QUEDA SUBSTITUI A LAPIDE. Um Prospector boiando sobre um buraco diria
//    "ha algo aqui para resgatar" no unico lugar do mapa em que a resposta
//    certa e nao chegar perto.
// 4. A LUZ LE A ROTA. A placa perde POLIMENTO a cada degrau, entao o primeiro
//    clarao forte que atravessa a arena desenha por onde o jogador ja passou.
import { describe, expect, it } from 'vitest';
import {
  SURF_DEEP_WATER,
  SURF_ICE,
  SURF_ICE_CRACKED,
  SURF_ICE_CRITICAL,
  SURF_ICE_FRACTURED,
  SURF_WATER,
} from '@voxelyn/survival-sim';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import { cuesForEvent, cuesForEvents } from './audio/cues';
import { VOICE_SPECS } from './audio/voices';
import { VOICE_RENDERERS } from './audio/synth';
import { surfaceResponse } from './material-response';
import { EntityPresentation, ICE_PLUNGE_MS } from './presentation';
import { PT_BR } from './i18n/locales/pt-BR';
import { EN } from './i18n/locales/en';

const ctx = { worldWidth: 96, localPlayerId: 1 };

const crack = (stage: number): SemanticEvent => ({ t: 'ice_crack', x: 4, y: 4, stage });
const collapse: SemanticEvent = { t: 'ice_collapse', x: 4, y: 4 };
const fall: SemanticEvent = { t: 'ice_fall', x: 4, y: 4, slot: 0 };
const mend: SemanticEvent = { t: 'ice_mend', x: 4, y: 4, radius: 6, mended: 3, sealed: 1 };
const death = (entity: number): SemanticEvent => ({
  t: 'death',
  x: 4,
  y: 4,
  entity,
  archetype: 'prospector',
  facingX: 1,
  facingY: 0,
  tick: 10,
});

describe('o som do ciclo de rachaduras', () => {
  it('cada degrau tem voz PROPRIA, e ela desce de altura', () => {
    const voices = [1, 2, 3].map((stage) => cuesForEvent(crack(stage), ctx)[0].voice);
    expect(voices).toEqual(['iceCrackFine', 'iceCrackFractured', 'iceCrackCritical']);
    expect(new Set(voices).size).toBe(3);
  });

  it('colapso, queda e reparo tem vozes proprias — nada reaproveitado de chefe', () => {
    expect(cuesForEvent(collapse, ctx)[0].voice).toBe('iceCollapse');
    expect(cuesForEvent(fall, ctx)[0].voice).toBe('icePlunge');
    expect(cuesForEvent(mend, ctx)[0].voice).toBe('iceMend');
  });

  it('toda voz do gelo existe no banco E tem sintetizador', () => {
    const ids = [
      'iceCrackFine',
      'iceCrackFractured',
      'iceCrackCritical',
      'iceCollapse',
      'icePlunge',
      'iceMend',
    ] as const;
    for (const id of ids) {
      expect(VOICE_SPECS[id], `${id} sem spec`).toBeDefined();
      expect(VOICE_RENDERERS[id], `${id} sem sintetizador`).toBeTypeOf('function');
    }
  });

  it('as travas impedem spam: o estalo comum e o mais contido, o critico passa', () => {
    // Atravessar gasta varias celulas por segundo e o co-op dobra isso. A
    // fenda fina e a que mais acontece e por isso a mais travada; o critico e
    // raro e nao pode ser engolido.
    expect(VOICE_SPECS.iceCrackFine.minIntervalMs).toBeGreaterThanOrEqual(200);
    expect(VOICE_SPECS.iceCrackFine.minIntervalMs).toBeGreaterThan(
      VOICE_SPECS.iceCrackCritical.minIntervalMs,
    );
    expect(VOICE_SPECS.iceCrackCritical.priority).toBeGreaterThan(
      VOICE_SPECS.iceCrackFine.priority,
    );
    // Colapso e queda nao podem ser engolidos por um tiroteio: um diz que a
    // arena mudou, o outro que alguem morreu.
    expect(VOICE_SPECS.iceCollapse.priority).toBeGreaterThanOrEqual(9);
    expect(VOICE_SPECS.icePlunge.priority).toBeGreaterThanOrEqual(10);
    // E o reparo, que sai UMA vez por pulso da Rainha, e o mais travado.
    expect(VOICE_SPECS.iceMend.minIntervalMs).toBeGreaterThanOrEqual(300);
  });

  it('a queda cala o `death` daquele corpo, e so daquele', () => {
    const cues = cuesForEvents([fall, death(1), death(7)], ctx);
    const voices = cues.map((c) => c.voice);
    expect(voices).toContain('icePlunge');
    // O Prospector que afundou nao toca o sting comum de morte...
    expect(voices.filter((v) => v === 'death')).toHaveLength(1);
    // ...mas a criatura que morreu no mesmo tick continua soando.
    expect(cuesForEvents([death(7)], ctx).map((c) => c.voice)).toEqual(['death']);
  });

  it('sem queda no lote, a morte do Prospector continua soando', () => {
    expect(cuesForEvents([death(1)], ctx).map((c) => c.voice)).toEqual(['death']);
  });

  it('o congelamento da Rainha cala o `iceMend` do mesmo tick — e so o dela', () => {
    // O congelamento ja E o som do lago refeito (os cacos caindo, os sinos);
    // o reparo por cima seria dois sons para um acontecimento.
    const freeze: SemanticEvent = {
      t: 'boss_attack',
      archetype: 'frost_queen',
      ability: 'freeze',
      x: 4,
      y: 4,
    };
    const voices = cuesForEvents([freeze, mend], ctx).map((c) => c.voice);
    expect(voices).toContain('frostQueenFreeze');
    expect(voices).not.toContain('iceMend');
    // O buraco recongelando sozinho (raio zero) continua soando, mesmo que a
    // Rainha congele no mesmo tick: sao dois lugares diferentes.
    const selfMend: SemanticEvent = {
      t: 'ice_mend',
      x: 40,
      y: 40,
      radius: 0,
      mended: 0,
      sealed: 1,
    };
    expect(cuesForEvents([freeze, selfMend], ctx).map((c) => c.voice)).toContain('iceMend');
    // E sem o congelamento no lote, o reparo dela soa como sempre.
    expect(cuesForEvents([mend], ctx).map((c) => c.voice)).toEqual(['iceMend']);
  });
});

describe('a queda substitui a lapide', () => {
  const presentation = (): EntityPresentation => new EntityPresentation();

  it('afundar nao deixa corpo em cima do buraco', () => {
    const p = presentation();
    p.ingest([fall, death(1)], 1000);
    expect(p.tombstones(1000)).toHaveLength(0);
    const plunges = p.plunges(1000);
    expect(plunges).toHaveLength(1);
    expect(plunges[0].slot).toBe(0);
    // O rumo autoritativo vem do `death`, que chega logo depois do `ice_fall`.
    expect(plunges[0].facingX).toBe(1);
    expect(plunges[0].facingY).toBe(0);
  });

  it('uma morte comum continua deixando lapide', () => {
    const p = presentation();
    p.ingest([death(7)], 1000);
    expect(p.tombstones(1000)).toHaveLength(1);
    expect(p.plunges(1000)).toHaveLength(0);
  });

  it('a animacao dura entre 650 e 900 ms e a tela de fim espera por ela', () => {
    expect(ICE_PLUNGE_MS).toBeGreaterThanOrEqual(650);
    expect(ICE_PLUNGE_MS).toBeLessThanOrEqual(900);
    const p = presentation();
    p.ingest([fall, death(1)], 1000);
    expect(p.plungeActive(1000)).toBe(true);
    expect(p.plungeActive(1000 + ICE_PLUNGE_MS - 1)).toBe(true);
    // Terminada, ela para de segurar o resultado e some da fila de desenho.
    expect(p.plungeActive(1000 + ICE_PLUNGE_MS)).toBe(false);
    expect(p.plunges(1000 + ICE_PLUNGE_MS)).toHaveLength(0);
  });

  it('reset esquece a queda: a run seguinte nao nasce com alguem afundando', () => {
    const p = presentation();
    p.ingest([fall, death(1)], 1000);
    p.reset();
    expect(p.plungeActive(1000)).toBe(false);
    expect(p.plunges(1000)).toHaveLength(0);
  });
});

describe('a luz le a rota gasta', () => {
  it('a placa perde polimento a cada degrau, e o buraco volta a espelhar', () => {
    const gloss = (surf: number): number => surfaceResponse(surf).gloss;
    expect(gloss(SURF_ICE)).toBeGreaterThan(gloss(SURF_ICE_CRACKED));
    expect(gloss(SURF_ICE_CRACKED)).toBeGreaterThan(gloss(SURF_ICE_FRACTURED));
    expect(gloss(SURF_ICE_FRACTURED)).toBeGreaterThan(gloss(SURF_ICE_CRITICAL));
    // Agua parada e funda e o espelho mais limpo que existe: o buraco devolve
    // o clarao inteiro, e e essa a leitura de perigo no escuro da Cripta.
    expect(gloss(SURF_DEEP_WATER)).toBeGreaterThan(gloss(SURF_ICE_CRITICAL));
    expect(gloss(SURF_DEEP_WATER)).toBeGreaterThan(gloss(SURF_WATER));
  });

  it('o buraco e o material mais escuro do ciclo', () => {
    const luminance = (surf: number): number => {
      const n = Number.parseInt(surfaceResponse(surf).albedo.slice(1), 16);
      return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
    };
    for (const surf of [SURF_ICE, SURF_ICE_CRACKED, SURF_ICE_FRACTURED, SURF_ICE_CRITICAL]) {
      expect(luminance(SURF_DEEP_WATER)).toBeLessThan(luminance(surf));
    }
    expect(luminance(SURF_DEEP_WATER)).toBeLessThan(luminance(SURF_WATER));
  });
});

describe('os textos do gelo', () => {
  it('a morte por agua profunda tem manchete e licao nas duas linguas', () => {
    for (const catalog of [PT_BR, EN]) {
      expect(catalog['summary.cause.deepWater.headline'].trim().length).toBeGreaterThan(0);
      expect(catalog['summary.cause.deepWater.lesson'].trim().length).toBeGreaterThan(0);
    }
    // Traduzida de fato, e nao copiada.
    expect(PT_BR['summary.cause.deepWater.headline']).not.toBe(
      EN['summary.cause.deepWater.headline'],
    );
  });

  it('a licao ENSINA a rota, e nao so o que aconteceu', () => {
    // O texto e a unica coisa que a tela de morte tem para fazer. "Voce
    // afundou" nao devolve nada; o que devolve e o ciclo e as tres saidas.
    expect(PT_BR['summary.cause.deepWater.lesson']).toMatch(/rota|crítica|Rainha/i);
    expect(EN['summary.cause.deepWater.lesson']).toMatch(/route|critical|Queen/i);
  });

  it('MV-04 descreve o efeito CONCRETO, nos dois idiomas', () => {
    // "mais controle no gelo" nao e uma promessa que alguem consiga avaliar
    // antes de gastar 130 de minerio e 2 Nucleos.
    for (const desc of [PT_BR['upgrade.MV-04.desc'], EN['upgrade.MV-04.desc']]) {
      expect(desc).toMatch(/\d/); // ha um numero: a frenagem, em tiles
      expect(desc.length).toBeGreaterThan(30);
    }
    // E diz o que ele NAO faz: rachadura nao e coisa que o upgrade impeca.
    expect(PT_BR['upgrade.MV-04.desc']).toMatch(/rachadura/i);
    expect(EN['upgrade.MV-04.desc']).toMatch(/crack/i);
  });
});
