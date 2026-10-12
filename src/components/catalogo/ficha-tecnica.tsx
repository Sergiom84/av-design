import { Tarjeta } from '@/components/ui';
import { ESTADO_DATO_TECNICO, presentarDatoTecnico, type DatoTecnico } from '@/lib/ficha-tecnica';

export function FichaTecnica({ datos }: { datos: readonly DatoTecnico[] }) {
  return <Tarjeta titulo="Ficha técnica">
    {datos.length === 0 ? <p className="text-sm text-tinta-tenue">Sin documentar</p> :
      <ul className="space-y-4">
        {datos.map((dato) => <li key={dato.id ?? dato.clave} className="min-w-0 border-b border-linea pb-3 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{dato.concepto}</h3>
            <span className="text-xs text-tinta-tenue">{ESTADO_DATO_TECNICO[dato.estado]}</span>
          </div>
          {dato.estado !== 'sin_documentar' && <p className="mt-1 break-words text-sm">{presentarDatoTecnico(dato)}</p>}
          {dato.fuente_url && <p className="mt-1 break-words text-xs text-tinta-tenue">
            <a href={dato.fuente_url} target="_blank" rel="noopener noreferrer" className="text-acento underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2">
              {dato.documento ?? 'Fuente'}
            </a>
            {dato.apartado && ` · ${dato.apartado}`}
            {dato.consultado_en && <> · <time dateTime={dato.consultado_en}>{dato.consultado_en}</time></>}
          </p>}
        </li>)}
      </ul>}
  </Tarjeta>;
}
