// Projeteis desenhados como voxels de verdade, com altura, sombra e rastro.
//
// Antes: o tiro do jogador era um sprite chapado de 16x16 e o cuspe inimigo era
// um `ctx.arc` — um circulo liso. Os dois eram desenhados a uma altura fixa de
// 6px sem sombra, entao nao havia como distinguir "esta voando alto" de "esta
// mais longe": em projecao isometrica subir na tela e afastar-se sao o mesmo
// deslocamento de pixel. O projetil ficava colado no chao e sem volume.
//
// Agora o projetil e um voxel com as tres faces sombreadas, a uma altura
// declarada, com sombra no chao logo abaixo — a sombra e o que torna a altura
// legivel — e um rastro curto que mostra para onde ele vai.

import { PROSPECTOR_MUZZLE_HEIGHT_TILES } from '@voxelyn/survival-content';
import { COMBAT_PLANE_TILES, heightToScreenPx, projectileHeightTiles } from './combat-plane';
import type { FaceRamp } from './voxel-draw';
import { drawGroundShadow, drawVoxel } from './voxel-draw';

export type ProjectileLike = {
  id: number;
  x: number;
  y: number;
  hostile: boolean;
  /** Ausente em estados antigos: cai para o comportamento anterior. */
  kind?: 'bolt' | 'spit' | 'rock' | 'return_disc' | 'seeker' | 'cart' | 'cyclone';
  modules?: {
    explosive?: { armAfterDistance: number };
    piercing?: true;
    ricochet?: { remainingBounces: number };
  };
  distanceTravelled?: number;
};

/** Estilhaco mineral do jogador contra cuspe acido do inimigo. */
const PLAYER_RAMP: FaceRamp = ['#e8f1ff', '#59f2c2', '#2f6b4f'];
const HOSTILE_RAMP: FaceRamp = ['#d7ff7a', '#a8e63c', '#2f6b4f'];
/** Drone rastreador: chassi frio; a carga ambar pulsa no centro. */
const SEEKER_RAMP: FaceRamp = ['#e8f1ff', '#7ab8ff', '#2e3a4d'];
/** Borrao dos rotores: o cinza-azulado `mist` da paleta mestra. */
const DRONE_ROTOR_BLUR = '#7b8ba3';
/** Pulso da carga kamikaze: loot -> amber, os dois emissivos da paleta. */
const DRONE_CORE_PULSE = ['#ffd166', '#ffa63f'] as const;
/**
 * Pedra do bruiser: pedra CARREGADA, nao pedra camuflada.
 *
 * A primeira versao usava a rampa exata dos blocos de terreno, pela leitura
 * "isto e um pedaco da parede" — e era, mas voando sobre um chao da MESMA
 * rocha o bloco sumia no fundo, e o unico projetil pesado do jogo virava dano
 * ilegivel. O jogo promete que a morte venha de decisao arriscada, nunca do
 * que nao dava para ver: legibilidade vence pureza de material.
 *
 * A resposta continua sendo do mundo: o topo palido e a pedra-placa do
 * proprio Britador (osso, o material dos ombros dele), e as faiscas eletricas
 * que crepitam no bloco sao a corrente do nucleo-geodo que acabou de
 * arranca-lo. Acento saturado = perigo, como manda a art bible.
 */
const ROCK_RAMP: FaceRamp = ['#b8a98f', '#46566e', '#2e3a4d'];
/** Crepitacao da pedra: a mesma eletricidade do nucleo do Britador. */
const ROCK_SPARK = '#7ab8ff';
/**
 * Disco de retorno: AMARELO, e nao mais azul-branco.
 *
 * O azul-branco era a mesma rampa do missil rastreador e da faisca de descarga —
 * tres coisas diferentes na mesma cor, e a unica delas que VOLTA era
 * indistinguivel das que nao voltam. Amarelo e a cor que o jogo ja usa para o
 * que e ferramenta e recurso (cascos, minerio, lanterna), e nao ha um segundo
 * objeto amarelo voando por ai.
 */
const DISC_RAMP: FaceRamp = ['#ffd166', '#6e4a33', '#1d2430'];
const ARMED_RAMP: FaceRamp = ['#ffd166', '#ff7a3d', '#7a2f2f'];

/**
 * Raio de colisao de um projetil pequeno, em tiles — o mesmo fallback que a
 * simulacao aplica quando o projetil nao declara raio proprio.
 *
 * Importado como CONSTANTE COMPARTILHADA e nao redigitado: e ele que define a
 * largura da faixa de mira no chao, e uma faixa que promete uma largura
 * diferente da que colide seria pior do que nao ter faixa nenhuma.
 */
export const SMALL_PROJECTILE_RADIUS = 0.2;

/**
 * ALTURA DE VOO: o plano de combate, o mesmo de onde a mira e medida.
 *
 * O que sai da arma do jogador nao voa mais na altura do cano. A boca continua
 * sendo a ORIGEM — `PROSPECTOR_MUZZLE_HEIGHT_TILES` existe porque o estilhaco
 * nascia atravessando a barriga do bot —, mas manter o voo INTEIRO la em cima
 * custava a mira: em projecao isometrica, 20 px de subida sao mais de um tile de
 * chao, e o tiro passava por cima da linha que ligava o personagem ao cursor.
 * `combat-plane.ts` conta a historia inteira e publica a curva
 * (`projectileHeightTiles`); aqui fica so a consequencia.
 *
 * A altura continua sendo so visual — a colisao acontece no plano do chao, e a
 * sombra continua marcando onde o projetil de fato passa.
 */
/**
 * O drone rastreador NAO assenta: ele e a unica peca voadora do jogo, e uma
 * maquina de quatro rotores rasteirinha mentiria sobre o que ela e. Ele tambem
 * nao e mirado — o jogador solta e ele procura sozinho —, entao a altitude dele
 * nao entra na conta da pontaria. Fica na altura em que foi lancado.
 */
const DRONE_CRUISE_HEIGHT = PROSPECTOR_MUZZLE_HEIGHT_TILES;
/** Largura de um voxel do mundo em pixels, no zoom 1 (igual ao atlas). */
const VOXEL_PX = 4;
/** Bloco voador quase ocupa a largura visual de um tile, como o bloco arrancado. */
export const ROCK_PROJECTILE_SCALE = 2.8;
const TRAIL_LENGTH = 3;

type Track = { x: number; y: number; dx: number; dy: number; seenAt: number; travelled: number };

/**
 * Converte uma direcao de MUNDO na direcao equivalente na TELA.
 *
 * A projecao e 2:1, entao o eixo vertical vale metade: um vetor de mundo
 * normalizado nao sai normalizado na tela, e desenhar um corpo alongado com o
 * vetor cru produz um dardo que estica e encolhe conforme a direcao. Renormalizar
 * depois de projetar e o que mantem o comprimento constante em toda a volta.
 */
const screenDirection = (dx: number, dy: number): { x: number; y: number } => {
  const sx = dx - dy;
  const sy = (dx + dy) * 0.5;
  const length = Math.hypot(sx, sy) || 1;
  return { x: sx / length, y: sy / length };
};

/**
 * DISCO DE RETORNO: um puck de hoquei de verdade — chato, redondo, furado no
 * meio e amarelo.
 *
 * O que havia antes eram dois cubos lado a lado com um retangulo tracado em
 * volta. Nao lia como disco em nenhum quadro: lia como duas caixas com uma
 * moldura, e a unica ferramenta do jogo que VOLTA nao tinha silhueta propria.
 *
 * E a unica peca redonda do jogo junto com a bola de ricochete, e isso e de
 * proposito: tudo o mais e facetado porque e MATERIA do mundo — pedra, estilhaco,
 * cuspe. O disco nao e materia do mundo, e equipamento fabricado, e a curva o
 * separa de tudo que ele atravessa. O furo no meio termina de dizer isso, porque
 * nada organico tem um furo perfeitamente centrado.
 */
const drawDisc = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  spin: number
): void => {
  const rx = size * 1.15;
  const ry = rx * 0.5;
  // Espessura: e ela que faz o disco ter LADO, e nao ser uma moeda desenhada.
  const thickness = Math.max(1, size * 0.32);

  // Canto do disco (a parede lateral), desenhado primeiro e por baixo.
  ctx.fillStyle = DISC_RAMP[2];
  ctx.beginPath();
  ctx.ellipse(sx, sy + thickness, rx, ry, 0, 0, Math.PI);
  ctx.rect(sx - rx, sy, rx * 2, thickness);
  ctx.fill();

  // Face de cima.
  ctx.fillStyle = DISC_RAMP[0];
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Furo central, com a parede interna visivel: o furo tem de ter FUNDO, senao
  // le como um ponto pintado em cima de um disco cheio.
  ctx.fillStyle = DISC_RAMP[1];
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx * 0.34, ry * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = DISC_RAMP[2];
  ctx.beginPath();
  ctx.ellipse(sx, sy - Math.max(1, thickness * 0.4), rx * 0.34, ry * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Duas marcas na borda, girando. Sao o UNICO jeito de o giro aparecer: um
  // disco redondo com furo centrado e identico a si mesmo em toda rotacao.
  ctx.fillStyle = DISC_RAMP[2];
  for (const offset of [0, Math.PI]) {
    const angle = spin + offset;
    const mx = sx + Math.cos(angle) * rx * 0.72;
    const my = sy + Math.sin(angle) * ry * 0.72;
    ctx.fillRect(Math.round(mx - 1), Math.round(my - 1), 2, 2);
  }
};

/**
 * RICOCHETE: uma bola redonda.
 *
 * O corpo padrao e um estilhaco de dois voxels deslocados no eixo do voo — uma
 * forma com FRENTE, que e o certo para um tiro que segue reto. Um tiro que
 * rebate nao tem frente: depois da primeira parede ele vai para outro lugar, e
 * uma forma apontada continuaria prometendo um rumo que ela nao cumpre mais. A
 * esfera e a unica silhueta que fica igual em qualquer direcao, e por isso e a
 * que nao mente sobre para onde ele vai.
 *
 * O rastro fica: e ele que conta de onde a bola veio depois do rebote, que e a
 * informacao que sobra quando a forma deixa de apontar.
 */
const drawBounceBall = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  ramp: FaceRamp
): void => {
  const r = size * 0.75;
  ctx.fillStyle = ramp[2];
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fill();
  // Meia-lua clara no alto-esquerda: a MESMA key light das faces dos voxels, que
  // e o que mantem a bola no mesmo mundo das pecas facetadas em volta dela.
  ctx.fillStyle = ramp[1];
  ctx.beginPath();
  ctx.arc(sx - r * 0.18, sy - r * 0.18, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ramp[0];
  ctx.beginPath();
  ctx.arc(sx - r * 0.3, sy - r * 0.34, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
};

/**
 * PIERCING: um dardo alongado com ponta de seta.
 *
 * O modulo promete atravessar o que acerta, e a forma tem de prometer junto —
 * comprimento e ponta sao o que a mao le como "isso entra". A ponta e SUTIL de
 * proposito: uma seta grande viraria um icone flutuando no meio da arena, e o
 * projetil ainda precisa parecer feito da mesma materia mineral que o tiro
 * comum. O que muda e a proporcao, nao o material.
 */
const drawPiercingDart = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  dir: { x: number; y: number },
  ramp: FaceRamp
): void => {
  const nx = dir.x;
  const ny = dir.y;
  // Perpendicular na tela, para a meia-largura do corpo.
  const px = -ny;
  const py = nx;
  const half = size * 0.34;
  const tail = size * 1.05;
  const tip = size * 1.5;
  const barb = size * 0.62;

  // Haste: um quadrilatero longo, escuro embaixo e claro em cima, para manter as
  // duas faces que todo volume do jogo mostra.
  ctx.fillStyle = ramp[2];
  ctx.beginPath();
  ctx.moveTo(sx - nx * tail + px * half, sy - ny * tail + py * half);
  ctx.lineTo(sx + nx * tail + px * half, sy + ny * tail + py * half);
  ctx.lineTo(sx + nx * tail - px * half, sy + ny * tail - py * half);
  ctx.lineTo(sx - nx * tail - px * half, sy - ny * tail - py * half);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ramp[1];
  ctx.beginPath();
  ctx.moveTo(sx - nx * tail, sy - ny * tail);
  ctx.lineTo(sx + nx * tail, sy + ny * tail);
  ctx.lineTo(sx + nx * tail - px * half, sy + ny * tail - py * half);
  ctx.lineTo(sx - nx * tail - px * half, sy - ny * tail - py * half);
  ctx.closePath();
  ctx.fill();

  // Ponta de seta: tres pontos, com as farpas apenas encostando na haste.
  ctx.fillStyle = ramp[0];
  ctx.beginPath();
  ctx.moveTo(sx + nx * tip, sy + ny * tip);
  ctx.lineTo(sx + nx * barb + px * half * 2.1, sy + ny * barb + py * half * 2.1);
  ctx.lineTo(sx + nx * barb - px * half * 2.1, sy + ny * barb - py * half * 2.1);
  ctx.closePath();
  ctx.fill();
};

/**
 * CUSPE: uma gota de gosma, nao um projetil de bala.
 *
 * O cuspe compartilhava o corpo facetado do estilhaco do jogador — dois voxels
 * apontados, leitura de municao. Secrecao nao tem faceta: e uma GOTA que
 * balanca em voo, com globulos grudados girando em volta e pingos se
 * desgarrando por baixo. Tudo redondo de proposito: no mundo facetado, a curva
 * e o que separa fluido de materia — a mesma regra do disco e da bola de
 * ricochete.
 *
 * A fase vem da DISTANCIA percorrida, nao do relogio: a gota balanca porque
 * voa, e para de balancar quando o mundo pausa.
 */
const drawSpitGlob = (
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  phase: number,
  ramp: FaceRamp
): void => {
  const wob = Math.sin(phase * 9);
  const rx = size * (0.95 + 0.14 * wob);
  const ry = size * (0.78 - 0.1 * wob);

  // Globulos grudados, girando devagar com o voo — a gosma nao e uma esfera
  // limpa, e uma massa que se reorganiza no ar.
  ctx.fillStyle = ramp[1];
  for (const offset of [0, Math.PI * 0.9]) {
    const angle = phase * 5 + offset;
    const gx = sx + Math.cos(angle) * rx * 0.75;
    const gy = sy + Math.sin(angle) * ry * 0.8;
    const gr = size * (0.28 + 0.08 * Math.sin(phase * 7 + offset));
    ctx.beginPath();
    ctx.ellipse(gx, gy, gr, gr * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Corpo principal: gota achatada com a MESMA key light das faces voxel —
  // sombra embaixo, meio-tom, brilho no alto-esquerda.
  ctx.fillStyle = ramp[2];
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ramp[1];
  ctx.beginPath();
  ctx.ellipse(sx - rx * 0.12, sy - ry * 0.16, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ramp[0];
  ctx.beginPath();
  ctx.ellipse(sx - rx * 0.28, sy - ry * 0.3, rx * 0.38, ry * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pingo desgarrado caindo rumo a sombra: nasce sob a gota, desce e recomeca.
  // E ele que diz "isto escorre" — e escorrer e o que a poca no impacto promete.
  const drop = (phase * 1.6) % 1;
  ctx.globalAlpha = 0.85 * (1 - drop);
  ctx.fillStyle = ramp[1];
  ctx.beginPath();
  ctx.ellipse(sx + rx * 0.2 * wob, sy + ry + drop * size * 1.6, size * 0.16, size * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

export class ProjectileView {
  private readonly tracks = new Map<number, Track>();

  clear(): void {
    this.tracks.clear();
  }

  /**
   * Atualiza a direcao de cada projetil a partir do movimento observado.
   *
   * O snapshot do servidor traz apenas posicao — nao ha velocidade no
   * protocolo, e nao vale a pena adicionar: a direcao so serve para inclinar o
   * rastro, que e puramente cosmetico. Derivar do quadro anterior custa nada e
   * nao inventa nenhum fato.
   */
  sync(projectiles: readonly ProjectileLike[], nowMs: number): void {
    for (const p of projectiles) {
      const previous = this.tracks.get(p.id);
      if (previous) {
        const dx = p.x - previous.x;
        const dy = p.y - previous.y;
        const length = Math.hypot(dx, dy);
        // Parado entre dois quadros (mesmo tick servido duas vezes) mantem a
        // ultima direcao, senao o rastro colapsaria e piscaria.
        if (length > 1e-4) {
          previous.dx = dx / length;
          previous.dy = dy / length;
        }
        // Distancia acumulada a partir do que foi OBSERVADO, e nao do campo
        // `distanceTravelled` do estado: online esse campo nao viaja no snapshot,
        // e o giro do disco congelaria em co-op justamente onde ele mais precisa
        // ser lido. E puramente cosmetico — so gira a marca da borda.
        previous.travelled += length;
        previous.x = p.x;
        previous.y = p.y;
        previous.seenAt = nowMs;
      } else {
        this.tracks.set(p.id, { x: p.x, y: p.y, dx: 0, dy: 0, seenAt: nowMs, travelled: 0 });
      }
    }
    // Projeteis que sumiram (acertaram algo, expiraram) nao podem deixar
    // entrada viva no mapa: ids sao reciclados e o novo tiro herdaria a
    // direcao do antigo, com o rastro apontando para tras.
    const live = new Set(projectiles.map((p) => p.id));
    for (const id of this.tracks.keys()) if (!live.has(id)) this.tracks.delete(id);
  }

  /**
   * Desenha um projetil. `project` converte tile em pixel de tela; `tileH` e a
   * altura do losango, usada para converter altura de voo em pixels.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    projectile: ProjectileLike,
    project: (x: number, y: number) => [number, number],
    zoom: number,
    tileH: number
  ): void {
    const [sx, sy] = project(projectile.x, projectile.y);
    const rock = projectile.kind === 'rock';
    const disc = projectile.kind === 'return_disc';
    // O missil e um corpo, nao uma faisca: ele precisa ler como algo que voce
    // lancou e que ainda esta no ar procurando alguem.
    const seeker = projectile.kind === 'seeker';
    const armed = Boolean(projectile.modules?.explosive && (projectile.distanceTravelled ?? 0) >= projectile.modules.explosive.armAfterDistance);
    const ramp = rock ? ROCK_RAMP
      : disc ? DISC_RAMP
      : seeker ? SEEKER_RAMP
      : armed ? ARMED_RAMP
      : projectile.hostile ? HOSTILE_RAMP
      : PLAYER_RAMP;
    // Massa se le por TAMANHO antes de qualquer outra coisa. Um bloco de parede
    // no calibre de um cuspe nao pesa, por mais certa que esteja a cor.
    const size = VOXEL_PX * zoom * (rock ? ROCK_PROJECTILE_SCALE : disc ? 1.45 : seeker ? 1.25 : 1);
    const track = this.tracks.get(projectile.id);

    // ALTURA. Tudo o que nao e hostil saiu da arma do Prospector — estilhaco,
    // disco e drone —, e por isso PARTE da altura do cano; o estilhaco e o disco
    // assentam no plano de combate em pouco mais de um tile, e o drone fica em
    // cruzeiro. O que voa do chao (cuspe, pedra) ja nasce no plano.
    //
    // A distancia vem do que foi OBSERVADO (`track.travelled`), e nao do campo
    // `distanceTravelled` do estado: online esse campo nao viaja no snapshot, e
    // a descida congelaria justamente no co-op. O rastreio comeca no primeiro
    // quadro em que o tiro aparece, que e o quadro em que ele saiu da arma.
    const heightTiles = seeker
      ? DRONE_CRUISE_HEIGHT
      : projectileHeightTiles(track?.travelled ?? 0, !projectile.hostile);
    const lift = heightToScreenPx(heightTiles, tileH, zoom);

    // A sombra vem primeiro e e o que torna a ALTURA legivel: em projecao
    // isometrica subir na tela e afastar-se sao o mesmo deslocamento de pixel,
    // entao sem sombra um projetil alto e indistinguivel de um projetil longe.
    // Sombra proporcional ao corpo: um bloco projeta mais sombra que um cuspe,
    // e e por ela que a massa se le enquanto ele ainda esta longe.
    //
    // Durante a descida do cano ela e MAIOR e mais fraca, e fecha conforme o
    // tiro assenta. E o que conta a queda: sem isso, um estilhaco descendo e um
    // estilhaco se aproximando desenham o mesmo pixel.
    const altitude = heightTiles / COMBAT_PLANE_TILES;
    drawGroundShadow(
      ctx,
      sx,
      sy,
      (rock ? 7 : seeker ? 5 : disc ? 6 : 3) * zoom * (0.6 + 0.4 * altitude),
      0.45 / altitude,
    );

    // Pedra nao deixa rastro de energia nem se parte em estilhaco: e um corpo
    // solido e unico. O que ela deixa e CASCALHO — pedrinhas escuras se
    // soltando do bloco — e o que ela carrega e a crepitacao eletrica do
    // nucleo que a arrancou: dois sinais que a fazem rastreavel contra um chao
    // da mesma rocha, sem mentir sobre o material.
    if (rock) {
      if (track && (track.dx !== 0 || track.dy !== 0)) {
        for (let i = 2; i >= 1; i--) {
          const [px, py] = project(projectile.x - track.dx * i * 0.22, projectile.y - track.dy * i * 0.22);
          ctx.globalAlpha = 0.5 - i * 0.15;
          drawVoxel(ctx, px, py - lift + i * zoom, size * 0.22, ramp);
        }
        ctx.globalAlpha = 1;
      }
      drawVoxel(ctx, sx, sy - lift, size, ramp);
      // Faiscas orbitando o bloco, em fase pela distancia percorrida: a
      // corrente crepita enquanto ele voa e para quando o mundo para.
      const spin = (track?.travelled ?? 0) * 5;
      ctx.fillStyle = ROCK_SPARK;
      for (let i = 0; i < 3; i++) {
        const a = spin + i * 2.1;
        const px = sx + Math.cos(a) * size * 0.62;
        const py = sy - lift + Math.sin(a) * size * 0.45;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(spin * 1.7 + i);
        ctx.fillRect(Math.round(px), Math.round(py), Math.max(1, zoom), Math.max(1, zoom));
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (seeker) {
      // DRONE QUAD KAMIKAZE: quatro discos de rotor em X sobre um chassi
      // facetado, com a carga pulsando ambar no centro — o mesmo desenho do
      // atlas fx-seeker-drone, em traço nativo como todo projetil. O que
      // denuncia a curva do homing e o rastro de deslocamento de ar atras do
      // voo; nao ha chama de foguete. E MAQUINA, nao inseto: discos solidos e
      // bracos grossos, sem pernas finas penduradas nem nariz de agulha.
      const bodyY = sy - lift;
      const spin = (track?.travelled ?? 0) * 6;

      // Deslocamento de ar: nevoa curta na direcao de onde ele veio.
      if (track && (track.dx !== 0 || track.dy !== 0)) {
        for (let i = 2; i >= 1; i--) {
          const [px, py] = project(
            projectile.x - track.dx * i * 0.3,
            projectile.y - track.dy * i * 0.3,
          );
          ctx.globalAlpha = 0.32 - i * 0.11;
          drawVoxel(ctx, px, py - lift, size * 0.4, ramp);
        }
        ctx.globalAlpha = 1;
      }

      // Bracos em X, achatados pela projecao. Pares diagonais giram em
      // sentidos opostos, como num quad de verdade.
      const arms = [
        { ux: -1, uy: -1, ccw: false },
        { ux: 1, uy: -1, ccw: true },
        { ux: -1, uy: 1, ccw: true },
        { ux: 1, uy: 1, ccw: false },
      ];
      ctx.strokeStyle = ramp[2];
      ctx.lineWidth = Math.max(1, zoom);
      for (const arm of arms) {
        ctx.beginPath();
        ctx.moveTo(sx, bodyY);
        ctx.lineTo(sx + arm.ux * size * 1.05, bodyY + arm.uy * size * 0.55);
        ctx.stroke();
      }

      // Chassi e carga: o unico ponto quente do corpo e a bomba.
      drawVoxel(ctx, sx, bodyY, size * 0.9, ramp);
      const core = Math.max(1, Math.round(size * 0.3));
      ctx.fillStyle = DRONE_CORE_PULSE[Math.floor(spin * 0.7) % 2];
      ctx.fillRect(Math.round(sx - core / 2), Math.round(bodyY - core / 2), core, core);

      // Rotores por cima de tudo: disco de borrao translucido, duas pas claras
      // girando em fase com a DISTANCIA percorrida (param quando o mundo para)
      // e o cubo escuro do eixo.
      arms.forEach((arm, i) => {
        const hx = sx + arm.ux * size * 1.05;
        const hy = bodyY + arm.uy * size * 0.55;
        const rx = size * 0.55;
        const ry = size * 0.28;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = DRONE_ROTOR_BLUR;
        ctx.beginPath();
        ctx.ellipse(hx, hy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        const angle = (arm.ccw ? -spin : spin) + i * 0.8;
        ctx.fillStyle = ramp[0];
        for (const opposite of [0, Math.PI]) {
          const mx = hx + Math.cos(angle + opposite) * rx * 0.75;
          const my = hy + Math.sin(angle + opposite) * ry * 0.75;
          ctx.fillRect(Math.round(mx - 1), Math.round(my - 1), Math.max(2, zoom), Math.max(2, zoom));
        }
        ctx.fillStyle = ramp[2];
        ctx.fillRect(Math.round(hx - 1), Math.round(hy - 1), Math.max(2, zoom), Math.max(2, zoom));
      });
      return;
    }
    if (disc) {
      // O giro sai da DISTANCIA percorrida, e nao do relogio: o disco tem de
      // parecer parado quando esta parado.
      drawDisc(ctx, sx, sy - lift, size, (track?.travelled ?? 0) * 2.4);
      return;
    }

    // Rastro atras do corpo, ao longo da direcao de voo. Vale para TODAS as
    // formas: e ele que conta de onde o tiro veio, e no ricochete e a unica
    // coisa que ainda conta isso depois do rebote.
    const heading = track && (track.dx !== 0 || track.dy !== 0) ? track : null;

    if (projectile.kind === 'spit') {
      // Rastro de RESPINGOS redondos, nao de voxels facetados: gotinhas que a
      // massa perdeu no caminho, encolhendo e sumindo.
      if (heading) {
        for (let i = 3; i >= 1; i--) {
          const [tx, ty] = project(
            projectile.x - heading.dx * i * 0.26,
            projectile.y - heading.dy * i * 0.26
          );
          ctx.globalAlpha = 0.45 - i * 0.11;
          ctx.fillStyle = HOSTILE_RAMP[1];
          ctx.beginPath();
          ctx.ellipse(tx, ty - lift, size * (0.5 - i * 0.1), size * (0.4 - i * 0.08), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      drawSpitGlob(ctx, sx, sy - lift, size, track?.travelled ?? 0, ramp);
      return;
    }
    if (heading) {
      for (let i = TRAIL_LENGTH; i >= 1; i--) {
        const back = i * 0.3;
        const [tx, ty] = project(projectile.x - heading.dx * back, projectile.y - heading.dy * back);
        ctx.globalAlpha = 0.5 - i * 0.1;
        drawVoxel(ctx, tx, ty - lift, size * (1 - i * 0.18), ramp);
      }
      ctx.globalAlpha = 1;
    }

    // Ricochete ANTES de piercing: quem equipa os dois recebe a bola.
    //
    // As duas formas dizem coisas verdadeiras, e nenhuma cabe na outra — um
    // dardo redondo nao existe. A bola vence porque o que ela comunica e o que
    // muda o comportamento do tiro no proximo instante: ele vai voltar de algum
    // lugar. O dardo comunica o que acontece NO acerto, e nesse momento o
    // jogador ja esta olhando para o alvo, nao para o projetil.
    if (projectile.modules?.ricochet) {
      drawBounceBall(ctx, sx, sy - lift, size, ramp);
      return;
    }
    if (projectile.modules?.piercing && heading) {
      drawPiercingDart(ctx, sx, sy - lift, size, screenDirection(heading.dx, heading.dy), ramp);
      return;
    }

    // CORPO: um estilhaco de dois voxels, nao um cubo solto.
    //
    // Um voxel unico e o tamanho principiado — igual ao voxel de terreno e ao de
    // criatura — mas na pratica lia como respingo, sem direcao nem volume. Dois
    // voxels deslocados ao longo do voo dao ao projetil uma forma alongada com
    // orientacao propria: da para ver PARA ONDE ele aponta, nao so onde esta.
    if (heading) {
      const [bx, by] = project(projectile.x - heading.dx * 0.16, projectile.y - heading.dy * 0.16);
      drawVoxel(ctx, bx, by - lift, size * 0.8, ramp);
    }
    drawVoxel(ctx, sx, sy - lift, size, ramp);
  }
}
