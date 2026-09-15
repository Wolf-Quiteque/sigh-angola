'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import {
  Activity,
  LayoutDashboard,
  Users,
  CalendarDays,
  ListOrdered,
  HeartPulse,
  Stethoscope,
  FlaskConical,
  BedDouble,
  Pill,
  Wallet,
  UsersRound,
  ChartColumn,
  KeyRound,
  ShieldCheck,
  Settings2,
  Route,
  Menu,
  ChevronDown,
  Cross,
  ArrowUpRight,
  HardDrive,
  X,
} from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import { roles, type Role } from '@/domain/schema';
import { Badge } from './ui';
import { downloadJson, STORAGE_KEY } from '@/lib/repository';
const navigation = [
  { href: '/', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/agenda', label: 'Agenda de consultas', icon: CalendarDays },
  { href: '/atendimento', label: 'Fila de atendimento', icon: ListOrdered },
  { href: '/triagem', label: 'Triagem', icon: HeartPulse },
  { href: '/consultas', label: 'Consultas médicas', icon: Stethoscope },
  { href: '/exames', label: 'Laboratório e imagiologia', icon: FlaskConical },
  { href: '/internamento', label: 'Enfermarias e camas', icon: BedDouble },
  { href: '/farmacia', label: 'Farmácia e armazém', icon: Pill },
  { href: '/financas', label: 'Facturação e caixa', icon: Wallet },
  { href: '/recursos-humanos', label: 'Colaboradores', icon: UsersRound },
  { href: '/indicadores', label: 'Indicadores', icon: ChartColumn },
  { href: '/utilizadores', label: 'Utilizadores e permissões', icon: KeyRound },
  { href: '/auditoria', label: 'Registo de actividade', icon: ShieldCheck },
  { href: '/configuracoes', label: 'Configurações', icon: Settings2 },
  { href: '/roteiro', label: 'Roteiro da plataforma', icon: Route },
];
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { db, session, setRole, loading, error, notice, reset } = useDemo();
  const [recoveryError, setRecoveryError] = useState('');
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Saltar para o conteúdo
      </a>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <Link href="/" className="brand-home">
            <span className="brand-mark">
              <Cross size={23} />
            </span>
            <span>
              SIGH<span className="brand-country">ANGOLA</span>
            </span>
          </Link>
          <button
            type="button"
            className="mobile-close icon-button"
            aria-label="Fechar menu"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">ESPAÇO HOSPITALAR</div>
        <nav aria-label="Navegação principal">
          {navigation.map(({ href, label, icon: Icon }) => (
            <div key={href}>
              {href === '/indicadores' && <div className="nav-section">GESTÃO E SISTEMA</div>}
              <Link
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-item ${(href === '/' ? pathname === '/' : pathname.startsWith(href)) ? 'active' : ''}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {href === '/atendimento' && db && (
                  <span className="nav-count">
                    {db.episodes.filter((e) => e.status !== 'Concluído').length}
                  </span>
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="phase-card">
            <span className="phase-icon">
              <Activity size={18} />
            </span>
            <strong>Uma base para cuidar melhor.</strong>
            <p>Construção faseada, centrada nos processos do hospital.</p>
            <Link href="/roteiro">
              Acompanhar o roteiro <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="sidebar-foot">
            <span className="status-dot" />
            Ambiente de demonstração<span>v0.2</span>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-unit">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span className="unit-icon">
              <Cross size={18} />
            </span>
            <div>
              <strong>{db?.unit.name ?? 'SIGH-ANGOLA'}</strong>
              <small>
                {db
                  ? `${db.unit.municipality}, ${db.unit.province}`
                  : 'Gestão hospitalar integrada'}
              </small>
            </div>
          </div>
          <div className="topbar-actions">
            <Badge tone="demo">DEMO</Badge>
            <span className="topbar-divider" />
            <label className="profile-select">
              <span className="profile-avatar">
                {session.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
              <span>
                <strong>{session.name}</strong>
                <select
                  aria-label="Perfil de demonstração"
                  value={session.role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </span>
              <ChevronDown size={14} />
            </label>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {loading ? (
            <div className="loading-state">
              <Activity size={26} />
              <h1>A preparar o seu espaço…</h1>
              <p>A carregar os dados de demonstração.</p>
            </div>
          ) : error ? (
            <div className="error-panel">
              <h1>Não foi possível abrir os dados</h1>
              <p>{error}</p>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => {
                    try {
                      downloadJson(
                        localStorage.getItem(STORAGE_KEY) ?? '{}',
                        'sigh-recuperacao.json',
                      );
                    } catch {
                      setRecoveryError('O navegador bloqueou o acesso ao armazenamento.');
                    }
                  }}
                >
                  Descarregar dados originais
                </button>
                <button
                  className="button primary"
                  onClick={async () => {
                    if (
                      window.confirm(
                        'Repor a demo apaga as alterações locais deste cenário. Continuar?',
                      )
                    ) {
                      try {
                        await reset();
                      } catch (e) {
                        setRecoveryError(String(e));
                      }
                    }
                  }}
                >
                  Repor demonstração
                </button>
              </div>
              {recoveryError && <p role="alert">{recoveryError}</p>}
            </div>
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          <span>
            SIGH-ANGOLA <span>·</span> Informação ao serviço do cuidado
          </span>
          <span>
            <HardDrive size={13} /> Dados fictícios guardados neste navegador
          </span>
        </footer>
      </div>
      <div className={`toast ${notice ? 'visible' : ''}`} role="status">
        {notice && (
          <>
            <ShieldCheck size={18} />
            {notice}
          </>
        )}
      </div>
    </div>
  );
}
