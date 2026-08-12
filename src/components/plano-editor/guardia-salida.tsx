'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boton } from '@/components/ui';
import { destinoDeSalida, type IntentoSalida } from '@/lib/guardia-salida';

/**
 * La puerta de salida del editor del plano.
 *
 * El borrador solo se escribe al pulsar `Guardar cambios`, así que salir de la
 * pestaña Diagrama con cambios encima tiene que preguntar. `beforeunload` cubre
 * recargar y cerrar el navegador, y sigue aquí; lo que no cubría es la
 * navegación de cliente, que es la de las seis pestañas de la ficha y la de la
 * barra lateral: mover un equipo, pulsar `Resumen` y volver perdía el trabajo
 * sin un solo aviso.
 *
 * Next 16 ofrece `onNavigate` en `<Link>`, con su `preventDefault()`
 * (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`:
 * «An event handler called during client-side navigation. The handler receives
 * an event object that includes a `preventDefault()` method, allowing you to
 * cancel the navigation if needed»). Pero es por enlace, y obligaría a que cada
 * `<Link>` de la aplicación supiera que hay un plano a medio dibujar tres
 * niveles más abajo. Aquí se escucha el clic en `document` en fase de captura,
 * que llega antes que el manejador delegado de React y lo corta: el guardia
 * vive donde está el borrador y cubre cualquier enlace de la página.
 *
 * Lo que NO cubre: un `<form>` que navegue, un `router.push` llamado desde otro
 * componente, y salir a otro dominio o recargar, que eso es `beforeunload`.
 */
export function GuardiaSalida({ activo }: { activo: boolean }) {
  const router = useRouter();
  const [intento, setIntento] = useState<IntentoSalida | null>(null);

  /**
   * El estado vivo para los escuchadores nativos, que se registran una vez y
   * leerían el `activo` del render en el que se registraron.
   */
  const activoRef = useRef(activo);
  useEffect(() => {
    activoRef.current = activo;
  }, [activo]);

  /** Ya se ha decidido salir: el siguiente movimiento no se pregunta. */
  const saliendo = useRef(false);

  /**
   * Hay una entrada duplicada del historial por delante de la real.
   *
   * Es la única manera de llegar antes que el botón atrás: cuando `popstate`
   * avisa el navegador ya ha vuelto, así que se deja una entrada de sobra en la
   * que caer. Es exactamente una, y solo se repone cuando se ha consumido.
   */
  const centinela = useRef(false);
  /** Vueltas atrás provocadas por el propio guardia, que no se preguntan. */
  const ignorar = useRef(0);

  const dialogo = useRef<HTMLDivElement | null>(null);
  /** A dónde vuelve el foco si se cancela. */
  const focoPrevio = useRef<HTMLElement | null>(null);

  const idTitulo = `${useId()}t`;

  const reponerCentinela = useCallback(() => {
    window.history.pushState({ centinelaPlano: true }, '', window.location.href);
    centinela.current = true;
  }, []);

  // ------------------------------------------------- recargar y cerrar

  useEffect(() => {
    if (!activo) return;
    const avisar = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [activo]);

  // ------------------------------------------------- enlaces de la página

  useEffect(() => {
    if (!activo) return;
    const alPulsar = (ev: MouseEvent) => {
      if (saliendo.current) return;
      const objetivo = ev.target as Element | null;
      const ancla = objetivo?.closest?.('a[href]') as HTMLAnchorElement | null;
      const ruta = destinoDeSalida(
        ancla && {
          href: ancla.href,
          target: ancla.target,
          descarga: ancla.hasAttribute('download'),
        },
        window.location.href,
        ev,
      );
      if (!ruta) return;
      // Captura y `stopPropagation`: el manejador de `<Link>` está delegado en
      // la raíz de React, que es descendiente de `document`. Cortado aquí no
      // llega a ejecutarse, y no hay navegación a medias que deshacer.
      ev.preventDefault();
      ev.stopPropagation();
      focoPrevio.current = ancla;
      setIntento({ tipo: 'enlace', ruta });
    };
    document.addEventListener('click', alPulsar, true);
    return () => document.removeEventListener('click', alPulsar, true);
  }, [activo]);

  // ------------------------------------------------- botón atrás
  //
  // El escuchador no depende de `activo`: también tiene que recoger las vueltas
  // atrás que provoca el propio guardia al retirar el centinela.

  useEffect(() => {
    const alVolver = () => {
      const habia = centinela.current;
      centinela.current = false;

      if (ignorar.current > 0) {
        ignorar.current -= 1;
        // Se volvió a ensuciar mientras el centinela se retiraba: se repone, o
        // el siguiente atrás saldría sin preguntar.
        if (activoRef.current) reponerCentinela();
        return;
      }
      if (saliendo.current) return;
      if (!activoRef.current || !habia) return;

      reponerCentinela();
      focoPrevio.current = null;
      setIntento({ tipo: 'atras' });
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, [reponerCentinela]);

  useEffect(() => {
    if (!activo || centinela.current) return;
    reponerCentinela();
    return () => {
      if (!centinela.current) return;
      // Guardado o descartado: la entrada de sobra se retira, o el botón atrás
      // habría que pulsarlo dos veces para salir de la sala.
      centinela.current = false;
      ignorar.current += 1;
      window.history.back();
    };
  }, [activo, reponerCentinela]);

  // ------------------------------------------------- decisión

  const cancelar = useCallback(() => {
    setIntento(null);
    focoPrevio.current?.focus?.();
  }, []);

  const salir = () => {
    if (!intento) return;
    saliendo.current = true;
    setIntento(null);
    if (intento.tipo === 'atras') {
      centinela.current = false;
      // El centinela y la entrada real de la que se venía: dos.
      window.history.go(-2);
      return;
    }
    // `replace` y no `push`: lo que se sustituye es el centinela, así que el
    // historial queda igual que si el enlace hubiera navegado él solo.
    const habiaCentinela = centinela.current;
    centinela.current = false;
    if (habiaCentinela) router.replace(intento.ruta as never);
    else router.push(intento.ruta as never);
  };

  // El foco entra en el diálogo por la opción segura: `Seguir editando` es el
  // primer botón, y es el que no pierde nada.
  useEffect(() => {
    if (!intento) return;
    dialogo.current?.querySelector('button')?.focus();
  }, [intento]);

  /**
   * Tab y Mayúsculas+Tab no salen del diálogo: detrás hay un lienzo entero de
   * controles que ahora mismo no se pueden usar. Escape cancela, que es la
   * salida segura, y no llega al editor de debajo, donde quitaría la selección.
   */
  const teclado = (ev: React.KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      cancelar();
      return;
    }
    if (ev.key !== 'Tab') return;
    const focos = [...(dialogo.current?.querySelectorAll('button') ?? [])];
    if (focos.length === 0) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    const actual = dialogo.current?.ownerDocument.activeElement;
    if (ev.shiftKey && actual === primero) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && actual === ultimo) {
      ev.preventDefault();
      primero.focus();
    }
  };

  if (!intento) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/40 p-4"
      onKeyDown={teclado}
      // Pulsar fuera es lo mismo que Escape: quedarse.
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) cancelar();
      }}
    >
      <div
        ref={dialogo}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="tarjeta w-full max-w-md p-4"
      >
        <h2 id={idTitulo} className="t-subtitulo mb-2">
          Hay cambios sin guardar en el plano
        </h2>
        <p className="mb-4 text-tinta-tenue">
          {intento.tipo === 'atras'
            ? 'Volver atrás ahora los pierde.'
            : 'Salir de esta pestaña ahora los pierde.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Boton tipo="button" variante="principal" onClick={cancelar}>
            Seguir editando
          </Boton>
          <Boton tipo="button" variante="peligro" onClick={salir}>
            Salir sin guardar
          </Boton>
        </div>
      </div>
    </div>
  );
}
