import {
  preloadCharacterAtlases,
  setBrowserFetcher,
  SPRITE_BY_ARCHETYPE,
} from '@voxelyn/animation';
import { GameLoop } from './game/loop';

const bootSprites = async (): Promise<void> => {
  setBrowserFetcher();
  const baseUrl = `${import.meta.env.BASE_URL}assets/sprites/characters`;
  await preloadCharacterAtlases(Object.values(SPRITE_BY_ARCHETYPE), baseUrl, {
    strict: import.meta.env.DEV,
  });
};

const canvas = document.getElementById('game');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas #game não encontrado.');
}

const baseSeed = 0xdecafbad;
const gameLoop = new GameLoop(canvas, baseSeed);
const gameWindow = window as typeof window & {
  advanceTime?: (ms: number) => Promise<void>;
  render_game_to_text?: () => string;
};
const titleShortcut = document.querySelector<HTMLAnchorElement>('[data-title-shortcut]');

gameWindow.advanceTime = async (ms: number): Promise<void> => {
  gameLoop.advanceTime(ms);
};
gameWindow.render_game_to_text = (): string => gameLoop.renderGameToText();

if (titleShortcut && window.location.protocol !== 'file:') {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  titleShortcut.href = `${baseUrl}concept-art/voxelyn-sprite-grid-preview-v2.html`;
}

const title = document.getElementById('title');
const startWhenReady = async (): Promise<void> => {
  await bootSprites();

  if (title) {
  const dismiss = (event: Event): void => {
    if (event.target instanceof Element && event.target.closest('[data-title-shortcut]')) return;
    if (title.classList.contains('hidden')) return;
    title.classList.add('hidden');
    gameLoop.start();
    window.removeEventListener('keydown', dismiss);
    title.removeEventListener('click', dismiss);
  };
  window.addEventListener('keydown', dismiss);
  title.addEventListener('click', dismiss);
  } else {
    gameLoop.start();
  }
};

void startWhenReady();
