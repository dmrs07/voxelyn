// A tabela das falas do Diamandis: voz e legenda saem do MESMO lugar.
import { describe, expect, it } from 'vitest';
import { BOSS_PHASE_REACTOR, BOSS_PHASE_SUMMON } from '@voxelyn/survival-sim';
import { DIAMANDIS_LINES, diamandisLineFor } from './boss-voice-lines';
import { cuesForEvent } from './cues';
import { PT_BR } from '../i18n/locales/pt-BR';
import { EN } from '../i18n/locales/en';

const ctx = { worldWidth: 96, localPlayerId: 1 };

describe('as falas do Diamandis', () => {
  it('cada momento tem a sua, e so o Diamandis fala', () => {
    expect(diamandisLineFor({ t: 'boss_awake', archetype: 'diamandis', x: 1, y: 1 })).toBe(
      'unmapped',
    );
    expect(diamandisLineFor({ t: 'boss_awake', archetype: 'guardian', x: 1, y: 1 })).toBeNull();
    const windup = (ability: 'drill' | 'demolish' | 'beam') =>
      diamandisLineFor({
        t: 'boss_windup',
        archetype: 'diamandis',
        ability,
        x: 1,
        y: 1,
        releaseTick: 9,
      });
    expect(windup('drill')).toBe('standClear');
    expect(windup('demolish')).toBe('armed');
    expect(windup('beam')).toBe('survey');
    expect(
      diamandisLineFor({
        t: 'boss_phase',
        archetype: 'diamandis',
        phase: BOSS_PHASE_REACTOR,
        x: 1,
        y: 1,
      }),
    ).toBe('fault');
    expect(
      diamandisLineFor({
        t: 'boss_phase',
        archetype: 'guardian',
        phase: BOSS_PHASE_SUMMON,
        x: 1,
        y: 1,
      }),
    ).toBeNull();
    expect(diamandisLineFor({ t: 'boss_module', x: 1, y: 1, module: 0, state: 'lost' })).toBe(
      'lost',
    );
    expect(
      diamandisLineFor({
        t: 'boss_state',
        archetype: 'diamandis',
        state: 'obstruction',
        x: 1,
        y: 1,
      }),
    ).toBe('obstruction');
    expect(
      diamandisLineFor({ t: 'boss_state', archetype: 'guardian', state: 'step', x: 1, y: 1 }),
    ).toBeNull();
    expect(
      diamandisLineFor({ t: 'boss_module', x: 1, y: 1, module: 0, state: 'exposed' }),
    ).toBeNull();
  });

  it('a voz que soa e a da tabela, e a legenda tem chave nos dois idiomas', () => {
    for (const [line, spec] of Object.entries(DIAMANDIS_LINES)) {
      expect(PT_BR[spec.key as keyof typeof PT_BR], `${line} sem pt-BR`).toBeTypeOf('string');
      expect(EN[spec.key as keyof typeof EN], `${line} sem en`).toBeTypeOf('string');
      expect(spec.holdMs).toBeGreaterThan(2000);
    }
    const cues = cuesForEvent(
      { t: 'boss_windup', archetype: 'diamandis', ability: 'drill', x: 3, y: 4, releaseTick: 9 },
      ctx,
    );
    expect(cues[cues.length - 1]).toMatchObject({
      voice: DIAMANDIS_LINES.standClear.voice,
      x: 3,
      y: 4,
    });
  });
});
