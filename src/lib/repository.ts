import { databaseSchema, type Database, type Session } from '@/domain/schema';
import { createSeed } from '@/domain/seed';
import { executeCommand, type Command } from '@/domain/commands';

export const STORAGE_KEY = 'sigh-angola-demo-v1';
export interface HospitalRepository {
  load(): Promise<Database>;
  commit(command: Command, session: Session, revision: number): Promise<Database>;
  reset(session: Session): Promise<Database>;
}
async function locked<T>(operation: () => T): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      'Este navegador não permite gravação segura entre separadores. Abra a demo em localhost num navegador actualizado.',
    );
  return navigator.locks.request(STORAGE_KEY, operation);
}
/** Acrescenta as colecções de cada versão sem tocar nos registos já gravados. */
function migrate(parsed: Record<string, unknown>) {
  const from = parsed.version;
  if (parsed.version === 1) {
    parsed.version = 2;
    parsed.triages = [];
    parsed.consultations = [];
  }
  if (parsed.version === 2) {
    parsed.version = 3;
    parsed.exams = [];
  }
  if (parsed.version === 3) {
    parsed.version = 4;
    // Enfermarias e camas são dados de referência da unidade, não registos do utilizador.
    // Sem internamentos migrados, nenhuma cama pode ficar ocupada.
    const reference = createSeed();
    parsed.wards = reference.wards;
    parsed.beds = reference.beds.map((bed) =>
      bed.status === 'Ocupada' ? { ...bed, status: 'Livre' as const } : bed,
    );
    parsed.admissions = [];
  }
  if (parsed.version === 4) {
    parsed.version = 5;
    const reference = createSeed();
    parsed.suppliers = reference.suppliers;
    parsed.products = reference.products;
    parsed.batches = reference.batches;
    parsed.movements = reference.movements;
    // Receitas anteriores à fase 5 não têm quantidade; ficam a zero e não são dispensáveis.
    for (const consultation of (parsed.consultations ?? []) as Array<{
      prescriptions: Array<Record<string, unknown>>;
    }>)
      for (const item of consultation.prescriptions) {
        item.quantity ??= 0;
        item.dispensed ??= 0;
      }
  }
  return parsed.version !== from;
}
function read(): Database {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    const db = createSeed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (migrate(parsed)) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return databaseSchema.parse(parsed);
  } catch {
    throw new Error(
      'Os dados locais não puderam ser lidos. Pode descarregar o conteúdo original antes de repor a demonstração.',
    );
  }
}
export const repository: HospitalRepository = {
  async load() {
    return locked(read);
  },
  async commit(command, session, revision) {
    return locked(() => {
      const current = read();
      if (current.revision !== revision)
        throw new Error(
          'Os dados foram alterados noutro separador. Actualize a página antes de repetir a operação.',
        );
      const next = executeCommand(current, command, session);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          'Não foi possível guardar. Verifique o espaço e as permissões de armazenamento do navegador.',
        );
      }
      return next;
    });
  },
  async reset(session) {
    if (session.role !== 'Administrador')
      throw new Error('Apenas o administrador pode repor os dados de demonstração.');
    return locked(() => {
      const next = createSeed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  },
};
export function downloadJson(value: string, name: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
