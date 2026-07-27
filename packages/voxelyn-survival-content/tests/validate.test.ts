import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - ferramenta JS sem tipos
import { listIds, validateManifest, validateSurfaces, validateTerrain } from '../tools/validate.mjs';
import { FIRST_PACK_IDS, resolveFrame, dirFromFacing, type SpriteManifestEntry } from '../src/manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadManifest = (id: string): SpriteManifestEntry =>
  JSON.parse(readFileSync(resolve(__dirname, `../assets/atlases/${id}.json`), 'utf8'));

describe('validacao automatizada de sprites', () => {
  it('todos os sprites do primeiro pacote passam na validacao', () => {
    const ids: string[] = listIds();
    expect(ids.sort()).toEqual([...FIRST_PACK_IDS].sort());
    for (const id of ids) {
      const errors: string[] = validateManifest(id);
      expect(errors, `${id}:\n${errors.join('\n')}`).toEqual([]);
    }
  });

  // Terreno e chao ficam fora do `index.json` de sprites — nao tem animacao por
  // direcao nem frameMap — entao passariam despercebidos por `listIds()`. Sao
  // justamente os dois atlases assados a partir do codigo do gerador, os que
  // dessincronizam em silencio se alguem mexer no modelo e nao regerar.
  it('os atlases de cenario passam nas proprias regras', () => {
    for (const [id, errors] of [
      ['terrain-blocks', validateTerrain() as string[]],
      ['surface-tiles', validateSurfaces() as string[]],
    ] as Array<[string, string[]]>) {
      expect(errors, `${id}:\n${errors.join('\n')}`).toEqual([]);
    }
  });
});

describe('resolvedor de frames', () => {
  it('mapeia direcao/anim/frame para colunas dentro do atlas', () => {
    const m = loadManifest('player-prospector');
    const idle0 = resolveFrame(m, 'idle', 'dr', 0);
    expect(idle0.sx).toBe(0);
    expect(idle0.flip).toBe(false);
    expect(idle0.sw).toBe(m.frameWidth);

    // walk comeca depois dos 4 frames de idle
    const walk0 = resolveFrame(m, 'walk', 'dr', 0);
    expect(walk0.sx).toBe(4 * m.frameWidth);

    // wraparound de frame respeita a contagem
    const idleWrap = resolveFrame(m, 'idle', 'dr', 5);
    expect(idleWrap.sx).toBe(resolveFrame(m, 'idle', 'dr', 1).sx);
  });

  it('direcoes isometricas autoradas usam colunas proprias sem flip', () => {
    const m = loadManifest('player-prospector');
    expect(m.authoredDirs).toEqual(['dr', 'dl', 'ur', 'ul']);
    expect(m.flipPairs).toEqual({});

    const dr = resolveFrame(m, 'walk', 'dr', 2);
    const dl = resolveFrame(m, 'walk', 'dl', 2);
    expect(dr.flip).toBe(false);
    expect(dl.flip).toBe(false);
    expect(dl.sx).not.toBe(dr.sx);
  });

  it('mantem suporte a flipPairs quando um manifest o declara explicitamente', () => {
    const authored = loadManifest('player-prospector');
    const symmetric: SpriteManifestEntry = {
      ...authored,
      authoredDirs: ['dr'],
      flipPairs: { dl: 'dr' },
      frameMap: { dr: authored.frameMap.dr },
    };
    const dr = resolveFrame(symmetric, 'walk', 'dr', 2);
    const dl = resolveFrame(symmetric, 'walk', 'dl', 2);
    expect(dl.flip).toBe(true);
    expect(dl.sx).toBe(dr.sx);
  });

  it('dirFromFacing classifica os quadrantes isometricos', () => {
    // eixos do mundo mapeiam para as 4 direcoes autoradas na tela iso
    expect(dirFromFacing(1, 0)).toBe('dr'); // +x
    expect(dirFromFacing(0, 1)).toBe('dl'); // +y
    expect(dirFromFacing(0, -1)).toBe('ur'); // -y
    expect(dirFromFacing(-1, 0)).toBe('ul'); // -x
  });

  it('FX de direcao unica nunca faz flip', () => {
    const bolt = loadManifest('fx-projectile-bolt');
    const r = resolveFrame(bolt, 'fly', 'n', 3);
    expect(r.flip).toBe(false);
    expect(bolt.directions).toBe(1);
  });
});
