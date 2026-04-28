/* ============================================================
   Voxelyn Sprite Animation Engine
   - Canvas-based pixel renderer
   - Per-frame grid + transform (offset, squash/stretch, rotation)
   - State machine: idle / walk / attack / hit / die
   - Full 4-facing (DR / DL / UR / UL) — DL and UL via mirror-flip
============================================================ */

// Parse a multi-line grid string into 2D palette indices
function G(str, legend){
  return str.trim().split("\n").map(row =>
    [...row].map(ch => legend[ch] ?? 0));
}

// Draw a grid (2D array of palette indices) to a canvas context.
// Applies per-frame transforms: tx/ty pixel offset, sx/sy squash/stretch, rot radians.
function drawGrid(ctx, grid, palette, px, originX, originY, transform = {}){
  const {tx=0, ty=0, sx=1, sy=1, rot=0, alpha=1, tint=null, flipX=false} = transform;
  const rows = grid.length, cols = grid[0].length;
  const w = cols * px, h = rows * px;

  ctx.save();
  ctx.globalAlpha = alpha;
  // origin is the bottom-center of the sprite on the ground plane
  ctx.translate(originX + tx, originY + ty);
  if (rot) ctx.rotate(rot);
  ctx.scale((flipX ? -1 : 1) * sx, sy);
  // draw relative so bottom-center sits on origin
  const dx = -w / 2;
  const dy = -h;

  for (let y=0;y<rows;y++){
    for (let x=0;x<cols;x++){
      const c = grid[y][x];
      if (!c) continue;
      let color = palette[c];
      if (tint){
        // tint by overlaying color; simple replacement for hit flash
        color = tint;
      }
      ctx.fillStyle = color;
      ctx.fillRect(dx + x*px, dy + y*px, px, px);
    }
  }
  ctx.restore();
}

// Iso ground contact: a small diamond anchors sprites to the same floor plane
// while the soft ellipse keeps the animation readable in thumbnails.
function drawShadow(ctx, originX, originY, w, alpha=0.5){
  ctx.save();
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(originX, originY - w * 0.18);
  ctx.lineTo(originX + w, originY);
  ctx.lineTo(originX, originY + w * 0.18);
  ctx.lineTo(originX - w, originY);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = alpha * 0.65;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(originX, originY + w * 0.06, w * 0.82, w*0.20, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   AnimatedSprite — one sprite, many states
   def = {
     name, pal, px,
     poses: { pose_key: grid },
     states: {
       idle:  { frames: [{pose, tx, ty, sx, sy, rot, tint, dur}], loop: true },
       walk:  {...}, attack: {...}, hit: {...}, die: {...}
     }
   }
============================================================ */
class AnimatedSprite {
  constructor(def){
    this.def = def;
    this.state = "idle";
    this.t = 0; // ms in current state
    this.speed = 1;
    this.facing = "DR"; // DR DL UR UL
  }
  setState(s){
    if (!this.def.states[s]) return;
    this.state = s;
    this.t = 0;
  }
  setFacing(f){ this.facing = f; }
  tick(dt){ this.t += dt * this.speed; }
  currentFrameIndex(){
    const st = this.def.states[this.state];
    const frames = st.frames;
    let acc = 0;
    let total = frames.reduce((s,f)=>s+f.dur, 0);
    let t = this.t;
    if (st.loop){
      t = t % total;
    } else if (t >= total){
      // hold last frame
      return frames.length - 1;
    }
    for (let i=0;i<frames.length;i++){
      acc += frames[i].dur;
      if (t < acc) return i;
    }
    return frames.length - 1;
  }
  currentFrame(){
    const st = this.def.states[this.state];
    return st.frames[this.currentFrameIndex()];
  }
  // All 4 facings authored independently — no mirror
  resolveFacing(){
    return {base:this.facing, flipX:false};
  }
  // Returns { grid, palette, transform } for current frame + facing
  resolved(){
    const fr = this.currentFrame();
    const {base, flipX} = this.resolveFacing();
    // poses are keyed by base-facing + pose name: e.g. "DR:idle_a"
    let poseKey = `${base}:${fr.pose}`;
    let grid = this.def.poses[poseKey];
    // fallback chain: try DR variant, then just pose
    if (!grid) grid = this.def.poses[`DR:${fr.pose}`];
    if (!grid) grid = this.def.poses[fr.pose];
    return {
      grid,
      palette: this.def.pal,
      transform: {
        tx: fr.tx||0, ty: fr.ty||0,
        sx: fr.sx ?? 1, sy: fr.sy ?? 1,
        rot: fr.rot || 0,
        alpha: fr.alpha ?? 1,
        tint: fr.tint || null,
        flipX,
      }
    };
  }
  draw(ctx, cx, cy){
    const r = this.resolved();
    if (!r.grid) return;
    // soft ground shadow (scales with stretch sx a bit)
    drawShadow(ctx, cx, cy, (this.def.shadow || 18) * (r.transform.sx||1));
    drawGrid(ctx, r.grid, r.palette, this.def.px, cx, cy, r.transform);
  }
  // render single frame at idx (for breakdown strip)
  drawFrame(ctx, cx, cy, stateName, idx){
    const st = this.def.states[stateName];
    const fr = st.frames[idx];
    const {base, flipX} = this.resolveFacing();
    let grid = this.def.poses[`${base}:${fr.pose}`];
    if (!grid) grid = this.def.poses[`DR:${fr.pose}`];
    if (!grid) grid = this.def.poses[fr.pose];
    if (!grid) return;
    drawShadow(ctx, cx, cy, 14, 0.35);
    drawGrid(ctx, grid, this.def.pal, this.def.px, cx, cy, {
      tx:fr.tx||0, ty:fr.ty||0, sx:fr.sx??1, sy:fr.sy??1,
      rot:fr.rot||0, alpha:fr.alpha??1, tint:fr.tint||null, flipX
    });
  }
  totalDuration(state){
    return this.def.states[state].frames.reduce((s,f)=>s+f.dur, 0);
  }
}

// Expose
window.AnimatedSprite = AnimatedSprite;
window.drawGrid = drawGrid;
window.drawShadow = drawShadow;
window.G = G;
