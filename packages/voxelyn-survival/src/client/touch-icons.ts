import dodgeIconUrl from '@phosphor-icons/core/bold/person-simple-run-bold.svg?url';
import abilityIconUrl from '@phosphor-icons/core/bold/lightning-bold.svg?url';
import consumeIconUrl from '@phosphor-icons/core/bold/flask-bold.svg?url';
import interactIconUrl from '@phosphor-icons/core/bold/hand-tap-bold.svg?url';
import type { TouchButton } from './input';

const ICON_URLS: Record<TouchButton['id'], string> = {
  dodge: dodgeIconUrl,
  ability: abilityIconUrl,
  consume: consumeIconUrl,
  interact: interactIconUrl,
};

/**
 * Phosphor publica SVGs neutros. O buffer aplica a cor do HUD com source-in,
 * mantendo os botoes legiveis sobre o canvas escuro sem duplicar paths SVG.
 */
export class TouchIconBank {
  private readonly icons = new Map<TouchButton['id'], HTMLImageElement>();
  private readonly buffer = document.createElement('canvas');

  constructor() {
    for (const [id, url] of Object.entries(ICON_URLS) as Array<[TouchButton['id'], string]>) {
      const image = new Image();
      image.src = url;
      this.icons.set(id, image);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    id: TouchButton['id'],
    cx: number,
    cy: number,
    size: number,
    color: string
  ): boolean {
    const image = this.icons.get(id);
    if (!image?.complete || image.naturalWidth <= 0) return false;

    const px = Math.max(16, Math.round(size));
    if (this.buffer.width !== px || this.buffer.height !== px) {
      this.buffer.width = px;
      this.buffer.height = px;
    }
    const bctx = this.buffer.getContext('2d');
    if (!bctx) return false;

    bctx.clearRect(0, 0, px, px);
    bctx.globalCompositeOperation = 'source-over';
    bctx.globalAlpha = 1;
    bctx.drawImage(image, 0, 0, px, px);
    bctx.globalCompositeOperation = 'source-in';
    bctx.fillStyle = color;
    bctx.fillRect(0, 0, px, px);
    bctx.globalCompositeOperation = 'source-over';

    ctx.drawImage(this.buffer, Math.round(cx - px / 2), Math.round(cy - px / 2), px, px);
    return true;
  }
}
