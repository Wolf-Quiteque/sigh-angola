import { ClinicalWorkspace } from '@/features/clinical/clinical';
export const metadata = { title: 'Processo clínico' };
export default async function Page({ params }: { params: Promise<{ episodeId: string }> }) {
  const { episodeId } = await params;
  return <ClinicalWorkspace episodeId={episodeId} />;
}
