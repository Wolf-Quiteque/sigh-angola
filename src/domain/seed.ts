import seed from '@/data/demo.json';
import { databaseSchema, type Database } from './schema';
import { dayOffset, today } from '@/lib/format';
export function createSeed(base = today()): Database {
  const unitId = seed.unit.id;
  return databaseSchema.parse({
    version: 1,
    revision: 0,
    unit: seed.unit,
    professionals: seed.professionals,
    patients: seed.patients.map((p) => ({
      ...p,
      unitId,
      createdAt: `${dayOffset(-30, base)}T08:00:00+01:00`,
    })),
    appointments: seed.appointments.map(({ dayOffset: offset, ...a }) => ({
      ...a,
      unitId,
      date: dayOffset(offset, base),
      specialty: seed.professionals.find((p) => p.id === a.professionalId)!.specialty,
    })),
    episodes: seed.episodes.map(({ dayOffset: offset, time, ...e }) => ({
      ...e,
      unitId,
      arrivedAt: `${dayOffset(offset, base)}T${time}:00+01:00`,
    })),
    audit: [
      {
        id: 'initial',
        at: new Date().toISOString(),
        actor: 'Sistema de demonstração',
        action: 'Cenário iniciado',
        entityId: unitId,
        detail: 'Dados fictícios carregados a partir do JSON.',
      },
    ],
  });
}
