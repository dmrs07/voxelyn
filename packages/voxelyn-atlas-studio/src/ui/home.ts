// Tela inicial: lista de projetos, criacao por preset e import de atlas.
import { PRESETS, createProjectFromPreset } from '../presets';
import { deleteProject, listProjects, saveProject } from '../store';
import type { Project, SpriteManifestEntry } from '../types';
import { blobToGrid, normalizeGrid } from '../png';
import { projectFromManifest, sliceAtlas, projectFrame } from '../atlas';
import { orderedAnims } from '../presets';
import { GAME_CATALOG } from '../catalog';
import { fitFrames, parseStl, voxelizeStl, voxelizeTriangles } from '../stl';
import { clipTimes, orientTriangles, parseGlb, type GlbOrientation } from '../glb';
import { GAME_CONTRACTS, createProjectFromContract } from '../contracts';
import { quantizeToMaterials, sampleTriangleColors } from '../texture';
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

/**
 * Import de GLB: malha E animacao. Um clipe do GLB e amostrado em N instantes,
 * cada instante e voxelizado, e sai um frame Voxelyn — ou seja, a animacao
 * pronta de uma ferramenta 3D entra pelo mesmo voxelizador que ja assa o STL.
 *
 * O enquadramento e UM SO para todos os frames de todas as animacoes: enquadrar
 * cada frame por conta propria faria o bicho crescer, encolher e pular de lugar
 * a cada pose, porque os limites da malha mudam quando ela se mexe.
 */
const importGlbSheet = (onImport: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const container = el('div');
    const fileInput = el('input', { type: 'file', accept: '.glb,.gltf' });
    const info = el('p', { class: 'sub', text: 'Nenhum arquivo carregado.' });
    const mapBox = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    // O alvo pode ser um preset generico OU o contrato de uma entidade que ja
    // existe: importar a malha nova ja dentro da moldura certa e o que faz o
    // export cair como substituicao direta, sem passar pelas configuracoes.
    const presetSelect = el('select');
    for (const p of PRESETS)
      presetSelect.append(el('option', { value: `preset:${p.id}`, text: p.label }));
    for (const c of GAME_CONTRACTS) {
      presetSelect.append(
        el('option', {
          value: `contract:${c.id}`,
          text: `${c.id} — contrato do jogo (${c.manifest.frameWidth}×${c.manifest.frameHeight})`,
        }),
      );
    }
    const materialSelect = el('select');
    for (const mat of VOXEL_MATERIALS)
      materialSelect.append(el('option', { value: mat, text: mat }));
    materialSelect.value = 'rock';
    const heightInput = el('input', { type: 'number', min: '4', max: '48', value: '24' });
    // Cores: aproximar a textura do GLB nos materiais do jogo. O teto existe
    // porque cada material traz uma rampa inteira, e o atlas so aceita 20 cores.
    const colorCheck = el('input', { type: 'checkbox' });
    colorCheck.checked = true;
    const maxMatSelect = el('select');
    for (const n of [2, 3, 4, 5, 6])
      maxMatSelect.append(el('option', { value: String(n), text: `${n} materiais` }));
    maxMatSelect.value = '4';
    const upSelect = el('select');
    upSelect.append(
      el('option', { value: 'y', text: 'Y para cima (padrao glTF/Meshy)' }),
      el('option', { value: 'z', text: 'Z para cima' }),
    );
    const yawSelect = el('select');
    for (const d of [0, 90, 180, 270])
      yawSelect.append(el('option', { value: String(d), text: `${d}°` }));
    const idInput = el('input', {
      placeholder: 'ex.: enemy-crystal-crab',
      autocapitalize: 'none',
      spellcheck: 'false',
    });
    const doImport = el('button', { class: 'primary', text: 'Voxelizar e abrir' });
    doImport.disabled = true;

    let scene: ReturnType<typeof parseGlb> | null = null;
    const clipFor = new Map<string, HTMLSelectElement>();

    const orientation = (): GlbOrientation => ({
      up: upSelect.value === 'z' ? 'z' : 'y',
      yaw: Number(yawSelect.value) as GlbOrientation['yaw'],
    });

    /** Casa clipe do GLB com animacao do preset pelo nome, quando da. */
    const guessClip = (anim: string, names: string[]): number => {
      const a = anim.toLowerCase();
      const exact = names.findIndex((n) => n.toLowerCase() === a);
      if (exact >= 0) return exact;
      const partial = names.findIndex(
        (n) => n.toLowerCase().includes(a) || a.includes(n.toLowerCase()),
      );
      return partial;
    };

    const rebuildMapping = (): void => {
      mapBox.innerHTML = '';
      clipFor.clear();
      if (!scene) return;
      const [tipo, id] = presetSelect.value.split(':');
      const alvo =
        tipo === 'contract'
          ? GAME_CONTRACTS.find((c) => c.id === id)!.manifest.animations
          : PRESETS.find((p) => p.id === id)!.animations;
      const names = scene.animations.map((a) => a.name);
      for (const [anim, def] of Object.entries(alvo)) {
        const sel = el('select');
        sel.append(el('option', { value: '-1', text: 'pose de repouso (sem animacao)' }));
        scene.animations.forEach((clip, i) => {
          sel.append(
            el('option', { value: String(i), text: `${clip.name} (${clip.duration.toFixed(1)}s)` }),
          );
        });
        sel.value = String(guessClip(anim, names));
        clipFor.set(anim, sel);
        mapBox.append(
          el('div', { style: 'display:flex;gap:8px;align-items:center' }, [
            el('span', {
              class: 'budget',
              style: 'min-width:74px',
              text: `${anim} (${def.frames}f)`,
            }),
            sel,
          ]),
        );
      }
    };

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      info.textContent = 'Lendo…';
      void (async () => {
        try {
          scene = parseGlb(await file.arrayBuffer());
          const clips = scene.animations.length;
          info.textContent =
            `${scene.triangleCount.toLocaleString('pt-BR')} triangulos · ` +
            (clips > 0
              ? `${clips} animacao(oes): ${scene.animations.map((a) => a.name).join(', ')}`
              : 'sem animacao — entra so a malha');
          rebuildMapping();
          doImport.disabled = false;
        } catch (err) {
          scene = null;
          doImport.disabled = true;
          info.textContent = `Falha no GLB: ${(err as Error).message}`;
        }
      })();
    });
    presetSelect.addEventListener('change', rebuildMapping);

    doImport.addEventListener('click', () => {
      if (!scene) return;
      const spriteId = idInput.value.trim().toLowerCase().replace(/\s+/g, '-');
      if (!/^[a-z0-9-]+$/.test(spriteId)) {
        toast('Defina um id valido (minusculas e hifens)');
        return;
      }
      const glb = scene;
      const [alvoTipo, alvoId] = presetSelect.value.split(':');
      const contrato =
        alvoTipo === 'contract' ? GAME_CONTRACTS.find((c) => c.id === alvoId)! : null;
      const preset = contrato ? null : PRESETS.find((p) => p.id === alvoId)!;
      const animacoes = contrato ? contrato.manifest.animations : preset!.animations;
      const height = Math.max(4, Math.min(48, Number(heightInput.value) || 24));
      const o = orientation();
      doImport.disabled = true;

      void (async () => {
        try {
          // 1) amostra TODOS os frames de todas as animacoes...
          const jobs: { anim: string; frame: number; tris: Float32Array }[] = [];
          for (const [anim, def] of Object.entries(animacoes)) {
            const clip = Number(clipFor.get(anim)?.value ?? -1);
            const duration = clip >= 0 ? glb.animations[clip].duration : 0;
            const tempos = clipTimes(duration, def.frames, def.loop);
            for (let f = 0; f < def.frames; f++) {
              jobs.push({
                anim,
                frame: f,
                tris: orientTriangles(glb.sample(clip >= 0 ? clip : null, tempos[f]), o),
              });
            }
            doImport.textContent = `Amostrando ${anim}…`;
            await new Promise((r) => setTimeout(r, 0));
          }
          // 2) ...para um enquadramento so, e so entao voxeliza
          const fit = fitFrames(
            jobs.map((j) => j.tris),
            height,
          );
          // cores: uma amostragem so da textura serve TODOS os frames, porque o
          // triangulo N e o mesmo triangulo em qualquer instante do clipe
          let materialDoTriangulo: ((t: number) => string) | string = materialSelect.value;
          let usados: string[] = [];
          if (colorCheck.checked && glb.materials.length > 0) {
            doImport.textContent = 'Lendo as texturas…';
            await new Promise((r) => setTimeout(r, 0));
            const cores = await sampleTriangleColors(glb);
            const q = quantizeToMaterials(cores, Number(maxMatSelect.value));
            console.info('materiais escolhidos:', q.used.join(', '));
            materialDoTriangulo = (t: number) => q.materials[t] ?? materialSelect.value;
            usados = q.used;
          }

          const project = contrato
            ? createProjectFromContract(contrato)
            : createProjectFromPreset(preset!, spriteId, spriteId);
          project.spriteId = spriteId;
          project.mode = 'voxel';
          project.flipPairs = {};
          project.models = {};
          let done = 0;
          for (const job of jobs) {
            project.models[modelKey(job.anim, job.frame)] = voxelizeTriangles(
              job.tris,
              materialDoTriangulo,
              fit,
            );
            done++;
            doImport.textContent = `Voxelizando ${done}/${jobs.length}…`;
            await new Promise((r) => setTimeout(r, 0));
          }
          const first = project.models[modelKey(Object.keys(animacoes)[0], 0)];
          const b = voxelProjectedBounds(first);
          const fits = b.w <= project.frameWidth - 4 && b.h <= project.frameHeight - 4;
          toast(
            `${jobs.length} frames · projecao ${b.w}×${b.h}px ${fits ? '✓ cabe no frame' : `✕ frame util e ${project.frameWidth - 4}×${project.frameHeight - 4}px — reduza a altura`}${usados.length ? ` · materiais: ${usados.join(', ')}` : ''}`,
          );
          close();
          onImport(project);
        } catch (err) {
          toast(`Falha no GLB: ${(err as Error).message}`);
          doImport.disabled = false;
          doImport.textContent = 'Voxelizar e abrir';
        }
      })();
    });

    container.append(
      el('h2', { text: 'Importar GLB (malha + animacao)' }),
      el('p', {
        class: 'sub',
        text: 'GLB e o unico dos tres formatos que e um arquivo so e autocontido — malha, esqueleto e animacoes juntos. No Meshy, baixe em "glb". Cada animacao do arquivo e amostrada nos frames do preset e voxelizada.',
      }),
      fileInput,
      info,
      el('div', { class: 'grid2' }, [
        el('div', {}, [el('label', { text: 'Altura do modelo (voxels finos)' }), heightInput]),
        el('div', {}, [el('label', { text: 'Material base' }), materialSelect]),
      ]),
      el('div', { class: 'grid2' }, [
        el('div', {}, [el('label', { text: 'Eixo para cima' }), upSelect]),
        el('div', {}, [el('label', { text: 'Girar (se estiver de costas)' }), yawSelect]),
      ]),
      el('div', {}, [el('label', { text: 'Alvo (preset ou contrato do jogo)' }), presetSelect]),
      el('div', { class: 'grid2' }, [
        el('label', { style: 'display:flex;gap:8px;align-items:center' }, [
          colorCheck,
          el('span', { text: 'Usar as cores do modelo' }),
        ]),
        el('div', {}, [el('label', { text: 'Teto de materiais' }), maxMatSelect]),
      ]),
      el('div', {}, [el('label', { text: 'Animacao do GLB para cada animacao do jogo' }), mapBox]),
      el('div', {}, [el('label', { text: 'id do sprite' }), idInput]),
      doImport,
    );
    return container;
  });

/**
 * "Remodelar do jogo": projeto VOXEL vazio com o contrato exato de uma entidade
 * que ja existe. O catalogo ao lado abre o atlas em modo PIXEL (os modelos
 * voxel originais vivem em codigo e nao voltam do PNG); aqui o autor recebe a
 * moldura certa e monta o volume novo, e o export cai como substituicao direta.
 */
const remodelSheet = (onImport: (p: Project) => void): Promise<void> =>
  openSheet((close) => {
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    for (const contract of GAME_CONTRACTS) {
      const m = contract.manifest;
      const anims = Object.entries(m.animations)
        .map(([a, d]) => `${a} ${d.frames}f`)
        .join(' · ');
      const btn = el('button', { style: 'text-align:left' }, [
        el('div', { text: `${contract.label} — ${m.id}` }),
        el('div', {
          class: 'sub',
          style: 'margin:2px 0 0',
          text: `frame ${m.frameWidth}×${m.frameHeight} · ancora ${m.anchorX},${m.anchorY} · v${m.version} → v${m.version + 1}`,
        }),
        el('div', { class: 'sub', style: 'margin:0', text: anims }),
      ]);
      btn.addEventListener('click', () => {
        close();
        onImport(createProjectFromContract(contract));
      });
      list.append(btn);
    }
    return el('div', {}, [
      el('h2', { text: 'Remodelar do jogo (voxel)' }),
      el('p', {
        class: 'sub',
        text: 'Cria um projeto VOXEL VAZIO ja com o contrato da entidade: tamanho de frame, ancora, hitbox, footprint e a lista de animacoes com frames/fps/loop. Voce so monta o volume — o export cai como substituicao direta do par PNG+JSON.',
      }),
      list,
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
  const remodelBtn = el('button', { text: '🧊 Remodelar do jogo (voxel)' });
  remodelBtn.addEventListener('click', () => {
    void remodelSheet((p) => {
      void saveProject(p).then(() => openEditor(p));
    });
  });
  const glbBtn = el('button', { text: '🦴 Importar GLB (com animacao)' });
  glbBtn.addEventListener('click', () => {
    void importGlbSheet((p) => {
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
    el('div', { class: 'actions' }, [remodelBtn]),
    el('div', { class: 'actions' }, [glbBtn, stlBtn, importBtn]),
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
