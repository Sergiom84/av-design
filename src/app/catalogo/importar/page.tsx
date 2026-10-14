import { hayConfiguracion } from '@/lib/db';
import { obtenerSala } from '@/lib/datos';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Cabecera, Enlace } from '@/components/ui';
import { Importador } from '@/components/importacion/importador';

export const dynamic = 'force-dynamic';

export default async function Importacion({ searchParams }: { searchParams: Promise<{ sala?: string }> }) {
  const yo = await exigirSeccion('catalogo');
  if (!hayConfiguracion()) return <SinConfigurar />;
  const puedeCatalogo = puede(yo.permisos, 'catalogo', 'editar');
  const puedeBom = puede(yo.permisos, 'salas', 'editar');
  const { sala: salaId } = await searchParams;
  const completa = salaId && puedeBom && /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(salaId) ? await obtenerSala(salaId) : null;
  return <>
    <Cabecera titulo="Importar catálogo y material" descripcion="Subir, revisar y elegir las filas antes de escribir. Cada confirmación conserva su fuente y un informe reversible." acciones={<Enlace href="/catalogo">Catálogo</Enlace>} />
    {!puedeCatalogo && !(puedeBom && completa) ? <Aviso tono="neutro">No tienes permiso para importar en este destino.</Aviso> : <Importador sala={completa ? { id: completa.sala.id, nombre: completa.sala.nombre } : null} puedeCatalogo={puedeCatalogo} puedeBom={puedeBom} />}
  </>;
}
