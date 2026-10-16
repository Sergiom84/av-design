'use client';
import { useEffect, useRef, useState } from 'react';
import { Campo, pedirCostes } from './comun';
interface Corte {id:string;numero:number;tipo:string}
/** Cada selector navega su propio catálogo de metadatos acotado a cincuenta filas. */
export function SelectorCorte({proyectoId,tipo,value,onChange}:{proyectoId:string;tipo:'real'|'previsto';value:string;onChange:(id:string)=>void}) {
  const [lista,setLista]=useState<{cortes:Corte[];pagina:number;total:number}>(),[error,setError]=useState(''),[ocupado,setOcupado]=useState(false),[seleccionado,setSeleccionado]=useState<Corte>();
  const turno=useRef(0);
  useEffect(()=>{let activo=true;const n=++turno.current;pedirCostes<{cortes:Corte[];pagina:number;total:number}>(`/api/costes/proyectos/${proyectoId}?modo=cortes&tipoCorte=${tipo}&pagina=1`).then(r=>{if(activo&&n===turno.current)setLista(r);}).catch(()=>{if(activo)setError('No se pudieron cargar los cortes.');});return()=>{activo=false;};},[proyectoId,tipo]);
  async function cargar(p:number){const n=++turno.current;setOcupado(true);setError('');try{const r=await pedirCostes<NonNullable<typeof lista>>(`/api/costes/proyectos/${proyectoId}?modo=cortes&tipoCorte=${tipo}&pagina=${p}`);if(n===turno.current)setLista(r);}catch{if(n===turno.current)setError('No se pudieron cargar los cortes.');}finally{if(n===turno.current)setOcupado(false);}}
  const opciones=lista?.cortes??[],fuera=value&&!opciones.some(c=>c.id===value);
  return <div className="min-w-0"><Campo etiqueta={'Corte '+tipo+' de referencia'}><select className="w-full min-w-0 max-w-full" required value={value} onChange={e=>{setSeleccionado(opciones.find(c=>c.id===e.target.value));onChange(e.target.value);}}><option value="">Selecciona corte</option>{fuera&&<option value={value}>{value}{seleccionado?.id===value?' · v'+seleccionado.numero:''} · seleccionado</option>}{opciones.map(c=><option key={c.id} value={c.id}>{c.id} · v{c.numero}</option>)}</select></Campo>{lista&&<div className="flex flex-wrap gap-3 mt-2"><button type="button" className="boton" disabled={ocupado||lista.pagina<=1} onClick={()=>void cargar(lista.pagina-1)}>Anterior {tipo}</button><span>Página {lista.pagina} · {lista.total} cortes {tipo}</span><button type="button" className="boton" disabled={ocupado||lista.pagina*50>=lista.total} onClick={()=>void cargar(lista.pagina+1)}>Siguiente {tipo}</button></div>}{error&&<p role="alert">{error}</p>}</div>;
}
