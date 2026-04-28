import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeAtomic } from '../src/commands/sprites/atomic-write.js';

test('writeAtomic writes target and removes tmp', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'voxelyn-atomic-'));
  const target = path.join(dir, 'a.bin');
  await writeAtomic(target, new Uint8Array([1, 2, 3]));

  assert.deepEqual([...readFileSync(target)], [1, 2, 3]);
  assert.equal(existsSync(`${target}.tmp`), false);
});
