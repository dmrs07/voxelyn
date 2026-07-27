// Particulas voxel: gas, fogo, explosao e descarga desenhados como cubinhos do
// MESMO tamanho de voxel que blocos e criaturas.
//
// Por que voxel e nao circulos alfa: o resto do jogo e facetado e de alpha
// binario, entao nuvem redonda e translucida destoa na hora. Alem disso o
// contrato dos atlas e alpha binario — nuvem translucida teria de virar um
// sistema de FX a parte de qualquer jeito, entao ela ja nasce aqui.
//
// Tudo aqui e COSMETICO. As particulas nascem de eventos semanticos
// autoritativos e nunca alteram a simulacao: o cliente nao decide que houve
// explosao, so a desenha. Duas maquinas no co-op recebem o mesmo evento e
// semeiam o mesmo burst, entao veem a mesma coisa sem trocar um byte a mais.

import { ABILITY_RADIUS, SOLID_CRYSTAL } from '@voxelyn/survival-sim';
import type { FaceRamp } from './voxel-draw';
import { drawVoxel } from './voxel-draw';
import type { SemanticEvent } from '@voxelyn/survival-sim';

export type ParticleKind =
  | 'ember'
  | 'gas'
  | 'debris'
  | 'spark'
  | 'rubble'
  | 'crystalShard'
  | 'acidDrip'
  | 'oreChip'
  | 'shock'
  | 'ash'
  | 'chitin'
  | 'spore'
  | 'stone';

type Particle = {
  x: number; // tile
  y: number;
  z: number; // altura em tiles (0 = chao)
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  kind: ParticleKind;
  /**
   * Frente que PROMETE um alcance: nao freia, nao cai, e anda pelo tempo real
   * decorrido.
   *
   * E propriedade da particula, nao do tipo. Amarrar isto ao `kind` foi o erro:
   * so `shock` era isento, entao o anel do pulso — que e `spark` porque o pulso
   * nao tem fogo — freava e caia, e parava a 79% do raio que a simulacao
   * aplica. A cor da frente e a fisica dela sao decisoes independentes.
   */
  ballistic?: boolean;
};

/**
 * Rampa de faces por tipo: [topo, esquerda, direita].
 *
 * Antes era uma lista de cores por idade e a particula saia num retangulo
 * chapado. Agora as tres entradas sao as tres FACES do voxel, entao a materia
 * no ar tem o mesmo volume facetado que o bloco e a criatura — o retangulo liso
 * denunciava o truque justamente nos momentos de maior atencao, a explosao.
 */
const RAMP: Record<ParticleKind, FaceRamp> = {
  ember: ['#ffd166', '#ff7a2f', '#d93b4c'],
  // Enxofre, e nao mais verde-limao: o mote sobe DE DENTRO da crosta de gas, e
  // a crosta virou amarela. Verde sobre amarelo lia como duas materias
  // diferentes empilhadas na mesma celula. O limao continua sendo o acido do
  // cuspidor logo abaixo, que e outra coisa e deve continuar parecendo outra.
  gas: ['#ffd166', '#a8e63c', '#1f3d33'],
  debris: ['#46566e', '#2e3a4d', '#1d2430'],
  spark: ['#e8f1ff', '#7ab8ff', '#2e3a4d'],
  // Materiais de bloco: os cacos saem da MESMA paleta com que o bloco foi
  // renderizado, senao o entulho nao parece feito da pedra que acabou de cair.
  rubble: ['#6e4a33', '#46566e', '#2e3a4d'],
  crystalShard: ['#59f2c2', '#2f6b4f', '#1f3d33'],
  // Corrosao pinga; lasca de minerio salta.
  acidDrip: ['#a8e63c', '#2f6b4f', '#1f3d33'],
  oreChip: ['#ffd166', '#6e4a33', '#2e3a4d'],
  // Frente de choque: o topo quase branco e o que a separa da brasa comum a
  // distancia, e a distancia e onde ela importa — e ela que desenha ate onde o
  // estrago chega.
  shock: ['#e8f1ff', '#ffd166', '#ff7a2f'],
  // Fumaca: um passo de valor acima do fundo, nunca mais. Ela existe para dar
  // duracao a explosao depois que o clarao passa, nao para tapar a tela.
  ash: ['#2e3a4d', '#1d2430', '#0b0e14'],
  // Materia de criatura, para o respingo do acerto.
  chitin: ['#d93b4c', '#6e4a33', '#2e3a4d'],
  spore: ['#66c28a', '#2f6b4f', '#1f3d33'],
  stone: ['#b8a98f', '#46566e', '#2e3a4d'],
};

/**
 * De que materia cada criatura e feita, para o respingo do acerto.
 *
 * DESCRITIVO, nao prescritivo: diz o que foi ATINGIDO, nunca que aquele tipo de
 * tiro e o counter daquele bicho. A distincao importa e nao e detalhe — os
 * inimigos tem pontos fracos DESENHADOS (o nucleo eletrico exposto do bruiser,
 * a vagem que incha no bomber) que a simulacao ainda ignora. Um respingo que
 * insinuasse fraqueza ensinaria uma licao falsa: o jogador testaria e
 * descobriria que era decoracao. Num jogo que promete ser dificil mas legivel,
 * isso e pior do que o acerto generico que havia antes.
 *
 * Sai do arquetipo, que o cliente ja recebe no snapshot — nenhum dado novo no
 * protocolo, nenhuma mudanca na simulacao.
 */
const HIT_MATERIAL: Record<string, ParticleKind> = {
  stalker: 'chitin',
  spitter: 'spore',
  bomber: 'spore',
  bruiser: 'stone',
  guardian: 'stone',
  prospector: 'stone',
};

export const hitMaterialOf = (archetype: string | undefined): ParticleKind =>
  (archetype !== undefined && HIT_MATERIAL[archetype]) || 'debris';

/**
 * PRNG barata semeada por evento. Nao precisa da qualidade da RNG da simulacao
 * — nada aqui e autoritativo — mas precisa ser DETERMINISTA por evento, para os
 * dois clientes de uma sala verem o mesmo estilhaco.
 */
const seeded = (seed: number) => {
  let s = (seed | 0) || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
};

const eventSeed = (x: number, y: number, salt: number): number =>
  Math.imul(Math.round(x * 16) | 0, 374761393) ^ Math.imul(Math.round(y * 16) | 0, 668265263) ^ salt;

/**
 * Tempo decorrido do frame, em ms, a partir do relogio do render.
 *
 * O render roda em requestAnimationFrame, entao passar um passo fixo de 16.7ms
 * amarra a fisica das particulas a taxa de atualizacao do monitor: a 120Hz um
 * mote de 900ms durava 450ms reais e caia pela metade da distancia; a 30Hz
 * durava 1.8s e voava o dobro. O passo tem de vir do relogio.
 *
 * O teto de 100ms existe para a aba voltar do segundo plano sem teleportar todo
 * mundo; a vida, essa, consome o tempo real, entao o que ficou velho durante a
 * pausa expira como deve.
 */
export const FALLBACK_FRAME_MS = 16.7;
export const frameDeltaMs = (lastMs: number, nowMs: number): number => {
  if (!Number.isFinite(lastMs) || lastMs <= 0) return FALLBACK_FRAME_MS;
  const dt = nowMs - lastMs;
  if (!(dt > 0)) return FALLBACK_FRAME_MS;
  return Math.min(100, dt);
};

export class VoxelParticles {
  private items: Particle[] = [];
  /**
   * Ultimo bucket de tempo em que cada celula emitiu gas. Limitado ao numero de
   * celulas do mundo, entao nao cresce sem teto.
   */
  private readonly lastGasBucket = new Map<number, number>();
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */
  budget = 240;

  get count(): number { return this.items.length; }

  clear(): void {
    this.items.length = 0;
    this.lastGasBucket.clear();
  }

  private push(p: Particle): void {
    // Descarta o mais VELHO, nao o novo: um burst recente e o que o jogador
    // esta olhando, e cortar a cauda deixaria a explosao pela metade.
    if (this.items.length >= this.budget) this.items.shift();
    this.items.push(p);
  }

  private burst(
    x: number,
    y: number,
    kind: ParticleKind,
    count: number,
    speed: number,
    lift: number,
    life: number,
    salt: number
  ): void {
    const rnd = seeded(eventSeed(x, y, salt));
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const mag = speed * (0.35 + rnd() * 0.65);
      this.push({
        x, y,
        z: 0.12 + rnd() * 0.25,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        vz: lift * (0.4 + rnd() * 0.9),
        life: life * (0.6 + rnd() * 0.6),
        maxLife: life,
        kind,
      });
    }
  }

  /**
   * Frente de choque: anel de voxels rasteiros que chega ao raio REAL do evento
   * no instante em que se apaga.
   *
   * Substitui uma elipse tracada com `ctx.stroke` — a ultima linha 2D de um jogo
   * feito de cubos, e logo no efeito que o jogador mais olha. Mas o motivo nao e
   * so de acabamento: a explosao antiga so lancava brasas do centro com
   * velocidade solta, e nada na tela dizia ATE ONDE ela machucava. Aqui a
   * velocidade e derivada do raio e da vida, entao a materia para exatamente na
   * borda do estrago e o jogador aprende o alcance vendo, sem numero nem manual.
   *
   * Os angulos sao distribuidos por igual e so entao sacudidos: sorteando cada
   * um, o anel sai com buracos e aglomerados e deixa de ler como uma frente.
   */
  private ring(
    x: number,
    y: number,
    kind: ParticleKind,
    count: number,
    radius: number,
    life: number,
    salt: number
  ): void {
    const rnd = seeded(eventSeed(x, y, salt));
    const speed = radius / (life / 1000);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      // O tremor so tira velocidade, nunca acrescenta: a frente e um
      // INDICADOR de alcance, e a particula mais externa nao pode passar do
      // raio real. Prometer menos que a simulacao entrega e seguro; prometer
      // mais mata o jogador que confiou na borda que viu.
      const mag = speed * (0.82 + rnd() * 0.18);
      this.push({
        x, y,
        z: 0.06 + rnd() * 0.1,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag,
        vz: 0,
        life,
        maxLife: life,
        kind,
        ballistic: true,
      });
    }
  }

  /**
   * Traduz eventos autoritativos em particulas. `scale` vem da qualidade: no
   * preset baixo o mesmo evento gera menos materia, nunca eventos diferentes.
   */
  ingest(events: readonly SemanticEvent[], worldWidth: number, scale: number): void {
    const n = (base: number) => Math.max(1, Math.round(base * scale));
    for (const ev of events) {
      switch (ev.t) {
        case 'explosion':
          // Quatro camadas com papeis distintos, e nao quatro variacoes da mesma
          // coisa: a frente diz ATE ONDE, a brasa e o entulho dizem QUE forca, e
          // a fumaca segura a leitura no lugar depois que as tres apagam. So com
          // as duas do meio a explosao acendia e sumia no mesmo quadro.
          this.ring(ev.x, ev.y, 'shock', Math.max(8, n(18)), ev.radius, 300, 1);
          this.burst(ev.x, ev.y, 'ember', n(14), 2.4 * ev.radius * 0.4, 2.2, 520, 2);
          this.burst(ev.x, ev.y, 'debris', n(10), 3.0 * ev.radius * 0.4, 1.1, 700, 3);
          this.burst(ev.x, ev.y, 'ash', n(7), 0.7, 1.4, 1500, 4);
          break;
        case 'pulse':
          // Pulso cinetico: mesma frente, sem fogo. O que ele empurra e ar.
          // O raio vem da constante da simulacao, nao de um numero copiado: a
          // frente promete um alcance ao jogador, e uma copia que envelhece
          // transforma essa promessa em mentira no primeiro ajuste de balanco.
          this.ring(ev.x, ev.y, 'spark', Math.max(6, n(14)), ABILITY_RADIUS, 260, 5);
          break;
        case 'ignite':
          // Sais distintos por evento, mesmo entre eventos de tipos diferentes:
          // uma explosao ACENDE as celulas que alcanca, entao explosao e ignicao
          // caem no mesmo ponto no mesmo instante, e com o mesmo sal sairiam com
          // o mesmo sorteio — a brasa da ignicao nasceria colada na da explosao.
          this.burst(ev.x, ev.y, 'ember', n(4), 0.5, 1.6, 420, 31);
          break;
        case 'discharge':
          for (const cell of ev.cells.slice(0, Math.max(4, n(16)))) {
            const cx = (cell % worldWidth) + 0.5;
            const cy = Math.floor(cell / worldWidth) + 0.5;
            this.burst(cx, cy, 'spark', n(2), 1.6, 2.6, 240, cell);
          }
          break;
        case 'break': {
          // O bloco se desfaz no PROPRIO material. O evento carrega qual era,
          // porque quando ele chega a grade ja mudou e o cliente nao teria mais
          // como saber o que caiu ali.
          const kind: ParticleKind = ev.solid === SOLID_CRYSTAL ? 'crystalShard' : 'rubble';
          // Poucos cacos POR bloco de proposito: uma explosao derruba dezenas
          // de celulas de uma vez, e 12 cacos em cada uma comeria o orcamento
          // inteiro — o entulho expulsaria as brasas da propria explosao.
          this.burst(ev.x, ev.y, kind, n(6), 1.6, 1.5, 620, 7);
          break;
        }
        case 'corrode':
          // Poucas gotas e vida curta: a informacao de verdade esta no BLOCO,
          // que mudou de estado no grid e fica na tela. A particula so aponta
          // onde olhar no instante em que acontece.
          this.burst(ev.x, ev.y, 'acidDrip', n(5), 0.9, 1.0, 420, 11);
          break;
        case 'chip':
          this.burst(ev.x, ev.y, 'oreChip', n(4), 1.4, 1.4, 380, 13);
          break;
        case 'death':
          // Acompanha o desabamento do sprite: a criatura vira materia.
          this.burst(ev.x, ev.y, 'debris', n(9), 1.5, 1.3, 560, ev.entity);
          break;
        case 'overheat':
          this.burst(ev.x, ev.y, 'ember', n(6), 1.0, 2.0, 380, 37);
          break;
        default:
          break;
      }
    }
  }

  /**
   * Respingo de um acerto, na materia da criatura atingida.
   *
   * Curto e pequeno de proposito: acontece muitas vezes por segundo e nao pode
   * competir com explosao nem com morte, que sao os momentos que o jogador
   * precisa mesmo ler. `amount` so modula a quantidade — um golpe forte solta
   * mais materia, sem virar outro efeito.
   */
  hit(x: number, y: number, kind: ParticleKind, amount: number, scale: number): void {
    const n = Math.max(1, Math.round(Math.min(5, 1 + amount / 8) * scale));
    this.burst(x, y, kind, n, 1.1, 1.2, 300, 17);
  }

  /** Emissao contínua do gas parado no mundo — a ameaca tem de ser VISTA. */
  emitGas(x: number, y: number, nowMs: number, scale: number): void {
    // Um mote por celula a cada ~200ms, defasado pela posicao para as celulas
    // vizinhas nao pulsarem em uniso.
    const phase = (Math.imul(x | 0, 92837111) ^ Math.imul(y | 0, 689287499)) >>> 0;
    const bucket = (nowMs / 200) | 0;
    const every = Math.max(1, Math.round(3 / scale));
    if (bucket % every !== phase % every) return;

    // O chamador percorre as celulas de gas visiveis a CADA frame, e a condicao
    // acima continua verdadeira pelos 200ms inteiros do bucket. Sem esta trava
    // uma unica celula empurrava ~12 motes por bucket a 60Hz — e, como a
    // semente e constante dentro do bucket, os 12 nasciam na MESMA posicao com
    // a MESMA velocidade: duplicatas invisiveis, empilhadas, comendo o
    // orcamento e expulsando as brasas de explosao.
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastGasBucket.get(cell) === bucket) return;
    this.lastGasBucket.set(cell, bucket);

    // A semente inclui o INSTANTE, nao so a celula: com semente fixa por celula
    // todo mote nascia no mesmo ponto e o gas subia em fila indiana, uma linha
    // vertical em vez de uma coluna que se abre.
    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 2654435761)));
    this.push({
      x: x + rnd() * 0.9 - 0.45,
      y: y + rnd() * 0.9 - 0.45,
      z: 0.05,
      vx: (rnd() - 0.5) * 0.12,
      vy: (rnd() - 0.5) * 0.12,
      vz: 0.5 + rnd() * 0.4,
      life: 900,
      maxLife: 900,
      kind: 'gas',
    });
  }

  step(dtMs: number): void {
    const dt = Math.min(64, dtMs) / 1000;
    // A frente balistica anda pelo tempo REAL decorrido, sem o teto de 64ms.
    //
    // O teto existe para uma aba que volta do segundo plano nao teleportar
    // brasas — mas a vida sempre foi descontada pelo `dtMs` inteiro, entao
    // aplicar o teto ao movimento fazia a frente gastar vida sem andar. Num
    // aparelho a 10 quadros por segundo a frente da explosao sumia a 47% do
    // raio, ensinando ao jogador um alcance quase metade do que machuca. Aqui
    // movimento e vida consomem o MESMO intervalo, entao a posicao e sempre
    // raio x (tempo decorrido / vida), em qualquer taxa de quadros.
    // Arrasto POR SEGUNDO, elevado ao tempo do passo.
    //
    // Multiplicar por 0.97 uma vez por quadro amarrava o alcance a taxa do
    // monitor pela porta dos fundos: o passo de tempo ja vinha do relogio, mas o
    // amortecimento continuava contando QUADROS, entao a 120Hz a mesma brasa
    // recebia o dobro de multiplicacoes no mesmo tempo real e parava na metade
    // da distancia. Com a potencia, o percurso e o mesmo em qualquer taxa.
    const drag = Math.pow(0.97, dt * 60);
    const gasDrag = Math.pow(0.985, dt * 60);
    const out: Particle[] = [];
    for (const p of this.items) {
      if (p.ballistic) {
        // A frente sobrevive ao quadro em que COMPLETA o percurso.
        //
        // Abatendo-a antes de mover, como o caminho comum faz, o ultimo passo
        // era descartado e ela nunca chegava a ser DESENHADA na borda: a 10
        // quadros por segundo o jogador via no maximo 74% do raio. E o quadro
        // final que ensina o alcance, entao ele precisa existir.
        if (p.life <= 0) continue;
        const lived = Math.min(dtMs, p.life) / 1000;
        p.x += p.vx * lived;
        p.y += p.vy * lived;
        p.life -= dtMs;
        out.push(p);
        continue;
      }
      p.life -= dtMs;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Brasa e entulho caem; gas e fumaca sobem e desaceleram, nunca caem.
      if (p.kind === 'gas' || p.kind === 'ash') {
        p.vz *= gasDrag;
      } else {
        p.vz -= 5.5 * dt;
        if (p.z < 0) { p.z = 0; p.vz = -p.vz * 0.28; p.vx *= 0.6; p.vy *= 0.6; }
      }
      p.vx *= drag;
      p.vy *= drag;
      out.push(p);
    }
    this.items = out;
  }

  /**
   * Desenha os cubinhos. `project` converte (tile x, tile y) em pixel de tela;
   * `zoom` da o tamanho do voxel, entao a particula cresce junto com o mundo.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    project: (x: number, y: number) => [number, number],
    zoom: number,
    tileH: number
  ): void {
    if (this.items.length === 0) return;
    // Ordem do pintor, igual ao resto da cena: o que esta atras desenha antes.
    const sorted = [...this.items].sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
    // A particula encolhe com a idade em vez de trocar de cor: com as tres
    // entradas da rampa agora ocupadas pelas FACES do voxel, o esmaecer passou
    // a ser tamanho e alpha, que e o que faz brasa parecer brasa apagando.
    const base = 4 * zoom;
    ctx.save();
    for (const p of sorted) {
      const [sx, sy] = project(p.x, p.y);
      const life = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = 0.35 + life * 0.65;
      const py = sy - p.z * tileH * zoom;
      // A fumaca CRESCE enquanto se apaga; todo o resto encolhe. Materia quente
      // ou solida perde massa ao esfriar e ao assentar, fumaca se dilui — usar a
      // mesma curva para os dois faria a fumaca ler como mais uma brasa.
      const size = p.kind === 'ash' ? 0.6 + (1 - life) * 0.9 : 0.45 + life * 0.55;
      drawVoxel(ctx, sx, py, base * size, RAMP[p.kind]);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
