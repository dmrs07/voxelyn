/**
 * VoxelForge Editor - WebGL2 Renderer
 */

import { createTexture, updateTexture } from '@voxelyn/core';
import type { Surface2D } from '@voxelyn/core';
import type { CameraState } from '../document/types';

export type WebglRenderer = {
  resize: (width: number, height: number) => void;
  render: (surface: Surface2D, camera: CameraState) => void;
};

const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Shader compile failed';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext, vsSource: string, fsSource: string) => {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Program link failed';
    gl.deleteProgram(program);
    throw new Error(log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
};

export const createWebglRenderer = (canvas: HTMLCanvasElement): WebglRenderer | null => {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;

  const vertexSource = `#version 300 es
  in vec2 a_position;
  in vec2 a_texCoord;
  uniform vec2 u_scale;
  uniform vec2 u_translate;
  uniform vec2 u_viewport;
  out vec2 v_texCoord;
  void main() {
    vec2 pos = a_position * u_scale + u_translate;
    vec2 clip = (pos / u_viewport) * 2.0 - 1.0;
    gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
  `;

  const fragmentSource = `#version 300 es
  precision mediump float;
  uniform sampler2D u_texture;
  in vec2 v_texCoord;
  out vec4 outColor;
  void main() {
    outColor = texture(u_texture, v_texCoord);
  }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const texLocation = gl.getAttribLocation(program, 'a_texCoord');
  const scaleLocation = gl.getUniformLocation(program, 'u_scale');
  const translateLocation = gl.getUniformLocation(program, 'u_translate');
  const viewportLocation = gl.getUniformLocation(program, 'u_viewport');
  const textureLocation = gl.getUniformLocation(program, 'u_texture');

  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  if (!vao || !buffer) throw new Error('Failed to create buffers');

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  const vertices = new Float32Array([
    0, 0, 0, 0,
    1, 0, 1, 0,
    0, 1, 0, 1,
    1, 1, 1, 1,
  ]);

  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

  gl.enableVertexAttribArray(texLocation);
  gl.vertexAttribPointer(texLocation, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  let textureInfo = createTexture(gl, 1, 1);
  let surfaceWidth = 1;
  let surfaceHeight = 1;

  const resize = (width: number, height: number) => {
    gl.viewport(0, 0, width, height);
  };

  const render = (surface: Surface2D, camera: CameraState) => {
    if (surface.width !== surfaceWidth || surface.height !== surfaceHeight) {
      textureInfo = createTexture(gl, surface.width, surface.height);
      surfaceWidth = surface.width;
      surfaceHeight = surface.height;
    }

    updateTexture(gl, textureInfo, surface);

    const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
    const scaleX = surface.width * camera.zoom * dpr;
    const scaleY = surface.height * camera.zoom * dpr;
    const translateX = camera.x * dpr;
    const translateY = camera.y * dpr;

    gl.clearColor(0.1, 0.1, 0.18, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindVertexArray(vao);

    if (scaleLocation) gl.uniform2f(scaleLocation, scaleX, scaleY);
    if (translateLocation) gl.uniform2f(translateLocation, translateX, translateY);
    if (viewportLocation) gl.uniform2f(viewportLocation, gl.canvas.width, gl.canvas.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    if (textureLocation) gl.uniform1i(textureLocation, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindVertexArray(null);
  };

  return { resize, render };
};
