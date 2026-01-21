/**
 * WebGL adapter for uploading Surface2D as a texture.
 * @module
 */

import type { Surface2D } from "../core/surface2d.js";

/** WebGL texture wrapper with dimensions */
export type WebGLTextureInfo = {
  /** WebGL texture object */
  texture: WebGLTexture;
  /** Texture width */
  width: number;
  /** Texture height */
  height: number;
};

/**
 * Creates a WebGL texture for Surface2D uploads.
 * @param gl - WebGL rendering context
 * @param width - Texture width
 * @param height - Texture height
 * @returns Texture info object
 */
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

/**
 * Updates a WebGL texture with Surface2D data.
 * @param gl - WebGL rendering context
 * @param info - Texture info from createTexture
 * @param surface - Source surface
 */
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
