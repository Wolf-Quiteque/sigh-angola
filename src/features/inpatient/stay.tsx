'use client';
import { useState } from 'react';
import {
  ArrowLeftRight,
  BedDouble,
  ClipboardPlus,
  LogOut,
  NotebookPen,
  Stethoscope,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  canConsult,
  canWard,
  dischargeOutcomes,
  stayEventTypes,
  stayNoteTypes,
  type Admission,
} from '@/domain/schema';
import type { Command } from '@/domain/commands';
import { ActionForm, Empty, Field, Modal, Panel, Status } from '@/components/ui';
import { formatDate } from '@/lib/format';

export type StayAction = 'note' | 'transfer' | 'event' | 'discharge';
export const stayActionLabel: Record<StayAction, string> = {
  note: 'Registar cuidados',
  transfer: 'Transferir de cama',
  event: 'Registar ocorrência',
  discharge: 'Dar alta',
};

/** Dias decorridos desde a admissão, para a permanência apresentada nas listas. */
export function stayDays(admission: Admission) {
  const end = admission.discharge ? new Date(admission.discharge.at) : new Date();
  return Math.max(
    1,
    Math.round((end.getTime() - new Date(admission.admittedAt).getTime()) / 86400000),
  );
}

export function StayActions({
  admission,
  onPick,
}: {
  admission: Admission;
  onPick: (action: StayAction) => void;
}) {
  const { session } = useDemo();
  if (admission.status !== 'Internado') return null;
  const buttons: Array<[StayAction, boolean, React.ReactNode]> = [
    ['note', canWard(session), <NotebookPen key="n" size={15} />],
    ['transfer', canWard(session), <ArrowLeftRight key="t" size={15} />],
    ['event', canWard(session), <ClipboardPlus key="e" size={15} />],
    ['discharge', canConsult(session), <LogOut key="d" size={15} />],
  ];
  return (
    <div className="table-actions wrap">
      {buttons.map(([action, allowed, icon]) => (
        <button
          key={action}
          type="button"
          className={action === 'discharge' ? 'button small primary' : 'button small secondary'}
          disabled={!allowed}
          onClick={() => onPick(action)}
        >
          {icon}
          {stayActionLabel[action]}
        </button>
      ))}
    </div>
  );
}

export function StayPanel({ episodeId }: { episodeId: string }) {
  const { db } = useDemo();
  const [action, setAction] = useState<StayAction | null>(null);
  if (!db) return null;
  const admission = db.admissions.find((a) => a.episodeId === episodeId);
  if (!admission) return null;
  const ward = db.wards.find((w) => w.id === admission.wardId);
  const bed = db.beds.find((b) => b.id === admission.bedId);
  const responsible = db.professionals.find((p) => p.id === admission.responsibleId);
  const timeline = [
    ...admission.notes.map((n) => ({ ...n, label: n.type, text: n.text })),
    ...admission.events.map((e) => ({ ...e, label: e.type, text: e.description })),
    ...admission.transfers.map((t) => ({
      ...t,
      label: 'Transferência',
      text:
        (db.beds.find((b) => b.id === t.fromBedId)?.code ?? '') +
        ' → ' +
        (db.beds.find((b) => b.id === t.toBedId)?.code ?? '') +
        ' · ' +
        t.reason,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Panel
      title="Internamento"
      subtitle={
        (ward?.name ?? 'Enfermaria') +
        ' · cama ' +
        (bed?.code ?? '—') +
        ' · ' +
        stayDays(admission) +
        ' dia(s)'
      }
      action={<Status value={admission.status} />}
    >
      <dl className="vital-list">
        <div>
          <dt>Admissão</dt>
          <dd>{formatDate(admission.admittedAt, true)}</dd>
        </div>
        <div>
          <dt>Médico responsável</dt>
          <dd>{responsible?.name ?? '—'}</dd>
        </div>
        <div>
          <dt>Motivo</dt>
          <dd>{admission.reason}</dd>
        </div>
      </dl>
      {admission.discharge && (
        <div className="exam-result final">
          <strong>{admission.discharge.outcome}</strong>
          {admission.discharge.destination && <p>Destino: {admission.discharge.destination}</p>}
          {admission.discharge.notes && <p>{admission.discharge.notes}</p>}
          <small>
            {admission.discharge.author} · {formatDate(admission.discharge.at, true)}
          </small>
        </div>
      )}
      <div className="prescription-heading">
        <div>
          <h3>Evolução e cuidados</h3>
          <p>{timeline.length} registo(s) desta permanência.</p>
        </div>
      </div>
      {timeline.length ? (
        <div className="timeline">
          {timeline.map((item) => (
            <div className="timeline-item" key={item.id}>
              <span className="timeline-dot" />
              <div>
                <div className="timeline-heading">
                  <strong>{item.label}</strong>
                </div>
                <p>{item.text}</p>
                <small>
                  {item.author} · {formatDate(item.at, true)}
                </small>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Sem registos de enfermaria"
          description="A evolução, os procedimentos e a medicação administrada aparecem aqui."
        />
      )}
      <StayActions admission={admission} onPick={setAction} />
      {action && (
        <StayActionForm admission={admission} action={action} onClose={() => setAction(null)} />
      )}
    </Panel>
  );
}

export function StayActionForm({
  admission,
  action,
  onClose,
}: {
  admission: Admission;
  action: StayAction;
  onClose: () => void;
}) {
  const { db, run } = useDemo();
  const patient = db?.patients.find((p) => p.id === admission.patientId);
  const freeBeds = (db?.beds ?? []).filter((b) => b.status === 'Livre');
  const build = (data: FormData): Command => {
    const text = (key: string) => String(data.get(key) ?? '');
    switch (action) {
      case 'note':
        return {
          type: 'inpatient.note',
          admissionId: admission.id,
          noteType: text('noteType') as (typeof stayNoteTypes)[number],
          text: text('text'),
        };
      case 'transfer':
        return {
          type: 'inpatient.transfer',
          admissionId: admission.id,
          toBedId: text('toBedId'),
          reason: text('reason'),
        };
      case 'event':
        return {
          type: 'inpatient.event',
          admissionId: admission.id,
          eventType: text('eventType') as (typeof stayEventTypes)[number],
          description: text('description'),
        };
      case 'discharge':
        return {
          type: 'inpatient.discharge',
          admissionId: admission.id,
          outcome: text('outcome') as (typeof dischargeOutcomes)[number],
          destination: text('destination'),
          notes: text('notes'),
        };
    }
  };
  return (
    <Modal title={stayActionLabel[action]} description={patient?.name} onClose={onClose}>
      <ActionForm
        submitLabel={stayActionLabel[action]}
        onClose={onClose}
        onSubmit={async (data) => run(build(data))}
      >
        <div className="form-grid">
          {action === 'note' && (
            <>
              <Field label="Tipo de registo *" wide>
                <select name="noteType" defaultValue="Evolução">
                  {stayNoteTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Registo *" wide>
                <textarea autoFocus name="text" required minLength={3} maxLength={2000} />
              </Field>
            </>
          )}
          {action === 'transfer' && (
            <>
              <Field label="Cama de destino *" wide>
                <select name="toBedId" required autoFocus>
                  {freeBeds.length === 0 && <option value="">Sem camas livres</option>}
                  {freeBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {db?.wards.find((w) => w.id === b.wardId)?.name} · {b.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Motivo da transferência *" wide>
                <textarea name="reason" required minLength={3} maxLength={500} />
              </Field>
            </>
          )}
          {action === 'event' && (
            <>
              <Field label="Ocorrência *" wide>
                <select name="eventType" defaultValue="Cirurgia">
                  {stayEventTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Descrição *" wide>
                <textarea autoFocus name="description" required minLength={3} maxLength={1000} />
              </Field>
            </>
          )}
          {action === 'discharge' && (
            <>
              <Field label="Tipo de alta *" wide>
                <select name="outcome" defaultValue="Alta clínica">
                  {dischargeOutcomes.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unidade de destino (referência)" wide>
                <input
                  name="destination"
                  maxLength={160}
                  placeholder="Obrigatório em transferência"
                />
              </Field>
              <Field label="Nota de alta / contrarreferência" wide>
                <textarea autoFocus name="notes" maxLength={2000} />
              </Field>
            </>
          )}
        </div>
        {action === 'transfer' && (
          <div className="clinical-warning">
            <BedDouble size={15} /> A cama de origem é libertada e a de destino ocupada na mesma
            operação.
          </div>
        )}
        {action === 'discharge' && (
          <div className="clinical-warning">
            <Stethoscope size={15} /> A alta liberta a cama, encerra o episódio e passa a constar do
            histórico do paciente.
          </div>
        )}
      </ActionForm>
    </Modal>
  );
}

export function StayHistory({ patientId }: { patientId: string }) {
  const { db } = useDemo();
  if (!db) return null;
  const stays = db.admissions
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => b.admittedAt.localeCompare(a.admittedAt));
  return (
    <Panel title="Internamentos" subtitle="Permanências em enfermaria e respectivas altas.">
      {stays.length ? (
        <div className="exam-list">
          {stays.map((stay) => (
            <article className="exam-card" key={stay.id}>
              <header>
                <div>
                  <strong>
                    {db.wards.find((w) => w.id === stay.wardId)?.name} ·{' '}
                    {db.beds.find((b) => b.id === stay.bedId)?.code}
                  </strong>
                  <small>
                    {formatDate(stay.admittedAt, true)} · {stayDays(stay)} dia(s) ·{' '}
                    {db.professionals.find((p) => p.id === stay.responsibleId)?.name}
                  </small>
                </div>
                <Status value={stay.status} />
              </header>
              <p className="exam-note">{stay.reason}</p>
              {stay.discharge && (
                <div className="exam-result final">
                  <strong>{stay.discharge.outcome}</strong>
                  {stay.discharge.destination && <p>Destino: {stay.discharge.destination}</p>}
                  {stay.discharge.notes && <p>{stay.discharge.notes}</p>}
                  <small>
                    {stay.discharge.author} · {formatDate(stay.discharge.at, true)}
                  </small>
                </div>
              )}
              <p className="exam-note">
                {stay.notes.length} registo(s) de cuidados · {stay.transfers.length}{' '}
                transferência(s)
                {stay.events.length ? ' · ' + stay.events.map((e) => e.type).join(', ') : ''}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Sem internamentos"
          description="As permanências em enfermaria aparecem nesta ficha."
        />
      )}
    </Panel>
  );
}
