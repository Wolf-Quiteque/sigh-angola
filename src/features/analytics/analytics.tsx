'use client';
import { useState } from 'react';
import { Building2, Download, Gauge, Globe2, Landmark, MapPin, ShieldAlert } from 'lucide-react';
import { useDemo } from '@/lib/demo-provider';
import {
  computeIndicators,
  consultationsBySpecialty,
  dataQuality,
  patientsByMunicipality,
  type Indicator,
} from '@/domain/indicators';
import { Badge, Empty, PageHeader, Panel } from '@/components/ui';
import { dayOffset, formatDate, today } from '@/lib/format';
import { downloadJson } from '@/lib/repository';

type Level = 'unidade' | 'municipio' | 'provincia' | 'nacional';
const levelLabel: Record<Level, string> = {
  unidade: 'Unidade',
  municipio: 'Município',
  provincia: 'Província',
  nacional: 'Nacional',
};
const levelIcon: Record<Level, React.ReactNode> = {
  unidade: <Building2 size={16} />,
  municipio: <MapPin size={16} />,
  provincia: <Landmark size={16} />,
  nacional: <Globe2 size={16} />,
};
const show = (indicator: Indicator) =>
  indicator.value.toFixed(indicator.decimals ?? 0) + (indicator.suffix ?? '');

export function AnalyticsBoard() {
  const { db, session } = useDemo();
  const [start, setStart] = useState(dayOffset(-30));
  const [end, setEnd] = useState(today());
  const [level, setLevel] = useState<Level>('unidade');
  if (!db) return null;
  const range = { start, end };
  const indicators = computeIndicators(db, range);
  const bySpecialty = consultationsBySpecialty(db, range);
  const byMunicipality = patientsByMunicipality(db);
  const quality = dataQuality(db, today());
  // A rede agregada não contém processos individuais: só totais por unidade.
  const network = db.network.filter((unit) =>
    level === 'municipio'
      ? unit.municipality === db.unit.municipality
      : level === 'provincia'
        ? unit.province === db.unit.province
        : level === 'nacional',
  );
  const localSummary = {
    id: db.unit.id,
    name: db.unit.name,
    municipality: db.unit.municipality,
    province: db.unit.province,
    consultations: indicators.find((i) => i.key === 'consultations')!.value,
    emergencies: indicators.find((i) => i.key === 'emergencies')!.value,
    admissions: indicators.find((i) => i.key === 'admissions')!.value,
    discharges: indicators.find((i) => i.key === 'discharges')!.value,
    deaths: indicators.find((i) => i.key === 'deaths')!.value,
    births: indicators.find((i) => i.key === 'births')!.value,
    surgeries: indicators.find((i) => i.key === 'surgeries')!.value,
    exams: indicators.find((i) => i.key === 'exams')!.value,
    beds: db.beds.filter((b) => ['Livre', 'Ocupada'].includes(b.status)).length,
    occupiedBeds: db.beds.filter((b) => b.status === 'Ocupada').length,
  };
  const rows = level === 'unidade' ? [localSummary] : [localSummary, ...network];
  const totals = rows.reduce(
    (sum, unit) => ({
      consultations: sum.consultations + unit.consultations,
      emergencies: sum.emergencies + unit.emergencies,
      admissions: sum.admissions + unit.admissions,
      discharges: sum.discharges + unit.discharges,
      deaths: sum.deaths + unit.deaths,
      births: sum.births + unit.births,
      surgeries: sum.surgeries + unit.surgeries,
      exams: sum.exams + unit.exams,
      beds: sum.beds + unit.beds,
      occupiedBeds: sum.occupiedBeds + unit.occupiedBeds,
    }),
    {
      consultations: 0,
      emergencies: 0,
      admissions: 0,
      discharges: 0,
      deaths: 0,
      births: 0,
      surgeries: 0,
      exams: 0,
      beds: 0,
      occupiedBeds: 0,
    },
  );
  function exportReport() {
    downloadJson(
      JSON.stringify(
        {
          unidade: db!.unit,
          intervalo: range,
          nivel: levelLabel[level],
          geradoEm: new Date().toISOString(),
          geradoPor: `${session.name} (${session.role})`,
          indicadores: indicators.map((i) => ({
            indicador: i.label,
            valor: Number(i.value.toFixed(i.decimals ?? 0)),
            unidade: i.suffix?.trim() ?? '',
            definicao: i.definition,
          })),
          consultasPorEspecialidade: bySpecialty,
          pacientesPorMunicipio: byMunicipality,
          agregacao: { linhas: rows, totais: totals },
          qualidadeDeDados: quality,
          nota: 'Relatório de demonstração com dados fictícios. Não substitui informação oficial.',
        },
        null,
        2,
      ),
      `sigh-indicadores-${today()}.json`,
    );
  }
  return (
    <>
      <PageHeader
        eyebrow="ESTATÍSTICA E GESTÃO"
        title="Indicadores hospitalares"
        description="Números calculados dos registos da demonstração, com o denominador de cada um à vista."
      >
        <button className="button secondary" onClick={exportReport}>
          <Download size={17} />
          Exportar relatório
        </button>
      </PageHeader>
      <Panel title="Intervalo e nível" subtitle="Os indicadores recalculam com estes filtros.">
        <div className="toolbar">
          <label className="filter-select">
            <span>De</span>
            <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="filter-select">
            <span>Até</span>
            <input
              type="date"
              value={end}
              min={start}
              max={today()}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <Badge tone="info">
            {formatDate(start)} a {formatDate(end)}
          </Badge>
        </div>
        <div className="segmented" role="tablist" aria-label="Nível de agregação">
          {(['unidade', 'municipio', 'provincia', 'nacional'] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={level === l}
              className={level === l ? 'active' : ''}
              onClick={() => setLevel(l)}
            >
              {levelIcon[l]}
              {levelLabel[l]}
            </button>
          ))}
        </div>
      </Panel>
      <Panel
        title="Indicadores da unidade"
        subtitle="Cada número indica o que conta e sobre que denominador."
      >
        <div className="indicator-grid">
          {indicators.map((indicator) => (
            <div className="indicator-card" key={indicator.key}>
              <span>{indicator.label}</span>
              <strong>{show(indicator)}</strong>
              <small>{indicator.definition}</small>
            </div>
          ))}
        </div>
      </Panel>
      <div className="analytics-grid">
        <Panel
          title="Consultas por especialidade"
          subtitle={`${bySpecialty.reduce((s, r) => s + r.count, 0)} consulta(s) no intervalo.`}
        >
          {bySpecialty.length ? (
            <div className="bar-list">
              {bySpecialty.map((row) => (
                <div key={row.specialty}>
                  <span>{row.specialty}</span>
                  <div
                    className="bar"
                    style={{
                      width:
                        Math.max(
                          6,
                          (row.count / Math.max(...bySpecialty.map((r) => r.count))) * 100,
                        ) + '%',
                    }}
                  />
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Sem consultas no intervalo"
              description="Alargue as datas para ver a produção clínica."
            />
          )}
        </Panel>
        <Panel
          title="Pacientes por município de residência"
          subtitle="Base de pacientes registada na unidade."
        >
          <div className="bar-list">
            {byMunicipality.map((row) => (
              <div key={row.municipality}>
                <span>{row.municipality}</span>
                <div
                  className="bar"
                  style={{
                    width:
                      Math.max(
                        6,
                        (row.count / Math.max(...byMunicipality.map((r) => r.count))) * 100,
                      ) + '%',
                  }}
                />
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title={`Agregação ao nível ${levelLabel[level].toLowerCase()}`}
        subtitle="Totais por unidade, sem acesso a processos individuais de outras unidades."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Território</th>
                <th>Consultas</th>
                <th>Urgências</th>
                <th>Internamentos</th>
                <th>Altas</th>
                <th>Óbitos</th>
                <th>Ocupação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((unit) => (
                <tr key={unit.id}>
                  <td>
                    <strong className="table-primary">{unit.name}</strong>
                    <small className="muted">
                      {unit.id === db.unit.id
                        ? 'Unidade local · dados reais da demo'
                        : 'Resumo agregado'}
                    </small>
                  </td>
                  <td>
                    {unit.municipality}
                    <small className="muted">{unit.province}</small>
                  </td>
                  <td>{unit.consultations}</td>
                  <td>{unit.emergencies}</td>
                  <td>{unit.admissions}</td>
                  <td>{unit.discharges}</td>
                  <td>{unit.deaths}</td>
                  <td>
                    {unit.beds ? Math.round((unit.occupiedBeds / unit.beds) * 100) : 0}%
                    <small className="muted">
                      {unit.occupiedBeds}/{unit.beds} camas
                    </small>
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}>
                  <strong>Total {levelLabel[level].toLowerCase()}</strong>
                </td>
                <td>{totals.consultations}</td>
                <td>{totals.emergencies}</td>
                <td>{totals.admissions}</td>
                <td>{totals.discharges}</td>
                <td>{totals.deaths}</td>
                <td>
                  {totals.beds ? Math.round((totals.occupiedBeds / totals.beds) * 100) : 0}%
                  <small className="muted">
                    {totals.occupiedBeds}/{totals.beds} camas
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="info-line">
          <Gauge size={16} />
          <span>
            Só a unidade local tem processos nesta demonstração. As restantes linhas são resumos de
            unidades fictícias, usados para mostrar a agregação território a território.
          </span>
        </div>
      </Panel>
      <Panel title="Qualidade dos dados" subtitle="O que falta preencher ou concluir nos registos.">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Verificação</th>
                <th>Ocorrências</th>
                <th>Denominador</th>
                <th>Porquê</th>
              </tr>
            </thead>
            <tbody>
              {quality.map((check) => (
                <tr key={check.key}>
                  <td>
                    <strong className="table-primary">{check.label}</strong>
                  </td>
                  <td>
                    <Badge tone={check.value === 0 ? 'success' : 'warning'}>{check.value}</Badge>
                  </td>
                  <td>
                    {check.total} registo(s)
                    <small className="muted">
                      {check.total ? Math.round((check.value / check.total) * 100) : 0}% do total
                    </small>
                  </td>
                  <td>{check.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="info-line spaced">
        <ShieldAlert size={19} />
        <span>
          Os relatórios exportados contêm dados fictícios e destinam-se a demonstrar o formato, não
          a informar decisões de saúde.
        </span>
      </div>
    </>
  );
}
