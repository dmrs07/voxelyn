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

const head = (g: { path: ReadonlyArray<{ dx: number; dy: number }> }) => g.path[g.path.length - 1];
const tail = (g: { path: ReadonlyArray<{ dx: number; dy: number }> }) => g.path[0];
const radius = (p: { dx: number; dy: number }): number => Math.hypot(p.dx, p.dy);

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
        for (const point of mawStreak(i, s, reach).path) {
          expect(radius(point)).toBeLessThanOrEqual(reach + 0.001);
          expect(radius(point)).toBeGreaterThanOrEqual(DEVOURER_MAW_BITE_RADIUS - 0.001);
        }
      }
    }
  });

  it('o rastro segue a ESPIRAL, e nao a corda entre as pontas', () => {
    // O defeito que a primeira captura revelou: com duas pontas ligadas em
    // reta, o risco cortava o disco de lado a lado e lia como estilhaco. O
    // rastro tem de ser curto o bastante para o meio dele nao desabar para
    // dentro da curva.
    const g = mawStreak(5, 0.5, reach);
    expect(g.path.length).toBeGreaterThan(2);
    const first = g.path[0];
    const last = g.path[g.path.length - 1];
    const chord = Math.hypot(last.dx - first.dx, last.dy - first.dy);
    expect(chord, 'o rastro atravessa o disco').toBeLessThan(reach * 0.35);
  });

  it('no primeiro segundo eles ficam DENTRO do alcance, e ainda caem para dentro', () => {
    // Regressao de um defeito de leitura. O caminho do grao interpolava de
    // `reach` (na borda) ate DEVOURER_MAW_BITE_RADIUS (na garganta) — e durante
    // o primeiro segundo da janela o alcance ainda e MENOR que a garganta, que
    // so passa a existir quando ele a alcanca. Com os dois invertidos, os graos
    // nasciam pequenos e voavam para FORA, ate um raio fixo que a simulacao
    // ainda nao tocava: o telegrafo de abertura desenhava o sentido errado, em
    // cima de chao que nao estava sendo puxado.
    for (const reach of [0.2, 0.9, DEVOURER_MAW_BITE_RADIUS * 0.99]) {
      for (let i = 0; i < MAW_STREAKS; i++) {
        for (let s = 0; s < 1.2; s += 0.05) {
          const g = mawStreak(i, s, reach);
          for (const point of g.path) {
            expect(radius(point), `alcance ${reach}: grao fora do disco`).toBeLessThanOrEqual(
              reach + 0.001
            );
          }
          if (g.alpha <= 0.01) continue;
          expect(radius(tail(g)), `alcance ${reach}: grao ${i} subiu`).toBeGreaterThan(
            radius(head(g)) - 0.001
          );
        }
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
        if (g.alpha <= 0.01) continue;
        expect(radius(tail(g)), `grao ${i} subiu em vez de cair`).toBeGreaterThan(
          radius(head(g)) - 0.001
        );
      }
    }
  });

  it('SUGA em vez de orbitar: cada passo anda mais para dentro que para o lado', () => {
    // O relato de playtest que originou esta regra: "parece que nao suga nada,
    // sao particulas circulando". Era medivel — o caminho fixava VOLTAS (duas),
    // e no raio medio isso dava mais de 50 tiles de percurso tangencial contra 6
    // de radial. Entre 89% e 96% de cada passo era orbita.
    //
    // O caminho agora e uma espiral de PASSO constante abaixo de 45 graus, entao
    // a componente radial vence a tangencial em todo raio. E o invariante que
    // separa "sugando" de "girando", e ele nao pode voltar a quebrar.
    for (let i = 0; i < MAW_STREAKS; i++) {
      for (let s = 0; s < 2; s += 0.03) {
        const g = mawStreak(i, s, DEVOURER_MAW_RADIUS);
        if (g.alpha <= 0.01) continue;
        for (let k = 1; k < g.path.length; k++) {
          const a = g.path[k - 1];
          const b = g.path[k];
          const step = Math.hypot(b.dx - a.dx, b.dy - a.dy);
          if (step < 1e-6) continue;
          // O quanto o passo encurtou o raio, contra o comprimento total dele.
          const inward = radius(a) - radius(b);
          expect(
            inward / step,
            `grao ${i}: passo ${(100 * (inward / step)).toFixed(0)}% radial — orbitando`
          ).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it('ACELERA para dentro: o passo perto da garganta e maior que o da borda', () => {
    // Conservacao de fluxo: `r * v_r` constante, entao `r^2` cai linear e a
    // velocidade radial cresce para dentro. E o que faz o risco esticar conforme
    // desce — a areia nao so vai para o centro, ela vai cada vez mais rapido.
    const rim = mawStreak(0, 0.06, DEVOURER_MAW_RADIUS);
    const throat = mawStreak(0, MAW_FALL_SECONDS * 0.94, DEVOURER_MAW_RADIUS);
    const len = (g: { path: ReadonlyArray<{ dx: number; dy: number }> }) =>
      Math.hypot(g.path[0].dx - head(g).dx, g.path[0].dy - head(g).dy);
    expect(radius(head(throat))).toBeLessThan(radius(head(rim)));
    expect(len(throat), 'o rastro nao esticou na descida').toBeGreaterThan(len(rim) * 1.5);
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
    expect(radius(head(early))).toBeLessThan(radius(head(late)));
  });
});
