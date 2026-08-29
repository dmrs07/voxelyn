// O AUDIO DA MINIGUN, conferido pelo que ele NAO pode fazer.
//
// A arma dispara dezesseis vezes por segundo. O jogo tem dezesseis vozes. Se
// essas duas frases se encontrarem sem uma politica no meio, o resultado e
// conhecido: uma rajada come o barramento inteiro, todo telegrafo de inimigo
// desaparece durante ela, e o jogo passa a matar por algo que nao deu para
// ouvir — o unico invariante de combate que este projeto nao quebra.
//
// Os testes abaixo sao essa politica, escrita como asserçao.

import { describe, expect, it } from 'vitest';
import { MINIGUN_BURST_EVENT_TICKS, MINIGUN_SPIN_MAX, TICK_HZ } from '@voxelyn/survival-sim';
import type { SemanticEvent } from '@voxelyn/survival-sim';
import { cuesForEvent, cuesForEvents } from './cues';
import { CueMixer } from './mixer';
import { VOICE_RENDERERS } from './synth';
import { MAX_VOICES, VOICE_SPECS, type VoiceId } from './voices';

const ctx = { worldWidth: 96, localPlayerId: 1 };
const listener = { x: 5, y: 5 };

const burstEvent = (rounds = 3): SemanticEvent => ({
  t: 'minigun_burst',
  slot: 0,
  x: 5,
  y: 5,
  dx: 1,
  dy: 0,
  rounds,
  spin: MINIGUN_SPIN_MAX,
});

const spinEvent = (
  phase: 'spinning_up' | 'firing' | 'spinning_down' | 'overheated' | 'idle',
): SemanticEvent => ({
  t: 'minigun_spin',
  slot: 0,
  x: 5,
  y: 5,
  phase,
  spin: MINIGUN_SPIN_MAX,
});

const MINIGUN_VOICES: VoiceId[] = [
  'minigunSpinStart',
  'minigunSpinStop',
  'minigunBurst',
  'minigunCasing',
];

describe('catalogo', () => {
  it('toda voz do canhao tem politica E timbre', () => {
    for (const voice of MINIGUN_VOICES) {
      expect(VOICE_SPECS[voice], `${voice} sem politica`).toBeDefined();
      expect(VOICE_RENDERERS[voice], `${voice} sem receita`).toBeTypeOf('function');
    }
  });

  it('NAO existe uma voz por bala', () => {
    // A ausencia e a decisao. Um `minigunShot` no catalogo seria a porta de
    // entrada para dezesseis vozes por segundo.
    expect(VOICE_SPECS['minigunShot' as VoiceId]).toBeUndefined();
  });

  it('a rajada nunca tem prioridade de telegrafo', () => {
    // Telegrafos vivem em 9-10. A arma mais forte do jogo nao pode competir
    // com o aviso que impede uma morte injusta.
    expect(VOICE_SPECS.minigunBurst.priority).toBeLessThan(9);
    expect(VOICE_SPECS.minigunSpinStart.priority).toBeLessThan(9);
  });

  it('a capsula e a primeira coisa a sumir quando o orcamento aperta', () => {
    const casing = VOICE_SPECS.minigunCasing.priority;
    expect(casing).toBeLessThan(VOICE_SPECS.minigunBurst.priority);
    expect(casing).toBeLessThan(VOICE_SPECS.shot.priority);
    for (const telegraph of ['telegraphCharge', 'telegraphHurl', 'telegraphRanged'] as const) {
      expect(casing).toBeLessThan(VOICE_SPECS[telegraph].priority);
    }
  });

  it('as travas limitam a densidade das duas vozes de textura', () => {
    // A janela do evento e de 200 ms; a trava passa uma por janela e nunca
    // duas. A capsula e travada mais folgadamente ainda.
    const windowMs = (MINIGUN_BURST_EVENT_TICKS / TICK_HZ) * 1000;
    expect(VOICE_SPECS.minigunBurst.minIntervalMs).toBeLessThan(windowMs);
    expect(VOICE_SPECS.minigunBurst.minIntervalMs).toBeGreaterThan(windowMs / 2);
    expect(VOICE_SPECS.minigunCasing.minIntervalMs).toBeGreaterThanOrEqual(100);
  });

  it('giro e rajada sao espaciais: o parceiro remoto tem de ser localizavel', () => {
    for (const voice of MINIGUN_VOICES) {
      expect(VOICE_SPECS[voice].spatial, `${voice} nao e espacial`).toBe(true);
    }
  });
});

describe('traducao de evento', () => {
  it('a rajada pede a saraivada e o latao, nunca uma voz por bala', () => {
    const cues = cuesForEvent(burstEvent(8), ctx);
    expect(cues.map((cue) => cue.voice)).toEqual(['minigunBurst', 'minigunCasing']);
  });

  it('a densidade da janela sobe o ganho, com teto', () => {
    const light = cuesForEvent(burstEvent(1), ctx)[0];
    const heavy = cuesForEvent(burstEvent(8), ctx)[0];
    expect(heavy.scale).toBeGreaterThan(light.scale);
    expect(cuesForEvent(burstEvent(80), ctx)[0].scale).toBeLessThanOrEqual(1.2);
  });

  it('so o arranque e a parada soam; firing e overheated ficam mudos', () => {
    expect(cuesForEvent(spinEvent('spinning_up'), ctx).map((c) => c.voice)).toEqual([
      'minigunSpinStart',
    ]);
    expect(cuesForEvent(spinEvent('spinning_down'), ctx).map((c) => c.voice)).toEqual([
      'minigunSpinStop',
    ]);
    // `firing` nao soa: quem anuncia que a arma cuspiu e a propria rajada.
    expect(cuesForEvent(spinEvent('firing'), ctx)).toHaveLength(0);
    // `overheated` nao soa: o evento `overheat` ja toca o alarme no mesmo tick.
    expect(cuesForEvent(spinEvent('overheated'), ctx)).toHaveLength(0);
    expect(cuesForEvent(spinEvent('idle'), ctx)).toHaveLength(0);
  });
});

describe('orcamento: a rajada nao pode calar o resto do jogo', () => {
  it('um segundo de rajada cheia gera cinco vozes, e nao dezesseis', () => {
    const mixer = new CueMixer();
    const windowMs = (MINIGUN_BURST_EVENT_TICKS / TICK_HZ) * 1000;
    let bursts = 0;
    for (let ms = 0; ms < 1000; ms += windowMs) {
      const planned = mixer.plan(cuesForEvent(burstEvent(4), ctx), listener, ms);
      bursts += planned.filter((v) => v.voice === 'minigunBurst').length;
    }
    expect(bursts).toBe(Math.round(1000 / windowMs));
    expect(bursts).toBeLessThan(TICK_HZ);
  });

  it('a saraivada nunca ocupa mais de uma vaga por quadro', () => {
    const mixer = new CueMixer();
    // Duas rajadas colidindo no mesmo quadro (dois jogadores com Minigun):
    // a trava por voz garante que soe UMA.
    const planned = mixer.plan(cuesForEvents([burstEvent(4), burstEvent(4)], ctx), listener, 0);
    expect(planned.filter((v) => v.voice === 'minigunBurst')).toHaveLength(1);
  });

  it('o telegrafo sobrevive a uma tela cheia de rajada e latao', () => {
    const mixer = new CueMixer();
    const flood: SemanticEvent[] = [];
    for (let i = 0; i < 40; i++) flood.push(burstEvent(6));
    flood.push({
      t: 'action_start',
      entity: 9,
      action: 'hurl',
      x: 6,
      y: 6,
      dx: 1,
      dy: 0,
      startTick: 0,
      releaseTick: 16,
      endTick: 30,
    });
    const planned = mixer.plan(cuesForEvents(flood, ctx), listener, 0);
    expect(planned.length).toBeLessThanOrEqual(MAX_VOICES);
    expect(planned.some((v) => v.voice === 'telegraphHurl')).toBe(true);
  });

  it('sob orcamento cheio, a capsula e a primeira a ficar de fora', () => {
    const mixer = new CueMixer();
    // O teto do mixer e por VOZ DISTINTA — a trava anti-repeticao ja colapsa
    // duplicatas antes dele —, entao encher o orcamento exige dezesseis vozes
    // diferentes. Todas espaciais e a um passo do ouvinte, para nenhuma cair
    // por distancia.
    const fillers = (Object.keys(VOICE_SPECS) as VoiceId[])
      .filter((id) => VOICE_SPECS[id].spatial && VOICE_SPECS[id].priority > 1)
      .slice(0, MAX_VOICES);
    expect(fillers.length).toBe(MAX_VOICES);
    const cues = [
      ...fillers.map((voice) => ({ voice, x: listener.x, y: listener.y, scale: 1 })),
      ...cuesForEvent(burstEvent(6), ctx),
    ];
    const planned = mixer.plan(cues, listener, 0);
    expect(planned).toHaveLength(MAX_VOICES);
    // A capsula tem prioridade 1: ela e a que perde a vaga, e nao o telegrafo.
    expect(planned.some((v) => v.voice === 'minigunCasing')).toBe(false);
  });

  it('nenhuma voz do canhao e audivel do outro lado do mapa', () => {
    const mixer = new CueMixer();
    const planned = mixer.plan(cuesForEvent(burstEvent(6), ctx), { x: 200, y: 200 }, 0);
    expect(planned).toHaveLength(0);
  });
});
