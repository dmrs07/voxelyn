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
  removeBox,
  removeZRange,
  renderVoxelView,
  settleToGround,
  shiftModel,
  voxelKey,
  voxelModelBounds,
  voxelProjectedBounds,
  voxelToViewPixel,
  type VoxelModel,
  type VoxelView,
} from '../voxel';
import { saveProject } from '../store';
import { STYLE_LABELS, generateAnimation, styleForAnim, type AnimStyle } from '../animate';
import { applyAnimationSpec, chainOf, segmentParts, validatePosedFrames, type Part } from '../pose';
import { buildVisionImages, partsPreviewDataUrl } from '../vision';
import {
  RIG_TEMPLATES,
  guessMarkers,
  missingSlots,
  resolveMarkers,
  rigToParts,
  templateById,
} from '../rig';
import { AI_MODELS, designPoses, getApiKey, getModel, setApiKey, setModel } from '../ai';
import { el, openSheet, toast } from './components';
import { openExportSheet } from './sheets';

type Tool = 'pencil' | 'eraser' | 'fill' | 'box' | 'select' | 'picker';
type ViewMode = 'model' | 'slice';

const TOOL_ICONS: Record<Tool, string> = {
  pencil: '🧱',
  eraser: '🧽',
  box: '⬛',
  fill: '🪣',
  select: '⬚',
  picker: '💉',
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Colocar voxel',
  eraser: 'Remover voxel',
  box: 'Caixa (arraste na fatia)',
  fill: 'Balde da fatia',
  select: 'Selecionar area (arraste na fatia)',
  picker: 'Conta-gotas',
};

/** Retangulo selecionado na fatia (em celulas x/y, inclusivo). */
type Selection = { minX: number; maxX: number; minY: number; maxY: number };

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
  /** area marcada com a ferramenta ⬚, viva ate o autor agir ou limpar */
  let selection: Selection | null = null;

  const undoStack: HistEntry[] = [];
  const redoStack: HistEntry[] = [];

  const currentModelKey = (): string => modelKey(anim, frameIndex);
  const currentModel = (): VoxelModel => project.models![currentModelKey()] ?? {};
  /**
   * Partes do modelo. O esqueleto marcado a mao GANHA da deteccao automatica —
   * mas so quando esta completo, senao um rig pela metade seria pior que o
   * palpite geometrico.
   */
  const partsOf = (model: VoxelModel): Part[] => {
    if (project.rig && missingSlots(project.rig).length === 0) {
      const manual = rigToParts(model, project.rig);
      if (manual.length > 0) return manual;
    }
    return segmentParts(model, project.partOverrides);
  };
  const usingManualRig = (): boolean => !!project.rig && missingSlots(project.rig).length === 0;

  // ---------------- marcacao de juntas ----------------
  /** junta armada: o proximo toque no canvas crava ela (ver beginStroke) */
  let armedSlot: string | null = null;
  let onMarkerPlaced: (() => void) | null = null;

  /** Voxel sob o dedo, nas duas vistas — e assim que uma junta e cravada. */
  const pickVoxelAt = (clientX: number, clientY: number): [number, number, number] | null => {
    if (viewMode === 'slice') {
      const cell = sliceCellAt(clientX, clientY);
      return [cell.x, cell.y, z];
    }
    const vd = modelViewData();
    const rect = canvas.getBoundingClientRect();
    const px = Math.floor(
      (clientX - rect.left - (modelView.x - vd.originX * modelView.scale)) / modelView.scale,
    );
    const py = Math.floor(
      (clientY - rect.top - (modelView.y - vd.originY * modelView.scale)) / modelView.scale,
    );
    const hit = vd.hitAt(px, py);
    return hit ? (hit.vox as [number, number, number]) : null;
  };
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

    if (selection) {
      const x0 = sliceView.x + selection.minX * s;
      const y0 = sliceView.y + selection.minY * s;
      const w = (selection.maxX - selection.minX + 1) * s;
      const h = (selection.maxY - selection.minY + 1) * s;
      ctx.fillStyle = 'rgba(255,209,102,0.15)';
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(255,209,102,0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x0, y0, w, h);
      ctx.setLineDash([]);
    }

    const count = Object.keys(model).length;
    hud.textContent = `z=${z} · ${anim} ${frameIndex + 1}/${project.animations[anim]?.frames ?? 0} · ${count} voxels · ${TOOL_LABELS[tool]} (${material})`;
  };

  /**
   * Marcadores de junta desenhados por cima das duas vistas. Sem ver onde as
   * juntas estao, cravar as proximas vira adivinhacao — e o rig inteiro depende
   * de elas caírem no lugar certo.
   */
  const drawMarkers = (): void => {
    if (!project.rig) return;
    const tpl = templateById(project.rig.template);
    if (!tpl) return;
    const markers = resolveMarkers(project.rig);
    const own = project.rig.markers;
    const vd = viewMode === 'model' ? modelViewData() : null;
    const dirIdx = (VOXEL_DIRS as readonly string[]).indexOf(dir);

    for (const slot of tpl.slots) {
      const pos = markers[slot.id];
      if (!pos) continue;
      let sx: number,
        sy: number,
        faded = false;
      if (viewMode === 'model') {
        const p = voxelToViewPixel(vd!, pos[0], pos[1], pos[2], dirIdx);
        sx = modelView.x + (p.px - vd!.originX) * modelView.scale;
        sy = modelView.y + (p.py - vd!.originY) * modelView.scale;
      } else {
        faded = pos[2] !== z; // junta de outra camada aparece apagada
        sx = sliceView.x + (pos[0] + 0.5) * sliceView.scale;
        sy = sliceView.y + (pos[1] + 0.5) * sliceView.scale;
      }
      const armed = armedSlot === slot.id;
      const mirrored = !own[slot.id]; // veio da simetria, nao do dedo do autor
      ctx.globalAlpha = faded ? 0.3 : 1;
      ctx.beginPath();
      ctx.arc(sx, sy, armed ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = mirrored ? 'rgba(122,184,255,0.55)' : 'rgba(255,209,102,0.85)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = armed ? '#59f2c2' : '#0b0e14';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  const render = (): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (viewMode === 'model') renderModelView();
    else renderSliceView();
    if (armedSlot || project.rig) drawMarkers();
    if (armedSlot) {
      const tpl = templateById(project.rig!.template);
      const label = tpl?.slots.find((sl) => sl.id === armedSlot)?.label ?? armedSlot;
      hud.textContent = `Toque para cravar: ${label}`;
    }
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
  /** o traco chegou a mudar o modelo? (selecionar e conta-gotas nao mudam) */
  let strokeDirty = false;
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
      } else if (tool === 'select' && strokeStart) {
        // selecionar nao edita: so marca a area e espera a acao do autor
        selection = {
          minX: Math.min(strokeStart.x, cell.x),
          maxX: Math.max(strokeStart.x, cell.x),
          minY: Math.min(strokeStart.y, cell.y),
          maxY: Math.max(strokeStart.y, cell.y),
        };
        updateSelectionRow();
        render();
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
      strokeDirty = true;
      setCurrentModel(strokeModel);
      invalidateView();
      render();
    }
  };

  const beginStroke = (clientX: number, clientY: number): void => {
    if (playing) return;
    if (armedSlot) {
      const pos = pickVoxelAt(clientX, clientY);
      if (!pos) {
        toast('Toque em cima do modelo para cravar a junta');
        return;
      }
      project.rig!.markers[armedSlot] = pos;
      armedSlot = null;
      scheduleSave();
      render();
      const back = onMarkerPlaced;
      onMarkerPlaced = null;
      back?.();
      return;
    }
    if (viewMode === 'model' && (tool === 'fill' || tool === 'box' || tool === 'select')) {
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
    strokeStart =
      viewMode === 'slice' && (tool === 'box' || tool === 'select')
        ? sliceCellAt(clientX, clientY)
        : null;
    strokeDirty = false;
    applyStrokePoint(clientX, clientY);
  };

  const commitStroke = (): void => {
    const before = strokeBefore;
    const after = strokeModel ? structuredClone(strokeModel) : null;
    const cancelled = strokeCancelled;
    const dirty = strokeDirty;
    strokeBefore = null;
    strokeModel = null;
    strokeBaseView = null;
    strokeStart = null;
    strokeDirty = false;
    // traco que nao mudou nada (selecionar, conta-gotas, toque no vazio) nao
    // vira entrada de historico: senao o undo passa a gastar toques a toa
    if (!before || !after || cancelled || !dirty) return;
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
      if ((t === 'box' || t === 'fill' || t === 'select') && viewMode !== 'slice')
        setViewMode('slice');
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
  // Apagar a camada inteira: um STL importado chega com laje de base e muitas
  // camadas de sobra, e limpar isso voxel a voxel no celular nao acontece.
  const delLayerBtn = el('button', { class: 'toolbtn', text: '🗑z', title: 'Apagar camada z' });
  delLayerBtn.addEventListener('click', () => {
    const m = currentModel();
    const n = Object.keys(m).filter((key) => parseVoxelKey(key)[2] === z).length;
    if (n === 0) {
      toast(`Camada z=${z} ja esta vazia`);
      return;
    }
    pushModelEdit(structuredClone(m), removeZRange(m, z, z));
    toast(`Camada z=${z} apagada (${n} voxels) — ↩ desfaz`);
  });
  toolsRow.append(brushBtn, mirrorBtn, ghostBtn, zDown, zLabel, zUp, dupBtn, delLayerBtn);

  // ---------------- acoes da selecao ----------------
  // So aparece quando ha area marcada: ocupa espaco de tela apenas enquanto
  // serve para alguma coisa.
  const selectionRow = el('div', { class: 'row', style: 'display:none' });
  const selInfo = el('span', { class: 'budget' });
  const selDelLayer = el('button', { class: 'toolbtn', text: '🗑z', title: 'Apagar nesta camada' });
  const selDelAll = el('button', {
    class: 'toolbtn',
    text: '🗑⇕',
    title: 'Apagar em TODAS as camadas',
  });
  const selFill = el('button', { class: 'toolbtn', text: '🧱', title: 'Preencher esta camada' });
  const selClear = el('button', { class: 'toolbtn', text: '✕', title: 'Limpar selecao' });
  selectionRow.append(selInfo, selDelLayer, selDelAll, selFill, selClear);

  const updateSelectionRow = (): void => {
    selectionRow.style.display = selection ? '' : 'none';
    if (!selection) return;
    const w = selection.maxX - selection.minX + 1;
    const h = selection.maxY - selection.minY + 1;
    selInfo.textContent = `${w}×${h}`;
  };

  selDelLayer.addEventListener('click', () => {
    if (!selection) return;
    const m = currentModel();
    const after = removeBox(m, selection, z, z);
    const n = Object.keys(m).length - Object.keys(after).length;
    if (n === 0) {
      toast('Nada a apagar nessa area, nesta camada');
      return;
    }
    pushModelEdit(structuredClone(m), after);
    toast(`${n} voxels apagados em z=${z} — ↩ desfaz`);
  });

  selDelAll.addEventListener('click', () => {
    if (!selection) return;
    const m = currentModel();
    const after = removeBox(m, selection);
    const n = Object.keys(m).length - Object.keys(after).length;
    if (n === 0) {
      toast('Nada a apagar nessa area');
      return;
    }
    pushModelEdit(structuredClone(m), after);
    toast(`${n} voxels apagados em todas as camadas — ↩ desfaz`);
  });

  selFill.addEventListener('click', () => {
    if (!selection) return;
    const m = currentModel();
    const after = structuredClone(m);
    for (let y = selection.minY; y <= selection.maxY; y++) {
      for (let x = selection.minX; x <= selection.maxX; x++) placeAt(after, x, y, z, false);
    }
    pushModelEdit(structuredClone(m), after);
    toast(`Area preenchida com ${material} em z=${z}`);
  });

  selClear.addEventListener('click', () => {
    selection = null;
    updateSelectionRow();
    render();
  });

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
      const animateBtn = el('button', { text: '🎬 Animar automaticamente' });
      const partsBtn = el('button', { text: '🧩 Partes do modelo' });
      const layersBtn = el('button', { text: '✂ Camadas (cortar base do STL)' });
      const rigBtn = el('button', { text: '🦴 Esqueleto (rig manual)' });
      const moveBtn = el('button', { text: '✥ Mover modelo (frame atual)' });
      const mirrorAllBtn = el('button', { text: '⇋ Espelhar modelo inteiro em X' });
      const settings = el('button', { text: '⚙ Configuracoes do sprite' });
      const boundsBtn = el('button', { text: '📐 Conferir se cabe no frame' });
      exportBtn.addEventListener('click', () => {
        close();
        void openExportSheet(project, scheduleSave);
      });
      animateBtn.addEventListener('click', () => {
        close();
        void openAnimateSheet();
      });
      partsBtn.addEventListener('click', () => {
        close();
        void openPartsSheet();
      });
      layersBtn.addEventListener('click', () => {
        close();
        void openLayersSheet();
      });
      rigBtn.addEventListener('click', () => {
        close();
        void openRigSheet();
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
          animateBtn,
          partsBtn,
          rigBtn,
          layersBtn,
          moveBtn,
          mirrorAllBtn,
          boundsBtn,
          settings,
        ]),
      ]);
    });
  });

  const openAnimateSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const animSel = el('select');
      animSel.append(el('option', { value: '*', text: 'TODAS as animacoes' }));
      for (const a of orderedAnims(project.animations)) {
        animSel.append(el('option', { value: a, text: `${a} (${project.animations[a].frames}f)` }));
      }
      animSel.value = anim;
      const styleSel = el('select');
      styleSel.append(el('option', { value: 'auto', text: 'Preset automatico pelo nome' }));
      for (const [style, label] of Object.entries(STYLE_LABELS)) {
        styleSel.append(el('option', { value: style, text: label }));
      }
      const intensitySel = el('select');
      for (const [v, label] of [
        ['1', 'Sutil'],
        ['2', 'Normal'],
        ['3', 'Forte'],
      ]) {
        intensitySel.append(el('option', { value: v, text: label }));
      }
      intensitySel.value = '2';

      const generate = el('button', { class: 'primary', text: 'Gerar frames' });
      generate.addEventListener('click', () => {
        // pose base: o frame ATUAL em edicao — o autor decide de onde parte
        const base = structuredClone(currentModel());
        if (Object.keys(base).length === 0) {
          toast('O frame atual esta vazio — monte a pose base antes de animar');
          return;
        }
        const intensity = Number(intensitySel.value);
        const targets = animSel.value === '*' ? orderedAnims(project.animations) : [animSel.value];
        let touched = 0;
        for (const a of targets) {
          const style: AnimStyle =
            styleSel.value === 'auto' ? styleForAnim(a) : (styleSel.value as AnimStyle);
          const frames = generateAnimation(base, style, project.animations[a].frames, intensity);
          frames.forEach((m, f) => {
            const mKey = modelKey(a, f);
            const before = structuredClone(project.models![mKey] ?? {});
            project.models![mKey] = m;
            undoStack.push({ mKey, before, after: structuredClone(m) });
            touched++;
          });
        }
        while (undoStack.length > 64) undoStack.shift();
        redoStack.length = 0;
        invalidateView();
        scheduleSave();
        updateUndoRedo();
        updateFrameStrip();
        render();
        toast(`${touched} frame(s) gerados a partir da pose atual — de o play para conferir`);
        close();
      });

      // ---------- secao IA: Claude projeta as poses por parte ----------
      const aiAnimSel = el('select');
      for (const a of orderedAnims(project.animations)) {
        aiAnimSel.append(
          el('option', { value: a, text: `${a} (${project.animations[a].frames}f)` }),
        );
      }
      aiAnimSel.value = anim;
      const descInput = el('textarea', {
        rows: '3',
        placeholder:
          'ex.: aranha de cristal; na caminhada as 8 pernas alternam em dois grupos e o abdomen balanca; no ataque ela empina e crava as pernas da frente',
      }) as HTMLTextAreaElement;

      const modelSel = el('select');
      for (const m of AI_MODELS) modelSel.append(el('option', { value: m.id, text: m.label }));
      modelSel.value = getModel();
      modelSel.addEventListener('change', () => setModel(modelSel.value));

      const keyRow = el('div', { style: 'display:flex;gap:6px' });
      const keyInput = el('input', {
        type: 'password',
        placeholder: getApiKey() ? 'chave configurada ✓ (cole outra para trocar)' : 'sk-ant-…',
        autocapitalize: 'none',
      });
      const keySave = el('button', { text: 'Salvar', style: 'flex:none' });
      keySave.addEventListener('click', () => {
        setApiKey(keyInput.value.trim());
        keyInput.value = '';
        keyInput.placeholder = getApiKey() ? 'chave configurada ✓' : 'sk-ant-…';
        toast(getApiKey() ? 'Chave salva neste aparelho' : 'Chave removida');
      });
      keyRow.append(keyInput, keySave);

      const aiGenerate = el('button', { class: 'primary', text: '✨ Projetar poses com IA' });
      aiGenerate.addEventListener('click', () => {
        const base = structuredClone(currentModel());
        if (Object.keys(base).length === 0) {
          toast('O frame atual esta vazio — monte a pose base antes de animar');
          return;
        }
        const parts = partsOf(base);
        const a = aiAnimSel.value;
        const def = project.animations[a];
        aiGenerate.disabled = true;
        aiGenerate.textContent = '✨ Projetando… (alguns segundos)';
        void (async () => {
          try {
            const spec = await designPoses({
              model: base,
              parts,
              animation: a,
              frames: def.frames,
              fps: def.fps,
              loop: def.loop,
              description: descInput.value.trim(),
              // a IA VE a pose neutra e o mapa de partes colorido: sem isso ela
              // so tem numeros e chuta para que lado cada membro aponta
              images: buildVisionImages(base, parts),
            });
            const frames = applyAnimationSpec(base, parts, spec, def.frames);
            frames.forEach((m, f) => {
              const mKey = modelKey(a, f);
              const before = structuredClone(project.models![mKey] ?? {});
              project.models![mKey] = m;
              undoStack.push({ mKey, before, after: structuredClone(m) });
            });
            while (undoStack.length > 64) undoStack.shift();
            redoStack.length = 0;
            invalidateView();
            scheduleSave();
            updateUndoRedo();
            updateFrameStrip();
            render();
            // integridade: se algum frame perdeu materia ou soltou peca, o
            // autor fica sabendo NA HORA em vez de descobrir no play
            const issues = validatePosedFrames(base, frames);
            toast(
              issues.length === 0
                ? `Poses de "${a}" projetadas pela IA — de o play; ajuste a descricao e regenere se quiser`
                : `Poses de "${a}" projetadas, mas ${issues.length} frame(s) sairam suspeitos: ${issues
                    .slice(0, 2)
                    .map((i) => `f${i.frame + 1} ${i.message}`)
                    .join('; ')}. Confira em Partes se a segmentacao esta certa.`,
            );
            close();
          } catch (err) {
            toast((err as Error).message);
            aiGenerate.disabled = false;
            aiGenerate.textContent = '✨ Projetar poses com IA';
          }
        })();
      });

      const partsInfo = (() => {
        const base = currentModel();
        if (Object.keys(base).length === 0) return 'Frame atual vazio';
        const parts = partsOf(base);
        const legs = parts.filter((p) => p.kind === 'perna').length;
        const limbs = parts.filter((p) => p.kind === 'membro').length;
        const bits = [
          legs > 0 ? `${legs} perna(s)` : '',
          limbs > 0 ? `${limbs} membro(s)` : '',
          'corpo',
        ].filter(Boolean);
        const fonte = usingManualRig() ? 'Esqueleto marcado a mao' : 'Partes detectadas';
        return `${fonte}: ${bits.join(' + ')}`;
      })();

      const partsBtn = el('button', { text: '🧩 Conferir partes detectadas' });
      partsBtn.addEventListener('click', () => {
        close();
        void openPartsSheet();
      });

      container.append(
        el('h2', { text: 'Animar' }),
        el('p', {
          class: 'sub',
          text: `A partir do FRAME ATUAL como pose base. ${partsInfo}. Cada frame gerado pode ser refinado a mao (undo desfaz frame a frame).`,
        }),
        el('div', {
          class: 'issue ok',
          style: 'font-weight:600',
          text: '✨ IA projeta as poses (por partes)',
        }),
        partsBtn,
        el('div', {}, [el('label', { text: 'Animacao' }), aiAnimSel]),
        el('div', {}, [el('label', { text: 'Descreva o personagem e o movimento' }), descInput]),
        el('div', {}, [el('label', { text: 'Modelo' }), modelSel]),
        el('div', {}, [
          el('label', { text: 'Chave da API Anthropic (fica so neste aparelho)' }),
          keyRow,
        ]),
        aiGenerate,
        el('div', {
          class: 'issue',
          style: 'margin-top:8px',
          text: '⚡ Rapido, sem IA (presets deterministicos)',
        }),
        el('div', {}, [el('label', { text: 'Animacao' }), animSel]),
        el('div', {}, [el('label', { text: 'Preset de movimento' }), styleSel]),
        el('div', {}, [el('label', { text: 'Intensidade' }), intensitySel]),
        generate,
      );
      return container;
    });

  /**
   * Folha de ESQUELETO: o autor crava cada junta tocando no modelo, como nas
   * ferramentas de rig manual. Existe porque a deteccao automatica so enxerga
   * geometria — membro grudado no corpo por uma area larga, ou dois membros
   * encostados, nao tem heuristica que resolva. Aqui quem decide desenhou.
   */
  const openRigSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      project.rig ??= { template: 'quadrupede', markers: {}, symmetry: true };
      const rig = project.rig;

      const tplSel = el('select');
      for (const t of RIG_TEMPLATES) tplSel.append(el('option', { value: t.id, text: t.label }));
      tplSel.value = rig.template;
      tplSel.addEventListener('change', () => {
        rig.template = tplSel.value;
        rig.markers = {}; // juntas de um template nao valem no outro
        scheduleSave();
        close();
        void openRigSheet();
      });

      const symWrap = el('label', { style: 'display:flex;gap:8px;align-items:center' });
      const sym = el('input', { type: 'checkbox' });
      sym.checked = rig.symmetry;
      sym.addEventListener('change', () => {
        rig.symmetry = sym.checked;
        scheduleSave();
        close();
        void openRigSheet();
      });
      symWrap.append(sym, el('span', { text: 'Simetria: marcar um lado espelha no outro' }));

      const tpl = templateById(rig.template)!;
      const markers = resolveMarkers(rig);
      const rows = el('div', { style: 'display:flex;flex-direction:column;gap:2px' });
      for (const slot of tpl.slots) {
        // com simetria ligada, o lado B some da lista: ele sai do A sozinho
        if (rig.symmetry && slot.mirror && slot.id.endsWith('-B')) continue;
        const pos = markers[slot.id];
        const btn = el('button', {
          style: 'display:flex;justify-content:space-between;gap:8px;text-align:left',
          text: `${pos ? '✓' : '○'} ${slot.label}`,
        });
        btn.append(
          el('span', {
            class: 'budget',
            text: pos ? `${pos[0]},${pos[1]},${pos[2]}` : 'marcar',
          }),
        );
        btn.addEventListener('click', () => {
          armedSlot = slot.id;
          onMarkerPlaced = () => {
            toast(`${slot.label} cravado`);
            void openRigSheet();
          };
          close();
          render();
          toast(`Toque no modelo para cravar: ${slot.label}`);
        });
        rows.append(btn);
      }

      const missing = missingSlots(rig);
      const status = el('div', {
        class: missing.length === 0 ? 'issue ok' : 'issue',
        text:
          missing.length === 0
            ? '✓ Esqueleto completo — ele substitui a deteccao automatica'
            : `Faltam ${missing.length} junta(s): ${missing
                .slice(0, 3)
                .map((sl) => sl.label)
                .join(', ')}${missing.length > 3 ? '…' : ''}`,
      });

      const preview = el('button', { class: 'primary', text: '👁 Ver o esqueleto colorido' });
      preview.disabled = missing.length > 0;
      preview.addEventListener('click', () => {
        close();
        void openPartsSheet();
      });

      const clear = el('button', { text: '↺ Apagar todas as juntas' });
      clear.addEventListener('click', () => {
        rig.markers = {};
        scheduleSave();
        close();
        void openRigSheet();
      });

      const auto = el('button', { text: '✨ Chutar juntas pelo rig automatico' });
      auto.addEventListener('click', () => {
        const base = currentModel();
        if (Object.keys(base).length === 0) {
          toast('O frame atual esta vazio');
          return;
        }
        const guessed = guessMarkers(base, tpl);
        rig.markers = { ...guessed, ...rig.markers };
        scheduleSave();
        close();
        toast('Juntas chutadas — confira e corrija as que sairem tortas');
        void openRigSheet();
      });

      container.append(
        el('h2', { text: 'Esqueleto (rig manual)' }),
        el('p', {
          class: 'sub',
          text: 'Toque numa junta da lista e depois no modelo para cravar. Vale na vista 3D e na Fatia; na 3D o toque pega o voxel da superficie.',
        }),
        el('div', {}, [el('label', { text: 'Tipo de bicho' }), tplSel]),
        symWrap,
        status,
        rows,
        el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' }, [
          auto,
          preview,
          clear,
        ]),
      );
      return container;
    });

  /**
   * Folha de CAMADAS: cortes grossos em z. Existe para o fluxo de STL — o
   * arquivo quase sempre chega apoiado numa laje de base que nao faz parte do
   * bicho, e depois de cortar ele fica flutuando.
   */
  const openLayersSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const m = currentModel();
      const b = voxelModelBounds(m);
      if (!b) {
        container.append(
          el('h2', { text: 'Camadas' }),
          el('p', { class: 'sub', text: 'O frame atual esta vazio.' }),
        );
        return container;
      }

      const countAt = (vz: number): number =>
        Object.keys(currentModel()).filter((key) => parseVoxelKey(key)[2] === vz).length;

      const cutInput = el('input', {
        type: 'number',
        value: String(b.minZ),
        min: String(b.minZ),
        max: String(b.maxZ),
      });
      const cutInfo = el('p', { class: 'sub' });
      const refreshInfo = (): void => {
        const top = Number(cutInput.value);
        let n = 0;
        for (const key of Object.keys(currentModel())) {
          if (parseVoxelKey(key)[2] <= top) n++;
        }
        cutInfo.textContent = `Apaga z=${b.minZ} ate z=${top} — ${n} voxels.`;
      };
      cutInput.addEventListener('input', refreshInfo);
      refreshInfo();

      const cut = el('button', { class: 'primary', text: '✂ Cortar da base ate essa camada' });
      cut.addEventListener('click', () => {
        const top = Number(cutInput.value);
        const before = currentModel();
        const after = settleToGround(removeZRange(before, b.minZ, top));
        if (Object.keys(after).length === 0) {
          toast('Isso apagaria o modelo inteiro — escolha uma camada mais baixa');
          return;
        }
        const n = Object.keys(before).length - Object.keys(after).length;
        pushModelEdit(structuredClone(before), after);
        toast(`${n} voxels cortados e o modelo assentado no chao — ↩ desfaz`);
        close();
      });

      const settle = el('button', { text: '⤓ Assentar no chao (z=0)' });
      settle.addEventListener('click', () => {
        const before = currentModel();
        const now = voxelModelBounds(before);
        if (!now || now.minZ === 0) {
          toast('O modelo ja esta apoiado no chao');
          return;
        }
        pushModelEdit(structuredClone(before), settleToGround(before));
        toast('Modelo assentado em z=0');
        close();
      });

      const delCurrent = el('button', { text: `🗑 Apagar a camada atual (z=${z})` });
      delCurrent.addEventListener('click', () => {
        const before = currentModel();
        const n = countAt(z);
        if (n === 0) {
          toast(`Camada z=${z} ja esta vazia`);
          return;
        }
        pushModelEdit(structuredClone(before), removeZRange(before, z, z));
        toast(`Camada z=${z} apagada (${n} voxels)`);
        close();
      });

      container.append(
        el('h2', { text: 'Camadas' }),
        el('p', {
          class: 'sub',
          text: `Modelo ocupa z=${b.minZ} a z=${b.maxZ}. Corte a base do STL aqui em vez de apagar voxel a voxel.`,
        }),
        el('div', {}, [el('label', { text: 'Cortar da base ATE a camada' }), cutInput]),
        cutInfo,
        cut,
        el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' }, [
          settle,
          delCurrent,
        ]),
      );
      return container;
    });

  /**
   * Folha de PARTES: mostra como o modelo foi dividido (uma cor por parte, a
   * mesma imagem que a IA recebe) e deixa o autor corrigir — renomear um
   * membro, ou dizer que ele nao e membro e sim corpo. E o unico ponto do
   * fluxo onde a decisao volta para as maos de quem desenhou.
   */
  const openPartsSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const base = currentModel();
      if (Object.keys(base).length === 0) {
        container.append(
          el('h2', { text: 'Partes' }),
          el('p', { class: 'sub', text: 'O frame atual esta vazio — monte o modelo primeiro.' }),
        );
        return container;
      }

      const overrides = { ...(project.partOverrides ?? {}) };
      const names: Record<string, string> = { ...(overrides.names ?? {}) };
      const merged = new Set(overrides.mergeToCore ?? []);
      // a lista mostrada ignora os merges para o autor poder DESFAZER um
      const all = segmentParts(base, { names });
      // so as RAIZES de membro sao renomeaveis/mesclaveis; os ossos internos
      // (canela, pe) seguem o nome da raiz e nao tem decisao propria
      const parts = all.filter((p) => p.kind === 'perna' || p.kind === 'membro');

      const img = el('img', {
        src: partsPreviewDataUrl(segmentParts(base, project.partOverrides)),
        style:
          'width:100%;image-rendering:pixelated;background:#0b0e14;border-radius:8px;margin:6px 0',
      });

      const rows = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
      const rebuild = (): void => {
        const next = {
          names: Object.keys(names).length > 0 ? names : undefined,
          mergeToCore: merged.size > 0 ? [...merged] : undefined,
        };
        project.partOverrides = next.names || next.mergeToCore ? next : undefined;
        img.src = partsPreviewDataUrl(segmentParts(base, project.partOverrides));
        scheduleSave();
      };

      for (const part of parts) {
        const nameInput = el('input', {
          type: 'text',
          value: part.name,
          style: 'flex:1',
        });
        nameInput.addEventListener('change', () => {
          const v = nameInput.value.trim();
          if (v) names[part.handle] = v;
          else delete names[part.handle];
          rebuild();
        });

        const asBody = el('input', { type: 'checkbox' });
        asBody.checked = merged.has(part.handle);
        asBody.addEventListener('change', () => {
          if (asBody.checked) merged.add(part.handle);
          else merged.delete(part.handle);
          rebuild();
        });

        rows.append(
          el('div', { style: 'border-top:1px solid #2a3244;padding-top:8px' }, [
            el('div', { style: 'display:flex;gap:6px;align-items:center' }, [nameInput]),
            el('div', {
              class: 'sub',
              text: (() => {
                const chain = chainOf(all, part.name);
                const vox = chain.reduce((n, c) => n + c.keys.length, 0);
                const bones =
                  chain.length > 1
                    ? ` · ${chain.length} ossos (${chain
                        .slice(1)
                        .map((c) => c.name.split('.').pop())
                        .join(' → ')})`
                    : ' · 1 osso (rigido)';
                return `${vox} voxels · ${part.direction ?? 'centro'}${bones}`;
              })(),
            }),
            el('label', { style: 'display:flex;gap:6px;align-items:center' }, [
              asBody,
              el('span', { text: 'e corpo (nao se mexe sozinho)' }),
            ]),
          ]),
        );
      }

      const reset = el('button', { text: '↺ Voltar a deteccao automatica' });
      reset.addEventListener('click', () => {
        for (const k of Object.keys(names)) delete names[k];
        merged.clear();
        project.partOverrides = undefined;
        scheduleSave();
        close();
        void openPartsSheet();
      });

      const done = el('button', { class: 'primary', text: 'Pronto' });
      done.addEventListener('click', () => {
        toast('Partes atualizadas — a IA vai citar esses nomes');
        close();
      });

      container.append(
        el('h2', { text: 'Partes do modelo' }),
        el('p', {
          class: 'sub',
          text: 'Cada cor e um membro do esqueleto. Membro comprido ganha junta interna (coxa → canela → pe): girar a raiz balanca o membro todo, girar a canela dobra o joelho. Se a divisao saiu errada, corrija aqui.',
        }),
        img,
        parts.length === 0
          ? el('p', {
              class: 'sub',
              text: 'Nenhum membro separado — o modelo inteiro e corpo. Membros finos demais podem sumir; engrosse-os um voxel para a deteccao pegar.',
            })
          : rows,
        el('div', { style: 'display:flex;gap:8px;margin-top:12px' }, [reset, done]),
      );
      return container;
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
    selectionRow,
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
