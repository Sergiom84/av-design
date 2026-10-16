import { atenderPropuesta } from '@/lib/propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, contexto: {
    params: Promise<{
        id: string;
    }>;
}) { return atenderPropuesta(request, 'historial', await contexto.params); }
