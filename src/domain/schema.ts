import { z } from 'zod';

export const roles = [
  'Administrador',
  'Recepcionista',
  'Enfermeiro',
  'Médico',
  'Direcção',
] as const;
export type Role = (typeof roles)[number];
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Indique uma data válida.')
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Data inválida.',
  );
export const patientInputSchema = z.object({
  name: z.string().trim().min(3, 'Indique o nome completo.').max(120),
  birthDate: date.refine(
    (v) => v <= new Date().toISOString().slice(0, 10) && v >= '1900-01-01',
    'Verifique a data de nascimento.',
  ),
  sex: z.enum(['Feminino', 'Masculino', 'Não indicado']),
  document: z
    .string()
    .trim()
    .max(30)
    .transform((v) => v.toUpperCase().replace(/\s/g, '')),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => !v || /^(\+244\s?)?9\d{8}$/.test(v.replace(/\s/g, '')),
      'Use um número angolano de 9 dígitos, com ou sem +244.',
    ),
  municipality: z.string().trim().min(2, 'Indique o município.').max(80),
  address: z.string().trim().max(200),
  guardian: z.string().trim().max(120),
  emergencyContact: z.string().trim().max(160),
});
export type PatientInput = z.input<typeof patientInputSchema>;
export const patientSchema = patientInputSchema.extend({
  id: z.string(),
  number: z.string(),
  unitId: z.string(),
  createdAt: z.string(),
});
export type Patient = z.infer<typeof patientSchema>;
export const appointmentSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  unitId: z.string(),
  professionalId: z.string(),
  specialty: z.string(),
  date,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  status: z.enum(['Marcada', 'Confirmada', 'Cancelada', 'Admitida']),
  reason: z.string(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const episodeSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  unitId: z.string(),
  appointmentId: z.string().nullable(),
  arrivedAt: z.string(),
  service: z.string(),
  reason: z.string(),
  status: z.enum(['Aguarda triagem', 'Aguarda consulta', 'Em consulta', 'Concluído']),
});
export type Episode = z.infer<typeof episodeSchema>;
export const triageSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  patientId: z.string(),
  nurse: z.string(),
  recordedAt: z.string(),
  chiefComplaint: z.string().trim().min(3),
  priority: z.enum(['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul']),
  temperature: z.number().min(25).max(45),
  systolic: z.number().int().min(40).max(300),
  diastolic: z.number().int().min(20).max(200),
  heartRate: z.number().int().min(20).max(250),
  respiratoryRate: z.number().int().min(5).max(80),
  oxygenSaturation: z.number().int().min(40).max(100),
  weight: z.number().positive().max(500).nullable(),
  height: z.number().positive().max(250).nullable(),
  notes: z.string().max(2000),
});
export type Triage = z.infer<typeof triageSchema>;
export const prescriptionItemSchema = z.object({
  id: z.string(),
  medication: z.string().trim().min(2),
  dose: z.string().trim().min(1),
  route: z.string().trim().min(1),
  frequency: z.string().trim().min(1),
  duration: z.string().trim().min(1),
  notes: z.string().max(500),
});
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;
export const consultationSchema = z.object({
  id: z.string(),
  episodeId: z.string(),
  patientId: z.string(),
  professionalId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  status: z.enum(['Em curso', 'Concluída']),
  history: z.string().max(3000),
  allergies: z.string().max(1000),
  diagnosis: z.string().max(2000),
  procedures: z.string().max(2000),
  evolution: z.string().max(3000),
  outcome: z.enum(['Alta ambulatória', 'Observação', 'Internamento', 'Transferência']).nullable(),
  prescriptions: z.array(prescriptionItemSchema),
  amendments: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      author: z.string(),
      reason: z.string().trim().min(3),
      text: z.string().trim().min(3),
    }),
  ),
});
export type Consultation = z.infer<typeof consultationSchema>;
export const databaseSchema = z.object({
  version: z.literal(2),
  revision: z.number().int().nonnegative(),
  unit: z.object({
    id: z.string(),
    name: z.string(),
    municipality: z.string(),
    province: z.string(),
  }),
  professionals: z.array(z.object({ id: z.string(), name: z.string(), specialty: z.string() })),
  patients: z.array(patientSchema),
  appointments: z.array(appointmentSchema),
  episodes: z.array(episodeSchema),
  triages: z.array(triageSchema),
  consultations: z.array(consultationSchema),
  audit: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      actor: z.string(),
      action: z.string(),
      entityId: z.string(),
      detail: z.string(),
    }),
  ),
});
export type Database = z.infer<typeof databaseSchema>;
export type Session = { name: string; role: Role };
export const canWrite = (session: Session) => session.role !== 'Direcção';
export const canReception = (session: Session) =>
  ['Administrador', 'Recepcionista'].includes(session.role);
export const canTriage = (session: Session) =>
  ['Administrador', 'Enfermeiro'].includes(session.role);
export const canConsult = (session: Session) => ['Administrador', 'Médico'].includes(session.role);
