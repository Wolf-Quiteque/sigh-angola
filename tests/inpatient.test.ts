import { describe, expect, it } from 'vitest';
import { executeCommand, type Command } from '@/domain/commands';
import { createSeed } from '@/domain/seed';
import type { Database, Session } from '@/domain/schema';

const doctor: Session = { name: 'Dra. Teste', role: 'Médico' };
const nurse: Session = { name: 'Enf. Teste', role: 'Enfermeiro' };
const receptionist: Session = { name: 'Recepção', role: 'Recepcionista' };
const management: Session = { name: 'Direcção', role: 'Direcção' };
const run = (db: Database, command: Command, session: Session) =>
  executeCommand(db, command, session);

const triage = {
  type: 'triage.save' as const,
  episodeId: 'e1',
  chiefComplaint: 'Dor abdominal intensa',
  priority: 'Laranja' as const,
  temperature: 38.2,
  systolic: 110,
  diastolic: 70,
  heartRate: 104,
  respiratoryRate: 22,
  oxygenSaturation: 96,
  weight: 70,
  height: 170,
  notes: '',
};

/** Leva o episódio e1 até uma consulta concluída com destino «Internamento». */
function awaitingBed() {
  let db = executeCommand(createSeed(), triage, nurse);
  db = run(db, { type: 'consultation.start', episodeId: 'e1', professionalId: 'med-1' }, doctor);
  const consultationId = db.consultations.find((c) => c.episodeId === 'e1')!.id;
  db = run(
    db,
    {
      type: 'consultation.save',
      consultationId,
      history: '',
      allergies: '',
      diagnosis: 'Abdómen agudo',
      procedures: '',
      evolution: 'Necessita de vigilância em enfermaria.',
      prescriptions: [],
    },
    doctor,
  );
  db = run(db, { type: 'consultation.complete', consultationId, outcome: 'Internamento' }, doctor);
  return db;
}
const admit = (db: Database, bedId = 'mi-1') =>
  run(
    db,
    {
      type: 'inpatient.admit',
      episodeId: 'e1',
      bedId,
      responsibleId: 'med-1',
      reason: 'Vigilância e hidratação endovenosa',
      diagnosis: 'Abdómen agudo',
    },
    doctor,
  );
const stayFor = (db: Database, episodeId: string) =>
  db.admissions.find((a) => a.episodeId === episodeId)!;
const bed = (db: Database, id: string) => db.beds.find((b) => b.id === id)!;

describe('Fase 4: internamento e gestão de camas', () => {
  it('encaminha para internamento em vez de encerrar o episódio', () => {
    const db = awaitingBed();
    expect(db.episodes.find((e) => e.id === 'e1')?.status).toBe('Aguarda internamento');
    expect(db.consultations.find((c) => c.episodeId === 'e1')?.status).toBe('Concluída');
  });

  it('abre o internamento, ocupa a cama e liga episódio, consulta e responsável', () => {
    const db = admit(awaitingBed());
    const stay = stayFor(db, 'e1');
    expect(stay.status).toBe('Internado');
    expect(stay.bedId).toBe('mi-1');
    expect(stay.wardId).toBe('w1');
    expect(stay.consultationId).toBe(db.consultations.find((c) => c.episodeId === 'e1')!.id);
    expect(bed(db, 'mi-1').status).toBe('Ocupada');
    expect(db.episodes.find((e) => e.id === 'e1')?.status).toBe('Internado');
    expect(db.audit[0].action).toBe('Internamento aberto');
  });

  it('recusa cama ocupada, bloqueada ou em manutenção e episódio não encaminhado', () => {
    const db = awaitingBed();
    expect(() => admit(db, 'mi-3')).toThrow('ocupada');
    expect(() => admit(db, 'mi-7')).toThrow('bloqueada');
    expect(() => admit(db, 'ped-5')).toThrow('manutenção');
    expect(() =>
      run(
        createSeed(),
        {
          type: 'inpatient.admit',
          episodeId: 'e2',
          bedId: 'mi-1',
          responsibleId: 'med-1',
          reason: 'Sem consulta prévia',
          diagnosis: '',
        },
        doctor,
      ),
    ).toThrow('encaminhado para internamento');
  });

  it('não admite o mesmo paciente duas vezes nem ocupa a mesma cama duas vezes', () => {
    const db = admit(awaitingBed());
    expect(() => admit(db)).toThrow('encaminhado para internamento');
    // A cama do internamento do cenário inicial continua indisponível.
    expect(bed(db, 'mi-3').status).toBe('Ocupada');
    expect(db.admissions.filter((a) => a.status === 'Internado').map((a) => a.bedId)).toEqual([
      'mi-3',
      'mi-1',
    ]);
  });

  it('transfere libertando a origem e ocupando o destino na mesma operação', () => {
    let db = admit(awaitingBed());
    const admissionId = stayFor(db, 'e1').id;
    expect(() =>
      run(db, { type: 'inpatient.transfer', admissionId, toBedId: 'mi-1', reason: 'Igual' }, nurse),
    ).toThrow('cama diferente');
    expect(() =>
      run(
        db,
        { type: 'inpatient.transfer', admissionId, toBedId: 'mi-3', reason: 'Ocupada' },
        nurse,
      ),
    ).toThrow('ocupada');
    db = run(
      db,
      { type: 'inpatient.transfer', admissionId, toBedId: 'ped-1', reason: 'Aproximar da mãe' },
      nurse,
    );
    expect(bed(db, 'mi-1').status).toBe('Livre');
    expect(bed(db, 'ped-1').status).toBe('Ocupada');
    const stay = stayFor(db, 'e1');
    expect(stay.bedId).toBe('ped-1');
    expect(stay.wardId).toBe('w2');
    expect(stay.transfers).toHaveLength(1);
    expect(stay.transfers[0].fromBedId).toBe('mi-1');
  });

  it('regista cuidados e ocorrências com autoria e tipo', () => {
    let db = admit(awaitingBed());
    const admissionId = stayFor(db, 'e1').id;
    db = run(
      db,
      {
        type: 'inpatient.note',
        admissionId,
        noteType: 'Administração de medicamento',
        text: 'Metronidazol 500 mg endovenoso administrado.',
      },
      nurse,
    );
    db = run(
      db,
      {
        type: 'inpatient.event',
        admissionId,
        eventType: 'Cirurgia',
        description: 'Apendicectomia.',
      },
      doctor,
    );
    const stay = stayFor(db, 'e1');
    expect(stay.notes[0].author).toBe('Enf. Teste');
    expect(stay.notes[0].type).toBe('Administração de medicamento');
    expect(stay.events[0].type).toBe('Cirurgia');
    expect(() =>
      run(db, { type: 'inpatient.note', admissionId, noteType: 'Evolução', text: 'ok' }, nurse),
    ).toThrow('Escreva o registo');
    expect(() =>
      run(
        db,
        { type: 'inpatient.note', admissionId, noteType: 'Evolução', text: 'Estável.' },
        receptionist,
      ),
    ).toThrow('permissão');
  });

  it('a alta liberta a cama, encerra o episódio e fica no histórico', () => {
    let db = admit(awaitingBed());
    const admissionId = stayFor(db, 'e1').id;
    expect(() =>
      run(
        db,
        {
          type: 'inpatient.discharge',
          admissionId,
          outcome: 'Transferência para outra unidade',
          destination: '',
          notes: '',
        },
        doctor,
      ),
    ).toThrow('unidade de destino');
    expect(() =>
      run(
        db,
        {
          type: 'inpatient.discharge',
          admissionId,
          outcome: 'Alta clínica',
          destination: '',
          notes: '',
        },
        nurse,
      ),
    ).toThrow('acto médico');
    db = run(
      db,
      {
        type: 'inpatient.discharge',
        admissionId,
        outcome: 'Alta clínica',
        destination: '',
        notes: 'Reavaliação em sete dias.',
      },
      doctor,
    );
    const stay = stayFor(db, 'e1');
    expect(stay.status).toBe('Alta');
    expect(stay.discharge?.outcome).toBe('Alta clínica');
    expect(bed(db, 'mi-1').status).toBe('Livre');
    expect(db.episodes.find((e) => e.id === 'e1')?.status).toBe('Concluído');
    expect(() =>
      run(
        db,
        { type: 'inpatient.note', admissionId, noteType: 'Evolução', text: 'Tardio.' },
        nurse,
      ),
    ).toThrow('já teve alta');
  });

  it('bloqueia e liberta camas, mas nunca uma cama ocupada', () => {
    let db = createSeed();
    expect(() =>
      run(db, { type: 'bed.status', bedId: 'mi-3', status: 'Bloqueada', note: 'Obras' }, nurse),
    ).toThrow('cama ocupada');
    expect(() =>
      run(db, { type: 'bed.status', bedId: 'mi-1', status: 'Bloqueada', note: '' }, nurse),
    ).toThrow('Explique');
    db = run(
      db,
      { type: 'bed.status', bedId: 'mi-1', status: 'Em manutenção', note: 'Colchão danificado.' },
      nurse,
    );
    expect(bed(db, 'mi-1').status).toBe('Em manutenção');
    expect(bed(db, 'mi-1').note).toBe('Colchão danificado.');
    db = run(db, { type: 'bed.status', bedId: 'mi-1', status: 'Livre', note: '' }, nurse);
    expect(bed(db, 'mi-1').note).toBe('');
    expect(() =>
      run(db, { type: 'bed.status', bedId: 'mi-1', status: 'Livre', note: '' }, nurse),
    ).toThrow('já se encontra neste estado');
    expect(() =>
      run(db, { type: 'bed.status', bedId: 'mi-1', status: 'Bloqueada', note: 'x' }, management),
    ).toThrow('apenas de leitura');
  });

  it('mantém o cenário inicial coerente entre camas e internamentos', () => {
    const db = createSeed();
    const active = db.admissions.filter((a) => a.status === 'Internado');
    const occupied = db.beds.filter((b) => b.status === 'Ocupada');
    expect(active).toHaveLength(occupied.length);
    expect(active.map((a) => a.bedId).sort()).toEqual(occupied.map((b) => b.id).sort());
    for (const stay of db.admissions) {
      expect(db.episodes.find((e) => e.id === stay.episodeId)?.status).toBe('Internado');
      expect(db.wards.some((w) => w.id === stay.wardId)).toBe(true);
      expect(db.beds.find((b) => b.id === stay.bedId)?.wardId).toBe(stay.wardId);
    }
  });
});
