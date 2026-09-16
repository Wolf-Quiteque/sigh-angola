'use client';
import { useMemo } from 'react';
import qrcode from 'qrcode-generator';
import { Printer, QrCode } from 'lucide-react';
import type { Patient } from '@/domain/schema';
import { Modal } from '@/components/ui';
import { age, formatDate } from '@/lib/format';

/**
 * O código contém apenas o identificador do paciente.
 * Nome, data de nascimento e contactos nunca entram no QR.
 */
export function PatientQr({ value, size = 132 }: { value: string; size?: number }) {
  const path = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(value);
    code.make();
    const count = code.getModuleCount();
    let d = '';
    for (let row = 0; row < count; row++)
      for (let column = 0; column < count; column++)
        if (code.isDark(row, column)) d += `M${column} ${row}h1v1h-1z`;
    return { d, count };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={`Código QR com o identificador ${value}`}
      width={size}
      height={size}
      viewBox={`-1 -1 ${path.count + 2} ${path.count + 2}`}
      shapeRendering="crispEdges"
    >
      <rect x={-1} y={-1} width={path.count + 2} height={path.count + 2} fill="#fff" />
      <path d={path.d} fill="#172b36" />
    </svg>
  );
}

export function PatientCard({
  patient,
  unit,
  onClose,
}: {
  patient: Patient;
  unit: { name: string; municipality: string; province: string };
  onClose: () => void;
}) {
  return (
    <Modal
      title="Cartão do paciente"
      description="Imprimível, com um código que contém apenas o identificador."
      onClose={onClose}
    >
      <div className="patient-card" id="patient-card">
        <div className="patient-card-main">
          <div className="patient-card-head">
            <span className="patient-card-brand">
              SIGH<b>ANGOLA</b>
            </span>
            <span>{unit.name}</span>
          </div>
          <strong className="patient-card-name">{patient.name}</strong>
          <dl>
            <div>
              <dt>Nº de paciente</dt>
              <dd>{patient.number}</dd>
            </div>
            <div>
              <dt>Nascimento</dt>
              <dd>
                {formatDate(patient.birthDate)} · {age(patient.birthDate)} anos
              </dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>{patient.sex}</dd>
            </div>
            <div>
              <dt>Município</dt>
              <dd>{patient.municipality}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{patient.guardian || 'Não indicado'}</dd>
            </div>
            <div>
              <dt>Emergência</dt>
              <dd>{patient.emergencyContact || 'Não indicado'}</dd>
            </div>
          </dl>
          <small>
            {unit.municipality}, {unit.province} · apresentar em cada atendimento
          </small>
        </div>
        <div className="patient-card-qr">
          <PatientQr value={patient.number} />
          <small>{patient.number}</small>
        </div>
      </div>
      <div className="info-line">
        <QrCode size={16} />
        <span>
          O código contém apenas <strong>{patient.number}</strong>. Nenhum dado clínico ou de
          contacto é codificado.
        </span>
      </div>
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>
          Fechar
        </button>
        <button type="button" className="button primary" onClick={() => window.print()}>
          <Printer size={17} />
          Imprimir cartão
        </button>
      </div>
    </Modal>
  );
}
