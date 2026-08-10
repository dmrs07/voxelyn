import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const atlasDir = resolve(__dirname, '../assets/atlases');
const read = (file) => PNG.sync.read(readFileSync(resolve(atlasDir, file)));
const manifest = (id) => JSON.parse(readFileSync(resolve(atlasDir, `${id}.json`), 'utf8'));

/**
 * O MAPA DE FACES e a normal por pixel do sprite, e num jogo de voxel ela nao e
 * aproximada: cada pixel saiu de UMA das tres faces que a projecao mostra, e o
 * rasterizador sabe qual no instante em que pinta.
 *
 * O que estes testes protegem e a unica coisa que pode quebrar em silencio: o
 * ALINHAMENTO entre o mapa e a arte. Um mapa deslocado meio corpo continua
 * sendo um PNG valido, continua carregando, e ilumina o ombro esquerdo quando a
 * tocha esta a direita — um defeito que ninguem associaria ao gerador.
 */

/**
 * Tudo que o jogo desenha como VOLUME e que recebe luz do mundo. FX emitem luz
 * e ficam de fora.
 *
 * `world-props` entra na mesma lista e passa nas mesmas regras, apesar de vir
 * de outro construtor (sem direcoes, sem animacao por direcao, sem
 * enquadramento por margem): o contrato do mapa de faces nao e sobre COMO o
 * atlas foi montado, e sim que ele descreva pixel a pixel o atlas de arte
 * irmao. Um teste que so soubesse conferir personagem deixaria metade do
 * cenario sem cobertura.
 */
const LIT_SPRITES = [
  'world-props',
  'player-prospector',
  'layer-player-prospector-lower',
  'layer-player-prospector-upper',
  'layer-player-prospector-gun',
  'enemy-stalker',
  'enemy-spitter',
  'enemy-bruiser',
  'enemy-bishop',
  'enemy-miner',
  'enemy-fungal-horse',
];

describe('mapa de faces: existencia e contrato', () => {
  it.each(LIT_SPRITES)('%s publica o mapa e a escala no manifest', (id) => {
    const m = manifest(id);
    expect(m.normalAtlas).toBe(`${id}.normal.png`);
    expect(m.normalScale).toBe(2);
    expect(existsSync(resolve(atlasDir, m.normalAtlas))).toBe(true);
  });

  /**
   * FX ficam de fora de proposito: o ciclone e o impacto sao FONTE de luz, e um
   * mapa de faces para eles seria memoria gasta para iluminar o que ja brilha.
   */
  it('FX nao ganham mapa de faces', () => {
    for (const id of ['fx-fire-cyclone', 'fx-impact-burst', 'fx-projectile-bolt']) {
      expect(manifest(id).normalAtlas).toBeUndefined();
      expect(existsSync(resolve(atlasDir, `${id}.normal.png`))).toBe(false);
    }
  });
});

/**
 * Timeout proprio nos dois que varrem o atlas INTEIRO pixel a pixel: um sheet de
 * chefe tem 1,7 milhao de pixels e quatro direcoes, e a varredura encosta nos
 * 5s padrao do vitest. O teste nao esta lento por acidente — ele confere cada
 * pixel de proposito, porque um desalinhamento de um unico pixel na borda ja
 * ilumina a face errada.
 */
describe('mapa de faces: alinhamento com a arte', () => {
  /**
   * A dimensao tem de ser a do sprite dividida pela escala, EXATAMENTE. Um
   * arredondamento para outro lado deslocaria cada frame progressivamente ao
   * longo do atlas — o primeiro sairia certo e o ultimo, meio corpo fora.
   */
  it.each(LIT_SPRITES)('%s tem a grade de frames do sprite, em meia resolucao', (id) => {
    const m = manifest(id);
    const art = read(m.atlas);
    const normal = read(m.normalAtlas);
    expect(normal.width).toBe(Math.ceil(art.width / m.normalScale));
    expect(normal.height).toBe(Math.ceil(art.height / m.normalScale));
  });

  /**
   * A SILHUETA e o contrato de verdade: onde a arte tem pixel, o mapa tem face.
   *
   * Conferida em meia resolucao — um pixel do mapa cobre um bloco 2x2 da arte, e
   * o que se cobra e que nenhum bloco com arte fique sem face (um furo sem luz
   * no meio do corpo) e que nenhuma face apareca onde nao ha arte (luz fora do
   * corpo). Sao os dois modos de falha do desalinhamento, e ambos aparecem aqui
   * como contagem, e nao como "parece certo".
   */
  it.each(LIT_SPRITES)('%s cobre a silhueta inteira e nada alem dela', { timeout: 30_000 }, (id) => {
    const m = manifest(id);
    const art = read(m.atlas);
    const normal = read(m.normalAtlas);
    const s = m.normalScale;

    let missingFace = 0;
    let strayFace = 0;
    for (let y = 0; y < normal.height; y++) {
      for (let x = 0; x < normal.width; x++) {
        const ni = (y * normal.width + x) * 4;
        const hasFace = normal.data[ni + 3] !== 0;
        let hasArt = false;
        for (let sy = 0; sy < s && !hasArt; sy++) {
          for (let sx = 0; sx < s; sx++) {
            const ax = x * s + sx;
            const ay = y * s + sy;
            if (ax >= art.width || ay >= art.height) continue;
            if (art.data[(ay * art.width + ax) * 4 + 3] !== 0) {
              hasArt = true;
              break;
            }
          }
        }
        if (hasArt && !hasFace) missingFace++;
        if (!hasArt && hasFace) strayFace++;
      }
    }
    expect(missingFace).toBe(0);
    expect(strayFace).toBe(0);
  });

  /**
   * Cada pixel do mapa carrega UMA face, num canal puro. Dois canais acesos no
   * mesmo pixel significariam que a reducao a metade misturou faces em vez de
   * escolher a dominante — e a matriz de cor do cliente somaria a luz das duas
   * naquele pixel, clareando toda fronteira do corpo.
   */
  it.each(LIT_SPRITES)('%s carrega exatamente uma face por pixel', { timeout: 30_000 }, (id) => {
    const m = manifest(id);
    const normal = read(m.normalAtlas);
    const seen = new Set();
    for (let i = 0; i < normal.data.length; i += 4) {
      if (normal.data[i + 3] === 0) continue;
      const lit = [normal.data[i], normal.data[i + 1], normal.data[i + 2]].filter((c) => c > 0);
      expect(lit).toHaveLength(1);
      expect(lit[0]).toBe(255);
      seen.add(`${normal.data[i]},${normal.data[i + 1]},${normal.data[i + 2]}`);
    }
    // E as tres faces aparecem: um corpo em que so uma face existe nao e um
    // corpo, e denunciaria uma rotacao ou uma tabela de cubo quebrada.
    expect(seen.size).toBe(3);
  });
});
