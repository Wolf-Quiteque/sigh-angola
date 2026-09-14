import seed from '@/data/demo.json';
import { databaseSchema, type Database } from './schema';
import { dayOffset, today } from '@/lib/format';

type Offset = { dayOffset: number; time: string };
/** Converte os desvios relativos do JSON em instantes reais, para o cenário continuar útil. */
const at = ({ dayOffset: day, time }: Offset, base: string) =>
  `${dayOffset(day, base)}T${time}:00+01:00`;
const stamp = <T extends Offset>(value: T | null, base: string) => {
  if (!value) return null;
  const { dayOffset: day, time, ...rest } = value;
  return { ...rest, at: at({ dayOffset: day, time }, base) };
};

export function createSeed(base = today()): Database {
  const unitId = seed.unit.id;
  return databaseSchema.parse({
    version: 3,
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
    triages: seed.triages.map(({ dayOffset: offset, time, ...t }) => ({
      ...t,
      recordedAt: `${dayOffset(offset, base)}T${time}:00+01:00`,
    })),
    consultations: seed.consultations.map(({ started, completed, ...c }) => ({
      ...c,
      startedAt: at(started, base),
      completedAt: completed ? at(completed, base) : null,
    })),
    exams: seed.exams.map(({ requested, collection, schedule, performance, report, ...e }) => ({
      ...e,
      unitId,
      requestedAt: at(requested, base),
      collection: stamp(collection, base),
      schedule: schedule
        ? {
            at: at(schedule, base),
            author: schedule.author,
            scheduledFor: at(
              { dayOffset: schedule.scheduledDayOffset, time: schedule.scheduledTime },
              base,
            ),
          }
        : null,
      performance: stamp(performance, base),
      report: stamp(report, base),
      validation: stamp(e.validation, base),
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
