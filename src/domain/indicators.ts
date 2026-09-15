import type { Database } from './schema';
import { localDate } from '@/lib/format';

export type Range = { start: string; end: string };
export type Indicator = {
  key: string;
  label: string;
  value: number;
  /** O que foi contado e sobre que denominador, para o número poder ser auditado. */
  definition: string;
  suffix?: string;
  decimals?: number;
};

const within = (range: Range, date: string) => date >= range.start && date <= range.end;
const day = (iso: string) => localDate(iso);
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : (numerator / denominator) * 100;

/**
 * Todos os indicadores saem dos mesmos registos que a demo mostra nos ecrãs.
 * Nada é estimado: cada valor conta ocorrências dentro do intervalo indicado.
 */
export function computeIndicators(db: Database, range: Range): Indicator[] {
  const consultations = db.consultations.filter((c) => within(range, day(c.startedAt)));
  const completed = consultations.filter((c) => c.status === 'Concluída');
  const episodes = db.episodes.filter((e) => within(range, day(e.arrivedAt)));
  const emergencies = episodes.filter((e) => e.appointmentId === null);
  const admissions = db.admissions.filter((a) => within(range, day(a.admittedAt)));
  const discharges = db.admissions.filter((a) => a.discharge && within(range, day(a.discharge.at)));
  const deaths = discharges.filter((a) => a.discharge!.outcome === 'Óbito');
  const referrals = discharges.filter(
    (a) => a.discharge!.outcome === 'Transferência para outra unidade',
  );
  const counterReferrals = discharges.filter(
    (a) => a.discharge!.outcome !== 'Óbito' && a.discharge!.notes.trim().length > 0,
  );
  const events = db.admissions.flatMap((a) => a.events.filter((e) => within(range, day(e.at))));
  const transfers = db.admissions.flatMap((a) =>
    a.transfers.filter((t) => within(range, day(t.at))),
  );
  const exams = db.exams.filter((e) => within(range, day(e.requestedAt)));
  const validatedExams = exams.filter((e) => e.status === 'Validado');
  const dispensations = db.movements.filter(
    (m) => m.type === 'Dispensação' && within(range, day(m.at)),
  );
  const operationalBeds = db.beds.filter((b) => ['Livre', 'Ocupada'].includes(b.status));
  const occupied = db.beds.filter((b) => b.status === 'Ocupada');
  const stays = discharges.map((a) =>
    Math.max(
      1,
      Math.round(
        (new Date(a.discharge!.at).getTime() - new Date(a.admittedAt).getTime()) / 86400000,
      ),
    ),
  );
  const averageStay = stays.length ? stays.reduce((s, d) => s + d, 0) / stays.length : 0;
  return [
    {
      key: 'consultations',
      label: 'Consultas realizadas',
      value: consultations.length,
      definition: 'Consultas iniciadas no intervalo, concluídas ou em curso.',
    },
    {
      key: 'completed',
      label: 'Consultas concluídas',
      value: completed.length,
      definition: 'Consultas com registo final no intervalo.',
    },
    {
      key: 'emergencies',
      label: 'Atendimentos sem marcação',
      value: emergencies.length,
      definition: `Episódios sem marcação prévia, em ${episodes.length} episódio(s) do intervalo.`,
    },
    {
      key: 'admissions',
      label: 'Internamentos',
      value: admissions.length,
      definition: 'Internamentos abertos no intervalo.',
    },
    {
      key: 'discharges',
      label: 'Altas',
      value: discharges.length,
      definition: 'Internamentos encerrados no intervalo, de qualquer tipo.',
    },
    {
      key: 'deaths',
      label: 'Óbitos',
      value: deaths.length,
      definition: 'Altas com desfecho «Óbito» no intervalo.',
    },
    {
      key: 'mortality',
      label: 'Taxa de mortalidade',
      value: ratio(deaths.length, discharges.length),
      definition: `Óbitos sobre ${discharges.length} alta(s) do intervalo.`,
      suffix: '%',
      decimals: 1,
    },
    {
      key: 'occupancy',
      label: 'Taxa de ocupação',
      value: ratio(occupied.length, operationalBeds.length),
      definition: `Camas ocupadas agora sobre ${operationalBeds.length} cama(s) operacional(is); bloqueadas e em manutenção excluídas.`,
      suffix: '%',
      decimals: 1,
    },
    {
      key: 'stay',
      label: 'Média de permanência',
      value: averageStay,
      definition: `Dias entre admissão e alta, em ${stays.length} alta(s) do intervalo.`,
      suffix: ' dias',
      decimals: 1,
    },
    {
      key: 'births',
      label: 'Partos',
      value: events.filter((e) => e.type === 'Parto').length,
      definition: 'Ocorrências de parto registadas em internamento no intervalo.',
    },
    {
      key: 'surgeries',
      label: 'Cirurgias',
      value: events.filter((e) => e.type === 'Cirurgia').length,
      definition: 'Ocorrências de cirurgia registadas em internamento no intervalo.',
    },
    {
      key: 'exams',
      label: 'Exames pedidos',
      value: exams.length,
      definition: 'Pedidos de laboratório e imagiologia criados no intervalo.',
    },
    {
      key: 'validated',
      label: 'Exames validados',
      value: validatedExams.length,
      definition: `Pedidos com resultado validado, em ${exams.length} pedido(s) do intervalo.`,
    },
    {
      key: 'dispensations',
      label: 'Unidades dispensadas',
      value: dispensations.reduce((sum, m) => sum + m.quantity, 0),
      definition: `Consumo de medicamentos em ${dispensations.length} dispensação(ões) do intervalo.`,
    },
    {
      key: 'transfers',
      label: 'Transferências internas',
      value: transfers.length,
      definition: 'Mudanças de cama registadas no intervalo.',
    },
    {
      key: 'referrals',
      label: 'Referências',
      value: referrals.length,
      definition: 'Altas com destino a outra unidade no intervalo.',
    },
    {
      key: 'counterReferrals',
      label: 'Contrarreferências',
      value: counterReferrals.length,
      definition: 'Altas com nota de alta escrita, excluindo óbitos.',
    },
  ];
}

export function consultationsBySpecialty(db: Database, range: Range) {
  const counts = new Map<string, number>();
  for (const consultation of db.consultations) {
    if (!within(range, day(consultation.startedAt))) continue;
    const specialty =
      db.professionals.find((p) => p.id === consultation.professionalId)?.specialty ??
      'Não indicada';
    counts.set(specialty, (counts.get(specialty) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([specialty, count]) => ({ specialty, count }))
    .sort((a, b) => b.count - a.count || a.specialty.localeCompare(b.specialty, 'pt'));
}

export function patientsByMunicipality(db: Database) {
  const counts = new Map<string, number>();
  for (const patient of db.patients)
    counts.set(patient.municipality, (counts.get(patient.municipality) ?? 0) + 1);
  return [...counts.entries()]
    .map(([municipality, count]) => ({ municipality, count }))
    .sort((a, b) => b.count - a.count || a.municipality.localeCompare(b.municipality, 'pt'));
}

/** Verificações de qualidade sobre os próprios registos, sem inventar correcções. */
export function dataQuality(db: Database, todayDate: string) {
  const olderThan = (iso: string, days: number) =>
    new Date(todayDate).getTime() - new Date(iso).getTime() > days * 86400000;
  return [
    {
      key: 'document',
      label: 'Pacientes sem bilhete de identidade',
      value: db.patients.filter((p) => !p.document).length,
      total: db.patients.length,
      hint: 'Dificulta a identificação única entre unidades.',
    },
    {
      key: 'phone',
      label: 'Pacientes sem telefone',
      value: db.patients.filter((p) => !p.phone).length,
      total: db.patients.length,
      hint: 'Impede o contacto para seguimento.',
    },
    {
      key: 'emergency',
      label: 'Pacientes sem contacto de emergência',
      value: db.patients.filter((p) => !p.emergencyContact).length,
      total: db.patients.length,
      hint: 'Necessário em situações críticas.',
    },
    {
      key: 'triage',
      label: 'Episódios activos sem triagem',
      value: db.episodes.filter((e) => e.status === 'Aguarda triagem' && olderThan(e.arrivedAt, 1))
        .length,
      total: db.episodes.filter((e) => e.status !== 'Concluído').length,
      hint: 'Chegadas com mais de um dia à espera de triagem.',
    },
    {
      key: 'exams',
      label: 'Exames por validar há mais de 3 dias',
      value: db.exams.filter(
        (e) => !['Validado', 'Cancelado'].includes(e.status) && olderThan(e.requestedAt, 3),
      ).length,
      total: db.exams.length,
      hint: 'Resultados pendentes atrasam decisões clínicas.',
    },
    {
      key: 'invoices',
      label: 'Facturas por cobrar há mais de 7 dias',
      value: db.invoices.filter(
        (i) =>
          i.status !== 'Anulada' &&
          i.due > i.payments.reduce((s, p) => s + p.amount, 0) &&
          olderThan(i.issuedAt, 7),
      ).length,
      total: db.invoices.length,
      hint: 'Valores em dívida a acompanhar pela tesouraria.',
    },
    {
      key: 'stock',
      label: 'Artigos abaixo do stock mínimo',
      value: db.products.filter(
        (p) =>
          db.batches.filter((b) => b.productId === p.id).reduce((s, b) => s + b.quantity, 0) <
          p.minimumStock,
      ).length,
      total: db.products.length,
      hint: 'Necessitam de reposição no armazém.',
    },
  ];
}
