'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Cabecera, Tarjeta } from '@/components/ui';
import { TarifasCostes } from './tarifas';
import { ValoracionLaboral } from './valoracion-laboral';
import { ImputacionMaterial } from './imputacion-material';
import { CortesCostes } from './cortes';
import { Campo, EstadoOperacion, pedirCostes, useOperacionCoste } from './comun';
import { ResumenCorte } from './resumen';
import type { SnapshotCorte } from '@/lib/costes/modelo';
export function CostesObra({inicial,periodo}:{inicial:{proyecto:{id:string;nombre:string;codigo:string|null};salas:Array<{id:string;nombre:string}>};periodo:{desde:string;hasta:string}}) {
  const [desde,setDesde]=useState(periodo.desde),[hasta,setHasta]=useState(periodo.hasta),[activo,setActivo]=useState(periodo),[resumen,setResumen]=useState<SnapshotCorte>(),[cambios,setCambios]=useState(0);const op=useOperacionCoste();
  const turno=useRef(0);const proyectoId=inicial.proyecto.id,key=activo.desde+':'+activo.hasta;
  return <div className="space-y-6">
    <Cabecera titulo={'Costes registrados · '+inicial.proyecto.nombre} descripcion="Imputaciones privadas, fuentes y cobertura del alcance registrado." acciones={<Link className="enlace" href={`/proyectos/${proyectoId}`}>Volver a la obra</Link>}/>
    <nav aria-label="Contenido financiero" className="flex flex-wrap gap-4"><a className="enlace" href="#tarifas">Tarifas</a><a className="enlace" href="#laboral">Valoración laboral</a><a className="enlace" href="#material">Conciliación material</a><a className="enlace" href="#cortes">Cortes</a></nav>
    <Tarjeta titulo="Período y alcance"><form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();turno.current++;setActivo({desde,hasta});setResumen(undefined);}}><Campo etiqueta="Desde (Madrid)"><input required type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></Campo><Campo etiqueta="Hasta inclusive (Madrid)"><input required type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></Campo><button className="boton">Aplicar período</button></form><p className="mt-3">{activo.desde} → {activo.hasta} · Todas las salas y registros históricos de esta obra · {cambios} operaciones realizadas en esta vista.</p><button className="boton mt-3" disabled={op.ocupado} onClick={()=>void op.ejecutar(async()=>{const n=++turno.current;const r=await pedirCostes<SnapshotCorte>(`/api/costes/proyectos/${proyectoId}?desde=${activo.desde}&hasta=${activo.hasta}`);if(n===turno.current)setResumen(r);},'Resumen actualizado.')}>Consultar resumen registrado</button>{resumen&&<div className="mt-4"><ResumenCorte snapshot={resumen}/></div>}<EstadoOperacion op={op}/></Tarjeta>
    <div id="tarifas"><TarifasCostes alGuardar={()=>{setCambios(n=>n+1);setResumen(undefined);}}/></div>
    <div id="laboral"><ValoracionLaboral key={key} proyectoId={proyectoId} desde={activo.desde} hasta={activo.hasta} alGuardar={()=>{setCambios(n=>n+1);setResumen(undefined);}}/></div>
    <div id="material"><ImputacionMaterial key={key} proyectoId={proyectoId} salas={inicial.salas} desde={activo.desde} hasta={activo.hasta} alGuardar={()=>{setCambios(n=>n+1);setResumen(undefined);}}/></div>
    <div id="cortes"><CortesCostes key={key} proyectoId={proyectoId} salas={inicial.salas} desde={activo.desde} hasta={activo.hasta}/></div>
  </div>;
}
