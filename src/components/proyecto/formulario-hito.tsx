'use client';
import { useActionState,useState } from 'react';
import { Boton,Campo } from '@/components/ui';
import { registrarHitoProyecto,type EstadoHitoProyecto } from '@/app/acciones-ciclo';
import type { Tecnico } from '@/lib/ciclo-vida';
export function FormularioHitoProyecto({proyectoId,tipo,etiqueta,iniciadores,exigeNota,accion=registrarHitoProyecto}:{
  proyectoId:string;tipo:'inicio'|'cierre';etiqueta:string;iniciadores:Tecnico[];exigeNota:boolean;
  accion?:(datos:FormData)=>Promise<EstadoHitoProyecto|void>;
}) {
  const [estado,enviar,pendiente]=useActionState(async (_anterior:EstadoHitoProyecto,datos:FormData)=>(await accion(datos)) ?? {error:null},{error:null});
  const [tecnico,setTecnico]=useState(''),[fecha,setFecha]=useState(''),[nota,setNota]=useState('');
  return <form action={enviar} className="flex flex-wrap items-end gap-3 pt-3 border-t border-linea-suave">
    <input type="hidden" name="proyecto_id" value={proyectoId}/><input type="hidden" name="tipo" value={tipo}/>
    <Campo etiqueta="Quién"><select name="tecnico_id" required className="w-40" value={tecnico} onChange={e=>setTecnico(e.target.value)}><option value="" disabled>Elegir técnico</option>{iniciadores.map(t=><option key={t.id} value={t.id}>{t.nombre}</option>)}</select></Campo>
    <Campo etiqueta="Fecha"><input name="fecha" type="date" className="w-40 num" value={fecha} onChange={e=>setFecha(e.target.value)}/></Campo>
    {exigeNota && <Campo etiqueta="Nota (obligatoria)"><input name="notas" required className="w-56" value={nota} onChange={e=>setNota(e.target.value)}/></Campo>}
    <Boton variante="secundario" disabled={pendiente}>{etiqueta}</Boton>
    {estado.error && <p role="alert" className="w-full">{estado.error}</p>}
  </form>;
}
