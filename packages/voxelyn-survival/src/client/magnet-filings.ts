// A LIMALHA DO MAGNETARCA — a geometria do que o campo carrega.
//
// Por que ela vive aqui e nao na simulacao, pelo mesmo motivo do vortice da
// boca (`maw-vortex.ts`): nenhuma limalha desenhada aqui machuca, empurra ou
// escreve celula. Quem move o Prospector e a simulacao, com o passo com colisao
// de `magnetarchStep`.
//
// O que este arquivo faz e diferente e continua sendo necessario. O campo do
// Magnetarca nao tem corpo: ele e uma regra sobre distancia, e uma regra sobre
// distancia nao aparece na tela sozinha. Sem materia visivel atravessando a
// sala, o que o jogador ve e um chefe parado e um Prospector que escorrega — e
// foi exatamente esse o relato: "nao faco ideia de como funciona a luta dele".
// A limalha e o campo virando coisa: a DIRECAO dela diz a polaridade sem uma
// palavra de HUD, e a velocidade dela diz que a folga da inversao chegou.
//
// Tudo aqui e funcao pura de (indice, tempo, aneis). Sem estado, sem
// aleatoriedade e sem relogio local: as duas maquinas de uma sala de co-op
// desenham a mesma limalha porque recebem as mesmas entradas — e as entradas
// que importam (a polaridade, a folga, os raios das duas bordas) vem de
// `magnetField`, na simulacao, e nao de numeros copiados para ca.

/**
 * Quantos riscos o campo carrega de uma vez, NA QUALIDADE ALTA.
 *
 * O desenho escala este numero pelo preset ativo, pela mesma fracao
 * `maxFx / PRESETS.high.maxFx` que o resto dos efeitos do cliente usa — e o
 * total tem de entrar em `magnetFiling` como `count` junto, porque e ele que
 * espalha as fases: desenhar um subconjunto dos indices com o total antigo
 * deixaria buracos fixos no anel em vez de uma limalha mais rala.
 */
export const MAGNET_FILINGS = 96;

/**
 * Quanto tempo um risco leva da borda do campo ate o anel de esmagamento, em
 * segundos.
 *
 * Amarrado a leitura, e nao ao gosto: a travessia inteira do campo tem de ser
 * mais lenta que a caminhada do Prospector (10 tiles a 4,6 tiles/s dao ~2,2 s),
 * senao a limalha passa como chuva e o olho para de ler DIRECAO. Mais lenta que
 * isso e ela vira decoracao parada.
 */
export const MAGNET_FILING_SECONDS = 2.6;

/** O comprimento de cada risco, em tiles. Curto: e limalha, nao cometa. */
export const MAGNET_FILING_LENGTH = 0.9;

export type MagnetFiling = {
  /** A cauda do risco, em offset de tiles a partir do corpo do chefe. */
  x: number;
  y: number;
  /** A cabeca do risco, no mesmo espaco. O sentido dela E a polaridade. */
  hx: number;
  hy: number;
  /** 0..1 — mais forte no meio da travessia, apagando nas duas pontas. */
  alpha: number;
};

/** Espalhamento angular por angulo aureo: nenhum eixo ganha uma fila. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Fracionario sempre positivo — `%` em JS devolve negativo para entrada negativa. */
const frac = (v: number): number => v - Math.floor(v);

/**
 * O risco de indice `index` neste instante.
 *
 * `outward` e a polaridade: repelindo o campo joga a limalha para fora,
 * atraindo ele a traz para dentro. O caminho e RADIAL puro, sem espiral — o
 * contrario do vortice da boca, e de proposito: la o assunto era "isto engole",
 * e uma orbita ajudava; aqui o assunto e "de que lado a coisa esta indo", e
 * qualquer componente tangencial atrapalha exatamente essa leitura.
 *
 * A fase de cada risco mistura o indice com um deslocamento irracional para as
 * cabecas nao formarem aneis concentricos marchando juntos — o que leria como
 * uma onda pulsando, e nao como fluxo continuo.
 */
export const magnetFiling = (
  index: number,
  count: number,
  seconds: number,
  outward: boolean,
  inner: number,
  outer: number,
): MagnetFiling => {
  const angle = index * GOLDEN;
  // Duas fases somadas: a posicao na fila (indice/total) e a marcha do tempo.
  // O `* 0.618` quebra a coincidencia entre as duas — sem ele, os riscos de
  // indices vizinhos saem juntos e o campo pisca em vez de fluir.
  const phase = frac(index / Math.max(1, count) + index * 0.618 + seconds / MAGNET_FILING_SECONDS);
  // `travel` e 0 na origem do movimento e 1 no destino dele, seja qual for o
  // sentido: assim o desvanecimento das pontas (abaixo) e o mesmo nos dois.
  const travel = phase;
  const span = Math.max(0.001, outer - inner);
  const radius = outward ? inner + span * travel : outer - span * travel;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const head = outward
    ? Math.min(outer, radius + MAGNET_FILING_LENGTH)
    : Math.max(inner, radius - MAGNET_FILING_LENGTH);
  // As duas pontas apagam: um risco que nascesse e morresse opaco piscaria na
  // borda do campo e no anel de esmagamento — e a borda do campo e justamente
  // onde o jogador precisa ver que ainda ha campo, nao um recorte.
  const alpha = Math.sin(Math.PI * travel) ** 0.7;
  return {
    x: dirX * radius,
    y: dirY * radius,
    hx: dirX * head,
    hy: dirY * head,
    alpha,
  };
};
