'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tarjeta } from '@/components/ui';
import type { ClaveTarjeta, GrupoPreferencias, PreferenciasCatalogo, PreferenciasPanel } from '@/lib/preferencias-usuario';
export interface EstadoPreferencias {grupo:GrupoPreferencias;version:number;valor:PreferenciasPanel|PreferenciasCatalogo;opciones?:readonly {clave:ClaveTarjeta;etiqueta:string}[]}
export function EditorPreferencias({grupo,inicial,ficticio=false}:{grupo:GrupoPreferencias;inicial?:EstadoPreferencias;ficticio?:boolean}){
  const router=useRouter();const [estado,setEstado]=useState(inicial);const [valor,setValor]=useState(inicial?.valor);
  const [mensaje,setMensaje]=useState('');const [ocupado,setOcupado]=useState(false);const [comparacion,setComparacion]=useState<EstadoPreferencias>();
  const turno=useRef(0);const bloqueo=useRef(false);
  // La versión confirmada y el borrador pertenecen a esta instancia. Un RSC
  // tardío sólo actualiza qué opciones siguen autorizadas; no adopta valores
  // ni adelanta la versión CAS que la persona está editando.
  const opcionesActuales=inicial?.opciones&&estado?.opciones
    ?inicial.opciones.filter(o=>estado.opciones!.some(s=>s.clave===o.clave))
    :inicial?.opciones??estado?.opciones;
  const permitidas=opcionesActuales?new Set(opcionesActuales.map(o=>o.clave)):null;
  const valorEditable=valor&&'orden'in valor&&permitidas
    ?{orden:valor.orden.filter(k=>permitidas.has(k)),ocultas:valor.ocultas.filter(k=>permitidas.has(k))}
    :valor;
  useEffect(()=>{if(inicial||ficticio)return;const controlador=new AbortController();const actual=++turno.current;
    fetch(`/api/preferencias?grupo=${grupo}`,{cache:'no-store',signal:controlador.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudieron consultar las preferencias.');return d as EstadoPreferencias;}).then(d=>{if(actual===turno.current){setEstado(d);setValor(d.valor);}}).catch(e=>{if(!controlador.signal.aborted&&actual===turno.current)setMensaje(e instanceof Error?e.message:'No se pudieron consultar las preferencias.');});
    return ()=>controlador.abort();
  },[grupo,inicial,ficticio]);
  async function operar(metodo:'PUT'|'DELETE'|'GET'){
    if(bloqueo.current)return;bloqueo.current=true;setOcupado(true);setMensaje('');const actual=++turno.current;
    try{
      const r=await fetch(metodo==='GET'?`/api/preferencias?grupo=${grupo}`:'/api/preferencias',{method:metodo,cache:'no-store',...(metodo==='GET'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({grupo,version:estado?.version,...(metodo==='PUT'?{valor:valorEditable&&'marcas'in valorEditable?{...valorEditable,marcas:valorEditable.marcas.map(m=>m.trim()).filter(Boolean)}:valorEditable}:{})})})});
      const d=await r.json();if(actual!==turno.current)return;
      if(!r.ok)throw new Error(d.error||'No se pudieron guardar las preferencias.');
      if(metodo==='GET'){setComparacion(d);setMensaje('Versión del servidor disponible para comparar. Tu edición sigue en el formulario.');}
      else{setEstado(d);setValor(d.valor);setComparacion(undefined);setMensaje(metodo==='DELETE'?'Preferencias restablecidas.':'Preferencias guardadas.');router.refresh();}
    }catch(e){setMensaje(e instanceof Error?e.message:'Error de red. Tu edición se conserva.');}finally{if(actual===turno.current){bloqueo.current=false;setOcupado(false);}}
  }
  function mover(clave:ClaveTarjeta,delta:number){if(!valorEditable||!('orden'in valorEditable))return;const orden=[...valorEditable.orden];const pos=orden.indexOf(clave);const destino=pos+delta;if(destino<0||destino>=orden.length)return;[orden[pos],orden[destino]]=[orden[destino],orden[pos]];setValor({...valorEditable,orden});}
  const titulo=grupo==='panel'?'Personalizar Panel':'Preferencias de catálogo';
  return <Tarjeta titulo={titulo}>
    {ficticio?<p>Modo de desarrollo. Se muestran los valores predeterminados. Inicia sesión con tu usuario para guardar preferencias personales.</p>:<>
      {!estado&&<p>Cargando preferencias…</p>}
      {estado&&valorEditable&&<form onSubmit={e=>{e.preventDefault();void operar('PUT');}} className="space-y-4">
        <fieldset disabled={ocupado} className="space-y-4 min-w-0">
          {grupo==='catalogo'&&'marcas'in valorEditable?<>
            <p>Consulta personal. No modifica las referencias ni el equipamiento de una sala.</p>
            <label className="block">Marcas preferidas (una por línea, máximo 10)<textarea aria-label="Marcas preferidas" className="block w-full mt-1" rows={4} maxLength={1010} value={valorEditable.marcas.join('\n')} onChange={e=>setValor({...valorEditable,marcas:e.target.value.split('\n')})}/></label>
            <label className="block">Buscar en referencias<input aria-label="Buscar en referencias preferidas" className="block w-full mt-1" maxLength={200} value={valorEditable.q} onChange={e=>setValor({...valorEditable,q:e.target.value})}/></label>
            <label className="block">Tipo<select aria-label="Tipo preferido" className="block mt-1" value={valorEditable.tipo??''} onChange={e=>{const tipo=e.target.value as PreferenciasCatalogo['tipo'];setValor({marcas:valorEditable.marcas,q:valorEditable.q,...(tipo?{tipo}:{})});}}><option value="">Todos</option><option value="equipo">Equipos</option><option value="cable">Cable</option><option value="consumible">Consumibles</option></select></label>
          </>:'orden'in valorEditable?<ol className="space-y-3">{valorEditable.orden.map((k,i)=>{const opcion=opcionesActuales?.find(t=>t.clave===k);if(!opcion)return null;return <li key={k} className="flex flex-wrap items-center gap-2"><label className="flex-1 min-w-40"><input type="checkbox" checked={!valorEditable.ocultas.includes(k)} onChange={e=>setValor({...valorEditable,ocultas:e.target.checked?valorEditable.ocultas.filter(c=>c!==k):[...valorEditable.ocultas,k]})}/> {opcion.etiqueta}</label><button type="button" className="boton" aria-label={`Subir ${opcion.etiqueta}`} disabled={i===0} onClick={()=>mover(k,-1)}>Subir</button><button type="button" className="boton" aria-label={`Bajar ${opcion.etiqueta}`} disabled={i===valorEditable.orden.length-1} onClick={()=>mover(k,1)}>Bajar</button></li>;})}</ol>:null}
          <div className="flex flex-wrap gap-3"><button className="boton boton-principal" type="submit">{ocupado?'Guardando…':'Guardar preferencias'}</button><button className="boton" type="button" onClick={()=>void operar('DELETE')}>Restablecer {grupo==='panel'?'Panel':'catálogo'}</button></div>
        </fieldset>
      </form>}
      <button className="boton mt-4" disabled={ocupado} onClick={()=>void operar('GET')}>Recargar y comparar</button>
      {comparacion&&<div className="mt-4 border border-linea p-3"><p>Versión del servidor: {comparacion.version}</p>{'orden'in comparacion.valor?<ol className="list-decimal ml-5 space-y-2 mt-2">{comparacion.valor.orden.map(clave=>{const p=comparacion.valor as PreferenciasPanel;const opcion=comparacion.opciones?.find(t=>t.clave===clave&&(!permitidas||permitidas.has(clave)));return opcion?<li key={clave}>{opcion.etiqueta} · {p.ocultas.includes(clave)?'Oculta':'Visible'}</li>:null;})}</ol>:<dl className="space-y-2 mt-2 break-words"><div><dt className="font-semibold">Marcas del servidor</dt><dd>{comparacion.valor.marcas.length?comparacion.valor.marcas.join(' · '):'Sin marcas elegidas: catálogo completo'}</dd></div><div><dt className="font-semibold">Búsqueda del servidor</dt><dd>{comparacion.valor.q||'Sin texto de búsqueda'}</dd></div><div><dt className="font-semibold">Tipo del servidor</dt><dd>{comparacion.valor.tipo==='equipo'?'Equipos':comparacion.valor.tipo==='cable'?'Cable':comparacion.valor.tipo==='consumible'?'Consumibles':'Todos'}</dd></div></dl>}<button className="boton mt-2" disabled={ocupado} onClick={()=>{setEstado(comparacion);setValor(comparacion.valor);setComparacion(undefined);setMensaje('Formulario actualizado con la versión del servidor.');}}>Usar versión del servidor</button></div>}
    </>}
    <p role="status" aria-live="polite" className="mt-3">{mensaje}</p>
  </Tarjeta>;
}
