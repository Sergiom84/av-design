'use client';
import { ETIQUETA_OPERACION, type OperacionDiagrama } from '@/lib/operaciones-diagrama';
import type { useEditorConexiones } from './use-editor-conexiones';
import { Boton } from '@/components/ui';

export function HerramientasOrganizacion({ editor: e }: { editor: ReturnType<typeof useEditorConexiones> }) {
  return <section className="mb-4 space-y-3 rounded-lg border border-linea p-3" aria-label="Organizar posiciones visuales">
    <div className="flex flex-wrap items-center gap-2">
      <Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia)} onClick={() => e.setSeleccionEquipos(e.equipos.map(eq => eq.id))}>Seleccionar todos</Boton>
      <Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia) || !e.seleccionEquipos.length} onClick={() => e.setSeleccionEquipos([])}>Quitar selección</Boton>
      <span className="text-xs text-tinta-tenue" aria-live="polite">{e.seleccionEquipos.length} equipos seleccionados</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {(Object.entries(ETIQUETA_OPERACION) as [OperacionDiagrama, string][]).map(([operacion, texto]) => <Boton key={operacion} tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia) || e.seleccionEquipos.length < 2} onClick={() => e.previsualizar(operacion)}>{texto}</Boton>)}
      <Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia) || !e.puedeDeshacer} onClick={e.deshacer}>Deshacer posición</Boton>
      <Boton tipo="button" variante="secundario" disabled={e.bloqueado || Boolean(e.vistaPrevia) || !e.puedeRehacer} onClick={e.rehacer}>Rehacer posición</Boton>
    </div>
    {e.vistaPrevia && <div className="flex flex-wrap items-center gap-2 bg-acento-suave p-3" role="status">
      <span>Vista previa de posiciones visuales.</span>
      <Boton tipo="button" disabled={e.bloqueado} onClick={e.aplicarVistaPrevia}>Aplicar posiciones</Boton>
      <Boton tipo="button" variante="secundario" onClick={e.cancelarVistaPrevia}>Cancelar vista previa</Boton>
    </div>}
  </section>;
}
