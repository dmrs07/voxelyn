/**
 * VoxelForge Editor - Tool System
 */

import type { ToolId, ToolSettings } from './stores';
import type { EditorDocument, GridLayer, Selection } from './document/types';
import type { SelectionOp } from './document/selection';
import type { GridPoint } from './tools';
import {
  bresenhamLine,
  createPaintDataFromPoints,
  floodFill,
  getBrushPoints,
  getEllipsePoints,
  getRectPoints,
  magicWandSelect,
} from './tools';

export type PendingPixel = { index: number; oldValue: number; newValue: number };

export type ToolRuntimeState = {
  isPanning: boolean;
  isDrawing: boolean;
  isSelecting: boolean;
  startPoint: GridPoint | null;
  currentPoint: GridPoint | null;
  lastPoint: GridPoint | null;
  pendingPixels: Map<number, PendingPixel>;
  currentMaterial: number;
  selectionPreview: Selection | null;
  selectionOp: SelectionOp;
  activePointerToolId: ToolId | null;
};

export type ToolContext = {
  doc: EditorDocument;
  layer: GridLayer | null;
  settings: ToolSettings;
  primaryMaterial: number;
  secondaryMaterial: number;
  cursorPosition: GridPoint | null;
  state: ToolRuntimeState;
  screenToGrid: (screenX: number, screenY: number) => GridPoint;
  getSelectionOp: (e: PointerEvent) => SelectionOp;
  buildRectSelection: (a: GridPoint, b: GridPoint) => Selection;
  mergeSelection: (selection: Selection, op: SelectionOp) => Selection;
  addPendingPixels: (pixels: PendingPixel[]) => void;
  commitPendingPixels: (toolId: ToolId) => void;
  setSelectionPreview: (selection: Selection | null) => void;
  commitSelection: (selection: Selection) => void;
  setPrimaryMaterial: (material: number) => void;
  setCameraByDelta: (dx: number, dy: number) => void;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
  render: () => void;
};

export type ToolDefinition = {
  id: ToolId;
  name: string;
  cursor: string;
  hotkey?: string;
  onPointerDown: (ctx: ToolContext, e: PointerEvent) => void;
  onPointerMove: (ctx: ToolContext, e: PointerEvent) => void;
  onPointerUp: (ctx: ToolContext, e: PointerEvent) => void;
  onKeyDown?: (ctx: ToolContext, e: KeyboardEvent) => void;
  renderOverlay?: (ctx: ToolContext, overlay: CanvasRenderingContext2D) => void;
};

const getLineEndWithSnap = (start: GridPoint, current: GridPoint): GridPoint => {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  if (dx === 0 || dy === 0) return current;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > absDy) {
    return { x: start.x + Math.sign(dx) * absDx, y: start.y };
  }
  if (absDy > absDx) {
    return { x: start.x, y: start.y + Math.sign(dy) * absDy };
  }

  return {
    x: start.x + Math.sign(dx) * absDx,
    y: start.y + Math.sign(dy) * absDy,
  };
};

const getConstrainedShapeEnd = (start: GridPoint, current: GridPoint): GridPoint => {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx || 1) * size,
    y: start.y + Math.sign(dy || 1) * size,
  };
};

const buildShapePoints = (
  toolId: ToolId,
  start: GridPoint,
  current: GridPoint,
  settings: ToolSettings,
  snap: boolean
): GridPoint[] => {
  let end = current;
  if (snap) {
    if (toolId === 'line') {
      end = getLineEndWithSnap(start, current);
    } else if (toolId === 'rect' || toolId === 'ellipse') {
      end = getConstrainedShapeEnd(start, current);
    }
  }

  if (toolId === 'line') {
    return bresenhamLine(start.x, start.y, end.x, end.y);
  }
  if (toolId === 'rect') {
    return getRectPoints(start.x, start.y, end.x, end.y, settings.shapeFilled);
  }
  if (toolId === 'ellipse') {
    return getEllipsePoints(start.x, start.y, end.x, end.y, settings.shapeFilled);
  }
  return [];
};

const renderBrushPreview = (ctx: ToolContext, overlay: CanvasRenderingContext2D) => {
  if (!ctx.cursorPosition) return;

  const { x, y } = ctx.cursorPosition;
  const size = ctx.settings.brushSize;
  const half = Math.floor(size / 2);

  overlay.save();
  overlay.strokeStyle = 'rgba(255,255,255,0.6)';
  overlay.lineWidth = 1 / ctx.doc.camera.zoom;

  if (ctx.settings.brushShape === 'square') {
    overlay.strokeRect(x - half, y - half, size, size);
  } else if (ctx.settings.brushShape === 'circle') {
    overlay.beginPath();
    overlay.arc(x, y, size / 2, 0, Math.PI * 2);
    overlay.stroke();
  } else {
    overlay.beginPath();
    overlay.moveTo(x, y - half);
    overlay.lineTo(x + half, y);
    overlay.lineTo(x, y + half);
    overlay.lineTo(x - half, y);
    overlay.closePath();
    overlay.stroke();
  }
  overlay.restore();
};

const ensureGridLayer = (layer: GridLayer | null): layer is GridLayer => {
  return Boolean(layer && layer.type === 'grid2d');
};

const startDrawing = (ctx: ToolContext, e: PointerEvent) => {
  ctx.state.isDrawing = true;
  ctx.setPointerCapture(e.pointerId);
};

const stopDrawing = (ctx: ToolContext, e: PointerEvent) => {
  ctx.state.isDrawing = false;
  ctx.releasePointerCapture(e.pointerId);
};

const tools: Record<ToolId, ToolDefinition> = {
  pencil: {
    id: 'pencil',
    name: 'Pencil',
    cursor: 'crosshair',
    hotkey: 'b',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.button === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      ctx.state.currentMaterial = mat;
      ctx.state.lastPoint = gridPos;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      startDrawing(ctx, e);

      const points = getBrushPoints(gridPos.x, gridPos.y, ctx.settings.brushSize, ctx.settings.brushShape);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isDrawing || !ctx.state.lastPoint || !ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.buttons === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      const linePoints = bresenhamLine(ctx.state.lastPoint.x, ctx.state.lastPoint.y, gridPos.x, gridPos.y);
      const allPoints: GridPoint[] = [];
      for (const lp of linePoints) {
        allPoints.push(...getBrushPoints(lp.x, lp.y, ctx.settings.brushSize, ctx.settings.brushShape));
      }
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, allPoints, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.state.lastPoint = gridPos;
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isDrawing) return;
      stopDrawing(ctx, e);
      ctx.commitPendingPixels('pencil');
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
      ctx.state.lastPoint = null;
    },
    renderOverlay: (ctx, overlay) => {
      renderBrushPreview(ctx, overlay);
    },
  },
  eraser: {
    id: 'eraser',
    name: 'Eraser',
    cursor: 'crosshair',
    hotkey: 'e',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.currentMaterial = 0;
      ctx.state.lastPoint = gridPos;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      startDrawing(ctx, e);

      const points = getBrushPoints(gridPos.x, gridPos.y, ctx.settings.brushSize, ctx.settings.brushShape);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, 0);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isDrawing || !ctx.state.lastPoint || !ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const linePoints = bresenhamLine(ctx.state.lastPoint.x, ctx.state.lastPoint.y, gridPos.x, gridPos.y);
      const allPoints: GridPoint[] = [];
      for (const lp of linePoints) {
        allPoints.push(...getBrushPoints(lp.x, lp.y, ctx.settings.brushSize, ctx.settings.brushShape));
      }
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, allPoints, 0);
      ctx.addPendingPixels(paintData.pixels);
      ctx.state.lastPoint = gridPos;
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isDrawing) return;
      stopDrawing(ctx, e);
      ctx.commitPendingPixels('eraser');
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
      ctx.state.lastPoint = null;
    },
    renderOverlay: (ctx, overlay) => {
      renderBrushPreview(ctx, overlay);
    },
  },
  fill: {
    id: 'fill',
    name: 'Fill',
    cursor: 'crosshair',
    hotkey: 'g',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.button === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      ctx.state.pendingPixels.clear();
      const points = floodFill(
        ctx.layer.data,
        ctx.layer.width,
        ctx.layer.height,
        gridPos.x,
        gridPos.y,
        mat,
        ctx.settings.tolerance
      );
      if (points.length === 0) return;
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.commitPendingPixels('fill');
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
  },
  select: {
    id: 'select',
    name: 'Select',
    cursor: 'crosshair',
    hotkey: 'm',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.isSelecting = true;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.selectionOp = ctx.getSelectionOp(e);
      ctx.state.selectionPreview = ctx.buildRectSelection(gridPos, gridPos);
      ctx.setPointerCapture(e.pointerId);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isSelecting || !ctx.state.startPoint) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.currentPoint = gridPos;
      const rectSelection = ctx.buildRectSelection(ctx.state.startPoint, gridPos);
      ctx.setSelectionPreview(ctx.mergeSelection(rectSelection, ctx.state.selectionOp));
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isSelecting) return;
      ctx.state.isSelecting = false;
      ctx.releasePointerCapture(e.pointerId);
      if (ctx.state.selectionPreview) {
        ctx.commitSelection(ctx.state.selectionPreview);
      }
      ctx.state.selectionPreview = null;
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
    },
  },
  pan: {
    id: 'pan',
    name: 'Pan',
    cursor: 'grab',
    hotkey: 'h',
    onPointerDown: (ctx, e) => {
      ctx.state.isPanning = true;
      ctx.setPointerCapture(e.pointerId);
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isPanning) return;
      ctx.setCameraByDelta(e.movementX, e.movementY);
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isPanning) return;
      ctx.state.isPanning = false;
      ctx.releasePointerCapture(e.pointerId);
    },
  },
  eyedropper: {
    id: 'eyedropper',
    name: 'Eyedropper',
    cursor: 'copy',
    hotkey: 'i',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const idx = gridPos.y * ctx.layer.width + gridPos.x;
      if (idx >= 0 && idx < ctx.layer.data.length) {
        const pickedMat = ctx.layer.data[idx] & 0xff;
        ctx.setPrimaryMaterial(pickedMat);
      }
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
  },
  line: {
    id: 'line',
    name: 'Line',
    cursor: 'crosshair',
    hotkey: 'l',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.button === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      ctx.state.currentMaterial = mat;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      startDrawing(ctx, e);
      const points = buildShapePoints('line', gridPos, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isDrawing || !ctx.state.startPoint || !ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      const points = buildShapePoints('line', ctx.state.startPoint, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, ctx.state.currentMaterial);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isDrawing) return;
      stopDrawing(ctx, e);
      ctx.commitPendingPixels('line');
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
    },
  },
  rect: {
    id: 'rect',
    name: 'Rectangle',
    cursor: 'crosshair',
    hotkey: 'r',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.button === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      ctx.state.currentMaterial = mat;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      startDrawing(ctx, e);
      const points = buildShapePoints('rect', gridPos, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isDrawing || !ctx.state.startPoint || !ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      const points = buildShapePoints('rect', ctx.state.startPoint, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, ctx.state.currentMaterial);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isDrawing) return;
      stopDrawing(ctx, e);
      ctx.commitPendingPixels('rect');
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
    },
  },
  ellipse: {
    id: 'ellipse',
    name: 'Ellipse',
    cursor: 'crosshair',
    hotkey: 'o',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const mat = e.button === 2 ? ctx.secondaryMaterial : ctx.primaryMaterial;
      ctx.state.currentMaterial = mat;
      ctx.state.startPoint = gridPos;
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      startDrawing(ctx, e);
      const points = buildShapePoints('ellipse', gridPos, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, mat);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerMove: (ctx, e) => {
      if (!ctx.state.isDrawing || !ctx.state.startPoint || !ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      ctx.state.currentPoint = gridPos;
      ctx.state.pendingPixels.clear();
      const points = buildShapePoints('ellipse', ctx.state.startPoint, gridPos, ctx.settings, e.shiftKey);
      const paintData = createPaintDataFromPoints(ctx.layer.id, ctx.layer, points, ctx.state.currentMaterial);
      ctx.addPendingPixels(paintData.pixels);
      ctx.render();
    },
    onPointerUp: (ctx, e) => {
      if (!ctx.state.isDrawing) return;
      stopDrawing(ctx, e);
      ctx.commitPendingPixels('ellipse');
      ctx.state.startPoint = null;
      ctx.state.currentPoint = null;
    },
  },
  wand: {
    id: 'wand',
    name: 'Magic Wand',
    cursor: 'crosshair',
    hotkey: 'w',
    onPointerDown: (ctx, e) => {
      if (!ensureGridLayer(ctx.layer)) return;
      const gridPos = ctx.screenToGrid(e.clientX, e.clientY);
      const result = magicWandSelect(
        ctx.layer.data,
        ctx.layer.width,
        ctx.layer.height,
        gridPos.x,
        gridPos.y,
        ctx.settings.tolerance
      );
      if (!result) return;
      const op = ctx.getSelectionOp(e);
      const wandSelection: Selection = {
        active: true,
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        mask: result.mask,
      };
      const merged = ctx.mergeSelection(wandSelection, op);
      ctx.commitSelection(merged);
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
  },
};

export const toolRegistry = tools;

export const getToolByHotkey = (key: string): ToolDefinition | null => {
  const normalized = key.toLowerCase();
  const match = Object.values(toolRegistry).find(tool => tool.hotkey === normalized);
  return match ?? null;
};