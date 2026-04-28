/* ============================================================
   Voxelyn Sprite UI
============================================================ */
(function(){
  const sprites = window.VOXELYN_SPRITES;
  const grid = document.getElementById("spriteGrid");

  // Global play/speed state
  let playing = true;
  let globalSpeed = 1;
  let lastTs = performance.now();

  // Per-card state: AnimatedSprite + current state + facing
  const cards = [];

  // Build card for each sprite def
  sprites.forEach((def, i) => {
    const spr = new AnimatedSprite(def);
    spr.setState("idle");

    const card = document.createElement("article");
    card.className = "sprite-card";
    card.innerHTML = `
      <div class="sc-head">
        <b>${def.name}</b>
        <span class="id">${def.id} · 32×32 · 4 fac · 5 st</span>
      </div>
      <div class="sc-body">
        <div class="stage">
          <div class="grid-lines"></div>
          <span class="state-badge" data-role="state-badge">idle</span>
          <span class="facing-badge" data-role="facing-badge">DR</span>
          <span class="fps-badge" data-role="fps-badge"></span>
          <canvas width="192" height="192" data-role="live"></canvas>
        </div>
        <div class="breakdown">
          <div class="label">Frame breakdown</div>
          <div class="frames" data-role="frames"></div>
        </div>
        <div class="facings">
          <div class="facing"><span class="lbl">DR</span><canvas width="72" height="72" data-role="fac-DR"></canvas></div>
          <div class="facing"><span class="lbl">DL</span><canvas width="72" height="72" data-role="fac-DL"></canvas></div>
          <div class="facing"><span class="lbl">UR</span><canvas width="72" height="72" data-role="fac-UR"></canvas></div>
          <div class="facing"><span class="lbl">UL</span><canvas width="72" height="72" data-role="fac-UL"></canvas></div>
        </div>
        <div class="scrubber">
          <div class="state-pills" data-role="pills">
            ${["idle","walk","attack","hit","die"].map(s=>`<button data-state="${s}" class="${s==='idle'?'on':''}">${s}</button>`).join("")}
          </div>
          <input type="range" min="0" max="1000" value="0" data-role="scrub">
          <span class="frame-count" data-role="count"></span>
        </div>
      </div>
    `;
    grid.appendChild(card);

    const ctx = card.querySelector("[data-role=live]").getContext("2d");
    ctx.imageSmoothingEnabled = false;
    const facingBadge = card.querySelector("[data-role=facing-badge]");
    const stateBadge  = card.querySelector("[data-role=state-badge]");
    const fpsBadge    = card.querySelector("[data-role=fps-badge]");
    const framesHost  = card.querySelector("[data-role=frames]");
    const scrub       = card.querySelector("[data-role=scrub]");
    const countEl     = card.querySelector("[data-role=count]");
    const pills       = card.querySelectorAll("[data-role=pills] button");
    const facCtxs     = {};
    for (const f of ["DR","DL","UR","UL"]){
      const c = card.querySelector(`[data-role=fac-${f}]`);
      const cx = c.getContext("2d"); cx.imageSmoothingEnabled=false;
      facCtxs[f] = cx;
    }

    pills.forEach(btn => btn.addEventListener("click", () => {
      pills.forEach(b=>b.classList.remove("on"));
      btn.classList.add("on");
      spr.setState(btn.dataset.state);
      stateBadge.textContent = btn.dataset.state;
      rebuildBreakdown();
    }));

    // Cycle facings on canvas click
    card.querySelector("[data-role=live]").addEventListener("click", () => {
      const order = ["DR","DL","UL","UR"];
      const next = order[(order.indexOf(spr.facing)+1) % 4];
      spr.setFacing(next);
      facingBadge.textContent = next;
      rebuildBreakdown();
    });

    scrub.addEventListener("input", () => {
      playing = false;
      document.getElementById("playAll").classList.remove("active");
      document.getElementById("pauseAll").classList.add("active");
      const total = spr.totalDuration(spr.state);
      spr.t = (parseInt(scrub.value,10) / 1000) * total;
    });

    function rebuildBreakdown(){
      framesHost.innerHTML = "";
      const st = def.states[spr.state];
      st.frames.forEach((fr, idx) => {
        const fd = document.createElement("div");
        fd.className = "frame" + (fr.tag ? " key" : "");
        fd.innerHTML = `<span class="idx">${idx}</span>` +
                       (fr.tag ? `<span class="tag">${fr.tag}</span>` : "");
        const c = document.createElement("canvas");
        c.width = 48; c.height = 48;
        fd.appendChild(c);
        framesHost.appendChild(fd);
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        spr.drawFrame(cx, 24, 44, spr.state, idx);
      });
      countEl.textContent = `${st.frames.length} fr · ${spr.totalDuration(spr.state)}ms`;
    }
    rebuildBreakdown();

    // Static facing thumbs — redraw when state changes via rebuildBreakdown
    function drawFacings(){
      for (const f of ["DR","DL","UR","UL"]){
        const cx = facCtxs[f];
        cx.clearRect(0,0,72,72);
        // draw idle-a of each facing
        const grid2 = def.poses[`${f}:idle_a`];
        if (grid2){
          drawShadow(cx, 36, 62, 14, 0.35);
          drawGrid(cx, grid2, def.pal, def.px, 36, 62, {});
        }
      }
    }
    drawFacings();

    cards.push({ spr, ctx, card, scrub, stateBadge, fpsBadge, facingBadge, rebuildBreakdown });
  });

  // ===== Animation loop =====
  function loop(ts){
    const dt = Math.min(100, ts - lastTs);
    lastTs = ts;
    if (playing){
      for (const c of cards){
        c.spr.speed = globalSpeed;
        c.spr.tick(dt);
        // update scrubber position
        const total = c.spr.totalDuration(c.spr.state);
        c.scrub.value = Math.min(1000, Math.floor((c.spr.t % total) / total * 1000));
      }
    }
    // draw
    for (const c of cards){
      c.ctx.clearRect(0,0,192,192);
      c.spr.draw(c.ctx, 96, 160);
      c.fpsBadge.textContent = c.spr.state + " · fr " + c.spr.currentFrameIndex();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ===== Toolbar =====
  document.getElementById("playAll").addEventListener("click", () => {
    playing = true;
    document.getElementById("playAll").classList.add("active");
    document.getElementById("pauseAll").classList.remove("active");
  });
  document.getElementById("pauseAll").addEventListener("click", () => {
    playing = false;
    document.getElementById("playAll").classList.remove("active");
    document.getElementById("pauseAll").classList.add("active");
  });
  document.querySelectorAll(".spd button").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".spd button").forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      globalSpeed = parseFloat(b.dataset.speed);
    });
  });

  // ===== Export PNG sheets =====
  document.getElementById("exportPngs").addEventListener("click", async () => {
    for (const def of sprites){
      const rows = ["idle","walk","attack","hit","die"];
      const facings = ["DR","DL","UR","UL"];
      const maxFrames = Math.max(...rows.map(s => def.states[s].frames.length));
      const cell = 48;
      const cols = maxFrames;
      // 4 facings * 5 rows = 20 rows
      const rowsTotal = facings.length * rows.length;
      const canvas = document.createElement("canvas");
      canvas.width = cols * cell;
      canvas.height = rowsTotal * cell;
      const cx = canvas.getContext("2d");
      cx.imageSmoothingEnabled = false;
      // black bg
      cx.fillStyle = "#050913"; cx.fillRect(0,0,canvas.width,canvas.height);
      const tmpSpr = new AnimatedSprite(def);
      facings.forEach((f, fi) => {
        tmpSpr.setFacing(f);
        rows.forEach((s, ri) => {
          def.states[s].frames.forEach((fr, idx) => {
            const x = idx*cell, y = (fi*rows.length + ri)*cell;
            cx.save();
            cx.translate(x, y);
            tmpSpr.drawFrame(cx, cell/2, cell-4, s, idx);
            cx.restore();
          });
        });
      });
      // Download
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `voxelyn-${def.name.toLowerCase().replace(/\s+/g,"_")}.png`;
      a.click();
      await new Promise(r=>setTimeout(r,150));
    }
  });

  // ===== Export JSON =====
  document.getElementById("exportJson").addEventListener("click", () => {
    const out = sprites.map(def => ({
      name: def.name, id: def.id,
      size: 32, facings: ["DR","DL","UR","UL"],
      states: Object.fromEntries(Object.entries(def.states).map(([k,v]) => [k, {
        loop: v.loop,
        frames: v.frames.map((f,i)=>({
          index:i, pose:f.pose, dur:f.dur,
          transform:{ tx:f.tx||0, ty:f.ty||0, sx:f.sx??1, sy:f.sy??1,
                      rot:f.rot||0, alpha:f.alpha??1 },
          tag: f.tag || null, tint: f.tint || null
        }))
      }])),
    }));
    const blob = new Blob([JSON.stringify(out, null, 2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "voxelyn-sprites.json";
    a.click();
  });
})();
