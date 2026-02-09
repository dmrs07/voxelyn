const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;

export const tiledTilesetsFixture = [
  { firstgid: 1, name: 'base', tilecount: 4 },
  { firstgid: 5, name: 'extra', tilecount: 4 }
];

export const tiledLayerFixture = {
  type: 'tilelayer',
  width: 2,
  height: 2,
  offsetx: 16,
  offsety: 0,
  data: [
    1 | FLIP_H | FLIP_V,
    0,
    6 | FLIP_D,
    2
  ]
};

export const tiledChunkLayerFixture = {
  type: 'tilelayer',
  chunks: [
    {
      x: 2,
      y: 1,
      width: 1,
      height: 1,
      data: [5 | FLIP_H]
    }
  ]
};
