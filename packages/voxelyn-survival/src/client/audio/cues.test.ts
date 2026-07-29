import { describe, expect, it } from 'vitest';
import { SOLID_CRYSTAL, SOLID_ROCK } from '@voxelyn/survival-sim';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import { cuesForEvent, cuesForEvents, impactScale } from './cues';
import { VOICE_SPECS } from './voices';
import { VOICE_RENDERERS } from './synth';

const ctx = { worldWidth: 96, localPlayerId: 1 };

describe('traducao de evento para som', () => {
  // Este e o teste que protege a promessa central do design: "todo perigo tem
  // telegraph visual e/ou sonoro". Uma acao nova de inimigo que entre em
  // EntityActionKind sem voz aqui quebra esta suite antes de chegar ao jogador.
  it('da voz propria a cada acao telegrafada de inimigo', () => {
    const kinds = ['ranged', 'contact', 'charge', 'detonate', 'slam', 'hurl', 'pulse'] as const;
    const voices = new Set<string>();
    for (const action of kinds) {
      const ev: SemanticEvent = {
        t: 'action_start',
        entity: 9,
        action,
        x: 5,
        y: 5,
        dx: 1,
        dy: 0,
        startTick: 0,
        releaseTick: 16,
        endTick: 30,
      };
      const cues = cuesForEvent(ev, ctx);
      expect(cues, `acao ${action} ficou muda`).toHaveLength(1);
      voices.add(cues[0].voice);
    }
    // Charge e contact compartilham voz de proposito (sao a mesma ameaca de
    // corpo a corpo); o resto tem de ser distinguivel de ouvido.
    expect(voices.size).toBeGreaterThanOrEqual(6);
  });

  // O disparo do proprio jogador ja soa por `shot`; um telegrafo aqui daria
  // dois sons por tiro e dobraria a densidade do canal mais usado do jogo.
  it('nao telegrafa o disparo do proprio jogador', () => {
    const ev: SemanticEvent = {
      t: 'action_start',
      entity: 1,
      action: 'player_shot',
      x: 0,
      y: 0,
      dx: 1,
      dy: 0,
      startTick: 0,
      releaseTick: 0,
      endTick: 2,
    };
    expect(cuesForEvent(ev, ctx)).toEqual([]);
  });

  it('separa dano em mim de dano nos outros', () => {
    const meu = cuesForEvent({ t: 'hit', x: 1, y: 1, amount: 10, target: 1 }, ctx);
    const dele = cuesForEvent({ t: 'hit', x: 1, y: 1, amount: 10, target: 7 }, ctx);
    expect(meu[0].voice).toBe('hitPlayer');
    expect(dele[0].voice).toBe('hitEnemy');
    // Nao basta o timbre mudar: levar dano tem de ganhar a disputa por vaga
    // contra qualquer coisa que seja so textura.
    expect(VOICE_SPECS.hitPlayer.priority).toBeGreaterThan(VOICE_SPECS.hitEnemy.priority);
  });

  it('escala o impacto pelo dano, com piso audivel e teto', () => {
    expect(impactScale(0)).toBeGreaterThanOrEqual(0.55);
    expect(impactScale(6)).toBeLessThan(impactScale(42));
    expect(impactScale(9999)).toBeLessThanOrEqual(1.4);
  });

  it('distingue cristal de rocha ao quebrar', () => {
    expect(cuesForEvent({ t: 'break', x: 0, y: 0, solid: SOLID_CRYSTAL }, ctx)[0].voice).toBe(
      'breakCrystal',
    );
    expect(cuesForEvent({ t: 'break', x: 0, y: 0, solid: SOLID_ROCK }, ctx)[0].voice).toBe(
      'breakRock',
    );
  });

  it('da voz de fim de ato a morte do guardiao', () => {
    const guardiao = cuesForEvent(
      {
        t: 'death',
        x: 0,
        y: 0,
        entity: 5,
        archetype: 'guardian',
        facingX: 1,
        facingY: 0,
        tick: 10,
      },
      ctx,
    );
    const bicho = cuesForEvent(
      { t: 'death', x: 0, y: 0, entity: 6, archetype: 'stalker', facingX: 1, facingY: 0, tick: 10 },
      ctx,
    );
    expect(guardiao[0].voice).toBe('deathGuardian');
    expect(bicho[0].voice).toBe('death');
  });

  // A descarga chega como lista de celulas; sem o centroide o som sairia na
  // origem do mapa, ou seja sempre no mesmo canto do estereo.
  it('posiciona a descarga no centro das celulas atingidas', () => {
    const cells = [0, 1, 96, 97]; // quadrado 2x2 no canto, mundo de 96 de largura
    const [cue] = cuesForEvent({ t: 'discharge', cells, source: 'player', owner: 1 }, ctx);
    expect(cue.x).toBeCloseTo(1, 5);
    expect(cue.y).toBeCloseTo(1, 5);
  });

  it('ignora descarga sem celulas em vez de dividir por zero', () => {
    expect(cuesForEvent({ t: 'discharge', cells: [], source: 'environment' }, ctx)).toEqual([]);
  });

  // A ultima carga e a informacao acionavel: sem destaque, o jogador so
  // descobre que ficou sem modulo no tiro seguinte, que ja saiu errado.
  it('destaca a ultima carga de um modulo', () => {
    const ultima = cuesForEvent(
      { t: 'module_charge_consumed', slot: 0, module: 'piercing', remaining: 0, maximum: 3 },
      ctx,
    );
    const comum = cuesForEvent(
      { t: 'module_charge_consumed', slot: 0, module: 'piercing', remaining: 2, maximum: 3 },
      ctx,
    );
    expect(ultima[0].scale).toBeGreaterThan(comum[0].scale);
  });

  it('nao inventa som para mensagem de texto', () => {
    expect(cuesForEvent({ t: 'message', text: 'oi' }, ctx)).toEqual([]);
  });

  it('preserva a ordem de chegada ao traduzir uma leva', () => {
    const events: SemanticEvent[] = [
      { t: 'shot', x: 0, y: 0, dx: 1, dy: 0, owner: 1 },
      { t: 'hit', x: 1, y: 0, amount: 14, target: 4 },
      { t: 'death', x: 1, y: 0, entity: 4, archetype: 'stalker', facingX: 1, facingY: 0, tick: 3 },
    ];
    expect(cuesForEvents(events, ctx).map((c) => c.voice)).toEqual(['shot', 'hitEnemy', 'death']);
  });

  // Uma voz declarada sem receita sai muda em silencio, e um bug mudo e o pior
  // tipo num sistema de audio: nada quebra, so falta.
  it('toda voz declarada tem receita de sintese', () => {
    for (const id of Object.keys(VOICE_SPECS)) {
      expect(VOICE_RENDERERS[id], `voz ${id} sem receita`).toBeTypeOf('function');
    }
  });

  it('nenhum telegrafo perde prioridade para textura do mundo', () => {
    const telegrafos = Object.entries(VOICE_SPECS).filter(([id]) => id.startsWith('telegraph'));
    const textura = ['breakRock', 'corrode', 'chip', 'ignite'] as const;
    for (const [id, spec] of telegrafos) {
      for (const outra of textura) {
        expect(spec.priority, `${id} perde para ${outra}`).toBeGreaterThan(
          VOICE_SPECS[outra].priority,
        );
      }
    }
  });
});
