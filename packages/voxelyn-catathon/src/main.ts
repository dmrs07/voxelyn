import { SLOTS } from './sim/index.js';
import { createApp, start } from './client/app.js';
import { applyCatUi } from './client/catui.js';
import './style.css';

// A pele de UI de gato (CatMegaBundle) entra ANTES do primeiro paint do HUD:
// as pecas viram custom properties --cui-* que o style.css consome.
applyCatUi();

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const hud = document.getElementById('hud');
const screens = document.getElementById('screens');
if (!canvas || !hud || !screens) throw new Error('DOM base do Catathon ausente');

const app = createApp(canvas, hud, screens);
start(app);

// Ponte de depuracao/fumaca — mesmo contrato dos irmaos: o teste de fumaca
// inspeciona o estado REAL, nao um mock.
// SLOTS na ponte: a fumaca mira as MESAS REAIS, nao coordenadas decoradas —
// mover um movel no layout nunca deveria quebrar o teste por numero magico.
(window as unknown as { catathon?: unknown }).catathon = { app, slots: SLOTS };
