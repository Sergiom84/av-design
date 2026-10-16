import { conciliacionCongelada } from '@/lib/costes/conciliacion';
import type { SnapshotCorte } from '@/lib/costes/modelo';
import { FuentesCorte } from './fuentes';
import { ContenedorTabla } from '@/components/ui';
import { importe, Totales } from './comun';
export function ResumenCorte({snapshot}:{snapshot:SnapshotCorte}) {
  const conciliacion=conciliacionCongelada(snapshot);
  return <div className="space-y-4"><p className="font-semibold">{snapshot.tipo} · {snapshot.estado} · {snapshot.alcance.desde} → {snapshot.alcance.hasta} · Madrid</p><Totales totales={snapshot.totales}/><p>{snapshot.cobertura.registrados} registros incluidos · {snapshot.cobertura.pendientes} pendientes · {snapshot.salas.length} salas</p>
    <div className="grid sm:grid-cols-2 gap-3">{Object.entries(snapshot.componentes).map(([nombre,c])=>c&&<div className="border border-linea rounded p-3" key={nombre}><h3 className="font-semibold capitalize">{nombre} · {c.estado}</h3><Totales totales={c.totales}/>{(c.estimados.EUR!==null||c.estimados.USD!==null)&&<div><p>Estimaciones separadas</p><Totales totales={c.estimados}/></div>}<p>{c.incluidos} incluidos · {c.pendientes} pendientes · {c.desactualizados} desactualizados</p>{c.minutos!==null&&<p className="font-mono">{c.minutos} persona-min · {c.minutosPendientes} min pendientes de valoración documentada</p>}</div>)}</div>
    {snapshot.huecos.length>0&&<ul className="list-disc pl-5">{snapshot.huecos.map(h=><li key={h}>{h}</li>)}</ul>}
    {snapshot.comparacion!==undefined&&<ComparacionRegistrada valor={snapshot.comparacion}/>}
    {(snapshot.alcance.componentes.includes('material')&&snapshot.tipo==='real')&&<p>Conciliación material: {conciliacion.cobertura.candidatos} movimientos con residual en el alcance · {conciliacion.cobertura.pendientes} pendientes · {conciliacion.cobertura.excluidos} excluidos con motivo. Las exclusiones no son costes de importe cero.</p>}
    <FuentesCorte key={snapshot.fuentesSha256} snapshot={snapshot}/>
    <p className="text-tinta-tenue">Cobertura de los registros incluidos en el alcance. No acredita que toda la obra esté registrada.</p>
  </div>;
}

function ComparacionRegistrada({valor}:{valor:unknown}) {
  const c=valor as {comparable:boolean;previsto:{EUR:string|null;USD:string|null};real:{EUR:string|null;USD:string|null};diferencias:{EUR:string|null;USD:string|null};nota:string};
  const monedas=(['EUR','USD'] as const).filter(m=>c.previsto[m]!==null||c.real[m]!==null);
  return <div className="space-y-2"><h3 className="font-semibold">Comparación de los registros incluidos</h3><ContenedorTabla etiqueta="Comparación monetaria por divisa"><table className="datos"><thead><tr><th>Moneda</th><th>Previsto</th><th>Real registrado</th><th>Diferencia real − previsto</th></tr></thead><tbody>{monedas.map(m=><tr key={m}><td>{m}</td><td className="font-mono">{importe(c.previsto[m],m)}</td><td className="font-mono">{importe(c.real[m],m)}</td><td className="font-mono">{c.comparable?importe(c.diferencias[m],m):'Sin diferencia comparable'}</td></tr>)}</tbody></table></ContenedorTabla>{monedas.length===0&&<p>Sin importes conocidos para comparar.</p>}<p className="text-tinta-tenue">{c.nota}</p></div>;
}
