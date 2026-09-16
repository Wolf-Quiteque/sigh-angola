'use client';
import { useState } from 'react';
import { useDemo } from '@/lib/demo-provider';
import type { Appointment, Patient, PatientInput } from '@/domain/schema';
import { Modal, ActionForm, Field } from '@/components/ui';
import { today } from '@/lib/format';

const value = (form: FormData, name: string) => String(form.get(name) ?? '');
export function PatientForm({ patient, onClose }: { patient?: Patient; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title={patient ? 'Editar paciente' : 'Registar novo paciente'}
      description="Identifique o paciente uma única vez. Os campos com * são obrigatórios."
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel={patient ? 'Guardar alterações' : 'Registar paciente'}
        onSubmit={async (data) => {
          const input = Object.fromEntries(
            [
              'name',
              'birthDate',
              'sex',
              'document',
              'phone',
              'municipality',
              'address',
              'guardian',
              'emergencyContact',
            ].map((key) => [key, value(data, key)]),
          ) as PatientInput;
          await run({ type: 'patient.save', id: patient?.id, input });
        }}
      >
        <div className="form-grid">
          <Field label="Nome completo *" wide>
            <input
              autoFocus
              name="name"
              required
              minLength={3}
              maxLength={120}
              defaultValue={patient?.name}
              placeholder="Nome tal como consta no documento"
            />
          </Field>
          <Field label="Data de nascimento *">
            <input
              type="date"
              name="birthDate"
              required
              max={today()}
              min="1900-01-01"
              defaultValue={patient?.birthDate}
            />
          </Field>
          <Field label="Sexo *">
            <select name="sex" defaultValue={patient?.sex ?? 'Não indicado'}>
              <option>Não indicado</option>
              <option>Feminino</option>
              <option>Masculino</option>
            </select>
          </Field>
          <Field label="Bilhete de identidade">
            <input
              name="document"
              maxLength={30}
              defaultValue={patient?.document}
              placeholder="Opcional para pacientes sem BI"
            />
          </Field>
          <Field label="Telefone">
            <input
              type="tel"
              name="phone"
              defaultValue={patient?.phone}
              placeholder="923 000 000"
            />
          </Field>
          <Field label="Município *">
            <input
              name="municipality"
              required
              minLength={2}
              maxLength={80}
              defaultValue={patient?.municipality ?? 'Menongue'}
            />
          </Field>
          <Field label="Morada">
            <input
              name="address"
              maxLength={200}
              defaultValue={patient?.address}
              placeholder="Bairro, rua e referência"
            />
          </Field>
          <Field label="Responsável / acompanhante" wide>
            <input
              name="guardian"
              maxLength={120}
              defaultValue={patient?.guardian}
              placeholder="Nome e relação com o paciente"
            />
          </Field>
          <Field label="Contacto de emergência" wide>
            <input
              name="emergencyContact"
              maxLength={160}
              defaultValue={patient?.emergencyContact}
              placeholder="Nome e telefone"
            />
          </Field>
        </div>
        <p className="form-hint">Confirme a identificação do paciente antes de guardar.</p>
      </ActionForm>
    </Modal>
  );
}
export function AppointmentForm({
  appointment,
  patientId,
  onClose,
}: {
  appointment?: Appointment;
  patientId?: string;
  onClose: () => void;
}) {
  const { db, run } = useDemo();
  const [professionalId, setProfessionalId] = useState(
    appointment?.professionalId ?? db?.professionals[0]?.id ?? '',
  );
  if (!db) return null;
  return (
    <Modal
      title={appointment ? 'Reagendar consulta' : 'Marcar consulta'}
      description="Consultas em intervalos de 30 minutos. O horário é verificado ao guardar."
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel={appointment ? 'Guardar reagendamento' : 'Marcar consulta'}
        onSubmit={async (data) =>
          run({
            type: 'appointment.save',
            id: appointment?.id,
            patientId: appointment?.patientId ?? patientId ?? value(data, 'patientId'),
            professionalId,
            date: value(data, 'date'),
            time: value(data, 'time'),
            reason: value(data, 'reason'),
          })
        }
      >
        <div className="form-grid">
          <Field label="Paciente *" wide>
            <select
              name="patientId"
              defaultValue={appointment?.patientId ?? patientId ?? ''}
              disabled={!!appointment || !!patientId}
              required
            >
              <option value="">Seleccionar paciente</option>
              {db.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Profissional / especialidade *" wide>
            <select
              name="professionalId"
              value={professionalId}
              onChange={(e) => setProfessionalId(e.target.value)}
            >
              {db.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.specialty}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data *">
            <input
              type="date"
              name="date"
              min={today()}
              required
              defaultValue={appointment?.date ?? today()}
            />
          </Field>
          <Field label="Hora *">
            <input type="time" name="time" required defaultValue={appointment?.time ?? '11:00'} />
          </Field>
          <Field label="Motivo da consulta *" wide>
            <textarea
              name="reason"
              required
              maxLength={500}
              defaultValue={appointment?.reason}
              placeholder="Descreva brevemente o motivo da marcação"
            />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
export function AdmissionForm({ patientId, onClose }: { patientId?: string; onClose: () => void }) {
  const { db, run } = useDemo();
  if (!db) return null;
  return (
    <Modal
      title="Registar admissão directa"
      description="Para pacientes sem marcação. O novo episódio ficará a aguardar triagem."
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel="Registar admissão"
        onSubmit={async (data) =>
          run({
            type: 'admission.create',
            patientId: patientId ?? value(data, 'patientId'),
            service: value(data, 'service'),
            reason: value(data, 'reason'),
          })
        }
      >
        <div className="form-grid">
          <Field label="Paciente *" wide>
            <select name="patientId" required defaultValue={patientId ?? ''} disabled={!!patientId}>
              <option value="">Seleccionar paciente</option>
              {db.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Serviço *" wide>
            <select name="service">
              {db.professionals.map((p) => (
                <option key={p.id}>{p.specialty}</option>
              ))}
              <option>Urgência</option>
            </select>
          </Field>
          <Field label="Motivo da admissão *" wide>
            <textarea
              name="reason"
              required
              maxLength={500}
              placeholder="Motivo indicado pelo paciente"
            />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
export function CancelAppointmentForm({
  appointment,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const { run } = useDemo();
  return (
    <Modal
      title="Cancelar marcação"
      description="A marcação mantém-se no histórico com o motivo do cancelamento."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Confirmar cancelamento"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'appointment.status',
            id: appointment.id,
            status: 'Cancelada',
            reason: value(data, 'reason'),
          })
        }
      >
        <Field label="Motivo do cancelamento *">
          <textarea autoFocus name="reason" required maxLength={500} />
        </Field>
      </ActionForm>
    </Modal>
  );
}
