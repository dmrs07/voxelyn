// O VORTICE DA BOCA do Devorador Branco — a apresentacao da sucao.
//
// Por que a geometria dos graos vive aqui e nao na simulacao, pela mesma razao
// que a altura do salto vive em `leap-arc.ts`: ela nao decide nada. Nenhum grao
// desenhado aqui machuca, empurra ou consome celula — quem come a areia e a
// simulacao, escrevendo `SURF_SILT` de volta para chao limpo, e isso ja chega
// pelo diff de chunks como qualquer outra mudanca de terreno.
//
// O que este arquivo faz e diferente e continua sendo necessario: a areia que a
// simulacao come sai do chao de uma vez, celula por celula, e o que o jogador
// precisa ver e o CAMINHO dela — a materia indo para dentro, dizendo de que
// lado esta o centro e a que velocidade a boca puxa naquele ponto. Sem isso o
// disco limpo que cresce no chao seria um buraco aparecendo, e nao um vortice.
//
// Tudo aqui e funcao pura de (indice, tempo, alcance). Sem estado, sem
// aleatoriedade e sem relogio local: dois clientes da mesma sala desenham o
// mesmo vortice porque recebem as mesmas entradas — e as ENTRADAS que importam
// (o alcance, a forca, a linha do sem-volta) vem de `mawReach`/`mawPull`, na
// simulacao, e nao de numeros copiados para ca.

import {
  DEVOURER_MAW_BITE_RADIUS,
  DEVOURER_MAW_PULL_CORE,
  DEVOURER_MAW_PULL_EDGE,
  DEVOURER_MAW_PULL_FALLOFF,
  DEVOURER_MAW_RADIUS,
  PLAYER_SPEED,
} from '@voxelyn/survival-sim';

/** Quantos graos o vortice carrega de uma vez. */
export const MAW_STREAKS = 44;
/** Quanto tempo um grao leva da borda ate a garganta, em segundos. */
export const MAW_FALL_SECONDS = 1.15;
/**
 * Voltas que um grao da em torno do centro no caminho inteiro.
 *
 * Uma e pouco: le como um risco curvo caindo, e nao como rotacao. Tres e
 * demais no zoom padrao — a espiral fecha tao rapido que o olho perde qual
 * ponta e o comeco. Duas voltas dao a leitura que o efeito existe para dar: o
 * chao inteiro girando para dentro de um lugar so.
 */
export const MAW_SWIRL_TURNS = 2;

/**
 * A distancia em que a sucao iguala a caminhada — a LINHA DO SEM-VOLTA.
 *
 * Resolvida por busca e nao escrita a mao de proposito. Ela e consequencia de
 * quatro constantes de balanceamento (borda, garganta, pico e expoente), e um
 * numero copiado aqui viraria mentira no primeiro ajuste de qualquer uma delas
 * — mentira num anel que o jogo desenha no chao prometendo "ate aqui andar
 * resolve". Um telegrafo que promete errado e pior que nenhum.
 *
 * A busca e por bisseccao sobre a mesma formula da simulacao, e nao chama
 * `mawPull`: a funcao da simulacao recorta pelo alcance do instante, e o que se
 * quer aqui e a forma do campo, que nao depende do relogio.
 */
export const MAW_NO_RETURN_RADIUS = ((): number => {
  const at = (d: number): number => {
    const t = Math.max(
      0,
      Math.min(1, (DEVOURER_MAW_RADIUS - d) / (DEVOURER_MAW_RADIUS - DEVOURER_MAW_BITE_RADIUS))
    );
    return (
      DEVOURER_MAW_PULL_EDGE +
      (DEVOURER_MAW_PULL_CORE - DEVOURER_MAW_PULL_EDGE) * Math.pow(t, DEVOURER_MAW_PULL_FALLOFF)
    );
  };
  // A sucao cresce para dentro, entao a raiz e unica no intervalo. Se a
  // caminhada vencer a garganta (um ajuste futuro de balanco), nao ha linha:
  // devolve a garganta, e o anel some junto com a coisa que ele anunciava.
  if (at(DEVOURER_MAW_BITE_RADIUS) <= PLAYER_SPEED) return DEVOURER_MAW_BITE_RADIUS;
  let lo = DEVOURER_MAW_BITE_RADIUS;
  let hi = DEVOURER_MAW_RADIUS;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) > PLAYER_SPEED) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

export type MawStreak = {
  /** Deslocamento em tiles a partir do centro da boca. */
  dx: number;
  dy: number;
  /** O mesmo ponto um instante ATRAS: a cauda do risco. */
  tailDx: number;
  tailDy: number;
  /** 0 a 1 — nasce e morre nas pontas do caminho, sem piscar. */
  alpha: number;
};

/**
 * Onde esta o grao `i` no instante `seconds`, para um alcance `reach`.
 *
 * O progresso e uma serra: cada grao entra na borda, cai ate a garganta e
 * reaparece na borda deslocado por `i / count`, o que espalha os nascimentos no
 * tempo em vez de fazer todos os graos partirem juntos — uma leva unica leria
 * como um anel pulsando, e nao como fluxo.
 *
 * O raio nao cai linear: `(1 - p)^0.62` faz o grao ACELERAR para dentro, que e
 * a mesma coisa que a sucao faz com o corpo do jogador. E a unica parte do
 * desenho que precisa concordar com a fisica, e concorda pela forma e nao pelo
 * numero — a forca exata continua sendo assunto de `mawPull`.
 */
export const mawStreak = (
  i: number,
  seconds: number,
  reach: number,
  count = MAW_STREAKS
): MawStreak => {
  const at = (p: number): { x: number; y: number } => {
    const clamped = Math.max(0, Math.min(1, p));
    const r = DEVOURER_MAW_BITE_RADIUS + (reach - DEVOURER_MAW_BITE_RADIUS) * Math.pow(1 - clamped, 0.62);
    // O angulo de partida usa o angulo aureo para os graos nao se alinharem em
    // raios: `i * 2pi/count` daria um pente girando, que le como roda dentada.
    const theta = i * 2.39996 + clamped * MAW_SWIRL_TURNS * Math.PI * 2;
    return { x: Math.cos(theta) * r, y: Math.sin(theta) * r };
  };
  const raw = seconds / MAW_FALL_SECONDS + i / count;
  const p = raw - Math.floor(raw);
  const head = at(p);
  const tail = at(p - 0.06);
  // Some nas duas pontas: um grao que aparecesse pronto na borda pareceria
  // materia caindo do teto, e um que sumisse a meio caminho negaria o destino.
  const fade = Math.min(1, p / 0.12, (1 - p) / 0.12);
  return { dx: head.x, dy: head.y, tailDx: tail.x, tailDy: tail.y, alpha: Math.max(0, fade) };
};
