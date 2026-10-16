import { atenderPropuesta } from '@/lib/propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, contexto: {
    params: Promise<{
        id: string;
    }>;
}) { return atenderPropuesta(request, 'actualizar', await contexto.params); }
