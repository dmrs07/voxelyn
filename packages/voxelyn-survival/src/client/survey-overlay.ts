// A ramificacao de LEVANTAMENTO, desenhada.
//
// Os seis protocolos SV existiam como campos em `PlayerTuning` que ninguem lia:
// a arvore cobrava minerio e nucleos permanentes por efeitos que nunca
// apareciam. Este arquivo e o que faz cada um deles existir.
//
// ---------------------------------------------------------------------------
// A REGRA QUE SEPARA ESTE ARQUIVO DA SIMULACAO
// ---------------------------------------------------------------------------
// Nada aqui altera um tick. Levantamento e APRESENTACAO — e por isso que
// `navigation` fica fora do hash autoritativo, e por isso que um quarto da
// arvore e impossivel de dessincronizar. Tudo o que estas funcoes fazem e ler o
// estado que ja existe e mostrar melhor.
//
// A consequencia de design importa: nenhum destes protocolos REVELA o mapa. Eles
// dao RUMO e PROXIMIDADE, que e informacao que encurta a busca sem apagar a
// exploracao. O espectrometro atravessa uma parede, nao cinco; o traco de
// salvage aponta um terminal, nao lista todos; a memoria de rota lembra onde o
// jogador ESTEVE, e nunca onde ele nao foi.
//
// A geometria fica em funcoes puras no topo, separada do desenho, porque e ela
// que decide o que o jogador ve — e um alcance ou uma oclusao errados sao um bug
// de balanceamento que nenhuma inspecao visual pega.

import {
  CONTAMINATION_WAVES,
  SOLID_NONE,
  SOLID_ORE,
  SOLID_ORE_CHIPPED,
  runIsReturning,
  type PlayerTuning,
  type SurvivalState,
} from '@voxelyn/survival-sim';

/** Rumo normalizado de um ponto a outro, ou null quando coincidem. */
export type Bearing = { dx: number; dy: number; distance: number };

export const bearingTo = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Bearing | null => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return null;
  return { dx: dx / distance, dy: dy / distance, distance };
};

/**
 * O objetivo ATUAL do setor, para o beacon de entrada (SV-01).
 *
 * Enquanto o ponto especial deste setor ainda tem o que dar, o objetivo e ele:
 * o pedestal por recolher, ou o poco por descer. Quando a run entra no caminho
 * de VOLTA — o Nucleo mais fundo na mao —, o objetivo passa a ser a saida, que
 * na subida e a propria entrada.
 *
 * "A run esta voltando" e nao "algum Nucleo foi pego": numa expedicao de G-04, o
 * Nucleo do setor 3 na mochila nao encerra nada, e mandar o beacon para a
 * entrada ali apontaria o jogador para fora de metade da descida que ele ainda
 * tem autorizacao para fazer.
 */
export const objectiveOf = (state: SurvivalState): { x: number; y: number } =>
  runIsReturning(state) || !state.corePos
    ? { x: state.entry.x + 0.5, y: state.entry.y + 0.5 }
    : { x: state.corePos.x + 0.5, y: state.corePos.y + 0.5 };

/**
 * O terminal de salvage mais proximo dentro do alcance (SV-02).
 *
 * So terminais NAO concluidos: apontar para um que o jogador ja abriu manda ele
 * andar ate um cofre vazio, que e o oposto do que o protocolo promete.
 */
export const nearestSalvage = (
  state: SurvivalState,
  x: number,
  y: number,
  range: number,
): Bearing | null => {
  if (range <= 0) return null;
  let best: Bearing | null = null;
  for (const site of state.salvageSites) {
    if (site.terminalState === 'complete') continue;
    const bearing = bearingTo(x, y, site.terminal.x + 0.5, site.terminal.y + 0.5);
    if (!bearing || bearing.distance > range) continue;
    if (!best || bearing.distance < best.distance) best = bearing;
  }
  return best;
};

/**
 * Quantas camadas de parede separam duas celulas, em linha reta.
 *
 * Uma travessia de Bresenham simplificada, contando TRANSICOES de aberto para
 * solido: e isso que "atravessa uma parede" quer dizer. Contar celulas solidas
 * daria numeros diferentes para a mesma parede conforme o angulo de aproximacao,
 * e o jogador leria como aleatorio.
 */
export const wallsBetween = (
  state: SurvivalState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): number => {
  const w = state.config.width;
  const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) * 2));
  let layers = 0;
  let inside = false;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.floor(fromX + (toX - fromX) * t);
    const cy = Math.floor(fromY + (toY - fromY) * t);
    if (cx < 0 || cy < 0 || cx >= w || cy >= state.config.height) break;
    const solid = state.solid[cy * w + cx] !== SOLID_NONE;
    if (solid && !inside) layers++;
    inside = solid;
  }
  return layers;
};

/** Veios visiveis para o espectrometro (SV-03), em indice de celula. */
export const scannedOre = (
  state: SurvivalState,
  x: number,
  y: number,
  range: number,
  occlusion: number,
): number[] => {
  if (range <= 0) return [];
  const w = state.config.width;
  const h = state.config.height;
  const found: number[] = [];
  const minX = Math.max(0, Math.floor(x - range));
  const maxX = Math.min(w - 1, Math.ceil(x + range));
  const minY = Math.max(0, Math.floor(y - range));
  const maxY = Math.min(h - 1, Math.ceil(y + range));
  for (let cy = minY; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      const i = cy * w + cx;
      const cell = state.solid[i];
      if (cell !== SOLID_ORE && cell !== SOLID_ORE_CHIPPED) continue;
      if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) > range) continue;
      // A propria celula do veio e solida e contaria como uma camada; o limite
      // e sobre o que esta ENTRE o jogador e ela.
      if (wallsBetween(state, x, y, cx + 0.5, cy + 0.5) > occlusion + 1) continue;
      found.push(i);
      // Teto por quadro: um Aquifero cheio de seams pintaria a tela inteira, e
      // "tudo brilha" informa exatamente tanto quanto "nada brilha".
      if (found.length >= 48) return found;
    }
  }
  return found;
};

/**
 * A memoria de rota (SV-04): quais CHUNKS o jogador ja atravessou.
 *
 * Chunk e nao celula, e a escolha e o protocolo inteiro: uma trilha por celula
 * seria um rastro de migalhas — mostra por onde se andou, nao que salao existe.
 * Por chunk, o registro vira "estes salões voce ja conhece", que e o que a ficha
 * do protocolo promete, e cabe num mapa minusculo do HUD.
 *
 * Zera na troca de setor: o mapa e do setor em que se esta.
 */
export class RouteMemory {
  private visited = new Set<number>();
  private sector = 0;
  private chunksPerRow = 1;

  /** Marca o chunk sob o jogador. Barato o bastante para rodar todo quadro. */
  observe(state: SurvivalState, chunkSize = 16): void {
    if (state.sector !== this.sector) {
      this.visited.clear();
      this.sector = state.sector;
    }
    this.chunksPerRow = Math.ceil(state.config.width / chunkSize);
    const cx = Math.floor(state.player.x / chunkSize);
    const cy = Math.floor(state.player.y / chunkSize);
    this.visited.add(cy * this.chunksPerRow + cx);
  }

  has(chunk: number): boolean {
    return this.visited.has(chunk);
  }

  get size(): number {
    return this.visited.size;
  }

  get columns(): number {
    return this.chunksPerRow;
  }

  reset(): void {
    this.visited.clear();
    this.sector = 0;
  }
}

/**
 * A previsao de contaminacao (SV-X): quanto falta para a proxima onda.
 *
 * IMPORTADA da simulacao, e nao copiada. A primeira versao duplicava a escada
 * "de proposito", com um comentario dizendo que o teste travaria as duas — e o
 * teste comparava a copia com um literal DELA MESMA. A copia estava errada (um
 * degrau inventado em 0,12 que a simulacao nao tem), o teste passava, e a barra
 * ficava uma onda inteira atrasada para sempre.
 *
 * A licao ficou no lugar da constante: um teste que so confere uma copia contra
 * si mesma nao trava nada, e uma constante compartilhada nao precisa de teste.
 *
 * Devolve `null` depois da ultima onda: nao ha proxima, e inventar uma barra
 * parada seria pior que nao mostrar nada.
 */
export const WAVE_THRESHOLDS: readonly number[] = CONTAMINATION_WAVES.map(([level]) => level);

export type WaveForecast = { next: number; progress: number; imminent: boolean };

export const forecastWave = (contamination: number, wavesSoFar: number): WaveForecast | null => {
  if (wavesSoFar >= WAVE_THRESHOLDS.length) return null;
  const target = WAVE_THRESHOLDS[wavesSoFar];
  const previous = wavesSoFar === 0 ? 0 : WAVE_THRESHOLDS[wavesSoFar - 1];
  const span = Math.max(1e-6, target - previous);
  const progress = Math.max(0, Math.min(1, (contamination - previous) / span));
  return { next: wavesSoFar + 1, progress, imminent: progress >= 0.8 };
};

/** Algum protocolo de Levantamento esta instalado? Evita trabalho por quadro. */
export const hasSurvey = (nav: PlayerTuning['navigation']): boolean =>
  nav.objectiveBeacon ||
  nav.salvageTraceRange > 0 ||
  nav.oreScannerRange > 0 ||
  nav.routeMemory ||
  nav.returnVector ||
  nav.contaminationForecast;

/**
 * O vetor de retorno (SV-05) pisca em vez de ficar aceso.
 *
 * Uma seta permanente na tela vira parte do HUD e o jogador para de navegar: ele
 * segue a seta. Piscando a cada tres segundos, ela CORRIGE o rumo de quem ja
 * esta se orientando sozinho — que e a diferenca entre uma bussola e um piloto
 * automatico.
 */
export const RETURN_VECTOR_PERIOD_MS = 3000;
export const RETURN_VECTOR_VISIBLE_MS = 900;

export const returnVectorVisible = (nowMs: number): boolean =>
  nowMs % RETURN_VECTOR_PERIOD_MS < RETURN_VECTOR_VISIBLE_MS;

/** O beacon de entrada (SV-01) dura o suficiente para ser lido, e some. */
export const BEACON_DURATION_MS = 2600;

export const beaconAlpha = (elapsedMs: number): number => {
  if (elapsedMs < 0 || elapsedMs > BEACON_DURATION_MS) return 0;
  const t = elapsedMs / BEACON_DURATION_MS;
  // Sobe rapido e desce devagar: o pulso chega junto com a troca de setor, e um
  // fade-in lento o faria aparecer depois de o jogador ja ter escolhido um rumo.
  return t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
};

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------
// Tudo abaixo e canvas puro sobre coordenadas ja projetadas. Os valores vem das
// funcoes acima; aqui nao se decide nada, so se pinta.

/** Cor da instrumentacao Aurix: fria, distinta de loot e de perigo. */
const INSTRUMENT = '#7fd4ff';

/** Uma seta curta na direcao de um rumo, comecando fora do corpo. */
const drawChevron = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  bearing: Bearing,
  z: number,
  alpha: number,
  color: string,
): void => {
  // A projecao e 2:1: o rumo em coordenadas de MUNDO tem de virar rumo de TELA,
  // senao a seta aponta para um lugar que nao existe.
  const ex = bearing.dx - bearing.dy;
  const ey = (bearing.dx + bearing.dy) * 0.5;
  const len = Math.hypot(ex, ey) || 1;
  const nx = ex / len;
  const ny = ey / len;
  const near = 18 * z;
  const far = 30 * z;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 1.6 * z);
  ctx.beginPath();
  ctx.moveTo(sx + nx * near, sy + ny * near - 10 * z);
  ctx.lineTo(sx + nx * far, sy + ny * far - 10 * z);
  ctx.stroke();
  // Ponta
  const tipX = sx + nx * far;
  const tipY = sy + ny * far - 10 * z;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - nx * 5 * z - ny * 3 * z, tipY - ny * 5 * z + nx * 3 * z);
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - nx * 5 * z + ny * 3 * z, tipY - ny * 5 * z - nx * 3 * z);
  ctx.stroke();
  ctx.restore();
};

export type SurveyDrawContext = {
  ctx: CanvasRenderingContext2D;
  state: SurvivalState;
  nav: PlayerTuning['navigation'];
  /** Tela dos pes do Prospector local. */
  sx: number;
  sy: number;
  z: number;
  nowMs: number;
  /** Quando o setor corrente comecou, em ms de relogio de quadro. */
  sectorEnteredAtMs: number;
  route: RouteMemory;
  toScreen: (x: number, y: number) => [number, number];
};

/** Os efeitos que vivem NO MUNDO (beacon, traco, espectrometro, vetor). */
export const drawSurveyWorld = (draw: SurveyDrawContext): void => {
  const { ctx, state, nav, sx, sy, z, nowMs } = draw;
  const px = state.player.x;
  const py = state.player.y;

  // SV-03 · Espectrometro: os veios proximos pulsam, atraves de uma parede.
  if (nav.oreScannerRange > 0) {
    const pulse = 0.25 + 0.2 * Math.sin(nowMs / 320);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = INSTRUMENT;
    for (const cell of scannedOre(state, px, py, nav.oreScannerRange, nav.oreScannerOcclusion)) {
      const cx = cell % state.config.width;
      const cy = Math.floor(cell / state.config.width);
      const [ox, oy] = draw.toScreen(cx + 0.5, cy + 0.5);
      ctx.beginPath();
      ctx.ellipse(ox, oy, 3.2 * z, 1.6 * z, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // SV-01 · Beacon: um pulso ao entrar no setor, apontando o objetivo.
  if (nav.objectiveBeacon) {
    const alpha = beaconAlpha(nowMs - draw.sectorEnteredAtMs);
    if (alpha > 0) {
      const objective = objectiveOf(state);
      const bearing = bearingTo(px, py, objective.x, objective.y);
      if (bearing) drawChevron(ctx, sx, sy, bearing, z, alpha * 0.85, INSTRUMENT);
    }
  }

  // SV-05 · Vetor de retorno: so com o nucleo, e piscando.
  if (nav.returnVector && state.playerExtra.hasCore && returnVectorVisible(nowMs)) {
    const bearing = bearingTo(px, py, state.entry.x + 0.5, state.entry.y + 0.5);
    if (bearing) drawChevron(ctx, sx, sy, bearing, z, 0.7, '#59f2c2');
  }

  // SV-02 · Traco de salvage: rumo do terminal mais proximo ainda aberto.
  if (nav.salvageTraceRange > 0) {
    const bearing = nearestSalvage(state, px, py, nav.salvageTraceRange);
    if (bearing) {
      // Mais fraco quanto mais longe: a intensidade E a distancia, sem numero.
      const closeness = 1 - bearing.distance / nav.salvageTraceRange;
      drawChevron(ctx, sx, sy, bearing, z, 0.25 + closeness * 0.4, '#ffd166');
    }
  }
};

/** Os efeitos que vivem NO HUD (memoria de rota, previsao de onda). */
export const drawSurveyHud = (
  ctx: CanvasRenderingContext2D,
  state: SurvivalState,
  nav: PlayerTuning['navigation'],
  route: RouteMemory,
  x: number,
  y: number,
  nowMs: number,
): number => {
  let cursor = y;

  // SV-04 · Memoria de rota: um mapa de CHUNKS visitados, nao do mundo.
  if (nav.routeMemory && route.size > 0) {
    const cell = 3;
    const columns = route.columns;
    const rows = Math.ceil(state.config.height / 16);
    const playerChunk = Math.floor(state.player.y / 16) * columns + Math.floor(state.player.x / 16);
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < columns; cx++) {
        const chunk = cy * columns + cx;
        if (!route.has(chunk)) continue;
        ctx.fillStyle = chunk === playerChunk ? INSTRUMENT : 'rgba(127,212,255,0.28)';
        ctx.fillRect(x + cx * cell, cursor + cy * cell, cell - 1, cell - 1);
      }
    }
    cursor += rows * cell + 6;
  }

  // SV-X · Previsao: barra fina que enche ate a proxima onda.
  if (nav.contaminationForecast) {
    const forecast = forecastWave(state.contamination, state.contaminationWaves);
    if (forecast) {
      const width = 54;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, cursor, width, 3);
      // Pisca so na iminencia: uma barra que pulsa o tempo todo vira ruido, e
      // aqui o unico momento que importa e o de sair de onde se esta.
      ctx.globalAlpha = forecast.imminent ? 0.6 + 0.4 * Math.sin(nowMs / 110) : 1;
      ctx.fillStyle = forecast.imminent ? '#d93b4c' : INSTRUMENT;
      ctx.fillRect(x, cursor, width * forecast.progress, 3);
      ctx.globalAlpha = 1;
      cursor += 9;
    }
  }
  return cursor;
};
