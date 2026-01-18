import type { Surface2D } from "../core/surface2d";

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
