import { readFileSync, writeFileSync } from 'node:fs';

const replaceOnce = (file, before, after) => {
  const source = readFileSync(file, 'utf8');
  const first = source.indexOf(before);
  const last = source.lastIndexOf(before);
  if (first < 0 || first !== last) {
    throw new Error(`${file}: expected exactly one match, found ${first < 0 ? 0 : 'multiple'}`);
  }
  writeFileSync(file, source.slice(0, first) + after + source.slice(first + before.length));
};

const types = 'packages/voxelyn-survival-sim/src/types.ts';
replaceOnce(
  types,
  `  hits?: number[];\n};`,
  `  hits?: number[];\n  /** Celulas fungicas que este projetil ja aqueceu; evita duplicar o mesmo impacto nos subpassos. */\n  heatedSurfaceCells?: number[];\n};`
);

const run = 'packages/voxelyn-survival-sim/src/run.ts';
replaceOnce(
  run,
  `  SURF_FIRE,\n  SURF_GAS,\n  SURF_NONE,`,
  `  SURF_FIRE,\n  SURF_FUNGAL,\n  SURF_FUNGAL_HEATED,\n  SURF_GAS,\n  SURF_NONE,`
);

replaceOnce(
  run,
  `      // reacao com a superficie da celula aberta em que o projetil esta\n      if (impactSurface(state, cx, cy, cls, events)) {\n        dead = true;\n        break;\n      }`,
  `      // Reacao com a superficie da celula aberta em que o projetil esta.\n      //\n      // Os dois subpassos anti-tunelamento podem visitar a mesma celula no mesmo\n      // tick, e um projetil lento pode permanecer nela em ticks seguintes. Para\n      // fungo termico isso representa UM impacto fisico, nao uma nova fonte de\n      // calor a cada amostra de colisao. A identidade fica no proprio projetil,\n      // por celula, preservando novos impactos quando ele realmente avanca.\n      const surfaceBeforeImpact = state.surface[i];\n      const heatsFungal =\n        cls === 'thermal' &&\n        (surfaceBeforeImpact === SURF_FUNGAL || surfaceBeforeImpact === SURF_FUNGAL_HEATED);\n      const alreadyHeatedHere = heatsFungal && proj.heatedSurfaceCells?.includes(i);\n\n      if (!alreadyHeatedHere) {\n        const consumedBySurface = impactSurface(state, cx, cy, cls, events);\n        if (heatsFungal) (proj.heatedSurfaceCells ??= []).push(i);\n        if (consumedBySurface) {\n          dead = true;\n          break;\n        }\n      }`
);
