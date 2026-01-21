/**
 * Deterministic pseudo-random number generator using xorshift32.
 * Provides reproducible sequences for simulations and replays.
 */
export class RNG {
  private state: number;

  /**
   * Creates a new RNG with the given seed.
   * @param seed - Initial seed value (0 uses default seed)
   */
  constructor(seed: number) {
    const s = seed >>> 0;
    this.state = s === 0 ? 0x6d2b79f5 : s;
  }

  /**
   * Generates the next unsigned 32-bit integer.
   * @returns Random value in range [0, 2^32 - 1]
   */
  nextU32(): number {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /**
   * Generates a random integer in range [0, max).
   * @param max - Exclusive upper bound
   * @returns Random integer
   */
  nextInt(max: number): number {
    if (max <= 0) return 0;
    return (this.nextU32() % max) | 0;
  }

  /**
   * Generates a random float in range [0, 1).
   * @returns Random float
   */
  nextFloat01(): number {
    return (this.nextU32() >>> 0) / 0x100000000;
  }
}
