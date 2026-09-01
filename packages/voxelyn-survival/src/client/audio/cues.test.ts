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

  // Dano por tick do chao chega a 20 Hz; como pancada (`hitPlayer`) ele
  // virava um thud grave continuo no centro do estereo. A sim marca `hazard`
  // no proprio call site e o cliente so obedece.
  it('roteia dano de hazard no jogador local para a voz de pressao', () => {
    const [cue] = cuesForEvent(
      { t: 'hit', x: 1, y: 1, amount: 0.55, target: 1, hazard: true },
      ctx,
    );
    expect(cue.voice).toBe('hitPlayerHazard');
    // Escala fixa: o dano por tick e minusculo e constante.
    expect(cue.scale).toBe(1);
  });

  // O caso que derrubou a primeira forma deste campo (review do Codex no
  // PR 142): a varredura da Fornalha fere com {kind:'fire'} mas E pancada de
  // chefe — ela nao marca hazard, e tem de sair como impacto pleno.
  it('pancada de chefe que por acaso e de fogo continua hitPlayer', () => {
    const [cue] = cuesForEvent({ t: 'hit', x: 1, y: 1, amount: 12, target: 1 }, ctx);
    expect(cue.voice).toBe('hitPlayer');
    expect(cue.scale).toBeGreaterThan(1);
  });

  // Servidor sem o flag (fixtures, eventos construidos a mao): cai no
  // comportamento historico em vez de sumir.
  it('dano sem flag cai na voz de pancada', () => {
    const [cue] = cuesForEvent({ t: 'hit', x: 1, y: 1, amount: 10, target: 1 }, ctx);
    expect(cue.voice).toBe('hitPlayer');
  });

  // O hazard so muda o som de quem SENTE o dano: um bicho queimando continua
  // relatado como dano nos outros.
  it('hazard nos outros continua hitEnemy', () => {
    const [cue] = cuesForEvent({ t: 'hit', x: 1, y: 1, amount: 2, target: 7, hazard: true }, ctx);
    expect(cue.voice).toBe('hitEnemy');
  });

  it('a voz de pressao ambiental nao disputa com a pancada', () => {
    expect(VOICE_SPECS.hitPlayerHazard.priority).toBeLessThan(VOICE_SPECS.hitPlayer.priority);
    expect(VOICE_SPECS.hitPlayerHazard.gain).toBeLessThan(VOICE_SPECS.hitPlayer.gain);
    // A trava longa e o que transforma 20 eventos/s em ~2 toques/s.
    expect(VOICE_SPECS.hitPlayerHazard.minIntervalMs).toBeGreaterThanOrEqual(400);
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

  // O mineiro tem voz propria pelo motivo INVERSO ao dos chefes: nao porque a
  // morte dele encerra alguma coisa, mas porque ele e a unica pessoa do
  // bestiario. No `death` generico o jogo diria que matar alguem que estava
  // trabalhando soa igual a estourar um bomber.
  it('a morte do mineiro nao soa como a de um bicho nem como a de um chefe', () => {
    const death = (archetype: string, entity: number): SemanticEvent => ({
      t: 'death',
      x: 0,
      y: 0,
      entity,
      archetype,
      facingX: 1,
      facingY: 0,
      tick: 10,
    });
    const mineiro = cuesForEvent(death('miner', 7), ctx);
    expect(mineiro[0].voice).toBe('deathMiner');
    expect(mineiro[0].voice).not.toBe(cuesForEvent(death('stalker', 8), ctx)[0].voice);
    expect(mineiro[0].voice).not.toBe(cuesForEvent(death('guardian', 9), ctx)[0].voice);
    // Espacial e nao de interface: importa DE ONDE veio, porque voce atirou
    // naquela direcao de proposito.
    expect(VOICE_SPECS.deathMiner.spatial).toBe(true);
    expect(VOICE_SPECS.deathMiner.priority).toBeGreaterThan(VOICE_SPECS.death.priority);
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
    expect(cuesForEvent({ t: 'message', key: 'sim.partnerRevived' }, ctx)).toEqual([]);
  });

  it('as vozes de interface sao do jogador local, nunca do parceiro', () => {
    // No co-op os dois clientes recebem os mesmos eventos. O modulo que se
    // esgotou no parceiro, a carga que ele gastou e a celula que ele recolheu
    // nao tem posicao no mundo — e por isso nao podem soar aqui como se
    // fossem deste jogador.
    const partner = 1;
    const mine = 0;
    const expired = (slot: number): SemanticEvent => ({
      t: 'module_expired',
      slot,
      module: 'piercing',
    });
    const charge = (slot: number): SemanticEvent => ({
      t: 'module_charge_consumed',
      slot,
      module: 'piercing',
      remaining: 0,
      maximum: 3,
    });
    const cell = (slot: number): SemanticEvent => ({ t: 'purge_cell_acquired', slot, amount: 1 });
    for (const make of [expired, charge, cell]) {
      expect(cuesForEvent(make(partner), ctx)).toEqual([]);
      expect(cuesForEvent(make(mine), ctx)).toHaveLength(1);
    }
  });

  it('as vozes posicionais do parceiro continuam soando, no lugar dele', () => {
    const overheat = cuesForEvent({ t: 'overheat', slot: 1, x: 40, y: 12 }, ctx);
    expect(overheat).toHaveLength(1);
    expect(overheat[0].x).toBe(40);
  });

  it('o bolt morrendo em parede firme deixou de ser mudo', () => {
    // Era o UNICO fim de tiro sem som nem particula: rocha firme engolia o bolt
    // em silencio. O burst de plasma soa no ponto de contato.
    const [cue] = cuesForEvent({ t: 'bolt_impact', x: 3.5, y: 4, nx: -1, ny: 0 }, ctx);
    expect(cue).toBeDefined();
    expect(cue.x).toBe(3.5);
    expect(cue.y).toBe(4);
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
