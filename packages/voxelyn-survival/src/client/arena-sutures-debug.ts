import { t, onLocaleChange, type MessageKey } from './i18n';
import {
  cutSuture,
  breakSolid,
  emptyCommand,
  stepRun,
  sutureObjective,
  suturePoint,
  SOLID_NONE,
  type SemanticEvent,
  type SurvivalState,
} from '@voxelyn/survival-sim';

/** Visible playtest controls, confined to arena.html. Every cut uses the real simulation. */
export const mountSutureDebug = (
  stateOf: () => SurvivalState | null,
  emit: (events: SemanticEvent[]) => void,
  pause: (paused: boolean) => void,
): void => {
  const panel = document.createElement('details');
  // Obedece ao interruptor das ferramentas como os demais paineis (ver o CSS
  // de `body.tools-hidden` em arena.html): durante a luta ele cobria a sala.
  panel.id = 'sutures-panel';
  panel.style.cssText =
    'position:fixed;right:12px;top:70px;z-index:40;background:#131920ee;color:#ddd4c2;padding:10px;border:1px solid #766951;font:12px monospace;max-width:230px';
  panel.innerHTML =
    '<summary></summary><div style="display:grid;gap:6px;margin-top:8px"></div><output style="display:block;max-width:220px;margin-top:8px"></output>';
  const summary = panel.querySelector('summary')!;
  const relabel: Array<() => void> = [
    () => {
      summary.textContent = t('arena.suture.title');
    },
  ];
  const controls = panel.querySelector('div')!,
    output = panel.querySelector('output')!;
  const selected = (state: SurvivalState) => {
    const queen = state.enemies.find((e) => e.alive && e.archetype === 'seamstress');
    return (
      state.sutures.find((s) => s.id + 1 === queen?.mood && s.phase === 'taut') ??
      state.sutures
        .filter((s) => s.phase === 'taut' && s.kind === 'roof')
        .sort((a, b) => {
          const p = queen ?? state.player,
            pa = suturePoint(state, a.cells[0]),
            pb = suturePoint(state, b.cells[0]);
          return Math.hypot(pa.x - p.x, pa.y - p.y) - Math.hypot(pb.x - p.x, pb.y - p.y);
        })[0]
    );
  };
  const add = (label: MessageKey, fn: (state: SurvivalState, events: SemanticEvent[]) => void) => {
    const button = document.createElement('button');
    relabel.push(() => {
      button.textContent = t(label);
    });
    button.addEventListener('click', () => {
      const state = stateOf();
      if (!state || state.occupation !== 'stitchers') {
        output.textContent = t('arena.suture.select');
        return;
      }
      const events: SemanticEvent[] = [];
      fn(state, events);
      emit(events);
      const goal = sutureObjective(state);
      output.textContent = t('arena.suture.status', {
        tick: state.tick,
        done: goal.done,
        total: goal.total,
        taut: state.sutures.filter((s) => s.phase === 'taut').length,
      });
    });
    controls.append(button);
  };
  add('arena.suture.inspect', (state) => {
    pause(true);
    const s = selected(state);
    if (!s) return;
    const p = suturePoint(state, s.cells[Math.floor(s.cells.length / 2)]),
      w = state.config.width;
    const positions = [];
    for (let y = Math.floor(p.y) - 4; y <= Math.floor(p.y) + 4; y++)
      for (let x = Math.floor(p.x) - 4; x <= Math.floor(p.x) + 4; x++) {
        if (
          x < 1 ||
          y < 1 ||
          x >= w - 1 ||
          y >= state.config.height - 1 ||
          state.solid[y * w + x] !== SOLID_NONE
        )
          continue;
        positions.push({ x: x + 0.5, y: y + 0.5 });
      }
    positions.sort(
      (a, b) => Math.hypot(a.x - p.x - 2, a.y - p.y - 2) - Math.hypot(b.x - p.x - 2, b.y - p.y - 2),
    );
    if (positions[0]) Object.assign(state.player, positions[0]);
    const queen = state.enemies.find((e) => e.alive && e.archetype === 'seamstress');
    if (queen) queen.mood = s.id + 1;
  });
  add('arena.suture.cut', (state, events) => {
    const s = selected(state);
    if (s) cutSuture(state, s, events, 0);
  });
  add('arena.suture.anchor', (state, events) => {
    const s = selected(state);
    if (s) {
      const p = suturePoint(state, s.a);
      breakSolid(state, Math.floor(p.x), Math.floor(p.y), events);
    }
  });
  add('arena.suture.step', (state, events) => {
    pause(true);
    for (let i = 0; i < 8; i++) events.push(...stepRun(state, [emptyCommand()]).events);
  });
  add('arena.suture.phase', (state) => {
    const queen = state.enemies.find((e) => e.alive && e.archetype === 'seamstress');
    if (queen) queen.hp = queen.maxHp * 0.45;
  });
  add('arena.suture.pause', () => pause(true));
  add('arena.suture.resume', () => pause(false));
  const refresh = () => relabel.forEach((update) => update());
  refresh();
  onLocaleChange(refresh);
  document.body.append(panel);
};
