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

    // O Prospector caminha COMPOSTO, e nao pelo sheet completo: o sheet ainda
    // carrega a picareta que a arma substituiu, e alternar entre os dois trocava
    // o modelo do personagem toda vez que ele soltava o gatilho.
    expect(typeof presented.anim).toBe('object');
    if (typeof presented.anim === 'object') {
      expect(presented.anim.lower.animation).toBe('walk');
      expect(presented.anim.lower.facingX).toBe(-1);
      expect(presented.anim.lower.facingY).toBe(0);
      expect(presented.anim.recoil).toBe(0);
    }
  });

  it('mantem hit, die e revive no sheet completo, que sao as poses que as camadas nao autoram', () => {
    const presentation = new EntityPresentation();
    const entity = { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 };

    for (const pose of ['hit', 'die']) {
      const presented = presentation.animationFor(
        entity as never, { tick: 0 } as never, baseAnim(pose) as never, 1_000
      );
      expect(presented.anim).toBe(pose);
    }
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
    // Andando para -x com a mira em +x, sem atirar: o corpo INTEIRO segue o
    // andar. A mira de mouse muda de quadrante o tempo todo, e um tronco preso a
    // ela deixava o bot torcido em quase todo quadro de caminhada.
    const presented = presentation.animationFor(
      { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 } as never,
      { tick: 0 } as never,
      { ...baseAnim('walk'), moveFacingX: -1, moveFacingY: 0 } as never,
      1_000
    );

    expect(typeof presented.anim).toBe('object');
    if (typeof presented.anim === 'object') {
      expect(presented.anim.lower.facingX).toBe(-1);
      expect(presented.anim.upper.facingX).toBe(-1);
    }
  });

  it('so entrega o tronco a mira quando ela vira tiro', () => {
    const presentation = new EntityPresentation();
    const walkingWest = { ...baseAnim('walk'), moveFacingX: -1, moveFacingY: 0 };
    const entity = { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 };
    const firing = {
      ...entity,
      action: { kind: 'shoot', startedAt: 0, releaseAt: 1, endsAt: 7, direction: { x: 1, y: 0 } },
    };

    const shot = presentation.animationFor(
      firing as never, { tick: 0 } as never, walkingWest as never, 1_000
    );
    // Disparo: pernas no andar, tronco no cano. As duas metades do mesmo quadro.
    expect(typeof shot.anim).toBe('object');
    if (typeof shot.anim === 'object') {
      expect(shot.anim.lower.facingX).toBe(-1);
      expect(shot.anim.upper.facingX).toBe(1);
    }

    // Acabada a acao, o tronco volta para as pernas em vez de ficar torcido.
    const after = presentation.animationFor(
      entity as never, { tick: 20 } as never, walkingWest as never, 2_000
    );
    expect(typeof after.anim).toBe('object');
    if (typeof after.anim === 'object') {
      expect(after.anim.upper.facingX).toBe(-1);
    }
  });

  /**
   * Andar EM CIMA da fronteira de quadrante — que e onde W, A, S e D sozinhos
   * caem — e o caso em que as duas camadas mais podem discordar: cada uma tem a
   * propria histerese, e no fio da fronteira cada memoria segura o quadrante que
   * ja estava desenhado. Se o tronco resolvesse o rumo do andar por conta
   * propria, o bot subiria a tela com as pernas num quadrante e o tronco no
   * vizinho, torcido enquanto a tecla estivesse presa.
   */
  it('nao torce o corpo ao andar em cima da fronteira depois de atirar para outro lado', () => {
    const presentation = new EntityPresentation();
    const entity = { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 };
    // Tiro para +x enquanto anda para -x: as duas camadas ficam em quadrantes
    // diferentes, que e o estado de onde a torcao nasceria.
    presentation.animationFor(
      {
        ...entity,
        action: { kind: 'player_shot', startedAt: 0, releaseAt: 0, endsAt: 7, direction: { x: 1, y: 0 } },
      } as never,
      { tick: 0 } as never,
      { ...baseAnim('walk'), moveFacingX: -1, moveFacingY: 0 } as never,
      1_000
    );

    // Agora sobe a tela: em coordenadas de mundo, o vetor que cai exatamente
    // sobre a fronteira entre `ul` e `ur`.
    const up = -Math.SQRT1_2;
    const presented = presentation.animationFor(
      entity as never,
      { tick: 20 } as never,
      { ...baseAnim('walk'), moveFacingX: up, moveFacingY: up } as never,
      2_000
    );

    expect(typeof presented.anim).toBe('object');
    if (typeof presented.anim === 'object') {
      const { lower, upper } = presented.anim;
      expect(dirFromFacing(upper.facingX, upper.facingY)).toBe(dirFromFacing(lower.facingX, lower.facingY));
    }
  });

  it('action_end apaga o intent: pose de sopro cancelada nao volta depois do revive', () => {
    const presentation = new EntityPresentation();
    // O cast prometeu 50 ticks de pose; a sim cancelou no tick 10.
    presentation.ingest(
      [
        {
          t: 'action_start',
          entity: 1,
          action: 'breath',
          x: 0,
          y: 0,
          dx: 1,
          dy: 0,
          startTick: 0,
          releaseTick: 0,
          endTick: 50,
        },
        { t: 'action_end', entity: 1 },
      ] as never,
      1_000
    );
    const entity = { id: 1, archetype: 'prospector', facing: { x: 1, y: 0 }, stunnedUntil: 0 };
    const presented = presentation.animationFor(
      entity as never, { tick: 12 } as never, baseAnim('idle') as never, 1_500
    );
    expect(typeof presented.anim).toBe('object');
    if (typeof presented.anim === 'object') {
      expect(presented.anim.upper.animation).toBe('idle');
      expect(presented.anim.recoil).toBe(0);
    }
  });

  it('durante o sopro canalizado o tronco segue a mira VIVA, nao a do instante do cast', () => {
    const presentation = new EntityPresentation();
    // A acao `breath` durou dezenas de ticks e nasceu apontando para +x; no meio
    // dela o jogador girou o stick para -y. `entity.facing` — que a simulacao
    // atualiza por tick — e quem manda no tronco, senao o corpo aponta para um
    // lado enquanto a chama sai pelo outro.
    const entity = {
      id: 1,
      archetype: 'prospector',
      facing: { x: 0, y: -1 },
      stunnedUntil: 0,
      action: {
        kind: 'breath',
        startedAt: 0,
        releaseAt: 0,
        endsAt: 50,
        direction: { x: 1, y: 0 },
      },
    };
    const presented = presentation.animationFor(
      entity as never, { tick: 10 } as never, baseAnim('idle') as never, 1_000
    );
    expect(typeof presented.anim).toBe('object');
    if (typeof presented.anim === 'object') {
      expect(presented.anim.upper.facingX).toBe(0);
      expect(presented.anim.upper.facingY).toBe(-1);
    }
  });
});
