import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Database, Session } from '@/domain/schema';

const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const technician: Session = { name: 'Téc. Teste', role: 'Técnico' };
const nurse: Session = { name: 'Enf. Teste', role: 'Enfermeiro' };
const management: Session = { name: 'Direcção', role: 'Direcção' };

const triage = {
  type: 'triage.save' as const,
  episodeId: 'e1',
  chiefComplaint: 'Febre alta há dois dias',
  priority: 'Amarelo' as const,
  temperature: 38.6,
  systolic: 120,
  diastolic: 78,
  heartRate: 98,
  respiratoryRate: 19,
  oxygenSaturation: 96,
  weight: 62,
  height: 165,
  notes: '',
};

/** Leva o episódio e1 até uma consulta em curso, de onde partem os pedidos. */
function withConsultation() {
  let db = executeCommand(createSeed(), triage, nurse);
  db = executeCommand(
    db,
    { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
    doctor,
  );
  return { db, consultationId: db.consultations.find((c) => c.episodeId === 'e1')!.id };
}
function request(db: Database, consultationId: string, category: 'Laboratório' | 'Imagiologia') {
  return executeCommand(
    db,
    {
      type: 'exam.request',
      consultationId,
      category,
      examType: category === 'Laboratório' ? 'Hemograma completo' : 'Radiografia de tórax',
      priority: 'Rotina',
      clinicalNote: 'Avaliação inicial.',
    },
    doctor,
  );
}
const lastExam = (db: Database) => db.exams[db.exams.length - 1];
const run = (db: Database, command: Command, session: Session) =>
  executeCommand(db, command, session);

describe('Fase 3: laboratório e imagiologia', () => {
  it('cria o pedido ligado à consulta, ao episódio e ao paciente', () => {
    const { db, consultationId } = withConsultation();
    const next = request(db, consultationId, 'Laboratório');
    const exam = lastExam(next);
    expect(exam.consultationId).toBe(consultationId);
    expect(exam.episodeId).toBe('e1');
    expect(exam.patientId).toBe(next.consultations.find((c) => c.id === consultationId)!.patientId);
    expect(exam.status).toBe('Pedido');
    expect(next.audit[0].action).toBe('Exame pedido');
  });

  it('recusa pedidos fora de uma consulta em curso e duplicados activos', () => {
    const { db, consultationId } = withConsultation();
    let next = request(db, consultationId, 'Laboratório');
    expect(() => request(next, consultationId, 'Laboratório')).toThrow(
      'Já existe um pedido activo',
    );
    next = run(
      next,
      {
        type: 'consultation.save',
        consultationId,
        history: '',
        allergies: '',
        diagnosis: 'Suspeita de infecção',
        procedures: '',
        evolution: 'Aguarda resultados.',
        prescriptions: [],
      },
      doctor,
    );
    next = run(
      next,
      { type: 'consultation.complete', consultationId, outcome: 'Alta ambulatória' },
      doctor,
    );
    expect(() => request(next, consultationId, 'Imagiologia')).toThrow('durante a consulta');
  });

  it('percorre a via laboratorial de pedido a resultado validado', () => {
    const { db, consultationId } = withConsultation();
    let next = request(db, consultationId, 'Laboratório');
    const examId = lastExam(next).id;
    next = run(next, { type: 'exam.collect', examId, sampleCode: 'am-000099' }, technician);
    expect(lastExam(next).status).toBe('Colheita realizada');
    expect(lastExam(next).collection?.sampleCode).toBe('AM-000099');
    next = run(next, { type: 'exam.process', examId }, technician);
    expect(lastExam(next).status).toBe('Em processamento');
    next = run(
      next,
      {
        type: 'exam.report',
        examId,
        summary: 'Hemoglobina 11,2 g/dL',
        findings: 'Série branca sem alterações.',
        attachment: 'hemograma-demo.pdf',
      },
      technician,
    );
    expect(lastExam(next).status).toBe('Resultado disponível');
    expect(lastExam(next).validation).toBeNull();
    next = run(next, { type: 'exam.validate', examId, notes: 'Compatível.' }, doctor);
    expect(lastExam(next).status).toBe('Validado');
    expect(lastExam(next).validation?.author).toBe('Dra. Teste');
  });

  it('percorre a via de imagiologia de pedido a relatório validado', () => {
    const { db, consultationId } = withConsultation();
    let next = request(db, consultationId, 'Imagiologia');
    const examId = lastExam(next).id;
    expect(() =>
      run(next, { type: 'exam.collect', examId, sampleCode: 'AM-1' }, technician),
    ).toThrow('exames laboratoriais');
    const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    next = run(next, { type: 'exam.schedule', examId, date, time: '11:30' }, technician);
    expect(lastExam(next).status).toBe('Agendado');
    expect(lastExam(next).schedule?.scheduledFor).toContain(date);
    next = run(next, { type: 'exam.perform', examId }, technician);
    expect(lastExam(next).status).toBe('Realizado');
    next = run(
      next,
      {
        type: 'exam.report',
        examId,
        summary: 'Sem alterações pleuroparenquimatosas',
        findings: '',
        attachment: '',
      },
      technician,
    );
    expect(lastExam(next).status).toBe('Relatado');
    next = run(next, { type: 'exam.validate', examId, notes: '' }, doctor);
    expect(lastExam(next).status).toBe('Validado');
  });

  it('impede saltar etapas e agendar para uma data passada', () => {
    const { db, consultationId } = withConsultation();
    let next = request(db, consultationId, 'Laboratório');
    const examId = lastExam(next).id;
    expect(() => run(next, { type: 'exam.process', examId }, technician)).toThrow(
      'Transição não permitida',
    );
    expect(() =>
      run(
        next,
        { type: 'exam.report', examId, summary: 'Resultado', findings: '', attachment: '' },
        technician,
      ),
    ).toThrow('Transição não permitida');
    expect(() => run(next, { type: 'exam.validate', examId, notes: '' }, doctor)).toThrow(
      'Não existe resultado',
    );
    next = request(next, consultationId, 'Imagiologia');
    expect(() =>
      run(
        next,
        { type: 'exam.schedule', examId: lastExam(next).id, date: '2020-01-01', time: '09:00' },
        technician,
      ),
    ).toThrow('data passada');
  });

  it('aplica permissões por perfil a cada etapa', () => {
    const { db, consultationId } = withConsultation();
    expect(() =>
      executeCommand(
        db,
        {
          type: 'exam.request',
          consultationId,
          category: 'Laboratório',
          examType: 'Hemograma completo',
          priority: 'Rotina',
          clinicalNote: '',
        },
        nurse,
      ),
    ).toThrow('permissão');
    let next = request(db, consultationId, 'Laboratório');
    const examId = lastExam(next).id;
    expect(() => run(next, { type: 'exam.collect', examId, sampleCode: 'AM-1' }, doctor)).toThrow(
      'permissão',
    );
    next = run(next, { type: 'exam.collect', examId, sampleCode: 'AM-000200' }, technician);
    next = run(next, { type: 'exam.process', examId }, technician);
    next = run(
      next,
      { type: 'exam.report', examId, summary: 'Resultado demo', findings: '', attachment: '' },
      technician,
    );
    expect(() => run(next, { type: 'exam.validate', examId, notes: '' }, technician)).toThrow(
      'médico valida',
    );
    expect(() => run(next, { type: 'exam.validate', examId, notes: '' }, management)).toThrow(
      'apenas de leitura',
    );
  });

  it('recusa códigos de amostra repetidos', () => {
    const { db, consultationId } = withConsultation();
    const next = request(db, consultationId, 'Laboratório');
    const examId = lastExam(next).id;
    // AM-000014 já pertence a um pedido do cenário inicial.
    expect(db.exams.some((e) => e.collection?.sampleCode === 'AM-000014')).toBe(true);
    expect(() =>
      run(next, { type: 'exam.collect', examId, sampleCode: 'am-000014' }, technician),
    ).toThrow('já está atribuído');
    const collected = run(
      next,
      { type: 'exam.collect', examId, sampleCode: 'AM-000099' },
      technician,
    );
    expect(collected.exams.find((e) => e.id === examId)?.collection?.sampleCode).toBe('AM-000099');
  });

  it('cancela com justificação e protege o resultado validado', () => {
    const { db, consultationId } = withConsultation();
    let next = request(db, consultationId, 'Laboratório');
    const examId = lastExam(next).id;
    expect(() => run(next, { type: 'exam.cancel', examId, reason: 'x' }, doctor)).toThrow(
      'justificação',
    );
    const cancelled = run(
      next,
      { type: 'exam.cancel', examId, reason: 'Pedido repetido por engano.' },
      doctor,
    );
    expect(cancelled.exams.find((e) => e.id === examId)?.status).toBe('Cancelado');
    expect(cancelled.exams.find((e) => e.id === examId)?.cancellation?.author).toBe('Dra. Teste');
    expect(() =>
      run(cancelled, { type: 'exam.collect', examId, sampleCode: 'AM-000300' }, technician),
    ).toThrow('cancelado');

    next = run(next, { type: 'exam.collect', examId, sampleCode: 'AM-000301' }, technician);
    next = run(next, { type: 'exam.process', examId }, technician);
    next = run(
      next,
      { type: 'exam.report', examId, summary: 'Dentro dos valores', findings: '', attachment: '' },
      technician,
    );
    next = run(next, { type: 'exam.validate', examId, notes: '' }, doctor);
    expect(() =>
      run(next, { type: 'exam.cancel', examId, reason: 'Já não é necessário.' }, doctor),
    ).toThrow('não pode ser cancelado');
  });

  it('mantém o cenário inicial coerente com o processo clínico', () => {
    const db = createSeed();
    expect(db.exams).toHaveLength(3);
    for (const exam of db.exams) {
      expect(db.consultations.some((c) => c.id === exam.consultationId)).toBe(true);
      expect(db.episodes.some((e) => e.id === exam.episodeId)).toBe(true);
      expect(db.patients.some((p) => p.id === exam.patientId)).toBe(true);
    }
    const validated = db.exams.filter((e) => e.status === 'Validado');
    expect(validated).toHaveLength(1);
    expect(validated[0].validation).not.toBeNull();
    expect(db.exams.filter((e) => e.status !== 'Validado').every((e) => !e.validation)).toBe(true);
  });
});
