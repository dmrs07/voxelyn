import { describe, expect, it } from 'vitest';
import { EntityPresentation, locomotionFacing, recoilAtElapsed } from './presentation';

const baseAnim = (anim: string, animStartMs = 0) => ({
  anim,
  animStartMs,
  lastX: 0,
  lastY: 0,
  lastHp: 100,
  hitUntilMs: 0,
  movingUntilMs: 0,
  moveFacingX: 1,
  moveFacingY: 0,
});

const actionEntity = (archetype: string, kind: string) => ({
  id: archetype === 'prospector' ? 1 : 10,
  archetype,
  facing: { x: 1, y: 0 },
  action: {
    kind,
    startedAt: 0,
    releaseAt: 1,
    endsAt: 10,
    direction: { x: 1, y: 0 },
  },
});

describe('locomotionFacing', () => {
  it.each([
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])('usa a direção real do deslocamento (%s, %s) durante walk, sem cair em DR', (moveX, moveY) => {
    const facing = locomotionFacing(
      { ...baseAnim('walk'), moveFacingX: moveX, moveFacingY: moveY } as never,
      0,
      0
    );

    expect(facing).toEqual({ x: moveX, y: moveY });
  });

  it('preserva o facing autoritativo fora da caminhada', () => {
    const facing = locomotionFacing(
      { ...baseAnim('idle'), moveFacingX: 0, moveFacingY: -1 } as never,
      -1,
      0
    );

    expect(facing).toEqual({ x: -1, y: 0 });
  });
});

describe('recoilAtElapsed', () => {
  it('comeca no release e retorna suavemente a zero', () => {
    expect(recoilAtElapsed(49, 50)).toBe(0);
    expect(recoilAtElapsed(50, 50)).toBe(1);
    expect(recoilAtElapsed(110, 50, 120)).toBeCloseTo(0.25, 5);
    expect(recoilAtElapsed(170, 50, 120)).toBe(0);
  });

  it('nao vaza recoil entre ataques', () => {
    expect(recoilAtElapsed(500, 50)).toBe(0);
  });
});

describe('EntityPresentation', () => {
  it('apresenta walk na direção do deslocamento quando o facing da entidade está zerado', () => {
    const presentation = new EntityPresentation();
    const entity = { id: 1, archetype: 'prospector', facing: { x: 0, y: 0 } };
    const state = { tick: 0 };
    const base = { ...baseAnim('walk'), moveFacingX: -1, moveFacingY: 0 };

    const presented = presentation.animationFor(entity as never, state as never, base as never, 1_000);

    expect(presented.anim).toBe('walk');
    expect(presented.facingX).toBe(-1);
    expect(presented.facingY).toBe(0);
  });

  it('avanca recoil entre renders mesmo quando o tick nao muda', () => {
    const presentation = new EntityPresentation();
    const entity = actionEntity('prospector', 'shoot');
    const state = { tick: 1 };

    const first = presentation.animationFor(entity as never, state as never, baseAnim('walk') as never, 1_000);
    const second = presentation.animationFor(entity as never, state as never, baseAnim('walk') as never, 1_030);

    expect(typeof first.anim).toBe('object');
    expect(typeof second.anim).toBe('object');
    if (typeof first.anim === 'object' && typeof second.anim === 'object') {
      expect(first.anim.upper.elapsedMs).toBe(50);
      expect(second.anim.upper.elapsedMs).toBe(80);
      expect(first.anim.recoil).toBe(1);
      expect(second.anim.recoil).toBeLessThan(first.anim.recoil);
    }
  });

  it('mantem telegraph de inimigo mesmo durante hit nao letal', () => {
    const presentation = new EntityPresentation();
    const entity = actionEntity('bomber', 'detonate');
    const state = { tick: 3 };

    const presented = presentation.animationFor(entity as never, state as never, baseAnim('hit', 900) as never, 1_000);

    expect(presented.anim).toBe('special');
  });

  it('cancela imediatamente um telegraph visual armazenado quando a entidade e atordoada', () => {
    const presentation = new EntityPresentation();
    presentation.ingest([{
      t: 'action_start', entity: 10, action: 'hurl', x: 0, y: 0, dx: 1, dy: 0,
      startTick: 0, releaseTick: 16, endTick: 24,
    }] as never, 0);
    const entity = { id: 10, archetype: 'bruiser', facing: { x: 1, y: 0 }, stunnedUntil: 20 };
    const stunned = presentation.animationFor(entity as never, { tick: 5 } as never, baseAnim('walk') as never, 250);
    expect(stunned.anim).toBe('idle');
    const recovered = presentation.animationFor(
      { ...entity, stunnedUntil: 20 } as never, { tick: 20 } as never, baseAnim('walk') as never, 1_000
    );
    expect(recovered.anim).toBe('walk');
  });

  it('preserva o telegraph quando o snapshot ainda mantem a acao autoritativa durante o stun', () => {
    const presentation = new EntityPresentation();
    const entity = { ...actionEntity('bomber', 'detonate'), stunnedUntil: 20 };
    const presented = presentation.animationFor(
      entity as never, { tick: 5 } as never, baseAnim('idle') as never, 250
    );
    expect(presented.anim).toBe('special');
  });

  it('permite que hit interrompa somente a composicao do prospector', () => {
    const presentation = new EntityPresentation();
    const entity = actionEntity('prospector', 'shoot');
    const state = { tick: 3 };

    const presented = presentation.animationFor(entity as never, state as never, baseAnim('hit', 900) as never, 1_000);

    expect(presented.anim).toBe('hit');
  });
});
