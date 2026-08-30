// Harness de verificacao visual do sistema de salvamento (dev-only).
//
// Igual ao sprite-viewer no espirito: nada daqui entra no jogo — e uma pagina
// para OLHAR o resultado com o renderer de verdade. Monta uma run real com
// `createRun`, forca o estado que a URL pede (classe do cofre, escolha
// pendente, alvos do localizador) e desenha em loop. Nao ha stepRun: o mundo
// fica parado para a captura, e tudo que anima por `nowMs` continua animando.

import { createRun, type ModuleId, type SurvivalState } from '@voxelyn/survival-sim';
import { SurvivalRenderer } from './render';
import { SurvivalInput } from './input';
import { loadQuality } from './settings';
import { drawModuleHardware } from './module-hardware';
import { modulePresentation } from './module-presentation';
import type { CacheTier } from './salvage-presentation';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const scene = params.get('scene') ?? 'world';
const tier = (Math.max(1, Math.min(3, Number(params.get('tier') ?? 1))) || 1) as CacheTier;
const opened = params.get('opened') === '1';

const pickSeed = (): SurvivalState => {
  // Seeds ate achar uma run com sites de salvamento (o worldgen exige >= 3).
  for (let seed = Number(params.get('seed') ?? 20260818); ; seed++) {
    const state = createRun({
      seed,
      sector: 1,
      depth: { generation: 'G-01', sectorCount: 2, coreSectors: [2] },
    });
    if (state.salvageSites.length > 0) return state;
  }
};

const state = pickSeed();
state.enemies = [];

const site = state.salvageSites[0];
site.tier = tier;
site.terminalState = 'complete';
site.cacheRevealed = true;
site.cacheOpened = opened;

if (scene === 'world') {
  // Jogador ao lado do cofre: a lanterna dele e o que ilumina o prop.
  state.player.x = site.cache.x + 2.5;
  state.player.y = site.cache.y + 2.5;
} else if (scene === 'locator') {
  // O cofre a um deslocamento de MUNDO (dx, dy) do jogador; `orbit=1` faz o
  // jogador circular o cofre para ver o marcador percorrer o anel inteiro.
  const dist = Number(params.get('dist') ?? 12);
  const angle = (Number(params.get('angle') ?? 0) * Math.PI) / 180;
  state.player.x = site.cache.x + 0.5 - Math.cos(angle) * dist;
  state.player.y = site.cache.y + 0.5 - Math.sin(angle) * dist;
  // Cofres extras revelados para o teste de multiplos sinais.
  const extra = Math.min(Number(params.get('extra') ?? 0), state.salvageSites.length - 1);
  for (let i = 1; i <= extra; i++) {
    const other = state.salvageSites[i];
    other.cacheRevealed = true;
    other.cacheOpened = false;
    other.tier = ((i % 3) + 1) as CacheTier;
  }
} else if (scene === 'shot') {
  // Um tiro do jogador em voo continuo, para OLHAR a serpente do sifao (ou
  // qualquer combinacao de modulos via ?mods=siphon,ricochet). O projetil e
  // sintetico e re-animado em loop pelo quadro — nada de stepRun.
  state.player.x = site.cache.x + 6.5;
  state.player.y = site.cache.y + 6.5;
  const mods = (params.get('mods') ?? 'siphon').split(',');
  const projectileModules: Record<string, unknown> = {};
  if (mods.includes('siphon')) {
    projectileModules.siphon = true;
    state.playerExtra.activeModules.push({
      id: 'siphon',
      lifetime: { kind: 'charges', remaining: 80, maximum: 80 },
    });
  }
  if (mods.includes('ricochet')) projectileModules.ricochet = { remainingBounces: 1 };
  if (mods.includes('piercing')) projectileModules.piercing = true;
  state.projectiles.push({
    kind: 'bolt',
    id: 900001,
    owner: 1,
    x: state.player.x,
    y: state.player.y,
    vx: 0,
    vy: 0,
    damage: 0,
    modules: projectileModules,
    distanceTravelled: 0,
    hostile: false,
    leavesBiofluid: false,
  } as (typeof state.projectiles)[number]);
} else if (scene === 'choice') {
  const a = (params.get('a') ?? 'ricochet') as ModuleId;
  const b = (params.get('b') ?? 'siphon') as ModuleId;
  state.player.x = site.cache.x + 2.5;
  state.player.y = site.cache.y + 2.5;
  site.cacheOpened = true;
  state.playerExtra.pendingModuleChoice = {
    sourceSiteId: site.id,
    options: [a, b],
    createdAtTick: state.tick,
  };
  const owned = params.get('owned') as ModuleId | null;
  if (owned) {
    state.playerExtra.activeModules.push({
      id: owned,
      lifetime: { kind: 'charges', remaining: 31, maximum: 80 },
    });
  }
}

const renderer = new SurvivalRenderer(canvas);
renderer.setLocalPlayerId(1);
renderer.setQuality(loadQuality());
const input = new SurvivalInput(canvas);

const resize = (): void => {
  renderer.setSafeArea({ top: 0, right: 0, bottom: 0, left: 0 });
  renderer.resize();
};
window.addEventListener('resize', resize);
resize();

const drawHardwareSheet = (nowMs: number): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, vw, vh);
  const ids: ModuleId[] = [
    'piercing',
    'conductive',
    'explosive',
    'siphon',
    'ricochet',
    'return_disc',
    'minigun',
  ];
  const cols = 4;
  const cellW = vw / cols;
  const cellH = vh / 2;
  ids.forEach((id, i) => {
    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + cellH / 2 - 20;
    drawModuleHardware(ctx, id, cx, cy, Math.min(cellW * 0.6, 200), { lit: 1, nowMs });
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = '#e8f1ff';
    ctx.textAlign = 'center';
    ctx.fillText(modulePresentation(id).label, cx, cy + 80);
  });
};

const orbit = params.get('orbit') === '1';
const orbitDist = Number(params.get('dist') ?? 12);

const frame = (): void => {
  const now = performance.now();
  if (scene === 'hardware') {
    drawHardwareSheet(now);
  } else {
    if (orbit && scene === 'locator') {
      const angle = now * 0.0006;
      state.player.x = site.cache.x + 0.5 - Math.cos(angle) * orbitDist;
      state.player.y = site.cache.y + 0.5 - Math.sin(angle) * orbitDist;
    }
    if (scene === 'shot') {
      // Voo em loop: sai do jogador rumo ao nordeste da tela e recomeca.
      const proj = state.projectiles[state.projectiles.length - 1];
      const travelled = ((now * 0.008) % 9);
      proj.x = state.player.x + travelled * 0.7;
      proj.y = state.player.y - travelled * 0.7;
    }
    renderer.render(state, 1, input.state, now);
    if (state.playerExtra.pendingModuleChoice) {
      renderer.renderChoice(state, window.innerWidth, window.innerHeight, input.state, now);
    }
  }
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
