# Material System

The Voxelyn material system provides a foundation for defining materials with physical properties, visual characteristics, and dynamic behaviors.

## Architecture

### 1. **Material Type** (@voxelyn/core)

The `Material` type is the core definition for all voxel content:

```typescript
type Material = {
  id: number;                  // 0-255, index in palette
  name: string;                // Display name
  color: number;               // Packed RGBA8888 color
  density: number;             // 0 = floats, 100 = heavy
  friction: number;            // 0-1 slide behavior
  isLiquid: boolean;           // Fluid simulation
  isGas: boolean;              // (deprecated)
  isGaseous: boolean;          // Gas that expands
  isTransparent: boolean;      // Visibility through
  flammable: boolean;          // Can burn
  isoHeight?: number;          // ISO mode height override
};
```

### 2. **Procedural Texture Generation**

The `textures.ts` module provides procedural texture generators:

#### ProceduralNoise
- Perlin-like noise with gradient interpolation
- Deterministic based on seed
- fBm (fractal Brownian motion) support

#### Texture Generators
- **generateRockTexture()** - Cracks and irregularities
- **generateLavaTexture()** - Glowing orange/yellow/red
- **generateFoliageTexture()** - Fluffy, organic patterns
- **generateWaterTexture()** - Ripples and depth variation
- **generateMetalTexture()** - Metallic streaks and highlights

#### TextureSheet System
- Create atlases from material lists
- Each material gets a 32x32 (configurable) tile
- `createProceduralTextureSheet(materials)` - Auto-generate all
- `getTextureSheetTile(sheet, index)` - Extract single tile

### 3. **Material Behaviors**

Dynamic material effects via callbacks:

```typescript
type MaterialBehavior = (material: Material, context: BehaviorContext) => Partial<Material>;
```

**Built-in Behaviors:**
- `burning(intensity)` - Color flicker effect
- `melting(meltTemp, liquidMaterial)` - State transition
- `growing(growthRate)` - Expands over time
- `crystallizing(rate)` - Pattern formation
- `flowing(flowForce)` - Liquid behavior
- `dispersing(dispersalRate)` - Gas spread
- `corroding(corrosionRate)` - Disappears over time
- `solidifying(solidifyTime)` - Hardens from liquid
- `thermochromic(colors)` - Heat-sensitive color
- `reactive(triggerMaterialIds, result)` - Chemical reaction

**MaterialBehaviorRegistry:**
```typescript
const registry = new MaterialBehaviorRegistry();
registry.register(materialId, behavior);
const modified = registry.apply(material, context);
```

### 4. **Preset Custom Materials**

Pre-built materials with behaviors:

```typescript
PresetCustomMaterials.lava()        // Glowing, flowing, burning
PresetCustomMaterials.plant()       // Growing, flammable
PresetCustomMaterials.ice()         // Melts at temperature
PresetCustomMaterials.steam()       // Dispersing gas
PresetCustomMaterials.crystal()     // Crystallizing pattern
PresetCustomMaterials.acid()        // Corrosive liquid
PresetCustomMaterials.magma()       // Solidifying from liquid
```

## VoxelForge Editor Integration

### MaterialEditor Component

Located at `src/components/MaterialEditor.svelte`:

**Features:**
- Material list with color preview
- Properties editor (density, friction, flags)
- Preset material creation
- Procedural texture preview (128x128 canvas)
- Real-time texture regeneration
- ISO height control

**Usage in PalettePanel:**
```svelte
<MaterialEditor {palette} onPaletteChange={handlePaletteChange} />
```

**State Management:**
- Updates trigger `onPaletteChange` callback
- Changes persisted to document palette
- Texture preview updates on material changes

## Creating Custom Materials

### Simple Material
```typescript
import { createCustomMaterial, packRGBA } from '@voxelyn/core';

const clay = createCustomMaterial({
  id: 20,
  name: 'Clay',
  color: packRGBA(210, 150, 100),
  density: 75,
  friction: 0.6,
  category: 'solid'
});
```

### With Behaviors
```typescript
import { createCustomMaterial, MaterialBehaviors, packRGBA } from '@voxelyn/core';

const sulfur = createCustomMaterial({
  id: 21,
  name: 'Sulfur',
  color: packRGBA(255, 255, 0),
  flammable: true,
  density: 50,
  behaviors: [
    MaterialBehaviors.burning(1.0),
    MaterialBehaviors.dispersing(0.3), // Becomes gas when burning
  ]
});
```

### Thermochromic (Heat-Sensitive)
```typescript
import { createThermochromicMaterial } from '@voxelyn/core';

const colorGradient = [
  packRGBA(0, 0, 255),      // Cold: blue
  packRGBA(255, 0, 0),      // Hot: red
  packRGBA(255, 255, 0),    // Very hot: yellow
];

const thermite = createThermochromicMaterial(22, 'Thermite', colorGradient);
```

### Reactive Materials
```typescript
import { createReactiveMaterial } from '@voxelyn/core';

const reactiveGel = createReactiveMaterial(
  23,
  'Reactive Gel',
  packRGBA(100, 200, 100),
  [5, 15],  // React with lava (id 5) and acid (id 15)
  { isLiquid: true, flammable: true } // Becomes liquid and flammable
);
```

## Behavior Context

When applying behaviors, the context provides:

```typescript
type BehaviorContext = {
  x: number;              // Cell position
  y: number;
  z?: number;
  time: number;           // Milliseconds since behavior started
  temperature?: number;   // Local temperature
  pressure?: number;      // Local pressure
  adjacentMaterials?: number[];  // Neighbor material IDs
  iteration?: number;     // Physics iteration count
};
```

## Texture Options

Customize texture generation:

```typescript
type TextureOptions = {
  width?: number;         // Default 16
  height?: number;        // Default 16
  seed?: number;          // Default 42 (affects pattern)
  scale?: number;         // Pattern frequency (1-4)
};

const customLava = generateLavaTexture(
  packRGBA(255, 100, 0),
  { width: 64, height: 64, seed: 123, scale: 2.5 }
);
```

## Performance Considerations

- **Texture Generation**: ~1-5ms per material at 32x32
- **Noise Calculation**: O(1) per pixel after permutation setup
- **Behavior Application**: O(n) materials * O(m) behaviors
- **Caching**: TextureSheets are computed once, can be cached for reuse

## Future Enhancements

- [ ] Custom shader support for real-time texture generation
- [ ] Behavior composition/chaining
- [ ] Physics integration (temperature propagation, pressure)
- [ ] Particle effects for specific materials
- [ ] Animated textures with time-based variations
- [ ] Material interaction matrix (reactions between specific pairs)
- [ ] Save/load custom materials to JSON
- [ ] Material mixing/blending behaviors
- [ ] Sound/particle feedback for behaviors

