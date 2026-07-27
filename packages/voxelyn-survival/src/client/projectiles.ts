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

import type { FaceRamp } from './voxel-draw';
import { drawGroundShadow, drawVoxel } from './voxel-draw';

export type ProjectileLike = {
  id: number;
  x: number;
  y: number;
  hostile: boolean;
  /** Ausente em estados antigos: cai para o comportamento anterior. */
  kind?: 'bolt' | 'spit' | 'rock';
};

/** Estilhaco mineral do jogador contra cuspe acido do inimigo. */
const PLAYER_RAMP: FaceRamp = ['#e8f1ff', '#59f2c2', '#2f6b4f'];
const HOSTILE_RAMP: FaceRamp = ['#d7ff7a', '#a8e63c', '#2f6b4f'];
/**
 * Pedra do bruiser: a MESMA rampa dos blocos de terreno.
 *
 * Ela nao e "um projetil cinza", e um PEDACO DA PAREDE — foi arrancado da arena
 * um segundo antes. Usar a rampa do terreno e o que fecha essa leitura: o
 * jogador reconhece o material voando porque acabou de ve-lo sair do lugar.
 * Com a rampa hostil generica, o bloco aparecia como cusparada de acido.
 */
const ROCK_RAMP: FaceRamp = ['#46566e', '#2e3a4d', '#1d2430'];

/** Altura de voo, em tiles. O bastante para a sombra se separar do corpo. */
const FLIGHT_HEIGHT = 0.55;
/** Largura de um voxel do mundo em pixels, no zoom 1 (igual ao atlas). */
const VOXEL_PX = 4;
const TRAIL_LENGTH = 3;

type Track = { x: number; y: number; dx: number; dy: number; seenAt: number };

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
        previous.x = p.x;
        previous.y = p.y;
        previous.seenAt = nowMs;
      } else {
        this.tracks.set(p.id, { x: p.x, y: p.y, dx: 0, dy: 0, seenAt: nowMs });
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
    const ramp = rock ? ROCK_RAMP : projectile.hostile ? HOSTILE_RAMP : PLAYER_RAMP;
    const lift = FLIGHT_HEIGHT * tileH * zoom;
    // Massa se le por TAMANHO antes de qualquer outra coisa. Um bloco de parede
    // no calibre de um cuspe nao pesa, por mais certa que esteja a cor.
    const size = VOXEL_PX * zoom * (rock ? 1.9 : 1);
    const track = this.tracks.get(projectile.id);

    // A sombra vem primeiro e e o que torna a ALTURA legivel: em projecao
    // isometrica subir na tela e afastar-se sao o mesmo deslocamento de pixel,
    // entao sem sombra um projetil alto e indistinguivel de um projetil longe.
    // Sombra proporcional ao corpo: um bloco projeta mais sombra que um cuspe,
    // e e por ela que a massa se le enquanto ele ainda esta longe.
    drawGroundShadow(ctx, sx, sy, (rock ? 5 : 3) * zoom);

    // Pedra nao deixa rastro nem se parte em estilhaco: e um corpo solido e
    // unico. O rastro existe para materia que se desfaz no ar — cuspe e
    // estilhaco de energia —, e desenha-lo aqui daria a um bloco a aparencia de
    // algo que evapora enquanto voa.
    if (rock) {
      drawVoxel(ctx, sx, sy - lift, size, ramp);
      return;
    }

    // Rastro atras do corpo, ao longo da direcao de voo.
    if (track && (track.dx !== 0 || track.dy !== 0)) {
      for (let i = TRAIL_LENGTH; i >= 1; i--) {
        const back = i * 0.3;
        const [tx, ty] = project(projectile.x - track.dx * back, projectile.y - track.dy * back);
        ctx.globalAlpha = 0.5 - i * 0.1;
        drawVoxel(ctx, tx, ty - lift, size * (1 - i * 0.18), ramp);
      }
      ctx.globalAlpha = 1;
    }

    // CORPO: um estilhaco de dois voxels, nao um cubo solto.
    //
    // Um voxel unico e o tamanho principiado — igual ao voxel de terreno e ao de
    // criatura — mas na pratica lia como respingo, sem direcao nem volume. Dois
    // voxels deslocados ao longo do voo dao ao projetil uma forma alongada com
    // orientacao propria: da para ver PARA ONDE ele aponta, nao so onde esta.
    if (track && (track.dx !== 0 || track.dy !== 0)) {
      const [bx, by] = project(projectile.x - track.dx * 0.16, projectile.y - track.dy * 0.16);
      drawVoxel(ctx, bx, by - lift, size * 0.8, ramp);
    }
    drawVoxel(ctx, sx, sy - lift, size, ramp);
  }
}
