import { ClinicalBoard } from '@/features/clinical/clinical';
export const metadata = { title: 'Consultas médicas' };
export default function Page() {
  return <ClinicalBoard mode="consultation" />;
}
