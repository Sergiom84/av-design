import { notFound } from 'next/navigation';
import { hayConfiguracion } from '@/lib/db';
import { obtenerSalaCabecera } from '@/lib/datos';
import { SinConfigurar } from '@/components/sin-configurar';
import { EstadoDiagrama } from '@/components/diagrama/estado-diagrama';

export const dynamic = 'force-dynamic';

/**
 * Diagrama: el editor de conexiones puerto a puerto.
 *
 * Todavía no existe. Esta ruta ya no monta el editor del plano en planta —eso
 * es `Plano` ahora—, así que aquí solo hay un estado que dice adónde se movió
 * y dónde sigue estando el esquema mientras tanto.
 *
 * La consulta es la cabecera de la sala y no los datos del plano: si la sala
 * no existe, esto es un 404 igual que las demás pestañas, y no una tarjeta
 * bonita sobre una sala inventada.
 */
export default async function DiagramaSala({ params }: PageProps<'/salas/[id]/diagrama'>) {
  if (!hayConfiguracion()) return <SinConfigurar />;

  const { id } = await params;
  const sala = await obtenerSalaCabecera(id);
  if (!sala) notFound();

  return <EstadoDiagrama salaId={sala.id} />;
}
