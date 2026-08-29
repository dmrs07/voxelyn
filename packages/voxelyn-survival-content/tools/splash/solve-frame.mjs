// SOLUCIONADOR DE COMPOSICAO: acha, por busca, a encenacao e a camera que
// reproduzem a hierarquia visual da referencia.
//
// POR QUE UMA BUSCA, E NAO AJUSTE A MAO
// -------------------------------------
// As variaveis nao sao independentes, e foi tentando separa-las que o ajuste
// manual travou. Tres acoplamentos, todos medidos:
//
//   1. TAMANHO e ESPACAMENTO escalam juntos. Ambos sao um comprimento dividido
//      por (profundidade x tangente do campo), entao nenhuma lente e nenhuma
//      distancia deixa os tres sujeitos grandes E espalhados. A razao entre a
//      distancia Prospector-berco e a altura do Guardiao e uma propriedade da
//      ENCENACAO, e so muda mexendo em onde as pecas estao no mundo.
//   2. AZIMUTE troca largura por profundidade. Girando a camera para perto do
//      eixo Prospector-berco, os tres colapsam na mesma coluna da tela (medido:
//      x = 0,50 para os tres) e o Guardiao passa a tapar o berco. Girando para
//      longe, a diagonal vira quase horizontal e a profundidade some.
//   3. ELEVACAO e ALTURA DO ALVO deslocam o grupo inteiro na vertical, mas nao
//      pela mesma quantidade em cada sujeito — o mais proximo se move mais.
//      Corrigir a posicao de um desregula os outros dois.
//
// Com tres acoplamentos e sete variaveis, tentativa e erro e caro e nao converge.
// A busca resolve em segundos e — o que importa mais para o briefing — deixa a
// composicao sendo um resultado de parametros explicitos e um alvo declarado, em
// vez de um gosto.
//
// O QUE ELA NAO FAZ: mover o berco (e do worldgen), mudar a escala dos modelos,
// ou por qualquer peca sobre celula que nao seja chao aberto de verdade.
import { createRun, SOLID_NONE } from '@voxelyn/survival-sim';
import { PRESET } from './preset.mjs';
import { makeWindow, wallStacks, openDistanceField, STACK_SPACING, BEDROCK_DEPTH } from './scene.mjs';
import { createCamera, tileToVoxel, projectPoint } from './camera.mjs';
import { TARGETS } from './frame.mjs';

const W = 96;

const isOpen = (state, x, y) =>
  x > 0 && y > 0 && x < W - 1 && y < W - 1 && state.solid[y * W + x] === SOLID_NONE;

/**
 * A rocha entre a camera e um sujeito o esconde?
 *
 * Restricao que faltava na primeira versao do solucionador, e a falta custou um
 * render inteiro: a busca entregou uma composicao com desvio de 0,0065 — os tres
 * sujeitos nos tercos certos, do tamanho certo — em que uma parede em (84,87)
 * ficava exatamente na linha de visada do Guardiao. Posicao correta na tela nao
 * significa nada se o que esta naquela posicao e a pedra da frente.
 *
 * O teste caminha pela linha de visada em passos de meio tile, e em cada celula
 * solida compara a ALTURA DO RAIO com a altura da coluna de rocha ali —
 * calculada por `wallStacks`, a mesma funcao que a cena usa para empilhar. Sem
 * essa comparacao o teste rejeitaria qualquer parede no caminho, inclusive as
 * baixas por cima das quais a camera enxerga de sobra, e nao sobraria
 * enquadramento nenhum.
 */
const visible = (state, openDist, maxStacks, cam, subject) => {
  const dx = subject.x - cam.x;
  const dy = subject.y - cam.y;
  const dz = subject.z - cam.z;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.round(cam.x + dx * t);
    const y = Math.round(cam.y + dy * t);
    if (x < 0 || y < 0 || x >= W || y >= W) continue;
    if (state.solid[y * W + x] === SOLID_NONE) continue;
    // Altura do topo da coluna, em tiles: o piso ocupa 1/8 de tile e cada andar
    // de bloco mede 12 voxels finos de 16 por tile.
    const stacks = wallStacks(openDist[y * W + x], x, y, maxStacks);
    const topTiles = (2 + stacks * 12) / 16;
    if (cam.z + dz * t < topTiles) return false;
  }
  return true;
};

/** Alturas autoradas dos modelos, em tiles. Medidas dos proprios modelos. */
const HEIGHTS = { prospector: 15 / 8, guardian: 22 / 8, core: 17 / 8 };

/**
 * Erro de composicao de um enquadramento.
 *
 * A largura entra ponderada por 9/16 para o erro ser medido em unidades de
 * ALTURA de quadro nos dois eixos: sem isso, um desvio horizontal de 0,05 pesa o
 * mesmo que um vertical de 0,05, quando na tela o primeiro e quase o dobro do
 * segundo.
 */
const frameError = (screen) => {
  let err = 0;
  for (const [name, t] of Object.entries(TARGETS)) {
    const p = screen[name];
    // Sujeito atras da camera ou fora do quadro: rejeicao dura, nao penalidade.
    if (!p || p.x < 0.02 || p.x > 0.98 || p.y < 0.02 || p.y > 0.98) return Infinity;
    err += ((p.x - t.x) * (16 / 9)) ** 2 + (p.y - t.y) ** 2;
    // O tamanho pesa menos que a posicao, mas nao pode ser ignorado: foi
    // justamente o sujeito no lugar certo e do tamanho errado que reprovou a
    // primeira montagem.
    err += 0.8 * (p.height - t.height) ** 2;
  }
  return err;
};

const project = (cam, win, subjects) => {
  const out = {};
  for (const [name, s] of Object.entries(subjects)) {
    const p = projectPoint(cam, tileToVoxel(win, s.x, s.y, 1.3));
    const base = projectPoint(cam, tileToVoxel(win, s.x, s.y, 0.5));
    const top = projectPoint(cam, tileToVoxel(win, s.x, s.y, 0.5 + HEIGHTS[name]));
    if (!p || !base || !top) return null;
    out[name] = {
      x: p.x / 1920,
      y: p.y / 1080,
      height: (base.y - top.y) / 1080,
      depth: p.depth / 16,
    };
  }
  return out;
};

export const solve = () => {
  const { runSeed, sector, width, height } = PRESET.world;
  const state = createRun({ seed: runSeed, sector, width, height, playerCount: 1 });
  const win = makeWindow(
    PRESET.window.x0,
    PRESET.window.y0,
    PRESET.window.x1,
    PRESET.window.y1,
    PRESET.window.depthTiles
  );
  const core = state.corePos;
  const openDist = openDistanceField(state);
  const maxStacks = Math.max(
    1,
    Math.floor((win.depth - BEDROCK_DEPTH - 2) / STACK_SPACING)
  );

  // Celulas do condutor: o Prospector tem de estar encostado numa delas.
  const veinCells = new Set();
  for (const seg of state.leylineSegments) for (const c of seg.cells) veinCells.add(c);

  // --- Candidatos a Prospector: chao aberto colado no condutor ---
  const prospectorCells = [];
  for (const cell of veinCells) {
    const cx = cell % W;
    const cy = (cell / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!isOpen(state, x, y)) continue;
        const d = Math.hypot(x - core.x, y - core.y);
        if (d < 6 || d > 13) continue;
        if (!prospectorCells.some((c) => c.x === x && c.y === y)) {
          prospectorCells.push({ x, y, toCore: d, vein: { x: cx, y: cy } });
        }
      }
    }
  }

  // --- Candidatos a Guardiao: chao aberto entre o bot e o berco ---
  const guardianCells = [];
  for (let y = core.y - 8; y <= core.y + 8; y++) {
    for (let x = core.x - 8; x <= core.x + 8; x++) {
      if (!isOpen(state, x, y)) continue;
      const d = Math.hypot(x - core.x, y - core.y);
      if (d < 1.5 || d > 6) continue;
      guardianCells.push({ x, y, toCore: d });
    }
  }

  let best = null;
  for (const p of prospectorCells) {
    for (const g of guardianCells) {
      // O chefe tem de estar ENTRE o bot e o berco, e nao ao lado: a distancia
      // dele ate o segmento que liga os dois mede exatamente isso.
      const ax = core.x - p.x;
      const ay = core.y - p.y;
      const len2 = ax * ax + ay * ay;
      const t = ((g.x - p.x) * ax + (g.y - p.y) * ay) / len2;
      if (t < 0.35 || t > 0.8) continue;
      const offset = Math.hypot(g.x - (p.x + ax * t), g.y - (p.y + ay * t));
      if (offset > 2.5) continue;

      const subjects = {
        prospector: { x: p.x, y: p.y },
        guardian: { x: g.x, y: g.y },
        core: { x: core.x, y: core.y },
      };

      // --- Camera: busca em grade sobre orbita, elevacao, recuo, lente e alvo ---
      //
      // A ALTURA DO ALVO entra na busca em vez de ficar fixa porque ela e o
      // unico controle que desloca o grupo inteiro na vertical sem mexer em mais
      // nada — e com os outros cinco parametros travados no melhor ponto, era
      // sempre ela que sobrava desregulada (o Guardiao caia 0,16 de quadro
      // abaixo do alvo enquanto os outros dois estavam no lugar).
      for (let deg = -180; deg < 180; deg += 6) {
        const th = (deg * Math.PI) / 180;
        for (let elev = 16; elev <= 46; elev += 3) {
          for (let R = 7; R <= 26; R += 1.5) {
            for (const fovY of [26, 28, 30, 32, 34]) {
              for (const tz of [0.4, 1.4, 2.4, 3.4, 4.4]) {
              const cx = g.x + R * Math.cos(th);
              const cy = g.y + R * Math.sin(th);
              const cz = tz + R * Math.tan((elev * Math.PI) / 180);
              const cam = createCamera({
                position: tileToVoxel(win, cx, cy, cz),
                target: tileToVoxel(win, g.x, g.y, tz),
                fovY,
                roll: 0,
                width: 1920,
                height: 1080,
              });
              const screen = project(cam, win, subjects);
              if (!screen) continue;
              // Visibilidade primeiro: e a restricao mais cara, mas tambem a
              // que elimina mais candidatos, e nenhuma medida de composicao
              // significa alguma coisa sobre um sujeito atras de uma pedra.
              const eye = { x: cx, y: cy, z: cz };
              let blocked = false;
              for (const [name, sub] of Object.entries(subjects)) {
                const h = name === 'core' ? 1.6 : HEIGHTS[name] * 0.6;
                if (!visible(state, openDist, maxStacks, eye, { ...sub, z: h })) {
                  blocked = true;
                  break;
                }
              }
              if (blocked) continue;
              // O berco nao pode ficar atras do Guardiao: e um gate de qualidade
              // explicito do briefing, e a projecao responde direto — a distancia
              // horizontal entre os dois centros, em unidades de altura de quadro.
              const sep = Math.abs(screen.core.x - screen.guardian.x) * (16 / 9);
              if (sep < 0.18) continue;
              // E tem de estar MAIS LONGE que o chefe: o berco atras dele e a
              // leitura; na frente, o chefe deixa de estar guardando alguma coisa.
              if (screen.core.depth < screen.guardian.depth + 1.5) continue;
              // O Prospector tem de estar mais PERTO: e o primeiro plano.
              if (screen.prospector.depth > screen.guardian.depth - 1.5) continue;
              const err = frameError(screen);
              if (err === Infinity) continue;
              if (!best || err < best.err) {
                best = {
                  err,
                  prospector: p,
                  guardian: g,
                  camera: { x: +cx.toFixed(2), y: +cy.toFixed(2), z: +cz.toFixed(2), fovY, elev, R, deg },
                  target: { x: g.x, y: g.y, z: tz },
                  screen,
                };
              }
              }
            }
          }
        }
      }
    }
  }
  return { best, state, prospectorCells: prospectorCells.length, guardianCells: guardianCells.length };
};

if (process.argv[1]?.endsWith('solve-frame.mjs')) {
  const { best, prospectorCells, guardianCells } = solve();
  console.log(`candidatos: ${prospectorCells} celulas de Prospector x ${guardianCells} de Guardiao`);
  if (!best) {
    console.log('nenhuma combinacao passou nas restricoes');
  } else {
    console.log(`erro=${best.err.toFixed(4)}`);
    console.log(`  prospector (${best.prospector.x},${best.prospector.y}) colado no condutor (${best.prospector.vein.x},${best.prospector.vein.y})`);
    console.log(`  guardiao   (${best.guardian.x},${best.guardian.y})`);
    console.log(`  camera     pos=(${best.camera.x},${best.camera.y},${best.camera.z}) alvo=(${best.target.x},${best.target.y},${best.target.z}) fov=${best.camera.fovY} elev=${best.camera.elev} R=${best.camera.R}`);
    for (const [name, p] of Object.entries(best.screen)) {
      const t = TARGETS[name];
      console.log(
        `  ${name.padEnd(11)} x=${p.x.toFixed(3)}/${t.x}  y=${p.y.toFixed(3)}/${t.y}  ` +
          `altura=${(p.height * 100).toFixed(1)}%/${(t.height * 100).toFixed(0)}%  profundidade=${p.depth.toFixed(1)}t`
      );
    }
  }
}
