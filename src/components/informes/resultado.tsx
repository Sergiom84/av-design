'use client';
import { useEffect, useState } from 'react';
import type { SnapshotInforme, ManifiestoInforme, ConfiguracionInforme } from '@/lib/informes/modelo';
export interface EjecucionUI {
    id: string;
    estado: string;
    caducada?: boolean;
    propietario_id: string;
    definicion_id: string;
    ocurrencia_utc: string;
    intento_actual: number;
    error_codigo: string | null;
    error_mensaje: string | null;
    caduca_en: string | null;
    revocada_en: string | null;
    definicion_snapshot: {
        nombre: string;
        version: number;
        configuracion: ConfiguracionInforme;
    };
    manifiesto: ManifiestoInforme | null;
    snapshot?: SnapshotInforme | null;
    receptores?: {
        usuario_id: string;
        nombre: string | null;
        excluido_codigo: string | null;
        revocado_en: string | null;
        origenes: unknown[];
    }[];
}
export function Resultado({ ejecucion: e, propietario, reintentar, revocar }: {
    ejecucion: EjecucionUI;
    propietario: boolean;
    reintentar: () => Promise<void>;
    revocar: () => Promise<void>;
}) {
    const s = e.snapshot;
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setAhora(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);
    const disponible = e.estado === 'correcta' && !e.revocada_en && !!e.caduca_en && +new Date(e.caduca_en) > ahora;
    return <section className="space-y-3" aria-label="Resultado del informe">

    <h2 className="text-lg font-semibold">{e.definicion_snapshot.nombre} · {e.estado}</h2>

    <p className="text-sm">Ejecución {e.id} · prevista {e.ocurrencia_utc} · intento {e.intento_actual}/3</p>

    {e.error_mensaje && <p role="alert" className="text-red-700">{e.error_mensaje} ({e.error_codigo})</p>}

        {e.manifiesto && <>

        <p>Revisión <span className="font-mono">

        {e.manifiesto.revision}

        </span> · {disponible ? 'Disponible en la aplicación' : (e.caducada || !!e.caduca_en && +new Date(e.caduca_en) <= ahora) ? 'Último correcto caducado' : 'Descarga no disponible'}</p>

        <p className="text-sm">Entrega externa sin configurar.</p>

            {disponible && <div className="flex flex-wrap gap-3">

            {e.manifiesto.archivos.map(a => <a className="boton" href={`/api/informes/ejecuciones/${e.id}/archivos/${a.id}`} key={a.id}>Descargar {a.formato.toUpperCase()} ({a.bytes} bytes)</a>)}

            <a className="boton" href={`/api/informes/ejecuciones/${e.id}/archivos/manifiesto`}>Descargar manifiesto</a>

            </div>}

        </>}

        {s && <>

        <dl className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-2">

        <div>

        <dt className="font-semibold">Observado</dt>

        <dd>

        {s.observadoEn}

        </dd>

        </div>

        <div>

        <dt className="font-semibold">Ámbito</dt>

        <dd>{s.ambito.nombre} · {s.ambito.salas.length} salas</dd>

        </div>

        <div className="sm:col-span-2">

        <dt className="font-semibold">Período y zona</dt>

        <dd className="min-w-0 [overflow-wrap:anywhere]">

        {JSON.stringify(s.periodo)}

        </dd>

        </div>

        </dl>

            {s.resumen && <dl className="grid min-w-0 grid-cols-1 gap-2 text-sm sm:grid-cols-3">

                {Object.entries(s.resumen).map(([k, v]) => <div key={k}>

                <dt>

                {k === 'importe_necesidad_conocido_eur' ? 'Subtotal conocido de necesidad (€)' : k === 'importe_compra_conocido_eur' ? 'Subtotal conocido de compra (€)' : 'Artículos sin precio'}

                </dt>

                <dd className="font-mono">

                {v ?? 'Sin importes conocidos'}

                </dd>

                </div>)}

            </dl>}

        {s.resumen && <p className="text-sm text-slate-600">Los importes vacíos no son cero. Los subtotales sólo incluyen importes conocidos y pueden ser parciales.</p>}

            {s.avisos.length > 0 && <ul className="list-disc pl-5 text-sm">

                {s.avisos.map((a, i) => <li key={i}>

                {a}

                </li>)}

            </ul>}

        <div className="overflow-x-auto">

        <table className="w-full text-left text-sm">

        <caption className="py-2 text-left">{s.filas.length} filas de la captura conservada</caption>

        <thead>

        <tr>

            {s.columnas.map(c => <th key={c.clave} className="border-b p-2">

            {c.titulo}

            </th>)}

        <th className="border-b p-2">Detalle</th>

        </tr>

        </thead>

        <tbody>

            {s.filas.map(f => <tr key={f.clave}>

                {s.columnas.map(c => <td className="whitespace-pre-wrap border-b p-2 align-top" key={c.clave}>

                {f.valores[c.clave] == null ? '—' : typeof f.valores[c.clave] === 'boolean' ? f.valores[c.clave] ? 'Sí' : 'No' : String(f.valores[c.clave])}

                </td>)}

            <td className="border-b p-2">

            {f.enlace && <a className="underline" href={f.enlace}>Abrir detalle actual</a>}

            </td>

            </tr>)}

        </tbody>

        </table>

        </div>

        </>}

        {propietario && e.receptores && <section aria-label="Audiencia de la ejecución">

        <h3 className="font-semibold">Audiencia de esta ejecución</h3>

        <ul className="text-sm">

        {e.receptores.map(r => <li key={r.usuario_id}>{r.nombre ?? r.usuario_id} · {r.excluido_codigo ? `Excluido: ${r.excluido_codigo}` : r.revocado_en ? 'Acceso revocado' : 'Incluido al encolar'}</li>)}

        </ul>

        </section>}

        {propietario && <div className="flex flex-wrap gap-3">

        {['fallida', 'bloqueada'].includes(e.estado) && e.intento_actual < 3 && <button className="boton" type="button" onClick={() => void reintentar()}>Reintentar la misma captura</button>}

        {!e.revocada_en && <button className="boton" type="button" onClick={() => void revocar()}>Revocar acceso a esta ejecución</button>}

        </div>}

    </section>;
}
