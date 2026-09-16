import { databaseSchema, type Database, type Session } from '@/domain/schema';
import { createSeed } from '@/domain/seed';
import { executeCommand, type Command } from '@/domain/commands';
import { readRaw, writeRaw, STORAGE_KEY } from './storage';
import { clearServer } from './sync';

export { STORAGE_KEY, storageKind } from './storage';

export interface HospitalRepository {
  load(): Promise<Database>;
  commit(command: Command, session: Session, revision: number): Promise<Database>;
  reset(session: Session): Promise<Database>;
  restore(value: string, session: Session): Promise<Database>;
}
async function locked<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error(
      'Este navegador não permite gravação segura entre separadores. Utilize um navegador actualizado.',
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
  if (parsed.version === 5) {
    parsed.version = 6;
    const reference = createSeed();
    parsed.services = reference.services;
    parsed.insurers = reference.insurers;
    parsed.staff = reference.staff;
    parsed.invoices = [];
    parsed.cash = [];
    parsed.shifts = [];
    parsed.attendance = [];
    parsed.absences = [];
  }
  if (parsed.version === 6) {
    parsed.version = 7;
    const reference = createSeed();
    parsed.users = reference.users;
    parsed.network = reference.network;
    parsed.access = [];
  }
  if (parsed.version === 7) {
    parsed.version = 8;
    parsed.device = createDevice();
    parsed.outbox = [];
  }
  return parsed.version !== from;
}
/** Identidade do dispositivo: acompanha cada operação enviada para o servidor. */
function createDevice() {
  const id = crypto.randomUUID();
  return { id, name: `Dispositivo ${id.slice(0, 8).toUpperCase()}` };
}
async function read(): Promise<Database> {
  const raw = await readRaw(STORAGE_KEY);
  if (raw === null) {
    const db = { ...createSeed(), device: createDevice() };
    await writeRaw(STORAGE_KEY, JSON.stringify(db));
    return databaseSchema.parse(db);
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(
      'Os dados locais não puderam ser lidos. Pode descarregar o conteúdo original antes de repor a unidade.',
    );
  }
  const migrated = migrate(parsed);
  let database: Database;
  try {
    database = databaseSchema.parse(parsed);
  } catch {
    throw new Error(
      'Os dados locais não puderam ser lidos. Pode descarregar o conteúdo original antes de repor a unidade.',
    );
  }
  if (migrated) await writeRaw(STORAGE_KEY, JSON.stringify(database));
  return database;
}
async function write(next: Database) {
  try {
    await writeRaw(STORAGE_KEY, JSON.stringify(next));
  } catch {
    throw new Error(
      'Não foi possível guardar. Verifique o espaço e as permissões de armazenamento do navegador.',
    );
  }
}
export const repository: HospitalRepository = {
  async load() {
    return locked(read);
  },
  async commit(command, session, revision) {
    return locked(async () => {
      const current = await read();
      if (current.revision !== revision)
        throw new Error(
          'Os dados foram alterados noutro separador. Actualize a página antes de repetir a operação.',
        );
      const next = executeCommand(current, command, session);
      await write(next);
      return next;
    });
  },
  async reset(session) {
    if (session.role !== 'Administrador')
      throw new Error('Apenas o administrador pode repor os dados iniciais.');
    return locked(async () => {
      const next = databaseSchema.parse({ ...createSeed(), device: createDevice() });
      await write(next);
      await clearServer();
      return next;
    });
  },
  /** Restaura uma cópia validada, conservando o que ainda não foi confirmado. */
  async restore(value, session) {
    if (session.role !== 'Administrador')
      throw new Error('Apenas o administrador pode restaurar uma cópia de segurança.');
    return locked(async () => {
      let candidate: Database;
      try {
        candidate = databaseSchema.parse(JSON.parse(value));
      } catch {
        throw new Error(
          'A cópia não corresponde ao formato desta aplicação. O restauro foi cancelado e os dados actuais mantêm-se.',
        );
      }
      const current = await read();
      const pending = current.outbox.filter((entry) => entry.state !== 'Confirmado');
      const known = new Set(candidate.outbox.map((entry) => entry.id));
      const next: Database = {
        ...candidate,
        // O dispositivo é desta instalação, não da cópia.
        device: current.device,
        revision: Math.max(candidate.revision, current.revision) + 1,
        outbox: [...pending.filter((entry) => !known.has(entry.id)), ...candidate.outbox],
        audit: [
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actor: `${session.name} (${session.role})`,
            action: 'Cópia de segurança restaurada',
            entityId: candidate.unit.id,
            detail: `${pending.length} operação(ões) por confirmar preservada(s)`,
          },
          ...candidate.audit,
        ],
      };
      await write(next);
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
