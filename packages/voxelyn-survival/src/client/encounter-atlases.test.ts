import { afterEach, expect, it, vi } from 'vitest';
import { SpriteBank, ARCHETYPE_DIRECTIONS } from './sprites';

afterEach(() => vi.unstubAllGlobals());

it('evicts old encounters and cancels in-flight normals before loading the next boss', () => {
  const images: TestImage[] = [];
  class TestImage {
    src = '';
    naturalWidth = 1;
    naturalHeight = 1;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      images.push(this);
    }
    removeAttribute() {
      this.src = '';
    }
  }
  vi.stubGlobal('Image', TestImage);
  const bank = new SpriteBank();
  bank.retainEncounter('diamandis');
  bank.requestPart('part-diamandis-drill');
  images[0].onload!();
  const drill = bank.get('part-diamandis-drill')!;
  // Exercise the asynchronous boundary without needing a GPU in the unit test.
  const normal = bank as unknown as { requestNormal(entry: typeof drill): void };
  normal.requestNormal(drill);
  const lateLoad = images[1].onload!;
  bank.retainEncounter('seamstress');
  expect(bank.get('part-diamandis-drill')).toBeNull();
  expect(images[0].src).toBe('');
  expect(images[1].src).toBe('');
  expect(images[1].onload).toBeNull();
  lateLoad();
  expect(drill.normal).toBeNull();
  bank.requestPart('enemy-seamstress');
  images[2].onload!();
  const queen = bank.get('enemy-seamstress')!;
  normal.requestNormal(queen);
  images[3].onload!();
  expect(queen.normalState).toBe('ready');
  bank.retainEncounter('guardian');
  expect(bank.get('enemy-seamstress')).toBeNull();
  expect(queen.normal).toBeNull();
  expect(bank.allIds()).not.toContain('enemy-seamstress');
  expect(ARCHETYPE_DIRECTIONS.seamstress).toBe(8);
});
