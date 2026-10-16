import { ejecutarHttpConsulta, leerJsonConsulta, paginaConsultaSchema } from '@/lib/consultas/http';
import { crearConsultaSchema, validar } from '@/lib/consultas/modelo';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) { return ejecutarHttpConsulta(req, false, (r, id) => { const q = validar(paginaConsultaSchema, Object.fromEntries(new URL(req.url).searchParams)); return r.listar(id, q.cursor); }); }
export async function POST(req: Request) { return ejecutarHttpConsulta(req, true, async (r, id) => r.crear(id, await leerJsonConsulta(req, crearConsultaSchema))); }
