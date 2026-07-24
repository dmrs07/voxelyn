// Presets de qualidade grafica adaptavel (mobile-first). Persistidos em
// localStorage. O loop pode rebaixar automaticamente quando o FPS cai.

export type QualityLevel = 'high' | 'medium' | 'low';

export type QualityPreset = {
  level: QualityLevel;
  maxDpr: number; // limite de device pixel ratio
  maxFx: number; // teto de efeitos simultaneos
  dynamicLights: boolean; // luzes de fogo/cristais/descarga
  shakeScale: number; // 0..1
  targetFps: number;
};

export const PRESETS: Record<QualityLevel, QualityPreset> = {
  high: { level: 'high', maxDpr: 2, maxFx: 120, dynamicLights: true, shakeScale: 1, targetFps: 60 },
  medium: { level: 'medium', maxDpr: 1.5, maxFx: 60, dynamicLights: true, shakeScale: 0.7, targetFps: 45 },
  low: { level: 'low', maxDpr: 1, maxFx: 24, dynamicLights: false, shakeScale: 0.4, targetFps: 30 },
};

const KEY = 'voxelyn.quality';
const ORDER: QualityLevel[] = ['high', 'medium', 'low'];

export const loadQuality = (): QualityLevel => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'high' || v === 'medium' || v === 'low') return v;
  } catch {
    /* sem storage */
  }
  return 'high';
};

export const saveQuality = (level: QualityLevel): void => {
  try {
    localStorage.setItem(KEY, level);
  } catch {
    /* ignora */
  }
};

/** Proximo nivel mais leve, ou null se ja no minimo. */
export const nextLowerQuality = (level: QualityLevel): QualityLevel | null => {
  const i = ORDER.indexOf(level);
  return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
};

/**
 * Monitor de FPS que sugere rebaixamento apos janelas sustentadas abaixo do alvo.
 * Determinista o suficiente para o loop; nao decide sozinho (o chamador aplica).
 */
export class FpsGovernor {
  private samples: number[] = [];
  private lowStreak = 0;
  fps = 60;

  sample(dtMs: number): void {
    if (dtMs <= 0) return;
    const inst = 1000 / dtMs;
    this.samples.push(inst);
    if (this.samples.length > 60) this.samples.shift();
    this.fps = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  /** true quando o FPS ficou abaixo do alvo por ~2s seguidos. */
  shouldDowngrade(targetFps: number): boolean {
    if (this.samples.length < 30) return false;
    if (this.fps < targetFps - 5) {
      this.lowStreak += 1;
    } else {
      this.lowStreak = 0;
    }
    if (this.lowStreak > 120) {
      this.lowStreak = 0;
      return true;
    }
    return false;
  }
}
