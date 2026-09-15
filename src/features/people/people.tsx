'use client';
import { useState } from 'react';
import {
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  Plus,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  absenceTypes,
  attendanceStatuses,
  canAdministration,
  staffRoles,
  type Staff,
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
  Status,
} from '@/components/ui';
import { dayOffset, formatDate, normalize, today } from '@/lib/format';

export function PeopleBoard() {
  const { db, session, run } = useDemo();
  const [view, setView] = useState<'staff' | 'schedule' | 'absences'>('staff');
  const [search, setSearch] = useState('');
  const [staffForm, setStaffForm] = useState<Staff | 'new' | null>(null);
  const [shiftForm, setShiftForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState(false);
  const [attendance, setAttendance] = useState<{ staffId: string; date: string } | null>(null);
  const [day, setDay] = useState(today());
  const [removeError, setRemoveError] = useState('');
  if (!db) return null;
  const staff = db.staff
    .filter((s) =>
      normalize(s.name + ' ' + s.role + ' ' + s.department).includes(normalize(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const shiftsOfDay = db.shifts
    .filter((s) => s.date === day)
    .sort((a, b) => a.start.localeCompare(b.start));
  const active = db.staff.filter((s) => s.active);
  const onLeave = db.absences.filter((a) => a.start <= today() && today() <= a.end);
  const presentToday = db.attendance.filter(
    (a) => a.date === today() && a.status === 'Presente',
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="RECURSOS HUMANOS"
        title="Colaboradores e escalas"
        description="Quem trabalha na unidade, em que departamento, em que turno e com que ausências."
      >
        {canAdministration(session) && (
          <button className="button primary" onClick={() => setStaffForm('new')}>
            <Plus size={18} />
            Novo colaborador
          </button>
        )}
      </PageHeader>
      <div className="stat-grid">
        {[
          {
            label: 'Colaboradores activos',
            value: active.length,
            hint: `${db.staff.length - active.length} inactivo(s)`,
            icon: Users,
            color: 'blue',
          },
          {
            label: 'Turnos para hoje',
            value: db.shifts.filter((s) => s.date === today()).length,
            hint: 'Escala do dia',
            icon: CalendarDays,
            color: 'violet',
          },
          {
            label: 'Presenças registadas hoje',
            value: presentToday,
            hint: `${db.attendance.filter((a) => a.date === today()).length} registo(s) do dia`,
            icon: UserCheck,
            color: 'green',
          },
          {
            label: 'Ausentes hoje',
            value: onLeave.length,
            hint: 'Férias, licença ou formação',
            icon: GraduationCap,
            color: 'amber',
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
      <div className="segmented" role="tablist" aria-label="Vista de recursos humanos">
        {(
          [
            ['staff', 'Colaboradores', db.staff.length],
            ['schedule', 'Escalas e presenças', db.shifts.length],
            ['absences', 'Férias e formação', db.absences.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={view === key ? 'active' : ''}
            onClick={() => setView(key)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {view === 'staff' && (
        <Panel title="Quadro de pessoal" subtitle="Função, departamento e afectação à unidade.">
          <div className="toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar nome, função ou departamento"
            />
            <Badge tone="info">{db.unit.name}</Badge>
          </div>
          {staff.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Função</th>
                    <th>Departamento</th>
                    <th>Situação</th>
                    <th className="align-right">Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const absence = db.absences.find(
                      (a) => a.staffId === member.id && a.start <= today() && today() <= a.end,
                    );
                    return (
                      <tr key={member.id}>
                        <td>
                          <strong className="table-primary">{member.name}</strong>
                          <small className="muted">
                            {member.number} · desde {formatDate(member.hiredAt)}
                          </small>
                        </td>
                        <td>{member.role}</td>
                        <td>{member.department}</td>
                        <td>
                          <div className="exam-state">
                            <Badge tone={member.active ? 'success' : 'danger'}>
                              {member.active ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {absence && <Badge tone="warning">{absence.type}</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="button small secondary"
                              disabled={!canAdministration(session)}
                              onClick={() => setStaffForm(member)}
                            >
                              <UserCog size={15} />
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Nenhum colaborador encontrado"
              description="Experimente outro nome, função ou departamento."
            />
          )}
        </Panel>
      )}
      {view === 'schedule' && (
        <Panel
          title="Escala do dia"
          subtitle="Turnos atribuídos e presença registada."
          action={
            canAdministration(session) ? (
              <button className="button secondary small" onClick={() => setShiftForm(true)}>
                <Plus size={15} />
                Atribuir turno
              </button>
            ) : undefined
          }
        >
          <div className="toolbar">
            <label className="filter-select">
              <span>Dia</span>
              <input type="date" value={day} onChange={(e) => setDay(e.target.value || today())} />
            </label>
            <Badge tone="info">{shiftsOfDay.length} turno(s)</Badge>
          </div>
          {shiftsOfDay.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Colaborador</th>
                    <th>Departamento</th>
                    <th>Presença</th>
                    <th className="align-right">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {shiftsOfDay.map((shift) => {
                    const member = db.staff.find((s) => s.id === shift.staffId)!;
                    const record = db.attendance.find(
                      (a) => a.staffId === shift.staffId && a.date === shift.date,
                    );
                    return (
                      <tr key={shift.id}>
                        <td>
                          <strong className="table-primary">
                            {shift.start}–{shift.end}
                          </strong>
                          <small className="muted">{formatDate(shift.date)}</small>
                        </td>
                        <td>
                          <strong className="table-primary">{member.name}</strong>
                          <small className="muted">{member.role}</small>
                        </td>
                        <td>{shift.department}</td>
                        <td>
                          <div className="exam-state">
                            {record ? (
                              <Status value={record.status} />
                            ) : (
                              <Badge>Por registar</Badge>
                            )}
                            {record?.note && <small className="muted">{record.note}</small>}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions wrap">
                            <button
                              className="button small primary"
                              disabled={!canAdministration(session) || shift.date > today()}
                              onClick={() =>
                                setAttendance({ staffId: shift.staffId, date: shift.date })
                              }
                            >
                              <CalendarCheck size={15} />
                              Registar presença
                            </button>
                            <button
                              className="button small secondary"
                              disabled={!canAdministration(session)}
                              onClick={() => void remove(shift.id)}
                            >
                              <X size={15} />
                              Remover turno
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Sem turnos neste dia"
              description="Atribua turnos para a escala aparecer aqui."
            />
          )}
          {removeError && (
            <div className="form-error" role="alert">
              {removeError}
            </div>
          )}
        </Panel>
      )}
      {view === 'absences' && (
        <Panel
          title="Férias, licenças e formação"
          subtitle="Períodos em que o colaborador não pode ser escalado."
          action={
            canAdministration(session) ? (
              <button className="button secondary small" onClick={() => setAbsenceForm(true)}>
                <Plus size={15} />
                Registar ausência
              </button>
            ) : undefined
          }
        >
          {db.absences.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Colaborador</th>
                    <th>Tipo</th>
                    <th>Período</th>
                    <th>Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {[...db.absences]
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((absence) => {
                      const member = db.staff.find((s) => s.id === absence.staffId)!;
                      const current = absence.start <= today() && today() <= absence.end;
                      return (
                        <tr key={absence.id}>
                          <td>
                            <strong className="table-primary">{member.name}</strong>
                            <small className="muted">{member.department}</small>
                          </td>
                          <td>
                            <div className="exam-state">
                              <Badge tone={current ? 'warning' : 'info'}>{absence.type}</Badge>
                              {current && <small className="muted">Em curso</small>}
                            </div>
                          </td>
                          <td>
                            {formatDate(absence.start)} a {formatDate(absence.end)}
                          </td>
                          <td>{absence.note || '—'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Sem ausências registadas"
              description="Férias, licenças e formações aparecem nesta lista."
            />
          )}
        </Panel>
      )}
      {!canAdministration(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Administrativo para gerir colaboradores, escalas e ausências.
        </div>
      )}
      {staffForm && (
        <StaffForm
          member={staffForm === 'new' ? undefined : staffForm}
          onClose={() => setStaffForm(null)}
        />
      )}
      {shiftForm && <ShiftForm defaultDate={day} onClose={() => setShiftForm(false)} />}
      {absenceForm && <AbsenceForm onClose={() => setAbsenceForm(false)} />}
      {attendance && (
        <AttendanceForm
          staffId={attendance.staffId}
          date={attendance.date}
          onClose={() => setAttendance(null)}
        />
      )}
    </>
  );

  async function remove(shiftId: string) {
    setRemoveError('');
    try {
      await run({ type: 'shift.remove', shiftId });
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : 'Não foi possível remover o turno.');
    }
  }
}

function StaffForm({ member, onClose }: { member?: Staff; onClose: () => void }) {
  const { run: runCommand } = useDemo();
  return (
    <Modal
      title={member ? 'Editar colaborador' : 'Novo colaborador'}
      description={member ? member.number : 'Afecto à unidade de demonstração.'}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Guardar colaborador"
        onClose={onClose}
        onSubmit={async (data) =>
          runCommand({
            type: 'staff.save',
            id: member?.id,
            name: String(data.get('name') ?? ''),
            role: String(data.get('role')) as Staff['role'],
            department: String(data.get('department') ?? ''),
            phone: String(data.get('phone') ?? ''),
            hiredAt: String(data.get('hiredAt') ?? ''),
            active: data.get('active') === 'on',
          })
        }
      >
        <div className="form-grid">
          <Field label="Nome completo *" wide>
            <input
              autoFocus
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={member?.name}
            />
          </Field>
          <Field label="Função *">
            <select name="role" defaultValue={member?.role ?? 'Enfermeiro'}>
              {staffRoles.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Departamento *">
            <input
              name="department"
              required
              minLength={2}
              maxLength={80}
              defaultValue={member?.department}
            />
          </Field>
          <Field label="Telefone">
            <input name="phone" maxLength={30} defaultValue={member?.phone} />
          </Field>
          <Field label="Admissão *">
            <input
              name="hiredAt"
              type="date"
              required
              max={today()}
              defaultValue={member?.hiredAt ?? today()}
            />
          </Field>
          <Field label="Situação" wide>
            <label className="checkbox-field">
              <input type="checkbox" name="active" defaultChecked={member?.active ?? true} />
              <span>Colaborador activo na unidade</span>
            </label>
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function ShiftForm({ defaultDate, onClose }: { defaultDate: string; onClose: () => void }) {
  const { db, run: runCommand } = useDemo();
  return (
    <Modal
      title="Atribuir turno"
      description="Sem sobreposições e fora de períodos de ausência."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Atribuir turno"
        onClose={onClose}
        onSubmit={async (data) =>
          runCommand({
            type: 'shift.save',
            staffId: String(data.get('staffId') ?? ''),
            date: String(data.get('date') ?? ''),
            start: String(data.get('start') ?? ''),
            end: String(data.get('end') ?? ''),
            department: String(data.get('department') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Colaborador *" wide>
            <select name="staffId" required autoFocus>
              {db?.staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Data *">
            <input
              name="date"
              type="date"
              required
              min={today()}
              defaultValue={defaultDate < today() ? today() : defaultDate}
            />
          </Field>
          <Field label="Departamento *">
            <input
              name="department"
              required
              minLength={2}
              maxLength={80}
              defaultValue="Urgência"
            />
          </Field>
          <Field label="Início *">
            <input name="start" type="time" required defaultValue="08:00" step={900} />
          </Field>
          <Field label="Fim *">
            <input name="end" type="time" required defaultValue="14:00" step={900} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function AttendanceForm({
  staffId,
  date,
  onClose,
}: {
  staffId: string;
  date: string;
  onClose: () => void;
}) {
  const { db, run: runCommand } = useDemo();
  const member = db?.staff.find((s) => s.id === staffId);
  const existing = db?.attendance.find((a) => a.staffId === staffId && a.date === date);
  return (
    <Modal
      title="Registar presença"
      description={(member?.name ?? '') + ' · ' + formatDate(date)}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Guardar presença"
        onClose={onClose}
        onSubmit={async (data) =>
          runCommand({
            type: 'attendance.mark',
            staffId,
            date,
            status: String(data.get('status')) as (typeof attendanceStatuses)[number],
            note: String(data.get('note') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Situação *" wide>
            <select name="status" defaultValue={existing?.status ?? 'Presente'}>
              {attendanceStatuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Observações" wide>
            <textarea name="note" maxLength={200} defaultValue={existing?.note} />
          </Field>
        </div>
        <div className="info-line">
          Uma falta justificada exige a justificação. O registo substitui o anterior do mesmo dia.
        </div>
      </ActionForm>
    </Modal>
  );
}

function AbsenceForm({ onClose }: { onClose: () => void }) {
  const { db, run: runCommand } = useDemo();
  return (
    <Modal title="Registar ausência" description="Férias, licença ou formação." onClose={onClose}>
      <ActionForm
        submitLabel="Registar ausência"
        onClose={onClose}
        onSubmit={async (data) =>
          runCommand({
            type: 'absence.save',
            staffId: String(data.get('staffId') ?? ''),
            absenceType: String(data.get('absenceType')) as (typeof absenceTypes)[number],
            start: String(data.get('start') ?? ''),
            end: String(data.get('end') ?? ''),
            note: String(data.get('note') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Colaborador *" wide>
            <select name="staffId" required autoFocus>
              {db?.staff
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.department}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Tipo *" wide>
            <select name="absenceType" defaultValue="Férias">
              {absenceTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Início *">
            <input name="start" type="date" required defaultValue={dayOffset(1)} />
          </Field>
          <Field label="Fim *">
            <input name="end" type="date" required defaultValue={dayOffset(15)} />
          </Field>
          <Field label="Observações" wide>
            <textarea name="note" maxLength={200} />
          </Field>
        </div>
        <div className="clinical-warning">
          Um período com turnos atribuídos é recusado: remova os turnos antes de registar a
          ausência.
        </div>
      </ActionForm>
    </Modal>
  );
}
