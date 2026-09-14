'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ClipboardCheck,
  HeartPulse,
  Plus,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { age, formatDate, formatTime } from '@/lib/format';
import {
  canConsult,
  canTriage,
  type Consultation,
  type Episode,
  type PrescriptionItem,
} from '@/domain/schema';
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
import { EpisodeExams } from '@/features/diagnostics/episode-exams';
import { StayPanel } from '@/features/inpatient/stay';

const numberValue = (data: FormData, key: string) => Number(data.get(key));
const nullableNumber = (data: FormData, key: string) => {
  const value = String(data.get(key) ?? '').trim();
  return value ? Number(value) : null;
};
const priorityTone: Record<string, string> = {
  Vermelho: 'danger',
  Laranja: 'orange',
  Amarelo: 'warning',
  Verde: 'success',
  Azul: 'info',
};

export function ClinicalBoard({ mode }: { mode: 'triage' | 'consultation' }) {
  const { db, session } = useDemo();
  const [selected, setSelected] = useState<Episode | null>(null);
  if (!db) return null;
  const triageQueue = db.episodes
    .filter((e) => e.status === 'Aguarda triagem')
    .sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt));
  const consultQueue = db.episodes
    .filter((e) => ['Aguarda consulta', 'Em consulta'].includes(e.status))
    .sort((a, b) => {
      const order = ['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul'];
      const ap = db.triages.find((t) => t.episodeId === a.id)?.priority ?? 'Azul';
      const bp = db.triages.find((t) => t.episodeId === b.id)?.priority ?? 'Azul';
      return order.indexOf(ap) - order.indexOf(bp) || a.arrivedAt.localeCompare(b.arrivedAt);
    });
  const queue = mode === 'triage' ? triageQueue : consultQueue;
  return (
    <>
      <PageHeader
        eyebrow="ÁREA CLÍNICA"
        title={mode === 'triage' ? 'Triagem' : 'Consultas médicas'}
        description={
          mode === 'triage'
            ? 'Registe sinais vitais e a prioridade atribuída pelo profissional.'
            : 'Atenda a fila priorizada e mantenha o processo clínico actualizado.'
        }
      >
        <Badge tone={mode === 'triage' ? 'warning' : 'info'}>{queue.length} a aguardar</Badge>
      </PageHeader>
      <div className="clinical-summary">
        <div>
          <HeartPulse size={20} />
          <span>
            <strong>{triageQueue.length}</strong>Aguardam triagem
          </span>
        </div>
        <div>
          <Stethoscope size={20} />
          <span>
            <strong>{consultQueue.filter((e) => e.status === 'Aguarda consulta').length}</strong>
            Aguardam consulta
          </span>
        </div>
        <div>
          <Activity size={20} />
          <span>
            <strong>{consultQueue.filter((e) => e.status === 'Em consulta').length}</strong>Em
            consulta
          </span>
        </div>
      </div>
      <Panel
        title={mode === 'triage' ? 'Fila por ordem de chegada' : 'Fila por prioridade clínica'}
        subtitle={
          mode === 'triage'
            ? 'A prioridade é atribuída durante a triagem.'
            : 'Prioridade seguida da hora de chegada.'
        }
      >
        {queue.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{mode === 'triage' ? 'Chegada' : 'Prioridade'}</th>
                  <th>Paciente</th>
                  <th>Serviço / queixa</th>
                  <th>Estado</th>
                  <th className="align-right">Acção</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((episode) => {
                  const patient = db.patients.find((p) => p.id === episode.patientId)!;
                  const triage = db.triages.find((t) => t.episodeId === episode.id);
                  return (
                    <tr key={episode.id}>
                      <td>
                        {triage ? (
                          <Badge tone={priorityTone[triage.priority]}>{triage.priority}</Badge>
                        ) : (
                          <>
                            <strong className="time-cell">{formatTime(episode.arrivedAt)}</strong>
                            <small className="muted">{formatDate(episode.arrivedAt)}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <PatientCell patient={patient} />
                      </td>
                      <td>
                        <strong className="table-primary">{episode.service}</strong>
                        <small className="muted">{triage?.chiefComplaint ?? episode.reason}</small>
                      </td>
                      <td>
                        <Status value={episode.status} />
                      </td>
                      <td>
                        <div className="table-actions">
                          {mode === 'triage' ? (
                            <button
                              className="button small primary"
                              disabled={!canTriage(session)}
                              onClick={() => setSelected(episode)}
                            >
                              <HeartPulse size={15} />
                              Realizar triagem
                            </button>
                          ) : (
                            <Link className="button small primary" href={'/clinica/' + episode.id}>
                              <Stethoscope size={15} />
                              {episode.status === 'Em consulta' ? 'Continuar' : 'Abrir consulta'}
                            </Link>
                          )}
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
            title={
              mode === 'triage'
                ? 'Sem pacientes a aguardar triagem'
                : 'Sem pacientes na fila médica'
            }
            description="Os novos episódios aparecem aqui conforme avançam no atendimento."
          />
        )}
      </Panel>
      {mode === 'triage' && !canTriage(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Enfermeiro ou Administrador para realizar triagens.
        </div>
      )}
      {mode === 'consultation' && !canConsult(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Médico ou Administrador para iniciar e registar consultas.
        </div>
      )}
      {selected && <TriageForm episode={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function TriageForm({ episode, onClose }: { episode: Episode; onClose: () => void }) {
  const { db, run } = useDemo();
  const patient = db?.patients.find((p) => p.id === episode.patientId);
  return (
    <Modal
      title="Realizar triagem"
      description={patient ? patient.name + ' · ' + patient.number : undefined}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Concluir triagem"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'triage.save',
            episodeId: episode.id,
            chiefComplaint: String(data.get('chiefComplaint') ?? ''),
            priority: String(data.get('priority')) as
              'Vermelho' | 'Laranja' | 'Amarelo' | 'Verde' | 'Azul',
            temperature: numberValue(data, 'temperature'),
            systolic: numberValue(data, 'systolic'),
            diastolic: numberValue(data, 'diastolic'),
            heartRate: numberValue(data, 'heartRate'),
            respiratoryRate: numberValue(data, 'respiratoryRate'),
            oxygenSaturation: numberValue(data, 'oxygenSaturation'),
            weight: nullableNumber(data, 'weight'),
            height: nullableNumber(data, 'height'),
            notes: String(data.get('notes') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Queixa principal *" wide>
            <textarea
              autoFocus
              name="chiefComplaint"
              required
              minLength={3}
              defaultValue={episode.reason}
            />
          </Field>
          <Field label="Prioridade atribuída *" wide>
            <select name="priority" defaultValue="Amarelo">
              {['Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Temperatura (°C) *">
            <input
              name="temperature"
              type="number"
              step="0.1"
              min="25"
              max="45"
              required
              defaultValue="36.5"
            />
          </Field>
          <Field label="Saturação O₂ (%) *">
            <input
              name="oxygenSaturation"
              type="number"
              min="40"
              max="100"
              required
              defaultValue="98"
            />
          </Field>
          <Field label="Pressão sistólica *">
            <input name="systolic" type="number" min="40" max="300" required defaultValue="120" />
          </Field>
          <Field label="Pressão diastólica *">
            <input name="diastolic" type="number" min="20" max="200" required defaultValue="80" />
          </Field>
          <Field label="Frequência cardíaca *">
            <input name="heartRate" type="number" min="20" max="250" required defaultValue="75" />
          </Field>
          <Field label="Frequência respiratória *">
            <input
              name="respiratoryRate"
              type="number"
              min="5"
              max="80"
              required
              defaultValue="18"
            />
          </Field>
          <Field label="Peso (kg)">
            <input name="weight" type="number" step="0.1" min="0.1" max="500" />
          </Field>
          <Field label="Altura (cm)">
            <input name="height" type="number" step="0.1" min="1" max="250" />
          </Field>
          <Field label="Observações" wide>
            <textarea name="notes" maxLength={2000} />
          </Field>
        </div>
        <div className="clinical-warning">
          A prioridade é uma decisão do profissional. Esta demo não calcula nem recomenda uma
          classificação clínica.
        </div>
      </ActionForm>
    </Modal>
  );
}

type RxDraft = Omit<PrescriptionItem, 'id'> & { id?: string };
const blankRx = (): RxDraft => ({
  medication: '',
  dose: '',
  route: 'Oral',
  frequency: '',
  duration: '',
  notes: '',
});

export function ClinicalWorkspace({ episodeId }: { episodeId: string }) {
  const { db, session, run } = useDemo();
  const router = useRouter();
  const [professionalId, setProfessionalId] = useState('med-1');
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<
    'Alta ambulatória' | 'Observação' | 'Internamento' | 'Transferência'
  >('Alta ambulatória');
  const [amend, setAmend] = useState(false);
  const consultation = db?.consultations.find((c) => c.episodeId === episodeId);
  const [prescriptions, setPrescriptions] = useState<RxDraft[]>(consultation?.prescriptions ?? []);
  useEffect(() => {
    // Keep persisted prescriptions when this workspace is opened after a reload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrescriptions(consultation?.prescriptions ?? []);
  }, [consultation]);
  if (!db) return null;
  const episode = db.episodes.find((e) => e.id === episodeId);
  if (!episode)
    return (
      <Empty
        title="Episódio não encontrado"
        description="Este atendimento não existe no cenário actual."
      />
    );
  const patient = db.patients.find((p) => p.id === episode.patientId)!;
  const triage = db.triages.find((t) => t.episodeId === episode.id);
  const clinician = consultation
    ? db.professionals.find((p) => p.id === consultation.professionalId)
    : undefined;
  async function start() {
    setError('');
    try {
      await run({ type: 'consultation.start', episodeId, professionalId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível iniciar a consulta.');
    }
  }
  async function save(data: FormData) {
    if (!consultation) return;
    await run({
      type: 'consultation.save',
      consultationId: consultation.id,
      history: String(data.get('history') ?? ''),
      allergies: String(data.get('allergies') ?? ''),
      diagnosis: String(data.get('diagnosis') ?? ''),
      procedures: String(data.get('procedures') ?? ''),
      evolution: String(data.get('evolution') ?? ''),
      prescriptions,
    });
  }
  return (
    <>
      <Link href="/consultas" className="back-link">
        <ArrowLeft size={16} />
        Fila de consultas
      </Link>
      <PageHeader
        eyebrow="PROCESSO CLÍNICO"
        title={patient.name}
        description={patient.number + ' · ' + age(patient.birthDate) + ' anos · ' + episode.service}
      >
        <Status value={episode.status} />
      </PageHeader>
      <div className="clinical-layout">
        <aside className="clinical-aside">
          <Panel title="Identificação">
            <div className="clinical-patient">
              <UserRound size={24} />
              <div>
                <strong>{patient.name}</strong>
                <p>
                  {patient.sex} · {formatDate(patient.birthDate)}
                </p>
              </div>
            </div>
            <dl className="vital-list">
              <div>
                <dt>Chegada</dt>
                <dd>{formatTime(episode.arrivedAt)}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{episode.reason}</dd>
              </div>
              <div>
                <dt>Contacto</dt>
                <dd>{patient.phone || 'Não indicado'}</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Triagem">
            {triage ? (
              <>
                <div className="priority-block">
                  <span>Prioridade</span>
                  <Badge tone={priorityTone[triage.priority]}>{triage.priority}</Badge>
                </div>
                <div className="vital-grid">
                  {[
                    ['Temperatura', triage.temperature + ' °C'],
                    ['Pressão arterial', triage.systolic + '/' + triage.diastolic],
                    ['Frequência cardíaca', triage.heartRate + ' bpm'],
                    ['Respiração', triage.respiratoryRate + ' rpm'],
                    ['Saturação O₂', triage.oxygenSaturation + '%'],
                    [
                      'Peso / altura',
                      (triage.weight ?? '—') + ' kg · ' + (triage.height ?? '—') + ' cm',
                    ],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <span>{k}</span>
                      <strong>{v}</strong>
                    </div>
                  ))}
                </div>
                <div className="triage-note">
                  <strong>Queixa principal</strong>
                  <p>{triage.chiefComplaint}</p>
                  {triage.notes && <p>{triage.notes}</p>}
                  <small>
                    {triage.nurse} · {formatDate(triage.recordedAt, true)}
                  </small>
                </div>
              </>
            ) : (
              <Empty
                title="Triagem pendente"
                description="A consulta só pode ser iniciada depois da triagem."
              />
            )}
          </Panel>
        </aside>
        <div className="clinical-main">
          {!consultation && (
            <Panel
              title="Iniciar consulta"
              subtitle="Associe o médico responsável a este episódio."
            >
              <div className="start-consult">
                <Field label="Médico responsável">
                  <select
                    value={professionalId}
                    onChange={(e) => setProfessionalId(e.target.value)}
                  >
                    {db.professionals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.specialty}
                      </option>
                    ))}
                  </select>
                </Field>
                <button
                  className="button primary"
                  disabled={!canConsult(session) || !triage}
                  onClick={() => void start()}
                >
                  <Stethoscope size={17} />
                  Iniciar consulta
                </button>
              </div>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
            </Panel>
          )}
          {consultation?.status === 'Em curso' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                try {
                  await save(new FormData(e.currentTarget));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Não foi possível guardar.');
                }
              }}
            >
              <Panel
                title="Registo da consulta"
                subtitle={
                  (clinician?.name ?? 'Médico') +
                  ' · iniciada ' +
                  formatDate(consultation.startedAt, true)
                }
              >
                <div className="clinical-form">
                  <Field label="História clínica / antecedentes">
                    <textarea name="history" defaultValue={consultation.history} maxLength={3000} />
                  </Field>
                  <Field label="Alergias">
                    <textarea
                      name="allergies"
                      defaultValue={consultation.allergies}
                      maxLength={1000}
                      placeholder="Registar alergias conhecidas ou «Nega alergias»"
                    />
                  </Field>
                  <Field label="Diagnóstico *">
                    <textarea
                      name="diagnosis"
                      required
                      defaultValue={consultation.diagnosis}
                      maxLength={2000}
                    />
                  </Field>
                  <Field label="Procedimentos">
                    <textarea
                      name="procedures"
                      defaultValue={consultation.procedures}
                      maxLength={2000}
                    />
                  </Field>
                  <Field label="Evolução / plano *" wide>
                    <textarea
                      name="evolution"
                      required
                      defaultValue={consultation.evolution}
                      maxLength={3000}
                    />
                  </Field>
                </div>
                <div className="prescription-heading">
                  <div>
                    <h3>Prescrição electrónica</h3>
                    <p>Medicamentos associados a este episódio.</p>
                  </div>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => setPrescriptions([...prescriptions, blankRx()])}
                  >
                    <Plus size={15} />
                    Adicionar medicamento
                  </button>
                </div>
                {prescriptions.length === 0 ? (
                  <Empty
                    title="Sem medicamentos prescritos"
                    description="Adicione apenas quando fizer parte do plano terapêutico."
                  />
                ) : (
                  <div className="prescription-list">
                    {prescriptions.map((rx, index) => (
                      <div className="prescription-row" key={rx.id ?? index}>
                        <Field label="Medicamento *">
                          <input
                            value={rx.medication}
                            required
                            onChange={(e) =>
                              setPrescriptions(
                                prescriptions.map((p, i) =>
                                  i === index ? { ...p, medication: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Dose *">
                          <input
                            value={rx.dose}
                            required
                            placeholder="Ex.: 500 mg"
                            onChange={(e) =>
                              setPrescriptions(
                                prescriptions.map((p, i) =>
                                  i === index ? { ...p, dose: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Via *">
                          <select
                            value={rx.route}
                            onChange={(e) =>
                              setPrescriptions(
                                prescriptions.map((p, i) =>
                                  i === index ? { ...p, route: e.target.value } : p,
                                ),
                              )
                            }
                          >
                            {[
                              'Oral',
                              'Intravenosa',
                              'Intramuscular',
                              'Subcutânea',
                              'Tópica',
                              'Inalatória',
                            ].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Frequência *">
                          <input
                            value={rx.frequency}
                            required
                            placeholder="Ex.: 8/8 horas"
                            onChange={(e) =>
                              setPrescriptions(
                                prescriptions.map((p, i) =>
                                  i === index ? { ...p, frequency: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </Field>
                        <Field label="Duração *">
                          <input
                            value={rx.duration}
                            required
                            placeholder="Ex.: 5 dias"
                            onChange={(e) =>
                              setPrescriptions(
                                prescriptions.map((p, i) =>
                                  i === index ? { ...p, duration: e.target.value } : p,
                                ),
                              )
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="button small secondary"
                          onClick={() =>
                            setPrescriptions(prescriptions.filter((_, i) => i !== index))
                          }
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {error && (
                  <div className="form-error" role="alert">
                    {error}
                  </div>
                )}
                <div className="clinical-actions">
                  <button className="button secondary" type="submit">
                    Guardar rascunho
                  </button>
                  <div>
                    <select
                      aria-label="Destino após consulta"
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                    >
                      {['Alta ambulatória', 'Observação', 'Internamento', 'Transferência'].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                    <button
                      type="button"
                      className="button primary"
                      onClick={async () => {
                        setError('');
                        try {
                          await run({
                            type: 'consultation.complete',
                            consultationId: consultation.id,
                            outcome,
                          });
                          router.push('/consultas');
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
                        }
                      }}
                    >
                      <ClipboardCheck size={17} />
                      Concluir consulta
                    </button>
                  </div>
                </div>
              </Panel>
            </form>
          )}
          {consultation?.status === 'Concluída' && (
            <CompletedConsultation
              consultation={consultation}
              clinician={clinician?.name ?? 'Médico'}
              onAmend={() => setAmend(true)}
            />
          )}
          <StayPanel episodeId={episode.id} />
          {consultation && (
            <EpisodeExams
              episodeId={episode.id}
              consultationId={consultation.id}
              open={consultation.status === 'Em curso'}
            />
          )}
        </div>
      </div>
      {amend && consultation && (
        <AmendmentForm consultationId={consultation.id} onClose={() => setAmend(false)} />
      )}
    </>
  );
}

function CompletedConsultation({
  consultation,
  clinician,
  onAmend,
}: {
  consultation: Consultation;
  clinician: string;
  onAmend: () => void;
}) {
  return (
    <Panel
      title="Consulta concluída"
      subtitle={clinician + ' · ' + formatDate(consultation.completedAt!, true)}
      action={<Badge tone="success">{consultation.outcome}</Badge>}
    >
      <div className="clinical-record">
        {[
          ['História clínica', consultation.history || 'Não registada'],
          ['Alergias', consultation.allergies || 'Não registadas'],
          ['Diagnóstico', consultation.diagnosis],
          ['Procedimentos', consultation.procedures || 'Nenhum'],
          ['Evolução / plano', consultation.evolution],
        ].map(([k, v]) => (
          <section key={k}>
            <h3>{k}</h3>
            <p>{v}</p>
          </section>
        ))}
      </div>
      <div className="prescription-heading">
        <div>
          <h3>Prescrição</h3>
          <p>{consultation.prescriptions.length} medicamento(s).</p>
        </div>
      </div>
      <div className="rx-cards">
        {consultation.prescriptions.map((rx) => (
          <div key={rx.id}>
            <strong>
              {rx.medication} · {rx.dose}
            </strong>
            <p>
              {rx.route} · {rx.frequency} · {rx.duration}
            </p>
          </div>
        ))}
      </div>
      <div className="amendments">
        <div className="prescription-heading">
          <div>
            <h3>Adendas</h3>
            <p>Complementos preservam o registo finalizado.</p>
          </div>
          <button className="button secondary small" onClick={onAmend}>
            <Plus size={15} />
            Nova adenda
          </button>
        </div>
        {consultation.amendments.map((a) => (
          <div className="amendment" key={a.id}>
            <strong>{a.reason}</strong>
            <p>{a.text}</p>
            <small>
              {a.author} · {formatDate(a.at, true)}
            </small>
          </div>
        ))}
      </div>
    </Panel>
  );
}
function AmendmentForm({
  consultationId,
  onClose,
}: {
  consultationId: string;
  onClose: () => void;
}) {
  const { run } = useDemo();
  return (
    <Modal
      title="Adicionar adenda clínica"
      description="A consulta original permanece inalterada e esta adenda fica identificada."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar adenda"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'consultation.amend',
            consultationId,
            reason: String(data.get('reason') ?? ''),
            text: String(data.get('text') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Motivo da adenda *" wide>
            <input autoFocus name="reason" required minLength={3} />
          </Field>
          <Field label="Conteúdo *" wide>
            <textarea name="text" required minLength={3} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
