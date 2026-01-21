import { access, cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronRoot = path.resolve(__dirname, '..');
const editorDist = path.resolve(electronRoot, '..', 'voxelforge-editor', 'dist');
const rendererDir = path.resolve(electronRoot, 'renderer');

try {
  await access(editorDist);
} catch (error) {
  console.error('Renderer build not found. Run the editor build first.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

await rm(rendererDir, { recursive: true, force: true });
await mkdir(rendererDir, { recursive: true });
await cp(editorDist, rendererDir, { recursive: true });
