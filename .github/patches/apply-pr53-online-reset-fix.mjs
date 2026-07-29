import { readFileSync, writeFileSync } from 'node:fs';

const path = 'packages/voxelyn-survival/src/client/main.ts';
const source = readFileSync(path, 'utf8');
const legacy = '            recordedSummary = null;';
const matches = source.split(legacy).length - 1;
if (matches !== 1) throw new Error(`expected one legacy online reset, found ${matches}`);
const fixed = source.replace(legacy, '            recordedSummaryKey = null;');
if (/\brecordedSummary\b/.test(fixed)) throw new Error('legacy recordedSummary identifier remains');
writeFileSync(path, fixed, 'utf8');
console.log('online run record gate reset fixed');
