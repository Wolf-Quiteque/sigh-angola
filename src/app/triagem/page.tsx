import { ClinicalBoard } from '@/features/clinical/clinical';
export const metadata = { title: 'Triagem' };
export default function Page() {
  return <ClinicalBoard mode="triage" />;
}
