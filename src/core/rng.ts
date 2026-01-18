export class RNG {
  private state: number;

  constructor(seed: number) {
    const s = seed >>> 0;
    this.state = s === 0 ? 0x6d2b79f5 : s;
  }

  nextU32(): number {
    let x = this.state >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    return (this.nextU32() % max) | 0;
  }

  nextFloat01(): number {
    return (this.nextU32() >>> 0) / 0x100000000;
  }
}
