import type { Template } from './types.js';

const gitignore = `node_modules
dist
.vite
.DS_Store
`;

const projectMarker = `{
  "version": 1,
  "name": "{{name}}",
  "paths": {
    "assets": "assets",
    "scenes": "scenes",
    "worlds": "worlds",
    "generated": "assets/generated",
    "ai": "ai",
    "build": "build"
  }
}
`;

const projectScaffoldFiles: Record<string, string> = {
  'voxelyn.project.json': projectMarker,
  'assets/.gitkeep': '',
  'assets/generated/.gitkeep': '',
  'scenes/.gitkeep': '',
  'worlds/.gitkeep': '',
  'ai/.gitkeep': '',
  'build/maps/.gitkeep': '',
};

export const TEMPLATE_LIST: Template[] = [
  {
    name: 'vanilla',
    description: 'Vite + TypeScript + Canvas2D',
    files: {
      ...projectScaffoldFiles,
      '.gitignore': gitignore,
      'package.json': `{
  "name": "{{name}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@voxelyn/core": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}
`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
      'vite.config.ts': `import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: true }
});
`,
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voxelyn Vanilla</title>
  </head>
  <body>
    <canvas id="app" width="160" height="120"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      'src/main.ts': `import { createSurface2D, clearSurface, packRGBA, setPixel } from '@voxelyn/core';
import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';
import './style.css';

const canvas = document.getElementById('app') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Missing canvas');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Missing 2d context');

const surface = createSurface2D(160, 120);

function render(t: number): void {
  clearSurface(surface, packRGBA(10, 12, 18, 255));
  const cx = Math.floor(80 + Math.sin(t * 0.001) * 40);
  const cy = Math.floor(60 + Math.cos(t * 0.001) * 28);
  setPixel(surface, cx, cy, packRGBA(255, 200, 80, 255));
  presentToCanvas(ctx, surface);
  requestAnimationFrame(render);
}

render(0);
`,
      'src/style.css': `:root {
  color-scheme: light;
  background: #0b0f18;
  color: #f5f7ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
}

#app {
  width: 640px;
  height: 480px;
  image-rendering: pixelated;
  background: #111827;
  border: 1px solid #1f2937;
}
`
    }
  },
  {
    name: 'react',
    description: 'Vite + React + TypeScript + Canvas2D',
    files: {
      ...projectScaffoldFiles,
      '.gitignore': gitignore,
      'package.json': `{
  "name": "{{name}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@voxelyn/core": "^0.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}
`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`,
      'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { open: true }
});
`,
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voxelyn React</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
      'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
      'src/App.tsx': `import { useEffect, useRef } from 'react';
import { createSurface2D, clearSurface, packRGBA, setPixel } from '@voxelyn/core';
import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';

export default function App(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const surface = createSurface2D(160, 120);
    let running = true;

    const render = (t: number) => {
      if (!running) return;
      clearSurface(surface, packRGBA(8, 10, 16, 255));
      const cx = Math.floor(80 + Math.sin(t * 0.001) * 42);
      const cy = Math.floor(60 + Math.cos(t * 0.001) * 24);
      setPixel(surface, cx, cy, packRGBA(80, 200, 255, 255));
      presentToCanvas(ctx, surface);
      requestAnimationFrame(render);
    };

    render(0);
    return () => {
      running = false;
    };
  }, []);

  return (
    <main className="app">
      <h1>Voxelyn React</h1>
      <canvas ref={canvasRef} width={160} height={120} />
      <p>Surface2D + Canvas2D adapter, driven by React.</p>
    </main>
  );
}
`,
      'src/index.css': `:root {
  color-scheme: light;
  background: #0b0f18;
  color: #f5f7ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
}

.app {
  display: grid;
  gap: 12px;
  place-items: center;
}

canvas {
  width: 640px;
  height: 480px;
  image-rendering: pixelated;
  background: #111827;
  border: 1px solid #1f2937;
}
`
    }
  },
  {
    name: 'svelte',
    description: 'Vite + Svelte + TypeScript + Canvas2D',
    files: {
      ...projectScaffoldFiles,
      '.gitignore': gitignore,
      'package.json': `{
  "name": "{{name}}",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@voxelyn/core": "^0.1.0",
    "svelte": "^4.2.19"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^3.1.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.0"
  }
}
`,
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["svelte"]
  },
  "include": ["src"]
}
`,
      'vite.config.ts': `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: { open: true }
});
`,
      'svelte.config.js': `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess()
};
`,
      'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voxelyn Svelte</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
      'src/main.ts': `import App from './App.svelte';
import './style.css';

const app = new App({
  target: document.getElementById('app') as HTMLElement
});

export default app;
`,
      'src/App.svelte': `<script lang="ts">
  import { onMount } from 'svelte';
  import { createSurface2D, clearSurface, packRGBA, setPixel } from '@voxelyn/core';
  import { presentToCanvas } from '@voxelyn/core/adapters/canvas2d';

  let canvas: HTMLCanvasElement | null = null;

  onMount(() => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const surface = createSurface2D(160, 120);
    let running = true;

    const render = (t: number) => {
      if (!running) return;
      clearSurface(surface, packRGBA(12, 12, 22, 255));
      const cx = Math.floor(80 + Math.sin(t * 0.001) * 34);
      const cy = Math.floor(60 + Math.cos(t * 0.001) * 34);
      setPixel(surface, cx, cy, packRGBA(255, 120, 200, 255));
      presentToCanvas(ctx, surface);
      requestAnimationFrame(render);
    };

    render(0);

    return () => {
      running = false;
    };
  });
</script>

<main class="app">
  <h1>Voxelyn Svelte</h1>
  <canvas bind:this={canvas} width="160" height="120"></canvas>
  <p>Surface2D + Canvas2D adapter, powered by Svelte.</p>
</main>
`,
      'src/style.css': `:root {
  color-scheme: light;
  background: #0b0f18;
  color: #f5f7ff;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
}

.app {
  display: grid;
  gap: 12px;
  place-items: center;
}

canvas {
  width: 640px;
  height: 480px;
  image-rendering: pixelated;
  background: #111827;
  border: 1px solid #1f2937;
}
`
    }
  }
];

export const TEMPLATE_NAMES = TEMPLATE_LIST.map((t) => t.name);

export const listTemplates = (write: (message: string) => void): void => {
  write('Available templates:');
  for (const t of TEMPLATE_LIST) {
    write(`- ${t.name}: ${t.description}`);
  }
};

export const getTemplate = (name: string): Template | undefined =>
  TEMPLATE_LIST.find((t) => t.name === name);

export const renderTemplate = (content: string, projectName: string): string =>
  content.replace(/\{\{name\}\}/g, projectName);
