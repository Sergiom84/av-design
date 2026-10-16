import { Cabecera, Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
import { GestionTiempos } from '@/components/tiempos/gestion';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { sql, hayConfiguracion } from '@/lib/db';
import { RepositorioTiempos } from '@/lib/tiempos/repositorio';
import { errorSeguroTiempo, filtroTiempo } from '@/lib/tiempos/http';
export const dynamic = 'force-dynamic';
export default async function PaginaTiemposObra({ params }: { params: Promise<{ id: string }> }) {
  const yo = await exigirSeccion('proyectos', 'editar'), { id } = await params;
  if (!hayConfiguracion()) return <SinConfigurar />;
  const r = await new RepositorioTiempos(sql).listar(yo.id, filtroTiempo(new URL('http://localhost/')), id).then(datos => ({ datos, error: '' })).catch(e => ({ datos: null, error: errorSeguroTiempo(e).message }));
  return <><Cabecera titulo="Gestión de tiempos" descripcion="Partes de técnicos con autor y motivo." />{r.datos ? <GestionTiempos inicial={r.datos} proyectoId={id} /> : <Aviso tono="alerta">{r.error}</Aviso>}</>;
}
