import { readFileSync, writeFileSync } from 'node:fs';

const file = 'packages/voxelyn-survival/src/client/render.ts';
let source = readFileSync(file, 'utf8');

const replaceOnce = (before, after) => {
  const first = source.indexOf(before);
  const last = source.lastIndexOf(before);
  if (first < 0 || first !== last) {
    throw new Error(`${file}: expected exactly one match, found ${first < 0 ? 0 : 'multiple'}`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
};

replaceOnce(
  `} from './run-summary';\n`,
  `} from './run-summary';\nimport { objectiveLightSpec, objectivePropName } from './objective-prop';\n`,
);

replaceOnce(
  `    // luzes dinamicas visiveis (fogo, cristais, descargas, nucleo)\n    const lights: Array<{ x: number; y: number; r: number; power: number }> = [\n      { x: player.x, y: player.y, r: 8.5, power: 1 },\n    ];\n    if (!state.coreTaken) lights.push({ x: state.corePos.x + 0.5, y: state.corePos.y + 0.5, r: 6, power: 0.9 });\n`,
  `    // Luzes dinamicas visiveis. \`corePos\` e o poco nos setores intermediarios\n    // e o Nucleo apenas no final; cada marcador recebe intensidade propria.\n    const objectiveName = objectivePropName(state.sector, state.coreTaken);\n    const lights: Array<{ x: number; y: number; r: number; power: number }> = [\n      { x: player.x, y: player.y, r: 8.5, power: 1 },\n    ];\n    const objectiveLight = objectiveLightSpec(state.sector, state.coreTaken);\n    if (objectiveLight) {\n      lights.push({\n        x: state.corePos.x + 0.5,\n        y: state.corePos.y + 0.5,\n        r: objectiveLight.radius,\n        power: objectiveLight.power,\n      });\n    }\n`,
);

replaceOnce(
  `    // Objetivos como OBJETOS, na fila de profundidade.\n    //\n    // O Nucleo e a coisa mais importante do mapa e era um losango chapado\n    // pulsando 3px acima do chao — menor que qualquer parede em volta dele.\n    // Agora e um monumento voxel, e por isso tem de ser ordenado com o resto:\n    // desenhado no passo de chao, um pedestal alto ficaria por baixo de toda\n    // parede a frente, inclusive a que o jogador esta contornando para chegar\n    // ate ele.\n`,
  `    // Objetivos como OBJETOS, na fila de profundidade. O mesmo ponto logico\n    // representa o poco nos setores intermediarios e o Nucleo no setor final,\n    // mas cada um tem silhueta propria. Ambos precisam entrar nesta fila porque\n    // levantam volume acima do piso e devem respeitar paredes e entidades.\n`,
);

replaceOnce(
  `          draw: () => {\n            const name = state.coreTaken ? 'coreTaken' : 'core';\n            if (this.props.draw(ctx, name, nowMs, csx, csy, z)) return;\n            // Fallback enquanto o atlas nao carregou.\n            const pulse = 0.6 + 0.4 * Math.sin(nowMs * 0.006);\n            ctx.fillStyle = state.coreTaken ? PAL.rockShadow : shade(PAL.biolum, pulse);\n            ctx.fillRect(csx - 4 * z, csy - 10 * z, 8 * z, 10 * z);\n          },\n`,
  `          draw: () => {\n            if (this.props.draw(ctx, objectiveName, nowMs, csx, csy, z)) return;\n\n            // Fallback enquanto o atlas nao carregou. Mesmo no caminho de erro o\n            // poco nao pode voltar a parecer o cristal que ele substituiu.\n            if (objectiveName === 'descent') {\n              const step = Math.floor(nowMs / 170) % 6;\n              const platformRadius = step < 2 ? 3 : step < 4 ? 2 : 1;\n              const sink = Math.min(4, step);\n              ctx.fillStyle = PAL.rockShadow;\n              ctx.fillRect(csx - 7 * z, csy - 3 * z, 14 * z, 5 * z);\n              ctx.fillStyle = PAL.rust;\n              ctx.fillRect(csx - 6 * z, csy - 4 * z, 12 * z, z);\n              ctx.fillStyle = step < 2 ? PAL.loot : shade(PAL.rust, 0.8);\n              ctx.fillRect(\n                csx - platformRadius * z,\n                csy - (6 - sink) * z,\n                platformRadius * 2 * z,\n                Math.max(1, z),\n              );\n              return;\n            }\n\n            const pulse = 0.6 + 0.4 * Math.sin(nowMs * 0.006);\n            ctx.fillStyle = objectiveName === 'coreTaken' ? PAL.rockShadow : shade(PAL.biolum, pulse);\n            ctx.fillRect(csx - 4 * z, csy - 10 * z, 8 * z, 10 * z);\n          },\n`,
);

writeFileSync(file, source);
