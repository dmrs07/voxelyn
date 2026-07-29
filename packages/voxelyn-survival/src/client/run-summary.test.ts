import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '@voxelyn/survival-sim';
import type { DamageCause, RunSummary } from '@voxelyn/survival-sim';
import {
  describeCause,
  describeOutcome,
  formatDuration,
  formatSeed,
  nextStarHint,
  parseSeed,
  summaryLines,
} from './run-summary';

const base: RunSummary = {
  seed: 0xdeadbeef,
  phase: 'dead',
  ticks: 3 * 60 * TICK_HZ + 7 * TICK_HZ,
  contamination: 0.42,
  deathCause: { kind: 'fire' },
  stats: {
    shotsFired: 20,
    kills: { stalker: 2, bruiser: 1, spitter: 0, bomber: 0, guardian: 0, bishop: 0, fungal_horse: 0, miner: 0 },
    damageTakenTenths: 875,
    damageDealtTenths: 4000,
    solidsDestroyed: 12,
    salvageCompleted: 2,
    modulesAcquired: 2,
    purgeCellsUsed: 1,
    timesDowned: 0,
    revivesGiven: 0,
    oreCollected: 0,
    innocentsKilled: 0,
    discoveries: 0,
  },
  stars: 0,
  targetTicks: 8 * 60 * TICK_HZ,
};

describe('causa de morte legivel', () => {
  // A razao de o sistema existir: estas tres mortes eram a MESMA frase antes.
  it('distingue as tres mortes que antes eram identicas', () => {
    const gas = describeCause({ kind: 'gas' });
    const propria = describeCause({ kind: 'explosion', source: 'player' });
    const bruiser = describeCause({ kind: 'enemy_contact', archetype: 'bruiser', elite: false });
    const titulos = new Set([gas.headline, propria.headline, bruiser.headline]);
    expect(titulos.size).toBe(3);
  });

  it('separa a propria explosao da explosao alheia', () => {
    expect(describeCause({ kind: 'explosion', source: 'player' }).headline).not.toBe(
      describeCause({ kind: 'explosion', source: 'enemy' }).headline,
    );
    expect(describeCause({ kind: 'discharge', source: 'player' }).headline).not.toBe(
      describeCause({ kind: 'discharge', source: 'environment' }).headline,
    );
  });

  it('nomeia a criatura e marca a mutacao', () => {
    const comum = describeCause({ kind: 'enemy_contact', archetype: 'stalker', elite: false });
    const elite = describeCause({ kind: 'enemy_contact', archetype: 'stalker', elite: true });
    expect(comum.headline).toContain('Espreitador');
    expect(elite.headline).toContain('mutado');
  });

  // Pedra e cuspe pedem reacoes opostas — quebrar linha de visao contra sair da
  // poca —, entao a licao nao pode ser a mesma.
  it('da licoes diferentes para pedra e cuspe', () => {
    const pedra = describeCause({
      kind: 'enemy_projectile',
      archetype: 'bruiser',
      elite: false,
      projectile: 'rock',
    });
    const cuspe = describeCause({
      kind: 'enemy_projectile',
      archetype: 'spitter',
      elite: false,
      projectile: 'spit',
    });
    expect(pedra.lesson).not.toBe(cuspe.lesson);
  });

  it('toda causa de morte tem licao, menos as que nao ensinam nada', () => {
    const causas: DamageCause[] = [
      { kind: 'enemy_contact', archetype: 'stalker', elite: false },
      { kind: 'enemy_projectile', archetype: 'spitter', elite: false, projectile: 'spit' },
      { kind: 'fire' },
      { kind: 'gas' },
      { kind: 'spores' },
      { kind: 'discharge', source: 'player' },
      { kind: 'explosion', source: 'enemy' },
      { kind: 'overheat' },
      { kind: 'bleedout' },
    ];
    for (const cause of causas) {
      expect(describeCause(cause).lesson, `${cause.kind} sem licao`).not.toBe('');
    }
    // 'unknown' nao inventa licao: e melhor calar do que ensinar errado.
    expect(describeCause({ kind: 'unknown' }).lesson).toBe('');
  });

  it('extracao nao vira morte', () => {
    expect(describeCause(null).headline).not.toContain('consumiu');
  });
});

describe('formatacao', () => {
  it('mostra o tempo em m:ss com zero a esquerda', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7 * TICK_HZ)).toBe('0:07');
    expect(formatDuration(67 * TICK_HZ)).toBe('1:07');
    expect(formatDuration(600 * TICK_HZ)).toBe('10:00');
  });

  it('imprime a seed em hex de 8 digitos', () => {
    expect(formatSeed(0xdeadbeef)).toBe('0xDEADBEEF');
    expect(formatSeed(1)).toBe('0x00000001');
  });

  // Ida e volta: o que a tela de fim imprime tem de poder ser colado no menu.
  it('le de volta a seed que imprimiu', () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, 0xffffffff]) {
      expect(parseSeed(formatSeed(seed))).toBe(seed >>> 0);
    }
  });

  it('aceita hex sem prefixo e decimal, e recusa lixo', () => {
    expect(parseSeed('123')).toBe(123);
    expect(parseSeed('0xff')).toBe(255);
    expect(parseSeed('  42  ')).toBe(42);
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('nao e seed')).toBeNull();
    expect(parseSeed('-5')).toBeNull();
  });
});

describe('linhas do sumario', () => {
  it('converte decimos em numero inteiro legivel', () => {
    const lines = summaryLines(base);
    expect(lines.find((l) => l.label === 'Dano sofrido')?.value).toBe('88');
    expect(lines.find((l) => l.label === 'Dano causado')?.value).toBe('400');
  });

  it('soma os abates de todos os arquetipos', () => {
    expect(summaryLines(base).find((l) => l.label === 'Abates')?.value).toBe('3');
  });

  it('nao divide por zero quando nenhum tiro saiu', () => {
    const sem = { ...base, stats: { ...base.stats, shotsFired: 0 } };
    expect(summaryLines(sem).find((l) => l.label === 'Dano/tiro')?.value).toBe('—');
  });
});

describe('proxima estrela', () => {
  // Nota sem criterio visivel e ruido: quem tira duas precisa saber que a
  // terceira e a MESMA run com pressa, e nao um objetivo escondido.
  it('diz o que falta em cada degrau', () => {
    expect(nextStarHint({ ...base, phase: 'dead', stars: 0 })).toContain('extração');
    expect(nextStarHint({ ...base, phase: 'extracted', stars: 1 })).toContain('núcleo');
    const lento = {
      ...base,
      phase: 'extracted_with_core' as const,
      stars: 2 as const,
      ticks: base.targetTicks + 60 * TICK_HZ,
    };
    expect(nextStarHint(lento)).toContain('1:00');
  });

  it('cala quando nao ha mais estrela a conquistar', () => {
    expect(nextStarHint({ ...base, phase: 'extracted_with_core', stars: 3 })).toBeNull();
  });
});

describe('titulo do resultado', () => {
  it('usa cor e texto distintos para cada desfecho', () => {
    const desfechos = (['dead', 'extracted', 'extracted_with_core'] as const).map((phase) =>
      describeOutcome({ ...base, phase }),
    );
    expect(new Set(desfechos.map((d) => d.title)).size).toBe(3);
    expect(new Set(desfechos.map((d) => d.color)).size).toBe(3);
  });
});
