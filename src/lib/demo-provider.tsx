'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { repository, STORAGE_KEY } from './repository';
import type { Database, Role, Session } from '@/domain/schema';
import type { Command } from '@/domain/commands';

const sessions: Record<Role, Session> = {
  Administrador: { name: 'Ana Manuel', role: 'Administrador' },
  Recepcionista: { name: 'João Domingos', role: 'Recepcionista' },
  Enfermeiro: { name: 'Enf. Carlos Vunge', role: 'Enfermeiro' },
  Médico: { name: 'Dra. Helena Manuel', role: 'Médico' },
  Técnico: { name: 'Téc. Manuel Sacala', role: 'Técnico' },
  Farmacêutico: { name: 'Farm. Rosa Cahama', role: 'Farmacêutico' },
  Administrativo: { name: 'Sr. Pedro Kiala', role: 'Administrativo' },
  Direcção: { name: 'Isabel Francisco', role: 'Direcção' },
};
type Context = {
  db: Database | null;
  session: Session;
  loading: boolean;
  error: string;
  notice: string;
  setRole: (role: Role) => void;
  run: (command: Command) => Promise<void>;
  /** Executa sem notificação: usado pelo registo de acesso, que não é uma acção do utilizador. */
  runQuiet: (command: Command) => Promise<void>;
  reset: () => Promise<void>;
  reload: () => Promise<void>;
};
const DemoContext = createContext<Context | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [session, setSession] = useState<Session>(sessions.Administrador);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const reload = useCallback(async () => {
    try {
      setDb(await repository.load());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, []);
  // This effect synchronises with the asynchronous browser repository; state is set only after await.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reload]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);
  async function run(command: Command) {
    if (!db) throw new Error('Aguarde o carregamento.');
    const next = await repository.commit(command, session, db.revision);
    setDb(next);
    setNotice(next.audit[0].action + ' com sucesso.');
  }
  async function runQuiet(command: Command) {
    if (!db) return;
    try {
      setDb(await repository.commit(command, session, db.revision));
    } catch {
      // Um registo de acesso perdido não deve interromper a consulta do utilizador.
    }
  }
  async function reset() {
    const next = await repository.reset(session);
    setDb(next);
    setError('');
    setNotice('Cenário de demonstração reposto.');
  }
  return (
    <DemoContext.Provider
      value={{
        db,
        session,
        loading,
        error,
        notice,
        setRole: (role) => setSession(sessions[role]),
        run,
        runQuiet,
        reset,
        reload,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('DemoProvider em falta.');
  return value;
}
