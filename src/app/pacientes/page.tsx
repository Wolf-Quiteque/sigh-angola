import { Suspense } from 'react';
import { Patients } from '@/features/patients';
export const metadata = { title: 'Pacientes' };
export default function Page() {
  return (
    <Suspense fallback={<p>A carregar pacientes…</p>}>
      <Patients />
    </Suspense>
  );
}
