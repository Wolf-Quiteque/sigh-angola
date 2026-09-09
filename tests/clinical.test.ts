import { describe, expect, it } from 'vitest';
import { executeCommand } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Session } from '@/domain/schema';

const admin: Session = { name: 'Admin', role: 'Administrador' };
const nurse: Session = { name: 'Enf. Teste', role: 'Enfermeiro' };
const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const receptionist: Session = { name: 'Recepção', role: 'Recepcionista' };
const triage = {
  type: 'triage.save' as const,
  episodeId: 'e1',
  chiefComplaint: 'Dor abdominal intensa',
  priority: 'Laranja' as const,
  temperature: 37.2,
  systolic: 130,
  diastolic: 85,
  heartRate: 92,
  respiratoryRate: 20,
  oxygenSaturation: 97,
  weight: 68,
  height: 169,
  notes: 'Paciente consciente.',
};

describe('Fase 2: fluxo clínico', () => {
  it('regista triagem manual completa e avança o episódio', () => {
    const db = executeCommand(createSeed(), triage, nurse);
    expect(db.triages).toHaveLength(1);
    expect(db.episodes.find((e) => e.id === 'e1')?.status).toBe('Aguarda consulta');
    expect(db.audit[0].detail).toContain('Laranja');
  });
  it('não permite triagem ao recepcionista, duplicada ou com sinais inválidos', () => {
    expect(() => executeCommand(createSeed(), triage, receptionist)).toThrow('permissão');
    const db = executeCommand(createSeed(), triage, nurse);
    expect(() => executeCommand(db, triage, nurse)).toThrow('já não aguarda triagem');
    expect(() =>
      executeCommand(createSeed(), { ...triage, oxygenSaturation: 120 }, nurse),
    ).toThrow();
  });
  it('não inicia consulta antes da triagem ou com perfil errado', () => {
    expect(() =>
      executeCommand(
        createSeed(),
        { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
        doctor,
      ),
    ).toThrow('depois da triagem');
    const triaged = executeCommand(createSeed(), triage, nurse);
    expect(() =>
      executeCommand(
        triaged,
        { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
        receptionist,
      ),
    ).toThrow('permissão');
  });
  it('executa triagem, consulta, prescrição e conclusão com referências consistentes', () => {
    let db = executeCommand(createSeed(), triage, nurse);
    db = executeCommand(
      db,
      { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
      doctor,
    );
    const consultation = db.consultations[0];
    db = executeCommand(
      db,
      {
        type: 'consultation.save',
        consultationId: consultation.id,
        history: 'Sem antecedentes relevantes.',
        allergies: 'Nega alergias.',
        diagnosis: 'Gastrite aguda',
        procedures: 'Exame físico',
        evolution: 'Alta com orientação e medicação.',
        prescriptions: [
          {
            medication: 'Omeprazol',
            dose: '20 mg',
            route: 'Oral',
            frequency: '1 vez por dia',
            duration: '7 dias',
            notes: '',
          },
        ],
      },
      doctor,
    );
    db = executeCommand(
      db,
      {
        type: 'consultation.complete',
        consultationId: consultation.id,
        outcome: 'Alta ambulatória',
      },
      doctor,
    );
    expect(db.consultations[0].status).toBe('Concluída');
    expect(db.consultations[0].prescriptions[0].id).toBeTruthy();
    expect(db.episodes.find((e) => e.id === 'e1')?.status).toBe('Concluído');
    expect(db.consultations[0].patientId).toBe(db.triages[0].patientId);
  });
  it('exige diagnóstico e evolução para concluir', () => {
    let db = executeCommand(createSeed(), triage, admin);
    db = executeCommand(
      db,
      { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
      admin,
    );
    expect(() =>
      executeCommand(
        db,
        {
          type: 'consultation.complete',
          consultationId: db.consultations[0].id,
          outcome: 'Alta ambulatória',
        },
        admin,
      ),
    ).toThrow('diagnóstico');
  });
  it('bloqueia alterações após conclusão e permite apenas adendas rastreáveis', () => {
    let db = executeCommand(createSeed(), triage, nurse);
    db = executeCommand(
      db,
      { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' },
      doctor,
    );
    const id = db.consultations[0].id;
    db = executeCommand(
      db,
      {
        type: 'consultation.save',
        consultationId: id,
        history: '',
        allergies: '',
        diagnosis: 'Diagnóstico demo',
        procedures: '',
        evolution: 'Melhoria clínica.',
        prescriptions: [],
      },
      doctor,
    );
    db = executeCommand(
      db,
      { type: 'consultation.complete', consultationId: id, outcome: 'Alta ambulatória' },
      doctor,
    );
    expect(() =>
      executeCommand(
        db,
        {
          type: 'consultation.save',
          consultationId: id,
          history: '',
          allergies: '',
          diagnosis: 'Alterado',
          procedures: '',
          evolution: 'Alterado',
          prescriptions: [],
        },
        doctor,
      ),
    ).toThrow('adenda');
    const amended = executeCommand(
      db,
      {
        type: 'consultation.amend',
        consultationId: id,
        reason: 'Clarificação',
        text: 'Informação complementar.',
      },
      doctor,
    );
    expect(amended.consultations[0].diagnosis).toBe('Diagnóstico demo');
    expect(amended.consultations[0].amendments[0].author).toBe('Dra. Teste');
  });
});
