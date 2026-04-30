import type { CharacterSpec, ClipId } from './types.js';

export type GptSheetCellRange = {
  row: number;
  from?: number;
  to?: number;
};

export type GptSheetClipLayout = {
  down: GptSheetCellRange[];
  up: GptSheetCellRange[];
};

export type GptSheetSpec = {
  path: string;
  grid: {
    cols: 8;
    rows: 12;
    cellWidth: 128;
    cellHeight: 128;
  };
  clips: Partial<Record<ClipId, GptSheetClipLayout>>;
};

export type GptCutterClipLayout = {
  down: number[];
  up?: number[];
};

export type GptCutterSheetSpec = {
  imagePath: string;
  jsonPath: string;
  clips: Partial<Record<ClipId, GptCutterClipLayout>>;
};

const grid: GptSheetSpec['grid'] = {
  cols: 8,
  rows: 12,
  cellWidth: 128,
  cellHeight: 128,
};

const range = (row: number, from = 0, to = 7): GptSheetCellRange => ({ row, from, to });

const standardEnemyClips = (): GptSheetSpec['clips'] => ({
  idle: { down: [range(0)], up: [range(1)] },
  walk: { down: [range(2)], up: [range(3)] },
  attack: { down: [range(5)], up: [range(6)] },
  hit: { down: [range(8, 0, 3)], up: [range(8, 4, 7)] },
  die: { down: [range(10), range(11)], up: [range(10), range(11)] },
});

export const GPT_SHEETS: Partial<Record<CharacterSpec['id'], GptSheetSpec>> = {
  excavator: {
    path: 'assets/source/gpt-spritesheets/excavator.png',
    grid,
    clips: {
      idle: { down: [range(0)], up: [range(1)] },
      walk: { down: [range(2)], up: [range(3)] },
      attack: { down: [range(4), range(5)], up: [range(6)] },
      cast: { down: [range(6)], up: [range(6)] },
      hit: { down: [range(7, 0, 3)], up: [range(7, 4, 7)] },
      die: { down: [range(9), range(10), range(11)], up: [range(9), range(10), range(11)] },
    },
  },
  striker: {
    path: 'assets/source/gpt-spritesheets/striker.png',
    grid,
    clips: standardEnemyClips(),
  },
  bruiser: {
    path: 'assets/source/gpt-spritesheets/bruiser.png',
    grid,
    clips: standardEnemyClips(),
  },
  spitter: {
    path: 'assets/source/gpt-spritesheets/spitter.png',
    grid,
    clips: standardEnemyClips(),
  },
  spore_bomber: {
    path: 'assets/source/gpt-spritesheets/spore_bomber.png',
    grid,
    clips: {
      ...standardEnemyClips(),
      attack: { down: [range(4), range(5)], up: [range(6)] },
      die: { down: [range(9), range(10), range(11)], up: [range(9), range(10), range(11)] },
    },
  },
  guardian: {
    path: 'assets/source/gpt-spritesheets/guardian.png',
    grid,
    clips: standardEnemyClips(),
  },
};

const frames = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const localSheet = (
  id: CharacterSpec['id'],
  clips: GptCutterSheetSpec['clips'],
): GptCutterSheetSpec => ({
  imagePath: `assets/sprites/characters/${id}/spritesheet.png`,
  jsonPath: `assets/sprites/characters/${id}/spritesheet.json`,
  clips,
});

export const LOCAL_SPRITESHEETGEN_SHEETS: Partial<Record<CharacterSpec['id'], GptCutterSheetSpec>> =
  {
    excavator: localSheet('excavator', {
      idle: { down: frames(0, 7), up: frames(6, 13) },
      walk: { down: frames(14, 31), up: frames(20, 31) },
      attack: {
        down: [...frames(32, 39), ...frames(43, 50)],
        up: [...frames(43, 50), ...frames(53, 59)],
      },
      cast: {
        down: [...frames(53, 59), ...frames(64, 73)],
        up: [...frames(53, 59), ...frames(64, 73)],
      },
      hit: { down: frames(64, 67), up: frames(64, 67) },
      die: {
        down: [...frames(74, 77), ...frames(84, 90)],
        up: [...frames(74, 77), ...frames(88, 90)],
      },
    }),
    striker: localSheet('striker', {
      idle: { down: frames(0, 7), up: frames(8, 15) },
      walk: { down: frames(16, 23), up: frames(24, 31) },
      attack: {
        down: [...frames(40, 45), ...frames(49, 54)],
        up: frames(56, 71),
      },
      hit: { down: [72, 73, 74, 76, 77, 78, 79], up: [72, 73, 74, 76, 77, 78, 79] },
      die: {
        down: [
          80, 81, 82, 83, 86, 87, 95, 96, 97, 98, 99, 101, 102, 111, 112, 113, 114, 115, 116, 119,
        ],
        up: [
          80, 81, 82, 83, 86, 87, 95, 96, 97, 98, 99, 101, 102, 111, 112, 113, 114, 115, 116, 119,
        ],
      },
    }),
    bruiser: localSheet('bruiser', {
      idle: { down: frames(0, 7), up: frames(8, 15) },
      walk: { down: frames(16, 23), up: frames(24, 31) },
      attack: {
        down: [32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44, 50, 51, 52, 53, 54, 55],
        up: [32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44, 50, 51, 52, 53, 54, 55],
      },
      hit: { down: [70, 71, 72, 73, 76, 77, 79, 82, 83], up: [70, 71, 72, 73, 76, 77, 79, 82, 83] },
      die: {
        down: [
          96, 97, 98, 100, 101, 103, 118, 119, 120, 121, 122, 124, 125, 131, 132, 133, 134, 136,
          137, 142,
        ],
        up: [
          96, 97, 98, 100, 101, 103, 118, 119, 120, 121, 122, 124, 125, 131, 132, 133, 134, 136,
          137, 142,
        ],
      },
    }),
    spitter: localSheet('spitter', {
      idle: { down: frames(0, 7), up: frames(8, 15) },
      walk: { down: frames(16, 23), up: frames(24, 31) },
      attack: {
        down: [32, 33, 34, 35, 36, 37, 41, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
        up: frames(47, 60),
      },
      hit: { down: [72, 73, 74, 75, 76, 77, 78], up: [72, 73, 74, 75, 76, 77, 78] },
      die: {
        down: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 102, 104, 110, 111, 112, 113, 114, 115],
        up: [90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 102, 104, 110, 111, 112, 113, 114, 115],
      },
    }),
    spore_bomber: localSheet('spore_bomber', {
      idle: { down: frames(0, 7), up: frames(8, 15) },
      walk: { down: frames(16, 23), up: frames(24, 31) },
      attack: {
        down: [32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 46, 47, 48, 49, 50, 51],
        up: [32, 33, 34, 35, 36, 38, 39, 40, 41, 42, 43, 44, 46, 47, 48, 49, 50, 51],
      },
      hit: { down: frames(53, 64), up: frames(53, 64) },
      die: {
        down: [65, 66, 67, 68, 69, 70, 71, 75, 76, 77, 78, 82, 83, 84, 85],
        up: [65, 66, 67, 68, 69, 70, 71, 75, 76, 77, 78, 82, 83, 84, 85],
      },
    }),
    guardian: localSheet('guardian', {
      idle: { down: frames(0, 7), up: frames(8, 15) },
      walk: { down: frames(16, 23), up: frames(24, 31) },
      attack: {
        down: [...frames(32, 43), ...frames(45, 51)],
        up: frames(53, 64),
      },
      hit: { down: [...frames(56, 66)], up: [...frames(56, 66)] },
      die: {
        down: [69, 70, 71, 72, 73, 74, 77, 89, 90, 91, 92, 93, 96, 97, 101],
        up: [69, 70, 71, 72, 73, 74, 77, 89, 90, 91, 92, 93, 96, 97, 101],
      },
    }),
  };

export const GPT_CUTTER_SHEETS: Partial<Record<CharacterSpec['id'], GptCutterSheetSpec>> = {
  excavator: {
    imagePath: 'assets/source/gpt-spritesheets/excavator-cutter.png',
    jsonPath: 'assets/source/gpt-spritesheets/excavator-cutter.json',
    clips: {
      idle: { down: frames(0, 7), up: frames(6, 13) },
      walk: { down: frames(14, 31), up: frames(20, 31) },
      attack: { down: frames(32, 47), up: frames(40, 55) },
      cast: { down: frames(48, 65), up: frames(48, 65) },
      hit: { down: frames(56, 63), up: frames(56, 63) },
      die: {
        down: [...frames(64, 67), ...frames(72, 75)],
        up: [...frames(64, 67), ...frames(72, 75)],
      },
    },
  },
};
