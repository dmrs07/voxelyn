# 🌾 Cozy Harvest Farm

A cute isometric farming game example built with **voxelyn-core** software rendering.

![Preview](preview.png)

## Features

- **Chibi Pixel Art** — Adorable farmer character with 4-directional animations
- **Isometric Grid** — 8×8 farm rendered with painter's algorithm depth sorting
- **Sub-tile Movement** — Smooth 4:1 movement precision within tiles
- **Day/Night Cycle** — 60-second days with dawn/dusk/night tints
- **Crop Growth** — Plant wheat seeds, water them, and harvest when golden!
- **Particle Effects** — Satisfying visual feedback for all actions

## Controls

| Key | Action |
|-----|--------|
| `W` | Move up-left (isometric) |
| `A` | Move down-left |
| `S` | Move down-right |
| `D` | Move up-right |
| `Space` | Use current tool |
| `1` | Select Hoe (till grass / harvest crops) |
| `2` | Select Watering Can |
| `3` | Select Seeds |

## Gameplay Loop

1. **Till** grass tiles with the hoe to create farmable soil
2. **Plant** seeds on tilled soil (you start with 10 seeds)
3. **Water** your crops before nightfall
4. Watered crops **grow one stage** each night
5. **Harvest** mature (golden) wheat with the hoe
6. Each harvest gives you 1 wheat — collect them all! 🌾

## Technical Highlights

- Pure **software rendering** via `Surface2D` (no WebGL)
- Uses `projectIso()` and `forEachIsoOrder()` from voxelyn-core
- Indexed color sprites with `Uint8Array` palette lookup
- `blitColorkey()` for transparent sprite rendering
- Real-time day/night tint overlay via pixel manipulation

## Running

```bash
# From project root
pnpm build

# Open in browser
open examples/browser-harvesting/index.html
```

Or use the TypeScript compiler directly:
```bash
npx tsc
```

Then open `index.html` — it loads the compiled JS from `dist/examples/browser-harvesting/`.

## File Structure

```
browser-harvesting/
├── index.html      # Canvas setup & styling
├── index.ts        # Main game loop, rendering, input
├── sprites.ts      # Pixel art: farmer, crops, tiles, particles
├── farm-grid.ts    # Tile grid & crop management
└── README.md       # This file
```

## Credits

Built with 💚 using [voxelyn-core](../../packages/voxelyn-core/).
