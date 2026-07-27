import { readFileSync, writeFileSync } from 'node:fs';

const file = 'packages/voxelyn-survival-sim/src/cells.ts';
const before = `  if (surf === SURF_FUNGAL_HEATED) {
    setSurface(state, i, SURF_FIRE, FUNGAL_FIRE_FUEL_TICKS);
    announceIgnite(state, i, events);
    return true;
  }
`;
const after = `  if (surf === SURF_FUNGAL_HEATED) {
    // Uma nova fonte de calor acelera a secagem, mas nao ignora a umidade que
    // ainda resta. A transicao para fogo continua pertencendo ao relogio de
    // stepCells, garantindo que o aviso fumegante nunca seja pulado.
    return heatFungalCell(state, i, true);
  }
`;

const source = readFileSync(file, 'utf8');
const first = source.indexOf(before);
const last = source.lastIndexOf(before);
if (first < 0 || first !== last) {
  throw new Error(`${file}: expected exactly one heated-fungus ignition branch`);
}
writeFileSync(file, source.slice(0, first) + after + source.slice(first + before.length));
