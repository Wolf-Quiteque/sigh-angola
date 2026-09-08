'use client';
import { useState } from 'react';
import { Check, LogIn, CalendarClock, X } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { canWrite, type Appointment } from '@/domain/schema';
import { PatientCell, Status, Empty } from '@/components/ui';
import { AppointmentForm, CancelAppointmentForm } from './forms';
import { today } from '@/lib/format';
export function AppointmentTable({
  appointments,
  compact = false,
}: {
  appointments: Appointment[];
  compact?: boolean;
}) {
  const { db, session, run } = useDemo();
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [cancel, setCancel] = useState<Appointment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!db) return null;
  async function act(a: Appointment, checkin: boolean) {
    setBusy(true);
    setError('');
    try {
      await run(
        checkin
          ? {
              type: 'admission.create',
              patientId: a.patientId,
              appointmentId: a.id,
              service: a.specialty,
              reason: a.reason,
            }
          : { type: 'appointment.status', id: a.id, status: 'Confirmada' },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operação indisponível.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div role="alert" className="form-error">
          {error}
        </div>
      )}
      {appointments.length === 0 ? (
        <Empty
          title="Sem consultas neste período"
          description="Escolha outra data ou registe uma nova marcação."
        />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>{compact ? 'Especialidade' : 'Profissional / especialidade'}</th>
                <th>Estado</th>
                {canWrite(session) && <th className="align-right">Acções</th>}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => {
                const patient = db.patients.find((p) => p.id === a.patientId);
                return (
                  <tr key={a.id}>
                    <td>
                      <span className="time-cell">{a.time}</span>
                      <small className="muted">30 min</small>
                    </td>
                    <td>{patient && <PatientCell patient={patient} />}</td>
                    <td>
                      {!compact && (
                        <strong className="table-primary">
                          {db.professionals.find((p) => p.id === a.professionalId)?.name}
                        </strong>
                      )}
                      <span className={compact ? '' : 'muted'}>{a.specialty}</span>
                    </td>
                    <td>
                      <Status value={a.status} />
                    </td>
                    {canWrite(session) && (
                      <td>
                        <div className="table-actions">
                          {a.status === 'Marcada' && (
                            <button
                              disabled={busy}
                              className="icon-button"
                              aria-label={`Confirmar consulta de ${patient?.name}`}
                              title="Confirmar consulta"
                              onClick={() => void act(a, false)}
                            >
                              <Check size={17} />
                            </button>
                          )}
                          {['Marcada', 'Confirmada'].includes(a.status) && (
                            <>
                              {a.date === today() && (
                                <button
                                  disabled={busy}
                                  className="button small secondary"
                                  aria-label={`Registar chegada de ${patient?.name}`}
                                  onClick={() => void act(a, true)}
                                >
                                  <LogIn size={15} />
                                  <span>Chegada</span>
                                </button>
                              )}
                              {!compact && (
                                <>
                                  <button
                                    className="icon-button"
                                    aria-label={`Reagendar consulta de ${patient?.name}`}
                                    title="Reagendar"
                                    onClick={() => setEditing(a)}
                                  >
                                    <CalendarClock size={17} />
                                  </button>
                                  <button
                                    className="icon-button"
                                    aria-label={`Cancelar consulta de ${patient?.name}`}
                                    title="Cancelar marcação"
                                    onClick={() => setCancel(a)}
                                  >
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                            </>
                          )}
                          {['Admitida', 'Cancelada'].includes(a.status) && (
                            <span className="muted">—</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && <AppointmentForm appointment={editing} onClose={() => setEditing(null)} />}
      {cancel && <CancelAppointmentForm appointment={cancel} onClose={() => setCancel(null)} />}
    </>
  );
}
