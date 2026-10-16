import { exigirUsuario } from '@/lib/sesion-servidor';
import { sql, hayConfiguracion } from '@/lib/db';
import { puede } from '@/lib/usuarios';
import { GestorInformes } from '@/components/informes/gestor';
import type { OpcionAmbito } from '@/components/informes/definicion';
import { identidadActual, autorizarAmbitoInforme } from '@/lib/informes/autorizacion';
import { CLAVES, type ClaveInforme } from '@/lib/informes/modelo';
import { inicioInformeDesdeEnlace } from '@/lib/informes/seleccion-inicial';
export const dynamic = 'force-dynamic';
export default async function PaginaInformes({ searchParams }: PageProps<'/cuenta/informes'>) {
    const yo = await exigirUsuario();
    if (!hayConfiguracion())
        return <p>La base de datos no está configurada.</p>;
    let datos: {
        claves: ClaveInforme[];
        opciones: OpcionAmbito[];
        admin: boolean;
    } | null = null;
    try {
        const u = await identidadActual(sql, yo.id);
        const claves: ClaveInforme[] = CLAVES.filter(clave => {
            try {
                autorizarAmbitoInforme(u, { clave, ambito: { tipo: 'sala', id: yo.id } });
                return true;
            }
            catch {
                return false;
            }
        });
        const opciones: OpcionAmbito[] = [];
        if (puede(u.permisos, 'salas', 'ver')) {
            const salas = await sql `select id,nombre,codigo from salas order by nombre,id limit 500`;
            opciones.push(...salas.map(s => ({ id: s.id, nombre: `${s.nombre}${s.codigo ? ` (${s.codigo})` : ''}`, tipo: 'sala' as const })));
        }
        if (puede(u.permisos, 'proyectos', 'ver')) {
            const obras = await sql `select id,nombre from proyectos order by nombre,id limit 500`;
            const sedes = await sql `select id,nombre from sedes order by nombre,id limit 500`;
            opciones.push(...obras.map(s => ({ id: s.id, nombre: s.nombre, tipo: 'obra' as const })), ...sedes.map(s => ({ id: s.id, nombre: s.nombre, tipo: 'sede' as const })));
        }
        datos = { claves, opciones, admin: u.rol === 'admin' && puede(u.permisos, 'usuarios', 'editar') };
    }
    catch {
        datos = null;
    }
    if (!datos)
        return <p role="alert">El servicio de informes no está disponible.</p>;
    if (!datos.claves.length)
        return <p>No tienes acceso a las fuentes de ningún informe.</p>;
    const inicio = inicioInformeDesdeEnlace(await searchParams, datos.claves, datos.opciones);
    return <GestorInformes key={JSON.stringify(inicio)} usuarioId={yo.id} {...datos} inicio={inicio}/>;
}
