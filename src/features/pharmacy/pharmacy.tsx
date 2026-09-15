'use client';
import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ClipboardList,
  PackageSearch,
  Pill,
  Plus,
  Scale,
  Truck,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  canPharmacy,
  productCategories,
  type Batch,
  type Consultation,
  type Product,
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
  SearchInput,
  Status,
} from '@/components/ui';
import { formatDate, normalize, today } from '@/lib/format';

type StockAction = 'entry' | 'exit' | 'transfer' | 'adjust';
const stockLabel: Record<StockAction, string> = {
  entry: 'Registar entrada',
  exit: 'Registar saída',
  transfer: 'Requisitar para serviço',
  adjust: 'Ajustar inventário',
};

/** Dias até à validade; abaixo de 60 o lote é sinalizado, abaixo de zero está expirado. */
const daysToExpiry = (expiry: string | null) =>
  expiry === null
    ? null
    : Math.round(
        (new Date(expiry + 'T12:00:00+01:00').getTime() -
          new Date(today() + 'T12:00:00+01:00').getTime()) /
          86400000,
      );

export function PharmacyBoard() {
  const { db, session } = useDemo();
  const [view, setView] = useState<'stock' | 'dispense' | 'ledger'>('stock');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockForm, setStockForm] = useState<{ action: StockAction; product: Product } | null>(
    null,
  );
  const [productForm, setProductForm] = useState<Product | 'new' | null>(null);
  const [supplierForm, setSupplierForm] = useState(false);
  const [dispense, setDispense] = useState<{
    consultation: Consultation;
    itemId: string;
  } | null>(null);
  if (!db) return null;
  const stockOf = (productId: string) =>
    db.batches.filter((b) => b.productId === productId).reduce((sum, b) => sum + b.quantity, 0);
  const products = db.products
    .filter((p) => !category || p.category === category)
    .filter((p) => normalize(p.name + ' ' + p.code).includes(normalize(search)))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const below = db.products.filter((p) => stockOf(p.id) < p.minimumStock);
  const expiredBatches = db.batches.filter(
    (b) => (daysToExpiry(b.expiry) ?? 1) < 0 && b.quantity > 0,
  );
  const expiringBatches = db.batches.filter((b) => {
    const days = daysToExpiry(b.expiry);
    return days !== null && days >= 0 && days <= 60 && b.quantity > 0;
  });
  const pending = db.consultations
    .flatMap((c) => c.prescriptions.map((item) => ({ consultation: c, item })))
    .filter(({ item }) => item.quantity > item.dispensed)
    .sort((a, b) => b.consultation.startedAt.localeCompare(a.consultation.startedAt));
  return (
    <>
      <PageHeader
        eyebrow="FARMÁCIA E ARMAZÉM"
        title="Medicamentos, materiais e stock"
        description="Entradas, saídas, lotes e dispensação ligada à prescrição do paciente."
      >
        {canPharmacy(session) && (
          <button className="button primary" onClick={() => setProductForm('new')}>
            <Plus size={18} />
            Novo artigo
          </button>
        )}
      </PageHeader>
      <div className="stat-grid">
        {[
          {
            label: 'Artigos em catálogo',
            value: db.products.length,
            hint: `${db.batches.filter((b) => b.quantity > 0).length} lotes com stock`,
            icon: Boxes,
            color: 'blue',
          },
          {
            label: 'Abaixo do stock mínimo',
            value: below.length,
            hint: 'Necessitam de reposição',
            icon: AlertTriangle,
            color: 'amber',
          },
          {
            label: 'Lotes a expirar em 60 dias',
            value: expiringBatches.length,
            hint: 'Consumir ou devolver primeiro',
            icon: PackageSearch,
            color: 'violet',
          },
          {
            label: 'Lotes expirados com stock',
            value: expiredBatches.length,
            hint: 'Bloqueados para dispensação',
            icon: Pill,
            color: 'green',
          },
        ].map(({ label, value, hint, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={19} />
              </span>
            </div>
            <strong className="stat-value">{String(value).padStart(2, '0')}</strong>
            <div className="stat-hint">{hint}</div>
          </div>
        ))}
      </div>
      <div className="segmented" role="tablist" aria-label="Vista da farmácia">
        {(
          [
            ['stock', 'Stock e lotes', db.products.length],
            ['dispense', 'Dispensação', pending.length],
            ['ledger', 'Movimentos', db.movements.length],
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
      {view === 'stock' && (
        <>
          <Panel
            title="Catálogo e stock"
            subtitle="Existência total por artigo e estado dos lotes."
          >
            <div className="toolbar">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Pesquisar artigo ou código"
              />
              <label className="filter-select">
                <span>Categoria</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Todas as categorias</option>
                  {productCategories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            {products.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Artigo</th>
                      <th>Stock</th>
                      <th>Lotes e validades</th>
                      <th className="align-right">Movimentos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const stock = stockOf(product.id);
                      const batches = db.batches.filter(
                        (b) => b.productId === product.id && b.quantity > 0,
                      );
                      return (
                        <tr key={product.id}>
                          <td>
                            <strong className="table-primary">{product.name}</strong>
                            <small className="muted">
                              {product.code} · {product.category} · {product.measure}
                            </small>
                          </td>
                          <td>
                            <div className="exam-state">
                              <strong className="table-primary">
                                {stock} {product.measure}
                              </strong>
                              <small className="muted">
                                mín. {product.minimumStock} · máx. {product.maximumStock}
                              </small>
                              {stock < product.minimumStock && (
                                <Badge tone="warning">Abaixo do mínimo</Badge>
                              )}
                            </div>
                          </td>
                          <td>
                            {batches.length ? (
                              <ul className="batch-list">
                                {batches.map((b) => (
                                  <li key={b.id}>
                                    <span>{b.code}</span>
                                    <BatchExpiry batch={b} />
                                    <small>{b.quantity}</small>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <small className="muted">Sem lotes com stock</small>
                            )}
                          </td>
                          <td>
                            <div className="table-actions wrap">
                              {(['entry', 'exit', 'transfer', 'adjust'] as StockAction[]).map(
                                (action) => (
                                  <button
                                    key={action}
                                    className={
                                      action === 'entry'
                                        ? 'button small primary'
                                        : 'button small secondary'
                                    }
                                    disabled={
                                      !canPharmacy(session) ||
                                      (action !== 'entry' && !batches.length)
                                    }
                                    onClick={() => setStockForm({ action, product })}
                                  >
                                    {action === 'entry' ? (
                                      <ArrowDownToLine size={15} />
                                    ) : action === 'exit' ? (
                                      <ArrowUpFromLine size={15} />
                                    ) : action === 'transfer' ? (
                                      <Truck size={15} />
                                    ) : (
                                      <Scale size={15} />
                                    )}
                                    {stockLabel[action]}
                                  </button>
                                ),
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
                title="Sem artigos nesta pesquisa"
                description="Experimente outra designação, código ou categoria."
              />
            )}
          </Panel>
          <Panel
            title="Fornecedores"
            subtitle="Origem das entradas registadas no armazém."
            action={
              canPharmacy(session) ? (
                <button className="button secondary small" onClick={() => setSupplierForm(true)}>
                  <Plus size={15} />
                  Novo fornecedor
                </button>
              ) : undefined
            }
          >
            <div className="permission-list">
              {db.suppliers.map((s) => (
                <div key={s.id}>
                  <Truck size={18} />
                  <div>
                    <strong>{s.name}</strong>
                    <p>{s.contact || 'Sem contacto registado'}</p>
                  </div>
                  <Badge>{db.batches.filter((b) => b.supplierId === s.id).length} lote(s)</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      {view === 'dispense' && (
        <Panel
          title="Prescrições por dispensar"
          subtitle="Cada dispensação desconta de um lote e fica ligada ao paciente."
        >
          {pending.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Medicamento</th>
                    <th>Posologia</th>
                    <th>Por dispensar</th>
                    <th className="align-right">Acção</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(({ consultation, item }) => {
                    const patient = db.patients.find((p) => p.id === consultation.patientId)!;
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong className="table-primary">{patient.name}</strong>
                          <small className="muted">
                            {patient.number} · {formatDate(consultation.startedAt)}
                          </small>
                        </td>
                        <td>
                          <strong className="table-primary">{item.medication}</strong>
                          <small className="muted">{item.dose}</small>
                        </td>
                        <td>
                          {item.route} · {item.frequency} · {item.duration}
                        </td>
                        <td>
                          <div className="exam-state">
                            <strong className="table-primary">
                              {item.quantity - item.dispensed} de {item.quantity}
                            </strong>
                            {item.dispensed > 0 && <Badge tone="info">Dispensação parcial</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              className="button small primary"
                              disabled={!canPharmacy(session)}
                              onClick={() => setDispense({ consultation, itemId: item.id })}
                            >
                              <Pill size={15} />
                              Dispensar
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
              title="Nada por dispensar"
              description="As prescrições com quantidade registada aparecem nesta lista."
            />
          )}
        </Panel>
      )}
      {view === 'ledger' && (
        <Panel title="Livro de movimentos" subtitle="Todas as entradas e saídas, com autoria.">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Movimento</th>
                  <th>Artigo e lote</th>
                  <th>Quantidade</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {db.movements.slice(0, 40).map((m) => {
                  const product = db.products.find((p) => p.id === m.productId);
                  const batch = db.batches.find((b) => b.id === m.batchId);
                  const out = ['Saída', 'Transferência', 'Dispensação'].includes(m.type);
                  return (
                    <tr key={m.id}>
                      <td className="nowrap">{formatDate(m.at, true)}</td>
                      <td>
                        <Status value={m.type} />
                        <small className="muted">{m.author}</small>
                      </td>
                      <td>
                        <strong className="table-primary">{product?.name}</strong>
                        <small className="muted">
                          {batch ? 'Lote ' + batch.code : 'Sem lote'} · saldo {m.balance}
                        </small>
                      </td>
                      <td className={out ? 'movement-out' : 'movement-in'}>
                        {m.type === 'Ajuste'
                          ? (m.quantity > 0 ? '+' : '') + m.quantity
                          : (out ? '−' : '+') + Math.abs(m.quantity)}
                      </td>
                      <td>
                        {m.reason || '—'}
                        {m.destination && <small className="muted">→ {m.destination}</small>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <span>
              <ClipboardList size={14} />
              Últimos 40 movimentos
            </span>
            <span>{db.movements.length} no total</span>
          </div>
        </Panel>
      )}
      {!canPharmacy(session) && (
        <div className="info-line spaced">
          Seleccione o perfil Farmacêutico para movimentar stock e dispensar medicamentos.
        </div>
      )}
      {stockForm && (
        <StockForm
          action={stockForm.action}
          product={stockForm.product}
          onClose={() => setStockForm(null)}
        />
      )}
      {productForm && (
        <ProductForm
          product={productForm === 'new' ? undefined : productForm}
          onClose={() => setProductForm(null)}
        />
      )}
      {supplierForm && <SupplierForm onClose={() => setSupplierForm(false)} />}
      {dispense && (
        <DispenseForm
          consultation={dispense.consultation}
          itemId={dispense.itemId}
          onClose={() => setDispense(null)}
        />
      )}
    </>
  );
}

function BatchExpiry({ batch }: { batch: Batch }) {
  const days = daysToExpiry(batch.expiry);
  if (days === null) return <em>sem prazo</em>;
  if (days < 0) return <Badge tone="danger">Expirado</Badge>;
  if (days <= 60) return <Badge tone="warning">{days} dia(s)</Badge>;
  return <em>{formatDate(batch.expiry!)}</em>;
}

function StockForm({
  action,
  product,
  onClose,
}: {
  action: StockAction;
  product: Product;
  onClose: () => void;
}) {
  const { db, run } = useDemo();
  const batches = (db?.batches ?? []).filter(
    (b) => b.productId === product.id && (action === 'adjust' || b.quantity > 0),
  );
  const build = (data: FormData): Command => {
    const text = (key: string) => String(data.get(key) ?? '');
    const number = (key: string) => Number(data.get(key));
    switch (action) {
      case 'entry':
        return {
          type: 'stock.entry',
          productId: product.id,
          batchCode: text('batchCode'),
          expiry: text('expiry') || null,
          quantity: number('quantity'),
          supplierId: text('supplierId') || null,
          reason: text('reason'),
        };
      case 'exit':
        return {
          type: 'stock.exit',
          batchId: text('batchId'),
          quantity: number('quantity'),
          reason: text('reason'),
        };
      case 'transfer':
        return {
          type: 'stock.transfer',
          batchId: text('batchId'),
          quantity: number('quantity'),
          destination: text('destination'),
          reason: text('reason'),
        };
      case 'adjust':
        return {
          type: 'stock.adjust',
          batchId: text('batchId'),
          counted: number('counted'),
          reason: text('reason'),
        };
    }
  };
  return (
    <Modal
      title={stockLabel[action]}
      description={product.name + ' · ' + product.measure}
      onClose={onClose}
    >
      <ActionForm
        submitLabel={stockLabel[action]}
        onClose={onClose}
        onSubmit={async (data) => run(build(data))}
      >
        <div className="form-grid">
          {action === 'entry' ? (
            <>
              <Field label="Lote ou referência *">
                <input
                  autoFocus
                  name="batchCode"
                  required
                  maxLength={40}
                  placeholder="Ex.: L-PAR-2601"
                />
              </Field>
              <Field label="Validade">
                <input name="expiry" type="date" min={today()} />
              </Field>
              <Field label="Quantidade recebida *">
                <input name="quantity" type="number" min={1} max={100000} required />
              </Field>
              <Field label="Fornecedor">
                <select name="supplierId" defaultValue="">
                  <option value="">Não indicado</option>
                  {db?.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <Field label="Lote *" wide>
              <select name="batchId" required autoFocus>
                {batches.length === 0 && <option value="">Sem lotes disponíveis</option>}
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.quantity} {product.measure}
                    {b.expiry ? ' · validade ' + b.expiry : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {(action === 'exit' || action === 'transfer') && (
            <Field label="Quantidade *">
              <input name="quantity" type="number" min={1} max={100000} required />
            </Field>
          )}
          {action === 'transfer' && (
            <Field label="Serviço de destino *">
              <input
                name="destination"
                required
                maxLength={160}
                placeholder="Ex.: Enfermaria de Medicina"
              />
            </Field>
          )}
          {action === 'adjust' && (
            <Field label="Quantidade contada *">
              <input name="counted" type="number" min={0} max={100000} required />
            </Field>
          )}
          <Field label={action === 'entry' ? 'Observações' : 'Justificação *'} wide>
            <textarea
              name="reason"
              required={action !== 'entry'}
              minLength={action === 'entry' ? 0 : 3}
              maxLength={500}
            />
          </Field>
        </div>
        {action === 'adjust' && (
          <div className="clinical-warning">
            <Scale size={15} /> O ajuste guarda a diferença entre o stock registado e a contagem
            física, com a justificação.
          </div>
        )}
      </ActionForm>
    </Modal>
  );
}

function DispenseForm({
  consultation,
  itemId,
  onClose,
}: {
  consultation: Consultation;
  itemId: string;
  onClose: () => void;
}) {
  const { db, run } = useDemo();
  const item = consultation.prescriptions.find((p) => p.id === itemId)!;
  const remaining = item.quantity - item.dispensed;
  const patient = db?.patients.find((p) => p.id === consultation.patientId);
  const options = (db?.batches ?? []).filter((b) => b.quantity > 0);
  return (
    <Modal
      title="Dispensar medicamento"
      description={(patient?.name ?? '') + ' · ' + item.medication + ' ' + item.dose}
      onClose={onClose}
    >
      <ActionForm
        submitLabel="Registar dispensação"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'pharmacy.dispense',
            consultationId: consultation.id,
            prescriptionItemId: itemId,
            batchId: String(data.get('batchId') ?? ''),
            quantity: Number(data.get('quantity')),
          })
        }
      >
        <div className="form-grid">
          <Field label="Lote a debitar *" wide>
            <select name="batchId" required autoFocus>
              {options.map((b) => {
                const product = db?.products.find((p) => p.id === b.productId);
                const days = daysToExpiry(b.expiry);
                return (
                  <option key={b.id} value={b.id}>
                    {product?.name} · {b.code} · {b.quantity} {product?.measure}
                    {days !== null && days < 0 ? ' · EXPIRADO' : ''}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Quantidade a dispensar *">
            <input
              name="quantity"
              type="number"
              min={1}
              max={remaining}
              defaultValue={remaining}
              required
            />
          </Field>
          <Field label="Por dispensar">
            <input value={remaining + ' de ' + item.quantity} readOnly disabled />
          </Field>
        </div>
        <div className="clinical-warning">
          <Pill size={15} /> Lotes expirados são recusados. A dispensação pode ser parcial e o
          restante fica pendente.
        </div>
      </ActionForm>
    </Modal>
  );
}

function ProductForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal
      title={product ? 'Editar artigo' : 'Novo artigo'}
      description="Catálogo partilhado por farmácia e armazém."
      onClose={onClose}
    >
      <ActionForm
        submitLabel={product ? 'Guardar artigo' : 'Registar artigo'}
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'product.save',
            id: product?.id,
            code: String(data.get('code') ?? ''),
            name: String(data.get('name') ?? ''),
            category: String(data.get('category')) as Product['category'],
            measure: String(data.get('measure') ?? ''),
            minimumStock: Number(data.get('minimumStock')),
            maximumStock: Number(data.get('maximumStock')),
          })
        }
      >
        <div className="form-grid">
          <Field label="Código *">
            <input autoFocus name="code" required maxLength={20} defaultValue={product?.code} />
          </Field>
          <Field label="Categoria *">
            <select name="category" defaultValue={product?.category ?? 'Medicamento'}>
              {productCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Designação *" wide>
            <input name="name" required maxLength={120} defaultValue={product?.name} />
          </Field>
          <Field label="Unidade de medida *">
            <input
              name="measure"
              required
              maxLength={30}
              placeholder="Comprimido, frasco, caixa…"
              defaultValue={product?.measure}
            />
          </Field>
          <Field label="Stock mínimo *">
            <input
              name="minimumStock"
              type="number"
              min={0}
              required
              defaultValue={product?.minimumStock ?? 0}
            />
          </Field>
          <Field label="Stock máximo *">
            <input
              name="maximumStock"
              type="number"
              min={0}
              required
              defaultValue={product?.maximumStock ?? 0}
            />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}

function SupplierForm({ onClose }: { onClose: () => void }) {
  const { run } = useDemo();
  return (
    <Modal title="Novo fornecedor" description="Usado nas entradas de stock." onClose={onClose}>
      <ActionForm
        submitLabel="Registar fornecedor"
        onClose={onClose}
        onSubmit={async (data) =>
          run({
            type: 'supplier.save',
            name: String(data.get('name') ?? ''),
            contact: String(data.get('contact') ?? ''),
          })
        }
      >
        <div className="form-grid">
          <Field label="Nome *" wide>
            <input autoFocus name="name" required minLength={2} maxLength={120} />
          </Field>
          <Field label="Contacto" wide>
            <input name="contact" maxLength={160} />
          </Field>
        </div>
      </ActionForm>
    </Modal>
  );
}
