import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Marco } from '@/components/navegacion';
import { sesionActual } from '@/lib/sesion-servidor';
import { IDS_SECCION, puede, type Seccion } from '@/lib/usuarios';

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

/**
 * Qué secciones se enseñan lo decide el servidor, no el navegador: el menú es
 * un componente de cliente y lo que se le pase viaja al navegador. Se le pasa
 * la lista de lo que esta persona puede abrir, no sus permisos completos ni su
 * rol, porque nada de eso hace falta para pintar diez enlaces.
 *
 * Y esto no protege nada: la guarda es el `layout.tsx` de cada sección. Esto
 * solo evita enseñar puertas cerradas.
 */
export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const usuario = await sesionActual();
  const visibles: Seccion[] = usuario
    ? IDS_SECCION.filter((id) => puede(usuario.permisos, id, 'ver'))
    : [];

  return (
    <html lang="es" className={`${ui.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Marco visibles={visibles} nombre={usuario?.nombre}>
          {children}
        </Marco>
      </body>
    </html>
  );
}
