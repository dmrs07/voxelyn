import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error - ferramenta JS sem tipos
import { DIRS8, projectModelPoint, renderVoxels } from '../tools/voxel.mjs';
import {
  DIAMANDIS_ARM_SOCKETS,
  DIAMANDIS_PARTS,
  DIAMANDIS_SOCKETS,
  ENTITY_SPECS,
  UNDERTAKER_SOCKETS,
  diamandisChassis,
  diamandisModel,
  diamandisPartModel,
  // @ts-expect-error - ferramenta JS sem tipos
} from '../tools/entities.mjs';

type Grid = { w: number; h: number; buf: Uint8ClampedArray };
type Spec = {
  id: string;
  frameWidth: number;
  frameHeight: number;
  anchorX: number;
  anchorY: number;
  directions: number;
  authoredDirs: string[];
  animations: Record<string, { frames: number }>;
  sockets?: Record<string, { x: number; y: number; z: number }>;
  noFit?: boolean;
  draw: (dir: string, anim: string, f: number) => Grid;
};

const ATLASES = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/atlases');

const bounds = (g: Grid) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.buf[(y * g.w + x) * 4 + 3] === 0) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, maxX, minY, maxY };
};

const specOf = (id: string): Spec => {
  const spec = (ENTITY_SPECS as Spec[]).find((s) => s.id === id);
  if (!spec) throw new Error(`spec ausente: ${id}`);
  return spec;
};

// O Diamandis e o unico bicho vivo em OITO rumos, e o unico com pecas que se
// soltam de verdade. O que este arquivo cobra: o chassi e cada peca cabem nos
// proprios quadros em todas as rotacoes e poses (o gerador so recusa quadro
// VAZIO — um quadro cortado na borda passaria em silencio), a ancora de cada
// peca E o seu encaixe, e o chassi publica os encaixes por rumo.
describe('o Diamandis em pecas', () => {
  const PART_IDS = (DIAMANDIS_PARTS as string[]).map((p) => `part-diamandis-${p}`);

  it('chassi e pecas declaram oito rumos autorados', () => {
    for (const id of ['enemy-diamandis', ...PART_IDS]) {
      const spec = specOf(id);
      expect(spec.directions).toBe(8);
      expect(spec.authoredDirs).toEqual(DIRS8);
    }
  });

  it.each(['enemy-diamandis', ...PART_IDS])(
    '%s: toda pose cabe no quadro com 2px de margem, nos oito rumos',
    (id) => {
      const spec = specOf(id);
      for (const dir of spec.authoredDirs) {
        for (const [anim, def] of Object.entries(spec.animations)) {
          for (let f = 0; f < def.frames; f++) {
            const b = bounds(spec.draw(dir, anim, f));
            expect(b.minX, `${id} ${dir}/${anim}/${f} minX`).toBeGreaterThanOrEqual(2);
            expect(b.minY, `${id} ${dir}/${anim}/${f} minY`).toBeGreaterThanOrEqual(2);
            expect(b.maxX, `${id} ${dir}/${anim}/${f} maxX`).toBeLessThanOrEqual(
              spec.frameWidth - 3,
            );
            expect(b.maxY, `${id} ${dir}/${anim}/${f} maxY`).toBeLessThanOrEqual(
              spec.frameHeight - 3,
            );
          }
        }
      }
    },
    // Rasteriza 168 quadros do chassi (oito rumos, cinco animacoes) na grade
    // fina: passa dos 5 s padrao no runner do CI, como a validacao do pacote.
    60_000,
  );

  it('as pecas nao sao recentralizadas: a ancora e o encaixe', () => {
    for (const id of PART_IDS) expect(specOf(id).noFit).toBe(true);
    // E o chassi publica um encaixe por peca, na ordem dos bits de modulo.
    const chassis = specOf('enemy-diamandis');
    // As tres ferramentas MAIS os tres bracos: o braco tem encaixe proprio no
    // deck, e nao o da peca que opera — ver DIAMANDIS_ARM_SOCKETS.
    expect(Object.keys(chassis.sockets ?? {})).toEqual([
      ...DIAMANDIS_PARTS,
      ...DIAMANDIS_ARM_SOCKETS,
    ]);
    expect(Object.keys(UNDERTAKER_SOCKETS)).toEqual(['magnet']);
  });

  it('montada, a peca no encaixe reconstroi a silhueta completa', () => {
    // A peca e autorada em volta do encaixe e o chassi guarda o encaixe: a
    // soma dos dois tem de ser o modelo inteiro, caixa por caixa.
    const whole = diamandisModel('idle', 1) as Array<Record<string, unknown>>;
    const chassis = diamandisChassis('idle', 1) as Array<Record<string, unknown>>;
    expect(whole.length).toBeGreaterThan(chassis.length);
    for (const part of DIAMANDIS_PARTS as string[]) {
      const mounted = diamandisPartModel(part, 'idle', 1) as Array<{
        x: number;
        y: number;
        z: number;
      }>;
      const socket = (DIAMANDIS_SOCKETS as Record<string, { x: number; y: number; z: number }>)[
        part
      ];
      for (const b of mounted) {
        const back = { x: b.x + socket.x, y: b.y + socket.y, z: b.z + socket.z };
        expect(
          whole.some(
            (w) =>
              Math.abs((w.x as number) - back.x) < 1e-9 &&
              Math.abs((w.y as number) - back.y) < 1e-9 &&
              Math.abs((w.z as number) - back.z) < 1e-9,
          ),
        ).toBe(true);
      }
    }
  });

  it('cada peca tem as quatro poses fora do corpo alem das montadas', () => {
    for (const id of PART_IDS) {
      const anims = Object.keys(specOf(id).animations);
      for (const pose of ['idle', 'attack', 'hit', 'loose', 'carried', 'floor']) {
        expect(anims, `${id} ${pose}`).toContain(pose);
      }
      expect(anims).not.toContain('walk');
      expect(anims).not.toContain('die');
    }
    expect(Object.keys(specOf('part-diamandis-drill').animations)).toContain('special');
    expect(Object.keys(specOf('part-diamandis-rack').animations)).not.toContain('special');
  });

  it('a pose carried pende do encaixe e a floor pousa no chao', () => {
    for (const part of DIAMANDIS_PARTS as string[]) {
      const carried = diamandisPartModel(part, 'carried', 0) as Array<{ z: number; h: number }>;
      // Tudo abaixo da ancora (o eletroima segura pelo topo).
      for (const b of carried) expect(b.z + b.h).toBeLessThanOrEqual(1e-9);
      const floor = diamandisPartModel(part, 'floor', 0) as Array<{ z: number }>;
      expect(Math.min(...floor.map((b) => b.z))).toBeCloseTo(0, 6);
    }
  });

  it('o gerador publicou os encaixes por rumo no manifest do chassi', () => {
    const path = resolve(ATLASES, 'enemy-diamandis.json');
    if (!existsSync(path)) return; // atlas ainda nao gerado neste checkout
    const m = JSON.parse(readFileSync(path, 'utf8'));
    expect(m.directions).toBe(8);
    for (const dir of DIRS8 as string[]) {
      for (const part of DIAMANDIS_PARTS as string[]) {
        const s = m.sockets[dir][part];
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThan(m.frameWidth);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThan(m.frameHeight);
      }
    }
    // A projecao do encaixe e a MESMA que a dos voxels: o mastro fica acima da
    // ancora do chassi em todo rumo (z alto = y de tela menor), e o encaixe da
    // broca fica ABAIXO do do mastro.
    for (const dir of DIRS8 as string[]) {
      expect(m.sockets[dir].mast.y).toBeLessThan(m.anchorY);
      expect(m.sockets[dir].drill.y).toBeGreaterThan(m.sockets[dir].mast.y);
    }
    const under = JSON.parse(readFileSync(resolve(ATLASES, 'enemy-undertaker.json'), 'utf8'));
    for (const dir of under.authoredDirs as string[]) {
      expect(Number.isInteger(under.sockets[dir].magnet.x)).toBe(true);
    }
  });

  it('projectModelPoint concorda com a rasterizacao no rumo sem rotacao', () => {
    // Um voxel unitario na origem, renderizado, tem o seu pixel de topo onde a
    // projecao do ponto diz: e o que garante que o encaixe cai NO desenho.
    const g = renderVoxels(
      [{ x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, mat: 'rust' }],
      0,
      64,
      64,
      32,
      40,
    ) as Grid;
    const b = bounds(g);
    const p = projectModelPoint(0.5, 0.5, 1, 0);
    expect(Math.abs(32 + p.sx - (b.minX + b.maxX) / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(40 + p.sy - b.minY)).toBeLessThanOrEqual(3);
  });
});
