'use client';
import { useRef, useState } from 'react';
import { Tarjeta } from '@/components/ui';
import type { ParteTiempo, VersionTiempo } from '@/lib/tiempos/modelo';
import { CampoHoraTrabajo, ErrorDeTiempo, FalloTiempo, pedirTiempo, useVigenciaTiempo } from './comun';
type DatosHistorial = { registro: ParteTiempo; versiones: VersionTiempo[]; pagina: number; hayMas: boolean };
const camposParte = (p: ParteTiempo) => ({ ...p.version.entradaLocal, notas: p.version.notas, motivo: '' });
export function HistorialTiempo({ parte, gestion = false, cerrar, alGuardar, alAbrirRelacionado, alReclasificar }: { parte: ParteTiempo; gestion?: boolean; cerrar: () => void; alGuardar: () => Promise<void>; alAbrirRelacionado?: (p: ParteTiempo) => void; alReclasificar?: (p: ParteTiempo) => void }) {
  const [base, setBase] = useState(parte), [campos, setCampos] = useState(() => camposParte(parte)), [comparacion, setComparacion] = useState<ParteTiempo | null>(null), [historial, setHistorial] = useState<DatosHistorial | null>(null);
  const [error, setError] = useState<Error | null>(null), [mensaje, setMensaje] = useState(''), [ocupado, setOcupado] = useState(false);
  const [relaciones, setRelaciones] = useState<{ partes: ParteTiempo[]; pagina: number; hayMas: boolean } | null>(null), [retirado, setRetirado] = useState(false);
  const edicion = useRef(0), bloqueo = useRef(false), clave = useRef<{ contenido: string; valor: string } | null>(null), vigencia = useVigenciaTiempo();
  const ruta = `/api/tiempos/registros/${parte.id}`, sufijo = gestion ? '?gestion=1' : '';
  const editable = base.puedeEscribir && parte.puedeEscribir;
  function fallar(e: unknown) { setError(e as Error); if (e instanceof FalloTiempo && [401,403,404].includes(e.status)) { setRetirado(true); setComparacion(null); setHistorial(null); setRelaciones(null); } }
  function editar(v: typeof campos) { edicion.current++; clave.current = null; setCampos(v); }
  async function leerHistorial(pagina = 1) {
    const n = vigencia.siguiente();
    try { const r = await pedirTiempo<DatosHistorial>(ruta + '/historial?pagina=' + pagina); if (vigencia.vigente(n)) { setHistorial(r); setError(null); setRetirado(false); } } catch (e) { if (vigencia.vigente(n)) fallar(e); }
  }
  async function recargar() {
    const n = vigencia.siguiente();
    try { const r = await pedirTiempo<{ registro: ParteTiempo }>(ruta); if (vigencia.vigente(n)) { setComparacion(r.registro); setError(null); setRetirado(false); } } catch (e) { if (vigencia.vigente(n)) fallar(e); }
  }
  async function leerRelaciones(pagina = 1) { const n = vigencia.siguiente(); try { const r = await pedirTiempo<{ partes: ParteTiempo[]; pagina: number; hayMas: boolean }>(ruta + '/relacionados?pagina=' + pagina); if (vigencia.vigente(n)) setRelaciones(r); } catch(e) { if (vigencia.vigente(n)) fallar(e); } }
  async function mutar(tipo: 'correccion' | 'anulacion' | 'restauracion', versionId?: string) {
    if (bloqueo.current) return;
    if (!campos.motivo.trim()) { setError(new Error('Indica el motivo de la operación.')); return; }
    bloqueo.current = true; setOcupado(true); setError(null); setMensaje('');
    const n = vigencia.siguiente(), revision = edicion.current;
    const contenido = { numeroActual: base.numeroActual, actualId: base.actualId, motivo: campos.motivo, ...(tipo === 'correccion' ? { inicio: campos.inicio, fin: campos.fin, notas: campos.notas } : {}), ...(versionId ? { versionId } : {}) };
    const firma = JSON.stringify({ tipo, contenido });
    if (clave.current?.contenido !== firma) clave.current = { contenido: firma, valor: crypto.randomUUID() };
    try {
      await pedirTiempo(ruta + (tipo === 'anulacion' ? '/anular' : tipo === 'restauracion' ? '/historial' : '') + sufijo, tipo === 'correccion' ? 'PATCH' : 'POST', { ...contenido, clavePeticion: clave.current.valor });
      const actual = await pedirTiempo<{ registro: ParteTiempo }>(ruta);
      if (!vigencia.vigente(n)) return;
      setBase(actual.registro); setComparacion(null); setHistorial(null); clave.current = null;
      if (edicion.current === revision) setCampos(camposParte(actual.registro));
      setMensaje(edicion.current === revision ? 'Nueva versión guardada.' : 'Nueva versión guardada. Se conserva tu edición posterior.');
      await alGuardar();
    } catch (e) { if (vigencia.vigente(n)) fallar(e); }
    finally { if (vigencia.vigente(n)) { bloqueo.current = false; setOcupado(false); } }
  }
  if (retirado) return <Tarjeta titulo="Parte no disponible"><ErrorDeTiempo error={error} /><p>El borrador local se conserva sin mostrar el contenido retirado.</p><button type="button" className="boton mt-3" onClick={() => void recargar()}>Comprobar acceso actual</button><button type="button" className="boton mt-3 ml-2" onClick={cerrar}>Cerrar parte</button></Tarjeta>;
  return <Tarjeta titulo={`Parte · ${base.tarea}`} acciones={<button type="button" className="boton" onClick={cerrar}>Cerrar parte</button>}>
    <p>{base.tecnico} · {base.proyecto}{base.sala ? ' · ' + base.sala : ''}</p><p className="font-mono mt-2">Versión {base.numeroActual} · {base.version.minutos} min · {base.version.accion === 'anulacion' ? 'Anulado' : 'Vigente'}</p>
    <div className="flex flex-wrap gap-3 mt-3"><button type="button" className="boton" disabled={ocupado} onClick={() => void leerRelaciones()}>Consultar partes relacionados</button>{editable && base.version.accion === 'anulacion' && alReclasificar && <button className="boton" type="button" onClick={() => alReclasificar(base)}>Crear parte corregido relacionado</button>}</div>
    {relaciones && <div className="mt-3"><ul>{relaciones.partes.map(p => <li key={p.id}><button type="button" className="text-acento my-1 text-left" onClick={() => alAbrirRelacionado?.(p)}>{p.tarea} · {p.tecnico} · {p.version.entradaLocal.inicio.fecha} {p.version.entradaLocal.inicio.hora}</button></li>)}</ul>{!relaciones.partes.length && <p>No hay partes relacionados visibles.</p>}<div className="flex gap-3"><button className="boton" disabled={relaciones.pagina === 1} onClick={() => void leerRelaciones(relaciones.pagina - 1)}>Relacionados anteriores</button><button className="boton" disabled={!relaciones.hayMas} onClick={() => void leerRelaciones(relaciones.pagina + 1)}>Relacionados siguientes</button></div></div>}
    <form className="space-y-4 mt-4" onSubmit={e => { e.preventDefault(); void mutar('correccion'); }}>
      <fieldset disabled={!editable} className="space-y-4"><CampoHoraTrabajo nombre="Inicio" valor={campos.inicio} cambiar={inicio => editar({ ...campos, inicio })} /><CampoHoraTrabajo nombre="Fin" valor={campos.fin} cambiar={fin => editar({ ...campos, fin })} />
        <label className="block">Notas<textarea aria-label="Corregir notas del parte" className="block w-full mt-1" maxLength={2000} value={campos.notas} onChange={e => editar({ ...campos, notas: e.target.value })} /></label>
        <label className="block">Motivo de corrección o anulación<textarea aria-label="Motivo de corrección o anulación" className="block w-full mt-1" maxLength={2000} value={campos.motivo} onChange={e => editar({ ...campos, motivo: e.target.value })} /></label>
        <div className="flex flex-wrap gap-3"><button className="boton boton-principal" disabled={ocupado}>Guardar corrección</button><button className="boton" type="button" disabled={ocupado || base.version.accion === 'anulacion'} onClick={() => void mutar('anulacion')}>Anular parte</button></div>
      </fieldset>
    </form>
    <div className="flex flex-wrap gap-3 mt-4"><button type="button" className="boton" disabled={ocupado} onClick={() => void recargar()}>Recargar parte y comparar</button><button type="button" className="boton" disabled={ocupado} onClick={() => void leerHistorial()}>Consultar historial del parte</button></div>
    {comparacion && <div className="mt-4 p-3 bg-superficie-hundida"><p>Servidor · versión {comparacion.numeroActual} · {comparacion.version.minutos} min</p><p className="whitespace-pre-wrap">{comparacion.version.notas}</p><button type="button" className="boton mt-2" onClick={() => { editar(camposParte(comparacion)); setBase(comparacion); setComparacion(null); }}>Adoptar versión guardada</button></div>}
    {historial && <div className="mt-4"><h3 className="font-semibold">Versiones del parte</h3><ol className="divide-y divide-linea-suave">{historial.versiones.map(v => <li key={v.id} className="py-3"><p>Versión {v.numero} · {v.accion} · {v.minutos} min</p><p>{v.autorNombre} · {new Date(v.creadoEn).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p><p className="whitespace-pre-wrap">{v.notas}</p>{v.motivo && <p>Motivo: {v.motivo}</p>}{editable && v.accion !== 'anulacion' && v.id !== base.actualId && <button type="button" className="boton mt-2" disabled={ocupado} onClick={() => void mutar('restauracion', v.id)}>Restaurar intervalo de versión {v.numero}</button>}</li>)}</ol><nav className="flex gap-3"><button className="boton" disabled={historial.pagina === 1 || ocupado} onClick={() => void leerHistorial(historial.pagina - 1)}>Historia anterior</button><button className="boton" disabled={!historial.hayMas || ocupado} onClick={() => void leerHistorial(historial.pagina + 1)}>Historia siguiente</button></nav></div>}
    <ErrorDeTiempo error={error} /><p role="status" aria-live="polite" className="mt-3">{mensaje}</p>
  </Tarjeta>;
}
