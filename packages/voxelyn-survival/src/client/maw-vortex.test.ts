// O vortice da boca e desenho, mas ele PROMETE coisas — e sao as promessas que
// estes testes guardam. Um anel que diga um raio diferente do raio que agarra, ou
// uma espiral que gire para fora, ensinam o jogador errado sobre o unico golpe
// do encontro que so se resolve com posicao.
import { describe, expect, it } from 'vitest';
import {
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_RADIUS,
  PLAYER_SPEED,
  mawPull,
} from '@voxelyn/survival-sim';
import { MAW_FALL_SECONDS, MAW_NO_RETURN_RADIUS, MAW_STREAKS, mawStreak } from './maw-vortex';

const radius = (g: { dx: number; dy: number }): number => Math.hypot(g.dx, g.dy);

describe('vortice da boca — a linha do sem-volta', () => {
  it('e onde a sucao iguala a caminhada, derivada e nao copiada', () => {
    // Um tick logo depois de a boca abrir de todo, com o alcance cheio.
    const open = 0;
    const tick = 1000;
    const inside = mawPull(MAW_NO_RETURN_RADIUS - 0.15, tick, open, false);
    const outside = mawPull(MAW_NO_RETURN_RADIUS + 0.15, tick, open, false);
    expect(inside, 'dentro da linha andar ainda bastava').toBeGreaterThan(PLAYER_SPEED);
    expect(outside, 'fora da linha andar ja nao bastava').toBeLessThan(PLAYER_SPEED);
  });

  it('cai dentro do disco, e nao colada em nenhuma das bordas', () => {
    // Um anel colado na garganta ou na borda nao seria uma informacao — seria
    // uma segunda linha desenhada em cima de uma que ja existe.
    expect(MAW_NO_RETURN_RADIUS).toBeGreaterThan(DEVOURER_MAW_BITE_RADIUS + 0.5);
    expect(MAW_NO_RETURN_RADIUS).toBeLessThan(DEVOURER_MAW_RADIUS - 1);
  });

  it('sobre VIDRO ela nao existe: a caminhada vence em qualquer ponto', () => {
    for (let d = DEVOURER_MAW_BITE_RADIUS; d <= DEVOURER_MAW_RADIUS; d += 0.1) {
      expect(mawPull(d, 1000, 0, true), `a ${d.toFixed(1)} o vidro nao bastou`).toBeLessThan(
        PLAYER_SPEED
      );
    }
  });
});

describe('vortice da boca — os graos', () => {
  const reach = DEVOURER_MAW_RADIUS;

  it('nunca saem do disco nem entram na garganta', () => {
    for (let i = 0; i < MAW_STREAKS; i++) {
      for (let s = 0; s < 3; s += 0.037) {
        const g = mawStreak(i, s, reach);
        expect(radius(g)).toBeLessThanOrEqual(reach + 0.001);
        expect(radius(g)).toBeGreaterThanOrEqual(DEVOURER_MAW_BITE_RADIUS - 0.001);
      }
    }
  });

  it('caem PARA DENTRO: a cauda esta sempre mais longe que a cabeca', () => {
    // O sentido e a unica coisa que o efeito precisa dizer sem ambiguidade. Um
    // grao cuja cauda ficasse mais perto do centro desenharia materia SAINDO da
    // boca, que e o oposto exato do que a simulacao esta fazendo.
    for (let i = 0; i < MAW_STREAKS; i++) {
      // O meio da queda, longe das pontas onde o serrilhado do laco reinicia.
      for (let s = 0.2; s < MAW_FALL_SECONDS * 0.8; s += 0.05) {
        const g = mawStreak(i, s, reach);
        const head = radius(g);
        const tail = Math.hypot(g.tailDx, g.tailDy);
        if (g.alpha <= 0.01) continue;
        expect(tail, `grao ${i} subiu em vez de cair`).toBeGreaterThan(head - 0.001);
      }
    }
  });

  it('nascem e morrem transparentes: nada pisca no chao', () => {
    for (let i = 0; i < MAW_STREAKS; i++) {
      const born = mawStreak(i, (i / MAW_STREAKS) * -MAW_FALL_SECONDS, reach);
      expect(born.alpha).toBeLessThan(0.05);
    }
  });

  it('sao deterministicos: dois clientes da sala desenham o mesmo vortice', () => {
    const a = mawStreak(7, 1.234, reach);
    const b = mawStreak(7, 1.234, reach);
    expect(a).toEqual(b);
  });

  it('encolhem com o alcance: no comeco da janela o vortice e pequeno', () => {
    const early = mawStreak(3, 0.4, DEVOURER_MAW_RADIUS * 0.25);
    const late = mawStreak(3, 0.4, DEVOURER_MAW_RADIUS);
    expect(radius(early)).toBeLessThan(radius(late));
  });
});
