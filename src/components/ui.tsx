'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { X, Search, ArrowUpRight, Inbox } from 'lucide-react';
import Link from 'next/link';
import type { Patient } from '@/domain/schema';
import { age, initials } from '@/lib/format';

export function Badge({ children, tone = '' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
const statusTone: Record<string, string> = {
  Cancelada: 'danger',
  Cancelado: 'danger',
  Confirmada: 'success',
  Concluído: 'success',
  Concluída: 'success',
  Validado: 'success',
  'Aguarda triagem': 'warning',
  Pedido: 'warning',
  'Resultado disponível': 'orange',
  Relatado: 'orange',
  Livre: 'success',
  Alta: 'success',
  Bloqueada: 'danger',
  'Em manutenção': 'warning',
  'Aguarda internamento': 'orange',
  Entrada: 'success',
  Saída: 'warning',
  Ajuste: 'orange',
  Transferência: 'info',
  Dispensação: 'info',
};
export function Status({ value }: { value: string }) {
  return <Badge tone={statusTone[value] ?? 'info'}>{value}</Badge>;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function PatientCell({ patient }: { patient: Patient }) {
  return (
    <Link className="patient-cell" href={`/pacientes/${patient.id}`}>
      <span className="avatar">{initials(patient.name)}</span>
      <span>
        <strong>{patient.name}</strong>
        <small>
          {patient.number} <span>·</span> {age(patient.birthDate)} anos
        </small>
      </span>
    </Link>
  );
}
export function Empty({
  title = 'Sem registos',
  description = 'Os registos serão apresentados aqui.',
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={28} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Pesquisar…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <Search size={17} />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={15} />
    </Link>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    ref.current
      ?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      )
      ?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ActionForm({
  children,
  submitLabel = 'Guardar',
  onSubmit,
  onClose,
}: {
  children: ReactNode;
  submitLabel?: string;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError('');
    setPending(true);
    try {
      await onSubmit(new FormData(e.currentTarget));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocorreu um erro. Tente novamente.');
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending} className="form-fields">
        {children}
      </fieldset>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose} disabled={pending}>
          Cancelar
        </button>
        <button className="button primary" disabled={pending}>
          {pending ? 'A guardar…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
