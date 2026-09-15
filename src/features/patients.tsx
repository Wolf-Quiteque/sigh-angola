'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus, ArrowLeft, Pencil, CalendarPlus, LogIn, ArrowUpRight, IdCard } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { canReception } from '@/domain/schema';
import { PageHeader, Panel, SearchInput, PatientCell, Badge, Empty, Status } from '@/components/ui';
import { formatDate, normalize, age, initials } from '@/lib/format';
import { PatientForm, AppointmentForm, AdmissionForm } from './reception/forms';
import { ExamCard } from './diagnostics/episode-exams';
import { StayHistory } from './inpatient/stay';
import { PatientCard } from './admin/patient-card';

export function Patients() {
  const { db, session } = useDemo();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [municipality, setMunicipality] = useState('');
  const [form, setForm] = useState(false);
  const [page, setPage] = useState(1);
  if (!db) return null;
  const filtered = db.patients
    .filter(
      (p) =>
        (!municipality || p.municipality === municipality) &&
        normalize(`${p.name} ${p.number} ${p.document} ${p.phone}`).includes(normalize(search)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const maxPage = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  return (
    <>
      <PageHeader
        eyebrow="RECEPÇÃO"
        title="Pacientes"
        description="Uma identificação única. Um histórico que acompanha cada paciente."
      >
        {canReception(session) && (
          <button className="button primary" onClick={() => setForm(true)}>
            <Plus size={18} />
            Novo paciente
          </button>
        )}
      </PageHeader>
      <Panel>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Pesquisar por nome, nº de paciente, BI ou telefone"
          />
          <label className="filter-select">
            <span>Município</span>
            <select
              value={municipality}
              onChange={(e) => {
                setMunicipality(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os municípios</option>
              {[...new Set(db.patients.map((p) => p.municipality))].sort().map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Sexo</th>
                  <th>Contacto</th>
                  <th>Município</th>
                  <th>Atendimento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <PatientCell patient={p} />
                    </td>
                    <td>{p.sex}</td>
                    <td>{p.phone || 'Não indicado'}</td>
                    <td>{p.municipality}</td>
                    <td>
                      {db.episodes.some((e) => e.patientId === p.id && e.status !== 'Concluído') ? (
                        <Badge tone="warning">Em atendimento</Badge>
                      ) : (
                        <Badge>Registado</Badge>
                      )}
                    </td>
                    <td>
                      <Link
                        className="icon-button"
                        href={`/pacientes/${p.id}`}
                        aria-label={`Abrir ficha de ${p.name}`}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum paciente encontrado"
            description="Experimente outro nome, identificador ou município."
          />
        )}
        <div className="pagination">
          <span>{filtered.length} pacientes encontrados</span>
          <div>
            <button
              className="button small secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span>
              {currentPage} / {maxPage}
            </span>
            <button
              className="button small secondary"
              disabled={currentPage >= maxPage}
              onClick={() => setPage(currentPage + 1)}
            >
              Seguinte
            </button>
          </div>
        </div>
      </Panel>
      {form && <PatientForm onClose={() => setForm(false)} />}
    </>
  );
}
export function PatientDetail({ id }: { id: string }) {
  const { db, session, runQuiet } = useDemo();
  const [form, setForm] = useState('');
  const logged = useRef('');
  const patientRecord = db?.patients.find((p) => p.id === id);
  // Abrir uma ficha é um acesso a informação clínica e fica registado uma vez por sessão e paciente.
  useEffect(() => {
    if (!patientRecord || logged.current === patientRecord.id) return;
    logged.current = patientRecord.id;
    void runQuiet({
      type: 'access.log',
      area: 'Ficha do paciente',
      subject: `${patientRecord.number} · ${patientRecord.name}`,
    });
  }, [patientRecord, runQuiet]);
  if (!db) return null;
  const patient = db.patients.find((p) => p.id === id);
  if (!patient)
    return (
      <Empty
        title="Paciente não encontrado"
        description="O identificador não existe neste cenário de demonstração."
      >
        <Link href="/pacientes" className="button secondary">
          Voltar aos pacientes
        </Link>
      </Empty>
    );
  const episodes = db.episodes
    .filter((e) => e.patientId === id)
    .sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt));
  const appointments = db.appointments
    .filter((a) => a.patientId === id)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const exams = db.exams
    .filter((e) => e.patientId === id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  return (
    <>
      <Link href="/pacientes" className="back-link">
        <ArrowLeft size={16} />
        Todos os pacientes
      </Link>
      <PageHeader
        eyebrow="FICHA DO PACIENTE"
        title={patient.name}
        description={`${patient.number} · ${age(patient.birthDate)} anos · ${patient.sex}`}
      >
        {canReception(session) && (
          <>
            <button className="button secondary" onClick={() => setForm('edit')}>
              <Pencil size={16} />
              Editar ficha
            </button>
            <button className="button primary" onClick={() => setForm('appointment')}>
              <CalendarPlus size={17} />
              Marcar consulta
            </button>
          </>
        )}
        <button className="button secondary" onClick={() => setForm('card')}>
          <IdCard size={17} />
          Cartão do paciente
        </button>
      </PageHeader>
      <div className="detail-grid">
        <Panel>
          <div className="patient-profile">
            <span className="avatar large">{initials(patient.name)}</span>
            <h2>{patient.name}</h2>
            <Badge tone="info">{patient.number}</Badge>
          </div>
          <dl className="demographics">
            {[
              ['Data de nascimento', formatDate(patient.birthDate)],
              ['Bilhete de identidade', patient.document || 'Não indicado'],
              ['Telefone', patient.phone || 'Não indicado'],
              ['Município', patient.municipality],
              ['Morada', patient.address || 'Não indicada'],
              ['Responsável', patient.guardian || 'Não indicado'],
              ['Contacto de emergência', patient.emergencyContact || 'Não indicado'],
              ['Data de registo', formatDate(patient.createdAt)],
            ].map(([label, val]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{val}</dd>
              </div>
            ))}
          </dl>
          {canReception(session) && (
            <div className="profile-footer">
              <button
                className="button secondary full-width"
                onClick={() => setForm('admission')}
                disabled={episodes.some((e) => e.status !== 'Concluído')}
              >
                <LogIn size={17} />
                Admissão directa
              </button>
              {episodes.some((e) => e.status !== 'Concluído') && (
                <p className="form-hint">Já existe um episódio activo na fila.</p>
              )}
            </div>
          )}
        </Panel>
        <div className="stack">
          <Panel
            title="Histórico de atendimentos"
            subtitle="Episódios associados ao mesmo identificador."
          >
            {episodes.length ? (
              <div className="timeline">
                {episodes.map((e) => (
                  <div className="timeline-item" key={e.id}>
                    <span className="timeline-dot" />
                    <div>
                      <div className="timeline-heading">
                        <strong>{e.service}</strong>
                        <Status value={e.status} />
                      </div>
                      <p>{e.reason}</p>
                      <small>
                        {formatDate(e.arrivedAt, true)} ·{' '}
                        {e.appointmentId ? 'Com marcação' : 'Admissão directa'}
                      </small>
                      {db.consultations.some((c) => c.episodeId === e.id) && (
                        <Link className="text-link" href={'/clinica/' + e.id}>
                          Abrir registo clínico
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Ainda sem atendimentos"
                description="Os episódios de admissão irão aparecer nesta ficha."
              />
            )}
          </Panel>
          <Panel title="Marcações" subtitle="Consultas agendadas e histórico de cancelamentos.">
            {appointments.length ? (
              <div className="appointment-list">
                {appointments.map((a) => (
                  <div key={a.id}>
                    <div>
                      <strong>{a.specialty}</strong>
                      <p>
                        {formatDate(a.date)} · {a.time}
                      </p>
                    </div>
                    <Status value={a.status} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Sem marcações"
                description="Marque a primeira consulta deste paciente."
              />
            )}
          </Panel>
          <Panel
            title="Exames e resultados"
            subtitle="Pedidos laboratoriais e de imagiologia deste paciente."
          >
            {exams.length ? (
              <div className="exam-list">
                {exams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} />
                ))}
              </div>
            ) : (
              <Empty
                title="Sem exames pedidos"
                description="Os pedidos feitos em consulta aparecem nesta ficha."
              />
            )}
          </Panel>
          <StayHistory patientId={id} />
          <div className="info-line">
            <Badge tone="info">Próxima fase</Badge>
            <span>
              Abertura sem rede, sincronização simulada e restauro de cópias ficam para a fase 8.
            </span>
          </div>
        </div>
      </div>
      {form === 'edit' && <PatientForm patient={patient} onClose={() => setForm('')} />}
      {form === 'appointment' && <AppointmentForm patientId={id} onClose={() => setForm('')} />}
      {form === 'admission' && <AdmissionForm patientId={id} onClose={() => setForm('')} />}
      {form === 'card' && (
        <PatientCard patient={patient} unit={db.unit} onClose={() => setForm('')} />
      )}
    </>
  );
}
