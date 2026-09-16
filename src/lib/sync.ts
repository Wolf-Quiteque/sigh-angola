import type { OutboxEntry } from '@/domain/schema';
import { readRaw, writeRaw, removeRaw, SERVER_KEY } from './storage';

/**
 * Ligação ao servidor central.
 *
 * Vive numa chave de armazenamento separada da base local e guarda apenas o
 * registo das operações recebidas — nunca uma cópia do processo clínico. Serve
 * para exercitar a fila de envio, as tentativas idempotentes e os conflitos.
 * Não é, nem pretende parecer, uma sincronização real.
 */
export type ServerOperation = {
  id: string;
  at: string;
  device: string;
  user: string;
  action: string;
  entityId: string;
};
type ServerState = { operations: ServerOperation[] };

export type SyncOutcome = {
  id: string;
  state: 'Confirmado' | 'Erro' | 'Conflito';
  message: string;
};

async function readServer(): Promise<ServerState> {
  const raw = await readRaw(SERVER_KEY);
  if (!raw) return { operations: [] };
  try {
    const parsed = JSON.parse(raw) as ServerState;
    return Array.isArray(parsed.operations) ? parsed : { operations: [] };
  } catch {
    return { operations: [] };
  }
}
async function writeServer(state: ServerState) {
  await writeRaw(SERVER_KEY, JSON.stringify(state));
}
export async function serverOperations() {
  return (await readServer()).operations;
}
export async function clearServer() {
  await removeRaw(SERVER_KEY);
}

/** Coloca no servidor uma alteração feita «noutro dispositivo», para provocar conflito. */
export async function seedServerChange(entityId: string, action: string) {
  const state = await readServer();
  state.operations.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    device: 'Tablet da enfermaria',
    user: 'Enf. Teresa Lando',
    action,
    entityId,
  });
  await writeServer(state);
}

export type SyncOptions = { offline?: boolean; failNext?: boolean };

/**
 * Envia as operações e devolve o desfecho de cada uma.
 * Reenviar a mesma operação não a duplica: o identificador é a chave.
 */
export async function pushOperations(
  entries: OutboxEntry[],
  options: SyncOptions = {},
): Promise<SyncOutcome[]> {
  if (options.offline)
    return entries.map((entry) => ({
      id: entry.id,
      state: 'Erro' as const,
      message: 'Sem ligação ao servidor. A operação continua na fila e pode ser reenviada.',
    }));
  const state = await readServer();
  const outcomes: SyncOutcome[] = [];
  for (const entry of entries) {
    if (options.failNext) {
      outcomes.push({
        id: entry.id,
        state: 'Erro',
        message: 'O servidor recusou a operação. Tente novamente.',
      });
      continue;
    }
    if (state.operations.some((operation) => operation.id === entry.id)) {
      outcomes.push({
        id: entry.id,
        state: 'Confirmado',
        message: 'Já tinha sido recebida: confirmada sem duplicar.',
      });
      continue;
    }
    const clash = state.operations.find(
      (operation) =>
        operation.entityId === entry.entityId &&
        operation.device !== entry.device &&
        operation.at > entry.at,
    );
    if (clash) {
      outcomes.push({
        id: entry.id,
        state: 'Conflito',
        message: `${clash.user} alterou o mesmo registo em ${clash.device} depois desta operação.`,
      });
      continue;
    }
    state.operations.push({
      id: entry.id,
      at: entry.at,
      device: entry.device,
      user: entry.user,
      action: entry.action,
      entityId: entry.entityId,
    });
    outcomes.push({ id: entry.id, state: 'Confirmado', message: 'Recebida pelo servidor.' });
  }
  await writeServer(state);
  return outcomes;
}
