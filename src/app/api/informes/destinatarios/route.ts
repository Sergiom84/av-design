import { atenderInforme } from '@/lib/informes/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    return atenderInforme(request, 'destinatarios');
}
