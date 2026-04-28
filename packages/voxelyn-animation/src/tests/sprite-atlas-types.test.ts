import { describe, expect, it } from 'vitest';
import { AtlasDecodeError, AtlasLoadError, AtlasMissingError } from '../sprite-atlas/errors.js';

describe('sprite atlas errors', () => {
  it('carry spriteId and reason', () => {
    const loadError = new AtlasLoadError('striker', 'fetch 404');
    expect(loadError.spriteId).toBe('striker');
    expect(loadError.message).toMatch(/striker/);
    expect(loadError.message).toMatch(/fetch 404/);

    const decodeError = new AtlasDecodeError('striker', 'png header bad');
    expect(decodeError.spriteId).toBe('striker');

    const missingError = new AtlasMissingError('striker');
    expect(missingError.spriteId).toBe('striker');
    expect(missingError.message).toMatch(/not preloaded/);
  });
});
