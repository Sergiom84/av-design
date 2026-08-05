import type { Metadata } from 'next';
import { Cormorant_Garamond, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navegacion } from '@/components/navegacion';

const titulo = Cormorant_Garamond({
  variable: '--fuente-titulo',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
    <html lang="es" className={`${titulo.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Navegacion />
        <main className="flex-1 w-full max-w-[100rem] mx-auto px-4 sm:px-6 py-8">
          {children}
        </main>
        <footer className="border-t border-linea px-4 sm:px-6 py-4 text-tinta-tenue text-[0.6875rem]">
          Departamento de Audiovisuales · datos de partida: inventario de salas 2026
        </footer>
      </body>
    </html>
  );
}
