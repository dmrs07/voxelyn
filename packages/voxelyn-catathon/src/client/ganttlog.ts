import { liveBug, nextTask } from '../sim/index.js';
import type { Cat, CatId, HackState, Track } from '../sim/types.js';

/**
 * O LOG DO GANTT: quem trabalhou o que, de quando a quando — amostrado do
 * estado a cada frame. E display puro (nada entra na simulacao nem no hash)
 * e mora AQUI, fora do HUD, porque tem DOIS leitores: o gantt em DOM dentro
 * do Kanban e a MINIATURA no quadro fisico do pavilhao — a mesma verdade
 * desenhada em duas escalas.
 */
export type GanttKind = 'task' | 'bug' | 'fix';
export type GanttEntry = { key: string; label: string; kind: GanttKind; track: Track | null; start: number; end: number };

const log = new Map<CatId, GanttEntry[]>();

export const ganttEntries = (cat: CatId): readonly GanttEntry[] => log.get(cat) ?? [];

export const resetGanttLog = (): void => log.clear();

/**
 * O que este gato esta fazendo AGORA, na taxonomia do gantt: a tarefa da
 * trilha (cor da trilha), um bug (alarme), uma emergencia no rack (alarme
 * listrado) — ou nada que renda barra (andar, comer, dormir, decidir).
 */
const activityOf = (state: HackState, cat: Cat): { key: string; label: string; kind: GanttKind; track: Track | null } | null => {
  if (cat.mode !== 'work' || !cat.slot) return null;
  if (cat.slot === 'rack') {
    if (state.hairball.active) return { key: 'hairball', label: 'rack', kind: 'fix', track: null };
    if (state.buildBroken) return { key: 'build', label: 'rack', kind: 'fix', track: null };
    if (state.cableOut) return { key: 'cable', label: 'rack', kind: 'fix', track: null };
    return null;
  }
  const track = state.slots.find((s) => s.id === cat.slot)?.track;
  if (!track) return null;
  if (state.hairball.active || state.buildBroken || state.cableOut) return null;
  const bug = liveBug(state, track);
  if (bug) return { key: `bug${bug.id}`, label: `bug · ${track}`, kind: 'bug', track };
  const task = nextTask(state, track);
  if (!task || (task.choice && task.chosen === null)) return null;
  return { key: task.id, label: task.label, kind: 'task', track: task.track };
};

/**
 * Amostra o estado e estende (ou abre) o trecho corrente de cada gato. Uma
 * pausa real — comer, dormir, decidir — fecha o trecho e a proxima sessao
 * abre outro: as interrupcoes ficam VISIVEIS no vao.
 */
export const sampleGantt = (state: HackState): void => {
  for (const cat of state.cats) {
    const act = activityOf(state, cat);
    if (!act) continue;
    let entries = log.get(cat.id);
    if (!entries) {
      entries = [];
      log.set(cat.id, entries);
    }
    const last = entries[entries.length - 1];
    if (last && last.key === act.key && state.tick - last.end <= 8) {
      last.end = state.tick;
    } else {
      entries.push({ ...act, start: state.tick, end: state.tick });
    }
  }
};
