// Editor VOXEL mobile-first. Duas vistas sobre o MESMO modelo:
//
// - MODELO (padrao): a vista isometrica renderizada pelo rasterizador real do
//   jogo e EDITAVEL — tocar na face de um voxel encaixa uma peca nela (Lego),
//   a borracha remove o voxel tocado, com pinch-zoom/pan livres e canvas
//   dimensionado pelo modelo (nunca corta). E aqui que se constroi.
// - FATIA: planta de uma camada z, para precisao fina (balde, simetria,
//   interiores). Ferramenta de apoio, nao o fluxo principal.
//
// As quatro direcoes saem por rotacao do mesmo modelo; um modelo por frame.
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
  renderVoxelView,
  shiftModel,
  voxelKey,
  voxelModelBounds,
  voxelProjectedBounds,
  type VoxelModel,
  type VoxelView,
} from '../voxel';
import { saveProject } from '../store';
import { el, openSheet, toast } from './components';
import { openExportSheet } from './sheets';

type Tool = 'pencil' | 'eraser' | 'fill' | 'box' | 'picker';
type ViewMode = 'model' | 'slice';

const TOOL_ICONS: Record<Tool, string> = {
  pencil: '🧱',
  eraser: '🧽',
  box: '⬛',
  fill: '🪣',
  picker: '💉',
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Colocar voxel',
  eraser: 'Remover voxel',
  box: 'Caixa (arraste na fatia)',
  fill: 'Balde da fatia',
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
  let viewMode: ViewMode = 'model';
  let dir = 'dr';
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
  const fitBtn = el('button', { text: '⤢', title: 'Enquadrar' });
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

  // ---------------- vistas e direcoes ----------------
  const modelTab = el('button', { class: 'dir-tab', text: '🧊 Modelo' });
  const sliceTab = el('button', { class: 'dir-tab', text: '▦ Fatia' });
  const viewRow = el('div', { class: 'row', style: 'padding-top:6px' }, [modelTab, sliceTab]);
  const dirButtons = new Map<string, HTMLButtonElement>();
  for (const d of VOXEL_DIRS) {
    const b = el('button', { class: 'dir-tab', text: d });
    b.addEventListener('click', () => {
      dir = d;
      updateViewRow();
      invalidateView();
      render();
      updateFrameStrip();
    });
    dirButtons.set(d, b);
    viewRow.append(b);
  }
  const setViewMode = (m: ViewMode): void => {
    viewMode = m;
    updateViewRow();
    fitView();
  };
  modelTab.addEventListener('click', () => setViewMode('model'));
  sliceTab.addEventListener('click', () => setViewMode('slice'));
  const updateViewRow = (): void => {
    modelTab.classList.toggle('active', viewMode === 'model');
    sliceTab.classList.toggle('active', viewMode === 'slice');
    for (const [d, b] of dirButtons) b.classList.toggle('active', d === dir);
  };

  // ---------------- canvas ----------------
  const canvas = el('canvas');
  const hud = el('div', { class: 'hud' });
  const canvasWrap = el('div', { class: 'canvas-wrap' }, [canvas, hud]);
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // transformes independentes por vista (px do canvas CSS)
  const modelView = { scale: 4, x: 0, y: 0 };
  const sliceView = { scale: 18, x: 0, y: 0 };
  const view = (): { scale: number; x: number; y: number } =>
    viewMode === 'model' ? modelView : sliceView;

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d')!;

  // cache da vista 3D do frame corrente (recalculada a cada edicao)
  let cachedView: VoxelView | null = null;
  const invalidateView = (): void => {
    cachedView = null;
  };
  const modelViewData = (): VoxelView => {
    cachedView ??= renderVoxelView(currentModel(), (VOXEL_DIRS as readonly string[]).indexOf(dir));
    return cachedView;
  };

  const resizeCanvas = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  };

  const fitView = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    if (viewMode === 'model') {
      // modelView.x/y e a posicao da ORIGEM do modelo na tela — ancorar nela
      // impede a vista de pular quando os limites do modelo crescem no meio de
      // um traco de edicao.
      const vd = modelViewData();
      const g = vd.grid;
      const scale = Math.max(2, Math.floor(Math.min(rect.width / g.w, rect.height / g.h) * 0.9));
      modelView.scale = Math.min(24, scale);
      modelView.x = (rect.width - g.w * modelView.scale) / 2 + vd.originX * modelView.scale;
      modelView.y = (rect.height - g.h * modelView.scale) / 2 + vd.originY * modelView.scale;
    } else {
      const bounds = voxelModelBounds(currentModel());
      const spanX = bounds ? bounds.maxX - bounds.minX + 5 : 17;
      const spanY = bounds ? bounds.maxY - bounds.minY + 5 : 17;
      const scale = Math.max(6, Math.floor(Math.min(rect.width / spanX, rect.height / spanY)));
      sliceView.scale = Math.min(40, scale);
      const cx = bounds ? (bounds.minX + bounds.maxX + 1) / 2 : 0;
      const cy = bounds ? (bounds.minY + bounds.maxY + 1) / 2 : 0;
      sliceView.x = rect.width / 2 - cx * sliceView.scale;
      sliceView.y = rect.height / 2 - cy * sliceView.scale;
    }
    render();
  };

  const renderModelView = (): void => {
    const vd = modelViewData();
    const g = vd.grid;
    offscreen.width = g.w;
    offscreen.height = g.h;
    offCtx.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
    ctx.imageSmoothingEnabled = false;
    const v = modelView;
    const cornerX = v.x - vd.originX * v.scale;
    const cornerY = v.y - vd.originY * v.scale;
    ctx.drawImage(offscreen, cornerX, cornerY, g.w * v.scale, g.h * v.scale);
    // linha do chao (z=0) passando pela origem, como referencia de apoio
    ctx.strokeStyle = 'rgba(89,242,194,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, v.y);
    ctx.lineTo(canvas.width / dpr, v.y);
    ctx.stroke();
    const count = Object.keys(currentModel()).length;
    hud.textContent = `${dir} · ${anim} ${frameIndex + 1}/${project.animations[anim]?.frames ?? 0} · ${count} voxels · ${TOOL_LABELS[tool]} (${material})`;
  };

  const renderSliceView = (): void => {
    const s = sliceView.scale;
    const rect = canvasWrap.getBoundingClientRect();
    const minCX = Math.floor((0 - sliceView.x) / s) - 1;
    const maxCX = Math.floor((rect.width - sliceView.x) / s) + 1;
    const minCY = Math.floor((0 - sliceView.y) / s) - 1;
    const maxCY = Math.floor((rect.height - sliceView.y) / s) + 1;
    const model = currentModel();

    if (ghost) {
      ctx.globalAlpha = 0.35;
      for (const [key, mat] of Object.entries(model)) {
        const [x, y, vz] = parseVoxelKey(key);
        if (vz !== z - 1 || x < minCX || x > maxCX || y < minCY || y > maxCY) continue;
        ctx.fillStyle = HEX[RAMPS[mat][2]] ?? '#333';
        ctx.fillRect(sliceView.x + x * s, sliceView.y + y * s, s, s);
      }
      ctx.globalAlpha = 1;
    }

    for (const [key, mat] of Object.entries(model)) {
      const [x, y, vz] = parseVoxelKey(key);
      if (vz !== z || x < minCX || x > maxCX || y < minCY || y > maxCY) continue;
      ctx.fillStyle = HEX[RAMPS[mat][0]] ?? '#fff';
      ctx.fillRect(sliceView.x + x * s, sliceView.y + y * s, s, s);
    }

    if (s >= 8) {
      ctx.strokeStyle = 'rgba(122,139,163,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = minCX; x <= maxCX + 1; x++) {
        ctx.moveTo(sliceView.x + x * s, sliceView.y + minCY * s);
        ctx.lineTo(sliceView.x + x * s, sliceView.y + (maxCY + 1) * s);
      }
      for (let y = minCY; y <= maxCY + 1; y++) {
        ctx.moveTo(sliceView.x + minCX * s, sliceView.y + y * s);
        ctx.lineTo(sliceView.x + (maxCX + 1) * s, sliceView.y + y * s);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(89,242,194,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sliceView.x, sliceView.y + minCY * s);
    ctx.lineTo(sliceView.x, sliceView.y + (maxCY + 1) * s);
    ctx.moveTo(sliceView.x + minCX * s, sliceView.y);
    ctx.lineTo(sliceView.x + (maxCX + 1) * s, sliceView.y);
    ctx.stroke();

    if (mirror) {
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sliceView.x, sliceView.y + minCY * s);
      ctx.lineTo(sliceView.x, sliceView.y + (maxCY + 1) * s);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const count = Object.keys(model).length;
    hud.textContent = `z=${z} · ${anim} ${frameIndex + 1}/${project.animations[anim]?.frames ?? 0} · ${count} voxels · ${TOOL_LABELS[tool]} (${material})`;
  };

  const render = (): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (viewMode === 'model') renderModelView();
    else renderSliceView();
  };

  // ---------------- edicao ----------------
  const inRange = (x: number, y: number, vz: number): boolean =>
    Math.abs(x) <= RANGE && Math.abs(y) <= RANGE && Math.abs(vz) <= RANGE;

  const placeAt = (m: VoxelModel, x: number, y: number, vz: number, erase: boolean): void => {
    if (!inRange(x, y, vz)) return;
    const targets = mirror ? [[x, y] as const, [-1 - x, y] as const] : [[x, y] as const];
    for (const [tx, ty] of targets) {
      if (erase) delete m[voxelKey(tx, ty, vz)];
      else m[voxelKey(tx, ty, vz)] = material;
    }
  };

  const applyBrushSlice = (m: VoxelModel, cx: number, cy: number, erase: boolean): void => {
    const half = Math.floor((brushSize - 1) / 2);
    for (let oy = 0; oy < brushSize; oy++) {
      for (let ox = 0; ox < brushSize; ox++) {
        placeAt(m, cx - half + ox, cy - half + oy, z, erase);
      }
    }
  };

  /** Limites (x/y) do conteudo da camada `vz`, ou null se vazia. */
  const layerBounds = (
    m: VoxelModel,
    vz: number,
  ): { minX: number; maxX: number; minY: number; maxY: number } | null => {
    let out: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    for (const key of Object.keys(m)) {
      const [x, y, kz] = parseVoxelKey(key);
      if (kz !== vz) continue;
      if (!out) out = { minX: x, maxX: x, minY: y, maxY: y };
      else {
        out.minX = Math.min(out.minX, x);
        out.maxX = Math.max(out.maxX, x);
        out.minY = Math.min(out.minY, y);
        out.maxY = Math.max(out.maxY, y);
      }
    }
    return out;
  };

  /**
   * Balde da fatia. Sobre o VAZIO ele e limitado pela caixa do conteudo da
   * camada (+1 de folga): sem essa cerca, um toque fora do desenho inundava a
   * grade inteira de ±RANGE e o "preencher uma area" virava um borrao gigante.
   */
  const fillSlice = (m: VoxelModel, cx: number, cy: number): boolean => {
    const at = (x: number, y: number): string | undefined => m[voxelKey(x, y, z)];
    const target = at(cx, cy);
    if (target === material) return false;
    let lo = -RANGE,
      hi = RANGE,
      loY = -RANGE,
      hiY = RANGE;
    if (target === undefined) {
      const b = layerBounds(m, z);
      if (!b) {
        toast('Camada vazia — use a Caixa (⬛) para criar a base');
        return false;
      }
      lo = b.minX - 1;
      hi = b.maxX + 1;
      loY = b.minY - 1;
      hiY = b.maxY + 1;
      if (cx < lo || cx > hi || cy < loY || cy > hiY) {
        toast('Toque dentro (ou na borda) do desenho da camada para preencher');
        return false;
      }
    }
    const stack = [[cx, cy]];
    const seen = new Set<string>();
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < lo || x > hi || y < loY || y > hiY) continue;
      const k = `${x},${y}`;
      if (seen.has(k) || at(x, y) !== target) continue;
      seen.add(k);
      m[voxelKey(x, y, z)] = material;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return true;
  };

  /**
   * Edicao na vista 3D. O hit-test e feito contra a SUPERFICIE DO INICIO DO
   * TRACO (strokeBaseView), nunca contra o modelo em edicao: com o alvo
   * movel, cada peca colocada virava a nova superficie sob o dedo e o arrasto
   * empilhava torres crescendo em direcao ao toque. Contra a superficie fixa,
   * um arrasto pinta UMA demao de pecas sobre o que existia — previsivel como
   * pintar uma parede — e `strokeTouched` impede a mesma celula duas vezes.
   */
  const editModelAt = (m: VoxelModel, clientX: number, clientY: number): boolean => {
    const viewData = strokeBaseView;
    if (!viewData) return false;
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor(
      (clientX - rect.left - (modelView.x - viewData.originX * modelView.scale)) / modelView.scale,
    );
    const py = Math.floor(
      (clientY - rect.top - (modelView.y - viewData.originY * modelView.scale)) / modelView.scale,
    );
    const hit = viewData.hitAt(px, py);
    if (!hit) {
      // modelo vazio: primeira peca nasce na origem, entre os pes
      if (Object.keys(m).length === 0 && tool === 'pencil' && !strokeTouched.has('origin')) {
        strokeTouched.add('origin');
        placeAt(m, 0, 0, 0, false);
        return true;
      }
      return false;
    }
    if (tool === 'pencil') {
      const [x, y, vz] = hit.add;
      const key = voxelKey(x, y, vz);
      if (strokeTouched.has(key)) return false;
      strokeTouched.add(key);
      placeAt(m, x, y, vz, false);
      return true;
    }
    if (tool === 'eraser') {
      const [x, y, vz] = hit.vox;
      const key = voxelKey(x, y, vz);
      if (strokeTouched.has(key)) return false;
      strokeTouched.add(key);
      placeAt(m, x, y, vz, true);
      return true;
    }
    if (tool === 'picker') {
      const mat = m[voxelKey(...hit.vox)];
      if (mat) {
        material = mat;
        tool = 'pencil';
        updateToolbar();
        updateMaterials();
        toast(`Material: ${mat}`);
      }
      return false;
    }
    return false;
  };

  // ---------------- gestos ----------------
  const pointers = new Map<number, { x: number; y: number }>();
  let strokeBefore: VoxelModel | null = null;
  let strokeModel: VoxelModel | null = null;
  let strokeCancelled = false;
  /** superficie congelada no inicio do traco (vista 3D) — ver editModelAt */
  let strokeBaseView: VoxelView | null = null;
  /** celulas ja tocadas neste traco (dedupe da demao) */
  const strokeTouched = new Set<string>();
  /** canto inicial do arrasto da Caixa (fatia) */
  let strokeStart: { x: number; y: number } | null = null;
  let pinchDist = 0;
  let pinchScale = 0;

  const sliceCellAt = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - sliceView.x) / sliceView.scale),
      y: Math.floor((clientY - rect.top - sliceView.y) / sliceView.scale),
    };
  };

  const applyStrokePoint = (clientX: number, clientY: number): void => {
    if (!strokeModel || !strokeBefore) return;
    let changed = false;
    if (viewMode === 'model') {
      changed = editModelAt(strokeModel, clientX, clientY);
    } else {
      const cell = sliceCellAt(clientX, clientY);
      if (tool === 'pencil') {
        applyBrushSlice(strokeModel, cell.x, cell.y, false);
        changed = true;
      } else if (tool === 'eraser') {
        applyBrushSlice(strokeModel, cell.x, cell.y, true);
        changed = true;
      } else if (tool === 'box' && strokeStart) {
        // arrasto = retangulo PREENCHIDO entre o canto inicial e o dedo,
        // recomputado do zero a cada movimento (preview ao vivo)
        strokeModel = structuredClone(strokeBefore);
        const minX = Math.min(strokeStart.x, cell.x);
        const maxX = Math.max(strokeStart.x, cell.x);
        const minY = Math.min(strokeStart.y, cell.y);
        const maxY = Math.max(strokeStart.y, cell.y);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) placeAt(strokeModel, x, y, z, false);
        }
        changed = true;
      } else if (tool === 'fill') {
        changed = fillSlice(strokeModel, cell.x, cell.y);
      } else if (tool === 'picker') {
        const mat = strokeModel[voxelKey(cell.x, cell.y, z)];
        if (mat) {
          material = mat;
          tool = 'pencil';
          updateToolbar();
          updateMaterials();
          toast(`Material: ${mat}`);
        }
      }
    }
    if (changed) {
      setCurrentModel(strokeModel);
      invalidateView();
      render();
    }
  };

  const beginStroke = (clientX: number, clientY: number): void => {
    if (playing) return;
    if (viewMode === 'model' && (tool === 'fill' || tool === 'box')) {
      toast(`${TOOL_LABELS[tool]} funciona na vista Fatia`);
      return;
    }
    strokeBefore = structuredClone(currentModel());
    strokeModel = structuredClone(strokeBefore);
    strokeCancelled = false;
    strokeTouched.clear();
    strokeBaseView =
      viewMode === 'model'
        ? renderVoxelView(strokeBefore, (VOXEL_DIRS as readonly string[]).indexOf(dir))
        : null;
    strokeStart = viewMode === 'slice' && tool === 'box' ? sliceCellAt(clientX, clientY) : null;
    applyStrokePoint(clientX, clientY);
  };

  const commitStroke = (): void => {
    const before = strokeBefore;
    const after = strokeModel ? structuredClone(strokeModel) : null;
    const cancelled = strokeCancelled;
    strokeBefore = null;
    strokeModel = null;
    strokeBaseView = null;
    strokeStart = null;
    if (!before || !after || cancelled) return;
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
      invalidateView();
      render();
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) beginStroke(e.clientX, e.clientY);
    else if (pointers.size === 2) {
      cancelStroke();
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = view().scale;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      if (!strokeCancelled && strokeModel) applyStrokePoint(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = canvas.getBoundingClientRect();
      const v = view();
      const worldX = (cx - rect.left - v.x) / v.scale;
      const worldY = (cy - rect.top - v.y) / v.scale;
      const maxScale = viewMode === 'model' ? 32 : 48;
      const minScale = viewMode === 'model' ? 1 : 4;
      if (pinchDist > 0)
        v.scale = Math.min(maxScale, Math.max(minScale, (pinchScale * dist) / pinchDist));
      v.x = cx - rect.left - worldX * v.scale;
      v.y = cy - rect.top - worldY * v.scale;
      render();
    }
  });

  const endPointer = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) commitStroke();
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      cancelStroke();
      strokeBefore = null;
      strokeModel = null;
      strokeBaseView = null;
      strokeStart = null;
    }
  });

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const v = view();
      const worldX = (e.clientX - rect.left - v.x) / v.scale;
      const worldY = (e.clientY - rect.top - v.y) / v.scale;
      const maxScale = viewMode === 'model' ? 32 : 48;
      const minScale = viewMode === 'model' ? 1 : 4;
      v.scale = Math.min(maxScale, Math.max(minScale, v.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      v.x = e.clientX - rect.left - worldX * v.scale;
      v.y = e.clientY - rect.top - worldY * v.scale;
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
    invalidateView();
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
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
      // caixa e balde sao ferramentas de fatia: escolher uma ja leva pra la
      if ((t === 'box' || t === 'fill') && viewMode !== 'slice') setViewMode('slice');
      updateToolbar();
    });
    toolButtons.set(t, btn);
    toolsRow.append(btn);
  }
  const brushBtn = el('button', { class: 'toolbtn', text: '1', title: 'Pincel (fatia)' });
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
  const ghostBtn = el('button', { class: 'toolbtn', text: '👻', title: 'Camada de baixo (fatia)' });
  ghostBtn.addEventListener('click', () => {
    ghost = !ghost;
    ghostBtn.classList.toggle('active', ghost);
    render();
  });
  const zDown = el('button', { class: 'toolbtn', text: 'z−', title: 'Camada abaixo' });
  const zUp = el('button', { class: 'toolbtn', text: 'z+', title: 'Camada acima' });
  const zLabel = el('span', { class: 'budget', text: 'z=0' });
  const gotoSlice = (delta: number): void => {
    z = Math.max(-RANGE, Math.min(RANGE, z + delta));
    zLabel.textContent = `z=${z}`;
    if (viewMode !== 'slice') setViewMode('slice');
    else render();
  };
  zDown.addEventListener('click', () => gotoSlice(-1));
  zUp.addEventListener('click', () => gotoSlice(1));
  // Duplicar a camada atual para cima e subir junto: e assim que um volume
  // cresce rapido — desenha a planta uma vez (Caixa) e sobe batendo ⏫.
  const dupBtn = el('button', { class: 'toolbtn', text: '⏫', title: 'Duplicar camada para cima' });
  dupBtn.addEventListener('click', () => {
    const m = currentModel();
    const entries = Object.entries(m).filter(([key]) => parseVoxelKey(key)[2] === z);
    if (entries.length === 0) {
      toast(`Camada z=${z} vazia — nada para duplicar`);
      return;
    }
    if (z + 1 > RANGE) return;
    const after = structuredClone(m);
    for (const [key, mat] of entries) {
      const [x, y] = parseVoxelKey(key);
      after[voxelKey(x, y, z + 1)] = mat;
    }
    pushModelEdit(structuredClone(m), after);
    gotoSlice(1);
  });
  toolsRow.append(brushBtn, mirrorBtn, ghostBtn, zDown, zLabel, zUp, dupBtn);

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
    invalidateView();
    updateFrameStrip();
    render();
  });

  const updateFrameStrip = (): void => {
    frameStripWrap.innerHTML = '';
    const def = project.animations[anim];
    if (!def) return;
    for (let f = 0; f < def.frames; f++) {
      const thumb = el('button', { class: `frame-thumb${f === frameIndex ? ' active' : ''}` });
      const c = el('canvas');
      const g = bakeFrame(project, dir, anim, f);
      c.width = g.w;
      c.height = g.h;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
      thumb.append(c, el('span', { class: 'n', text: String(f + 1) }));
      thumb.addEventListener('click', () => {
        frameIndex = f;
        stopPlayback();
        invalidateView();
        updateFrameStrip();
        render();
      });
      frameStripWrap.append(thumb);
    }
  };

  const pushModelEdit = (before: VoxelModel, after: VoxelModel): void => {
    undoStack.push({ mKey: currentModelKey(), before, after });
    if (undoStack.length > 64) undoStack.shift();
    redoStack.length = 0;
    setCurrentModel(structuredClone(after));
    invalidateView();
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
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
          invalidateView();
          updateFrameStrip();
          render();
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
        invalidateView();
        updateUndoRedo();
        updateAnimSelect();
        updateFrameStrip();
        scheduleSave();
        render();
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
    [topbar, viewRow, canvasWrap, bottom],
  );
  root.append(el('div', { class: 'editor' }, [mainCol]));

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvasWrap);

  updateToolbar();
  updateMaterials();
  updateViewRow();
  updateAnimSelect();
  updateFrameStrip();
  updateUndoRedo();
  requestAnimationFrame(() => {
    resizeCanvas();
    fitView();
  });
};
