// A COLUNA DO DEVORADOR — o corpo do verme, derivado do rastro da cabeca.
//
// A simulacao move UM ponto: a cabeca. Ela nao sabe que o bicho tem corpo, nao
// tem colisao para ele e nao gasta um byte de snapshot com ele — e isso e
// deliberado, nao uma pendencia. O corpo aqui e desenho: dez aneis pendurados
// no caminho que a cabeca ja percorreu, cada um no ponto que ela ocupava
// `k * PASSO` tiles atras.
//
// -----------------------------------------------------------------------
// POR QUE FOLLOW-THE-LEADER, E NAO VERLET NEM IK
// -----------------------------------------------------------------------
// As tres tecnicas desenham a mesma coisa quando a cabeca anda para a frente.
// Elas divergem no que fazem com o TEMPO: Verlet integra velocidade e
// aceleracao, entao o corpo depende de com que cadencia os quadros chegaram; IK
// resolve um alvo por iteracao, e o resultado depende de quantas iteracoes
// couberam no orcamento do quadro. Dois clientes da mesma sala de co-op rodam a
// quadros diferentes por definicao — um a 144 Hz num desktop, outro a 30 num
// celular — e os dois desenhariam vermes de formatos diferentes.
//
// Follow-the-leader amostra por COMPRIMENTO DE ARCO. O anel de posto `k` esta
// onde a cabeca esteve `k * PASSO` TILES atras, e essa e uma pergunta sobre a
// trajetoria e nao sobre o relogio: a mesma trajetoria devolve os mesmos dez
// pontos em qualquer taxa de quadros, e a coluna nunca estica nem encolhe
// porque o comprimento e a propria unidade da amostragem.
//
// -----------------------------------------------------------------------
// O MERGULHO
// -----------------------------------------------------------------------
// A elevacao viaja no rastro junto com a posicao, e e dai que sai o
// paraboloide. Quando a cabeca cai do salto e crava na areia, a elevacao dela
// ja e zero — mas os aneis atras dela ainda estao lendo a elevacao que ela
// tinha meio segundo antes, no meio do arco. O resultado e o bicho ENTRANDO no
// chao com a cauda ainda no ar, que e o que uma parabola faz e que nenhum
// sprite unico consegue desenhar.
//
// Nao ha nada de especial no codigo para isso: e so a consequencia de a
// elevacao ser amostrada pelo mesmo arco que a posicao.
import {
  DEVOURER_AIRBORNE,
  DEVOURER_ERUPT_WINDUP_TICKS,
  DEVOURER_MAW,
  DEVOURER_SURFACED,
} from '@voxelyn/survival-sim';
import { LEAP_PEAK_PX } from './leap-arc';

/** Quantos aneis o corpo tem. Igual a contagem de quadros do atlas do anel. */
/** Prende um numero em 0..1. */
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const DEVOURER_SEGMENTS = 10;

/**
 * Passo entre aneis, em tiles.
 *
 * O anel e autorado com 5,2 unidades de comprimento, e 8 unidades autoradas sao
 * um tile: a caixa mede 0,65 tile. A 0,52 de passo sobra 0,13 tile de
 * sobreposicao — e a sobreposicao e obrigatoria, nao folga: com passo igual ao
 * comprimento a fila abre vao a cada curva (o lado de fora de uma coluna torta
 * anda mais que o passo) e o verme vira um trenzinho. O comentario dos aneis do
 * sprite antigo ja avisava disso; aqui o erro seria dez vezes mais visivel.
 */
export const DEVOURER_SEGMENT_GAP = 0.52;

/**
 * Onde o primeiro anel se encaixa, em tiles atras da ancora da cabeca.
 *
 * O sprite da cabeca termina em x = -5,4 autorado (-0,675 tile) e o anel tem
 * meio comprimento de 0,325: encostados, o centro do anel cairia em -0,35. A
 * 0,5 ele entra 0,15 tile POR BAIXO do colar — a costura entre os dois atlas
 * fica escondida sob o ultimo anel do pescoco, que e o unico lugar onde ela nao
 * aparece.
 */
export const DEVOURER_HEAD_OFFSET = 0.5;

/**
 * O que o corpo ocupa ALEM do ultimo anel, em tiles: meio anel de cauda para
 * tras (a caixa mede 5,2 unidades autoradas, e 8 unidades sao um tile) mais o
 * focinho para a frente da ancora.
 *
 * Existe como constante e nao como numero solto porque a SIMULACAO depende
 * dele. Ela nao tem corpo — move e testa um ponto so — mas precisa saber quanto
 * o corpo leva para seguir a cabeca para dentro do buraco, que e o vao entre o
 * terceiro pouso e a boca abrir (`DEVOURER_MAW_BURY_TICKS`). O comprimento
 * inteiro sai daqui, e ha um teste que cobra a igualdade dos dois lados.
 */
export const DEVOURER_TAIL_TILES = 0.325 + 0.24;

/**
 * Distancia minima entre duas amostras do rastro, em tiles.
 *
 * E a resolucao da curva, e ela custa memoria por quadro: o rastro inteiro
 * cobre ~5,2 tiles, entao a 0,12 sao ~44 amostras por chefe. Mais fino nao
 * melhora o desenho (o passo entre aneis e quatro vezes maior) e mais grosso
 * faz a curva virar poligono nas viradas fechadas do bote.
 */
export const DEVOURER_TRAIL_STEP = 0.12;

/**
 * A que profundidade o bicho anda quando esta ENTERRADO, em pixels logicos
 * (antes do zoom), medida para BAIXO a partir da linha do chao.
 *
 * Na mesma unidade de `LEAP_PEAK_PX` de proposito: a altura do salto e a
 * profundidade do mergulho sao o mesmo eixo, e escrever uma em tiles e outra em
 * pixels obrigaria uma conversao no meio do arco — justamente onde as duas se
 * encontram.
 *
 * O numero saiu de uma medida do proprio sprite, e nao de gosto. A cabeca tem
 * 25,5 px logicos acima da ancora e o anel de posto 0 tem 15; a 11 de
 * afundamento sobram ~14 px de cabeca e ~4 px do primeiro anel acima da areia,
 * e a cauda desaparece. O que se ve e uma CRISTA cortando a areia e afinando
 * para tras, que e a leitura que o humor `burrowed` sempre prometeu e nunca
 * teve: ate aqui ele passeava pelo chao com o corpo inteiro de fora.
 *
 * ESTA E A PROFUNDIDADE DE CRISTA, e nao a de sumico. Ela vale enquanto ele
 * espera de boca aberta — a cratera dentada precisa ficar na superficie, porque
 * ELA e a janela. Entre um arco e o seguinte ele vai fundo, ate
 * `DEVOURER_HIDDEN_PX`, e ai nao sobra crista nenhuma: ver `devourerSubmergence`.
 */
export const DEVOURER_SUBMERGED_PX = 11;

/**
 * A profundidade em que ele SOME, em pixels logicos.
 *
 * Um verme de areia que pousa e fica deslizando com a crista de fora nao entrou
 * em lugar nenhum: o pouso e o mergulho, e o proximo arco e uma emergencia em
 * OUTRO lugar. A simulacao ja fazia a metade disso — ela realoca o corpo para o
 * ponto de decolagem no instante em que arma a erupcao — mas com o bicho a 11 px
 * de profundidade aquela realocacao era um TELEPORTE a vista, e o resto do
 * intervalo era uma lombada passeando pela areia.
 *
 * O numero e medido e nao escolhido: para nao sobrar um pixel, a ancora tem de
 * afundar a altura inteira do quadro. A cabeca mede 152 px de quadro contra 58
 * do anel, entao e ela quem manda; e como o desenho multiplica por `z` enquanto
 * o sprite escala por `spriteZoom`, o pior caso e o zoom estreito (z = 1,6 com
 * `spriteZoom` = 1): 152 / 1,6 = 95. `hidden-depth` guarda essa conta contra os
 * dois manifestos.
 *
 * O que isso CUSTA esta dito de proposito: enterrado ele tem 12% de armadura, e
 * enquanto estiver sumido ele nao e alvo de mira nenhuma (ver `hasVisibleBody`
 * em `combat-assist.ts`). O contra-jogo do intervalo enterrado nunca foi
 * atirar — e vitrificar a areia por onde o rastro passa, para que ele nao possa
 * emergir. Sumir torna esse recado mais claro, nao menos.
 */
export const DEVOURER_HIDDEN_PX = 95;

/**
 * Quanto o CORPO VIVO desce abaixo da propria ancora, em pixels de atlas.
 *
 * E onde a linha da areia passa: afundado `d`, o que fica visivel e o que esta
 * acima de `ancora + isto`. O numero e medido nos quadros, e nao no tamanho do
 * quadro — e a diferenca importa, porque o quadro da cabeca tem 48 px abaixo da
 * ancora e quase todos sao FOLGA. Quem os ocupa e a pose de boca aberta (a
 * cratera desce 40), e ela e autorada para ficar no chao; as poses vivas
 * (parado, andando, atacando, apanhando, morrendo) descem no maximo 11.
 *
 * Cortar pelo tamanho do quadro punha a linha 37 px baixa demais, e o resultado
 * era um verme desenhado por cima do chao a frente dele — de pe, boiando, em vez
 * de saindo da areia.
 *
 * O anel do corpo chega ao mesmo 11 por outro caminho (`frameHeight - anchorY`
 * do atlas dele), e os dois usarem o mesmo numero nao e coincidencia: e a mesma
 * pergunta — onde este bicho encosta no chao.
 */
export const DEVOURER_BELOW_ANCHOR_PX = 11;

/**
 * Quantos ticks a cabeca leva para sumir depois do pouso.
 *
 * Igual ao windup da erupcao de proposito: ele entra na areia com a mesma
 * pressa com que sai dela. A simetria nao e enfeite — e o que faz o intervalo
 * enterrado ter um comeco e um fim legiveis, com o mesmo peso nos dois. E o
 * numero nao e inventado aqui: e o vao do telegrafo que a simulacao ja usa.
 *
 * Cabe no intervalo: 24 ticks de descida + 21 sumido + 24 de subida, contra os
 * 45 de `DEVOURER_HOP_GAP_TICKS` mais os 24 do proprio windup.
 */
export const DEVOURER_DIVE_TICKS = DEVOURER_ERUPT_WINDUP_TICKS;

/**
 * Amplitude da ondulacao lateral, em tiles, e quantas ondas cabem no corpo.
 *
 * A ondulacao NAO esta no atlas, e a ausencia e a decisao: um anel que ondulasse
 * por conta propria brigaria com a curva do rastro — duas fontes de forma para o
 * mesmo corpo, desalinhadas por construcao. Aqui ela e um deslocamento
 * PERPENDICULAR ao caminho, entao ela deforma a curva em vez de competir com
 * ela, e some sozinha quando a cabeca esta parada porque e o arco que a indexa.
 */
export const DEVOURER_SWAY = 0.13;
export const DEVOURER_SWAY_WAVES = 1.6;
/** Ciclos por segundo da ondulacao. Devagar: e um corpo pesado, nao um chicote. */
export const DEVOURER_SWAY_HZ = 0.55;

/**
 * Salto de posicao acima do qual o rastro e jogado fora, em tiles.
 *
 * Um snapshot perdido, um `respawn` ou a troca de sala entregam a cabeca a dez
 * tiles do ultimo quadro, e arrastar o corpo por essa reta desenharia um verme
 * de vinte tiles atravessando o mapa. Tres tiles e mais que qualquer coisa que
 * a cabeca faz num quadro (ela anda no maximo 9 tiles/s) e menos que qualquer
 * teleporte.
 */
const TELEPORT_TILES = 3;

/** Um ponto do rastro, com a distancia acumulada ate a cabeca. */
type Sample = { x: number; y: number; liftPx: number; back: number };

/** Um anel resolvido, pronto para desenhar. */
export type SpineNode = {
  x: number;
  y: number;
  /** Elevacao em pixels logicos: positiva no ar, negativa enterrado. */
  liftPx: number;
  /** A tangente do caminho ali — e a direcao que escolhe o quadro do atlas. */
  dirX: number;
  dirY: number;
  /** 0 = colado no pescoco, `DEVOURER_SEGMENTS - 1` = ponta da cauda. */
  rank: number;
};

export type SpineHead = {
  x: number;
  y: number;
  liftPx: number;
  dirX: number;
  dirY: number;
};

const norm = (x: number, y: number): { x: number; y: number } => {
  const m = Math.hypot(x, y);
  return m > 1e-6 ? { x: x / m, y: y / m } : { x: 0, y: 1 };
};

/** Comprimento total de rastro que os aneis chegam a consultar. */
const SPAN = DEVOURER_HEAD_OFFSET + (DEVOURER_SEGMENTS - 1) * DEVOURER_SEGMENT_GAP;

/**
 * O rastro de cada Devorador vivo na sala.
 *
 * Guarda estado entre quadros porque o rastro E o estado: a forma do corpo agora
 * depende de por onde a cabeca andou, e isso e uma coisa que so quem viu os
 * quadros anteriores sabe. Nada disto viaja pela rede nem entra em hash.
 */
export class DevourerSpines {
  private readonly trails = new Map<number, Sample[]>();

  reset(): void {
    this.trails.clear();
  }

  /** Esquece os chefes que nao estao mais na cena (morte, fim de setor). */
  keepOnly(live: ReadonlySet<number>): void {
    for (const id of this.trails.keys()) if (!live.has(id)) this.trails.delete(id);
  }

  /**
   * Registra onde a cabeca esta e devolve os dez aneis.
   *
   * Uma chamada por quadro e por chefe: ela avanca o rastro E o le, porque as
   * duas coisas tem de ver a mesma cabeca — separa-las abriria a porta para o
   * desenho de um quadro usar o rastro do seguinte.
   */
  follow(id: number, head: SpineHead, nowMs: number): SpineNode[] {
    const trail = this.advance(id, head);
    return this.read(trail, head, nowMs);
  }

  private advance(id: number, head: SpineHead): Sample[] {
    let trail = this.trails.get(id);
    if (trail && trail.length > 0) {
      const first = trail[0];
      if (Math.hypot(head.x - first.x, head.y - first.y) > TELEPORT_TILES) trail = undefined;
    }
    if (!trail || trail.length === 0) {
      // NASCE RETO, atras da cabeca. A alternativa — nascer vazio e deixar o
      // corpo se montar conforme ele anda — desenharia uma cabeca solta no
      // primeiro segundo de cada encontro, que e exatamente o segundo em que o
      // jogador esta decidindo o que aquilo e.
      const back = norm(-head.dirX, -head.dirY);
      trail = [];
      for (let d = 0; d <= SPAN + DEVOURER_TRAIL_STEP; d += DEVOURER_TRAIL_STEP) {
        trail.push({ x: head.x + back.x * d, y: head.y + back.y * d, liftPx: head.liftPx, back: d });
      }
      this.trails.set(id, trail);
      return trail;
    }

    const step = Math.hypot(head.x - trail[0].x, head.y - trail[0].y);
    if (step >= DEVOURER_TRAIL_STEP) {
      // A distancia de todo mundo ate a cabeca cresceu pelo tanto que ela andou.
      for (const s of trail) s.back += step;
      trail.unshift({ x: head.x, y: head.y, liftPx: head.liftPx, back: 0 });
      // Corta o que ja passou do ultimo anel. Uma amostra de folga para a
      // interpolacao do ultimo posto ter os dois extremos.
      let cut = trail.length;
      while (cut > 2 && trail[cut - 2].back > SPAN) cut--;
      if (cut < trail.length) trail.length = cut;
    } else {
      // A cabeca mal se mexeu, mas ela pode ter SUBIDO — o arco do salto muda a
      // elevacao sem mudar a posicao no comeco e no fim. A amostra mais nova
      // acompanha, senao o inicio do arco ficaria travado no chao.
      trail[0].liftPx = head.liftPx;
    }
    return trail;
  }

  private read(trail: Sample[], head: SpineHead, nowMs: number): SpineNode[] {
    const nodes: SpineNode[] = [];
    for (let k = 0; k < DEVOURER_SEGMENTS; k++) {
      const want = DEVOURER_HEAD_OFFSET + k * DEVOURER_SEGMENT_GAP;
      const at = sampleAt(trail, head, want);
      // A TANGENTE sai de uma corda curta em volta do ponto, e nao do vizinho
      // imediato: entre duas amostras a 0,12 tile o angulo e ruidoso, e a
      // direcao escolhe o quadro do atlas — um anel oscilando entre duas
      // direcoes autoradas pisca a cada quadro.
      const ahead = sampleAt(trail, head, Math.max(0, want - DEVOURER_SEGMENT_GAP * 0.5));
      const behind = sampleAt(trail, head, want + DEVOURER_SEGMENT_GAP * 0.5);
      const dir = norm(ahead.x - behind.x, ahead.y - behind.y);
      // A ondulacao empurra o anel para o LADO do caminho. Indexada pelo arco
      // (`want`) e nao pelo indice do anel: assim a onda fica presa ao CORPO e
      // nao a fila, e continua no mesmo lugar do bicho quando ele acelera.
      const phase = want * DEVOURER_SWAY_WAVES * Math.PI * 2 - (nowMs / 1000) * DEVOURER_SWAY_HZ * Math.PI * 2;
      // Some na cabeca e cresce para a cauda: um verme balanca a ponta, nao o
      // pescoco — e sem isso o primeiro anel se descolaria lateralmente do
      // sprite da cabeca, que nao ondula.
      const grow = k / (DEVOURER_SEGMENTS - 1);
      const sway = Math.sin(phase) * DEVOURER_SWAY * grow;
      nodes.push({
        x: at.x - dir.y * sway,
        y: at.y + dir.x * sway,
        liftPx: at.liftPx,
        dirX: dir.x,
        dirY: dir.y,
        rank: k,
      });
    }
    return nodes;
  }
}

/**
 * O ponto a `want` tiles de rastro atras da cabeca, interpolado.
 *
 * Interpolar (em vez de pegar a amostra mais proxima) e o que tira o degrau: sem
 * isso cada anel SALTA 0,12 tile toda vez que uma amostra nova entra, e dez
 * aneis saltando juntos a cada 25 ms leem como tremor.
 *
 * Exportada porque o teste precisa medir a curva sem montar uma classe.
 */
export const sampleAt = (
  trail: ReadonlyArray<Sample>,
  head: SpineHead,
  want: number
): { x: number; y: number; liftPx: number } => {
  if (trail.length === 0 || want <= 0) return { x: head.x, y: head.y, liftPx: head.liftPx };
  for (let i = 0; i < trail.length - 1; i++) {
    const a = trail[i];
    const b = trail[i + 1];
    if (want <= b.back) {
      const span = b.back - a.back;
      const t = span > 1e-6 ? (want - a.back) / span : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        liftPx: a.liftPx + (b.liftPx - a.liftPx) * t,
      };
    }
  }
  // Alem do fim do rastro: fica na ultima amostra em vez de extrapolar. Um
  // rastro curto (o chefe acabou de nascer) tem de amontoar a cauda, e nao
  // inventar caminho que ele nunca andou.
  const last = trail[trail.length - 1];
  return { x: last.x, y: last.y, liftPx: last.liftPx };
};

/**
 * QUANTO DELE ESTA ABAIXO DA AREIA: 0 na superficie, 1 sumido de vez.
 *
 * Uma fracao e nao pixels porque quem a le sao duas coisas com escalas
 * diferentes — a altura da cabeca e a decisao de continuar sendo alvo — e as
 * duas tem de mudar juntas. Um pixel a mais de afundamento sem tirar a mira
 * deixaria o auto-alvo grudado num bicho que ninguem ve.
 *
 * As tres entradas sao AUTORITATIVAS ou derivadas de estado autoritativo:
 *
 * - `mood` viaja no snapshot;
 * - `eruptProgress01` sai da acao de erupcao, que tambem viaja (o cliente ja lia
 *   `startedAt`/`releaseAt` dela para o arco);
 * - `sinceLandingTicks` e a unica coisa contada no cliente, e por isso o unico
 *   caso que pede um recuo: quem entra na sala com o chefe ja enterrado nao viu
 *   o pouso, e o recuo e SUMIDO. Errar para o lado de escondido e o certo — o
 *   erro contrario e desenhar meio verme boiando na areia por um segundo.
 */
export const devourerSubmergence = (
  mood: number | undefined,
  sinceLandingTicks: number | null,
  eruptProgress01: number | null,
): number => {
  // Sem humor ele nao e o Devorador: o recuo nao inventa postura, e o resto do
  // bestiario anda na superficie. `DEVOURER_SURFACED` e do LEVIATA — as
  // constantes de humor sao uma numeracao so, compartilhada entre os chefes que
  // mergulham, e o Devorador nunca assume esse.
  if (mood === undefined || mood === DEVOURER_SURFACED) return 0;
  // NO AR o corpo esta fora da areia por definicao, e o arco cuida da altura.
  if (mood === DEVOURER_AIRBORNE) return 0;
  // DE BOCA ABERTA ele volta a profundidade de crista, e nao ao sumico: a
  // cratera dentada E a janela de dano, e uma janela que ninguem ve nao e uma
  // janela. E o desenho dela ja e o do sprite, que so funciona nessa altura.
  if (mood === DEVOURER_MAW) return DEVOURER_SUBMERGED_PX / DEVOURER_HIDDEN_PX;
  // ENTERRADO, e as duas metades do intervalo:
  //
  // A ERUPCAO ARMADA tem prioridade porque ela e o que vem depois — enquanto o
  // telegrafo corre, ele esta SUBINDO, e continuar a contar a descida do pouso
  // desenharia um bicho afundando enquanto o aviso promete que ele vai sair.
  if (eruptProgress01 !== null) return 1 - clamp01(eruptProgress01);
  if (sinceLandingTicks === null) return 1;
  return clamp01(sinceLandingTicks / DEVOURER_DIVE_TICKS);
};

/**
 * A elevacao da CABECA, em pixels logicos. E a unica entrada de altura do corpo
 * inteiro: os aneis nao consultam humor nenhum, eles herdam esta mesma medida
 * pelo rastro, atrasada pelo arco que ja percorreram.
 *
 * `leapHeight01` e o que `leap-arc.ts` devolve — 0 nas duas pontas do arco, 1
 * no apice — e a interpolacao parte do CHAO EM QUE ELE ESTA, e nao de zero.
 *
 * `submerged01` nao tem valor padrao de proposito. Um padrao aqui seria uma
 * quarta resposta para "onde ele esta", concorrendo com `devourerSubmergence`,
 * e a errada em metade dos casos: 0 desenharia o chefe boiando entre os arcos e
 * 1 enterraria todo bicho sem humor que passasse por esta funcao.
 *
 * As duas pontas do arco FECHAM sozinhas, e e por isso que nao ha estalo em
 * lugar nenhum do ciclo: o windup da erupcao termina com `submerged01` em 0, que
 * e onde o arco comeca; e o arco termina em 0, que e onde a descida do pouso
 * comeca. Cada transicao encontra a anterior no mesmo pixel.
 */
export const devourerHeadLiftPx = (
  mood: number | undefined,
  leapHeight01: number,
  submerged01: number,
): number => {
  const ground = -DEVOURER_HIDDEN_PX * clamp01(submerged01);
  const h = clamp01(leapHeight01);
  return ground + (LEAP_PEAK_PX - ground) * h;
};
