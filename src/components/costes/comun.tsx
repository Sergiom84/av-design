'use client';
import { cloneElement, isValidElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { formatearDecimal } from '@/lib/importes';
export class FalloCoste extends Error {constructor(m:string,public status:number,public codigo:string){super(m);}}
export async function pedirCostes<T>(url:string,method='GET',body?:unknown):Promise<T> {
  const r=await fetch(url,{method,cache:'no-store',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const v=await r.json();if(!r.ok)throw new FalloCoste(v.error??'No se pudo completar la operación.',r.status,v.codigo??'ERROR');return v as T;
}
export const importe=(minor:string|null|undefined,moneda:string)=>minor===null||minor===undefined?'Sin datos':formatearDecimal(BigInt(minor),2)+' '+moneda;
export function Totales({totales}:{totales:{EUR:string|null;USD:string|null}}) {return <div className="flex flex-wrap gap-5 font-mono"><span>{importe(totales.EUR,'EUR')}</span>{totales.USD!==null&&<span>{importe(totales.USD,'USD')}</span>}</div>;}
export function Campo({etiqueta,children}:{etiqueta:string;children:ReactNode}) {const id=useId();return <div className="flex min-w-0 flex-col gap-1"><label htmlFor={id} className="t-etiqueta">{etiqueta}</label>{isValidElement(children)?cloneElement(children as ReactElement<{id?:string}>,{id}):children}</div>;}
export function useOperacionCoste() {
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(''),[mensaje,setMensaje]=useState('');const turno=useRef(0);
  async function ejecutar(hacer:()=>Promise<void>,mensaje='Operación completada.') {
    const n=++turno.current;setOcupado(true);setError('');setMensaje('');
    try {await hacer();if(n===turno.current)setMensaje(mensaje);}catch(e){if(n===turno.current)setError(e instanceof Error?e.message:'No se pudo completar la operación.');}finally{if(n===turno.current)setOcupado(false);}
  }
  return {ocupado,error,mensaje,ejecutar};
}
export function EstadoOperacion({op}:{op:ReturnType<typeof useOperacionCoste>}) {return <div aria-live="polite" className="mt-3">{op.ocupado&&<p>Consultando…</p>}{op.error&&<p role="alert" className="text-alerta">{op.error} La edición se conserva.</p>}{op.mensaje&&<p role="status">{op.mensaje}</p>}</div>;}
export function Paginacion({pagina,total,cambiar,ocupado}:{pagina:number;total:number;cambiar:(p:number)=>void;ocupado:boolean}) {return <div className="flex flex-wrap gap-3 mt-3 items-center"><button className="boton" disabled={pagina===1||ocupado} onClick={()=>cambiar(pagina-1)}>Anterior</button><span>Página {pagina} · {total} registros</span><button className="boton" disabled={pagina*50>=total||ocupado} onClick={()=>cambiar(pagina+1)}>Siguiente</button></div>;}
