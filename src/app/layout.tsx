import type { Metadata } from 'next';
import { DemoProvider } from '@/lib/demo-provider';
import { Shell } from '@/components/shell';
import { OfflineWatcher } from '@/components/offline';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'SIGH-ANGOLA · Visão geral', template: '%s · SIGH-ANGOLA' },
  description: 'Sistema Integrado de Gestão Hospitalar de Angola.',
  manifest: '/manifest.webmanifest',
  applicationName: 'SIGH-ANGOLA',
};
export const viewport = { themeColor: '#167d8b' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO">
      <body>
        <DemoProvider>
          <OfflineWatcher />
          <Shell>{children}</Shell>
        </DemoProvider>
      </body>
    </html>
  );
}
