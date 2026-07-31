const PAL = {
  dark: '#0b0e14',
  rockShadow: '#1d2430',
  rock: '#2e3a4d',
  rockLight: '#46566e',
  rust: '#6e4a33',
  bone: '#b8a98f',
  fungusDark: '#1f3d33',
  fungus: '#2f6b4f',
  fungusLight: '#66c28a',
  biolum: '#59f2c2',
  acid: '#a8e63c',
  fire: '#ff7a2f',
  blood: '#d93b4c',
  electric: '#7ab8ff',
  // Faltava aqui e existe na paleta mestra do gerador de atlas. O fallback e o
  // atlas desenham o MESMO bicho: uma cor presente num e ausente no outro
  // obrigaria a inventar um substituto, e o jogador veria o bispo mudar de cor
  // conforme o sprite carregou ou nao.
  loot: '#ffd166',
  player: '#e8f1ff',
};

type VoxelEntityOptions = {
  sx: number;
  sy: number;
  z: number;
  radius: number;
  brightness: number;
  archetype: string;
  elite: boolean;
  nowMs: number;
  allyTint?: boolean;
  /**
   * A criatura esta sendo alimentada pelo chao neste instante.
   *
   * Existe por um inimigo so — o bispo — e mesmo assim vale o parametro. A cura
   * dele e a informacao que decide a luta, e sem ela desenhada o jogador so
   * descobre que nao esta progredindo comparando a barra de vida com a memoria
   * do que ela era ha dez segundos. Com as raizes acesas, ele VE de onde vem.
   */
  charged?: boolean;
};

const shade = (hex: string, factor: number): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  const clamp = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
  const r = clamp(((n >> 16) & 0xff) * factor);
  const g = clamp(((n >> 8) & 0xff) * factor);
  const b = clamp((n & 0xff) * factor);
  return `rgb(${r},${g},${b})`;
};

/** Isometric cuboid with the Art Bible's top-left key light. */
const block = (
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  width: number,
  depth: number,
  height: number,
  color: string,
  light: number
): void => {
  const hw = width / 2;
  const hd = depth / 2;
  const topY = baseY - height;

  ctx.strokeStyle = shade(color, Math.max(0.18, light * 0.28));
  ctx.lineWidth = Math.max(1, width * 0.035);
  ctx.lineJoin = 'miter';

  // Left face: receives more of the global top-left key light.
  ctx.fillStyle = shade(color, light * 0.78);
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x, baseY + hd);
  ctx.lineTo(x - hw, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right face.
  ctx.fillStyle = shade(color, light * 0.55);
  ctx.beginPath();
  ctx.moveTo(x + hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x, baseY + hd);
  ctx.lineTo(x + hw, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Top face.
  ctx.fillStyle = shade(color, light);
  ctx.beginPath();
  ctx.moveTo(x, topY - hd);
  ctx.lineTo(x + hw, topY);
  ctx.lineTo(x, topY + hd);
  ctx.lineTo(x - hw, topY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const emissive = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.max(2, Math.round(size)), Math.max(2, Math.round(size)));
};

const limb = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  light: number
): void => block(ctx, x, y, width, width * 0.55, height, color, light);

/**
 * Art-bible-aligned fallback for entities without a loaded atlas frame. It uses
 * pixel-snapped isometric blocks, a restricted palette, selective dark outlines
 * and unique silhouettes instead of the previous flat ellipse.
 */
export const drawVoxelEntity = (ctx: CanvasRenderingContext2D, options: VoxelEntityOptions): void => {
  const { sx, sy, z, radius, brightness, archetype, elite, nowMs, allyTint, charged } = options;
  const size = radius * 32 * 0.9 * z;
  const light = Math.max(0.35, Math.min(1.15, 0.5 + brightness * 0.7));
  const bob = Math.round(Math.sin(nowMs * 0.006 + sx * 0.01) * Math.max(1, z * 0.6));
  const baseY = Math.round(sy - bob);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  switch (archetype) {
    // Bot PX: chassi largo de latao, cabeca escura e baixa SEM pescoco, pernas
    // digitigradas e um unico ponto quente no farol. O recuo nao tem os detalhes
    // do atlas, mas nao pode contradizer a silhueta dele — este desenho aparece
    // no primeiro quadro de toda partida, antes de o atlas chegar, e um
    // personagem que troca de forma ao carregar le como defeito.
    case 'prospector': {
      const accent = allyTint ? PAL.biolum : PAL.player;
      // Pernas afastadas, com o vao entre elas: e o vao que separa bipede de
      // pedestal, e ele some se as duas encostarem.
      limb(ctx, sx - size * 0.42, baseY, size * 0.26, size * 0.5, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.16, baseY, size * 0.26, size * 0.5, PAL.rockShadow, light);
      // Chassi de latao, o volume dominante, com a chapa de topo escura.
      block(ctx, sx, baseY - size * 0.5, size * 1.05, size * 0.55, size * 0.72, PAL.rust, light);
      block(ctx, sx, baseY - size * 1.16, size * 1.05, size * 0.55, size * 0.16, PAL.rock, light);
      // Modulo traseiro e nucleo: as duas marcas que dizem "plataforma modular".
      block(ctx, sx + size * 0.5, baseY - size * 0.72, size * 0.34, size * 0.3, size * 0.6, PAL.rockShadow, light);
      emissive(ctx, sx - size * 0.06, baseY - size * 0.78, size * 0.14, PAL.biolum);
      // Cabeca escura, mais estreita que o chassi, com o visor cyan.
      block(ctx, sx, baseY - size * 1.32, size * 0.62, size * 0.42, size * 0.34, PAL.rock, light);
      emissive(ctx, sx - size * 0.04, baseY - size * 1.5, size * 0.18, accent);
      // Farol tatico, so de um lado: o ponto que o jogador acha no breu.
      emissive(ctx, sx - size * 0.42, baseY - size * 1.44, size * 0.13, PAL.loot);
      break;
    }

    case 'stalker': {
      for (const side of [-1, 1]) {
        for (const lane of [-0.55, 0, 0.55]) {
          limb(ctx, sx + side * size * (0.45 + Math.abs(lane) * 0.15), baseY - size * (0.08 + lane * 0.12), size * 0.16, size * 0.32, PAL.rockShadow, light);
        }
      }
      block(ctx, sx, baseY - size * 0.28, size * 1.25, size * 0.62, size * 0.52, PAL.rock, light);
      block(ctx, sx + size * 0.52, baseY - size * 0.38, size * 0.46, size * 0.35, size * 0.32, PAL.rockLight, light);
      emissive(ctx, sx + size * 0.65, baseY - size * 0.62, size * 0.12, PAL.acid);
      emissive(ctx, sx + size * 0.49, baseY - size * 0.57, size * 0.1, PAL.acid);
      break;
    }

    case 'spitter': {
      for (const side of [-1, 1]) limb(ctx, sx + side * size * 0.34, baseY, size * 0.22, size * 0.32, PAL.fungusDark, light);
      block(ctx, sx, baseY - size * 0.18, size * 1.08, size * 0.7, size * 0.95, PAL.fungusDark, light);
      block(ctx, sx - size * 0.08, baseY - size * 0.83, size * 0.82, size * 0.54, size * 0.58, PAL.acid, light);
      block(ctx, sx + size * 0.54, baseY - size * 0.58, size * 0.48, size * 0.22, size * 0.2, PAL.fungus, light);
      emissive(ctx, sx - size * 0.26, baseY - size * 1.12, size * 0.14, PAL.fungusLight);
      emissive(ctx, sx + size * 0.08, baseY - size * 0.95, size * 0.1, PAL.biolum);
      break;
    }

    case 'bruiser': {
      // Massive mining-beast silhouette: low head, plated shoulders and oversized fists.
      limb(ctx, sx - size * 0.3, baseY, size * 0.34, size * 0.52, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.22, baseY, size * 0.34, size * 0.52, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.45, size * 1.45, size * 0.75, size * 1.05, PAL.rust, light);
      block(ctx, sx - size * 0.78, baseY - size * 0.42, size * 0.62, size * 0.5, size * 0.72, PAL.rock, light);
      block(ctx, sx + size * 0.78, baseY - size * 0.42, size * 0.62, size * 0.5, size * 0.72, PAL.rock, light);
      block(ctx, sx + size * 0.2, baseY - size * 1.12, size * 0.7, size * 0.48, size * 0.46, PAL.rockLight, light);
      emissive(ctx, sx - size * 0.15, baseY - size * 0.92, size * 0.13, PAL.fire);
      emissive(ctx, sx + size * 0.03, baseY - size * 0.72, size * 0.1, PAL.fire);
      break;
    }

    case 'bomber': {
      // Spore pressure vessel: thin legs frame a volatile stacked pod.
      for (const side of [-1, 1]) {
        limb(ctx, sx + side * size * 0.48, baseY, size * 0.18, size * 0.48, PAL.fungusDark, light);
        limb(ctx, sx + side * size * 0.22, baseY - size * 0.05, size * 0.15, size * 0.4, PAL.fungusDark, light);
      }
      block(ctx, sx, baseY - size * 0.3, size * 0.98, size * 0.66, size * 0.88, PAL.fungus, light);
      block(ctx, sx, baseY - size * 1.05, size * 0.78, size * 0.58, size * 0.68, PAL.rust, light);
      const pulse = 0.65 + Math.sin(nowMs * 0.012) * 0.25;
      emissive(ctx, sx - size * 0.22, baseY - size * 1.18, size * 0.2, shade(PAL.fire, pulse));
      emissive(ctx, sx + size * 0.18, baseY - size * 0.88, size * 0.16, shade(PAL.acid, pulse));
      emissive(ctx, sx + size * 0.04, baseY - size * 0.56, size * 0.12, PAL.biolum);
      break;
    }

    case 'guardian': {
      // Final-boss silhouette: ritual mining machine overtaken by the Vein.
      limb(ctx, sx - size * 0.38, baseY, size * 0.42, size * 0.72, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.28, baseY, size * 0.42, size * 0.72, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.62, size * 1.5, size * 0.86, size * 1.42, PAL.rock, light);
      block(ctx, sx - size * 0.88, baseY - size * 1.02, size * 0.55, size * 0.45, size * 1.05, PAL.rust, light);
      block(ctx, sx + size * 0.88, baseY - size * 1.02, size * 0.55, size * 0.45, size * 1.05, PAL.rust, light);
      block(ctx, sx, baseY - size * 1.95, size * 0.86, size * 0.58, size * 0.52, PAL.bone, light);
      block(ctx, sx - size * 0.42, baseY - size * 2.25, size * 0.22, size * 0.2, size * 0.6, PAL.fungusDark, light);
      block(ctx, sx + size * 0.42, baseY - size * 2.25, size * 0.22, size * 0.2, size * 0.6, PAL.fungusDark, light);
      emissive(ctx, sx, baseY - size * 1.25, size * 0.34, PAL.blood);
      emissive(ctx, sx, baseY - size * 1.25, size * 0.14, PAL.player);
      emissive(ctx, sx + size * 0.24, baseY - size * 2.04, size * 0.11, PAL.acid);
      break;
    }

    case 'bishop': {
      // Uma TORRE, nao um corpo: base larga que se abre no chao, tronco que
      // estreita, mitra fina no alto. A silhueta e a de uma catedral pequena, e e
      // proposital — o bispo nao ameaca por alcancar o jogador, ameaca por ESTAR
      // onde esta. Ler como arquitetura diz isso antes de qualquer mecanica.
      //
      // Osso e ouro seco, e nao verde. O verde ja e o fungo do chao; um chefe da
      // mesma cor do piso que o alimenta desaparece exatamente no lugar onde o
      // jogador mais precisa enxerga-lo.
      const bloom = 0.55 + Math.sin(nowMs * 0.005) * 0.45;

      // Raizes de micelio: o manto esta PLUGADO no chao.
      //
      // Desenhadas primeiro para ficarem por baixo de tudo, espalhadas em volta
      // da base. Acendem forte so quando ele esta se curando de verdade — e o
      // unico jeito de a resposta "queime o chao" chegar ao jogador enquanto ele
      // ainda esta atirando, e nao depois, olhando para uma barra que nao desce.
      const rootGlow = charged ? bloom : 0.22;
      for (const [rx, ry, rs] of [
        [-1.35, 0.16, 0.2], [-0.85, 0.3, 0.16], [-0.4, 0.12, 0.13],
        [0.45, 0.28, 0.15], [0.95, 0.14, 0.19], [1.4, 0.3, 0.16],
        [-1.05, -0.06, 0.12], [1.15, -0.04, 0.13],
      ]) {
        emissive(ctx, sx + size * rx, baseY + size * ry, size * rs, shade(PAL.electric, rootGlow));
      }

      // Manto: tres degraus que estreitam para cima.
      block(ctx, sx, baseY, size * 2.05, size * 1.05, size * 0.5, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.46, size * 1.62, size * 0.88, size * 0.75, PAL.rust, light);
      block(ctx, sx, baseY - size * 1.18, size * 1.12, size * 0.66, size * 0.72, PAL.bone, light);
      // Estola vertical descendo pelo centro: e ela que faz o olho subir ate a
      // mitra em vez de parar no volume maior.
      block(ctx, sx, baseY - size * 0.52, size * 0.3, size * 0.2, size * 1.3, PAL.loot, light);

      // Bracos abertos: o turibulo pendurado de um lado, o baculo do outro. Sao
      // os dois unicos volumes assimetricos, e existem para a silhueta nao virar
      // um trapezio perfeito.
      block(ctx, sx - size * 0.92, baseY - size * 1.46, size * 0.24, size * 0.2, size * 0.34, PAL.bone, light);
      block(ctx, sx - size * 1.0, baseY - size * 0.62, size * 0.34, size * 0.26, size * 0.3, PAL.loot, light);
      emissive(ctx, sx - size * 1.0, baseY - size * 0.78, size * 0.14, shade(PAL.fire, bloom));
      block(ctx, sx + size * 1.02, baseY - size * 0.4, size * 0.16, size * 0.14, size * 2.1, PAL.loot, light);
      emissive(ctx, sx + size * 1.02, baseY - size * 2.6, size * 0.22, shade(PAL.electric, bloom));

      // Cabeca pequena e mitra alta: o unico volume claro no topo, para o olho
      // achar onde mirar sem contar blocos.
      block(ctx, sx, baseY - size * 1.88, size * 0.42, size * 0.32, size * 0.34, PAL.bone, light);
      block(ctx, sx, baseY - size * 2.22, size * 0.52, size * 0.36, size * 0.5, PAL.bone, light);
      block(ctx, sx, baseY - size * 2.72, size * 0.26, size * 0.2, size * 0.34, PAL.bone, light);
      emissive(ctx, sx + size * 0.1, baseY - size * 1.98, size * 0.11, PAL.electric);
      emissive(ctx, sx, baseY - size * 2.5, size * 0.13, shade(PAL.loot, bloom));
      break;
    }

    case 'miner': {
      // Automato de carga abandonado: alto, curvado, bracos longos.
      //
      // A gramatica e a do PROSPECTOR degradada, e nao a de gente — mesmo plano
      // de corpo, mesma lanterna, mesma ferramenta, so que grande demais e
      // corroido. O jogador nao deve pensar "coitado"; deve pensar "isto aqui e
      // o que sobra de mim".
      const overload = charged ? 0.6 + Math.sin(nowMs * 0.02) * 0.4 : 0.35;
      limb(ctx, sx - size * 0.26, baseY, size * 0.24, size * 0.62, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.18, baseY, size * 0.24, size * 0.62, PAL.rockShadow, light);
      block(ctx, sx, baseY - size * 0.55, size * 0.98, size * 0.55, size * 0.78, PAL.rust, light);
      // Tremonha nas costas: ainda cheia, ainda a caminho de lugar nenhum.
      block(ctx, sx - size * 0.3, baseY - size * 1.22, size * 0.6, size * 0.3, size * 0.5, PAL.rockShadow, light);
      // Bracos longos, descendo alem do tronco.
      limb(ctx, sx - size * 0.62, baseY - size * 0.1, size * 0.2, size * 0.95, PAL.rockShadow, light);
      limb(ctx, sx + size * 0.58, baseY - size * 0.1, size * 0.2, size * 0.95, PAL.rockShadow, light);
      // Cabeca baixa, placa facial rachada.
      block(ctx, sx + size * 0.12, baseY - size * 1.3, size * 0.46, size * 0.34, size * 0.34, PAL.rust, light);
      block(ctx, sx + size * 0.12, baseY - size * 1.5, size * 0.34, size * 0.2, size * 0.12, PAL.bone, light);
      // Picareta mergulhada no chao: ele estava trabalhando, nao esperando.
      block(ctx, sx + size * 0.7, baseY - size * 0.35, size * 0.14, size * 0.14, size * 0.9, PAL.rust, light);
      block(ctx, sx + size * 0.7, baseY - size * 0.2, size * 0.4, size * 0.14, size * 0.1, PAL.bone, light);
      // Cabeamento e optica. O azul e a corrente da grade que ainda passa por
      // ele; ele acende quando o calor a sobrecarrega.
      emissive(ctx, sx - size * 0.42, baseY - size * 0.75, size * 0.12, shade(PAL.electric, overload));
      emissive(ctx, sx + size * 0.3, baseY - size * 0.95, size * 0.1, shade(PAL.electric, overload));
      emissive(ctx, sx + size * 0.22, baseY - size * 1.42, size * 0.1, charged ? PAL.blood : PAL.biolum);
      // Lanterna: a unica luz quente, fraca e vacilante.
      emissive(ctx, sx - size * 0.26, baseY - size * 1.36, size * 0.13, PAL.fire);
      break;
    }

    case 'fungal_horse': {
      // A unica silhueta HORIZONTAL do bestiario.
      //
      // Todo o resto do jogo se le como coluna. A leitura de "isto vai atravessar
      // a sala" nao depende de reconhecer um cavalo — depende de ser a unica
      // coisa mais larga do que alta, com quatro apoios e um pescoco caido a
      // frente. Corpo baixo e pernas LONGAS: o vao embaixo e o que separa um
      // quadrupede de uma mesa.
      const ember = 0.6 + Math.sin(nowMs * 0.017) * 0.4;
      for (const [lx, ly] of [[-0.92, 0], [-0.52, -0.04], [0.58, -0.04], [0.98, 0]]) {
        limb(ctx, sx + size * lx, baseY + size * ly, size * 0.2, size * 0.86, PAL.rockShadow, light);
      }
      // Tronco longo e baixo.
      block(ctx, sx, baseY - size * 0.84, size * 2.15, size * 0.62, size * 0.56, PAL.rust, light);
      // Garupa mais alta que a cernelha, como bicho de carga.
      block(ctx, sx - size * 0.82, baseY - size * 1.32, size * 0.66, size * 0.5, size * 0.34, PAL.rust, light);
      // Crina de BRASA correndo pelo lombo. Nao e fungo: o rastro sai das patas,
      // mas a fonte dele tem de estar visivel no bicho antes de estar no chao —
      // um cavalo verde deixando fogo para tras nao explica de onde o fogo veio.
      block(ctx, sx - size * 0.2, baseY - size * 1.4, size * 1.15, size * 0.24, size * 0.22, PAL.fire, light);
      // Pescoco inclinado para a frente e focinho baixo: para onde ele vai correr
      // esta escrito na direcao em que a cabeca aponta.
      block(ctx, sx + size * 0.9, baseY - size * 1.32, size * 0.34, size * 0.3, size * 0.52, PAL.rust, light);
      block(ctx, sx + size * 1.24, baseY - size * 1.5, size * 0.56, size * 0.3, size * 0.34, PAL.rock, light);
      // Olhos de brasa: a unica luz quente do bicho, e ela mira o jogador.
      emissive(ctx, sx + size * 1.38, baseY - size * 1.66, size * 0.13, PAL.fire);
      emissive(ctx, sx + size * 1.2, baseY - size * 1.6, size * 0.11, PAL.fire);
      // Fagulhas na crina: o fogo ja esta nele antes de estar no chao.
      emissive(ctx, sx - size * 0.5, baseY - size * 1.52, size * 0.13, shade(PAL.fire, ember));
      emissive(ctx, sx + size * 0.12, baseY - size * 1.5, size * 0.11, shade(PAL.loot, ember));
      emissive(ctx, sx - size * 1.02, baseY - size * 1.44, size * 0.12, shade(PAL.loot, ember));
      break;
    }

    default: {
      block(ctx, sx, baseY - size * 0.35, size, size * 0.6, size * 1.1, PAL.bone, light);
      emissive(ctx, sx + size * 0.18, baseY - size * 1.05, size * 0.12, PAL.biolum);
    }
  }

  if (elite) {
    ctx.strokeStyle = PAL.fire;
    ctx.lineWidth = Math.max(1.5, z);
    ctx.setLineDash([Math.max(3, z * 2), Math.max(2, z)]);
    ctx.beginPath();
    ctx.ellipse(sx, sy - size * 0.45, size * 1.15, size * 0.68, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
};
