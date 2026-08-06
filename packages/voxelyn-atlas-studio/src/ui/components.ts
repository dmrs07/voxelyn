// Helpers minimos de DOM — o editor e vanilla TS de proposito (mesma filosofia
// do cliente Survival: zero framework, tudo sob controle).

export const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
};

/** Abre uma folha (modal de baixo). Resolve quando fechada. */
export const openSheet = (build: (close: () => void) => HTMLElement): Promise<void> =>
  new Promise((resolve) => {
    const backdrop = el('div', { class: 'sheet-backdrop' });
    const close = (): void => {
      backdrop.remove();
      resolve();
    };
    backdrop.addEventListener('pointerdown', (e) => {
      if (e.target === backdrop) close();
    });
    const sheet = build(close);
    sheet.classList.add('sheet');
    backdrop.append(sheet);
    document.body.append(backdrop);
  });

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const toast = (message: string): void => {
  document.querySelector('.toast')?.remove();
  const node = el('div', { class: 'toast', text: message });
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 2600);
};

export const confirmSheet = (message: string, actionLabel: string): Promise<boolean> =>
  new Promise((resolve) => {
    void openSheet((close) => {
      const yes = el('button', { class: 'danger', text: actionLabel });
      const no = el('button', { text: 'Cancelar' });
      yes.addEventListener('click', () => {
        resolve(true);
        close();
      });
      no.addEventListener('click', () => {
        resolve(false);
        close();
      });
      return el('div', {}, [
        el('p', { text: message }),
        el('div', { class: 'grid2', style: 'margin-top:12px' }, [no, yes]),
      ]);
    }).then(() => resolve(false));
  });
