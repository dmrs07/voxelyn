// O PASSE DE RENDER: um raio por pixel, iluminacao construida na cena, e um
// G-buffer completo saindo junto do beauty.
//
// A LUZ E CONSTRUIDA, NAO PINTADA
// -------------------------------
// O rasterizador do jogo nao ilumina: ele ESCOLHE, por face, uma cor da paleta
// mestra (`RAMPS`), e escurece ou clareia um degrau conforme a oclusao
// (`SHADOW_OF` / `LIGHT_OF`). E o certo para um atlas de sprites com paleta
// travada — a arte fica igual em qualquer lugar do mapa e o validador consegue
// provar isso.
//
// Uma splash pede o oposto: a luz TEM de dizer onde esta a fonte. Aqui, entao,
// a cor da paleta e o ALBEDO — a refletancia do material, o dado — e a imagem
// sai de uma equacao com luzes que tem posicao, cor e alcance. O nucleo ilumina
// porque ha uma luz na posicao dele, e nao porque alguem clareou os voxels em
// volta.
//
// A paleta continua sendo a fonte da cor: nenhuma cor entra na cena que nao
// venha de `COLORS` ou de uma luz declarada em `lights.mjs`.
//
// TUDO EM LINEAR. As cores da paleta sao sRGB (e o que um monitor mostra); somar
// luz em sRGB escurece as misturas e estoura os realces cedo demais. A conversao
// acontece uma vez, na tabela abaixo, e a volta so no compositor.
import { MATERIAL_RGB, EMISSIVE_BY_ID } from './geometry.mjs';
import { rayDirection } from './camera.mjs';
import { createHit, trace, occluded, AXIS_X, AXIS_Y, AXIS_Z } from './trace.mjs';

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

/** Albedo linear por id de material, pre-calculado uma vez. */
export const ALBEDO_LINEAR = MATERIAL_RGB.map(([r, g, b]) => [
  srgbToLinear(r),
  srgbToLinear(g),
  srgbToLinear(b),
]);

/** As tres normais possiveis, indexadas por eixo. O sinal entra na hora. */
const NORMALS = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/**
 * Oclusao de ambiente por amostragem da vizinhanca da face atingida.
 *
 * Mesma ideia do `ambientOcclusionSteps` do rasterizador do jogo — contar
 * materia em volta da celula vazia a frente da face —, com duas diferencas que a
 * camera livre obriga. Primeira: aqui a resposta e continua e nao dois degraus,
 * porque nao ha uma paleta travada para respeitar e ha resolucao de sobra.
 * Segunda: a vizinhanca amostrada e a dos oito vizinhos NO PLANO da face mais os
 * quatro diagonais do proprio plano, e nao apenas os do eixo — uma face vista de
 * angulo mostra area demais para o teste de tres vizinhos do sprite.
 */
const ambientOcclusion = (scene, x, y, z, axis, sign) => {
  const { width, height, depth, mat } = scene;
  // Celula vazia imediatamente a frente da face.
  const ax = x + (axis === AXIS_X ? sign : 0);
  const ay = y + (axis === AXIS_Y ? sign : 0);
  const az = z + (axis === AXIS_Z ? sign : 0);
  // Os dois eixos que varrem o plano da face.
  const u = axis === AXIS_X ? AXIS_Y : AXIS_X;
  const v = axis === AXIS_Z ? AXIS_Y : AXIS_Z;
  let count = 0;
  for (let a = -1; a <= 1; a++) {
    for (let b = -1; b <= 1; b++) {
      if (a === 0 && b === 0) continue;
      const px = ax + (u === AXIS_X ? a : 0) + (v === AXIS_X ? b : 0);
      const py = ay + (u === AXIS_Y ? a : 0) + (v === AXIS_Y ? b : 0);
      const pz = az + (u === AXIS_Z ? a : 0) + (v === AXIS_Z ? b : 0);
      if (px < 0 || py < 0 || pz < 0 || px >= width || py >= height || pz >= depth) continue;
      if (mat[(pz * height + py) * width + px] !== 0) count++;
    }
  }
  // Oito vizinhos ocupados = fundo de fresta. A curva nao e linear porque a
  // percepcao de sombra de contato tambem nao e: os primeiros vizinhos escurecem
  // muito mais que os ultimos.
  return 1 - 0.72 * (count / 8) ** 0.75;
};

/**
 * Buffers de saida. Um array por passe, e nao um objeto por pixel: sao milhoes
 * de pixels, e o briefing pede os passes auxiliares como entrega.
 */
export const createBuffers = (width, height) => ({
  width,
  height,
  /** Radiancia linear HDR. O compositor faz o tonemap. */
  beauty: new Float32Array(width * height * 3),
  /** Refletancia crua do material, sem luz nenhuma. */
  albedo: new Float32Array(width * height * 3),
  /** Normal da face, codificada em [-1,1]. */
  normal: new Float32Array(width * height * 3),
  /** Distancia da camera ate a superficie, em voxels finos. */
  depth: new Float32Array(width * height),
  /** So o que EMITE, sem a luz refletida. Alimenta o bloom seletivo. */
  emissive: new Float32Array(width * height * 3),
  /** Oclusao de ambiente isolada. */
  ao: new Float32Array(width * height),
  /** Visibilidade da luz principal: 1 exposto, 0 na sombra. */
  shadow: new Float32Array(width * height),
  /** Id de objeto — a segmentacao. */
  objectId: new Uint8Array(width * height),
});

/**
 * Renderiza uma faixa de linhas. Recortado em faixas porque e assim que o
 * trabalho e dividido entre processos: cada um preenche linhas diferentes dos
 * mesmos buffers, sem contencao.
 */
export const renderBand = (scene, cam, lights, buffers, rowStart, rowEnd, options = {}) => {
  const hit = createHit();
  const dir = [0, 0, 0];
  const maxT = Math.hypot(scene.width, scene.height, scene.depth);
  const {
    ambient,
    key,
    points,
    emissiveStrength,
    fog,
  } = lights;
  const samples = options.samples ?? 1;
  const { width, height } = buffers;

  for (let py = rowStart; py < rowEnd; py++) {
    for (let px = 0; px < width; px++) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let firstDepth = 0;
      let firstAo = 0;
      let firstShadow = 0;
      let firstObj = 0;
      let firstMat = 0;
      let nx = 0;
      let ny = 0;
      let nz = 0;
      let er = 0;
      let eg = 0;
      let eb = 0;

      for (let s = 0; s < samples; s++) {
        // Amostragem em grade rotacionada dentro do pixel. Determinística: o
        // deslocamento sai do indice da amostra, nunca de um gerador aleatorio,
        // para dois renders da mesma cena serem identicos bit a bit.
        const jx = samples === 1 ? 0 : ((s % 2) - 0.5) * 0.5;
        const jy = samples === 1 ? 0 : ((s >> 1) - 0.5) * 0.5;
        rayDirection(cam, px + jx, py + jy, dir);
        trace(scene, cam.position[0], cam.position[1], cam.position[2], dir[0], dir[1], dir[2], maxT, hit);

        let sr = 0;
        let sg = 0;
        let sb = 0;
        let ser = 0;
        let seg = 0;
        let seb = 0;
        let depth = maxT;
        let ao = 1;
        let shadowVis = 0;
        let obj = 0;
        let mat = 0;
        let n = [0, 0, 0];

        if (hit.hit) {
          mat = hit.mat;
          obj = hit.obj;
          depth = hit.t;
          const albedo = ALBEDO_LINEAR[mat];
          const base = NORMALS[hit.axis];
          n = [base[0] * hit.sign, base[1] * hit.sign, base[2] * hit.sign];
          nx += n[0];
          ny += n[1];
          nz += n[2];

          // Ponto de sombreamento: meio voxel para fora da face, senao o raio de
          // sombra nasce dentro do proprio voxel e tudo se auto-oculta.
          const hx = cam.position[0] + dir[0] * hit.t + n[0] * 0.02;
          const hy = cam.position[1] + dir[1] * hit.t + n[1] * 0.02;
          const hz = cam.position[2] + dir[2] * hit.t + n[2] * 0.02;

          const emissive = EMISSIVE_BY_ID[mat] === 1;
          ao = emissive ? 1 : ambientOcclusion(scene, hit.x, hit.y, hit.z, hit.axis, hit.sign);

          // --- Ambiente frio, modulado pela oclusao e pela orientacao ---
          // O ceu de uma caverna e a propria rocha alta reemitindo o pouco que
          // recebe; entao a face de cima ve mais dele que as laterais. Sem esse
          // vies o ambiente vira um banho chapado e a geometria some.
          const skyFacing = 0.55 + 0.45 * Math.max(0, n[2]);
          sr += albedo[0] * ambient[0] * ao * skyFacing;
          sg += albedo[1] * ambient[1] * ao * skyFacing;
          sb += albedo[2] * ambient[2] * ao * skyFacing;

          // --- Luz principal fria, vinda de cima ---
          const ndl = n[0] * key.dir[0] + n[1] * key.dir[1] + n[2] * key.dir[2];
          if (ndl > 0) {
            shadowVis = occluded(scene, hx, hy, hz, key.dir[0], key.dir[1], key.dir[2], key.shadowRange)
              ? 0
              : 1;
            if (shadowVis > 0) {
              const k = ndl * key.intensity;
              sr += albedo[0] * key.color[0] * k;
              sg += albedo[1] * key.color[1] * k;
              sb += albedo[2] * key.color[2] * k;
            }
          }

          // --- Luzes pontuais: nucleo, Vein, pontos ambar ---
          for (let li = 0; li < points.length; li++) {
            const L = points[li];
            const lx = L.pos[0] - hx;
            const ly = L.pos[1] - hy;
            const lz = L.pos[2] - hz;
            const d2 = lx * lx + ly * ly + lz * lz;
            if (d2 > L.radius2) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const ndlp = (n[0] * lx + n[1] * ly + n[2] * lz) / d;
            if (ndlp <= 0) continue;
            // Queda suave que ZERA no alcance. A queda fisica (1/d^2) nunca
            // chega a zero, e uma luz que nunca acaba obriga a testar todas as
            // luzes em todos os pixels — alem de deixar um veu por toda a cena.
            const fall = 1 - d / L.radius;
            const atten = (fall * fall) / (1 + d * d * L.falloff);
            let vis = 1;
            if (L.shadow) {
              vis = occluded(scene, hx, hy, hz, lx / d, ly / d, lz / d, d - 0.5) ? 0 : 1;
            }
            if (vis === 0) continue;
            const k = ndlp * atten * L.intensity * (L.ignoreAo ? 1 : ao);
            sr += albedo[0] * L.color[0] * k;
            sg += albedo[1] * L.color[1] * k;
            sb += albedo[2] * L.color[2] * k;
          }

          // --- Emissao propria ---
          // Material emissivo e FONTE: a cor dele entra inteira, sem depender de
          // nenhuma luz. E o que faz o visor do Prospector, o cristal do berco e
          // o condutor da Vein acenderem no escuro.
          if (emissive) {
            // A forca de emissao tem DUAS entradas: o material e o objeto.
            //
            // O material sozinho nao basta porque o mesmo `electric` aparece em
            // dois papeis opostos na mesma cena: no condutor CARREGADO da Vein,
            // que a simulacao acabou de acender, e no nucleo do Guardiao, que
            // esta em repouso. Uma unica constante servia mal aos dois — no
            // valor que fazia a Vein aparecer, o nucleo do chefe estourava numa
            // mancha branca do tamanho de um tile; no valor que segurava o
            // nucleo, a Vein sumia.
            //
            // O id de objeto resolve sem truque: ele ja distingue os dois, e a
            // distincao corresponde a um fato da simulacao (uma das celulas esta
            // em `state.charges`, a outra nao).
            const strength =
              (emissiveStrength[mat] ?? emissiveStrength.default) *
              (emissiveStrength.byObject?.[obj] ?? 1);
            ser = albedo[0] * strength;
            seg = albedo[1] * strength;
            seb = albedo[2] * strength;
            sr += ser;
            sg += seg;
            sb += seb;
          }

          // --- Bruma por profundidade ---
          // Ar de caverna com poeira em suspensao: quanto mais longe, mais luz
          // dispersa entra no caminho e menos contraste sobrevive. E o que abre
          // a profundidade sem precisar de neblina chapada sobre a imagem toda.
          const fogAmount = 1 - Math.exp(-depth * fog.density);
          sr = sr * (1 - fogAmount) + fog.color[0] * fogAmount;
          sg = sg * (1 - fogAmount) + fog.color[1] * fogAmount;
          sb = sb * (1 - fogAmount) + fog.color[2] * fogAmount;
        } else {
          // Sem contato: o vazio da caverna. Nao e preto puro — preto esmagado e
          // um dos defeitos que o briefing proibe — e sim a cor da bruma no
          // limite, que e para onde tudo converge com a distancia.
          sr = fog.color[0];
          sg = fog.color[1];
          sb = fog.color[2];
        }

        // ------------------------------------------------------------------
        // ESPALHAMENTO VOLUMETRICO: a luz que o AR devolve, antes de qualquer
        // superficie.
        //
        // Sem isto, uma fonte de luz so existe pelo que ela ilumina. O cristal
        // do berco acendia o pedestal e as quatro colunas em volta e nada mais,
        // e o resultado era um objeto brilhante colado num fundo escuro — nunca
        // uma fonte DENTRO de um espaco. O briefing pede exatamente o contrario:
        // "pequena coluna volumetrica vertical, se suportada pela engine".
        //
        // A integracao e uma soma de Riemann ao longo do proprio raio primario,
        // do olho ate a primeira superficie: em cada amostra, quanta luz a fonte
        // entrega naquele ponto do ar, vezes a densidade do meio, vezes o
        // comprimento do passo. E o mesmo `atten` das superficies, porque e a
        // mesma luz — o que muda e nao haver normal para o produto escalar, ja
        // que um volume de poeira espalha em todas as direcoes.
        //
        // NAO ha teste de sombra por amostra. Ele daria raios-de-deus recortados
        // pela geometria, e custaria dezenas de tracados por pixel — em 4K, mais
        // que o render inteiro. Sem ele o meio e uniforme e o resultado e um
        // halo suave em volta da fonte, que e o que a referencia mostra e o que o
        // briefing pede (halo controlado, nunca bloom continuo).
        for (let li = 0; li < points.length; li++) {
          const L = points[li];
          if (!L.volumetric) continue;
          const far = Math.min(depth, L.radius * 2);
          const steps = 12;
          const stepLen = far / steps;
          let acc = 0;
          for (let k = 0; k < steps; k++) {
            const t = (k + 0.5) * stepLen;
            const px2 = cam.position[0] + dir[0] * t;
            const py2 = cam.position[1] + dir[1] * t;
            const pz2 = cam.position[2] + dir[2] * t;
            const lx = L.pos[0] - px2;
            const ly = L.pos[1] - py2;
            const lz = L.pos[2] - pz2;
            const d2 = lx * lx + ly * ly + lz * lz;
            if (d2 > L.radius2) continue;
            const d = Math.sqrt(d2);
            const fall = 1 - d / L.radius;
            acc += (fall * fall) / (1 + d * d * L.falloff) * stepLen;
          }
          const k = acc * L.volumetric;
          sr += L.color[0] * k;
          sg += L.color[1] * k;
          sb += L.color[2] * k;
        }

        rr += sr;
        gg += sg;
        bb += sb;
        er += ser;
        eg += seg;
        eb += seb;
        if (s === 0) {
          firstDepth = depth;
          firstAo = ao;
          firstShadow = shadowVis;
          firstObj = obj;
          firstMat = mat;
        }
      }

      const inv = 1 / samples;
      const p = py * width + px;
      const p3 = p * 3;
      buffers.beauty[p3] = rr * inv;
      buffers.beauty[p3 + 1] = gg * inv;
      buffers.beauty[p3 + 2] = bb * inv;
      buffers.emissive[p3] = er * inv;
      buffers.emissive[p3 + 1] = eg * inv;
      buffers.emissive[p3 + 2] = eb * inv;
      const alb = ALBEDO_LINEAR[firstMat];
      buffers.albedo[p3] = alb[0];
      buffers.albedo[p3 + 1] = alb[1];
      buffers.albedo[p3 + 2] = alb[2];
      const nl = Math.hypot(nx, ny, nz) || 1;
      buffers.normal[p3] = nx / nl;
      buffers.normal[p3 + 1] = ny / nl;
      buffers.normal[p3 + 2] = nz / nl;
      buffers.depth[p] = firstDepth;
      buffers.ao[p] = firstAo;
      buffers.shadow[p] = firstShadow;
      buffers.objectId[p] = firstObj;
    }
  }
  return buffers;
};
