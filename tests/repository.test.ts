import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { repository, STORAGE_KEY } from '@/lib/repository';
import type { Command } from '@/domain/commands';
import type { Session } from '@/domain/schema';
const session: Session = { role: 'Administrador', name: 'Teste' };
const command: Command = {
  type: 'appointment.status',
  id: 'a3',
  status: 'Cancelada',
  reason: 'Teste de gravação',
};
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('navigator', {
    locks: { request: async (_key: string, callback: () => unknown) => callback() },
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('Repositório local', () => {
  it('persiste a operação e rejeita escrita de uma revisão obsoleta', async () => {
    const initial = await repository.load();
    const next = await repository.commit(command, session, initial.revision);
    expect((await repository.load()).appointments.find((a) => a.id === 'a3')?.status).toBe(
      'Cancelada',
    );
    await expect(
      repository.commit(
        { type: 'appointment.status', id: 'a4', status: 'Confirmada' },
        session,
        initial.revision,
      ),
    ).rejects.toThrow('noutro separador');
    expect((await repository.load()).revision).toBe(next.revision);
  });
  it('não anuncia sucesso nem altera dados quando a gravação falha', async () => {
    const initial = await repository.load();
    const before = values.get(STORAGE_KEY);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key),
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    await expect(repository.commit(command, session, initial.revision)).rejects.toThrow(
      'Não foi possível guardar',
    );
    expect(values.get(STORAGE_KEY)).toBe(before);
  });
  it('mantém dados inválidos recuperáveis e não permite reset pelo recepcionista', async () => {
    values.set(STORAGE_KEY, '{broken');
    await expect(repository.load()).rejects.toThrow('dados locais');
    expect(values.get(STORAGE_KEY)).toBe('{broken');
    await expect(repository.reset({ name: 'Teste', role: 'Recepcionista' })).rejects.toThrow(
      'administrador',
    );
    expect(values.get(STORAGE_KEY)).toBe('{broken');
  });
});
