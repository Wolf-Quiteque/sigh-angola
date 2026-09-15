'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarDays,
  ListOrdered,
  CheckCheck,
  Plus,
  ArrowRight,
  UserPlus,
  ClipboardPlus,
  CalendarPlus,
  ChevronRight,
  CircleCheck,
  Clock3,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { Badge, PageHeader, Panel, TextLink, PatientCell } from '@/components/ui';
import { canReception } from '@/domain/schema';
import { today, formatDate, formatTime, localDate } from '@/lib/format';
import { AppointmentTable } from './reception/appointment-table';
import { PatientForm, AppointmentForm, AdmissionForm } from './reception/forms';

export function Dashboard() {
  const { db, session } = useDemo();
  const [form, setForm] = useState('');
  if (!db) return null;
  const date = today();
  const agenda = db.appointments
    .filter((a) => a.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const active = db.episodes.filter((e) => e.status !== 'Concluído');
  const arrivals = db.episodes.filter((e) => localDate(e.arrivedAt) === date);
  const confirmed = agenda.filter((a) => a.status === 'Confirmada').length;
  const stats = [
    {
      label: 'Pacientes registados',
      value: db.patients.length,
      hint: 'Base de pacientes da unidade',
      icon: Users,
      color: 'blue',
    },
    {
      label: 'Consultas para hoje',
      value: agenda.filter((a) => a.status !== 'Cancelada').length,
      hint: `${confirmed} com presença confirmada`,
      icon: CalendarDays,
      color: 'violet',
    },
    {
      label: 'A aguardar triagem',
      value: active.filter((e) => e.status === 'Aguarda triagem').length,
      hint: 'Na fila de atendimento',
      icon: ListOrdered,
      color: 'amber',
    },
    {
      label: 'Chegadas registadas',
      value: arrivals.length,
      hint: 'Admissões realizadas hoje',
      icon: CheckCheck,
      color: 'green',
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="O SEU HOSPITAL, NUM SÓ LUGAR"
        title="Visão geral"
        description="Acompanhe o atendimento e organize o dia da sua equipa."
      >
        {canReception(session) && (
          <button className="button primary" onClick={() => setForm('patient')}>
            <Plus size={18} />
            Novo paciente
          </button>
        )}
      </PageHeader>
      <div className="daily-strip">
        <span>
          <span className="status-dot" />
          Recepção e atendimento <span className="strip-divider">/</span>
          <strong>{formatDate(date)}</strong>
        </span>
        <Badge>Unidade de demonstração</Badge>
      </div>
      <div className="stat-grid">
        {stats.map(({ label, value, hint, icon: Icon, color }) => (
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
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <Panel
            title="Agenda de hoje"
            subtitle="Marcações e chegadas num único lugar."
            action={<TextLink href="/agenda">Ver agenda</TextLink>}
          >
            <AppointmentTable appointments={agenda} compact />
            <div className="panel-foot">
              <span>
                <Clock3 size={14} />
                Horários de Angola · WAT
              </span>
              <span>{agenda.length} marcações no total</span>
            </div>
          </Panel>
          <Panel
            title="Fluxo de atendimento"
            subtitle="Do primeiro contacto ao início dos cuidados."
            action={<Badge tone="info">Recepção</Badge>}
          >
            <div className="flow-steps">
              {[
                {
                  name: 'Registo',
                  detail: 'Identificação do paciente',
                  count: db.patients.length,
                  icon: Users,
                },
                {
                  name: 'Marcação',
                  detail: 'Agenda de hoje',
                  count: agenda.filter((a) => a.status !== 'Cancelada').length,
                  icon: CalendarDays,
                },
                {
                  name: 'Admissão',
                  detail: 'Chegadas de hoje',
                  count: arrivals.length,
                  icon: ClipboardPlus,
                },
                {
                  name: 'Triagem',
                  detail: 'Pacientes a aguardar',
                  count: active.filter((e) => e.status === 'Aguarda triagem').length,
                  icon: ListOrdered,
                },
              ].map(({ name, detail, count, icon: Icon }, i) => (
                <div className="flow-step" key={name}>
                  <div className="flow-step-top">
                    <span>
                      <Icon size={18} />
                    </span>
                    {i < 3 && <ChevronRight size={17} />}
                  </div>
                  <strong>
                    {name}
                    <b>{count}</b>
                  </strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
            <div className="info-line">
              <CircleCheck size={16} />
              <span>O mesmo registo acompanha o paciente em todo o percurso.</span>
            </div>
          </Panel>
        </div>
        <div className="dashboard-aside">
          <Panel title="Acesso rápido" subtitle="As tarefas do dia-a-dia.">
            <div className="quick-actions">
              {[
                {
                  name: 'Registar paciente',
                  detail: 'Criar uma nova ficha',
                  icon: UserPlus,
                  key: 'patient',
                },
                {
                  name: 'Marcar consulta',
                  detail: 'Reservar um horário',
                  icon: CalendarPlus,
                  key: 'appointment',
                },
                {
                  name: 'Admissão directa',
                  detail: 'Atender sem marcação',
                  icon: ClipboardPlus,
                  key: 'admission',
                },
              ].map(({ name, detail, icon: Icon, key }) => (
                <button key={key} disabled={!canReception(session)} onClick={() => setForm(key)}>
                  <span className="quick-icon">
                    <Icon size={19} />
                  </span>
                  <span>
                    <strong>{name}</strong>
                    <small>{detail}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </Panel>
          <Panel
            title="Na recepção"
            subtitle={`${active.length} pacientes em atendimento`}
            action={<span className="live-indicator" />}
          >
            <div className="reception-list">
              {active.slice(0, 3).map((e) => {
                const p = db.patients.find((p) => p.id === e.patientId)!;
                return (
                  <div key={e.id}>
                    <PatientCell patient={p} />
                    <small>{formatTime(e.arrivedAt)}</small>
                  </div>
                );
              })}
              {active.length === 0 && <p className="muted">Sem pacientes em espera.</p>}
            </div>
            <Link className="panel-link" href="/atendimento">
              Abrir fila de atendimento
              <ArrowRight size={16} />
            </Link>
          </Panel>
          <div className="roadmap-card">
            <Badge tone="success">FASES 0–9 · COMPLETAS</Badge>
            <h2>Da recepção à gestão.</h2>
            <p>Todos os módulos do roteiro partilham o mesmo processo e os mesmos dados.</p>
            <Link href="/roteiro">
              Conhecer as próximas fases
              <ArrowUpRightIcon />
            </Link>
            <span className="roadmap-decoration" aria-hidden="true">
              +
            </span>
          </div>
        </div>
      </div>
      {form === 'patient' && <PatientForm onClose={() => setForm('')} />}
      {form === 'appointment' && <AppointmentForm onClose={() => setForm('')} />}
      {form === 'admission' && <AdmissionForm onClose={() => setForm('')} />}
    </>
  );
  function ArrowUpRightIcon() {
    return <ArrowRight size={16} />;
  }
}
