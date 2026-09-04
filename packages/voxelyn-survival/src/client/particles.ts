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

import {
  ARCHCANTOR_CHOIR_LANCE_LENGTH,
  archcantorChoirLanceSpread,
  FROST_QUEEN_FREEZE_RADIUS,
  SOLID_CRYSTAL,
} from '@voxelyn/survival-sim';
import { COMBAT_PLANE_TILES } from './combat-plane';
import type { FaceRamp } from './voxel-draw';
import { drawVoxel } from './voxel-draw';
import type { SemanticEvent } from '@voxelyn/survival-sim';

export type ParticleKind =
  | 'ember'
  | 'gas'
  | 'sporeCloud'
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
  | 'stone'
  | 'mycelium'
  | 'bubble'
  /**
   * Caco de gelo. Nao e `crystalShard` (verde, e cristal E outra materia com
   * outra mecanica) nem `rubble` (marrom, e pedra): a lasca que salta de uma
   * placa cedendo tem de ler como a MESMA lamina que o jogador esta pisando,
   * senao o estalo nao aponta para o chao.
   */
  | 'iceShard'
  /**
   * VAPOR do degelo: o que escapa pelas juntas do Prospector quando o motor
   * forca por baixo do gelo, e a nuvem curta da crosta se partindo. Nao e
   * `ash` (fumaca preta de cano) nem `bubble` (agua): e agua virando ar, e
   * por isso e a unica rampa que sobe ate quase o branco.
   */
  | 'steam';

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
   * Identidade visual imutavel. O gas usa para escolher de que lado seus lobulos
   * abrem sem depender da posicao projetada, que muda com a camera e a subida.
   */
  visualSeed?: number;
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
  // Nuvem organica: compartilha a familia do fungo, nunca a rampa sulfurica.
  sporeCloud: ['#66c28a', '#2f6b4f', '#1f3d33'],
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
  // Micelio: a energia do chao SUBINDO pelo manto do bispo. Azul-branco por
  // cima de verde — nao e materia arrancada dele, e materia entrando nele, e
  // por isso e a unica das tres rampas de criatura que nao tem pedra no fundo.
  mycelium: ['#7ab8ff', '#59f2c2', '#2f6b4f'],
  bubble: ['#e8f7ff', '#9fd8f2', '#4b86a6'],
  // A lamina da Cripta: palido frio no topo, caindo para a rocha azul. Mesma
  // familia do tile de gelo, um passo mais claro para a lasca se separar dele.
  iceShard: ['#e8f1ff', '#7b8ba3', '#2e3a4d'],
  steam: ['#e8f1ff', '#b8a98f', '#7b8ba3'],
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
  // Bispo e Cavalo sao biomassa, nao mineral: quem os acerta vê esporo saltando,
  // e nao lasca de pedra. E o mesmo detalhe que ja dizia ao jogador que o
  // prospector e feito de outra coisa.
  bishop: 'spore',
  // O mineiro solta a MESMA materia que o prospector, e isso e a coisa mais
  // importante desta tabela. Os dois sao automatos da mesma familia; quem acerta
  // um ve exatamente o que veria acertando o outro. Nenhuma linha de texto diz
  // isso ao jogador — o respingo diz, toda vez.
  miner: 'stone',
  fungal_horse: 'spore',
  prospector: 'stone',
  // Assinaturas: o respingo diz de que materia cada uma e feita. Ressonante e
  // Escoriaceo sao mineral; Espectro e gelo (lasca como pedra); Lampreia e
  // Fole sao biomassa.
  resonant: 'stone',
  scoriac: 'stone',
  frost_wraith: 'stone',
  mud_lamprey: 'spore',
  bellows: 'spore',
};

export const hitMaterialOf = (archetype: string | undefined): ParticleKind =>
  (archetype !== undefined && HIT_MATERIAL[archetype]) || 'debris';

/**
 * PRNG barata semeada por evento. Nao precisa da qualidade da RNG da simulacao
 * — nada aqui e autoritativo — mas precisa ser DETERMINISTA por evento, para os
 * dois clientes de uma sala verem o mesmo estilhaco.
 */
/**
 * Gerador uniforme 0..1 semeado. Exportado porque as capsulas da Minigun
 * (`casings.ts`) semeiam a chuva de latao a partir do MESMO evento
 * autoritativo, e duas fontes de aleatorio no cliente dariam duas chuvas
 * diferentes na mesma sala de co-op — cosmetico, mas de graca evitar.
 */
export const seededUnit = (seed: number): (() => number) => seeded(seed);

const seeded = (seed: number) => {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
};

const eventSeed = (x: number, y: number, salt: number): number =>
  Math.imul(Math.round(x * 16) | 0, 374761393) ^
  Math.imul(Math.round(y * 16) | 0, 668265263) ^
  salt;

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
  private readonly lastSporeBucket = new Map<number, number>();
  private readonly lastFungalSmokeBucket = new Map<number, number>();
  /**
   * Ultimo bucket do cano superaquecido, por SLOT de jogador.
   *
   * Os outros emissores contínuos são chaveados pela célula, porque o gás e o
   * fungo não saem do lugar. O Prospector sai: chaveada por posição, a trava
   * abriria a cada passo dentro do mesmo bucket e a fumaça voltaria a nascer por
   * quadro. O slot é a identidade que de fato não muda durante o travamento, e
   * limita o mapa ao número de jogadores.
   */
  private readonly lastOverheatBucket = new Map<number, number>();
  private lastFurnaceBucket = -1;
  private readonly lastDashJetBucket = new Map<number, number>();
  private readonly lastBubbleBucket = new Map<number, number>();
  /** Ultimo bucket de faisca do curto-circuito, por SLOT (ver emitDashJets). */
  private readonly lastShortBucket = new Map<number, number>();
  /** Ultimo bucket de vapor do degelo, por SLOT (ver emitOverheatSmoke). */
  private readonly lastSteamBucket = new Map<number, number>();
  /** Teto vindo do preset de qualidade; mobile no minimo nao aguenta o de cima. */
  budget = 240;

  get count(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.lastGasBucket.clear();
    this.lastSporeBucket.clear();
    this.lastFungalSmokeBucket.clear();
    this.lastOverheatBucket.clear();
    this.lastBubbleBucket.clear();
    this.lastShortBucket.clear();
    this.lastSteamBucket.clear();
  }

  private push(p: Particle): void {
    // Descarta o mais VELHO, nao o novo: um burst recente e o que o jogador
    // esta olhando, e cortar a cauda deixaria a explosao pela metade.
    if (this.items.length >= this.budget) this.items.shift();
    this.items.push(p);
  }

  /** Emissor leve, limitado por entidade e velocidade; usa o budget global. */
  emitMovementBubbles(
    id: number,
    x: number,
    y: number,
    vx: number,
    vy: number,
    bodyRadius: number,
    surfaceZ: number,
    nowMs: number,
    heavy = false,
  ): void {
    const speed = Math.hypot(vx, vy);
    if (speed < 0.35 || surfaceZ <= 0.4) return;
    const interval = heavy ? 90 : 145;
    const bucket = Math.floor(nowMs / interval);
    if (this.lastBubbleBucket.get(id) === bucket) return;
    this.lastBubbleBucket.set(id, bucket);
    const rnd = seeded(eventSeed(x, y, id ^ bucket));
    const count = heavy ? Math.min(4, 2 + Math.floor(speed / 3)) : 1;
    const nx = vx / speed;
    const ny = vy / speed;
    for (let i = 0; i < count; i++) {
      this.push({
        x: x - nx * bodyRadius + (rnd() - 0.5) * bodyRadius,
        y: y - ny * bodyRadius + (rnd() - 0.5) * bodyRadius,
        z: 0.25 + rnd() * Math.min(0.8, surfaceZ * 0.35),
        vx: -nx * 0.12 + (rnd() - 0.5) * 0.18,
        vy: -ny * 0.12 + (rnd() - 0.5) * 0.18,
        vz: 0.8 + rnd() * 0.55,
        life: Math.min(1500, Math.max(360, surfaceZ * 850)),
        maxLife: Math.min(1500, Math.max(360, surfaceZ * 850)),
        kind: 'bubble',
        visualSeed: id + i,
      });
    }
  }

  private burst(
    x: number,
    y: number,
    kind: ParticleKind,
    count: number,
    speed: number,
    lift: number,
    life: number,
    salt: number,
    baseZ = 0,
  ): void {
    const rnd = seeded(eventSeed(x, y, salt));
    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const mag = speed * (0.35 + rnd() * 0.65);
      this.push({
        x,
        y,
        z: baseZ + 0.12 + rnd() * 0.25,
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
    salt: number,
    baseZ = 0,
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
        x,
        y,
        z: baseZ + 0.06 + rnd() * 0.1,
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
        case 'boss_state':
          if (ev.archetype !== 'archcantor') break;
          if (ev.state === 'song_halo') {
            this.ring(ev.x, ev.y, 'crystalShard', Math.max(18, n(32)), 4.8, 720, 81, 0.35);
          } else if (ev.state === 'choir_cross' || ev.state === 'choir_diagonal') {
            // O halo nao e so decoracao: durante TODO o windup ele desenha os
            // quatro corredores que vao cobrar. A cruz usa as cardinais; o xis
            // gira o mesmo vocabulário cristalino em 45 graus.
            const dirs =
              ev.state === 'choir_cross'
                ? [
                    [1, 0],
                    [0, 1],
                    [-1, 0],
                    [0, -1],
                  ]
                : [
                    [1, 1],
                    [-1, 1],
                    [-1, -1],
                    [1, -1],
                  ];
            for (const [dx, dy] of dirs) {
              const unit = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
              for (let step = 2; step <= ARCHCANTOR_CHOIR_LANCE_LENGTH; step += 1.5) {
                const ux = dx * unit;
                const uy = dy * unit;
                const spread = archcantorChoirLanceSpread(step);
                for (const side of [-1, 1]) {
                  this.ring(
                    ev.x + ux * step - uy * spread * side,
                    ev.y + uy * step + ux * spread * side,
                    'crystalShard',
                    Math.max(4, n(6)),
                    0.42,
                    760,
                    84 + step + side,
                    0.22,
                  );
                }
              }
            }
          } else if (ev.state === 'choir_voice') {
            this.ring(ev.x, ev.y, 'crystalShard', Math.max(8, n(14)), 1.35, 420, 82, 0.3);
          } else if (ev.state === 'resonance_halo') {
            this.ring(ev.x, ev.y, 'crystalShard', Math.max(6, n(10)), 0.9, 520, 83, 0.25);
          } else if (ev.state === 'choir_metamorphosis') {
            const power = 0.45 + (ev.intensity ?? 0) * 0.75;
            this.ring(ev.x, ev.y, 'crystalShard', Math.max(10, n(18)), power, 300, 96, 0.35);
            this.ring(ev.x, ev.y, 'spark', Math.max(6, n(10)), power * 0.62, 260, 97, 0.55);
            this.burst(ev.x, ev.y, 'crystalShard', n(5), 0.45, 1.5, 360, 98, 0.4);
          }
          break;
        case 'leviathan_discharge':
          this.ring(
            ev.x,
            ev.y,
            'spark',
            Math.max(18, n(36)),
            Math.min(18, ev.radius),
            420,
            71,
            0.5,
          );
          for (const bubble of ev.bubbles) {
            this.burst(bubble.x, bubble.y, 'bubble', n(12), 1.9, 1.8, 700, 72, 0.5);
          }
          break;
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
          // O raio vem do EVENTO, e nao mais da constante da habilidade do
          // jogador. Passou a haver uma segunda fonte de pulso com alcance
          // diferente — a Supernova do bispo — e desenhar a frente do jogador em
          // volta do bispo prometeria 3,2 tiles onde o dano chega a 5,5.
          this.ring(ev.x, ev.y, 'spark', Math.max(6, n(14)), ev.radius, 260, 5);
          break;
        case 'ignite':
          // Sais distintos por evento, mesmo entre eventos de tipos diferentes:
          // uma explosao ACENDE as celulas que alcanca, entao explosao e ignicao
          // caem no mesmo ponto no mesmo instante, e com o mesmo sal sairiam com
          // o mesmo sorteio — a brasa da ignicao nasceria colada na da explosao.
          this.burst(ev.x, ev.y, 'ember', n(4), 0.5, 1.6, 420, 31);
          break;
        case 'heal':
          // SOBE. Todo o resto do sistema cai — brasa, entulho, caco, respingo —
          // porque tudo o mais e materia sendo arrancada de alguma coisa. Aqui e
          // o contrario: e o chao devolvendo vida ao bispo, e a direcao sozinha
          // conta isso sem legenda nenhuma.
          //
          // Sem particula, a cura so existia no numero da barra de vida e no som,
          // e o jogador teria de comparar a barra com a memoria dela para
          // perceber que nao esta progredindo. Aqui ele VE de onde vem.
          this.burst(ev.x, ev.y, 'mycelium', n(5), 0.55, 2.4, 780, ev.entity);
          break;
        case 'ore_gained':
          // Lasca dourada saltando. Fica no MESMO tipo do `chip` que ja existia:
          // e a mesma materia saindo da mesma parede, e dar a ela um visual
          // proprio faria parecer que sao dois acontecimentos.
          this.burst(ev.x, ev.y, 'oreChip', n(3), 1.5, 1.8, 420, 41);
          break;
        case 'miner_mood':
          // So o enfurecido levanta particula. A fuga ja e legivel pelo corpo
          // saindo de perto, e uma nuvem em cima de quem foge apagaria a leitura
          // que importa: para ONDE ele foi.
          if (ev.mood === 2) this.burst(ev.x, ev.y, 'ember', n(6), 1.1, 2.0, 520, ev.entity);
          break;
        case 'discharge':
          for (const cell of ev.cells.slice(0, Math.max(4, n(16)))) {
            const cx = (cell % worldWidth) + 0.5;
            const cy = Math.floor(cell / worldWidth) + 0.5;
            this.burst(cx, cy, 'spark', n(2), 1.6, 2.6, 240, cell);
          }
          break;
        case 'leyline_charge':
          // Faiscas RALAS ao longo do segmento: o grosso do aviso e a luz
          // subindo (render) — a particula so poe materia no primeiro instante,
          // para o olho achar A LINHA antes de o pulso ficar obvio.
          for (const cell of ev.cells.filter((_, k) => k % 4 === 0).slice(0, n(8))) {
            const cx = (cell % worldWidth) + 0.5;
            const cy = Math.floor(cell / worldWidth) + 0.5;
            this.burst(cx, cy, 'spark', 1, 1.0, 1.6, 300, cell);
          }
          break;
        case 'leyline_routed':
          // Uma faisca curta no ponto do toggle: confirma o ato da mao. O
          // estado continuado e trabalho da luz da juncao, nao de particula.
          this.burst(ev.x, ev.y, 'spark', n(3), 1.2, 1.8, 260, ev.node);
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
          if (ev.archetype === 'frost_wraith') {
            // O Espectro nao vira entulho: o nucleo apaga, o corpo ESTILHACA e
            // os fragmentos SUBLIMAM em neblina — gelo virando ar.
            this.burst(ev.x, ev.y, 'iceShard', n(16), 1.6, 2.2, 520, ev.entity, 0.6);
            this.burst(ev.x, ev.y, 'steam', n(10), 0.6, 1.1, 900, ev.entity + 3, 0.5);
            break;
          }
          // Acompanha o desabamento do sprite: a criatura vira materia.
          this.burst(ev.x, ev.y, 'debris', n(9), 1.5, 1.3, 560, ev.entity);
          break;
        case 'lurker_state':
          // So o Espectro tem materia aqui; a Lampreia continua com a ondulacao
          // dela e nada mais.
          if (ev.archetype !== 'frost_wraith') break;
          if (ev.hidden) {
            // Voltando a nevoa: o corpo perde fragmentos e se dissolve.
            this.burst(ev.x, ev.y, 'iceShard', n(8), 0.8, 0.9, 420, ev.entity + 11, 0.7);
            this.burst(ev.x, ev.y, 'steam', n(7), 0.5, 0.8, 700, ev.entity + 13, 0.4);
          } else {
            // Condensando: a nevoa converge e cristaliza de baixo para cima —
            // vapor sobe do chao, cacos assentam.
            this.burst(ev.x, ev.y, 'steam', n(6), 0.4, 1.5, 480, ev.entity + 17, 0.1);
            this.burst(ev.x, ev.y, 'iceShard', n(5), 0.5, 0.4, 360, ev.entity + 19, 0.3);
          }
          break;
        case 'wraith_lunge':
          // A lanca de gelo saindo: uma esteira de cacos ATRAS do impulso.
          this.burst(
            ev.x - ev.dx * 0.4,
            ev.y - ev.dy * 0.4,
            'iceShard',
            n(6),
            0.9,
            0.6,
            320,
            ev.entity + 23,
            0.5,
          );
          this.burst(
            ev.x - ev.dx * 0.6,
            ev.y - ev.dy * 0.6,
            'steam',
            n(4),
            0.4,
            0.5,
            420,
            ev.entity + 29,
            0.4,
          );
          break;
        case 'ice_crack':
          // Po de gelo, e a quantidade E o aviso: o estagio decide quantas
          // lascas saltam e quao alto. Poucas e rasteiras na fenda fina, um
          // punhado erguido no critico.
          this.burst(
            ev.x,
            ev.y,
            'iceShard',
            n(2 + ev.stage * 2),
            0.7 + ev.stage * 0.25,
            0.5 + ev.stage * 0.4,
            300 + ev.stage * 90,
            ev.stage * 31,
          );
          break;
        case 'ice_collapse':
          // A placa CEDE: um anel de cacos saindo da borda do buraco (a placa
          // se abriu para os lados) mais o esguicho da agua que apareceu.
          this.ring(ev.x, ev.y, 'iceShard', n(10), 0.85, 460, 47);
          this.burst(ev.x, ev.y, 'bubble', n(6), 1.1, 2.1, 520, 53);
          break;
        case 'boss_attack':
          if (ev.archetype === 'frost_queen' && ev.ability === 'freeze') {
            // O CONGELAMENTO: um saco de cacos despejado no chao. Um leque de
            // lascas saltando alto e caindo para fora (o `burst`, com impulso
            // vertical) e, rente ao chao, a frente de cacos que chega ao raio
            // REAL da habilidade — ate onde o lago foi refeito — e para ali.
            const r = FROST_QUEEN_FREEZE_RADIUS;
            this.burst(ev.x, ev.y, 'iceShard', n(30), r * 1.3, 2.8, 680, 67, 0.3);
            this.ring(ev.x, ev.y, 'iceShard', n(20), r, 440, 71, 0.15);
          }
          break;
        case 'freeze_dose':
          // A dose: geada assentando no chassi — po de gelo curto e baixo, na
          // quantidade da dose. A Nova ja tem a coroa dela; isto e o que
          // acontece NO corpo, e e por corpo.
          this.burst(ev.x, ev.y, 'iceShard', n(ev.amount >= 300 ? 8 : 3), 0.5, 0.9, 360, 73, 0.6);
          break;
        case 'frostbite':
          // A crosta FECHANDO: um anel curto de lascas para dentro e vapor
          // frio subindo — o ar em volta do corpo congelou de uma vez.
          this.ring(ev.x, ev.y, 'iceShard', n(12), 0.6, 300, 79, 0.3);
          this.burst(ev.x, ev.y, 'steam', n(6), 0.4, 1.2, 520, 83, 0.8);
          break;
        case 'thermal_cycle':
          // O motor partindo por baixo do gelo: um sopro de vapor por ciclo.
          this.burst(ev.x, ev.y, 'steam', n(3), 0.5, 1.4, 420, 89, 0.9);
          break;
        case 'frostbite_break':
          // A crosta se PARTE de dentro para fora: cacos arremessados alto e
          // longe, e a nuvem curta de vapor que a diferenca de temperatura
          // deixa no lugar do corpo.
          this.burst(ev.x, ev.y, 'iceShard', n(22), 2.6, 3.4, 720, 97, 0.9);
          this.ring(ev.x, ev.y, 'iceShard', n(10), 1.3, 380, 101, 0.2);
          this.burst(ev.x, ev.y, 'steam', n(10), 0.9, 1.8, 640, 103, 0.8);
          break;
        case 'ice_fall':
          // A QUEDA: massa entrando na agua. O respingo sobe alto e volta —
          // `bubble` e a unica rampa de agua do banco, e e a certa: o que se ve
          // aqui e liquido, nao gelo. Os cacos que sobram sao a borda do buraco
          // levando o baque.
          this.burst(ev.x, ev.y, 'bubble', n(14), 1.5, 3.2, 700, 59);
          this.ring(ev.x, ev.y, 'iceShard', n(7), 0.7, 420, 61);
          break;
        case 'overheat':
          this.burst(ev.x, ev.y, 'ember', n(6), 1.0, 2.0, 380, 37);
          break;
        case 'flame_cone':
          // UMA emissao do sopro canalizado: brasas voando do bocal na direcao
          // da mira, recortadas pelo alcance REAL que a simulacao mediu por
          // raio (`reach`). O sal e o `seq` da emissao — deterministico nas
          // duas maquinas do co-op, e diferente entre emissoes vizinhas.
          this.flameJet(ev.x, ev.y, ev.dx, ev.dy, ev.arc, ev.reach, ev.seq, scale);
          break;
        case 'bolt_impact':
          // Burst de plasma do bolt contra parede firme: a MESMA linguagem
          // ciano do projetil (a paleta do atlas fx-impact-burst), em materia
          // voxel — impacto aqui e particula, nao sprite, desde o redesign dos
          // FX. O anel diz "acabou aqui"; os cacos escorrem da face atingida.
          //
          // E nasce NA ALTURA DO TIRO. O evento so carrega x/y porque a
          // simulacao nao tem eixo Z, mas o corpo do projetil esta desenhado no
          // plano de combate: um burst semeado no piso aparecia um tile abaixo
          // do estilhaco que acabou de sumir, e o olho lia dois acontecimentos
          // em vez de um. A altura sai da MESMA constante que o projetil usa.
          this.ring(ev.x, ev.y, 'spark', Math.max(5, n(9)), 0.55, 190, 23, COMBAT_PLANE_TILES);
          this.burst(
            ev.x + ev.nx * 0.08,
            ev.y + ev.ny * 0.08,
            'crystalShard',
            n(4),
            1.2,
            1.6,
            320,
            29,
            COMBAT_PLANE_TILES,
          );
          break;
        default:
          break;
      }
    }
  }

  /**
   * Jato do lanca-chamas: brasas balisticas nascendo no bocal e morrendo
   * exatamente no alcance que a simulacao reportou para o raio mais proximo —
   * a chama visual nunca atravessa a parede que bloqueou a de verdade.
   */
  private flameJet(
    x: number,
    y: number,
    dx: number,
    dy: number,
    arc: number,
    reach: readonly number[],
    seq: number,
    scale: number,
  ): void {
    if (reach.length === 0) return;
    const rnd = seeded(eventSeed(x, y, Math.imul(seq + 1, 2654435761)));
    const count = Math.max(3, Math.round(7 * scale));
    /** Offset do bocal: a chama nasce na arma, nao no centro do peito. */
    const muzzle = 0.45;
    for (let i = 0; i < count; i++) {
      const t = rnd();
      const angle = -arc + 2 * arc * t;
      const lane = Math.min(reach.length - 1, Math.round(t * (reach.length - 1)));
      const travel = reach[lane] - muzzle;
      if (travel <= 0.1) continue;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const jx = dx * cos - dy * sin;
      const jy = dx * sin + dy * cos;
      const speed = 6.5 * (0.75 + rnd() * 0.35);
      const life = (travel / speed) * 1000;
      this.push({
        x: x + jx * muzzle,
        y: y + jy * muzzle,
        z: 0.55 + rnd() * 0.15,
        vx: jx * speed,
        vy: jy * speed,
        vz: 0,
        life,
        maxLife: life,
        kind: 'ember',
        ballistic: true,
      });
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

    // A mesma semente que distribui o nascimento tambem vira a identidade visual
    // imutavel do puff. A posicao e a camera mudam; esta identidade nao.
    const visualSeed = eventSeed(x, y, phase ^ Math.imul(bucket, 2654435761));
    const rnd = seeded(visualSeed);
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
      visualSeed,
    });
  }

  /** Esporos organicos: deriva mais larga, subida baixa e vida mais longa. */
  emitSpores(x: number, y: number, nowMs: number, scale: number): void {
    const phase = (Math.imul(x | 0, 12582917) ^ Math.imul(y | 0, 4256249)) >>> 0;
    const bucket = (nowMs / 260) | 0;
    const every = Math.max(1, Math.round(3 / scale));
    if (bucket % every !== phase % every) return;
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastSporeBucket.get(cell) === bucket) return;
    this.lastSporeBucket.set(cell, bucket);

    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 1597334677)));
    this.push({
      x: x + rnd() * 0.95 - 0.475,
      y: y + rnd() * 0.95 - 0.475,
      z: 0.12 + rnd() * 0.18,
      vx: (rnd() - 0.5) * 0.24,
      vy: (rnd() - 0.5) * 0.24,
      vz: 0.22 + rnd() * 0.22,
      life: 1250,
      maxLife: 1250,
      kind: 'sporeCloud',
    });
  }

  /** Fungo aquecido: fumaca rara e baixa, nunca chama antes do timer autoritativo. */
  emitFungalSmoke(x: number, y: number, nowMs: number, scale: number): void {
    const phase = (Math.imul(x | 0, 19349663) ^ Math.imul(y | 0, 83492791)) >>> 0;
    const bucket = (nowMs / 420) | 0;
    const every = Math.max(1, Math.round(4 / scale));
    if (bucket % every !== phase % every) return;
    const cell = ((x | 0) << 16) | (y | 0);
    if (this.lastFungalSmokeBucket.get(cell) === bucket) return;
    this.lastFungalSmokeBucket.set(cell, bucket);

    const rnd = seeded(eventSeed(x, y, phase ^ Math.imul(bucket, 2246822519)));
    this.push({
      x: x + rnd() * 0.6 - 0.3,
      y: y + rnd() * 0.6 - 0.3,
      z: 0.08,
      vx: (rnd() - 0.5) * 0.08,
      vy: (rnd() - 0.5) * 0.08,
      vz: 0.18 + rnd() * 0.12,
      life: 900,
      maxLife: 900,
      kind: 'ash',
    });
  }

  /**
   * Cano superaquecido: fumaca preta saindo do proprio Prospector.
   *
   * Ritmo por BUCKET de tempo real, como o gas e a fumaca do fungo, e nao por
   * quadro: emitir a cada frame amarraria a densidade da fumaca a taxa do
   * monitor — a 120Hz o jogador sumiria dentro da propria nuvem e a 30Hz ela
   * mal apareceria. O bucket e curto (140ms) porque o travamento tambem e: a
   * fumaca precisa nascer densa e acabar junto com ele.
   *
   * Nasce ACIMA do chao (`z`) porque o cano esta na altura do peito, e o que
   * separa esta fumaca da do fungo secando e exatamente de onde ela sai.
   */
  /**
   * A FUMACA DO COLAPSO: o nucleo do Coracao da Fornalha se desfazendo.
   *
   * Duas materias no mesmo jato, e a mistura e a leitura: `ash` sobe frio e
   * lento (o constructo virando escoria) e `ember` sai rapido e aceso (o que
   * ainda esta queimando la dentro). Fumaca pura leria como maquina quebrando;
   * brasa pura, como fogueira. Ele e as duas coisas.
   *
   * Bucket de 110ms, como o resto dos jatos continuos: o laco de render chama
   * isto todo quadro, e sem a trava um monitor de 144Hz encheria o orcamento
   * de particulas com a fumaca de um bicho so.
   */
  emitFurnaceSmoke(x: number, y: number, nowMs: number, scale: number, unstable: boolean): void {
    const bucket = (nowMs / 110) | 0;
    if (this.lastFurnaceBucket === bucket) return;
    this.lastFurnaceBucket = bucket;

    const rnd = seeded(eventSeed(x, y, Math.imul(bucket, 2654435761)));
    const count = Math.max(1, Math.round((unstable ? 5 : 3) * scale));
    for (let i = 0; i < count; i++) {
      const hot = i % 3 === 0;
      this.push({
        x: x + rnd() * 1.2 - 0.6,
        y: y + rnd() * 1.2 - 0.6,
        z: 0.5 + rnd() * 0.5,
        vx: (rnd() - 0.5) * 0.5,
        vy: (rnd() - 0.5) * 0.5,
        vz: hot ? 1.1 + rnd() * 0.6 : 0.4 + rnd() * 0.3,
        life: hot ? 520 : 900,
        maxLife: hot ? 520 : 900,
        kind: hot ? 'ember' : 'ash',
      });
    }
  }

  /**
   * VAPOR pelas juntas da estatua, durante um ciclo termico. Mesmo contrato
   * do cano superaquecido: chaveado por slot e por bucket de tempo real, para
   * nascer por segundo e nao por quadro.
   */
  emitThawSteam(slot: number, x: number, y: number, nowMs: number, scale: number): void {
    const bucket = (nowMs / 90) | 0;
    if (this.lastSteamBucket.get(slot) === bucket) return;
    this.lastSteamBucket.set(slot, bucket);
    const rnd = seeded(eventSeed(x, y, Math.imul(bucket, 2246822519) ^ (slot + 7)));
    const count = Math.max(1, Math.round(2 * scale));
    for (let i = 0; i < count; i++) {
      // Das juntas: ombros e joelhos, nunca do centro — o centro e o nucleo
      // aceso, e vapor em cima dele apagaria o unico ponto quente da leitura.
      const side = rnd() < 0.5 ? -1 : 1;
      this.push({
        x: x + side * (0.18 + rnd() * 0.1),
        y: y + (rnd() - 0.5) * 0.2,
        z: 0.25 + rnd() * 0.6,
        vx: side * (0.25 + rnd() * 0.2),
        vy: (rnd() - 0.5) * 0.2,
        vz: 0.7 + rnd() * 0.4,
        life: 480,
        maxLife: 480,
        kind: 'steam',
      });
    }
  }

  emitOverheatSmoke(slot: number, x: number, y: number, nowMs: number, scale: number): void {
    const bucket = (nowMs / 140) | 0;
    if (this.lastOverheatBucket.get(slot) === bucket) return;
    this.lastOverheatBucket.set(slot, bucket);

    const rnd = seeded(eventSeed(x, y, Math.imul(bucket, 2654435761) ^ (slot + 1)));
    const count = Math.max(1, Math.round(2 * scale));
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + rnd() * 0.4 - 0.2,
        y: y + rnd() * 0.4 - 0.2,
        z: 0.55 + rnd() * 0.2,
        vx: (rnd() - 0.5) * 0.35,
        vy: (rnd() - 0.5) * 0.35,
        vz: 0.5 + rnd() * 0.35,
        life: 620,
        maxLife: 620,
        kind: 'ash',
      });
    }
  }

  /**
   * Foguetes da esquiva: brasas jorrando do hardpoint traseiro enquanto o
   * Prospector e propulsionado.
   *
   * O jato nasce ATRAS do bot (oposto ao rumo da esquiva), na altura do modulo
   * dorsal, e a velocidade das brasas continua empurrando para tras — e o
   * rastro delas que anima os foguetes, sem nenhum sprite novo. Bucket CURTO
   * (45ms): a esquiva dura poucos ticks e o jato tem de ler como fluxo
   * continuo, nao como tres brasas soltas.
   */
  emitDashJets(
    slot: number,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    nowMs: number,
    scale: number,
  ): void {
    const bucket = (nowMs / 45) | 0;
    if (this.lastDashJetBucket.get(slot) === bucket) return;
    this.lastDashJetBucket.set(slot, bucket);

    const rnd = seeded(eventSeed(x, y, Math.imul(bucket, 374761393) ^ (slot + 7)));
    const count = Math.max(1, Math.round(3 * scale));
    for (let i = 0; i < count; i++) {
      // Dois bocais, um de cada lado do modulo: o offset perpendicular alterna.
      const side = i % 2 === 0 ? 0.14 : -0.14;
      const px = -dirY * side;
      const py = dirX * side;
      this.push({
        x: x - dirX * 0.35 + px + (rnd() - 0.5) * 0.08,
        y: y - dirY * 0.35 + py + (rnd() - 0.5) * 0.08,
        z: 0.65 + rnd() * 0.15,
        vx: -dirX * (2.2 + rnd() * 0.8),
        vy: -dirY * (2.2 + rnd() * 0.8),
        vz: 0.15 + rnd() * 0.25,
        life: 240 + rnd() * 120,
        maxLife: 360,
        kind: 'ember',
      });
    }
  }

  /**
   * CURTO-CIRCUITO: faiscas azuis saltando do chassi com integridade baixa.
   *
   * Saem do meio do corpo, para cima e para os lados, e morrem rapido: e
   * eletricidade escapando de uma placa, nao brasa de uma fogueira. Chaveado
   * por slot como os jatos da esquiva, porque o Prospector anda.
   */
  emitShortCircuit(slot: number, x: number, y: number, nowMs: number, scale: number): void {
    const bucket = (nowMs / 55) | 0;
    if (this.lastShortBucket.get(slot) === bucket) return;
    this.lastShortBucket.set(slot, bucket);
    const rnd = seeded(eventSeed(x, y, Math.imul(bucket, 668265263) ^ (slot + 11)));
    const count = Math.max(1, Math.round(2 * scale));
    for (let i = 0; i < count; i++) {
      this.push({
        x: x + (rnd() - 0.5) * 0.3,
        y: y + (rnd() - 0.5) * 0.3,
        z: 0.35 + rnd() * 0.55,
        vx: (rnd() - 0.5) * 1.8,
        vy: (rnd() - 0.5) * 1.8,
        vz: 0.5 + rnd() * 0.9,
        life: 130 + rnd() * 120,
        maxLife: 250,
        kind: 'spark',
      });
    }
  }

  /**
   * A PURGA: o chassi venta. Uma coroa de faiscas quentes que sobe do corpo
   * (o sistema descarregando o que estava travando) e uma frente rasteira que
   * vai ate onde o gas foi limpo — o alcance da limpeza e informacao, e a
   * frente e a unica coisa que o mostra.
   */
  emitPurgeVent(x: number, y: number, radius: number, scale: number): void {
    this.burst(x, y, 'shock', Math.max(4, Math.round(10 * scale)), 1.2, 2.4, 420, 41, 0.35);
    this.burst(x, y, 'spark', Math.max(3, Math.round(8 * scale)), 0.8, 1.6, 360, 43, 0.7);
    this.ring(x, y, 'shock', Math.max(8, Math.round(18 * scale)), radius, 380, 47, 0.1);
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
      if (
        p.kind === 'gas' ||
        p.kind === 'sporeCloud' ||
        p.kind === 'ash' ||
        p.kind === 'mycelium' ||
        p.kind === 'bubble'
      ) {
        p.vz *= gasDrag;
      } else {
        p.vz -= 5.5 * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz = -p.vz * 0.28;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
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
    tileH: number,
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
      drawVoxel(ctx, sx, py, base * size, RAMP[p.kind], p.visualSeed);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
