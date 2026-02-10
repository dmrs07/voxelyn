import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const electronRoot = path.resolve(__dirname, '..');
const sourceDist = path.resolve(electronRoot, '..', 'voxelyn-cli', 'dist');
const sourcePackageJson = path.resolve(electronRoot, '..', 'voxelyn-cli', 'package.json');
const targetDist = path.resolve(electronRoot, 'cli', 'voxelyn-cli', 'dist');
const targetPackageJson = path.resolve(electronRoot, 'cli', 'voxelyn-cli', 'package.json');
const targetDistSrcPackageJson = path.resolve(electronRoot, 'cli', 'voxelyn-cli', 'dist', 'src', 'package.json');

async function main() {
  await fs.rm(targetDist, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDist), { recursive: true });

  await fs.cp(sourceDist, targetDist, {
    recursive: true,
    force: true,
  });
  await fs.copyFile(sourcePackageJson, targetPackageJson);
  await fs.writeFile(
    targetDistSrcPackageJson,
    JSON.stringify(
      {
        type: 'module',
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`[copy-cli] Copied ${sourceDist} -> ${targetDist}`);
  console.log(`[copy-cli] Copied ${sourcePackageJson} -> ${targetPackageJson}`);
  console.log(`[copy-cli] Wrote ${targetDistSrcPackageJson}`);
}

main().catch((error) => {
  console.error('[copy-cli] Failed to copy CLI dist');
  console.error(error);
  process.exit(1);
});
