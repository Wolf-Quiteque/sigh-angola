'use client';
import { useState } from 'react';
import { FlaskConical, Paperclip, Plus } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { canConsult, examCatalogue, examCategories, type Exam } from '@/domain/schema';
import { ActionForm, Badge, Empty, Field, Modal, Panel, Status } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { ExamFlow } from './diagnostics';

export function ExamCard({ exam }: { exam: Exam }) {
  return (
    <article className="exam-card">
      <header>
        <div>
          <strong>{exam.examType}</strong>
          <small>
            {exam.category} · {exam.priority} · pedido por {exam.requestedBy} ·{' '}
            {formatDate(exam.requestedAt)}
          </small>
        </div>
        <Status value={exam.status} />
      </header>
      {exam.clinicalNote && <p className="exam-note">{exam.clinicalNote}</p>}
      <ExamFlow exam={exam} />
      {exam.report && (
        <div className={exam.validation ? 'exam-result final' : 'exam-result'}>
          <strong>{exam.report.summary}</strong>
          {exam.report.findings && <p>{exam.report.findings}</p>}
          {exam.report.attachment && (
            <span className="exam-attachment">
              <Paperclip size={13} />
              {exam.report.attachment}
            </span>
          )}
          <small>
            {exam.validation
              ? 'Validado por ' +
                exam.validation.author +
                ' · ' +
                formatDate(exam.validation.at, true)
              : 'Lançado por ' + exam.report.author + ' · aguarda validação médica'}
          </small>
          {exam.validation?.notes && <p className="exam-note">{exam.validation.notes}</p>}
        </div>
      )}
    </article>
  );
}

export function EpisodeExams({
  episodeId,
  consultationId,
  open,
}: {
  episodeId: string;
  consultationId?: string;
  open: boolean;
}) {
  const { db, session } = useDemo();
  const [form, setForm] = useState(false);
  if (!db) return null;
  const exams = db.exams
    .filter((e) => e.episodeId === episodeId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const pending = exams.filter((e) => !['Validado', 'Cancelado'].includes(e.status)).length;
  return (
    <Panel
      title="Exames complementares"
      subtitle="Só entram no processo como definitivos depois de validados."
      action={
        open && consultationId ? (
          <button
            type="button"
            className="button secondary small"
            disabled={!canConsult(session)}
            onClick={() => setForm(true)}
          >
            <Plus size={15} />
            Pedir exame
          </button>
        ) : pending ? (
          <Badge tone="warning">{pending} por concluir</Badge>
        ) : undefined
      }
    >
      {exams.length ? (
        <div className="exam-list">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} />
          ))}
        </div>
      ) : (
        <Empty
          title="Sem exames pedidos"
          description="Peça análises ou imagiologia quando fizerem parte do plano."
        />
      )}
      {form && consultationId && (
        <ExamRequestForm consultationId={consultationId} onClose={() => setForm(false)} />
      )}
    </Panel>
  );
}

function ExamRequestForm({
  consultationId,
  onClose,
}: {
  consultationId: string;
  onClose: () => void;
}) {
  const { run } = useDemo();
  const [category, setCategory] = useState<'Laboratório' | 'Imagiologia'>('Laboratório');
  return (
    <Modal
      title="Pedir exame complementar"
      description="O pedido fica ligado a esta consulta e ao episódio do paciente."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar pedido"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'exam.request',
            consultationId,
            category,
            examType: String(data.get('examType') ?? ''),
            priority: String(data.get('priority')) as 'Urgente' | 'Rotina',
            clinicalNote: String(data.get('clinicalNote') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Via *">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as 'Laboratório' | 'Imagiologia')}
            >
              {examCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioridade *">
            <select name="priority" defaultValue="Rotina">
              <option>Rotina</option>
              <option>Urgente</option>
            </select>
          </Field>
          <Field label="Exame *" wide>
            <input
              autoFocus
              name="examType"
              required
              minLength={2}
              maxLength={120}
              list="exam-catalogue"
              placeholder="Escolha da lista ou escreva o exame"
            />
            <datalist id="exam-catalogue">
              {examCatalogue[category].map((exam) => (
                <option key={exam} value={exam} />
              ))}
            </datalist>
          </Field>
          <Field label="Informação clínica para o serviço" wide>
            <textarea name="clinicalNote" maxLength={1000} />
          </Field>
        </div>
        <div className="clinical-warning">
          <FlaskConical size={15} /> O sistema não interpreta valores nem sugere exames. O pedido
          segue a decisão do médico.
        </div>
      </ActionForm>
    </Modal>
  );
}
