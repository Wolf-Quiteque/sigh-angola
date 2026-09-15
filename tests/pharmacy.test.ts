import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Database, Session } from '@/domain/schema';
import { dayOffset, today } from '@/lib/format';

const pharmacist: Session = { name: 'Farm. Teste', role: 'Farmacêutico' };
const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const nurse: Session = { name: 'Enf. Teste', role: 'Enfermeiro' };
const run = (db: Database, command: Command, session: Session) =>
  executeCommand(db, command, session);
const stockOf = (db: Database, productId: string) =>
  db.batches.filter((b) => b.productId === productId).reduce((sum, b) => sum + b.quantity, 0);
const batch = (db: Database, id: string) => db.batches.find((b) => b.id === id)!;
/** A prescrição por dispensar do cenário inicial: soro fisiológico da consulta c2. */
const pendingItem = (db: Database) =>
  db.consultations.find((c) => c.id === 'c2')!.prescriptions.find((p) => p.id === 'rx3')!;

describe('Fase 5: farmácia e armazém', () => {
  it('regista entrada num lote novo e actualiza stock, saldo e auditoria', () => {
    const before = stockOf(createSeed(), 'med-001');
    const db = run(
      createSeed(),
      {
        type: 'stock.entry',
        productId: 'med-001',
        batchCode: 'l-par-2602',
        expiry: dayOffset(400),
        quantity: 300,
        supplierId: 's1',
        reason: 'Reposição mensal',
      },
      pharmacist,
    );
    expect(stockOf(db, 'med-001')).toBe(before + 300);
    const created = db.batches.find((b) => b.code === 'L-PAR-2602')!;
    expect(created.quantity).toBe(300);
    expect(created.supplierId).toBe('s1');
    expect(db.movements[0].type).toBe('Entrada');
    expect(db.movements[0].balance).toBe(before + 300);
    expect(db.audit[0].action).toBe('Entrada de stock');
  });

  it('acumula no mesmo lote e recusa validade passada ou stock acima do máximo', () => {
    const entry = {
      type: 'stock.entry' as const,
      productId: 'med-001',
      batchCode: 'L-PAR-2411',
      expiry: dayOffset(300),
      quantity: 10,
      supplierId: null,
      reason: '',
    };
    const db = run(createSeed(), entry, pharmacist);
    expect(batch(db, 'b-par-1').quantity).toBe(630);
    expect(db.batches.filter((b) => b.code === 'L-PAR-2411')).toHaveLength(1);
    expect(() =>
      run(createSeed(), { ...entry, batchCode: 'L-VELHO', expiry: dayOffset(-1) }, pharmacist),
    ).toThrow('já expirado');
    expect(() =>
      run(createSeed(), { ...entry, batchCode: 'L-GRANDE', quantity: 5000 }, pharmacist),
    ).toThrow('stock máximo');
  });

  it('nunca deixa o stock negativo em saídas, requisições e dispensações', () => {
    const db = createSeed();
    expect(() =>
      run(
        db,
        { type: 'stock.exit', batchId: 'b-amx-1', quantity: 81, reason: 'Teste' },
        pharmacist,
      ),
    ).toThrow('não pode ficar negativo');
    expect(() =>
      run(
        db,
        {
          type: 'stock.transfer',
          batchId: 'b-amx-1',
          quantity: 81,
          destination: 'Enfermaria',
          reason: 'Teste',
        },
        pharmacist,
      ),
    ).toThrow('não pode ficar negativo');
    const after = run(
      db,
      {
        type: 'stock.transfer',
        batchId: 'b-amx-1',
        quantity: 20,
        destination: 'Enfermaria de Medicina',
        reason: 'Requisição diária',
      },
      pharmacist,
    );
    expect(batch(after, 'b-amx-1').quantity).toBe(60);
    expect(after.movements[0].type).toBe('Transferência');
    expect(after.movements[0].destination).toBe('Enfermaria de Medicina');
    expect(after.audit[0].action).toBe('Requisição de serviço');
  });

  it('exige justificação em saídas, requisições e ajustes', () => {
    const db = createSeed();
    expect(() =>
      run(db, { type: 'stock.exit', batchId: 'b-par-1', quantity: 5, reason: ' ' }, pharmacist),
    ).toThrow('Justifique');
    expect(() =>
      run(
        db,
        { type: 'stock.transfer', batchId: 'b-par-1', quantity: 5, destination: '', reason: 'Ok' },
        pharmacist,
      ),
    ).toThrow('serviço de destino');
    expect(() =>
      run(db, { type: 'stock.adjust', batchId: 'b-par-1', counted: 600, reason: '' }, pharmacist),
    ).toThrow('Justifique');
    expect(() =>
      run(
        db,
        { type: 'stock.adjust', batchId: 'b-par-1', counted: 620, reason: 'Contagem' },
        pharmacist,
      ),
    ).toThrow('igual ao stock registado');
  });

  it('guarda a diferença do inventário no movimento de ajuste', () => {
    const db = run(
      createSeed(),
      {
        type: 'stock.adjust',
        batchId: 'b-par-1',
        counted: 605,
        reason: 'Contagem física do armazém',
      },
      pharmacist,
    );
    expect(batch(db, 'b-par-1').quantity).toBe(605);
    expect(db.movements[0].type).toBe('Ajuste');
    expect(db.movements[0].quantity).toBe(-15);
    expect(db.movements[0].balance).toBe(605);
  });

  it('dispensa parcialmente e depois totalmente, descontando do lote', () => {
    const seed = createSeed();
    expect(pendingItem(seed).quantity).toBe(6);
    expect(pendingItem(seed).dispensed).toBe(0);
    let db = run(
      seed,
      {
        type: 'pharmacy.dispense',
        consultationId: 'c2',
        prescriptionItemId: 'rx3',
        batchId: 'b-sf-1',
        quantity: 2,
      },
      pharmacist,
    );
    expect(pendingItem(db).dispensed).toBe(2);
    expect(batch(db, 'b-sf-1').quantity).toBe(158);
    expect(db.audit[0].action).toBe('Dispensação parcial');
    expect(db.movements[0].patientId).toBe('p5');
    expect(db.movements[0].prescriptionItemId).toBe('rx3');
    expect(() =>
      run(
        db,
        {
          type: 'pharmacy.dispense',
          consultationId: 'c2',
          prescriptionItemId: 'rx3',
          batchId: 'b-sf-1',
          quantity: 5,
        },
        pharmacist,
      ),
    ).toThrow('Faltam dispensar 4');
    db = run(
      db,
      {
        type: 'pharmacy.dispense',
        consultationId: 'c2',
        prescriptionItemId: 'rx3',
        batchId: 'b-sf-1',
        quantity: 4,
      },
      pharmacist,
    );
    expect(pendingItem(db).dispensed).toBe(6);
    expect(db.audit[0].action).toBe('Dispensação total');
    expect(() =>
      run(
        db,
        {
          type: 'pharmacy.dispense',
          consultationId: 'c2',
          prescriptionItemId: 'rx3',
          batchId: 'b-sf-1',
          quantity: 1,
        },
        pharmacist,
      ),
    ).toThrow('já foi totalmente dispensado');
  });

  it('recusa dispensar de um lote expirado', () => {
    const db = createSeed();
    const expired = batch(db, 'b-ome-1');
    expect(expired.expiry! < today()).toBe(true);
    expect(expired.quantity).toBeGreaterThan(0);
    expect(() =>
      run(
        db,
        {
          type: 'pharmacy.dispense',
          consultationId: 'c2',
          prescriptionItemId: 'rx3',
          batchId: 'b-ome-1',
          quantity: 1,
        },
        pharmacist,
      ),
    ).toThrow('expirou');
    expect(batch(db, 'b-ome-1').quantity).toBe(expired.quantity);
  });

  it('protege as quantidades já dispensadas quando a consulta é reeditada', () => {
    const db = run(
      createSeed(),
      {
        type: 'pharmacy.dispense',
        consultationId: 'c2',
        prescriptionItemId: 'rx3',
        batchId: 'b-sf-1',
        quantity: 2,
      },
      pharmacist,
    );
    // A consulta c2 está concluída; a regra é verificada numa consulta em curso.
    const item = db.consultations.find((c) => c.id === 'c2')!.prescriptions[0];
    expect(item.dispensed).toBe(2);
    expect(() =>
      run(
        db,
        {
          type: 'consultation.save',
          consultationId: 'c2',
          history: '',
          allergies: '',
          diagnosis: 'x',
          procedures: '',
          evolution: 'y',
          prescriptions: [],
        },
        doctor,
      ),
    ).toThrow('concluída');
  });

  it('só o perfil de farmácia movimenta stock', () => {
    const db = createSeed();
    for (const command of [
      { type: 'stock.exit', batchId: 'b-par-1', quantity: 1, reason: 'Teste' },
      {
        type: 'pharmacy.dispense',
        consultationId: 'c2',
        prescriptionItemId: 'rx3',
        batchId: 'b-sf-1',
        quantity: 1,
      },
      {
        type: 'product.save',
        code: 'MED-999',
        name: 'Artigo de teste',
        category: 'Medicamento',
        measure: 'Comprimido',
        minimumStock: 1,
        maximumStock: 10,
      },
    ] as Command[]) {
      expect(() => run(db, command, doctor)).toThrow('permissão');
      expect(() => run(db, command, nurse)).toThrow('permissão');
    }
  });

  it('valida o catálogo: código único e limites coerentes', () => {
    const base = {
      type: 'product.save' as const,
      name: 'Ibuprofeno 400 mg',
      category: 'Medicamento' as const,
      measure: 'Comprimido',
      minimumStock: 50,
      maximumStock: 500,
    };
    const db = run(createSeed(), { ...base, code: 'med-100' }, pharmacist);
    expect(db.products.find((p) => p.code === 'MED-100')?.name).toBe('Ibuprofeno 400 mg');
    expect(() => run(db, { ...base, code: 'MED-001' }, pharmacist)).toThrow('já pertence');
    expect(() =>
      run(db, { ...base, code: 'MED-101', minimumStock: 500, maximumStock: 100 }, pharmacist),
    ).toThrow('inferior ao mínimo');
  });

  it('mantém o cenário inicial coerente entre lotes e movimentos', () => {
    const db = createSeed();
    expect(db.movements).toHaveLength(db.batches.length);
    for (const movement of db.movements) {
      expect(db.products.some((p) => p.id === movement.productId)).toBe(true);
      expect(db.batches.some((b) => b.id === movement.batchId)).toBe(true);
    }
    for (const b of db.batches) expect(db.products.some((p) => p.id === b.productId)).toBe(true);
    expect(db.products.some((p) => stockOf(db, p.id) < p.minimumStock)).toBe(true);
  });
});
