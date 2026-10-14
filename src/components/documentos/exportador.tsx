'use client';

import { useEffect, useRef, useState } from 'react';
import { DOCUMENTOS, type ArchivoDocumento, type ManifiestoExportacion, type OpcionesPdf, type TipoDocumento } from '@/lib/documentos/modelo';
import { Tarjeta } from '@/components/ui';

interface Props {
  salas: Array<{id:string;nombre:string;codigo:string|null}>;
  proyectoId?:string;
  puedeBom:boolean;
}
export function ExportadorDocumentos({salas,proyectoId,puedeBom}:Props) {
  const [seleccion,setSeleccion]=useState(salas.map(s=>s.id));
  const [documentos,setDocumentos]=useState<TipoDocumento[]>(DOCUMENTOS.filter(d=>puedeBom||!d.id.startsWith('bom-')).map(d=>d.id));
  const [opciones,setOpciones]=useState<OpcionesPdf>({papel:'A4',orientacion:'horizontal',escala:50});
  const [generando,setGenerando]=useState(false);
  const [avance,setAvance]=useState({completados:0,total:0});
  const [archivos,setArchivos]=useState<ArchivoDocumento[]>([]);
  const [actual,setActual]=useState<ManifiestoExportacion|null>(null);
  const [anterior,setAnterior]=useState<ManifiestoExportacion|null>(null);
  const [error,setError]=useState('');
  const generacion=useRef(0);
  const ultimaCompleta=useRef(0);
  const clave=`av-documentos:${proyectoId??salas[0]?.id}`;
  useEffect(()=>{
    let activo=true;
    const generacionRecuperada=generacion.current;
    const completo=sessionStorage.getItem(clave);
    const id=new URLSearchParams(window.location.search).get('paquete')??completo;
    async function recuperar(paqueteId:string,esActual:boolean) {
      const respuesta=await fetch(`/api/documentos/${encodeURIComponent(paqueteId)}`);
      if(!activo)return;
      if(respuesta.ok){
        const m=await respuesta.json() as ManifiestoExportacion;
        if(!activo)return;
        // Una recuperación lenta no sustituye una generación iniciada después.
        if(esActual&&generacion.current===generacionRecuperada)setActual(m);
        // Si la nueva generación falla o es parcial, aún recuperamos el último
        // completo; un completo nuevo siempre tiene precedencia sobre éste.
        if(m.archivos.every(a=>a.estado==='correcto')&&ultimaCompleta.current<=generacionRecuperada)setAnterior(m);
      } else {
        if(paqueteId===sessionStorage.getItem(clave))sessionStorage.removeItem(clave);
        if(esActual&&generacion.current===generacionRecuperada)setError('El paquete ha caducado o ya no está disponible. Genera una revisión nueva.');
      }
    }
    if(id)void recuperar(id,true).catch(()=>{});
    if(completo&&completo!==id)void recuperar(completo,false).catch(()=>{});
    return ()=>{activo=false;};
  },[clave]);

  async function generar() {
    const numeroGeneracion=++generacion.current;
    setGenerando(true);setError('');setArchivos([]);setAvance({completados:0,total:0});
    try {
      const respuesta=await fetch('/api/documentos',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({salaIds:seleccion,proyectoId,documentos,opciones})});
      if(!respuesta.ok){const fallo=await respuesta.json();throw new Error(fallo.error??'No se pudo generar.');}
      const lector=respuesta.body?.getReader();
      if(!lector) throw new Error('No se recibió el progreso de generación.');
      const decoder=new TextDecoder();let pendiente='';let terminado=false;
      const procesar=(linea:string)=>{
        if(!linea.trim())return;
        const evento=JSON.parse(linea);
        if(evento.tipo==='documento'){
          setArchivos(v=>[...v,evento.archivo]);setAvance({completados:evento.completados,total:evento.total});
        } else if(evento.tipo==='fin'){
          const m=evento.manifiesto as ManifiestoExportacion;setActual(m);terminado=true;
          if(m.archivos.every(a=>a.estado==='correcto')){ultimaCompleta.current=numeroGeneracion;setAnterior(m);sessionStorage.setItem(clave,m.id);}
          const url=new URL(window.location.href);url.searchParams.set('paquete',m.id);window.history.replaceState(null,'',url);
        } else if(evento.tipo==='error')throw new Error(evento.error);
      };
      while(true){const {done,value}=await lector.read();if(done)break;pendiente+=decoder.decode(value,{stream:true});
        const lineas=pendiente.split('\n');pendiente=lineas.pop()??'';lineas.forEach(procesar);}
      pendiente+=decoder.decode();procesar(pendiente);
      if(!terminado)throw new Error('La generación se interrumpió. El paquete anterior sigue disponible.');
    } catch(e){setError(e instanceof Error?e.message:'No se pudo generar el paquete.');}
    finally{setGenerando(false);}
  }
  return <div className="space-y-6">
    <Tarjeta titulo="Paquete de obra">
      <div className="space-y-5">
        {proyectoId&&<fieldset disabled={generando}><legend className="font-semibold mb-2">Salas de la obra</legend>
          <div className="grid gap-2 md:grid-cols-2">{salas.map(s=><label key={s.id} className="flex items-center gap-2">
            <input type="checkbox" checked={seleccion.includes(s.id)} onChange={e=>setSeleccion(v=>e.target.checked?[...v,s.id]:v.filter(id=>id!==s.id))}/>
            {s.codigo?`${s.codigo} · `:''}{s.nombre}</label>)}</div></fieldset>}
        <fieldset disabled={generando}><legend className="font-semibold mb-2">Documentos</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{DOCUMENTOS.map(d=><label key={d.id} className="flex items-center gap-2">
            <input type="checkbox" checked={documentos.includes(d.id)} disabled={!puedeBom&&d.id.startsWith('bom-')}
              onChange={e=>setDocumentos(v=>e.target.checked?[...v,d.id]:v.filter(id=>id!==d.id))}/>{d.nombre}</label>)}</div>
          {!puedeBom&&<p className="text-tinta-tenue mt-2">Para exportar material con stock y precios necesitas acceso a Catálogo, Almacén y Compras.</p>}
        </fieldset>
        <fieldset disabled={generando}><legend className="font-semibold mb-2">Formato PDF</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <label>Papel<select className="campo w-full mt-1" value={opciones.papel} onChange={e=>setOpciones(v=>({...v,papel:e.target.value as OpcionesPdf['papel']}))}><option>A4</option><option>A3</option></select></label>
            <label>Orientación<select className="campo w-full mt-1" value={opciones.orientacion} onChange={e=>setOpciones(v=>({...v,orientacion:e.target.value as OpcionesPdf['orientacion']}))}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
            <label>Escala de plano y elevaciones<select className="campo w-full mt-1" value={opciones.escala} onChange={e=>setOpciones(v=>({...v,escala:Number(e.target.value) as OpcionesPdf['escala']}))}>{[20,25,50,100].map(n=><option key={n} value={n}>1:{n}</option>)}</select></label>
          </div><p className="text-tinta-tenue mt-2">Imprime al 100 %. Los planos grandes se reparten en páginas conservando la escala. El esquema lógico va sin escala.</p>
        </fieldset>
        <button className="boton boton-principal" disabled={generando||seleccion.length===0||seleccion.length>20||documentos.length===0} onClick={generar}>{generando?'Generando documentos…':'Generar paquete'}</button>
        {seleccion.length>20&&<p role="alert">Selecciona como máximo 20 salas por paquete.</p>}
        {generando&&<div role="status" aria-live="polite"><p>{avance.total?`${avance.completados} de ${avance.total} documentos`:'Leyendo los datos de la selección…'}</p><progress className="w-full" value={avance.completados} max={avance.total||1}/></div>}
        {error&&<p role="alert" className="text-alerta">{error}</p>}
        {generando&&archivos.map(a=><p key={a.nombre} className={a.estado==='error'?'text-alerta':'text-tinta-tenue'}>{a.nombre}: {a.estado==='correcto'?'generado':a.error}</p>)}
      </div>
    </Tarjeta>
    {actual&&<ResultadoPaquete manifiesto={actual}/>}
    {anterior&&anterior.id!==actual?.id&&<Tarjeta titulo="Último paquete completo"><p className="font-mono text-sm mb-2">{anterior.revision}</p><a className="boton" href={descarga(anterior.id,'paquete.zip')}>Descargar paquete anterior</a></Tarjeta>}
  </div>;
}
function descarga(id:string,nombre:string){return `/api/documentos/${encodeURIComponent(id)}/descarga?archivo=${encodeURIComponent(nombre)}`;}
function ResultadoPaquete({manifiesto:m}:{manifiesto:ManifiestoExportacion}) {
  const validos=m.archivos.filter(a=>a.estado==='correcto');
  const errores=m.archivos.length-validos.length;
  return <Tarjeta titulo={errores?'Paquete parcial':'Paquete disponible'}>
    <p className="font-mono text-sm break-all">{m.revision}</p>
    <p className="text-tinta-tenue mb-4">Generado {new Date(m.creadoEn).toLocaleString('es-ES')}. Descargas disponibles hasta {new Date(m.caducaEn).toLocaleTimeString('es-ES')}.</p>
    {errores>0&&<p role="alert" className="text-alerta mb-3">{errores} documento(s) con error. Puedes descargar los {validos.length} documentos válidos.</p>}
    <div className="flex flex-wrap gap-2 mb-4"><a className="boton boton-principal" href={descarga(m.id,'paquete.zip')}>Descargar ZIP{errores?' parcial':''}</a><a className="boton" href={descarga(m.id,'manifiesto.json')}>Manifiesto</a></div>
    <ul className="divide-y divide-linea-suave">{m.archivos.map(a=><li key={a.nombre} className="py-2 break-all">{a.estado==='correcto'?<a className="text-acento underline" href={descarga(m.id,a.nombre)}>{a.nombre}</a>:<span className="text-alerta">{a.error}</span>}</li>)}</ul>
  </Tarjeta>;
}
