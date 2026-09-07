// O CORPO COMPOSTO DO DIAMANDIS — um chassi de oito rumos e tres pecas que
// EXISTEM de verdade: a broca, o rack de demolicao e o mastro-lente.
//
// A simulacao sempre soube que o chefe perde pecas: `modulesExposed` diz qual
// soltou, `modulesLost` qual foi arrancada, e o Coveiro que carrega uma guarda
// o indice dela em `mood`. O que faltava era o corpo CONCORDAR com isso. Ate
// aqui o Diamandis era um sprite so, inteiro do primeiro ao ultimo ponto de
// vida, e o Coveiro saia da carcaça com as maos vazias — a economia do
// encontro (deixar arrancar ou defender) so existia no toast.
//
// Agora o chassi e desenhado sem as pecas, e cada peca e um atlas proprio,
// encaixado num SOCKET que o gerador publica por rumo no manifest do chassi
// (`sockets[dir][peca] = {x, y, depth}`). O mesmo atlas da peca tem as quatro
// vidas dela:
//
//   mounted  presa no chassi, na pose autorada, acompanhando a animacao dele;
//   loose    solta — pendurada, balancando, faiscando. E o TELEGRAFO: um
//            Coveiro ja pode engatar, e ainda da tempo de impedir;
//   carried  pendurada no eletroima de um Coveiro, a caminho da borda;
//   floor    caida onde o carregador morreu, por menos de um segundo, antes
//            de virar lasca voando para o contador de carga.
//
// Este arquivo e a parte PURA disso: que peca esta em que estado, que animacao
// e que quadro ela mostra, onde na tela fica o encaixe e em que ordem entra
// em relacao ao chassi. O renderer so desenha o que sai daqui, e por isso tudo
// isto pode ser conferido sem um canvas.
//
// O FRENESI mora aqui tambem, do lado visual. A simulacao guarda o numero
// (`diamandisFrenzyStacks`); o corpo o traduz em quatro sinais que crescem
// juntos e nunca ocupam a tela inteira: o reator mais aceso (tint), o
// maquinario sobrevivente mais rapido (o relogio das pecas montadas), fumaca
// preta em fio e os ESPASMOS — sacudidas curtas e irregulares de um automato
// velho funcionando com menos pecas do que devia.
import { BOSS_MODULE_DRILL } from '@voxelyn/survival-sim';
import {
  dirFromFacing,
  dirFromFacing8,
  frameAtTime,
  type SpriteManifestEntry,
} from '@voxelyn/survival-content';

/**
 * Nome da peca pelo indice de modulo da simulacao (BOSS_MODULE_DRILL/TOWER/
 * SCANNER = 0/1/2). A ordem E a ordem fixa de remocao do encontro: broca,
 * rack, mastro.
 */
export const DIAMANDIS_PART_NAMES: readonly string[] = ['drill', 'rack', 'mast'];

export const diamandisPartAtlas = (module: number): string | null => {
  const name = DIAMANDIS_PART_NAMES[module];
  return name ? `part-diamandis-${name}` : null;
};

/**
 * O atlas do BRACO MANIPULADOR — um so para os tres. Nao entra em
 * `DIAMANDIS_PART_NAMES` porque nao e um modulo: nao solta, nao e carregado
 * por Coveiro e nao cai no chao. Ele so segura, larga e soca.
 */
export const DIAMANDIS_ARM_ATLAS = 'part-diamandis-arm';

/**
 * O encaixe do BRACO que serve cada modulo. Nao e o encaixe da ferramenta: o
 * rack e o mastro montam no TOPO da torre, e um braco nascendo la lia como
 * entulho no teto. Os bracos ficam presos ao deck — frente, direita, esquerda
 * — e dali alcancam a ferramenta que operam.
 */
export const DIAMANDIS_ARM_SOCKETS: readonly string[] = ['armFront', 'armRight', 'armLeft'];

export type DiamandisPartState = 'mounted' | 'loose' | 'gone';

/** O estado de uma peca a partir dos dois bitmasks autoritativos. */
export const diamandisPartState = (
  module: number,
  exposed: number,
  lost: number,
): DiamandisPartState => {
  const bit = 1 << module;
  if ((lost & bit) !== 0) return 'gone';
  if ((exposed & bit) !== 0) return 'loose';
  return 'mounted';
};

/**
 * Que animacao a peca mostra, dada a do chassi.
 *
 * Montada, ela SEGUE o chassi: ataca quando ele ataca, treme quando ele leva
 * o golpe. So a broca tem `special` (o giro da perfuracao); nas outras duas o
 * especial cai no ataque. Andar nao mexe a peca (ela e presa), e na morte a
 * peca nao e desenhada — o abate paga as pecas ainda presas em lasca, e o
 * voo da lasca e a leitura disso.
 *
 * Solta, ela tem vida propria (`loose`) qualquer que seja a pose do chassi.
 */
export const diamandisPartAnim = (
  state: DiamandisPartState,
  chassisAnim: string,
  module: number,
): string | null => {
  if (state === 'gone') return null;
  if (state === 'loose') return 'loose';
  switch (chassisAnim) {
    case 'attack':
      return 'attack';
    case 'special':
      return module === BOSS_MODULE_DRILL ? 'special' : 'attack';
    case 'hit':
      return 'hit';
    case 'die':
    case 'death':
      return null;
    default:
      return 'idle';
  }
};

/**
 * Quanto o maquinario sobrevivente ACELERA por peca arrancada.
 *
 * E um dos quatro sinais do frenesi, e o unico que so quem olha para o corpo
 * percebe: com duas pecas fora, a que sobrou gira 50% mais rapido. As pecas
 * soltas nao aceleram — o balanco delas e o telegrafo de que estao soltas, e
 * um telegrafo com velocidade variavel e mais dificil de ler.
 */
export const MACHINERY_SPEEDUP_PER_STACK = 0.25;

export const machineryClock = (elapsedMs: number, stacks: number): number =>
  elapsedMs * (1 + MACHINERY_SPEEDUP_PER_STACK * Math.max(0, stacks));

export type SocketPoint = { x: number; y: number; depth: number };

/**
 * Onde um encaixe cai na TELA, a partir do pe do sprite.
 *
 * O socket e publicado em pixels do quadro; o pe do sprite e a ancora. Um rumo
 * espelhado (par em `flipPairs`) nao tem socket proprio: o do rumo de origem e
 * refletido em torno da ancora, que e exatamente como `drawLoadedFrame`
 * posiciona o quadro espelhado.
 */
export const socketScreenPoint = (
  manifest: SpriteManifestEntry,
  dir: string,
  name: string,
  footX: number,
  footY: number,
  zoom: number,
): SocketPoint | null => {
  const own = manifest.sockets?.[dir]?.[name];
  if (own) {
    return {
      x: footX + (own.x - manifest.anchorX) * zoom,
      y: footY + (own.y - manifest.anchorY) * zoom,
      depth: own.depth ?? 0,
    };
  }
  const source = manifest.flipPairs[dir];
  const mirrored = source ? manifest.sockets?.[source]?.[name] : undefined;
  if (!mirrored) return null;
  return {
    x: footX - (mirrored.x - manifest.anchorX) * zoom,
    y: footY + (mirrored.y - manifest.anchorY) * zoom,
    depth: mirrored.depth ?? 0,
  };
};

/** O rumo de um manifest para um vetor de facing do mundo. */
export const manifestDir = (manifest: SpriteManifestEntry, fx: number, fy: number): string =>
  manifest.directions === 8 ? dirFromFacing8(fx, fy) : dirFromFacing(fx, fy);

export type DiamandisPartDraw = {
  module: number;
  atlas: string;
  anim: string;
  frame: number;
  x: number;
  y: number;
  /** Entra ANTES do chassi (esta atras dele neste rumo). */
  behind: boolean;
  /** Profundidade do encaixe em relacao ao centro do chassi (ver `SpriteSocket`). */
  depth: number;
};

export type ComposeArgs = {
  chassis: SpriteManifestEntry;
  /** Manifest de cada peca pelo indice de modulo; `null` enquanto nao carregou. */
  parts: readonly (SpriteManifestEntry | null)[];
  exposed: number;
  lost: number;
  chassisAnim: string;
  facingX: number;
  facingY: number;
  /** Relogio da animacao do chassi (desde o inicio da pose atual). */
  elapsedMs: number;
  /** Relogio de parede, para as pecas soltas. */
  nowMs: number;
  stacks: number;
  footX: number;
  footY: number;
  zoom: number;
  /**
   * A POSE DA BROCA escolhida pela fase do giro (drill-machine.ts). Quando
   * definida, a broca montada mostra o `special` neste quadro, seja qual for
   * a pose do chassi — o giro e um angulo integrado, nao uma animacao com
   * inicio e fim, e por isso nao pode vir do relogio da pose.
   */
  drillFrame?: number;
  /** O atlas do BRACO MANIPULADOR; `null` enquanto nao carregou. */
  arm?: SpriteManifestEntry | null;
  /**
   * O quadro do SOCO, quando ha um em curso (ver `pummelArmFrame`). Sem ele os
   * bracos livres ficam parados em `special` — a mao vazia, aberta.
   */
  pummelFrame?: number;
};

/** Quantos quadros tem o soco do braco. */
export const ARM_SWING_FRAMES = 4;

/**
 * O quadro do braco durante um SOCO, pelo relogio da acao autoritativa.
 *
 * Os dois primeiros quadros sao o aviso (o braco arma para tras) e ocupam o
 * windup inteiro, seja ele de 8 ou de 14 ticks — o soco de tres bracos avisa
 * menos tempo, e nao com menos quadros. Os dois ultimos sao a descida, e caem
 * no release: e o instante em que a simulacao cobra o dano.
 */
export const pummelArmFrame = (
  action: { kind: string; startedAt: number; releaseAt: number; endsAt: number } | undefined,
  tick: number,
): number | undefined => {
  if (!action || action.kind !== 'pummel') return undefined;
  if (tick < action.releaseAt) {
    const span = Math.max(1, action.releaseAt - action.startedAt);
    return (tick - action.startedAt) / span < 0.55 ? 0 : 1;
  }
  const span = Math.max(1, action.endsAt - action.releaseAt);
  const after = (tick - action.releaseAt) / span;
  return after < 0.5 ? 2 : 3;
};

/**
 * Monta a lista de pecas a desenhar em volta do chassi, ja em ORDEM: as de
 * tras primeiro (da mais funda para a mais rasa), depois as da frente.
 *
 * A ordem vem do `depth` do socket, e nao de uma tabela por rumo: e o mesmo
 * eixo (x + y do mundo) pelo qual o renderer ordena tudo, calculado pelo
 * gerador sobre o modelo rotacionado. Uma peca atras do centro do corpo entra
 * antes dele e o chassi a oculta onde os dois se cruzam.
 */
export const composeDiamandisParts = (args: ComposeArgs): DiamandisPartDraw[] => {
  const dir = manifestDir(args.chassis, args.facingX, args.facingY);
  const out: DiamandisPartDraw[] = [];
  for (let module = 0; module < DIAMANDIS_PART_NAMES.length; module++) {
    const manifest = args.parts[module];
    const atlas = diamandisPartAtlas(module);
    if (!manifest || !atlas) continue;
    const state = diamandisPartState(module, args.exposed, args.lost);
    const spun =
      args.drillFrame !== undefined && module === BOSS_MODULE_DRILL && state === 'mounted';
    const anim = spun ? 'special' : diamandisPartAnim(state, args.chassisAnim, module);
    if (!anim) continue;
    const socket = socketScreenPoint(
      args.chassis,
      dir,
      DIAMANDIS_PART_NAMES[module],
      args.footX,
      args.footY,
      args.zoom,
    );
    if (!socket) continue;
    // Solta, a peca vive no relogio de parede (o balanco e continuo e nao
    // pertence a pose do chassi); montada, segue o relogio da pose, acelerado
    // pelo frenesi.
    const clock =
      state === 'loose' ? args.nowMs + module * 173 : machineryClock(args.elapsedMs, args.stacks);
    out.push({
      module,
      atlas,
      anim,
      frame: spun ? (args.drillFrame as number) : frameAtTime(manifest, anim, clock),
      x: socket.x,
      y: socket.y,
      behind: socket.depth < 0,
      depth: socket.depth,
    });
  }
  // OS BRACOS: um por encaixe, porque e a mao que segura aquela ferramenta.
  //
  // Compartilham o encaixe com ela e entram um fio MAIS FUNDO (o `-0.01` no
  // depth), entao com a ferramenta montada o que se ve e a garra fechada em
  // volta dela. Arrancada a ferramenta, o que sobra no encaixe e a mao — e e
  // por isso que os bracos parecem "nascer" sem nunca terem sido acrescentados.
  if (args.arm) {
    const manifest = args.arm;
    for (let module = 0; module < DIAMANDIS_PART_NAMES.length; module++) {
      const socket = socketScreenPoint(
        args.chassis,
        dir,
        DIAMANDIS_ARM_SOCKETS[module],
        args.footX,
        args.footY,
        args.zoom,
      );
      if (!socket) continue;
      const free = (args.lost & (1 << module)) !== 0;
      // Mao ocupada: fechada na ferramenta. Mao livre: aberta, e capaz de socar.
      const anim = !free ? 'idle' : args.pummelFrame !== undefined ? 'attack' : 'special';
      const frame =
        free && args.pummelFrame !== undefined
          ? args.pummelFrame
          : frameAtTime(manifest, anim, args.nowMs + module * 211);
      out.push({
        module,
        atlas: DIAMANDIS_ARM_ATLAS,
        anim,
        frame,
        x: socket.x,
        y: socket.y,
        behind: socket.depth < 0,
        depth: socket.depth,
      });
    }
  }

  out.sort((a, b) => (a.behind !== b.behind ? (a.behind ? -1 : 1) : a.depth - b.depth));
  return out;
};

// ---------------------------------------------------------------------------
// O FRENESI, do lado de quem ve.
// ---------------------------------------------------------------------------

export type Tint = { color: string; alpha: number };

/**
 * Quanto o reator esta aceso alem do normal, 0..1. Tres pecas fora = 1. E o
 * numero que a arena mostra e que o tint abaixo usa.
 */
export const reactorIntensity = (stacks: number): number =>
  Math.max(0, Math.min(1, stacks / DIAMANDIS_PART_NAMES.length));

/**
 * O tint do chassi em frenesi: o vermelho-laranja do reator vazando pela
 * carcaca, pulsando mais rapido a cada peca perdida. Sem pecas perdidas nao
 * ha tint nenhum — o corpo normal e a arte, sem filtro.
 */
export const frenzyTint = (stacks: number, nowMs: number): Tint | undefined => {
  if (stacks <= 0) return undefined;
  const intensity = reactorIntensity(stacks);
  const pulse = 0.5 + 0.5 * Math.sin(nowMs * (0.004 + 0.003 * intensity));
  const alpha = 0.16 * intensity + 0.12 * intensity * pulse;
  return { color: `rgba(255,96,40,${alpha.toFixed(3)})`, alpha };
};

export type Twitch = { dx: number; dy: number };
export const NO_TWITCH: Twitch = { dx: 0, dy: 0 };

/** Quanto dura o solavanco do proprio arranque, em ms. */
export const RIP_JOLT_MS = 320;

const hash01 = (a: number, b: number): number => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul((b | 0) + 0x9e3779b9, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * OS ESPASMOS: o deslocamento do corpo neste instante, em pixels de zoom 1.
 *
 * Duas fontes. O ARRANQUE (`joltAt`) sacode forte e decai em 320 ms — e a
 * leitura fisica de "alguem acabou de arrancar um pedaco disto". E o
 * FRENESI, que vem em RAJADAS curtas e irregulares, nunca continuas: um
 * corpo tremendo sem parar e um filtro; um corpo que da uma sacudida a cada
 * dois segundos e uma maquina com defeito. Mais pecas fora = rajadas mais
 * frequentes, mais longas e mais fortes.
 *
 * Tudo deriva do relogio e da semente — duas maquinas desenham o mesmo
 * espasmo no mesmo instante. Com movimento reduzido nao ha espasmo nenhum:
 * o tint, a fumaca e o som continuam contando a mesma coisa.
 */
export const frenzyTwitch = (
  stacks: number,
  nowMs: number,
  seed: number,
  joltAt: number,
  reducedMotion: boolean,
): Twitch => {
  if (reducedMotion) return NO_TWITCH;
  let dx = 0;
  let dy = 0;
  const sinceJolt = nowMs - joltAt;
  if (sinceJolt >= 0 && sinceJolt < RIP_JOLT_MS) {
    const decay = 1 - sinceJolt / RIP_JOLT_MS;
    const amp = 3.2 * decay;
    dx += amp * Math.sin(sinceJolt * 0.11);
    dy += amp * 0.5 * Math.cos(sinceJolt * 0.17);
  }
  if (stacks > 0) {
    const period = 2400 - 500 * Math.min(3, stacks);
    const t = nowMs + seed * 137;
    const bucket = Math.floor(t / period);
    const phase = t - bucket * period;
    const burstMs = 130 + 45 * stacks;
    // ~70% dos ciclos tem rajada; o resto e silencio, para o ritmo nao virar
    // metronomo.
    if (phase < burstMs && hash01(bucket, seed) < 0.7) {
      const amp = 0.8 + 0.7 * stacks;
      const sign = hash01(bucket, seed ^ 0x5bd1e995) < 0.5 ? -1 : 1;
      // Alterna de lado a cada ~40 ms: e um TIQUE, nao um balanco.
      const step = Math.floor(phase / 40) % 2 === 0 ? 1 : -1;
      const fade = 1 - phase / burstMs;
      dx += amp * sign * step * fade;
      dy += amp * 0.35 * step * fade * (hash01(bucket, seed ^ 0x27d4eb2f) < 0.5 ? -1 : 1);
    }
  }
  return dx === 0 && dy === 0 ? NO_TWITCH : { dx, dy };
};

// ---------------------------------------------------------------------------
// A PECA NO CHAO e o voo da lasca.
// ---------------------------------------------------------------------------

/** Quanto tempo a peca leva para POUSAR (o quique) depois do carregador cair. */
export const FLOOR_LAND_MS = 180;
/** Quando ela ESTILHACA em lasca, medido do evento `dropped`. */
export const FLOOR_SHATTER_MS = 650;

export type FloorPiece = {
  module: number;
  x: number;
  y: number;
  startedAt: number;
  /**
   * A lasca que o evento `ore_gained` do MESMO tick entregou, ou `null` se ele
   * ainda nao chegou. A recompensa e autoritativa e imediata na simulacao; o
   * que atrasa e so o VOO dela, que sai da peca ao estilhacar e nao do corpo
   * do Coveiro.
   */
  ore: number | null;
};

/**
 * Altura da peca sobre o chao durante o pouso, em pixels de zoom 1.
 *
 * Cai do eletroima (que fica a meio corpo do Coveiro) e quica uma vez. Depois
 * disso esta no chao, e fica ate estilhacar.
 */
export const floorPieceLift = (ageMs: number): number => {
  if (ageMs < 0) return 14;
  if (ageMs >= FLOOR_LAND_MS) return 0;
  const t = ageMs / FLOOR_LAND_MS;
  // Queda ate 0.6 do tempo, quique ate o fim.
  if (t < 0.6) {
    const f = t / 0.6;
    return 14 * (1 - f * f);
  }
  const b = (t - 0.6) / 0.4;
  return 4 * Math.sin(b * Math.PI);
};

export type BossModuleEventLike = {
  module: number;
  x: number;
  y: number;
  state: 'exposed' | 'detached' | 'dropped' | 'lost';
};

/**
 * A MEMORIA do encontro do lado de quem desenha: as pecas caidas e o instante
 * do ultimo arranque. E memoria da RUN — `reset` a cada run nova.
 */
export class DiamandisPresentation {
  readonly floor: FloorPiece[] = [];
  /** Quando a ultima peca foi arrancada (para o solavanco). */
  joltAt = -1e9;

  onBossModule(event: BossModuleEventLike, nowMs: number): void {
    switch (event.state) {
      case 'detached':
        this.joltAt = nowMs;
        break;
      case 'dropped':
        // Uma peca por modulo: a mesma peca nao pode estar caida em dois
        // lugares, e um evento repetido (resync) so a move.
        this.removeFloor(event.module);
        this.floor.push({
          module: event.module,
          x: event.x,
          y: event.y,
          startedAt: nowMs,
          ore: null,
        });
        break;
      case 'lost':
        this.removeFloor(event.module);
        break;
      default:
        break;
    }
  }

  /**
   * Um `ore_gained` que chegou no MESMO ponto e no mesmo lote de eventos que
   * uma peca caiu e a lasca DELA: fica guardado para voar ao estilhacar em vez
   * de sair do corpo do Coveiro. Devolve `true` se foi absorvido.
   */
  claimOre(x: number, y: number, amount: number, nowMs: number): boolean {
    for (const piece of this.floor) {
      if (piece.ore !== null) continue;
      if (nowMs - piece.startedAt > 50) continue;
      if (Math.abs(piece.x - x) > 1e-6 || Math.abs(piece.y - y) > 1e-6) continue;
      piece.ore = amount;
      return true;
    }
    return false;
  }

  /** Remove e devolve as pecas que estilhacaram ate `nowMs`. */
  shattered(nowMs: number): FloorPiece[] {
    const out: FloorPiece[] = [];
    for (let i = this.floor.length - 1; i >= 0; i--) {
      const piece = this.floor[i];
      if (nowMs - piece.startedAt < FLOOR_SHATTER_MS) continue;
      out.push(piece);
      this.floor.splice(i, 1);
    }
    return out.reverse();
  }

  reset(): void {
    this.floor.length = 0;
    this.joltAt = -1e9;
  }

  private removeFloor(module: number): void {
    for (let i = this.floor.length - 1; i >= 0; i--) {
      if (this.floor[i].module === module) this.floor.splice(i, 1);
    }
  }
}
