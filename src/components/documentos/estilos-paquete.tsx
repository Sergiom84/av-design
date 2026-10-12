/** Estilos presentes solo en Documentos; el marcador limita su efecto de impresión. */
export function EstilosPaquete() {
  return <style>{`
    #paquete-tecnico { min-width: 0; overflow-wrap: anywhere; }
    #paquete-tecnico > section { margin-top: 1.5rem; }
    @media print {
      @page paquete-tecnico { size: A4 landscape; margin: 12mm; }
      body:has(#paquete-tecnico) *:not(#paquete-tecnico):not(#paquete-tecnico *):not(:has(#paquete-tecnico)) { display: none !important; }
      body:has(#paquete-tecnico), body:has(#paquete-tecnico) *:has(#paquete-tecnico) {
        display: block !important; position: static !important;
        width: auto !important; max-width: none !important; min-width: 0 !important;
        height: auto !important; min-height: 0 !important; overflow: visible !important;
        margin: 0 !important; padding: 0 !important;
      }
      #paquete-tecnico { page: paquete-tecnico; font-size: 10pt; }
      #paquete-tecnico button, #paquete-tecnico a[href$="/plano"] { display: none !important; }
      #paquete-tecnico .tarjeta { box-shadow: none; break-inside: avoid; }
      #paquete-tecnico .contenedor-tabla { overflow: visible !important; max-height: none !important; }
      #paquete-tecnico table { width: 100%; min-width: 0; table-layout: fixed; font-size: 8pt; }
      #paquete-tecnico th, #paquete-tecnico td { white-space: normal !important; overflow-wrap: anywhere; padding: 4px; }
      #paquete-tecnico thead { display: table-header-group; }
      #paquete-tecnico tr, #paquete-tecnico li, #paquete-tecnico svg { break-inside: avoid; }
      #paquete-tecnico h2, #paquete-tecnico h3 { break-after: avoid; }
      #paquete-tecnico svg { width: 100%; min-width: 0 !important; max-height: 110mm; }
      #paquete-tecnico a { color: inherit; text-decoration: none; }
      #paquete-tecnico > section { break-before: page; }
      #paquete-tecnico > section:first-of-type { break-before: auto; }
    }
  `}</style>;
}
