import { describe, it, expect } from 'vitest';
import { executeCommand } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import { databaseSchema, type PatientInput, type Session } from '@/domain/schema';
import { dayOffset, today } from '@/lib/format';
const admin: Session = { name: 'Teste', role: 'Administrador' };
const input: PatientInput = {
  name: 'Paciente de Teste',
  birthDate: '1990-01-01',
  sex: 'Feminino',
  document: 'TESTE123',
  phone: '923123456',
  municipality: 'Menongue',
  address: '',
  guardian: '',
  emergencyContact: '',
};
describe('Recepção: consistência e transições', () => {
  it('carrega dados JSON válidos e referências existentes', () => {
    const db = createSeed();
    expect(databaseSchema.safeParse(db).success).toBe(true);
    for (const a of db.appointments) {
      expect(db.patients.some((p) => p.id === a.patientId)).toBe(true);
      expect(db.professionals.some((p) => p.id === a.professionalId)).toBe(true);
    }
    for (const e of db.episodes) {
      expect(db.patients.some((p) => p.id === e.patientId)).toBe(true);
      if (e.appointmentId)
        expect(
          db.appointments.some((a) => a.id === e.appointmentId && a.patientId === e.patientId),
        ).toBe(true);
    }
  });
  it('regista paciente com ID único e auditoria sem alterar o estado original', () => {
    const db = createSeed();
    const next = executeCommand(db, { type: 'patient.save', input }, admin);
    expect(next.patients).toHaveLength(db.patients.length + 1);
    expect(db.revision).toBe(0);
    expect(next.revision).toBe(1);
    expect(next.audit[0].actor).toContain('Administrador');
    expect(next.patients.at(-1)?.number).toBe('SIGH-000009');
  });
  it('impede duplicados pelo BI normalizado', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'patient.save', input: { ...input, document: ' demo000001 ' } },
        admin,
      ),
    ).toThrow('Já existe');
  });
  it('impede duplicado por nome normalizado e data mesmo sem documento', () => {
    const p = createSeed().patients[0];
    expect(() =>
      executeCommand(
        createSeed(),
        {
          type: 'patient.save',
          input: { ...input, name: 'esperanca  manuel zua', birthDate: p.birthDate, document: '' },
        },
        admin,
      ),
    ).toThrow('Já existe');
  });
  it('actualiza a mesma ficha mantendo número e histórico', () => {
    const db = createSeed();
    const p = db.patients[0];
    const next = executeCommand(
      db,
      { type: 'patient.save', id: p.id, input: { ...p, address: 'Nova morada' } },
      admin,
    );
    expect(next.patients[0].number).toBe(p.number);
    expect(next.episodes).toEqual(db.episodes);
    expect(next.patients[0].address).toBe('Nova morada');
  });
  it('rejeita nascimento futuro e telefone inválido', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'patient.save', input: { ...input, birthDate: dayOffset(1) } },
        admin,
      ),
    ).toThrow();
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'patient.save', input: { ...input, phone: '123' } },
        admin,
      ),
    ).toThrow();
  });
  it('protege mutações contra o perfil de leitura', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'patient.save', input },
        { name: 'Director', role: 'Direcção' },
      ),
    ).toThrow('leitura');
  });
  it('executa marcação, confirmação e chegada como um episódio persistível', () => {
    let db = executeCommand(
      createSeed(),
      {
        type: 'appointment.save',
        patientId: 'p7',
        professionalId: 'med-1',
        date: today(),
        time: '11:00',
        reason: 'Teste',
      },
      admin,
    );
    const id = db.appointments.at(-1)!.id;
    db = executeCommand(db, { type: 'appointment.status', id, status: 'Confirmada' }, admin);
    db = executeCommand(
      db,
      {
        type: 'admission.create',
        patientId: 'p7',
        appointmentId: id,
        service: 'Medicina geral',
        reason: 'Teste',
      },
      admin,
    );
    expect(db.appointments.at(-1)?.status).toBe('Admitida');
    expect(db.episodes.at(-1)?.appointmentId).toBe(id);
    expect(db.episodes.at(-1)?.status).toBe('Aguarda triagem');
    expect(databaseSchema.parse(JSON.parse(JSON.stringify(db)))).toEqual(db);
  });
  it('rejeita sobreposição do profissional ou paciente, incluindo intervalo parcial', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        {
          type: 'appointment.save',
          patientId: 'p7',
          professionalId: 'med-1',
          date: today(),
          time: '08:15',
          reason: 'Teste',
        },
        admin,
      ),
    ).toThrow('Horário indisponível');
    expect(() =>
      executeCommand(
        createSeed(),
        {
          type: 'appointment.save',
          patientId: 'p3',
          professionalId: 'med-2',
          date: today(),
          time: '09:15',
          reason: 'Teste',
        },
        admin,
      ),
    ).toThrow('Horário indisponível');
  });
  it('permite consultas consecutivas no limite de 30 minutos', () => {
    expect(
      executeCommand(
        createSeed(),
        {
          type: 'appointment.save',
          patientId: 'p7',
          professionalId: 'med-1',
          date: today(),
          time: '08:30',
          reason: 'Teste',
        },
        admin,
      ).revision,
    ).toBe(1);
  });
  it('reagendar remove confirmação e preserva paciente e identificador', () => {
    const db = executeCommand(
      createSeed(),
      {
        type: 'appointment.save',
        id: 'a3',
        patientId: 'p3',
        professionalId: 'med-3',
        date: dayOffset(2),
        time: '11:30',
        reason: 'Reagendamento',
      },
      admin,
    );
    expect(db.appointments.find((a) => a.id === 'a3')?.status).toBe('Marcada');
    expect(db.appointments).toHaveLength(7);
  });
  it('cancelar exige motivo e não apaga a marcação; não pode confirmar canceladas', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'appointment.status', id: 'a3', status: 'Cancelada' },
        admin,
      ),
    ).toThrow('motivo');
    const db = executeCommand(
      createSeed(),
      { type: 'appointment.status', id: 'a3', status: 'Cancelada', reason: 'Pedido do paciente' },
      admin,
    );
    expect(db.appointments).toHaveLength(7);
    expect(db.audit[0].detail).toBe('Pedido do paciente');
    expect(() =>
      executeCommand(db, { type: 'appointment.status', id: 'a3', status: 'Confirmada' }, admin),
    ).toThrow('Transição');
  });
  it('impede admissão dupla e de consulta futura sem modificar a marcação', () => {
    const db = createSeed();
    expect(() =>
      executeCommand(
        db,
        { type: 'admission.create', patientId: 'p1', service: 'Urgência', reason: 'Teste' },
        admin,
      ),
    ).toThrow('episódio activo');
    expect(() =>
      executeCommand(
        db,
        {
          type: 'admission.create',
          patientId: 'p7',
          appointmentId: 'a6',
          service: 'Medicina geral',
          reason: 'Teste',
        },
        admin,
      ),
    ).toThrow('para hoje');
    expect(db.appointments.find((a) => a.id === 'a6')?.status).toBe('Marcada');
  });
  it('rejeita marcação passada, data impossível e paciente inexistente', () => {
    const command = {
      type: 'appointment.save' as const,
      patientId: 'p7',
      professionalId: 'med-1',
      date: dayOffset(-1),
      time: '12:00',
      reason: 'Teste',
    };
    expect(() => executeCommand(createSeed(), command, admin)).toThrow('passada');
    expect(() => executeCommand(createSeed(), { ...command, date: '2027-02-30' }, admin)).toThrow(
      'data',
    );
    expect(() => executeCommand(createSeed(), { ...command, patientId: 'missing' }, admin)).toThrow(
      'Paciente não encontrado',
    );
  });
});
