import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import { computeIndicators, consultationsBySpecialty, dataQuality } from '@/domain/indicators';
import type { Database, Session } from '@/domain/schema';
import { dayOffset, today } from '@/lib/format';

const admin: Session = { name: 'Ana Teste', role: 'Administrador' };
const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const management: Session = { name: 'Isabel Teste', role: 'Direcção' };
const run = (db: Database, command: Command, session: Session, now?: string) =>
  executeCommand(db, command, session, now);
const range = { start: dayOffset(-30), end: today() };
const value = (db: Database, key: string) =>
  computeIndicators(db, range).find((i) => i.key === key)!.value;

describe('Fase 7: indicadores', () => {
  it('conta apenas ocorrências dentro do intervalo pedido', () => {
    const db = createSeed();
    expect(value(db, 'consultations')).toBe(2);
    const narrow = computeIndicators(db, { start: today(), end: today() });
    expect(narrow.find((i) => i.key === 'consultations')!.value).toBe(0);
    const wide = computeIndicators(db, { start: dayOffset(-365), end: today() });
    expect(wide.find((i) => i.key === 'consultations')!.value).toBe(2);
  });

  it('reconcilia a ocupação com o mapa de camas e explicita o denominador', () => {
    const db = createSeed();
    const operational = db.beds.filter((b) => ['Livre', 'Ocupada'].includes(b.status)).length;
    const occupied = db.beds.filter((b) => b.status === 'Ocupada').length;
    const indicator = computeIndicators(db, range).find((i) => i.key === 'occupancy')!;
    expect(indicator.value).toBeCloseTo((occupied / operational) * 100, 5);
    expect(indicator.definition).toContain(String(operational));
    expect(operational).toBeLessThan(db.beds.length);
  });

  it('acompanha altas, óbitos e mortalidade a partir dos internamentos', () => {
    let db = createSeed();
    expect(value(db, 'discharges')).toBe(0);
    expect(value(db, 'mortality')).toBe(0);
    db = run(
      db,
      {
        type: 'inpatient.discharge',
        admissionId: 'adm1',
        outcome: 'Óbito',
        destination: '',
        notes: '',
      },
      doctor,
    );
    expect(value(db, 'discharges')).toBe(1);
    expect(value(db, 'deaths')).toBe(1);
    expect(value(db, 'mortality')).toBe(100);
    expect(value(db, 'stay')).toBeGreaterThan(0);
  });

  it('conta exames, consumo de medicamentos e referências dos mesmos registos', () => {
    const db = createSeed();
    expect(value(db, 'exams')).toBe(db.exams.length);
    expect(value(db, 'validated')).toBe(db.exams.filter((e) => e.status === 'Validado').length);
    const dispensed = run(
      db,
      {
        type: 'pharmacy.dispense',
        consultationId: 'c2',
        prescriptionItemId: 'rx3',
        batchId: 'b-sf-1',
        quantity: 3,
      },
      { name: 'Farm. Teste', role: 'Farmacêutico' },
    );
    expect(value(dispensed, 'dispensations')).toBe(3);
    const referred = run(
      db,
      {
        type: 'inpatient.discharge',
        admissionId: 'adm1',
        outcome: 'Transferência para outra unidade',
        destination: 'Hospital Provincial da Huíla',
        notes: 'Necessita de cuidados diferenciados.',
      },
      doctor,
    );
    expect(value(referred, 'referrals')).toBe(1);
    expect(value(referred, 'counterReferrals')).toBe(1);
  });

  it('distribui consultas por especialidade sem perder nenhuma', () => {
    const db = createSeed();
    const rows = consultationsBySpecialty(db, range);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(value(db, 'consultations'));
    expect(rows[0].specialty).toBe('Medicina geral');
  });

  it('assinala lacunas reais de qualidade de dados', () => {
    const db = createSeed();
    const checks = dataQuality(db, today());
    const document = checks.find((c) => c.key === 'document')!;
    expect(document.value).toBe(db.patients.filter((p) => !p.document).length);
    expect(document.total).toBe(db.patients.length);
    expect(checks.find((c) => c.key === 'stock')!.value).toBeGreaterThan(0);
  });
});

describe('Fase 7: utilizadores e auditoria de acesso', () => {
  it('cria utilizadores com nome de utilizador único e válido', () => {
    const base = {
      type: 'user.save' as const,
      name: 'Maria Sebastião',
      role: 'Recepcionista' as const,
      staffId: null,
      active: true,
    };
    const db = run(createSeed(), { ...base, username: 'Maria.Sebastiao' }, admin);
    expect(db.users.find((u) => u.username === 'maria.sebastiao')?.name).toBe('Maria Sebastião');
    expect(() => run(db, { ...base, username: 'ana.manuel' }, admin)).toThrow('já está atribuído');
    expect(() => run(db, { ...base, username: 'Maria Sebastião' }, admin)).toThrow('minúsculas');
    expect(() => run(db, { ...base, username: 'outro.nome', staffId: 'st-999' }, admin)).toThrow(
      'Colaborador não encontrado',
    );
  });

  it('impede ficar sem administrador activo', () => {
    const db = createSeed();
    const change = {
      type: 'user.save' as const,
      id: 'u-1',
      name: 'Ana Manuel',
      username: 'ana.manuel',
      staffId: null,
    };
    expect(() => run(db, { ...change, role: 'Recepcionista', active: true }, admin)).toThrow(
      'pelo menos um administrador',
    );
    expect(() => run(db, { ...change, role: 'Administrador', active: false }, admin)).toThrow(
      'pelo menos um administrador',
    );
    const withSecond = run(
      db,
      {
        type: 'user.save',
        name: 'Segundo Administrador',
        username: 'segundo.admin',
        role: 'Administrador',
        staffId: null,
        active: true,
      },
      admin,
    );
    const demoted = run(withSecond, { ...change, role: 'Recepcionista', active: true }, admin);
    expect(demoted.users.find((u) => u.id === 'u-1')?.role).toBe('Recepcionista');
  });

  it('só o administrador gere utilizadores e recuperações', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        {
          type: 'user.save',
          name: 'Teste Perfil',
          username: 'teste.perfil',
          role: 'Médico',
          staffId: null,
          active: true,
        },
        doctor,
      ),
    ).toThrow('Apenas o administrador');
    expect(() => run(db, { type: 'user.reset', userId: 'u-2' }, doctor)).toThrow(
      'Apenas o administrador',
    );
    const reset = run(db, { type: 'user.reset', userId: 'u-2' }, admin);
    expect(reset.users.find((u) => u.id === 'u-2')?.resetRequestedAt).toBeTruthy();
    expect(reset.audit[0].action).toBe('Recuperação de acesso simulada');
    const inactive = run(
      reset,
      {
        type: 'user.save',
        id: 'u-2',
        name: 'João Domingos',
        username: 'joao.domingos',
        role: 'Recepcionista',
        staffId: 'st-8',
        active: false,
      },
      admin,
    );
    expect(() => run(inactive, { type: 'user.reset', userId: 'u-2' }, admin)).toThrow('inactivo');
  });

  it('regista acessos em qualquer perfil, incluindo o de leitura, sem duplicar', () => {
    const start = new Date();
    const first = run(
      createSeed(),
      { type: 'access.log', area: 'Ficha do paciente', subject: 'SIGH-000001 · Esperança' },
      management,
      start.toISOString(),
    );
    expect(first.access[0].actor).toBe('Isabel Teste');
    expect(first.access[0].role).toBe('Direcção');
    // O mesmo acesso, no minuto seguinte, não cria um segundo registo.
    const repeated = run(
      first,
      { type: 'access.log', area: 'Ficha do paciente', subject: 'SIGH-000001 · Esperança' },
      management,
      new Date(start.getTime() + 20000).toISOString(),
    );
    expect(repeated.access).toHaveLength(first.access.length);
    expect(repeated.revision).toBe(first.revision);
    const later = run(
      first,
      { type: 'access.log', area: 'Ficha do paciente', subject: 'SIGH-000001 · Esperança' },
      management,
      new Date(start.getTime() + 120000).toISOString(),
    );
    expect(later.access.length).toBe(first.access.length + 1);
  });

  it('o registo de acesso não altera dados nem passa pela auditoria de alterações', () => {
    const before = createSeed();
    const after = run(
      before,
      { type: 'access.log', area: 'Indicadores', subject: 'Resumo da unidade' },
      management,
    );
    expect(after.audit).toEqual(before.audit);
    expect(after.patients).toEqual(before.patients);
    expect(after.episodes).toEqual(before.episodes);
  });

  it('mantém o cenário inicial coerente entre utilizadores e colaboradores', () => {
    const db = createSeed();
    expect(db.users.filter((u) => u.role === 'Administrador' && u.active).length).toBeGreaterThan(
      0,
    );
    for (const user of db.users)
      if (user.staffId) expect(db.staff.some((s) => s.id === user.staffId)).toBe(true);
    expect(new Set(db.users.map((u) => u.username)).size).toBe(db.users.length);
    expect(db.network.every((u) => u.occupiedBeds <= u.beds)).toBe(true);
  });
});
