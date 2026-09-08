'use client';
import { useState } from 'react';
import {
  Download,
  RotateCcw,
  HardDrive,
  ShieldCheck,
  Check,
  ArrowRight,
  LockKeyhole,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { downloadJson } from '@/lib/repository';
import {
  PageHeader,
  Panel,
  SearchInput,
  Badge,
  Empty,
  Modal,
  ActionForm,
  Field,
} from '@/components/ui';
import { formatDate, normalize, today } from '@/lib/format';

export function Audit() {
  const { db } = useDemo();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  if (!db) return null;
  const events = db.audit.filter((e) =>
    normalize(`${e.actor} ${e.action} ${e.detail}`).includes(normalize(search)),
  );
  const pages = Math.max(1, Math.ceil(events.length / 20));
  const currentPage = Math.min(page, pages);
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO E SISTEMA"
        title="Registo de actividade"
        description="Consulte quem realizou cada operação e quando aconteceu."
      />
      <Panel>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Pesquisar operação, utilizador ou paciente"
          />
          <Badge>{events.length} eventos</Badge>
        </div>
        {events.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Operação</th>
                  <th>Utilizador</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {events.slice((currentPage - 1) * 20, currentPage * 20).map((e) => (
                  <tr key={e.id}>
                    <td className="nowrap">{formatDate(e.at, true)}</td>
                    <td>
                      <span className="audit-action">
                        <ShieldCheck size={15} />
                        {e.action}
                      </span>
                    </td>
                    <td>{e.actor}</td>
                    <td>{e.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma actividade encontrada"
            description="Altere a pesquisa para consultar outros eventos."
          />
        )}
        <div className="pagination">
          <span>Histórico de operações locais</span>
          <div>
            <button
              className="button small secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span>
              {currentPage} / {pages}
            </span>
            <button
              className="button small secondary"
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Seguinte
            </button>
          </div>
        </div>
      </Panel>
      <p className="form-hint">
        Na demo, o registo de actividade é local e pode ser reposto com o cenário. Não constitui uma
        auditoria de produção.
      </p>
    </>
  );
}
export function Settings() {
  const { db, session, reset } = useDemo();
  const [confirm, setConfirm] = useState(false);
  if (!db) return null;
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO E SISTEMA"
        title="Configurações"
        description="Contexto da unidade e ferramentas para explorar a demonstração."
      />
      <div className="settings-grid">
        <Panel title="Unidade sanitária" subtitle="Contexto partilhado por todos os registos.">
          <dl className="demographics">
            <div>
              <dt>Unidade</dt>
              <dd>{db.unit.name}</dd>
            </div>
            <div>
              <dt>Localização</dt>
              <dd>
                {db.unit.municipality}, {db.unit.province}
              </dd>
            </div>
            <div>
              <dt>Idioma</dt>
              <dd>Português de Angola · pt-AO</dd>
            </div>
            <div>
              <dt>Fuso horário</dt>
              <dd>Africa/Luanda · UTC+1</dd>
            </div>
            <div>
              <dt>Moeda prevista</dt>
              <dd>Kwanza · AOA</dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Perfis de demonstração" subtitle="Altere o perfil no canto superior direito.">
          <div className="permission-list">
            {[
              ['Administrador', 'Consultar, registar, editar e repor o cenário.'],
              ['Recepcionista', 'Consultar, registar pacientes e gerir a recepção.'],
              ['Direcção', 'Consultar dados e indicadores, sem alterações.'],
            ].map(([role, desc]) => (
              <div key={role}>
                <LockKeyhole size={18} />
                <div>
                  <strong>{role}</strong>
                  <p>{desc}</p>
                </div>
                {session.role === role && <Badge tone="success">Activo</Badge>}
              </div>
            ))}
          </div>
          <div className="info-line">
            A selecção de perfil simula permissões. Não é uma autenticação real.
          </div>
        </Panel>
        <Panel
          title="Dados da demonstração"
          subtitle="Persistência neste navegador, sem ligação a APIs."
        >
          <div className="setting-action">
            <span className="quick-icon">
              <HardDrive size={21} />
            </span>
            <div>
              <strong>Dados guardados localmente</strong>
              <p>
                {db.patients.length} pacientes · {db.appointments.length} marcações · revisão{' '}
                {db.revision}
              </p>
            </div>
            <Badge tone="success">Local</Badge>
          </div>
          <div className="setting-action">
            <span className="quick-icon">
              <Download size={21} />
            </span>
            <div>
              <strong>Exportar cenário em JSON</strong>
              <p>Descarregar uma cópia dos dados fictícios e da actividade.</p>
            </div>
            <button
              className="button secondary"
              onClick={() => downloadJson(JSON.stringify(db, null, 2), `sigh-demo-${today()}.json`)}
            >
              Exportar JSON
            </button>
          </div>
          <div className="info-line">
            Reabrir a aplicação totalmente sem rede e restaurar exportações serão tratados na fase
            8.
          </div>
        </Panel>
        <Panel title="Repor o cenário" subtitle="Voltar aos dados fictícios iniciais do projecto.">
          <div className="reset-content">
            <RotateCcw size={26} />
            <p>
              Esta acção remove as alterações feitas na demo neste navegador e volta a carregar o
              JSON inicial, com as marcações relativas a hoje.
            </p>
            <button
              className="button danger-button"
              disabled={session.role !== 'Administrador'}
              onClick={() => setConfirm(true)}
            >
              Repor dados de demonstração
            </button>
            {session.role !== 'Administrador' && (
              <small>Apenas disponível para o administrador.</small>
            )}
          </div>
        </Panel>
      </div>
      {confirm && (
        <Modal
          title="Repor dados de demonstração?"
          description="As alterações locais serão removidas. Exporte o JSON primeiro se quiser guardar uma cópia."
          onClose={() => setConfirm(false)}
        >
          <ActionForm
            onClose={() => setConfirm(false)}
            submitLabel="Repor cenário"
            onSubmit={async (data) => {
              if (data.get('confirmation') !== 'REPOR')
                throw new Error('Escreva REPOR para confirmar.');
              await reset();
            }}
          >
            <Field label="Escreva REPOR para confirmar">
              <input autoFocus name="confirmation" required autoComplete="off" />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
const phases = [
  {
    title: 'Planeamento e arquitectura',
    status: 'Concluída',
    text: 'Leitura dos requisitos, arquitectura modular, modelo de dados e critérios de aceitação.',
    items: ['Requisitos mapeados', 'Dados JSON', 'Sistema visual'],
  },
  {
    title: 'Fundação, recepção e agenda',
    status: 'Disponível',
    text: 'Da identificação do paciente à marcação e chegada, com dados partilhados e actividade registada.',
    items: ['Pacientes e fichas', 'Agenda e admissões', 'Persistência local'],
  },
  {
    title: 'Triagem e processo clínico',
    status: 'Próxima fase',
    text: 'Sinais vitais, prioridade atribuída pelo profissional, consulta, diagnóstico e prescrição.',
    items: ['Triagem', 'Consulta', 'Processo longitudinal'],
  },
  {
    title: 'Laboratório e imagiologia',
    status: 'Planeada',
    text: 'Pedidos, colheita, realização, resultados e validação, ligados ao processo clínico.',
    items: ['Pedidos de exames', 'Resultados', 'Validação'],
  },
  {
    title: 'Internamento e enfermagem',
    status: 'Planeada',
    text: 'Admissão em enfermaria, camas, evolução, transferência, procedimentos e alta.',
    items: ['Camas e enfermarias', 'Cuidados', 'Alta e transferência'],
  },
  {
    title: 'Farmácia e armazém',
    status: 'Planeada',
    text: 'Dispensação ligada à prescrição, lotes, validades, inventário e movimentos de stock.',
    items: ['Dispensação', 'Lotes e validades', 'Fornecedores'],
  },
  {
    title: 'Finanças e recursos humanos',
    status: 'Planeada',
    text: 'Facturação demo em kwanzas, pagamentos, caixa, colaboradores, escalas e ausências.',
    items: ['Caixa e facturação', 'Convênios', 'Equipa e escalas'],
  },
  {
    title: 'Administração e estatística',
    status: 'Planeada',
    text: 'Perfis completos, cartão de paciente, indicadores e relatórios da unidade ao nível nacional.',
    items: ['Permissões', 'Indicadores', 'Agregação territorial'],
  },
  {
    title: 'Offline e sincronização simulada',
    status: 'Planeada',
    text: 'Abertura sem rede, armazenamento robusto, fila de envio simulada, conflitos e recuperação.',
    items: ['IndexedDB e cache', 'Simulação de conflitos', 'Backup e restauro'],
  },
  {
    title: 'Validação integral da demo',
    status: 'Planeada',
    text: 'Percursos completos, acessibilidade, tablets, erros e consistência entre todos os módulos.',
    items: ['Testes de ponta a ponta', 'Revisão por perfil', 'Aceitação da demo'],
  },
];
export function Roadmap() {
  return (
    <>
      <PageHeader
        eyebrow="CONSTRUÇÃO FASEADA"
        title="Roteiro da plataforma"
        description="Uma visão completa. Uma fase de cada vez, com processos que funcionam."
      />
      <div className="roadmap-intro">
        <div>
          <Badge tone="success">EM EXECUÇÃO · FASE 1</Badge>
          <h2>Começar por uma fundação sólida.</h2>
          <p>
            A demo evolui a partir dos requisitos do SIGH-ANGOLA. Cada fase liga novos processos aos
            mesmos dados de pacientes e episódios.
          </p>
        </div>
        <div className="roadmap-summary">
          <strong>10</strong>
          <span>fases definidas</span>
          <small>0 a 9 · do planeamento à validação</small>
        </div>
      </div>
      <div className="phase-list">
        {phases.map((phase, i) => (
          <Panel className={i === 1 ? 'current-phase' : ''} key={phase.title}>
            <div className="phase-row">
              <span className={`phase-number ${i < 2 ? 'done' : ''}`}>
                {i === 0 ? <Check size={22} /> : String(i).padStart(2, '0')}
              </span>
              <div className="phase-content">
                <div className="phase-title">
                  <h2>{phase.title}</h2>
                  <Badge tone={i < 2 ? 'success' : i === 2 ? 'info' : ''}>{phase.status}</Badge>
                </div>
                <p>{phase.text}</p>
                <div className="phase-tags">
                  {phase.items.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              {i === 2 && <ArrowRight className="muted" size={22} />}
            </div>
          </Panel>
        ))}
      </div>
      <div className="info-line spaced">
        <ShieldCheck size={19} />
        <span>
          Integrações reais, segurança de produção e validação clínica serão um projecto posterior à
          demonstração.
        </span>
      </div>
    </>
  );
}
