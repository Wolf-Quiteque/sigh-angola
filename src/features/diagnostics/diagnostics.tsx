'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Ban,
  CheckCheck,
  CalendarClock,
  FlaskConical,
  Microscope,
  Play,
  Scan,
  TestTube,
  FileText,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  canConsult,
  canDiagnostics,
  imagingFlow,
  labFlow,
  type Exam,
  type ExamCategory,
} from '@/domain/schema';
import type { Command } from '@/domain/commands';
import {
  ActionForm,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  PatientCell,
  SearchInput,
  Status,
} from '@/components/ui';
import { formatDate, normalize, today } from '@/lib/format';

/** Acção disponível em cada estado. Cada uma abre o formulário correspondente. */
type ActionKey = 'collect' | 'process' | 'schedule' | 'perform' | 'report' | 'validate' | 'cancel';
const nextAction: Record<string, ActionKey | undefined> = {
  Pedido: 'collect',
  'Colheita realizada': 'process',
  'Em processamento': 'report',
  Agendado: 'perform',
  Realizado: 'report',
  'Resultado disponível': 'validate',
  Relatado: 'validate',
};
const actionLabel: Record<ActionKey, string> = {
  collect: 'Registar colheita',
  process: 'Iniciar processamento',
  schedule: 'Agendar realização',
  perform: 'Registar realização',
  report: 'Lançar resultado',
  validate: 'Validar resultado',
  cancel: 'Cancelar pedido',
};
const actionIcon: Record<ActionKey, ReactNode> = {
  collect: <TestTube size={15} />,
  process: <Play size={15} />,
  schedule: <CalendarClock size={15} />,
  perform: <Scan size={15} />,
  report: <FileText size={15} />,
  validate: <CheckCheck size={15} />,
  cancel: <Ban size={15} />,
};

export function ExamFlow({ exam }: { exam: Exam }) {
  const flow = exam.category === 'Laboratório' ? labFlow : imagingFlow;
  const index = flow.indexOf(exam.status);
  if (exam.status === 'Cancelado')
    return (
      <p className="exam-cancelled">
        Cancelado por {exam.cancellation?.author} · {exam.cancellation?.reason}
      </p>
    );
  return (
    <ol className="exam-flow" aria-label={'Estado do pedido: ' + exam.status}>
      {flow.map((step, i) => (
        <li key={step} className={i < index ? 'done' : i === index ? 'current' : ''}>
          <span aria-hidden="true" />
          {step}
        </li>
      ))}
    </ol>
  );
}

export function DiagnosticsBoard() {
  const { db, session } = useDemo();
  const [category, setCategory] = useState<ExamCategory>('Laboratório');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(true);
  const [dialog, setDialog] = useState<{ exam: Exam; action: ActionKey } | null>(null);
  if (!db) return null;
  const byCategory = db.exams.filter((e) => e.category === category);
  const exams = byCategory
    .filter((e) => !pending || !['Validado', 'Cancelado'].includes(e.status))
    .filter((e) =>
      normalize(
        (db.patients.find((p) => p.id === e.patientId)?.name ?? '') +
          ' ' +
          e.examType +
          ' ' +
          (e.collection?.sampleCode ?? ''),
      ).includes(normalize(search)),
    )
    .sort(
      (a, b) =>
        Number(b.priority === 'Urgente') - Number(a.priority === 'Urgente') ||
        a.requestedAt.localeCompare(b.requestedAt),
    );
  const counts = {
    open: byCategory.filter((e) => e.status === 'Pedido').length,
    running: byCategory.filter((e) =>
      ['Colheita realizada', 'Em processamento', 'Agendado', 'Realizado'].includes(e.status),
    ).length,
    awaiting: byCategory.filter((e) => ['Resultado disponível', 'Relatado'].includes(e.status))
      .length,
  };
  return (
    <>
      <PageHeader
        eyebrow="MEIOS COMPLEMENTARES DE DIAGNÓSTICO"
        title="Laboratório e imagiologia"
        description="Do pedido feito na consulta ao resultado validado que entra no processo clínico."
      >
        <Badge tone="info">{exams.length} pedidos listados</Badge>
      </PageHeader>
      <div className="clinical-summary">
        <div>
          <FlaskConical size={20} />
          <span>
            <strong>{counts.open}</strong>Pedidos por iniciar
          </span>
        </div>
        <div>
          <Microscope size={20} />
          <span>
            <strong>{counts.running}</strong>Em curso
          </span>
        </div>
        <div>
          <CheckCheck size={20} />
          <span>
            <strong>{counts.awaiting}</strong>A aguardar validação médica
          </span>
        </div>
      </div>
      <div className="segmented" role="tablist" aria-label="Via de diagnóstico">
        {(['Laboratório', 'Imagiologia'] as ExamCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={category === c ? 'active' : ''}
            onClick={() => setCategory(c)}
          >
            {c === 'Laboratório' ? <FlaskConical size={16} /> : <Scan size={16} />}
            {c}
            <span>{db.exams.filter((e) => e.category === c).length}</span>
          </button>
        ))}
      </div>
      <Panel
        title={category === 'Laboratório' ? 'Pedidos laboratoriais' : 'Pedidos de imagiologia'}
        subtitle="Urgentes primeiro, depois por ordem de pedido."
      >
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Pesquisar paciente, exame ou código de amostra"
          />
          <label className="filter-select">
            <span>Mostrar</span>
            <select
              value={pending ? 'pending' : 'all'}
              onChange={(e) => setPending(e.target.value === 'pending')}
            >
              <option value="pending">Apenas pendentes</option>
              <option value="all">Todos os pedidos</option>
            </select>
          </label>
        </div>
        {exams.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Exame</th>
                  <th>Percurso</th>
                  <th>Estado</th>
                  <th className="align-right">Acções</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => {
                  const patient = db.patients.find((p) => p.id === exam.patientId)!;
                  const action = nextAction[exam.status];
                  const allowed =
                    action === 'validate' ? canConsult(session) : canDiagnostics(session);
                  return (
                    <tr key={exam.id}>
                      <td>
                        <PatientCell patient={patient} />
                      </td>
                      <td>
                        <strong className="table-primary">{exam.examType}</strong>
                        <small className="muted">
                          {exam.priority === 'Urgente' ? 'Urgente · ' : ''}
                          Pedido por {exam.requestedBy} · {formatDate(exam.requestedAt)}
                        </small>
                      </td>
                      <td>
                        <ExamFlow exam={exam} />
                      </td>
                      <td>
                        <div className="exam-state">
                          <Status value={exam.status} />
                          {exam.collection && (
                            <small className="muted">Amostra {exam.collection.sampleCode}</small>
                          )}
                          {exam.schedule && exam.status === 'Agendado' && (
                            <small className="muted">
                              {formatDate(exam.schedule.scheduledFor, true)}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions wrap">
                          {exam.category === 'Imagiologia' && exam.status === 'Pedido' && (
                            <button
                              className="button small primary"
                              disabled={!canDiagnostics(session)}
                              onClick={() => setDialog({ exam, action: 'schedule' })}
                            >
                              {actionIcon.schedule}
                              {actionLabel.schedule}
                            </button>
                          )}
                          {action && !(exam.category === 'Imagiologia' && action === 'collect') && (
                            <button
                              className="button small primary"
                              disabled={!allowed}
                              onClick={() => setDialog({ exam, action })}
                            >
                              {actionIcon[action]}
                              {actionLabel[action]}
                            </button>
                          )}
                          {!['Validado', 'Cancelado'].includes(exam.status) && (
                            <button
                              className="button small secondary"
                              disabled={!canDiagnostics(session) && !canConsult(session)}
                              onClick={() => setDialog({ exam, action: 'cancel' })}
                            >
                              Cancelar
                            </button>
                          )}
                          <Link
                            className="icon-button"
                            href={'/clinica/' + exam.episodeId}
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
            title="Sem pedidos nesta lista"
            description="Os pedidos são criados durante a consulta médica e aparecem aqui de imediato."
          />
        )}
      </Panel>
      <div className="info-line spaced">
        <Badge tone="info">Regra</Badge>
        <span>
          Só um resultado validado por um médico entra no processo clínico como definitivo. Os
          ficheiros são exemplos locais; DICOM e PACS ficam para uma integração posterior.
        </span>
      </div>
      {!canDiagnostics(session) && !canConsult(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Técnico para operar os pedidos ou Médico para validar resultados.
        </div>
      )}
      {dialog && (
        <ExamActionForm exam={dialog.exam} action={dialog.action} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

function ExamActionForm({
  exam,
  action,
  onClose,
}: {
  exam: Exam;
  action: ActionKey;
  onClose: () => void;
}) {
  const { db, run } = useDemo();
  const patient = db?.patients.find((p) => p.id === exam.patientId);
  const build = (data: FormData): Command => {
    const text = (key: string) => String(data.get(key) ?? '');
    switch (action) {
      case 'collect':
        return { type: 'exam.collect', examId: exam.id, sampleCode: text('sampleCode') };
      case 'process':
        return { type: 'exam.process', examId: exam.id };
      case 'schedule':
        return { type: 'exam.schedule', examId: exam.id, date: text('date'), time: text('time') };
      case 'perform':
        return { type: 'exam.perform', examId: exam.id };
      case 'report':
        return {
          type: 'exam.report',
          examId: exam.id,
          summary: text('summary'),
          findings: text('findings'),
          attachment: text('attachment'),
        };
      case 'validate':
        return { type: 'exam.validate', examId: exam.id, notes: text('notes') };
      case 'cancel':
        return { type: 'exam.cancel', examId: exam.id, reason: text('reason') };
    }
  };
  return (
    <Modal
      title={actionLabel[action]}
      description={exam.examType + ' · ' + (patient?.name ?? '')}
      onClose={onClose}
    >
      <ActionForm
        submitLabel={actionLabel[action]}
        onClose={onClose}
        onSubmit={async (data) => run(build(data))}
      >
        <div className="form-grid">
          {action === 'collect' && (
            <Field label="Código da amostra *" wide>
              <input
                autoFocus
                name="sampleCode"
                required
                minLength={2}
                maxLength={20}
                placeholder="Ex.: AM-2026-0142"
              />
            </Field>
          )}
          {action === 'process' && (
            <p className="form-hint">
              A amostra {exam.collection?.sampleCode} passa para processamento. A autoria e a hora
              ficam registadas.
            </p>
          )}
          {action === 'schedule' && (
            <>
              <Field label="Data da realização *">
                <input
                  autoFocus
                  name="date"
                  type="date"
                  required
                  defaultValue={today()}
                  min={today()}
                />
              </Field>
              <Field label="Hora *">
                <input name="time" type="time" required defaultValue="10:00" step={900} />
              </Field>
            </>
          )}
          {action === 'perform' && (
            <p className="form-hint">
              Confirma a realização de {exam.examType}
              {exam.schedule
                ? ', agendado para ' + formatDate(exam.schedule.scheduledFor, true)
                : ''}
              . O relatório é lançado no passo seguinte.
            </p>
          )}
          {action === 'report' && (
            <>
              <Field label={exam.category === 'Laboratório' ? 'Resultado *' : 'Conclusão *'} wide>
                <textarea autoFocus name="summary" required minLength={3} maxLength={500} />
              </Field>
              <Field label="Descrição e valores" wide>
                <textarea name="findings" maxLength={4000} />
              </Field>
              <Field label="Ficheiro de exemplo" wide>
                <input name="attachment" maxLength={160} placeholder="Ex.: rx-torax-demo.pdf" />
              </Field>
            </>
          )}
          {action === 'validate' && (
            <>
              <p className="form-hint">
                {exam.report?.summary}
                <br />
                Lançado por {exam.report?.author}.
              </p>
              <Field label="Nota de validação" wide>
                <textarea autoFocus name="notes" maxLength={1000} />
              </Field>
            </>
          )}
          {action === 'cancel' && (
            <Field label="Justificação do cancelamento *" wide>
              <textarea autoFocus name="reason" required minLength={3} maxLength={500} />
            </Field>
          )}
        </div>
        {action === 'validate' && (
          <div className="clinical-warning">
            Ao validar, o resultado passa a constar do processo clínico como definitivo e deixa de
            poder ser cancelado.
          </div>
        )}
      </ActionForm>
    </Modal>
  );
}
