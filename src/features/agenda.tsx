'use client';
import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { canWrite } from '@/domain/schema';
import { PageHeader, Panel, Badge } from '@/components/ui';
import { dayOffset, today, formatDate } from '@/lib/format';
import { AppointmentForm } from './reception/forms';
import { AppointmentTable } from './reception/appointment-table';
export function Agenda() {
  const { db, session } = useDemo();
  const [date, setDate] = useState(today());
  const [professional, setProfessional] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState(false);
  if (!db) return null;
  const appointments = db.appointments
    .filter(
      (a) =>
        a.date === date &&
        (!professional || a.professionalId === professional) &&
        (!status || a.status === status),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  return (
    <>
      <PageHeader
        eyebrow="RECEPÇÃO"
        title="Agenda de consultas"
        description="Organize marcações, confirme presenças e registe chegadas."
      >
        {canWrite(session) && (
          <button className="button primary" onClick={() => setForm(true)}>
            <Plus size={18} />
            Marcar consulta
          </button>
        )}
      </PageHeader>
      <Panel>
        <div className="agenda-toolbar">
          <div className="date-navigator">
            <button
              className="icon-button"
              aria-label="Dia anterior"
              onClick={() => setDate(dayOffset(-1, date))}
            >
              <ChevronLeft size={19} />
            </button>
            <label>
              <CalendarDays size={17} />
              <span className="sr-only">Data da agenda</span>
              <input
                aria-label="Data da agenda"
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
            </label>
            <button
              className="icon-button"
              aria-label="Dia seguinte"
              onClick={() => setDate(dayOffset(1, date))}
            >
              <ChevronRight size={19} />
            </button>
            <button className="button small secondary" onClick={() => setDate(today())}>
              Hoje
            </button>
          </div>
          <div className="button-row">
            <select
              aria-label="Filtrar profissional"
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
            >
              <option value="">Todos os profissionais</option>
              {db.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar estado"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os estados</option>
              {['Marcada', 'Confirmada', 'Admitida', 'Cancelada'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="section-label">
          <strong>{formatDate(date)}</strong>
          <Badge>{appointments.length} marcações</Badge>
        </div>
        <AppointmentTable appointments={appointments} />
        <div className="panel-foot">
          <span>Duração de cada marcação: 30 minutos</span>
          <span>Fuso horário: Africa/Luanda</span>
        </div>
      </Panel>
      {form && <AppointmentForm onClose={() => setForm(false)} />}
    </>
  );
}
