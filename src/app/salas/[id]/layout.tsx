import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera } from '@/components/ui';
import { PestanasDeSala } from '@/components/sala/pestanas';

export const dynamic = 'force-dynamic';

/**
 * La ficha de sala son cinco pestañas por ruta: Resumen, Equipamiento,
 * Cableado, Logística y ciclo de vida, y Documentos. El layout paga solo la
 * cabecera; cada pestaña carga y calcula lo suyo. Las acciones que tocan la
 * sala revalidan con alcance `layout` para refrescar todas a la vez.
 */
export default async function LayoutSala({
  params,
  children,
}: LayoutProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const sala = await obtenerSalaCabecera(id);
  if (!sala) notFound();

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  return (
    <>
      <Cabecera
        titulo={sala.nombre}
        descripcion={[
          sala.proyecto,
          sala.localizacion,
          sala.sede,
          sala.edificio,
          sala.nivel,
          sala.tipologia,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      <PestanasDeSala salaId={sala.id} />

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
