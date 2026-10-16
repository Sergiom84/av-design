import { notFound } from 'next/navigation';
import { hayConfiguracion, sql } from '@/lib/db';
import {
  obtenerArticulo,
  preciosDeArticulo,
  puertosDeArticulo,
  usosDeArticulo,
  SIN_MARCA,
} from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { TablaPrecios } from '@/components/precios/tabla-precios';
import { TablaPuertos } from '@/components/puertos/tabla-puertos';
import { Aviso, Boton, Cabecera, Campo, Enlace, Tarjeta } from '@/components/ui';
import { desactivarArticulo, guardarArticulo } from '../../acciones';
import { ETIQUETA_SENAL } from '@/lib/tipos';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { permisoCatalogoTecnico } from '@/lib/catalogo-tecnico';
import { obtenerDatosTecnicos } from '@/lib/catalogo-tecnico-repositorio';
import { FichaTecnicaArticulo } from '@/components/catalogo-tecnico/ficha-tecnica';
import { puedeUsarFavoritos } from '@/lib/catalogo-favoritos';
import { esArticuloFavorito } from '@/lib/catalogo-favoritos-repositorio';
import { BotonFavorito } from '@/components/catalogo-favoritos/boton-favorito';
import { PlanesRequisitos } from '@/lib/requisitos/planes';
import { decisionesSchema, uuid, type Decisiones } from '@/lib/requisitos/modelo';
import type { PrefillRequisito } from '@/components/catalogo-tecnico/ficha-tecnica';

export const dynamic = 'force-dynamic';

export default async function FichaArticulo({ params,searchParams }: PageProps<'/articulo/[id]'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const usuario = await exigirSeccion('catalogo', 'ver');
  const [articulo, usos, precios, puertos] = await Promise.all([
    obtenerArticulo(id),
    usosDeArticulo(id),
    preciosDeArticulo(id),
    puertosDeArticulo(id),
  ]);
  if (!articulo) notFound();
  const fichaTecnica = await obtenerDatosTecnicos(sql, usuario, id);
  let requisitoTecnico:PrefillRequisito<Extract<Decisiones,{destino:'tecnico'}>>|undefined;
  let requisitoPuerto:PrefillRequisito<Extract<Decisiones,{destino:'puerto'}>>|undefined;
  let errorRequisito=false;
  const consulta=await searchParams;
  if(consulta.requisitoPlan){
    try{
      const planId=uuid.parse(consulta.requisitoPlan);
      const plan=await new PlanesRequisitos(sql).obtener(usuario.id,planId);
      const wrapper=plan.decisiones as {datos?:unknown;revisadoPor?:string};
      const d=decisionesSchema.parse(wrapper.revisadoPor?wrapper.datos:plan.decisiones);
      if(plan.estado!=='borrador'||!('articuloId' in d)||d.articuloId!==id)throw new Error('Destino no disponible.');
      if(d.destino==='tecnico')requisitoTecnico={planId,version:plan.version,decisiones:d};
      else if(d.destino==='puerto')requisitoPuerto={planId,version:plan.version,decisiones:d};
      else throw new Error('Destino no disponible.');
    }catch{errorRequisito=true;}
  }
  const favorito = puedeUsarFavoritos(usuario) ? await esArticuloFavorito(sql, usuario, id) : null;

  const marca = articulo.marca ?? SIN_MARCA;
  const esCable = articulo.tipo !== 'equipo';
  const enUso = usos.plantillas + usos.salas + usos.conexiones + usos.materialBom;

  return (
    <>
      <div className="text-tinta-tenue mb-2">
        <Enlace href="/catalogo">Catálogo</Enlace> /{' '}
        <Enlace href={`/catalogo/${encodeURIComponent(marca)}`}>{marca}</Enlace> /{' '}
        <Enlace
          href={`/catalogo/${encodeURIComponent(marca)}/${encodeURIComponent(articulo.categoria)}`}
        >
          {articulo.categoria}
        </Enlace>
      </div>

      <Cabecera
        titulo={articulo.modelo}
        descripcion={[
          articulo.marca,
          articulo.categoria,
          articulo.unidades_instaladas
            ? `${articulo.unidades_instaladas} unidades instaladas`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        acciones={
          enUso === 0 ? (
            <form action={desactivarArticulo}>
              <input type="hidden" name="id" value={articulo.id} />
              <Boton variante="peligro">Retirar del catálogo</Boton>
            </form>
          ) : undefined
        }
      />

      {enUso > 0 && (
        <div className="mb-6">
          <Aviso tono="neutro">
            En uso: {usos.plantillas} plantilla{usos.plantillas === 1 ? '' : 's'},{' '}
            {usos.salas} sala{usos.salas === 1 ? '' : 's'}
            {usos.conexiones > 0 && `, ${usos.conexiones} conexiones`}
            {usos.materialBom > 0 && `, ${usos.materialBom} partidas de BOM`}. No se puede
            retirar del catálogo mientras esté en uso.
          </Aviso>
        </div>
      )}

      {favorito !== null && <div className="mb-6"><BotonFavorito articuloId={articulo.id} inicial={favorito} /></div>}
      {errorRequisito&&<div className="mb-6"><Aviso>La propuesta del documento ya no está disponible para esta ficha. Abre la revisión actual desde la obra.</Aviso></div>}

      <form action={guardarArticulo} className="grid gap-6 xl:grid-cols-2 items-start">
        <input type="hidden" name="id" value={articulo.id} />

        <div className="space-y-6">
          <Tarjeta titulo="Identificación">
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo etiqueta="Marca">
                <input name="marca" defaultValue={articulo.marca ?? ''} className="w-full" />
              </Campo>
              <Campo etiqueta="Modelo">
                <input name="modelo" defaultValue={articulo.modelo} required className="w-full" />
              </Campo>
              <Campo
                etiqueta="Sección"
                ayuda="Es la que agrupa la marca en el catálogo: PANEL TACTIL, MICROFONO, VIDEOCONFERENCIA…"
              >
                <input
                  name="categoria"
                  defaultValue={articulo.categoria}
                  required
                  className="w-full"
                />
              </Campo>
              <Campo etiqueta="Unidad">
                <select name="unidad" defaultValue={articulo.unidad} className="w-full">
                  <option value="ud">Unidad</option>
                  <option value="m">Metro</option>
                </select>
              </Campo>
            </div>
            <div className="mt-3">
              <Campo etiqueta="Descripción" ayuda="Una línea, la que se ve en los listados.">
                <input
                  name="descripcion"
                  defaultValue={articulo.descripcion ?? ''}
                  className="w-full"
                />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Precio y compra">
            <div className="grid sm:grid-cols-2 gap-3">
              <Campo etiqueta="Coste (€)" ayuda="Lo que os cuesta a vosotros.">
                <input
                  name="coste"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={articulo.coste ?? ''}
                  className="w-full num"
                />
              </Campo>
              <Campo
                etiqueta="Tipo de precio"
                ayuda="Marcado: es una referencia para dimensionar. Sin marcar: es el precio real de compra."
              >
                <label className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    name="coste_orientativo"
                    defaultChecked={articulo.coste_orientativo}
                  />
                  Orientativo
                </label>
              </Campo>
              <Campo etiqueta="PVP (€)" ayuda="Lo que se repercute, si aplica.">
                <input
                  name="pvp"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={articulo.pvp ?? ''}
                  className="w-full num"
                />
              </Campo>
              <Campo etiqueta="Proveedor">
                <input
                  name="proveedor"
                  defaultValue={articulo.proveedor ?? ''}
                  className="w-full"
                />
              </Campo>
              <Campo etiqueta="Plazo de entrega (días)">
                <input
                  name="plazo_dias"
                  type="number"
                  min="0"
                  defaultValue={articulo.plazo_dias ?? ''}
                  className="w-full num"
                />
              </Campo>
              <Campo etiqueta="Stock mínimo">
                <input
                  name="stock_minimo"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={articulo.stock_minimo ?? ''}
                  className="w-full num"
                />
              </Campo>
            </div>
          </Tarjeta>
        </div>

        <div className="space-y-6">
          <Tarjeta titulo="Características">
            <Campo
              etiqueta="Ficha técnica"
              ayuda="Resolución, potencia, puertos, montaje, alimentación… lo que haga falta saber al diseñar."
            >
              <textarea
                name="caracteristicas"
                rows={8}
                defaultValue={articulo.caracteristicas ?? ''}
                className="w-full"
              />
            </Campo>
          </Tarjeta>

          <Tarjeta titulo="Observaciones">
            <Campo
              etiqueta="Notas del departamento"
              ayuda="Incidencias conocidas, compatibilidades, con qué no funciona, qué vigilar en la instalación."
            >
              <textarea
                name="observaciones"
                rows={6}
                defaultValue={articulo.observaciones ?? ''}
                className="w-full"
              />
            </Campo>
          </Tarjeta>

          {esCable && (
            <Tarjeta
              titulo="Datos de cable"
              pie="El diámetro se usa para dimensionar la canaleta; las longitudes comerciales, para ajustar cada tirada al latiguillo que se compra."
            >
              <div className="grid sm:grid-cols-2 gap-3">
                <Campo etiqueta="Señal">
                  <select
                    name="senal"
                    defaultValue={articulo.senal ?? ''}
                    className="w-full"
                  >
                    <option value="">—</option>
                    {Object.entries(ETIQUETA_SENAL).map(([v, e]) => (
                      <option key={v} value={v}>
                        {e}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo etiqueta="Diámetro (mm)">
                  <input
                    name="diametro_mm"
                    type="number"
                    step="0.1"
                    min="0"
                    defaultValue={articulo.diametro_mm ?? ''}
                    className="w-full num"
                  />
                </Campo>
                <Campo etiqueta="Conector A">
                  <input
                    name="conector_a"
                    defaultValue={articulo.conector_a ?? ''}
                    className="w-full"
                  />
                </Campo>
                <Campo etiqueta="Conector B">
                  <input
                    name="conector_b"
                    defaultValue={articulo.conector_b ?? ''}
                    className="w-full"
                  />
                </Campo>
                <Campo
                  etiqueta="Longitudes comerciales (m)"
                  ayuda="Separadas por espacios o comas. Vacío = cable a metros."
                >
                  <input
                    name="longitudes_comerciales_m"
                    defaultValue={articulo.longitudes_comerciales_m?.join(' ') ?? ''}
                    className="w-full"
                  />
                </Campo>
                <Campo etiqueta="Metros por bobina">
                  <input
                    name="bobina_m"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={articulo.bobina_m ?? ''}
                    className="w-full num"
                  />
                </Campo>
              </div>
            </Tarjeta>
          )}

          <Boton>Guardar ficha</Boton>
        </div>
      </form>

      {/* Fuera del formulario de la ficha: un formulario no puede anidarse. */}
      <div className="mt-6">
        <FichaTecnicaArticulo articuloId={articulo.id} marca={articulo.marca} modelo={articulo.modelo}
          key={requisitoTecnico?.planId??articulo.id} ficha={fichaTecnica} puedeEditar={permisoCatalogoTecnico(usuario, 'editar')} requisito={requisitoTecnico} />
      </div>
      <div className="mt-6">
        <TablaPuertos articuloId={articulo.id} puertos={puertos} requisito={requisitoPuerto} />
      </div>

      {precios.length > 0 && (
        <div className="mt-6">
          <TablaPrecios precios={precios} unidad={articulo.unidad} />
        </div>
      )}
    </>
  );
}
