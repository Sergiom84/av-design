import { EditorPropuestas } from '@/components/propuestas/editor';
import { SinConfigurar } from '@/components/sin-configurar';
import { hayConfiguracion } from '@/lib/db';
import { exigirSeccion } from '@/lib/sesion-servidor';
export const dynamic = 'force-dynamic';
export default async function PropuestasSala({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    if (!hayConfiguracion())
        return <SinConfigurar />;
    await exigirSeccion('salas');
    const { id } = await params;
    return <EditorPropuestas tipo="sala" id={id}/>;
}
