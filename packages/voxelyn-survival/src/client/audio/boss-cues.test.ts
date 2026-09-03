// A ASSINATURA SONORA DE CADA CHEFE, como tradução de evento em voz.
//
// O que esta suite protege: preparação, execução e consequência de cada
// habilidade de chefe têm voz PRÓPRIA (ou uma reserva deliberada), o chefe
// nunca fala pelo telegrafo genérico, a vocalização nunca rouba a vaga de um
// windup, e o canto do Leviatã não mascara a própria descarga.
import { describe, expect, it } from 'vitest';
import {
  BOSS_ARCHETYPES,
  BOSS_PHASE_OVERHEAT,
  BOSS_PHASE_REACTOR,
  BOSS_PHASE_UNSTABLE,
} from '@voxelyn/survival-sim';
import type { BossAbility, EnemyArchetype, SemanticEvent } from '@voxelyn/survival-sim';
import { cuesForEvent } from './cues';
import { VOICE_SPECS } from './voices';
import { VOICE_RENDERERS } from './synth';

const ctx = { worldWidth: 96, localPlayerId: 1 };

const windup = (
  archetype: EnemyArchetype,
  ability: BossAbility,
  intensity?: number,
): SemanticEvent => ({
  t: 'boss_windup',
  archetype,
  ability,
  x: 10,
  y: 10,
  dx: 1,
  dy: 0,
  releaseTick: 40,
  ...(intensity !== undefined ? { intensity } : {}),
});
const attack = (
  archetype: EnemyArchetype,
  ability: BossAbility,
  intensity?: number,
): SemanticEvent => ({
  t: 'boss_attack',
  archetype,
  ability,
  x: 10,
  y: 10,
  dx: 1,
  dy: 0,
  ...(intensity !== undefined ? { intensity } : {}),
});

describe('cada chefe tem assinatura, e ela usa os tres momentos', () => {
  it('um chefe NUNCA fala pelo telegrafo generico do action_start', () => {
    for (const archetype of BOSS_ARCHETYPES) {
      const ev: SemanticEvent = {
        t: 'action_start',
        entity: 9,
        action: 'slam',
        archetype,
        x: 5,
        y: 5,
        dx: 1,
        dy: 0,
        startTick: 0,
        releaseTick: 16,
        endTick: 30,
      };
      expect(cuesForEvent(ev, ctx), `${archetype} falou pelo generico`).toEqual([]);
    }
    // ...e um bicho comum continua falando por ele.
    const bruiser: SemanticEvent = {
      t: 'action_start',
      entity: 9,
      action: 'slam',
      archetype: 'bruiser',
      x: 5,
      y: 5,
      dx: 1,
      dy: 0,
      startTick: 0,
      releaseTick: 16,
      endTick: 30,
    };
    expect(cuesForEvent(bruiser, ctx)[0].voice).toBe('telegraphSlam');
  });

  it('preparacao e execucao de uma mesma habilidade sao vozes DIFERENTES', () => {
    const pairs: Array<[EnemyArchetype, BossAbility]> = [
      ['guardian', 'slam'],
      ['diamandis', 'drill'],
      ['diamandis', 'demolish'],
      ['diamandis', 'beam'],
      ['white_devourer', 'erupt'],
      ['archcantor', 'song'],
      ['sheet_leviathan', 'massive_shock'],
      ['furnace_heart', 'wave'],
      ['frost_queen', 'freeze'],
    ];
    for (const [archetype, ability] of pairs) {
      const before = cuesForEvent(windup(archetype, ability), ctx);
      const now = cuesForEvent(attack(archetype, ability), ctx);
      expect(before.length, `${archetype}/${ability} sem preparacao`).toBeGreaterThan(0);
      expect(now.length, `${archetype}/${ability} sem execucao`).toBeGreaterThan(0);
      expect(before[0].voice).not.toBe(now[0].voice);
      // Nenhum dos dois e um telegrafo generico.
      expect(before[0].voice.startsWith('telegraph')).toBe(false);
    }
  });

  it('uma habilidade sem assinatura cai no telegrafo generico, nunca no silencio', () => {
    // O golpe pesado do Bispo nao tem voz propria: soa como o slam de sempre.
    const [cue] = cuesForEvent(windup('bishop', 'slam'), ctx);
    expect(cue.voice).toBe('telegraphSlam');
  });

  it('a assinatura de cada chefe tem prioridade de windup no que promete dano', () => {
    const lethal: Array<[EnemyArchetype, BossAbility]> = [
      ['guardian', 'slam'],
      ['diamandis', 'drill'],
      ['white_devourer', 'erupt'],
      ['archcantor', 'song'],
      ['sheet_leviathan', 'massive_shock'],
      ['furnace_heart', 'wave'],
      ['frost_queen', 'freeze'],
    ];
    for (const [archetype, ability] of lethal) {
      const [cue] = cuesForEvent(windup(archetype, ability), ctx);
      expect(VOICE_SPECS[cue.voice].priority, `${cue.voice}`).toBe(10);
    }
  });
});

describe('Diamandis: a maquina emite ordens de trabalho', () => {
  it('cada ferramenta sai com a ferramenta E a frase de sistema', () => {
    const drill = cuesForEvent(windup('diamandis', 'drill'), ctx).map((c) => c.voice);
    expect(drill).toEqual(['diamandisDrillSpin', 'diamandisVoiceStandClear']);
    const demolish = cuesForEvent(windup('diamandis', 'demolish'), ctx).map((c) => c.voice);
    expect(demolish).toEqual(['diamandisChargeArmed', 'diamandisVoiceArmed']);
    const beam = cuesForEvent(windup('diamandis', 'beam'), ctx).map((c) => c.voice);
    expect(beam).toEqual(['diamandisBeamScan', 'diamandisVoiceSurvey']);
  });

  it('a voz corporativa e personalidade: nunca disputa com um windup', () => {
    for (const id of Object.keys(VOICE_SPECS).filter((v) => v.startsWith('diamandisVoice'))) {
      expect(VOICE_SPECS[id as keyof typeof VOICE_SPECS].priority).toBeLessThan(
        VOICE_SPECS.diamandisDrillSpin.priority,
      );
    }
  });

  it('liga em vez de acordar, falha em vez de enfurecer, desliga em vez de rugir', () => {
    const boot = cuesForEvent({ t: 'boss_awake', archetype: 'diamandis', x: 4, y: 4 }, ctx);
    expect(boot.map((c) => c.voice)).toEqual(['diamandisBoot', 'diamandisVoiceUnmapped']);
    const fault = cuesForEvent(
      { t: 'boss_phase', archetype: 'diamandis', phase: BOSS_PHASE_REACTOR, x: 4, y: 4 },
      ctx,
    );
    expect(fault.map((c) => c.voice)).toEqual(['diamandisReactorFail', 'diamandisVoiceFault']);
    const death = cuesForEvent(
      {
        t: 'death',
        x: 0,
        y: 0,
        entity: 5,
        archetype: 'diamandis',
        facingX: 1,
        facingY: 0,
        tick: 1,
      },
      ctx,
    );
    expect(death[0].voice).toBe('diamandisShutdown');
    const lost = cuesForEvent({ t: 'boss_module', x: 1, y: 1, module: 0, state: 'lost' }, ctx);
    expect(lost[0].voice).toBe('diamandisVoiceLost');
    expect(
      cuesForEvent({ t: 'boss_module', x: 1, y: 1, module: 0, state: 'exposed' }, ctx),
    ).toEqual([]);
  });
});

describe('Leviata: o canto e linguagem', () => {
  it('a carga e a descarga sao informacao GLOBAL da arena', () => {
    const [charge] = cuesForEvent(windup('sheet_leviathan', 'massive_shock'), ctx);
    const [release] = cuesForEvent(attack('sheet_leviathan', 'massive_shock'), ctx);
    expect(VOICE_SPECS[charge.voice].spatial).toBe(false);
    expect(VOICE_SPECS[release.voice].spatial).toBe(false);
    // O evento de particulas da descarga nao soa de novo.
    expect(
      cuesForEvent({ t: 'leviathan_discharge', x: 0, y: 0, radius: 99, bubbles: [] }, ctx),
    ).toEqual([]);
  });

  it('o chamado nao pode mascarar a propria descarga', () => {
    const [call] = cuesForEvent(
      { t: 'boss_state', archetype: 'sheet_leviathan', state: 'call', x: 1, y: 1 },
      ctx,
    );
    expect(call.voice).toBe('leviathanCall');
    expect(VOICE_SPECS.leviathanCall.priority).toBeLessThan(
      VOICE_SPECS.leviathanShockCharge.priority,
    );
    expect(VOICE_SPECS.leviathanCall.priority).toBeLessThan(
      VOICE_SPECS.leviathanShockRelease.priority,
    );
  });

  it('o Diluvio e a recuperacao sao momentos proprios', () => {
    expect(cuesForEvent(windup('sheet_leviathan', 'deluge'), ctx)[0].voice).toBe(
      'leviathanDelugeRise',
    );
    const [recover] = cuesForEvent(
      { t: 'boss_state', archetype: 'sheet_leviathan', state: 'recover', x: 1, y: 1 },
      ctx,
    );
    expect(recover.voice).toBe('leviathanShockRecover');
  });
});

describe('Arquicantor: nota, intervalo, acorde', () => {
  it('idle e uma nota; a preparacao e a frase; o ataque completa — ou nao resolve', () => {
    const [note] = cuesForEvent(
      { t: 'boss_state', archetype: 'archcantor', state: 'idle_note', x: 1, y: 1 },
      ctx,
    );
    expect(note.voice).toBe('archcantorNote');
    expect(cuesForEvent(windup('archcantor', 'song', 0.3), ctx)[0].voice).toBe('archcantorPhrase');
    expect(cuesForEvent(attack('archcantor', 'song', 0.2), ctx)[0].voice).toBe('archcantorChord');
    expect(cuesForEvent(attack('archcantor', 'song', 0.9), ctx)[0].voice).toBe('archcantorTritone');
  });

  it('cada camada que responde e uma nota, mais fraca quanto mais longe', () => {
    const near = cuesForEvent(
      { t: 'boss_state', archetype: 'archcantor', state: 'resonance', x: 1, y: 1, intensity: 1 },
      ctx,
    );
    const far = cuesForEvent(
      { t: 'boss_state', archetype: 'archcantor', state: 'resonance', x: 1, y: 1, intensity: 0.2 },
      ctx,
    );
    expect(near[0].voice).toBe('archcantorResonance');
    expect(far[0].scale).toBeLessThan(near[0].scale);
  });

  it('o CORO tem uma nota por posicao, e a nota sai da posicao — nao de quem esta nela', () => {
    // O acorde descreve a FORMACAO. E por isso que um coro incompleto soa
    // incompleto: a voz que falta nao emite, e o buraco no acorde e o buraco na
    // orbita — o jogador ouve de que lado esta a janela de tiro.
    const cardinal = (intensity: number) =>
      cuesForEvent(
        { t: 'boss_state', archetype: 'archcantor', state: 'choir_voice', x: 1, y: 1, intensity },
        ctx,
      )[0].voice;
    const notes = [cardinal(0), cardinal(1 / 3), cardinal(2 / 3), cardinal(1)];
    expect(notes).toEqual([
      'archcantorChoirRoot',
      'archcantorChoirThird',
      'archcantorChoirFifth',
      'archcantorChoirNinth',
    ]);
    // Quatro vozes distintas: duas posicoes que soassem igual apagariam a
    // informacao inteira.
    expect(new Set(notes).size).toBe(4);
    for (const note of notes) expect(VOICE_SPECS[note].spatial).toBe(true);
  });

  it('a danca CONFIRMA a geometria nova, e o solista chega dissonante', () => {
    const [step] = cuesForEvent(
      {
        t: 'boss_state',
        archetype: 'archcantor',
        state: 'choir_rotate',
        x: 1,
        y: 1,
        intensity: 0.5,
      },
      ctx,
    );
    expect(step.voice).toBe('archcantorChoirStep');
    // Presenca, e nao aviso: a danca nao pede resposta nenhuma.
    expect(VOICE_SPECS.archcantorChoirStep.priority).toBeLessThan(
      VOICE_SPECS.archcantorChord.priority,
    );
    const [solo] = cuesForEvent(
      { t: 'boss_state', archetype: 'archcantor', state: 'dissonance', x: 1, y: 1, intensity: 1 },
      ctx,
    );
    expect(solo.voice).toBe('archcantorDissonance');
    // O solista chega de perto: o cue dele TEM de localizar.
    expect(VOICE_SPECS.archcantorDissonance.spatial).toBe(true);
  });

  it('o silencio da Catedral e vulnerabilidade, e a rede voltando devolve uma nota', () => {
    const [silenced] = cuesForEvent(
      { t: 'boss_vulnerable', archetype: 'archcantor', x: 1, y: 1, open: true },
      ctx,
    );
    expect(silenced.voice).toBe('archcantorSilenced');
    expect(VOICE_SPECS.archcantorSilenced.priority).toBe(9);
    const [back] = cuesForEvent(
      { t: 'boss_vulnerable', archetype: 'archcantor', x: 1, y: 1, open: false },
      ctx,
    );
    expect(back.voice).toBe('archcantorNote');
  });

  it('a Rainha e o Arquicantor nao dividem linguagem', () => {
    const queen = new Set<string>();
    for (const ability of ['freeze'] as const) {
      for (const cue of cuesForEvent(windup('frost_queen', ability), ctx)) queen.add(cue.voice);
      for (const cue of cuesForEvent(attack('frost_queen', ability), ctx)) queen.add(cue.voice);
    }
    const cantor = new Set<string>();
    for (const cue of cuesForEvent(windup('archcantor', 'song'), ctx)) cantor.add(cue.voice);
    for (const cue of cuesForEvent(attack('archcantor', 'song'), ctx)) cantor.add(cue.voice);
    for (const v of queen) expect(cantor.has(v)).toBe(false);
  });
});

describe('a janela de dano tem voz', () => {
  it('abrir soa em todos os chefes com blindagem; fechar so onde a sala fala', () => {
    const opens: EnemyArchetype[] = [
      'white_devourer',
      'archcantor',
      'furnace_heart',
      'frost_queen',
      'lung_matrix',
    ];
    for (const archetype of opens) {
      const cues = cuesForEvent({ t: 'boss_vulnerable', archetype, x: 1, y: 1, open: true }, ctx);
      expect(cues.length, `${archetype} abriu em silencio`).toBe(1);
      expect(VOICE_SPECS[cues[0].voice].priority).toBeGreaterThanOrEqual(9);
    }
    expect(
      cuesForEvent(
        { t: 'boss_vulnerable', archetype: 'frost_queen', x: 1, y: 1, open: false },
        ctx,
      ),
    ).toEqual([]);
    const [reheat] = cuesForEvent(
      { t: 'boss_vulnerable', archetype: 'furnace_heart', x: 1, y: 1, open: false },
      ctx,
    );
    expect(reheat.voice).toBe('furnaceReheat');
  });

  it('a Fornalha: a cunha soa no rumo dela, e as fases sao a sala rachando', () => {
    const [warn] = cuesForEvent(windup('furnace_heart', 'wave'), ctx);
    expect(warn.voice).toBe('furnaceWedgeWarn');
    expect(warn.x).toBeGreaterThan(10);
    expect(VOICE_SPECS.furnaceWedgeWarn.spatial).toBe(true);
    const crack = cuesForEvent(
      { t: 'boss_phase', archetype: 'furnace_heart', phase: BOSS_PHASE_OVERHEAT, x: 1, y: 1 },
      ctx,
    );
    expect(crack[0].voice).toBe('furnaceCrack');
    const unstable = cuesForEvent(
      { t: 'boss_phase', archetype: 'furnace_heart', phase: BOSS_PHASE_UNSTABLE, x: 1, y: 1 },
      ctx,
    );
    expect(unstable[0].voice).toBe('furnaceUnstable');
    expect(
      cuesForEvent({ t: 'stalactite', x: 3, y: 3, radius: 1.6, fireTick: 40 }, ctx)[0].voice,
    ).toBe('furnaceDebris');
    expect(cuesForEvent({ t: 'furnace_cooled', x: 3, y: 3, radius: 9 }, ctx)[0].voice).toBe(
      'furnaceCooling',
    );
  });

  it('o Pulmao: o ciclo respiratorio e legivel, e a expiracao acesa nao e a explosao comum', () => {
    const voiceOf = (state: 'hold' | 'exhale' | 'inhale' | 'wound'): string =>
      cuesForEvent({ t: 'boss_state', archetype: 'lung_matrix', state, x: 1, y: 1 }, ctx)[0].voice;
    expect(voiceOf('hold')).toBe('lungHold');
    expect(voiceOf('exhale')).toBe('lungExhale');
    expect(voiceOf('inhale')).toBe('lungClose');
    expect(voiceOf('wound')).toBe('lungWound');
    const [ignite] = cuesForEvent(
      { t: 'boss_vulnerable', archetype: 'lung_matrix', x: 1, y: 1, open: true },
      ctx,
    );
    expect(ignite.voice).toBe('lungIgnite');
    expect(ignite.voice).not.toBe('explosion');
  });
});

describe('Magnetarca: atracao e repulsao soam opostas, e sem olhar', () => {
  it('a polaridade e o rele mais a polaridade, globais', () => {
    const attract = cuesForEvent(
      { t: 'boss_state', archetype: 'magnetarch', state: 'attract', x: 1, y: 1 },
      ctx,
    );
    const repel = cuesForEvent(
      { t: 'boss_state', archetype: 'magnetarch', state: 'repel', x: 1, y: 1 },
      ctx,
    );
    expect(attract.map((c) => c.voice)).toEqual(['magnetarchFlip', 'magnetarchAttract']);
    expect(repel.map((c) => c.voice)).toEqual(['magnetarchFlip', 'magnetarchRepel']);
    for (const cue of [...attract, ...repel]) expect(VOICE_SPECS[cue.voice].spatial).toBe(false);
  });

  it('o esmagamento e o arco sao golpes distintos, e o arco nao e o do Leviata', () => {
    expect(cuesForEvent(attack('magnetarch', 'crush'), ctx)[0].voice).toBe('magnetarchCrush');
    expect(cuesForEvent(attack('magnetarch', 'tether'), ctx)[0].voice).toBe('magnetarchArc');
    expect(VOICE_RENDERERS.magnetarchArc).not.toBe(VOICE_RENDERERS.leviathanShockRelease);
  });
});

describe('Devorador e Guardiao: presenca', () => {
  it('o Devorador localiza o que nao se ve, e a ninhada e engolida', () => {
    const [burrow] = cuesForEvent(
      { t: 'boss_state', archetype: 'white_devourer', state: 'burrow', x: 7, y: 2 },
      ctx,
    );
    expect(burrow.voice).toBe('devourerBurrow');
    expect(VOICE_SPECS.devourerBurrow.spatial).toBe(true);
    expect(VOICE_SPECS.devourerBurrow.priority).toBeGreaterThanOrEqual(7);
    const brood = cuesForEvent(
      {
        t: 'death',
        x: 0,
        y: 0,
        entity: 5,
        archetype: 'devourer_brood',
        facingX: 1,
        facingY: 0,
        tick: 1,
      },
      ctx,
    );
    expect(brood[0].voice).toBe('devourerBroodSwallowed');
    const open = cuesForEvent(
      { t: 'boss_state', archetype: 'white_devourer', state: 'maw_open', x: 1, y: 1 },
      ctx,
    );
    const close = cuesForEvent(
      { t: 'boss_state', archetype: 'white_devourer', state: 'maw_close', x: 1, y: 1 },
      ctx,
    );
    expect(open[0].voice).toBe('devourerMawOpen');
    expect(close[0].voice).toBe('devourerMawClose');
  });

  it('o Guardiao desloca massa: passo, lasca e rangido sao textura; o golpe nao', () => {
    const voiceOf = (state: 'step' | 'chip' | 'strain'): keyof typeof VOICE_SPECS =>
      cuesForEvent({ t: 'boss_state', archetype: 'guardian', state, x: 1, y: 1 }, ctx)[0].voice;
    for (const state of ['step', 'chip', 'strain'] as const) {
      expect(VOICE_SPECS[voiceOf(state)].priority).toBeLessThanOrEqual(4);
    }
    expect(VOICE_SPECS[cuesForEvent(attack('guardian', 'slam'), ctx)[0].voice].priority).toBe(9);
    // A morte dos chefes sem voz propria continua sendo o fim de ato.
    const death = cuesForEvent(
      {
        t: 'death',
        x: 0,
        y: 0,
        entity: 5,
        archetype: 'sheet_leviathan',
        facingX: 1,
        facingY: 0,
        tick: 1,
      },
      ctx,
    );
    expect(death[0].voice).toBe('deathGuardian');
  });
});

describe('o catalogo dos chefes e coerente', () => {
  it('toda voz de chefe tem receita, e nenhuma vocalizacao vence um windup', () => {
    const bossPrefixes = [
      'guardian',
      'bishopNova',
      'diamandis',
      'devourer',
      'archcantor',
      'leviathan',
      'lung',
      'furnace',
      'frostQueen',
      'magnetarch',
    ];
    const ids = Object.keys(VOICE_SPECS).filter((id) => bossPrefixes.some((p) => id.startsWith(p)));
    expect(ids.length).toBeGreaterThanOrEqual(30);
    for (const id of ids) expect(VOICE_RENDERERS[id], `${id} sem receita`).toBeTypeOf('function');
    const windups = [
      'guardianCompress',
      'devourerEmergeWarning',
      'leviathanShockCharge',
      'frostQueenFreezeCharge',
    ];
    const voices = [
      'leviathanCall',
      'archcantorNote',
      'diamandisVoiceSurvey',
      'guardianStep',
      'lungWound',
    ];
    for (const w of windups) {
      for (const v of voices) {
        expect(VOICE_SPECS[w as keyof typeof VOICE_SPECS].priority).toBeGreaterThan(
          VOICE_SPECS[v as keyof typeof VOICE_SPECS].priority,
        );
      }
    }
  });
});
