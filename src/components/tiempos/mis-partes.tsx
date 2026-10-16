'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tarjeta } from '@/components/ui';
import type { ListaTiempos, ParteTiempo } from '@/lib/tiempos/modelo';
import { FormularioTiempo } from './formulario';
import { HistorialTiempo } from './historial';
import { ErrorDeTiempo, FalloTiempo, pedirTiempo, useVigenciaTiempo } from './comun';

export function MisPartes({ inicial, proyectoId }: { inicial: ListaTiempos; proyectoId?: string }) {
  // El cambio de identidad/ACL desmonta todos los borradores y peticiones anteriores.
  // Props RSC semánticamente iguales conservan la edición local.
  const router = useRouter();
  return <><div className="flex justify-end mb-3"><button type="button" className="boton" onClick={() => router.refresh()}>Actualizar acceso y contexto</button></div><EspacioTiempos key={inicial.identidad.alcance + ':' + (proyectoId ?? 'mios')} inicial={inicial} proyectoId={proyectoId} /></>;
}
function EspacioTiempos({ inicial, proyectoId }: { inicial: ListaTiempos; proyectoId?: string }) {
  const [datos, setDatos] = useState(inicial), [desde, setDesde] = useState(inicial.desde), [hasta, setHasta] = useState(inicial.hasta), [seleccionado, setSeleccionado] = useState<ParteTiempo | null>(null), [error, setError] = useState<Error | null>(null), [ocupado, setOcupado] = useState(false), [retirado, setRetirado] = useState(false);
  const filtro = useRef({ desde: inicial.desde, hasta: inicial.hasta, pagina: 1 }), guard = useVigenciaTiempo();
  const [relacionado, setRelacionado] = useState<ParteTiempo | null>(null);
  const ruta = proyectoId ? '/api/tiempos/proyectos/' + proyectoId : '/api/tiempos/mios';
  async function cargar(pagina = filtro.current.pagina, cambiarFiltro = false) {
    const n = guard.siguiente(), consulta = cambiarFiltro ? { desde, hasta, pagina } : { ...filtro.current, pagina };
    setOcupado(true); setError(null);
    try {
      const r = await pedirTiempo<ListaTiempos>(ruta + '?' + new URLSearchParams({ desde: consulta.desde, hasta: consulta.hasta, pagina: String(pagina) }));
      if (!guard.vigente(n)) return;
      if (r.identidad.alcance !== inicial.identidad.alcance) { setRetirado(true); setSeleccionado(null); throw new FalloTiempo('Cambió tu autorización. Recarga la página para continuar.', 'AUTORIZACION_CAMBIADA', 403); }
      filtro.current = consulta; setDatos(r); setRetirado(false);
    } catch (e) { if (guard.vigente(n)) { setError(e as Error); if (e instanceof FalloTiempo && [401, 403].includes(e.status)) { setRetirado(true); setSeleccionado(null); } } }
    finally { if (guard.vigente(n)) setOcupado(false); }
  }
  const gestion = !!proyectoId, registrar = gestion ? datos.identidad.gestionar : datos.identidad.puedeRegistrar;
  return <div className="space-y-6">
    <Tarjeta titulo={gestion ? 'Tiempos de la obra' : 'Mis partes'}>
      <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); setSeleccionado(null); void cargar(1, true); }}><label>Desde<input aria-label="Partes desde" className="block mt-1 max-w-full" type="date" required value={desde} onChange={e => { guard.invalidar(); setOcupado(false); setDesde(e.target.value); }} /></label><label>Hasta (incluido)<input aria-label="Partes hasta" className="block mt-1 max-w-full" type="date" required value={hasta} onChange={e => { guard.invalidar(); setOcupado(false); setHasta(e.target.value); }} /></label><button className="boton" disabled={ocupado}>Consultar partes</button></form>
      {!retirado && <><p className="font-mono my-4">Trabajo real registrado en el rango: {datos.minutos} min</p>
        {!datos.partes.length && <p>No hay partes visibles en este rango.</p>}
        <ul className="divide-y divide-linea-suave">{datos.partes.map(p => <li key={p.id} className="py-3 flex flex-wrap justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{p.tarea} · {p.proyecto}</p><p>{p.tecnico}{!p.tecnicoActivo && ' · Técnico inactivo'}{p.sala ? ' · ' + p.sala : ''}</p><p className="font-mono text-xs">{p.version.entradaLocal.inicio.fecha} {p.version.entradaLocal.inicio.hora} → {p.version.entradaLocal.fin.fecha} {p.version.entradaLocal.fin.hora} · {p.version.minutos} min · {p.version.accion === 'anulacion' ? 'Anulado' : 'Vigente'}</p></div><button type="button" className="boton" onClick={() => setSeleccionado(p)}>Abrir parte {p.version.entradaLocal.inicio.fecha} {p.version.entradaLocal.inicio.hora}</button></li>)}</ul>
        <nav aria-label="Páginas de partes" className="flex flex-wrap gap-3 mt-4"><button className="boton" disabled={datos.pagina <= 1 || ocupado} onClick={() => { setSeleccionado(null); void cargar(datos.pagina - 1); }}>Partes anteriores</button><span className="self-center">Página {datos.pagina}</span><button className="boton" disabled={!datos.hayMas || ocupado} onClick={() => { setSeleccionado(null); void cargar(datos.pagina + 1); }}>Partes siguientes</button></nav>
        {!!datos.dias.length && <details className="mt-4"><summary>Minutos por día civil de Madrid</summary><ul className="font-mono mt-2">{datos.dias.map(d => <li key={d.fecha}>{d.fecha} · {d.minutos} min</li>)}</ul></details>}
      </>}
      <ErrorDeTiempo error={error} />
    </Tarjeta>
    {!retirado && seleccionado && <HistorialTiempo key={'parte:' + seleccionado.id} parte={seleccionado} gestion={gestion} cerrar={() => setSeleccionado(null)} alGuardar={() => cargar()} alAbrirRelacionado={setSeleccionado} alReclasificar={setRelacionado} />}
    {!retirado && registrar && <FormularioTiempo key={'formulario:' + (relacionado?.id ?? 'nuevo')} proyectoId={proyectoId} relacionadoInicial={relacionado ? { id: relacionado.id, descripcion: relacionado.tarea + ' · ' + relacionado.tecnico + ' · ' + relacionado.version.entradaLocal.inicio.fecha } : undefined} alGuardar={() => cargar()} />}
    {!retirado && !registrar && <Tarjeta titulo="Registro de trabajo"><p>{datos.identidad.aviso === 'VINCULO_TECNICO_NO_RESUELTO' ? 'VINCULO_TECNICO_NO_RESUELTO. El gestor debe revisar el vínculo explícito desde administración.' : 'Tu acceso permite consultar los partes propios.'}</p></Tarjeta>}
  </div>;
}
