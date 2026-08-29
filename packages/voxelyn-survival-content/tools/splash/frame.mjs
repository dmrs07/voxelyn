// Conferencia de ENQUADRAMENTO sem renderizar.
//
// Projetar tres pontos custa microssegundos; renderizar para descobrir que o
// Prospector ficou fora do quadro custa minutos. Como o ajuste de camera e
// iterativo por natureza — a composicao so fecha depois de varias tentativas —,
// vale ter o laco curto separado do laco longo.
//
// Imprime a posicao NORMALIZADA (0..1) de cada sujeito e compara com os alvos da
// referencia, para o desvio ser um numero e nao uma impressao.
//
//   node tools/splash/frame.mjs [px py pz tx ty tz fov]
import { createRun } from '@voxelyn/survival-sim';
import { PRESET } from './preset.mjs';
import { makeWindow } from './scene.mjs';
import { createCamera, tileToVoxel, projectPoint } from './camera.mjs';

/**
 * Onde cada sujeito deve cair, em fracao da largura e da altura.
 *
 * Sao os tercos da referencia: o Prospector no terco inferior esquerdo, o
 * Guardiao proximo ao centro, o nucleo no terco superior direito. O branding
 * ocupa o canto inferior direito, e por isso nenhum sujeito pode entrar em
 * x > 0,62 com y > 0,72.
 */
// Os alvos foram MEDIDOS na imagem de referencia, e nao estimados: centro de
// cada sujeito e altura que ele cobre, em fracao da largura e da altura do
// quadro. A primeira versao deste arquivo trazia valores de cabeca (0,70 / 0,54
// / 0,36 na vertical) que espalhavam menos os sujeitos do que a referencia de
// fato espalha — e calibrar contra um alvo errado e pior que nao calibrar.
//
// Uma consequencia da medicao vale registrar, porque restringe tudo o que vem
// depois: em perspectiva, o TAMANHO de um sujeito na tela e a DISTANCIA entre
// sujeitos escalam pelo mesmo fator (ambos sao um comprimento dividido pela
// profundidade vezes a tangente do campo). Nenhuma camera deixa os tres grandes
// e espalhados ao mesmo tempo. A razao entre a distancia Prospector-berco e a
// altura do Guardiao e, portanto, uma propriedade da ENCENACAO e nao da lente:
// na referencia ela vale 2,6, e e esse numero que a montagem tem de perseguir.
export const TARGETS = {
  prospector: { x: 0.21, y: 0.73, height: 0.33 },
  guardian: { x: 0.47, y: 0.35, height: 0.35 },
  core: { x: 0.62, y: 0.20, height: 0.22 },
};

export const frameReport = (cameraOverride) => {
  const { runSeed, sector, width, height } = PRESET.world;
  const state = createRun({ seed: runSeed, sector, width, height, playerCount: 1 });
  const win = makeWindow(
    PRESET.window.x0,
    PRESET.window.y0,
    PRESET.window.x1,
    PRESET.window.y1,
    PRESET.window.depthTiles
  );
  const c = { ...PRESET.camera, ...cameraOverride };
  const cam = createCamera({
    position: tileToVoxel(win, c.position.x, c.position.y, c.position.z),
    target: tileToVoxel(win, c.target.x, c.target.y, c.target.z),
    fovY: c.fovY,
    roll: c.roll ?? 0,
    width: 1920,
    height: 1080,
  });
  // A altura AUTORADA de cada modelo, em tiles (8 unidades autoradas por tile).
  // Medida dos proprios modelos: Guardiao 22 unidades, Prospector 15, nucleo 17.
  const subjects = {
    prospector: { ...PRESET.staging.prospector, z: 1.2, height: 15 / 8 },
    guardian: { ...PRESET.staging.guardian, z: 1.4, height: 22 / 8 },
    core: { ...state.corePos, z: 1.4, height: 17 / 8 },
  };
  const out = {};
  for (const [name, s] of Object.entries(subjects)) {
    const base = projectPoint(cam, tileToVoxel(win, s.x, s.y, 0.5));
    const top = projectPoint(cam, tileToVoxel(win, s.x, s.y, 0.5 + s.height));
    const p = projectPoint(cam, tileToVoxel(win, s.x, s.y, s.z));
    out[name] = p
      ? {
          x: +(p.x / 1920).toFixed(3),
          y: +(p.y / 1080).toFixed(3),
          depthTiles: +(p.depth / 16).toFixed(1),
          // Quanto da ALTURA do quadro o modelo ocupa. E a medida que diz se o
          // chefe le como chefe: posicao certa com tamanho errado ainda erra a
          // composicao, e foi o que aconteceu na primeira calibragem — o
          // Guardiao caiu no lugar exato e ocupava metade da altura que ocupa na
          // referencia.
          heightFrac: base && top ? +((base.y - top.y) / 1080).toFixed(3) : null,
        }
      : null;
  }
  return { camera: c, screen: out, state, win, cam };
};

if (process.argv[1]?.endsWith('frame.mjs')) {
  const a = process.argv.slice(2).map(Number);
  const override = a.length >= 6
    ? {
        position: { x: a[0], y: a[1], z: a[2] },
        target: { x: a[3], y: a[4], z: a[5] },
        ...(a[6] ? { fovY: a[6] } : {}),
      }
    : {};
  const r = frameReport(override);
  console.log('camera', JSON.stringify(r.camera));
  for (const [name, p] of Object.entries(r.screen)) {
    const t = TARGETS[name];
    console.log(
      `  ${name.padEnd(11)} x=${p ? p.x.toFixed(3) : '  ---'} (alvo ${t.x})  ` +
        `y=${p ? p.y.toFixed(3) : '  ---'} (alvo ${t.y})  ` +
        `altura=${p ? (p.heightFrac * 100).toFixed(1) : '--'}% (alvo ${(t.height * 100).toFixed(0)}%)  ` +
        `profundidade=${p ? p.depthTiles : '-'} tiles`
    );
  }
}
