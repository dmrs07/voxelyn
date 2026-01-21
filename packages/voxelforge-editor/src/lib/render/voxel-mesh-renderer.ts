import type { VoxelMesh } from './voxel-mesher';

type Mat4 = Float32Array;

type GLResources = {
  vao: WebGLVertexArrayObject;
  positionBuffer: WebGLBuffer;
  colorBuffer: WebGLBuffer;
  indexBuffer: WebGLBuffer;
  program: WebGLProgram;
  uViewProj: WebGLUniformLocation;
};

export type VoxelMeshRenderer = {
  resize: (width: number, height: number) => void;
  setMesh: (mesh: VoxelMesh) => void;
  render: (viewProj: Mat4) => void;
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

const createResources = (gl: WebGL2RenderingContext): GLResources => {
  const vertexSource = `#version 300 es
  in vec3 a_position;
  in vec4 a_color;
  uniform mat4 u_viewProj;
  out vec4 v_color;
  void main() {
    v_color = a_color;
    gl_Position = u_viewProj * vec4(a_position, 1.0);
  }
  `;

  const fragmentSource = `#version 300 es
  precision mediump float;
  in vec4 v_color;
  out vec4 outColor;
  void main() {
    outColor = v_color;
  }
  `;

  const program = createProgram(gl, vertexSource, fragmentSource);
  const vao = gl.createVertexArray();
  const positionBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!vao || !positionBuffer || !colorBuffer || !indexBuffer) {
    throw new Error('Failed to create WebGL buffers');
  }

  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  const colorLoc = gl.getAttribLocation(program, 'a_color');
  gl.enableVertexAttribArray(colorLoc);
  gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  gl.bindVertexArray(null);

  const uViewProj = gl.getUniformLocation(program, 'u_viewProj');
  if (!uViewProj) {
    throw new Error('Missing u_viewProj uniform');
  }

  return { vao, positionBuffer, colorBuffer, indexBuffer, program, uViewProj };
};

export const createVoxelMeshRenderer = (canvas: HTMLCanvasElement): VoxelMeshRenderer | null => {
  const gl = canvas.getContext('webgl2');
  if (!gl) return null;

  const resources = createResources(gl);
  let indexCount = 0;

  const resize = (width: number, height: number) => {
    gl.viewport(0, 0, width, height);
  };

  const setMesh = (mesh: VoxelMesh) => {
    indexCount = mesh.indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, resources.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resources.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
  };

  const render = (viewProj: Mat4) => {
    if (indexCount === 0) {
      gl.clearColor(0.08, 0.08, 0.12, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return;
    }

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.clearColor(0.08, 0.08, 0.12, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(resources.program);
    gl.bindVertexArray(resources.vao);
    gl.uniformMatrix4fv(resources.uViewProj, false, viewProj);

    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

    gl.bindVertexArray(null);
  };

  return { resize, setMesh, render };
};
