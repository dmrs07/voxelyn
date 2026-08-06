// Persistencia local: IndexedDB guarda os projetos (Uint8Array viaja inteiro
// pelo structured clone). Autosave e o unico modo — celular nao tem Ctrl+S.
import type { Project } from './types';

const DB_NAME = 'voxelyn-atlas-studio';
const STORE = 'projects';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const tx = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
  const db = await openDb();
  return db.transaction(STORE, mode).objectStore(STORE);
};

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const saveProject = async (project: Project): Promise<void> => {
  project.updatedAt = Date.now();
  await request((await tx('readwrite')).put(project));
};

export const loadProject = async (key: string): Promise<Project | undefined> =>
  request((await tx('readonly')).get(key)) as Promise<Project | undefined>;

export const listProjects = async (): Promise<Project[]> => {
  const all = (await request((await tx('readonly')).getAll())) as Project[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const deleteProject = async (key: string): Promise<void> => {
  await request((await tx('readwrite')).delete(key));
};
