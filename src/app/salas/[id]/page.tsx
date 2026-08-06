import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { listarArticulos, obtenerParametros, obtenerSala } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso, Boton, Cabecera } from '@/components/ui';
import { borrarSala } from '../../acciones';
import {
  agruparMaterialCable,
  calcularConexion,
  dimensionarCanalizacion,
  ResultadoCable,
} from '@/lib/calculo-cable';
import { construirTablaCables } from '@/lib/cable-schedule';
import { TablaCables } from '@/components/cable-schedule/tabla-cables';
import { CroquisSala } from '@/components/croquis/croquis-sala';
import { revisarMontaje } from '@/lib/revision';
import { EstadoMontaje } from '@/components/revision/estado-montaje';
import { revisionesDeSala } from '@/lib/datos-checkin';
import { ListaVisitas } from '@/components/checkin/lista-visitas';
import { Conexiones } from '@/components/sala/conexiones';
import { Equipamiento } from '@/components/sala/equipamiento';
import { GuardarComoPlantilla } from '@/components/sala/guardar-como-plantilla';
import { MaterialAComprar } from '@/components/sala/material';
import { Medidas } from '@/components/sala/medidas';
import { ResultadoDelCable } from '@/components/sala/resultado-cable';
import { TomasDeRed } from '@/components/sala/tomas-red';
import { cargasDeSala, faltaParaSala } from '@/lib/datos-almacen';
import { ReservasDeSala } from '@/components/almacen/reservas-sala';
import { QueFalta } from '@/components/compras/falta';
import { CargasDeSala } from '@/components/carga/cargas-sala';

export const dynamic = 'force-dynamic';

/**
 * La sala es una composición de bloques, no una página. Cada bloque vive en
 * `src/components/sala/` salvo la tabla de cables, que es el entregable y
 * tiene carpeta propia en `src/components/cable-schedule/`.
 */
export default async function DetalleSala({ params }: PageProps<'/salas/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const completa = await obtenerSala(id);
  if (!completa) notFound();

  const { sala, equipos, conexiones, tomas, puertos } = completa;
  const [articulos, parametros] = await Promise.all([
    listarArticulos(),
    obtenerParametros(),
  ]);

  const porId = new Map(articulos.map((a) => [a.id, a]));
  const equiposPorId = new Map(equipos.map((e) => [e.id, e]));

  const sinMedidas = !sala.largo_m || !sala.ancho_m || !sala.alto_m;

  const resultados = sinMedidas
    ? []
    : (conexiones
        .map((c) => calcularConexion(c, sala, equiposPorId, porId, parametros))
        .filter(Boolean) as ResultadoCable[]);

  const material = agruparMaterialCable(resultados, conexiones, porId);

  const diametros = conexiones
    .map((c) => (c.articulo_cable_id ? porId.get(c.articulo_cable_id)?.diametro_mm : null))
    .filter((d): d is number => typeof d === 'number');
  const canalizacion = diametros.length
    ? dimensionarCanalizacion(diametros, parametros)
    : null;

  // Los metros los pone `calcularConexion()`, que no se toca. La tabla de
  // cables solo los presenta junto al puerto de origen y el de destino.
  // Fase 2: qué falta contra el almacén, qué hay reservado y qué se ha cargado.
  // `faltaParaSala()` rehace la misma cadena (equipos + cable → necesidad →
  // falta) para que el botón de crear pedido y esta pantalla no puedan
  // discrepar.
  const [falta, cargas, visitas] = await Promise.all([
    faltaParaSala(sala.id),
    cargasDeSala(sala.id),
    revisionesDeSala(sala.id),
  ]);

  const filasCable = construirTablaCables({
    conexiones,
    equipos: equiposPorId,
    tomas: new Map(tomas.map((t) => [t.id, t])),
    puertos: new Map(puertos.map((p) => [p.id, p])),
    articulos: porId,
    resultados: new Map(resultados.map((r) => [r.conexion_id, r])),
  });

  // Si la sala se puede montar o no no se teclea: se deriva de lo que ya hay.
  const puntosMontaje = revisarMontaje({
    sala,
    equipos,
    conexiones,
    tomas,
    resultados,
    filasCable,
    falta,
    cargas,
  });

  return (
    <>
      <Cabecera
        titulo={sala.nombre}
        descripcion={[sala.sede, sala.edificio, sala.nivel, sala.tipologia]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          <form action={borrarSala}>
            <input type="hidden" name="id" value={sala.id} />
            <Boton variante="peligro">Borrar sala</Boton>
          </form>
        }
      />

      {sinMedidas && (
        <div className="mb-6">
          <Aviso tono="alerta">
            Faltan las medidas de la sala. Sin largo, ancho y alto no se puede calcular
            ningún metro de cable.
          </Aviso>
        </div>
      )}

      {/*
        `min-w-0` en los hijos: por defecto un elemento de rejilla mide lo que
        su contenido mínimo, así que la tabla de cables —trece columnas— estiraba
        la página entera y en móvil se scrolleaba todo en bloque. Con esto el
        scroll horizontal se queda dentro de cada tarjeta, que es lo que hace
        `overflow-x-auto` en `Tarjeta`.
      */}
      <div className="grid xl:grid-cols-[22rem_1fr] gap-6 items-start [&>*]:min-w-0">
        <Medidas sala={sala} />

        <div className="space-y-6">
          {/*
            El croquis va lo primero: es lo que se mira antes de nada al abrir
            una sala, y es el entregable que se lleva a la obra junto a la tabla
            de cables. Los metros que pinta son los que calcula `calculo-cable`,
            no un cálculo suyo.
          */}
          <CroquisSala
            sala={sala}
            equipos={equipos}
            conexiones={conexiones}
            tomas={tomas}
            metrosPorConexion={
              new Map(resultados.map((r) => [r.conexion_id, r.longitud_m]))
            }
          />
          <EstadoMontaje puntos={puntosMontaje} />
          <TablaCables filas={filasCable} nombreSala={sala.nombre} />
          <ResultadoDelCable resultados={resultados} sinMedidas={sinMedidas} />
          <MaterialAComprar material={material} canalizacion={canalizacion} />
          {falta && (
            <>
              <QueFalta
                salaId={sala.id}
                faltantes={falta.faltantes}
                grupos={falta.grupos}
                sinCatalogar={falta.sinCatalogar}
              />
              <ReservasDeSala
                salaId={sala.id}
                reservas={falta.reservas}
                disponibilidad={falta.disponibilidad}
              />
              <CargasDeSala
                salaId={sala.id}
                nombreSala={sala.nombre}
                cargas={cargas}
                reservasActivas={
                  falta.reservas.filter((r) => r.estado === 'activa').length
                }
              />
            </>
          )}
          {/*
            El check-in es lo contrario del semáforo de arriba: aquello se
            deriva, esto se ve con los ojos en la sala y se marca a mano.
          */}
          <ListaVisitas
            revisiones={visitas}
            titulo="Check-in de la sala"
            vacio="Sin visitas. Se abre una desde Check-in, eligiendo esta sala."
          />
          <Equipamiento salaId={sala.id} equipos={equipos} tomas={tomas} />
          <TomasDeRed salaId={sala.id} tomas={tomas} equipos={equipos} />
          <Conexiones
            sala={sala}
            conexiones={conexiones}
            equipos={equipos}
            puertos={puertos}
            articulos={articulos}
          />
          <GuardarComoPlantilla sala={sala} equipos={equipos} />
        </div>
      </div>
    </>
  );
}
