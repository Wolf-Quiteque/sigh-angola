import { z } from 'zod';

export const roles = [
  'Administrador',
  'Recepcionista',
  'Enfermeiro',
  'Médico',
  'Técnico',
  'Farmacêutico',
  'Administrativo',
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
  status: z.enum([
    'Aguarda triagem',
    'Aguarda consulta',
    'Em consulta',
    'Aguarda internamento',
    'Internado',
    'Concluído',
  ]),
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
  /** Quantidade total a dispensar. Zero significa «não registada», como nas receitas anteriores à fase 5. */
  quantity: z.number().int().min(0).max(1000),
  dispensed: z.number().int().min(0).max(1000),
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
export const examCategories = ['Laboratório', 'Imagiologia'] as const;
export type ExamCategory = (typeof examCategories)[number];
export const examCatalogue: Record<ExamCategory, readonly string[]> = {
  Laboratório: [
    'Hemograma completo',
    'Glicemia em jejum',
    'Teste rápido de malária',
    'Urina II',
    'Ureia e creatinina',
    'Transaminases',
    'Teste rápido de VIH',
    'Reacção de Widal',
  ],
  Imagiologia: [
    'Radiografia de tórax',
    'Radiografia de membro',
    'Ecografia abdominal',
    'Ecografia obstétrica',
    'Tomografia computorizada',
    'Ecocardiograma',
  ],
};
export const examStatuses = [
  'Pedido',
  'Colheita realizada',
  'Em processamento',
  'Agendado',
  'Realizado',
  'Resultado disponível',
  'Relatado',
  'Validado',
  'Cancelado',
] as const;
export type ExamStatus = (typeof examStatuses)[number];
/** Estados finais de cada via; só o estado validado entra no processo clínico como resultado final. */
export const labFlow: ExamStatus[] = [
  'Pedido',
  'Colheita realizada',
  'Em processamento',
  'Resultado disponível',
  'Validado',
];
export const imagingFlow: ExamStatus[] = [
  'Pedido',
  'Agendado',
  'Realizado',
  'Relatado',
  'Validado',
];
const stamp = z.object({ at: z.string(), author: z.string() });
export const examSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  patientId: z.string(),
  episodeId: z.string(),
  consultationId: z.string(),
  category: z.enum(examCategories),
  examType: z.string().trim().min(2, 'Indique o exame pedido.').max(120),
  priority: z.enum(['Urgente', 'Rotina']),
  clinicalNote: z.string().max(1000),
  requestedBy: z.string(),
  requestedAt: z.string(),
  status: z.enum(examStatuses),
  collection: stamp.extend({ sampleCode: z.string().trim().min(2) }).nullable(),
  schedule: stamp.extend({ scheduledFor: z.string() }).nullable(),
  performance: stamp.nullable(),
  report: stamp
    .extend({
      summary: z.string().trim().min(3),
      findings: z.string().max(4000),
      attachment: z.string().max(160),
    })
    .nullable(),
  validation: stamp.extend({ notes: z.string().max(1000) }).nullable(),
  cancellation: stamp.extend({ reason: z.string().trim().min(3) }).nullable(),
});
export type Exam = z.infer<typeof examSchema>;
export const bedStatuses = ['Livre', 'Ocupada', 'Bloqueada', 'Em manutenção'] as const;
export type BedStatus = (typeof bedStatuses)[number];
export const wardSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string(),
  service: z.string(),
});
export type Ward = z.infer<typeof wardSchema>;
export const bedSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  wardId: z.string(),
  code: z.string(),
  status: z.enum(bedStatuses),
  note: z.string().max(200),
});
export type Bed = z.infer<typeof bedSchema>;
export const dischargeOutcomes = [
  'Alta clínica',
  'Alta contra parecer médico',
  'Transferência para outra unidade',
  'Óbito',
] as const;
export type DischargeOutcome = (typeof dischargeOutcomes)[number];
export const stayNoteTypes = ['Evolução', 'Procedimento', 'Administração de medicamento'] as const;
export const stayEventTypes = ['Parto', 'Cirurgia'] as const;
export const admissionSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  patientId: z.string(),
  episodeId: z.string(),
  consultationId: z.string().nullable(),
  wardId: z.string(),
  bedId: z.string(),
  responsibleId: z.string(),
  admittedAt: z.string(),
  admittedBy: z.string(),
  reason: z.string().trim().min(3, 'Indique o motivo do internamento.').max(500),
  diagnosis: z.string().max(500),
  status: z.enum(['Internado', 'Alta']),
  notes: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      author: z.string(),
      type: z.enum(stayNoteTypes),
      text: z.string().trim().min(3),
    }),
  ),
  transfers: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      author: z.string(),
      fromBedId: z.string(),
      toBedId: z.string(),
      reason: z.string().trim().min(3),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      author: z.string(),
      type: z.enum(stayEventTypes),
      description: z.string().trim().min(3),
    }),
  ),
  discharge: z
    .object({
      at: z.string(),
      author: z.string(),
      outcome: z.enum(dischargeOutcomes),
      destination: z.string().max(160),
      notes: z.string().max(2000),
    })
    .nullable(),
});
export type Admission = z.infer<typeof admissionSchema>;
export const productCategories = [
  'Medicamento',
  'Material gastável',
  'Consumível',
  'Equipamento',
] as const;
export type ProductCategory = (typeof productCategories)[number];
export const movementTypes = [
  'Entrada',
  'Saída',
  'Ajuste',
  'Transferência',
  'Dispensação',
] as const;
export type MovementType = (typeof movementTypes)[number];
export const supplierSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string().trim().min(2, 'Indique o nome do fornecedor.').max(120),
  contact: z.string().trim().max(160),
});
export type Supplier = z.infer<typeof supplierSchema>;
export const productSchema = z
  .object({
    id: z.string(),
    unitId: z.string(),
    code: z.string().trim().min(2, 'Indique o código do artigo.').max(20),
    name: z.string().trim().min(2, 'Indique a designação do artigo.').max(120),
    category: z.enum(productCategories),
    measure: z.string().trim().min(1, 'Indique a unidade de medida.').max(30),
    minimumStock: z.number().int().min(0).max(100000),
    maximumStock: z.number().int().min(0).max(100000),
  })
  .refine((p) => p.maximumStock === 0 || p.maximumStock >= p.minimumStock, {
    message: 'O stock máximo não pode ser inferior ao mínimo.',
    path: ['maximumStock'],
  });
export type Product = z.infer<typeof productSchema>;
export const batchSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  productId: z.string(),
  code: z.string().trim().min(1).max(40),
  /** Nulo em artigos sem prazo, como equipamentos. */
  expiry: z.string().nullable(),
  quantity: z.number().int().min(0).max(1000000),
  supplierId: z.string().nullable(),
  receivedAt: z.string(),
});
export type Batch = z.infer<typeof batchSchema>;
export const movementSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  productId: z.string(),
  batchId: z.string().nullable(),
  type: z.enum(movementTypes),
  /** Sempre positiva; o tipo indica o sentido. Num ajuste, é a diferença aplicada. */
  quantity: z.number().int(),
  balance: z.number().int().min(0),
  at: z.string(),
  author: z.string(),
  reason: z.string().max(500),
  destination: z.string().max(160),
  patientId: z.string().nullable(),
  prescriptionItemId: z.string().nullable(),
});
export type Movement = z.infer<typeof movementSchema>;
export const serviceCategories = [
  'Consulta',
  'Exame',
  'Internamento',
  'Procedimento',
  'Outro',
] as const;
export const paymentMethods = ['Numerário', 'Multicaixa', 'Transferência'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const serviceSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  code: z.string().trim().min(2, 'Indique o código do serviço.').max(20),
  name: z.string().trim().min(2, 'Indique a designação do serviço.').max(120),
  category: z.enum(serviceCategories),
  /** Preço em kwanzas inteiros. */
  price: z.number().int().min(0).max(100000000),
});
export type Service = z.infer<typeof serviceSchema>;
export const insurerSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string().trim().min(2, 'Indique o convénio ou seguradora.').max(120),
  coverage: z.number().int().min(0).max(100),
  contact: z.string().trim().max(160),
});
export type Insurer = z.infer<typeof insurerSchema>;
export const invoiceSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  number: z.string(),
  patientId: z.string(),
  episodeId: z.string().nullable(),
  insurerId: z.string().nullable(),
  issuedAt: z.string(),
  issuedBy: z.string(),
  lines: z
    .array(
      z.object({
        id: z.string(),
        serviceId: z.string(),
        description: z.string(),
        quantity: z.number().int().min(1).max(1000),
        unitPrice: z.number().int().min(0),
        total: z.number().int().min(0),
      }),
    )
    .min(1, 'A factura tem de ter pelo menos um serviço.'),
  subtotal: z.number().int().min(0),
  covered: z.number().int().min(0),
  due: z.number().int().min(0),
  status: z.enum(['Emitida', 'Parcialmente paga', 'Paga', 'Anulada']),
  payments: z.array(
    z.object({
      id: z.string(),
      receipt: z.string(),
      at: z.string(),
      author: z.string(),
      amount: z.number().int().min(1),
      method: z.enum(paymentMethods),
    }),
  ),
  cancellation: z
    .object({ at: z.string(), author: z.string(), reason: z.string().trim().min(3) })
    .nullable(),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const cashEntrySchema = z.object({
  id: z.string(),
  unitId: z.string(),
  at: z.string(),
  author: z.string(),
  type: z.enum(['Receita', 'Despesa']),
  category: z.string().trim().min(2).max(60),
  description: z.string().trim().min(3, 'Descreva o movimento de caixa.').max(200),
  amount: z.number().int().min(1, 'O valor tem de ser positivo.').max(100000000),
  method: z.enum(paymentMethods),
  invoiceId: z.string().nullable(),
});
export type CashEntry = z.infer<typeof cashEntrySchema>;
export const staffRoles = [
  'Médico',
  'Enfermeiro',
  'Técnico de diagnóstico',
  'Farmacêutico',
  'Recepcionista',
  'Administrativo',
  'Auxiliar',
] as const;
export const absenceTypes = ['Férias', 'Licença', 'Formação'] as const;
export const attendanceStatuses = ['Presente', 'Falta', 'Falta justificada'] as const;
export const staffSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  number: z.string(),
  name: z.string().trim().min(3, 'Indique o nome do colaborador.').max(120),
  role: z.enum(staffRoles),
  department: z.string().trim().min(2, 'Indique o departamento.').max(80),
  phone: z.string().trim().max(30),
  hiredAt: z.string(),
  active: z.boolean(),
});
export type Staff = z.infer<typeof staffSchema>;
export const shiftSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  staffId: z.string(),
  date: z.string(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  department: z.string().trim().min(2).max(80),
});
export type Shift = z.infer<typeof shiftSchema>;
export const attendanceSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  staffId: z.string(),
  date: z.string(),
  status: z.enum(attendanceStatuses),
  note: z.string().max(200),
  recordedBy: z.string(),
  recordedAt: z.string(),
});
export type Attendance = z.infer<typeof attendanceSchema>;
export const absenceSchema = z
  .object({
    id: z.string(),
    unitId: z.string(),
    staffId: z.string(),
    type: z.enum(absenceTypes),
    start: z.string(),
    end: z.string(),
    note: z.string().max(200),
  })
  .refine((a) => a.end >= a.start, {
    message: 'A data de fim não pode ser anterior ao início.',
    path: ['end'],
  });
export type Absence = z.infer<typeof absenceSchema>;
export const userSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  name: z.string().trim().min(3, 'Indique o nome do utilizador.').max(120),
  username: z
    .string()
    .trim()
    .min(3, 'O nome de utilizador precisa de pelo menos 3 caracteres.')
    .max(40)
    .regex(/^[a-z0-9.]+$/, 'Use apenas minúsculas, números e pontos.'),
  role: z.enum(roles),
  staffId: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  /** Marca uma recuperação de acesso simulada; não existe palavra-passe nesta demo. */
  resetRequestedAt: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;
export const accessSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  at: z.string(),
  actor: z.string(),
  role: z.enum(roles),
  area: z.string(),
  subject: z.string(),
});
export type AccessRecord = z.infer<typeof accessSchema>;
/** Resumos agregados de outras unidades. Não contêm processos individuais. */
export const networkUnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  municipality: z.string(),
  province: z.string(),
  consultations: z.number().int().min(0),
  emergencies: z.number().int().min(0),
  admissions: z.number().int().min(0),
  discharges: z.number().int().min(0),
  deaths: z.number().int().min(0),
  births: z.number().int().min(0),
  surgeries: z.number().int().min(0),
  exams: z.number().int().min(0),
  beds: z.number().int().min(0),
  occupiedBeds: z.number().int().min(0),
});
export type NetworkUnit = z.infer<typeof networkUnitSchema>;
export const outboxStates = ['Pendente', 'Em envio', 'Confirmado', 'Erro', 'Conflito'] as const;
export type OutboxState = (typeof outboxStates)[number];
/**
 * Cada operação que altera dados deixa aqui um registo com identificador único,
 * revisão, utilizador, dispositivo e instante — a base da sincronização.
 */
export const outboxSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  at: z.string(),
  user: z.string(),
  role: z.enum(roles),
  device: z.string(),
  revision: z.number().int().nonnegative(),
  action: z.string(),
  entityId: z.string(),
  detail: z.string(),
  state: z.enum(outboxStates),
  attempts: z.number().int().min(0),
  message: z.string().max(300),
  settledAt: z.string().nullable(),
});
export type OutboxEntry = z.infer<typeof outboxSchema>;
export const databaseSchema = z.object({
  version: z.literal(8),
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
  exams: z.array(examSchema),
  wards: z.array(wardSchema),
  beds: z.array(bedSchema),
  admissions: z.array(admissionSchema),
  suppliers: z.array(supplierSchema),
  products: z.array(productSchema),
  batches: z.array(batchSchema),
  movements: z.array(movementSchema),
  services: z.array(serviceSchema),
  insurers: z.array(insurerSchema),
  invoices: z.array(invoiceSchema),
  cash: z.array(cashEntrySchema),
  staff: z.array(staffSchema),
  shifts: z.array(shiftSchema),
  attendance: z.array(attendanceSchema),
  absences: z.array(absenceSchema),
  users: z.array(userSchema),
  access: z.array(accessSchema),
  network: z.array(networkUnitSchema),
  /** Identificador do dispositivo onde a demo foi aberta pela primeira vez. */
  device: z.object({ id: z.string(), name: z.string() }),
  outbox: z.array(outboxSchema),
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
export const canDiagnostics = (session: Session) =>
  ['Administrador', 'Técnico'].includes(session.role);
export const canManageUsers = (session: Session) => session.role === 'Administrador';
/** Facturação, caixa e recursos humanos partilham o perfil administrativo. */
export const canAdministration = (session: Session) =>
  ['Administrador', 'Administrativo'].includes(session.role);
export const canPharmacy = (session: Session) =>
  ['Administrador', 'Farmacêutico'].includes(session.role);
/** Enfermaria: enfermeiros e médicos registam cuidados; a admissão continua a ser um acto médico. */
export const canWard = (session: Session) =>
  ['Administrador', 'Enfermeiro', 'Médico'].includes(session.role);
