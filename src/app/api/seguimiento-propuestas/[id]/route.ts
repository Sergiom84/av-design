import { atenderSeguimiento } from '@/lib/seguimiento-propuestas/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) { return atenderSeguimiento(req, 'detalle', await params); }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) { return atenderSeguimiento(req, 'detalle', await params); }
