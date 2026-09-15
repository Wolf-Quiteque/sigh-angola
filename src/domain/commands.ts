import {
  appointmentSchema,
  canWrite,
  canReception,
  canTriage,
  canConsult,
  canDiagnostics,
  canWard,
  canPharmacy,
  admissionSchema,
  productSchema,
  supplierSchema,
  examSchema,
  triageSchema,
  prescriptionItemSchema,
  patientInputSchema,
  type Admission,
  type Bed,
  type Database,
  type Batch,
  type Exam,
  type ExamStatus,
  type Movement,
  type Product,
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
        quantity: number;
        notes: string;
      }>;
    }
  | {
      type: 'consultation.complete';
      consultationId: string;
      outcome: 'Alta ambulatória' | 'Observação' | 'Internamento' | 'Transferência';
    }
  | { type: 'consultation.amend'; consultationId: string; reason: string; text: string };

export type DiagnosticCommand =
  | {
      type: 'exam.request';
      consultationId: string;
      category: 'Laboratório' | 'Imagiologia';
      examType: string;
      priority: 'Urgente' | 'Rotina';
      clinicalNote: string;
    }
  | { type: 'exam.collect'; examId: string; sampleCode: string }
  | { type: 'exam.process'; examId: string }
  | { type: 'exam.schedule'; examId: string; date: string; time: string }
  | { type: 'exam.perform'; examId: string }
  | {
      type: 'exam.report';
      examId: string;
      summary: string;
      findings: string;
      attachment: string;
    }
  | { type: 'exam.validate'; examId: string; notes: string }
  | { type: 'exam.cancel'; examId: string; reason: string };

export type InpatientCommand =
  | {
      type: 'inpatient.admit';
      episodeId: string;
      bedId: string;
      responsibleId: string;
      reason: string;
      diagnosis: string;
    }
  | {
      type: 'inpatient.note';
      admissionId: string;
      noteType: 'Evolução' | 'Procedimento' | 'Administração de medicamento';
      text: string;
    }
  | { type: 'inpatient.transfer'; admissionId: string; toBedId: string; reason: string }
  | {
      type: 'inpatient.event';
      admissionId: string;
      eventType: 'Parto' | 'Cirurgia';
      description: string;
    }
  | {
      type: 'inpatient.discharge';
      admissionId: string;
      outcome:
        | 'Alta clínica'
        | 'Alta contra parecer médico'
        | 'Transferência para outra unidade'
        | 'Óbito';
      destination: string;
      notes: string;
    }
  | {
      type: 'bed.status';
      bedId: string;
      status: 'Livre' | 'Bloqueada' | 'Em manutenção';
      note: string;
    };

export type PharmacyCommand =
  | {
      type: 'product.save';
      id?: string;
      code: string;
      name: string;
      category: 'Medicamento' | 'Material gastável' | 'Consumível' | 'Equipamento';
      measure: string;
      minimumStock: number;
      maximumStock: number;
    }
  | { type: 'supplier.save'; id?: string; name: string; contact: string }
  | {
      type: 'stock.entry';
      productId: string;
      batchCode: string;
      expiry: string | null;
      quantity: number;
      supplierId: string | null;
      reason: string;
    }
  | { type: 'stock.exit'; batchId: string; quantity: number; reason: string }
  | {
      type: 'stock.transfer';
      batchId: string;
      quantity: number;
      destination: string;
      reason: string;
    }
  | { type: 'stock.adjust'; batchId: string; counted: number; reason: string }
  | {
      type: 'pharmacy.dispense';
      consultationId: string;
      prescriptionItemId: string;
      batchId: string;
      quantity: number;
    };

export type Command =
  | ClinicalCommand
  | DiagnosticCommand
  | InpatientCommand
  | PharmacyCommand
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
    // A quantidade já dispensada pertence à farmácia: é preservada, nunca recebida do formulário.
    const prescriptions = command.prescriptions.map((item) => {
      const existing = consultation.prescriptions.find((p) => p.id === item.id);
      const dispensed = existing?.dispensed ?? 0;
      if (dispensed > item.quantity)
        fail(
          `Já foram dispensadas ${dispensed} unidade(s) de ${item.medication}. A quantidade não pode ser inferior.`,
        );
      return prescriptionItemSchema.parse({
        ...item,
        id: item.id || crypto.randomUUID(),
        dispensed,
      });
    });
    for (const previous of consultation.prescriptions)
      if (previous.dispensed > 0 && !prescriptions.some((p) => p.id === previous.id))
        fail(`${previous.medication} já foi dispensado e não pode ser removido da prescrição.`);
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
    episode.status = command.outcome === 'Internamento' ? 'Aguarda internamento' : 'Concluído';
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
  const examFor = (id: string): Exam =>
    db.exams.find((e) => e.id === id) ?? fail('Pedido de exame não encontrado.');
  /** Faz avançar um pedido apenas a partir dos estados admitidos pela via correspondente. */
  const advance = (exam: Exam, from: ExamStatus[], to: ExamStatus) => {
    if (exam.status === 'Cancelado') fail('Este pedido foi cancelado e já não pode avançar.');
    if (!from.includes(exam.status))
      fail(`Transição não permitida: o pedido está em «${exam.status}».`);
    exam.status = to;
  };
  const examLabel = (exam: Exam) => `${patientFor(exam.patientId).name} · ${exam.examType}`;
  if (command.type === 'exam.request') {
    if (!canConsult(session)) fail('Este perfil não tem permissão para pedir exames.');
    const consultation =
      db.consultations.find((c) => c.id === command.consultationId) ??
      fail('Consulta não encontrada.');
    if (consultation.status !== 'Em curso')
      fail('Os pedidos são feitos durante a consulta. Utilize uma adenda numa consulta concluída.');
    const examType = command.examType.trim();
    if (
      db.exams.some(
        (e) =>
          e.consultationId === consultation.id &&
          e.examType === examType &&
          !['Cancelado', 'Validado'].includes(e.status),
      )
    )
      fail('Já existe um pedido activo deste exame nesta consulta.');
    const parsed = examSchema.safeParse({
      id: crypto.randomUUID(),
      unitId: db.unit.id,
      patientId: consultation.patientId,
      episodeId: consultation.episodeId,
      consultationId: consultation.id,
      category: command.category,
      examType,
      priority: command.priority,
      clinicalNote: command.clinicalNote.trim(),
      requestedBy: session.name,
      requestedAt: now,
      status: 'Pedido',
      collection: null,
      schedule: null,
      performance: null,
      report: null,
      validation: null,
      cancellation: null,
    });
    if (!parsed.success) fail(parsed.error.issues[0]?.message || 'Verifique o pedido de exame.');
    db.exams.push(parsed.data!);
    entityId = parsed.data!.id;
    action = 'Exame pedido';
    detail = `${examLabel(parsed.data!)} · ${command.category} · ${command.priority}`;
  }
  if (command.type === 'exam.collect') {
    if (!canDiagnostics(session)) fail('Este perfil não tem permissão para operar o laboratório.');
    const exam = examFor(command.examId);
    if (exam.category !== 'Laboratório')
      fail('A colheita aplica-se apenas a exames laboratoriais.');
    const sampleCode = command.sampleCode.trim().toUpperCase();
    if (sampleCode.length < 2) fail('Indique o código da amostra.');
    if (db.exams.some((e) => e.id !== exam.id && e.collection?.sampleCode === sampleCode))
      fail('Este código de amostra já está atribuído a outro pedido.');
    advance(exam, ['Pedido'], 'Colheita realizada');
    exam.collection = { at: now, author: session.name, sampleCode };
    entityId = exam.id;
    action = 'Colheita registada';
    detail = `${examLabel(exam)} · Amostra ${sampleCode}`;
  }
  if (command.type === 'exam.process') {
    if (!canDiagnostics(session)) fail('Este perfil não tem permissão para operar o laboratório.');
    const exam = examFor(command.examId);
    if (exam.category !== 'Laboratório') fail('O processamento aplica-se a exames laboratoriais.');
    advance(exam, ['Colheita realizada'], 'Em processamento');
    entityId = exam.id;
    action = 'Amostra em processamento';
    detail = examLabel(exam);
  }
  if (command.type === 'exam.schedule') {
    if (!canDiagnostics(session)) fail('Este perfil não tem permissão para operar a imagiologia.');
    const exam = examFor(command.examId);
    if (exam.category !== 'Imagiologia') fail('O agendamento aplica-se a exames de imagiologia.');
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(command.date) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(command.time)
    )
      fail('Indique uma data e hora válidas para a realização.');
    if (command.date < today()) fail('Não é possível agendar a realização para uma data passada.');
    advance(exam, ['Pedido', 'Agendado'], 'Agendado');
    exam.schedule = {
      at: now,
      author: session.name,
      scheduledFor: `${command.date}T${command.time}:00+01:00`,
    };
    entityId = exam.id;
    action = 'Exame agendado';
    detail = `${examLabel(exam)} · ${command.date} ${command.time}`;
  }
  if (command.type === 'exam.perform') {
    if (!canDiagnostics(session)) fail('Este perfil não tem permissão para operar a imagiologia.');
    const exam = examFor(command.examId);
    if (exam.category !== 'Imagiologia') fail('A realização aplica-se a exames de imagiologia.');
    advance(exam, ['Agendado'], 'Realizado');
    exam.performance = { at: now, author: session.name };
    entityId = exam.id;
    action = 'Exame realizado';
    detail = examLabel(exam);
  }
  if (command.type === 'exam.report') {
    if (!canDiagnostics(session)) fail('Este perfil não tem permissão para lançar resultados.');
    const exam = examFor(command.examId);
    if (command.summary.trim().length < 3) fail('Indique o resultado ou a conclusão do relatório.');
    advance(
      exam,
      exam.category === 'Laboratório' ? ['Em processamento'] : ['Realizado'],
      exam.category === 'Laboratório' ? 'Resultado disponível' : 'Relatado',
    );
    exam.report = {
      at: now,
      author: session.name,
      summary: command.summary.trim(),
      findings: command.findings.trim(),
      attachment: command.attachment.trim(),
    };
    entityId = exam.id;
    action = exam.category === 'Laboratório' ? 'Resultado lançado' : 'Relatório lançado';
    detail = `${examLabel(exam)} · aguarda validação médica`;
  }
  if (command.type === 'exam.validate') {
    if (!canConsult(session)) fail('Apenas o médico valida resultados de exames.');
    const exam = examFor(command.examId);
    if (!exam.report) fail('Não existe resultado para validar.');
    advance(exam, ['Resultado disponível', 'Relatado'], 'Validado');
    exam.validation = { at: now, author: session.name, notes: command.notes.trim() };
    entityId = exam.id;
    action = 'Resultado validado';
    detail = `${examLabel(exam)} · entra no processo clínico`;
  }
  if (command.type === 'exam.cancel') {
    if (!canConsult(session) && !canDiagnostics(session))
      fail('Este perfil não tem permissão para cancelar pedidos.');
    const exam = examFor(command.examId);
    if (exam.status === 'Validado') fail('Um resultado validado não pode ser cancelado.');
    if (exam.status === 'Cancelado') fail('Este pedido já está cancelado.');
    if (command.reason.trim().length < 3) fail('Indique a justificação do cancelamento.');
    exam.status = 'Cancelado';
    exam.cancellation = { at: now, author: session.name, reason: command.reason.trim() };
    entityId = exam.id;
    action = 'Pedido de exame cancelado';
    detail = `${examLabel(exam)} · ${command.reason.trim()}`;
  }
  const admissionFor = (id: string): Admission =>
    db.admissions.find((a) => a.id === id) ?? fail('Internamento não encontrado.');
  const bedFor = (id: string): Bed =>
    db.beds.find((b) => b.id === id && b.unitId === db.unit.id) ?? fail('Cama não encontrada.');
  const bedLabel = (bed: Bed) =>
    `${db.wards.find((w) => w.id === bed.wardId)?.name ?? 'Enfermaria'} · ${bed.code}`;
  const openStay = (admission: Admission) => {
    if (admission.status !== 'Internado')
      fail('Este internamento já teve alta e não pode ser alterado.');
    return admission;
  };
  if (command.type === 'inpatient.admit') {
    if (!canConsult(session)) fail('A admissão em enfermaria é um acto médico.');
    const episode =
      db.episodes.find((e) => e.id === command.episodeId) ?? fail('Episódio não encontrado.');
    if (episode.status !== 'Aguarda internamento')
      fail('Só é possível internar um episódio encaminhado para internamento na consulta.');
    if (db.admissions.some((a) => a.patientId === episode.patientId && a.status === 'Internado'))
      fail('O paciente já tem um internamento activo.');
    const bed = bedFor(command.bedId);
    if (bed.status !== 'Livre') fail(`A cama ${bedLabel(bed)} está ${bed.status.toLowerCase()}.`);
    const responsible =
      db.professionals.find((p) => p.id === command.responsibleId) ??
      fail('Seleccione o médico responsável.');
    const parsed = admissionSchema.safeParse({
      id: crypto.randomUUID(),
      unitId: db.unit.id,
      patientId: episode.patientId,
      episodeId: episode.id,
      consultationId: db.consultations.find((c) => c.episodeId === episode.id)?.id ?? null,
      wardId: bed.wardId,
      bedId: bed.id,
      responsibleId: responsible.id,
      admittedAt: now,
      admittedBy: session.name,
      reason: command.reason,
      diagnosis: command.diagnosis.trim(),
      status: 'Internado',
      notes: [],
      transfers: [],
      events: [],
      discharge: null,
    });
    if (!parsed.success) fail(parsed.error.issues[0]?.message || 'Verifique os dados da admissão.');
    db.admissions.push(parsed.data!);
    bed.status = 'Ocupada';
    episode.status = 'Internado';
    entityId = parsed.data!.id;
    action = 'Internamento aberto';
    detail = `${patientFor(episode.patientId).name} · ${bedLabel(bed)} · ${responsible.name}`;
  }
  if (command.type === 'inpatient.note') {
    if (!canWard(session)) fail('Este perfil não tem permissão para registar cuidados.');
    const admission = openStay(admissionFor(command.admissionId));
    if (command.text.trim().length < 3) fail('Escreva o registo antes de guardar.');
    admission.notes.push({
      id: crypto.randomUUID(),
      at: now,
      author: session.name,
      type: command.noteType,
      text: command.text.trim(),
    });
    entityId = admission.id;
    action = 'Registo de enfermaria';
    detail = `${patientFor(admission.patientId).name} · ${command.noteType}`;
  }
  if (command.type === 'inpatient.transfer') {
    if (!canWard(session)) fail('Este perfil não tem permissão para transferir pacientes.');
    const admission = openStay(admissionFor(command.admissionId));
    if (command.reason.trim().length < 3) fail('Indique o motivo da transferência.');
    const origin = bedFor(admission.bedId);
    const destination = bedFor(command.toBedId);
    if (destination.id === origin.id) fail('Escolha uma cama diferente da actual.');
    if (destination.status !== 'Livre')
      fail(`A cama ${bedLabel(destination)} está ${destination.status.toLowerCase()}.`);
    // Libertar a origem e ocupar o destino fazem parte da mesma operação.
    origin.status = 'Livre';
    destination.status = 'Ocupada';
    admission.transfers.push({
      id: crypto.randomUUID(),
      at: now,
      author: session.name,
      fromBedId: origin.id,
      toBedId: destination.id,
      reason: command.reason.trim(),
    });
    admission.bedId = destination.id;
    admission.wardId = destination.wardId;
    entityId = admission.id;
    action = 'Transferência de cama';
    detail = `${patientFor(admission.patientId).name} · ${bedLabel(origin)} → ${bedLabel(destination)}`;
  }
  if (command.type === 'inpatient.event') {
    if (!canWard(session)) fail('Este perfil não tem permissão para registar ocorrências.');
    const admission = openStay(admissionFor(command.admissionId));
    if (command.description.trim().length < 3) fail('Descreva a ocorrência.');
    admission.events.push({
      id: crypto.randomUUID(),
      at: now,
      author: session.name,
      type: command.eventType,
      description: command.description.trim(),
    });
    entityId = admission.id;
    action = `Ocorrência registada: ${command.eventType}`;
    detail = patientFor(admission.patientId).name;
  }
  if (command.type === 'inpatient.discharge') {
    if (!canConsult(session)) fail('A alta de internamento é um acto médico.');
    const admission = openStay(admissionFor(command.admissionId));
    if (command.outcome === 'Transferência para outra unidade' && !command.destination.trim())
      fail('Indique a unidade de destino da referência.');
    const bed = bedFor(admission.bedId);
    const episode =
      db.episodes.find((e) => e.id === admission.episodeId) ?? fail('Episódio não encontrado.');
    admission.status = 'Alta';
    admission.discharge = {
      at: now,
      author: session.name,
      outcome: command.outcome,
      destination: command.destination.trim(),
      notes: command.notes.trim(),
    };
    bed.status = 'Livre';
    episode.status = 'Concluído';
    entityId = admission.id;
    action = 'Alta de internamento';
    detail = `${patientFor(admission.patientId).name} · ${command.outcome}`;
  }
  if (command.type === 'bed.status') {
    if (!canWard(session)) fail('Este perfil não tem permissão para gerir camas.');
    const bed = bedFor(command.bedId);
    if (bed.status === 'Ocupada')
      fail('Uma cama ocupada só muda de estado depois da alta ou da transferência.');
    if (bed.status === command.status) fail('A cama já se encontra neste estado.');
    if (command.status !== 'Livre' && !command.note.trim())
      fail('Explique por que motivo a cama fica indisponível.');
    bed.status = command.status;
    bed.note = command.status === 'Livre' ? '' : command.note.trim();
    entityId = bed.id;
    action = 'Estado da cama actualizado';
    detail = `${bedLabel(bed)} · ${command.status}`;
  }
  const productFor = (id: string): Product =>
    db.products.find((p) => p.id === id && p.unitId === db.unit.id) ??
    fail('Artigo não encontrado no armazém.');
  const batchFor = (id: string): Batch =>
    db.batches.find((b) => b.id === id && b.unitId === db.unit.id) ?? fail('Lote não encontrado.');
  const stockOf = (productId: string) =>
    db.batches.filter((b) => b.productId === productId).reduce((sum, b) => sum + b.quantity, 0);
  const expired = (batch: Batch) => !!batch.expiry && batch.expiry < today();
  /** Toda a saída de stock passa por aqui: valida a quantidade e deixa o saldo no movimento. */
  const move = (
    batch: Batch,
    type: Movement['type'],
    quantity: number,
    extra: Partial<Movement> = {},
  ) => {
    const movement: Movement = {
      id: crypto.randomUUID(),
      unitId: db.unit.id,
      productId: batch.productId,
      batchId: batch.id,
      type,
      quantity,
      balance: stockOf(batch.productId),
      at: now,
      author: session.name,
      reason: '',
      destination: '',
      patientId: null,
      prescriptionItemId: null,
      ...extra,
    };
    db.movements.unshift(movement);
    return movement;
  };
  const withdraw = (batchId: string, quantity: number, label: string) => {
    const batch = batchFor(batchId);
    if (!Number.isInteger(quantity) || quantity <= 0)
      fail(`Indique uma quantidade inteira e positiva para ${label}.`);
    if (quantity > batch.quantity)
      fail(
        `Só existem ${batch.quantity} unidade(s) no lote ${batch.code}. O stock não pode ficar negativo.`,
      );
    batch.quantity -= quantity;
    return batch;
  };
  if (command.type === 'product.save') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para gerir o armazém.');
    const parsed = productSchema.safeParse({
      ...command,
      id: command.id ?? crypto.randomUUID(),
      unitId: db.unit.id,
      code: command.code.trim().toUpperCase(),
    });
    if (!parsed.success) fail(parsed.error.issues[0]?.message || 'Verifique os dados do artigo.');
    const product = parsed.data!;
    if (db.products.some((p) => p.id !== product.id && p.code === product.code))
      fail(`O código ${product.code} já pertence a outro artigo.`);
    const previous = command.id ? productFor(command.id) : undefined;
    if (previous) Object.assign(previous, product);
    else db.products.push(product);
    entityId = product.id;
    action = previous ? 'Artigo actualizado' : 'Artigo registado';
    detail = `${product.code} · ${product.name}`;
  }
  if (command.type === 'supplier.save') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para gerir fornecedores.');
    const parsed = supplierSchema.safeParse({
      ...command,
      id: command.id ?? crypto.randomUUID(),
      unitId: db.unit.id,
    });
    if (!parsed.success)
      fail(parsed.error.issues[0]?.message || 'Verifique os dados do fornecedor.');
    const supplier = parsed.data!;
    const previous = command.id
      ? (db.suppliers.find((s) => s.id === command.id) ?? fail('Fornecedor não encontrado.'))
      : undefined;
    if (previous) Object.assign(previous, supplier);
    else db.suppliers.push(supplier);
    entityId = supplier.id;
    action = previous ? 'Fornecedor actualizado' : 'Fornecedor registado';
    detail = supplier.name;
  }
  if (command.type === 'stock.entry') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para dar entrada de stock.');
    const product = productFor(command.productId);
    const code = command.batchCode.trim().toUpperCase();
    if (!code) fail('Indique o lote ou a referência da entrada.');
    if (!Number.isInteger(command.quantity) || command.quantity <= 0)
      fail('Indique uma quantidade inteira e positiva.');
    if (command.expiry) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(command.expiry)) fail('Verifique a data de validade.');
      if (command.expiry <= today()) fail('Não é possível dar entrada a um lote já expirado.');
    }
    if (command.supplierId && !db.suppliers.some((s) => s.id === command.supplierId))
      fail('Seleccione um fornecedor válido.');
    const existing = db.batches.find(
      (b) => b.productId === product.id && b.code === code && b.expiry === (command.expiry ?? null),
    );
    const batch =
      existing ??
      (() => {
        const created: Batch = {
          id: crypto.randomUUID(),
          unitId: db.unit.id,
          productId: product.id,
          code,
          expiry: command.expiry ?? null,
          quantity: 0,
          supplierId: command.supplierId ?? null,
          receivedAt: now,
        };
        db.batches.push(created);
        return created;
      })();
    batch.quantity += command.quantity;
    const total = stockOf(product.id);
    if (product.maximumStock > 0 && total > product.maximumStock)
      fail(
        `Esta entrada ultrapassa o stock máximo de ${product.maximumStock} ${product.measure}. Reveja a quantidade.`,
      );
    move(batch, 'Entrada', command.quantity, { reason: command.reason.trim() });
    entityId = batch.id;
    action = 'Entrada de stock';
    detail = `${product.name} · lote ${code} · +${command.quantity} ${product.measure}`;
  }
  if (command.type === 'stock.exit' || command.type === 'stock.transfer') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para movimentar stock.');
    if (!command.reason.trim()) fail('Justifique o movimento de stock.');
    if (command.type === 'stock.transfer' && !command.destination.trim())
      fail('Indique o serviço de destino da requisição.');
    const batch = withdraw(command.batchId, command.quantity, 'a saída');
    const product = productFor(batch.productId);
    move(batch, command.type === 'stock.exit' ? 'Saída' : 'Transferência', command.quantity, {
      reason: command.reason.trim(),
      destination: command.type === 'stock.transfer' ? command.destination.trim() : '',
    });
    entityId = batch.id;
    action = command.type === 'stock.exit' ? 'Saída de stock' : 'Requisição de serviço';
    detail =
      `${product.name} · lote ${batch.code} · -${command.quantity} ${product.measure}` +
      (command.type === 'stock.transfer' ? ` · ${command.destination.trim()}` : '');
  }
  if (command.type === 'stock.adjust') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para ajustar inventário.');
    const batch = batchFor(command.batchId);
    if (!Number.isInteger(command.counted) || command.counted < 0)
      fail('A contagem tem de ser um número inteiro igual ou superior a zero.');
    if (command.counted === batch.quantity) fail('A contagem é igual ao stock registado.');
    if (!command.reason.trim()) fail('Justifique o ajuste de inventário.');
    const difference = command.counted - batch.quantity;
    const product = productFor(batch.productId);
    batch.quantity = command.counted;
    move(batch, 'Ajuste', difference, { reason: command.reason.trim() });
    entityId = batch.id;
    action = 'Ajuste de inventário';
    detail = `${product.name} · lote ${batch.code} · ${difference > 0 ? '+' : ''}${difference} ${product.measure}`;
  }
  if (command.type === 'pharmacy.dispense') {
    if (!canPharmacy(session)) fail('Este perfil não tem permissão para dispensar medicamentos.');
    const consultation =
      db.consultations.find((c) => c.id === command.consultationId) ??
      fail('Consulta não encontrada.');
    const item =
      consultation.prescriptions.find((p) => p.id === command.prescriptionItemId) ??
      fail('Medicamento não encontrado nesta prescrição.');
    if (item.quantity === 0)
      fail('Esta prescrição não tem quantidade registada e não pode ser dispensada.');
    const remaining = item.quantity - item.dispensed;
    if (remaining <= 0) fail('Este medicamento já foi totalmente dispensado.');
    if (!Number.isInteger(command.quantity) || command.quantity <= 0)
      fail('Indique uma quantidade inteira e positiva.');
    if (command.quantity > remaining)
      fail(`Faltam dispensar ${remaining} unidade(s). Reveja a quantidade.`);
    const candidate = batchFor(command.batchId);
    if (expired(candidate))
      fail(`O lote ${candidate.code} expirou em ${candidate.expiry}. Escolha outro lote.`);
    const batch = withdraw(command.batchId, command.quantity, 'a dispensação');
    const product = productFor(batch.productId);
    item.dispensed += command.quantity;
    move(batch, 'Dispensação', command.quantity, {
      reason: `${item.medication} ${item.dose}`,
      patientId: consultation.patientId,
      prescriptionItemId: item.id,
    });
    entityId = batch.id;
    action = item.dispensed >= item.quantity ? 'Dispensação total' : 'Dispensação parcial';
    detail = `${patientFor(consultation.patientId).name} · ${product.name} · ${command.quantity} ${product.measure}`;
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
