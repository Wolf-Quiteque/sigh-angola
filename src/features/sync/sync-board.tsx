'use client';
import { useEffect, useState } from 'react';
import {
  CloudOff,
  CloudUpload,
  DatabaseBackup,
  HardDriveDownload,
  Repeat,
  ServerCog,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { downloadJson, storageKind } from '@/lib/repository';
import {
  pushOperations,
  seedServerChange,
  serverOperations,
  type ServerOperation,
} from '@/lib/sync';
import { outboxStates, type OutboxEntry } from '@/domain/schema';
import { ActionForm, Badge, Empty, Field, Modal, PageHeader, Panel, Status } from '@/components/ui';
import { formatDate, today } from '@/lib/format';

export function SyncBoard() {
  const { db, session, run, reload, restore } = useDemo();
  const [offline, setOffline] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [server, setServer] = useState<ServerOperation[]>([]);
  const [storage, setStorage] = useState('');
  const [conflict, setConflict] = useState<OutboxEntry | null>(null);
  const [restoreForm, setRestoreForm] = useState(false);
  useEffect(() => {
    // O adaptador em uso só é conhecido depois de uma leitura real no navegador.
    void serverOperations().then((operations) => {
      setServer(operations);
      setStorage(storageKind());
    });
  }, [db]);
  if (!db) return null;
  const count = (state: string) => db.outbox.filter((entry) => entry.state === state).length;
  const sendable = db.outbox.filter((entry) => ['Pendente', 'Erro'].includes(entry.state));
  async function synchronise() {
    setError('');
    setBusy(true);
    try {
      const batch = db!.outbox.filter((entry) => ['Pendente', 'Erro'].includes(entry.state));
      if (!batch.length) throw new Error('Não há operações por enviar.');
      await run({ type: 'sync.sending', ids: batch.map((entry) => entry.id) });
      const outcomes = await pushOperations(batch, { offline, failNext });
      await run({ type: 'sync.settle', results: outcomes });
      setServer(await serverOperations());
      setFailNext(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível sincronizar.');
      await reload();
    } finally {
      setBusy(false);
    }
  }
  async function provokeConflict() {
    setError('');
    const target = db!.outbox.find((entry) => entry.state !== 'Confirmado');
    if (!target) {
      setError('Registe primeiro uma operação para depois simular o conflito.');
      return;
    }
    await seedServerChange(target.entityId, target.action);
    setServer(await serverOperations());
  }
  return (
    <>
      <PageHeader
        eyebrow="OFFLINE E SINCRONIZAÇÃO"
        title="Fila de envio e cópias de segurança"
        description="O que está por enviar, o que já foi confirmado e como recuperar os dados desta demonstração."
      >
        <button
          className="button primary"
          disabled={busy || !sendable.length}
          onClick={() => void synchronise()}
        >
          <CloudUpload size={17} />
          {busy ? 'A sincronizar…' : 'Sincronizar agora'}
        </button>
      </PageHeader>
      <div className="stat-grid">
        {[
          {
            label: 'Por enviar',
            value: count('Pendente'),
            hint: 'Operações à espera de ligação',
            icon: CloudUpload,
            color: 'amber',
          },
          {
            label: 'Confirmadas',
            value: count('Confirmado'),
            hint: 'Recebidas pelo servidor simulado',
            icon: ServerCog,
            color: 'green',
          },
          {
            label: 'Com erro',
            value: count('Erro'),
            hint: 'Podem ser reenviadas sem duplicar',
            icon: Repeat,
            color: 'violet',
          },
          {
            label: 'Em conflito',
            value: count('Conflito'),
            hint: 'Precisam de decisão manual',
            icon: ShieldAlert,
            color: 'blue',
          },
        ].map(({ label, value, hint, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-value">{String(value).padStart(2, '0')}</strong>
            <div className="stat-hint">{hint}</div>
          </div>
        ))}
      </div>
      <Panel title="Este dispositivo" subtitle="Identidade que acompanha cada operação enviada.">
        <div className="setting-action">
          <span className="quick-icon">
            <Smartphone size={21} />
          </span>
          <div>
            <strong>{db.device.name}</strong>
            <p>
              Armazenamento: {storage || 'a determinar'} · revisão local {db.revision} ·{' '}
              {db.outbox.length} operação(ões) na fila
            </p>
          </div>
          <Badge tone={storage === 'IndexedDB' ? 'success' : 'warning'}>
            {storage === 'IndexedDB' ? 'IndexedDB' : 'localStorage'}
          </Badge>
        </div>
        <div className="sync-toggles">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={offline}
              onChange={(e) => setOffline(e.target.checked)}
            />
            <span>Simular ausência de rede no próximo envio</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={failNext}
              onChange={(e) => setFailNext(e.target.checked)}
            />
            <span>Simular recusa do servidor no próximo envio</span>
          </label>
          <button className="button secondary small" onClick={() => void provokeConflict()}>
            <ShieldAlert size={15} />
            Simular alteração noutro dispositivo
          </button>
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </Panel>
      <Panel
        title="Fila de envio"
        subtitle="Identificador, revisão, utilizador, dispositivo e instante de cada operação."
        action={
          <button
            className="button secondary small"
            disabled={!count('Confirmado')}
            onClick={() => void run({ type: 'sync.clearSettled' }).catch(() => undefined)}
          >
            Arquivar confirmadas
          </button>
        }
      >
        {db.outbox.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Operação</th>
                  <th>Origem</th>
                  <th>Estado</th>
                  <th>Mensagem</th>
                  <th className="align-right">Acção</th>
                </tr>
              </thead>
              <tbody>
                {db.outbox.slice(0, 40).map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong className="table-primary">{entry.action}</strong>
                      <small className="muted">
                        {entry.detail || '—'} · revisão {entry.revision}
                      </small>
                    </td>
                    <td>
                      {entry.user}
                      <small className="muted">
                        {entry.device} · {formatDate(entry.at, true)}
                      </small>
                    </td>
                    <td>
                      <div className="exam-state">
                        <Status value={entry.state} />
                        {entry.attempts > 0 && (
                          <small className="muted">{entry.attempts} tentativa(s)</small>
                        )}
                      </div>
                    </td>
                    <td className="wrap-cell">{entry.message || '—'}</td>
                    <td>
                      <div className="table-actions">
                        {entry.state === 'Conflito' && (
                          <button
                            className="button small primary"
                            onClick={() => setConflict(entry)}
                          >
                            Resolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Fila vazia"
            description="Cada alteração que fizer noutro ecrã aparece aqui até ser confirmada."
          />
        )}
        <div className="panel-foot">
          <span>
            <CloudOff size={14} />
            Estados possíveis: {outboxStates.join(' · ')}
          </span>
          <span>{db.outbox.length} no total</span>
        </div>
      </Panel>
      <Panel
        title="Servidor simulado"
        subtitle="Operações já recebidas, guardadas fora da base local desta demonstração."
      >
        {server.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Recebida em</th>
                  <th>Operação</th>
                  <th>Origem</th>
                  <th>Identificador</th>
                </tr>
              </thead>
              <tbody>
                {server
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((operation) => (
                    <tr key={operation.id}>
                      <td className="nowrap">{formatDate(operation.at, true)}</td>
                      <td>{operation.action}</td>
                      <td>
                        {operation.user}
                        <small className="muted">{operation.device}</small>
                      </td>
                      <td className="mono">{operation.id.slice(0, 8)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Servidor sem operações"
            description="Sincronize para o servidor simulado receber a fila."
          />
        )}
        <div className="info-line">
          <ServerCog size={16} />
          <span>
            O servidor simulado guarda apenas o registo das operações, nunca o processo clínico.
            Reenviar a mesma operação não a duplica: o identificador é a chave.
          </span>
        </div>
      </Panel>
      <div className="settings-grid">
        <Panel title="Cópia de segurança" subtitle="Exportar o estado completo desta demonstração.">
          <div className="setting-action">
            <span className="quick-icon">
              <DatabaseBackup size={21} />
            </span>
            <div>
              <strong>Descarregar cópia validada</strong>
              <p>Inclui registos, fila de envio e actividade, no formato aceite pelo restauro.</p>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                downloadJson(JSON.stringify(db, null, 2), `sigh-copia-${today()}.json`)
              }
            >
              Exportar cópia
            </button>
          </div>
        </Panel>
        <Panel title="Restaurar" subtitle="Repor a partir de uma cópia anterior.">
          <div className="setting-action">
            <span className="quick-icon">
              <HardDriveDownload size={21} />
            </span>
            <div>
              <strong>Restaurar cópia de segurança</strong>
              <p>
                A cópia é validada antes de substituir seja o que for. As operações por confirmar
                desta instalação são preservadas.
              </p>
            </div>
            <button
              className="button secondary"
              disabled={session.role !== 'Administrador'}
              onClick={() => setRestoreForm(true)}
            >
              Restaurar
            </button>
          </div>
          {session.role !== 'Administrador' && (
            <p className="form-hint">Apenas o administrador pode restaurar uma cópia.</p>
          )}
        </Panel>
      </div>
      {conflict && <ConflictForm entry={conflict} onClose={() => setConflict(null)} />}
      {restoreForm && <RestoreForm onClose={() => setRestoreForm(false)} onRestore={restore} />}
    </>
  );
}

function ConflictForm({ entry, onClose }: { entry: OutboxEntry; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title="Resolver conflito"
      description={entry.action + ' · ' + entry.detail}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Aplicar decisão"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'sync.resolve',
            id: entry.id,
            keep: String(data.get('keep')) as 'local' | 'servidor',
          })
        }
      >
        <p className="form-hint">{entry.message}</p>
        <div className="form-grid">
          <Field label="Versão a manter *" wide>
            <select name="keep" defaultValue="local" autoFocus>
              <option value="local">Manter a versão local e reenviar</option>
              <option value="servidor">Aceitar a versão do servidor</option>
            </select>
          </Field>
        </div>
        <div className="clinical-warning">
          A decisão fica registada na actividade. O servidor simulado guarda apenas operações, pelo
          que aceitar a versão do servidor marca esta operação como resolvida sem alterar os
          registos locais.
        </div>
      </ActionForm>
    </Modal>
  );
}

function RestoreForm({
  onClose,
  onRestore,
}: {
  onClose: () => void;
  onRestore: (value: string) => Promise<void>;
}) {
  return (
    <Modal
      title="Restaurar cópia de segurança"
      description="Cole o conteúdo do ficheiro exportado."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Validar e restaurar"
        onClose={onClose}
        onSubmit={async (data) => {
          const value = String(data.get('backup') ?? '').trim();
          if (!value) throw new Error('Cole o conteúdo da cópia de segurança.');
          await onRestore(value);
        }}
      >
        <div className="form-grid">
          <Field label="Conteúdo da cópia *" wide>
            <textarea autoFocus name="backup" rows={8} required />
          </Field>
        </div>
        <div className="clinical-warning">
          Se a cópia não for válida, nada é alterado. Se for, as operações por confirmar deste
          dispositivo continuam na fila.
        </div>
      </ActionForm>
    </Modal>
  );
}
