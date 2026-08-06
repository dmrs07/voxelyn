// Bootstrap do Atlas Studio: roteia home ↔ editor e registra o service worker
// (so no build de producao — em dev o SW congelaria o modulo em cache).
import './style.css';
import type { Project } from './types';
import { mountHome } from './ui/home';
import { mountEditor } from './ui/editor';
import { mountVoxelEditor } from './ui/voxel-editor';

const root = document.getElementById('app')!;

const openEditor = (project: Project): void => {
  const mount = project.mode === 'voxel' ? mountVoxelEditor : mountEditor;
  mount(root, project, () => mountHome(root, openEditor));
};

mountHome(root, openEditor);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
  });
}
