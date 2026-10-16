import { Cabecera, Aviso } from '@/components/ui';
import { exigirUsuario } from '@/lib/sesion-servidor';
import { sql } from '@/lib/db';
import { identidadConsulta } from '@/lib/consultas/autorizacion';
import { ambitoConsultaSchema, seleccionRequisitoConsultaSchema, uuidConsulta, type AmbitoConsulta } from '@/lib/consultas/modelo';
import { puede } from '@/lib/usuarios';
import { ConsultaLocal } from '@/components/consultas/consulta-local';
export const dynamic = 'force-dynamic';
export default async function PaginaConsultas({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const yo = await exigirUsuario();
    const p = await searchParams;
    let u;
    try {
        if (yo.ficticio || yo.debeCambiarClave)
            throw new Error();
        u = await identidadConsulta(sql, yo.id);
    }
    catch {
        return <><Cabecera titulo="Consulta local"/><Aviso tono="neutro">Se necesita una sesión activa con contraseña definitiva para usar consultas propias.</Aviso></>;
    }
    const permisos = { sala: puede(u.permisos, 'salas', 'ver'), obra: puede(u.permisos, 'salas', 'ver') && puede(u.permisos, 'proyectos', 'ver'), catalogo: puede(u.permisos, 'catalogo', 'ver') };
    if (!Object.values(permisos).some(Boolean))
        return <><Cabecera titulo="Consulta local"/><Aviso tono="neutro">No hay ámbitos disponibles con tus permisos actuales.</Aviso></>;
    const inicial = ambitoConsultaSchema.safeParse(p.tipo === 'sala' ? { tipo: 'sala', id: p.id } : p.tipo === 'obra' && typeof p.salaIds === 'string' ? { tipo: 'obra', id: p.id, salaIds: p.salaIds.split(',') } : p.tipo === 'catalogo' ? { tipo: 'catalogo' } : undefined);
    const borradorObra: AmbitoConsulta | undefined = p.tipo === 'obra' && typeof p.id === 'string' && uuidConsulta.safeParse(p.id).success && p.salaIds === undefined ? { tipo: 'obra', id: p.id, salaIds: [] } : undefined;
    const fragmentos = seleccionRequisitoConsultaSchema.safeParse({ tipo: 'documento_requisitos', id: p.requisito, extraccionId: p.extraccion, candidatoIds: typeof p.candidatos === 'string' ? p.candidatos.split(',') : undefined });
    return <><Cabecera titulo="Consulta local" descripcion="Datos técnicos con fuentes e historial propio"/><ConsultaLocal key={`${u.id}:${JSON.stringify(u.permisos)}:${fragmentos.success ? JSON.stringify(fragmentos.data) : ''}`} identidad={u.id} permisos={permisos} inicial={inicial.success ? inicial.data : borradorObra} fuenteInicial={p.tipo === 'obra' && fragmentos.success ? fragmentos.data : undefined}/></>;
}
