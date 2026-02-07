export type MaterialMap = {
  readonly EMPTY: number;
  readonly SAND: number;
  readonly WATER: number;
  readonly OIL: number;
  readonly ROCK: number;
  readonly WOOD: number;
  readonly FIRE: number;
  readonly SMOKE: number;
  readonly ACID: number;
  readonly PLAYER: number;
};

export type WandDefinition = {
  readonly id: string;
  readonly name: string;
  readonly cooldown: number;
  readonly spread: number;
  readonly projectileSpeed: number;
  readonly burst: number;
  readonly payloads: readonly number[];
  readonly impact: "explode" | "splash";
  readonly trail?: number;
};

type RandomSource = {
  nextInt(max: number): number;
};

export const createWands = (mat: MaterialMap): WandDefinition[] => [
  {
    id: "spark",
    name: "Spark Wand",
    cooldown: 6,
    spread: 0.18,
    projectileSpeed: 2.7,
    burst: 1,
    payloads: [mat.FIRE, mat.SMOKE],
    impact: "explode",
    trail: mat.FIRE
  },
  {
    id: "alchemist",
    name: "Alchemist Wand",
    cooldown: 8,
    spread: 0.22,
    projectileSpeed: 2.1,
    burst: 2,
    payloads: [mat.WATER, mat.OIL, mat.ACID],
    impact: "splash"
  },
  {
    id: "geomancer",
    name: "Geomancer Wand",
    cooldown: 10,
    spread: 0.12,
    projectileSpeed: 1.9,
    burst: 1,
    payloads: [mat.SAND, mat.ROCK, mat.WOOD],
    impact: "splash"
  }
];

export const pickPayload = (wand: WandDefinition, rng: RandomSource): number => {
  if (wand.payloads.length === 0) return 0;
  return wand.payloads[rng.nextInt(wand.payloads.length)] ?? 0;
};
