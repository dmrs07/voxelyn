import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { EMISSIVE_HEX } from '../src/manifest';
import { EMISSIVE } from '../tools/voxel.mjs';
import { HEX } from '../tools/lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const atlas = (id: string): PNG =>
  PNG.sync.read(readFileSync(resolve(__dirname, `../assets/atlases/${id}.png`)));

const emissivePixels = (id: string): number => {
  const png = atlas(id);
  const wanted = new Set(EMISSIVE_HEX.map((hex) => parseInt(hex.slice(1), 16)));
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i + 3] === 0) continue;
    if (wanted.has((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2])) n++;
  }
  return n;
};

describe('cores emissivas', () => {
  /**
   * A lista que o rasterizador usa para isentar da oclusao e a que o cliente usa
   * para acender o halo tem de ser a MESMA.
   *
   * Divergindo, um material ficaria isento de sombra sem brilhar, ou brilharia
   * recebendo sombra. Nenhum dos dois erros aparece em teste de imagem — so no
   * escuro, em jogo, e por isso o contrato esta preso aqui.
   */
  it('a lista do runtime e a mesma que o rasterizador isenta de sombra', () => {
    const fromRaster = [...EMISSIVE].map((name) => HEX[name]).sort();
    expect([...EMISSIVE_HEX].sort()).toEqual(fromRaster);
  });

  /**
   * As pecas que dependem de brilhar. O farol do Prospector entra aqui porque e
   * autorado em `fire` de proposito: em `loot` ele seria ouro — o material de que
   * sao feitos casco e fivela — e a peca que o bot usa para enxergar no escuro
   * acenderia menos que o minerio no chao.
   */
  it.each([
    ['player-prospector'],
    ['layer-player-prospector-upper'],
    ['layer-player-prospector-gun'],
    ['enemy-bishop'],
    ['enemy-fungal-horse'],
    ['enemy-miner'],
  ])('%s tem pixel emissivo para o halo acender', (id) => {
    expect(emissivePixels(id)).toBeGreaterThan(0);
  });

  /**
   * E as que nao dependem. A camada das pernas nao tem uma luz sequer, e e assim
   * que o banco de sprites descobre que pode pular o halo dela inteiro em vez de
   * compor uma imagem vazia por quadro.
   */
  it('a camada das pernas nao tem luz nenhuma', () => {
    expect(emissivePixels('layer-player-prospector-lower')).toBe(0);
  });

  /**
   * Ouro e branco NAO emitem. E a decisao mais facil de reverter por engano — os
   * dois sao claros e "parecem" luz —, e reverte-la faria o baculo do Bispo, a
   * fivela do Prospector e todo casco do Corcel brilharem, prometendo uma
   * mecanica que o jogo nao tem.
   */
  it('nao trata ouro nem branco como fonte de luz', () => {
    expect(EMISSIVE_HEX).not.toContain(HEX.loot);
    expect(EMISSIVE_HEX).not.toContain(HEX.player);
  });
});
