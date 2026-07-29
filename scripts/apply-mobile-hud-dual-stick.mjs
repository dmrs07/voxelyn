import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
process.chdir(root);

const replaceExact = (path, before, after, expected = 1) => {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== expected) {
    throw new Error(`${path}: expected ${expected} occurrence(s), found ${count}`);
  }
  writeFileSync(path, source.replace(before, after), 'utf8');
};

const replaceBetween = (path, startMarker, endMarker, replacement) => {
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`${path}: start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${path}: end marker not found: ${endMarker}`);
  writeFileSync(path, source.slice(0, start) + replacement + source.slice(end), 'utf8');
};

const inputPath = 'packages/voxelyn-survival/src/client/input.ts';
const renderPath = 'packages/voxelyn-survival/src/client/render.ts';
const testPath = 'packages/voxelyn-survival/src/tests/touch-cooldown.test.ts';

replaceExact(
  inputPath,
  `export const MOVE_JOYSTICK_RADIUS = 56;\nexport const AIM_JOYSTICK_RADIUS = 60;\nconst AIM_DEAD_ZONE = 0.12;`,
  `export const MOVE_JOYSTICK_RADIUS = 60;\nexport const AIM_JOYSTICK_RADIUS = 60;\nexport const TOUCH_BUTTON_HIT_SCALE = 1.08;\nconst STICK_ACTIVATION_SCALE = 1.55;\nconst MOVE_DEAD_ZONE = 0.08;\nconst AIM_DEAD_ZONE = 0.12;`,
);

replaceExact(
  inputPath,
  ` * Entrada mobile-first: joystick virtual de movimento a esquerda, joystick fixo\n * de mira/auto-fire a direita e quatro acoes acima da mira. Teclado+mouse no desktop.`,
  ` * Entrada mobile-first: joystick fixo de movimento a esquerda, joystick fixo\n * de mira/auto-fire a direita e quatro acoes separadas acima da mira.\n * Teclado+mouse continuam sendo a modalidade desktop.`,
);

replaceBetween(
  inputPath,
  `  layoutButtons(\n`,
  `\n  private readonly onKeyDown`,
  `  layoutButtons(\n    width: number,\n    height: number,\n    safeArea: Partial<Pick<TouchSafeArea, 'left' | 'right' | 'bottom'>> = {}\n  ): void {\n    const r = Math.max(24, Math.min(34, height * 0.066));\n    const horizontalInset = Math.max(18, width * 0.025);\n    const safeLeft = horizontalInset + Math.max(0, safeArea.left ?? 0);\n    const safeRight = horizontalInset + Math.max(0, safeArea.right ?? 0);\n    const safeBottom = Math.max(14, height * 0.035) + Math.max(0, safeArea.bottom ?? 0);\n    const moveX = MOVE_JOYSTICK_RADIUS + safeLeft;\n    const moveY = height - MOVE_JOYSTICK_RADIUS - safeBottom;\n    const aimX = width - AIM_JOYSTICK_RADIUS - safeRight;\n    const aimY = height - AIM_JOYSTICK_RADIUS - safeBottom;\n\n    // Os dois controles ficam ancorados: a pele visual e a area de toque sempre\n    // representam o mesmo lugar, em vez de o movimento nascer sob qualquer toque.\n    this.state.joystick.originX = moveX;\n    this.state.joystick.originY = moveY;\n    this.state.aimTouch.originX = aimX;\n    this.state.aimTouch.originY = aimY;\n\n    // Hit targets continuam grandes, mas nunca se sobrepoem. O espaco real entre\n    // eles e o que impede um polegar de acionar a acao vizinha por acidente.\n    const hitRadius = r * TOUCH_BUTTON_HIT_SCALE;\n    const gap = Math.max(14, Math.min(18, height * 0.04));\n    const step = hitRadius * 2 + gap;\n    const actionY = aimY - AIM_JOYSTICK_RADIUS - hitRadius - gap;\n    const dodgeX = aimX - AIM_JOYSTICK_RADIUS - hitRadius - gap;\n\n    this.state.buttons = [\n      { id: 'dodge', cx: dodgeX, cy: aimY, r, pressed: false },\n      { id: 'ability', cx: aimX - step * 2, cy: actionY, r, pressed: false },\n      { id: 'purge', cx: aimX - step, cy: actionY, r, pressed: false },\n      { id: 'interact', cx: aimX, cy: actionY, r, pressed: false },\n    ];\n  }\n`,
);

replaceExact(
  inputPath,
  `      if (Math.hypot(x - b.cx, y - b.cy) <= b.r * 1.25) return b;`,
  `      if (Math.hypot(x - b.cx, y - b.cy) <= b.r * TOUCH_BUTTON_HIT_SCALE) return b;`,
);

replaceBetween(
  inputPath,
  `      if (x < window.innerWidth * 0.48 && !this.state.joystick.active) {`,
  `\n\n      const aim = this.state.aimTouch;`,
  `      const move = this.state.joystick;\n      const inMoveZone =\n        Math.hypot(x - move.originX, y - move.originY) <= MOVE_JOYSTICK_RADIUS * STICK_ACTIVATION_SCALE;\n      if (inMoveZone && !move.active) {\n        move.active = true;\n        move.pointerId = e.pointerId;\n        this.updateMoveTouch(x, y);\n        return;\n      }`,
);

replaceExact(
  inputPath,
  `  private updateAimTouch(x: number, y: number): void {`,
  `  private updateMoveTouch(x: number, y: number): void {\n    const move = this.state.joystick;\n    const dx = x - move.originX;\n    const dy = y - move.originY;\n    const len = Math.hypot(dx, dy);\n    const clamp = Math.min(1, len / MOVE_JOYSTICK_RADIUS);\n\n    if (clamp <= MOVE_DEAD_ZONE || len <= 2) {\n      move.dx = 0;\n      move.dy = 0;\n      return;\n    }\n\n    move.dx = (dx / len) * clamp;\n    move.dy = (dy / len) * clamp;\n  }\n\n  private updateAimTouch(x: number, y: number): void {`,
);

replaceExact(
  inputPath,
  `      if (this.state.joystick.active && e.pointerId === this.state.joystick.pointerId) {\n        const dx = e.clientX - this.state.joystick.originX;\n        const dy = e.clientY - this.state.joystick.originY;\n        const len = Math.hypot(dx, dy);\n        const clamp = Math.min(1, len / MOVE_JOYSTICK_RADIUS);\n        if (len > 2) {\n          this.state.joystick.dx = (dx / len) * clamp;\n          this.state.joystick.dy = (dy / len) * clamp;\n        }\n      } else if (this.state.aimTouch.active && e.pointerId === this.state.aimTouch.pointerId) {`,
  `      if (this.state.joystick.active && e.pointerId === this.state.joystick.pointerId) {\n        this.updateMoveTouch(e.clientX, e.clientY);\n      } else if (this.state.aimTouch.active && e.pointerId === this.state.aimTouch.pointerId) {`,
);

replaceExact(
  renderPath,
  `          drawHealthBar(psx, psy - size * 2.4 - 5 * z, size, pl.hp / pl.maxHp);`,
  `          // O Prospector local ja tem HP numerico na HUD fixa. Repetir a barra\n          // sobre a propria cabeca cobre animacao e mira; o parceiro ainda precisa\n          // dela para coordenacao de revive no co-op.\n          if (!isLocal) drawHealthBar(psx, psy - size * 2.4 - 5 * z, size, pl.hp / pl.maxHp);`,
);

replaceExact(
  renderPath,
  `    const target = { x: this.safeArea.left + 22, y: this.safeArea.top + 53 };`,
  `    const target = { x: this.safeArea.left + 30, y: this.safeArea.top + 67 };`,
);

replaceBetween(
  renderPath,
  `    const safeTop = this.safeArea.top + 10;`,
  `    // mensagens centrais`,
  `    const safeTop = this.safeArea.top + 10;\n    const safeLeft = this.safeArea.left + 12;\n    ctx.textBaseline = 'alphabetic';\n\n    // Contaminacao continua sendo a unica faixa presa ao topo inteiro.\n    ctx.fillStyle = 'rgba(0,0,0,0.4)';\n    ctx.fillRect(0, 0, vw, 3);\n    ctx.fillStyle = PAL.acid;\n    ctx.fillRect(0, 0, vw * state.contamination, 3);\n\n    const revealed = state.salvageSites\n      .filter((site) => site.cacheRevealed && !site.cacheOpened)\n      .sort((a, b) => {\n        const da = Math.hypot(a.cache.x + 0.5 - state.player.x, a.cache.y + 0.5 - state.player.y);\n        const db = Math.hypot(b.cache.x + 0.5 - state.player.x, b.cache.y + 0.5 - state.player.y);\n        return da - db;\n      })[0];\n\n    const hasModules = extra.activeModules.length > 0;\n    const panelW = Math.min(300, Math.max(230, vw * 0.34));\n    const moduleY = safeTop + 68;\n    const sectorY = safeTop + (hasModules ? 112 : 84);\n    const objectiveY = sectorY + 18;\n    const cacheY = objectiveY + 17;\n    const panelH = (revealed ? cacheY : objectiveY) - safeTop + 13;\n\n    const roundedPanel = (x: number, y: number, w: number, h: number, radius: number): void => {\n      const r = Math.min(radius, w / 2, h / 2);\n      ctx.beginPath();\n      ctx.moveTo(x + r, y);\n      ctx.lineTo(x + w - r, y);\n      ctx.quadraticCurveTo(x + w, y, x + w, y + r);\n      ctx.lineTo(x + w, y + h - r);\n      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);\n      ctx.lineTo(x + r, y + h);\n      ctx.quadraticCurveTo(x, y + h, x, y + h - r);\n      ctx.lineTo(x, y + r);\n      ctx.quadraticCurveTo(x, y, x + r, y);\n      ctx.closePath();\n    };\n\n    roundedPanel(safeLeft, safeTop, panelW, panelH, 12);\n    ctx.fillStyle = 'rgba(11,14,20,0.78)';\n    ctx.fill();\n    ctx.strokeStyle = 'rgba(232,241,255,0.32)';\n    ctx.lineWidth = 1.25;\n    ctx.stroke();\n\n    // Coracao voxel + HP numerico: a vida do jogador vive somente aqui.\n    const heartX = safeLeft + 20;\n    const heartY = safeTop + 21;\n    ctx.fillStyle = state.player.hp / state.player.maxHp > 0.35 ? PAL.fungusLight : PAL.blood;\n    ctx.fillRect(heartX - 8, heartY - 7, 6, 6);\n    ctx.fillRect(heartX + 2, heartY - 7, 6, 6);\n    ctx.fillRect(heartX - 10, heartY - 3, 20, 7);\n    ctx.fillRect(heartX - 6, heartY + 4, 12, 4);\n    ctx.fillRect(heartX - 2, heartY + 8, 4, 4);\n\n    const hpFrac = Math.max(0, Math.min(1, state.player.hp / state.player.maxHp));\n    const hpBarX = safeLeft + 42;\n    const hpBarY = safeTop + 14;\n    const hpBarW = panelW - 54;\n    const hpBarH = 14;\n    ctx.fillStyle = 'rgba(0,0,0,0.62)';\n    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);\n    ctx.fillStyle = hpFrac > 0.35 ? PAL.fungusLight : PAL.blood;\n    ctx.fillRect(hpBarX + 1, hpBarY + 1, (hpBarW - 2) * hpFrac, hpBarH - 2);\n    ctx.strokeStyle = 'rgba(232,241,255,0.24)';\n    ctx.lineWidth = 1;\n    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);\n    ctx.fillStyle = PAL.player;\n    ctx.font = 'bold 10px monospace';\n    ctx.textAlign = 'right';\n    ctx.fillText(\n      `${Math.max(0, Math.ceil(state.player.hp))} / ${Math.ceil(state.player.maxHp)}`,\n      hpBarX + hpBarW - 5,\n      hpBarY + 11\n    );\n\n    // Calor permanece legivel, mas como trilho secundario dentro do mesmo painel.\n    const heatFrac = Math.min(1, extra.heat / HEAT_MAX);\n    ctx.fillStyle = 'rgba(0,0,0,0.58)';\n    ctx.fillRect(hpBarX, safeTop + 32, hpBarW, 4);\n    ctx.fillStyle = state.tick < extra.overheatedUntil ? PAL.blood : PAL.fire;\n    ctx.fillRect(hpBarX, safeTop + 32, hpBarW * heatFrac, 4);\n\n    ctx.strokeStyle = 'rgba(232,241,255,0.17)';\n    ctx.beginPath();\n    ctx.moveTo(safeLeft + 12, safeTop + 43);\n    ctx.lineTo(safeLeft + panelW - 12, safeTop + 43);\n    ctx.stroke();\n\n    const purgePulse = nowMs < this.purgePulseUntil;\n    const purgeY = safeTop + 57;\n    ctx.font = `bold ${purgePulse ? 13 : 12}px monospace`;\n    ctx.textAlign = 'left';\n    ctx.fillStyle = purgePulse ? PAL.biolum : PAL.bone;\n    drawPurgeCellGlyph(ctx, safeLeft + 18, purgeY, purgePulse ? 15 : 13, ctx.fillStyle as string);\n    ctx.fillText(`CÉLULA DE PURGA ×${extra.purgeCells}`, safeLeft + 34, purgeY + 4);\n\n    if (hasModules) {\n      this.renderModuleHud(\n        extra.activeModules, state.tick, nowMs, safeLeft + 12, moduleY, safeLeft + panelW\n      );\n    }\n\n    const lowerDividerY = safeTop + (hasModules ? 104 : 75);\n    ctx.strokeStyle = 'rgba(232,241,255,0.17)';\n    ctx.beginPath();\n    ctx.moveTo(safeLeft + 12, lowerDividerY);\n    ctx.lineTo(safeLeft + panelW - 12, lowerDividerY);\n    ctx.stroke();\n\n    ctx.textAlign = 'left';\n    ctx.fillStyle = PAL.rockLight;\n    ctx.font = '11px monospace';\n    ctx.fillText(`SETOR ${state.sector}/${SECTOR_COUNT}`, safeLeft + 12, sectorY);\n\n    ctx.fillStyle = PAL.loot;\n    ctx.font = 'bold 12px monospace';\n    const objective = !isFinalSector(state.sector)\n      ? 'DESÇA PELO POÇO'\n      : extra.hasCore\n        ? 'VOLTE PARA A ENTRADA'\n        : state.coreTaken\n          ? 'EXTRAIA NA ENTRADA'\n          : 'ENCONTRE O NÚCLEO';\n    ctx.fillText(objective, safeLeft + 12, objectiveY);\n\n    if (revealed) {\n      const dx = revealed.cache.x + 0.5 - state.player.x;\n      const dy = revealed.cache.y + 0.5 - state.player.y;\n      const direction = Math.abs(dx) > Math.abs(dy)\n        ? (dx > 0 ? 'LESTE' : 'OESTE')\n        : (dy > 0 ? 'SUL' : 'NORTE');\n      ctx.fillStyle = PAL.biolum;\n      ctx.fillText(`COFRE: ${direction} · ~${Math.round(Math.hypot(dx, dy))}m`, safeLeft + 12, cacheY);\n    }\n\n`,
);

replaceBetween(
  renderPath,
  `    // controles touch: movimento livre a esquerda, mira fixa 360 graus a direita.`,
  `\n  private renderModuleHud(`,
  `    // Controles touch: mesma pele nos dois lados; esquerda move, direita mira\n    // e atira. O reticulo e a unica diferenca semantica necessaria.\n    if (input.usingTouch) {\n      const drawJoystick = (\n        stick: InputState['joystick'] | InputState['aimTouch'],\n        radius: number,\n        shooting: boolean\n      ): void => {\n        const accent = shooting ? PAL.biolum : PAL.player;\n        const activeAlpha = stick.active ? 0.76 : 0.42;\n        const travel = radius * 0.55;\n        const knobX = stick.originX + (stick.active ? stick.dx * travel : 0);\n        const knobY = stick.originY + (stick.active ? stick.dy * travel : 0);\n        const knobR = radius * 0.36;\n\n        ctx.save();\n        ctx.fillStyle = 'rgba(11,14,20,0.42)';\n        ctx.beginPath();\n        ctx.arc(stick.originX, stick.originY, radius, 0, Math.PI * 2);\n        ctx.fill();\n        ctx.strokeStyle = `rgba(232,241,255,${stick.active ? 0.62 : 0.38})`;\n        ctx.lineWidth = stick.active ? 2.2 : 1.6;\n        ctx.stroke();\n\n        ctx.beginPath();\n        ctx.arc(stick.originX, stick.originY, radius * 0.84, 0, Math.PI * 2);\n        ctx.strokeStyle = shooting\n          ? `rgba(89,242,194,${stick.active ? 0.45 : 0.22})`\n          : `rgba(232,241,255,${stick.active ? 0.35 : 0.18})`;\n        ctx.lineWidth = 1;\n        ctx.stroke();\n\n        // Quatro marcas direcionais fazem a base parecer um controle, nao um botao.\n        ctx.fillStyle = `rgba(232,241,255,${stick.active ? 0.45 : 0.24})`;\n        for (let i = 0; i < 4; i++) {\n          ctx.save();\n          ctx.translate(stick.originX, stick.originY);\n          ctx.rotate(i * Math.PI / 2);\n          ctx.beginPath();\n          ctx.moveTo(0, -radius * 0.76);\n          ctx.lineTo(-4, -radius * 0.66);\n          ctx.lineTo(4, -radius * 0.66);\n          ctx.closePath();\n          ctx.fill();\n          ctx.restore();\n        }\n\n        ctx.fillStyle = shooting\n          ? `rgba(89,242,194,${stick.active ? 0.28 : 0.12})`\n          : `rgba(232,241,255,${stick.active ? 0.24 : 0.12})`;\n        ctx.beginPath();\n        ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);\n        ctx.fill();\n        ctx.strokeStyle = accent;\n        ctx.globalAlpha = activeAlpha;\n        ctx.lineWidth = 1.6;\n        ctx.stroke();\n        ctx.globalAlpha = 1;\n\n        if (shooting) {\n          const reticle = knobR * 0.48;\n          ctx.strokeStyle = `rgba(89,242,194,${stick.active ? 0.9 : 0.58})`;\n          ctx.lineWidth = 1.5;\n          ctx.beginPath();\n          ctx.arc(knobX, knobY, reticle * 0.58, 0, Math.PI * 2);\n          ctx.moveTo(knobX - reticle, knobY);\n          ctx.lineTo(knobX - reticle * 0.35, knobY);\n          ctx.moveTo(knobX + reticle * 0.35, knobY);\n          ctx.lineTo(knobX + reticle, knobY);\n          ctx.moveTo(knobX, knobY - reticle);\n          ctx.lineTo(knobX, knobY - reticle * 0.35);\n          ctx.moveTo(knobX, knobY + reticle * 0.35);\n          ctx.lineTo(knobX, knobY + reticle);\n          ctx.stroke();\n        } else {\n          ctx.fillStyle = `rgba(232,241,255,${stick.active ? 0.72 : 0.4})`;\n          ctx.beginPath();\n          ctx.arc(knobX, knobY, 3.2, 0, Math.PI * 2);\n          ctx.fill();\n        }\n        ctx.restore();\n      };\n\n      drawJoystick(input.joystick, MOVE_JOYSTICK_RADIUS, false);\n      drawJoystick(input.aimTouch, AIM_JOYSTICK_RADIUS, true);\n\n      for (const b of input.buttons) {\n        ctx.fillStyle = b.pressed ? 'rgba(255,209,102,0.5)' : 'rgba(11,14,20,0.52)';\n        ctx.beginPath();\n        ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2);\n        ctx.fill();\n        ctx.strokeStyle = b.pressed ? PAL.loot : 'rgba(232,241,255,0.5)';\n        ctx.lineWidth = b.pressed ? 2.2 : 1.5;\n        ctx.stroke();\n        ctx.beginPath();\n        ctx.arc(b.cx, b.cy, b.r * 0.82, 0, Math.PI * 2);\n        ctx.strokeStyle = b.pressed ? 'rgba(255,209,102,0.5)' : 'rgba(232,241,255,0.16)';\n        ctx.lineWidth = 1;\n        ctx.stroke();\n\n        const iconColor = b.pressed ? PAL.loot : 'rgba(232,241,255,0.9)';\n        const drewIcon = this.touchIcons.draw(ctx, b.id, b.cx, b.cy, b.r * 1.05, iconColor);\n        if (!drewIcon) {\n          ctx.fillStyle = iconColor;\n          ctx.beginPath();\n          ctx.moveTo(b.cx, b.cy - b.r * 0.28);\n          ctx.lineTo(b.cx + b.r * 0.28, b.cy);\n          ctx.lineTo(b.cx, b.cy + b.r * 0.28);\n          ctx.lineTo(b.cx - b.r * 0.28, b.cy);\n          ctx.closePath();\n          ctx.fill();\n        }\n      }\n    }\n  }\n`,
);

replaceExact(
  testPath,
  `import { deactivateTouchControls, SurvivalInput } from '../client/input';`,
  `import {\n  AIM_JOYSTICK_RADIUS,\n  MOVE_JOYSTICK_RADIUS,\n  TOUCH_BUTTON_HIT_SCALE,\n  deactivateTouchControls,\n  SurvivalInput,\n} from '../client/input';`,
);

const testSource = readFileSync(testPath, 'utf8');
const finalClose = testSource.lastIndexOf('\n});');
if (finalClose < 0) throw new Error(`${testPath}: final describe close not found`);
const layoutRegression = `\n\n  it('ancora sticks simetricos e separa todas as hitboxes de acao', () => {\n    const input = new SurvivalInput({} as HTMLCanvasElement);\n    const width = 844;\n    const height = 390;\n    const safeLeft = 28;\n    const safeRight = 44;\n    const safeBottom = 21;\n\n    input.layoutButtons(width, height, { left: safeLeft, right: safeRight, bottom: safeBottom });\n\n    const move = input.state.joystick;\n    const aim = input.state.aimTouch;\n    expect(move.originX - MOVE_JOYSTICK_RADIUS).toBeGreaterThanOrEqual(safeLeft);\n    expect(aim.originX + AIM_JOYSTICK_RADIUS).toBeLessThanOrEqual(width - safeRight);\n    expect(move.originY).toBe(aim.originY);\n    expect(move.originX).toBeLessThan(width / 2);\n    expect(aim.originX).toBeGreaterThan(width / 2);\n\n    for (let i = 0; i < input.state.buttons.length; i++) {\n      const a = input.state.buttons[i]!;\n      const aHit = a.r * TOUCH_BUTTON_HIT_SCALE;\n      const distanceFromAim = Math.hypot(a.cx - aim.originX, a.cy - aim.originY);\n      expect(distanceFromAim).toBeGreaterThanOrEqual(AIM_JOYSTICK_RADIUS + aHit + 10);\n\n      for (let j = i + 1; j < input.state.buttons.length; j++) {\n        const b = input.state.buttons[j]!;\n        const gap = Math.hypot(a.cx - b.cx, a.cy - b.cy) -\n          (aHit + b.r * TOUCH_BUTTON_HIT_SCALE);\n        expect(gap).toBeGreaterThanOrEqual(10);\n      }\n    }\n  });`;
writeFileSync(testPath, testSource.slice(0, finalClose) + layoutRegression + testSource.slice(finalClose), 'utf8');

execFileSync('git', ['diff', '--check'], { stdio: 'inherit' });
console.log('mobile HUD and dual-stick patch applied');
