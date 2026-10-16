import { Seguimiento } from '@/components/seguimiento-propuestas/seguimiento';
import { SinConfigurar } from '@/components/sin-configurar';
import { hayConfiguracion } from '@/lib/db';
import { exigirSeccion } from '@/lib/sesion-servidor';
import { puede } from '@/lib/usuarios';
export const dynamic = 'force-dynamic';
export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    if (!hayConfiguracion()) return <SinConfigurar />;
    const u = await exigirSeccion('salas');
    if (u.ficticio || u.debeCambiarClave) return <p role="alert">Se necesita una identidad real con contraseña definitiva.</p>;
    const p = await searchParams, query = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) for (const valor of Array.isArray(v) ? v : v ? [v] : []) query.append(k, valor);
    const primero = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
    const propuestaInicial = primero(p.propuesta), revisionInicial = primero(p.revision), tipo = primero(p.tipo), id = primero(p.id);
    if (tipo === 'obra') await exigirSeccion('proyectos');
    const contexto: { tipo: 'sala' | 'obra'; id: string } | undefined = (tipo === 'sala' || tipo === 'obra') && id ? { tipo, id } : undefined;
    const consulta = new URLSearchParams(query); consulta.delete('revision');
    return <Seguimiento propuestaInicial={propuestaInicial} revisionInicial={revisionInicial} puedeImportes={puede(u.permisos, 'compras', 'ver')} contexto={contexto} consultaInicial={consulta.toString()} />;
}
