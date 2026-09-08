import { PatientDetail } from '@/features/patients';
export const metadata = { title: 'Ficha do paciente' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientDetail id={id} />;
}
