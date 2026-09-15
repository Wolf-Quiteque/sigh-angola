import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import { databaseSchema, roles, type Database, type Role, type Session } from '@/domain/schema';
import { computeIndicators } from '@/domain/indicators';
import { dayOffset, today } from '@/lib/format';

/**
 * Fase 9 — verificações transversais que não pertencem a um módulo só:
 * integridade do cenário, isolamento por unidade e recusas em todos os perfis.
 */
const session = (role: Role): Session => ({ name: `Teste ${role}`, role });
const run = (db: Database, command: Command, role: Role) =>
  executeCommand(db, command, session(role));

describe('Fase 9: integridade do cenário de demonstração', () => {
  const db = createSeed();

  it('valida contra o esquema e é reprodutível a partir da mesma data base', () => {
    expect(() => databaseSchema.parse(db)).not.toThrow();
    const a = createSeed('2026-09-15');
    const b = createSeed('2026-09-15');
    expect({ ...a, audit: [] }).toEqual({ ...b, audit: [] });
  });

  it('não tem referências órfãs entre colecções', () => {
    const has = (list: Array<{ id: string }>, id: string) => list.some((item) => item.id === id);
    for (const appointment of db.appointments)
      expect(has(db.patients, appointment.patientId)).toBe(true);
    for (const episode of db.episodes) {
      expect(has(db.patients, episode.patientId)).toBe(true);
      if (episode.appointmentId) expect(has(db.appointments, episode.appointmentId)).toBe(true);
    }
    for (const triage of db.triages) expect(has(db.episodes, triage.episodeId)).toBe(true);
    for (const consultation of db.consultations) {
      expect(has(db.episodes, consultation.episodeId)).toBe(true);
      expect(has(db.professionals, consultation.professionalId)).toBe(true);
    }
    for (const exam of db.exams) expect(has(db.consultations, exam.consultationId)).toBe(true);
    for (const admission of db.admissions) {
      expect(has(db.beds, admission.bedId)).toBe(true);
      expect(has(db.wards, admission.wardId)).toBe(true);
    }
    for (const batch of db.batches) expect(has(db.products, batch.productId)).toBe(true);
    for (const invoice of db.invoices) {
      expect(has(db.patients, invoice.patientId)).toBe(true);
      for (const line of invoice.lines) expect(has(db.services, line.serviceId)).toBe(true);
    }
    for (const shift of db.shifts) expect(has(db.staff, shift.staffId)).toBe(true);
    for (const absence of db.absences) expect(has(db.staff, absence.staffId)).toBe(true);
    for (const record of db.attendance) expect(has(db.staff, record.staffId)).toBe(true);
  });

  it('todos os registos pertencem à unidade da demonstração', () => {
    const unitId = db.unit.id;
    const collections = [
      db.patients,
      db.appointments,
      db.episodes,
      db.exams,
      db.wards,
      db.beds,
      db.admissions,
      db.suppliers,
      db.products,
      db.batches,
      db.movements,
      db.services,
      db.insurers,
      db.invoices,
      db.cash,
      db.staff,
      db.shifts,
      db.attendance,
      db.absences,
      db.users,
      db.access,
    ];
    for (const collection of collections)
      for (const record of collection as Array<{ unitId: string }>)
        expect(record.unitId).toBe(unitId);
    // Os resumos da rede são de outras unidades e não têm registos individuais.
    expect(db.network.every((unit) => unit.id !== unitId)).toBe(true);
  });

  it('o cenário abre com trabalho por fazer em cada módulo', () => {
    expect(db.episodes.filter((e) => e.status === 'Aguarda triagem').length).toBeGreaterThan(0);
    expect(
      db.exams.filter((e) => !['Validado', 'Cancelado'].includes(e.status)).length,
    ).toBeGreaterThan(0);
    expect(db.admissions.filter((a) => a.status === 'Internado').length).toBeGreaterThan(0);
    expect(
      db.consultations.flatMap((c) => c.prescriptions).filter((p) => p.dispensed < p.quantity)
        .length,
    ).toBeGreaterThan(0);
    expect(db.invoices.filter((i) => i.status === 'Emitida').length).toBeGreaterThan(0);
    expect(db.shifts.filter((s) => s.date === today()).length).toBeGreaterThan(0);
  });

  it('os indicadores do cenário batem certo com as colecções', () => {
    const range = { start: dayOffset(-365), end: today() };
    const value = (key: string) => computeIndicators(db, range).find((i) => i.key === key)!.value;
    expect(value('consultations')).toBe(db.consultations.length);
    expect(value('exams')).toBe(db.exams.length);
    expect(value('admissions')).toBe(db.admissions.length);
    expect(value('discharges')).toBe(db.admissions.filter((a) => a.discharge).length);
  });
});

describe('Fase 9: nenhum perfil faz o que não lhe compete', () => {
  const attempts: Array<{ command: Command; allowed: Role[] }> = [
    {
      command: {
        type: 'patient.save',
        input: {
          name: 'Teste de Permissões',
          birthDate: '1990-01-01',
          sex: 'Feminino',
          document: '',
          phone: '',
          municipality: 'Menongue',
          address: '',
          guardian: '',
          emergencyContact: '',
        },
      },
      allowed: ['Administrador', 'Recepcionista'],
    },
    {
      command: {
        type: 'triage.save',
        episodeId: 'e1',
        chiefComplaint: 'Queixa de teste',
        priority: 'Verde',
        temperature: 36.8,
        systolic: 120,
        diastolic: 80,
        heartRate: 72,
        respiratoryRate: 16,
        oxygenSaturation: 98,
        weight: null,
        height: null,
        notes: '',
      },
      allowed: ['Administrador', 'Enfermeiro'],
    },
    {
      command: { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
      allowed: ['Administrador', 'Médico'],
    },
    {
      command: { type: 'exam.collect', examId: 'x2', sampleCode: 'AM-777777' },
      allowed: ['Administrador', 'Técnico'],
    },
    {
      command: {
        type: 'inpatient.note',
        admissionId: 'adm1',
        noteType: 'Evolução',
        text: 'Registo de teste de permissões.',
      },
      allowed: ['Administrador', 'Enfermeiro', 'Médico'],
    },
    {
      command: {
        type: 'inpatient.discharge',
        admissionId: 'adm1',
        outcome: 'Alta clínica',
        destination: '',
        notes: '',
      },
      allowed: ['Administrador', 'Médico'],
    },
    {
      command: { type: 'stock.exit', batchId: 'b-par-1', quantity: 1, reason: 'Teste' },
      allowed: ['Administrador', 'Farmacêutico'],
    },
    {
      command: {
        type: 'cash.entry',
        entryType: 'Despesa',
        category: 'Teste',
        description: 'Movimento de teste',
        amount: 100,
        method: 'Numerário',
      },
      allowed: ['Administrador', 'Administrativo'],
    },
    {
      command: { type: 'user.reset', userId: 'u-2' },
      allowed: ['Administrador'],
    },
  ];

  /** Recusa por perfil, distinta de uma recusa por regra de negócio. */
  const refusal = /permissão|acto médico|Apenas o administrador|médico valida|apenas de leitura/i;
  const messageOf = (command: Command, role: Role) => {
    try {
      run(createSeed(), command, role);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };

  it('cada operação só passa nos perfis previstos e a Direcção nunca escreve', () => {
    for (const { command, allowed } of attempts)
      for (const role of roles) {
        const message = messageOf(command, role);
        const context = `${command.type} como ${role}: ${message || 'sem erro'}`;
        if (role === 'Direcção') {
          expect(message, context).toContain('apenas de leitura');
        } else if (allowed.includes(role)) {
          // Pode falhar por uma regra clínica, nunca por falta de permissão.
          expect(refusal.test(message), context).toBe(false);
        } else {
          expect(refusal.test(message), context).toBe(true);
        }
      }
  });

  it('o registo de acesso é a única escrita permitida ao perfil de leitura', () => {
    const before = createSeed();
    const after = run(
      before,
      { type: 'access.log', area: 'Indicadores', subject: 'Resumo da unidade' },
      'Direcção',
    );
    expect(after.access.length).toBe(before.access.length + 1);
    expect(after.outbox).toEqual(before.outbox);
    expect(after.audit).toEqual(before.audit);
  });
});
