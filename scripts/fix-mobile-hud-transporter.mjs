import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-mobile-hud-dual-stick.mjs';
let source = readFileSync(path, 'utf8');
const tick = String.fromCharCode(96);

const escapeNestedTemplate = (startText, afterText) => {
  const rangeStart = source.indexOf(startText);
  if (rangeStart < 0) throw new Error(`start range not found: ${startText}`);
  const rangeEnd = source.indexOf(afterText, rangeStart + startText.length);
  if (rangeEnd < 0) throw new Error(`end range not found: ${afterText}`);

  const chunk = source.slice(rangeStart, rangeEnd);
  const firstTick = chunk.indexOf(tick);
  const lastTick = chunk.lastIndexOf(tick);
  if (firstTick < 0 || lastTick <= firstTick) throw new Error(`template delimiters not found: ${startText}`);

  const inner = chunk
    .slice(firstTick + 1, lastTick)
    .split(tick).join(`\\${tick}`)
    .split('${').join('\\${');
  const escaped = chunk.slice(0, firstTick + 1) + inner + chunk.slice(lastTick);
  source = source.slice(0, rangeStart) + escaped + source.slice(rangeEnd);
};

escapeNestedTemplate(
  "replaceBetween(\n  renderPath,\n  `    const safeTop = this.safeArea.top + 10;`,",
  "\n\nreplaceBetween(\n  renderPath,\n  `    // controles touch: movimento livre a esquerda",
);
escapeNestedTemplate(
  "replaceBetween(\n  renderPath,\n  `    // controles touch: movimento livre a esquerda",
  "\n\nreplaceExact(\n  testPath,",
);

writeFileSync(path, source, 'utf8');
console.log('nested HUD templates escaped');
