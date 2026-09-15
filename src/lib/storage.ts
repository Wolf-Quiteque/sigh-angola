/**
 * Camada de armazenamento local da demonstração.
 *
 * O adaptador preferido é IndexedDB, que suporta volumes maiores e sobrevive
 * melhor a sessões longas em tablets. Quando o navegador não o disponibiliza —
 * janelas privadas restritas, por exemplo — a demo continua em localStorage e
 * diz qual o adaptador em uso. Os dados já gravados em localStorage são
 * importados uma única vez para o IndexedDB, sem serem apagados de imediato.
 */
export const STORAGE_KEY = 'sigh-angola-demo-v1';
export const SERVER_KEY = 'sigh-angola-servidor-v1';
const DB_NAME = 'sigh-angola';
const DB_VERSION = 1;
const STORE = 'estado';

export type StorageKind = 'IndexedDB' | 'localStorage';

let kind: StorageKind = 'localStorage';
export const storageKind = () => kind;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB indisponível.'));
    request.onblocked = () => reject(new Error('IndexedDB bloqueado por outro separador.'));
  });
}

async function idbRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error ?? new Error('Operação de IndexedDB falhou.'));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('Transacção de IndexedDB cancelada.'));
    });
  } finally {
    database.close();
  }
}

const hasIndexedDb = () => typeof indexedDB !== 'undefined' && indexedDB !== null;

/** Lê o estado, importando uma única vez o que existir em localStorage. */
export async function readRaw(key: string): Promise<string | null> {
  if (hasIndexedDb()) {
    try {
      const stored = await idbRequest<string | undefined>('readonly', (store) => store.get(key));
      kind = 'IndexedDB';
      if (typeof stored === 'string') return stored;
      const legacy = localStorage.getItem(key);
      if (legacy !== null) {
        // Importa, mas não apaga a origem: só depois de uma gravação bem-sucedida.
        await idbRequest('readwrite', (store) => store.put(legacy, key));
        return legacy;
      }
      return null;
    } catch {
      kind = 'localStorage';
    }
  }
  kind = 'localStorage';
  return localStorage.getItem(key);
}

export async function writeRaw(key: string, value: string): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await idbRequest('readwrite', (store) => store.put(value, key));
      kind = 'IndexedDB';
      // A cópia antiga só é removida depois de a gravação nova ter sucesso.
      try {
        if (localStorage.getItem(key) !== null) localStorage.removeItem(key);
      } catch {
        // Sem acesso a localStorage não há nada a limpar.
      }
      return;
    } catch {
      kind = 'localStorage';
    }
  }
  kind = 'localStorage';
  localStorage.setItem(key, value);
}

export async function removeRaw(key: string): Promise<void> {
  if (hasIndexedDb()) {
    try {
      await idbRequest('readwrite', (store) => store.delete(key));
    } catch {
      // Sem IndexedDB, basta limpar o localStorage.
    }
  }
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignorado: o armazenamento pode estar bloqueado pelo navegador.
  }
}
