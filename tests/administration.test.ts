import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Database, Session } from '@/domain/schema';
import { dayOffset, today } from '@/lib/format';

const clerk: Session = { name: 'Sr. Teste', role: 'Administrativo' };
const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const management: Session = { name: 'Direcção', role: 'Direcção' };
const run = (db: Database, command: Command, session: Session, now?: string) =>
  executeCommand(db, command, session, now);
const balance = (db: Database) =>
  db.cash.reduce((sum, c) => sum + (c.type === 'Receita' ? c.amount : -c.amount), 0);
const lastInvoice = (db: Database) => db.invoices[db.invoices.length - 1];
const openInvoice = (db: Database) => db.invoices.find((i) => i.id === 'inv-2')!;

describe('Fase 6: finanças', () => {
  it('emite factura a partir da tabela de serviços e aplica a comparticipação', () => {
    const db = run(
      createSeed(),
      {
        type: 'invoice.issue',
        patientId: 'p1',
        episodeId: 'e1',
        insurerId: 'ins-2',
        lines: [
          { serviceId: 'srv-001', quantity: 1 },
          { serviceId: 'srv-004', quantity: 2 },
        ],
      },
      clerk,
    );
    const invoice = lastInvoice(db);
    expect(invoice.subtotal).toBe(5000 + 3500 * 2);
    expect(invoice.covered).toBe(Math.floor(12000 * 0.6));
    expect(invoice.due).toBe(12000 - Math.floor(12000 * 0.6));
    expect(invoice.status).toBe('Emitida');
    expect(invoice.number).toMatch(/^FT-\d{6}$/);
    expect(db.audit[0].action).toBe('Factura emitida');
  });

  it('recusa factura sem linhas, com serviço inexistente ou paciente de outra unidade', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        { type: 'invoice.issue', patientId: 'p1', episodeId: null, insurerId: null, lines: [] },
        clerk,
      ),
    ).toThrow('pelo menos um serviço');
    expect(() =>
      run(
        db,
        {
          type: 'invoice.issue',
          patientId: 'p1',
          episodeId: null,
          insurerId: null,
          lines: [{ serviceId: 'srv-999', quantity: 1 }],
        },
        clerk,
      ),
    ).toThrow('Serviço não encontrado');
    expect(() =>
      run(
        db,
        {
          type: 'invoice.issue',
          patientId: 'inexistente',
          episodeId: null,
          insurerId: null,
          lines: [{ serviceId: 'srv-001', quantity: 1 }],
        },
        clerk,
      ),
    ).toThrow('Paciente não encontrado');
  });

  it('paga parcialmente, depois na totalidade, e reconcilia o saldo de caixa', () => {
    const seed = createSeed();
    const before = balance(seed);
    const due = openInvoice(seed).due;
    let db = run(
      seed,
      { type: 'invoice.pay', invoiceId: 'inv-2', amount: 3000, method: 'Numerário' },
      clerk,
    );
    expect(openInvoice(db).status).toBe('Parcialmente paga');
    expect(openInvoice(db).payments[0].receipt).toMatch(/^REC-\d{6}$/);
    expect(balance(db)).toBe(before + 3000);
    expect(() =>
      run(
        db,
        { type: 'invoice.pay', invoiceId: 'inv-2', amount: due, method: 'Multicaixa' },
        clerk,
      ),
    ).toThrow('não pode exceder');
    db = run(
      db,
      { type: 'invoice.pay', invoiceId: 'inv-2', amount: due - 3000, method: 'Multicaixa' },
      clerk,
    );
    expect(openInvoice(db).status).toBe('Paga');
    expect(balance(db)).toBe(before + due);
    expect(() =>
      run(db, { type: 'invoice.pay', invoiceId: 'inv-2', amount: 100, method: 'Numerário' }, clerk),
    ).toThrow('já está paga');
  });

  it('rejeita o mesmo pagamento repetido em menos de dois minutos', () => {
    const start = new Date();
    const db = run(
      createSeed(),
      { type: 'invoice.pay', invoiceId: 'inv-2', amount: 1000, method: 'Numerário' },
      clerk,
      start.toISOString(),
    );
    const soon = new Date(start.getTime() + 30000).toISOString();
    expect(() =>
      run(
        db,
        { type: 'invoice.pay', invoiceId: 'inv-2', amount: 1000, method: 'Numerário' },
        clerk,
        soon,
      ),
    ).toThrow('menos de dois minutos');
    const later = new Date(start.getTime() + 180000).toISOString();
    const second = run(
      db,
      { type: 'invoice.pay', invoiceId: 'inv-2', amount: 1000, method: 'Numerário' },
      clerk,
      later,
    );
    expect(openInvoice(second).payments).toHaveLength(2);
  });

  it('anula apenas facturas sem pagamentos e com motivo', () => {
    const db = createSeed();
    expect(() =>
      run(db, { type: 'invoice.cancel', invoiceId: 'inv-1', reason: 'Erro de emissão' }, clerk),
    ).toThrow('com pagamentos');
    expect(() =>
      run(db, { type: 'invoice.cancel', invoiceId: 'inv-2', reason: 'x' }, clerk),
    ).toThrow('motivo da anulação');
    const cancelled = run(
      db,
      { type: 'invoice.cancel', invoiceId: 'inv-2', reason: 'Serviços facturados em duplicado.' },
      clerk,
    );
    expect(openInvoice(cancelled).status).toBe('Anulada');
    expect(() =>
      run(
        cancelled,
        { type: 'invoice.pay', invoiceId: 'inv-2', amount: 100, method: 'Numerário' },
        clerk,
      ),
    ).toThrow('anulada');
  });

  it('regista receitas e despesas de caixa com valor positivo', () => {
    const seed = createSeed();
    const before = balance(seed);
    const db = run(
      seed,
      {
        type: 'cash.entry',
        entryType: 'Despesa',
        category: 'Combustível',
        description: 'Gasóleo para o gerador',
        amount: 60000,
        method: 'Numerário',
      },
      clerk,
    );
    expect(balance(db)).toBe(before - 60000);
    expect(() =>
      run(
        db,
        {
          type: 'cash.entry',
          entryType: 'Receita',
          category: 'Teste',
          description: 'Valor inválido',
          amount: 0,
          method: 'Numerário',
        },
        clerk,
      ),
    ).toThrow('positivo');
  });

  it('valida a tabela de serviços e restringe o perfil', () => {
    const base = {
      type: 'service.save' as const,
      name: 'Consulta de dermatologia',
      category: 'Consulta' as const,
      price: 7000,
    };
    const db = run(createSeed(), { ...base, code: 'srv-020' }, clerk);
    expect(db.services.find((s) => s.code === 'SRV-020')?.price).toBe(7000);
    expect(() => run(db, { ...base, code: 'SRV-001' }, clerk)).toThrow('já pertence');
    expect(() => run(db, { ...base, code: 'SRV-021' }, doctor)).toThrow('permissão');
    expect(() => run(db, { ...base, code: 'SRV-021' }, management)).toThrow('apenas de leitura');
  });

  it('mantém o cenário inicial com saldo coerente com as facturas', () => {
    const db = createSeed();
    const fromInvoices = db.cash.filter((c) => c.invoiceId).reduce((s, c) => s + c.amount, 0);
    const paid = db.invoices.reduce(
      (sum, i) => sum + i.payments.reduce((s, p) => s + p.amount, 0),
      0,
    );
    expect(fromInvoices).toBe(paid);
    for (const invoice of db.invoices) {
      expect(invoice.subtotal).toBe(invoice.lines.reduce((s, l) => s + l.total, 0));
      expect(invoice.due).toBe(invoice.subtotal - invoice.covered);
      expect(db.patients.some((p) => p.id === invoice.patientId)).toBe(true);
    }
  });
});

describe('Fase 6: recursos humanos', () => {
  const tomorrow = dayOffset(1);
  it('atribui turnos e recusa sobreposições no mesmo colaborador', () => {
    let db = run(
      createSeed(),
      {
        type: 'shift.save',
        staffId: 'st-5',
        date: tomorrow,
        start: '08:00',
        end: '14:00',
        department: 'Urgência',
      },
      clerk,
    );
    expect(
      db.shifts.some((s) => s.staffId === 'st-5' && s.date === tomorrow && s.start === '08:00'),
    ).toBe(true);
    expect(() =>
      run(
        db,
        {
          type: 'shift.save',
          staffId: 'st-5',
          date: tomorrow,
          start: '13:00',
          end: '18:00',
          department: 'Urgência',
        },
        clerk,
      ),
    ).toThrow('turno sobreposto');
    db = run(
      db,
      {
        type: 'shift.save',
        staffId: 'st-5',
        date: tomorrow,
        start: '14:00',
        end: '18:00',
        department: 'Urgência',
      },
      clerk,
    );
    // Além dos dois turnos criados aqui, o cenário inicial já escala a Teresa às 20:00.
    expect(db.shifts.filter((s) => s.staffId === 'st-5' && s.date === tomorrow)).toHaveLength(3);
  });

  it('recusa turnos inválidos, no passado ou durante uma ausência', () => {
    const db = createSeed();
    const shift = {
      type: 'shift.save' as const,
      staffId: 'st-5',
      date: tomorrow,
      start: '14:00',
      end: '08:00',
      department: 'Urgência',
    };
    expect(() => run(db, shift, clerk)).toThrow('posterior');
    expect(() => run(db, { ...shift, end: '18:00', date: dayOffset(-1) }, clerk)).toThrow(
      'passada',
    );
    // st-2 está de férias entre +5 e +19 no cenário inicial.
    expect(() =>
      run(db, { ...shift, staffId: 'st-2', end: '18:00', date: dayOffset(7) }, clerk),
    ).toThrow('férias');
  });

  it('recusa ausências sobrepostas ou sobre turnos já atribuídos', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        {
          type: 'absence.save',
          staffId: 'st-2',
          absenceType: 'Licença',
          start: dayOffset(6),
          end: dayOffset(8),
          note: '',
        },
        clerk,
      ),
    ).toThrow('férias');
    // st-1 tem turnos em +0, +1 e +2 no cenário inicial.
    expect(() =>
      run(
        db,
        {
          type: 'absence.save',
          staffId: 'st-1',
          absenceType: 'Férias',
          start: today(),
          end: dayOffset(10),
          note: '',
        },
        clerk,
      ),
    ).toThrow('turno(s) neste período');
    const saved = run(
      db,
      {
        type: 'absence.save',
        staffId: 'st-1',
        absenceType: 'Formação',
        start: dayOffset(20),
        end: dayOffset(22),
        note: 'Formação em gestão clínica.',
      },
      clerk,
    );
    expect(saved.absences.some((a) => a.staffId === 'st-1' && a.type === 'Formação')).toBe(true);
    expect(() =>
      run(
        db,
        {
          type: 'absence.save',
          staffId: 'st-1',
          absenceType: 'Férias',
          start: dayOffset(20),
          end: dayOffset(10),
          note: '',
        },
        clerk,
      ),
    ).toThrow('anterior ao início');
  });

  it('regista presenças apenas em dias com turno e substitui o registo do dia', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        { type: 'attendance.mark', staffId: 'st-3', date: today(), status: 'Presente', note: '' },
        clerk,
      ),
    ).toThrow('dia com turno');
    expect(() =>
      run(
        db,
        {
          type: 'attendance.mark',
          staffId: 'st-1',
          date: dayOffset(1),
          status: 'Presente',
          note: '',
        },
        clerk,
      ),
    ).toThrow('data futura');
    expect(() =>
      run(
        db,
        {
          type: 'attendance.mark',
          staffId: 'st-1',
          date: today(),
          status: 'Falta justificada',
          note: '',
        },
        clerk,
      ),
    ).toThrow('justificação');
    const updated = run(
      db,
      {
        type: 'attendance.mark',
        staffId: 'st-1',
        date: today(),
        status: 'Falta justificada',
        note: 'Deslocação a formação.',
      },
      clerk,
    );
    const records = updated.attendance.filter((a) => a.staffId === 'st-1' && a.date === today());
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('Falta justificada');
    expect(records[0].recordedBy).toBe('Sr. Teste');
  });

  it('protege colaboradores: nomes únicos, inactivação segura e turnos com presença', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        {
          type: 'staff.save',
          name: 'Enf. Carlos Vunge',
          role: 'Enfermeiro',
          department: 'Urgência',
          phone: '',
          hiredAt: today(),
          active: true,
        },
        clerk,
      ),
    ).toThrow('Já existe um colaborador');
    expect(() =>
      run(
        db,
        {
          type: 'staff.save',
          id: 'st-1',
          name: 'Dra. Helena Manuel',
          role: 'Médico',
          department: 'Medicina interna',
          phone: '923000301',
          hiredAt: dayOffset(-1200),
          active: false,
        },
        clerk,
      ),
    ).toThrow('turno(s) por cumprir');
    const withShift = db.shifts.find((s) => s.staffId === 'st-1' && s.date === today())!;
    expect(() => run(db, { type: 'shift.remove', shiftId: withShift.id }, clerk)).toThrow(
      'presença registada',
    );
    const free = db.shifts.find((s) => s.staffId === 'st-6')!;
    const removed = run(db, { type: 'shift.remove', shiftId: free.id }, clerk);
    expect(removed.shifts.some((s) => s.id === free.id)).toBe(false);
  });
});
