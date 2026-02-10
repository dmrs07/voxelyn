import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const electronRoot = path.resolve(__dirname, '..');
const sourceDist = path.resolve(electronRoot, '..', 'voxelyn-cli', 'dist');
const targetDist = path.resolve(electronRoot, 'cli', 'voxelyn-cli', 'dist');

async function main() {
  await fs.rm(targetDist, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDist), { recursive: true });

  await fs.cp(sourceDist, targetDist, {
    recursive: true,
    force: true,
  });

  console.log(`[copy-cli] Copied ${sourceDist} -> ${targetDist}`);
}

main().catch((error) => {
  console.error('[copy-cli] Failed to copy CLI dist');
  console.error(error);
  process.exit(1);
});
