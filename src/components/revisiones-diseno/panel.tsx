'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso, Boton, Campo, ContenedorTabla, Enlace, Tarjeta } from '../ui';
import { EXCLUSIONES_DUPLICACION, sentidoComparacionRevisiones, type BaseDiseno, type DiferenciasDiseno, type RevisionDiseno } from '@/lib/revisiones-diseno';
interface Historial {
  base:BaseDiseno;cerrado:boolean;origen:{salaId:string;revisionId:string}|null;revisiones:RevisionDiseno[];pagina:number;hayMas:boolean;
  resumen:Record<string,number>;alternativas:Array<{id:string;nombre:string;codigo:string|null}>;
}
async function consultar(url:string,datos?:unknown) {
  const respuesta=await fetch(url,{...(datos ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)} : {}),cache:'no-store'});
  const json=await respuesta.json();if(!respuesta.ok)throw new Error(json.error??'No se pudo completar la operación.');return json;
}
const etiquetas:Record<string,string>={medidas:'Medidas de sala',equipos:'Equipos',muebles:'Mobiliario',puertas:'Puertas',tomas:'Rosetas',conexiones:'Conexiones',bocas:'Bocas físicas',puntos:'Rutas físicas',material:'BOM adicional',anotaciones:'Anotaciones',puertos:'Puertos de catálogo',catalogo:'Catálogo',catalogo_mobiliario:'Catálogo de mobiliario',parametros:'Parámetros de cálculo',presentacion:'Posición visual (px)'};
function valorCampo(campo:string,valor:unknown) {
  if(valor===null||valor===undefined)return 'Sin dato';
  const unidad=campo.endsWith('_m')?' m':campo.endsWith('_cm')?' cm':campo==='rotacion_grados'?'°':campo.startsWith('esquema_')||campo==='x'||campo==='y'?' px':'';
  return `${typeof valor==='object'?JSON.stringify(valor):String(valor)}${unidad}`;
}
export function PanelRevisionesDiseno({salaId,puedeEditar}:{salaId:string;puedeEditar:boolean}) {
  const router=useRouter();const [historial,setHistorial]=useState<Historial|null>(null);const [error,setError]=useState('');const [estado,setEstado]=useState('');const [ocupado,setOcupado]=useState(false);
  const [nombre,setNombre]=useState('');const [seleccion,setSeleccion]=useState<Array<Pick<RevisionDiseno,'id'|'numero'>>>([]);const [diferencias,setDiferencias]=useState<DiferenciasDiseno|null>(null);const [direccion,setDireccion]=useState('');
  const [restaurar,setRestaurar]=useState<string|null>(null);const [previewCopia,setPreviewCopia]=useState(false);const [nombreCopia,setNombreCopia]=useState('');const [codigoCopia,setCodigoCopia]=useState('');const [copia,setCopia]=useState<string|null>(null);
  const api=`/api/salas/${salaId}`;
  const cargar=useCallback(async(pagina=1)=>{const datos=await consultar(`${api}/revisiones?pagina=${pagina}`);setHistorial(datos);},[api]);
  useEffect(()=>{let activa=true;consultar(`${api}/revisiones`).then(datos=>{if(activa)setHistorial(datos);}).catch(e=>{if(activa)setError(e.message);});return()=>{activa=false;};},[api]);
  const ejecutar=async(trabajo:()=>Promise<void>)=>{setOcupado(true);setError('');setEstado('');try{await trabajo();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación.');}finally{setOcupado(false);}};
  const editar=puedeEditar&&!historial?.cerrado;
  const sentido=sentidoComparacionRevisiones(seleccion);
  const comparar=async(a:string,b:string,descripcion='Revisión histórica → Diseño actual')=>{setDiferencias(await consultar(`${api}/comparar?revisionA=${a}&revisionB=${b}`));setDireccion(descripcion);};
  return <Tarjeta titulo="Revisiones y alternativas" id="revisiones-diseno">
    <div className="space-y-5">
      {error&&<p role="alert" className="text-alerta">{error}</p>}{estado&&<p role="status">{estado}</p>}
      {!historial?<p>Cargando historial…</p>:<>
        <p className="text-tinta-tenue">Las revisiones conservan diseño, medidas, conexiones y material. La restauración conserva existencias, reservas, pedidos, cargas, hitos y visitas.</p>
        {historial.cerrado&&<Aviso>La obra está cerrada. El historial se puede consultar.</Aviso>}
        {historial.origen&&<Aviso>Medidas heredadas de <Enlace href={`/salas/${historial.origen.salaId}/documentos`}>la sala original</Enlace>.
          <Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>ejecutar(async()=>{setDiferencias(await consultar(`${api}/comparar?salaId=${historial.origen!.salaId}`));setDireccion('Original → Alternativa');})}>Comparar con origen</Boton>
        </Aviso>}
        {editar&&<form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void ejecutar(async()=>{await consultar(`${api}/revisiones`,{nombre,base:historial.base});setNombre('');setEstado('Revisión guardada.');await cargar();router.refresh();});}}>
          <Campo etiqueta="Nombre de revisión"><input value={nombre} onChange={e=>setNombre(e.target.value)} required maxLength={160}/></Campo>
          <Boton disabled={ocupado}>Guardar revisión</Boton>
        </form>}
        {historial.revisiones.length===0?<p>No hay revisiones guardadas.</p>:<ContenedorTabla etiqueta="Historial de diseño"><table className="datos w-full min-w-[48rem]"><thead><tr><th>Comparar</th><th>Revisión</th><th>Autor y fecha</th><th>Hash</th><th>Restauración</th></tr></thead><tbody>
          {historial.revisiones.map(r=><tr key={r.id}><td><input type="checkbox" aria-label={`Comparar revisión ${r.numero}`} checked={seleccion.some(s=>s.id===r.id)} onChange={e=>setSeleccion(e.target.checked?[...seleccion.slice(-1),{id:r.id,numero:r.numero}]:seleccion.filter(s=>s.id!==r.id))}/></td>
            <td><span className="dato">R{r.numero}</span> · {r.nombre}{r.restauradaDeId&&<span className="block text-tinta-tenue">Restaurada de una revisión anterior</span>}</td><td>{r.autor}<span className="block text-tinta-tenue">{new Date(r.creadoEn).toLocaleString('es-ES')}</span></td><td className="dato">{r.hash.slice(0,12)}</td><td>{editar&&<Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>ejecutar(async()=>{await comparar(r.id,'actual');setRestaurar(r.id);})}>Revisar restauración R{r.numero}</Boton>}</td></tr>)}
        </tbody></table></ContenedorTabla>}
        <div className="flex flex-wrap gap-3">
          <Boton tipo="button" variante="secundario" disabled={ocupado||!sentido} onClick={()=>sentido&&ejecutar(()=>comparar(sentido.anterior.id,sentido.posterior.id,`Anterior R${sentido.anterior.numero} → Posterior R${sentido.posterior.numero}`))}>Comparar revisiones</Boton>
          {historial.pagina>1&&<Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>ejecutar(()=>cargar(historial.pagina-1))}>Revisiones más recientes</Boton>}
          {historial.hayMas&&<Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>ejecutar(()=>cargar(historial.pagina+1))}>Revisiones anteriores</Boton>}
        </div>
        {diferencias&&<div aria-label="Diferencias de diseño" className="space-y-3">
          <h3 className="font-semibold">Diferencias de diseño</h3>
          {direccion&&<p className="text-tinta-tenue" aria-label="Dirección de comparación">{direccion}</p>}
          {diferencias.cambios.length?<ul className="space-y-3">{diferencias.cambios.map((c,i)=><li key={i} className="min-w-0 [overflow-wrap:anywhere]"><strong>{etiquetas[c.grupo]} · {c.estado}</strong> · {String(c.despues?.nombre??c.antes?.nombre??c.despues?.identificador_cable??c.antes?.identificador_cable??c.id)}{c.campos.length>0&&<dl className="mt-1 grid gap-1 text-tinta-tenue">{c.campos.map(campo=><div key={campo} className="grid sm:grid-cols-[12rem_1fr] gap-x-3"><dt>{campo.replaceAll('_',' ')}</dt><dd className="dato [overflow-wrap:anywhere]">{valorCampo(campo,c.antes?.[campo])} → {valorCampo(campo,c.despues?.[campo])}</dd></div>)}</dl>}</li>)}</ul>:<p>Sin diferencias de diseño.</p>}
          <ContenedorTabla etiqueta="Material de los diseños"><table className="datos w-full"><thead><tr><th>Material</th><th>Anterior</th><th>Posterior</th><th>Unidad</th></tr></thead><tbody>{diferencias.material.map(m=><tr key={m.articuloId}><td>{m.descripcion}</td><td className="dato">{m.antes}</td><td className="dato">{m.despues}</td><td>{m.unidad}</td></tr>)}</tbody></table></ContenedorTabla>
        </div>}
        {restaurar&&editar&&<Aviso><p>Restaurar crea una revisión nueva. Las notas y sus anclas pasan al estado de la revisión elegida. Una referencia incompatible o material comprometido rechaza toda la operación.</p>
          <div className="flex flex-wrap gap-3 mt-3"><Boton tipo="button" disabled={ocupado} onClick={()=>ejecutar(async()=>{await consultar(`${api}/revisiones/${restaurar}`,{revisionId:restaurar,base:historial.base});setRestaurar(null);setEstado('Diseño restaurado en una revisión nueva.');await cargar();router.refresh();})}>Restaurar revisión</Boton><Boton tipo="button" variante="secundario" onClick={()=>setRestaurar(null)}>Cancelar restauración</Boton></div>
        </Aviso>}
        {editar&&<div className="space-y-3"><Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>setPreviewCopia(!previewCopia)}>Previsualizar duplicación</Boton>
          {previewCopia&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void ejecutar(async()=>{const resultado=await consultar(`${api}/duplicar`,{nombre:nombreCopia,codigo:codigoCopia||null,base:historial.base});setCopia(resultado.salaId);setPreviewCopia(false);setEstado('Alternativa creada con medidas heredadas.');await cargar();router.refresh();});}}>
            <p>Se copian medidas, mesa, equipos ({historial.resumen.equipos}), conexiones ({historial.resumen.conexiones}), muebles ({historial.resumen.muebles}), puertas, rosetas, rutas, BOM adicional y anotaciones. Cada instancia recibe un ID nuevo; los códigos de cable se conservan dentro de la nueva sala.</p>
            <p>Las medidas se identifican como heredadas; no acreditan una visita de campo.</p>
            <p className="font-semibold">Se excluyen:</p><ul className="list-disc pl-5">{EXCLUSIONES_DUPLICACION.map(e=><li key={e}>{e}</li>)}</ul>
            <div className="grid sm:grid-cols-2 gap-3"><Campo etiqueta="Nombre de alternativa"><input required maxLength={160} value={nombreCopia} onChange={e=>setNombreCopia(e.target.value)}/></Campo><Campo etiqueta="Código de alternativa"><input maxLength={160} value={codigoCopia} onChange={e=>setCodigoCopia(e.target.value)}/></Campo></div>
            <Boton disabled={ocupado}>Crear alternativa</Boton>
          </form>}
        </div>}
        {copia&&<p><Enlace href={`/salas/${copia}/documentos`}>Abrir alternativa creada</Enlace></p>}
        {historial.alternativas.length>0&&<ul className="space-y-2" aria-label="Alternativas">{historial.alternativas.map(a=><li key={a.id} className="flex flex-wrap items-center gap-3"><Enlace href={`/salas/${a.id}/documentos`}>{a.nombre}</Enlace><Boton tipo="button" variante="secundario" disabled={ocupado} onClick={()=>ejecutar(async()=>{setDiferencias(await consultar(`${api}/comparar?salaId=${a.id}`));setDireccion('Original → Alternativa');})}>Comparar alternativa</Boton></li>)}</ul>}
        <p className="text-tinta-tenue">Para reutilizar una alternativa como plantilla, usa «Guardar como plantilla» en su Resumen.</p>
      </>}
    </div>
  </Tarjeta>;
}
