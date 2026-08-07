// TEXTURA -> MATERIAIS DO JOGO, por aproximacao.
//
// Um GLB texturizado traz cor por pixel; o Voxelyn tem 22 cores fechadas e ~22
// materiais, e cada material e uma RAMPA de tres faces, nao uma cor. Entao
// "importar as cores" nao e quantizar pixels: e escolher, para cada pedaco da
// malha, QUAL MATERIAL do jogo aquele pedaco e.
//
// A comparacao usa a face de TOPO da rampa. E ela que domina a leitura na vista
// isometrica (o topo pega a luz cheia e as laterais entram escurecidas), entao
// aproximar pelo topo e aproximar pelo que o olho vai ver.
//
// O teto de 20 cores por atlas e uma restricao dura do contrato: sem limite, uma
// textura rica escolheria oito materiais, cada um trazendo tres cores de rampa
// mais os degraus de oclusao, e o export reprovaria DEPOIS de todo o trabalho.
// Por isso a aproximacao acontece em duas etapas — acha o material mais proximo
// de cada cor, depois ESPREME o resultado nos N materiais mais usados.
import { COLORS } from './palette';
import { RAMPS } from './voxel';

export type Rgb = [number, number, number];

/** Cor que representa um material na comparacao: a face de topo da rampa. */
export const materialSwatch = (mat: string): Rgb => {
  const ramp = RAMPS[mat];
  const c = ramp ? COLORS[ramp[0]] : undefined;
  return c ? [c[0], c[1], c[2]] : [255, 255, 255];
};

/**
 * Distancia perceptual barata entre duas cores. Os pesos 2/4/3 aproximam a
 * sensibilidade do olho (mais verde, menos azul): sem eles, azul-escuro e
 * preto ficam "perto" e a Rainha inteira cai no mesmo material.
 */
export const colorDistance = (a: Rgb, b: Rgb): number => {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
};

/** Materiais candidatos: todos os do editor, na ordem estavel das rampas. */
export const MATERIAL_CANDIDATES = Object.keys(RAMPS);

/**
 * Materiais que servem para CORPO: os que tem alguma diferenca entre as tres
 * faces da rampa.
 *
 * `scorch` e `dark/dark/dark` — topo, esquerda e direita na mesma cor. Um voxel
 * desses nao tem volume nenhum: sem contraste entre o topo e as laterais, a
 * forma some e o bicho vira uma silhueta chapada. Ele existe no jogo para chao
 * queimado, onde justamente nao se quer relevo, e por isso nao pode ser a
 * resposta de uma aproximacao de cor.
 */
export const READABLE_MATERIALS = MATERIAL_CANDIDATES.filter((m) => new Set(RAMPS[m]).size > 1);

/** Luminancia Rec.709 — o quanto uma cor "acende" para o olho. */
export const luminance = (c: Rgb): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * Alvo de brilho para o percentil alto da amostra. Perto do topo da paleta
 * (`player` e 240) mas com folga: jogar o percentil 95 no maximo faria a parte
 * mais clara do bicho virar branco chapado.
 */
const ALVO_BRILHO = 190;

/**
 * Corrige a EXPOSICAO da amostra: um ganho unico, aplicado a todas as cores.
 *
 * Sem isto, uma textura escura — o padrao do que sai de gerador 3D, que assume
 * iluminacao na cena — faz TODA a malha cair nos materiais quase pretos. A
 * aproximacao esta certa e o resultado e uma mancha sem forma, porque o que
 * decide a leitura de um sprite de 80px sobre fundo escuro nao e o brilho
 * absoluto do texel.
 *
 * E GANHO, nao esticamento de contraste. Esticar (mapear o percentil baixo para
 * o escuro da paleta e o alto para o claro) FABRICA contraste que a textura nao
 * tem: uma amostra ja bem exposta saia deformada, com o vermelho medio
 * empurrado para o quase preto so porque era o mais escuro da lista. Um ganho
 * multiplica todo mundo pelo mesmo numero, entao matiz, saturacao e a relacao
 * de brilho entre as partes atravessam exatos — so o nivel geral sobe.
 *
 * O percentil 95 e nao o maximo: um unico reflexo estourado definiria o ganho
 * da malha inteira e o resto continuaria escuro.
 *
 * Cor que estouraria o canal recebe MENOS ganho, em vez de ser cortada em 255.
 * Cortar canal a canal muda o matiz — um azul saturado perde so o azul e volta
 * acinzentado —, e matiz e justamente o que a aproximacao vai ler depois.
 */
export const normalizeExposure = (colors: Rgb[]): Rgb[] => {
  if (colors.length === 0) return [];
  const lums = colors.map(luminance).sort((a, b) => a - b);
  const alto = lums[Math.min(lums.length - 1, Math.floor(0.95 * lums.length))];
  if (alto < 1) return colors.map((c) => [...c] as Rgb); // amostra preta: nada a corrigir
  // so corrige o que esta claramente fora: perto do alvo, deixa como esta
  const ganho = Math.max(0.6, Math.min(6, ALVO_BRILHO / alto));
  if (Math.abs(ganho - 1) < 0.08) return colors.map((c) => [...c] as Rgb);
  return colors.map((c) => {
    const pico = Math.max(c[0], c[1], c[2]);
    const g = pico > 0 ? Math.min(ganho, 255 / pico) : ganho;
    return [Math.round(c[0] * g), Math.round(c[1] * g), Math.round(c[2] * g)] as Rgb;
  });
};

export const materialCost = (rgb: Rgb, mat: string): [number, number] => {
  const ramp = RAMPS[mat];
  if (!ramp) return [Infinity, Infinity];
  const face = (name: string): Rgb => {
    const c = COLORS[name];
    return c ? [c[0], c[1], c[2]] : [255, 255, 255];
  };
  return [
    colorDistance(rgb, face(ramp[0])),
    colorDistance(rgb, face(ramp[1])) + colorDistance(rgb, face(ramp[2])),
  ];
};

export const nearestMaterial = (rgb: Rgb, allowed: string[] = READABLE_MATERIALS): string => {
  let best = allowed[0];
  let bestTop = Infinity;
  let bestSide = Infinity;
  for (const mat of allowed) {
    const [top, side] = materialCost(rgb, mat);
    if (top < bestTop || (top === bestTop && side < bestSide)) {
      bestTop = top;
      bestSide = side;
      best = mat;
    }
  }
  return best;
};

export type Quantized = {
  /** material escolhido para cada cor de entrada, na mesma ordem */
  materials: string[];
  /** paleta final, do mais usado ao menos usado */
  used: string[];
};

/**
 * Aproxima uma lista de cores nos materiais do jogo, com teto de quantos
 * materiais distintos podem sobrar.
 *
 * O corte e por AREA (quantas cores caem em cada material), nao por ordem de
 * aparicao: o material que cobre o bicho inteiro tem de sobreviver, e um
 * respingo de cor num canto nao pode gastar uma das vagas.
 */
export const quantizeToMaterials = (
  colors: Rgb[],
  maxMaterials = 4,
  { exposure = true, palette }: { exposure?: boolean; palette?: string[] } = {},
): Quantized => {
  if (colors.length === 0) return { materials: [], used: [] };
  const amostra = exposure ? normalizeExposure(colors) : colors;

  const porUso = (ms: string[]): string[] => {
    const count = new Map<string, number>();
    for (const m of ms) count.set(m, (count.get(m) ?? 0) + 1);
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([m]) => m);
  };

  // PALETA DO AUTOR: ele escolhe QUAIS materiais existem e a textura so decide
  // qual deles cada pedaco e. Deixar a aproximacao escolher sozinha resolve o
  // "que cor e essa" e nao resolve o "que cor eu quero" — uma textura cinza e
  // fielmente aproximada por quatro cinzas, e o bicho some no fundo escuro. O
  // teto de materiais nao se aplica aqui: quem escolheu a lista ja decidiu o
  // tamanho dela.
  if (palette && palette.length > 0) {
    const materials = amostra.map((c) => nearestMaterial(c, palette));
    return { materials, used: porUso(materials) };
  }

  const first = amostra.map((c) => nearestMaterial(c));
  const ranked = porUso(first);
  const used = ranked.slice(0, Math.max(1, maxMaterials));
  if (used.length === ranked.length) return { materials: first, used };

  // os que nao couberam sao reabsorvidos pelo mais proximo entre os que ficaram
  const remap = new Map<string, string>();
  for (const m of ranked) {
    remap.set(m, used.includes(m) ? m : nearestMaterial(materialSwatch(m), used));
  }
  return { materials: first.map((m) => remap.get(m)!), used };
};

/**
 * Cor de cada triangulo da malha, decodificando a textura quando ha uma.
 *
 * Browser-only: decodificar PNG/JPEG usa `createImageBitmap`. A amostragem e no
 * CENTRO do triangulo — um triangulo que vira um punhado de voxels nao comporta
 * variacao de cor dentro dele, e amostrar os tres vertices custaria o triplo
 * para devolver quase sempre a mesma cor.
 */
export const sampleTriangleColors = async (scene: {
  triangleCount: number;
  materials: { baseColor: Rgb; image?: { bytes: Uint8Array; mimeType: string } }[];
  triangleMaterial: Int16Array;
  triangleUv: Float32Array | null;
}): Promise<Rgb[]> => {
  const out: Rgb[] = new Array(scene.triangleCount);

  // uma leitura de pixels por material, reaproveitada por todos os triangulos
  const pixelsOf = new Map<number, { data: Uint8ClampedArray; w: number; h: number }>();
  for (const [i, mat] of scene.materials.entries()) {
    if (!mat.image || !scene.triangleUv) continue;
    try {
      const blob = new Blob([mat.image.bytes as BlobPart], { type: mat.image.mimeType });
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      pixelsOf.set(i, {
        data: ctx.getImageData(0, 0, bmp.width, bmp.height).data,
        w: bmp.width,
        h: bmp.height,
      });
      bmp.close?.();
    } catch {
      // textura ilegivel cai na cor base do material — melhor que abortar o import
    }
  }

  for (let t = 0; t < scene.triangleCount; t++) {
    const mi = scene.triangleMaterial[t];
    const mat = mi >= 0 ? scene.materials[mi] : undefined;
    const tex = mi >= 0 ? pixelsOf.get(mi) : undefined;
    if (!tex || !scene.triangleUv) {
      out[t] = mat ? mat.baseColor : [255, 255, 255];
      continue;
    }
    // UV do glTF tem origem no canto superior esquerdo e repete fora de 0..1
    const u = scene.triangleUv[t * 2];
    const v = scene.triangleUv[t * 2 + 1];
    const px = Math.min(tex.w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * tex.w)));
    const py = Math.min(tex.h - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * tex.h)));
    const i = (py * tex.w + px) * 4;
    const base = mat?.baseColor ?? [255, 255, 255];
    // baseColorFactor MULTIPLICA a textura (spec glTF)
    out[t] = [
      Math.round((tex.data[i] * base[0]) / 255),
      Math.round((tex.data[i + 1] * base[1]) / 255),
      Math.round((tex.data[i + 2] * base[2]) / 255),
    ];
  }
  return out;
};
