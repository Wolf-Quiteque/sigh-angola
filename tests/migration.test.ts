import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '@/domain/seed';
import { repository, STORAGE_KEY } from '@/lib/repository';

afterEach(() => vi.unstubAllGlobals());
describe('Migração de esquema', () => {
  it('preserva os registos existentes e acrescenta colecções clínicas', async () => {
    const current = createSeed();
    const legacy = { ...current, version: 1, revision: 12 } as Record<string, unknown>;
    delete legacy.triages;
    delete legacy.consultations;
    delete legacy.exams;
    delete legacy.wards;
    delete legacy.beds;
    delete legacy.admissions;
    delete legacy.suppliers;
    delete legacy.products;
    delete legacy.batches;
    delete legacy.movements;
    delete legacy.services;
    delete legacy.insurers;
    delete legacy.invoices;
    delete legacy.cash;
    delete legacy.staff;
    delete legacy.shifts;
    delete legacy.attendance;
    delete legacy.absences;
    delete legacy.users;
    delete legacy.access;
    delete legacy.network;
    const values = new Map([[STORAGE_KEY, JSON.stringify(legacy)]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('navigator', {
      locks: { request: async (_key: string, callback: () => unknown) => callback() },
    });
    const migrated = await repository.load();
    expect(migrated.version).toBe(7);
    expect(migrated.revision).toBe(12);
    expect(migrated.patients).toHaveLength(current.patients.length);
    expect(migrated.appointments).toHaveLength(current.appointments.length);
    expect(migrated.triages).toEqual([]);
    expect(migrated.consultations).toEqual([]);
    expect(migrated.exams).toEqual([]);
    expect(migrated.admissions).toEqual([]);
    // Enfermarias e camas são dados de referência: a migração repõe-nos em vez de os deixar vazios.
    expect(migrated.wards).toEqual(current.wards);
    expect(migrated.beds.every((b) => b.status !== 'Ocupada')).toBe(true);
    expect(migrated.products).toEqual(current.products);
    expect(migrated.services).toEqual(current.services);
    expect(migrated.staff).toEqual(current.staff);
    expect(migrated.invoices).toEqual([]);
    expect(migrated.cash).toEqual([]);
    expect(migrated.users).toEqual(current.users);
    expect(migrated.access).toEqual([]);
    expect(migrated.consultations.every((c) => c.prescriptions.every((p) => p.quantity >= 0))).toBe(
      true,
    );
  });
});
