'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BedDouble, BedSingle, Building2, Percent, Wrench } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { bedStatuses, canConsult, canWard, type Admission, type Bed } from '@/domain/schema';
import {
  ActionForm,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  PatientCell,
  Status,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { StayActionForm, StayActions, stayDays, type StayAction } from './stay';

export function InpatientBoard() {
  const { db, session } = useDemo();
  const [ward, setWard] = useState('');
  const [admit, setAdmit] = useState<string | null>(null);
  const [bed, setBed] = useState<Bed | null>(null);
  const [stay, setStay] = useState<{ admission: Admission; action: StayAction } | null>(null);
  if (!db) return null;
  const beds = db.beds.filter((b) => !ward || b.wardId === ward);
  const count = (status: string) => beds.filter((b) => b.status === status).length;
  const operational = beds.filter((b) => ['Livre', 'Ocupada'].includes(b.status)).length;
  const occupancy = operational ? Math.round((count('Ocupada') / operational) * 100) : 0;
  const waiting = db.episodes.filter((e) => e.status === 'Aguarda internamento');
  const stays = db.admissions
    .filter((a) => a.status === 'Internado')
    .filter((a) => !ward || a.wardId === ward)
    .sort((a, b) => a.admittedAt.localeCompare(b.admittedAt));
  return (
    <>
      <PageHeader
        eyebrow="INTERNAMENTO E ENFERMAGEM"
        title="Enfermarias e camas"
        description="Onde está cada paciente internado, em que cama e sob que responsabilidade."
      >
        <Badge tone="info">{occupancy}% de ocupação</Badge>
      </PageHeader>
      <div className="stat-grid">
        {[
          {
            label: 'Camas ocupadas',
            value: count('Ocupada'),
            hint: 'Pacientes internados',
            color: 'blue',
            icon: BedDouble,
          },
          {
            label: 'Camas livres',
            value: count('Livre'),
            hint: 'Disponíveis de imediato',
            color: 'green',
            icon: BedSingle,
          },
          {
            label: 'Bloqueadas ou em manutenção',
            value: count('Bloqueada') + count('Em manutenção'),
            hint: 'Fora do cálculo da ocupação',
            color: 'amber',
            icon: Wrench,
          },
          {
            label: 'Taxa de ocupação',
            value: occupancy,
            hint: `${count('Ocupada')} de ${operational} camas operacionais`,
            color: 'violet',
            icon: Percent,
            suffix: '%',
          },
        ].map(({ label, value, hint, color, icon: Icon, suffix }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-value">
              {suffix ? value : String(value).padStart(2, '0')}
              {suffix}
            </strong>
            <div className="stat-hint">{hint}</div>
          </div>
        ))}
      </div>
      <Panel
        title="Mapa de camas"
        subtitle="Estado de cada cama e distribuição por enfermaria."
        action={
          <label className="filter-select">
            <span>Enfermaria</span>
            <select value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="">Todas as enfermarias</option>
              {db.wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {db.wards
          .filter((w) => !ward || w.id === ward)
          .map((w) => {
            const wardBeds = db.beds.filter((b) => b.wardId === w.id);
            return (
              <div className="ward-block" key={w.id}>
                <div className="ward-heading">
                  <span className="quick-icon">
                    <Building2 size={19} />
                  </span>
                  <div>
                    <strong>{w.name}</strong>
                    <small>{w.service}</small>
                  </div>
                  <Badge>
                    {wardBeds.filter((b) => b.status === 'Ocupada').length}/{wardBeds.length}{' '}
                    ocupadas
                  </Badge>
                </div>
                <div className="bed-grid">
                  {wardBeds.map((b) => {
                    const admission = db.admissions.find(
                      (a) => a.bedId === b.id && a.status === 'Internado',
                    );
                    const patient = db.patients.find((p) => p.id === admission?.patientId);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className={`bed-chip ${b.status === 'Livre' ? 'free' : b.status === 'Ocupada' ? 'busy' : 'blocked'}`}
                        disabled={b.status === 'Ocupada' || !canWard(session)}
                        aria-label={`Cama ${b.code}: ${b.status}${patient ? ' por ' + patient.name : ''}`}
                        onClick={() => setBed(b)}
                      >
                        <span className="bed-code">
                          {b.status === 'Em manutenção' ? (
                            <Wrench size={14} />
                          ) : (
                            <BedSingle size={14} />
                          )}
                          {b.code}
                        </span>
                        <small>{patient ? patient.name : b.status}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </Panel>
      <Panel
        title="A aguardar cama"
        subtitle="Episódios encaminhados para internamento na consulta."
      >
        {waiting.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Serviço / motivo</th>
                  <th>Decisão clínica</th>
                  <th className="align-right">Acção</th>
                </tr>
              </thead>
              <tbody>
                {waiting.map((episode) => {
                  const patient = db.patients.find((p) => p.id === episode.patientId)!;
                  const consultation = db.consultations.find((c) => c.episodeId === episode.id);
                  return (
                    <tr key={episode.id}>
                      <td>
                        <PatientCell patient={patient} />
                      </td>
                      <td>
                        <strong className="table-primary">{episode.service}</strong>
                        <small className="muted">{episode.reason}</small>
                      </td>
                      <td>{consultation?.diagnosis || 'Sem diagnóstico registado'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="button small primary"
                            disabled={!canConsult(session)}
                            onClick={() => setAdmit(episode.id)}
                          >
                            <BedDouble size={15} />
                            Internar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Ninguém a aguardar cama"
            description="Uma consulta com destino «Internamento» coloca o paciente nesta lista."
          />
        )}
      </Panel>
      <Panel title="Pacientes internados" subtitle="Permanência, cama e médico responsável.">
        {stays.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Localização</th>
                  <th>Permanência</th>
                  <th>Responsável</th>
                  <th className="align-right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {stays.map((admission) => {
                  const patient = db.patients.find((p) => p.id === admission.patientId)!;
                  return (
                    <tr key={admission.id}>
                      <td>
                        <PatientCell patient={patient} />
                      </td>
                      <td>
                        <strong className="table-primary">
                          {db.beds.find((b) => b.id === admission.bedId)?.code}
                        </strong>
                        <small className="muted">
                          {db.wards.find((w) => w.id === admission.wardId)?.name}
                        </small>
                      </td>
                      <td>
                        <strong className="table-primary">{stayDays(admission)} dia(s)</strong>
                        <small className="muted">
                          Desde {formatDate(admission.admittedAt, true)}
                        </small>
                      </td>
                      <td>
                        <strong className="table-primary">
                          {db.professionals.find((p) => p.id === admission.responsibleId)?.name}
                        </strong>
                        <small className="muted">{admission.notes.length} registo(s)</small>
                      </td>
                      <td>
                        <div className="stay-cell">
                          <StayActions
                            admission={admission}
                            onPick={(action) => setStay({ admission, action })}
                          />
                          <Link
                            className="icon-button"
                            href={'/clinica/' + admission.episodeId}
                            aria-label={'Abrir o processo clínico de ' + patient.name}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Sem pacientes internados"
            description="As admissões em enfermaria aparecem nesta lista."
          />
        )}
      </Panel>
      {!canWard(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Enfermeiro para registar cuidados ou Médico para internar e dar alta.
        </div>
      )}
      {admit && <AdmitForm episodeId={admit} onClose={() => setAdmit(null)} />}
      {bed && <BedForm bed={bed} onClose={() => setBed(null)} />}
      {stay && (
        <StayActionForm
          admission={stay.admission}
          action={stay.action}
          onClose={() => setStay(null)}
        />
      )}
    </>
  );
}

function AdmitForm({ episodeId, onClose }: { episodeId: string; onClose: () => void }) {
  const { db, run } = useDemo();
  const episode = db?.episodes.find((e) => e.id === episodeId);
  const patient = db?.patients.find((p) => p.id === episode?.patientId);
  const consultation = db?.consultations.find((c) => c.episodeId === episodeId);
  const free = (db?.beds ?? []).filter((b) => b.status === 'Livre');
  return (
    <Modal
      title="Abrir internamento"
      description={patient ? patient.name + ' · ' + patient.number : undefined}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Internar"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'inpatient.admit',
            episodeId,
            bedId: String(data.get('bedId') ?? ''),
            responsibleId: String(data.get('responsibleId') ?? ''),
            reason: String(data.get('reason') ?? ''),
            diagnosis: String(data.get('diagnosis') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Cama *" wide>
            <select name="bedId" required autoFocus>
              {free.length === 0 && <option value="">Sem camas livres</option>}
              {free.map((b) => (
                <option key={b.id} value={b.id}>
                  {db?.wards.find((w) => w.id === b.wardId)?.name} · {b.code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Médico responsável *" wide>
            <select name="responsibleId" required defaultValue={consultation?.professionalId}>
              {db?.professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.specialty}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Motivo do internamento *" wide>
            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={500}
              defaultValue={episode?.reason}
            />
          </Field>
          <Field label="Diagnóstico de admissão" wide>
            <textarea name="diagnosis" maxLength={500} defaultValue={consultation?.diagnosis} />
          </Field>
        </div>
        {free.length === 0 && (
          <div className="clinical-warning">
            Não há camas livres. Liberte uma cama bloqueada ou aguarde uma alta.
          </div>
        )}
      </ActionForm>
    </Modal>
  );
}

function BedForm({ bed, onClose }: { bed: Bed; onClose: () => void }) {
  const { db, run } = useDemo();
  const options = bedStatuses.filter((s) => s !== 'Ocupada' && s !== bed.status);
  return (
    <Modal
      title="Estado da cama"
      description={
        (db?.wards.find((w) => w.id === bed.wardId)?.name ?? '') +
        ' · ' +
        bed.code +
        ' · ' +
        bed.status
      }
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Actualizar cama"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'bed.status',
            bedId: bed.id,
            status: String(data.get('status')) as 'Livre' | 'Bloqueada' | 'Em manutenção',
            note: String(data.get('note') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Novo estado *" wide>
            <select name="status" autoFocus defaultValue={options[0]}>
              {options.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Motivo (obrigatório para bloquear ou manutenção)" wide>
            <textarea name="note" maxLength={200} defaultValue={bed.note} />
          </Field>
        </div>
        <div className="info-line">
          <Status value={bed.status} />
          <span>Camas bloqueadas e em manutenção ficam fora do cálculo da ocupação.</span>
        </div>
      </ActionForm>
    </Modal>
  );
}
