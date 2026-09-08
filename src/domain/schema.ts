import { z } from 'zod';

export const roles = ['Administrador', 'Recepcionista', 'Direcção'] as const;
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
  status: z.enum(['Aguarda triagem', 'Em consulta', 'Concluído']),
});
export type Episode = z.infer<typeof episodeSchema>;
export const databaseSchema = z.object({
  version: z.literal(1),
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
