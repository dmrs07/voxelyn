// Tela inicial: lista de projetos, criacao por preset e import de atlas.
import { PRESETS, createProjectFromPreset } from '../presets';
import { deleteProject, listProjects, saveProject } from '../store';
import type { Project, SpriteManifestEntry } from '../types';
import { blobToGrid, normalizeGrid } from '../png';
import { projectFromManifest, sliceAtlas, projectFrame } from '../atlas';
import { orderedAnims } from '../presets';
import { GAME_CATALOG } from '../catalog';
import { parseStl, voxelizeStl } from '../stl';
import { VOXEL_MATERIALS, voxelProjectedBounds } from '../voxel';
import { modelKey } from '../types';
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
    const modeSelect = el('select');
    modeSelect.append(
      el('option', { value: 'voxel', text: 'Voxel — monte como Lego, 4 direcoes automaticas' }),
      el('option', { value: 'pixel', text: 'Pixel — desenhe cada frame a mao' }),
    );
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
      if (modeSelect.value === 'voxel') {
        project.mode = 'voxel';
        project.models = {};
        project.flipPairs = {};
      }
      close();
      onCreate(project);
    });
    return el('div', {}, [
      el('h2', { text: 'Novo personagem' }),
      el('div', {}, [el('label', { text: 'Modo de autoria (voxel recomendado)' }), modeSelect]),
      el('div', {}, [el('label', { text: 'Preset (contrato da Art Bible)' }), presetSelect]),
      el('div', {}, [el('label', { text: 'id do sprite (nome dos arquivos)' }), idInput]),
      el('div', {}, [el('label', { text: 'Nome de exibicao' }), nameInput]),
      create,
    ]);
  });

const importStlSheet = (onImport: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const fileInput = el('input', { type: 'file', accept: '.stl' });
    const presetSelect = el('select');
    for (const p of PRESETS) presetSelect.append(el('option', { value: p.id, text: p.label }));
    const materialSelect = el('select');
    for (const mat of VOXEL_MATERIALS)
      materialSelect.append(el('option', { value: mat, text: mat }));
    materialSelect.value = 'rock';
    const heightInput = el('input', { type: 'number', min: '4', max: '48', value: '24' });
    const idInput = el('input', {
      placeholder: 'ex.: enemy-crystal-crab',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    const doImport = el('button', { class: 'primary', text: 'Voxelizar e abrir' });
    doImport.addEventListener('click', () => {
      const file = fileInput.files?.[0];
      if (!file) {
        toast('Selecione um arquivo .stl');
        return;
      }
      const spriteId = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      if (!/^[a-z0-9-]+$/.test(spriteId)) {
        toast('Defina um id valido (minusculas e hifens)');
        return;
      }
      doImport.disabled = true;
      doImport.textContent = 'Voxelizando…';
      void (async () => {
        try {
          const tris = parseStl(await file.arrayBuffer());
          const height = Math.max(4, Math.min(48, Number(heightInput.value) || 24));
          const model = voxelizeStl(tris, { height, material: materialSelect.value });
          const preset = PRESETS.find((p) => p.id === presetSelect.value)!;
          const project = createProjectFromPreset(preset, spriteId, spriteId);
          project.mode = 'voxel';
          project.flipPairs = {};
          project.models = {};
          // o mesmo corpo em todos os frames: e o ponto de partida para animar
          // (copiar/mover/editar por frame), igual ao fluxo de criar do zero
          for (const anim of Object.keys(project.animations)) {
            for (let f = 0; f < project.animations[anim].frames; f++) {
              project.models[modelKey(anim, f)] = structuredClone(model);
            }
          }
          const b = voxelProjectedBounds(model);
          const fits = b.w <= project.frameWidth - 4 && b.h <= project.frameHeight - 4;
          toast(
            `${Object.keys(model).length} voxels · projecao ${b.w}×${b.h}px ${fits ? '✓ cabe no frame' : `✕ frame util e ${project.frameWidth - 4}×${project.frameHeight - 4}px — reduza a altura ou aumente o frame`}`,
          );
          close();
          onImport(project);
        } catch (err) {
          toast(`Falha no STL: ${(err as Error).message}`);
          doImport.disabled = false;
          doImport.textContent = 'Voxelizar e abrir';
        }
      })();
    });
    return el('div', {}, [
      el('h2', { text: 'Importar STL (voxelizar)' }),
      el('p', {
        class: 'sub',
        text: 'Malha 3D fechada (impressao 3D) vira modelo voxel editavel, com Z para cima e pes no chao. STL nao tem cor: tudo chega no material base, e voce pinta no editor.',
      }),
      fileInput,
      el('div', { class: 'grid2' }, [
        el('div', {}, [el('label', { text: 'Altura do modelo (voxels finos)' }), heightInput]),
        el('div', {}, [el('label', { text: 'Material base' }), materialSelect]),
      ]),
      el('div', {}, [el('label', { text: 'Preset (canvas e animacoes)' }), presetSelect]),
      el('div', {}, [el('label', { text: 'id do sprite' }), idInput]),
      doImport,
    ]);
  });

const catalogSheet = (onImport: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
    for (const entry of GAME_CATALOG) {
      const btn = el('button', { text: entry.label });
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = 'Abrindo…';
        void (async () => {
          try {
            const [pngRes, jsonRes] = await Promise.all([fetch(entry.png), fetch(entry.json)]);
            const manifest = (await jsonRes.json()) as SpriteManifestEntry;
            const atlas = await blobToGrid(await pngRes.blob());
            normalizeGrid(atlas, false);
            const project = projectFromManifest(manifest, sliceAtlas(manifest, atlas));
            close();
            onImport(project);
          } catch (err) {
            toast(`Falha ao abrir: ${(err as Error).message}`);
            btn.disabled = false;
            btn.textContent = entry.label;
          }
        })();
      });
      list.append(btn);
    }
    return el('div', {}, [
      el('h2', { text: 'Abrir do jogo' }),
      el('p', {
        class: 'sub',
        text: 'Atlases oficiais embarcados no app (funciona offline). Abrem como projeto pixel, frame a frame — o modo voxel e para personagens novos.',
      }),
      list,
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
  const catalogBtn = el('button', { text: '🎮 Abrir do jogo' });
  catalogBtn.addEventListener('click', () => {
    void catalogSheet((p) => {
      void saveProject(p).then(() => openEditor(p));
    });
  });
  const stlBtn = el('button', { text: '🗿 Importar STL' });
  stlBtn.addEventListener('click', () => {
    void importStlSheet((p) => {
      void saveProject(p).then(() => openEditor(p));
    });
  });

  container.append(
    el('h1', {}, [el('img', { src: './icon-192.png', alt: '' }), 'Voxelyn Atlas Studio']),
    el('p', {
      class: 'sub',
      text: 'Monte personagens voxel a voxel (ou pixel a pixel), importe e exporte atlases no formato do Voxelyn Survival — com a paleta veio-fungico e o contrato da Art Bible.',
    }),
    el('div', { class: 'actions' }, [newBtn, catalogBtn]),
    el('div', { class: 'actions' }, [stlBtn, importBtn]),
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
            text: `${project.spriteId} · ${project.mode === 'voxel' ? 'voxel' : 'pixel'} · v${project.version} · ${project.frameWidth}×${project.frameHeight} · ${new Date(project.updatedAt).toLocaleDateString('pt-BR')}`,
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
