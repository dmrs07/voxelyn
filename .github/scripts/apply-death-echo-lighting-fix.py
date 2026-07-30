from pathlib import Path

root = Path(__file__).resolve().parents[2]
render_path = root / 'packages/voxelyn-survival/src/client/render.ts'
test_path = root / 'packages/voxelyn-survival/src/client/death-echo-presentation.test.ts'


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:100]!r}')
    path.write_text(text.replace(old, new))


replace_once(
    render_path,
    "export class SurvivalRenderer {\n",
    "export const deathEchoBodyAlpha = (light: number): number =>\n"
    "  light <= 0.05 ? 0 : Math.min(1, 0.15 + Math.max(0, light) * 0.85);\n\n"
    "export class SurvivalRenderer {\n",
)

replace_once(
    render_path,
    "    for (const echo of this.deathEchoes) {\n"
    "      const [esx, esy] = toScreen(echo.x, echo.y);\n"
    "      if (esx < -80 || esx > vw + 80 || esy < -100 || esy > vh + 80) continue;\n"
    "      items.push({\n"
    "        depth: echo.x + echo.y,\n"
    "        draw: () => this.drawDeathEchoBody(echo, esx, esy, z, spriteZoom, nowMs),\n"
    "      });\n"
    "    }\n",
    "    for (const echo of this.deathEchoes) {\n"
    "      const [esx, esy] = toScreen(echo.x, echo.y);\n"
    "      if (esx < -80 || esx > vw + 80 || esy < -100 || esy > vh + 80) continue;\n"
    "      const bodyAlpha = deathEchoBodyAlpha(brightness(echo.x, echo.y));\n"
    "      items.push({\n"
    "        depth: echo.x + echo.y,\n"
    "        draw: () => this.drawDeathEchoBody(echo, esx, esy, z, spriteZoom, nowMs, bodyAlpha),\n"
    "      });\n"
    "    }\n",
)

old_method = """  private drawDeathEchoBody(
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    nowMs: number,
  ): void {
    const ctx = this.ctx;
    const size = 0.34 * TILE_W * 0.9 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const drew = this.sprites.drawEntity(
      ctx,
      'prospector',
      'die',
      echo.facingX,
      echo.facingY,
      10_000,
      sx,
      sy,
      spriteZoom,
      { color: 'rgba(110,74,51,0.62)', alpha: 0.62 },
    );
    if (!drew) {
      ctx.fillStyle = PAL.rust;
      ctx.fillRect(sx - 9 * z, sy - 5 * z, 16 * z, 4 * z);
      ctx.fillStyle = PAL.rockShadow;
      ctx.fillRect(sx - 6 * z, sy - 8 * z, 7 * z, 4 * z);
      ctx.fillStyle = PAL.player;
      ctx.fillRect(sx - 5 * z, sy - 7 * z, 2 * z, z);
    }

    const pulse = Math.sin(nowMs * 0.008 + echo.cell * 0.17) > -0.2;
    ctx.fillStyle = pulse ? PAL.biolum : PAL.rockShadow;
    ctx.fillRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
    ctx.strokeStyle = PAL.dark;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
  }
"""
new_method = """  private drawDeathEchoBody(
    echo: PlacedDeathEcho,
    sx: number,
    sy: number,
    z: number,
    spriteZoom: number,
    nowMs: number,
    bodyAlpha: number,
  ): void {
    const ctx = this.ctx;
    if (bodyAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = bodyAlpha;
      const size = 0.34 * TILE_W * 0.9 * z;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(sx, sy, size, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const drew = this.sprites.drawEntity(
        ctx,
        'prospector',
        'die',
        echo.facingX,
        echo.facingY,
        10_000,
        sx,
        sy,
        spriteZoom,
        { color: 'rgba(110,74,51,0.62)', alpha: 0.62 },
      );
      if (!drew) {
        ctx.fillStyle = PAL.rust;
        ctx.fillRect(sx - 9 * z, sy - 5 * z, 16 * z, 4 * z);
        ctx.fillStyle = PAL.rockShadow;
        ctx.fillRect(sx - 6 * z, sy - 8 * z, 7 * z, 4 * z);
        ctx.fillStyle = PAL.player;
        ctx.fillRect(sx - 5 * z, sy - 7 * z, 2 * z, z);
      }
      ctx.restore();
    }

    // A caixa-preta continua emissiva: ela pode denunciar que há algo no escuro,
    // mas não revela a silhueta inteira nem atravessa a regra de iluminação.
    const pulse = Math.sin(nowMs * 0.008 + echo.cell * 0.17) > -0.2;
    ctx.fillStyle = pulse ? PAL.biolum : PAL.rockShadow;
    ctx.fillRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
    ctx.strokeStyle = PAL.dark;
    ctx.lineWidth = Math.max(1, z * 0.6);
    ctx.strokeRect(sx + 2 * z, sy - 7 * z, 3 * z, 3 * z);
  }
"""
replace_once(render_path, old_method, new_method)

replace_once(
    test_path,
    "import { SurvivalRenderer } from './render';\n",
    "import { SurvivalRenderer, deathEchoBodyAlpha } from './render';\n",
)
replace_once(
    test_path,
    "  it('prefere não mostrar a cobrir o HUD numa viewport curta', () => {\n"
    "    expect(deathEchoReadoutRegion(320, 140, safeArea, hud)).toBeNull();\n"
    "  });\n",
    "  it('prefere não mostrar a cobrir o HUD numa viewport curta', () => {\n"
    "    expect(deathEchoReadoutRegion(320, 140, safeArea, hud)).toBeNull();\n"
    "  });\n\n"
    "  it('não revela a carcaça fora da luz, mas escala sua opacidade quando iluminada', () => {\n"
    "    expect(deathEchoBodyAlpha(0.04)).toBe(0);\n"
    "    expect(deathEchoBodyAlpha(0.2)).toBeGreaterThan(0);\n"
    "    expect(deathEchoBodyAlpha(0.2)).toBeLessThan(deathEchoBodyAlpha(0.8));\n"
    "    expect(deathEchoBodyAlpha(1)).toBe(1);\n"
    "  });\n",
)
