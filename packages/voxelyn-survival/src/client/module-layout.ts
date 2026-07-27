export type Rect = { x: number; y: number; w: number; h: number };
export type SafeInsets = { top: number; right: number; bottom: number; left: number };

export const moduleChoiceLayout = (
  viewportWidth: number,
  viewportHeight: number,
  safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 },
  reserveTouchBottom = 0
): [Rect, Rect] => {
  const margin = 14;
  const left = safe.left + margin;
  const right = viewportWidth - safe.right - margin;
  const top = safe.top + Math.max(86, viewportHeight * 0.2);
  const bottom = viewportHeight - safe.bottom - margin - reserveTouchBottom;
  const availableW = Math.max(220, right - left);
  const availableH = Math.max(240, bottom - top);
  const portrait = viewportHeight > viewportWidth * 1.08;

  if (portrait) {
    const gap = 10;
    const cardH = Math.max(126, Math.min(180, (availableH - gap) / 2));
    const cardW = Math.min(420, availableW);
    const x = left + (availableW - cardW) / 2;
    return [
      { x, y: top, w: cardW, h: cardH },
      { x, y: top + cardH + gap, w: cardW, h: cardH },
    ];
  }

  const gap = Math.max(12, Math.min(28, availableW * 0.04));
  const cardW = Math.min(360, (availableW - gap) / 2);
  const cardH = Math.max(150, Math.min(220, availableH));
  const startX = left + (availableW - cardW * 2 - gap) / 2;
  return [
    { x: startX, y: top, w: cardW, h: cardH },
    { x: startX + cardW + gap, y: top, w: cardW, h: cardH },
  ];
};
