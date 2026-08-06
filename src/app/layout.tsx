import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Marco } from '@/components/navegacion';

const ui = Plus_Jakarta_Sans({
  variable: '--fuente-ui',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--fuente-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AV_design · Departamento de Audiovisuales',
  description:
    'Diseño de salas, cálculo de cable y material para instalaciones audiovisuales.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${ui.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Marco>{children}</Marco>
      </body>
    </html>
  );
}
