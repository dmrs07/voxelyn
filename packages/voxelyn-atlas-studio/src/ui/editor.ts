// Editor de pixels mobile-first: 1 dedo desenha, 2 dedos fazem pan/pinch.
// Toda a edicao acontece num Grid do frame corrente; commit vai para o projeto
// (IndexedDB) e para o historico de undo.
import type { Grid, Project } from '../types';
import { frameKey } from '../types';
import { cloneBuf, drawLine, drawRect, floodFill, getPx, resizeBuf, stamp } from '../grid';
import { projectFrame } from '../atlas';
import { COLORS, MAX_ATLAS_COLORS, PALETTE_ENTRIES, FRAME_MARGIN } from '../palette';
import { ALL_DIRS, ANIM_ORDER, orderedAnims } from '../presets';
import { History } from '../history';
import { saveProject } from '../store';
import { openExportSheet as openExportSheetShared } from './sheets';
import { el, openSheet, toast } from './components';

type Tool = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'picker';

const TOOL_ICONS: Record<Tool, string> = {
  pencil: '✏️',
  eraser: '🧽',
  fill: '🪣',
  line: '📏',
  rect: '⬛',
  picker: '💉',
};

const TOOL_LABELS: Record<Tool, string> = {
  pencil: 'Lapis',
  eraser: 'Borracha',
  fill: 'Balde',
  line: 'Linha',
  rect: 'Retangulo',
  picker: 'Conta-gotas',
};

export const mountEditor = (root: HTMLElement, project: Project, onBack: () => void): void => {
  root.innerHTML = '';

  // ---------------- estado ----------------
  let dir = project.authoredDirs[0] ?? 'dr';
  let anims = orderedAnims(project.animations);
  let anim = anims[0];
  let frameIndex = 0;
  let tool: Tool = 'pencil';
  let colorName = 'player';
  let brushSize = 1;
  let onion = false;
  let showGrid = true;
  let playing = false;
  let playStart = 0;

  const history = new History();
  let working: Grid = projectFrame(project, dir, anim, frameIndex);
  const view = { scale: 6, x: 0, y: 0 };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleSave = (): void => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveProject(project), 700);
  };

  const currentKey = (): string => frameKey(dir, anim, frameIndex);

  const loadFrame = (): void => {
    working = projectFrame(project, dir, anim, frameIndex);
  };

  // ---------------- topbar ----------------
  const backBtn = el('button', { text: '←', title: 'Voltar' });
  const undoBtn = el('button', { text: '↩', title: 'Desfazer' });
  const redoBtn = el('button', { text: '↪', title: 'Refazer' });
  const fitBtn = el('button', { text: '⤢', title: 'Enquadrar' });
  const menuBtn = el('button', { text: '⋮', title: 'Menu' });
  const title = el('div', { class: 'title', text: project.name });
  const topbar = el('div', { class: 'topbar' }, [
    backBtn,
    title,
    undoBtn,
    redoBtn,
    fitBtn,
    menuBtn,
  ]);

  // ---------------- canvas ----------------
  const canvas = el('canvas');
  const hud = el('div', { class: 'hud' });
  const canvasWrap = el('div', { class: 'canvas-wrap' }, [canvas, hud]);
  const ctx = canvas.getContext('2d')!;
  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d')!;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  const resizeCanvas = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    render();
  };

  const fitView = (): void => {
    const rect = canvasWrap.getBoundingClientRect();
    const scale = Math.max(
      1,
      Math.floor(
        Math.min(rect.width / project.frameWidth, rect.height / project.frameHeight) * 0.85,
      ),
    );
    view.scale = scale;
    view.x = (rect.width - project.frameWidth * scale) / 2;
    view.y = (rect.height - project.frameHeight * scale) / 2;
    render();
  };

  let checkerPattern: CanvasPattern | null = null;
  const getChecker = (): CanvasPattern => {
    if (checkerPattern) return checkerPattern;
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 8;
    const cc = c.getContext('2d')!;
    cc.fillStyle = '#161d2c';
    cc.fillRect(0, 0, 8, 8);
    cc.fillStyle = '#0e1420';
    cc.fillRect(0, 0, 4, 4);
    cc.fillRect(4, 4, 4, 4);
    checkerPattern = ctx.createPattern(c, 'repeat')!;
    return checkerPattern;
  };

  const render = (): void => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const fw = project.frameWidth;
    const fh = project.frameHeight;
    const s = view.scale;

    // fundo checker (transparencia) sob o frame
    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.fillStyle = getChecker();
    ctx.fillRect(0, 0, fw * s, fh * s);
    ctx.restore();

    ctx.imageSmoothingEnabled = false;

    // onion skin: frame anterior da mesma animacao
    if (onion && frameIndex > 0) {
      const prev = projectFrame(project, dir, anim, frameIndex - 1);
      offscreen.width = fw;
      offscreen.height = fh;
      offCtx.putImageData(new ImageData(new Uint8ClampedArray(prev.buf), fw, fh), 0, 0);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(offscreen, view.x, view.y, fw * s, fh * s);
      ctx.globalAlpha = 1;
    }

    offscreen.width = fw;
    offscreen.height = fh;
    offCtx.putImageData(new ImageData(new Uint8ClampedArray(working.buf), fw, fh), 0, 0);
    ctx.drawImage(offscreen, view.x, view.y, fw * s, fh * s);

    // grade
    if (showGrid && s >= 8) {
      ctx.strokeStyle = 'rgba(122,139,163,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= fw; x++) {
        ctx.moveTo(view.x + x * s, view.y);
        ctx.lineTo(view.x + x * s, view.y + fh * s);
      }
      for (let y = 0; y <= fh; y++) {
        ctx.moveTo(view.x, view.y + y * s);
        ctx.lineTo(view.x + fw * s, view.y + y * s);
      }
      ctx.stroke();
    }

    // guia da margem obrigatoria de 2px
    ctx.strokeStyle = 'rgba(217,59,76,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      view.x + FRAME_MARGIN * s,
      view.y + FRAME_MARGIN * s,
      (fw - FRAME_MARGIN * 2) * s,
      (fh - FRAME_MARGIN * 2) * s,
    );

    // borda do frame
    ctx.strokeStyle = 'rgba(122,139,163,0.6)';
    ctx.strokeRect(view.x, view.y, fw * s, fh * s);

    // anchor
    const ax = view.x + (project.anchorX + 0.5) * s;
    const ay = view.y + (project.anchorY + 0.5) * s;
    ctx.strokeStyle = '#59f2c2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ax - 6, ay);
    ctx.lineTo(ax + 6, ay);
    ctx.moveTo(ax, ay - 6);
    ctx.lineTo(ax, ay + 6);
    ctx.stroke();

    hud.textContent = `${project.spriteId} · ${dir}/${anim} ${frameIndex + 1}/${project.animations[anim]?.frames ?? 0} · ${Math.round(s * 100) / 100}x · ${TOOL_LABELS[tool]}${tool === 'pencil' || tool === 'eraser' ? ` ${brushSize}px` : ''}`;
  };

  // ---------------- gestos ----------------
  type PointerInfo = { x: number; y: number };
  const pointers = new Map<number, PointerInfo>();
  let strokeBefore: Uint8Array | null = null;
  let strokeBase: Uint8Array | null = null;
  let strokeStart: { x: number; y: number } | null = null;
  let lastCell: { x: number; y: number } | null = null;
  let strokeCancelled = false;
  let pinchDist = 0;
  let pinchScale = 0;
  let moved = false;

  const cellAt = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((clientX - rect.left - view.x) / view.scale),
      y: Math.floor((clientY - rect.top - view.y) / view.scale),
    };
  };

  const activeRgb = (): readonly number[] | null => (tool === 'eraser' ? null : COLORS[colorName]);

  const beginStroke = (cell: { x: number; y: number }): void => {
    if (playing) return;
    strokeBefore = cloneBuf(working.buf);
    strokeCancelled = false;
    strokeStart = cell;
    lastCell = cell;
    if (tool === 'pencil' || tool === 'eraser') {
      stamp(working, cell.x, cell.y, activeRgb(), brushSize);
      render();
    } else if (tool === 'line' || tool === 'rect') {
      strokeBase = cloneBuf(working.buf);
    } else if (tool === 'fill') {
      floodFill(working, cell.x, cell.y, activeRgb());
      render();
    }
  };

  const moveStroke = (cell: { x: number; y: number }): void => {
    if (!strokeBefore || strokeCancelled || playing) return;
    if (tool === 'pencil' || tool === 'eraser') {
      if (lastCell && (lastCell.x !== cell.x || lastCell.y !== cell.y)) {
        drawLine(working, lastCell.x, lastCell.y, cell.x, cell.y, activeRgb(), brushSize);
        lastCell = cell;
        render();
      }
    } else if ((tool === 'line' || tool === 'rect') && strokeBase && strokeStart) {
      working.buf.set(strokeBase);
      if (tool === 'line')
        drawLine(working, strokeStart.x, strokeStart.y, cell.x, cell.y, activeRgb(), brushSize);
      else drawRect(working, strokeStart.x, strokeStart.y, cell.x, cell.y, activeRgb());
      render();
    }
  };

  const commitStroke = (cell: { x: number; y: number } | null): void => {
    if (!strokeBefore) return;
    if (strokeCancelled) {
      strokeBefore = null;
      strokeBase = null;
      return;
    }
    if (tool === 'picker' && cell) {
      const rgb = getPx(working, cell.x, cell.y);
      if (rgb) {
        const hex = '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
        const entry = PALETTE_ENTRIES.find((p) => p.hex === hex);
        if (entry) {
          colorName = entry.name;
          tool = 'pencil';
          updateToolbar();
          updatePalette();
          toast(`Cor: ${entry.name}`);
        } else {
          toast(`Cor fora da paleta: ${hex}`);
        }
      }
      working.buf.set(strokeBefore);
      strokeBefore = null;
      render();
      return;
    }
    const before = strokeBefore;
    const after = cloneBuf(working.buf);
    strokeBefore = null;
    strokeBase = null;
    let changed = false;
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    history.push({ frameKey: currentKey(), before, after });
    project.frames[currentKey()] = cloneBuf(after);
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
  };

  const cancelStroke = (): void => {
    if (strokeBefore && !strokeCancelled) {
      working.buf.set(strokeBefore);
      strokeCancelled = true;
      render();
    }
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) {
      beginStroke(cellAt(e.clientX, e.clientY));
    } else if (pointers.size === 2) {
      cancelStroke();
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      pinchScale = view.scale;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const info = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, info);
    moved = true;
    if (pointers.size === 1) {
      moveStroke(cellAt(e.clientX, e.clientY));
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = canvas.getBoundingClientRect();
      const worldX = (cx - rect.left - view.x) / view.scale;
      const worldY = (cy - rect.top - view.y) / view.scale;
      if (pinchDist > 0) {
        view.scale = Math.min(64, Math.max(1, (pinchScale * dist) / pinchDist));
      }
      view.x = cx - rect.left - worldX * view.scale;
      view.y = cy - rect.top - worldY * view.scale;
      // pan com o movimento medio dos dois dedos ja embutido acima
      render();
    }
  });

  const endPointer = (e: PointerEvent): void => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      commitStroke(cellAt(e.clientX, e.clientY));
      void moved;
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      cancelStroke();
      strokeBefore = null;
    }
  });

  // desktop: roda do mouse para zoom
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - view.x) / view.scale;
      const worldY = (e.clientY - rect.top - view.y) / view.scale;
      view.scale = Math.min(64, Math.max(1, view.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      view.x = e.clientX - rect.left - worldX * view.scale;
      view.y = e.clientY - rect.top - worldY * view.scale;
      render();
    },
    { passive: false },
  );

  // ---------------- undo/redo ----------------
  const updateUndoRedo = (): void => {
    undoBtn.disabled = !history.canUndo;
    redoBtn.disabled = !history.canRedo;
  };

  const applyHistory = (buf: Uint8Array, key: string): void => {
    project.frames[key] = cloneBuf(buf);
    if (key === currentKey()) working.buf.set(buf);
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
  };

  undoBtn.addEventListener('click', () => {
    const entry = history.undo();
    if (entry) applyHistory(entry.before, entry.frameKey);
  });
  redoBtn.addEventListener('click', () => {
    const entry = history.redo();
    if (entry) applyHistory(entry.after, entry.frameKey);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redoBtn.click();
      else undoBtn.click();
    }
  });

  backBtn.addEventListener('click', () => {
    clearTimeout(saveTimer);
    void saveProject(project).then(onBack);
  });
  fitBtn.addEventListener('click', fitView);

  // ---------------- toolbar ----------------
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
  const brushBtn = el('button', { class: 'toolbtn', text: '1px', title: 'Tamanho do pincel' });
  brushBtn.addEventListener('click', () => {
    brushSize = brushSize === 1 ? 2 : brushSize === 2 ? 3 : 1;
    brushBtn.textContent = `${brushSize}px`;
    updateToolbar();
  });
  const gridBtn = el('button', { class: 'toolbtn', text: '#', title: 'Grade' });
  gridBtn.addEventListener('click', () => {
    showGrid = !showGrid;
    gridBtn.classList.toggle('active', showGrid);
    render();
  });
  const onionBtn = el('button', { class: 'toolbtn', text: '🧅', title: 'Onion skin' });
  onionBtn.addEventListener('click', () => {
    onion = !onion;
    onionBtn.classList.toggle('active', onion);
    render();
  });
  toolsRow.append(brushBtn, gridBtn, onionBtn);

  const updateToolbar = (): void => {
    for (const [t, btn] of toolButtons) btn.classList.toggle('active', t === tool);
    gridBtn.classList.toggle('active', showGrid);
    render();
  };

  // ---------------- paleta ----------------
  const paletteRow = el('div', { class: 'row' });
  const budget = el('span', { class: 'budget' });
  const swatches = new Map<string, HTMLButtonElement>();
  for (const entry of PALETTE_ENTRIES) {
    const b = el('button', {
      class: 'swatch',
      style: `background:${entry.hex}`,
      title: entry.name,
    });
    b.addEventListener('click', () => {
      colorName = entry.name;
      if (tool === 'eraser' || tool === 'picker') tool = 'pencil';
      updateToolbar();
      updatePalette();
    });
    swatches.set(entry.name, b);
    paletteRow.append(b);
  }
  paletteRow.append(budget);

  const atlasColorCount = (): number => {
    const used = new Set<string>();
    for (const buf of Object.values(project.frames)) {
      for (let i = 0; i < buf.length; i += 4) {
        if (buf[i + 3] === 0) continue;
        used.add(`${buf[i]},${buf[i + 1]},${buf[i + 2]}`);
      }
    }
    return used.size;
  };

  const updatePalette = (): void => {
    for (const [name, b] of swatches) b.classList.toggle('active', name === colorName);
    const count = atlasColorCount();
    budget.textContent = `${count}/${MAX_ATLAS_COLORS} cores`;
    budget.classList.toggle('over', count > MAX_ATLAS_COLORS);
  };

  // ---------------- direcoes ----------------
  const dirRow = el('div', { class: 'row' });
  const updateDirRow = (): void => {
    dirRow.innerHTML = '';
    for (const d of ALL_DIRS) {
      const authored = project.authoredDirs.includes(d);
      const flipped = project.flipPairs[d];
      const btn = el('button', {
        class: `dir-tab${d === dir ? ' active' : ''}${!authored ? ' flip' : ''}`,
        text: flipped ? `${d} ⇋${flipped}` : d,
      });
      btn.addEventListener('click', () => {
        if (!authored) {
          toast(
            flipped
              ? `${d} e espelho de ${flipped} — edite ${flipped}`
              : `${d} nao esta autorada (veja Configuracoes)`,
          );
          return;
        }
        dir = d;
        stopPlayback();
        loadFrame();
        updateDirRow();
        updateFrameStrip();
        render();
      });
      dirRow.append(btn);
    }
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
    loadFrame();
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
      const g = f === frameIndex ? working : projectFrame(project, dir, anim, f);
      c.width = g.w;
      c.height = g.h;
      c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
      thumb.append(c, el('span', { class: 'n', text: String(f + 1) }));
      thumb.addEventListener('click', () => {
        frameIndex = f;
        stopPlayback();
        loadFrame();
        updateFrameStrip();
        render();
      });
      frameStripWrap.append(thumb);
    }
  };

  copyPrevBtn.addEventListener('click', () => {
    if (frameIndex === 0) {
      toast('Nao ha frame anterior nesta animacao');
      return;
    }
    const prev = projectFrame(project, dir, anim, frameIndex - 1);
    const before = cloneBuf(working.buf);
    working.buf.set(prev.buf);
    history.push({ frameKey: currentKey(), before, after: cloneBuf(working.buf) });
    project.frames[currentKey()] = cloneBuf(working.buf);
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
  });

  clearBtn.addEventListener('click', () => {
    const before = cloneBuf(working.buf);
    working.buf.fill(0);
    history.push({ frameKey: currentKey(), before, after: cloneBuf(working.buf) });
    project.frames[currentKey()] = cloneBuf(working.buf);
    scheduleSave();
    updateUndoRedo();
    updateFrameStrip();
    render();
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
          loadFrame();
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

  // ---------------- menu / sheets ----------------
  menuBtn.addEventListener('click', () => {
    void openSheet((close) => {
      const preview = el('button', { text: '👁 Pre-visualizar (4 direcoes)' });
      const exportBtn = el('button', { class: 'primary', text: '⇪ Validar & exportar atlas' });
      const settings = el('button', { text: '⚙ Configuracoes do sprite' });
      preview.addEventListener('click', () => {
        close();
        void openPreviewSheet();
      });
      exportBtn.addEventListener('click', () => {
        close();
        void openExportSheet();
      });
      settings.addEventListener('click', () => {
        close();
        void openSettingsSheet();
      });
      return el('div', {}, [
        el('h2', { text: project.name }),
        el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [
          preview,
          exportBtn,
          settings,
        ]),
      ]);
    });
  });

  const openPreviewSheet = (): Promise<void> =>
    openSheet(() => {
      const container = el('div');
      const select = el('select');
      for (const a of anims) select.append(el('option', { value: a, text: a }));
      select.value = anim;
      const grid = el('div', { class: 'preview-grid' });
      const cells = new Map<string, CanvasRenderingContext2D>();
      for (const d of ALL_DIRS) {
        const c = el('canvas');
        c.width = project.frameWidth;
        c.height = project.frameHeight;
        const scale = Math.max(
          1,
          Math.floor(160 / Math.max(project.frameWidth, project.frameHeight)),
        );
        c.style.width = `${project.frameWidth * scale}px`;
        cells.set(d, c.getContext('2d')!);
        grid.append(
          el('div', { class: 'preview-cell' }, [el('span', { class: 'tag', text: d }), c]),
        );
      }
      const start = performance.now();
      const tick = (): void => {
        if (!document.body.contains(container)) return;
        const a = select.value;
        const def = project.animations[a];
        const elapsed = performance.now() - start;
        const raw = Math.floor((elapsed / 1000) * def.fps);
        const f = def.loop ? raw % def.frames : Math.min(raw, def.frames - 1);
        for (const d of ALL_DIRS) {
          const cctx = cells.get(d)!;
          const source = project.flipPairs[d] ?? d;
          const flip = Boolean(project.flipPairs[d]);
          const g = project.authoredDirs.includes(source)
            ? projectFrame(project, source, a, f)
            : null;
          cctx.clearRect(0, 0, project.frameWidth, project.frameHeight);
          if (!g) continue;
          offscreen.width = g.w;
          offscreen.height = g.h;
          offCtx.putImageData(new ImageData(new Uint8ClampedArray(g.buf), g.w, g.h), 0, 0);
          cctx.save();
          cctx.imageSmoothingEnabled = false;
          if (flip) {
            cctx.translate(project.frameWidth, 0);
            cctx.scale(-1, 1);
          }
          cctx.drawImage(offscreen, 0, 0);
          cctx.restore();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      container.append(el('h2', { text: 'Pre-visualizacao' }), select, grid);
      return container;
    });

  const openExportSheet = (): Promise<void> => openExportSheetShared(project, scheduleSave);

  const openSettingsSheet = (): Promise<void> =>
    openSheet((close) => {
      const container = el('div');
      const nameInput = el('input', { value: project.name });
      const idInput = el('input', { value: project.spriteId, autocapitalize: 'none' });
      const promptInput = el('input', {
        value: project.prompt,
        placeholder: 'nota de geracao/referencia (vai no manifest)',
      });
      const num = (value: number, min = 0): HTMLInputElement =>
        el('input', { type: 'number', value: String(value), min: String(min), step: 'any' });
      const wInput = num(project.frameWidth, 8);
      const hInput = num(project.frameHeight, 8);
      const axInput = num(project.anchorX);
      const ayInput = num(project.anchorY);
      const hbW = num(project.hitbox.w);
      const hbH = num(project.hitbox.h);
      const fpW = num(project.footprint.w, 1);
      const fpH = num(project.footprint.h, 1);
      const fpX = num(project.footprint.offsetX);
      const fpY = num(project.footprint.offsetY);

      // direcoes autoradas + flips
      const dirBox = el('div', { class: 'grid2' });
      const dirState: Record<string, { authored: HTMLInputElement; flip: HTMLSelectElement }> = {};
      for (const d of ALL_DIRS) {
        const authored = el('input', { type: 'checkbox' });
        authored.checked = project.authoredDirs.includes(d);
        const flip = el('select');
        flip.append(el('option', { value: '', text: 'sem flip' }));
        for (const s of ALL_DIRS) {
          if (s !== d) flip.append(el('option', { value: s, text: `flip de ${s}` }));
        }
        flip.value = project.flipPairs[d] ?? '';
        dirState[d] = { authored, flip };
        const sync = (): void => {
          flip.disabled = authored.checked;
        };
        authored.addEventListener('change', sync);
        sync();
        dirBox.append(
          el('div', {}, [
            el('label', { style: 'display:flex;align-items:center;gap:8px' }, [
              authored,
              `direcao ${d}`,
            ]),
            flip,
          ]),
        );
      }

      // animacoes
      const animBox = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
      const animState = new Map<
        string,
        { frames: HTMLInputElement; fps: HTMLInputElement; loop: HTMLInputElement }
      >();
      const renderAnimRows = (): void => {
        animBox.innerHTML = '';
        animBox.append(
          el('div', { class: 'anim-row', style: 'color:var(--muted);font-size:11px' }, [
            el('span', { text: 'animacao' }),
            el('span', { text: 'frames' }),
            el('span', { text: 'fps' }),
            el('span', { text: 'loop' }),
            el('span', { text: '' }),
          ]),
        );
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
        project.prompt = promptInput.value.trim();
        const newW = Math.max(8, Math.round(Number(wInput.value) || project.frameWidth));
        const newH = Math.max(8, Math.round(Number(hInput.value) || project.frameHeight));
        applyResize(newW, newH);
        project.anchorX = Math.round(Number(axInput.value) || 0);
        project.anchorY = Math.round(Number(ayInput.value) || 0);
        project.hitbox = { w: Number(hbW.value) || 0.5, h: Number(hbH.value) || 0.5 };
        project.footprint = {
          w: Math.max(1, Math.round(Number(fpW.value) || 1)),
          h: Math.max(1, Math.round(Number(fpH.value) || 1)),
          offsetX: Number(fpX.value) || 0,
          offsetY: Number(fpY.value) || 0,
        };
        const authoredDirs = ALL_DIRS.filter((d) => dirState[d].authored.checked);
        const flipPairs: Record<string, string> = {};
        for (const d of ALL_DIRS) {
          if (!dirState[d].authored.checked && dirState[d].flip.value) {
            flipPairs[d] = dirState[d].flip.value;
          }
        }
        if (authoredDirs.length === 0) {
          toast('Pelo menos uma direcao precisa ser autorada');
          return;
        }
        project.authoredDirs = authoredDirs;
        project.flipPairs = flipPairs;
        for (const [a, state] of animState) {
          project.animations[a] = {
            frames: Math.max(1, Math.round(Number(state.frames.value) || 1)),
            fps: Math.max(1, Number(state.fps.value) || 1),
            loop: state.loop.checked,
          };
        }
        if (!project.authoredDirs.includes(dir)) dir = project.authoredDirs[0];
        anims = orderedAnims(project.animations);
        if (!anims.includes(anim)) anim = anims[0];
        const def = project.animations[anim];
        if (frameIndex >= def.frames) frameIndex = def.frames - 1;
        title.textContent = project.name;
        history.clear();
        updateUndoRedo();
        loadFrame();
        updateAnimSelect();
        updateDirRow();
        updateFrameStrip();
        updatePalette();
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
        el('div', {}, [el('label', { text: 'Nota de geracao (manifest)' }), promptInput]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Largura do frame (px)' }), wInput]),
          el('div', {}, [el('label', { text: 'Altura do frame (px)' }), hInput]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Anchor X' }), axInput]),
          el('div', {}, [el('label', { text: 'Anchor Y' }), ayInput]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Hitbox w (tiles)' }), hbW]),
          el('div', {}, [el('label', { text: 'Hitbox h (tiles)' }), hbH]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Footprint w' }), fpW]),
          el('div', {}, [el('label', { text: 'Footprint h' }), fpH]),
        ]),
        el('div', { class: 'grid2' }, [
          el('div', {}, [el('label', { text: 'Footprint offsetX' }), fpX]),
          el('div', {}, [el('label', { text: 'Footprint offsetY' }), fpY]),
        ]),
        el('div', {}, [el('label', { text: 'Direcoes' }), dirBox]),
        el('div', {}, [el('label', { text: 'Animacoes (frames / fps / loop)' }), animBox]),
        apply,
      );
      return container;
    });

  const applyResize = (newW: number, newH: number): void => {
    if (newW === project.frameWidth && newH === project.frameHeight) return;
    const oldW = project.frameWidth;
    const oldH = project.frameHeight;
    for (const [key, buf] of Object.entries(project.frames)) {
      project.frames[key] = resizeBuf(buf, oldW, oldH, newW, newH);
    }
    project.frameWidth = newW;
    project.frameHeight = newH;
    project.anchorX = Math.min(project.anchorX, newW - 1);
    project.anchorY = Math.min(project.anchorY, newH - 1);
  };

  // ---------------- montagem ----------------
  const bottom = el('div', { class: 'bottom' }, [
    toolsRow,
    paletteRow,
    dirRow,
    timelineRow,
    frameStripWrap,
  ]);
  const mainCol = el(
    'div',
    { class: 'main-col', style: 'display:flex;flex-direction:column;flex:1;min-height:0' },
    [topbar, canvasWrap, bottom],
  );
  const editor = el('div', { class: 'editor' }, [mainCol]);
  root.append(editor);

  const resizeObserver = new ResizeObserver(() => resizeCanvas());
  resizeObserver.observe(canvasWrap);

  updateToolbar();
  updatePalette();
  updateDirRow();
  updateAnimSelect();
  updateFrameStrip();
  updateUndoRedo();
  requestAnimationFrame(() => {
    resizeCanvas();
    fitView();
  });
};
