import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-mobile-hud-dual-stick.mjs';
let source = readFileSync(path, 'utf8');
const tick = String.fromCharCode(96);

const nthIndexOf = (text, needle, occurrence) => {
  let from = 0;
  for (let index = 1; index <= occurrence; index++) {
    const found = text.indexOf(needle, from);
    if (found < 0) return -1;
    if (index === occurrence) return found;
    from = found + needle.length;
  }
  return -1;
};

const escapeReplacementTemplate = (startText, afterText) => {
  const rangeStart = source.indexOf(startText);
  if (rangeStart < 0) throw new Error(`start range not found: ${startText}`);
  const rangeEnd = source.indexOf(afterText, rangeStart + startText.length);
  if (rangeEnd < 0) throw new Error(`end range not found: ${afterText}`);

  const chunk = source.slice(rangeStart, rangeEnd);
  // replaceBetween(path, `start`, `end`, `replacement`): the replacement opens
  // at the fifth backtick. The first four delimit the two lookup markers and
  // must remain untouched or the patch will search for one giant string.
  const replacementOpen = nthIndexOf(chunk, tick, 5);
  const replacementClose = chunk.lastIndexOf(tick);
  if (replacementOpen < 0 || replacementClose <= replacementOpen) {
    throw new Error(`replacement template delimiters not found: ${startText}`);
  }

  const inner = chunk
    .slice(replacementOpen + 1, replacementClose)
    .split(tick).join(`\\${tick}`)
    .split('${').join('\\${');
  const escaped =
    chunk.slice(0, replacementOpen + 1) + inner + chunk.slice(replacementClose);
  source = source.slice(0, rangeStart) + escaped + source.slice(rangeEnd);
};

escapeReplacementTemplate(
  "replaceBetween(\n  renderPath,\n  `    const safeTop = this.safeArea.top + 10;`,",
  "\n\nreplaceBetween(\n  renderPath,\n  `    // controles touch: movimento livre a esquerda",
);
escapeReplacementTemplate(
  "replaceBetween(\n  renderPath,\n  `    // controles touch: movimento livre a esquerda",
  "\n\nreplaceExact(\n  testPath,",
);

writeFileSync(path, source, 'utf8');
console.log('replacement-only HUD templates escaped');
