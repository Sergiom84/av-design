import Link from 'next/link';
import { Aviso, Dato, Tarjeta } from '@/components/ui';
import type { DatosPanel } from '@/lib/panel-repositorio';
export function ResumenPanel({datos}:{datos:DatosPanel}){
  const visible=(clave:string)=>datos.tarjetas.some(t=>t.clave===clave);
  const planificacionVisible=datos.tarjetas.some(t=>'planificacion'in t);
  return <>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" aria-label="Resumen y accesos del Panel">
      {datos.tarjetas.map(t=><div key={t.clave} className="tarjeta p-4" data-tarjeta={t.clave}><Dato etiqueta={t.etiqueta} valor={<Link className="enlace" href={t.href}>{t.valor}</Link>}/></div>)}
    </div>
    {datos.tarjetas.length===0?<p className="mb-6">No hay tarjetas visibles. Puedes mostrarlas desde Personalizar Panel.</p>:<div className="mb-6"><Tarjeta titulo="Pendiente de completar"><div className="space-y-3">{datos.avisos.length?datos.avisos.map((a,i)=><Aviso key={`${a.clave}-${i}`}><Link className="enlace" href={a.href as never}>{a.texto}</Link></Aviso>):<p>Sin pendientes en las tarjetas visibles.</p>}</div></Tarjeta></div>}
    {datos.tarjetas.length>0&&<div className="mb-6"><Tarjeta titulo="Cómo se trabaja"><ol className="list-decimal ml-5 space-y-2">
      {visible('plantillas')&&<li>Rellenas las medidas de cada <Link href="/plantillas" className="enlace">plantilla</Link> una vez.</li>}
      {visible('salas')&&<><li>Creas una <Link href="/salas" className="enlace">sala</Link> con sus medidas reales, colocas los equipos y defines qué conecta con qué.</li><li>La aplicación calcula los metros de cada tirada por su ruta real y devuelve la lista de material.</li></>}
      {(visible('almacen')||visible('reservas'))&&<li>Contra el <Link href="/almacen" className="enlace">almacén</Link> sale qué falta. Lo disponible se reserva para la obra.</li>}
      {visible('pedidos')&&<li>Lo que falta se pide por proveedor en <Link href="/compras" className="enlace">compras</Link>.</li>}
      {visible('cargas')&&<li>La <Link href="/carga" className="enlace">lista de carga</Link> se marca desde el móvil al cargar y se cierra al volver de la obra.</li>}
      {planificacionVisible&&<li>Organizas tareas y técnicos en la <Link href={'/proyectos/agenda?vista=semana' as never} className="enlace">agenda de montaje</Link>. La ocupación muestra intervalos planificados por técnico.</li>}
      {visible('seguimiento_propuestas')&&<li>Consulta las decisiones de cada revisión en <Link href="/propuestas/seguimiento" className="enlace">seguimiento de propuestas</Link>. Elige el ámbito y el período para revisar su embudo y sus fuentes.</li>}
      {!planificacionVisible&&!['plantillas','salas','almacen','reservas','pedidos','cargas','seguimiento_propuestas'].some(visible)&&<li>Consulta las referencias de tus tarjetas de catálogo.</li>}
    </ol></Tarjeta></div>}
  </>;
}
