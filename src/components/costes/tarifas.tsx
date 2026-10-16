'use client';
import { useRef, useState } from 'react';
import { Tarjeta, ContenedorTabla } from '@/components/ui';
import type { EntradaTarifa, TarifaCoste } from '@/lib/costes/modelo';
import { Campo, EstadoOperacion, pedirCostes, Paginacion, useOperacionCoste } from './comun';
const vacia:Omit<EntradaTarifa,'tecnicoId'>={desde:'',hastaExclusivo:null,precioHora:'',moneda:'EUR',calidad:'estimada',fuente:'',motivo:'',accion:'definir'};
export function TarifasCostes({alGuardar}:{alGuardar:()=>void}) {
  const [draft,setDraft]=useState({...vacia,tecnicoId:''}),[q,setQ]=useState(''),[tecnicos,setTecnicos]=useState<Array<{id:string;nombre:string;activo:boolean}>>([]),[tarifas,setTarifas]=useState<TarifaCoste[]>([]),[historia,setHistoria]=useState<TarifaCoste[]>([]),[pagina,setPagina]=useState(1),[total,setTotal]=useState(0),[preview,setPreview]=useState(false);
  const turno=useRef(0),edicion=useRef(0),clave=useRef(crypto.randomUUID()),op=useOperacionCoste();
  function cambiar<K extends keyof EntradaTarifa>(k:K,v:EntradaTarifa[K]){edicion.current++;clave.current=crypto.randomUUID();setPreview(false);setDraft(d=>({...d,[k]:v}));}
  async function cargar(p=1){const n=++turno.current;const r=await pedirCostes<{tarifas:TarifaCoste[];total:number}>(`/api/costes/tarifas?pagina=${p}`);if(n===turno.current){setTarifas(r.tarifas);setTotal(r.total);setPagina(p);}}
  function editar(t:TarifaCoste){edicion.current++;setPreview(false);clave.current=crypto.randomUUID();setDraft({tecnicoId:t.tecnicoId,desde:t.desde,hastaExclusivo:t.hastaExclusivo,precioHora:t.precioHora,moneda:t.moneda,calidad:t.calidad,fuente:t.fuente,motivo:'',accion:'corregir',serieId:t.serieId,numeroActual:t.numero,actualId:t.id});setTecnicos(a=>a.some(v=>v.id===t.tecnicoId)?a:[...a,{id:t.tecnicoId,nombre:'Técnico '+t.tecnicoId,activo:true}]);}
  return <Tarjeta titulo="Tarifas de imputación" pie="La vigencia termina en la fecha exclusiva. Los cambios conservan las valoraciones anteriores.">
    <div className="flex flex-wrap gap-3 mb-4"><button className="boton" disabled={op.ocupado} onClick={()=>void op.ejecutar(()=>cargar(),'Tarifas actualizadas.')}>Cargar tarifas</button><button className="boton" onClick={()=>{edicion.current++;setDraft({...vacia,tecnicoId:''});setPreview(false);clave.current=crypto.randomUUID();}}>Nueva tarifa</button></div>
    <div className="flex flex-wrap gap-3 mb-3 items-end"><Campo etiqueta="Buscar técnico para tarifa"><input value={q} onChange={e=>{turno.current++;setQ(e.target.value);}} maxLength={120}/></Campo><button className="boton" disabled={op.ocupado} onClick={()=>void op.ejecutar(async()=>{const n=++turno.current;const r=await pedirCostes<{tecnicos:typeof tecnicos}>('/api/costes/tecnicos?q='+encodeURIComponent(q));if(n===turno.current)setTecnicos(r.tecnicos);},'Técnicos encontrados. Máximo veinte.')}>Buscar técnicos</button></div>
    <form onSubmit={e=>{e.preventDefault();const n=edicion.current;void op.ejecutar(async()=>{await pedirCostes('/api/costes/tarifas/preparar','POST',draft);if(n===edicion.current)setPreview(true);},'Vigencia revisada. Confirma la tarifa.');}}>
      <div className="grid md:grid-cols-3 gap-3">
        <Campo etiqueta="Técnico de la tarifa"><select required value={draft.tecnicoId} disabled={!!draft.serieId} onChange={e=>cambiar('tecnicoId',e.target.value)}><option value="">Selecciona técnico</option>{tecnicos.map(t=><option key={t.id} value={t.id}>{t.nombre}{t.activo?'':' · inactivo'}</option>)}</select></Campo>
        <Campo etiqueta="Vigente desde"><input type="date" required value={draft.desde} onChange={e=>cambiar('desde',e.target.value)}/></Campo>
        <Campo etiqueta="Hasta exclusivo"><input type="date" value={draft.hastaExclusivo??''} onChange={e=>cambiar('hastaExclusivo',e.target.value||null)}/></Campo>
        <Campo etiqueta="Importe por hora"><input inputMode="decimal" required value={draft.precioHora} onChange={e=>cambiar('precioHora',e.target.value.replace(',','.'))}/></Campo>
        <Campo etiqueta="Moneda de tarifa"><select value={draft.moneda} onChange={e=>cambiar('moneda',e.target.value as 'EUR'|'USD')}><option>EUR</option><option>USD</option></select></Campo>
        <Campo etiqueta="Calidad de tarifa"><select value={draft.calidad} onChange={e=>cambiar('calidad',e.target.value as EntradaTarifa['calidad'])}><option value="estimada">Estimada</option><option value="validada">Validada</option></select></Campo>
        <Campo etiqueta="Fuente de tarifa"><input required maxLength={1000} value={draft.fuente} onChange={e=>cambiar('fuente',e.target.value)}/></Campo>
        <Campo etiqueta="Motivo de tarifa"><input required maxLength={2000} value={draft.motivo} onChange={e=>cambiar('motivo',e.target.value)}/></Campo>
        {draft.serieId&&<Campo etiqueta="Acción sobre tarifa"><select value={draft.accion} onChange={e=>cambiar('accion',e.target.value as EntradaTarifa['accion'])}><option value="corregir">Corregir</option><option value="anular">Anular</option></select></Campo>}
      </div>
      <button className="boton mt-3" disabled={op.ocupado}>Revisar tarifa</button>
      {preview&&<button type="button" className="boton boton-principal ml-3 mt-3" disabled={op.ocupado} onClick={()=>void op.ejecutar(async()=>{await pedirCostes('/api/costes/tarifas','POST',{...draft,clavePeticion:clave.current});setPreview(false);await cargar();alGuardar();},'Versión de tarifa guardada.')}>Confirmar tarifa</button>}
    </form>
    {tarifas.length>0&&<><ContenedorTabla etiqueta="Tarifas vigentes por serie"><table className="datos mt-4"><thead><tr><th>Técnico / versión</th><th>Vigencia Madrid</th><th>Tarifa</th><th>Calidad</th><th>Acciones</th></tr></thead><tbody>{tarifas.map(t=><tr key={t.id}><td><span className="break-all">{t.tecnicoId}</span> · v{t.numero}</td><td>{t.desde} → {t.hastaExclusivo??'sin fin'}</td><td className="font-mono">{t.precioHora} {t.moneda}/h</td><td>{t.accion==='anular'?'Anulada':t.calidad}</td><td><button className="enlace" onClick={()=>editar(t)}>Revisar versión {t.numero}</button> <button className="enlace" onClick={()=>void op.ejecutar(async()=>{const n=++turno.current;const h=await pedirCostes<{versiones:TarifaCoste[]}>('/api/costes/tarifas/'+t.serieId);if(n===turno.current)setHistoria(h.versiones);},'Historial leído.')}>Historial tarifa</button></td></tr>)}</tbody></table></ContenedorTabla><Paginacion pagina={pagina} total={total} ocupado={op.ocupado} cambiar={p=>void op.ejecutar(()=>cargar(p))}/></>}
    {historia.length>0&&<div className="mt-4"><h3 className="font-semibold">Historial inmutable de tarifa</h3>{historia.map(t=><p key={t.id}>v{t.numero} · {t.accion} · {t.precioHora} {t.moneda}/h · {t.fuente} · {t.motivo}</p>)}</div>}
    <EstadoOperacion op={op}/>
  </Tarjeta>;
}
