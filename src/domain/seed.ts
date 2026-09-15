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
    version: 7,
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
    wards: seed.wards.map((w) => ({ ...w, unitId })),
    beds: seed.beds.map((b) => ({ ...b, unitId })),
    admissions: seed.admissions.map(({ admitted, notes, ...a }) => ({
      ...a,
      unitId,
      admittedAt: at(admitted, base),
      notes: notes.map((note) => stamp(note, base)),
    })),
    suppliers: seed.suppliers.map((s) => ({ ...s, unitId })),
    products: seed.products.map((p) => ({ ...p, unitId })),
    batches: seed.batches.map(({ expiryOffset, receivedOffset, ...b }) => ({
      ...b,
      unitId,
      expiry: expiryOffset === null ? null : dayOffset(expiryOffset, base),
      receivedAt: `${dayOffset(receivedOffset, base)}T09:00:00+01:00`,
    })),
    // Cada lote inicial corresponde a uma entrada registada, para o livro de movimentos não nascer vazio.
    movements: seed.batches
      .map(({ id, productId, quantity, receivedOffset }) => ({
        id: `mov-${id}`,
        unitId,
        productId,
        batchId: id,
        type: 'Entrada' as const,
        quantity,
        balance: seed.batches
          .filter((b) => b.productId === productId && b.receivedOffset <= receivedOffset)
          .reduce((sum, b) => sum + b.quantity, 0),
        at: `${dayOffset(receivedOffset, base)}T09:00:00+01:00`,
        author: 'Farm. Rosa Cahama',
        reason: 'Entrada inicial do cenário de demonstração',
        destination: '',
        patientId: null,
        prescriptionItemId: null,
      }))
      .sort((a, b) => b.at.localeCompare(a.at)),
    services: seed.services.map((s) => ({ ...s, unitId })),
    insurers: seed.insurers.map((i) => ({ ...i, unitId })),
    invoices: seed.invoices.map(({ issued, payments, ...invoice }) => ({
      ...invoice,
      unitId,
      issuedAt: at(issued, base),
      payments: payments.map((payment) => stamp(payment, base)),
    })),
    cash: seed.cash.map(({ dayOffset: offset, time, ...entry }) => ({
      ...entry,
      unitId,
      at: `${dayOffset(offset, base)}T${time}:00+01:00`,
    })),
    staff: seed.staff.map(({ hiredOffset, ...member }) => ({
      ...member,
      unitId,
      hiredAt: dayOffset(hiredOffset, base),
    })),
    shifts: seed.shifts.map(({ dayOffset: offset, ...shift }) => ({
      ...shift,
      unitId,
      date: dayOffset(offset, base),
    })),
    attendance: seed.attendance.map(({ dayOffset: offset, recordedTime, ...record }) => ({
      ...record,
      unitId,
      date: dayOffset(offset, base),
      recordedAt: `${dayOffset(offset, base)}T${recordedTime}:00+01:00`,
    })),
    absences: seed.absences.map(({ startOffset, endOffset, ...absence }) => ({
      ...absence,
      unitId,
      start: dayOffset(startOffset, base),
      end: dayOffset(endOffset, base),
    })),
    users: seed.users.map(({ createdOffset, ...user }) => ({
      ...user,
      unitId,
      createdAt: `${dayOffset(createdOffset, base)}T08:00:00+01:00`,
    })),
    access: seed.access.map(({ dayOffset: offset, time, ...record }) => ({
      ...record,
      unitId,
      at: `${dayOffset(offset, base)}T${time}:00+01:00`,
    })),
    network: seed.network,
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
