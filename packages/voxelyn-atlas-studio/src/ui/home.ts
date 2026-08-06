// Tela inicial: lista de projetos, criacao por preset e import de atlas.
import { PRESETS, createProjectFromPreset } from '../presets';
import { deleteProject, listProjects, saveProject } from '../store';
import type { Project, SpriteManifestEntry } from '../types';
import { blobToGrid, normalizeGrid } from '../png';
import { projectFromManifest, sliceAtlas, projectFrame } from '../atlas';
import { orderedAnims } from '../presets';
import { confirmSheet, el, openSheet, toast } from './components';

const drawThumb = (canvas: HTMLCanvasElement, project: Project): void => {
  const anims = orderedAnims(project.animations);
  const dir = project.authoredDirs[0];
  const anim = anims[0];
  if (!dir || !anim) return;
  const g = projectFrame(project, dir, anim, 0);
  canvas.width = g.w;
  canvas.height = g.h;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
};

const newProjectSheet = (onCreate: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const presetSelect = el('select');
    for (const p of PRESETS) presetSelect.append(el('option', { value: p.id, text: p.label }));
    const idInput = el('input', {
      placeholder: 'ex.: enemy-crystal-crab',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    const nameInput = el('input', { placeholder: 'ex.: Caranguejo de Cristal' });
    const create = el('button', { class: 'primary', text: 'Criar personagem' });
    create.addEventListener('click', () => {
      const preset = PRESETS.find((p) => p.id === presetSelect.value)!;
      const spriteId = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      if (!/^[a-z0-9-]+$/.test(spriteId)) {
        toast('Defina um id valido (minusculas e hifens), ex.: enemy-crystal-crab');
        return;
      }
      const project = createProjectFromPreset(preset, spriteId, nameInput.value.trim() || spriteId);
      close();
      onCreate(project);
    });
    return el('div', {}, [
      el('h2', { text: 'Novo personagem' }),
      el('div', {}, [el('label', { text: 'Preset (contrato da Art Bible)' }), presetSelect]),
      el('div', {}, [el('label', { text: 'id do sprite (nome dos arquivos)' }), idInput]),
      el('div', {}, [el('label', { text: 'Nome de exibicao' }), nameInput]),
      create,
    ]);
  });

const importSheet = (onImport: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const fileInput = el('input', { type: 'file', accept: '.png,.json', multiple: 'true' });
    const quantize = el('input', { type: 'checkbox' });
    quantize.checked = true;
    const doImport = el('button', { class: 'primary', text: 'Importar' });
    doImport.addEventListener('click', () => {
      void (async () => {
        const files = [...(fileInput.files ?? [])];
        const jsonFile = files.find((f) => f.name.endsWith('.json'));
        const pngFile = files.find((f) => f.name.endsWith('.png'));
        if (!jsonFile || !pngFile) {
          toast('Selecione o PAR de arquivos do atlas: o .png e o .json');
          return;
        }
        try {
          const manifest = JSON.parse(await jsonFile.text()) as SpriteManifestEntry;
          if (!manifest.frameMap || !manifest.animations || !manifest.frameWidth) {
            toast('JSON nao parece um manifest de sprite do Voxelyn');
            return;
          }
          const atlas = await blobToGrid(pngFile);
          normalizeGrid(atlas, quantize.checked);
          const frames = sliceAtlas(manifest, atlas);
          const project = projectFromManifest(manifest, frames);
          close();
          onImport(project);
        } catch (err) {
          toast(`Falha no import: ${(err as Error).message}`);
        }
      })();
    });
    return el('div', {}, [
      el('h2', { text: 'Importar atlas' }),
      el('p', {
        class: 'sub',
        text: 'Selecione os dois arquivos do atlas (PNG + JSON), por exemplo os de packages/voxelyn-survival-content/assets/atlases/.',
      }),
      fileInput,
      el('label', { style: 'display:flex;align-items:center;gap:8px;margin-top:4px' }, [
        quantize,
        'Normalizar para a paleta veio-fungico (alpha binario + cor mais proxima)',
      ]),
      doImport,
    ]);
  });

export const mountHome = (root: HTMLElement, openEditor: (project: Project) => void): void => {
  root.innerHTML = '';
  const container = el('div', { class: 'home' });

  const newBtn = el('button', { class: 'primary', text: '+ Novo personagem' });
  newBtn.addEventListener('click', () => {
    void newProjectSheet((p) => {
      void saveProject(p).then(() => openEditor(p));
    });
  });
  const importBtn = el('button', { text: 'Importar atlas' });
  importBtn.addEventListener('click', () => {
    void importSheet((p) => {
      void saveProject(p).then(() => openEditor(p));
    });
  });

  container.append(
    el('h1', {}, [el('img', { src: './icon-192.png', alt: '' }), 'Voxelyn Atlas Studio']),
    el('p', {
      class: 'sub',
      text: 'Desenhe, importe e exporte atlases de personagem no formato do Voxelyn Survival — com a paleta veio-fungico e o contrato de animacoes da Art Bible.',
    }),
    el('div', { class: 'actions' }, [newBtn, importBtn]),
  );

  const list = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
  container.append(list);

  void listProjects().then((projects) => {
    if (projects.length === 0) {
      list.append(
        el('p', {
          class: 'sub',
          text: 'Nenhum projeto ainda. Crie um personagem ou importe um atlas do jogo.',
        }),
      );
      return;
    }
    for (const project of projects) {
      const thumb = el('canvas');
      drawThumb(thumb, project);
      const card = el('button', { class: 'project-card' }, [
        thumb,
        el('div', { class: 'meta' }, [
          el('div', { class: 'title', text: project.name }),
          el('div', {
            class: 'info',
            text: `${project.spriteId} · v${project.version} · ${project.frameWidth}×${project.frameHeight} · ${new Date(project.updatedAt).toLocaleDateString('pt-BR')}`,
          }),
        ]),
      ]);
      card.addEventListener('click', () => openEditor(project));
      const remove = el('button', {
        class: 'danger',
        text: '✕',
        style: 'min-width:40px;flex:none',
      });
      remove.addEventListener('click', (e) => {
        e.stopPropagation();
        void confirmSheet(
          `Excluir "${project.name}"? Isso apaga o projeto deste aparelho.`,
          'Excluir',
        ).then((ok) => {
          if (!ok) return;
          void deleteProject(project.key).then(() => mountHome(root, openEditor));
        });
      });
      const rowEl = el('div', { style: 'display:flex;gap:8px;align-items:stretch' }, [
        card,
        remove,
      ]);
      list.append(rowEl);
    }
  });

  root.append(container);
};
