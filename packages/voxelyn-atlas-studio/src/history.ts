// Undo/redo por snapshot de frame: cada traco guarda o buffer anterior do
// frame tocado. Snapshots sao pequenos (frame RGBA), 64 passos dao folga.
export type HistoryEntry = {
  frameKey: string;
  before: Uint8Array;
  after: Uint8Array;
};

const MAX_STEPS = 64;

export class History {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_STEPS) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undo(): HistoryEntry | undefined {
    const entry = this.undoStack.pop();
    if (entry) this.redoStack.push(entry);
    return entry;
  }

  redo(): HistoryEntry | undefined {
    const entry = this.redoStack.pop();
    if (entry) this.undoStack.push(entry);
    return entry;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}
