import { Cabecera, Aviso } from '@/components/ui';
import { SinConfigurar } from '@/components/sin-configurar';
import { MisPartes } from '@/components/tiempos/mis-partes';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { sql, hayConfiguracion } from '@/lib/db';
import { RepositorioTiempos } from '@/lib/tiempos/repositorio';
import { errorSeguroTiempo, filtroTiempo } from '@/lib/tiempos/http';
export const dynamic = 'force-dynamic';
export default async function PaginaMisTiempos() {
  const yo = await exigirSeccion('proyectos');
  if (!hayConfiguracion()) return <SinConfigurar />;
  const r = await new RepositorioTiempos(sql).listar(yo.id, filtroTiempo(new URL('http://localhost/'))).then(datos => ({ datos, error: '' })).catch(e => ({ datos: null, error: errorSeguroTiempo(e).message }));
  return <><Cabecera titulo="Mis tiempos" descripcion="Intervalos de trabajo real · Europe/Madrid" />{r.datos ? <MisPartes inicial={r.datos} /> : <Aviso tono="alerta">{r.error}</Aviso>}</>;
}
