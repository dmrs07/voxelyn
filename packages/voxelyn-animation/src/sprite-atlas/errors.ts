export class AtlasLoadError extends Error {
  constructor(public readonly spriteId: string, reason: string) {
    super(`Atlas '${spriteId}' load failed: ${reason}`);
    this.name = 'AtlasLoadError';
  }
}

export class AtlasDecodeError extends Error {
  constructor(public readonly spriteId: string, reason: string) {
    super(`Atlas '${spriteId}' decode failed: ${reason}`);
    this.name = 'AtlasDecodeError';
  }
}

export class AtlasMissingError extends Error {
  constructor(public readonly spriteId: string) {
    super(`Atlas '${spriteId}' not preloaded. Call preloadCharacterAtlases([...]) at boot.`);
    this.name = 'AtlasMissingError';
  }
}
