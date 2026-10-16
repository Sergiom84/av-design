'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
interface ResultadoVoz {
    isFinal: boolean;
    0: {
        transcript: string;
    };
}
interface EventoVoz {
    results: {
        length: number;
        [n: number]: ResultadoVoz;
    };
}
interface MotorVoz {
    processLocally: boolean;
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((e: EventoVoz) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
}
interface ConstructorVoz {
    new (): MotorVoz;
    prototype: MotorVoz;
    available?: (o: {
        langs: string[];
        processLocally: true;
    }) => Promise<string>;
}
export function obtenerMotorLocal(): ConstructorVoz | undefined { const w = window as unknown as {
    SpeechRecognition?: ConstructorVoz;
}; const c = w.SpeechRecognition; return c && 'processLocally' in c.prototype && typeof c.available === 'function' ? c : undefined; }
/** Sólo on-device. No install(), constructor prefijado, descarga ni fallback remoto. */
export function DictadoLocal({ onFinal, identidad }: {
    onFinal: (texto: string) => void;
    identidad: string;
}) {
    const [disponible, setDisponible] = useState(false), [activo, setActivo] = useState(false), [parcial, setParcial] = useState(''), [aviso, setAviso] = useState('Dictado local no disponible');
    const motor = useRef<MotorVoz | null>(null), sesion = useRef(0), callback = useRef(onFinal);
    const liberar = useCallback(() => {
        sesion.current++;
        const m = motor.current;
        if (m) {
            m.onresult = null;
            m.onerror = null;
            m.onend = null;
            m.abort();
        }
        motor.current = null;
    }, []);
    useEffect(() => { callback.current = onFinal; }, [onFinal]);
    useEffect(() => { let vivo = true; const c = obtenerMotorLocal(); if (c)
        void c.available!({ langs: ['es-ES'], processLocally: true }).then(estado => { if (vivo && estado === 'available') {
            setDisponible(true);
            setAviso('Dictado local en español disponible. El micrófono sólo se activa al pulsar Iniciar.');
        } }).catch(() => { }); return () => { vivo = false; liberar(); }; }, [identidad, liberar]);
    const cancelar = () => { liberar(); setActivo(false); setParcial(''); };
    const iniciar = async () => {
        const c = obtenerMotorLocal();
        if (!c)
            return;
        const token = ++sesion.current;
        try {
            if (await c.available!({ langs: ['es-ES'], processLocally: true }) !== 'available' || token !== sesion.current)
                return;
            const m = new c();
            m.processLocally = true;
            if (m.processLocally !== true) {
                setAviso('Dictado local no disponible');
                return;
            }
            m.lang = 'es-ES';
            m.continuous = true;
            m.interimResults = true;
            motor.current = m;
            const entregados = new Set<number>();
            m.onresult = e => { if (token !== sesion.current)
                return; const finales: string[] = [], parciales: string[] = []; for (let i = 0; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) {
                    if (!entregados.has(i)) {
                        entregados.add(i);
                        finales.push(r[0].transcript);
                    }
                }
                else
                    parciales.push(r[0].transcript);
            } if (finales.length)
                callback.current(finales.join(' ')); setParcial(parciales.join(' ')); };
            m.onerror = () => { if (token !== sesion.current)
                return; setAviso('No se ha podido usar el micrófono local. Tu borrador sigue disponible.'); cancelar(); };
            m.onend = () => { if (token === sesion.current) {
                motor.current = null;
                setActivo(false);
                setParcial('');
            } };
            setAviso('Procesamiento local en este dispositivo. Revisa el texto antes de consultar.');
            m.start();
            setActivo(true);
        }
        catch {
            if (token === sesion.current) {
                cancelar();
                setAviso('Dictado local no disponible. Puedes escribir la pregunta.');
            }
        }
    };
    return <div className="mt-3 text-sm text-[var(--tinta-tenue)]"><p role="status">{aviso}</p>{disponible && <div className="mt-2 flex flex-wrap gap-2">{!activo ? <button className="boton" type="button" onClick={() => void iniciar()}>Iniciar dictado local</button> : <><button className="boton" type="button" onClick={() => motor.current?.stop()}>Parar dictado</button><button className="boton" type="button" onClick={cancelar}>Cancelar dictado</button></>}</div>}{parcial && <p aria-live="polite" className="mt-2">Borrador de voz: {parcial}</p>}</div>;
}
