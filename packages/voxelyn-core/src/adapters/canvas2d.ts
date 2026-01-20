/**
 * Canvas2D adapter for presenting Surface2D to HTML Canvas.
 * @module
 */

import type { Surface2D } from "../core/surface2d.js";

/**
 * Presents a Surface2D to a Canvas 2D context.
 * Efficiently copies pixel data via ImageData.
 * @param ctx - Canvas 2D rendering context
 * @param surface - Source surface to render
 */
export function presentToCanvas(ctx: CanvasRenderingContext2D, surface: Surface2D): void {
  const imageData = ctx.getImageData(0, 0, surface.width, surface.height);
  const bytes = new Uint8ClampedArray(surface.pixels.buffer);
  if (bytes.byteLength === imageData.data.byteLength) {
    imageData.data.set(bytes);
  } else {
    const min = Math.min(bytes.byteLength, imageData.data.byteLength);
    imageData.data.set(bytes.subarray(0, min));
  }
  ctx.putImageData(imageData, 0, 0);
}
