import { Boton, Campo, Enlace, ListaClaveValor, Tarjeta } from '@/components/ui';
import { guardarSala } from '@/app/acciones';
import { ETIQUETA_RUTA, type Sala } from '@/lib/tipos';

/**
 * La geometría de la sala. Es el dato que XTEN-AV no pide en ningún punto de
 * su flujo (docs/06, apartado 6) y sin el cual no hay metros que calcular.
 *
 * El formulario largo no domina el primer pantallazo: por defecto se ve una
 * lectura compacta con `Editar medidas`, que despliega el formulario por
 * `?editar=medidas` (Atrás/Adelante funcionan, no depende de JavaScript).
 *
 * Con la obra cerrada la sala es de solo lectura: el formulario no se
 * despliega aunque la dirección lleve `?editar=medidas` a mano, y no hay
 * enlace "Editar medidas" que lo sugiera. `guardarSala` rechaza el envío en
 * el servidor de todos modos; esto es solo para no enseñar un control que no
 * hace nada.
 */
export function Medidas({
  sala,
  editar = false,
  cerrado = false,
}: {
  sala: Sala;
  editar?: boolean;
  cerrado?: boolean;
}) {
  if (!editar || cerrado) {
    return (
      <Tarjeta
        titulo="Medidas y ruta"
        acciones={
          cerrado ? undefined : (
            <Enlace href={`/salas/${sala.id}?editar=medidas`}>Editar medidas</Enlace>
          )
        }
      >
        <ListaClaveValor
          items={[
            { clave: 'Sede', valor: sala.sede || '—' },
            { clave: 'Edificio · Nivel', valor: [sala.edificio, sala.nivel].filter(Boolean).join(' · ') || '—' },
            { clave: 'Tipología', valor: sala.tipologia || '—' },
            { clave: 'Aforo', valor: sala.aforo ?? '—' },
            {
              clave: 'Largo × ancho × alto',
              valor:
                sala.largo_m && sala.ancho_m && sala.alto_m
                  ? `${sala.largo_m} × ${sala.ancho_m} × ${sala.alto_m} m`
                  : 'sin medir',
            },
            { clave: 'Ruta por defecto', valor: ETIQUETA_RUTA[sala.ruta_por_defecto] },
          ]}
        />
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo="Medidas y ruta" acciones={<Enlace href={`/salas/${sala.id}`}>Cancelar</Enlace>}>
      <form action={guardarSala} className="space-y-3">
        <input type="hidden" name="id" value={sala.id} />
        <Campo etiqueta="Nombre">
          <input name="nombre" defaultValue={sala.nombre} className="w-full" />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo etiqueta="Sede">
            <input name="sede" defaultValue={sala.sede ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Edificio">
            <input name="edificio" defaultValue={sala.edificio ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Nivel">
            <input name="nivel" defaultValue={sala.nivel ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Código">
            <input name="codigo" defaultValue={sala.codigo ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Tipología">
            <input name="tipologia" defaultValue={sala.tipologia ?? ''} className="w-full" />
          </Campo>
          <Campo etiqueta="Aforo">
            <input
              name="aforo"
              type="number"
              min="0"
              defaultValue={sala.aforo ?? ''}
              className="w-full"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Largo (m)">
            <input
              name="largo_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.largo_m || ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Ancho (m)">
            <input
              name="ancho_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.ancho_m || ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Alto (m)">
            <input
              name="alto_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_m || ''}
              className="w-full"
            />
          </Campo>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Falso techo">
            <input
              name="alto_falso_techo_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_falso_techo_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Canaleta">
            <input
              name="alto_canaleta_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_canaleta_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Suelo técnico">
            <input
              name="alto_suelo_tecnico_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.alto_suelo_tecnico_m ?? ''}
              className="w-full"
            />
          </Campo>
        </div>

        {/*
          La mesa. No entra en el cálculo de cable —la tirada se mide entre
          equipos— pero es lo que convierte el croquis en el plano que se lleva
          a la obra: sin ella no hay ni mesa ni sillas que dibujar.
        */}
        <div className="grid grid-cols-3 gap-2">
          <Campo etiqueta="Mesa largo (m)">
            <input
              name="mesa_largo_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.mesa_largo_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Mesa ancho (m)">
            <input
              name="mesa_ancho_m"
              type="number"
              step="0.01"
              min="0"
              defaultValue={sala.mesa_ancho_m ?? ''}
              className="w-full"
            />
          </Campo>
          <Campo etiqueta="Mesa alto (cm)">
            <input
              name="mesa_alto_cm"
              type="number"
              step="1"
              min="0"
              defaultValue={sala.mesa_alto_cm ?? ''}
              className="w-full"
            />
          </Campo>
        </div>

        <Campo
          etiqueta="Ruta por defecto"
          ayuda="Por dónde discurren los cables salvo que la conexión diga otra cosa."
        >
          <select
            name="ruta_por_defecto"
            defaultValue={sala.ruta_por_defecto}
            className="w-full"
          >
            {Object.entries(ETIQUETA_RUTA).map(([v, e]) => (
              <option key={v} value={v}>
                {e}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Notas">
          <textarea name="notas" defaultValue={sala.notas ?? ''} rows={3} className="w-full" />
        </Campo>

        <Boton>Guardar</Boton>
      </form>
    </Tarjeta>
  );
}
