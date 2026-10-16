import { notFound } from 'next/navigation';
import { hayConfiguracion, sql } from '@/lib/db';
import { z } from 'zod';
import { obtenerProyecto } from '@/lib/datos-proyectos';
import { sesionActual } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
import { SinConfigurar } from '@/components/sin-configurar';
import { Aviso } from '@/components/ui';
import { RequisitosObra } from '@/components/requisitos/gestion';
import type { Destino } from '@/components/requisitos/tipos';
import { autorizarMetadatosRequisito } from '@/lib/requisitos/consulta';
export const dynamic = 'force-dynamic';

export default async function PaginaRequisitos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!hayConfiguracion()) return <SinConfigurar />;
  const usuario = await sesionActual();
  // No se consulta ni proyecta metadata de obra o documento antes de esta guarda.
  if (!usuario || usuario.ficticio || usuario.debeCambiarClave || ['proyectos', 'salas', 'compras'].some(s => !puede(usuario.permisos, s as 'proyectos' | 'salas' | 'compras', 'ver'))) return <Aviso tono="alerta">Acceso no disponible. Se necesita una sesión real y acceso a proyectos, salas y compras.</Aviso>;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const consulta = await searchParams;
  let documentoInicial: string | undefined;
  if (consulta.documento !== undefined) {
    const identificador = z.uuid().safeParse(consulta.documento);
    if (!identificador.success) return <Aviso tono="alerta">La fuente no está disponible.</Aviso>;
    try { await autorizarMetadatosRequisito(sql, usuario.id, identificador.data, { proyectoId: id }); documentoInicial = identificador.data; }
    catch { return <Aviso tono="alerta">La fuente no está disponible con las fuentes y permisos actuales.</Aviso>; }
  }
  const proyecto = await obtenerProyecto(id);
  if (!proyecto) notFound();
  const destinos: Destino[] = [];
  const puedeEditar = puede(usuario.permisos, 'proyectos', 'editar');
  if (puedeEditar && puede(usuario.permisos, 'salas', 'editar') && puede(usuario.permisos, 'catalogo', 'ver')) destinos.push('areas_bom');
  if (puede(usuario.permisos, 'catalogo', 'editar')) { destinos.push('catalogo', 'tecnico', 'puerto'); if (puede(usuario.permisos, 'compras', 'editar') && puede(usuario.permisos, 'parametros', 'ver')) destinos.push('ofertas'); }
  const identidad = `${usuario.id}:${JSON.stringify(usuario.permisos)}`;
  return <RequisitosObra identidad={identidad} documentoInicial={documentoInicial} obra={{ id, nombre: proyecto.nombre, localizaciones: proyecto.localizaciones, salas: proyecto.salas.map(s => ({ id: s.id, nombre: s.nombre, codigo: s.codigo })) }} puedeEditar={puedeEditar} destinos={destinos} />;
}
