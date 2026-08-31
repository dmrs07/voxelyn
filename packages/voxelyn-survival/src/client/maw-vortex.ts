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
  /** O RASTRO do grao, do mais antigo ao ponto atual, em tiles a partir do centro. */
  path: ReadonlyArray<{ dx: number; dy: number }>;
  /** 0 a 1 — nasce e morre nas pontas do caminho, sem piscar. */
  alpha: number;
};

/**
 * Quantos pontos formam o rastro de um grao.
 *
 * Ele e uma POLILINHA e nao um segmento porque o caminho e uma espiral: dois
 * pontos ligados em linha reta cortam a curva pela corda, e com o rastro curto
 * isso mal apareceria — mas o rastro precisa ser longo o bastante para ler como
 * velocidade. A primeira versao usava um segmento so e o resultado, visto na
 * captura, foi um feixe de varetas retas atravessando o disco de lado a lado:
 * o desenho dizia "estilhaco voando" onde a mecanica diz "areia girando para
 * dentro".
 */
const STREAK_POINTS = 5;
/**
 * O comprimento do rastro, em fracao do caminho inteiro.
 *
 * Medido pelo que ele custa no pior lugar: na borda, onde o raio e maior, este
 * vao vale cerca de um tile de arco. Mais que isso e o grao vira um risco
 * dando meia-volta na tela; menos e ele vira um ponto, e ponto nao tem direcao
 * — e a DIRECAO e a unica coisa que este efeito precisa dizer.
 */
const STREAK_SPAN = 0.024;

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
  // ONDE O GRAO MORRE. A garganta, quando ela ja existe — e enquanto nao existe,
  // um terco do alcance do instante.
  //
  // A garganta e um raio FIXO e o alcance CRESCE de zero: durante o primeiro
  // segundo da janela o alcance ainda e menor que ela. Interpolar direto para
  // DEVOURER_MAW_BITE_RADIUS invertia o caminho nesse trecho — o grao nascia no
  // alcance (pequeno) e voava para FORA, ate um raio que a simulacao ainda nao
  // tocava. O telegrafo de abertura desenhava o sentido errado, em cima de chao
  // que nao estava sendo puxado, e sentido e a unica coisa que este efeito
  // precisa dizer sem ambiguidade.
  //
  // O `min` cobre isso sem apagar o efeito: antes de a garganta existir os graos
  // continuam caindo, so que para dentro do vao que ha. E o mesmo recorte que a
  // simulacao faz — ela tambem so cobra a mordida quando `reach` alcanca o raio
  // da garganta.
  const inner = Math.min(DEVOURER_MAW_BITE_RADIUS, reach * 0.34);
  const at = (p: number): { dx: number; dy: number } => {
    const clamped = Math.max(0, Math.min(1, p));
    const r = inner + (reach - inner) * Math.pow(1 - clamped, 0.62);
    // O angulo de partida usa o angulo aureo para os graos nao se alinharem em
    // raios: `i * 2pi/count` daria um pente girando, que le como roda dentada.
    const theta = i * 2.39996 + clamped * MAW_SWIRL_TURNS * Math.PI * 2;
    return { dx: Math.cos(theta) * r, dy: Math.sin(theta) * r };
  };
  const raw = seconds / MAW_FALL_SECONDS + i / count;
  const p = raw - Math.floor(raw);
  const path: Array<{ dx: number; dy: number }> = [];
  for (let k = STREAK_POINTS - 1; k >= 0; k--) {
    path.push(at(p - (STREAK_SPAN * k) / (STREAK_POINTS - 1)));
  }
  // Some nas duas pontas: um grao que aparecesse pronto na borda pareceria
  // materia caindo do teto, e um que sumisse a meio caminho negaria o destino.
  const fade = Math.min(1, p / 0.12, (1 - p) / 0.12);
  return { path, alpha: Math.max(0, fade) };
};
