'use client';

import { Boton } from '@/components/ui';
import { tablaCablesACsv, type FilaCable } from '@/lib/cable-schedule';

/**
 * Descarga la tabla de cables en CSV. Sin librerías: un Blob y un enlace, que
 * es todo lo que hace falta. Es lo que el técnico se lleva a obra impreso.
 *
 * Lleva BOM UTF-8 porque si no Excel se come los acentos de "Señal" y
 * "Micrófono", y el fichero llega ilegible al departamento.
 */
export function ExportarCsv({ filas, nombreSala }: { filas: FilaCable[]; nombreSala: string }) {
  const descargar = () => {
    const csv = '﻿' + tablaCablesACsv(filas);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cables-${nombreSala.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Boton tipo="button" variante="secundario" onClick={descargar}>
      Exportar CSV
    </Boton>
  );
}
