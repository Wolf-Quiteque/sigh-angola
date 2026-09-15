'use client';
import { useState } from 'react';
import { KeyRound, LockKeyhole, Plus, ShieldCheck, UserCog } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  canConsult,
  canDiagnostics,
  canManageUsers,
  canPharmacy,
  canReception,
  canTriage,
  canWard,
  canAdministration,
  canWrite,
  roles,
  type Role,
  type User,
} from '@/domain/schema';
import {
  ActionForm,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
} from '@/components/ui';
import { formatDate, normalize } from '@/lib/format';

/** A matriz é derivada das mesmas funções que o domínio usa para autorizar. */
const capabilities: Array<{ label: string; allows: (role: Role) => boolean }> = [
  { label: 'Alterar dados', allows: (role) => canWrite({ name: '', role }) },
  { label: 'Recepção e agenda', allows: (role) => canReception({ name: '', role }) },
  { label: 'Triagem', allows: (role) => canTriage({ name: '', role }) },
  { label: 'Consulta e prescrição', allows: (role) => canConsult({ name: '', role }) },
  { label: 'Laboratório e imagiologia', allows: (role) => canDiagnostics({ name: '', role }) },
  { label: 'Cuidados de enfermaria', allows: (role) => canWard({ name: '', role }) },
  { label: 'Farmácia e armazém', allows: (role) => canPharmacy({ name: '', role }) },
  { label: 'Finanças e pessoal', allows: (role) => canAdministration({ name: '', role }) },
  { label: 'Gestão de utilizadores', allows: (role) => canManageUsers({ name: '', role }) },
];

export function UsersBoard() {
  const { db, session } = useDemo();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<User | 'new' | null>(null);
  const [reset, setReset] = useState<User | null>(null);
  if (!db) return null;
  const users = db.users
    .filter((u) => normalize(u.name + ' ' + u.username + ' ' + u.role).includes(normalize(search)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const accesses = db.access.slice(0, 25);
  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Utilizadores e permissões"
        description="Quem entra no sistema, com que perfil e o que cada perfil pode fazer."
      >
        {canManageUsers(session) && (
          <button className="button primary" onClick={() => setForm('new')}>
            <Plus size={18} />
            Novo utilizador
          </button>
        )}
      </PageHeader>
      <Panel title="Utilizadores da unidade" subtitle="Perfil, ligação ao colaborador e situação.">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar nome, utilizador ou perfil"
          />
          <Badge tone="info">{users.filter((u) => u.active).length} activos</Badge>
        </div>
        {users.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Utilizador</th>
                  <th>Perfil</th>
                  <th>Colaborador</th>
                  <th>Situação</th>
                  <th className="align-right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong className="table-primary">{user.name}</strong>
                      <small className="muted">
                        {user.username} · desde {formatDate(user.createdAt)}
                      </small>
                    </td>
                    <td>{user.role}</td>
                    <td>
                      {db.staff.find((s) => s.id === user.staffId)?.department ?? 'Sem ligação'}
                    </td>
                    <td>
                      <div className="exam-state">
                        <Badge tone={user.active ? 'success' : 'danger'}>
                          {user.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {user.resetRequestedAt && (
                          <small className="muted">
                            Recuperação pedida em {formatDate(user.resetRequestedAt, true)}
                          </small>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="table-actions wrap">
                        <button
                          className="button small secondary"
                          disabled={!canManageUsers(session)}
                          onClick={() => setForm(user)}
                        >
                          <UserCog size={15} />
                          Editar
                        </button>
                        <button
                          className="button small secondary"
                          disabled={!canManageUsers(session) || !user.active}
                          onClick={() => setReset(user)}
                        >
                          <KeyRound size={15} />
                          Recuperar acesso
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum utilizador encontrado"
            description="Experimente outro nome ou perfil."
          />
        )}
        <div className="info-line">
          <LockKeyhole size={16} />
          <span>
            A demonstração não guarda palavras-passe. A recuperação de acesso apenas marca o pedido
            e fica registada na actividade.
          </span>
        </div>
      </Panel>
      <Panel
        title="Matriz de permissões"
        subtitle="Lida directamente das regras aplicadas no domínio."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Capacidade</th>
                {roles.map((role) => (
                  <th key={role}>{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capabilities.map((capability) => (
                <tr key={capability.label}>
                  <td>
                    <strong className="table-primary">{capability.label}</strong>
                  </td>
                  {roles.map((role) => (
                    <td key={role}>
                      {capability.allows(role) ? (
                        <span className="matrix-yes" role="img" aria-label="Permitido">
                          <ShieldCheck size={15} />
                        </span>
                      ) : (
                        <span className="matrix-no" role="img" aria-label="Não permitido">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Auditoria de acesso"
        subtitle="Consultas a informação clínica, além das alterações no registo de actividade."
      >
        {accesses.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Utilizador</th>
                  <th>Área</th>
                  <th>Informação consultada</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map((record) => (
                  <tr key={record.id}>
                    <td className="nowrap">{formatDate(record.at, true)}</td>
                    <td>
                      <strong className="table-primary">{record.actor}</strong>
                      <small className="muted">{record.role}</small>
                    </td>
                    <td>{record.area}</td>
                    <td>{record.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sem acessos registados"
            description="Abrir a ficha de um paciente regista a consulta nesta lista."
          />
        )}
      </Panel>
      {!canManageUsers(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Administrador para criar, editar ou inactivar utilizadores.
        </div>
      )}
      {form && <UserForm user={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {reset && <ResetForm user={reset} onClose={() => setReset(null)} />}
    </>
  );
}

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const { db, run } = useDemo();
  return (
    <Modal
      title={user ? 'Editar utilizador' : 'Novo utilizador'}
      description={user ? user.username : 'Perfil simulado desta demonstração.'}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Guardar utilizador"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'user.save',
            id: user?.id,
            name: String(data.get('name') ?? ''),
            username: String(data.get('username') ?? ''),
            role: String(data.get('role')) as Role,
            staffId: String(data.get('staffId') ?? '') || null,
            active: data.get('active') === 'on',
          })
        }
      >
        <div className="form-grid">
          <Field label="Nome *" wide>
            <input
              autoFocus
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={user?.name}
            />
          </Field>
          <Field label="Nome de utilizador *">
            <input
              name="username"
              required
              minLength={3}
              maxLength={40}
              pattern="[a-z0-9.]+"
              placeholder="nome.apelido"
              defaultValue={user?.username}
            />
          </Field>
          <Field label="Perfil *">
            <select name="role" defaultValue={user?.role ?? 'Recepcionista'}>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </Field>
          <Field label="Colaborador associado" wide>
            <select name="staffId" defaultValue={user?.staffId ?? ''}>
              <option value="">Sem ligação ao quadro de pessoal</option>
              {db?.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.department}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Situação" wide>
            <label className="checkbox-field">
              <input type="checkbox" name="active" defaultChecked={user?.active ?? true} />
              <span>Utilizador activo</span>
            </label>
          </Field>
        </div>
        <div className="clinical-warning">
          Sem palavras-passe nem sessões reais: o perfil activo continua a ser escolhido no
          cabeçalho da demonstração.
        </div>
      </ActionForm>
    </Modal>
  );
}

function ResetForm({ user, onClose }: { user: User; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title="Simular recuperação de acesso"
      description={user.name + ' · ' + user.username}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar pedido"
        onClose={onClose}
        onSubmit={async () => run({ type: 'user.reset', userId: user.id })}
      >
        <p className="form-hint">
          A demonstração regista o pedido, a autoria e a data. Não existe palavra-passe para
          substituir nem mensagem enviada ao utilizador.
        </p>
      </ActionForm>
    </Modal>
  );
}
