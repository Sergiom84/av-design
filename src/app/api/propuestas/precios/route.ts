import { atenderPropuesta } from '@/lib/propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { return atenderPropuesta(request, 'precios'); }
