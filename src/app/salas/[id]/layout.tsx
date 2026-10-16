import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Enlace } from '@/components/ui';
import { PestanasDeSala } from '@/components/sala/pestanas';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';

export const dynamic = 'force-dynamic';

/**
 * La ficha de sala son ocho pestañas por ruta: Resumen, Plano, Diagrama,
 * Acotaciones, Equipamiento, Cableado, Logística y ciclo de vida, y
 * Documentos. El layout paga solo la cabecera; cada pestaña carga y calcula lo
 * suyo. Las acciones que tocan la sala revalidan con alcance `layout` para
 * refrescar todas a la vez.
 *
 * Serán siete cuando Diagrama absorba el flujo de Cableado y esa pestaña se
 * retire.
 */
export default async function LayoutSala({
  params,
  children,
}: LayoutProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const yo = await exigirSeccion('salas', 'ver');
  const sala = await obtenerSalaCabecera(id, puede(yo.permisos, 'proyectos', 'ver'));
  if (!sala) notFound();

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  return (
    <>
      <Cabecera
        titulo={sala.nombre}
        descripcion={[sala.proyecto, sala.localizacion, sala.sede, sala.tipologia]
          .filter(Boolean)
          .join(' · ')}
      />

      <PestanasDeSala salaId={sala.id} />

      {sala.medidas_heredadas && sala.origen_sala_id && (
        <div className="mb-6"><Aviso>
          Medidas heredadas de <Enlace href={`/salas/${sala.origen_sala_id}/documentos`}>la sala original</Enlace>.
          {' '}La copia no acredita una visita de campo.
        </Aviso></div>
      )}

      {sinMedidas && (
        <div className="mb-6">
          <Aviso tono="alerta">
            Faltan las medidas de la sala. Sin largo, ancho y alto no se puede calcular
            ningún metro de cable.
          </Aviso>
        </div>
      )}

      {children}
    </>
  );
}
