// A VEIN VIVA: um pulso de carga percorrendo celulas conectadas, produzido pelos
// sistemas da SIMULACAO — nao desenhado.
//
// O briefing pede que o estado capturado represente "um pulso de carga
// percorrendo celulas conectadas" e manda reutilizar os sistemas existentes.
// Eles existem, e sao dois — distintos, e o jogo os trata como coisas
// diferentes:
//
//   LEYLINE (`SOLID_LEYLINE`, `SOLID_LEYLINE_NODE`). O condutor geologico do
//       setor. Conduz por SEGMENTO: `stepLeylines`, em `sim/run.ts`, acende um
//       trecho inteiro entre juncoes depois de `LEYLINE_CHARGE_TICKS`, e a
//       adjacencia relevante e de OITO vizinhos — `leylineSegmentShorted` mede
//       assim porque a gravacao do worldgen troca de lado da parede e a linha
//       anda na diagonal em varios trechos.
//   MINERIO (`SOLID_ORE`). Bolsao local. Conduz por flood-fill de QUATRO
//       vizinhos com orcamento (`floodFrom` + `BUDGET_VEIN_CELLS`), disparado
//       por um impacto de energia em `impactSolid`.
//
// A primeira versao deste modulo passou o segmento de leyline para `floodFrom` e
// recebeu zero celulas de volta. Os dois motivos sao instrutivos e valem ficar
// escritos: `floodFrom` recebe um INDICE de celula no callback, nao um par
// (x, y); e ele anda por quatro vizinhos, entao para na primeira diagonal do
// condutor. Nao era um ajuste de parametro — era o sistema errado para a
// materia.
//
// Entao aqui cada sistema faz o que faz no jogo: a leyline propaga pelo
// segmento, por oito vizinhos; o minerio encostado nela propaga pelo flood-fill
// real, com o orcamento real. As celulas resultantes vao para `chargeCells`, que
// e a funcao do jogo que planta a carga em `state.charges` e emite o evento de
// descarga — entao o que a splash mostra e literalmente o estado que a
// simulacao produz.
import {
  chargeCells,
  floodFrom,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  SOLID_LEYLINE,
  SOLID_LEYLINE_NODE,
} from '@voxelyn/survival-sim';

/**
 * Acende a Vein a partir do berco e devolve as celulas acesas ORDENADAS pela
 * propagacao.
 *
 * A ordem e o que permite a luz decair ao longo do veio: um pulso que chega com
 * a mesma forca na outra ponta nao le como pulso, le como cabo aceso — e "cabo
 * de neon" e uma das leituras que o briefing proibe. Ela sai da busca em largura
 * (a ordem em que a corrente alcancou cada celula), nunca de uma distancia
 * euclidiana calculada depois: numa curva do condutor as duas discordam, e e a
 * primeira que descreve corrente.
 */
export const chargeVein = (state, segment, oreBudget = 64) => {
  const w = state.config.width;
  const h = state.config.height;
  const events = [];

  // A nascente: a celula do segmento mais proxima do berco. E de la que a
  // corrente parte, porque e o nucleo que alimenta.
  let source = null;
  for (const cell of segment.cells) {
    const x = cell % w;
    const y = (cell / w) | 0;
    const d = Math.hypot(x - state.corePos.x, y - state.corePos.y);
    if (!source || d < source.d) source = { x, y, cell, d };
  }
  if (!source) return { cells: [], ordered: [], source: null, events, oreCells: [] };

  // --- 1. O SEGMENTO INTEIRO acende, ordenado pela distancia a nascente ---
  //
  // Uma busca em largura pelo condutor foi tentada aqui e devolveu UMA celula.
  // O motivo esta documentado no proprio worldgen e vale repetir: o segmento e
  // ESPARSO. A gravacao pula as celulas em que a decoracao de parede ja tinha
  // posto minerio ou cristal, entao duas celulas vizinhas do MESMO trecho podem
  // estar a treze tiles uma da outra — no segmento desta seed, (54,73) e (67,73)
  // sao consecutivas na lista.
  //
  // E por isso que o jogo nunca propaga celula a celula por aqui: `stepLeylines`
  // acende o SEGMENTO inteiro de uma vez, decorrido `LEYLINE_CHARGE_TICKS`. O
  // trecho e a unidade de conducao; as celulas sao onde ele aflora na parede.
  //
  // A ordenacao por distancia a nascente, entao, nao e propagacao — e so a ordem
  // em que a luz decai, e esta declarada como tal. A corrente vem do berco, e o
  // afloramento mais distante brilha menos.
  const order = [...segment.cells].sort((a, b) => {
    const da = Math.hypot((a % w) - source.x, ((a / w) | 0) - source.y);
    const db = Math.hypot((b % w) - source.x, ((b / w) | 0) - source.y);
    return da - db;
  });

  // --- 2. Minerio encostado no condutor: o flood-fill real do jogo ---
  //
  // E o que a cadeia de minerio faz quando um tiro de energia acerta um veio
  // (`impactSolid`, caso SOLID_ORE): busca em largura orcada sobre o minerio
  // conectado. Aqui o gatilho e o proprio condutor carregado encostando nele —
  // que e a mesma fisica de um lado so.
  const isOre = (index) => {
    const s = state.solid[index];
    return s === SOLID_ORE || s === SOLID_ORE_CHIPPED;
  };
  const oreCells = [];
  const oreSeen = new Set();
  for (const cell of order) {
    const cx = cell % w;
    const cy = (cell / w) | 0;
    const found = floodFrom(state, cx, cy, oreBudget, isOre);
    for (const c of found) {
      if (oreSeen.has(c)) continue;
      oreSeen.add(c);
      oreCells.push(c);
    }
  }

  // --- 3. A carga, plantada pela funcao do jogo ---
  const all = [...order, ...oreCells];
  chargeCells(state, all, events, source.cell);

  return {
    /** Na ordem da propagacao: condutor primeiro, depois o minerio alcancado. */
    cells: all,
    ordered: order,
    oreCells,
    source,
    /** Eventos que a simulacao emitiu. Vao para o relatorio de autenticidade. */
    events,
    /** As celulas que a simulacao registrou como carregadas, para conferencia. */
    stateCharges: state.charges.length,
  };
};

export { SOLID_LEYLINE, SOLID_LEYLINE_NODE };
