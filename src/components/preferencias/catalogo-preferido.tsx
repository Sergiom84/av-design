'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { PreferenciasCatalogo } from '@/lib/preferencias-usuario';
import type { ResultadoPreferido } from '@/lib/preferencias-usuario-repositorio';
interface Consulta {preferencias:PreferenciasCatalogo;limite:number;marcasSinReferencias:string[];resultados:ResultadoPreferido[]}
export function CatalogoPreferido({ficticio=false}:{ficticio?:boolean}){
  const [datos,setDatos]=useState<Consulta>();const [error,setError]=useState('');const [ocupado,setOcupado]=useState(!ficticio);const [revision,setRevision]=useState(0);const turno=useRef(0);
  useEffect(()=>{if(ficticio)return;const controlador=new AbortController();const actual=++turno.current;
    fetch('/api/catalogo-preferido',{cache:'no-store',signal:controlador.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo consultar el catálogo.');return d as Consulta;}).then(d=>{if(actual===turno.current)setDatos(d);}).catch(e=>{if(!controlador.signal.aborted&&actual===turno.current)setError(e instanceof Error?e.message:'Error de red.');}).finally(()=>{if(actual===turno.current)setOcupado(false);});return()=>controlador.abort();
  },[ficticio,revision]);
  return <Tarjeta titulo="Tu consulta preferida">
    {ficticio?<p>Inicia sesión con tu usuario para guardar y consultar tus preferencias personales.</p>:<>
      <p>Hasta 20 referencias activas. <Link href="/cuenta" className="enlace">Cambiar preferencias en Mi cuenta</Link></p>
      {ocupado&&<p role="status">Consultando…</p>}{error&&<p role="alert">{error}</p>}
      {datos&&!error&&<>
        <p className="mt-2">Marcas: {datos.preferencias.marcas.length?datos.preferencias.marcas.join(' · '):'sin marcas elegidas; catálogo completo con tus filtros'}. Tipo: {datos.preferencias.tipo??'todos'}. Búsqueda: {datos.preferencias.q||'sin texto'}.</p>
        {datos.marcasSinReferencias.length>0&&<p role="status">Sin referencias activas para estas marcas: {datos.marcasSinReferencias.join(' · ')}.</p>}
        {datos.resultados.length===0?<p className="mt-3">Sin resultados para tus filtros.</p>:<ul className="mt-3 grid gap-3 lg:grid-cols-2">{datos.resultados.map(f=><li key={f.id} className="border border-linea rounded p-3 min-w-0 break-words"><Link href={`/articulo/${f.id}`} className="enlace">{f.marca} {f.modelo}</Link>{f.descripcion&&<p>{f.descripcion}</p>}<p className="text-tinta-tenue">{f.tipo} · {f.unidad} · {f.categoria}</p><p className="text-tinta-tenue text-xs">{f.motivo}</p></li>)}</ul>}
      </>}
      <button className="boton mt-4" disabled={ocupado} onClick={()=>{setOcupado(true);setError('');setRevision(r=>r+1);}}>Actualizar consulta preferida</button>
    </>}
  </Tarjeta>;
}
