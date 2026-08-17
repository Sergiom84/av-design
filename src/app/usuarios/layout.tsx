import { exigirSeccion } from '@/lib/sesion-servidor';
import { SoloLectura } from '@/components/usuarios/solo-lectura';

/**
 * La guarda de la sección, en el layout y no en cada página: así una pantalla
 * nueva dentro de `/usuarios` nace protegida sin que nadie se acuerde de
 * protegerla.
 */
export default async function LayoutUsuarios({ children }: LayoutProps<'/usuarios'>) {
  await exigirSeccion('usuarios', 'ver');
  return (
    <>
      <SoloLectura seccion="usuarios" />
      {children}
    </>
  );
}
