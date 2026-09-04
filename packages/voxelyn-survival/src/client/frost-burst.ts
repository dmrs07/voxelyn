// O LEQUE DE ESTILHACOS: a geometria do congelamento da Rainha da Geada.
//
// A referencia e uma figura no centro de uma coroa de lascas brancas que se
// abrem em circulo completo sobre o chao escuro — lascas em pe, inclinadas para
// fora como penas de gelo, e para alem delas riscos finos de po correndo pelo
// chao ate onde o congelamento chega.
//
// Esta funcao e PURA e vive fora do render por uma razao so: a coroa tem de
// ser a mesma nas duas maquinas de uma sala de co-op (o sorteio e semeado pelo
// evento autoritativo) e tem de poder ser provada sem canvas — que toda lasca
// cabe no raio real da habilidade, que o circulo e completo, que a coroa
// cresce e depois se apaga. O render so traduz isto em triangulos.

/** Duracao total da coroa, do primeiro quadro ao ultimo, em ms. */
export const FROST_BURST_MS = 900;
/** Quantas lascas formam a coroa. */
export const FROST_BURST_SHARDS = 36;
/** Quantos riscos de po correm pelo chao para alem da coroa. */
export const FROST_BURST_STREAKS = 48;

export type FrostShard = {
  /** Direcao no plano do chao, em radianos. */
  angle: number;
  /** Onde a base da lasca toca o chao, em tiles a partir do centro. */
  base: number;
  /** Onde a ponta chega no chao (inclinada para fora), em tiles. */
  reach: number;
  /** Altura da ponta, em tiles. */
  height: number;
  /** Meia-largura da base, em tiles. */
  halfWidth: number;
  /** Atraso do surgimento, 0..1 do periodo de crescimento. */
  delay: number;
};

export type FrostStreak = {
  angle: number;
  /** Comeco e fim do risco no chao, em tiles. */
  from: number;
  to: number;
  delay: number;
};

export type FrostBurst = {
  radius: number;
  shards: FrostShard[];
  streaks: FrostStreak[];
};

const xorshift = (seed: number): (() => number) => {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
};

/**
 * Monta a coroa para um congelamento de raio `radius` (tiles) semeado por
 * `seed`. Os angulos sao distribuidos por igual e SO ENTAO sacudidos: sorteando
 * cada um, o circulo sai com buracos e aglomerados e deixa de ler como coroa.
 *
 * Nenhuma lasca passa do raio: a coroa e a promessa visivel de ate onde o
 * lago foi refeito, e uma ponta alem do alcance mentiria sobre o que virou
 * gelo — e sobre quais buracos fecharam.
 */
export const frostBurst = (seed: number, radius: number): FrostBurst => {
  const rnd = xorshift(seed);
  const shards: FrostShard[] = [];
  for (let i = 0; i < FROST_BURST_SHARDS; i++) {
    const angle = (i / FROST_BURST_SHARDS) * Math.PI * 2 + (rnd() - 0.5) * 0.12;
    // Duas fileiras intercaladas: a de dentro mais baixa e curta, a de fora
    // mais alta — e o que da a coroa a profundidade da referencia, em vez de
    // um anel de dentes iguais.
    const outerRow = i % 2 === 0;
    const base = radius * (outerRow ? 0.5 : 0.36) + rnd() * radius * 0.08;
    const reach = Math.min(radius, base + radius * (outerRow ? 0.36 : 0.22) + rnd() * radius * 0.1);
    const height = (outerRow ? 1.1 : 0.7) + rnd() * 0.5;
    const halfWidth = 0.16 + rnd() * 0.12;
    shards.push({ angle, base, reach, height, halfWidth, delay: rnd() * 0.5 });
  }
  const streaks: FrostStreak[] = [];
  for (let i = 0; i < FROST_BURST_STREAKS; i++) {
    const angle = (i / FROST_BURST_STREAKS) * Math.PI * 2 + (rnd() - 0.5) * 0.1;
    const from = radius * (0.55 + rnd() * 0.25);
    const to = Math.min(radius, from + radius * (0.12 + rnd() * 0.25));
    streaks.push({ angle, from, to, delay: rnd() * 0.6 });
  }
  // Ordem de pintor, resolvida uma vez: quem esta mais atras na projecao
  // (x + y menor) desenha primeiro, e as lascas da frente cobrem as de tras.
  shards.sort(
    (a, b) => Math.cos(a.angle) + Math.sin(a.angle) - (Math.cos(b.angle) + Math.sin(b.angle)),
  );
  return { radius, shards, streaks };
};

export type FrostBurstFrame = {
  /** Quanto da coroa ja saiu do chao, 0..1 (com o atraso de cada peca aplicado por fora). */
  grow: number;
  /** Opacidade das lascas. */
  alpha: number;
  /** Opacidade do disco de geada no chao. */
  disc: number;
};

/**
 * A curva no tempo: a coroa SALTA do chao nos primeiros ~30% e so entao
 * comeca a apagar. Crescer o tempo inteiro faria a leitura de "gelo se
 * formando" — e o que a habilidade faz e gelo que JA se formou, de uma vez,
 * como um saco de cacos despejado no chao.
 */
export const frostBurstFrame = (t: number): FrostBurstFrame => {
  const u = Math.max(0, Math.min(1, t));
  const g = Math.min(1, u / 0.3);
  const grow = 1 - (1 - g) * (1 - g) * (1 - g);
  const fade = u < 0.45 ? 1 : 1 - (u - 0.45) / 0.55;
  return { grow, alpha: Math.max(0, fade), disc: Math.max(0, fade) * 0.55 };
};

/** Crescimento de uma peca com atraso proprio: nada aparece antes da vez. */
export const pieceGrow = (grow: number, delay: number): number => {
  const span = 1 - delay * 0.6;
  return Math.max(0, Math.min(1, (grow - delay * 0.6) / span));
};
