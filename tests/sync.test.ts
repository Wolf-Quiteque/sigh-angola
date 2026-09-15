import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Database, OutboxEntry, Session } from '@/domain/schema';

const admin: Session = { name: 'Ana Teste', role: 'Administrador' };
const nurse: Session = { name: 'Enf. Teste', role: 'Enfermeiro' };
const run = (db: Database, command: Command, session: Session = admin) =>
  executeCommand(db, command, session);
const triage: Command = {
  type: 'triage.save',
  episodeId: 'e1',
  chiefComplaint: 'Febre alta há dois dias',
  priority: 'Amarelo',
  temperature: 38.4,
  systolic: 118,
  diastolic: 76,
  heartRate: 96,
  respiratoryRate: 20,
  oxygenSaturation: 97,
  weight: 60,
  height: 165,
  notes: '',
};

describe('Fase 8: fila de envio', () => {
  it('regista cada alteração com identificador, revisão, utilizador e dispositivo', () => {
    const db = run(createSeed(), triage, nurse);
    expect(db.outbox).toHaveLength(1);
    const entry = db.outbox[0];
    expect(entry.id).toBe(db.audit[0].id);
    expect(entry.user).toBe('Enf. Teste');
    expect(entry.role).toBe('Enfermeiro');
    expect(entry.device).toBe(db.device.name);
    expect(entry.revision).toBe(db.revision);
    expect(entry.state).toBe('Pendente');
    expect(entry.attempts).toBe(0);
    expect(entry.action).toBe('Triagem concluída');
  });

  it('o registo de acesso não entra na fila de envio nem na auditoria', () => {
    const db = run(
      createSeed(),
      { type: 'access.log', area: 'Ficha do paciente', subject: 'SIGH-000001' },
      { name: 'Isabel', role: 'Direcção' },
    );
    expect(db.outbox).toHaveLength(0);
    expect(db.audit).toHaveLength(createSeed().audit.length);
    expect(db.access).toHaveLength(createSeed().access.length + 1);
  });

  it('as próprias operações de sincronização não voltam a entrar na fila', () => {
    let db = run(createSeed(), triage, nurse);
    const id = db.outbox[0].id;
    db = run(db, { type: 'sync.sending', ids: [id] });
    expect(db.outbox).toHaveLength(1);
    expect(db.outbox[0].state).toBe('Em envio');
    expect(db.outbox[0].attempts).toBe(1);
    expect(db.audit[0].action).toBe('Sincronização iniciada');
  });

  it('percorre pendente → em envio → confirmado e arquiva só o que está confirmado', () => {
    let db = run(createSeed(), triage, nurse);
    const id = db.outbox[0].id;
    db = run(db, { type: 'sync.sending', ids: [id] });
    db = run(db, {
      type: 'sync.settle',
      results: [{ id, state: 'Confirmado', message: 'Recebida pelo servidor.' }],
    });
    expect(db.outbox[0].state).toBe('Confirmado');
    expect(db.outbox[0].settledAt).toBeTruthy();
    db = run(db, { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' }, admin);
    expect(db.outbox.filter((e) => e.state === 'Pendente')).toHaveLength(1);
    db = run(db, { type: 'sync.clearSettled' });
    expect(db.outbox.every((e) => e.state !== 'Confirmado')).toBe(true);
    // O arquivo é uma operação de sincronização: não se acrescenta à fila.
    expect(db.outbox).toHaveLength(1);
    expect(() => run(db, { type: 'sync.clearSettled' })).toThrow('confirmadas para arquivar');
  });

  it('o erro conta a tentativa e permite reenviar sem perder a operação', () => {
    let db = run(createSeed(), triage, nurse);
    const id = db.outbox[0].id;
    db = run(db, { type: 'sync.sending', ids: [id] });
    db = run(db, {
      type: 'sync.settle',
      results: [{ id, state: 'Erro', message: 'Sem ligação.' }],
    });
    expect(db.outbox.find((e) => e.id === id)?.state).toBe('Erro');
    db = run(db, { type: 'sync.sending', ids: [id] });
    const entry = db.outbox.find((e) => e.id === id)!;
    expect(entry.state).toBe('Em envio');
    expect(entry.attempts).toBe(2);
    expect(entry.message).toBe('');
  });

  it('resolve conflitos mantendo a versão local ou aceitando a do servidor', () => {
    let db = run(createSeed(), triage, nurse);
    const id = db.outbox[0].id;
    db = run(db, { type: 'sync.sending', ids: [id] });
    expect(() => run(db, { type: 'sync.resolve', id, keep: 'local' })).toThrow(
      'não está em conflito',
    );
    db = run(db, {
      type: 'sync.settle',
      results: [{ id, state: 'Conflito', message: 'Alterado noutro dispositivo.' }],
    });
    const keptLocal = run(db, { type: 'sync.resolve', id, keep: 'local' });
    expect(keptLocal.outbox.find((e) => e.id === id)?.state).toBe('Pendente');
    const keptServer = run(db, { type: 'sync.resolve', id, keep: 'servidor' });
    expect(keptServer.outbox.find((e) => e.id === id)?.state).toBe('Confirmado');
    expect(keptServer.audit[0].action).toBe('Conflito de sincronização resolvido');
  });

  it('não envia o que não está pendente nem aplica resultados vazios', () => {
    const db = run(createSeed(), triage, nurse);
    expect(() => run(db, { type: 'sync.sending', ids: ['inexistente'] })).toThrow(
      'Não há operações por enviar',
    );
    expect(() => run(db, { type: 'sync.settle', results: [] })).toThrow('Nenhum resultado');
  });
});

describe('Fase 8: servidor simulado', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const entry = (id: string, entityId = 'e1'): OutboxEntry => ({
    id,
    unitId: 'unit-menongue',
    at: '2026-09-15T08:00:00+01:00',
    user: 'Enf. Teste',
    role: 'Enfermeiro',
    device: 'Posto de trabalho da recepção',
    revision: 1,
    action: 'Triagem concluída',
    entityId,
    detail: 'Paciente demo',
    state: 'Pendente',
    attempts: 1,
    message: '',
    settledAt: null,
  });

  it('confirma operações novas e não duplica ao reenviar a mesma', async () => {
    const { pushOperations, serverOperations } = await import('@/lib/sync');
    const first = await pushOperations([entry('op-1')]);
    expect(first[0].state).toBe('Confirmado');
    expect(await serverOperations()).toHaveLength(1);
    const retry = await pushOperations([entry('op-1')]);
    expect(retry[0].state).toBe('Confirmado');
    expect(retry[0].message).toContain('sem duplicar');
    expect(await serverOperations()).toHaveLength(1);
  });

  it('sem rede devolve erro e não escreve no servidor', async () => {
    const { pushOperations, serverOperations } = await import('@/lib/sync');
    const outcomes = await pushOperations([entry('op-2')], { offline: true });
    expect(outcomes[0].state).toBe('Erro');
    expect(outcomes[0].message).toContain('Sem ligação');
    expect(await serverOperations()).toHaveLength(0);
  });

  it('assinala conflito quando outro dispositivo alterou o mesmo registo depois', async () => {
    const { pushOperations, seedServerChange } = await import('@/lib/sync');
    await seedServerChange('e1', 'Triagem concluída');
    const outcomes = await pushOperations([entry('op-3', 'e1')]);
    expect(outcomes[0].state).toBe('Conflito');
    expect(outcomes[0].message).toContain('Tablet da enfermaria');
    const other = await pushOperations([entry('op-4', 'e2')]);
    expect(other[0].state).toBe('Confirmado');
  });

  it('a recusa do servidor não guarda a operação', async () => {
    const { pushOperations, serverOperations } = await import('@/lib/sync');
    const outcomes = await pushOperations([entry('op-5')], { failNext: true });
    expect(outcomes[0].state).toBe('Erro');
    expect(await serverOperations()).toHaveLength(0);
  });
});

describe('Fase 8: cópia de segurança e restauro', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
    vi.stubGlobal('navigator', {
      locks: { request: async (_key: string, callback: () => unknown) => callback() },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('recusa uma cópia inválida sem tocar nos dados actuais', async () => {
    const { repository } = await import('@/lib/repository');
    const before = await repository.load();
    await expect(repository.restore('{"version":1}', admin)).rejects.toThrow('não corresponde');
    await expect(repository.restore('isto não é json', admin)).rejects.toThrow('não corresponde');
    const after = await repository.load();
    expect(after.revision).toBe(before.revision);
    expect(after.patients).toEqual(before.patients);
  });

  it('só o administrador restaura', async () => {
    const { repository } = await import('@/lib/repository');
    const backup = JSON.stringify(await repository.load());
    await expect(repository.restore(backup, nurse)).rejects.toThrow('administrador');
  });

  it('restaura preservando as operações ainda por confirmar', async () => {
    const { repository } = await import('@/lib/repository');
    const initial = await repository.load();
    const backup = JSON.stringify(initial);
    const withWork = await repository.commit(triage, nurse, initial.revision);
    expect(withWork.outbox).toHaveLength(1);
    const pendingId = withWork.outbox[0].id;
    const restored = await repository.restore(backup, admin);
    expect(restored.triages).toHaveLength(initial.triages.length);
    expect(restored.outbox.some((entry) => entry.id === pendingId)).toBe(true);
    expect(restored.audit[0].action).toBe('Cópia de segurança restaurada');
    expect(restored.revision).toBeGreaterThan(withWork.revision);
    expect((await repository.load()).outbox.some((entry) => entry.id === pendingId)).toBe(true);
  });
});
