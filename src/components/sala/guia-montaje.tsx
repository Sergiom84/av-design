import { Tarjeta, Aviso, Vacio } from '@/components/ui';
import type { FilaCable } from '@/lib/cable-schedule';
import type { Articulo, Conexion, EquipoEnSala, Puerto, TomaRed } from '@/lib/tipos';

/** Instrucciones derivadas del mismo cable schedule: no inventa un cable ni una boca. */
export function GuiaMontaje({ filas, equipos, tomas, conexiones = [], articulos = [], puertos = [] }: {
  filas: FilaCable[]; equipos: EquipoEnSala[]; tomas: TomaRed[];
  conexiones?: Conexion[]; articulos?: Articulo[]; puertos?: Puerto[];
}) {
  const conexionesPorId = new Map(conexiones.map((c) => [c.id, c]));
  const articulosPorId = new Map(articulos.map((a) => [a.id, a]));
  const puertosPorId = new Map(puertos.map((p) => [p.id, p]));
  return <Tarjeta titulo="Guía de conexión para el instalador">
    {filas.length === 0 ? <Vacio>Define las conexiones en Diagrama para generar las instrucciones.</Vacio> :
      <ol className="space-y-4">{filas.map((f) => {
        const conexion = conexionesPorId.get(f.conexion_id);
        const cable = conexion?.articulo_cable_id ? articulosPorId.get(conexion.articulo_cable_id) : undefined;
        const origen = conexion?.puerto_origen_id ? puertosPorId.get(conexion.puerto_origen_id) : undefined;
        const destino = conexion?.puerto_destino_id ? puertosPorId.get(conexion.puerto_destino_id) : undefined;
        return <li key={f.conexion_id} className="border-b border-linea-suave pb-3">
        <strong className="num">{f.identificador}</strong>
        <p>Conecta {f.origen} · <strong>{f.puerto_origen ?? 'puerto sin definir'}</strong> con {f.destino} · <strong>{f.puerto_destino ?? 'puerto sin definir'}</strong>.</p>
        <p>Boca física de origen: {conexion?.puerto_origen_ordinal ?? 'sin definir'} · Boca física de destino: {conexion?.puerto_destino_ordinal ?? 'sin definir'}.</p>
        <p>{f.articulo_cable ?? 'Cable sin asignar'} · {f.metros == null ? 'Metros sin calcular' : `${f.metros.toFixed(2)} m calculados`}. Etiqueta ambos extremos con {f.identificador}.</p>
        <p>Conector de origen: {f.conector_origen ?? 'sin documentar'} · Conector de destino: {f.conector_destino ?? 'sin documentar'}.</p>
        {cable && <p>Conectores del cable: {cable.conector_a ?? 'sin documentar'} / {cable.conector_b ?? 'sin documentar'}.</p>}
        {[
          ['Notas de conexión', conexion?.notas],
          ['Descripción del cable', cable?.descripcion],
          ['Características del cable', cable?.caracteristicas],
          ['Observaciones del cable', cable?.observaciones],
          ['Notas del puerto de origen', origen?.notas],
          ['Notas del puerto de destino', destino?.notas],
        ].filter(([, texto]) => texto?.trim()).map(([titulo, texto]) => <p key={titulo} className="whitespace-pre-wrap [overflow-wrap:anywhere]"><strong>{titulo}: </strong>{texto}</p>)}
        {f.avisos.length > 0 && <Aviso tono="aviso"><ul>{f.avisos.map((a) => <li key={a}>{a}</li>)}</ul></Aviso>}
      </li>;
      })}</ol>}
    {equipos.some((e) => e.toma_red_id) && <div className="mt-4">
      <h3 className="font-medium">Rosetas asignadas</h3>
      <ul>{equipos.filter((e) => e.toma_red_id).map((e) => <li key={e.id}>{e.nombre}: toma {tomas.find((t) => t.id === e.toma_red_id)?.codigo ?? 'sin identificar'}.</li>)}</ul>
      <p className="text-tinta-tenue">La asignación de roseta no define el puerto del equipo ni calcula ese cable.</p>
    </div>}
  </Tarjeta>;
}
