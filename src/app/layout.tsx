import type { Metadata } from 'next';
import { DemoProvider } from '@/lib/demo-provider';
import { Shell } from '@/components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'SIGH-ANGOLA · Visão geral', template: '%s · SIGH-ANGOLA' },
  description: 'Demonstração do Sistema Integrado de Gestão Hospitalar de Angola.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-AO">
      <body>
        <DemoProvider>
          <Shell>{children}</Shell>
        </DemoProvider>
      </body>
    </html>
  );
}
