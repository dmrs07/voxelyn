import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import * as P from '/home/user/voxelyn/packages/voxelyn-survival-content/tools/prospector.mjs';
import * as M from '/home/user/voxelyn/packages/voxelyn-survival-content/tools/prospector-modules.mjs';
import { renderVoxels } from '/home/user/voxelyn/packages/voxelyn-survival-content/tools/voxel.mjs';

const DIRS = [0, 1, 2, 3]; // dr dl ur ul
const SCALE = 7;
// Recorte na regiao da arma: o corpo inteiro a 4x nao mostra uma peca de tres voxels.
const CX0 = 8, CX1 = 84, CY0 = 22, CY1 = 86;
const [, , outName, mode] = process.argv;
const pose = {};
const parts = P.prospectorParts(pose);
const a = P.gunAnchor(pose);

const rows = [];
if (mode === 'a') {
  rows.push({ label: 'base', boxes: [...parts.lower, ...parts.upper, ...parts.gun] });
  for (const id of ['piercing', 'explosive', 'conductive'])
    rows.push({ label: id, boxes: [...parts.lower, ...parts.upper, ...parts.gun, ...M.MODULE_ATTACHMENTS[id](a)] });
} else if (mode === 'b') {
  for (const id of ['return_disc', 'ricochet', 'siphon'])
    rows.push({ label: id, boxes: [...parts.lower, ...parts.upper, ...parts.gun, ...M.MODULE_ATTACHMENTS[id](a)] });
  rows.push({ label: 'todos', boxes: [...parts.lower, ...parts.upper, ...parts.gun, ...M.ATTACHMENT_IDS.flatMap((id) => M.MODULE_ATTACHMENTS[id](a))] });
} else if (mode === 'mg') {
  rows.push({ label: 'gun base', boxes: [...parts.lower, ...parts.upper, ...parts.gun] });
  for (let fan = 0; fan < 4; fan++)
    rows.push({ label: `minigun fan${fan}`, boxes: [...parts.lower, ...parts.upper, ...M.minigunGun({ fan })] });
} else if (mode === 'all') {
  rows.push({ label: 'base', boxes: [...parts.lower, ...parts.upper, ...parts.gun] });
  for (const id of M.ATTACHMENT_IDS)
    rows.push({ label: id, boxes: [...parts.lower, ...parts.upper, ...parts.gun, ...M.MODULE_ATTACHMENTS[id](a)] });
  rows.push({ label: 'todos', boxes: [...parts.lower, ...parts.upper, ...parts.gun, ...M.ATTACHMENT_IDS.flatMap((id) => M.MODULE_ATTACHMENTS[id](a))] });
  rows.push({ label: 'minigun', boxes: [...parts.lower, ...parts.upper, ...M.minigunGun(pose)] });
} else {
  for (let fan = 0; fan < 4; fan++)
    rows.push({ label: `fan${fan}`, boxes: [...parts.lower, ...parts.upper, ...M.minigunGun({ ...pose, fan })] });
}

const W = P.FRAME_WIDTH, H = P.FRAME_HEIGHT;
const CW = CX1 - CX0, CH = CY1 - CY0;
const out = new PNG({ width: DIRS.length * CW * SCALE, height: rows.length * CH * SCALE });
for (let i = 0; i < out.width * out.height; i++) {
  out.data[i * 4] = 20; out.data[i * 4 + 1] = 24; out.data[i * 4 + 2] = 32; out.data[i * 4 + 3] = 255;
}
rows.forEach((r, ri) => {
  DIRS.forEach((d, ci) => {
    const g = renderVoxels(r.boxes, d, W, H, P.RENDER_ANCHOR_X, P.RENDER_ANCHOR_Y);
    for (let y = CY0; y < CY1; y++) for (let x = CX0; x < CX1; x++) {
      const si = (y * W + x) * 4;
      if (g.buf[si + 3] === 0) continue;
      for (let sy = 0; sy < SCALE; sy++) for (let sx = 0; sx < SCALE; sx++) {
        const ti = (((ri * CH + (y - CY0)) * SCALE + sy) * out.width + (ci * CW + (x - CX0)) * SCALE + sx) * 4;
        out.data[ti] = g.buf[si]; out.data[ti + 1] = g.buf[si + 1]; out.data[ti + 2] = g.buf[si + 2]; out.data[ti + 3] = 255;
      }
    }
  });
});
writeFileSync(outName, PNG.sync.write(out));
console.log(`${outName} ${out.width}x${out.height} — linhas: ${rows.map((r) => r.label).join(', ')}`);
