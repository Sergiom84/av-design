import type { fichaDeSala } from '@/app/salas/[id]/datos-ficha';
import type { PuertaEnSala } from '@/lib/tipos';
import { construirAcotaciones } from '@/lib/acotaciones';
import { CroquisSala } from '@/components/croquis/croquis-sala';
import { EstadoAcotaciones } from '@/components/acotaciones/estado-acotaciones';
import { TablaCables } from '@/components/cable-schedule/tabla-cables';
import { GuiaMontaje } from '@/components/sala/guia-montaje';
import { MaterialAComprar } from '@/components/sala/material';
import { MaterialComercial } from '@/components/sala/material-comercial';
import { ContenedorTabla, Tarjeta, Vacio } from '@/components/ui';
import { EstilosPaquete } from './estilos-paquete';

export type FichaPaquete = Pick<NonNullable<Awaited<ReturnType<typeof fichaDeSala>>>,
  'sala' | 'equipos' | 'conexiones' | 'tomas' | 'muebles' | 'puertos' | 'articulos' | 'filasCable' | 'resultados' | 'material' | 'canalizacion' | 'suministro' | 'necesidad'>;

/** Presentación de la ficha canónica; no calcula cables ni modifica el montaje. */
export function PaqueteTecnico({ ficha, puertas, emitido }: { ficha: FichaPaquete; puertas: PuertaEnSala[]; emitido: string }) {
  const { sala, equipos, conexiones, tomas, muebles, filasCable, puertos, articulos, material, canalizacion } = ficha;
  const escena = construirAcotaciones({ sala, equipos, tomas, puertas });
  return <>
    <EstilosPaquete />
    <article id="paquete-tecnico" aria-label="Paquete técnico de la sala">
      <header>
        <h2 className="t-subtitulo">Paquete técnico · {sala.nombre}</h2>
        <p>{[sala.codigo, sala.proyecto, sala.localizacion, sala.sede].filter(Boolean).join(' · ')}</p>
        <p className="text-tinta-tenue">Emitido: {emitido}</p>
        {sala.notas && <p className="whitespace-pre-wrap">{sala.notas}</p>}
      </header>
      <section aria-label="Plano de la sala">
        <CroquisSala sala={sala} equipos={equipos} conexiones={conexiones} tomas={tomas} muebles={muebles} puertas={puertas}
          metrosPorConexion={new Map(ficha.resultados.map((r) => [r.conexion_id, r.longitud_m]))} />
      </section>
      <section aria-label="Cotas y elevaciones">
        <h2 className="t-subtitulo mb-4">Cotas y elevaciones</h2>
        <EstadoAcotaciones salaId={sala.id} escena={escena} />
      </section>
      <section aria-label="Conexiones y bocas físicas">
        <TablaCables filas={filasCable} nombreSala={sala.nombre} />
        <GuiaMontaje filas={filasCable} equipos={equipos} tomas={tomas} conexiones={conexiones} articulos={articulos} puertos={puertos} />
      </section>
      <section aria-label="Lista de material">
        {ficha.suministro.componentes.length > 0 || ficha.suministro.bloqueoComercial ? <MaterialComercial necesidad={ficha.necesidad} suministro={ficha.suministro} /> : null}
        <Tarjeta titulo="Equipos de la sala">
          {equipos.length === 0 ? <Vacio>Sin equipos registrados.</Vacio> : <ContenedorTabla etiqueta="Equipos de la sala">
            <table className="datos"><thead><tr><th>Equipo</th><th>Referencia</th><th>Cantidad</th></tr></thead>
              <tbody>{equipos.map((e) => {
                const articulo = articulos.find((a) => a.id === e.articulo_id);
                const incluido = ficha.suministro.componentes.some((p) => p.equipo_id === e.id);
                return <tr key={e.id}><td>{e.nombre}{incluido && <span className="block text-tinta-tenue">Incluido en kit</span>}</td><td>{articulo ? [articulo.marca, articulo.modelo].filter(Boolean).join(' ') : 'Fuera de catálogo'}</td><td>{e.cantidad}</td></tr>;
              })}</tbody>
            </table>
          </ContenedorTabla>}
        </Tarjeta>
        {material.length ? <MaterialAComprar material={material} canalizacion={canalizacion} salaId={sala.id} /> : <Tarjeta titulo="Cable y consumibles"><Vacio>Sin material de cable calculado.</Vacio></Tarjeta>}
      </section>
    </article>
  </>;
}
