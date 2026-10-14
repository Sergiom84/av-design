import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { generarPdfTecnico } from './pdf';
import { generarBomCsv, generarCablesCsv, generarXlsx } from './tablas';
import { DOCUMENTOS, type ArchivoDocumento, type ManifiestoExportacion, type OpcionesPdf, type SalaExportada, type SnapshotExportacion, type TipoDocumento } from './modelo';
import { esUuid } from '../uuid';

const RAIZ = join(tmpdir(), 'av-design-documentos-e1');
const DURACION = 30 * 60 * 1000;
const LIMITE_BYTES = 50 * 1024 * 1024;
export type EventoPaquete = {tipo:'inicio';paquete:string;revision:string} |
  {tipo:'documento';archivo:ArchivoDocumento;completados:number;total:number} |
  {tipo:'fin';manifiesto:ManifiestoExportacion} | {tipo:'error';error:string};
type GeneradorPdf = typeof generarPdfTecnico;
class ErrorLimitePaquete extends Error {}

export async function generarPaquete(snapshot: SnapshotExportacion, documentos: TipoDocumento[], opciones: OpcionesPdf,
  usuarioId: string, emitir: (evento:EventoPaquete)=>void, pdf:GeneradorPdf = generarPdfTecnico, esObra = snapshot.salas.length > 1): Promise<ManifiestoExportacion> {
  const id = randomUUID();
  const carpeta = join(RAIZ,id);
  await limpiarPaquetesCaducados();
  await mkdir(carpeta,{recursive:true,mode:0o700});
  const manifiesto:ManifiestoExportacion = {version:1,id,revision:snapshot.revision,creadoEn:snapshot.creadoEn,
    caducaEn:new Date(Date.now()+DURACION).toISOString(),proyecto:snapshot.proyecto,
    salas:snapshot.salas.map(s=>({id:s.sala.id,nombre:s.sala.nombre,codigo:s.sala.codigo})),opciones,documentos,archivos:[]};
  await writeFile(join(carpeta,'propietario.json'),JSON.stringify({usuarioId,esObra,caducaEn:manifiesto.caducaEn}),{mode:0o600});
  emitir({tipo:'inicio',paquete:id,revision:snapshot.revision});
  const tareas = documentos.flatMap<{documento:TipoDocumento;sala:SalaExportada|null}>(documento => documento === 'bom-xlsx' || documento === 'bom-csv' ?
    [{documento,sala:null}] : snapshot.salas.map(sala=>({documento,sala})));
  const archivos:Record<string,Uint8Array> = {};
  let bytesTotal = 0;
  for (const tarea of tareas) {
    const {documento,sala} = tarea;
    // Prefijo id evita colisiones entre salas con el mismo nombre/código.
    const prefijo = sala ? `${sala.sala.id}-${limpiarNombre(sala.sala.codigo ?? sala.sala.nombre)}` : 'seleccion';
    const formato = DOCUMENTOS.find(d=>d.id===documento)!.formato;
    const nombre = `${prefijo}-${documento}.${formato}`;
    let archivo:ArchivoDocumento;
    try {
      let bytes:Uint8Array;
      if (documento === 'bom-csv') bytes=generarBomCsv(snapshot,snapshot.salas);
      else if (documento === 'bom-xlsx') bytes=await generarXlsx(snapshot,snapshot.salas,'bom');
      else if (documento === 'cables-csv') bytes=generarCablesCsv(snapshot,sala!);
      else if (documento === 'cables-xlsx') bytes=await generarXlsx(snapshot,[sala!],'cables');
      else bytes=await pdf(snapshot,sala!,documento,opciones);
      if (bytesTotal+bytes.length>LIMITE_BYTES) throw new ErrorLimitePaquete('El paquete supera el límite de 50 MB. Reduce la selección.');
      await writeFile(join(carpeta,nombre),bytes,{mode:0o600});
      bytesTotal+=bytes.length;
      archivos[nombre]=bytes;
      archivo={nombre,documento,salaId:sala?.sala.id??null,estado:'correcto',bytes:bytes.length,
        sha256:createHash('sha256').update(bytes).digest('hex')};
    } catch (error) {
      archivo={nombre,documento,salaId:sala?.sala.id??null,estado:'error',
        error:`No se pudo generar ${DOCUMENTOS.find(d=>d.id===documento)!.nombre}${sala ? ` de ${sala.sala.nombre}`:''}. ${error instanceof ErrorLimitePaquete ? error.message : 'Prueba una nueva generación o una selección menor.'} Los demás documentos siguen disponibles.`};
    }
    manifiesto.archivos.push(archivo);
    emitir({tipo:'documento',archivo,completados:manifiesto.archivos.length,total:tareas.length});
  }
  archivos['manifiesto.json']=strToU8(JSON.stringify(manifiesto,null,2));
  const fechaZip = new Date(snapshot.creadoEn);
  await writeFile(join(carpeta,'paquete.zip'),zipSync(archivos,{level:6,mtime:fechaZip}),{mode:0o600});
  await writeFile(join(carpeta,'manifiesto.json'),archivos['manifiesto.json'],{mode:0o600});
  emitir({tipo:'fin',manifiesto});
  return manifiesto;
}

function limpiarNombre(nombre:string):string {
  return nombre.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,48)||'sala';
}
async function limpiarPaquetesCaducados():Promise<void> {
  const entradas=await readdir(RAIZ,{withFileTypes:true}).catch(()=>[]);
  for(const entrada of entradas) {
    if(!entrada.isDirectory()||!esUuid(entrada.name))continue;
    try {
      const propietario=JSON.parse(await readFile(join(RAIZ,entrada.name,'propietario.json'),'utf8'));
      if(Date.parse(propietario.caducaEn)<=Date.now())await rm(join(RAIZ,entrada.name),{recursive:true,force:true});
    } catch { /* Un paquete en creación no se elimina. */ }
  }
}
export async function leerPaquete(id:string,usuarioId:string):Promise<{manifiesto:ManifiestoExportacion;esObra:boolean}|null> {
  if(!esUuid(id)) return null;
  try {
    const propietario=JSON.parse(await readFile(join(RAIZ,id,'propietario.json'),'utf8'));
    if(propietario.usuarioId!==usuarioId) return null;
    if(!vigente(propietario.caducaEn)) {await rm(join(RAIZ,id),{recursive:true,force:true});return null;}
    const manifiesto=JSON.parse(await readFile(join(RAIZ,id,'manifiesto.json'),'utf8')) as ManifiestoExportacion;
    if(manifiesto.id!==id || manifiesto.caducaEn!==propietario.caducaEn || !vigente(manifiesto.caducaEn)) return null;
    return {manifiesto,esObra:propietario.esObra};
  } catch {return null;}
}
export async function leerArchivo(id:string,nombre:string,manifiesto:ManifiestoExportacion):Promise<Uint8Array|null> {
  if(!esUuid(id) || manifiesto.id!==id || !vigente(manifiesto.caducaEn) || basename(nombre)!==nombre ||
    (nombre!=='paquete.zip' && nombre!=='manifiesto.json' &&
    !manifiesto.archivos.some(a=>a.nombre===nombre&&a.estado==='correcto'))) return null;
  return readFile(join(RAIZ,id,nombre)).catch(()=>null);
}

function vigente(caducaEn:string):boolean {
  const instante=Date.parse(caducaEn);
  return Number.isFinite(instante) && instante>Date.now();
}
