'use client';
import { useState } from 'react';
import {
  Ban,
  Banknote,
  FileText,
  HandCoins,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  canAdministration,
  paymentMethods,
  serviceCategories,
  type Invoice,
  type Service,
} from '@/domain/schema';
import {
  ActionForm,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Panel,
  SearchInput,
  Status,
} from '@/components/ui';
import { formatDate, formatKwanza, normalize } from '@/lib/format';

const paidOf = (invoice: Invoice) => invoice.payments.reduce((sum, p) => sum + p.amount, 0);

export function FinanceBoard() {
  const { db, session } = useDemo();
  const [view, setView] = useState<'invoices' | 'cash' | 'tables'>('invoices');
  const [search, setSearch] = useState('');
  const [issue, setIssue] = useState(false);
  const [pay, setPay] = useState<Invoice | null>(null);
  const [cancel, setCancel] = useState<Invoice | null>(null);
  const [cashForm, setCashForm] = useState<'Receita' | 'Despesa' | null>(null);
  const [serviceForm, setServiceForm] = useState<Service | 'new' | null>(null);
  const [insurerForm, setInsurerForm] = useState(false);
  if (!db) return null;
  const invoices = db.invoices
    .filter((i) =>
      normalize(
        i.number + ' ' + (db.patients.find((p) => p.id === i.patientId)?.name ?? ''),
      ).includes(normalize(search)),
    )
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const income = db.cash.filter((c) => c.type === 'Receita').reduce((s, c) => s + c.amount, 0);
  const expense = db.cash.filter((c) => c.type === 'Despesa').reduce((s, c) => s + c.amount, 0);
  const receivable = db.invoices
    .filter((i) => i.status !== 'Anulada')
    .reduce((sum, i) => sum + (i.due - paidOf(i)), 0);
  const covered = db.invoices
    .filter((i) => i.status !== 'Anulada')
    .reduce((sum, i) => sum + i.covered, 0);
  return (
    <>
      <PageHeader
        eyebrow="FINANÇAS"
        title="Facturação e caixa"
        description="Tabela de serviços, facturas, recibos e movimentos de caixa em kwanzas."
      >
        {canAdministration(session) && (
          <button className="button primary" onClick={() => setIssue(true)}>
            <Plus size={18} />
            Emitir factura
          </button>
        )}
      </PageHeader>
      <div className="stat-grid">
        {[
          {
            label: 'Saldo de caixa',
            value: formatKwanza(income - expense),
            hint: 'Receitas menos despesas registadas',
            icon: Wallet,
            color: 'blue',
          },
          {
            label: 'Receitas acumuladas',
            value: formatKwanza(income),
            hint: `${db.cash.filter((c) => c.type === 'Receita').length} movimentos`,
            icon: TrendingUp,
            color: 'green',
          },
          {
            label: 'Despesas acumuladas',
            value: formatKwanza(expense),
            hint: `${db.cash.filter((c) => c.type === 'Despesa').length} movimentos`,
            icon: TrendingDown,
            color: 'amber',
          },
          {
            label: 'Por cobrar',
            value: formatKwanza(receivable),
            hint: `${formatKwanza(covered)} comparticipados por convénios`,
            icon: HandCoins,
            color: 'violet',
          },
        ].map(({ label, value, hint, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-value money">{value}</strong>
            <div className="stat-hint">{hint}</div>
          </div>
        ))}
      </div>
      <div className="segmented" role="tablist" aria-label="Vista financeira">
        {(
          [
            ['invoices', 'Facturas', db.invoices.length],
            ['cash', 'Caixa', db.cash.length],
            ['tables', 'Tabelas e convénios', db.services.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            className={view === key ? 'active' : ''}
            onClick={() => setView(key)}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {view === 'invoices' && (
        <Panel title="Facturas emitidas" subtitle="Valores, comparticipação e pagamentos.">
          <div className="toolbar">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Pesquisar número de factura ou paciente"
            />
            <Badge tone="info">{formatKwanza(receivable)} por cobrar</Badge>
          </div>
          {invoices.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Paciente</th>
                    <th>Valores</th>
                    <th>Estado</th>
                    <th className="align-right">Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => {
                    const patient = db.patients.find((p) => p.id === invoice.patientId)!;
                    const outstanding = invoice.due - paidOf(invoice);
                    const insurer = db.insurers.find((i) => i.id === invoice.insurerId);
                    return (
                      <tr key={invoice.id}>
                        <td>
                          <strong className="table-primary">{invoice.number}</strong>
                          <small className="muted">
                            {formatDate(invoice.issuedAt)} · {invoice.issuedBy}
                          </small>
                        </td>
                        <td>
                          <strong className="table-primary">{patient.name}</strong>
                          <small className="muted">
                            {insurer
                              ? insurer.name + ' · ' + insurer.coverage + '%'
                              : 'Sem convénio'}
                          </small>
                        </td>
                        <td>
                          <div className="exam-state">
                            <strong className="table-primary">
                              {formatKwanza(invoice.subtotal)}
                            </strong>
                            <small className="muted">
                              Comparticipado {formatKwanza(invoice.covered)} · devido{' '}
                              {formatKwanza(invoice.due)}
                            </small>
                            {outstanding > 0 && invoice.status !== 'Anulada' && (
                              <Badge tone="warning">Faltam {formatKwanza(outstanding)}</Badge>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="exam-state">
                            <Status value={invoice.status} />
                            {invoice.payments.map((p) => (
                              <small className="muted" key={p.id}>
                                {p.receipt} · {formatKwanza(p.amount)} · {p.method}
                              </small>
                            ))}
                            {invoice.cancellation && (
                              <small className="muted">{invoice.cancellation.reason}</small>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions wrap">
                            <button
                              className="button small primary"
                              disabled={
                                !canAdministration(session) ||
                                outstanding <= 0 ||
                                invoice.status === 'Anulada'
                              }
                              onClick={() => setPay(invoice)}
                            >
                              <Banknote size={15} />
                              Registar pagamento
                            </button>
                            <button
                              className="button small secondary"
                              disabled={
                                !canAdministration(session) ||
                                invoice.payments.length > 0 ||
                                invoice.status === 'Anulada'
                              }
                              onClick={() => setCancel(invoice)}
                            >
                              <Ban size={15} />
                              Anular
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
              title="Sem facturas emitidas"
              description="Emita a primeira factura a partir da tabela de serviços."
            />
          )}
          <div className="info-line">
            <Receipt size={16} />
            <span>Os recibos são numerados automaticamente, por ordem de emissão.</span>
          </div>
        </Panel>
      )}
      {view === 'cash' && (
        <Panel
          title="Movimentos de caixa"
          subtitle="Pagamentos de facturas, receitas avulsas e despesas."
          action={
            canAdministration(session) ? (
              <div className="table-actions">
                <button className="button small secondary" onClick={() => setCashForm('Receita')}>
                  <TrendingUp size={15} />
                  Receita
                </button>
                <button className="button small secondary" onClick={() => setCashForm('Despesa')}>
                  <TrendingDown size={15} />
                  Despesa
                </button>
              </div>
            ) : undefined
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Movimento</th>
                  <th>Descrição</th>
                  <th>Meio</th>
                  <th className="align-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {db.cash.map((entry) => (
                  <tr key={entry.id}>
                    <td className="nowrap">{formatDate(entry.at, true)}</td>
                    <td>
                      <Status value={entry.type} />
                      <small className="muted">{entry.category}</small>
                    </td>
                    <td>
                      <strong className="table-primary">{entry.description}</strong>
                      <small className="muted">{entry.author}</small>
                    </td>
                    <td>{entry.method}</td>
                    <td
                      className={
                        'align-right ' + (entry.type === 'Receita' ? 'movement-in' : 'movement-out')
                      }
                    >
                      {(entry.type === 'Receita' ? '+' : '−') + formatKwanza(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <span>
              <Wallet size={14} />
              Saldo reconciliado com os movimentos listados
            </span>
            <strong>{formatKwanza(income - expense)}</strong>
          </div>
        </Panel>
      )}
      {view === 'tables' && (
        <>
          <Panel
            title="Tabela de serviços"
            subtitle="Preços em kwanzas usados na facturação."
            action={
              canAdministration(session) ? (
                <button className="button secondary small" onClick={() => setServiceForm('new')}>
                  <Plus size={15} />
                  Novo serviço
                </button>
              ) : undefined
            }
          >
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Serviço</th>
                    <th>Categoria</th>
                    <th className="align-right">Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {db.services.map((service) => (
                    <tr key={service.id}>
                      <td>{service.code}</td>
                      <td>
                        <button
                          className="link-button"
                          disabled={!canAdministration(session)}
                          onClick={() => setServiceForm(service)}
                        >
                          {service.name}
                        </button>
                      </td>
                      <td>{service.category}</td>
                      <td className="align-right">{formatKwanza(service.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel
            title="Convénios e seguros"
            subtitle="Comparticipação aplicada ao emitir a factura."
            action={
              canAdministration(session) ? (
                <button className="button secondary small" onClick={() => setInsurerForm(true)}>
                  <Plus size={15} />
                  Novo convénio
                </button>
              ) : undefined
            }
          >
            <div className="permission-list">
              {db.insurers.map((insurer) => (
                <div key={insurer.id}>
                  <ShieldCheck size={18} />
                  <div>
                    <strong>{insurer.name}</strong>
                    <p>{insurer.contact || 'Sem contacto registado'}</p>
                  </div>
                  <Badge tone="info">{insurer.coverage}%</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      {!canAdministration(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Administrativo para emitir facturas e movimentar a caixa.
        </div>
      )}
      {issue && <InvoiceForm onClose={() => setIssue(false)} />}
      {pay && <PaymentForm invoice={pay} onClose={() => setPay(null)} />}
      {cancel && <CancelForm invoice={cancel} onClose={() => setCancel(null)} />}
      {cashForm && <CashForm entryType={cashForm} onClose={() => setCashForm(null)} />}
      {serviceForm && (
        <ServiceForm
          service={serviceForm === 'new' ? undefined : serviceForm}
          onClose={() => setServiceForm(null)}
        />
      )}
      {insurerForm && <InsurerForm onClose={() => setInsurerForm(false)} />}
    </>
  );
}

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const { db, run } = useDemo();
  const [lines, setLines] = useState<Array<{ serviceId: string; quantity: number }>>([]);
  const [insurerId, setInsurerId] = useState('');
  const services = db?.services ?? [];
  const subtotal = lines.reduce(
    (sum, l) => sum + (services.find((s) => s.id === l.serviceId)?.price ?? 0) * l.quantity,
    0,
  );
  const coverage = db?.insurers.find((i) => i.id === insurerId)?.coverage ?? 0;
  const covered = Math.floor((subtotal * coverage) / 100);
  return (
    <Modal
      title="Emitir factura"
      description="Os valores vêm da tabela de serviços da unidade."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Emitir factura"
        onClose={onClose}
        onSubmit={async (data) => {
          if (!lines.length) throw new Error('Escolha pelo menos um serviço para facturar.');
          await run({
            type: 'invoice.issue',
            patientId: String(data.get('patientId') ?? ''),
            episodeId: String(data.get('episodeId') ?? '') || null,
            insurerId: insurerId || null,
            lines,
          });
        }}
      >
        <div className="form-grid">
          <Field label="Paciente *" wide>
            <select name="patientId" required autoFocus>
              {db?.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Episódio (opcional)" wide>
            <select name="episodeId" defaultValue="">
              <option value="">Sem episódio associado</option>
              {db?.episodes.map((e) => (
                <option key={e.id} value={e.id}>
                  {db.patients.find((p) => p.id === e.patientId)?.name} · {e.service} ·{' '}
                  {formatDate(e.arrivedAt)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Convénio ou seguro" wide>
            <select value={insurerId} onChange={(e) => setInsurerId(e.target.value)}>
              <option value="">Sem convénio · valor total a cargo do utente</option>
              {db?.insurers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} · {i.coverage}%
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="prescription-heading">
          <div>
            <h3>Serviços facturados</h3>
            <p>Escolha os serviços prestados e as quantidades.</p>
          </div>
          <button
            type="button"
            className="button secondary small"
            onClick={() => setLines([...lines, { serviceId: services[0]?.id ?? '', quantity: 1 }])}
          >
            <Plus size={15} />
            Adicionar serviço
          </button>
        </div>
        {lines.length === 0 ? (
          <Empty title="Sem serviços" description="Adicione pelo menos um serviço à factura." />
        ) : (
          <div className="prescription-list">
            {lines.map((line, index) => (
              <div className="invoice-row" key={index}>
                <Field label="Serviço *">
                  <select
                    value={line.serviceId}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, serviceId: e.target.value } : l,
                        ),
                      )
                    }
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {formatKwanza(s.price)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantidade *">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={line.quantity}
                    onChange={(e) =>
                      setLines(
                        lines.map((l, i) =>
                          i === index ? { ...l, quantity: Number(e.target.value) } : l,
                        ),
                      )
                    }
                  />
                </Field>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
        <dl className="invoice-total">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatKwanza(subtotal)}</dd>
          </div>
          <div>
            <dt>Comparticipação</dt>
            <dd>−{formatKwanza(covered)}</dd>
          </div>
          <div>
            <dt>A pagar pelo paciente</dt>
            <dd>
              <strong>{formatKwanza(subtotal - covered)}</strong>
            </dd>
          </div>
        </dl>
      </ActionForm>
    </Modal>
  );
}

function PaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { db, run } = useDemo();
  const outstanding = invoice.due - paidOf(invoice);
  return (
    <Modal
      title="Registar pagamento"
      description={
        invoice.number + ' · ' + (db?.patients.find((p) => p.id === invoice.patientId)?.name ?? '')
      }
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar pagamento"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'invoice.pay',
            invoiceId: invoice.id,
            amount: Number(data.get('amount')),
            method: String(data.get('method')) as 'Numerário' | 'Multicaixa' | 'Transferência',
          })
        }
      >
        <div className="form-grid">
          <Field label="Valor em kwanzas *">
            <input
              autoFocus
              name="amount"
              type="number"
              min={1}
              max={outstanding}
              defaultValue={outstanding}
              required
            />
          </Field>
          <Field label="Meio de pagamento *">
            <select name="method" defaultValue="Numerário">
              {paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Em dívida" wide>
            <input value={formatKwanza(outstanding)} readOnly disabled />
          </Field>
        </div>
        <div className="clinical-warning">
          <FileText size={15} /> O recibo é numerado automaticamente e o valor entra na caixa como
          receita.
        </div>
      </ActionForm>
    </Modal>
  );
}

function CancelForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal title="Anular factura" description={invoice.number} onClose={onClose}>
      <ActionForm
        submitLabel="Anular factura"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'invoice.cancel',
            invoiceId: invoice.id,
            reason: String(data.get('reason') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Motivo da anulação *" wide>
            <textarea autoFocus name="reason" required minLength={3} maxLength={300} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function CashForm({
  entryType,
  onClose,
}: {
  entryType: 'Receita' | 'Despesa';
  onClose: () => void;
}) {
  const { run } = useDemo();
  return (
    <Modal
      title={entryType === 'Receita' ? 'Registar receita' : 'Registar despesa'}
      description="Movimento de caixa fora da facturação."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar movimento"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'cash.entry',
            entryType,
            category: String(data.get('category') ?? ''),
            description: String(data.get('description') ?? ''),
            amount: Number(data.get('amount')),
            method: String(data.get('method')) as 'Numerário' | 'Multicaixa' | 'Transferência',
          })
        }
      >
        <div className="form-grid">
          <Field label="Categoria *">
            <input
              autoFocus
              name="category"
              required
              minLength={2}
              maxLength={60}
              placeholder={entryType === 'Receita' ? 'Serviços avulsos' : 'Manutenção'}
            />
          </Field>
          <Field label="Valor em kwanzas *">
            <input name="amount" type="number" min={1} required />
          </Field>
          <Field label="Meio *">
            <select name="method" defaultValue="Numerário">
              {paymentMethods.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Descrição *" wide>
            <textarea name="description" required minLength={3} maxLength={200} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function ServiceForm({ service, onClose }: { service?: Service; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title={service ? 'Editar serviço' : 'Novo serviço'}
      description="Tabela de preços da unidade, em kwanzas."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Guardar serviço"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'service.save',
            id: service?.id,
            code: String(data.get('code') ?? ''),
            name: String(data.get('name') ?? ''),
            category: String(data.get('category')) as Service['category'],
            price: Number(data.get('price')),
          })
        }
      >
        <div className="form-grid">
          <Field label="Código *">
            <input autoFocus name="code" required maxLength={20} defaultValue={service?.code} />
          </Field>
          <Field label="Categoria *">
            <select name="category" defaultValue={service?.category ?? 'Consulta'}>
              {serviceCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Designação *" wide>
            <input name="name" required maxLength={120} defaultValue={service?.name} />
          </Field>
          <Field label="Preço em kwanzas *" wide>
            <input name="price" type="number" min={0} required defaultValue={service?.price ?? 0} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function InsurerForm({ onClose }: { onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title="Novo convénio"
      description="Percentagem comparticipada nas facturas."
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar convénio"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'insurer.save',
            name: String(data.get('name') ?? ''),
            coverage: Number(data.get('coverage')),
            contact: String(data.get('contact') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Nome *" wide>
            <input autoFocus name="name" required minLength={2} maxLength={120} />
          </Field>
          <Field label="Comparticipação (%) *">
            <input name="coverage" type="number" min={0} max={100} required defaultValue={70} />
          </Field>
          <Field label="Contacto">
            <input name="contact" maxLength={160} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
