import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  pickPixellabId,
  readPixellabIdCache,
  writePixellabIdCache,
} from '../src/commands/sprites/cache.js';

test('cache round-trip and conceptHash gate', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'voxelyn-cache-'));
  const file = path.join(dir, '.voxelyn-cache/pixellab-character-ids.json');

  assert.deepEqual(await readPixellabIdCache(file), {});

  await writePixellabIdCache(file, { striker: { id: 'plab-123', conceptHash: 'h1' } });
  const cache = await readPixellabIdCache(file);

  assert.equal(cache.striker?.id, 'plab-123');
  assert.equal(pickPixellabId(cache, 'striker', 'h1'), 'plab-123');
  assert.equal(pickPixellabId(cache, 'striker', 'h2'), undefined);
});
