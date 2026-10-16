'use client';

import { useEffect,useRef,useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Aviso, Boton, Campo, Tarjeta } from '@/components/ui';
import type { FichaTecnica } from '@/lib/catalogo-tecnico-repositorio';
import type { Decisiones } from '@/lib/requisitos/modelo';
type PlanTecnico=Extract<Decisiones,{destino:'tecnico'}>;
type PlanPuerto=Extract<Decisiones,{destino:'puerto'}>;
export interface PrefillRequisito<T extends PlanTecnico|PlanPuerto>{planId:string;version:number;decisiones:T}

export function FichaTecnicaArticulo({ articuloId, marca, modelo, ficha, puedeEditar, requisito }: {
  articuloId: string; marca: string | null; modelo: string; ficha: FichaTecnica; puedeEditar: boolean;
  requisito?:PrefillRequisito<PlanTecnico>;
}) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const exacto = !ficha.datos || (ficha.datos.modelo === modelo && ficha.datos.marca === marca);
  const datos = requisito?.decisiones.datos ?? (exacto ? ficha.datos : null);
  const puente=usePuenteRequisito(requisito);
  const identidad = [marca, modelo].filter(Boolean).join(' · ');

  async function enviar(evento: FormEvent<HTMLFormElement>, archivo: boolean) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const entrada = new FormData(formulario);
    setOcupado(true); setMensaje(''); setError(false);
    try {
      const procedencia = { marca, modelo, origen: String(entrada.get('origen') ?? ''),
        url: String(entrada.get('url') ?? ''), fecha: String(entrada.get('fecha') ?? '') };
      const numero = (nombre: string) => entrada.get(nombre) === '' ? null : Number(entrada.get(nombre));
      let cuerpo: FormData | string;
      if (archivo) {
        entrada.delete('origen'); entrada.delete('url'); entrada.delete('fecha');
        entrada.set('procedencia', JSON.stringify(procedencia));
        cuerpo = entrada;
      } else {
        cuerpo = JSON.stringify({ ...procedencia, ancho: numero('ancho'), alto: numero('alto'),
          fondo: numero('fondo'), unidad: entrada.get('unidad') || null, ru: numero('ru') });
      }
      if(requisito&&!archivo){await puente.previsualizar({...requisito.decisiones,datos:JSON.parse(cuerpo as string),camposRevisados:entrada.getAll('revisado').map(String)});return;}
      const respuesta = await fetch(`/api/catalogo-tecnico/${articuloId}`, {
        method: archivo ? 'POST' : 'PUT', body: cuerpo,
        ...(archivo ? {} : { headers: { 'Content-Type': 'application/json' } }),
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.error ?? 'No se pudo guardar.');
      if (archivo) formulario.reset();
      setMensaje(archivo ? 'Archivo verificado y guardado.' : 'Datos técnicos verificados y guardados.');
      router.refresh();
    } catch (error) { setError(true); setMensaje(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setOcupado(false); }
  }

  if(requisito&&puente.sinAcceso)return <Aviso>La fuente ya no está disponible. Abre su revisión actual desde la obra.</Aviso>;
  return (
    <Tarjeta titulo="Datos técnicos por modelo" pie={`Modelo exacto: ${identidad}`}>
      {!exacto && <div className="mb-4"><Aviso>Los datos guardados corresponden a {ficha.datos?.marca} {ficha.datos?.modelo}. Verifica de nuevo el modelo actual antes de reutilizarlos.</Aviso></div>}
      <p className="text-tinta-tenue mb-4">Deja vacías las medidas desconocidas. Las dimensiones verificadas se conservan en los equipos que se añadan a salas y plantillas.</p>
      {requisito&&<Aviso tono="neutro">Propuesta del documento. Revisa cada campo y confirma la procedencia antes de guardar.</Aviso>}
      {mensaje && <div className="mb-4" role="status"><Aviso tono={error ? 'aviso' : 'neutro'}>{mensaje}</Aviso></div>}
      <form onSubmit={evento => void enviar(evento, false)} onChange={()=>puente.invalidar()}>
        <fieldset disabled={!puedeEditar || ocupado}>
          <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(['ancho', 'alto', 'fondo'] as const).map(nombre => (
              <Campo key={nombre} etiqueta={nombre[0].toUpperCase() + nombre.slice(1)}>
                <input name={nombre} type="number" min="0.000001" max="1000000" step="any" defaultValue={datos?.[nombre] ?? ''} className="w-full num" />
              </Campo>
            ))}
            <Campo etiqueta="Unidad de dimensión">
              <select name="unidad" defaultValue={datos?.unidad ?? ''} className="w-full">
                <option value="">Sin verificar</option><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option>
              </select>
            </Campo>
            <Campo etiqueta="Rack (RU)"><input name="ru" type="number" min="0.5" max="1000" step="any" defaultValue={datos?.ru ?? ''} className="w-full num" /></Campo>
          </div>
          <Procedencia origen={datos?.origen} url={datos?.url} fecha={datos?.fecha} />
          {requisito&&<CamposRevisados campos={[...Object.keys(requisito.decisiones.datos),'modeloExacto']}/>}
          {puedeEditar && <div className="mt-4"><Boton disabled={ocupado}>{requisito?'Previsualizar verificación con procedencia':'Guardar verificación técnica'}</Boton></div>}
        </fieldset>
      </form>
      {requisito&&<ResultadoPuente puente={puente}/>}

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {(['imagen', 'ficha'] as const).map(tipo => {
          const archivo = ficha.archivos.find(a => a.tipo === tipo);
          const enlace = archivo ? `/api/catalogo-tecnico/${articuloId}/archivos/${archivo.id}` : '';
          return <div key={tipo} className="min-w-0">
            <h3 className="font-semibold mb-2">{tipo === 'imagen' ? 'Imagen del modelo' : 'Ficha PDF del modelo'}</h3>
            {archivo ? <div className="mb-3 space-y-2 [overflow-wrap:anywhere]">
              {tipo === 'imagen' && <>
                {/* El endpoint exige la sesión actual y devuelve sólo raster validado. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${enlace}?vista=1`} alt={`${archivo.marca ?? ''} ${archivo.modelo}`} className="w-full h-40 object-contain bg-fondo rounded" />
              </>}
              <p><a className="enlace" href={enlace}>Descargar {archivo.nombre}</a></p>
              <p className="text-tinta-tenue">{archivo.marca} {archivo.modelo} · {archivo.origen} · {archivo.fecha} · {(archivo.tamano_bytes / 1024).toFixed(1)} KiB</p>
              <a className="enlace" href={archivo.url} target="_blank" rel="noopener noreferrer">Consultar origen</a>
            </div> : <p className="text-tinta-tenue mb-3">Sin archivo verificado.</p>}
            {puedeEditar && <form onSubmit={evento => void enviar(evento, true)}>
              <fieldset disabled={ocupado}>
                <input name="tipo" value={tipo} type="hidden" />
                <Campo etiqueta={tipo === 'imagen' ? 'PNG, JPEG o WebP (máx. 5 MiB)' : 'PDF (máx. 5 MiB)'}>
                  <input name="archivo" type="file" accept={tipo === 'imagen' ? 'image/png,image/jpeg,image/webp' : 'application/pdf'} required className="w-full" />
                </Campo>
                <Procedencia origen={archivo?.origen ?? datos?.origen} url={archivo?.url ?? datos?.url} fecha={archivo?.fecha ?? datos?.fecha} />
                <div className="mt-3"><Boton variante="secundario" disabled={ocupado}>{archivo ? 'Sustituir archivo verificado' : 'Guardar archivo verificado'}</Boton></div>
              </fieldset>
            </form>}
          </div>;
        })}
      </div>
    </Tarjeta>
  );
}

function Procedencia({ origen, url, fecha }: { origen?: string; url?: string; fecha?: string }) {
  return <div className="grid sm:grid-cols-3 gap-3 mt-3">
    <Campo etiqueta="Origen"><input name="origen" required maxLength={200} defaultValue={origen ?? ''} className="w-full" /></Campo>
    <Campo etiqueta="URL HTTPS"><input name="url" type="url" required maxLength={2048} pattern="https://.*" defaultValue={url ?? ''} className="w-full" /></Campo>
    <Campo etiqueta="Fecha de verificación"><input name="fecha" type="date" required defaultValue={fecha ?? ''} className="w-full" /></Campo>
  </div>;
}

function CamposRevisados({ campos }: { campos: string[] }) {
  return <fieldset className="mt-4">
    <legend className="font-semibold">Campos revisados</legend>
    <div className="flex flex-wrap gap-3 mt-2">
      {campos.map(c => <label key={c} className="campo-casilla min-w-11">
        <input type="checkbox" name="revisado" value={c} />
        <span>{c === 'modeloExacto' ? 'Modelo y variante exactos' : c}</span>
      </label>)}
    </div>
  </fieldset>;
}
function usePuenteRequisito(requisito?:PrefillRequisito<PlanTecnico|PlanPuerto>){
  const router=useRouter();const [version,setVersion]=useState(requisito?.version??0);const [preview,setPreview]=useState<{version:number;token:string;diff:unknown}|null>(null);const [mensaje,setMensaje]=useState('');const [bloqueado,setBloqueado]=useState(false);const [sinAcceso,setSinAcceso]=useState(false);const controles=useRef(new Set<AbortController>());const vivo=useRef(true);const peticion=useRef<{token:string;clave:string}|null>(null);
  const planId=requisito?.planId;
  useEffect(()=>{vivo.current=true;const c=controles.current;return()=>{vivo.current=false;for(const x of c)x.abort();c.clear();};},[]);
  useEffect(()=>{
    if(!planId)return;
    const comprobar=()=>{if(document.visibilityState==='hidden')return;const c=new AbortController();controles.current.add(c);void fetch(`/api/requisitos/planes/${planId}`,{cache:'no-store',signal:c.signal}).then(async r=>{
      if(!vivo.current||c.signal.aborted)return;
      const denegado=[401,403,404].includes(r.status);const j=denegado?null:await r.json().catch(()=>null);
      if(!vivo.current||c.signal.aborted)return;
      if(denegado||['FUENTE_RETIRADA','FUENTE_CAMBIADA'].includes(j?.codigo)){setPreview(null);setBloqueado(true);setSinAcceso(true);router.refresh();}
    }).catch(()=>{}).finally(()=>controles.current.delete(c));};
    window.addEventListener('focus',comprobar);document.addEventListener('visibilitychange',comprobar);return()=>{window.removeEventListener('focus',comprobar);document.removeEventListener('visibilitychange',comprobar);};
  },[planId,router]);
  function invalidar(){setPreview(null);peticion.current=null;}
  async function pedir(url:string,body:unknown,method='POST'){const c=new AbortController();controles.current.add(c);try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:c.signal});if(!vivo.current||c.signal.aborted)throw new DOMException('Cancelado','AbortError');if(r.status===401||r.status===403){setPreview(null);setBloqueado(true);setSinAcceso(true);router.refresh();throw new Error('El acceso a la fuente ha cambiado.');}const j=await r.json();if(!vivo.current||c.signal.aborted)throw new DOMException('Cancelado','AbortError');if(!r.ok){if(['FUENTE_RETIRADA','FUENTE_CAMBIADA'].includes(j.codigo)||r.status===404){setPreview(null);setBloqueado(true);setSinAcceso(true);}throw new Error(j.error??'No se pudo completar la revisión.');}return j;}finally{controles.current.delete(c);}}
  async function previsualizar(decisiones:PlanTecnico|PlanPuerto){if(!requisito)return;setPreview(null);setMensaje('');try{const guardado=await pedir(`/api/requisitos/planes/${requisito.planId}`,{version,decisiones},'PATCH');setVersion(guardado.version);const p=await pedir(`/api/requisitos/planes/${requisito.planId}/preview`,{});setPreview(p);}catch(e){setMensaje(e instanceof Error?e.message:'No se pudo revisar.');}}
  async function confirmar(){if(!requisito||!preview)return;peticion.current??={token:preview.token,clave:crypto.randomUUID()};try{await pedir(`/api/requisitos/planes/${requisito.planId}/confirmar`,{version:preview.version,token:preview.token,clavePeticion:peticion.current.clave});setPreview(null);setBloqueado(true);setMensaje('Guardado con procedencia en una única transacción.');router.refresh();}catch(e){setMensaje(e instanceof Error?e.message:'No se pudo guardar.');}}
  return {preview,mensaje,bloqueado,sinAcceso,previsualizar,confirmar,invalidar};
}
function ResultadoPuente({puente}:{puente:ReturnType<typeof usePuenteRequisito>}){return <div className="mt-4 space-y-3">{puente.mensaje&&<p role="status">{puente.mensaje}</p>}{puente.preview&&<><details><summary>Revisión antes de guardar</summary><pre className="whitespace-pre-wrap text-xs overflow-auto max-h-72">{JSON.stringify(puente.preview.diff,null,2)}</pre></details><Boton tipo="button" disabled={puente.bloqueado} onClick={()=>void puente.confirmar()}>Confirmar verificación con procedencia</Boton></>}</div>;}
export function PuertoDesdeRequisito({requisito}:{requisito:PrefillRequisito<PlanPuerto>}){
  const puente=usePuenteRequisito(requisito);const [ocupado,setOcupado]=useState(false);const d=requisito.decisiones.datos;
  async function enviar(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setOcupado(true);try{await puente.previsualizar({...requisito.decisiones,camposRevisados:f.getAll('revisado').map(String),datos:{nombre:String(f.get('nombre')),total:Number(f.get('total')),sentido:f.get('sentido') as PlanPuerto['datos']['sentido'],senal:f.get('senal') as PlanPuerto['datos']['senal'],conector:String(f.get('conector')??'')||null,orden:f.get('orden')===''?null:Number(f.get('orden')),notas:String(f.get('notas')??'')||null}});}finally{setOcupado(false);}}
  if(puente.sinAcceso)return <Aviso>La fuente ya no está disponible.</Aviso>;
  return <Tarjeta titulo="Puerto propuesto por documento"><p className="mb-3 text-tinta-tenue">Alta nueva explícita. Un puerto existente se revisa en su fila y no se sobrescribe desde el documento.</p><form onSubmit={e=>void enviar(e)} onChange={()=>puente.invalidar()}><fieldset disabled={ocupado||puente.bloqueado}><div className="grid sm:grid-cols-3 gap-3">
    <Campo etiqueta="Nombre literal"><input name="nombre" defaultValue={d.nombre} required/></Campo><Campo etiqueta="Total explícito"><input name="total" type="number" min="1" step="1" defaultValue={d.total} required/></Campo>
    <Campo etiqueta="Sentido"><select name="sentido" defaultValue={d.sentido}>{['entrada','salida','bidireccional','control'].map(v=><option key={v}>{v}</option>)}</select></Campo>
    <Campo etiqueta="Señal"><select name="senal" defaultValue={d.senal}>{['hdmi','red','usb','audio_linea','audio_altavoz','microfono','alimentacion','control','otro'].map(v=><option key={v}>{v}</option>)}</select></Campo>
    <Campo etiqueta="Conector"><input name="conector" defaultValue={d.conector??''}/></Campo><Campo etiqueta="Orden"><input name="orden" type="number" step="1" defaultValue={d.orden??''}/></Campo><Campo etiqueta="Notas"><input name="notas" defaultValue={d.notas??''}/></Campo></div><CamposRevisados campos={[...Object.keys(d),'modeloExacto']}/><div className="mt-4"><Boton>Previsualizar puerto con procedencia</Boton></div></fieldset></form><ResultadoPuente puente={puente}/></Tarjeta>;
}
