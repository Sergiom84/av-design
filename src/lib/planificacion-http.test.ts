import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Module, { createRequire } from 'node:module';
let yo: unknown = { id: 'd4000000-0000-4000-8000-000000000001', ficticio: false, debeCambiarClave: false };
let configurada = true, falloSesion = false, falloRepo = false, lecturas = 0;
class RepositorioFalso {
    async identidad() {
        if (falloRepo)
            throw new Error('postgres URL privada clave_hash');
    }
    async leerPlan() {
        lecturas++;
        return { plan: null };
    }
}
const mod = Module as unknown as {
    _load: (s: string, p?: {
        filename?: string;
    }, ...r: unknown[]) => unknown;
};
const original = mod._load;
let atender: typeof import('./planificacion/http').atenderPlan;
try {
    mod._load = (s, p, ...r) => p?.filename?.endsWith('/planificacion/http.ts') && s === '../sesion-servidor' ? { sesionActual: async () => {
            if (falloSesion)
                throw new Error('SQL privado');
            return yo;
        } } : p?.filename?.endsWith('/planificacion/http.ts') && s === '../db' ? { sql: {}, hayConfiguracion: () => configurada } : p?.filename?.endsWith('/planificacion/http.ts') && s === './repositorio' ? { RepositorioPlanificacion: RepositorioFalso } : original.call(Module, s, p, ...r);
    atender = createRequire(import.meta.url)('./planificacion/http.ts').atenderPlan;
}
finally {
    mod._load = original;
}
const id = 'd4000000-0000-4000-8000-000000000010';
const req = (body: string, origin = 'https://av.test', headers: Record<string, string> = {}) => new Request('https://av.test/api/plan/catalogo/' + id, { method: 'PATCH', body, headers: { 'content-type': 'application/json', origin, ...headers } });
describe('Planificación HTTP: frontera segura y cuerpo estricto', () => {
    it('sesión, repositorio y configuración fallan503 sin SQL/stack ni éxito vacío', async () => {
        for (const sitio of ['sesion', 'repo', 'config']) {
            falloSesion = sitio === 'sesion';
            falloRepo = sitio === 'repo';
            configurada = sitio !== 'config';
            const r = await atender(new Request('https://av.test/api/plan/proyectos/' + id), 'proyecto', { proyectoId: id });
            assert.equal(r.status, 503);
            assert.match(r.headers.get('cache-control') ?? '', /no-store/);
            assert(!JSON.stringify(await r.json()).match(/postgres|clave_hash|SQL privado|URL privada/));
        }
        falloSesion = false;
        falloRepo = false;
        configurada = true;
    });
    it('401sinusuario y403provisional/ficticio sin consultar fuentes', async () => {
        lecturas = 0;
        for (const [valor, status] of [[null, 401], [{ ficticio: true }, 403], [{ debeCambiarClave: true }, 403]] as const) {
            yo = valor;
            assert.equal((await atender(new Request('https://av.test/api/plan/proyectos/' + id), 'proyecto', { proyectoId: id })).status, status);
        }
        assert.equal(lecturas, 0);
        yo = { id, ficticio: false, debeCambiarClave: false };
    });
    it('origen ajeno/ausente, JSON inválido y UUID no pasan al repositorio', async () => {
        for (const origen of ['https://ajeno.invalid', ''])
            assert.equal((await atender(req('{}', origen), 'trabajo', { id })).status, 403);
        for (const body of ['{', 'null', '[]', '{"version":-1}', '{"version":0,"usuarioId":"otra"}'])
            assert.equal((await atender(req(body), 'trabajo', { id })).status, 400);
        assert.equal((await atender(new Request('https://av.test/api/plan/proyectos/no-uuid'), 'proyecto', { proyectoId: 'no-uuid' })).status, 400);
    });
    it('64KiB se limita incrementalmente y por Content-Length antes de parsear', async () => {
        for (const solicitud of [req(' '.repeat(65537)), req('{}', 'https://av.test', { 'content-length': '65537' })])
            assert.equal((await atender(solicitud, 'trabajo', { id })).status, 413);
    });
});
