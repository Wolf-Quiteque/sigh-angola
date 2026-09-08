'use client';
import { useState } from 'react';
import { Plus, ListOrdered, Clock3 } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { canWrite } from '@/domain/schema';
import { PageHeader, Panel, SearchInput, PatientCell, Status, Empty, Badge } from '@/components/ui';
import { normalize, formatDate, formatTime } from '@/lib/format';
import { AdmissionForm } from './reception/forms';
export function Queue() {
  const { db, session } = useDemo();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(false);
  if (!db) return null;
  const episodes = db.episodes
    .filter(
      (e) =>
        e.status !== 'Concluído' &&
        normalize(db.patients.find((p) => p.id === e.patientId)?.name ?? '').includes(
          normalize(search),
        ),
    )
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  return (
    <>
      <PageHeader
        eyebrow="RECEPÇÃO"
        title="Fila de atendimento"
        description="Acompanhe as admissões e os pacientes que aguardam triagem."
      >
        {canWrite(session) && (
          <button className="button primary" onClick={() => setForm(true)}>
            <Plus size={18} />
            Admissão directa
          </button>
        )}
      </PageHeader>
      <div className="queue-banner">
        <div className="queue-banner-icon">
          <ListOrdered size={23} />
        </div>
        <div>
          <strong>
            {db.episodes.filter((e) => e.status !== 'Concluído').length} pacientes em atendimento
          </strong>
          <p>Lista por ordem de chegada. A prioridade clínica será atribuída na triagem.</p>
        </div>
        <Badge tone="warning">Aguarda triagem</Badge>
      </div>
      <Panel>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar paciente na fila"
          />
          <span className="muted inline-icon">
            <Clock3 size={15} />
            Ordem de chegada
          </span>
        </div>
        {episodes.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Chegada</th>
                  <th>Paciente</th>
                  <th>Serviço / motivo</th>
                  <th>Origem</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {episodes.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong className="time-cell">{formatTime(e.arrivedAt)}</strong>
                      <small className="muted">{formatDate(e.arrivedAt)}</small>
                    </td>
                    <td>
                      <PatientCell patient={db.patients.find((p) => p.id === e.patientId)!} />
                    </td>
                    <td>
                      <strong className="table-primary">{e.service}</strong>
                      <small className="muted">{e.reason}</small>
                    </td>
                    <td>{e.appointmentId ? 'Com marcação' : 'Admissão directa'}</td>
                    <td>
                      <Status value={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Não há pacientes nesta fila"
            description={
              search
                ? 'Experimente outro nome.'
                : 'As chegadas registadas na agenda e as admissões directas aparecem aqui.'
            }
          />
        )}
      </Panel>
      <div className="info-line spaced">
        <Badge tone="info">Fase 2</Badge>
        <span>
          Registo de sinais vitais, classificação de prioridade e encaminhamento para consulta estão
          previstos na próxima fase.
        </span>
      </div>
      {form && <AdmissionForm onClose={() => setForm(false)} />}
    </>
  );
}
