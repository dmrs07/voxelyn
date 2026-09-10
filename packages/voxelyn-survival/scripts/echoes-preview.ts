// Controlled QA scenes using the shipped simulation, renderer, icons and selection panel.
import {
  createRun,
  emptyCommand,
  stepRun,
  SOLID_NONE,
  SURF_NONE,
  SURF_BIOFLUID,
  type AbilityId,
} from '../../voxelyn-survival-sim/src/index';
import { spawnEnemy } from '../../voxelyn-survival-sim/src/entities';
import { SurvivalRenderer } from '../src/client/render';
import { SurvivalInput } from '../src/client/input';
import { EchoChoicePanel } from '../src/client/echo-choice';
import { DesktopControlBar } from '../src/client/desktop-controls';
import { abilityPresentation } from '../src/client/ability-presentation';
import { abilityIconSvg } from '../src/client/ability-icons';
import { setLocale } from '../src/client/i18n';

const query = new URLSearchParams(location.search);
setLocale(query.get('lang') === 'en' ? 'en' : 'pt-BR');
if (!query.has('embedded')) {
  document.body.innerHTML = `<nav><b>Echoes 2.0 · revisão</b><label>Cena <select id="scene"><option value="cards">Escolha · Sopro / Arco</option><option value="new">Novos · Onda / Passo</option><option value="vent">Purga / Respiro</option><option value="fallback">Primeira descida</option><option value="arc">Arco condutivo</option><option value="fire">Sopro térmico</option><option value="icons">Ícones</option></select></label><label>Tela <select id="viewport"><option value="1280x800">Desktop · 1280×800</option><option value="390x844">Celular · 390×844</option><option value="740x360">Paisagem · 740×360</option></select></label><label>Idioma <select id="lang"><option value="pt-BR">Português</option><option value="en">English</option></select></label></nav><iframe title="Prévia jogável dos Echoes"></iframe>`;
  const frame = document.querySelector('iframe')!;
  const controls = ['scene', 'viewport', 'lang'].map(
    (id) => document.getElementById(id) as HTMLSelectElement,
  );
  const update = () => {
    const [scene, viewport, lang] = controls.map((c) => c.value),
      [w, h] = viewport.split('x').map(Number);
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.src = `${location.pathname}?embedded=1&scene=${scene}&touch=${w < 800}&lang=${lang}`;
  };
  controls.forEach((c) => c.addEventListener('change', update));
  update();
} else if (query.get('scene') === 'icons') {
  document.body.className = 'icon-review';
  const title = document.createElement('h1');
  title.textContent = 'Echoes 2.0';
  document.body.append(title);
  for (const id of [
    'pulse',
    'flamethrower',
    'seeker',
    'arc',
    'seismic',
    'slipstream',
    'vent',
  ] as AbilityId[]) {
    const spec = abilityPresentation(id),
      card = document.createElement('article');
    card.style.color = spec.color;
    card.innerHTML = abilityIconSvg(id);
    const label = document.createElement('strong');
    label.textContent = spec.label;
    card.append(label);
    document.body.append(card);
  }
} else {
  document.body.innerHTML =
    '<canvas id="game" tabindex="0"></canvas><output id="status"></output><button id="replay">Repetir cena</button>';
  const canvas = document.querySelector('canvas')!,
    status = document.querySelector('output')!;
  const scene = query.get('scene') ?? 'cards',
    touch = query.get('touch') === 'true';
  const renderer = new SurvivalRenderer(canvas),
    input = new SurvivalInput(canvas);
  const panel = new EchoChoicePanel(),
    bar = new DesktopControlBar(canvas);
  renderer.setQuality('high');
  renderer.resize();
  input.layoutButtons(innerWidth, innerHeight);
  input.state.usingTouch = touch;
  input.attach();
  let state = createRun({ seed: 551 }),
    simTime = 0,
    last = performance.now();
  let captured = false;
  const reset = () => {
    state = createRun({ seed: 551 });
    state.enemies = [];
    state.vents = [];
    state.projectiles = [];
    panel.hide();
    captured = false;
    renderer.fxList = [];
    const well = scene === 'cards' || scene === 'new' || scene === 'vent' || scene === 'fallback';
    const x = well ? state.corePos.x + 0.5 : 40.5,
      y = well ? state.corePos.y + 0.5 : 40.5;
    state.player.x = x;
    state.player.y = y;
    for (let py = Math.floor(y) - 8; py <= y + 8; py++)
      for (let px = Math.floor(x) - 8; px <= x + 8; px++) {
        if (px < 0 || py < 0 || px >= state.config.width || py >= state.config.height) continue;
        const i = py * state.config.width + px;
        state.solid[i] = SOLID_NONE;
        state.surface[i] = SURF_NONE;
        state.surfaceTimer[i] = 0;
      }
    if (scene === 'cards') {
      state.playerExtra.resonance.fire = 12;
      state.playerExtra.resonance.current = 3;
    }
    if (scene === 'new') {
      state.playerExtra.resonance.kinetic = 18;
      state.playerExtra.resonance.evasion = 12;
    }
    if (scene === 'vent') state.playerExtra.resonance.purge = 1;
    if (scene === 'arc' || scene === 'fire') {
      state.playerExtra.ability = scene === 'arc' ? 'arc' : 'flamethrower';
      for (const [dx, dy] of [
        [2, 0],
        [4, 1],
        [5, -1],
        [6, 2],
      ]) {
        const enemy = spawnEnemy(state, 'stalker', x + dx, y + dy, false);
        enemy.x = x + dx;
        enemy.y = y + dy;
        enemy.stunnedUntil = 1e8;
        enemy.hp = enemy.maxHp = 100;
      }
      if (scene === 'fire') {
        for (let dx = 2; dx < 5; dx++)
          state.surface[Math.floor(y) * state.config.width + Math.floor(x + dx)] = SURF_BIOFLUID;
        state.playerExtra.thermalGuardUntil = 0;
      }
    }
    // These counters/positions are fixtures; offers are produced by the real reveal logic.
    const result = stepRun(state, [emptyCommand()]);
    renderer.ingestEvents(result.events, performance.now());
    simTime = 0;
  };
  document.getElementById('replay')!.addEventListener('click', reset);
  reset();
  const frame = (now: number) => {
    const dt = Math.min(50, now - last);
    last = now;
    simTime += dt;
    const command = panel.consume();
    if (command)
      renderer.ingestEvents(stepRun(state, [{ ...emptyCommand(), ...command }]).events, now);
    const animated = scene === 'arc' || scene === 'fire';
    if (animated && simTime >= 1000 && !captured) {
      const events = stepRun(state, [
        { ...emptyCommand(), ability: true, aim: { x: 1, y: 0 } },
      ]).events;
      renderer.ingestEvents(events, now);
      captured = true;
    }
    // Recast previews periodically. Cards remain interactive; gameplay never runs a second engine.
    if (animated && simTime > 3200) reset();
    if (scene === 'fire' && captured && state.tick < 32) {
      if (Math.floor(simTime / 50) > state.tick)
        renderer.ingestEvents(stepRun(state, [emptyCommand()]).events, now);
    }
    renderer.render(state, 1, input.state, now);
    bar.render(state, input.state, now, innerWidth, innerHeight, 0);
    panel.update(state, touch);
    status.textContent = `QA · ${abilityPresentation(state.playerExtra.ability).label} · HP ${state.player.hp.toFixed(1)} · tick ${state.tick}`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
