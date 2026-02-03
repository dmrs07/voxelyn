import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { documentStore } from './stores';
import type { GridLayer } from './document/types';

const getActiveLayer = () => {
  const doc = get(documentStore);
  const layer = doc.layers.find(l => l.id === doc.activeLayerId);
  if (!layer || layer.type !== 'grid2d') {
    throw new Error('Expected active grid layer');
  }
  return { doc, layer };
};

const getGridLayer = (layerId: string): GridLayer => {
  const doc = get(documentStore);
  const layer = doc.layers.find((entry): entry is GridLayer => entry.id === layerId && entry.type === 'grid2d');
  if (!layer) {
    throw new Error('Expected grid layer');
  }
  return layer;
};

describe('documentStore floating lifecycle', () => {
  beforeEach(() => {
    documentStore.newDocument(8, 8, 4, 'Test');
  });

  it('creates no history entries while floating and one entry on commit', () => {
    const { doc, layer } = getActiveLayer();
    const index = 1 + 1 * layer.width;

    documentStore.paint({
      layerId: layer.id,
      pixels: [{ index, oldValue: 0, newValue: 5 }],
    });

    const afterPaint = get(documentStore);
    documentStore.select({
      before: afterPaint.selection,
      after: { active: true, x: 1, y: 1, width: 1, height: 1 },
    });

    const historyBeforeFloating = get(documentStore.history).undoCount;
    expect(documentStore.beginFloatingFromSelection(0)).toBe(true);
    documentStore.moveFloatingBy(1, 0);
    documentStore.rotateFloating(90);

    expect(get(documentStore.history).undoCount).toBe(historyBeforeFloating);

    expect(documentStore.commitFloating('enter')).toBe(true);
    expect(get(documentStore.history).undoCount).toBe(historyBeforeFloating + 1);

    const { layer: finalLayer } = getActiveLayer();
    expect(finalLayer.data[index]).toBe(0);
    expect(finalLayer.data[index + 1]).toBe(5);

    void doc;
  });

  it('auto-commits floating state on view mode changes', () => {
    const { layer } = getActiveLayer();
    const index = 2 + 2 * layer.width;

    documentStore.paint({
      layerId: layer.id,
      pixels: [{ index, oldValue: 0, newValue: 9 }],
    });

    const afterPaint = get(documentStore);
    documentStore.select({
      before: afterPaint.selection,
      after: { active: true, x: 2, y: 2, width: 1, height: 1 },
    });

    expect(documentStore.beginFloatingFromSelection(0)).toBe(true);
    documentStore.moveFloatingBy(1, 0);
    expect(documentStore.hasFloating()).toBe(true);

    documentStore.setViewMode('iso');

    expect(documentStore.hasFloating()).toBe(false);
    const committedDoc = get(documentStore);
    expect(committedDoc.viewMode).toBe('iso');
    const committedLayer = getGridLayer(committedDoc.activeLayerId);
    expect(committedLayer.data[index]).toBe(0);
    expect(committedLayer.data[index + 1]).toBe(9);
  });

  it('uses floating sessions for cut and paste flows', () => {
    const { layer } = getActiveLayer();
    const index = 1 + 1 * layer.width;

    documentStore.paint({
      layerId: layer.id,
      pixels: [{ index, oldValue: 0, newValue: 12 }],
    });

    const afterPaint = get(documentStore);
    documentStore.select({
      before: afterPaint.selection,
      after: { active: true, x: 1, y: 1, width: 1, height: 1 },
    });

    expect(documentStore.cutSelection(0)).toBe(true);
    expect(documentStore.hasFloating()).toBe(true);
    documentStore.cancelFloating();
    expect(documentStore.hasFloating()).toBe(false);

    expect(documentStore.copySelection(0)).toBe(true);
    expect(documentStore.pasteSelection(3, 3, 0)).toBe(true);
    expect(documentStore.hasFloating()).toBe(true);
    documentStore.moveFloatingBy(1, 0);
    documentStore.commitFloating('enter');

    const committedDoc = get(documentStore);
    const committedLayer = getGridLayer(committedDoc.activeLayerId);
    expect(committedLayer.data[3 + 3 * layer.width]).toBe(0);
    expect(committedLayer.data[4 + 3 * layer.width]).toBe(12);
  });
});
