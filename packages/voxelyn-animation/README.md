# @voxelyn/animation

Mini-stack de animacao pixel para Voxelyn:

- Runtime de animacao (intents + clips)
- Geracao procedural 100% runtime
- Importers de Aseprite e TexturePacker
- Helpers para desenho isometrico

## Instalacao

```bash
pnpm add @voxelyn/animation
```

## Uso rapido (procedural)

```ts
import {
  createProceduralCharacter,
  createAnimationPlayer,
  stepAnimation,
} from '@voxelyn/animation';

const character = createProceduralCharacter({ id: 'hero', style: 'player' });
const player = createAnimationPlayer({
  set: character.clips,
  width: character.width,
  height: character.height,
});

const frame = stepAnimation(player, 50, 'move', 'dr');
// frame.sprite => PixelSprite com pixels RGBA
```

## Importers

```ts
import { importAseprite, importTexturePacker } from '@voxelyn/animation';

const importedA = importAseprite(asepriteJson, atlas);
const importedT = importTexturePacker(texturePackerJson, atlas);
```

`atlas` pode ser:

- `{ width, height, pixels: Uint32Array }`, ou
- `{ width, height, data: Uint8Array | Uint8ClampedArray }`
