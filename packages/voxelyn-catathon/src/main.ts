import { createApp, start } from './client/app.js';
import './style.css';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
const hud = document.getElementById('hud');
const screens = document.getElementById('screens');
if (!canvas || !hud || !screens) throw new Error('DOM base do Catathon ausente');

const app = createApp(canvas, hud, screens);
start(app);

// Ponte de depuracao/fumaca — mesmo contrato dos irmaos: o teste de fumaca
// inspeciona o estado REAL, nao um mock.
(window as unknown as { catathon?: unknown }).catathon = { app };
