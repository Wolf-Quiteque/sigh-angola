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
    const values = new Map([[STORAGE_KEY, JSON.stringify(legacy)]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    vi.stubGlobal('navigator', {
      locks: { request: async (_key: string, callback: () => unknown) => callback() },
    });
    const migrated = await repository.load();
    expect(migrated.version).toBe(3);
    expect(migrated.revision).toBe(12);
    expect(migrated.patients).toHaveLength(current.patients.length);
    expect(migrated.appointments).toHaveLength(current.appointments.length);
    expect(migrated.triages).toEqual([]);
    expect(migrated.consultations).toEqual([]);
    expect(migrated.exams).toEqual([]);
  });
});
