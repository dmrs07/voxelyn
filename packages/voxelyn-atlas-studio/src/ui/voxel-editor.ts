// Editor VOXEL mobile-first: o personagem e um modelo 3D montado como Lego,
// camada por camada (fatias horizontais em z). O preview isometrico ao lado e
// o rasterizador REAL do jogo (port com teste de paridade), entao o que voce
// ve na fatia ja aparece assado com rampa, oclusao e quina acesa — e as quatro
// direcoes saem por rotacao do MESMO modelo, sem redesenhar nada.
import type { Project } from '../types';
import { modelKey } from '../types';
import { bakeFrame } from '../atlas';
import { COLORS, HEX, toHex } from '../palette';
import { orderedAnims, ANIM_ORDER } from '../presets';
import {
  RAMPS,
  VOXEL_DIRS,
  VOXEL_MATERIALS,
  mirrorModelX,
  parseVoxelKey,
  shiftModel,
  voxelKey,
  voxelModelBounds,
  voxelProjectedBounds,
  type VoxelModel,
} from '../voxel';
import { saveProject } from '../store';
import { el, openSheet, toast } from './components';
import { openExportSheet } from './sheets';

type Tool = 'pencil' | 'eraser' | 'fill' | 'picker';

const TOOL_ICONS: Record<Tool, string> = {
  pencil: '🧱',
  eraser: '🧽',
  fill: '🪣',
  picker: '💉',
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Colocar voxel',
  eraser: 'Remover voxel',
  fill: 'Preencher fatia',
  picker: 'Conta-gotas',
};

/** Limite de alcance da grade de edicao (unidades finas a partir da origem). */
const RANGE = 48;

type HistEntry = { mKey: string; before: VoxelModel; after: VoxelModel };

export const mountVoxelEditor = (root: HTMLElement, project: Project, onBack: () => void): void => {
  root.innerHTML = '';
  project.models ??= {};
  project.mode = 'voxel';
  // voxel: as 4 direcoes sempre saem do modelo — nada de flips
  project.authoredDirs = [...VOXEL_DIRS];
  project.flipPairs = {};

  // ---------------- estado ----------------
  let anims = orderedAnims(project.animations);
  let anim = anims[0];
  let frameIndex = 0;
  let z = 0;
  let tool: Tool = 'pencil';
  let material = 'player';
  let brushSize = 1;
  let mirror = false;
  let ghost = true;
  let previewDir = 'dr';
  let playing = false;
  let playStart = 0;

  const undoStack: HistEntry[] = [];
  const redoStack: HistEntry[] = [];

  const currentModelKey = (): string => modelKey(anim, frameIndex);
  const currentModel = (): VoxelModel => project.models![currentModelKey()] ?? {};
  const setCurrentModel = (m: VoxelModel): void => {
    project.models![currentModelKey()] = m;
  };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = (): void => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveProject(project), 700);
  };

  // ---------------- topbar ----------------
  const backBtn = el('button', { text: '←', title: 'Voltar' });
  const undoBtn = el('button', { text: '↩', title: 'Desfazer' });
  const redoBtn = el('button', { text: '↪', title: 'Refazer' });
  const fitBtn = el('button', { text: '⤢', title: 'Enquadrar fatia' });
  const menuBtn = el('button', { text: '⋮', title: 'Menu' });
  const title = el('div', { class: 'title', text: `${project.name} · voxel` });
  const topbar = el('div', { class: 'topbar' }, [
    backBtn,
    title,
    undoBtn,
    redoBtn,
    fitBtn,
    menuBtn,
  ]);

  // ---------------- preview isometrico ----------------
  const previewCanvas = el('canvas');
  const previewWrap = el('div', { class: 'voxel-preview' }, [previewCanvas]);
  const previewCtx = previewCanvas.getContext('2d')!;
  const previewOff = document.createElement('canvas');
  const previewOffCtx = previewOff.getContext('2d')!;

  const renderPreview = (): void => {
    const g = bakeFrame(project, previewDir, anim, frameIndex);
    previewOff.width = g.w;
    previewOff.height = g.h;
    previewOffCtx.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
    const rect = previewWrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    previewCanvas.width = Math.max(1, Math.round(rect.width * dpr));
    previewCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewCtx.imageSmoothingEnabled = false;
    const scale = Math.max(
      1,
      Math.floor(Math.min(previewCanvas.width / g.w, previewCanvas.height / g.h)),
    );
    const ox = Math.floor((previewCanvas.width - g.w * scale) / 2);
    const oy = Math.floor((previewCanvas.height - g.h * scale) / 2);
    previewCtx.drawImage(previewOff, ox, oy, g.w * scale, g.h * scale);
  };

  const dirTabs = el('div', { class: 'row', style: 'flex-direction:column;gap:6px;padding:0' });
  const dirTabButtons = new Map<string, HTMLButtonElement>();
  for (const d of VOXEL_DIRS) {
    const b = el('button', { class: 'dir-tab', text: d, style: 'flex:none;min-width:44px' });
    b.addEventListener('click', () => {
      previewDir = d;
      updateDirTabs();
      renderPreview();
    });
    dirTabButtons.set(d, b);
    dirTabs.append(b);
  }
  const updateDirTabs = (): void => {
    for (const [d, b] of dirTabButtons) b.classList.toggle('active', d === previewDir);
  };

  const previewRow = el('div', { class: 'voxel-preview-row' }, [previewWrap, dirTabs]);

  // ---------------- fatia (slice) ----------------
  const canvas = el('canvas');
  const hud = el('div', { class: 'hud' });
  const canvasWrap = el('div', { class: 'canvas-wrap' }, [canvas, hud]);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const view = { scale: 18, x: 0, y: 0 };

  const resizeCanvas = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  };

  const fitView = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    const bounds = voxelModelBounds(currentModel());
    const spanX = bounds ? bounds.maxX - bounds.minX + 5 : 17;
    const spanY = bounds ? bounds.maxY - bounds.minY + 5 : 17;
    const scale = Math.max(6, Math.floor(Math.min(rect.width / spanX, rect.height / spanY)));
    view.scale = Math.min(40, scale);
    const cx = bounds ? (bounds.minX + bounds.maxX + 1) / 2 : 0;
    const cy = bounds ? (bounds.minY + bounds.maxY + 1) / 2 : 0;
    view.x = rect.width / 2 - cx * view.scale;
    view.y = rect.height / 2 - cy * view.scale;
    render();
  };

  const render = (): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = view.scale;
    const rect = canvasWrap.getBoundingClientRect();
    const minCX = Math.floor((0 - view.x) / s) - 1;
    const maxCX = Math.floor((rect.width - view.x) / s) + 1;
    const minCY = Math.floor((0 - view.y) / s) - 1;
    const maxCY = Math.floor((rect.height - view.y) / s) + 1;
    const model = currentModel();

    // camada de baixo (fantasma) para alinhar como planta de Lego
    if (ghost) {
      ctx.globalAlpha = 0.35;
      for (const [key, mat] of Object.entries(model)) {
        const [x, y, vz] = parseVoxelKey(key);
        if (vz !== z - 1 || x < minCX || x > maxCX || y < minCY || y > maxCY) continue;
        ctx.fillStyle = HEX[RAMPS[mat][2]] ?? '#333';
        ctx.fillRect(view.x + x * s, view.y + y * s, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // camada atual: cor de TOPO da rampa (a face que a fatia mostra)
    for (const [key, mat] of Object.entries(model)) {
      const [x, y, vz] = parseVoxelKey(key);
      if (vz !== z || x < minCX || x > maxCX || y < minCY || y > maxCY) continue;
      ctx.fillStyle = HEX[RAMPS[mat][0]] ?? '#fff';
      ctx.fillRect(view.x + x * s, view.y + y * s, s, s);
    }

    // grade
    if (s >= 8) {
      ctx.strokeStyle = 'rgba(122,139,163,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = minCX; x <= maxCX + 1; x++) {
        ctx.moveTo(view.x + x * s, view.y + minCY * s);
        ctx.lineTo(view.x + x * s, view.y + (maxCY + 1) * s);
      }
      for (let y = minCY; y <= maxCY + 1; y++) {
        ctx.moveTo(view.x + minCX * s, view.y + y * s);
        ctx.lineTo(view.x + (maxCX + 1) * s, view.y + y * s);
      }
      ctx.stroke();
    }

    // eixos da origem (entre os pes) e frente do modelo (-y)
    ctx.strokeStyle = 'rgba(89,242,194,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(view.x, view.y + minCY * s);
    ctx.lineTo(view.x, view.y + (maxCY + 1) * s);
    ctx.moveTo(view.x + minCX * s, view.y);
    ctx.lineTo(view.x + (maxCX + 1) * s, view.y);
    ctx.stroke();

    // eixo de simetria do espelho (x = -0.5)
    if (mirror) {
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(view.x, view.y + minCY * s);
      ctx.lineTo(view.x, view.y + (maxCY + 1) * s);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const count = Object.keys(model).length;
    hud.textContent = `z=${z} · ${anim} ${frameIndex + 1}/${project.animations[anim]?.frames ?? 0} · ${count} voxels · ${TOOL_LABELS[tool]} (${material})`;
  };

  // ---------------- edicao ----------------
  const applyBrush = (m: VoxelModel, cx: number, cy: number, erase: boolean): void => {
    const half = Math.floor((brushSize - 1) / 2);
    for (let oy = 0; oy < brushSize; oy++) {
      for (let ox = 0; ox < brushSize; ox++) {
        const x = cx - half + ox;
        const y = cy - half + oy;
        if (Math.abs(x) > RANGE || Math.abs(y) > RANGE || Math.abs(z) > RANGE) continue;
        const targets = mirror ? [[x, y] as const, [-1 - x, y] as const] : [[x, y] as const];
        for (const [tx, ty] of targets) {
          if (erase) delete m[voxelKey(tx, ty, z)];
          else m[voxelKey(tx, ty, z)] = material;
        }
      }
    }
  };

  const fillSlice = (m: VoxelModel, cx: number, cy: number): void => {
    const at = (x: number, y: number): string | undefined => m[voxelKey(x, y, z)];
    const target = at(cx, cy);
    if (target === material) return;
    const stack = [[cx, cy]];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (Math.abs(x) > RANGE || Math.abs(y) > RANGE) continue;
      const k = `${x},${y}`;
      if (seen.has(k) || at(x, y) !== target) continue;
      seen.add(k);
      m[voxelKey(x, y, z)] = material;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };

  // ---------------- gestos ----------------
  const pointers = new Map<number, { x: number; y: number }>();
  let strokeBefore: VoxelModel | null = null;
  let strokeModel: VoxelModel | null = null;
  let strokeCancelled = false;
  let pinchDist = 0;
  let pinchScale = 0;

  const cellAt = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - view.x) / view.scale),
      y: Math.floor((clientY - rect.top - view.y) / view.scale),
    };
  };

  const beginStroke = (cell: { x: number; y: number }): void => {
    if (playing) return;
    strokeBefore = structuredClone(currentModel());
    strokeModel = structuredClone(strokeBefore);
    strokeCancelled = false;
    if (tool === 'pencil') applyBrush(strokeModel, cell.x, cell.y, false);
    else if (tool === 'eraser') applyBrush(strokeModel, cell.x, cell.y, true);
    else if (tool === 'fill') fillSlice(strokeModel, cell.x, cell.y);
    setCurrentModel(strokeModel);
    render();
    renderPreview();
  };

  const moveStroke = (cell: { x: number; y: number }): void => {
    if (!strokeModel || strokeCancelled || playing) return;
    if (tool === 'pencil') applyBrush(strokeModel, cell.x, cell.y, false);
    else if (tool === 'eraser') applyBrush(strokeModel, cell.x, cell.y, true);
    else return;
    setCurrentModel(strokeModel);
    render();
    renderPreview();
  };

  const commitStroke = (cell: { x: number; y: number } | null): void => {
    if (!strokeBefore || !strokeModel) return;
    if (strokeCancelled) {
      strokeBefore = null;
      strokeModel = null;
      return;
    }
    if (tool === 'picker' && cell) {
      const mat = currentModel()[voxelKey(cell.x, cell.y, z)];
      if (mat) {
        material = mat;
        tool = 'pencil';
        updateToolbar();
        updateMaterials();
        toast(`Material: ${mat}`);
      }
      strokeBefore = null;
      strokeModel = null;
      return;
    }
    const before = strokeBefore;
    const after = structuredClone(strokeModel);
    strokeBefore = null;
    strokeModel = null;
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    undoStack.push({ mKey: currentModelKey(), before, after });
    if (undoStack.length > 64) undoStack.shift();
    redoStack.length = 0;
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
  };

  const cancelStroke = (): void => {
    if (strokeBefore && !strokeCancelled) {
      setCurrentModel(strokeBefore);
      strokeCancelled = true;
      render();
      renderPreview();
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) beginStroke(cellAt(e.clientX, e.clientY));
    else if (pointers.size === 2) {
      cancelStroke();
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = view.scale;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) moveStroke(cellAt(e.clientX, e.clientY));
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = canvas.getBoundingClientRect();
      const worldX = (cx - rect.left - view.x) / view.scale;
      const worldY = (cy - rect.top - view.y) / view.scale;
      if (pinchDist > 0) view.scale = Math.min(48, Math.max(4, (pinchScale * dist) / pinchDist));
      view.x = cx - rect.left - worldX * view.scale;
      view.y = cy - rect.top - worldY * view.scale;
      render();
    }
  });

  const endPointer = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) commitStroke(cellAt(e.clientX, e.clientY));
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      cancelStroke();
      strokeBefore = null;
      strokeModel = null;
    }
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - view.x) / view.scale;
      const worldY = (e.clientY - rect.top - view.y) / view.scale;
      view.scale = Math.min(48, Math.max(4, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      view.x = e.clientX - rect.left - worldX * view.scale;
      view.y = e.clientY - rect.top - worldY * view.scale;
      render();
    },
    { passive: false },
  );

  // ---------------- undo/redo ----------------
  const updateUndoRedo = (): void => {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  };

  const applyHistory = (model: VoxelModel, mKey: string): void => {
    project.models![mKey] = structuredClone(model);
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
    renderPreview();
  };

  undoBtn.addEventListener('click', () => {
    const entry = undoStack.pop();
    if (!entry) return;
    redoStack.push(entry);
    applyHistory(entry.before, entry.mKey);
  });
  redoBtn.addEventListener('click', () => {
    const entry = redoStack.pop();
    if (!entry) return;
    undoStack.push(entry);
    applyHistory(entry.after, entry.mKey);
  });

  backBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    void saveProject(project).then(onBack);
  });
  fitBtn.addEventListener('click', fitView);

  // ---------------- ferramentas ----------------
  const toolsRow = el('div', { class: 'row' });
  const toolButtons = new Map<Tool, HTMLButtonElement>();
  for (const t of Object.keys(TOOL_ICONS) as Tool[]) {
    const btn = el('button', { class: 'toolbtn', text: TOOL_ICONS[t], title: TOOL_LABELS[t] });
    btn.addEventListener('click', () => {
      tool = t;
      updateToolbar();
    });
    toolButtons.set(t, btn);
    toolsRow.append(btn);
  }
  const brushBtn = el('button', { class: 'toolbtn', text: '1', title: 'Tamanho do pincel' });
  brushBtn.addEventListener('click', () => {
    brushSize = brushSize === 1 ? 2 : brushSize === 2 ? 3 : 1;
    brushBtn.textContent = String(brushSize);
  });
  const mirrorBtn = el('button', { class: 'toolbtn', text: '⇋', title: 'Espelho em X' });
  mirrorBtn.addEventListener('click', () => {
    mirror = !mirror;
    mirrorBtn.classList.toggle('active', mirror);
    render();
  });
  const ghostBtn = el('button', { class: 'toolbtn', text: '👻', title: 'Camada de baixo' });
  ghostBtn.addEventListener('click', () => {
    ghost = !ghost;
    ghostBtn.classList.toggle('active', ghost);
    render();
  });
  const zDown = el('button', { class: 'toolbtn', text: 'z−', title: 'Camada abaixo' });
  const zUp = el('button', { class: 'toolbtn', text: 'z+', title: 'Camada acima' });
  const zLabel = el('span', { class: 'budget', text: 'z=0' });
  zDown.addEventListener('click', () => {
    z = Math.max(-RANGE, z - 1);
    zLabel.textContent = `z=${z}`;
    render();
  });
  zUp.addEventListener('click', () => {
    z = Math.min(RANGE, z + 1);
    zLabel.textContent = `z=${z}`;
    render();
  });
  toolsRow.append(brushBtn, mirrorBtn, ghostBtn, zDown, zLabel, zUp);

  const updateToolbar = (): void => {
    for (const [t, btn] of toolButtons) btn.classList.toggle('active', t === tool);
    ghostBtn.classList.toggle('active', ghost);
    mirrorBtn.classList.toggle('active', mirror);
    render();
  };

  // ---------------- materiais ----------------
  const materialsRow = el('div', { class: 'row' });
  const matButtons = new Map<string, HTMLButtonElement>();
  for (const mat of VOXEL_MATERIALS) {
    const ramp = RAMPS[mat];
    const top = COLORS[ramp[0]] ? toHex(COLORS[ramp[0]]) : '#fff';
    const side = COLORS[ramp[2]] ? toHex(COLORS[ramp[2]]) : '#333';
    const b = el('button', {
      class: 'swatch',
      style: `background:linear-gradient(135deg, ${top} 0 55%, ${side} 55% 100%)`,
      title: mat,
    });
    b.addEventListener('click', () => {
      material = mat;
      if (tool === 'eraser' || tool === 'picker') tool = 'pencil';
      updateToolbar();
      updateMaterials();
    });
    matButtons.set(mat, b);
    materialsRow.append(b);
  }
  const updateMaterials = (): void => {
    for (const [mat, b] of matButtons) b.classList.toggle('active', mat === material);
  };

  // ---------------- timeline ----------------
  const animSelect = el('select', { class: 'anim-select' });
  const playBtn = el('button', { class: 'toolbtn', text: '▶', title: 'Reproduzir' });
  const copyPrevBtn = el('button', { class: 'toolbtn', text: '⧉', title: 'Copiar frame anterior' });
  const clearBtn = el('button', { class: 'toolbtn', text: '🗑', title: 'Limpar frame' });
  const frameStripWrap = el('div', { class: 'row' });
  const timelineRow = el('div', { class: 'row' }, [animSelect, playBtn, copyPrevBtn, clearBtn]);

  const updateAnimSelect = (): void => {
    anims = orderedAnims(project.animations);
    animSelect.innerHTML = '';
    for (const a of anims) {
      const def = project.animations[a];
      animSelect.append(el('option', { value: a, text: `${a} (${def.frames}f @ ${def.fps}fps)` }));
    }
    if (!anims.includes(anim)) anim = anims[0];
    animSelect.value = anim;
  };

  animSelect.addEventListener('change', () => {
    anim = animSelect.value;
    frameIndex = 0;
    stopPlayback();
    updateFrameStrip();
    render();
    renderPreview();
  });

  const updateFrameStrip = (): void => {
    frameStripWrap.innerHTML = '';
    const def = project.animations[anim];
    if (!def) return;
    for (let f = 0; f < def.frames; f++) {
      const thumb = el('button', { class: `frame-thumb${f === frameIndex ? ' active' : ''}` });
      const c = el('canvas');
      const g = bakeFrame(project, previewDir, anim, f);
      c.width = g.w;
      c.height = g.h;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
      thumb.append(c, el('span', { class: 'n', text: String(f + 1) }));
      thumb.addEventListener('click', () => {
        frameIndex = f;
        stopPlayback();
        updateFrameStrip();
        render();
        renderPreview();
      });
      frameStripWrap.append(thumb);
    }
  };

  const pushModelEdit = (before: VoxelModel, after: VoxelModel): void => {
    undoStack.push({ mKey: currentModelKey(), before, after });
    if (undoStack.length > 64) undoStack.shift();
    redoStack.length = 0;
    setCurrentModel(structuredClone(after));
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
    renderPreview();
  };

  copyPrevBtn.addEventListener('click', () => {
    if (frameIndex === 0) {
      toast('Nao ha frame anterior nesta animacao');
      return;
    }
    const prev = project.models![modelKey(anim, frameIndex - 1)] ?? {};
    pushModelEdit(structuredClone(currentModel()), structuredClone(prev));
  });

  clearBtn.addEventListener('click', () => {
    pushModelEdit(structuredClone(currentModel()), {});
  });

  // ---------------- playback ----------------
  const stopPlayback = (): void => {
    playing = false;
    playBtn.textContent = '▶';
  };

  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '⏸' : '▶';
    if (playing) {
      playStart = performance.now();
      const tick = (): void => {
        if (!playing) return;
        const def = project.animations[anim];
        const elapsed = performance.now() - playStart;
        const raw = Math.floor((elapsed / 1000) * def.fps);
        const next = def.loop ? raw % def.frames : Math.min(raw, def.frames - 1);
        if (next !== frameIndex) {
          frameIndex = next;
          updateFrameStrip();
          render();
          renderPreview();
        }
        if (!def.loop && raw >= def.frames) {
          stopPlayback();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  // ---------------- menu ----------------
  menuBtn.addEventListener('click', () => {
    void openSheet((close) => {
      const exportBtn = el('button', { class: 'primary', text: '⇪ Validar & exportar atlas' });
      const moveBtn = el('button', { text: '✥ Mover modelo (frame atual)' });
      const mirrorAllBtn = el('button', { text: '⇋ Espelhar modelo inteiro em X' });
      const settings = el('button', { text: '⚙ Configuracoes do sprite' });
      const boundsBtn = el('button', { text: '📐 Conferir se cabe no frame' });
      exportBtn.addEventListener('click', () => {
        close();
        void openExportSheet(project, scheduleSave);
      });
      moveBtn.addEventListener('click', () => {
        close();
        void openMoveSheet();
      });
      mirrorAllBtn.addEventListener('click', () => {
        close();
        pushModelEdit(structuredClone(currentModel()), mirrorModelX(currentModel()));
        toast('Modelo espelhado em X');
      });
      settings.addEventListener('click', () => {
        close();
        void openSettingsSheet();
      });
      boundsBtn.addEventListener('click', () => {
        const b = voxelProjectedBounds(currentModel());
        const fitsW = b.w <= project.frameWidth - 4;
        const fitsH = b.h <= project.frameHeight - 4;
        toast(
          `Projecao nas 4 direcoes: ${b.w}×${b.h}px · frame util ${project.frameWidth - 4}×${project.frameHeight - 4}px ${fitsW && fitsH ? '✓' : '✕ NAO CABE'}`,
        );
      });
      return el('div', {}, [
        el('h2', { text: `${project.name} · voxel` }),
        el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [
          exportBtn,
          moveBtn,
          mirrorAllBtn,
          boundsBtn,
          settings,
        ]),
      ]);
    });
  });

  const openMoveSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const move = (dx: number, dy: number, dz: number): void => {
        pushModelEdit(structuredClone(currentModel()), shiftModel(currentModel(), dx, dy, dz));
      };
      const btn = (label: string, dx: number, dy: number, dz: number): HTMLButtonElement => {
        const b = el('button', { text: label });
        b.addEventListener('click', () => move(dx, dy, dz));
        return b;
      };
      container.append(
        el('h2', { text: 'Mover modelo do frame' }),
        el('p', {
          class: 'sub',
          text: 'Desloca todos os voxels do frame atual em 1 unidade fina. Frente do modelo = −y.',
        }),
        el('div', { class: 'grid3' }, [
          btn('← x−1', -1, 0, 0),
          btn('x+1 →', 1, 0, 0),
          btn('frente (y−1)', 0, -1, 0),
          btn('tras (y+1)', 0, 1, 0),
          btn('subir (z+1)', 0, 0, 1),
          btn('descer (z−1)', 0, 0, -1),
        ]),
        (() => {
          const done = el('button', { class: 'primary', text: 'Concluir' });
          done.addEventListener('click', close);
          return done;
        })(),
      );
      return container;
    });

  const openSettingsSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const nameInput = el('input', { value: project.name });
      const idInput = el('input', { value: project.spriteId, autocapitalize: 'none' });
      const num = (value: number, min = 0): HTMLInputElement =>
        el('input', { type: 'number', value: String(value), min: String(min), step: 'any' });
      const wInput = num(project.frameWidth, 8);
      const hInput = num(project.frameHeight, 8);
      const axInput = num(project.anchorX);
      const ayInput = num(project.anchorY);
      const hbW = num(project.hitbox.w);
      const hbH = num(project.hitbox.h);

      const animBox = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
      const animState = new Map<
        string,
        { frames: HTMLInputElement; fps: HTMLInputElement; loop: HTMLInputElement }
      >();
      const renderAnimRows = (): void => {
        animBox.innerHTML = '';
        for (const a of orderedAnims(project.animations)) {
          const def = project.animations[a];
          const frames = num(def.frames, 1);
          const fps = num(def.fps, 1);
          const loop = el('input', { type: 'checkbox' });
          loop.checked = def.loop;
          animState.set(a, { frames, fps, loop });
          const remove = el('button', {
            class: 'danger',
            text: '✕',
            style: 'min-height:36px;padding:4px',
          });
          remove.addEventListener('click', () => {
            delete project.animations[a];
            animState.delete(a);
            renderAnimRows();
          });
          animBox.append(
            el('div', { class: 'anim-row' }, [
              el('span', { class: 'name', text: a }),
              frames,
              fps,
              loop,
              remove,
            ]),
          );
        }
        const addSelect = el('select');
        addSelect.append(el('option', { value: '', text: '+ adicionar animacao…' }));
        for (const a of ANIM_ORDER) {
          if (!project.animations[a]) addSelect.append(el('option', { value: a, text: a }));
        }
        addSelect.addEventListener('change', () => {
          if (!addSelect.value) return;
          project.animations[addSelect.value] = { frames: 4, fps: 10, loop: false };
          renderAnimRows();
        });
        animBox.append(addSelect);
      };
      renderAnimRows();

      const apply = el('button', { class: 'primary', text: 'Aplicar' });
      apply.addEventListener('click', () => {
        project.name = nameInput.value.trim() || project.name;
        project.spriteId = idInput.value.trim() || project.spriteId;
        project.frameWidth = Math.max(8, Math.round(Number(wInput.value) || project.frameWidth));
        project.frameHeight = Math.max(8, Math.round(Number(hInput.value) || project.frameHeight));
        project.anchorX = Math.round(Number(axInput.value) || 0);
        project.anchorY = Math.round(Number(ayInput.value) || 0);
        project.hitbox = { w: Number(hbW.value) || 0.5, h: Number(hbH.value) || 0.5 };
        for (const [a, state] of animState) {
          project.animations[a] = {
            frames: Math.max(1, Math.round(Number(state.frames.value) || 1)),
            fps: Math.max(1, Number(state.fps.value) || 1),
            loop: state.loop.checked,
          };
        }
        anims = orderedAnims(project.animations);
        if (!anims.includes(anim)) anim = anims[0];
        const def = project.animations[anim];
        if (frameIndex >= def.frames) frameIndex = def.frames - 1;
        title.textContent = `${project.name} · voxel`;
        undoStack.length = 0;
        redoStack.length = 0;
        updateUndoRedo();
        updateAnimSelect();
        updateFrameStrip();
        scheduleSave();
        render();
        renderPreview();
        close();
      });

      container.append(
        el('h2', { text: 'Configuracoes do sprite' }),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Nome' }), nameInput]),
          el('div', {}, [el('label', { text: 'id do sprite' }), idInput]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Largura do frame (px)' }), wInput]),
          el('div', {}, [el('label', { text: 'Altura do frame (px)' }), hInput]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Anchor X (origem do modelo)' }), axInput]),
          el('div', {}, [el('label', { text: 'Anchor Y' }), ayInput]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Hitbox w (tiles)' }), hbW]),
          el('div', {}, [el('label', { text: 'Hitbox h (tiles)' }), hbH]),
        ]),
        el('div', {}, [el('label', { text: 'Animacoes (frames / fps / loop)' }), animBox]),
        apply,
      );
      return container;
    });

  // ---------------- montagem ----------------
  const bottom = el('div', { class: 'bottom' }, [
    toolsRow,
    materialsRow,
    timelineRow,
    frameStripWrap,
  ]);
  const mainCol = el(
    'div',
    { class: 'main-col', style: 'display:flex;flex-direction:column;flex:1;min-height:0' },
    [topbar, previewRow, canvasWrap, bottom],
  );
  root.append(el('div', { class: 'editor' }, [mainCol]));

  const resizeObserver = new ResizeObserver(() => {
    resizeCanvas();
    renderPreview();
  });
  resizeObserver.observe(canvasWrap);

  updateToolbar();
  updateMaterials();
  updateDirTabs();
  updateAnimSelect();
  updateFrameStrip();
  updateUndoRedo();
  requestAnimationFrame(() => {
    resizeCanvas();
    fitView();
    renderPreview();
  });
};
