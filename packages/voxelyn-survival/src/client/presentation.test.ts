import { describe, expect, it } from 'vitest';
import { dirFromFacing } from '@voxelyn/survival-content';
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

  /**
   * O bug reportado como "o Miner fica em flicker": raspando parede, o sprite
   * girava no proprio eixo.
   *
   * Nao era animacao. Era o cliente discordando da simulacao sobre o rumo. Um
   * inimigo em diagonal encostado numa parede tem um eixo do deslocamento ZERADO
   * pela colisao, e so o outro sobra. O rumo derivado do deslocamento observado
   * salta para (0,-1) — quadrante isometrico `ur` — enquanto o rumo autoritativo
   * segue em (0,94, -0,33), que e `dr`. Alguns quadros de cada lado, ida e volta:
   * pião.
   *
   * A sequencia abaixo e a que foi capturada instrumentando o render de verdade
   * num navegador, com o Miner fugindo por um tunel. O que o teste cobra e o que
   * o jogador ve: UM quadrante, do primeiro ao ultimo quadro.
   */
  it('nao gira inimigo no proprio eixo quando a colisao zera um eixo do deslocamento', () => {
    const presentation = new EntityPresentation();
    const heading = { x: 0.94, y: -0.33 };
    // Cada item e o deslocamento OBSERVADO num quadro: os `0,-1` sao os quadros
    // em que a parede comeu o avanco em x.
    const observed = [
      [0.94, -0.33], [0, -1], [0, -1], [0.94, -0.33], [0, -1], [0.93, -0.36], [0, -1], [0.94, -0.33],
    ] as const;

    const dirs = observed.map(([mx, my], i) => {
      const presented = presentation.animationFor(
        { id: 10, archetype: 'miner', facing: heading, stunnedUntil: 0 } as never,
        { tick: i } as never,
        { ...baseAnim('walk'), moveFacingX: mx, moveFacingY: my } as never,
        1_000 + i * 50
      );
      return dirFromFacing(presented.facingX, presented.facingY);
    });

    expect(new Set(dirs).size).toBe(1);
    expect(dirs[0]).toBe(dirFromFacing(heading.x, heading.y));
  });

  it('ainda deriva o rumo do prospector do deslocamento, porque o facing dele e a mira', () => {
    const presentation = new EntityPresentation();
    // Atirando para +x enquanto anda para -x: as pernas tem de seguir o andar.
    const presented = presentation.animationFor(
      { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 } as never,
      { tick: 0 } as never,
      { ...baseAnim('walk'), moveFacingX: -1, moveFacingY: 0 } as never,
      1_000
    );

    expect(presented.facingX).toBe(-1);
  });
});
