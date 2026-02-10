import { writable } from 'svelte/store';

export type ModalKind =
  | 'new-project'
  | 'generate'
  | 'deploy'
  | 'plugin'
  | 'run-cli'
  | 'run-preset';

export type DesktopModalRequest = {
  kind: ModalKind;
  payload: Record<string, unknown>;
};

export type UiCommandEvent = {
  id: number;
  type: string;
  payload: Record<string, unknown>;
};

export type UiCommandState = {
  available: boolean;
  activeModal: DesktopModalRequest | null;
  latestEvent: UiCommandEvent | null;
};

const MODAL_COMMANDS = new Set<string>([
  'new-project',
  'generate',
  'deploy',
  'plugin',
  'run-cli',
  'run-preset',
]);

const createUiCommandStore = () => {
  const state = writable<UiCommandState>({
    available: false,
    activeModal: null,
    latestEvent: null,
  });

  let initialized = false;
  let unlisten: (() => void) | null = null;
  let sequence = 0;

  const dispatch = (type: string, payload: Record<string, unknown> = {}): void => {
    sequence += 1;
    state.update((current) => {
      const next: UiCommandState = {
        ...current,
        latestEvent: {
          id: sequence,
          type,
          payload,
        },
      };

      if (MODAL_COMMANDS.has(type)) {
        next.activeModal = {
          kind: type as ModalKind,
          payload,
        };
      }

      return next;
    });
  };

  const initialize = (): void => {
    if (initialized) return;
    initialized = true;

    if (typeof window === 'undefined' || !window.voxelynDesktop) {
      state.update((current) => ({ ...current, available: false }));
      return;
    }

    state.update((current) => ({ ...current, available: true }));
    unlisten = window.voxelynDesktop.onUiCommand((command) => {
      const type = typeof command?.type === 'string' ? command.type : '';
      if (!type) return;
      const payload =
        command && typeof command.payload === 'object' && command.payload !== null
          ? (command.payload as Record<string, unknown>)
          : {};
      dispatch(type, payload);
    });
  };

  const closeModal = (): void => {
    state.update((current) => ({ ...current, activeModal: null }));
  };

  const clearLatestEvent = (): void => {
    state.update((current) => ({ ...current, latestEvent: null }));
  };

  const dispose = (): void => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
    initialized = false;
  };

  return {
    subscribe: state.subscribe,
    initialize,
    dispose,
    dispatch,
    closeModal,
    clearLatestEvent,
  };
};

export const uiCommandStore = createUiCommandStore();
