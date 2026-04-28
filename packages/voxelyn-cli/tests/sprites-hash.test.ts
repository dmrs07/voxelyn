import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Bytes, sha256CanonicalJson } from '../src/commands/sprites/hash.js';

test('sha256Bytes is deterministic', () => {
  const a = sha256Bytes(new Uint8Array([1, 2, 3]));
  const b = sha256Bytes(new Uint8Array([1, 2, 3]));
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test('sha256CanonicalJson sorts keys', () => {
  assert.equal(sha256CanonicalJson({ b: 1, a: 2 }), sha256CanonicalJson({ a: 2, b: 1 }));
});

test('sha256CanonicalJson differentiates content', () => {
  assert.notEqual(sha256CanonicalJson({ a: 1 }), sha256CanonicalJson({ a: 2 }));
});
