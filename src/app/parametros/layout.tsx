import { exigirSeccion } from '@/lib/sesion-servidor';
import { SoloLectura } from '@/components/usuarios/solo-lectura';

/**
 * La guarda de la sección, en el layout y no en cada página: así una pantalla
 * nueva dentro de `/parametros` nace protegida sin que nadie se acuerde de
 * protegerla. Quien no llega a `ver` se va al panel.
 *
 * Esto cubre la lectura. El permiso de `editar` lo comprueba cada acción de
 * servidor por su cuenta (exigirEdicion), porque una acción es una dirección
 * pública: no basta con no pintar el botón.
 */
export default async function LayoutParametros({ children }: LayoutProps<'/parametros'>) {
  await exigirSeccion('parametros', 'ver');
  return (
    <>
      <SoloLectura seccion="parametros" />
      {children}
    </>
  );
}
