import { GameLoop } from './game/loop';

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game nao encontrado.');
}

const baseSeed = 0xdecafbad;
const gameLoop = new GameLoop(canvas, baseSeed);

gameLoop.start();
