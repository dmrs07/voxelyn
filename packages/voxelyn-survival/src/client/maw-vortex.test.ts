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
import {
  MAW_CLOUDS,
  MAW_CLOUD_DRAG,
  MAW_FALL_SECONDS,
  MAW_NO_RETURN_RADIUS,
  MAW_STREAKS,
  MAW_TORUS_RISE,
  MAW_TORUS_TUBE,
  mawCloud,
  mawInnerRadius,
  mawStreak,
} from './maw-vortex';

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

  it('com MENOS graos, eles continuam espalhados pelo caminho inteiro', () => {
    // O preset de qualidade reduz a contagem, e a contagem reduzida tem de
    // entrar em `mawStreak` como `count` — e ela que espalha as fases. Desenhar
    // um subconjunto dos indices mantendo o total alto amontoaria os
    // sobreviventes no mesmo trecho da espiral: um pelotao, e nao um fluxo.
    const few = 29; // o que sobra na qualidade baixa
    const radii = [];
    for (let i = 0; i < few; i++) radii.push(radius(head(mawStreak(i, 0.31, reach, few))));
    const lo = Math.min(...radii);
    const hi = Math.max(...radii);
    // Os graos tem de cobrir quase todo o vao entre a garganta e a borda.
    expect(hi - lo, 'os graos ficaram amontoados num anel so').toBeGreaterThan(
      (reach - DEVOURER_MAW_BITE_RADIUS) * 0.8
    );
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

describe('vortice da boca — a poeira', () => {
  const reach = DEVOURER_MAW_RADIUS;

  it('anda pelo MESMO caminho dos graos, e nunca sai do disco', () => {
    // A nuvem e a mesma materia que os riscos, indo para o mesmo lugar. Se ela
    // seguisse um caminho paralelo, a primeira mudanca de passo ou de lei do
    // raio separaria os dois — e a poeira que deveria ser aquela areia iria
    // para outro lado.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      for (let s = 0; s < 6; s += 0.07) {
        const c = mawCloud(i, s, reach);
        const r = Math.hypot(c.dx, c.dy);
        expect(r).toBeLessThanOrEqual(reach + 0.001);
        expect(r).toBeGreaterThanOrEqual(DEVOURER_MAW_BITE_RADIUS - 0.001);
      }
    }
  });

  it('desce mais DEVAGAR que o grao: sao duas camadas, nao uma', () => {
    // Duas coisas na mesma velocidade pelo mesmo caminho viram uma so, e a
    // nuvem deixaria de ser segundo plano para virar um risco gordo.
    const travel = (sample: (s: number) => number) => {
      let sum = 0;
      for (let s = 0.05; s < 0.55; s += 0.05) sum += Math.abs(sample(s) - sample(s - 0.05));
      return sum;
    };
    const grainR = (s: number) => {
      const g = mawStreak(0, s, reach);
      const h = g.path[g.path.length - 1];
      return Math.hypot(h.dx, h.dy);
    };
    const cloudR = (s: number) => {
      const c = mawCloud(0, s, reach);
      return Math.hypot(c.dx, c.dy);
    };
    expect(travel(cloudR), 'a poeira acompanha o grao').toBeLessThan(travel(grainR));
  });

  it('ENCOLHE ao descer: a garganta comprime a nuvem', () => {
    // Uma mancha que chegasse do mesmo tamanho no centro pareceria flutuar por
    // cima do buraco em vez de entrar nele.
    const early = mawCloud(0, 0.2, reach);
    const late = mawCloud(0, MAW_FALL_SECONDS * 2.2, reach);
    expect(late.radius).toBeLessThan(early.radius);
    expect(late.radius).toBeGreaterThan(0);
  });

  it('encolhe com o ALCANCE: no comeco da janela a poeira e pequena', () => {
    // Raio fixo faria a nuvem ser maior que o proprio vortice enquanto a boca
    // ainda esta abrindo.
    const small = mawCloud(2, 0.3, DEVOURER_MAW_RADIUS * 0.2);
    const full = mawCloud(2, 0.3, DEVOURER_MAW_RADIUS);
    expect(small.radius).toBeLessThan(full.radius);
  });

  it('sao deterministicas, como os graos', () => {
    expect(mawCloud(5, 1.7, reach)).toEqual(mawCloud(5, 1.7, reach));
  });

  it('espalham sozinhas, sem precisar saber quantas sao', () => {
    // Os graos precisam receber a contagem (e ela que faz `i / contagem`
    // espalhar as fases); a poeira nao, porque o deslocamento por indice e uma
    // sequencia de baixa discrepancia. Isso importa na pratica: a contagem muda
    // com o preset de qualidade, e um efeito que dependa dela para se espalhar
    // amontoa quando o preset cai.
    for (const many of [4, 9, MAW_CLOUDS]) {
      const radii = [];
      for (let i = 0; i < many; i++) radii.push(Math.hypot(mawCloud(i, 0.4, reach).dx, mawCloud(i, 0.4, reach).dy));
      const spread = Math.max(...radii) - Math.min(...radii);
      expect(spread, `com ${many} nuvens elas se amontoaram`).toBeGreaterThan(reach * 0.3);
    }
  });
});

describe('vortice da boca — o rolo do toro', () => {
  const reach = DEVOURER_MAW_RADIUS;
  /** Uma travessia inteira de uma nuvem, amostrada fino. */
  const sweep = (i: number) => {
    const out = [];
    for (let s = 0; s < MAW_FALL_SECONDS * MAW_CLOUD_DRAG; s += 0.02) out.push(mawCloud(i, s, reach));
    return out;
  };

  it('a poeira ROLA: ela chega a andar para FORA, e uma espiral nunca faz isso', () => {
    // O invariante que separa um toro de uma espiral, e o relato que o pediu:
    // "as nuvens deviam se comportar como um vortice toroidal, nao
    // circunferencias". Numa espiral o raio so cai; num anel que rola sobre si
    // mesmo ele sobe e desce enquanto o anel inteiro encolhe.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      const r = sweep(i).map((c) => Math.hypot(c.dx, c.dy));
      let outward = 0;
      for (let k = 1; k < r.length; k++) if (r[k] > r[k - 1] + 1e-6) outward++;
      expect(outward, `nuvem ${i} nunca saiu para fora: ainda e espiral`).toBeGreaterThan(0);
    }
  });

  it('mas o SALDO e para dentro: o rolo nao substitui a succao', () => {
    // O rolo acrescenta uma segunda volta POR CIMA da sucao; nao a troca por
    // uma. Medir as pontas nao serve — a varredura cobre um ciclo inteiro e a
    // fase de partida de cada nuvem e outra, entao o primeiro e o ultimo ponto
    // caem quase no mesmo lugar do caminho. O que da para afirmar sem depender
    // de fase e o SALDO: numa espiral pura todo passo entra, num toro alguns
    // saem, e num toro que alimenta um sumidouro a maioria larga entra.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      const r = sweep(i).map((c) => Math.hypot(c.dx, c.dy));
      let inward = 0;
      let outward = 0;
      for (let k = 1; k < r.length; k++) {
        // O salto do renascimento (garganta -> borda) nao e movimento: e a
        // nuvem seguinte comecando.
        if (Math.abs(r[k] - r[k - 1]) > reach * 0.3) continue;
        if (r[k] < r[k - 1]) inward++;
        else outward++;
      }
      expect(inward, `nuvem ${i}: ${outward} passos para fora contra ${inward}`).toBeGreaterThan(
        outward * 1.5
      );
    }
  });

  it('atravessa o disco INTEIRO: nasce na borda e acaba na garganta', () => {
    // A outra metade da mesma promessa, e a que o saldo sozinho nao daria: uma
    // poeira que rolasse para dentro sem nunca chegar la desenharia um anel
    // parado no meio do disco.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      const r = sweep(i).map((c) => Math.hypot(c.dx, c.dy));
      expect(Math.max(...r), `nuvem ${i} nunca chegou perto da borda`).toBeGreaterThan(reach * 0.85);
      expect(Math.min(...r), `nuvem ${i} nunca chegou a garganta`).toBeLessThan(
        mawInnerRadius(reach) * 1.15
      );
    }
  });

  it('sobe e volta ao chao: ha crista e ha vale', () => {
    // Sem as duas metades nao ha rolo — ha uma nuvem flutuando a altura fixa,
    // que le como um segundo disco de particulas e nao como volume.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      const lifts = sweep(i).map((c) => c.liftTiles);
      expect(Math.max(...lifts), `nuvem ${i} nunca subiu`).toBeGreaterThan(0.1);
      expect(Math.min(...lifts), `nuvem ${i} nunca voltou ao chao`).toBeLessThan(0.02);
    }
  });

  it('nunca cobre a GARGANTA, por mais fundo que o vale va', () => {
    // A unica coisa deste efeito que o jogador nao pode ler errado. Um toro
    // honesto mandaria a poeira para dentro do buraco no vale do rolo, e e para
    // la que ela iria de verdade — mas ali a boca mata na hora, e trocar essa
    // leitura por um detalhe de movimento seria trocar a vida do jogador por
    // realismo.
    for (let i = 0; i < MAW_CLOUDS; i++) {
      for (const c of sweep(i)) {
        expect(Math.hypot(c.dx, c.dy)).toBeGreaterThanOrEqual(
          mawInnerRadius(reach) - 0.001
        );
      }
    }
  });

  it('quem esta em cima e maior e mais nitido que quem esta mergulhando', () => {
    // O mergulho e contado pelo TAMANHO e pelo ALFA, ja que a posicao nao pode
    // conta-lo. Sem esse degrau, uma elipse chapada no chao nao tem como dizer
    // de que lado do rolo ela esta.
    const w = sweep(0);
    const alto = w.reduce((a, b) => (b.liftTiles > a.liftTiles ? b : a));
    const baixo = w.reduce((a, b) => (b.liftTiles < a.liftTiles ? b : a));
    expect(alto.radius).toBeGreaterThan(baixo.radius);
    expect(alto.alpha).toBeGreaterThan(baixo.alpha);
  });

  it('nao sobe como uma COLUNA: o anel e achatado, e a leitura fica no chao', () => {
    // Um toro geometricamente redondo teria a altura igual a grossura do tubo —
    // 2,2 tiles no alcance cheio, que nesta projecao 2:1 poe a poeira 115 px
    // acima do solo. A mecanica inteira acontece no chao; o efeito tem de ficar
    // onde ela esta.
    const maisAlto = Math.max(...sweep(0).map((c) => c.liftTiles));
    expect(maisAlto).toBeLessThan(reach * MAW_TORUS_TUBE * 0.5);
  });

  it('as nuvens nao sobem todas JUNTAS: e um rolo, e nao um pistao', () => {
    const lifts = [];
    for (let i = 0; i < MAW_CLOUDS; i++) lifts.push(mawCloud(i, 1.13, reach).liftTiles);
    expect(Math.max(...lifts) - Math.min(...lifts)).toBeGreaterThan(MAW_TORUS_RISE * 0.5);
  });

  it('sao deterministicas: dois clientes da sala desenham a mesma poeira', () => {
    expect(mawCloud(5, 2.5, reach)).toEqual(mawCloud(5, 2.5, reach));
  });
});
