import type { Surface2D } from "../core/surface2d";

export type WebGLTextureInfo = {
  texture: WebGLTexture;
  width: number;
  height: number;
};

export function createTexture(
  gl: WebGLRenderingContext,
  width: number,
  height: number
): WebGLTextureInfo {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Failed to create WebGL texture");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  return { texture, width, height };
}

export function updateTexture(
  gl: WebGLRenderingContext,
  info: WebGLTextureInfo,
  surface: Surface2D
): void {
  gl.bindTexture(gl.TEXTURE_2D, info.texture);
  const bytes = new Uint8Array(surface.pixels.buffer);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    0,
    0,
    surface.width,
    surface.height,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    bytes
  );
}
