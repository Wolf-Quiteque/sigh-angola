import {
  appointmentSchema,
  canWrite,
  canReception,
  canTriage,
  canConsult,
  triageSchema,
  prescriptionItemSchema,
  patientInputSchema,
  type Database,
  type PatientInput,
  type Session,
} from './schema';
import { normalize, today } from '@/lib/format';

export type ClinicalCommand =
  | {
      type: 'triage.save';
      episodeId: string;
      chiefComplaint: string;
      priority: 'Vermelho' | 'Laranja' | 'Amarelo' | 'Verde' | 'Azul';
      temperature: number;
      systolic: number;
      diastolic: number;
      heartRate: number;
      respiratoryRate: number;
      oxygenSaturation: number;
      weight: number | null;
      height: number | null;
      notes: string;
    }
  | { type: 'consultation.start'; episodeId: string; professionalId: string }
  | {
      type: 'consultation.save';
      consultationId: string;
      history: string;
      allergies: string;
      diagnosis: string;
      procedures: string;
      evolution: string;
      prescriptions: Array<{
        id?: string;
        medication: string;
        dose: string;
        route: string;
        frequency: string;
        duration: string;
        notes: string;
      }>;
    }
  | {
      type: 'consultation.complete';
      consultationId: string;
      outcome: 'Alta ambulatória' | 'Observação' | 'Internamento' | 'Transferência';
    }
  | { type: 'consultation.amend'; consultationId: string; reason: string; text: string };

export type Command =
  | ClinicalCommand
  | { type: 'patient.save'; id?: string; input: PatientInput }
  | {
      type: 'appointment.save';
      id?: string;
      patientId: string;
      professionalId: string;
      date: string;
      time: string;
      reason: string;
    }
  | { type: 'appointment.status'; id: string; status: 'Confirmada' | 'Cancelada'; reason?: string }
  | {
      type: 'admission.create';
      patientId: string;
      appointmentId?: string;
      service: string;
      reason: string;
    };
const fail = (message: string): never => {
  throw new Error(message);
};
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function executeCommand(
  current: Database,
  command: Command,
  session: Session,
  now = new Date().toISOString(),
): Database {
  if (!canWrite(session)) fail('O perfil Direcção tem acesso apenas de leitura.');
  if (
    ['patient.save', 'appointment.save', 'appointment.status', 'admission.create'].includes(
      command.type,
    ) &&
    !canReception(session)
  )
    fail('Este perfil não tem permissão para operar a recepção.');
  const db = structuredClone(current);
  let entityId = '';
  let action = '';
  let detail = '';
  const patientFor = (id: string) =>
    db.patients.find((p) => p.id === id && p.unitId === db.unit.id) ??
    fail('Paciente não encontrado nesta unidade.');
  if (command.type === 'patient.save') {
    const result = patientInputSchema.safeParse(command.input);
    if (!result.success) fail(result.error.issues[0].message);
    const input = result.data!;
    const duplicate = db.patients.find(
      (p) =>
        p.id !== command.id &&
        ((input.document && p.document === input.document) ||
          (normalize(p.name) === normalize(input.name) && p.birthDate === input.birthDate)),
    );
    if (duplicate)
      fail(
        `Já existe um paciente com estes dados: ${duplicate.number}. Consulte a ficha antes de criar outro registo.`,
      );
    if (command.id) {
      const patient = patientFor(command.id);
      Object.assign(patient, input);
      entityId = patient.id;
      action = 'Paciente actualizado';
    } else {
      entityId = crypto.randomUUID();
      const next =
        Math.max(0, ...db.patients.map((p) => Number(p.number.split('-').at(-1)) || 0)) + 1;
      db.patients.push({
        ...input,
        id: entityId,
        number: `SIGH-${String(next).padStart(6, '0')}`,
        unitId: db.unit.id,
        createdAt: now,
      });
      action = 'Paciente registado';
    }
    detail = input.name;
  }
  if (command.type === 'appointment.save') {
    const patient = patientFor(command.patientId);
    const professional =
      db.professionals.find((p) => p.id === command.professionalId) ??
      fail('Seleccione um profissional válido.');
    const previous = command.id
      ? (db.appointments.find((a) => a.id === command.id) ?? fail('Marcação não encontrada.'))
      : undefined;
    if (previous && (previous.status === 'Cancelada' || previous.status === 'Admitida'))
      fail('Esta marcação já não pode ser alterada.');
    if (previous && previous.patientId !== command.patientId)
      fail('O paciente da marcação não pode ser alterado.');
    const candidate = appointmentSchema.safeParse({
      ...command,
      id: command.id ?? crypto.randomUUID(),
      unitId: db.unit.id,
      specialty: professional.specialty,
      status: 'Marcada',
    });
    if (!candidate.success) fail('Verifique a data e a hora da marcação.');
    const a = candidate.data!;
    if (a.date < today()) fail('Não é possível marcar uma consulta para uma data passada.');
    if (!a.reason.trim()) fail('Indique o motivo da marcação.');
    if (
      db.appointments.some(
        (other) =>
          other.id !== a.id &&
          other.status !== 'Cancelada' &&
          other.date === a.date &&
          Math.abs(minutes(other.time) - minutes(a.time)) < 30 &&
          (other.professionalId === a.professionalId || other.patientId === a.patientId),
      )
    )
      fail(
        'Horário indisponível: o profissional ou paciente já tem uma marcação neste intervalo de 30 minutos.',
      );
    if (previous) Object.assign(previous, a);
    else db.appointments.push(a);
    entityId = a.id;
    action = previous ? 'Consulta reagendada' : 'Consulta marcada';
    detail = `${patient.name} · ${a.date} ${a.time} · ${professional.name}`;
  }
  if (command.type === 'appointment.status') {
    const a = db.appointments.find((a) => a.id === command.id) ?? fail('Marcação não encontrada.');
    if (a.status === 'Admitida' || a.status === 'Cancelada' || a.status === command.status)
      fail('Transição de estado não permitida.');
    if (command.status === 'Cancelada' && !command.reason?.trim())
      fail('Indique o motivo do cancelamento.');
    a.status = command.status;
    entityId = a.id;
    action = command.status === 'Confirmada' ? 'Consulta confirmada' : 'Consulta cancelada';
    detail = command.reason?.trim() || patientFor(a.patientId).name;
  }
  if (command.type === 'admission.create') {
    const patient = patientFor(command.patientId);
    if (db.episodes.some((e) => e.patientId === patient.id && e.status !== 'Concluído'))
      fail('O paciente já tem um episódio activo. Consulte a fila de atendimento.');
    const a = command.appointmentId
      ? (db.appointments.find((a) => a.id === command.appointmentId) ??
        fail('Marcação não encontrada.'))
      : undefined;
    if (
      a &&
      (a.patientId !== patient.id ||
        !['Marcada', 'Confirmada'].includes(a.status) ||
        a.date !== today())
    )
      fail('A chegada só pode ser registada numa marcação activa para hoje.');
    if (!command.reason.trim() || !command.service.trim())
      fail('Indique o serviço e o motivo da admissão.');
    if (a) a.status = 'Admitida';
    entityId = crypto.randomUUID();
    db.episodes.push({
      id: entityId,
      patientId: patient.id,
      unitId: db.unit.id,
      appointmentId: a?.id ?? null,
      arrivedAt: now,
      service: a?.specialty ?? command.service,
      reason: command.reason.trim(),
      status: 'Aguarda triagem',
    });
    action = 'Chegada registada';
    detail = `${patient.name} · ${a ? 'Com marcação' : 'Admissão directa'}`;
  }
  if (command.type === 'triage.save') {
    if (!canTriage(session)) fail('Este perfil não tem permissão para realizar triagem.');
    const episode =
      db.episodes.find((e) => e.id === command.episodeId) ?? fail('Episódio não encontrado.');
    if (episode.status !== 'Aguarda triagem') fail('Este episódio já não aguarda triagem.');
    if (db.triages.some((t) => t.episodeId === episode.id))
      fail('Este episódio já possui uma triagem.');
    const parsed = triageSchema.safeParse({
      ...command,
      id: crypto.randomUUID(),
      patientId: episode.patientId,
      nurse: session.name,
      recordedAt: now,
    });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Verifique todos os sinais vitais.');
    }
    db.triages.push(parsed.data);
    episode.status = 'Aguarda consulta';
    entityId = parsed.data.id;
    action = 'Triagem concluída';
    detail = `${patientFor(episode.patientId).name} · Prioridade ${parsed.data.priority}`;
  }
  if (command.type === 'consultation.start') {
    if (!canConsult(session)) fail('Este perfil não tem permissão para iniciar consultas.');
    const episode =
      db.episodes.find((e) => e.id === command.episodeId) ?? fail('Episódio não encontrado.');
    if (
      episode.status !== 'Aguarda consulta' ||
      !db.triages.some((t) => t.episodeId === episode.id)
    )
      fail('A consulta só pode começar depois da triagem.');
    if (db.consultations.some((c) => c.episodeId === episode.id))
      fail('Este episódio já possui uma consulta.');
    const professional =
      db.professionals.find((p) => p.id === command.professionalId) ??
      fail('Seleccione um médico válido.');
    entityId = crypto.randomUUID();
    db.consultations.push({
      id: entityId,
      episodeId: episode.id,
      patientId: episode.patientId,
      professionalId: professional.id,
      startedAt: now,
      completedAt: null,
      status: 'Em curso',
      history: '',
      allergies: '',
      diagnosis: '',
      procedures: '',
      evolution: '',
      outcome: null,
      prescriptions: [],
      amendments: [],
    });
    episode.status = 'Em consulta';
    action = 'Consulta iniciada';
    detail = `${patientFor(episode.patientId).name} · ${professional.name}`;
  }
  if (command.type === 'consultation.save') {
    if (!canConsult(session))
      fail('Este perfil não tem permissão para registar informação clínica.');
    const consultation =
      db.consultations.find((c) => c.id === command.consultationId) ??
      fail('Consulta não encontrada.');
    if (consultation.status !== 'Em curso')
      fail('Uma consulta concluída não pode ser alterada. Utilize uma adenda.');
    const prescriptions = command.prescriptions.map((item) =>
      prescriptionItemSchema.parse({ ...item, id: item.id || crypto.randomUUID() }),
    );
    Object.assign(consultation, {
      history: command.history.trim(),
      allergies: command.allergies.trim(),
      diagnosis: command.diagnosis.trim(),
      procedures: command.procedures.trim(),
      evolution: command.evolution.trim(),
      prescriptions,
    });
    entityId = consultation.id;
    action = 'Consulta guardada';
    detail = `${patientFor(consultation.patientId).name} · ${prescriptions.length} prescrição(ões)`;
  }
  if (command.type === 'consultation.complete') {
    if (!canConsult(session)) fail('Este perfil não tem permissão para concluir consultas.');
    const consultation =
      db.consultations.find((c) => c.id === command.consultationId) ??
      fail('Consulta não encontrada.');
    if (consultation.status !== 'Em curso') fail('Esta consulta já foi concluída.');
    if (!consultation.diagnosis.trim() || !consultation.evolution.trim())
      fail('Registe o diagnóstico e a evolução antes de concluir.');
    const episode =
      db.episodes.find((e) => e.id === consultation.episodeId) ?? fail('Episódio não encontrado.');
    consultation.status = 'Concluída';
    consultation.completedAt = now;
    consultation.outcome = command.outcome;
    episode.status = 'Concluído';
    entityId = consultation.id;
    action = 'Consulta concluída';
    detail = `${patientFor(consultation.patientId).name} · ${command.outcome}`;
  }
  if (command.type === 'consultation.amend') {
    if (!canConsult(session)) fail('Este perfil não tem permissão para acrescentar adendas.');
    const consultation =
      db.consultations.find((c) => c.id === command.consultationId) ??
      fail('Consulta não encontrada.');
    if (consultation.status !== 'Concluída') fail('Adendas destinam-se a consultas concluídas.');
    if (command.reason.trim().length < 3 || command.text.trim().length < 3)
      fail('Indique o motivo e o conteúdo da adenda.');
    consultation.amendments.push({
      id: crypto.randomUUID(),
      at: now,
      author: session.name,
      reason: command.reason.trim(),
      text: command.text.trim(),
    });
    entityId = consultation.id;
    action = 'Adenda clínica registada';
    detail = `${patientFor(consultation.patientId).name} · ${command.reason.trim()}`;
  }
  db.revision++;
  db.audit.unshift({
    id: crypto.randomUUID(),
    at: now,
    actor: `${session.name} (${session.role})`,
    action,
    entityId,
    detail,
  });
  return db;
}
